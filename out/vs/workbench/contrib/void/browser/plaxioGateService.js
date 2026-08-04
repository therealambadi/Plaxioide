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
import { Emitter } from "../../../../base/common/event.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IPlaxioAuthService } from "./plaxioAuthService.js";

const API_BASE = "https://www.plaxio.tech/api/credits";

export const IPlaxioGateService = createDecorator("IPlaxioGateService");

let PlaxioGateService = class extends Disposable {
  constructor(storageService, notificationService, nativeHostService, authService) {
    super();
    this.storageService = storageService;
    this.notificationService = notificationService;
    this.nativeHostService = nativeHostService;
    this.authService = authService;
    this._onDidChangeCredits = this._register(new Emitter());
    this.onDidChangeCredits = this._onDidChangeCredits.event;
    this.onDidChangeBalance = this._onDidChangeCredits;
    this._cachedCredits = null;
    this.fetchCredits();
  }

  get cachedCredits() { return this._cachedCredits; }
  get cachedBalance() { return this._cachedCredits; }

  async getAccessToken() {
    return this.authService.getValidAccessToken();
  }

  async checkAICredit() {
    const token = await this.getAccessToken();
    if (!token) {
      this.notificationService.notify({
        severity: Severity.Info,
        message: "Sign in to Plaxio to use AI features.",
        actions: {
          primary: [{
            id: "signIn",
            label: "Sign In",
            run: () => this.nativeHostService.openExternal("https://www.plaxio.tech/login?desktop=true"),
          }],
        },
      });
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();

      if (data.reason === "UNAUTHORIZED" || res.status === 401) {
        this._cachedCredits = null;
        this._onDidChangeCredits.fire(null);
        this._notifySignInRequired();
        return false;
      }

      if (!data.allowed) {
        this.notificationService.notify({
          severity: Severity.Warning,
          message: `You've used all ${data.total} AI credits. More credits will be available when the product launches.`,
          actions: {
            primary: [{
              id: "dashboard",
              label: "View Usage",
              run: () => this.nativeHostService.openExternal("https://www.plaxio.tech/dashboard"),
            }],
          },
        });
        return false;
      }

      this._cachedCredits = { total: data.total, used: data.used, remaining: data.remaining };
      this._onDidChangeCredits.fire(this._cachedCredits);
      return true;
    } catch {
      this._notifySignInRequired();
      return false;
    }
  }

  async debitAICredit() {
    const token = await this.getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/debit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      });

      if (res.ok) {
        const data = await res.json();
        this._cachedCredits = { total: data.total, used: data.used, remaining: data.remaining };
        this._onDidChangeCredits.fire(this._cachedCredits);

        if (data.remaining <= 5 && data.remaining > 0) {
          this.notificationService.notify({
            severity: Severity.Warning,
            message: `${data.remaining} AI credits remaining.`,
          });
        }
      }
    } catch {}
  }

  async fetchCredits() {
    const token = await this.getAccessToken();
    if (!token) {
      this._cachedCredits = null;
      this._onDidChangeCredits.fire(null);
      return null;
    }

    try {
      const res = await fetch(`${API_BASE}/balance?access_token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const data = await res.json();
        this._cachedCredits = { total: data.total, used: data.used, remaining: data.remaining };
        this._onDidChangeCredits.fire(this._cachedCredits);
        return this._cachedCredits;
      }
    } catch {}

    this._cachedCredits = null;
    this._onDidChangeCredits.fire(null);
    return null;
  }
};

PlaxioGateService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, INativeHostService),
  __decorateParam(3, IPlaxioAuthService)
], PlaxioGateService);

export { PlaxioGateService };

registerSingleton(IPlaxioGateService, PlaxioGateService, InstantiationType.Eager);
