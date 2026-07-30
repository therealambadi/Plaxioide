/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { GoogleAuth } from 'google-auth-library';
import { IVisionService, VisionAnnotation } from '../common/visionService.js';

export class VisionMainService extends Disposable implements IVisionService {
	readonly _serviceBrand: undefined;

	async analyzeImage(
		base64: string,
		mimeType: string,
		project: string,
		region: string,
	): Promise<VisionAnnotation | null> {
		try {
			const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
			const accessToken = await auth.getAccessToken();
			if (!accessToken) {
				console.error('[Vision] Could not obtain Google access token');
				return null;
			}

			const body = {
				requests: [{
					image: { content: base64 },
					features: [
						{ type: 'LABEL_DETECTION', maxResults: 15 },
						{ type: 'OBJECT_LOCALIZATION', maxResults: 15 },
						{ type: 'DOCUMENT_TEXT_DETECTION' },
					],
				}],
			};

			const resp = await fetch('https://vision.googleapis.com/v1/images:annotate', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			});

			if (!resp.ok) {
				const txt = await resp.text();
				console.error(`[Vision] API error ${resp.status}: ${txt}`);
				return null;
			}

			const data = await resp.json() as any;
			const r = data.responses?.[0] ?? {};

			const labels: string[] = (r.labelAnnotations ?? []).map((l: any) => l.description as string);
			const objects: Array<{ name: string; score: number }> = (r.localizedObjectAnnotations ?? []).map((o: any) => ({
				name: o.name as string,
				score: Math.round((o.score as number) * 100),
			}));
			const text: string = r.fullTextAnnotation?.text ?? r.textAnnotations?.[0]?.description ?? '';

			return { labels, objects, text };
		} catch (err) {
			console.error('[Vision] analyzeImage error:', err);
			return null;
		}
	}
}
