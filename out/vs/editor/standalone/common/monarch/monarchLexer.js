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
import * as languages from "../../../common/languages.js";
import { NullState, nullTokenizeEncoded, nullTokenize } from "../../../common/languages/nullTokenize.js";
import * as monarchCommon from "./monarchCommon.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { LanguageId, MetadataConsts } from "../../../common/encodedTokenAttributes.js";
const CACHE_STACK_DEPTH = 5;
const _MonarchStackElementFactory = class _MonarchStackElementFactory {
  static create(parent, state) {
    return this._INSTANCE.create(parent, state);
  }
  constructor(maxCacheDepth) {
    this._maxCacheDepth = maxCacheDepth;
    this._entries = /* @__PURE__ */ Object.create(null);
  }
  create(parent, state) {
    if (parent !== null && parent.depth >= this._maxCacheDepth) {
      return new MonarchStackElement(parent, state);
    }
    let stackElementId = MonarchStackElement.getStackElementId(parent);
    if (stackElementId.length > 0) {
      stackElementId += "|";
    }
    stackElementId += state;
    let result = this._entries[stackElementId];
    if (result) {
      return result;
    }
    result = new MonarchStackElement(parent, state);
    this._entries[stackElementId] = result;
    return result;
  }
};
_MonarchStackElementFactory._INSTANCE = new _MonarchStackElementFactory(CACHE_STACK_DEPTH);
let MonarchStackElementFactory = _MonarchStackElementFactory;
class MonarchStackElement {
  constructor(parent, state) {
    this.parent = parent;
    this.state = state;
    this.depth = (this.parent ? this.parent.depth : 0) + 1;
  }
  static getStackElementId(element) {
    let result = "";
    while (element !== null) {
      if (result.length > 0) {
        result += "|";
      }
      result += element.state;
      element = element.parent;
    }
    return result;
  }
  static _equals(a, b) {
    while (a !== null && b !== null) {
      if (a === b) {
        return true;
      }
      if (a.state !== b.state) {
        return false;
      }
      a = a.parent;
      b = b.parent;
    }
    if (a === null && b === null) {
      return true;
    }
    return false;
  }
  equals(other) {
    return MonarchStackElement._equals(this, other);
  }
  push(state) {
    return MonarchStackElementFactory.create(this, state);
  }
  pop() {
    return this.parent;
  }
  popall() {
    let result = this;
    while (result.parent) {
      result = result.parent;
    }
    return result;
  }
  switchTo(state) {
    return MonarchStackElementFactory.create(this.parent, state);
  }
}
class EmbeddedLanguageData {
  constructor(languageId, state) {
    this.languageId = languageId;
    this.state = state;
  }
  equals(other) {
    return this.languageId === other.languageId && this.state.equals(other.state);
  }
  clone() {
    const stateClone = this.state.clone();
    if (stateClone === this.state) {
      return this;
    }
    return new EmbeddedLanguageData(this.languageId, this.state);
  }
}
const _MonarchLineStateFactory = class _MonarchLineStateFactory {
  static create(stack, embeddedLanguageData) {
    return this._INSTANCE.create(stack, embeddedLanguageData);
  }
  constructor(maxCacheDepth) {
    this._maxCacheDepth = maxCacheDepth;
    this._entries = /* @__PURE__ */ Object.create(null);
  }
  create(stack, embeddedLanguageData) {
    if (embeddedLanguageData !== null) {
      return new MonarchLineState(stack, embeddedLanguageData);
    }
    if (stack !== null && stack.depth >= this._maxCacheDepth) {
      return new MonarchLineState(stack, embeddedLanguageData);
    }
    const stackElementId = MonarchStackElement.getStackElementId(stack);
    let result = this._entries[stackElementId];
    if (result) {
      return result;
    }
    result = new MonarchLineState(stack, null);
    this._entries[stackElementId] = result;
    return result;
  }
};
_MonarchLineStateFactory._INSTANCE = new _MonarchLineStateFactory(CACHE_STACK_DEPTH);
let MonarchLineStateFactory = _MonarchLineStateFactory;
class MonarchLineState {
  constructor(stack, embeddedLanguageData) {
    this.stack = stack;
    this.embeddedLanguageData = embeddedLanguageData;
  }
  clone() {
    const embeddedlanguageDataClone = this.embeddedLanguageData ? this.embeddedLanguageData.clone() : null;
    if (embeddedlanguageDataClone === this.embeddedLanguageData) {
      return this;
    }
    return MonarchLineStateFactory.create(this.stack, this.embeddedLanguageData);
  }
  equals(other) {
    if (!(other instanceof MonarchLineState)) {
      return false;
    }
    if (!this.stack.equals(other.stack)) {
      return false;
    }
    if (this.embeddedLanguageData === null && other.embeddedLanguageData === null) {
      return true;
    }
    if (this.embeddedLanguageData === null || other.embeddedLanguageData === null) {
      return false;
    }
    return this.embeddedLanguageData.equals(other.embeddedLanguageData);
  }
}
class MonarchClassicTokensCollector {
  constructor() {
    this._tokens = [];
    this._languageId = null;
    this._lastTokenType = null;
    this._lastTokenLanguage = null;
  }
  enterLanguage(languageId) {
    this._languageId = languageId;
  }
  emit(startOffset, type) {
    if (this._lastTokenType === type && this._lastTokenLanguage === this._languageId) {
      return;
    }
    this._lastTokenType = type;
    this._lastTokenLanguage = this._languageId;
    this._tokens.push(new languages.Token(startOffset, type, this._languageId));
  }
  nestedLanguageTokenize(embeddedLanguageLine, hasEOL, embeddedLanguageData, offsetDelta) {
    const nestedLanguageId = embeddedLanguageData.languageId;
    const embeddedModeState = embeddedLanguageData.state;
    const nestedLanguageTokenizationSupport = languages.TokenizationRegistry.get(nestedLanguageId);
    if (!nestedLanguageTokenizationSupport) {
      this.enterLanguage(nestedLanguageId);
      this.emit(offsetDelta, "");
      return embeddedModeState;
    }
    const nestedResult = nestedLanguageTokenizationSupport.tokenize(embeddedLanguageLine, hasEOL, embeddedModeState);
    if (offsetDelta !== 0) {
      for (const token of nestedResult.tokens) {
        this._tokens.push(new languages.Token(token.offset + offsetDelta, token.type, token.language));
      }
    } else {
      this._tokens = this._tokens.concat(nestedResult.tokens);
    }
    this._lastTokenType = null;
    this._lastTokenLanguage = null;
    this._languageId = null;
    return nestedResult.endState;
  }
  finalize(endState) {
    return new languages.TokenizationResult(this._tokens, endState);
  }
}
class MonarchModernTokensCollector {
  constructor(languageService, theme) {
    this._languageService = languageService;
    this._theme = theme;
    this._prependTokens = null;
    this._tokens = [];
    this._currentLanguageId = LanguageId.Null;
    this._lastTokenMetadata = 0;
  }
  enterLanguage(languageId) {
    this._currentLanguageId = this._languageService.languageIdCodec.encodeLanguageId(languageId);
  }
  emit(startOffset, type) {
    const metadata = this._theme.match(this._currentLanguageId, type) | MetadataConsts.BALANCED_BRACKETS_MASK;
    if (this._lastTokenMetadata === metadata) {
      return;
    }
    this._lastTokenMetadata = metadata;
    this._tokens.push(startOffset);
    this._tokens.push(metadata);
  }
  static _merge(a, b, c) {
    const aLen = a !== null ? a.length : 0;
    const bLen = b.length;
    const cLen = c !== null ? c.length : 0;
    if (aLen === 0 && bLen === 0 && cLen === 0) {
      return new Uint32Array(0);
    }
    if (aLen === 0 && bLen === 0) {
      return c;
    }
    if (bLen === 0 && cLen === 0) {
      return a;
    }
    const result = new Uint32Array(aLen + bLen + cLen);
    if (a !== null) {
      result.set(a);
    }
    for (let i = 0; i < bLen; i++) {
      result[aLen + i] = b[i];
    }
    if (c !== null) {
      result.set(c, aLen + bLen);
    }
    return result;
  }
  nestedLanguageTokenize(embeddedLanguageLine, hasEOL, embeddedLanguageData, offsetDelta) {
    const nestedLanguageId = embeddedLanguageData.languageId;
    const embeddedModeState = embeddedLanguageData.state;
    const nestedLanguageTokenizationSupport = languages.TokenizationRegistry.get(nestedLanguageId);
    if (!nestedLanguageTokenizationSupport) {
      this.enterLanguage(nestedLanguageId);
      this.emit(offsetDelta, "");
      return embeddedModeState;
    }
    const nestedResult = nestedLanguageTokenizationSupport.tokenizeEncoded(embeddedLanguageLine, hasEOL, embeddedModeState);
    if (offsetDelta !== 0) {
      for (let i = 0, len = nestedResult.tokens.length; i < len; i += 2) {
        nestedResult.tokens[i] += offsetDelta;
      }
    }
    this._prependTokens = MonarchModernTokensCollector._merge(this._prependTokens, this._tokens, nestedResult.tokens);
    this._tokens = [];
    this._currentLanguageId = 0;
    this._lastTokenMetadata = 0;
    return nestedResult.endState;
  }
  finalize(endState) {
    return new languages.EncodedTokenizationResult(
      MonarchModernTokensCollector._merge(this._prependTokens, this._tokens, null),
      endState
    );
  }
}
let MonarchTokenizer = class extends Disposable {
  constructor(languageService, standaloneThemeService, languageId, lexer, _configurationService) {
    super();
    this._configurationService = _configurationService;
    this._languageService = languageService;
    this._standaloneThemeService = standaloneThemeService;
    this._languageId = languageId;
    this._lexer = lexer;
    this._embeddedLanguages = /* @__PURE__ */ Object.create(null);
    this.embeddedLoaded = Promise.resolve(void 0);
    let emitting = false;
    this._register(languages.TokenizationRegistry.onDidChange((e) => {
      if (emitting) {
        return;
      }
      let isOneOfMyEmbeddedModes = false;
      for (let i = 0, len = e.changedLanguages.length; i < len; i++) {
        const language = e.changedLanguages[i];
        if (this._embeddedLanguages[language]) {
          isOneOfMyEmbeddedModes = true;
          break;
        }
      }
      if (isOneOfMyEmbeddedModes) {
        emitting = true;
        languages.TokenizationRegistry.handleChange([this._languageId]);
        emitting = false;
      }
    }));
    this._maxTokenizationLineLength = this._configurationService.getValue("editor.maxTokenizationLineLength", {
      overrideIdentifier: this._languageId
    });
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.maxTokenizationLineLength")) {
        this._maxTokenizationLineLength = this._configurationService.getValue("editor.maxTokenizationLineLength", {
          overrideIdentifier: this._languageId
        });
      }
    }));
  }
  getLoadStatus() {
    const promises = [];
    for (const nestedLanguageId in this._embeddedLanguages) {
      const tokenizationSupport = languages.TokenizationRegistry.get(nestedLanguageId);
      if (tokenizationSupport) {
        if (tokenizationSupport instanceof MonarchTokenizer) {
          const nestedModeStatus = tokenizationSupport.getLoadStatus();
          if (nestedModeStatus.loaded === false) {
            promises.push(nestedModeStatus.promise);
          }
        }
        continue;
      }
      if (!languages.TokenizationRegistry.isResolved(nestedLanguageId)) {
        promises.push(languages.TokenizationRegistry.getOrCreate(nestedLanguageId));
      }
    }
    if (promises.length === 0) {
      return {
        loaded: true
      };
    }
    return {
      loaded: false,
      promise: Promise.all(promises).then((_) => void 0)
    };
  }
  getInitialState() {
    const rootState = MonarchStackElementFactory.create(null, this._lexer.start);
    return MonarchLineStateFactory.create(rootState, null);
  }
  tokenize(line, hasEOL, lineState) {
    if (line.length >= this._maxTokenizationLineLength) {
      return nullTokenize(this._languageId, lineState);
    }
    const tokensCollector = new MonarchClassicTokensCollector();
    const endLineState = this._tokenize(line, hasEOL, lineState, tokensCollector);
    return tokensCollector.finalize(endLineState);
  }
  tokenizeEncoded(line, hasEOL, lineState) {
    if (line.length >= this._maxTokenizationLineLength) {
      return nullTokenizeEncoded(this._languageService.languageIdCodec.encodeLanguageId(this._languageId), lineState);
    }
    const tokensCollector = new MonarchModernTokensCollector(this._languageService, this._standaloneThemeService.getColorTheme().tokenTheme);
    const endLineState = this._tokenize(line, hasEOL, lineState, tokensCollector);
    return tokensCollector.finalize(endLineState);
  }
  _tokenize(line, hasEOL, lineState, collector) {
    if (lineState.embeddedLanguageData) {
      return this._nestedTokenize(line, hasEOL, lineState, 0, collector);
    } else {
      return this._myTokenize(line, hasEOL, lineState, 0, collector);
    }
  }
  _findLeavingNestedLanguageOffset(line, state) {
    let rules = this._lexer.tokenizer[state.stack.state];
    if (!rules) {
      rules = monarchCommon.findRules(this._lexer, state.stack.state);
      if (!rules) {
        throw monarchCommon.createError(this._lexer, "tokenizer state is not defined: " + state.stack.state);
      }
    }
    let popOffset = -1;
    let hasEmbeddedPopRule = false;
    for (const rule of rules) {
      if (!monarchCommon.isIAction(rule.action) || rule.action.nextEmbedded !== "@pop") {
        continue;
      }
      hasEmbeddedPopRule = true;
      let regex = rule.resolveRegex(state.stack.state);
      const regexSource = regex.source;
      if (regexSource.substr(0, 4) === "^(?:" && regexSource.substr(regexSource.length - 1, 1) === ")") {
        const flags = (regex.ignoreCase ? "i" : "") + (regex.unicode ? "u" : "");
        regex = new RegExp(regexSource.substr(4, regexSource.length - 5), flags);
      }
      const result = line.search(regex);
      if (result === -1 || result !== 0 && rule.matchOnlyAtLineStart) {
        continue;
      }
      if (popOffset === -1 || result < popOffset) {
        popOffset = result;
      }
    }
    if (!hasEmbeddedPopRule) {
      throw monarchCommon.createError(this._lexer, 'no rule containing nextEmbedded: "@pop" in tokenizer embedded state: ' + state.stack.state);
    }
    return popOffset;
  }
  _nestedTokenize(line, hasEOL, lineState, offsetDelta, tokensCollector) {
    const popOffset = this._findLeavingNestedLanguageOffset(line, lineState);
    if (popOffset === -1) {
      const nestedEndState = tokensCollector.nestedLanguageTokenize(line, hasEOL, lineState.embeddedLanguageData, offsetDelta);
      return MonarchLineStateFactory.create(lineState.stack, new EmbeddedLanguageData(lineState.embeddedLanguageData.languageId, nestedEndState));
    }
    const nestedLanguageLine = line.substring(0, popOffset);
    if (nestedLanguageLine.length > 0) {
      tokensCollector.nestedLanguageTokenize(nestedLanguageLine, false, lineState.embeddedLanguageData, offsetDelta);
    }
    const restOfTheLine = line.substring(popOffset);
    return this._myTokenize(restOfTheLine, hasEOL, lineState, offsetDelta + popOffset, tokensCollector);
  }
  _safeRuleName(rule) {
    if (rule) {
      return rule.name;
    }
    return "(unknown)";
  }
  _myTokenize(lineWithoutLF, hasEOL, lineState, offsetDelta, tokensCollector) {
    tokensCollector.enterLanguage(this._languageId);
    const lineWithoutLFLength = lineWithoutLF.length;
    const line = hasEOL && this._lexer.includeLF ? lineWithoutLF + "\n" : lineWithoutLF;
    const lineLength = line.length;
    let embeddedLanguageData = lineState.embeddedLanguageData;
    let stack = lineState.stack;
    let pos = 0;
    let groupMatching = null;
    let forceEvaluation = true;
    while (forceEvaluation || pos < lineLength) {
      const pos0 = pos;
      const stackLen0 = stack.depth;
      const groupLen0 = groupMatching ? groupMatching.groups.length : 0;
      const state = stack.state;
      let matches = null;
      let matched = null;
      let action = null;
      let rule = null;
      let enteringEmbeddedLanguage = null;
      if (groupMatching) {
        matches = groupMatching.matches;
        const groupEntry = groupMatching.groups.shift();
        matched = groupEntry.matched;
        action = groupEntry.action;
        rule = groupMatching.rule;
        if (groupMatching.groups.length === 0) {
          groupMatching = null;
        }
      } else {
        if (!forceEvaluation && pos >= lineLength) {
          break;
        }
        forceEvaluation = false;
        let rules = this._lexer.tokenizer[state];
        if (!rules) {
          rules = monarchCommon.findRules(this._lexer, state);
          if (!rules) {
            throw monarchCommon.createError(this._lexer, "tokenizer state is not defined: " + state);
          }
        }
        const restOfLine = line.substr(pos);
        for (const rule2 of rules) {
          if (pos === 0 || !rule2.matchOnlyAtLineStart) {
            matches = restOfLine.match(rule2.resolveRegex(state));
            if (matches) {
              matched = matches[0];
              action = rule2.action;
              break;
            }
          }
        }
      }
      if (!matches) {
        matches = [""];
        matched = "";
      }
      if (!action) {
        if (pos < lineLength) {
          matches = [line.charAt(pos)];
          matched = matches[0];
        }
        action = this._lexer.defaultToken;
      }
      if (matched === null) {
        break;
      }
      pos += matched.length;
      while (monarchCommon.isFuzzyAction(action) && monarchCommon.isIAction(action) && action.test) {
        action = action.test(matched, matches, state, pos === lineLength);
      }
      let result = null;
      if (typeof action === "string" || Array.isArray(action)) {
        result = action;
      } else if (action.group) {
        result = action.group;
      } else if (action.token !== null && action.token !== void 0) {
        if (action.tokenSubst) {
          result = monarchCommon.substituteMatches(this._lexer, action.token, matched, matches, state);
        } else {
          result = action.token;
        }
        if (action.nextEmbedded) {
          if (action.nextEmbedded === "@pop") {
            if (!embeddedLanguageData) {
              throw monarchCommon.createError(this._lexer, "cannot pop embedded language if not inside one");
            }
            embeddedLanguageData = null;
          } else if (embeddedLanguageData) {
            throw monarchCommon.createError(this._lexer, "cannot enter embedded language from within an embedded language");
          } else {
            enteringEmbeddedLanguage = monarchCommon.substituteMatches(this._lexer, action.nextEmbedded, matched, matches, state);
          }
        }
        if (action.goBack) {
          pos = Math.max(0, pos - action.goBack);
        }
        if (action.switchTo && typeof action.switchTo === "string") {
          let nextState = monarchCommon.substituteMatches(this._lexer, action.switchTo, matched, matches, state);
          if (nextState[0] === "@") {
            nextState = nextState.substr(1);
          }
          if (!monarchCommon.findRules(this._lexer, nextState)) {
            throw monarchCommon.createError(this._lexer, "trying to switch to a state '" + nextState + "' that is undefined in rule: " + this._safeRuleName(rule));
          } else {
            stack = stack.switchTo(nextState);
          }
        } else if (action.transform && typeof action.transform === "function") {
          throw monarchCommon.createError(this._lexer, "action.transform not supported");
        } else if (action.next) {
          if (action.next === "@push") {
            if (stack.depth >= this._lexer.maxStack) {
              throw monarchCommon.createError(this._lexer, "maximum tokenizer stack size reached: [" + stack.state + "," + stack.parent.state + ",...]");
            } else {
              stack = stack.push(state);
            }
          } else if (action.next === "@pop") {
            if (stack.depth <= 1) {
              throw monarchCommon.createError(this._lexer, "trying to pop an empty stack in rule: " + this._safeRuleName(rule));
            } else {
              stack = stack.pop();
            }
          } else if (action.next === "@popall") {
            stack = stack.popall();
          } else {
            let nextState = monarchCommon.substituteMatches(this._lexer, action.next, matched, matches, state);
            if (nextState[0] === "@") {
              nextState = nextState.substr(1);
            }
            if (!monarchCommon.findRules(this._lexer, nextState)) {
              throw monarchCommon.createError(this._lexer, "trying to set a next state '" + nextState + "' that is undefined in rule: " + this._safeRuleName(rule));
            } else {
              stack = stack.push(nextState);
            }
          }
        }
        if (action.log && typeof action.log === "string") {
          monarchCommon.log(this._lexer, this._lexer.languageId + ": " + monarchCommon.substituteMatches(this._lexer, action.log, matched, matches, state));
        }
      }
      if (result === null) {
        throw monarchCommon.createError(this._lexer, "lexer rule has no well-defined action in rule: " + this._safeRuleName(rule));
      }
      const computeNewStateForEmbeddedLanguage = (enteringEmbeddedLanguage2) => {
        const languageId = this._languageService.getLanguageIdByLanguageName(enteringEmbeddedLanguage2) || this._languageService.getLanguageIdByMimeType(enteringEmbeddedLanguage2) || enteringEmbeddedLanguage2;
        const embeddedLanguageData2 = this._getNestedEmbeddedLanguageData(languageId);
        if (pos < lineLength) {
          const restOfLine = lineWithoutLF.substr(pos);
          return this._nestedTokenize(restOfLine, hasEOL, MonarchLineStateFactory.create(stack, embeddedLanguageData2), offsetDelta + pos, tokensCollector);
        } else {
          return MonarchLineStateFactory.create(stack, embeddedLanguageData2);
        }
      };
      if (Array.isArray(result)) {
        if (groupMatching && groupMatching.groups.length > 0) {
          throw monarchCommon.createError(this._lexer, "groups cannot be nested: " + this._safeRuleName(rule));
        }
        if (matches.length !== result.length + 1) {
          throw monarchCommon.createError(this._lexer, "matched number of groups does not match the number of actions in rule: " + this._safeRuleName(rule));
        }
        let totalLen = 0;
        for (let i = 1; i < matches.length; i++) {
          totalLen += matches[i].length;
        }
        if (totalLen !== matched.length) {
          throw monarchCommon.createError(this._lexer, "with groups, all characters should be matched in consecutive groups in rule: " + this._safeRuleName(rule));
        }
        groupMatching = {
          rule,
          matches,
          groups: []
        };
        for (let i = 0; i < result.length; i++) {
          groupMatching.groups[i] = {
            action: result[i],
            matched: matches[i + 1]
          };
        }
        pos -= matched.length;
        continue;
      } else {
        if (result === "@rematch") {
          pos -= matched.length;
          matched = "";
          matches = null;
          result = "";
          if (enteringEmbeddedLanguage !== null) {
            return computeNewStateForEmbeddedLanguage(enteringEmbeddedLanguage);
          }
        }
        if (matched.length === 0) {
          if (lineLength === 0 || stackLen0 !== stack.depth || state !== stack.state || (!groupMatching ? 0 : groupMatching.groups.length) !== groupLen0) {
            continue;
          } else {
            throw monarchCommon.createError(this._lexer, "no progress in tokenizer in rule: " + this._safeRuleName(rule));
          }
        }
        let tokenType = null;
        if (monarchCommon.isString(result) && result.indexOf("@brackets") === 0) {
          const rest = result.substr("@brackets".length);
          const bracket = findBracket(this._lexer, matched);
          if (!bracket) {
            throw monarchCommon.createError(this._lexer, "@brackets token returned but no bracket defined as: " + matched);
          }
          tokenType = monarchCommon.sanitize(bracket.token + rest);
        } else {
          const token = result === "" ? "" : result + this._lexer.tokenPostfix;
          tokenType = monarchCommon.sanitize(token);
        }
        if (pos0 < lineWithoutLFLength) {
          tokensCollector.emit(pos0 + offsetDelta, tokenType);
        }
      }
      if (enteringEmbeddedLanguage !== null) {
        return computeNewStateForEmbeddedLanguage(enteringEmbeddedLanguage);
      }
    }
    return MonarchLineStateFactory.create(stack, embeddedLanguageData);
  }
  _getNestedEmbeddedLanguageData(languageId) {
    if (!this._languageService.isRegisteredLanguageId(languageId)) {
      return new EmbeddedLanguageData(languageId, NullState);
    }
    if (languageId !== this._languageId) {
      this._languageService.requestBasicLanguageFeatures(languageId);
      languages.TokenizationRegistry.getOrCreate(languageId);
      this._embeddedLanguages[languageId] = true;
    }
    const tokenizationSupport = languages.TokenizationRegistry.get(languageId);
    if (tokenizationSupport) {
      return new EmbeddedLanguageData(languageId, tokenizationSupport.getInitialState());
    }
    return new EmbeddedLanguageData(languageId, NullState);
  }
};
MonarchTokenizer = __decorateClass([
  __decorateParam(4, IConfigurationService)
], MonarchTokenizer);
function findBracket(lexer, matched) {
  if (!matched) {
    return null;
  }
  matched = monarchCommon.fixCase(lexer, matched);
  const brackets = lexer.brackets;
  for (const bracket of brackets) {
    if (bracket.open === matched) {
      return { token: bracket.token, bracketType: monarchCommon.MonarchBracket.Open };
    } else if (bracket.close === matched) {
      return { token: bracket.token, bracketType: monarchCommon.MonarchBracket.Close };
    }
  }
  return null;
}
export {
  MonarchTokenizer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3Ivc3RhbmRhbG9uZS9jb21tb24vbW9uYXJjaC9tb25hcmNoTGV4ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4vKipcbiAqIENyZWF0ZSBhIHN5bnRheCBoaWdoaWdodGVyIHdpdGggYSBmdWxseSBkZWNsYXJhdGl2ZSBKU09OIHN0eWxlIGxleGVyIGRlc2NyaXB0aW9uXG4gKiB1c2luZyByZWd1bGFyIGV4cHJlc3Npb25zLlxuICovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIGxhbmd1YWdlcyBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IE51bGxTdGF0ZSwgbnVsbFRva2VuaXplRW5jb2RlZCwgbnVsbFRva2VuaXplIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9udWxsVG9rZW5pemUuanMnO1xuaW1wb3J0IHsgVG9rZW5UaGVtZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvc3VwcG9ydHMvdG9rZW5pemF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCAqIGFzIG1vbmFyY2hDb21tb24gZnJvbSAnLi9tb25hcmNoQ29tbW9uLmpzJztcbmltcG9ydCB7IElTdGFuZGFsb25lVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vc3RhbmRhbG9uZVRoZW1lLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VJZCwgTWV0YWRhdGFDb25zdHMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5cbmNvbnN0IENBQ0hFX1NUQUNLX0RFUFRIID0gNTtcblxuLyoqXG4gKiBSZXVzZSB0aGUgc2FtZSBzdGFjayBlbGVtZW50cyB1cCB0byBhIGNlcnRhaW4gZGVwdGguXG4gKi9cbmNsYXNzIE1vbmFyY2hTdGFja0VsZW1lbnRGYWN0b3J5IHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfSU5TVEFOQ0UgPSBuZXcgTW9uYXJjaFN0YWNrRWxlbWVudEZhY3RvcnkoQ0FDSEVfU1RBQ0tfREVQVEgpO1xuXHRwdWJsaWMgc3RhdGljIGNyZWF0ZShwYXJlbnQ6IE1vbmFyY2hTdGFja0VsZW1lbnQgfCBudWxsLCBzdGF0ZTogc3RyaW5nKTogTW9uYXJjaFN0YWNrRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX0lOU1RBTkNFLmNyZWF0ZShwYXJlbnQsIHN0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX21heENhY2hlRGVwdGg6IG51bWJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfZW50cmllczogeyBbc3RhY2tFbGVtZW50SWQ6IHN0cmluZ106IE1vbmFyY2hTdGFja0VsZW1lbnQgfTtcblxuXHRjb25zdHJ1Y3RvcihtYXhDYWNoZURlcHRoOiBudW1iZXIpIHtcblx0XHR0aGlzLl9tYXhDYWNoZURlcHRoID0gbWF4Q2FjaGVEZXB0aDtcblx0XHR0aGlzLl9lbnRyaWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGUocGFyZW50OiBNb25hcmNoU3RhY2tFbGVtZW50IHwgbnVsbCwgc3RhdGU6IHN0cmluZyk6IE1vbmFyY2hTdGFja0VsZW1lbnQge1xuXHRcdGlmIChwYXJlbnQgIT09IG51bGwgJiYgcGFyZW50LmRlcHRoID49IHRoaXMuX21heENhY2hlRGVwdGgpIHtcblx0XHRcdC8vIG5vIGNhY2hpbmcgYWJvdmUgYSBjZXJ0YWluIGRlcHRoXG5cdFx0XHRyZXR1cm4gbmV3IE1vbmFyY2hTdGFja0VsZW1lbnQocGFyZW50LCBzdGF0ZSk7XG5cdFx0fVxuXHRcdGxldCBzdGFja0VsZW1lbnRJZCA9IE1vbmFyY2hTdGFja0VsZW1lbnQuZ2V0U3RhY2tFbGVtZW50SWQocGFyZW50KTtcblx0XHRpZiAoc3RhY2tFbGVtZW50SWQubGVuZ3RoID4gMCkge1xuXHRcdFx0c3RhY2tFbGVtZW50SWQgKz0gJ3wnO1xuXHRcdH1cblx0XHRzdGFja0VsZW1lbnRJZCArPSBzdGF0ZTtcblxuXHRcdGxldCByZXN1bHQgPSB0aGlzLl9lbnRyaWVzW3N0YWNrRWxlbWVudElkXTtcblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHRyZXN1bHQgPSBuZXcgTW9uYXJjaFN0YWNrRWxlbWVudChwYXJlbnQsIHN0YXRlKTtcblx0XHR0aGlzLl9lbnRyaWVzW3N0YWNrRWxlbWVudElkXSA9IHJlc3VsdDtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmNsYXNzIE1vbmFyY2hTdGFja0VsZW1lbnQge1xuXG5cdHB1YmxpYyByZWFkb25seSBwYXJlbnQ6IE1vbmFyY2hTdGFja0VsZW1lbnQgfCBudWxsO1xuXHRwdWJsaWMgcmVhZG9ubHkgc3RhdGU6IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IGRlcHRoOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IocGFyZW50OiBNb25hcmNoU3RhY2tFbGVtZW50IHwgbnVsbCwgc3RhdGU6IHN0cmluZykge1xuXHRcdHRoaXMucGFyZW50ID0gcGFyZW50O1xuXHRcdHRoaXMuc3RhdGUgPSBzdGF0ZTtcblx0XHR0aGlzLmRlcHRoID0gKHRoaXMucGFyZW50ID8gdGhpcy5wYXJlbnQuZGVwdGggOiAwKSArIDE7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGdldFN0YWNrRWxlbWVudElkKGVsZW1lbnQ6IE1vbmFyY2hTdGFja0VsZW1lbnQgfCBudWxsKTogc3RyaW5nIHtcblx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cdFx0d2hpbGUgKGVsZW1lbnQgIT09IG51bGwpIHtcblx0XHRcdGlmIChyZXN1bHQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZXN1bHQgKz0gJ3wnO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0ICs9IGVsZW1lbnQuc3RhdGU7XG5cdFx0XHRlbGVtZW50ID0gZWxlbWVudC5wYXJlbnQ7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfZXF1YWxzKGE6IE1vbmFyY2hTdGFja0VsZW1lbnQgfCBudWxsLCBiOiBNb25hcmNoU3RhY2tFbGVtZW50IHwgbnVsbCk6IGJvb2xlYW4ge1xuXHRcdHdoaWxlIChhICE9PSBudWxsICYmIGIgIT09IG51bGwpIHtcblx0XHRcdGlmIChhID09PSBiKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGEuc3RhdGUgIT09IGIuc3RhdGUpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0YSA9IGEucGFyZW50O1xuXHRcdFx0YiA9IGIucGFyZW50O1xuXHRcdH1cblx0XHRpZiAoYSA9PT0gbnVsbCAmJiBiID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIGVxdWFscyhvdGhlcjogTW9uYXJjaFN0YWNrRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBNb25hcmNoU3RhY2tFbGVtZW50Ll9lcXVhbHModGhpcywgb3RoZXIpO1xuXHR9XG5cblx0cHVibGljIHB1c2goc3RhdGU6IHN0cmluZyk6IE1vbmFyY2hTdGFja0VsZW1lbnQge1xuXHRcdHJldHVybiBNb25hcmNoU3RhY2tFbGVtZW50RmFjdG9yeS5jcmVhdGUodGhpcywgc3RhdGUpO1xuXHR9XG5cblx0cHVibGljIHBvcCgpOiBNb25hcmNoU3RhY2tFbGVtZW50IHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMucGFyZW50O1xuXHR9XG5cblx0cHVibGljIHBvcGFsbCgpOiBNb25hcmNoU3RhY2tFbGVtZW50IHtcblx0XHRsZXQgcmVzdWx0OiBNb25hcmNoU3RhY2tFbGVtZW50ID0gdGhpcztcblx0XHR3aGlsZSAocmVzdWx0LnBhcmVudCkge1xuXHRcdFx0cmVzdWx0ID0gcmVzdWx0LnBhcmVudDtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBzd2l0Y2hUbyhzdGF0ZTogc3RyaW5nKTogTW9uYXJjaFN0YWNrRWxlbWVudCB7XG5cdFx0cmV0dXJuIE1vbmFyY2hTdGFja0VsZW1lbnRGYWN0b3J5LmNyZWF0ZSh0aGlzLnBhcmVudCwgc3RhdGUpO1xuXHR9XG59XG5cbmNsYXNzIEVtYmVkZGVkTGFuZ3VhZ2VEYXRhIHtcblx0cHVibGljIHJlYWRvbmx5IGxhbmd1YWdlSWQ6IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IHN0YXRlOiBsYW5ndWFnZXMuSVN0YXRlO1xuXG5cdGNvbnN0cnVjdG9yKGxhbmd1YWdlSWQ6IHN0cmluZywgc3RhdGU6IGxhbmd1YWdlcy5JU3RhdGUpIHtcblx0XHR0aGlzLmxhbmd1YWdlSWQgPSBsYW5ndWFnZUlkO1xuXHRcdHRoaXMuc3RhdGUgPSBzdGF0ZTtcblx0fVxuXG5cdHB1YmxpYyBlcXVhbHMob3RoZXI6IEVtYmVkZGVkTGFuZ3VhZ2VEYXRhKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHRoaXMubGFuZ3VhZ2VJZCA9PT0gb3RoZXIubGFuZ3VhZ2VJZFxuXHRcdFx0JiYgdGhpcy5zdGF0ZS5lcXVhbHMob3RoZXIuc3RhdGUpXG5cdFx0KTtcblx0fVxuXG5cdHB1YmxpYyBjbG9uZSgpOiBFbWJlZGRlZExhbmd1YWdlRGF0YSB7XG5cdFx0Y29uc3Qgc3RhdGVDbG9uZSA9IHRoaXMuc3RhdGUuY2xvbmUoKTtcblx0XHQvLyBzYXZlIGFuIG9iamVjdFxuXHRcdGlmIChzdGF0ZUNsb25lID09PSB0aGlzLnN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBFbWJlZGRlZExhbmd1YWdlRGF0YSh0aGlzLmxhbmd1YWdlSWQsIHRoaXMuc3RhdGUpO1xuXHR9XG59XG5cbi8qKlxuICogUmV1c2UgdGhlIHNhbWUgbGluZSBzdGF0ZXMgdXAgdG8gYSBjZXJ0YWluIGRlcHRoLlxuICovXG5jbGFzcyBNb25hcmNoTGluZVN0YXRlRmFjdG9yeSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0lOU1RBTkNFID0gbmV3IE1vbmFyY2hMaW5lU3RhdGVGYWN0b3J5KENBQ0hFX1NUQUNLX0RFUFRIKTtcblx0cHVibGljIHN0YXRpYyBjcmVhdGUoc3RhY2s6IE1vbmFyY2hTdGFja0VsZW1lbnQsIGVtYmVkZGVkTGFuZ3VhZ2VEYXRhOiBFbWJlZGRlZExhbmd1YWdlRGF0YSB8IG51bGwpOiBNb25hcmNoTGluZVN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcy5fSU5TVEFOQ0UuY3JlYXRlKHN0YWNrLCBlbWJlZGRlZExhbmd1YWdlRGF0YSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tYXhDYWNoZURlcHRoOiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VudHJpZXM6IHsgW3N0YWNrRWxlbWVudElkOiBzdHJpbmddOiBNb25hcmNoTGluZVN0YXRlIH07XG5cblx0Y29uc3RydWN0b3IobWF4Q2FjaGVEZXB0aDogbnVtYmVyKSB7XG5cdFx0dGhpcy5fbWF4Q2FjaGVEZXB0aCA9IG1heENhY2hlRGVwdGg7XG5cdFx0dGhpcy5fZW50cmllcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlKHN0YWNrOiBNb25hcmNoU3RhY2tFbGVtZW50LCBlbWJlZGRlZExhbmd1YWdlRGF0YTogRW1iZWRkZWRMYW5ndWFnZURhdGEgfCBudWxsKTogTW9uYXJjaExpbmVTdGF0ZSB7XG5cdFx0aWYgKGVtYmVkZGVkTGFuZ3VhZ2VEYXRhICE9PSBudWxsKSB7XG5cdFx0XHQvLyBubyBjYWNoaW5nIHdoZW4gZW1iZWRkaW5nXG5cdFx0XHRyZXR1cm4gbmV3IE1vbmFyY2hMaW5lU3RhdGUoc3RhY2ssIGVtYmVkZGVkTGFuZ3VhZ2VEYXRhKTtcblx0XHR9XG5cdFx0aWYgKHN0YWNrICE9PSBudWxsICYmIHN0YWNrLmRlcHRoID49IHRoaXMuX21heENhY2hlRGVwdGgpIHtcblx0XHRcdC8vIG5vIGNhY2hpbmcgYWJvdmUgYSBjZXJ0YWluIGRlcHRoXG5cdFx0XHRyZXR1cm4gbmV3IE1vbmFyY2hMaW5lU3RhdGUoc3RhY2ssIGVtYmVkZGVkTGFuZ3VhZ2VEYXRhKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3RhY2tFbGVtZW50SWQgPSBNb25hcmNoU3RhY2tFbGVtZW50LmdldFN0YWNrRWxlbWVudElkKHN0YWNrKTtcblxuXHRcdGxldCByZXN1bHQgPSB0aGlzLl9lbnRyaWVzW3N0YWNrRWxlbWVudElkXTtcblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHRyZXN1bHQgPSBuZXcgTW9uYXJjaExpbmVTdGF0ZShzdGFjaywgbnVsbCk7XG5cdFx0dGhpcy5fZW50cmllc1tzdGFja0VsZW1lbnRJZF0gPSByZXN1bHQ7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5jbGFzcyBNb25hcmNoTGluZVN0YXRlIGltcGxlbWVudHMgbGFuZ3VhZ2VzLklTdGF0ZSB7XG5cblx0cHVibGljIHJlYWRvbmx5IHN0YWNrOiBNb25hcmNoU3RhY2tFbGVtZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgZW1iZWRkZWRMYW5ndWFnZURhdGE6IEVtYmVkZGVkTGFuZ3VhZ2VEYXRhIHwgbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRzdGFjazogTW9uYXJjaFN0YWNrRWxlbWVudCxcblx0XHRlbWJlZGRlZExhbmd1YWdlRGF0YTogRW1iZWRkZWRMYW5ndWFnZURhdGEgfCBudWxsXG5cdCkge1xuXHRcdHRoaXMuc3RhY2sgPSBzdGFjaztcblx0XHR0aGlzLmVtYmVkZGVkTGFuZ3VhZ2VEYXRhID0gZW1iZWRkZWRMYW5ndWFnZURhdGE7XG5cdH1cblxuXHRwdWJsaWMgY2xvbmUoKTogbGFuZ3VhZ2VzLklTdGF0ZSB7XG5cdFx0Y29uc3QgZW1iZWRkZWRsYW5ndWFnZURhdGFDbG9uZSA9IHRoaXMuZW1iZWRkZWRMYW5ndWFnZURhdGEgPyB0aGlzLmVtYmVkZGVkTGFuZ3VhZ2VEYXRhLmNsb25lKCkgOiBudWxsO1xuXHRcdC8vIHNhdmUgYW4gb2JqZWN0XG5cdFx0aWYgKGVtYmVkZGVkbGFuZ3VhZ2VEYXRhQ2xvbmUgPT09IHRoaXMuZW1iZWRkZWRMYW5ndWFnZURhdGEpIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblx0XHRyZXR1cm4gTW9uYXJjaExpbmVTdGF0ZUZhY3RvcnkuY3JlYXRlKHRoaXMuc3RhY2ssIHRoaXMuZW1iZWRkZWRMYW5ndWFnZURhdGEpO1xuXHR9XG5cblx0cHVibGljIGVxdWFscyhvdGhlcjogbGFuZ3VhZ2VzLklTdGF0ZSk6IGJvb2xlYW4ge1xuXHRcdGlmICghKG90aGVyIGluc3RhbmNlb2YgTW9uYXJjaExpbmVTdGF0ZSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnN0YWNrLmVxdWFscyhvdGhlci5zdGFjaykpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZW1iZWRkZWRMYW5ndWFnZURhdGEgPT09IG51bGwgJiYgb3RoZXIuZW1iZWRkZWRMYW5ndWFnZURhdGEgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5lbWJlZGRlZExhbmd1YWdlRGF0YSA9PT0gbnVsbCB8fCBvdGhlci5lbWJlZGRlZExhbmd1YWdlRGF0YSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5lbWJlZGRlZExhbmd1YWdlRGF0YS5lcXVhbHMob3RoZXIuZW1iZWRkZWRMYW5ndWFnZURhdGEpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJTW9uYXJjaFRva2Vuc0NvbGxlY3RvciB7XG5cdGVudGVyTGFuZ3VhZ2UobGFuZ3VhZ2VJZDogc3RyaW5nKTogdm9pZDtcblx0ZW1pdChzdGFydE9mZnNldDogbnVtYmVyLCB0eXBlOiBzdHJpbmcpOiB2b2lkO1xuXHRuZXN0ZWRMYW5ndWFnZVRva2VuaXplKGVtYmVkZGVkTGFuZ3VhZ2VMaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgZW1iZWRkZWRMYW5ndWFnZURhdGE6IEVtYmVkZGVkTGFuZ3VhZ2VEYXRhLCBvZmZzZXREZWx0YTogbnVtYmVyKTogbGFuZ3VhZ2VzLklTdGF0ZTtcbn1cblxuY2xhc3MgTW9uYXJjaENsYXNzaWNUb2tlbnNDb2xsZWN0b3IgaW1wbGVtZW50cyBJTW9uYXJjaFRva2Vuc0NvbGxlY3RvciB7XG5cblx0cHJpdmF0ZSBfdG9rZW5zOiBsYW5ndWFnZXMuVG9rZW5bXTtcblx0cHJpdmF0ZSBfbGFuZ3VhZ2VJZDogc3RyaW5nIHwgbnVsbDtcblx0cHJpdmF0ZSBfbGFzdFRva2VuVHlwZTogc3RyaW5nIHwgbnVsbDtcblx0cHJpdmF0ZSBfbGFzdFRva2VuTGFuZ3VhZ2U6IHN0cmluZyB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fdG9rZW5zID0gW107XG5cdFx0dGhpcy5fbGFuZ3VhZ2VJZCA9IG51bGw7XG5cdFx0dGhpcy5fbGFzdFRva2VuVHlwZSA9IG51bGw7XG5cdFx0dGhpcy5fbGFzdFRva2VuTGFuZ3VhZ2UgPSBudWxsO1xuXHR9XG5cblx0cHVibGljIGVudGVyTGFuZ3VhZ2UobGFuZ3VhZ2VJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fbGFuZ3VhZ2VJZCA9IGxhbmd1YWdlSWQ7XG5cdH1cblxuXHRwdWJsaWMgZW1pdChzdGFydE9mZnNldDogbnVtYmVyLCB0eXBlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fbGFzdFRva2VuVHlwZSA9PT0gdHlwZSAmJiB0aGlzLl9sYXN0VG9rZW5MYW5ndWFnZSA9PT0gdGhpcy5fbGFuZ3VhZ2VJZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9sYXN0VG9rZW5UeXBlID0gdHlwZTtcblx0XHR0aGlzLl9sYXN0VG9rZW5MYW5ndWFnZSA9IHRoaXMuX2xhbmd1YWdlSWQ7XG5cdFx0dGhpcy5fdG9rZW5zLnB1c2gobmV3IGxhbmd1YWdlcy5Ub2tlbihzdGFydE9mZnNldCwgdHlwZSwgdGhpcy5fbGFuZ3VhZ2VJZCEpKTtcblx0fVxuXG5cdHB1YmxpYyBuZXN0ZWRMYW5ndWFnZVRva2VuaXplKGVtYmVkZGVkTGFuZ3VhZ2VMaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgZW1iZWRkZWRMYW5ndWFnZURhdGE6IEVtYmVkZGVkTGFuZ3VhZ2VEYXRhLCBvZmZzZXREZWx0YTogbnVtYmVyKTogbGFuZ3VhZ2VzLklTdGF0ZSB7XG5cdFx0Y29uc3QgbmVzdGVkTGFuZ3VhZ2VJZCA9IGVtYmVkZGVkTGFuZ3VhZ2VEYXRhLmxhbmd1YWdlSWQ7XG5cdFx0Y29uc3QgZW1iZWRkZWRNb2RlU3RhdGUgPSBlbWJlZGRlZExhbmd1YWdlRGF0YS5zdGF0ZTtcblxuXHRcdGNvbnN0IG5lc3RlZExhbmd1YWdlVG9rZW5pemF0aW9uU3VwcG9ydCA9IGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZWdpc3RyeS5nZXQobmVzdGVkTGFuZ3VhZ2VJZCk7XG5cdFx0aWYgKCFuZXN0ZWRMYW5ndWFnZVRva2VuaXphdGlvblN1cHBvcnQpIHtcblx0XHRcdHRoaXMuZW50ZXJMYW5ndWFnZShuZXN0ZWRMYW5ndWFnZUlkKTtcblx0XHRcdHRoaXMuZW1pdChvZmZzZXREZWx0YSwgJycpO1xuXHRcdFx0cmV0dXJuIGVtYmVkZGVkTW9kZVN0YXRlO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5lc3RlZFJlc3VsdCA9IG5lc3RlZExhbmd1YWdlVG9rZW5pemF0aW9uU3VwcG9ydC50b2tlbml6ZShlbWJlZGRlZExhbmd1YWdlTGluZSwgaGFzRU9MLCBlbWJlZGRlZE1vZGVTdGF0ZSk7XG5cdFx0aWYgKG9mZnNldERlbHRhICE9PSAwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHRva2VuIG9mIG5lc3RlZFJlc3VsdC50b2tlbnMpIHtcblx0XHRcdFx0dGhpcy5fdG9rZW5zLnB1c2gobmV3IGxhbmd1YWdlcy5Ub2tlbih0b2tlbi5vZmZzZXQgKyBvZmZzZXREZWx0YSwgdG9rZW4udHlwZSwgdG9rZW4ubGFuZ3VhZ2UpKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fdG9rZW5zID0gdGhpcy5fdG9rZW5zLmNvbmNhdChuZXN0ZWRSZXN1bHQudG9rZW5zKTtcblx0XHR9XG5cdFx0dGhpcy5fbGFzdFRva2VuVHlwZSA9IG51bGw7XG5cdFx0dGhpcy5fbGFzdFRva2VuTGFuZ3VhZ2UgPSBudWxsO1xuXHRcdHRoaXMuX2xhbmd1YWdlSWQgPSBudWxsO1xuXHRcdHJldHVybiBuZXN0ZWRSZXN1bHQuZW5kU3RhdGU7XG5cdH1cblxuXHRwdWJsaWMgZmluYWxpemUoZW5kU3RhdGU6IE1vbmFyY2hMaW5lU3RhdGUpOiBsYW5ndWFnZXMuVG9rZW5pemF0aW9uUmVzdWx0IHtcblx0XHRyZXR1cm4gbmV3IGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZXN1bHQodGhpcy5fdG9rZW5zLCBlbmRTdGF0ZSk7XG5cdH1cbn1cblxuY2xhc3MgTW9uYXJjaE1vZGVyblRva2Vuc0NvbGxlY3RvciBpbXBsZW1lbnRzIElNb25hcmNoVG9rZW5zQ29sbGVjdG9yIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lOiBUb2tlblRoZW1lO1xuXHRwcml2YXRlIF9wcmVwZW5kVG9rZW5zOiBVaW50MzJBcnJheSB8IG51bGw7XG5cdHByaXZhdGUgX3Rva2VuczogbnVtYmVyW107XG5cdHByaXZhdGUgX2N1cnJlbnRMYW5ndWFnZUlkOiBMYW5ndWFnZUlkO1xuXHRwcml2YXRlIF9sYXN0VG9rZW5NZXRhZGF0YTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSwgdGhlbWU6IFRva2VuVGhlbWUpIHtcblx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UgPSBsYW5ndWFnZVNlcnZpY2U7XG5cdFx0dGhpcy5fdGhlbWUgPSB0aGVtZTtcblx0XHR0aGlzLl9wcmVwZW5kVG9rZW5zID0gbnVsbDtcblx0XHR0aGlzLl90b2tlbnMgPSBbXTtcblx0XHR0aGlzLl9jdXJyZW50TGFuZ3VhZ2VJZCA9IExhbmd1YWdlSWQuTnVsbDtcblx0XHR0aGlzLl9sYXN0VG9rZW5NZXRhZGF0YSA9IDA7XG5cdH1cblxuXHRwdWJsaWMgZW50ZXJMYW5ndWFnZShsYW5ndWFnZUlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9jdXJyZW50TGFuZ3VhZ2VJZCA9IHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMuZW5jb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKTtcblx0fVxuXG5cdHB1YmxpYyBlbWl0KHN0YXJ0T2Zmc2V0OiBudW1iZXIsIHR5cGU6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IG1ldGFkYXRhID0gdGhpcy5fdGhlbWUubWF0Y2godGhpcy5fY3VycmVudExhbmd1YWdlSWQsIHR5cGUpIHwgTWV0YWRhdGFDb25zdHMuQkFMQU5DRURfQlJBQ0tFVFNfTUFTSztcblx0XHRpZiAodGhpcy5fbGFzdFRva2VuTWV0YWRhdGEgPT09IG1ldGFkYXRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2xhc3RUb2tlbk1ldGFkYXRhID0gbWV0YWRhdGE7XG5cdFx0dGhpcy5fdG9rZW5zLnB1c2goc3RhcnRPZmZzZXQpO1xuXHRcdHRoaXMuX3Rva2Vucy5wdXNoKG1ldGFkYXRhKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9tZXJnZShhOiBVaW50MzJBcnJheSB8IG51bGwsIGI6IG51bWJlcltdLCBjOiBVaW50MzJBcnJheSB8IG51bGwpOiBVaW50MzJBcnJheSB7XG5cdFx0Y29uc3QgYUxlbiA9IChhICE9PSBudWxsID8gYS5sZW5ndGggOiAwKTtcblx0XHRjb25zdCBiTGVuID0gYi5sZW5ndGg7XG5cdFx0Y29uc3QgY0xlbiA9IChjICE9PSBudWxsID8gYy5sZW5ndGggOiAwKTtcblxuXHRcdGlmIChhTGVuID09PSAwICYmIGJMZW4gPT09IDAgJiYgY0xlbiA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG5ldyBVaW50MzJBcnJheSgwKTtcblx0XHR9XG5cdFx0aWYgKGFMZW4gPT09IDAgJiYgYkxlbiA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGMhO1xuXHRcdH1cblx0XHRpZiAoYkxlbiA9PT0gMCAmJiBjTGVuID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gYSE7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IFVpbnQzMkFycmF5KGFMZW4gKyBiTGVuICsgY0xlbik7XG5cdFx0aWYgKGEgIT09IG51bGwpIHtcblx0XHRcdHJlc3VsdC5zZXQoYSk7XG5cdFx0fVxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYkxlbjsgaSsrKSB7XG5cdFx0XHRyZXN1bHRbYUxlbiArIGldID0gYltpXTtcblx0XHR9XG5cdFx0aWYgKGMgIT09IG51bGwpIHtcblx0XHRcdHJlc3VsdC5zZXQoYywgYUxlbiArIGJMZW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIG5lc3RlZExhbmd1YWdlVG9rZW5pemUoZW1iZWRkZWRMYW5ndWFnZUxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBlbWJlZGRlZExhbmd1YWdlRGF0YTogRW1iZWRkZWRMYW5ndWFnZURhdGEsIG9mZnNldERlbHRhOiBudW1iZXIpOiBsYW5ndWFnZXMuSVN0YXRlIHtcblx0XHRjb25zdCBuZXN0ZWRMYW5ndWFnZUlkID0gZW1iZWRkZWRMYW5ndWFnZURhdGEubGFuZ3VhZ2VJZDtcblx0XHRjb25zdCBlbWJlZGRlZE1vZGVTdGF0ZSA9IGVtYmVkZGVkTGFuZ3VhZ2VEYXRhLnN0YXRlO1xuXG5cdFx0Y29uc3QgbmVzdGVkTGFuZ3VhZ2VUb2tlbml6YXRpb25TdXBwb3J0ID0gbGFuZ3VhZ2VzLlRva2VuaXphdGlvblJlZ2lzdHJ5LmdldChuZXN0ZWRMYW5ndWFnZUlkKTtcblx0XHRpZiAoIW5lc3RlZExhbmd1YWdlVG9rZW5pemF0aW9uU3VwcG9ydCkge1xuXHRcdFx0dGhpcy5lbnRlckxhbmd1YWdlKG5lc3RlZExhbmd1YWdlSWQpO1xuXHRcdFx0dGhpcy5lbWl0KG9mZnNldERlbHRhLCAnJyk7XG5cdFx0XHRyZXR1cm4gZW1iZWRkZWRNb2RlU3RhdGU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmVzdGVkUmVzdWx0ID0gbmVzdGVkTGFuZ3VhZ2VUb2tlbml6YXRpb25TdXBwb3J0LnRva2VuaXplRW5jb2RlZChlbWJlZGRlZExhbmd1YWdlTGluZSwgaGFzRU9MLCBlbWJlZGRlZE1vZGVTdGF0ZSk7XG5cdFx0aWYgKG9mZnNldERlbHRhICE9PSAwKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbmVzdGVkUmVzdWx0LnRva2Vucy5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMikge1xuXHRcdFx0XHRuZXN0ZWRSZXN1bHQudG9rZW5zW2ldICs9IG9mZnNldERlbHRhO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3ByZXBlbmRUb2tlbnMgPSBNb25hcmNoTW9kZXJuVG9rZW5zQ29sbGVjdG9yLl9tZXJnZSh0aGlzLl9wcmVwZW5kVG9rZW5zLCB0aGlzLl90b2tlbnMsIG5lc3RlZFJlc3VsdC50b2tlbnMpO1xuXHRcdHRoaXMuX3Rva2VucyA9IFtdO1xuXHRcdHRoaXMuX2N1cnJlbnRMYW5ndWFnZUlkID0gMDtcblx0XHR0aGlzLl9sYXN0VG9rZW5NZXRhZGF0YSA9IDA7XG5cdFx0cmV0dXJuIG5lc3RlZFJlc3VsdC5lbmRTdGF0ZTtcblx0fVxuXG5cdHB1YmxpYyBmaW5hbGl6ZShlbmRTdGF0ZTogTW9uYXJjaExpbmVTdGF0ZSk6IGxhbmd1YWdlcy5FbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0IHtcblx0XHRyZXR1cm4gbmV3IGxhbmd1YWdlcy5FbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KFxuXHRcdFx0TW9uYXJjaE1vZGVyblRva2Vuc0NvbGxlY3Rvci5fbWVyZ2UodGhpcy5fcHJlcGVuZFRva2VucywgdGhpcy5fdG9rZW5zLCBudWxsKSxcblx0XHRcdGVuZFN0YXRlXG5cdFx0KTtcblx0fVxufVxuXG5leHBvcnQgdHlwZSBJTG9hZFN0YXR1cyA9IHsgbG9hZGVkOiB0cnVlIH0gfCB7IGxvYWRlZDogZmFsc2U7IHByb21pc2U6IFByb21pc2U8dm9pZD4gfTtcblxuZXhwb3J0IGNsYXNzIE1vbmFyY2hUb2tlbml6ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgbGFuZ3VhZ2VzLklUb2tlbml6YXRpb25TdXBwb3J0LCBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGFuZGFsb25lVGhlbWVTZXJ2aWNlOiBJU3RhbmRhbG9uZVRoZW1lU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VJZDogc3RyaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sZXhlcjogbW9uYXJjaENvbW1vbi5JTGV4ZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VtYmVkZGVkTGFuZ3VhZ2VzOiB7IFtsYW5ndWFnZUlkOiBzdHJpbmddOiBib29sZWFuIH07XG5cdHB1YmxpYyBlbWJlZGRlZExvYWRlZDogUHJvbWlzZTx2b2lkPjtcblx0cHJpdmF0ZSBfbWF4VG9rZW5pemF0aW9uTGluZUxlbmd0aDogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSwgc3RhbmRhbG9uZVRoZW1lU2VydmljZTogSVN0YW5kYWxvbmVUaGVtZVNlcnZpY2UsIGxhbmd1YWdlSWQ6IHN0cmluZywgbGV4ZXI6IG1vbmFyY2hDb21tb24uSUxleGVyLCBASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2xhbmd1YWdlU2VydmljZSA9IGxhbmd1YWdlU2VydmljZTtcblx0XHR0aGlzLl9zdGFuZGFsb25lVGhlbWVTZXJ2aWNlID0gc3RhbmRhbG9uZVRoZW1lU2VydmljZTtcblx0XHR0aGlzLl9sYW5ndWFnZUlkID0gbGFuZ3VhZ2VJZDtcblx0XHR0aGlzLl9sZXhlciA9IGxleGVyO1xuXHRcdHRoaXMuX2VtYmVkZGVkTGFuZ3VhZ2VzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLmVtYmVkZGVkTG9hZGVkID0gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cblx0XHQvLyBTZXQgdXAgbGlzdGVuaW5nIGZvciBlbWJlZGRlZCBtb2Rlc1xuXHRcdGxldCBlbWl0dGluZyA9IGZhbHNlO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZWdpc3RyeS5vbkRpZENoYW5nZSgoZSkgPT4ge1xuXHRcdFx0aWYgKGVtaXR0aW5nKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGxldCBpc09uZU9mTXlFbWJlZGRlZE1vZGVzID0gZmFsc2U7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gZS5jaGFuZ2VkTGFuZ3VhZ2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlID0gZS5jaGFuZ2VkTGFuZ3VhZ2VzW2ldO1xuXHRcdFx0XHRpZiAodGhpcy5fZW1iZWRkZWRMYW5ndWFnZXNbbGFuZ3VhZ2VdKSB7XG5cdFx0XHRcdFx0aXNPbmVPZk15RW1iZWRkZWRNb2RlcyA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChpc09uZU9mTXlFbWJlZGRlZE1vZGVzKSB7XG5cdFx0XHRcdGVtaXR0aW5nID0gdHJ1ZTtcblx0XHRcdFx0bGFuZ3VhZ2VzLlRva2VuaXphdGlvblJlZ2lzdHJ5LmhhbmRsZUNoYW5nZShbdGhpcy5fbGFuZ3VhZ2VJZF0pO1xuXHRcdFx0XHRlbWl0dGluZyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9tYXhUb2tlbml6YXRpb25MaW5lTGVuZ3RoID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignZWRpdG9yLm1heFRva2VuaXphdGlvbkxpbmVMZW5ndGgnLCB7XG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXI6IHRoaXMuX2xhbmd1YWdlSWRcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yLm1heFRva2VuaXphdGlvbkxpbmVMZW5ndGgnKSkge1xuXHRcdFx0XHR0aGlzLl9tYXhUb2tlbml6YXRpb25MaW5lTGVuZ3RoID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignZWRpdG9yLm1heFRva2VuaXphdGlvbkxpbmVMZW5ndGgnLCB7XG5cdFx0XHRcdFx0b3ZlcnJpZGVJZGVudGlmaWVyOiB0aGlzLl9sYW5ndWFnZUlkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMb2FkU3RhdHVzKCk6IElMb2FkU3RhdHVzIHtcblx0XHRjb25zdCBwcm9taXNlczogVGhlbmFibGU8YW55PltdID0gW107XG5cdFx0Zm9yIChjb25zdCBuZXN0ZWRMYW5ndWFnZUlkIGluIHRoaXMuX2VtYmVkZGVkTGFuZ3VhZ2VzKSB7XG5cdFx0XHRjb25zdCB0b2tlbml6YXRpb25TdXBwb3J0ID0gbGFuZ3VhZ2VzLlRva2VuaXphdGlvblJlZ2lzdHJ5LmdldChuZXN0ZWRMYW5ndWFnZUlkKTtcblx0XHRcdGlmICh0b2tlbml6YXRpb25TdXBwb3J0KSB7XG5cdFx0XHRcdC8vIFRoZSBuZXN0ZWQgbGFuZ3VhZ2UgaXMgYWxyZWFkeSBsb2FkZWRcblx0XHRcdFx0aWYgKHRva2VuaXphdGlvblN1cHBvcnQgaW5zdGFuY2VvZiBNb25hcmNoVG9rZW5pemVyKSB7XG5cdFx0XHRcdFx0Y29uc3QgbmVzdGVkTW9kZVN0YXR1cyA9IHRva2VuaXphdGlvblN1cHBvcnQuZ2V0TG9hZFN0YXR1cygpO1xuXHRcdFx0XHRcdGlmIChuZXN0ZWRNb2RlU3RhdHVzLmxvYWRlZCA9PT0gZmFsc2UpIHtcblx0XHRcdFx0XHRcdHByb21pc2VzLnB1c2gobmVzdGVkTW9kZVN0YXR1cy5wcm9taXNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghbGFuZ3VhZ2VzLlRva2VuaXphdGlvblJlZ2lzdHJ5LmlzUmVzb2x2ZWQobmVzdGVkTGFuZ3VhZ2VJZCkpIHtcblx0XHRcdFx0Ly8gVGhlIG5lc3RlZCBsYW5ndWFnZSBpcyBpbiB0aGUgcHJvY2VzcyBvZiBiZWluZyBsb2FkZWRcblx0XHRcdFx0cHJvbWlzZXMucHVzaChsYW5ndWFnZXMuVG9rZW5pemF0aW9uUmVnaXN0cnkuZ2V0T3JDcmVhdGUobmVzdGVkTGFuZ3VhZ2VJZCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwcm9taXNlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxvYWRlZDogdHJ1ZVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxvYWRlZDogZmFsc2UsXG5cdFx0XHRwcm9taXNlOiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihfID0+IHVuZGVmaW5lZClcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGdldEluaXRpYWxTdGF0ZSgpOiBsYW5ndWFnZXMuSVN0YXRlIHtcblx0XHRjb25zdCByb290U3RhdGUgPSBNb25hcmNoU3RhY2tFbGVtZW50RmFjdG9yeS5jcmVhdGUobnVsbCwgdGhpcy5fbGV4ZXIuc3RhcnQhKTtcblx0XHRyZXR1cm4gTW9uYXJjaExpbmVTdGF0ZUZhY3RvcnkuY3JlYXRlKHJvb3RTdGF0ZSwgbnVsbCk7XG5cdH1cblxuXHRwdWJsaWMgdG9rZW5pemUobGluZTogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIGxpbmVTdGF0ZTogbGFuZ3VhZ2VzLklTdGF0ZSk6IGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZXN1bHQge1xuXHRcdGlmIChsaW5lLmxlbmd0aCA+PSB0aGlzLl9tYXhUb2tlbml6YXRpb25MaW5lTGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gbnVsbFRva2VuaXplKHRoaXMuX2xhbmd1YWdlSWQsIGxpbmVTdGF0ZSk7XG5cdFx0fVxuXHRcdGNvbnN0IHRva2Vuc0NvbGxlY3RvciA9IG5ldyBNb25hcmNoQ2xhc3NpY1Rva2Vuc0NvbGxlY3RvcigpO1xuXHRcdGNvbnN0IGVuZExpbmVTdGF0ZSA9IHRoaXMuX3Rva2VuaXplKGxpbmUsIGhhc0VPTCwgPE1vbmFyY2hMaW5lU3RhdGU+bGluZVN0YXRlLCB0b2tlbnNDb2xsZWN0b3IpO1xuXHRcdHJldHVybiB0b2tlbnNDb2xsZWN0b3IuZmluYWxpemUoZW5kTGluZVN0YXRlKTtcblx0fVxuXG5cdHB1YmxpYyB0b2tlbml6ZUVuY29kZWQobGluZTogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIGxpbmVTdGF0ZTogbGFuZ3VhZ2VzLklTdGF0ZSk6IGxhbmd1YWdlcy5FbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0IHtcblx0XHRpZiAobGluZS5sZW5ndGggPj0gdGhpcy5fbWF4VG9rZW5pemF0aW9uTGluZUxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIG51bGxUb2tlbml6ZUVuY29kZWQodGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYy5lbmNvZGVMYW5ndWFnZUlkKHRoaXMuX2xhbmd1YWdlSWQpLCBsaW5lU3RhdGUpO1xuXHRcdH1cblx0XHRjb25zdCB0b2tlbnNDb2xsZWN0b3IgPSBuZXcgTW9uYXJjaE1vZGVyblRva2Vuc0NvbGxlY3Rvcih0aGlzLl9sYW5ndWFnZVNlcnZpY2UsIHRoaXMuX3N0YW5kYWxvbmVUaGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLnRva2VuVGhlbWUpO1xuXHRcdGNvbnN0IGVuZExpbmVTdGF0ZSA9IHRoaXMuX3Rva2VuaXplKGxpbmUsIGhhc0VPTCwgPE1vbmFyY2hMaW5lU3RhdGU+bGluZVN0YXRlLCB0b2tlbnNDb2xsZWN0b3IpO1xuXHRcdHJldHVybiB0b2tlbnNDb2xsZWN0b3IuZmluYWxpemUoZW5kTGluZVN0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgX3Rva2VuaXplKGxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBsaW5lU3RhdGU6IE1vbmFyY2hMaW5lU3RhdGUsIGNvbGxlY3RvcjogSU1vbmFyY2hUb2tlbnNDb2xsZWN0b3IpOiBNb25hcmNoTGluZVN0YXRlIHtcblx0XHRpZiAobGluZVN0YXRlLmVtYmVkZGVkTGFuZ3VhZ2VEYXRhKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbmVzdGVkVG9rZW5pemUobGluZSwgaGFzRU9MLCBsaW5lU3RhdGUsIDAsIGNvbGxlY3Rvcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9teVRva2VuaXplKGxpbmUsIGhhc0VPTCwgbGluZVN0YXRlLCAwLCBjb2xsZWN0b3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2ZpbmRMZWF2aW5nTmVzdGVkTGFuZ3VhZ2VPZmZzZXQobGluZTogc3RyaW5nLCBzdGF0ZTogTW9uYXJjaExpbmVTdGF0ZSk6IG51bWJlciB7XG5cdFx0bGV0IHJ1bGVzOiBtb25hcmNoQ29tbW9uLklSdWxlW10gfCBudWxsID0gdGhpcy5fbGV4ZXIudG9rZW5pemVyW3N0YXRlLnN0YWNrLnN0YXRlXTtcblx0XHRpZiAoIXJ1bGVzKSB7XG5cdFx0XHRydWxlcyA9IG1vbmFyY2hDb21tb24uZmluZFJ1bGVzKHRoaXMuX2xleGVyLCBzdGF0ZS5zdGFjay5zdGF0ZSk7IC8vIGRvIHBhcmVudCBtYXRjaGluZ1xuXHRcdFx0aWYgKCFydWxlcykge1xuXHRcdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKHRoaXMuX2xleGVyLCAndG9rZW5pemVyIHN0YXRlIGlzIG5vdCBkZWZpbmVkOiAnICsgc3RhdGUuc3RhY2suc3RhdGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCBwb3BPZmZzZXQgPSAtMTtcblx0XHRsZXQgaGFzRW1iZWRkZWRQb3BSdWxlID0gZmFsc2U7XG5cblx0XHRmb3IgKGNvbnN0IHJ1bGUgb2YgcnVsZXMpIHtcblx0XHRcdGlmICghbW9uYXJjaENvbW1vbi5pc0lBY3Rpb24ocnVsZS5hY3Rpb24pIHx8IHJ1bGUuYWN0aW9uLm5leHRFbWJlZGRlZCAhPT0gJ0Bwb3AnKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aGFzRW1iZWRkZWRQb3BSdWxlID0gdHJ1ZTtcblxuXHRcdFx0bGV0IHJlZ2V4ID0gcnVsZS5yZXNvbHZlUmVnZXgoc3RhdGUuc3RhY2suc3RhdGUpO1xuXHRcdFx0Y29uc3QgcmVnZXhTb3VyY2UgPSByZWdleC5zb3VyY2U7XG5cdFx0XHRpZiAocmVnZXhTb3VyY2Uuc3Vic3RyKDAsIDQpID09PSAnXig/OicgJiYgcmVnZXhTb3VyY2Uuc3Vic3RyKHJlZ2V4U291cmNlLmxlbmd0aCAtIDEsIDEpID09PSAnKScpIHtcblx0XHRcdFx0Y29uc3QgZmxhZ3MgPSAocmVnZXguaWdub3JlQ2FzZSA/ICdpJyA6ICcnKSArIChyZWdleC51bmljb2RlID8gJ3UnIDogJycpO1xuXHRcdFx0XHRyZWdleCA9IG5ldyBSZWdFeHAocmVnZXhTb3VyY2Uuc3Vic3RyKDQsIHJlZ2V4U291cmNlLmxlbmd0aCAtIDUpLCBmbGFncyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGxpbmUuc2VhcmNoKHJlZ2V4KTtcblx0XHRcdGlmIChyZXN1bHQgPT09IC0xIHx8IChyZXN1bHQgIT09IDAgJiYgcnVsZS5tYXRjaE9ubHlBdExpbmVTdGFydCkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwb3BPZmZzZXQgPT09IC0xIHx8IHJlc3VsdCA8IHBvcE9mZnNldCkge1xuXHRcdFx0XHRwb3BPZmZzZXQgPSByZXN1bHQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFoYXNFbWJlZGRlZFBvcFJ1bGUpIHtcblx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IodGhpcy5fbGV4ZXIsICdubyBydWxlIGNvbnRhaW5pbmcgbmV4dEVtYmVkZGVkOiBcIkBwb3BcIiBpbiB0b2tlbml6ZXIgZW1iZWRkZWQgc3RhdGU6ICcgKyBzdGF0ZS5zdGFjay5zdGF0ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBvcE9mZnNldDtcblx0fVxuXG5cdHByaXZhdGUgX25lc3RlZFRva2VuaXplKGxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBsaW5lU3RhdGU6IE1vbmFyY2hMaW5lU3RhdGUsIG9mZnNldERlbHRhOiBudW1iZXIsIHRva2Vuc0NvbGxlY3RvcjogSU1vbmFyY2hUb2tlbnNDb2xsZWN0b3IpOiBNb25hcmNoTGluZVN0YXRlIHtcblxuXHRcdGNvbnN0IHBvcE9mZnNldCA9IHRoaXMuX2ZpbmRMZWF2aW5nTmVzdGVkTGFuZ3VhZ2VPZmZzZXQobGluZSwgbGluZVN0YXRlKTtcblxuXHRcdGlmIChwb3BPZmZzZXQgPT09IC0xKSB7XG5cdFx0XHQvLyB0b2tlbml6YXRpb24gd2lsbCBub3QgbGVhdmUgbmVzdGVkIGxhbmd1YWdlXG5cdFx0XHRjb25zdCBuZXN0ZWRFbmRTdGF0ZSA9IHRva2Vuc0NvbGxlY3Rvci5uZXN0ZWRMYW5ndWFnZVRva2VuaXplKGxpbmUsIGhhc0VPTCwgbGluZVN0YXRlLmVtYmVkZGVkTGFuZ3VhZ2VEYXRhISwgb2Zmc2V0RGVsdGEpO1xuXHRcdFx0cmV0dXJuIE1vbmFyY2hMaW5lU3RhdGVGYWN0b3J5LmNyZWF0ZShsaW5lU3RhdGUuc3RhY2ssIG5ldyBFbWJlZGRlZExhbmd1YWdlRGF0YShsaW5lU3RhdGUuZW1iZWRkZWRMYW5ndWFnZURhdGEhLmxhbmd1YWdlSWQsIG5lc3RlZEVuZFN0YXRlKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmVzdGVkTGFuZ3VhZ2VMaW5lID0gbGluZS5zdWJzdHJpbmcoMCwgcG9wT2Zmc2V0KTtcblx0XHRpZiAobmVzdGVkTGFuZ3VhZ2VMaW5lLmxlbmd0aCA+IDApIHtcblx0XHRcdC8vIHRva2VuaXplIHdpdGggdGhlIG5lc3RlZCBsYW5ndWFnZVxuXHRcdFx0dG9rZW5zQ29sbGVjdG9yLm5lc3RlZExhbmd1YWdlVG9rZW5pemUobmVzdGVkTGFuZ3VhZ2VMaW5lLCBmYWxzZSwgbGluZVN0YXRlLmVtYmVkZGVkTGFuZ3VhZ2VEYXRhISwgb2Zmc2V0RGVsdGEpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3RPZlRoZUxpbmUgPSBsaW5lLnN1YnN0cmluZyhwb3BPZmZzZXQpO1xuXHRcdHJldHVybiB0aGlzLl9teVRva2VuaXplKHJlc3RPZlRoZUxpbmUsIGhhc0VPTCwgbGluZVN0YXRlLCBvZmZzZXREZWx0YSArIHBvcE9mZnNldCwgdG9rZW5zQ29sbGVjdG9yKTtcblx0fVxuXG5cdHByaXZhdGUgX3NhZmVSdWxlTmFtZShydWxlOiBtb25hcmNoQ29tbW9uLklSdWxlIHwgbnVsbCk6IHN0cmluZyB7XG5cdFx0aWYgKHJ1bGUpIHtcblx0XHRcdHJldHVybiBydWxlLm5hbWU7XG5cdFx0fVxuXHRcdHJldHVybiAnKHVua25vd24pJztcblx0fVxuXG5cdHByaXZhdGUgX215VG9rZW5pemUobGluZVdpdGhvdXRMRjogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIGxpbmVTdGF0ZTogTW9uYXJjaExpbmVTdGF0ZSwgb2Zmc2V0RGVsdGE6IG51bWJlciwgdG9rZW5zQ29sbGVjdG9yOiBJTW9uYXJjaFRva2Vuc0NvbGxlY3Rvcik6IE1vbmFyY2hMaW5lU3RhdGUge1xuXHRcdHRva2Vuc0NvbGxlY3Rvci5lbnRlckxhbmd1YWdlKHRoaXMuX2xhbmd1YWdlSWQpO1xuXG5cdFx0Y29uc3QgbGluZVdpdGhvdXRMRkxlbmd0aCA9IGxpbmVXaXRob3V0TEYubGVuZ3RoO1xuXHRcdGNvbnN0IGxpbmUgPSAoaGFzRU9MICYmIHRoaXMuX2xleGVyLmluY2x1ZGVMRiA/IGxpbmVXaXRob3V0TEYgKyAnXFxuJyA6IGxpbmVXaXRob3V0TEYpO1xuXHRcdGNvbnN0IGxpbmVMZW5ndGggPSBsaW5lLmxlbmd0aDtcblxuXHRcdGxldCBlbWJlZGRlZExhbmd1YWdlRGF0YSA9IGxpbmVTdGF0ZS5lbWJlZGRlZExhbmd1YWdlRGF0YTtcblx0XHRsZXQgc3RhY2sgPSBsaW5lU3RhdGUuc3RhY2s7XG5cdFx0bGV0IHBvcyA9IDA7XG5cblx0XHQvLyByZWd1bGFyIGV4cHJlc3Npb24gZ3JvdXAgbWF0Y2hpbmdcblx0XHQvLyB0aGVzZSBuZXZlciBuZWVkIGNsb25pbmcgb3IgZXF1YWxpdHkgc2luY2UgdGhleSBhcmUgb25seSB1c2VkIHdpdGhpbiBhIGxpbmUgbWF0Y2hcblx0XHRpbnRlcmZhY2UgR3JvdXBNYXRjaGluZyB7XG5cdFx0XHRtYXRjaGVzOiBzdHJpbmdbXTtcblx0XHRcdHJ1bGU6IG1vbmFyY2hDb21tb24uSVJ1bGUgfCBudWxsO1xuXHRcdFx0Z3JvdXBzOiB7IGFjdGlvbjogbW9uYXJjaENvbW1vbi5GdXp6eUFjdGlvbjsgbWF0Y2hlZDogc3RyaW5nIH1bXTtcblx0XHR9XG5cdFx0bGV0IGdyb3VwTWF0Y2hpbmc6IEdyb3VwTWF0Y2hpbmcgfCBudWxsID0gbnVsbDtcblxuXHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L21vbmFjby1lZGl0b3IvaXNzdWVzLzEyMzVcblx0XHQvLyBFdmFsdWF0ZSBydWxlcyBhdCBsZWFzdCBvbmNlIGZvciBhbiBlbXB0eSBsaW5lXG5cdFx0bGV0IGZvcmNlRXZhbHVhdGlvbiA9IHRydWU7XG5cblx0XHR3aGlsZSAoZm9yY2VFdmFsdWF0aW9uIHx8IHBvcyA8IGxpbmVMZW5ndGgpIHtcblxuXHRcdFx0Y29uc3QgcG9zMCA9IHBvcztcblx0XHRcdGNvbnN0IHN0YWNrTGVuMCA9IHN0YWNrLmRlcHRoO1xuXHRcdFx0Y29uc3QgZ3JvdXBMZW4wID0gZ3JvdXBNYXRjaGluZyA/IGdyb3VwTWF0Y2hpbmcuZ3JvdXBzLmxlbmd0aCA6IDA7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IHN0YWNrLnN0YXRlO1xuXG5cdFx0XHRsZXQgbWF0Y2hlczogc3RyaW5nW10gfCBudWxsID0gbnVsbDtcblx0XHRcdGxldCBtYXRjaGVkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0XHRcdGxldCBhY3Rpb246IG1vbmFyY2hDb21tb24uRnV6enlBY3Rpb24gfCBtb25hcmNoQ29tbW9uLkZ1enp5QWN0aW9uW10gfCBudWxsID0gbnVsbDtcblx0XHRcdGxldCBydWxlOiBtb25hcmNoQ29tbW9uLklSdWxlIHwgbnVsbCA9IG51bGw7XG5cblx0XHRcdGxldCBlbnRlcmluZ0VtYmVkZGVkTGFuZ3VhZ2U6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG5cdFx0XHQvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIHByb2Nlc3MgZ3JvdXAgbWF0Y2hlcyBmaXJzdFxuXHRcdFx0aWYgKGdyb3VwTWF0Y2hpbmcpIHtcblx0XHRcdFx0bWF0Y2hlcyA9IGdyb3VwTWF0Y2hpbmcubWF0Y2hlcztcblx0XHRcdFx0Y29uc3QgZ3JvdXBFbnRyeSA9IGdyb3VwTWF0Y2hpbmcuZ3JvdXBzLnNoaWZ0KCkhO1xuXHRcdFx0XHRtYXRjaGVkID0gZ3JvdXBFbnRyeS5tYXRjaGVkO1xuXHRcdFx0XHRhY3Rpb24gPSBncm91cEVudHJ5LmFjdGlvbjtcblx0XHRcdFx0cnVsZSA9IGdyb3VwTWF0Y2hpbmcucnVsZTtcblxuXHRcdFx0XHQvLyBjbGVhbnVwIGlmIG5lY2Vzc2FyeVxuXHRcdFx0XHRpZiAoZ3JvdXBNYXRjaGluZy5ncm91cHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Z3JvdXBNYXRjaGluZyA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIG90aGVyd2lzZSB3ZSBtYXRjaCBvbiB0aGUgdG9rZW4gc3RyZWFtXG5cblx0XHRcdFx0aWYgKCFmb3JjZUV2YWx1YXRpb24gJiYgcG9zID49IGxpbmVMZW5ndGgpIHtcblx0XHRcdFx0XHQvLyBub3RoaW5nIHRvIGRvXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3JjZUV2YWx1YXRpb24gPSBmYWxzZTtcblxuXHRcdFx0XHQvLyBnZXQgdGhlIHJ1bGVzIGZvciB0aGlzIHN0YXRlXG5cdFx0XHRcdGxldCBydWxlczogbW9uYXJjaENvbW1vbi5JUnVsZVtdIHwgbnVsbCA9IHRoaXMuX2xleGVyLnRva2VuaXplcltzdGF0ZV07XG5cdFx0XHRcdGlmICghcnVsZXMpIHtcblx0XHRcdFx0XHRydWxlcyA9IG1vbmFyY2hDb21tb24uZmluZFJ1bGVzKHRoaXMuX2xleGVyLCBzdGF0ZSk7IC8vIGRvIHBhcmVudCBtYXRjaGluZ1xuXHRcdFx0XHRcdGlmICghcnVsZXMpIHtcblx0XHRcdFx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IodGhpcy5fbGV4ZXIsICd0b2tlbml6ZXIgc3RhdGUgaXMgbm90IGRlZmluZWQ6ICcgKyBzdGF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gdHJ5IGVhY2ggcnVsZSB1bnRpbCB3ZSBtYXRjaFxuXHRcdFx0XHRjb25zdCByZXN0T2ZMaW5lID0gbGluZS5zdWJzdHIocG9zKTtcblx0XHRcdFx0Zm9yIChjb25zdCBydWxlIG9mIHJ1bGVzKSB7XG5cdFx0XHRcdFx0aWYgKHBvcyA9PT0gMCB8fCAhcnVsZS5tYXRjaE9ubHlBdExpbmVTdGFydCkge1xuXHRcdFx0XHRcdFx0bWF0Y2hlcyA9IHJlc3RPZkxpbmUubWF0Y2gocnVsZS5yZXNvbHZlUmVnZXgoc3RhdGUpKTtcblx0XHRcdFx0XHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRcdFx0XHRcdG1hdGNoZWQgPSBtYXRjaGVzWzBdO1xuXHRcdFx0XHRcdFx0XHRhY3Rpb24gPSBydWxlLmFjdGlvbjtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdlIG1hdGNoZWQgJ3J1bGUnIHdpdGggJ21hdGNoZXMnIGFuZCAnYWN0aW9uJ1xuXHRcdFx0aWYgKCFtYXRjaGVzKSB7XG5cdFx0XHRcdG1hdGNoZXMgPSBbJyddO1xuXHRcdFx0XHRtYXRjaGVkID0gJyc7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghYWN0aW9uKSB7XG5cdFx0XHRcdC8vIGJhZDogd2UgZGlkbid0IG1hdGNoIGFueXRoaW5nLCBhbmQgdGhlcmUgaXMgbm8gYWN0aW9uIHRvIHRha2Vcblx0XHRcdFx0Ly8gd2UgbmVlZCB0byBhZHZhbmNlIHRoZSBzdHJlYW0gb3Igd2UgZ2V0IHByb2dyZXNzIHRyb3VibGVcblx0XHRcdFx0aWYgKHBvcyA8IGxpbmVMZW5ndGgpIHtcblx0XHRcdFx0XHRtYXRjaGVzID0gW2xpbmUuY2hhckF0KHBvcyldO1xuXHRcdFx0XHRcdG1hdGNoZWQgPSBtYXRjaGVzWzBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjdGlvbiA9IHRoaXMuX2xleGVyLmRlZmF1bHRUb2tlbjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG1hdGNoZWQgPT09IG51bGwpIHtcblx0XHRcdFx0Ly8gc2hvdWxkIG5ldmVyIGhhcHBlbiwgbmVlZGVkIGZvciBzdHJpY3QgbnVsbCBjaGVja2luZ1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0Ly8gYWR2YW5jZSBzdHJlYW1cblx0XHRcdHBvcyArPSBtYXRjaGVkLmxlbmd0aDtcblxuXHRcdFx0Ly8gbWF5YmUgY2FsbCBhY3Rpb24gZnVuY3Rpb24gKHVzZWQgZm9yICdjYXNlcycpXG5cdFx0XHR3aGlsZSAobW9uYXJjaENvbW1vbi5pc0Z1enp5QWN0aW9uKGFjdGlvbikgJiYgbW9uYXJjaENvbW1vbi5pc0lBY3Rpb24oYWN0aW9uKSAmJiBhY3Rpb24udGVzdCkge1xuXHRcdFx0XHRhY3Rpb24gPSBhY3Rpb24udGVzdChtYXRjaGVkLCBtYXRjaGVzLCBzdGF0ZSwgcG9zID09PSBsaW5lTGVuZ3RoKTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IHJlc3VsdDogbW9uYXJjaENvbW1vbi5GdXp6eUFjdGlvbiB8IG1vbmFyY2hDb21tb24uRnV6enlBY3Rpb25bXSB8IG51bGwgPSBudWxsO1xuXHRcdFx0Ly8gc2V0IHRoZSByZXN1bHQ6IGVpdGhlciBhIHN0cmluZyBvciBhbiBhcnJheSBvZiBhY3Rpb25zXG5cdFx0XHRpZiAodHlwZW9mIGFjdGlvbiA9PT0gJ3N0cmluZycgfHwgQXJyYXkuaXNBcnJheShhY3Rpb24pKSB7XG5cdFx0XHRcdHJlc3VsdCA9IGFjdGlvbjtcblx0XHRcdH0gZWxzZSBpZiAoYWN0aW9uLmdyb3VwKSB7XG5cdFx0XHRcdHJlc3VsdCA9IGFjdGlvbi5ncm91cDtcblx0XHRcdH0gZWxzZSBpZiAoYWN0aW9uLnRva2VuICE9PSBudWxsICYmIGFjdGlvbi50b2tlbiAhPT0gdW5kZWZpbmVkKSB7XG5cblx0XHRcdFx0Ly8gZG8gJG4gcmVwbGFjZW1lbnRzP1xuXHRcdFx0XHRpZiAoYWN0aW9uLnRva2VuU3Vic3QpIHtcblx0XHRcdFx0XHRyZXN1bHQgPSBtb25hcmNoQ29tbW9uLnN1YnN0aXR1dGVNYXRjaGVzKHRoaXMuX2xleGVyLCBhY3Rpb24udG9rZW4sIG1hdGNoZWQsIG1hdGNoZXMsIHN0YXRlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQgPSBhY3Rpb24udG9rZW47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBlbnRlciBlbWJlZGRlZCBsYW5ndWFnZT9cblx0XHRcdFx0aWYgKGFjdGlvbi5uZXh0RW1iZWRkZWQpIHtcblx0XHRcdFx0XHRpZiAoYWN0aW9uLm5leHRFbWJlZGRlZCA9PT0gJ0Bwb3AnKSB7XG5cdFx0XHRcdFx0XHRpZiAoIWVtYmVkZGVkTGFuZ3VhZ2VEYXRhKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IodGhpcy5fbGV4ZXIsICdjYW5ub3QgcG9wIGVtYmVkZGVkIGxhbmd1YWdlIGlmIG5vdCBpbnNpZGUgb25lJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbWJlZGRlZExhbmd1YWdlRGF0YSA9IG51bGw7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChlbWJlZGRlZExhbmd1YWdlRGF0YSkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcih0aGlzLl9sZXhlciwgJ2Nhbm5vdCBlbnRlciBlbWJlZGRlZCBsYW5ndWFnZSBmcm9tIHdpdGhpbiBhbiBlbWJlZGRlZCBsYW5ndWFnZScpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlbnRlcmluZ0VtYmVkZGVkTGFuZ3VhZ2UgPSBtb25hcmNoQ29tbW9uLnN1YnN0aXR1dGVNYXRjaGVzKHRoaXMuX2xleGVyLCBhY3Rpb24ubmV4dEVtYmVkZGVkLCBtYXRjaGVkLCBtYXRjaGVzLCBzdGF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gc3RhdGUgdHJhbnNmb3JtYXRpb25zXG5cdFx0XHRcdGlmIChhY3Rpb24uZ29CYWNrKSB7IC8vIGJhY2sgdXAgdGhlIHN0cmVhbS4uXG5cdFx0XHRcdFx0cG9zID0gTWF0aC5tYXgoMCwgcG9zIC0gYWN0aW9uLmdvQmFjayk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYWN0aW9uLnN3aXRjaFRvICYmIHR5cGVvZiBhY3Rpb24uc3dpdGNoVG8gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0bGV0IG5leHRTdGF0ZSA9IG1vbmFyY2hDb21tb24uc3Vic3RpdHV0ZU1hdGNoZXModGhpcy5fbGV4ZXIsIGFjdGlvbi5zd2l0Y2hUbywgbWF0Y2hlZCwgbWF0Y2hlcywgc3RhdGUpOyAgLy8gc3dpdGNoIHN0YXRlIHdpdGhvdXQgYSBwdXNoLi4uXG5cdFx0XHRcdFx0aWYgKG5leHRTdGF0ZVswXSA9PT0gJ0AnKSB7XG5cdFx0XHRcdFx0XHRuZXh0U3RhdGUgPSBuZXh0U3RhdGUuc3Vic3RyKDEpOyAvLyBwZWVsIG9mZiBzdGFydGluZyAnQCdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFtb25hcmNoQ29tbW9uLmZpbmRSdWxlcyh0aGlzLl9sZXhlciwgbmV4dFN0YXRlKSkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcih0aGlzLl9sZXhlciwgJ3RyeWluZyB0byBzd2l0Y2ggdG8gYSBzdGF0ZSBcXCcnICsgbmV4dFN0YXRlICsgJ1xcJyB0aGF0IGlzIHVuZGVmaW5lZCBpbiBydWxlOiAnICsgdGhpcy5fc2FmZVJ1bGVOYW1lKHJ1bGUpKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0c3RhY2sgPSBzdGFjay5zd2l0Y2hUbyhuZXh0U3RhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChhY3Rpb24udHJhbnNmb3JtICYmIHR5cGVvZiBhY3Rpb24udHJhbnNmb3JtID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcih0aGlzLl9sZXhlciwgJ2FjdGlvbi50cmFuc2Zvcm0gbm90IHN1cHBvcnRlZCcpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGFjdGlvbi5uZXh0KSB7XG5cdFx0XHRcdFx0aWYgKGFjdGlvbi5uZXh0ID09PSAnQHB1c2gnKSB7XG5cdFx0XHRcdFx0XHRpZiAoc3RhY2suZGVwdGggPj0gdGhpcy5fbGV4ZXIubWF4U3RhY2spIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcih0aGlzLl9sZXhlciwgJ21heGltdW0gdG9rZW5pemVyIHN0YWNrIHNpemUgcmVhY2hlZDogWycgK1xuXHRcdFx0XHRcdFx0XHRcdHN0YWNrLnN0YXRlICsgJywnICsgc3RhY2sucGFyZW50IS5zdGF0ZSArICcsLi4uXScpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0c3RhY2sgPSBzdGFjay5wdXNoKHN0YXRlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2UgaWYgKGFjdGlvbi5uZXh0ID09PSAnQHBvcCcpIHtcblx0XHRcdFx0XHRcdGlmIChzdGFjay5kZXB0aCA8PSAxKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IodGhpcy5fbGV4ZXIsICd0cnlpbmcgdG8gcG9wIGFuIGVtcHR5IHN0YWNrIGluIHJ1bGU6ICcgKyB0aGlzLl9zYWZlUnVsZU5hbWUocnVsZSkpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0c3RhY2sgPSBzdGFjay5wb3AoKSE7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChhY3Rpb24ubmV4dCA9PT0gJ0Bwb3BhbGwnKSB7XG5cdFx0XHRcdFx0XHRzdGFjayA9IHN0YWNrLnBvcGFsbCgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRsZXQgbmV4dFN0YXRlID0gbW9uYXJjaENvbW1vbi5zdWJzdGl0dXRlTWF0Y2hlcyh0aGlzLl9sZXhlciwgYWN0aW9uLm5leHQsIG1hdGNoZWQsIG1hdGNoZXMsIHN0YXRlKTtcblx0XHRcdFx0XHRcdGlmIChuZXh0U3RhdGVbMF0gPT09ICdAJykge1xuXHRcdFx0XHRcdFx0XHRuZXh0U3RhdGUgPSBuZXh0U3RhdGUuc3Vic3RyKDEpOyAvLyBwZWVsIG9mZiBzdGFydGluZyAnQCdcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKCFtb25hcmNoQ29tbW9uLmZpbmRSdWxlcyh0aGlzLl9sZXhlciwgbmV4dFN0YXRlKSkge1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKHRoaXMuX2xleGVyLCAndHJ5aW5nIHRvIHNldCBhIG5leHQgc3RhdGUgXFwnJyArIG5leHRTdGF0ZSArICdcXCcgdGhhdCBpcyB1bmRlZmluZWQgaW4gcnVsZTogJyArIHRoaXMuX3NhZmVSdWxlTmFtZShydWxlKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRzdGFjayA9IHN0YWNrLnB1c2gobmV4dFN0YXRlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYWN0aW9uLmxvZyAmJiB0eXBlb2YgKGFjdGlvbi5sb2cpID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdG1vbmFyY2hDb21tb24ubG9nKHRoaXMuX2xleGVyLCB0aGlzLl9sZXhlci5sYW5ndWFnZUlkICsgJzogJyArIG1vbmFyY2hDb21tb24uc3Vic3RpdHV0ZU1hdGNoZXModGhpcy5fbGV4ZXIsIGFjdGlvbi5sb2csIG1hdGNoZWQsIG1hdGNoZXMsIHN0YXRlKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gY2hlY2sgcmVzdWx0XG5cdFx0XHRpZiAocmVzdWx0ID09PSBudWxsKSB7XG5cdFx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IodGhpcy5fbGV4ZXIsICdsZXhlciBydWxlIGhhcyBubyB3ZWxsLWRlZmluZWQgYWN0aW9uIGluIHJ1bGU6ICcgKyB0aGlzLl9zYWZlUnVsZU5hbWUocnVsZSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb21wdXRlTmV3U3RhdGVGb3JFbWJlZGRlZExhbmd1YWdlID0gKGVudGVyaW5nRW1iZWRkZWRMYW5ndWFnZTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdC8vIHN1cHBvcnQgbGFuZ3VhZ2UgbmFtZXMsIG1pbWUgdHlwZXMsIGFuZCBsYW5ndWFnZSBpZHNcblx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IChcblx0XHRcdFx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKGVudGVyaW5nRW1iZWRkZWRMYW5ndWFnZSlcblx0XHRcdFx0XHR8fCB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TWltZVR5cGUoZW50ZXJpbmdFbWJlZGRlZExhbmd1YWdlKVxuXHRcdFx0XHRcdHx8IGVudGVyaW5nRW1iZWRkZWRMYW5ndWFnZVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdGNvbnN0IGVtYmVkZGVkTGFuZ3VhZ2VEYXRhID0gdGhpcy5fZ2V0TmVzdGVkRW1iZWRkZWRMYW5ndWFnZURhdGEobGFuZ3VhZ2VJZCk7XG5cblx0XHRcdFx0aWYgKHBvcyA8IGxpbmVMZW5ndGgpIHtcblx0XHRcdFx0XHQvLyB0aGVyZSBpcyBjb250ZW50IGZyb20gdGhlIGVtYmVkZGVkIGxhbmd1YWdlIG9uIHRoaXMgbGluZVxuXHRcdFx0XHRcdGNvbnN0IHJlc3RPZkxpbmUgPSBsaW5lV2l0aG91dExGLnN1YnN0cihwb3MpO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9uZXN0ZWRUb2tlbml6ZShyZXN0T2ZMaW5lLCBoYXNFT0wsIE1vbmFyY2hMaW5lU3RhdGVGYWN0b3J5LmNyZWF0ZShzdGFjaywgZW1iZWRkZWRMYW5ndWFnZURhdGEpLCBvZmZzZXREZWx0YSArIHBvcywgdG9rZW5zQ29sbGVjdG9yKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gTW9uYXJjaExpbmVTdGF0ZUZhY3RvcnkuY3JlYXRlKHN0YWNrLCBlbWJlZGRlZExhbmd1YWdlRGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdC8vIGlzIHRoZSByZXN1bHQgYSBncm91cCBtYXRjaD9cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KHJlc3VsdCkpIHtcblx0XHRcdFx0aWYgKGdyb3VwTWF0Y2hpbmcgJiYgZ3JvdXBNYXRjaGluZy5ncm91cHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IodGhpcy5fbGV4ZXIsICdncm91cHMgY2Fubm90IGJlIG5lc3RlZDogJyArIHRoaXMuX3NhZmVSdWxlTmFtZShydWxlKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG1hdGNoZXMubGVuZ3RoICE9PSByZXN1bHQubGVuZ3RoICsgMSkge1xuXHRcdFx0XHRcdHRocm93IG1vbmFyY2hDb21tb24uY3JlYXRlRXJyb3IodGhpcy5fbGV4ZXIsICdtYXRjaGVkIG51bWJlciBvZiBncm91cHMgZG9lcyBub3QgbWF0Y2ggdGhlIG51bWJlciBvZiBhY3Rpb25zIGluIHJ1bGU6ICcgKyB0aGlzLl9zYWZlUnVsZU5hbWUocnVsZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCB0b3RhbExlbiA9IDA7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgbWF0Y2hlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHRvdGFsTGVuICs9IG1hdGNoZXNbaV0ubGVuZ3RoO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0b3RhbExlbiAhPT0gbWF0Y2hlZC5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKHRoaXMuX2xleGVyLCAnd2l0aCBncm91cHMsIGFsbCBjaGFyYWN0ZXJzIHNob3VsZCBiZSBtYXRjaGVkIGluIGNvbnNlY3V0aXZlIGdyb3VwcyBpbiBydWxlOiAnICsgdGhpcy5fc2FmZVJ1bGVOYW1lKHJ1bGUpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGdyb3VwTWF0Y2hpbmcgPSB7XG5cdFx0XHRcdFx0cnVsZTogcnVsZSxcblx0XHRcdFx0XHRtYXRjaGVzOiBtYXRjaGVzLFxuXHRcdFx0XHRcdGdyb3VwczogW11cblx0XHRcdFx0fTtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByZXN1bHQubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRncm91cE1hdGNoaW5nLmdyb3Vwc1tpXSA9IHtcblx0XHRcdFx0XHRcdGFjdGlvbjogcmVzdWx0W2ldLFxuXHRcdFx0XHRcdFx0bWF0Y2hlZDogbWF0Y2hlc1tpICsgMV1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cG9zIC09IG1hdGNoZWQubGVuZ3RoO1xuXHRcdFx0XHQvLyBjYWxsIHJlY3Vyc2l2ZWx5IHRvIGluaXRpYXRlIGZpcnN0IHJlc3VsdCBtYXRjaFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHJlZ3VsYXIgcmVzdWx0XG5cblx0XHRcdFx0Ly8gY2hlY2sgZm9yICdAcmVtYXRjaCdcblx0XHRcdFx0aWYgKHJlc3VsdCA9PT0gJ0ByZW1hdGNoJykge1xuXHRcdFx0XHRcdHBvcyAtPSBtYXRjaGVkLmxlbmd0aDtcblx0XHRcdFx0XHRtYXRjaGVkID0gJyc7ICAvLyBiZXR0ZXIgc2V0IHRoZSBuZXh0IHN0YXRlIHRvby4uXG5cdFx0XHRcdFx0bWF0Y2hlcyA9IG51bGw7XG5cdFx0XHRcdFx0cmVzdWx0ID0gJyc7XG5cblx0XHRcdFx0XHQvLyBFdmVuIHRob3VnaCBgQHJlbWF0Y2hgIHdhcyBzcGVjaWZpZWQsIGlmIGBuZXh0RW1iZWRkZWRgIGFsc28gc3BlY2lmaWVkLFxuXHRcdFx0XHRcdC8vIGEgc3RhdGUgdHJhbnNpdGlvbiBzaG91bGQgb2NjdXIuXG5cdFx0XHRcdFx0aWYgKGVudGVyaW5nRW1iZWRkZWRMYW5ndWFnZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGNvbXB1dGVOZXdTdGF0ZUZvckVtYmVkZGVkTGFuZ3VhZ2UoZW50ZXJpbmdFbWJlZGRlZExhbmd1YWdlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBjaGVjayBwcm9ncmVzc1xuXHRcdFx0XHRpZiAobWF0Y2hlZC5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRpZiAobGluZUxlbmd0aCA9PT0gMCB8fCBzdGFja0xlbjAgIT09IHN0YWNrLmRlcHRoIHx8IHN0YXRlICE9PSBzdGFjay5zdGF0ZSB8fCAoIWdyb3VwTWF0Y2hpbmcgPyAwIDogZ3JvdXBNYXRjaGluZy5ncm91cHMubGVuZ3RoKSAhPT0gZ3JvdXBMZW4wKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhyb3cgbW9uYXJjaENvbW1vbi5jcmVhdGVFcnJvcih0aGlzLl9sZXhlciwgJ25vIHByb2dyZXNzIGluIHRva2VuaXplciBpbiBydWxlOiAnICsgdGhpcy5fc2FmZVJ1bGVOYW1lKHJ1bGUpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyByZXR1cm4gdGhlIHJlc3VsdCAoYW5kIGNoZWNrIGZvciBicmFjZSBtYXRjaGluZylcblx0XHRcdFx0Ly8gdG9kbzogZm9yIGVmZmljaWVuY3kgd2UgY291bGQgcHJlLXNhbml0aXplIHRva2VuUG9zdGZpeCBhbmQgc3Vic3RpdHV0aW9uc1xuXHRcdFx0XHRsZXQgdG9rZW5UeXBlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0XHRcdFx0aWYgKG1vbmFyY2hDb21tb24uaXNTdHJpbmcocmVzdWx0KSAmJiByZXN1bHQuaW5kZXhPZignQGJyYWNrZXRzJykgPT09IDApIHtcblx0XHRcdFx0XHRjb25zdCByZXN0ID0gcmVzdWx0LnN1YnN0cignQGJyYWNrZXRzJy5sZW5ndGgpO1xuXHRcdFx0XHRcdGNvbnN0IGJyYWNrZXQgPSBmaW5kQnJhY2tldCh0aGlzLl9sZXhlciwgbWF0Y2hlZCk7XG5cdFx0XHRcdFx0aWYgKCFicmFja2V0KSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBtb25hcmNoQ29tbW9uLmNyZWF0ZUVycm9yKHRoaXMuX2xleGVyLCAnQGJyYWNrZXRzIHRva2VuIHJldHVybmVkIGJ1dCBubyBicmFja2V0IGRlZmluZWQgYXM6ICcgKyBtYXRjaGVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dG9rZW5UeXBlID0gbW9uYXJjaENvbW1vbi5zYW5pdGl6ZShicmFja2V0LnRva2VuICsgcmVzdCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgdG9rZW4gPSAocmVzdWx0ID09PSAnJyA/ICcnIDogcmVzdWx0ICsgdGhpcy5fbGV4ZXIudG9rZW5Qb3N0Zml4KTtcblx0XHRcdFx0XHR0b2tlblR5cGUgPSBtb25hcmNoQ29tbW9uLnNhbml0aXplKHRva2VuKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChwb3MwIDwgbGluZVdpdGhvdXRMRkxlbmd0aCkge1xuXHRcdFx0XHRcdHRva2Vuc0NvbGxlY3Rvci5lbWl0KHBvczAgKyBvZmZzZXREZWx0YSwgdG9rZW5UeXBlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZW50ZXJpbmdFbWJlZGRlZExhbmd1YWdlICE9PSBudWxsKSB7XG5cdFx0XHRcdHJldHVybiBjb21wdXRlTmV3U3RhdGVGb3JFbWJlZGRlZExhbmd1YWdlKGVudGVyaW5nRW1iZWRkZWRMYW5ndWFnZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1vbmFyY2hMaW5lU3RhdGVGYWN0b3J5LmNyZWF0ZShzdGFjaywgZW1iZWRkZWRMYW5ndWFnZURhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TmVzdGVkRW1iZWRkZWRMYW5ndWFnZURhdGEobGFuZ3VhZ2VJZDogc3RyaW5nKTogRW1iZWRkZWRMYW5ndWFnZURhdGEge1xuXHRcdGlmICghdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmlzUmVnaXN0ZXJlZExhbmd1YWdlSWQobGFuZ3VhZ2VJZCkpIHtcblx0XHRcdHJldHVybiBuZXcgRW1iZWRkZWRMYW5ndWFnZURhdGEobGFuZ3VhZ2VJZCwgTnVsbFN0YXRlKTtcblx0XHR9XG5cblx0XHRpZiAobGFuZ3VhZ2VJZCAhPT0gdGhpcy5fbGFuZ3VhZ2VJZCkge1xuXHRcdFx0Ly8gRmlyZSBsYW5ndWFnZSBsb2FkaW5nIGV2ZW50XG5cdFx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2UucmVxdWVzdEJhc2ljTGFuZ3VhZ2VGZWF0dXJlcyhsYW5ndWFnZUlkKTtcblx0XHRcdGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZWdpc3RyeS5nZXRPckNyZWF0ZShsYW5ndWFnZUlkKTtcblx0XHRcdHRoaXMuX2VtYmVkZGVkTGFuZ3VhZ2VzW2xhbmd1YWdlSWRdID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCB0b2tlbml6YXRpb25TdXBwb3J0ID0gbGFuZ3VhZ2VzLlRva2VuaXphdGlvblJlZ2lzdHJ5LmdldChsYW5ndWFnZUlkKTtcblx0XHRpZiAodG9rZW5pemF0aW9uU3VwcG9ydCkge1xuXHRcdFx0cmV0dXJuIG5ldyBFbWJlZGRlZExhbmd1YWdlRGF0YShsYW5ndWFnZUlkLCB0b2tlbml6YXRpb25TdXBwb3J0LmdldEluaXRpYWxTdGF0ZSgpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IEVtYmVkZGVkTGFuZ3VhZ2VEYXRhKGxhbmd1YWdlSWQsIE51bGxTdGF0ZSk7XG5cdH1cbn1cblxuLyoqXG4gKiBTZWFyY2hlcyBmb3IgYSBicmFja2V0IGluIHRoZSAnYnJhY2tldHMnIGF0dHJpYnV0ZSB0aGF0IG1hdGNoZXMgdGhlIGlucHV0LlxuICovXG5mdW5jdGlvbiBmaW5kQnJhY2tldChsZXhlcjogbW9uYXJjaENvbW1vbi5JTGV4ZXIsIG1hdGNoZWQ6IHN0cmluZykge1xuXHRpZiAoIW1hdGNoZWQpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXHRtYXRjaGVkID0gbW9uYXJjaENvbW1vbi5maXhDYXNlKGxleGVyLCBtYXRjaGVkKTtcblxuXHRjb25zdCBicmFja2V0cyA9IGxleGVyLmJyYWNrZXRzO1xuXHRmb3IgKGNvbnN0IGJyYWNrZXQgb2YgYnJhY2tldHMpIHtcblx0XHRpZiAoYnJhY2tldC5vcGVuID09PSBtYXRjaGVkKSB7XG5cdFx0XHRyZXR1cm4geyB0b2tlbjogYnJhY2tldC50b2tlbiwgYnJhY2tldFR5cGU6IG1vbmFyY2hDb21tb24uTW9uYXJjaEJyYWNrZXQuT3BlbiB9O1xuXHRcdH1cblx0XHRlbHNlIGlmIChicmFja2V0LmNsb3NlID09PSBtYXRjaGVkKSB7XG5cdFx0XHRyZXR1cm4geyB0b2tlbjogYnJhY2tldC50b2tlbiwgYnJhY2tldFR5cGU6IG1vbmFyY2hDb21tb24uTW9uYXJjaEJyYWNrZXQuQ2xvc2UgfTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG51bGw7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQVVBLFNBQVMsa0JBQStCO0FBQ3hDLFlBQVksZUFBZTtBQUMzQixTQUFTLFdBQVcscUJBQXFCLG9CQUFvQjtBQUc3RCxZQUFZLG1CQUFtQjtBQUUvQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLFlBQVksc0JBQXNCO0FBRTNDLE1BQU0sb0JBQW9CO0FBSzFCLE1BQU0sOEJBQU4sTUFBTSw0QkFBMkI7QUFBQSxFQUdoQyxPQUFjLE9BQU8sUUFBb0MsT0FBb0M7QUFDNUYsV0FBTyxLQUFLLFVBQVUsT0FBTyxRQUFRLEtBQUs7QUFBQSxFQUMzQztBQUFBLEVBS0EsWUFBWSxlQUF1QjtBQUNsQyxTQUFLLGlCQUFpQjtBQUN0QixTQUFLLFdBQVcsdUJBQU8sT0FBTyxJQUFJ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QUFNLFVBQVUsWUFBWSxLQUFLLFFBQVEsT0FBTztBQUNoRCxjQUFJLENBQUMsU0FBUztBQUNiLGtCQUFNLGNBQWMsWUFBWSxLQUFLLFFBQVEseURBQXlELE9BQU87QUFBQSxVQUM5RztBQUNBLHNCQUFZLGNBQWMsU0FBUyxRQUFRLFFBQVEsSUFBSTtBQUFBLFFBQ3hELE9BQU87QUFDTixnQkFBTSxRQUFTLFdBQVcsS0FBSyxLQUFLLFNBQVMsS0FBSyxPQUFPO0FBQ3pELHNCQUFZLGNBQWMsU0FBUyxLQUFLO0FBQUEsUUFDekM7QUFFQSxZQUFJLE9BQU8scUJBQXFCO0FBQy9CLDBCQUFnQixLQUFLLE9BQU8sYUFBYSxTQUFTO0FBQUEsUUFDbkQ7QUFBQSxNQUNEO0FBRUEsVUFBSSw2QkFBNkIsTUFBTTtBQUN0QyxlQUFPLG1DQUFtQyx3QkFBd0I7QUFBQSxNQUNuRTtBQUFBLElBQ0Q7QUFFQSxXQUFPLHdCQUF3QixPQUFPLE9BQU8sb0JBQW9CO0FBQUEsRUFDbEU7QUFBQSxFQUVRLCtCQUErQixZQUEwQztBQUNoRixRQUFJLENBQUMsS0FBSyxpQkFBaUIsdUJBQXVCLFVBQVUsR0FBRztBQUM5RCxhQUFPLElBQUkscUJBQXFCLFlBQVksU0FBUztBQUFBLElBQ3REO0FBRUEsUUFBSSxlQUFlLEtBQUssYUFBYTtBQUVwQyxXQUFLLGlCQUFpQiw2QkFBNkIsVUFBVTtBQUM3RCxnQkFBVSxxQkFBcUIsWUFBWSxVQUFVO0FBQ3JELFdBQUssbUJBQW1CLFVBQVUsSUFBSTtBQUFBLElBQ3ZDO0FBRUEsVUFBTSxzQkFBc0IsVUFBVSxxQkFBcUIsSUFBSSxVQUFVO0FBQ3pFLFFBQUkscUJBQXFCO0FBQ3hCLGFBQU8sSUFBSSxxQkFBcUIsWUFBWSxvQkFBb0IsZ0JBQWdCLENBQUM7QUFBQSxJQUNsRjtBQUVBLFdBQU8sSUFBSSxxQkFBcUIsWUFBWSxTQUFTO0FBQUEsRUFDdEQ7QUFDRDtBQXhmYSxtQkFBTjtBQUFBLEVBVTRJO0FBQUEsR0FWdEk7QUE2ZmIsU0FBUyxZQUFZLE9BQTZCLFNBQWlCO0FBQ2xFLE1BQUksQ0FBQyxTQUFTO0FBQ2IsV0FBTztBQUFBLEVBQ1I7QUFDQSxZQUFVLGNBQWMsUUFBUSxPQUFPLE9BQU87QUFFOUMsUUFBTSxXQUFXLE1BQU07QUFDdkIsYUFBVyxXQUFXLFVBQVU7QUFDL0IsUUFBSSxRQUFRLFNBQVMsU0FBUztBQUM3QixhQUFPLEVBQUUsT0FBTyxRQUFRLE9BQU8sYUFBYSxjQUFjLGVBQWUsS0FBSztBQUFBLElBQy9FLFdBQ1MsUUFBUSxVQUFVLFNBQVM7QUFDbkMsYUFBTyxFQUFFLE9BQU8sUUFBUSxPQUFPLGFBQWEsY0FBYyxlQUFlLE1BQU07QUFBQSxJQUNoRjtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbInJ1bGUiLCAiZW50ZXJpbmdFbWJlZGRlZExhbmd1YWdlIiwgImVtYmVkZGVkTGFuZ3VhZ2VEYXRhIl0KfQo=
