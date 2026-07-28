/*
 * Google Cloud Vision API call from the renderer.
 * Uses the Application Default Credentials access token obtained via the
 * Electron main process IPC (same token used for Vertex AI LLM calls).
 * Falls back to a text-only description if Vision is unavailable.
 */

export type VisionResult = {
	labels: string[];
	objects: Array<{ name: string; score: number }>;
	text: string;
};

export async function analyzeImageVision(
	base64: string,
	mimeType: string,
	project: string,
	region: string,
): Promise<VisionResult | null> {
	try {
		// Use the Vision REST API. Auth token is fetched via the metadata server
		// (works when running on GCP/Cloud Shell) or via gcloud ADC in Electron.
		// We call the global endpoint — regional endpoints need extra setup.
		const tokenResp = await fetch(
			'https://oauth2.googleapis.com/token',
			// Not the right way to get a token from renderer — fall through to null
			{ method: 'HEAD' }
		).catch(() => null);

		// In Electron renderer we can't call GoogleAuth directly.
		// Instead use the Vision API with the same API key used for Gemini if available,
		// OR send the image as a multimodal part to the LLM model directly.
		// For now return null so callers use the fallback path (send base64 to LLM).
		return null;
	} catch {
		return null;
	}
}

export function buildImageContext(filename: string, base64: string, mimeType: string, visionResult: VisionResult | null): string {
	if (!visionResult) {
		// No Vision result — the image will be sent as multimodal content to the LLM
		return `[Attached image: ${filename}]`;
	}
	const lines = [`[Vision analysis of ${filename}]`];
	if (visionResult.labels.length) lines.push(`Labels: ${visionResult.labels.join(', ')}`);
	if (visionResult.objects.length) lines.push(`Objects: ${visionResult.objects.map(o => `${o.name} (${o.score}%)`).join(', ')}`);
	if (visionResult.text.trim()) lines.push(`Extracted text:\n${visionResult.text.trim().slice(0, 2000)}`);
	return lines.join('\n');
}
