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
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { onUnexpectedError, onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { KeyCodeChord } from "../../../../base/common/keybindings.js";
import { DisposableStore, dispose, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { assertType, isObject } from "../../../../base/common/types.js";
import { StableEditorScrollState } from "../../../browser/stableEditorScroll.js";
import { EditorAction, EditorCommand, EditorContributionInstantiation, registerEditorAction, registerEditorCommand, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { EditOperation } from "../../../common/core/editOperation.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { CompletionItemInsertTextRule, CompletionTriggerKind } from "../../../common/languages.js";
import { SnippetController2 } from "../../snippet/browser/snippetController2.js";
import { SnippetParser } from "../../snippet/browser/snippetParser.js";
import { ISuggestMemoryService } from "./suggestMemory.js";
import { WordContextKey } from "./wordContextKey.js";
import * as nls from "../../../../nls.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Context as SuggestContext, suggestWidgetStatusbarMenu } from "./suggest.js";
import { SuggestAlternatives } from "./suggestAlternatives.js";
import { CommitCharacterController } from "./suggestCommitCharacters.js";
import { State, SuggestModel } from "./suggestModel.js";
import { OvertypingCapturer } from "./suggestOvertypingCapturer.js";
import { SuggestWidget } from "./suggestWidget.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { basename, extname } from "../../../../base/common/resources.js";
import { hash } from "../../../../base/common/hash.js";
import { WindowIdleValue, getWindow } from "../../../../base/browser/dom.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
const _sticky = false;
class LineSuffix {
  constructor(_model, _position) {
    this._model = _model;
    this._position = _position;
    this._decorationOptions = ModelDecorationOptions.register({
      description: "suggest-line-suffix",
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    });
    const maxColumn = _model.getLineMaxColumn(_position.lineNumber);
    if (maxColumn !== _position.column) {
      const offset = _model.getOffsetAt(_position);
      const end = _model.getPositionAt(offset + 1);
      _model.changeDecorations((accessor) => {
        if (this._marker) {
          accessor.removeDecoration(this._marker);
        }
        this._marker = accessor.addDecoration(Range.fromPositions(_position, end), this._decorationOptions);
      });
    }
  }
  dispose() {
    if (this._marker && !this._model.isDisposed()) {
      this._model.changeDecorations((accessor) => {
        accessor.removeDecoration(this._marker);
        this._marker = void 0;
      });
    }
  }
  delta(position) {
    if (this._model.isDisposed() || this._position.lineNumber !== position.lineNumber) {
      return 0;
    }
    if (this._marker) {
      const range = this._model.getDecorationRange(this._marker);
      const end = this._model.getOffsetAt(range.getStartPosition());
      return end - this._model.getOffsetAt(position);
    } else {
      return this._model.getLineMaxColumn(position.lineNumber) - position.column;
    }
  }
}
var InsertFlags = /* @__PURE__ */ ((InsertFlags2) => {
  InsertFlags2[InsertFlags2["None"] = 0] = "None";
  InsertFlags2[InsertFlags2["NoBeforeUndoStop"] = 1] = "NoBeforeUndoStop";
  InsertFlags2[InsertFlags2["NoAfterUndoStop"] = 2] = "NoAfterUndoStop";
  InsertFlags2[InsertFlags2["KeepAlternativeSuggestions"] = 4] = "KeepAlternativeSuggestions";
  InsertFlags2[InsertFlags2["AlternativeOverwriteConfig"] = 8] = "AlternativeOverwriteConfig";
  return InsertFlags2;
})(InsertFlags || {});
let SuggestController = class {
  constructor(editor, _memoryService, _commandService, _contextKeyService, _instantiationService, _logService, _telemetryService) {
    this._memoryService = _memoryService;
    this._commandService = _commandService;
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._telemetryService = _telemetryService;
    this._lineSuffix = new MutableDisposable();
    this._toDispose = new DisposableStore();
    this._selectors = new PriorityRegistry((s) => s.priority);
    this._onWillInsertSuggestItem = new Emitter();
    this.onWillInsertSuggestItem = this._onWillInsertSuggestItem.event;
    this.editor = editor;
    this.model = _instantiationService.createInstance(SuggestModel, this.editor);
    this._selectors.register({
      priority: 0,
      select: (model, pos, items) => this._memoryService.select(model, pos, items)
    });
    const ctxInsertMode = SuggestContext.InsertMode.bindTo(_contextKeyService);
    ctxInsertMode.set(editor.getOption(EditorOption.suggest).insertMode);
    this._toDispose.add(this.model.onDidTrigger(() => ctxInsertMode.set(editor.getOption(EditorOption.suggest).insertMode)));
    this.widget = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
      const widget = this._instantiationService.createInstance(SuggestWidget, this.editor);
      this._toDispose.add(widget);
      this._toDispose.add(widget.onDidSelect((item) => this._insertSuggestion(item, 0 /* None */), this));
      const commitCharacterController = new CommitCharacterController(this.editor, widget, this.model, (item) => this._insertSuggestion(item, 2 /* NoAfterUndoStop */));
      this._toDispose.add(commitCharacterController);
      const ctxMakesTextEdit = SuggestContext.MakesTextEdit.bindTo(this._contextKeyService);
      const ctxHasInsertAndReplace = SuggestContext.HasInsertAndReplaceRange.bindTo(this._contextKeyService);
      const ctxCanResolve = SuggestContext.CanResolve.bindTo(this._contextKeyService);
      this._toDispose.add(toDisposable(() => {
        ctxMakesTextEdit.reset();
        ctxHasInsertAndReplace.reset();
        ctxCanResolve.reset();
      }));
      this._toDispose.add(widget.onDidFocus(({ item }) => {
        const position = this.editor.getPosition();
        const startColumn = item.editStart.column;
        const endColumn = position.column;
        let value = true;
        if (this.editor.getOption(EditorOption.acceptSuggestionOnEnter) === "smart" && this.model.state === State.Auto && !item.completion.additionalTextEdits && !(item.completion.insertTextRules & CompletionItemInsertTextRule.InsertAsSnippet) && endColumn - startColumn === item.completion.insertText.length) {
          const oldText = this.editor.getModel().getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn,
            endLineNumber: position.lineNumber,
            endColumn
          });
          value = oldText !== item.completion.insertText;
        }
        ctxMakesTextEdit.set(value);
        ctxHasInsertAndReplace.set(!Position.equals(item.editInsertEnd, item.editReplaceEnd));
        ctxCanResolve.set(Boolean(item.provider.resolveCompletionItem) || Boolean(item.completion.documentation) || item.completion.detail !== item.completion.label);
      }));
      this._toDispose.add(widget.onDetailsKeyDown((e) => {
        if (e.toKeyCodeChord().equals(new KeyCodeChord(true, false, false, false, KeyCode.KeyC)) || platform.isMacintosh && e.toKeyCodeChord().equals(new KeyCodeChord(false, false, false, true, KeyCode.KeyC))) {
          e.stopPropagation();
          return;
        }
        if (!e.toKeyCodeChord().isModifierKey()) {
          this.editor.focus();
        }
      }));
      return widget;
    }));
    this._overtypingCapturer = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
      return this._toDispose.add(new OvertypingCapturer(this.editor, this.model));
    }));
    this._alternatives = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
      return this._toDispose.add(new SuggestAlternatives(this.editor, this._contextKeyService));
    }));
    this._toDispose.add(_instantiationService.createInstance(WordContextKey, editor));
    this._toDispose.add(this.model.onDidTrigger((e) => {
      this.widget.value.showTriggered(e.auto, e.shy ? 250 : 50);
      this._lineSuffix.value = new LineSuffix(this.editor.getModel(), e.position);
    }));
    this._toDispose.add(this.model.onDidSuggest((e) => {
      if (e.triggerOptions.shy) {
        return;
      }
      let index = -1;
      for (const selector of this._selectors.itemsOrderedByPriorityDesc) {
        index = selector.select(this.editor.getModel(), this.editor.getPosition(), e.completionModel.items);
        if (index !== -1) {
          break;
        }
      }
      if (index === -1) {
        index = 0;
      }
      if (this.model.state === State.Idle) {
        return;
      }
      let noFocus = false;
      if (e.triggerOptions.auto) {
        const options = this.editor.getOption(EditorOption.suggest);
        if (options.selectionMode === "never" || options.selectionMode === "always") {
          noFocus = options.selectionMode === "never";
        } else if (options.selectionMode === "whenTriggerCharacter") {
          noFocus = e.triggerOptions.triggerKind !== CompletionTriggerKind.TriggerCharacter;
        } else if (options.selectionMode === "whenQuickSuggestion") {
          noFocus = e.triggerOptions.triggerKind === CompletionTriggerKind.TriggerCharacter && !e.triggerOptions.refilter;
        }
      }
      this.widget.value.showSuggestions(e.completionModel, index, e.isFrozen, e.triggerOptions.auto, noFocus);
    }));
    this._toDispose.add(this.model.onDidCancel((e) => {
      if (!e.retrigger) {
        this.widget.value.hideWidget();
      }
    }));
    this._toDispose.add(this.editor.onDidBlurEditorWidget(() => {
      if (!_sticky) {
        this.model.cancel();
        this.model.clear();
      }
    }));
    const acceptSuggestionsOnEnter = SuggestContext.AcceptSuggestionsOnEnter.bindTo(_contextKeyService);
    const updateFromConfig = () => {
      const acceptSuggestionOnEnter = this.editor.getOption(EditorOption.acceptSuggestionOnEnter);
      acceptSuggestionsOnEnter.set(acceptSuggestionOnEnter === "on" || acceptSuggestionOnEnter === "smart");
    };
    this._toDispose.add(this.editor.onDidChangeConfiguration(() => updateFromConfig()));
    updateFromConfig();
  }
  static get(editor) {
    return editor.getContribution(SuggestController.ID);
  }
  dispose() {
    this._alternatives.dispose();
    this._toDispose.dispose();
    this.widget.dispose();
    this.model.dispose();
    this._lineSuffix.dispose();
    this._onWillInsertSuggestItem.dispose();
  }
  _insertSuggestion(event, flags) {
    if (!event || !event.item) {
      this._alternatives.value.reset();
      this.model.cancel();
      this.model.clear();
      return;
    }
    if (!this.editor.hasModel()) {
      return;
    }
    const snippetController = SnippetController2.get(this.editor);
    if (!snippetController) {
      return;
    }
    this._onWillInsertSuggestItem.fire({ item: event.item });
    const model = this.editor.getModel();
    const modelVersionNow = model.getAlternativeVersionId();
    const { item } = event;
    const tasks = [];
    const cts = new CancellationTokenSource();
    if (!(flags & 1 /* NoBeforeUndoStop */)) {
      this.editor.pushUndoStop();
    }
    const info = this.getOverwriteInfo(item, Boolean(flags & 8 /* AlternativeOverwriteConfig */));
    this._memoryService.memorize(model, this.editor.getPosition(), item);
    const isResolved = item.isResolved;
    let _commandExectionDuration = -1;
    let _additionalEditsAppliedAsync = -1;
    if (Array.isArray(item.completion.additionalTextEdits)) {
      this.model.cancel();
      const scrollState = StableEditorScrollState.capture(this.editor);
      this.editor.executeEdits(
        "suggestController.additionalTextEdits.sync",
        item.completion.additionalTextEdits.map((edit) => {
          let range = Range.lift(edit.range);
          if (range.startLineNumber === item.position.lineNumber && range.startColumn > item.position.column) {
            const columnDelta = this.editor.getPosition().column - item.position.column;
            const startColumnDelta = columnDelta;
            const endColumnDelta = Range.spansMultipleLines(range) ? 0 : columnDelta;
            range = new Range(range.startLineNumber, range.startColumn + startColumnDelta, range.endLineNumber, range.endColumn + endColumnDelta);
          }
          return EditOperation.replaceMove(range, edit.text);
        })
      );
      scrollState.restoreRelativeVerticalPositionOfCursor(this.editor);
    } else if (!isResolved) {
      const sw = new StopWatch();
      let position;
      const docListener = model.onDidChangeContent((e) => {
        if (e.isFlush) {
          cts.cancel();
          docListener.dispose();
          return;
        }
        for (const change of e.changes) {
          const thisPosition = Range.getEndPosition(change.range);
          if (!position || Position.isBefore(thisPosition, position)) {
            position = thisPosition;
          }
        }
      });
      const oldFlags = flags;
      flags |= 2 /* NoAfterUndoStop */;
      let didType = false;
      const typeListener = this.editor.onWillType(() => {
        typeListener.dispose();
        didType = true;
        if (!(oldFlags & 2 /* NoAfterUndoStop */)) {
          this.editor.pushUndoStop();
        }
      });
      tasks.push(item.resolve(cts.token).then(() => {
        if (!item.completion.additionalTextEdits || cts.token.isCancellationRequested) {
          return void 0;
        }
        if (position && item.completion.additionalTextEdits.some((edit) => Position.isBefore(position, Range.getStartPosition(edit.range)))) {
          return false;
        }
        if (didType) {
          this.editor.pushUndoStop();
        }
        const scrollState = StableEditorScrollState.capture(this.editor);
        this.editor.executeEdits(
          "suggestController.additionalTextEdits.async",
          item.completion.additionalTextEdits.map((edit) => EditOperation.replaceMove(Range.lift(edit.range), edit.text))
        );
        scrollState.restoreRelativeVerticalPositionOfCursor(this.editor);
        if (didType || !(oldFlags & 2 /* NoAfterUndoStop */)) {
          this.editor.pushUndoStop();
        }
        return true;
      }).then((applied) => {
        this._logService.trace("[suggest] async resolving of edits DONE (ms, applied?)", sw.elapsed(), applied);
        _additionalEditsAppliedAsync = applied === true ? 1 : applied === false ? 0 : -2;
      }).finally(() => {
        docListener.dispose();
        typeListener.dispose();
      }));
    }
    let { insertText } = item.completion;
    if (!(item.completion.insertTextRules & CompletionItemInsertTextRule.InsertAsSnippet)) {
      insertText = SnippetParser.escape(insertText);
    }
    this.model.cancel();
    snippetController.insert(insertText, {
      overwriteBefore: info.overwriteBefore,
      overwriteAfter: info.overwriteAfter,
      undoStopBefore: false,
      undoStopAfter: false,
      adjustWhitespace: !(item.completion.insertTextRules & CompletionItemInsertTextRule.KeepWhitespace),
      clipboardText: event.model.clipboardText,
      overtypingCapturer: this._overtypingCapturer.value
    });
    if (!(flags & 2 /* NoAfterUndoStop */)) {
      this.editor.pushUndoStop();
    }
    if (item.completion.command) {
      if (item.completion.command.id === TriggerSuggestAction.id) {
        this.model.trigger({ auto: true, retrigger: true });
      } else {
        const sw = new StopWatch();
        tasks.push(this._commandService.executeCommand(item.completion.command.id, ...item.completion.command.arguments ? [...item.completion.command.arguments] : []).catch((e) => {
          if (item.completion.extensionId) {
            onUnexpectedExternalError(e);
          } else {
            onUnexpectedError(e);
          }
        }).finally(() => {
          _commandExectionDuration = sw.elapsed();
        }));
      }
    }
    if (flags & 4 /* KeepAlternativeSuggestions */) {
      this._alternatives.value.set(event, (next) => {
        cts.cancel();
        while (model.canUndo()) {
          if (modelVersionNow !== model.getAlternativeVersionId()) {
            model.undo();
          }
          this._insertSuggestion(
            next,
            1 /* NoBeforeUndoStop */ | 2 /* NoAfterUndoStop */ | (flags & 8 /* AlternativeOverwriteConfig */ ? 8 /* AlternativeOverwriteConfig */ : 0)
          );
          break;
        }
      });
    }
    this._alertCompletionItem(item);
    Promise.all(tasks).finally(() => {
      this._reportSuggestionAcceptedTelemetry(item, model, isResolved, _commandExectionDuration, _additionalEditsAppliedAsync, event.index, event.model.items);
      this.model.clear();
      cts.dispose();
    });
  }
  _reportSuggestionAcceptedTelemetry(item, model, itemResolved, commandExectionDuration, additionalEditsAppliedAsync, index, completionItems) {
    if (Math.random() > 1e-4) {
      return;
    }
    const labelMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < Math.min(30, completionItems.length); i++) {
      const label = completionItems[i].textLabel;
      if (labelMap.has(label)) {
        labelMap.get(label).push(i);
      } else {
        labelMap.set(label, [i]);
      }
    }
    const firstIndexArray = labelMap.get(item.textLabel);
    const hasDuplicates = firstIndexArray && firstIndexArray.length > 1;
    const firstIndex = hasDuplicates ? firstIndexArray[0] : -1;
    this._telemetryService.publicLog2("suggest.acceptedSuggestion", {
      extensionId: item.extensionId?.value ?? "unknown",
      providerId: item.provider._debugDisplayName ?? "unknown",
      kind: item.completion.kind,
      basenameHash: hash(basename(model.uri)).toString(16),
      languageId: model.getLanguageId(),
      fileExtension: extname(model.uri),
      resolveInfo: !item.provider.resolveCompletionItem ? -1 : itemResolved ? 1 : 0,
      resolveDuration: item.resolveDuration,
      commandDuration: commandExectionDuration,
      additionalEditsAsync: additionalEditsAppliedAsync,
      index,
      firstIndex
    });
  }
  getOverwriteInfo(item, toggleMode) {
    assertType(this.editor.hasModel());
    let replace = this.editor.getOption(EditorOption.suggest).insertMode === "replace";
    if (toggleMode) {
      replace = !replace;
    }
    const overwriteBefore = item.position.column - item.editStart.column;
    const overwriteAfter = (replace ? item.editReplaceEnd.column : item.editInsertEnd.column) - item.position.column;
    const columnDelta = this.editor.getPosition().column - item.position.column;
    const suffixDelta = this._lineSuffix.value ? this._lineSuffix.value.delta(this.editor.getPosition()) : 0;
    return {
      overwriteBefore: overwriteBefore + columnDelta,
      overwriteAfter: overwriteAfter + suffixDelta
    };
  }
  _alertCompletionItem(item) {
    if (isNonEmptyArray(item.completion.additionalTextEdits)) {
      const msg = nls.localize("aria.alert.snippet", "Accepting '{0}' made {1} additional edits", item.textLabel, item.completion.additionalTextEdits.length);
      alert(msg);
    }
  }
  triggerSuggest(onlyFrom, auto, noFilter) {
    if (this.editor.hasModel()) {
      this.model.trigger({
        auto: auto ?? false,
        completionOptions: { providerFilter: onlyFrom, kindFilter: noFilter ? /* @__PURE__ */ new Set() : void 0 }
      });
      this.editor.revealPosition(this.editor.getPosition(), ScrollType.Smooth);
      this.editor.focus();
    }
  }
  triggerSuggestAndAcceptBest(arg) {
    if (!this.editor.hasModel()) {
      return;
    }
    const positionNow = this.editor.getPosition();
    const fallback = () => {
      if (positionNow.equals(this.editor.getPosition())) {
        this._commandService.executeCommand(arg.fallback);
      }
    };
    const makesTextEdit = (item) => {
      if (item.completion.insertTextRules & CompletionItemInsertTextRule.InsertAsSnippet || item.completion.additionalTextEdits) {
        return true;
      }
      const position = this.editor.getPosition();
      const startColumn = item.editStart.column;
      const endColumn = position.column;
      if (endColumn - startColumn !== item.completion.insertText.length) {
        return true;
      }
      const textNow = this.editor.getModel().getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn,
        endLineNumber: position.lineNumber,
        endColumn
      });
      return textNow !== item.completion.insertText;
    };
    Event.once(this.model.onDidTrigger)((_) => {
      const listener = [];
      Event.any(this.model.onDidTrigger, this.model.onDidCancel)(() => {
        dispose(listener);
        fallback();
      }, void 0, listener);
      this.model.onDidSuggest(({ completionModel }) => {
        dispose(listener);
        if (completionModel.items.length === 0) {
          fallback();
          return;
        }
        const index = this._memoryService.select(this.editor.getModel(), this.editor.getPosition(), completionModel.items);
        const item = completionModel.items[index];
        if (!makesTextEdit(item)) {
          fallback();
          return;
        }
        this.editor.pushUndoStop();
        this._insertSuggestion({ index, item, model: completionModel }, 4 /* KeepAlternativeSuggestions */ | 1 /* NoBeforeUndoStop */ | 2 /* NoAfterUndoStop */);
      }, void 0, listener);
    });
    this.model.trigger({ auto: false, shy: true });
    this.editor.revealPosition(positionNow, ScrollType.Smooth);
    this.editor.focus();
  }
  acceptSelectedSuggestion(keepAlternativeSuggestions, alternativeOverwriteConfig) {
    const item = this.widget.value.getFocusedItem();
    let flags = 0;
    if (keepAlternativeSuggestions) {
      flags |= 4 /* KeepAlternativeSuggestions */;
    }
    if (alternativeOverwriteConfig) {
      flags |= 8 /* AlternativeOverwriteConfig */;
    }
    this._insertSuggestion(item, flags);
  }
  acceptNextSuggestion() {
    this._alternatives.value.next();
  }
  acceptPrevSuggestion() {
    this._alternatives.value.prev();
  }
  cancelSuggestWidget() {
    this.model.cancel();
    this.model.clear();
    this.widget.value.hideWidget();
  }
  focusSuggestion() {
    this.widget.value.focusSelected();
  }
  selectNextSuggestion() {
    this.widget.value.selectNext();
  }
  selectNextPageSuggestion() {
    this.widget.value.selectNextPage();
  }
  selectLastSuggestion() {
    this.widget.value.selectLast();
  }
  selectPrevSuggestion() {
    this.widget.value.selectPrevious();
  }
  selectPrevPageSuggestion() {
    this.widget.value.selectPreviousPage();
  }
  selectFirstSuggestion() {
    this.widget.value.selectFirst();
  }
  toggleSuggestionDetails() {
    this.widget.value.toggleDetails();
  }
  toggleExplainMode() {
    this.widget.value.toggleExplainMode();
  }
  toggleSuggestionFocus() {
    this.widget.value.toggleDetailsFocus();
  }
  resetWidgetSize() {
    this.widget.value.resetPersistedSize();
  }
  forceRenderingAbove() {
    this.widget.value.forceRenderingAbove();
  }
  stopForceRenderingAbove() {
    if (!this.widget.isInitialized) {
      return;
    }
    this.widget.value.stopForceRenderingAbove();
  }
  registerSelector(selector) {
    return this._selectors.register(selector);
  }
};
SuggestController.ID = "editor.contrib.suggestController";
SuggestController = __decorateClass([
  __decorateParam(1, ISuggestMemoryService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ILogService),
  __decorateParam(6, ITelemetryService)
], SuggestController);
class PriorityRegistry {
  constructor(prioritySelector) {
    this.prioritySelector = prioritySelector;
    this._items = new Array();
  }
  register(value) {
    if (this._items.indexOf(value) !== -1) {
      throw new Error("Value is already registered");
    }
    this._items.push(value);
    this._items.sort((s1, s2) => this.prioritySelector(s2) - this.prioritySelector(s1));
    return {
      dispose: () => {
        const idx = this._items.indexOf(value);
        if (idx >= 0) {
          this._items.splice(idx, 1);
        }
      }
    };
  }
  get itemsOrderedByPriorityDesc() {
    return this._items;
  }
}
const _TriggerSuggestAction = class _TriggerSuggestAction extends EditorAction {
  constructor() {
    super({
      id: _TriggerSuggestAction.id,
      label: nls.localize2("suggest.trigger.label", "Trigger Suggest"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasCompletionItemProvider, SuggestContext.Visible.toNegated()),
      kbOpts: {
        kbExpr: EditorContextKeys.textInputFocus,
        primary: KeyMod.CtrlCmd | KeyCode.Space,
        secondary: [KeyMod.CtrlCmd | KeyCode.KeyI],
        mac: { primary: KeyMod.WinCtrl | KeyCode.Space, secondary: [KeyMod.Alt | KeyCode.Escape, KeyMod.CtrlCmd | KeyCode.KeyI] },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(_accessor, editor, args) {
    const controller = SuggestController.get(editor);
    if (!controller) {
      return;
    }
    let auto;
    if (args && typeof args === "object") {
      if (args.auto === true) {
        auto = true;
      }
    }
    controller.triggerSuggest(void 0, auto, void 0);
  }
};
_TriggerSuggestAction.id = "editor.action.triggerSuggest";
let TriggerSuggestAction = _TriggerSuggestAction;
registerEditorContribution(SuggestController.ID, SuggestController, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorAction(TriggerSuggestAction);
const weight = KeybindingWeight.EditorContrib + 90;
const SuggestCommand = EditorCommand.bindToContribution(SuggestController.get);
registerEditorCommand(new SuggestCommand({
  id: "acceptSelectedSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion),
  handler(x) {
    x.acceptSelectedSuggestion(true, false);
  },
  kbOpts: [{
    // normal tab
    primary: KeyCode.Tab,
    kbExpr: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus),
    weight
  }, {
    // accept on enter has special rules
    primary: KeyCode.Enter,
    kbExpr: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus, SuggestContext.AcceptSuggestionsOnEnter, SuggestContext.MakesTextEdit),
    weight
  }],
  menuOpts: [{
    menuId: suggestWidgetStatusbarMenu,
    title: nls.localize("accept.insert", "Insert"),
    group: "left",
    order: 1,
    when: SuggestContext.HasInsertAndReplaceRange.toNegated()
  }, {
    menuId: suggestWidgetStatusbarMenu,
    title: nls.localize("accept.insert", "Insert"),
    group: "left",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo("insert"))
  }, {
    menuId: suggestWidgetStatusbarMenu,
    title: nls.localize("accept.replace", "Replace"),
    group: "left",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo("replace"))
  }]
}));
registerEditorCommand(new SuggestCommand({
  id: "acceptAlternativeSelectedSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus, SuggestContext.HasFocusedSuggestion),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.Shift | KeyCode.Enter,
    secondary: [KeyMod.Shift | KeyCode.Tab]
  },
  handler(x) {
    x.acceptSelectedSuggestion(false, true);
  },
  menuOpts: [{
    menuId: suggestWidgetStatusbarMenu,
    group: "left",
    order: 2,
    when: ContextKeyExpr.and(SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo("insert")),
    title: nls.localize("accept.replace", "Replace")
  }, {
    menuId: suggestWidgetStatusbarMenu,
    group: "left",
    order: 2,
    when: ContextKeyExpr.and(SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo("replace")),
    title: nls.localize("accept.insert", "Insert")
  }]
}));
CommandsRegistry.registerCommandAlias("acceptSelectedSuggestionOnEnter", "acceptSelectedSuggestion");
registerEditorCommand(new SuggestCommand({
  id: "hideSuggestWidget",
  precondition: SuggestContext.Visible,
  handler: (x) => x.cancelSuggestWidget(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.Escape,
    secondary: [KeyMod.Shift | KeyCode.Escape]
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectNextSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectNextSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.DownArrow,
    secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow],
    mac: { primary: KeyCode.DownArrow, secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow, KeyMod.WinCtrl | KeyCode.KeyN] }
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectNextPageSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectNextPageSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.PageDown,
    secondary: [KeyMod.CtrlCmd | KeyCode.PageDown]
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectLastSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectLastSuggestion()
}));
registerEditorCommand(new SuggestCommand({
  id: "selectPrevSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectPrevSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.UpArrow,
    secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow],
    mac: { primary: KeyCode.UpArrow, secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow, KeyMod.WinCtrl | KeyCode.KeyP] }
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectPrevPageSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectPrevPageSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.PageUp,
    secondary: [KeyMod.CtrlCmd | KeyCode.PageUp]
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "selectFirstSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
  handler: (c) => c.selectFirstSuggestion()
}));
registerEditorCommand(new SuggestCommand({
  id: "focusSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion.negate()),
  handler: (x) => x.focusSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.CtrlCmd | KeyCode.Space,
    secondary: [KeyMod.CtrlCmd | KeyCode.KeyI],
    mac: { primary: KeyMod.WinCtrl | KeyCode.Space, secondary: [KeyMod.CtrlCmd | KeyCode.KeyI] }
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "focusAndAcceptSuggestion",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion.negate()),
  handler: (c) => {
    c.focusSuggestion();
    c.acceptSelectedSuggestion(true, false);
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "toggleSuggestionDetails",
  precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion),
  handler: (x) => x.toggleSuggestionDetails(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.CtrlCmd | KeyCode.Space,
    secondary: [KeyMod.CtrlCmd | KeyCode.KeyI],
    mac: { primary: KeyMod.WinCtrl | KeyCode.Space, secondary: [KeyMod.CtrlCmd | KeyCode.KeyI] }
  },
  menuOpts: [{
    menuId: suggestWidgetStatusbarMenu,
    group: "right",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.DetailsVisible, SuggestContext.CanResolve),
    title: nls.localize("detail.more", "Show Less")
  }, {
    menuId: suggestWidgetStatusbarMenu,
    group: "right",
    order: 1,
    when: ContextKeyExpr.and(SuggestContext.DetailsVisible.toNegated(), SuggestContext.CanResolve),
    title: nls.localize("detail.less", "Show More")
  }]
}));
registerEditorCommand(new SuggestCommand({
  id: "toggleExplainMode",
  precondition: SuggestContext.Visible,
  handler: (x) => x.toggleExplainMode(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib,
    primary: KeyMod.CtrlCmd | KeyCode.Slash
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "toggleSuggestionFocus",
  precondition: SuggestContext.Visible,
  handler: (x) => x.toggleSuggestionFocus(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Space,
    mac: { primary: KeyMod.WinCtrl | KeyMod.Alt | KeyCode.Space }
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "insertBestCompletion",
  precondition: ContextKeyExpr.and(
    EditorContextKeys.textInputFocus,
    ContextKeyExpr.equals("config.editor.tabCompletion", "on"),
    WordContextKey.AtEnd,
    SuggestContext.Visible.toNegated(),
    SuggestAlternatives.OtherSuggestions.toNegated(),
    SnippetController2.InSnippetMode.toNegated()
  ),
  handler: (x, arg) => {
    x.triggerSuggestAndAcceptBest(isObject(arg) ? { fallback: "tab", ...arg } : { fallback: "tab" });
  },
  kbOpts: {
    weight,
    primary: KeyCode.Tab
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "insertNextSuggestion",
  precondition: ContextKeyExpr.and(
    EditorContextKeys.textInputFocus,
    ContextKeyExpr.equals("config.editor.tabCompletion", "on"),
    SuggestAlternatives.OtherSuggestions,
    SuggestContext.Visible.toNegated(),
    SnippetController2.InSnippetMode.toNegated()
  ),
  handler: (x) => x.acceptNextSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyCode.Tab
  }
}));
registerEditorCommand(new SuggestCommand({
  id: "insertPrevSuggestion",
  precondition: ContextKeyExpr.and(
    EditorContextKeys.textInputFocus,
    ContextKeyExpr.equals("config.editor.tabCompletion", "on"),
    SuggestAlternatives.OtherSuggestions,
    SuggestContext.Visible.toNegated(),
    SnippetController2.InSnippetMode.toNegated()
  ),
  handler: (x) => x.acceptPrevSuggestion(),
  kbOpts: {
    weight,
    kbExpr: EditorContextKeys.textInputFocus,
    primary: KeyMod.Shift | KeyCode.Tab
  }
}));
registerEditorAction(class extends EditorAction {
  constructor() {
    super({
      id: "editor.action.resetSuggestSize",
      label: nls.localize2("suggest.reset.label", "Reset Suggest Widget Size"),
      precondition: void 0
    });
  }
  run(_accessor, editor) {
    SuggestController.get(editor)?.resetWidgetSize();
  }
});
export {
  SuggestController,
  TriggerSuggestAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdENvbnRyb2xsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBhbGVydCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgaXNOb25FbXB0eUFycmF5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yLCBvblVuZXhwZWN0ZWRFeHRlcm5hbEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZUNob3JkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgYXNzZXJ0VHlwZSwgaXNPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBTdGFibGVFZGl0b3JTY3JvbGxTdGF0ZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvc3RhYmxlRWRpdG9yU2Nyb2xsLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgRWRpdG9yQ29tbWFuZCwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQ29tbWFuZCwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiwgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb250cmlidXRpb24sIFNjcm9sbFR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgQ29tcGxldGlvbkl0ZW1JbnNlcnRUZXh0UnVsZSwgQ29tcGxldGlvbkl0ZW1Qcm92aWRlciwgQ29tcGxldGlvblRyaWdnZXJLaW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0Q29udHJvbGxlcjIgfSBmcm9tICcuLi8uLi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldENvbnRyb2xsZXIyLmpzJztcbmltcG9ydCB7IFNuaXBwZXRQYXJzZXIgfSBmcm9tICcuLi8uLi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFBhcnNlci5qcyc7XG5pbXBvcnQgeyBJU3VnZ2VzdE1lbW9yeVNlcnZpY2UgfSBmcm9tICcuL3N1Z2dlc3RNZW1vcnkuanMnO1xuaW1wb3J0IHsgV29yZENvbnRleHRLZXkgfSBmcm9tICcuL3dvcmRDb250ZXh0S2V5LmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uSXRlbSwgQ29udGV4dCBhcyBTdWdnZXN0Q29udGV4dCwgSVN1Z2dlc3RJdGVtUHJlc2VsZWN0b3IsIHN1Z2dlc3RXaWRnZXRTdGF0dXNiYXJNZW51IH0gZnJvbSAnLi9zdWdnZXN0LmpzJztcbmltcG9ydCB7IFN1Z2dlc3RBbHRlcm5hdGl2ZXMgfSBmcm9tICcuL3N1Z2dlc3RBbHRlcm5hdGl2ZXMuanMnO1xuaW1wb3J0IHsgQ29tbWl0Q2hhcmFjdGVyQ29udHJvbGxlciB9IGZyb20gJy4vc3VnZ2VzdENvbW1pdENoYXJhY3RlcnMuanMnO1xuaW1wb3J0IHsgU3RhdGUsIFN1Z2dlc3RNb2RlbCB9IGZyb20gJy4vc3VnZ2VzdE1vZGVsLmpzJztcbmltcG9ydCB7IE92ZXJ0eXBpbmdDYXB0dXJlciB9IGZyb20gJy4vc3VnZ2VzdE92ZXJ0eXBpbmdDYXB0dXJlci5qcyc7XG5pbXBvcnQgeyBJU2VsZWN0ZWRTdWdnZXN0aW9uLCBTdWdnZXN0V2lkZ2V0IH0gZnJvbSAnLi9zdWdnZXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGV4dG5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgV2luZG93SWRsZVZhbHVlLCBnZXRXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcblxuLy8gc3RpY2t5IHN1Z2dlc3Qgd2lkZ2V0IHdoaWNoIGRvZXNuJ3QgZGlzYXBwZWFyIG9uIGZvY3VzIG91dCBhbmQgc3VjaFxuY29uc3QgX3N0aWNreSA9IGZhbHNlXG5cdC8vIHx8IEJvb2xlYW4oXCJ0cnVlXCIpIC8vIGRvbmUgXCJ3ZWlyZGx5XCIgc28gdGhhdCBhIGxpbnQgd2FybmluZyBwcmV2ZW50cyB5b3UgZnJvbSBwdXNoaW5nIHRoaXNcblx0O1xuXG5jbGFzcyBMaW5lU3VmZml4IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uT3B0aW9ucyA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoe1xuXHRcdGRlc2NyaXB0aW9uOiAnc3VnZ2VzdC1saW5lLXN1ZmZpeCcsXG5cdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXNcblx0fSk7XG5cblx0cHJpdmF0ZSBfbWFya2VyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElUZXh0TW9kZWwsIHByaXZhdGUgcmVhZG9ubHkgX3Bvc2l0aW9uOiBJUG9zaXRpb24pIHtcblx0XHQvLyBzcHkgb24gd2hhdCdzIGhhcHBlbmluZyByaWdodCBvZiB0aGUgY3Vyc29yLiB0d28gY2FzZXM6XG5cdFx0Ly8gMS4gZW5kIG9mIGxpbmUgLT4gY2hlY2sgdGhhdCBpdCdzIHN0aWxsIGVuZCBvZiBsaW5lXG5cdFx0Ly8gMi4gbWlkIG9mIGxpbmUgLT4gYWRkIGEgbWFya2VyIGFuZCBjb21wdXRlIHRoZSBkZWx0YVxuXHRcdGNvbnN0IG1heENvbHVtbiA9IF9tb2RlbC5nZXRMaW5lTWF4Q29sdW1uKF9wb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRpZiAobWF4Q29sdW1uICE9PSBfcG9zaXRpb24uY29sdW1uKSB7XG5cdFx0XHRjb25zdCBvZmZzZXQgPSBfbW9kZWwuZ2V0T2Zmc2V0QXQoX3Bvc2l0aW9uKTtcblx0XHRcdGNvbnN0IGVuZCA9IF9tb2RlbC5nZXRQb3NpdGlvbkF0KG9mZnNldCArIDEpO1xuXHRcdFx0X21vZGVsLmNoYW5nZURlY29yYXRpb25zKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX21hcmtlcikge1xuXHRcdFx0XHRcdGFjY2Vzc29yLnJlbW92ZURlY29yYXRpb24odGhpcy5fbWFya2VyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9tYXJrZXIgPSBhY2Nlc3Nvci5hZGREZWNvcmF0aW9uKFJhbmdlLmZyb21Qb3NpdGlvbnMoX3Bvc2l0aW9uLCBlbmQpLCB0aGlzLl9kZWNvcmF0aW9uT3B0aW9ucyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9tYXJrZXIgJiYgIXRoaXMuX21vZGVsLmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0dGhpcy5fbW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVEZWNvcmF0aW9uKHRoaXMuX21hcmtlciEpO1xuXHRcdFx0XHR0aGlzLl9tYXJrZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRkZWx0YShwb3NpdGlvbjogSVBvc2l0aW9uKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5fbW9kZWwuaXNEaXNwb3NlZCgpIHx8IHRoaXMuX3Bvc2l0aW9uLmxpbmVOdW1iZXIgIT09IHBvc2l0aW9uLmxpbmVOdW1iZXIpIHtcblx0XHRcdC8vIGJhaWwgb3V0IGVhcmx5IGlmIHRoaW5ncyBzZWVtcyBmaXNoeVxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdC8vIHJlYWQgdGhlIG1hcmtlciAoaW4gY2FzZSBzdWdnZXN0IHdhcyB0cmlnZ2VyZWQgYXQgbGluZSBlbmQpIG9yIGNvbXBhcmVcblx0XHQvLyB0aGUgY3Vyc29yIHRvIHRoZSBsaW5lIGVuZC5cblx0XHRpZiAodGhpcy5fbWFya2VyKSB7XG5cdFx0XHRjb25zdCByYW5nZSA9IHRoaXMuX21vZGVsLmdldERlY29yYXRpb25SYW5nZSh0aGlzLl9tYXJrZXIpO1xuXHRcdFx0Y29uc3QgZW5kID0gdGhpcy5fbW9kZWwuZ2V0T2Zmc2V0QXQocmFuZ2UhLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0XHRyZXR1cm4gZW5kIC0gdGhpcy5fbW9kZWwuZ2V0T2Zmc2V0QXQocG9zaXRpb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuZ2V0TGluZU1heENvbHVtbihwb3NpdGlvbi5saW5lTnVtYmVyKSAtIHBvc2l0aW9uLmNvbHVtbjtcblx0XHR9XG5cdH1cbn1cblxuY29uc3QgZW51bSBJbnNlcnRGbGFncyB7XG5cdE5vbmUgPSAwLFxuXHROb0JlZm9yZVVuZG9TdG9wID0gMSxcblx0Tm9BZnRlclVuZG9TdG9wID0gMixcblx0S2VlcEFsdGVybmF0aXZlU3VnZ2VzdGlvbnMgPSA0LFxuXHRBbHRlcm5hdGl2ZU92ZXJ3cml0ZUNvbmZpZyA9IDhcbn1cblxuZXhwb3J0IGNsYXNzIFN1Z2dlc3RDb250cm9sbGVyIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRDogc3RyaW5nID0gJ2VkaXRvci5jb250cmliLnN1Z2dlc3RDb250cm9sbGVyJztcblxuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogU3VnZ2VzdENvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxTdWdnZXN0Q29udHJvbGxlcj4oU3VnZ2VzdENvbnRyb2xsZXIuSUQpO1xuXHR9XG5cblx0cmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvcjtcblx0cmVhZG9ubHkgbW9kZWw6IFN1Z2dlc3RNb2RlbDtcblx0cmVhZG9ubHkgd2lkZ2V0OiBXaW5kb3dJZGxlVmFsdWU8U3VnZ2VzdFdpZGdldD47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWx0ZXJuYXRpdmVzOiBXaW5kb3dJZGxlVmFsdWU8U3VnZ2VzdEFsdGVybmF0aXZlcz47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpbmVTdWZmaXggPSBuZXcgTXV0YWJsZURpc3Bvc2FibGU8TGluZVN1ZmZpeD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfdG9EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vdmVydHlwaW5nQ2FwdHVyZXI6IFdpbmRvd0lkbGVWYWx1ZTxPdmVydHlwaW5nQ2FwdHVyZXI+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zZWxlY3RvcnMgPSBuZXcgUHJpb3JpdHlSZWdpc3RyeTxJU3VnZ2VzdEl0ZW1QcmVzZWxlY3Rvcj4ocyA9PiBzLnByaW9yaXR5KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxJbnNlcnRTdWdnZXN0SXRlbSA9IG5ldyBFbWl0dGVyPHsgaXRlbTogQ29tcGxldGlvbkl0ZW0gfT4oKTtcblx0cmVhZG9ubHkgb25XaWxsSW5zZXJ0U3VnZ2VzdEl0ZW06IEV2ZW50PHsgaXRlbTogQ29tcGxldGlvbkl0ZW0gfT4gPSB0aGlzLl9vbldpbGxJbnNlcnRTdWdnZXN0SXRlbS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJU3VnZ2VzdE1lbW9yeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWVtb3J5U2VydmljZTogSVN1Z2dlc3RNZW1vcnlTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMubW9kZWwgPSBfaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3VnZ2VzdE1vZGVsLCB0aGlzLmVkaXRvciwpO1xuXG5cdFx0Ly8gZGVmYXVsdCBzZWxlY3RvclxuXHRcdHRoaXMuX3NlbGVjdG9ycy5yZWdpc3Rlcih7XG5cdFx0XHRwcmlvcml0eTogMCxcblx0XHRcdHNlbGVjdDogKG1vZGVsLCBwb3MsIGl0ZW1zKSA9PiB0aGlzLl9tZW1vcnlTZXJ2aWNlLnNlbGVjdChtb2RlbCwgcG9zLCBpdGVtcylcblx0XHR9KTtcblxuXHRcdC8vIGNvbnRleHQga2V5OiB1cGRhdGUgaW5zZXJ0L3JlcGxhY2UgbW9kZVxuXHRcdGNvbnN0IGN0eEluc2VydE1vZGUgPSBTdWdnZXN0Q29udGV4dC5JbnNlcnRNb2RlLmJpbmRUbyhfY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGN0eEluc2VydE1vZGUuc2V0KGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN1Z2dlc3QpLmluc2VydE1vZGUpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodGhpcy5tb2RlbC5vbkRpZFRyaWdnZXIoKCkgPT4gY3R4SW5zZXJ0TW9kZS5zZXQoZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc3VnZ2VzdCkuaW5zZXJ0TW9kZSkpKTtcblxuXHRcdHRoaXMud2lkZ2V0ID0gdGhpcy5fdG9EaXNwb3NlLmFkZChuZXcgV2luZG93SWRsZVZhbHVlKGdldFdpbmRvdyhlZGl0b3IuZ2V0RG9tTm9kZSgpKSwgKCkgPT4ge1xuXG5cdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTdWdnZXN0V2lkZ2V0LCB0aGlzLmVkaXRvcik7XG5cblx0XHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQod2lkZ2V0KTtcblx0XHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQod2lkZ2V0Lm9uRGlkU2VsZWN0KGl0ZW0gPT4gdGhpcy5faW5zZXJ0U3VnZ2VzdGlvbihpdGVtLCBJbnNlcnRGbGFncy5Ob25lKSwgdGhpcykpO1xuXG5cdFx0XHQvLyBXaXJlIHVwIGxvZ2ljIHRvIGFjY2VwdCBhIHN1Z2dlc3Rpb24gb24gY2VydGFpbiBjaGFyYWN0ZXJzXG5cdFx0XHRjb25zdCBjb21taXRDaGFyYWN0ZXJDb250cm9sbGVyID0gbmV3IENvbW1pdENoYXJhY3RlckNvbnRyb2xsZXIodGhpcy5lZGl0b3IsIHdpZGdldCwgdGhpcy5tb2RlbCwgaXRlbSA9PiB0aGlzLl9pbnNlcnRTdWdnZXN0aW9uKGl0ZW0sIEluc2VydEZsYWdzLk5vQWZ0ZXJVbmRvU3RvcCkpO1xuXHRcdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChjb21taXRDaGFyYWN0ZXJDb250cm9sbGVyKTtcblxuXG5cdFx0XHQvLyBXaXJlIHVwIG1ha2VzIHRleHQgZWRpdCBjb250ZXh0IGtleVxuXHRcdFx0Y29uc3QgY3R4TWFrZXNUZXh0RWRpdCA9IFN1Z2dlc3RDb250ZXh0Lk1ha2VzVGV4dEVkaXQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGN0eEhhc0luc2VydEFuZFJlcGxhY2UgPSBTdWdnZXN0Q29udGV4dC5IYXNJbnNlcnRBbmRSZXBsYWNlUmFuZ2UuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGN0eENhblJlc29sdmUgPSBTdWdnZXN0Q29udGV4dC5DYW5SZXNvbHZlLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0Y3R4TWFrZXNUZXh0RWRpdC5yZXNldCgpO1xuXHRcdFx0XHRjdHhIYXNJbnNlcnRBbmRSZXBsYWNlLnJlc2V0KCk7XG5cdFx0XHRcdGN0eENhblJlc29sdmUucmVzZXQoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh3aWRnZXQub25EaWRGb2N1cygoeyBpdGVtIH0pID0+IHtcblxuXHRcdFx0XHQvLyAoY3R4OiBtYWtlc1RleHRFZGl0KVxuXHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IHRoaXMuZWRpdG9yLmdldFBvc2l0aW9uKCkhO1xuXHRcdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IGl0ZW0uZWRpdFN0YXJ0LmNvbHVtbjtcblx0XHRcdFx0Y29uc3QgZW5kQ29sdW1uID0gcG9zaXRpb24uY29sdW1uO1xuXHRcdFx0XHRsZXQgdmFsdWUgPSB0cnVlO1xuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0dGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5hY2NlcHRTdWdnZXN0aW9uT25FbnRlcikgPT09ICdzbWFydCdcblx0XHRcdFx0XHQmJiB0aGlzLm1vZGVsLnN0YXRlID09PSBTdGF0ZS5BdXRvXG5cdFx0XHRcdFx0JiYgIWl0ZW0uY29tcGxldGlvbi5hZGRpdGlvbmFsVGV4dEVkaXRzXG5cdFx0XHRcdFx0JiYgIShpdGVtLmNvbXBsZXRpb24uaW5zZXJ0VGV4dFJ1bGVzISAmIENvbXBsZXRpb25JdGVtSW5zZXJ0VGV4dFJ1bGUuSW5zZXJ0QXNTbmlwcGV0KVxuXHRcdFx0XHRcdCYmIGVuZENvbHVtbiAtIHN0YXJ0Q29sdW1uID09PSBpdGVtLmNvbXBsZXRpb24uaW5zZXJ0VGV4dC5sZW5ndGhcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0Y29uc3Qgb2xkVGV4dCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCkhLmdldFZhbHVlSW5SYW5nZSh7XG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbixcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW5cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR2YWx1ZSA9IG9sZFRleHQgIT09IGl0ZW0uY29tcGxldGlvbi5pbnNlcnRUZXh0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGN0eE1ha2VzVGV4dEVkaXQuc2V0KHZhbHVlKTtcblxuXHRcdFx0XHQvLyAoY3R4OiBoYXNJbnNlcnRBbmRSZXBsYWNlUmFuZ2UpXG5cdFx0XHRcdGN0eEhhc0luc2VydEFuZFJlcGxhY2Uuc2V0KCFQb3NpdGlvbi5lcXVhbHMoaXRlbS5lZGl0SW5zZXJ0RW5kLCBpdGVtLmVkaXRSZXBsYWNlRW5kKSk7XG5cblx0XHRcdFx0Ly8gKGN0eDogY2FuUmVzb2x2ZSlcblx0XHRcdFx0Y3R4Q2FuUmVzb2x2ZS5zZXQoQm9vbGVhbihpdGVtLnByb3ZpZGVyLnJlc29sdmVDb21wbGV0aW9uSXRlbSkgfHwgQm9vbGVhbihpdGVtLmNvbXBsZXRpb24uZG9jdW1lbnRhdGlvbikgfHwgaXRlbS5jb21wbGV0aW9uLmRldGFpbCAhPT0gaXRlbS5jb21wbGV0aW9uLmxhYmVsKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh3aWRnZXQub25EZXRhaWxzS2V5RG93bihlID0+IHtcblx0XHRcdFx0Ly8gY21kICsgYyBvbiBtYWNPUywgY3RybCArIGMgb24gV2luIC8gTGludXhcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdGUudG9LZXlDb2RlQ2hvcmQoKS5lcXVhbHMobmV3IEtleUNvZGVDaG9yZCh0cnVlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBLZXlDb2RlLktleUMpKSB8fFxuXHRcdFx0XHRcdChwbGF0Zm9ybS5pc01hY2ludG9zaCAmJiBlLnRvS2V5Q29kZUNob3JkKCkuZXF1YWxzKG5ldyBLZXlDb2RlQ2hvcmQoZmFsc2UsIGZhbHNlLCBmYWxzZSwgdHJ1ZSwgS2V5Q29kZS5LZXlDKSkpXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFlLnRvS2V5Q29kZUNob3JkKCkuaXNNb2RpZmllcktleSgpKSB7XG5cdFx0XHRcdFx0dGhpcy5lZGl0b3IuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRyZXR1cm4gd2lkZ2V0O1xuXHRcdH0pKTtcblxuXHRcdC8vIFdpcmUgdXAgdGV4dCBvdmVydHlwaW5nIGNhcHR1cmVcblx0XHR0aGlzLl9vdmVydHlwaW5nQ2FwdHVyZXIgPSB0aGlzLl90b0Rpc3Bvc2UuYWRkKG5ldyBXaW5kb3dJZGxlVmFsdWUoZ2V0V2luZG93KGVkaXRvci5nZXREb21Ob2RlKCkpLCAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fdG9EaXNwb3NlLmFkZChuZXcgT3ZlcnR5cGluZ0NhcHR1cmVyKHRoaXMuZWRpdG9yLCB0aGlzLm1vZGVsKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fYWx0ZXJuYXRpdmVzID0gdGhpcy5fdG9EaXNwb3NlLmFkZChuZXcgV2luZG93SWRsZVZhbHVlKGdldFdpbmRvdyhlZGl0b3IuZ2V0RG9tTm9kZSgpKSwgKCkgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3RvRGlzcG9zZS5hZGQobmV3IFN1Z2dlc3RBbHRlcm5hdGl2ZXModGhpcy5lZGl0b3IsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChfaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29yZENvbnRleHRLZXksIGVkaXRvcikpO1xuXG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0aGlzLm1vZGVsLm9uRGlkVHJpZ2dlcihlID0+IHtcblx0XHRcdHRoaXMud2lkZ2V0LnZhbHVlLnNob3dUcmlnZ2VyZWQoZS5hdXRvLCBlLnNoeSA/IDI1MCA6IDUwKTtcblx0XHRcdHRoaXMuX2xpbmVTdWZmaXgudmFsdWUgPSBuZXcgTGluZVN1ZmZpeCh0aGlzLmVkaXRvci5nZXRNb2RlbCgpISwgZS5wb3NpdGlvbik7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodGhpcy5tb2RlbC5vbkRpZFN1Z2dlc3QoZSA9PiB7XG5cdFx0XHRpZiAoZS50cmlnZ2VyT3B0aW9ucy5zaHkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGluZGV4ID0gLTE7XG5cdFx0XHRmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIHRoaXMuX3NlbGVjdG9ycy5pdGVtc09yZGVyZWRCeVByaW9yaXR5RGVzYykge1xuXHRcdFx0XHRpbmRleCA9IHNlbGVjdG9yLnNlbGVjdCh0aGlzLmVkaXRvci5nZXRNb2RlbCgpISwgdGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKSEsIGUuY29tcGxldGlvbk1vZGVsLml0ZW1zKTtcblx0XHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdGluZGV4ID0gMDtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLm1vZGVsLnN0YXRlID09PSBTdGF0ZS5JZGxlKSB7XG5cdFx0XHRcdC8vIHNlbGVjdGluZyBhbiBpdGVtIGNhbiBcInB1bXBcIiBvdXQgc2VsZWN0aW9uL2N1cnNvciBjaGFuZ2UgZXZlbnRzXG5cdFx0XHRcdC8vIHdoaWNoIGNhbiBjYW5jZWwgc3VnZ2VzdCBoYWxmd2F5IHRocm91Z2ggdGhpcyBmdW5jdGlvbi4gdGhlcmVmb3JlXG5cdFx0XHRcdC8vIHdlIG5lZWQgdG8gY2hlY2sgYWdhaW4gYW5kIGJhaWwgaWYgdGhlIHNlc3Npb24gaGFzIGJlZW4gY2FuY2VsZWRcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGV0IG5vRm9jdXMgPSBmYWxzZTtcblx0XHRcdGlmIChlLnRyaWdnZXJPcHRpb25zLmF1dG8pIHtcblx0XHRcdFx0Ly8gZG9uJ3QgXCJmb2N1c1wiIGl0ZW0gd2hlbiBjb25maWd1cmVkIHRvIGRvXG5cdFx0XHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN1Z2dlc3QpO1xuXHRcdFx0XHRpZiAob3B0aW9ucy5zZWxlY3Rpb25Nb2RlID09PSAnbmV2ZXInIHx8IG9wdGlvbnMuc2VsZWN0aW9uTW9kZSA9PT0gJ2Fsd2F5cycpIHtcblx0XHRcdFx0XHQvLyBzaW1wbGU6IGFsd2F5cyBvciBuZXZlclxuXHRcdFx0XHRcdG5vRm9jdXMgPSBvcHRpb25zLnNlbGVjdGlvbk1vZGUgPT09ICduZXZlcic7XG5cblx0XHRcdFx0fSBlbHNlIGlmIChvcHRpb25zLnNlbGVjdGlvbk1vZGUgPT09ICd3aGVuVHJpZ2dlckNoYXJhY3RlcicpIHtcblx0XHRcdFx0XHQvLyBvbiB3aXRoIHRyaWdnZXIgY2hhcmFjdGVyXG5cdFx0XHRcdFx0bm9Gb2N1cyA9IGUudHJpZ2dlck9wdGlvbnMudHJpZ2dlcktpbmQgIT09IENvbXBsZXRpb25UcmlnZ2VyS2luZC5UcmlnZ2VyQ2hhcmFjdGVyO1xuXG5cdFx0XHRcdH0gZWxzZSBpZiAob3B0aW9ucy5zZWxlY3Rpb25Nb2RlID09PSAnd2hlblF1aWNrU3VnZ2VzdGlvbicpIHtcblx0XHRcdFx0XHQvLyB3aXRob3V0IHRyaWdnZXIgY2hhcmFjdGVyIG9yIHdoZW4gcmVmaWx0ZXJpbmdcblx0XHRcdFx0XHRub0ZvY3VzID0gZS50cmlnZ2VyT3B0aW9ucy50cmlnZ2VyS2luZCA9PT0gQ29tcGxldGlvblRyaWdnZXJLaW5kLlRyaWdnZXJDaGFyYWN0ZXIgJiYgIWUudHJpZ2dlck9wdGlvbnMucmVmaWx0ZXI7XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXHRcdFx0dGhpcy53aWRnZXQudmFsdWUuc2hvd1N1Z2dlc3Rpb25zKGUuY29tcGxldGlvbk1vZGVsLCBpbmRleCwgZS5pc0Zyb3plbiwgZS50cmlnZ2VyT3B0aW9ucy5hdXRvLCBub0ZvY3VzKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0aGlzLm1vZGVsLm9uRGlkQ2FuY2VsKGUgPT4ge1xuXHRcdFx0aWYgKCFlLnJldHJpZ2dlcikge1xuXHRcdFx0XHR0aGlzLndpZGdldC52YWx1ZS5oaWRlV2lkZ2V0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodGhpcy5lZGl0b3Iub25EaWRCbHVyRWRpdG9yV2lkZ2V0KCgpID0+IHtcblx0XHRcdGlmICghX3N0aWNreSkge1xuXHRcdFx0XHR0aGlzLm1vZGVsLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLm1vZGVsLmNsZWFyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gTWFuYWdlIHRoZSBhY2NlcHRTdWdnZXN0aW9uc09uRW50ZXIgY29udGV4dCBrZXlcblx0XHRjb25zdCBhY2NlcHRTdWdnZXN0aW9uc09uRW50ZXIgPSBTdWdnZXN0Q29udGV4dC5BY2NlcHRTdWdnZXN0aW9uc09uRW50ZXIuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgdXBkYXRlRnJvbUNvbmZpZyA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5hY2NlcHRTdWdnZXN0aW9uT25FbnRlcik7XG5cdFx0XHRhY2NlcHRTdWdnZXN0aW9uc09uRW50ZXIuc2V0KGFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyID09PSAnb24nIHx8IGFjY2VwdFN1Z2dlc3Rpb25PbkVudGVyID09PSAnc21hcnQnKTtcblx0XHR9O1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKCgpID0+IHVwZGF0ZUZyb21Db25maWcoKSkpO1xuXHRcdHVwZGF0ZUZyb21Db25maWcoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWx0ZXJuYXRpdmVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdHRoaXMud2lkZ2V0LmRpc3Bvc2UoKTtcblx0XHR0aGlzLm1vZGVsLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9saW5lU3VmZml4LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9vbldpbGxJbnNlcnRTdWdnZXN0SXRlbS5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2luc2VydFN1Z2dlc3Rpb24oXG5cdFx0ZXZlbnQ6IElTZWxlY3RlZFN1Z2dlc3Rpb24gfCB1bmRlZmluZWQsXG5cdFx0ZmxhZ3M6IEluc2VydEZsYWdzXG5cdCk6IHZvaWQge1xuXHRcdGlmICghZXZlbnQgfHwgIWV2ZW50Lml0ZW0pIHtcblx0XHRcdHRoaXMuX2FsdGVybmF0aXZlcy52YWx1ZS5yZXNldCgpO1xuXHRcdFx0dGhpcy5tb2RlbC5jYW5jZWwoKTtcblx0XHRcdHRoaXMubW9kZWwuY2xlYXIoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHNuaXBwZXRDb250cm9sbGVyID0gU25pcHBldENvbnRyb2xsZXIyLmdldCh0aGlzLmVkaXRvcik7XG5cdFx0aWYgKCFzbmlwcGV0Q29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uV2lsbEluc2VydFN1Z2dlc3RJdGVtLmZpcmUoeyBpdGVtOiBldmVudC5pdGVtIH0pO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGNvbnN0IG1vZGVsVmVyc2lvbk5vdyA9IG1vZGVsLmdldEFsdGVybmF0aXZlVmVyc2lvbklkKCk7XG5cdFx0Y29uc3QgeyBpdGVtIH0gPSBldmVudDtcblxuXHRcdC8vXG5cdFx0Y29uc3QgdGFza3M6IFByb21pc2U8YW55PltdID0gW107XG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHQvLyBwdXNoaW5nIHVuZG8gc3RvcHMgKmJlZm9yZSogYWRkaXRpb25hbCB0ZXh0IGVkaXRzIGFuZFxuXHRcdC8vICphZnRlciogdGhlIG1haW4gZWRpdFxuXHRcdGlmICghKGZsYWdzICYgSW5zZXJ0RmxhZ3MuTm9CZWZvcmVVbmRvU3RvcCkpIHtcblx0XHRcdHRoaXMuZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdH1cblxuXHRcdC8vIGNvbXB1dGUgb3ZlcndyaXRlW0JlZm9yZXxBZnRlcl0gZGVsdGFzIEJFRk9SRSBhcHBseWluZyBleHRyYSBlZGl0c1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLmdldE92ZXJ3cml0ZUluZm8oaXRlbSwgQm9vbGVhbihmbGFncyAmIEluc2VydEZsYWdzLkFsdGVybmF0aXZlT3ZlcndyaXRlQ29uZmlnKSk7XG5cblx0XHQvLyBrZWVwIGl0ZW0gaW4gbWVtb3J5XG5cdFx0dGhpcy5fbWVtb3J5U2VydmljZS5tZW1vcml6ZShtb2RlbCwgdGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKSwgaXRlbSk7XG5cblx0XHRjb25zdCBpc1Jlc29sdmVkID0gaXRlbS5pc1Jlc29sdmVkO1xuXG5cdFx0Ly8gdGVsZW1ldHJ5IGRhdGEgcG9pbnRzOiBkdXJhdGlvbiBvZiBjb21tYW5kIGV4ZWN1dGlvbiwgaW5mbyBhYm91dCBhc3luYyBhZGRpdGlvbmFsIGVkaXRzICgtMT1uL2EsIC0yPW5vbmUsIDE9c3VjY2VzcywgMD1mYWlsZWQpXG5cdFx0bGV0IF9jb21tYW5kRXhlY3Rpb25EdXJhdGlvbiA9IC0xO1xuXHRcdGxldCBfYWRkaXRpb25hbEVkaXRzQXBwbGllZEFzeW5jID0gLTE7XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShpdGVtLmNvbXBsZXRpb24uYWRkaXRpb25hbFRleHRFZGl0cykpIHtcblxuXHRcdFx0Ly8gY2FuY2VsIC0+IHN0b3BzIGFsbCBsaXN0ZW5pbmcgYW5kIGNsb3NlcyB3aWRnZXRcblx0XHRcdHRoaXMubW9kZWwuY2FuY2VsKCk7XG5cblx0XHRcdC8vIHN5bmMgYWRkaXRpb25hbCBlZGl0c1xuXHRcdFx0Y29uc3Qgc2Nyb2xsU3RhdGUgPSBTdGFibGVFZGl0b3JTY3JvbGxTdGF0ZS5jYXB0dXJlKHRoaXMuZWRpdG9yKTtcblx0XHRcdHRoaXMuZWRpdG9yLmV4ZWN1dGVFZGl0cyhcblx0XHRcdFx0J3N1Z2dlc3RDb250cm9sbGVyLmFkZGl0aW9uYWxUZXh0RWRpdHMuc3luYycsXG5cdFx0XHRcdGl0ZW0uY29tcGxldGlvbi5hZGRpdGlvbmFsVGV4dEVkaXRzLm1hcChlZGl0ID0+IHtcblx0XHRcdFx0XHRsZXQgcmFuZ2UgPSBSYW5nZS5saWZ0KGVkaXQucmFuZ2UpO1xuXHRcdFx0XHRcdGlmIChyYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IGl0ZW0ucG9zaXRpb24ubGluZU51bWJlciAmJiByYW5nZS5zdGFydENvbHVtbiA+IGl0ZW0ucG9zaXRpb24uY29sdW1uKSB7XG5cdFx0XHRcdFx0XHQvLyBzaGlmdCBhZGRpdGlvbmFsIGVkaXQgd2hlbiBpdCBpcyBcImFmdGVyXCIgdGhlIGNvbXBsZXRpb24gaW5zZXJ0aW9uIHBvc2l0aW9uXG5cdFx0XHRcdFx0XHRjb25zdCBjb2x1bW5EZWx0YSA9IHRoaXMuZWRpdG9yLmdldFBvc2l0aW9uKCkhLmNvbHVtbiAtIGl0ZW0ucG9zaXRpb24uY29sdW1uO1xuXHRcdFx0XHRcdFx0Y29uc3Qgc3RhcnRDb2x1bW5EZWx0YSA9IGNvbHVtbkRlbHRhO1xuXHRcdFx0XHRcdFx0Y29uc3QgZW5kQ29sdW1uRGVsdGEgPSBSYW5nZS5zcGFuc011bHRpcGxlTGluZXMocmFuZ2UpID8gMCA6IGNvbHVtbkRlbHRhO1xuXHRcdFx0XHRcdFx0cmFuZ2UgPSBuZXcgUmFuZ2UocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbiArIHN0YXJ0Q29sdW1uRGVsdGEsIHJhbmdlLmVuZExpbmVOdW1iZXIsIHJhbmdlLmVuZENvbHVtbiArIGVuZENvbHVtbkRlbHRhKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIEVkaXRPcGVyYXRpb24ucmVwbGFjZU1vdmUocmFuZ2UsIGVkaXQudGV4dCk7XG5cdFx0XHRcdH0pXG5cdFx0XHQpO1xuXHRcdFx0c2Nyb2xsU3RhdGUucmVzdG9yZVJlbGF0aXZlVmVydGljYWxQb3NpdGlvbk9mQ3Vyc29yKHRoaXMuZWRpdG9yKTtcblxuXHRcdH0gZWxzZSBpZiAoIWlzUmVzb2x2ZWQpIHtcblx0XHRcdC8vIGFzeW5jIGFkZGl0aW9uYWwgZWRpdHNcblx0XHRcdGNvbnN0IHN3ID0gbmV3IFN0b3BXYXRjaCgpO1xuXHRcdFx0bGV0IHBvc2l0aW9uOiBJUG9zaXRpb24gfCB1bmRlZmluZWQ7XG5cblx0XHRcdGNvbnN0IGRvY0xpc3RlbmVyID0gbW9kZWwub25EaWRDaGFuZ2VDb250ZW50KGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5pc0ZsdXNoKSB7XG5cdFx0XHRcdFx0Y3RzLmNhbmNlbCgpO1xuXHRcdFx0XHRcdGRvY0xpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgZS5jaGFuZ2VzKSB7XG5cdFx0XHRcdFx0Y29uc3QgdGhpc1Bvc2l0aW9uID0gUmFuZ2UuZ2V0RW5kUG9zaXRpb24oY2hhbmdlLnJhbmdlKTtcblx0XHRcdFx0XHRpZiAoIXBvc2l0aW9uIHx8IFBvc2l0aW9uLmlzQmVmb3JlKHRoaXNQb3NpdGlvbiwgcG9zaXRpb24pKSB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbiA9IHRoaXNQb3NpdGlvbjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBvbGRGbGFncyA9IGZsYWdzO1xuXHRcdFx0ZmxhZ3MgfD0gSW5zZXJ0RmxhZ3MuTm9BZnRlclVuZG9TdG9wO1xuXHRcdFx0bGV0IGRpZFR5cGUgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHR5cGVMaXN0ZW5lciA9IHRoaXMuZWRpdG9yLm9uV2lsbFR5cGUoKCkgPT4ge1xuXHRcdFx0XHR0eXBlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRkaWRUeXBlID0gdHJ1ZTtcblx0XHRcdFx0aWYgKCEob2xkRmxhZ3MgJiBJbnNlcnRGbGFncy5Ob0FmdGVyVW5kb1N0b3ApKSB7XG5cdFx0XHRcdFx0dGhpcy5lZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHR0YXNrcy5wdXNoKGl0ZW0ucmVzb2x2ZShjdHMudG9rZW4pLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAoIWl0ZW0uY29tcGxldGlvbi5hZGRpdGlvbmFsVGV4dEVkaXRzIHx8IGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHBvc2l0aW9uICYmIGl0ZW0uY29tcGxldGlvbi5hZGRpdGlvbmFsVGV4dEVkaXRzLnNvbWUoZWRpdCA9PiBQb3NpdGlvbi5pc0JlZm9yZShwb3NpdGlvbiEsIFJhbmdlLmdldFN0YXJ0UG9zaXRpb24oZWRpdC5yYW5nZSkpKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZGlkVHlwZSkge1xuXHRcdFx0XHRcdHRoaXMuZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHNjcm9sbFN0YXRlID0gU3RhYmxlRWRpdG9yU2Nyb2xsU3RhdGUuY2FwdHVyZSh0aGlzLmVkaXRvcik7XG5cdFx0XHRcdHRoaXMuZWRpdG9yLmV4ZWN1dGVFZGl0cyhcblx0XHRcdFx0XHQnc3VnZ2VzdENvbnRyb2xsZXIuYWRkaXRpb25hbFRleHRFZGl0cy5hc3luYycsXG5cdFx0XHRcdFx0aXRlbS5jb21wbGV0aW9uLmFkZGl0aW9uYWxUZXh0RWRpdHMubWFwKGVkaXQgPT4gRWRpdE9wZXJhdGlvbi5yZXBsYWNlTW92ZShSYW5nZS5saWZ0KGVkaXQucmFuZ2UpLCBlZGl0LnRleHQpKVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRzY3JvbGxTdGF0ZS5yZXN0b3JlUmVsYXRpdmVWZXJ0aWNhbFBvc2l0aW9uT2ZDdXJzb3IodGhpcy5lZGl0b3IpO1xuXHRcdFx0XHRpZiAoZGlkVHlwZSB8fCAhKG9sZEZsYWdzICYgSW5zZXJ0RmxhZ3MuTm9BZnRlclVuZG9TdG9wKSkge1xuXHRcdFx0XHRcdHRoaXMuZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSkudGhlbihhcHBsaWVkID0+IHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnW3N1Z2dlc3RdIGFzeW5jIHJlc29sdmluZyBvZiBlZGl0cyBET05FIChtcywgYXBwbGllZD8pJywgc3cuZWxhcHNlZCgpLCBhcHBsaWVkKTtcblx0XHRcdFx0X2FkZGl0aW9uYWxFZGl0c0FwcGxpZWRBc3luYyA9IGFwcGxpZWQgPT09IHRydWUgPyAxIDogYXBwbGllZCA9PT0gZmFsc2UgPyAwIDogLTI7XG5cdFx0XHR9KS5maW5hbGx5KCgpID0+IHtcblx0XHRcdFx0ZG9jTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHR0eXBlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGxldCB7IGluc2VydFRleHQgfSA9IGl0ZW0uY29tcGxldGlvbjtcblx0XHRpZiAoIShpdGVtLmNvbXBsZXRpb24uaW5zZXJ0VGV4dFJ1bGVzISAmIENvbXBsZXRpb25JdGVtSW5zZXJ0VGV4dFJ1bGUuSW5zZXJ0QXNTbmlwcGV0KSkge1xuXHRcdFx0aW5zZXJ0VGV4dCA9IFNuaXBwZXRQYXJzZXIuZXNjYXBlKGluc2VydFRleHQpO1xuXHRcdH1cblxuXHRcdC8vIGNhbmNlbCAtPiBzdG9wcyBhbGwgbGlzdGVuaW5nIGFuZCBjbG9zZXMgd2lkZ2V0XG5cdFx0dGhpcy5tb2RlbC5jYW5jZWwoKTtcblxuXHRcdHNuaXBwZXRDb250cm9sbGVyLmluc2VydChpbnNlcnRUZXh0LCB7XG5cdFx0XHRvdmVyd3JpdGVCZWZvcmU6IGluZm8ub3ZlcndyaXRlQmVmb3JlLFxuXHRcdFx0b3ZlcndyaXRlQWZ0ZXI6IGluZm8ub3ZlcndyaXRlQWZ0ZXIsXG5cdFx0XHR1bmRvU3RvcEJlZm9yZTogZmFsc2UsXG5cdFx0XHR1bmRvU3RvcEFmdGVyOiBmYWxzZSxcblx0XHRcdGFkanVzdFdoaXRlc3BhY2U6ICEoaXRlbS5jb21wbGV0aW9uLmluc2VydFRleHRSdWxlcyEgJiBDb21wbGV0aW9uSXRlbUluc2VydFRleHRSdWxlLktlZXBXaGl0ZXNwYWNlKSxcblx0XHRcdGNsaXBib2FyZFRleHQ6IGV2ZW50Lm1vZGVsLmNsaXBib2FyZFRleHQsXG5cdFx0XHRvdmVydHlwaW5nQ2FwdHVyZXI6IHRoaXMuX292ZXJ0eXBpbmdDYXB0dXJlci52YWx1ZVxuXHRcdH0pO1xuXG5cdFx0aWYgKCEoZmxhZ3MgJiBJbnNlcnRGbGFncy5Ob0FmdGVyVW5kb1N0b3ApKSB7XG5cdFx0XHR0aGlzLmVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHR9XG5cblx0XHRpZiAoaXRlbS5jb21wbGV0aW9uLmNvbW1hbmQpIHtcblx0XHRcdGlmIChpdGVtLmNvbXBsZXRpb24uY29tbWFuZC5pZCA9PT0gVHJpZ2dlclN1Z2dlc3RBY3Rpb24uaWQpIHtcblx0XHRcdFx0Ly8gcmV0aWdnZXJcblx0XHRcdFx0dGhpcy5tb2RlbC50cmlnZ2VyKHsgYXV0bzogdHJ1ZSwgcmV0cmlnZ2VyOiB0cnVlIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gZXhlYyBjb21tYW5kLCBkb25lXG5cdFx0XHRcdGNvbnN0IHN3ID0gbmV3IFN0b3BXYXRjaCgpO1xuXHRcdFx0XHR0YXNrcy5wdXNoKHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGl0ZW0uY29tcGxldGlvbi5jb21tYW5kLmlkLCAuLi4oaXRlbS5jb21wbGV0aW9uLmNvbW1hbmQuYXJndW1lbnRzID8gWy4uLml0ZW0uY29tcGxldGlvbi5jb21tYW5kLmFyZ3VtZW50c10gOiBbXSkpLmNhdGNoKGUgPT4ge1xuXHRcdFx0XHRcdGlmIChpdGVtLmNvbXBsZXRpb24uZXh0ZW5zaW9uSWQpIHtcblx0XHRcdFx0XHRcdG9uVW5leHBlY3RlZEV4dGVybmFsRXJyb3IoZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdFx0X2NvbW1hbmRFeGVjdGlvbkR1cmF0aW9uID0gc3cuZWxhcHNlZCgpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGZsYWdzICYgSW5zZXJ0RmxhZ3MuS2VlcEFsdGVybmF0aXZlU3VnZ2VzdGlvbnMpIHtcblx0XHRcdHRoaXMuX2FsdGVybmF0aXZlcy52YWx1ZS5zZXQoZXZlbnQsIG5leHQgPT4ge1xuXG5cdFx0XHRcdC8vIGNhbmNlbCByZXNvbHZpbmcgb2YgYWRkaXRpb25hbCBlZGl0c1xuXHRcdFx0XHRjdHMuY2FuY2VsKCk7XG5cblx0XHRcdFx0Ly8gdGhpcyBpcyBub3Qgc28gcHJldHR5LiB3aGVuIGluc2VydGluZyB0aGUgJ25leHQnXG5cdFx0XHRcdC8vIHN1Z2dlc3Rpb24gd2UgdW5kbyB1bnRpbCB3ZSBhcmUgYXQgdGhlIHN0YXRlIGF0XG5cdFx0XHRcdC8vIHdoaWNoIHdlIHdlcmUgYmVmb3JlIGluc2VydGluZyB0aGUgcHJldmlvdXMgc3VnZ2VzdGlvbi4uLlxuXHRcdFx0XHR3aGlsZSAobW9kZWwuY2FuVW5kbygpKSB7XG5cdFx0XHRcdFx0aWYgKG1vZGVsVmVyc2lvbk5vdyAhPT0gbW9kZWwuZ2V0QWx0ZXJuYXRpdmVWZXJzaW9uSWQoKSkge1xuXHRcdFx0XHRcdFx0bW9kZWwudW5kbygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9pbnNlcnRTdWdnZXN0aW9uKFxuXHRcdFx0XHRcdFx0bmV4dCxcblx0XHRcdFx0XHRcdEluc2VydEZsYWdzLk5vQmVmb3JlVW5kb1N0b3AgfCBJbnNlcnRGbGFncy5Ob0FmdGVyVW5kb1N0b3AgfCAoZmxhZ3MgJiBJbnNlcnRGbGFncy5BbHRlcm5hdGl2ZU92ZXJ3cml0ZUNvbmZpZyA/IEluc2VydEZsYWdzLkFsdGVybmF0aXZlT3ZlcndyaXRlQ29uZmlnIDogMClcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLl9hbGVydENvbXBsZXRpb25JdGVtKGl0ZW0pO1xuXG5cdFx0Ly8gY2xlYXIgb25seSBub3cgLSBhZnRlciBhbGwgdGFza3MgYXJlIGRvbmVcblx0XHRQcm9taXNlLmFsbCh0YXNrcykuZmluYWxseSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9yZXBvcnRTdWdnZXN0aW9uQWNjZXB0ZWRUZWxlbWV0cnkoaXRlbSwgbW9kZWwsIGlzUmVzb2x2ZWQsIF9jb21tYW5kRXhlY3Rpb25EdXJhdGlvbiwgX2FkZGl0aW9uYWxFZGl0c0FwcGxpZWRBc3luYywgZXZlbnQuaW5kZXgsIGV2ZW50Lm1vZGVsLml0ZW1zKTtcblxuXHRcdFx0dGhpcy5tb2RlbC5jbGVhcigpO1xuXHRcdFx0Y3RzLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlcG9ydFN1Z2dlc3Rpb25BY2NlcHRlZFRlbGVtZXRyeShpdGVtOiBDb21wbGV0aW9uSXRlbSwgbW9kZWw6IElUZXh0TW9kZWwsIGl0ZW1SZXNvbHZlZDogYm9vbGVhbiwgY29tbWFuZEV4ZWN0aW9uRHVyYXRpb246IG51bWJlciwgYWRkaXRpb25hbEVkaXRzQXBwbGllZEFzeW5jOiBudW1iZXIsIGluZGV4OiBudW1iZXIsIGNvbXBsZXRpb25JdGVtczogQ29tcGxldGlvbkl0ZW1bXSk6IHZvaWQge1xuXHRcdGlmIChNYXRoLnJhbmRvbSgpID4gMC4wMDAxKSB7IC8vIDAuMDElXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGFiZWxNYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyW10+KCk7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWluKDMwLCBjb21wbGV0aW9uSXRlbXMubGVuZ3RoKTsgaSsrKSB7XG5cdFx0XHRjb25zdCBsYWJlbCA9IGNvbXBsZXRpb25JdGVtc1tpXS50ZXh0TGFiZWw7XG5cblx0XHRcdGlmIChsYWJlbE1hcC5oYXMobGFiZWwpKSB7XG5cdFx0XHRcdGxhYmVsTWFwLmdldChsYWJlbCkhLnB1c2goaSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsYWJlbE1hcC5zZXQobGFiZWwsIFtpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlyc3RJbmRleEFycmF5ID0gbGFiZWxNYXAuZ2V0KGl0ZW0udGV4dExhYmVsKTtcblx0XHRjb25zdCBoYXNEdXBsaWNhdGVzID0gZmlyc3RJbmRleEFycmF5ICYmIGZpcnN0SW5kZXhBcnJheS5sZW5ndGggPiAxO1xuXHRcdGNvbnN0IGZpcnN0SW5kZXggPSBoYXNEdXBsaWNhdGVzID8gZmlyc3RJbmRleEFycmF5WzBdIDogLTE7XG5cblx0XHR0eXBlIEFjY2VwdGVkU3VnZ2VzdGlvbiA9IHtcblx0XHRcdGV4dGVuc2lvbklkOiBzdHJpbmc7IHByb3ZpZGVySWQ6IHN0cmluZztcblx0XHRcdGZpbGVFeHRlbnNpb246IHN0cmluZzsgbGFuZ3VhZ2VJZDogc3RyaW5nOyBiYXNlbmFtZUhhc2g6IHN0cmluZzsga2luZDogbnVtYmVyO1xuXHRcdFx0cmVzb2x2ZUluZm86IG51bWJlcjsgcmVzb2x2ZUR1cmF0aW9uOiBudW1iZXI7XG5cdFx0XHRjb21tYW5kRHVyYXRpb246IG51bWJlcjtcblx0XHRcdGFkZGl0aW9uYWxFZGl0c0FzeW5jOiBudW1iZXI7XG5cdFx0XHRpbmRleDogbnVtYmVyOyBmaXJzdEluZGV4OiBudW1iZXI7XG5cdFx0fTtcblx0XHR0eXBlIEFjY2VwdGVkU3VnZ2VzdGlvbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdqcmlla2VuJztcblx0XHRcdGNvbW1lbnQ6ICdJbmZvcm1hdGlvbiBhY2NlcHRpbmcgY29tcGxldGlvbiBpdGVtcyc7XG5cdFx0XHRleHRlbnNpb25JZDogeyBjbGFzc2lmaWNhdGlvbjogJ1B1YmxpY05vblBlcnNvbmFsRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdFeHRlbnNpb24gY29udHJpYnV0aW5nIHRoZSBjb21wbGV0aW9ucyBpdGVtJyB9O1xuXHRcdFx0cHJvdmlkZXJJZDogeyBjbGFzc2lmaWNhdGlvbjogJ1B1YmxpY05vblBlcnNvbmFsRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdQcm92aWRlciBvZiB0aGUgY29tcGxldGlvbnMgaXRlbScgfTtcblx0XHRcdGJhc2VuYW1lSGFzaDogeyBjbGFzc2lmaWNhdGlvbjogJ1B1YmxpY05vblBlcnNvbmFsRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdIYXNoIG9mIHRoZSBiYXNlbmFtZSBvZiB0aGUgZmlsZSBpbnRvIHdoaWNoIHRoZSBjb21wbGV0aW9uIHdhcyBpbnNlcnRlZCcgfTtcblx0XHRcdGZpbGVFeHRlbnNpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdGaWxlIGV4dGVuc2lvbiBvZiB0aGUgZmlsZSBpbnRvIHdoaWNoIHRoZSBjb21wbGV0aW9uIHdhcyBpbnNlcnRlZCcgfTtcblx0XHRcdGxhbmd1YWdlSWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdMYW5ndWFnZSB0eXBlIG9mIHRoZSBmaWxlIGludG8gd2hpY2ggdGhlIGNvbXBsZXRpb24gd2FzIGluc2VydGVkJyB9O1xuXHRcdFx0a2luZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBjb21wbGV0aW9uIGl0ZW0ga2luZCcgfTtcblx0XHRcdHJlc29sdmVJbmZvOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnSWYgdGhlIGl0ZW0gd2FzIGluc2VydGVkIGJlZm9yZSByZXNvbHZpbmcgd2FzIGRvbmUnIH07XG5cdFx0XHRyZXNvbHZlRHVyYXRpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdIb3cgbG9uZyByZXNvbHZpbmcgdG9vayB0byBmaW5pc2gnIH07XG5cdFx0XHRjb21tYW5kRHVyYXRpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdIb3cgbG9uZyBhIGNvbXBsZXRpb24gaXRlbSBjb21tYW5kIHRvb2snIH07XG5cdFx0XHRhZGRpdGlvbmFsRWRpdHNBc3luYzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0luZm8gYWJvdXQgYXN5bmNocm9ub3VzbHkgYXBwbHlpbmcgYWRkaXRpb25hbCBlZGl0cycgfTtcblx0XHRcdGluZGV4OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGluZGV4IG9mIHRoZSBjb21wbGV0aW9uIGl0ZW0gaW4gdGhlIHNvcnRlZCBsaXN0LicgfTtcblx0XHRcdGZpcnN0SW5kZXg6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBjb21wbGV0aW9ucywgdGhlIGluZGV4IG9mIHRoZSBmaXJzdCBpbnN0YW5jZS4nIH07XG5cdFx0fTtcblxuXHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxBY2NlcHRlZFN1Z2dlc3Rpb24sIEFjY2VwdGVkU3VnZ2VzdGlvbkNsYXNzaWZpY2F0aW9uPignc3VnZ2VzdC5hY2NlcHRlZFN1Z2dlc3Rpb24nLCB7XG5cdFx0XHRleHRlbnNpb25JZDogaXRlbS5leHRlbnNpb25JZD8udmFsdWUgPz8gJ3Vua25vd24nLFxuXHRcdFx0cHJvdmlkZXJJZDogaXRlbS5wcm92aWRlci5fZGVidWdEaXNwbGF5TmFtZSA/PyAndW5rbm93bicsXG5cdFx0XHRraW5kOiBpdGVtLmNvbXBsZXRpb24ua2luZCxcblx0XHRcdGJhc2VuYW1lSGFzaDogaGFzaChiYXNlbmFtZShtb2RlbC51cmkpKS50b1N0cmluZygxNiksXG5cdFx0XHRsYW5ndWFnZUlkOiBtb2RlbC5nZXRMYW5ndWFnZUlkKCksXG5cdFx0XHRmaWxlRXh0ZW5zaW9uOiBleHRuYW1lKG1vZGVsLnVyaSksXG5cdFx0XHRyZXNvbHZlSW5mbzogIWl0ZW0ucHJvdmlkZXIucmVzb2x2ZUNvbXBsZXRpb25JdGVtID8gLTEgOiBpdGVtUmVzb2x2ZWQgPyAxIDogMCxcblx0XHRcdHJlc29sdmVEdXJhdGlvbjogaXRlbS5yZXNvbHZlRHVyYXRpb24sXG5cdFx0XHRjb21tYW5kRHVyYXRpb246IGNvbW1hbmRFeGVjdGlvbkR1cmF0aW9uLFxuXHRcdFx0YWRkaXRpb25hbEVkaXRzQXN5bmM6IGFkZGl0aW9uYWxFZGl0c0FwcGxpZWRBc3luYyxcblx0XHRcdGluZGV4LFxuXHRcdFx0Zmlyc3RJbmRleCxcblx0XHR9KTtcblx0fVxuXG5cdGdldE92ZXJ3cml0ZUluZm8oaXRlbTogQ29tcGxldGlvbkl0ZW0sIHRvZ2dsZU1vZGU6IGJvb2xlYW4pOiB7IG92ZXJ3cml0ZUJlZm9yZTogbnVtYmVyOyBvdmVyd3JpdGVBZnRlcjogbnVtYmVyIH0ge1xuXHRcdGFzc2VydFR5cGUodGhpcy5lZGl0b3IuaGFzTW9kZWwoKSk7XG5cblx0XHRsZXQgcmVwbGFjZSA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc3VnZ2VzdCkuaW5zZXJ0TW9kZSA9PT0gJ3JlcGxhY2UnO1xuXHRcdGlmICh0b2dnbGVNb2RlKSB7XG5cdFx0XHRyZXBsYWNlID0gIXJlcGxhY2U7XG5cdFx0fVxuXHRcdGNvbnN0IG92ZXJ3cml0ZUJlZm9yZSA9IGl0ZW0ucG9zaXRpb24uY29sdW1uIC0gaXRlbS5lZGl0U3RhcnQuY29sdW1uO1xuXHRcdGNvbnN0IG92ZXJ3cml0ZUFmdGVyID0gKHJlcGxhY2UgPyBpdGVtLmVkaXRSZXBsYWNlRW5kLmNvbHVtbiA6IGl0ZW0uZWRpdEluc2VydEVuZC5jb2x1bW4pIC0gaXRlbS5wb3NpdGlvbi5jb2x1bW47XG5cdFx0Y29uc3QgY29sdW1uRGVsdGEgPSB0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpLmNvbHVtbiAtIGl0ZW0ucG9zaXRpb24uY29sdW1uO1xuXHRcdGNvbnN0IHN1ZmZpeERlbHRhID0gdGhpcy5fbGluZVN1ZmZpeC52YWx1ZSA/IHRoaXMuX2xpbmVTdWZmaXgudmFsdWUuZGVsdGEodGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKSkgOiAwO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG92ZXJ3cml0ZUJlZm9yZTogb3ZlcndyaXRlQmVmb3JlICsgY29sdW1uRGVsdGEsXG5cdFx0XHRvdmVyd3JpdGVBZnRlcjogb3ZlcndyaXRlQWZ0ZXIgKyBzdWZmaXhEZWx0YVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9hbGVydENvbXBsZXRpb25JdGVtKGl0ZW06IENvbXBsZXRpb25JdGVtKTogdm9pZCB7XG5cdFx0aWYgKGlzTm9uRW1wdHlBcnJheShpdGVtLmNvbXBsZXRpb24uYWRkaXRpb25hbFRleHRFZGl0cykpIHtcblx0XHRcdGNvbnN0IG1zZyA9IG5scy5sb2NhbGl6ZSgnYXJpYS5hbGVydC5zbmlwcGV0JywgXCJBY2NlcHRpbmcgJ3swfScgbWFkZSB7MX0gYWRkaXRpb25hbCBlZGl0c1wiLCBpdGVtLnRleHRMYWJlbCwgaXRlbS5jb21wbGV0aW9uLmFkZGl0aW9uYWxUZXh0RWRpdHMubGVuZ3RoKTtcblx0XHRcdGFsZXJ0KG1zZyk7XG5cdFx0fVxuXHR9XG5cblx0dHJpZ2dlclN1Z2dlc3Qob25seUZyb20/OiBTZXQ8Q29tcGxldGlvbkl0ZW1Qcm92aWRlcj4sIGF1dG8/OiBib29sZWFuLCBub0ZpbHRlcj86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0dGhpcy5tb2RlbC50cmlnZ2VyKHtcblx0XHRcdFx0YXV0bzogYXV0byA/PyBmYWxzZSxcblx0XHRcdFx0Y29tcGxldGlvbk9wdGlvbnM6IHsgcHJvdmlkZXJGaWx0ZXI6IG9ubHlGcm9tLCBraW5kRmlsdGVyOiBub0ZpbHRlciA/IG5ldyBTZXQoKSA6IHVuZGVmaW5lZCB9XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuZWRpdG9yLnJldmVhbFBvc2l0aW9uKHRoaXMuZWRpdG9yLmdldFBvc2l0aW9uKCksIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHRcdHRoaXMuZWRpdG9yLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0dHJpZ2dlclN1Z2dlc3RBbmRBY2NlcHRCZXN0KGFyZzogeyBmYWxsYmFjazogc3RyaW5nIH0pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblxuXHRcdH1cblx0XHRjb25zdCBwb3NpdGlvbk5vdyA9IHRoaXMuZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cblx0XHRjb25zdCBmYWxsYmFjayA9ICgpID0+IHtcblx0XHRcdGlmIChwb3NpdGlvbk5vdy5lcXVhbHModGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKSEpKSB7XG5cdFx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGFyZy5mYWxsYmFjayk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1ha2VzVGV4dEVkaXQgPSAoaXRlbTogQ29tcGxldGlvbkl0ZW0pOiBib29sZWFuID0+IHtcblx0XHRcdGlmIChpdGVtLmNvbXBsZXRpb24uaW5zZXJ0VGV4dFJ1bGVzISAmIENvbXBsZXRpb25JdGVtSW5zZXJ0VGV4dFJ1bGUuSW5zZXJ0QXNTbmlwcGV0IHx8IGl0ZW0uY29tcGxldGlvbi5hZGRpdGlvbmFsVGV4dEVkaXRzKSB7XG5cdFx0XHRcdC8vIHNuaXBwZXQsIG90aGVyIGVkaXRvciAtPiBtYWtlcyBlZGl0XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpITtcblx0XHRcdGNvbnN0IHN0YXJ0Q29sdW1uID0gaXRlbS5lZGl0U3RhcnQuY29sdW1uO1xuXHRcdFx0Y29uc3QgZW5kQ29sdW1uID0gcG9zaXRpb24uY29sdW1uO1xuXHRcdFx0aWYgKGVuZENvbHVtbiAtIHN0YXJ0Q29sdW1uICE9PSBpdGVtLmNvbXBsZXRpb24uaW5zZXJ0VGV4dC5sZW5ndGgpIHtcblx0XHRcdFx0Ly8gdW5lcXVhbCBsZW5ndGhzIC0+IG1ha2VzIGVkaXRcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB0ZXh0Tm93ID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0VmFsdWVJblJhbmdlKHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBwb3NpdGlvbi5saW5lTnVtYmVyLFxuXHRcdFx0XHRzdGFydENvbHVtbixcblx0XHRcdFx0ZW5kTGluZU51bWJlcjogcG9zaXRpb24ubGluZU51bWJlcixcblx0XHRcdFx0ZW5kQ29sdW1uXG5cdFx0XHR9KTtcblx0XHRcdC8vIHVuZXF1YWwgdGV4dCAtPiBtYWtlcyBlZGl0XG5cdFx0XHRyZXR1cm4gdGV4dE5vdyAhPT0gaXRlbS5jb21wbGV0aW9uLmluc2VydFRleHQ7XG5cdFx0fTtcblxuXHRcdEV2ZW50Lm9uY2UodGhpcy5tb2RlbC5vbkRpZFRyaWdnZXIpKF8gPT4ge1xuXHRcdFx0Ly8gd2FpdCBmb3IgdHJpZ2dlciBiZWNhdXNlIG9ubHkgdGhlbiB0aGUgY2FuY2VsLWV2ZW50IGlzIHRydXN0d29ydGh5XG5cdFx0XHRjb25zdCBsaXN0ZW5lcjogSURpc3Bvc2FibGVbXSA9IFtdO1xuXG5cdFx0XHRFdmVudC5hbnk8YW55Pih0aGlzLm1vZGVsLm9uRGlkVHJpZ2dlciwgdGhpcy5tb2RlbC5vbkRpZENhbmNlbCkoKCkgPT4ge1xuXHRcdFx0XHQvLyByZXRyaWdnZXIgb3IgY2FuY2VsIC0+IHRyeSB0byB0eXBlIGRlZmF1bHQgdGV4dFxuXHRcdFx0XHRkaXNwb3NlKGxpc3RlbmVyKTtcblx0XHRcdFx0ZmFsbGJhY2soKTtcblx0XHRcdH0sIHVuZGVmaW5lZCwgbGlzdGVuZXIpO1xuXG5cdFx0XHR0aGlzLm1vZGVsLm9uRGlkU3VnZ2VzdCgoeyBjb21wbGV0aW9uTW9kZWwgfSkgPT4ge1xuXHRcdFx0XHRkaXNwb3NlKGxpc3RlbmVyKTtcblx0XHRcdFx0aWYgKGNvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRmYWxsYmFjaygpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuX21lbW9yeVNlcnZpY2Uuc2VsZWN0KHRoaXMuZWRpdG9yLmdldE1vZGVsKCkhLCB0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpISwgY29tcGxldGlvbk1vZGVsLml0ZW1zKTtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IGNvbXBsZXRpb25Nb2RlbC5pdGVtc1tpbmRleF07XG5cdFx0XHRcdGlmICghbWFrZXNUZXh0RWRpdChpdGVtKSkge1xuXHRcdFx0XHRcdGZhbGxiYWNrKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0XHR0aGlzLl9pbnNlcnRTdWdnZXN0aW9uKHsgaW5kZXgsIGl0ZW0sIG1vZGVsOiBjb21wbGV0aW9uTW9kZWwgfSwgSW5zZXJ0RmxhZ3MuS2VlcEFsdGVybmF0aXZlU3VnZ2VzdGlvbnMgfCBJbnNlcnRGbGFncy5Ob0JlZm9yZVVuZG9TdG9wIHwgSW5zZXJ0RmxhZ3MuTm9BZnRlclVuZG9TdG9wKTtcblxuXHRcdFx0fSwgdW5kZWZpbmVkLCBsaXN0ZW5lcik7XG5cdFx0fSk7XG5cblx0XHR0aGlzLm1vZGVsLnRyaWdnZXIoeyBhdXRvOiBmYWxzZSwgc2h5OiB0cnVlIH0pO1xuXHRcdHRoaXMuZWRpdG9yLnJldmVhbFBvc2l0aW9uKHBvc2l0aW9uTm93LCBTY3JvbGxUeXBlLlNtb290aCk7XG5cdFx0dGhpcy5lZGl0b3IuZm9jdXMoKTtcblx0fVxuXG5cdGFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbihrZWVwQWx0ZXJuYXRpdmVTdWdnZXN0aW9uczogYm9vbGVhbiwgYWx0ZXJuYXRpdmVPdmVyd3JpdGVDb25maWc6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBpdGVtID0gdGhpcy53aWRnZXQudmFsdWUuZ2V0Rm9jdXNlZEl0ZW0oKTtcblx0XHRsZXQgZmxhZ3MgPSAwO1xuXHRcdGlmIChrZWVwQWx0ZXJuYXRpdmVTdWdnZXN0aW9ucykge1xuXHRcdFx0ZmxhZ3MgfD0gSW5zZXJ0RmxhZ3MuS2VlcEFsdGVybmF0aXZlU3VnZ2VzdGlvbnM7XG5cdFx0fVxuXHRcdGlmIChhbHRlcm5hdGl2ZU92ZXJ3cml0ZUNvbmZpZykge1xuXHRcdFx0ZmxhZ3MgfD0gSW5zZXJ0RmxhZ3MuQWx0ZXJuYXRpdmVPdmVyd3JpdGVDb25maWc7XG5cdFx0fVxuXHRcdHRoaXMuX2luc2VydFN1Z2dlc3Rpb24oaXRlbSwgZmxhZ3MpO1xuXHR9XG5cblx0YWNjZXB0TmV4dFN1Z2dlc3Rpb24oKSB7XG5cdFx0dGhpcy5fYWx0ZXJuYXRpdmVzLnZhbHVlLm5leHQoKTtcblx0fVxuXG5cdGFjY2VwdFByZXZTdWdnZXN0aW9uKCkge1xuXHRcdHRoaXMuX2FsdGVybmF0aXZlcy52YWx1ZS5wcmV2KCk7XG5cdH1cblxuXHRjYW5jZWxTdWdnZXN0V2lkZ2V0KCk6IHZvaWQge1xuXHRcdHRoaXMubW9kZWwuY2FuY2VsKCk7XG5cdFx0dGhpcy5tb2RlbC5jbGVhcigpO1xuXHRcdHRoaXMud2lkZ2V0LnZhbHVlLmhpZGVXaWRnZXQoKTtcblx0fVxuXG5cdGZvY3VzU3VnZ2VzdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLndpZGdldC52YWx1ZS5mb2N1c1NlbGVjdGVkKCk7XG5cdH1cblxuXHRzZWxlY3ROZXh0U3VnZ2VzdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLndpZGdldC52YWx1ZS5zZWxlY3ROZXh0KCk7XG5cdH1cblxuXHRzZWxlY3ROZXh0UGFnZVN1Z2dlc3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQudmFsdWUuc2VsZWN0TmV4dFBhZ2UoKTtcblx0fVxuXG5cdHNlbGVjdExhc3RTdWdnZXN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0LnZhbHVlLnNlbGVjdExhc3QoKTtcblx0fVxuXG5cdHNlbGVjdFByZXZTdWdnZXN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0LnZhbHVlLnNlbGVjdFByZXZpb3VzKCk7XG5cdH1cblxuXHRzZWxlY3RQcmV2UGFnZVN1Z2dlc3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQudmFsdWUuc2VsZWN0UHJldmlvdXNQYWdlKCk7XG5cdH1cblxuXHRzZWxlY3RGaXJzdFN1Z2dlc3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQudmFsdWUuc2VsZWN0Rmlyc3QoKTtcblx0fVxuXG5cdHRvZ2dsZVN1Z2dlc3Rpb25EZXRhaWxzKCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0LnZhbHVlLnRvZ2dsZURldGFpbHMoKTtcblx0fVxuXG5cdHRvZ2dsZUV4cGxhaW5Nb2RlKCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0LnZhbHVlLnRvZ2dsZUV4cGxhaW5Nb2RlKCk7XG5cdH1cblxuXHR0b2dnbGVTdWdnZXN0aW9uRm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQudmFsdWUudG9nZ2xlRGV0YWlsc0ZvY3VzKCk7XG5cdH1cblxuXHRyZXNldFdpZGdldFNpemUoKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQudmFsdWUucmVzZXRQZXJzaXN0ZWRTaXplKCk7XG5cdH1cblxuXHRmb3JjZVJlbmRlcmluZ0Fib3ZlKCkge1xuXHRcdHRoaXMud2lkZ2V0LnZhbHVlLmZvcmNlUmVuZGVyaW5nQWJvdmUoKTtcblx0fVxuXG5cdHN0b3BGb3JjZVJlbmRlcmluZ0Fib3ZlKCkge1xuXHRcdGlmICghdGhpcy53aWRnZXQuaXNJbml0aWFsaXplZCkge1xuXHRcdFx0Ly8gVGhpcyBtZXRob2QgaGFzIG5vIGVmZmVjdCBpZiB0aGUgd2lkZ2V0IGlzIG5vdCBpbml0aWFsaXplZCB5ZXQuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMud2lkZ2V0LnZhbHVlLnN0b3BGb3JjZVJlbmRlcmluZ0Fib3ZlKCk7XG5cdH1cblxuXHRyZWdpc3RlclNlbGVjdG9yKHNlbGVjdG9yOiBJU3VnZ2VzdEl0ZW1QcmVzZWxlY3Rvcik6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdGhpcy5fc2VsZWN0b3JzLnJlZ2lzdGVyKHNlbGVjdG9yKTtcblx0fVxufVxuXG5jbGFzcyBQcmlvcml0eVJlZ2lzdHJ5PFQ+IHtcblx0cHJpdmF0ZSByZWFkb25seSBfaXRlbXMgPSBuZXcgQXJyYXk8VD4oKTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHByaW9yaXR5U2VsZWN0b3I6IChpdGVtOiBUKSA9PiBudW1iZXIpIHsgfVxuXG5cdHJlZ2lzdGVyKHZhbHVlOiBUKTogSURpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLl9pdGVtcy5pbmRleE9mKHZhbHVlKSAhPT0gLTEpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVmFsdWUgaXMgYWxyZWFkeSByZWdpc3RlcmVkJyk7XG5cdFx0fVxuXHRcdHRoaXMuX2l0ZW1zLnB1c2godmFsdWUpO1xuXHRcdHRoaXMuX2l0ZW1zLnNvcnQoKHMxLCBzMikgPT4gdGhpcy5wcmlvcml0eVNlbGVjdG9yKHMyKSAtIHRoaXMucHJpb3JpdHlTZWxlY3RvcihzMSkpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaWR4ID0gdGhpcy5faXRlbXMuaW5kZXhPZih2YWx1ZSk7XG5cdFx0XHRcdGlmIChpZHggPj0gMCkge1xuXHRcdFx0XHRcdHRoaXMuX2l0ZW1zLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGdldCBpdGVtc09yZGVyZWRCeVByaW9yaXR5RGVzYygpOiByZWFkb25seSBUW10ge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtcztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVHJpZ2dlclN1Z2dlc3RBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICdlZGl0b3IuYWN0aW9uLnRyaWdnZXJTdWdnZXN0JztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVHJpZ2dlclN1Z2dlc3RBY3Rpb24uaWQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignc3VnZ2VzdC50cmlnZ2VyLmxhYmVsJywgXCJUcmlnZ2VyIFN1Z2dlc3RcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSwgRWRpdG9yQ29udGV4dEtleXMuaGFzQ29tcGxldGlvbkl0ZW1Qcm92aWRlciwgU3VnZ2VzdENvbnRleHQuVmlzaWJsZS50b05lZ2F0ZWQoKSksXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNwYWNlLFxuXHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SV0sXG5cdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuU3BhY2UsIHNlY29uZGFyeTogW0tleU1vZC5BbHQgfCBLZXlDb2RlLkVzY2FwZSwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUldIH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRydW4oX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiBhbnkpOiB2b2lkIHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gU3VnZ2VzdENvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0eXBlIFRyaWdnZXJBcmdzID0geyBhdXRvOiBib29sZWFuIH07XG5cdFx0bGV0IGF1dG86IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGFyZ3MgJiYgdHlwZW9mIGFyZ3MgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRpZiAoKDxUcmlnZ2VyQXJncz5hcmdzKS5hdXRvID09PSB0cnVlKSB7XG5cdFx0XHRcdGF1dG8gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnRyb2xsZXIudHJpZ2dlclN1Z2dlc3QodW5kZWZpbmVkLCBhdXRvLCB1bmRlZmluZWQpO1xuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uKFN1Z2dlc3RDb250cm9sbGVyLklELCBTdWdnZXN0Q29udHJvbGxlciwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbi5CZWZvcmVGaXJzdEludGVyYWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFRyaWdnZXJTdWdnZXN0QWN0aW9uKTtcblxuY29uc3Qgd2VpZ2h0ID0gS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliICsgOTA7XG5cbmNvbnN0IFN1Z2dlc3RDb21tYW5kID0gRWRpdG9yQ29tbWFuZC5iaW5kVG9Db250cmlidXRpb248U3VnZ2VzdENvbnRyb2xsZXI+KFN1Z2dlc3RDb250cm9sbGVyLmdldCk7XG5cblxucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBTdWdnZXN0Q29tbWFuZCh7XG5cdGlkOiAnYWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uJyxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoU3VnZ2VzdENvbnRleHQuVmlzaWJsZSwgU3VnZ2VzdENvbnRleHQuSGFzRm9jdXNlZFN1Z2dlc3Rpb24pLFxuXHRoYW5kbGVyKHgpIHtcblx0XHR4LmFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbih0cnVlLCBmYWxzZSk7XG5cdH0sXG5cdGtiT3B0czogW3tcblx0XHQvLyBub3JtYWwgdGFiXG5cdFx0cHJpbWFyeTogS2V5Q29kZS5UYWIsXG5cdFx0a2JFeHByOiBDb250ZXh0S2V5RXhwci5hbmQoU3VnZ2VzdENvbnRleHQuVmlzaWJsZSwgRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMpLFxuXHRcdHdlaWdodCxcblx0fSwge1xuXHRcdC8vIGFjY2VwdCBvbiBlbnRlciBoYXMgc3BlY2lhbCBydWxlc1xuXHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXIsXG5cdFx0a2JFeHByOiBDb250ZXh0S2V5RXhwci5hbmQoU3VnZ2VzdENvbnRleHQuVmlzaWJsZSwgRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsIFN1Z2dlc3RDb250ZXh0LkFjY2VwdFN1Z2dlc3Rpb25zT25FbnRlciwgU3VnZ2VzdENvbnRleHQuTWFrZXNUZXh0RWRpdCksXG5cdFx0d2VpZ2h0LFxuXHR9XSxcblx0bWVudU9wdHM6IFt7XG5cdFx0bWVudUlkOiBzdWdnZXN0V2lkZ2V0U3RhdHVzYmFyTWVudSxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdhY2NlcHQuaW5zZXJ0JywgXCJJbnNlcnRcIiksXG5cdFx0Z3JvdXA6ICdsZWZ0Jyxcblx0XHRvcmRlcjogMSxcblx0XHR3aGVuOiBTdWdnZXN0Q29udGV4dC5IYXNJbnNlcnRBbmRSZXBsYWNlUmFuZ2UudG9OZWdhdGVkKClcblx0fSwge1xuXHRcdG1lbnVJZDogc3VnZ2VzdFdpZGdldFN0YXR1c2Jhck1lbnUsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnYWNjZXB0Lmluc2VydCcsIFwiSW5zZXJ0XCIpLFxuXHRcdGdyb3VwOiAnbGVmdCcsXG5cdFx0b3JkZXI6IDEsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFN1Z2dlc3RDb250ZXh0Lkhhc0luc2VydEFuZFJlcGxhY2VSYW5nZSwgU3VnZ2VzdENvbnRleHQuSW5zZXJ0TW9kZS5pc0VxdWFsVG8oJ2luc2VydCcpKVxuXHR9LCB7XG5cdFx0bWVudUlkOiBzdWdnZXN0V2lkZ2V0U3RhdHVzYmFyTWVudSxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdhY2NlcHQucmVwbGFjZScsIFwiUmVwbGFjZVwiKSxcblx0XHRncm91cDogJ2xlZnQnLFxuXHRcdG9yZGVyOiAxLFxuXHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChTdWdnZXN0Q29udGV4dC5IYXNJbnNlcnRBbmRSZXBsYWNlUmFuZ2UsIFN1Z2dlc3RDb250ZXh0Lkluc2VydE1vZGUuaXNFcXVhbFRvKCdyZXBsYWNlJykpXG5cdH1dXG59KSk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgU3VnZ2VzdENvbW1hbmQoe1xuXHRpZDogJ2FjY2VwdEFsdGVybmF0aXZlU2VsZWN0ZWRTdWdnZXN0aW9uJyxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoU3VnZ2VzdENvbnRleHQuVmlzaWJsZSwgRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsIFN1Z2dlc3RDb250ZXh0Lkhhc0ZvY3VzZWRTdWdnZXN0aW9uKSxcblx0a2JPcHRzOiB7XG5cdFx0d2VpZ2h0OiB3ZWlnaHQsXG5cdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdHNlY29uZGFyeTogW0tleU1vZC5TaGlmdCB8IEtleUNvZGUuVGFiXSxcblx0fSxcblx0aGFuZGxlcih4KSB7XG5cdFx0eC5hY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb24oZmFsc2UsIHRydWUpO1xuXHR9LFxuXHRtZW51T3B0czogW3tcblx0XHRtZW51SWQ6IHN1Z2dlc3RXaWRnZXRTdGF0dXNiYXJNZW51LFxuXHRcdGdyb3VwOiAnbGVmdCcsXG5cdFx0b3JkZXI6IDIsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFN1Z2dlc3RDb250ZXh0Lkhhc0luc2VydEFuZFJlcGxhY2VSYW5nZSwgU3VnZ2VzdENvbnRleHQuSW5zZXJ0TW9kZS5pc0VxdWFsVG8oJ2luc2VydCcpKSxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdhY2NlcHQucmVwbGFjZScsIFwiUmVwbGFjZVwiKVxuXHR9LCB7XG5cdFx0bWVudUlkOiBzdWdnZXN0V2lkZ2V0U3RhdHVzYmFyTWVudSxcblx0XHRncm91cDogJ2xlZnQnLFxuXHRcdG9yZGVyOiAyLFxuXHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChTdWdnZXN0Q29udGV4dC5IYXNJbnNlcnRBbmRSZXBsYWNlUmFuZ2UsIFN1Z2dlc3RDb250ZXh0Lkluc2VydE1vZGUuaXNFcXVhbFRvKCdyZXBsYWNlJykpLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2FjY2VwdC5pbnNlcnQnLCBcIkluc2VydFwiKVxuXHR9XVxufSkpO1xuXG5cbi8vIGNvbnRpbnVlIHRvIHN1cHBvcnQgdGhlIG9sZCBjb21tYW5kXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFsaWFzKCdhY2NlcHRTZWxlY3RlZFN1Z2dlc3Rpb25PbkVudGVyJywgJ2FjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbicpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFN1Z2dlc3RDb21tYW5kKHtcblx0aWQ6ICdoaWRlU3VnZ2VzdFdpZGdldCcsXG5cdHByZWNvbmRpdGlvbjogU3VnZ2VzdENvbnRleHQuVmlzaWJsZSxcblx0aGFuZGxlcjogeCA9PiB4LmNhbmNlbFN1Z2dlc3RXaWRnZXQoKSxcblx0a2JPcHRzOiB7XG5cdFx0d2VpZ2h0OiB3ZWlnaHQsXG5cdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVzY2FwZV1cblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFN1Z2dlc3RDb21tYW5kKHtcblx0aWQ6ICdzZWxlY3ROZXh0U3VnZ2VzdGlvbicsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFN1Z2dlc3RDb250ZXh0LlZpc2libGUsIENvbnRleHRLZXlFeHByLm9yKFN1Z2dlc3RDb250ZXh0Lk11bHRpcGxlU3VnZ2VzdGlvbnMsIFN1Z2dlc3RDb250ZXh0Lkhhc0ZvY3VzZWRTdWdnZXN0aW9uLm5lZ2F0ZSgpKSksXG5cdGhhbmRsZXI6IGMgPT4gYy5zZWxlY3ROZXh0U3VnZ2VzdGlvbigpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IHdlaWdodCxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdHByaW1hcnk6IEtleUNvZGUuRG93bkFycm93LFxuXHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3ddLFxuXHRcdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkRvd25BcnJvdywgc2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRvd25BcnJvdywgS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleU5dIH1cblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFN1Z2dlc3RDb21tYW5kKHtcblx0aWQ6ICdzZWxlY3ROZXh0UGFnZVN1Z2dlc3Rpb24nLFxuXHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChTdWdnZXN0Q29udGV4dC5WaXNpYmxlLCBDb250ZXh0S2V5RXhwci5vcihTdWdnZXN0Q29udGV4dC5NdWx0aXBsZVN1Z2dlc3Rpb25zLCBTdWdnZXN0Q29udGV4dC5IYXNGb2N1c2VkU3VnZ2VzdGlvbi5uZWdhdGUoKSkpLFxuXHRoYW5kbGVyOiBjID0+IGMuc2VsZWN0TmV4dFBhZ2VTdWdnZXN0aW9uKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogd2VpZ2h0LFxuXHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0cHJpbWFyeTogS2V5Q29kZS5QYWdlRG93bixcblx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuUGFnZURvd25dXG5cdH1cbn0pKTtcblxucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBTdWdnZXN0Q29tbWFuZCh7XG5cdGlkOiAnc2VsZWN0TGFzdFN1Z2dlc3Rpb24nLFxuXHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChTdWdnZXN0Q29udGV4dC5WaXNpYmxlLCBDb250ZXh0S2V5RXhwci5vcihTdWdnZXN0Q29udGV4dC5NdWx0aXBsZVN1Z2dlc3Rpb25zLCBTdWdnZXN0Q29udGV4dC5IYXNGb2N1c2VkU3VnZ2VzdGlvbi5uZWdhdGUoKSkpLFxuXHRoYW5kbGVyOiBjID0+IGMuc2VsZWN0TGFzdFN1Z2dlc3Rpb24oKVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFN1Z2dlc3RDb21tYW5kKHtcblx0aWQ6ICdzZWxlY3RQcmV2U3VnZ2VzdGlvbicsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFN1Z2dlc3RDb250ZXh0LlZpc2libGUsIENvbnRleHRLZXlFeHByLm9yKFN1Z2dlc3RDb250ZXh0Lk11bHRpcGxlU3VnZ2VzdGlvbnMsIFN1Z2dlc3RDb250ZXh0Lkhhc0ZvY3VzZWRTdWdnZXN0aW9uLm5lZ2F0ZSgpKSksXG5cdGhhbmRsZXI6IGMgPT4gYy5zZWxlY3RQcmV2U3VnZ2VzdGlvbigpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IHdlaWdodCxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdHByaW1hcnk6IEtleUNvZGUuVXBBcnJvdyxcblx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvd10sXG5cdFx0bWFjOiB7IHByaW1hcnk6IEtleUNvZGUuVXBBcnJvdywgc2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlVwQXJyb3csIEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlQXSB9XG5cdH1cbn0pKTtcblxucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBTdWdnZXN0Q29tbWFuZCh7XG5cdGlkOiAnc2VsZWN0UHJldlBhZ2VTdWdnZXN0aW9uJyxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoU3VnZ2VzdENvbnRleHQuVmlzaWJsZSwgQ29udGV4dEtleUV4cHIub3IoU3VnZ2VzdENvbnRleHQuTXVsdGlwbGVTdWdnZXN0aW9ucywgU3VnZ2VzdENvbnRleHQuSGFzRm9jdXNlZFN1Z2dlc3Rpb24ubmVnYXRlKCkpKSxcblx0aGFuZGxlcjogYyA9PiBjLnNlbGVjdFByZXZQYWdlU3VnZ2VzdGlvbigpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IHdlaWdodCxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdHByaW1hcnk6IEtleUNvZGUuUGFnZVVwLFxuXHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5QYWdlVXBdXG5cdH1cbn0pKTtcblxucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBTdWdnZXN0Q29tbWFuZCh7XG5cdGlkOiAnc2VsZWN0Rmlyc3RTdWdnZXN0aW9uJyxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoU3VnZ2VzdENvbnRleHQuVmlzaWJsZSwgQ29udGV4dEtleUV4cHIub3IoU3VnZ2VzdENvbnRleHQuTXVsdGlwbGVTdWdnZXN0aW9ucywgU3VnZ2VzdENvbnRleHQuSGFzRm9jdXNlZFN1Z2dlc3Rpb24ubmVnYXRlKCkpKSxcblx0aGFuZGxlcjogYyA9PiBjLnNlbGVjdEZpcnN0U3VnZ2VzdGlvbigpXG59KSk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgU3VnZ2VzdENvbW1hbmQoe1xuXHRpZDogJ2ZvY3VzU3VnZ2VzdGlvbicsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFN1Z2dlc3RDb250ZXh0LlZpc2libGUsIFN1Z2dlc3RDb250ZXh0Lkhhc0ZvY3VzZWRTdWdnZXN0aW9uLm5lZ2F0ZSgpKSxcblx0aGFuZGxlcjogeCA9PiB4LmZvY3VzU3VnZ2VzdGlvbigpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IHdlaWdodCxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TcGFjZSxcblx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SV0sXG5cdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5TcGFjZSwgc2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUldIH1cblx0fSxcbn0pKTtcblxucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBTdWdnZXN0Q29tbWFuZCh7XG5cdGlkOiAnZm9jdXNBbmRBY2NlcHRTdWdnZXN0aW9uJyxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoU3VnZ2VzdENvbnRleHQuVmlzaWJsZSwgU3VnZ2VzdENvbnRleHQuSGFzRm9jdXNlZFN1Z2dlc3Rpb24ubmVnYXRlKCkpLFxuXHRoYW5kbGVyOiBjID0+IHtcblx0XHRjLmZvY3VzU3VnZ2VzdGlvbigpO1xuXHRcdGMuYWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uKHRydWUsIGZhbHNlKTtcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFN1Z2dlc3RDb21tYW5kKHtcblx0aWQ6ICd0b2dnbGVTdWdnZXN0aW9uRGV0YWlscycsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFN1Z2dlc3RDb250ZXh0LlZpc2libGUsIFN1Z2dlc3RDb250ZXh0Lkhhc0ZvY3VzZWRTdWdnZXN0aW9uKSxcblx0aGFuZGxlcjogeCA9PiB4LnRvZ2dsZVN1Z2dlc3Rpb25EZXRhaWxzKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogd2VpZ2h0LFxuXHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNwYWNlLFxuXHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlJXSxcblx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLlNwYWNlLCBzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SV0gfVxuXHR9LFxuXHRtZW51T3B0czogW3tcblx0XHRtZW51SWQ6IHN1Z2dlc3RXaWRnZXRTdGF0dXNiYXJNZW51LFxuXHRcdGdyb3VwOiAncmlnaHQnLFxuXHRcdG9yZGVyOiAxLFxuXHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChTdWdnZXN0Q29udGV4dC5EZXRhaWxzVmlzaWJsZSwgU3VnZ2VzdENvbnRleHQuQ2FuUmVzb2x2ZSksXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnZGV0YWlsLm1vcmUnLCBcIlNob3cgTGVzc1wiKVxuXHR9LCB7XG5cdFx0bWVudUlkOiBzdWdnZXN0V2lkZ2V0U3RhdHVzYmFyTWVudSxcblx0XHRncm91cDogJ3JpZ2h0Jyxcblx0XHRvcmRlcjogMSxcblx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoU3VnZ2VzdENvbnRleHQuRGV0YWlsc1Zpc2libGUudG9OZWdhdGVkKCksIFN1Z2dlc3RDb250ZXh0LkNhblJlc29sdmUpLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2RldGFpbC5sZXNzJywgXCJTaG93IE1vcmVcIilcblx0fV1cbn0pKTtcblxucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBTdWdnZXN0Q29tbWFuZCh7XG5cdGlkOiAndG9nZ2xlRXhwbGFpbk1vZGUnLFxuXHRwcmVjb25kaXRpb246IFN1Z2dlc3RDb250ZXh0LlZpc2libGUsXG5cdGhhbmRsZXI6IHggPT4geC50b2dnbGVFeHBsYWluTW9kZSgpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYixcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2xhc2gsXG5cdH1cbn0pKTtcblxucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBTdWdnZXN0Q29tbWFuZCh7XG5cdGlkOiAndG9nZ2xlU3VnZ2VzdGlvbkZvY3VzJyxcblx0cHJlY29uZGl0aW9uOiBTdWdnZXN0Q29udGV4dC5WaXNpYmxlLFxuXHRoYW5kbGVyOiB4ID0+IHgudG9nZ2xlU3VnZ2VzdGlvbkZvY3VzKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogd2VpZ2h0LFxuXHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5TcGFjZSxcblx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5TcGFjZSB9XG5cdH1cbn0pKTtcblxuLy8jcmVnaW9uIHRhYiBjb21wbGV0aW9uc1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFN1Z2dlc3RDb21tYW5kKHtcblx0aWQ6ICdpbnNlcnRCZXN0Q29tcGxldGlvbicsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLmVkaXRvci50YWJDb21wbGV0aW9uJywgJ29uJyksXG5cdFx0V29yZENvbnRleHRLZXkuQXRFbmQsXG5cdFx0U3VnZ2VzdENvbnRleHQuVmlzaWJsZS50b05lZ2F0ZWQoKSxcblx0XHRTdWdnZXN0QWx0ZXJuYXRpdmVzLk90aGVyU3VnZ2VzdGlvbnMudG9OZWdhdGVkKCksXG5cdFx0U25pcHBldENvbnRyb2xsZXIyLkluU25pcHBldE1vZGUudG9OZWdhdGVkKClcblx0KSxcblx0aGFuZGxlcjogKHgsIGFyZykgPT4ge1xuXG5cdFx0eC50cmlnZ2VyU3VnZ2VzdEFuZEFjY2VwdEJlc3QoaXNPYmplY3QoYXJnKSA/IHsgZmFsbGJhY2s6ICd0YWInLCAuLi5hcmcgfSA6IHsgZmFsbGJhY2s6ICd0YWInIH0pO1xuXHR9LFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQsXG5cdFx0cHJpbWFyeTogS2V5Q29kZS5UYWJcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFN1Z2dlc3RDb21tYW5kKHtcblx0aWQ6ICdpbnNlcnROZXh0U3VnZ2VzdGlvbicsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLmVkaXRvci50YWJDb21wbGV0aW9uJywgJ29uJyksXG5cdFx0U3VnZ2VzdEFsdGVybmF0aXZlcy5PdGhlclN1Z2dlc3Rpb25zLFxuXHRcdFN1Z2dlc3RDb250ZXh0LlZpc2libGUudG9OZWdhdGVkKCksXG5cdFx0U25pcHBldENvbnRyb2xsZXIyLkluU25pcHBldE1vZGUudG9OZWdhdGVkKClcblx0KSxcblx0aGFuZGxlcjogeCA9PiB4LmFjY2VwdE5leHRTdWdnZXN0aW9uKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogd2VpZ2h0LFxuXHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0cHJpbWFyeTogS2V5Q29kZS5UYWJcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFN1Z2dlc3RDb21tYW5kKHtcblx0aWQ6ICdpbnNlcnRQcmV2U3VnZ2VzdGlvbicsXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLmVkaXRvci50YWJDb21wbGV0aW9uJywgJ29uJyksXG5cdFx0U3VnZ2VzdEFsdGVybmF0aXZlcy5PdGhlclN1Z2dlc3Rpb25zLFxuXHRcdFN1Z2dlc3RDb250ZXh0LlZpc2libGUudG9OZWdhdGVkKCksXG5cdFx0U25pcHBldENvbnRyb2xsZXIyLkluU25pcHBldE1vZGUudG9OZWdhdGVkKClcblx0KSxcblx0aGFuZGxlcjogeCA9PiB4LmFjY2VwdFByZXZTdWdnZXN0aW9uKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogd2VpZ2h0LFxuXHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5UYWJcblx0fVxufSkpO1xuXG5cbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKGNsYXNzIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24ucmVzZXRTdWdnZXN0U2l6ZScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignc3VnZ2VzdC5yZXNldC5sYWJlbCcsIFwiUmVzZXQgU3VnZ2VzdCBXaWRnZXQgU2l6ZVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0U3VnZ2VzdENvbnRyb2xsZXIuZ2V0KGVkaXRvcik/LnJlc2V0V2lkZ2V0U2l6ZSgpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxhQUFhO0FB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
