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
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { EndOfLinePreference } from "../../../../editor/common/model.js";
import { Range } from "../../../../editor/common/core/range.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { EditorResourceAccessor } from "../../../common/editor.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { extractCodeFromRegular } from "../common/helpers/extractCodeFromResult.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { ILLMMessageService } from "../common/sendLLMMessageService.js";
import { isWindows } from "../../../../base/common/platform.js";
import { IVoidSettingsService } from "../common/voidSettingsService.js";
import { IConvertToLLMMessageService } from "./convertToLLMMessageService.js";
const allLinebreakSymbols = ["\r\n", "\n"];
const _ln = isWindows ? allLinebreakSymbols[0] : allLinebreakSymbols[1];
class LRUCache {
  constructor(maxSize, disposeCallback) {
    if (maxSize <= 0) throw new Error("Cache size must be greater than 0");
    this.items = /* @__PURE__ */ new Map();
    this.keyOrder = [];
    this.maxSize = maxSize;
    this.disposeCallback = disposeCallback;
  }
  set(key, value) {
    if (this.items.has(key)) {
      this.keyOrder = this.keyOrder.filter((k) => k !== key);
    } else if (this.items.size >= this.maxSize) {
      const key2 = this.keyOrder[0];
      const value2 = this.items.get(key2);
      if (this.disposeCallback && value2 !== void 0) {
        this.disposeCallback(value2, key2);
      }
      this.items.delete(key2);
      this.keyOrder.shift();
    }
    this.items.set(key, value);
    this.keyOrder.push(key);
  }
  delete(key) {
    const value = this.items.get(key);
    if (value !== void 0) {
      if (this.disposeCallback) {
        this.disposeCallback(value, key);
      }
      this.items.delete(key);
      this.keyOrder = this.keyOrder.filter((k) => k !== key);
      return true;
    }
    return false;
  }
  clear() {
    if (this.disposeCallback) {
      for (const [key, value] of this.items.entries()) {
        this.disposeCallback(value, key);
      }
    }
    this.items.clear();
    this.keyOrder = [];
  }
  get size() {
    return this.items.size;
  }
  has(key) {
    return this.items.has(key);
  }
}
const DEBOUNCE_TIME = 500;
const TIMEOUT_TIME = 6e4;
const MAX_CACHE_SIZE = 20;
const MAX_PENDING_REQUESTS = 2;
const processStartAndEndSpaces = (result) => {
  [result] = extractCodeFromRegular({ text: result, recentlyAddedTextLen: result.length });
  const hasLeadingSpace = result.startsWith(" ");
  const hasTrailingSpace = result.endsWith(" ");
  return (hasLeadingSpace ? " " : "") + result.trim() + (hasTrailingSpace ? " " : "");
};
const removeLeftTabsAndTrimEnds = (s) => {
  const trimmedString = s.trimEnd();
  const trailingEnd = s.slice(trimmedString.length);
  if (trailingEnd.includes(_ln)) {
    s = trimmedString + _ln;
  }
  s = s.replace(/^\s+/gm, "");
  return s;
};
const removeAllWhitespace = (str) => str.replace(/\s+/g, "");
function getIsSubsequence({ of, subsequence }) {
  if (subsequence.length === 0) return [true, ""];
  if (of.length === 0) return [false, ""];
  let subsequenceIndex = 0;
  let lastMatchChar = "";
  for (let i = 0; i < of.length; i++) {
    if (of[i] === subsequence[subsequenceIndex]) {
      lastMatchChar = of[i];
      subsequenceIndex++;
    }
    if (subsequenceIndex === subsequence.length) {
      return [true, lastMatchChar];
    }
  }
  return [false, lastMatchChar];
}
function getStringUpToUnbalancedClosingParenthesis(s, prefix) {
  const pairs = { ")": "(", "}": "{", "]": "[" };
  let stack = [];
  const firstOpenIdx = prefix.search(/[[({]/);
  if (firstOpenIdx !== -1) {
    const brackets = prefix.slice(firstOpenIdx).split("").filter((c) => "()[]{}".includes(c));
    for (const bracket of brackets) {
      if (bracket === "(" || bracket === "{" || bracket === "[") {
        stack.push(bracket);
      } else {
        if (stack.length > 0 && stack[stack.length - 1] === pairs[bracket]) {
          stack.pop();
        } else {
          stack.push(bracket);
        }
      }
    }
  }
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (char === "(" || char === "{" || char === "[") {
      stack.push(char);
    } else if (char === ")" || char === "}" || char === "]") {
      if (stack.length === 0 || stack.pop() !== pairs[char]) {
        return s.substring(0, i);
      }
    }
  }
  return s;
}
const postprocessAutocompletion = ({ autocompletionMatchup, autocompletion, prefixAndSuffix }) => {
  const { prefix, prefixToTheLeftOfCursor, suffixToTheRightOfCursor } = prefixAndSuffix;
  const generatedMiddle = autocompletion.insertText;
  let startIdx = autocompletionMatchup.startIdx;
  let endIdx = generatedMiddle.length;
  const charToLeftOfCursor = prefixToTheLeftOfCursor.slice(-1)[0] || "";
  const userHasAddedASpace = charToLeftOfCursor === " " || charToLeftOfCursor === "	";
  const rawFirstNonspaceIdx = generatedMiddle.slice(startIdx).search(/[^\t ]/);
  if (rawFirstNonspaceIdx > -1 && userHasAddedASpace) {
    const firstNonspaceIdx = rawFirstNonspaceIdx + startIdx;
    startIdx = Math.max(startIdx, firstNonspaceIdx);
  }
  const numStartingNewlines = generatedMiddle.slice(startIdx).match(new RegExp(`^${_ln}+`))?.[0].length || 0;
  if (!prefixToTheLeftOfCursor.trim() && !suffixToTheRightOfCursor.trim() && numStartingNewlines > 0) {
    startIdx += numStartingNewlines;
  }
  if (autocompletion.type === "single-line-fill-middle" && suffixToTheRightOfCursor.trim()) {
    const rawMatchIndex = generatedMiddle.slice(startIdx).lastIndexOf(suffixToTheRightOfCursor.trim()[0]);
    if (rawMatchIndex > -1) {
      const matchIdx = rawMatchIndex + startIdx;
      const matchChar = generatedMiddle[matchIdx];
      if (`{}()[]<>\`'"`.includes(matchChar)) {
        endIdx = Math.min(endIdx, matchIdx);
      }
    }
  }
  const restOfLineToGenerate = generatedMiddle.slice(startIdx).split(_ln)[0] ?? "";
  if (prefixToTheLeftOfCursor.trim() && !suffixToTheRightOfCursor.trim() && restOfLineToGenerate.trim()) {
    const rawNewlineIdx = generatedMiddle.slice(startIdx).indexOf(_ln);
    if (rawNewlineIdx > -1) {
      const newlineIdx = rawNewlineIdx + startIdx;
      endIdx = Math.min(endIdx, newlineIdx);
    }
  }
  let completionStr = generatedMiddle.slice(startIdx, endIdx);
  completionStr = getStringUpToUnbalancedClosingParenthesis(completionStr, prefix);
  return completionStr;
};
const toInlineCompletions = ({ autocompletionMatchup, autocompletion, prefixAndSuffix, position, debug }) => {
  let trimmedInsertText = postprocessAutocompletion({ autocompletionMatchup, autocompletion, prefixAndSuffix });
  let rangeToReplace = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
  if (autocompletion.type === "single-line-redo-suffix") {
    const oldSuffix = prefixAndSuffix.suffixToTheRightOfCursor;
    const newSuffix = autocompletion.insertText;
    const [isSubsequence, lastMatchingChar] = getIsSubsequence({
      // check that the old text contains the same brackets + symbols as the new text
      subsequence: removeAllWhitespace(oldSuffix),
      // old suffix
      of: removeAllWhitespace(newSuffix)
      // new suffix
    });
    if (isSubsequence) {
      rangeToReplace = new Range(position.lineNumber, position.column, position.lineNumber, Number.MAX_SAFE_INTEGER);
    } else {
      const lastMatchupIdx = trimmedInsertText.lastIndexOf(lastMatchingChar);
      trimmedInsertText = trimmedInsertText.slice(0, lastMatchupIdx + 1);
      const numCharsToReplace = oldSuffix.lastIndexOf(lastMatchingChar) + 1;
      rangeToReplace = new Range(position.lineNumber, position.column, position.lineNumber, position.column + numCharsToReplace);
    }
  }
  return [{
    insertText: trimmedInsertText,
    range: rangeToReplace
  }];
};
const getPrefixAndSuffixInfo = (model, position) => {
  const fullText = model.getValue(EndOfLinePreference.LF);
  const cursorOffset = model.getOffsetAt(position);
  const prefix = fullText.substring(0, cursorOffset);
  const suffix = fullText.substring(cursorOffset);
  const prefixLines = prefix.split(_ln);
  const suffixLines = suffix.split(_ln);
  const prefixToTheLeftOfCursor = prefixLines.slice(-1)[0] ?? "";
  const suffixToTheRightOfCursor = suffixLines[0] ?? "";
  return { prefix, suffix, prefixLines, suffixLines, prefixToTheLeftOfCursor, suffixToTheRightOfCursor };
};
const getIndex = (str, line, char) => {
  return str.split(_ln).slice(0, line).join(_ln).length + (line > 0 ? 1 : 0) + char;
};
const getLastLine = (s) => {
  const matches = s.match(new RegExp(`[^${_ln}]*$`));
  return matches ? matches[0] : "";
};
const getAutocompletionMatchup = ({ prefix, autocompletion }) => {
  const trimmedCurrentPrefix = removeLeftTabsAndTrimEnds(prefix);
  const trimmedCompletionPrefix = removeLeftTabsAndTrimEnds(autocompletion.prefix);
  const trimmedCompletionMiddle = removeLeftTabsAndTrimEnds(autocompletion.insertText);
  if (trimmedCurrentPrefix.length < trimmedCompletionPrefix.length) {
    return void 0;
  }
  if (
    // check that completion starts with the prefix
    !(trimmedCompletionPrefix + trimmedCompletionMiddle).startsWith(trimmedCurrentPrefix)
  ) {
    return void 0;
  }
  const lineStart = trimmedCurrentPrefix.split(_ln).length - trimmedCompletionPrefix.split(_ln).length;
  if (lineStart < 0) {
    console.error("Error: No line found.");
    return void 0;
  }
  const currentPrefixLine = getLastLine(trimmedCurrentPrefix);
  const completionPrefixLine = lineStart === 0 ? getLastLine(trimmedCompletionPrefix) : "";
  const completionMiddleLine = autocompletion.insertText.split(_ln)[lineStart];
  const fullCompletionLine = completionPrefixLine + completionMiddleLine;
  const charMatchIdx = fullCompletionLine.indexOf(currentPrefixLine);
  if (charMatchIdx < 0) {
    console.error("Warning: Found character with negative index. This should never happen.");
    return void 0;
  }
  const character = charMatchIdx + currentPrefixLine.length - completionPrefixLine.length;
  const startIdx = getIndex(autocompletion.insertText, lineStart, character);
  return {
    startLine: lineStart,
    startCharacter: character,
    startIdx
  };
};
const getCompletionOptions = (prefixAndSuffix, relevantContext, justAcceptedAutocompletion) => {
  let { prefix, suffix, prefixToTheLeftOfCursor, suffixToTheRightOfCursor, suffixLines, prefixLines } = prefixAndSuffix;
  suffixLines = suffix.split(_ln).slice(0, 25);
  prefixLines = prefix.split(_ln).slice(-25);
  prefix = prefixLines.join(_ln);
  suffix = suffixLines.join(_ln);
  let completionOptions;
  const isLineEmpty = !prefixToTheLeftOfCursor.trim() && !suffixToTheRightOfCursor.trim();
  const isLinePrefixEmpty = removeAllWhitespace(prefixToTheLeftOfCursor).length === 0;
  const isLineSuffixEmpty = removeAllWhitespace(suffixToTheRightOfCursor).length === 0;
  if (justAcceptedAutocompletion && isLineSuffixEmpty) {
    const prefixWithNewline = prefix + _ln;
    completionOptions = {
      predictionType: "multi-line-start-on-next-line",
      shouldGenerate: true,
      llmPrefix: prefixWithNewline,
      llmSuffix: suffix,
      stopTokens: [`${_ln}${_ln}`]
      // double newlines
    };
  } else if (isLineEmpty) {
    completionOptions = {
      predictionType: "single-line-fill-middle",
      shouldGenerate: true,
      llmPrefix: prefix,
      llmSuffix: suffix,
      stopTokens: allLinebreakSymbols
    };
  } else if (removeAllWhitespace(suffixToTheRightOfCursor).length <= 3) {
    const suffixLinesIgnoringThisLine = suffixLines.slice(1);
    const suffixStringIgnoringThisLine = suffixLinesIgnoringThisLine.length === 0 ? "" : _ln + suffixLinesIgnoringThisLine.join(_ln);
    completionOptions = {
      predictionType: "single-line-redo-suffix",
      shouldGenerate: true,
      llmPrefix: prefix,
      llmSuffix: suffixStringIgnoringThisLine,
      stopTokens: allLinebreakSymbols
    };
  } else if (!isLinePrefixEmpty) {
    completionOptions = {
      predictionType: "single-line-fill-middle",
      shouldGenerate: true,
      llmPrefix: prefix,
      llmSuffix: suffix,
      stopTokens: allLinebreakSymbols
    };
  } else {
    completionOptions = {
      predictionType: "do-not-predict",
      shouldGenerate: false,
      llmPrefix: prefix,
      llmSuffix: suffix,
      stopTokens: []
    };
  }
  return completionOptions;
};
const IAutocompleteService = createDecorator("AutocompleteService");
let AutocompleteService = class extends Disposable {
  constructor(_langFeatureService, _llmMessageService, _editorService, _modelService, _settingsService, _convertToLLMMessageService) {
    super();
    this._langFeatureService = _langFeatureService;
    this._llmMessageService = _llmMessageService;
    this._editorService = _editorService;
    this._modelService = _modelService;
    this._settingsService = _settingsService;
    this._convertToLLMMessageService = _convertToLLMMessageService;
    this._autocompletionId = 0;
    this._autocompletionsOfDocument = {};
    this._lastCompletionStart = 0;
    this._lastCompletionAccept = 0;
    this._register(this._langFeatureService.inlineCompletionsProvider.register("*", {
      provideInlineCompletions: async (model, position, context, token) => {
        const items = await this._provideInlineCompletionItems(model, position);
        return { items };
      },
      freeInlineCompletions: (completions) => {
        const activePane = this._editorService.activeEditorPane;
        if (!activePane) return;
        const control = activePane.getControl();
        if (!control || !isCodeEditor(control)) return;
        const position = control.getPosition();
        if (!position) return;
        const resource = EditorResourceAccessor.getCanonicalUri(this._editorService.activeEditor);
        if (!resource) return;
        const model = this._modelService.getModel(resource);
        if (!model) return;
        const docUriStr = resource.fsPath;
        if (!this._autocompletionsOfDocument[docUriStr]) return;
        const { prefix } = getPrefixAndSuffixInfo(model, position);
        this._autocompletionsOfDocument[docUriStr].items.forEach((autocompletion) => {
          const matchup = removeAllWhitespace(prefix) === removeAllWhitespace(autocompletion.prefix + autocompletion.insertText);
          if (matchup) {
            console.log("ACCEPT", autocompletion.id);
            this._lastCompletionAccept = Date.now();
            this._autocompletionsOfDocument[docUriStr].delete(autocompletion.id);
          }
        });
      }
    }));
  }
  // private _lastPrefix: string = ''
  // used internally by vscode
  // fires after every keystroke and returns the completion to show
  async _provideInlineCompletionItems(model, position) {
    const isEnabled = this._settingsService.state.globalSettings.enableAutocomplete;
    if (!isEnabled) return [];
    const testMode = false;
    const docUriStr = model.uri.fsPath;
    const prefixAndSuffix = getPrefixAndSuffixInfo(model, position);
    const { prefix, suffix } = prefixAndSuffix;
    if (!this._autocompletionsOfDocument[docUriStr]) {
      this._autocompletionsOfDocument[docUriStr] = new LRUCache(
        MAX_CACHE_SIZE,
        (autocompletion) => {
          if (autocompletion.requestId)
            this._llmMessageService.abort(autocompletion.requestId);
        }
      );
    }
    let cachedAutocompletion = void 0;
    let autocompletionMatchup = void 0;
    for (const autocompletion of this._autocompletionsOfDocument[docUriStr].items.values()) {
      autocompletionMatchup = getAutocompletionMatchup({ prefix, autocompletion });
      if (autocompletionMatchup !== void 0) {
        cachedAutocompletion = autocompletion;
        break;
      }
    }
    if (cachedAutocompletion && autocompletionMatchup) {
      console.log("AA");
      if (cachedAutocompletion.status === "finished") {
        console.log("A1");
        const inlineCompletions = toInlineCompletions({ autocompletionMatchup, autocompletion: cachedAutocompletion, prefixAndSuffix, position, debug: true });
        return inlineCompletions;
      } else if (cachedAutocompletion.status === "pending") {
        console.log("A2");
        try {
          await cachedAutocompletion.llmPromise;
          const inlineCompletions = toInlineCompletions({ autocompletionMatchup, autocompletion: cachedAutocompletion, prefixAndSuffix, position });
          return inlineCompletions;
        } catch (e) {
          this._autocompletionsOfDocument[docUriStr].delete(cachedAutocompletion.id);
          console.error("Error creating autocompletion (1): " + e);
        }
      } else if (cachedAutocompletion.status === "error") {
        console.log("A3");
      } else {
        console.log("A4");
      }
      return [];
    }
    const thisTime = Date.now();
    const justAcceptedAutocompletion = thisTime - this._lastCompletionAccept < 500;
    this._lastCompletionStart = thisTime;
    const didTypingHappenDuringDebounce = await new Promise(
      (resolve, reject) => setTimeout(() => {
        if (this._lastCompletionStart === thisTime) {
          resolve(false);
        } else {
          resolve(true);
        }
      }, DEBOUNCE_TIME)
    );
    if (didTypingHappenDuringDebounce) {
      return [];
    }
    let numPending = 0;
    let oldestPending = void 0;
    for (const autocompletion of this._autocompletionsOfDocument[docUriStr].items.values()) {
      if (autocompletion.status === "pending") {
        numPending += 1;
        if (oldestPending === void 0) {
          oldestPending = autocompletion;
        }
        if (numPending >= MAX_PENDING_REQUESTS) {
          this._autocompletionsOfDocument[docUriStr].delete(oldestPending.id);
          break;
        }
      }
    }
    const relevantContext = "";
    const { shouldGenerate, predictionType, llmPrefix, llmSuffix, stopTokens } = getCompletionOptions(prefixAndSuffix, relevantContext, justAcceptedAutocompletion);
    if (!shouldGenerate) return [];
    if (testMode && this._autocompletionId !== 0) {
      return [];
    }
    const newAutocompletion = {
      id: this._autocompletionId++,
      prefix,
      // the actual prefix and suffix
      suffix,
      llmPrefix,
      // the prefix and suffix the llm sees
      llmSuffix,
      startTime: Date.now(),
      endTime: void 0,
      type: predictionType,
      status: "pending",
      llmPromise: void 0,
      insertText: "",
      requestId: null,
      _newlineCount: 0
    };
    console.log("starting autocomplete...", predictionType);
    const featureName = "Autocomplete";
    const overridesOfModel = this._settingsService.state.overridesOfModel;
    const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName];
    const modelSelectionOptions = modelSelection ? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName] : void 0;
    newAutocompletion.llmPromise = new Promise((resolve, reject) => {
      const requestId = this._llmMessageService.sendLLMMessage({
        messagesType: "FIMMessage",
        messages: this._convertToLLMMessageService.prepareFIMMessage({
          messages: {
            prefix: llmPrefix,
            suffix: llmSuffix,
            stopTokens
          }
        }),
        modelSelection,
        modelSelectionOptions,
        overridesOfModel,
        logging: { loggingName: "Autocomplete" },
        onText: () => {
        },
        // unused in FIMMessage
        // onText: async ({ fullText, newText }) => {
        // 	newAutocompletion.insertText = fullText
        // 	// count newlines in newText
        // 	const numNewlines = newText.match(/\n|\r\n/g)?.length || 0
        // 	newAutocompletion._newlineCount += numNewlines
        // 	// if too many newlines, resolve up to last newline
        // 	if (newAutocompletion._newlineCount > 10) {
        // 		const lastNewlinePos = fullText.lastIndexOf('\n')
        // 		newAutocompletion.insertText = fullText.substring(0, lastNewlinePos)
        // 		resolve(newAutocompletion.insertText)
        // 		return
        // 	}
        // 	// if (!getAutocompletionMatchup({ prefix: this._lastPrefix, autocompletion: newAutocompletion })) {
        // 	// 	reject('LLM response did not match user\'s text.')
        // 	// }
        // },
        onFinalMessage: ({ fullText }) => {
          newAutocompletion.endTime = Date.now();
          newAutocompletion.status = "finished";
          const [text, _] = extractCodeFromRegular({ text: fullText, recentlyAddedTextLen: 0 });
          newAutocompletion.insertText = processStartAndEndSpaces(text);
          if (newAutocompletion.type === "multi-line-start-on-next-line") {
            newAutocompletion.insertText = _ln + newAutocompletion.insertText;
          }
          resolve(newAutocompletion.insertText);
        },
        onError: ({ message }) => {
          newAutocompletion.endTime = Date.now();
          newAutocompletion.status = "error";
          reject(message);
        },
        onAbort: () => {
          reject("Aborted autocomplete");
        }
      });
      newAutocompletion.requestId = requestId;
      setTimeout(() => {
        if (newAutocompletion.status === "pending") {
          reject("Timeout receiving message to LLM.");
        }
      }, TIMEOUT_TIME);
    });
    this._autocompletionsOfDocument[docUriStr].set(newAutocompletion.id, newAutocompletion);
    try {
      await newAutocompletion.llmPromise;
      const autocompletionMatchup2 = { startIdx: 0, startLine: 0, startCharacter: 0 };
      const inlineCompletions = toInlineCompletions({ autocompletionMatchup: autocompletionMatchup2, autocompletion: newAutocompletion, prefixAndSuffix, position });
      return inlineCompletions;
    } catch (e) {
      this._autocompletionsOfDocument[docUriStr].delete(newAutocompletion.id);
      console.error("Error creating autocompletion (2): " + e);
      return [];
    }
  }
};
AutocompleteService.ID = "void.autocompleteService";
AutocompleteService = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, ILLMMessageService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IModelService),
  __decorateParam(4, IVoidSettingsService),
  __decorateParam(5, IConvertToLLMMessageService)
], AutocompleteService);
registerWorkbenchContribution2(AutocompleteService.ID, AutocompleteService, WorkbenchPhase.BlockRestore);
export {
  AutocompleteService,
  IAutocompleteService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvYXV0b2NvbXBsZXRlU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAyMDI1IEdsYXNzIERldnRvb2xzLCBJbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMC4gU2VlIExJQ0VOU0UudHh0IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRW5kT2ZMaW5lUHJlZmVyZW5jZSwgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbiwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc0NvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvclJlc291cmNlQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IGV4dHJhY3RDb2RlRnJvbVJlZ3VsYXIgfSBmcm9tICcuLi9jb21tb24vaGVscGVycy9leHRyYWN0Q29kZUZyb21SZXN1bHQuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yLCBXb3JrYmVuY2hQaGFzZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElMTE1NZXNzYWdlU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9zZW5kTExNTWVzc2FnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVZvaWRTZXR0aW5nc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdm9pZFNldHRpbmdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGZWF0dXJlTmFtZSB9IGZyb20gJy4uL2NvbW1vbi92b2lkU2V0dGluZ3NUeXBlcy5qcyc7XG5pbXBvcnQgeyBJQ29udmVydFRvTExNTWVzc2FnZVNlcnZpY2UgfSBmcm9tICcuL2NvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlLmpzJztcbi8vIGltcG9ydCB7IElDb250ZXh0R2F0aGVyaW5nU2VydmljZSB9IGZyb20gJy4vY29udGV4dEdhdGhlcmluZ1NlcnZpY2UuanMnO1xuXG5cblxuY29uc3QgYWxsTGluZWJyZWFrU3ltYm9scyA9IFsnXFxyXFxuJywgJ1xcbiddXG5jb25zdCBfbG4gPSBpc1dpbmRvd3MgPyBhbGxMaW5lYnJlYWtTeW1ib2xzWzBdIDogYWxsTGluZWJyZWFrU3ltYm9sc1sxXVxuXG4vLyBUaGUgZXh0ZW5zaW9uIHRoaXMgd2FzIGNhbGxlZCBmcm9tIGlzIGhlcmUgLSBodHRwczovL2dpdGh1Yi5jb20vdm9pZGVkaXRvci92b2lkL2Jsb2IvYXV0b2NvbXBsZXRlL2V4dGVuc2lvbnMvdm9pZC9zcmMvZXh0ZW5zaW9uL2V4dGVuc2lvbi50c1xuXG5cbi8qXG5BIHN1bW1hcnkgb2YgYXV0b3RhYjpcblxuUG9zdHByb2Nlc3Npbmdcbi1vbmUgY29tbW9uIHByb2JsZW0gZm9yIGFsbCBtb2RlbHMgaXMgb3V0cHV0dGluZyB1bmJhbGFuY2VkIHBhcmVudGhlc2VzXG53ZSBzb2x2ZSB0aGlzIGJ5IHRyaW1taW5nIGFsbCBleHRyYSBjbG9zaW5nIHBhcmVudGhlc2VzIGZyb20gdGhlIGdlbmVyYXRlZCBzdHJpbmdcbmluIGZ1dHVyZSwgc2hvdWxkIG1ha2Ugc3VyZSBwYXJlbnRoZXNlcyBhcmUgYWx3YXlzIGJhbGFuY2VkXG5cbi1hbm90aGVyIHByb2JsZW0gaXMgY29tcGxldGluZyB0aGUgbWlkZGxlIG9mIGEgc3RyaW5nLCBlZy4gXCJjb25zdCBbeCwgQ1VSU09SXSA9IHVzZVN0YXRlKClcIlxud2UgY29tcGxldGUgdXAgdG8gZmlyc3QgbWF0Y2h1cCBjaGFyYWN0ZXJcbmJ1dCBzaG91bGQgaW5zdGVhZCBjb21wbGV0ZSB0aGUgd2hvbGUgbGluZSAvIGJsb2NrIChkaWZmaWN1bHQgYmVjYXVzZSBvZiBwYXJlbnRoZXNpcyBhY2N1cmFjeSlcblxuLXRvbyBtdWNoIGluZm8gaXMgYmFkLiB1c3VhbGx5IHdlIHdhbnQgdG8gc2hvdyB0aGUgdXNlciAxIGxpbmUsIGFuZCBoYXZlIGEgcHJlbG9hZGVkIHJlc3BvbnNlIGFmdGVyd2FyZHNcbnRoaXMgc2hvdWxkIGhhcHBlbiBhdXRvbWF0aWNhbGx5IHdpdGggY2FjaGluZyBzeXN0ZW1cbnNob3VsZCBicmVhayBwcmVsb2FkZWQgcmVzcG9uc2VzIGludG8gXFxuXFxuIGNodW5rc1xuXG5QcmVwcm9jZXNzaW5nXG4tIHdlIGRvbid0IGdlbmVyYXRlIGlmIGN1cnNvciBpcyBhdCBlbmQgLyBiZWdpbm5pbmcgb2YgYSBsaW5lIChubyBzcGFjZXMpXG4tIHdlIGdlbmVyYXRlIDEgbGluZSBpZiB0aGVyZSBpcyB0ZXh0IHRvIHRoZSByaWdodCBvZiBjdXJzb3Jcbi0gd2UgZ2VuZXJhdGUgMSBsaW5lIGlmIHZhcmlhYmxlIGRlY2xhcmF0aW9uXG4tIChpbiBtYW55IGNhc2VzIHdhbnQgdG8gc2hvdyAxIGxpbmUgYnV0IGdlbmVyYXRlIG11bHRpcGxlKVxuXG5TdGF0ZVxuLSBjYWNoZSBiYXNlZCBvbiBwcmVmaXggKGFuZCBkbyBzb21lIHRyaW1taW5nIGZpcnN0KVxuLSB3aGVuIHByZXNzIHRhYiBvbiBvbmUgbGluZSwgc2hvdWxkIGhhdmUgYW4gaW1tZWRpYXRlIGZvbGxvd3VwIHJlc3BvbnNlXG50byBkbyB0aGlzLCBzaG93IGF1dG9jb21wbGV0ZXMgYmVmb3JlIHRoZXkncmUgZnVsbHkgZmluaXNoZWRcbi0gW3RvZG9dIHJlbW92ZSBlYWNoIGF1dG90YWIgd2hlbiBhY2NlcHRlZFxuIS0gW3RvZG9dIHByb3ZpZGUgdHlwZSBpbmZvcm1hdGlvblxuXG5EZXRhaWxzXG4tZ2VuZXJhdGVkIHJlc3VsdHMgYXJlIHRyaW1tZWQgdXAgdG8gMSBsZWFkaW5nL3RyYWlsaW5nIHNwYWNlXG4tcHJlZml4ZXMgYXJlIGNhY2hlZCB1cCB0byAxIHRyYWlsaW5nIG5ld2xpbmVcbi1cbiovXG5cbmNsYXNzIExSVUNhY2hlPEssIFY+IHtcblx0cHVibGljIGl0ZW1zOiBNYXA8SywgVj47XG5cdHByaXZhdGUga2V5T3JkZXI6IEtbXTtcblx0cHJpdmF0ZSBtYXhTaXplOiBudW1iZXI7XG5cdHByaXZhdGUgZGlzcG9zZUNhbGxiYWNrPzogKHZhbHVlOiBWLCBrZXk/OiBLKSA9PiB2b2lkO1xuXG5cdGNvbnN0cnVjdG9yKG1heFNpemU6IG51bWJlciwgZGlzcG9zZUNhbGxiYWNrPzogKHZhbHVlOiBWLCBrZXk/OiBLKSA9PiB2b2lkKSB7XG5cdFx0aWYgKG1heFNpemUgPD0gMCkgdGhyb3cgbmV3IEVycm9yKCdDYWNoZSBzaXplIG11c3QgYmUgZ3JlYXRlciB0aGFuIDAnKTtcblxuXHRcdHRoaXMuaXRlbXMgPSBuZXcgTWFwKCk7XG5cdFx0dGhpcy5rZXlPcmRlciA9IFtdO1xuXHRcdHRoaXMubWF4U2l6ZSA9IG1heFNpemU7XG5cdFx0dGhpcy5kaXNwb3NlQ2FsbGJhY2sgPSBkaXNwb3NlQ2FsbGJhY2s7XG5cdH1cblxuXHRzZXQoa2V5OiBLLCB2YWx1ZTogVik6IHZvaWQge1xuXHRcdC8vIElmIGtleSBleGlzdHMsIHJlbW92ZSBpdCBmcm9tIHRoZSBvcmRlciBsaXN0XG5cdFx0aWYgKHRoaXMuaXRlbXMuaGFzKGtleSkpIHtcblx0XHRcdHRoaXMua2V5T3JkZXIgPSB0aGlzLmtleU9yZGVyLmZpbHRlcihrID0+IGsgIT09IGtleSk7XG5cdFx0fVxuXHRcdC8vIElmIGNhY2hlIGlzIGZ1bGwsIHJlbW92ZSBsZWFzdCByZWNlbnRseSB1c2VkIGl0ZW1cblx0XHRlbHNlIGlmICh0aGlzLml0ZW1zLnNpemUgPj0gdGhpcy5tYXhTaXplKSB7XG5cdFx0XHRjb25zdCBrZXkgPSB0aGlzLmtleU9yZGVyWzBdO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSB0aGlzLml0ZW1zLmdldChrZXkpO1xuXG5cdFx0XHQvLyBDYWxsIGRpc3Bvc2UgY2FsbGJhY2sgaWYgaXQgZXhpc3RzXG5cdFx0XHRpZiAodGhpcy5kaXNwb3NlQ2FsbGJhY2sgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2VDYWxsYmFjayh2YWx1ZSwga2V5KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5pdGVtcy5kZWxldGUoa2V5KTtcblx0XHRcdHRoaXMua2V5T3JkZXIuc2hpZnQoKTtcblx0XHR9XG5cblx0XHQvLyBBZGQgbmV3IGl0ZW1cblx0XHR0aGlzLml0ZW1zLnNldChrZXksIHZhbHVlKTtcblx0XHR0aGlzLmtleU9yZGVyLnB1c2goa2V5KTtcblx0fVxuXG5cdGRlbGV0ZShrZXk6IEspOiBib29sZWFuIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuaXRlbXMuZ2V0KGtleSk7XG5cblx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Ly8gQ2FsbCBkaXNwb3NlIGNhbGxiYWNrIGlmIGl0IGV4aXN0c1xuXHRcdFx0aWYgKHRoaXMuZGlzcG9zZUNhbGxiYWNrKSB7XG5cdFx0XHRcdHRoaXMuZGlzcG9zZUNhbGxiYWNrKHZhbHVlLCBrZXkpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLml0ZW1zLmRlbGV0ZShrZXkpO1xuXHRcdFx0dGhpcy5rZXlPcmRlciA9IHRoaXMua2V5T3JkZXIuZmlsdGVyKGsgPT4gayAhPT0ga2V5KTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdC8vIENhbGwgZGlzcG9zZSBjYWxsYmFjayBmb3IgYWxsIGl0ZW1zIGlmIGl0IGV4aXN0c1xuXHRcdGlmICh0aGlzLmRpc3Bvc2VDYWxsYmFjaykge1xuXHRcdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcy5pdGVtcy5lbnRyaWVzKCkpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlQ2FsbGJhY2sodmFsdWUsIGtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5pdGVtcy5jbGVhcigpO1xuXHRcdHRoaXMua2V5T3JkZXIgPSBbXTtcblx0fVxuXG5cdGdldCBzaXplKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXMuc2l6ZTtcblx0fVxuXG5cdGhhcyhrZXk6IEspOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcy5oYXMoa2V5KTtcblx0fVxufVxuXG50eXBlIEF1dG9jb21wbGV0aW9uUHJlZGljdGlvblR5cGUgPVxuXHR8ICdzaW5nbGUtbGluZS1maWxsLW1pZGRsZSdcblx0fCAnc2luZ2xlLWxpbmUtcmVkby1zdWZmaXgnXG5cdC8vIHwgJ211bHRpLWxpbmUtc3RhcnQtaGVyZSdcblx0fCAnbXVsdGktbGluZS1zdGFydC1vbi1uZXh0LWxpbmUnXG5cdHwgJ2RvLW5vdC1wcmVkaWN0J1xuXG50eXBlIEF1dG9jb21wbGV0aW9uID0ge1xuXHRpZDogbnVtYmVyLFxuXHRwcmVmaXg6IHN0cmluZyxcblx0c3VmZml4OiBzdHJpbmcsXG5cdGxsbVByZWZpeDogc3RyaW5nLFxuXHRsbG1TdWZmaXg6IHN0cmluZyxcblx0c3RhcnRUaW1lOiBudW1iZXIsXG5cdGVuZFRpbWU6IG51bWJlciB8IHVuZGVmaW5lZCxcblx0c3RhdHVzOiAncGVuZGluZycgfCAnZmluaXNoZWQnIHwgJ2Vycm9yJyxcblx0dHlwZTogQXV0b2NvbXBsZXRpb25QcmVkaWN0aW9uVHlwZSxcblx0bGxtUHJvbWlzZTogUHJvbWlzZTxzdHJpbmc+IHwgdW5kZWZpbmVkLFxuXHRpbnNlcnRUZXh0OiBzdHJpbmcsXG5cdHJlcXVlc3RJZDogc3RyaW5nIHwgbnVsbCxcblx0X25ld2xpbmVDb3VudDogbnVtYmVyLFxufVxuXG5jb25zdCBERUJPVU5DRV9USU1FID0gNTAwXG5jb25zdCBUSU1FT1VUX1RJTUUgPSA2MDAwMFxuY29uc3QgTUFYX0NBQ0hFX1NJWkUgPSAyMFxuY29uc3QgTUFYX1BFTkRJTkdfUkVRVUVTVFMgPSAyXG5cbi8vIHBvc3Rwcm9jZXNzZXMgdGhlIHJlc3VsdFxuY29uc3QgcHJvY2Vzc1N0YXJ0QW5kRW5kU3BhY2VzID0gKHJlc3VsdDogc3RyaW5nKSA9PiB7XG5cblx0Ly8gdHJpbSBhbGwgd2hpdGVzcGFjZSBleGNlcHQgZm9yIGEgc2luZ2xlIGxlYWRpbmcvdHJhaWxpbmcgc3BhY2Vcblx0Ly8gcmV0dXJuIHJlc3VsdC50cmltKClcblxuXHRbcmVzdWx0LF0gPSBleHRyYWN0Q29kZUZyb21SZWd1bGFyKHsgdGV4dDogcmVzdWx0LCByZWNlbnRseUFkZGVkVGV4dExlbjogcmVzdWx0Lmxlbmd0aCB9KVxuXG5cdGNvbnN0IGhhc0xlYWRpbmdTcGFjZSA9IHJlc3VsdC5zdGFydHNXaXRoKCcgJyk7XG5cdGNvbnN0IGhhc1RyYWlsaW5nU3BhY2UgPSByZXN1bHQuZW5kc1dpdGgoJyAnKTtcblxuXHRyZXR1cm4gKGhhc0xlYWRpbmdTcGFjZSA/ICcgJyA6ICcnKVxuXHRcdCsgcmVzdWx0LnRyaW0oKVxuXHRcdCsgKGhhc1RyYWlsaW5nU3BhY2UgPyAnICcgOiAnJyk7XG5cbn1cblxuXG4vLyB0cmltcyB0aGUgZW5kIG9mIHRoZSBwcmVmaXggdG8gaW1wcm92ZSBjYWNoZSBoaXQgcmF0ZVxuY29uc3QgcmVtb3ZlTGVmdFRhYnNBbmRUcmltRW5kcyA9IChzOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuXHRjb25zdCB0cmltbWVkU3RyaW5nID0gcy50cmltRW5kKCk7XG5cdGNvbnN0IHRyYWlsaW5nRW5kID0gcy5zbGljZSh0cmltbWVkU3RyaW5nLmxlbmd0aCk7XG5cblx0Ly8ga2VlcCBvbmx5IGEgc2luZ2xlIHRyYWlsaW5nIG5ld2xpbmVcblx0aWYgKHRyYWlsaW5nRW5kLmluY2x1ZGVzKF9sbikpIHtcblx0XHRzID0gdHJpbW1lZFN0cmluZyArIF9sbjtcblx0fVxuXG5cdHMgPSBzLnJlcGxhY2UoL15cXHMrL2dtLCAnJyk7IC8vIHJlbW92ZSBsZWZ0IHRhYnNcblxuXHRyZXR1cm4gcztcbn1cblxuXG5cbmNvbnN0IHJlbW92ZUFsbFdoaXRlc3BhY2UgPSAoc3RyOiBzdHJpbmcpOiBzdHJpbmcgPT4gc3RyLnJlcGxhY2UoL1xccysvZywgJycpO1xuXG5cblxuZnVuY3Rpb24gZ2V0SXNTdWJzZXF1ZW5jZSh7IG9mLCBzdWJzZXF1ZW5jZSB9OiB7IG9mOiBzdHJpbmcsIHN1YnNlcXVlbmNlOiBzdHJpbmcgfSk6IFtib29sZWFuLCBzdHJpbmddIHtcblx0aWYgKHN1YnNlcXVlbmNlLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFt0cnVlLCAnJ107XG5cdGlmIChvZi5sZW5ndGggPT09IDApIHJldHVybiBbZmFsc2UsICcnXTtcblxuXHRsZXQgc3Vic2VxdWVuY2VJbmRleCA9IDA7XG5cdGxldCBsYXN0TWF0Y2hDaGFyID0gJyc7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBvZi5sZW5ndGg7IGkrKykge1xuXHRcdGlmIChvZltpXSA9PT0gc3Vic2VxdWVuY2Vbc3Vic2VxdWVuY2VJbmRleF0pIHtcblx0XHRcdGxhc3RNYXRjaENoYXIgPSBvZltpXTtcblx0XHRcdHN1YnNlcXVlbmNlSW5kZXgrKztcblx0XHR9XG5cdFx0aWYgKHN1YnNlcXVlbmNlSW5kZXggPT09IHN1YnNlcXVlbmNlLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIFt0cnVlLCBsYXN0TWF0Y2hDaGFyXTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gW2ZhbHNlLCBsYXN0TWF0Y2hDaGFyXTtcbn1cblxuXG5mdW5jdGlvbiBnZXRTdHJpbmdVcFRvVW5iYWxhbmNlZENsb3NpbmdQYXJlbnRoZXNpcyhzOiBzdHJpbmcsIHByZWZpeDogc3RyaW5nKTogc3RyaW5nIHtcblxuXHRjb25zdCBwYWlyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgJyknOiAnKCcsICd9JzogJ3snLCAnXSc6ICdbJyB9O1xuXG5cdC8vIHByb2Nlc3MgYWxsIGJyYWNldHMgaW4gcHJlZml4XG5cdGxldCBzdGFjazogc3RyaW5nW10gPSBbXVxuXHRjb25zdCBmaXJzdE9wZW5JZHggPSBwcmVmaXguc2VhcmNoKC9bWyh7XS8pO1xuXHRpZiAoZmlyc3RPcGVuSWR4ICE9PSAtMSkge1xuXHRcdGNvbnN0IGJyYWNrZXRzID0gcHJlZml4LnNsaWNlKGZpcnN0T3BlbklkeCkuc3BsaXQoJycpLmZpbHRlcihjID0+ICcoKVtde30nLmluY2x1ZGVzKGMpKTtcblxuXHRcdGZvciAoY29uc3QgYnJhY2tldCBvZiBicmFja2V0cykge1xuXHRcdFx0aWYgKGJyYWNrZXQgPT09ICcoJyB8fCBicmFja2V0ID09PSAneycgfHwgYnJhY2tldCA9PT0gJ1snKSB7XG5cdFx0XHRcdHN0YWNrLnB1c2goYnJhY2tldCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoc3RhY2subGVuZ3RoID4gMCAmJiBzdGFja1tzdGFjay5sZW5ndGggLSAxXSA9PT0gcGFpcnNbYnJhY2tldF0pIHtcblx0XHRcdFx0XHRzdGFjay5wb3AoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzdGFjay5wdXNoKGJyYWNrZXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gaXRlcmF0ZSB0aHJvdWdoIGVhY2ggY2hhcmFjdGVyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgcy5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGNoYXIgPSBzW2ldO1xuXG5cdFx0aWYgKGNoYXIgPT09ICcoJyB8fCBjaGFyID09PSAneycgfHwgY2hhciA9PT0gJ1snKSB7IHN0YWNrLnB1c2goY2hhcik7IH1cblx0XHRlbHNlIGlmIChjaGFyID09PSAnKScgfHwgY2hhciA9PT0gJ30nIHx8IGNoYXIgPT09ICddJykge1xuXHRcdFx0aWYgKHN0YWNrLmxlbmd0aCA9PT0gMCB8fCBzdGFjay5wb3AoKSAhPT0gcGFpcnNbY2hhcl0pIHsgcmV0dXJuIHMuc3Vic3RyaW5nKDAsIGkpOyB9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBzO1xufVxuXG5cbi8vIGZ1cnRoZXIgdHJpbSB0aGUgYXV0b2NvbXBsZXRpb25cbmNvbnN0IHBvc3Rwcm9jZXNzQXV0b2NvbXBsZXRpb24gPSAoeyBhdXRvY29tcGxldGlvbk1hdGNodXAsIGF1dG9jb21wbGV0aW9uLCBwcmVmaXhBbmRTdWZmaXggfTogeyBhdXRvY29tcGxldGlvbk1hdGNodXA6IEF1dG9jb21wbGV0aW9uTWF0Y2h1cEJvdW5kcywgYXV0b2NvbXBsZXRpb246IEF1dG9jb21wbGV0aW9uLCBwcmVmaXhBbmRTdWZmaXg6IFByZWZpeEFuZFN1ZmZpeEluZm8gfSkgPT4ge1xuXG5cdGNvbnN0IHsgcHJlZml4LCBwcmVmaXhUb1RoZUxlZnRPZkN1cnNvciwgc3VmZml4VG9UaGVSaWdodE9mQ3Vyc29yIH0gPSBwcmVmaXhBbmRTdWZmaXhcblxuXHRjb25zdCBnZW5lcmF0ZWRNaWRkbGUgPSBhdXRvY29tcGxldGlvbi5pbnNlcnRUZXh0XG5cblx0bGV0IHN0YXJ0SWR4ID0gYXV0b2NvbXBsZXRpb25NYXRjaHVwLnN0YXJ0SWR4XG5cdGxldCBlbmRJZHggPSBnZW5lcmF0ZWRNaWRkbGUubGVuZ3RoIC8vIGV4Y2x1c2l2ZSBib3VuZHNcblxuXHQvLyBjb25zdCBuYWl2ZVJldHVyblZhbHVlID0gZ2VuZXJhdGVkTWlkZGxlLnNsaWNlKHN0YXJ0SWR4KVxuXHQvLyBjb25zb2xlLmxvZygnbmFpdmVSZXR1cm5WYWx1ZTogJywgSlNPTi5zdHJpbmdpZnkobmFpdmVSZXR1cm5WYWx1ZSkpXG5cdC8vIHJldHVybiBbeyBpbnNlcnRUZXh0OiBuYWl2ZVJldHVyblZhbHVlLCB9XVxuXG5cdC8vIGRvIHBvc3Rwcm9jZXNzaW5nIGZvciBiZXR0ZXIgdXhcblx0Ly8gdGhpcyBpcyBhIGJpdCBoYWNreSBidXQgbWF5IGNoYW5nZSBhIGxvdFxuXG5cdC8vIGlmIHRoZXJlIGlzIHNwYWNlIGF0IHRoZSBzdGFydCBvZiB0aGUgY29tcGxldGlvbiBhbmQgdXNlciBoYXMgYWRkZWQgaXQsIHJlbW92ZSBpdFxuXHRjb25zdCBjaGFyVG9MZWZ0T2ZDdXJzb3IgPSBwcmVmaXhUb1RoZUxlZnRPZkN1cnNvci5zbGljZSgtMSlbMF0gfHwgJydcblx0Y29uc3QgdXNlckhhc0FkZGVkQVNwYWNlID0gY2hhclRvTGVmdE9mQ3Vyc29yID09PSAnICcgfHwgY2hhclRvTGVmdE9mQ3Vyc29yID09PSAnXFx0J1xuXHRjb25zdCByYXdGaXJzdE5vbnNwYWNlSWR4ID0gZ2VuZXJhdGVkTWlkZGxlLnNsaWNlKHN0YXJ0SWR4KS5zZWFyY2goL1teXFx0IF0vKVxuXHRpZiAocmF3Rmlyc3ROb25zcGFjZUlkeCA+IC0xICYmIHVzZXJIYXNBZGRlZEFTcGFjZSkge1xuXHRcdGNvbnN0IGZpcnN0Tm9uc3BhY2VJZHggPSByYXdGaXJzdE5vbnNwYWNlSWR4ICsgc3RhcnRJZHg7XG5cdFx0Ly8gY29uc29sZS5sb2coJ3AwJywgc3RhcnRJZHgsIHJhd0ZpcnN0Tm9uc3BhY2VJZHgpXG5cdFx0c3RhcnRJZHggPSBNYXRoLm1heChzdGFydElkeCwgZmlyc3ROb25zcGFjZUlkeClcblx0fVxuXG5cdC8vIGlmIHVzZXIgaXMgb24gYSBibGFuayBsaW5lIGFuZCB0aGUgZ2VuZXJhdGlvbiBzdGFydHMgd2l0aCBuZXdsaW5lKHMpLCByZW1vdmUgdGhlbVxuXHRjb25zdCBudW1TdGFydGluZ05ld2xpbmVzID0gZ2VuZXJhdGVkTWlkZGxlLnNsaWNlKHN0YXJ0SWR4KS5tYXRjaChuZXcgUmVnRXhwKGBeJHtfbG59K2ApKT8uWzBdLmxlbmd0aCB8fCAwO1xuXHRpZiAoXG5cdFx0IXByZWZpeFRvVGhlTGVmdE9mQ3Vyc29yLnRyaW0oKVxuXHRcdCYmICFzdWZmaXhUb1RoZVJpZ2h0T2ZDdXJzb3IudHJpbSgpXG5cdFx0JiYgbnVtU3RhcnRpbmdOZXdsaW5lcyA+IDBcblx0KSB7XG5cdFx0Ly8gY29uc29sZS5sb2coJ3AxJywgbnVtU3RhcnRpbmdOZXdsaW5lcylcblx0XHRzdGFydElkeCArPSBudW1TdGFydGluZ05ld2xpbmVzXG5cdH1cblxuXHQvLyBpZiB0aGUgZ2VuZXJhdGVkIEZJTSB0ZXh0IG1hdGNoZXMgd2l0aCB0aGUgc3VmZml4IG9uIHRoZSBjdXJyZW50IGxpbmUsIHN0b3Bcblx0aWYgKGF1dG9jb21wbGV0aW9uLnR5cGUgPT09ICdzaW5nbGUtbGluZS1maWxsLW1pZGRsZScgJiYgc3VmZml4VG9UaGVSaWdodE9mQ3Vyc29yLnRyaW0oKSkgeyAvLyBjb21wbGV0aW5nIGluIHRoZSBtaWRkbGUgb2YgYSBsaW5lXG5cdFx0Ly8gY29tcGxldGUgdW50aWwgdGhlcmUgaXMgYSBtYXRjaFxuXHRcdGNvbnN0IHJhd01hdGNoSW5kZXggPSBnZW5lcmF0ZWRNaWRkbGUuc2xpY2Uoc3RhcnRJZHgpLmxhc3RJbmRleE9mKHN1ZmZpeFRvVGhlUmlnaHRPZkN1cnNvci50cmltKClbMF0pXG5cdFx0aWYgKHJhd01hdGNoSW5kZXggPiAtMSkge1xuXHRcdFx0Ly8gY29uc29sZS5sb2coJ3AyJywgcmF3TWF0Y2hJbmRleCwgc3RhcnRJZHgsIHN1ZmZpeFRvVGhlUmlnaHRPZkN1cnNvci50cmltKClbMF0sICdBQUEnLCBnZW5lcmF0ZWRNaWRkbGUuc2xpY2Uoc3RhcnRJZHgpKVxuXHRcdFx0Y29uc3QgbWF0Y2hJZHggPSByYXdNYXRjaEluZGV4ICsgc3RhcnRJZHg7XG5cdFx0XHRjb25zdCBtYXRjaENoYXIgPSBnZW5lcmF0ZWRNaWRkbGVbbWF0Y2hJZHhdXG5cdFx0XHRpZiAoYHt9KClbXTw+XFxgJ1wiYC5pbmNsdWRlcyhtYXRjaENoYXIpKSB7XG5cdFx0XHRcdGVuZElkeCA9IE1hdGgubWluKGVuZElkeCwgbWF0Y2hJZHgpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgcmVzdE9mTGluZVRvR2VuZXJhdGUgPSBnZW5lcmF0ZWRNaWRkbGUuc2xpY2Uoc3RhcnRJZHgpLnNwbGl0KF9sbilbMF0gPz8gJydcblx0Ly8gY29uZGl0aW9uIHRvIGNvbXBsZXRlIGFzIGEgc2luZ2xlIGxpbmUgY29tcGxldGlvblxuXHRpZiAoXG5cdFx0cHJlZml4VG9UaGVMZWZ0T2ZDdXJzb3IudHJpbSgpXG5cdFx0JiYgIXN1ZmZpeFRvVGhlUmlnaHRPZkN1cnNvci50cmltKClcblx0XHQmJiByZXN0T2ZMaW5lVG9HZW5lcmF0ZS50cmltKClcblx0KSB7XG5cblx0XHRjb25zdCByYXdOZXdsaW5lSWR4ID0gZ2VuZXJhdGVkTWlkZGxlLnNsaWNlKHN0YXJ0SWR4KS5pbmRleE9mKF9sbilcblx0XHRpZiAocmF3TmV3bGluZUlkeCA+IC0xKSB7XG5cdFx0XHQvLyBjb25zb2xlLmxvZygncDMnLCBzdGFydElkeCwgcmF3TmV3bGluZUlkeClcblx0XHRcdGNvbnN0IG5ld2xpbmVJZHggPSByYXdOZXdsaW5lSWR4ICsgc3RhcnRJZHg7XG5cdFx0XHRlbmRJZHggPSBNYXRoLm1pbihlbmRJZHgsIG5ld2xpbmVJZHgpXG5cdFx0fVxuXHR9XG5cblx0Ly8gLy8gaWYgYSBnZW5lcmF0ZWQgbGluZSBtYXRjaGVzIHdpdGggYSBzdWZmaXggbGluZSwgc3RvcFxuXHQvLyBpZiAoc3VmZml4TGluZXMubGVuZ3RoID4gMSkge1xuXHQvLyBcdGNvbnNvbGUubG9nKCc0Jylcblx0Ly8gXHRjb25zdCBsaW5lcyA9IFtdXG5cdC8vIFx0Zm9yIChjb25zdCBnZW5lcmF0ZWRMaW5lIG9mIGdlbmVyYXRlZExpbmVzKSB7XG5cdC8vIFx0XHRpZiAoc3VmZml4TGluZXMuc2xpY2UoMCwgMTApLnNvbWUoc3VmZml4TGluZSA9PlxuXHQvLyBcdFx0XHRnZW5lcmF0ZWRMaW5lLnRyaW0oKSAhPT0gJycgJiYgc3VmZml4TGluZS50cmltKCkgIT09ICcnXG5cdC8vIFx0XHRcdCYmIGdlbmVyYXRlZExpbmUudHJpbSgpLnN0YXJ0c1dpdGgoc3VmZml4TGluZS50cmltKCkpXG5cdC8vIFx0XHQpKSBicmVhaztcblx0Ly8gXHRcdGxpbmVzLnB1c2goZ2VuZXJhdGVkTGluZSlcblx0Ly8gXHR9XG5cdC8vIFx0ZW5kSWR4ID0gbGluZXMuam9pbignXFxuJykubGVuZ3RoIC8vIHRoaXMgaXMgaGFja3ksIHJlbW92ZSBvciByZWZhY3RvciBpbiBmdXR1cmVcblx0Ly8gfVxuXG5cdC8vIGNvbnNvbGUubG9nKCdwRmluYWwnLCBzdGFydElkeCwgZW5kSWR4KVxuXHRsZXQgY29tcGxldGlvblN0ciA9IGdlbmVyYXRlZE1pZGRsZS5zbGljZShzdGFydElkeCwgZW5kSWR4KVxuXG5cdC8vIGZpbHRlciBvdXQgdW5iYWxhbmNlZCBwYXJlbnRoZXNlc1xuXHRjb21wbGV0aW9uU3RyID0gZ2V0U3RyaW5nVXBUb1VuYmFsYW5jZWRDbG9zaW5nUGFyZW50aGVzaXMoY29tcGxldGlvblN0ciwgcHJlZml4KVxuXHQvLyBjb25zb2xlLmxvZygnb3JpZ2luYWxDb21wbGV0aW9uU3RyOiAnLCBKU09OLnN0cmluZ2lmeShnZW5lcmF0ZWRNaWRkbGUuc2xpY2Uoc3RhcnRJZHgpKSlcblx0Ly8gY29uc29sZS5sb2coJ2ZpbmFsQ29tcGxldGlvblN0cjogJywgSlNPTi5zdHJpbmdpZnkoY29tcGxldGlvblN0cikpXG5cblxuXHRyZXR1cm4gY29tcGxldGlvblN0clxuXG59XG5cbi8vIHJldHVybnMgdGhlIHRleHQgaW4gdGhlIGF1dG9jb21wbGV0aW9uIHRvIGRpc3BsYXksIGFzc3VtaW5nIHRoZSBwcmVmaXggaXMgYWxyZWFkeSBtYXRjaGVkXG5jb25zdCB0b0lubGluZUNvbXBsZXRpb25zID0gKHsgYXV0b2NvbXBsZXRpb25NYXRjaHVwLCBhdXRvY29tcGxldGlvbiwgcHJlZml4QW5kU3VmZml4LCBwb3NpdGlvbiwgZGVidWcgfTogeyBhdXRvY29tcGxldGlvbk1hdGNodXA6IEF1dG9jb21wbGV0aW9uTWF0Y2h1cEJvdW5kcywgYXV0b2NvbXBsZXRpb246IEF1dG9jb21wbGV0aW9uLCBwcmVmaXhBbmRTdWZmaXg6IFByZWZpeEFuZFN1ZmZpeEluZm8sIHBvc2l0aW9uOiBQb3NpdGlvbiwgZGVidWc/OiBib29sZWFuIH0pOiB7IGluc2VydFRleHQ6IHN0cmluZywgcmFuZ2U6IFJhbmdlIH1bXSA9PiB7XG5cblx0bGV0IHRyaW1tZWRJbnNlcnRUZXh0ID0gcG9zdHByb2Nlc3NBdXRvY29tcGxldGlvbih7IGF1dG9jb21wbGV0aW9uTWF0Y2h1cCwgYXV0b2NvbXBsZXRpb24sIHByZWZpeEFuZFN1ZmZpeCwgfSlcblx0bGV0IHJhbmdlVG9SZXBsYWNlOiBSYW5nZSA9IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbilcblxuXHQvLyBoYW5kbGUgc3BlY2lhbCBjYXNlc1xuXG5cdC8vIGlmIHdlIHJlZGlkIHRoZSBzdWZmaXgsIHJlcGxhY2UgdGhlIHN1ZmZpeFxuXHRpZiAoYXV0b2NvbXBsZXRpb24udHlwZSA9PT0gJ3NpbmdsZS1saW5lLXJlZG8tc3VmZml4Jykge1xuXG5cdFx0Y29uc3Qgb2xkU3VmZml4ID0gcHJlZml4QW5kU3VmZml4LnN1ZmZpeFRvVGhlUmlnaHRPZkN1cnNvclxuXHRcdGNvbnN0IG5ld1N1ZmZpeCA9IGF1dG9jb21wbGV0aW9uLmluc2VydFRleHRcblxuXHRcdGNvbnN0IFtpc1N1YnNlcXVlbmNlLCBsYXN0TWF0Y2hpbmdDaGFyXSA9IGdldElzU3Vic2VxdWVuY2UoeyAvLyBjaGVjayB0aGF0IHRoZSBvbGQgdGV4dCBjb250YWlucyB0aGUgc2FtZSBicmFja2V0cyArIHN5bWJvbHMgYXMgdGhlIG5ldyB0ZXh0XG5cdFx0XHRzdWJzZXF1ZW5jZTogcmVtb3ZlQWxsV2hpdGVzcGFjZShvbGRTdWZmaXgpLCAvLyBvbGQgc3VmZml4XG5cdFx0XHRvZjogcmVtb3ZlQWxsV2hpdGVzcGFjZShuZXdTdWZmaXgpLCAvLyBuZXcgc3VmZml4XG5cdFx0fSlcblx0XHRpZiAoaXNTdWJzZXF1ZW5jZSkge1xuXHRcdFx0cmFuZ2VUb1JlcGxhY2UgPSBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUilcblx0XHR9XG5cdFx0ZWxzZSB7XG5cblx0XHRcdGNvbnN0IGxhc3RNYXRjaHVwSWR4ID0gdHJpbW1lZEluc2VydFRleHQubGFzdEluZGV4T2YobGFzdE1hdGNoaW5nQ2hhcilcblx0XHRcdHRyaW1tZWRJbnNlcnRUZXh0ID0gdHJpbW1lZEluc2VydFRleHQuc2xpY2UoMCwgbGFzdE1hdGNodXBJZHggKyAxKVxuXHRcdFx0Y29uc3QgbnVtQ2hhcnNUb1JlcGxhY2UgPSBvbGRTdWZmaXgubGFzdEluZGV4T2YobGFzdE1hdGNoaW5nQ2hhcikgKyAxXG5cdFx0XHRyYW5nZVRvUmVwbGFjZSA9IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiArIG51bUNoYXJzVG9SZXBsYWNlKVxuXHRcdFx0Ly8gY29uc29sZS5sb2coJ3Nob3dfX19fJywgdHJpbW1lZEluc2VydFRleHQsIHJhbmdlVG9SZXBsYWNlKVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiBbe1xuXHRcdGluc2VydFRleHQ6IHRyaW1tZWRJbnNlcnRUZXh0LFxuXHRcdHJhbmdlOiByYW5nZVRvUmVwbGFjZSxcblx0fV1cblxufVxuXG5cblxuXG5cbi8vIHJldHVybnMgd2hldGhlciB0aGlzIGF1dG9jb21wbGV0aW9uIGlzIGluIHRoZSBjYWNoZVxuLy8gY29uc3QgZG9lc1ByZWZpeE1hdGNoQXV0b2NvbXBsZXRpb24gPSAoeyBwcmVmaXgsIGF1dG9jb21wbGV0aW9uIH06IHsgcHJlZml4OiBzdHJpbmcsIGF1dG9jb21wbGV0aW9uOiBBdXRvY29tcGxldGlvbiB9KTogYm9vbGVhbiA9PiB7XG5cbi8vIFx0Y29uc3Qgb3JpZ2luYWxQcmVmaXggPSBhdXRvY29tcGxldGlvbi5wcmVmaXhcbi8vIFx0Y29uc3QgZ2VuZXJhdGVkTWlkZGxlID0gYXV0b2NvbXBsZXRpb24ucmVzdWx0XG4vLyBcdGNvbnN0IG9yaWdpbmFsUHJlZml4VHJpbW1lZCA9IHRyaW1QcmVmaXgob3JpZ2luYWxQcmVmaXgpXG4vLyBcdGNvbnN0IGN1cnJlbnRQcmVmaXhUcmltbWVkID0gdHJpbVByZWZpeChwcmVmaXgpXG5cbi8vIFx0aWYgKGN1cnJlbnRQcmVmaXhUcmltbWVkLmxlbmd0aCA8IG9yaWdpbmFsUHJlZml4VHJpbW1lZC5sZW5ndGgpIHtcbi8vIFx0XHRyZXR1cm4gZmFsc2Vcbi8vIFx0fVxuXG4vLyBcdGNvbnN0IGlzTWF0Y2ggPSAob3JpZ2luYWxQcmVmaXhUcmltbWVkICsgZ2VuZXJhdGVkTWlkZGxlKS5zdGFydHNXaXRoKGN1cnJlbnRQcmVmaXhUcmltbWVkKVxuLy8gXHRyZXR1cm4gaXNNYXRjaFxuXG4vLyB9XG5cblxudHlwZSBQcmVmaXhBbmRTdWZmaXhJbmZvID0geyBwcmVmaXg6IHN0cmluZywgc3VmZml4OiBzdHJpbmcsIHByZWZpeExpbmVzOiBzdHJpbmdbXSwgc3VmZml4TGluZXM6IHN0cmluZ1tdLCBwcmVmaXhUb1RoZUxlZnRPZkN1cnNvcjogc3RyaW5nLCBzdWZmaXhUb1RoZVJpZ2h0T2ZDdXJzb3I6IHN0cmluZyB9XG5jb25zdCBnZXRQcmVmaXhBbmRTdWZmaXhJbmZvID0gKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24pOiBQcmVmaXhBbmRTdWZmaXhJbmZvID0+IHtcblxuXHRjb25zdCBmdWxsVGV4dCA9IG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpO1xuXG5cdGNvbnN0IGN1cnNvck9mZnNldCA9IG1vZGVsLmdldE9mZnNldEF0KHBvc2l0aW9uKVxuXHRjb25zdCBwcmVmaXggPSBmdWxsVGV4dC5zdWJzdHJpbmcoMCwgY3Vyc29yT2Zmc2V0KVxuXHRjb25zdCBzdWZmaXggPSBmdWxsVGV4dC5zdWJzdHJpbmcoY3Vyc29yT2Zmc2V0KVxuXG5cblx0Y29uc3QgcHJlZml4TGluZXMgPSBwcmVmaXguc3BsaXQoX2xuKVxuXHRjb25zdCBzdWZmaXhMaW5lcyA9IHN1ZmZpeC5zcGxpdChfbG4pXG5cblx0Y29uc3QgcHJlZml4VG9UaGVMZWZ0T2ZDdXJzb3IgPSBwcmVmaXhMaW5lcy5zbGljZSgtMSlbMF0gPz8gJydcblx0Y29uc3Qgc3VmZml4VG9UaGVSaWdodE9mQ3Vyc29yID0gc3VmZml4TGluZXNbMF0gPz8gJydcblxuXHRyZXR1cm4geyBwcmVmaXgsIHN1ZmZpeCwgcHJlZml4TGluZXMsIHN1ZmZpeExpbmVzLCBwcmVmaXhUb1RoZUxlZnRPZkN1cnNvciwgc3VmZml4VG9UaGVSaWdodE9mQ3Vyc29yIH1cblxufVxuXG5jb25zdCBnZXRJbmRleCA9IChzdHI6IHN0cmluZywgbGluZTogbnVtYmVyLCBjaGFyOiBudW1iZXIpID0+IHtcblx0cmV0dXJuIHN0ci5zcGxpdChfbG4pLnNsaWNlKDAsIGxpbmUpLmpvaW4oX2xuKS5sZW5ndGggKyAobGluZSA+IDAgPyAxIDogMCkgKyBjaGFyO1xufVxuY29uc3QgZ2V0TGFzdExpbmUgPSAoczogc3RyaW5nKTogc3RyaW5nID0+IHtcblx0Y29uc3QgbWF0Y2hlcyA9IHMubWF0Y2gobmV3IFJlZ0V4cChgW14ke19sbn1dKiRgKSlcblx0cmV0dXJuIG1hdGNoZXMgPyBtYXRjaGVzWzBdIDogJydcbn1cblxudHlwZSBBdXRvY29tcGxldGlvbk1hdGNodXBCb3VuZHMgPSB7XG5cdHN0YXJ0TGluZTogbnVtYmVyLFxuXHRzdGFydENoYXJhY3RlcjogbnVtYmVyLFxuXHRzdGFydElkeDogbnVtYmVyLFxufVxuLy8gcmV0dXJucyB0aGUgc3RhcnRJZHggb2YgdGhlIG1hdGNoIGlmIHRoZXJlIGlzIGEgbWF0Y2gsIG9yIHVuZGVmaW5lZCBpZiB0aGVyZSBpcyBubyBtYXRjaFxuLy8gYWxsIHJlc3VsdHMgYXJlIHdydCBgYXV0b2NvbXBsZXRpb24ucmVzdWx0YFxuY29uc3QgZ2V0QXV0b2NvbXBsZXRpb25NYXRjaHVwID0gKHsgcHJlZml4LCBhdXRvY29tcGxldGlvbiB9OiB7IHByZWZpeDogc3RyaW5nLCBhdXRvY29tcGxldGlvbjogQXV0b2NvbXBsZXRpb24gfSk6IEF1dG9jb21wbGV0aW9uTWF0Y2h1cEJvdW5kcyB8IHVuZGVmaW5lZCA9PiB7XG5cblx0Y29uc3QgdHJpbW1lZEN1cnJlbnRQcmVmaXggPSByZW1vdmVMZWZ0VGFic0FuZFRyaW1FbmRzKHByZWZpeClcblx0Y29uc3QgdHJpbW1lZENvbXBsZXRpb25QcmVmaXggPSByZW1vdmVMZWZ0VGFic0FuZFRyaW1FbmRzKGF1dG9jb21wbGV0aW9uLnByZWZpeClcblx0Y29uc3QgdHJpbW1lZENvbXBsZXRpb25NaWRkbGUgPSByZW1vdmVMZWZ0VGFic0FuZFRyaW1FbmRzKGF1dG9jb21wbGV0aW9uLmluc2VydFRleHQpXG5cblx0Ly8gY29uc29sZS5sb2coJ0ByZXN1bHQ6ICcsIEpTT04uc3RyaW5naWZ5KGF1dG9jb21wbGV0aW9uLmluc2VydFRleHQpKVxuXHQvLyBjb25zb2xlLmxvZygnQHRyaW1tZWRDdXJyZW50UHJlZml4OiAnLCBKU09OLnN0cmluZ2lmeSh0cmltbWVkQ3VycmVudFByZWZpeCkpXG5cdC8vIGNvbnNvbGUubG9nKCdAdHJpbW1lZENvbXBsZXRpb25QcmVmaXg6ICcsIEpTT04uc3RyaW5naWZ5KHRyaW1tZWRDb21wbGV0aW9uUHJlZml4KSlcblx0Ly8gY29uc29sZS5sb2coJ0B0cmltbWVkQ29tcGxldGlvbk1pZGRsZTogJywgSlNPTi5zdHJpbmdpZnkodHJpbW1lZENvbXBsZXRpb25NaWRkbGUpKVxuXG5cdGlmICh0cmltbWVkQ3VycmVudFByZWZpeC5sZW5ndGggPCB0cmltbWVkQ29tcGxldGlvblByZWZpeC5sZW5ndGgpIHsgLy8gdXNlciBtdXN0IHdyaXRlIHRleHQgYmV5b25kIHRoZSBvcmlnaW5hbCBwcmVmaXggYXQgZ2VuZXJhdGlvbiB0aW1lXG5cdFx0Ly8gY29uc29sZS5sb2coJ0B1bmRlZmluZWQxJylcblx0XHRyZXR1cm4gdW5kZWZpbmVkXG5cdH1cblxuXHRpZiAoIC8vIGNoZWNrIHRoYXQgY29tcGxldGlvbiBzdGFydHMgd2l0aCB0aGUgcHJlZml4XG5cdFx0ISh0cmltbWVkQ29tcGxldGlvblByZWZpeCArIHRyaW1tZWRDb21wbGV0aW9uTWlkZGxlKVxuXHRcdFx0LnN0YXJ0c1dpdGgodHJpbW1lZEN1cnJlbnRQcmVmaXgpXG5cdCkge1xuXHRcdC8vIGNvbnNvbGUubG9nKCdAdW5kZWZpbmVkMicpXG5cdFx0cmV0dXJuIHVuZGVmaW5lZFxuXHR9XG5cblx0Ly8gcmV2ZXJzZSBtYXAgdG8gZmluZCBwb3NpdGlvbiB3cnQgYGF1dG9jb21wbGV0aW9uLnJlc3VsdGBcblx0Y29uc3QgbGluZVN0YXJ0ID1cblx0XHR0cmltbWVkQ3VycmVudFByZWZpeC5zcGxpdChfbG4pLmxlbmd0aCAtXG5cdFx0dHJpbW1lZENvbXBsZXRpb25QcmVmaXguc3BsaXQoX2xuKS5sZW5ndGg7XG5cblx0aWYgKGxpbmVTdGFydCA8IDApIHtcblx0XHQvLyBjb25zb2xlLmxvZygnQHVuZGVmaW5lZDMnKVxuXG5cdFx0Y29uc29sZS5lcnJvcignRXJyb3I6IE5vIGxpbmUgZm91bmQuJyk7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRjb25zdCBjdXJyZW50UHJlZml4TGluZSA9IGdldExhc3RMaW5lKHRyaW1tZWRDdXJyZW50UHJlZml4KVxuXHRjb25zdCBjb21wbGV0aW9uUHJlZml4TGluZSA9IGxpbmVTdGFydCA9PT0gMCA/IGdldExhc3RMaW5lKHRyaW1tZWRDb21wbGV0aW9uUHJlZml4KSA6ICcnXG5cdGNvbnN0IGNvbXBsZXRpb25NaWRkbGVMaW5lID0gYXV0b2NvbXBsZXRpb24uaW5zZXJ0VGV4dC5zcGxpdChfbG4pW2xpbmVTdGFydF1cblx0Y29uc3QgZnVsbENvbXBsZXRpb25MaW5lID0gY29tcGxldGlvblByZWZpeExpbmUgKyBjb21wbGV0aW9uTWlkZGxlTGluZVxuXG5cdC8vIGNvbnNvbGUubG9nKCdjdXJyZW50UHJlZml4TGluZScsIGN1cnJlbnRQcmVmaXhMaW5lKVxuXHQvLyBjb25zb2xlLmxvZygnY29tcGxldGlvblByZWZpeExpbmUnLCBjb21wbGV0aW9uUHJlZml4TGluZSlcblx0Ly8gY29uc29sZS5sb2coJ2NvbXBsZXRpb25NaWRkbGVMaW5lJywgY29tcGxldGlvbk1pZGRsZUxpbmUpXG5cblx0Y29uc3QgY2hhck1hdGNoSWR4ID0gZnVsbENvbXBsZXRpb25MaW5lLmluZGV4T2YoY3VycmVudFByZWZpeExpbmUpXG5cdGlmIChjaGFyTWF0Y2hJZHggPCAwKSB7XG5cdFx0Ly8gY29uc29sZS5sb2coJ0B1bmRlZmluZWQ0JywgY2hhck1hdGNoSWR4KVxuXG5cdFx0Y29uc29sZS5lcnJvcignV2FybmluZzogRm91bmQgY2hhcmFjdGVyIHdpdGggbmVnYXRpdmUgaW5kZXguIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4nKVxuXHRcdHJldHVybiB1bmRlZmluZWRcblx0fVxuXG5cdGNvbnN0IGNoYXJhY3RlciA9IChjaGFyTWF0Y2hJZHggK1xuXHRcdGN1cnJlbnRQcmVmaXhMaW5lLmxlbmd0aFxuXHRcdC0gY29tcGxldGlvblByZWZpeExpbmUubGVuZ3RoXG5cdClcblxuXHRjb25zdCBzdGFydElkeCA9IGdldEluZGV4KGF1dG9jb21wbGV0aW9uLmluc2VydFRleHQsIGxpbmVTdGFydCwgY2hhcmFjdGVyKVxuXG5cdHJldHVybiB7XG5cdFx0c3RhcnRMaW5lOiBsaW5lU3RhcnQsXG5cdFx0c3RhcnRDaGFyYWN0ZXI6IGNoYXJhY3Rlcixcblx0XHRzdGFydElkeCxcblx0fVxuXG5cbn1cblxuXG50eXBlIENvbXBsZXRpb25PcHRpb25zID0ge1xuXHRwcmVkaWN0aW9uVHlwZTogQXV0b2NvbXBsZXRpb25QcmVkaWN0aW9uVHlwZSxcblx0c2hvdWxkR2VuZXJhdGU6IGJvb2xlYW4sXG5cdGxsbVByZWZpeDogc3RyaW5nLFxuXHRsbG1TdWZmaXg6IHN0cmluZyxcblx0c3RvcFRva2Vuczogc3RyaW5nW10sXG59XG5jb25zdCBnZXRDb21wbGV0aW9uT3B0aW9ucyA9IChwcmVmaXhBbmRTdWZmaXg6IFByZWZpeEFuZFN1ZmZpeEluZm8sIHJlbGV2YW50Q29udGV4dDogc3RyaW5nLCBqdXN0QWNjZXB0ZWRBdXRvY29tcGxldGlvbjogYm9vbGVhbik6IENvbXBsZXRpb25PcHRpb25zID0+IHtcblxuXHRsZXQgeyBwcmVmaXgsIHN1ZmZpeCwgcHJlZml4VG9UaGVMZWZ0T2ZDdXJzb3IsIHN1ZmZpeFRvVGhlUmlnaHRPZkN1cnNvciwgc3VmZml4TGluZXMsIHByZWZpeExpbmVzIH0gPSBwcmVmaXhBbmRTdWZmaXhcblxuXHQvLyB0cmltIHByZWZpeCBhbmQgc3VmZml4IHRvIG5vdCBiZSB2ZXJ5IGxhcmdlXG5cdHN1ZmZpeExpbmVzID0gc3VmZml4LnNwbGl0KF9sbikuc2xpY2UoMCwgMjUpXG5cdHByZWZpeExpbmVzID0gcHJlZml4LnNwbGl0KF9sbikuc2xpY2UoLTI1KVxuXHRwcmVmaXggPSBwcmVmaXhMaW5lcy5qb2luKF9sbilcblx0c3VmZml4ID0gc3VmZml4TGluZXMuam9pbihfbG4pXG5cblx0bGV0IGNvbXBsZXRpb25PcHRpb25zOiBDb21wbGV0aW9uT3B0aW9uc1xuXG5cdC8vIGlmIGxpbmUgaXMgZW1wdHksIGRvIG11bHRpbGluZSBjb21wbGV0aW9uXG5cdGNvbnN0IGlzTGluZUVtcHR5ID0gIXByZWZpeFRvVGhlTGVmdE9mQ3Vyc29yLnRyaW0oKSAmJiAhc3VmZml4VG9UaGVSaWdodE9mQ3Vyc29yLnRyaW0oKVxuXHRjb25zdCBpc0xpbmVQcmVmaXhFbXB0eSA9IHJlbW92ZUFsbFdoaXRlc3BhY2UocHJlZml4VG9UaGVMZWZ0T2ZDdXJzb3IpLmxlbmd0aCA9PT0gMFxuXHRjb25zdCBpc0xpbmVTdWZmaXhFbXB0eSA9IHJlbW92ZUFsbFdoaXRlc3BhY2Uoc3VmZml4VG9UaGVSaWdodE9mQ3Vyc29yKS5sZW5ndGggPT09IDBcblxuXHQvLyBUT0RPIGFkZCBjb250ZXh0IHRvIHByZWZpeFxuXHQvLyBsbG1QcmVmaXggPSAnXFxuXFxuLyogUmVsZXZhbnQgY29udGV4dDpcXG4nICsgcmVsZXZhbnRDb250ZXh0ICsgJ1xcbiovXFxuJyArIGxsbVByZWZpeFxuXG5cdC8vIGlmIHdlIGp1c3QgYWNjZXB0ZWQgYW4gYXV0b2NvbXBsZXRpb24sIHByZWRpY3QgYSBtdWx0aWxpbmUgY29tcGxldGlvbiBzdGFydGluZyBvbiB0aGUgbmV4dCBsaW5lXG5cdGlmIChqdXN0QWNjZXB0ZWRBdXRvY29tcGxldGlvbiAmJiBpc0xpbmVTdWZmaXhFbXB0eSkge1xuXHRcdGNvbnN0IHByZWZpeFdpdGhOZXdsaW5lID0gcHJlZml4ICsgX2xuXG5cdFx0Y29tcGxldGlvbk9wdGlvbnMgPSB7XG5cdFx0XHRwcmVkaWN0aW9uVHlwZTogJ211bHRpLWxpbmUtc3RhcnQtb24tbmV4dC1saW5lJyxcblx0XHRcdHNob3VsZEdlbmVyYXRlOiB0cnVlLFxuXHRcdFx0bGxtUHJlZml4OiBwcmVmaXhXaXRoTmV3bGluZSxcblx0XHRcdGxsbVN1ZmZpeDogc3VmZml4LFxuXHRcdFx0c3RvcFRva2VuczogW2Ake19sbn0ke19sbn1gXSAvLyBkb3VibGUgbmV3bGluZXNcblx0XHR9XG5cdH1cblx0Ly8gaWYgdGhlIGN1cnJlbnQgbGluZSBpcyBlbXB0eSwgcHJlZGljdCBhIHNpbmdsZS1saW5lIGNvbXBsZXRpb25cblx0ZWxzZSBpZiAoaXNMaW5lRW1wdHkpIHtcblx0XHRjb21wbGV0aW9uT3B0aW9ucyA9IHtcblx0XHRcdHByZWRpY3Rpb25UeXBlOiAnc2luZ2xlLWxpbmUtZmlsbC1taWRkbGUnLFxuXHRcdFx0c2hvdWxkR2VuZXJhdGU6IHRydWUsXG5cdFx0XHRsbG1QcmVmaXg6IHByZWZpeCxcblx0XHRcdGxsbVN1ZmZpeDogc3VmZml4LFxuXHRcdFx0c3RvcFRva2VuczogYWxsTGluZWJyZWFrU3ltYm9sc1xuXHRcdH1cblx0fVxuXHQvLyBpZiBzdWZmaXggaXMgMyBvciBmZXdlciBjaGFyYWN0ZXJzLCBhdHRlbXB0IHRvIGNvbXBsZXRlIHRoZSBsaW5lIGlnbm9ybmluZyBpdFxuXHRlbHNlIGlmIChyZW1vdmVBbGxXaGl0ZXNwYWNlKHN1ZmZpeFRvVGhlUmlnaHRPZkN1cnNvcikubGVuZ3RoIDw9IDMpIHtcblx0XHRjb25zdCBzdWZmaXhMaW5lc0lnbm9yaW5nVGhpc0xpbmUgPSBzdWZmaXhMaW5lcy5zbGljZSgxKVxuXHRcdGNvbnN0IHN1ZmZpeFN0cmluZ0lnbm9yaW5nVGhpc0xpbmUgPSBzdWZmaXhMaW5lc0lnbm9yaW5nVGhpc0xpbmUubGVuZ3RoID09PSAwID8gJycgOiBfbG4gKyBzdWZmaXhMaW5lc0lnbm9yaW5nVGhpc0xpbmUuam9pbihfbG4pXG5cdFx0Y29tcGxldGlvbk9wdGlvbnMgPSB7XG5cdFx0XHRwcmVkaWN0aW9uVHlwZTogJ3NpbmdsZS1saW5lLXJlZG8tc3VmZml4Jyxcblx0XHRcdHNob3VsZEdlbmVyYXRlOiB0cnVlLFxuXHRcdFx0bGxtUHJlZml4OiBwcmVmaXgsXG5cdFx0XHRsbG1TdWZmaXg6IHN1ZmZpeFN0cmluZ0lnbm9yaW5nVGhpc0xpbmUsXG5cdFx0XHRzdG9wVG9rZW5zOiBhbGxMaW5lYnJlYWtTeW1ib2xzXG5cdFx0fVxuXHR9XG5cdC8vIGVsc2UgYXR0ZW1wdCB0byBjb21wbGV0ZSB0aGUgbWlkZGxlIG9mIHRoZSBsaW5lIGlmIHRoZXJlIGlzIGEgcHJlZml4ICh0aGUgY29tcGxldGlvbiBsb29rcyBiYWQgaWYgdGhlcmUgaXMgbm8gcHJlZml4KVxuXHRlbHNlIGlmICghaXNMaW5lUHJlZml4RW1wdHkpIHtcblx0XHRjb21wbGV0aW9uT3B0aW9ucyA9IHtcblx0XHRcdHByZWRpY3Rpb25UeXBlOiAnc2luZ2xlLWxpbmUtZmlsbC1taWRkbGUnLFxuXHRcdFx0c2hvdWxkR2VuZXJhdGU6IHRydWUsXG5cdFx0XHRsbG1QcmVmaXg6IHByZWZpeCxcblx0XHRcdGxsbVN1ZmZpeDogc3VmZml4LFxuXHRcdFx0c3RvcFRva2VuczogYWxsTGluZWJyZWFrU3ltYm9sc1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRjb21wbGV0aW9uT3B0aW9ucyA9IHtcblx0XHRcdHByZWRpY3Rpb25UeXBlOiAnZG8tbm90LXByZWRpY3QnLFxuXHRcdFx0c2hvdWxkR2VuZXJhdGU6IGZhbHNlLFxuXHRcdFx0bGxtUHJlZml4OiBwcmVmaXgsXG5cdFx0XHRsbG1TdWZmaXg6IHN1ZmZpeCxcblx0XHRcdHN0b3BUb2tlbnM6IFtdXG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGNvbXBsZXRpb25PcHRpb25zXG5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQXV0b2NvbXBsZXRlU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNvbnN0IElBdXRvY29tcGxldGVTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElBdXRvY29tcGxldGVTZXJ2aWNlPignQXV0b2NvbXBsZXRlU2VydmljZScpO1xuXG5leHBvcnQgY2xhc3MgQXV0b2NvbXBsZXRlU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQXV0b2NvbXBsZXRlU2VydmljZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3ZvaWQuYXV0b2NvbXBsZXRlU2VydmljZSdcblxuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfYXV0b2NvbXBsZXRpb25JZDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfYXV0b2NvbXBsZXRpb25zT2ZEb2N1bWVudDogeyBbZG9jVXJpU3RyOiBzdHJpbmddOiBMUlVDYWNoZTxudW1iZXIsIEF1dG9jb21wbGV0aW9uPiB9ID0ge31cblxuXHRwcml2YXRlIF9sYXN0Q29tcGxldGlvblN0YXJ0ID0gMFxuXHRwcml2YXRlIF9sYXN0Q29tcGxldGlvbkFjY2VwdCA9IDBcblx0Ly8gcHJpdmF0ZSBfbGFzdFByZWZpeDogc3RyaW5nID0gJydcblxuXHQvLyB1c2VkIGludGVybmFsbHkgYnkgdnNjb2RlXG5cdC8vIGZpcmVzIGFmdGVyIGV2ZXJ5IGtleXN0cm9rZSBhbmQgcmV0dXJucyB0aGUgY29tcGxldGlvbiB0byBzaG93XG5cdGFzeW5jIF9wcm92aWRlSW5saW5lQ29tcGxldGlvbkl0ZW1zKFxuXHRcdG1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHBvc2l0aW9uOiBQb3NpdGlvbixcblx0KTogUHJvbWlzZTxJbmxpbmVDb21wbGV0aW9uW10+IHtcblxuXHRcdGNvbnN0IGlzRW5hYmxlZCA9IHRoaXMuX3NldHRpbmdzU2VydmljZS5zdGF0ZS5nbG9iYWxTZXR0aW5ncy5lbmFibGVBdXRvY29tcGxldGVcblx0XHRpZiAoIWlzRW5hYmxlZCkgcmV0dXJuIFtdXG5cblx0XHRjb25zdCB0ZXN0TW9kZSA9IGZhbHNlXG5cblx0XHRjb25zdCBkb2NVcmlTdHIgPSBtb2RlbC51cmkuZnNQYXRoO1xuXG5cdFx0Y29uc3QgcHJlZml4QW5kU3VmZml4ID0gZ2V0UHJlZml4QW5kU3VmZml4SW5mbyhtb2RlbCwgcG9zaXRpb24pXG5cdFx0Y29uc3QgeyBwcmVmaXgsIHN1ZmZpeCB9ID0gcHJlZml4QW5kU3VmZml4XG5cblx0XHQvLyBpbml0aWFsaXplIGNhY2hlIGlmIGl0IGRvZXNudCBleGlzdFxuXHRcdC8vIG5vdGUgdGhhdCB3aGVuZXZlciBhbiBhdXRvY29tcGxldGlvbiBpcyBhY2NlcHRlZCwgaXQgaXMgcmVtb3ZlZCBmcm9tIGNhY2hlXG5cdFx0aWYgKCF0aGlzLl9hdXRvY29tcGxldGlvbnNPZkRvY3VtZW50W2RvY1VyaVN0cl0pIHtcblx0XHRcdHRoaXMuX2F1dG9jb21wbGV0aW9uc09mRG9jdW1lbnRbZG9jVXJpU3RyXSA9IG5ldyBMUlVDYWNoZTxudW1iZXIsIEF1dG9jb21wbGV0aW9uPihcblx0XHRcdFx0TUFYX0NBQ0hFX1NJWkUsXG5cdFx0XHRcdChhdXRvY29tcGxldGlvbjogQXV0b2NvbXBsZXRpb24pID0+IHtcblx0XHRcdFx0XHRpZiAoYXV0b2NvbXBsZXRpb24ucmVxdWVzdElkKVxuXHRcdFx0XHRcdFx0dGhpcy5fbGxtTWVzc2FnZVNlcnZpY2UuYWJvcnQoYXV0b2NvbXBsZXRpb24ucmVxdWVzdElkKVxuXHRcdFx0XHR9XG5cdFx0XHQpXG5cdFx0fVxuXHRcdC8vIHRoaXMuX2xhc3RQcmVmaXggPSBwcmVmaXhcblxuXHRcdC8vIHByaW50IGFsbCBwZW5kaW5nIGF1dG9jb21wbGV0aW9uc1xuXHRcdC8vIGxldCBfbnVtUGVuZGluZyA9IDBcblx0XHQvLyB0aGlzLl9hdXRvY29tcGxldGlvbnNPZkRvY3VtZW50W2RvY1VyaVN0cl0uaXRlbXMuZm9yRWFjaCgoYTogQXV0b2NvbXBsZXRpb24pID0+IHsgaWYgKGEuc3RhdHVzID09PSAncGVuZGluZycpIF9udW1QZW5kaW5nICs9IDEgfSlcblx0XHQvLyBjb25zb2xlLmxvZygnQG51bVBlbmRpbmc6ICcgKyBfbnVtUGVuZGluZylcblxuXHRcdC8vIGdldCBhdXRvY29tcGxldGlvbiBmcm9tIGNhY2hlXG5cdFx0bGV0IGNhY2hlZEF1dG9jb21wbGV0aW9uOiBBdXRvY29tcGxldGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXHRcdGxldCBhdXRvY29tcGxldGlvbk1hdGNodXA6IEF1dG9jb21wbGV0aW9uTWF0Y2h1cEJvdW5kcyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXHRcdGZvciAoY29uc3QgYXV0b2NvbXBsZXRpb24gb2YgdGhpcy5fYXV0b2NvbXBsZXRpb25zT2ZEb2N1bWVudFtkb2NVcmlTdHJdLml0ZW1zLnZhbHVlcygpKSB7XG5cdFx0XHQvLyBpZiB0aGUgdXNlcidzIGNoYW5nZSBtYXRjaGVzIHdpdGggdGhlIGF1dG9jb21wbGV0aW9uXG5cdFx0XHRhdXRvY29tcGxldGlvbk1hdGNodXAgPSBnZXRBdXRvY29tcGxldGlvbk1hdGNodXAoeyBwcmVmaXgsIGF1dG9jb21wbGV0aW9uIH0pXG5cdFx0XHRpZiAoYXV0b2NvbXBsZXRpb25NYXRjaHVwICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y2FjaGVkQXV0b2NvbXBsZXRpb24gPSBhdXRvY29tcGxldGlvblxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBpZiB0aGVyZSBpcyBhIGNhY2hlZCBhdXRvY29tcGxldGlvbiwgcmV0dXJuIGl0XG5cdFx0aWYgKGNhY2hlZEF1dG9jb21wbGV0aW9uICYmIGF1dG9jb21wbGV0aW9uTWF0Y2h1cCkge1xuXG5cdFx0XHRjb25zb2xlLmxvZygnQUEnKVxuXG5cblx0XHRcdC8vIGNvbnNvbGUubG9nKCdpZDogJyArIGNhY2hlZEF1dG9jb21wbGV0aW9uLmlkKVxuXG5cdFx0XHRpZiAoY2FjaGVkQXV0b2NvbXBsZXRpb24uc3RhdHVzID09PSAnZmluaXNoZWQnKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdBMScpXG5cblx0XHRcdFx0Y29uc3QgaW5saW5lQ29tcGxldGlvbnMgPSB0b0lubGluZUNvbXBsZXRpb25zKHsgYXV0b2NvbXBsZXRpb25NYXRjaHVwLCBhdXRvY29tcGxldGlvbjogY2FjaGVkQXV0b2NvbXBsZXRpb24sIHByZWZpeEFuZFN1ZmZpeCwgcG9zaXRpb24sIGRlYnVnOiB0cnVlIH0pXG5cdFx0XHRcdHJldHVybiBpbmxpbmVDb21wbGV0aW9uc1xuXG5cdFx0XHR9IGVsc2UgaWYgKGNhY2hlZEF1dG9jb21wbGV0aW9uLnN0YXR1cyA9PT0gJ3BlbmRpbmcnKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKCdBMicpXG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBjYWNoZWRBdXRvY29tcGxldGlvbi5sbG1Qcm9taXNlO1xuXHRcdFx0XHRcdGNvbnN0IGlubGluZUNvbXBsZXRpb25zID0gdG9JbmxpbmVDb21wbGV0aW9ucyh7IGF1dG9jb21wbGV0aW9uTWF0Y2h1cCwgYXV0b2NvbXBsZXRpb246IGNhY2hlZEF1dG9jb21wbGV0aW9uLCBwcmVmaXhBbmRTdWZmaXgsIHBvc2l0aW9uIH0pXG5cdFx0XHRcdFx0cmV0dXJuIGlubGluZUNvbXBsZXRpb25zXG5cblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHRoaXMuX2F1dG9jb21wbGV0aW9uc09mRG9jdW1lbnRbZG9jVXJpU3RyXS5kZWxldGUoY2FjaGVkQXV0b2NvbXBsZXRpb24uaWQpXG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3IgY3JlYXRpbmcgYXV0b2NvbXBsZXRpb24gKDEpOiAnICsgZSlcblx0XHRcdFx0fVxuXG5cdFx0XHR9IGVsc2UgaWYgKGNhY2hlZEF1dG9jb21wbGV0aW9uLnN0YXR1cyA9PT0gJ2Vycm9yJykge1xuXHRcdFx0XHRjb25zb2xlLmxvZygnQTMnKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS5sb2coJ0E0Jylcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIFtdXG5cdFx0fVxuXG5cdFx0Ly8gZWxzZSBpZiBubyBtb3JlIHR5cGluZyBoYXBwZW5zLCB0aGVuIGdvIGZvcndhcmRzIHdpdGggdGhlIHJlcXVlc3RcblxuXHRcdC8vIHdhaXQgREVCT1VOQ0VfVElNRSBmb3IgdGhlIHVzZXIgdG8gc3RvcCB0eXBpbmdcblx0XHRjb25zdCB0aGlzVGltZSA9IERhdGUubm93KClcblxuXHRcdGNvbnN0IGp1c3RBY2NlcHRlZEF1dG9jb21wbGV0aW9uID0gdGhpc1RpbWUgLSB0aGlzLl9sYXN0Q29tcGxldGlvbkFjY2VwdCA8IDUwMFxuXG5cdFx0dGhpcy5fbGFzdENvbXBsZXRpb25TdGFydCA9IHRoaXNUaW1lXG5cdFx0Y29uc3QgZGlkVHlwaW5nSGFwcGVuRHVyaW5nRGVib3VuY2UgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLl9sYXN0Q29tcGxldGlvblN0YXJ0ID09PSB0aGlzVGltZSkge1xuXHRcdFx0XHRcdHJlc29sdmUoZmFsc2UpXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSh0cnVlKVxuXHRcdFx0XHR9XG5cdFx0XHR9LCBERUJPVU5DRV9USU1FKVxuXHRcdClcblxuXHRcdC8vIGlmIG1vcmUgdHlwaW5nIGhhcHBlbmVkLCB0aGVuIGRvIG5vdCBnbyBmb3J3YXJkcyB3aXRoIHRoZSByZXF1ZXN0XG5cdFx0aWYgKGRpZFR5cGluZ0hhcHBlbkR1cmluZ0RlYm91bmNlKSB7XG5cdFx0XHRyZXR1cm4gW11cblx0XHR9XG5cblxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0b28gbWFueSBwZW5kaW5nIHJlcXVlc3RzLCBjYW5jZWwgdGhlIG9sZGVzdCBvbmVcblx0XHRsZXQgbnVtUGVuZGluZyA9IDBcblx0XHRsZXQgb2xkZXN0UGVuZGluZzogQXV0b2NvbXBsZXRpb24gfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcblx0XHRmb3IgKGNvbnN0IGF1dG9jb21wbGV0aW9uIG9mIHRoaXMuX2F1dG9jb21wbGV0aW9uc09mRG9jdW1lbnRbZG9jVXJpU3RyXS5pdGVtcy52YWx1ZXMoKSkge1xuXHRcdFx0aWYgKGF1dG9jb21wbGV0aW9uLnN0YXR1cyA9PT0gJ3BlbmRpbmcnKSB7XG5cdFx0XHRcdG51bVBlbmRpbmcgKz0gMVxuXHRcdFx0XHRpZiAob2xkZXN0UGVuZGluZyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0b2xkZXN0UGVuZGluZyA9IGF1dG9jb21wbGV0aW9uXG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG51bVBlbmRpbmcgPj0gTUFYX1BFTkRJTkdfUkVRVUVTVFMpIHtcblx0XHRcdFx0XHQvLyBjYW5jZWwgdGhlIG9sZGVzdCBwZW5kaW5nIHJlcXVlc3QgYW5kIHJlbW92ZSBpdCBmcm9tIGNhY2hlXG5cdFx0XHRcdFx0dGhpcy5fYXV0b2NvbXBsZXRpb25zT2ZEb2N1bWVudFtkb2NVcmlTdHJdLmRlbGV0ZShvbGRlc3RQZW5kaW5nLmlkKVxuXHRcdFx0XHRcdGJyZWFrXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdC8vIGdhdGhlciByZWxldmFudCBjb250ZXh0IGZyb20gdGhlIGNvZGUgYXJvdW5kIHRoZSB1c2VyJ3Mgc2VsZWN0aW9uIGFuZCBkZWZpbml0aW9uc1xuXHRcdC8vIGNvbnN0IHJlbGV2YW50U25pcHBldHNMaXN0ID0gYXdhaXQgdGhpcy5fY29udGV4dEdhdGhlcmluZ1NlcnZpY2UucmVhZENhY2hlZFNuaXBwZXRzKG1vZGVsLCBwb3NpdGlvbiwgMyk7XG5cdFx0Ly8gY29uc3QgcmVsZXZhbnRTbmlwcGV0c0xpc3QgPSB0aGlzLl9jb250ZXh0R2F0aGVyaW5nU2VydmljZS5nZXRDYWNoZWRTbmlwcGV0cygpO1xuXHRcdC8vIGNvbnN0IHJlbGV2YW50U25pcHBldHMgPSByZWxldmFudFNuaXBwZXRzTGlzdC5tYXAoKHRleHQpID0+IGAke3RleHR9YCkuam9pbignXFxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxcbicpXG5cdFx0Ly8gY29uc29sZS5sb2coJ0BALS0tLS0tLS0tLS0tLS0tLS0tLS0tXFxuJyArIHJlbGV2YW50U25pcHBldHMpXG5cdFx0Y29uc3QgcmVsZXZhbnRDb250ZXh0ID0gJydcblxuXHRcdGNvbnN0IHsgc2hvdWxkR2VuZXJhdGUsIHByZWRpY3Rpb25UeXBlLCBsbG1QcmVmaXgsIGxsbVN1ZmZpeCwgc3RvcFRva2VucyB9ID0gZ2V0Q29tcGxldGlvbk9wdGlvbnMocHJlZml4QW5kU3VmZml4LCByZWxldmFudENvbnRleHQsIGp1c3RBY2NlcHRlZEF1dG9jb21wbGV0aW9uKVxuXG5cdFx0aWYgKCFzaG91bGRHZW5lcmF0ZSkgcmV0dXJuIFtdXG5cblx0XHRpZiAodGVzdE1vZGUgJiYgdGhpcy5fYXV0b2NvbXBsZXRpb25JZCAhPT0gMCkgeyAvLyBUT0RPIHJlbW92ZSB0aGlzXG5cdFx0XHRyZXR1cm4gW11cblx0XHR9XG5cblxuXG5cdFx0Ly8gY3JlYXRlIGEgbmV3IGF1dG9jb21wbGV0aW9uIGFuZCBhZGQgaXQgdG8gY2FjaGVcblx0XHRjb25zdCBuZXdBdXRvY29tcGxldGlvbjogQXV0b2NvbXBsZXRpb24gPSB7XG5cdFx0XHRpZDogdGhpcy5fYXV0b2NvbXBsZXRpb25JZCsrLFxuXHRcdFx0cHJlZml4OiBwcmVmaXgsIC8vIHRoZSBhY3R1YWwgcHJlZml4IGFuZCBzdWZmaXhcblx0XHRcdHN1ZmZpeDogc3VmZml4LFxuXHRcdFx0bGxtUHJlZml4OiBsbG1QcmVmaXgsIC8vIHRoZSBwcmVmaXggYW5kIHN1ZmZpeCB0aGUgbGxtIHNlZXNcblx0XHRcdGxsbVN1ZmZpeDogbGxtU3VmZml4LFxuXHRcdFx0c3RhcnRUaW1lOiBEYXRlLm5vdygpLFxuXHRcdFx0ZW5kVGltZTogdW5kZWZpbmVkLFxuXHRcdFx0dHlwZTogcHJlZGljdGlvblR5cGUsXG5cdFx0XHRzdGF0dXM6ICdwZW5kaW5nJyxcblx0XHRcdGxsbVByb21pc2U6IHVuZGVmaW5lZCxcblx0XHRcdGluc2VydFRleHQ6ICcnLFxuXHRcdFx0cmVxdWVzdElkOiBudWxsLFxuXHRcdFx0X25ld2xpbmVDb3VudDogMCxcblx0XHR9XG5cblx0XHRjb25zb2xlLmxvZygnc3RhcnRpbmcgYXV0b2NvbXBsZXRlLi4uJywgcHJlZGljdGlvblR5cGUpXG5cblx0XHRjb25zdCBmZWF0dXJlTmFtZTogRmVhdHVyZU5hbWUgPSAnQXV0b2NvbXBsZXRlJ1xuXHRcdGNvbnN0IG92ZXJyaWRlc09mTW9kZWwgPSB0aGlzLl9zZXR0aW5nc1NlcnZpY2Uuc3RhdGUub3ZlcnJpZGVzT2ZNb2RlbFxuXHRcdGNvbnN0IG1vZGVsU2VsZWN0aW9uID0gdGhpcy5fc2V0dGluZ3NTZXJ2aWNlLnN0YXRlLm1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlW2ZlYXR1cmVOYW1lXVxuXHRcdGNvbnN0IG1vZGVsU2VsZWN0aW9uT3B0aW9ucyA9IG1vZGVsU2VsZWN0aW9uID8gdGhpcy5fc2V0dGluZ3NTZXJ2aWNlLnN0YXRlLm9wdGlvbnNPZk1vZGVsU2VsZWN0aW9uW2ZlYXR1cmVOYW1lXVttb2RlbFNlbGVjdGlvbi5wcm92aWRlck5hbWVdPy5bbW9kZWxTZWxlY3Rpb24ubW9kZWxOYW1lXSA6IHVuZGVmaW5lZFxuXG5cdFx0Ly8gc2V0IHBhcmFtZXRlcnMgb2YgYG5ld0F1dG9jb21wbGV0aW9uYCBhcHByb3ByaWF0ZWx5XG5cdFx0bmV3QXV0b2NvbXBsZXRpb24ubGxtUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuXHRcdFx0Y29uc3QgcmVxdWVzdElkID0gdGhpcy5fbGxtTWVzc2FnZVNlcnZpY2Uuc2VuZExMTU1lc3NhZ2Uoe1xuXHRcdFx0XHRtZXNzYWdlc1R5cGU6ICdGSU1NZXNzYWdlJyxcblx0XHRcdFx0bWVzc2FnZXM6IHRoaXMuX2NvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlLnByZXBhcmVGSU1NZXNzYWdlKHtcblx0XHRcdFx0XHRtZXNzYWdlczoge1xuXHRcdFx0XHRcdFx0cHJlZml4OiBsbG1QcmVmaXgsXG5cdFx0XHRcdFx0XHRzdWZmaXg6IGxsbVN1ZmZpeCxcblx0XHRcdFx0XHRcdHN0b3BUb2tlbnM6IHN0b3BUb2tlbnMsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSxcblx0XHRcdFx0bW9kZWxTZWxlY3Rpb24sXG5cdFx0XHRcdG1vZGVsU2VsZWN0aW9uT3B0aW9ucyxcblx0XHRcdFx0b3ZlcnJpZGVzT2ZNb2RlbCxcblx0XHRcdFx0bG9nZ2luZzogeyBsb2dnaW5nTmFtZTogJ0F1dG9jb21wbGV0ZScgfSxcblx0XHRcdFx0b25UZXh0OiAoKSA9PiB7IH0sIC8vIHVudXNlZCBpbiBGSU1NZXNzYWdlXG5cdFx0XHRcdC8vIG9uVGV4dDogYXN5bmMgKHsgZnVsbFRleHQsIG5ld1RleHQgfSkgPT4ge1xuXG5cdFx0XHRcdC8vIFx0bmV3QXV0b2NvbXBsZXRpb24uaW5zZXJ0VGV4dCA9IGZ1bGxUZXh0XG5cblx0XHRcdFx0Ly8gXHQvLyBjb3VudCBuZXdsaW5lcyBpbiBuZXdUZXh0XG5cdFx0XHRcdC8vIFx0Y29uc3QgbnVtTmV3bGluZXMgPSBuZXdUZXh0Lm1hdGNoKC9cXG58XFxyXFxuL2cpPy5sZW5ndGggfHwgMFxuXHRcdFx0XHQvLyBcdG5ld0F1dG9jb21wbGV0aW9uLl9uZXdsaW5lQ291bnQgKz0gbnVtTmV3bGluZXNcblxuXHRcdFx0XHQvLyBcdC8vIGlmIHRvbyBtYW55IG5ld2xpbmVzLCByZXNvbHZlIHVwIHRvIGxhc3QgbmV3bGluZVxuXHRcdFx0XHQvLyBcdGlmIChuZXdBdXRvY29tcGxldGlvbi5fbmV3bGluZUNvdW50ID4gMTApIHtcblx0XHRcdFx0Ly8gXHRcdGNvbnN0IGxhc3ROZXdsaW5lUG9zID0gZnVsbFRleHQubGFzdEluZGV4T2YoJ1xcbicpXG5cdFx0XHRcdC8vIFx0XHRuZXdBdXRvY29tcGxldGlvbi5pbnNlcnRUZXh0ID0gZnVsbFRleHQuc3Vic3RyaW5nKDAsIGxhc3ROZXdsaW5lUG9zKVxuXHRcdFx0XHQvLyBcdFx0cmVzb2x2ZShuZXdBdXRvY29tcGxldGlvbi5pbnNlcnRUZXh0KVxuXHRcdFx0XHQvLyBcdFx0cmV0dXJuXG5cdFx0XHRcdC8vIFx0fVxuXG5cdFx0XHRcdC8vIFx0Ly8gaWYgKCFnZXRBdXRvY29tcGxldGlvbk1hdGNodXAoeyBwcmVmaXg6IHRoaXMuX2xhc3RQcmVmaXgsIGF1dG9jb21wbGV0aW9uOiBuZXdBdXRvY29tcGxldGlvbiB9KSkge1xuXHRcdFx0XHQvLyBcdC8vIFx0cmVqZWN0KCdMTE0gcmVzcG9uc2UgZGlkIG5vdCBtYXRjaCB1c2VyXFwncyB0ZXh0LicpXG5cdFx0XHRcdC8vIFx0Ly8gfVxuXHRcdFx0XHQvLyB9LFxuXHRcdFx0XHRvbkZpbmFsTWVzc2FnZTogKHsgZnVsbFRleHQgfSkgPT4ge1xuXG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ19fX19yZXM6ICcsIEpTT04uc3RyaW5naWZ5KG5ld0F1dG9jb21wbGV0aW9uLmluc2VydFRleHQpKVxuXG5cdFx0XHRcdFx0bmV3QXV0b2NvbXBsZXRpb24uZW5kVGltZSA9IERhdGUubm93KClcblx0XHRcdFx0XHRuZXdBdXRvY29tcGxldGlvbi5zdGF0dXMgPSAnZmluaXNoZWQnXG5cdFx0XHRcdFx0Y29uc3QgW3RleHQsIF9dID0gZXh0cmFjdENvZGVGcm9tUmVndWxhcih7IHRleHQ6IGZ1bGxUZXh0LCByZWNlbnRseUFkZGVkVGV4dExlbjogMCB9KVxuXHRcdFx0XHRcdG5ld0F1dG9jb21wbGV0aW9uLmluc2VydFRleHQgPSBwcm9jZXNzU3RhcnRBbmRFbmRTcGFjZXModGV4dClcblxuXHRcdFx0XHRcdC8vIGhhbmRsZSBzcGVjaWFsIGNhc2UgZm9yIHByZWRpY3Rpbmcgc3RhcnRpbmcgb24gdGhlIG5leHQgbGluZSwgYWRkIGEgbmV3bGluZSBjaGFyYWN0ZXJcblx0XHRcdFx0XHRpZiAobmV3QXV0b2NvbXBsZXRpb24udHlwZSA9PT0gJ211bHRpLWxpbmUtc3RhcnQtb24tbmV4dC1saW5lJykge1xuXHRcdFx0XHRcdFx0bmV3QXV0b2NvbXBsZXRpb24uaW5zZXJ0VGV4dCA9IF9sbiArIG5ld0F1dG9jb21wbGV0aW9uLmluc2VydFRleHRcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXNvbHZlKG5ld0F1dG9jb21wbGV0aW9uLmluc2VydFRleHQpXG5cblx0XHRcdFx0fSxcblx0XHRcdFx0b25FcnJvcjogKHsgbWVzc2FnZSB9KSA9PiB7XG5cdFx0XHRcdFx0bmV3QXV0b2NvbXBsZXRpb24uZW5kVGltZSA9IERhdGUubm93KClcblx0XHRcdFx0XHRuZXdBdXRvY29tcGxldGlvbi5zdGF0dXMgPSAnZXJyb3InXG5cdFx0XHRcdFx0cmVqZWN0KG1lc3NhZ2UpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9uQWJvcnQ6ICgpID0+IHsgcmVqZWN0KCdBYm9ydGVkIGF1dG9jb21wbGV0ZScpIH0sXG5cdFx0XHR9KVxuXHRcdFx0bmV3QXV0b2NvbXBsZXRpb24ucmVxdWVzdElkID0gcmVxdWVzdElkXG5cblx0XHRcdC8vIGlmIHRoZSByZXF1ZXN0IGhhc250IHJlc29sdmVkIGluIFRJTUVPVVRfVElNRSBzZWNvbmRzLCByZWplY3QgaXRcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRpZiAobmV3QXV0b2NvbXBsZXRpb24uc3RhdHVzID09PSAncGVuZGluZycpIHtcblx0XHRcdFx0XHRyZWplY3QoJ1RpbWVvdXQgcmVjZWl2aW5nIG1lc3NhZ2UgdG8gTExNLicpXG5cdFx0XHRcdH1cblx0XHRcdH0sIFRJTUVPVVRfVElNRSlcblxuXHRcdH0pXG5cblxuXG5cdFx0Ly8gYWRkIGF1dG9jb21wbGV0aW9uIHRvIGNhY2hlXG5cdFx0dGhpcy5fYXV0b2NvbXBsZXRpb25zT2ZEb2N1bWVudFtkb2NVcmlTdHJdLnNldChuZXdBdXRvY29tcGxldGlvbi5pZCwgbmV3QXV0b2NvbXBsZXRpb24pXG5cblx0XHQvLyBzaG93IGF1dG9jb21wbGV0aW9uXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IG5ld0F1dG9jb21wbGV0aW9uLmxsbVByb21pc2Vcblx0XHRcdC8vIGNvbnNvbGUubG9nKCdpZDogJyArIG5ld0F1dG9jb21wbGV0aW9uLmlkKVxuXG5cdFx0XHRjb25zdCBhdXRvY29tcGxldGlvbk1hdGNodXA6IEF1dG9jb21wbGV0aW9uTWF0Y2h1cEJvdW5kcyA9IHsgc3RhcnRJZHg6IDAsIHN0YXJ0TGluZTogMCwgc3RhcnRDaGFyYWN0ZXI6IDAgfVxuXHRcdFx0Y29uc3QgaW5saW5lQ29tcGxldGlvbnMgPSB0b0lubGluZUNvbXBsZXRpb25zKHsgYXV0b2NvbXBsZXRpb25NYXRjaHVwLCBhdXRvY29tcGxldGlvbjogbmV3QXV0b2NvbXBsZXRpb24sIHByZWZpeEFuZFN1ZmZpeCwgcG9zaXRpb24gfSlcblx0XHRcdHJldHVybiBpbmxpbmVDb21wbGV0aW9uc1xuXG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5fYXV0b2NvbXBsZXRpb25zT2ZEb2N1bWVudFtkb2NVcmlTdHJdLmRlbGV0ZShuZXdBdXRvY29tcGxldGlvbi5pZClcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIGF1dG9jb21wbGV0aW9uICgyKTogJyArIGUpXG5cdFx0XHRyZXR1cm4gW11cblx0XHR9XG5cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSBfbGFuZ0ZlYXR1cmVTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElMTE1NZXNzYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sbG1NZXNzYWdlU2VydmljZTogSUxMTU1lc3NhZ2VTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElWb2lkU2V0dGluZ3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3NldHRpbmdzU2VydmljZTogSVZvaWRTZXR0aW5nc1NlcnZpY2UsXG5cdFx0QElDb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZTogSUNvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlXG5cdFx0Ly8gQElDb250ZXh0R2F0aGVyaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0R2F0aGVyaW5nU2VydmljZTogSUNvbnRleHRHYXRoZXJpbmdTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpXG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9sYW5nRmVhdHVyZVNlcnZpY2UuaW5saW5lQ29tcGxldGlvbnNQcm92aWRlci5yZWdpc3RlcignKicsIHtcblx0XHRcdHByb3ZpZGVJbmxpbmVDb21wbGV0aW9uczogYXN5bmMgKG1vZGVsLCBwb3NpdGlvbiwgY29udGV4dCwgdG9rZW4pID0+IHtcblx0XHRcdFx0Y29uc3QgaXRlbXMgPSBhd2FpdCB0aGlzLl9wcm92aWRlSW5saW5lQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBwb3NpdGlvbilcblxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZygnaXRlbTogJywgaXRlbXM/LlswXT8uaW5zZXJ0VGV4dClcblx0XHRcdFx0cmV0dXJuIHsgaXRlbXM6IGl0ZW1zLCB9XG5cdFx0XHR9LFxuXHRcdFx0ZnJlZUlubGluZUNvbXBsZXRpb25zOiAoY29tcGxldGlvbnMpID0+IHtcblx0XHRcdFx0Ly8gZ2V0IHRoZSBgZG9jVXJpU3RyYCBhbmQgdGhlIGBwb3NpdGlvbmAgb2YgdGhlIGN1cnNvclxuXHRcdFx0XHRjb25zdCBhY3RpdmVQYW5lID0gdGhpcy5fZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRpZiAoIWFjdGl2ZVBhbmUpIHJldHVybjtcblx0XHRcdFx0Y29uc3QgY29udHJvbCA9IGFjdGl2ZVBhbmUuZ2V0Q29udHJvbCgpO1xuXHRcdFx0XHRpZiAoIWNvbnRyb2wgfHwgIWlzQ29kZUVkaXRvcihjb250cm9sKSkgcmV0dXJuO1xuXHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IGNvbnRyb2wuZ2V0UG9zaXRpb24oKTtcblx0XHRcdFx0aWYgKCFwb3NpdGlvbikgcmV0dXJuO1xuXHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0Q2Fub25pY2FsVXJpKHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yKTtcblx0XHRcdFx0aWYgKCFyZXNvdXJjZSkgcmV0dXJuO1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSlcblx0XHRcdFx0aWYgKCFtb2RlbCkgcmV0dXJuO1xuXHRcdFx0XHRjb25zdCBkb2NVcmlTdHIgPSByZXNvdXJjZS5mc1BhdGg7XG5cdFx0XHRcdGlmICghdGhpcy5fYXV0b2NvbXBsZXRpb25zT2ZEb2N1bWVudFtkb2NVcmlTdHJdKSByZXR1cm47XG5cblx0XHRcdFx0Y29uc3QgeyBwcmVmaXgsIH0gPSBnZXRQcmVmaXhBbmRTdWZmaXhJbmZvKG1vZGVsLCBwb3NpdGlvbilcblxuXHRcdFx0XHQvLyBnbyB0aHJvdWdoIGNhY2hlZCBpdGVtcyBhbmQgcmVtb3ZlIG1hdGNoaW5nIG9uZXNcblx0XHRcdFx0Ly8gYXV0b2NvbXBsZXRpb24ucHJlZml4ICsgYXV0b2NvbXBsZXRpb24uaW5zZXJ0ZWRUZXh0IH49PSBpbnNlcnRlZFRleHRcblx0XHRcdFx0dGhpcy5fYXV0b2NvbXBsZXRpb25zT2ZEb2N1bWVudFtkb2NVcmlTdHJdLml0ZW1zLmZvckVhY2goKGF1dG9jb21wbGV0aW9uOiBBdXRvY29tcGxldGlvbikgPT4ge1xuXG5cdFx0XHRcdFx0Ly8gd2UgY2FuIGRvIHRoaXMgbW9yZSBlZmZpY2llbnRseSwgSSBqdXN0IGRpZG4ndCB3YW50IHRvIGRlYWwgd2l0aCBhbGwgb2YgdGhlIGVkZ2UgY2FzZXNcblx0XHRcdFx0XHRjb25zdCBtYXRjaHVwID0gcmVtb3ZlQWxsV2hpdGVzcGFjZShwcmVmaXgpID09PSByZW1vdmVBbGxXaGl0ZXNwYWNlKGF1dG9jb21wbGV0aW9uLnByZWZpeCArIGF1dG9jb21wbGV0aW9uLmluc2VydFRleHQpXG5cblx0XHRcdFx0XHRpZiAobWF0Y2h1cCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0FDQ0VQVCcsIGF1dG9jb21wbGV0aW9uLmlkKVxuXHRcdFx0XHRcdFx0dGhpcy5fbGFzdENvbXBsZXRpb25BY2NlcHQgPSBEYXRlLm5vdygpXG5cdFx0XHRcdFx0XHR0aGlzLl9hdXRvY29tcGxldGlvbnNPZkRvY3VtZW50W2RvY1VyaVN0cl0uZGVsZXRlKGF1dG9jb21wbGV0aW9uLmlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9LFxuXHRcdH0pKVxuXHR9XG5cblxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoQXV0b2NvbXBsZXRlU2VydmljZS5JRCwgQXV0b2NvbXBsZXRlU2VydmljZSwgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcblxuXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQXVDO0FBR2hELFNBQVMsYUFBYTtBQUN0QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLGdDQUFnQyxzQkFBc0I7QUFDL0QsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyw0QkFBNEI7QUFFckMsU0FBUyxtQ0FBbUM7QUFLNUMsTUFBTSxz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
