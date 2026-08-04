import Anthropic from "@anthropic-ai/sdk";
import { Ollama } from "ollama";
import OpenAI, { AzureOpenAI } from "openai";
import { MistralCore } from "@mistralai/mistralai/core.js";
import { fimComplete } from "@mistralai/mistralai/funcs/fimComplete.js";
import { GoogleGenAI, Type } from "@google/genai";
import { GoogleAuth } from "google-auth-library";
import { displayInfoOfProviderName } from "../../common/voidSettingsTypes.js";
import { getSendableReasoningInfo, getModelCapabilities, getProviderCapabilities, defaultProviderSettings, getReservedOutputTokenSpace } from "../../common/modelCapabilities.js";
import { extractReasoningWrapper, extractXMLToolsWrapper } from "./extractGrammar.js";
import { availableTools } from "../../common/prompt/prompts.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
const getGoogleApiKey = async () => {
  const auth = new GoogleAuth({ scopes: `https://www.googleapis.com/auth/cloud-platform` });
  const key = await auth.getAccessToken();
  if (!key) throw new Error(`Google API failed to generate a key.`);
  return key;
};
const invalidApiKeyMessage = (providerName) => `Invalid ${displayInfoOfProviderName(providerName).title} API key.`;
const parseHeadersJSON = (s) => {
  if (!s) return void 0;
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error(`Error parsing OpenAI-Compatible headers: ${s} is not a valid JSON.`);
  }
};
const newOpenAICompatibleSDK = async ({ settingsOfProvider, providerName, includeInPayload }) => {
  const commonPayloadOpts = {
    dangerouslyAllowBrowser: true,
    ...includeInPayload
  };
  if (providerName === "openAI") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ apiKey: thisConfig.apiKey, ...commonPayloadOpts });
  } else if (providerName === "ollama") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ baseURL: `${thisConfig.endpoint}/v1`, apiKey: "noop", ...commonPayloadOpts });
  } else if (providerName === "vLLM") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ baseURL: `${thisConfig.endpoint}/v1`, apiKey: "noop", ...commonPayloadOpts });
  } else if (providerName === "liteLLM") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ baseURL: `${thisConfig.endpoint}/v1`, apiKey: "noop", ...commonPayloadOpts });
  } else if (providerName === "lmStudio") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ baseURL: `${thisConfig.endpoint}/v1`, apiKey: "noop", ...commonPayloadOpts });
  } else if (providerName === "openRouter") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: thisConfig.apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://voideditor.com",
        // Optional, for including your app on openrouter.ai rankings.
        "X-Title": "Void"
        // Optional. Shows in rankings on openrouter.ai.
      },
      ...commonPayloadOpts
    });
  } else if (providerName === "googleVertex") {
    const thisConfig = settingsOfProvider[providerName];
    const baseURL = `https://${thisConfig.region}-aiplatform.googleapis.com/v1/projects/${thisConfig.project}/locations/${thisConfig.region}/endpoints/${"openapi"}`;
    const apiKey = await getGoogleApiKey();
    return new OpenAI({ baseURL, apiKey, ...commonPayloadOpts });
  } else if (providerName === "microsoftAzure") {
    const thisConfig = settingsOfProvider[providerName];
    const endpoint = `https://${thisConfig.project}.openai.azure.com/`;
    const apiVersion = thisConfig.azureApiVersion ?? "2024-04-01-preview";
    const options = { endpoint, apiKey: thisConfig.apiKey, apiVersion };
    return new AzureOpenAI({ ...options, ...commonPayloadOpts });
  } else if (providerName === "awsBedrock") {
    const { endpoint, apiKey } = settingsOfProvider.awsBedrock;
    let baseURL = endpoint || "http://localhost:4000/v1";
    if (!baseURL.endsWith("/v1"))
      baseURL = baseURL.replace(/\/+$/, "") + "/v1";
    return new OpenAI({ baseURL, apiKey, ...commonPayloadOpts });
  } else if (providerName === "deepseek") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ baseURL: "https://api.deepseek.com/v1", apiKey: thisConfig.apiKey, ...commonPayloadOpts });
  } else if (providerName === "openAICompatible") {
    const thisConfig = settingsOfProvider[providerName];
    const headers = parseHeadersJSON(thisConfig.headersJSON);
    return new OpenAI({ baseURL: thisConfig.endpoint, apiKey: thisConfig.apiKey, defaultHeaders: headers, ...commonPayloadOpts });
  } else if (providerName === "groq") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: thisConfig.apiKey, ...commonPayloadOpts });
  } else if (providerName === "xAI") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ baseURL: "https://api.x.ai/v1", apiKey: thisConfig.apiKey, ...commonPayloadOpts });
  } else if (providerName === "mistral") {
    const thisConfig = settingsOfProvider[providerName];
    return new OpenAI({ baseURL: "https://api.mistral.ai/v1", apiKey: thisConfig.apiKey, ...commonPayloadOpts });
  } else throw new Error(`Void providerName was invalid: ${providerName}.`);
};
const _sendOpenAICompatibleFIM = async ({ messages: { prefix, suffix, stopTokens }, onFinalMessage, onError, settingsOfProvider, modelName: modelName_, _setAborter, providerName, overridesOfModel }) => {
  const {
    modelName,
    supportsFIM,
    additionalOpenAIPayload
  } = getModelCapabilities(providerName, modelName_, overridesOfModel);
  if (!supportsFIM) {
    if (modelName === modelName_)
      onError({ message: `Model ${modelName} does not support FIM.`, fullError: null });
    else
      onError({ message: `Model ${modelName_} (${modelName}) does not support FIM.`, fullError: null });
    return;
  }
  const openai = await newOpenAICompatibleSDK({ providerName, settingsOfProvider, includeInPayload: additionalOpenAIPayload });
  openai.completions.create({
    model: modelName,
    prompt: prefix,
    suffix,
    stop: stopTokens,
    max_tokens: 300
  }).then(async (response) => {
    const fullText = response.choices[0]?.text;
    onFinalMessage({ fullText, fullReasoning: "", anthropicReasoning: null });
  }).catch((error) => {
    if (error instanceof OpenAI.APIError && error.status === 401) {
      onError({ message: invalidApiKeyMessage(providerName), fullError: error });
    } else {
      onError({ message: error + "", fullError: error });
    }
  });
};
const toOpenAICompatibleTool = (toolInfo) => {
  const { name, description, params } = toolInfo;
  const paramsWithType = {};
  for (const key in params) {
    paramsWithType[key] = { ...params[key], type: "string" };
  }
  return {
    type: "function",
    function: {
      name,
      // strict: true, // strict mode - https://platform.openai.com/docs/guides/function-calling?api-mode=chat
      description,
      parameters: {
        type: "object",
        properties: params
        // required: Object.keys(params), // in strict mode, all params are required and additionalProperties is false
        // additionalProperties: false,
      }
    }
  };
};
const openAITools = (chatMode, mcpTools) => {
  const allowedTools = availableTools(chatMode, mcpTools);
  if (!allowedTools || Object.keys(allowedTools).length === 0) return null;
  const openAITools2 = [];
  for (const t in allowedTools ?? {}) {
    openAITools2.push(toOpenAICompatibleTool(allowedTools[t]));
  }
  return openAITools2;
};
const rawToolCallObjOfParamsStr = (name, toolParamsStr, id) => {
  let input;
  try {
    input = JSON.parse(toolParamsStr);
  } catch (e) {
    return null;
  }
  if (input === null) return null;
  if (typeof input !== "object") return null;
  const rawParams = input;
  return { id, name, rawParams, doneParams: Object.keys(rawParams), isDone: true };
};
const rawToolCallObjOfAnthropicParams = (toolBlock) => {
  const { id, name, input } = toolBlock;
  if (input === null) return null;
  if (typeof input !== "object") return null;
  const rawParams = input;
  return { id, name, rawParams, doneParams: Object.keys(rawParams), isDone: true };
};
const _sendOpenAICompatibleChat = async ({ messages, onText, onFinalMessage, onError, settingsOfProvider, modelSelectionOptions, modelName: modelName_, _setAborter, providerName, chatMode, separateSystemMessage, overridesOfModel, mcpTools }) => {
  const {
    modelName,
    specialToolFormat,
    reasoningCapabilities,
    additionalOpenAIPayload
  } = getModelCapabilities(providerName, modelName_, overridesOfModel);
  const { providerReasoningIOSettings } = getProviderCapabilities(providerName);
  const { canIOReasoning, openSourceThinkTags } = reasoningCapabilities || {};
  const reasoningInfo = getSendableReasoningInfo("Chat", providerName, modelName_, modelSelectionOptions, overridesOfModel);
  const includeInPayload = {
    ...providerReasoningIOSettings?.input?.includeInPayload?.(reasoningInfo),
    ...additionalOpenAIPayload
  };
  const potentialTools = openAITools(chatMode, mcpTools);
  const nativeToolsObj = potentialTools && specialToolFormat === "openai-style" ? { tools: potentialTools } : {};
  const openai = await newOpenAICompatibleSDK({ providerName, settingsOfProvider, includeInPayload });
  if (providerName === "microsoftAzure") {
    openai.deploymentName = modelName;
  }
  const options = {
    model: modelName,
    messages,
    stream: true,
    ...nativeToolsObj,
    ...additionalOpenAIPayload
    // max_completion_tokens: maxTokens,
  };
  const { needsManualParse: needsManualReasoningParse, nameOfFieldInDelta: nameOfReasoningFieldInDelta } = providerReasoningIOSettings?.output ?? {};
  const manuallyParseReasoning = needsManualReasoningParse && canIOReasoning && openSourceThinkTags;
  if (manuallyParseReasoning) {
    const { newOnText, newOnFinalMessage } = extractReasoningWrapper(onText, onFinalMessage, openSourceThinkTags);
    onText = newOnText;
    onFinalMessage = newOnFinalMessage;
  }
  if (!specialToolFormat) {
    const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(onText, onFinalMessage, chatMode, mcpTools);
    onText = newOnText;
    onFinalMessage = newOnFinalMessage;
  }
  let fullReasoningSoFar = "";
  let fullTextSoFar = "";
  let toolName = "";
  let toolId = "";
  let toolParamsStr = "";
  await openai.chat.completions.create(options).then(async (response) => {
    _setAborter(() => response.controller.abort());
    for await (const chunk of response) {
      const newText = chunk.choices[0]?.delta?.content ?? "";
      fullTextSoFar += newText;
      for (const tool of chunk.choices[0]?.delta?.tool_calls ?? []) {
        const index = tool.index;
        if (index !== 0) continue;
        toolName += tool.function?.name ?? "";
        toolParamsStr += tool.function?.arguments ?? "";
        toolId += tool.id ?? "";
      }
      let newReasoning = "";
      if (nameOfReasoningFieldInDelta) {
        newReasoning = (chunk.choices[0]?.delta?.[nameOfReasoningFieldInDelta] || "") + "";
        fullReasoningSoFar += newReasoning;
      }
      onText({
        fullText: fullTextSoFar,
        fullReasoning: fullReasoningSoFar,
        toolCall: !toolName ? void 0 : { name: toolName, rawParams: {}, isDone: false, doneParams: [], id: toolId }
      });
    }
    if (!fullTextSoFar && !fullReasoningSoFar && !toolName) {
      onError({ message: "Void: Response from model was empty.", fullError: null });
    } else {
      const toolCall = rawToolCallObjOfParamsStr(toolName, toolParamsStr, toolId);
      const toolCallObj = toolCall ? { toolCall } : {};
      onFinalMessage({ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, anthropicReasoning: null, ...toolCallObj });
    }
  }).catch((error) => {
    if (error instanceof OpenAI.APIError && error.status === 401) {
      onError({ message: invalidApiKeyMessage(providerName), fullError: error });
    } else {
      onError({ message: error + "", fullError: error });
    }
  });
};
const _openaiCompatibleList = async ({ onSuccess: onSuccess_, onError: onError_, settingsOfProvider, providerName }) => {
  const onSuccess = ({ models }) => {
    onSuccess_({ models });
  };
  const onError = ({ error }) => {
    onError_({ error });
  };
  try {
    const openai = await newOpenAICompatibleSDK({ providerName, settingsOfProvider });
    openai.models.list().then(async (response) => {
      const models = [];
      models.push(...response.data);
      while (response.hasNextPage()) {
        models.push(...(await response.getNextPage()).data);
      }
      onSuccess({ models });
    }).catch((error) => {
      onError({ error: error + "" });
    });
  } catch (error) {
    onError({ error: error + "" });
  }
};
const toAnthropicTool = (toolInfo) => {
  const { name, description, params } = toolInfo;
  const paramsWithType = {};
  for (const key in params) {
    paramsWithType[key] = { ...params[key], type: "string" };
  }
  return {
    name,
    description,
    input_schema: {
      type: "object",
      properties: paramsWithType
      // required: Object.keys(params),
    }
  };
};
const anthropicTools = (chatMode, mcpTools) => {
  const allowedTools = availableTools(chatMode, mcpTools);
  if (!allowedTools || Object.keys(allowedTools).length === 0) return null;
  const anthropicTools2 = [];
  for (const t in allowedTools ?? {}) {
    anthropicTools2.push(toAnthropicTool(allowedTools[t]));
  }
  return anthropicTools2;
};
const sendAnthropicChat = async ({ messages, providerName, onText, onFinalMessage, onError, settingsOfProvider, modelSelectionOptions, overridesOfModel, modelName: modelName_, _setAborter, separateSystemMessage, chatMode, mcpTools }) => {
  const {
    modelName,
    specialToolFormat
  } = getModelCapabilities(providerName, modelName_, overridesOfModel);
  const thisConfig = settingsOfProvider.anthropic;
  const { providerReasoningIOSettings } = getProviderCapabilities(providerName);
  const reasoningInfo = getSendableReasoningInfo("Chat", providerName, modelName_, modelSelectionOptions, overridesOfModel);
  const includeInPayload = providerReasoningIOSettings?.input?.includeInPayload?.(reasoningInfo) || {};
  const maxTokens = getReservedOutputTokenSpace(providerName, modelName_, { isReasoningEnabled: !!reasoningInfo?.isReasoningEnabled, overridesOfModel });
  const potentialTools = anthropicTools(chatMode, mcpTools);
  const nativeToolsObj = potentialTools && specialToolFormat === "anthropic-style" ? { tools: potentialTools, tool_choice: { type: "auto" } } : {};
  const anthropic = new Anthropic({
    apiKey: thisConfig.apiKey,
    dangerouslyAllowBrowser: true
  });
  const stream = anthropic.messages.stream({
    system: separateSystemMessage ?? void 0,
    messages,
    model: modelName,
    max_tokens: maxTokens ?? 4096,
    // anthropic requires this
    ...includeInPayload,
    ...nativeToolsObj
  });
  if (!specialToolFormat) {
    const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(onText, onFinalMessage, chatMode, mcpTools);
    onText = newOnText;
    onFinalMessage = newOnFinalMessage;
  }
  let fullText = "";
  let fullReasoning = "";
  let fullToolName = "";
  let fullToolParams = "";
  const runOnText = () => {
    onText({
      fullText,
      fullReasoning,
      toolCall: !fullToolName ? void 0 : { name: fullToolName, rawParams: {}, isDone: false, doneParams: [], id: "dummy" }
    });
  };
  stream.on("streamEvent", (e) => {
    if (e.type === "content_block_start") {
      if (e.content_block.type === "text") {
        if (fullText) fullText += "\n\n";
        fullText += e.content_block.text;
        runOnText();
      } else if (e.content_block.type === "thinking") {
        if (fullReasoning) fullReasoning += "\n\n";
        fullReasoning += e.content_block.thinking;
        runOnText();
      } else if (e.content_block.type === "redacted_thinking") {
        console.log("delta", e.content_block.type);
        if (fullReasoning) fullReasoning += "\n\n";
        fullReasoning += "[redacted_thinking]";
        runOnText();
      } else if (e.content_block.type === "tool_use") {
        fullToolName += e.content_block.name ?? "";
        runOnText();
      }
    } else if (e.type === "content_block_delta") {
      if (e.delta.type === "text_delta") {
        fullText += e.delta.text;
        runOnText();
      } else if (e.delta.type === "thinking_delta") {
        fullReasoning += e.delta.thinking;
        runOnText();
      } else if (e.delta.type === "input_json_delta") {
        fullToolParams += e.delta.partial_json ?? "";
        runOnText();
      }
    }
  });
  stream.on("finalMessage", (response) => {
    const anthropicReasoning = response.content.filter((c) => c.type === "thinking" || c.type === "redacted_thinking");
    const tools = response.content.filter((c) => c.type === "tool_use");
    const toolCall = tools[0] && rawToolCallObjOfAnthropicParams(tools[0]);
    const toolCallObj = toolCall ? { toolCall } : {};
    onFinalMessage({ fullText, fullReasoning, anthropicReasoning, ...toolCallObj });
  });
  stream.on("error", (error) => {
    if (error instanceof Anthropic.APIError && error.status === 401) {
      onError({ message: invalidApiKeyMessage(providerName), fullError: error });
    } else {
      onError({ message: error + "", fullError: error });
    }
  });
  _setAborter(() => stream.controller.abort());
};
const sendMistralFIM = ({ messages, onFinalMessage, onError, settingsOfProvider, overridesOfModel, modelName: modelName_, _setAborter, providerName }) => {
  const { modelName, supportsFIM } = getModelCapabilities(providerName, modelName_, overridesOfModel);
  if (!supportsFIM) {
    if (modelName === modelName_)
      onError({ message: `Model ${modelName} does not support FIM.`, fullError: null });
    else
      onError({ message: `Model ${modelName_} (${modelName}) does not support FIM.`, fullError: null });
    return;
  }
  const mistral = new MistralCore({ apiKey: settingsOfProvider.mistral.apiKey });
  fimComplete(
    mistral,
    {
      model: modelName,
      prompt: messages.prefix,
      suffix: messages.suffix,
      stream: false,
      maxTokens: 300,
      stop: messages.stopTokens
    }
  ).then(async (response) => {
    let content = response?.ok ? response.value.choices?.[0]?.message?.content ?? "" : "";
    const fullText = typeof content === "string" ? content : content.map((chunk) => chunk.type === "text" ? chunk.text : "").join("");
    onFinalMessage({ fullText, fullReasoning: "", anthropicReasoning: null });
  }).catch((error) => {
    onError({ message: error + "", fullError: error });
  });
};
const newOllamaSDK = ({ endpoint }) => {
  if (!endpoint) throw new Error(`Ollama Endpoint was empty (please enter ${defaultProviderSettings.ollama.endpoint} in Void if you want the default url).`);
  const ollama = new Ollama({ host: endpoint });
  return ollama;
};
const ollamaList = async ({ onSuccess: onSuccess_, onError: onError_, settingsOfProvider }) => {
  const onSuccess = ({ models }) => {
    onSuccess_({ models });
  };
  const onError = ({ error }) => {
    onError_({ error });
  };
  try {
    const thisConfig = settingsOfProvider.ollama;
    const ollama = newOllamaSDK({ endpoint: thisConfig.endpoint });
    ollama.list().then((response) => {
      const { models } = response;
      onSuccess({ models });
    }).catch((error) => {
      onError({ error: error + "" });
    });
  } catch (error) {
    onError({ error: error + "" });
  }
};
const sendOllamaFIM = ({ messages, onFinalMessage, onError, settingsOfProvider, modelName, _setAborter }) => {
  const thisConfig = settingsOfProvider.ollama;
  const ollama = newOllamaSDK({ endpoint: thisConfig.endpoint });
  let fullText = "";
  ollama.generate({
    model: modelName,
    prompt: messages.prefix,
    suffix: messages.suffix,
    options: {
      stop: messages.stopTokens,
      num_predict: 300
      // max tokens
      // repeat_penalty: 1,
    },
    raw: true,
    stream: true
    // stream is not necessary but lets us expose the
  }).then(async (stream) => {
    _setAborter(() => stream.abort());
    for await (const chunk of stream) {
      const newText = chunk.response;
      fullText += newText;
    }
    onFinalMessage({ fullText, fullReasoning: "", anthropicReasoning: null });
  }).catch((error) => {
    onError({ message: error + "", fullError: error });
  });
};
const toGeminiFunctionDecl = (toolInfo) => {
  const { name, description, params } = toolInfo;
  return {
    name,
    description,
    parameters: {
      type: Type.OBJECT,
      properties: Object.entries(params).reduce((acc, [key, value]) => {
        const paramType = value.type === "object" ? Type.OBJECT : value.type === "array" ? Type.ARRAY : Type.STRING;
        acc[key] = {
          type: paramType,
          description: value.description
        };
        return acc;
      }, {})
    }
  };
};
const geminiTools = (chatMode, mcpTools) => {
  const allowedTools = availableTools(chatMode, mcpTools);
  if (!allowedTools || Object.keys(allowedTools).length === 0) return null;
  const functionDecls = [];
  for (const t in allowedTools ?? {}) {
    functionDecls.push(toGeminiFunctionDecl(allowedTools[t]));
  }
  const tools = { functionDeclarations: functionDecls };
  return [tools];
};
// Singleton GoogleGenAI — auth token cached inside SDK after first call
let _plaxioGenAI = null;
const _getPlaxioGenAI = (project, location) => {
  if (!_plaxioGenAI) {
    const saKeyPath = new URL("../../../../../plaxio-sa-key.json", import.meta.url).pathname;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = saKeyPath;
    _plaxioGenAI = new GoogleGenAI({ vertexai: true, project, location });
  }
  return _plaxioGenAI;
};

// Context cache: maps hash of system prompt → {name, expiresAt}
const _plaxioContextCaches = new Map();
const _plaxioContextCacheModel = "gemini-2.5-flash-001";
let _plaxioCacheDisabled = false;
const _simplehash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(16);
};
const _getOrCreateContextCache = async (genAI, systemPrompt) => {
  if (_plaxioCacheDisabled) return null;
  const key = _simplehash(systemPrompt);
  const existing = _plaxioContextCaches.get(key);
  if (existing && existing.expiresAt > Date.now() + 60_000) return existing.name;
  try {
    const _cachePromise = genAI.caches.create({
      model: _plaxioContextCacheModel,
      config: { systemInstruction: systemPrompt, ttl: "3600s", displayName: "plaxio-plc-system-prompt" },
    });
    const _timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000));
    const cache = await Promise.race([_cachePromise, _timeout]);
    _plaxioContextCaches.set(key, { name: cache.name, expiresAt: Date.now() + 3_600_000 });
    return cache.name;
  } catch (e) {
    _plaxioCacheDisabled = true;
    console.warn("[Plaxio] Context cache unavailable, using inline prompt:", e?.message);
    return null;
  }
};
const sendGeminiChat = async ({
  messages,
  separateSystemMessage,
  onText,
  onFinalMessage,
  onError,
  settingsOfProvider,
  overridesOfModel,
  modelName: modelName_,
  _setAborter,
  providerName,
  modelSelectionOptions,
  chatMode,
  mcpTools
}) => {
  if (providerName !== "gemini" && providerName !== "googleVertex") throw new Error(`Sending Gemini chat, but provider was ${providerName}`);
  const thisConfig = settingsOfProvider[providerName];
  const {
    modelName,
    specialToolFormat
    // reasoningCapabilities,
  } = getModelCapabilities(providerName, modelName_, overridesOfModel);
  const reasoningInfo = getSendableReasoningInfo("Chat", providerName, modelName_, modelSelectionOptions, overridesOfModel);
  const potentialTools = geminiTools(chatMode, mcpTools);
  const toolConfig = potentialTools && specialToolFormat === "gemini-style" ? potentialTools : void 0;
  const vertexConfig = settingsOfProvider["googleVertex"];
  const genAI = _getPlaxioGenAI(vertexConfig.project || "videogen-496506", vertexConfig.region || "us-central1");
  if (!specialToolFormat) {
    const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(onText, onFinalMessage, chatMode, mcpTools);
    onText = newOnText;
    onFinalMessage = newOnFinalMessage;
  }
  let fullReasoningSoFar = "";
  let fullTextSoFar = "";
  let toolName = "";
  let toolParamsStr = "";
  let toolId = "";
  const allGeminiParts = [];
  try {
    let _cacheName = null;
    const _useCache = separateSystemMessage && separateSystemMessage.length > 20_000;
    if (_useCache) {
      _cacheName = await _getOrCreateContextCache(genAI, separateSystemMessage);
    }
    let stream;
    let _retryDelay = 10000;
    for (let _attempt = 0; _attempt < 4; _attempt++) {
      try {
        const _config = _cacheName
          ? { cachedContent: _cacheName, tools: toolConfig, maxOutputTokens: 8192 }
          : { systemInstruction: separateSystemMessage, tools: toolConfig, maxOutputTokens: 8192 };
        stream = await genAI.models.generateContentStream({
          model: _cacheName ? _plaxioContextCacheModel : modelName,
          config: _config,
          contents: messages,
        });
        break;
      } catch (_err) {
        if (_err?.status === 429 && _attempt < 3) {
          console.warn(`[Plaxio] Rate limited, retrying in ${_retryDelay/1000}s (attempt ${_attempt+1}/4)`);
          await new Promise(r => setTimeout(r, _retryDelay));
          _retryDelay = Math.min(_retryDelay * 2, 60000);
        } else { throw _err; }
      }
    }
    _setAborter(() => { stream.return(fullTextSoFar); });
    for await (const chunk of stream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (parts) allGeminiParts.push(...parts);
      const newText = chunk.text ?? "";
      fullTextSoFar += newText;
      const functionCalls = chunk.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const functionCall = functionCalls[0];
        toolName = functionCall.name ?? "";
        toolParamsStr = JSON.stringify(functionCall.args ?? {});
        toolId = functionCall.id ?? "";
      }
      onText({
        fullText: fullTextSoFar,
        fullReasoning: fullReasoningSoFar,
        toolCall: !toolName ? void 0 : { name: toolName, rawParams: {}, isDone: false, doneParams: [], id: toolId }
      });
    }
    if (!fullTextSoFar && !fullReasoningSoFar && !toolName) {
      onError({ message: "Gemini returned an empty response. This usually means the request was too large or was blocked by the safety filter. Try breaking your request into smaller parts or rephrasing it.", fullError: null });
    } else {
      if (!toolId) toolId = generateUuid();
      const toolCall = rawToolCallObjOfParamsStr(toolName, toolParamsStr, toolId);
      const toolCallObj = toolCall ? { toolCall } : {};
      onFinalMessage({ fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar, anthropicReasoning: null, _geminiParts: allGeminiParts, ...toolCallObj });
    }
  } catch (error) {
    const message = error?.message;
    if (typeof message === "string") {
      if (error.message?.includes("Could not load the default credentials") || error.message?.includes("Application Default Credentials")) {
        onError({ message: "AI is not available. Please sign in to Plaxio to use AI features.", fullError: error });
      } else if (error.message?.includes("API key")) {
        onError({ message: invalidApiKeyMessage(providerName), fullError: error });
      } else if (error?.message?.includes("429")) {
        onError({ message: "Rate limit reached. " + error, fullError: error });
      } else {
        onError({ message: error + "", fullError: error });
      }
    } else {
      onError({ message: error + "", fullError: error });
    }
  }
};
const sendLLMMessageToProviderImplementation = {
  googleVertex: {
    sendChat: (params) => sendGeminiChat(params),
    sendFIM: null,
    list: null,
  },
};
export {
  sendLLMMessageToProviderImplementation
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2VsZWN0cm9uLW1haW4vbGxtTWVzc2FnZS9zZW5kTExNTWVzc2FnZS5pbXBsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuLy8gZGlzYWJsZSBmb3JlaWduIGltcG9ydCBjb21wbGFpbnRzXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuaW1wb3J0IEFudGhyb3BpYyBmcm9tICdAYW50aHJvcGljLWFpL3Nkayc7XG5pbXBvcnQgeyBPbGxhbWEgfSBmcm9tICdvbGxhbWEnO1xuaW1wb3J0IE9wZW5BSSwgeyBDbGllbnRPcHRpb25zLCBBenVyZU9wZW5BSSB9IGZyb20gJ29wZW5haSc7XG5pbXBvcnQgeyBNaXN0cmFsQ29yZSB9IGZyb20gJ0BtaXN0cmFsYWkvbWlzdHJhbGFpL2NvcmUuanMnO1xuaW1wb3J0IHsgZmltQ29tcGxldGUgfSBmcm9tICdAbWlzdHJhbGFpL21pc3RyYWxhaS9mdW5jcy9maW1Db21wbGV0ZS5qcyc7XG5pbXBvcnQgeyBUb29sIGFzIEdlbWluaVRvb2wsIEZ1bmN0aW9uRGVjbGFyYXRpb24sIEdvb2dsZUdlbkFJLCBUaGlua2luZ0NvbmZpZywgU2NoZW1hLCBUeXBlIH0gZnJvbSAnQGdvb2dsZS9nZW5haSc7XG5pbXBvcnQgeyBHb29nbGVBdXRoIH0gZnJvbSAnZ29vZ2xlLWF1dGgtbGlicmFyeSdcbi8qIGVzbGludC1lbmFibGUgKi9cblxuaW1wb3J0IHsgQW50aHJvcGljTExNQ2hhdE1lc3NhZ2UsIEdlbWluaUxMTUNoYXRNZXNzYWdlLCBMTE1DaGF0TWVzc2FnZSwgTExNRklNTWVzc2FnZSwgTW9kZWxMaXN0UGFyYW1zLCBPbGxhbWFNb2RlbFJlc3BvbnNlLCBPbkVycm9yLCBPbkZpbmFsTWVzc2FnZSwgT25UZXh0LCBSYXdUb29sQ2FsbE9iaiwgUmF3VG9vbFBhcmFtc09iaiB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZW5kTExNTWVzc2FnZVR5cGVzLmpzJztcbmltcG9ydCB7IENoYXRNb2RlLCBkaXNwbGF5SW5mb09mUHJvdmlkZXJOYW1lLCBNb2RlbFNlbGVjdGlvbk9wdGlvbnMsIE92ZXJyaWRlc09mTW9kZWwsIFByb3ZpZGVyTmFtZSwgU2V0dGluZ3NPZlByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZvaWRTZXR0aW5nc1R5cGVzLmpzJztcbmltcG9ydCB7IGdldFNlbmRhYmxlUmVhc29uaW5nSW5mbywgZ2V0TW9kZWxDYXBhYmlsaXRpZXMsIGdldFByb3ZpZGVyQ2FwYWJpbGl0aWVzLCBkZWZhdWx0UHJvdmlkZXJTZXR0aW5ncywgZ2V0UmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsQ2FwYWJpbGl0aWVzLmpzJztcbmltcG9ydCB7IGV4dHJhY3RSZWFzb25pbmdXcmFwcGVyLCBleHRyYWN0WE1MVG9vbHNXcmFwcGVyIH0gZnJvbSAnLi9leHRyYWN0R3JhbW1hci5qcyc7XG5pbXBvcnQgeyBhdmFpbGFibGVUb29scywgSW50ZXJuYWxUb29sSW5mbyB9IGZyb20gJy4uLy4uL2NvbW1vbi9wcm9tcHQvcHJvbXB0cy5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcblxuY29uc3QgZ2V0R29vZ2xlQXBpS2V5ID0gYXN5bmMgKCkgPT4ge1xuXHQvLyBtb2R1bGVcdTIwMTFsZXZlbCBzaW5nbGV0b25cblx0Y29uc3QgYXV0aCA9IG5ldyBHb29nbGVBdXRoKHsgc2NvcGVzOiBgaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC9jbG91ZC1wbGF0Zm9ybWAgfSk7XG5cdGNvbnN0IGtleSA9IGF3YWl0IGF1dGguZ2V0QWNjZXNzVG9rZW4oKVxuXHRpZiAoIWtleSkgdGhyb3cgbmV3IEVycm9yKGBHb29nbGUgQVBJIGZhaWxlZCB0byBnZW5lcmF0ZSBhIGtleS5gKVxuXHRyZXR1cm4ga2V5XG59XG5cblxuXG5cbnR5cGUgSW50ZXJuYWxDb21tb25NZXNzYWdlUGFyYW1zID0ge1xuXHRvblRleHQ6IE9uVGV4dDtcblx0b25GaW5hbE1lc3NhZ2U6IE9uRmluYWxNZXNzYWdlO1xuXHRvbkVycm9yOiBPbkVycm9yO1xuXHRwcm92aWRlck5hbWU6IFByb3ZpZGVyTmFtZTtcblx0c2V0dGluZ3NPZlByb3ZpZGVyOiBTZXR0aW5nc09mUHJvdmlkZXI7XG5cdG1vZGVsU2VsZWN0aW9uT3B0aW9uczogTW9kZWxTZWxlY3Rpb25PcHRpb25zIHwgdW5kZWZpbmVkO1xuXHRvdmVycmlkZXNPZk1vZGVsOiBPdmVycmlkZXNPZk1vZGVsIHwgdW5kZWZpbmVkO1xuXHRtb2RlbE5hbWU6IHN0cmluZztcblx0X3NldEFib3J0ZXI6IChhYm9ydGVyOiAoKSA9PiB2b2lkKSA9PiB2b2lkO1xufVxuXG50eXBlIFNlbmRDaGF0UGFyYW1zX0ludGVybmFsID0gSW50ZXJuYWxDb21tb25NZXNzYWdlUGFyYW1zICYge1xuXHRtZXNzYWdlczogTExNQ2hhdE1lc3NhZ2VbXTtcblx0c2VwYXJhdGVTeXN0ZW1NZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGNoYXRNb2RlOiBDaGF0TW9kZSB8IG51bGw7XG5cdG1jcFRvb2xzOiBJbnRlcm5hbFRvb2xJbmZvW10gfCB1bmRlZmluZWQ7XG59XG50eXBlIFNlbmRGSU1QYXJhbXNfSW50ZXJuYWwgPSBJbnRlcm5hbENvbW1vbk1lc3NhZ2VQYXJhbXMgJiB7IG1lc3NhZ2VzOiBMTE1GSU1NZXNzYWdlOyBzZXBhcmF0ZVN5c3RlbU1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZDsgfVxuZXhwb3J0IHR5cGUgTGlzdFBhcmFtc19JbnRlcm5hbDxNb2RlbFJlc3BvbnNlPiA9IE1vZGVsTGlzdFBhcmFtczxNb2RlbFJlc3BvbnNlPlxuXG5cbmNvbnN0IGludmFsaWRBcGlLZXlNZXNzYWdlID0gKHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lKSA9PiBgSW52YWxpZCAke2Rpc3BsYXlJbmZvT2ZQcm92aWRlck5hbWUocHJvdmlkZXJOYW1lKS50aXRsZX0gQVBJIGtleS5gXG5cbi8vIC0tLS0tLS0tLS0tLSBPUEVOQUktQ09NUEFUSUJMRSAoSEVMUEVSUykgLS0tLS0tLS0tLS0tXG5cblxuXG5jb25zdCBwYXJzZUhlYWRlcnNKU09OID0gKHM6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQ+IHwgdW5kZWZpbmVkID0+IHtcblx0aWYgKCFzKSByZXR1cm4gdW5kZWZpbmVkXG5cdHRyeSB7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2Uocylcblx0fSBjYXRjaCAoZSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihgRXJyb3IgcGFyc2luZyBPcGVuQUktQ29tcGF0aWJsZSBoZWFkZXJzOiAke3N9IGlzIG5vdCBhIHZhbGlkIEpTT04uYClcblx0fVxufVxuXG5jb25zdCBuZXdPcGVuQUlDb21wYXRpYmxlU0RLID0gYXN5bmMgKHsgc2V0dGluZ3NPZlByb3ZpZGVyLCBwcm92aWRlck5hbWUsIGluY2x1ZGVJblBheWxvYWQgfTogeyBzZXR0aW5nc09mUHJvdmlkZXI6IFNldHRpbmdzT2ZQcm92aWRlciwgcHJvdmlkZXJOYW1lOiBQcm92aWRlck5hbWUsIGluY2x1ZGVJblBheWxvYWQ/OiB7IFtzOiBzdHJpbmddOiBhbnkgfSB9KSA9PiB7XG5cdGNvbnN0IGNvbW1vblBheWxvYWRPcHRzOiBDbGllbnRPcHRpb25zID0ge1xuXHRcdGRhbmdlcm91c2x5QWxsb3dCcm93c2VyOiB0cnVlLFxuXHRcdC4uLmluY2x1ZGVJblBheWxvYWQsXG5cdH1cblx0aWYgKHByb3ZpZGVyTmFtZSA9PT0gJ29wZW5BSScpIHtcblx0XHRjb25zdCB0aGlzQ29uZmlnID0gc2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV1cblx0XHRyZXR1cm4gbmV3IE9wZW5BSSh7IGFwaUtleTogdGhpc0NvbmZpZy5hcGlLZXksIC4uLmNvbW1vblBheWxvYWRPcHRzIH0pXG5cdH1cblx0ZWxzZSBpZiAocHJvdmlkZXJOYW1lID09PSAnb2xsYW1hJykge1xuXHRcdGNvbnN0IHRoaXNDb25maWcgPSBzZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXVxuXHRcdHJldHVybiBuZXcgT3BlbkFJKHsgYmFzZVVSTDogYCR7dGhpc0NvbmZpZy5lbmRwb2ludH0vdjFgLCBhcGlLZXk6ICdub29wJywgLi4uY29tbW9uUGF5bG9hZE9wdHMgfSlcblx0fVxuXHRlbHNlIGlmIChwcm92aWRlck5hbWUgPT09ICd2TExNJykge1xuXHRcdGNvbnN0IHRoaXNDb25maWcgPSBzZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXVxuXHRcdHJldHVybiBuZXcgT3BlbkFJKHsgYmFzZVVSTDogYCR7dGhpc0NvbmZpZy5lbmRwb2ludH0vdjFgLCBhcGlLZXk6ICdub29wJywgLi4uY29tbW9uUGF5bG9hZE9wdHMgfSlcblx0fVxuXHRlbHNlIGlmIChwcm92aWRlck5hbWUgPT09ICdsaXRlTExNJykge1xuXHRcdGNvbnN0IHRoaXNDb25maWcgPSBzZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXVxuXHRcdHJldHVybiBuZXcgT3BlbkFJKHsgYmFzZVVSTDogYCR7dGhpc0NvbmZpZy5lbmRwb2ludH0vdjFgLCBhcGlLZXk6ICdub29wJywgLi4uY29tbW9uUGF5bG9hZE9wdHMgfSlcblx0fVxuXHRlbHNlIGlmIChwcm92aWRlck5hbWUgPT09ICdsbVN0dWRpbycpIHtcblx0XHRjb25zdCB0aGlzQ29uZmlnID0gc2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV1cblx0XHRyZXR1cm4gbmV3IE9wZW5BSSh7IGJhc2VVUkw6IGAke3RoaXNDb25maWcuZW5kcG9pbnR9L3YxYCwgYXBpS2V5OiAnbm9vcCcsIC4uLmNvbW1vblBheWxvYWRPcHRzIH0pXG5cdH1cblx0ZWxzZSBpZiAocHJvdmlkZXJOYW1lID09PSAnb3BlblJvdXRlcicpIHtcblx0XHRjb25zdCB0aGlzQ29uZmlnID0gc2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV1cblx0XHRyZXR1cm4gbmV3IE9wZW5BSSh7XG5cdFx0XHRiYXNlVVJMOiAnaHR0cHM6Ly9vcGVucm91dGVyLmFpL2FwaS92MScsXG5cdFx0XHRhcGlLZXk6IHRoaXNDb25maWcuYXBpS2V5LFxuXHRcdFx0ZGVmYXVsdEhlYWRlcnM6IHtcblx0XHRcdFx0J0hUVFAtUmVmZXJlcic6ICdodHRwczovL3ZvaWRlZGl0b3IuY29tJywgLy8gT3B0aW9uYWwsIGZvciBpbmNsdWRpbmcgeW91ciBhcHAgb24gb3BlbnJvdXRlci5haSByYW5raW5ncy5cblx0XHRcdFx0J1gtVGl0bGUnOiAnVm9pZCcsIC8vIE9wdGlvbmFsLiBTaG93cyBpbiByYW5raW5ncyBvbiBvcGVucm91dGVyLmFpLlxuXHRcdFx0fSxcblx0XHRcdC4uLmNvbW1vblBheWxvYWRPcHRzLFxuXHRcdH0pXG5cdH1cblx0ZWxzZSBpZiAocHJvdmlkZXJOYW1lID09PSAnZ29vZ2xlVmVydGV4Jykge1xuXHRcdC8vIGh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS92ZXJ0ZXgtYWkvZ2VuZXJhdGl2ZS1haS9kb2NzL211bHRpbW9kYWwvY2FsbC12ZXJ0ZXgtdXNpbmctb3BlbmFpLWxpYnJhcnlcblx0XHRjb25zdCB0aGlzQ29uZmlnID0gc2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV1cblx0XHRjb25zdCBiYXNlVVJMID0gYGh0dHBzOi8vJHt0aGlzQ29uZmlnLnJlZ2lvbn0tYWlwbGF0Zm9ybS5nb29nbGVhcGlzLmNvbS92MS9wcm9qZWN0cy8ke3RoaXNDb25maWcucHJvamVjdH0vbG9jYXRpb25zLyR7dGhpc0NvbmZpZy5yZWdpb259L2VuZHBvaW50cy8keydvcGVuYXBpJ31gXG5cdFx0Y29uc3QgYXBpS2V5ID0gYXdhaXQgZ2V0R29vZ2xlQXBpS2V5KClcblx0XHRyZXR1cm4gbmV3IE9wZW5BSSh7IGJhc2VVUkw6IGJhc2VVUkwsIGFwaUtleTogYXBpS2V5LCAuLi5jb21tb25QYXlsb2FkT3B0cyB9KVxuXHR9XG5cdGVsc2UgaWYgKHByb3ZpZGVyTmFtZSA9PT0gJ21pY3Jvc29mdEF6dXJlJykge1xuXHRcdC8vIGh0dHBzOi8vbGVhcm4ubWljcm9zb2Z0LmNvbS9lbi11cy9yZXN0L2FwaS9haWZvdW5kcnkvbW9kZWwtaW5mZXJlbmNlL2dldC1jaGF0LWNvbXBsZXRpb25zL2dldC1jaGF0LWNvbXBsZXRpb25zP3ZpZXc9cmVzdC1haWZvdW5kcnktbW9kZWwtaW5mZXJlbmNlLTIwMjQtMDUtMDEtcHJldmlldyZ0YWJzPUhUVFBcblx0XHQvLyAgaHR0cHM6Ly9naXRodWIuY29tL29wZW5haS9vcGVuYWktbm9kZT90YWI9cmVhZG1lLW92LWZpbGUjbWljcm9zb2Z0LWF6dXJlLW9wZW5haVxuXHRcdGNvbnN0IHRoaXNDb25maWcgPSBzZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXVxuXHRcdGNvbnN0IGVuZHBvaW50ID0gYGh0dHBzOi8vJHt0aGlzQ29uZmlnLnByb2plY3R9Lm9wZW5haS5henVyZS5jb20vYDtcblx0XHRjb25zdCBhcGlWZXJzaW9uID0gdGhpc0NvbmZpZy5henVyZUFwaVZlcnNpb24gPz8gJzIwMjQtMDQtMDEtcHJldmlldyc7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHsgZW5kcG9pbnQsIGFwaUtleTogdGhpc0NvbmZpZy5hcGlLZXksIGFwaVZlcnNpb24gfTtcblx0XHRyZXR1cm4gbmV3IEF6dXJlT3BlbkFJKHsgLi4ub3B0aW9ucywgLi4uY29tbW9uUGF5bG9hZE9wdHMgfSk7XG5cdH1cblx0ZWxzZSBpZiAocHJvdmlkZXJOYW1lID09PSAnYXdzQmVkcm9jaycpIHtcblx0XHQvKipcblx0XHQgICogV2UgdHJlYXQgQmVkcm9jayBhcyAqT3BlbkFJLWNvbXBhdGlibGUgb25seSB0aHJvdWdoIGEgcHJveHkqOlxuXHRcdCAgKiAgIFx1MjAyMiBMaXRlTExNIGRlZmF1bHQgXHUyMTkyIGh0dHA6Ly9sb2NhbGhvc3Q6NDAwMC92MVxuXHRcdCAgKiAgIFx1MjAyMiBCZWRyb2NrLUFjY2Vzcy1HYXRld2F5IFx1MjE5MiBodHRwczovLzxhcGktaWQ+LmV4ZWN1dGUtYXBpLjxyZWdpb24+LmFtYXpvbmF3cy5jb20vb3BlbmFpL1xuXHRcdCAgKlxuXHRcdCAgKiBUaGUgbmF0aXZlIEJlZHJvY2sgcnVudGltZSBlbmRwb2ludFxuXHRcdCAgKiAgIGh0dHBzOi8vYmVkcm9jay1ydW50aW1lLjxyZWdpb24+LmFtYXpvbmF3cy5jb21cblx0XHQgICogaXMgKipOT1QqKiBPcGVuQUktY29tcGF0aWJsZSwgc28gd2UgZG8gKm5vdCogZmFsbCBiYWNrIHRvIGl0IGhlcmUuXG5cdFx0ICAqL1xuXHRcdGNvbnN0IHsgZW5kcG9pbnQsIGFwaUtleSB9ID0gc2V0dGluZ3NPZlByb3ZpZGVyLmF3c0JlZHJvY2tcblxuXHRcdC8vIFx1MjQ2MCB1c2UgdGhlIHVzZXItc3VwcGxpZWQgcHJveHkgaWYgcHJlc2VudFxuXHRcdC8vIFx1MjQ2MSBvdGhlcndpc2UgZGVmYXVsdCB0byBsb2NhbCBMaXRlTExNXG5cdFx0bGV0IGJhc2VVUkwgPSBlbmRwb2ludCB8fCAnaHR0cDovL2xvY2FsaG9zdDo0MDAwL3YxJ1xuXG5cdFx0Ly8gTm9ybWFsaXplOiBtYWtlIHN1cmUgd2UgZW5kIHdpdGggXHUyMDFDL3YxXHUyMDFEXG5cdFx0aWYgKCFiYXNlVVJMLmVuZHNXaXRoKCcvdjEnKSlcblx0XHRcdGJhc2VVUkwgPSBiYXNlVVJMLnJlcGxhY2UoL1xcLyskLywgJycpICsgJy92MSdcblxuXHRcdHJldHVybiBuZXcgT3BlbkFJKHsgYmFzZVVSTCwgYXBpS2V5LCAuLi5jb21tb25QYXlsb2FkT3B0cyB9KVxuXHR9XG5cblxuXHRlbHNlIGlmIChwcm92aWRlck5hbWUgPT09ICdkZWVwc2VlaycpIHtcblx0XHRjb25zdCB0aGlzQ29uZmlnID0gc2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV1cblx0XHRyZXR1cm4gbmV3IE9wZW5BSSh7IGJhc2VVUkw6ICdodHRwczovL2FwaS5kZWVwc2Vlay5jb20vdjEnLCBhcGlLZXk6IHRoaXNDb25maWcuYXBpS2V5LCAuLi5jb21tb25QYXlsb2FkT3B0cyB9KVxuXHR9XG5cdGVsc2UgaWYgKHByb3ZpZGVyTmFtZSA9PT0gJ29wZW5BSUNvbXBhdGlibGUnKSB7XG5cdFx0Y29uc3QgdGhpc0NvbmZpZyA9IHNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdXG5cdFx0Y29uc3QgaGVhZGVycyA9IHBhcnNlSGVhZGVyc0pTT04odGhpc0NvbmZpZy5oZWFkZXJzSlNPTilcblx0XHRyZXR1cm4gbmV3IE9wZW5BSSh7IGJhc2VVUkw6IHRoaXNDb25maWcuZW5kcG9pbnQsIGFwaUtleTogdGhpc0NvbmZpZy5hcGlLZXksIGRlZmF1bHRIZWFkZXJzOiBoZWFkZXJzLCAuLi5jb21tb25QYXlsb2FkT3B0cyB9KVxuXHR9XG5cdGVsc2UgaWYgKHByb3ZpZGVyTmFtZSA9PT0gJ2dyb3EnKSB7XG5cdFx0Y29uc3QgdGhpc0NvbmZpZyA9IHNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdXG5cdFx0cmV0dXJuIG5ldyBPcGVuQUkoeyBiYXNlVVJMOiAnaHR0cHM6Ly9hcGkuZ3JvcS5jb20vb3BlbmFpL3YxJywgYXBpS2V5OiB0aGlzQ29uZmlnLmFwaUtleSwgLi4uY29tbW9uUGF5bG9hZE9wdHMgfSlcblx0fVxuXHRlbHNlIGlmIChwcm92aWRlck5hbWUgPT09ICd4QUknKSB7XG5cdFx0Y29uc3QgdGhpc0NvbmZpZyA9IHNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdXG5cdFx0cmV0dXJuIG5ldyBPcGVuQUkoeyBiYXNlVVJMOiAnaHR0cHM6Ly9hcGkueC5haS92MScsIGFwaUtleTogdGhpc0NvbmZpZy5hcGlLZXksIC4uLmNvbW1vblBheWxvYWRPcHRzIH0pXG5cdH1cblx0ZWxzZSBpZiAocHJvdmlkZXJOYW1lID09PSAnbWlzdHJhbCcpIHtcblx0XHRjb25zdCB0aGlzQ29uZmlnID0gc2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV1cblx0XHRyZXR1cm4gbmV3IE9wZW5BSSh7IGJhc2VVUkw6ICdodHRwczovL2FwaS5taXN0cmFsLmFpL3YxJywgYXBpS2V5OiB0aGlzQ29uZmlnLmFwaUtleSwgLi4uY29tbW9uUGF5bG9hZE9wdHMgfSlcblx0fVxuXG5cdGVsc2UgdGhyb3cgbmV3IEVycm9yKGBWb2lkIHByb3ZpZGVyTmFtZSB3YXMgaW52YWxpZDogJHtwcm92aWRlck5hbWV9LmApXG59XG5cblxuY29uc3QgX3NlbmRPcGVuQUlDb21wYXRpYmxlRklNID0gYXN5bmMgKHsgbWVzc2FnZXM6IHsgcHJlZml4LCBzdWZmaXgsIHN0b3BUb2tlbnMgfSwgb25GaW5hbE1lc3NhZ2UsIG9uRXJyb3IsIHNldHRpbmdzT2ZQcm92aWRlciwgbW9kZWxOYW1lOiBtb2RlbE5hbWVfLCBfc2V0QWJvcnRlciwgcHJvdmlkZXJOYW1lLCBvdmVycmlkZXNPZk1vZGVsIH06IFNlbmRGSU1QYXJhbXNfSW50ZXJuYWwpID0+IHtcblxuXHRjb25zdCB7XG5cdFx0bW9kZWxOYW1lLFxuXHRcdHN1cHBvcnRzRklNLFxuXHRcdGFkZGl0aW9uYWxPcGVuQUlQYXlsb2FkLFxuXHR9ID0gZ2V0TW9kZWxDYXBhYmlsaXRpZXMocHJvdmlkZXJOYW1lLCBtb2RlbE5hbWVfLCBvdmVycmlkZXNPZk1vZGVsKVxuXG5cdGlmICghc3VwcG9ydHNGSU0pIHtcblx0XHRpZiAobW9kZWxOYW1lID09PSBtb2RlbE5hbWVfKVxuXHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6IGBNb2RlbCAke21vZGVsTmFtZX0gZG9lcyBub3Qgc3VwcG9ydCBGSU0uYCwgZnVsbEVycm9yOiBudWxsIH0pXG5cdFx0ZWxzZVxuXHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6IGBNb2RlbCAke21vZGVsTmFtZV99ICgke21vZGVsTmFtZX0pIGRvZXMgbm90IHN1cHBvcnQgRklNLmAsIGZ1bGxFcnJvcjogbnVsbCB9KVxuXHRcdHJldHVyblxuXHR9XG5cblx0Y29uc3Qgb3BlbmFpID0gYXdhaXQgbmV3T3BlbkFJQ29tcGF0aWJsZVNESyh7IHByb3ZpZGVyTmFtZSwgc2V0dGluZ3NPZlByb3ZpZGVyLCBpbmNsdWRlSW5QYXlsb2FkOiBhZGRpdGlvbmFsT3BlbkFJUGF5bG9hZCB9KVxuXHRvcGVuYWkuY29tcGxldGlvbnNcblx0XHQuY3JlYXRlKHtcblx0XHRcdG1vZGVsOiBtb2RlbE5hbWUsXG5cdFx0XHRwcm9tcHQ6IHByZWZpeCxcblx0XHRcdHN1ZmZpeDogc3VmZml4LFxuXHRcdFx0c3RvcDogc3RvcFRva2Vucyxcblx0XHRcdG1heF90b2tlbnM6IDMwMCxcblx0XHR9KVxuXHRcdC50aGVuKGFzeW5jIHJlc3BvbnNlID0+IHtcblx0XHRcdGNvbnN0IGZ1bGxUZXh0ID0gcmVzcG9uc2UuY2hvaWNlc1swXT8udGV4dFxuXHRcdFx0b25GaW5hbE1lc3NhZ2UoeyBmdWxsVGV4dCwgZnVsbFJlYXNvbmluZzogJycsIGFudGhyb3BpY1JlYXNvbmluZzogbnVsbCB9KTtcblx0XHR9KVxuXHRcdC5jYXRjaChlcnJvciA9PiB7XG5cdFx0XHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBPcGVuQUkuQVBJRXJyb3IgJiYgZXJyb3Iuc3RhdHVzID09PSA0MDEpIHsgb25FcnJvcih7IG1lc3NhZ2U6IGludmFsaWRBcGlLZXlNZXNzYWdlKHByb3ZpZGVyTmFtZSksIGZ1bGxFcnJvcjogZXJyb3IgfSk7IH1cblx0XHRcdGVsc2UgeyBvbkVycm9yKHsgbWVzc2FnZTogZXJyb3IgKyAnJywgZnVsbEVycm9yOiBlcnJvciB9KTsgfVxuXHRcdH0pXG59XG5cblxuY29uc3QgdG9PcGVuQUlDb21wYXRpYmxlVG9vbCA9ICh0b29sSW5mbzogSW50ZXJuYWxUb29sSW5mbykgPT4ge1xuXHRjb25zdCB7IG5hbWUsIGRlc2NyaXB0aW9uLCBwYXJhbXMgfSA9IHRvb2xJbmZvXG5cblx0Y29uc3QgcGFyYW1zV2l0aFR5cGU6IHsgW3M6IHN0cmluZ106IHsgZGVzY3JpcHRpb246IHN0cmluZzsgdHlwZTogJ3N0cmluZycgfSB9ID0ge31cblx0Zm9yIChjb25zdCBrZXkgaW4gcGFyYW1zKSB7IHBhcmFtc1dpdGhUeXBlW2tleV0gPSB7IC4uLnBhcmFtc1trZXldLCB0eXBlOiAnc3RyaW5nJyB9IH1cblxuXHRyZXR1cm4ge1xuXHRcdHR5cGU6ICdmdW5jdGlvbicsXG5cdFx0ZnVuY3Rpb246IHtcblx0XHRcdG5hbWU6IG5hbWUsXG5cdFx0XHQvLyBzdHJpY3Q6IHRydWUsIC8vIHN0cmljdCBtb2RlIC0gaHR0cHM6Ly9wbGF0Zm9ybS5vcGVuYWkuY29tL2RvY3MvZ3VpZGVzL2Z1bmN0aW9uLWNhbGxpbmc/YXBpLW1vZGU9Y2hhdFxuXHRcdFx0ZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uLFxuXHRcdFx0cGFyYW1ldGVyczoge1xuXHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0cHJvcGVydGllczogcGFyYW1zLFxuXHRcdFx0XHQvLyByZXF1aXJlZDogT2JqZWN0LmtleXMocGFyYW1zKSwgLy8gaW4gc3RyaWN0IG1vZGUsIGFsbCBwYXJhbXMgYXJlIHJlcXVpcmVkIGFuZCBhZGRpdGlvbmFsUHJvcGVydGllcyBpcyBmYWxzZVxuXHRcdFx0XHQvLyBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHR9LFxuXHRcdH1cblx0fSBzYXRpc2ZpZXMgT3BlbkFJLkNoYXQuQ29tcGxldGlvbnMuQ2hhdENvbXBsZXRpb25Ub29sXG59XG5cbmNvbnN0IG9wZW5BSVRvb2xzID0gKGNoYXRNb2RlOiBDaGF0TW9kZSB8IG51bGwsIG1jcFRvb2xzOiBJbnRlcm5hbFRvb2xJbmZvW10gfCB1bmRlZmluZWQpID0+IHtcblx0Y29uc3QgYWxsb3dlZFRvb2xzID0gYXZhaWxhYmxlVG9vbHMoY2hhdE1vZGUsIG1jcFRvb2xzKVxuXHRpZiAoIWFsbG93ZWRUb29scyB8fCBPYmplY3Qua2V5cyhhbGxvd2VkVG9vbHMpLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGxcblxuXHRjb25zdCBvcGVuQUlUb29sczogT3BlbkFJLkNoYXQuQ29tcGxldGlvbnMuQ2hhdENvbXBsZXRpb25Ub29sW10gPSBbXVxuXHRmb3IgKGNvbnN0IHQgaW4gYWxsb3dlZFRvb2xzID8/IHt9KSB7XG5cdFx0b3BlbkFJVG9vbHMucHVzaCh0b09wZW5BSUNvbXBhdGlibGVUb29sKGFsbG93ZWRUb29sc1t0XSkpXG5cdH1cblx0cmV0dXJuIG9wZW5BSVRvb2xzXG59XG5cblxuLy8gY29udmVydCBMTE0gdG9vbCBjYWxsIHRvIG91ciB0b29sIGZvcm1hdFxuY29uc3QgcmF3VG9vbENhbGxPYmpPZlBhcmFtc1N0ciA9IChuYW1lOiBzdHJpbmcsIHRvb2xQYXJhbXNTdHI6IHN0cmluZywgaWQ6IHN0cmluZyk6IFJhd1Rvb2xDYWxsT2JqIHwgbnVsbCA9PiB7XG5cdGxldCBpbnB1dDogdW5rbm93blxuXHR0cnkgeyBpbnB1dCA9IEpTT04ucGFyc2UodG9vbFBhcmFtc1N0cikgfVxuXHRjYXRjaCAoZSkgeyByZXR1cm4gbnVsbCB9XG5cblx0aWYgKGlucHV0ID09PSBudWxsKSByZXR1cm4gbnVsbFxuXHRpZiAodHlwZW9mIGlucHV0ICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGxcblxuXHRjb25zdCByYXdQYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmogPSBpbnB1dFxuXHRyZXR1cm4geyBpZCwgbmFtZSwgcmF3UGFyYW1zLCBkb25lUGFyYW1zOiBPYmplY3Qua2V5cyhyYXdQYXJhbXMpLCBpc0RvbmU6IHRydWUgfVxufVxuXG5cbmNvbnN0IHJhd1Rvb2xDYWxsT2JqT2ZBbnRocm9waWNQYXJhbXMgPSAodG9vbEJsb2NrOiBBbnRocm9waWMuTWVzc2FnZXMuVG9vbFVzZUJsb2NrKTogUmF3VG9vbENhbGxPYmogfCBudWxsID0+IHtcblx0Y29uc3QgeyBpZCwgbmFtZSwgaW5wdXQgfSA9IHRvb2xCbG9ja1xuXG5cdGlmIChpbnB1dCA9PT0gbnVsbCkgcmV0dXJuIG51bGxcblx0aWYgKHR5cGVvZiBpbnB1dCAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsXG5cblx0Y29uc3QgcmF3UGFyYW1zOiBSYXdUb29sUGFyYW1zT2JqID0gaW5wdXRcblx0cmV0dXJuIHsgaWQsIG5hbWUsIHJhd1BhcmFtcywgZG9uZVBhcmFtczogT2JqZWN0LmtleXMocmF3UGFyYW1zKSwgaXNEb25lOiB0cnVlIH1cbn1cblxuXG4vLyAtLS0tLS0tLS0tLS0gT1BFTkFJLUNPTVBBVElCTEUgLS0tLS0tLS0tLS0tXG5cblxuY29uc3QgX3NlbmRPcGVuQUlDb21wYXRpYmxlQ2hhdCA9IGFzeW5jICh7IG1lc3NhZ2VzLCBvblRleHQsIG9uRmluYWxNZXNzYWdlLCBvbkVycm9yLCBzZXR0aW5nc09mUHJvdmlkZXIsIG1vZGVsU2VsZWN0aW9uT3B0aW9ucywgbW9kZWxOYW1lOiBtb2RlbE5hbWVfLCBfc2V0QWJvcnRlciwgcHJvdmlkZXJOYW1lLCBjaGF0TW9kZSwgc2VwYXJhdGVTeXN0ZW1NZXNzYWdlLCBvdmVycmlkZXNPZk1vZGVsLCBtY3BUb29scyB9OiBTZW5kQ2hhdFBhcmFtc19JbnRlcm5hbCkgPT4ge1xuXHRjb25zdCB7XG5cdFx0bW9kZWxOYW1lLFxuXHRcdHNwZWNpYWxUb29sRm9ybWF0LFxuXHRcdHJlYXNvbmluZ0NhcGFiaWxpdGllcyxcblx0XHRhZGRpdGlvbmFsT3BlbkFJUGF5bG9hZCxcblx0fSA9IGdldE1vZGVsQ2FwYWJpbGl0aWVzKHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lXywgb3ZlcnJpZGVzT2ZNb2RlbClcblxuXHRjb25zdCB7IHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5ncyB9ID0gZ2V0UHJvdmlkZXJDYXBhYmlsaXRpZXMocHJvdmlkZXJOYW1lKVxuXG5cdC8vIHJlYXNvbmluZ1xuXHRjb25zdCB7IGNhbklPUmVhc29uaW5nLCBvcGVuU291cmNlVGhpbmtUYWdzIH0gPSByZWFzb25pbmdDYXBhYmlsaXRpZXMgfHwge31cblx0Y29uc3QgcmVhc29uaW5nSW5mbyA9IGdldFNlbmRhYmxlUmVhc29uaW5nSW5mbygnQ2hhdCcsIHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lXywgbW9kZWxTZWxlY3Rpb25PcHRpb25zLCBvdmVycmlkZXNPZk1vZGVsKSAvLyB1c2VyJ3MgbW9kZWxOYW1lXyBoZXJlXG5cblx0Y29uc3QgaW5jbHVkZUluUGF5bG9hZCA9IHtcblx0XHQuLi5wcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3M/LmlucHV0Py5pbmNsdWRlSW5QYXlsb2FkPy4ocmVhc29uaW5nSW5mbyksXG5cdFx0Li4uYWRkaXRpb25hbE9wZW5BSVBheWxvYWRcblx0fVxuXG5cdC8vIHRvb2xzXG5cdGNvbnN0IHBvdGVudGlhbFRvb2xzID0gb3BlbkFJVG9vbHMoY2hhdE1vZGUsIG1jcFRvb2xzKVxuXHRjb25zdCBuYXRpdmVUb29sc09iaiA9IHBvdGVudGlhbFRvb2xzICYmIHNwZWNpYWxUb29sRm9ybWF0ID09PSAnb3BlbmFpLXN0eWxlJyA/XG5cdFx0eyB0b29sczogcG90ZW50aWFsVG9vbHMgfSBhcyBjb25zdFxuXHRcdDoge31cblxuXHQvLyBpbnN0YW5jZVxuXHRjb25zdCBvcGVuYWk6IE9wZW5BSSA9IGF3YWl0IG5ld09wZW5BSUNvbXBhdGlibGVTREsoeyBwcm92aWRlck5hbWUsIHNldHRpbmdzT2ZQcm92aWRlciwgaW5jbHVkZUluUGF5bG9hZCB9KVxuXHRpZiAocHJvdmlkZXJOYW1lID09PSAnbWljcm9zb2Z0QXp1cmUnKSB7XG5cdFx0Ly8gUmVxdWlyZWQgdG8gc2VsZWN0IHRoZSBtb2RlbFxuXHRcdChvcGVuYWkgYXMgQXp1cmVPcGVuQUkpLmRlcGxveW1lbnROYW1lID0gbW9kZWxOYW1lO1xuXHR9XG5cdGNvbnN0IG9wdGlvbnM6IE9wZW5BSS5DaGF0LkNvbXBsZXRpb25zLkNoYXRDb21wbGV0aW9uQ3JlYXRlUGFyYW1zU3RyZWFtaW5nID0ge1xuXHRcdG1vZGVsOiBtb2RlbE5hbWUsXG5cdFx0bWVzc2FnZXM6IG1lc3NhZ2VzIGFzIGFueSxcblx0XHRzdHJlYW06IHRydWUsXG5cdFx0Li4ubmF0aXZlVG9vbHNPYmosXG5cdFx0Li4uYWRkaXRpb25hbE9wZW5BSVBheWxvYWRcblx0XHQvLyBtYXhfY29tcGxldGlvbl90b2tlbnM6IG1heFRva2Vucyxcblx0fVxuXG5cdC8vIG9wZW4gc291cmNlIG1vZGVscyAtIG1hbnVhbGx5IHBhcnNlIHRoaW5rIHRva2Vuc1xuXHRjb25zdCB7IG5lZWRzTWFudWFsUGFyc2U6IG5lZWRzTWFudWFsUmVhc29uaW5nUGFyc2UsIG5hbWVPZkZpZWxkSW5EZWx0YTogbmFtZU9mUmVhc29uaW5nRmllbGRJbkRlbHRhIH0gPSBwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3M/Lm91dHB1dCA/PyB7fVxuXHRjb25zdCBtYW51YWxseVBhcnNlUmVhc29uaW5nID0gbmVlZHNNYW51YWxSZWFzb25pbmdQYXJzZSAmJiBjYW5JT1JlYXNvbmluZyAmJiBvcGVuU291cmNlVGhpbmtUYWdzXG5cdGlmIChtYW51YWxseVBhcnNlUmVhc29uaW5nKSB7XG5cdFx0Y29uc3QgeyBuZXdPblRleHQsIG5ld09uRmluYWxNZXNzYWdlIH0gPSBleHRyYWN0UmVhc29uaW5nV3JhcHBlcihvblRleHQsIG9uRmluYWxNZXNzYWdlLCBvcGVuU291cmNlVGhpbmtUYWdzKVxuXHRcdG9uVGV4dCA9IG5ld09uVGV4dFxuXHRcdG9uRmluYWxNZXNzYWdlID0gbmV3T25GaW5hbE1lc3NhZ2Vcblx0fVxuXG5cdC8vIG1hbnVhbGx5IHBhcnNlIG91dCB0b29sIHJlc3VsdHMgaWYgWE1MXG5cdGlmICghc3BlY2lhbFRvb2xGb3JtYXQpIHtcblx0XHRjb25zdCB7IG5ld09uVGV4dCwgbmV3T25GaW5hbE1lc3NhZ2UgfSA9IGV4dHJhY3RYTUxUb29sc1dyYXBwZXIob25UZXh0LCBvbkZpbmFsTWVzc2FnZSwgY2hhdE1vZGUsIG1jcFRvb2xzKVxuXHRcdG9uVGV4dCA9IG5ld09uVGV4dFxuXHRcdG9uRmluYWxNZXNzYWdlID0gbmV3T25GaW5hbE1lc3NhZ2Vcblx0fVxuXG5cdGxldCBmdWxsUmVhc29uaW5nU29GYXIgPSAnJ1xuXHRsZXQgZnVsbFRleHRTb0ZhciA9ICcnXG5cblx0bGV0IHRvb2xOYW1lID0gJydcblx0bGV0IHRvb2xJZCA9ICcnXG5cdGxldCB0b29sUGFyYW1zU3RyID0gJydcblxuXHRvcGVuYWkuY2hhdC5jb21wbGV0aW9uc1xuXHRcdC5jcmVhdGUob3B0aW9ucylcblx0XHQudGhlbihhc3luYyByZXNwb25zZSA9PiB7XG5cdFx0XHRfc2V0QWJvcnRlcigoKSA9PiByZXNwb25zZS5jb250cm9sbGVyLmFib3J0KCkpXG5cdFx0XHQvLyB3aGVuIHJlY2VpdmUgdGV4dFxuXHRcdFx0Zm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiByZXNwb25zZSkge1xuXHRcdFx0XHQvLyBtZXNzYWdlXG5cdFx0XHRcdGNvbnN0IG5ld1RleHQgPSBjaHVuay5jaG9pY2VzWzBdPy5kZWx0YT8uY29udGVudCA/PyAnJ1xuXHRcdFx0XHRmdWxsVGV4dFNvRmFyICs9IG5ld1RleHRcblxuXHRcdFx0XHQvLyB0b29sIGNhbGxcblx0XHRcdFx0Zm9yIChjb25zdCB0b29sIG9mIGNodW5rLmNob2ljZXNbMF0/LmRlbHRhPy50b29sX2NhbGxzID8/IFtdKSB7XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSB0b29sLmluZGV4XG5cdFx0XHRcdFx0aWYgKGluZGV4ICE9PSAwKSBjb250aW51ZVxuXG5cdFx0XHRcdFx0dG9vbE5hbWUgKz0gdG9vbC5mdW5jdGlvbj8ubmFtZSA/PyAnJ1xuXHRcdFx0XHRcdHRvb2xQYXJhbXNTdHIgKz0gdG9vbC5mdW5jdGlvbj8uYXJndW1lbnRzID8/ICcnO1xuXHRcdFx0XHRcdHRvb2xJZCArPSB0b29sLmlkID8/ICcnXG5cdFx0XHRcdH1cblxuXG5cdFx0XHRcdC8vIHJlYXNvbmluZ1xuXHRcdFx0XHRsZXQgbmV3UmVhc29uaW5nID0gJydcblx0XHRcdFx0aWYgKG5hbWVPZlJlYXNvbmluZ0ZpZWxkSW5EZWx0YSkge1xuXHRcdFx0XHRcdC8vIEB0cy1pZ25vcmVcblx0XHRcdFx0XHRuZXdSZWFzb25pbmcgPSAoY2h1bmsuY2hvaWNlc1swXT8uZGVsdGE/LltuYW1lT2ZSZWFzb25pbmdGaWVsZEluRGVsdGFdIHx8ICcnKSArICcnXG5cdFx0XHRcdFx0ZnVsbFJlYXNvbmluZ1NvRmFyICs9IG5ld1JlYXNvbmluZ1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gY2FsbCBvblRleHRcblx0XHRcdFx0b25UZXh0KHtcblx0XHRcdFx0XHRmdWxsVGV4dDogZnVsbFRleHRTb0Zhcixcblx0XHRcdFx0XHRmdWxsUmVhc29uaW5nOiBmdWxsUmVhc29uaW5nU29GYXIsXG5cdFx0XHRcdFx0dG9vbENhbGw6ICF0b29sTmFtZSA/IHVuZGVmaW5lZCA6IHsgbmFtZTogdG9vbE5hbWUsIHJhd1BhcmFtczoge30sIGlzRG9uZTogZmFsc2UsIGRvbmVQYXJhbXM6IFtdLCBpZDogdG9vbElkIH0sXG5cdFx0XHRcdH0pXG5cblx0XHRcdH1cblx0XHRcdC8vIG9uIGZpbmFsXG5cdFx0XHRpZiAoIWZ1bGxUZXh0U29GYXIgJiYgIWZ1bGxSZWFzb25pbmdTb0ZhciAmJiAhdG9vbE5hbWUpIHtcblx0XHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6ICdWb2lkOiBSZXNwb25zZSBmcm9tIG1vZGVsIHdhcyBlbXB0eS4nLCBmdWxsRXJyb3I6IG51bGwgfSlcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRjb25zdCB0b29sQ2FsbCA9IHJhd1Rvb2xDYWxsT2JqT2ZQYXJhbXNTdHIodG9vbE5hbWUsIHRvb2xQYXJhbXNTdHIsIHRvb2xJZClcblx0XHRcdFx0Y29uc3QgdG9vbENhbGxPYmogPSB0b29sQ2FsbCA/IHsgdG9vbENhbGwgfSA6IHt9XG5cdFx0XHRcdG9uRmluYWxNZXNzYWdlKHsgZnVsbFRleHQ6IGZ1bGxUZXh0U29GYXIsIGZ1bGxSZWFzb25pbmc6IGZ1bGxSZWFzb25pbmdTb0ZhciwgYW50aHJvcGljUmVhc29uaW5nOiBudWxsLCAuLi50b29sQ2FsbE9iaiB9KTtcblx0XHRcdH1cblx0XHR9KVxuXHRcdC8vIHdoZW4gZXJyb3IvZmFpbCAtIHRoaXMgY2F0Y2hlcyBlcnJvcnMgb2YgYm90aCAuY3JlYXRlKCkgYW5kIC50aGVuKGZvciBhd2FpdClcblx0XHQuY2F0Y2goZXJyb3IgPT4ge1xuXHRcdFx0aWYgKGVycm9yIGluc3RhbmNlb2YgT3BlbkFJLkFQSUVycm9yICYmIGVycm9yLnN0YXR1cyA9PT0gNDAxKSB7IG9uRXJyb3IoeyBtZXNzYWdlOiBpbnZhbGlkQXBpS2V5TWVzc2FnZShwcm92aWRlck5hbWUpLCBmdWxsRXJyb3I6IGVycm9yIH0pOyB9XG5cdFx0XHRlbHNlIHsgb25FcnJvcih7IG1lc3NhZ2U6IGVycm9yICsgJycsIGZ1bGxFcnJvcjogZXJyb3IgfSk7IH1cblx0XHR9KVxufVxuXG5cblxudHlwZSBPcGVuQUlNb2RlbCA9IHtcblx0aWQ6IHN0cmluZztcblx0Y3JlYXRlZDogbnVtYmVyO1xuXHRvYmplY3Q6ICdtb2RlbCc7XG5cdG93bmVkX2J5OiBzdHJpbmc7XG59XG5jb25zdCBfb3BlbmFpQ29tcGF0aWJsZUxpc3QgPSBhc3luYyAoeyBvblN1Y2Nlc3M6IG9uU3VjY2Vzc18sIG9uRXJyb3I6IG9uRXJyb3JfLCBzZXR0aW5nc09mUHJvdmlkZXIsIHByb3ZpZGVyTmFtZSB9OiBMaXN0UGFyYW1zX0ludGVybmFsPE9wZW5BSU1vZGVsPikgPT4ge1xuXHRjb25zdCBvblN1Y2Nlc3MgPSAoeyBtb2RlbHMgfTogeyBtb2RlbHM6IE9wZW5BSU1vZGVsW10gfSkgPT4ge1xuXHRcdG9uU3VjY2Vzc18oeyBtb2RlbHMgfSlcblx0fVxuXHRjb25zdCBvbkVycm9yID0gKHsgZXJyb3IgfTogeyBlcnJvcjogc3RyaW5nIH0pID0+IHtcblx0XHRvbkVycm9yXyh7IGVycm9yIH0pXG5cdH1cblx0dHJ5IHtcblx0XHRjb25zdCBvcGVuYWkgPSBhd2FpdCBuZXdPcGVuQUlDb21wYXRpYmxlU0RLKHsgcHJvdmlkZXJOYW1lLCBzZXR0aW5nc09mUHJvdmlkZXIgfSlcblx0XHRvcGVuYWkubW9kZWxzLmxpc3QoKVxuXHRcdFx0LnRoZW4oYXN5bmMgKHJlc3BvbnNlKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsczogT3BlbkFJTW9kZWxbXSA9IFtdXG5cdFx0XHRcdG1vZGVscy5wdXNoKC4uLnJlc3BvbnNlLmRhdGEpXG5cdFx0XHRcdHdoaWxlIChyZXNwb25zZS5oYXNOZXh0UGFnZSgpKSB7XG5cdFx0XHRcdFx0bW9kZWxzLnB1c2goLi4uKGF3YWl0IHJlc3BvbnNlLmdldE5leHRQYWdlKCkpLmRhdGEpXG5cdFx0XHRcdH1cblx0XHRcdFx0b25TdWNjZXNzKHsgbW9kZWxzIH0pXG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKChlcnJvcikgPT4ge1xuXHRcdFx0XHRvbkVycm9yKHsgZXJyb3I6IGVycm9yICsgJycgfSlcblx0XHRcdH0pXG5cdH1cblx0Y2F0Y2ggKGVycm9yKSB7XG5cdFx0b25FcnJvcih7IGVycm9yOiBlcnJvciArICcnIH0pXG5cdH1cbn1cblxuXG5cblxuLy8gLS0tLS0tLS0tLS0tIEFOVEhST1BJQyAoSEVMUEVSUykgLS0tLS0tLS0tLS0tXG5jb25zdCB0b0FudGhyb3BpY1Rvb2wgPSAodG9vbEluZm86IEludGVybmFsVG9vbEluZm8pID0+IHtcblx0Y29uc3QgeyBuYW1lLCBkZXNjcmlwdGlvbiwgcGFyYW1zIH0gPSB0b29sSW5mb1xuXHRjb25zdCBwYXJhbXNXaXRoVHlwZTogeyBbczogc3RyaW5nXTogeyBkZXNjcmlwdGlvbjogc3RyaW5nOyB0eXBlOiAnc3RyaW5nJyB9IH0gPSB7fVxuXHRmb3IgKGNvbnN0IGtleSBpbiBwYXJhbXMpIHsgcGFyYW1zV2l0aFR5cGVba2V5XSA9IHsgLi4ucGFyYW1zW2tleV0sIHR5cGU6ICdzdHJpbmcnIH0gfVxuXHRyZXR1cm4ge1xuXHRcdG5hbWU6IG5hbWUsXG5cdFx0ZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uLFxuXHRcdGlucHV0X3NjaGVtYToge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiBwYXJhbXNXaXRoVHlwZSxcblx0XHRcdC8vIHJlcXVpcmVkOiBPYmplY3Qua2V5cyhwYXJhbXMpLFxuXHRcdH0sXG5cdH0gc2F0aXNmaWVzIEFudGhyb3BpYy5NZXNzYWdlcy5Ub29sXG59XG5cbmNvbnN0IGFudGhyb3BpY1Rvb2xzID0gKGNoYXRNb2RlOiBDaGF0TW9kZSB8IG51bGwsIG1jcFRvb2xzOiBJbnRlcm5hbFRvb2xJbmZvW10gfCB1bmRlZmluZWQpID0+IHtcblx0Y29uc3QgYWxsb3dlZFRvb2xzID0gYXZhaWxhYmxlVG9vbHMoY2hhdE1vZGUsIG1jcFRvb2xzKVxuXHRpZiAoIWFsbG93ZWRUb29scyB8fCBPYmplY3Qua2V5cyhhbGxvd2VkVG9vbHMpLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGxcblxuXHRjb25zdCBhbnRocm9waWNUb29sczogQW50aHJvcGljLk1lc3NhZ2VzLlRvb2xVbmlvbltdID0gW11cblx0Zm9yIChjb25zdCB0IGluIGFsbG93ZWRUb29scyA/PyB7fSkge1xuXHRcdGFudGhyb3BpY1Rvb2xzLnB1c2godG9BbnRocm9waWNUb29sKGFsbG93ZWRUb29sc1t0XSkpXG5cdH1cblx0cmV0dXJuIGFudGhyb3BpY1Rvb2xzXG59XG5cblxuXG4vLyAtLS0tLS0tLS0tLS0gQU5USFJPUElDIC0tLS0tLS0tLS0tLVxuY29uc3Qgc2VuZEFudGhyb3BpY0NoYXQgPSBhc3luYyAoeyBtZXNzYWdlcywgcHJvdmlkZXJOYW1lLCBvblRleHQsIG9uRmluYWxNZXNzYWdlLCBvbkVycm9yLCBzZXR0aW5nc09mUHJvdmlkZXIsIG1vZGVsU2VsZWN0aW9uT3B0aW9ucywgb3ZlcnJpZGVzT2ZNb2RlbCwgbW9kZWxOYW1lOiBtb2RlbE5hbWVfLCBfc2V0QWJvcnRlciwgc2VwYXJhdGVTeXN0ZW1NZXNzYWdlLCBjaGF0TW9kZSwgbWNwVG9vbHMgfTogU2VuZENoYXRQYXJhbXNfSW50ZXJuYWwpID0+IHtcblx0Y29uc3Qge1xuXHRcdG1vZGVsTmFtZSxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdCxcblx0fSA9IGdldE1vZGVsQ2FwYWJpbGl0aWVzKHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lXywgb3ZlcnJpZGVzT2ZNb2RlbClcblxuXHRjb25zdCB0aGlzQ29uZmlnID0gc2V0dGluZ3NPZlByb3ZpZGVyLmFudGhyb3BpY1xuXHRjb25zdCB7IHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5ncyB9ID0gZ2V0UHJvdmlkZXJDYXBhYmlsaXRpZXMocHJvdmlkZXJOYW1lKVxuXG5cdC8vIHJlYXNvbmluZ1xuXHRjb25zdCByZWFzb25pbmdJbmZvID0gZ2V0U2VuZGFibGVSZWFzb25pbmdJbmZvKCdDaGF0JywgcHJvdmlkZXJOYW1lLCBtb2RlbE5hbWVfLCBtb2RlbFNlbGVjdGlvbk9wdGlvbnMsIG92ZXJyaWRlc09mTW9kZWwpIC8vIHVzZXIncyBtb2RlbE5hbWVfIGhlcmVcblx0Y29uc3QgaW5jbHVkZUluUGF5bG9hZCA9IHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5ncz8uaW5wdXQ/LmluY2x1ZGVJblBheWxvYWQ/LihyZWFzb25pbmdJbmZvKSB8fCB7fVxuXG5cdC8vIGFudGhyb3BpYy1zcGVjaWZpYyAtIG1heCB0b2tlbnNcblx0Y29uc3QgbWF4VG9rZW5zID0gZ2V0UmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlKHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lXywgeyBpc1JlYXNvbmluZ0VuYWJsZWQ6ICEhcmVhc29uaW5nSW5mbz8uaXNSZWFzb25pbmdFbmFibGVkLCBvdmVycmlkZXNPZk1vZGVsIH0pXG5cblx0Ly8gdG9vbHNcblx0Y29uc3QgcG90ZW50aWFsVG9vbHMgPSBhbnRocm9waWNUb29scyhjaGF0TW9kZSwgbWNwVG9vbHMpXG5cdGNvbnN0IG5hdGl2ZVRvb2xzT2JqID0gcG90ZW50aWFsVG9vbHMgJiYgc3BlY2lhbFRvb2xGb3JtYXQgPT09ICdhbnRocm9waWMtc3R5bGUnID9cblx0XHR7IHRvb2xzOiBwb3RlbnRpYWxUb29scywgdG9vbF9jaG9pY2U6IHsgdHlwZTogJ2F1dG8nIH0gfSBhcyBjb25zdFxuXHRcdDoge31cblxuXG5cdC8vIGluc3RhbmNlXG5cdGNvbnN0IGFudGhyb3BpYyA9IG5ldyBBbnRocm9waWMoe1xuXHRcdGFwaUtleTogdGhpc0NvbmZpZy5hcGlLZXksXG5cdFx0ZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXI6IHRydWVcblx0fSk7XG5cblx0Y29uc3Qgc3RyZWFtID0gYW50aHJvcGljLm1lc3NhZ2VzLnN0cmVhbSh7XG5cdFx0c3lzdGVtOiBzZXBhcmF0ZVN5c3RlbU1lc3NhZ2UgPz8gdW5kZWZpbmVkLFxuXHRcdG1lc3NhZ2VzOiBtZXNzYWdlcyBhcyBBbnRocm9waWNMTE1DaGF0TWVzc2FnZVtdLFxuXHRcdG1vZGVsOiBtb2RlbE5hbWUsXG5cdFx0bWF4X3Rva2VuczogbWF4VG9rZW5zID8/IDRfMDk2LCAvLyBhbnRocm9waWMgcmVxdWlyZXMgdGhpc1xuXHRcdC4uLmluY2x1ZGVJblBheWxvYWQsXG5cdFx0Li4ubmF0aXZlVG9vbHNPYmosXG5cblx0fSlcblxuXHQvLyBtYW51YWxseSBwYXJzZSBvdXQgdG9vbCByZXN1bHRzIGlmIFhNTFxuXHRpZiAoIXNwZWNpYWxUb29sRm9ybWF0KSB7XG5cdFx0Y29uc3QgeyBuZXdPblRleHQsIG5ld09uRmluYWxNZXNzYWdlIH0gPSBleHRyYWN0WE1MVG9vbHNXcmFwcGVyKG9uVGV4dCwgb25GaW5hbE1lc3NhZ2UsIGNoYXRNb2RlLCBtY3BUb29scylcblx0XHRvblRleHQgPSBuZXdPblRleHRcblx0XHRvbkZpbmFsTWVzc2FnZSA9IG5ld09uRmluYWxNZXNzYWdlXG5cdH1cblxuXHQvLyB3aGVuIHJlY2VpdmUgdGV4dFxuXHRsZXQgZnVsbFRleHQgPSAnJ1xuXHRsZXQgZnVsbFJlYXNvbmluZyA9ICcnXG5cblx0bGV0IGZ1bGxUb29sTmFtZSA9ICcnXG5cdGxldCBmdWxsVG9vbFBhcmFtcyA9ICcnXG5cblxuXHRjb25zdCBydW5PblRleHQgPSAoKSA9PiB7XG5cdFx0b25UZXh0KHtcblx0XHRcdGZ1bGxUZXh0LFxuXHRcdFx0ZnVsbFJlYXNvbmluZyxcblx0XHRcdHRvb2xDYWxsOiAhZnVsbFRvb2xOYW1lID8gdW5kZWZpbmVkIDogeyBuYW1lOiBmdWxsVG9vbE5hbWUsIHJhd1BhcmFtczoge30sIGlzRG9uZTogZmFsc2UsIGRvbmVQYXJhbXM6IFtdLCBpZDogJ2R1bW15JyB9LFxuXHRcdH0pXG5cdH1cblx0Ly8gdGhlcmUgYXJlIG5vIGV2ZW50cyBmb3IgdG9vbF91c2UsIGl0IGNvbWVzIGluIGF0IHRoZSBlbmRcblx0c3RyZWFtLm9uKCdzdHJlYW1FdmVudCcsIGUgPT4ge1xuXHRcdC8vIHN0YXJ0IGJsb2NrXG5cdFx0aWYgKGUudHlwZSA9PT0gJ2NvbnRlbnRfYmxvY2tfc3RhcnQnKSB7XG5cdFx0XHRpZiAoZS5jb250ZW50X2Jsb2NrLnR5cGUgPT09ICd0ZXh0Jykge1xuXHRcdFx0XHRpZiAoZnVsbFRleHQpIGZ1bGxUZXh0ICs9ICdcXG5cXG4nIC8vIHN0YXJ0aW5nIGEgMm5kIHRleHQgYmxvY2tcblx0XHRcdFx0ZnVsbFRleHQgKz0gZS5jb250ZW50X2Jsb2NrLnRleHRcblx0XHRcdFx0cnVuT25UZXh0KClcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGUuY29udGVudF9ibG9jay50eXBlID09PSAndGhpbmtpbmcnKSB7XG5cdFx0XHRcdGlmIChmdWxsUmVhc29uaW5nKSBmdWxsUmVhc29uaW5nICs9ICdcXG5cXG4nIC8vIHN0YXJ0aW5nIGEgMm5kIHJlYXNvbmluZyBibG9ja1xuXHRcdFx0XHRmdWxsUmVhc29uaW5nICs9IGUuY29udGVudF9ibG9jay50aGlua2luZ1xuXHRcdFx0XHRydW5PblRleHQoKVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoZS5jb250ZW50X2Jsb2NrLnR5cGUgPT09ICdyZWRhY3RlZF90aGlua2luZycpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ2RlbHRhJywgZS5jb250ZW50X2Jsb2NrLnR5cGUpXG5cdFx0XHRcdGlmIChmdWxsUmVhc29uaW5nKSBmdWxsUmVhc29uaW5nICs9ICdcXG5cXG4nIC8vIHN0YXJ0aW5nIGEgMm5kIHJlYXNvbmluZyBibG9ja1xuXHRcdFx0XHRmdWxsUmVhc29uaW5nICs9ICdbcmVkYWN0ZWRfdGhpbmtpbmddJ1xuXHRcdFx0XHRydW5PblRleHQoKVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoZS5jb250ZW50X2Jsb2NrLnR5cGUgPT09ICd0b29sX3VzZScpIHtcblx0XHRcdFx0ZnVsbFRvb2xOYW1lICs9IGUuY29udGVudF9ibG9jay5uYW1lID8/ICcnIC8vIGFudGhyb3BpYyBnaXZlcyB1cyB0aGUgdG9vbCBuYW1lIGluIHRoZSBzdGFydCBibG9ja1xuXHRcdFx0XHRydW5PblRleHQoKVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGRlbHRhXG5cdFx0ZWxzZSBpZiAoZS50eXBlID09PSAnY29udGVudF9ibG9ja19kZWx0YScpIHtcblx0XHRcdGlmIChlLmRlbHRhLnR5cGUgPT09ICd0ZXh0X2RlbHRhJykge1xuXHRcdFx0XHRmdWxsVGV4dCArPSBlLmRlbHRhLnRleHRcblx0XHRcdFx0cnVuT25UZXh0KClcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGUuZGVsdGEudHlwZSA9PT0gJ3RoaW5raW5nX2RlbHRhJykge1xuXHRcdFx0XHRmdWxsUmVhc29uaW5nICs9IGUuZGVsdGEudGhpbmtpbmdcblx0XHRcdFx0cnVuT25UZXh0KClcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGUuZGVsdGEudHlwZSA9PT0gJ2lucHV0X2pzb25fZGVsdGEnKSB7IC8vIHRvb2wgdXNlXG5cdFx0XHRcdGZ1bGxUb29sUGFyYW1zICs9IGUuZGVsdGEucGFydGlhbF9qc29uID8/ICcnIC8vIGFudGhyb3BpYyBnaXZlcyB1cyB0aGUgcGFydGlhbCBkZWx0YSAoc3RyaW5nKSBoZXJlIC0gaHR0cHM6Ly9kb2NzLmFudGhyb3BpYy5jb20vZW4vYXBpL21lc3NhZ2VzLXN0cmVhbWluZ1xuXHRcdFx0XHRydW5PblRleHQoKVxuXHRcdFx0fVxuXHRcdH1cblx0fSlcblxuXHQvLyBvbiBkb25lIC0gKG9yIHdoZW4gZXJyb3IvZmFpbCkgLSB0aGlzIGlzIGNhbGxlZCBBRlRFUiBsYXN0IHN0cmVhbUV2ZW50XG5cdHN0cmVhbS5vbignZmluYWxNZXNzYWdlJywgKHJlc3BvbnNlKSA9PiB7XG5cdFx0Y29uc3QgYW50aHJvcGljUmVhc29uaW5nID0gcmVzcG9uc2UuY29udGVudC5maWx0ZXIoYyA9PiBjLnR5cGUgPT09ICd0aGlua2luZycgfHwgYy50eXBlID09PSAncmVkYWN0ZWRfdGhpbmtpbmcnKVxuXHRcdGNvbnN0IHRvb2xzID0gcmVzcG9uc2UuY29udGVudC5maWx0ZXIoYyA9PiBjLnR5cGUgPT09ICd0b29sX3VzZScpXG5cdFx0Ly8gY29uc29sZS5sb2coJ1RPT0xTISEhISEhJywgSlNPTi5zdHJpbmdpZnkodG9vbHMsIG51bGwsIDIpKVxuXHRcdC8vIGNvbnNvbGUubG9nKCdUT09MUyEhISEhIScsIEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLCBudWxsLCAyKSlcblx0XHRjb25zdCB0b29sQ2FsbCA9IHRvb2xzWzBdICYmIHJhd1Rvb2xDYWxsT2JqT2ZBbnRocm9waWNQYXJhbXModG9vbHNbMF0pXG5cdFx0Y29uc3QgdG9vbENhbGxPYmogPSB0b29sQ2FsbCA/IHsgdG9vbENhbGwgfSA6IHt9XG5cblx0XHRvbkZpbmFsTWVzc2FnZSh7IGZ1bGxUZXh0LCBmdWxsUmVhc29uaW5nLCBhbnRocm9waWNSZWFzb25pbmcsIC4uLnRvb2xDYWxsT2JqIH0pXG5cdH0pXG5cdC8vIG9uIGVycm9yXG5cdHN0cmVhbS5vbignZXJyb3InLCAoZXJyb3IpID0+IHtcblx0XHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBBbnRocm9waWMuQVBJRXJyb3IgJiYgZXJyb3Iuc3RhdHVzID09PSA0MDEpIHsgb25FcnJvcih7IG1lc3NhZ2U6IGludmFsaWRBcGlLZXlNZXNzYWdlKHByb3ZpZGVyTmFtZSksIGZ1bGxFcnJvcjogZXJyb3IgfSkgfVxuXHRcdGVsc2UgeyBvbkVycm9yKHsgbWVzc2FnZTogZXJyb3IgKyAnJywgZnVsbEVycm9yOiBlcnJvciB9KSB9XG5cdH0pXG5cdF9zZXRBYm9ydGVyKCgpID0+IHN0cmVhbS5jb250cm9sbGVyLmFib3J0KCkpXG59XG5cblxuXG4vLyAtLS0tLS0tLS0tLS0gTUlTVFJBTCAtLS0tLS0tLS0tLS1cbi8vIGh0dHBzOi8vZG9jcy5taXN0cmFsLmFpL2FwaS8jdGFnL2ZpbVxuY29uc3Qgc2VuZE1pc3RyYWxGSU0gPSAoeyBtZXNzYWdlcywgb25GaW5hbE1lc3NhZ2UsIG9uRXJyb3IsIHNldHRpbmdzT2ZQcm92aWRlciwgb3ZlcnJpZGVzT2ZNb2RlbCwgbW9kZWxOYW1lOiBtb2RlbE5hbWVfLCBfc2V0QWJvcnRlciwgcHJvdmlkZXJOYW1lIH06IFNlbmRGSU1QYXJhbXNfSW50ZXJuYWwpID0+IHtcblx0Y29uc3QgeyBtb2RlbE5hbWUsIHN1cHBvcnRzRklNIH0gPSBnZXRNb2RlbENhcGFiaWxpdGllcyhwcm92aWRlck5hbWUsIG1vZGVsTmFtZV8sIG92ZXJyaWRlc09mTW9kZWwpXG5cdGlmICghc3VwcG9ydHNGSU0pIHtcblx0XHRpZiAobW9kZWxOYW1lID09PSBtb2RlbE5hbWVfKVxuXHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6IGBNb2RlbCAke21vZGVsTmFtZX0gZG9lcyBub3Qgc3VwcG9ydCBGSU0uYCwgZnVsbEVycm9yOiBudWxsIH0pXG5cdFx0ZWxzZVxuXHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6IGBNb2RlbCAke21vZGVsTmFtZV99ICgke21vZGVsTmFtZX0pIGRvZXMgbm90IHN1cHBvcnQgRklNLmAsIGZ1bGxFcnJvcjogbnVsbCB9KVxuXHRcdHJldHVyblxuXHR9XG5cblx0Y29uc3QgbWlzdHJhbCA9IG5ldyBNaXN0cmFsQ29yZSh7IGFwaUtleTogc2V0dGluZ3NPZlByb3ZpZGVyLm1pc3RyYWwuYXBpS2V5IH0pXG5cdGZpbUNvbXBsZXRlKG1pc3RyYWwsXG5cdFx0e1xuXHRcdFx0bW9kZWw6IG1vZGVsTmFtZSxcblx0XHRcdHByb21wdDogbWVzc2FnZXMucHJlZml4LFxuXHRcdFx0c3VmZml4OiBtZXNzYWdlcy5zdWZmaXgsXG5cdFx0XHRzdHJlYW06IGZhbHNlLFxuXHRcdFx0bWF4VG9rZW5zOiAzMDAsXG5cdFx0XHRzdG9wOiBtZXNzYWdlcy5zdG9wVG9rZW5zLFxuXHRcdH0pXG5cdFx0LnRoZW4oYXN5bmMgcmVzcG9uc2UgPT4ge1xuXG5cdFx0XHQvLyB1bmZvcnR1bmF0ZWx5LCBfc2V0QWJvcnRlcigpIGRvZXMgbm90IGV4aXN0XG5cdFx0XHRsZXQgY29udGVudCA9IHJlc3BvbnNlPy5vayA/IHJlc3BvbnNlLnZhbHVlLmNob2ljZXM/LlswXT8ubWVzc2FnZT8uY29udGVudCA/PyAnJyA6ICcnO1xuXHRcdFx0Y29uc3QgZnVsbFRleHQgPSB0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZycgPyBjb250ZW50XG5cdFx0XHRcdDogY29udGVudC5tYXAoY2h1bmsgPT4gKGNodW5rLnR5cGUgPT09ICd0ZXh0JyA/IGNodW5rLnRleHQgOiAnJykpLmpvaW4oJycpXG5cblx0XHRcdG9uRmluYWxNZXNzYWdlKHsgZnVsbFRleHQsIGZ1bGxSZWFzb25pbmc6ICcnLCBhbnRocm9waWNSZWFzb25pbmc6IG51bGwgfSk7XG5cdFx0fSlcblx0XHQuY2F0Y2goZXJyb3IgPT4ge1xuXHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6IGVycm9yICsgJycsIGZ1bGxFcnJvcjogZXJyb3IgfSk7XG5cdFx0fSlcbn1cblxuXG4vLyAtLS0tLS0tLS0tLS0gT0xMQU1BIC0tLS0tLS0tLS0tLVxuY29uc3QgbmV3T2xsYW1hU0RLID0gKHsgZW5kcG9pbnQgfTogeyBlbmRwb2ludDogc3RyaW5nIH0pID0+IHtcblx0Ly8gaWYgZW5kcG9pbnQgaXMgZW1wdHksIG5vcm1hbGx5IG9sbGFtYSB3aWxsIHNlbmQgdG8gMTE0MzQsIGJ1dCB3ZSB3YW50IGl0IHRvIGZhaWwgLSB0aGUgdXNlciBzaG91bGQgdHlwZSBpdCBpblxuXHRpZiAoIWVuZHBvaW50KSB0aHJvdyBuZXcgRXJyb3IoYE9sbGFtYSBFbmRwb2ludCB3YXMgZW1wdHkgKHBsZWFzZSBlbnRlciAke2RlZmF1bHRQcm92aWRlclNldHRpbmdzLm9sbGFtYS5lbmRwb2ludH0gaW4gVm9pZCBpZiB5b3Ugd2FudCB0aGUgZGVmYXVsdCB1cmwpLmApXG5cdGNvbnN0IG9sbGFtYSA9IG5ldyBPbGxhbWEoeyBob3N0OiBlbmRwb2ludCB9KVxuXHRyZXR1cm4gb2xsYW1hXG59XG5cbmNvbnN0IG9sbGFtYUxpc3QgPSBhc3luYyAoeyBvblN1Y2Nlc3M6IG9uU3VjY2Vzc18sIG9uRXJyb3I6IG9uRXJyb3JfLCBzZXR0aW5nc09mUHJvdmlkZXIgfTogTGlzdFBhcmFtc19JbnRlcm5hbDxPbGxhbWFNb2RlbFJlc3BvbnNlPikgPT4ge1xuXHRjb25zdCBvblN1Y2Nlc3MgPSAoeyBtb2RlbHMgfTogeyBtb2RlbHM6IE9sbGFtYU1vZGVsUmVzcG9uc2VbXSB9KSA9PiB7XG5cdFx0b25TdWNjZXNzXyh7IG1vZGVscyB9KVxuXHR9XG5cdGNvbnN0IG9uRXJyb3IgPSAoeyBlcnJvciB9OiB7IGVycm9yOiBzdHJpbmcgfSkgPT4ge1xuXHRcdG9uRXJyb3JfKHsgZXJyb3IgfSlcblx0fVxuXHR0cnkge1xuXHRcdGNvbnN0IHRoaXNDb25maWcgPSBzZXR0aW5nc09mUHJvdmlkZXIub2xsYW1hXG5cdFx0Y29uc3Qgb2xsYW1hID0gbmV3T2xsYW1hU0RLKHsgZW5kcG9pbnQ6IHRoaXNDb25maWcuZW5kcG9pbnQgfSlcblx0XHRvbGxhbWEubGlzdCgpXG5cdFx0XHQudGhlbigocmVzcG9uc2UpID0+IHtcblx0XHRcdFx0Y29uc3QgeyBtb2RlbHMgfSA9IHJlc3BvbnNlXG5cdFx0XHRcdG9uU3VjY2Vzcyh7IG1vZGVscyB9KVxuXHRcdFx0fSlcblx0XHRcdC5jYXRjaCgoZXJyb3IpID0+IHtcblx0XHRcdFx0b25FcnJvcih7IGVycm9yOiBlcnJvciArICcnIH0pXG5cdFx0XHR9KVxuXHR9XG5cdGNhdGNoIChlcnJvcikge1xuXHRcdG9uRXJyb3IoeyBlcnJvcjogZXJyb3IgKyAnJyB9KVxuXHR9XG59XG5cbmNvbnN0IHNlbmRPbGxhbWFGSU0gPSAoeyBtZXNzYWdlcywgb25GaW5hbE1lc3NhZ2UsIG9uRXJyb3IsIHNldHRpbmdzT2ZQcm92aWRlciwgbW9kZWxOYW1lLCBfc2V0QWJvcnRlciB9OiBTZW5kRklNUGFyYW1zX0ludGVybmFsKSA9PiB7XG5cdGNvbnN0IHRoaXNDb25maWcgPSBzZXR0aW5nc09mUHJvdmlkZXIub2xsYW1hXG5cdGNvbnN0IG9sbGFtYSA9IG5ld09sbGFtYVNESyh7IGVuZHBvaW50OiB0aGlzQ29uZmlnLmVuZHBvaW50IH0pXG5cblx0bGV0IGZ1bGxUZXh0ID0gJydcblx0b2xsYW1hLmdlbmVyYXRlKHtcblx0XHRtb2RlbDogbW9kZWxOYW1lLFxuXHRcdHByb21wdDogbWVzc2FnZXMucHJlZml4LFxuXHRcdHN1ZmZpeDogbWVzc2FnZXMuc3VmZml4LFxuXHRcdG9wdGlvbnM6IHtcblx0XHRcdHN0b3A6IG1lc3NhZ2VzLnN0b3BUb2tlbnMsXG5cdFx0XHRudW1fcHJlZGljdDogMzAwLCAvLyBtYXggdG9rZW5zXG5cdFx0XHQvLyByZXBlYXRfcGVuYWx0eTogMSxcblx0XHR9LFxuXHRcdHJhdzogdHJ1ZSxcblx0XHRzdHJlYW06IHRydWUsIC8vIHN0cmVhbSBpcyBub3QgbmVjZXNzYXJ5IGJ1dCBsZXRzIHVzIGV4cG9zZSB0aGVcblx0fSlcblx0XHQudGhlbihhc3luYyBzdHJlYW0gPT4ge1xuXHRcdFx0X3NldEFib3J0ZXIoKCkgPT4gc3RyZWFtLmFib3J0KCkpXG5cdFx0XHRmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHN0cmVhbSkge1xuXHRcdFx0XHRjb25zdCBuZXdUZXh0ID0gY2h1bmsucmVzcG9uc2Vcblx0XHRcdFx0ZnVsbFRleHQgKz0gbmV3VGV4dFxuXHRcdFx0fVxuXHRcdFx0b25GaW5hbE1lc3NhZ2UoeyBmdWxsVGV4dCwgZnVsbFJlYXNvbmluZzogJycsIGFudGhyb3BpY1JlYXNvbmluZzogbnVsbCB9KVxuXHRcdH0pXG5cdFx0Ly8gd2hlbiBlcnJvci9mYWlsXG5cdFx0LmNhdGNoKChlcnJvcikgPT4ge1xuXHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6IGVycm9yICsgJycsIGZ1bGxFcnJvcjogZXJyb3IgfSlcblx0XHR9KVxufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tIEdFTUlOSSBOQVRJVkUgSU1QTEVNRU5UQVRJT04gLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCB0b0dlbWluaUZ1bmN0aW9uRGVjbCA9ICh0b29sSW5mbzogSW50ZXJuYWxUb29sSW5mbykgPT4ge1xuXHRjb25zdCB7IG5hbWUsIGRlc2NyaXB0aW9uLCBwYXJhbXMgfSA9IHRvb2xJbmZvXG5cdHJldHVybiB7XG5cdFx0bmFtZSxcblx0XHRkZXNjcmlwdGlvbixcblx0XHRwYXJhbWV0ZXJzOiB7XG5cdFx0XHR0eXBlOiBUeXBlLk9CSkVDVCxcblx0XHRcdHByb3BlcnRpZXM6IE9iamVjdC5lbnRyaWVzKHBhcmFtcykucmVkdWNlKChhY2MsIFtrZXksIHZhbHVlXSkgPT4ge1xuXHRcdFx0XHRhY2Nba2V5XSA9IHtcblx0XHRcdFx0XHR0eXBlOiBUeXBlLlNUUklORyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogdmFsdWUuZGVzY3JpcHRpb25cblx0XHRcdFx0fTtcblx0XHRcdFx0cmV0dXJuIGFjYztcblx0XHRcdH0sIHt9IGFzIFJlY29yZDxzdHJpbmcsIFNjaGVtYT4pXG5cdFx0fVxuXHR9IHNhdGlzZmllcyBGdW5jdGlvbkRlY2xhcmF0aW9uXG59XG5cbmNvbnN0IGdlbWluaVRvb2xzID0gKGNoYXRNb2RlOiBDaGF0TW9kZSB8IG51bGwsIG1jcFRvb2xzOiBJbnRlcm5hbFRvb2xJbmZvW10gfCB1bmRlZmluZWQpOiBHZW1pbmlUb29sW10gfCBudWxsID0+IHtcblx0Y29uc3QgYWxsb3dlZFRvb2xzID0gYXZhaWxhYmxlVG9vbHMoY2hhdE1vZGUsIG1jcFRvb2xzKVxuXHRpZiAoIWFsbG93ZWRUb29scyB8fCBPYmplY3Qua2V5cyhhbGxvd2VkVG9vbHMpLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGxcblx0Y29uc3QgZnVuY3Rpb25EZWNsczogRnVuY3Rpb25EZWNsYXJhdGlvbltdID0gW11cblx0Zm9yIChjb25zdCB0IGluIGFsbG93ZWRUb29scyA/PyB7fSkge1xuXHRcdGZ1bmN0aW9uRGVjbHMucHVzaCh0b0dlbWluaUZ1bmN0aW9uRGVjbChhbGxvd2VkVG9vbHNbdF0pKVxuXHR9XG5cdGNvbnN0IHRvb2xzOiBHZW1pbmlUb29sID0geyBmdW5jdGlvbkRlY2xhcmF0aW9uczogZnVuY3Rpb25EZWNscywgfVxuXHRyZXR1cm4gW3Rvb2xzXVxufVxuXG5cblxuLy8gSW1wbGVtZW50YXRpb24gZm9yIEdlbWluaSB1c2luZyBHb29nbGUncyBuYXRpdmUgQVBJXG5jb25zdCBzZW5kR2VtaW5pQ2hhdCA9IGFzeW5jICh7XG5cdG1lc3NhZ2VzLFxuXHRzZXBhcmF0ZVN5c3RlbU1lc3NhZ2UsXG5cdG9uVGV4dCxcblx0b25GaW5hbE1lc3NhZ2UsXG5cdG9uRXJyb3IsXG5cdHNldHRpbmdzT2ZQcm92aWRlcixcblx0b3ZlcnJpZGVzT2ZNb2RlbCxcblx0bW9kZWxOYW1lOiBtb2RlbE5hbWVfLFxuXHRfc2V0QWJvcnRlcixcblx0cHJvdmlkZXJOYW1lLFxuXHRtb2RlbFNlbGVjdGlvbk9wdGlvbnMsXG5cdGNoYXRNb2RlLFxuXHRtY3BUb29scyxcbn06IFNlbmRDaGF0UGFyYW1zX0ludGVybmFsKSA9PiB7XG5cblx0aWYgKHByb3ZpZGVyTmFtZSAhPT0gJ2dlbWluaScgJiYgcHJvdmlkZXJOYW1lICE9PSAnZ29vZ2xlVmVydGV4JykgdGhyb3cgbmV3IEVycm9yKGBTZW5kaW5nIEdlbWluaSBjaGF0LCBidXQgcHJvdmlkZXIgd2FzICR7cHJvdmlkZXJOYW1lfWApXG5cblx0Y29uc3QgdGhpc0NvbmZpZyA9IHNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdXG5cblx0Y29uc3Qge1xuXHRcdG1vZGVsTmFtZSxcblx0XHRzcGVjaWFsVG9vbEZvcm1hdCxcblx0XHQvLyByZWFzb25pbmdDYXBhYmlsaXRpZXMsXG5cdH0gPSBnZXRNb2RlbENhcGFiaWxpdGllcyhwcm92aWRlck5hbWUsIG1vZGVsTmFtZV8sIG92ZXJyaWRlc09mTW9kZWwpXG5cblx0Ly8gY29uc3QgeyBwcm92aWRlclJlYXNvbmluZ0lPU2V0dGluZ3MgfSA9IGdldFByb3ZpZGVyQ2FwYWJpbGl0aWVzKHByb3ZpZGVyTmFtZSlcblxuXHQvLyByZWFzb25pbmdcblx0Ly8gY29uc3QgeyBjYW5JT1JlYXNvbmluZywgb3BlblNvdXJjZVRoaW5rVGFncywgfSA9IHJlYXNvbmluZ0NhcGFiaWxpdGllcyB8fCB7fVxuXHRjb25zdCByZWFzb25pbmdJbmZvID0gZ2V0U2VuZGFibGVSZWFzb25pbmdJbmZvKCdDaGF0JywgcHJvdmlkZXJOYW1lLCBtb2RlbE5hbWVfLCBtb2RlbFNlbGVjdGlvbk9wdGlvbnMsIG92ZXJyaWRlc09mTW9kZWwpIC8vIHVzZXIncyBtb2RlbE5hbWVfIGhlcmVcblx0Ly8gY29uc3QgaW5jbHVkZUluUGF5bG9hZCA9IHByb3ZpZGVyUmVhc29uaW5nSU9TZXR0aW5ncz8uaW5wdXQ/LmluY2x1ZGVJblBheWxvYWQ/LihyZWFzb25pbmdJbmZvKSB8fCB7fVxuXG5cdC8vIFJlYXNvbmluZy90aGlua2luZyBkaXNhYmxlZCBcdTIwMTQgbm90IHJlbmRlcmVkIGluIFZvbHQgVUlcblx0Y29uc3QgdGhpbmtpbmdDb25maWc6IFRoaW5raW5nQ29uZmlnIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkXG5cblx0Ly8gdG9vbHNcblx0Y29uc3QgcG90ZW50aWFsVG9vbHMgPSBnZW1pbmlUb29scyhjaGF0TW9kZSwgbWNwVG9vbHMpXG5cdGNvbnN0IHRvb2xDb25maWcgPSBwb3RlbnRpYWxUb29scyAmJiBzcGVjaWFsVG9vbEZvcm1hdCA9PT0gJ2dlbWluaS1zdHlsZScgP1xuXHRcdHBvdGVudGlhbFRvb2xzXG5cdFx0OiB1bmRlZmluZWRcblxuXHQvLyBpbnN0YW5jZSBcdTIwMTQgVmVydGV4IEFJIHZpYSBzZXJ2aWNlIGFjY291bnQgKEFEQylcblx0Y29uc3QgdmVydGV4Q29uZmlnID0gc2V0dGluZ3NPZlByb3ZpZGVyWydnb29nbGVWZXJ0ZXgnXTtcblx0Y29uc3QgZ2VuQUkgPSBuZXcgR29vZ2xlR2VuQUkoe1xuXHRcdHZlcnRleGFpOiB0cnVlLFxuXHRcdHByb2plY3Q6IHZlcnRleENvbmZpZy5wcm9qZWN0LFxuXHRcdGxvY2F0aW9uOiB2ZXJ0ZXhDb25maWcucmVnaW9uLFxuXHR9KTtcblxuXG5cdC8vIG1hbnVhbGx5IHBhcnNlIG91dCB0b29sIHJlc3VsdHMgaWYgWE1MXG5cdGlmICghc3BlY2lhbFRvb2xGb3JtYXQpIHtcblx0XHRjb25zdCB7IG5ld09uVGV4dCwgbmV3T25GaW5hbE1lc3NhZ2UgfSA9IGV4dHJhY3RYTUxUb29sc1dyYXBwZXIob25UZXh0LCBvbkZpbmFsTWVzc2FnZSwgY2hhdE1vZGUsIG1jcFRvb2xzKVxuXHRcdG9uVGV4dCA9IG5ld09uVGV4dFxuXHRcdG9uRmluYWxNZXNzYWdlID0gbmV3T25GaW5hbE1lc3NhZ2Vcblx0fVxuXG5cdC8vIHdoZW4gcmVjZWl2ZSB0ZXh0XG5cdGxldCBmdWxsUmVhc29uaW5nU29GYXIgPSAnJ1xuXHRsZXQgZnVsbFRleHRTb0ZhciA9ICcnXG5cblx0bGV0IHRvb2xOYW1lID0gJydcblx0bGV0IHRvb2xQYXJhbXNTdHIgPSAnJ1xuXHRsZXQgdG9vbElkID0gJydcblxuXG5cdGdlbkFJLm1vZGVscy5nZW5lcmF0ZUNvbnRlbnRTdHJlYW0oe1xuXHRcdG1vZGVsOiBtb2RlbE5hbWUsXG5cdFx0Y29uZmlnOiB7XG5cdFx0XHRzeXN0ZW1JbnN0cnVjdGlvbjogc2VwYXJhdGVTeXN0ZW1NZXNzYWdlLFxuXHRcdFx0dGhpbmtpbmdDb25maWc6IHRoaW5raW5nQ29uZmlnLFxuXHRcdFx0dG9vbHM6IHRvb2xDb25maWcsXG5cdFx0fSxcblx0XHRjb250ZW50czogbWVzc2FnZXMgYXMgR2VtaW5pTExNQ2hhdE1lc3NhZ2VbXSxcblx0fSlcblx0XHQudGhlbihhc3luYyAoc3RyZWFtKSA9PiB7XG5cdFx0XHRfc2V0QWJvcnRlcigoKSA9PiB7IHN0cmVhbS5yZXR1cm4oZnVsbFRleHRTb0Zhcik7IH0pO1xuXG5cdFx0XHQvLyBQcm9jZXNzIHRoZSBzdHJlYW1cblx0XHRcdGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2Ygc3RyZWFtKSB7XG5cdFx0XHRcdC8vIG1lc3NhZ2Vcblx0XHRcdFx0Y29uc3QgbmV3VGV4dCA9IGNodW5rLnRleHQgPz8gJydcblx0XHRcdFx0ZnVsbFRleHRTb0ZhciArPSBuZXdUZXh0XG5cblx0XHRcdFx0Ly8gdG9vbCBjYWxsXG5cdFx0XHRcdGNvbnN0IGZ1bmN0aW9uQ2FsbHMgPSBjaHVuay5mdW5jdGlvbkNhbGxzXG5cdFx0XHRcdGlmIChmdW5jdGlvbkNhbGxzICYmIGZ1bmN0aW9uQ2FsbHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGNvbnN0IGZ1bmN0aW9uQ2FsbCA9IGZ1bmN0aW9uQ2FsbHNbMF0gLy8gR2V0IHRoZSBmaXJzdCBmdW5jdGlvbiBjYWxsXG5cdFx0XHRcdFx0dG9vbE5hbWUgPSBmdW5jdGlvbkNhbGwubmFtZSA/PyAnJ1xuXHRcdFx0XHRcdHRvb2xQYXJhbXNTdHIgPSBKU09OLnN0cmluZ2lmeShmdW5jdGlvbkNhbGwuYXJncyA/PyB7fSlcblx0XHRcdFx0XHR0b29sSWQgPSBmdW5jdGlvbkNhbGwuaWQgPz8gJydcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIChkbyBub3QgaGFuZGxlIHJlYXNvbmluZyB5ZXQpXG5cblx0XHRcdFx0Ly8gY2FsbCBvblRleHRcblx0XHRcdFx0b25UZXh0KHtcblx0XHRcdFx0XHRmdWxsVGV4dDogZnVsbFRleHRTb0Zhcixcblx0XHRcdFx0XHRmdWxsUmVhc29uaW5nOiBmdWxsUmVhc29uaW5nU29GYXIsXG5cdFx0XHRcdFx0dG9vbENhbGw6ICF0b29sTmFtZSA/IHVuZGVmaW5lZCA6IHsgbmFtZTogdG9vbE5hbWUsIHJhd1BhcmFtczoge30sIGlzRG9uZTogZmFsc2UsIGRvbmVQYXJhbXM6IFtdLCBpZDogdG9vbElkIH0sXG5cdFx0XHRcdH0pXG5cdFx0XHR9XG5cblx0XHRcdC8vIG9uIGZpbmFsXG5cdFx0XHRpZiAoIWZ1bGxUZXh0U29GYXIgJiYgIWZ1bGxSZWFzb25pbmdTb0ZhciAmJiAhdG9vbE5hbWUpIHtcblx0XHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6ICdHZW1pbmkgcmV0dXJuZWQgYW4gZW1wdHkgcmVzcG9uc2UuIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVxdWVzdCB3YXMgdG9vIGxhcmdlIG9yIHdhcyBibG9ja2VkIGJ5IHRoZSBzYWZldHkgZmlsdGVyLiBUcnkgYnJlYWtpbmcgeW91ciByZXF1ZXN0IGludG8gc21hbGxlciBwYXJ0cyBvciByZXBocmFzaW5nIGl0LicsIGZ1bGxFcnJvcjogbnVsbCB9KVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKCF0b29sSWQpIHRvb2xJZCA9IGdlbmVyYXRlVXVpZCgpIC8vIGlkcyBhcmUgZW1wdHksIGJ1dCBvdGhlciBwcm92aWRlcnMgbWlnaHQgZXhwZWN0IGFuIGlkXG5cdFx0XHRcdGNvbnN0IHRvb2xDYWxsID0gcmF3VG9vbENhbGxPYmpPZlBhcmFtc1N0cih0b29sTmFtZSwgdG9vbFBhcmFtc1N0ciwgdG9vbElkKVxuXHRcdFx0XHRjb25zdCB0b29sQ2FsbE9iaiA9IHRvb2xDYWxsID8geyB0b29sQ2FsbCB9IDoge31cblx0XHRcdFx0b25GaW5hbE1lc3NhZ2UoeyBmdWxsVGV4dDogZnVsbFRleHRTb0ZhciwgZnVsbFJlYXNvbmluZzogZnVsbFJlYXNvbmluZ1NvRmFyLCBhbnRocm9waWNSZWFzb25pbmc6IG51bGwsIC4uLnRvb2xDYWxsT2JqIH0pO1xuXHRcdFx0fVxuXHRcdH0pXG5cdFx0LmNhdGNoKGVycm9yID0+IHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBlcnJvcj8ubWVzc2FnZVxuXHRcdFx0aWYgKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuXG5cdFx0XHRcdGlmIChlcnJvci5tZXNzYWdlPy5pbmNsdWRlcygnQVBJIGtleScpKSB7XG5cdFx0XHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6IGludmFsaWRBcGlLZXlNZXNzYWdlKHByb3ZpZGVyTmFtZSksIGZ1bGxFcnJvcjogZXJyb3IgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAoZXJyb3I/Lm1lc3NhZ2U/LmluY2x1ZGVzKCc0MjknKSkge1xuXHRcdFx0XHRcdG9uRXJyb3IoeyBtZXNzYWdlOiAnUmF0ZSBsaW1pdCByZWFjaGVkLiAnICsgZXJyb3IsIGZ1bGxFcnJvcjogZXJyb3IgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHRcdG9uRXJyb3IoeyBtZXNzYWdlOiBlcnJvciArICcnLCBmdWxsRXJyb3I6IGVycm9yIH0pO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG9uRXJyb3IoeyBtZXNzYWdlOiBlcnJvciArICcnLCBmdWxsRXJyb3I6IGVycm9yIH0pO1xuXHRcdFx0fVxuXHRcdH0pXG59O1xuXG5cblxudHlwZSBDYWxsRm5PZlByb3ZpZGVyID0ge1xuXHRbcHJvdmlkZXJOYW1lIGluIFByb3ZpZGVyTmFtZV06IHtcblx0XHRzZW5kQ2hhdDogKHBhcmFtczogU2VuZENoYXRQYXJhbXNfSW50ZXJuYWwpID0+IFByb21pc2U8dm9pZD47XG5cdFx0c2VuZEZJTTogKChwYXJhbXM6IFNlbmRGSU1QYXJhbXNfSW50ZXJuYWwpID0+IHZvaWQpIHwgbnVsbDtcblx0XHRsaXN0OiAoKHBhcmFtczogTGlzdFBhcmFtc19JbnRlcm5hbDxhbnk+KSA9PiB2b2lkKSB8IG51bGw7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IHNlbmRMTE1NZXNzYWdlVG9Qcm92aWRlckltcGxlbWVudGF0aW9uID0ge1xuXHRnb29nbGVWZXJ0ZXg6IHtcblx0XHRzZW5kQ2hhdDogKHBhcmFtczogU2VuZENoYXRQYXJhbXNfSW50ZXJuYWwpID0+IHNlbmRHZW1pbmlDaGF0KHBhcmFtcyksXG5cdFx0c2VuZEZJTTogbnVsbCxcblx0XHRsaXN0OiBudWxsLFxuXHR9LFxufSBzYXRpc2ZpZXMgQ2FsbEZuT2ZQcm92aWRlclxuXG5cblxuXG4vKlxuRklNIGluZm8gKHRoaXMgbWF5IGJlIHVzZWZ1bCBpbiB0aGUgZnV0dXJlIHdpdGggdkxMTSwgYnV0IGluIG1vc3QgY2FzZXMgdGhlIG9ubHkgd2F5IHRvIHVzZSBGSU0gaXMgaWYgdGhlIHByb3ZpZGVyIGV4cGxpY2l0bHkgc3VwcG9ydHMgaXQpOlxuXG5xd2VuMi41LWNvZGVyIGh0dHBzOi8vb2xsYW1hLmNvbS9saWJyYXJ5L3F3ZW4yLjUtY29kZXIvYmxvYnMvZTk0YThlY2I5MzI3XG48fGZpbV9wcmVmaXh8Pnt7IC5Qcm9tcHQgfX08fGZpbV9zdWZmaXh8Pnt7IC5TdWZmaXggfX08fGZpbV9taWRkbGV8PlxuXG5jb2Rlc3RyYWwgaHR0cHM6Ly9vbGxhbWEuY29tL2xpYnJhcnkvY29kZXN0cmFsL2Jsb2JzLzUxNzA3NzUyYTg3Y1xuW1NVRkZJWF17eyAuU3VmZml4IH19W1BSRUZJWF0ge3sgLlByb21wdCB9fVxuXG5kZWVwc2Vlay1jb2Rlci12MiBodHRwczovL29sbGFtYS5jb20vbGlicmFyeS9kZWVwc2Vlay1jb2Rlci12Mi9ibG9icy8yMjA5MTUzMWZhZjBcbjxcdUZGNUNmaW1cdTI1ODFiZWdpblx1RkY1Qz57eyAuUHJvbXB0IH19PFx1RkY1Q2ZpbVx1MjU4MWhvbGVcdUZGNUM+e3sgLlN1ZmZpeCB9fTxcdUZGNUNmaW1cdTI1ODFlbmRcdUZGNUM+XG5cbnN0YXJjb2RlcjIgaHR0cHM6Ly9vbGxhbWEuY29tL2xpYnJhcnkvc3RhcmNvZGVyMi9ibG9icy8zYjE5MGU2OGZlZmVcbjxmaWxlX3NlcD5cbjxmaW1fcHJlZml4Plxue3sgLlByb21wdCB9fTxmaW1fc3VmZml4Pnt7IC5TdWZmaXggfX08ZmltX21pZGRsZT5cbjx8ZW5kX29mX3RleHR8PlxuXG5jb2RlZ2VtbWEgaHR0cHM6Ly9vbGxhbWEuY29tL2xpYnJhcnkvY29kZWdlbW1hOjJiL2Jsb2JzLzQ4ZDlhODE0MDc0OVxuPHxmaW1fcHJlZml4fD57eyAuUHJvbXB0IH19PHxmaW1fc3VmZml4fD57eyAuU3VmZml4IH19PHxmaW1fbWlkZGxlfD5cblxuKi9cbiJdLAogICJtYXBwaW5ncyI6ICJBQU9BLE9BQU8sZUFBZTtBQUN0QixTQUFTLGNBQWM7QUFDdkIsT0FBTyxVQUF5QixtQkFBbUI7QUFDbkQsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBa0QsYUFBcUMsWUFBWTtBQUNuRyxTQUFTLGtCQUFrQjtBQUkzQixTQUFtQixpQ0FBNEc7QUFDL0gsU0FBUywwQkFBMEIsc0JBQXNCLHlCQUF5Qix5QkFBeUIsbUNBQW1DO0FBQzlJLFNBQVMseUJBQXlCLDhCQUE4QjtBQUNoRSxTQUFTLHNCQUF3QztBQUNqRCxTQUFTLG9CQUFvQjtBQUU3QixNQUFNLGtCQUFrQixZQUFZO0FBRW5DLFFBQU0sT0FBTyxJQUFJLFdBQVcsRUFBRSxRQUFRLGlEQUFpRCxDQUFDO0FBQ3hGLFFBQU0sTUFBTSxNQUFNLEtBQUssZUFBZTtBQUN0QyxNQUFJLENBQUMsSUFBSyxPQUFNLElBQUksTUFBTSxzQ0FBc0M7QUFDaEUsU0FBTztBQUNSO0FBMkJBLE1BQU0sdUJBQXVCLENBQUMsaUJBQStCLFdBQVcsMEJBQTBCLFlBQVksRUFBRSxLQUFLO0FBTXJILE1BQU0sbUJBQW1CLENBQUMsTUFBaUY7QUFDMUcsTUFBSSxDQUFDLEVBQUcsUUFBTztBQUNmLE1BQUk7QUFDSCxXQUFPLEtBQUss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
