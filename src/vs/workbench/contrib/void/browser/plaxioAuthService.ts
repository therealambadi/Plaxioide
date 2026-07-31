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

export interface PlaxioAuthState {
	isSignedIn: boolean;
	userEmail: string | null;
	accessToken: string | null;
}

export interface IPlaxioAuthService {
	readonly _serviceBrand: undefined;
	readonly state: PlaxioAuthState;
	readonly onDidChangeState: Event<PlaxioAuthState>;
	signOut(): void;
}

export const IPlaxioAuthService = createDecorator<IPlaxioAuthService>('IPlaxioAuthService');

export class PlaxioAuthService extends Disposable implements IPlaxioAuthService, IURLHandler {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = this._register(new Emitter<PlaxioAuthState>());
	readonly onDidChangeState: Event<PlaxioAuthState> = this._onDidChangeState.event;

	private _state: PlaxioAuthState;

	get state(): PlaxioAuthState {
		return this._state;
	}

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IURLService urlService: IURLService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();

		// Restore persisted session
		const accessToken = storageService.get(STORAGE_KEY_ACCESS_TOKEN, StorageScope.PROFILE, null) ?? null;
		const refreshToken = storageService.get(STORAGE_KEY_REFRESH_TOKEN, StorageScope.PROFILE, null) ?? null;
		const userEmail = storageService.get(STORAGE_KEY_USER_EMAIL, StorageScope.PROFILE, null) ?? null;

		this._state = {
			isSignedIn: !!accessToken,
			userEmail,
			accessToken,
		};

		// Register as URL handler for plaxio://auth-callback
		this._register(urlService.registerHandler(this));
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
