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
import { TimeoutTimer } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { getLeadingWhitespace, isHighSurrogate, isLowSurrogate } from "../../../../base/common/strings.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { CursorChangeReason } from "../../../common/cursorEvents.js";
import { Selection } from "../../../common/core/selection.js";
import { CompletionItemKind, CompletionTriggerKind } from "../../../common/languages.js";
import { IEditorWorkerService } from "../../../common/services/editorWorker.js";
import { WordDistance } from "./wordDistance.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { CompletionModel } from "./completionModel.js";
import { CompletionOptions, getSnippetSuggestSupport, provideSuggestionItems, QuickSuggestionsOptions, SnippetSortOrder } from "./suggest.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { FuzzyScoreOptions } from "../../../../base/common/filters.js";
import { assertType } from "../../../../base/common/types.js";
import { InlineCompletionContextKeys } from "../../inlineCompletions/browser/controller/inlineCompletionContextKeys.js";
import { SnippetController2 } from "../../snippet/browser/snippetController2.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
class LineContext {
  static shouldAutoTrigger(editor) {
    if (!editor.hasModel()) {
      return false;
    }
    const model = editor.getModel();
    const pos = editor.getPosition();
    model.tokenization.tokenizeIfCheap(pos.lineNumber);
    const word = model.getWordAtPosition(pos);
    if (!word) {
      return false;
    }
    if (word.endColumn !== pos.column && word.startColumn + 1 !== pos.column) {
      return false;
    }
    if (!isNaN(Number(word.word))) {
      return false;
    }
    return true;
  }
  constructor(model, position, triggerOptions) {
    this.leadingLineContent = model.getLineContent(position.lineNumber).substr(0, position.column - 1);
    this.leadingWord = model.getWordUntilPosition(position);
    this.lineNumber = position.lineNumber;
    this.column = position.column;
    this.triggerOptions = triggerOptions;
  }
}
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Idle"] = 0] = "Idle";
  State2[State2["Manual"] = 1] = "Manual";
  State2[State2["Auto"] = 2] = "Auto";
  return State2;
})(State || {});
function canShowQuickSuggest(editor, contextKeyService, configurationService) {
  if (!Boolean(contextKeyService.getContextKeyValue(InlineCompletionContextKeys.inlineSuggestionVisible.key))) {
    return true;
  }
  const suppressSuggestions = contextKeyService.getContextKeyValue(InlineCompletionContextKeys.suppressSuggestions.key);
  if (suppressSuggestions !== void 0) {
    return !suppressSuggestions;
  }
  return !editor.getOption(EditorOption.inlineSuggest).suppressSuggestions;
}
function canShowSuggestOnTriggerCharacters(editor, contextKeyService, configurationService) {
  if (!Boolean(contextKeyService.getContextKeyValue("inlineSuggestionVisible"))) {
    return true;
  }
  const suppressSuggestions = contextKeyService.getContextKeyValue(InlineCompletionContextKeys.suppressSuggestions.key);
  if (suppressSuggestions !== void 0) {
    return !suppressSuggestions;
  }
  return !editor.getOption(EditorOption.inlineSuggest).suppressSuggestions;
}
let SuggestModel = class {
  constructor(_editor, _editorWorkerService, _clipboardService, _telemetryService, _logService, _contextKeyService, _configurationService, _languageFeaturesService, _envService) {
    this._editor = _editor;
    this._editorWorkerService = _editorWorkerService;
    this._clipboardService = _clipboardService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._languageFeaturesService = _languageFeaturesService;
    this._envService = _envService;
    this._toDispose = new DisposableStore();
    this._triggerCharacterListener = new DisposableStore();
    this._triggerQuickSuggest = new TimeoutTimer();
    this._triggerState = void 0;
    this._completionDisposables = new DisposableStore();
    this._onDidCancel = new Emitter();
    this._onDidTrigger = new Emitter();
    this._onDidSuggest = new Emitter();
    this.onDidCancel = this._onDidCancel.event;
    this.onDidTrigger = this._onDidTrigger.event;
    this.onDidSuggest = this._onDidSuggest.event;
    this._currentSelection = this._editor.getSelection() || new Selection(1, 1, 1, 1);
    this._toDispose.add(this._editor.onDidChangeModel(() => {
      this._updateTriggerCharacters();
      this.cancel();
    }));
    this._toDispose.add(this._editor.onDidChangeModelLanguage(() => {
      this._updateTriggerCharacters();
      this.cancel();
    }));
    this._toDispose.add(this._editor.onDidChangeConfiguration(() => {
      this._updateTriggerCharacters();
    }));
    this._toDispose.add(this._languageFeaturesService.completionProvider.onDidChange(() => {
      this._updateTriggerCharacters();
      this._updateActiveSuggestSession();
    }));
    let editorIsComposing = false;
    this._toDispose.add(this._editor.onDidCompositionStart(() => {
      editorIsComposing = true;
    }));
    this._toDispose.add(this._editor.onDidCompositionEnd(() => {
      editorIsComposing = false;
      this._onCompositionEnd();
    }));
    this._toDispose.add(this._editor.onDidChangeCursorSelection((e) => {
      if (!editorIsComposing) {
        this._onCursorChange(e);
      }
    }));
    this._toDispose.add(this._editor.onDidChangeModelContent(() => {
      if (!editorIsComposing && this._triggerState !== void 0) {
        this._refilterCompletionItems();
      }
    }));
    this._updateTriggerCharacters();
  }
  dispose() {
    dispose(this._triggerCharacterListener);
    dispose([this._onDidCancel, this._onDidSuggest, this._onDidTrigger, this._triggerQuickSuggest]);
    this._toDispose.dispose();
    this._completionDisposables.dispose();
    this.cancel();
  }
  _updateTriggerCharacters() {
    this._triggerCharacterListener.clear();
    if (this._editor.getOption(EditorOption.readOnly) || !this._editor.hasModel() || !this._editor.getOption(EditorOption.suggestOnTriggerCharacters)) {
      return;
    }
    const supportsByTriggerCharacter = /* @__PURE__ */ new Map();
    for (const support of this._languageFeaturesService.completionProvider.all(this._editor.getModel())) {
      for (const ch of support.triggerCharacters || []) {
        let set = supportsByTriggerCharacter.get(ch);
        if (!set) {
          set = /* @__PURE__ */ new Set();
          const suggestSupport = getSnippetSuggestSupport();
          if (suggestSupport) {
            set.add(suggestSupport);
          }
          supportsByTriggerCharacter.set(ch, set);
        }
        set.add(support);
      }
    }
    const checkTriggerCharacter = (text) => {
      if (!canShowSuggestOnTriggerCharacters(this._editor, this._contextKeyService, this._configurationService)) {
        return;
      }
      if (LineContext.shouldAutoTrigger(this._editor)) {
        return;
      }
      if (!text) {
        const position = this._editor.getPosition();
        const model = this._editor.getModel();
        text = model.getLineContent(position.lineNumber).substr(0, position.column - 1);
      }
      let lastChar = "";
      if (isLowSurrogate(text.charCodeAt(text.length - 1))) {
        if (isHighSurrogate(text.charCodeAt(text.length - 2))) {
          lastChar = text.substr(text.length - 2);
        }
      } else {
        lastChar = text.charAt(text.length - 1);
      }
      const supports = supportsByTriggerCharacter.get(lastChar);
      if (supports) {
        const providerItemsToReuse = /* @__PURE__ */ new Map();
        if (this._completionModel) {
          for (const [provider, items] of this._completionModel.getItemsByProvider()) {
            if (!supports.has(provider)) {
              providerItemsToReuse.set(provider, items);
            }
          }
        }
        this.trigger({
          auto: true,
          triggerKind: CompletionTriggerKind.TriggerCharacter,
          triggerCharacter: lastChar,
          retrigger: Boolean(this._completionModel),
          clipboardText: this._completionModel?.clipboardText,
          completionOptions: { providerFilter: supports, providerItemsToReuse }
        });
      }
    };
    this._triggerCharacterListener.add(this._editor.onDidType(checkTriggerCharacter));
    this._triggerCharacterListener.add(this._editor.onDidCompositionEnd(() => checkTriggerCharacter()));
  }
  // --- trigger/retrigger/cancel suggest
  get state() {
    if (!this._triggerState) {
      return 0 /* Idle */;
    } else if (!this._triggerState.auto) {
      return 1 /* Manual */;
    } else {
      return 2 /* Auto */;
    }
  }
  cancel(retrigger = false) {
    if (this._triggerState !== void 0) {
      this._triggerQuickSuggest.cancel();
      this._requestToken?.cancel();
      this._requestToken = void 0;
      this._triggerState = void 0;
      this._completionModel = void 0;
      this._context = void 0;
      this._onDidCancel.fire({ retrigger });
    }
  }
  clear() {
    this._completionDisposables.clear();
  }
  _updateActiveSuggestSession() {
    if (this._triggerState !== void 0) {
      if (!this._editor.hasModel() || !this._languageFeaturesService.completionProvider.has(this._editor.getModel())) {
        this.cancel();
      } else {
        this.trigger({ auto: this._triggerState.auto, retrigger: true });
      }
    }
  }
  _onCursorChange(e) {
    if (!this._editor.hasModel()) {
      return;
    }
    const prevSelection = this._currentSelection;
    this._currentSelection = this._editor.getSelection();
    if (!e.selection.isEmpty() || e.reason !== CursorChangeReason.NotSet && e.reason !== CursorChangeReason.Explicit || e.source !== "keyboard" && e.source !== "deleteLeft") {
      this.cancel();
      return;
    }
    if (this._triggerState === void 0 && e.reason === CursorChangeReason.NotSet) {
      if (prevSelection.containsRange(this._currentSelection) || prevSelection.getEndPosition().isBeforeOrEqual(this._currentSelection.getPosition())) {
        this._doTriggerQuickSuggest();
      }
    } else if (this._triggerState !== void 0 && e.reason === CursorChangeReason.Explicit) {
      this._refilterCompletionItems();
    }
  }
  _onCompositionEnd() {
    if (this._triggerState === void 0) {
      this._doTriggerQuickSuggest();
    } else {
      this._refilterCompletionItems();
    }
  }
  _doTriggerQuickSuggest() {
    if (QuickSuggestionsOptions.isAllOff(this._editor.getOption(EditorOption.quickSuggestions))) {
      return;
    }
    if (this._editor.getOption(EditorOption.suggest).snippetsPreventQuickSuggestions && SnippetController2.get(this._editor)?.isInSnippet()) {
      return;
    }
    this.cancel();
    this._triggerQuickSuggest.cancelAndSet(() => {
      if (this._triggerState !== void 0) {
        return;
      }
      if (!LineContext.shouldAutoTrigger(this._editor)) {
        return;
      }
      if (!this._editor.hasModel() || !this._editor.hasWidgetFocus()) {
        return;
      }
      const model = this._editor.getModel();
      const pos = this._editor.getPosition();
      const config = this._editor.getOption(EditorOption.quickSuggestions);
      if (QuickSuggestionsOptions.isAllOff(config)) {
        return;
      }
      if (!QuickSuggestionsOptions.isAllOn(config)) {
        model.tokenization.tokenizeIfCheap(pos.lineNumber);
        const lineTokens = model.tokenization.getLineTokens(pos.lineNumber);
        const tokenType = lineTokens.getStandardTokenType(lineTokens.findTokenIndexAtOffset(Math.max(pos.column - 1 - 1, 0)));
        if (QuickSuggestionsOptions.valueFor(config, tokenType) !== "on") {
          return;
        }
      }
      if (!canShowQuickSuggest(this._editor, this._contextKeyService, this._configurationService)) {
        return;
      }
      if (!this._languageFeaturesService.completionProvider.has(model)) {
        return;
      }
      this.trigger({ auto: true });
    }, this._editor.getOption(EditorOption.quickSuggestionsDelay));
  }
  _refilterCompletionItems() {
    assertType(this._editor.hasModel());
    assertType(this._triggerState !== void 0);
    const model = this._editor.getModel();
    const position = this._editor.getPosition();
    const ctx = new LineContext(model, position, { ...this._triggerState, refilter: true });
    this._onNewContext(ctx);
  }
  trigger(options) {
    if (!this._editor.hasModel()) {
      return;
    }
    const model = this._editor.getModel();
    const ctx = new LineContext(model, this._editor.getPosition(), options);
    this.cancel(options.retrigger);
    this._triggerState = options;
    this._onDidTrigger.fire({ auto: options.auto, shy: options.shy ?? false, position: this._editor.getPosition() });
    this._context = ctx;
    let suggestCtx = { triggerKind: options.triggerKind ?? CompletionTriggerKind.Invoke };
    if (options.triggerCharacter) {
      suggestCtx = {
        triggerKind: CompletionTriggerKind.TriggerCharacter,
        triggerCharacter: options.triggerCharacter
      };
    }
    this._requestToken = new CancellationTokenSource();
    const snippetSuggestions = this._editor.getOption(EditorOption.snippetSuggestions);
    let snippetSortOrder = SnippetSortOrder.Inline;
    switch (snippetSuggestions) {
      case "top":
        snippetSortOrder = SnippetSortOrder.Top;
        break;
      // 	↓ that's the default anyways...
      // case 'inline':
      // 	snippetSortOrder = SnippetSortOrder.Inline;
      // 	break;
      case "bottom":
        snippetSortOrder = SnippetSortOrder.Bottom;
        break;
    }
    const { itemKind: itemKindFilter, showDeprecated } = SuggestModel.createSuggestFilter(this._editor);
    const completionOptions = new CompletionOptions(snippetSortOrder, options.completionOptions?.kindFilter ?? itemKindFilter, options.completionOptions?.providerFilter, options.completionOptions?.providerItemsToReuse, showDeprecated);
    const wordDistance = WordDistance.create(this._editorWorkerService, this._editor);
    const completions = provideSuggestionItems(
      this._languageFeaturesService.completionProvider,
      model,
      this._editor.getPosition(),
      completionOptions,
      suggestCtx,
      this._requestToken.token
    );
    Promise.all([completions, wordDistance]).then(async ([completions2, wordDistance2]) => {
      this._requestToken?.dispose();
      if (!this._editor.hasModel()) {
        completions2.disposable.dispose();
        return;
      }
      let clipboardText = options?.clipboardText;
      if (!clipboardText && completions2.needsClipboard) {
        clipboardText = await this._clipboardService.readText();
      }
      if (this._triggerState === void 0) {
        completions2.disposable.dispose();
        return;
      }
      const model2 = this._editor.getModel();
      const ctx2 = new LineContext(model2, this._editor.getPosition(), options);
      const fuzzySearchOptions = {
        ...FuzzyScoreOptions.default,
        firstMatchCanBeWeak: !this._editor.getOption(EditorOption.suggest).matchOnWordStartOnly
      };
      this._completionModel = new CompletionModel(
        completions2.items,
        this._context.column,
        {
          leadingLineContent: ctx2.leadingLineContent,
          characterCountDelta: ctx2.column - this._context.column
        },
        wordDistance2,
        this._editor.getOption(EditorOption.suggest),
        this._editor.getOption(EditorOption.snippetSuggestions),
        fuzzySearchOptions,
        clipboardText
      );
      this._completionDisposables.add(completions2.disposable);
      this._onNewContext(ctx2);
      this._reportDurationsTelemetry(completions2.durations);
      if (!this._envService.isBuilt || this._envService.isExtensionDevelopment) {
        for (const item of completions2.items) {
          if (item.isInvalid) {
            this._logService.warn(`[suggest] did IGNORE invalid completion item from ${item.provider._debugDisplayName}`, item.completion);
          }
        }
      }
    }).catch(onUnexpectedError);
  }
  /**
   * Report durations telemetry with a 1% sampling rate.
   * The telemetry is reported only if a random number between 0 and 100 is less than or equal to 1.
   */
  _reportDurationsTelemetry(durations) {
    if (Math.random() > 1e-4) {
      return;
    }
    setTimeout(() => {
      this._telemetryService.publicLog2("suggest.durations.json", { data: JSON.stringify(durations) });
      this._logService.debug("suggest.durations.json", durations);
    });
  }
  static createSuggestFilter(editor) {
    const result = /* @__PURE__ */ new Set();
    const snippetSuggestions = editor.getOption(EditorOption.snippetSuggestions);
    if (snippetSuggestions === "none") {
      result.add(CompletionItemKind.Snippet);
    }
    const suggestOptions = editor.getOption(EditorOption.suggest);
    if (!suggestOptions.showMethods) {
      result.add(CompletionItemKind.Method);
    }
    if (!suggestOptions.showFunctions) {
      result.add(CompletionItemKind.Function);
    }
    if (!suggestOptions.showConstructors) {
      result.add(CompletionItemKind.Constructor);
    }
    if (!suggestOptions.showFields) {
      result.add(CompletionItemKind.Field);
    }
    if (!suggestOptions.showVariables) {
      result.add(CompletionItemKind.Variable);
    }
    if (!suggestOptions.showClasses) {
      result.add(CompletionItemKind.Class);
    }
    if (!suggestOptions.showStructs) {
      result.add(CompletionItemKind.Struct);
    }
    if (!suggestOptions.showInterfaces) {
      result.add(CompletionItemKind.Interface);
    }
    if (!suggestOptions.showModules) {
      result.add(CompletionItemKind.Module);
    }
    if (!suggestOptions.showProperties) {
      result.add(CompletionItemKind.Property);
    }
    if (!suggestOptions.showEvents) {
      result.add(CompletionItemKind.Event);
    }
    if (!suggestOptions.showOperators) {
      result.add(CompletionItemKind.Operator);
    }
    if (!suggestOptions.showUnits) {
      result.add(CompletionItemKind.Unit);
    }
    if (!suggestOptions.showValues) {
      result.add(CompletionItemKind.Value);
    }
    if (!suggestOptions.showConstants) {
      result.add(CompletionItemKind.Constant);
    }
    if (!suggestOptions.showEnums) {
      result.add(CompletionItemKind.Enum);
    }
    if (!suggestOptions.showEnumMembers) {
      result.add(CompletionItemKind.EnumMember);
    }
    if (!suggestOptions.showKeywords) {
      result.add(CompletionItemKind.Keyword);
    }
    if (!suggestOptions.showWords) {
      result.add(CompletionItemKind.Text);
    }
    if (!suggestOptions.showColors) {
      result.add(CompletionItemKind.Color);
    }
    if (!suggestOptions.showFiles) {
      result.add(CompletionItemKind.File);
    }
    if (!suggestOptions.showReferences) {
      result.add(CompletionItemKind.Reference);
    }
    if (!suggestOptions.showColors) {
      result.add(CompletionItemKind.Customcolor);
    }
    if (!suggestOptions.showFolders) {
      result.add(CompletionItemKind.Folder);
    }
    if (!suggestOptions.showTypeParameters) {
      result.add(CompletionItemKind.TypeParameter);
    }
    if (!suggestOptions.showSnippets) {
      result.add(CompletionItemKind.Snippet);
    }
    if (!suggestOptions.showUsers) {
      result.add(CompletionItemKind.User);
    }
    if (!suggestOptions.showIssues) {
      result.add(CompletionItemKind.Issue);
    }
    return { itemKind: result, showDeprecated: suggestOptions.showDeprecated };
  }
  _onNewContext(ctx) {
    if (!this._context) {
      return;
    }
    if (ctx.lineNumber !== this._context.lineNumber) {
      this.cancel();
      return;
    }
    if (getLeadingWhitespace(ctx.leadingLineContent) !== getLeadingWhitespace(this._context.leadingLineContent)) {
      this.cancel();
      return;
    }
    if (ctx.column < this._context.column) {
      if (ctx.leadingWord.word) {
        this.trigger({ auto: this._context.triggerOptions.auto, retrigger: true });
      } else {
        this.cancel();
      }
      return;
    }
    if (!this._completionModel) {
      return;
    }
    if (ctx.leadingWord.word.length !== 0 && ctx.leadingWord.startColumn > this._context.leadingWord.startColumn) {
      const shouldAutoTrigger = LineContext.shouldAutoTrigger(this._editor);
      if (shouldAutoTrigger && this._context) {
        const map = this._completionModel.getItemsByProvider();
        this.trigger({
          auto: this._context.triggerOptions.auto,
          retrigger: true,
          clipboardText: this._completionModel.clipboardText,
          completionOptions: { providerItemsToReuse: map }
        });
      }
      return;
    }
    if (ctx.column > this._context.column && this._completionModel.getIncompleteProvider().size > 0 && ctx.leadingWord.word.length !== 0) {
      const providerItemsToReuse = /* @__PURE__ */ new Map();
      const providerFilter = /* @__PURE__ */ new Set();
      for (const [provider, items] of this._completionModel.getItemsByProvider()) {
        if (items.length > 0 && items[0].container.incomplete) {
          providerFilter.add(provider);
        } else {
          providerItemsToReuse.set(provider, items);
        }
      }
      this.trigger({
        auto: this._context.triggerOptions.auto,
        triggerKind: CompletionTriggerKind.TriggerForIncompleteCompletions,
        retrigger: true,
        clipboardText: this._completionModel.clipboardText,
        completionOptions: { providerFilter, providerItemsToReuse }
      });
    } else {
      const oldLineContext = this._completionModel.lineContext;
      let isFrozen = false;
      this._completionModel.lineContext = {
        leadingLineContent: ctx.leadingLineContent,
        characterCountDelta: ctx.column - this._context.column
      };
      if (this._completionModel.items.length === 0) {
        const shouldAutoTrigger = LineContext.shouldAutoTrigger(this._editor);
        if (!this._context) {
          this.cancel();
          return;
        }
        if (shouldAutoTrigger && this._context.leadingWord.endColumn < ctx.leadingWord.startColumn) {
          this.trigger({ auto: this._context.triggerOptions.auto, retrigger: true });
          return;
        }
        if (!this._context.triggerOptions.auto) {
          this._completionModel.lineContext = oldLineContext;
          isFrozen = this._completionModel.items.length > 0;
          if (isFrozen && ctx.leadingWord.word.length === 0) {
            this.cancel();
            return;
          }
        } else {
          this.cancel();
          return;
        }
      }
      this._onDidSuggest.fire({
        completionModel: this._completionModel,
        triggerOptions: ctx.triggerOptions,
        isFrozen
      });
    }
  }
};
SuggestModel = __decorateClass([
  __decorateParam(1, IEditorWorkerService),
  __decorateParam(2, IClipboardService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILanguageFeaturesService),
  __decorateParam(8, IEnvironmentService)
], SuggestModel);
export {
  LineContext,
  State,
  SuggestModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdE1vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVGltZW91dFRpbWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGdldExlYWRpbmdXaGl0ZXNwYWNlLCBpc0hpZ2hTdXJyb2dhdGUsIGlzTG93U3Vycm9nYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ2hhbmdlUmVhc29uLCBJQ3Vyc29yU2VsZWN0aW9uQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgQ29tcGxldGlvbkNvbnRleHQsIENvbXBsZXRpb25JdGVtS2luZCwgQ29tcGxldGlvbkl0ZW1Qcm92aWRlciwgQ29tcGxldGlvblRyaWdnZXJLaW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgV29yZERpc3RhbmNlIH0gZnJvbSAnLi93b3JkRGlzdGFuY2UuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uTW9kZWwgfSBmcm9tICcuL2NvbXBsZXRpb25Nb2RlbC5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uRHVyYXRpb25zLCBDb21wbGV0aW9uSXRlbSwgQ29tcGxldGlvbk9wdGlvbnMsIGdldFNuaXBwZXRTdWdnZXN0U3VwcG9ydCwgcHJvdmlkZVN1Z2dlc3Rpb25JdGVtcywgUXVpY2tTdWdnZXN0aW9uc09wdGlvbnMsIFNuaXBwZXRTb3J0T3JkZXIgfSBmcm9tICcuL3N1Z2dlc3QuanMnO1xuaW1wb3J0IHsgSVdvcmRBdFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvd29yZEhlbHBlci5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBGdXp6eVNjb3JlT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cyB9IGZyb20gJy4uLy4uL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvY29udHJvbGxlci9pbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgU25pcHBldENvbnRyb2xsZXIyIH0gZnJvbSAnLi4vLi4vc25pcHBldC9icm93c2VyL3NuaXBwZXRDb250cm9sbGVyMi5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJQ2FuY2VsRXZlbnQge1xuXHRyZWFkb25seSByZXRyaWdnZXI6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRyaWdnZXJFdmVudCB7XG5cdHJlYWRvbmx5IGF1dG86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNoeTogYm9vbGVhbjtcblx0cmVhZG9ubHkgcG9zaXRpb246IElQb3NpdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3VnZ2VzdEV2ZW50IHtcblx0cmVhZG9ubHkgY29tcGxldGlvbk1vZGVsOiBDb21wbGV0aW9uTW9kZWw7XG5cdHJlYWRvbmx5IGlzRnJvemVuOiBib29sZWFuO1xuXHRyZWFkb25seSB0cmlnZ2VyT3B0aW9uczogU3VnZ2VzdFRyaWdnZXJPcHRpb25zO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1Z2dlc3RUcmlnZ2VyT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGF1dG86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNoeT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHJlZmlsdGVyPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgcmV0cmlnZ2VyPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgdHJpZ2dlcktpbmQ/OiBDb21wbGV0aW9uVHJpZ2dlcktpbmQ7XG5cdHJlYWRvbmx5IHRyaWdnZXJDaGFyYWN0ZXI/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGNsaXBib2FyZFRleHQ/OiBzdHJpbmc7XG5cdGNvbXBsZXRpb25PcHRpb25zPzogUGFydGlhbDxDb21wbGV0aW9uT3B0aW9ucz47XG59XG5cbmV4cG9ydCBjbGFzcyBMaW5lQ29udGV4dCB7XG5cblx0c3RhdGljIHNob3VsZEF1dG9UcmlnZ2VyKGVkaXRvcjogSUNvZGVFZGl0b3IpOiBib29sZWFuIHtcblx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3QgcG9zID0gZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLnRva2VuaXplSWZDaGVhcChwb3MubGluZU51bWJlcik7XG5cblx0XHRjb25zdCB3b3JkID0gbW9kZWwuZ2V0V29yZEF0UG9zaXRpb24ocG9zKTtcblx0XHRpZiAoIXdvcmQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKHdvcmQuZW5kQ29sdW1uICE9PSBwb3MuY29sdW1uICYmXG5cdFx0XHR3b3JkLnN0YXJ0Q29sdW1uICsgMSAhPT0gcG9zLmNvbHVtbiAvKiBhZnRlciB0eXBpbmcgYSBzaW5nbGUgY2hhcmFjdGVyIGJlZm9yZSBhIHdvcmQgKi8pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCFpc05hTihOdW1iZXIod29yZC53b3JkKSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRyZWFkb25seSBsaW5lTnVtYmVyOiBudW1iZXI7XG5cdHJlYWRvbmx5IGNvbHVtbjogbnVtYmVyO1xuXHRyZWFkb25seSBsZWFkaW5nTGluZUNvbnRlbnQ6IHN0cmluZztcblx0cmVhZG9ubHkgbGVhZGluZ1dvcmQ6IElXb3JkQXRQb3NpdGlvbjtcblx0cmVhZG9ubHkgdHJpZ2dlck9wdGlvbnM6IFN1Z2dlc3RUcmlnZ2VyT3B0aW9ucztcblxuXHRjb25zdHJ1Y3Rvcihtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCB0cmlnZ2VyT3B0aW9uczogU3VnZ2VzdFRyaWdnZXJPcHRpb25zKSB7XG5cdFx0dGhpcy5sZWFkaW5nTGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChwb3NpdGlvbi5saW5lTnVtYmVyKS5zdWJzdHIoMCwgcG9zaXRpb24uY29sdW1uIC0gMSk7XG5cdFx0dGhpcy5sZWFkaW5nV29yZCA9IG1vZGVsLmdldFdvcmRVbnRpbFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHR0aGlzLmxpbmVOdW1iZXIgPSBwb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdHRoaXMuY29sdW1uID0gcG9zaXRpb24uY29sdW1uO1xuXHRcdHRoaXMudHJpZ2dlck9wdGlvbnMgPSB0cmlnZ2VyT3B0aW9ucztcblx0fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBTdGF0ZSB7XG5cdElkbGUgPSAwLFxuXHRNYW51YWwgPSAxLFxuXHRBdXRvID0gMlxufVxuXG5mdW5jdGlvbiBjYW5TaG93UXVpY2tTdWdnZXN0KGVkaXRvcjogSUNvZGVFZGl0b3IsIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiBib29sZWFuIHtcblx0aWYgKCFCb29sZWFuKGNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZShJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuaW5saW5lU3VnZ2VzdGlvblZpc2libGUua2V5KSkpIHtcblx0XHQvLyBBbGxvdyBpZiB0aGVyZSBpcyBubyBpbmxpbmUgc3VnZ2VzdGlvbi5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRjb25zdCBzdXBwcmVzc1N1Z2dlc3Rpb25zID0gY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dEtleVZhbHVlPGJvb2xlYW4gfCB1bmRlZmluZWQ+KElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5zdXBwcmVzc1N1Z2dlc3Rpb25zLmtleSk7XG5cdGlmIChzdXBwcmVzc1N1Z2dlc3Rpb25zICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gIXN1cHByZXNzU3VnZ2VzdGlvbnM7XG5cdH1cblx0cmV0dXJuICFlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxpbmVTdWdnZXN0KS5zdXBwcmVzc1N1Z2dlc3Rpb25zO1xufVxuXG5mdW5jdGlvbiBjYW5TaG93U3VnZ2VzdE9uVHJpZ2dlckNoYXJhY3RlcnMoZWRpdG9yOiBJQ29kZUVkaXRvciwgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSk6IGJvb2xlYW4ge1xuXHRpZiAoIUJvb2xlYW4oY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dEtleVZhbHVlKCdpbmxpbmVTdWdnZXN0aW9uVmlzaWJsZScpKSkge1xuXHRcdC8vIEFsbG93IGlmIHRoZXJlIGlzIG5vIGlubGluZSBzdWdnZXN0aW9uLlxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGNvbnN0IHN1cHByZXNzU3VnZ2VzdGlvbnMgPSBjb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0S2V5VmFsdWU8Ym9vbGVhbiB8IHVuZGVmaW5lZD4oSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLnN1cHByZXNzU3VnZ2VzdGlvbnMua2V5KTtcblx0aWYgKHN1cHByZXNzU3VnZ2VzdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiAhc3VwcHJlc3NTdWdnZXN0aW9ucztcblx0fVxuXHRyZXR1cm4gIWVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmlubGluZVN1Z2dlc3QpLnN1cHByZXNzU3VnZ2VzdGlvbnM7XG59XG5cbmV4cG9ydCBjbGFzcyBTdWdnZXN0TW9kZWwgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdG9EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90cmlnZ2VyQ2hhcmFjdGVyTGlzdGVuZXIgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RyaWdnZXJRdWlja1N1Z2dlc3QgPSBuZXcgVGltZW91dFRpbWVyKCk7XG5cblx0cHJpdmF0ZSBfdHJpZ2dlclN0YXRlOiBTdWdnZXN0VHJpZ2dlck9wdGlvbnMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3JlcXVlc3RUb2tlbj86IENhbmNlbGxhdGlvblRva2VuU291cmNlO1xuXHRwcml2YXRlIF9jb250ZXh0PzogTGluZUNvbnRleHQ7XG5cdHByaXZhdGUgX2N1cnJlbnRTZWxlY3Rpb246IFNlbGVjdGlvbjtcblxuXHRwcml2YXRlIF9jb21wbGV0aW9uTW9kZWw6IENvbXBsZXRpb25Nb2RlbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfY29tcGxldGlvbkRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENhbmNlbCA9IG5ldyBFbWl0dGVyPElDYW5jZWxFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRUcmlnZ2VyID0gbmV3IEVtaXR0ZXI8SVRyaWdnZXJFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTdWdnZXN0ID0gbmV3IEVtaXR0ZXI8SVN1Z2dlc3RFdmVudD4oKTtcblxuXHRyZWFkb25seSBvbkRpZENhbmNlbDogRXZlbnQ8SUNhbmNlbEV2ZW50PiA9IHRoaXMuX29uRGlkQ2FuY2VsLmV2ZW50O1xuXHRyZWFkb25seSBvbkRpZFRyaWdnZXI6IEV2ZW50PElUcmlnZ2VyRXZlbnQ+ID0gdGhpcy5fb25EaWRUcmlnZ2VyLmV2ZW50O1xuXHRyZWFkb25seSBvbkRpZFN1Z2dlc3Q6IEV2ZW50PElTdWdnZXN0RXZlbnQ+ID0gdGhpcy5fb25EaWRTdWdnZXN0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElFZGl0b3JXb3JrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcldvcmtlclNlcnZpY2U6IElFZGl0b3JXb3JrZXJTZXJ2aWNlLFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VudlNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2N1cnJlbnRTZWxlY3Rpb24gPSB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9uKCkgfHwgbmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKTtcblxuXHRcdC8vIHdpcmUgdXAgdmFyaW91cyBsaXN0ZW5lcnNcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHtcblx0XHRcdHRoaXMuX3VwZGF0ZVRyaWdnZXJDaGFyYWN0ZXJzKCk7XG5cdFx0XHR0aGlzLmNhbmNlbCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdXBkYXRlVHJpZ2dlckNoYXJhY3RlcnMoKTtcblx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVUcmlnZ2VyQ2hhcmFjdGVycygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVUcmlnZ2VyQ2hhcmFjdGVycygpO1xuXHRcdFx0dGhpcy5fdXBkYXRlQWN0aXZlU3VnZ2VzdFNlc3Npb24oKTtcblx0XHR9KSk7XG5cblx0XHRsZXQgZWRpdG9ySXNDb21wb3NpbmcgPSBmYWxzZTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENvbXBvc2l0aW9uU3RhcnQoKCkgPT4ge1xuXHRcdFx0ZWRpdG9ySXNDb21wb3NpbmcgPSB0cnVlO1xuXHRcdH0pKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENvbXBvc2l0aW9uRW5kKCgpID0+IHtcblx0XHRcdGVkaXRvcklzQ29tcG9zaW5nID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9vbkNvbXBvc2l0aW9uRW5kKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yU2VsZWN0aW9uKGUgPT4ge1xuXHRcdFx0Ly8gb25seSB0cmlnZ2VyIHN1Z2dlc3Qgd2hlbiB0aGUgZWRpdG9yIGlzbid0IGNvbXBvc2luZyBhIGNoYXJhY3RlclxuXHRcdFx0aWYgKCFlZGl0b3JJc0NvbXBvc2luZykge1xuXHRcdFx0XHR0aGlzLl9vbkN1cnNvckNoYW5nZShlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoKCkgPT4ge1xuXHRcdFx0Ly8gb25seSBmaWx0ZXIgY29tcGxldGlvbnMgd2hlbiB0aGUgZWRpdG9yIGlzbid0IGNvbXBvc2luZyBhIGNoYXJhY3RlclxuXHRcdFx0Ly8gYWxsb3ctYW55LXVuaWNvZGUtbmV4dC1saW5lXG5cdFx0XHQvLyBlLmcuIFx1MDBBOCArIHUgbWFrZXMgXHUwMEZDIGJ1dCBqdXN0IFx1MDBBOCBjYW5ub3QgYmUgdXNlZCBmb3IgZmlsdGVyaW5nXG5cdFx0XHRpZiAoIWVkaXRvcklzQ29tcG9zaW5nICYmIHRoaXMuX3RyaWdnZXJTdGF0ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMuX3JlZmlsdGVyQ29tcGxldGlvbkl0ZW1zKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fdXBkYXRlVHJpZ2dlckNoYXJhY3RlcnMoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0ZGlzcG9zZSh0aGlzLl90cmlnZ2VyQ2hhcmFjdGVyTGlzdGVuZXIpO1xuXHRcdGRpc3Bvc2UoW3RoaXMuX29uRGlkQ2FuY2VsLCB0aGlzLl9vbkRpZFN1Z2dlc3QsIHRoaXMuX29uRGlkVHJpZ2dlciwgdGhpcy5fdHJpZ2dlclF1aWNrU3VnZ2VzdF0pO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY29tcGxldGlvbkRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmNhbmNlbCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlVHJpZ2dlckNoYXJhY3RlcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fdHJpZ2dlckNoYXJhY3Rlckxpc3RlbmVyLmNsZWFyKCk7XG5cblx0XHRpZiAodGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ucmVhZE9ubHkpXG5cdFx0XHR8fCAhdGhpcy5fZWRpdG9yLmhhc01vZGVsKClcblx0XHRcdHx8ICF0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zdWdnZXN0T25UcmlnZ2VyQ2hhcmFjdGVycykpIHtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN1cHBvcnRzQnlUcmlnZ2VyQ2hhcmFjdGVyID0gbmV3IE1hcDxzdHJpbmcsIFNldDxDb21wbGV0aW9uSXRlbVByb3ZpZGVyPj4oKTtcblx0XHRmb3IgKGNvbnN0IHN1cHBvcnQgb2YgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLmFsbCh0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKSkpIHtcblx0XHRcdGZvciAoY29uc3QgY2ggb2Ygc3VwcG9ydC50cmlnZ2VyQ2hhcmFjdGVycyB8fCBbXSkge1xuXHRcdFx0XHRsZXQgc2V0ID0gc3VwcG9ydHNCeVRyaWdnZXJDaGFyYWN0ZXIuZ2V0KGNoKTtcblx0XHRcdFx0aWYgKCFzZXQpIHtcblx0XHRcdFx0XHRzZXQgPSBuZXcgU2V0KCk7XG5cdFx0XHRcdFx0Y29uc3Qgc3VnZ2VzdFN1cHBvcnQgPSBnZXRTbmlwcGV0U3VnZ2VzdFN1cHBvcnQoKTtcblx0XHRcdFx0XHRpZiAoc3VnZ2VzdFN1cHBvcnQpIHtcblx0XHRcdFx0XHRcdHNldC5hZGQoc3VnZ2VzdFN1cHBvcnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzdXBwb3J0c0J5VHJpZ2dlckNoYXJhY3Rlci5zZXQoY2gsIHNldCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2V0LmFkZChzdXBwb3J0KTtcblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdGNvbnN0IGNoZWNrVHJpZ2dlckNoYXJhY3RlciA9ICh0ZXh0Pzogc3RyaW5nKSA9PiB7XG5cblx0XHRcdGlmICghY2FuU2hvd1N1Z2dlc3RPblRyaWdnZXJDaGFyYWN0ZXJzKHRoaXMuX2VkaXRvciwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChMaW5lQ29udGV4dC5zaG91bGRBdXRvVHJpZ2dlcih0aGlzLl9lZGl0b3IpKSB7XG5cdFx0XHRcdC8vIGRvbid0IHRyaWdnZXIgYnkgdHJpZ2dlciBjaGFyYWN0ZXJzIHdoZW4gdGhpcyBpcyBhIGNhc2UgZm9yIHF1aWNrIHN1Z2dlc3Rcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRleHQpIHtcblx0XHRcdFx0Ly8gY2FtZSBoZXJlIGZyb20gdGhlIGNvbXBvc2l0aW9uRW5kLWV2ZW50XG5cdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCkhO1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpITtcblx0XHRcdFx0dGV4dCA9IG1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpLnN1YnN0cigwLCBwb3NpdGlvbi5jb2x1bW4gLSAxKTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGxhc3RDaGFyID0gJyc7XG5cdFx0XHRpZiAoaXNMb3dTdXJyb2dhdGUodGV4dC5jaGFyQ29kZUF0KHRleHQubGVuZ3RoIC0gMSkpKSB7XG5cdFx0XHRcdGlmIChpc0hpZ2hTdXJyb2dhdGUodGV4dC5jaGFyQ29kZUF0KHRleHQubGVuZ3RoIC0gMikpKSB7XG5cdFx0XHRcdFx0bGFzdENoYXIgPSB0ZXh0LnN1YnN0cih0ZXh0Lmxlbmd0aCAtIDIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsYXN0Q2hhciA9IHRleHQuY2hhckF0KHRleHQubGVuZ3RoIC0gMSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN1cHBvcnRzID0gc3VwcG9ydHNCeVRyaWdnZXJDaGFyYWN0ZXIuZ2V0KGxhc3RDaGFyKTtcblx0XHRcdGlmIChzdXBwb3J0cykge1xuXG5cdFx0XHRcdC8vIGtlZXAgZXhpc3RpbmcgaXRlbXMgdGhhdCB3aGVyZSBub3QgY29tcHV0ZWQgYnkgdGhlXG5cdFx0XHRcdC8vIHN1cHBvcnRzL3Byb3ZpZGVycyB0aGF0IHdhbnQgdG8gdHJpZ2dlciBub3dcblx0XHRcdFx0Y29uc3QgcHJvdmlkZXJJdGVtc1RvUmV1c2UgPSBuZXcgTWFwPENvbXBsZXRpb25JdGVtUHJvdmlkZXIsIENvbXBsZXRpb25JdGVtW10+KCk7XG5cdFx0XHRcdGlmICh0aGlzLl9jb21wbGV0aW9uTW9kZWwpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IFtwcm92aWRlciwgaXRlbXNdIG9mIHRoaXMuX2NvbXBsZXRpb25Nb2RlbC5nZXRJdGVtc0J5UHJvdmlkZXIoKSkge1xuXHRcdFx0XHRcdFx0aWYgKCFzdXBwb3J0cy5oYXMocHJvdmlkZXIpKSB7XG5cdFx0XHRcdFx0XHRcdHByb3ZpZGVySXRlbXNUb1JldXNlLnNldChwcm92aWRlciwgaXRlbXMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMudHJpZ2dlcih7XG5cdFx0XHRcdFx0YXV0bzogdHJ1ZSxcblx0XHRcdFx0XHR0cmlnZ2VyS2luZDogQ29tcGxldGlvblRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIsXG5cdFx0XHRcdFx0dHJpZ2dlckNoYXJhY3RlcjogbGFzdENoYXIsXG5cdFx0XHRcdFx0cmV0cmlnZ2VyOiBCb29sZWFuKHRoaXMuX2NvbXBsZXRpb25Nb2RlbCksXG5cdFx0XHRcdFx0Y2xpcGJvYXJkVGV4dDogdGhpcy5fY29tcGxldGlvbk1vZGVsPy5jbGlwYm9hcmRUZXh0LFxuXHRcdFx0XHRcdGNvbXBsZXRpb25PcHRpb25zOiB7IHByb3ZpZGVyRmlsdGVyOiBzdXBwb3J0cywgcHJvdmlkZXJJdGVtc1RvUmV1c2UgfVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fdHJpZ2dlckNoYXJhY3Rlckxpc3RlbmVyLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRUeXBlKGNoZWNrVHJpZ2dlckNoYXJhY3RlcikpO1xuXHRcdHRoaXMuX3RyaWdnZXJDaGFyYWN0ZXJMaXN0ZW5lci5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ29tcG9zaXRpb25FbmQoKCkgPT4gY2hlY2tUcmlnZ2VyQ2hhcmFjdGVyKCkpKTtcblx0fVxuXG5cdC8vIC0tLSB0cmlnZ2VyL3JldHJpZ2dlci9jYW5jZWwgc3VnZ2VzdFxuXG5cdGdldCBzdGF0ZSgpOiBTdGF0ZSB7XG5cdFx0aWYgKCF0aGlzLl90cmlnZ2VyU3RhdGUpIHtcblx0XHRcdHJldHVybiBTdGF0ZS5JZGxlO1xuXHRcdH0gZWxzZSBpZiAoIXRoaXMuX3RyaWdnZXJTdGF0ZS5hdXRvKSB7XG5cdFx0XHRyZXR1cm4gU3RhdGUuTWFudWFsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gU3RhdGUuQXV0bztcblx0XHR9XG5cdH1cblxuXHRjYW5jZWwocmV0cmlnZ2VyOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fdHJpZ2dlclN0YXRlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3RyaWdnZXJRdWlja1N1Z2dlc3QuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLl9yZXF1ZXN0VG9rZW4/LmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fcmVxdWVzdFRva2VuID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fdHJpZ2dlclN0YXRlID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fY29tcGxldGlvbk1vZGVsID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fY29udGV4dCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX29uRGlkQ2FuY2VsLmZpcmUoeyByZXRyaWdnZXIgfSk7XG5cdFx0fVxuXHR9XG5cblx0Y2xlYXIoKSB7XG5cdFx0dGhpcy5fY29tcGxldGlvbkRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVBY3RpdmVTdWdnZXN0U2Vzc2lvbigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fdHJpZ2dlclN0YXRlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkgfHwgIXRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5oYXModGhpcy5fZWRpdG9yLmdldE1vZGVsKCkpKSB7XG5cdFx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoeyBhdXRvOiB0aGlzLl90cmlnZ2VyU3RhdGUuYXV0bywgcmV0cmlnZ2VyOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uQ3Vyc29yQ2hhbmdlKGU6IElDdXJzb3JTZWxlY3Rpb25DaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblxuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcmV2U2VsZWN0aW9uID0gdGhpcy5fY3VycmVudFNlbGVjdGlvbjtcblx0XHR0aGlzLl9jdXJyZW50U2VsZWN0aW9uID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXG5cdFx0aWYgKCFlLnNlbGVjdGlvbi5pc0VtcHR5KClcblx0XHRcdHx8IChlLnJlYXNvbiAhPT0gQ3Vyc29yQ2hhbmdlUmVhc29uLk5vdFNldCAmJiBlLnJlYXNvbiAhPT0gQ3Vyc29yQ2hhbmdlUmVhc29uLkV4cGxpY2l0KVxuXHRcdFx0fHwgKGUuc291cmNlICE9PSAna2V5Ym9hcmQnICYmIGUuc291cmNlICE9PSAnZGVsZXRlTGVmdCcpXG5cdFx0KSB7XG5cdFx0XHQvLyBFYXJseSBleGl0IGlmIG5vdGhpbmcgbmVlZHMgdG8gYmUgZG9uZSFcblx0XHRcdC8vIExlYXZlIHNvbWUgZm9ybSBvZiBlYXJseSBleGl0IGNoZWNrIGhlcmUgaWYgeW91IHdpc2ggdG8gY29udGludWUgYmVpbmcgYSBjdXJzb3IgcG9zaXRpb24gY2hhbmdlIGxpc3RlbmVyIDspXG5cdFx0XHR0aGlzLmNhbmNlbCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXG5cdFx0aWYgKHRoaXMuX3RyaWdnZXJTdGF0ZSA9PT0gdW5kZWZpbmVkICYmIGUucmVhc29uID09PSBDdXJzb3JDaGFuZ2VSZWFzb24uTm90U2V0KSB7XG5cdFx0XHRpZiAocHJldlNlbGVjdGlvbi5jb250YWluc1JhbmdlKHRoaXMuX2N1cnJlbnRTZWxlY3Rpb24pIHx8IHByZXZTZWxlY3Rpb24uZ2V0RW5kUG9zaXRpb24oKS5pc0JlZm9yZU9yRXF1YWwodGhpcy5fY3VycmVudFNlbGVjdGlvbi5nZXRQb3NpdGlvbigpKSkge1xuXHRcdFx0XHQvLyBjdXJzb3IgZGlkIG1vdmUgUklHSFQgZHVlIHRvIHR5cGluZyAtPiB0cmlnZ2VyIHF1aWNrIHN1Z2dlc3Rcblx0XHRcdFx0dGhpcy5fZG9UcmlnZ2VyUXVpY2tTdWdnZXN0KCk7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2UgaWYgKHRoaXMuX3RyaWdnZXJTdGF0ZSAhPT0gdW5kZWZpbmVkICYmIGUucmVhc29uID09PSBDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQpIHtcblx0XHRcdC8vIHN1Z2dlc3QgaXMgYWN0aXZlIGFuZCBzb21ldGhpbmcgbGlrZSBjdXJzb3Iga2V5cyBhcmUgdXNlZCB0byBtb3ZlXG5cdFx0XHQvLyB0aGUgY3Vyc29yLiB0aGlzIG1lYW5zIHdlIGNhbiByZWZpbHRlciBhdCB0aGUgbmV3IHBvc2l0aW9uXG5cdFx0XHR0aGlzLl9yZWZpbHRlckNvbXBsZXRpb25JdGVtcygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uQ29tcG9zaXRpb25FbmQoKTogdm9pZCB7XG5cdFx0Ly8gdHJpZ2dlciBvciByZWZpbHRlciB3aGVuIGNvbXBvc2l0aW9uIGVuZHNcblx0XHRpZiAodGhpcy5fdHJpZ2dlclN0YXRlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX2RvVHJpZ2dlclF1aWNrU3VnZ2VzdCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9yZWZpbHRlckNvbXBsZXRpb25JdGVtcygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2RvVHJpZ2dlclF1aWNrU3VnZ2VzdCgpOiB2b2lkIHtcblxuXHRcdGlmIChRdWlja1N1Z2dlc3Rpb25zT3B0aW9ucy5pc0FsbE9mZih0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5xdWlja1N1Z2dlc3Rpb25zKSkpIHtcblx0XHRcdC8vIG5vdCBlbmFibGVkXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN1Z2dlc3QpLnNuaXBwZXRzUHJldmVudFF1aWNrU3VnZ2VzdGlvbnMgJiYgU25pcHBldENvbnRyb2xsZXIyLmdldCh0aGlzLl9lZGl0b3IpPy5pc0luU25pcHBldCgpKSB7XG5cdFx0XHQvLyBubyBxdWljayBzdWdnZXN0aW9uIHdoZW4gaW4gc25pcHBldCBtb2RlXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jYW5jZWwoKTtcblxuXHRcdHRoaXMuX3RyaWdnZXJRdWlja1N1Z2dlc3QuY2FuY2VsQW5kU2V0KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl90cmlnZ2VyU3RhdGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIUxpbmVDb250ZXh0LnNob3VsZEF1dG9UcmlnZ2VyKHRoaXMuX2VkaXRvcikpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCAhdGhpcy5fZWRpdG9yLmhhc1dpZGdldEZvY3VzKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGNvbnN0IHBvcyA9IHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdFx0Ly8gdmFsaWRhdGUgZW5hYmxlZCBub3dcblx0XHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnF1aWNrU3VnZ2VzdGlvbnMpO1xuXHRcdFx0aWYgKFF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zLmlzQWxsT2ZmKGNvbmZpZykpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIVF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zLmlzQWxsT24oY29uZmlnKSkge1xuXHRcdFx0XHQvLyBDaGVjayB0aGUgdHlwZSBvZiB0aGUgdG9rZW4gdGhhdCB0cmlnZ2VyZWQgdGhpc1xuXHRcdFx0XHRtb2RlbC50b2tlbml6YXRpb24udG9rZW5pemVJZkNoZWFwKHBvcy5saW5lTnVtYmVyKTtcblx0XHRcdFx0Y29uc3QgbGluZVRva2VucyA9IG1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKHBvcy5saW5lTnVtYmVyKTtcblx0XHRcdFx0Y29uc3QgdG9rZW5UeXBlID0gbGluZVRva2Vucy5nZXRTdGFuZGFyZFRva2VuVHlwZShsaW5lVG9rZW5zLmZpbmRUb2tlbkluZGV4QXRPZmZzZXQoTWF0aC5tYXgocG9zLmNvbHVtbiAtIDEgLSAxLCAwKSkpO1xuXHRcdFx0XHRpZiAoUXVpY2tTdWdnZXN0aW9uc09wdGlvbnMudmFsdWVGb3IoY29uZmlnLCB0b2tlblR5cGUpICE9PSAnb24nKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICghY2FuU2hvd1F1aWNrU3VnZ2VzdCh0aGlzLl9lZGl0b3IsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdFx0Ly8gZG8gbm90IHRyaWdnZXIgcXVpY2sgc3VnZ2VzdGlvbnMgaWYgaW5saW5lIHN1Z2dlc3Rpb25zIGFyZSBzaG93blxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLmhhcyhtb2RlbCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB3ZSBtYWRlIGl0IHRpbGwgaGVyZSAtPiB0cmlnZ2VyIG5vd1xuXHRcdFx0dGhpcy50cmlnZ2VyKHsgYXV0bzogdHJ1ZSB9KTtcblxuXHRcdH0sIHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnF1aWNrU3VnZ2VzdGlvbnNEZWxheSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVmaWx0ZXJDb21wbGV0aW9uSXRlbXMoKTogdm9pZCB7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSk7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl90cmlnZ2VyU3RhdGUgIT09IHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0Y29uc3QgY3R4ID0gbmV3IExpbmVDb250ZXh0KG1vZGVsLCBwb3NpdGlvbiwgeyAuLi50aGlzLl90cmlnZ2VyU3RhdGUsIHJlZmlsdGVyOiB0cnVlIH0pO1xuXHRcdHRoaXMuX29uTmV3Q29udGV4dChjdHgpO1xuXHR9XG5cblx0dHJpZ2dlcihvcHRpb25zOiBTdWdnZXN0VHJpZ2dlck9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBjdHggPSBuZXcgTGluZUNvbnRleHQobW9kZWwsIHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpLCBvcHRpb25zKTtcblxuXHRcdC8vIENhbmNlbCBwcmV2aW91cyByZXF1ZXN0cywgY2hhbmdlIHN0YXRlICYgdXBkYXRlIFVJXG5cdFx0dGhpcy5jYW5jZWwob3B0aW9ucy5yZXRyaWdnZXIpO1xuXHRcdHRoaXMuX3RyaWdnZXJTdGF0ZSA9IG9wdGlvbnM7XG5cdFx0dGhpcy5fb25EaWRUcmlnZ2VyLmZpcmUoeyBhdXRvOiBvcHRpb25zLmF1dG8sIHNoeTogb3B0aW9ucy5zaHkgPz8gZmFsc2UsIHBvc2l0aW9uOiB0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSB9KTtcblxuXHRcdC8vIENhcHR1cmUgY29udGV4dCB3aGVuIHJlcXVlc3Qgd2FzIHNlbnRcblx0XHR0aGlzLl9jb250ZXh0ID0gY3R4O1xuXG5cdFx0Ly8gQnVpbGQgY29udGV4dCBmb3IgcmVxdWVzdFxuXHRcdGxldCBzdWdnZXN0Q3R4OiBDb21wbGV0aW9uQ29udGV4dCA9IHsgdHJpZ2dlcktpbmQ6IG9wdGlvbnMudHJpZ2dlcktpbmQgPz8gQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZSB9O1xuXHRcdGlmIChvcHRpb25zLnRyaWdnZXJDaGFyYWN0ZXIpIHtcblx0XHRcdHN1Z2dlc3RDdHggPSB7XG5cdFx0XHRcdHRyaWdnZXJLaW5kOiBDb21wbGV0aW9uVHJpZ2dlcktpbmQuVHJpZ2dlckNoYXJhY3Rlcixcblx0XHRcdFx0dHJpZ2dlckNoYXJhY3Rlcjogb3B0aW9ucy50cmlnZ2VyQ2hhcmFjdGVyXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlcXVlc3RUb2tlbiA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXG5cdFx0Ly8ga2luZCBmaWx0ZXIgYW5kIHNuaXBwZXQgc29ydCBydWxlc1xuXHRcdGNvbnN0IHNuaXBwZXRTdWdnZXN0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnNuaXBwZXRTdWdnZXN0aW9ucyk7XG5cdFx0bGV0IHNuaXBwZXRTb3J0T3JkZXIgPSBTbmlwcGV0U29ydE9yZGVyLklubGluZTtcblx0XHRzd2l0Y2ggKHNuaXBwZXRTdWdnZXN0aW9ucykge1xuXHRcdFx0Y2FzZSAndG9wJzpcblx0XHRcdFx0c25pcHBldFNvcnRPcmRlciA9IFNuaXBwZXRTb3J0T3JkZXIuVG9wO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdC8vIFx0XHUyMTkzIHRoYXQncyB0aGUgZGVmYXVsdCBhbnl3YXlzLi4uXG5cdFx0XHQvLyBjYXNlICdpbmxpbmUnOlxuXHRcdFx0Ly8gXHRzbmlwcGV0U29ydE9yZGVyID0gU25pcHBldFNvcnRPcmRlci5JbmxpbmU7XG5cdFx0XHQvLyBcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnYm90dG9tJzpcblx0XHRcdFx0c25pcHBldFNvcnRPcmRlciA9IFNuaXBwZXRTb3J0T3JkZXIuQm90dG9tO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRjb25zdCB7IGl0ZW1LaW5kOiBpdGVtS2luZEZpbHRlciwgc2hvd0RlcHJlY2F0ZWQgfSA9IFN1Z2dlc3RNb2RlbC5jcmVhdGVTdWdnZXN0RmlsdGVyKHRoaXMuX2VkaXRvcik7XG5cdFx0Y29uc3QgY29tcGxldGlvbk9wdGlvbnMgPSBuZXcgQ29tcGxldGlvbk9wdGlvbnMoc25pcHBldFNvcnRPcmRlciwgb3B0aW9ucy5jb21wbGV0aW9uT3B0aW9ucz8ua2luZEZpbHRlciA/PyBpdGVtS2luZEZpbHRlciwgb3B0aW9ucy5jb21wbGV0aW9uT3B0aW9ucz8ucHJvdmlkZXJGaWx0ZXIsIG9wdGlvbnMuY29tcGxldGlvbk9wdGlvbnM/LnByb3ZpZGVySXRlbXNUb1JldXNlLCBzaG93RGVwcmVjYXRlZCk7XG5cdFx0Y29uc3Qgd29yZERpc3RhbmNlID0gV29yZERpc3RhbmNlLmNyZWF0ZSh0aGlzLl9lZGl0b3JXb3JrZXJTZXJ2aWNlLCB0aGlzLl9lZGl0b3IpO1xuXG5cdFx0Y29uc3QgY29tcGxldGlvbnMgPSBwcm92aWRlU3VnZ2VzdGlvbkl0ZW1zKFxuXHRcdFx0dGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLFxuXHRcdFx0bW9kZWwsXG5cdFx0XHR0aGlzLl9lZGl0b3IuZ2V0UG9zaXRpb24oKSxcblx0XHRcdGNvbXBsZXRpb25PcHRpb25zLFxuXHRcdFx0c3VnZ2VzdEN0eCxcblx0XHRcdHRoaXMuX3JlcXVlc3RUb2tlbi50b2tlblxuXHRcdCk7XG5cblx0XHRQcm9taXNlLmFsbChbY29tcGxldGlvbnMsIHdvcmREaXN0YW5jZV0pLnRoZW4oYXN5bmMgKFtjb21wbGV0aW9ucywgd29yZERpc3RhbmNlXSkgPT4ge1xuXG5cdFx0XHR0aGlzLl9yZXF1ZXN0VG9rZW4/LmRpc3Bvc2UoKTtcblxuXHRcdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRjb21wbGV0aW9ucy5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgY2xpcGJvYXJkVGV4dCA9IG9wdGlvbnM/LmNsaXBib2FyZFRleHQ7XG5cdFx0XHRpZiAoIWNsaXBib2FyZFRleHQgJiYgY29tcGxldGlvbnMubmVlZHNDbGlwYm9hcmQpIHtcblx0XHRcdFx0Y2xpcGJvYXJkVGV4dCA9IGF3YWl0IHRoaXMuX2NsaXBib2FyZFNlcnZpY2UucmVhZFRleHQoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX3RyaWdnZXJTdGF0ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbXBsZXRpb25zLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHQvLyBjb25zdCBpdGVtcyA9IGNvbXBsZXRpb25zLml0ZW1zO1xuXG5cdFx0XHQvLyBpZiAoZXhpc3RpbmcpIHtcblx0XHRcdC8vIFx0Y29uc3QgY21wRm4gPSBnZXRTdWdnZXN0aW9uQ29tcGFyYXRvcihzbmlwcGV0U29ydE9yZGVyKTtcblx0XHRcdC8vIFx0aXRlbXMgPSBpdGVtcy5jb25jYXQoZXhpc3RpbmcuaXRlbXMpLnNvcnQoY21wRm4pO1xuXHRcdFx0Ly8gfVxuXG5cdFx0XHRjb25zdCBjdHggPSBuZXcgTGluZUNvbnRleHQobW9kZWwsIHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpLCBvcHRpb25zKTtcblx0XHRcdGNvbnN0IGZ1enp5U2VhcmNoT3B0aW9ucyA9IHtcblx0XHRcdFx0Li4uRnV6enlTY29yZU9wdGlvbnMuZGVmYXVsdCxcblx0XHRcdFx0Zmlyc3RNYXRjaENhbkJlV2VhazogIXRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN1Z2dlc3QpLm1hdGNoT25Xb3JkU3RhcnRPbmx5XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fY29tcGxldGlvbk1vZGVsID0gbmV3IENvbXBsZXRpb25Nb2RlbChjb21wbGV0aW9ucy5pdGVtcywgdGhpcy5fY29udGV4dCEuY29sdW1uLCB7XG5cdFx0XHRcdGxlYWRpbmdMaW5lQ29udGVudDogY3R4LmxlYWRpbmdMaW5lQ29udGVudCxcblx0XHRcdFx0Y2hhcmFjdGVyQ291bnREZWx0YTogY3R4LmNvbHVtbiAtIHRoaXMuX2NvbnRleHQhLmNvbHVtblxuXHRcdFx0fSxcblx0XHRcdFx0d29yZERpc3RhbmNlLFxuXHRcdFx0XHR0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zdWdnZXN0KSxcblx0XHRcdFx0dGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc25pcHBldFN1Z2dlc3Rpb25zKSxcblx0XHRcdFx0ZnV6enlTZWFyY2hPcHRpb25zLFxuXHRcdFx0XHRjbGlwYm9hcmRUZXh0XG5cdFx0XHQpO1xuXG5cdFx0XHQvLyBzdG9yZSBjb250YWluZXJzIHNvIHRoYXQgdGhleSBjYW4gYmUgZGlzcG9zZWQgbGF0ZXJcblx0XHRcdHRoaXMuX2NvbXBsZXRpb25EaXNwb3NhYmxlcy5hZGQoY29tcGxldGlvbnMuZGlzcG9zYWJsZSk7XG5cblx0XHRcdHRoaXMuX29uTmV3Q29udGV4dChjdHgpO1xuXG5cdFx0XHQvLyBmaW5hbGx5IHJlcG9ydCB0ZWxlbWV0cnkgYWJvdXQgZHVyYXRpb25zXG5cdFx0XHR0aGlzLl9yZXBvcnREdXJhdGlvbnNUZWxlbWV0cnkoY29tcGxldGlvbnMuZHVyYXRpb25zKTtcblxuXHRcdFx0Ly8gcmVwb3J0IGludmFsaWQgY29tcGxldGlvbnMgYnkgc291cmNlXG5cdFx0XHRpZiAoIXRoaXMuX2VudlNlcnZpY2UuaXNCdWlsdCB8fCB0aGlzLl9lbnZTZXJ2aWNlLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIGNvbXBsZXRpb25zLml0ZW1zKSB7XG5cdFx0XHRcdFx0aWYgKGl0ZW0uaXNJbnZhbGlkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oYFtzdWdnZXN0XSBkaWQgSUdOT1JFIGludmFsaWQgY29tcGxldGlvbiBpdGVtIGZyb20gJHtpdGVtLnByb3ZpZGVyLl9kZWJ1Z0Rpc3BsYXlOYW1lfWAsIGl0ZW0uY29tcGxldGlvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9KS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcik7XG5cdH1cblxuXHQvKipcblx0ICogUmVwb3J0IGR1cmF0aW9ucyB0ZWxlbWV0cnkgd2l0aCBhIDElIHNhbXBsaW5nIHJhdGUuXG5cdCAqIFRoZSB0ZWxlbWV0cnkgaXMgcmVwb3J0ZWQgb25seSBpZiBhIHJhbmRvbSBudW1iZXIgYmV0d2VlbiAwIGFuZCAxMDAgaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIDEuXG5cdCAqL1xuXHRwcml2YXRlIF9yZXBvcnREdXJhdGlvbnNUZWxlbWV0cnkoZHVyYXRpb25zOiBDb21wbGV0aW9uRHVyYXRpb25zKTogdm9pZCB7XG5cdFx0aWYgKE1hdGgucmFuZG9tKCkgPiAwLjAwMDEpIHsgLy8gMC4wMSVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHR5cGUgRHVyYXRpb25zID0geyBkYXRhOiBzdHJpbmcgfTtcblx0XHRcdHR5cGUgRHVyYXRpb25zQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdG93bmVyOiAnanJpZWtlbic7XG5cdFx0XHRcdGNvbW1lbnQ6ICdDb21wbGV0aW9ucyBwZXJmb3JtYW5jZSBudW1iZXJzJztcblx0XHRcdFx0ZGF0YTogeyBjb21tZW50OiAnRHVyYXRpb25zIHBlciBzb3VyY2UgYW5kIG92ZXJhbGwnOyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJyB9O1xuXHRcdFx0fTtcblx0XHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxEdXJhdGlvbnMsIER1cmF0aW9uc0NsYXNzaWZpY2F0aW9uPignc3VnZ2VzdC5kdXJhdGlvbnMuanNvbicsIHsgZGF0YTogSlNPTi5zdHJpbmdpZnkoZHVyYXRpb25zKSB9KTtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ3N1Z2dlc3QuZHVyYXRpb25zLmpzb24nLCBkdXJhdGlvbnMpO1xuXHRcdH0pO1xuXHR9XG5cblx0c3RhdGljIGNyZWF0ZVN1Z2dlc3RGaWx0ZXIoZWRpdG9yOiBJQ29kZUVkaXRvcik6IHsgaXRlbUtpbmQ6IFNldDxDb21wbGV0aW9uSXRlbUtpbmQ+OyBzaG93RGVwcmVjYXRlZDogYm9vbGVhbiB9IHtcblx0XHQvLyBraW5kIGZpbHRlciBhbmQgc25pcHBldCBzb3J0IHJ1bGVzXG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IFNldDxDb21wbGV0aW9uSXRlbUtpbmQ+KCk7XG5cblx0XHQvLyBzbmlwcGV0IHNldHRpbmdcblx0XHRjb25zdCBzbmlwcGV0U3VnZ2VzdGlvbnMgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zbmlwcGV0U3VnZ2VzdGlvbnMpO1xuXHRcdGlmIChzbmlwcGV0U3VnZ2VzdGlvbnMgPT09ICdub25lJykge1xuXHRcdFx0cmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCk7XG5cdFx0fVxuXG5cdFx0Ly8gdHlwZSBzZXR0aW5nXG5cdFx0Y29uc3Qgc3VnZ2VzdE9wdGlvbnMgPSBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zdWdnZXN0KTtcblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dNZXRob2RzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLk1ldGhvZCk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dGdW5jdGlvbnMpIHsgcmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuRnVuY3Rpb24pOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93Q29uc3RydWN0b3JzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLkNvbnN0cnVjdG9yKTsgfVxuXHRcdGlmICghc3VnZ2VzdE9wdGlvbnMuc2hvd0ZpZWxkcykgeyByZXN1bHQuYWRkKENvbXBsZXRpb25JdGVtS2luZC5GaWVsZCk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dWYXJpYWJsZXMpIHsgcmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuVmFyaWFibGUpOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93Q2xhc3NlcykgeyByZXN1bHQuYWRkKENvbXBsZXRpb25JdGVtS2luZC5DbGFzcyk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dTdHJ1Y3RzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLlN0cnVjdCk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dJbnRlcmZhY2VzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLkludGVyZmFjZSk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dNb2R1bGVzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLk1vZHVsZSk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dQcm9wZXJ0aWVzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5KTsgfVxuXHRcdGlmICghc3VnZ2VzdE9wdGlvbnMuc2hvd0V2ZW50cykgeyByZXN1bHQuYWRkKENvbXBsZXRpb25JdGVtS2luZC5FdmVudCk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dPcGVyYXRvcnMpIHsgcmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuT3BlcmF0b3IpOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93VW5pdHMpIHsgcmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuVW5pdCk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dWYWx1ZXMpIHsgcmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuVmFsdWUpOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93Q29uc3RhbnRzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLkNvbnN0YW50KTsgfVxuXHRcdGlmICghc3VnZ2VzdE9wdGlvbnMuc2hvd0VudW1zKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLkVudW0pOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93RW51bU1lbWJlcnMpIHsgcmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuRW51bU1lbWJlcik7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dLZXl3b3JkcykgeyByZXN1bHQuYWRkKENvbXBsZXRpb25JdGVtS2luZC5LZXl3b3JkKTsgfVxuXHRcdGlmICghc3VnZ2VzdE9wdGlvbnMuc2hvd1dvcmRzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQpOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93Q29sb3JzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLkNvbG9yKTsgfVxuXHRcdGlmICghc3VnZ2VzdE9wdGlvbnMuc2hvd0ZpbGVzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLkZpbGUpOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93UmVmZXJlbmNlcykgeyByZXN1bHQuYWRkKENvbXBsZXRpb25JdGVtS2luZC5SZWZlcmVuY2UpOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93Q29sb3JzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLkN1c3RvbWNvbG9yKTsgfVxuXHRcdGlmICghc3VnZ2VzdE9wdGlvbnMuc2hvd0ZvbGRlcnMpIHsgcmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyKTsgfVxuXHRcdGlmICghc3VnZ2VzdE9wdGlvbnMuc2hvd1R5cGVQYXJhbWV0ZXJzKSB7IHJlc3VsdC5hZGQoQ29tcGxldGlvbkl0ZW1LaW5kLlR5cGVQYXJhbWV0ZXIpOyB9XG5cdFx0aWYgKCFzdWdnZXN0T3B0aW9ucy5zaG93U25pcHBldHMpIHsgcmVzdWx0LmFkZChDb21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCk7IH1cblx0XHRpZiAoIXN1Z2dlc3RPcHRpb25zLnNob3dVc2VycykgeyByZXN1bHQuYWRkKENvbXBsZXRpb25JdGVtS2luZC5Vc2VyKTsgfVxuXHRcdGlmICghc3VnZ2VzdE9wdGlvbnMuc2hvd0lzc3VlcykgeyByZXN1bHQuYWRkKENvbXBsZXRpb25JdGVtS2luZC5Jc3N1ZSk7IH1cblxuXHRcdHJldHVybiB7IGl0ZW1LaW5kOiByZXN1bHQsIHNob3dEZXByZWNhdGVkOiBzdWdnZXN0T3B0aW9ucy5zaG93RGVwcmVjYXRlZCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfb25OZXdDb250ZXh0KGN0eDogTGluZUNvbnRleHQpOiB2b2lkIHtcblxuXHRcdGlmICghdGhpcy5fY29udGV4dCkge1xuXHRcdFx0Ly8gaGFwcGVucyB3aGVuIDI0eDcgSW50ZWxsaVNlbnNlIGlzIGVuYWJsZWQgYW5kIHN0aWxsIGluIGl0cyBkZWxheVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChjdHgubGluZU51bWJlciAhPT0gdGhpcy5fY29udGV4dC5saW5lTnVtYmVyKSB7XG5cdFx0XHQvLyBlLmcuIGhhcHBlbnMgd2hlbiBwcmVzc2luZyBFbnRlciB3aGlsZSBJbnRlbGxpU2Vuc2UgaXMgY29tcHV0ZWRcblx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGdldExlYWRpbmdXaGl0ZXNwYWNlKGN0eC5sZWFkaW5nTGluZUNvbnRlbnQpICE9PSBnZXRMZWFkaW5nV2hpdGVzcGFjZSh0aGlzLl9jb250ZXh0LmxlYWRpbmdMaW5lQ29udGVudCkpIHtcblx0XHRcdC8vIGNhbmNlbCBJbnRlbGxpU2Vuc2Ugd2hlbiBsaW5lIHN0YXJ0IGNoYW5nZXNcblx0XHRcdC8vIGhhcHBlbnMgd2hlbiB0aGUgY3VycmVudCB3b3JkIGdldHMgb3V0ZGVudGVkXG5cdFx0XHR0aGlzLmNhbmNlbCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChjdHguY29sdW1uIDwgdGhpcy5fY29udGV4dC5jb2x1bW4pIHtcblx0XHRcdC8vIHR5cGVkIC0+IG1vdmVkIGN1cnNvciBMRUZUIC0+IHJldHJpZ2dlciBpZiBzdGlsbCBvbiBhIHdvcmRcblx0XHRcdGlmIChjdHgubGVhZGluZ1dvcmQud29yZCkge1xuXHRcdFx0XHR0aGlzLnRyaWdnZXIoeyBhdXRvOiB0aGlzLl9jb250ZXh0LnRyaWdnZXJPcHRpb25zLmF1dG8sIHJldHJpZ2dlcjogdHJ1ZSB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9jb21wbGV0aW9uTW9kZWwpIHtcblx0XHRcdC8vIGhhcHBlbnMgd2hlbiBJbnRlbGxpU2Vuc2UgaXMgbm90IHlldCBjb21wdXRlZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChjdHgubGVhZGluZ1dvcmQud29yZC5sZW5ndGggIT09IDAgJiYgY3R4LmxlYWRpbmdXb3JkLnN0YXJ0Q29sdW1uID4gdGhpcy5fY29udGV4dC5sZWFkaW5nV29yZC5zdGFydENvbHVtbikge1xuXHRcdFx0Ly8gc3RhcnRlZCBhIG5ldyB3b3JkIHdoaWxlIEludGVsbGlTZW5zZSBzaG93cyAtPiByZXRyaWdnZXIgYnV0IHJldXNlIGFsbCBpdGVtcyB0aGF0IHdlIGN1cnJlbnRseSBoYXZlXG5cdFx0XHRjb25zdCBzaG91bGRBdXRvVHJpZ2dlciA9IExpbmVDb250ZXh0LnNob3VsZEF1dG9UcmlnZ2VyKHRoaXMuX2VkaXRvcik7XG5cdFx0XHRpZiAoc2hvdWxkQXV0b1RyaWdnZXIgJiYgdGhpcy5fY29udGV4dCkge1xuXHRcdFx0XHQvLyBzaG91bGRBdXRvVHJpZ2dlciBmb3JjZXMgdG9rZW5pemF0aW9uLCB3aGljaCBjYW4gY2F1c2UgcGVuZGluZyBjdXJzb3IgY2hhbmdlIGV2ZW50cyB0byBiZSBlbWl0dGVkLCB3aGljaCBjYW4gY2F1c2Vcblx0XHRcdFx0Ly8gc3VnZ2VzdGlvbnMgdG8gYmUgY2FuY2VsbGVkLCB3aGljaCBjYXVzZXMgYHRoaXMuX2NvbnRleHRgIHRvIGJlIHVuZGVmaW5lZFxuXHRcdFx0XHRjb25zdCBtYXAgPSB0aGlzLl9jb21wbGV0aW9uTW9kZWwuZ2V0SXRlbXNCeVByb3ZpZGVyKCk7XG5cdFx0XHRcdHRoaXMudHJpZ2dlcih7XG5cdFx0XHRcdFx0YXV0bzogdGhpcy5fY29udGV4dC50cmlnZ2VyT3B0aW9ucy5hdXRvLFxuXHRcdFx0XHRcdHJldHJpZ2dlcjogdHJ1ZSxcblx0XHRcdFx0XHRjbGlwYm9hcmRUZXh0OiB0aGlzLl9jb21wbGV0aW9uTW9kZWwuY2xpcGJvYXJkVGV4dCxcblx0XHRcdFx0XHRjb21wbGV0aW9uT3B0aW9uczogeyBwcm92aWRlckl0ZW1zVG9SZXVzZTogbWFwIH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGN0eC5jb2x1bW4gPiB0aGlzLl9jb250ZXh0LmNvbHVtbiAmJiB0aGlzLl9jb21wbGV0aW9uTW9kZWwuZ2V0SW5jb21wbGV0ZVByb3ZpZGVyKCkuc2l6ZSA+IDAgJiYgY3R4LmxlYWRpbmdXb3JkLndvcmQubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHQvLyB0eXBlZCAtPiBtb3ZlZCBjdXJzb3IgUklHSFQgJiBpbmNvbXBsZSBtb2RlbCAmIHN0aWxsIG9uIGEgd29yZCAtPiByZXRyaWdnZXJcblxuXHRcdFx0Y29uc3QgcHJvdmlkZXJJdGVtc1RvUmV1c2UgPSBuZXcgTWFwPENvbXBsZXRpb25JdGVtUHJvdmlkZXIsIENvbXBsZXRpb25JdGVtW10+KCk7XG5cdFx0XHRjb25zdCBwcm92aWRlckZpbHRlciA9IG5ldyBTZXQ8Q29tcGxldGlvbkl0ZW1Qcm92aWRlcj4oKTtcblx0XHRcdGZvciAoY29uc3QgW3Byb3ZpZGVyLCBpdGVtc10gb2YgdGhpcy5fY29tcGxldGlvbk1vZGVsLmdldEl0ZW1zQnlQcm92aWRlcigpKSB7XG5cdFx0XHRcdGlmIChpdGVtcy5sZW5ndGggPiAwICYmIGl0ZW1zWzBdLmNvbnRhaW5lci5pbmNvbXBsZXRlKSB7XG5cdFx0XHRcdFx0cHJvdmlkZXJGaWx0ZXIuYWRkKHByb3ZpZGVyKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwcm92aWRlckl0ZW1zVG9SZXVzZS5zZXQocHJvdmlkZXIsIGl0ZW1zKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnRyaWdnZXIoe1xuXHRcdFx0XHRhdXRvOiB0aGlzLl9jb250ZXh0LnRyaWdnZXJPcHRpb25zLmF1dG8sXG5cdFx0XHRcdHRyaWdnZXJLaW5kOiBDb21wbGV0aW9uVHJpZ2dlcktpbmQuVHJpZ2dlckZvckluY29tcGxldGVDb21wbGV0aW9ucyxcblx0XHRcdFx0cmV0cmlnZ2VyOiB0cnVlLFxuXHRcdFx0XHRjbGlwYm9hcmRUZXh0OiB0aGlzLl9jb21wbGV0aW9uTW9kZWwuY2xpcGJvYXJkVGV4dCxcblx0XHRcdFx0Y29tcGxldGlvbk9wdGlvbnM6IHsgcHJvdmlkZXJGaWx0ZXIsIHByb3ZpZGVySXRlbXNUb1JldXNlIH1cblx0XHRcdH0pO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHR5cGVkIC0+IG1vdmVkIGN1cnNvciBSSUdIVCAtPiB1cGRhdGUgVUlcblx0XHRcdGNvbnN0IG9sZExpbmVDb250ZXh0ID0gdGhpcy5fY29tcGxldGlvbk1vZGVsLmxpbmVDb250ZXh0O1xuXHRcdFx0bGV0IGlzRnJvemVuID0gZmFsc2U7XG5cblx0XHRcdHRoaXMuX2NvbXBsZXRpb25Nb2RlbC5saW5lQ29udGV4dCA9IHtcblx0XHRcdFx0bGVhZGluZ0xpbmVDb250ZW50OiBjdHgubGVhZGluZ0xpbmVDb250ZW50LFxuXHRcdFx0XHRjaGFyYWN0ZXJDb3VudERlbHRhOiBjdHguY29sdW1uIC0gdGhpcy5fY29udGV4dC5jb2x1bW5cblx0XHRcdH07XG5cblx0XHRcdGlmICh0aGlzLl9jb21wbGV0aW9uTW9kZWwuaXRlbXMubGVuZ3RoID09PSAwKSB7XG5cblx0XHRcdFx0Y29uc3Qgc2hvdWxkQXV0b1RyaWdnZXIgPSBMaW5lQ29udGV4dC5zaG91bGRBdXRvVHJpZ2dlcih0aGlzLl9lZGl0b3IpO1xuXHRcdFx0XHRpZiAoIXRoaXMuX2NvbnRleHQpIHtcblx0XHRcdFx0XHQvLyBzaG91bGRBdXRvVHJpZ2dlciBmb3JjZXMgdG9rZW5pemF0aW9uLCB3aGljaCBjYW4gY2F1c2UgcGVuZGluZyBjdXJzb3IgY2hhbmdlIGV2ZW50cyB0byBiZSBlbWl0dGVkLCB3aGljaCBjYW4gY2F1c2Vcblx0XHRcdFx0XHQvLyBzdWdnZXN0aW9ucyB0byBiZSBjYW5jZWxsZWQsIHdoaWNoIGNhdXNlcyBgdGhpcy5fY29udGV4dGAgdG8gYmUgdW5kZWZpbmVkXG5cdFx0XHRcdFx0dGhpcy5jYW5jZWwoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc2hvdWxkQXV0b1RyaWdnZXIgJiYgdGhpcy5fY29udGV4dC5sZWFkaW5nV29yZC5lbmRDb2x1bW4gPCBjdHgubGVhZGluZ1dvcmQuc3RhcnRDb2x1bW4pIHtcblx0XHRcdFx0XHQvLyByZXRyaWdnZXIgd2hlbiBoZWFkaW5nIGludG8gYSBuZXcgd29yZFxuXHRcdFx0XHRcdHRoaXMudHJpZ2dlcih7IGF1dG86IHRoaXMuX2NvbnRleHQudHJpZ2dlck9wdGlvbnMuYXV0bywgcmV0cmlnZ2VyOiB0cnVlIH0pO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghdGhpcy5fY29udGV4dC50cmlnZ2VyT3B0aW9ucy5hdXRvKSB7XG5cdFx0XHRcdFx0Ly8gZnJlZXplIHdoZW4gSW50ZWxsaVNlbnNlIHdhcyBtYW51YWxseSByZXF1ZXN0ZWRcblx0XHRcdFx0XHR0aGlzLl9jb21wbGV0aW9uTW9kZWwubGluZUNvbnRleHQgPSBvbGRMaW5lQ29udGV4dDtcblx0XHRcdFx0XHRpc0Zyb3plbiA9IHRoaXMuX2NvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGggPiAwO1xuXG5cdFx0XHRcdFx0aWYgKGlzRnJvemVuICYmIGN0eC5sZWFkaW5nV29yZC53b3JkLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0Ly8gdGhlcmUgd2VyZSByZXN1bHRzIGJlZm9yZSBidXQgbm93IHRoZXJlIGFyZW4ndFxuXHRcdFx0XHRcdFx0Ly8gYW5kIGFsc28gd2UgYXJlIG5vdCBvbiBhIHdvcmQgYW55bW9yZSAtPiBjYW5jZWxcblx0XHRcdFx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gbm90aGluZyBsZWZ0XG5cdFx0XHRcdFx0dGhpcy5jYW5jZWwoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fb25EaWRTdWdnZXN0LmZpcmUoe1xuXHRcdFx0XHRjb21wbGV0aW9uTW9kZWw6IHRoaXMuX2NvbXBsZXRpb25Nb2RlbCxcblx0XHRcdFx0dHJpZ2dlck9wdGlvbnM6IGN0eC50cmlnZ2VyT3B0aW9ucyxcblx0XHRcdFx0aXNGcm96ZW4sXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFzQjtBQUMvQixTQUFTLGlCQUFpQixlQUE0QjtBQUN0RCxTQUFTLHNCQUFzQixpQkFBaUIsc0JBQXNCO0FBRXRFLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMEJBQXdEO0FBRWpFLFNBQVMsaUJBQWlCO0FBRTFCLFNBQTRCLG9CQUE0Qyw2QkFBNkI7QUFDckcsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBOEMsbUJBQW1CLDBCQUEwQix3QkFBd0IseUJBQXlCLHdCQUF3QjtBQUVwSyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQTZCN0IsTUFBTSxZQUFZO0FBQUEsRUFFeEIsT0FBTyxrQkFBa0IsUUFBOEI7QUFDdEQsUUFBSSxDQUFDLE9BQU8sU0FBUyxHQUFHO0FBQ3ZCLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxRQUFRLE9BQU8s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
