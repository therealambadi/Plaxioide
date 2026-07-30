/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { GoogleAuth } from 'google-auth-library';

export type VisionAnnotation = {
	labels: string[];
	objects: Array<{ name: string; score: number }>;
	text: string;
	dominantColors: string[];
	safeSearch: { adult: string; violence: string };
};

// Calls Google Cloud Vision API via Vertex AI credentials.
// project + region come from the user's googleVertex settings.
export async function analyzeImageWithVision(
	base64Image: string,
	mimeType: string,
	project: string,
	region: string,
): Promise<VisionAnnotation> {
	const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
	const accessToken = await auth.getAccessToken();
	if (!accessToken) throw new Error('Failed to get Google access token for Vision API');

	// Cloud Vision API v1 endpoint — regional endpoint for data residency
	const endpoint = region.startsWith('us')
		? 'https://vision.googleapis.com'
		: `https://${region}-vision.googleapis.com`;

	const body = {
		requests: [{
			image: { content: base64Image },
			features: [
				{ type: 'LABEL_DETECTION', maxResults: 15 },
				{ type: 'OBJECT_LOCALIZATION', maxResults: 15 },
				{ type: 'DOCUMENT_TEXT_DETECTION' },
				{ type: 'IMAGE_PROPERTIES' },
				{ type: 'SAFE_SEARCH_DETECTION' },
			],
		}],
	};

	const resp = await fetch(`${endpoint}/v1/images:annotate`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	if (!resp.ok) {
		const txt = await resp.text();
		throw new Error(`Vision API error ${resp.status}: ${txt}`);
	}

	const data = await resp.json() as any;
	const r = data.responses?.[0] ?? {};

	const labels: string[] = (r.labelAnnotations ?? []).map((l: any) => l.description as string);
	const objects: Array<{ name: string; score: number }> = (r.localizedObjectAnnotations ?? []).map((o: any) => ({
		name: o.name as string,
		score: Math.round((o.score as number) * 100),
	}));
	const text: string = r.fullTextAnnotation?.text ?? r.textAnnotations?.[0]?.description ?? '';
	const dominantColors: string[] = (r.imagePropertiesAnnotation?.dominantColors?.colors ?? [])
		.slice(0, 5)
		.map((c: any) => {
			const { red = 0, green = 0, blue = 0 } = c.color ?? {};
			return `#${[red, green, blue].map((v: number) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
		});
	const ss = r.safeSearchAnnotation ?? {};
	const safeSearch = { adult: ss.adult ?? 'UNKNOWN', violence: ss.violence ?? 'UNKNOWN' };

	return { labels, objects, text, dominantColors, safeSearch };
}

export function formatVisionAnnotation(ann: VisionAnnotation, filename: string): string {
	const lines: string[] = [`[Vision analysis of ${filename}]`];
	if (ann.labels.length) lines.push(`Labels: ${ann.labels.join(', ')}`);
	if (ann.objects.length) lines.push(`Objects: ${ann.objects.map(o => `${o.name} (${o.score}%)`).join(', ')}`);
	if (ann.text.trim()) lines.push(`Extracted text:\n${ann.text.trim().slice(0, 2000)}`);
	return lines.join('\n');
}
