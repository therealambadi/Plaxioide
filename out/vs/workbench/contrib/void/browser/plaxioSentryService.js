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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";

export const IPlaxioSentryService = createDecorator("IPlaxioSentryService");

let PlaxioSentryService = class extends Disposable {
  constructor(storageService) {
    super();
    this.storageService = storageService;
    this._sentry = null;
    this._initialized = false;
    this._initSentry();
  }

  _initSentry() {
    const Sentry = globalThis.Sentry;
    if (!Sentry) return;
    this._sentry = Sentry;
    this._initialized = true;
    const email = this.storageService.get("plaxio.auth.userEmail", StorageScope.PROFILE);
    if (email) Sentry.setUser({ email });
  }

  captureException(error, context) {
    if (!this._sentry) return;
    this._sentry.captureException(error, { extra: context });
  }

  addBreadcrumb(message, category, data) {
    if (!this._sentry) return;
    this._sentry.addBreadcrumb({ message, category: category ?? "action", data, level: "info" });
  }

  setUser(email, userId) {
    if (!this._sentry) return;
    if (email) this._sentry.setUser({ email, id: userId });
    else this._sentry.setUser(null);
  }
};

PlaxioSentryService = __decorateClass([
  __decorateParam(0, IStorageService)
], PlaxioSentryService);

export { PlaxioSentryService };

registerSingleton(IPlaxioSentryService, PlaxioSentryService, InstantiationType.Eager);
