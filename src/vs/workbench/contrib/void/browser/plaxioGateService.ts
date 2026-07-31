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

const API_BASE = 'https://www.plaxio.tech/api/credits';
const STORAGE_KEY_ACCESS_TOKEN = 'plaxio.auth.accessToken';

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
	) {
		super();
		this.fetchCredits();
	}

	private getAccessToken(): string | null {
		return this.storageService.get(STORAGE_KEY_ACCESS_TOKEN, StorageScope.PROFILE) ?? null;
	}

	async checkAICredit(): Promise<boolean> {
		const token = this.getAccessToken();
		if (!token) {
			this.notificationService.notify({
				severity: Severity.Info,
				message: 'Sign in to Plaxio to use AI features.',
				actions: {
					primary: [{
						id: 'signIn',
						label: 'Sign In',
						run: () => this.nativeHostService.openExternal('https://www.plaxio.tech/login?desktop=true'),
					}],
				},
			});
			return false;
		}

		try {
			const res = await fetch(`${API_BASE}/check`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ access_token: token }),
			});

			const data = await res.json();

			if (!data.allowed) {
				this.notificationService.notify({
					severity: Severity.Warning,
					message: `You've used all ${data.total} AI credits. More credits will be available when the product launches.`,
					actions: {
						primary: [{
							id: 'dashboard',
							label: 'View Usage',
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
			// Network error — allow action (fail-open)
			return true;
		}
	}

	async debitAICredit(): Promise<void> {
		const token = this.getAccessToken();
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
		const token = this.getAccessToken();
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
}

registerSingleton(IPlaxioGateService, PlaxioGateService, InstantiationType.Eager);
