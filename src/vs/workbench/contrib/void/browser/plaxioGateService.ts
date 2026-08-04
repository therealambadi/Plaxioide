// @ts-nocheck
/*--------------------------------------------------------------------------------------
 *  Plaxio Gate Service — MVP AI Credit Limiter
 *  Simple 50 AI credits per user. No subscriptions, no plans.
 *  Only gates AI chat messages to prevent misuse of LLM API costs.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { IPlaxioAuthService } from './plaxioAuthService.js';

const API_BASE = 'https://www.plaxio.tech/api/credits';

export interface AICreditsState {
	total: number;
	used: number;
	remaining: number;
}

export interface IPlaxioGateService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeCredits: Event<AICreditsState | null>;
	readonly cachedCredits: AICreditsState | null;

	checkAICredit(): Promise<boolean>;
	debitAICredit(): Promise<void>;
	fetchCredits(): Promise<AICreditsState | null>;
}

export const IPlaxioGateService = createDecorator<IPlaxioGateService>('IPlaxioGateService');

export class PlaxioGateService extends Disposable implements IPlaxioGateService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeCredits = this._register(new Emitter<AICreditsState | null>());
	readonly onDidChangeCredits: Event<AICreditsState | null> = this._onDidChangeCredits.event;

	// Keep old event name for compatibility with services.tsx
	get onDidChangeBalance() { return this._onDidChangeCredits; }

	private _cachedCredits: AICreditsState | null = null;

	get cachedCredits(): AICreditsState | null {
		return this._cachedCredits;
	}

	// Compat alias
	get cachedBalance(): AICreditsState | null {
		return this._cachedCredits;
	}

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@IPlaxioAuthService private readonly authService: IPlaxioAuthService,
	) {
		super();
		this.fetchCredits();
	}

	private async getAccessToken(): Promise<string | null> {
		return this.authService.getValidAccessToken();
	}

	async checkAICredit(): Promise<boolean> {
		const token = await this.getAccessToken();
		if (!token) {
			this.notificationService.notify({
				severity: Severity.Info,
				message: 'Sign in to Plaxio to use AI features.',
				actions: {
					primary: [{
						id: 'signIn',
						label: 'Sign In',
						enabled: true,
						class: undefined,
						tooltip: '',
						run: () => this.nativeHostService.openExternal('https://www.plaxio.tech/login?desktop=true'),
					}],
				},
			});
			return false;
		}

		// Fast path: cache is populated and credits remain — allow immediately, refresh in background.
		if (this._cachedCredits !== null && this._cachedCredits.remaining > 0) {
			this._refreshCreditsBackground(token);
			return true;
		}

		// Slow path: cache is null (first run) or cache says zero — must verify with network.
		return this._checkCreditNetwork(token);
	}

	private _refreshCreditsBackground(token: string): void {
		// Fire-and-forget: update the cache for next check, never blocks the send path.
		fetch(`${API_BASE}/balance?access_token=${encodeURIComponent(token)}`)
			.then(async r => {
				const data = await r.json().catch(() => null);
				if (!data || data.error === 'UNAUTHORIZED' || r.status === 401) {
					// Token might be expired — but if refresh endpoint is down, don't clear session
					if (!this.authService.getAnyToken()) {
						this._cachedCredits = null;
						this._onDidChangeCredits.fire(null);
					}
					return;
				}
				if (typeof data.total !== 'number') return;
				this._cachedCredits = { total: data.total, used: data.used ?? 0, remaining: data.remaining ?? (data.total - (data.used ?? 0)) };
				this._onDidChangeCredits.fire(this._cachedCredits);
				if (data.remaining === 0) {
					this.notificationService.notify({
						severity: Severity.Warning,
						message: `You've used all ${data.total} AI credits. More credits will be available when the product launches.`,
						actions: {
							primary: [{
								id: 'dashboard',
								label: 'View Usage',
								enabled: true,
								class: undefined,
								tooltip: '',
								run: () => this.nativeHostService.openExternal('https://www.plaxio.tech/dashboard'),
							}],
						},
					});
				}
			})
			.catch(() => { /* silent — cache stays as-is */ });
	}

	private _notifySignInRequired(): void {
		this.notificationService.notify({
			severity: Severity.Info,
			message: 'Your Plaxio session has expired. Please sign in again to use AI features.',
			actions: {
				primary: [{
					id: 'signIn',
					label: 'Sign In',
					enabled: true,
					class: undefined,
					tooltip: '',
					run: () => this.nativeHostService.openExternal('https://www.plaxio.tech/login?desktop=true'),
				}],
			},
		});
	}

	private async _checkCreditNetwork(token: string): Promise<boolean> {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 3000);
			const res = await fetch(`${API_BASE}/check`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ access_token: token }),
				signal: controller.signal,
			});
			clearTimeout(timeout);
			const data = await res.json();

			// Token expired — but we already tried refresh via authService.
			// If refresh endpoint is down (404) the token is expired but user IS signed in.
			// Fail-open: allow the action. Only block if user explicitly has no stored credentials.
			if (data.reason === 'UNAUTHORIZED' || res.status === 401) {
				this._cachedCredits = null;
				this._onDidChangeCredits.fire(null);
				this._notifySignInRequired();
				return false;
			}

			if (!data.allowed) {
				this.notificationService.notify({
					severity: Severity.Warning,
					message: `You've used all ${data.total ?? 50} AI credits. More credits will be available when the product launches.`,
					actions: {
						primary: [{
							id: 'dashboard',
							label: 'View Usage',
							enabled: true,
							class: undefined,
							tooltip: '',
							run: () => this.nativeHostService.openExternal('https://www.plaxio.tech/dashboard'),
						}],
					},
				});
				return false;
			}
			this._cachedCredits = { total: data.total, used: data.used, remaining: data.remaining };
			this._onDidChangeCredits.fire(this._cachedCredits);
			return true;
		} catch {
			// Network error — fail-closed: require sign-in
			this._notifySignInRequired();
			return false;
		}
	}

	async debitAICredit(): Promise<void> {
		const token = await this.getAccessToken();
		if (!token) return;

		try {
			const res = await fetch(`${API_BASE}/debit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
		} catch {
			// Silent fail — action already completed
		}
	}

	async fetchCredits(): Promise<AICreditsState | null> {
		const token = await this.getAccessToken();
		if (!token) {
			this._cachedCredits = null;
			this._onDidChangeCredits.fire(null);
			return null;
		}

		try {
			const res = await fetch(`${API_BASE}/balance?access_token=${encodeURIComponent(token)}`);
			const data = await res.json().catch(() => null);

			// Expired/invalid token — attempt one more refresh and retry
			if (!data || data.error === 'UNAUTHORIZED' || res.status === 401) {
				// Try refreshing the token and retrying once
				const freshToken = await this.authService.getValidAccessToken();
				if (freshToken && freshToken !== token) {
					try {
						const retryRes = await fetch(`${API_BASE}/balance?access_token=${encodeURIComponent(freshToken)}`);
						const retryData = await retryRes.json().catch(() => null);
						if (retryRes.ok && retryData && typeof retryData.total === 'number') {
							this._cachedCredits = { total: retryData.total, used: retryData.used ?? 0, remaining: retryData.remaining ?? (retryData.total - (retryData.used ?? 0)) };
							this._onDidChangeCredits.fire(this._cachedCredits);
							return this._cachedCredits;
						}
					} catch { /* fall through */ }
				}
				this._cachedCredits = null;
				this._onDidChangeCredits.fire(null);
				return null;
			}

			if (res.ok && typeof data.total === 'number') {
				this._cachedCredits = { total: data.total, used: data.used ?? 0, remaining: data.remaining ?? (data.total - (data.used ?? 0)) };
				this._onDidChangeCredits.fire(this._cachedCredits);
				return this._cachedCredits;
			}
		} catch {}

		this._cachedCredits = null;
		this._onDidChangeCredits.fire(null);
		return null;
	}
}

registerSingleton(IPlaxioGateService, PlaxioGateService, InstantiationType.Eager);
