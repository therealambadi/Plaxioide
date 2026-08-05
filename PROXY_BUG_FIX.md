# Plaxio AI Proxy Bug: "ContentUnion is required"

## Issue

The AI proxy at `https://www.plaxio.tech/api/ai` is returning a Gemini API error for ALL requests:

```
data: {"error":"ContentUnion is required"}
```

This happens regardless of message format — even a single `{role:"user", content:"hi"}` message fails. Authentication works (invalid tokens correctly return `{"error":"UNAUTHORIZED"}`), but every authenticated request fails at the Gemini API call.

## What "ContentUnion is required" means

This is a Google Gemini/Vertex AI SDK error. It means the `contents` array passed to `generateContentStream()` has an entry where the `parts` field is missing, null, or empty. This typically happens when:

1. The proxy constructs a `Content` object without proper `parts: [{text: "..."}]`
2. A `systemInstruction` is passed as `null` or with empty parts
3. The SDK version expects a different format than what's being sent

## Likely Root Cause

The proxy server code (deployed on Vercel at `plaxio.tech`) probably has one of these issues:

1. **`systemPrompt` passed as empty/null** — if the client sends `systemPrompt: undefined` or an empty string, and the proxy constructs `systemInstruction: { parts: [{ text: systemPrompt }] }` without checking for null/empty, Gemini rejects it.

2. **Google SDK update** — if `@google/genai` or `@google-cloud/vertexai` was updated on the server, the `Content` type requirements may have changed.

3. **Service account / API key issue** — if the Vertex AI credentials expired, the error message might be misleading (though usually it would say "PERMISSION_DENIED" instead).

## Suggested Fix

In the proxy route handler (`/api/ai`), check:

```typescript
// Before passing to Gemini:
const systemInstruction = systemPrompt?.trim()
  ? { parts: [{ text: systemPrompt }] }
  : undefined;  // DON'T pass empty/null systemInstruction

const contents = messages.map(msg => ({
  role: msg.role === 'assistant' ? 'model' : msg.role,
  parts: [{ text: msg.content || ' ' }]  // Never pass empty text
}));

// Make sure contents is not empty
if (!contents.length) {
  return Response.json({ error: 'No messages provided' });
}
```

## How to reproduce

```bash
curl -X POST https://www.plaxio.tech/api/ai \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<valid_jwt>","model":"gemini-2.0-flash","messages":[{"role":"user","content":"hi"}],"systemPrompt":"Be brief.","temperature":1,"maxOutputTokens":50}'
```

Returns: `data: {"error":"ContentUnion is required"}`

## Impact

- ALL AI features are broken (chat, tool calls, everything)
- Windows and Mac clients are affected
- The client-side code is correct — this is purely a server-side proxy issue

## Client-side context

The client sends this JSON body to the proxy:
```json
{
  "access_token": "<jwt>",
  "model": "gemini-2.0-flash",
  "messages": [{"role": "user", "content": "..."}],
  "systemPrompt": "...",
  "temperature": 1,
  "maxOutputTokens": 8192
}
```

The proxy should:
1. Validate the token
2. Convert messages to Gemini format (`user`/`model` roles, `parts: [{text}]`)
3. Pass `systemPrompt` as `systemInstruction` (only if non-empty)
4. Stream the response back as SSE with `data: {"text": "..."}` chunks and `data: [DONE]` at the end
