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
import { localize, localize2 } from "../../../../nls.js";
import { combinedDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { IHostService } from "../../host/browser/host.js";
import { ActivationKind, IExtensionService } from "../common/extensions.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { disposableWindowInterval } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
const FIVE_MINUTES = 5 * 60 * 1e3;
const THIRTY_SECONDS = 30 * 1e3;
const URL_TO_HANDLE = "extensionUrlHandler.urlToHandle";
const USER_TRUSTED_EXTENSIONS_CONFIGURATION_KEY = "extensions.confirmedUriHandlerExtensionIds";
const USER_TRUSTED_EXTENSIONS_STORAGE_KEY = "extensionUrlHandler.confirmedExtensions";
function isExtensionId(value) {
  return /^[a-z0-9][a-z0-9\-]*\.[a-z0-9][a-z0-9\-]*$/i.test(value);
}
class UserTrustedExtensionIdStorage {
  constructor(storageService) {
    this.storageService = storageService;
  }
  get extensions() {
    const userTrustedExtensionIdsJson = this.storageService.get(USER_TRUSTED_EXTENSIONS_STORAGE_KEY, StorageScope.PROFILE, "[]");
    try {
      return JSON.parse(userTrustedExtensionIdsJson);
    } catch {
      return [];
    }
  }
  has(id) {
    return this.extensions.indexOf(id) > -1;
  }
  add(id) {
    this.set([...this.extensions, id]);
  }
  set(ids) {
    this.storageService.store(USER_TRUSTED_EXTENSIONS_STORAGE_KEY, JSON.stringify(ids), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
}
const IExtensionUrlHandler = createDecorator("extensionUrlHandler");
class ExtensionUrlHandlerOverrideRegistry {
  static registerHandler(handler) {
    this.handlers.add(handler);
    return toDisposable(() => this.handlers.delete(handler));
  }
  static getHandler(uri) {
    for (const handler of this.handlers) {
      if (handler.canHandleURL(uri)) {
        return handler;
      }
    }
    return void 0;
  }
}
ExtensionUrlHandlerOverrideRegistry.handlers = /* @__PURE__ */ new Set();
let ExtensionUrlHandler = class {
  constructor(urlService, extensionService, dialogService, commandService, hostService, storageService, configurationService, notificationService, productService) {
    this.extensionService = extensionService;
    this.dialogService = dialogService;
    this.commandService = commandService;
    this.hostService = hostService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.productService = productService;
    this.extensionHandlers = /* @__PURE__ */ new Map();
    this.uriBuffer = /* @__PURE__ */ new Map();
    this.userTrustedExtensionsStorage = new UserTrustedExtensionIdStorage(storageService);
    const interval = disposableWindowInterval(mainWindow, () => this.garbageCollect(), THIRTY_SECONDS);
    const urlToHandleValue = this.storageService.get(URL_TO_HANDLE, StorageScope.WORKSPACE);
    if (urlToHandleValue) {
      this.storageService.remove(URL_TO_HANDLE, StorageScope.WORKSPACE);
      this.handleURL(URI.revive(JSON.parse(urlToHandleValue)), { trusted: true });
    }
    this.disposable = combinedDisposable(
      urlService.registerHandler(this),
      interval
    );
    const cache = ExtensionUrlBootstrapHandler.cache;
    setTimeout(() => cache.forEach(([uri, option]) => this.handleURL(uri, option)));
  }
  async handleURL(uri, options) {
    if (!isExtensionId(uri.authority)) {
      return false;
    }
    const overrideHandler = ExtensionUrlHandlerOverrideRegistry.getHandler(uri);
    if (overrideHandler) {
      const handled = await overrideHandler.handleURL(uri);
      if (handled) {
        return handled;
      }
    }
    const extensionId = uri.authority;
    const initialHandler = this.extensionHandlers.get(ExtensionIdentifier.toKey(extensionId));
    let extensionDisplayName;
    if (!initialHandler) {
      const extension = await this.extensionService.getExtension(extensionId);
      if (!extension) {
        await this.handleUnhandledURL(uri, extensionId, options);
        return true;
      } else {
        extensionDisplayName = extension.displayName ?? "";
      }
    } else {
      extensionDisplayName = initialHandler.extensionDisplayName;
    }
    const trusted = options?.trusted || this.productService.trustedExtensionProtocolHandlers?.includes(extensionId) || this.didUserTrustExtension(ExtensionIdentifier.toKey(extensionId));
    if (!trusted) {
      const uriString = uri.toString(false);
      let uriLabel = uriString;
      if (uriLabel.length > 40) {
        uriLabel = `${uriLabel.substring(0, 30)}...${uriLabel.substring(uriLabel.length - 5)}`;
      }
      const result = await this.dialogService.confirm({
        message: localize("confirmUrl", "Allow '{0}' extension to open this URI?", extensionDisplayName),
        checkbox: {
          label: localize("rememberConfirmUrl", "Do not ask me again for this extension")
        },
        primaryButton: localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Open"),
        custom: {
          markdownDetails: [{
            markdown: new MarkdownString(`<div title="${uriString}" aria-label='${uriString}'>${uriLabel}</div>`, { supportHtml: true })
          }]
        }
      });
      if (!result.confirmed) {
        return true;
      }
      if (result.checkboxChecked) {
        this.userTrustedExtensionsStorage.add(ExtensionIdentifier.toKey(extensionId));
      }
    }
    const handler = this.extensionHandlers.get(ExtensionIdentifier.toKey(extensionId));
    if (handler) {
      if (!initialHandler) {
        return await this.handleURLByExtension(extensionId, handler, uri, options);
      }
      return false;
    }
    const timestamp = (/* @__PURE__ */ new Date()).getTime();
    let uris = this.uriBuffer.get(ExtensionIdentifier.toKey(extensionId));
    if (!uris) {
      uris = [];
      this.uriBuffer.set(ExtensionIdentifier.toKey(extensionId), uris);
    }
    uris.push({ timestamp, uri });
    await this.extensionService.activateByEvent(`onUri:${ExtensionIdentifier.toKey(extensionId)}`, ActivationKind.Immediate);
    return true;
  }
  registerExtensionHandler(extensionId, handler) {
    this.extensionHandlers.set(ExtensionIdentifier.toKey(extensionId), handler);
    const uris = this.uriBuffer.get(ExtensionIdentifier.toKey(extensionId)) || [];
    for (const { uri } of uris) {
      this.handleURLByExtension(extensionId, handler, uri);
    }
    this.uriBuffer.delete(ExtensionIdentifier.toKey(extensionId));
  }
  unregisterExtensionHandler(extensionId) {
    this.extensionHandlers.delete(ExtensionIdentifier.toKey(extensionId));
  }
  async handleURLByExtension(extensionId, handler, uri, options) {
    return await handler.handleURL(uri, options);
  }
  async handleUnhandledURL(uri, extensionId, options) {
    try {
      await this.commandService.executeCommand("workbench.extensions.installExtension", extensionId, {
        justification: {
          reason: `${localize("installDetail", "This extension wants to open a URI:")}
${uri.toString()}`,
          action: localize("openUri", "Open URI")
        },
        enable: true
      });
    } catch (error) {
      if (!isCancellationError(error)) {
        this.notificationService.error(error);
      }
      return;
    }
    const extension = await this.extensionService.getExtension(extensionId);
    if (extension) {
      await this.handleURL(uri, { ...options, trusted: true });
    } else {
      const result = await this.dialogService.confirm({
        message: localize("reloadAndHandle", "Extension '{0}' is not loaded. Would you like to reload the window to load the extension and open the URL?", extensionId),
        primaryButton: localize({ key: "reloadAndOpen", comment: ["&& denotes a mnemonic"] }, "&&Reload Window and Open")
      });
      if (!result.confirmed) {
        return;
      }
      this.storageService.store(URL_TO_HANDLE, JSON.stringify(uri.toJSON()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
      await this.hostService.reload();
    }
  }
  // forget about all uris buffered more than 5 minutes ago
  garbageCollect() {
    const now = (/* @__PURE__ */ new Date()).getTime();
    const uriBuffer = /* @__PURE__ */ new Map();
    this.uriBuffer.forEach((uris, extensionId) => {
      uris = uris.filter(({ timestamp }) => now - timestamp < FIVE_MINUTES);
      if (uris.length > 0) {
        uriBuffer.set(extensionId, uris);
      }
    });
    this.uriBuffer = uriBuffer;
  }
  didUserTrustExtension(id) {
    if (this.userTrustedExtensionsStorage.has(id)) {
      return true;
    }
    return this.getConfirmedTrustedExtensionIdsFromConfiguration().indexOf(id) > -1;
  }
  getConfirmedTrustedExtensionIdsFromConfiguration() {
    const trustedExtensionIds = this.configurationService.getValue(USER_TRUSTED_EXTENSIONS_CONFIGURATION_KEY);
    if (!Array.isArray(trustedExtensionIds)) {
      return [];
    }
    return trustedExtensionIds;
  }
  dispose() {
    this.disposable.dispose();
    this.extensionHandlers.clear();
    this.uriBuffer.clear();
  }
};
ExtensionUrlHandler = __decorateClass([
  __decorateParam(0, IURLService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IProductService)
], ExtensionUrlHandler);
registerSingleton(IExtensionUrlHandler, ExtensionUrlHandler, InstantiationType.Eager);
let ExtensionUrlBootstrapHandler = class {
  static get cache() {
    ExtensionUrlBootstrapHandler.disposable.dispose();
    const result = ExtensionUrlBootstrapHandler._cache;
    ExtensionUrlBootstrapHandler._cache = [];
    return result;
  }
  constructor(urlService) {
    ExtensionUrlBootstrapHandler.disposable = urlService.registerHandler(this);
  }
  async handleURL(uri, options) {
    if (!isExtensionId(uri.authority)) {
      return false;
    }
    ExtensionUrlBootstrapHandler._cache.push([uri, options]);
    return true;
  }
};
ExtensionUrlBootstrapHandler.ID = "workbench.contrib.extensionUrlBootstrapHandler";
ExtensionUrlBootstrapHandler._cache = [];
ExtensionUrlBootstrapHandler = __decorateClass([
  __decorateParam(0, IURLService)
], ExtensionUrlBootstrapHandler);
registerWorkbenchContribution2(
  ExtensionUrlBootstrapHandler.ID,
  ExtensionUrlBootstrapHandler,
  WorkbenchPhase.BlockRestore
  /* registration only */
);
class ManageAuthorizedExtensionURIsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.extensions.action.manageAuthorizedExtensionURIs",
      title: localize2("manage", "Manage Authorized Extension URIs..."),
      category: localize2("extensions", "Extensions"),
      menu: {
        id: MenuId.CommandPalette,
        when: IsWebContext.toNegated()
      }
    });
  }
  async run(accessor) {
    const storageService = accessor.get(IStorageService);
    const quickInputService = accessor.get(IQuickInputService);
    const storage = new UserTrustedExtensionIdStorage(storageService);
    const items = storage.extensions.map((label) => ({ label, picked: true }));
    if (items.length === 0) {
      await quickInputService.pick([{ label: localize("no", "There are currently no authorized extension URIs.") }]);
      return;
    }
    const result = await quickInputService.pick(items, { canPickMany: true });
    if (!result) {
      return;
    }
    storage.set(result.map((item) => item.label));
  }
}
registerAction2(ManageAuthorizedExtensionURIsAction);
export {
  ExtensionUrlHandlerOverrideRegistry,
  IExtensionUrlHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9icm93c2VyL2V4dGVuc2lvblVybEhhbmRsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBjb21iaW5lZERpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVVSTEhhbmRsZXIsIElVUkxTZXJ2aWNlLCBJT3BlblVSTE9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmwvY29tbW9uL3VybC5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBBY3RpdmF0aW9uS2luZCwgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSXNXZWJDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZGlzcG9zYWJsZVdpbmRvd0ludGVydmFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuXG5jb25zdCBGSVZFX01JTlVURVMgPSA1ICogNjAgKiAxMDAwO1xuY29uc3QgVEhJUlRZX1NFQ09ORFMgPSAzMCAqIDEwMDA7XG5jb25zdCBVUkxfVE9fSEFORExFID0gJ2V4dGVuc2lvblVybEhhbmRsZXIudXJsVG9IYW5kbGUnO1xuY29uc3QgVVNFUl9UUlVTVEVEX0VYVEVOU0lPTlNfQ09ORklHVVJBVElPTl9LRVkgPSAnZXh0ZW5zaW9ucy5jb25maXJtZWRVcmlIYW5kbGVyRXh0ZW5zaW9uSWRzJztcbmNvbnN0IFVTRVJfVFJVU1RFRF9FWFRFTlNJT05TX1NUT1JBR0VfS0VZID0gJ2V4dGVuc2lvblVybEhhbmRsZXIuY29uZmlybWVkRXh0ZW5zaW9ucyc7XG5cbmZ1bmN0aW9uIGlzRXh0ZW5zaW9uSWQodmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gL15bYS16MC05XVthLXowLTlcXC1dKlxcLlthLXowLTldW2EtejAtOVxcLV0qJC9pLnRlc3QodmFsdWUpO1xufVxuXG5jbGFzcyBVc2VyVHJ1c3RlZEV4dGVuc2lvbklkU3RvcmFnZSB7XG5cblx0Z2V0IGV4dGVuc2lvbnMoKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHVzZXJUcnVzdGVkRXh0ZW5zaW9uSWRzSnNvbiA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KFVTRVJfVFJVU1RFRF9FWFRFTlNJT05TX1NUT1JBR0VfS0VZLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgJ1tdJyk7XG5cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIEpTT04ucGFyc2UodXNlclRydXN0ZWRFeHRlbnNpb25JZHNKc29uKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpIHsgfVxuXG5cdGhhcyhpZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9ucy5pbmRleE9mKGlkKSA+IC0xO1xuXHR9XG5cblx0YWRkKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnNldChbLi4udGhpcy5leHRlbnNpb25zLCBpZF0pO1xuXHR9XG5cblx0c2V0KGlkczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFVTRVJfVFJVU1RFRF9FWFRFTlNJT05TX1NUT1JBR0VfS0VZLCBKU09OLnN0cmluZ2lmeShpZHMpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgSUV4dGVuc2lvblVybEhhbmRsZXIgPSBjcmVhdGVEZWNvcmF0b3I8SUV4dGVuc2lvblVybEhhbmRsZXI+KCdleHRlbnNpb25VcmxIYW5kbGVyJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dGVuc2lvbkNvbnRyaWJ1dGVkVVJMSGFuZGxlciBleHRlbmRzIElVUkxIYW5kbGVyIHtcblx0ZXh0ZW5zaW9uRGlzcGxheU5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRXh0ZW5zaW9uVXJsSGFuZGxlciB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cmVnaXN0ZXJFeHRlbnNpb25IYW5kbGVyKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCBoYW5kbGVyOiBJRXh0ZW5zaW9uQ29udHJpYnV0ZWRVUkxIYW5kbGVyKTogdm9pZDtcblx0dW5yZWdpc3RlckV4dGVuc2lvbkhhbmRsZXIoZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIpOiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRlbnNpb25VcmxIYW5kbGVyT3ZlcnJpZGUge1xuXHRjYW5IYW5kbGVVUkwodXJpOiBVUkkpOiBib29sZWFuO1xuXHRoYW5kbGVVUkwodXJpOiBVUkkpOiBQcm9taXNlPGJvb2xlYW4+O1xufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uVXJsSGFuZGxlck92ZXJyaWRlUmVnaXN0cnkge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGhhbmRsZXJzID0gbmV3IFNldDxJRXh0ZW5zaW9uVXJsSGFuZGxlck92ZXJyaWRlPigpO1xuXG5cdHN0YXRpYyByZWdpc3RlckhhbmRsZXIoaGFuZGxlcjogSUV4dGVuc2lvblVybEhhbmRsZXJPdmVycmlkZSk6IElEaXNwb3NhYmxlIHtcblx0XHR0aGlzLmhhbmRsZXJzLmFkZChoYW5kbGVyKTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5oYW5kbGVycy5kZWxldGUoaGFuZGxlcikpO1xuXHR9XG5cblx0c3RhdGljIGdldEhhbmRsZXIodXJpOiBVUkkpOiBJRXh0ZW5zaW9uVXJsSGFuZGxlck92ZXJyaWRlIHwgdW5kZWZpbmVkIHtcblx0XHRmb3IgKGNvbnN0IGhhbmRsZXIgb2YgdGhpcy5oYW5kbGVycykge1xuXHRcdFx0aWYgKGhhbmRsZXIuY2FuSGFuZGxlVVJMKHVyaSkpIHtcblx0XHRcdFx0cmV0dXJuIGhhbmRsZXI7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG4vKipcbiAqIFRoaXMgY2xhc3MgaGFuZGxlcyBVUkxzIHdoaWNoIGFyZSBkaXJlY3RlZCB0b3dhcmRzIGV4dGVuc2lvbnMuXG4gKiBJZiBhIFVSTCBpcyBkaXJlY3RlZCB0b3dhcmRzIGFuIGluYWN0aXZlIGV4dGVuc2lvbiwgaXQgYnVmZmVycyBpdCxcbiAqIGFjdGl2YXRlcyB0aGUgZXh0ZW5zaW9uIGFuZCByZS1vcGVucyB0aGUgVVJMIG9uY2UgdGhlIGV4dGVuc2lvbiByZWdpc3RlcnNcbiAqIGEgVVJMIGhhbmRsZXIuIElmIHRoZSBleHRlbnNpb24gbmV2ZXIgcmVnaXN0ZXJzIGEgVVJMIGhhbmRsZXIsIHRoZSB1cmxzXG4gKiB3aWxsIGV2ZW50dWFsbHkgYmUgZ2FyYmFnZSBjb2xsZWN0ZWQuXG4gKlxuICogSXQgYWxzbyBtYWtlcyBzdXJlIHRoZSB1c2VyIGNvbmZpcm1zIG9wZW5pbmcgVVJMcyBkaXJlY3RlZCB0b3dhcmRzIGV4dGVuc2lvbnMuXG4gKi9cbmNsYXNzIEV4dGVuc2lvblVybEhhbmRsZXIgaW1wbGVtZW50cyBJRXh0ZW5zaW9uVXJsSGFuZGxlciwgSVVSTEhhbmRsZXIge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGV4dGVuc2lvbkhhbmRsZXJzID0gbmV3IE1hcDxzdHJpbmcsIElFeHRlbnNpb25Db250cmlidXRlZFVSTEhhbmRsZXI+KCk7XG5cdHByaXZhdGUgdXJpQnVmZmVyID0gbmV3IE1hcDxzdHJpbmcsIHsgdGltZXN0YW1wOiBudW1iZXI7IHVyaTogVVJJIH1bXT4oKTtcblx0cHJpdmF0ZSB1c2VyVHJ1c3RlZEV4dGVuc2lvbnNTdG9yYWdlOiBVc2VyVHJ1c3RlZEV4dGVuc2lvbklkU3RvcmFnZTtcblx0cHJpdmF0ZSBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVVSTFNlcnZpY2UgdXJsU2VydmljZTogSVVSTFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMudXNlclRydXN0ZWRFeHRlbnNpb25zU3RvcmFnZSA9IG5ldyBVc2VyVHJ1c3RlZEV4dGVuc2lvbklkU3RvcmFnZShzdG9yYWdlU2VydmljZSk7XG5cblx0XHRjb25zdCBpbnRlcnZhbCA9IGRpc3Bvc2FibGVXaW5kb3dJbnRlcnZhbChtYWluV2luZG93LCAoKSA9PiB0aGlzLmdhcmJhZ2VDb2xsZWN0KCksIFRISVJUWV9TRUNPTkRTKTtcblx0XHRjb25zdCB1cmxUb0hhbmRsZVZhbHVlID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoVVJMX1RPX0hBTkRMRSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0aWYgKHVybFRvSGFuZGxlVmFsdWUpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKFVSTF9UT19IQU5ETEUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdFx0dGhpcy5oYW5kbGVVUkwoVVJJLnJldml2ZShKU09OLnBhcnNlKHVybFRvSGFuZGxlVmFsdWUpKSwgeyB0cnVzdGVkOiB0cnVlIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuZGlzcG9zYWJsZSA9IGNvbWJpbmVkRGlzcG9zYWJsZShcblx0XHRcdHVybFNlcnZpY2UucmVnaXN0ZXJIYW5kbGVyKHRoaXMpLFxuXHRcdFx0aW50ZXJ2YWxcblx0XHQpO1xuXG5cdFx0Y29uc3QgY2FjaGUgPSBFeHRlbnNpb25VcmxCb290c3RyYXBIYW5kbGVyLmNhY2hlO1xuXHRcdHNldFRpbWVvdXQoKCkgPT4gY2FjaGUuZm9yRWFjaCgoW3VyaSwgb3B0aW9uXSkgPT4gdGhpcy5oYW5kbGVVUkwodXJpLCBvcHRpb24pKSk7XG5cdH1cblxuXHRhc3luYyBoYW5kbGVVUkwodXJpOiBVUkksIG9wdGlvbnM/OiBJT3BlblVSTE9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIWlzRXh0ZW5zaW9uSWQodXJpLmF1dGhvcml0eSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBvdmVycmlkZUhhbmRsZXIgPSBFeHRlbnNpb25VcmxIYW5kbGVyT3ZlcnJpZGVSZWdpc3RyeS5nZXRIYW5kbGVyKHVyaSk7XG5cdFx0aWYgKG92ZXJyaWRlSGFuZGxlcikge1xuXHRcdFx0Y29uc3QgaGFuZGxlZCA9IGF3YWl0IG92ZXJyaWRlSGFuZGxlci5oYW5kbGVVUkwodXJpKTtcblx0XHRcdGlmIChoYW5kbGVkKSB7XG5cdFx0XHRcdHJldHVybiBoYW5kbGVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvbklkID0gdXJpLmF1dGhvcml0eTtcblxuXHRcdGNvbnN0IGluaXRpYWxIYW5kbGVyID0gdGhpcy5leHRlbnNpb25IYW5kbGVycy5nZXQoRXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShleHRlbnNpb25JZCkpO1xuXHRcdGxldCBleHRlbnNpb25EaXNwbGF5TmFtZTogc3RyaW5nO1xuXG5cdFx0aWYgKCFpbml0aWFsSGFuZGxlcikge1xuXHRcdFx0Ly8gVGhlIGV4dGVuc2lvbiBpcyBub3QgeWV0IGFjdGl2YXRlZCwgc28gbGV0J3MgY2hlY2sgaWYgaXQgaXMgaW5zdGFsbGVkIGFuZCBlbmFibGVkXG5cdFx0XHRjb25zdCBleHRlbnNpb24gPSBhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZ2V0RXh0ZW5zaW9uKGV4dGVuc2lvbklkKTtcblx0XHRcdGlmICghZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuaGFuZGxlVW5oYW5kbGVkVVJMKHVyaSwgZXh0ZW5zaW9uSWQsIG9wdGlvbnMpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGV4dGVuc2lvbkRpc3BsYXlOYW1lID0gZXh0ZW5zaW9uLmRpc3BsYXlOYW1lID8/ICcnO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRleHRlbnNpb25EaXNwbGF5TmFtZSA9IGluaXRpYWxIYW5kbGVyLmV4dGVuc2lvbkRpc3BsYXlOYW1lO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRydXN0ZWQgPSBvcHRpb25zPy50cnVzdGVkXG5cdFx0XHR8fCB0aGlzLnByb2R1Y3RTZXJ2aWNlLnRydXN0ZWRFeHRlbnNpb25Qcm90b2NvbEhhbmRsZXJzPy5pbmNsdWRlcyhleHRlbnNpb25JZClcblx0XHRcdHx8IHRoaXMuZGlkVXNlclRydXN0RXh0ZW5zaW9uKEV4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZXh0ZW5zaW9uSWQpKTtcblxuXHRcdGlmICghdHJ1c3RlZCkge1xuXHRcdFx0Y29uc3QgdXJpU3RyaW5nID0gdXJpLnRvU3RyaW5nKGZhbHNlKTtcblx0XHRcdGxldCB1cmlMYWJlbCA9IHVyaVN0cmluZztcblxuXHRcdFx0aWYgKHVyaUxhYmVsLmxlbmd0aCA+IDQwKSB7XG5cdFx0XHRcdHVyaUxhYmVsID0gYCR7dXJpTGFiZWwuc3Vic3RyaW5nKDAsIDMwKX0uLi4ke3VyaUxhYmVsLnN1YnN0cmluZyh1cmlMYWJlbC5sZW5ndGggLSA1KX1gO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdjb25maXJtVXJsJywgXCJBbGxvdyAnezB9JyBleHRlbnNpb24gdG8gb3BlbiB0aGlzIFVSST9cIiwgZXh0ZW5zaW9uRGlzcGxheU5hbWUpLFxuXHRcdFx0XHRjaGVja2JveDoge1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncmVtZW1iZXJDb25maXJtVXJsJywgXCJEbyBub3QgYXNrIG1lIGFnYWluIGZvciB0aGlzIGV4dGVuc2lvblwiKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoeyBrZXk6ICdvcGVuJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmT3BlblwiKSxcblx0XHRcdFx0Y3VzdG9tOiB7XG5cdFx0XHRcdFx0bWFya2Rvd25EZXRhaWxzOiBbe1xuXHRcdFx0XHRcdFx0bWFya2Rvd246IG5ldyBNYXJrZG93blN0cmluZyhgPGRpdiB0aXRsZT1cIiR7dXJpU3RyaW5nfVwiIGFyaWEtbGFiZWw9JyR7dXJpU3RyaW5nfSc+JHt1cmlMYWJlbH08L2Rpdj5gLCB7IHN1cHBvcnRIdG1sOiB0cnVlIH0pLFxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXJlc3VsdC5jb25maXJtZWQpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZXN1bHQuY2hlY2tib3hDaGVja2VkKSB7XG5cdFx0XHRcdHRoaXMudXNlclRydXN0ZWRFeHRlbnNpb25zU3RvcmFnZS5hZGQoRXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShleHRlbnNpb25JZCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGhhbmRsZXIgPSB0aGlzLmV4dGVuc2lvbkhhbmRsZXJzLmdldChFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKSk7XG5cblx0XHRpZiAoaGFuZGxlcikge1xuXHRcdFx0aWYgKCFpbml0aWFsSGFuZGxlcikge1xuXHRcdFx0XHQvLyBmb3J3YXJkIGl0IGRpcmVjdGx5XG5cdFx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZVVSTEJ5RXh0ZW5zaW9uKGV4dGVuc2lvbklkLCBoYW5kbGVyLCB1cmksIG9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBsZXQgdGhlIEV4dGVuc2lvblVybEhhbmRsZXIgaW5zdGFuY2UgaGFuZGxlIHRoaXNcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBjb2xsZWN0IFVSSSBmb3IgZXZlbnR1YWwgZXh0ZW5zaW9uIGFjdGl2YXRpb25cblx0XHRjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHRsZXQgdXJpcyA9IHRoaXMudXJpQnVmZmVyLmdldChFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKSk7XG5cblx0XHRpZiAoIXVyaXMpIHtcblx0XHRcdHVyaXMgPSBbXTtcblx0XHRcdHRoaXMudXJpQnVmZmVyLnNldChFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKSwgdXJpcyk7XG5cdFx0fVxuXG5cdFx0dXJpcy5wdXNoKHsgdGltZXN0YW1wLCB1cmkgfSk7XG5cblx0XHQvLyBhY3RpdmF0ZSB0aGUgZXh0ZW5zaW9uIHVzaW5nIEFjdGl2YXRpb25LaW5kLkltbWVkaWF0ZSBiZWNhdXNlIFVSSSBoYW5kbGluZyBtaWdodCBiZSBwYXJ0XG5cdFx0Ly8gb2YgcmVzb2x2aW5nIGF1dGhvcml0aWVzICh2aWEgYXV0aGVudGljYXRpb24gZXh0ZW5zaW9ucylcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGVCeUV2ZW50KGBvblVyaToke0V4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZXh0ZW5zaW9uSWQpfWAsIEFjdGl2YXRpb25LaW5kLkltbWVkaWF0ZSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRyZWdpc3RlckV4dGVuc2lvbkhhbmRsZXIoZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGhhbmRsZXI6IElFeHRlbnNpb25Db250cmlidXRlZFVSTEhhbmRsZXIpOiB2b2lkIHtcblx0XHR0aGlzLmV4dGVuc2lvbkhhbmRsZXJzLnNldChFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKSwgaGFuZGxlcik7XG5cblx0XHRjb25zdCB1cmlzID0gdGhpcy51cmlCdWZmZXIuZ2V0KEV4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZXh0ZW5zaW9uSWQpKSB8fCBbXTtcblxuXHRcdGZvciAoY29uc3QgeyB1cmkgfSBvZiB1cmlzKSB7XG5cdFx0XHR0aGlzLmhhbmRsZVVSTEJ5RXh0ZW5zaW9uKGV4dGVuc2lvbklkLCBoYW5kbGVyLCB1cmkpO1xuXHRcdH1cblxuXHRcdHRoaXMudXJpQnVmZmVyLmRlbGV0ZShFeHRlbnNpb25JZGVudGlmaWVyLnRvS2V5KGV4dGVuc2lvbklkKSk7XG5cdH1cblxuXHR1bnJlZ2lzdGVyRXh0ZW5zaW9uSGFuZGxlcihleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcik6IHZvaWQge1xuXHRcdHRoaXMuZXh0ZW5zaW9uSGFuZGxlcnMuZGVsZXRlKEV4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZXh0ZW5zaW9uSWQpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlVVJMQnlFeHRlbnNpb24oZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIgfCBzdHJpbmcsIGhhbmRsZXI6IElVUkxIYW5kbGVyLCB1cmk6IFVSSSwgb3B0aW9ucz86IElPcGVuVVJMT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiBhd2FpdCBoYW5kbGVyLmhhbmRsZVVSTCh1cmksIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVVbmhhbmRsZWRVUkwodXJpOiBVUkksIGV4dGVuc2lvbklkOiBzdHJpbmcsIG9wdGlvbnM/OiBJT3BlblVSTE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmV4dGVuc2lvbnMuaW5zdGFsbEV4dGVuc2lvbicsIGV4dGVuc2lvbklkLCB7XG5cdFx0XHRcdGp1c3RpZmljYXRpb246IHtcblx0XHRcdFx0XHRyZWFzb246IGAke2xvY2FsaXplKCdpbnN0YWxsRGV0YWlsJywgXCJUaGlzIGV4dGVuc2lvbiB3YW50cyB0byBvcGVuIGEgVVJJOlwiKX1cXG4ke3VyaS50b1N0cmluZygpfWAsXG5cdFx0XHRcdFx0YWN0aW9uOiBsb2NhbGl6ZSgnb3BlblVyaScsIFwiT3BlbiBVUklcIilcblx0XHRcdFx0fSxcblx0XHRcdFx0ZW5hYmxlOiB0cnVlXG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKCFpc0NhbmNlbGxhdGlvbkVycm9yKGVycm9yKSkge1xuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvbiA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5nZXRFeHRlbnNpb24oZXh0ZW5zaW9uSWQpO1xuXG5cdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0YXdhaXQgdGhpcy5oYW5kbGVVUkwodXJpLCB7IC4uLm9wdGlvbnMsIHRydXN0ZWQ6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0LyogRXh0ZW5zaW9uIGNhbm5vdCBiZSBhZGRlZCBhbmQgcmVxdWlyZSB3aW5kb3cgcmVsb2FkICovXG5cdFx0ZWxzZSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdyZWxvYWRBbmRIYW5kbGUnLCBcIkV4dGVuc2lvbiAnezB9JyBpcyBub3QgbG9hZGVkLiBXb3VsZCB5b3UgbGlrZSB0byByZWxvYWQgdGhlIHdpbmRvdyB0byBsb2FkIHRoZSBleHRlbnNpb24gYW5kIG9wZW4gdGhlIFVSTD9cIiwgZXh0ZW5zaW9uSWQpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSh7IGtleTogJ3JlbG9hZEFuZE9wZW4nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZWxvYWQgV2luZG93IGFuZCBPcGVuXCIpXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCFyZXN1bHQuY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShVUkxfVE9fSEFORExFLCBKU09OLnN0cmluZ2lmeSh1cmkudG9KU09OKCkpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0YXdhaXQgdGhpcy5ob3N0U2VydmljZS5yZWxvYWQoKTtcblx0XHR9XG5cdH1cblxuXHQvLyBmb3JnZXQgYWJvdXQgYWxsIHVyaXMgYnVmZmVyZWQgbW9yZSB0aGFuIDUgbWludXRlcyBhZ29cblx0cHJpdmF0ZSBnYXJiYWdlQ29sbGVjdCgpOiB2b2lkIHtcblx0XHRjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHRjb25zdCB1cmlCdWZmZXIgPSBuZXcgTWFwPHN0cmluZywgeyB0aW1lc3RhbXA6IG51bWJlcjsgdXJpOiBVUkkgfVtdPigpO1xuXG5cdFx0dGhpcy51cmlCdWZmZXIuZm9yRWFjaCgodXJpcywgZXh0ZW5zaW9uSWQpID0+IHtcblx0XHRcdHVyaXMgPSB1cmlzLmZpbHRlcigoeyB0aW1lc3RhbXAgfSkgPT4gbm93IC0gdGltZXN0YW1wIDwgRklWRV9NSU5VVEVTKTtcblxuXHRcdFx0aWYgKHVyaXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHR1cmlCdWZmZXIuc2V0KGV4dGVuc2lvbklkLCB1cmlzKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMudXJpQnVmZmVyID0gdXJpQnVmZmVyO1xuXHR9XG5cblx0cHJpdmF0ZSBkaWRVc2VyVHJ1c3RFeHRlbnNpb24oaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLnVzZXJUcnVzdGVkRXh0ZW5zaW9uc1N0b3JhZ2UuaGFzKGlkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZ2V0Q29uZmlybWVkVHJ1c3RlZEV4dGVuc2lvbklkc0Zyb21Db25maWd1cmF0aW9uKCkuaW5kZXhPZihpZCkgPiAtMTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29uZmlybWVkVHJ1c3RlZEV4dGVuc2lvbklkc0Zyb21Db25maWd1cmF0aW9uKCk6IEFycmF5PHN0cmluZz4ge1xuXHRcdGNvbnN0IHRydXN0ZWRFeHRlbnNpb25JZHMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFVTRVJfVFJVU1RFRF9FWFRFTlNJT05TX0NPTkZJR1VSQVRJT05fS0VZKTtcblxuXHRcdGlmICghQXJyYXkuaXNBcnJheSh0cnVzdGVkRXh0ZW5zaW9uSWRzKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVzdGVkRXh0ZW5zaW9uSWRzO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZXh0ZW5zaW9uSGFuZGxlcnMuY2xlYXIoKTtcblx0XHR0aGlzLnVyaUJ1ZmZlci5jbGVhcigpO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElFeHRlbnNpb25VcmxIYW5kbGVyLCBFeHRlbnNpb25VcmxIYW5kbGVyLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBoYW5kbGVzIFVSTHMgYmVmb3JlIGBFeHRlbnNpb25VcmxIYW5kbGVyYCBpcyBpbnN0YW50aWF0ZWQuXG4gKiBNb3JlIGluZm86IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy83MzEwMVxuICovXG5jbGFzcyBFeHRlbnNpb25VcmxCb290c3RyYXBIYW5kbGVyIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgSVVSTEhhbmRsZXIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5leHRlbnNpb25VcmxCb290c3RyYXBIYW5kbGVyJztcblxuXHRwcml2YXRlIHN0YXRpYyBfY2FjaGU6IFtVUkksIElPcGVuVVJMT3B0aW9ucyB8IHVuZGVmaW5lZF1bXSA9IFtdO1xuXHRwcml2YXRlIHN0YXRpYyBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblxuXHRzdGF0aWMgZ2V0IGNhY2hlKCk6IFtVUkksIElPcGVuVVJMT3B0aW9ucyB8IHVuZGVmaW5lZF1bXSB7XG5cdFx0RXh0ZW5zaW9uVXJsQm9vdHN0cmFwSGFuZGxlci5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IEV4dGVuc2lvblVybEJvb3RzdHJhcEhhbmRsZXIuX2NhY2hlO1xuXHRcdEV4dGVuc2lvblVybEJvb3RzdHJhcEhhbmRsZXIuX2NhY2hlID0gW107XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKEBJVVJMU2VydmljZSB1cmxTZXJ2aWNlOiBJVVJMU2VydmljZSkge1xuXHRcdEV4dGVuc2lvblVybEJvb3RzdHJhcEhhbmRsZXIuZGlzcG9zYWJsZSA9IHVybFNlcnZpY2UucmVnaXN0ZXJIYW5kbGVyKHRoaXMpO1xuXHR9XG5cblx0YXN5bmMgaGFuZGxlVVJMKHVyaTogVVJJLCBvcHRpb25zPzogSU9wZW5VUkxPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKCFpc0V4dGVuc2lvbklkKHVyaS5hdXRob3JpdHkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0RXh0ZW5zaW9uVXJsQm9vdHN0cmFwSGFuZGxlci5fY2FjaGUucHVzaChbdXJpLCBvcHRpb25zXSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKEV4dGVuc2lvblVybEJvb3RzdHJhcEhhbmRsZXIuSUQsIEV4dGVuc2lvblVybEJvb3RzdHJhcEhhbmRsZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSAvKiByZWdpc3RyYXRpb24gb25seSAqLyk7XG5cbmNsYXNzIE1hbmFnZUF1dGhvcml6ZWRFeHRlbnNpb25VUklzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24ubWFuYWdlQXV0aG9yaXplZEV4dGVuc2lvblVSSXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbWFuYWdlJywgJ01hbmFnZSBBdXRob3JpemVkIEV4dGVuc2lvbiBVUklzLi4uJyksXG5cdFx0XHRjYXRlZ29yeTogbG9jYWxpemUyKCdleHRlbnNpb25zJywgJ0V4dGVuc2lvbnMnKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogSXNXZWJDb250ZXh0LnRvTmVnYXRlZCgpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3Qgc3RvcmFnZSA9IG5ldyBVc2VyVHJ1c3RlZEV4dGVuc2lvbklkU3RvcmFnZShzdG9yYWdlU2VydmljZSk7XG5cdFx0Y29uc3QgaXRlbXMgPSBzdG9yYWdlLmV4dGVuc2lvbnMubWFwKChsYWJlbCk6IElRdWlja1BpY2tJdGVtID0+ICh7IGxhYmVsLCBwaWNrZWQ6IHRydWUgfSkpO1xuXG5cdFx0aWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0YXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhbeyBsYWJlbDogbG9jYWxpemUoJ25vJywgJ1RoZXJlIGFyZSBjdXJyZW50bHkgbm8gYXV0aG9yaXplZCBleHRlbnNpb24gVVJJcy4nKSB9XSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhpdGVtcywgeyBjYW5QaWNrTWFueTogdHJ1ZSB9KTtcblxuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3RvcmFnZS5zZXQocmVzdWx0Lm1hcChpdGVtID0+IGl0ZW0ubGFiZWwpKTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoTWFuYWdlQXV0aG9yaXplZEV4dGVuc2lvblVSSXNBY3Rpb24pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQXNCLG9CQUFvQixvQkFBb0I7QUFDOUQsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsdUJBQXlDO0FBQ2xELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQXNCLG1CQUFvQztBQUMxRCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQix5QkFBeUI7QUFDbEQsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQWlDLGdCQUFnQixzQ0FBc0M7QUFDdkYsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBQ2pELFNBQVMsMEJBQTBDO0FBQ25ELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsc0JBQXNCO0FBRS9CLE1BQU0sZUFBZSxJQUFJLEtBQUs7QUFDOUIsTUFBTSxpQkFBaUIsS0FBSztBQUM1QixNQUFNLGdCQUFnQjtBQUN0QixNQUFNLDRDQUE0QztBQUNsRCxNQUFNLHNDQUFzQztBQUU1QyxTQUFTLGNBQWMsT0FBd0I7QUFDOUMsU0FBTyw4Q0FBOEMsS0FBSyxLQUFLO0FBQ2hFO0FBRUEsTUFBTSw4QkFBOEI7QUFBQSxFQVluQyxZQUFvQixnQkFBaUM7QUFBakM7QUFB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QUF5QjtBQUNqRCxpQ0FBNkIsYUFBYSxXQUFXLGdCQUFnQixJQUFJO0FBQUEsRUFDMUU7QUFBQSxFQUVBLE1BQU0sVUFBVSxLQUFVLFNBQTZDO0FBQ3RFLFFBQUksQ0FBQyxjQUFjLElBQUksU0FBUyxHQUFHO0FBQ2xDLGFBQU87QUFBQSxJQUNSO0FBRUEsaUNBQTZCLE9BQU8sS0FBSyxDQUFDLEtBQUssT0FBTyxDQUFDO0FBQ3ZELFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUEzQk0sNkJBRVcsS0FBSztBQUZoQiw2QkFJVSxTQUErQyxDQUFDO0FBSjFELCtCQUFOO0FBQUEsRUFlYztBQUFBLEdBZlI7QUE2Qk47QUFBQSxFQUErQiw2QkFBNkI7QUFBQSxFQUFJO0FBQUEsRUFBOEIsZUFBZTtBQUFBO0FBQW9DO0FBRWpKLE1BQU0sNENBQTRDLFFBQVE7QUFBQSxFQUV6RCxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxVQUFVLFVBQVUscUNBQXFDO0FBQUEsTUFDaEUsVUFBVSxVQUFVLGNBQWMsWUFBWTtBQUFBLE1BQzlDLE1BQU07QUFBQSxRQUNMLElBQUksT0FBTztBQUFBLFFBQ1gsTUFBTSxhQUFhLFVBQVU7QUFBQSxNQUM5QjtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sSUFBSSxVQUEyQztBQUNwRCxVQUFNLGlCQUFpQixTQUFTLElBQUksZUFBZTtBQUNuRCxVQUFNLG9CQUFvQixTQUFTLElBQUksa0JBQWtCO0FBQ3pELFVBQU0sVUFBVSxJQUFJLDhCQUE4QixjQUFjO0FBQ2hFLFVBQU0sUUFBUSxRQUFRLFdBQVcsSUFBSSxDQUFDLFdBQTJCLEVBQUUsT0FBTyxRQUFRLEtBQUssRUFBRTtBQUV6RixRQUFJLE1BQU0sV0FBVyxHQUFHO0FBQ3ZCLFlBQU0sa0JBQWtCLEtBQUssQ0FBQyxFQUFFLE9BQU8sU0FBUyxNQUFNLG1EQUFtRCxFQUFFLENBQUMsQ0FBQztBQUM3RztBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsTUFBTSxrQkFBa0IsS0FBSyxPQUFPLEVBQUUsYUFBYSxLQUFLLENBQUM7QUFFeEUsUUFBSSxDQUFDLFFBQVE7QUFDWjtBQUFBLElBQ0Q7QUFFQSxZQUFRLElBQUksT0FBTyxJQUFJLFVBQVEsS0FBSyxLQUFLLENBQUM7QUFBQSxFQUMzQztBQUNEO0FBRUEsZ0JBQWdCLG1DQUFtQzsiLAogICJuYW1lcyI6IFtdCn0K
