/*--------------------------------------------------------------------------------------
 *  Plaxio Sentry Service — Error monitoring for the desktop IDE
 *  Captures errors in AI/chat calls, verification pipeline, and simulator.
 *  Initialize with DSN from environment. Disabled if no DSN is set.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';


export interface IPlaxioSentryService {
	readonly _serviceBrand: undefined;
	captureException(error: Error | unknown, context?: Record<string, unknown>): void;
	addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>): void;
	setUser(email: string | null, userId?: string): void;
}

export const IPlaxioSentryService = createDecorator<IPlaxioSentryService>('IPlaxioSentryService');

export class PlaxioSentryService extends Disposable implements IPlaxioSentryService {
	declare readonly _serviceBrand: undefined;

	private _sentry: any = null;
	private _initialized = false;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();
		this._initSentry();
	}

	private _initSentry() {
		const Sentry = (globalThis as any).Sentry;
		if (!Sentry) return;

		this._sentry = Sentry;
		this._initialized = true;

		const email = this.storageService.get('plaxio.auth.userEmail', StorageScope.PROFILE);
		if (email) {
			Sentry.setUser({ email });
		}
	}

	captureException(error: Error | unknown, context?: Record<string, unknown>): void {
		if (!this._sentry) return;
		this._sentry.captureException(error, {
			extra: context,
		});
	}

	addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>): void {
		if (!this._sentry) return;
		this._sentry.addBreadcrumb({
			message,
			category: category ?? 'action',
			data,
			level: 'info',
		});
	}

	setUser(email: string | null, userId?: string): void {
		if (!this._sentry) return;
		if (email) {
			this._sentry.setUser({ email, id: userId });
		} else {
			this._sentry.setUser(null);
		}
	}
}

registerSingleton(IPlaxioSentryService, PlaxioSentryService, InstantiationType.Eager);
