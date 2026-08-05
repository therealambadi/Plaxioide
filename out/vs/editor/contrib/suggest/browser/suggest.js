import { CancellationToken } from "../../../../base/common/cancellation.js";
import { CancellationError, isCancellationError, onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { FuzzyScore } from "../../../../base/common/filters.js";
import { DisposableStore, isDisposable } from "../../../../base/common/lifecycle.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import * as languages from "../../../common/languages.js";
import { ITextModelService } from "../../../common/services/resolverService.js";
import { SnippetParser } from "../../snippet/browser/snippetParser.js";
import { localize } from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { historyNavigationVisible } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { StandardTokenType } from "../../../common/encodedTokenAttributes.js";
const Context = {
  Visible: historyNavigationVisible,
  HasFocusedSuggestion: new RawContextKey("suggestWidgetHasFocusedSuggestion", false, localize("suggestWidgetHasSelection", "Whether any suggestion is focused")),
  DetailsVisible: new RawContextKey("suggestWidgetDetailsVisible", false, localize("suggestWidgetDetailsVisible", "Whether suggestion details are visible")),
  MultipleSuggestions: new RawContextKey("suggestWidgetMultipleSuggestions", false, localize("suggestWidgetMultipleSuggestions", "Whether there are multiple suggestions to pick from")),
  MakesTextEdit: new RawContextKey("suggestionMakesTextEdit", true, localize("suggestionMakesTextEdit", "Whether inserting the current suggestion yields in a change or has everything already been typed")),
  AcceptSuggestionsOnEnter: new RawContextKey("acceptSuggestionOnEnter", true, localize("acceptSuggestionOnEnter", "Whether suggestions are inserted when pressing Enter")),
  HasInsertAndReplaceRange: new RawContextKey("suggestionHasInsertAndReplaceRange", false, localize("suggestionHasInsertAndReplaceRange", "Whether the current suggestion has insert and replace behaviour")),
  InsertMode: new RawContextKey("suggestionInsertMode", void 0, { type: "string", description: localize("suggestionInsertMode", "Whether the default behaviour is to insert or replace") }),
  CanResolve: new RawContextKey("suggestionCanResolve", false, localize("suggestionCanResolve", "Whether the current suggestion supports to resolve further details"))
};
const suggestWidgetStatusbarMenu = new MenuId("suggestWidgetStatusBar");
class CompletionItem {
  constructor(position, completion, container, provider) {
    this.position = position;
    this.completion = completion;
    this.container = container;
    this.provider = provider;
    // validation
    this.isInvalid = false;
    // sorting, filtering
    this.score = FuzzyScore.Default;
    this.distance = 0;
    this.textLabel = typeof completion.label === "string" ? completion.label : completion.label?.label;
    this.labelLow = this.textLabel.toLowerCase();
    this.isInvalid = !this.textLabel;
    this.sortTextLow = completion.sortText && completion.sortText.toLowerCase();
    this.filterTextLow = completion.filterText && completion.filterText.toLowerCase();
    this.extensionId = completion.extensionId;
    if (Range.isIRange(completion.range)) {
      this.editStart = new Position(completion.range.startLineNumber, completion.range.startColumn);
      this.editInsertEnd = new Position(completion.range.endLineNumber, completion.range.endColumn);
      this.editReplaceEnd = new Position(completion.range.endLineNumber, completion.range.endColumn);
      this.isInvalid = this.isInvalid || Range.spansMultipleLines(completion.range) || completion.range.startLineNumber !== position.lineNumber;
    } else {
      this.editStart = new Position(completion.range.insert.startLineNumber, completion.range.insert.startColumn);
      this.editInsertEnd = new Position(completion.range.insert.endLineNumber, completion.range.insert.endColumn);
      this.editReplaceEnd = new Position(completion.range.replace.endLineNumber, completion.range.replace.endColumn);
      this.isInvalid = this.isInvalid || Range.spansMultipleLines(completion.range.insert) || Range.spansMultipleLines(completion.range.replace) || completion.range.insert.startLineNumber !== position.lineNumber || completion.range.replace.startLineNumber !== position.lineNumber || completion.range.insert.startColumn !== completion.range.replace.startColumn;
    }
    if (typeof provider.resolveCompletionItem !== "function") {
      this._resolveCache = Promise.resolve();
      this._resolveDuration = 0;
    }
  }
  // ---- resolving
  get isResolved() {
    return this._resolveDuration !== void 0;
  }
  get resolveDuration() {
    return this._resolveDuration !== void 0 ? this._resolveDuration : -1;
  }
  async resolve(token) {
    if (!this._resolveCache) {
      const sub = token.onCancellationRequested(() => {
        this._resolveCache = void 0;
        this._resolveDuration = void 0;
      });
      const sw = new StopWatch(true);
      this._resolveCache = Promise.resolve(this.provider.resolveCompletionItem(this.completion, token)).then((value) => {
        Object.assign(this.completion, value);
        this._resolveDuration = sw.elapsed();
      }, (err) => {
        if (isCancellationError(err)) {
          this._resolveCache = void 0;
          this._resolveDuration = void 0;
        }
      }).finally(() => {
        sub.dispose();
      });
    }
    return this._resolveCache;
  }
}
var SnippetSortOrder = /* @__PURE__ */ ((SnippetSortOrder2) => {
  SnippetSortOrder2[SnippetSortOrder2["Top"] = 0] = "Top";
  SnippetSortOrder2[SnippetSortOrder2["Inline"] = 1] = "Inline";
  SnippetSortOrder2[SnippetSortOrder2["Bottom"] = 2] = "Bottom";
  return SnippetSortOrder2;
})(SnippetSortOrder || {});
const _CompletionOptions = class _CompletionOptions {
  constructor(snippetSortOrder = 2 /* Bottom */, kindFilter = /* @__PURE__ */ new Set(), providerFilter = /* @__PURE__ */ new Set(), providerItemsToReuse = /* @__PURE__ */ new Map(), showDeprecated = true) {
    this.snippetSortOrder = snippetSortOrder;
    this.kindFilter = kindFilter;
    this.providerFilter = providerFilter;
    this.providerItemsToReuse = providerItemsToReuse;
    this.showDeprecated = showDeprecated;
  }
};
_CompletionOptions.default = new _CompletionOptions();
let CompletionOptions = _CompletionOptions;
let _snippetSuggestSupport;
function getSnippetSuggestSupport() {
  return _snippetSuggestSupport;
}
function setSnippetSuggestSupport(support) {
  const old = _snippetSuggestSupport;
  _snippetSuggestSupport = support;
  return old;
}
class CompletionItemModel {
  constructor(items, needsClipboard, durations, disposable) {
    this.items = items;
    this.needsClipboard = needsClipboard;
    this.durations = durations;
    this.disposable = disposable;
  }
}
async function provideSuggestionItems(registry, model, position, options = CompletionOptions.default, context = { triggerKind: languages.CompletionTriggerKind.Invoke }, token = CancellationToken.None) {
  const sw = new StopWatch();
  position = position.clone();
  const word = model.getWordAtPosition(position);
  const defaultReplaceRange = word ? new Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn) : Range.fromPositions(position);
  const defaultRange = { replace: defaultReplaceRange, insert: defaultReplaceRange.setEndPosition(position.lineNumber, position.column) };
  const result = [];
  const disposables = new DisposableStore();
  const durations = [];
  let needsClipboard = false;
  const onCompletionList = (provider, container, sw2) => {
    let didAddResult = false;
    if (!container) {
      return didAddResult;
    }
    for (const suggestion of container.suggestions) {
      if (!options.kindFilter.has(suggestion.kind)) {
        if (!options.showDeprecated && suggestion?.tags?.includes(languages.CompletionItemTag.Deprecated)) {
          continue;
        }
        if (!suggestion.range) {
          suggestion.range = defaultRange;
        }
        if (!suggestion.sortText) {
          suggestion.sortText = typeof suggestion.label === "string" ? suggestion.label : suggestion.label.label;
        }
        if (!needsClipboard && suggestion.insertTextRules && suggestion.insertTextRules & languages.CompletionItemInsertTextRule.InsertAsSnippet) {
          needsClipboard = SnippetParser.guessNeedsClipboard(suggestion.insertText);
        }
        result.push(new CompletionItem(position, suggestion, container, provider));
        didAddResult = true;
      }
    }
    if (isDisposable(container)) {
      disposables.add(container);
    }
    durations.push({
      providerName: provider._debugDisplayName ?? "unknown_provider",
      elapsedProvider: container.duration ?? -1,
      elapsedOverall: sw2.elapsed()
    });
    return didAddResult;
  };
  const snippetCompletions = (async () => {
    if (!_snippetSuggestSupport || options.kindFilter.has(languages.CompletionItemKind.Snippet)) {
      return;
    }
    const reuseItems = options.providerItemsToReuse.get(_snippetSuggestSupport);
    if (reuseItems) {
      reuseItems.forEach((item) => result.push(item));
      return;
    }
    if (options.providerFilter.size > 0 && !options.providerFilter.has(_snippetSuggestSupport)) {
      return;
    }
    const sw2 = new StopWatch();
    const list = await _snippetSuggestSupport.provideCompletionItems(model, position, context, token);
    onCompletionList(_snippetSuggestSupport, list, sw2);
  })();
  for (const providerGroup of registry.orderedGroups(model)) {
    let didAddResult = false;
    await Promise.all(providerGroup.map(async (provider) => {
      if (options.providerItemsToReuse.has(provider)) {
        const items = options.providerItemsToReuse.get(provider);
        items.forEach((item) => result.push(item));
        didAddResult = didAddResult || items.length > 0;
        return;
      }
      if (options.providerFilter.size > 0 && !options.providerFilter.has(provider)) {
        return;
      }
      try {
        const sw2 = new StopWatch();
        const list = await provider.provideCompletionItems(model, position, context, token);
        didAddResult = onCompletionList(provider, list, sw2) || didAddResult;
      } catch (err) {
        onUnexpectedExternalError(err);
      }
    }));
    if (didAddResult || token.isCancellationRequested) {
      break;
    }
  }
  await snippetCompletions;
  if (token.isCancellationRequested) {
    disposables.dispose();
    return Promise.reject(new CancellationError());
  }
  return new CompletionItemModel(
    result.sort(getSuggestionComparator(options.snippetSortOrder)),
    needsClipboard,
    { entries: durations, elapsed: sw.elapsed() },
    disposables
  );
}
function defaultComparator(a, b) {
  if (a.sortTextLow && b.sortTextLow) {
    if (a.sortTextLow < b.sortTextLow) {
      return -1;
    } else if (a.sortTextLow > b.sortTextLow) {
      return 1;
    }
  }
  if (a.textLabel < b.textLabel) {
    return -1;
  } else if (a.textLabel > b.textLabel) {
    return 1;
  }
  return a.completion.kind - b.completion.kind;
}
function snippetUpComparator(a, b) {
  if (a.completion.kind !== b.completion.kind) {
    if (a.completion.kind === languages.CompletionItemKind.Snippet) {
      return -1;
    } else if (b.completion.kind === languages.CompletionItemKind.Snippet) {
      return 1;
    }
  }
  return defaultComparator(a, b);
}
function snippetDownComparator(a, b) {
  if (a.completion.kind !== b.completion.kind) {
    if (a.completion.kind === languages.CompletionItemKind.Snippet) {
      return 1;
    } else if (b.completion.kind === languages.CompletionItemKind.Snippet) {
      return -1;
    }
  }
  return defaultComparator(a, b);
}
const _snippetComparators = /* @__PURE__ */ new Map();
_snippetComparators.set(0 /* Top */, snippetUpComparator);
_snippetComparators.set(2 /* Bottom */, snippetDownComparator);
_snippetComparators.set(1 /* Inline */, defaultComparator);
function getSuggestionComparator(snippetConfig) {
  return _snippetComparators.get(snippetConfig);
}
CommandsRegistry.registerCommand("_executeCompletionItemProvider", async (accessor, ...args) => {
  const [uri, position, triggerCharacter, maxItemsToResolve] = args;
  assertType(URI.isUri(uri));
  assertType(Position.isIPosition(position));
  assertType(typeof triggerCharacter === "string" || !triggerCharacter);
  assertType(typeof maxItemsToResolve === "number" || !maxItemsToResolve);
  const { completionProvider } = accessor.get(ILanguageFeaturesService);
  const ref = await accessor.get(ITextModelService).createModelReference(uri);
  try {
    const result = {
      incomplete: false,
      suggestions: []
    };
    const resolving = [];
    const actualPosition = ref.object.textEditorModel.validatePosition(position);
    const completions = await provideSuggestionItems(completionProvider, ref.object.textEditorModel, actualPosition, void 0, { triggerCharacter: triggerCharacter ?? void 0, triggerKind: triggerCharacter ? languages.CompletionTriggerKind.TriggerCharacter : languages.CompletionTriggerKind.Invoke });
    for (const item of completions.items) {
      if (resolving.length < (maxItemsToResolve ?? 0)) {
        resolving.push(item.resolve(CancellationToken.None));
      }
      result.incomplete = result.incomplete || item.container.incomplete;
      result.suggestions.push(item.completion);
    }
    try {
      await Promise.all(resolving);
      return result;
    } finally {
      setTimeout(() => completions.disposable.dispose(), 100);
    }
  } finally {
    ref.dispose();
  }
});
function showSimpleSuggestions(editor, provider) {
  editor.getContribution("editor.contrib.suggestController")?.triggerSuggest(
    (/* @__PURE__ */ new Set()).add(provider),
    void 0,
    true
  );
}
class QuickSuggestionsOptions {
  static isAllOff(config) {
    return config.other === "off" && config.comments === "off" && config.strings === "off";
  }
  static isAllOn(config) {
    return config.other === "on" && config.comments === "on" && config.strings === "on";
  }
  static valueFor(config, tokenType) {
    switch (tokenType) {
      case StandardTokenType.Comment:
        return config.comments;
      case StandardTokenType.String:
        return config.strings;
      default:
        return config.other;
    }
  }
}
export {
  CompletionItem,
  CompletionItemModel,
  CompletionOptions,
  Context,
  QuickSuggestionsOptions,
  SnippetSortOrder,
  getSnippetSuggestSupport,
  getSuggestionComparator,
  provideSuggestionItems,
  setSnippetSuggestSupport,
  showSimpleSuggestions,
  suggestWidgetStatusbarMenu
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yLCBpc0NhbmNlbGxhdGlvbkVycm9yLCBvblVuZXhwZWN0ZWRFeHRlcm5hbEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIGlzRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCAqIGFzIGxhbmd1YWdlcyBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0UGFyc2VyIH0gZnJvbSAnLi4vLi4vc25pcHBldC9icm93c2VyL3NuaXBwZXRQYXJzZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IGhpc3RvcnlOYXZpZ2F0aW9uVmlzaWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hpc3RvcnkvYnJvd3Nlci9jb250ZXh0U2NvcGVkSGlzdG9yeVdpZGdldC5qcyc7XG5pbXBvcnQgeyBJbnRlcm5hbFF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zLCBRdWlja1N1Z2dlc3Rpb25zVmFsdWUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5cbmV4cG9ydCBjb25zdCBDb250ZXh0ID0ge1xuXHRWaXNpYmxlOiBoaXN0b3J5TmF2aWdhdGlvblZpc2libGUsXG5cdEhhc0ZvY3VzZWRTdWdnZXN0aW9uOiBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignc3VnZ2VzdFdpZGdldEhhc0ZvY3VzZWRTdWdnZXN0aW9uJywgZmFsc2UsIGxvY2FsaXplKCdzdWdnZXN0V2lkZ2V0SGFzU2VsZWN0aW9uJywgXCJXaGV0aGVyIGFueSBzdWdnZXN0aW9uIGlzIGZvY3VzZWRcIikpLFxuXHREZXRhaWxzVmlzaWJsZTogbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3N1Z2dlc3RXaWRnZXREZXRhaWxzVmlzaWJsZScsIGZhbHNlLCBsb2NhbGl6ZSgnc3VnZ2VzdFdpZGdldERldGFpbHNWaXNpYmxlJywgXCJXaGV0aGVyIHN1Z2dlc3Rpb24gZGV0YWlscyBhcmUgdmlzaWJsZVwiKSksXG5cdE11bHRpcGxlU3VnZ2VzdGlvbnM6IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzdWdnZXN0V2lkZ2V0TXVsdGlwbGVTdWdnZXN0aW9ucycsIGZhbHNlLCBsb2NhbGl6ZSgnc3VnZ2VzdFdpZGdldE11bHRpcGxlU3VnZ2VzdGlvbnMnLCBcIldoZXRoZXIgdGhlcmUgYXJlIG11bHRpcGxlIHN1Z2dlc3Rpb25zIHRvIHBpY2sgZnJvbVwiKSksXG5cdE1ha2VzVGV4dEVkaXQ6IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzdWdnZXN0aW9uTWFrZXNUZXh0RWRpdCcsIHRydWUsIGxvY2FsaXplKCdzdWdnZXN0aW9uTWFrZXNUZXh0RWRpdCcsIFwiV2hldGhlciBpbnNlcnRpbmcgdGhlIGN1cnJlbnQgc3VnZ2VzdGlvbiB5aWVsZHMgaW4gYSBjaGFuZ2Ugb3IgaGFzIGV2ZXJ5dGhpbmcgYWxyZWFkeSBiZWVuIHR5cGVkXCIpKSxcblx0QWNjZXB0U3VnZ2VzdGlvbnNPbkVudGVyOiBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignYWNjZXB0U3VnZ2VzdGlvbk9uRW50ZXInLCB0cnVlLCBsb2NhbGl6ZSgnYWNjZXB0U3VnZ2VzdGlvbk9uRW50ZXInLCBcIldoZXRoZXIgc3VnZ2VzdGlvbnMgYXJlIGluc2VydGVkIHdoZW4gcHJlc3NpbmcgRW50ZXJcIikpLFxuXHRIYXNJbnNlcnRBbmRSZXBsYWNlUmFuZ2U6IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzdWdnZXN0aW9uSGFzSW5zZXJ0QW5kUmVwbGFjZVJhbmdlJywgZmFsc2UsIGxvY2FsaXplKCdzdWdnZXN0aW9uSGFzSW5zZXJ0QW5kUmVwbGFjZVJhbmdlJywgXCJXaGV0aGVyIHRoZSBjdXJyZW50IHN1Z2dlc3Rpb24gaGFzIGluc2VydCBhbmQgcmVwbGFjZSBiZWhhdmlvdXJcIikpLFxuXHRJbnNlcnRNb2RlOiBuZXcgUmF3Q29udGV4dEtleTwnaW5zZXJ0JyB8ICdyZXBsYWNlJz4oJ3N1Z2dlc3Rpb25JbnNlcnRNb2RlJywgdW5kZWZpbmVkLCB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3N1Z2dlc3Rpb25JbnNlcnRNb2RlJywgXCJXaGV0aGVyIHRoZSBkZWZhdWx0IGJlaGF2aW91ciBpcyB0byBpbnNlcnQgb3IgcmVwbGFjZVwiKSB9KSxcblx0Q2FuUmVzb2x2ZTogbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3N1Z2dlc3Rpb25DYW5SZXNvbHZlJywgZmFsc2UsIGxvY2FsaXplKCdzdWdnZXN0aW9uQ2FuUmVzb2x2ZScsIFwiV2hldGhlciB0aGUgY3VycmVudCBzdWdnZXN0aW9uIHN1cHBvcnRzIHRvIHJlc29sdmUgZnVydGhlciBkZXRhaWxzXCIpKSxcbn07XG5cbmV4cG9ydCBjb25zdCBzdWdnZXN0V2lkZ2V0U3RhdHVzYmFyTWVudSA9IG5ldyBNZW51SWQoJ3N1Z2dlc3RXaWRnZXRTdGF0dXNCYXInKTtcblxuZXhwb3J0IGNsYXNzIENvbXBsZXRpb25JdGVtIHtcblxuXHRfYnJhbmQhOiAnSVN1Z2dlc3Rpb25JdGVtJztcblxuXHQvL1xuXHRyZWFkb25seSBlZGl0U3RhcnQ6IElQb3NpdGlvbjtcblx0cmVhZG9ubHkgZWRpdEluc2VydEVuZDogSVBvc2l0aW9uO1xuXHRyZWFkb25seSBlZGl0UmVwbGFjZUVuZDogSVBvc2l0aW9uO1xuXG5cdC8vXG5cdHJlYWRvbmx5IHRleHRMYWJlbDogc3RyaW5nO1xuXG5cdC8vIHBlcmZcblx0cmVhZG9ubHkgbGFiZWxMb3c6IHN0cmluZztcblx0cmVhZG9ubHkgc29ydFRleHRMb3c/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGZpbHRlclRleHRMb3c/OiBzdHJpbmc7XG5cblx0Ly8gdmFsaWRhdGlvblxuXHRyZWFkb25seSBpc0ludmFsaWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHQvLyBzb3J0aW5nLCBmaWx0ZXJpbmdcblx0c2NvcmU6IEZ1enp5U2NvcmUgPSBGdXp6eVNjb3JlLkRlZmF1bHQ7XG5cdGRpc3RhbmNlOiBudW1iZXIgPSAwO1xuXHRpZHg/OiBudW1iZXI7XG5cdHdvcmQ/OiBzdHJpbmc7XG5cblx0Ly8gaW5zdHJ1bWVudGF0aW9uXG5cdHJlYWRvbmx5IGV4dGVuc2lvbklkPzogRXh0ZW5zaW9uSWRlbnRpZmllcjtcblxuXHQvLyByZXNvbHZpbmdcblx0cHJpdmF0ZSBfcmVzb2x2ZUR1cmF0aW9uPzogbnVtYmVyO1xuXHRwcml2YXRlIF9yZXNvbHZlQ2FjaGU/OiBQcm9taXNlPHZvaWQ+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHBvc2l0aW9uOiBJUG9zaXRpb24sXG5cdFx0cmVhZG9ubHkgY29tcGxldGlvbjogbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtLFxuXHRcdHJlYWRvbmx5IGNvbnRhaW5lcjogbGFuZ3VhZ2VzLkNvbXBsZXRpb25MaXN0LFxuXHRcdHJlYWRvbmx5IHByb3ZpZGVyOiBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1Qcm92aWRlcixcblx0KSB7XG5cdFx0dGhpcy50ZXh0TGFiZWwgPSB0eXBlb2YgY29tcGxldGlvbi5sYWJlbCA9PT0gJ3N0cmluZydcblx0XHRcdD8gY29tcGxldGlvbi5sYWJlbFxuXHRcdFx0OiBjb21wbGV0aW9uLmxhYmVsPy5sYWJlbDtcblxuXHRcdC8vIGVuc3VyZSBsb3dlci12YXJpYW50cyAocGVyZilcblx0XHR0aGlzLmxhYmVsTG93ID0gdGhpcy50ZXh0TGFiZWwudG9Mb3dlckNhc2UoKTtcblxuXHRcdC8vIHZhbGlkYXRlIGxhYmVsXG5cdFx0dGhpcy5pc0ludmFsaWQgPSAhdGhpcy50ZXh0TGFiZWw7XG5cblx0XHR0aGlzLnNvcnRUZXh0TG93ID0gY29tcGxldGlvbi5zb3J0VGV4dCAmJiBjb21wbGV0aW9uLnNvcnRUZXh0LnRvTG93ZXJDYXNlKCk7XG5cdFx0dGhpcy5maWx0ZXJUZXh0TG93ID0gY29tcGxldGlvbi5maWx0ZXJUZXh0ICYmIGNvbXBsZXRpb24uZmlsdGVyVGV4dC50b0xvd2VyQ2FzZSgpO1xuXG5cdFx0dGhpcy5leHRlbnNpb25JZCA9IGNvbXBsZXRpb24uZXh0ZW5zaW9uSWQ7XG5cblx0XHQvLyBub3JtYWxpemUgcmFuZ2VzXG5cdFx0aWYgKFJhbmdlLmlzSVJhbmdlKGNvbXBsZXRpb24ucmFuZ2UpKSB7XG5cdFx0XHR0aGlzLmVkaXRTdGFydCA9IG5ldyBQb3NpdGlvbihjb21wbGV0aW9uLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgY29tcGxldGlvbi5yYW5nZS5zdGFydENvbHVtbik7XG5cdFx0XHR0aGlzLmVkaXRJbnNlcnRFbmQgPSBuZXcgUG9zaXRpb24oY29tcGxldGlvbi5yYW5nZS5lbmRMaW5lTnVtYmVyLCBjb21wbGV0aW9uLnJhbmdlLmVuZENvbHVtbik7XG5cdFx0XHR0aGlzLmVkaXRSZXBsYWNlRW5kID0gbmV3IFBvc2l0aW9uKGNvbXBsZXRpb24ucmFuZ2UuZW5kTGluZU51bWJlciwgY29tcGxldGlvbi5yYW5nZS5lbmRDb2x1bW4pO1xuXG5cdFx0XHQvLyB2YWxpZGF0ZSByYW5nZVxuXHRcdFx0dGhpcy5pc0ludmFsaWQgPSB0aGlzLmlzSW52YWxpZFxuXHRcdFx0XHR8fCBSYW5nZS5zcGFuc011bHRpcGxlTGluZXMoY29tcGxldGlvbi5yYW5nZSkgfHwgY29tcGxldGlvbi5yYW5nZS5zdGFydExpbmVOdW1iZXIgIT09IHBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lZGl0U3RhcnQgPSBuZXcgUG9zaXRpb24oY29tcGxldGlvbi5yYW5nZS5pbnNlcnQuc3RhcnRMaW5lTnVtYmVyLCBjb21wbGV0aW9uLnJhbmdlLmluc2VydC5zdGFydENvbHVtbik7XG5cdFx0XHR0aGlzLmVkaXRJbnNlcnRFbmQgPSBuZXcgUG9zaXRpb24oY29tcGxldGlvbi5yYW5nZS5pbnNlcnQuZW5kTGluZU51bWJlciwgY29tcGxldGlvbi5yYW5nZS5pbnNlcnQuZW5kQ29sdW1uKTtcblx0XHRcdHRoaXMuZWRpdFJlcGxhY2VFbmQgPSBuZXcgUG9zaXRpb24oY29tcGxldGlvbi5yYW5nZS5yZXBsYWNlLmVuZExpbmVOdW1iZXIsIGNvbXBsZXRpb24ucmFuZ2UucmVwbGFjZS5lbmRDb2x1bW4pO1xuXG5cdFx0XHQvLyB2YWxpZGF0ZSByYW5nZXNcblx0XHRcdHRoaXMuaXNJbnZhbGlkID0gdGhpcy5pc0ludmFsaWRcblx0XHRcdFx0fHwgUmFuZ2Uuc3BhbnNNdWx0aXBsZUxpbmVzKGNvbXBsZXRpb24ucmFuZ2UuaW5zZXJ0KSB8fCBSYW5nZS5zcGFuc011bHRpcGxlTGluZXMoY29tcGxldGlvbi5yYW5nZS5yZXBsYWNlKVxuXHRcdFx0XHR8fCBjb21wbGV0aW9uLnJhbmdlLmluc2VydC5zdGFydExpbmVOdW1iZXIgIT09IHBvc2l0aW9uLmxpbmVOdW1iZXIgfHwgY29tcGxldGlvbi5yYW5nZS5yZXBsYWNlLnN0YXJ0TGluZU51bWJlciAhPT0gcG9zaXRpb24ubGluZU51bWJlclxuXHRcdFx0XHR8fCBjb21wbGV0aW9uLnJhbmdlLmluc2VydC5zdGFydENvbHVtbiAhPT0gY29tcGxldGlvbi5yYW5nZS5yZXBsYWNlLnN0YXJ0Q29sdW1uO1xuXHRcdH1cblxuXHRcdC8vIGNyZWF0ZSB0aGUgc3VnZ2VzdGlvbiByZXNvbHZlclxuXHRcdGlmICh0eXBlb2YgcHJvdmlkZXIucmVzb2x2ZUNvbXBsZXRpb25JdGVtICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0aGlzLl9yZXNvbHZlQ2FjaGUgPSBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdHRoaXMuX3Jlc29sdmVEdXJhdGlvbiA9IDA7XG5cdFx0fVxuXHR9XG5cblx0Ly8gLS0tLSByZXNvbHZpbmdcblxuXHRnZXQgaXNSZXNvbHZlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVzb2x2ZUR1cmF0aW9uICE9PSB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgcmVzb2x2ZUR1cmF0aW9uKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc29sdmVEdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gdGhpcy5fcmVzb2x2ZUR1cmF0aW9uIDogLTE7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGlmICghdGhpcy5fcmVzb2x2ZUNhY2hlKSB7XG5cdFx0XHRjb25zdCBzdWIgPSB0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Jlc29sdmVDYWNoZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fcmVzb2x2ZUR1cmF0aW9uID0gdW5kZWZpbmVkO1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBzdyA9IG5ldyBTdG9wV2F0Y2godHJ1ZSk7XG5cdFx0XHR0aGlzLl9yZXNvbHZlQ2FjaGUgPSBQcm9taXNlLnJlc29sdmUodGhpcy5wcm92aWRlci5yZXNvbHZlQ29tcGxldGlvbkl0ZW0hKHRoaXMuY29tcGxldGlvbiwgdG9rZW4pKS50aGVuKHZhbHVlID0+IHtcblx0XHRcdFx0T2JqZWN0LmFzc2lnbih0aGlzLmNvbXBsZXRpb24sIHZhbHVlKTtcblx0XHRcdFx0dGhpcy5fcmVzb2x2ZUR1cmF0aW9uID0gc3cuZWxhcHNlZCgpO1xuXHRcdFx0fSwgZXJyID0+IHtcblx0XHRcdFx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSkge1xuXHRcdFx0XHRcdC8vIHRoZSBJUEMgcXVldWUgd2lsbCByZWplY3QgdGhlIHJlcXVlc3Qgd2l0aCB0aGVcblx0XHRcdFx0XHQvLyBjYW5jZWxsYXRpb24gZXJyb3IgLT4gcmVzZXQgY2FjaGVkXG5cdFx0XHRcdFx0dGhpcy5fcmVzb2x2ZUNhY2hlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHRoaXMuX3Jlc29sdmVEdXJhdGlvbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdHN1Yi5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc29sdmVDYWNoZTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBTbmlwcGV0U29ydE9yZGVyIHtcblx0VG9wLCBJbmxpbmUsIEJvdHRvbVxufVxuXG5leHBvcnQgY2xhc3MgQ29tcGxldGlvbk9wdGlvbnMge1xuXG5cdHN0YXRpYyByZWFkb25seSBkZWZhdWx0ID0gbmV3IENvbXBsZXRpb25PcHRpb25zKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgc25pcHBldFNvcnRPcmRlciA9IFNuaXBwZXRTb3J0T3JkZXIuQm90dG9tLFxuXHRcdHJlYWRvbmx5IGtpbmRGaWx0ZXIgPSBuZXcgU2V0PGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQ+KCksXG5cdFx0cmVhZG9ubHkgcHJvdmlkZXJGaWx0ZXIgPSBuZXcgU2V0PGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbVByb3ZpZGVyPigpLFxuXHRcdHJlYWRvbmx5IHByb3ZpZGVySXRlbXNUb1JldXNlOiBSZWFkb25seU1hcDxsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1Qcm92aWRlciwgQ29tcGxldGlvbkl0ZW1bXT4gPSBuZXcgTWFwPGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbVByb3ZpZGVyLCBDb21wbGV0aW9uSXRlbVtdPigpLFxuXHRcdHJlYWRvbmx5IHNob3dEZXByZWNhdGVkID0gdHJ1ZVxuXHQpIHsgfVxufVxuXG5sZXQgX3NuaXBwZXRTdWdnZXN0U3VwcG9ydDogbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTbmlwcGV0U3VnZ2VzdFN1cHBvcnQoKTogbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gX3NuaXBwZXRTdWdnZXN0U3VwcG9ydDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFNuaXBwZXRTdWdnZXN0U3VwcG9ydChzdXBwb3J0OiBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1Qcm92aWRlciB8IHVuZGVmaW5lZCk6IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbVByb3ZpZGVyIHwgdW5kZWZpbmVkIHtcblx0Y29uc3Qgb2xkID0gX3NuaXBwZXRTdWdnZXN0U3VwcG9ydDtcblx0X3NuaXBwZXRTdWdnZXN0U3VwcG9ydCA9IHN1cHBvcnQ7XG5cdHJldHVybiBvbGQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGxldGlvbkR1cmF0aW9uRW50cnkge1xuXHRyZWFkb25seSBwcm92aWRlck5hbWU6IHN0cmluZztcblx0cmVhZG9ubHkgZWxhcHNlZFByb3ZpZGVyOiBudW1iZXI7XG5cdHJlYWRvbmx5IGVsYXBzZWRPdmVyYWxsOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tcGxldGlvbkR1cmF0aW9ucyB7XG5cdHJlYWRvbmx5IGVudHJpZXM6IHJlYWRvbmx5IENvbXBsZXRpb25EdXJhdGlvbkVudHJ5W107XG5cdHJlYWRvbmx5IGVsYXBzZWQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIENvbXBsZXRpb25JdGVtTW9kZWwge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBpdGVtczogQ29tcGxldGlvbkl0ZW1bXSxcblx0XHRyZWFkb25seSBuZWVkc0NsaXBib2FyZDogYm9vbGVhbixcblx0XHRyZWFkb25seSBkdXJhdGlvbnM6IENvbXBsZXRpb25EdXJhdGlvbnMsXG5cdFx0cmVhZG9ubHkgZGlzcG9zYWJsZTogSURpc3Bvc2FibGUsXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm92aWRlU3VnZ2VzdGlvbkl0ZW1zKFxuXHRyZWdpc3RyeTogTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnk8bGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtUHJvdmlkZXI+LFxuXHRtb2RlbDogSVRleHRNb2RlbCxcblx0cG9zaXRpb246IFBvc2l0aW9uLFxuXHRvcHRpb25zOiBDb21wbGV0aW9uT3B0aW9ucyA9IENvbXBsZXRpb25PcHRpb25zLmRlZmF1bHQsXG5cdGNvbnRleHQ6IGxhbmd1YWdlcy5Db21wbGV0aW9uQ29udGV4dCA9IHsgdHJpZ2dlcktpbmQ6IGxhbmd1YWdlcy5Db21wbGV0aW9uVHJpZ2dlcktpbmQuSW52b2tlIH0sXG5cdHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmVcbik6IFByb21pc2U8Q29tcGxldGlvbkl0ZW1Nb2RlbD4ge1xuXG5cdGNvbnN0IHN3ID0gbmV3IFN0b3BXYXRjaCgpO1xuXHRwb3NpdGlvbiA9IHBvc2l0aW9uLmNsb25lKCk7XG5cblx0Y29uc3Qgd29yZCA9IG1vZGVsLmdldFdvcmRBdFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0Y29uc3QgZGVmYXVsdFJlcGxhY2VSYW5nZSA9IHdvcmQgPyBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgd29yZC5zdGFydENvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgd29yZC5lbmRDb2x1bW4pIDogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3NpdGlvbik7XG5cdGNvbnN0IGRlZmF1bHRSYW5nZSA9IHsgcmVwbGFjZTogZGVmYXVsdFJlcGxhY2VSYW5nZSwgaW5zZXJ0OiBkZWZhdWx0UmVwbGFjZVJhbmdlLnNldEVuZFBvc2l0aW9uKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbikgfTtcblxuXHRjb25zdCByZXN1bHQ6IENvbXBsZXRpb25JdGVtW10gPSBbXTtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IGR1cmF0aW9uczogQ29tcGxldGlvbkR1cmF0aW9uRW50cnlbXSA9IFtdO1xuXHRsZXQgbmVlZHNDbGlwYm9hcmQgPSBmYWxzZTtcblxuXHRjb25zdCBvbkNvbXBsZXRpb25MaXN0ID0gKHByb3ZpZGVyOiBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1Qcm92aWRlciwgY29udGFpbmVyOiBsYW5ndWFnZXMuQ29tcGxldGlvbkxpc3QgfCBudWxsIHwgdW5kZWZpbmVkLCBzdzogU3RvcFdhdGNoKTogYm9vbGVhbiA9PiB7XG5cdFx0bGV0IGRpZEFkZFJlc3VsdCA9IGZhbHNlO1xuXHRcdGlmICghY29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm4gZGlkQWRkUmVzdWx0O1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IHN1Z2dlc3Rpb24gb2YgY29udGFpbmVyLnN1Z2dlc3Rpb25zKSB7XG5cdFx0XHRpZiAoIW9wdGlvbnMua2luZEZpbHRlci5oYXMoc3VnZ2VzdGlvbi5raW5kKSkge1xuXHRcdFx0XHQvLyBza2lwIGlmIG5vdCBzaG93aW5nIGRlcHJlY2F0ZWQgc3VnZ2VzdGlvbnNcblx0XHRcdFx0aWYgKCFvcHRpb25zLnNob3dEZXByZWNhdGVkICYmIHN1Z2dlc3Rpb24/LnRhZ3M/LmluY2x1ZGVzKGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbVRhZy5EZXByZWNhdGVkKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIGZpbGwgaW4gZGVmYXVsdCByYW5nZSB3aGVuIG1pc3Npbmdcblx0XHRcdFx0aWYgKCFzdWdnZXN0aW9uLnJhbmdlKSB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbi5yYW5nZSA9IGRlZmF1bHRSYW5nZTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBmaWxsIGluIGRlZmF1bHQgc29ydFRleHQgd2hlbiBtaXNzaW5nXG5cdFx0XHRcdGlmICghc3VnZ2VzdGlvbi5zb3J0VGV4dCkge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb24uc29ydFRleHQgPSB0eXBlb2Ygc3VnZ2VzdGlvbi5sYWJlbCA9PT0gJ3N0cmluZycgPyBzdWdnZXN0aW9uLmxhYmVsIDogc3VnZ2VzdGlvbi5sYWJlbC5sYWJlbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIW5lZWRzQ2xpcGJvYXJkICYmIHN1Z2dlc3Rpb24uaW5zZXJ0VGV4dFJ1bGVzICYmIHN1Z2dlc3Rpb24uaW5zZXJ0VGV4dFJ1bGVzICYgbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtSW5zZXJ0VGV4dFJ1bGUuSW5zZXJ0QXNTbmlwcGV0KSB7XG5cdFx0XHRcdFx0bmVlZHNDbGlwYm9hcmQgPSBTbmlwcGV0UGFyc2VyLmd1ZXNzTmVlZHNDbGlwYm9hcmQoc3VnZ2VzdGlvbi5pbnNlcnRUZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQucHVzaChuZXcgQ29tcGxldGlvbkl0ZW0ocG9zaXRpb24sIHN1Z2dlc3Rpb24sIGNvbnRhaW5lciwgcHJvdmlkZXIpKTtcblx0XHRcdFx0ZGlkQWRkUmVzdWx0ID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGlzRGlzcG9zYWJsZShjb250YWluZXIpKSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoY29udGFpbmVyKTtcblx0XHR9XG5cdFx0ZHVyYXRpb25zLnB1c2goe1xuXHRcdFx0cHJvdmlkZXJOYW1lOiBwcm92aWRlci5fZGVidWdEaXNwbGF5TmFtZSA/PyAndW5rbm93bl9wcm92aWRlcicsIGVsYXBzZWRQcm92aWRlcjogY29udGFpbmVyLmR1cmF0aW9uID8/IC0xLCBlbGFwc2VkT3ZlcmFsbDogc3cuZWxhcHNlZCgpXG5cdFx0fSk7XG5cdFx0cmV0dXJuIGRpZEFkZFJlc3VsdDtcblx0fTtcblxuXHQvLyBhc2sgZm9yIHNuaXBwZXRzIGluIHBhcmFsbGVsIHRvIGFza2luZyBcInJlYWxcIiBwcm92aWRlcnMuIE9ubHkgZG8gc29tZXRoaW5nIGlmIGNvbmZpZ3VyZWQgdG9cblx0Ly8gZG8gc28gLSBubyBzbmlwcGV0IGZpbHRlciwgbm8gc3BlY2lhbC1wcm92aWRlcnMtb25seSByZXF1ZXN0XG5cdGNvbnN0IHNuaXBwZXRDb21wbGV0aW9ucyA9IChhc3luYyAoKSA9PiB7XG5cdFx0aWYgKCFfc25pcHBldFN1Z2dlc3RTdXBwb3J0IHx8IG9wdGlvbnMua2luZEZpbHRlci5oYXMobGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyB3ZSBoYXZlIGl0ZW1zIGZyb20gYSBwcmV2aW91cyBzZXNzaW9uIHRoYXQgd2UgY2FuIHJldXNlXG5cdFx0Y29uc3QgcmV1c2VJdGVtcyA9IG9wdGlvbnMucHJvdmlkZXJJdGVtc1RvUmV1c2UuZ2V0KF9zbmlwcGV0U3VnZ2VzdFN1cHBvcnQpO1xuXHRcdGlmIChyZXVzZUl0ZW1zKSB7XG5cdFx0XHRyZXVzZUl0ZW1zLmZvckVhY2goaXRlbSA9PiByZXN1bHQucHVzaChpdGVtKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLnByb3ZpZGVyRmlsdGVyLnNpemUgPiAwICYmICFvcHRpb25zLnByb3ZpZGVyRmlsdGVyLmhhcyhfc25pcHBldFN1Z2dlc3RTdXBwb3J0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBzdyA9IG5ldyBTdG9wV2F0Y2goKTtcblx0XHRjb25zdCBsaXN0ID0gYXdhaXQgX3NuaXBwZXRTdWdnZXN0U3VwcG9ydC5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKG1vZGVsLCBwb3NpdGlvbiwgY29udGV4dCwgdG9rZW4pO1xuXHRcdG9uQ29tcGxldGlvbkxpc3QoX3NuaXBwZXRTdWdnZXN0U3VwcG9ydCwgbGlzdCwgc3cpO1xuXHR9KSgpO1xuXG5cdC8vIGFkZCBzdWdnZXN0aW9ucyBmcm9tIGNvbnRyaWJ1dGVkIHByb3ZpZGVycyAtIHByb3ZpZGVycyBhcmUgb3JkZXJlZCBpbiBncm91cHMgb2Zcblx0Ly8gZXF1YWwgc2NvcmUgYW5kIG9uY2UgYSBncm91cCBwcm9kdWNlcyBhIHJlc3VsdCB0aGUgcHJvY2VzcyBzdG9wc1xuXHQvLyBnZXQgcHJvdmlkZXIgZ3JvdXBzLCBhbHdheXMgYWRkIHNuaXBwZXQgc3VnZ2VzdGlvbiBwcm92aWRlclxuXHRmb3IgKGNvbnN0IHByb3ZpZGVyR3JvdXAgb2YgcmVnaXN0cnkub3JkZXJlZEdyb3Vwcyhtb2RlbCkpIHtcblxuXHRcdC8vIGZvciBlYWNoIHN1cHBvcnQgaW4gdGhlIGdyb3VwIGFzayBmb3Igc3VnZ2VzdGlvbnNcblx0XHRsZXQgZGlkQWRkUmVzdWx0ID0gZmFsc2U7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwocHJvdmlkZXJHcm91cC5tYXAoYXN5bmMgcHJvdmlkZXIgPT4ge1xuXHRcdFx0Ly8gd2UgaGF2ZSBpdGVtcyBmcm9tIGEgcHJldmlvdXMgc2Vzc2lvbiB0aGF0IHdlIGNhbiByZXVzZVxuXHRcdFx0aWYgKG9wdGlvbnMucHJvdmlkZXJJdGVtc1RvUmV1c2UuaGFzKHByb3ZpZGVyKSkge1xuXHRcdFx0XHRjb25zdCBpdGVtcyA9IG9wdGlvbnMucHJvdmlkZXJJdGVtc1RvUmV1c2UuZ2V0KHByb3ZpZGVyKSE7XG5cdFx0XHRcdGl0ZW1zLmZvckVhY2goaXRlbSA9PiByZXN1bHQucHVzaChpdGVtKSk7XG5cdFx0XHRcdGRpZEFkZFJlc3VsdCA9IGRpZEFkZFJlc3VsdCB8fCBpdGVtcy5sZW5ndGggPiAwO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQvLyBjaGVjayBpZiB0aGlzIHByb3ZpZGVyIGlzIGZpbHRlcmVkIG91dFxuXHRcdFx0aWYgKG9wdGlvbnMucHJvdmlkZXJGaWx0ZXIuc2l6ZSA+IDAgJiYgIW9wdGlvbnMucHJvdmlkZXJGaWx0ZXIuaGFzKHByb3ZpZGVyKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBzdyA9IG5ldyBTdG9wV2F0Y2goKTtcblx0XHRcdFx0Y29uc3QgbGlzdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMobW9kZWwsIHBvc2l0aW9uLCBjb250ZXh0LCB0b2tlbik7XG5cdFx0XHRcdGRpZEFkZFJlc3VsdCA9IG9uQ29tcGxldGlvbkxpc3QocHJvdmlkZXIsIGxpc3QsIHN3KSB8fCBkaWRBZGRSZXN1bHQ7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGlmIChkaWRBZGRSZXN1bHQgfHwgdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdGF3YWl0IHNuaXBwZXRDb21wbGV0aW9ucztcblxuXHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVqZWN0PGFueT4obmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHR9XG5cblx0cmV0dXJuIG5ldyBDb21wbGV0aW9uSXRlbU1vZGVsKFxuXHRcdHJlc3VsdC5zb3J0KGdldFN1Z2dlc3Rpb25Db21wYXJhdG9yKG9wdGlvbnMuc25pcHBldFNvcnRPcmRlcikpLFxuXHRcdG5lZWRzQ2xpcGJvYXJkLFxuXHRcdHsgZW50cmllczogZHVyYXRpb25zLCBlbGFwc2VkOiBzdy5lbGFwc2VkKCkgfSxcblx0XHRkaXNwb3NhYmxlcyxcblx0KTtcbn1cblxuXG5mdW5jdGlvbiBkZWZhdWx0Q29tcGFyYXRvcihhOiBDb21wbGV0aW9uSXRlbSwgYjogQ29tcGxldGlvbkl0ZW0pOiBudW1iZXIge1xuXHQvLyBjaGVjayB3aXRoICdzb3J0VGV4dCdcblx0aWYgKGEuc29ydFRleHRMb3cgJiYgYi5zb3J0VGV4dExvdykge1xuXHRcdGlmIChhLnNvcnRUZXh0TG93IDwgYi5zb3J0VGV4dExvdykge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH0gZWxzZSBpZiAoYS5zb3J0VGV4dExvdyA+IGIuc29ydFRleHRMb3cpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblx0fVxuXHQvLyBjaGVjayB3aXRoICdsYWJlbCdcblx0aWYgKGEudGV4dExhYmVsIDwgYi50ZXh0TGFiZWwpIHtcblx0XHRyZXR1cm4gLTE7XG5cdH0gZWxzZSBpZiAoYS50ZXh0TGFiZWwgPiBiLnRleHRMYWJlbCkge1xuXHRcdHJldHVybiAxO1xuXHR9XG5cdC8vIGNoZWNrIHdpdGggJ3R5cGUnXG5cdHJldHVybiBhLmNvbXBsZXRpb24ua2luZCAtIGIuY29tcGxldGlvbi5raW5kO1xufVxuXG5mdW5jdGlvbiBzbmlwcGV0VXBDb21wYXJhdG9yKGE6IENvbXBsZXRpb25JdGVtLCBiOiBDb21wbGV0aW9uSXRlbSk6IG51bWJlciB7XG5cdGlmIChhLmNvbXBsZXRpb24ua2luZCAhPT0gYi5jb21wbGV0aW9uLmtpbmQpIHtcblx0XHRpZiAoYS5jb21wbGV0aW9uLmtpbmQgPT09IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH0gZWxzZSBpZiAoYi5jb21wbGV0aW9uLmtpbmQgPT09IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBkZWZhdWx0Q29tcGFyYXRvcihhLCBiKTtcbn1cblxuZnVuY3Rpb24gc25pcHBldERvd25Db21wYXJhdG9yKGE6IENvbXBsZXRpb25JdGVtLCBiOiBDb21wbGV0aW9uSXRlbSk6IG51bWJlciB7XG5cdGlmIChhLmNvbXBsZXRpb24ua2luZCAhPT0gYi5jb21wbGV0aW9uLmtpbmQpIHtcblx0XHRpZiAoYS5jb21wbGV0aW9uLmtpbmQgPT09IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fSBlbHNlIGlmIChiLmNvbXBsZXRpb24ua2luZCA9PT0gbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0KSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBkZWZhdWx0Q29tcGFyYXRvcihhLCBiKTtcbn1cblxuaW50ZXJmYWNlIENvbXBhcmF0b3I8VD4geyAoYTogVCwgYjogVCk6IG51bWJlciB9XG5jb25zdCBfc25pcHBldENvbXBhcmF0b3JzID0gbmV3IE1hcDxTbmlwcGV0U29ydE9yZGVyLCBDb21wYXJhdG9yPENvbXBsZXRpb25JdGVtPj4oKTtcbl9zbmlwcGV0Q29tcGFyYXRvcnMuc2V0KFNuaXBwZXRTb3J0T3JkZXIuVG9wLCBzbmlwcGV0VXBDb21wYXJhdG9yKTtcbl9zbmlwcGV0Q29tcGFyYXRvcnMuc2V0KFNuaXBwZXRTb3J0T3JkZXIuQm90dG9tLCBzbmlwcGV0RG93bkNvbXBhcmF0b3IpO1xuX3NuaXBwZXRDb21wYXJhdG9ycy5zZXQoU25pcHBldFNvcnRPcmRlci5JbmxpbmUsIGRlZmF1bHRDb21wYXJhdG9yKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN1Z2dlc3Rpb25Db21wYXJhdG9yKHNuaXBwZXRDb25maWc6IFNuaXBwZXRTb3J0T3JkZXIpOiAoYTogQ29tcGxldGlvbkl0ZW0sIGI6IENvbXBsZXRpb25JdGVtKSA9PiBudW1iZXIge1xuXHRyZXR1cm4gX3NuaXBwZXRDb21wYXJhdG9ycy5nZXQoc25pcHBldENvbmZpZykhO1xufVxuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnX2V4ZWN1dGVDb21wbGV0aW9uSXRlbVByb3ZpZGVyJywgYXN5bmMgKGFjY2Vzc29yLCAuLi5hcmdzOiBbVVJJLCBJUG9zaXRpb24sIHN0cmluZz8sIG51bWJlcj9dKSA9PiB7XG5cdGNvbnN0IFt1cmksIHBvc2l0aW9uLCB0cmlnZ2VyQ2hhcmFjdGVyLCBtYXhJdGVtc1RvUmVzb2x2ZV0gPSBhcmdzO1xuXHRhc3NlcnRUeXBlKFVSSS5pc1VyaSh1cmkpKTtcblx0YXNzZXJ0VHlwZShQb3NpdGlvbi5pc0lQb3NpdGlvbihwb3NpdGlvbikpO1xuXHRhc3NlcnRUeXBlKHR5cGVvZiB0cmlnZ2VyQ2hhcmFjdGVyID09PSAnc3RyaW5nJyB8fCAhdHJpZ2dlckNoYXJhY3Rlcik7XG5cdGFzc2VydFR5cGUodHlwZW9mIG1heEl0ZW1zVG9SZXNvbHZlID09PSAnbnVtYmVyJyB8fCAhbWF4SXRlbXNUb1Jlc29sdmUpO1xuXG5cdGNvbnN0IHsgY29tcGxldGlvblByb3ZpZGVyIH0gPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0Y29uc3QgcmVmID0gYXdhaXQgYWNjZXNzb3IuZ2V0KElUZXh0TW9kZWxTZXJ2aWNlKS5jcmVhdGVNb2RlbFJlZmVyZW5jZSh1cmkpO1xuXHR0cnkge1xuXG5cdFx0Y29uc3QgcmVzdWx0OiBsYW5ndWFnZXMuQ29tcGxldGlvbkxpc3QgPSB7XG5cdFx0XHRpbmNvbXBsZXRlOiBmYWxzZSxcblx0XHRcdHN1Z2dlc3Rpb25zOiBbXVxuXHRcdH07XG5cblx0XHRjb25zdCByZXNvbHZpbmc6IFByb21pc2U8YW55PltdID0gW107XG5cdFx0Y29uc3QgYWN0dWFsUG9zaXRpb24gPSByZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbC52YWxpZGF0ZVBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRjb25zdCBjb21wbGV0aW9ucyA9IGF3YWl0IHByb3ZpZGVTdWdnZXN0aW9uSXRlbXMoY29tcGxldGlvblByb3ZpZGVyLCByZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbCwgYWN0dWFsUG9zaXRpb24sIHVuZGVmaW5lZCwgeyB0cmlnZ2VyQ2hhcmFjdGVyOiB0cmlnZ2VyQ2hhcmFjdGVyID8/IHVuZGVmaW5lZCwgdHJpZ2dlcktpbmQ6IHRyaWdnZXJDaGFyYWN0ZXIgPyBsYW5ndWFnZXMuQ29tcGxldGlvblRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIgOiBsYW5ndWFnZXMuQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZSB9KTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgY29tcGxldGlvbnMuaXRlbXMpIHtcblx0XHRcdGlmIChyZXNvbHZpbmcubGVuZ3RoIDwgKG1heEl0ZW1zVG9SZXNvbHZlID8/IDApKSB7XG5cdFx0XHRcdHJlc29sdmluZy5wdXNoKGl0ZW0ucmVzb2x2ZShDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQuaW5jb21wbGV0ZSA9IHJlc3VsdC5pbmNvbXBsZXRlIHx8IGl0ZW0uY29udGFpbmVyLmluY29tcGxldGU7XG5cdFx0XHRyZXN1bHQuc3VnZ2VzdGlvbnMucHVzaChpdGVtLmNvbXBsZXRpb24pO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChyZXNvbHZpbmcpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiBjb21wbGV0aW9ucy5kaXNwb3NhYmxlLmRpc3Bvc2UoKSwgMTAwKTtcblx0XHR9XG5cblx0fSBmaW5hbGx5IHtcblx0XHRyZWYuZGlzcG9zZSgpO1xuXHR9XG5cbn0pO1xuXG5pbnRlcmZhY2UgU3VnZ2VzdENvbnRyb2xsZXIgZXh0ZW5kcyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblx0dHJpZ2dlclN1Z2dlc3Qob25seUZyb20/OiBTZXQ8bGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtUHJvdmlkZXI+LCBhdXRvPzogYm9vbGVhbiwgbm9GaWx0ZXI/OiBib29sZWFuKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dTaW1wbGVTdWdnZXN0aW9ucyhlZGl0b3I6IElDb2RlRWRpdG9yLCBwcm92aWRlcjogbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIpIHtcblx0ZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxTdWdnZXN0Q29udHJvbGxlcj4oJ2VkaXRvci5jb250cmliLnN1Z2dlc3RDb250cm9sbGVyJyk/LnRyaWdnZXJTdWdnZXN0KFxuXHRcdG5ldyBTZXQ8bGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtUHJvdmlkZXI+KCkuYWRkKHByb3ZpZGVyKSwgdW5kZWZpbmVkLCB0cnVlXG5cdCk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN1Z2dlc3RJdGVtUHJlc2VsZWN0b3Ige1xuXHQvKipcblx0ICogVGhlIHByZXNlbGVjdG9yIHdpdGggaGlnaGVzdCBwcmlvcml0eSBpcyBhc2tlZCBmaXJzdC5cblx0Ki9cblx0cmVhZG9ubHkgcHJpb3JpdHk6IG51bWJlcjtcblxuXHQvKipcblx0ICogSXMgY2FsbGVkIHRvIHByZXNlbGVjdCBhIHN1Z2dlc3QgaXRlbS5cblx0ICogV2hlbiAtMSBpcyByZXR1cm5lZCwgaXRlbSBwcmVzZWxlY3RvcnMgd2l0aCBsb3dlciBwcmlvcml0eSBhcmUgYXNrZWQuXG5cdCovXG5cdHNlbGVjdChtb2RlbDogSVRleHRNb2RlbCwgcG9zOiBJUG9zaXRpb24sIGl0ZW1zOiBDb21wbGV0aW9uSXRlbVtdKTogbnVtYmVyIHwgLTE7XG59XG5cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zIHtcblxuXHRzdGF0aWMgaXNBbGxPZmYoY29uZmlnOiBJbnRlcm5hbFF1aWNrU3VnZ2VzdGlvbnNPcHRpb25zKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGNvbmZpZy5vdGhlciA9PT0gJ29mZicgJiYgY29uZmlnLmNvbW1lbnRzID09PSAnb2ZmJyAmJiBjb25maWcuc3RyaW5ncyA9PT0gJ29mZic7XG5cdH1cblxuXHRzdGF0aWMgaXNBbGxPbihjb25maWc6IEludGVybmFsUXVpY2tTdWdnZXN0aW9uc09wdGlvbnMpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gY29uZmlnLm90aGVyID09PSAnb24nICYmIGNvbmZpZy5jb21tZW50cyA9PT0gJ29uJyAmJiBjb25maWcuc3RyaW5ncyA9PT0gJ29uJztcblx0fVxuXG5cdHN0YXRpYyB2YWx1ZUZvcihjb25maWc6IEludGVybmFsUXVpY2tTdWdnZXN0aW9uc09wdGlvbnMsIHRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUpOiBRdWlja1N1Z2dlc3Rpb25zVmFsdWUge1xuXHRcdHN3aXRjaCAodG9rZW5UeXBlKSB7XG5cdFx0XHRjYXNlIFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQ6IHJldHVybiBjb25maWcuY29tbWVudHM7XG5cdFx0XHRjYXNlIFN0YW5kYXJkVG9rZW5UeXBlLlN0cmluZzogcmV0dXJuIGNvbmZpZy5zdHJpbmdzO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuIGNvbmZpZy5vdGhlcjtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsbUJBQW1CLHFCQUFxQixpQ0FBaUM7QUFDbEYsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxpQkFBOEIsb0JBQW9CO0FBQzNELFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVztBQUVwQixTQUFvQixnQkFBZ0I7QUFDcEMsU0FBUyxhQUFhO0FBR3RCLFlBQVksZUFBZTtBQUMzQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQWM7QUFDdkIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxxQkFBcUI7QUFFOUIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxnQ0FBZ0M7QUFHekMsU0FBUyx5QkFBeUI7QUFFM0IsTUFBTSxVQUFVO0FBQUEsRUFDdEIsU0FBUztBQUFBLEVBQ1Qsc0JBQXNCLElBQUksY0FBdUIscUNBQXFDLE9BQU8sU0FBUyw2QkFBNkIsbUNBQW1DLENBQUM7QUFBQSxFQUN2SyxnQkFBZ0IsSUFBSSxjQUF1QiwrQkFBK0IsT0FBTyxTQUFTLCtCQUErQix3Q0FBd0MsQ0FBQztBQUFBLEVBQ2xLLHFCQUFxQixJQUFJLGNBQXVCLG9DQUFvQyxPQUFPLFNBQVMsb0NBQW9DLHFEQUFxRCxDQUFDO0FBQUEsRUFDOUwsZUFBZSxJQUFJLGNBQXVCLDJCQUEyQixNQUFNLFNBQVMsMkJBQTJCLGtHQUFrRyxDQUFDO0FBQUEsRUFDbE4sMEJBQTBCLElBQUksY0FBdUIsMkJBQTJCLE1BQU0sU0FBUywyQkFBMkIsc0RBQXNELENBQUM7QUFBQSxFQUNqTCwwQkFBMEIsSUFBSSxjQUF1QixzQ0FBc0MsT0FBTyxTQUFTLHNDQUFzQyxp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QUFNLFNBQW1DO0FBQUEsTUFDeEMsWUFBWTtBQUFBLE1BQ1osYUFBYSxDQUFDO0FBQUEsSUFDZjtBQUVBLFVBQU0sWUFBNEIsQ0FBQztBQUNuQyxVQUFNLGlCQUFpQixJQUFJLE9BQU8sZ0JBQWdCLGlCQUFpQixRQUFRO0FBQzNFLFVBQU0sY0FBYyxNQUFNLHVCQUF1QixvQkFBb0IsSUFBSSxPQUFPLGlCQUFpQixnQkFBZ0IsUUFBVyxFQUFFLGtCQUFrQixvQkFBb0IsUUFBVyxhQUFhLG1CQUFtQixVQUFVLHNCQUFzQixtQkFBbUIsVUFBVSxzQkFBc0IsT0FBTyxDQUFDO0FBQzFTLGVBQVcsUUFBUSxZQUFZLE9BQU87QUFDckMsVUFBSSxVQUFVLFVBQVUscUJBQXFCLElBQUk7QUFDaEQsa0JBQVUsS0FBSyxLQUFLLFFBQVEsa0JBQWtCLElBQUksQ0FBQztBQUFBLE1BQ3BEO0FBQ0EsYUFBTyxhQUFhLE9BQU8sY0FBYyxLQUFLLFVBQVU7QUFDeEQsYUFBTyxZQUFZLEtBQUssS0FBSyxVQUFVO0FBQUEsSUFDeEM7QUFFQSxRQUFJO0FBQ0gsWUFBTSxRQUFRLElBQUksU0FBUztBQUMzQixhQUFPO0FBQUEsSUFDUixVQUFFO0FBQ0QsaUJBQVcsTUFBTSxZQUFZLFdBQVcsUUFBUSxHQUFHLEdBQUc7QUFBQSxJQUN2RDtBQUFBLEVBRUQsVUFBRTtBQUNELFFBQUksUUFBUTtBQUFBLEVBQ2I7QUFFRCxDQUFDO0FBTU0sU0FBUyxzQkFBc0IsUUFBcUIsVUFBNEM7QUFDdEcsU0FBTyxnQkFBbUMsa0NBQWtDLEdBQUc7QUFBQSxLQUM5RSxvQkFBSSxJQUFzQyxHQUFFLElBQUksUUFBUTtBQUFBLElBQUc7QUFBQSxJQUFXO0FBQUEsRUFDdkU7QUFDRDtBQWdCTyxNQUFlLHdCQUF3QjtBQUFBLEVBRTdDLE9BQU8sU0FBUyxRQUFrRDtBQUNqRSxXQUFPLE9BQU8sVUFBVSxTQUFTLE9BQU8sYUFBYSxTQUFTLE9BQU8sWUFBWTtBQUFBLEVBQ2xGO0FBQUEsRUFFQSxPQUFPLFFBQVEsUUFBa0Q7QUFDaEUsV0FBTyxPQUFPLFVBQVUsUUFBUSxPQUFPLGFBQWEsUUFBUSxPQUFPLFlBQVk7QUFBQSxFQUNoRjtBQUFBLEVBRUEsT0FBTyxTQUFTLFFBQXlDLFdBQXFEO0FBQzdHLFlBQVEsV0FBVztBQUFBLE1BQ2xCLEtBQUssa0JBQWtCO0FBQVMsZUFBTyxPQUFPO0FBQUEsTUFDOUMsS0FBSyxrQkFBa0I7QUFBUSxlQUFPLE9BQU87QUFBQSxNQUM3QztBQUFTLGVBQU8sT0FBTztBQUFBLElBQ3hCO0FBQUEsRUFDRDtBQUNEOyIsCiAgIm5hbWVzIjogWyJTbmlwcGV0U29ydE9yZGVyIiwgInN3Il0KfQo=
