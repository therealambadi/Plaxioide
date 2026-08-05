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
import { alert } from "../../../../../base/browser/ui/aria/aria.js";
import { timeout } from "../../../../../base/common/async.js";
import { cancelOnDispose } from "../../../../../base/common/cancellation.js";
import { createHotClass } from "../../../../../base/common/hotReloadHelpers.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, derivedDisposable, derivedObservableWithCache, observableFromEvent, observableSignal, observableValue, runOnChange, runOnChangeWithStore, transaction, waitForState } from "../../../../../base/common/observable.js";
import { isUndefined } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { hotClassGetOriginalInstance } from "../../../../../platform/observable/common/wrapInHotClass.js";
import { CoreEditingCommands } from "../../../../browser/coreCommands.js";
import { observableCodeEditor } from "../../../../browser/observableCodeEditor.js";
import { getOuterEditor } from "../../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { Position } from "../../../../common/core/position.js";
import { CursorChangeReason } from "../../../../common/cursorEvents.js";
import { ILanguageFeatureDebounceService } from "../../../../common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
import { InlineSuggestionHintsContentWidget } from "../hintsWidget/inlineCompletionsHintsWidget.js";
import { TextModelChangeRecorder } from "../model/changeRecorder.js";
import { InlineCompletionsModel } from "../model/inlineCompletionsModel.js";
import { ObservableSuggestWidgetAdapter } from "../model/suggestWidgetAdapter.js";
import { ObservableContextKeyService } from "../utils.js";
import { InlineCompletionsView } from "../view/inlineCompletionsView.js";
import { inlineSuggestCommitId } from "./commandIds.js";
import { InlineCompletionContextKeys } from "./inlineCompletionContextKeys.js";
let InlineCompletionsController = class extends Disposable {
  constructor(editor, _instantiationService, _contextKeyService, _configurationService, _commandService, _debounceService, _languageFeaturesService, _accessibilitySignalService, _keybindingService, _accessibilityService) {
    super();
    this.editor = editor;
    this._instantiationService = _instantiationService;
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._commandService = _commandService;
    this._debounceService = _debounceService;
    this._languageFeaturesService = _languageFeaturesService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._keybindingService = _keybindingService;
    this._accessibilityService = _accessibilityService;
    this._editorObs = observableCodeEditor(this.editor);
    this._positions = derived(this, (reader) => this._editorObs.selections.read(reader)?.map((s) => s.getEndPosition()) ?? [new Position(1, 1)]);
    this._suggestWidgetAdapter = this._register(new ObservableSuggestWidgetAdapter(
      this._editorObs,
      (item) => this.model.get()?.handleSuggestAccepted(item),
      () => this.model.get()?.selectedInlineCompletion.get()?.toSingleTextEdit(void 0)
    ));
    this._enabledInConfig = observableFromEvent(this, this.editor.onDidChangeConfiguration, () => this.editor.getOption(EditorOption.inlineSuggest).enabled);
    this._isScreenReaderEnabled = observableFromEvent(this, this._accessibilityService.onDidChangeScreenReaderOptimized, () => this._accessibilityService.isScreenReaderOptimized());
    this._editorDictationInProgress = observableFromEvent(
      this,
      this._contextKeyService.onDidChangeContext,
      () => this._contextKeyService.getContext(this.editor.getDomNode()).getValue("editorDictation.inProgress") === true
    );
    this._enabled = derived(this, (reader) => this._enabledInConfig.read(reader) && (!this._isScreenReaderEnabled.read(reader) || !this._editorDictationInProgress.read(reader)));
    this._debounceValue = this._debounceService.for(
      this._languageFeaturesService.inlineCompletionsProvider,
      "InlineCompletionsDebounce",
      { min: 50, max: 50 }
    );
    this._focusIsInMenu = observableValue(this, false);
    this._focusIsInEditorOrMenu = derived(this, (reader) => {
      const editorHasFocus = this._editorObs.isFocused.read(reader);
      const menuHasFocus = this._focusIsInMenu.read(reader);
      return editorHasFocus || menuHasFocus;
    });
    this._cursorIsInIndentation = derived(this, (reader) => {
      const cursorPos = this._editorObs.cursorPosition.read(reader);
      if (cursorPos === null) {
        return false;
      }
      const model = this._editorObs.model.read(reader);
      if (!model) {
        return false;
      }
      this._editorObs.versionId.read(reader);
      const indentMaxColumn = model.getLineIndentColumn(cursorPos.lineNumber);
      return cursorPos.column <= indentMaxColumn;
    });
    this.model = derivedDisposable(this, (reader) => {
      if (this._editorObs.isReadonly.read(reader)) {
        return void 0;
      }
      const textModel = this._editorObs.model.read(reader);
      if (!textModel) {
        return void 0;
      }
      const model = this._instantiationService.createInstance(
        InlineCompletionsModel,
        textModel,
        this._suggestWidgetAdapter.selectedItem,
        this._editorObs.versionId,
        this._positions,
        this._debounceValue,
        this._enabled,
        this.editor
      );
      return model;
    }).recomputeInitiallyAndOnChange(this._store);
    this._playAccessibilitySignal = observableSignal(this);
    this._hideInlineEditOnSelectionChange = this._editorObs.getOption(EditorOption.inlineSuggest).map((val) => true);
    this._view = this._register(this._instantiationService.createInstance(InlineCompletionsView, this.editor, this.model, this._focusIsInMenu));
    InlineCompletionsController._instances.add(this);
    this._register(toDisposable(() => InlineCompletionsController._instances.delete(this)));
    this._register(autorun((reader) => {
      const model = this.model.read(reader);
      if (!model) {
        return;
      }
      if (model.state.read(reader) !== void 0) {
        for (const ctrl of InlineCompletionsController._instances) {
          if (ctrl !== this) {
            ctrl.reject();
          }
        }
      }
    }));
    this._register(runOnChange(this._editorObs.onDidType, (_value, _changes) => {
      if (this._enabled.get()) {
        this.model.get()?.trigger();
      }
    }));
    this._register(runOnChange(this._editorObs.onDidPaste, (_value, _changes) => {
      if (this._enabled.get()) {
        this.model.get()?.trigger();
      }
    }));
    this._register(this._commandService.onDidExecuteCommand((e) => {
      const commands = /* @__PURE__ */ new Set([
        CoreEditingCommands.Tab.id,
        CoreEditingCommands.DeleteLeft.id,
        CoreEditingCommands.DeleteRight.id,
        inlineSuggestCommitId,
        "acceptSelectedSuggestion"
      ]);
      if (commands.has(e.commandId) && editor.hasTextFocus() && this._enabled.get()) {
        let noDelay = false;
        if (e.commandId === inlineSuggestCommitId) {
          noDelay = true;
        }
        this._editorObs.forceUpdate((tx) => {
          this.model.get()?.trigger(tx, { noDelay });
        });
      }
    }));
    this._register(runOnChange(this._editorObs.selections, (_value, _, changes) => {
      if (changes.some((e) => e.reason === CursorChangeReason.Explicit || e.source === "api")) {
        if (!this._hideInlineEditOnSelectionChange.get() && this.model.get()?.state.get()?.kind === "inlineEdit") {
          return;
        }
        const m = this.model.get();
        if (!m) {
          return;
        }
        if (m.state.get()?.kind === "ghostText") {
          this.model.get()?.stop();
        }
      }
    }));
    this._register(autorun((reader) => {
      const isFocused = this._focusIsInEditorOrMenu.read(reader);
      if (isFocused) {
        return;
      }
      if (this._contextKeyService.getContextKeyValue("accessibleViewIsShown") || this._configurationService.getValue("editor.inlineSuggest.keepOnBlur") || editor.getOption(EditorOption.inlineSuggest).keepOnBlur || InlineSuggestionHintsContentWidget.dropDownVisible) {
        return;
      }
      const model = this.model.get();
      if (!model) {
        return;
      }
      if (model.state.get()?.inlineCompletion?.request.isExplicitRequest && model.inlineEditAvailable.get()) {
        return;
      }
      transaction((tx) => {
        model.stop("automatic", tx);
      });
    }));
    this._register(autorun((reader) => {
      const state = this.model.read(reader)?.inlineCompletionState.read(reader);
      if (state?.suggestItem) {
        if (state.primaryGhostText.lineCount >= 2) {
          this._suggestWidgetAdapter.forceRenderingAbove();
        }
      } else {
        this._suggestWidgetAdapter.stopForceRenderingAbove();
      }
    }));
    this._register(toDisposable(() => {
      this._suggestWidgetAdapter.stopForceRenderingAbove();
    }));
    const currentInlineCompletionBySemanticId = derivedObservableWithCache(this, (reader, last) => {
      const model = this.model.read(reader);
      const state = model?.state.read(reader);
      if (this._suggestWidgetAdapter.selectedItem.get()) {
        return last;
      }
      return state?.inlineCompletion?.semanticId;
    });
    this._register(runOnChangeWithStore(derived((reader) => {
      this._playAccessibilitySignal.read(reader);
      currentInlineCompletionBySemanticId.read(reader);
      return {};
    }), async (_value, _, _deltas, store) => {
      const model = this.model.get();
      const state = model?.state.get();
      if (!state || !model) {
        return;
      }
      const lineText = state.kind === "ghostText" ? model.textModel.getLineContent(state.primaryGhostText.lineNumber) : "";
      await timeout(50, cancelOnDispose(store));
      await waitForState(this._suggestWidgetAdapter.selectedItem, isUndefined, () => false, cancelOnDispose(store));
      await this._accessibilitySignalService.playSignal(AccessibilitySignal.inlineSuggestion);
      if (this.editor.getOption(EditorOption.screenReaderAnnounceInlineSuggestion)) {
        if (state.kind === "ghostText") {
          this._provideScreenReaderUpdate(state.primaryGhostText.renderForScreenReader(lineText));
        } else {
          this._provideScreenReaderUpdate("");
        }
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("accessibility.verbosity.inlineCompletions")) {
        this.editor.updateOptions({ inlineCompletionsAccessibilityVerbose: this._configurationService.getValue("accessibility.verbosity.inlineCompletions") });
      }
    }));
    this.editor.updateOptions({ inlineCompletionsAccessibilityVerbose: this._configurationService.getValue("accessibility.verbosity.inlineCompletions") });
    const contextKeySvcObs = new ObservableContextKeyService(this._contextKeyService);
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.cursorInIndentation, this._cursorIsInIndentation));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.hasSelection, (reader) => !this._editorObs.cursorSelection.read(reader)?.isEmpty()));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.cursorAtInlineEdit, this.model.map((m, reader) => m?.inlineEditState?.read(reader)?.cursorAtInlineEdit)));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.tabShouldAcceptInlineEdit, this.model.map((m, r) => !!m?.tabShouldAcceptInlineEdit.read(r))));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.tabShouldJumpToInlineEdit, this.model.map((m, r) => !!m?.tabShouldJumpToInlineEdit.read(r))));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.inlineEditVisible, (reader) => this.model.read(reader)?.inlineEditState.read(reader) !== void 0));
    this._register(contextKeySvcObs.bind(
      InlineCompletionContextKeys.inlineSuggestionHasIndentation,
      (reader) => this.model.read(reader)?.getIndentationInfo(reader)?.startsWithIndentation
    ));
    this._register(contextKeySvcObs.bind(
      InlineCompletionContextKeys.inlineSuggestionHasIndentationLessThanTabSize,
      (reader) => this.model.read(reader)?.getIndentationInfo(reader)?.startsWithIndentationLessThanTabSize
    ));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.suppressSuggestions, (reader) => {
      const model = this.model.read(reader);
      const state = model?.inlineCompletionState.read(reader);
      return state?.primaryGhostText && state?.inlineCompletion ? state.inlineCompletion.source.inlineCompletions.suppressSuggestions : void 0;
    }));
    this._register(contextKeySvcObs.bind(InlineCompletionContextKeys.inlineSuggestionVisible, (reader) => {
      const model = this.model.read(reader);
      const state = model?.inlineCompletionState.read(reader);
      return !!state?.inlineCompletion && state?.primaryGhostText !== void 0 && !state?.primaryGhostText.isEmpty();
    }));
    this._register(this._instantiationService.createInstance(TextModelChangeRecorder, this.editor));
  }
  /**
   * Find the controller in the focused editor or in the outer editor (if applicable)
   */
  static getInFocusedEditorOrParent(accessor) {
    const outerEditor = getOuterEditor(accessor);
    if (!outerEditor) {
      return null;
    }
    return InlineCompletionsController.get(outerEditor);
  }
  static get(editor) {
    return hotClassGetOriginalInstance(editor.getContribution(InlineCompletionsController.ID));
  }
  playAccessibilitySignal(tx) {
    this._playAccessibilitySignal.trigger(tx);
  }
  _provideScreenReaderUpdate(content) {
    const accessibleViewShowing = this._contextKeyService.getContextKeyValue("accessibleViewIsShown");
    const accessibleViewKeybinding = this._keybindingService.lookupKeybinding("editor.action.accessibleView");
    let hint;
    if (!accessibleViewShowing && accessibleViewKeybinding && this.editor.getOption(EditorOption.inlineCompletionsAccessibilityVerbose)) {
      hint = localize("showAccessibleViewHint", "Inspect this in the accessible view ({0})", accessibleViewKeybinding.getAriaLabel());
    }
    alert(hint ? content + ", " + hint : content);
  }
  shouldShowHoverAt(range) {
    const ghostText = this.model.get()?.primaryGhostText.get();
    if (!ghostText) {
      return false;
    }
    return ghostText.parts.some((p) => range.containsPosition(new Position(ghostText.lineNumber, p.column)));
  }
  shouldShowHoverAtViewZone(viewZoneId) {
    return this._view.shouldShowHoverAtViewZone(viewZoneId);
  }
  reject() {
    transaction((tx) => {
      const m = this.model.get();
      if (m) {
        m.stop("explicitCancel", tx);
      }
    });
  }
  jump() {
    const m = this.model.get();
    if (m) {
      m.jump();
    }
  }
};
InlineCompletionsController._instances = /* @__PURE__ */ new Set();
InlineCompletionsController.hot = createHotClass(InlineCompletionsController);
InlineCompletionsController.ID = "editor.contrib.inlineCompletionsController";
InlineCompletionsController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, ILanguageFeatureDebounceService),
  __decorateParam(6, ILanguageFeaturesService),
  __decorateParam(7, IAccessibilitySignalService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IAccessibilityService)
], InlineCompletionsController);
export {
  InlineCompletionsController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL2NvbnRyb2xsZXIvaW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYWxlcnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBjYW5jZWxPbkRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgY3JlYXRlSG90Q2xhc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ob3RSZWxvYWRIZWxwZXJzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJVHJhbnNhY3Rpb24sIGF1dG9ydW4sIGRlcml2ZWQsIGRlcml2ZWREaXNwb3NhYmxlLCBkZXJpdmVkT2JzZXJ2YWJsZVdpdGhDYWNoZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVNpZ25hbCwgb2JzZXJ2YWJsZVZhbHVlLCBydW5PbkNoYW5nZSwgcnVuT25DaGFuZ2VXaXRoU3RvcmUsIHRyYW5zYWN0aW9uLCB3YWl0Rm9yU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGlzVW5kZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5U2lnbmFsLCBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5U2lnbmFsL2Jyb3dzZXIvYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgaG90Q2xhc3NHZXRPcmlnaW5hbEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vd3JhcEluSG90Q2xhc3MuanMnO1xuaW1wb3J0IHsgQ29yZUVkaXRpbmdDb21tYW5kcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvY29yZUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9vYnNlcnZhYmxlQ29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBnZXRPdXRlckVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgQ3Vyc29yQ2hhbmdlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZURlYm91bmNlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElubGluZVN1Z2dlc3Rpb25IaW50c0NvbnRlbnRXaWRnZXQgfSBmcm9tICcuLi9oaW50c1dpZGdldC9pbmxpbmVDb21wbGV0aW9uc0hpbnRzV2lkZ2V0LmpzJztcbmltcG9ydCB7IFRleHRNb2RlbENoYW5nZVJlY29yZGVyIH0gZnJvbSAnLi4vbW9kZWwvY2hhbmdlUmVjb3JkZXIuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNNb2RlbCB9IGZyb20gJy4uL21vZGVsL2lubGluZUNvbXBsZXRpb25zTW9kZWwuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZVN1Z2dlc3RXaWRnZXRBZGFwdGVyIH0gZnJvbSAnLi4vbW9kZWwvc3VnZ2VzdFdpZGdldEFkYXB0ZXIuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vdXRpbHMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNWaWV3IH0gZnJvbSAnLi4vdmlldy9pbmxpbmVDb21wbGV0aW9uc1ZpZXcuanMnO1xuaW1wb3J0IHsgaW5saW5lU3VnZ2VzdENvbW1pdElkIH0gZnJvbSAnLi9jb21tYW5kSWRzLmpzJztcbmltcG9ydCB7IElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cyB9IGZyb20gJy4vaW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmpzJztcblxuZXhwb3J0IGNsYXNzIElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfaW5zdGFuY2VzID0gbmV3IFNldDxJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXI+KCk7XG5cblx0cHVibGljIHN0YXRpYyBob3QgPSBjcmVhdGVIb3RDbGFzcyhJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIpO1xuXHRwdWJsaWMgc3RhdGljIElEID0gJ2VkaXRvci5jb250cmliLmlubGluZUNvbXBsZXRpb25zQ29udHJvbGxlcic7XG5cblx0LyoqXG5cdCAqIEZpbmQgdGhlIGNvbnRyb2xsZXIgaW4gdGhlIGZvY3VzZWQgZWRpdG9yIG9yIGluIHRoZSBvdXRlciBlZGl0b3IgKGlmIGFwcGxpY2FibGUpXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIGdldEluRm9jdXNlZEVkaXRvck9yUGFyZW50KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyIHwgbnVsbCB7XG5cdFx0Y29uc3Qgb3V0ZXJFZGl0b3IgPSBnZXRPdXRlckVkaXRvcihhY2Nlc3Nvcik7XG5cdFx0aWYgKCFvdXRlckVkaXRvcikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuZ2V0KG91dGVyRWRpdG9yKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gaG90Q2xhc3NHZXRPcmlnaW5hbEluc3RhbmNlKGVkaXRvci5nZXRDb250cmlidXRpb248SW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyPihJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuSUQpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvck9icyA9IG9ic2VydmFibGVDb2RlRWRpdG9yKHRoaXMuZWRpdG9yKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcG9zaXRpb25zID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5fZWRpdG9yT2JzLnNlbGVjdGlvbnMucmVhZChyZWFkZXIpPy5tYXAocyA9PiBzLmdldEVuZFBvc2l0aW9uKCkpID8/IFtuZXcgUG9zaXRpb24oMSwgMSldKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdWdnZXN0V2lkZ2V0QWRhcHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBPYnNlcnZhYmxlU3VnZ2VzdFdpZGdldEFkYXB0ZXIoXG5cdFx0dGhpcy5fZWRpdG9yT2JzLFxuXHRcdGl0ZW0gPT4gdGhpcy5tb2RlbC5nZXQoKT8uaGFuZGxlU3VnZ2VzdEFjY2VwdGVkKGl0ZW0pLFxuXHRcdCgpID0+IHRoaXMubW9kZWwuZ2V0KCk/LnNlbGVjdGVkSW5saW5lQ29tcGxldGlvbi5nZXQoKT8udG9TaW5nbGVUZXh0RWRpdCh1bmRlZmluZWQpLFxuXHQpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lbmFibGVkSW5Db25maWcgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsIHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbiwgKCkgPT4gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxpbmVTdWdnZXN0KS5lbmFibGVkKTtcblx0cHJpdmF0ZSByZWFkb25seSBfaXNTY3JlZW5SZWFkZXJFbmFibGVkID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCB0aGlzLl9hY2Nlc3NpYmlsaXR5U2VydmljZS5vbkRpZENoYW5nZVNjcmVlblJlYWRlck9wdGltaXplZCwgKCkgPT4gdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvckRpY3RhdGlvbkluUHJvZ3Jlc3MgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsXG5cdFx0dGhpcy5fY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0LFxuXHRcdCgpID0+IHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHQodGhpcy5lZGl0b3IuZ2V0RG9tTm9kZSgpKS5nZXRWYWx1ZSgnZWRpdG9yRGljdGF0aW9uLmluUHJvZ3Jlc3MnKSA9PT0gdHJ1ZVxuXHQpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lbmFibGVkID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5fZW5hYmxlZEluQ29uZmlnLnJlYWQocmVhZGVyKSAmJiAoIXRoaXMuX2lzU2NyZWVuUmVhZGVyRW5hYmxlZC5yZWFkKHJlYWRlcikgfHwgIXRoaXMuX2VkaXRvckRpY3RhdGlvbkluUHJvZ3Jlc3MucmVhZChyZWFkZXIpKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGVib3VuY2VWYWx1ZSA9IHRoaXMuX2RlYm91bmNlU2VydmljZS5mb3IoXG5cdFx0dGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW5saW5lQ29tcGxldGlvbnNQcm92aWRlcixcblx0XHQnSW5saW5lQ29tcGxldGlvbnNEZWJvdW5jZScsXG5cdFx0eyBtaW46IDUwLCBtYXg6IDUwIH1cblx0KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1c0lzSW5NZW51ID0gb2JzZXJ2YWJsZVZhbHVlPGJvb2xlYW4+KHRoaXMsIGZhbHNlKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZm9jdXNJc0luRWRpdG9yT3JNZW51ID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGVkaXRvckhhc0ZvY3VzID0gdGhpcy5fZWRpdG9yT2JzLmlzRm9jdXNlZC5yZWFkKHJlYWRlcik7XG5cdFx0Y29uc3QgbWVudUhhc0ZvY3VzID0gdGhpcy5fZm9jdXNJc0luTWVudS5yZWFkKHJlYWRlcik7XG5cdFx0cmV0dXJuIGVkaXRvckhhc0ZvY3VzIHx8IG1lbnVIYXNGb2N1cztcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY3Vyc29ySXNJbkluZGVudGF0aW9uID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGN1cnNvclBvcyA9IHRoaXMuX2VkaXRvck9icy5jdXJzb3JQb3NpdGlvbi5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKGN1cnNvclBvcyA9PT0gbnVsbCkgeyByZXR1cm4gZmFsc2U7IH1cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvck9icy5tb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFtb2RlbCkgeyByZXR1cm4gZmFsc2U7IH1cblx0XHR0aGlzLl9lZGl0b3JPYnMudmVyc2lvbklkLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBpbmRlbnRNYXhDb2x1bW4gPSBtb2RlbC5nZXRMaW5lSW5kZW50Q29sdW1uKGN1cnNvclBvcy5saW5lTnVtYmVyKTtcblx0XHRyZXR1cm4gY3Vyc29yUG9zLmNvbHVtbiA8PSBpbmRlbnRNYXhDb2x1bW47XG5cdH0pO1xuXG5cdHB1YmxpYyByZWFkb25seSBtb2RlbCA9IGRlcml2ZWREaXNwb3NhYmxlPElubGluZUNvbXBsZXRpb25zTW9kZWwgfCB1bmRlZmluZWQ+KHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0aWYgKHRoaXMuX2VkaXRvck9icy5pc1JlYWRvbmx5LnJlYWQocmVhZGVyKSkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5fZWRpdG9yT2JzLm1vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXRleHRNb2RlbCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cblx0XHRjb25zdCBtb2RlbDogSW5saW5lQ29tcGxldGlvbnNNb2RlbCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0SW5saW5lQ29tcGxldGlvbnNNb2RlbCxcblx0XHRcdHRleHRNb2RlbCxcblx0XHRcdHRoaXMuX3N1Z2dlc3RXaWRnZXRBZGFwdGVyLnNlbGVjdGVkSXRlbSxcblx0XHRcdHRoaXMuX2VkaXRvck9icy52ZXJzaW9uSWQsXG5cdFx0XHR0aGlzLl9wb3NpdGlvbnMsXG5cdFx0XHR0aGlzLl9kZWJvdW5jZVZhbHVlLFxuXHRcdFx0dGhpcy5fZW5hYmxlZCxcblx0XHRcdHRoaXMuZWRpdG9yLFxuXHRcdCk7XG5cdFx0cmV0dXJuIG1vZGVsO1xuXHR9KS5yZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSh0aGlzLl9zdG9yZSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcGxheUFjY2Vzc2liaWxpdHlTaWduYWwgPSBvYnNlcnZhYmxlU2lnbmFsKHRoaXMpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2hpZGVJbmxpbmVFZGl0T25TZWxlY3Rpb25DaGFuZ2UgPSB0aGlzLl9lZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxpbmVTdWdnZXN0KS5tYXAodmFsID0+IHRydWUpO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfdmlldyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKElubGluZUNvbXBsZXRpb25zVmlldywgdGhpcy5lZGl0b3IsIHRoaXMubW9kZWwsIHRoaXMuX2ZvY3VzSXNJbk1lbnUpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGVib3VuY2VTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlci5faW5zdGFuY2VzLmFkZCh0aGlzKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLl9pbnN0YW5jZXMuZGVsZXRlKHRoaXMpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvLyBDYW5jZWwgYWxsIG90aGVyIGlubGluZSBjb21wbGV0aW9ucyB3aGVuIGEgbmV3IG9uZSBzdGFydHNcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIW1vZGVsKSB7IHJldHVybjsgfVxuXHRcdFx0aWYgKG1vZGVsLnN0YXRlLnJlYWQocmVhZGVyKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgY3RybCBvZiBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuX2luc3RhbmNlcykge1xuXHRcdFx0XHRcdGlmIChjdHJsICE9PSB0aGlzKSB7XG5cdFx0XHRcdFx0XHRjdHJsLnJlamVjdCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJ1bk9uQ2hhbmdlKHRoaXMuX2VkaXRvck9icy5vbkRpZFR5cGUsIChfdmFsdWUsIF9jaGFuZ2VzKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZW5hYmxlZC5nZXQoKSkge1xuXHRcdFx0XHR0aGlzLm1vZGVsLmdldCgpPy50cmlnZ2VyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocnVuT25DaGFuZ2UodGhpcy5fZWRpdG9yT2JzLm9uRGlkUGFzdGUsIChfdmFsdWUsIF9jaGFuZ2VzKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZW5hYmxlZC5nZXQoKSkge1xuXHRcdFx0XHR0aGlzLm1vZGVsLmdldCgpPy50cmlnZ2VyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29tbWFuZFNlcnZpY2Uub25EaWRFeGVjdXRlQ29tbWFuZCgoZSkgPT4ge1xuXHRcdFx0Ly8gVGhlc2UgY29tbWFuZHMgZG9uJ3QgdHJpZ2dlciBvbkRpZFR5cGUuXG5cdFx0XHRjb25zdCBjb21tYW5kcyA9IG5ldyBTZXQoW1xuXHRcdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLlRhYi5pZCxcblx0XHRcdFx0Q29yZUVkaXRpbmdDb21tYW5kcy5EZWxldGVMZWZ0LmlkLFxuXHRcdFx0XHRDb3JlRWRpdGluZ0NvbW1hbmRzLkRlbGV0ZVJpZ2h0LmlkLFxuXHRcdFx0XHRpbmxpbmVTdWdnZXN0Q29tbWl0SWQsXG5cdFx0XHRcdCdhY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb24nLFxuXHRcdFx0XSk7XG5cdFx0XHRpZiAoY29tbWFuZHMuaGFzKGUuY29tbWFuZElkKSAmJiBlZGl0b3IuaGFzVGV4dEZvY3VzKCkgJiYgdGhpcy5fZW5hYmxlZC5nZXQoKSkge1xuXHRcdFx0XHRsZXQgbm9EZWxheSA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoZS5jb21tYW5kSWQgPT09IGlubGluZVN1Z2dlc3RDb21taXRJZCkge1xuXHRcdFx0XHRcdG5vRGVsYXkgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2VkaXRvck9icy5mb3JjZVVwZGF0ZSh0eCA9PiB7XG5cdFx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBvbkRpZEV4ZWN1dGVDb21tYW5kICovXG5cdFx0XHRcdFx0dGhpcy5tb2RlbC5nZXQoKT8udHJpZ2dlcih0eCwgeyBub0RlbGF5IH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihydW5PbkNoYW5nZSh0aGlzLl9lZGl0b3JPYnMuc2VsZWN0aW9ucywgKF92YWx1ZSwgXywgY2hhbmdlcykgPT4ge1xuXHRcdFx0aWYgKGNoYW5nZXMuc29tZShlID0+IGUucmVhc29uID09PSBDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQgfHwgZS5zb3VyY2UgPT09ICdhcGknKSkge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2hpZGVJbmxpbmVFZGl0T25TZWxlY3Rpb25DaGFuZ2UuZ2V0KCkgJiYgdGhpcy5tb2RlbC5nZXQoKT8uc3RhdGUuZ2V0KCk/LmtpbmQgPT09ICdpbmxpbmVFZGl0Jykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBtID0gdGhpcy5tb2RlbC5nZXQoKTtcblx0XHRcdFx0aWYgKCFtKSB7IHJldHVybjsgfVxuXHRcdFx0XHRpZiAobS5zdGF0ZS5nZXQoKT8ua2luZCA9PT0gJ2dob3N0VGV4dCcpIHtcblx0XHRcdFx0XHR0aGlzLm1vZGVsLmdldCgpPy5zdG9wKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBpc0ZvY3VzZWQgPSB0aGlzLl9mb2N1c0lzSW5FZGl0b3JPck1lbnUucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKGlzRm9jdXNlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRoaXMgaXMgYSBoaWRkZW4gc2V0dGluZyB2ZXJ5IHVzZWZ1bCBmb3IgZGVidWdnaW5nXG5cdFx0XHRpZiAodGhpcy5fY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dEtleVZhbHVlPGJvb2xlYW4+KCdhY2Nlc3NpYmxlVmlld0lzU2hvd24nKVxuXHRcdFx0XHR8fCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZWRpdG9yLmlubGluZVN1Z2dlc3Qua2VlcE9uQmx1cicpXG5cdFx0XHRcdHx8IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmlubGluZVN1Z2dlc3QpLmtlZXBPbkJsdXJcblx0XHRcdFx0fHwgSW5saW5lU3VnZ2VzdGlvbkhpbnRzQ29udGVudFdpZGdldC5kcm9wRG93blZpc2libGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMubW9kZWwuZ2V0KCk7XG5cdFx0XHRpZiAoIW1vZGVsKSB7IHJldHVybjsgfVxuXHRcdFx0aWYgKG1vZGVsLnN0YXRlLmdldCgpPy5pbmxpbmVDb21wbGV0aW9uPy5yZXF1ZXN0LmlzRXhwbGljaXRSZXF1ZXN0ICYmIG1vZGVsLmlubGluZUVkaXRBdmFpbGFibGUuZ2V0KCkpIHtcblx0XHRcdFx0Ly8gZG9udCBoaWRlIGlubGluZSBlZGl0cyBvbiBibHVyIHdoZW4gcmVxdWVzdGVkIGV4cGxpY2l0bHlcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLm9uRGlkQmx1ckVkaXRvcldpZGdldCAqL1xuXHRcdFx0XHRtb2RlbC5zdG9wKCdhdXRvbWF0aWMnLCB0eCk7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHQvKiogQGRlc2NyaXB0aW9uIElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlci5mb3JjZVJlbmRlcmluZ0Fib3ZlICovXG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMubW9kZWwucmVhZChyZWFkZXIpPy5pbmxpbmVDb21wbGV0aW9uU3RhdGUucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKHN0YXRlPy5zdWdnZXN0SXRlbSkge1xuXHRcdFx0XHRpZiAoc3RhdGUucHJpbWFyeUdob3N0VGV4dC5saW5lQ291bnQgPj0gMikge1xuXHRcdFx0XHRcdHRoaXMuX3N1Z2dlc3RXaWRnZXRBZGFwdGVyLmZvcmNlUmVuZGVyaW5nQWJvdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fc3VnZ2VzdFdpZGdldEFkYXB0ZXIuc3RvcEZvcmNlUmVuZGVyaW5nQWJvdmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX3N1Z2dlc3RXaWRnZXRBZGFwdGVyLnN0b3BGb3JjZVJlbmRlcmluZ0Fib3ZlKCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgY3VycmVudElubGluZUNvbXBsZXRpb25CeVNlbWFudGljSWQgPSBkZXJpdmVkT2JzZXJ2YWJsZVdpdGhDYWNoZTxzdHJpbmcgfCB1bmRlZmluZWQ+KHRoaXMsIChyZWFkZXIsIGxhc3QpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IG1vZGVsPy5zdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAodGhpcy5fc3VnZ2VzdFdpZGdldEFkYXB0ZXIuc2VsZWN0ZWRJdGVtLmdldCgpKSB7XG5cdFx0XHRcdHJldHVybiBsYXN0O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHN0YXRlPy5pbmxpbmVDb21wbGV0aW9uPy5zZW1hbnRpY0lkO1xuXHRcdH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJ1bk9uQ2hhbmdlV2l0aFN0b3JlKGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdHRoaXMuX3BsYXlBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlYWQocmVhZGVyKTtcblx0XHRcdGN1cnJlbnRJbmxpbmVDb21wbGV0aW9uQnlTZW1hbnRpY0lkLnJlYWQocmVhZGVyKTtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9KSwgYXN5bmMgKF92YWx1ZSwgXywgX2RlbHRhcywgc3RvcmUpID0+IHtcblx0XHRcdC8qKiBAZGVzY3JpcHRpb24gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLnBsYXlBY2Nlc3NpYmlsaXR5U2lnbmFsQW5kUmVhZFN1Z2dlc3Rpb24gKi9cblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbC5nZXQoKTtcblx0XHRcdGNvbnN0IHN0YXRlID0gbW9kZWw/LnN0YXRlLmdldCgpO1xuXHRcdFx0aWYgKCFzdGF0ZSB8fCAhbW9kZWwpIHsgcmV0dXJuOyB9XG5cdFx0XHRjb25zdCBsaW5lVGV4dCA9IHN0YXRlLmtpbmQgPT09ICdnaG9zdFRleHQnID8gbW9kZWwudGV4dE1vZGVsLmdldExpbmVDb250ZW50KHN0YXRlLnByaW1hcnlHaG9zdFRleHQubGluZU51bWJlcikgOiAnJztcblxuXHRcdFx0YXdhaXQgdGltZW91dCg1MCwgY2FuY2VsT25EaXNwb3NlKHN0b3JlKSk7XG5cdFx0XHRhd2FpdCB3YWl0Rm9yU3RhdGUodGhpcy5fc3VnZ2VzdFdpZGdldEFkYXB0ZXIuc2VsZWN0ZWRJdGVtLCBpc1VuZGVmaW5lZCwgKCkgPT4gZmFsc2UsIGNhbmNlbE9uRGlzcG9zZShzdG9yZSkpO1xuXG5cdFx0XHRhd2FpdCB0aGlzLl9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwuaW5saW5lU3VnZ2VzdGlvbik7XG5cdFx0XHRpZiAodGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zY3JlZW5SZWFkZXJBbm5vdW5jZUlubGluZVN1Z2dlc3Rpb24pKSB7XG5cdFx0XHRcdGlmIChzdGF0ZS5raW5kID09PSAnZ2hvc3RUZXh0Jykge1xuXHRcdFx0XHRcdHRoaXMuX3Byb3ZpZGVTY3JlZW5SZWFkZXJVcGRhdGUoc3RhdGUucHJpbWFyeUdob3N0VGV4dC5yZW5kZXJGb3JTY3JlZW5SZWFkZXIobGluZVRleHQpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9wcm92aWRlU2NyZWVuUmVhZGVyVXBkYXRlKCcnKTsgLy8gT25seSBhbm5vdW5jZSBBbHQrRjJcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIFRPRE9AaGVkaWV0XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2FjY2Vzc2liaWxpdHkudmVyYm9zaXR5LmlubGluZUNvbXBsZXRpb25zJykpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3IudXBkYXRlT3B0aW9ucyh7IGlubGluZUNvbXBsZXRpb25zQWNjZXNzaWJpbGl0eVZlcmJvc2U6IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdhY2Nlc3NpYmlsaXR5LnZlcmJvc2l0eS5pbmxpbmVDb21wbGV0aW9ucycpIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLmVkaXRvci51cGRhdGVPcHRpb25zKHsgaW5saW5lQ29tcGxldGlvbnNBY2Nlc3NpYmlsaXR5VmVyYm9zZTogdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2FjY2Vzc2liaWxpdHkudmVyYm9zaXR5LmlubGluZUNvbXBsZXRpb25zJykgfSk7XG5cblx0XHRjb25zdCBjb250ZXh0S2V5U3ZjT2JzID0gbmV3IE9ic2VydmFibGVDb250ZXh0S2V5U2VydmljZSh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0S2V5U3ZjT2JzLmJpbmQoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmN1cnNvckluSW5kZW50YXRpb24sIHRoaXMuX2N1cnNvcklzSW5JbmRlbnRhdGlvbikpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbnRleHRLZXlTdmNPYnMuYmluZChJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuaGFzU2VsZWN0aW9uLCByZWFkZXIgPT4gIXRoaXMuX2VkaXRvck9icy5jdXJzb3JTZWxlY3Rpb24ucmVhZChyZWFkZXIpPy5pc0VtcHR5KCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0S2V5U3ZjT2JzLmJpbmQoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmN1cnNvckF0SW5saW5lRWRpdCwgdGhpcy5tb2RlbC5tYXAoKG0sIHJlYWRlcikgPT4gbT8uaW5saW5lRWRpdFN0YXRlPy5yZWFkKHJlYWRlcik/LmN1cnNvckF0SW5saW5lRWRpdCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0S2V5U3ZjT2JzLmJpbmQoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLnRhYlNob3VsZEFjY2VwdElubGluZUVkaXQsIHRoaXMubW9kZWwubWFwKChtLCByKSA9PiAhIW0/LnRhYlNob3VsZEFjY2VwdElubGluZUVkaXQucmVhZChyKSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0S2V5U3ZjT2JzLmJpbmQoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLnRhYlNob3VsZEp1bXBUb0lubGluZUVkaXQsIHRoaXMubW9kZWwubWFwKChtLCByKSA9PiAhIW0/LnRhYlNob3VsZEp1bXBUb0lubGluZUVkaXQucmVhZChyKSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0S2V5U3ZjT2JzLmJpbmQoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZUVkaXRWaXNpYmxlLCByZWFkZXIgPT4gdGhpcy5tb2RlbC5yZWFkKHJlYWRlcik/LmlubGluZUVkaXRTdGF0ZS5yZWFkKHJlYWRlcikgIT09IHVuZGVmaW5lZCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbnRleHRLZXlTdmNPYnMuYmluZChJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuaW5saW5lU3VnZ2VzdGlvbkhhc0luZGVudGF0aW9uLFxuXHRcdFx0cmVhZGVyID0+IHRoaXMubW9kZWwucmVhZChyZWFkZXIpPy5nZXRJbmRlbnRhdGlvbkluZm8ocmVhZGVyKT8uc3RhcnRzV2l0aEluZGVudGF0aW9uXG5cdFx0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29udGV4dEtleVN2Y09icy5iaW5kKElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5pbmxpbmVTdWdnZXN0aW9uSGFzSW5kZW50YXRpb25MZXNzVGhhblRhYlNpemUsXG5cdFx0XHRyZWFkZXIgPT4gdGhpcy5tb2RlbC5yZWFkKHJlYWRlcik/LmdldEluZGVudGF0aW9uSW5mbyhyZWFkZXIpPy5zdGFydHNXaXRoSW5kZW50YXRpb25MZXNzVGhhblRhYlNpemVcblx0XHQpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0S2V5U3ZjT2JzLmJpbmQoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLnN1cHByZXNzU3VnZ2VzdGlvbnMsIHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMubW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgc3RhdGUgPSBtb2RlbD8uaW5saW5lQ29tcGxldGlvblN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRcdHJldHVybiBzdGF0ZT8ucHJpbWFyeUdob3N0VGV4dCAmJiBzdGF0ZT8uaW5saW5lQ29tcGxldGlvbiA/IHN0YXRlLmlubGluZUNvbXBsZXRpb24uc291cmNlLmlubGluZUNvbXBsZXRpb25zLnN1cHByZXNzU3VnZ2VzdGlvbnMgOiB1bmRlZmluZWQ7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbnRleHRLZXlTdmNPYnMuYmluZChJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuaW5saW5lU3VnZ2VzdGlvblZpc2libGUsIHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMubW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgc3RhdGUgPSBtb2RlbD8uaW5saW5lQ29tcGxldGlvblN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRcdHJldHVybiAhIXN0YXRlPy5pbmxpbmVDb21wbGV0aW9uICYmIHN0YXRlPy5wcmltYXJ5R2hvc3RUZXh0ICE9PSB1bmRlZmluZWQgJiYgIXN0YXRlPy5wcmltYXJ5R2hvc3RUZXh0LmlzRW1wdHkoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0TW9kZWxDaGFuZ2VSZWNvcmRlciwgdGhpcy5lZGl0b3IpKTtcblx0fVxuXG5cdHB1YmxpYyBwbGF5QWNjZXNzaWJpbGl0eVNpZ25hbCh0eDogSVRyYW5zYWN0aW9uKSB7XG5cdFx0dGhpcy5fcGxheUFjY2Vzc2liaWxpdHlTaWduYWwudHJpZ2dlcih0eCk7XG5cdH1cblxuXHRwcml2YXRlIF9wcm92aWRlU2NyZWVuUmVhZGVyVXBkYXRlKGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGFjY2Vzc2libGVWaWV3U2hvd2luZyA9IHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxib29sZWFuPignYWNjZXNzaWJsZVZpZXdJc1Nob3duJyk7XG5cdFx0Y29uc3QgYWNjZXNzaWJsZVZpZXdLZXliaW5kaW5nID0gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZygnZWRpdG9yLmFjdGlvbi5hY2Nlc3NpYmxlVmlldycpO1xuXHRcdGxldCBoaW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCFhY2Nlc3NpYmxlVmlld1Nob3dpbmcgJiYgYWNjZXNzaWJsZVZpZXdLZXliaW5kaW5nICYmIHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uaW5saW5lQ29tcGxldGlvbnNBY2Nlc3NpYmlsaXR5VmVyYm9zZSkpIHtcblx0XHRcdGhpbnQgPSBsb2NhbGl6ZSgnc2hvd0FjY2Vzc2libGVWaWV3SGludCcsIFwiSW5zcGVjdCB0aGlzIGluIHRoZSBhY2Nlc3NpYmxlIHZpZXcgKHswfSlcIiwgYWNjZXNzaWJsZVZpZXdLZXliaW5kaW5nLmdldEFyaWFMYWJlbCgpKTtcblx0XHR9XG5cdFx0YWxlcnQoaGludCA/IGNvbnRlbnQgKyAnLCAnICsgaGludCA6IGNvbnRlbnQpO1xuXHR9XG5cblx0cHVibGljIHNob3VsZFNob3dIb3ZlckF0KHJhbmdlOiBSYW5nZSkge1xuXHRcdGNvbnN0IGdob3N0VGV4dCA9IHRoaXMubW9kZWwuZ2V0KCk/LnByaW1hcnlHaG9zdFRleHQuZ2V0KCk7XG5cdFx0aWYgKCFnaG9zdFRleHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGdob3N0VGV4dC5wYXJ0cy5zb21lKHAgPT4gcmFuZ2UuY29udGFpbnNQb3NpdGlvbihuZXcgUG9zaXRpb24oZ2hvc3RUZXh0LmxpbmVOdW1iZXIsIHAuY29sdW1uKSkpO1xuXHR9XG5cblx0cHVibGljIHNob3VsZFNob3dIb3ZlckF0Vmlld1pvbmUodmlld1pvbmVJZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZpZXcuc2hvdWxkU2hvd0hvdmVyQXRWaWV3Wm9uZSh2aWV3Wm9uZUlkKTtcblx0fVxuXG5cdHB1YmxpYyByZWplY3QoKTogdm9pZCB7XG5cdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0Y29uc3QgbSA9IHRoaXMubW9kZWwuZ2V0KCk7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHRtLnN0b3AoJ2V4cGxpY2l0Q2FuY2VsJywgdHgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGp1bXAoKTogdm9pZCB7XG5cdFx0Y29uc3QgbSA9IHRoaXMubW9kZWwuZ2V0KCk7XG5cdFx0aWYgKG0pIHtcblx0XHRcdG0uanVtcCgpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsWUFBWSxvQkFBb0I7QUFDekMsU0FBdUIsU0FBUyxTQUFTLG1CQUFtQiw0QkFBNEIscUJBQXFCLGtCQUFrQixpQkFBaUIsYUFBYSxzQkFBc0IsYUFBYSxvQkFBb0I7QUFDcE4sU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUIsbUNBQW1DO0FBQ2pFLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsbUNBQW1DO0FBQzVDLFNB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
