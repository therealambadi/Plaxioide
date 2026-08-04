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
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";

const STORAGE_KEY_ACCESS_TOKEN = "plaxio.auth.accessToken";
const STORAGE_KEY_REFRESH_TOKEN = "plaxio.auth.refreshToken";
const STORAGE_KEY_USER_EMAIL = "plaxio.auth.userEmail";
const AUTH_BASE = "https://www.plaxio.tech/api/auth";

function jwtSecondsRemaining(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Math.max(0, (payload.exp ?? 0) - Math.floor(Date.now() / 1000));
  } catch { return 0; }
}

export const IPlaxioAuthService = createDecorator("IPlaxioAuthService");

let PlaxioAuthService = class extends Disposable {
  constructor(storageService, urlService, notificationService) {
    super();
    this.storageService = storageService;
    this.notificationService = notificationService;
    this._refreshPromise = null;
    this._refreshTimer = null;
    this._onDidChangeState = this._register(new Emitter());
    this.onDidChangeState = this._onDidChangeState.event;

    const accessToken = storageService.get(STORAGE_KEY_ACCESS_TOKEN, StorageScope.PROFILE) ?? null;
    const userEmail = storageService.get(STORAGE_KEY_USER_EMAIL, StorageScope.PROFILE) ?? null;

    this._state = { isSignedIn: !!accessToken, userEmail, accessToken };
    this._register(urlService.registerHandler(this));

    if (accessToken) {
      const secsLeft = jwtSecondsRemaining(accessToken);
      if (secsLeft < 300) {
        this._doRefresh();
      } else {
        this._scheduleRefresh(secsLeft - 300);
      }
    }
  }

  get state() { return this._state; }

  _scheduleRefresh(inSeconds) {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this._doRefresh(), inSeconds * 1000);
  }

  _doRefresh() {
    if (this._refreshPromise) return this._refreshPromise;
    this._refreshPromise = this._refreshTokenNow().finally(() => { this._refreshPromise = null; });
    return this._refreshPromise;
  }

  async _refreshTokenNow() {
    const refreshToken = this.storageService.get(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE) ?? null;
    if (!refreshToken) return null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        const res = await fetch(`${AUTH_BASE}/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (res.status === 401 || res.status === 403) {
          this._state = { isSignedIn: false, userEmail: null, accessToken: null };
          this._onDidChangeState.fire(this._state);
          return null;
        }

        if (res.status === 404) {
          return this._state.accessToken;
        }

        if (!res.ok) continue;

        const data = await res.json();
        const { access_token, refresh_token: new_refresh } = data;
        if (!access_token) continue;

        let userEmail = this._state.userEmail;
        try {
          const payload = JSON.parse(atob(access_token.split(".")[1]));
          userEmail = payload.email ?? userEmail;
        } catch {}

        this._persist(access_token, new_refresh ?? refreshToken, userEmail);
        this._state = { isSignedIn: true, userEmail, accessToken: access_token };
        this._onDidChangeState.fire(this._state);

        const secsLeft = jwtSecondsRemaining(access_token);
        if (secsLeft > 300) this._scheduleRefresh(secsLeft - 300);

        return access_token;
      } catch {
        continue;
      }
    }

    this._scheduleRefresh(30);
    return this._state.accessToken;
  }

  async getValidAccessToken() {
    const token = this._state.accessToken;
    if (!token) {
      const refreshToken = this.storageService.get(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE) ?? null;
      if (refreshToken) {
        const refreshed = await this._doRefresh();
        return refreshed ?? refreshToken;
      }
      return null;
    }
    if (jwtSecondsRemaining(token) > 60) return token;
    const refreshed = await this._doRefresh();
    return refreshed ?? token;
  }

  getAnyToken() {
    return this._state.accessToken
      ?? this.storageService.get(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE)
      ?? null;
  }

  _persist(accessToken, refreshToken, userEmail) {
    this.storageService.store(STORAGE_KEY_ACCESS_TOKEN, accessToken, StorageScope.PROFILE, StorageTarget.MACHINE);
    this.storageService.store(STORAGE_KEY_REFRESH_TOKEN, refreshToken, StorageScope.PROFILE, StorageTarget.MACHINE);
    if (userEmail) this.storageService.store(STORAGE_KEY_USER_EMAIL, userEmail, StorageScope.PROFILE, StorageTarget.MACHINE);
  }

  async handleURL(uri, _options) {
    if (uri.authority !== "auth-callback") return false;
    const params = new URLSearchParams(uri.query);
    const code = params.get("code");
    if (!code) return false;

    try {
      const res = await fetch(`${AUTH_BASE}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "unknown" }));
        this.notificationService.notify({ severity: Severity.Error, message: `Plaxio sign-in failed: ${err.error ?? res.statusText}` });
        return true;
      }

      const { access_token, refresh_token } = await res.json();
      let userEmail = null;
      try { const payload = JSON.parse(atob(access_token.split(".")[1])); userEmail = payload.email ?? null; } catch {}

      this._persist(access_token, refresh_token, userEmail);
      this._state = { isSignedIn: true, userEmail, accessToken: access_token };
      this._onDidChangeState.fire(this._state);

      const secsLeft = jwtSecondsRemaining(access_token);
      if (secsLeft > 300) this._scheduleRefresh(secsLeft - 300);

      this.notificationService.notify({ severity: Severity.Info, message: `Signed in to Plaxio${userEmail ? ` as ${userEmail}` : ""}` });
    } catch (e) {
      this.notificationService.notify({ severity: Severity.Error, message: `Plaxio sign-in error: ${e?.message ?? String(e)}` });
    }
    return true;
  }

  signOut() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this.storageService.remove(STORAGE_KEY_ACCESS_TOKEN, StorageScope.PROFILE);
    this.storageService.remove(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE);
    this.storageService.remove(STORAGE_KEY_USER_EMAIL, StorageScope.PROFILE);
    this._state = { isSignedIn: false, userEmail: null, accessToken: null };
    this._onDidChangeState.fire(this._state);
  }
};

PlaxioAuthService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IURLService),
  __decorateParam(2, INotificationService)
], PlaxioAuthService);

export { PlaxioAuthService };

registerSingleton(IPlaxioAuthService, PlaxioAuthService, InstantiationType.Eager);
