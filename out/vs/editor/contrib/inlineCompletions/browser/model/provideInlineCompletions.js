import { assertNever } from "../../../../../base/common/assert.js";
import { AsyncIterableObject, DeferredPromise } from "../../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { onUnexpectedExternalError } from "../../../../../base/common/errors.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { SetMap } from "../../../../../base/common/map.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { SingleOffsetEdit } from "../../../../common/core/offsetEdit.js";
import { OffsetRange } from "../../../../common/core/offsetRange.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { SingleTextEdit } from "../../../../common/core/textEdit.js";
import { InlineCompletionTriggerKind } from "../../../../common/languages.js";
import { fixBracketsInLine } from "../../../../common/model/bracketPairsTextModelPart/fixBrackets.js";
import { TextModelText } from "../../../../common/model/textModelText.js";
import { SnippetParser, Text } from "../../../snippet/browser/snippetParser.js";
import { getReadonlyEmptyArray } from "../utils.js";
async function provideInlineCompletions(registry, positionOrRange, model, context, baseToken = CancellationToken.None, languageConfigurationService) {
  const requestUuid = generateUuid();
  const tokenSource = new CancellationTokenSource(baseToken);
  const token = tokenSource.token;
  const contextWithUuid = { ...context, requestUuid };
  const defaultReplaceRange = positionOrRange instanceof Position ? getDefaultRange(positionOrRange, model) : positionOrRange;
  const providers = registry.all(model);
  const multiMap = new SetMap();
  for (const provider of providers) {
    if (provider.groupId) {
      multiMap.add(provider.groupId, provider);
    }
  }
  function getPreferredProviders(provider) {
    if (!provider.yieldsToGroupIds) {
      return [];
    }
    const result2 = [];
    for (const groupId of provider.yieldsToGroupIds || []) {
      const providers2 = multiMap.get(groupId);
      for (const p of providers2) {
        result2.push(p);
      }
    }
    return result2;
  }
  const states = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Set();
  function findPreferredProviderCircle(provider, stack) {
    stack = [...stack, provider];
    if (seen.has(provider)) {
      return stack;
    }
    seen.add(provider);
    try {
      const preferred = getPreferredProviders(provider);
      for (const p of preferred) {
        const c = findPreferredProviderCircle(p, stack);
        if (c) {
          return c;
        }
      }
    } finally {
      seen.delete(provider);
    }
    return void 0;
  }
  function queryProviderOrPreferredProvider(provider) {
    const state = states.get(provider);
    if (state) {
      return state;
    }
    const circle = findPreferredProviderCircle(provider, []);
    if (circle) {
      onUnexpectedExternalError(new Error(`Inline completions: cyclic yield-to dependency detected. Path: ${circle.map((s) => s.toString ? s.toString() : "" + s).join(" -> ")}`));
    }
    const deferredPromise = new DeferredPromise();
    states.set(provider, deferredPromise.p);
    (async () => {
      if (!circle) {
        const preferred = getPreferredProviders(provider);
        for (const p of preferred) {
          const result2 = await queryProviderOrPreferredProvider(p);
          if (result2 && result2.inlineCompletions.items.length > 0) {
            return void 0;
          }
        }
      }
      return query(provider);
    })().then((c) => deferredPromise.complete(c), (e) => deferredPromise.error(e));
    return deferredPromise.p;
  }
  async function query(provider) {
    let result2;
    try {
      if (positionOrRange instanceof Position) {
        result2 = await provider.provideInlineCompletions(model, positionOrRange, contextWithUuid, token);
      } else {
        result2 = await provider.provideInlineEditsForRange?.(model, positionOrRange, contextWithUuid, token);
      }
    } catch (e) {
      onUnexpectedExternalError(e);
      return void 0;
    }
    if (!result2) {
      return void 0;
    }
    const list = new InlineCompletionList(result2, provider);
    runWhenCancelled(token, () => list.removeRef());
    return list;
  }
  const inlineCompletionLists = AsyncIterableObject.fromPromisesResolveOrder(providers.map(queryProviderOrPreferredProvider));
  if (token.isCancellationRequested) {
    tokenSource.dispose(true);
    return new InlineCompletionProviderResult([], /* @__PURE__ */ new Set(), []);
  }
  const result = await addRefAndCreateResult(contextWithUuid, inlineCompletionLists, defaultReplaceRange, model, languageConfigurationService);
  tokenSource.dispose(true);
  return result;
}
function runWhenCancelled(token, callback) {
  if (token.isCancellationRequested) {
    callback();
    return Disposable.None;
  } else {
    const listener = token.onCancellationRequested(() => {
      listener.dispose();
      callback();
    });
    return { dispose: () => listener.dispose() };
  }
}
async function addRefAndCreateResult(context, inlineCompletionLists, defaultReplaceRange, model, languageConfigurationService) {
  const itemsByHash = /* @__PURE__ */ new Map();
  let shouldStop = false;
  const lists = [];
  for await (const completions of inlineCompletionLists) {
    if (!completions) {
      continue;
    }
    completions.addRef();
    lists.push(completions);
    for (const item of completions.inlineCompletions.items) {
      if (!context.includeInlineEdits && (item.isInlineEdit || item.showInlineEditMenu)) {
        continue;
      }
      if (!context.includeInlineCompletions && !(item.isInlineEdit || item.showInlineEditMenu)) {
        continue;
      }
      const inlineCompletionItem = InlineCompletionItem.from(
        item,
        completions,
        defaultReplaceRange,
        model,
        languageConfigurationService
      );
      itemsByHash.set(inlineCompletionItem.hash(), inlineCompletionItem);
      if (!(item.isInlineEdit || item.showInlineEditMenu) && context.triggerKind === InlineCompletionTriggerKind.Automatic) {
        const minifiedEdit = inlineCompletionItem.toSingleTextEdit().removeCommonPrefix(new TextModelText(model));
        if (!minifiedEdit.isEmpty) {
          shouldStop = true;
        }
      }
    }
    if (shouldStop) {
      break;
    }
  }
  return new InlineCompletionProviderResult(Array.from(itemsByHash.values()), new Set(itemsByHash.keys()), lists);
}
class InlineCompletionProviderResult {
  constructor(completions, hashs, providerResults) {
    this.completions = completions;
    this.hashs = hashs;
    this.providerResults = providerResults;
  }
  has(item) {
    return this.hashs.has(item.hash());
  }
  // TODO: This is not complete as it does not take the textmodel into account
  isEmpty() {
    return this.completions.length === 0 || this.completions.every((c) => c.range.isEmpty() && c.insertText.length === 0);
  }
  dispose() {
    for (const result of this.providerResults) {
      result.removeRef();
    }
  }
}
class InlineCompletionList {
  constructor(inlineCompletions, provider) {
    this.inlineCompletions = inlineCompletions;
    this.provider = provider;
    this.refCount = 1;
  }
  addRef() {
    this.refCount++;
  }
  removeRef() {
    this.refCount--;
    if (this.refCount === 0) {
      this.provider.freeInlineCompletions(this.inlineCompletions);
    }
  }
}
const _InlineCompletionItem = class _InlineCompletionItem {
  constructor(filterText, command, shownCommand, action, range, insertText, snippetInfo, cursorShowRange, additionalTextEdits, sourceInlineCompletion, source, id = `InlineCompletion:${_InlineCompletionItem.ID++}`) {
    this.filterText = filterText;
    this.command = command;
    this.shownCommand = shownCommand;
    this.action = action;
    this.range = range;
    this.insertText = insertText;
    this.snippetInfo = snippetInfo;
    this.cursorShowRange = cursorShowRange;
    this.additionalTextEdits = additionalTextEdits;
    this.sourceInlineCompletion = sourceInlineCompletion;
    this.source = source;
    this.id = id;
    this._didCallShow = false;
  }
  static from(inlineCompletion, source, defaultReplaceRange, textModel, languageConfigurationService) {
    let insertText;
    let snippetInfo;
    let range = inlineCompletion.range ? Range.lift(inlineCompletion.range) : defaultReplaceRange;
    if (typeof inlineCompletion.insertText === "string") {
      insertText = inlineCompletion.insertText;
      if (languageConfigurationService && inlineCompletion.completeBracketPairs) {
        insertText = closeBrackets(
          insertText,
          range.getStartPosition(),
          textModel,
          languageConfigurationService
        );
        const diff = insertText.length - inlineCompletion.insertText.length;
        if (diff !== 0) {
          range = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn + diff);
        }
      }
      snippetInfo = void 0;
    } else if ("snippet" in inlineCompletion.insertText) {
      const preBracketCompletionLength = inlineCompletion.insertText.snippet.length;
      if (languageConfigurationService && inlineCompletion.completeBracketPairs) {
        inlineCompletion.insertText.snippet = closeBrackets(
          inlineCompletion.insertText.snippet,
          range.getStartPosition(),
          textModel,
          languageConfigurationService
        );
        const diff = inlineCompletion.insertText.snippet.length - preBracketCompletionLength;
        if (diff !== 0) {
          range = new Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn + diff);
        }
      }
      const snippet = new SnippetParser().parse(inlineCompletion.insertText.snippet);
      if (snippet.children.length === 1 && snippet.children[0] instanceof Text) {
        insertText = snippet.children[0].value;
        snippetInfo = void 0;
      } else {
        insertText = snippet.toString();
        snippetInfo = {
          snippet: inlineCompletion.insertText.snippet,
          range
        };
      }
    } else {
      assertNever(inlineCompletion.insertText);
    }
    return new _InlineCompletionItem(
      insertText,
      inlineCompletion.command,
      inlineCompletion.shownCommand,
      inlineCompletion.action,
      range,
      insertText,
      snippetInfo,
      Range.lift(inlineCompletion.showRange) ?? void 0,
      inlineCompletion.additionalTextEdits || getReadonlyEmptyArray(),
      inlineCompletion,
      source
    );
  }
  get isInlineEdit() {
    return this.sourceInlineCompletion.isInlineEdit;
  }
  get didShow() {
    return this._didCallShow;
  }
  markAsShown() {
    this._didCallShow = true;
  }
  withRangeInsertTextAndFilterText(updatedRange, updatedInsertText, updatedFilterText) {
    return new _InlineCompletionItem(
      updatedFilterText,
      this.command,
      this.shownCommand,
      this.action,
      updatedRange,
      updatedInsertText,
      this.snippetInfo,
      this.cursorShowRange,
      this.additionalTextEdits,
      this.sourceInlineCompletion,
      this.source,
      this.id
    );
  }
  hash() {
    return JSON.stringify({ insertText: this.insertText, range: this.range.toString() });
  }
  toSingleTextEdit() {
    return new SingleTextEdit(this.range, this.insertText);
  }
};
_InlineCompletionItem.ID = 1;
let InlineCompletionItem = _InlineCompletionItem;
function getDefaultRange(position, model) {
  const word = model.getWordAtPosition(position);
  const maxColumn = model.getLineMaxColumn(position.lineNumber);
  return word ? new Range(position.lineNumber, word.startColumn, position.lineNumber, maxColumn) : Range.fromPositions(position, position.with(void 0, maxColumn));
}
function closeBrackets(text, position, model, languageConfigurationService) {
  const currentLine = model.getLineContent(position.lineNumber);
  const edit = SingleOffsetEdit.replace(new OffsetRange(position.column - 1, currentLine.length), text);
  const proposedLineTokens = model.tokenization.tokenizeLinesAt(position.lineNumber, [edit.apply(currentLine)]);
  const textTokens = proposedLineTokens?.[0].sliceZeroCopy(edit.getRangeAfterApply());
  if (!textTokens) {
    return text;
  }
  const fixedText = fixBracketsInLine(textTokens, languageConfigurationService);
  return fixedText;
}
export {
  InlineCompletionItem,
  InlineCompletionList,
  InlineCompletionProviderResult,
  provideInlineCompletions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL21vZGVsL3Byb3ZpZGVJbmxpbmVDb21wbGV0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGFzc2VydE5ldmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IEFzeW5jSXRlcmFibGVPYmplY3QsIERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFeHRlcm5hbEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNldE1hcCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBTaW5nbGVPZmZzZXRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvb2Zmc2V0RWRpdC5qcyc7XG5pbXBvcnQgeyBPZmZzZXRSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL29mZnNldFJhbmdlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTaW5nbGVUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3RleHRFZGl0LmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbW1hbmQsIElubGluZUNvbXBsZXRpb24sIElubGluZUNvbXBsZXRpb25Db250ZXh0LCBJbmxpbmVDb21wbGV0aW9uUHJvdmlkZXJHcm91cElkLCBJbmxpbmVDb21wbGV0aW9ucywgSW5saW5lQ29tcGxldGlvbnNQcm92aWRlciwgSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBmaXhCcmFja2V0c0luTGluZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC9icmFja2V0UGFpcnNUZXh0TW9kZWxQYXJ0L2ZpeEJyYWNrZXRzLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsVGV4dC5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0UGFyc2VyLCBUZXh0IH0gZnJvbSAnLi4vLi4vLi4vc25pcHBldC9icm93c2VyL3NuaXBwZXRQYXJzZXIuanMnO1xuaW1wb3J0IHsgZ2V0UmVhZG9ubHlFbXB0eUFycmF5IH0gZnJvbSAnLi4vdXRpbHMuanMnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJvdmlkZUlubGluZUNvbXBsZXRpb25zKFxuXHRyZWdpc3RyeTogTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnk8SW5saW5lQ29tcGxldGlvbnNQcm92aWRlcj4sXG5cdHBvc2l0aW9uT3JSYW5nZTogUG9zaXRpb24gfCBSYW5nZSxcblx0bW9kZWw6IElUZXh0TW9kZWwsXG5cdGNvbnRleHQ6IElubGluZUNvbXBsZXRpb25Db250ZXh0LFxuXHRiYXNlVG9rZW46IENhbmNlbGxhdGlvblRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSxcblx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZT86IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuKTogUHJvbWlzZTxJbmxpbmVDb21wbGV0aW9uUHJvdmlkZXJSZXN1bHQ+IHtcblx0Y29uc3QgcmVxdWVzdFV1aWQgPSBnZW5lcmF0ZVV1aWQoKTtcblx0Y29uc3QgdG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoYmFzZVRva2VuKTtcblx0Y29uc3QgdG9rZW4gPSB0b2tlblNvdXJjZS50b2tlbjtcblx0Y29uc3QgY29udGV4dFdpdGhVdWlkID0geyAuLi5jb250ZXh0LCByZXF1ZXN0VXVpZDogcmVxdWVzdFV1aWQgfTtcblxuXHRjb25zdCBkZWZhdWx0UmVwbGFjZVJhbmdlID0gcG9zaXRpb25PclJhbmdlIGluc3RhbmNlb2YgUG9zaXRpb24gPyBnZXREZWZhdWx0UmFuZ2UocG9zaXRpb25PclJhbmdlLCBtb2RlbCkgOiBwb3NpdGlvbk9yUmFuZ2U7XG5cdGNvbnN0IHByb3ZpZGVycyA9IHJlZ2lzdHJ5LmFsbChtb2RlbCk7XG5cblx0Y29uc3QgbXVsdGlNYXAgPSBuZXcgU2V0TWFwPElubGluZUNvbXBsZXRpb25Qcm92aWRlckdyb3VwSWQsIElubGluZUNvbXBsZXRpb25zUHJvdmlkZXI8YW55Pj4oKTtcblx0Zm9yIChjb25zdCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcblx0XHRpZiAocHJvdmlkZXIuZ3JvdXBJZCkge1xuXHRcdFx0bXVsdGlNYXAuYWRkKHByb3ZpZGVyLmdyb3VwSWQsIHByb3ZpZGVyKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRQcmVmZXJyZWRQcm92aWRlcnMocHJvdmlkZXI6IElubGluZUNvbXBsZXRpb25zUHJvdmlkZXI8YW55Pik6IElubGluZUNvbXBsZXRpb25zUHJvdmlkZXI8YW55PltdIHtcblx0XHRpZiAoIXByb3ZpZGVyLnlpZWxkc1RvR3JvdXBJZHMpIHsgcmV0dXJuIFtdOyB9XG5cdFx0Y29uc3QgcmVzdWx0OiBJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyPGFueT5bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZ3JvdXBJZCBvZiBwcm92aWRlci55aWVsZHNUb0dyb3VwSWRzIHx8IFtdKSB7XG5cdFx0XHRjb25zdCBwcm92aWRlcnMgPSBtdWx0aU1hcC5nZXQoZ3JvdXBJZCk7XG5cdFx0XHRmb3IgKGNvbnN0IHAgb2YgcHJvdmlkZXJzKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0dHlwZSBSZXN1bHQgPSBQcm9taXNlPElubGluZUNvbXBsZXRpb25MaXN0IHwgdW5kZWZpbmVkPjtcblx0Y29uc3Qgc3RhdGVzID0gbmV3IE1hcDxJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyLCBSZXN1bHQ+KCk7XG5cblx0Y29uc3Qgc2VlbiA9IG5ldyBTZXQ8SW5saW5lQ29tcGxldGlvbnNQcm92aWRlcj4oKTtcblx0ZnVuY3Rpb24gZmluZFByZWZlcnJlZFByb3ZpZGVyQ2lyY2xlKFxuXHRcdHByb3ZpZGVyOiBJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyPGFueT4sXG5cdFx0c3RhY2s6IElubGluZUNvbXBsZXRpb25zUHJvdmlkZXJbXVxuXHQpOiBJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyW10gfCB1bmRlZmluZWQge1xuXHRcdHN0YWNrID0gWy4uLnN0YWNrLCBwcm92aWRlcl07XG5cdFx0aWYgKHNlZW4uaGFzKHByb3ZpZGVyKSkgeyByZXR1cm4gc3RhY2s7IH1cblxuXHRcdHNlZW4uYWRkKHByb3ZpZGVyKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcHJlZmVycmVkID0gZ2V0UHJlZmVycmVkUHJvdmlkZXJzKHByb3ZpZGVyKTtcblx0XHRcdGZvciAoY29uc3QgcCBvZiBwcmVmZXJyZWQpIHtcblx0XHRcdFx0Y29uc3QgYyA9IGZpbmRQcmVmZXJyZWRQcm92aWRlckNpcmNsZShwLCBzdGFjayk7XG5cdFx0XHRcdGlmIChjKSB7IHJldHVybiBjOyB9XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHNlZW4uZGVsZXRlKHByb3ZpZGVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGZ1bmN0aW9uIHF1ZXJ5UHJvdmlkZXJPclByZWZlcnJlZFByb3ZpZGVyKHByb3ZpZGVyOiBJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyPElubGluZUNvbXBsZXRpb25zPik6IFJlc3VsdCB7XG5cdFx0Y29uc3Qgc3RhdGUgPSBzdGF0ZXMuZ2V0KHByb3ZpZGVyKTtcblx0XHRpZiAoc3RhdGUpIHsgcmV0dXJuIHN0YXRlOyB9XG5cblx0XHRjb25zdCBjaXJjbGUgPSBmaW5kUHJlZmVycmVkUHJvdmlkZXJDaXJjbGUocHJvdmlkZXIsIFtdKTtcblx0XHRpZiAoY2lyY2xlKSB7XG5cdFx0XHRvblVuZXhwZWN0ZWRFeHRlcm5hbEVycm9yKG5ldyBFcnJvcihgSW5saW5lIGNvbXBsZXRpb25zOiBjeWNsaWMgeWllbGQtdG8gZGVwZW5kZW5jeSBkZXRlY3RlZC5gXG5cdFx0XHRcdCsgYCBQYXRoOiAke2NpcmNsZS5tYXAocyA9PiBzLnRvU3RyaW5nID8gcy50b1N0cmluZygpIDogKCcnICsgcykpLmpvaW4oJyAtPiAnKX1gKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVmZXJyZWRQcm9taXNlID0gbmV3IERlZmVycmVkUHJvbWlzZTxJbmxpbmVDb21wbGV0aW9uTGlzdCB8IHVuZGVmaW5lZD4oKTtcblx0XHRzdGF0ZXMuc2V0KHByb3ZpZGVyLCBkZWZlcnJlZFByb21pc2UucCk7XG5cblx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKCFjaXJjbGUpIHtcblx0XHRcdFx0Y29uc3QgcHJlZmVycmVkID0gZ2V0UHJlZmVycmVkUHJvdmlkZXJzKHByb3ZpZGVyKTtcblx0XHRcdFx0Zm9yIChjb25zdCBwIG9mIHByZWZlcnJlZCkge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHF1ZXJ5UHJvdmlkZXJPclByZWZlcnJlZFByb3ZpZGVyKHApO1xuXHRcdFx0XHRcdGlmIChyZXN1bHQgJiYgcmVzdWx0LmlubGluZUNvbXBsZXRpb25zLml0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdC8vIFNraXAgcHJvdmlkZXJcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBxdWVyeShwcm92aWRlcik7XG5cdFx0fSkoKS50aGVuKGMgPT4gZGVmZXJyZWRQcm9taXNlLmNvbXBsZXRlKGMpLCBlID0+IGRlZmVycmVkUHJvbWlzZS5lcnJvcihlKSk7XG5cblx0XHRyZXR1cm4gZGVmZXJyZWRQcm9taXNlLnA7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBxdWVyeShwcm92aWRlcjogSW5saW5lQ29tcGxldGlvbnNQcm92aWRlcik6IFByb21pc2U8SW5saW5lQ29tcGxldGlvbkxpc3QgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgcmVzdWx0OiBJbmxpbmVDb21wbGV0aW9ucyB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdGlmIChwb3NpdGlvbk9yUmFuZ2UgaW5zdGFuY2VvZiBQb3NpdGlvbikge1xuXHRcdFx0XHRyZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlSW5saW5lQ29tcGxldGlvbnMobW9kZWwsIHBvc2l0aW9uT3JSYW5nZSwgY29udGV4dFdpdGhVdWlkLCB0b2tlbik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlSW5saW5lRWRpdHNGb3JSYW5nZT8uKG1vZGVsLCBwb3NpdGlvbk9yUmFuZ2UsIGNvbnRleHRXaXRoVXVpZCwgdG9rZW4pO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IoZSk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICghcmVzdWx0KSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRjb25zdCBsaXN0ID0gbmV3IElubGluZUNvbXBsZXRpb25MaXN0KHJlc3VsdCwgcHJvdmlkZXIpO1xuXG5cdFx0cnVuV2hlbkNhbmNlbGxlZCh0b2tlbiwgKCkgPT4gbGlzdC5yZW1vdmVSZWYoKSk7XG5cdFx0cmV0dXJuIGxpc3Q7XG5cdH1cblxuXHRjb25zdCBpbmxpbmVDb21wbGV0aW9uTGlzdHMgPSBBc3luY0l0ZXJhYmxlT2JqZWN0LmZyb21Qcm9taXNlc1Jlc29sdmVPcmRlcihwcm92aWRlcnMubWFwKHF1ZXJ5UHJvdmlkZXJPclByZWZlcnJlZFByb3ZpZGVyKSk7XG5cblx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0dG9rZW5Tb3VyY2UuZGlzcG9zZSh0cnVlKTtcblx0XHQvLyByZXN1bHQgaGFzIGJlZW4gZGlzcG9zZWQgYmVmb3JlIHdlIGNvdWxkIGNhbGwgYWRkUmVmISBTbyB3ZSBoYXZlIHRvIGRpc2NhcmQgZXZlcnl0aGluZy5cblx0XHRyZXR1cm4gbmV3IElubGluZUNvbXBsZXRpb25Qcm92aWRlclJlc3VsdChbXSwgbmV3IFNldCgpLCBbXSk7XG5cdH1cblxuXHRjb25zdCByZXN1bHQgPSBhd2FpdCBhZGRSZWZBbmRDcmVhdGVSZXN1bHQoY29udGV4dFdpdGhVdWlkLCBpbmxpbmVDb21wbGV0aW9uTGlzdHMsIGRlZmF1bHRSZXBsYWNlUmFuZ2UsIG1vZGVsLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0dG9rZW5Tb3VyY2UuZGlzcG9zZSh0cnVlKTsgLy8gVGhpcyBkaXNwb3NlcyByZXN1bHRzIHRoYXQgYXJlIG5vdCByZWZlcmVuY2VkLlxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vKiogSWYgdGhlIHRva2VuIGRvZXMgbm90IGxlYWssIHRoaXMgd2lsbCBub3QgbGVhayBlaXRoZXIuICovXG5mdW5jdGlvbiBydW5XaGVuQ2FuY2VsbGVkKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgY2FsbGJhY2s6ICgpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB7XG5cdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdGNhbGxiYWNrKCk7XG5cdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0fSBlbHNlIHtcblx0XHRjb25zdCBsaXN0ZW5lciA9IHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHsgZGlzcG9zZTogKCkgPT4gbGlzdGVuZXIuZGlzcG9zZSgpIH07XG5cdH1cbn1cblxuLy8gVE9ETzogY2hlY2sgY2FuY2VsbGF0aW9uIHRva2VuIVxuYXN5bmMgZnVuY3Rpb24gYWRkUmVmQW5kQ3JlYXRlUmVzdWx0KFxuXHRjb250ZXh0OiBJbmxpbmVDb21wbGV0aW9uQ29udGV4dCxcblx0aW5saW5lQ29tcGxldGlvbkxpc3RzOiBBc3luY0l0ZXJhYmxlPChJbmxpbmVDb21wbGV0aW9uTGlzdCB8IHVuZGVmaW5lZCk+LFxuXHRkZWZhdWx0UmVwbGFjZVJhbmdlOiBSYW5nZSxcblx0bW9kZWw6IElUZXh0TW9kZWwsXG5cdGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHwgdW5kZWZpbmVkXG4pOiBQcm9taXNlPElubGluZUNvbXBsZXRpb25Qcm92aWRlclJlc3VsdD4ge1xuXHQvLyBmb3IgZGVkdXBsaWNhdGlvblxuXHRjb25zdCBpdGVtc0J5SGFzaCA9IG5ldyBNYXA8c3RyaW5nLCBJbmxpbmVDb21wbGV0aW9uSXRlbT4oKTtcblxuXHRsZXQgc2hvdWxkU3RvcCA9IGZhbHNlO1xuXHRjb25zdCBsaXN0czogSW5saW5lQ29tcGxldGlvbkxpc3RbXSA9IFtdO1xuXHRmb3IgYXdhaXQgKGNvbnN0IGNvbXBsZXRpb25zIG9mIGlubGluZUNvbXBsZXRpb25MaXN0cykge1xuXHRcdGlmICghY29tcGxldGlvbnMpIHsgY29udGludWU7IH1cblx0XHRjb21wbGV0aW9ucy5hZGRSZWYoKTtcblx0XHRsaXN0cy5wdXNoKGNvbXBsZXRpb25zKTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgY29tcGxldGlvbnMuaW5saW5lQ29tcGxldGlvbnMuaXRlbXMpIHtcblx0XHRcdGlmICghY29udGV4dC5pbmNsdWRlSW5saW5lRWRpdHMgJiYgKGl0ZW0uaXNJbmxpbmVFZGl0IHx8IGl0ZW0uc2hvd0lubGluZUVkaXRNZW51KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmICghY29udGV4dC5pbmNsdWRlSW5saW5lQ29tcGxldGlvbnMgJiYgIShpdGVtLmlzSW5saW5lRWRpdCB8fCBpdGVtLnNob3dJbmxpbmVFZGl0TWVudSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbmxpbmVDb21wbGV0aW9uSXRlbSA9IElubGluZUNvbXBsZXRpb25JdGVtLmZyb20oXG5cdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdGNvbXBsZXRpb25zLFxuXHRcdFx0XHRkZWZhdWx0UmVwbGFjZVJhbmdlLFxuXHRcdFx0XHRtb2RlbCxcblx0XHRcdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZVxuXHRcdFx0KTtcblxuXHRcdFx0aXRlbXNCeUhhc2guc2V0KGlubGluZUNvbXBsZXRpb25JdGVtLmhhc2goKSwgaW5saW5lQ29tcGxldGlvbkl0ZW0pO1xuXG5cdFx0XHQvLyBTdG9wIGFmdGVyIGZpcnN0IHZpc2libGUgaW5saW5lIGNvbXBsZXRpb25cblx0XHRcdGlmICghKGl0ZW0uaXNJbmxpbmVFZGl0IHx8IGl0ZW0uc2hvd0lubGluZUVkaXRNZW51KSAmJiBjb250ZXh0LnRyaWdnZXJLaW5kID09PSBJbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQuQXV0b21hdGljKSB7XG5cdFx0XHRcdGNvbnN0IG1pbmlmaWVkRWRpdCA9IGlubGluZUNvbXBsZXRpb25JdGVtLnRvU2luZ2xlVGV4dEVkaXQoKS5yZW1vdmVDb21tb25QcmVmaXgobmV3IFRleHRNb2RlbFRleHQobW9kZWwpKTtcblx0XHRcdFx0aWYgKCFtaW5pZmllZEVkaXQuaXNFbXB0eSkge1xuXHRcdFx0XHRcdHNob3VsZFN0b3AgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHNob3VsZFN0b3ApIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBuZXcgSW5saW5lQ29tcGxldGlvblByb3ZpZGVyUmVzdWx0KEFycmF5LmZyb20oaXRlbXNCeUhhc2gudmFsdWVzKCkpLCBuZXcgU2V0KGl0ZW1zQnlIYXNoLmtleXMoKSksIGxpc3RzKTtcbn1cblxuZXhwb3J0IGNsYXNzIElubGluZUNvbXBsZXRpb25Qcm92aWRlclJlc3VsdCBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHQvKipcblx0XHQgKiBGcmVlIG9mIGR1cGxpY2F0ZXMuXG5cdFx0ICovXG5cdFx0cHVibGljIHJlYWRvbmx5IGNvbXBsZXRpb25zOiByZWFkb25seSBJbmxpbmVDb21wbGV0aW9uSXRlbVtdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaGFzaHM6IFNldDxzdHJpbmc+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcHJvdmlkZXJSZXN1bHRzOiByZWFkb25seSBJbmxpbmVDb21wbGV0aW9uTGlzdFtdLFxuXHQpIHsgfVxuXG5cdHB1YmxpYyBoYXMoaXRlbTogSW5saW5lQ29tcGxldGlvbkl0ZW0pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5oYXNocy5oYXMoaXRlbS5oYXNoKCkpO1xuXHR9XG5cblx0Ly8gVE9ETzogVGhpcyBpcyBub3QgY29tcGxldGUgYXMgaXQgZG9lcyBub3QgdGFrZSB0aGUgdGV4dG1vZGVsIGludG8gYWNjb3VudFxuXHRpc0VtcHR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNvbXBsZXRpb25zLmxlbmd0aCA9PT0gMFxuXHRcdFx0fHwgdGhpcy5jb21wbGV0aW9ucy5ldmVyeShjID0+IGMucmFuZ2UuaXNFbXB0eSgpICYmIGMuaW5zZXJ0VGV4dC5sZW5ndGggPT09IDApO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnByb3ZpZGVyUmVzdWx0cykge1xuXHRcdFx0cmVzdWx0LnJlbW92ZVJlZigpO1xuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIEEgcmVmIGNvdW50ZWQgcG9pbnRlciB0byB0aGUgY29tcHV0ZWQgYElubGluZUNvbXBsZXRpb25zYCBhbmQgdGhlIGBJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyYCB0aGF0XG4gKiBjb21wdXRlZCB0aGVtLlxuICovXG5leHBvcnQgY2xhc3MgSW5saW5lQ29tcGxldGlvbkxpc3Qge1xuXHRwcml2YXRlIHJlZkNvdW50ID0gMTtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGlubGluZUNvbXBsZXRpb25zOiBJbmxpbmVDb21wbGV0aW9ucyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcHJvdmlkZXI6IElubGluZUNvbXBsZXRpb25zUHJvdmlkZXIsXG5cdCkgeyB9XG5cblx0YWRkUmVmKCk6IHZvaWQge1xuXHRcdHRoaXMucmVmQ291bnQrKztcblx0fVxuXG5cdHJlbW92ZVJlZigpOiB2b2lkIHtcblx0XHR0aGlzLnJlZkNvdW50LS07XG5cdFx0aWYgKHRoaXMucmVmQ291bnQgPT09IDApIHtcblx0XHRcdHRoaXMucHJvdmlkZXIuZnJlZUlubGluZUNvbXBsZXRpb25zKHRoaXMuaW5saW5lQ29tcGxldGlvbnMpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5saW5lQ29tcGxldGlvbkl0ZW0ge1xuXHRwdWJsaWMgc3RhdGljIGZyb20oXG5cdFx0aW5saW5lQ29tcGxldGlvbjogSW5saW5lQ29tcGxldGlvbixcblx0XHRzb3VyY2U6IElubGluZUNvbXBsZXRpb25MaXN0LFxuXHRcdGRlZmF1bHRSZXBsYWNlUmFuZ2U6IFJhbmdlLFxuXHRcdHRleHRNb2RlbDogSVRleHRNb2RlbCxcblx0XHRsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB8IHVuZGVmaW5lZCxcblx0KSB7XG5cdFx0bGV0IGluc2VydFRleHQ6IHN0cmluZztcblx0XHRsZXQgc25pcHBldEluZm86IFNuaXBwZXRJbmZvIHwgdW5kZWZpbmVkO1xuXHRcdGxldCByYW5nZSA9IGlubGluZUNvbXBsZXRpb24ucmFuZ2UgPyBSYW5nZS5saWZ0KGlubGluZUNvbXBsZXRpb24ucmFuZ2UpIDogZGVmYXVsdFJlcGxhY2VSYW5nZTtcblxuXHRcdGlmICh0eXBlb2YgaW5saW5lQ29tcGxldGlvbi5pbnNlcnRUZXh0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0aW5zZXJ0VGV4dCA9IGlubGluZUNvbXBsZXRpb24uaW5zZXJ0VGV4dDtcblxuXHRcdFx0aWYgKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgJiYgaW5saW5lQ29tcGxldGlvbi5jb21wbGV0ZUJyYWNrZXRQYWlycykge1xuXHRcdFx0XHRpbnNlcnRUZXh0ID0gY2xvc2VCcmFja2V0cyhcblx0XHRcdFx0XHRpbnNlcnRUZXh0LFxuXHRcdFx0XHRcdHJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSxcblx0XHRcdFx0XHR0ZXh0TW9kZWwsXG5cdFx0XHRcdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdC8vIE1vZGlmeSByYW5nZSBkZXBlbmRpbmcgb24gaWYgYnJhY2tldHMgYXJlIGFkZGVkIG9yIHJlbW92ZWRcblx0XHRcdFx0Y29uc3QgZGlmZiA9IGluc2VydFRleHQubGVuZ3RoIC0gaW5saW5lQ29tcGxldGlvbi5pbnNlcnRUZXh0Lmxlbmd0aDtcblx0XHRcdFx0aWYgKGRpZmYgIT09IDApIHtcblx0XHRcdFx0XHRyYW5nZSA9IG5ldyBSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uLCByYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4gKyBkaWZmKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRzbmlwcGV0SW5mbyA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKCdzbmlwcGV0JyBpbiBpbmxpbmVDb21wbGV0aW9uLmluc2VydFRleHQpIHtcblx0XHRcdGNvbnN0IHByZUJyYWNrZXRDb21wbGV0aW9uTGVuZ3RoID0gaW5saW5lQ29tcGxldGlvbi5pbnNlcnRUZXh0LnNuaXBwZXQubGVuZ3RoO1xuXG5cdFx0XHRpZiAobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSAmJiBpbmxpbmVDb21wbGV0aW9uLmNvbXBsZXRlQnJhY2tldFBhaXJzKSB7XG5cdFx0XHRcdGlubGluZUNvbXBsZXRpb24uaW5zZXJ0VGV4dC5zbmlwcGV0ID0gY2xvc2VCcmFja2V0cyhcblx0XHRcdFx0XHRpbmxpbmVDb21wbGV0aW9uLmluc2VydFRleHQuc25pcHBldCxcblx0XHRcdFx0XHRyYW5nZS5nZXRTdGFydFBvc2l0aW9uKCksXG5cdFx0XHRcdFx0dGV4dE1vZGVsLFxuXHRcdFx0XHRcdGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0XHRcdFx0KTtcblxuXHRcdFx0XHQvLyBNb2RpZnkgcmFuZ2UgZGVwZW5kaW5nIG9uIGlmIGJyYWNrZXRzIGFyZSBhZGRlZCBvciByZW1vdmVkXG5cdFx0XHRcdGNvbnN0IGRpZmYgPSBpbmxpbmVDb21wbGV0aW9uLmluc2VydFRleHQuc25pcHBldC5sZW5ndGggLSBwcmVCcmFja2V0Q29tcGxldGlvbkxlbmd0aDtcblx0XHRcdFx0aWYgKGRpZmYgIT09IDApIHtcblx0XHRcdFx0XHRyYW5nZSA9IG5ldyBSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uLCByYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4gKyBkaWZmKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzbmlwcGV0ID0gbmV3IFNuaXBwZXRQYXJzZXIoKS5wYXJzZShpbmxpbmVDb21wbGV0aW9uLmluc2VydFRleHQuc25pcHBldCk7XG5cblx0XHRcdGlmIChzbmlwcGV0LmNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiBzbmlwcGV0LmNoaWxkcmVuWzBdIGluc3RhbmNlb2YgVGV4dCkge1xuXHRcdFx0XHRpbnNlcnRUZXh0ID0gc25pcHBldC5jaGlsZHJlblswXS52YWx1ZTtcblx0XHRcdFx0c25pcHBldEluZm8gPSB1bmRlZmluZWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbnNlcnRUZXh0ID0gc25pcHBldC50b1N0cmluZygpO1xuXHRcdFx0XHRzbmlwcGV0SW5mbyA9IHtcblx0XHRcdFx0XHRzbmlwcGV0OiBpbmxpbmVDb21wbGV0aW9uLmluc2VydFRleHQuc25pcHBldCxcblx0XHRcdFx0XHRyYW5nZTogcmFuZ2Vcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0TmV2ZXIoaW5saW5lQ29tcGxldGlvbi5pbnNlcnRUZXh0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IElubGluZUNvbXBsZXRpb25JdGVtKFxuXHRcdFx0aW5zZXJ0VGV4dCxcblx0XHRcdGlubGluZUNvbXBsZXRpb24uY29tbWFuZCxcblx0XHRcdGlubGluZUNvbXBsZXRpb24uc2hvd25Db21tYW5kLFxuXHRcdFx0aW5saW5lQ29tcGxldGlvbi5hY3Rpb24sXG5cdFx0XHRyYW5nZSxcblx0XHRcdGluc2VydFRleHQsXG5cdFx0XHRzbmlwcGV0SW5mbyxcblx0XHRcdFJhbmdlLmxpZnQoaW5saW5lQ29tcGxldGlvbi5zaG93UmFuZ2UpID8/IHVuZGVmaW5lZCxcblx0XHRcdGlubGluZUNvbXBsZXRpb24uYWRkaXRpb25hbFRleHRFZGl0cyB8fCBnZXRSZWFkb25seUVtcHR5QXJyYXkoKSxcblx0XHRcdGlubGluZUNvbXBsZXRpb24sXG5cdFx0XHRzb3VyY2UsXG5cdFx0KTtcblx0fVxuXG5cdHN0YXRpYyBJRCA9IDE7XG5cblx0cHJpdmF0ZSBfZGlkQ2FsbFNob3cgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBmaWx0ZXJUZXh0OiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgY29tbWFuZDogQ29tbWFuZCB8IHVuZGVmaW5lZCxcblx0XHQvKiogQGRlcHJlY2F0ZWQuIFVzZSBoYW5kbGVJdGVtRGlkU2hvdyAqL1xuXHRcdHJlYWRvbmx5IHNob3duQ29tbWFuZDogQ29tbWFuZCB8IHVuZGVmaW5lZCxcblx0XHRyZWFkb25seSBhY3Rpb246IENvbW1hbmQgfCB1bmRlZmluZWQsXG5cdFx0cmVhZG9ubHkgcmFuZ2U6IFJhbmdlLFxuXHRcdHJlYWRvbmx5IGluc2VydFRleHQ6IHN0cmluZyxcblx0XHRyZWFkb25seSBzbmlwcGV0SW5mbzogU25pcHBldEluZm8gfCB1bmRlZmluZWQsXG5cdFx0cmVhZG9ubHkgY3Vyc29yU2hvd1JhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZCxcblxuXHRcdHJlYWRvbmx5IGFkZGl0aW9uYWxUZXh0RWRpdHM6IHJlYWRvbmx5IElTaW5nbGVFZGl0T3BlcmF0aW9uW10sXG5cblxuXHRcdC8qKlxuXHRcdCAqIEEgcmVmZXJlbmNlIHRvIHRoZSBvcmlnaW5hbCBpbmxpbmUgY29tcGxldGlvbiB0aGlzIGlubGluZSBjb21wbGV0aW9uIGhhcyBiZWVuIGNvbnN0cnVjdGVkIGZyb20uXG5cdFx0ICogVXNlZCBmb3IgZXZlbnQgZGF0YSB0byBlbnN1cmUgcmVmZXJlbnRpYWwgZXF1YWxpdHkuXG5cdFx0Ki9cblx0XHRyZWFkb25seSBzb3VyY2VJbmxpbmVDb21wbGV0aW9uOiBJbmxpbmVDb21wbGV0aW9uLFxuXG5cdFx0LyoqXG5cdFx0ICogQSByZWZlcmVuY2UgdG8gdGhlIG9yaWdpbmFsIGlubGluZSBjb21wbGV0aW9uIGxpc3QgdGhpcyBpbmxpbmUgY29tcGxldGlvbiBoYXMgYmVlbiBjb25zdHJ1Y3RlZCBmcm9tLlxuXHRcdCAqIFVzZWQgZm9yIGV2ZW50IGRhdGEgdG8gZW5zdXJlIHJlZmVyZW50aWFsIGVxdWFsaXR5LlxuXHRcdCovXG5cdFx0cmVhZG9ubHkgc291cmNlOiBJbmxpbmVDb21wbGV0aW9uTGlzdCxcblxuXHRcdHJlYWRvbmx5IGlkID0gYElubGluZUNvbXBsZXRpb246JHtJbmxpbmVDb21wbGV0aW9uSXRlbS5JRCsrfWAsXG5cdCkge1xuXHR9XG5cblx0Z2V0IGlzSW5saW5lRWRpdCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5zb3VyY2VJbmxpbmVDb21wbGV0aW9uLmlzSW5saW5lRWRpdCEhO1xuXHR9XG5cblx0cHVibGljIGdldCBkaWRTaG93KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9kaWRDYWxsU2hvdztcblx0fVxuXHRwdWJsaWMgbWFya0FzU2hvd24oKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlkQ2FsbFNob3cgPSB0cnVlO1xuXHR9XG5cblx0cHVibGljIHdpdGhSYW5nZUluc2VydFRleHRBbmRGaWx0ZXJUZXh0KHVwZGF0ZWRSYW5nZTogUmFuZ2UsIHVwZGF0ZWRJbnNlcnRUZXh0OiBzdHJpbmcsIHVwZGF0ZWRGaWx0ZXJUZXh0OiBzdHJpbmcpOiBJbmxpbmVDb21wbGV0aW9uSXRlbSB7XG5cdFx0cmV0dXJuIG5ldyBJbmxpbmVDb21wbGV0aW9uSXRlbShcblx0XHRcdHVwZGF0ZWRGaWx0ZXJUZXh0LFxuXHRcdFx0dGhpcy5jb21tYW5kLFxuXHRcdFx0dGhpcy5zaG93bkNvbW1hbmQsXG5cdFx0XHR0aGlzLmFjdGlvbixcblx0XHRcdHVwZGF0ZWRSYW5nZSxcblx0XHRcdHVwZGF0ZWRJbnNlcnRUZXh0LFxuXHRcdFx0dGhpcy5zbmlwcGV0SW5mbyxcblx0XHRcdHRoaXMuY3Vyc29yU2hvd1JhbmdlLFxuXHRcdFx0dGhpcy5hZGRpdGlvbmFsVGV4dEVkaXRzLFxuXHRcdFx0dGhpcy5zb3VyY2VJbmxpbmVDb21wbGV0aW9uLFxuXHRcdFx0dGhpcy5zb3VyY2UsXG5cdFx0XHR0aGlzLmlkLFxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgaGFzaCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSh7IGluc2VydFRleHQ6IHRoaXMuaW5zZXJ0VGV4dCwgcmFuZ2U6IHRoaXMucmFuZ2UudG9TdHJpbmcoKSB9KTtcblx0fVxuXG5cdHB1YmxpYyB0b1NpbmdsZVRleHRFZGl0KCk6IFNpbmdsZVRleHRFZGl0IHtcblx0XHRyZXR1cm4gbmV3IFNpbmdsZVRleHRFZGl0KHRoaXMucmFuZ2UsIHRoaXMuaW5zZXJ0VGV4dCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBTbmlwcGV0SW5mbyB7XG5cdHNuaXBwZXQ6IHN0cmluZztcblx0LyogQ291bGQgYmUgZGlmZmVyZW50IHRoYW4gdGhlIG1haW4gcmFuZ2UgKi9cblx0cmFuZ2U6IFJhbmdlO1xufVxuXG5mdW5jdGlvbiBnZXREZWZhdWx0UmFuZ2UocG9zaXRpb246IFBvc2l0aW9uLCBtb2RlbDogSVRleHRNb2RlbCk6IFJhbmdlIHtcblx0Y29uc3Qgd29yZCA9IG1vZGVsLmdldFdvcmRBdFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0Y29uc3QgbWF4Q29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihwb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0Ly8gQnkgZGVmYXVsdCwgYWx3YXlzIHJlcGxhY2UgdXAgdW50aWwgdGhlIGVuZCBvZiB0aGUgY3VycmVudCBsaW5lLlxuXHQvLyBUaGlzIGRlZmF1bHQgbWlnaHQgYmUgc3ViamVjdCB0byBjaGFuZ2UhXG5cdHJldHVybiB3b3JkXG5cdFx0PyBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgd29yZC5zdGFydENvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgbWF4Q29sdW1uKVxuXHRcdDogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3NpdGlvbiwgcG9zaXRpb24ud2l0aCh1bmRlZmluZWQsIG1heENvbHVtbikpO1xufVxuXG5mdW5jdGlvbiBjbG9zZUJyYWNrZXRzKHRleHQ6IHN0cmluZywgcG9zaXRpb246IFBvc2l0aW9uLCBtb2RlbDogSVRleHRNb2RlbCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpOiBzdHJpbmcge1xuXHRjb25zdCBjdXJyZW50TGluZSA9IG1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpO1xuXHRjb25zdCBlZGl0ID0gU2luZ2xlT2Zmc2V0RWRpdC5yZXBsYWNlKG5ldyBPZmZzZXRSYW5nZShwb3NpdGlvbi5jb2x1bW4gLSAxLCBjdXJyZW50TGluZS5sZW5ndGgpLCB0ZXh0KTtcblxuXHRjb25zdCBwcm9wb3NlZExpbmVUb2tlbnMgPSBtb2RlbC50b2tlbml6YXRpb24udG9rZW5pemVMaW5lc0F0KHBvc2l0aW9uLmxpbmVOdW1iZXIsIFtlZGl0LmFwcGx5KGN1cnJlbnRMaW5lKV0pO1xuXHRjb25zdCB0ZXh0VG9rZW5zID0gcHJvcG9zZWRMaW5lVG9rZW5zPy5bMF0uc2xpY2VaZXJvQ29weShlZGl0LmdldFJhbmdlQWZ0ZXJBcHBseSgpKTtcblx0aWYgKCF0ZXh0VG9rZW5zKSB7XG5cdFx0cmV0dXJuIHRleHQ7XG5cdH1cblxuXHRjb25zdCBmaXhlZFRleHQgPSBmaXhCcmFja2V0c0luTGluZSh0ZXh0VG9rZW5zLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0cmV0dXJuIGZpeGVkVGV4dDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMscUJBQXFCLHVCQUF1QjtBQUNyRCxTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHNCQUFzQjtBQUUvQixTQUE0SSxtQ0FBbUM7QUFHL0ssU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxlQUFlLFlBQVk7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
