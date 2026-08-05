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
import { Delayer } from "../../../../base/common/async.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as strings from "../../../../base/common/strings.js";
import { EditorAction, EditorCommand, EditorContributionInstantiation, MultiEditorAction, registerEditorAction, registerEditorCommand, registerEditorContribution, registerMultiEditorAction } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { overviewRulerRangeHighlight } from "../../../common/core/editorColorRegistry.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { OverviewRulerLane } from "../../../common/model.js";
import { CONTEXT_FIND_INPUT_FOCUSED, CONTEXT_FIND_WIDGET_VISIBLE, CONTEXT_REPLACE_INPUT_FOCUSED, FindModelBoundToEditorModel, FIND_IDS, ToggleCaseSensitiveKeybinding, TogglePreserveCaseKeybinding, ToggleRegexKeybinding, ToggleSearchScopeKeybinding, ToggleWholeWordKeybinding } from "./findModel.js";
import { FindOptionsWidget } from "./findOptionsWidget.js";
import { FindReplaceState } from "./findState.js";
import { FindWidget } from "./findWidget.js";
import * as nls from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IThemeService, themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { FindWidgetSearchHistory } from "./findWidgetSearchHistory.js";
import { ReplaceWidgetHistory } from "./replaceWidgetHistory.js";
const SEARCH_STRING_MAX_LENGTH = 524288;
function getSelectionSearchString(editor, seedSearchStringFromSelection = "single", seedSearchStringFromNonEmptySelection = false) {
  if (!editor.hasModel()) {
    return null;
  }
  const selection = editor.getSelection();
  if (seedSearchStringFromSelection === "single" && selection.startLineNumber === selection.endLineNumber || seedSearchStringFromSelection === "multiple") {
    if (selection.isEmpty()) {
      const wordAtPosition = editor.getConfiguredWordAtPosition(selection.getStartPosition());
      if (wordAtPosition && false === seedSearchStringFromNonEmptySelection) {
        return wordAtPosition.word;
      }
    } else {
      if (editor.getModel().getValueLengthInRange(selection) < SEARCH_STRING_MAX_LENGTH) {
        return editor.getModel().getValueInRange(selection);
      }
    }
  }
  return null;
}
var FindStartFocusAction = /* @__PURE__ */ ((FindStartFocusAction2) => {
  FindStartFocusAction2[FindStartFocusAction2["NoFocusChange"] = 0] = "NoFocusChange";
  FindStartFocusAction2[FindStartFocusAction2["FocusFindInput"] = 1] = "FocusFindInput";
  FindStartFocusAction2[FindStartFocusAction2["FocusReplaceInput"] = 2] = "FocusReplaceInput";
  return FindStartFocusAction2;
})(FindStartFocusAction || {});
let CommonFindController = class extends Disposable {
  get editor() {
    return this._editor;
  }
  static get(editor) {
    return editor.getContribution(CommonFindController.ID);
  }
  constructor(editor, contextKeyService, storageService, clipboardService, notificationService, hoverService) {
    super();
    this._editor = editor;
    this._findWidgetVisible = CONTEXT_FIND_WIDGET_VISIBLE.bindTo(contextKeyService);
    this._contextKeyService = contextKeyService;
    this._storageService = storageService;
    this._clipboardService = clipboardService;
    this._notificationService = notificationService;
    this._hoverService = hoverService;
    this._updateHistoryDelayer = new Delayer(500);
    this._state = this._register(new FindReplaceState());
    this.loadQueryState();
    this._register(this._state.onFindReplaceStateChange((e) => this._onStateChanged(e)));
    this._model = null;
    this._register(this._editor.onDidChangeModel(() => {
      const shouldRestartFind = this._editor.getModel() && this._state.isRevealed;
      this.disposeModel();
      this._state.change({
        searchScope: null,
        matchCase: this._storageService.getBoolean("editor.matchCase", StorageScope.WORKSPACE, false),
        wholeWord: this._storageService.getBoolean("editor.wholeWord", StorageScope.WORKSPACE, false),
        isRegex: this._storageService.getBoolean("editor.isRegex", StorageScope.WORKSPACE, false),
        preserveCase: this._storageService.getBoolean("editor.preserveCase", StorageScope.WORKSPACE, false)
      }, false);
      if (shouldRestartFind) {
        this._start({
          forceRevealReplace: false,
          seedSearchStringFromSelection: "none",
          seedSearchStringFromNonEmptySelection: false,
          seedSearchStringFromGlobalClipboard: false,
          shouldFocus: 0 /* NoFocusChange */,
          shouldAnimate: false,
          updateSearchScope: false,
          loop: this._editor.getOption(EditorOption.find).loop
        });
      }
    }));
  }
  dispose() {
    this.disposeModel();
    super.dispose();
  }
  disposeModel() {
    if (this._model) {
      this._model.dispose();
      this._model = null;
    }
  }
  _onStateChanged(e) {
    this.saveQueryState(e);
    if (e.isRevealed) {
      if (this._state.isRevealed) {
        this._findWidgetVisible.set(true);
      } else {
        this._findWidgetVisible.reset();
        this.disposeModel();
      }
    }
    if (e.searchString) {
      this.setGlobalBufferTerm(this._state.searchString);
    }
  }
  saveQueryState(e) {
    if (e.isRegex) {
      this._storageService.store("editor.isRegex", this._state.actualIsRegex, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    if (e.wholeWord) {
      this._storageService.store("editor.wholeWord", this._state.actualWholeWord, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    if (e.matchCase) {
      this._storageService.store("editor.matchCase", this._state.actualMatchCase, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    if (e.preserveCase) {
      this._storageService.store("editor.preserveCase", this._state.actualPreserveCase, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
  }
  loadQueryState() {
    this._state.change({
      matchCase: this._storageService.getBoolean("editor.matchCase", StorageScope.WORKSPACE, this._state.matchCase),
      wholeWord: this._storageService.getBoolean("editor.wholeWord", StorageScope.WORKSPACE, this._state.wholeWord),
      isRegex: this._storageService.getBoolean("editor.isRegex", StorageScope.WORKSPACE, this._state.isRegex),
      preserveCase: this._storageService.getBoolean("editor.preserveCase", StorageScope.WORKSPACE, this._state.preserveCase)
    }, false);
  }
  isFindInputFocused() {
    return !!CONTEXT_FIND_INPUT_FOCUSED.getValue(this._contextKeyService);
  }
  getState() {
    return this._state;
  }
  closeFindWidget() {
    this._state.change({
      isRevealed: false,
      searchScope: null
    }, false);
    this._editor.focus();
  }
  toggleCaseSensitive() {
    this._state.change({ matchCase: !this._state.matchCase }, false);
    if (!this._state.isRevealed) {
      this.highlightFindOptions();
    }
  }
  toggleWholeWords() {
    this._state.change({ wholeWord: !this._state.wholeWord }, false);
    if (!this._state.isRevealed) {
      this.highlightFindOptions();
    }
  }
  toggleRegex() {
    this._state.change({ isRegex: !this._state.isRegex }, false);
    if (!this._state.isRevealed) {
      this.highlightFindOptions();
    }
  }
  togglePreserveCase() {
    this._state.change({ preserveCase: !this._state.preserveCase }, false);
    if (!this._state.isRevealed) {
      this.highlightFindOptions();
    }
  }
  toggleSearchScope() {
    if (this._state.searchScope) {
      this._state.change({ searchScope: null }, true);
    } else {
      if (this._editor.hasModel()) {
        let selections = this._editor.getSelections();
        selections = selections.map((selection) => {
          if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
            selection = selection.setEndPosition(
              selection.endLineNumber - 1,
              this._editor.getModel().getLineMaxColumn(selection.endLineNumber - 1)
            );
          }
          if (!selection.isEmpty()) {
            return selection;
          }
          return null;
        }).filter((element) => !!element);
        if (selections.length) {
          this._state.change({ searchScope: selections }, true);
        }
      }
    }
  }
  setSearchString(searchString) {
    if (this._state.isRegex) {
      searchString = strings.escapeRegExpCharacters(searchString);
    }
    this._state.change({ searchString }, false);
  }
  highlightFindOptions(ignoreWhenVisible = false) {
  }
  async _start(opts, newState) {
    this.disposeModel();
    if (!this._editor.hasModel()) {
      return;
    }
    const stateChanges = {
      ...newState,
      isRevealed: true
    };
    if (opts.seedSearchStringFromSelection === "single") {
      const selectionSearchString = getSelectionSearchString(this._editor, opts.seedSearchStringFromSelection, opts.seedSearchStringFromNonEmptySelection);
      if (selectionSearchString) {
        if (this._state.isRegex) {
          stateChanges.searchString = strings.escapeRegExpCharacters(selectionSearchString);
        } else {
          stateChanges.searchString = selectionSearchString;
        }
      }
    } else if (opts.seedSearchStringFromSelection === "multiple" && !opts.updateSearchScope) {
      const selectionSearchString = getSelectionSearchString(this._editor, opts.seedSearchStringFromSelection);
      if (selectionSearchString) {
        stateChanges.searchString = selectionSearchString;
      }
    }
    if (!stateChanges.searchString && opts.seedSearchStringFromGlobalClipboard) {
      const selectionSearchString = await this.getGlobalBufferTerm();
      if (!this._editor.hasModel()) {
        return;
      }
      if (selectionSearchString) {
        stateChanges.searchString = selectionSearchString;
      }
    }
    if (opts.forceRevealReplace || stateChanges.isReplaceRevealed) {
      stateChanges.isReplaceRevealed = true;
    } else if (!this._findWidgetVisible.get()) {
      stateChanges.isReplaceRevealed = false;
    }
    if (opts.updateSearchScope) {
      const currentSelections = this._editor.getSelections();
      if (currentSelections.some((selection) => !selection.isEmpty())) {
        stateChanges.searchScope = currentSelections;
      }
    }
    stateChanges.loop = opts.loop;
    this._state.change(stateChanges, false);
    if (!this._model) {
      this._model = new FindModelBoundToEditorModel(this._editor, this._state);
    }
  }
  start(opts, newState) {
    return this._start(opts, newState);
  }
  moveToNextMatch() {
    if (this._model) {
      this._model.moveToNextMatch();
      return true;
    }
    return false;
  }
  moveToPrevMatch() {
    if (this._model) {
      this._model.moveToPrevMatch();
      return true;
    }
    return false;
  }
  goToMatch(index) {
    if (this._model) {
      this._model.moveToMatch(index);
      return true;
    }
    return false;
  }
  replace() {
    if (this._model) {
      this._model.replace();
      return true;
    }
    return false;
  }
  replaceAll() {
    if (this._model) {
      if (this._editor.getModel()?.isTooLargeForHeapOperation()) {
        this._notificationService.warn(nls.localize("too.large.for.replaceall", "The file is too large to perform a replace all operation."));
        return false;
      }
      this._model.replaceAll();
      return true;
    }
    return false;
  }
  selectAllMatches() {
    if (this._model) {
      this._model.selectAllMatches();
      this._editor.focus();
      return true;
    }
    return false;
  }
  async getGlobalBufferTerm() {
    if (this._editor.getOption(EditorOption.find).globalFindClipboard && this._editor.hasModel() && !this._editor.getModel().isTooLargeForSyncing()) {
      return this._clipboardService.readFindText();
    }
    return "";
  }
  setGlobalBufferTerm(text) {
    if (this._editor.getOption(EditorOption.find).globalFindClipboard && this._editor.hasModel() && !this._editor.getModel().isTooLargeForSyncing()) {
      this._clipboardService.writeFindText(text);
    }
  }
};
CommonFindController.ID = "editor.contrib.findController";
CommonFindController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IClipboardService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IHoverService)
], CommonFindController);
let FindController = class extends CommonFindController {
  constructor(editor, _contextViewService, _contextKeyService, _keybindingService, _themeService, notificationService, _storageService, clipboardService, hoverService) {
    super(editor, _contextKeyService, _storageService, clipboardService, notificationService, hoverService);
    this._contextViewService = _contextViewService;
    this._keybindingService = _keybindingService;
    this._themeService = _themeService;
    this._widget = null;
    this._findOptionsWidget = null;
    this._findWidgetSearchHistory = FindWidgetSearchHistory.getOrCreate(_storageService);
    this._replaceWidgetHistory = ReplaceWidgetHistory.getOrCreate(_storageService);
  }
  async _start(opts, newState) {
    if (!this._widget) {
      this._createFindWidget();
    }
    const selection = this._editor.getSelection();
    let updateSearchScope = false;
    switch (this._editor.getOption(EditorOption.find).autoFindInSelection) {
      case "always":
        updateSearchScope = true;
        break;
      case "never":
        updateSearchScope = false;
        break;
      case "multiline": {
        const isSelectionMultipleLine = !!selection && selection.startLineNumber !== selection.endLineNumber;
        updateSearchScope = isSelectionMultipleLine;
        break;
      }
      default:
        break;
    }
    opts.updateSearchScope = opts.updateSearchScope || updateSearchScope;
    await super._start(opts, newState);
    if (this._widget) {
      if (opts.shouldFocus === 2 /* FocusReplaceInput */) {
        this._widget.focusReplaceInput();
      } else if (opts.shouldFocus === 1 /* FocusFindInput */) {
        this._widget.focusFindInput();
      }
    }
  }
  highlightFindOptions(ignoreWhenVisible = false) {
    if (!this._widget) {
      this._createFindWidget();
    }
    if (this._state.isRevealed && !ignoreWhenVisible) {
      this._widget.highlightFindOptions();
    } else {
      this._findOptionsWidget.highlightFindOptions();
    }
  }
  _createFindWidget() {
    this._widget = this._register(new FindWidget(this._editor, this, this._state, this._contextViewService, this._keybindingService, this._contextKeyService, this._themeService, this._storageService, this._notificationService, this._hoverService, this._findWidgetSearchHistory, this._replaceWidgetHistory));
    this._findOptionsWidget = this._register(new FindOptionsWidget(this._editor, this._state, this._keybindingService));
  }
  saveViewState() {
    return this._widget?.getViewState();
  }
  restoreViewState(state) {
    this._widget?.setViewState(state);
  }
};
FindController = __decorateClass([
  __decorateParam(1, IContextViewService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IClipboardService),
  __decorateParam(8, IHoverService)
], FindController);
const StartFindAction = registerMultiEditorAction(new MultiEditorAction({
  id: FIND_IDS.StartFindAction,
  label: nls.localize2("startFindAction", "Find"),
  precondition: ContextKeyExpr.or(EditorContextKeys.focus, ContextKeyExpr.has("editorIsOpen")),
  kbOpts: {
    kbExpr: null,
    primary: KeyMod.CtrlCmd | KeyCode.KeyF,
    weight: KeybindingWeight.EditorContrib
  },
  menuOpts: {
    menuId: MenuId.MenubarEditMenu,
    group: "3_find",
    title: nls.localize({ key: "miFind", comment: ["&& denotes a mnemonic"] }, "&&Find"),
    order: 1
  }
}));
StartFindAction.addImplementation(0, (accessor, editor, args) => {
  const controller = CommonFindController.get(editor);
  if (!controller) {
    return false;
  }
  return controller.start({
    forceRevealReplace: false,
    seedSearchStringFromSelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
    seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
    seedSearchStringFromGlobalClipboard: editor.getOption(EditorOption.find).globalFindClipboard,
    shouldFocus: 1 /* FocusFindInput */,
    shouldAnimate: true,
    updateSearchScope: false,
    loop: editor.getOption(EditorOption.find).loop
  });
});
const findArgDescription = {
  description: "Open a new In-Editor Find Widget.",
  args: [{
    name: "Open a new In-Editor Find Widget args",
    schema: {
      properties: {
        searchString: { type: "string" },
        replaceString: { type: "string" },
        isRegex: { type: "boolean" },
        matchWholeWord: { type: "boolean" },
        isCaseSensitive: { type: "boolean" },
        preserveCase: { type: "boolean" },
        findInSelection: { type: "boolean" }
      }
    }
  }]
};
class StartFindWithArgsAction extends EditorAction {
  constructor() {
    super({
      id: FIND_IDS.StartFindWithArgs,
      label: nls.localize2("startFindWithArgsAction", "Find with Arguments"),
      precondition: void 0,
      kbOpts: {
        kbExpr: null,
        primary: 0,
        weight: KeybindingWeight.EditorContrib
      },
      metadata: findArgDescription
    });
  }
  async run(accessor, editor, args) {
    const controller = CommonFindController.get(editor);
    if (controller) {
      const newState = args ? {
        searchString: args.searchString,
        replaceString: args.replaceString,
        isReplaceRevealed: args.replaceString !== void 0,
        isRegex: args.isRegex,
        // isRegexOverride: args.regexOverride,
        wholeWord: args.matchWholeWord,
        // wholeWordOverride: args.wholeWordOverride,
        matchCase: args.isCaseSensitive,
        // matchCaseOverride: args.matchCaseOverride,
        preserveCase: args.preserveCase
        // preserveCaseOverride: args.preserveCaseOverride,
      } : {};
      await controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: controller.getState().searchString.length === 0 && editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
        seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
        seedSearchStringFromGlobalClipboard: true,
        shouldFocus: 1 /* FocusFindInput */,
        shouldAnimate: true,
        updateSearchScope: args?.findInSelection || false,
        loop: editor.getOption(EditorOption.find).loop
      }, newState);
      controller.setGlobalBufferTerm(controller.getState().searchString);
    }
  }
}
class StartFindWithSelectionAction extends EditorAction {
  constructor() {
    super({
      id: FIND_IDS.StartFindWithSelection,
      label: nls.localize2("startFindWithSelectionAction", "Find with Selection"),
      precondition: void 0,
      kbOpts: {
        kbExpr: null,
        primary: 0,
        mac: {
          primary: KeyMod.CtrlCmd | KeyCode.KeyE
        },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(accessor, editor) {
    const controller = CommonFindController.get(editor);
    if (controller) {
      await controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "multiple",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: 0 /* NoFocusChange */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: editor.getOption(EditorOption.find).loop
      });
      controller.setGlobalBufferTerm(controller.getState().searchString);
    }
  }
}
class MatchFindAction extends EditorAction {
  async run(accessor, editor) {
    const controller = CommonFindController.get(editor);
    if (controller && !this._run(controller)) {
      await controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: controller.getState().searchString.length === 0 && editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" ? "single" : "none",
        seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
        seedSearchStringFromGlobalClipboard: true,
        shouldFocus: 0 /* NoFocusChange */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: editor.getOption(EditorOption.find).loop
      });
      this._run(controller);
    }
  }
}
class NextMatchFindAction extends MatchFindAction {
  constructor() {
    super({
      id: FIND_IDS.NextMatchFindAction,
      label: nls.localize2("findNextMatchAction", "Find Next"),
      precondition: void 0,
      kbOpts: [{
        kbExpr: EditorContextKeys.focus,
        primary: KeyCode.F3,
        mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyG, secondary: [KeyCode.F3] },
        weight: KeybindingWeight.EditorContrib
      }, {
        kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_FIND_INPUT_FOCUSED),
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }]
    });
  }
  _run(controller) {
    const result = controller.moveToNextMatch();
    if (result) {
      controller.editor.pushUndoStop();
      return true;
    }
    return false;
  }
}
class PreviousMatchFindAction extends MatchFindAction {
  constructor() {
    super({
      id: FIND_IDS.PreviousMatchFindAction,
      label: nls.localize2("findPreviousMatchAction", "Find Previous"),
      precondition: void 0,
      kbOpts: [
        {
          kbExpr: EditorContextKeys.focus,
          primary: KeyMod.Shift | KeyCode.F3,
          mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG, secondary: [KeyMod.Shift | KeyCode.F3] },
          weight: KeybindingWeight.EditorContrib
        },
        {
          kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_FIND_INPUT_FOCUSED),
          primary: KeyMod.Shift | KeyCode.Enter,
          weight: KeybindingWeight.EditorContrib
        }
      ]
    });
  }
  _run(controller) {
    return controller.moveToPrevMatch();
  }
}
class MoveToMatchFindAction extends EditorAction {
  constructor() {
    super({
      id: FIND_IDS.GoToMatchFindAction,
      label: nls.localize2("findMatchAction.goToMatch", "Go to Match..."),
      precondition: CONTEXT_FIND_WIDGET_VISIBLE
    });
    this._highlightDecorations = [];
  }
  run(accessor, editor, args) {
    const controller = CommonFindController.get(editor);
    if (!controller) {
      return;
    }
    const matchesCount = controller.getState().matchesCount;
    if (matchesCount < 1) {
      const notificationService = accessor.get(INotificationService);
      notificationService.notify({
        severity: Severity.Warning,
        message: nls.localize("findMatchAction.noResults", "No matches. Try searching for something else.")
      });
      return;
    }
    const quickInputService = accessor.get(IQuickInputService);
    const disposables = new DisposableStore();
    const inputBox = disposables.add(quickInputService.createInputBox());
    inputBox.placeholder = nls.localize("findMatchAction.inputPlaceHolder", "Type a number to go to a specific match (between 1 and {0})", matchesCount);
    const toFindMatchIndex = (value) => {
      const index = parseInt(value);
      if (isNaN(index)) {
        return void 0;
      }
      const matchCount = controller.getState().matchesCount;
      if (index > 0 && index <= matchCount) {
        return index - 1;
      } else if (index < 0 && index >= -matchCount) {
        return matchCount + index;
      }
      return void 0;
    };
    const updatePickerAndEditor = (value) => {
      const index = toFindMatchIndex(value);
      if (typeof index === "number") {
        inputBox.validationMessage = void 0;
        controller.goToMatch(index);
        const currentMatch = controller.getState().currentMatch;
        if (currentMatch) {
          this.addDecorations(editor, currentMatch);
        }
      } else {
        inputBox.validationMessage = nls.localize("findMatchAction.inputValidationMessage", "Please type a number between 1 and {0}", controller.getState().matchesCount);
        this.clearDecorations(editor);
      }
    };
    disposables.add(inputBox.onDidChangeValue((value) => {
      updatePickerAndEditor(value);
    }));
    disposables.add(inputBox.onDidAccept(() => {
      const index = toFindMatchIndex(inputBox.value);
      if (typeof index === "number") {
        controller.goToMatch(index);
        inputBox.hide();
      } else {
        inputBox.validationMessage = nls.localize("findMatchAction.inputValidationMessage", "Please type a number between 1 and {0}", controller.getState().matchesCount);
      }
    }));
    disposables.add(inputBox.onDidHide(() => {
      this.clearDecorations(editor);
      disposables.dispose();
    }));
    inputBox.show();
  }
  clearDecorations(editor) {
    editor.changeDecorations((changeAccessor) => {
      this._highlightDecorations = changeAccessor.deltaDecorations(this._highlightDecorations, []);
    });
  }
  addDecorations(editor, range) {
    editor.changeDecorations((changeAccessor) => {
      this._highlightDecorations = changeAccessor.deltaDecorations(this._highlightDecorations, [
        {
          range,
          options: {
            description: "find-match-quick-access-range-highlight",
            className: "rangeHighlight",
            isWholeLine: true
          }
        },
        {
          range,
          options: {
            description: "find-match-quick-access-range-highlight-overview",
            overviewRuler: {
              color: themeColorFromId(overviewRulerRangeHighlight),
              position: OverviewRulerLane.Full
            }
          }
        }
      ]);
    });
  }
}
class SelectionMatchFindAction extends EditorAction {
  async run(accessor, editor) {
    const controller = CommonFindController.get(editor);
    if (!controller) {
      return;
    }
    const selectionSearchString = getSelectionSearchString(editor, "single", false);
    if (selectionSearchString) {
      controller.setSearchString(selectionSearchString);
    }
    if (!this._run(controller)) {
      await controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: "none",
        seedSearchStringFromNonEmptySelection: false,
        seedSearchStringFromGlobalClipboard: false,
        shouldFocus: 0 /* NoFocusChange */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: editor.getOption(EditorOption.find).loop
      });
      this._run(controller);
    }
  }
}
class NextSelectionMatchFindAction extends SelectionMatchFindAction {
  constructor() {
    super({
      id: FIND_IDS.NextSelectionMatchFindAction,
      label: nls.localize2("nextSelectionMatchFindAction", "Find Next Selection"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyCode.F3,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  _run(controller) {
    return controller.moveToNextMatch();
  }
}
class PreviousSelectionMatchFindAction extends SelectionMatchFindAction {
  constructor() {
    super({
      id: FIND_IDS.PreviousSelectionMatchFindAction,
      label: nls.localize2("previousSelectionMatchFindAction", "Find Previous Selection"),
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.F3,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  _run(controller) {
    return controller.moveToPrevMatch();
  }
}
const StartFindReplaceAction = registerMultiEditorAction(new MultiEditorAction({
  id: FIND_IDS.StartFindReplaceAction,
  label: nls.localize2("startReplace", "Replace"),
  precondition: ContextKeyExpr.or(EditorContextKeys.focus, ContextKeyExpr.has("editorIsOpen")),
  kbOpts: {
    kbExpr: null,
    primary: KeyMod.CtrlCmd | KeyCode.KeyH,
    mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyF },
    weight: KeybindingWeight.EditorContrib
  },
  menuOpts: {
    menuId: MenuId.MenubarEditMenu,
    group: "3_find",
    title: nls.localize({ key: "miReplace", comment: ["&& denotes a mnemonic"] }, "&&Replace"),
    order: 2
  }
}));
StartFindReplaceAction.addImplementation(0, (accessor, editor, args) => {
  if (!editor.hasModel() || editor.getOption(EditorOption.readOnly)) {
    return false;
  }
  const controller = CommonFindController.get(editor);
  if (!controller) {
    return false;
  }
  const currentSelection = editor.getSelection();
  const findInputFocused = controller.isFindInputFocused();
  const seedSearchStringFromSelection = !currentSelection.isEmpty() && currentSelection.startLineNumber === currentSelection.endLineNumber && editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never" && !findInputFocused;
  const shouldFocus = findInputFocused || seedSearchStringFromSelection ? 2 /* FocusReplaceInput */ : 1 /* FocusFindInput */;
  return controller.start({
    forceRevealReplace: true,
    seedSearchStringFromSelection: seedSearchStringFromSelection ? "single" : "none",
    seedSearchStringFromNonEmptySelection: editor.getOption(EditorOption.find).seedSearchStringFromSelection === "selection",
    seedSearchStringFromGlobalClipboard: editor.getOption(EditorOption.find).seedSearchStringFromSelection !== "never",
    shouldFocus,
    shouldAnimate: true,
    updateSearchScope: false,
    loop: editor.getOption(EditorOption.find).loop
  });
});
registerEditorContribution(CommonFindController.ID, FindController, EditorContributionInstantiation.Eager);
registerEditorAction(StartFindWithArgsAction);
registerEditorAction(StartFindWithSelectionAction);
registerEditorAction(NextMatchFindAction);
registerEditorAction(PreviousMatchFindAction);
registerEditorAction(MoveToMatchFindAction);
registerEditorAction(NextSelectionMatchFindAction);
registerEditorAction(PreviousSelectionMatchFindAction);
const FindCommand = EditorCommand.bindToContribution(CommonFindController.get);
registerEditorCommand(new FindCommand({
  id: FIND_IDS.CloseFindWidgetCommand,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.closeFindWidget(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, ContextKeyExpr.not("isComposing")),
    primary: KeyCode.Escape,
    secondary: [KeyMod.Shift | KeyCode.Escape]
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ToggleCaseSensitiveCommand,
  precondition: void 0,
  handler: (x) => x.toggleCaseSensitive(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: ToggleCaseSensitiveKeybinding.primary,
    mac: ToggleCaseSensitiveKeybinding.mac,
    win: ToggleCaseSensitiveKeybinding.win,
    linux: ToggleCaseSensitiveKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ToggleWholeWordCommand,
  precondition: void 0,
  handler: (x) => x.toggleWholeWords(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: ToggleWholeWordKeybinding.primary,
    mac: ToggleWholeWordKeybinding.mac,
    win: ToggleWholeWordKeybinding.win,
    linux: ToggleWholeWordKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ToggleRegexCommand,
  precondition: void 0,
  handler: (x) => x.toggleRegex(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: ToggleRegexKeybinding.primary,
    mac: ToggleRegexKeybinding.mac,
    win: ToggleRegexKeybinding.win,
    linux: ToggleRegexKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ToggleSearchScopeCommand,
  precondition: void 0,
  handler: (x) => x.toggleSearchScope(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: ToggleSearchScopeKeybinding.primary,
    mac: ToggleSearchScopeKeybinding.mac,
    win: ToggleSearchScopeKeybinding.win,
    linux: ToggleSearchScopeKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.TogglePreserveCaseCommand,
  precondition: void 0,
  handler: (x) => x.togglePreserveCase(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: TogglePreserveCaseKeybinding.primary,
    mac: TogglePreserveCaseKeybinding.mac,
    win: TogglePreserveCaseKeybinding.win,
    linux: TogglePreserveCaseKeybinding.linux
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ReplaceOneAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.replace(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Digit1
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ReplaceOneAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.replace(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_REPLACE_INPUT_FOCUSED),
    primary: KeyCode.Enter
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ReplaceAllAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.replaceAll(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.ReplaceAllAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.replaceAll(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_REPLACE_INPUT_FOCUSED),
    primary: void 0,
    mac: {
      primary: KeyMod.CtrlCmd | KeyCode.Enter
    }
  }
}));
registerEditorCommand(new FindCommand({
  id: FIND_IDS.SelectAllMatchesAction,
  precondition: CONTEXT_FIND_WIDGET_VISIBLE,
  handler: (x) => x.selectAllMatches(),
  kbOpts: {
    weight: KeybindingWeight.EditorContrib + 5,
    kbExpr: EditorContextKeys.focus,
    primary: KeyMod.Alt | KeyCode.Enter
  }
}));
export {
  CommonFindController,
  FindController,
  FindStartFocusAction,
  MatchFindAction,
  MoveToMatchFindAction,
  NextMatchFindAction,
  NextSelectionMatchFindAction,
  PreviousMatchFindAction,
  PreviousSelectionMatchFindAction,
  SelectionMatchFindAction,
  StartFindAction,
  StartFindReplaceAction,
  StartFindWithArgsAction,
  StartFindWithSelectionAction,
  getSelectionSearchString
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9maW5kL2Jyb3dzZXIvZmluZENvbnRyb2xsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIEVkaXRvckNvbW1hbmQsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIE11bHRpRWRpdG9yQWN0aW9uLCByZWdpc3RlckVkaXRvckFjdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb21tYW5kLCByZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbiwgcmVnaXN0ZXJNdWx0aUVkaXRvckFjdGlvbiwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgb3ZlcnZpZXdSdWxlclJhbmdlSGlnaGxpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvZWRpdG9yQ29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBPdmVydmlld1J1bGVyTGFuZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBDT05URVhUX0ZJTkRfSU5QVVRfRk9DVVNFRCwgQ09OVEVYVF9GSU5EX1dJREdFVF9WSVNJQkxFLCBDT05URVhUX1JFUExBQ0VfSU5QVVRfRk9DVVNFRCwgRmluZE1vZGVsQm91bmRUb0VkaXRvck1vZGVsLCBGSU5EX0lEUywgVG9nZ2xlQ2FzZVNlbnNpdGl2ZUtleWJpbmRpbmcsIFRvZ2dsZVByZXNlcnZlQ2FzZUtleWJpbmRpbmcsIFRvZ2dsZVJlZ2V4S2V5YmluZGluZywgVG9nZ2xlU2VhcmNoU2NvcGVLZXliaW5kaW5nLCBUb2dnbGVXaG9sZVdvcmRLZXliaW5kaW5nIH0gZnJvbSAnLi9maW5kTW9kZWwuanMnO1xuaW1wb3J0IHsgRmluZE9wdGlvbnNXaWRnZXQgfSBmcm9tICcuL2ZpbmRPcHRpb25zV2lkZ2V0LmpzJztcbmltcG9ydCB7IEZpbmRSZXBsYWNlU3RhdGUsIEZpbmRSZXBsYWNlU3RhdGVDaGFuZ2VkRXZlbnQsIElOZXdGaW5kUmVwbGFjZVN0YXRlIH0gZnJvbSAnLi9maW5kU3RhdGUuanMnO1xuaW1wb3J0IHsgRmluZFdpZGdldCwgSUZpbmRDb250cm9sbGVyIH0gZnJvbSAnLi9maW5kV2lkZ2V0LmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlLCB0aGVtZUNvbG9yRnJvbUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgRmluZFdpZGdldFNlYXJjaEhpc3RvcnkgfSBmcm9tICcuL2ZpbmRXaWRnZXRTZWFyY2hIaXN0b3J5LmpzJztcbmltcG9ydCB7IFJlcGxhY2VXaWRnZXRIaXN0b3J5IH0gZnJvbSAnLi9yZXBsYWNlV2lkZ2V0SGlzdG9yeS5qcyc7XG5cbmNvbnN0IFNFQVJDSF9TVFJJTkdfTUFYX0xFTkdUSCA9IDUyNDI4ODtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlbGVjdGlvblNlYXJjaFN0cmluZyhlZGl0b3I6IElDb2RlRWRpdG9yLCBzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogJ3NpbmdsZScgfCAnbXVsdGlwbGUnID0gJ3NpbmdsZScsIHNlZWRTZWFyY2hTdHJpbmdGcm9tTm9uRW1wdHlTZWxlY3Rpb246IGJvb2xlYW4gPSBmYWxzZSk6IHN0cmluZyB8IG51bGwge1xuXHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBzZWxlY3Rpb24gPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdC8vIGlmIHNlbGVjdGlvbiBzcGFucyBtdWx0aXBsZSBsaW5lcywgZGVmYXVsdCBzZWFyY2ggc3RyaW5nIHRvIGVtcHR5XG5cblx0aWYgKChzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9PT0gJ3NpbmdsZScgJiYgc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciA9PT0gc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIpXG5cdFx0fHwgc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24gPT09ICdtdWx0aXBsZScpIHtcblx0XHRpZiAoc2VsZWN0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0Y29uc3Qgd29yZEF0UG9zaXRpb24gPSBlZGl0b3IuZ2V0Q29uZmlndXJlZFdvcmRBdFBvc2l0aW9uKHNlbGVjdGlvbi5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0aWYgKHdvcmRBdFBvc2l0aW9uICYmIChmYWxzZSA9PT0gc2VlZFNlYXJjaFN0cmluZ0Zyb21Ob25FbXB0eVNlbGVjdGlvbikpIHtcblx0XHRcdFx0cmV0dXJuIHdvcmRBdFBvc2l0aW9uLndvcmQ7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChlZGl0b3IuZ2V0TW9kZWwoKS5nZXRWYWx1ZUxlbmd0aEluUmFuZ2Uoc2VsZWN0aW9uKSA8IFNFQVJDSF9TVFJJTkdfTUFYX0xFTkdUSCkge1xuXHRcdFx0XHRyZXR1cm4gZWRpdG9yLmdldE1vZGVsKCkuZ2V0VmFsdWVJblJhbmdlKHNlbGVjdGlvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEZpbmRTdGFydEZvY3VzQWN0aW9uIHtcblx0Tm9Gb2N1c0NoYW5nZSxcblx0Rm9jdXNGaW5kSW5wdXQsXG5cdEZvY3VzUmVwbGFjZUlucHV0XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbmRTdGFydE9wdGlvbnMge1xuXHRmb3JjZVJldmVhbFJlcGxhY2U6IGJvb2xlYW47XG5cdHNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uOiAnbm9uZScgfCAnc2luZ2xlJyB8ICdtdWx0aXBsZSc7XG5cdHNlZWRTZWFyY2hTdHJpbmdGcm9tTm9uRW1wdHlTZWxlY3Rpb246IGJvb2xlYW47XG5cdHNlZWRTZWFyY2hTdHJpbmdGcm9tR2xvYmFsQ2xpcGJvYXJkOiBib29sZWFuO1xuXHRzaG91bGRGb2N1czogRmluZFN0YXJ0Rm9jdXNBY3Rpb247XG5cdHNob3VsZEFuaW1hdGU6IGJvb2xlYW47XG5cdHVwZGF0ZVNlYXJjaFNjb3BlOiBib29sZWFuO1xuXHRsb29wOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaW5kU3RhcnRBcmd1bWVudHMge1xuXHRzZWFyY2hTdHJpbmc/OiBzdHJpbmc7XG5cdHJlcGxhY2VTdHJpbmc/OiBzdHJpbmc7XG5cdGlzUmVnZXg/OiBib29sZWFuO1xuXHRtYXRjaFdob2xlV29yZD86IGJvb2xlYW47XG5cdGlzQ2FzZVNlbnNpdGl2ZT86IGJvb2xlYW47XG5cdHByZXNlcnZlQ2FzZT86IGJvb2xlYW47XG5cdGZpbmRJblNlbGVjdGlvbj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBDb21tb25GaW5kQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5jb250cmliLmZpbmRDb250cm9sbGVyJztcblxuXHRwcm90ZWN0ZWQgX2VkaXRvcjogSUNvZGVFZGl0b3I7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2ZpbmRXaWRnZXRWaXNpYmxlOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJvdGVjdGVkIF9zdGF0ZTogRmluZFJlcGxhY2VTdGF0ZTtcblx0cHJvdGVjdGVkIF91cGRhdGVIaXN0b3J5RGVsYXllcjogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSBfbW9kZWw6IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbCB8IG51bGw7XG5cdHByb3RlY3RlZCByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2U7XG5cdHByb3RlY3RlZCByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9ob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2U7XG5cblx0Z2V0IGVkaXRvcigpIHtcblx0XHRyZXR1cm4gdGhpcy5fZWRpdG9yO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IENvbW1vbkZpbmRDb250cm9sbGVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248Q29tbW9uRmluZENvbnRyb2xsZXI+KENvbW1vbkZpbmRDb250cm9sbGVyLklEKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNsaXBib2FyZFNlcnZpY2UgY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2VkaXRvciA9IGVkaXRvcjtcblx0XHR0aGlzLl9maW5kV2lkZ2V0VmlzaWJsZSA9IENPTlRFWFRfRklORF9XSURHRVRfVklTSUJMRS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlID0gY29udGV4dEtleVNlcnZpY2U7XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2UgPSBzdG9yYWdlU2VydmljZTtcblx0XHR0aGlzLl9jbGlwYm9hcmRTZXJ2aWNlID0gY2xpcGJvYXJkU2VydmljZTtcblx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlID0gbm90aWZpY2F0aW9uU2VydmljZTtcblx0XHR0aGlzLl9ob3ZlclNlcnZpY2UgPSBob3ZlclNlcnZpY2U7XG5cblx0XHR0aGlzLl91cGRhdGVIaXN0b3J5RGVsYXllciA9IG5ldyBEZWxheWVyPHZvaWQ+KDUwMCk7XG5cdFx0dGhpcy5fc3RhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRmluZFJlcGxhY2VTdGF0ZSgpKTtcblx0XHR0aGlzLmxvYWRRdWVyeVN0YXRlKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fc3RhdGUub25GaW5kUmVwbGFjZVN0YXRlQ2hhbmdlKChlKSA9PiB0aGlzLl9vblN0YXRlQ2hhbmdlZChlKSkpO1xuXG5cdFx0dGhpcy5fbW9kZWwgPSBudWxsO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2hvdWxkUmVzdGFydEZpbmQgPSAodGhpcy5fZWRpdG9yLmdldE1vZGVsKCkgJiYgdGhpcy5fc3RhdGUuaXNSZXZlYWxlZCk7XG5cblx0XHRcdHRoaXMuZGlzcG9zZU1vZGVsKCk7XG5cblx0XHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7XG5cdFx0XHRcdHNlYXJjaFNjb3BlOiBudWxsLFxuXHRcdFx0XHRtYXRjaENhc2U6IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oJ2VkaXRvci5tYXRjaENhc2UnLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBmYWxzZSksXG5cdFx0XHRcdHdob2xlV29yZDogdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbignZWRpdG9yLndob2xlV29yZCcsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIGZhbHNlKSxcblx0XHRcdFx0aXNSZWdleDogdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbignZWRpdG9yLmlzUmVnZXgnLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBmYWxzZSksXG5cdFx0XHRcdHByZXNlcnZlQ2FzZTogdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbignZWRpdG9yLnByZXNlcnZlQ2FzZScsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIGZhbHNlKVxuXHRcdFx0fSwgZmFsc2UpO1xuXG5cdFx0XHRpZiAoc2hvdWxkUmVzdGFydEZpbmQpIHtcblx0XHRcdFx0dGhpcy5fc3RhcnQoe1xuXHRcdFx0XHRcdGZvcmNlUmV2ZWFsUmVwbGFjZTogZmFsc2UsXG5cdFx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb246ICdub25lJyxcblx0XHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBmYWxzZSxcblx0XHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbUdsb2JhbENsaXBib2FyZDogZmFsc2UsXG5cdFx0XHRcdFx0c2hvdWxkRm9jdXM6IEZpbmRTdGFydEZvY3VzQWN0aW9uLk5vRm9jdXNDaGFuZ2UsXG5cdFx0XHRcdFx0c2hvdWxkQW5pbWF0ZTogZmFsc2UsXG5cdFx0XHRcdFx0dXBkYXRlU2VhcmNoU2NvcGU6IGZhbHNlLFxuXHRcdFx0XHRcdGxvb3A6IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLmxvb3Bcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NlTW9kZWwoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIGRpc3Bvc2VNb2RlbCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fbW9kZWwpIHtcblx0XHRcdHRoaXMuX21vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX21vZGVsID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vblN0YXRlQ2hhbmdlZChlOiBGaW5kUmVwbGFjZVN0YXRlQ2hhbmdlZEV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5zYXZlUXVlcnlTdGF0ZShlKTtcblxuXHRcdGlmIChlLmlzUmV2ZWFsZWQpIHtcblx0XHRcdGlmICh0aGlzLl9zdGF0ZS5pc1JldmVhbGVkKSB7XG5cdFx0XHRcdHRoaXMuX2ZpbmRXaWRnZXRWaXNpYmxlLnNldCh0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2ZpbmRXaWRnZXRWaXNpYmxlLnJlc2V0KCk7XG5cdFx0XHRcdHRoaXMuZGlzcG9zZU1vZGVsKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChlLnNlYXJjaFN0cmluZykge1xuXHRcdFx0dGhpcy5zZXRHbG9iYWxCdWZmZXJUZXJtKHRoaXMuX3N0YXRlLnNlYXJjaFN0cmluZyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzYXZlUXVlcnlTdGF0ZShlOiBGaW5kUmVwbGFjZVN0YXRlQ2hhbmdlZEV2ZW50KSB7XG5cdFx0aWYgKGUuaXNSZWdleCkge1xuXHRcdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2VkaXRvci5pc1JlZ2V4JywgdGhpcy5fc3RhdGUuYWN0dWFsSXNSZWdleCwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cdFx0aWYgKGUud2hvbGVXb3JkKSB7XG5cdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZSgnZWRpdG9yLndob2xlV29yZCcsIHRoaXMuX3N0YXRlLmFjdHVhbFdob2xlV29yZCwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cdFx0aWYgKGUubWF0Y2hDYXNlKSB7XG5cdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZSgnZWRpdG9yLm1hdGNoQ2FzZScsIHRoaXMuX3N0YXRlLmFjdHVhbE1hdGNoQ2FzZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cdFx0aWYgKGUucHJlc2VydmVDYXNlKSB7XG5cdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZSgnZWRpdG9yLnByZXNlcnZlQ2FzZScsIHRoaXMuX3N0YXRlLmFjdHVhbFByZXNlcnZlQ2FzZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGxvYWRRdWVyeVN0YXRlKCkge1xuXHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7XG5cdFx0XHRtYXRjaENhc2U6IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oJ2VkaXRvci5tYXRjaENhc2UnLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCB0aGlzLl9zdGF0ZS5tYXRjaENhc2UpLFxuXHRcdFx0d2hvbGVXb3JkOiB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKCdlZGl0b3Iud2hvbGVXb3JkJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgdGhpcy5fc3RhdGUud2hvbGVXb3JkKSxcblx0XHRcdGlzUmVnZXg6IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oJ2VkaXRvci5pc1JlZ2V4JywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgdGhpcy5fc3RhdGUuaXNSZWdleCksXG5cdFx0XHRwcmVzZXJ2ZUNhc2U6IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oJ2VkaXRvci5wcmVzZXJ2ZUNhc2UnLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCB0aGlzLl9zdGF0ZS5wcmVzZXJ2ZUNhc2UpXG5cdFx0fSwgZmFsc2UpO1xuXHR9XG5cblx0cHVibGljIGlzRmluZElucHV0Rm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFDT05URVhUX0ZJTkRfSU5QVVRfRk9DVVNFRC5nZXRWYWx1ZSh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U3RhdGUoKTogRmluZFJlcGxhY2VTdGF0ZSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXRlO1xuXHR9XG5cblx0cHVibGljIGNsb3NlRmluZFdpZGdldCgpOiB2b2lkIHtcblx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2Uoe1xuXHRcdFx0aXNSZXZlYWxlZDogZmFsc2UsXG5cdFx0XHRzZWFyY2hTY29wZTogbnVsbFxuXHRcdH0sIGZhbHNlKTtcblx0XHR0aGlzLl9lZGl0b3IuZm9jdXMoKTtcblx0fVxuXG5cdHB1YmxpYyB0b2dnbGVDYXNlU2Vuc2l0aXZlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7IG1hdGNoQ2FzZTogIXRoaXMuX3N0YXRlLm1hdGNoQ2FzZSB9LCBmYWxzZSk7XG5cdFx0aWYgKCF0aGlzLl9zdGF0ZS5pc1JldmVhbGVkKSB7XG5cdFx0XHR0aGlzLmhpZ2hsaWdodEZpbmRPcHRpb25zKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHRvZ2dsZVdob2xlV29yZHMoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgd2hvbGVXb3JkOiAhdGhpcy5fc3RhdGUud2hvbGVXb3JkIH0sIGZhbHNlKTtcblx0XHRpZiAoIXRoaXMuX3N0YXRlLmlzUmV2ZWFsZWQpIHtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0RmluZE9wdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgdG9nZ2xlUmVnZXgoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgaXNSZWdleDogIXRoaXMuX3N0YXRlLmlzUmVnZXggfSwgZmFsc2UpO1xuXHRcdGlmICghdGhpcy5fc3RhdGUuaXNSZXZlYWxlZCkge1xuXHRcdFx0dGhpcy5oaWdobGlnaHRGaW5kT3B0aW9ucygpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyB0b2dnbGVQcmVzZXJ2ZUNhc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgcHJlc2VydmVDYXNlOiAhdGhpcy5fc3RhdGUucHJlc2VydmVDYXNlIH0sIGZhbHNlKTtcblx0XHRpZiAoIXRoaXMuX3N0YXRlLmlzUmV2ZWFsZWQpIHtcblx0XHRcdHRoaXMuaGlnaGxpZ2h0RmluZE9wdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgdG9nZ2xlU2VhcmNoU2NvcGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlLnNlYXJjaFNjb3BlKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTY29wZTogbnVsbCB9LCB0cnVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdGxldCBzZWxlY3Rpb25zID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRcdFx0c2VsZWN0aW9ucyA9IHNlbGVjdGlvbnMubWFwKHNlbGVjdGlvbiA9PiB7XG5cdFx0XHRcdFx0aWYgKHNlbGVjdGlvbi5lbmRDb2x1bW4gPT09IDEgJiYgc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgPiBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0XHRzZWxlY3Rpb24gPSBzZWxlY3Rpb24uc2V0RW5kUG9zaXRpb24oXG5cdFx0XHRcdFx0XHRcdHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyIC0gMSxcblx0XHRcdFx0XHRcdFx0dGhpcy5fZWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVNYXhDb2x1bW4oc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgLSAxKVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFzZWxlY3Rpb24uaXNFbXB0eSgpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc2VsZWN0aW9uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fSkuZmlsdGVyKChlbGVtZW50KTogZWxlbWVudCBpcyBTZWxlY3Rpb24gPT4gISFlbGVtZW50KTtcblxuXHRcdFx0XHRpZiAoc2VsZWN0aW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTY29wZTogc2VsZWN0aW9ucyB9LCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBzZXRTZWFyY2hTdHJpbmcoc2VhcmNoU3RyaW5nOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdGUuaXNSZWdleCkge1xuXHRcdFx0c2VhcmNoU3RyaW5nID0gc3RyaW5ncy5lc2NhcGVSZWdFeHBDaGFyYWN0ZXJzKHNlYXJjaFN0cmluZyk7XG5cdFx0fVxuXHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogc2VhcmNoU3RyaW5nIH0sIGZhbHNlKTtcblx0fVxuXG5cdHB1YmxpYyBoaWdobGlnaHRGaW5kT3B0aW9ucyhpZ25vcmVXaGVuVmlzaWJsZTogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0Ly8gb3ZlcndyaXR0ZW4gaW4gc3ViY2xhc3Ncblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfc3RhcnQob3B0czogSUZpbmRTdGFydE9wdGlvbnMsIG5ld1N0YXRlPzogSU5ld0ZpbmRSZXBsYWNlU3RhdGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmRpc3Bvc2VNb2RlbCgpO1xuXG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0Ly8gY2Fubm90IGRvIGFueXRoaW5nIHdpdGggYW4gZWRpdG9yIHRoYXQgZG9lc24ndCBoYXZlIGEgbW9kZWwuLi5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0ZUNoYW5nZXM6IElOZXdGaW5kUmVwbGFjZVN0YXRlID0ge1xuXHRcdFx0Li4ubmV3U3RhdGUsXG5cdFx0XHRpc1JldmVhbGVkOiB0cnVlXG5cdFx0fTtcblxuXHRcdGlmIChvcHRzLnNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uID09PSAnc2luZ2xlJykge1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uU2VhcmNoU3RyaW5nID0gZ2V0U2VsZWN0aW9uU2VhcmNoU3RyaW5nKHRoaXMuX2VkaXRvciwgb3B0cy5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiwgb3B0cy5zZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uKTtcblx0XHRcdGlmIChzZWxlY3Rpb25TZWFyY2hTdHJpbmcpIHtcblx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlLmlzUmVnZXgpIHtcblx0XHRcdFx0XHRzdGF0ZUNoYW5nZXMuc2VhcmNoU3RyaW5nID0gc3RyaW5ncy5lc2NhcGVSZWdFeHBDaGFyYWN0ZXJzKHNlbGVjdGlvblNlYXJjaFN0cmluZyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c3RhdGVDaGFuZ2VzLnNlYXJjaFN0cmluZyA9IHNlbGVjdGlvblNlYXJjaFN0cmluZztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAob3B0cy5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9PT0gJ211bHRpcGxlJyAmJiAhb3B0cy51cGRhdGVTZWFyY2hTY29wZSkge1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uU2VhcmNoU3RyaW5nID0gZ2V0U2VsZWN0aW9uU2VhcmNoU3RyaW5nKHRoaXMuX2VkaXRvciwgb3B0cy5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbik7XG5cdFx0XHRpZiAoc2VsZWN0aW9uU2VhcmNoU3RyaW5nKSB7XG5cdFx0XHRcdHN0YXRlQ2hhbmdlcy5zZWFyY2hTdHJpbmcgPSBzZWxlY3Rpb25TZWFyY2hTdHJpbmc7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFzdGF0ZUNoYW5nZXMuc2VhcmNoU3RyaW5nICYmIG9wdHMuc2VlZFNlYXJjaFN0cmluZ0Zyb21HbG9iYWxDbGlwYm9hcmQpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvblNlYXJjaFN0cmluZyA9IGF3YWl0IHRoaXMuZ2V0R2xvYmFsQnVmZmVyVGVybSgpO1xuXG5cdFx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdC8vIHRoZSBlZGl0b3IgaGFzIGxvc3QgaXRzIG1vZGVsIGluIHRoZSBtZWFudGltZVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzZWxlY3Rpb25TZWFyY2hTdHJpbmcpIHtcblx0XHRcdFx0c3RhdGVDaGFuZ2VzLnNlYXJjaFN0cmluZyA9IHNlbGVjdGlvblNlYXJjaFN0cmluZztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBPdmVyd3JpdGUgaXNSZXBsYWNlUmV2ZWFsZWRcblx0XHRpZiAob3B0cy5mb3JjZVJldmVhbFJlcGxhY2UgfHwgc3RhdGVDaGFuZ2VzLmlzUmVwbGFjZVJldmVhbGVkKSB7XG5cdFx0XHRzdGF0ZUNoYW5nZXMuaXNSZXBsYWNlUmV2ZWFsZWQgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAoIXRoaXMuX2ZpbmRXaWRnZXRWaXNpYmxlLmdldCgpKSB7XG5cdFx0XHRzdGF0ZUNoYW5nZXMuaXNSZXBsYWNlUmV2ZWFsZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAob3B0cy51cGRhdGVTZWFyY2hTY29wZSkge1xuXHRcdFx0Y29uc3QgY3VycmVudFNlbGVjdGlvbnMgPSB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdFx0aWYgKGN1cnJlbnRTZWxlY3Rpb25zLnNvbWUoc2VsZWN0aW9uID0+ICFzZWxlY3Rpb24uaXNFbXB0eSgpKSkge1xuXHRcdFx0XHRzdGF0ZUNoYW5nZXMuc2VhcmNoU2NvcGUgPSBjdXJyZW50U2VsZWN0aW9ucztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRzdGF0ZUNoYW5nZXMubG9vcCA9IG9wdHMubG9vcDtcblxuXHRcdHRoaXMuX3N0YXRlLmNoYW5nZShzdGF0ZUNoYW5nZXMsIGZhbHNlKTtcblxuXHRcdGlmICghdGhpcy5fbW9kZWwpIHtcblx0XHRcdHRoaXMuX21vZGVsID0gbmV3IEZpbmRNb2RlbEJvdW5kVG9FZGl0b3JNb2RlbCh0aGlzLl9lZGl0b3IsIHRoaXMuX3N0YXRlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc3RhcnQob3B0czogSUZpbmRTdGFydE9wdGlvbnMsIG5ld1N0YXRlPzogSU5ld0ZpbmRSZXBsYWNlU3RhdGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhcnQob3B0cywgbmV3U3RhdGUpO1xuXHR9XG5cblx0cHVibGljIG1vdmVUb05leHRNYXRjaCgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fbW9kZWwpIHtcblx0XHRcdHRoaXMuX21vZGVsLm1vdmVUb05leHRNYXRjaCgpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyBtb3ZlVG9QcmV2TWF0Y2goKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX21vZGVsKSB7XG5cdFx0XHR0aGlzLl9tb2RlbC5tb3ZlVG9QcmV2TWF0Y2goKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZ29Ub01hdGNoKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fbW9kZWwpIHtcblx0XHRcdHRoaXMuX21vZGVsLm1vdmVUb01hdGNoKGluZGV4KTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgcmVwbGFjZSgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fbW9kZWwpIHtcblx0XHRcdHRoaXMuX21vZGVsLnJlcGxhY2UoKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgcmVwbGFjZUFsbCgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fbW9kZWwpIHtcblx0XHRcdGlmICh0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKT8uaXNUb29MYXJnZUZvckhlYXBPcGVyYXRpb24oKSkge1xuXHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obmxzLmxvY2FsaXplKCd0b28ubGFyZ2UuZm9yLnJlcGxhY2VhbGwnLCBcIlRoZSBmaWxlIGlzIHRvbyBsYXJnZSB0byBwZXJmb3JtIGEgcmVwbGFjZSBhbGwgb3BlcmF0aW9uLlwiKSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX21vZGVsLnJlcGxhY2VBbGwoKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgc2VsZWN0QWxsTWF0Y2hlcygpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fbW9kZWwpIHtcblx0XHRcdHRoaXMuX21vZGVsLnNlbGVjdEFsbE1hdGNoZXMoKTtcblx0XHRcdHRoaXMuX2VkaXRvci5mb2N1cygpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRHbG9iYWxCdWZmZXJUZXJtKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLmdsb2JhbEZpbmRDbGlwYm9hcmRcblx0XHRcdCYmIHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpXG5cdFx0XHQmJiAhdGhpcy5fZWRpdG9yLmdldE1vZGVsKCkuaXNUb29MYXJnZUZvclN5bmNpbmcoKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2NsaXBib2FyZFNlcnZpY2UucmVhZEZpbmRUZXh0KCk7XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHB1YmxpYyBzZXRHbG9iYWxCdWZmZXJUZXJtKHRleHQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5nbG9iYWxGaW5kQ2xpcGJvYXJkXG5cdFx0XHQmJiB0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKVxuXHRcdFx0JiYgIXRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLmlzVG9vTGFyZ2VGb3JTeW5jaW5nKClcblx0XHQpIHtcblx0XHRcdC8vIGludGVudGlvbmFsbHkgbm90IGF3YWl0ZWRcblx0XHRcdHRoaXMuX2NsaXBib2FyZFNlcnZpY2Uud3JpdGVGaW5kVGV4dCh0ZXh0KTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbmRDb250cm9sbGVyIGV4dGVuZHMgQ29tbW9uRmluZENvbnRyb2xsZXIgaW1wbGVtZW50cyBJRmluZENvbnRyb2xsZXIge1xuXG5cdHByaXZhdGUgX3dpZGdldDogRmluZFdpZGdldCB8IG51bGw7XG5cdHByaXZhdGUgX2ZpbmRPcHRpb25zV2lkZ2V0OiBGaW5kT3B0aW9uc1dpZGdldCB8IG51bGw7XG5cdHByaXZhdGUgX2ZpbmRXaWRnZXRTZWFyY2hIaXN0b3J5OiBGaW5kV2lkZ2V0U2VhcmNoSGlzdG9yeTtcblx0cHJpdmF0ZSBfcmVwbGFjZVdpZGdldEhpc3Rvcnk6IFJlcGxhY2VXaWRnZXRIaXN0b3J5O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNsaXBib2FyZFNlcnZpY2UgY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihlZGl0b3IsIF9jb250ZXh0S2V5U2VydmljZSwgX3N0b3JhZ2VTZXJ2aWNlLCBjbGlwYm9hcmRTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHRcdHRoaXMuX3dpZGdldCA9IG51bGw7XG5cdFx0dGhpcy5fZmluZE9wdGlvbnNXaWRnZXQgPSBudWxsO1xuXHRcdHRoaXMuX2ZpbmRXaWRnZXRTZWFyY2hIaXN0b3J5ID0gRmluZFdpZGdldFNlYXJjaEhpc3RvcnkuZ2V0T3JDcmVhdGUoX3N0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZXBsYWNlV2lkZ2V0SGlzdG9yeSA9IFJlcGxhY2VXaWRnZXRIaXN0b3J5LmdldE9yQ3JlYXRlKF9zdG9yYWdlU2VydmljZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgX3N0YXJ0KG9wdHM6IElGaW5kU3RhcnRPcHRpb25zLCBuZXdTdGF0ZT86IElOZXdGaW5kUmVwbGFjZVN0YXRlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl93aWRnZXQpIHtcblx0XHRcdHRoaXMuX2NyZWF0ZUZpbmRXaWRnZXQoKTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0bGV0IHVwZGF0ZVNlYXJjaFNjb3BlID0gZmFsc2U7XG5cblx0XHRzd2l0Y2ggKHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLmF1dG9GaW5kSW5TZWxlY3Rpb24pIHtcblx0XHRcdGNhc2UgJ2Fsd2F5cyc6XG5cdFx0XHRcdHVwZGF0ZVNlYXJjaFNjb3BlID0gdHJ1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICduZXZlcic6XG5cdFx0XHRcdHVwZGF0ZVNlYXJjaFNjb3BlID0gZmFsc2U7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbXVsdGlsaW5lJzoge1xuXHRcdFx0XHRjb25zdCBpc1NlbGVjdGlvbk11bHRpcGxlTGluZSA9ICEhc2VsZWN0aW9uICYmIHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIgIT09IHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0XHR1cGRhdGVTZWFyY2hTY29wZSA9IGlzU2VsZWN0aW9uTXVsdGlwbGVMaW5lO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdG9wdHMudXBkYXRlU2VhcmNoU2NvcGUgPSBvcHRzLnVwZGF0ZVNlYXJjaFNjb3BlIHx8IHVwZGF0ZVNlYXJjaFNjb3BlO1xuXG5cdFx0YXdhaXQgc3VwZXIuX3N0YXJ0KG9wdHMsIG5ld1N0YXRlKTtcblxuXHRcdGlmICh0aGlzLl93aWRnZXQpIHtcblx0XHRcdGlmIChvcHRzLnNob3VsZEZvY3VzID09PSBGaW5kU3RhcnRGb2N1c0FjdGlvbi5Gb2N1c1JlcGxhY2VJbnB1dCkge1xuXHRcdFx0XHR0aGlzLl93aWRnZXQuZm9jdXNSZXBsYWNlSW5wdXQoKTtcblx0XHRcdH0gZWxzZSBpZiAob3B0cy5zaG91bGRGb2N1cyA9PT0gRmluZFN0YXJ0Rm9jdXNBY3Rpb24uRm9jdXNGaW5kSW5wdXQpIHtcblx0XHRcdFx0dGhpcy5fd2lkZ2V0LmZvY3VzRmluZElucHV0KCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGhpZ2hsaWdodEZpbmRPcHRpb25zKGlnbm9yZVdoZW5WaXNpYmxlOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3dpZGdldCkge1xuXHRcdFx0dGhpcy5fY3JlYXRlRmluZFdpZGdldCgpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fc3RhdGUuaXNSZXZlYWxlZCAmJiAhaWdub3JlV2hlblZpc2libGUpIHtcblx0XHRcdHRoaXMuX3dpZGdldCEuaGlnaGxpZ2h0RmluZE9wdGlvbnMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZmluZE9wdGlvbnNXaWRnZXQhLmhpZ2hsaWdodEZpbmRPcHRpb25zKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlRmluZFdpZGdldCgpIHtcblx0XHR0aGlzLl93aWRnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRmluZFdpZGdldCh0aGlzLl9lZGl0b3IsIHRoaXMsIHRoaXMuX3N0YXRlLCB0aGlzLl9jb250ZXh0Vmlld1NlcnZpY2UsIHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSwgdGhpcy5fdGhlbWVTZXJ2aWNlLCB0aGlzLl9zdG9yYWdlU2VydmljZSwgdGhpcy5fbm90aWZpY2F0aW9uU2VydmljZSwgdGhpcy5faG92ZXJTZXJ2aWNlLCB0aGlzLl9maW5kV2lkZ2V0U2VhcmNoSGlzdG9yeSwgdGhpcy5fcmVwbGFjZVdpZGdldEhpc3RvcnkpKTtcblx0XHR0aGlzLl9maW5kT3B0aW9uc1dpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBGaW5kT3B0aW9uc1dpZGdldCh0aGlzLl9lZGl0b3IsIHRoaXMuX3N0YXRlLCB0aGlzLl9rZXliaW5kaW5nU2VydmljZSkpO1xuXHR9XG5cblx0c2F2ZVZpZXdTdGF0ZSgpOiBhbnkge1xuXHRcdHJldHVybiB0aGlzLl93aWRnZXQ/LmdldFZpZXdTdGF0ZSgpO1xuXHR9XG5cblx0cmVzdG9yZVZpZXdTdGF0ZShzdGF0ZTogYW55KTogdm9pZCB7XG5cdFx0dGhpcy5fd2lkZ2V0Py5zZXRWaWV3U3RhdGUoc3RhdGUpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBTdGFydEZpbmRBY3Rpb24gPSByZWdpc3Rlck11bHRpRWRpdG9yQWN0aW9uKG5ldyBNdWx0aUVkaXRvckFjdGlvbih7XG5cdGlkOiBGSU5EX0lEUy5TdGFydEZpbmRBY3Rpb24sXG5cdGxhYmVsOiBubHMubG9jYWxpemUyKCdzdGFydEZpbmRBY3Rpb24nLCBcIkZpbmRcIiksXG5cdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoRWRpdG9yQ29udGV4dEtleXMuZm9jdXMsIENvbnRleHRLZXlFeHByLmhhcygnZWRpdG9ySXNPcGVuJykpLFxuXHRrYk9wdHM6IHtcblx0XHRrYkV4cHI6IG51bGwsXG5cdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUYsXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0fSxcblx0bWVudU9wdHM6IHtcblx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyRWRpdE1lbnUsXG5cdFx0Z3JvdXA6ICczX2ZpbmQnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUZpbmQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZGaW5kXCIpLFxuXHRcdG9yZGVyOiAxXG5cdH1cbn0pKTtcblxuU3RhcnRGaW5kQWN0aW9uLmFkZEltcGxlbWVudGF0aW9uKDAsIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogYW55KTogYm9vbGVhbiB8IFByb21pc2U8dm9pZD4gPT4ge1xuXHRjb25zdCBjb250cm9sbGVyID0gQ29tbW9uRmluZENvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdGlmICghY29udHJvbGxlcikge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRyZXR1cm4gY29udHJvbGxlci5zdGFydCh7XG5cdFx0Zm9yY2VSZXZlYWxSZXBsYWNlOiBmYWxzZSxcblx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZmluZCkuc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24gIT09ICduZXZlcicgPyAnc2luZ2xlJyA6ICdub25lJyxcblx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9PT0gJ3NlbGVjdGlvbicsXG5cdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21HbG9iYWxDbGlwYm9hcmQ6IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLmdsb2JhbEZpbmRDbGlwYm9hcmQsXG5cdFx0c2hvdWxkRm9jdXM6IEZpbmRTdGFydEZvY3VzQWN0aW9uLkZvY3VzRmluZElucHV0LFxuXHRcdHNob3VsZEFuaW1hdGU6IHRydWUsXG5cdFx0dXBkYXRlU2VhcmNoU2NvcGU6IGZhbHNlLFxuXHRcdGxvb3A6IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLmxvb3Bcblx0fSk7XG59KTtcblxuY29uc3QgZmluZEFyZ0Rlc2NyaXB0aW9uID0ge1xuXHRkZXNjcmlwdGlvbjogJ09wZW4gYSBuZXcgSW4tRWRpdG9yIEZpbmQgV2lkZ2V0LicsXG5cdGFyZ3M6IFt7XG5cdFx0bmFtZTogJ09wZW4gYSBuZXcgSW4tRWRpdG9yIEZpbmQgV2lkZ2V0IGFyZ3MnLFxuXHRcdHNjaGVtYToge1xuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRzZWFyY2hTdHJpbmc6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdFx0cmVwbGFjZVN0cmluZzogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHRcdFx0XHRpc1JlZ2V4OiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHRcdFx0XHRtYXRjaFdob2xlV29yZDogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdFx0aXNDYXNlU2Vuc2l0aXZlOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHRcdFx0XHRwcmVzZXJ2ZUNhc2U6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdFx0XHRcdGZpbmRJblNlbGVjdGlvbjogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdH1cblx0XHR9XG5cdH1dXG59IGFzIGNvbnN0O1xuXG5leHBvcnQgY2xhc3MgU3RhcnRGaW5kV2l0aEFyZ3NBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBGSU5EX0lEUy5TdGFydEZpbmRXaXRoQXJncyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdzdGFydEZpbmRXaXRoQXJnc0FjdGlvbicsIFwiRmluZCB3aXRoIEFyZ3VtZW50c1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogbnVsbCxcblx0XHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZXRhZGF0YTogZmluZEFyZ0Rlc2NyaXB0aW9uXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgbnVsbCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJncz86IElGaW5kU3RhcnRBcmd1bWVudHMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gQ29tbW9uRmluZENvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKGNvbnRyb2xsZXIpIHtcblx0XHRcdGNvbnN0IG5ld1N0YXRlOiBJTmV3RmluZFJlcGxhY2VTdGF0ZSA9IGFyZ3MgPyB7XG5cdFx0XHRcdHNlYXJjaFN0cmluZzogYXJncy5zZWFyY2hTdHJpbmcsXG5cdFx0XHRcdHJlcGxhY2VTdHJpbmc6IGFyZ3MucmVwbGFjZVN0cmluZyxcblx0XHRcdFx0aXNSZXBsYWNlUmV2ZWFsZWQ6IGFyZ3MucmVwbGFjZVN0cmluZyAhPT0gdW5kZWZpbmVkLFxuXHRcdFx0XHRpc1JlZ2V4OiBhcmdzLmlzUmVnZXgsXG5cdFx0XHRcdC8vIGlzUmVnZXhPdmVycmlkZTogYXJncy5yZWdleE92ZXJyaWRlLFxuXHRcdFx0XHR3aG9sZVdvcmQ6IGFyZ3MubWF0Y2hXaG9sZVdvcmQsXG5cdFx0XHRcdC8vIHdob2xlV29yZE92ZXJyaWRlOiBhcmdzLndob2xlV29yZE92ZXJyaWRlLFxuXHRcdFx0XHRtYXRjaENhc2U6IGFyZ3MuaXNDYXNlU2Vuc2l0aXZlLFxuXHRcdFx0XHQvLyBtYXRjaENhc2VPdmVycmlkZTogYXJncy5tYXRjaENhc2VPdmVycmlkZSxcblx0XHRcdFx0cHJlc2VydmVDYXNlOiBhcmdzLnByZXNlcnZlQ2FzZSxcblx0XHRcdFx0Ly8gcHJlc2VydmVDYXNlT3ZlcnJpZGU6IGFyZ3MucHJlc2VydmVDYXNlT3ZlcnJpZGUsXG5cdFx0XHR9IDoge307XG5cblx0XHRcdGF3YWl0IGNvbnRyb2xsZXIuc3RhcnQoe1xuXHRcdFx0XHRmb3JjZVJldmVhbFJlcGxhY2U6IGZhbHNlLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogKGNvbnRyb2xsZXIuZ2V0U3RhdGUoKS5zZWFyY2hTdHJpbmcubGVuZ3RoID09PSAwKSAmJiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiAhPT0gJ25ldmVyJyA/ICdzaW5nbGUnIDogJ25vbmUnLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9PT0gJ3NlbGVjdGlvbicsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tR2xvYmFsQ2xpcGJvYXJkOiB0cnVlLFxuXHRcdFx0XHRzaG91bGRGb2N1czogRmluZFN0YXJ0Rm9jdXNBY3Rpb24uRm9jdXNGaW5kSW5wdXQsXG5cdFx0XHRcdHNob3VsZEFuaW1hdGU6IHRydWUsXG5cdFx0XHRcdHVwZGF0ZVNlYXJjaFNjb3BlOiBhcmdzPy5maW5kSW5TZWxlY3Rpb24gfHwgZmFsc2UsXG5cdFx0XHRcdGxvb3A6IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLmxvb3Bcblx0XHRcdH0sIG5ld1N0YXRlKTtcblxuXHRcdFx0Y29udHJvbGxlci5zZXRHbG9iYWxCdWZmZXJUZXJtKGNvbnRyb2xsZXIuZ2V0U3RhdGUoKS5zZWFyY2hTdHJpbmcpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3RhcnRGaW5kV2l0aFNlbGVjdGlvbkFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEZJTkRfSURTLlN0YXJ0RmluZFdpdGhTZWxlY3Rpb24sXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignc3RhcnRGaW5kV2l0aFNlbGVjdGlvbkFjdGlvbicsIFwiRmluZCB3aXRoIFNlbGVjdGlvblwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogbnVsbCxcblx0XHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdFx0bWFjOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUUsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgbnVsbCwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb21tb25GaW5kQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoY29udHJvbGxlcikge1xuXHRcdFx0YXdhaXQgY29udHJvbGxlci5zdGFydCh7XG5cdFx0XHRcdGZvcmNlUmV2ZWFsUmVwbGFjZTogZmFsc2UsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uOiAnbXVsdGlwbGUnLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBmYWxzZSxcblx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21HbG9iYWxDbGlwYm9hcmQ6IGZhbHNlLFxuXHRcdFx0XHRzaG91bGRGb2N1czogRmluZFN0YXJ0Rm9jdXNBY3Rpb24uTm9Gb2N1c0NoYW5nZSxcblx0XHRcdFx0c2hvdWxkQW5pbWF0ZTogdHJ1ZSxcblx0XHRcdFx0dXBkYXRlU2VhcmNoU2NvcGU6IGZhbHNlLFxuXHRcdFx0XHRsb29wOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5sb29wXG5cdFx0XHR9KTtcblxuXHRcdFx0Y29udHJvbGxlci5zZXRHbG9iYWxCdWZmZXJUZXJtKGNvbnRyb2xsZXIuZ2V0U3RhdGUoKS5zZWFyY2hTdHJpbmcpO1xuXHRcdH1cblx0fVxufVxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE1hdGNoRmluZEFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IgfCBudWxsLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IENvbW1vbkZpbmRDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmIChjb250cm9sbGVyICYmICF0aGlzLl9ydW4oY29udHJvbGxlcikpIHtcblx0XHRcdGF3YWl0IGNvbnRyb2xsZXIuc3RhcnQoe1xuXHRcdFx0XHRmb3JjZVJldmVhbFJlcGxhY2U6IGZhbHNlLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogKGNvbnRyb2xsZXIuZ2V0U3RhdGUoKS5zZWFyY2hTdHJpbmcubGVuZ3RoID09PSAwKSAmJiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiAhPT0gJ25ldmVyJyA/ICdzaW5nbGUnIDogJ25vbmUnLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9PT0gJ3NlbGVjdGlvbicsXG5cdFx0XHRcdHNlZWRTZWFyY2hTdHJpbmdGcm9tR2xvYmFsQ2xpcGJvYXJkOiB0cnVlLFxuXHRcdFx0XHRzaG91bGRGb2N1czogRmluZFN0YXJ0Rm9jdXNBY3Rpb24uTm9Gb2N1c0NoYW5nZSxcblx0XHRcdFx0c2hvdWxkQW5pbWF0ZTogdHJ1ZSxcblx0XHRcdFx0dXBkYXRlU2VhcmNoU2NvcGU6IGZhbHNlLFxuXHRcdFx0XHRsb29wOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5sb29wXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3J1bihjb250cm9sbGVyKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX3J1bihjb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlcik6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBOZXh0TWF0Y2hGaW5kQWN0aW9uIGV4dGVuZHMgTWF0Y2hGaW5kQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRklORF9JRFMuTmV4dE1hdGNoRmluZEFjdGlvbixcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdmaW5kTmV4dE1hdGNoQWN0aW9uJywgXCJGaW5kIE5leHRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czogW3tcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5GMyxcblx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlHLCBzZWNvbmRhcnk6IFtLZXlDb2RlLkYzXSB9LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSwge1xuXHRcdFx0XHRrYkV4cHI6IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy5mb2N1cywgQ09OVEVYVF9GSU5EX0lOUFVUX0ZPQ1VTRUQpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBfcnVuKGNvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gY29udHJvbGxlci5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRjb250cm9sbGVyLmVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBQcmV2aW91c01hdGNoRmluZEFjdGlvbiBleHRlbmRzIE1hdGNoRmluZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEZJTkRfSURTLlByZXZpb3VzTWF0Y2hGaW5kQWN0aW9uLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2ZpbmRQcmV2aW91c01hdGNoQWN0aW9uJywgXCJGaW5kIFByZXZpb3VzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRrYk9wdHM6IFt7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRjMsXG5cdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5Rywgc2Vjb25kYXJ5OiBbS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5GM10gfSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sIHtcblx0XHRcdFx0a2JFeHByOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yQ29udGV4dEtleXMuZm9jdXMsIENPTlRFWFRfRklORF9JTlBVVF9GT0NVU0VEKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBfcnVuKGNvbnRyb2xsZXI6IENvbW1vbkZpbmRDb250cm9sbGVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGNvbnRyb2xsZXIubW92ZVRvUHJldk1hdGNoKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVUb01hdGNoRmluZEFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0cHJpdmF0ZSBfaGlnaGxpZ2h0RGVjb3JhdGlvbnM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBGSU5EX0lEUy5Hb1RvTWF0Y2hGaW5kQWN0aW9uLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2ZpbmRNYXRjaEFjdGlvbi5nb1RvTWF0Y2gnLCBcIkdvIHRvIE1hdGNoLi4uXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZJTkRfV0lER0VUX1ZJU0lCTEVcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gQ29tbW9uRmluZENvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWF0Y2hlc0NvdW50ID0gY29udHJvbGxlci5nZXRTdGF0ZSgpLm1hdGNoZXNDb3VudDtcblx0XHRpZiAobWF0Y2hlc0NvdW50IDwgMSkge1xuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2ZpbmRNYXRjaEFjdGlvbi5ub1Jlc3VsdHMnLCBcIk5vIG1hdGNoZXMuIFRyeSBzZWFyY2hpbmcgZm9yIHNvbWV0aGluZyBlbHNlLlwiKVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBpbnB1dEJveCA9IGRpc3Bvc2FibGVzLmFkZChxdWlja0lucHV0U2VydmljZS5jcmVhdGVJbnB1dEJveCgpKTtcblx0XHRpbnB1dEJveC5wbGFjZWhvbGRlciA9IG5scy5sb2NhbGl6ZSgnZmluZE1hdGNoQWN0aW9uLmlucHV0UGxhY2VIb2xkZXInLCBcIlR5cGUgYSBudW1iZXIgdG8gZ28gdG8gYSBzcGVjaWZpYyBtYXRjaCAoYmV0d2VlbiAxIGFuZCB7MH0pXCIsIG1hdGNoZXNDb3VudCk7XG5cblx0XHRjb25zdCB0b0ZpbmRNYXRjaEluZGV4ID0gKHZhbHVlOiBzdHJpbmcpOiBudW1iZXIgfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0Y29uc3QgaW5kZXggPSBwYXJzZUludCh2YWx1ZSk7XG5cdFx0XHRpZiAoaXNOYU4oaW5kZXgpKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1hdGNoQ291bnQgPSBjb250cm9sbGVyLmdldFN0YXRlKCkubWF0Y2hlc0NvdW50O1xuXHRcdFx0aWYgKGluZGV4ID4gMCAmJiBpbmRleCA8PSBtYXRjaENvdW50KSB7XG5cdFx0XHRcdHJldHVybiBpbmRleCAtIDE7IC8vIHplcm8gYmFzZWRcblx0XHRcdH0gZWxzZSBpZiAoaW5kZXggPCAwICYmIGluZGV4ID49IC1tYXRjaENvdW50KSB7XG5cdFx0XHRcdHJldHVybiBtYXRjaENvdW50ICsgaW5kZXg7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHVwZGF0ZVBpY2tlckFuZEVkaXRvciA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRvRmluZE1hdGNoSW5kZXgodmFsdWUpO1xuXHRcdFx0aWYgKHR5cGVvZiBpbmRleCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0Ly8gdmFsaWRcblx0XHRcdFx0aW5wdXRCb3gudmFsaWRhdGlvbk1lc3NhZ2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnRyb2xsZXIuZ29Ub01hdGNoKGluZGV4KTtcblx0XHRcdFx0Y29uc3QgY3VycmVudE1hdGNoID0gY29udHJvbGxlci5nZXRTdGF0ZSgpLmN1cnJlbnRNYXRjaDtcblx0XHRcdFx0aWYgKGN1cnJlbnRNYXRjaCkge1xuXHRcdFx0XHRcdHRoaXMuYWRkRGVjb3JhdGlvbnMoZWRpdG9yLCBjdXJyZW50TWF0Y2gpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbnB1dEJveC52YWxpZGF0aW9uTWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnZmluZE1hdGNoQWN0aW9uLmlucHV0VmFsaWRhdGlvbk1lc3NhZ2UnLCBcIlBsZWFzZSB0eXBlIGEgbnVtYmVyIGJldHdlZW4gMSBhbmQgezB9XCIsIGNvbnRyb2xsZXIuZ2V0U3RhdGUoKS5tYXRjaGVzQ291bnQpO1xuXHRcdFx0XHR0aGlzLmNsZWFyRGVjb3JhdGlvbnMoZWRpdG9yKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGRpc3Bvc2FibGVzLmFkZChpbnB1dEJveC5vbkRpZENoYW5nZVZhbHVlKHZhbHVlID0+IHtcblx0XHRcdHVwZGF0ZVBpY2tlckFuZEVkaXRvcih2YWx1ZSk7XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGlucHV0Qm94Lm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdG9GaW5kTWF0Y2hJbmRleChpbnB1dEJveC52YWx1ZSk7XG5cdFx0XHRpZiAodHlwZW9mIGluZGV4ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRjb250cm9sbGVyLmdvVG9NYXRjaChpbmRleCk7XG5cdFx0XHRcdGlucHV0Qm94LmhpZGUoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlucHV0Qm94LnZhbGlkYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKCdmaW5kTWF0Y2hBY3Rpb24uaW5wdXRWYWxpZGF0aW9uTWVzc2FnZScsIFwiUGxlYXNlIHR5cGUgYSBudW1iZXIgYmV0d2VlbiAxIGFuZCB7MH1cIiwgY29udHJvbGxlci5nZXRTdGF0ZSgpLm1hdGNoZXNDb3VudCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGlucHV0Qm94Lm9uRGlkSGlkZSgoKSA9PiB7XG5cdFx0XHR0aGlzLmNsZWFyRGVjb3JhdGlvbnMoZWRpdG9yKTtcblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9KSk7XG5cblx0XHRpbnB1dEJveC5zaG93KCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRGVjb3JhdGlvbnMoZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGVkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucyhjaGFuZ2VBY2Nlc3NvciA9PiB7XG5cdFx0XHR0aGlzLl9oaWdobGlnaHREZWNvcmF0aW9ucyA9IGNoYW5nZUFjY2Vzc29yLmRlbHRhRGVjb3JhdGlvbnModGhpcy5faGlnaGxpZ2h0RGVjb3JhdGlvbnMsIFtdKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYWRkRGVjb3JhdGlvbnMoZWRpdG9yOiBJQ29kZUVkaXRvciwgcmFuZ2U6IElSYW5nZSk6IHZvaWQge1xuXHRcdGVkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucyhjaGFuZ2VBY2Nlc3NvciA9PiB7XG5cdFx0XHR0aGlzLl9oaWdobGlnaHREZWNvcmF0aW9ucyA9IGNoYW5nZUFjY2Vzc29yLmRlbHRhRGVjb3JhdGlvbnModGhpcy5faGlnaGxpZ2h0RGVjb3JhdGlvbnMsIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnZmluZC1tYXRjaC1xdWljay1hY2Nlc3MtcmFuZ2UtaGlnaGxpZ2h0Jyxcblx0XHRcdFx0XHRcdGNsYXNzTmFtZTogJ3JhbmdlSGlnaGxpZ2h0Jyxcblx0XHRcdFx0XHRcdGlzV2hvbGVMaW5lOiB0cnVlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdmaW5kLW1hdGNoLXF1aWNrLWFjY2Vzcy1yYW5nZS1oaWdobGlnaHQtb3ZlcnZpZXcnLFxuXHRcdFx0XHRcdFx0b3ZlcnZpZXdSdWxlcjoge1xuXHRcdFx0XHRcdFx0XHRjb2xvcjogdGhlbWVDb2xvckZyb21JZChvdmVydmlld1J1bGVyUmFuZ2VIaWdobGlnaHQpLFxuXHRcdFx0XHRcdFx0XHRwb3NpdGlvbjogT3ZlcnZpZXdSdWxlckxhbmUuRnVsbFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFNlbGVjdGlvbk1hdGNoRmluZEFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IgfCBudWxsLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IENvbW1vbkZpbmRDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvblNlYXJjaFN0cmluZyA9IGdldFNlbGVjdGlvblNlYXJjaFN0cmluZyhlZGl0b3IsICdzaW5nbGUnLCBmYWxzZSk7XG5cdFx0aWYgKHNlbGVjdGlvblNlYXJjaFN0cmluZykge1xuXHRcdFx0Y29udHJvbGxlci5zZXRTZWFyY2hTdHJpbmcoc2VsZWN0aW9uU2VhcmNoU3RyaW5nKTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9ydW4oY29udHJvbGxlcikpIHtcblx0XHRcdGF3YWl0IGNvbnRyb2xsZXIuc3RhcnQoe1xuXHRcdFx0XHRmb3JjZVJldmVhbFJlcGxhY2U6IGZhbHNlLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogJ25vbmUnLFxuXHRcdFx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBmYWxzZSxcblx0XHRcdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21HbG9iYWxDbGlwYm9hcmQ6IGZhbHNlLFxuXHRcdFx0XHRzaG91bGRGb2N1czogRmluZFN0YXJ0Rm9jdXNBY3Rpb24uTm9Gb2N1c0NoYW5nZSxcblx0XHRcdFx0c2hvdWxkQW5pbWF0ZTogdHJ1ZSxcblx0XHRcdFx0dXBkYXRlU2VhcmNoU2NvcGU6IGZhbHNlLFxuXHRcdFx0XHRsb29wOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5sb29wXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3J1bihjb250cm9sbGVyKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX3J1bihjb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlcik6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBOZXh0U2VsZWN0aW9uTWF0Y2hGaW5kQWN0aW9uIGV4dGVuZHMgU2VsZWN0aW9uTWF0Y2hGaW5kQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRklORF9JRFMuTmV4dFNlbGVjdGlvbk1hdGNoRmluZEFjdGlvbixcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCduZXh0U2VsZWN0aW9uTWF0Y2hGaW5kQWN0aW9uJywgXCJGaW5kIE5leHQgU2VsZWN0aW9uXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkYzLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9ydW4oY29udHJvbGxlcjogQ29tbW9uRmluZENvbnRyb2xsZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gY29udHJvbGxlci5tb3ZlVG9OZXh0TWF0Y2goKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUHJldmlvdXNTZWxlY3Rpb25NYXRjaEZpbmRBY3Rpb24gZXh0ZW5kcyBTZWxlY3Rpb25NYXRjaEZpbmRBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBGSU5EX0lEUy5QcmV2aW91c1NlbGVjdGlvbk1hdGNoRmluZEFjdGlvbixcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdwcmV2aW91c1NlbGVjdGlvbk1hdGNoRmluZEFjdGlvbicsIFwiRmluZCBQcmV2aW91cyBTZWxlY3Rpb25cIiksXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRjMsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3J1bihjb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBjb250cm9sbGVyLm1vdmVUb1ByZXZNYXRjaCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBTdGFydEZpbmRSZXBsYWNlQWN0aW9uID0gcmVnaXN0ZXJNdWx0aUVkaXRvckFjdGlvbihuZXcgTXVsdGlFZGl0b3JBY3Rpb24oe1xuXHRpZDogRklORF9JRFMuU3RhcnRGaW5kUmVwbGFjZUFjdGlvbixcblx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ3N0YXJ0UmVwbGFjZScsIFwiUmVwbGFjZVwiKSxcblx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihFZGl0b3JDb250ZXh0S2V5cy5mb2N1cywgQ29udGV4dEtleUV4cHIuaGFzKCdlZGl0b3JJc09wZW4nKSksXG5cdGtiT3B0czoge1xuXHRcdGtiRXhwcjogbnVsbCxcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SCxcblx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlGIH0sXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0fSxcblx0bWVudU9wdHM6IHtcblx0XHRtZW51SWQ6IE1lbnVJZC5NZW51YmFyRWRpdE1lbnUsXG5cdFx0Z3JvdXA6ICczX2ZpbmQnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVJlcGxhY2UnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZXBsYWNlXCIpLFxuXHRcdG9yZGVyOiAyXG5cdH1cbn0pKTtcblxuU3RhcnRGaW5kUmVwbGFjZUFjdGlvbi5hZGRJbXBsZW1lbnRhdGlvbigwLCAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IGJvb2xlYW4gfCBQcm9taXNlPHZvaWQ+ID0+IHtcblx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSB8fCBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5yZWFkT25seSkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Y29uc3QgY29udHJvbGxlciA9IENvbW1vbkZpbmRDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjb25zdCBjdXJyZW50U2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRjb25zdCBmaW5kSW5wdXRGb2N1c2VkID0gY29udHJvbGxlci5pc0ZpbmRJbnB1dEZvY3VzZWQoKTtcblx0Ly8gd2Ugb25seSBzZWVkIHNlYXJjaCBzdHJpbmcgZnJvbSBzZWxlY3Rpb24gd2hlbiB0aGUgY3VycmVudCBzZWxlY3Rpb24gaXMgc2luZ2xlIGxpbmUgYW5kIG5vdCBlbXB0eSxcblx0Ly8gKyB0aGUgZmluZCBpbnB1dCBpcyBub3QgZm9jdXNlZFxuXHRjb25zdCBzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9ICFjdXJyZW50U2VsZWN0aW9uLmlzRW1wdHkoKVxuXHRcdCYmIGN1cnJlbnRTZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyID09PSBjdXJyZW50U2VsZWN0aW9uLmVuZExpbmVOdW1iZXJcblx0XHQmJiAoZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZmluZCkuc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24gIT09ICduZXZlcicpXG5cdFx0JiYgIWZpbmRJbnB1dEZvY3VzZWQ7XG5cdC8qXG5cdCogaWYgdGhlIGV4aXN0aW5nIHNlYXJjaCBzdHJpbmcgaW4gZmluZCB3aWRnZXQgaXMgZW1wdHkgYW5kIHdlIGRvbid0IHNlZWQgc2VhcmNoIHN0cmluZyBmcm9tIHNlbGVjdGlvbiwgaXQgbWVhbnMgdGhlIEZpbmQgSW5wdXQgaXMgc3RpbGwgZW1wdHksIHNvIHdlIHNob3VsZCBmb2N1cyB0aGUgRmluZCBJbnB1dCBpbnN0ZWFkIG9mIFJlcGxhY2UgSW5wdXQuXG5cblx0KiBmaW5kSW5wdXRGb2N1c2VkIHRydWUgLT4gc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24gZmFsc2UsIEZvY3VzUmVwbGFjZUlucHV0XG5cdCogZmluZElucHV0Rm9jdXNlZCBmYWxzZSwgc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24gdHJ1ZSBGb2N1c1JlcGxhY2VJbnB1dFxuXHQqIGZpbmRJbnB1dEZvY3VzZWQgZmFsc2Ugc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24gZmFsc2UgRm9jdXNGaW5kSW5wdXRcblx0Ki9cblx0Y29uc3Qgc2hvdWxkRm9jdXMgPSAoZmluZElucHV0Rm9jdXNlZCB8fCBzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbikgP1xuXHRcdEZpbmRTdGFydEZvY3VzQWN0aW9uLkZvY3VzUmVwbGFjZUlucHV0IDogRmluZFN0YXJ0Rm9jdXNBY3Rpb24uRm9jdXNGaW5kSW5wdXQ7XG5cblx0cmV0dXJuIGNvbnRyb2xsZXIuc3RhcnQoe1xuXHRcdGZvcmNlUmV2ZWFsUmVwbGFjZTogdHJ1ZSxcblx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjogc2VlZFNlYXJjaFN0cmluZ0Zyb21TZWxlY3Rpb24gPyAnc2luZ2xlJyA6ICdub25lJyxcblx0XHRzZWVkU2VhcmNoU3RyaW5nRnJvbU5vbkVtcHR5U2VsZWN0aW9uOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9PT0gJ3NlbGVjdGlvbicsXG5cdFx0c2VlZFNlYXJjaFN0cmluZ0Zyb21HbG9iYWxDbGlwYm9hcmQ6IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLnNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uICE9PSAnbmV2ZXInLFxuXHRcdHNob3VsZEZvY3VzOiBzaG91bGRGb2N1cyxcblx0XHRzaG91bGRBbmltYXRlOiB0cnVlLFxuXHRcdHVwZGF0ZVNlYXJjaFNjb3BlOiBmYWxzZSxcblx0XHRsb29wOiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5sb29wXG5cdH0pO1xufSk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uKENvbW1vbkZpbmRDb250cm9sbGVyLklELCBGaW5kQ29udHJvbGxlciwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbi5FYWdlcik7IC8vIGVhZ2VyIGJlY2F1c2UgaXQgdXNlcyBgc2F2ZVZpZXdTdGF0ZWAvYHJlc3RvcmVWaWV3U3RhdGVgXG5cbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFN0YXJ0RmluZFdpdGhBcmdzQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFN0YXJ0RmluZFdpdGhTZWxlY3Rpb25BY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oTmV4dE1hdGNoRmluZEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihQcmV2aW91c01hdGNoRmluZEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihNb3ZlVG9NYXRjaEZpbmRBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oTmV4dFNlbGVjdGlvbk1hdGNoRmluZEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihQcmV2aW91c1NlbGVjdGlvbk1hdGNoRmluZEFjdGlvbik7XG5cbmNvbnN0IEZpbmRDb21tYW5kID0gRWRpdG9yQ29tbWFuZC5iaW5kVG9Db250cmlidXRpb248Q29tbW9uRmluZENvbnRyb2xsZXI+KENvbW1vbkZpbmRDb250cm9sbGVyLmdldCk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgRmluZENvbW1hbmQoe1xuXHRpZDogRklORF9JRFMuQ2xvc2VGaW5kV2lkZ2V0Q29tbWFuZCxcblx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZJTkRfV0lER0VUX1ZJU0lCTEUsXG5cdGhhbmRsZXI6IHggPT4geC5jbG9zZUZpbmRXaWRnZXQoKSxcblx0a2JPcHRzOiB7XG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgKyA1LFxuXHRcdGtiRXhwcjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLCBDb250ZXh0S2V5RXhwci5ub3QoJ2lzQ29tcG9zaW5nJykpLFxuXHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdHNlY29uZGFyeTogW0tleU1vZC5TaGlmdCB8IEtleUNvZGUuRXNjYXBlXVxuXHR9XG59KSk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgRmluZENvbW1hbmQoe1xuXHRpZDogRklORF9JRFMuVG9nZ2xlQ2FzZVNlbnNpdGl2ZUNvbW1hbmQsXG5cdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRoYW5kbGVyOiB4ID0+IHgudG9nZ2xlQ2FzZVNlbnNpdGl2ZSgpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDUsXG5cdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRwcmltYXJ5OiBUb2dnbGVDYXNlU2Vuc2l0aXZlS2V5YmluZGluZy5wcmltYXJ5LFxuXHRcdG1hYzogVG9nZ2xlQ2FzZVNlbnNpdGl2ZUtleWJpbmRpbmcubWFjLFxuXHRcdHdpbjogVG9nZ2xlQ2FzZVNlbnNpdGl2ZUtleWJpbmRpbmcud2luLFxuXHRcdGxpbnV4OiBUb2dnbGVDYXNlU2Vuc2l0aXZlS2V5YmluZGluZy5saW51eFxuXHR9XG59KSk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgRmluZENvbW1hbmQoe1xuXHRpZDogRklORF9JRFMuVG9nZ2xlV2hvbGVXb3JkQ29tbWFuZCxcblx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdGhhbmRsZXI6IHggPT4geC50b2dnbGVXaG9sZVdvcmRzKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliICsgNSxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdHByaW1hcnk6IFRvZ2dsZVdob2xlV29yZEtleWJpbmRpbmcucHJpbWFyeSxcblx0XHRtYWM6IFRvZ2dsZVdob2xlV29yZEtleWJpbmRpbmcubWFjLFxuXHRcdHdpbjogVG9nZ2xlV2hvbGVXb3JkS2V5YmluZGluZy53aW4sXG5cdFx0bGludXg6IFRvZ2dsZVdob2xlV29yZEtleWJpbmRpbmcubGludXhcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEZpbmRDb21tYW5kKHtcblx0aWQ6IEZJTkRfSURTLlRvZ2dsZVJlZ2V4Q29tbWFuZCxcblx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdGhhbmRsZXI6IHggPT4geC50b2dnbGVSZWdleCgpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDUsXG5cdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRwcmltYXJ5OiBUb2dnbGVSZWdleEtleWJpbmRpbmcucHJpbWFyeSxcblx0XHRtYWM6IFRvZ2dsZVJlZ2V4S2V5YmluZGluZy5tYWMsXG5cdFx0d2luOiBUb2dnbGVSZWdleEtleWJpbmRpbmcud2luLFxuXHRcdGxpbnV4OiBUb2dnbGVSZWdleEtleWJpbmRpbmcubGludXhcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEZpbmRDb21tYW5kKHtcblx0aWQ6IEZJTkRfSURTLlRvZ2dsZVNlYXJjaFNjb3BlQ29tbWFuZCxcblx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdGhhbmRsZXI6IHggPT4geC50b2dnbGVTZWFyY2hTY29wZSgpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDUsXG5cdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRwcmltYXJ5OiBUb2dnbGVTZWFyY2hTY29wZUtleWJpbmRpbmcucHJpbWFyeSxcblx0XHRtYWM6IFRvZ2dsZVNlYXJjaFNjb3BlS2V5YmluZGluZy5tYWMsXG5cdFx0d2luOiBUb2dnbGVTZWFyY2hTY29wZUtleWJpbmRpbmcud2luLFxuXHRcdGxpbnV4OiBUb2dnbGVTZWFyY2hTY29wZUtleWJpbmRpbmcubGludXhcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEZpbmRDb21tYW5kKHtcblx0aWQ6IEZJTkRfSURTLlRvZ2dsZVByZXNlcnZlQ2FzZUNvbW1hbmQsXG5cdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRoYW5kbGVyOiB4ID0+IHgudG9nZ2xlUHJlc2VydmVDYXNlKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliICsgNSxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdHByaW1hcnk6IFRvZ2dsZVByZXNlcnZlQ2FzZUtleWJpbmRpbmcucHJpbWFyeSxcblx0XHRtYWM6IFRvZ2dsZVByZXNlcnZlQ2FzZUtleWJpbmRpbmcubWFjLFxuXHRcdHdpbjogVG9nZ2xlUHJlc2VydmVDYXNlS2V5YmluZGluZy53aW4sXG5cdFx0bGludXg6IFRvZ2dsZVByZXNlcnZlQ2FzZUtleWJpbmRpbmcubGludXhcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEZpbmRDb21tYW5kKHtcblx0aWQ6IEZJTkRfSURTLlJlcGxhY2VPbmVBY3Rpb24sXG5cdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GSU5EX1dJREdFVF9WSVNJQkxFLFxuXHRoYW5kbGVyOiB4ID0+IHgucmVwbGFjZSgpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDUsXG5cdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRGlnaXQxXG5cdH1cbn0pKTtcblxucmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBGaW5kQ29tbWFuZCh7XG5cdGlkOiBGSU5EX0lEUy5SZXBsYWNlT25lQWN0aW9uLFxuXHRwcmVjb25kaXRpb246IENPTlRFWFRfRklORF9XSURHRVRfVklTSUJMRSxcblx0aGFuZGxlcjogeCA9PiB4LnJlcGxhY2UoKSxcblx0a2JPcHRzOiB7XG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgKyA1LFxuXHRcdGtiRXhwcjogQ29udGV4dEtleUV4cHIuYW5kKEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLCBDT05URVhUX1JFUExBQ0VfSU5QVVRfRk9DVVNFRCksXG5cdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlclxuXHR9XG59KSk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgRmluZENvbW1hbmQoe1xuXHRpZDogRklORF9JRFMuUmVwbGFjZUFsbEFjdGlvbixcblx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZJTkRfV0lER0VUX1ZJU0lCTEUsXG5cdGhhbmRsZXI6IHggPT4geC5yZXBsYWNlQWxsKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliICsgNSxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuRW50ZXJcblx0fVxufSkpO1xuXG5yZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEZpbmRDb21tYW5kKHtcblx0aWQ6IEZJTkRfSURTLlJlcGxhY2VBbGxBY3Rpb24sXG5cdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GSU5EX1dJREdFVF9WSVNJQkxFLFxuXHRoYW5kbGVyOiB4ID0+IHgucmVwbGFjZUFsbCgpLFxuXHRrYk9wdHM6IHtcblx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDUsXG5cdFx0a2JFeHByOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yQ29udGV4dEtleXMuZm9jdXMsIENPTlRFWFRfUkVQTEFDRV9JTlBVVF9GT0NVU0VEKSxcblx0XHRwcmltYXJ5OiB1bmRlZmluZWQsXG5cdFx0bWFjOiB7XG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0fVxuXHR9XG59KSk7XG5cbnJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgRmluZENvbW1hbmQoe1xuXHRpZDogRklORF9JRFMuU2VsZWN0QWxsTWF0Y2hlc0FjdGlvbixcblx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZJTkRfV0lER0VUX1ZJU0lCTEUsXG5cdGhhbmRsZXI6IHggPT4geC5zZWxlY3RBbGxNYXRjaGVzKCksXG5cdGtiT3B0czoge1xuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliICsgNSxcblx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkVudGVyXG5cdH1cbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsWUFBWSxhQUFhO0FBRXpCLFNBQVMsY0FBYyxlQUFlLGlDQUFpQyxtQkFBbUIsc0JBQXNCLHVCQUF1Qiw0QkFBNEIsaUNBQW1EO0FBQ3ROLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsbUNBQW1DO0FBRzVDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCLDZCQUE2QiwrQkFBK0IsNkJBQTZCLFVBQVUsK0JBQStCLDhCQUE4Qix1QkFBdUIsNkJBQTZCLGlDQUFpQztBQUMxUixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHdCQUE0RTtBQUNyRixTQUFTLGtCQUFtQztBQUM1QyxZQUFZLFNBQVM7QUFDckIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMseUJBQXlCO0FBQ2xD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
