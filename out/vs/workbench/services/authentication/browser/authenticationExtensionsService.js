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
import { Disposable, DisposableStore, dispose, MutableDisposable } from "../../../../base/common/lifecycle.js";
import * as nls from "../../../../nls.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Severity } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IActivityService, NumberBadge } from "../../activity/common/activity.js";
import { IAuthenticationAccessService } from "./authenticationAccessService.js";
import { IAuthenticationUsageService } from "./authenticationUsageService.js";
import { IAuthenticationService, IAuthenticationExtensionsService } from "../common/authentication.js";
import { Emitter } from "../../../../base/common/event.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
const SCOPESLIST_SEPARATOR = " ";
let AuthenticationExtensionsService = class extends Disposable {
  constructor(activityService, storageService, dialogService, quickInputService, _productService, _authenticationService, _authenticationUsageService, _authenticationAccessService) {
    super();
    this.activityService = activityService;
    this.storageService = storageService;
    this.dialogService = dialogService;
    this.quickInputService = quickInputService;
    this._productService = _productService;
    this._authenticationService = _authenticationService;
    this._authenticationUsageService = _authenticationUsageService;
    this._authenticationAccessService = _authenticationAccessService;
    this._signInRequestItems = /* @__PURE__ */ new Map();
    this._sessionAccessRequestItems = /* @__PURE__ */ new Map();
    this._accountBadgeDisposable = this._register(new MutableDisposable());
    this._onDidAccountPreferenceChange = this._register(new Emitter());
    this.onDidChangeAccountPreference = this._onDidAccountPreferenceChange.event;
    this._inheritAuthAccountPreferenceParentToChildren = this._productService.inheritAuthAccountPreference || {};
    this._inheritAuthAccountPreferenceChildToParent = Object.entries(this._inheritAuthAccountPreferenceParentToChildren).reduce((acc, [parent, children]) => {
      children.forEach((child) => {
        acc[child] = parent;
      });
      return acc;
    }, {});
    this.registerListeners();
  }
  registerListeners() {
    this._register(this._authenticationService.onDidChangeSessions(async (e) => {
      if (e.event.added?.length) {
        await this.updateNewSessionRequests(e.providerId, e.event.added);
      }
      if (e.event.removed?.length) {
        await this.updateAccessRequests(e.providerId, e.event.removed);
      }
      this.updateBadgeCount();
    }));
    this._register(this._authenticationService.onDidUnregisterAuthenticationProvider((e) => {
      const accessRequests = this._sessionAccessRequestItems.get(e.id) || {};
      Object.keys(accessRequests).forEach((extensionId) => {
        this.removeAccessRequest(e.id, extensionId);
      });
    }));
  }
  async updateNewSessionRequests(providerId, addedSessions) {
    const existingRequestsForProvider = this._signInRequestItems.get(providerId);
    if (!existingRequestsForProvider) {
      return;
    }
    Object.keys(existingRequestsForProvider).forEach((requestedScopes) => {
      if (addedSessions.some((session) => session.scopes.slice().join(SCOPESLIST_SEPARATOR) === requestedScopes)) {
        const sessionRequest = existingRequestsForProvider[requestedScopes];
        sessionRequest?.disposables.forEach((item) => item.dispose());
        delete existingRequestsForProvider[requestedScopes];
        if (Object.keys(existingRequestsForProvider).length === 0) {
          this._signInRequestItems.delete(providerId);
        } else {
          this._signInRequestItems.set(providerId, existingRequestsForProvider);
        }
      }
    });
  }
  async updateAccessRequests(providerId, removedSessions) {
    const providerRequests = this._sessionAccessRequestItems.get(providerId);
    if (providerRequests) {
      Object.keys(providerRequests).forEach((extensionId) => {
        removedSessions.forEach((removed) => {
          const indexOfSession = providerRequests[extensionId].possibleSessions.findIndex((session) => session.id === removed.id);
          if (indexOfSession) {
            providerRequests[extensionId].possibleSessions.splice(indexOfSession, 1);
          }
        });
        if (!providerRequests[extensionId].possibleSessions.length) {
          this.removeAccessRequest(providerId, extensionId);
        }
      });
    }
  }
  updateBadgeCount() {
    this._accountBadgeDisposable.clear();
    let numberOfRequests = 0;
    this._signInRequestItems.forEach((providerRequests) => {
      Object.keys(providerRequests).forEach((request) => {
        numberOfRequests += providerRequests[request].requestingExtensionIds.length;
      });
    });
    this._sessionAccessRequestItems.forEach((accessRequest) => {
      numberOfRequests += Object.keys(accessRequest).length;
    });
    if (numberOfRequests > 0) {
      const badge = new NumberBadge(numberOfRequests, () => nls.localize("sign in", "Sign in requested"));
      this._accountBadgeDisposable.value = this.activityService.showAccountsActivity({ badge });
    }
  }
  removeAccessRequest(providerId, extensionId) {
    const providerRequests = this._sessionAccessRequestItems.get(providerId) || {};
    if (providerRequests[extensionId]) {
      dispose(providerRequests[extensionId].disposables);
      delete providerRequests[extensionId];
      this.updateBadgeCount();
    }
  }
  //#region Account/Session Preference
  updateAccountPreference(extensionId, providerId, account) {
    const realExtensionId = ExtensionIdentifier.toKey(extensionId);
    const parentExtensionId = this._inheritAuthAccountPreferenceChildToParent[realExtensionId] ?? realExtensionId;
    const key = this._getKey(parentExtensionId, providerId);
    this.storageService.store(key, account.label, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this.storageService.store(key, account.label, StorageScope.APPLICATION, StorageTarget.MACHINE);
    const childrenExtensions = this._inheritAuthAccountPreferenceParentToChildren[parentExtensionId];
    const extensionIds = childrenExtensions ? [parentExtensionId, ...childrenExtensions] : [parentExtensionId];
    this._onDidAccountPreferenceChange.fire({ extensionIds, providerId });
  }
  getAccountPreference(extensionId, providerId) {
    const realExtensionId = ExtensionIdentifier.toKey(extensionId);
    const key = this._getKey(this._inheritAuthAccountPreferenceChildToParent[realExtensionId] ?? realExtensionId, providerId);
    return this.storageService.get(key, StorageScope.WORKSPACE) ?? this.storageService.get(key, StorageScope.APPLICATION);
  }
  removeAccountPreference(extensionId, providerId) {
    const realExtensionId = ExtensionIdentifier.toKey(extensionId);
    const key = this._getKey(this._inheritAuthAccountPreferenceChildToParent[realExtensionId] ?? realExtensionId, providerId);
    this.storageService.remove(key, StorageScope.WORKSPACE);
    this.storageService.remove(key, StorageScope.APPLICATION);
  }
  _getKey(extensionId, providerId) {
    return `${extensionId}-${providerId}`;
  }
  // TODO@TylerLeonhardt: Remove all of this after a couple iterations
  updateSessionPreference(providerId, extensionId, session) {
    const realExtensionId = ExtensionIdentifier.toKey(extensionId);
    const key = `${realExtensionId}-${providerId}-${session.scopes.join(SCOPESLIST_SEPARATOR)}`;
    this.storageService.store(key, session.id, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this.storageService.store(key, session.id, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  getSessionPreference(providerId, extensionId, scopes) {
    const realExtensionId = ExtensionIdentifier.toKey(extensionId);
    const key = `${realExtensionId}-${providerId}-${scopes.join(SCOPESLIST_SEPARATOR)}`;
    return this.storageService.get(key, StorageScope.WORKSPACE) ?? this.storageService.get(key, StorageScope.APPLICATION);
  }
  removeSessionPreference(providerId, extensionId, scopes) {
    const realExtensionId = ExtensionIdentifier.toKey(extensionId);
    const key = `${realExtensionId}-${providerId}-${scopes.join(SCOPESLIST_SEPARATOR)}`;
    this.storageService.remove(key, StorageScope.WORKSPACE);
    this.storageService.remove(key, StorageScope.APPLICATION);
  }
  _updateAccountAndSessionPreferences(providerId, extensionId, session) {
    this.updateAccountPreference(extensionId, providerId, session.account);
    this.updateSessionPreference(providerId, extensionId, session);
  }
  //#endregion
  async showGetSessionPrompt(provider, accountName, extensionId, extensionName) {
    let SessionPromptChoice;
    ((SessionPromptChoice2) => {
      SessionPromptChoice2[SessionPromptChoice2["Allow"] = 0] = "Allow";
      SessionPromptChoice2[SessionPromptChoice2["Deny"] = 1] = "Deny";
      SessionPromptChoice2[SessionPromptChoice2["Cancel"] = 2] = "Cancel";
    })(SessionPromptChoice || (SessionPromptChoice = {}));
    const { result } = await this.dialogService.prompt({
      type: Severity.Info,
      message: nls.localize("confirmAuthenticationAccess", "The extension '{0}' wants to access the {1} account '{2}'.", extensionName, provider.label, accountName),
      buttons: [
        {
          label: nls.localize({ key: "allow", comment: ["&& denotes a mnemonic"] }, "&&Allow"),
          run: () => 0 /* Allow */
        },
        {
          label: nls.localize({ key: "deny", comment: ["&& denotes a mnemonic"] }, "&&Deny"),
          run: () => 1 /* Deny */
        }
      ],
      cancelButton: {
        run: () => 2 /* Cancel */
      }
    });
    if (result !== 2 /* Cancel */) {
      this._authenticationAccessService.updateAllowedExtensions(provider.id, accountName, [{ id: extensionId, name: extensionName, allowed: result === 0 /* Allow */ }]);
      this.removeAccessRequest(provider.id, extensionId);
    }
    return result === 0 /* Allow */;
  }
  /**
   * This function should be used only when there are sessions to disambiguate.
   */
  async selectSession(providerId, extensionId, extensionName, scopes, availableSessions) {
    const allAccounts = await this._authenticationService.getAccounts(providerId);
    if (!allAccounts.length) {
      throw new Error("No accounts available");
    }
    const disposables = new DisposableStore();
    const quickPick = disposables.add(this.quickInputService.createQuickPick());
    quickPick.ignoreFocusOut = true;
    const accountsWithSessions = /* @__PURE__ */ new Set();
    const items = availableSessions.filter((session) => !accountsWithSessions.has(session.account.label) && accountsWithSessions.add(session.account.label)).map((session) => {
      return {
        label: session.account.label,
        session
      };
    });
    allAccounts.forEach((account) => {
      if (!accountsWithSessions.has(account.label)) {
        items.push({ label: account.label, account });
      }
    });
    items.push({ label: nls.localize("useOtherAccount", "Sign in to another account") });
    quickPick.items = items;
    quickPick.title = nls.localize(
      {
        key: "selectAccount",
        comment: ["The placeholder {0} is the name of an extension. {1} is the name of the type of account, such as Microsoft or GitHub."]
      },
      "The extension '{0}' wants to access a {1} account",
      extensionName,
      this._authenticationService.getProvider(providerId).label
    );
    quickPick.placeholder = nls.localize("getSessionPlateholder", "Select an account for '{0}' to use or Esc to cancel", extensionName);
    return await new Promise((resolve, reject) => {
      disposables.add(quickPick.onDidAccept(async (_) => {
        quickPick.dispose();
        let session = quickPick.selectedItems[0].session;
        if (!session) {
          const account = quickPick.selectedItems[0].account;
          try {
            session = await this._authenticationService.createSession(providerId, scopes, { account });
          } catch (e) {
            reject(e);
            return;
          }
        }
        const accountName = session.account.label;
        this._authenticationAccessService.updateAllowedExtensions(providerId, accountName, [{ id: extensionId, name: extensionName, allowed: true }]);
        this._updateAccountAndSessionPreferences(providerId, extensionId, session);
        this.removeAccessRequest(providerId, extensionId);
        resolve(session);
      }));
      disposables.add(quickPick.onDidHide((_) => {
        if (!quickPick.selectedItems[0]) {
          reject("User did not consent to account access");
        }
        disposables.dispose();
      }));
      quickPick.show();
    });
  }
  async completeSessionAccessRequest(provider, extensionId, extensionName, scopes) {
    const providerRequests = this._sessionAccessRequestItems.get(provider.id) || {};
    const existingRequest = providerRequests[extensionId];
    if (!existingRequest) {
      return;
    }
    if (!provider) {
      return;
    }
    const possibleSessions = existingRequest.possibleSessions;
    let session;
    if (provider.supportsMultipleAccounts) {
      try {
        session = await this.selectSession(provider.id, extensionId, extensionName, scopes, possibleSessions);
      } catch (_) {
      }
    } else {
      const approved = await this.showGetSessionPrompt(provider, possibleSessions[0].account.label, extensionId, extensionName);
      if (approved) {
        session = possibleSessions[0];
      }
    }
    if (session) {
      this._authenticationUsageService.addAccountUsage(provider.id, session.account.label, session.scopes, extensionId, extensionName);
    }
  }
  requestSessionAccess(providerId, extensionId, extensionName, scopes, possibleSessions) {
    const providerRequests = this._sessionAccessRequestItems.get(providerId) || {};
    const hasExistingRequest = providerRequests[extensionId];
    if (hasExistingRequest) {
      return;
    }
    const provider = this._authenticationService.getProvider(providerId);
    const menuItem = MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
      group: "3_accessRequests",
      command: {
        id: `${providerId}${extensionId}Access`,
        title: nls.localize(
          {
            key: "accessRequest",
            comment: [`The placeholder {0} will be replaced with an authentication provider''s label. {1} will be replaced with an extension name. (1) is to indicate that this menu item contributes to a badge count`]
          },
          "Grant access to {0} for {1}... (1)",
          provider.label,
          extensionName
        )
      }
    });
    const accessCommand = CommandsRegistry.registerCommand({
      id: `${providerId}${extensionId}Access`,
      handler: async (accessor) => {
        this.completeSessionAccessRequest(provider, extensionId, extensionName, scopes);
      }
    });
    providerRequests[extensionId] = { possibleSessions, disposables: [menuItem, accessCommand] };
    this._sessionAccessRequestItems.set(providerId, providerRequests);
    this.updateBadgeCount();
  }
  async requestNewSession(providerId, scopes, extensionId, extensionName) {
    if (!this._authenticationService.isAuthenticationProviderRegistered(providerId)) {
      await new Promise((resolve, _) => {
        const dispose2 = this._authenticationService.onDidRegisterAuthenticationProvider((e) => {
          if (e.id === providerId) {
            dispose2.dispose();
            resolve();
          }
        });
      });
    }
    let provider;
    try {
      provider = this._authenticationService.getProvider(providerId);
    } catch (_e) {
      return;
    }
    const providerRequests = this._signInRequestItems.get(providerId);
    const scopesList = scopes.join(SCOPESLIST_SEPARATOR);
    const extensionHasExistingRequest = providerRequests && providerRequests[scopesList] && providerRequests[scopesList].requestingExtensionIds.includes(extensionId);
    if (extensionHasExistingRequest) {
      return;
    }
    const commandId = `${providerId}:${extensionId}:signIn${Object.keys(providerRequests || []).length}`;
    const menuItem = MenuRegistry.appendMenuItem(MenuId.AccountsContext, {
      group: "2_signInRequests",
      command: {
        id: commandId,
        title: nls.localize(
          {
            key: "signInRequest",
            comment: [`The placeholder {0} will be replaced with an authentication provider's label. {1} will be replaced with an extension name. (1) is to indicate that this menu item contributes to a badge count.`]
          },
          "Sign in with {0} to use {1} (1)",
          provider.label,
          extensionName
        )
      }
    });
    const signInCommand = CommandsRegistry.registerCommand({
      id: commandId,
      handler: async (accessor) => {
        const authenticationService = accessor.get(IAuthenticationService);
        const session = await authenticationService.createSession(providerId, scopes);
        this._authenticationAccessService.updateAllowedExtensions(providerId, session.account.label, [{ id: extensionId, name: extensionName, allowed: true }]);
        this._updateAccountAndSessionPreferences(providerId, extensionId, session);
      }
    });
    if (providerRequests) {
      const existingRequest = providerRequests[scopesList] || { disposables: [], requestingExtensionIds: [] };
      providerRequests[scopesList] = {
        disposables: [...existingRequest.disposables, menuItem, signInCommand],
        requestingExtensionIds: [...existingRequest.requestingExtensionIds, extensionId]
      };
      this._signInRequestItems.set(providerId, providerRequests);
    } else {
      this._signInRequestItems.set(providerId, {
        [scopesList]: {
          disposables: [menuItem, signInCommand],
          requestingExtensionIds: [extensionId]
        }
      });
    }
    this.updateBadgeCount();
  }
};
AuthenticationExtensionsService = __decorateClass([
  __decorateParam(0, IActivityService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IAuthenticationService),
  __decorateParam(6, IAuthenticationUsageService),
  __decorateParam(7, IAuthenticationAccessService)
], AuthenticationExtensionsService);
registerSingleton(IAuthenticationExtensionsService, AuthenticationExtensionsService, InstantiationType.Delayed);
export {
  AuthenticationExtensionsService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvYXV0aGVudGljYXRpb24vYnJvd3Nlci9hdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBNZW51SWQsIE1lbnVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElBY3Rpdml0eVNlcnZpY2UsIE51bWJlckJhZGdlIH0gZnJvbSAnLi4vLi4vYWN0aXZpdHkvY29tbW9uL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IElBdXRoZW50aWNhdGlvbkFjY2Vzc1NlcnZpY2UgfSBmcm9tICcuL2F1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQXV0aGVudGljYXRpb25Vc2FnZVNlcnZpY2UgfSBmcm9tICcuL2F1dGhlbnRpY2F0aW9uVXNhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbiwgSUF1dGhlbnRpY2F0aW9uUHJvdmlkZXIsIElBdXRoZW50aWNhdGlvblNlcnZpY2UsIElBdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLCBBdXRoZW50aWNhdGlvblNlc3Npb25BY2NvdW50IH0gZnJvbSAnLi4vY29tbW9uL2F1dGhlbnRpY2F0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5cbi8vIE9BdXRoMiBzcGVjIHByb2hpYml0cyBzcGFjZSBpbiBhIHNjb3BlLCBzbyB1c2UgdGhhdCB0byBqb2luIHRoZW0uXG5jb25zdCBTQ09QRVNMSVNUX1NFUEFSQVRPUiA9ICcgJztcblxuaW50ZXJmYWNlIFNlc3Npb25SZXF1ZXN0IHtcblx0ZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW107XG5cdHJlcXVlc3RpbmdFeHRlbnNpb25JZHM6IHN0cmluZ1tdO1xufVxuXG5pbnRlcmZhY2UgU2Vzc2lvblJlcXVlc3RJbmZvIHtcblx0W3Njb3Blc0xpc3Q6IHN0cmluZ106IFNlc3Npb25SZXF1ZXN0O1xufVxuXG4vLyBUT0RPQFR5bGVyTGVvbmhhcmR0OiBUaGlzIHNob3VsZCBhbGwgZ28gaW4gTWFpblRocmVhZEF1dGhlbnRpY2F0aW9uXG5leHBvcnQgY2xhc3MgQXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9zaWduSW5SZXF1ZXN0SXRlbXMgPSBuZXcgTWFwPHN0cmluZywgU2Vzc2lvblJlcXVlc3RJbmZvPigpO1xuXHRwcml2YXRlIF9zZXNzaW9uQWNjZXNzUmVxdWVzdEl0ZW1zID0gbmV3IE1hcDxzdHJpbmcsIHsgW2V4dGVuc2lvbklkOiBzdHJpbmddOiB7IGRpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdOyBwb3NzaWJsZVNlc3Npb25zOiBBdXRoZW50aWNhdGlvblNlc3Npb25bXSB9IH0+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjY291bnRCYWRnZURpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cHJpdmF0ZSBfb25EaWRBY2NvdW50UHJlZmVyZW5jZUNoYW5nZTogRW1pdHRlcjx7IHByb3ZpZGVySWQ6IHN0cmluZzsgZXh0ZW5zaW9uSWRzOiBzdHJpbmdbXSB9PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgcHJvdmlkZXJJZDogc3RyaW5nOyBleHRlbnNpb25JZHM6IHN0cmluZ1tdIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFjY291bnRQcmVmZXJlbmNlID0gdGhpcy5fb25EaWRBY2NvdW50UHJlZmVyZW5jZUNoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIF9pbmhlcml0QXV0aEFjY291bnRQcmVmZXJlbmNlUGFyZW50VG9DaGlsZHJlbjogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+O1xuXHRwcml2YXRlIF9pbmhlcml0QXV0aEFjY291bnRQcmVmZXJlbmNlQ2hpbGRUb1BhcmVudDogeyBbZXh0ZW5zaW9uSWQ6IHN0cmluZ106IHN0cmluZyB9O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQWN0aXZpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWN0aXZpdHlTZXJ2aWNlOiBJQWN0aXZpdHlTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUF1dGhlbnRpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hdXRoZW50aWNhdGlvblNlcnZpY2U6IElBdXRoZW50aWNhdGlvblNlcnZpY2UsXG5cdFx0QElBdXRoZW50aWNhdGlvblVzYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hdXRoZW50aWNhdGlvblVzYWdlU2VydmljZTogSUF1dGhlbnRpY2F0aW9uVXNhZ2VTZXJ2aWNlLFxuXHRcdEBJQXV0aGVudGljYXRpb25BY2Nlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2F1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZTogSUF1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2luaGVyaXRBdXRoQWNjb3VudFByZWZlcmVuY2VQYXJlbnRUb0NoaWxkcmVuID0gdGhpcy5fcHJvZHVjdFNlcnZpY2UuaW5oZXJpdEF1dGhBY2NvdW50UHJlZmVyZW5jZSB8fCB7fTtcblx0XHR0aGlzLl9pbmhlcml0QXV0aEFjY291bnRQcmVmZXJlbmNlQ2hpbGRUb1BhcmVudCA9IE9iamVjdC5lbnRyaWVzKHRoaXMuX2luaGVyaXRBdXRoQWNjb3VudFByZWZlcmVuY2VQYXJlbnRUb0NoaWxkcmVuKS5yZWR1Y2U8eyBbZXh0ZW5zaW9uSWQ6IHN0cmluZ106IHN0cmluZyB9PigoYWNjLCBbcGFyZW50LCBjaGlsZHJlbl0pID0+IHtcblx0XHRcdGNoaWxkcmVuLmZvckVhY2goKGNoaWxkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0YWNjW2NoaWxkXSA9IHBhcmVudDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGFjYztcblx0XHR9LCB7fSk7XG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9hdXRoZW50aWNhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VTZXNzaW9ucyhhc3luYyBlID0+IHtcblx0XHRcdGlmIChlLmV2ZW50LmFkZGVkPy5sZW5ndGgpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51cGRhdGVOZXdTZXNzaW9uUmVxdWVzdHMoZS5wcm92aWRlcklkLCBlLmV2ZW50LmFkZGVkKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmV2ZW50LnJlbW92ZWQ/Lmxlbmd0aCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVwZGF0ZUFjY2Vzc1JlcXVlc3RzKGUucHJvdmlkZXJJZCwgZS5ldmVudC5yZW1vdmVkKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlQmFkZ2VDb3VudCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2F1dGhlbnRpY2F0aW9uU2VydmljZS5vbkRpZFVucmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKGUgPT4ge1xuXHRcdFx0Y29uc3QgYWNjZXNzUmVxdWVzdHMgPSB0aGlzLl9zZXNzaW9uQWNjZXNzUmVxdWVzdEl0ZW1zLmdldChlLmlkKSB8fCB7fTtcblx0XHRcdE9iamVjdC5rZXlzKGFjY2Vzc1JlcXVlc3RzKS5mb3JFYWNoKGV4dGVuc2lvbklkID0+IHtcblx0XHRcdFx0dGhpcy5yZW1vdmVBY2Nlc3NSZXF1ZXN0KGUuaWQsIGV4dGVuc2lvbklkKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlTmV3U2Vzc2lvblJlcXVlc3RzKHByb3ZpZGVySWQ6IHN0cmluZywgYWRkZWRTZXNzaW9uczogcmVhZG9ubHkgQXV0aGVudGljYXRpb25TZXNzaW9uW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBleGlzdGluZ1JlcXVlc3RzRm9yUHJvdmlkZXIgPSB0aGlzLl9zaWduSW5SZXF1ZXN0SXRlbXMuZ2V0KHByb3ZpZGVySWQpO1xuXHRcdGlmICghZXhpc3RpbmdSZXF1ZXN0c0ZvclByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0T2JqZWN0LmtleXMoZXhpc3RpbmdSZXF1ZXN0c0ZvclByb3ZpZGVyKS5mb3JFYWNoKHJlcXVlc3RlZFNjb3BlcyA9PiB7XG5cdFx0XHRpZiAoYWRkZWRTZXNzaW9ucy5zb21lKHNlc3Npb24gPT4gc2Vzc2lvbi5zY29wZXMuc2xpY2UoKS5qb2luKFNDT1BFU0xJU1RfU0VQQVJBVE9SKSA9PT0gcmVxdWVzdGVkU2NvcGVzKSkge1xuXHRcdFx0XHRjb25zdCBzZXNzaW9uUmVxdWVzdCA9IGV4aXN0aW5nUmVxdWVzdHNGb3JQcm92aWRlcltyZXF1ZXN0ZWRTY29wZXNdO1xuXHRcdFx0XHRzZXNzaW9uUmVxdWVzdD8uZGlzcG9zYWJsZXMuZm9yRWFjaChpdGVtID0+IGl0ZW0uZGlzcG9zZSgpKTtcblxuXHRcdFx0XHRkZWxldGUgZXhpc3RpbmdSZXF1ZXN0c0ZvclByb3ZpZGVyW3JlcXVlc3RlZFNjb3Blc107XG5cdFx0XHRcdGlmIChPYmplY3Qua2V5cyhleGlzdGluZ1JlcXVlc3RzRm9yUHJvdmlkZXIpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHRoaXMuX3NpZ25JblJlcXVlc3RJdGVtcy5kZWxldGUocHJvdmlkZXJJZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fc2lnbkluUmVxdWVzdEl0ZW1zLnNldChwcm92aWRlcklkLCBleGlzdGluZ1JlcXVlc3RzRm9yUHJvdmlkZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUFjY2Vzc1JlcXVlc3RzKHByb3ZpZGVySWQ6IHN0cmluZywgcmVtb3ZlZFNlc3Npb25zOiByZWFkb25seSBBdXRoZW50aWNhdGlvblNlc3Npb25bXSkge1xuXHRcdGNvbnN0IHByb3ZpZGVyUmVxdWVzdHMgPSB0aGlzLl9zZXNzaW9uQWNjZXNzUmVxdWVzdEl0ZW1zLmdldChwcm92aWRlcklkKTtcblx0XHRpZiAocHJvdmlkZXJSZXF1ZXN0cykge1xuXHRcdFx0T2JqZWN0LmtleXMocHJvdmlkZXJSZXF1ZXN0cykuZm9yRWFjaChleHRlbnNpb25JZCA9PiB7XG5cdFx0XHRcdHJlbW92ZWRTZXNzaW9ucy5mb3JFYWNoKHJlbW92ZWQgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGluZGV4T2ZTZXNzaW9uID0gcHJvdmlkZXJSZXF1ZXN0c1tleHRlbnNpb25JZF0ucG9zc2libGVTZXNzaW9ucy5maW5kSW5kZXgoc2Vzc2lvbiA9PiBzZXNzaW9uLmlkID09PSByZW1vdmVkLmlkKTtcblx0XHRcdFx0XHRpZiAoaW5kZXhPZlNlc3Npb24pIHtcblx0XHRcdFx0XHRcdHByb3ZpZGVyUmVxdWVzdHNbZXh0ZW5zaW9uSWRdLnBvc3NpYmxlU2Vzc2lvbnMuc3BsaWNlKGluZGV4T2ZTZXNzaW9uLCAxKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmICghcHJvdmlkZXJSZXF1ZXN0c1tleHRlbnNpb25JZF0ucG9zc2libGVTZXNzaW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLnJlbW92ZUFjY2Vzc1JlcXVlc3QocHJvdmlkZXJJZCwgZXh0ZW5zaW9uSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUJhZGdlQ291bnQoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWNjb3VudEJhZGdlRGlzcG9zYWJsZS5jbGVhcigpO1xuXG5cdFx0bGV0IG51bWJlck9mUmVxdWVzdHMgPSAwO1xuXHRcdHRoaXMuX3NpZ25JblJlcXVlc3RJdGVtcy5mb3JFYWNoKHByb3ZpZGVyUmVxdWVzdHMgPT4ge1xuXHRcdFx0T2JqZWN0LmtleXMocHJvdmlkZXJSZXF1ZXN0cykuZm9yRWFjaChyZXF1ZXN0ID0+IHtcblx0XHRcdFx0bnVtYmVyT2ZSZXF1ZXN0cyArPSBwcm92aWRlclJlcXVlc3RzW3JlcXVlc3RdLnJlcXVlc3RpbmdFeHRlbnNpb25JZHMubGVuZ3RoO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9zZXNzaW9uQWNjZXNzUmVxdWVzdEl0ZW1zLmZvckVhY2goYWNjZXNzUmVxdWVzdCA9PiB7XG5cdFx0XHRudW1iZXJPZlJlcXVlc3RzICs9IE9iamVjdC5rZXlzKGFjY2Vzc1JlcXVlc3QpLmxlbmd0aDtcblx0XHR9KTtcblxuXHRcdGlmIChudW1iZXJPZlJlcXVlc3RzID4gMCkge1xuXHRcdFx0Y29uc3QgYmFkZ2UgPSBuZXcgTnVtYmVyQmFkZ2UobnVtYmVyT2ZSZXF1ZXN0cywgKCkgPT4gbmxzLmxvY2FsaXplKCdzaWduIGluJywgXCJTaWduIGluIHJlcXVlc3RlZFwiKSk7XG5cdFx0XHR0aGlzLl9hY2NvdW50QmFkZ2VEaXNwb3NhYmxlLnZhbHVlID0gdGhpcy5hY3Rpdml0eVNlcnZpY2Uuc2hvd0FjY291bnRzQWN0aXZpdHkoeyBiYWRnZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUFjY2Vzc1JlcXVlc3QocHJvdmlkZXJJZDogc3RyaW5nLCBleHRlbnNpb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXJSZXF1ZXN0cyA9IHRoaXMuX3Nlc3Npb25BY2Nlc3NSZXF1ZXN0SXRlbXMuZ2V0KHByb3ZpZGVySWQpIHx8IHt9O1xuXHRcdGlmIChwcm92aWRlclJlcXVlc3RzW2V4dGVuc2lvbklkXSkge1xuXHRcdFx0ZGlzcG9zZShwcm92aWRlclJlcXVlc3RzW2V4dGVuc2lvbklkXS5kaXNwb3NhYmxlcyk7XG5cdFx0XHRkZWxldGUgcHJvdmlkZXJSZXF1ZXN0c1tleHRlbnNpb25JZF07XG5cdFx0XHR0aGlzLnVwZGF0ZUJhZGdlQ291bnQoKTtcblx0XHR9XG5cdH1cblxuXHQvLyNyZWdpb24gQWNjb3VudC9TZXNzaW9uIFByZWZlcmVuY2VcblxuXHR1cGRhdGVBY2NvdW50UHJlZmVyZW5jZShleHRlbnNpb25JZDogc3RyaW5nLCBwcm92aWRlcklkOiBzdHJpbmcsIGFjY291bnQ6IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbkFjY291bnQpOiB2b2lkIHtcblx0XHRjb25zdCByZWFsRXh0ZW5zaW9uSWQgPSBFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKTtcblx0XHRjb25zdCBwYXJlbnRFeHRlbnNpb25JZCA9IHRoaXMuX2luaGVyaXRBdXRoQWNjb3VudFByZWZlcmVuY2VDaGlsZFRvUGFyZW50W3JlYWxFeHRlbnNpb25JZF0gPz8gcmVhbEV4dGVuc2lvbklkO1xuXHRcdGNvbnN0IGtleSA9IHRoaXMuX2dldEtleShwYXJlbnRFeHRlbnNpb25JZCwgcHJvdmlkZXJJZCk7XG5cblx0XHQvLyBTdG9yZSB0aGUgcHJlZmVyZW5jZSBpbiB0aGUgd29ya3NwYWNlIGFuZCBhcHBsaWNhdGlvbiBzdG9yYWdlLiBUaGlzIGFsbG93cyBuZXcgd29ya3NwYWNlcyB0b1xuXHRcdC8vIGhhdmUgYSBwcmVmZXJlbmNlIHNldCBhbHJlYWR5IHRvIGxpbWl0IHRoZSBudW1iZXIgb2YgcHJvbXB0cyB0aGF0IGFyZSBzaG93bi4uLiBidXQgYWxzbyBhbGxvd3Ncblx0XHQvLyBhIHNwZWNpZmljIHdvcmtzcGFjZSB0byBvdmVycmlkZSB0aGUgZ2xvYmFsIHByZWZlcmVuY2UuXG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShrZXksIGFjY291bnQubGFiZWwsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShrZXksIGFjY291bnQubGFiZWwsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblxuXHRcdGNvbnN0IGNoaWxkcmVuRXh0ZW5zaW9ucyA9IHRoaXMuX2luaGVyaXRBdXRoQWNjb3VudFByZWZlcmVuY2VQYXJlbnRUb0NoaWxkcmVuW3BhcmVudEV4dGVuc2lvbklkXTtcblx0XHRjb25zdCBleHRlbnNpb25JZHMgPSBjaGlsZHJlbkV4dGVuc2lvbnMgPyBbcGFyZW50RXh0ZW5zaW9uSWQsIC4uLmNoaWxkcmVuRXh0ZW5zaW9uc10gOiBbcGFyZW50RXh0ZW5zaW9uSWRdO1xuXHRcdHRoaXMuX29uRGlkQWNjb3VudFByZWZlcmVuY2VDaGFuZ2UuZmlyZSh7IGV4dGVuc2lvbklkcywgcHJvdmlkZXJJZCB9KTtcblx0fVxuXG5cdGdldEFjY291bnRQcmVmZXJlbmNlKGV4dGVuc2lvbklkOiBzdHJpbmcsIHByb3ZpZGVySWQ6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVhbEV4dGVuc2lvbklkID0gRXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShleHRlbnNpb25JZCk7XG5cdFx0Y29uc3Qga2V5ID0gdGhpcy5fZ2V0S2V5KHRoaXMuX2luaGVyaXRBdXRoQWNjb3VudFByZWZlcmVuY2VDaGlsZFRvUGFyZW50W3JlYWxFeHRlbnNpb25JZF0gPz8gcmVhbEV4dGVuc2lvbklkLCBwcm92aWRlcklkKTtcblxuXHRcdC8vIElmIGEgcHJlZmVyZW5jZSBpcyBzZXQgaW4gdGhlIHdvcmtzcGFjZSwgdXNlIHRoYXQuIE90aGVyd2lzZSwgdXNlIHRoZSBnbG9iYWwgcHJlZmVyZW5jZS5cblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoa2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKSA/PyB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChrZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdH1cblxuXHRyZW1vdmVBY2NvdW50UHJlZmVyZW5jZShleHRlbnNpb25JZDogc3RyaW5nLCBwcm92aWRlcklkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCByZWFsRXh0ZW5zaW9uSWQgPSBFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKTtcblx0XHRjb25zdCBrZXkgPSB0aGlzLl9nZXRLZXkodGhpcy5faW5oZXJpdEF1dGhBY2NvdW50UHJlZmVyZW5jZUNoaWxkVG9QYXJlbnRbcmVhbEV4dGVuc2lvbklkXSA/PyByZWFsRXh0ZW5zaW9uSWQsIHByb3ZpZGVySWQpO1xuXG5cdFx0Ly8gVGhpcyB3b24ndCBhZmZlY3QgYW55IG90aGVyIHdvcmtzcGFjZXMgdGhhdCBoYXZlIGEgcHJlZmVyZW5jZSBzZXQsIGJ1dCBpdCB3aWxsIHJlbW92ZSB0aGUgcHJlZmVyZW5jZVxuXHRcdC8vIGZvciB0aGlzIHdvcmtzcGFjZSBhbmQgdGhlIGdsb2JhbCBwcmVmZXJlbmNlLiBUaGlzIGlzIG9ubHkgcGFpcmVkIHdpdGggYSBjYWxsIHRvIHVwZGF0ZVNlc3Npb25QcmVmZXJlbmNlLi4uXG5cdFx0Ly8gc28gd2UgcmVhbGx5IGRvbid0IF9uZWVkXyB0byByZW1vdmUgdGhlbSBhcyB0aGV5IGFyZSBhYm91dCB0byBiZSBvdmVycmlkZGVuIGFueXdheS4uLiBidXQgaXQncyBtb3JlIGNvcnJlY3Rcblx0XHQvLyB0byByZW1vdmUgdGhlbSBmaXJzdC4uLiBhbmQgaW4gY2FzZSB0aGlzIGdldHMgY2FsbGVkIGZyb20gc29tZXdoZXJlIGVsc2UgaW4gdGhlIGZ1dHVyZS5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShrZXksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKGtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEtleShleHRlbnNpb25JZDogc3RyaW5nLCBwcm92aWRlcklkOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHtleHRlbnNpb25JZH0tJHtwcm92aWRlcklkfWA7XG5cdH1cblxuXHQvLyBUT0RPQFR5bGVyTGVvbmhhcmR0OiBSZW1vdmUgYWxsIG9mIHRoaXMgYWZ0ZXIgYSBjb3VwbGUgaXRlcmF0aW9uc1xuXG5cdHVwZGF0ZVNlc3Npb25QcmVmZXJlbmNlKHByb3ZpZGVySWQ6IHN0cmluZywgZXh0ZW5zaW9uSWQ6IHN0cmluZywgc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVhbEV4dGVuc2lvbklkID0gRXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShleHRlbnNpb25JZCk7XG5cdFx0Ly8gVGhlIDMgcGFydHMgb2YgdGhpcyBrZXkgYXJlIGltcG9ydGFudDpcblx0XHQvLyAqIEV4dGVuc2lvbiBpZDogVGhlIGV4dGVuc2lvbiB0aGF0IGhhcyBhIHByZWZlcmVuY2Vcblx0XHQvLyAqIFByb3ZpZGVyIGlkOiBUaGUgcHJvdmlkZXIgdGhhdCB0aGUgcHJlZmVyZW5jZSBpcyBmb3Jcblx0XHQvLyAqIFRoZSBzY29wZXM6IFRoZSBzdWJzZXQgb2Ygc2Vzc2lvbnMgdGhhdCB0aGUgcHJlZmVyZW5jZSBhcHBsaWVzIHRvXG5cdFx0Y29uc3Qga2V5ID0gYCR7cmVhbEV4dGVuc2lvbklkfS0ke3Byb3ZpZGVySWR9LSR7c2Vzc2lvbi5zY29wZXMuam9pbihTQ09QRVNMSVNUX1NFUEFSQVRPUil9YDtcblxuXHRcdC8vIFN0b3JlIHRoZSBwcmVmZXJlbmNlIGluIHRoZSB3b3Jrc3BhY2UgYW5kIGFwcGxpY2F0aW9uIHN0b3JhZ2UuIFRoaXMgYWxsb3dzIG5ldyB3b3Jrc3BhY2VzIHRvXG5cdFx0Ly8gaGF2ZSBhIHByZWZlcmVuY2Ugc2V0IGFscmVhZHkgdG8gbGltaXQgdGhlIG51bWJlciBvZiBwcm9tcHRzIHRoYXQgYXJlIHNob3duLi4uIGJ1dCBhbHNvIGFsbG93c1xuXHRcdC8vIGEgc3BlY2lmaWMgd29ya3NwYWNlIHRvIG92ZXJyaWRlIHRoZSBnbG9iYWwgcHJlZmVyZW5jZS5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGtleSwgc2Vzc2lvbi5pZCwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGtleSwgc2Vzc2lvbi5pZCwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0Z2V0U2Vzc2lvblByZWZlcmVuY2UocHJvdmlkZXJJZDogc3RyaW5nLCBleHRlbnNpb25JZDogc3RyaW5nLCBzY29wZXM6IHN0cmluZ1tdKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZWFsRXh0ZW5zaW9uSWQgPSBFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKTtcblx0XHQvLyBUaGUgMyBwYXJ0cyBvZiB0aGlzIGtleSBhcmUgaW1wb3J0YW50OlxuXHRcdC8vICogRXh0ZW5zaW9uIGlkOiBUaGUgZXh0ZW5zaW9uIHRoYXQgaGFzIGEgcHJlZmVyZW5jZVxuXHRcdC8vICogUHJvdmlkZXIgaWQ6IFRoZSBwcm92aWRlciB0aGF0IHRoZSBwcmVmZXJlbmNlIGlzIGZvclxuXHRcdC8vICogVGhlIHNjb3BlczogVGhlIHN1YnNldCBvZiBzZXNzaW9ucyB0aGF0IHRoZSBwcmVmZXJlbmNlIGFwcGxpZXMgdG9cblx0XHRjb25zdCBrZXkgPSBgJHtyZWFsRXh0ZW5zaW9uSWR9LSR7cHJvdmlkZXJJZH0tJHtzY29wZXMuam9pbihTQ09QRVNMSVNUX1NFUEFSQVRPUil9YDtcblxuXHRcdC8vIElmIGEgcHJlZmVyZW5jZSBpcyBzZXQgaW4gdGhlIHdvcmtzcGFjZSwgdXNlIHRoYXQuIE90aGVyd2lzZSwgdXNlIHRoZSBnbG9iYWwgcHJlZmVyZW5jZS5cblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoa2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKSA/PyB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChrZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdH1cblxuXHRyZW1vdmVTZXNzaW9uUHJlZmVyZW5jZShwcm92aWRlcklkOiBzdHJpbmcsIGV4dGVuc2lvbklkOiBzdHJpbmcsIHNjb3Blczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHRjb25zdCByZWFsRXh0ZW5zaW9uSWQgPSBFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKTtcblx0XHQvLyBUaGUgMyBwYXJ0cyBvZiB0aGlzIGtleSBhcmUgaW1wb3J0YW50OlxuXHRcdC8vICogRXh0ZW5zaW9uIGlkOiBUaGUgZXh0ZW5zaW9uIHRoYXQgaGFzIGEgcHJlZmVyZW5jZVxuXHRcdC8vICogUHJvdmlkZXIgaWQ6IFRoZSBwcm92aWRlciB0aGF0IHRoZSBwcmVmZXJlbmNlIGlzIGZvclxuXHRcdC8vICogVGhlIHNjb3BlczogVGhlIHN1YnNldCBvZiBzZXNzaW9ucyB0aGF0IHRoZSBwcmVmZXJlbmNlIGFwcGxpZXMgdG9cblx0XHRjb25zdCBrZXkgPSBgJHtyZWFsRXh0ZW5zaW9uSWR9LSR7cHJvdmlkZXJJZH0tJHtzY29wZXMuam9pbihTQ09QRVNMSVNUX1NFUEFSQVRPUil9YDtcblxuXHRcdC8vIFRoaXMgd29uJ3QgYWZmZWN0IGFueSBvdGhlciB3b3Jrc3BhY2VzIHRoYXQgaGF2ZSBhIHByZWZlcmVuY2Ugc2V0LCBidXQgaXQgd2lsbCByZW1vdmUgdGhlIHByZWZlcmVuY2Vcblx0XHQvLyBmb3IgdGhpcyB3b3Jrc3BhY2UgYW5kIHRoZSBnbG9iYWwgcHJlZmVyZW5jZS4gVGhpcyBpcyBvbmx5IHBhaXJlZCB3aXRoIGEgY2FsbCB0byB1cGRhdGVTZXNzaW9uUHJlZmVyZW5jZS4uLlxuXHRcdC8vIHNvIHdlIHJlYWxseSBkb24ndCBfbmVlZF8gdG8gcmVtb3ZlIHRoZW0gYXMgdGhleSBhcmUgYWJvdXQgdG8gYmUgb3ZlcnJpZGRlbiBhbnl3YXkuLi4gYnV0IGl0J3MgbW9yZSBjb3JyZWN0XG5cdFx0Ly8gdG8gcmVtb3ZlIHRoZW0gZmlyc3QuLi4gYW5kIGluIGNhc2UgdGhpcyBnZXRzIGNhbGxlZCBmcm9tIHNvbWV3aGVyZSBlbHNlIGluIHRoZSBmdXR1cmUuXG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoa2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShrZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVBY2NvdW50QW5kU2Vzc2lvblByZWZlcmVuY2VzKHByb3ZpZGVySWQ6IHN0cmluZywgZXh0ZW5zaW9uSWQ6IHN0cmluZywgc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVBY2NvdW50UHJlZmVyZW5jZShleHRlbnNpb25JZCwgcHJvdmlkZXJJZCwgc2Vzc2lvbi5hY2NvdW50KTtcblx0XHR0aGlzLnVwZGF0ZVNlc3Npb25QcmVmZXJlbmNlKHByb3ZpZGVySWQsIGV4dGVuc2lvbklkLCBzZXNzaW9uKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgYXN5bmMgc2hvd0dldFNlc3Npb25Qcm9tcHQocHJvdmlkZXI6IElBdXRoZW50aWNhdGlvblByb3ZpZGVyLCBhY2NvdW50TmFtZTogc3RyaW5nLCBleHRlbnNpb25JZDogc3RyaW5nLCBleHRlbnNpb25OYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRlbnVtIFNlc3Npb25Qcm9tcHRDaG9pY2Uge1xuXHRcdFx0QWxsb3cgPSAwLFxuXHRcdFx0RGVueSA9IDEsXG5cdFx0XHRDYW5jZWwgPSAyXG5cdFx0fVxuXHRcdGNvbnN0IHsgcmVzdWx0IH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0PFNlc3Npb25Qcm9tcHRDaG9pY2U+KHtcblx0XHRcdHR5cGU6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2NvbmZpcm1BdXRoZW50aWNhdGlvbkFjY2VzcycsIFwiVGhlIGV4dGVuc2lvbiAnezB9JyB3YW50cyB0byBhY2Nlc3MgdGhlIHsxfSBhY2NvdW50ICd7Mn0nLlwiLCBleHRlbnNpb25OYW1lLCBwcm92aWRlci5sYWJlbCwgYWNjb3VudE5hbWUpLFxuXHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2FsbG93JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQWxsb3dcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiBTZXNzaW9uUHJvbXB0Q2hvaWNlLkFsbG93XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKHsga2V5OiAnZGVueScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkRlbnlcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiBTZXNzaW9uUHJvbXB0Q2hvaWNlLkRlbnlcblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHRcdGNhbmNlbEJ1dHRvbjoge1xuXHRcdFx0XHRydW46ICgpID0+IFNlc3Npb25Qcm9tcHRDaG9pY2UuQ2FuY2VsXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAocmVzdWx0ICE9PSBTZXNzaW9uUHJvbXB0Q2hvaWNlLkNhbmNlbCkge1xuXHRcdFx0dGhpcy5fYXV0aGVudGljYXRpb25BY2Nlc3NTZXJ2aWNlLnVwZGF0ZUFsbG93ZWRFeHRlbnNpb25zKHByb3ZpZGVyLmlkLCBhY2NvdW50TmFtZSwgW3sgaWQ6IGV4dGVuc2lvbklkLCBuYW1lOiBleHRlbnNpb25OYW1lLCBhbGxvd2VkOiByZXN1bHQgPT09IFNlc3Npb25Qcm9tcHRDaG9pY2UuQWxsb3cgfV0pO1xuXHRcdFx0dGhpcy5yZW1vdmVBY2Nlc3NSZXF1ZXN0KHByb3ZpZGVyLmlkLCBleHRlbnNpb25JZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdCA9PT0gU2Vzc2lvblByb21wdENob2ljZS5BbGxvdztcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSB1c2VkIG9ubHkgd2hlbiB0aGVyZSBhcmUgc2Vzc2lvbnMgdG8gZGlzYW1iaWd1YXRlLlxuXHQgKi9cblx0YXN5bmMgc2VsZWN0U2Vzc2lvbihwcm92aWRlcklkOiBzdHJpbmcsIGV4dGVuc2lvbklkOiBzdHJpbmcsIGV4dGVuc2lvbk5hbWU6IHN0cmluZywgc2NvcGVzOiBzdHJpbmdbXSwgYXZhaWxhYmxlU2Vzc2lvbnM6IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbltdKTogUHJvbWlzZTxBdXRoZW50aWNhdGlvblNlc3Npb24+IHtcblx0XHRjb25zdCBhbGxBY2NvdW50cyA9IGF3YWl0IHRoaXMuX2F1dGhlbnRpY2F0aW9uU2VydmljZS5nZXRBY2NvdW50cyhwcm92aWRlcklkKTtcblx0XHRpZiAoIWFsbEFjY291bnRzLmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdObyBhY2NvdW50cyBhdmFpbGFibGUnKTtcblx0XHR9XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcXVpY2tQaWNrID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMucXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPHsgbGFiZWw6IHN0cmluZzsgc2Vzc2lvbj86IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbjsgYWNjb3VudD86IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbkFjY291bnQgfT4oKSk7XG5cdFx0cXVpY2tQaWNrLmlnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRjb25zdCBhY2NvdW50c1dpdGhTZXNzaW9ucyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdGNvbnN0IGl0ZW1zOiB7IGxhYmVsOiBzdHJpbmc7IHNlc3Npb24/OiBBdXRoZW50aWNhdGlvblNlc3Npb247IGFjY291bnQ/OiBBdXRoZW50aWNhdGlvblNlc3Npb25BY2NvdW50IH1bXSA9IGF2YWlsYWJsZVNlc3Npb25zXG5cdFx0XHQvLyBPbmx5IGdyYWIgdGhlIGZpcnN0IGFjY291bnRcblx0XHRcdC5maWx0ZXIoc2Vzc2lvbiA9PiAhYWNjb3VudHNXaXRoU2Vzc2lvbnMuaGFzKHNlc3Npb24uYWNjb3VudC5sYWJlbCkgJiYgYWNjb3VudHNXaXRoU2Vzc2lvbnMuYWRkKHNlc3Npb24uYWNjb3VudC5sYWJlbCkpXG5cdFx0XHQubWFwKHNlc3Npb24gPT4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGxhYmVsOiBzZXNzaW9uLmFjY291bnQubGFiZWwsXG5cdFx0XHRcdFx0c2Vzc2lvbjogc2Vzc2lvblxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cblx0XHQvLyBBZGQgdGhlIGFkZGl0aW9uYWwgYWNjb3VudHMgdGhhdCBoYXZlIGJlZW4gbG9nZ2VkIGludG8gdGhlIHByb3ZpZGVyIGJ1dCBhcmVcblx0XHQvLyBkb24ndCBoYXZlIGEgc2Vzc2lvbiB5ZXQuXG5cdFx0YWxsQWNjb3VudHMuZm9yRWFjaChhY2NvdW50ID0+IHtcblx0XHRcdGlmICghYWNjb3VudHNXaXRoU2Vzc2lvbnMuaGFzKGFjY291bnQubGFiZWwpKSB7XG5cdFx0XHRcdGl0ZW1zLnB1c2goeyBsYWJlbDogYWNjb3VudC5sYWJlbCwgYWNjb3VudCB9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpdGVtcy5wdXNoKHsgbGFiZWw6IG5scy5sb2NhbGl6ZSgndXNlT3RoZXJBY2NvdW50JywgXCJTaWduIGluIHRvIGFub3RoZXIgYWNjb3VudFwiKSB9KTtcblx0XHRxdWlja1BpY2suaXRlbXMgPSBpdGVtcztcblx0XHRxdWlja1BpY2sudGl0bGUgPSBubHMubG9jYWxpemUoXG5cdFx0XHR7XG5cdFx0XHRcdGtleTogJ3NlbGVjdEFjY291bnQnLFxuXHRcdFx0XHRjb21tZW50OiBbJ1RoZSBwbGFjZWhvbGRlciB7MH0gaXMgdGhlIG5hbWUgb2YgYW4gZXh0ZW5zaW9uLiB7MX0gaXMgdGhlIG5hbWUgb2YgdGhlIHR5cGUgb2YgYWNjb3VudCwgc3VjaCBhcyBNaWNyb3NvZnQgb3IgR2l0SHViLiddXG5cdFx0XHR9LFxuXHRcdFx0XCJUaGUgZXh0ZW5zaW9uICd7MH0nIHdhbnRzIHRvIGFjY2VzcyBhIHsxfSBhY2NvdW50XCIsXG5cdFx0XHRleHRlbnNpb25OYW1lLFxuXHRcdFx0dGhpcy5fYXV0aGVudGljYXRpb25TZXJ2aWNlLmdldFByb3ZpZGVyKHByb3ZpZGVySWQpLmxhYmVsXG5cdFx0KTtcblx0XHRxdWlja1BpY2sucGxhY2Vob2xkZXIgPSBubHMubG9jYWxpemUoJ2dldFNlc3Npb25QbGF0ZWhvbGRlcicsIFwiU2VsZWN0IGFuIGFjY291bnQgZm9yICd7MH0nIHRvIHVzZSBvciBFc2MgdG8gY2FuY2VsXCIsIGV4dGVuc2lvbk5hbWUpO1xuXG5cdFx0cmV0dXJuIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRBY2NlcHQoYXN5bmMgXyA9PiB7XG5cdFx0XHRcdHF1aWNrUGljay5kaXNwb3NlKCk7XG5cdFx0XHRcdGxldCBzZXNzaW9uID0gcXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF0uc2Vzc2lvbjtcblx0XHRcdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWNjb3VudCA9IHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zWzBdLmFjY291bnQ7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdHNlc3Npb24gPSBhd2FpdCB0aGlzLl9hdXRoZW50aWNhdGlvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihwcm92aWRlcklkLCBzY29wZXMsIHsgYWNjb3VudCB9KTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRyZWplY3QoZSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGFjY291bnROYW1lID0gc2Vzc2lvbi5hY2NvdW50LmxhYmVsO1xuXG5cdFx0XHRcdHRoaXMuX2F1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZS51cGRhdGVBbGxvd2VkRXh0ZW5zaW9ucyhwcm92aWRlcklkLCBhY2NvdW50TmFtZSwgW3sgaWQ6IGV4dGVuc2lvbklkLCBuYW1lOiBleHRlbnNpb25OYW1lLCBhbGxvd2VkOiB0cnVlIH1dKTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlQWNjb3VudEFuZFNlc3Npb25QcmVmZXJlbmNlcyhwcm92aWRlcklkLCBleHRlbnNpb25JZCwgc2Vzc2lvbik7XG5cdFx0XHRcdHRoaXMucmVtb3ZlQWNjZXNzUmVxdWVzdChwcm92aWRlcklkLCBleHRlbnNpb25JZCk7XG5cblx0XHRcdFx0cmVzb2x2ZShzZXNzaW9uKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEhpZGUoXyA9PiB7XG5cdFx0XHRcdGlmICghcXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF0pIHtcblx0XHRcdFx0XHRyZWplY3QoJ1VzZXIgZGlkIG5vdCBjb25zZW50IHRvIGFjY291bnQgYWNjZXNzJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRxdWlja1BpY2suc2hvdygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjb21wbGV0ZVNlc3Npb25BY2Nlc3NSZXF1ZXN0KHByb3ZpZGVyOiBJQXV0aGVudGljYXRpb25Qcm92aWRlciwgZXh0ZW5zaW9uSWQ6IHN0cmluZywgZXh0ZW5zaW9uTmFtZTogc3RyaW5nLCBzY29wZXM6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXJSZXF1ZXN0cyA9IHRoaXMuX3Nlc3Npb25BY2Nlc3NSZXF1ZXN0SXRlbXMuZ2V0KHByb3ZpZGVyLmlkKSB8fCB7fTtcblx0XHRjb25zdCBleGlzdGluZ1JlcXVlc3QgPSBwcm92aWRlclJlcXVlc3RzW2V4dGVuc2lvbklkXTtcblx0XHRpZiAoIWV4aXN0aW5nUmVxdWVzdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcG9zc2libGVTZXNzaW9ucyA9IGV4aXN0aW5nUmVxdWVzdC5wb3NzaWJsZVNlc3Npb25zO1xuXG5cdFx0bGV0IHNlc3Npb246IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbiB8IHVuZGVmaW5lZDtcblx0XHRpZiAocHJvdmlkZXIuc3VwcG9ydHNNdWx0aXBsZUFjY291bnRzKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzZXNzaW9uID0gYXdhaXQgdGhpcy5zZWxlY3RTZXNzaW9uKHByb3ZpZGVyLmlkLCBleHRlbnNpb25JZCwgZXh0ZW5zaW9uTmFtZSwgc2NvcGVzLCBwb3NzaWJsZVNlc3Npb25zKTtcblx0XHRcdH0gY2F0Y2ggKF8pIHtcblx0XHRcdFx0Ly8gaWdub3JlIGNhbmNlbFxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBhcHByb3ZlZCA9IGF3YWl0IHRoaXMuc2hvd0dldFNlc3Npb25Qcm9tcHQocHJvdmlkZXIsIHBvc3NpYmxlU2Vzc2lvbnNbMF0uYWNjb3VudC5sYWJlbCwgZXh0ZW5zaW9uSWQsIGV4dGVuc2lvbk5hbWUpO1xuXHRcdFx0aWYgKGFwcHJvdmVkKSB7XG5cdFx0XHRcdHNlc3Npb24gPSBwb3NzaWJsZVNlc3Npb25zWzBdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHR0aGlzLl9hdXRoZW50aWNhdGlvblVzYWdlU2VydmljZS5hZGRBY2NvdW50VXNhZ2UocHJvdmlkZXIuaWQsIHNlc3Npb24uYWNjb3VudC5sYWJlbCwgc2Vzc2lvbi5zY29wZXMsIGV4dGVuc2lvbklkLCBleHRlbnNpb25OYW1lKTtcblx0XHR9XG5cdH1cblxuXHRyZXF1ZXN0U2Vzc2lvbkFjY2Vzcyhwcm92aWRlcklkOiBzdHJpbmcsIGV4dGVuc2lvbklkOiBzdHJpbmcsIGV4dGVuc2lvbk5hbWU6IHN0cmluZywgc2NvcGVzOiBzdHJpbmdbXSwgcG9zc2libGVTZXNzaW9uczogQXV0aGVudGljYXRpb25TZXNzaW9uW10pOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlclJlcXVlc3RzID0gdGhpcy5fc2Vzc2lvbkFjY2Vzc1JlcXVlc3RJdGVtcy5nZXQocHJvdmlkZXJJZCkgfHwge307XG5cdFx0Y29uc3QgaGFzRXhpc3RpbmdSZXF1ZXN0ID0gcHJvdmlkZXJSZXF1ZXN0c1tleHRlbnNpb25JZF07XG5cdFx0aWYgKGhhc0V4aXN0aW5nUmVxdWVzdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fYXV0aGVudGljYXRpb25TZXJ2aWNlLmdldFByb3ZpZGVyKHByb3ZpZGVySWQpO1xuXHRcdGNvbnN0IG1lbnVJdGVtID0gTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5BY2NvdW50c0NvbnRleHQsIHtcblx0XHRcdGdyb3VwOiAnM19hY2Nlc3NSZXF1ZXN0cycsXG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiBgJHtwcm92aWRlcklkfSR7ZXh0ZW5zaW9uSWR9QWNjZXNzYCxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdFx0a2V5OiAnYWNjZXNzUmVxdWVzdCcsXG5cdFx0XHRcdFx0Y29tbWVudDogW2BUaGUgcGxhY2Vob2xkZXIgezB9IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBhbiBhdXRoZW50aWNhdGlvbiBwcm92aWRlcicncyBsYWJlbC4gezF9IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBhbiBleHRlbnNpb24gbmFtZS4gKDEpIGlzIHRvIGluZGljYXRlIHRoYXQgdGhpcyBtZW51IGl0ZW0gY29udHJpYnV0ZXMgdG8gYSBiYWRnZSBjb3VudGBdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFx0XCJHcmFudCBhY2Nlc3MgdG8gezB9IGZvciB7MX0uLi4gKDEpXCIsXG5cdFx0XHRcdFx0cHJvdmlkZXIubGFiZWwsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uTmFtZSlcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGFjY2Vzc0NvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdFx0XHRpZDogYCR7cHJvdmlkZXJJZH0ke2V4dGVuc2lvbklkfUFjY2Vzc2AsXG5cdFx0XHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IpID0+IHtcblx0XHRcdFx0dGhpcy5jb21wbGV0ZVNlc3Npb25BY2Nlc3NSZXF1ZXN0KHByb3ZpZGVyLCBleHRlbnNpb25JZCwgZXh0ZW5zaW9uTmFtZSwgc2NvcGVzKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHByb3ZpZGVyUmVxdWVzdHNbZXh0ZW5zaW9uSWRdID0geyBwb3NzaWJsZVNlc3Npb25zLCBkaXNwb3NhYmxlczogW21lbnVJdGVtLCBhY2Nlc3NDb21tYW5kXSB9O1xuXHRcdHRoaXMuX3Nlc3Npb25BY2Nlc3NSZXF1ZXN0SXRlbXMuc2V0KHByb3ZpZGVySWQsIHByb3ZpZGVyUmVxdWVzdHMpO1xuXHRcdHRoaXMudXBkYXRlQmFkZ2VDb3VudCgpO1xuXHR9XG5cblx0YXN5bmMgcmVxdWVzdE5ld1Nlc3Npb24ocHJvdmlkZXJJZDogc3RyaW5nLCBzY29wZXM6IHN0cmluZ1tdLCBleHRlbnNpb25JZDogc3RyaW5nLCBleHRlbnNpb25OYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX2F1dGhlbnRpY2F0aW9uU2VydmljZS5pc0F1dGhlbnRpY2F0aW9uUHJvdmlkZXJSZWdpc3RlcmVkKHByb3ZpZGVySWQpKSB7XG5cdFx0XHQvLyBBY3RpdmF0ZSBoYXMgYWxyZWFkeSBiZWVuIGNhbGxlZCBmb3IgdGhlIGF1dGhlbnRpY2F0aW9uIHByb3ZpZGVyLCBidXQgaXQgY2Fubm90IGJsb2NrIG9uIHJlZ2lzdGVyaW5nIGl0c2VsZlxuXHRcdFx0Ly8gc2luY2UgdGhpcyBpcyBzeW5jIGFuZCByZXR1cm5zIGEgZGlzcG9zYWJsZS4gU28sIHdhaXQgZm9yIHJlZ2lzdHJhdGlvbiBldmVudCB0byBmaXJlIHRoYXQgaW5kaWNhdGVzIHRoZVxuXHRcdFx0Ly8gcHJvdmlkZXIgaXMgbm93IGluIHRoZSBtYXAuXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgXykgPT4ge1xuXHRcdFx0XHRjb25zdCBkaXNwb3NlID0gdGhpcy5fYXV0aGVudGljYXRpb25TZXJ2aWNlLm9uRGlkUmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKGUgPT4ge1xuXHRcdFx0XHRcdGlmIChlLmlkID09PSBwcm92aWRlcklkKSB7XG5cdFx0XHRcdFx0XHRkaXNwb3NlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0bGV0IHByb3ZpZGVyOiBJQXV0aGVudGljYXRpb25Qcm92aWRlcjtcblx0XHR0cnkge1xuXHRcdFx0cHJvdmlkZXIgPSB0aGlzLl9hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0UHJvdmlkZXIocHJvdmlkZXJJZCk7XG5cdFx0fSBjYXRjaCAoX2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcm92aWRlclJlcXVlc3RzID0gdGhpcy5fc2lnbkluUmVxdWVzdEl0ZW1zLmdldChwcm92aWRlcklkKTtcblx0XHRjb25zdCBzY29wZXNMaXN0ID0gc2NvcGVzLmpvaW4oU0NPUEVTTElTVF9TRVBBUkFUT1IpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbkhhc0V4aXN0aW5nUmVxdWVzdCA9IHByb3ZpZGVyUmVxdWVzdHNcblx0XHRcdCYmIHByb3ZpZGVyUmVxdWVzdHNbc2NvcGVzTGlzdF1cblx0XHRcdCYmIHByb3ZpZGVyUmVxdWVzdHNbc2NvcGVzTGlzdF0ucmVxdWVzdGluZ0V4dGVuc2lvbklkcy5pbmNsdWRlcyhleHRlbnNpb25JZCk7XG5cblx0XHRpZiAoZXh0ZW5zaW9uSGFzRXhpc3RpbmdSZXF1ZXN0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gQ29uc3RydWN0IGEgY29tbWFuZElkIHRoYXQgd29uJ3QgY2xhc2ggd2l0aCBvdGhlcnMgZ2VuZXJhdGVkIGhlcmUsIG5vciBsaWtlbHkgd2l0aCBhbiBleHRlbnNpb24ncyBjb21tYW5kXG5cdFx0Y29uc3QgY29tbWFuZElkID0gYCR7cHJvdmlkZXJJZH06JHtleHRlbnNpb25JZH06c2lnbkluJHtPYmplY3Qua2V5cyhwcm92aWRlclJlcXVlc3RzIHx8IFtdKS5sZW5ndGh9YDtcblx0XHRjb25zdCBtZW51SXRlbSA9IE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQWNjb3VudHNDb250ZXh0LCB7XG5cdFx0XHRncm91cDogJzJfc2lnbkluUmVxdWVzdHMnLFxuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRpZDogY29tbWFuZElkLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKHtcblx0XHRcdFx0XHRrZXk6ICdzaWduSW5SZXF1ZXN0Jyxcblx0XHRcdFx0XHRjb21tZW50OiBbYFRoZSBwbGFjZWhvbGRlciB7MH0gd2lsbCBiZSByZXBsYWNlZCB3aXRoIGFuIGF1dGhlbnRpY2F0aW9uIHByb3ZpZGVyJ3MgbGFiZWwuIHsxfSB3aWxsIGJlIHJlcGxhY2VkIHdpdGggYW4gZXh0ZW5zaW9uIG5hbWUuICgxKSBpcyB0byBpbmRpY2F0ZSB0aGF0IHRoaXMgbWVudSBpdGVtIGNvbnRyaWJ1dGVzIHRvIGEgYmFkZ2UgY291bnQuYF1cblx0XHRcdFx0fSxcblx0XHRcdFx0XHRcIlNpZ24gaW4gd2l0aCB7MH0gdG8gdXNlIHsxfSAoMSlcIixcblx0XHRcdFx0XHRwcm92aWRlci5sYWJlbCxcblx0XHRcdFx0XHRleHRlbnNpb25OYW1lKVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgc2lnbkluQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0XHRcdGlkOiBjb21tYW5kSWQsXG5cdFx0XHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IpID0+IHtcblx0XHRcdFx0Y29uc3QgYXV0aGVudGljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElBdXRoZW50aWNhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgYXV0aGVudGljYXRpb25TZXJ2aWNlLmNyZWF0ZVNlc3Npb24ocHJvdmlkZXJJZCwgc2NvcGVzKTtcblxuXHRcdFx0XHR0aGlzLl9hdXRoZW50aWNhdGlvbkFjY2Vzc1NlcnZpY2UudXBkYXRlQWxsb3dlZEV4dGVuc2lvbnMocHJvdmlkZXJJZCwgc2Vzc2lvbi5hY2NvdW50LmxhYmVsLCBbeyBpZDogZXh0ZW5zaW9uSWQsIG5hbWU6IGV4dGVuc2lvbk5hbWUsIGFsbG93ZWQ6IHRydWUgfV0pO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVBY2NvdW50QW5kU2Vzc2lvblByZWZlcmVuY2VzKHByb3ZpZGVySWQsIGV4dGVuc2lvbklkLCBzZXNzaW9uKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXG5cdFx0aWYgKHByb3ZpZGVyUmVxdWVzdHMpIHtcblx0XHRcdGNvbnN0IGV4aXN0aW5nUmVxdWVzdCA9IHByb3ZpZGVyUmVxdWVzdHNbc2NvcGVzTGlzdF0gfHwgeyBkaXNwb3NhYmxlczogW10sIHJlcXVlc3RpbmdFeHRlbnNpb25JZHM6IFtdIH07XG5cblx0XHRcdHByb3ZpZGVyUmVxdWVzdHNbc2NvcGVzTGlzdF0gPSB7XG5cdFx0XHRcdGRpc3Bvc2FibGVzOiBbLi4uZXhpc3RpbmdSZXF1ZXN0LmRpc3Bvc2FibGVzLCBtZW51SXRlbSwgc2lnbkluQ29tbWFuZF0sXG5cdFx0XHRcdHJlcXVlc3RpbmdFeHRlbnNpb25JZHM6IFsuLi5leGlzdGluZ1JlcXVlc3QucmVxdWVzdGluZ0V4dGVuc2lvbklkcywgZXh0ZW5zaW9uSWRdXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fc2lnbkluUmVxdWVzdEl0ZW1zLnNldChwcm92aWRlcklkLCBwcm92aWRlclJlcXVlc3RzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2lnbkluUmVxdWVzdEl0ZW1zLnNldChwcm92aWRlcklkLCB7XG5cdFx0XHRcdFtzY29wZXNMaXN0XToge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzOiBbbWVudUl0ZW0sIHNpZ25JbkNvbW1hbmRdLFxuXHRcdFx0XHRcdHJlcXVlc3RpbmdFeHRlbnNpb25JZHM6IFtleHRlbnNpb25JZF1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVCYWRnZUNvdW50KCk7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UsIEF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVksaUJBQWlCLFNBQXNCLHlCQUF5QjtBQUNyRixZQUFZLFNBQVM7QUFDckIsU0FBUyxRQUFRLG9CQUFvQjtBQUNyQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxrQkFBa0IsbUJBQW1CO0FBQzlDLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQXlELHdCQUF3Qix3Q0FBc0U7QUFDdkosU0FBUyxlQUFlO0FBQ3hCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBR3BDLE1BQU0sdUJBQXVCO0FBWXRCLElBQU0sa0NBQU4sY0FBOEMsV0FBdUQ7QUFBQSxFQVkzRyxZQUNvQyxpQkFDRCxnQkFDRCxlQUNJLG1CQUNILGlCQUNPLHdCQUNLLDZCQUNDLDhCQUM5QztBQUNELFVBQU07QUFUNkI7QUFDRDtBQUNEO0FBQ0k7QUFDSDtBQUNPO0FBQ0s7QUFDQztBQWxCaEQsU0FBUSxzQkFBc0Isb0JBQUksSUFBZ0M7QUFDbEUsU0FBUSw2QkFBNkIsb0JBQUksSUFBa0g7QUFDM0osU0FBaUIsMEJBQTBCLEtBQUssVUFBVSxJQUFJ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
