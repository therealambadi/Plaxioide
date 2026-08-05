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
import { createCancelablePromise, Delayer, RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { illegalArgument, onUnexpectedError } from "../../../../base/common/errors.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
import * as types from "../../../../base/common/types.js";
import "./folding.css";
import { StableEditorScrollState } from "../../../browser/stableEditorScroll.js";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution, registerInstantiatedEditorAction } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { FoldingRangeKind } from "../../../common/languages.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { FoldingModel, getNextFoldLine, getParentFoldLine, getPreviousFoldLine, setCollapseStateAtLevel, setCollapseStateForMatchingLines, setCollapseStateForRest, setCollapseStateForType, setCollapseStateLevelsDown, setCollapseStateLevelsUp, setCollapseStateUp, toggleCollapseState } from "./foldingModel.js";
import { HiddenRangeModel } from "./hiddenRangeModel.js";
import { IndentRangeProvider } from "./indentRangeProvider.js";
import * as nls from "../../../../nls.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { FoldingDecorationProvider } from "./foldingDecorations.js";
import { FoldingRegions, FoldSource } from "./foldingRanges.js";
import { SyntaxRangeProvider } from "./syntaxRangeProvider.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ILanguageFeatureDebounceService } from "../../../common/services/languageFeatureDebounce.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { Emitter } from "../../../../base/common/event.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { URI } from "../../../../base/common/uri.js";
import { IModelService } from "../../../common/services/model.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
const CONTEXT_FOLDING_ENABLED = new RawContextKey("foldingEnabled", false);
let FoldingController = class extends Disposable {
  constructor(editor, contextKeyService, languageConfigurationService, notificationService, languageFeatureDebounceService, languageFeaturesService) {
    super();
    this.contextKeyService = contextKeyService;
    this.languageConfigurationService = languageConfigurationService;
    this.languageFeaturesService = languageFeaturesService;
    this.localToDispose = this._register(new DisposableStore());
    this.editor = editor;
    this._foldingLimitReporter = new RangesLimitReporter(editor);
    const options = this.editor.getOptions();
    this._isEnabled = options.get(EditorOption.folding);
    this._useFoldingProviders = options.get(EditorOption.foldingStrategy) !== "indentation";
    this._unfoldOnClickAfterEndOfLine = options.get(EditorOption.unfoldOnClickAfterEndOfLine);
    this._restoringViewState = false;
    this._currentModelHasFoldedImports = false;
    this._foldingImportsByDefault = options.get(EditorOption.foldingImportsByDefault);
    this.updateDebounceInfo = languageFeatureDebounceService.for(languageFeaturesService.foldingRangeProvider, "Folding", { min: 200 });
    this.foldingModel = null;
    this.hiddenRangeModel = null;
    this.rangeProvider = null;
    this.foldingRegionPromise = null;
    this.foldingModelPromise = null;
    this.updateScheduler = null;
    this.cursorChangedScheduler = null;
    this.mouseDownInfo = null;
    this.foldingDecorationProvider = new FoldingDecorationProvider(editor);
    this.foldingDecorationProvider.showFoldingControls = options.get(EditorOption.showFoldingControls);
    this.foldingDecorationProvider.showFoldingHighlights = options.get(EditorOption.foldingHighlight);
    this.foldingEnabled = CONTEXT_FOLDING_ENABLED.bindTo(this.contextKeyService);
    this.foldingEnabled.set(this._isEnabled);
    this._register(this.editor.onDidChangeModel(() => this.onModelChanged()));
    this._register(this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.folding)) {
        this._isEnabled = this.editor.getOptions().get(EditorOption.folding);
        this.foldingEnabled.set(this._isEnabled);
        this.onModelChanged();
      }
      if (e.hasChanged(EditorOption.foldingMaximumRegions)) {
        this.onModelChanged();
      }
      if (e.hasChanged(EditorOption.showFoldingControls) || e.hasChanged(EditorOption.foldingHighlight)) {
        const options2 = this.editor.getOptions();
        this.foldingDecorationProvider.showFoldingControls = options2.get(EditorOption.showFoldingControls);
        this.foldingDecorationProvider.showFoldingHighlights = options2.get(EditorOption.foldingHighlight);
        this.triggerFoldingModelChanged();
      }
      if (e.hasChanged(EditorOption.foldingStrategy)) {
        this._useFoldingProviders = this.editor.getOptions().get(EditorOption.foldingStrategy) !== "indentation";
        this.onFoldingStrategyChanged();
      }
      if (e.hasChanged(EditorOption.unfoldOnClickAfterEndOfLine)) {
        this._unfoldOnClickAfterEndOfLine = this.editor.getOptions().get(EditorOption.unfoldOnClickAfterEndOfLine);
      }
      if (e.hasChanged(EditorOption.foldingImportsByDefault)) {
        this._foldingImportsByDefault = this.editor.getOptions().get(EditorOption.foldingImportsByDefault);
      }
    }));
    this.onModelChanged();
  }
  static get(editor) {
    return editor.getContribution(FoldingController.ID);
  }
  static getFoldingRangeProviders(languageFeaturesService, model) {
    const foldingRangeProviders = languageFeaturesService.foldingRangeProvider.ordered(model);
    return FoldingController._foldingRangeSelector?.(foldingRangeProviders, model) ?? foldingRangeProviders;
  }
  static setFoldingRangeProviderSelector(foldingRangeSelector) {
    FoldingController._foldingRangeSelector = foldingRangeSelector;
    return { dispose: () => {
      FoldingController._foldingRangeSelector = void 0;
    } };
  }
  get limitReporter() {
    return this._foldingLimitReporter;
  }
  /**
   * Store view state.
   */
  saveViewState() {
    const model = this.editor.getModel();
    if (!model || !this._isEnabled || model.isTooLargeForTokenization()) {
      return {};
    }
    if (this.foldingModel) {
      const collapsedRegions = this.foldingModel.getMemento();
      const provider = this.rangeProvider ? this.rangeProvider.id : void 0;
      return { collapsedRegions, lineCount: model.getLineCount(), provider, foldedImports: this._currentModelHasFoldedImports };
    }
    return void 0;
  }
  /**
   * Restore view state.
   */
  restoreViewState(state) {
    const model = this.editor.getModel();
    if (!model || !this._isEnabled || model.isTooLargeForTokenization() || !this.hiddenRangeModel) {
      return;
    }
    if (!state) {
      return;
    }
    this._currentModelHasFoldedImports = !!state.foldedImports;
    if (state.collapsedRegions && state.collapsedRegions.length > 0 && this.foldingModel) {
      this._restoringViewState = true;
      try {
        this.foldingModel.applyMemento(state.collapsedRegions);
      } finally {
        this._restoringViewState = false;
      }
    }
  }
  onModelChanged() {
    this.localToDispose.clear();
    const model = this.editor.getModel();
    if (!this._isEnabled || !model || model.isTooLargeForTokenization()) {
      return;
    }
    this._currentModelHasFoldedImports = false;
    this.foldingModel = new FoldingModel(model, this.foldingDecorationProvider);
    this.localToDispose.add(this.foldingModel);
    this.hiddenRangeModel = new HiddenRangeModel(this.foldingModel);
    this.localToDispose.add(this.hiddenRangeModel);
    this.localToDispose.add(this.hiddenRangeModel.onDidChange((hr) => this.onHiddenRangesChanges(hr)));
    this.updateScheduler = new Delayer(this.updateDebounceInfo.get(model));
    this.cursorChangedScheduler = new RunOnceScheduler(() => this.revealCursor(), 200);
    this.localToDispose.add(this.cursorChangedScheduler);
    this.localToDispose.add(this.languageFeaturesService.foldingRangeProvider.onDidChange(() => this.onFoldingStrategyChanged()));
    this.localToDispose.add(this.editor.onDidChangeModelLanguageConfiguration(() => this.onFoldingStrategyChanged()));
    this.localToDispose.add(this.editor.onDidChangeModelContent((e) => this.onDidChangeModelContent(e)));
    this.localToDispose.add(this.editor.onDidChangeCursorPosition(() => this.onCursorPositionChanged()));
    this.localToDispose.add(this.editor.onMouseDown((e) => this.onEditorMouseDown(e)));
    this.localToDispose.add(this.editor.onMouseUp((e) => this.onEditorMouseUp(e)));
    this.localToDispose.add({
      dispose: () => {
        if (this.foldingRegionPromise) {
          this.foldingRegionPromise.cancel();
          this.foldingRegionPromise = null;
        }
        this.updateScheduler?.cancel();
        this.updateScheduler = null;
        this.foldingModel = null;
        this.foldingModelPromise = null;
        this.hiddenRangeModel = null;
        this.cursorChangedScheduler = null;
        this.rangeProvider?.dispose();
        this.rangeProvider = null;
      }
    });
    this.triggerFoldingModelChanged();
  }
  onFoldingStrategyChanged() {
    this.rangeProvider?.dispose();
    this.rangeProvider = null;
    this.triggerFoldingModelChanged();
  }
  getRangeProvider(editorModel) {
    if (this.rangeProvider) {
      return this.rangeProvider;
    }
    const indentRangeProvider = new IndentRangeProvider(editorModel, this.languageConfigurationService, this._foldingLimitReporter);
    this.rangeProvider = indentRangeProvider;
    if (this._useFoldingProviders && this.foldingModel) {
      const selectedProviders = FoldingController.getFoldingRangeProviders(this.languageFeaturesService, editorModel);
      if (selectedProviders.length > 0) {
        this.rangeProvider = new SyntaxRangeProvider(editorModel, selectedProviders, () => this.triggerFoldingModelChanged(), this._foldingLimitReporter, indentRangeProvider);
      }
    }
    return this.rangeProvider;
  }
  getFoldingModel() {
    return this.foldingModelPromise;
  }
  onDidChangeModelContent(e) {
    this.hiddenRangeModel?.notifyChangeModelContent(e);
    this.triggerFoldingModelChanged();
  }
  triggerFoldingModelChanged() {
    if (this.updateScheduler) {
      if (this.foldingRegionPromise) {
        this.foldingRegionPromise.cancel();
        this.foldingRegionPromise = null;
      }
      this.foldingModelPromise = this.updateScheduler.trigger(() => {
        const foldingModel = this.foldingModel;
        if (!foldingModel) {
          return null;
        }
        const sw = new StopWatch();
        const provider = this.getRangeProvider(foldingModel.textModel);
        const foldingRegionPromise = this.foldingRegionPromise = createCancelablePromise((token) => provider.compute(token));
        return foldingRegionPromise.then((foldingRanges) => {
          if (foldingRanges && foldingRegionPromise === this.foldingRegionPromise) {
            let scrollState;
            if (this._foldingImportsByDefault && !this._currentModelHasFoldedImports) {
              const hasChanges = foldingRanges.setCollapsedAllOfType(FoldingRangeKind.Imports.value, true);
              if (hasChanges) {
                scrollState = StableEditorScrollState.capture(this.editor);
                this._currentModelHasFoldedImports = hasChanges;
              }
            }
            const selections = this.editor.getSelections();
            foldingModel.update(foldingRanges, toSelectedLines(selections));
            scrollState?.restore(this.editor);
            const newValue = this.updateDebounceInfo.update(foldingModel.textModel, sw.elapsed());
            if (this.updateScheduler) {
              this.updateScheduler.defaultDelay = newValue;
            }
          }
          return foldingModel;
        });
      }).then(void 0, (err) => {
        onUnexpectedError(err);
        return null;
      });
    }
  }
  onHiddenRangesChanges(hiddenRanges) {
    if (this.hiddenRangeModel && hiddenRanges.length && !this._restoringViewState) {
      const selections = this.editor.getSelections();
      if (selections) {
        if (this.hiddenRangeModel.adjustSelections(selections)) {
          this.editor.setSelections(selections);
        }
      }
    }
    this.editor.setHiddenAreas(hiddenRanges, this);
  }
  onCursorPositionChanged() {
    if (this.hiddenRangeModel && this.hiddenRangeModel.hasRanges()) {
      this.cursorChangedScheduler.schedule();
    }
  }
  revealCursor() {
    const foldingModel = this.getFoldingModel();
    if (!foldingModel) {
      return;
    }
    foldingModel.then((foldingModel2) => {
      if (foldingModel2) {
        const selections = this.editor.getSelections();
        if (selections && selections.length > 0) {
          const toToggle = [];
          for (const selection of selections) {
            const lineNumber = selection.selectionStartLineNumber;
            if (this.hiddenRangeModel && this.hiddenRangeModel.isHidden(lineNumber)) {
              toToggle.push(...foldingModel2.getAllRegionsAtLine(lineNumber, (r) => r.isCollapsed && lineNumber > r.startLineNumber));
            }
          }
          if (toToggle.length) {
            foldingModel2.toggleCollapseState(toToggle);
            this.reveal(selections[0].getPosition());
          }
        }
      }
    }).then(void 0, onUnexpectedError);
  }
  onEditorMouseDown(e) {
    this.mouseDownInfo = null;
    if (!this.hiddenRangeModel || !e.target || !e.target.range) {
      return;
    }
    if (!e.event.leftButton && !e.event.middleButton) {
      return;
    }
    const range = e.target.range;
    let iconClicked = false;
    switch (e.target.type) {
      case MouseTargetType.GUTTER_LINE_DECORATIONS: {
        const data = e.target.detail;
        const offsetLeftInGutter = e.target.element.offsetLeft;
        const gutterOffsetX = data.offsetX - offsetLeftInGutter;
        if (gutterOffsetX < 4) {
          return;
        }
        iconClicked = true;
        break;
      }
      case MouseTargetType.CONTENT_EMPTY: {
        if (this._unfoldOnClickAfterEndOfLine && this.hiddenRangeModel.hasRanges()) {
          const data = e.target.detail;
          if (!data.isAfterLines) {
            break;
          }
        }
        return;
      }
      case MouseTargetType.CONTENT_TEXT: {
        if (this.hiddenRangeModel.hasRanges()) {
          const model = this.editor.getModel();
          if (model && range.startColumn === model.getLineMaxColumn(range.startLineNumber)) {
            break;
          }
        }
        return;
      }
      default:
        return;
    }
    this.mouseDownInfo = { lineNumber: range.startLineNumber, iconClicked };
  }
  onEditorMouseUp(e) {
    const foldingModel = this.foldingModel;
    if (!foldingModel || !this.mouseDownInfo || !e.target) {
      return;
    }
    const lineNumber = this.mouseDownInfo.lineNumber;
    const iconClicked = this.mouseDownInfo.iconClicked;
    const range = e.target.range;
    if (!range || range.startLineNumber !== lineNumber) {
      return;
    }
    if (iconClicked) {
      if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
        return;
      }
    } else {
      const model = this.editor.getModel();
      if (!model || range.startColumn !== model.getLineMaxColumn(lineNumber)) {
        return;
      }
    }
    const region = foldingModel.getRegionAtLine(lineNumber);
    if (region && region.startLineNumber === lineNumber) {
      const isCollapsed = region.isCollapsed;
      if (iconClicked || isCollapsed) {
        const surrounding = e.event.altKey;
        let toToggle = [];
        if (surrounding) {
          const filter = (otherRegion) => !otherRegion.containedBy(region) && !region.containedBy(otherRegion);
          const toMaybeToggle = foldingModel.getRegionsInside(null, filter);
          for (const r of toMaybeToggle) {
            if (r.isCollapsed) {
              toToggle.push(r);
            }
          }
          if (toToggle.length === 0) {
            toToggle = toMaybeToggle;
          }
        } else {
          const recursive = e.event.middleButton || e.event.shiftKey;
          if (recursive) {
            for (const r of foldingModel.getRegionsInside(region)) {
              if (r.isCollapsed === isCollapsed) {
                toToggle.push(r);
              }
            }
          }
          if (isCollapsed || !recursive || toToggle.length === 0) {
            toToggle.push(region);
          }
        }
        foldingModel.toggleCollapseState(toToggle);
        this.reveal({ lineNumber, column: 1 });
      }
    }
  }
  reveal(position) {
    this.editor.revealPositionInCenterIfOutsideViewport(position, ScrollType.Smooth);
  }
};
FoldingController.ID = "editor.contrib.folding";
FoldingController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ILanguageConfigurationService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, ILanguageFeatureDebounceService),
  __decorateParam(5, ILanguageFeaturesService)
], FoldingController);
class RangesLimitReporter {
  constructor(editor) {
    this.editor = editor;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._computed = 0;
    this._limited = false;
  }
  get limit() {
    return this.editor.getOptions().get(EditorOption.foldingMaximumRegions);
  }
  get computed() {
    return this._computed;
  }
  get limited() {
    return this._limited;
  }
  update(computed, limited) {
    if (computed !== this._computed || limited !== this._limited) {
      this._computed = computed;
      this._limited = limited;
      this._onDidChange.fire();
    }
  }
}
class FoldingAction extends EditorAction {
  runEditorCommand(accessor, editor, args) {
    const languageConfigurationService = accessor.get(ILanguageConfigurationService);
    const foldingController = FoldingController.get(editor);
    if (!foldingController) {
      return;
    }
    const foldingModelPromise = foldingController.getFoldingModel();
    if (foldingModelPromise) {
      this.reportTelemetry(accessor, editor);
      return foldingModelPromise.then((foldingModel) => {
        if (foldingModel) {
          this.invoke(foldingController, foldingModel, editor, args, languageConfigurationService);
          const selection = editor.getSelection();
          if (selection) {
            foldingController.reveal(selection.getStartPosition());
          }
        }
      });
    }
  }
  getSelectedLines(editor) {
    const selections = editor.getSelections();
    return selections ? selections.map((s) => s.startLineNumber) : [];
  }
  getLineNumbers(args, editor) {
    if (args && args.selectionLines) {
      return args.selectionLines.map((l) => l + 1);
    }
    return this.getSelectedLines(editor);
  }
  run(_accessor, _editor) {
  }
}
function toSelectedLines(selections) {
  if (!selections || selections.length === 0) {
    return {
      startsInside: () => false
    };
  }
  return {
    startsInside(startLine, endLine) {
      for (const s of selections) {
        const line = s.startLineNumber;
        if (line >= startLine && line <= endLine) {
          return true;
        }
      }
      return false;
    }
  };
}
function foldingArgumentsConstraint(args) {
  if (!types.isUndefined(args)) {
    if (!types.isObject(args)) {
      return false;
    }
    const foldingArgs = args;
    if (!types.isUndefined(foldingArgs.levels) && !types.isNumber(foldingArgs.levels)) {
      return false;
    }
    if (!types.isUndefined(foldingArgs.direction) && !types.isString(foldingArgs.direction)) {
      return false;
    }
    if (!types.isUndefined(foldingArgs.selectionLines) && (!Array.isArray(foldingArgs.selectionLines) || !foldingArgs.selectionLines.every(types.isNumber))) {
      return false;
    }
  }
  return true;
}
class UnfoldAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.unfold",
      label: nls.localize2("unfoldAction.label", "Unfold"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketRight,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.BracketRight
        },
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: "Unfold the content in the editor",
        args: [
          {
            name: "Unfold editor argument",
            description: `Property-value pairs that can be passed through this argument:
						* 'levels': Number of levels to unfold. If not set, defaults to 1.
						* 'direction': If 'up', unfold given number of levels up otherwise unfolds down.
						* 'selectionLines': Array of the start lines (0-based) of the editor selections to apply the unfold action to. If not set, the active selection(s) will be used.
						`,
            constraint: foldingArgumentsConstraint,
            schema: {
              "type": "object",
              "properties": {
                "levels": {
                  "type": "number",
                  "default": 1
                },
                "direction": {
                  "type": "string",
                  "enum": ["up", "down"],
                  "default": "down"
                },
                "selectionLines": {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                }
              }
            }
          }
        ]
      }
    });
  }
  invoke(_foldingController, foldingModel, editor, args) {
    const levels = args && args.levels || 1;
    const lineNumbers = this.getLineNumbers(args, editor);
    if (args && args.direction === "up") {
      setCollapseStateLevelsUp(foldingModel, false, levels, lineNumbers);
    } else {
      setCollapseStateLevelsDown(foldingModel, false, levels, lineNumbers);
    }
  }
}
class UnFoldRecursivelyAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.unfoldRecursively",
      label: nls.localize2("unFoldRecursivelyAction.label", "Unfold Recursively"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.BracketRight),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor, _args) {
    setCollapseStateLevelsDown(foldingModel, false, Number.MAX_VALUE, this.getSelectedLines(editor));
  }
}
class FoldAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.fold",
      label: nls.localize2("foldAction.label", "Fold"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.BracketLeft,
        mac: {
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.BracketLeft
        },
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: "Fold the content in the editor",
        args: [
          {
            name: "Fold editor argument",
            description: `Property-value pairs that can be passed through this argument:
							* 'levels': Number of levels to fold.
							* 'direction': If 'up', folds given number of levels up otherwise folds down.
							* 'selectionLines': Array of the start lines (0-based) of the editor selections to apply the fold action to. If not set, the active selection(s) will be used.
							If no levels or direction is set, folds the region at the locations or if already collapsed, the first uncollapsed parent instead.
						`,
            constraint: foldingArgumentsConstraint,
            schema: {
              "type": "object",
              "properties": {
                "levels": {
                  "type": "number"
                },
                "direction": {
                  "type": "string",
                  "enum": ["up", "down"]
                },
                "selectionLines": {
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                }
              }
            }
          }
        ]
      }
    });
  }
  invoke(_foldingController, foldingModel, editor, args) {
    const lineNumbers = this.getLineNumbers(args, editor);
    const levels = args && args.levels;
    const direction = args && args.direction;
    if (typeof levels !== "number" && typeof direction !== "string") {
      setCollapseStateUp(foldingModel, true, lineNumbers);
    } else {
      if (direction === "up") {
        setCollapseStateLevelsUp(foldingModel, true, levels || 1, lineNumbers);
      } else {
        setCollapseStateLevelsDown(foldingModel, true, levels || 1, lineNumbers);
      }
    }
  }
}
class ToggleFoldAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.toggleFold",
      label: nls.localize2("toggleFoldAction.label", "Toggle Fold"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyL),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const selectedLines = this.getSelectedLines(editor);
    toggleCollapseState(foldingModel, 1, selectedLines);
  }
}
class FoldRecursivelyAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.foldRecursively",
      label: nls.localize2("foldRecursivelyAction.label", "Fold Recursively"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.BracketLeft),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const selectedLines = this.getSelectedLines(editor);
    setCollapseStateLevelsDown(foldingModel, true, Number.MAX_VALUE, selectedLines);
  }
}
class ToggleFoldRecursivelyAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.toggleFoldRecursively",
      label: nls.localize2("toggleFoldRecursivelyAction.label", "Toggle Fold Recursively"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const selectedLines = this.getSelectedLines(editor);
    toggleCollapseState(foldingModel, Number.MAX_VALUE, selectedLines);
  }
}
class FoldAllBlockCommentsAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.foldAllBlockComments",
      label: nls.localize2("foldAllBlockComments.label", "Fold All Block Comments"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Slash),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor, args, languageConfigurationService) {
    if (foldingModel.regions.hasTypes()) {
      setCollapseStateForType(foldingModel, FoldingRangeKind.Comment.value, true);
    } else {
      const editorModel = editor.getModel();
      if (!editorModel) {
        return;
      }
      const comments = languageConfigurationService.getLanguageConfiguration(editorModel.getLanguageId()).comments;
      if (comments && comments.blockCommentStartToken) {
        const regExp = new RegExp("^\\s*" + escapeRegExpCharacters(comments.blockCommentStartToken));
        setCollapseStateForMatchingLines(foldingModel, regExp, true);
      }
    }
  }
}
class FoldAllRegionsAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.foldAllMarkerRegions",
      label: nls.localize2("foldAllMarkerRegions.label", "Fold All Regions"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Digit8),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor, args, languageConfigurationService) {
    if (foldingModel.regions.hasTypes()) {
      setCollapseStateForType(foldingModel, FoldingRangeKind.Region.value, true);
    } else {
      const editorModel = editor.getModel();
      if (!editorModel) {
        return;
      }
      const foldingRules = languageConfigurationService.getLanguageConfiguration(editorModel.getLanguageId()).foldingRules;
      if (foldingRules && foldingRules.markers && foldingRules.markers.start) {
        const regExp = new RegExp(foldingRules.markers.start);
        setCollapseStateForMatchingLines(foldingModel, regExp, true);
      }
    }
  }
}
class UnfoldAllRegionsAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.unfoldAllMarkerRegions",
      label: nls.localize2("unfoldAllMarkerRegions.label", "Unfold All Regions"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Digit9),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor, args, languageConfigurationService) {
    if (foldingModel.regions.hasTypes()) {
      setCollapseStateForType(foldingModel, FoldingRangeKind.Region.value, false);
    } else {
      const editorModel = editor.getModel();
      if (!editorModel) {
        return;
      }
      const foldingRules = languageConfigurationService.getLanguageConfiguration(editorModel.getLanguageId()).foldingRules;
      if (foldingRules && foldingRules.markers && foldingRules.markers.start) {
        const regExp = new RegExp(foldingRules.markers.start);
        setCollapseStateForMatchingLines(foldingModel, regExp, false);
      }
    }
  }
}
class FoldAllExceptAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.foldAllExcept",
      label: nls.localize2("foldAllExcept.label", "Fold All Except Selected"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Minus),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const selectedLines = this.getSelectedLines(editor);
    setCollapseStateForRest(foldingModel, true, selectedLines);
  }
}
class UnfoldAllExceptAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.unfoldAllExcept",
      label: nls.localize2("unfoldAllExcept.label", "Unfold All Except Selected"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Equal),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const selectedLines = this.getSelectedLines(editor);
    setCollapseStateForRest(foldingModel, false, selectedLines);
  }
}
class FoldAllAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.foldAll",
      label: nls.localize2("foldAllAction.label", "Fold All"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Digit0),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, _editor) {
    setCollapseStateLevelsDown(foldingModel, true);
  }
}
class UnfoldAllAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.unfoldAll",
      label: nls.localize2("unfoldAllAction.label", "Unfold All"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyJ),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, _editor) {
    setCollapseStateLevelsDown(foldingModel, false);
  }
}
const _FoldLevelAction = class _FoldLevelAction extends FoldingAction {
  getFoldingLevel() {
    return parseInt(this.id.substr(_FoldLevelAction.ID_PREFIX.length));
  }
  invoke(_foldingController, foldingModel, editor) {
    setCollapseStateAtLevel(foldingModel, this.getFoldingLevel(), true, this.getSelectedLines(editor));
  }
};
_FoldLevelAction.ID_PREFIX = "editor.foldLevel";
_FoldLevelAction.ID = (level) => _FoldLevelAction.ID_PREFIX + level;
let FoldLevelAction = _FoldLevelAction;
class GotoParentFoldAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.gotoParentFold",
      label: nls.localize2("gotoParentFold.label", "Go to Parent Fold"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const selectedLines = this.getSelectedLines(editor);
    if (selectedLines.length > 0) {
      const startLineNumber = getParentFoldLine(selectedLines[0], foldingModel);
      if (startLineNumber !== null) {
        editor.setSelection({
          startLineNumber,
          startColumn: 1,
          endLineNumber: startLineNumber,
          endColumn: 1
        });
      }
    }
  }
}
class GotoPreviousFoldAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.gotoPreviousFold",
      label: nls.localize2("gotoPreviousFold.label", "Go to Previous Folding Range"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const selectedLines = this.getSelectedLines(editor);
    if (selectedLines.length > 0) {
      const startLineNumber = getPreviousFoldLine(selectedLines[0], foldingModel);
      if (startLineNumber !== null) {
        editor.setSelection({
          startLineNumber,
          startColumn: 1,
          endLineNumber: startLineNumber,
          endColumn: 1
        });
      }
    }
  }
}
class GotoNextFoldAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.gotoNextFold",
      label: nls.localize2("gotoNextFold.label", "Go to Next Folding Range"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const selectedLines = this.getSelectedLines(editor);
    if (selectedLines.length > 0) {
      const startLineNumber = getNextFoldLine(selectedLines[0], foldingModel);
      if (startLineNumber !== null) {
        editor.setSelection({
          startLineNumber,
          startColumn: 1,
          endLineNumber: startLineNumber,
          endColumn: 1
        });
      }
    }
  }
}
class FoldRangeFromSelectionAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.createFoldingRangeFromSelection",
      label: nls.localize2("createManualFoldRange.label", "Create Folding Range from Selection"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Comma),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(_foldingController, foldingModel, editor) {
    const collapseRanges = [];
    const selections = editor.getSelections();
    if (selections) {
      for (const selection of selections) {
        let endLineNumber = selection.endLineNumber;
        if (selection.endColumn === 1) {
          --endLineNumber;
        }
        if (endLineNumber > selection.startLineNumber) {
          collapseRanges.push({
            startLineNumber: selection.startLineNumber,
            endLineNumber,
            type: void 0,
            isCollapsed: true,
            source: FoldSource.userDefined
          });
          editor.setSelection({
            startLineNumber: selection.startLineNumber,
            startColumn: 1,
            endLineNumber: selection.startLineNumber,
            endColumn: 1
          });
        }
      }
      if (collapseRanges.length > 0) {
        collapseRanges.sort((a, b) => {
          return a.startLineNumber - b.startLineNumber;
        });
        const newRanges = FoldingRegions.sanitizeAndMerge(foldingModel.regions, collapseRanges, editor.getModel()?.getLineCount());
        foldingModel.updatePost(FoldingRegions.fromFoldRanges(newRanges));
      }
    }
  }
}
class RemoveFoldRangeFromSelectionAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.removeManualFoldingRanges",
      label: nls.localize2("removeManualFoldingRanges.label", "Remove Manual Folding Ranges"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Period),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  invoke(foldingController, foldingModel, editor) {
    const selections = editor.getSelections();
    if (selections) {
      const ranges = [];
      for (const selection of selections) {
        const { startLineNumber, endLineNumber } = selection;
        ranges.push(endLineNumber >= startLineNumber ? { startLineNumber, endLineNumber } : { endLineNumber, startLineNumber });
      }
      foldingModel.removeManualRanges(ranges);
      foldingController.triggerFoldingModelChanged();
    }
  }
}
class ToggleImportFoldAction extends FoldingAction {
  constructor() {
    super({
      id: "editor.toggleImportFold",
      label: nls.localize2("toggleImportFold.label", "Toggle Import Fold"),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async invoke(foldingController, foldingModel) {
    const regionsToToggle = [];
    const regions = foldingModel.regions;
    for (let i = regions.length - 1; i >= 0; i--) {
      if (regions.getType(i) === FoldingRangeKind.Imports.value) {
        regionsToToggle.push(regions.toRegion(i));
      }
    }
    foldingModel.toggleCollapseState(regionsToToggle);
    foldingController.triggerFoldingModelChanged();
  }
}
registerEditorContribution(FoldingController.ID, FoldingController, EditorContributionInstantiation.Eager);
registerEditorAction(UnfoldAction);
registerEditorAction(UnFoldRecursivelyAction);
registerEditorAction(FoldAction);
registerEditorAction(FoldRecursivelyAction);
registerEditorAction(ToggleFoldRecursivelyAction);
registerEditorAction(FoldAllAction);
registerEditorAction(UnfoldAllAction);
registerEditorAction(FoldAllBlockCommentsAction);
registerEditorAction(FoldAllRegionsAction);
registerEditorAction(UnfoldAllRegionsAction);
registerEditorAction(FoldAllExceptAction);
registerEditorAction(UnfoldAllExceptAction);
registerEditorAction(ToggleFoldAction);
registerEditorAction(GotoParentFoldAction);
registerEditorAction(GotoPreviousFoldAction);
registerEditorAction(GotoNextFoldAction);
registerEditorAction(FoldRangeFromSelectionAction);
registerEditorAction(RemoveFoldRangeFromSelectionAction);
registerEditorAction(ToggleImportFoldAction);
for (let i = 1; i <= 7; i++) {
  registerInstantiatedEditorAction(
    new FoldLevelAction({
      id: FoldLevelAction.ID(i),
      label: nls.localize2("foldLevelAction.label", "Fold Level {0}", i),
      precondition: CONTEXT_FOLDING_ENABLED,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.Digit0 + i),
        weight: KeybindingWeight.EditorContrib
      }
    })
  );
}
CommandsRegistry.registerCommand("_executeFoldingRangeProvider", async function(accessor, ...args) {
  const [resource] = args;
  if (!(resource instanceof URI)) {
    throw illegalArgument();
  }
  const languageFeaturesService = accessor.get(ILanguageFeaturesService);
  const model = accessor.get(IModelService).getModel(resource);
  if (!model) {
    throw illegalArgument();
  }
  const configurationService = accessor.get(IConfigurationService);
  if (!configurationService.getValue("editor.folding", { resource })) {
    return [];
  }
  const languageConfigurationService = accessor.get(ILanguageConfigurationService);
  const strategy = configurationService.getValue("editor.foldingStrategy", { resource });
  const foldingLimitReporter = {
    get limit() {
      return configurationService.getValue("editor.foldingMaximumRegions", { resource });
    },
    update: (computed, limited) => {
    }
  };
  const indentRangeProvider = new IndentRangeProvider(model, languageConfigurationService, foldingLimitReporter);
  let rangeProvider = indentRangeProvider;
  if (strategy !== "indentation") {
    const providers = FoldingController.getFoldingRangeProviders(languageFeaturesService, model);
    if (providers.length) {
      rangeProvider = new SyntaxRangeProvider(model, providers, () => {
      }, foldingLimitReporter, indentRangeProvider);
    }
  }
  const ranges = await rangeProvider.compute(CancellationToken.None);
  const result = [];
  try {
    if (ranges) {
      for (let i = 0; i < ranges.length; i++) {
        const type = ranges.getType(i);
        result.push({ start: ranges.getStartLineNumber(i), end: ranges.getEndLineNumber(i), kind: type ? FoldingRangeKind.fromValue(type) : void 0 });
      }
    }
    return result;
  } finally {
    rangeProvider.dispose();
  }
});
export {
  FoldingController,
  RangesLimitReporter,
  toSelectedLines
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9mb2xkaW5nL2Jyb3dzZXIvZm9sZGluZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgRGVsYXllciwgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGlsbGVnYWxBcmd1bWVudCwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0ICcuL2ZvbGRpbmcuY3NzJztcbmltcG9ydCB7IFN0YWJsZUVkaXRvclNjcm9sbFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9zdGFibGVFZGl0b3JTY3JvbGwuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElFZGl0b3JNb3VzZUV2ZW50LCBNb3VzZVRhcmdldFR5cGUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLCByZWdpc3RlckVkaXRvckFjdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIHJlZ2lzdGVySW5zdGFudGlhdGVkRWRpdG9yQWN0aW9uLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiwgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBGb2xkaW5nUmFuZ2UsIEZvbGRpbmdSYW5nZUtpbmQsIEZvbGRpbmdSYW5nZVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29sbGFwc2VNZW1lbnRvLCBGb2xkaW5nTW9kZWwsIGdldE5leHRGb2xkTGluZSwgZ2V0UGFyZW50Rm9sZExpbmUgYXMgZ2V0UGFyZW50Rm9sZExpbmUsIGdldFByZXZpb3VzRm9sZExpbmUsIHNldENvbGxhcHNlU3RhdGVBdExldmVsLCBzZXRDb2xsYXBzZVN0YXRlRm9yTWF0Y2hpbmdMaW5lcywgc2V0Q29sbGFwc2VTdGF0ZUZvclJlc3QsIHNldENvbGxhcHNlU3RhdGVGb3JUeXBlLCBzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93biwgc2V0Q29sbGFwc2VTdGF0ZUxldmVsc1VwLCBzZXRDb2xsYXBzZVN0YXRlVXAsIHRvZ2dsZUNvbGxhcHNlU3RhdGUgfSBmcm9tICcuL2ZvbGRpbmdNb2RlbC5qcyc7XG5pbXBvcnQgeyBIaWRkZW5SYW5nZU1vZGVsIH0gZnJvbSAnLi9oaWRkZW5SYW5nZU1vZGVsLmpzJztcbmltcG9ydCB7IEluZGVudFJhbmdlUHJvdmlkZXIgfSBmcm9tICcuL2luZGVudFJhbmdlUHJvdmlkZXIuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBGb2xkaW5nRGVjb3JhdGlvblByb3ZpZGVyIH0gZnJvbSAnLi9mb2xkaW5nRGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgRm9sZGluZ1JlZ2lvbiwgRm9sZGluZ1JlZ2lvbnMsIEZvbGRSYW5nZSwgRm9sZFNvdXJjZSwgSUxpbmVSYW5nZSB9IGZyb20gJy4vZm9sZGluZ1Jhbmdlcy5qcyc7XG5pbXBvcnQgeyBTeW50YXhSYW5nZVByb3ZpZGVyIH0gZnJvbSAnLi9zeW50YXhSYW5nZVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUZlYXR1cmVEZWJvdW5jZUluZm9ybWF0aW9uLCBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZURlYm91bmNlLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5cbmNvbnN0IENPTlRFWFRfRk9MRElOR19FTkFCTEVEID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2ZvbGRpbmdFbmFibGVkJywgZmFsc2UpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJhbmdlUHJvdmlkZXIge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRjb21wdXRlKGNhbmNlbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxGb2xkaW5nUmVnaW9ucyB8IG51bGw+O1xuXHRkaXNwb3NlKCk6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBGb2xkaW5nU3RhdGVNZW1lbnRvIHtcblx0Y29sbGFwc2VkUmVnaW9ucz86IENvbGxhcHNlTWVtZW50bztcblx0bGluZUNvdW50PzogbnVtYmVyO1xuXHRwcm92aWRlcj86IHN0cmluZztcblx0Zm9sZGVkSW1wb3J0cz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRm9sZGluZ0xpbWl0UmVwb3J0ZXIge1xuXHRyZWFkb25seSBsaW1pdDogbnVtYmVyO1xuXHR1cGRhdGUoY29tcHV0ZWQ6IG51bWJlciwgbGltaXRlZDogbnVtYmVyIHwgZmFsc2UpOiB2b2lkO1xufVxuXG5leHBvcnQgdHlwZSBGb2xkaW5nUmFuZ2VQcm92aWRlclNlbGVjdG9yID0gKHByb3ZpZGVyOiBGb2xkaW5nUmFuZ2VQcm92aWRlcltdLCBkb2N1bWVudDogSVRleHRNb2RlbCkgPT4gRm9sZGluZ1JhbmdlUHJvdmlkZXJbXSB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGNsYXNzIEZvbGRpbmdDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmNvbnRyaWIuZm9sZGluZyc7XG5cblx0cHVibGljIHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IEZvbGRpbmdDb250cm9sbGVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248Rm9sZGluZ0NvbnRyb2xsZXI+KEZvbGRpbmdDb250cm9sbGVyLklEKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9mb2xkaW5nUmFuZ2VTZWxlY3RvcjogRm9sZGluZ1JhbmdlUHJvdmlkZXJTZWxlY3RvciB8IHVuZGVmaW5lZDtcblxuXHRwdWJsaWMgc3RhdGljIGdldEZvbGRpbmdSYW5nZVByb3ZpZGVycyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBtb2RlbDogSVRleHRNb2RlbCk6IEZvbGRpbmdSYW5nZVByb3ZpZGVyW10ge1xuXHRcdGNvbnN0IGZvbGRpbmdSYW5nZVByb3ZpZGVycyA9IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmZvbGRpbmdSYW5nZVByb3ZpZGVyLm9yZGVyZWQobW9kZWwpO1xuXHRcdHJldHVybiAoRm9sZGluZ0NvbnRyb2xsZXIuX2ZvbGRpbmdSYW5nZVNlbGVjdG9yPy4oZm9sZGluZ1JhbmdlUHJvdmlkZXJzLCBtb2RlbCkpID8/IGZvbGRpbmdSYW5nZVByb3ZpZGVycztcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgc2V0Rm9sZGluZ1JhbmdlUHJvdmlkZXJTZWxlY3Rvcihmb2xkaW5nUmFuZ2VTZWxlY3RvcjogRm9sZGluZ1JhbmdlUHJvdmlkZXJTZWxlY3Rvcik6IElEaXNwb3NhYmxlIHtcblx0XHRGb2xkaW5nQ29udHJvbGxlci5fZm9sZGluZ1JhbmdlU2VsZWN0b3IgPSBmb2xkaW5nUmFuZ2VTZWxlY3Rvcjtcblx0XHRyZXR1cm4geyBkaXNwb3NlOiAoKSA9PiB7IEZvbGRpbmdDb250cm9sbGVyLl9mb2xkaW5nUmFuZ2VTZWxlY3RvciA9IHVuZGVmaW5lZDsgfSB9O1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yO1xuXHRwcml2YXRlIF9pc0VuYWJsZWQ6IGJvb2xlYW47XG5cdHByaXZhdGUgX3VzZUZvbGRpbmdQcm92aWRlcnM6IGJvb2xlYW47XG5cdHByaXZhdGUgX3VuZm9sZE9uQ2xpY2tBZnRlckVuZE9mTGluZTogYm9vbGVhbjtcblx0cHJpdmF0ZSBfcmVzdG9yaW5nVmlld1N0YXRlOiBib29sZWFuO1xuXHRwcml2YXRlIF9mb2xkaW5nSW1wb3J0c0J5RGVmYXVsdDogYm9vbGVhbjtcblx0cHJpdmF0ZSBfY3VycmVudE1vZGVsSGFzRm9sZGVkSW1wb3J0czogYm9vbGVhbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGZvbGRpbmdEZWNvcmF0aW9uUHJvdmlkZXI6IEZvbGRpbmdEZWNvcmF0aW9uUHJvdmlkZXI7XG5cblx0cHJpdmF0ZSBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCB8IG51bGw7XG5cdHByaXZhdGUgaGlkZGVuUmFuZ2VNb2RlbDogSGlkZGVuUmFuZ2VNb2RlbCB8IG51bGw7XG5cblx0cHJpdmF0ZSByYW5nZVByb3ZpZGVyOiBSYW5nZVByb3ZpZGVyIHwgbnVsbDtcblx0cHJpdmF0ZSBmb2xkaW5nUmVnaW9uUHJvbWlzZTogQ2FuY2VsYWJsZVByb21pc2U8Rm9sZGluZ1JlZ2lvbnMgfCBudWxsPiB8IG51bGw7XG5cblx0cHJpdmF0ZSBmb2xkaW5nTW9kZWxQcm9taXNlOiBQcm9taXNlPEZvbGRpbmdNb2RlbCB8IG51bGw+IHwgbnVsbDtcblx0cHJpdmF0ZSB1cGRhdGVTY2hlZHVsZXI6IERlbGF5ZXI8Rm9sZGluZ01vZGVsIHwgbnVsbD4gfCBudWxsO1xuXHRwcml2YXRlIHJlYWRvbmx5IHVwZGF0ZURlYm91bmNlSW5mbzogSUZlYXR1cmVEZWJvdW5jZUluZm9ybWF0aW9uO1xuXG5cdHByaXZhdGUgZm9sZGluZ0VuYWJsZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGN1cnNvckNoYW5nZWRTY2hlZHVsZXI6IFJ1bk9uY2VTY2hlZHVsZXIgfCBudWxsO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbG9jYWxUb0Rpc3Bvc2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIG1vdXNlRG93bkluZm86IHsgbGluZU51bWJlcjogbnVtYmVyOyBpY29uQ2xpY2tlZDogYm9vbGVhbiB9IHwgbnVsbDtcblxuXHRwdWJsaWMgcmVhZG9ubHkgX2ZvbGRpbmdMaW1pdFJlcG9ydGVyOiBSYW5nZXNMaW1pdFJlcG9ydGVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIGxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmVkaXRvciA9IGVkaXRvcjtcblxuXHRcdHRoaXMuX2ZvbGRpbmdMaW1pdFJlcG9ydGVyID0gbmV3IFJhbmdlc0xpbWl0UmVwb3J0ZXIoZWRpdG9yKTtcblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLmVkaXRvci5nZXRPcHRpb25zKCk7XG5cdFx0dGhpcy5faXNFbmFibGVkID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbGRpbmcpO1xuXHRcdHRoaXMuX3VzZUZvbGRpbmdQcm92aWRlcnMgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9sZGluZ1N0cmF0ZWd5KSAhPT0gJ2luZGVudGF0aW9uJztcblx0XHR0aGlzLl91bmZvbGRPbkNsaWNrQWZ0ZXJFbmRPZkxpbmUgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24udW5mb2xkT25DbGlja0FmdGVyRW5kT2ZMaW5lKTtcblx0XHR0aGlzLl9yZXN0b3JpbmdWaWV3U3RhdGUgPSBmYWxzZTtcblx0XHR0aGlzLl9jdXJyZW50TW9kZWxIYXNGb2xkZWRJbXBvcnRzID0gZmFsc2U7XG5cdFx0dGhpcy5fZm9sZGluZ0ltcG9ydHNCeURlZmF1bHQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9sZGluZ0ltcG9ydHNCeURlZmF1bHQpO1xuXHRcdHRoaXMudXBkYXRlRGVib3VuY2VJbmZvID0gbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlLmZvcihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5mb2xkaW5nUmFuZ2VQcm92aWRlciwgJ0ZvbGRpbmcnLCB7IG1pbjogMjAwIH0pO1xuXG5cdFx0dGhpcy5mb2xkaW5nTW9kZWwgPSBudWxsO1xuXHRcdHRoaXMuaGlkZGVuUmFuZ2VNb2RlbCA9IG51bGw7XG5cdFx0dGhpcy5yYW5nZVByb3ZpZGVyID0gbnVsbDtcblx0XHR0aGlzLmZvbGRpbmdSZWdpb25Qcm9taXNlID0gbnVsbDtcblx0XHR0aGlzLmZvbGRpbmdNb2RlbFByb21pc2UgPSBudWxsO1xuXHRcdHRoaXMudXBkYXRlU2NoZWR1bGVyID0gbnVsbDtcblx0XHR0aGlzLmN1cnNvckNoYW5nZWRTY2hlZHVsZXIgPSBudWxsO1xuXHRcdHRoaXMubW91c2VEb3duSW5mbyA9IG51bGw7XG5cblx0XHR0aGlzLmZvbGRpbmdEZWNvcmF0aW9uUHJvdmlkZXIgPSBuZXcgRm9sZGluZ0RlY29yYXRpb25Qcm92aWRlcihlZGl0b3IpO1xuXHRcdHRoaXMuZm9sZGluZ0RlY29yYXRpb25Qcm92aWRlci5zaG93Rm9sZGluZ0NvbnRyb2xzID0gb3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLnNob3dGb2xkaW5nQ29udHJvbHMpO1xuXHRcdHRoaXMuZm9sZGluZ0RlY29yYXRpb25Qcm92aWRlci5zaG93Rm9sZGluZ0hpZ2hsaWdodHMgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9sZGluZ0hpZ2hsaWdodCk7XG5cdFx0dGhpcy5mb2xkaW5nRW5hYmxlZCA9IENPTlRFWFRfRk9MRElOR19FTkFCTEVELmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmZvbGRpbmdFbmFibGVkLnNldCh0aGlzLl9pc0VuYWJsZWQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB0aGlzLm9uTW9kZWxDaGFuZ2VkKCkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZTogQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZm9sZGluZykpIHtcblx0XHRcdFx0dGhpcy5faXNFbmFibGVkID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9ucygpLmdldChFZGl0b3JPcHRpb24uZm9sZGluZyk7XG5cdFx0XHRcdHRoaXMuZm9sZGluZ0VuYWJsZWQuc2V0KHRoaXMuX2lzRW5hYmxlZCk7XG5cdFx0XHRcdHRoaXMub25Nb2RlbENoYW5nZWQoKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmZvbGRpbmdNYXhpbXVtUmVnaW9ucykpIHtcblx0XHRcdFx0dGhpcy5vbk1vZGVsQ2hhbmdlZCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uc2hvd0ZvbGRpbmdDb250cm9scykgfHwgZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5mb2xkaW5nSGlnaGxpZ2h0KSkge1xuXHRcdFx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9ucygpO1xuXHRcdFx0XHR0aGlzLmZvbGRpbmdEZWNvcmF0aW9uUHJvdmlkZXIuc2hvd0ZvbGRpbmdDb250cm9scyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5zaG93Rm9sZGluZ0NvbnRyb2xzKTtcblx0XHRcdFx0dGhpcy5mb2xkaW5nRGVjb3JhdGlvblByb3ZpZGVyLnNob3dGb2xkaW5nSGlnaGxpZ2h0cyA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb2xkaW5nSGlnaGxpZ2h0KTtcblx0XHRcdFx0dGhpcy50cmlnZ2VyRm9sZGluZ01vZGVsQ2hhbmdlZCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZm9sZGluZ1N0cmF0ZWd5KSkge1xuXHRcdFx0XHR0aGlzLl91c2VGb2xkaW5nUHJvdmlkZXJzID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9ucygpLmdldChFZGl0b3JPcHRpb24uZm9sZGluZ1N0cmF0ZWd5KSAhPT0gJ2luZGVudGF0aW9uJztcblx0XHRcdFx0dGhpcy5vbkZvbGRpbmdTdHJhdGVneUNoYW5nZWQoKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLnVuZm9sZE9uQ2xpY2tBZnRlckVuZE9mTGluZSkpIHtcblx0XHRcdFx0dGhpcy5fdW5mb2xkT25DbGlja0FmdGVyRW5kT2ZMaW5lID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9ucygpLmdldChFZGl0b3JPcHRpb24udW5mb2xkT25DbGlja0FmdGVyRW5kT2ZMaW5lKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmZvbGRpbmdJbXBvcnRzQnlEZWZhdWx0KSkge1xuXHRcdFx0XHR0aGlzLl9mb2xkaW5nSW1wb3J0c0J5RGVmYXVsdCA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbnMoKS5nZXQoRWRpdG9yT3B0aW9uLmZvbGRpbmdJbXBvcnRzQnlEZWZhdWx0KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5vbk1vZGVsQ2hhbmdlZCgpO1xuXHR9XG5cblx0cHVibGljIGdldCBsaW1pdFJlcG9ydGVyKCkge1xuXHRcdHJldHVybiB0aGlzLl9mb2xkaW5nTGltaXRSZXBvcnRlcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdG9yZSB2aWV3IHN0YXRlLlxuXHQgKi9cblx0cHVibGljIHNhdmVWaWV3U3RhdGUoKTogRm9sZGluZ1N0YXRlTWVtZW50byB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwgfHwgIXRoaXMuX2lzRW5hYmxlZCB8fCBtb2RlbC5pc1Rvb0xhcmdlRm9yVG9rZW5pemF0aW9uKCkpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZm9sZGluZ01vZGVsKSB7IC8vIGRpc3Bvc2VkID9cblx0XHRcdGNvbnN0IGNvbGxhcHNlZFJlZ2lvbnMgPSB0aGlzLmZvbGRpbmdNb2RlbC5nZXRNZW1lbnRvKCk7XG5cdFx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMucmFuZ2VQcm92aWRlciA/IHRoaXMucmFuZ2VQcm92aWRlci5pZCA6IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybiB7IGNvbGxhcHNlZFJlZ2lvbnMsIGxpbmVDb3VudDogbW9kZWwuZ2V0TGluZUNvdW50KCksIHByb3ZpZGVyLCBmb2xkZWRJbXBvcnRzOiB0aGlzLl9jdXJyZW50TW9kZWxIYXNGb2xkZWRJbXBvcnRzIH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvKipcblx0ICogUmVzdG9yZSB2aWV3IHN0YXRlLlxuXHQgKi9cblx0cHVibGljIHJlc3RvcmVWaWV3U3RhdGUoc3RhdGU6IEZvbGRpbmdTdGF0ZU1lbWVudG8pOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCB8fCAhdGhpcy5faXNFbmFibGVkIHx8IG1vZGVsLmlzVG9vTGFyZ2VGb3JUb2tlbml6YXRpb24oKSB8fCAhdGhpcy5oaWRkZW5SYW5nZU1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghc3RhdGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jdXJyZW50TW9kZWxIYXNGb2xkZWRJbXBvcnRzID0gISFzdGF0ZS5mb2xkZWRJbXBvcnRzO1xuXHRcdGlmIChzdGF0ZS5jb2xsYXBzZWRSZWdpb25zICYmIHN0YXRlLmNvbGxhcHNlZFJlZ2lvbnMubGVuZ3RoID4gMCAmJiB0aGlzLmZvbGRpbmdNb2RlbCkge1xuXHRcdFx0dGhpcy5fcmVzdG9yaW5nVmlld1N0YXRlID0gdHJ1ZTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuZm9sZGluZ01vZGVsLmFwcGx5TWVtZW50byhzdGF0ZS5jb2xsYXBzZWRSZWdpb25zKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuX3Jlc3RvcmluZ1ZpZXdTdGF0ZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Nb2RlbENoYW5nZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5sb2NhbFRvRGlzcG9zZS5jbGVhcigpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghdGhpcy5faXNFbmFibGVkIHx8ICFtb2RlbCB8fCBtb2RlbC5pc1Rvb0xhcmdlRm9yVG9rZW5pemF0aW9uKCkpIHtcblx0XHRcdC8vIGh1Z2UgZmlsZXMgZ2V0IG5vIHZpZXcgbW9kZWwsIHNvIHRoZXkgY2Fubm90IHN1cHBvcnQgaGlkZGVuIGFyZWFzXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3VycmVudE1vZGVsSGFzRm9sZGVkSW1wb3J0cyA9IGZhbHNlO1xuXHRcdHRoaXMuZm9sZGluZ01vZGVsID0gbmV3IEZvbGRpbmdNb2RlbChtb2RlbCwgdGhpcy5mb2xkaW5nRGVjb3JhdGlvblByb3ZpZGVyKTtcblx0XHR0aGlzLmxvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLmZvbGRpbmdNb2RlbCk7XG5cblx0XHR0aGlzLmhpZGRlblJhbmdlTW9kZWwgPSBuZXcgSGlkZGVuUmFuZ2VNb2RlbCh0aGlzLmZvbGRpbmdNb2RlbCk7XG5cdFx0dGhpcy5sb2NhbFRvRGlzcG9zZS5hZGQodGhpcy5oaWRkZW5SYW5nZU1vZGVsKTtcblx0XHR0aGlzLmxvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLmhpZGRlblJhbmdlTW9kZWwub25EaWRDaGFuZ2UoaHIgPT4gdGhpcy5vbkhpZGRlblJhbmdlc0NoYW5nZXMoaHIpKSk7XG5cblx0XHR0aGlzLnVwZGF0ZVNjaGVkdWxlciA9IG5ldyBEZWxheWVyPEZvbGRpbmdNb2RlbD4odGhpcy51cGRhdGVEZWJvdW5jZUluZm8uZ2V0KG1vZGVsKSk7XG5cblx0XHR0aGlzLmN1cnNvckNoYW5nZWRTY2hlZHVsZXIgPSBuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLnJldmVhbEN1cnNvcigpLCAyMDApO1xuXHRcdHRoaXMubG9jYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuY3Vyc29yQ2hhbmdlZFNjaGVkdWxlcik7XG5cdFx0dGhpcy5sb2NhbFRvRGlzcG9zZS5hZGQodGhpcy5sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5mb2xkaW5nUmFuZ2VQcm92aWRlci5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLm9uRm9sZGluZ1N0cmF0ZWd5Q2hhbmdlZCgpKSk7XG5cdFx0dGhpcy5sb2NhbFRvRGlzcG9zZS5hZGQodGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlQ29uZmlndXJhdGlvbigoKSA9PiB0aGlzLm9uRm9sZGluZ1N0cmF0ZWd5Q2hhbmdlZCgpKSk7IC8vIGNvdmVycyBtb2RlbCBsYW5ndWFnZSBjaGFuZ2VzIGFzIHdlbGxcblx0XHR0aGlzLmxvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudChlID0+IHRoaXMub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoZSkpKTtcblx0XHR0aGlzLmxvY2FsVG9EaXNwb3NlLmFkZCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKCgpID0+IHRoaXMub25DdXJzb3JQb3NpdGlvbkNoYW5nZWQoKSkpO1xuXHRcdHRoaXMubG9jYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuZWRpdG9yLm9uTW91c2VEb3duKGUgPT4gdGhpcy5vbkVkaXRvck1vdXNlRG93bihlKSkpO1xuXHRcdHRoaXMubG9jYWxUb0Rpc3Bvc2UuYWRkKHRoaXMuZWRpdG9yLm9uTW91c2VVcChlID0+IHRoaXMub25FZGl0b3JNb3VzZVVwKGUpKSk7XG5cdFx0dGhpcy5sb2NhbFRvRGlzcG9zZS5hZGQoe1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5mb2xkaW5nUmVnaW9uUHJvbWlzZSkge1xuXHRcdFx0XHRcdHRoaXMuZm9sZGluZ1JlZ2lvblByb21pc2UuY2FuY2VsKCk7XG5cdFx0XHRcdFx0dGhpcy5mb2xkaW5nUmVnaW9uUHJvbWlzZSA9IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy51cGRhdGVTY2hlZHVsZXI/LmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVNjaGVkdWxlciA9IG51bGw7XG5cdFx0XHRcdHRoaXMuZm9sZGluZ01vZGVsID0gbnVsbDtcblx0XHRcdFx0dGhpcy5mb2xkaW5nTW9kZWxQcm9taXNlID0gbnVsbDtcblx0XHRcdFx0dGhpcy5oaWRkZW5SYW5nZU1vZGVsID0gbnVsbDtcblx0XHRcdFx0dGhpcy5jdXJzb3JDaGFuZ2VkU2NoZWR1bGVyID0gbnVsbDtcblx0XHRcdFx0dGhpcy5yYW5nZVByb3ZpZGVyPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMucmFuZ2VQcm92aWRlciA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy50cmlnZ2VyRm9sZGluZ01vZGVsQ2hhbmdlZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkZvbGRpbmdTdHJhdGVneUNoYW5nZWQoKSB7XG5cdFx0dGhpcy5yYW5nZVByb3ZpZGVyPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5yYW5nZVByb3ZpZGVyID0gbnVsbDtcblx0XHR0aGlzLnRyaWdnZXJGb2xkaW5nTW9kZWxDaGFuZ2VkKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldFJhbmdlUHJvdmlkZXIoZWRpdG9yTW9kZWw6IElUZXh0TW9kZWwpOiBSYW5nZVByb3ZpZGVyIHtcblx0XHRpZiAodGhpcy5yYW5nZVByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yYW5nZVByb3ZpZGVyO1xuXHRcdH1cblx0XHRjb25zdCBpbmRlbnRSYW5nZVByb3ZpZGVyID0gbmV3IEluZGVudFJhbmdlUHJvdmlkZXIoZWRpdG9yTW9kZWwsIHRoaXMubGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5fZm9sZGluZ0xpbWl0UmVwb3J0ZXIpO1xuXHRcdHRoaXMucmFuZ2VQcm92aWRlciA9IGluZGVudFJhbmdlUHJvdmlkZXI7IC8vIGZhbGxiYWNrXG5cdFx0aWYgKHRoaXMuX3VzZUZvbGRpbmdQcm92aWRlcnMgJiYgdGhpcy5mb2xkaW5nTW9kZWwpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkUHJvdmlkZXJzID0gRm9sZGluZ0NvbnRyb2xsZXIuZ2V0Rm9sZGluZ1JhbmdlUHJvdmlkZXJzKHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIGVkaXRvck1vZGVsKTtcblx0XHRcdGlmIChzZWxlY3RlZFByb3ZpZGVycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMucmFuZ2VQcm92aWRlciA9IG5ldyBTeW50YXhSYW5nZVByb3ZpZGVyKGVkaXRvck1vZGVsLCBzZWxlY3RlZFByb3ZpZGVycywgKCkgPT4gdGhpcy50cmlnZ2VyRm9sZGluZ01vZGVsQ2hhbmdlZCgpLCB0aGlzLl9mb2xkaW5nTGltaXRSZXBvcnRlciwgaW5kZW50UmFuZ2VQcm92aWRlcik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnJhbmdlUHJvdmlkZXI7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Rm9sZGluZ01vZGVsKCk6IFByb21pc2U8Rm9sZGluZ01vZGVsIHwgbnVsbD4gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5mb2xkaW5nTW9kZWxQcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZU1vZGVsQ29udGVudChlOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50KSB7XG5cdFx0dGhpcy5oaWRkZW5SYW5nZU1vZGVsPy5ub3RpZnlDaGFuZ2VNb2RlbENvbnRlbnQoZSk7XG5cdFx0dGhpcy50cmlnZ2VyRm9sZGluZ01vZGVsQ2hhbmdlZCgpO1xuXHR9XG5cblxuXHRwdWJsaWMgdHJpZ2dlckZvbGRpbmdNb2RlbENoYW5nZWQoKSB7XG5cdFx0aWYgKHRoaXMudXBkYXRlU2NoZWR1bGVyKSB7XG5cdFx0XHRpZiAodGhpcy5mb2xkaW5nUmVnaW9uUHJvbWlzZSkge1xuXHRcdFx0XHR0aGlzLmZvbGRpbmdSZWdpb25Qcm9taXNlLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLmZvbGRpbmdSZWdpb25Qcm9taXNlID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdHRoaXMuZm9sZGluZ01vZGVsUHJvbWlzZSA9IHRoaXMudXBkYXRlU2NoZWR1bGVyLnRyaWdnZXIoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSB0aGlzLmZvbGRpbmdNb2RlbDtcblx0XHRcdFx0aWYgKCFmb2xkaW5nTW9kZWwpIHsgLy8gbnVsbCBpZiBlZGl0b3IgaGFzIGJlZW4gZGlzcG9zZWQsIG9yIGZvbGRpbmcgdHVybmVkIG9mZlxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHN3ID0gbmV3IFN0b3BXYXRjaCgpO1xuXHRcdFx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuZ2V0UmFuZ2VQcm92aWRlcihmb2xkaW5nTW9kZWwudGV4dE1vZGVsKTtcblx0XHRcdFx0Y29uc3QgZm9sZGluZ1JlZ2lvblByb21pc2UgPSB0aGlzLmZvbGRpbmdSZWdpb25Qcm9taXNlID0gY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UodG9rZW4gPT4gcHJvdmlkZXIuY29tcHV0ZSh0b2tlbikpO1xuXHRcdFx0XHRyZXR1cm4gZm9sZGluZ1JlZ2lvblByb21pc2UudGhlbihmb2xkaW5nUmFuZ2VzID0+IHtcblx0XHRcdFx0XHRpZiAoZm9sZGluZ1JhbmdlcyAmJiBmb2xkaW5nUmVnaW9uUHJvbWlzZSA9PT0gdGhpcy5mb2xkaW5nUmVnaW9uUHJvbWlzZSkgeyAvLyBuZXcgcmVxdWVzdCBvciBjYW5jZWxsZWQgaW4gdGhlIG1lYW50aW1lP1xuXHRcdFx0XHRcdFx0bGV0IHNjcm9sbFN0YXRlOiBTdGFibGVFZGl0b3JTY3JvbGxTdGF0ZSB8IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX2ZvbGRpbmdJbXBvcnRzQnlEZWZhdWx0ICYmICF0aGlzLl9jdXJyZW50TW9kZWxIYXNGb2xkZWRJbXBvcnRzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGhhc0NoYW5nZXMgPSBmb2xkaW5nUmFuZ2VzLnNldENvbGxhcHNlZEFsbE9mVHlwZShGb2xkaW5nUmFuZ2VLaW5kLkltcG9ydHMudmFsdWUsIHRydWUpO1xuXHRcdFx0XHRcdFx0XHRpZiAoaGFzQ2hhbmdlcykge1xuXHRcdFx0XHRcdFx0XHRcdHNjcm9sbFN0YXRlID0gU3RhYmxlRWRpdG9yU2Nyb2xsU3RhdGUuY2FwdHVyZSh0aGlzLmVkaXRvcik7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fY3VycmVudE1vZGVsSGFzRm9sZGVkSW1wb3J0cyA9IGhhc0NoYW5nZXM7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gc29tZSBjdXJzb3JzIG1pZ2h0IGhhdmUgbW92ZWQgaW50byBoaWRkZW4gcmVnaW9ucywgbWFrZSBzdXJlIHRoZXkgYXJlIGluIGV4cGFuZGVkIHJlZ2lvbnNcblx0XHRcdFx0XHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0XHRcdFx0XHRmb2xkaW5nTW9kZWwudXBkYXRlKGZvbGRpbmdSYW5nZXMsIHRvU2VsZWN0ZWRMaW5lcyhzZWxlY3Rpb25zKSk7XG5cblx0XHRcdFx0XHRcdHNjcm9sbFN0YXRlPy5yZXN0b3JlKHRoaXMuZWRpdG9yKTtcblxuXHRcdFx0XHRcdFx0Ly8gdXBkYXRlIGRlYm91bmNlIGluZm9cblx0XHRcdFx0XHRcdGNvbnN0IG5ld1ZhbHVlID0gdGhpcy51cGRhdGVEZWJvdW5jZUluZm8udXBkYXRlKGZvbGRpbmdNb2RlbC50ZXh0TW9kZWwsIHN3LmVsYXBzZWQoKSk7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy51cGRhdGVTY2hlZHVsZXIpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVTY2hlZHVsZXIuZGVmYXVsdERlbGF5ID0gbmV3VmFsdWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmb2xkaW5nTW9kZWw7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSkudGhlbih1bmRlZmluZWQsIChlcnIpID0+IHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uSGlkZGVuUmFuZ2VzQ2hhbmdlcyhoaWRkZW5SYW5nZXM6IElSYW5nZVtdKSB7XG5cdFx0aWYgKHRoaXMuaGlkZGVuUmFuZ2VNb2RlbCAmJiBoaWRkZW5SYW5nZXMubGVuZ3RoICYmICF0aGlzLl9yZXN0b3JpbmdWaWV3U3RhdGUpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbnMgPSB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0XHRpZiAoc2VsZWN0aW9ucykge1xuXHRcdFx0XHRpZiAodGhpcy5oaWRkZW5SYW5nZU1vZGVsLmFkanVzdFNlbGVjdGlvbnMoc2VsZWN0aW9ucykpIHtcblx0XHRcdFx0XHR0aGlzLmVkaXRvci5zZXRTZWxlY3Rpb25zKHNlbGVjdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuZWRpdG9yLnNldEhpZGRlbkFyZWFzKGhpZGRlblJhbmdlcywgdGhpcyk7XG5cdH1cblxuXHRwcml2YXRlIG9uQ3Vyc29yUG9zaXRpb25DaGFuZ2VkKCkge1xuXHRcdGlmICh0aGlzLmhpZGRlblJhbmdlTW9kZWwgJiYgdGhpcy5oaWRkZW5SYW5nZU1vZGVsLmhhc1JhbmdlcygpKSB7XG5cdFx0XHR0aGlzLmN1cnNvckNoYW5nZWRTY2hlZHVsZXIhLnNjaGVkdWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZXZlYWxDdXJzb3IoKSB7XG5cdFx0Y29uc3QgZm9sZGluZ01vZGVsID0gdGhpcy5nZXRGb2xkaW5nTW9kZWwoKTtcblx0XHRpZiAoIWZvbGRpbmdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRmb2xkaW5nTW9kZWwudGhlbihmb2xkaW5nTW9kZWwgPT4geyAvLyBudWxsIGlzIHJldHVybmVkIGlmIGZvbGRpbmcgZ290IGRpc2FibGVkIGluIHRoZSBtZWFudGltZVxuXHRcdFx0aWYgKGZvbGRpbmdNb2RlbCkge1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb25zID0gdGhpcy5lZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdFx0XHRpZiAoc2VsZWN0aW9ucyAmJiBzZWxlY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRjb25zdCB0b1RvZ2dsZTogRm9sZGluZ1JlZ2lvbltdID0gW107XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2Ygc2VsZWN0aW9ucykge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHNlbGVjdGlvbi5zZWxlY3Rpb25TdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5oaWRkZW5SYW5nZU1vZGVsICYmIHRoaXMuaGlkZGVuUmFuZ2VNb2RlbC5pc0hpZGRlbihsaW5lTnVtYmVyKSkge1xuXHRcdFx0XHRcdFx0XHR0b1RvZ2dsZS5wdXNoKC4uLmZvbGRpbmdNb2RlbC5nZXRBbGxSZWdpb25zQXRMaW5lKGxpbmVOdW1iZXIsIHIgPT4gci5pc0NvbGxhcHNlZCAmJiBsaW5lTnVtYmVyID4gci5zdGFydExpbmVOdW1iZXIpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRvVG9nZ2xlLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Zm9sZGluZ01vZGVsLnRvZ2dsZUNvbGxhcHNlU3RhdGUodG9Ub2dnbGUpO1xuXHRcdFx0XHRcdFx0dGhpcy5yZXZlYWwoc2VsZWN0aW9uc1swXS5nZXRQb3NpdGlvbigpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KS50aGVuKHVuZGVmaW5lZCwgb25VbmV4cGVjdGVkRXJyb3IpO1xuXG5cdH1cblxuXHRwcml2YXRlIG9uRWRpdG9yTW91c2VEb3duKGU6IElFZGl0b3JNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5tb3VzZURvd25JbmZvID0gbnVsbDtcblxuXG5cdFx0aWYgKCF0aGlzLmhpZGRlblJhbmdlTW9kZWwgfHwgIWUudGFyZ2V0IHx8ICFlLnRhcmdldC5yYW5nZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIWUuZXZlbnQubGVmdEJ1dHRvbiAmJiAhZS5ldmVudC5taWRkbGVCdXR0b24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcmFuZ2UgPSBlLnRhcmdldC5yYW5nZTtcblx0XHRsZXQgaWNvbkNsaWNrZWQgPSBmYWxzZTtcblx0XHRzd2l0Y2ggKGUudGFyZ2V0LnR5cGUpIHtcblx0XHRcdGNhc2UgTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9MSU5FX0RFQ09SQVRJT05TOiB7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBlLnRhcmdldC5kZXRhaWw7XG5cdFx0XHRcdGNvbnN0IG9mZnNldExlZnRJbkd1dHRlciA9IGUudGFyZ2V0LmVsZW1lbnQhLm9mZnNldExlZnQ7XG5cdFx0XHRcdGNvbnN0IGd1dHRlck9mZnNldFggPSBkYXRhLm9mZnNldFggLSBvZmZzZXRMZWZ0SW5HdXR0ZXI7XG5cblx0XHRcdFx0Ly8gY29uc3QgZ3V0dGVyT2Zmc2V0WCA9IGRhdGEub2Zmc2V0WCAtIGRhdGEuZ2x5cGhNYXJnaW5XaWR0aCAtIGRhdGEubGluZU51bWJlcnNXaWR0aCAtIGRhdGEuZ2x5cGhNYXJnaW5MZWZ0O1xuXG5cdFx0XHRcdC8vIFRPRE9Aam9hbyBUT0RPQGFsZXggVE9ET0BtYXJ0aW4gdGhpcyBpcyBzdWNoIHRoYXQgd2UgZG9uJ3QgY29sbGlkZSB3aXRoIGRpcnR5IGRpZmZcblx0XHRcdFx0aWYgKGd1dHRlck9mZnNldFggPCA0KSB7IC8vIHRoZSB3aGl0ZXNwYWNlIGJldHdlZW4gdGhlIGJvcmRlciBhbmQgdGhlIHJlYWwgZm9sZGluZyBpY29uIGJvcmRlciBpcyA0cHhcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpY29uQ2xpY2tlZCA9IHRydWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9FTVBUWToge1xuXHRcdFx0XHRpZiAodGhpcy5fdW5mb2xkT25DbGlja0FmdGVyRW5kT2ZMaW5lICYmIHRoaXMuaGlkZGVuUmFuZ2VNb2RlbC5oYXNSYW5nZXMoKSkge1xuXHRcdFx0XHRcdGNvbnN0IGRhdGEgPSBlLnRhcmdldC5kZXRhaWw7XG5cdFx0XHRcdFx0aWYgKCFkYXRhLmlzQWZ0ZXJMaW5lcykge1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNhc2UgTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVEVYVDoge1xuXHRcdFx0XHRpZiAodGhpcy5oaWRkZW5SYW5nZU1vZGVsLmhhc1JhbmdlcygpKSB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0XHRcdGlmIChtb2RlbCAmJiByYW5nZS5zdGFydENvbHVtbiA9PT0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihyYW5nZS5zdGFydExpbmVOdW1iZXIpKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMubW91c2VEb3duSW5mbyA9IHsgbGluZU51bWJlcjogcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBpY29uQ2xpY2tlZCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBvbkVkaXRvck1vdXNlVXAoZTogSUVkaXRvck1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBmb2xkaW5nTW9kZWwgPSB0aGlzLmZvbGRpbmdNb2RlbDtcblx0XHRpZiAoIWZvbGRpbmdNb2RlbCB8fCAhdGhpcy5tb3VzZURvd25JbmZvIHx8ICFlLnRhcmdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBsaW5lTnVtYmVyID0gdGhpcy5tb3VzZURvd25JbmZvLmxpbmVOdW1iZXI7XG5cdFx0Y29uc3QgaWNvbkNsaWNrZWQgPSB0aGlzLm1vdXNlRG93bkluZm8uaWNvbkNsaWNrZWQ7XG5cblx0XHRjb25zdCByYW5nZSA9IGUudGFyZ2V0LnJhbmdlO1xuXHRcdGlmICghcmFuZ2UgfHwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICE9PSBsaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGljb25DbGlja2VkKSB7XG5cdFx0XHRpZiAoZS50YXJnZXQudHlwZSAhPT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9MSU5FX0RFQ09SQVRJT05TKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKCFtb2RlbCB8fCByYW5nZS5zdGFydENvbHVtbiAhPT0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVnaW9uID0gZm9sZGluZ01vZGVsLmdldFJlZ2lvbkF0TGluZShsaW5lTnVtYmVyKTtcblx0XHRpZiAocmVnaW9uICYmIHJlZ2lvbi5zdGFydExpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIpIHtcblx0XHRcdGNvbnN0IGlzQ29sbGFwc2VkID0gcmVnaW9uLmlzQ29sbGFwc2VkO1xuXHRcdFx0aWYgKGljb25DbGlja2VkIHx8IGlzQ29sbGFwc2VkKSB7XG5cdFx0XHRcdGNvbnN0IHN1cnJvdW5kaW5nID0gZS5ldmVudC5hbHRLZXk7XG5cdFx0XHRcdGxldCB0b1RvZ2dsZSA9IFtdO1xuXHRcdFx0XHRpZiAoc3Vycm91bmRpbmcpIHtcblx0XHRcdFx0XHRjb25zdCBmaWx0ZXIgPSAob3RoZXJSZWdpb246IEZvbGRpbmdSZWdpb24pID0+ICFvdGhlclJlZ2lvbi5jb250YWluZWRCeShyZWdpb24pICYmICFyZWdpb24uY29udGFpbmVkQnkob3RoZXJSZWdpb24pO1xuXHRcdFx0XHRcdGNvbnN0IHRvTWF5YmVUb2dnbGUgPSBmb2xkaW5nTW9kZWwuZ2V0UmVnaW9uc0luc2lkZShudWxsLCBmaWx0ZXIpO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgciBvZiB0b01heWJlVG9nZ2xlKSB7XG5cdFx0XHRcdFx0XHRpZiAoci5pc0NvbGxhcHNlZCkge1xuXHRcdFx0XHRcdFx0XHR0b1RvZ2dsZS5wdXNoKHIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBpZiBhbnkgc3Vycm91bmRpbmcgcmVnaW9ucyBhcmUgZm9sZGVkLCB1bmZvbGQgdGhvc2UuIE90aGVyd2lzZSwgZm9sZCBhbGwgc3Vycm91bmRpbmdcblx0XHRcdFx0XHRpZiAodG9Ub2dnbGUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHR0b1RvZ2dsZSA9IHRvTWF5YmVUb2dnbGU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHJlY3Vyc2l2ZSA9IGUuZXZlbnQubWlkZGxlQnV0dG9uIHx8IGUuZXZlbnQuc2hpZnRLZXk7XG5cdFx0XHRcdFx0aWYgKHJlY3Vyc2l2ZSkge1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCByIG9mIGZvbGRpbmdNb2RlbC5nZXRSZWdpb25zSW5zaWRlKHJlZ2lvbikpIHtcblx0XHRcdFx0XHRcdFx0aWYgKHIuaXNDb2xsYXBzZWQgPT09IGlzQ29sbGFwc2VkKSB7XG5cdFx0XHRcdFx0XHRcdFx0dG9Ub2dnbGUucHVzaChyKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyB3aGVuIHJlY3Vyc2l2ZSwgZmlyc3Qgb25seSBjb2xsYXBzZSBhbGwgY2hpbGRyZW4uIElmIGFsbCBhcmUgYWxyZWFkeSBmb2xkZWQgb3IgdGhlcmUgYXJlIG5vIGNoaWxkcmVuLCBhbHNvIGZvbGQgcGFyZW50LlxuXHRcdFx0XHRcdGlmIChpc0NvbGxhcHNlZCB8fCAhcmVjdXJzaXZlIHx8IHRvVG9nZ2xlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0dG9Ub2dnbGUucHVzaChyZWdpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRmb2xkaW5nTW9kZWwudG9nZ2xlQ29sbGFwc2VTdGF0ZSh0b1RvZ2dsZSk7XG5cdFx0XHRcdHRoaXMucmV2ZWFsKHsgbGluZU51bWJlciwgY29sdW1uOiAxIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZXZlYWwocG9zaXRpb246IElQb3NpdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yLnJldmVhbFBvc2l0aW9uSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChwb3NpdGlvbiwgU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSYW5nZXNMaW1pdFJlcG9ydGVyIGltcGxlbWVudHMgRm9sZGluZ0xpbWl0UmVwb3J0ZXIge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IpIHtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbGltaXQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yLmdldE9wdGlvbnMoKS5nZXQoRWRpdG9yT3B0aW9uLmZvbGRpbmdNYXhpbXVtUmVnaW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIF9jb21wdXRlZDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfbGltaXRlZDogbnVtYmVyIHwgZmFsc2UgPSBmYWxzZTtcblx0cHVibGljIGdldCBjb21wdXRlZCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9jb21wdXRlZDtcblx0fVxuXHRwdWJsaWMgZ2V0IGxpbWl0ZWQoKTogbnVtYmVyIHwgZmFsc2Uge1xuXHRcdHJldHVybiB0aGlzLl9saW1pdGVkO1xuXHR9XG5cdHB1YmxpYyB1cGRhdGUoY29tcHV0ZWQ6IG51bWJlciwgbGltaXRlZDogbnVtYmVyIHwgZmFsc2UpIHtcblx0XHRpZiAoY29tcHV0ZWQgIT09IHRoaXMuX2NvbXB1dGVkIHx8IGxpbWl0ZWQgIT09IHRoaXMuX2xpbWl0ZWQpIHtcblx0XHRcdHRoaXMuX2NvbXB1dGVkID0gY29tcHV0ZWQ7XG5cdFx0XHR0aGlzLl9saW1pdGVkID0gbGltaXRlZDtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHR9XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgRm9sZGluZ0FjdGlvbjxUPiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0YWJzdHJhY3QgaW52b2tlKGZvbGRpbmdDb250cm9sbGVyOiBGb2xkaW5nQ29udHJvbGxlciwgZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IFQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogdm9pZDtcblxuXHRwdWJsaWMgb3ZlcnJpZGUgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogVCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBmb2xkaW5nQ29udHJvbGxlciA9IEZvbGRpbmdDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmICghZm9sZGluZ0NvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZm9sZGluZ01vZGVsUHJvbWlzZSA9IGZvbGRpbmdDb250cm9sbGVyLmdldEZvbGRpbmdNb2RlbCgpO1xuXHRcdGlmIChmb2xkaW5nTW9kZWxQcm9taXNlKSB7XG5cdFx0XHR0aGlzLnJlcG9ydFRlbGVtZXRyeShhY2Nlc3NvciwgZWRpdG9yKTtcblx0XHRcdHJldHVybiBmb2xkaW5nTW9kZWxQcm9taXNlLnRoZW4oZm9sZGluZ01vZGVsID0+IHtcblx0XHRcdFx0aWYgKGZvbGRpbmdNb2RlbCkge1xuXHRcdFx0XHRcdHRoaXMuaW52b2tlKGZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWwsIGVkaXRvciwgYXJncywgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0XHRcdGlmIChzZWxlY3Rpb24pIHtcblx0XHRcdFx0XHRcdGZvbGRpbmdDb250cm9sbGVyLnJldmVhbChzZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBnZXRTZWxlY3RlZExpbmVzKGVkaXRvcjogSUNvZGVFZGl0b3IpIHtcblx0XHRjb25zdCBzZWxlY3Rpb25zID0gZWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRyZXR1cm4gc2VsZWN0aW9ucyA/IHNlbGVjdGlvbnMubWFwKHMgPT4gcy5zdGFydExpbmVOdW1iZXIpIDogW107XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0TGluZU51bWJlcnMoYXJnczogRm9sZGluZ0FyZ3VtZW50cywgZWRpdG9yOiBJQ29kZUVkaXRvcikge1xuXHRcdGlmIChhcmdzICYmIGFyZ3Muc2VsZWN0aW9uTGluZXMpIHtcblx0XHRcdHJldHVybiBhcmdzLnNlbGVjdGlvbkxpbmVzLm1hcChsID0+IGwgKyAxKTsgLy8gdG8gMC1iYXNlcyBsaW5lIG51bWJlcnNcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U2VsZWN0ZWRMaW5lcyhlZGl0b3IpO1xuXHR9XG5cblx0cHVibGljIHJ1bihfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF9lZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBTZWxlY3RlZExpbmVzIHtcblx0c3RhcnRzSW5zaWRlKHN0YXJ0TGluZTogbnVtYmVyLCBlbmRMaW5lOiBudW1iZXIpOiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9TZWxlY3RlZExpbmVzKHNlbGVjdGlvbnM6IFNlbGVjdGlvbltdIHwgbnVsbCk6IFNlbGVjdGVkTGluZXMge1xuXHRpZiAoIXNlbGVjdGlvbnMgfHwgc2VsZWN0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3RhcnRzSW5zaWRlOiAoKSA9PiBmYWxzZVxuXHRcdH07XG5cdH1cblx0cmV0dXJuIHtcblx0XHRzdGFydHNJbnNpZGUoc3RhcnRMaW5lOiBudW1iZXIsIGVuZExpbmU6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdFx0Zm9yIChjb25zdCBzIG9mIHNlbGVjdGlvbnMpIHtcblx0XHRcdFx0Y29uc3QgbGluZSA9IHMuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHRpZiAobGluZSA+PSBzdGFydExpbmUgJiYgbGluZSA8PSBlbmRMaW5lKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH07XG59XG5cbmludGVyZmFjZSBGb2xkaW5nQXJndW1lbnRzIHtcblx0bGV2ZWxzPzogbnVtYmVyO1xuXHRkaXJlY3Rpb24/OiAndXAnIHwgJ2Rvd24nO1xuXHRzZWxlY3Rpb25MaW5lcz86IG51bWJlcltdO1xufVxuXG5mdW5jdGlvbiBmb2xkaW5nQXJndW1lbnRzQ29uc3RyYWludChhcmdzOiBhbnkpIHtcblx0aWYgKCF0eXBlcy5pc1VuZGVmaW5lZChhcmdzKSkge1xuXHRcdGlmICghdHlwZXMuaXNPYmplY3QoYXJncykpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgZm9sZGluZ0FyZ3M6IEZvbGRpbmdBcmd1bWVudHMgPSBhcmdzO1xuXHRcdGlmICghdHlwZXMuaXNVbmRlZmluZWQoZm9sZGluZ0FyZ3MubGV2ZWxzKSAmJiAhdHlwZXMuaXNOdW1iZXIoZm9sZGluZ0FyZ3MubGV2ZWxzKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIXR5cGVzLmlzVW5kZWZpbmVkKGZvbGRpbmdBcmdzLmRpcmVjdGlvbikgJiYgIXR5cGVzLmlzU3RyaW5nKGZvbGRpbmdBcmdzLmRpcmVjdGlvbikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCF0eXBlcy5pc1VuZGVmaW5lZChmb2xkaW5nQXJncy5zZWxlY3Rpb25MaW5lcykgJiYgKCFBcnJheS5pc0FycmF5KGZvbGRpbmdBcmdzLnNlbGVjdGlvbkxpbmVzKSB8fCAhZm9sZGluZ0FyZ3Muc2VsZWN0aW9uTGluZXMuZXZlcnkodHlwZXMuaXNOdW1iZXIpKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuY2xhc3MgVW5mb2xkQWN0aW9uIGV4dGVuZHMgRm9sZGluZ0FjdGlvbjxGb2xkaW5nQXJndW1lbnRzPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IudW5mb2xkJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCd1bmZvbGRBY3Rpb24ubGFiZWwnLCBcIlVuZm9sZFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GT0xESU5HX0VOQUJMRUQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CcmFja2V0UmlnaHQsXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuQnJhY2tldFJpZ2h0XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICdVbmZvbGQgdGhlIGNvbnRlbnQgaW4gdGhlIGVkaXRvcicsXG5cdFx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAnVW5mb2xkIGVkaXRvciBhcmd1bWVudCcsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogYFByb3BlcnR5LXZhbHVlIHBhaXJzIHRoYXQgY2FuIGJlIHBhc3NlZCB0aHJvdWdoIHRoaXMgYXJndW1lbnQ6XG5cdFx0XHRcdFx0XHQqICdsZXZlbHMnOiBOdW1iZXIgb2YgbGV2ZWxzIHRvIHVuZm9sZC4gSWYgbm90IHNldCwgZGVmYXVsdHMgdG8gMS5cblx0XHRcdFx0XHRcdCogJ2RpcmVjdGlvbic6IElmICd1cCcsIHVuZm9sZCBnaXZlbiBudW1iZXIgb2YgbGV2ZWxzIHVwIG90aGVyd2lzZSB1bmZvbGRzIGRvd24uXG5cdFx0XHRcdFx0XHQqICdzZWxlY3Rpb25MaW5lcyc6IEFycmF5IG9mIHRoZSBzdGFydCBsaW5lcyAoMC1iYXNlZCkgb2YgdGhlIGVkaXRvciBzZWxlY3Rpb25zIHRvIGFwcGx5IHRoZSB1bmZvbGQgYWN0aW9uIHRvLiBJZiBub3Qgc2V0LCB0aGUgYWN0aXZlIHNlbGVjdGlvbihzKSB3aWxsIGJlIHVzZWQuXG5cdFx0XHRcdFx0XHRgLFxuXHRcdFx0XHRcdFx0Y29uc3RyYWludDogZm9sZGluZ0FyZ3VtZW50c0NvbnN0cmFpbnQsXG5cdFx0XHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0J2xldmVscyc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdFx0XHRcdFx0XHQnZGVmYXVsdCc6IDFcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdCdkaXJlY3Rpb24nOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0J2VudW0nOiBbJ3VwJywgJ2Rvd24nXSxcblx0XHRcdFx0XHRcdFx0XHRcdCdkZWZhdWx0JzogJ2Rvd24nXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0aW9uTGluZXMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRcdFx0XHQnaXRlbXMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ251bWJlcidcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogRm9sZGluZ0FyZ3VtZW50cyk6IHZvaWQge1xuXHRcdGNvbnN0IGxldmVscyA9IGFyZ3MgJiYgYXJncy5sZXZlbHMgfHwgMTtcblx0XHRjb25zdCBsaW5lTnVtYmVycyA9IHRoaXMuZ2V0TGluZU51bWJlcnMoYXJncywgZWRpdG9yKTtcblx0XHRpZiAoYXJncyAmJiBhcmdzLmRpcmVjdGlvbiA9PT0gJ3VwJykge1xuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUxldmVsc1VwKGZvbGRpbmdNb2RlbCwgZmFsc2UsIGxldmVscywgbGluZU51bWJlcnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93bihmb2xkaW5nTW9kZWwsIGZhbHNlLCBsZXZlbHMsIGxpbmVOdW1iZXJzKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgVW5Gb2xkUmVjdXJzaXZlbHlBY3Rpb24gZXh0ZW5kcyBGb2xkaW5nQWN0aW9uPHZvaWQ+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci51bmZvbGRSZWN1cnNpdmVseScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMigndW5Gb2xkUmVjdXJzaXZlbHlBY3Rpb24ubGFiZWwnLCBcIlVuZm9sZCBSZWN1cnNpdmVseVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GT0xESU5HX0VOQUJMRUQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQnJhY2tldFJpZ2h0KSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgX2FyZ3M6IGFueSk6IHZvaWQge1xuXHRcdHNldENvbGxhcHNlU3RhdGVMZXZlbHNEb3duKGZvbGRpbmdNb2RlbCwgZmFsc2UsIE51bWJlci5NQVhfVkFMVUUsIHRoaXMuZ2V0U2VsZWN0ZWRMaW5lcyhlZGl0b3IpKTtcblx0fVxufVxuXG5jbGFzcyBGb2xkQWN0aW9uIGV4dGVuZHMgRm9sZGluZ0FjdGlvbjxGb2xkaW5nQXJndW1lbnRzPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuZm9sZCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignZm9sZEFjdGlvbi5sYWJlbCcsIFwiRm9sZFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GT0xESU5HX0VOQUJMRUQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CcmFja2V0TGVmdCxcblx0XHRcdFx0bWFjOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5CcmFja2V0TGVmdFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnRm9sZCB0aGUgY29udGVudCBpbiB0aGUgZWRpdG9yJyxcblx0XHRcdFx0YXJnczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICdGb2xkIGVkaXRvciBhcmd1bWVudCcsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogYFByb3BlcnR5LXZhbHVlIHBhaXJzIHRoYXQgY2FuIGJlIHBhc3NlZCB0aHJvdWdoIHRoaXMgYXJndW1lbnQ6XG5cdFx0XHRcdFx0XHRcdCogJ2xldmVscyc6IE51bWJlciBvZiBsZXZlbHMgdG8gZm9sZC5cblx0XHRcdFx0XHRcdFx0KiAnZGlyZWN0aW9uJzogSWYgJ3VwJywgZm9sZHMgZ2l2ZW4gbnVtYmVyIG9mIGxldmVscyB1cCBvdGhlcndpc2UgZm9sZHMgZG93bi5cblx0XHRcdFx0XHRcdFx0KiAnc2VsZWN0aW9uTGluZXMnOiBBcnJheSBvZiB0aGUgc3RhcnQgbGluZXMgKDAtYmFzZWQpIG9mIHRoZSBlZGl0b3Igc2VsZWN0aW9ucyB0byBhcHBseSB0aGUgZm9sZCBhY3Rpb24gdG8uIElmIG5vdCBzZXQsIHRoZSBhY3RpdmUgc2VsZWN0aW9uKHMpIHdpbGwgYmUgdXNlZC5cblx0XHRcdFx0XHRcdFx0SWYgbm8gbGV2ZWxzIG9yIGRpcmVjdGlvbiBpcyBzZXQsIGZvbGRzIHRoZSByZWdpb24gYXQgdGhlIGxvY2F0aW9ucyBvciBpZiBhbHJlYWR5IGNvbGxhcHNlZCwgdGhlIGZpcnN0IHVuY29sbGFwc2VkIHBhcmVudCBpbnN0ZWFkLlxuXHRcdFx0XHRcdFx0YCxcblx0XHRcdFx0XHRcdGNvbnN0cmFpbnQ6IGZvbGRpbmdBcmd1bWVudHNDb25zdHJhaW50LFxuXHRcdFx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHRcdFx0XHRcdCdsZXZlbHMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdudW1iZXInLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0J2RpcmVjdGlvbic6IHtcblx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHQnZW51bSc6IFsndXAnLCAnZG93biddLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdGlvbkxpbmVzJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0XHRcdFx0J2l0ZW1zJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdudW1iZXInXG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRpbnZva2UoX2ZvbGRpbmdDb250cm9sbGVyOiBGb2xkaW5nQ29udHJvbGxlciwgZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IEZvbGRpbmdBcmd1bWVudHMpOiB2b2lkIHtcblx0XHRjb25zdCBsaW5lTnVtYmVycyA9IHRoaXMuZ2V0TGluZU51bWJlcnMoYXJncywgZWRpdG9yKTtcblxuXHRcdGNvbnN0IGxldmVscyA9IGFyZ3MgJiYgYXJncy5sZXZlbHM7XG5cdFx0Y29uc3QgZGlyZWN0aW9uID0gYXJncyAmJiBhcmdzLmRpcmVjdGlvbjtcblxuXHRcdGlmICh0eXBlb2YgbGV2ZWxzICE9PSAnbnVtYmVyJyAmJiB0eXBlb2YgZGlyZWN0aW9uICE9PSAnc3RyaW5nJykge1xuXHRcdFx0Ly8gZm9sZCB0aGUgcmVnaW9uIGF0IHRoZSBsb2NhdGlvbiBvciBpZiBhbHJlYWR5IGNvbGxhcHNlZCwgdGhlIGZpcnN0IHVuY29sbGFwc2VkIHBhcmVudCBpbnN0ZWFkLlxuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZVVwKGZvbGRpbmdNb2RlbCwgdHJ1ZSwgbGluZU51bWJlcnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoZGlyZWN0aW9uID09PSAndXAnKSB7XG5cdFx0XHRcdHNldENvbGxhcHNlU3RhdGVMZXZlbHNVcChmb2xkaW5nTW9kZWwsIHRydWUsIGxldmVscyB8fCAxLCBsaW5lTnVtYmVycyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZXRDb2xsYXBzZVN0YXRlTGV2ZWxzRG93bihmb2xkaW5nTW9kZWwsIHRydWUsIGxldmVscyB8fCAxLCBsaW5lTnVtYmVycyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cblxuY2xhc3MgVG9nZ2xlRm9sZEFjdGlvbiBleHRlbmRzIEZvbGRpbmdBY3Rpb248dm9pZD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLnRvZ2dsZUZvbGQnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ3RvZ2dsZUZvbGRBY3Rpb24ubGFiZWwnLCBcIlRvZ2dsZSBGb2xkXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZPTERJTkdfRU5BQkxFRCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlMKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGVkTGluZXMgPSB0aGlzLmdldFNlbGVjdGVkTGluZXMoZWRpdG9yKTtcblx0XHR0b2dnbGVDb2xsYXBzZVN0YXRlKGZvbGRpbmdNb2RlbCwgMSwgc2VsZWN0ZWRMaW5lcyk7XG5cdH1cbn1cblxuXG5jbGFzcyBGb2xkUmVjdXJzaXZlbHlBY3Rpb24gZXh0ZW5kcyBGb2xkaW5nQWN0aW9uPHZvaWQ+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5mb2xkUmVjdXJzaXZlbHknLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2ZvbGRSZWN1cnNpdmVseUFjdGlvbi5sYWJlbCcsIFwiRm9sZCBSZWN1cnNpdmVseVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GT0xESU5HX0VOQUJMRUQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQnJhY2tldExlZnQpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0aW52b2tlKF9mb2xkaW5nQ29udHJvbGxlcjogRm9sZGluZ0NvbnRyb2xsZXIsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2VsZWN0ZWRMaW5lcyA9IHRoaXMuZ2V0U2VsZWN0ZWRMaW5lcyhlZGl0b3IpO1xuXHRcdHNldENvbGxhcHNlU3RhdGVMZXZlbHNEb3duKGZvbGRpbmdNb2RlbCwgdHJ1ZSwgTnVtYmVyLk1BWF9WQUxVRSwgc2VsZWN0ZWRMaW5lcyk7XG5cdH1cbn1cblxuXG5jbGFzcyBUb2dnbGVGb2xkUmVjdXJzaXZlbHlBY3Rpb24gZXh0ZW5kcyBGb2xkaW5nQWN0aW9uPHZvaWQ+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci50b2dnbGVGb2xkUmVjdXJzaXZlbHknLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ3RvZ2dsZUZvbGRSZWN1cnNpdmVseUFjdGlvbi5sYWJlbCcsIFwiVG9nZ2xlIEZvbGQgUmVjdXJzaXZlbHlcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfRk9MRElOR19FTkFCTEVELFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUwpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0aW52b2tlKF9mb2xkaW5nQ29udHJvbGxlcjogRm9sZGluZ0NvbnRyb2xsZXIsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2VsZWN0ZWRMaW5lcyA9IHRoaXMuZ2V0U2VsZWN0ZWRMaW5lcyhlZGl0b3IpO1xuXHRcdHRvZ2dsZUNvbGxhcHNlU3RhdGUoZm9sZGluZ01vZGVsLCBOdW1iZXIuTUFYX1ZBTFVFLCBzZWxlY3RlZExpbmVzKTtcblx0fVxufVxuXG5cbmNsYXNzIEZvbGRBbGxCbG9ja0NvbW1lbnRzQWN0aW9uIGV4dGVuZHMgRm9sZGluZ0FjdGlvbjx2b2lkPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuZm9sZEFsbEJsb2NrQ29tbWVudHMnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2ZvbGRBbGxCbG9ja0NvbW1lbnRzLmxhYmVsJywgXCJGb2xkIEFsbCBCbG9jayBDb21tZW50c1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GT0xESU5HX0VOQUJMRUQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2xhc2gpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0aW52b2tlKF9mb2xkaW5nQ29udHJvbGxlcjogRm9sZGluZ0NvbnRyb2xsZXIsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiB2b2lkLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk6IHZvaWQge1xuXHRcdGlmIChmb2xkaW5nTW9kZWwucmVnaW9ucy5oYXNUeXBlcygpKSB7XG5cdFx0XHRzZXRDb2xsYXBzZVN0YXRlRm9yVHlwZShmb2xkaW5nTW9kZWwsIEZvbGRpbmdSYW5nZUtpbmQuQ29tbWVudC52YWx1ZSwgdHJ1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGVkaXRvck1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAoIWVkaXRvck1vZGVsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNvbW1lbnRzID0gbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24oZWRpdG9yTW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpKS5jb21tZW50cztcblx0XHRcdGlmIChjb21tZW50cyAmJiBjb21tZW50cy5ibG9ja0NvbW1lbnRTdGFydFRva2VuKSB7XG5cdFx0XHRcdGNvbnN0IHJlZ0V4cCA9IG5ldyBSZWdFeHAoJ15cXFxccyonICsgZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyhjb21tZW50cy5ibG9ja0NvbW1lbnRTdGFydFRva2VuKSk7XG5cdFx0XHRcdHNldENvbGxhcHNlU3RhdGVGb3JNYXRjaGluZ0xpbmVzKGZvbGRpbmdNb2RlbCwgcmVnRXhwLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgRm9sZEFsbFJlZ2lvbnNBY3Rpb24gZXh0ZW5kcyBGb2xkaW5nQWN0aW9uPHZvaWQ+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5mb2xkQWxsTWFya2VyUmVnaW9ucycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignZm9sZEFsbE1hcmtlclJlZ2lvbnMubGFiZWwnLCBcIkZvbGQgQWxsIFJlZ2lvbnNcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfRk9MRElOR19FTkFCTEVELFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRpZ2l0OCksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRpbnZva2UoX2ZvbGRpbmdDb250cm9sbGVyOiBGb2xkaW5nQ29udHJvbGxlciwgZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IHZvaWQsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogdm9pZCB7XG5cdFx0aWYgKGZvbGRpbmdNb2RlbC5yZWdpb25zLmhhc1R5cGVzKCkpIHtcblx0XHRcdHNldENvbGxhcHNlU3RhdGVGb3JUeXBlKGZvbGRpbmdNb2RlbCwgRm9sZGluZ1JhbmdlS2luZC5SZWdpb24udmFsdWUsIHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBlZGl0b3JNb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKCFlZGl0b3JNb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmb2xkaW5nUnVsZXMgPSBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihlZGl0b3JNb2RlbC5nZXRMYW5ndWFnZUlkKCkpLmZvbGRpbmdSdWxlcztcblx0XHRcdGlmIChmb2xkaW5nUnVsZXMgJiYgZm9sZGluZ1J1bGVzLm1hcmtlcnMgJiYgZm9sZGluZ1J1bGVzLm1hcmtlcnMuc3RhcnQpIHtcblx0XHRcdFx0Y29uc3QgcmVnRXhwID0gbmV3IFJlZ0V4cChmb2xkaW5nUnVsZXMubWFya2Vycy5zdGFydCk7XG5cdFx0XHRcdHNldENvbGxhcHNlU3RhdGVGb3JNYXRjaGluZ0xpbmVzKGZvbGRpbmdNb2RlbCwgcmVnRXhwLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgVW5mb2xkQWxsUmVnaW9uc0FjdGlvbiBleHRlbmRzIEZvbGRpbmdBY3Rpb248dm9pZD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLnVuZm9sZEFsbE1hcmtlclJlZ2lvbnMnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ3VuZm9sZEFsbE1hcmtlclJlZ2lvbnMubGFiZWwnLCBcIlVuZm9sZCBBbGwgUmVnaW9uc1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GT0xESU5HX0VOQUJMRUQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRGlnaXQ5KSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogdm9pZCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpOiB2b2lkIHtcblx0XHRpZiAoZm9sZGluZ01vZGVsLnJlZ2lvbnMuaGFzVHlwZXMoKSkge1xuXHRcdFx0c2V0Q29sbGFwc2VTdGF0ZUZvclR5cGUoZm9sZGluZ01vZGVsLCBGb2xkaW5nUmFuZ2VLaW5kLlJlZ2lvbi52YWx1ZSwgZmFsc2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBlZGl0b3JNb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKCFlZGl0b3JNb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmb2xkaW5nUnVsZXMgPSBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihlZGl0b3JNb2RlbC5nZXRMYW5ndWFnZUlkKCkpLmZvbGRpbmdSdWxlcztcblx0XHRcdGlmIChmb2xkaW5nUnVsZXMgJiYgZm9sZGluZ1J1bGVzLm1hcmtlcnMgJiYgZm9sZGluZ1J1bGVzLm1hcmtlcnMuc3RhcnQpIHtcblx0XHRcdFx0Y29uc3QgcmVnRXhwID0gbmV3IFJlZ0V4cChmb2xkaW5nUnVsZXMubWFya2Vycy5zdGFydCk7XG5cdFx0XHRcdHNldENvbGxhcHNlU3RhdGVGb3JNYXRjaGluZ0xpbmVzKGZvbGRpbmdNb2RlbCwgcmVnRXhwLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIEZvbGRBbGxFeGNlcHRBY3Rpb24gZXh0ZW5kcyBGb2xkaW5nQWN0aW9uPHZvaWQ+IHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5mb2xkQWxsRXhjZXB0Jyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdmb2xkQWxsRXhjZXB0LmxhYmVsJywgXCJGb2xkIEFsbCBFeGNlcHQgU2VsZWN0ZWRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfRk9MRElOR19FTkFCTEVELFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLk1pbnVzKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGVkTGluZXMgPSB0aGlzLmdldFNlbGVjdGVkTGluZXMoZWRpdG9yKTtcblx0XHRzZXRDb2xsYXBzZVN0YXRlRm9yUmVzdChmb2xkaW5nTW9kZWwsIHRydWUsIHNlbGVjdGVkTGluZXMpO1xuXHR9XG5cbn1cblxuY2xhc3MgVW5mb2xkQWxsRXhjZXB0QWN0aW9uIGV4dGVuZHMgRm9sZGluZ0FjdGlvbjx2b2lkPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IudW5mb2xkQWxsRXhjZXB0Jyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCd1bmZvbGRBbGxFeGNlcHQubGFiZWwnLCBcIlVuZm9sZCBBbGwgRXhjZXB0IFNlbGVjdGVkXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZPTERJTkdfRU5BQkxFRCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FcXVhbCksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRpbnZva2UoX2ZvbGRpbmdDb250cm9sbGVyOiBGb2xkaW5nQ29udHJvbGxlciwgZm9sZGluZ01vZGVsOiBGb2xkaW5nTW9kZWwsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBzZWxlY3RlZExpbmVzID0gdGhpcy5nZXRTZWxlY3RlZExpbmVzKGVkaXRvcik7XG5cdFx0c2V0Q29sbGFwc2VTdGF0ZUZvclJlc3QoZm9sZGluZ01vZGVsLCBmYWxzZSwgc2VsZWN0ZWRMaW5lcyk7XG5cdH1cbn1cblxuY2xhc3MgRm9sZEFsbEFjdGlvbiBleHRlbmRzIEZvbGRpbmdBY3Rpb248dm9pZD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmZvbGRBbGwnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2ZvbGRBbGxBY3Rpb24ubGFiZWwnLCBcIkZvbGQgQWxsXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZPTERJTkdfRU5BQkxFRCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5EaWdpdDApLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0aW52b2tlKF9mb2xkaW5nQ29udHJvbGxlcjogRm9sZGluZ0NvbnRyb2xsZXIsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsLCBfZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdHNldENvbGxhcHNlU3RhdGVMZXZlbHNEb3duKGZvbGRpbmdNb2RlbCwgdHJ1ZSk7XG5cdH1cbn1cblxuY2xhc3MgVW5mb2xkQWxsQWN0aW9uIGV4dGVuZHMgRm9sZGluZ0FjdGlvbjx2b2lkPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IudW5mb2xkQWxsJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCd1bmZvbGRBbGxBY3Rpb24ubGFiZWwnLCBcIlVuZm9sZCBBbGxcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfRk9MRElOR19FTkFCTEVELFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUopLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0aW52b2tlKF9mb2xkaW5nQ29udHJvbGxlcjogRm9sZGluZ0NvbnRyb2xsZXIsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsLCBfZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdHNldENvbGxhcHNlU3RhdGVMZXZlbHNEb3duKGZvbGRpbmdNb2RlbCwgZmFsc2UpO1xuXHR9XG59XG5cbmNsYXNzIEZvbGRMZXZlbEFjdGlvbiBleHRlbmRzIEZvbGRpbmdBY3Rpb248dm9pZD4ge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBJRF9QUkVGSVggPSAnZWRpdG9yLmZvbGRMZXZlbCc7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAobGV2ZWw6IG51bWJlcikgPT4gRm9sZExldmVsQWN0aW9uLklEX1BSRUZJWCArIGxldmVsO1xuXG5cdHByaXZhdGUgZ2V0Rm9sZGluZ0xldmVsKCkge1xuXHRcdHJldHVybiBwYXJzZUludCh0aGlzLmlkLnN1YnN0cihGb2xkTGV2ZWxBY3Rpb24uSURfUFJFRklYLmxlbmd0aCkpO1xuXHR9XG5cblx0aW52b2tlKF9mb2xkaW5nQ29udHJvbGxlcjogRm9sZGluZ0NvbnRyb2xsZXIsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0c2V0Q29sbGFwc2VTdGF0ZUF0TGV2ZWwoZm9sZGluZ01vZGVsLCB0aGlzLmdldEZvbGRpbmdMZXZlbCgpLCB0cnVlLCB0aGlzLmdldFNlbGVjdGVkTGluZXMoZWRpdG9yKSk7XG5cdH1cbn1cblxuLyoqIEFjdGlvbiB0byBnbyB0byB0aGUgcGFyZW50IGZvbGQgb2YgY3VycmVudCBsaW5lICovXG5jbGFzcyBHb3RvUGFyZW50Rm9sZEFjdGlvbiBleHRlbmRzIEZvbGRpbmdBY3Rpb248dm9pZD4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5nb3RvUGFyZW50Rm9sZCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignZ290b1BhcmVudEZvbGQubGFiZWwnLCBcIkdvIHRvIFBhcmVudCBGb2xkXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZPTERJTkdfRU5BQkxFRCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGVkTGluZXMgPSB0aGlzLmdldFNlbGVjdGVkTGluZXMoZWRpdG9yKTtcblx0XHRpZiAoc2VsZWN0ZWRMaW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBzdGFydExpbmVOdW1iZXIgPSBnZXRQYXJlbnRGb2xkTGluZShzZWxlY3RlZExpbmVzWzBdLCBmb2xkaW5nTW9kZWwpO1xuXHRcdFx0aWYgKHN0YXJ0TGluZU51bWJlciAhPT0gbnVsbCkge1xuXHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKHtcblx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IHN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBzdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0ZW5kQ29sdW1uOiAxXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG4vKiogQWN0aW9uIHRvIGdvIHRvIHRoZSBwcmV2aW91cyBmb2xkIG9mIGN1cnJlbnQgbGluZSAqL1xuY2xhc3MgR290b1ByZXZpb3VzRm9sZEFjdGlvbiBleHRlbmRzIEZvbGRpbmdBY3Rpb248dm9pZD4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5nb3RvUHJldmlvdXNGb2xkJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdnb3RvUHJldmlvdXNGb2xkLmxhYmVsJywgXCJHbyB0byBQcmV2aW91cyBGb2xkaW5nIFJhbmdlXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZPTERJTkdfRU5BQkxFRCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGVkTGluZXMgPSB0aGlzLmdldFNlbGVjdGVkTGluZXMoZWRpdG9yKTtcblx0XHRpZiAoc2VsZWN0ZWRMaW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBzdGFydExpbmVOdW1iZXIgPSBnZXRQcmV2aW91c0ZvbGRMaW5lKHNlbGVjdGVkTGluZXNbMF0sIGZvbGRpbmdNb2RlbCk7XG5cdFx0XHRpZiAoc3RhcnRMaW5lTnVtYmVyICE9PSBudWxsKSB7XG5cdFx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24oe1xuXHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRlbmRDb2x1bW46IDFcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbi8qKiBBY3Rpb24gdG8gZ28gdG8gdGhlIG5leHQgZm9sZCBvZiBjdXJyZW50IGxpbmUgKi9cbmNsYXNzIEdvdG9OZXh0Rm9sZEFjdGlvbiBleHRlbmRzIEZvbGRpbmdBY3Rpb248dm9pZD4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5nb3RvTmV4dEZvbGQnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2dvdG9OZXh0Rm9sZC5sYWJlbCcsIFwiR28gdG8gTmV4dCBGb2xkaW5nIFJhbmdlXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZPTERJTkdfRU5BQkxFRCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGVkTGluZXMgPSB0aGlzLmdldFNlbGVjdGVkTGluZXMoZWRpdG9yKTtcblx0XHRpZiAoc2VsZWN0ZWRMaW5lcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBzdGFydExpbmVOdW1iZXIgPSBnZXROZXh0Rm9sZExpbmUoc2VsZWN0ZWRMaW5lc1swXSwgZm9sZGluZ01vZGVsKTtcblx0XHRcdGlmIChzdGFydExpbmVOdW1iZXIgIT09IG51bGwpIHtcblx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbih7XG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdGVuZENvbHVtbjogMVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgRm9sZFJhbmdlRnJvbVNlbGVjdGlvbkFjdGlvbiBleHRlbmRzIEZvbGRpbmdBY3Rpb248dm9pZD4ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmNyZWF0ZUZvbGRpbmdSYW5nZUZyb21TZWxlY3Rpb24nLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2NyZWF0ZU1hbnVhbEZvbGRSYW5nZS5sYWJlbCcsIFwiQ3JlYXRlIEZvbGRpbmcgUmFuZ2UgZnJvbSBTZWxlY3Rpb25cIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfRk9MRElOR19FTkFCTEVELFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkNvbW1hKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShfZm9sZGluZ0NvbnRyb2xsZXI6IEZvbGRpbmdDb250cm9sbGVyLCBmb2xkaW5nTW9kZWw6IEZvbGRpbmdNb2RlbCwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbGxhcHNlUmFuZ2VzOiBGb2xkUmFuZ2VbXSA9IFtdO1xuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGlmIChzZWxlY3Rpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBzZWxlY3Rpb25zKSB7XG5cdFx0XHRcdGxldCBlbmRMaW5lTnVtYmVyID0gc2VsZWN0aW9uLmVuZExpbmVOdW1iZXI7XG5cdFx0XHRcdGlmIChzZWxlY3Rpb24uZW5kQ29sdW1uID09PSAxKSB7XG5cdFx0XHRcdFx0LS1lbmRMaW5lTnVtYmVyO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlbmRMaW5lTnVtYmVyID4gc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdGNvbGxhcHNlUmFuZ2VzLnB1c2goe1xuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHRcdHR5cGU6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGlzQ29sbGFwc2VkOiB0cnVlLFxuXHRcdFx0XHRcdFx0c291cmNlOiBGb2xkU291cmNlLnVzZXJEZWZpbmVkXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbih7XG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IDFcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGNvbGxhcHNlUmFuZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29sbGFwc2VSYW5nZXMuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBhLnN0YXJ0TGluZU51bWJlciAtIGIuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29uc3QgbmV3UmFuZ2VzID0gRm9sZGluZ1JlZ2lvbnMuc2FuaXRpemVBbmRNZXJnZShmb2xkaW5nTW9kZWwucmVnaW9ucywgY29sbGFwc2VSYW5nZXMsIGVkaXRvci5nZXRNb2RlbCgpPy5nZXRMaW5lQ291bnQoKSk7XG5cdFx0XHRcdGZvbGRpbmdNb2RlbC51cGRhdGVQb3N0KEZvbGRpbmdSZWdpb25zLmZyb21Gb2xkUmFuZ2VzKG5ld1JhbmdlcykpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBSZW1vdmVGb2xkUmFuZ2VGcm9tU2VsZWN0aW9uQWN0aW9uIGV4dGVuZHMgRm9sZGluZ0FjdGlvbjx2b2lkPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IucmVtb3ZlTWFudWFsRm9sZGluZ1JhbmdlcycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMigncmVtb3ZlTWFudWFsRm9sZGluZ1Jhbmdlcy5sYWJlbCcsIFwiUmVtb3ZlIE1hbnVhbCBGb2xkaW5nIFJhbmdlc1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9GT0xESU5HX0VOQUJMRUQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuUGVyaW9kKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGludm9rZShmb2xkaW5nQ29udHJvbGxlcjogRm9sZGluZ0NvbnRyb2xsZXIsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0aWYgKHNlbGVjdGlvbnMpIHtcblx0XHRcdGNvbnN0IHJhbmdlczogSUxpbmVSYW5nZVtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHNlbGVjdGlvbiBvZiBzZWxlY3Rpb25zKSB7XG5cdFx0XHRcdGNvbnN0IHsgc3RhcnRMaW5lTnVtYmVyLCBlbmRMaW5lTnVtYmVyIH0gPSBzZWxlY3Rpb247XG5cdFx0XHRcdHJhbmdlcy5wdXNoKGVuZExpbmVOdW1iZXIgPj0gc3RhcnRMaW5lTnVtYmVyID8geyBzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXIgfSA6IHsgZW5kTGluZU51bWJlciwgc3RhcnRMaW5lTnVtYmVyIH0pO1xuXHRcdFx0fVxuXHRcdFx0Zm9sZGluZ01vZGVsLnJlbW92ZU1hbnVhbFJhbmdlcyhyYW5nZXMpO1xuXHRcdFx0Zm9sZGluZ0NvbnRyb2xsZXIudHJpZ2dlckZvbGRpbmdNb2RlbENoYW5nZWQoKTtcblx0XHR9XG5cdH1cbn1cblxuXG5jbGFzcyBUb2dnbGVJbXBvcnRGb2xkQWN0aW9uIGV4dGVuZHMgRm9sZGluZ0FjdGlvbjx2b2lkPiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IudG9nZ2xlSW1wb3J0Rm9sZCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMigndG9nZ2xlSW1wb3J0Rm9sZC5sYWJlbCcsIFwiVG9nZ2xlIEltcG9ydCBGb2xkXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZPTERJTkdfRU5BQkxFRCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGludm9rZShmb2xkaW5nQ29udHJvbGxlcjogRm9sZGluZ0NvbnRyb2xsZXIsIGZvbGRpbmdNb2RlbDogRm9sZGluZ01vZGVsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVnaW9uc1RvVG9nZ2xlOiBGb2xkaW5nUmVnaW9uW10gPSBbXTtcblx0XHRjb25zdCByZWdpb25zID0gZm9sZGluZ01vZGVsLnJlZ2lvbnM7XG5cdFx0Zm9yIChsZXQgaSA9IHJlZ2lvbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdGlmIChyZWdpb25zLmdldFR5cGUoaSkgPT09IEZvbGRpbmdSYW5nZUtpbmQuSW1wb3J0cy52YWx1ZSkge1xuXHRcdFx0XHRyZWdpb25zVG9Ub2dnbGUucHVzaChyZWdpb25zLnRvUmVnaW9uKGkpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Zm9sZGluZ01vZGVsLnRvZ2dsZUNvbGxhcHNlU3RhdGUocmVnaW9uc1RvVG9nZ2xlKTtcblx0XHRmb2xkaW5nQ29udHJvbGxlci50cmlnZ2VyRm9sZGluZ01vZGVsQ2hhbmdlZCgpO1xuXHR9XG59XG5cblxucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oRm9sZGluZ0NvbnRyb2xsZXIuSUQsIEZvbGRpbmdDb250cm9sbGVyLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkVhZ2VyKTsgLy8gZWFnZXIgYmVjYXVzZSBpdCB1c2VzIGBzYXZlVmlld1N0YXRlYC9gcmVzdG9yZVZpZXdTdGF0ZWBcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFVuZm9sZEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihVbkZvbGRSZWN1cnNpdmVseUFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihGb2xkQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEZvbGRSZWN1cnNpdmVseUFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihUb2dnbGVGb2xkUmVjdXJzaXZlbHlBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oRm9sZEFsbEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihVbmZvbGRBbGxBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oRm9sZEFsbEJsb2NrQ29tbWVudHNBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oRm9sZEFsbFJlZ2lvbnNBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oVW5mb2xkQWxsUmVnaW9uc0FjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihGb2xkQWxsRXhjZXB0QWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKFVuZm9sZEFsbEV4Y2VwdEFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihUb2dnbGVGb2xkQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEdvdG9QYXJlbnRGb2xkQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEdvdG9QcmV2aW91c0ZvbGRBY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oR290b05leHRGb2xkQWN0aW9uKTtcbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEZvbGRSYW5nZUZyb21TZWxlY3Rpb25BY3Rpb24pO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oUmVtb3ZlRm9sZFJhbmdlRnJvbVNlbGVjdGlvbkFjdGlvbik7XG5yZWdpc3RlckVkaXRvckFjdGlvbihUb2dnbGVJbXBvcnRGb2xkQWN0aW9uKTtcblxuZm9yIChsZXQgaSA9IDE7IGkgPD0gNzsgaSsrKSB7XG5cdHJlZ2lzdGVySW5zdGFudGlhdGVkRWRpdG9yQWN0aW9uKFxuXHRcdG5ldyBGb2xkTGV2ZWxBY3Rpb24oe1xuXHRcdFx0aWQ6IEZvbGRMZXZlbEFjdGlvbi5JRChpKSxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdmb2xkTGV2ZWxBY3Rpb24ubGFiZWwnLCBcIkZvbGQgTGV2ZWwgezB9XCIsIGkpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0ZPTERJTkdfRU5BQkxFRCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgKEtleUNvZGUuRGlnaXQwICsgaSkpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pXG5cdCk7XG59XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdfZXhlY3V0ZUZvbGRpbmdSYW5nZVByb3ZpZGVyJywgYXN5bmMgZnVuY3Rpb24gKGFjY2Vzc29yLCAuLi5hcmdzKSB7XG5cdGNvbnN0IFtyZXNvdXJjZV0gPSBhcmdzO1xuXHRpZiAoIShyZXNvdXJjZSBpbnN0YW5jZW9mIFVSSSkpIHtcblx0XHR0aHJvdyBpbGxlZ2FsQXJndW1lbnQoKTtcblx0fVxuXG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cblx0Y29uc3QgbW9kZWwgPSBhY2Nlc3Nvci5nZXQoSU1vZGVsU2VydmljZSkuZ2V0TW9kZWwocmVzb3VyY2UpO1xuXHRpZiAoIW1vZGVsKSB7XG5cdFx0dGhyb3cgaWxsZWdhbEFyZ3VtZW50KCk7XG5cdH1cblxuXHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRpZiAoIWNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3IuZm9sZGluZycsIHsgcmVzb3VyY2UgfSkpIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRjb25zdCBzdHJhdGVneSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3IuZm9sZGluZ1N0cmF0ZWd5JywgeyByZXNvdXJjZSB9KTtcblx0Y29uc3QgZm9sZGluZ0xpbWl0UmVwb3J0ZXIgPSB7XG5cdFx0Z2V0IGxpbWl0KCkge1xuXHRcdFx0cmV0dXJuIDxudW1iZXI+Y29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2VkaXRvci5mb2xkaW5nTWF4aW11bVJlZ2lvbnMnLCB7IHJlc291cmNlIH0pO1xuXHRcdH0sXG5cdFx0dXBkYXRlOiAoY29tcHV0ZWQ6IG51bWJlciwgbGltaXRlZDogbnVtYmVyIHwgZmFsc2UpID0+IHsgfVxuXHR9O1xuXG5cdGNvbnN0IGluZGVudFJhbmdlUHJvdmlkZXIgPSBuZXcgSW5kZW50UmFuZ2VQcm92aWRlcihtb2RlbCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgZm9sZGluZ0xpbWl0UmVwb3J0ZXIpO1xuXHRsZXQgcmFuZ2VQcm92aWRlcjogUmFuZ2VQcm92aWRlciA9IGluZGVudFJhbmdlUHJvdmlkZXI7XG5cdGlmIChzdHJhdGVneSAhPT0gJ2luZGVudGF0aW9uJykge1xuXHRcdGNvbnN0IHByb3ZpZGVycyA9IEZvbGRpbmdDb250cm9sbGVyLmdldEZvbGRpbmdSYW5nZVByb3ZpZGVycyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbW9kZWwpO1xuXHRcdGlmIChwcm92aWRlcnMubGVuZ3RoKSB7XG5cdFx0XHRyYW5nZVByb3ZpZGVyID0gbmV3IFN5bnRheFJhbmdlUHJvdmlkZXIobW9kZWwsIHByb3ZpZGVycywgKCkgPT4geyB9LCBmb2xkaW5nTGltaXRSZXBvcnRlciwgaW5kZW50UmFuZ2VQcm92aWRlcik7XG5cdFx0fVxuXHR9XG5cdGNvbnN0IHJhbmdlcyA9IGF3YWl0IHJhbmdlUHJvdmlkZXIuY29tcHV0ZShDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0Y29uc3QgcmVzdWx0OiBGb2xkaW5nUmFuZ2VbXSA9IFtdO1xuXHR0cnkge1xuXHRcdGlmIChyYW5nZXMpIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcmFuZ2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IHR5cGUgPSByYW5nZXMuZ2V0VHlwZShpKTtcblx0XHRcdFx0cmVzdWx0LnB1c2goeyBzdGFydDogcmFuZ2VzLmdldFN0YXJ0TGluZU51bWJlcihpKSwgZW5kOiByYW5nZXMuZ2V0RW5kTGluZU51bWJlcihpKSwga2luZDogdHlwZSA/IEZvbGRpbmdSYW5nZUtpbmQuZnJvbVZhbHVlKHR5cGUpIDogdW5kZWZpbmVkIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9IGZpbmFsbHkge1xuXHRcdHJhbmdlUHJvdmlkZXIuZGlzcG9zZSgpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBNEIseUJBQXlCLFNBQVMsd0JBQXdCO0FBQ3RG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QUFpQixnQkFBZ0IsZ0NBQWdDLGVBQWdCLGFBQWEsTUFBTTtBQUNuRyxRQUFNLENBQUMsUUFBUSxJQUFJO0FBQ25CLE1BQUksRUFBRSxvQkFBb0IsTUFBTTtBQUMvQixVQUFNLGdCQUFnQjtBQUFBLEVBQ3ZCO0FBRUEsUUFBTSwwQkFBMEIsU0FBUyxJQUFJLHdCQUF3QjtBQUVyRSxRQUFNLFFBQVEsU0FBUyxJQUFJLGFBQWEsRUFBRSxTQUFTLFFBQVE7QUFDM0QsTUFBSSxDQUFDLE9BQU87QUFDWCxVQUFNLGdCQUFnQjtBQUFBLEVBQ3ZCO0FBRUEsUUFBTSx1QkFBdUIsU0FBUyxJQUFJLHFCQUFxQjtBQUMvRCxNQUFJLENBQUMscUJBQXFCLFNBQVMsa0JBQWtCLEVBQUUsU0FBUyxDQUFDLEdBQUc7QUFDbkUsV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUVBLFFBQU0sK0JBQStCLFNBQVMsSUFBSSw2QkFBNkI7QUFFL0UsUUFBTSxXQUFXLHFCQUFxQixTQUFTLDBCQUEwQixFQUFFLFNBQVMsQ0FBQztBQUNyRixRQUFNLHVCQUF1QjtBQUFBLElBQzVCLElBQUksUUFBUTtBQUNYLGFBQWUscUJBQXFCLFNBQVMsZ0NBQWdDLEVBQUUsU0FBUyxDQUFDO0FBQUEsSUFDMUY7QUFBQSxJQUNBLFFBQVEsQ0FBQyxVQUFrQixZQUE0QjtBQUFBLElBQUU7QUFBQSxFQUMxRDtBQUVBLFFBQU0sc0JBQXNCLElBQUksb0JBQW9CLE9BQU8sOEJBQThCLG9CQUFvQjtBQUM3RyxNQUFJLGdCQUErQjtBQUNuQyxNQUFJLGFBQWEsZUFBZTtBQUMvQixVQUFNLFlBQVksa0JBQWtCLHlCQUF5Qix5QkFBeUIsS0FBSztBQUMzRixRQUFJLFVBQVUsUUFBUTtBQUNyQixzQkFBZ0IsSUFBSSxvQkFBb0IsT0FBTyxXQUFXLE1BQU07QUFBQSxNQUFFLEdBQUcsc0JBQXNCLG1CQUFtQjtBQUFBLElBQy9HO0FBQUEsRUFDRDtBQUNBLFFBQU0sU0FBUyxNQUFNLGNBQWMsUUFBUSxrQkFBa0IsSUFBSTtBQUNqRSxRQUFNLFNBQXlCLENBQUM7QUFDaEMsTUFBSTtBQUNILFFBQUksUUFBUTtBQUNYLGVBQVMsSUFBSSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7QUFDdkMsY0FBTSxPQUFPLE9BQU8sUUFBUSxDQUFDO0FBQzdCLGVBQU8sS0FBSyxFQUFFLE9BQU8sT0FBTyxtQkFBbUIsQ0FBQyxHQUFHLEtBQUssT0FBTyxpQkFBaUIsQ0FBQyxHQUFHLE1BQU0sT0FBTyxpQkFBaUIsVUFBVSxJQUFJLElBQUksT0FBVSxDQUFDO0FBQUEsTUFDaEo7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1IsVUFBRTtBQUNELGtCQUFjLFFBQVE7QUFBQSxFQUN2QjtBQUNELENBQUM7IiwKICAibmFtZXMiOiBbIm9wdGlvbnMiLCAiZm9sZGluZ01vZGVsIl0KfQo=
