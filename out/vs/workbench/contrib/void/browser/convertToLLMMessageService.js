var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { Disposable } from "../../../../base/common/lifecycle.js";
import { deepClone } from "../../../../base/common/objects.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { getIsReasoningEnabledState, getReservedOutputTokenSpace, getModelCapabilities } from "../common/modelCapabilities.js";
import { reParsedToolXMLString, chat_systemMessage } from "../common/prompt/prompts.js";
import { IVoidSettingsService } from "../common/voidSettingsService.js";
import { IDirectoryStrService } from "../common/directoryStrService.js";
import { ITerminalToolService } from "./terminalToolService.js";
import { IVoidModelService } from "../common/voidModelService.js";
import { URI } from "../../../../base/common/uri.js";
import { EndOfLinePreference } from "../../../../editor/common/model.js";
import { IMCPService } from "../common/mcpService.js";
const EMPTY_MESSAGE = "(empty message)";
const CHARS_PER_TOKEN = 4;
const TRIM_TO_LEN = 120;
const prepareMessages_openai_tools = (messages) => {
  const newMessages = [];
  for (let i = 0; i < messages.length; i += 1) {
    const currMsg = messages[i];
    if (currMsg.role !== "tool") {
      newMessages.push(currMsg);
      continue;
    }
    const prevMsg = 0 <= i - 1 && i - 1 <= newMessages.length ? newMessages[i - 1] : void 0;
    if (prevMsg?.role === "assistant") {
      prevMsg.tool_calls = [{
        type: "function",
        id: currMsg.id,
        function: {
          name: currMsg.name,
          arguments: JSON.stringify(currMsg.rawParams)
        }
      }];
    }
    newMessages.push({
      role: "tool",
      tool_call_id: currMsg.id,
      content: currMsg.content
    });
  }
  return newMessages;
};
const prepareMessages_anthropic_tools = (messages, supportsAnthropicReasoning) => {
  const newMessages = messages;
  for (let i = 0; i < messages.length; i += 1) {
    const currMsg = messages[i];
    if (currMsg.role === "assistant") {
      if (currMsg.anthropicReasoning && supportsAnthropicReasoning) {
        const content = currMsg.content;
        newMessages[i] = {
          role: "assistant",
          content: content ? [...currMsg.anthropicReasoning, { type: "text", text: content }] : currMsg.anthropicReasoning,
          geminiParts: currMsg.geminiParts
        };
      } else {
        newMessages[i] = {
          role: "assistant",
          content: currMsg.content,
          geminiParts: currMsg.geminiParts
        };
      }
      continue;
    }
    if (currMsg.role === "user") {
      newMessages[i] = {
        role: "user",
        content: currMsg.content
      };
      continue;
    }
    if (currMsg.role === "tool") {
      const prevMsg = 0 <= i - 1 && i - 1 <= newMessages.length ? newMessages[i - 1] : void 0;
      if (prevMsg?.role === "assistant") {
        if (typeof prevMsg.content === "string") prevMsg.content = [{ type: "text", text: prevMsg.content }];
        prevMsg.content.push({ type: "tool_use", id: currMsg.id, name: currMsg.name, input: currMsg.rawParams });
      }
      newMessages[i] = {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: currMsg.id, content: currMsg.content }]
      };
      continue;
    }
  }
  return newMessages;
};
const prepareMessages_XML_tools = (messages, supportsAnthropicReasoning) => {
  const llmChatMessages = [];
  for (let i = 0; i < messages.length; i += 1) {
    const c = messages[i];
    const next = 0 <= i + 1 && i + 1 <= messages.length - 1 ? messages[i + 1] : null;
    if (c.role === "assistant") {
      let content = c.content;
      if (next?.role === "tool") {
        content = `${content}

${reParsedToolXMLString(next.name, next.rawParams)}`;
      }
      if (c.anthropicReasoning && supportsAnthropicReasoning) {
        content = content ? [...c.anthropicReasoning, { type: "text", text: content }] : c.anthropicReasoning;
      }
      llmChatMessages.push({
        role: "assistant",
        content,
        geminiParts: c.geminiParts
      });
    } else if (c.role === "user" || c.role === "tool") {
      if (c.role === "tool")
        c.content = `<${c.name}_result>
${c.content}
</${c.name}_result>`;
      if (llmChatMessages.length === 0 || llmChatMessages[llmChatMessages.length - 1].role !== "user")
        llmChatMessages.push({
          role: "user",
          content: c.content
        });
      else
        llmChatMessages[llmChatMessages.length - 1].content += "\n\n" + c.content;
    }
  }
  return llmChatMessages;
};
const prepareOpenAIOrAnthropicMessages = ({
  messages: messages_,
  systemMessage,
  aiInstructions,
  supportsSystemMessage,
  specialToolFormat,
  supportsAnthropicReasoning,
  contextWindow,
  reservedOutputTokenSpace
}) => {
  reservedOutputTokenSpace = Math.max(
    contextWindow * 1 / 2,
    // reserve at least 1/4 of the token window length
    reservedOutputTokenSpace ?? 4096
    // defaults to 4096
  );
  let messages = deepClone(messages_);
  const sysMsgParts = [];
  if (aiInstructions) sysMsgParts.push(`GUIDELINES (from the user's .voidrules file):
${aiInstructions}`);
  if (systemMessage) sysMsgParts.push(systemMessage);
  const combinedSystemMessage = sysMsgParts.join("\n\n");
  messages.unshift({ role: "system", content: combinedSystemMessage });
  messages = messages.map((m) => ({ ...m, content: m.role !== "tool" ? m.content.trim() : m.content }));
  const alreadyTrimmedIdxes = /* @__PURE__ */ new Set();
  const weight = (message, messages2, idx) => {
    const base = message.content.length;
    let multiplier;
    multiplier = 1 + (messages2.length - 1 - idx) / messages2.length;
    if (message.role === "user") {
      multiplier *= 1;
    } else if (message.role === "system") {
      multiplier *= 0.01;
    } else {
      multiplier *= 10;
    }
    if (alreadyTrimmedIdxes.has(idx)) {
      multiplier = 0;
    }
    if (idx <= 1 || idx >= messages2.length - 1 - 3) {
      multiplier *= 0.05;
    }
    return base * multiplier;
  };
  const _findLargestByWeight = (messages_2) => {
    let largestIndex = -1;
    let largestWeight = -Infinity;
    for (let i2 = 0; i2 < messages.length; i2 += 1) {
      const m = messages[i2];
      const w = weight(m, messages_2, i2);
      if (w > largestWeight) {
        largestWeight = w;
        largestIndex = i2;
      }
    }
    return largestIndex;
  };
  let totalLen = 0;
  for (const m of messages) {
    totalLen += m.content.length;
  }
  const charsNeedToTrim = totalLen - Math.max(
    (contextWindow - reservedOutputTokenSpace) * CHARS_PER_TOKEN,
    // can be 0, in which case charsNeedToTrim=everything, bad
    5e3
    // ensure we don't trim at least 5k chars (just a random small value)
  );
  let remainingCharsToTrim = charsNeedToTrim;
  let i = 0;
  while (remainingCharsToTrim > 0) {
    i += 1;
    if (i > 100) break;
    const trimIdx = _findLargestByWeight(messages);
    const m = messages[trimIdx];
    const numCharsWillTrim = m.content.length - TRIM_TO_LEN;
    if (numCharsWillTrim > remainingCharsToTrim) {
      m.content = m.content.slice(0, m.content.length - remainingCharsToTrim - "...".length).trim() + "...";
      break;
    }
    remainingCharsToTrim -= numCharsWillTrim;
    m.content = m.content.substring(0, TRIM_TO_LEN - "...".length) + "...";
    alreadyTrimmedIdxes.add(trimIdx);
  }
  const newSysMsg = messages.shift().content;
  let llmChatMessages = [];
  if (!specialToolFormat) {
    llmChatMessages = prepareMessages_XML_tools(messages, supportsAnthropicReasoning);
  } else if (specialToolFormat === "anthropic-style") {
    llmChatMessages = prepareMessages_anthropic_tools(messages, supportsAnthropicReasoning);
  } else if (specialToolFormat === "openai-style") {
    llmChatMessages = prepareMessages_openai_tools(messages);
  }
  const llmMessages = llmChatMessages;
  let separateSystemMessageStr = void 0;
  if (supportsSystemMessage) {
    if (supportsSystemMessage === "separated")
      separateSystemMessageStr = newSysMsg;
    else if (supportsSystemMessage === "system-role")
      llmMessages.unshift({ role: "system", content: newSysMsg });
    else if (supportsSystemMessage === "developer-role")
      llmMessages.unshift({ role: "developer", content: newSysMsg });
  } else {
    const newFirstMessage = {
      role: "user",
      content: `<SYSTEM_MESSAGE>
${newSysMsg}
</SYSTEM_MESSAGE>
${llmMessages[0].content}`
    };
    llmMessages.splice(0, 1);
    llmMessages.unshift(newFirstMessage);
  }
  for (let i2 = 0; i2 < llmMessages.length; i2 += 1) {
    const currMsg = llmMessages[i2];
    const nextMsg = llmMessages[i2 + 1];
    if (currMsg.role === "tool") continue;
    if (typeof currMsg.content === "string") {
      currMsg.content = currMsg.content || EMPTY_MESSAGE;
    } else {
      if (currMsg.content.find((c) => c.type === "tool_result" || c.type === "tool_use")) {
        currMsg.content = currMsg.content.filter((c) => !(c.type === "text" && !c.text));
        continue;
      }
      if (nextMsg?.role === "tool") continue;
      for (const c of currMsg.content) {
        if (c.type === "text") c.text = c.text || EMPTY_MESSAGE;
      }
      if (currMsg.content.length === 0) currMsg.content = [{ type: "text", text: EMPTY_MESSAGE }];
    }
  }
  return {
    messages: llmMessages,
    separateSystemMessage: separateSystemMessageStr
  };
};
const prepareGeminiMessages = (messages, geminiPartsMap) => {
  let latestToolName = void 0;
  const messages2 = messages.map((m, idx) => {
    if (m.role === "assistant") {
      // If we have stored raw Gemini parts with thoughtSignatures, use them directly
      const storedParts = geminiPartsMap?.get(idx);
      if (storedParts && storedParts.length > 0) {
        for (const p of storedParts) {
          if (p.functionCall) latestToolName = p.functionCall.name;
        }
        return { role: "model", parts: storedParts };
      }
      if (typeof m.content === "string") {
        return { role: "model", parts: [{ text: m.content }] };
      } else {
        const parts = m.content.map((c) => {
          if (c.type === "text") {
            return { text: c.text };
          } else if (c.type === "tool_use") {
            latestToolName = c.name;
            return { functionCall: { id: c.id, name: c.name, args: c.input } };
          } else return null;
        }).filter((m2) => !!m2);
        return { role: "model", parts };
      }
    } else if (m.role === "user") {
      if (typeof m.content === "string") {
        return { role: "user", parts: [{ text: m.content }] };
      } else {
        const parts = m.content.map((c) => {
          if (c.type === "text") {
            return { text: c.text };
          } else if (c.type === "tool_result") {
            if (!latestToolName) return null;
            return { functionResponse: { id: c.tool_use_id, name: latestToolName, response: { output: c.content } } };
          } else return null;
        }).filter((m2) => !!m2);
        return { role: "user", parts };
      }
    } else return null;
  }).filter((m) => !!m);
  return messages2;
};
const prepareMessages = (params) => {
  const specialFormat = params.specialToolFormat;
  if (params.providerName === "gemini" || params.providerName === "googleVertex" || specialFormat === "gemini-style") {
    const res = prepareOpenAIOrAnthropicMessages({ ...params, specialToolFormat: specialFormat === "gemini-style" ? "anthropic-style" : void 0 });
    const messages = res.messages;
    // Build map of index -> geminiParts for assistant messages that have stored raw parts
    const geminiPartsMap = new Map();
    messages.forEach((m, idx) => {
      if (m.role === "assistant" && m.geminiParts && m.geminiParts.length > 0) {
        geminiPartsMap.set(idx, m.geminiParts);
      }
    });
    const messages2 = prepareGeminiMessages(messages, geminiPartsMap);
    return { messages: messages2, separateSystemMessage: res.separateSystemMessage };
  }
  return prepareOpenAIOrAnthropicMessages({ ...params, specialToolFormat: specialFormat });
};
const IConvertToLLMMessageService = createDecorator("ConvertToLLMMessageService");
let ConvertToLLMMessageService = class extends Disposable {
  constructor(modelService, workspaceContextService, editorService, directoryStrService, terminalToolService, voidSettingsService, voidModelService, mcpService) {
    super();
    this.modelService = modelService;
    this.workspaceContextService = workspaceContextService;
    this.editorService = editorService;
    this.directoryStrService = directoryStrService;
    this.terminalToolService = terminalToolService;
    this.voidSettingsService = voidSettingsService;
    this.voidModelService = voidModelService;
    this.mcpService = mcpService;
    // system message
    this._generateChatMessagesSystemMessage = async (chatMode, specialToolFormat, userMessage, isFollowUpTurn) => {
      const workspaceFolders = this.workspaceContextService.getWorkspace().folders.map((f) => f.uri.fsPath);
      const openedURIs = this.modelService.getModels().filter((m) => m.isAttachedToEditor()).map((m) => m.uri.fsPath) || [];
      const activeURI = this.editorService.activeEditor?.resource?.fsPath;
      if (isFollowUpTurn) {
        const wsPath = workspaceFolders[0] || '/unknown';
        const minimalPrompt = `You are Plaxio, an IEC 61131-3 PLC programming assistant. Continue executing the task.\nThe full schema and rules were provided in the first system message — refer to them.\n\nCRITICAL REMINDERS:\n- Workspace folder: ${wsPath}\n- ALL file paths MUST be absolute paths inside the workspace (e.g. "${wsPath}/filename.ld.json")\n- NEVER use bare filenames like "/file.json" — always prefix with the workspace path above\n- For PLC programs: use plc_write_program tool (saves .ld.json, .fbd.json, .sfc.json). Do NOT use rewrite_file for PLC program JSON. Do NOT auto-export ST.\n- For ST files: use plc_export_st tool ONLY when user explicitly asks\n- For HMI simulation: MANDATORY 7-step workflow — plaxio_get_project → plc_get_program → build JSON → save as ${wsPath}/<name>_hmi.json via rewrite_file → plaxio_save_view (full project JSON) → plaxio_set_tag_value (all tags, one call). ALL 7 steps required. File MUST be named *_hmi.json. Build real SVG geometry in svgcontent. NEVER call plaxio_generate_view.\n- NEVER mention tool names in user-facing responses. NEVER say "FUXA" — say "Plaxio Simulator".\n- NEVER narrate what you are about to do. Just do it silently and report only the final result.\n- ERROR HANDLING: When a tool fails, NEVER retry the exact same call. Diagnose and try a corrected approach. After 2 failures on the same step, skip it and tell the user what succeeded and what could not be completed.\n- KEEP RESPONSES MINIMAL. One short sentence after finishing. Do not list steps taken.\n- Only use rewrite_file/create_file_or_folder for non-PLC files (config, _hmi.json, docs, etc.)\n- Active file: ${activeURI || 'none'}`;
        console.log(`[Plaxio Perf] Follow-up turn: using minimal system prompt (${minimalPrompt.length} chars instead of full)`);
        return minimalPrompt;
      }
      const t0 = performance.now();
      const directoryStr = await this.directoryStrService.getAllDirectoriesStr({
        cutOffMessage: chatMode === "agent" || chatMode === "gather" ? `...Directories string cut off, use tools to read more...` : `...Directories string cut off, ask user for more if necessary...`
      });
      const t1 = performance.now();
      const includeXMLToolDefinitions = !specialToolFormat;
      const mcpTools = this.mcpService.getMCPTools();
      const persistentTerminalIDs = this.terminalToolService.listPersistentTerminalIds();
      const systemMessage = chat_systemMessage({ workspaceFolders, openedURIs, directoryStr, activeURI, persistentTerminalIDs, chatMode, mcpTools, includeXMLToolDefinitions, userMessage });
      const t2 = performance.now();
      console.log(`[Plaxio Perf] Directory scan: ${(t1 - t0).toFixed(0)}ms, Prompt assembly: ${(t2 - t1).toFixed(0)}ms, System prompt length: ${systemMessage.length} chars`);
      return systemMessage;
    };
    this.prepareLLMSimpleMessages = ({ simpleMessages, systemMessage, modelSelection, featureName }) => {
      if (modelSelection === null) return { messages: [], separateSystemMessage: void 0 };
      const { overridesOfModel } = this.voidSettingsService.state;
      const { providerName, modelName } = modelSelection;
      const {
        specialToolFormat,
        contextWindow,
        supportsSystemMessage
      } = getModelCapabilities(providerName, modelName, overridesOfModel);
      const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName];
      const aiInstructions = this._getCombinedAIInstructions();
      const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel);
      const reservedOutputTokenSpace = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled, overridesOfModel });
      const { messages, separateSystemMessage } = prepareMessages({
        messages: simpleMessages,
        systemMessage,
        aiInstructions,
        supportsSystemMessage,
        specialToolFormat,
        supportsAnthropicReasoning: providerName === "anthropic",
        contextWindow,
        reservedOutputTokenSpace,
        providerName
      });
      return { messages, separateSystemMessage };
    };
    this.prepareLLMChatMessages = async ({ chatMessages, chatMode, modelSelection, isFollowUpTurn }) => {
      if (modelSelection === null) return { messages: [], separateSystemMessage: void 0 };
      const { overridesOfModel } = this.voidSettingsService.state;
      const { providerName, modelName } = modelSelection;
      const {
        specialToolFormat,
        contextWindow,
        supportsSystemMessage
      } = getModelCapabilities(providerName, modelName, overridesOfModel);
      const { disableSystemMessage } = this.voidSettingsService.state.globalSettings;
      const lastUserMsg = [...chatMessages].reverse().find(m => m.role === "user");
      const fullSystemMessage = await this._generateChatMessagesSystemMessage(chatMode, specialToolFormat, lastUserMsg?.content, isFollowUpTurn);
      const systemMessage = disableSystemMessage ? "" : fullSystemMessage;
      const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection["Chat"][modelSelection.providerName]?.[modelSelection.modelName];
      const aiInstructions = this._getCombinedAIInstructions();
      const isReasoningEnabled = getIsReasoningEnabledState("Chat", providerName, modelName, modelSelectionOptions, overridesOfModel);
      const reservedOutputTokenSpace = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled, overridesOfModel });
      const llmMessages = this._chatMessagesToSimpleMessages(chatMessages);
      const { messages, separateSystemMessage } = prepareMessages({
        messages: llmMessages,
        systemMessage,
        aiInstructions,
        supportsSystemMessage,
        specialToolFormat,
        supportsAnthropicReasoning: providerName === "anthropic",
        contextWindow,
        reservedOutputTokenSpace,
        providerName
      });
      return { messages, separateSystemMessage };
    };
    // --- FIM ---
    this.prepareFIMMessage = ({ messages }) => {
      const combinedInstructions = this._getCombinedAIInstructions();
      let prefix = `${!combinedInstructions ? "" : `// Instructions:
// Do not output an explanation. Try to avoid outputting comments. Only output the middle code.
${combinedInstructions.split("\n").map((line) => `//${line}`).join("\n")}`}

${messages.prefix}`;
      const suffix = messages.suffix;
      const stopTokens = messages.stopTokens;
      return { prefix, suffix, stopTokens };
    };
  }
  // Read .voidrules files from workspace folders
  _getVoidRulesFileContents() {
    try {
      const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
      let voidRules = "";
      for (const folder of workspaceFolders) {
        const uri = URI.joinPath(folder.uri, ".voidrules");
        const { model } = this.voidModelService.getModel(uri);
        if (!model) continue;
        voidRules += model.getValue(EndOfLinePreference.LF) + "\n\n";
      }
      return voidRules.trim();
    } catch (e) {
      return "";
    }
  }
  // Get combined AI instructions from settings and .voidrules files
  _getCombinedAIInstructions() {
    const globalAIInstructions = this.voidSettingsService.state.globalSettings.aiInstructions;
    const voidRulesFileContent = this._getVoidRulesFileContents();
    const ans = [];
    if (globalAIInstructions) ans.push(globalAIInstructions);
    if (voidRulesFileContent) ans.push(voidRulesFileContent);
    return ans.join("\n\n");
  }
  // --- LLM Chat messages ---
  _chatMessagesToSimpleMessages(chatMessages) {
    const simpleLLMMessages = [];
    for (const m of chatMessages) {
      if (m.role === "checkpoint") continue;
      if (m.role === "interrupted_streaming_tool") continue;
      if (m.role === "assistant") {
        simpleLLMMessages.push({
          role: m.role,
          content: m.displayContent,
          anthropicReasoning: m.anthropicReasoning,
          geminiParts: m.geminiParts
        });
      } else if (m.role === "tool") {
        simpleLLMMessages.push({
          role: m.role,
          content: m.content,
          name: m.name,
          id: m.id,
          rawParams: m.rawParams
        });
      } else if (m.role === "user") {
        simpleLLMMessages.push({
          role: m.role,
          content: m.content
        });
      }
    }
    return simpleLLMMessages;
  }
};
ConvertToLLMMessageService = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IDirectoryStrService),
  __decorateParam(4, ITerminalToolService),
  __decorateParam(5, IVoidSettingsService),
  __decorateParam(6, IVoidModelService),
  __decorateParam(7, IMCPService)
], ConvertToLLMMessageService);
registerSingleton(IConvertToLLMMessageService, ConvertToLLMMessageService, InstantiationType.Eager);
export {
  EMPTY_MESSAGE,
  IConvertToLLMMessageService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvY29udmVydFRvTExNTWVzc2FnZVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZGVlcENsb25lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclNpbmdsZXRvbiwgSW5zdGFudGlhdGlvblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdE1lc3NhZ2UgfSBmcm9tICcuLi9jb21tb24vY2hhdFRocmVhZFNlcnZpY2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBnZXRJc1JlYXNvbmluZ0VuYWJsZWRTdGF0ZSwgZ2V0UmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlLCBnZXRNb2RlbENhcGFiaWxpdGllcyB9IGZyb20gJy4uL2NvbW1vbi9tb2RlbENhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyByZVBhcnNlZFRvb2xYTUxTdHJpbmcsIGNoYXRfc3lzdGVtTWVzc2FnZSB9IGZyb20gJy4uL2NvbW1vbi9wcm9tcHQvcHJvbXB0cy5qcyc7XG5pbXBvcnQgeyBBbnRocm9waWNMTE1DaGF0TWVzc2FnZSwgQW50aHJvcGljUmVhc29uaW5nLCBHZW1pbmlMTE1DaGF0TWVzc2FnZSwgTExNQ2hhdE1lc3NhZ2UsIExMTUZJTU1lc3NhZ2UsIE9wZW5BSUxMTUNoYXRNZXNzYWdlLCBSYXdUb29sUGFyYW1zT2JqIH0gZnJvbSAnLi4vY29tbW9uL3NlbmRMTE1NZXNzYWdlVHlwZXMuanMnO1xuaW1wb3J0IHsgSVZvaWRTZXR0aW5nc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdm9pZFNldHRpbmdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0TW9kZSwgRmVhdHVyZU5hbWUsIE1vZGVsU2VsZWN0aW9uLCBQcm92aWRlck5hbWUgfSBmcm9tICcuLi9jb21tb24vdm9pZFNldHRpbmdzVHlwZXMuanMnO1xuaW1wb3J0IHsgSURpcmVjdG9yeVN0clNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vZGlyZWN0b3J5U3RyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxUb29sU2VydmljZSB9IGZyb20gJy4vdGVybWluYWxUb29sU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVm9pZE1vZGVsU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi92b2lkTW9kZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBUb29sTmFtZSB9IGZyb20gJy4uL2NvbW1vbi90b29sc1NlcnZpY2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBJTUNQU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9tY3BTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNvbnN0IEVNUFRZX01FU1NBR0UgPSAnKGVtcHR5IG1lc3NhZ2UpJ1xuXG5cblxudHlwZSBTaW1wbGVMTE1NZXNzYWdlID0ge1xuXHRyb2xlOiAndG9vbCc7XG5cdGNvbnRlbnQ6IHN0cmluZztcblx0aWQ6IHN0cmluZztcblx0bmFtZTogVG9vbE5hbWU7XG5cdHJhd1BhcmFtczogUmF3VG9vbFBhcmFtc09iajtcbn0gfCB7XG5cdHJvbGU6ICd1c2VyJztcblx0Y29udGVudDogc3RyaW5nO1xufSB8IHtcblx0cm9sZTogJ2Fzc2lzdGFudCc7XG5cdGNvbnRlbnQ6IHN0cmluZztcblx0YW50aHJvcGljUmVhc29uaW5nOiBBbnRocm9waWNSZWFzb25pbmdbXSB8IG51bGw7XG59XG5cblxuXG5jb25zdCBDSEFSU19QRVJfVE9LRU4gPSA0IC8vIGFzc3VtZSBhYnlzbWFsIGNoYXJzIHBlciB0b2tlblxuY29uc3QgVFJJTV9UT19MRU4gPSAxMjBcblxuXG5cblxuLy8gY29udmVydCBtZXNzYWdlcyBhcyBpZiBhYm91dCB0byBzZW5kIHRvIG9wZW5haVxuLypcbnJlZmVyZW5jZSAtIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2d1aWRlcy9mdW5jdGlvbi1jYWxsaW5nI2Z1bmN0aW9uLWNhbGxpbmctc3RlcHNcbm9wZW5haSBNRVNTQUdFIChyb2xlPWFzc2lzdGFudCk6XG5cInRvb2xfY2FsbHNcIjpbe1xuXHRcInR5cGVcIjogXCJmdW5jdGlvblwiLFxuXHRcImlkXCI6IFwiY2FsbF8xMjM0NXh5elwiLFxuXHRcImZ1bmN0aW9uXCI6IHtcblx0XCJuYW1lXCI6IFwiZ2V0X3dlYXRoZXJcIixcblx0XCJhcmd1bWVudHNcIjogXCJ7XFxcImxhdGl0dWRlXFxcIjo0OC44NTY2LFxcXCJsb25naXR1ZGVcXFwiOjIuMzUyMn1cIlxufV1cblxub3BlbmFpIFJFU1BPTlNFIChyb2xlPXVzZXIpOlxueyAgIFwicm9sZVwiOiBcInRvb2xcIixcblx0XCJ0b29sX2NhbGxfaWRcIjogdG9vbF9jYWxsLmlkLFxuXHRcImNvbnRlbnRcIjogc3RyKHJlc3VsdCkgICAgfVxuXG5hbHNvIHNlZVxub3BlbmFpIG9uIHByb21wdGluZyAtIGh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbS9kb2NzL2d1aWRlcy9yZWFzb25pbmcjYWR2aWNlLW9uLXByb21wdGluZ1xub3BlbmFpIG9uIGRldmVsb3BlciBzeXN0ZW0gbWVzc2FnZSAtIGh0dHBzOi8vY2RuLm9wZW5haS5jb20vc3BlYy9tb2RlbC1zcGVjLTIwMjQtMDUtMDguaHRtbCNmb2xsb3ctdGhlLWNoYWluLW9mLWNvbW1hbmRcbiovXG5cblxuY29uc3QgcHJlcGFyZU1lc3NhZ2VzX29wZW5haV90b29scyA9IChtZXNzYWdlczogU2ltcGxlTExNTWVzc2FnZVtdKTogQW50aHJvcGljT3JPcGVuQUlMTE1NZXNzYWdlW10gPT4ge1xuXG5cdGNvbnN0IG5ld01lc3NhZ2VzOiBPcGVuQUlMTE1DaGF0TWVzc2FnZVtdID0gW107XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtZXNzYWdlcy5sZW5ndGg7IGkgKz0gMSkge1xuXHRcdGNvbnN0IGN1cnJNc2cgPSBtZXNzYWdlc1tpXVxuXG5cdFx0aWYgKGN1cnJNc2cucm9sZSAhPT0gJ3Rvb2wnKSB7XG5cdFx0XHRuZXdNZXNzYWdlcy5wdXNoKGN1cnJNc2cpXG5cdFx0XHRjb250aW51ZVxuXHRcdH1cblxuXHRcdC8vIGVkaXQgcHJldmlvdXMgYXNzaXN0YW50IG1lc3NhZ2UgdG8gaGF2ZSBjYWxsZWQgdGhlIHRvb2xcblx0XHRjb25zdCBwcmV2TXNnID0gMCA8PSBpIC0gMSAmJiBpIC0gMSA8PSBuZXdNZXNzYWdlcy5sZW5ndGggPyBuZXdNZXNzYWdlc1tpIC0gMV0gOiB1bmRlZmluZWRcblx0XHRpZiAocHJldk1zZz8ucm9sZSA9PT0gJ2Fzc2lzdGFudCcpIHtcblx0XHRcdHByZXZNc2cudG9vbF9jYWxscyA9IFt7XG5cdFx0XHRcdHR5cGU6ICdmdW5jdGlvbicsXG5cdFx0XHRcdGlkOiBjdXJyTXNnLmlkLFxuXHRcdFx0XHRmdW5jdGlvbjoge1xuXHRcdFx0XHRcdG5hbWU6IGN1cnJNc2cubmFtZSxcblx0XHRcdFx0XHRhcmd1bWVudHM6IEpTT04uc3RyaW5naWZ5KGN1cnJNc2cucmF3UGFyYW1zKVxuXHRcdFx0XHR9XG5cdFx0XHR9XVxuXHRcdH1cblxuXHRcdC8vIGFkZCB0aGUgdG9vbFxuXHRcdG5ld01lc3NhZ2VzLnB1c2goe1xuXHRcdFx0cm9sZTogJ3Rvb2wnLFxuXHRcdFx0dG9vbF9jYWxsX2lkOiBjdXJyTXNnLmlkLFxuXHRcdFx0Y29udGVudDogY3Vyck1zZy5jb250ZW50LFxuXHRcdH0pXG5cdH1cblx0cmV0dXJuIG5ld01lc3NhZ2VzXG5cbn1cblxuXG5cbi8vIGNvbnZlcnQgbWVzc2FnZXMgYXMgaWYgYWJvdXQgdG8gc2VuZCB0byBhbnRocm9waWNcbi8qXG5odHRwczovL2RvY3MuYW50aHJvcGljLmNvbS9lbi9kb2NzL2J1aWxkLXdpdGgtY2xhdWRlL3Rvb2wtdXNlI3Rvb2wtdXNlLWV4YW1wbGVzXG5hbnRocm9waWMgTUVTU0FHRSAocm9sZT1hc3Npc3RhbnQpOlxuXCJjb250ZW50XCI6IFt7XG5cdFwidHlwZVwiOiBcInRleHRcIixcblx0XCJ0ZXh0XCI6IFwiPHRoaW5raW5nPkkgbmVlZCB0byBjYWxsIHRoZSBnZXRfd2VhdGhlciBmdW5jdGlvbiwgYW5kIHRoZSB1c2VyIHdhbnRzIFNGLCB3aGljaCBpcyBsaWtlbHkgU2FuIEZyYW5jaXNjbywgQ0EuPC90aGlua2luZz5cIlxufSwge1xuXHRcInR5cGVcIjogXCJ0b29sX3VzZVwiLFxuXHRcImlkXCI6IFwidG9vbHVfMDFBMDlxOTBxdzkwbHE5MTc4MzVscTlcIixcblx0XCJuYW1lXCI6IFwiZ2V0X3dlYXRoZXJcIixcblx0XCJpbnB1dFwiOiB7IFwibG9jYXRpb25cIjogXCJTYW4gRnJhbmNpc2NvLCBDQVwiLCBcInVuaXRcIjogXCJjZWxzaXVzXCIgfVxufV1cbmFudGhyb3BpYyBSRVNQT05TRSAocm9sZT11c2VyKTpcblwiY29udGVudFwiOiBbe1xuXHRcInR5cGVcIjogXCJ0b29sX3Jlc3VsdFwiLFxuXHRcInRvb2xfdXNlX2lkXCI6IFwidG9vbHVfMDFBMDlxOTBxdzkwbHE5MTc4MzVscTlcIixcblx0XCJjb250ZW50XCI6IFwiMTUgZGVncmVlc1wiXG59XVxuXG5cbkNvbnZlcnRzOlxuYXNzaXN0YW50OiAuLi5jb250ZW50XG50b29sOiAoaWQsIG5hbWUsIHBhcmFtcylcbi0+XG5hc3Npc3RhbnQ6IC4uLmNvbnRlbnQsIGNhbGwobmFtZSwgaWQsIHBhcmFtcylcbnVzZXI6IC4uLmNvbnRlbnQsIHJlc3VsdChpZCwgY29udGVudClcbiovXG5cbnR5cGUgQW50aHJvcGljT3JPcGVuQUlMTE1NZXNzYWdlID0gQW50aHJvcGljTExNQ2hhdE1lc3NhZ2UgfCBPcGVuQUlMTE1DaGF0TWVzc2FnZVxuXG5jb25zdCBwcmVwYXJlTWVzc2FnZXNfYW50aHJvcGljX3Rvb2xzID0gKG1lc3NhZ2VzOiBTaW1wbGVMTE1NZXNzYWdlW10sIHN1cHBvcnRzQW50aHJvcGljUmVhc29uaW5nOiBib29sZWFuKTogQW50aHJvcGljT3JPcGVuQUlMTE1NZXNzYWdlW10gPT4ge1xuXHRjb25zdCBuZXdNZXNzYWdlczogKEFudGhyb3BpY0xMTUNoYXRNZXNzYWdlIHwgKFNpbXBsZUxMTU1lc3NhZ2UgJiB7IHJvbGU6ICd0b29sJyB9KSlbXSA9IG1lc3NhZ2VzO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbWVzc2FnZXMubGVuZ3RoOyBpICs9IDEpIHtcblx0XHRjb25zdCBjdXJyTXNnID0gbWVzc2FnZXNbaV1cblxuXHRcdC8vIGFkZCBhbnRocm9waWMgcmVhc29uaW5nXG5cdFx0aWYgKGN1cnJNc2cucm9sZSA9PT0gJ2Fzc2lzdGFudCcpIHtcblx0XHRcdGlmIChjdXJyTXNnLmFudGhyb3BpY1JlYXNvbmluZyAmJiBzdXBwb3J0c0FudGhyb3BpY1JlYXNvbmluZykge1xuXHRcdFx0XHRjb25zdCBjb250ZW50ID0gY3Vyck1zZy5jb250ZW50XG5cdFx0XHRcdG5ld01lc3NhZ2VzW2ldID0ge1xuXHRcdFx0XHRcdHJvbGU6ICdhc3Npc3RhbnQnLFxuXHRcdFx0XHRcdGNvbnRlbnQ6IGNvbnRlbnQgPyBbLi4uY3Vyck1zZy5hbnRocm9waWNSZWFzb25pbmcsIHsgdHlwZTogJ3RleHQnIGFzIGNvbnN0LCB0ZXh0OiBjb250ZW50IH1dIDogY3Vyck1zZy5hbnRocm9waWNSZWFzb25pbmdcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdG5ld01lc3NhZ2VzW2ldID0ge1xuXHRcdFx0XHRcdHJvbGU6ICdhc3Npc3RhbnQnLFxuXHRcdFx0XHRcdGNvbnRlbnQ6IGN1cnJNc2cuY29udGVudCxcblx0XHRcdFx0XHQvLyBzdHJpcCBhd2F5IGFudGhyb3BpY1JlYXNvbmluZ1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb250aW51ZVxuXHRcdH1cblxuXHRcdGlmIChjdXJyTXNnLnJvbGUgPT09ICd1c2VyJykge1xuXHRcdFx0bmV3TWVzc2FnZXNbaV0gPSB7XG5cdFx0XHRcdHJvbGU6ICd1c2VyJyxcblx0XHRcdFx0Y29udGVudDogY3Vyck1zZy5jb250ZW50LFxuXHRcdFx0fVxuXHRcdFx0Y29udGludWVcblx0XHR9XG5cblx0XHRpZiAoY3Vyck1zZy5yb2xlID09PSAndG9vbCcpIHtcblx0XHRcdC8vIGFkZCBhbnRocm9waWMgdG9vbHNcblx0XHRcdGNvbnN0IHByZXZNc2cgPSAwIDw9IGkgLSAxICYmIGkgLSAxIDw9IG5ld01lc3NhZ2VzLmxlbmd0aCA/IG5ld01lc3NhZ2VzW2kgLSAxXSA6IHVuZGVmaW5lZFxuXG5cdFx0XHQvLyBtYWtlIGl0IHNvIHRoZSBhc3Npc3RhbnQgY2FsbGVkIHRoZSB0b29sXG5cdFx0XHRpZiAocHJldk1zZz8ucm9sZSA9PT0gJ2Fzc2lzdGFudCcpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBwcmV2TXNnLmNvbnRlbnQgPT09ICdzdHJpbmcnKSBwcmV2TXNnLmNvbnRlbnQgPSBbeyB0eXBlOiAndGV4dCcsIHRleHQ6IHByZXZNc2cuY29udGVudCB9XVxuXHRcdFx0XHRwcmV2TXNnLmNvbnRlbnQucHVzaCh7IHR5cGU6ICd0b29sX3VzZScsIGlkOiBjdXJyTXNnLmlkLCBuYW1lOiBjdXJyTXNnLm5hbWUsIGlucHV0OiBjdXJyTXNnLnJhd1BhcmFtcyB9KVxuXHRcdFx0fVxuXG5cdFx0XHQvLyB0dXJuIGVhY2ggdG9vbCBpbnRvIGEgdXNlciBtZXNzYWdlIHdpdGggdG9vbCByZXN1bHRzIGF0IHRoZSBlbmRcblx0XHRcdG5ld01lc3NhZ2VzW2ldID0ge1xuXHRcdFx0XHRyb2xlOiAndXNlcicsXG5cdFx0XHRcdGNvbnRlbnQ6IFt7IHR5cGU6ICd0b29sX3Jlc3VsdCcsIHRvb2xfdXNlX2lkOiBjdXJyTXNnLmlkLCBjb250ZW50OiBjdXJyTXNnLmNvbnRlbnQgfV1cblx0XHRcdH1cblx0XHRcdGNvbnRpbnVlXG5cdFx0fVxuXG5cdH1cblxuXHQvLyB3ZSBqdXN0IHJlbW92ZWQgdGhlIHRvb2xzXG5cdHJldHVybiBuZXdNZXNzYWdlcyBhcyBBbnRocm9waWNMTE1DaGF0TWVzc2FnZVtdXG59XG5cblxuY29uc3QgcHJlcGFyZU1lc3NhZ2VzX1hNTF90b29scyA9IChtZXNzYWdlczogU2ltcGxlTExNTWVzc2FnZVtdLCBzdXBwb3J0c0FudGhyb3BpY1JlYXNvbmluZzogYm9vbGVhbik6IEFudGhyb3BpY09yT3BlbkFJTExNTWVzc2FnZVtdID0+IHtcblxuXHRjb25zdCBsbG1DaGF0TWVzc2FnZXM6IEFudGhyb3BpY09yT3BlbkFJTExNTWVzc2FnZVtdID0gW107XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbWVzc2FnZXMubGVuZ3RoOyBpICs9IDEpIHtcblxuXHRcdGNvbnN0IGMgPSBtZXNzYWdlc1tpXVxuXHRcdGNvbnN0IG5leHQgPSAwIDw9IGkgKyAxICYmIGkgKyAxIDw9IG1lc3NhZ2VzLmxlbmd0aCAtIDEgPyBtZXNzYWdlc1tpICsgMV0gOiBudWxsXG5cblx0XHRpZiAoYy5yb2xlID09PSAnYXNzaXN0YW50Jykge1xuXHRcdFx0Ly8gaWYgY2FsbGVkIGEgdG9vbCAobWVzc2FnZSBhZnRlciBpdCksIHJlLWFkZCBpdHMgWE1MIHRvIHRoZSBtZXNzYWdlXG5cdFx0XHQvLyBhbHRlcm5hdGl2ZWx5LCBjb3VsZCBqdXN0IGhvbGQgb250byB0aGUgb3JpZ2luYWwgb3V0cHV0LCBidXQgdGhpcyB3YXkgcmVxdWlyZXMgbGVzcyBwaXBpbmcgcmF3IHN0cmluZ3MgZXZlcnl3aGVyZVxuXHRcdFx0bGV0IGNvbnRlbnQ6IEFudGhyb3BpY09yT3BlbkFJTExNTWVzc2FnZVsnY29udGVudCddID0gYy5jb250ZW50XG5cdFx0XHRpZiAobmV4dD8ucm9sZSA9PT0gJ3Rvb2wnKSB7XG5cdFx0XHRcdGNvbnRlbnQgPSBgJHtjb250ZW50fVxcblxcbiR7cmVQYXJzZWRUb29sWE1MU3RyaW5nKG5leHQubmFtZSwgbmV4dC5yYXdQYXJhbXMpfWBcblx0XHRcdH1cblxuXHRcdFx0Ly8gYW50aHJvcGljIHJlYXNvbmluZ1xuXHRcdFx0aWYgKGMuYW50aHJvcGljUmVhc29uaW5nICYmIHN1cHBvcnRzQW50aHJvcGljUmVhc29uaW5nKSB7XG5cdFx0XHRcdGNvbnRlbnQgPSBjb250ZW50ID8gWy4uLmMuYW50aHJvcGljUmVhc29uaW5nLCB7IHR5cGU6ICd0ZXh0JyBhcyBjb25zdCwgdGV4dDogY29udGVudCB9XSA6IGMuYW50aHJvcGljUmVhc29uaW5nXG5cdFx0XHR9XG5cdFx0XHRsbG1DaGF0TWVzc2FnZXMucHVzaCh7XG5cdFx0XHRcdHJvbGU6ICdhc3Npc3RhbnQnLFxuXHRcdFx0XHRjb250ZW50XG5cdFx0XHR9KVxuXHRcdH1cblx0XHQvLyBhZGQgdXNlciBvciB0b29sIHRvIHRoZSBwcmV2aW91cyB1c2VyIG1lc3NhZ2Vcblx0XHRlbHNlIGlmIChjLnJvbGUgPT09ICd1c2VyJyB8fCBjLnJvbGUgPT09ICd0b29sJykge1xuXHRcdFx0aWYgKGMucm9sZSA9PT0gJ3Rvb2wnKVxuXHRcdFx0XHRjLmNvbnRlbnQgPSBgPCR7Yy5uYW1lfV9yZXN1bHQ+XFxuJHtjLmNvbnRlbnR9XFxuPC8ke2MubmFtZX1fcmVzdWx0PmBcblxuXHRcdFx0aWYgKGxsbUNoYXRNZXNzYWdlcy5sZW5ndGggPT09IDAgfHwgbGxtQ2hhdE1lc3NhZ2VzW2xsbUNoYXRNZXNzYWdlcy5sZW5ndGggLSAxXS5yb2xlICE9PSAndXNlcicpXG5cdFx0XHRcdGxsbUNoYXRNZXNzYWdlcy5wdXNoKHtcblx0XHRcdFx0XHRyb2xlOiAndXNlcicsXG5cdFx0XHRcdFx0Y29udGVudDogYy5jb250ZW50XG5cdFx0XHRcdH0pXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGxsbUNoYXRNZXNzYWdlc1tsbG1DaGF0TWVzc2FnZXMubGVuZ3RoIC0gMV0uY29udGVudCArPSAnXFxuXFxuJyArIGMuY29udGVudFxuXHRcdH1cblx0fVxuXHRyZXR1cm4gbGxtQ2hhdE1lc3NhZ2VzXG59XG5cblxuLy8gLS0tIENIQVQgLS0tXG5cbmNvbnN0IHByZXBhcmVPcGVuQUlPckFudGhyb3BpY01lc3NhZ2VzID0gKHtcblx0bWVzc2FnZXM6IG1lc3NhZ2VzXyxcblx0c3lzdGVtTWVzc2FnZSxcblx0YWlJbnN0cnVjdGlvbnMsXG5cdHN1cHBvcnRzU3lzdGVtTWVzc2FnZSxcblx0c3BlY2lhbFRvb2xGb3JtYXQsXG5cdHN1cHBvcnRzQW50aHJvcGljUmVhc29uaW5nLFxuXHRjb250ZXh0V2luZG93LFxuXHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2UsXG59OiB7XG5cdG1lc3NhZ2VzOiBTaW1wbGVMTE1NZXNzYWdlW10sXG5cdHN5c3RlbU1lc3NhZ2U6IHN0cmluZyxcblx0YWlJbnN0cnVjdGlvbnM6IHN0cmluZyxcblx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlOiBmYWxzZSB8ICdzeXN0ZW0tcm9sZScgfCAnZGV2ZWxvcGVyLXJvbGUnIHwgJ3NlcGFyYXRlZCcsXG5cdHNwZWNpYWxUb29sRm9ybWF0OiAnb3BlbmFpLXN0eWxlJyB8ICdhbnRocm9waWMtc3R5bGUnIHwgdW5kZWZpbmVkLFxuXHRzdXBwb3J0c0FudGhyb3BpY1JlYXNvbmluZzogYm9vbGVhbixcblx0Y29udGV4dFdpbmRvdzogbnVtYmVyLFxuXHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQsXG59KTogeyBtZXNzYWdlczogQW50aHJvcGljT3JPcGVuQUlMTE1NZXNzYWdlW10sIHNlcGFyYXRlU3lzdGVtTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkIH0gPT4ge1xuXG5cdHJlc2VydmVkT3V0cHV0VG9rZW5TcGFjZSA9IE1hdGgubWF4KFxuXHRcdGNvbnRleHRXaW5kb3cgKiAxIC8gMiwgLy8gcmVzZXJ2ZSBhdCBsZWFzdCAxLzQgb2YgdGhlIHRva2VuIHdpbmRvdyBsZW5ndGhcblx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2UgPz8gNF8wOTYgLy8gZGVmYXVsdHMgdG8gNDA5NlxuXHQpXG5cdGxldCBtZXNzYWdlczogKFNpbXBsZUxMTU1lc3NhZ2UgfCB7IHJvbGU6ICdzeXN0ZW0nLCBjb250ZW50OiBzdHJpbmcgfSlbXSA9IGRlZXBDbG9uZShtZXNzYWdlc18pXG5cblx0Ly8gPT09PT09PT09PT09PT09PSBzeXN0ZW0gbWVzc2FnZSA9PT09PT09PT09PT09PT09XG5cdC8vIEEgQ09NUExFVEUgSEFDSzogbGFzdCBtZXNzYWdlIGlzIHN5c3RlbSBtZXNzYWdlIGZvciBjb250ZXh0IHB1cnBvc2VzXG5cblx0Y29uc3Qgc3lzTXNnUGFydHM6IHN0cmluZ1tdID0gW11cblx0aWYgKGFpSW5zdHJ1Y3Rpb25zKSBzeXNNc2dQYXJ0cy5wdXNoKGBHVUlERUxJTkVTIChmcm9tIHRoZSB1c2VyJ3MgLnZvaWRydWxlcyBmaWxlKTpcXG4ke2FpSW5zdHJ1Y3Rpb25zfWApXG5cdGlmIChzeXN0ZW1NZXNzYWdlKSBzeXNNc2dQYXJ0cy5wdXNoKHN5c3RlbU1lc3NhZ2UpXG5cdGNvbnN0IGNvbWJpbmVkU3lzdGVtTWVzc2FnZSA9IHN5c01zZ1BhcnRzLmpvaW4oJ1xcblxcbicpXG5cblx0bWVzc2FnZXMudW5zaGlmdCh7IHJvbGU6ICdzeXN0ZW0nLCBjb250ZW50OiBjb21iaW5lZFN5c3RlbU1lc3NhZ2UgfSlcblxuXHQvLyA9PT09PT09PT09PT09PT09IHRyaW0gPT09PT09PT09PT09PT09PVxuXHRtZXNzYWdlcyA9IG1lc3NhZ2VzLm1hcChtID0+ICh7IC4uLm0sIGNvbnRlbnQ6IG0ucm9sZSAhPT0gJ3Rvb2wnID8gbS5jb250ZW50LnRyaW0oKSA6IG0uY29udGVudCB9KSlcblxuXHR0eXBlIE1lc1R5cGUgPSAodHlwZW9mIG1lc3NhZ2VzKVswXVxuXG5cdC8vID09PT09PT09PT09PT09PT0gZml0IGludG8gY29udGV4dCA9PT09PT09PT09PT09PT09XG5cblx0Ly8gdGhlIGhpZ2hlciB0aGUgd2VpZ2h0LCB0aGUgaGlnaGVyIHRoZSBkZXNpcmUgdG8gdHJ1bmNhdGUgLSBUUklNIEhJR0hFU1QgV0VJR0hUIE1FU1NBR0VTXG5cdGNvbnN0IGFscmVhZHlUcmltbWVkSWR4ZXMgPSBuZXcgU2V0PG51bWJlcj4oKVxuXHRjb25zdCB3ZWlnaHQgPSAobWVzc2FnZTogTWVzVHlwZSwgbWVzc2FnZXM6IE1lc1R5cGVbXSwgaWR4OiBudW1iZXIpID0+IHtcblx0XHRjb25zdCBiYXNlID0gbWVzc2FnZS5jb250ZW50Lmxlbmd0aFxuXG5cdFx0bGV0IG11bHRpcGxpZXI6IG51bWJlclxuXHRcdG11bHRpcGxpZXIgPSAxICsgKG1lc3NhZ2VzLmxlbmd0aCAtIDEgLSBpZHgpIC8gbWVzc2FnZXMubGVuZ3RoIC8vIHNsb3cgcmFtcGRvd24gZnJvbSAyIHRvIDEgYXMgaW5kZXggaW5jcmVhc2VzXG5cdFx0aWYgKG1lc3NhZ2Uucm9sZSA9PT0gJ3VzZXInKSB7XG5cdFx0XHRtdWx0aXBsaWVyICo9IDFcblx0XHR9XG5cdFx0ZWxzZSBpZiAobWVzc2FnZS5yb2xlID09PSAnc3lzdGVtJykge1xuXHRcdFx0bXVsdGlwbGllciAqPSAuMDEgLy8gdmVyeSBsb3cgd2VpZ2h0XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bXVsdGlwbGllciAqPSAxMCAvLyBsbG0gdG9rZW5zIGFyZSBmYXIgbGVzcyB2YWx1YWJsZSB0aGFuIHVzZXIgdG9rZW5zXG5cdFx0fVxuXG5cdFx0Ly8gYW55IGFscmVhZHkgbW9kaWZpZWQgbWVzc2FnZSBzaG91bGQgbm90IGJlIHRyaW1tZWQgYWdhaW5cblx0XHRpZiAoYWxyZWFkeVRyaW1tZWRJZHhlcy5oYXMoaWR4KSkge1xuXHRcdFx0bXVsdGlwbGllciA9IDBcblx0XHR9XG5cdFx0Ly8gMXN0IGFuZCBsYXN0IG1lc3NhZ2VzIHNob3VsZCBiZSB2ZXJ5IGxvdyB3ZWlnaHRcblx0XHRpZiAoaWR4IDw9IDEgfHwgaWR4ID49IG1lc3NhZ2VzLmxlbmd0aCAtIDEgLSAzKSB7XG5cdFx0XHRtdWx0aXBsaWVyICo9IC4wNVxuXHRcdH1cblx0XHRyZXR1cm4gYmFzZSAqIG11bHRpcGxpZXJcblx0fVxuXG5cdGNvbnN0IF9maW5kTGFyZ2VzdEJ5V2VpZ2h0ID0gKG1lc3NhZ2VzXzogTWVzVHlwZVtdKSA9PiB7XG5cdFx0bGV0IGxhcmdlc3RJbmRleCA9IC0xXG5cdFx0bGV0IGxhcmdlc3RXZWlnaHQgPSAtSW5maW5pdHlcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1lc3NhZ2VzLmxlbmd0aDsgaSArPSAxKSB7XG5cdFx0XHRjb25zdCBtID0gbWVzc2FnZXNbaV1cblx0XHRcdGNvbnN0IHcgPSB3ZWlnaHQobSwgbWVzc2FnZXNfLCBpKVxuXHRcdFx0aWYgKHcgPiBsYXJnZXN0V2VpZ2h0KSB7XG5cdFx0XHRcdGxhcmdlc3RXZWlnaHQgPSB3XG5cdFx0XHRcdGxhcmdlc3RJbmRleCA9IGlcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGxhcmdlc3RJbmRleFxuXHR9XG5cblx0bGV0IHRvdGFsTGVuID0gMFxuXHRmb3IgKGNvbnN0IG0gb2YgbWVzc2FnZXMpIHsgdG90YWxMZW4gKz0gbS5jb250ZW50Lmxlbmd0aCB9XG5cdGNvbnN0IGNoYXJzTmVlZFRvVHJpbSA9IHRvdGFsTGVuIC0gTWF0aC5tYXgoXG5cdFx0KGNvbnRleHRXaW5kb3cgLSByZXNlcnZlZE91dHB1dFRva2VuU3BhY2UpICogQ0hBUlNfUEVSX1RPS0VOLCAvLyBjYW4gYmUgMCwgaW4gd2hpY2ggY2FzZSBjaGFyc05lZWRUb1RyaW09ZXZlcnl0aGluZywgYmFkXG5cdFx0NV8wMDAgLy8gZW5zdXJlIHdlIGRvbid0IHRyaW0gYXQgbGVhc3QgNWsgY2hhcnMgKGp1c3QgYSByYW5kb20gc21hbGwgdmFsdWUpXG5cdClcblxuXG5cdC8vIDwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLT5cblx0Ly8gMCAgICAgICAgICAgICAgICAgICAgICB8ICAgIHwgICAgICAgICAgICAgfFxuXHQvLyAgICAgICAgICAgICAgICAgICAgICAgIHwgICAgY29udGV4dFdpbmRvdyB8XG5cdC8vICAgICAgICAgICAgICAgICAgICAgY29udGV4dFdpbmRvdyAtIG1heE91dHxwdXRUb2tlbnNcblx0Ly8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3RhbExlblxuXHRsZXQgcmVtYWluaW5nQ2hhcnNUb1RyaW0gPSBjaGFyc05lZWRUb1RyaW1cblx0bGV0IGkgPSAwXG5cblx0d2hpbGUgKHJlbWFpbmluZ0NoYXJzVG9UcmltID4gMCkge1xuXHRcdGkgKz0gMVxuXHRcdGlmIChpID4gMTAwKSBicmVha1xuXG5cdFx0Y29uc3QgdHJpbUlkeCA9IF9maW5kTGFyZ2VzdEJ5V2VpZ2h0KG1lc3NhZ2VzKVxuXHRcdGNvbnN0IG0gPSBtZXNzYWdlc1t0cmltSWR4XVxuXG5cdFx0Ly8gaWYgY2FuIGZpbmlzaCBoZXJlLCBkb1xuXHRcdGNvbnN0IG51bUNoYXJzV2lsbFRyaW0gPSBtLmNvbnRlbnQubGVuZ3RoIC0gVFJJTV9UT19MRU5cblx0XHRpZiAobnVtQ2hhcnNXaWxsVHJpbSA+IHJlbWFpbmluZ0NoYXJzVG9UcmltKSB7XG5cdFx0XHQvLyB0cmltIHJlbWFpbmluZ0NoYXJzVG9UcmltICsgJy4uLicubGVuZ3RoIGNoYXJzXG5cdFx0XHRtLmNvbnRlbnQgPSBtLmNvbnRlbnQuc2xpY2UoMCwgbS5jb250ZW50Lmxlbmd0aCAtIHJlbWFpbmluZ0NoYXJzVG9UcmltIC0gJy4uLicubGVuZ3RoKS50cmltKCkgKyAnLi4uJ1xuXHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZW1haW5pbmdDaGFyc1RvVHJpbSAtPSBudW1DaGFyc1dpbGxUcmltXG5cdFx0bS5jb250ZW50ID0gbS5jb250ZW50LnN1YnN0cmluZygwLCBUUklNX1RPX0xFTiAtICcuLi4nLmxlbmd0aCkgKyAnLi4uJ1xuXHRcdGFscmVhZHlUcmltbWVkSWR4ZXMuYWRkKHRyaW1JZHgpXG5cdH1cblxuXHQvLyA9PT09PT09PT09PT09PT09IHN5c3RlbSBtZXNzYWdlIGhhY2sgPT09PT09PT09PT09PT09PVxuXHRjb25zdCBuZXdTeXNNc2cgPSBtZXNzYWdlcy5zaGlmdCgpIS5jb250ZW50XG5cblxuXHQvLyA9PT09PT09PT09PT09PT09IHRvb2xzIGFuZCBhbnRocm9waWNSZWFzb25pbmcgPT09PT09PT09PT09PT09PVxuXHQvLyBTWVNURU0gTUVTU0FHRSBIQUNLOiB3ZSBzaGlmdGVkIChyZW1vdmVkKSB0aGUgc3lzdGVtIG1lc3NhZ2Ugcm9sZSwgc28gbm93IFNpbXBsZUxMTU1lc3NhZ2VbXSBpcyB2YWxpZFxuXG5cdGxldCBsbG1DaGF0TWVzc2FnZXM6IEFudGhyb3BpY09yT3BlbkFJTExNTWVzc2FnZVtdID0gW11cblx0aWYgKCFzcGVjaWFsVG9vbEZvcm1hdCkgeyAvLyBYTUwgdG9vbCBiZWhhdmlvclxuXHRcdGxsbUNoYXRNZXNzYWdlcyA9IHByZXBhcmVNZXNzYWdlc19YTUxfdG9vbHMobWVzc2FnZXMgYXMgU2ltcGxlTExNTWVzc2FnZVtdLCBzdXBwb3J0c0FudGhyb3BpY1JlYXNvbmluZylcblx0fVxuXHRlbHNlIGlmIChzcGVjaWFsVG9vbEZvcm1hdCA9PT0gJ2FudGhyb3BpYy1zdHlsZScpIHtcblx0XHRsbG1DaGF0TWVzc2FnZXMgPSBwcmVwYXJlTWVzc2FnZXNfYW50aHJvcGljX3Rvb2xzKG1lc3NhZ2VzIGFzIFNpbXBsZUxMTU1lc3NhZ2VbXSwgc3VwcG9ydHNBbnRocm9waWNSZWFzb25pbmcpXG5cdH1cblx0ZWxzZSBpZiAoc3BlY2lhbFRvb2xGb3JtYXQgPT09ICdvcGVuYWktc3R5bGUnKSB7XG5cdFx0bGxtQ2hhdE1lc3NhZ2VzID0gcHJlcGFyZU1lc3NhZ2VzX29wZW5haV90b29scyhtZXNzYWdlcyBhcyBTaW1wbGVMTE1NZXNzYWdlW10pXG5cdH1cblx0Y29uc3QgbGxtTWVzc2FnZXMgPSBsbG1DaGF0TWVzc2FnZXNcblxuXG5cdC8vID09PT09PT09PT09PT09PT0gc3lzdGVtIG1lc3NhZ2UgYWRkIGFzIGZpcnN0IGxsbU1lc3NhZ2UgPT09PT09PT09PT09PT09PVxuXG5cdGxldCBzZXBhcmF0ZVN5c3RlbU1lc3NhZ2VTdHI6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXG5cdC8vIGlmIHN1cHBvcnRzIHN5c3RlbSBtZXNzYWdlXG5cdGlmIChzdXBwb3J0c1N5c3RlbU1lc3NhZ2UpIHtcblx0XHRpZiAoc3VwcG9ydHNTeXN0ZW1NZXNzYWdlID09PSAnc2VwYXJhdGVkJylcblx0XHRcdHNlcGFyYXRlU3lzdGVtTWVzc2FnZVN0ciA9IG5ld1N5c01zZ1xuXHRcdGVsc2UgaWYgKHN1cHBvcnRzU3lzdGVtTWVzc2FnZSA9PT0gJ3N5c3RlbS1yb2xlJylcblx0XHRcdGxsbU1lc3NhZ2VzLnVuc2hpZnQoeyByb2xlOiAnc3lzdGVtJywgY29udGVudDogbmV3U3lzTXNnIH0pIC8vIGFkZCBuZXcgZmlyc3QgbWVzc2FnZVxuXHRcdGVsc2UgaWYgKHN1cHBvcnRzU3lzdGVtTWVzc2FnZSA9PT0gJ2RldmVsb3Blci1yb2xlJylcblx0XHRcdGxsbU1lc3NhZ2VzLnVuc2hpZnQoeyByb2xlOiAnZGV2ZWxvcGVyJywgY29udGVudDogbmV3U3lzTXNnIH0pIC8vIGFkZCBuZXcgZmlyc3QgbWVzc2FnZVxuXHR9XG5cdC8vIGlmIGRvZXMgbm90IHN1cHBvcnQgc3lzdGVtIG1lc3NhZ2Vcblx0ZWxzZSB7XG5cdFx0Y29uc3QgbmV3Rmlyc3RNZXNzYWdlID0ge1xuXHRcdFx0cm9sZTogJ3VzZXInLFxuXHRcdFx0Y29udGVudDogYDxTWVNURU1fTUVTU0FHRT5cXG4ke25ld1N5c01zZ31cXG48L1NZU1RFTV9NRVNTQUdFPlxcbiR7bGxtTWVzc2FnZXNbMF0uY29udGVudH1gXG5cdFx0fSBhcyBjb25zdFxuXHRcdGxsbU1lc3NhZ2VzLnNwbGljZSgwLCAxKSAvLyBkZWxldGUgZmlyc3QgbWVzc2FnZVxuXHRcdGxsbU1lc3NhZ2VzLnVuc2hpZnQobmV3Rmlyc3RNZXNzYWdlKSAvLyBhZGQgbmV3IGZpcnN0IG1lc3NhZ2Vcblx0fVxuXG5cblx0Ly8gPT09PT09PT09PT09PT09PSBubyBlbXB0eSBtZXNzYWdlID09PT09PT09PT09PT09PT1cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsbG1NZXNzYWdlcy5sZW5ndGg7IGkgKz0gMSkge1xuXHRcdGNvbnN0IGN1cnJNc2c6IEFudGhyb3BpY09yT3BlbkFJTExNTWVzc2FnZSA9IGxsbU1lc3NhZ2VzW2ldXG5cdFx0Y29uc3QgbmV4dE1zZzogQW50aHJvcGljT3JPcGVuQUlMTE1NZXNzYWdlIHwgdW5kZWZpbmVkID0gbGxtTWVzc2FnZXNbaSArIDFdXG5cblx0XHRpZiAoY3Vyck1zZy5yb2xlID09PSAndG9vbCcpIGNvbnRpbnVlXG5cblx0XHQvLyBpZiBjb250ZW50IGlzIGEgc3RyaW5nLCByZXBsYWNlIHN0cmluZyB3aXRoIGVtcHR5IG1zZ1xuXHRcdGlmICh0eXBlb2YgY3Vyck1zZy5jb250ZW50ID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y3Vyck1zZy5jb250ZW50ID0gY3Vyck1zZy5jb250ZW50IHx8IEVNUFRZX01FU1NBR0Vcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHQvLyBhbGxvd2VkIHRvIGJlIGVtcHR5IGlmIGhhcyBhIHRvb2wgaW4gaXQgb3IgZm9sbG93aW5nIGl0XG5cdFx0XHRpZiAoY3Vyck1zZy5jb250ZW50LmZpbmQoYyA9PiBjLnR5cGUgPT09ICd0b29sX3Jlc3VsdCcgfHwgYy50eXBlID09PSAndG9vbF91c2UnKSkge1xuXHRcdFx0XHRjdXJyTXNnLmNvbnRlbnQgPSBjdXJyTXNnLmNvbnRlbnQuZmlsdGVyKGMgPT4gIShjLnR5cGUgPT09ICd0ZXh0JyAmJiAhYy50ZXh0KSkgYXMgYW55XG5cdFx0XHRcdGNvbnRpbnVlXG5cdFx0XHR9XG5cdFx0XHRpZiAobmV4dE1zZz8ucm9sZSA9PT0gJ3Rvb2wnKSBjb250aW51ZVxuXG5cdFx0XHQvLyByZXBsYWNlIGFueSBlbXB0eSB0ZXh0IGVudHJpZXMgd2l0aCBlbXB0eSBtc2csIGFuZCBtYWtlIHN1cmUgdGhlcmUncyBhdCBsZWFzdCAxIGVudHJ5XG5cdFx0XHRmb3IgKGNvbnN0IGMgb2YgY3Vyck1zZy5jb250ZW50KSB7XG5cdFx0XHRcdGlmIChjLnR5cGUgPT09ICd0ZXh0JykgYy50ZXh0ID0gYy50ZXh0IHx8IEVNUFRZX01FU1NBR0Vcblx0XHRcdH1cblx0XHRcdGlmIChjdXJyTXNnLmNvbnRlbnQubGVuZ3RoID09PSAwKSBjdXJyTXNnLmNvbnRlbnQgPSBbeyB0eXBlOiAndGV4dCcsIHRleHQ6IEVNUFRZX01FU1NBR0UgfV1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdG1lc3NhZ2VzOiBsbG1NZXNzYWdlcyxcblx0XHRzZXBhcmF0ZVN5c3RlbU1lc3NhZ2U6IHNlcGFyYXRlU3lzdGVtTWVzc2FnZVN0cixcblx0fSBhcyBjb25zdFxufVxuXG5cblxuXG50eXBlIEdlbWluaVVzZXJQYXJ0ID0gKEdlbWluaUxMTUNoYXRNZXNzYWdlICYgeyByb2xlOiAndXNlcicgfSlbJ3BhcnRzJ11bMF1cbnR5cGUgR2VtaW5pTW9kZWxQYXJ0ID0gKEdlbWluaUxMTUNoYXRNZXNzYWdlICYgeyByb2xlOiAnbW9kZWwnIH0pWydwYXJ0cyddWzBdXG5jb25zdCBwcmVwYXJlR2VtaW5pTWVzc2FnZXMgPSAobWVzc2FnZXM6IEFudGhyb3BpY0xMTUNoYXRNZXNzYWdlW10pID0+IHtcblx0bGV0IGxhdGVzdFRvb2xOYW1lOiBUb29sTmFtZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXHRjb25zdCBtZXNzYWdlczI6IEdlbWluaUxMTUNoYXRNZXNzYWdlW10gPSBtZXNzYWdlcy5tYXAoKG0pOiBHZW1pbmlMTE1DaGF0TWVzc2FnZSB8IG51bGwgPT4ge1xuXHRcdGlmIChtLnJvbGUgPT09ICdhc3Npc3RhbnQnKSB7XG5cdFx0XHRpZiAodHlwZW9mIG0uY29udGVudCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0cmV0dXJuIHsgcm9sZTogJ21vZGVsJywgcGFydHM6IFt7IHRleHQ6IG0uY29udGVudCB9XSB9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc3QgcGFydHM6IEdlbWluaU1vZGVsUGFydFtdID0gbS5jb250ZW50Lm1hcCgoYyk6IEdlbWluaU1vZGVsUGFydCB8IG51bGwgPT4ge1xuXHRcdFx0XHRcdGlmIChjLnR5cGUgPT09ICd0ZXh0Jykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHsgdGV4dDogYy50ZXh0IH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSBpZiAoYy50eXBlID09PSAndG9vbF91c2UnKSB7XG5cdFx0XHRcdFx0XHRsYXRlc3RUb29sTmFtZSA9IGMubmFtZVxuXHRcdFx0XHRcdFx0cmV0dXJuIHsgZnVuY3Rpb25DYWxsOiB7IGlkOiBjLmlkLCBuYW1lOiBjLm5hbWUsIGFyZ3M6IGMuaW5wdXQgfSB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgcmV0dXJuIG51bGxcblx0XHRcdFx0fSkuZmlsdGVyKG0gPT4gISFtKVxuXHRcdFx0XHRyZXR1cm4geyByb2xlOiAnbW9kZWwnLCBwYXJ0cywgfVxuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIGlmIChtLnJvbGUgPT09ICd1c2VyJykge1xuXHRcdFx0aWYgKHR5cGVvZiBtLmNvbnRlbnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHJldHVybiB7IHJvbGU6ICd1c2VyJywgcGFydHM6IFt7IHRleHQ6IG0uY29udGVudCB9XSB9IHNhdGlzZmllcyBHZW1pbmlMTE1DaGF0TWVzc2FnZVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHBhcnRzOiBHZW1pbmlVc2VyUGFydFtdID0gbS5jb250ZW50Lm1hcCgoYyk6IEdlbWluaVVzZXJQYXJ0IHwgbnVsbCA9PiB7XG5cdFx0XHRcdFx0aWYgKGMudHlwZSA9PT0gJ3RleHQnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4geyB0ZXh0OiBjLnRleHQgfVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChjLnR5cGUgPT09ICd0b29sX3Jlc3VsdCcpIHtcblx0XHRcdFx0XHRcdGlmICghbGF0ZXN0VG9vbE5hbWUpIHJldHVybiBudWxsXG5cdFx0XHRcdFx0XHRyZXR1cm4geyBmdW5jdGlvblJlc3BvbnNlOiB7IGlkOiBjLnRvb2xfdXNlX2lkLCBuYW1lOiBsYXRlc3RUb29sTmFtZSwgcmVzcG9uc2U6IHsgb3V0cHV0OiBjLmNvbnRlbnQgfSB9IH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSByZXR1cm4gbnVsbFxuXHRcdFx0XHR9KS5maWx0ZXIobSA9PiAhIW0pXG5cdFx0XHRcdHJldHVybiB7IHJvbGU6ICd1c2VyJywgcGFydHMsIH1cblx0XHRcdH1cblxuXHRcdH1cblx0XHRlbHNlIHJldHVybiBudWxsXG5cdH0pLmZpbHRlcihtID0+ICEhbSlcblxuXHRyZXR1cm4gbWVzc2FnZXMyXG59XG5cblxuY29uc3QgcHJlcGFyZU1lc3NhZ2VzID0gKHBhcmFtczoge1xuXHRtZXNzYWdlczogU2ltcGxlTExNTWVzc2FnZVtdLFxuXHRzeXN0ZW1NZXNzYWdlOiBzdHJpbmcsXG5cdGFpSW5zdHJ1Y3Rpb25zOiBzdHJpbmcsXG5cdHN1cHBvcnRzU3lzdGVtTWVzc2FnZTogZmFsc2UgfCAnc3lzdGVtLXJvbGUnIHwgJ2RldmVsb3Blci1yb2xlJyB8ICdzZXBhcmF0ZWQnLFxuXHRzcGVjaWFsVG9vbEZvcm1hdDogJ29wZW5haS1zdHlsZScgfCAnYW50aHJvcGljLXN0eWxlJyB8ICdnZW1pbmktc3R5bGUnIHwgdW5kZWZpbmVkLFxuXHRzdXBwb3J0c0FudGhyb3BpY1JlYXNvbmluZzogYm9vbGVhbixcblx0Y29udGV4dFdpbmRvdzogbnVtYmVyLFxuXHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2U6IG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQsXG5cdHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lXG59KTogeyBtZXNzYWdlczogTExNQ2hhdE1lc3NhZ2VbXSwgc2VwYXJhdGVTeXN0ZW1NZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQgfSA9PiB7XG5cblx0Y29uc3Qgc3BlY2lhbEZvcm1hdCA9IHBhcmFtcy5zcGVjaWFsVG9vbEZvcm1hdCAvLyB0aGlzIGlzIGp1c3QgZm9yIHRzIHN0dXBpZG5lc3NcblxuXHQvLyBpZiBuZWVkIHRvIGNvbnZlcnQgdG8gZ2VtaW5pIHN0eWxlIG9mIG1lc3NhZXMsIGRvIHRoYXQgKHRyZWF0IGFzIGFudGhyb3BpYyBzdHlsZSwgdGhlbiBjb252ZXJ0IHRvIGdlbWluaSBzdHlsZSlcblx0aWYgKHBhcmFtcy5wcm92aWRlck5hbWUgPT09ICdnZW1pbmknIHx8IHBhcmFtcy5wcm92aWRlck5hbWUgPT09ICdnb29nbGVWZXJ0ZXgnIHx8IHNwZWNpYWxGb3JtYXQgPT09ICdnZW1pbmktc3R5bGUnKSB7XG5cdFx0Y29uc3QgcmVzID0gcHJlcGFyZU9wZW5BSU9yQW50aHJvcGljTWVzc2FnZXMoeyAuLi5wYXJhbXMsIHNwZWNpYWxUb29sRm9ybWF0OiBzcGVjaWFsRm9ybWF0ID09PSAnZ2VtaW5pLXN0eWxlJyA/ICdhbnRocm9waWMtc3R5bGUnIDogdW5kZWZpbmVkIH0pXG5cdFx0Y29uc3QgbWVzc2FnZXMgPSByZXMubWVzc2FnZXMgYXMgQW50aHJvcGljTExNQ2hhdE1lc3NhZ2VbXVxuXHRcdGNvbnN0IG1lc3NhZ2VzMiA9IHByZXBhcmVHZW1pbmlNZXNzYWdlcyhtZXNzYWdlcylcblx0XHRyZXR1cm4geyBtZXNzYWdlczogbWVzc2FnZXMyLCBzZXBhcmF0ZVN5c3RlbU1lc3NhZ2U6IHJlcy5zZXBhcmF0ZVN5c3RlbU1lc3NhZ2UgfVxuXHR9XG5cblx0cmV0dXJuIHByZXBhcmVPcGVuQUlPckFudGhyb3BpY01lc3NhZ2VzKHsgLi4ucGFyYW1zLCBzcGVjaWFsVG9vbEZvcm1hdDogc3BlY2lhbEZvcm1hdCB9KVxufVxuXG5cblxuXG5leHBvcnQgaW50ZXJmYWNlIElDb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cHJlcGFyZUxMTVNpbXBsZU1lc3NhZ2VzOiAob3B0czogeyBzaW1wbGVNZXNzYWdlczogU2ltcGxlTExNTWVzc2FnZVtdLCBzeXN0ZW1NZXNzYWdlOiBzdHJpbmcsIG1vZGVsU2VsZWN0aW9uOiBNb2RlbFNlbGVjdGlvbiB8IG51bGwsIGZlYXR1cmVOYW1lOiBGZWF0dXJlTmFtZSB9KSA9PiB7IG1lc3NhZ2VzOiBMTE1DaGF0TWVzc2FnZVtdLCBzZXBhcmF0ZVN5c3RlbU1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZCB9XG5cdHByZXBhcmVMTE1DaGF0TWVzc2FnZXM6IChvcHRzOiB7IGNoYXRNZXNzYWdlczogQ2hhdE1lc3NhZ2VbXSwgY2hhdE1vZGU6IENoYXRNb2RlLCBtb2RlbFNlbGVjdGlvbjogTW9kZWxTZWxlY3Rpb24gfCBudWxsIH0pID0+IFByb21pc2U8eyBtZXNzYWdlczogTExNQ2hhdE1lc3NhZ2VbXSwgc2VwYXJhdGVTeXN0ZW1NZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQgfT5cblx0cHJlcGFyZUZJTU1lc3NhZ2Uob3B0czogeyBtZXNzYWdlczogTExNRklNTWVzc2FnZSwgfSk6IHsgcHJlZml4OiBzdHJpbmcsIHN1ZmZpeDogc3RyaW5nLCBzdG9wVG9rZW5zOiBzdHJpbmdbXSB9XG59XG5cbmV4cG9ydCBjb25zdCBJQ29udmVydFRvTExNTWVzc2FnZVNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUNvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlPignQ29udmVydFRvTExNTWVzc2FnZVNlcnZpY2UnKTtcblxuXG5jbGFzcyBDb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ29udmVydFRvTExNTWVzc2FnZVNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElEaXJlY3RvcnlTdHJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlyZWN0b3J5U3RyU2VydmljZTogSURpcmVjdG9yeVN0clNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFRvb2xTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVybWluYWxUb29sU2VydmljZTogSVRlcm1pbmFsVG9vbFNlcnZpY2UsXG5cdFx0QElWb2lkU2V0dGluZ3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdm9pZFNldHRpbmdzU2VydmljZTogSVZvaWRTZXR0aW5nc1NlcnZpY2UsXG5cdFx0QElWb2lkTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdm9pZE1vZGVsU2VydmljZTogSVZvaWRNb2RlbFNlcnZpY2UsXG5cdFx0QElNQ1BTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWNwU2VydmljZTogSU1DUFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKClcblx0fVxuXG5cdC8vIFJlYWQgLnZvaWRydWxlcyBmaWxlcyBmcm9tIHdvcmtzcGFjZSBmb2xkZXJzXG5cdHByaXZhdGUgX2dldFZvaWRSdWxlc0ZpbGVDb250ZW50cygpOiBzdHJpbmcge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXJzID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdFx0bGV0IHZvaWRSdWxlcyA9ICcnO1xuXHRcdFx0Zm9yIChjb25zdCBmb2xkZXIgb2Ygd29ya3NwYWNlRm9sZGVycykge1xuXHRcdFx0XHRjb25zdCB1cmkgPSBVUkkuam9pblBhdGgoZm9sZGVyLnVyaSwgJy52b2lkcnVsZXMnKVxuXHRcdFx0XHRjb25zdCB7IG1vZGVsIH0gPSB0aGlzLnZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWwodXJpKVxuXHRcdFx0XHRpZiAoIW1vZGVsKSBjb250aW51ZVxuXHRcdFx0XHR2b2lkUnVsZXMgKz0gbW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRikgKyAnXFxuXFxuJztcblx0XHRcdH1cblx0XHRcdHJldHVybiB2b2lkUnVsZXMudHJpbSgpO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuICcnXG5cdFx0fVxuXHR9XG5cblx0Ly8gR2V0IGNvbWJpbmVkIEFJIGluc3RydWN0aW9ucyBmcm9tIHNldHRpbmdzIGFuZCAudm9pZHJ1bGVzIGZpbGVzXG5cdHByaXZhdGUgX2dldENvbWJpbmVkQUlJbnN0cnVjdGlvbnMoKTogc3RyaW5nIHtcblx0XHRjb25zdCBnbG9iYWxBSUluc3RydWN0aW9ucyA9IHRoaXMudm9pZFNldHRpbmdzU2VydmljZS5zdGF0ZS5nbG9iYWxTZXR0aW5ncy5haUluc3RydWN0aW9ucztcblx0XHRjb25zdCB2b2lkUnVsZXNGaWxlQ29udGVudCA9IHRoaXMuX2dldFZvaWRSdWxlc0ZpbGVDb250ZW50cygpO1xuXG5cdFx0Y29uc3QgYW5zOiBzdHJpbmdbXSA9IFtdXG5cdFx0aWYgKGdsb2JhbEFJSW5zdHJ1Y3Rpb25zKSBhbnMucHVzaChnbG9iYWxBSUluc3RydWN0aW9ucylcblx0XHRpZiAodm9pZFJ1bGVzRmlsZUNvbnRlbnQpIGFucy5wdXNoKHZvaWRSdWxlc0ZpbGVDb250ZW50KVxuXHRcdHJldHVybiBhbnMuam9pbignXFxuXFxuJylcblx0fVxuXG5cblx0Ly8gc3lzdGVtIG1lc3NhZ2Vcblx0cHJpdmF0ZSBfZ2VuZXJhdGVDaGF0TWVzc2FnZXNTeXN0ZW1NZXNzYWdlID0gYXN5bmMgKGNoYXRNb2RlOiBDaGF0TW9kZSwgc3BlY2lhbFRvb2xGb3JtYXQ6ICdvcGVuYWktc3R5bGUnIHwgJ2FudGhyb3BpYy1zdHlsZScgfCAnZ2VtaW5pLXN0eWxlJyB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlcnMgPSB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubWFwKGYgPT4gZi51cmkuZnNQYXRoKVxuXG5cdFx0Y29uc3Qgb3BlbmVkVVJJcyA9IHRoaXMubW9kZWxTZXJ2aWNlLmdldE1vZGVscygpLmZpbHRlcihtID0+IG0uaXNBdHRhY2hlZFRvRWRpdG9yKCkpLm1hcChtID0+IG0udXJpLmZzUGF0aCkgfHwgW107XG5cdFx0Y29uc3QgYWN0aXZlVVJJID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcj8ucmVzb3VyY2U/LmZzUGF0aDtcblxuXHRcdGNvbnN0IGRpcmVjdG9yeVN0ciA9IGF3YWl0IHRoaXMuZGlyZWN0b3J5U3RyU2VydmljZS5nZXRBbGxEaXJlY3Rvcmllc1N0cih7XG5cdFx0XHRjdXRPZmZNZXNzYWdlOiBjaGF0TW9kZSA9PT0gJ2FnZW50JyB8fCBjaGF0TW9kZSA9PT0gJ2dhdGhlcicgP1xuXHRcdFx0XHRgLi4uRGlyZWN0b3JpZXMgc3RyaW5nIGN1dCBvZmYsIHVzZSB0b29scyB0byByZWFkIG1vcmUuLi5gXG5cdFx0XHRcdDogYC4uLkRpcmVjdG9yaWVzIHN0cmluZyBjdXQgb2ZmLCBhc2sgdXNlciBmb3IgbW9yZSBpZiBuZWNlc3NhcnkuLi5gXG5cdFx0fSlcblxuXHRcdGNvbnN0IGluY2x1ZGVYTUxUb29sRGVmaW5pdGlvbnMgPSAhc3BlY2lhbFRvb2xGb3JtYXRcblxuXHRcdGNvbnN0IG1jcFRvb2xzID0gdGhpcy5tY3BTZXJ2aWNlLmdldE1DUFRvb2xzKClcblxuXHRcdGNvbnN0IHBlcnNpc3RlbnRUZXJtaW5hbElEcyA9IHRoaXMudGVybWluYWxUb29sU2VydmljZS5saXN0UGVyc2lzdGVudFRlcm1pbmFsSWRzKClcblx0XHRjb25zdCBzeXN0ZW1NZXNzYWdlID0gY2hhdF9zeXN0ZW1NZXNzYWdlKHsgd29ya3NwYWNlRm9sZGVycywgb3BlbmVkVVJJcywgZGlyZWN0b3J5U3RyLCBhY3RpdmVVUkksIHBlcnNpc3RlbnRUZXJtaW5hbElEcywgY2hhdE1vZGUsIG1jcFRvb2xzLCBpbmNsdWRlWE1MVG9vbERlZmluaXRpb25zIH0pXG5cdFx0cmV0dXJuIHN5c3RlbU1lc3NhZ2Vcblx0fVxuXG5cblxuXG5cdC8vIC0tLSBMTE0gQ2hhdCBtZXNzYWdlcyAtLS1cblxuXHRwcml2YXRlIF9jaGF0TWVzc2FnZXNUb1NpbXBsZU1lc3NhZ2VzKGNoYXRNZXNzYWdlczogQ2hhdE1lc3NhZ2VbXSk6IFNpbXBsZUxMTU1lc3NhZ2VbXSB7XG5cdFx0Y29uc3Qgc2ltcGxlTExNTWVzc2FnZXM6IFNpbXBsZUxMTU1lc3NhZ2VbXSA9IFtdXG5cblx0XHRmb3IgKGNvbnN0IG0gb2YgY2hhdE1lc3NhZ2VzKSB7XG5cdFx0XHRpZiAobS5yb2xlID09PSAnY2hlY2twb2ludCcpIGNvbnRpbnVlXG5cdFx0XHRpZiAobS5yb2xlID09PSAnaW50ZXJydXB0ZWRfc3RyZWFtaW5nX3Rvb2wnKSBjb250aW51ZVxuXHRcdFx0aWYgKG0ucm9sZSA9PT0gJ2Fzc2lzdGFudCcpIHtcblx0XHRcdFx0c2ltcGxlTExNTWVzc2FnZXMucHVzaCh7XG5cdFx0XHRcdFx0cm9sZTogbS5yb2xlLFxuXHRcdFx0XHRcdGNvbnRlbnQ6IG0uZGlzcGxheUNvbnRlbnQsXG5cdFx0XHRcdFx0YW50aHJvcGljUmVhc29uaW5nOiBtLmFudGhyb3BpY1JlYXNvbmluZyxcblx0XHRcdFx0fSlcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKG0ucm9sZSA9PT0gJ3Rvb2wnKSB7XG5cdFx0XHRcdHNpbXBsZUxMTU1lc3NhZ2VzLnB1c2goe1xuXHRcdFx0XHRcdHJvbGU6IG0ucm9sZSxcblx0XHRcdFx0XHRjb250ZW50OiBtLmNvbnRlbnQsXG5cdFx0XHRcdFx0bmFtZTogbS5uYW1lLFxuXHRcdFx0XHRcdGlkOiBtLmlkLFxuXHRcdFx0XHRcdHJhd1BhcmFtczogbS5yYXdQYXJhbXMsXG5cdFx0XHRcdH0pXG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChtLnJvbGUgPT09ICd1c2VyJykge1xuXHRcdFx0XHRzaW1wbGVMTE1NZXNzYWdlcy5wdXNoKHtcblx0XHRcdFx0XHRyb2xlOiBtLnJvbGUsXG5cdFx0XHRcdFx0Y29udGVudDogbS5jb250ZW50LFxuXHRcdFx0XHR9KVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gc2ltcGxlTExNTWVzc2FnZXNcblx0fVxuXG5cdHByZXBhcmVMTE1TaW1wbGVNZXNzYWdlczogSUNvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlWydwcmVwYXJlTExNU2ltcGxlTWVzc2FnZXMnXSA9ICh7IHNpbXBsZU1lc3NhZ2VzLCBzeXN0ZW1NZXNzYWdlLCBtb2RlbFNlbGVjdGlvbiwgZmVhdHVyZU5hbWUgfSkgPT4ge1xuXHRcdGlmIChtb2RlbFNlbGVjdGlvbiA9PT0gbnVsbCkgcmV0dXJuIHsgbWVzc2FnZXM6IFtdLCBzZXBhcmF0ZVN5c3RlbU1lc3NhZ2U6IHVuZGVmaW5lZCB9XG5cblx0XHRjb25zdCB7IG92ZXJyaWRlc09mTW9kZWwgfSA9IHRoaXMudm9pZFNldHRpbmdzU2VydmljZS5zdGF0ZVxuXG5cdFx0Y29uc3QgeyBwcm92aWRlck5hbWUsIG1vZGVsTmFtZSB9ID0gbW9kZWxTZWxlY3Rpb25cblx0XHRjb25zdCB7XG5cdFx0XHRzcGVjaWFsVG9vbEZvcm1hdCxcblx0XHRcdGNvbnRleHRXaW5kb3csXG5cdFx0XHRzdXBwb3J0c1N5c3RlbU1lc3NhZ2UsXG5cdFx0fSA9IGdldE1vZGVsQ2FwYWJpbGl0aWVzKHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lLCBvdmVycmlkZXNPZk1vZGVsKVxuXG5cdFx0Y29uc3QgbW9kZWxTZWxlY3Rpb25PcHRpb25zID0gdGhpcy52b2lkU2V0dGluZ3NTZXJ2aWNlLnN0YXRlLm9wdGlvbnNPZk1vZGVsU2VsZWN0aW9uW2ZlYXR1cmVOYW1lXVttb2RlbFNlbGVjdGlvbi5wcm92aWRlck5hbWVdPy5bbW9kZWxTZWxlY3Rpb24ubW9kZWxOYW1lXVxuXG5cdFx0Ly8gR2V0IGNvbWJpbmVkIEFJIGluc3RydWN0aW9uc1xuXHRcdGNvbnN0IGFpSW5zdHJ1Y3Rpb25zID0gdGhpcy5fZ2V0Q29tYmluZWRBSUluc3RydWN0aW9ucygpO1xuXG5cdFx0Y29uc3QgaXNSZWFzb25pbmdFbmFibGVkID0gZ2V0SXNSZWFzb25pbmdFbmFibGVkU3RhdGUoZmVhdHVyZU5hbWUsIHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lLCBtb2RlbFNlbGVjdGlvbk9wdGlvbnMsIG92ZXJyaWRlc09mTW9kZWwpXG5cdFx0Y29uc3QgcmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlID0gZ2V0UmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlKHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lLCB7IGlzUmVhc29uaW5nRW5hYmxlZCwgb3ZlcnJpZGVzT2ZNb2RlbCB9KVxuXG5cdFx0Y29uc3QgeyBtZXNzYWdlcywgc2VwYXJhdGVTeXN0ZW1NZXNzYWdlIH0gPSBwcmVwYXJlTWVzc2FnZXMoe1xuXHRcdFx0bWVzc2FnZXM6IHNpbXBsZU1lc3NhZ2VzLFxuXHRcdFx0c3lzdGVtTWVzc2FnZSxcblx0XHRcdGFpSW5zdHJ1Y3Rpb25zLFxuXHRcdFx0c3VwcG9ydHNTeXN0ZW1NZXNzYWdlLFxuXHRcdFx0c3BlY2lhbFRvb2xGb3JtYXQsXG5cdFx0XHRzdXBwb3J0c0FudGhyb3BpY1JlYXNvbmluZzogcHJvdmlkZXJOYW1lID09PSAnYW50aHJvcGljJyxcblx0XHRcdGNvbnRleHRXaW5kb3csXG5cdFx0XHRyZXNlcnZlZE91dHB1dFRva2VuU3BhY2UsXG5cdFx0XHRwcm92aWRlck5hbWUsXG5cdFx0fSlcblx0XHRyZXR1cm4geyBtZXNzYWdlcywgc2VwYXJhdGVTeXN0ZW1NZXNzYWdlIH07XG5cdH1cblx0cHJlcGFyZUxMTUNoYXRNZXNzYWdlczogSUNvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlWydwcmVwYXJlTExNQ2hhdE1lc3NhZ2VzJ10gPSBhc3luYyAoeyBjaGF0TWVzc2FnZXMsIGNoYXRNb2RlLCBtb2RlbFNlbGVjdGlvbiB9KSA9PiB7XG5cdFx0aWYgKG1vZGVsU2VsZWN0aW9uID09PSBudWxsKSByZXR1cm4geyBtZXNzYWdlczogW10sIHNlcGFyYXRlU3lzdGVtTWVzc2FnZTogdW5kZWZpbmVkIH1cblxuXHRcdGNvbnN0IHsgb3ZlcnJpZGVzT2ZNb2RlbCB9ID0gdGhpcy52b2lkU2V0dGluZ3NTZXJ2aWNlLnN0YXRlXG5cblx0XHRjb25zdCB7IHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lIH0gPSBtb2RlbFNlbGVjdGlvblxuXHRcdGNvbnN0IHtcblx0XHRcdHNwZWNpYWxUb29sRm9ybWF0LFxuXHRcdFx0Y29udGV4dFdpbmRvdyxcblx0XHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZSxcblx0XHR9ID0gZ2V0TW9kZWxDYXBhYmlsaXRpZXMocHJvdmlkZXJOYW1lLCBtb2RlbE5hbWUsIG92ZXJyaWRlc09mTW9kZWwpXG5cblx0XHRjb25zdCB7IGRpc2FibGVTeXN0ZW1NZXNzYWdlIH0gPSB0aGlzLnZvaWRTZXR0aW5nc1NlcnZpY2Uuc3RhdGUuZ2xvYmFsU2V0dGluZ3M7XG5cdFx0Y29uc3QgZnVsbFN5c3RlbU1lc3NhZ2UgPSBhd2FpdCB0aGlzLl9nZW5lcmF0ZUNoYXRNZXNzYWdlc1N5c3RlbU1lc3NhZ2UoY2hhdE1vZGUsIHNwZWNpYWxUb29sRm9ybWF0KVxuXHRcdGNvbnN0IHN5c3RlbU1lc3NhZ2UgPSBkaXNhYmxlU3lzdGVtTWVzc2FnZSA/ICcnIDogZnVsbFN5c3RlbU1lc3NhZ2U7XG5cblx0XHRjb25zdCBtb2RlbFNlbGVjdGlvbk9wdGlvbnMgPSB0aGlzLnZvaWRTZXR0aW5nc1NlcnZpY2Uuc3RhdGUub3B0aW9uc09mTW9kZWxTZWxlY3Rpb25bJ0NoYXQnXVttb2RlbFNlbGVjdGlvbi5wcm92aWRlck5hbWVdPy5bbW9kZWxTZWxlY3Rpb24ubW9kZWxOYW1lXVxuXG5cdFx0Ly8gR2V0IGNvbWJpbmVkIEFJIGluc3RydWN0aW9uc1xuXHRcdGNvbnN0IGFpSW5zdHJ1Y3Rpb25zID0gdGhpcy5fZ2V0Q29tYmluZWRBSUluc3RydWN0aW9ucygpO1xuXHRcdGNvbnN0IGlzUmVhc29uaW5nRW5hYmxlZCA9IGdldElzUmVhc29uaW5nRW5hYmxlZFN0YXRlKCdDaGF0JywgcHJvdmlkZXJOYW1lLCBtb2RlbE5hbWUsIG1vZGVsU2VsZWN0aW9uT3B0aW9ucywgb3ZlcnJpZGVzT2ZNb2RlbClcblx0XHRjb25zdCByZXNlcnZlZE91dHB1dFRva2VuU3BhY2UgPSBnZXRSZXNlcnZlZE91dHB1dFRva2VuU3BhY2UocHJvdmlkZXJOYW1lLCBtb2RlbE5hbWUsIHsgaXNSZWFzb25pbmdFbmFibGVkLCBvdmVycmlkZXNPZk1vZGVsIH0pXG5cdFx0Y29uc3QgbGxtTWVzc2FnZXMgPSB0aGlzLl9jaGF0TWVzc2FnZXNUb1NpbXBsZU1lc3NhZ2VzKGNoYXRNZXNzYWdlcylcblxuXHRcdGNvbnN0IHsgbWVzc2FnZXMsIHNlcGFyYXRlU3lzdGVtTWVzc2FnZSB9ID0gcHJlcGFyZU1lc3NhZ2VzKHtcblx0XHRcdG1lc3NhZ2VzOiBsbG1NZXNzYWdlcyxcblx0XHRcdHN5c3RlbU1lc3NhZ2UsXG5cdFx0XHRhaUluc3RydWN0aW9ucyxcblx0XHRcdHN1cHBvcnRzU3lzdGVtTWVzc2FnZSxcblx0XHRcdHNwZWNpYWxUb29sRm9ybWF0LFxuXHRcdFx0c3VwcG9ydHNBbnRocm9waWNSZWFzb25pbmc6IHByb3ZpZGVyTmFtZSA9PT0gJ2FudGhyb3BpYycsXG5cdFx0XHRjb250ZXh0V2luZG93LFxuXHRcdFx0cmVzZXJ2ZWRPdXRwdXRUb2tlblNwYWNlLFxuXHRcdFx0cHJvdmlkZXJOYW1lLFxuXHRcdH0pXG5cdFx0cmV0dXJuIHsgbWVzc2FnZXMsIHNlcGFyYXRlU3lzdGVtTWVzc2FnZSB9O1xuXHR9XG5cblxuXHQvLyAtLS0gRklNIC0tLVxuXG5cdHByZXBhcmVGSU1NZXNzYWdlOiBJQ29udmVydFRvTExNTWVzc2FnZVNlcnZpY2VbJ3ByZXBhcmVGSU1NZXNzYWdlJ10gPSAoeyBtZXNzYWdlcyB9KSA9PiB7XG5cdFx0Ly8gR2V0IGNvbWJpbmVkIEFJIGluc3RydWN0aW9ucyB3aXRoIHRoZSBwcm92aWRlZCBhaUluc3RydWN0aW9ucyBhcyB0aGUgYmFzZVxuXHRcdGNvbnN0IGNvbWJpbmVkSW5zdHJ1Y3Rpb25zID0gdGhpcy5fZ2V0Q29tYmluZWRBSUluc3RydWN0aW9ucygpO1xuXG5cdFx0bGV0IHByZWZpeCA9IGBcXFxuJHshY29tYmluZWRJbnN0cnVjdGlvbnMgPyAnJyA6IGBcXFxuLy8gSW5zdHJ1Y3Rpb25zOlxuLy8gRG8gbm90IG91dHB1dCBhbiBleHBsYW5hdGlvbi4gVHJ5IHRvIGF2b2lkIG91dHB1dHRpbmcgY29tbWVudHMuIE9ubHkgb3V0cHV0IHRoZSBtaWRkbGUgY29kZS5cbiR7Y29tYmluZWRJbnN0cnVjdGlvbnMuc3BsaXQoJ1xcbicpLm1hcChsaW5lID0+IGAvLyR7bGluZX1gKS5qb2luKCdcXG4nKX1gfVxuXG4ke21lc3NhZ2VzLnByZWZpeH1gXG5cblx0XHRjb25zdCBzdWZmaXggPSBtZXNzYWdlcy5zdWZmaXhcblx0XHRjb25zdCBzdG9wVG9rZW5zID0gbWVzc2FnZXMuc3RvcFRva2Vuc1xuXHRcdHJldHVybiB7IHByZWZpeCwgc3VmZml4LCBzdG9wVG9rZW5zIH1cblx0fVxuXG5cbn1cblxuXG5yZWdpc3RlclNpbmdsZXRvbihJQ29udmVydFRvTExNTWVzc2FnZVNlcnZpY2UsIENvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5cblxuXG5cblxuXG5cblxuLypcbkdlbWluaSBoYXMgdGhpcywgYnV0IHRoZXkncmUgb3BlbmFpLWNvbXBhdCBzbyB3ZSBkb24ndCBuZWVkIHRvIGltcGxlbWVudCB0aGlzXG5nZW1pbmkgcmVxdWVzdDpcbnsgICBcInJvbGVcIjogXCJhc3Npc3RhbnRcIixcblx0XCJjb250ZW50XCI6IG51bGwsXG5cdFwiZnVuY3Rpb25fY2FsbFwiOiB7XG5cdFx0XCJuYW1lXCI6IFwiZ2V0X3dlYXRoZXJcIixcblx0XHRcImFyZ3VtZW50c1wiOiB7XG5cdFx0XHRcImxhdGl0dWRlXCI6IDQ4Ljg1NjYsXG5cdFx0XHRcImxvbmdpdHVkZVwiOiAyLjM1MjJcblx0XHR9XG5cdH1cbn1cblxuZ2VtaW5pIHJlc3BvbnNlOlxueyAgIFwicm9sZVwiOiBcImFzc2lzdGFudFwiLFxuXHRcImZ1bmN0aW9uX3Jlc3BvbnNlXCI6IHtcblx0XHRcIm5hbWVcIjogXCJnZXRfd2VhdGhlclwiLFxuXHRcdFx0XCJyZXNwb25zZVwiOiB7XG5cdFx0XHRcInRlbXBlcmF0dXJlXCI6IFwiMTVcdTAwQjBDXCIsXG5cdFx0XHRcdFwiY29uZGl0aW9uXCI6IFwiQ2xvdWR5XCJcblx0XHR9XG5cdH1cbn1cbiovXG5cblxuXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUFBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLDRCQUE0Qiw2QkFBNkIsNEJBQTRCO0FB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LFNBQVMsR0FBRztBQUNwRCxZQUFJLENBQUMsTUFBTztBQUNaLHFCQUFhLE1BQU0sU0FBUyxvQkFBb0IsRUFBRSxJQUFJO0FBQUEsTUFDdkQ7QUFDQSxhQUFPLFVBQVUsS0FBSztBQUFBLElBQ3ZCLFNBQ08sR0FBRztBQUNULGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUFBO0FBQUEsRUFHUSw2QkFBcUM7QUFDNUMsVUFBTSx1QkFBdUIsS0FBSyxvQkFBb0IsTUFBTSxlQUFlO0FBQzNFLFVBQU0sdUJBQXVCLEtBQUssMEJBQTBCO0FBRTVELFVBQU0sTUFBZ0IsQ0FBQztBQUN2QixRQUFJLHFCQUFzQixLQUFJLEtBQUssb0JBQW9CO0FBQ3ZELFFBQUkscUJBQXNCLEtBQUksS0FBSyxvQkFBb0I7QUFDdkQsV0FBTyxJQUFJLEtBQUssTUFBTTtBQUFBLEVBQ3ZCO0FBQUE7QUFBQSxFQThCUSw4QkFBOEIsY0FBaUQ7QUFDdEYsVUFBTSxvQkFBd0MsQ0FBQztBQUUvQyxlQUFXLEtBQUssY0FBYztBQUM3QixVQUFJLEVBQUUsU0FBUyxhQUFjO0FBQzdCLFVBQUksRUFBRSxTQUFTLDZCQUE4QjtBQUM3QyxVQUFJLEVBQUUsU0FBUyxhQUFhO0FBQzNCLDBCQUFrQixLQUFLO0FBQUEsVUFDdEIsTUFBTSxFQUFFO0FBQUEsVUFDUixTQUFTLEVBQUU7QUFBQSxVQUNYLG9CQUFvQixFQUFFO0FBQUEsUUFDdkIsQ0FBQztBQUFBLE1BQ0YsV0FDUyxFQUFFLFNBQVMsUUFBUTtBQUMzQiwwQkFBa0IsS0FBSztBQUFBLFVBQ3RCLE1BQU0sRUFBRTtBQUFBLFVBQ1IsU0FBUyxFQUFFO0FBQUEsVUFDWCxNQUFNLEVBQUU7QUFBQSxVQUNSLElBQUksRUFBRTtBQUFBLFVBQ04sV0FBVyxFQUFFO0FBQUEsUUFDZCxDQUFDO0FBQUEsTUFDRixXQUNTLEVBQUUsU0FBUyxRQUFRO0FBQzNCLDBCQUFrQixLQUFLO0FBQUEsVUFDdEIsTUFBTSxFQUFFO0FBQUEsVUFDUixTQUFTLEVBQUU7QUFBQSxRQUNaLENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBOEZEO0FBck1NLDZCQUFOO0FBQUEsRUFJRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVhHO0FBd01OLGtCQUFrQiw2QkFBNkIsNEJBQTRCLGtCQUFrQixLQUFLOyIsCiAgIm5hbWVzIjogWyJtZXNzYWdlcyIsICJtZXNzYWdlc18iLCAiaSIsICJtIl0KfQo=
