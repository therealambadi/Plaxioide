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
import { $, append } from "../../../../../base/browser/dom.js";
import { DEFAULT_FONT_FAMILY } from "../../../../../base/browser/fonts.js";
import { Widget } from "../../../../../base/browser/ui/widget.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { HistoryNavigator } from "../../../../../base/common/history.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { mixin } from "../../../../../base/common/objects.js";
import { isMacintosh } from "../../../../../base/common/platform.js";
import { URI as uri } from "../../../../../base/common/uri.js";
import "./suggestEnabledInput.css";
import { EditorExtensionsRegistry } from "../../../../../editor/browser/editorExtensions.js";
import { CodeEditorWidget } from "../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ensureValidWordDefinition, getWordAtText } from "../../../../../editor/common/core/wordHelper.js";
import * as languages from "../../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ContextMenuController } from "../../../../../editor/contrib/contextmenu/browser/contextmenu.js";
import { SnippetController2 } from "../../../../../editor/contrib/snippet/browser/snippetController2.js";
import { SuggestController } from "../../../../../editor/contrib/suggest/browser/suggestController.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { registerAndCreateHistoryNavigationContext } from "../../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { asCssVariable, asCssVariableWithDefault, inputBackground, inputBorder, inputForeground, inputPlaceholderForeground } from "../../../../../platform/theme/common/colorRegistry.js";
import { MenuPreventer } from "../menuPreventer.js";
import { SelectionClipboardContributionID } from "../selectionClipboard.js";
import { getSimpleEditorOptions, setupSimpleEditorSelectionStyling } from "../simpleEditorOptions.js";
let SuggestEnabledInput = class extends Widget {
  constructor(id, parent, suggestionProvider, ariaLabel, resourceHandle, options, defaultInstantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
    super();
    this._onShouldFocusResults = new Emitter();
    this.onShouldFocusResults = this._onShouldFocusResults.event;
    this._onInputDidChange = new Emitter();
    this.onInputDidChange = this._onInputDidChange.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this.stylingContainer = append(parent, $(".suggest-input-container"));
    this.element = parent;
    this.placeholderText = append(this.stylingContainer, $(".suggest-input-placeholder", void 0, options.placeholderText || ""));
    const editorOptions = mixin(
      getSimpleEditorOptions(configurationService),
      getSuggestEnabledInputOptions(ariaLabel)
    );
    editorOptions.overflowWidgetsDomNode = options.overflowWidgetsDomNode;
    const scopedContextKeyService = this.getScopedContextKeyService(contextKeyService);
    const instantiationService = scopedContextKeyService ? this._register(defaultInstantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService]))) : defaultInstantiationService;
    this.inputWidget = this._register(instantiationService.createInstance(
      CodeEditorWidget,
      this.stylingContainer,
      editorOptions,
      {
        contributions: EditorExtensionsRegistry.getSomeEditorContributions([
          SuggestController.ID,
          SnippetController2.ID,
          ContextMenuController.ID,
          MenuPreventer.ID,
          SelectionClipboardContributionID
        ]),
        isSimpleWidget: true
      }
    ));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.accessibilitySupport") || e.affectsConfiguration("editor.cursorBlinking")) {
        const accessibilitySupport = configurationService.getValue("editor.accessibilitySupport");
        const cursorBlinking = configurationService.getValue("editor.cursorBlinking");
        this.inputWidget.updateOptions({
          accessibilitySupport,
          cursorBlinking
        });
      }
    }));
    this._register(this.inputWidget.onDidFocusEditorText(() => this._onDidFocus.fire()));
    this._register(this.inputWidget.onDidBlurEditorText(() => this._onDidBlur.fire()));
    const scopeHandle = uri.parse(resourceHandle);
    this.inputModel = modelService.createModel("", null, scopeHandle, true);
    this._register(this.inputModel);
    this.inputWidget.setModel(this.inputModel);
    this._register(this.inputWidget.onDidPaste(() => this.setValue(this.getValue())));
    this._register(this.inputWidget.onDidFocusEditorText(() => {
      if (options.focusContextKey) {
        options.focusContextKey.set(true);
      }
      this.stylingContainer.classList.add("synthetic-focus");
    }));
    this._register(this.inputWidget.onDidBlurEditorText(() => {
      if (options.focusContextKey) {
        options.focusContextKey.set(false);
      }
      this.stylingContainer.classList.remove("synthetic-focus");
    }));
    this._register(Event.chain(this.inputWidget.onKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.Enter))((e) => {
      e.preventDefault();
    }, this));
    this._register(Event.chain(this.inputWidget.onKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.DownArrow && (isMacintosh ? e.metaKey : e.ctrlKey)))(() => this._onShouldFocusResults.fire(), this));
    let preexistingContent = this.getValue();
    const inputWidgetModel = this.inputWidget.getModel();
    if (inputWidgetModel) {
      this._register(inputWidgetModel.onDidChangeContent(() => {
        const content = this.getValue();
        this.placeholderText.style.visibility = content ? "hidden" : "visible";
        if (preexistingContent.trim() === content.trim()) {
          return;
        }
        this._onInputDidChange.fire(void 0);
        preexistingContent = content;
      }));
    }
    const validatedSuggestProvider = {
      provideResults: suggestionProvider.provideResults,
      sortKey: suggestionProvider.sortKey || ((a) => a),
      triggerCharacters: suggestionProvider.triggerCharacters || [],
      wordDefinition: suggestionProvider.wordDefinition ? ensureValidWordDefinition(suggestionProvider.wordDefinition) : void 0,
      alwaysShowSuggestions: !!suggestionProvider.alwaysShowSuggestions
    };
    this.setValue(options.value || "");
    this._register(languageFeaturesService.completionProvider.register({ scheme: scopeHandle.scheme, pattern: "**/" + scopeHandle.path, hasAccessToAllModels: true }, {
      _debugDisplayName: `suggestEnabledInput/${id}`,
      triggerCharacters: validatedSuggestProvider.triggerCharacters,
      provideCompletionItems: (model, position, _context) => {
        const query = model.getValue();
        const zeroIndexedColumn = position.column - 1;
        let alreadyTypedCount = 0, zeroIndexedWordStart = 0;
        if (validatedSuggestProvider.wordDefinition) {
          const wordAtText = getWordAtText(position.column, validatedSuggestProvider.wordDefinition, query, 0);
          alreadyTypedCount = wordAtText?.word.length ?? 0;
          zeroIndexedWordStart = wordAtText ? wordAtText.startColumn - 1 : 0;
        } else {
          zeroIndexedWordStart = query.lastIndexOf(" ", zeroIndexedColumn - 1) + 1;
          alreadyTypedCount = zeroIndexedColumn - zeroIndexedWordStart;
        }
        if (!validatedSuggestProvider.alwaysShowSuggestions && alreadyTypedCount > 0 && validatedSuggestProvider.triggerCharacters?.indexOf(query[zeroIndexedWordStart]) === -1) {
          return { suggestions: [] };
        }
        return {
          suggestions: suggestionProvider.provideResults(query).map((result) => {
            let label;
            let rest;
            if (typeof result === "string") {
              label = result;
            } else {
              label = result.label;
              rest = result;
            }
            return {
              label,
              insertText: label,
              range: Range.fromPositions(position.delta(0, -alreadyTypedCount), position),
              sortText: validatedSuggestProvider.sortKey(label),
              kind: languages.CompletionItemKind.Keyword,
              ...rest
            };
          })
        };
      }
    }));
    this.style(options.styleOverrides || {});
  }
  getScopedContextKeyService(_contextKeyService) {
    return void 0;
  }
  updateAriaLabel(label) {
    this.inputWidget.updateOptions({ ariaLabel: label });
  }
  setValue(val) {
    val = val.replace(/\s/g, " ");
    const fullRange = this.inputModel.getFullModelRange();
    this.inputWidget.executeEdits("suggestEnabledInput.setValue", [EditOperation.replace(fullRange, val)]);
    this.inputWidget.setScrollTop(0);
    this.inputWidget.setPosition(new Position(1, val.length + 1));
  }
  getValue() {
    return this.inputWidget.getValue();
  }
  style(styleOverrides) {
    this.stylingContainer.style.backgroundColor = asCssVariable(styleOverrides.inputBackground ?? inputBackground);
    this.stylingContainer.style.color = asCssVariable(styleOverrides.inputForeground ?? inputForeground);
    this.placeholderText.style.color = asCssVariable(styleOverrides.inputPlaceholderForeground ?? inputPlaceholderForeground);
    this.stylingContainer.style.borderWidth = "1px";
    this.stylingContainer.style.borderStyle = "solid";
    this.stylingContainer.style.borderColor = asCssVariableWithDefault(styleOverrides.inputBorder ?? inputBorder, "transparent");
    const cursor = this.stylingContainer.getElementsByClassName("cursor")[0];
    if (cursor) {
      cursor.style.backgroundColor = asCssVariable(styleOverrides.inputForeground ?? inputForeground);
    }
  }
  focus(selectAll) {
    this.inputWidget.focus();
    if (selectAll && this.inputWidget.getValue()) {
      this.selectAll();
    }
  }
  onHide() {
    this.inputWidget.onHide();
  }
  layout(dimension) {
    this.inputWidget.layout(dimension);
    this.placeholderText.style.width = `${dimension.width - 2}px`;
  }
  selectAll() {
    this.inputWidget.setSelection(new Range(1, 1, 1, this.getValue().length + 1));
  }
};
SuggestEnabledInput = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IModelService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, ILanguageFeaturesService),
  __decorateParam(10, IConfigurationService)
], SuggestEnabledInput);
let SuggestEnabledInputWithHistory = class extends SuggestEnabledInput {
  constructor({ id, parent, ariaLabel, suggestionProvider, resourceHandle, suggestOptions, history }, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
    super(id, parent, suggestionProvider, ariaLabel, resourceHandle, suggestOptions, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService);
    this.history = this._register(new HistoryNavigator(new Set(history), 100));
  }
  addToHistory() {
    const value = this.getValue();
    if (value && value !== this.getCurrentValue()) {
      this.history.add(value);
    }
  }
  getHistory() {
    return this.history.getHistory();
  }
  showNextValue() {
    if (!this.history.has(this.getValue())) {
      this.addToHistory();
    }
    let next = this.getNextValue();
    if (next) {
      next = next === this.getValue() ? this.getNextValue() : next;
    }
    this.setValue(next ?? "");
  }
  showPreviousValue() {
    if (!this.history.has(this.getValue())) {
      this.addToHistory();
    }
    let previous = this.getPreviousValue();
    if (previous) {
      previous = previous === this.getValue() ? this.getPreviousValue() : previous;
    }
    if (previous) {
      this.setValue(previous);
      this.inputWidget.setPosition({ lineNumber: 0, column: 0 });
    }
  }
  clearHistory() {
    this.history.clear();
  }
  getCurrentValue() {
    let currentValue = this.history.current();
    if (!currentValue) {
      currentValue = this.history.last();
      this.history.next();
    }
    return currentValue;
  }
  getPreviousValue() {
    return this.history.previous() || this.history.first();
  }
  getNextValue() {
    return this.history.next();
  }
};
SuggestEnabledInputWithHistory = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IModelService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IConfigurationService)
], SuggestEnabledInputWithHistory);
let ContextScopedSuggestEnabledInputWithHistory = class extends SuggestEnabledInputWithHistory {
  constructor(options, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
    super(options, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService);
    const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this.historyContext;
    this._register(this.inputWidget.onDidChangeCursorPosition(({ position }) => {
      const viewModel = this.inputWidget._getViewModel();
      const lastLineNumber = viewModel.getLineCount();
      const lastLineCol = viewModel.getLineLength(lastLineNumber) + 1;
      const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(position);
      historyNavigationBackwardsEnablement.set(viewPosition.lineNumber === 1 && viewPosition.column === 1);
      historyNavigationForwardsEnablement.set(viewPosition.lineNumber === lastLineNumber && viewPosition.column === lastLineCol);
    }));
  }
  getScopedContextKeyService(contextKeyService) {
    const scopedContextKeyService = this._register(contextKeyService.createScoped(this.element));
    this.historyContext = this._register(registerAndCreateHistoryNavigationContext(
      scopedContextKeyService,
      this
    ));
    return scopedContextKeyService;
  }
};
ContextScopedSuggestEnabledInputWithHistory = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IModelService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IConfigurationService)
], ContextScopedSuggestEnabledInputWithHistory);
setupSimpleEditorSelectionStyling(".suggest-input-container");
function getSuggestEnabledInputOptions(ariaLabel) {
  return {
    fontSize: 13,
    lineHeight: 20,
    wordWrap: "off",
    scrollbar: { vertical: "hidden" },
    roundedSelection: false,
    guides: {
      indentation: false
    },
    cursorWidth: 1,
    fontFamily: DEFAULT_FONT_FAMILY,
    ariaLabel: ariaLabel || "",
    snippetSuggestions: "none",
    suggest: { filterGraceful: false, showIcons: false },
    autoClosingBrackets: "never"
  };
}
export {
  ContextScopedSuggestEnabledInputWithHistory,
  SuggestEnabledInput,
  SuggestEnabledInputWithHistory
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvc3VnZ2VzdEVuYWJsZWRJbnB1dC9zdWdnZXN0RW5hYmxlZElucHV0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgJCwgRGltZW5zaW9uLCBhcHBlbmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IERFRkFVTFRfRk9OVF9GQU1JTFkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZm9udHMuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlOYXZpZ2F0aW9uV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2hpc3RvcnkuanMnO1xuaW1wb3J0IHsgV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3dpZGdldC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEhpc3RvcnlOYXZpZ2F0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBtaXhpbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAnLi9zdWdnZXN0RW5hYmxlZElucHV0LmNzcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29uc3RydWN0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2NvbmZpZy9lZGl0b3JDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVWYWxpZFdvcmREZWZpbml0aW9uLCBnZXRXb3JkQXRUZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3dvcmRIZWxwZXIuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBDb250ZXh0TWVudUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb250ZXh0bWVudS9icm93c2VyL2NvbnRleHRtZW51LmpzJztcbmltcG9ydCB7IFNuaXBwZXRDb250cm9sbGVyMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3NuaXBwZXQvYnJvd3Nlci9zbmlwcGV0Q29udHJvbGxlcjIuanMnO1xuaW1wb3J0IHsgU3VnZ2VzdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSGlzdG9yeU5hdmlnYXRpb25Db250ZXh0LCByZWdpc3RlckFuZENyZWF0ZUhpc3RvcnlOYXZpZ2F0aW9uQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hpc3RvcnkvYnJvd3Nlci9jb250ZXh0U2NvcGVkSGlzdG9yeVdpZGdldC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgQ29sb3JJZGVudGlmaWVyLCBhc0Nzc1ZhcmlhYmxlLCBhc0Nzc1ZhcmlhYmxlV2l0aERlZmF1bHQsIGlucHV0QmFja2dyb3VuZCwgaW5wdXRCb3JkZXIsIGlucHV0Rm9yZWdyb3VuZCwgaW5wdXRQbGFjZWhvbGRlckZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBNZW51UHJldmVudGVyIH0gZnJvbSAnLi4vbWVudVByZXZlbnRlci5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb25DbGlwYm9hcmRDb250cmlidXRpb25JRCB9IGZyb20gJy4uL3NlbGVjdGlvbkNsaXBib2FyZC5qcyc7XG5pbXBvcnQgeyBnZXRTaW1wbGVFZGl0b3JPcHRpb25zLCBzZXR1cFNpbXBsZUVkaXRvclNlbGVjdGlvblN0eWxpbmcgfSBmcm9tICcuLi9zaW1wbGVFZGl0b3JPcHRpb25zLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBTdWdnZXN0UmVzdWx0c1Byb3ZpZGVyIHtcblx0LyoqXG5cdCAqIFByb3ZpZGVyIGZ1bmN0aW9uIGZvciBzdWdnZXN0aW9uIHJlc3VsdHMuXG5cdCAqXG5cdCAqIEBwYXJhbSBxdWVyeSB0aGUgZnVsbCB0ZXh0IG9mIHRoZSBpbnB1dC5cblx0ICovXG5cdHByb3ZpZGVSZXN1bHRzOiAocXVlcnk6IHN0cmluZykgPT4gKFBhcnRpYWw8bGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtPiAmICh7IGxhYmVsOiBzdHJpbmcgfSkgfCBzdHJpbmcpW107XG5cblx0LyoqXG5cdCAqIFRyaWdnZXIgY2hhcmFjdGVycyBmb3IgdGhpcyBpbnB1dC4gU3VnZ2VzdGlvbnMgd2lsbCBhcHBlYXIgd2hlbiBvbmUgb2YgdGhlc2UgaXMgdHlwZWQsXG5cdCAqIG9yIHVwb24gYGN0cmwrc3BhY2VgIHRyaWdnZXJpbmcgYXQgYSB3b3JkIGJvdW5kYXJ5LlxuXHQgKlxuXHQgKiBEZWZhdWx0cyB0byB0aGUgZW1wdHkgYXJyYXkuXG5cdCAqL1xuXHR0cmlnZ2VyQ2hhcmFjdGVycz86IHN0cmluZ1tdO1xuXG5cdC8qKlxuXHQgKiBPcHRpb25hbCByZWd1bGFyIGV4cHJlc3Npb24gdGhhdCBkZXNjcmliZXMgd2hhdCBhIHdvcmQgaXNcblx0ICpcblx0ICogRGVmYXVsdHMgdG8gc3BhY2Ugc2VwYXJhdGVkIHdvcmRzLlxuXHQgKi9cblx0d29yZERlZmluaXRpb24/OiBSZWdFeHA7XG5cblx0LyoqXG5cdCAqIFNob3cgc3VnZ2VzdGlvbnMgZXZlbiBpZiB0aGUgdHJpZ2dlciBjaGFyYWN0ZXIgaXMgbm90IHByZXNlbnQuXG5cdCAqXG5cdCAqIERlZmF1bHRzIHRvIGZhbHNlLlxuXHQgKi9cblx0YWx3YXlzU2hvd1N1Z2dlc3Rpb25zPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogRGVmaW5lcyB0aGUgc29ydGluZyBmdW5jdGlvbiB1c2VkIHdoZW4gc2hvd2luZyByZXN1bHRzLlxuXHQgKlxuXHQgKiBEZWZhdWx0cyB0byB0aGUgaWRlbnRpdHkgZnVuY3Rpb24uXG5cdCAqL1xuXHRzb3J0S2V5PzogKHJlc3VsdDogc3RyaW5nKSA9PiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTdWdnZXN0RW5hYmxlZElucHV0T3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBUaGUgdGV4dCB0byBzaG93IHdoZW4gbm8gaW5wdXQgaXMgcHJlc2VudC5cblx0ICpcblx0ICogRGVmYXVsdHMgdG8gdGhlIGVtcHR5IHN0cmluZy5cblx0ICovXG5cdHBsYWNlaG9sZGVyVGV4dD86IHN0cmluZztcblxuXHQvKipcblx0ICogSW5pdGlhbCB2YWx1ZSB0byBiZSBzaG93blxuXHQgKi9cblx0dmFsdWU/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIENvbnRleHQga2V5IHRyYWNraW5nIHRoZSBmb2N1cyBzdGF0ZSBvZiB0aGlzIGVsZW1lbnRcblx0ICovXG5cdGZvY3VzQ29udGV4dEtleT86IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdC8qKlxuXHQgKiBQbGFjZSBvdmVyZmxvdyB3aWRnZXRzIGluc2lkZSBhbiBleHRlcm5hbCBET00gbm9kZS5cblx0ICogRGVmYXVsdHMgdG8gYW4gaW50ZXJuYWwgRE9NIG5vZGUuXG5cdCAqL1xuXHRvdmVyZmxvd1dpZGdldHNEb21Ob2RlPzogSFRNTEVsZW1lbnQ7XG5cblx0LyoqXG5cdCAqIE92ZXJyaWRlIHRoZSBkZWZhdWx0IHN0eWxpbmcgb2YgdGhlIGlucHV0LlxuXHQgKi9cblx0c3R5bGVPdmVycmlkZXM/OiBJU3VnZ2VzdEVuYWJsZWRJbnB1dFN0eWxlT3ZlcnJpZGVzO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTdWdnZXN0RW5hYmxlZElucHV0U3R5bGVPdmVycmlkZXMge1xuXHRpbnB1dEJhY2tncm91bmQ/OiBDb2xvcklkZW50aWZpZXI7XG5cdGlucHV0Rm9yZWdyb3VuZD86IENvbG9ySWRlbnRpZmllcjtcblx0aW5wdXRCb3JkZXI/OiBDb2xvcklkZW50aWZpZXI7XG5cdGlucHV0UGxhY2Vob2xkZXJGb3JlZ3JvdW5kPzogQ29sb3JJZGVudGlmaWVyO1xufVxuXG5leHBvcnQgY2xhc3MgU3VnZ2VzdEVuYWJsZWRJbnB1dCBleHRlbmRzIFdpZGdldCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25TaG91bGRGb2N1c1Jlc3VsdHMgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvblNob3VsZEZvY3VzUmVzdWx0czogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vblNob3VsZEZvY3VzUmVzdWx0cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbklucHV0RGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8c3RyaW5nIHwgdW5kZWZpbmVkPigpO1xuXHRyZWFkb25seSBvbklucHV0RGlkQ2hhbmdlOiBFdmVudDxzdHJpbmcgfCB1bmRlZmluZWQ+ID0gdGhpcy5fb25JbnB1dERpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXMgPSB0aGlzLl9vbkRpZEZvY3VzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQmx1ciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEJsdXIgPSB0aGlzLl9vbkRpZEJsdXIuZXZlbnQ7XG5cblx0cmVhZG9ubHkgaW5wdXRXaWRnZXQ6IENvZGVFZGl0b3JXaWRnZXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5wdXRNb2RlbDogSVRleHRNb2RlbDtcblx0cHJvdGVjdGVkIHN0eWxpbmdDb250YWluZXI6IEhUTUxEaXZFbGVtZW50O1xuXHRyZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBwbGFjZWhvbGRlclRleHQ6IEhUTUxEaXZFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0cGFyZW50OiBIVE1MRWxlbWVudCxcblx0XHRzdWdnZXN0aW9uUHJvdmlkZXI6IFN1Z2dlc3RSZXN1bHRzUHJvdmlkZXIsXG5cdFx0YXJpYUxhYmVsOiBzdHJpbmcsXG5cdFx0cmVzb3VyY2VIYW5kbGU6IHN0cmluZyxcblx0XHRvcHRpb25zOiBTdWdnZXN0RW5hYmxlZElucHV0T3B0aW9ucyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGRlZmF1bHRJbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5zdHlsaW5nQ29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnN1Z2dlc3QtaW5wdXQtY29udGFpbmVyJykpO1xuXHRcdHRoaXMuZWxlbWVudCA9IHBhcmVudDtcblx0XHR0aGlzLnBsYWNlaG9sZGVyVGV4dCA9IGFwcGVuZCh0aGlzLnN0eWxpbmdDb250YWluZXIsICQoJy5zdWdnZXN0LWlucHV0LXBsYWNlaG9sZGVyJywgdW5kZWZpbmVkLCBvcHRpb25zLnBsYWNlaG9sZGVyVGV4dCB8fCAnJykpO1xuXG5cdFx0Y29uc3QgZWRpdG9yT3B0aW9uczogSUVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMgPSBtaXhpbihcblx0XHRcdGdldFNpbXBsZUVkaXRvck9wdGlvbnMoY29uZmlndXJhdGlvblNlcnZpY2UpLFxuXHRcdFx0Z2V0U3VnZ2VzdEVuYWJsZWRJbnB1dE9wdGlvbnMoYXJpYUxhYmVsKSk7XG5cdFx0ZWRpdG9yT3B0aW9ucy5vdmVyZmxvd1dpZGdldHNEb21Ob2RlID0gb3B0aW9ucy5vdmVyZmxvd1dpZGdldHNEb21Ob2RlO1xuXG5cdFx0Y29uc3Qgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSB0aGlzLmdldFNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc2NvcGVkQ29udGV4dEtleVNlcnZpY2Vcblx0XHRcdD8gdGhpcy5fcmVnaXN0ZXIoZGVmYXVsdEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBzY29wZWRDb250ZXh0S2V5U2VydmljZV0pKSlcblx0XHRcdDogZGVmYXVsdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdFx0dGhpcy5pbnB1dFdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVFZGl0b3JXaWRnZXQsIHRoaXMuc3R5bGluZ0NvbnRhaW5lcixcblx0XHRcdGVkaXRvck9wdGlvbnMsXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnRyaWJ1dGlvbnM6IEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRTb21lRWRpdG9yQ29udHJpYnV0aW9ucyhbXG5cdFx0XHRcdFx0U3VnZ2VzdENvbnRyb2xsZXIuSUQsXG5cdFx0XHRcdFx0U25pcHBldENvbnRyb2xsZXIyLklELFxuXHRcdFx0XHRcdENvbnRleHRNZW51Q29udHJvbGxlci5JRCxcblx0XHRcdFx0XHRNZW51UHJldmVudGVyLklELFxuXHRcdFx0XHRcdFNlbGVjdGlvbkNsaXBib2FyZENvbnRyaWJ1dGlvbklELFxuXHRcdFx0XHRdKSxcblx0XHRcdFx0aXNTaW1wbGVXaWRnZXQ6IHRydWUsXG5cdFx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKGUpID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuYWNjZXNzaWJpbGl0eVN1cHBvcnQnKSB8fFxuXHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuY3Vyc29yQmxpbmtpbmcnKSkge1xuXHRcdFx0XHRjb25zdCBhY2Nlc3NpYmlsaXR5U3VwcG9ydCA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdhdXRvJyB8ICdvZmYnIHwgJ29uJz4oJ2VkaXRvci5hY2Nlc3NpYmlsaXR5U3VwcG9ydCcpO1xuXHRcdFx0XHRjb25zdCBjdXJzb3JCbGlua2luZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdibGluaycgfCAnc21vb3RoJyB8ICdwaGFzZScgfCAnZXhwYW5kJyB8ICdzb2xpZCc+KCdlZGl0b3IuY3Vyc29yQmxpbmtpbmcnKTtcblx0XHRcdFx0dGhpcy5pbnB1dFdpZGdldC51cGRhdGVPcHRpb25zKHtcblx0XHRcdFx0XHRhY2Nlc3NpYmlsaXR5U3VwcG9ydCxcblx0XHRcdFx0XHRjdXJzb3JCbGlua2luZ1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0V2lkZ2V0Lm9uRGlkRm9jdXNFZGl0b3JUZXh0KCgpID0+IHRoaXMuX29uRGlkRm9jdXMuZmlyZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dFdpZGdldC5vbkRpZEJsdXJFZGl0b3JUZXh0KCgpID0+IHRoaXMuX29uRGlkQmx1ci5maXJlKCkpKTtcblxuXHRcdGNvbnN0IHNjb3BlSGFuZGxlID0gdXJpLnBhcnNlKHJlc291cmNlSGFuZGxlKTtcblx0XHR0aGlzLmlucHV0TW9kZWwgPSBtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJycsIG51bGwsIHNjb3BlSGFuZGxlLCB0cnVlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0TW9kZWwpO1xuXHRcdHRoaXMuaW5wdXRXaWRnZXQuc2V0TW9kZWwodGhpcy5pbnB1dE1vZGVsKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5wdXRXaWRnZXQub25EaWRQYXN0ZSgoKSA9PiB0aGlzLnNldFZhbHVlKHRoaXMuZ2V0VmFsdWUoKSkpKTsgLy8gc2V0dGVyIGNsZWFuc2VzXG5cblx0XHR0aGlzLl9yZWdpc3RlcigodGhpcy5pbnB1dFdpZGdldC5vbkRpZEZvY3VzRWRpdG9yVGV4dCgoKSA9PiB7XG5cdFx0XHRpZiAob3B0aW9ucy5mb2N1c0NvbnRleHRLZXkpIHsgb3B0aW9ucy5mb2N1c0NvbnRleHRLZXkuc2V0KHRydWUpOyB9XG5cdFx0XHR0aGlzLnN0eWxpbmdDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnc3ludGhldGljLWZvY3VzJyk7XG5cdFx0fSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcigodGhpcy5pbnB1dFdpZGdldC5vbkRpZEJsdXJFZGl0b3JUZXh0KCgpID0+IHtcblx0XHRcdGlmIChvcHRpb25zLmZvY3VzQ29udGV4dEtleSkgeyBvcHRpb25zLmZvY3VzQ29udGV4dEtleS5zZXQoZmFsc2UpOyB9XG5cdFx0XHR0aGlzLnN0eWxpbmdDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnc3ludGhldGljLWZvY3VzJyk7XG5cdFx0fSkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmNoYWluKHRoaXMuaW5wdXRXaWRnZXQub25LZXlEb3duLCAkID0+ICQuZmlsdGVyKGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLkVudGVyKSkoZSA9PiB7IGUucHJldmVudERlZmF1bHQoKTsgLyoqIERvIG5vdGhpbmcuIEVudGVyIGNhdXNlcyBuZXcgbGluZSB3aGljaCBpcyBub3QgZXhwZWN0ZWQuICovIH0sIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5jaGFpbih0aGlzLmlucHV0V2lkZ2V0Lm9uS2V5RG93biwgJCA9PiAkLmZpbHRlcihlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5Eb3duQXJyb3cgJiYgKGlzTWFjaW50b3NoID8gZS5tZXRhS2V5IDogZS5jdHJsS2V5KSkpKCgpID0+IHRoaXMuX29uU2hvdWxkRm9jdXNSZXN1bHRzLmZpcmUoKSwgdGhpcykpO1xuXG5cdFx0bGV0IHByZWV4aXN0aW5nQ29udGVudCA9IHRoaXMuZ2V0VmFsdWUoKTtcblx0XHRjb25zdCBpbnB1dFdpZGdldE1vZGVsID0gdGhpcy5pbnB1dFdpZGdldC5nZXRNb2RlbCgpO1xuXHRcdGlmIChpbnB1dFdpZGdldE1vZGVsKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihpbnB1dFdpZGdldE1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSB0aGlzLmdldFZhbHVlKCk7XG5cdFx0XHRcdHRoaXMucGxhY2Vob2xkZXJUZXh0LnN0eWxlLnZpc2liaWxpdHkgPSBjb250ZW50ID8gJ2hpZGRlbicgOiAndmlzaWJsZSc7XG5cdFx0XHRcdGlmIChwcmVleGlzdGluZ0NvbnRlbnQudHJpbSgpID09PSBjb250ZW50LnRyaW0oKSkgeyByZXR1cm47IH1cblx0XHRcdFx0dGhpcy5fb25JbnB1dERpZENoYW5nZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdHByZWV4aXN0aW5nQ29udGVudCA9IGNvbnRlbnQ7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmFsaWRhdGVkU3VnZ2VzdFByb3ZpZGVyID0ge1xuXHRcdFx0cHJvdmlkZVJlc3VsdHM6IHN1Z2dlc3Rpb25Qcm92aWRlci5wcm92aWRlUmVzdWx0cyxcblx0XHRcdHNvcnRLZXk6IHN1Z2dlc3Rpb25Qcm92aWRlci5zb3J0S2V5IHx8IChhID0+IGEpLFxuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IHN1Z2dlc3Rpb25Qcm92aWRlci50cmlnZ2VyQ2hhcmFjdGVycyB8fCBbXSxcblx0XHRcdHdvcmREZWZpbml0aW9uOiBzdWdnZXN0aW9uUHJvdmlkZXIud29yZERlZmluaXRpb24gPyBlbnN1cmVWYWxpZFdvcmREZWZpbml0aW9uKHN1Z2dlc3Rpb25Qcm92aWRlci53b3JkRGVmaW5pdGlvbikgOiB1bmRlZmluZWQsXG5cdFx0XHRhbHdheXNTaG93U3VnZ2VzdGlvbnM6ICEhc3VnZ2VzdGlvblByb3ZpZGVyLmFsd2F5c1Nob3dTdWdnZXN0aW9ucyxcblx0XHR9O1xuXG5cdFx0dGhpcy5zZXRWYWx1ZShvcHRpb25zLnZhbHVlIHx8ICcnKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3Rlcih7IHNjaGVtZTogc2NvcGVIYW5kbGUuc2NoZW1lLCBwYXR0ZXJuOiAnKiovJyArIHNjb3BlSGFuZGxlLnBhdGgsIGhhc0FjY2Vzc1RvQWxsTW9kZWxzOiB0cnVlIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiBgc3VnZ2VzdEVuYWJsZWRJbnB1dC8ke2lkfWAsXG5cdFx0XHR0cmlnZ2VyQ2hhcmFjdGVyczogdmFsaWRhdGVkU3VnZ2VzdFByb3ZpZGVyLnRyaWdnZXJDaGFyYWN0ZXJzLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtczogKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIF9jb250ZXh0OiBsYW5ndWFnZXMuQ29tcGxldGlvbkNvbnRleHQpID0+IHtcblx0XHRcdFx0Y29uc3QgcXVlcnkgPSBtb2RlbC5nZXRWYWx1ZSgpO1xuXG5cdFx0XHRcdGNvbnN0IHplcm9JbmRleGVkQ29sdW1uID0gcG9zaXRpb24uY29sdW1uIC0gMTtcblx0XHRcdFx0bGV0IGFscmVhZHlUeXBlZENvdW50ID0gMCwgemVyb0luZGV4ZWRXb3JkU3RhcnQgPSAwO1xuXG5cdFx0XHRcdGlmICh2YWxpZGF0ZWRTdWdnZXN0UHJvdmlkZXIud29yZERlZmluaXRpb24pIHtcblx0XHRcdFx0XHRjb25zdCB3b3JkQXRUZXh0ID0gZ2V0V29yZEF0VGV4dChwb3NpdGlvbi5jb2x1bW4sIHZhbGlkYXRlZFN1Z2dlc3RQcm92aWRlci53b3JkRGVmaW5pdGlvbiwgcXVlcnksIDApO1xuXHRcdFx0XHRcdGFscmVhZHlUeXBlZENvdW50ID0gd29yZEF0VGV4dD8ud29yZC5sZW5ndGggPz8gMDtcblx0XHRcdFx0XHR6ZXJvSW5kZXhlZFdvcmRTdGFydCA9IHdvcmRBdFRleHQgPyB3b3JkQXRUZXh0LnN0YXJ0Q29sdW1uIC0gMSA6IDA7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0emVyb0luZGV4ZWRXb3JkU3RhcnQgPSBxdWVyeS5sYXN0SW5kZXhPZignICcsIHplcm9JbmRleGVkQ29sdW1uIC0gMSkgKyAxO1xuXHRcdFx0XHRcdGFscmVhZHlUeXBlZENvdW50ID0gemVyb0luZGV4ZWRDb2x1bW4gLSB6ZXJvSW5kZXhlZFdvcmRTdGFydDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGRvbnQgc2hvdyBzdWdnZXN0aW9ucyBpZiB0aGUgdXNlciBoYXMgdHlwZWQgc29tZXRoaW5nLCBidXQgaGFzbid0IHVzZWQgdGhlIHRyaWdnZXIgY2hhcmFjdGVyXG5cdFx0XHRcdGlmICghdmFsaWRhdGVkU3VnZ2VzdFByb3ZpZGVyLmFsd2F5c1Nob3dTdWdnZXN0aW9ucyAmJiBhbHJlYWR5VHlwZWRDb3VudCA+IDAgJiYgdmFsaWRhdGVkU3VnZ2VzdFByb3ZpZGVyLnRyaWdnZXJDaGFyYWN0ZXJzPy5pbmRleE9mKHF1ZXJ5W3plcm9JbmRleGVkV29yZFN0YXJ0XSkgPT09IC0xKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc3VnZ2VzdGlvbnM6IFtdIH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBzdWdnZXN0aW9uUHJvdmlkZXIucHJvdmlkZVJlc3VsdHMocXVlcnkpLm1hcCgocmVzdWx0KTogbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtID0+IHtcblx0XHRcdFx0XHRcdGxldCBsYWJlbDogc3RyaW5nO1xuXHRcdFx0XHRcdFx0bGV0IHJlc3Q6IFBhcnRpYWw8bGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtPiB8IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcmVzdWx0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0XHRsYWJlbCA9IHJlc3VsdDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGxhYmVsID0gcmVzdWx0LmxhYmVsO1xuXHRcdFx0XHRcdFx0XHRyZXN0ID0gcmVzdWx0O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogbGFiZWwsXG5cdFx0XHRcdFx0XHRcdHJhbmdlOiBSYW5nZS5mcm9tUG9zaXRpb25zKHBvc2l0aW9uLmRlbHRhKDAsIC1hbHJlYWR5VHlwZWRDb3VudCksIHBvc2l0aW9uKSxcblx0XHRcdFx0XHRcdFx0c29ydFRleHQ6IHZhbGlkYXRlZFN1Z2dlc3RQcm92aWRlci5zb3J0S2V5KGxhYmVsKSxcblx0XHRcdFx0XHRcdFx0a2luZDogbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5LZXl3b3JkLFxuXHRcdFx0XHRcdFx0XHQuLi5yZXN0XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5zdHlsZShvcHRpb25zLnN0eWxlT3ZlcnJpZGVzIHx8IHt9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRTY29wZWRDb250ZXh0S2V5U2VydmljZShfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSk6IElDb250ZXh0S2V5U2VydmljZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVBcmlhTGFiZWwobGFiZWw6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXRXaWRnZXQudXBkYXRlT3B0aW9ucyh7IGFyaWFMYWJlbDogbGFiZWwgfSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0VmFsdWUodmFsOiBzdHJpbmcpIHtcblx0XHR2YWwgPSB2YWwucmVwbGFjZSgvXFxzL2csICcgJyk7XG5cdFx0Y29uc3QgZnVsbFJhbmdlID0gdGhpcy5pbnB1dE1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCk7XG5cdFx0dGhpcy5pbnB1dFdpZGdldC5leGVjdXRlRWRpdHMoJ3N1Z2dlc3RFbmFibGVkSW5wdXQuc2V0VmFsdWUnLCBbRWRpdE9wZXJhdGlvbi5yZXBsYWNlKGZ1bGxSYW5nZSwgdmFsKV0pO1xuXHRcdHRoaXMuaW5wdXRXaWRnZXQuc2V0U2Nyb2xsVG9wKDApO1xuXHRcdHRoaXMuaW5wdXRXaWRnZXQuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIHZhbC5sZW5ndGggKyAxKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5pbnB1dFdpZGdldC5nZXRWYWx1ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdHlsZShzdHlsZU92ZXJyaWRlczogSVN1Z2dlc3RFbmFibGVkSW5wdXRTdHlsZU92ZXJyaWRlcyk6IHZvaWQge1xuXHRcdHRoaXMuc3R5bGluZ0NvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBhc0Nzc1ZhcmlhYmxlKHN0eWxlT3ZlcnJpZGVzLmlucHV0QmFja2dyb3VuZCA/PyBpbnB1dEJhY2tncm91bmQpO1xuXHRcdHRoaXMuc3R5bGluZ0NvbnRhaW5lci5zdHlsZS5jb2xvciA9IGFzQ3NzVmFyaWFibGUoc3R5bGVPdmVycmlkZXMuaW5wdXRGb3JlZ3JvdW5kID8/IGlucHV0Rm9yZWdyb3VuZCk7XG5cdFx0dGhpcy5wbGFjZWhvbGRlclRleHQuc3R5bGUuY29sb3IgPSBhc0Nzc1ZhcmlhYmxlKHN0eWxlT3ZlcnJpZGVzLmlucHV0UGxhY2Vob2xkZXJGb3JlZ3JvdW5kID8/IGlucHV0UGxhY2Vob2xkZXJGb3JlZ3JvdW5kKTtcblx0XHR0aGlzLnN0eWxpbmdDb250YWluZXIuc3R5bGUuYm9yZGVyV2lkdGggPSAnMXB4Jztcblx0XHR0aGlzLnN0eWxpbmdDb250YWluZXIuc3R5bGUuYm9yZGVyU3R5bGUgPSAnc29saWQnO1xuXHRcdHRoaXMuc3R5bGluZ0NvbnRhaW5lci5zdHlsZS5ib3JkZXJDb2xvciA9IGFzQ3NzVmFyaWFibGVXaXRoRGVmYXVsdChzdHlsZU92ZXJyaWRlcy5pbnB1dEJvcmRlciA/PyBpbnB1dEJvcmRlciwgJ3RyYW5zcGFyZW50Jyk7XG5cblx0XHRjb25zdCBjdXJzb3IgPSB0aGlzLnN0eWxpbmdDb250YWluZXIuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnY3Vyc29yJylbMF0gYXMgSFRNTERpdkVsZW1lbnQ7XG5cdFx0aWYgKGN1cnNvcikge1xuXHRcdFx0Y3Vyc29yLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGFzQ3NzVmFyaWFibGUoc3R5bGVPdmVycmlkZXMuaW5wdXRGb3JlZ3JvdW5kID8/IGlucHV0Rm9yZWdyb3VuZCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGZvY3VzKHNlbGVjdEFsbD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmlucHV0V2lkZ2V0LmZvY3VzKCk7XG5cblx0XHRpZiAoc2VsZWN0QWxsICYmIHRoaXMuaW5wdXRXaWRnZXQuZ2V0VmFsdWUoKSkge1xuXHRcdFx0dGhpcy5zZWxlY3RBbGwoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb25IaWRlKCk6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXRXaWRnZXQub25IaWRlKCk7XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0KGRpbWVuc2lvbjogRGltZW5zaW9uKTogdm9pZCB7XG5cdFx0dGhpcy5pbnB1dFdpZGdldC5sYXlvdXQoZGltZW5zaW9uKTtcblx0XHR0aGlzLnBsYWNlaG9sZGVyVGV4dC5zdHlsZS53aWR0aCA9IGAke2RpbWVuc2lvbi53aWR0aCAtIDJ9cHhgO1xuXHR9XG5cblx0cHJpdmF0ZSBzZWxlY3RBbGwoKTogdm9pZCB7XG5cdFx0dGhpcy5pbnB1dFdpZGdldC5zZXRTZWxlY3Rpb24obmV3IFJhbmdlKDEsIDEsIDEsIHRoaXMuZ2V0VmFsdWUoKS5sZW5ndGggKyAxKSk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3VnZ2VzdEVuYWJsZWRIaXN0b3J5T3B0aW9ucyB7XG5cdGlkOiBzdHJpbmc7XG5cdGFyaWFMYWJlbDogc3RyaW5nO1xuXHRwYXJlbnQ6IEhUTUxFbGVtZW50O1xuXHRzdWdnZXN0aW9uUHJvdmlkZXI6IFN1Z2dlc3RSZXN1bHRzUHJvdmlkZXI7XG5cdHJlc291cmNlSGFuZGxlOiBzdHJpbmc7XG5cdHN1Z2dlc3RPcHRpb25zOiBTdWdnZXN0RW5hYmxlZElucHV0T3B0aW9ucztcblx0aGlzdG9yeTogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjbGFzcyBTdWdnZXN0RW5hYmxlZElucHV0V2l0aEhpc3RvcnkgZXh0ZW5kcyBTdWdnZXN0RW5hYmxlZElucHV0IGltcGxlbWVudHMgSUhpc3RvcnlOYXZpZ2F0aW9uV2lkZ2V0IHtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IGhpc3Rvcnk6IEhpc3RvcnlOYXZpZ2F0b3I8c3RyaW5nPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR7IGlkLCBwYXJlbnQsIGFyaWFMYWJlbCwgc3VnZ2VzdGlvblByb3ZpZGVyLCByZXNvdXJjZUhhbmRsZSwgc3VnZ2VzdE9wdGlvbnMsIGhpc3RvcnkgfTogSVN1Z2dlc3RFbmFibGVkSGlzdG9yeU9wdGlvbnMsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihpZCwgcGFyZW50LCBzdWdnZXN0aW9uUHJvdmlkZXIsIGFyaWFMYWJlbCwgcmVzb3VyY2VIYW5kbGUsIHN1Z2dlc3RPcHRpb25zLCBpbnN0YW50aWF0aW9uU2VydmljZSwgbW9kZWxTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLmhpc3RvcnkgPSB0aGlzLl9yZWdpc3RlcihuZXcgSGlzdG9yeU5hdmlnYXRvcjxzdHJpbmc+KG5ldyBTZXQoaGlzdG9yeSksIDEwMCkpO1xuXHR9XG5cblx0cHVibGljIGFkZFRvSGlzdG9yeSgpOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuZ2V0VmFsdWUoKTtcblx0XHRpZiAodmFsdWUgJiYgdmFsdWUgIT09IHRoaXMuZ2V0Q3VycmVudFZhbHVlKCkpIHtcblx0XHRcdHRoaXMuaGlzdG9yeS5hZGQodmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRIaXN0b3J5KCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5oaXN0b3J5LmdldEhpc3RvcnkoKTtcblx0fVxuXG5cdHB1YmxpYyBzaG93TmV4dFZhbHVlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5oaXN0b3J5Lmhhcyh0aGlzLmdldFZhbHVlKCkpKSB7XG5cdFx0XHR0aGlzLmFkZFRvSGlzdG9yeSgpO1xuXHRcdH1cblxuXHRcdGxldCBuZXh0ID0gdGhpcy5nZXROZXh0VmFsdWUoKTtcblx0XHRpZiAobmV4dCkge1xuXHRcdFx0bmV4dCA9IG5leHQgPT09IHRoaXMuZ2V0VmFsdWUoKSA/IHRoaXMuZ2V0TmV4dFZhbHVlKCkgOiBuZXh0O1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0VmFsdWUobmV4dCA/PyAnJyk7XG5cdH1cblxuXHRwdWJsaWMgc2hvd1ByZXZpb3VzVmFsdWUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmhpc3RvcnkuaGFzKHRoaXMuZ2V0VmFsdWUoKSkpIHtcblx0XHRcdHRoaXMuYWRkVG9IaXN0b3J5KCk7XG5cdFx0fVxuXG5cdFx0bGV0IHByZXZpb3VzID0gdGhpcy5nZXRQcmV2aW91c1ZhbHVlKCk7XG5cdFx0aWYgKHByZXZpb3VzKSB7XG5cdFx0XHRwcmV2aW91cyA9IHByZXZpb3VzID09PSB0aGlzLmdldFZhbHVlKCkgPyB0aGlzLmdldFByZXZpb3VzVmFsdWUoKSA6IHByZXZpb3VzO1xuXHRcdH1cblxuXHRcdGlmIChwcmV2aW91cykge1xuXHRcdFx0dGhpcy5zZXRWYWx1ZShwcmV2aW91cyk7XG5cdFx0XHR0aGlzLmlucHV0V2lkZ2V0LnNldFBvc2l0aW9uKHsgbGluZU51bWJlcjogMCwgY29sdW1uOiAwIH0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBjbGVhckhpc3RvcnkoKTogdm9pZCB7XG5cdFx0dGhpcy5oaXN0b3J5LmNsZWFyKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldEN1cnJlbnRWYWx1ZSgpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRsZXQgY3VycmVudFZhbHVlID0gdGhpcy5oaXN0b3J5LmN1cnJlbnQoKTtcblx0XHRpZiAoIWN1cnJlbnRWYWx1ZSkge1xuXHRcdFx0Y3VycmVudFZhbHVlID0gdGhpcy5oaXN0b3J5Lmxhc3QoKTtcblx0XHRcdHRoaXMuaGlzdG9yeS5uZXh0KCk7XG5cdFx0fVxuXHRcdHJldHVybiBjdXJyZW50VmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIGdldFByZXZpb3VzVmFsdWUoKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuaGlzdG9yeS5wcmV2aW91cygpIHx8IHRoaXMuaGlzdG9yeS5maXJzdCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXROZXh0VmFsdWUoKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuaGlzdG9yeS5uZXh0KCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbnRleHRTY29wZWRTdWdnZXN0RW5hYmxlZElucHV0V2l0aEhpc3RvcnkgZXh0ZW5kcyBTdWdnZXN0RW5hYmxlZElucHV0V2l0aEhpc3Rvcnkge1xuXHRwcml2YXRlIGhpc3RvcnlDb250ZXh0ITogSUhpc3RvcnlOYXZpZ2F0aW9uQ29udGV4dDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJU3VnZ2VzdEVuYWJsZWRIaXN0b3J5T3B0aW9ucyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKG9wdGlvbnMsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBtb2RlbFNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgeyBoaXN0b3J5TmF2aWdhdGlvbkJhY2t3YXJkc0VuYWJsZW1lbnQsIGhpc3RvcnlOYXZpZ2F0aW9uRm9yd2FyZHNFbmFibGVtZW50IH0gPSB0aGlzLmhpc3RvcnlDb250ZXh0O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5wdXRXaWRnZXQub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbigoeyBwb3NpdGlvbiB9KSA9PiB7XG5cdFx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLmlucHV0V2lkZ2V0Ll9nZXRWaWV3TW9kZWwoKSE7XG5cdFx0XHRjb25zdCBsYXN0TGluZU51bWJlciA9IHZpZXdNb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRcdGNvbnN0IGxhc3RMaW5lQ29sID0gdmlld01vZGVsLmdldExpbmVMZW5ndGgobGFzdExpbmVOdW1iZXIpICsgMTtcblx0XHRcdGNvbnN0IHZpZXdQb3NpdGlvbiA9IHZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci5jb252ZXJ0TW9kZWxQb3NpdGlvblRvVmlld1Bvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdGhpc3RvcnlOYXZpZ2F0aW9uQmFja3dhcmRzRW5hYmxlbWVudC5zZXQodmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIgPT09IDEgJiYgdmlld1Bvc2l0aW9uLmNvbHVtbiA9PT0gMSk7XG5cdFx0XHRoaXN0b3J5TmF2aWdhdGlvbkZvcndhcmRzRW5hYmxlbWVudC5zZXQodmlld1Bvc2l0aW9uLmxpbmVOdW1iZXIgPT09IGxhc3RMaW5lTnVtYmVyICYmIHZpZXdQb3NpdGlvbi5jb2x1bW4gPT09IGxhc3RMaW5lQ29sKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0U2NvcGVkQ29udGV4dEtleVNlcnZpY2UoY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSkge1xuXHRcdGNvbnN0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIoY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuZWxlbWVudCkpO1xuXHRcdHRoaXMuaGlzdG9yeUNvbnRleHQgPSB0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFuZENyZWF0ZUhpc3RvcnlOYXZpZ2F0aW9uQ29udGV4dChcblx0XHRcdHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0dGhpcyxcblx0XHQpKTtcblxuXHRcdHJldHVybiBzY29wZWRDb250ZXh0S2V5U2VydmljZTtcblx0fVxufVxuXG5zZXR1cFNpbXBsZUVkaXRvclNlbGVjdGlvblN0eWxpbmcoJy5zdWdnZXN0LWlucHV0LWNvbnRhaW5lcicpO1xuXG5mdW5jdGlvbiBnZXRTdWdnZXN0RW5hYmxlZElucHV0T3B0aW9ucyhhcmlhTGFiZWw/OiBzdHJpbmcpOiBJRWRpdG9yT3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0Zm9udFNpemU6IDEzLFxuXHRcdGxpbmVIZWlnaHQ6IDIwLFxuXHRcdHdvcmRXcmFwOiAnb2ZmJyxcblx0XHRzY3JvbGxiYXI6IHsgdmVydGljYWw6ICdoaWRkZW4nLCB9LFxuXHRcdHJvdW5kZWRTZWxlY3Rpb246IGZhbHNlLFxuXHRcdGd1aWRlczoge1xuXHRcdFx0aW5kZW50YXRpb246IGZhbHNlXG5cdFx0fSxcblx0XHRjdXJzb3JXaWR0aDogMSxcblx0XHRmb250RmFtaWx5OiBERUZBVUxUX0ZPTlRfRkFNSUxZLFxuXHRcdGFyaWFMYWJlbDogYXJpYUxhYmVsIHx8ICcnLFxuXHRcdHNuaXBwZXRTdWdnZXN0aW9uczogJ25vbmUnLFxuXHRcdHN1Z2dlc3Q6IHsgZmlsdGVyR3JhY2VmdWw6IGZhbHNlLCBzaG93SWNvbnM6IGZhbHNlIH0sXG5cdFx0YXV0b0Nsb3NpbmdCcmFja2V0czogJ25ldmVyJ1xuXHR9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLEdBQWMsY0FBYztBQUNyQyxTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxlQUFlO0FBQ3hC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
