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
import { DeferredPromise } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { pieceToQuery, prepareQuery, scoreFuzzy2 } from "../../../../base/common/fuzzyScorer.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { format, trim } from "../../../../base/common/strings.js";
import { Range } from "../../../common/core/range.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { SymbolKind, SymbolKinds, SymbolTag, getAriaLabelForSymbol } from "../../../common/languages.js";
import { IOutlineModelService } from "../../documentSymbols/browser/outlineModel.js";
import { AbstractEditorNavigationQuickAccessProvider } from "./editorNavigationQuickAccess.js";
import { localize } from "../../../../nls.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { findLast } from "../../../../base/common/arraysFind.js";
let AbstractGotoSymbolQuickAccessProvider = class extends AbstractEditorNavigationQuickAccessProvider {
  constructor(_languageFeaturesService, _outlineModelService, options = /* @__PURE__ */ Object.create(null)) {
    super(options);
    this._languageFeaturesService = _languageFeaturesService;
    this._outlineModelService = _outlineModelService;
    this.options = options;
    this.options.canAcceptInBackground = true;
  }
  provideWithoutTextEditor(picker) {
    this.provideLabelPick(picker, localize("cannotRunGotoSymbolWithoutEditor", "To go to a symbol, first open a text editor with symbol information."));
    return Disposable.None;
  }
  provideWithTextEditor(context, picker, token, runOptions) {
    const editor = context.editor;
    const model = this.getModel(editor);
    if (!model) {
      return Disposable.None;
    }
    if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
      return this.doProvideWithEditorSymbols(context, model, picker, token, runOptions);
    }
    return this.doProvideWithoutEditorSymbols(context, model, picker, token);
  }
  doProvideWithoutEditorSymbols(context, model, picker, token) {
    const disposables = new DisposableStore();
    this.provideLabelPick(picker, localize("cannotRunGotoSymbolWithoutSymbolProvider", "The active text editor does not provide symbol information."));
    (async () => {
      const result = await this.waitForLanguageSymbolRegistry(model, disposables);
      if (!result || token.isCancellationRequested) {
        return;
      }
      disposables.add(this.doProvideWithEditorSymbols(context, model, picker, token));
    })();
    return disposables;
  }
  provideLabelPick(picker, label) {
    picker.items = [{ label, index: 0, kind: SymbolKind.String }];
    picker.ariaLabel = label;
  }
  async waitForLanguageSymbolRegistry(model, disposables) {
    if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
      return true;
    }
    const symbolProviderRegistryPromise = new DeferredPromise();
    const symbolProviderListener = disposables.add(this._languageFeaturesService.documentSymbolProvider.onDidChange(() => {
      if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
        symbolProviderListener.dispose();
        symbolProviderRegistryPromise.complete(true);
      }
    }));
    disposables.add(toDisposable(() => symbolProviderRegistryPromise.complete(false)));
    return symbolProviderRegistryPromise.p;
  }
  doProvideWithEditorSymbols(context, model, picker, token, runOptions) {
    const editor = context.editor;
    const disposables = new DisposableStore();
    disposables.add(picker.onDidAccept((event) => {
      const [item] = picker.selectedItems;
      if (item && item.range) {
        this.gotoLocation(context, { range: item.range.selection, keyMods: picker.keyMods, preserveFocus: event.inBackground });
        runOptions?.handleAccept?.(item, event.inBackground);
        if (!event.inBackground) {
          picker.hide();
        }
      }
    }));
    disposables.add(picker.onDidTriggerItemButton(({ item }) => {
      if (item && item.range) {
        this.gotoLocation(context, { range: item.range.selection, keyMods: picker.keyMods, forceSideBySide: true });
        picker.hide();
      }
    }));
    const symbolsPromise = this.getDocumentSymbols(model, token);
    const picksCts = disposables.add(new MutableDisposable());
    const updatePickerItems = async (positionToEnclose) => {
      picksCts?.value?.cancel();
      picker.busy = false;
      picksCts.value = new CancellationTokenSource();
      picker.busy = true;
      try {
        const query = prepareQuery(picker.value.substr(AbstractGotoSymbolQuickAccessProvider.PREFIX.length).trim());
        const items = await this.doGetSymbolPicks(symbolsPromise, query, void 0, picksCts.value.token, model);
        if (token.isCancellationRequested) {
          return;
        }
        if (items.length > 0) {
          picker.items = items;
          if (positionToEnclose && query.original.length === 0) {
            const candidate = findLast(items, (item) => Boolean(item.type !== "separator" && item.range && Range.containsPosition(item.range.decoration, positionToEnclose)));
            if (candidate) {
              picker.activeItems = [candidate];
            }
          }
        } else {
          if (query.original.length > 0) {
            this.provideLabelPick(picker, localize("noMatchingSymbolResults", "No matching editor symbols"));
          } else {
            this.provideLabelPick(picker, localize("noSymbolResults", "No editor symbols"));
          }
        }
      } finally {
        if (!token.isCancellationRequested) {
          picker.busy = false;
        }
      }
    };
    disposables.add(picker.onDidChangeValue(() => updatePickerItems(void 0)));
    updatePickerItems(editor.getSelection()?.getPosition());
    disposables.add(picker.onDidChangeActive(() => {
      const [item] = picker.activeItems;
      if (item && item.range) {
        editor.revealRangeInCenter(item.range.selection, ScrollType.Smooth);
        this.addDecorations(editor, item.range.decoration);
      }
    }));
    return disposables;
  }
  async doGetSymbolPicks(symbolsPromise, query, options, token, model) {
    const symbols = await symbolsPromise;
    if (token.isCancellationRequested) {
      return [];
    }
    const filterBySymbolKind = query.original.indexOf(AbstractGotoSymbolQuickAccessProvider.SCOPE_PREFIX) === 0;
    const filterPos = filterBySymbolKind ? 1 : 0;
    let symbolQuery;
    let containerQuery;
    if (query.values && query.values.length > 1) {
      symbolQuery = pieceToQuery(query.values[0]);
      containerQuery = pieceToQuery(query.values.slice(1));
    } else {
      symbolQuery = query;
    }
    let buttons;
    const openSideBySideDirection = this.options?.openSideBySideDirection?.();
    if (openSideBySideDirection) {
      buttons = [{
        iconClass: openSideBySideDirection === "right" ? ThemeIcon.asClassName(Codicon.splitHorizontal) : ThemeIcon.asClassName(Codicon.splitVertical),
        tooltip: openSideBySideDirection === "right" ? localize("openToSide", "Open to the Side") : localize("openToBottom", "Open to the Bottom")
      }];
    }
    const filteredSymbolPicks = [];
    for (let index = 0; index < symbols.length; index++) {
      const symbol = symbols[index];
      const symbolLabel = trim(symbol.name);
      const symbolLabelWithIcon = `$(${SymbolKinds.toIcon(symbol.kind).id}) ${symbolLabel}`;
      const symbolLabelIconOffset = symbolLabelWithIcon.length - symbolLabel.length;
      let containerLabel = symbol.containerName;
      if (options?.extraContainerLabel) {
        if (containerLabel) {
          containerLabel = `${options.extraContainerLabel} \u2022 ${containerLabel}`;
        } else {
          containerLabel = options.extraContainerLabel;
        }
      }
      let symbolScore = void 0;
      let symbolMatches = void 0;
      let containerScore = void 0;
      let containerMatches = void 0;
      if (query.original.length > filterPos) {
        let skipContainerQuery = false;
        if (symbolQuery !== query) {
          [symbolScore, symbolMatches] = scoreFuzzy2(symbolLabelWithIcon, {
            ...query,
            values: void 0
            /* disable multi-query support */
          }, filterPos, symbolLabelIconOffset);
          if (typeof symbolScore === "number") {
            skipContainerQuery = true;
          }
        }
        if (typeof symbolScore !== "number") {
          [symbolScore, symbolMatches] = scoreFuzzy2(symbolLabelWithIcon, symbolQuery, filterPos, symbolLabelIconOffset);
          if (typeof symbolScore !== "number") {
            continue;
          }
        }
        if (!skipContainerQuery && containerQuery) {
          if (containerLabel && containerQuery.original.length > 0) {
            [containerScore, containerMatches] = scoreFuzzy2(containerLabel, containerQuery);
          }
          if (typeof containerScore !== "number") {
            continue;
          }
          if (typeof symbolScore === "number") {
            symbolScore += containerScore;
          }
        }
      }
      const deprecated = symbol.tags && symbol.tags.indexOf(SymbolTag.Deprecated) >= 0;
      filteredSymbolPicks.push({
        index,
        kind: symbol.kind,
        score: symbolScore,
        label: symbolLabelWithIcon,
        ariaLabel: getAriaLabelForSymbol(symbol.name, symbol.kind),
        description: containerLabel,
        highlights: deprecated ? void 0 : {
          label: symbolMatches,
          description: containerMatches
        },
        range: {
          selection: Range.collapseToStart(symbol.selectionRange),
          decoration: symbol.range
        },
        uri: model.uri,
        symbolName: symbolLabel,
        strikethrough: deprecated,
        buttons
      });
    }
    const sortedFilteredSymbolPicks = filteredSymbolPicks.sort(
      (symbolA, symbolB) => filterBySymbolKind ? this.compareByKindAndScore(symbolA, symbolB) : this.compareByScore(symbolA, symbolB)
    );
    let symbolPicks = [];
    if (filterBySymbolKind) {
      let updateLastSeparatorLabel2 = function() {
        if (lastSeparator && typeof lastSymbolKind === "number" && lastSymbolKindCounter > 0) {
          lastSeparator.label = format(NLS_SYMBOL_KIND_CACHE[lastSymbolKind] || FALLBACK_NLS_SYMBOL_KIND, lastSymbolKindCounter);
        }
      };
      var updateLastSeparatorLabel = updateLastSeparatorLabel2;
      let lastSymbolKind = void 0;
      let lastSeparator = void 0;
      let lastSymbolKindCounter = 0;
      for (const symbolPick of sortedFilteredSymbolPicks) {
        if (lastSymbolKind !== symbolPick.kind) {
          updateLastSeparatorLabel2();
          lastSymbolKind = symbolPick.kind;
          lastSymbolKindCounter = 1;
          lastSeparator = { type: "separator" };
          symbolPicks.push(lastSeparator);
        } else {
          lastSymbolKindCounter++;
        }
        symbolPicks.push(symbolPick);
      }
      updateLastSeparatorLabel2();
    } else if (sortedFilteredSymbolPicks.length > 0) {
      symbolPicks = [
        { label: localize("symbols", "symbols ({0})", filteredSymbolPicks.length), type: "separator" },
        ...sortedFilteredSymbolPicks
      ];
    }
    return symbolPicks;
  }
  compareByScore(symbolA, symbolB) {
    if (typeof symbolA.score !== "number" && typeof symbolB.score === "number") {
      return 1;
    } else if (typeof symbolA.score === "number" && typeof symbolB.score !== "number") {
      return -1;
    }
    if (typeof symbolA.score === "number" && typeof symbolB.score === "number") {
      if (symbolA.score > symbolB.score) {
        return -1;
      } else if (symbolA.score < symbolB.score) {
        return 1;
      }
    }
    if (symbolA.index < symbolB.index) {
      return -1;
    } else if (symbolA.index > symbolB.index) {
      return 1;
    }
    return 0;
  }
  compareByKindAndScore(symbolA, symbolB) {
    const kindA = NLS_SYMBOL_KIND_CACHE[symbolA.kind] || FALLBACK_NLS_SYMBOL_KIND;
    const kindB = NLS_SYMBOL_KIND_CACHE[symbolB.kind] || FALLBACK_NLS_SYMBOL_KIND;
    const result = kindA.localeCompare(kindB);
    if (result === 0) {
      return this.compareByScore(symbolA, symbolB);
    }
    return result;
  }
  async getDocumentSymbols(document, token) {
    const model = await this._outlineModelService.getOrCreate(document, token);
    return token.isCancellationRequested ? [] : model.asListOfDocumentSymbols();
  }
};
AbstractGotoSymbolQuickAccessProvider.PREFIX = "@";
AbstractGotoSymbolQuickAccessProvider.SCOPE_PREFIX = ":";
AbstractGotoSymbolQuickAccessProvider.PREFIX_BY_CATEGORY = `${AbstractGotoSymbolQuickAccessProvider.PREFIX}${AbstractGotoSymbolQuickAccessProvider.SCOPE_PREFIX}`;
AbstractGotoSymbolQuickAccessProvider = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IOutlineModelService)
], AbstractGotoSymbolQuickAccessProvider);
const FALLBACK_NLS_SYMBOL_KIND = localize("property", "properties ({0})");
const NLS_SYMBOL_KIND_CACHE = {
  [SymbolKind.Method]: localize("method", "methods ({0})"),
  [SymbolKind.Function]: localize("function", "functions ({0})"),
  [SymbolKind.Constructor]: localize("_constructor", "constructors ({0})"),
  [SymbolKind.Variable]: localize("variable", "variables ({0})"),
  [SymbolKind.Class]: localize("class", "classes ({0})"),
  [SymbolKind.Struct]: localize("struct", "structs ({0})"),
  [SymbolKind.Event]: localize("event", "events ({0})"),
  [SymbolKind.Operator]: localize("operator", "operators ({0})"),
  [SymbolKind.Interface]: localize("interface", "interfaces ({0})"),
  [SymbolKind.Namespace]: localize("namespace", "namespaces ({0})"),
  [SymbolKind.Package]: localize("package", "packages ({0})"),
  [SymbolKind.TypeParameter]: localize("typeParameter", "type parameters ({0})"),
  [SymbolKind.Module]: localize("modules", "modules ({0})"),
  [SymbolKind.Property]: localize("property", "properties ({0})"),
  [SymbolKind.Enum]: localize("enum", "enumerations ({0})"),
  [SymbolKind.EnumMember]: localize("enumMember", "enumeration members ({0})"),
  [SymbolKind.String]: localize("string", "strings ({0})"),
  [SymbolKind.File]: localize("file", "files ({0})"),
  [SymbolKind.Array]: localize("array", "arrays ({0})"),
  [SymbolKind.Number]: localize("number", "numbers ({0})"),
  [SymbolKind.Boolean]: localize("boolean", "booleans ({0})"),
  [SymbolKind.Object]: localize("object", "objects ({0})"),
  [SymbolKind.Key]: localize("key", "keys ({0})"),
  [SymbolKind.Field]: localize("field", "fields ({0})"),
  [SymbolKind.Constant]: localize("constant", "constants ({0})")
};
export {
  AbstractGotoSymbolQuickAccessProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9xdWlja0FjY2Vzcy9icm93c2VyL2dvdG9TeW1ib2xRdWlja0FjY2Vzcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElNYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgSVByZXBhcmVkUXVlcnksIHBpZWNlVG9RdWVyeSwgcHJlcGFyZVF1ZXJ5LCBzY29yZUZ1enp5MiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Z1enp5U2NvcmVyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZm9ybWF0LCB0cmltIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBEb2N1bWVudFN5bWJvbCwgU3ltYm9sS2luZCwgU3ltYm9sS2luZHMsIFN5bWJvbFRhZywgZ2V0QXJpYUxhYmVsRm9yU3ltYm9sIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJT3V0bGluZU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uL2RvY3VtZW50U3ltYm9scy9icm93c2VyL291dGxpbmVNb2RlbC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEVkaXRvck5hdmlnYXRpb25RdWlja0FjY2Vzc1Byb3ZpZGVyLCBJRWRpdG9yTmF2aWdhdGlvblF1aWNrQWNjZXNzT3B0aW9ucywgSVF1aWNrQWNjZXNzVGV4dEVkaXRvckNvbnRleHQgfSBmcm9tICcuL2VkaXRvck5hdmlnYXRpb25RdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dEJ1dHRvbiwgSVF1aWNrUGljaywgSVF1aWNrUGlja0l0ZW0sIElRdWlja1BpY2tTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgZmluZExhc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IElRdWlja0FjY2Vzc1Byb3ZpZGVyUnVuT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUdvdG9TeW1ib2xRdWlja1BpY2tJdGVtIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRraW5kOiBTeW1ib2xLaW5kO1xuXHRpbmRleDogbnVtYmVyO1xuXHRzY29yZT86IG51bWJlcjtcblx0dXJpPzogVVJJO1xuXHRzeW1ib2xOYW1lPzogc3RyaW5nO1xuXHRyYW5nZT86IHsgZGVjb3JhdGlvbjogSVJhbmdlOyBzZWxlY3Rpb246IElSYW5nZSB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlck9wdGlvbnMgZXh0ZW5kcyBJRWRpdG9yTmF2aWdhdGlvblF1aWNrQWNjZXNzT3B0aW9ucyB7XG5cdG9wZW5TaWRlQnlTaWRlRGlyZWN0aW9uPzogKCkgPT4gdW5kZWZpbmVkIHwgJ3JpZ2h0JyB8ICdkb3duJztcblx0LyoqXG5cdCAqIEEgaGFuZGxlciB0byBpbnZva2Ugd2hlbiBhbiBpdGVtIGlzIGFjY2VwdGVkIGZvclxuXHQgKiB0aGlzIHBhcnRpY3VsYXIgc2hvd2luZyBvZiB0aGUgcXVpY2sgYWNjZXNzLlxuXHQgKiBAcGFyYW0gaXRlbSBUaGUgaXRlbSB0aGF0IHdhcyBhY2NlcHRlZC5cblx0ICovXG5cdHJlYWRvbmx5IGhhbmRsZUFjY2VwdD86IChpdGVtOiBJUXVpY2tQaWNrSXRlbSkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0R290b1N5bWJvbFF1aWNrQWNjZXNzUHJvdmlkZXIgZXh0ZW5kcyBBYnN0cmFjdEVkaXRvck5hdmlnYXRpb25RdWlja0FjY2Vzc1Byb3ZpZGVyIHtcblxuXHRzdGF0aWMgUFJFRklYID0gJ0AnO1xuXHRzdGF0aWMgU0NPUEVfUFJFRklYID0gJzonO1xuXHRzdGF0aWMgUFJFRklYX0JZX0NBVEVHT1JZID0gYCR7dGhpcy5QUkVGSVh9JHt0aGlzLlNDT1BFX1BSRUZJWH1gO1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZWFkb25seSBvcHRpb25zOiBJR290b1N5bWJvbFF1aWNrQWNjZXNzUHJvdmlkZXJPcHRpb25zO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASU91dGxpbmVNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfb3V0bGluZU1vZGVsU2VydmljZTogSU91dGxpbmVNb2RlbFNlcnZpY2UsXG5cdFx0b3B0aW9uczogSUdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyT3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbClcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucyk7XG5cblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMub3B0aW9ucy5jYW5BY2NlcHRJbkJhY2tncm91bmQgPSB0cnVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIHByb3ZpZGVXaXRob3V0VGV4dEVkaXRvcihwaWNrZXI6IElRdWlja1BpY2s8SUdvdG9TeW1ib2xRdWlja1BpY2tJdGVtLCB7IHVzZVNlcGFyYXRvcnM6IHRydWUgfT4pOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5wcm92aWRlTGFiZWxQaWNrKHBpY2tlciwgbG9jYWxpemUoJ2Nhbm5vdFJ1bkdvdG9TeW1ib2xXaXRob3V0RWRpdG9yJywgXCJUbyBnbyB0byBhIHN5bWJvbCwgZmlyc3Qgb3BlbiBhIHRleHQgZWRpdG9yIHdpdGggc3ltYm9sIGluZm9ybWF0aW9uLlwiKSk7XG5cblx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lO1xuXHR9XG5cblx0cHJvdGVjdGVkIHByb3ZpZGVXaXRoVGV4dEVkaXRvcihjb250ZXh0OiBJUXVpY2tBY2Nlc3NUZXh0RWRpdG9yQ29udGV4dCwgcGlja2VyOiBJUXVpY2tQaWNrPElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSwgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIHJ1bk9wdGlvbnM/OiBJUXVpY2tBY2Nlc3NQcm92aWRlclJ1bk9wdGlvbnMpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZWRpdG9yID0gY29udGV4dC5lZGl0b3I7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmdldE1vZGVsKGVkaXRvcik7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0XHR9XG5cblx0XHQvLyBQcm92aWRlIHN5bWJvbHMgZnJvbSBtb2RlbCBpZiBhdmFpbGFibGUgaW4gcmVnaXN0cnlcblx0XHRpZiAodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTeW1ib2xQcm92aWRlci5oYXMobW9kZWwpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb1Byb3ZpZGVXaXRoRWRpdG9yU3ltYm9scyhjb250ZXh0LCBtb2RlbCwgcGlja2VyLCB0b2tlbiwgcnVuT3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlIHNob3cgYW4gZW50cnkgZm9yIGEgbW9kZWwgd2l0aG91dCByZWdpc3RyeVxuXHRcdC8vIEJ1dCBnaXZlIGEgY2hhbmNlIHRvIHJlc29sdmUgdGhlIHN5bWJvbHMgYXQgYSBsYXRlclxuXHRcdC8vIHBvaW50IGlmIHBvc3NpYmxlXG5cdFx0cmV0dXJuIHRoaXMuZG9Qcm92aWRlV2l0aG91dEVkaXRvclN5bWJvbHMoY29udGV4dCwgbW9kZWwsIHBpY2tlciwgdG9rZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1Byb3ZpZGVXaXRob3V0RWRpdG9yU3ltYm9scyhjb250ZXh0OiBJUXVpY2tBY2Nlc3NUZXh0RWRpdG9yQ29udGV4dCwgbW9kZWw6IElUZXh0TW9kZWwsIHBpY2tlcjogSVF1aWNrUGljazxJR290b1N5bWJvbFF1aWNrUGlja0l0ZW0sIHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9PiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Ly8gR2VuZXJpYyBwaWNrIGZvciBub3QgaGF2aW5nIGFueSBzeW1ib2wgaW5mb3JtYXRpb25cblx0XHR0aGlzLnByb3ZpZGVMYWJlbFBpY2socGlja2VyLCBsb2NhbGl6ZSgnY2Fubm90UnVuR290b1N5bWJvbFdpdGhvdXRTeW1ib2xQcm92aWRlcicsIFwiVGhlIGFjdGl2ZSB0ZXh0IGVkaXRvciBkb2VzIG5vdCBwcm92aWRlIHN5bWJvbCBpbmZvcm1hdGlvbi5cIikpO1xuXG5cdFx0Ly8gV2FpdCBmb3IgY2hhbmdlcyB0byB0aGUgcmVnaXN0cnkgYW5kIHNlZSBpZiBldmVudHVhbGx5XG5cdFx0Ly8gd2UgZG8gZ2V0IHN5bWJvbHMuIFRoaXMgY2FuIGhhcHBlbiBpZiB0aGUgcGlja2VyIGlzIG9wZW5lZFxuXHRcdC8vIHZlcnkgZWFybHkgYWZ0ZXIgdGhlIG1vZGVsIGhhcyBsb2FkZWQgYnV0IGJlZm9yZSB0aGVcblx0XHQvLyBsYW5ndWFnZSByZWdpc3RyeSBpcyByZWFkeS5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNzA2MDdcblx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy53YWl0Rm9yTGFuZ3VhZ2VTeW1ib2xSZWdpc3RyeShtb2RlbCwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0aWYgKCFyZXN1bHQgfHwgdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5kb1Byb3ZpZGVXaXRoRWRpdG9yU3ltYm9scyhjb250ZXh0LCBtb2RlbCwgcGlja2VyLCB0b2tlbikpO1xuXHRcdH0pKCk7XG5cblx0XHRyZXR1cm4gZGlzcG9zYWJsZXM7XG5cdH1cblxuXHRwcml2YXRlIHByb3ZpZGVMYWJlbFBpY2socGlja2VyOiBJUXVpY2tQaWNrPElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSwgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0+LCBsYWJlbDogc3RyaW5nKTogdm9pZCB7XG5cdFx0cGlja2VyLml0ZW1zID0gW3sgbGFiZWwsIGluZGV4OiAwLCBraW5kOiBTeW1ib2xLaW5kLlN0cmluZyB9XTtcblx0XHRwaWNrZXIuYXJpYUxhYmVsID0gbGFiZWw7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgd2FpdEZvckxhbmd1YWdlU3ltYm9sUmVnaXN0cnkobW9kZWw6IElUZXh0TW9kZWwsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAodGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTeW1ib2xQcm92aWRlci5oYXMobW9kZWwpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBzeW1ib2xQcm92aWRlclJlZ2lzdHJ5UHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8Ym9vbGVhbj4oKTtcblxuXHRcdC8vIFJlc29sdmUgcHJvbWlzZSB3aGVuIHJlZ2lzdHJ5IGtub3dzIG1vZGVsXG5cdFx0Y29uc3Qgc3ltYm9sUHJvdmlkZXJMaXN0ZW5lciA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLmhhcyhtb2RlbCkpIHtcblx0XHRcdFx0c3ltYm9sUHJvdmlkZXJMaXN0ZW5lci5kaXNwb3NlKCk7XG5cblx0XHRcdFx0c3ltYm9sUHJvdmlkZXJSZWdpc3RyeVByb21pc2UuY29tcGxldGUodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVzb2x2ZSBwcm9taXNlIHdoZW4gd2UgZ2V0IGRpc3Bvc2VkIHRvb1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gc3ltYm9sUHJvdmlkZXJSZWdpc3RyeVByb21pc2UuY29tcGxldGUoZmFsc2UpKSk7XG5cblx0XHRyZXR1cm4gc3ltYm9sUHJvdmlkZXJSZWdpc3RyeVByb21pc2UucDtcblx0fVxuXG5cdHByaXZhdGUgZG9Qcm92aWRlV2l0aEVkaXRvclN5bWJvbHMoY29udGV4dDogSVF1aWNrQWNjZXNzVGV4dEVkaXRvckNvbnRleHQsIG1vZGVsOiBJVGV4dE1vZGVsLCBwaWNrZXI6IElRdWlja1BpY2s8SUdvdG9TeW1ib2xRdWlja1BpY2tJdGVtLCB7IHVzZVNlcGFyYXRvcnM6IHRydWUgfT4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgcnVuT3B0aW9ucz86IElRdWlja0FjY2Vzc1Byb3ZpZGVyUnVuT3B0aW9ucyk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBlZGl0b3IgPSBjb250ZXh0LmVkaXRvcjtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdC8vIEdvdG8gc3ltYm9sIG9uY2UgcGlja2VkXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHBpY2tlci5vbkRpZEFjY2VwdChldmVudCA9PiB7XG5cdFx0XHRjb25zdCBbaXRlbV0gPSBwaWNrZXIuc2VsZWN0ZWRJdGVtcztcblx0XHRcdGlmIChpdGVtICYmIGl0ZW0ucmFuZ2UpIHtcblx0XHRcdFx0dGhpcy5nb3RvTG9jYXRpb24oY29udGV4dCwgeyByYW5nZTogaXRlbS5yYW5nZS5zZWxlY3Rpb24sIGtleU1vZHM6IHBpY2tlci5rZXlNb2RzLCBwcmVzZXJ2ZUZvY3VzOiBldmVudC5pbkJhY2tncm91bmQgfSk7XG5cblx0XHRcdFx0cnVuT3B0aW9ucz8uaGFuZGxlQWNjZXB0Py4oaXRlbSwgZXZlbnQuaW5CYWNrZ3JvdW5kKTtcblxuXHRcdFx0XHRpZiAoIWV2ZW50LmluQmFja2dyb3VuZCkge1xuXHRcdFx0XHRcdHBpY2tlci5oaWRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBHb3RvIHN5bWJvbCBzaWRlIGJ5IHNpZGUgaWYgZW5hYmxlZFxuXHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrZXIub25EaWRUcmlnZ2VySXRlbUJ1dHRvbigoeyBpdGVtIH0pID0+IHtcblx0XHRcdGlmIChpdGVtICYmIGl0ZW0ucmFuZ2UpIHtcblx0XHRcdFx0dGhpcy5nb3RvTG9jYXRpb24oY29udGV4dCwgeyByYW5nZTogaXRlbS5yYW5nZS5zZWxlY3Rpb24sIGtleU1vZHM6IHBpY2tlci5rZXlNb2RzLCBmb3JjZVNpZGVCeVNpZGU6IHRydWUgfSk7XG5cblx0XHRcdFx0cGlja2VyLmhpZGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBSZXNvbHZlIHN5bWJvbHMgZnJvbSBkb2N1bWVudCBvbmNlIGFuZCByZXVzZSB0aGlzXG5cdFx0Ly8gcmVxdWVzdCBmb3IgYWxsIGZpbHRlcmluZyBhbmQgdHlwaW5nIHRoZW4gb25cblx0XHRjb25zdCBzeW1ib2xzUHJvbWlzZSA9IHRoaXMuZ2V0RG9jdW1lbnRTeW1ib2xzKG1vZGVsLCB0b2tlbik7XG5cblx0XHQvLyBTZXQgaW5pdGlhbCBwaWNrcyBhbmQgdXBkYXRlIG9uIHR5cGVcblx0XHRjb25zdCBwaWNrc0N0cyA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTXV0YWJsZURpc3Bvc2FibGU8Q2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U+KCkpO1xuXHRcdGNvbnN0IHVwZGF0ZVBpY2tlckl0ZW1zID0gYXN5bmMgKHBvc2l0aW9uVG9FbmNsb3NlOiBQb3NpdGlvbiB8IHVuZGVmaW5lZCkgPT4ge1xuXG5cdFx0XHQvLyBDYW5jZWwgYW55IHByZXZpb3VzIGFzayBmb3IgcGlja3MgYW5kIGJ1c3lcblx0XHRcdHBpY2tzQ3RzPy52YWx1ZT8uY2FuY2VsKCk7XG5cdFx0XHRwaWNrZXIuYnVzeSA9IGZhbHNlO1xuXG5cdFx0XHQvLyBDcmVhdGUgbmV3IGNhbmNlbGxhdGlvbiBzb3VyY2UgZm9yIHRoaXMgcnVuXG5cdFx0XHRwaWNrc0N0cy52YWx1ZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXG5cdFx0XHQvLyBDb2xsZWN0IHN5bWJvbCBwaWNrc1xuXHRcdFx0cGlja2VyLmJ1c3kgPSB0cnVlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcXVlcnkgPSBwcmVwYXJlUXVlcnkocGlja2VyLnZhbHVlLnN1YnN0cihBYnN0cmFjdEdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWC5sZW5ndGgpLnRyaW0oKSk7XG5cdFx0XHRcdGNvbnN0IGl0ZW1zID0gYXdhaXQgdGhpcy5kb0dldFN5bWJvbFBpY2tzKHN5bWJvbHNQcm9taXNlLCBxdWVyeSwgdW5kZWZpbmVkLCBwaWNrc0N0cy52YWx1ZS50b2tlbiwgbW9kZWwpO1xuXHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaXRlbXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHBpY2tlci5pdGVtcyA9IGl0ZW1zO1xuXHRcdFx0XHRcdGlmIChwb3NpdGlvblRvRW5jbG9zZSAmJiBxdWVyeS5vcmlnaW5hbC5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IDxJR290b1N5bWJvbFF1aWNrUGlja0l0ZW0+ZmluZExhc3QoaXRlbXMsIGl0ZW0gPT4gQm9vbGVhbihpdGVtLnR5cGUgIT09ICdzZXBhcmF0b3InICYmIGl0ZW0ucmFuZ2UgJiYgUmFuZ2UuY29udGFpbnNQb3NpdGlvbihpdGVtLnJhbmdlLmRlY29yYXRpb24sIHBvc2l0aW9uVG9FbmNsb3NlKSkpO1xuXHRcdFx0XHRcdFx0aWYgKGNhbmRpZGF0ZSkge1xuXHRcdFx0XHRcdFx0XHRwaWNrZXIuYWN0aXZlSXRlbXMgPSBbY2FuZGlkYXRlXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAocXVlcnkub3JpZ2luYWwubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0dGhpcy5wcm92aWRlTGFiZWxQaWNrKHBpY2tlciwgbG9jYWxpemUoJ25vTWF0Y2hpbmdTeW1ib2xSZXN1bHRzJywgXCJObyBtYXRjaGluZyBlZGl0b3Igc3ltYm9sc1wiKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMucHJvdmlkZUxhYmVsUGljayhwaWNrZXIsIGxvY2FsaXplKCdub1N5bWJvbFJlc3VsdHMnLCBcIk5vIGVkaXRvciBzeW1ib2xzXCIpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdGlmICghdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRwaWNrZXIuYnVzeSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocGlja2VyLm9uRGlkQ2hhbmdlVmFsdWUoKCkgPT4gdXBkYXRlUGlja2VySXRlbXModW5kZWZpbmVkKSkpO1xuXHRcdHVwZGF0ZVBpY2tlckl0ZW1zKGVkaXRvci5nZXRTZWxlY3Rpb24oKT8uZ2V0UG9zaXRpb24oKSk7XG5cblxuXHRcdC8vIFJldmVhbCBhbmQgZGVjb3JhdGUgd2hlbiBhY3RpdmUgaXRlbSBjaGFuZ2VzXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHBpY2tlci5vbkRpZENoYW5nZUFjdGl2ZSgoKSA9PiB7XG5cdFx0XHRjb25zdCBbaXRlbV0gPSBwaWNrZXIuYWN0aXZlSXRlbXM7XG5cdFx0XHRpZiAoaXRlbSAmJiBpdGVtLnJhbmdlKSB7XG5cblx0XHRcdFx0Ly8gUmV2ZWFsXG5cdFx0XHRcdGVkaXRvci5yZXZlYWxSYW5nZUluQ2VudGVyKGl0ZW0ucmFuZ2Uuc2VsZWN0aW9uLCBTY3JvbGxUeXBlLlNtb290aCk7XG5cblx0XHRcdFx0Ly8gRGVjb3JhdGVcblx0XHRcdFx0dGhpcy5hZGREZWNvcmF0aW9ucyhlZGl0b3IsIGl0ZW0ucmFuZ2UuZGVjb3JhdGlvbik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGRvR2V0U3ltYm9sUGlja3Moc3ltYm9sc1Byb21pc2U6IFByb21pc2U8RG9jdW1lbnRTeW1ib2xbXT4sIHF1ZXJ5OiBJUHJlcGFyZWRRdWVyeSwgb3B0aW9uczogeyBleHRyYUNvbnRhaW5lckxhYmVsPzogc3RyaW5nIH0gfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgbW9kZWw6IElUZXh0TW9kZWwpOiBQcm9taXNlPEFycmF5PElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSB8IElRdWlja1BpY2tTZXBhcmF0b3I+PiB7XG5cdFx0Y29uc3Qgc3ltYm9scyA9IGF3YWl0IHN5bWJvbHNQcm9taXNlO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbHRlckJ5U3ltYm9sS2luZCA9IHF1ZXJ5Lm9yaWdpbmFsLmluZGV4T2YoQWJzdHJhY3RHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlci5TQ09QRV9QUkVGSVgpID09PSAwO1xuXHRcdGNvbnN0IGZpbHRlclBvcyA9IGZpbHRlckJ5U3ltYm9sS2luZCA/IDEgOiAwO1xuXG5cdFx0Ly8gU3BsaXQgYmV0d2VlbiBzeW1ib2wgYW5kIGNvbnRhaW5lciBxdWVyeVxuXHRcdGxldCBzeW1ib2xRdWVyeTogSVByZXBhcmVkUXVlcnk7XG5cdFx0bGV0IGNvbnRhaW5lclF1ZXJ5OiBJUHJlcGFyZWRRdWVyeSB8IHVuZGVmaW5lZDtcblx0XHRpZiAocXVlcnkudmFsdWVzICYmIHF1ZXJ5LnZhbHVlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRzeW1ib2xRdWVyeSA9IHBpZWNlVG9RdWVyeShxdWVyeS52YWx1ZXNbMF0pOyBcdFx0ICAvLyBzeW1ib2w6IG9ubHkgbWF0Y2ggb24gZmlyc3QgcGFydFxuXHRcdFx0Y29udGFpbmVyUXVlcnkgPSBwaWVjZVRvUXVlcnkocXVlcnkudmFsdWVzLnNsaWNlKDEpKTsgLy8gY29udGFpbmVyOiBtYXRjaCBvbiBhbGwgYnV0IGZpcnN0IHBhcnRzXG5cdFx0fSBlbHNlIHtcblx0XHRcdHN5bWJvbFF1ZXJ5ID0gcXVlcnk7XG5cdFx0fVxuXG5cdFx0Ly8gQ29udmVydCB0byBzeW1ib2wgcGlja3MgYW5kIGFwcGx5IGZpbHRlcmluZ1xuXG5cdFx0bGV0IGJ1dHRvbnM6IElRdWlja0lucHV0QnV0dG9uW10gfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgb3BlblNpZGVCeVNpZGVEaXJlY3Rpb24gPSB0aGlzLm9wdGlvbnM/Lm9wZW5TaWRlQnlTaWRlRGlyZWN0aW9uPy4oKTtcblx0XHRpZiAob3BlblNpZGVCeVNpZGVEaXJlY3Rpb24pIHtcblx0XHRcdGJ1dHRvbnMgPSBbe1xuXHRcdFx0XHRpY29uQ2xhc3M6IG9wZW5TaWRlQnlTaWRlRGlyZWN0aW9uID09PSAncmlnaHQnID8gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uc3BsaXRIb3Jpem9udGFsKSA6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnNwbGl0VmVydGljYWwpLFxuXHRcdFx0XHR0b29sdGlwOiBvcGVuU2lkZUJ5U2lkZURpcmVjdGlvbiA9PT0gJ3JpZ2h0JyA/IGxvY2FsaXplKCdvcGVuVG9TaWRlJywgXCJPcGVuIHRvIHRoZSBTaWRlXCIpIDogbG9jYWxpemUoJ29wZW5Ub0JvdHRvbScsIFwiT3BlbiB0byB0aGUgQm90dG9tXCIpXG5cdFx0XHR9XTtcblx0XHR9XG5cblx0XHRjb25zdCBmaWx0ZXJlZFN5bWJvbFBpY2tzOiBJR290b1N5bWJvbFF1aWNrUGlja0l0ZW1bXSA9IFtdO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBzeW1ib2xzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3Qgc3ltYm9sID0gc3ltYm9sc1tpbmRleF07XG5cblx0XHRcdGNvbnN0IHN5bWJvbExhYmVsID0gdHJpbShzeW1ib2wubmFtZSk7XG5cdFx0XHRjb25zdCBzeW1ib2xMYWJlbFdpdGhJY29uID0gYCQoJHtTeW1ib2xLaW5kcy50b0ljb24oc3ltYm9sLmtpbmQpLmlkfSkgJHtzeW1ib2xMYWJlbH1gO1xuXHRcdFx0Y29uc3Qgc3ltYm9sTGFiZWxJY29uT2Zmc2V0ID0gc3ltYm9sTGFiZWxXaXRoSWNvbi5sZW5ndGggLSBzeW1ib2xMYWJlbC5sZW5ndGg7XG5cblx0XHRcdGxldCBjb250YWluZXJMYWJlbCA9IHN5bWJvbC5jb250YWluZXJOYW1lO1xuXHRcdFx0aWYgKG9wdGlvbnM/LmV4dHJhQ29udGFpbmVyTGFiZWwpIHtcblx0XHRcdFx0aWYgKGNvbnRhaW5lckxhYmVsKSB7XG5cdFx0XHRcdFx0Y29udGFpbmVyTGFiZWwgPSBgJHtvcHRpb25zLmV4dHJhQ29udGFpbmVyTGFiZWx9IFx1MjAyMiAke2NvbnRhaW5lckxhYmVsfWA7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29udGFpbmVyTGFiZWwgPSBvcHRpb25zLmV4dHJhQ29udGFpbmVyTGFiZWw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0bGV0IHN5bWJvbFNjb3JlOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgc3ltYm9sTWF0Y2hlczogSU1hdGNoW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdGxldCBjb250YWluZXJTY29yZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGNvbnRhaW5lck1hdGNoZXM6IElNYXRjaFtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAocXVlcnkub3JpZ2luYWwubGVuZ3RoID4gZmlsdGVyUG9zKSB7XG5cblx0XHRcdFx0Ly8gRmlyc3Q6IHRyeSB0byBzY29yZSBvbiB0aGUgZW50aXJlIHF1ZXJ5LCBpdCBpcyBwb3NzaWJsZSB0aGF0XG5cdFx0XHRcdC8vIHRoZSBzeW1ib2wgbWF0Y2hlcyBwZXJmZWN0bHkgKGUuZy4gc2VhcmNoaW5nIGZvciBcImNoYW5nZSBsb2dcIlxuXHRcdFx0XHQvLyBjYW4gYmUgYSBtYXRjaCBvbiBhIG1hcmtkb3duIHN5bWJvbCBcImNoYW5nZSBsb2dcIikuIEluIHRoYXRcblx0XHRcdFx0Ly8gY2FzZSB3ZSB3YW50IHRvIHNraXAgdGhlIGNvbnRhaW5lciBxdWVyeSBhbHRvZ2V0aGVyLlxuXHRcdFx0XHRsZXQgc2tpcENvbnRhaW5lclF1ZXJ5ID0gZmFsc2U7XG5cdFx0XHRcdGlmIChzeW1ib2xRdWVyeSAhPT0gcXVlcnkpIHtcblx0XHRcdFx0XHRbc3ltYm9sU2NvcmUsIHN5bWJvbE1hdGNoZXNdID0gc2NvcmVGdXp6eTIoc3ltYm9sTGFiZWxXaXRoSWNvbiwgeyAuLi5xdWVyeSwgdmFsdWVzOiB1bmRlZmluZWQgLyogZGlzYWJsZSBtdWx0aS1xdWVyeSBzdXBwb3J0ICovIH0sIGZpbHRlclBvcywgc3ltYm9sTGFiZWxJY29uT2Zmc2V0KTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIHN5bWJvbFNjb3JlID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0c2tpcENvbnRhaW5lclF1ZXJ5ID0gdHJ1ZTsgLy8gc2luY2Ugd2UgY29uc3VtZWQgdGhlIHF1ZXJ5LCBza2lwIGFueSBjb250YWluZXIgbWF0Y2hpbmdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBPdGhlcndpc2U6IHNjb3JlIG9uIHRoZSBzeW1ib2wgcXVlcnkgYW5kIG1hdGNoIG9uIHRoZSBjb250YWluZXIgbGF0ZXJcblx0XHRcdFx0aWYgKHR5cGVvZiBzeW1ib2xTY29yZSAhPT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRbc3ltYm9sU2NvcmUsIHN5bWJvbE1hdGNoZXNdID0gc2NvcmVGdXp6eTIoc3ltYm9sTGFiZWxXaXRoSWNvbiwgc3ltYm9sUXVlcnksIGZpbHRlclBvcywgc3ltYm9sTGFiZWxJY29uT2Zmc2V0KTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIHN5bWJvbFNjb3JlICE9PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gU2NvcmUgYnkgY29udGFpbmVyIGlmIHNwZWNpZmllZFxuXHRcdFx0XHRpZiAoIXNraXBDb250YWluZXJRdWVyeSAmJiBjb250YWluZXJRdWVyeSkge1xuXHRcdFx0XHRcdGlmIChjb250YWluZXJMYWJlbCAmJiBjb250YWluZXJRdWVyeS5vcmlnaW5hbC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRbY29udGFpbmVyU2NvcmUsIGNvbnRhaW5lck1hdGNoZXNdID0gc2NvcmVGdXp6eTIoY29udGFpbmVyTGFiZWwsIGNvbnRhaW5lclF1ZXJ5KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAodHlwZW9mIGNvbnRhaW5lclNjb3JlICE9PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBzeW1ib2xTY29yZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdHN5bWJvbFNjb3JlICs9IGNvbnRhaW5lclNjb3JlOyAvLyBib29zdCBzeW1ib2xTY29yZSBieSBjb250YWluZXJTY29yZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZXByZWNhdGVkID0gc3ltYm9sLnRhZ3MgJiYgc3ltYm9sLnRhZ3MuaW5kZXhPZihTeW1ib2xUYWcuRGVwcmVjYXRlZCkgPj0gMDtcblxuXHRcdFx0ZmlsdGVyZWRTeW1ib2xQaWNrcy5wdXNoKHtcblx0XHRcdFx0aW5kZXgsXG5cdFx0XHRcdGtpbmQ6IHN5bWJvbC5raW5kLFxuXHRcdFx0XHRzY29yZTogc3ltYm9sU2NvcmUsXG5cdFx0XHRcdGxhYmVsOiBzeW1ib2xMYWJlbFdpdGhJY29uLFxuXHRcdFx0XHRhcmlhTGFiZWw6IGdldEFyaWFMYWJlbEZvclN5bWJvbChzeW1ib2wubmFtZSwgc3ltYm9sLmtpbmQpLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogY29udGFpbmVyTGFiZWwsXG5cdFx0XHRcdGhpZ2hsaWdodHM6IGRlcHJlY2F0ZWQgPyB1bmRlZmluZWQgOiB7XG5cdFx0XHRcdFx0bGFiZWw6IHN5bWJvbE1hdGNoZXMsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGNvbnRhaW5lck1hdGNoZXNcblx0XHRcdFx0fSxcblx0XHRcdFx0cmFuZ2U6IHtcblx0XHRcdFx0XHRzZWxlY3Rpb246IFJhbmdlLmNvbGxhcHNlVG9TdGFydChzeW1ib2wuc2VsZWN0aW9uUmFuZ2UpLFxuXHRcdFx0XHRcdGRlY29yYXRpb246IHN5bWJvbC5yYW5nZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR1cmk6IG1vZGVsLnVyaSxcblx0XHRcdFx0c3ltYm9sTmFtZTogc3ltYm9sTGFiZWwsXG5cdFx0XHRcdHN0cmlrZXRocm91Z2g6IGRlcHJlY2F0ZWQsXG5cdFx0XHRcdGJ1dHRvbnNcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIFNvcnQgYnkgc2NvcmVcblx0XHRjb25zdCBzb3J0ZWRGaWx0ZXJlZFN5bWJvbFBpY2tzID0gZmlsdGVyZWRTeW1ib2xQaWNrcy5zb3J0KChzeW1ib2xBLCBzeW1ib2xCKSA9PiBmaWx0ZXJCeVN5bWJvbEtpbmQgP1xuXHRcdFx0dGhpcy5jb21wYXJlQnlLaW5kQW5kU2NvcmUoc3ltYm9sQSwgc3ltYm9sQikgOlxuXHRcdFx0dGhpcy5jb21wYXJlQnlTY29yZShzeW1ib2xBLCBzeW1ib2xCKVxuXHRcdCk7XG5cblx0XHQvLyBBZGQgc2VwYXJhdG9yIGZvciB0eXBlc1xuXHRcdC8vIC0gQCAgb25seSB0b3RhbCBudW1iZXIgb2Ygc3ltYm9sc1xuXHRcdC8vIC0gQDogZ3JvdXBlZCBieSBzeW1ib2wga2luZFxuXHRcdGxldCBzeW1ib2xQaWNrczogQXJyYXk8SUdvdG9TeW1ib2xRdWlja1BpY2tJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4gPSBbXTtcblx0XHRpZiAoZmlsdGVyQnlTeW1ib2xLaW5kKSB7XG5cdFx0XHRsZXQgbGFzdFN5bWJvbEtpbmQ6IFN5bWJvbEtpbmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgbGFzdFNlcGFyYXRvcjogSVF1aWNrUGlja1NlcGFyYXRvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdGxldCBsYXN0U3ltYm9sS2luZENvdW50ZXIgPSAwO1xuXG5cdFx0XHRmdW5jdGlvbiB1cGRhdGVMYXN0U2VwYXJhdG9yTGFiZWwoKTogdm9pZCB7XG5cdFx0XHRcdGlmIChsYXN0U2VwYXJhdG9yICYmIHR5cGVvZiBsYXN0U3ltYm9sS2luZCA9PT0gJ251bWJlcicgJiYgbGFzdFN5bWJvbEtpbmRDb3VudGVyID4gMCkge1xuXHRcdFx0XHRcdGxhc3RTZXBhcmF0b3IubGFiZWwgPSBmb3JtYXQoTkxTX1NZTUJPTF9LSU5EX0NBQ0hFW2xhc3RTeW1ib2xLaW5kXSB8fCBGQUxMQkFDS19OTFNfU1lNQk9MX0tJTkQsIGxhc3RTeW1ib2xLaW5kQ291bnRlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBzeW1ib2xQaWNrIG9mIHNvcnRlZEZpbHRlcmVkU3ltYm9sUGlja3MpIHtcblxuXHRcdFx0XHQvLyBGb3VuZCBuZXcga2luZFxuXHRcdFx0XHRpZiAobGFzdFN5bWJvbEtpbmQgIT09IHN5bWJvbFBpY2sua2luZCkge1xuXG5cdFx0XHRcdFx0Ly8gVXBkYXRlIGxhc3Qgc2VwYXJhdG9yIHdpdGggbnVtYmVyIG9mIHN5bWJvbHMgd2UgZm91bmQgZm9yIGtpbmRcblx0XHRcdFx0XHR1cGRhdGVMYXN0U2VwYXJhdG9yTGFiZWwoKTtcblxuXHRcdFx0XHRcdGxhc3RTeW1ib2xLaW5kID0gc3ltYm9sUGljay5raW5kO1xuXHRcdFx0XHRcdGxhc3RTeW1ib2xLaW5kQ291bnRlciA9IDE7XG5cblx0XHRcdFx0XHQvLyBBZGQgbmV3IHNlcGFyYXRvciBmb3IgbmV3IGtpbmRcblx0XHRcdFx0XHRsYXN0U2VwYXJhdG9yID0geyB0eXBlOiAnc2VwYXJhdG9yJyB9O1xuXHRcdFx0XHRcdHN5bWJvbFBpY2tzLnB1c2gobGFzdFNlcGFyYXRvcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBFeGlzdGluZyBraW5kLCBrZWVwIGNvdW50aW5nXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGxhc3RTeW1ib2xLaW5kQ291bnRlcisrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQWRkIHRvIGZpbmFsIHJlc3VsdFxuXHRcdFx0XHRzeW1ib2xQaWNrcy5wdXNoKHN5bWJvbFBpY2spO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBVcGRhdGUgbGFzdCBzZXBhcmF0b3Igd2l0aCBudW1iZXIgb2Ygc3ltYm9scyB3ZSBmb3VuZCBmb3Iga2luZFxuXHRcdFx0dXBkYXRlTGFzdFNlcGFyYXRvckxhYmVsKCk7XG5cdFx0fSBlbHNlIGlmIChzb3J0ZWRGaWx0ZXJlZFN5bWJvbFBpY2tzLmxlbmd0aCA+IDApIHtcblx0XHRcdHN5bWJvbFBpY2tzID0gW1xuXHRcdFx0XHR7IGxhYmVsOiBsb2NhbGl6ZSgnc3ltYm9scycsIFwic3ltYm9scyAoezB9KVwiLCBmaWx0ZXJlZFN5bWJvbFBpY2tzLmxlbmd0aCksIHR5cGU6ICdzZXBhcmF0b3InIH0sXG5cdFx0XHRcdC4uLnNvcnRlZEZpbHRlcmVkU3ltYm9sUGlja3Ncblx0XHRcdF07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN5bWJvbFBpY2tzO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wYXJlQnlTY29yZShzeW1ib2xBOiBJR290b1N5bWJvbFF1aWNrUGlja0l0ZW0sIHN5bWJvbEI6IElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSk6IG51bWJlciB7XG5cdFx0aWYgKHR5cGVvZiBzeW1ib2xBLnNjb3JlICE9PSAnbnVtYmVyJyAmJiB0eXBlb2Ygc3ltYm9sQi5zY29yZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHN5bWJvbEEuc2NvcmUgPT09ICdudW1iZXInICYmIHR5cGVvZiBzeW1ib2xCLnNjb3JlICE9PSAnbnVtYmVyJykge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2Ygc3ltYm9sQS5zY29yZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIHN5bWJvbEIuc2NvcmUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRpZiAoc3ltYm9sQS5zY29yZSA+IHN5bWJvbEIuc2NvcmUpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fSBlbHNlIGlmIChzeW1ib2xBLnNjb3JlIDwgc3ltYm9sQi5zY29yZSkge1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoc3ltYm9sQS5pbmRleCA8IHN5bWJvbEIuaW5kZXgpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9IGVsc2UgaWYgKHN5bWJvbEEuaW5kZXggPiBzeW1ib2xCLmluZGV4KSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdHByaXZhdGUgY29tcGFyZUJ5S2luZEFuZFNjb3JlKHN5bWJvbEE6IElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSwgc3ltYm9sQjogSUdvdG9TeW1ib2xRdWlja1BpY2tJdGVtKTogbnVtYmVyIHtcblx0XHRjb25zdCBraW5kQSA9IE5MU19TWU1CT0xfS0lORF9DQUNIRVtzeW1ib2xBLmtpbmRdIHx8IEZBTExCQUNLX05MU19TWU1CT0xfS0lORDtcblx0XHRjb25zdCBraW5kQiA9IE5MU19TWU1CT0xfS0lORF9DQUNIRVtzeW1ib2xCLmtpbmRdIHx8IEZBTExCQUNLX05MU19TWU1CT0xfS0lORDtcblxuXHRcdC8vIFNvcnQgYnkgdHlwZSBmaXJzdCBpZiBzY29wZWQgc2VhcmNoXG5cdFx0Y29uc3QgcmVzdWx0ID0ga2luZEEubG9jYWxlQ29tcGFyZShraW5kQik7XG5cdFx0aWYgKHJlc3VsdCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29tcGFyZUJ5U2NvcmUoc3ltYm9sQSwgc3ltYm9sQik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBnZXREb2N1bWVudFN5bWJvbHMoZG9jdW1lbnQ6IElUZXh0TW9kZWwsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8RG9jdW1lbnRTeW1ib2xbXT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgdGhpcy5fb3V0bGluZU1vZGVsU2VydmljZS5nZXRPckNyZWF0ZShkb2N1bWVudCwgdG9rZW4pO1xuXHRcdHJldHVybiB0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCA/IFtdIDogbW9kZWwuYXNMaXN0T2ZEb2N1bWVudFN5bWJvbHMoKTtcblx0fVxufVxuXG4vLyAjcmVnaW9uIE5MUyBIZWxwZXJzXG5cbmNvbnN0IEZBTExCQUNLX05MU19TWU1CT0xfS0lORCA9IGxvY2FsaXplKCdwcm9wZXJ0eScsIFwicHJvcGVydGllcyAoezB9KVwiKTtcbmNvbnN0IE5MU19TWU1CT0xfS0lORF9DQUNIRTogeyBbdHlwZTogbnVtYmVyXTogc3RyaW5nIH0gPSB7XG5cdFtTeW1ib2xLaW5kLk1ldGhvZF06IGxvY2FsaXplKCdtZXRob2QnLCBcIm1ldGhvZHMgKHswfSlcIiksXG5cdFtTeW1ib2xLaW5kLkZ1bmN0aW9uXTogbG9jYWxpemUoJ2Z1bmN0aW9uJywgXCJmdW5jdGlvbnMgKHswfSlcIiksXG5cdFtTeW1ib2xLaW5kLkNvbnN0cnVjdG9yXTogbG9jYWxpemUoJ19jb25zdHJ1Y3RvcicsIFwiY29uc3RydWN0b3JzICh7MH0pXCIpLFxuXHRbU3ltYm9sS2luZC5WYXJpYWJsZV06IGxvY2FsaXplKCd2YXJpYWJsZScsIFwidmFyaWFibGVzICh7MH0pXCIpLFxuXHRbU3ltYm9sS2luZC5DbGFzc106IGxvY2FsaXplKCdjbGFzcycsIFwiY2xhc3NlcyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuU3RydWN0XTogbG9jYWxpemUoJ3N0cnVjdCcsIFwic3RydWN0cyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuRXZlbnRdOiBsb2NhbGl6ZSgnZXZlbnQnLCBcImV2ZW50cyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuT3BlcmF0b3JdOiBsb2NhbGl6ZSgnb3BlcmF0b3InLCBcIm9wZXJhdG9ycyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuSW50ZXJmYWNlXTogbG9jYWxpemUoJ2ludGVyZmFjZScsIFwiaW50ZXJmYWNlcyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuTmFtZXNwYWNlXTogbG9jYWxpemUoJ25hbWVzcGFjZScsIFwibmFtZXNwYWNlcyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuUGFja2FnZV06IGxvY2FsaXplKCdwYWNrYWdlJywgXCJwYWNrYWdlcyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuVHlwZVBhcmFtZXRlcl06IGxvY2FsaXplKCd0eXBlUGFyYW1ldGVyJywgXCJ0eXBlIHBhcmFtZXRlcnMgKHswfSlcIiksXG5cdFtTeW1ib2xLaW5kLk1vZHVsZV06IGxvY2FsaXplKCdtb2R1bGVzJywgXCJtb2R1bGVzICh7MH0pXCIpLFxuXHRbU3ltYm9sS2luZC5Qcm9wZXJ0eV06IGxvY2FsaXplKCdwcm9wZXJ0eScsIFwicHJvcGVydGllcyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuRW51bV06IGxvY2FsaXplKCdlbnVtJywgXCJlbnVtZXJhdGlvbnMgKHswfSlcIiksXG5cdFtTeW1ib2xLaW5kLkVudW1NZW1iZXJdOiBsb2NhbGl6ZSgnZW51bU1lbWJlcicsIFwiZW51bWVyYXRpb24gbWVtYmVycyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuU3RyaW5nXTogbG9jYWxpemUoJ3N0cmluZycsIFwic3RyaW5ncyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuRmlsZV06IGxvY2FsaXplKCdmaWxlJywgXCJmaWxlcyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuQXJyYXldOiBsb2NhbGl6ZSgnYXJyYXknLCBcImFycmF5cyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuTnVtYmVyXTogbG9jYWxpemUoJ251bWJlcicsIFwibnVtYmVycyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuQm9vbGVhbl06IGxvY2FsaXplKCdib29sZWFuJywgXCJib29sZWFucyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuT2JqZWN0XTogbG9jYWxpemUoJ29iamVjdCcsIFwib2JqZWN0cyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuS2V5XTogbG9jYWxpemUoJ2tleScsIFwia2V5cyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuRmllbGRdOiBsb2NhbGl6ZSgnZmllbGQnLCBcImZpZWxkcyAoezB9KVwiKSxcblx0W1N5bWJvbEtpbmQuQ29uc3RhbnRdOiBsb2NhbGl6ZSgnY29uc3RhbnQnLCBcImNvbnN0YW50cyAoezB9KVwiKVxufTtcblxuLy8jZW5kcmVnaW9uXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUI7QUFFMUIsU0FBeUIsY0FBYyxjQUFjLG1CQUFtQjtBQUN4RSxTQUFTLFlBQVksaUJBQThCLG1CQUFtQixvQkFBb0I7QUFDMUYsU0FBUyxRQUFRLFlBQVk7QUFDN0IsU0FBaUIsYUFBYTtBQUM5QixTQUFTLGtCQUFrQjtBQUUzQixTQUF5QixZQUFZLGFBQWEsV0FBVyw2QkFBNkI7QUFDMUYsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxtREFBdUg7QUFDaEksU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyxnQkFBZ0I7QUF1QmxCLElBQWUsd0NBQWYsY0FBNkQsNENBQTRDO0FBQUEsRUFRL0csWUFDNEMsMEJBQ0osc0JBQ3ZDLFVBQWlELHVCQUFPLE9BQU8sSUFBSSxHQUNsRTtBQUNELFVBQU0sT0FBTztBQUo4QjtBQUNKO0FBS3ZDLFNBQUssVUFBVTtBQUNmLFNBQUssUUFBUSx3QkFBd0I7QUFBQSxFQUN0QztBQUFBLEVBRVUseUJBQXlCLFFBQW9GO0FBQ3RILFNBQUssaUJBQWlCLFFBQVEsU0FBUyxvQ0FBb0Msc0VBQXNFLENBQUM7QUFFbEosV0FBTyxXQUFXO0FBQUEsRUFDbkI7QUFBQSxFQUVVLHNCQUFzQixTQUF3QyxRQUF1RSxPQUEwQixZQUEwRDtBQUNsTyxVQUFNLFNBQVMsUUFBUTtBQUN2QixVQUFNLFFBQVEsS0FBSyxTQUFTLE1BQU07QUFDbEMsUUFBSSxDQUFDLE9BQU87QUFDWCxhQUFPLFdBQVc7QUFBQSxJQUNuQjtBQUdBLFFBQUksS0FBSyx5QkFBeUIsdUJBQXVCLElBQUksS0FBSyxHQUFHO0FBQ3BFLGFBQU8sS0FBSywyQkFB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
