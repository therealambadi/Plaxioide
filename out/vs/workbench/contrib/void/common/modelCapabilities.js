const defaultProviderSettings = {
  googleVertex: {
    region: "global",
    project: ""
  }
};
const defaultModelsOfProvider = {
  googleVertex: [
    "gemini-2.5-flash"
  ]
};
const modelOverrideKeys = [
  "contextWindow",
  "reservedOutputTokenSpace",
  "supportsSystemMessage",
  "specialToolFormat",
  "supportsFIM",
  "reasoningCapabilities",
  "additionalOpenAIPayload"
];
const defaultModelOptions = {
  contextWindow: 4096,
  reservedOutputTokenSpace: 4096,
  cost: { input: 0, output: 0 },
  downloadable: false,
  supportsSystemMessage: false,
  supportsFIM: false,
  reasoningCapabilities: false
};
const openSourceModelOptions_assumingOAICompat = {
  "deepseekR1": {
    supportsFIM: false,
    supportsSystemMessage: false,
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: true, openSourceThinkTags: ["<think>", "</think>"] },
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  "deepseekCoderV3": {
    supportsFIM: false,
    supportsSystemMessage: false,
    // unstable
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  "deepseekCoderV2": {
    supportsFIM: false,
    supportsSystemMessage: false,
    // unstable
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  "codestral": {
    supportsFIM: true,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  "devstral": {
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 131e3,
    reservedOutputTokenSpace: 8192
  },
  "openhands-lm-32b": {
    // https://www.all-hands.dev/blog/introducing-openhands-lm-32b----a-strong-open-coding-agent-model
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    // built on qwen 2.5 32B instruct
    contextWindow: 128e3,
    reservedOutputTokenSpace: 4096
  },
  // really only phi4-reasoning supports reasoning... simpler to combine them though
  "phi4": {
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: true, openSourceThinkTags: ["<think>", "</think>"] },
    contextWindow: 16e3,
    reservedOutputTokenSpace: 4096
  },
  "gemma": {
    // https://news.ycombinator.com/item?id=43451406
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  // llama 4 https://ai.meta.com/blog/llama-4-multimodal-intelligence/
  "llama4-scout": {
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 1e7,
    reservedOutputTokenSpace: 4096
  },
  "llama4-maverick": {
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 1e7,
    reservedOutputTokenSpace: 4096
  },
  // llama 3
  "llama3": {
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  "llama3.1": {
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  "llama3.2": {
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  "llama3.3": {
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  // qwen
  "qwen2.5coder": {
    supportsFIM: true,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 32e3,
    reservedOutputTokenSpace: 4096
  },
  "qwq": {
    supportsFIM: false,
    // no FIM, yes reasoning
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: true, openSourceThinkTags: ["<think>", "</think>"] },
    contextWindow: 128e3,
    reservedOutputTokenSpace: 8192
  },
  "qwen3": {
    supportsFIM: false,
    // replaces QwQ
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: true, canIOReasoning: true, openSourceThinkTags: ["<think>", "</think>"] },
    contextWindow: 32768,
    reservedOutputTokenSpace: 8192
  },
  // FIM only
  "starcoder2": {
    supportsFIM: true,
    supportsSystemMessage: false,
    reasoningCapabilities: false,
    contextWindow: 128e3,
    reservedOutputTokenSpace: 8192
  },
  "codegemma:2b": {
    supportsFIM: true,
    supportsSystemMessage: false,
    reasoningCapabilities: false,
    contextWindow: 128e3,
    reservedOutputTokenSpace: 8192
  },
  "quasar": {
    // openrouter/quasar-alpha
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
    contextWindow: 1e6,
    reservedOutputTokenSpace: 32e3
  }
};
const extensiveModelOptionsFallback = (modelName, fallbackKnownValues) => {
  const lower = modelName.toLowerCase();
  const toFallback = (obj, recognizedModelName) => {
    const opts = obj[recognizedModelName];
    const supportsSystemMessage = opts.supportsSystemMessage === "separated" ? "system-role" : opts.supportsSystemMessage;
    return {
      recognizedModelName,
      modelName,
      ...opts,
      supportsSystemMessage,
      cost: { input: 0, output: 0 },
      downloadable: false,
      ...fallbackKnownValues
    };
  };
  if (lower.includes("gemini") && (lower.includes("3.") || lower.includes("3-"))) return toFallback(geminiModelOptions, "gemini-2.5-flash");
  if (lower.includes("gemini") && (lower.includes("2.5") || lower.includes("2-5"))) return toFallback(geminiModelOptions, "gemini-2.5-pro-exp-03-25");
  if (lower.includes("claude-3-5") || lower.includes("claude-3.5")) return toFallback(anthropicModelOptions, "claude-3-5-sonnet-20241022");
  if (lower.includes("claude")) return toFallback(anthropicModelOptions, "claude-3-7-sonnet-20250219");
  if (lower.includes("grok2") || lower.includes("grok2")) return toFallback(xAIModelOptions, "grok-2");
  if (lower.includes("grok")) return toFallback(xAIModelOptions, "grok-3");
  if (lower.includes("deepseek-r1") || lower.includes("deepseek-reasoner")) return toFallback(openSourceModelOptions_assumingOAICompat, "deepseekR1");
  if (lower.includes("deepseek") && lower.includes("v2")) return toFallback(openSourceModelOptions_assumingOAICompat, "deepseekCoderV2");
  if (lower.includes("deepseek")) return toFallback(openSourceModelOptions_assumingOAICompat, "deepseekCoderV3");
  if (lower.includes("llama3")) return toFallback(openSourceModelOptions_assumingOAICompat, "llama3");
  if (lower.includes("llama3.1")) return toFallback(openSourceModelOptions_assumingOAICompat, "llama3.1");
  if (lower.includes("llama3.2")) return toFallback(openSourceModelOptions_assumingOAICompat, "llama3.2");
  if (lower.includes("llama3.3")) return toFallback(openSourceModelOptions_assumingOAICompat, "llama3.3");
  if (lower.includes("llama") || lower.includes("scout")) return toFallback(openSourceModelOptions_assumingOAICompat, "llama4-scout");
  if (lower.includes("llama") || lower.includes("maverick")) return toFallback(openSourceModelOptions_assumingOAICompat, "llama4-scout");
  if (lower.includes("llama")) return toFallback(openSourceModelOptions_assumingOAICompat, "llama4-scout");
  if (lower.includes("qwen") && lower.includes("2.5") && lower.includes("coder")) return toFallback(openSourceModelOptions_assumingOAICompat, "qwen2.5coder");
  if (lower.includes("qwen") && lower.includes("3")) return toFallback(openSourceModelOptions_assumingOAICompat, "qwen3");
  if (lower.includes("qwen")) return toFallback(openSourceModelOptions_assumingOAICompat, "qwen3");
  if (lower.includes("qwq")) {
    return toFallback(openSourceModelOptions_assumingOAICompat, "qwq");
  }
  if (lower.includes("phi4")) return toFallback(openSourceModelOptions_assumingOAICompat, "phi4");
  if (lower.includes("codestral")) return toFallback(openSourceModelOptions_assumingOAICompat, "codestral");
  if (lower.includes("devstral")) return toFallback(openSourceModelOptions_assumingOAICompat, "devstral");
  if (lower.includes("gemma")) return toFallback(openSourceModelOptions_assumingOAICompat, "gemma");
  if (lower.includes("starcoder2")) return toFallback(openSourceModelOptions_assumingOAICompat, "starcoder2");
  if (lower.includes("openhands")) return toFallback(openSourceModelOptions_assumingOAICompat, "openhands-lm-32b");
  if (lower.includes("quasar") || lower.includes("quaser")) return toFallback(openSourceModelOptions_assumingOAICompat, "quasar");
  if (lower.includes("gpt") && lower.includes("mini") && (lower.includes("4.1") || lower.includes("4-1"))) return toFallback(openAIModelOptions, "gpt-4.1-mini");
  if (lower.includes("gpt") && lower.includes("nano") && (lower.includes("4.1") || lower.includes("4-1"))) return toFallback(openAIModelOptions, "gpt-4.1-nano");
  if (lower.includes("gpt") && (lower.includes("4.1") || lower.includes("4-1"))) return toFallback(openAIModelOptions, "gpt-4.1");
  if (lower.includes("4o") && lower.includes("mini")) return toFallback(openAIModelOptions, "gpt-4o-mini");
  if (lower.includes("4o")) return toFallback(openAIModelOptions, "gpt-4o");
  if (lower.includes("o1") && lower.includes("mini")) return toFallback(openAIModelOptions, "o1-mini");
  if (lower.includes("o1")) return toFallback(openAIModelOptions, "o1");
  if (lower.includes("o3") && lower.includes("mini")) return toFallback(openAIModelOptions, "o3-mini");
  if (lower.includes("o3")) return toFallback(openAIModelOptions, "o3");
  if (lower.includes("o4") && lower.includes("mini")) return toFallback(openAIModelOptions, "o4-mini");
  if (Object.keys(openSourceModelOptions_assumingOAICompat).map((k) => k.toLowerCase()).includes(lower))
    return toFallback(openSourceModelOptions_assumingOAICompat, lower);
  return null;
};
const anthropicModelOptions = {
  "claude-3-7-sonnet-20250219": {
    // https://docs.anthropic.com/en/docs/about-claude/models/all-models#model-comparison-table
    contextWindow: 2e5,
    reservedOutputTokenSpace: 8192,
    cost: { input: 3, cache_read: 0.3, cache_write: 3.75, output: 15 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: true,
      canIOReasoning: true,
      reasoningReservedOutputTokenSpace: 8192,
      // can bump it to 128_000 with beta mode output-128k-2025-02-19
      reasoningSlider: { type: "budget_slider", min: 1024, max: 8192, default: 1024 }
      // they recommend batching if max > 32_000. we cap at 8192 because above is typically not necessary (often even buggy)
    }
  },
  "claude-opus-4-20250514": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: 8192,
    cost: { input: 15, cache_read: 1.5, cache_write: 18.75, output: 30 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: true,
      canIOReasoning: true,
      reasoningReservedOutputTokenSpace: 8192,
      // can bump it to 128_000 with beta mode output-128k-2025-02-19
      reasoningSlider: { type: "budget_slider", min: 1024, max: 8192, default: 1024 }
      // they recommend batching if max > 32_000. we cap at 8192 because above is typically not necessary (often even buggy)
    }
  },
  "claude-sonnet-4-20250514": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: 8192,
    cost: { input: 3, cache_read: 0.3, cache_write: 3.75, output: 6 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: true,
      canIOReasoning: true,
      reasoningReservedOutputTokenSpace: 8192,
      // can bump it to 128_000 with beta mode output-128k-2025-02-19
      reasoningSlider: { type: "budget_slider", min: 1024, max: 8192, default: 1024 }
      // they recommend batching if max > 32_000. we cap at 8192 because above is typically not necessary (often even buggy)
    }
  },
  "claude-3-5-sonnet-20241022": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: 8192,
    cost: { input: 3, cache_read: 0.3, cache_write: 3.75, output: 15 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: false
  },
  "claude-3-5-haiku-20241022": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.8, cache_read: 0.08, cache_write: 1, output: 4 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: false
  },
  "claude-3-opus-20240229": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: 4096,
    cost: { input: 15, cache_read: 1.5, cache_write: 18.75, output: 75 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: false
  },
  "claude-3-sonnet-20240229": {
    // no point of using this, but including this for people who put it in
    contextWindow: 2e5,
    cost: { input: 3, output: 15 },
    downloadable: false,
    reservedOutputTokenSpace: 4096,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: false
  }
};
const anthropicSettings = {
  providerReasoningIOSettings: {
    input: {
      includeInPayload: (reasoningInfo) => {
        if (!reasoningInfo?.isReasoningEnabled) return null;
        if (reasoningInfo.type === "budget_slider_value") {
          return { thinking: { type: "enabled", budget_tokens: reasoningInfo.reasoningBudget } };
        }
        return null;
      }
    }
  },
  modelOptions: anthropicModelOptions,
  modelOptionsFallback: (modelName) => {
    const lower = modelName.toLowerCase();
    let fallbackName = null;
    if (lower.includes("claude-4-opus") || lower.includes("claude-opus-4")) fallbackName = "claude-opus-4-20250514";
    if (lower.includes("claude-4-sonnet") || lower.includes("claude-sonnet-4")) fallbackName = "claude-sonnet-4-20250514";
    if (lower.includes("claude-3-7-sonnet")) fallbackName = "claude-3-7-sonnet-20250219";
    if (lower.includes("claude-3-5-sonnet")) fallbackName = "claude-3-5-sonnet-20241022";
    if (lower.includes("claude-3-5-haiku")) fallbackName = "claude-3-5-haiku-20241022";
    if (lower.includes("claude-3-opus")) fallbackName = "claude-3-opus-20240229";
    if (lower.includes("claude-3-sonnet")) fallbackName = "claude-3-sonnet-20240229";
    if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...anthropicModelOptions[fallbackName] };
    return null;
  }
};
const openAIModelOptions = {
  // https://platform.openai.com/docs/pricing
  "o3": {
    contextWindow: 1047576,
    reservedOutputTokenSpace: 32768,
    cost: { input: 10, output: 40, cache_read: 2.5 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "openai-style",
    supportsSystemMessage: "developer-role",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: "effort_slider", values: ["low", "medium", "high"], default: "low" } }
  },
  "o4-mini": {
    contextWindow: 1047576,
    reservedOutputTokenSpace: 32768,
    cost: { input: 1.1, output: 4.4, cache_read: 0.275 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "openai-style",
    supportsSystemMessage: "developer-role",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: "effort_slider", values: ["low", "medium", "high"], default: "low" } }
  },
  "gpt-4.1": {
    contextWindow: 1047576,
    reservedOutputTokenSpace: 32768,
    cost: { input: 2, output: 8, cache_read: 0.5 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "openai-style",
    supportsSystemMessage: "developer-role",
    reasoningCapabilities: false
  },
  "gpt-4.1-mini": {
    contextWindow: 1047576,
    reservedOutputTokenSpace: 32768,
    cost: { input: 0.4, output: 1.6, cache_read: 0.1 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "openai-style",
    supportsSystemMessage: "developer-role",
    reasoningCapabilities: false
  },
  "gpt-4.1-nano": {
    contextWindow: 1047576,
    reservedOutputTokenSpace: 32768,
    cost: { input: 0.1, output: 0.4, cache_read: 0.03 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "openai-style",
    supportsSystemMessage: "developer-role",
    reasoningCapabilities: false
  },
  "o1": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: 1e5,
    cost: { input: 15, cache_read: 7.5, output: 60 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "developer-role",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: "effort_slider", values: ["low", "medium", "high"], default: "low" } }
  },
  "o3-mini": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: 1e5,
    cost: { input: 1.1, cache_read: 0.55, output: 4.4 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "developer-role",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: "effort_slider", values: ["low", "medium", "high"], default: "low" } }
  },
  "gpt-4o": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: 16384,
    cost: { input: 2.5, cache_read: 1.25, output: 10 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "openai-style",
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "o1-mini": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: 65536,
    cost: { input: 1.1, cache_read: 0.55, output: 4.4 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: false,
    // does not support any system
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: "effort_slider", values: ["low", "medium", "high"], default: "low" } }
  },
  "gpt-4o-mini": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: 16384,
    cost: { input: 0.15, cache_read: 0.075, output: 0.6 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "openai-style",
    supportsSystemMessage: "system-role",
    // ??
    reasoningCapabilities: false
  }
};
const openAICompatIncludeInPayloadReasoning = (reasoningInfo) => {
  if (!reasoningInfo?.isReasoningEnabled) return null;
  if (reasoningInfo.type === "effort_slider_value") {
    return { reasoning_effort: reasoningInfo.reasoningEffort };
  }
  return null;
};
const openAISettings = {
  modelOptions: openAIModelOptions,
  modelOptionsFallback: (modelName) => {
    const lower = modelName.toLowerCase();
    let fallbackName = null;
    if (lower.includes("o1")) {
      fallbackName = "o1";
    }
    if (lower.includes("o3-mini")) {
      fallbackName = "o3-mini";
    }
    if (lower.includes("gpt-4o")) {
      fallbackName = "gpt-4o";
    }
    if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...openAIModelOptions[fallbackName] };
    return null;
  },
  providerReasoningIOSettings: {
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning }
  }
};
const xAIModelOptions = {
  // https://docs.x.ai/docs/guides/reasoning#reasoning
  // https://docs.x.ai/docs/models#models-and-pricing
  "grok-2": {
    contextWindow: 131072,
    reservedOutputTokenSpace: null,
    cost: { input: 2, output: 10 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    specialToolFormat: "openai-style",
    reasoningCapabilities: false
  },
  "grok-3": {
    contextWindow: 131072,
    reservedOutputTokenSpace: null,
    cost: { input: 3, output: 15 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    specialToolFormat: "openai-style",
    reasoningCapabilities: false
  },
  "grok-3-fast": {
    contextWindow: 131072,
    reservedOutputTokenSpace: null,
    cost: { input: 5, output: 25 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    specialToolFormat: "openai-style",
    reasoningCapabilities: false
  },
  // only mini supports thinking
  "grok-3-mini": {
    contextWindow: 131072,
    reservedOutputTokenSpace: null,
    cost: { input: 0.3, output: 0.5 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    specialToolFormat: "openai-style",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: "effort_slider", values: ["low", "high"], default: "low" } }
  },
  "grok-3-mini-fast": {
    contextWindow: 131072,
    reservedOutputTokenSpace: null,
    cost: { input: 0.6, output: 4 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    specialToolFormat: "openai-style",
    reasoningCapabilities: { supportsReasoning: true, canTurnOffReasoning: false, canIOReasoning: false, reasoningSlider: { type: "effort_slider", values: ["low", "high"], default: "low" } }
  }
};
const xAISettings = {
  modelOptions: xAIModelOptions,
  modelOptionsFallback: (modelName) => {
    const lower = modelName.toLowerCase();
    let fallbackName = null;
    if (lower.includes("grok-2")) fallbackName = "grok-2";
    if (lower.includes("grok-3")) fallbackName = "grok-3";
    if (lower.includes("grok")) fallbackName = "grok-3";
    if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...xAIModelOptions[fallbackName] };
    return null;
  },
  // same implementation as openai
  providerReasoningIOSettings: {
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning }
  }
};
const geminiModelOptions = {
  // https://ai.google.dev/gemini-api/docs/pricing
  "gemini-2.5-flash": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.15, output: 0.6 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: true,
      canIOReasoning: false,
      reasoningSlider: { type: "budget_slider", min: 0, max: 8192, default: 0 },
      reasoningReservedOutputTokenSpace: 8192
    }
  },
  // https://ai.google.dev/gemini-api/docs/thinking#set-budget
  "gemini-2.5-pro-preview-05-06": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: true,
      canIOReasoning: false,
      reasoningSlider: { type: "budget_slider", min: 1024, max: 8192, default: 1024 },
      // max is really 24576
      reasoningReservedOutputTokenSpace: 8192
    }
  },
  "gemini-2.0-flash-lite": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: false
    // no reasoning
  },
  "gemini-2.5-flash-preview-04-17": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.15, output: 0.6 },
    // TODO $3.50 output with thinking not included
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: true,
      canIOReasoning: false,
      reasoningSlider: { type: "budget_slider", min: 1024, max: 8192, default: 1024 },
      // max is really 24576
      reasoningReservedOutputTokenSpace: 8192
    }
  },
  "gemini-2.5-pro-exp-03-25": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: true,
      canIOReasoning: false,
      reasoningSlider: { type: "budget_slider", min: 1024, max: 8192, default: 1024 },
      // max is really 24576
      reasoningReservedOutputTokenSpace: 8192
    }
  },
  "gemini-2.0-flash": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    // 8_192,
    cost: { input: 0.1, output: 0.4 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: false
  },
  "gemini-2.0-flash-lite-preview-02-05": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    // 8_192,
    cost: { input: 0.075, output: 0.3 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: false
  },
  "gemini-1.5-flash": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    // 8_192,
    cost: { input: 0.075, output: 0.3 },
    // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: false
  },
  "gemini-1.5-pro": {
    contextWindow: 2097152,
    reservedOutputTokenSpace: 8192,
    cost: { input: 1.25, output: 5 },
    // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: false
  },
  "gemini-1.5-flash-8b": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.0375, output: 0.15 },
    // TODO!!! price doubles after 128K tokens, we are NOT encoding that info right now
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "separated",
    specialToolFormat: "gemini-style",
    reasoningCapabilities: false
  }
};
const geminiSettings = {
  modelOptions: geminiModelOptions,
  modelOptionsFallback: (modelName) => {
    return null;
  }
};
const deepseekModelOptions = {
  "deepseek-chat": {
    ...openSourceModelOptions_assumingOAICompat.deepseekR1,
    contextWindow: 64e3,
    // https://api-docs.deepseek.com/quick_start/pricing
    reservedOutputTokenSpace: 8e3,
    // 8_000,
    cost: { cache_read: 0.07, input: 0.27, output: 1.1 },
    downloadable: false
  },
  "deepseek-reasoner": {
    ...openSourceModelOptions_assumingOAICompat.deepseekCoderV2,
    contextWindow: 64e3,
    reservedOutputTokenSpace: 8e3,
    // 8_000,
    cost: { cache_read: 0.14, input: 0.55, output: 2.19 },
    downloadable: false
  }
};
const deepseekSettings = {
  modelOptions: deepseekModelOptions,
  modelOptionsFallback: (modelName) => {
    return null;
  },
  providerReasoningIOSettings: {
    // reasoning: OAICompat +  response.choices[0].delta.reasoning_content // https://api-docs.deepseek.com/guides/reasoning_model
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
    output: { nameOfFieldInDelta: "reasoning_content" }
  }
};
const mistralModelOptions = {
  // https://mistral.ai/products/la-plateforme#pricing https://docs.mistral.ai/getting-started/models/models_overview/#premier-models
  "mistral-large-latest": {
    contextWindow: 131e3,
    reservedOutputTokenSpace: 8192,
    cost: { input: 2, output: 6 },
    supportsFIM: false,
    downloadable: { sizeGb: 73 },
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "mistral-medium-latest": {
    // https://openrouter.ai/mistralai/mistral-medium-3
    contextWindow: 131e3,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.4, output: 2 },
    supportsFIM: false,
    downloadable: { sizeGb: "not-known" },
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "codestral-latest": {
    contextWindow: 256e3,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.3, output: 0.9 },
    supportsFIM: true,
    downloadable: { sizeGb: 13 },
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "magistral-medium-latest": {
    contextWindow: 256e3,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.3, output: 0.9 },
    // TODO: check this
    supportsFIM: true,
    downloadable: { sizeGb: 13 },
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ["<think>", "</think>"] }
  },
  "magistral-small-latest": {
    contextWindow: 4e4,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.3, output: 0.9 },
    // TODO: check this
    supportsFIM: true,
    downloadable: { sizeGb: 13 },
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ["<think>", "</think>"] }
  },
  "devstral-small-latest": {
    //https://openrouter.ai/mistralai/devstral-small:free
    contextWindow: 131e3,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0, output: 0 },
    supportsFIM: false,
    downloadable: { sizeGb: 14 },
    //https://ollama.com/library/devstral
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "ministral-8b-latest": {
    // ollama 'mistral'
    contextWindow: 131e3,
    reservedOutputTokenSpace: 4096,
    cost: { input: 0.1, output: 0.1 },
    supportsFIM: false,
    downloadable: { sizeGb: 4.1 },
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "ministral-3b-latest": {
    contextWindow: 131e3,
    reservedOutputTokenSpace: 4096,
    cost: { input: 0.04, output: 0.04 },
    supportsFIM: false,
    downloadable: { sizeGb: "not-known" },
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  }
};
const mistralSettings = {
  modelOptions: mistralModelOptions,
  modelOptionsFallback: (modelName) => {
    return null;
  },
  providerReasoningIOSettings: {
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning }
  }
};
const groqModelOptions = {
  // https://console.groq.com/docs/models, https://groq.com/pricing/
  "llama-3.3-70b-versatile": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: 32768,
    // 32_768,
    cost: { input: 0.59, output: 0.79 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "llama-3.1-8b-instant": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0.05, output: 0.08 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "qwen-2.5-coder-32b": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: null,
    // not specified?
    cost: { input: 0.79, output: 0.79 },
    downloadable: false,
    supportsFIM: false,
    // unfortunately looks like no FIM support on groq
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "qwen-qwq-32b": {
    // https://huggingface.co/Qwen/QwQ-32B
    contextWindow: 128e3,
    reservedOutputTokenSpace: null,
    // not specified?
    cost: { input: 0.29, output: 0.39 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false, openSourceThinkTags: ["<think>", "</think>"] }
    // we're using reasoning_format:parsed so really don't need to know openSourceThinkTags
  }
};
const groqSettings = {
  modelOptions: groqModelOptions,
  modelOptionsFallback: (modelName) => {
    return null;
  },
  providerReasoningIOSettings: {
    // Must be set to either parsed or hidden when using tool calling https://console.groq.com/docs/reasoning
    input: {
      includeInPayload: (reasoningInfo) => {
        if (!reasoningInfo?.isReasoningEnabled) return null;
        if (reasoningInfo.type === "budget_slider_value") {
          return { reasoning_format: "parsed" };
        }
        return null;
      }
    },
    output: { nameOfFieldInDelta: "reasoning" }
  }
};
const googleVertexModelOptions = {
  "gemini-2.5-flash": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: 65536,
    cost: { input: 0.15, output: 0.6 },
    specialToolFormat: "gemini-style",
    reasoningCapabilities: {
      canIOReasoning: true
    }
  }
};
const googleVertexSettings = {
  modelOptions: googleVertexModelOptions,
  modelOptionsFallback: (modelName) => {
    if (modelName.startsWith("gemini-")) {
      return {
        modelName: "gemini-2.5-flash",
        contextWindow: 1048576,
        reservedOutputTokenSpace: 65536,
        cost: { input: 0.15, output: 0.6 },
        specialToolFormat: "gemini-style",
        recognizedModelName: "gemini-2.5-flash",
        isUnrecognizedModel: false
      };
    }
    return null;
  },
  providerReasoningIOSettings: {
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning }
  }
};
const microsoftAzureModelOptions = {};
const microsoftAzureSettings = {
  modelOptions: microsoftAzureModelOptions,
  modelOptionsFallback: (modelName) => {
    return null;
  },
  providerReasoningIOSettings: {
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning }
  }
};
const awsBedrockModelOptions = {};
const awsBedrockSettings = {
  modelOptions: awsBedrockModelOptions,
  modelOptionsFallback: (modelName) => {
    return null;
  },
  providerReasoningIOSettings: {
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning }
  }
};
const ollamaModelOptions = {
  "qwen2.5-coder:7b": {
    contextWindow: 32e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: { sizeGb: 1.9 },
    supportsFIM: true,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "qwen2.5-coder:3b": {
    contextWindow: 32e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: { sizeGb: 1.9 },
    supportsFIM: true,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "qwen2.5-coder:1.5b": {
    contextWindow: 32e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: { sizeGb: 0.986 },
    supportsFIM: true,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "llama3.1": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: { sizeGb: 4.9 },
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "qwen2.5-coder": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: { sizeGb: 4.7 },
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "qwq": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: 32e3,
    cost: { input: 0, output: 0 },
    downloadable: { sizeGb: 20 },
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false, openSourceThinkTags: ["<think>", "</think>"] }
  },
  "deepseek-r1": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: { sizeGb: 4.7 },
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, canTurnOffReasoning: false, openSourceThinkTags: ["<think>", "</think>"] }
  },
  "devstral:latest": {
    contextWindow: 131e3,
    reservedOutputTokenSpace: 8192,
    cost: { input: 0, output: 0 },
    downloadable: { sizeGb: 14 },
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  }
};
const ollamaRecommendedModels = ["qwen2.5-coder:1.5b", "llama3.1", "qwq", "deepseek-r1", "devstral:latest"];
const vLLMSettings = {
  modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: "not-known" } }),
  modelOptions: {},
  providerReasoningIOSettings: {
    // reasoning: OAICompat + response.choices[0].delta.reasoning_content // https://docs.vllm.ai/en/stable/features/reasoning_outputs.html#streaming-chat-completions
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
    output: { nameOfFieldInDelta: "reasoning_content" }
  }
};
const lmStudioSettings = {
  modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: "not-known" }, contextWindow: 4096 }),
  modelOptions: {},
  providerReasoningIOSettings: {
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
    output: { needsManualParse: true }
  }
};
const ollamaSettings = {
  modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: "not-known" } }),
  modelOptions: ollamaModelOptions,
  providerReasoningIOSettings: {
    // reasoning: we need to filter out reasoning <think> tags manually
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
    output: { needsManualParse: true }
  }
};
const openaiCompatible = {
  modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName),
  modelOptions: {},
  providerReasoningIOSettings: {
    // reasoning: we have no idea what endpoint they used, so we can't consistently parse out reasoning
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
    output: { nameOfFieldInDelta: "reasoning_content" }
  }
};
const liteLLMSettings = {
  // https://docs.litellm.ai/docs/reasoning_content
  modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: "not-known" } }),
  modelOptions: {},
  providerReasoningIOSettings: {
    input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
    output: { nameOfFieldInDelta: "reasoning_content" }
  }
};
const openRouterModelOptions_assumingOpenAICompat = {
  "qwen/qwen3-235b-a22b": {
    contextWindow: 40960,
    reservedOutputTokenSpace: null,
    cost: { input: 0.1, output: 0.1 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false }
  },
  "microsoft/phi-4-reasoning-plus:free": {
    // a 14B model...
    contextWindow: 32768,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, canTurnOffReasoning: false }
  },
  "mistralai/mistral-small-3.1-24b-instruct:free": {
    contextWindow: 128e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "google/gemini-2.0-flash-lite-preview-02-05:free": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "google/gemini-2.0-pro-exp-02-05:free": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "google/gemini-2.0-flash-exp:free": {
    contextWindow: 1048576,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "deepseek/deepseek-r1": {
    ...openSourceModelOptions_assumingOAICompat.deepseekR1,
    contextWindow: 128e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0.8, output: 2.4 },
    downloadable: false
  },
  "anthropic/claude-opus-4": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: null,
    cost: { input: 15, output: 75 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "anthropic/claude-sonnet-4": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: null,
    cost: { input: 15, output: 75 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "anthropic/claude-3.7-sonnet:thinking": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: null,
    cost: { input: 3, output: 15 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: {
      // same as anthropic, see above
      supportsReasoning: true,
      canTurnOffReasoning: false,
      canIOReasoning: true,
      reasoningReservedOutputTokenSpace: 8192,
      reasoningSlider: { type: "budget_slider", min: 1024, max: 8192, default: 1024 }
      // they recommend batching if max > 32_000.
    }
  },
  "anthropic/claude-3.7-sonnet": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: null,
    cost: { input: 3, output: 15 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
    // stupidly, openrouter separates thinking from non-thinking
  },
  "anthropic/claude-3.5-sonnet": {
    contextWindow: 2e5,
    reservedOutputTokenSpace: null,
    cost: { input: 3, output: 15 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false
  },
  "mistralai/codestral-2501": {
    ...openSourceModelOptions_assumingOAICompat.codestral,
    contextWindow: 256e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0.3, output: 0.9 },
    downloadable: false,
    reasoningCapabilities: false
  },
  "mistralai/devstral-small:free": {
    ...openSourceModelOptions_assumingOAICompat.devstral,
    contextWindow: 13e4,
    reservedOutputTokenSpace: null,
    cost: { input: 0, output: 0 },
    downloadable: false,
    reasoningCapabilities: false
  },
  "qwen/qwen-2.5-coder-32b-instruct": {
    ...openSourceModelOptions_assumingOAICompat["qwen2.5coder"],
    contextWindow: 33e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0.07, output: 0.16 },
    downloadable: false
  },
  "qwen/qwq-32b": {
    ...openSourceModelOptions_assumingOAICompat["qwq"],
    contextWindow: 33e3,
    reservedOutputTokenSpace: null,
    cost: { input: 0.07, output: 0.16 },
    downloadable: false
  }
};
const openRouterSettings = {
  modelOptions: openRouterModelOptions_assumingOpenAICompat,
  modelOptionsFallback: (modelName) => {
    const res = extensiveModelOptionsFallback(modelName);
    if (res?.specialToolFormat === "gemini-style") {
      res.specialToolFormat = "openai-style";
    }
    return res;
  },
  providerReasoningIOSettings: {
    // reasoning: OAICompat + response.choices[0].delta.reasoning : payload should have {include_reasoning: true} https://openrouter.ai/announcements/reasoning-tokens-for-thinking-models
    input: {
      // https://openrouter.ai/docs/use-cases/reasoning-tokens
      includeInPayload: (reasoningInfo) => {
        if (!reasoningInfo?.isReasoningEnabled) return null;
        if (reasoningInfo.type === "budget_slider_value") {
          return {
            reasoning: {
              max_tokens: reasoningInfo.reasoningBudget
            }
          };
        }
        if (reasoningInfo.type === "effort_slider_value")
          return {
            reasoning: {
              effort: reasoningInfo.reasoningEffort
            }
          };
        return null;
      }
    },
    output: { nameOfFieldInDelta: "reasoning" }
  }
};
const modelSettingsOfProvider = {
  googleVertex: googleVertexSettings
};
const getModelCapabilities = (providerName, modelName, overridesOfModel) => {
  const lowercaseModelName = modelName.toLowerCase();
  const { modelOptions, modelOptionsFallback } = modelSettingsOfProvider[providerName];
  const overrides = overridesOfModel?.[providerName]?.[modelName];
  for (const modelName_ in modelOptions) {
    const lowercaseModelName_ = modelName_.toLowerCase();
    if (lowercaseModelName === lowercaseModelName_) {
      return { ...modelOptions[modelName], ...overrides, modelName, recognizedModelName: modelName, isUnrecognizedModel: false };
    }
  }
  const result = modelOptionsFallback(modelName);
  if (result) {
    return { ...result, ...overrides, modelName: result.modelName, isUnrecognizedModel: false };
  }
  return { modelName, ...defaultModelOptions, ...overrides, isUnrecognizedModel: true };
};
const getProviderCapabilities = (providerName) => {
  const { providerReasoningIOSettings } = modelSettingsOfProvider[providerName];
  return { providerReasoningIOSettings };
};
const getIsReasoningEnabledState = (featureName, providerName, modelName, modelSelectionOptions, overridesOfModel) => {
  const { supportsReasoning, canTurnOffReasoning } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {};
  if (!supportsReasoning) return false;
  const defaultEnabledVal = featureName === "Chat" || !canTurnOffReasoning;
  const isReasoningEnabled = modelSelectionOptions?.reasoningEnabled ?? defaultEnabledVal;
  return isReasoningEnabled;
};
const getReservedOutputTokenSpace = (providerName, modelName, opts) => {
  const {
    reasoningCapabilities,
    reservedOutputTokenSpace
  } = getModelCapabilities(providerName, modelName, opts.overridesOfModel);
  return opts.isReasoningEnabled && reasoningCapabilities ? reasoningCapabilities.reasoningReservedOutputTokenSpace : reservedOutputTokenSpace;
};
const getSendableReasoningInfo = (featureName, providerName, modelName, modelSelectionOptions, overridesOfModel) => {
  const { reasoningSlider: reasoningBudgetSlider } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {};
  const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel);
  if (!isReasoningEnabled) return null;
  const reasoningBudget = reasoningBudgetSlider?.type === "budget_slider" ? modelSelectionOptions?.reasoningBudget ?? reasoningBudgetSlider?.default : void 0;
  if (reasoningBudget) {
    return { type: "budget_slider_value", isReasoningEnabled, reasoningBudget };
  }
  const reasoningEffort = reasoningBudgetSlider?.type === "effort_slider" ? modelSelectionOptions?.reasoningEffort ?? reasoningBudgetSlider?.default : void 0;
  if (reasoningEffort) {
    return { type: "effort_slider_value", isReasoningEnabled, reasoningEffort };
  }
  return null;
};
export {
  defaultModelsOfProvider,
  defaultProviderSettings,
  getIsReasoningEnabledState,
  getModelCapabilities,
  getProviderCapabilities,
  getReservedOutputTokenSpace,
  getSendableReasoningInfo,
  modelOverrideKeys,
  ollamaRecommendedModels
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2NvbW1vbi9tb2RlbENhcGFiaWxpdGllcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAyMDI1IEdsYXNzIERldnRvb2xzLCBJbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMC4gU2VlIExJQ0VOU0UudHh0IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEZlYXR1cmVOYW1lLCBNb2RlbFNlbGVjdGlvbk9wdGlvbnMsIE92ZXJyaWRlc09mTW9kZWwsIFByb3ZpZGVyTmFtZSB9IGZyb20gJy4vdm9pZFNldHRpbmdzVHlwZXMuanMnO1xuXG5cblxuXG5cbmV4cG9ydCBjb25zdCBkZWZhdWx0UHJvdmlkZXJTZXR0aW5ncyA9IHtcblx0Z29vZ2xlVmVydGV4OiB7XG5cdFx0cmVnaW9uOiAndXMtY2VudHJhbDEnLFxuXHRcdHByb2plY3Q6ICcnLFxuXHR9LFxuXG59IGFzIGNvbnN0XG5cblxuXG5cbmV4cG9ydCBjb25zdCBkZWZhdWx0TW9kZWxzT2ZQcm92aWRlciA9IHtcblx0Z29vZ2xlVmVydGV4OiBbXG5cdFx0J2dlbWluaS0yLjUtZmxhc2gnLFxuXHRdLFxuXG59IGFzIGNvbnN0IHNhdGlzZmllcyBSZWNvcmQ8UHJvdmlkZXJOYW1lLCBzdHJpbmdbXT5cblxuXG5cbmV4cG9ydCB0eXBlIFZvaWRTdGF0aWNNb2RlbEluZm8gPSB7IC8vIG5vdCBzdGF0ZWZ1bFxuXHQvLyBWb2lkIHVzZXMgdGhlIGluZm9ybWF0aW9uIGJlbG93IHRvIGtub3cgaG93IHRvIGhhbmRsZSBlYWNoIG1vZGVsLlxuXHQvLyBmb3Igc29tZSBleGFtcGxlcywgc2VlIG9wZW5BSU1vZGVsT3B0aW9ucyBhbmQgYW50aHJvcGljTW9kZWxPcHRpb25zIChiZWxvdykuXG5cblx0Y29udGV4dFdpbmRvdzogbnVtYmVyOyAvLyBpbnB1dCB0b2tlbnNcblx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudW1iZXIgfCBudWxsOyAvLyByZXNlcnZlIHRoaXMgbXVjaCBzcGFjZSBpbiB0aGUgY29udGV4dCB3aW5kb3cgZm9yIG91dHB1dCwgZGVmYXVsdHMgdG8gNDA5NiBpZiBudWxsXG5cblx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiBmYWxzZSB8ICdzeXN0ZW0tcm9sZScgfCAnZGV2ZWxvcGVyLXJvbGUnIHwgJ3NlcGFyYXRlZCc7IC8vIHR5cGljYWxseSB5b3Ugc2hvdWxkIHVzZSAnc3lzdGVtLXJvbGUnLiAnc2VwYXJhdGVkJyBtZWFucyB0aGUgc3lzdGVtIG1lc3NhZ2UgaXMgcGFzc2VkIGFzIGEgc2VwYXJhdGUgZmllbGQgKGUuZy4gYW50aHJvcGljKVxuXHRzcGVjaWFsVG9vbEZvcm1hdD86ICdvcGVuYWktc3R5bGUnIHwgJ2FudGhyb3BpYy1zdHlsZScgfCAnZ2VtaW5pLXN0eWxlJywgLy8gdHlwaWNhbGx5IHlvdSBzaG91bGQgdXNlICdvcGVuYWktc3R5bGUnLiBudWxsIG1lYW5zIFwiY2FuJ3QgY2FsbCB0b29scyBieSBkZWZhdWx0XCIsIGFuZCBhc2tzIHRoZSBMTE0gdG8gb3V0cHV0IFhNTCBpbiBhZ2VudCBtb2RlXG5cdHN1cHBvcnRzRklNOiBib29sZWFuOyAvLyB3aGV0aGVyIHRoZSBtb2RlbCB3YXMgc3BlY2lmaWNhbGx5IGRlc2lnbmVkIGZvciBhdXRvY29tcGxldGUgb3IgXCJGSU1cIiAoXCJmaWxsLWluLW1pZGRsZVwiIGZvcm1hdClcblxuXHRhZGRpdGlvbmFsT3BlbkFJUGF5bG9hZD86IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gLy8gYWRkaXRpb25hbCBwYXlsb2FkIGluIHRoZSBtZXNzYWdlIGJvZHkgZm9yIHJlcXVlc3RzIHRoYXQgYXJlIG9wZW5haS1jb21wYXRpYmxlIChvbGxhbWEsIHZsbG0sIG9wZW5haSwgb3BlbnJvdXRlciwgZXRjKVxuXG5cdC8vIHJlYXNvbmluZyBvcHRpb25zXG5cdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UgfCB7XG5cdFx0cmVhZG9ubHkgc3VwcG9ydHNSZWFzb25pbmc6IHRydWU7IC8vIGZvciBjbGFyaXR5LCB0aGlzIG11c3QgYmUgdHJ1ZSBpZiBhbnl0aGluZyBiZWxvdyBpcyBzcGVjaWZpZWRcblx0XHRyZWFkb25seSBjYW5UdXJuT2ZmUmVhc29uaW5nOiBib29sZWFuOyAvLyB3aGV0aGVyIG9yIG5vdCB0aGUgdXNlciBjYW4gZGlzYWJsZSByZWFzb25pbmcgbW9kZSAoZmFsc2UgaWYgdGhlIG1vZGVsIG9ubHkgc3VwcG9ydHMgcmVhc29uaW5nKVxuXHRcdHJlYWRvbmx5IGNhbklPUmVhc29uaW5nOiBib29sZWFuOyAvLyB3aGV0aGVyIG9yIG5vdCB0aGUgbW9kZWwgYWN0dWFsbHkgb3V0cHV0cyByZWFzb25pbmcgKGVnIG8xIGxldHMgdXMgY29udHJvbCByZWFzb25pbmcgYnV0IG5vdCBvdXRwdXQgaXQpXG5cdFx0cmVhZG9ubHkgcmVhc29uaW5nUmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlPzogbnVtYmVyOyAvLyBvdmVycmlkZXMgbm9ybWFsIHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZVxuXHRcdHJlYWRvbmx5IHJlYXNvbmluZ1NsaWRlcj86XG5cdFx0fCB1bmRlZmluZWRcblx0XHR8IHsgdHlwZTogJ2J1ZGdldF9zbGlkZXInOyBtaW46IG51bWJlcjsgbWF4OiBudW1iZXI7IGRlZmF1bHQ6IG51bWJlciB9IC8vIGFudGhyb3BpYyBzdXBwb3J0cyB0aGlzIChyZWFzb25pbmcgYnVkZ2V0KVxuXHRcdHwgeyB0eXBlOiAnZWZmb3J0X3NsaWRlcic7IHZhbHVlczogc3RyaW5nW107IGRlZmF1bHQ6IHN0cmluZyB9IC8vIG9wZW5haS1jb21wYXRpYmxlIHN1cHBvcnRzIHRoaXMgKHJlYXNvbmluZyBlZmZvcnQpXG5cblx0XHQvLyBpZiBpdCdzIG9wZW4gc291cmNlIGFuZCBzcGVjaWZpY2FsbHkgb3V0cHV0cyB0aGluayB0YWdzLCBwdXQgdGhlIHRoaW5rIHRhZ3MgaGVyZSBhbmQgd2UnbGwgcGFyc2UgdGhlbSBvdXQgKGUuZy4gb2xsYW1hKVxuXHRcdHJlYWRvbmx5IG9wZW5Tb3VyY2VUaGlua1RhZ3M/OiBbc3RyaW5nLCBzdHJpbmddO1xuXG5cdFx0Ly8gdGhlIG9ubHkgb3RoZXIgZmllbGQgcmVsYXRlZCB0byByZWFzb25pbmcgaXMgXCJwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3NcIiwgd2hpY2ggdmFyaWVzIGJ5IHByb3ZpZGVyLlxuXHR9O1xuXG5cblx0Ly8gLS0tIGJlbG93IGlzIGp1c3QgaW5mb3JtYXRpdmUsIG5vdCB1c2VkIGluIHNlbmRpbmcgLyByZWNlaXZpbmcsIGNhbm5vdCBiZSBjdXN0b21pemVkIGluIHNldHRpbmdzIC0tLVxuXHRjb3N0OiB7XG5cdFx0aW5wdXQ6IG51bWJlcjtcblx0XHRvdXRwdXQ6IG51bWJlcjtcblx0XHRjYWNoZV9yZWFkPzogbnVtYmVyO1xuXHRcdGNhY2hlX3dyaXRlPzogbnVtYmVyO1xuXHR9XG5cdGRvd25sb2FkYWJsZTogZmFsc2UgfCB7XG5cdFx0c2l6ZUdiOiBudW1iZXIgfCAnbm90LWtub3duJ1xuXHR9XG59XG4vLyBpZiB5b3UgY2hhbmdlIHRoZSBhYm92ZSB0eXBlLCByZW1lbWJlciB0byB1cGRhdGUgdGhlIFNldHRpbmdzIGxpbmtcblxuXG5cbmV4cG9ydCBjb25zdCBtb2RlbE92ZXJyaWRlS2V5cyA9IFtcblx0J2NvbnRleHRXaW5kb3cnLFxuXHQncmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlJyxcblx0J3N1cHBvcnRzU3lzdGVtTWVzc2FnZScsXG5cdCdzcGVjaWFsVG9vbEZvcm1hdCcsXG5cdCdzdXBwb3J0c0ZJTScsXG5cdCdyZWFzb25pbmdDYXBhYmlsaXRpZXMnLFxuXHQnYWRkaXRpb25hbE9wZW5BSVBheWxvYWQnXG5dIGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIE1vZGVsT3ZlcnJpZGVzID0gUGljazxcblx0Vm9pZFN0YXRpY01vZGVsSW5mbyxcblx0KHR5cGVvZiBtb2RlbE92ZXJyaWRlS2V5cylbbnVtYmVyXVxuPlxuXG5cblxuXG50eXBlIFByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5ncyA9IHtcblx0Ly8gaW5jbHVkZSB0aGlzIGluIHBheWxvYWQgdG8gZ2V0IHJlYXNvbmluZ1xuXHRpbnB1dD86IHsgaW5jbHVkZUluUGF5bG9hZD86IChyZWFzb25pbmdTdGF0ZTogU2VuZGFibGVSZWFzb25pbmdJbmZvKSA9PiBudWxsIHwgeyBba2V5OiBzdHJpbmddOiBhbnkgfSwgfTtcblx0Ly8gbmFtZU9mRmllbGRJbkRlbHRhOiByZWFzb25pbmcgb3V0cHV0IGlzIGluIHJlc3BvbnNlLmNob2ljZXNbMF0uZGVsdGFbZGVsdGFSZWFzb25pbmdGaWVsZF1cblx0Ly8gbmVlZHNNYW51YWxQYXJzZTogd2hldGhlciB3ZSBtdXN0IG1hbnVhbGx5IHBhcnNlIG91dCB0aGUgPHRoaW5rPiB0YWdzXG5cdG91dHB1dD86XG5cdHwgeyBuYW1lT2ZGaWVsZEluRGVsdGE/OiBzdHJpbmcsIG5lZWRzTWFudWFsUGFyc2U/OiB1bmRlZmluZWQsIH1cblx0fCB7IG5hbWVPZkZpZWxkSW5EZWx0YT86IHVuZGVmaW5lZCwgbmVlZHNNYW51YWxQYXJzZT86IHRydWUsIH07XG59XG5cbnR5cGUgVm9pZFN0YXRpY1Byb3ZpZGVySW5mbyA9IHsgLy8gZG9lc24ndCBjaGFuZ2UgKG5vdCBzdGF0ZWZ1bClcblx0cHJvdmlkZXJSZWFzb25pbmdJT1NldHRpbmdzPzogUHJvdmlkZXJSZWFzb25pbmdJT1NldHRpbmdzOyAvLyBpbnB1dC9vdXRwdXQgc2V0dGluZ3MgYXJvdW5kIHRoaW5raW5nIChhbGxvd2VkIHRvIGJlIGVtcHR5KSAtIG9ubHkgYXBwbGllZCBpZiB0aGUgbW9kZWwgc3VwcG9ydHMgcmVhc29uaW5nIG91dHB1dFxuXHRtb2RlbE9wdGlvbnM6IHsgW2tleTogc3RyaW5nXTogVm9pZFN0YXRpY01vZGVsSW5mbyB9O1xuXHRtb2RlbE9wdGlvbnNGYWxsYmFjazogKG1vZGVsTmFtZTogc3RyaW5nLCBmYWxsYmFja0tub3duVmFsdWVzPzogUGFydGlhbDxWb2lkU3RhdGljTW9kZWxJbmZvPikgPT4gKFZvaWRTdGF0aWNNb2RlbEluZm8gJiB7IG1vZGVsTmFtZTogc3RyaW5nLCByZWNvZ25pemVkTW9kZWxOYW1lOiBzdHJpbmcgfSkgfCBudWxsO1xufVxuXG5cblxuY29uc3QgZGVmYXVsdE1vZGVsT3B0aW9ucyA9IHtcblx0Y29udGV4dFdpbmRvdzogNF8wOTYsXG5cdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogNF8wOTYsXG5cdGNvc3Q6IHsgaW5wdXQ6IDAsIG91dHB1dDogMCB9LFxuXHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6IGZhbHNlLFxuXHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG59IGFzIGNvbnN0IHNhdGlzZmllcyBWb2lkU3RhdGljTW9kZWxJbmZvXG5cbi8vIFRPRE8hISEgZG91YmxlIGNoZWNrIGFsbCBjb250ZXh0IHNpemVzIGJlbG93XG4vLyBUT0RPISEhIGFkZCBvcGVucm91dGVyIGNvbW1vbiBtb2RlbHNcbi8vIFRPRE8hISEgYWxsb3cgdXNlciB0byBtb2RpZnkgY2FwYWJpbGl0aWVzIGFuZCB0ZWxsIHRoZW0gaWYgYXV0b2RldGVjdGVkIG1vZGVsIG9yIGZhbGxpbmcgYmFja1xuY29uc3Qgb3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCA9IHtcblx0J2RlZXBzZWVrUjEnOiB7XG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogZmFsc2UsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5UdXJuT2ZmUmVhc29uaW5nOiBmYWxzZSwgY2FuSU9SZWFzb25pbmc6IHRydWUsIG9wZW5Tb3VyY2VUaGlua1RhZ3M6IFsnPHRoaW5rPicsICc8L3RoaW5rPiddIH0sXG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXHQnZGVlcHNlZWtDb2RlclYzJzoge1xuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6IGZhbHNlLCAvLyB1bnN0YWJsZVxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXHQnZGVlcHNlZWtDb2RlclYyJzoge1xuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6IGZhbHNlLCAvLyB1bnN0YWJsZVxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXHQnY29kZXN0cmFsJzoge1xuXHRcdHN1cHBvcnRzRklNOiB0cnVlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHRcdGNvbnRleHRXaW5kb3c6IDMyXzAwMCwgcmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA0XzA5Nixcblx0fSxcblx0J2RldnN0cmFsJzoge1xuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0XHRjb250ZXh0V2luZG93OiAxMzFfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHR9LFxuXHQnb3BlbmhhbmRzLWxtLTMyYic6IHsgLy8gaHR0cHM6Ly93d3cuYWxsLWhhbmRzLmRldi9ibG9nL2ludHJvZHVjaW5nLW9wZW5oYW5kcy1sbS0zMmItLS0tYS1zdHJvbmctb3Blbi1jb2RpbmctYWdlbnQtbW9kZWxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsIC8vIGJ1aWx0IG9uIHF3ZW4gMi41IDMyQiBpbnN0cnVjdFxuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsIHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogNF8wOTZcblx0fSxcblxuXHQvLyByZWFsbHkgb25seSBwaGk0LXJlYXNvbmluZyBzdXBwb3J0cyByZWFzb25pbmcuLi4gc2ltcGxlciB0byBjb21iaW5lIHRoZW0gdGhvdWdoXG5cdCdwaGk0Jzoge1xuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5UdXJuT2ZmUmVhc29uaW5nOiB0cnVlLCBjYW5JT1JlYXNvbmluZzogdHJ1ZSwgb3BlblNvdXJjZVRoaW5rVGFnczogWyc8dGhpbms+JywgJzwvdGhpbms+J10gfSxcblx0XHRjb250ZXh0V2luZG93OiAxNl8wMDAsIHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogNF8wOTYsXG5cdH0sXG5cblx0J2dlbW1hJzogeyAvLyBodHRwczovL25ld3MueWNvbWJpbmF0b3IuY29tL2l0ZW0/aWQ9NDM0NTE0MDZcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXHQvLyBsbGFtYSA0IGh0dHBzOi8vYWkubWV0YS5jb20vYmxvZy9sbGFtYS00LW11bHRpbW9kYWwtaW50ZWxsaWdlbmNlL1xuXHQnbGxhbWE0LXNjb3V0Jzoge1xuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0XHRjb250ZXh0V2luZG93OiAxMF8wMDBfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXHQnbGxhbWE0LW1hdmVyaWNrJzoge1xuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0XHRjb250ZXh0V2luZG93OiAxMF8wMDBfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXG5cdC8vIGxsYW1hIDNcblx0J2xsYW1hMyc6IHtcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXHQnbGxhbWEzLjEnOiB7XG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHRcdGNvbnRleHRXaW5kb3c6IDMyXzAwMCwgcmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA0XzA5Nixcblx0fSxcblx0J2xsYW1hMy4yJzoge1xuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0XHRjb250ZXh0V2luZG93OiAzMl8wMDAsIHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogNF8wOTYsXG5cdH0sXG5cdCdsbGFtYTMuMyc6IHtcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXHQvLyBxd2VuXG5cdCdxd2VuMi41Y29kZXInOiB7XG5cdFx0c3VwcG9ydHNGSU06IHRydWUsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHR9LFxuXHQncXdxJzoge1xuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSwgLy8gbm8gRklNLCB5ZXMgcmVhc29uaW5nXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogeyBzdXBwb3J0c1JlYXNvbmluZzogdHJ1ZSwgY2FuVHVybk9mZlJlYXNvbmluZzogZmFsc2UsIGNhbklPUmVhc29uaW5nOiB0cnVlLCBvcGVuU291cmNlVGhpbmtUYWdzOiBbJzx0aGluaz4nLCAnPC90aGluaz4nXSB9LFxuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsIHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogOF8xOTIsXG5cdH0sXG5cdCdxd2VuMyc6IHtcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsIC8vIHJlcGxhY2VzIFF3UVxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IHsgc3VwcG9ydHNSZWFzb25pbmc6IHRydWUsIGNhblR1cm5PZmZSZWFzb25pbmc6IHRydWUsIGNhbklPUmVhc29uaW5nOiB0cnVlLCBvcGVuU291cmNlVGhpbmtUYWdzOiBbJzx0aGluaz4nLCAnPC90aGluaz4nXSB9LFxuXHRcdGNvbnRleHRXaW5kb3c6IDMyXzc2OCwgcmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5Mixcblx0fSxcblx0Ly8gRklNIG9ubHlcblx0J3N0YXJjb2RlcjInOiB7XG5cdFx0c3VwcG9ydHNGSU06IHRydWUsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiBmYWxzZSxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsIHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogOF8xOTIsXG5cblx0fSxcblx0J2NvZGVnZW1tYToyYic6IHtcblx0XHRzdXBwb3J0c0ZJTTogdHJ1ZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6IGZhbHNlLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdFx0Y29udGV4dFdpbmRvdzogMTI4XzAwMCwgcmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5MixcblxuXHR9LFxuXHQncXVhc2FyJzogeyAvLyBvcGVucm91dGVyL3F1YXNhci1hbHBoYVxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0XHRjb250ZXh0V2luZG93OiAxXzAwMF8wMDAsIHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogMzJfMDAwLFxuXHR9XG59IGFzIGNvbnN0IHNhdGlzZmllcyB7IFtzOiBzdHJpbmddOiBQYXJ0aWFsPFZvaWRTdGF0aWNNb2RlbEluZm8+IH1cblxuXG5cblxuLy8ga2VlcCBtb2RlbE5hbWUsIGJ1dCB1c2UgdGhlIGZhbGxiYWNrJ3MgZGVmYXVsdHNcbmNvbnN0IGV4dGVuc2l2ZU1vZGVsT3B0aW9uc0ZhbGxiYWNrOiBWb2lkU3RhdGljUHJvdmlkZXJJbmZvWydtb2RlbE9wdGlvbnNGYWxsYmFjayddID0gKG1vZGVsTmFtZSwgZmFsbGJhY2tLbm93blZhbHVlcykgPT4ge1xuXG5cdGNvbnN0IGxvd2VyID0gbW9kZWxOYW1lLnRvTG93ZXJDYXNlKClcblxuXHRjb25zdCB0b0ZhbGxiYWNrID0gPFQgZXh0ZW5kcyB7IFtzOiBzdHJpbmddOiBPbWl0PFZvaWRTdGF0aWNNb2RlbEluZm8sICdjb3N0JyB8ICdkb3dubG9hZGFibGUnPiB9LD4ob2JqOiBULCByZWNvZ25pemVkTW9kZWxOYW1lOiBzdHJpbmcgJiBrZXlvZiBUKVxuXHRcdDogVm9pZFN0YXRpY01vZGVsSW5mbyAmIHsgbW9kZWxOYW1lOiBzdHJpbmcsIHJlY29nbml6ZWRNb2RlbE5hbWU6IHN0cmluZyB9ID0+IHtcblxuXHRcdGNvbnN0IG9wdHMgPSBvYmpbcmVjb2duaXplZE1vZGVsTmFtZV1cblx0XHRjb25zdCBzdXBwb3J0c1N5c3RlbU1lc3NhZ2UgPSBvcHRzLnN1cHBvcnRzU3lzdGVtTWVzc2FnZSA9PT0gJ3NlcGFyYXRlZCdcblx0XHRcdD8gJ3N5c3RlbS1yb2xlJ1xuXHRcdFx0OiBvcHRzLnN1cHBvcnRzU3lzdGVtTWVzc2FnZVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlY29nbml6ZWRNb2RlbE5hbWUsXG5cdFx0XHRtb2RlbE5hbWUsXG5cdFx0XHQuLi5vcHRzLFxuXHRcdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiBzdXBwb3J0c1N5c3RlbU1lc3NhZ2UsXG5cdFx0XHRjb3N0OiB7IGlucHV0OiAwLCBvdXRwdXQ6IDAgfSxcblx0XHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0XHQuLi5mYWxsYmFja0tub3duVmFsdWVzXG5cdFx0fTtcblx0fVxuXG5cdGlmIChsb3dlci5pbmNsdWRlcygnZ2VtaW5pJykgJiYgKGxvd2VyLmluY2x1ZGVzKCcyLjUnKSB8fCBsb3dlci5pbmNsdWRlcygnMi01JykpKSByZXR1cm4gdG9GYWxsYmFjayhnZW1pbmlNb2RlbE9wdGlvbnMsICdnZW1pbmktMi41LXByby1leHAtMDMtMjUnKVxuXG5cdGlmIChsb3dlci5pbmNsdWRlcygnY2xhdWRlLTMtNScpIHx8IGxvd2VyLmluY2x1ZGVzKCdjbGF1ZGUtMy41JykpIHJldHVybiB0b0ZhbGxiYWNrKGFudGhyb3BpY01vZGVsT3B0aW9ucywgJ2NsYXVkZS0zLTUtc29ubmV0LTIwMjQxMDIyJylcblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdjbGF1ZGUnKSkgcmV0dXJuIHRvRmFsbGJhY2soYW50aHJvcGljTW9kZWxPcHRpb25zLCAnY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTknKVxuXG5cdGlmIChsb3dlci5pbmNsdWRlcygnZ3JvazInKSB8fCBsb3dlci5pbmNsdWRlcygnZ3JvazInKSkgcmV0dXJuIHRvRmFsbGJhY2soeEFJTW9kZWxPcHRpb25zLCAnZ3Jvay0yJylcblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdncm9rJykpIHJldHVybiB0b0ZhbGxiYWNrKHhBSU1vZGVsT3B0aW9ucywgJ2dyb2stMycpXG5cblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdkZWVwc2Vlay1yMScpIHx8IGxvd2VyLmluY2x1ZGVzKCdkZWVwc2Vlay1yZWFzb25lcicpKSByZXR1cm4gdG9GYWxsYmFjayhvcGVuU291cmNlTW9kZWxPcHRpb25zX2Fzc3VtaW5nT0FJQ29tcGF0LCAnZGVlcHNlZWtSMScpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnZGVlcHNlZWsnKSAmJiBsb3dlci5pbmNsdWRlcygndjInKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2RlZXBzZWVrQ29kZXJWMicpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnZGVlcHNlZWsnKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2RlZXBzZWVrQ29kZXJWMycpXG5cblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdsbGFtYTMnKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2xsYW1hMycpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnbGxhbWEzLjEnKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2xsYW1hMy4xJylcblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdsbGFtYTMuMicpKSByZXR1cm4gdG9GYWxsYmFjayhvcGVuU291cmNlTW9kZWxPcHRpb25zX2Fzc3VtaW5nT0FJQ29tcGF0LCAnbGxhbWEzLjInKVxuXHRpZiAobG93ZXIuaW5jbHVkZXMoJ2xsYW1hMy4zJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5Tb3VyY2VNb2RlbE9wdGlvbnNfYXNzdW1pbmdPQUlDb21wYXQsICdsbGFtYTMuMycpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnbGxhbWEnKSB8fCBsb3dlci5pbmNsdWRlcygnc2NvdXQnKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2xsYW1hNC1zY291dCcpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnbGxhbWEnKSB8fCBsb3dlci5pbmNsdWRlcygnbWF2ZXJpY2snKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2xsYW1hNC1zY291dCcpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnbGxhbWEnKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2xsYW1hNC1zY291dCcpXG5cblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdxd2VuJykgJiYgbG93ZXIuaW5jbHVkZXMoJzIuNScpICYmIGxvd2VyLmluY2x1ZGVzKCdjb2RlcicpKSByZXR1cm4gdG9GYWxsYmFjayhvcGVuU291cmNlTW9kZWxPcHRpb25zX2Fzc3VtaW5nT0FJQ29tcGF0LCAncXdlbjIuNWNvZGVyJylcblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdxd2VuJykgJiYgbG93ZXIuaW5jbHVkZXMoJzMnKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ3F3ZW4zJylcblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdxd2VuJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5Tb3VyY2VNb2RlbE9wdGlvbnNfYXNzdW1pbmdPQUlDb21wYXQsICdxd2VuMycpXG5cdGlmIChsb3dlci5pbmNsdWRlcygncXdxJykpIHsgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ3F3cScpIH1cblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdwaGk0JykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5Tb3VyY2VNb2RlbE9wdGlvbnNfYXNzdW1pbmdPQUlDb21wYXQsICdwaGk0Jylcblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdjb2Rlc3RyYWwnKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2NvZGVzdHJhbCcpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnZGV2c3RyYWwnKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdCwgJ2RldnN0cmFsJylcblxuXHRpZiAobG93ZXIuaW5jbHVkZXMoJ2dlbW1hJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5Tb3VyY2VNb2RlbE9wdGlvbnNfYXNzdW1pbmdPQUlDb21wYXQsICdnZW1tYScpXG5cblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdzdGFyY29kZXIyJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5Tb3VyY2VNb2RlbE9wdGlvbnNfYXNzdW1pbmdPQUlDb21wYXQsICdzdGFyY29kZXIyJylcblxuXHRpZiAobG93ZXIuaW5jbHVkZXMoJ29wZW5oYW5kcycpKSByZXR1cm4gdG9GYWxsYmFjayhvcGVuU291cmNlTW9kZWxPcHRpb25zX2Fzc3VtaW5nT0FJQ29tcGF0LCAnb3BlbmhhbmRzLWxtLTMyYicpIC8vIG1heCBvdXRwdXQgdW5jbGVyXG5cblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdxdWFzYXInKSB8fCBsb3dlci5pbmNsdWRlcygncXVhc2VyJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5Tb3VyY2VNb2RlbE9wdGlvbnNfYXNzdW1pbmdPQUlDb21wYXQsICdxdWFzYXInKVxuXG5cdGlmIChsb3dlci5pbmNsdWRlcygnZ3B0JykgJiYgbG93ZXIuaW5jbHVkZXMoJ21pbmknKSAmJiAobG93ZXIuaW5jbHVkZXMoJzQuMScpIHx8IGxvd2VyLmluY2x1ZGVzKCc0LTEnKSkpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5BSU1vZGVsT3B0aW9ucywgJ2dwdC00LjEtbWluaScpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnZ3B0JykgJiYgbG93ZXIuaW5jbHVkZXMoJ25hbm8nKSAmJiAobG93ZXIuaW5jbHVkZXMoJzQuMScpIHx8IGxvd2VyLmluY2x1ZGVzKCc0LTEnKSkpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5BSU1vZGVsT3B0aW9ucywgJ2dwdC00LjEtbmFubycpXG5cdGlmIChsb3dlci5pbmNsdWRlcygnZ3B0JykgJiYgKGxvd2VyLmluY2x1ZGVzKCc0LjEnKSB8fCBsb3dlci5pbmNsdWRlcygnNC0xJykpKSByZXR1cm4gdG9GYWxsYmFjayhvcGVuQUlNb2RlbE9wdGlvbnMsICdncHQtNC4xJylcblxuXHRpZiAobG93ZXIuaW5jbHVkZXMoJzRvJykgJiYgbG93ZXIuaW5jbHVkZXMoJ21pbmknKSkgcmV0dXJuIHRvRmFsbGJhY2sob3BlbkFJTW9kZWxPcHRpb25zLCAnZ3B0LTRvLW1pbmknKVxuXHRpZiAobG93ZXIuaW5jbHVkZXMoJzRvJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5BSU1vZGVsT3B0aW9ucywgJ2dwdC00bycpXG5cblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdvMScpICYmIGxvd2VyLmluY2x1ZGVzKCdtaW5pJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5BSU1vZGVsT3B0aW9ucywgJ28xLW1pbmknKVxuXHRpZiAobG93ZXIuaW5jbHVkZXMoJ28xJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5BSU1vZGVsT3B0aW9ucywgJ28xJylcblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdvMycpICYmIGxvd2VyLmluY2x1ZGVzKCdtaW5pJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5BSU1vZGVsT3B0aW9ucywgJ28zLW1pbmknKVxuXHRpZiAobG93ZXIuaW5jbHVkZXMoJ28zJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5BSU1vZGVsT3B0aW9ucywgJ28zJylcblx0aWYgKGxvd2VyLmluY2x1ZGVzKCdvNCcpICYmIGxvd2VyLmluY2x1ZGVzKCdtaW5pJykpIHJldHVybiB0b0ZhbGxiYWNrKG9wZW5BSU1vZGVsT3B0aW9ucywgJ280LW1pbmknKVxuXG5cblx0aWYgKE9iamVjdC5rZXlzKG9wZW5Tb3VyY2VNb2RlbE9wdGlvbnNfYXNzdW1pbmdPQUlDb21wYXQpLm1hcChrID0+IGsudG9Mb3dlckNhc2UoKSkuaW5jbHVkZXMobG93ZXIpKVxuXHRcdHJldHVybiB0b0ZhbGxiYWNrKG9wZW5Tb3VyY2VNb2RlbE9wdGlvbnNfYXNzdW1pbmdPQUlDb21wYXQsIGxvd2VyIGFzIGtleW9mIHR5cGVvZiBvcGVuU291cmNlTW9kZWxPcHRpb25zX2Fzc3VtaW5nT0FJQ29tcGF0KVxuXG5cdHJldHVybiBudWxsXG59XG5cblxuXG5cblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tIEFOVEhST1BJQyAtLS0tLS0tLS0tLS0tLS0tXG5jb25zdCBhbnRocm9waWNNb2RlbE9wdGlvbnMgPSB7XG5cdCdjbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOSc6IHsgLy8gaHR0cHM6Ly9kb2NzLmFudGhyb3BpYy5jb20vZW4vZG9jcy9hYm91dC1jbGF1ZGUvbW9kZWxzL2FsbC1tb2RlbHMjbW9kZWwtY29tcGFyaXNvbi10YWJsZVxuXHRcdGNvbnRleHRXaW5kb3c6IDIwMF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5Mixcblx0XHRjb3N0OiB7IGlucHV0OiAzLjAwLCBjYWNoZV9yZWFkOiAwLjMwLCBjYWNoZV93cml0ZTogMy43NSwgb3V0cHV0OiAxNS4wMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnYW50aHJvcGljLXN0eWxlJyxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzZXBhcmF0ZWQnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczoge1xuXHRcdFx0c3VwcG9ydHNSZWFzb25pbmc6IHRydWUsXG5cdFx0XHRjYW5UdXJuT2ZmUmVhc29uaW5nOiB0cnVlLFxuXHRcdFx0Y2FuSU9SZWFzb25pbmc6IHRydWUsXG5cdFx0XHRyZWFzb25pbmdSZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDgxOTIsIC8vIGNhbiBidW1wIGl0IHRvIDEyOF8wMDAgd2l0aCBiZXRhIG1vZGUgb3V0cHV0LTEyOGstMjAyNS0wMi0xOVxuXHRcdFx0cmVhc29uaW5nU2xpZGVyOiB7IHR5cGU6ICdidWRnZXRfc2xpZGVyJywgbWluOiAxMDI0LCBtYXg6IDgxOTIsIGRlZmF1bHQ6IDEwMjQgfSwgLy8gdGhleSByZWNvbW1lbmQgYmF0Y2hpbmcgaWYgbWF4ID4gMzJfMDAwLiB3ZSBjYXAgYXQgODE5MiBiZWNhdXNlIGFib3ZlIGlzIHR5cGljYWxseSBub3QgbmVjZXNzYXJ5IChvZnRlbiBldmVuIGJ1Z2d5KVxuXHRcdH0sXG5cblx0fSxcblx0J2NsYXVkZS1vcHVzLTQtMjAyNTA1MTQnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMjAwXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDE1LjAwLCBjYWNoZV9yZWFkOiAxLjUwLCBjYWNoZV93cml0ZTogMTguNzUsIG91dHB1dDogMzAuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2FudGhyb3BpYy1zdHlsZScsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc2VwYXJhdGVkJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IHtcblx0XHRcdHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLFxuXHRcdFx0Y2FuVHVybk9mZlJlYXNvbmluZzogdHJ1ZSxcblx0XHRcdGNhbklPUmVhc29uaW5nOiB0cnVlLFxuXHRcdFx0cmVhc29uaW5nUmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4MTkyLCAvLyBjYW4gYnVtcCBpdCB0byAxMjhfMDAwIHdpdGggYmV0YSBtb2RlIG91dHB1dC0xMjhrLTIwMjUtMDItMTlcblx0XHRcdHJlYXNvbmluZ1NsaWRlcjogeyB0eXBlOiAnYnVkZ2V0X3NsaWRlcicsIG1pbjogMTAyNCwgbWF4OiA4MTkyLCBkZWZhdWx0OiAxMDI0IH0sIC8vIHRoZXkgcmVjb21tZW5kIGJhdGNoaW5nIGlmIG1heCA+IDMyXzAwMC4gd2UgY2FwIGF0IDgxOTIgYmVjYXVzZSBhYm92ZSBpcyB0eXBpY2FsbHkgbm90IG5lY2Vzc2FyeSAob2Z0ZW4gZXZlbiBidWdneSlcblx0XHR9LFxuXG5cdH0sXG5cdCdjbGF1ZGUtc29ubmV0LTQtMjAyNTA1MTQnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMjAwXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDMuMDAsIGNhY2hlX3JlYWQ6IDAuMzAsIGNhY2hlX3dyaXRlOiAzLjc1LCBvdXRwdXQ6IDYuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2FudGhyb3BpYy1zdHlsZScsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc2VwYXJhdGVkJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IHtcblx0XHRcdHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLFxuXHRcdFx0Y2FuVHVybk9mZlJlYXNvbmluZzogdHJ1ZSxcblx0XHRcdGNhbklPUmVhc29uaW5nOiB0cnVlLFxuXHRcdFx0cmVhc29uaW5nUmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4MTkyLCAvLyBjYW4gYnVtcCBpdCB0byAxMjhfMDAwIHdpdGggYmV0YSBtb2RlIG91dHB1dC0xMjhrLTIwMjUtMDItMTlcblx0XHRcdHJlYXNvbmluZ1NsaWRlcjogeyB0eXBlOiAnYnVkZ2V0X3NsaWRlcicsIG1pbjogMTAyNCwgbWF4OiA4MTkyLCBkZWZhdWx0OiAxMDI0IH0sIC8vIHRoZXkgcmVjb21tZW5kIGJhdGNoaW5nIGlmIG1heCA+IDMyXzAwMC4gd2UgY2FwIGF0IDgxOTIgYmVjYXVzZSBhYm92ZSBpcyB0eXBpY2FsbHkgbm90IG5lY2Vzc2FyeSAob2Z0ZW4gZXZlbiBidWdneSlcblx0XHR9LFxuXG5cdH0sXG5cdCdjbGF1ZGUtMy01LXNvbm5ldC0yMDI0MTAyMic6IHtcblx0XHRjb250ZXh0V2luZG93OiAyMDBfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogOF8xOTIsXG5cdFx0Y29zdDogeyBpbnB1dDogMy4wMCwgY2FjaGVfcmVhZDogMC4zMCwgY2FjaGVfd3JpdGU6IDMuNzUsIG91dHB1dDogMTUuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2FudGhyb3BpYy1zdHlsZScsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc2VwYXJhdGVkJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnY2xhdWRlLTMtNS1oYWlrdS0yMDI0MTAyMic6IHtcblx0XHRjb250ZXh0V2luZG93OiAyMDBfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogOF8xOTIsXG5cdFx0Y29zdDogeyBpbnB1dDogMC44MCwgY2FjaGVfcmVhZDogMC4wOCwgY2FjaGVfd3JpdGU6IDEuMDAsIG91dHB1dDogNC4wMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnYW50aHJvcGljLXN0eWxlJyxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzZXBhcmF0ZWQnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdCdjbGF1ZGUtMy1vcHVzLTIwMjQwMjI5Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDIwMF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA0XzA5Nixcblx0XHRjb3N0OiB7IGlucHV0OiAxNS4wMCwgY2FjaGVfcmVhZDogMS41MCwgY2FjaGVfd3JpdGU6IDE4Ljc1LCBvdXRwdXQ6IDc1LjAwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3BlY2lhbFRvb2xGb3JtYXQ6ICdhbnRocm9waWMtc3R5bGUnLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3NlcGFyYXRlZCcsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2NsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOSc6IHsgLy8gbm8gcG9pbnQgb2YgdXNpbmcgdGhpcywgYnV0IGluY2x1ZGluZyB0aGlzIGZvciBwZW9wbGUgd2hvIHB1dCBpdCBpblxuXHRcdGNvbnRleHRXaW5kb3c6IDIwMF8wMDAsIGNvc3Q6IHsgaW5wdXQ6IDMuMDAsIG91dHB1dDogMTUuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogNF8wOTYsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnYW50aHJvcGljLXN0eWxlJyxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzZXBhcmF0ZWQnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH1cbn0gYXMgY29uc3Qgc2F0aXNmaWVzIHsgW3M6IHN0cmluZ106IFZvaWRTdGF0aWNNb2RlbEluZm8gfVxuXG5jb25zdCBhbnRocm9waWNTZXR0aW5nczogVm9pZFN0YXRpY1Byb3ZpZGVySW5mbyA9IHtcblx0cHJvdmlkZXJSZWFzb25pbmdJT1NldHRpbmdzOiB7XG5cdFx0aW5wdXQ6IHtcblx0XHRcdGluY2x1ZGVJblBheWxvYWQ6IChyZWFzb25pbmdJbmZvKSA9PiB7XG5cdFx0XHRcdGlmICghcmVhc29uaW5nSW5mbz8uaXNSZWFzb25pbmdFbmFibGVkKSByZXR1cm4gbnVsbFxuXG5cdFx0XHRcdGlmIChyZWFzb25pbmdJbmZvLnR5cGUgPT09ICdidWRnZXRfc2xpZGVyX3ZhbHVlJykge1xuXHRcdFx0XHRcdHJldHVybiB7IHRoaW5raW5nOiB7IHR5cGU6ICdlbmFibGVkJywgYnVkZ2V0X3Rva2VuczogcmVhc29uaW5nSW5mby5yZWFzb25pbmdCdWRnZXQgfSB9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGxcblx0XHRcdH1cblx0XHR9LFxuXHR9LFxuXHRtb2RlbE9wdGlvbnM6IGFudGhyb3BpY01vZGVsT3B0aW9ucyxcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IHtcblx0XHRjb25zdCBsb3dlciA9IG1vZGVsTmFtZS50b0xvd2VyQ2FzZSgpXG5cdFx0bGV0IGZhbGxiYWNrTmFtZToga2V5b2YgdHlwZW9mIGFudGhyb3BpY01vZGVsT3B0aW9ucyB8IG51bGwgPSBudWxsXG5cdFx0aWYgKGxvd2VyLmluY2x1ZGVzKCdjbGF1ZGUtNC1vcHVzJykgfHwgbG93ZXIuaW5jbHVkZXMoJ2NsYXVkZS1vcHVzLTQnKSkgZmFsbGJhY2tOYW1lID0gJ2NsYXVkZS1vcHVzLTQtMjAyNTA1MTQnXG5cdFx0aWYgKGxvd2VyLmluY2x1ZGVzKCdjbGF1ZGUtNC1zb25uZXQnKSB8fCBsb3dlci5pbmNsdWRlcygnY2xhdWRlLXNvbm5ldC00JykpIGZhbGxiYWNrTmFtZSA9ICdjbGF1ZGUtc29ubmV0LTQtMjAyNTA1MTQnXG5cblxuXHRcdGlmIChsb3dlci5pbmNsdWRlcygnY2xhdWRlLTMtNy1zb25uZXQnKSkgZmFsbGJhY2tOYW1lID0gJ2NsYXVkZS0zLTctc29ubmV0LTIwMjUwMjE5J1xuXHRcdGlmIChsb3dlci5pbmNsdWRlcygnY2xhdWRlLTMtNS1zb25uZXQnKSkgZmFsbGJhY2tOYW1lID0gJ2NsYXVkZS0zLTUtc29ubmV0LTIwMjQxMDIyJ1xuXHRcdGlmIChsb3dlci5pbmNsdWRlcygnY2xhdWRlLTMtNS1oYWlrdScpKSBmYWxsYmFja05hbWUgPSAnY2xhdWRlLTMtNS1oYWlrdS0yMDI0MTAyMidcblx0XHRpZiAobG93ZXIuaW5jbHVkZXMoJ2NsYXVkZS0zLW9wdXMnKSkgZmFsbGJhY2tOYW1lID0gJ2NsYXVkZS0zLW9wdXMtMjAyNDAyMjknXG5cdFx0aWYgKGxvd2VyLmluY2x1ZGVzKCdjbGF1ZGUtMy1zb25uZXQnKSkgZmFsbGJhY2tOYW1lID0gJ2NsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOSdcblx0XHRpZiAoZmFsbGJhY2tOYW1lKSByZXR1cm4geyBtb2RlbE5hbWU6IGZhbGxiYWNrTmFtZSwgcmVjb2duaXplZE1vZGVsTmFtZTogZmFsbGJhY2tOYW1lLCAuLi5hbnRocm9waWNNb2RlbE9wdGlvbnNbZmFsbGJhY2tOYW1lXSB9XG5cdFx0cmV0dXJuIG51bGxcblx0fSxcbn1cblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tIE9QRU5BSSAtLS0tLS0tLS0tLS0tLS0tXG5jb25zdCBvcGVuQUlNb2RlbE9wdGlvbnMgPSB7IC8vIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL3ByaWNpbmdcblx0J28zJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDFfMDQ3XzU3Nixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDMyXzc2OCxcblx0XHRjb3N0OiB7IGlucHV0OiAxMC4wMCwgb3V0cHV0OiA0MC4wMCwgY2FjaGVfcmVhZDogMi41MCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnb3BlbmFpLXN0eWxlJyxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdkZXZlbG9wZXItcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5UdXJuT2ZmUmVhc29uaW5nOiBmYWxzZSwgY2FuSU9SZWFzb25pbmc6IGZhbHNlLCByZWFzb25pbmdTbGlkZXI6IHsgdHlwZTogJ2VmZm9ydF9zbGlkZXInLCB2YWx1ZXM6IFsnbG93JywgJ21lZGl1bScsICdoaWdoJ10sIGRlZmF1bHQ6ICdsb3cnIH0gfSxcblx0fSxcblx0J280LW1pbmknOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMV8wNDdfNTc2LFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogMzJfNzY4LFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDEuMTAsIG91dHB1dDogNC40MCwgY2FjaGVfcmVhZDogMC4yNzUgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ29wZW5haS1zdHlsZScsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnZGV2ZWxvcGVyLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogeyBzdXBwb3J0c1JlYXNvbmluZzogdHJ1ZSwgY2FuVHVybk9mZlJlYXNvbmluZzogZmFsc2UsIGNhbklPUmVhc29uaW5nOiBmYWxzZSwgcmVhc29uaW5nU2xpZGVyOiB7IHR5cGU6ICdlZmZvcnRfc2xpZGVyJywgdmFsdWVzOiBbJ2xvdycsICdtZWRpdW0nLCAnaGlnaCddLCBkZWZhdWx0OiAnbG93JyB9IH0sXG5cdH0sXG5cdCdncHQtNC4xJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDFfMDQ3XzU3Nixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDMyXzc2OCxcblx0XHRjb3N0OiB7IGlucHV0OiAyLjAwLCBvdXRwdXQ6IDguMDAsIGNhY2hlX3JlYWQ6IDAuNTAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ29wZW5haS1zdHlsZScsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnZGV2ZWxvcGVyLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdCdncHQtNC4xLW1pbmknOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMV8wNDdfNTc2LFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogMzJfNzY4LFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuNDAsIG91dHB1dDogMS42MCwgY2FjaGVfcmVhZDogMC4xMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnb3BlbmFpLXN0eWxlJyxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdkZXZlbG9wZXItcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2dwdC00LjEtbmFubyc6IHtcblx0XHRjb250ZXh0V2luZG93OiAxXzA0N181NzYsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiAzMl83NjgsXG5cdFx0Y29zdDogeyBpbnB1dDogMC4xMCwgb3V0cHV0OiAwLjQwLCBjYWNoZV9yZWFkOiAwLjAzIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3BlY2lhbFRvb2xGb3JtYXQ6ICdvcGVuYWktc3R5bGUnLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ2RldmVsb3Blci1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnbzEnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTI4XzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDEwMF8wMDAsXG5cdFx0Y29zdDogeyBpbnB1dDogMTUuMDAsIGNhY2hlX3JlYWQ6IDcuNTAsIG91dHB1dDogNjAuMDAsIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnZGV2ZWxvcGVyLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogeyBzdXBwb3J0c1JlYXNvbmluZzogdHJ1ZSwgY2FuVHVybk9mZlJlYXNvbmluZzogZmFsc2UsIGNhbklPUmVhc29uaW5nOiBmYWxzZSwgcmVhc29uaW5nU2xpZGVyOiB7IHR5cGU6ICdlZmZvcnRfc2xpZGVyJywgdmFsdWVzOiBbJ2xvdycsICdtZWRpdW0nLCAnaGlnaCddLCBkZWZhdWx0OiAnbG93JyB9IH0sXG5cdH0sXG5cdCdvMy1taW5pJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDIwMF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiAxMDBfMDAwLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDEuMTAsIGNhY2hlX3JlYWQ6IDAuNTUsIG91dHB1dDogNC40MCwgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdkZXZlbG9wZXItcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5UdXJuT2ZmUmVhc29uaW5nOiBmYWxzZSwgY2FuSU9SZWFzb25pbmc6IGZhbHNlLCByZWFzb25pbmdTbGlkZXI6IHsgdHlwZTogJ2VmZm9ydF9zbGlkZXInLCB2YWx1ZXM6IFsnbG93JywgJ21lZGl1bScsICdoaWdoJ10sIGRlZmF1bHQ6ICdsb3cnIH0gfSxcblx0fSxcblx0J2dwdC00byc6IHtcblx0XHRjb250ZXh0V2luZG93OiAxMjhfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogMTZfMzg0LFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDIuNTAsIGNhY2hlX3JlYWQ6IDEuMjUsIG91dHB1dDogMTAuMDAsIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3BlY2lhbFRvb2xGb3JtYXQ6ICdvcGVuYWktc3R5bGUnLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnbzEtbWluaSc6IHtcblx0XHRjb250ZXh0V2luZG93OiAxMjhfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogNjVfNTM2LFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDEuMTAsIGNhY2hlX3JlYWQ6IDAuNTUsIG91dHB1dDogNC40MCwgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6IGZhbHNlLCAvLyBkb2VzIG5vdCBzdXBwb3J0IGFueSBzeXN0ZW1cblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IHsgc3VwcG9ydHNSZWFzb25pbmc6IHRydWUsIGNhblR1cm5PZmZSZWFzb25pbmc6IGZhbHNlLCBjYW5JT1JlYXNvbmluZzogZmFsc2UsIHJlYXNvbmluZ1NsaWRlcjogeyB0eXBlOiAnZWZmb3J0X3NsaWRlcicsIHZhbHVlczogWydsb3cnLCAnbWVkaXVtJywgJ2hpZ2gnXSwgZGVmYXVsdDogJ2xvdycgfSB9LFxuXHR9LFxuXHQnZ3B0LTRvLW1pbmknOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTI4XzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDE2XzM4NCxcblx0XHRjb3N0OiB7IGlucHV0OiAwLjE1LCBjYWNoZV9yZWFkOiAwLjA3NSwgb3V0cHV0OiAwLjYwLCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnb3BlbmFpLXN0eWxlJyxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsIC8vID8/XG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcbn0gYXMgY29uc3Qgc2F0aXNmaWVzIHsgW3M6IHN0cmluZ106IFZvaWRTdGF0aWNNb2RlbEluZm8gfVxuXG5cbi8vIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2d1aWRlcy9yZWFzb25pbmc/YXBpLW1vZGU9Y2hhdFxuY29uc3Qgb3BlbkFJQ29tcGF0SW5jbHVkZUluUGF5bG9hZFJlYXNvbmluZyA9IChyZWFzb25pbmdJbmZvOiBTZW5kYWJsZVJlYXNvbmluZ0luZm8pID0+IHtcblx0aWYgKCFyZWFzb25pbmdJbmZvPy5pc1JlYXNvbmluZ0VuYWJsZWQpIHJldHVybiBudWxsXG5cdGlmIChyZWFzb25pbmdJbmZvLnR5cGUgPT09ICdlZmZvcnRfc2xpZGVyX3ZhbHVlJykge1xuXHRcdHJldHVybiB7IHJlYXNvbmluZ19lZmZvcnQ6IHJlYXNvbmluZ0luZm8ucmVhc29uaW5nRWZmb3J0IH1cblx0fVxuXHRyZXR1cm4gbnVsbFxuXG59XG5cbmNvbnN0IG9wZW5BSVNldHRpbmdzOiBWb2lkU3RhdGljUHJvdmlkZXJJbmZvID0ge1xuXHRtb2RlbE9wdGlvbnM6IG9wZW5BSU1vZGVsT3B0aW9ucyxcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IHtcblx0XHRjb25zdCBsb3dlciA9IG1vZGVsTmFtZS50b0xvd2VyQ2FzZSgpXG5cdFx0bGV0IGZhbGxiYWNrTmFtZToga2V5b2YgdHlwZW9mIG9wZW5BSU1vZGVsT3B0aW9ucyB8IG51bGwgPSBudWxsXG5cdFx0aWYgKGxvd2VyLmluY2x1ZGVzKCdvMScpKSB7IGZhbGxiYWNrTmFtZSA9ICdvMScgfVxuXHRcdGlmIChsb3dlci5pbmNsdWRlcygnbzMtbWluaScpKSB7IGZhbGxiYWNrTmFtZSA9ICdvMy1taW5pJyB9XG5cdFx0aWYgKGxvd2VyLmluY2x1ZGVzKCdncHQtNG8nKSkgeyBmYWxsYmFja05hbWUgPSAnZ3B0LTRvJyB9XG5cdFx0aWYgKGZhbGxiYWNrTmFtZSkgcmV0dXJuIHsgbW9kZWxOYW1lOiBmYWxsYmFja05hbWUsIHJlY29nbml6ZWRNb2RlbE5hbWU6IGZhbGxiYWNrTmFtZSwgLi4ub3BlbkFJTW9kZWxPcHRpb25zW2ZhbGxiYWNrTmFtZV0gfVxuXHRcdHJldHVybiBudWxsXG5cdH0sXG5cdHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5nczoge1xuXHRcdGlucHV0OiB7IGluY2x1ZGVJblBheWxvYWQ6IG9wZW5BSUNvbXBhdEluY2x1ZGVJblBheWxvYWRSZWFzb25pbmcgfSxcblx0fSxcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLSBYQUkgLS0tLS0tLS0tLS0tLS0tLVxuY29uc3QgeEFJTW9kZWxPcHRpb25zID0ge1xuXHQvLyBodHRwczovL2RvY3MueC5haS9kb2NzL2d1aWRlcy9yZWFzb25pbmcjcmVhc29uaW5nXG5cdC8vIGh0dHBzOi8vZG9jcy54LmFpL2RvY3MvbW9kZWxzI21vZGVscy1hbmQtcHJpY2luZ1xuXHQnZ3Jvay0yJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDEzMV8wNzIsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDIuMDAsIG91dHB1dDogMTAuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0c3BlY2lhbFRvb2xGb3JtYXQ6ICdvcGVuYWktc3R5bGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdCdncm9rLTMnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTMxXzA3Mixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bGwsXG5cdFx0Y29zdDogeyBpbnB1dDogMy4wMCwgb3V0cHV0OiAxNS4wMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ29wZW5haS1zdHlsZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2dyb2stMy1mYXN0Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDEzMV8wNzIsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDUuMDAsIG91dHB1dDogMjUuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0c3BlY2lhbFRvb2xGb3JtYXQ6ICdvcGVuYWktc3R5bGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdC8vIG9ubHkgbWluaSBzdXBwb3J0cyB0aGlua2luZ1xuXHQnZ3Jvay0zLW1pbmknOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTMxXzA3Mixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bGwsXG5cdFx0Y29zdDogeyBpbnB1dDogMC4zMCwgb3V0cHV0OiAwLjUwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnb3BlbmFpLXN0eWxlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IHsgc3VwcG9ydHNSZWFzb25pbmc6IHRydWUsIGNhblR1cm5PZmZSZWFzb25pbmc6IGZhbHNlLCBjYW5JT1JlYXNvbmluZzogZmFsc2UsIHJlYXNvbmluZ1NsaWRlcjogeyB0eXBlOiAnZWZmb3J0X3NsaWRlcicsIHZhbHVlczogWydsb3cnLCAnaGlnaCddLCBkZWZhdWx0OiAnbG93JyB9IH0sXG5cdH0sXG5cdCdncm9rLTMtbWluaS1mYXN0Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDEzMV8wNzIsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuNjAsIG91dHB1dDogNC4wMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ29wZW5haS1zdHlsZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5UdXJuT2ZmUmVhc29uaW5nOiBmYWxzZSwgY2FuSU9SZWFzb25pbmc6IGZhbHNlLCByZWFzb25pbmdTbGlkZXI6IHsgdHlwZTogJ2VmZm9ydF9zbGlkZXInLCB2YWx1ZXM6IFsnbG93JywgJ2hpZ2gnXSwgZGVmYXVsdDogJ2xvdycgfSB9LFxuXHR9LFxufSBhcyBjb25zdCBzYXRpc2ZpZXMgeyBbczogc3RyaW5nXTogVm9pZFN0YXRpY01vZGVsSW5mbyB9XG5cbmNvbnN0IHhBSVNldHRpbmdzOiBWb2lkU3RhdGljUHJvdmlkZXJJbmZvID0ge1xuXHRtb2RlbE9wdGlvbnM6IHhBSU1vZGVsT3B0aW9ucyxcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IHtcblx0XHRjb25zdCBsb3dlciA9IG1vZGVsTmFtZS50b0xvd2VyQ2FzZSgpXG5cdFx0bGV0IGZhbGxiYWNrTmFtZToga2V5b2YgdHlwZW9mIHhBSU1vZGVsT3B0aW9ucyB8IG51bGwgPSBudWxsXG5cdFx0aWYgKGxvd2VyLmluY2x1ZGVzKCdncm9rLTInKSkgZmFsbGJhY2tOYW1lID0gJ2dyb2stMidcblx0XHRpZiAobG93ZXIuaW5jbHVkZXMoJ2dyb2stMycpKSBmYWxsYmFja05hbWUgPSAnZ3Jvay0zJ1xuXHRcdGlmIChsb3dlci5pbmNsdWRlcygnZ3JvaycpKSBmYWxsYmFja05hbWUgPSAnZ3Jvay0zJ1xuXHRcdGlmIChmYWxsYmFja05hbWUpIHJldHVybiB7IG1vZGVsTmFtZTogZmFsbGJhY2tOYW1lLCByZWNvZ25pemVkTW9kZWxOYW1lOiBmYWxsYmFja05hbWUsIC4uLnhBSU1vZGVsT3B0aW9uc1tmYWxsYmFja05hbWVdIH1cblx0XHRyZXR1cm4gbnVsbFxuXHR9LFxuXHQvLyBzYW1lIGltcGxlbWVudGF0aW9uIGFzIG9wZW5haVxuXHRwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3M6IHtcblx0XHRpbnB1dDogeyBpbmNsdWRlSW5QYXlsb2FkOiBvcGVuQUlDb21wYXRJbmNsdWRlSW5QYXlsb2FkUmVhc29uaW5nIH0sXG5cdH0sXG59XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLSBHRU1JTkkgLS0tLS0tLS0tLS0tLS0tLVxuY29uc3QgZ2VtaW5pTW9kZWxPcHRpb25zID0geyAvLyBodHRwczovL2FpLmdvb2dsZS5kZXYvZ2VtaW5pLWFwaS9kb2NzL3ByaWNpbmdcblx0J2dlbWluaS0yLjUtZmxhc2gnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMV8wNDhfNTc2LFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogOF8xOTIsXG5cdFx0Y29zdDogeyBpbnB1dDogMC4xNSwgb3V0cHV0OiAwLjYwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc2VwYXJhdGVkJyxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2dlbWluaS1zdHlsZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7XG5cdFx0XHRzdXBwb3J0c1JlYXNvbmluZzogdHJ1ZSxcblx0XHRcdGNhblR1cm5PZmZSZWFzb25pbmc6IHRydWUsXG5cdFx0XHRjYW5JT1JlYXNvbmluZzogZmFsc2UsXG5cdFx0XHRyZWFzb25pbmdTbGlkZXI6IHsgdHlwZTogJ2J1ZGdldF9zbGlkZXInLCBtaW46IDEwMjQsIG1heDogODE5MiwgZGVmYXVsdDogMTAyNCB9LFxuXHRcdFx0cmVhc29uaW5nUmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4MTkyLFxuXHRcdH0sXG5cdH0gYXMgY29uc3QsXG5cdC8vIGh0dHBzOi8vYWkuZ29vZ2xlLmRldi9nZW1pbmktYXBpL2RvY3MvdGhpbmtpbmcjc2V0LWJ1ZGdldFxuXHQnZ2VtaW5pLTIuNS1wcm8tcHJldmlldy0wNS0wNic6IHtcblx0XHRjb250ZXh0V2luZG93OiAxXzA0OF81NzYsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5Mixcblx0XHRjb3N0OiB7IGlucHV0OiAwLCBvdXRwdXQ6IDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzZXBhcmF0ZWQnLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnZ2VtaW5pLXN0eWxlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IHtcblx0XHRcdHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLFxuXHRcdFx0Y2FuVHVybk9mZlJlYXNvbmluZzogdHJ1ZSxcblx0XHRcdGNhbklPUmVhc29uaW5nOiBmYWxzZSxcblx0XHRcdHJlYXNvbmluZ1NsaWRlcjogeyB0eXBlOiAnYnVkZ2V0X3NsaWRlcicsIG1pbjogMTAyNCwgbWF4OiA4MTkyLCBkZWZhdWx0OiAxMDI0IH0sIC8vIG1heCBpcyByZWFsbHkgMjQ1NzZcblx0XHRcdHJlYXNvbmluZ1Jlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogODE5Mixcblx0XHR9LFxuXHR9LFxuXHQnZ2VtaW5pLTIuMC1mbGFzaC1saXRlJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDFfMDQ4XzU3Nixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAsIG91dHB1dDogMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3NlcGFyYXRlZCcsXG5cdFx0c3BlY2lhbFRvb2xGb3JtYXQ6ICdnZW1pbmktc3R5bGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsIC8vIG5vIHJlYXNvbmluZ1xuXHR9LFxuXHQnZ2VtaW5pLTIuNS1mbGFzaC1wcmV2aWV3LTA0LTE3Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDFfMDQ4XzU3Nixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMTUsIG91dHB1dDogLjYwIH0sIC8vIFRPRE8gJDMuNTAgb3V0cHV0IHdpdGggdGhpbmtpbmcgbm90IGluY2x1ZGVkXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc2VwYXJhdGVkJyxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2dlbWluaS1zdHlsZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7XG5cdFx0XHRzdXBwb3J0c1JlYXNvbmluZzogdHJ1ZSxcblx0XHRcdGNhblR1cm5PZmZSZWFzb25pbmc6IHRydWUsXG5cdFx0XHRjYW5JT1JlYXNvbmluZzogZmFsc2UsXG5cdFx0XHRyZWFzb25pbmdTbGlkZXI6IHsgdHlwZTogJ2J1ZGdldF9zbGlkZXInLCBtaW46IDEwMjQsIG1heDogODE5MiwgZGVmYXVsdDogMTAyNCB9LCAvLyBtYXggaXMgcmVhbGx5IDI0NTc2XG5cdFx0XHRyZWFzb25pbmdSZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDgxOTIsXG5cdFx0fSxcblx0fSxcblx0J2dlbWluaS0yLjUtcHJvLWV4cC0wMy0yNSc6IHtcblx0XHRjb250ZXh0V2luZG93OiAxXzA0OF81NzYsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5Mixcblx0XHRjb3N0OiB7IGlucHV0OiAwLCBvdXRwdXQ6IDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzZXBhcmF0ZWQnLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnZ2VtaW5pLXN0eWxlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IHtcblx0XHRcdHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLFxuXHRcdFx0Y2FuVHVybk9mZlJlYXNvbmluZzogdHJ1ZSxcblx0XHRcdGNhbklPUmVhc29uaW5nOiBmYWxzZSxcblx0XHRcdHJlYXNvbmluZ1NsaWRlcjogeyB0eXBlOiAnYnVkZ2V0X3NsaWRlcicsIG1pbjogMTAyNCwgbWF4OiA4MTkyLCBkZWZhdWx0OiAxMDI0IH0sIC8vIG1heCBpcyByZWFsbHkgMjQ1NzZcblx0XHRcdHJlYXNvbmluZ1Jlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogODE5Mixcblx0XHR9LFxuXHR9LFxuXHQnZ2VtaW5pLTIuMC1mbGFzaCc6IHtcblx0XHRjb250ZXh0V2luZG93OiAxXzA0OF81NzYsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5MiwgLy8gOF8xOTIsXG5cdFx0Y29zdDogeyBpbnB1dDogMC4xMCwgb3V0cHV0OiAwLjQwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc2VwYXJhdGVkJyxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2dlbWluaS1zdHlsZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2dlbWluaS0yLjAtZmxhc2gtbGl0ZS1wcmV2aWV3LTAyLTA1Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDFfMDQ4XzU3Nixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLCAvLyA4XzE5Mixcblx0XHRjb3N0OiB7IGlucHV0OiAwLjA3NSwgb3V0cHV0OiAwLjMwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc2VwYXJhdGVkJyxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2dlbWluaS1zdHlsZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2dlbWluaS0xLjUtZmxhc2gnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMV8wNDhfNTc2LFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogOF8xOTIsIC8vIDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMDc1LCBvdXRwdXQ6IDAuMzAgfSwgIC8vIFRPRE8hISEgcHJpY2UgZG91YmxlcyBhZnRlciAxMjhLIHRva2Vucywgd2UgYXJlIE5PVCBlbmNvZGluZyB0aGF0IGluZm8gcmlnaHQgbm93XG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc2VwYXJhdGVkJyxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2dlbWluaS1zdHlsZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2dlbWluaS0xLjUtcHJvJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDJfMDk3XzE1Mixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDEuMjUsIG91dHB1dDogNS4wMCB9LCAgLy8gVE9ETyEhISBwcmljZSBkb3VibGVzIGFmdGVyIDEyOEsgdG9rZW5zLCB3ZSBhcmUgTk9UIGVuY29kaW5nIHRoYXQgaW5mbyByaWdodCBub3dcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzZXBhcmF0ZWQnLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnZ2VtaW5pLXN0eWxlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnZ2VtaW5pLTEuNS1mbGFzaC04Yic6IHtcblx0XHRjb250ZXh0V2luZG93OiAxXzA0OF81NzYsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5Mixcblx0XHRjb3N0OiB7IGlucHV0OiAwLjAzNzUsIG91dHB1dDogMC4xNSB9LCAgLy8gVE9ETyEhISBwcmljZSBkb3VibGVzIGFmdGVyIDEyOEsgdG9rZW5zLCB3ZSBhcmUgTk9UIGVuY29kaW5nIHRoYXQgaW5mbyByaWdodCBub3dcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzZXBhcmF0ZWQnLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0OiAnZ2VtaW5pLXN0eWxlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxufSBhcyBjb25zdCBzYXRpc2ZpZXMgeyBbczogc3RyaW5nXTogVm9pZFN0YXRpY01vZGVsSW5mbyB9XG5cbmNvbnN0IGdlbWluaVNldHRpbmdzOiBWb2lkU3RhdGljUHJvdmlkZXJJbmZvID0ge1xuXHRtb2RlbE9wdGlvbnM6IGdlbWluaU1vZGVsT3B0aW9ucyxcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IHsgcmV0dXJuIG51bGwgfSxcbn1cblxuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0gREVFUFNFRUsgQVBJIC0tLS0tLS0tLS0tLS0tLS1cbmNvbnN0IGRlZXBzZWVrTW9kZWxPcHRpb25zID0ge1xuXHQnZGVlcHNlZWstY2hhdCc6IHtcblx0XHQuLi5vcGVuU291cmNlTW9kZWxPcHRpb25zX2Fzc3VtaW5nT0FJQ29tcGF0LmRlZXBzZWVrUjEsXG5cdFx0Y29udGV4dFdpbmRvdzogNjRfMDAwLCAvLyBodHRwczovL2FwaS1kb2NzLmRlZXBzZWVrLmNvbS9xdWlja19zdGFydC9wcmljaW5nXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzAwMCwgLy8gOF8wMDAsXG5cdFx0Y29zdDogeyBjYWNoZV9yZWFkOiAuMDcsIGlucHV0OiAuMjcsIG91dHB1dDogMS4xMCwgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHR9LFxuXHQnZGVlcHNlZWstcmVhc29uZXInOiB7XG5cdFx0Li4ub3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdC5kZWVwc2Vla0NvZGVyVjIsXG5cdFx0Y29udGV4dFdpbmRvdzogNjRfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogOF8wMDAsIC8vIDhfMDAwLFxuXHRcdGNvc3Q6IHsgY2FjaGVfcmVhZDogLjE0LCBpbnB1dDogLjU1LCBvdXRwdXQ6IDIuMTksIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0fSxcbn0gYXMgY29uc3Qgc2F0aXNmaWVzIHsgW3M6IHN0cmluZ106IFZvaWRTdGF0aWNNb2RlbEluZm8gfVxuXG5cbmNvbnN0IGRlZXBzZWVrU2V0dGluZ3M6IFZvaWRTdGF0aWNQcm92aWRlckluZm8gPSB7XG5cdG1vZGVsT3B0aW9uczogZGVlcHNlZWtNb2RlbE9wdGlvbnMsXG5cdG1vZGVsT3B0aW9uc0ZhbGxiYWNrOiAobW9kZWxOYW1lKSA9PiB7IHJldHVybiBudWxsIH0sXG5cdHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5nczoge1xuXHRcdC8vIHJlYXNvbmluZzogT0FJQ29tcGF0ICsgIHJlc3BvbnNlLmNob2ljZXNbMF0uZGVsdGEucmVhc29uaW5nX2NvbnRlbnQgLy8gaHR0cHM6Ly9hcGktZG9jcy5kZWVwc2Vlay5jb20vZ3VpZGVzL3JlYXNvbmluZ19tb2RlbFxuXHRcdGlucHV0OiB7IGluY2x1ZGVJblBheWxvYWQ6IG9wZW5BSUNvbXBhdEluY2x1ZGVJblBheWxvYWRSZWFzb25pbmcgfSxcblx0XHRvdXRwdXQ6IHsgbmFtZU9mRmllbGRJbkRlbHRhOiAncmVhc29uaW5nX2NvbnRlbnQnIH0sXG5cdH0sXG59XG5cblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tIE1JU1RSQUwgLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCBtaXN0cmFsTW9kZWxPcHRpb25zID0geyAvLyBodHRwczovL21pc3RyYWwuYWkvcHJvZHVjdHMvbGEtcGxhdGVmb3JtZSNwcmljaW5nIGh0dHBzOi8vZG9jcy5taXN0cmFsLmFpL2dldHRpbmctc3RhcnRlZC9tb2RlbHMvbW9kZWxzX292ZXJ2aWV3LyNwcmVtaWVyLW1vZGVsc1xuXHQnbWlzdHJhbC1sYXJnZS1sYXRlc3QnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTMxXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDIuMDAsIG91dHB1dDogNi4wMCB9LFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiA3MyB9LFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnbWlzdHJhbC1tZWRpdW0tbGF0ZXN0JzogeyAvLyBodHRwczovL29wZW5yb3V0ZXIuYWkvbWlzdHJhbGFpL21pc3RyYWwtbWVkaXVtLTNcblx0XHRjb250ZXh0V2luZG93OiAxMzFfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogOF8xOTIsXG5cdFx0Y29zdDogeyBpbnB1dDogMC40MCwgb3V0cHV0OiAyLjAwIH0sXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdGRvd25sb2FkYWJsZTogeyBzaXplR2I6ICdub3Qta25vd24nIH0sXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdCdjb2Rlc3RyYWwtbGF0ZXN0Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDI1Nl8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5Mixcblx0XHRjb3N0OiB7IGlucHV0OiAwLjMwLCBvdXRwdXQ6IDAuOTAgfSxcblx0XHRzdXBwb3J0c0ZJTTogdHJ1ZSxcblx0XHRkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiAxMyB9LFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnbWFnaXN0cmFsLW1lZGl1bS1sYXRlc3QnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMjU2XzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMzAsIG91dHB1dDogMC45MCB9LCAvLyBUT0RPOiBjaGVjayB0aGlzXG5cdFx0c3VwcG9ydHNGSU06IHRydWUsXG5cdFx0ZG93bmxvYWRhYmxlOiB7IHNpemVHYjogMTMgfSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5JT1JlYXNvbmluZzogdHJ1ZSwgY2FuVHVybk9mZlJlYXNvbmluZzogZmFsc2UsIG9wZW5Tb3VyY2VUaGlua1RhZ3M6IFsnPHRoaW5rPicsICc8L3RoaW5rPiddIH0sXG5cdH0sXG5cdCdtYWdpc3RyYWwtc21hbGwtbGF0ZXN0Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDQwXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMzAsIG91dHB1dDogMC45MCB9LCAvLyBUT0RPOiBjaGVjayB0aGlzXG5cdFx0c3VwcG9ydHNGSU06IHRydWUsXG5cdFx0ZG93bmxvYWRhYmxlOiB7IHNpemVHYjogMTMgfSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5JT1JlYXNvbmluZzogdHJ1ZSwgY2FuVHVybk9mZlJlYXNvbmluZzogZmFsc2UsIG9wZW5Tb3VyY2VUaGlua1RhZ3M6IFsnPHRoaW5rPicsICc8L3RoaW5rPiddIH0sXG5cdH0sXG5cdCdkZXZzdHJhbC1zbWFsbC1sYXRlc3QnOiB7IC8vaHR0cHM6Ly9vcGVucm91dGVyLmFpL21pc3RyYWxhaS9kZXZzdHJhbC1zbWFsbDpmcmVlXG5cdFx0Y29udGV4dFdpbmRvdzogMTMxXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAsIG91dHB1dDogMCB9LFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiAxNCB9LCAvL2h0dHBzOi8vb2xsYW1hLmNvbS9saWJyYXJ5L2RldnN0cmFsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdCdtaW5pc3RyYWwtOGItbGF0ZXN0JzogeyAvLyBvbGxhbWEgJ21pc3RyYWwnXG5cdFx0Y29udGV4dFdpbmRvdzogMTMxXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMTAsIG91dHB1dDogMC4xMCB9LFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiA0LjEgfSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J21pbmlzdHJhbC0zYi1sYXRlc3QnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTMxXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDRfMDk2LFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMDQsIG91dHB1dDogMC4wNCB9LFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiAnbm90LWtub3duJyB9LFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxufSBhcyBjb25zdCBzYXRpc2ZpZXMgeyBbczogc3RyaW5nXTogVm9pZFN0YXRpY01vZGVsSW5mbyB9XG5cbmNvbnN0IG1pc3RyYWxTZXR0aW5nczogVm9pZFN0YXRpY1Byb3ZpZGVySW5mbyA9IHtcblx0bW9kZWxPcHRpb25zOiBtaXN0cmFsTW9kZWxPcHRpb25zLFxuXHRtb2RlbE9wdGlvbnNGYWxsYmFjazogKG1vZGVsTmFtZSkgPT4geyByZXR1cm4gbnVsbCB9LFxuXHRwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3M6IHtcblx0XHRpbnB1dDogeyBpbmNsdWRlSW5QYXlsb2FkOiBvcGVuQUlDb21wYXRJbmNsdWRlSW5QYXlsb2FkUmVhc29uaW5nIH0sXG5cdH0sXG59XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLSBHUk9RIC0tLS0tLS0tLS0tLS0tLS1cbmNvbnN0IGdyb3FNb2RlbE9wdGlvbnMgPSB7IC8vIGh0dHBzOi8vY29uc29sZS5ncm9xLmNvbS9kb2NzL21vZGVscywgaHR0cHM6Ly9ncm9xLmNvbS9wcmljaW5nL1xuXHQnbGxhbWEtMy4zLTcwYi12ZXJzYXRpbGUnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTI4XzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDMyXzc2OCwgLy8gMzJfNzY4LFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuNTksIG91dHB1dDogMC43OSB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnbGxhbWEtMy4xLThiLWluc3RhbnQnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTI4XzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDhfMTkyLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMDUsIG91dHB1dDogMC4wOCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQncXdlbi0yLjUtY29kZXItMzJiJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLCAvLyBub3Qgc3BlY2lmaWVkP1xuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuNzksIG91dHB1dDogMC43OSB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLCAvLyB1bmZvcnR1bmF0ZWx5IGxvb2tzIGxpa2Ugbm8gRklNIHN1cHBvcnQgb24gZ3JvcVxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQncXdlbi1xd3EtMzJiJzogeyAvLyBodHRwczovL2h1Z2dpbmdmYWNlLmNvL1F3ZW4vUXdRLTMyQlxuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLCAvLyBub3Qgc3BlY2lmaWVkP1xuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMjksIG91dHB1dDogMC4zOSB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IHsgc3VwcG9ydHNSZWFzb25pbmc6IHRydWUsIGNhbklPUmVhc29uaW5nOiB0cnVlLCBjYW5UdXJuT2ZmUmVhc29uaW5nOiBmYWxzZSwgb3BlblNvdXJjZVRoaW5rVGFnczogWyc8dGhpbms+JywgJzwvdGhpbms+J10gfSwgLy8gd2UncmUgdXNpbmcgcmVhc29uaW5nX2Zvcm1hdDpwYXJzZWQgc28gcmVhbGx5IGRvbid0IG5lZWQgdG8ga25vdyBvcGVuU291cmNlVGhpbmtUYWdzXG5cdH0sXG59IGFzIGNvbnN0IHNhdGlzZmllcyB7IFtzOiBzdHJpbmddOiBWb2lkU3RhdGljTW9kZWxJbmZvIH1cbmNvbnN0IGdyb3FTZXR0aW5nczogVm9pZFN0YXRpY1Byb3ZpZGVySW5mbyA9IHtcblx0bW9kZWxPcHRpb25zOiBncm9xTW9kZWxPcHRpb25zLFxuXHRtb2RlbE9wdGlvbnNGYWxsYmFjazogKG1vZGVsTmFtZSkgPT4geyByZXR1cm4gbnVsbCB9LFxuXHRwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3M6IHtcblx0XHQvLyBNdXN0IGJlIHNldCB0byBlaXRoZXIgcGFyc2VkIG9yIGhpZGRlbiB3aGVuIHVzaW5nIHRvb2wgY2FsbGluZyBodHRwczovL2NvbnNvbGUuZ3JvcS5jb20vZG9jcy9yZWFzb25pbmdcblx0XHRpbnB1dDoge1xuXHRcdFx0aW5jbHVkZUluUGF5bG9hZDogKHJlYXNvbmluZ0luZm8pID0+IHtcblx0XHRcdFx0aWYgKCFyZWFzb25pbmdJbmZvPy5pc1JlYXNvbmluZ0VuYWJsZWQpIHJldHVybiBudWxsXG5cdFx0XHRcdGlmIChyZWFzb25pbmdJbmZvLnR5cGUgPT09ICdidWRnZXRfc2xpZGVyX3ZhbHVlJykge1xuXHRcdFx0XHRcdHJldHVybiB7IHJlYXNvbmluZ19mb3JtYXQ6ICdwYXJzZWQnIH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0b3V0cHV0OiB7IG5hbWVPZkZpZWxkSW5EZWx0YTogJ3JlYXNvbmluZycgfSxcblx0fSxcbn1cblxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tIEdPT0dMRSBWRVJURVggKEdlbWluaSB2aWEgQURLKSAtLS0tLS0tLS0tLS0tLS0tXG5jb25zdCBnb29nbGVWZXJ0ZXhNb2RlbE9wdGlvbnMgPSB7XG5cdCdnZW1pbmktMi41LWZsYXNoJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDFfMDQ4XzU3Nixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDY1XzUzNixcblx0XHRjb3N0OiB7IGlucHV0OiAwLjE1LCBvdXRwdXQ6IDAuNjAgfSxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2dlbWluaS1zdHlsZScgYXMgY29uc3QsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7XG5cdFx0XHRjYW5JT1JlYXNvbmluZzogdHJ1ZSxcblx0XHR9LFxuXHR9LFxufSBhcyBjb25zdCBzYXRpc2ZpZXMgUmVjb3JkPHN0cmluZywgVm9pZFN0YXRpY01vZGVsSW5mbz5cbmNvbnN0IGdvb2dsZVZlcnRleFNldHRpbmdzOiBWb2lkU3RhdGljUHJvdmlkZXJJbmZvID0ge1xuXHRtb2RlbE9wdGlvbnM6IGdvb2dsZVZlcnRleE1vZGVsT3B0aW9ucyxcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IHtcblx0XHRpZiAobW9kZWxOYW1lLnN0YXJ0c1dpdGgoJ2dlbWluaS0nKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bW9kZWxOYW1lOiAnZ2VtaW5pLTIuNS1mbGFzaCcsXG5cdFx0XHRcdGNvbnRleHRXaW5kb3c6IDFfMDQ4XzU3Nixcblx0XHRcdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA2NV81MzYsXG5cdFx0XHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMTUsIG91dHB1dDogMC42MCB9LFxuXHRcdFx0XHRzcGVjaWFsVG9vbEZvcm1hdDogJ2dlbWluaS1zdHlsZScgYXMgY29uc3QsXG5cdFx0XHRcdHJlY29nbml6ZWRNb2RlbE5hbWU6ICdnZW1pbmktMi41LWZsYXNoJyxcblx0XHRcdFx0aXNVbnJlY29nbml6ZWRNb2RlbDogZmFsc2UsXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsXG5cdH0sXG5cdHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5nczoge1xuXHRcdGlucHV0OiB7IGluY2x1ZGVJblBheWxvYWQ6IG9wZW5BSUNvbXBhdEluY2x1ZGVJblBheWxvYWRSZWFzb25pbmcgfSxcblx0fSxcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLSBNSUNST1NPRlQgQVpVUkUgLS0tLS0tLS0tLS0tLS0tLVxuY29uc3QgbWljcm9zb2Z0QXp1cmVNb2RlbE9wdGlvbnMgPSB7XG59IGFzIGNvbnN0IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBWb2lkU3RhdGljTW9kZWxJbmZvPlxuY29uc3QgbWljcm9zb2Z0QXp1cmVTZXR0aW5nczogVm9pZFN0YXRpY1Byb3ZpZGVySW5mbyA9IHtcblx0bW9kZWxPcHRpb25zOiBtaWNyb3NvZnRBenVyZU1vZGVsT3B0aW9ucyxcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IHsgcmV0dXJuIG51bGwgfSxcblx0cHJvdmlkZXJSZWFzb25pbmdJT1NldHRpbmdzOiB7XG5cdFx0aW5wdXQ6IHsgaW5jbHVkZUluUGF5bG9hZDogb3BlbkFJQ29tcGF0SW5jbHVkZUluUGF5bG9hZFJlYXNvbmluZyB9LFxuXHR9LFxufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tIEFXUyBCRURST0NLIC0tLS0tLS0tLS0tLS0tLS1cbmNvbnN0IGF3c0JlZHJvY2tNb2RlbE9wdGlvbnMgPSB7XG59IGFzIGNvbnN0IHNhdGlzZmllcyBSZWNvcmQ8c3RyaW5nLCBWb2lkU3RhdGljTW9kZWxJbmZvPlxuXG5jb25zdCBhd3NCZWRyb2NrU2V0dGluZ3M6IFZvaWRTdGF0aWNQcm92aWRlckluZm8gPSB7XG5cdG1vZGVsT3B0aW9uczogYXdzQmVkcm9ja01vZGVsT3B0aW9ucyxcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IHsgcmV0dXJuIG51bGwgfSxcblx0cHJvdmlkZXJSZWFzb25pbmdJT1NldHRpbmdzOiB7XG5cdFx0aW5wdXQ6IHsgaW5jbHVkZUluUGF5bG9hZDogb3BlbkFJQ29tcGF0SW5jbHVkZUluUGF5bG9hZFJlYXNvbmluZyB9LFxuXHR9LFxufVxuXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0gVkxMTSwgT0xMQU1BLCBPUEVOQUlDT01QQVQgKHNlbGYtaG9zdGVkIC8gbG9jYWwpIC0tLS0tLS0tLS0tLS0tLS1cbmNvbnN0IG9sbGFtYU1vZGVsT3B0aW9ucyA9IHtcblx0J3F3ZW4yLjUtY29kZXI6N2InOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogbnVsbCxcblx0XHRjb3N0OiB7IGlucHV0OiAwLCBvdXRwdXQ6IDAgfSxcblx0XHRkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiAxLjkgfSxcblx0XHRzdXBwb3J0c0ZJTTogdHJ1ZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J3F3ZW4yLjUtY29kZXI6M2InOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMzJfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogbnVsbCxcblx0XHRjb3N0OiB7IGlucHV0OiAwLCBvdXRwdXQ6IDAgfSxcblx0XHRkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiAxLjkgfSxcblx0XHRzdXBwb3J0c0ZJTTogdHJ1ZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J3F3ZW4yLjUtY29kZXI6MS41Yic6IHtcblx0XHRjb250ZXh0V2luZG93OiAzMl8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAsIG91dHB1dDogMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogeyBzaXplR2I6IC45ODYgfSxcblx0XHRzdXBwb3J0c0ZJTTogdHJ1ZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2xsYW1hMy4xJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAsIG91dHB1dDogMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogeyBzaXplR2I6IDQuOSB9LFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J3F3ZW4yLjUtY29kZXInOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTI4XzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bGwsXG5cdFx0Y29zdDogeyBpbnB1dDogMCwgb3V0cHV0OiAwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiB7IHNpemVHYjogNC43IH0sXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQncXdxJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiAzMl8wMDAsXG5cdFx0Y29zdDogeyBpbnB1dDogMCwgb3V0cHV0OiAwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiB7IHNpemVHYjogMjAgfSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogeyBzdXBwb3J0c1JlYXNvbmluZzogdHJ1ZSwgY2FuSU9SZWFzb25pbmc6IGZhbHNlLCBjYW5UdXJuT2ZmUmVhc29uaW5nOiBmYWxzZSwgb3BlblNvdXJjZVRoaW5rVGFnczogWyc8dGhpbms+JywgJzwvdGhpbms+J10gfSxcblx0fSxcblx0J2RlZXBzZWVrLXIxJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAsIG91dHB1dDogMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogeyBzaXplR2I6IDQuNyB9LFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5JT1JlYXNvbmluZzogZmFsc2UsIGNhblR1cm5PZmZSZWFzb25pbmc6IGZhbHNlLCBvcGVuU291cmNlVGhpbmtUYWdzOiBbJzx0aGluaz4nLCAnPC90aGluaz4nXSB9LFxuXHR9LFxuXHQnZGV2c3RyYWw6bGF0ZXN0Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDEzMV8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiA4XzE5Mixcblx0XHRjb3N0OiB7IGlucHV0OiAwLCBvdXRwdXQ6IDAgfSxcblx0XHRkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiAxNCB9LFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblxufSBhcyBjb25zdCBzYXRpc2ZpZXMgUmVjb3JkPHN0cmluZywgVm9pZFN0YXRpY01vZGVsSW5mbz5cblxuZXhwb3J0IGNvbnN0IG9sbGFtYVJlY29tbWVuZGVkTW9kZWxzID0gWydxd2VuMi41LWNvZGVyOjEuNWInLCAnbGxhbWEzLjEnLCAncXdxJywgJ2RlZXBzZWVrLXIxJywgJ2RldnN0cmFsOmxhdGVzdCddIGFzIGNvbnN0IHNhdGlzZmllcyAoa2V5b2YgdHlwZW9mIG9sbGFtYU1vZGVsT3B0aW9ucylbXVxuXG5cbmNvbnN0IHZMTE1TZXR0aW5nczogVm9pZFN0YXRpY1Byb3ZpZGVySW5mbyA9IHtcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IGV4dGVuc2l2ZU1vZGVsT3B0aW9uc0ZhbGxiYWNrKG1vZGVsTmFtZSwgeyBkb3dubG9hZGFibGU6IHsgc2l6ZUdiOiAnbm90LWtub3duJyB9IH0pLFxuXHRtb2RlbE9wdGlvbnM6IHt9LFxuXHRwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3M6IHtcblx0XHQvLyByZWFzb25pbmc6IE9BSUNvbXBhdCArIHJlc3BvbnNlLmNob2ljZXNbMF0uZGVsdGEucmVhc29uaW5nX2NvbnRlbnQgLy8gaHR0cHM6Ly9kb2NzLnZsbG0uYWkvZW4vc3RhYmxlL2ZlYXR1cmVzL3JlYXNvbmluZ19vdXRwdXRzLmh0bWwjc3RyZWFtaW5nLWNoYXQtY29tcGxldGlvbnNcblx0XHRpbnB1dDogeyBpbmNsdWRlSW5QYXlsb2FkOiBvcGVuQUlDb21wYXRJbmNsdWRlSW5QYXlsb2FkUmVhc29uaW5nIH0sXG5cdFx0b3V0cHV0OiB7IG5hbWVPZkZpZWxkSW5EZWx0YTogJ3JlYXNvbmluZ19jb250ZW50JyB9LFxuXHR9LFxufVxuXG5jb25zdCBsbVN0dWRpb1NldHRpbmdzOiBWb2lkU3RhdGljUHJvdmlkZXJJbmZvID0ge1xuXHRtb2RlbE9wdGlvbnNGYWxsYmFjazogKG1vZGVsTmFtZSkgPT4gZXh0ZW5zaXZlTW9kZWxPcHRpb25zRmFsbGJhY2sobW9kZWxOYW1lLCB7IGRvd25sb2FkYWJsZTogeyBzaXplR2I6ICdub3Qta25vd24nIH0sIGNvbnRleHRXaW5kb3c6IDRfMDk2IH0pLFxuXHRtb2RlbE9wdGlvbnM6IHt9LFxuXHRwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3M6IHtcblx0XHRpbnB1dDogeyBpbmNsdWRlSW5QYXlsb2FkOiBvcGVuQUlDb21wYXRJbmNsdWRlSW5QYXlsb2FkUmVhc29uaW5nIH0sXG5cdFx0b3V0cHV0OiB7IG5lZWRzTWFudWFsUGFyc2U6IHRydWUgfSxcblx0fSxcbn1cblxuY29uc3Qgb2xsYW1hU2V0dGluZ3M6IFZvaWRTdGF0aWNQcm92aWRlckluZm8gPSB7XG5cdG1vZGVsT3B0aW9uc0ZhbGxiYWNrOiAobW9kZWxOYW1lKSA9PiBleHRlbnNpdmVNb2RlbE9wdGlvbnNGYWxsYmFjayhtb2RlbE5hbWUsIHsgZG93bmxvYWRhYmxlOiB7IHNpemVHYjogJ25vdC1rbm93bicgfSB9KSxcblx0bW9kZWxPcHRpb25zOiBvbGxhbWFNb2RlbE9wdGlvbnMsXG5cdHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5nczoge1xuXHRcdC8vIHJlYXNvbmluZzogd2UgbmVlZCB0byBmaWx0ZXIgb3V0IHJlYXNvbmluZyA8dGhpbms+IHRhZ3MgbWFudWFsbHlcblx0XHRpbnB1dDogeyBpbmNsdWRlSW5QYXlsb2FkOiBvcGVuQUlDb21wYXRJbmNsdWRlSW5QYXlsb2FkUmVhc29uaW5nIH0sXG5cdFx0b3V0cHV0OiB7IG5lZWRzTWFudWFsUGFyc2U6IHRydWUgfSxcblx0fSxcbn1cblxuY29uc3Qgb3BlbmFpQ29tcGF0aWJsZTogVm9pZFN0YXRpY1Byb3ZpZGVySW5mbyA9IHtcblx0bW9kZWxPcHRpb25zRmFsbGJhY2s6IChtb2RlbE5hbWUpID0+IGV4dGVuc2l2ZU1vZGVsT3B0aW9uc0ZhbGxiYWNrKG1vZGVsTmFtZSksXG5cdG1vZGVsT3B0aW9uczoge30sXG5cdHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5nczoge1xuXHRcdC8vIHJlYXNvbmluZzogd2UgaGF2ZSBubyBpZGVhIHdoYXQgZW5kcG9pbnQgdGhleSB1c2VkLCBzbyB3ZSBjYW4ndCBjb25zaXN0ZW50bHkgcGFyc2Ugb3V0IHJlYXNvbmluZ1xuXHRcdGlucHV0OiB7IGluY2x1ZGVJblBheWxvYWQ6IG9wZW5BSUNvbXBhdEluY2x1ZGVJblBheWxvYWRSZWFzb25pbmcgfSxcblx0XHRvdXRwdXQ6IHsgbmFtZU9mRmllbGRJbkRlbHRhOiAncmVhc29uaW5nX2NvbnRlbnQnIH0sXG5cdH0sXG59XG5cbmNvbnN0IGxpdGVMTE1TZXR0aW5nczogVm9pZFN0YXRpY1Byb3ZpZGVySW5mbyA9IHsgLy8gaHR0cHM6Ly9kb2NzLmxpdGVsbG0uYWkvZG9jcy9yZWFzb25pbmdfY29udGVudFxuXHRtb2RlbE9wdGlvbnNGYWxsYmFjazogKG1vZGVsTmFtZSkgPT4gZXh0ZW5zaXZlTW9kZWxPcHRpb25zRmFsbGJhY2sobW9kZWxOYW1lLCB7IGRvd25sb2FkYWJsZTogeyBzaXplR2I6ICdub3Qta25vd24nIH0gfSksXG5cdG1vZGVsT3B0aW9uczoge30sXG5cdHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5nczoge1xuXHRcdGlucHV0OiB7IGluY2x1ZGVJblBheWxvYWQ6IG9wZW5BSUNvbXBhdEluY2x1ZGVJblBheWxvYWRSZWFzb25pbmcgfSxcblx0XHRvdXRwdXQ6IHsgbmFtZU9mRmllbGRJbkRlbHRhOiAncmVhc29uaW5nX2NvbnRlbnQnIH0sXG5cdH0sXG59XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLSBPUEVOUk9VVEVSIC0tLS0tLS0tLS0tLS0tLS1cbmNvbnN0IG9wZW5Sb3V0ZXJNb2RlbE9wdGlvbnNfYXNzdW1pbmdPcGVuQUlDb21wYXQgPSB7XG5cdCdxd2VuL3F3ZW4zLTIzNWItYTIyYic6IHtcblx0XHRjb250ZXh0V2luZG93OiA0MF85NjAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IC4xMCwgb3V0cHV0OiAuMTAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiB7IHN1cHBvcnRzUmVhc29uaW5nOiB0cnVlLCBjYW5JT1JlYXNvbmluZzogdHJ1ZSwgY2FuVHVybk9mZlJlYXNvbmluZzogZmFsc2UgfSxcblx0fSxcblx0J21pY3Jvc29mdC9waGktNC1yZWFzb25pbmctcGx1czpmcmVlJzogeyAvLyBhIDE0QiBtb2RlbC4uLlxuXHRcdGNvbnRleHRXaW5kb3c6IDMyXzc2OCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bGwsXG5cdFx0Y29zdDogeyBpbnB1dDogMCwgb3V0cHV0OiAwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogeyBzdXBwb3J0c1JlYXNvbmluZzogdHJ1ZSwgY2FuSU9SZWFzb25pbmc6IHRydWUsIGNhblR1cm5PZmZSZWFzb25pbmc6IGZhbHNlIH0sXG5cdH0sXG5cdCdtaXN0cmFsYWkvbWlzdHJhbC1zbWFsbC0zLjEtMjRiLWluc3RydWN0OmZyZWUnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMTI4XzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bGwsXG5cdFx0Y29zdDogeyBpbnB1dDogMCwgb3V0cHV0OiAwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdCdnb29nbGUvZ2VtaW5pLTIuMC1mbGFzaC1saXRlLXByZXZpZXctMDItMDU6ZnJlZSc6IHtcblx0XHRjb250ZXh0V2luZG93OiAxXzA0OF81NzYsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAsIG91dHB1dDogMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnZ29vZ2xlL2dlbWluaS0yLjAtcHJvLWV4cC0wMi0wNTpmcmVlJzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDFfMDQ4XzU3Nixcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bGwsXG5cdFx0Y29zdDogeyBpbnB1dDogMCwgb3V0cHV0OiAwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdCdnb29nbGUvZ2VtaW5pLTIuMC1mbGFzaC1leHA6ZnJlZSc6IHtcblx0XHRjb250ZXh0V2luZG93OiAxXzA0OF81NzYsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAsIG91dHB1dDogMCB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdFx0c3VwcG9ydHNGSU06IGZhbHNlLFxuXHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogJ3N5c3RlbS1yb2xlJyxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnZGVlcHNlZWsvZGVlcHNlZWstcjEnOiB7XG5cdFx0Li4ub3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdC5kZWVwc2Vla1IxLFxuXHRcdGNvbnRleHRXaW5kb3c6IDEyOF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuOCwgb3V0cHV0OiAyLjQgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHR9LFxuXHQnYW50aHJvcGljL2NsYXVkZS1vcHVzLTQnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMjAwXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bGwsXG5cdFx0Y29zdDogeyBpbnB1dDogMTUuMDAsIG91dHB1dDogNzUuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2FudGhyb3BpYy9jbGF1ZGUtc29ubmV0LTQnOiB7XG5cdFx0Y29udGV4dFdpbmRvdzogMjAwXzAwMCxcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bGwsXG5cdFx0Y29zdDogeyBpbnB1dDogMTUuMDAsIG91dHB1dDogNzUuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J2FudGhyb3BpYy9jbGF1ZGUtMy43LXNvbm5ldDp0aGlua2luZyc6IHtcblx0XHRjb250ZXh0V2luZG93OiAyMDBfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogbnVsbCxcblx0XHRjb3N0OiB7IGlucHV0OiAzLjAwLCBvdXRwdXQ6IDE1LjAwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogeyAvLyBzYW1lIGFzIGFudGhyb3BpYywgc2VlIGFib3ZlXG5cdFx0XHRzdXBwb3J0c1JlYXNvbmluZzogdHJ1ZSxcblx0XHRcdGNhblR1cm5PZmZSZWFzb25pbmc6IGZhbHNlLFxuXHRcdFx0Y2FuSU9SZWFzb25pbmc6IHRydWUsXG5cdFx0XHRyZWFzb25pbmdSZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IDgxOTIsXG5cdFx0XHRyZWFzb25pbmdTbGlkZXI6IHsgdHlwZTogJ2J1ZGdldF9zbGlkZXInLCBtaW46IDEwMjQsIG1heDogODE5MiwgZGVmYXVsdDogMTAyNCB9LCAvLyB0aGV5IHJlY29tbWVuZCBiYXRjaGluZyBpZiBtYXggPiAzMl8wMDAuXG5cdFx0fSxcblx0fSxcblx0J2FudGhyb3BpYy9jbGF1ZGUtMy43LXNvbm5ldCc6IHtcblx0XHRjb250ZXh0V2luZG93OiAyMDBfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogbnVsbCxcblx0XHRjb3N0OiB7IGlucHV0OiAzLjAwLCBvdXRwdXQ6IDE1LjAwIH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRzdXBwb3J0c0ZJTTogZmFsc2UsXG5cdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiAnc3lzdGVtLXJvbGUnLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsIC8vIHN0dXBpZGx5LCBvcGVucm91dGVyIHNlcGFyYXRlcyB0aGlua2luZyBmcm9tIG5vbi10aGlua2luZ1xuXHR9LFxuXHQnYW50aHJvcGljL2NsYXVkZS0zLjUtc29ubmV0Jzoge1xuXHRcdGNvbnRleHRXaW5kb3c6IDIwMF8wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDMuMDAsIG91dHB1dDogMTUuMDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHN1cHBvcnRzRklNOiBmYWxzZSxcblx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2U6ICdzeXN0ZW0tcm9sZScsXG5cdFx0cmVhc29uaW5nQ2FwYWJpbGl0aWVzOiBmYWxzZSxcblx0fSxcblx0J21pc3RyYWxhaS9jb2Rlc3RyYWwtMjUwMSc6IHtcblx0XHQuLi5vcGVuU291cmNlTW9kZWxPcHRpb25zX2Fzc3VtaW5nT0FJQ29tcGF0LmNvZGVzdHJhbCxcblx0XHRjb250ZXh0V2luZG93OiAyNTZfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogbnVsbCxcblx0XHRjb3N0OiB7IGlucHV0OiAwLjMsIG91dHB1dDogMC45IH0sXG5cdFx0ZG93bmxvYWRhYmxlOiBmYWxzZSxcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXM6IGZhbHNlLFxuXHR9LFxuXHQnbWlzdHJhbGFpL2RldnN0cmFsLXNtYWxsOmZyZWUnOiB7XG5cdFx0Li4ub3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdC5kZXZzdHJhbCxcblx0XHRjb250ZXh0V2luZG93OiAxMzBfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogbnVsbCxcblx0XHRjb3N0OiB7IGlucHV0OiAwLCBvdXRwdXQ6IDAgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllczogZmFsc2UsXG5cdH0sXG5cdCdxd2VuL3F3ZW4tMi41LWNvZGVyLTMyYi1pbnN0cnVjdCc6IHtcblx0XHQuLi5vcGVuU291cmNlTW9kZWxPcHRpb25zX2Fzc3VtaW5nT0FJQ29tcGF0Wydxd2VuMi41Y29kZXInXSxcblx0XHRjb250ZXh0V2luZG93OiAzM18wMDAsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlOiBudWxsLFxuXHRcdGNvc3Q6IHsgaW5wdXQ6IDAuMDcsIG91dHB1dDogMC4xNiB9LFxuXHRcdGRvd25sb2FkYWJsZTogZmFsc2UsXG5cdH0sXG5cdCdxd2VuL3F3cS0zMmInOiB7XG5cdFx0Li4ub3BlblNvdXJjZU1vZGVsT3B0aW9uc19hc3N1bWluZ09BSUNvbXBhdFsncXdxJ10sXG5cdFx0Y29udGV4dFdpbmRvdzogMzNfMDAwLFxuXHRcdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZTogbnVsbCxcblx0XHRjb3N0OiB7IGlucHV0OiAwLjA3LCBvdXRwdXQ6IDAuMTYgfSxcblx0XHRkb3dubG9hZGFibGU6IGZhbHNlLFxuXHR9XG59IGFzIGNvbnN0IHNhdGlzZmllcyB7IFtzOiBzdHJpbmddOiBWb2lkU3RhdGljTW9kZWxJbmZvIH1cblxuY29uc3Qgb3BlblJvdXRlclNldHRpbmdzOiBWb2lkU3RhdGljUHJvdmlkZXJJbmZvID0ge1xuXHRtb2RlbE9wdGlvbnM6IG9wZW5Sb3V0ZXJNb2RlbE9wdGlvbnNfYXNzdW1pbmdPcGVuQUlDb21wYXQsXG5cdG1vZGVsT3B0aW9uc0ZhbGxiYWNrOiAobW9kZWxOYW1lKSA9PiB7XG5cdFx0Y29uc3QgcmVzID0gZXh0ZW5zaXZlTW9kZWxPcHRpb25zRmFsbGJhY2sobW9kZWxOYW1lKVxuXHRcdC8vIG9wZW5Sb3V0ZXIgZG9lcyBub3Qgc3VwcG9ydCBnZW1pbmktc3R5bGUsIHVzZSBvcGVuYWktc3R5bGUgaW5zdGVhZFxuXHRcdGlmIChyZXM/LnNwZWNpYWxUb29sRm9ybWF0ID09PSAnZ2VtaW5pLXN0eWxlJykge1xuXHRcdFx0cmVzLnNwZWNpYWxUb29sRm9ybWF0ID0gJ29wZW5haS1zdHlsZSdcblx0XHR9XG5cdFx0cmV0dXJuIHJlc1xuXHR9LFxuXHRwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3M6IHtcblx0XHQvLyByZWFzb25pbmc6IE9BSUNvbXBhdCArIHJlc3BvbnNlLmNob2ljZXNbMF0uZGVsdGEucmVhc29uaW5nIDogcGF5bG9hZCBzaG91bGQgaGF2ZSB7aW5jbHVkZV9yZWFzb25pbmc6IHRydWV9IGh0dHBzOi8vb3BlbnJvdXRlci5haS9hbm5vdW5jZW1lbnRzL3JlYXNvbmluZy10b2tlbnMtZm9yLXRoaW5raW5nLW1vZGVsc1xuXHRcdGlucHV0OiB7XG5cdFx0XHQvLyBodHRwczovL29wZW5yb3V0ZXIuYWkvZG9jcy91c2UtY2FzZXMvcmVhc29uaW5nLXRva2Vuc1xuXHRcdFx0aW5jbHVkZUluUGF5bG9hZDogKHJlYXNvbmluZ0luZm8pID0+IHtcblx0XHRcdFx0aWYgKCFyZWFzb25pbmdJbmZvPy5pc1JlYXNvbmluZ0VuYWJsZWQpIHJldHVybiBudWxsXG5cblx0XHRcdFx0aWYgKHJlYXNvbmluZ0luZm8udHlwZSA9PT0gJ2J1ZGdldF9zbGlkZXJfdmFsdWUnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHJlYXNvbmluZzoge1xuXHRcdFx0XHRcdFx0XHRtYXhfdG9rZW5zOiByZWFzb25pbmdJbmZvLnJlYXNvbmluZ0J1ZGdldFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocmVhc29uaW5nSW5mby50eXBlID09PSAnZWZmb3J0X3NsaWRlcl92YWx1ZScpXG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHJlYXNvbmluZzoge1xuXHRcdFx0XHRcdFx0XHRlZmZvcnQ6IHJlYXNvbmluZ0luZm8ucmVhc29uaW5nRWZmb3J0XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0b3V0cHV0OiB7IG5hbWVPZkZpZWxkSW5EZWx0YTogJ3JlYXNvbmluZycgfSxcblx0fSxcbn1cblxuXG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLSBtb2RlbCBzZXR0aW5ncyBvZiBldmVyeXRoaW5nIGFib3ZlIC0tLS0tLS0tLS0tLS0tLS1cblxuY29uc3QgbW9kZWxTZXR0aW5nc09mUHJvdmlkZXI6IHsgW3Byb3ZpZGVyTmFtZSBpbiBQcm92aWRlck5hbWVdOiBWb2lkU3RhdGljUHJvdmlkZXJJbmZvIH0gPSB7XG5cdGdvb2dsZVZlcnRleDogZ29vZ2xlVmVydGV4U2V0dGluZ3MsXG59IGFzIGNvbnN0XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLSBleHBvcnRzIC0tLS0tLS0tLS0tLS0tLS1cblxuLy8gcmV0dXJucyB0aGUgY2FwYWJpbGl0aWVzIGFuZCB0aGUgYWRqdXN0ZWQgbW9kZWxOYW1lIGlmIGl0IHdhcyBhIGZhbGxiYWNrXG5leHBvcnQgY29uc3QgZ2V0TW9kZWxDYXBhYmlsaXRpZXMgPSAoXG5cdHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLFxuXHRtb2RlbE5hbWU6IHN0cmluZyxcblx0b3ZlcnJpZGVzT2ZNb2RlbDogT3ZlcnJpZGVzT2ZNb2RlbCB8IHVuZGVmaW5lZFxuKTogVm9pZFN0YXRpY01vZGVsSW5mbyAmIChcblx0fCB7IG1vZGVsTmFtZTogc3RyaW5nOyByZWNvZ25pemVkTW9kZWxOYW1lOiBzdHJpbmc7IGlzVW5yZWNvZ25pemVkTW9kZWw6IGZhbHNlIH1cblx0fCB7IG1vZGVsTmFtZTogc3RyaW5nOyByZWNvZ25pemVkTW9kZWxOYW1lPzogdW5kZWZpbmVkOyBpc1VucmVjb2duaXplZE1vZGVsOiB0cnVlIH1cbikgPT4ge1xuXG5cdGNvbnN0IGxvd2VyY2FzZU1vZGVsTmFtZSA9IG1vZGVsTmFtZS50b0xvd2VyQ2FzZSgpXG5cblx0Y29uc3QgeyBtb2RlbE9wdGlvbnMsIG1vZGVsT3B0aW9uc0ZhbGxiYWNrIH0gPSBtb2RlbFNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdXG5cblx0Ly8gR2V0IGFueSBvdmVycmlkZSBzZXR0aW5ncyBmb3IgdGhpcyBtb2RlbFxuXHRjb25zdCBvdmVycmlkZXMgPSBvdmVycmlkZXNPZk1vZGVsPy5bcHJvdmlkZXJOYW1lXT8uW21vZGVsTmFtZV07XG5cblx0Ly8gc2VhcmNoIG1vZGVsIG9wdGlvbnMgb2JqZWN0IGRpcmVjdGx5IGZpcnN0XG5cdGZvciAoY29uc3QgbW9kZWxOYW1lXyBpbiBtb2RlbE9wdGlvbnMpIHtcblx0XHRjb25zdCBsb3dlcmNhc2VNb2RlbE5hbWVfID0gbW9kZWxOYW1lXy50b0xvd2VyQ2FzZSgpXG5cdFx0aWYgKGxvd2VyY2FzZU1vZGVsTmFtZSA9PT0gbG93ZXJjYXNlTW9kZWxOYW1lXykge1xuXHRcdFx0cmV0dXJuIHsgLi4ubW9kZWxPcHRpb25zW21vZGVsTmFtZV0sIC4uLm92ZXJyaWRlcywgbW9kZWxOYW1lLCByZWNvZ25pemVkTW9kZWxOYW1lOiBtb2RlbE5hbWUsIGlzVW5yZWNvZ25pemVkTW9kZWw6IGZhbHNlIH07XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgcmVzdWx0ID0gbW9kZWxPcHRpb25zRmFsbGJhY2sobW9kZWxOYW1lKVxuXHRpZiAocmVzdWx0KSB7XG5cdFx0cmV0dXJuIHsgLi4ucmVzdWx0LCAuLi5vdmVycmlkZXMsIG1vZGVsTmFtZTogcmVzdWx0Lm1vZGVsTmFtZSwgaXNVbnJlY29nbml6ZWRNb2RlbDogZmFsc2UgfTtcblx0fVxuXG5cdHJldHVybiB7IG1vZGVsTmFtZSwgLi4uZGVmYXVsdE1vZGVsT3B0aW9ucywgLi4ub3ZlcnJpZGVzLCBpc1VucmVjb2duaXplZE1vZGVsOiB0cnVlIH07XG59XG5cbi8vIG5vbi1tb2RlbCBzZXR0aW5nc1xuZXhwb3J0IGNvbnN0IGdldFByb3ZpZGVyQ2FwYWJpbGl0aWVzID0gKHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lKSA9PiB7XG5cdGNvbnN0IHsgcHJvdmlkZXJSZWFzb25pbmdJT1NldHRpbmdzIH0gPSBtb2RlbFNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdXG5cdHJldHVybiB7IHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5ncyB9XG59XG5cblxuZXhwb3J0IHR5cGUgU2VuZGFibGVSZWFzb25pbmdJbmZvID0ge1xuXHR0eXBlOiAnYnVkZ2V0X3NsaWRlcl92YWx1ZScsXG5cdGlzUmVhc29uaW5nRW5hYmxlZDogdHJ1ZSxcblx0cmVhc29uaW5nQnVkZ2V0OiBudW1iZXIsXG59IHwge1xuXHR0eXBlOiAnZWZmb3J0X3NsaWRlcl92YWx1ZScsXG5cdGlzUmVhc29uaW5nRW5hYmxlZDogdHJ1ZSxcblx0cmVhc29uaW5nRWZmb3J0OiBzdHJpbmcsXG59IHwgbnVsbFxuXG5cblxuZXhwb3J0IGNvbnN0IGdldElzUmVhc29uaW5nRW5hYmxlZFN0YXRlID0gKFxuXHRmZWF0dXJlTmFtZTogRmVhdHVyZU5hbWUsXG5cdHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLFxuXHRtb2RlbE5hbWU6IHN0cmluZyxcblx0bW9kZWxTZWxlY3Rpb25PcHRpb25zOiBNb2RlbFNlbGVjdGlvbk9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdG92ZXJyaWRlc09mTW9kZWw6IE92ZXJyaWRlc09mTW9kZWwgfCB1bmRlZmluZWQsXG4pID0+IHtcblx0Y29uc3QgeyBzdXBwb3J0c1JlYXNvbmluZywgY2FuVHVybk9mZlJlYXNvbmluZyB9ID0gZ2V0TW9kZWxDYXBhYmlsaXRpZXMocHJvdmlkZXJOYW1lLCBtb2RlbE5hbWUsIG92ZXJyaWRlc09mTW9kZWwpLnJlYXNvbmluZ0NhcGFiaWxpdGllcyB8fCB7fVxuXHRpZiAoIXN1cHBvcnRzUmVhc29uaW5nKSByZXR1cm4gZmFsc2VcblxuXHQvLyBkZWZhdWx0IHRvIGVuYWJsZWQgaWYgY2FuJ3QgdHVybiBvZmYsIG9yIGlmIHRoZSBmZWF0dXJlTmFtZSBpcyBDaGF0LlxuXHRjb25zdCBkZWZhdWx0RW5hYmxlZFZhbCA9IGZlYXR1cmVOYW1lID09PSAnQ2hhdCcgfHwgIWNhblR1cm5PZmZSZWFzb25pbmdcblxuXHRjb25zdCBpc1JlYXNvbmluZ0VuYWJsZWQgPSBtb2RlbFNlbGVjdGlvbk9wdGlvbnM/LnJlYXNvbmluZ0VuYWJsZWQgPz8gZGVmYXVsdEVuYWJsZWRWYWxcblx0cmV0dXJuIGlzUmVhc29uaW5nRW5hYmxlZFxufVxuXG5cbmV4cG9ydCBjb25zdCBnZXRSZXNlcnZlZE91dHB1dFRva2VuU3BhY2UgPSAocHJvdmlkZXJOYW1lOiBQcm92aWRlck5hbWUsIG1vZGVsTmFtZTogc3RyaW5nLCBvcHRzOiB7IGlzUmVhc29uaW5nRW5hYmxlZDogYm9vbGVhbiwgb3ZlcnJpZGVzT2ZNb2RlbDogT3ZlcnJpZGVzT2ZNb2RlbCB8IHVuZGVmaW5lZCB9KSA9PiB7XG5cdGNvbnN0IHtcblx0XHRyZWFzb25pbmdDYXBhYmlsaXRpZXMsXG5cdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlLFxuXHR9ID0gZ2V0TW9kZWxDYXBhYmlsaXRpZXMocHJvdmlkZXJOYW1lLCBtb2RlbE5hbWUsIG9wdHMub3ZlcnJpZGVzT2ZNb2RlbClcblx0cmV0dXJuIG9wdHMuaXNSZWFzb25pbmdFbmFibGVkICYmIHJlYXNvbmluZ0NhcGFiaWxpdGllcyA/IHJlYXNvbmluZ0NhcGFiaWxpdGllcy5yZWFzb25pbmdSZXNlcnZlZE91dHB1dFRva2VuU3BhY2UgOiByZXNlcnZlZE91dHB1dFRva2VuU3BhY2Vcbn1cblxuLy8gdXNlZCB0byBmb3JjZSByZWFzb25pbmcgc3RhdGUgKGNvbXBsZXgpIGludG8gc29tZXRoaW5nIHNpbXBsZSB3ZSBjYW4ganVzdCByZWFkIGZyb20gd2hlbiBzZW5kaW5nIGEgbWVzc2FnZVxuZXhwb3J0IGNvbnN0IGdldFNlbmRhYmxlUmVhc29uaW5nSW5mbyA9IChcblx0ZmVhdHVyZU5hbWU6IEZlYXR1cmVOYW1lLFxuXHRwcm92aWRlck5hbWU6IFByb3ZpZGVyTmFtZSxcblx0bW9kZWxOYW1lOiBzdHJpbmcsXG5cdG1vZGVsU2VsZWN0aW9uT3B0aW9uczogTW9kZWxTZWxlY3Rpb25PcHRpb25zIHwgdW5kZWZpbmVkLFxuXHRvdmVycmlkZXNPZk1vZGVsOiBPdmVycmlkZXNPZk1vZGVsIHwgdW5kZWZpbmVkLFxuKTogU2VuZGFibGVSZWFzb25pbmdJbmZvID0+IHtcblxuXHRjb25zdCB7IHJlYXNvbmluZ1NsaWRlcjogcmVhc29uaW5nQnVkZ2V0U2xpZGVyIH0gPSBnZXRNb2RlbENhcGFiaWxpdGllcyhwcm92aWRlck5hbWUsIG1vZGVsTmFtZSwgb3ZlcnJpZGVzT2ZNb2RlbCkucmVhc29uaW5nQ2FwYWJpbGl0aWVzIHx8IHt9XG5cdGNvbnN0IGlzUmVhc29uaW5nRW5hYmxlZCA9IGdldElzUmVhc29uaW5nRW5hYmxlZFN0YXRlKGZlYXR1cmVOYW1lLCBwcm92aWRlck5hbWUsIG1vZGVsTmFtZSwgbW9kZWxTZWxlY3Rpb25PcHRpb25zLCBvdmVycmlkZXNPZk1vZGVsKVxuXHRpZiAoIWlzUmVhc29uaW5nRW5hYmxlZCkgcmV0dXJuIG51bGxcblxuXHQvLyBjaGVjayBmb3IgcmVhc29uaW5nIGJ1ZGdldFxuXHRjb25zdCByZWFzb25pbmdCdWRnZXQgPSByZWFzb25pbmdCdWRnZXRTbGlkZXI/LnR5cGUgPT09ICdidWRnZXRfc2xpZGVyJyA/IG1vZGVsU2VsZWN0aW9uT3B0aW9ucz8ucmVhc29uaW5nQnVkZ2V0ID8/IHJlYXNvbmluZ0J1ZGdldFNsaWRlcj8uZGVmYXVsdCA6IHVuZGVmaW5lZFxuXHRpZiAocmVhc29uaW5nQnVkZ2V0KSB7XG5cdFx0cmV0dXJuIHsgdHlwZTogJ2J1ZGdldF9zbGlkZXJfdmFsdWUnLCBpc1JlYXNvbmluZ0VuYWJsZWQ6IGlzUmVhc29uaW5nRW5hYmxlZCwgcmVhc29uaW5nQnVkZ2V0OiByZWFzb25pbmdCdWRnZXQgfVxuXHR9XG5cblx0Ly8gY2hlY2sgZm9yIHJlYXNvbmluZyBlZmZvcnRcblx0Y29uc3QgcmVhc29uaW5nRWZmb3J0ID0gcmVhc29uaW5nQnVkZ2V0U2xpZGVyPy50eXBlID09PSAnZWZmb3J0X3NsaWRlcicgPyBtb2RlbFNlbGVjdGlvbk9wdGlvbnM/LnJlYXNvbmluZ0VmZm9ydCA/PyByZWFzb25pbmdCdWRnZXRTbGlkZXI/LmRlZmF1bHQgOiB1bmRlZmluZWRcblx0aWYgKHJlYXNvbmluZ0VmZm9ydCkge1xuXHRcdHJldHVybiB7IHR5cGU6ICdlZmZvcnRfc2xpZGVyX3ZhbHVlJywgaXNSZWFzb25pbmdFbmFibGVkOiBpc1JlYXNvbmluZ0VuYWJsZWQsIHJlYXNvbmluZ0VmZm9ydDogcmVhc29uaW5nRWZmb3J0IH1cblx0fVxuXG5cdHJldHVybiBudWxsXG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFXTyxNQUFN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
