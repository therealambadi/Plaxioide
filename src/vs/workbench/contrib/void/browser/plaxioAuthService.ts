// @ts-nocheck
/*--------------------------------------------------------------------------------------
 *  Plaxio Auth Service
 *  Handles plaxio://auth-callback?code=XXX URL scheme, exchanges code for session,
 *  and stores auth state persistently.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IURLHandler, IURLService, IOpenURLOptions } from '../../../../platform/url/common/url.js';
import { URI } from '../../../../base/common/uri.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';

const STORAGE_KEY_ACCESS_TOKEN = 'plaxio.auth.accessToken';
const STORAGE_KEY_REFRESH_TOKEN = 'plaxio.auth.refreshToken';
const STORAGE_KEY_USER_EMAIL = 'plaxio.auth.userEmail';
const AUTH_BASE = 'https://www.plaxio.tech/api/auth';
const SUPABASE_URL = 'https://impbakzawydocenlfrbx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltcGJha3phd3lkb2NlbmxmcmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTk1NTcsImV4cCI6MjEwMDc5NTU1N30.hTjcHONRyGHeaUZ3NXnoujZZ-KjxhJh3Rza4CuVXmPo';

// Returns seconds until JWT expiry, or 0 if expired/invalid
function jwtSecondsRemaining(token: string): number {
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		return Math.max(0, (payload.exp ?? 0) - Math.floor(Date.now() / 1000));
	} catch { return 0; }
}

export interface PlaxioAuthState {
	isSignedIn: boolean;
	userEmail: string | null;
	accessToken: string | null;
}

export interface IPlaxioAuthService {
	readonly _serviceBrand: undefined;
	readonly state: PlaxioAuthState;
	readonly onDidChangeState: Event<PlaxioAuthState>;
	getValidAccessToken(): Promise<string | null>;
	getAnyToken(): string | null;
	signOut(): void;
}

export const IPlaxioAuthService = createDecorator<IPlaxioAuthService>('IPlaxioAuthService');

export class PlaxioAuthService extends Disposable implements IPlaxioAuthService, IURLHandler {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = this._register(new Emitter<PlaxioAuthState>());
	readonly onDidChangeState: Event<PlaxioAuthState> = this._onDidChangeState.event;

	private _state: PlaxioAuthState;
	private _refreshPromise: Promise<string | null> | null = null;
	private _refreshTimer: any = null;

	get state(): PlaxioAuthState {
		return this._state;
	}

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IURLService urlService: IURLService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();

		const accessToken = storageService.get(STORAGE_KEY_ACCESS_TOKEN, StorageScope.PROFILE, null) ?? null;
		const userEmail = storageService.get(STORAGE_KEY_USER_EMAIL, StorageScope.PROFILE, null) ?? null;

		this._state = { isSignedIn: !!accessToken, userEmail, accessToken };

		// Register as URL handler for plaxio://auth-callback
		this._register(urlService.registerHandler(this));

		// On startup: if token is expired or will expire within 5 min, refresh immediately
		if (accessToken) {
			const secsLeft = jwtSecondsRemaining(accessToken);
			if (secsLeft < 300) {
				this._doRefresh();
			} else {
				// Schedule proactive refresh 5 minutes before expiry
				this._scheduleRefresh(secsLeft - 300);
			}
		}
	}

	private _scheduleRefresh(inSeconds: number): void {
		if (this._refreshTimer) clearTimeout(this._refreshTimer);
		this._refreshTimer = setTimeout(() => this._doRefresh(), inSeconds * 1000);
	}

	private async _doRefresh(): Promise<string | null> {
		// Deduplicate concurrent refresh calls
		if (this._refreshPromise) return this._refreshPromise;
		this._refreshPromise = this._refreshTokenNow().finally(() => { this._refreshPromise = null; });
		return this._refreshPromise;
	}

	private async _refreshTokenNow(): Promise<string | null> {
		const refreshToken = this.storageService.get(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE, null) ?? null;
		if (!refreshToken) return null;

		// Use Supabase's GoTrue token refresh endpoint directly
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
				const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'apikey': SUPABASE_ANON_KEY,
					},
					body: JSON.stringify({ refresh_token: refreshToken }),
				});

				if (res.status === 401 || res.status === 403 || res.status === 400) {
					// Refresh token is truly invalid — clear everything
					this._state = { isSignedIn: false, userEmail: null, accessToken: null };
					this._onDidChangeState.fire(this._state);
					return null;
				}

				if (!res.ok) continue; // Retry on 5xx/network issues

				const data = await res.json();
				const access_token = data.access_token;
				const new_refresh = data.refresh_token;
				if (!access_token) continue;

				let userEmail: string | null = this._state.userEmail;
				try {
					const payload = JSON.parse(atob(access_token.split('.')[1]));
					userEmail = payload.email ?? userEmail;
				} catch { /* ignore */ }

				this._persist(access_token, new_refresh ?? refreshToken, userEmail);
				this._state = { isSignedIn: true, userEmail, accessToken: access_token };
				this._onDidChangeState.fire(this._state);

				// Schedule next refresh before token expires (5 min before expiry)
				const secsLeft = jwtSecondsRemaining(access_token);
				if (secsLeft > 300) this._scheduleRefresh(secsLeft - 300);

				return access_token;
			} catch {
				continue;
			}
		}

		// All retries failed but refresh token might still be valid (network issue)
		// Don't clear auth state — schedule another attempt in 30s
		this._scheduleRefresh(30);
		return this._state.accessToken;
	}

	// Returns a valid (non-expired) access token, refreshing if needed
	async getValidAccessToken(): Promise<string | null> {
		const token = this._state.accessToken;
		if (!token) {
			// No access token in memory — check if there's a refresh token we can use
			const refreshToken = this.storageService.get(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE, null) ?? null;
			if (refreshToken) {
				const refreshed = await this._doRefresh();
				return refreshed ?? refreshToken;
			}
			return null;
		}
		if (jwtSecondsRemaining(token) > 60) return token;
		const refreshed = await this._doRefresh();
		// If refresh failed, return existing token — the credit API may still accept it or
		// has its own grace period. Better than signing the user out.
		return refreshed ?? token;
	}

	// Returns any stored token (access or refresh) — used as fallback for APIs when refresh endpoint is down
	getAnyToken(): string | null {
		return this._state.accessToken
			?? this.storageService.get(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE, null)
			?? null;
	}

	private _persist(accessToken: string, refreshToken: string, userEmail: string | null): void {
		this.storageService.store(STORAGE_KEY_ACCESS_TOKEN, accessToken, StorageScope.PROFILE, StorageTarget.MACHINE);
		this.storageService.store(STORAGE_KEY_REFRESH_TOKEN, refreshToken, StorageScope.PROFILE, StorageTarget.MACHINE);
		if (userEmail) this.storageService.store(STORAGE_KEY_USER_EMAIL, userEmail, StorageScope.PROFILE, StorageTarget.MACHINE);
	}

	async handleURL(uri: URI, _options?: IOpenURLOptions): Promise<boolean> {
		if (uri.authority !== 'auth-callback') {
			return false;
		}

		const params = new URLSearchParams(uri.query);
		const code = params.get('code');

		if (!code) {
			return false;
		}

		try {
			const res = await fetch('https://www.plaxio.tech/api/auth/exchange', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code }),
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: 'unknown' }));
				this.notificationService.notify({
					severity: Severity.Error,
					message: `Plaxio sign-in failed: ${err.error ?? res.statusText}`,
				});
				return true;
			}

			const { access_token, refresh_token } = await res.json();

			// Decode email from JWT
			let userEmail: string | null = null;
			try {
				const payload = JSON.parse(atob(access_token.split('.')[1]));
				userEmail = payload.email ?? null;
			} catch { /* ignore */ }

			// Persist
			this.storageService.store(STORAGE_KEY_ACCESS_TOKEN, access_token, StorageScope.PROFILE, StorageTarget.MACHINE);
			this.storageService.store(STORAGE_KEY_REFRESH_TOKEN, refresh_token, StorageScope.PROFILE, StorageTarget.MACHINE);
			if (userEmail) {
				this.storageService.store(STORAGE_KEY_USER_EMAIL, userEmail, StorageScope.PROFILE, StorageTarget.MACHINE);
			}

			this._state = { isSignedIn: true, userEmail, accessToken: access_token };
			this._onDidChangeState.fire(this._state);

			this.notificationService.notify({
				severity: Severity.Info,
				message: `Signed in to Plaxio${userEmail ? ` as ${userEmail}` : ''}`,
			});
		} catch (e: any) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: `Plaxio sign-in error: ${e?.message ?? String(e)}`,
			});
		}

		return true;
	}

	signOut(): void {
		this.storageService.remove(STORAGE_KEY_ACCESS_TOKEN, StorageScope.PROFILE);
		this.storageService.remove(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE);
		this.storageService.remove(STORAGE_KEY_USER_EMAIL, StorageScope.PROFILE);

		this._state = { isSignedIn: false, userEmail: null, accessToken: null };
		this._onDidChangeState.fire(this._state);
	}
}

registerSingleton(IPlaxioAuthService, PlaxioAuthService, InstantiationType.Eager);
