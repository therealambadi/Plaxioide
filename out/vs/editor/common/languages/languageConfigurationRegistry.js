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
import { Emitter } from "../../../base/common/event.js";
import { Disposable, markAsSingleton, toDisposable } from "../../../base/common/lifecycle.js";
import * as strings from "../../../base/common/strings.js";
import { DEFAULT_WORD_REGEXP, ensureValidWordDefinition } from "../core/wordHelper.js";
import { AutoClosingPairs } from "./languageConfiguration.js";
import { CharacterPairSupport } from "./supports/characterPair.js";
import { BracketElectricCharacterSupport } from "./supports/electricCharacter.js";
import { IndentRulesSupport } from "./supports/indentRules.js";
import { OnEnterSupport } from "./supports/onEnter.js";
import { RichEditBrackets } from "./supports/richEditBrackets.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { ILanguageService } from "./language.js";
import { InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { PLAINTEXT_LANGUAGE_ID } from "./modesRegistry.js";
import { LanguageBracketsConfiguration } from "./supports/languageBracketsConfiguration.js";
class LanguageConfigurationServiceChangeEvent {
  constructor(languageId) {
    this.languageId = languageId;
  }
  affects(languageId) {
    return !this.languageId ? true : this.languageId === languageId;
  }
}
const ILanguageConfigurationService = createDecorator("languageConfigurationService");
let LanguageConfigurationService = class extends Disposable {
  constructor(configurationService, languageService) {
    super();
    this.configurationService = configurationService;
    this.languageService = languageService;
    this._registry = this._register(new LanguageConfigurationRegistry());
    this.onDidChangeEmitter = this._register(new Emitter());
    this.onDidChange = this.onDidChangeEmitter.event;
    this.configurations = /* @__PURE__ */ new Map();
    const languageConfigKeys = new Set(Object.values(customizedLanguageConfigKeys));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      const globalConfigChanged = e.change.keys.some(
        (k) => languageConfigKeys.has(k)
      );
      const localConfigChanged = e.change.overrides.filter(
        ([overrideLangName, keys]) => keys.some((k) => languageConfigKeys.has(k))
      ).map(([overrideLangName]) => overrideLangName);
      if (globalConfigChanged) {
        this.configurations.clear();
        this.onDidChangeEmitter.fire(new LanguageConfigurationServiceChangeEvent(void 0));
      } else {
        for (const languageId of localConfigChanged) {
          if (this.languageService.isRegisteredLanguageId(languageId)) {
            this.configurations.delete(languageId);
            this.onDidChangeEmitter.fire(new LanguageConfigurationServiceChangeEvent(languageId));
          }
        }
      }
    }));
    this._register(this._registry.onDidChange((e) => {
      this.configurations.delete(e.languageId);
      this.onDidChangeEmitter.fire(new LanguageConfigurationServiceChangeEvent(e.languageId));
    }));
  }
  register(languageId, configuration, priority) {
    return this._registry.register(languageId, configuration, priority);
  }
  getLanguageConfiguration(languageId) {
    let result = this.configurations.get(languageId);
    if (!result) {
      result = computeConfig(languageId, this._registry, this.configurationService, this.languageService);
      this.configurations.set(languageId, result);
    }
    return result;
  }
};
LanguageConfigurationService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ILanguageService)
], LanguageConfigurationService);
function computeConfig(languageId, registry, configurationService, languageService) {
  let languageConfig = registry.getLanguageConfiguration(languageId);
  if (!languageConfig) {
    if (!languageService.isRegisteredLanguageId(languageId)) {
      return new ResolvedLanguageConfiguration(languageId, {});
    }
    languageConfig = new ResolvedLanguageConfiguration(languageId, {});
  }
  const customizedConfig = getCustomizedLanguageConfig(languageConfig.languageId, configurationService);
  const data = combineLanguageConfigurations([languageConfig.underlyingConfig, customizedConfig]);
  const config = new ResolvedLanguageConfiguration(languageConfig.languageId, data);
  return config;
}
const customizedLanguageConfigKeys = {
  brackets: "editor.language.brackets",
  colorizedBracketPairs: "editor.language.colorizedBracketPairs"
};
function getCustomizedLanguageConfig(languageId, configurationService) {
  const brackets = configurationService.getValue(customizedLanguageConfigKeys.brackets, {
    overrideIdentifier: languageId
  });
  const colorizedBracketPairs = configurationService.getValue(customizedLanguageConfigKeys.colorizedBracketPairs, {
    overrideIdentifier: languageId
  });
  return {
    brackets: validateBracketPairs(brackets),
    colorizedBracketPairs: validateBracketPairs(colorizedBracketPairs)
  };
}
function validateBracketPairs(data) {
  if (!Array.isArray(data)) {
    return void 0;
  }
  return data.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      return void 0;
    }
    return [pair[0], pair[1]];
  }).filter((p) => !!p);
}
function getIndentationAtPosition(model, lineNumber, column) {
  const lineText = model.getLineContent(lineNumber);
  let indentation = strings.getLeadingWhitespace(lineText);
  if (indentation.length > column - 1) {
    indentation = indentation.substring(0, column - 1);
  }
  return indentation;
}
class ComposedLanguageConfiguration {
  constructor(languageId) {
    this.languageId = languageId;
    this._resolved = null;
    this._entries = [];
    this._order = 0;
    this._resolved = null;
  }
  register(configuration, priority) {
    const entry = new LanguageConfigurationContribution(
      configuration,
      priority,
      ++this._order
    );
    this._entries.push(entry);
    this._resolved = null;
    return markAsSingleton(toDisposable(() => {
      for (let i = 0; i < this._entries.length; i++) {
        if (this._entries[i] === entry) {
          this._entries.splice(i, 1);
          this._resolved = null;
          break;
        }
      }
    }));
  }
  getResolvedConfiguration() {
    if (!this._resolved) {
      const config = this._resolve();
      if (config) {
        this._resolved = new ResolvedLanguageConfiguration(
          this.languageId,
          config
        );
      }
    }
    return this._resolved;
  }
  _resolve() {
    if (this._entries.length === 0) {
      return null;
    }
    this._entries.sort(LanguageConfigurationContribution.cmp);
    return combineLanguageConfigurations(this._entries.map((e) => e.configuration));
  }
}
function combineLanguageConfigurations(configs) {
  let result = {
    comments: void 0,
    brackets: void 0,
    wordPattern: void 0,
    indentationRules: void 0,
    onEnterRules: void 0,
    autoClosingPairs: void 0,
    surroundingPairs: void 0,
    autoCloseBefore: void 0,
    folding: void 0,
    colorizedBracketPairs: void 0,
    __electricCharacterSupport: void 0
  };
  for (const entry of configs) {
    result = {
      comments: entry.comments || result.comments,
      brackets: entry.brackets || result.brackets,
      wordPattern: entry.wordPattern || result.wordPattern,
      indentationRules: entry.indentationRules || result.indentationRules,
      onEnterRules: entry.onEnterRules || result.onEnterRules,
      autoClosingPairs: entry.autoClosingPairs || result.autoClosingPairs,
      surroundingPairs: entry.surroundingPairs || result.surroundingPairs,
      autoCloseBefore: entry.autoCloseBefore || result.autoCloseBefore,
      folding: entry.folding || result.folding,
      colorizedBracketPairs: entry.colorizedBracketPairs || result.colorizedBracketPairs,
      __electricCharacterSupport: entry.__electricCharacterSupport || result.__electricCharacterSupport
    };
  }
  return result;
}
class LanguageConfigurationContribution {
  constructor(configuration, priority, order) {
    this.configuration = configuration;
    this.priority = priority;
    this.order = order;
  }
  static cmp(a, b) {
    if (a.priority === b.priority) {
      return a.order - b.order;
    }
    return a.priority - b.priority;
  }
}
class LanguageConfigurationChangeEvent {
  constructor(languageId) {
    this.languageId = languageId;
  }
}
class LanguageConfigurationRegistry extends Disposable {
  constructor() {
    super();
    this._entries = /* @__PURE__ */ new Map();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._register(this.register(PLAINTEXT_LANGUAGE_ID, {
      brackets: [
        ["(", ")"],
        ["[", "]"],
        ["{", "}"]
      ],
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "<", close: ">" },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: "`", close: "`" }
      ],
      colorizedBracketPairs: [],
      folding: {
        offSide: true
      }
    }, 0));
  }
  /**
   * @param priority Use a higher number for higher priority
   */
  register(languageId, configuration, priority = 0) {
    let entries = this._entries.get(languageId);
    if (!entries) {
      entries = new ComposedLanguageConfiguration(languageId);
      this._entries.set(languageId, entries);
    }
    const disposable = entries.register(configuration, priority);
    this._onDidChange.fire(new LanguageConfigurationChangeEvent(languageId));
    return markAsSingleton(toDisposable(() => {
      disposable.dispose();
      this._onDidChange.fire(new LanguageConfigurationChangeEvent(languageId));
    }));
  }
  getLanguageConfiguration(languageId) {
    const entries = this._entries.get(languageId);
    return entries?.getResolvedConfiguration() || null;
  }
}
class ResolvedLanguageConfiguration {
  constructor(languageId, underlyingConfig) {
    this.languageId = languageId;
    this.underlyingConfig = underlyingConfig;
    this._brackets = null;
    this._electricCharacter = null;
    this._onEnterSupport = this.underlyingConfig.brackets || this.underlyingConfig.indentationRules || this.underlyingConfig.onEnterRules ? new OnEnterSupport(this.underlyingConfig) : null;
    this.comments = ResolvedLanguageConfiguration._handleComments(this.underlyingConfig);
    this.characterPair = new CharacterPairSupport(this.underlyingConfig);
    this.wordDefinition = this.underlyingConfig.wordPattern || DEFAULT_WORD_REGEXP;
    this.indentationRules = this.underlyingConfig.indentationRules;
    if (this.underlyingConfig.indentationRules) {
      this.indentRulesSupport = new IndentRulesSupport(
        this.underlyingConfig.indentationRules
      );
    } else {
      this.indentRulesSupport = null;
    }
    this.foldingRules = this.underlyingConfig.folding || {};
    this.bracketsNew = new LanguageBracketsConfiguration(
      languageId,
      this.underlyingConfig
    );
  }
  getWordDefinition() {
    return ensureValidWordDefinition(this.wordDefinition);
  }
  get brackets() {
    if (!this._brackets && this.underlyingConfig.brackets) {
      this._brackets = new RichEditBrackets(
        this.languageId,
        this.underlyingConfig.brackets
      );
    }
    return this._brackets;
  }
  get electricCharacter() {
    if (!this._electricCharacter) {
      this._electricCharacter = new BracketElectricCharacterSupport(
        this.brackets
      );
    }
    return this._electricCharacter;
  }
  onEnter(autoIndent, previousLineText, beforeEnterText, afterEnterText) {
    if (!this._onEnterSupport) {
      return null;
    }
    return this._onEnterSupport.onEnter(
      autoIndent,
      previousLineText,
      beforeEnterText,
      afterEnterText
    );
  }
  getAutoClosingPairs() {
    return new AutoClosingPairs(this.characterPair.getAutoClosingPairs());
  }
  getAutoCloseBeforeSet(forQuotes) {
    return this.characterPair.getAutoCloseBeforeSet(forQuotes);
  }
  getSurroundingPairs() {
    return this.characterPair.getSurroundingPairs();
  }
  static _handleComments(conf) {
    const commentRule = conf.comments;
    if (!commentRule) {
      return null;
    }
    const comments = {};
    if (commentRule.lineComment) {
      comments.lineCommentToken = commentRule.lineComment;
    }
    if (commentRule.blockComment) {
      const [blockStart, blockEnd] = commentRule.blockComment;
      comments.blockCommentStartToken = blockStart;
      comments.blockCommentEndToken = blockEnd;
    }
    return comments;
  }
}
registerSingleton(ILanguageConfigurationService, LanguageConfigurationService, InstantiationType.Delayed);
export {
  ILanguageConfigurationService,
  LanguageConfigurationChangeEvent,
  LanguageConfigurationRegistry,
  LanguageConfigurationService,
  LanguageConfigurationServiceChangeEvent,
  ResolvedLanguageConfiguration,
  getIndentationAtPosition
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIG1hcmtBc1NpbmdsZXRvbiwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vbW9kZWwuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9XT1JEX1JFR0VYUCwgZW5zdXJlVmFsaWRXb3JkRGVmaW5pdGlvbiB9IGZyb20gJy4uL2NvcmUvd29yZEhlbHBlci5qcyc7XG5pbXBvcnQgeyBFbnRlckFjdGlvbiwgRm9sZGluZ1J1bGVzLCBJQXV0b0Nsb3NpbmdQYWlyLCBJbmRlbnRhdGlvblJ1bGUsIExhbmd1YWdlQ29uZmlndXJhdGlvbiwgQXV0b0Nsb3NpbmdQYWlycywgQ2hhcmFjdGVyUGFpciwgRXhwbGljaXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuL2xhbmd1YWdlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDaGFyYWN0ZXJQYWlyU3VwcG9ydCB9IGZyb20gJy4vc3VwcG9ydHMvY2hhcmFjdGVyUGFpci5qcyc7XG5pbXBvcnQgeyBCcmFja2V0RWxlY3RyaWNDaGFyYWN0ZXJTdXBwb3J0IH0gZnJvbSAnLi9zdXBwb3J0cy9lbGVjdHJpY0NoYXJhY3Rlci5qcyc7XG5pbXBvcnQgeyBJbmRlbnRSdWxlc1N1cHBvcnQgfSBmcm9tICcuL3N1cHBvcnRzL2luZGVudFJ1bGVzLmpzJztcbmltcG9ydCB7IE9uRW50ZXJTdXBwb3J0IH0gZnJvbSAnLi9zdXBwb3J0cy9vbkVudGVyLmpzJztcbmltcG9ydCB7IFJpY2hFZGl0QnJhY2tldHMgfSBmcm9tICcuL3N1cHBvcnRzL3JpY2hFZGl0QnJhY2tldHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5IH0gZnJvbSAnLi4vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUExBSU5URVhUX0xBTkdVQUdFX0lEIH0gZnJvbSAnLi9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IExhbmd1YWdlQnJhY2tldHNDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9zdXBwb3J0cy9sYW5ndWFnZUJyYWNrZXRzQ29uZmlndXJhdGlvbi5qcyc7XG5cbi8qKlxuICogSW50ZXJmYWNlIHVzZWQgdG8gc3VwcG9ydCBpbnNlcnRpb24gb2YgbW9kZSBzcGVjaWZpYyBjb21tZW50cy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJQ29tbWVudHNDb25maWd1cmF0aW9uIHtcblx0bGluZUNvbW1lbnRUb2tlbj86IHN0cmluZztcblx0YmxvY2tDb21tZW50U3RhcnRUb2tlbj86IHN0cmluZztcblx0YmxvY2tDb21tZW50RW5kVG9rZW4/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0b25EaWRDaGFuZ2U6IEV2ZW50PExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2VDaGFuZ2VFdmVudD47XG5cblx0LyoqXG5cdCAqIEBwYXJhbSBwcmlvcml0eSBVc2UgYSBoaWdoZXIgbnVtYmVyIGZvciBoaWdoZXIgcHJpb3JpdHlcblx0ICovXG5cdHJlZ2lzdGVyKGxhbmd1YWdlSWQ6IHN0cmluZywgY29uZmlndXJhdGlvbjogTGFuZ3VhZ2VDb25maWd1cmF0aW9uLCBwcmlvcml0eT86IG51bWJlcik6IElEaXNwb3NhYmxlO1xuXG5cdGdldExhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUlkOiBzdHJpbmcpOiBSZXNvbHZlZExhbmd1YWdlQ29uZmlndXJhdGlvbjtcblxufVxuXG5leHBvcnQgY2xhc3MgTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZUNoYW5nZUV2ZW50IHtcblx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IGxhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCkgeyB9XG5cblx0cHVibGljIGFmZmVjdHMobGFuZ3VhZ2VJZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLmxhbmd1YWdlSWQgPyB0cnVlIDogdGhpcy5sYW5ndWFnZUlkID09PSBsYW5ndWFnZUlkO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZT4oJ2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UnKTtcblxuZXhwb3J0IGNsYXNzIExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVnaXN0cnkgPSB0aGlzLl9yZWdpc3RlcihuZXcgTGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkoKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZENoYW5nZUVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlQ2hhbmdlRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLm9uRGlkQ2hhbmdlRW1pdHRlci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIFJlc29sdmVkTGFuZ3VhZ2VDb25maWd1cmF0aW9uPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ0tleXMgPSBuZXcgU2V0KE9iamVjdC52YWx1ZXMoY3VzdG9taXplZExhbmd1YWdlQ29uZmlnS2V5cykpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKGUpID0+IHtcblx0XHRcdGNvbnN0IGdsb2JhbENvbmZpZ0NoYW5nZWQgPSBlLmNoYW5nZS5rZXlzLnNvbWUoKGspID0+XG5cdFx0XHRcdGxhbmd1YWdlQ29uZmlnS2V5cy5oYXMoaylcblx0XHRcdCk7XG5cdFx0XHRjb25zdCBsb2NhbENvbmZpZ0NoYW5nZWQgPSBlLmNoYW5nZS5vdmVycmlkZXNcblx0XHRcdFx0LmZpbHRlcigoW292ZXJyaWRlTGFuZ05hbWUsIGtleXNdKSA9PlxuXHRcdFx0XHRcdGtleXMuc29tZSgoaykgPT4gbGFuZ3VhZ2VDb25maWdLZXlzLmhhcyhrKSlcblx0XHRcdFx0KVxuXHRcdFx0XHQubWFwKChbb3ZlcnJpZGVMYW5nTmFtZV0pID0+IG92ZXJyaWRlTGFuZ05hbWUpO1xuXG5cdFx0XHRpZiAoZ2xvYmFsQ29uZmlnQ2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25zLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMub25EaWRDaGFuZ2VFbWl0dGVyLmZpcmUobmV3IExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2VDaGFuZ2VFdmVudCh1bmRlZmluZWQpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvciAoY29uc3QgbGFuZ3VhZ2VJZCBvZiBsb2NhbENvbmZpZ0NoYW5nZWQpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5sYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9ucy5kZWxldGUobGFuZ3VhZ2VJZCk7XG5cdFx0XHRcdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRW1pdHRlci5maXJlKG5ldyBMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlQ2hhbmdlRXZlbnQobGFuZ3VhZ2VJZCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3JlZ2lzdHJ5Lm9uRGlkQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25zLmRlbGV0ZShlLmxhbmd1YWdlSWQpO1xuXHRcdFx0dGhpcy5vbkRpZENoYW5nZUVtaXR0ZXIuZmlyZShuZXcgTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZUNoYW5nZUV2ZW50KGUubGFuZ3VhZ2VJZCkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlcihsYW5ndWFnZUlkOiBzdHJpbmcsIGNvbmZpZ3VyYXRpb246IExhbmd1YWdlQ29uZmlndXJhdGlvbiwgcHJpb3JpdHk/OiBudW1iZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlZ2lzdHJ5LnJlZ2lzdGVyKGxhbmd1YWdlSWQsIGNvbmZpZ3VyYXRpb24sIHByaW9yaXR5KTtcblx0fVxuXG5cdHB1YmxpYyBnZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24obGFuZ3VhZ2VJZDogc3RyaW5nKTogUmVzb2x2ZWRMYW5ndWFnZUNvbmZpZ3VyYXRpb24ge1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLmNvbmZpZ3VyYXRpb25zLmdldChsYW5ndWFnZUlkKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmVzdWx0ID0gY29tcHV0ZUNvbmZpZyhsYW5ndWFnZUlkLCB0aGlzLl9yZWdpc3RyeSwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5sYW5ndWFnZVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9ucy5zZXQobGFuZ3VhZ2VJZCwgcmVzdWx0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5mdW5jdGlvbiBjb21wdXRlQ29uZmlnKFxuXHRsYW5ndWFnZUlkOiBzdHJpbmcsXG5cdHJlZ2lzdHJ5OiBMYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeSxcblx0Y29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0bGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuKTogUmVzb2x2ZWRMYW5ndWFnZUNvbmZpZ3VyYXRpb24ge1xuXHRsZXQgbGFuZ3VhZ2VDb25maWcgPSByZWdpc3RyeS5nZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24obGFuZ3VhZ2VJZCk7XG5cblx0aWYgKCFsYW5ndWFnZUNvbmZpZykge1xuXHRcdGlmICghbGFuZ3VhZ2VTZXJ2aWNlLmlzUmVnaXN0ZXJlZExhbmd1YWdlSWQobGFuZ3VhZ2VJZCkpIHtcblx0XHRcdC8vIHRoaXMgaGFwcGVucyBmb3IgdGhlIG51bGwgbGFuZ3VhZ2UsIHdoaWNoIGNhbiBiZSByZXR1cm5lZCBieSBtb25hcmNoLlxuXHRcdFx0Ly8gSW5zdGVhZCBvZiB0aHJvd2luZyBhbiBlcnJvciwgd2UganVzdCByZXR1cm4gYSBkZWZhdWx0IGNvbmZpZy5cblx0XHRcdHJldHVybiBuZXcgUmVzb2x2ZWRMYW5ndWFnZUNvbmZpZ3VyYXRpb24obGFuZ3VhZ2VJZCwge30pO1xuXHRcdH1cblx0XHRsYW5ndWFnZUNvbmZpZyA9IG5ldyBSZXNvbHZlZExhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUlkLCB7fSk7XG5cdH1cblxuXHRjb25zdCBjdXN0b21pemVkQ29uZmlnID0gZ2V0Q3VzdG9taXplZExhbmd1YWdlQ29uZmlnKGxhbmd1YWdlQ29uZmlnLmxhbmd1YWdlSWQsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0Y29uc3QgZGF0YSA9IGNvbWJpbmVMYW5ndWFnZUNvbmZpZ3VyYXRpb25zKFtsYW5ndWFnZUNvbmZpZy51bmRlcmx5aW5nQ29uZmlnLCBjdXN0b21pemVkQ29uZmlnXSk7XG5cdGNvbnN0IGNvbmZpZyA9IG5ldyBSZXNvbHZlZExhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZy5sYW5ndWFnZUlkLCBkYXRhKTtcblx0cmV0dXJuIGNvbmZpZztcbn1cblxuY29uc3QgY3VzdG9taXplZExhbmd1YWdlQ29uZmlnS2V5cyA9IHtcblx0YnJhY2tldHM6ICdlZGl0b3IubGFuZ3VhZ2UuYnJhY2tldHMnLFxuXHRjb2xvcml6ZWRCcmFja2V0UGFpcnM6ICdlZGl0b3IubGFuZ3VhZ2UuY29sb3JpemVkQnJhY2tldFBhaXJzJ1xufTtcblxuZnVuY3Rpb24gZ2V0Q3VzdG9taXplZExhbmd1YWdlQ29uZmlnKGxhbmd1YWdlSWQ6IHN0cmluZywgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSk6IExhbmd1YWdlQ29uZmlndXJhdGlvbiB7XG5cdGNvbnN0IGJyYWNrZXRzID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoY3VzdG9taXplZExhbmd1YWdlQ29uZmlnS2V5cy5icmFja2V0cywge1xuXHRcdG92ZXJyaWRlSWRlbnRpZmllcjogbGFuZ3VhZ2VJZCxcblx0fSk7XG5cblx0Y29uc3QgY29sb3JpemVkQnJhY2tldFBhaXJzID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoY3VzdG9taXplZExhbmd1YWdlQ29uZmlnS2V5cy5jb2xvcml6ZWRCcmFja2V0UGFpcnMsIHtcblx0XHRvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlSWQsXG5cdH0pO1xuXG5cdHJldHVybiB7XG5cdFx0YnJhY2tldHM6IHZhbGlkYXRlQnJhY2tldFBhaXJzKGJyYWNrZXRzKSxcblx0XHRjb2xvcml6ZWRCcmFja2V0UGFpcnM6IHZhbGlkYXRlQnJhY2tldFBhaXJzKGNvbG9yaXplZEJyYWNrZXRQYWlycyksXG5cdH07XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlQnJhY2tldFBhaXJzKGRhdGE6IHVua25vd24pOiBDaGFyYWN0ZXJQYWlyW10gfCB1bmRlZmluZWQge1xuXHRpZiAoIUFycmF5LmlzQXJyYXkoZGF0YSkpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdHJldHVybiBkYXRhLm1hcChwYWlyID0+IHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkocGFpcikgfHwgcGFpci5sZW5ndGggIT09IDIpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBbcGFpclswXSwgcGFpclsxXV0gYXMgQ2hhcmFjdGVyUGFpcjtcblx0fSkuZmlsdGVyKChwKTogcCBpcyBDaGFyYWN0ZXJQYWlyID0+ICEhcCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmRlbnRhdGlvbkF0UG9zaXRpb24obW9kZWw6IElUZXh0TW9kZWwsIGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIpOiBzdHJpbmcge1xuXHRjb25zdCBsaW5lVGV4dCA9IG1vZGVsLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpO1xuXHRsZXQgaW5kZW50YXRpb24gPSBzdHJpbmdzLmdldExlYWRpbmdXaGl0ZXNwYWNlKGxpbmVUZXh0KTtcblx0aWYgKGluZGVudGF0aW9uLmxlbmd0aCA+IGNvbHVtbiAtIDEpIHtcblx0XHRpbmRlbnRhdGlvbiA9IGluZGVudGF0aW9uLnN1YnN0cmluZygwLCBjb2x1bW4gLSAxKTtcblx0fVxuXHRyZXR1cm4gaW5kZW50YXRpb247XG59XG5cbmNsYXNzIENvbXBvc2VkTGFuZ3VhZ2VDb25maWd1cmF0aW9uIHtcblx0cHJpdmF0ZSByZWFkb25seSBfZW50cmllczogTGFuZ3VhZ2VDb25maWd1cmF0aW9uQ29udHJpYnV0aW9uW107XG5cdHByaXZhdGUgX29yZGVyOiBudW1iZXI7XG5cdHByaXZhdGUgX3Jlc29sdmVkOiBSZXNvbHZlZExhbmd1YWdlQ29uZmlndXJhdGlvbiB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBsYW5ndWFnZUlkOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9lbnRyaWVzID0gW107XG5cdFx0dGhpcy5fb3JkZXIgPSAwO1xuXHRcdHRoaXMuX3Jlc29sdmVkID0gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3Rlcihcblx0XHRjb25maWd1cmF0aW9uOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb24sXG5cdFx0cHJpb3JpdHk6IG51bWJlclxuXHQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZW50cnkgPSBuZXcgTGFuZ3VhZ2VDb25maWd1cmF0aW9uQ29udHJpYnV0aW9uKFxuXHRcdFx0Y29uZmlndXJhdGlvbixcblx0XHRcdHByaW9yaXR5LFxuXHRcdFx0Kyt0aGlzLl9vcmRlclxuXHRcdCk7XG5cdFx0dGhpcy5fZW50cmllcy5wdXNoKGVudHJ5KTtcblx0XHR0aGlzLl9yZXNvbHZlZCA9IG51bGw7XG5cdFx0cmV0dXJuIG1hcmtBc1NpbmdsZXRvbih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9lbnRyaWVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9lbnRyaWVzW2ldID09PSBlbnRyeSkge1xuXHRcdFx0XHRcdHRoaXMuX2VudHJpZXMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdHRoaXMuX3Jlc29sdmVkID0gbnVsbDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRSZXNvbHZlZENvbmZpZ3VyYXRpb24oKTogUmVzb2x2ZWRMYW5ndWFnZUNvbmZpZ3VyYXRpb24gfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX3Jlc29sdmVkKSB7XG5cdFx0XHRjb25zdCBjb25maWcgPSB0aGlzLl9yZXNvbHZlKCk7XG5cdFx0XHRpZiAoY29uZmlnKSB7XG5cdFx0XHRcdHRoaXMuX3Jlc29sdmVkID0gbmV3IFJlc29sdmVkTGFuZ3VhZ2VDb25maWd1cmF0aW9uKFxuXHRcdFx0XHRcdHRoaXMubGFuZ3VhZ2VJZCxcblx0XHRcdFx0XHRjb25maWdcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc29sdmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzb2x2ZSgpOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb24gfCBudWxsIHtcblx0XHRpZiAodGhpcy5fZW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHR0aGlzLl9lbnRyaWVzLnNvcnQoTGFuZ3VhZ2VDb25maWd1cmF0aW9uQ29udHJpYnV0aW9uLmNtcCk7XG5cdFx0cmV0dXJuIGNvbWJpbmVMYW5ndWFnZUNvbmZpZ3VyYXRpb25zKHRoaXMuX2VudHJpZXMubWFwKGUgPT4gZS5jb25maWd1cmF0aW9uKSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gY29tYmluZUxhbmd1YWdlQ29uZmlndXJhdGlvbnMoY29uZmlnczogTGFuZ3VhZ2VDb25maWd1cmF0aW9uW10pOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb24ge1xuXHRsZXQgcmVzdWx0OiBFeHBsaWNpdExhbmd1YWdlQ29uZmlndXJhdGlvbiA9IHtcblx0XHRjb21tZW50czogdW5kZWZpbmVkLFxuXHRcdGJyYWNrZXRzOiB1bmRlZmluZWQsXG5cdFx0d29yZFBhdHRlcm46IHVuZGVmaW5lZCxcblx0XHRpbmRlbnRhdGlvblJ1bGVzOiB1bmRlZmluZWQsXG5cdFx0b25FbnRlclJ1bGVzOiB1bmRlZmluZWQsXG5cdFx0YXV0b0Nsb3NpbmdQYWlyczogdW5kZWZpbmVkLFxuXHRcdHN1cnJvdW5kaW5nUGFpcnM6IHVuZGVmaW5lZCxcblx0XHRhdXRvQ2xvc2VCZWZvcmU6IHVuZGVmaW5lZCxcblx0XHRmb2xkaW5nOiB1bmRlZmluZWQsXG5cdFx0Y29sb3JpemVkQnJhY2tldFBhaXJzOiB1bmRlZmluZWQsXG5cdFx0X19lbGVjdHJpY0NoYXJhY3RlclN1cHBvcnQ6IHVuZGVmaW5lZCxcblx0fTtcblx0Zm9yIChjb25zdCBlbnRyeSBvZiBjb25maWdzKSB7XG5cdFx0cmVzdWx0ID0ge1xuXHRcdFx0Y29tbWVudHM6IGVudHJ5LmNvbW1lbnRzIHx8IHJlc3VsdC5jb21tZW50cyxcblx0XHRcdGJyYWNrZXRzOiBlbnRyeS5icmFja2V0cyB8fCByZXN1bHQuYnJhY2tldHMsXG5cdFx0XHR3b3JkUGF0dGVybjogZW50cnkud29yZFBhdHRlcm4gfHwgcmVzdWx0LndvcmRQYXR0ZXJuLFxuXHRcdFx0aW5kZW50YXRpb25SdWxlczogZW50cnkuaW5kZW50YXRpb25SdWxlcyB8fCByZXN1bHQuaW5kZW50YXRpb25SdWxlcyxcblx0XHRcdG9uRW50ZXJSdWxlczogZW50cnkub25FbnRlclJ1bGVzIHx8IHJlc3VsdC5vbkVudGVyUnVsZXMsXG5cdFx0XHRhdXRvQ2xvc2luZ1BhaXJzOiBlbnRyeS5hdXRvQ2xvc2luZ1BhaXJzIHx8IHJlc3VsdC5hdXRvQ2xvc2luZ1BhaXJzLFxuXHRcdFx0c3Vycm91bmRpbmdQYWlyczogZW50cnkuc3Vycm91bmRpbmdQYWlycyB8fCByZXN1bHQuc3Vycm91bmRpbmdQYWlycyxcblx0XHRcdGF1dG9DbG9zZUJlZm9yZTogZW50cnkuYXV0b0Nsb3NlQmVmb3JlIHx8IHJlc3VsdC5hdXRvQ2xvc2VCZWZvcmUsXG5cdFx0XHRmb2xkaW5nOiBlbnRyeS5mb2xkaW5nIHx8IHJlc3VsdC5mb2xkaW5nLFxuXHRcdFx0Y29sb3JpemVkQnJhY2tldFBhaXJzOiBlbnRyeS5jb2xvcml6ZWRCcmFja2V0UGFpcnMgfHwgcmVzdWx0LmNvbG9yaXplZEJyYWNrZXRQYWlycyxcblx0XHRcdF9fZWxlY3RyaWNDaGFyYWN0ZXJTdXBwb3J0OiBlbnRyeS5fX2VsZWN0cmljQ2hhcmFjdGVyU3VwcG9ydCB8fCByZXN1bHQuX19lbGVjdHJpY0NoYXJhY3RlclN1cHBvcnQsXG5cdFx0fTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmNsYXNzIExhbmd1YWdlQ29uZmlndXJhdGlvbkNvbnRyaWJ1dGlvbiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBjb25maWd1cmF0aW9uOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb24sXG5cdFx0cHVibGljIHJlYWRvbmx5IHByaW9yaXR5OiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IG9yZGVyOiBudW1iZXJcblx0KSB7IH1cblxuXHRwdWJsaWMgc3RhdGljIGNtcChhOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb25Db250cmlidXRpb24sIGI6IExhbmd1YWdlQ29uZmlndXJhdGlvbkNvbnRyaWJ1dGlvbikge1xuXHRcdGlmIChhLnByaW9yaXR5ID09PSBiLnByaW9yaXR5KSB7XG5cdFx0XHQvLyBoaWdoZXIgb3JkZXIgbGFzdFxuXHRcdFx0cmV0dXJuIGEub3JkZXIgLSBiLm9yZGVyO1xuXHRcdH1cblx0XHQvLyBoaWdoZXIgcHJpb3JpdHkgbGFzdFxuXHRcdHJldHVybiBhLnByaW9yaXR5IC0gYi5wcmlvcml0eTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTGFuZ3VhZ2VDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQge1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgbGFuZ3VhZ2VJZDogc3RyaW5nKSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIExhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VudHJpZXMgPSBuZXcgTWFwPHN0cmluZywgQ29tcG9zZWRMYW5ndWFnZUNvbmZpZ3VyYXRpb24+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8TGFuZ3VhZ2VDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlZ2lzdGVyKFBMQUlOVEVYVF9MQU5HVUFHRV9JRCwge1xuXHRcdFx0YnJhY2tldHM6IFtcblx0XHRcdFx0WycoJywgJyknXSxcblx0XHRcdFx0WydbJywgJ10nXSxcblx0XHRcdFx0Wyd7JywgJ30nXSxcblx0XHRcdF0sXG5cdFx0XHRzdXJyb3VuZGluZ1BhaXJzOiBbXG5cdFx0XHRcdHsgb3BlbjogJ3snLCBjbG9zZTogJ30nIH0sXG5cdFx0XHRcdHsgb3BlbjogJ1snLCBjbG9zZTogJ10nIH0sXG5cdFx0XHRcdHsgb3BlbjogJygnLCBjbG9zZTogJyknIH0sXG5cdFx0XHRcdHsgb3BlbjogJzwnLCBjbG9zZTogJz4nIH0sXG5cdFx0XHRcdHsgb3BlbjogJ1xcXCInLCBjbG9zZTogJ1xcXCInIH0sXG5cdFx0XHRcdHsgb3BlbjogJ1xcJycsIGNsb3NlOiAnXFwnJyB9LFxuXHRcdFx0XHR7IG9wZW46ICdgJywgY2xvc2U6ICdgJyB9LFxuXHRcdFx0XSxcblx0XHRcdGNvbG9yaXplZEJyYWNrZXRQYWlyczogW10sXG5cdFx0XHRmb2xkaW5nOiB7XG5cdFx0XHRcdG9mZlNpZGU6IHRydWVcblx0XHRcdH1cblx0XHR9LCAwKSk7XG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHByaW9yaXR5IFVzZSBhIGhpZ2hlciBudW1iZXIgZm9yIGhpZ2hlciBwcmlvcml0eVxuXHQgKi9cblx0cHVibGljIHJlZ2lzdGVyKGxhbmd1YWdlSWQ6IHN0cmluZywgY29uZmlndXJhdGlvbjogTGFuZ3VhZ2VDb25maWd1cmF0aW9uLCBwcmlvcml0eTogbnVtYmVyID0gMCk6IElEaXNwb3NhYmxlIHtcblx0XHRsZXQgZW50cmllcyA9IHRoaXMuX2VudHJpZXMuZ2V0KGxhbmd1YWdlSWQpO1xuXHRcdGlmICghZW50cmllcykge1xuXHRcdFx0ZW50cmllcyA9IG5ldyBDb21wb3NlZExhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUlkKTtcblx0XHRcdHRoaXMuX2VudHJpZXMuc2V0KGxhbmd1YWdlSWQsIGVudHJpZXMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBlbnRyaWVzLnJlZ2lzdGVyKGNvbmZpZ3VyYXRpb24sIHByaW9yaXR5KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKG5ldyBMYW5ndWFnZUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudChsYW5ndWFnZUlkKSk7XG5cblx0XHRyZXR1cm4gbWFya0FzU2luZ2xldG9uKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUobmV3IExhbmd1YWdlQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50KGxhbmd1YWdlSWQpKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKGxhbmd1YWdlSWQ6IHN0cmluZyk6IFJlc29sdmVkTGFuZ3VhZ2VDb25maWd1cmF0aW9uIHwgbnVsbCB7XG5cdFx0Y29uc3QgZW50cmllcyA9IHRoaXMuX2VudHJpZXMuZ2V0KGxhbmd1YWdlSWQpO1xuXHRcdHJldHVybiBlbnRyaWVzPy5nZXRSZXNvbHZlZENvbmZpZ3VyYXRpb24oKSB8fCBudWxsO1xuXHR9XG59XG5cbi8qKlxuICogSW1tdXRhYmxlLlxuKi9cbmV4cG9ydCBjbGFzcyBSZXNvbHZlZExhbmd1YWdlQ29uZmlndXJhdGlvbiB7XG5cdHByaXZhdGUgX2JyYWNrZXRzOiBSaWNoRWRpdEJyYWNrZXRzIHwgbnVsbDtcblx0cHJpdmF0ZSBfZWxlY3RyaWNDaGFyYWN0ZXI6IEJyYWNrZXRFbGVjdHJpY0NoYXJhY3RlclN1cHBvcnQgfCBudWxsO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkVudGVyU3VwcG9ydDogT25FbnRlclN1cHBvcnQgfCBudWxsO1xuXG5cdHB1YmxpYyByZWFkb25seSBjb21tZW50czogSUNvbW1lbnRzQ29uZmlndXJhdGlvbiB8IG51bGw7XG5cdHB1YmxpYyByZWFkb25seSBjaGFyYWN0ZXJQYWlyOiBDaGFyYWN0ZXJQYWlyU3VwcG9ydDtcblx0cHVibGljIHJlYWRvbmx5IHdvcmREZWZpbml0aW9uOiBSZWdFeHA7XG5cdHB1YmxpYyByZWFkb25seSBpbmRlbnRSdWxlc1N1cHBvcnQ6IEluZGVudFJ1bGVzU3VwcG9ydCB8IG51bGw7XG5cdHB1YmxpYyByZWFkb25seSBpbmRlbnRhdGlvblJ1bGVzOiBJbmRlbnRhdGlvblJ1bGUgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyByZWFkb25seSBmb2xkaW5nUnVsZXM6IEZvbGRpbmdSdWxlcztcblx0cHVibGljIHJlYWRvbmx5IGJyYWNrZXRzTmV3OiBMYW5ndWFnZUJyYWNrZXRzQ29uZmlndXJhdGlvbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFuZ3VhZ2VJZDogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSB1bmRlcmx5aW5nQ29uZmlnOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb25cblx0KSB7XG5cdFx0dGhpcy5fYnJhY2tldHMgPSBudWxsO1xuXHRcdHRoaXMuX2VsZWN0cmljQ2hhcmFjdGVyID0gbnVsbDtcblx0XHR0aGlzLl9vbkVudGVyU3VwcG9ydCA9XG5cdFx0XHR0aGlzLnVuZGVybHlpbmdDb25maWcuYnJhY2tldHMgfHxcblx0XHRcdFx0dGhpcy51bmRlcmx5aW5nQ29uZmlnLmluZGVudGF0aW9uUnVsZXMgfHxcblx0XHRcdFx0dGhpcy51bmRlcmx5aW5nQ29uZmlnLm9uRW50ZXJSdWxlc1xuXHRcdFx0XHQ/IG5ldyBPbkVudGVyU3VwcG9ydCh0aGlzLnVuZGVybHlpbmdDb25maWcpXG5cdFx0XHRcdDogbnVsbDtcblx0XHR0aGlzLmNvbW1lbnRzID0gUmVzb2x2ZWRMYW5ndWFnZUNvbmZpZ3VyYXRpb24uX2hhbmRsZUNvbW1lbnRzKHRoaXMudW5kZXJseWluZ0NvbmZpZyk7XG5cdFx0dGhpcy5jaGFyYWN0ZXJQYWlyID0gbmV3IENoYXJhY3RlclBhaXJTdXBwb3J0KHRoaXMudW5kZXJseWluZ0NvbmZpZyk7XG5cblx0XHR0aGlzLndvcmREZWZpbml0aW9uID0gdGhpcy51bmRlcmx5aW5nQ29uZmlnLndvcmRQYXR0ZXJuIHx8IERFRkFVTFRfV09SRF9SRUdFWFA7XG5cdFx0dGhpcy5pbmRlbnRhdGlvblJ1bGVzID0gdGhpcy51bmRlcmx5aW5nQ29uZmlnLmluZGVudGF0aW9uUnVsZXM7XG5cdFx0aWYgKHRoaXMudW5kZXJseWluZ0NvbmZpZy5pbmRlbnRhdGlvblJ1bGVzKSB7XG5cdFx0XHR0aGlzLmluZGVudFJ1bGVzU3VwcG9ydCA9IG5ldyBJbmRlbnRSdWxlc1N1cHBvcnQoXG5cdFx0XHRcdHRoaXMudW5kZXJseWluZ0NvbmZpZy5pbmRlbnRhdGlvblJ1bGVzXG5cdFx0XHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmluZGVudFJ1bGVzU3VwcG9ydCA9IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMuZm9sZGluZ1J1bGVzID0gdGhpcy51bmRlcmx5aW5nQ29uZmlnLmZvbGRpbmcgfHwge307XG5cblx0XHR0aGlzLmJyYWNrZXRzTmV3ID0gbmV3IExhbmd1YWdlQnJhY2tldHNDb25maWd1cmF0aW9uKFxuXHRcdFx0bGFuZ3VhZ2VJZCxcblx0XHRcdHRoaXMudW5kZXJseWluZ0NvbmZpZ1xuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0V29yZERlZmluaXRpb24oKTogUmVnRXhwIHtcblx0XHRyZXR1cm4gZW5zdXJlVmFsaWRXb3JkRGVmaW5pdGlvbih0aGlzLndvcmREZWZpbml0aW9uKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgYnJhY2tldHMoKTogUmljaEVkaXRCcmFja2V0cyB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fYnJhY2tldHMgJiYgdGhpcy51bmRlcmx5aW5nQ29uZmlnLmJyYWNrZXRzKSB7XG5cdFx0XHR0aGlzLl9icmFja2V0cyA9IG5ldyBSaWNoRWRpdEJyYWNrZXRzKFxuXHRcdFx0XHR0aGlzLmxhbmd1YWdlSWQsXG5cdFx0XHRcdHRoaXMudW5kZXJseWluZ0NvbmZpZy5icmFja2V0c1xuXHRcdFx0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2JyYWNrZXRzO1xuXHR9XG5cblx0cHVibGljIGdldCBlbGVjdHJpY0NoYXJhY3RlcigpOiBCcmFja2V0RWxlY3RyaWNDaGFyYWN0ZXJTdXBwb3J0IHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9lbGVjdHJpY0NoYXJhY3Rlcikge1xuXHRcdFx0dGhpcy5fZWxlY3RyaWNDaGFyYWN0ZXIgPSBuZXcgQnJhY2tldEVsZWN0cmljQ2hhcmFjdGVyU3VwcG9ydChcblx0XHRcdFx0dGhpcy5icmFja2V0c1xuXHRcdFx0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2VsZWN0cmljQ2hhcmFjdGVyO1xuXHR9XG5cblx0cHVibGljIG9uRW50ZXIoXG5cdFx0YXV0b0luZGVudDogRWRpdG9yQXV0b0luZGVudFN0cmF0ZWd5LFxuXHRcdHByZXZpb3VzTGluZVRleHQ6IHN0cmluZyxcblx0XHRiZWZvcmVFbnRlclRleHQ6IHN0cmluZyxcblx0XHRhZnRlckVudGVyVGV4dDogc3RyaW5nXG5cdCk6IEVudGVyQWN0aW9uIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLl9vbkVudGVyU3VwcG9ydCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9vbkVudGVyU3VwcG9ydC5vbkVudGVyKFxuXHRcdFx0YXV0b0luZGVudCxcblx0XHRcdHByZXZpb3VzTGluZVRleHQsXG5cdFx0XHRiZWZvcmVFbnRlclRleHQsXG5cdFx0XHRhZnRlckVudGVyVGV4dFxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QXV0b0Nsb3NpbmdQYWlycygpOiBBdXRvQ2xvc2luZ1BhaXJzIHtcblx0XHRyZXR1cm4gbmV3IEF1dG9DbG9zaW5nUGFpcnModGhpcy5jaGFyYWN0ZXJQYWlyLmdldEF1dG9DbG9zaW5nUGFpcnMoKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QXV0b0Nsb3NlQmVmb3JlU2V0KGZvclF1b3RlczogYm9vbGVhbik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuY2hhcmFjdGVyUGFpci5nZXRBdXRvQ2xvc2VCZWZvcmVTZXQoZm9yUXVvdGVzKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRTdXJyb3VuZGluZ1BhaXJzKCk6IElBdXRvQ2xvc2luZ1BhaXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMuY2hhcmFjdGVyUGFpci5nZXRTdXJyb3VuZGluZ1BhaXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfaGFuZGxlQ29tbWVudHMoXG5cdFx0Y29uZjogTGFuZ3VhZ2VDb25maWd1cmF0aW9uXG5cdCk6IElDb21tZW50c0NvbmZpZ3VyYXRpb24gfCBudWxsIHtcblx0XHRjb25zdCBjb21tZW50UnVsZSA9IGNvbmYuY29tbWVudHM7XG5cdFx0aWYgKCFjb21tZW50UnVsZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Ly8gY29tbWVudCBjb25maWd1cmF0aW9uXG5cdFx0Y29uc3QgY29tbWVudHM6IElDb21tZW50c0NvbmZpZ3VyYXRpb24gPSB7fTtcblxuXHRcdGlmIChjb21tZW50UnVsZS5saW5lQ29tbWVudCkge1xuXHRcdFx0Y29tbWVudHMubGluZUNvbW1lbnRUb2tlbiA9IGNvbW1lbnRSdWxlLmxpbmVDb21tZW50O1xuXHRcdH1cblx0XHRpZiAoY29tbWVudFJ1bGUuYmxvY2tDb21tZW50KSB7XG5cdFx0XHRjb25zdCBbYmxvY2tTdGFydCwgYmxvY2tFbmRdID0gY29tbWVudFJ1bGUuYmxvY2tDb21tZW50O1xuXHRcdFx0Y29tbWVudHMuYmxvY2tDb21tZW50U3RhcnRUb2tlbiA9IGJsb2NrU3RhcnQ7XG5cdFx0XHRjb21tZW50cy5ibG9ja0NvbW1lbnRFbmRUb2tlbiA9IGJsb2NrRW5kO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb21tZW50cztcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxZQUF5QixpQkFBaUIsb0JBQW9CO0FBQ3ZFLFlBQVksYUFBYTtBQUV6QixTQUFTLHFCQUFxQixpQ0FBaUM7QUFDL0QsU0FBOEYsd0JBQXNFO0FBQ3BLLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHFDQUFxQztBQXlCdkMsTUFBTSx3Q0FBd0M7QUFBQSxFQUNwRCxZQUE0QixZQUFnQztBQUFoQztBQUFBLEVBQWtDO0FBQUEsRUFFdkQsUUFBUSxZQUE2QjtBQUMzQyxXQUFPLENBQUMsS0FBSyxhQUFhLE9BQU8sS0FBSyxlQUFlO0FBQUEsRUFDdEQ7QUFDRDtBQUVPLE1BQU0sZ0NBQWdDLGdCQUErQyw4QkFBOEI7QUFFbkgsSUFBTSwrQkFBTixjQUEyQyxXQUFvRDtBQUFBLEVBVXJHLFlBQ3lDLHNCQUNMLGlCQUNsQztBQUNELFVBQU07QUFIa0M7QUFDTDtBQVRwQyxTQUFpQixZQUFZLEtBQUssVUFBVSxJQUFJLDhCQUE4QixDQUFDO0FBRS9FLFNBQWlCLHFCQUFxQixLQUFLLFVBQVUsSUFBSSxRQUFpRCxDQUFDO0FBQzNHLFNBQWdCLGNBQWMsS0FBSyxtQkFBbUI7QUFFdEQsU0FBaUIsaUJBQWlCLG9CQUFJLElBQTJDO0FBUWhGLFVBQU0scUJBQXFCLElBQUksSUFB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
