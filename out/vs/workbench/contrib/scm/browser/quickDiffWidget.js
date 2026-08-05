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
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import * as domStylesheetsJs from "../../../../base/browser/domStylesheets.js";
import { Action, ActionRunner } from "../../../../base/common/actions.js";
import { Event } from "../../../../base/common/event.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { SelectActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { defaultSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { peekViewBorder, peekViewTitleBackground, peekViewTitleForeground, peekViewTitleInfoForeground, PeekViewWidget } from "../../../../editor/contrib/peekView/browser/peekView.js";
import { editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { IMenuService, MenuId, MenuItemAction, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { EditorAction, registerEditorAction } from "../../../../editor/browser/editorExtensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { EmbeddedDiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/embeddedDiffEditorWidget.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { IQuickDiffModelService } from "./quickDiffModel.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { rot } from "../../../../base/common/numbers.js";
import { ChangeType, getChangeHeight, getChangeType, getChangeTypeColor, getModifiedEndLineNumber, lineIntersectsChange } from "../common/quickDiff.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { TextCompareEditorActiveContext } from "../../../common/contextkeys.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { basename } from "../../../../base/common/resources.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { gotoNextLocation, gotoPreviousLocation } from "../../../../platform/theme/common/iconRegistry.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Color } from "../../../../base/common/color.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { getOuterEditor } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { quickDiffDecorationCount } from "./quickDiffDecorator.js";
const isQuickDiffVisible = new RawContextKey("dirtyDiffVisible", false);
let QuickDiffPickerViewItem = class extends SelectActionViewItem {
  constructor(action, providers, selected, contextViewService, themeService) {
    const items = providers.map((provider) => ({ provider, text: provider }));
    let startingSelection = providers.indexOf(selected);
    if (startingSelection === -1) {
      startingSelection = 0;
    }
    const styles = { ...defaultSelectBoxStyles };
    const theme = themeService.getColorTheme();
    const editorBackgroundColor = theme.getColor(editorBackground);
    const peekTitleColor = theme.getColor(peekViewTitleBackground);
    const opaqueTitleColor = peekTitleColor?.makeOpaque(editorBackgroundColor) ?? editorBackgroundColor;
    styles.selectBackground = opaqueTitleColor.lighten(0.6).toString();
    super(null, action, items, startingSelection, contextViewService, styles, { ariaLabel: nls.localize("remotes", "Switch quick diff base") });
    this.optionsItems = items;
  }
  setSelection(provider) {
    const index = this.optionsItems.findIndex((item) => item.provider === provider);
    this.select(index);
  }
  getActionContext(_, index) {
    return this.optionsItems[index];
  }
  render(container) {
    super.render(container);
    this.setFocusable(true);
  }
};
QuickDiffPickerViewItem = __decorateClass([
  __decorateParam(3, IContextViewService),
  __decorateParam(4, IThemeService)
], QuickDiffPickerViewItem);
const _QuickDiffPickerBaseAction = class _QuickDiffPickerBaseAction extends Action {
  constructor(callback) {
    super(_QuickDiffPickerBaseAction.ID, _QuickDiffPickerBaseAction.LABEL, void 0, void 0);
    this.callback = callback;
  }
  async run(event) {
    return this.callback(event);
  }
};
_QuickDiffPickerBaseAction.ID = "quickDiff.base.switch";
_QuickDiffPickerBaseAction.LABEL = nls.localize("quickDiff.base.switch", "Switch Quick Diff Base");
let QuickDiffPickerBaseAction = _QuickDiffPickerBaseAction;
class QuickDiffWidgetActionRunner extends ActionRunner {
  runAction(action, context) {
    if (action instanceof MenuItemAction) {
      return action.run(...context);
    }
    return super.runAction(action, context);
  }
}
let QuickDiffWidgetEditorAction = class extends Action {
  constructor(editor, action, cssClass, keybindingService, instantiationService) {
    const keybinding = keybindingService.lookupKeybinding(action.id);
    const label = action.label + (keybinding ? ` (${keybinding.getLabel()})` : "");
    super(action.id, label, cssClass);
    this.instantiationService = instantiationService;
    this.action = action;
    this.editor = editor;
  }
  run() {
    return Promise.resolve(this.instantiationService.invokeFunction((accessor) => this.action.run(accessor, this.editor, null)));
  }
};
QuickDiffWidgetEditorAction = __decorateClass([
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IInstantiationService)
], QuickDiffWidgetEditorAction);
let QuickDiffWidget = class extends PeekViewWidget {
  constructor(editor, model, themeService, instantiationService, menuService, contextKeyService) {
    super(editor, { isResizeable: true, frameWidth: 1, keepEditorSelection: true, className: "dirty-diff" }, instantiationService);
    this.model = model;
    this.themeService = themeService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this._index = 0;
    this._provider = "";
    this.height = void 0;
    this._disposables.add(themeService.onDidColorThemeChange(this._applyTheme, this));
    this._applyTheme(themeService.getColorTheme());
    if (!Iterable.isEmpty(this.model.originalTextModels)) {
      contextKeyService = contextKeyService.createOverlay([
        ["originalResourceScheme", Iterable.first(this.model.originalTextModels)?.uri.scheme],
        ["originalResourceSchemes", Iterable.map(this.model.originalTextModels, (textModel) => textModel.uri.scheme)]
      ]);
    }
    this.create();
    if (editor.hasModel()) {
      this.title = basename(editor.getModel().uri);
    } else {
      this.title = "";
    }
    this.setTitle(this.title);
  }
  get provider() {
    return this._provider;
  }
  get index() {
    return this._index;
  }
  get visibleRange() {
    const visibleRanges = this.diffEditor.getModifiedEditor().getVisibleRanges();
    return visibleRanges.length >= 0 ? visibleRanges[0] : void 0;
  }
  showChange(index, usePosition = true) {
    const labeledChange = this.model.changes[index];
    const change = labeledChange.change;
    this._index = index;
    this.contextKeyService.createKey("originalResourceScheme", this.model.changes[index].original.scheme);
    this.updateActions();
    this._provider = labeledChange.label;
    this.change = change;
    if (Iterable.isEmpty(this.model.originalTextModels)) {
      return;
    }
    const onFirstDiffUpdate = Event.once(this.diffEditor.onDidUpdateDiff);
    onFirstDiffUpdate(() => setTimeout(() => this.revealChange(change), 0));
    const diffEditorModel = this.model.getDiffEditorModel(labeledChange.original);
    if (!diffEditorModel) {
      return;
    }
    this.diffEditor.setModel(diffEditorModel);
    this.dropdown?.setSelection(labeledChange.label);
    const position = new Position(getModifiedEndLineNumber(change), 1);
    const lineHeight = this.editor.getOption(EditorOption.lineHeight);
    const editorHeight = this.editor.getLayoutInfo().height;
    const editorHeightInLines = Math.floor(editorHeight / lineHeight);
    const height = Math.min(getChangeHeight(change) + /* padding */
    8, Math.floor(editorHeightInLines / 3));
    this.renderTitle(labeledChange.label);
    const changeType = getChangeType(change);
    const changeTypeColor = getChangeTypeColor(this.themeService.getColorTheme(), changeType);
    this.style({ frameColor: changeTypeColor, arrowColor: changeTypeColor });
    const providerSpecificChanges = [];
    let contextIndex = index;
    for (const change2 of this.model.changes) {
      if (change2.label === this.model.changes[this._index].label) {
        providerSpecificChanges.push(change2.change);
        if (labeledChange === change2) {
          contextIndex = providerSpecificChanges.length - 1;
        }
      }
    }
    this._actionbarWidget.context = [diffEditorModel.modified.uri, providerSpecificChanges, contextIndex];
    if (usePosition) {
      this.show(position, height);
      this.editor.setPosition(position);
      this.editor.focus();
    }
  }
  renderTitle(label) {
    const providerChanges = this.model.quickDiffChanges.get(label);
    const providerIndex = providerChanges.indexOf(this._index);
    let detail;
    if (!this.shouldUseDropdown()) {
      detail = this.model.changes.length > 1 ? nls.localize("changes", "{0} - {1} of {2} changes", label, providerIndex + 1, providerChanges.length) : nls.localize("change", "{0} - {1} of {2} change", label, providerIndex + 1, providerChanges.length);
      this.dropdownContainer.style.display = "none";
    } else {
      detail = this.model.changes.length > 1 ? nls.localize("multiChanges", "{0} of {1} changes", providerIndex + 1, providerChanges.length) : nls.localize("multiChange", "{0} of {1} change", providerIndex + 1, providerChanges.length);
      this.dropdownContainer.style.display = "inherit";
    }
    this.setTitle(this.title, detail);
  }
  switchQuickDiff(event) {
    const newProvider = event?.provider;
    if (newProvider === this.model.changes[this._index].label) {
      return;
    }
    let closestGreaterIndex = this._index < this.model.changes.length - 1 ? this._index + 1 : 0;
    for (let i = closestGreaterIndex; i !== this._index; i < this.model.changes.length - 1 ? i++ : i = 0) {
      if (this.model.changes[i].label === newProvider) {
        closestGreaterIndex = i;
        break;
      }
    }
    let closestLesserIndex = this._index > 0 ? this._index - 1 : this.model.changes.length - 1;
    for (let i = closestLesserIndex; i !== this._index; i >= 0 ? i-- : i = this.model.changes.length - 1) {
      if (this.model.changes[i].label === newProvider) {
        closestLesserIndex = i;
        break;
      }
    }
    const closestIndex = Math.abs(this.model.changes[closestGreaterIndex].change.modifiedEndLineNumber - this.model.changes[this._index].change.modifiedEndLineNumber) < Math.abs(this.model.changes[closestLesserIndex].change.modifiedEndLineNumber - this.model.changes[this._index].change.modifiedEndLineNumber) ? closestGreaterIndex : closestLesserIndex;
    this.showChange(closestIndex, false);
  }
  shouldUseDropdown() {
    const visibleQuickDiffs = this.model.quickDiffs.filter((quickDiff) => quickDiff.visible);
    const visibleQuickDiffResults = this.model.getQuickDiffResults().filter((result) => visibleQuickDiffs.some((quickDiff) => quickDiff.label === result.label));
    return visibleQuickDiffResults.filter((quickDiff) => quickDiff.changes.length > 0).length > 1;
  }
  updateActions() {
    if (!this._actionbarWidget) {
      return;
    }
    const previous = this.instantiationService.createInstance(QuickDiffWidgetEditorAction, this.editor, new ShowPreviousChangeAction(this.editor), ThemeIcon.asClassName(gotoPreviousLocation));
    const next = this.instantiationService.createInstance(QuickDiffWidgetEditorAction, this.editor, new ShowNextChangeAction(this.editor), ThemeIcon.asClassName(gotoNextLocation));
    this._disposables.add(previous);
    this._disposables.add(next);
    if (this.menu) {
      this.menu.dispose();
    }
    this.menu = this.menuService.createMenu(MenuId.SCMChangeContext, this.contextKeyService);
    const actions = getFlatActionBarActions(this.menu.getActions({ shouldForwardArgs: true }));
    this._actionbarWidget.clear();
    this._actionbarWidget.push(actions.reverse(), { label: false, icon: true });
    this._actionbarWidget.push([next, previous], { label: false, icon: true });
    this._actionbarWidget.push(this._disposables.add(new Action("peekview.close", nls.localize("label.close", "Close"), ThemeIcon.asClassName(Codicon.close), true, () => this.dispose())), { label: false, icon: true });
  }
  _fillHead(container) {
    super._fillHead(container, true);
    const visibleQuickDiffs = this.model.quickDiffs.filter((quickDiff) => quickDiff.visible);
    this.dropdownContainer = dom.prepend(this._titleElement, dom.$(".dropdown"));
    this.dropdown = this.instantiationService.createInstance(
      QuickDiffPickerViewItem,
      new QuickDiffPickerBaseAction((event) => this.switchQuickDiff(event)),
      visibleQuickDiffs.map((quickDiff) => quickDiff.label),
      this.model.changes[this._index].label
    );
    this.dropdown.render(this.dropdownContainer);
    this.updateActions();
  }
  _getActionBarOptions() {
    const actionRunner = new QuickDiffWidgetActionRunner();
    this._disposables.add(actionRunner);
    this._disposables.add(actionRunner.onDidRun((e) => {
      if (!(e.action instanceof QuickDiffWidgetEditorAction) && !e.error) {
        this.dispose();
      }
    }));
    return {
      ...super._getActionBarOptions(),
      actionRunner
    };
  }
  _fillBody(container) {
    const options = {
      scrollBeyondLastLine: true,
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontal: "auto",
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false
      },
      overviewRulerLanes: 2,
      fixedOverflowWidgets: true,
      minimap: { enabled: false },
      renderSideBySide: false,
      readOnly: false,
      renderIndicators: false,
      diffAlgorithm: "advanced",
      ignoreTrimWhitespace: false,
      stickyScroll: { enabled: false }
    };
    this.diffEditor = this.instantiationService.createInstance(EmbeddedDiffEditorWidget, container, options, {}, this.editor);
    this._disposables.add(this.diffEditor);
  }
  _onWidth(width) {
    if (typeof this.height === "undefined") {
      return;
    }
    this.diffEditor.layout({ height: this.height, width });
  }
  _doLayoutBody(height, width) {
    super._doLayoutBody(height, width);
    this.diffEditor.layout({ height, width });
    if (typeof this.height === "undefined" && this.change) {
      this.revealChange(this.change);
    }
    this.height = height;
  }
  revealChange(change) {
    let start, end;
    if (change.modifiedEndLineNumber === 0) {
      start = change.modifiedStartLineNumber;
      end = change.modifiedStartLineNumber + 1;
    } else if (change.originalEndLineNumber > 0) {
      start = change.modifiedStartLineNumber - 1;
      end = change.modifiedEndLineNumber + 1;
    } else {
      start = change.modifiedStartLineNumber;
      end = change.modifiedEndLineNumber;
    }
    this.diffEditor.revealLinesInCenter(start, end, ScrollType.Immediate);
  }
  _applyTheme(theme) {
    const borderColor = theme.getColor(peekViewBorder) || Color.transparent;
    this.style({
      arrowColor: borderColor,
      frameColor: borderColor,
      headerBackgroundColor: theme.getColor(peekViewTitleBackground) || Color.transparent,
      primaryHeadingColor: theme.getColor(peekViewTitleForeground),
      secondaryHeadingColor: theme.getColor(peekViewTitleInfoForeground)
    });
  }
  revealRange(range) {
    this.editor.revealLineInCenterIfOutsideViewport(range.endLineNumber, ScrollType.Smooth);
  }
  hasFocus() {
    return this.diffEditor.hasTextFocus();
  }
  dispose() {
    super.dispose();
    this.menu?.dispose();
  }
};
QuickDiffWidget = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IMenuService),
  __decorateParam(5, IContextKeyService)
], QuickDiffWidget);
let QuickDiffEditorController = class extends Disposable {
  constructor(editor, contextKeyService, configurationService, quickDiffModelService, instantiationService) {
    super();
    this.editor = editor;
    this.configurationService = configurationService;
    this.quickDiffModelService = quickDiffModelService;
    this.instantiationService = instantiationService;
    this.model = null;
    this.widget = null;
    this.session = Disposable.None;
    this.mouseDownInfo = null;
    this.enabled = false;
    this.gutterActionDisposables = new DisposableStore();
    this.enabled = !contextKeyService.getContextKeyValue("isInDiffEditor");
    this.stylesheet = domStylesheetsJs.createStyleSheet(void 0, void 0, this._store);
    if (this.enabled) {
      this.isQuickDiffVisible = isQuickDiffVisible.bindTo(contextKeyService);
      this._register(editor.onDidChangeModel(() => this.close()));
      const onDidChangeGutterAction = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.diffDecorationsGutterAction"));
      this._register(onDidChangeGutterAction(this.onDidChangeGutterAction, this));
      this.onDidChangeGutterAction();
    }
  }
  static get(editor) {
    return editor.getContribution(QuickDiffEditorController.ID);
  }
  onDidChangeGutterAction() {
    const gutterAction = this.configurationService.getValue("scm.diffDecorationsGutterAction");
    this.gutterActionDisposables.clear();
    if (gutterAction === "diff") {
      this.gutterActionDisposables.add(this.editor.onMouseDown((e) => this.onEditorMouseDown(e)));
      this.gutterActionDisposables.add(this.editor.onMouseUp((e) => this.onEditorMouseUp(e)));
      this.stylesheet.textContent = `
				.monaco-editor .dirty-diff-glyph {
					cursor: pointer;
				}

				.monaco-editor .margin-view-overlays .dirty-diff-glyph:hover::before {
					height: 100%;
					width: 6px;
					left: -6px;
				}

				.monaco-editor .margin-view-overlays .dirty-diff-deleted:hover::after {
					bottom: 0;
					border-top-width: 0;
					border-bottom-width: 0;
				}
			`;
    } else {
      this.stylesheet.textContent = ``;
    }
  }
  canNavigate() {
    return !this.widget || this.widget?.index === -1 || !!this.model && this.model.changes.length > 1;
  }
  refresh() {
    this.widget?.showChange(this.widget.index, false);
  }
  next(lineNumber) {
    if (!this.assertWidget()) {
      return;
    }
    if (!this.widget || !this.model) {
      return;
    }
    let index;
    if (this.editor.hasModel() && (typeof lineNumber === "number" || !this.widget.provider)) {
      index = this.model.findNextClosestChange(typeof lineNumber === "number" ? lineNumber : this.editor.getPosition().lineNumber, true, this.widget.provider);
    } else {
      const providerChanges = this.model.quickDiffChanges.get(this.widget.provider) ?? this.model.quickDiffChanges.values().next().value;
      const mapIndex = providerChanges.findIndex((value) => value === this.widget.index);
      index = providerChanges[rot(mapIndex + 1, providerChanges.length)];
    }
    this.widget.showChange(index);
  }
  previous(lineNumber) {
    if (!this.assertWidget()) {
      return;
    }
    if (!this.widget || !this.model) {
      return;
    }
    let index;
    if (this.editor.hasModel() && typeof lineNumber === "number") {
      index = this.model.findPreviousClosestChange(typeof lineNumber === "number" ? lineNumber : this.editor.getPosition().lineNumber, true, this.widget.provider);
    } else {
      const providerChanges = this.model.quickDiffChanges.get(this.widget.provider) ?? this.model.quickDiffChanges.values().next().value;
      const mapIndex = providerChanges.findIndex((value) => value === this.widget.index);
      index = providerChanges[rot(mapIndex - 1, providerChanges.length)];
    }
    this.widget.showChange(index);
  }
  close() {
    this.session.dispose();
    this.session = Disposable.None;
  }
  assertWidget() {
    if (!this.enabled) {
      return false;
    }
    if (this.widget) {
      if (!this.model || this.model.changes.length === 0) {
        this.close();
        return false;
      }
      return true;
    }
    const editorModel = this.editor.getModel();
    if (!editorModel) {
      return false;
    }
    const modelRef = this.quickDiffModelService.createQuickDiffModelReference(editorModel.uri);
    if (!modelRef) {
      return false;
    }
    if (modelRef.object.changes.length === 0) {
      modelRef.dispose();
      return false;
    }
    this.model = modelRef.object;
    this.widget = this.instantiationService.createInstance(QuickDiffWidget, this.editor, this.model);
    this.isQuickDiffVisible.set(true);
    const disposables = new DisposableStore();
    disposables.add(Event.once(this.widget.onDidClose)(this.close, this));
    const onDidModelChange = Event.chain(
      this.model.onDidChange,
      ($) => $.filter((e) => e.diff.length > 0).map((e) => e.diff)
    );
    onDidModelChange(this.onDidModelChange, this, disposables);
    disposables.add(modelRef);
    disposables.add(this.widget);
    disposables.add(toDisposable(() => {
      this.model = null;
      this.widget = null;
      this.isQuickDiffVisible.set(false);
      this.editor.focus();
    }));
    this.session = disposables;
    return true;
  }
  onDidModelChange(splices) {
    if (!this.model || !this.widget || this.widget.hasFocus()) {
      return;
    }
    for (const splice of splices) {
      if (splice.start <= this.widget.index) {
        this.next();
        return;
      }
    }
    this.refresh();
  }
  onEditorMouseDown(e) {
    this.mouseDownInfo = null;
    const range = e.target.range;
    if (!range) {
      return;
    }
    if (!e.event.leftButton) {
      return;
    }
    if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
      return;
    }
    if (!e.target.element) {
      return;
    }
    if (e.target.element.className.indexOf("dirty-diff-glyph") < 0) {
      return;
    }
    const data = e.target.detail;
    const offsetLeftInGutter = e.target.element.offsetLeft;
    const gutterOffsetX = data.offsetX - offsetLeftInGutter;
    if (gutterOffsetX < -3 || gutterOffsetX > 3) {
      return;
    }
    this.mouseDownInfo = { lineNumber: range.startLineNumber };
  }
  onEditorMouseUp(e) {
    if (!this.mouseDownInfo) {
      return;
    }
    const { lineNumber } = this.mouseDownInfo;
    this.mouseDownInfo = null;
    const range = e.target.range;
    if (!range || range.startLineNumber !== lineNumber) {
      return;
    }
    if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
      return;
    }
    const editorModel = this.editor.getModel();
    if (!editorModel) {
      return;
    }
    const modelRef = this.quickDiffModelService.createQuickDiffModelReference(editorModel.uri);
    if (!modelRef) {
      return;
    }
    try {
      const index = modelRef.object.changes.findIndex((change) => lineIntersectsChange(lineNumber, change.change));
      if (index < 0) {
        return;
      }
      if (index === this.widget?.index) {
        this.close();
      } else {
        this.next(lineNumber);
      }
    } finally {
      modelRef.dispose();
    }
  }
  dispose() {
    this.gutterActionDisposables.dispose();
    super.dispose();
  }
};
QuickDiffEditorController.ID = "editor.contrib.quickdiff";
QuickDiffEditorController = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickDiffModelService),
  __decorateParam(4, IInstantiationService)
], QuickDiffEditorController);
class ShowPreviousChangeAction extends EditorAction {
  constructor(outerEditor) {
    super({
      id: "editor.action.dirtydiff.previous",
      label: nls.localize2("show previous change", "Show Previous Change"),
      precondition: TextCompareEditorActiveContext.toNegated(),
      kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: KeyMod.Shift | KeyMod.Alt | KeyCode.F3, weight: KeybindingWeight.EditorContrib }
    });
    this.outerEditor = outerEditor;
  }
  run(accessor) {
    const outerEditor = this.outerEditor ?? getOuterEditorFromDiffEditor(accessor);
    if (!outerEditor) {
      return;
    }
    const controller = QuickDiffEditorController.get(outerEditor);
    if (!controller) {
      return;
    }
    if (!controller.canNavigate()) {
      return;
    }
    controller.previous();
  }
}
registerEditorAction(ShowPreviousChangeAction);
class ShowNextChangeAction extends EditorAction {
  constructor(outerEditor) {
    super({
      id: "editor.action.dirtydiff.next",
      label: nls.localize2("show next change", "Show Next Change"),
      precondition: TextCompareEditorActiveContext.toNegated(),
      kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: KeyMod.Alt | KeyCode.F3, weight: KeybindingWeight.EditorContrib }
    });
    this.outerEditor = outerEditor;
  }
  run(accessor) {
    const outerEditor = this.outerEditor ?? getOuterEditorFromDiffEditor(accessor);
    if (!outerEditor) {
      return;
    }
    const controller = QuickDiffEditorController.get(outerEditor);
    if (!controller) {
      return;
    }
    if (!controller.canNavigate()) {
      return;
    }
    controller.next();
  }
}
registerEditorAction(ShowNextChangeAction);
class GotoPreviousChangeAction extends EditorAction {
  constructor() {
    super({
      id: "workbench.action.editor.previousChange",
      label: nls.localize2("move to previous change", "Go to Previous Change"),
      precondition: ContextKeyExpr.and(TextCompareEditorActiveContext.toNegated(), quickDiffDecorationCount.notEqualsTo(0)),
      kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: KeyMod.Shift | KeyMod.Alt | KeyCode.F5, weight: KeybindingWeight.EditorContrib }
    });
  }
  async run(accessor) {
    const outerEditor = getOuterEditorFromDiffEditor(accessor);
    const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
    const accessibilityService = accessor.get(IAccessibilityService);
    const codeEditorService = accessor.get(ICodeEditorService);
    const quickDiffModelService = accessor.get(IQuickDiffModelService);
    if (!outerEditor || !outerEditor.hasModel()) {
      return;
    }
    const modelRef = quickDiffModelService.createQuickDiffModelReference(outerEditor.getModel().uri);
    try {
      if (!modelRef || modelRef.object.changes.length === 0) {
        return;
      }
      const lineNumber = outerEditor.getPosition().lineNumber;
      const index = modelRef.object.findPreviousClosestChange(lineNumber, false);
      const change = modelRef.object.changes[index];
      await playAccessibilitySymbolForChange(change.change, accessibilitySignalService);
      setPositionAndSelection(change.change, outerEditor, accessibilityService, codeEditorService);
    } finally {
      modelRef?.dispose();
    }
  }
}
registerEditorAction(GotoPreviousChangeAction);
class GotoNextChangeAction extends EditorAction {
  constructor() {
    super({
      id: "workbench.action.editor.nextChange",
      label: nls.localize2("move to next change", "Go to Next Change"),
      precondition: ContextKeyExpr.and(TextCompareEditorActiveContext.toNegated(), quickDiffDecorationCount.notEqualsTo(0)),
      kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: KeyMod.Alt | KeyCode.F5, weight: KeybindingWeight.EditorContrib }
    });
  }
  async run(accessor) {
    const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
    const outerEditor = getOuterEditorFromDiffEditor(accessor);
    const accessibilityService = accessor.get(IAccessibilityService);
    const codeEditorService = accessor.get(ICodeEditorService);
    const quickDiffModelService = accessor.get(IQuickDiffModelService);
    if (!outerEditor || !outerEditor.hasModel()) {
      return;
    }
    const modelRef = quickDiffModelService.createQuickDiffModelReference(outerEditor.getModel().uri);
    try {
      if (!modelRef || modelRef.object.changes.length === 0) {
        return;
      }
      const lineNumber = outerEditor.getPosition().lineNumber;
      const index = modelRef.object.findNextClosestChange(lineNumber, false);
      const change = modelRef.object.changes[index].change;
      await playAccessibilitySymbolForChange(change, accessibilitySignalService);
      setPositionAndSelection(change, outerEditor, accessibilityService, codeEditorService);
    } finally {
      modelRef?.dispose();
    }
  }
}
registerEditorAction(GotoNextChangeAction);
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
  group: "7_change_nav",
  command: {
    id: "editor.action.dirtydiff.next",
    title: nls.localize({ key: "miGotoNextChange", comment: ["&& denotes a mnemonic"] }, "Next &&Change")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
  group: "7_change_nav",
  command: {
    id: "editor.action.dirtydiff.previous",
    title: nls.localize({ key: "miGotoPreviousChange", comment: ["&& denotes a mnemonic"] }, "Previous &&Change")
  },
  order: 2
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "closeQuickDiff",
  weight: KeybindingWeight.EditorContrib + 50,
  primary: KeyCode.Escape,
  secondary: [KeyMod.Shift | KeyCode.Escape],
  when: ContextKeyExpr.and(isQuickDiffVisible),
  handler: (accessor) => {
    const outerEditor = getOuterEditorFromDiffEditor(accessor);
    if (!outerEditor) {
      return;
    }
    const controller = QuickDiffEditorController.get(outerEditor);
    if (!controller) {
      return;
    }
    controller.close();
  }
});
function setPositionAndSelection(change, editor, accessibilityService, codeEditorService) {
  const position = new Position(change.modifiedStartLineNumber, 1);
  editor.setPosition(position);
  editor.revealPositionInCenter(position);
  if (accessibilityService.isScreenReaderOptimized()) {
    editor.setSelection({ startLineNumber: change.modifiedStartLineNumber, startColumn: 0, endLineNumber: change.modifiedStartLineNumber, endColumn: Number.MAX_VALUE });
    codeEditorService.getActiveCodeEditor()?.writeScreenReaderContent("diff-navigation");
  }
}
async function playAccessibilitySymbolForChange(change, accessibilitySignalService) {
  const changeType = getChangeType(change);
  switch (changeType) {
    case ChangeType.Add:
      accessibilitySignalService.playSignal(AccessibilitySignal.diffLineInserted, { allowManyInParallel: true, source: "quickDiffDecoration" });
      break;
    case ChangeType.Delete:
      accessibilitySignalService.playSignal(AccessibilitySignal.diffLineDeleted, { allowManyInParallel: true, source: "quickDiffDecoration" });
      break;
    case ChangeType.Modify:
      accessibilitySignalService.playSignal(AccessibilitySignal.diffLineModified, { allowManyInParallel: true, source: "quickDiffDecoration" });
      break;
  }
}
function getOuterEditorFromDiffEditor(accessor) {
  const diffEditors = accessor.get(ICodeEditorService).listDiffEditors();
  for (const diffEditor of diffEditors) {
    if (diffEditor.hasTextFocus() && diffEditor instanceof EmbeddedDiffEditorWidget) {
      return diffEditor.getParentEditor();
    }
  }
  return getOuterEditor(accessor);
}
export {
  GotoNextChangeAction,
  GotoPreviousChangeAction,
  QuickDiffEditorController,
  QuickDiffPickerBaseAction,
  QuickDiffPickerViewItem,
  ShowNextChangeAction,
  ShowPreviousChangeAction,
  isQuickDiffVisible
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci9xdWlja0RpZmZXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIGRvbVN0eWxlc2hlZXRzSnMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgQWN0aW9uUnVubmVyLCBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElTZWxlY3RPcHRpb25JdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NlbGVjdEJveC9zZWxlY3RCb3guanMnO1xuaW1wb3J0IHsgU2VsZWN0QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0U2VsZWN0Qm94U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IElDb2xvclRoZW1lLCBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBwZWVrVmlld0JvcmRlciwgcGVla1ZpZXdUaXRsZUJhY2tncm91bmQsIHBlZWtWaWV3VGl0bGVGb3JlZ3JvdW5kLCBwZWVrVmlld1RpdGxlSW5mb0ZvcmVncm91bmQsIFBlZWtWaWV3V2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvcGVla1ZpZXcvYnJvd3Nlci9wZWVrVmlldy5qcyc7XG5pbXBvcnQgeyBlZGl0b3JCYWNrZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSU1lbnUsIElNZW51U2VydmljZSwgTWVudUlkLCBNZW51SXRlbUFjdGlvbiwgTWVudVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgSUVkaXRvck1vdXNlRXZlbnQsIE1vdXNlVGFyZ2V0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uLCByZWdpc3RlckVkaXRvckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IEVtYmVkZGVkRGlmZkVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2VtYmVkZGVkRGlmZkVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uLCBTY3JvbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrRGlmZk1vZGVsU2VydmljZSwgUXVpY2tEaWZmTW9kZWwgfSBmcm9tICcuL3F1aWNrRGlmZk1vZGVsLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyByb3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IElTcGxpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXF1ZW5jZS5qcyc7XG5pbXBvcnQgeyBDaGFuZ2VUeXBlLCBnZXRDaGFuZ2VIZWlnaHQsIGdldENoYW5nZVR5cGUsIGdldENoYW5nZVR5cGVDb2xvciwgZ2V0TW9kaWZpZWRFbmRMaW5lTnVtYmVyLCBsaW5lSW50ZXJzZWN0c0NoYW5nZSwgUXVpY2tEaWZmQ2hhbmdlIH0gZnJvbSAnLi4vY29tbW9uL3F1aWNrRGlmZi5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXh0Q29tcGFyZUVkaXRvckFjdGl2ZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDaGFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2RpZmYvbGVnYWN5TGluZXNEaWZmQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24sIElEaWZmRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgSUFjdGlvbkJhck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgZ290b05leHRMb2NhdGlvbiwgZ290b1ByZXZpb3VzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IGdldE91dGVyRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IHF1aWNrRGlmZkRlY29yYXRpb25Db3VudCB9IGZyb20gJy4vcXVpY2tEaWZmRGVjb3JhdG9yLmpzJztcblxuZXhwb3J0IGNvbnN0IGlzUXVpY2tEaWZmVmlzaWJsZSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdkaXJ0eURpZmZWaXNpYmxlJywgZmFsc2UpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElRdWlja0RpZmZTZWxlY3RJdGVtIGV4dGVuZHMgSVNlbGVjdE9wdGlvbkl0ZW0ge1xuXHRwcm92aWRlcjogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgUXVpY2tEaWZmUGlja2VyVmlld0l0ZW0gZXh0ZW5kcyBTZWxlY3RBY3Rpb25WaWV3SXRlbTxJUXVpY2tEaWZmU2VsZWN0SXRlbT4ge1xuXHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnNJdGVtczogSVF1aWNrRGlmZlNlbGVjdEl0ZW1bXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRhY3Rpb246IElBY3Rpb24sXG5cdFx0cHJvdmlkZXJzOiBzdHJpbmdbXSxcblx0XHRzZWxlY3RlZDogc3RyaW5nLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgaXRlbXMgPSBwcm92aWRlcnMubWFwKHByb3ZpZGVyID0+ICh7IHByb3ZpZGVyLCB0ZXh0OiBwcm92aWRlciB9KSk7XG5cdFx0bGV0IHN0YXJ0aW5nU2VsZWN0aW9uID0gcHJvdmlkZXJzLmluZGV4T2Yoc2VsZWN0ZWQpO1xuXHRcdGlmIChzdGFydGluZ1NlbGVjdGlvbiA9PT0gLTEpIHtcblx0XHRcdHN0YXJ0aW5nU2VsZWN0aW9uID0gMDtcblx0XHR9XG5cdFx0Y29uc3Qgc3R5bGVzID0geyAuLi5kZWZhdWx0U2VsZWN0Qm94U3R5bGVzIH07XG5cdFx0Y29uc3QgdGhlbWUgPSB0aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpO1xuXHRcdGNvbnN0IGVkaXRvckJhY2tncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGVkaXRvckJhY2tncm91bmQpO1xuXHRcdGNvbnN0IHBlZWtUaXRsZUNvbG9yID0gdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXdUaXRsZUJhY2tncm91bmQpO1xuXHRcdGNvbnN0IG9wYXF1ZVRpdGxlQ29sb3IgPSBwZWVrVGl0bGVDb2xvcj8ubWFrZU9wYXF1ZShlZGl0b3JCYWNrZ3JvdW5kQ29sb3IhKSA/PyBlZGl0b3JCYWNrZ3JvdW5kQ29sb3IhO1xuXHRcdHN0eWxlcy5zZWxlY3RCYWNrZ3JvdW5kID0gb3BhcXVlVGl0bGVDb2xvci5saWdodGVuKC42KS50b1N0cmluZygpO1xuXHRcdHN1cGVyKG51bGwsIGFjdGlvbiwgaXRlbXMsIHN0YXJ0aW5nU2VsZWN0aW9uLCBjb250ZXh0Vmlld1NlcnZpY2UsIHN0eWxlcywgeyBhcmlhTGFiZWw6IG5scy5sb2NhbGl6ZSgncmVtb3RlcycsICdTd2l0Y2ggcXVpY2sgZGlmZiBiYXNlJykgfSk7XG5cdFx0dGhpcy5vcHRpb25zSXRlbXMgPSBpdGVtcztcblx0fVxuXG5cdHB1YmxpYyBzZXRTZWxlY3Rpb24ocHJvdmlkZXI6IHN0cmluZykge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5vcHRpb25zSXRlbXMuZmluZEluZGV4KGl0ZW0gPT4gaXRlbS5wcm92aWRlciA9PT0gcHJvdmlkZXIpO1xuXHRcdHRoaXMuc2VsZWN0KGluZGV4KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRBY3Rpb25Db250ZXh0KF86IHN0cmluZywgaW5kZXg6IG51bWJlcik6IElRdWlja0RpZmZTZWxlY3RJdGVtIHtcblx0XHRyZXR1cm4gdGhpcy5vcHRpb25zSXRlbXNbaW5kZXhdO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblx0XHR0aGlzLnNldEZvY3VzYWJsZSh0cnVlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUXVpY2tEaWZmUGlja2VyQmFzZUFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdxdWlja0RpZmYuYmFzZS5zd2l0Y2gnO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IExBQkVMID0gbmxzLmxvY2FsaXplKCdxdWlja0RpZmYuYmFzZS5zd2l0Y2gnLCBcIlN3aXRjaCBRdWljayBEaWZmIEJhc2VcIik7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBjYWxsYmFjazogKGV2ZW50PzogSVF1aWNrRGlmZlNlbGVjdEl0ZW0pID0+IHZvaWQpIHtcblx0XHRzdXBlcihRdWlja0RpZmZQaWNrZXJCYXNlQWN0aW9uLklELCBRdWlja0RpZmZQaWNrZXJCYXNlQWN0aW9uLkxBQkVMLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oZXZlbnQ/OiBJUXVpY2tEaWZmU2VsZWN0SXRlbSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmNhbGxiYWNrKGV2ZW50KTtcblx0fVxufVxuXG5jbGFzcyBRdWlja0RpZmZXaWRnZXRBY3Rpb25SdW5uZXIgZXh0ZW5kcyBBY3Rpb25SdW5uZXIge1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBydW5BY3Rpb24oYWN0aW9uOiBJQWN0aW9uLCBjb250ZXh0OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuXHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikge1xuXHRcdFx0cmV0dXJuIGFjdGlvbi5ydW4oLi4uY29udGV4dCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1cGVyLnJ1bkFjdGlvbihhY3Rpb24sIGNvbnRleHQpO1xuXHR9XG59XG5cbmNsYXNzIFF1aWNrRGlmZldpZGdldEVkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0cHJpdmF0ZSBlZGl0b3I6IElDb2RlRWRpdG9yO1xuXHRwcml2YXRlIGFjdGlvbjogRWRpdG9yQWN0aW9uO1xuXHRwcml2YXRlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRhY3Rpb246IEVkaXRvckFjdGlvbixcblx0XHRjc3NDbGFzczogc3RyaW5nLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3Qga2V5YmluZGluZyA9IGtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKTtcblx0XHRjb25zdCBsYWJlbCA9IGFjdGlvbi5sYWJlbCArIChrZXliaW5kaW5nID8gYCAoJHtrZXliaW5kaW5nLmdldExhYmVsKCl9KWAgOiAnJyk7XG5cblx0XHRzdXBlcihhY3Rpb24uaWQsIGxhYmVsLCBjc3NDbGFzcyk7XG5cblx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdFx0dGhpcy5hY3Rpb24gPSBhY3Rpb247XG5cdFx0dGhpcy5lZGl0b3IgPSBlZGl0b3I7XG5cdH1cblxuXHRvdmVycmlkZSBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gdGhpcy5hY3Rpb24ucnVuKGFjY2Vzc29yLCB0aGlzLmVkaXRvciwgbnVsbCkpKTtcblx0fVxufVxuXG5jbGFzcyBRdWlja0RpZmZXaWRnZXQgZXh0ZW5kcyBQZWVrVmlld1dpZGdldCB7XG5cblx0cHJpdmF0ZSBkaWZmRWRpdG9yITogRW1iZWRkZWREaWZmRWRpdG9yV2lkZ2V0O1xuXHRwcml2YXRlIHRpdGxlOiBzdHJpbmc7XG5cdHByaXZhdGUgbWVudTogSU1lbnUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2luZGV4OiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9wcm92aWRlcjogc3RyaW5nID0gJyc7XG5cdHByaXZhdGUgY2hhbmdlOiBJQ2hhbmdlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGRyb3Bkb3duOiBRdWlja0RpZmZQaWNrZXJWaWV3SXRlbSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBkcm9wZG93bkNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIG1vZGVsOiBRdWlja0RpZmZNb2RlbCxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoZWRpdG9yLCB7IGlzUmVzaXplYWJsZTogdHJ1ZSwgZnJhbWVXaWR0aDogMSwga2VlcEVkaXRvclNlbGVjdGlvbjogdHJ1ZSwgY2xhc3NOYW1lOiAnZGlydHktZGlmZicgfSwgaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UodGhpcy5fYXBwbHlUaGVtZSwgdGhpcykpO1xuXHRcdHRoaXMuX2FwcGx5VGhlbWUodGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSk7XG5cblx0XHRpZiAoIUl0ZXJhYmxlLmlzRW1wdHkodGhpcy5tb2RlbC5vcmlnaW5hbFRleHRNb2RlbHMpKSB7XG5cdFx0XHRjb250ZXh0S2V5U2VydmljZSA9IGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZU92ZXJsYXkoW1xuXHRcdFx0XHRbJ29yaWdpbmFsUmVzb3VyY2VTY2hlbWUnLCBJdGVyYWJsZS5maXJzdCh0aGlzLm1vZGVsLm9yaWdpbmFsVGV4dE1vZGVscyk/LnVyaS5zY2hlbWVdLFxuXHRcdFx0XHRbJ29yaWdpbmFsUmVzb3VyY2VTY2hlbWVzJywgSXRlcmFibGUubWFwKHRoaXMubW9kZWwub3JpZ2luYWxUZXh0TW9kZWxzLCB0ZXh0TW9kZWwgPT4gdGV4dE1vZGVsLnVyaS5zY2hlbWUpXV0pO1xuXHRcdH1cblxuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdFx0aWYgKGVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHR0aGlzLnRpdGxlID0gYmFzZW5hbWUoZWRpdG9yLmdldE1vZGVsKCkudXJpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50aXRsZSA9ICcnO1xuXHRcdH1cblx0XHR0aGlzLnNldFRpdGxlKHRoaXMudGl0bGUpO1xuXHR9XG5cblx0Z2V0IHByb3ZpZGVyKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3ZpZGVyO1xuXHR9XG5cblx0Z2V0IGluZGV4KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2luZGV4O1xuXHR9XG5cblx0Z2V0IHZpc2libGVSYW5nZSgpOiBSYW5nZSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlcyA9IHRoaXMuZGlmZkVkaXRvci5nZXRNb2RpZmllZEVkaXRvcigpLmdldFZpc2libGVSYW5nZXMoKTtcblx0XHRyZXR1cm4gdmlzaWJsZVJhbmdlcy5sZW5ndGggPj0gMCA/IHZpc2libGVSYW5nZXNbMF0gOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRzaG93Q2hhbmdlKGluZGV4OiBudW1iZXIsIHVzZVBvc2l0aW9uOiBib29sZWFuID0gdHJ1ZSk6IHZvaWQge1xuXHRcdGNvbnN0IGxhYmVsZWRDaGFuZ2UgPSB0aGlzLm1vZGVsLmNoYW5nZXNbaW5kZXhdO1xuXHRcdGNvbnN0IGNoYW5nZSA9IGxhYmVsZWRDaGFuZ2UuY2hhbmdlO1xuXHRcdHRoaXMuX2luZGV4ID0gaW5kZXg7XG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXkoJ29yaWdpbmFsUmVzb3VyY2VTY2hlbWUnLCB0aGlzLm1vZGVsLmNoYW5nZXNbaW5kZXhdLm9yaWdpbmFsLnNjaGVtZSk7XG5cdFx0dGhpcy51cGRhdGVBY3Rpb25zKCk7XG5cblx0XHR0aGlzLl9wcm92aWRlciA9IGxhYmVsZWRDaGFuZ2UubGFiZWw7XG5cdFx0dGhpcy5jaGFuZ2UgPSBjaGFuZ2U7XG5cblx0XHRpZiAoSXRlcmFibGUuaXNFbXB0eSh0aGlzLm1vZGVsLm9yaWdpbmFsVGV4dE1vZGVscykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvbkZpcnN0RGlmZlVwZGF0ZSA9IEV2ZW50Lm9uY2UodGhpcy5kaWZmRWRpdG9yLm9uRGlkVXBkYXRlRGlmZik7XG5cblx0XHQvLyBUT0RPQGpvYW8gVE9ET0BhbGV4IG5lZWQgdGhpcyBzZXRUaW1lb3V0IHByb2JhYmx5IGJlY2F1c2UgdGhlXG5cdFx0Ly8gbm9uLXNpZGUtYnktc2lkZSBkaWZmIHN0aWxsIGhhc24ndCBjcmVhdGVkIHRoZSB2aWV3IHpvbmVzXG5cdFx0b25GaXJzdERpZmZVcGRhdGUoKCkgPT4gc2V0VGltZW91dCgoKSA9PiB0aGlzLnJldmVhbENoYW5nZShjaGFuZ2UpLCAwKSk7XG5cblx0XHRjb25zdCBkaWZmRWRpdG9yTW9kZWwgPSB0aGlzLm1vZGVsLmdldERpZmZFZGl0b3JNb2RlbChsYWJlbGVkQ2hhbmdlLm9yaWdpbmFsKTtcblx0XHRpZiAoIWRpZmZFZGl0b3JNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmRpZmZFZGl0b3Iuc2V0TW9kZWwoZGlmZkVkaXRvck1vZGVsKTtcblx0XHR0aGlzLmRyb3Bkb3duPy5zZXRTZWxlY3Rpb24obGFiZWxlZENoYW5nZS5sYWJlbCk7XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IG5ldyBQb3NpdGlvbihnZXRNb2RpZmllZEVuZExpbmVOdW1iZXIoY2hhbmdlKSwgMSk7XG5cblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSB0aGlzLmVkaXRvci5nZXRMYXlvdXRJbmZvKCkuaGVpZ2h0O1xuXHRcdGNvbnN0IGVkaXRvckhlaWdodEluTGluZXMgPSBNYXRoLmZsb29yKGVkaXRvckhlaWdodCAvIGxpbmVIZWlnaHQpO1xuXHRcdGNvbnN0IGhlaWdodCA9IE1hdGgubWluKGdldENoYW5nZUhlaWdodChjaGFuZ2UpICsgLyogcGFkZGluZyAqLyA4LCBNYXRoLmZsb29yKGVkaXRvckhlaWdodEluTGluZXMgLyAzKSk7XG5cblx0XHR0aGlzLnJlbmRlclRpdGxlKGxhYmVsZWRDaGFuZ2UubGFiZWwpO1xuXG5cdFx0Y29uc3QgY2hhbmdlVHlwZSA9IGdldENoYW5nZVR5cGUoY2hhbmdlKTtcblx0XHRjb25zdCBjaGFuZ2VUeXBlQ29sb3IgPSBnZXRDaGFuZ2VUeXBlQ29sb3IodGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLCBjaGFuZ2VUeXBlKTtcblx0XHR0aGlzLnN0eWxlKHsgZnJhbWVDb2xvcjogY2hhbmdlVHlwZUNvbG9yLCBhcnJvd0NvbG9yOiBjaGFuZ2VUeXBlQ29sb3IgfSk7XG5cblx0XHRjb25zdCBwcm92aWRlclNwZWNpZmljQ2hhbmdlczogSUNoYW5nZVtdID0gW107XG5cdFx0bGV0IGNvbnRleHRJbmRleCA9IGluZGV4O1xuXHRcdGZvciAoY29uc3QgY2hhbmdlIG9mIHRoaXMubW9kZWwuY2hhbmdlcykge1xuXHRcdFx0aWYgKGNoYW5nZS5sYWJlbCA9PT0gdGhpcy5tb2RlbC5jaGFuZ2VzW3RoaXMuX2luZGV4XS5sYWJlbCkge1xuXHRcdFx0XHRwcm92aWRlclNwZWNpZmljQ2hhbmdlcy5wdXNoKGNoYW5nZS5jaGFuZ2UpO1xuXHRcdFx0XHRpZiAobGFiZWxlZENoYW5nZSA9PT0gY2hhbmdlKSB7XG5cdFx0XHRcdFx0Y29udGV4dEluZGV4ID0gcHJvdmlkZXJTcGVjaWZpY0NoYW5nZXMubGVuZ3RoIC0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9hY3Rpb25iYXJXaWRnZXQhLmNvbnRleHQgPSBbZGlmZkVkaXRvck1vZGVsLm1vZGlmaWVkLnVyaSwgcHJvdmlkZXJTcGVjaWZpY0NoYW5nZXMsIGNvbnRleHRJbmRleF07XG5cdFx0aWYgKHVzZVBvc2l0aW9uKSB7XG5cdFx0XHR0aGlzLnNob3cocG9zaXRpb24sIGhlaWdodCk7XG5cdFx0XHR0aGlzLmVkaXRvci5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVGl0bGUobGFiZWw6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHByb3ZpZGVyQ2hhbmdlcyA9IHRoaXMubW9kZWwucXVpY2tEaWZmQ2hhbmdlcy5nZXQobGFiZWwpITtcblx0XHRjb25zdCBwcm92aWRlckluZGV4ID0gcHJvdmlkZXJDaGFuZ2VzLmluZGV4T2YodGhpcy5faW5kZXgpO1xuXG5cdFx0bGV0IGRldGFpbDogc3RyaW5nO1xuXHRcdGlmICghdGhpcy5zaG91bGRVc2VEcm9wZG93bigpKSB7XG5cdFx0XHRkZXRhaWwgPSB0aGlzLm1vZGVsLmNoYW5nZXMubGVuZ3RoID4gMVxuXHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgnY2hhbmdlcycsIFwiezB9IC0gezF9IG9mIHsyfSBjaGFuZ2VzXCIsIGxhYmVsLCBwcm92aWRlckluZGV4ICsgMSwgcHJvdmlkZXJDaGFuZ2VzLmxlbmd0aClcblx0XHRcdFx0OiBubHMubG9jYWxpemUoJ2NoYW5nZScsIFwiezB9IC0gezF9IG9mIHsyfSBjaGFuZ2VcIiwgbGFiZWwsIHByb3ZpZGVySW5kZXggKyAxLCBwcm92aWRlckNoYW5nZXMubGVuZ3RoKTtcblx0XHRcdHRoaXMuZHJvcGRvd25Db250YWluZXIhLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRldGFpbCA9IHRoaXMubW9kZWwuY2hhbmdlcy5sZW5ndGggPiAxXG5cdFx0XHRcdD8gbmxzLmxvY2FsaXplKCdtdWx0aUNoYW5nZXMnLCBcInswfSBvZiB7MX0gY2hhbmdlc1wiLCBwcm92aWRlckluZGV4ICsgMSwgcHJvdmlkZXJDaGFuZ2VzLmxlbmd0aClcblx0XHRcdFx0OiBubHMubG9jYWxpemUoJ211bHRpQ2hhbmdlJywgXCJ7MH0gb2YgezF9IGNoYW5nZVwiLCBwcm92aWRlckluZGV4ICsgMSwgcHJvdmlkZXJDaGFuZ2VzLmxlbmd0aCk7XG5cdFx0XHR0aGlzLmRyb3Bkb3duQ29udGFpbmVyIS5zdHlsZS5kaXNwbGF5ID0gJ2luaGVyaXQnO1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0VGl0bGUodGhpcy50aXRsZSwgZGV0YWlsKTtcblx0fVxuXG5cdHByaXZhdGUgc3dpdGNoUXVpY2tEaWZmKGV2ZW50PzogSVF1aWNrRGlmZlNlbGVjdEl0ZW0pIHtcblx0XHRjb25zdCBuZXdQcm92aWRlciA9IGV2ZW50Py5wcm92aWRlcjtcblx0XHRpZiAobmV3UHJvdmlkZXIgPT09IHRoaXMubW9kZWwuY2hhbmdlc1t0aGlzLl9pbmRleF0ubGFiZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IGNsb3Nlc3RHcmVhdGVySW5kZXggPSB0aGlzLl9pbmRleCA8IHRoaXMubW9kZWwuY2hhbmdlcy5sZW5ndGggLSAxID8gdGhpcy5faW5kZXggKyAxIDogMDtcblx0XHRmb3IgKGxldCBpID0gY2xvc2VzdEdyZWF0ZXJJbmRleDsgaSAhPT0gdGhpcy5faW5kZXg7IGkgPCB0aGlzLm1vZGVsLmNoYW5nZXMubGVuZ3RoIC0gMSA/IGkrKyA6IGkgPSAwKSB7XG5cdFx0XHRpZiAodGhpcy5tb2RlbC5jaGFuZ2VzW2ldLmxhYmVsID09PSBuZXdQcm92aWRlcikge1xuXHRcdFx0XHRjbG9zZXN0R3JlYXRlckluZGV4ID0gaTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGxldCBjbG9zZXN0TGVzc2VySW5kZXggPSB0aGlzLl9pbmRleCA+IDAgPyB0aGlzLl9pbmRleCAtIDEgOiB0aGlzLm1vZGVsLmNoYW5nZXMubGVuZ3RoIC0gMTtcblx0XHRmb3IgKGxldCBpID0gY2xvc2VzdExlc3NlckluZGV4OyBpICE9PSB0aGlzLl9pbmRleDsgaSA+PSAwID8gaS0tIDogaSA9IHRoaXMubW9kZWwuY2hhbmdlcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRpZiAodGhpcy5tb2RlbC5jaGFuZ2VzW2ldLmxhYmVsID09PSBuZXdQcm92aWRlcikge1xuXHRcdFx0XHRjbG9zZXN0TGVzc2VySW5kZXggPSBpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgY2xvc2VzdEluZGV4ID0gTWF0aC5hYnModGhpcy5tb2RlbC5jaGFuZ2VzW2Nsb3Nlc3RHcmVhdGVySW5kZXhdLmNoYW5nZS5tb2RpZmllZEVuZExpbmVOdW1iZXIgLSB0aGlzLm1vZGVsLmNoYW5nZXNbdGhpcy5faW5kZXhdLmNoYW5nZS5tb2RpZmllZEVuZExpbmVOdW1iZXIpXG5cdFx0XHQ8IE1hdGguYWJzKHRoaXMubW9kZWwuY2hhbmdlc1tjbG9zZXN0TGVzc2VySW5kZXhdLmNoYW5nZS5tb2RpZmllZEVuZExpbmVOdW1iZXIgLSB0aGlzLm1vZGVsLmNoYW5nZXNbdGhpcy5faW5kZXhdLmNoYW5nZS5tb2RpZmllZEVuZExpbmVOdW1iZXIpXG5cdFx0XHQ/IGNsb3Nlc3RHcmVhdGVySW5kZXggOiBjbG9zZXN0TGVzc2VySW5kZXg7XG5cdFx0dGhpcy5zaG93Q2hhbmdlKGNsb3Nlc3RJbmRleCwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRVc2VEcm9wZG93bigpOiBib29sZWFuIHtcblx0XHRjb25zdCB2aXNpYmxlUXVpY2tEaWZmcyA9IHRoaXMubW9kZWwucXVpY2tEaWZmcy5maWx0ZXIocXVpY2tEaWZmID0+IHF1aWNrRGlmZi52aXNpYmxlKTtcblx0XHRjb25zdCB2aXNpYmxlUXVpY2tEaWZmUmVzdWx0cyA9IHRoaXMubW9kZWwuZ2V0UXVpY2tEaWZmUmVzdWx0cygpXG5cdFx0XHQuZmlsdGVyKHJlc3VsdCA9PiB2aXNpYmxlUXVpY2tEaWZmcy5zb21lKHF1aWNrRGlmZiA9PiBxdWlja0RpZmYubGFiZWwgPT09IHJlc3VsdC5sYWJlbCkpO1xuXG5cdFx0cmV0dXJuIHZpc2libGVRdWlja0RpZmZSZXN1bHRzXG5cdFx0XHQuZmlsdGVyKHF1aWNrRGlmZiA9PiBxdWlja0RpZmYuY2hhbmdlcy5sZW5ndGggPiAwKS5sZW5ndGggPiAxO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fYWN0aW9uYmFyV2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHByZXZpb3VzID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWlja0RpZmZXaWRnZXRFZGl0b3JBY3Rpb24sIHRoaXMuZWRpdG9yLCBuZXcgU2hvd1ByZXZpb3VzQ2hhbmdlQWN0aW9uKHRoaXMuZWRpdG9yKSwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGdvdG9QcmV2aW91c0xvY2F0aW9uKSk7XG5cdFx0Y29uc3QgbmV4dCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUXVpY2tEaWZmV2lkZ2V0RWRpdG9yQWN0aW9uLCB0aGlzLmVkaXRvciwgbmV3IFNob3dOZXh0Q2hhbmdlQWN0aW9uKHRoaXMuZWRpdG9yKSwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGdvdG9OZXh0TG9jYXRpb24pKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChwcmV2aW91cyk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKG5leHQpO1xuXG5cdFx0aWYgKHRoaXMubWVudSkge1xuXHRcdFx0dGhpcy5tZW51LmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0dGhpcy5tZW51ID0gdGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5TQ01DaGFuZ2VDb250ZXh0LCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCBhY3Rpb25zID0gZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnModGhpcy5tZW51LmdldEFjdGlvbnMoeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KSk7XG5cdFx0dGhpcy5fYWN0aW9uYmFyV2lkZ2V0LmNsZWFyKCk7XG5cdFx0dGhpcy5fYWN0aW9uYmFyV2lkZ2V0LnB1c2goYWN0aW9ucy5yZXZlcnNlKCksIHsgbGFiZWw6IGZhbHNlLCBpY29uOiB0cnVlIH0pO1xuXHRcdHRoaXMuX2FjdGlvbmJhcldpZGdldC5wdXNoKFtuZXh0LCBwcmV2aW91c10sIHsgbGFiZWw6IGZhbHNlLCBpY29uOiB0cnVlIH0pO1xuXHRcdHRoaXMuX2FjdGlvbmJhcldpZGdldC5wdXNoKHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKCdwZWVrdmlldy5jbG9zZScsIG5scy5sb2NhbGl6ZSgnbGFiZWwuY2xvc2UnLCBcIkNsb3NlXCIpLCBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5jbG9zZSksIHRydWUsICgpID0+IHRoaXMuZGlzcG9zZSgpKSksIHsgbGFiZWw6IGZhbHNlLCBpY29uOiB0cnVlIH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9maWxsSGVhZChjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIuX2ZpbGxIZWFkKGNvbnRhaW5lciwgdHJ1ZSk7XG5cblx0XHRjb25zdCB2aXNpYmxlUXVpY2tEaWZmcyA9IHRoaXMubW9kZWwucXVpY2tEaWZmcy5maWx0ZXIocXVpY2tEaWZmID0+IHF1aWNrRGlmZi52aXNpYmxlKTtcblxuXHRcdHRoaXMuZHJvcGRvd25Db250YWluZXIgPSBkb20ucHJlcGVuZCh0aGlzLl90aXRsZUVsZW1lbnQhLCBkb20uJCgnLmRyb3Bkb3duJykpO1xuXHRcdHRoaXMuZHJvcGRvd24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFF1aWNrRGlmZlBpY2tlclZpZXdJdGVtLFxuXHRcdFx0bmV3IFF1aWNrRGlmZlBpY2tlckJhc2VBY3Rpb24oKGV2ZW50PzogSVF1aWNrRGlmZlNlbGVjdEl0ZW0pID0+IHRoaXMuc3dpdGNoUXVpY2tEaWZmKGV2ZW50KSksXG5cdFx0XHR2aXNpYmxlUXVpY2tEaWZmcy5tYXAocXVpY2tEaWZmID0+IHF1aWNrRGlmZi5sYWJlbCksIHRoaXMubW9kZWwuY2hhbmdlc1t0aGlzLl9pbmRleF0ubGFiZWwpO1xuXHRcdHRoaXMuZHJvcGRvd24ucmVuZGVyKHRoaXMuZHJvcGRvd25Db250YWluZXIpO1xuXHRcdHRoaXMudXBkYXRlQWN0aW9ucygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9nZXRBY3Rpb25CYXJPcHRpb25zKCk6IElBY3Rpb25CYXJPcHRpb25zIHtcblx0XHRjb25zdCBhY3Rpb25SdW5uZXIgPSBuZXcgUXVpY2tEaWZmV2lkZ2V0QWN0aW9uUnVubmVyKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGFjdGlvblJ1bm5lcik7XG5cblx0XHQvLyBjbG9zZSB3aWRnZXQgb24gc3VjY2Vzc2Z1bCBhY3Rpb25cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoYWN0aW9uUnVubmVyLm9uRGlkUnVuKGUgPT4ge1xuXHRcdFx0aWYgKCEoZS5hY3Rpb24gaW5zdGFuY2VvZiBRdWlja0RpZmZXaWRnZXRFZGl0b3JBY3Rpb24pICYmICFlLmVycm9yKSB7XG5cdFx0XHRcdHRoaXMuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5zdXBlci5fZ2V0QWN0aW9uQmFyT3B0aW9ucygpLFxuXHRcdFx0YWN0aW9uUnVubmVyXG5cdFx0fTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZmlsbEJvZHkoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IG9wdGlvbnM6IElEaWZmRWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdHNjcm9sbEJleW9uZExhc3RMaW5lOiB0cnVlLFxuXHRcdFx0c2Nyb2xsYmFyOiB7XG5cdFx0XHRcdHZlcnRpY2FsU2Nyb2xsYmFyU2l6ZTogMTQsXG5cdFx0XHRcdGhvcml6b250YWw6ICdhdXRvJyxcblx0XHRcdFx0dXNlU2hhZG93czogdHJ1ZSxcblx0XHRcdFx0dmVydGljYWxIYXNBcnJvd3M6IGZhbHNlLFxuXHRcdFx0XHRob3Jpem9udGFsSGFzQXJyb3dzOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdG92ZXJ2aWV3UnVsZXJMYW5lczogMixcblx0XHRcdGZpeGVkT3ZlcmZsb3dXaWRnZXRzOiB0cnVlLFxuXHRcdFx0bWluaW1hcDogeyBlbmFibGVkOiBmYWxzZSB9LFxuXHRcdFx0cmVuZGVyU2lkZUJ5U2lkZTogZmFsc2UsXG5cdFx0XHRyZWFkT25seTogZmFsc2UsXG5cdFx0XHRyZW5kZXJJbmRpY2F0b3JzOiBmYWxzZSxcblx0XHRcdGRpZmZBbGdvcml0aG06ICdhZHZhbmNlZCcsXG5cdFx0XHRpZ25vcmVUcmltV2hpdGVzcGFjZTogZmFsc2UsXG5cdFx0XHRzdGlja3lTY3JvbGw6IHsgZW5hYmxlZDogZmFsc2UgfVxuXHRcdH07XG5cblx0XHR0aGlzLmRpZmZFZGl0b3IgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVtYmVkZGVkRGlmZkVkaXRvcldpZGdldCwgY29udGFpbmVyLCBvcHRpb25zLCB7fSwgdGhpcy5lZGl0b3IpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLmRpZmZFZGl0b3IpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9vbldpZHRoKHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuaGVpZ2h0ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZGlmZkVkaXRvci5sYXlvdXQoeyBoZWlnaHQ6IHRoaXMuaGVpZ2h0LCB3aWR0aCB9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfZG9MYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIuX2RvTGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLmRpZmZFZGl0b3IubGF5b3V0KHsgaGVpZ2h0LCB3aWR0aCB9KTtcblxuXHRcdGlmICh0eXBlb2YgdGhpcy5oZWlnaHQgPT09ICd1bmRlZmluZWQnICYmIHRoaXMuY2hhbmdlKSB7XG5cdFx0XHR0aGlzLnJldmVhbENoYW5nZSh0aGlzLmNoYW5nZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cdH1cblxuXHRwcml2YXRlIHJldmVhbENoYW5nZShjaGFuZ2U6IElDaGFuZ2UpOiB2b2lkIHtcblx0XHRsZXQgc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXI7XG5cblx0XHRpZiAoY2hhbmdlLm1vZGlmaWVkRW5kTGluZU51bWJlciA9PT0gMCkgeyAvLyBkZWxldGlvblxuXHRcdFx0c3RhcnQgPSBjaGFuZ2UubW9kaWZpZWRTdGFydExpbmVOdW1iZXI7XG5cdFx0XHRlbmQgPSBjaGFuZ2UubW9kaWZpZWRTdGFydExpbmVOdW1iZXIgKyAxO1xuXHRcdH0gZWxzZSBpZiAoY2hhbmdlLm9yaWdpbmFsRW5kTGluZU51bWJlciA+IDApIHsgLy8gbW9kaWZpY2F0aW9uXG5cdFx0XHRzdGFydCA9IGNoYW5nZS5tb2RpZmllZFN0YXJ0TGluZU51bWJlciAtIDE7XG5cdFx0XHRlbmQgPSBjaGFuZ2UubW9kaWZpZWRFbmRMaW5lTnVtYmVyICsgMTtcblx0XHR9IGVsc2UgeyAvLyBpbnNlcnRpb25cblx0XHRcdHN0YXJ0ID0gY2hhbmdlLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0ZW5kID0gY2hhbmdlLm1vZGlmaWVkRW5kTGluZU51bWJlcjtcblx0XHR9XG5cblx0XHR0aGlzLmRpZmZFZGl0b3IucmV2ZWFsTGluZXNJbkNlbnRlcihzdGFydCwgZW5kLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBseVRoZW1lKHRoZW1lOiBJQ29sb3JUaGVtZSkge1xuXHRcdGNvbnN0IGJvcmRlckNvbG9yID0gdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXdCb3JkZXIpIHx8IENvbG9yLnRyYW5zcGFyZW50O1xuXHRcdHRoaXMuc3R5bGUoe1xuXHRcdFx0YXJyb3dDb2xvcjogYm9yZGVyQ29sb3IsXG5cdFx0XHRmcmFtZUNvbG9yOiBib3JkZXJDb2xvcixcblx0XHRcdGhlYWRlckJhY2tncm91bmRDb2xvcjogdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXdUaXRsZUJhY2tncm91bmQpIHx8IENvbG9yLnRyYW5zcGFyZW50LFxuXHRcdFx0cHJpbWFyeUhlYWRpbmdDb2xvcjogdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXdUaXRsZUZvcmVncm91bmQpLFxuXHRcdFx0c2Vjb25kYXJ5SGVhZGluZ0NvbG9yOiB0aGVtZS5nZXRDb2xvcihwZWVrVmlld1RpdGxlSW5mb0ZvcmVncm91bmQpXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmV2ZWFsUmFuZ2UocmFuZ2U6IFJhbmdlKSB7XG5cdFx0dGhpcy5lZGl0b3IucmV2ZWFsTGluZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQocmFuZ2UuZW5kTGluZU51bWJlciwgU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgaGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZGlmZkVkaXRvci5oYXNUZXh0Rm9jdXMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMubWVudT8uZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBRdWlja0RpZmZFZGl0b3JDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmNvbnRyaWIucXVpY2tkaWZmJztcblxuXHRzdGF0aWMgZ2V0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiBRdWlja0RpZmZFZGl0b3JDb250cm9sbGVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248UXVpY2tEaWZmRWRpdG9yQ29udHJvbGxlcj4oUXVpY2tEaWZmRWRpdG9yQ29udHJvbGxlci5JRCk7XG5cdH1cblxuXHRwcml2YXRlIG1vZGVsOiBRdWlja0RpZmZNb2RlbCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHdpZGdldDogUXVpY2tEaWZmV2lkZ2V0IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgaXNRdWlja0RpZmZWaXNpYmxlITogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgc2Vzc2lvbjogSURpc3Bvc2FibGUgPSBEaXNwb3NhYmxlLk5vbmU7XG5cdHByaXZhdGUgbW91c2VEb3duSW5mbzogeyBsaW5lTnVtYmVyOiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIGVuYWJsZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSByZWFkb25seSBndXR0ZXJBY3Rpb25EaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBzdHlsZXNoZWV0OiBIVE1MU3R5bGVFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0RpZmZNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0RpZmZNb2RlbFNlcnZpY2U6IElRdWlja0RpZmZNb2RlbFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmVuYWJsZWQgPSAhY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dEtleVZhbHVlKCdpc0luRGlmZkVkaXRvcicpO1xuXHRcdHRoaXMuc3R5bGVzaGVldCA9IGRvbVN0eWxlc2hlZXRzSnMuY3JlYXRlU3R5bGVTaGVldCh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGhpcy5fc3RvcmUpO1xuXG5cdFx0aWYgKHRoaXMuZW5hYmxlZCkge1xuXHRcdFx0dGhpcy5pc1F1aWNrRGlmZlZpc2libGUgPSBpc1F1aWNrRGlmZlZpc2libGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHRoaXMuY2xvc2UoKSkpO1xuXG5cdFx0XHRjb25zdCBvbkRpZENoYW5nZUd1dHRlckFjdGlvbiA9IEV2ZW50LmZpbHRlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2NtLmRpZmZEZWNvcmF0aW9uc0d1dHRlckFjdGlvbicpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKG9uRGlkQ2hhbmdlR3V0dGVyQWN0aW9uKHRoaXMub25EaWRDaGFuZ2VHdXR0ZXJBY3Rpb24sIHRoaXMpKTtcblx0XHRcdHRoaXMub25EaWRDaGFuZ2VHdXR0ZXJBY3Rpb24oKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlR3V0dGVyQWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IGd1dHRlckFjdGlvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J2RpZmYnIHwgJ25vbmUnPignc2NtLmRpZmZEZWNvcmF0aW9uc0d1dHRlckFjdGlvbicpO1xuXG5cdFx0dGhpcy5ndXR0ZXJBY3Rpb25EaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0aWYgKGd1dHRlckFjdGlvbiA9PT0gJ2RpZmYnKSB7XG5cdFx0XHR0aGlzLmd1dHRlckFjdGlvbkRpc3Bvc2FibGVzLmFkZCh0aGlzLmVkaXRvci5vbk1vdXNlRG93bihlID0+IHRoaXMub25FZGl0b3JNb3VzZURvd24oZSkpKTtcblx0XHRcdHRoaXMuZ3V0dGVyQWN0aW9uRGlzcG9zYWJsZXMuYWRkKHRoaXMuZWRpdG9yLm9uTW91c2VVcChlID0+IHRoaXMub25FZGl0b3JNb3VzZVVwKGUpKSk7XG5cdFx0XHR0aGlzLnN0eWxlc2hlZXQudGV4dENvbnRlbnQgPSBgXG5cdFx0XHRcdC5tb25hY28tZWRpdG9yIC5kaXJ0eS1kaWZmLWdseXBoIHtcblx0XHRcdFx0XHRjdXJzb3I6IHBvaW50ZXI7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQubW9uYWNvLWVkaXRvciAubWFyZ2luLXZpZXctb3ZlcmxheXMgLmRpcnR5LWRpZmYtZ2x5cGg6aG92ZXI6OmJlZm9yZSB7XG5cdFx0XHRcdFx0aGVpZ2h0OiAxMDAlO1xuXHRcdFx0XHRcdHdpZHRoOiA2cHg7XG5cdFx0XHRcdFx0bGVmdDogLTZweDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC5tb25hY28tZWRpdG9yIC5tYXJnaW4tdmlldy1vdmVybGF5cyAuZGlydHktZGlmZi1kZWxldGVkOmhvdmVyOjphZnRlciB7XG5cdFx0XHRcdFx0Ym90dG9tOiAwO1xuXHRcdFx0XHRcdGJvcmRlci10b3Atd2lkdGg6IDA7XG5cdFx0XHRcdFx0Ym9yZGVyLWJvdHRvbS13aWR0aDogMDtcblx0XHRcdFx0fVxuXHRcdFx0YDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zdHlsZXNoZWV0LnRleHRDb250ZW50ID0gYGA7XG5cdFx0fVxuXHR9XG5cblx0Y2FuTmF2aWdhdGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLndpZGdldCB8fCAodGhpcy53aWRnZXQ/LmluZGV4ID09PSAtMSkgfHwgKCEhdGhpcy5tb2RlbCAmJiB0aGlzLm1vZGVsLmNoYW5nZXMubGVuZ3RoID4gMSk7XG5cdH1cblxuXHRyZWZyZXNoKCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0Py5zaG93Q2hhbmdlKHRoaXMud2lkZ2V0LmluZGV4LCBmYWxzZSk7XG5cdH1cblxuXHRuZXh0KGxpbmVOdW1iZXI/OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuYXNzZXJ0V2lkZ2V0KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLndpZGdldCB8fCAhdGhpcy5tb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBpbmRleDogbnVtYmVyO1xuXHRcdGlmICh0aGlzLmVkaXRvci5oYXNNb2RlbCgpICYmICh0eXBlb2YgbGluZU51bWJlciA9PT0gJ251bWJlcicgfHwgIXRoaXMud2lkZ2V0LnByb3ZpZGVyKSkge1xuXHRcdFx0aW5kZXggPSB0aGlzLm1vZGVsLmZpbmROZXh0Q2xvc2VzdENoYW5nZSh0eXBlb2YgbGluZU51bWJlciA9PT0gJ251bWJlcicgPyBsaW5lTnVtYmVyIDogdGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKS5saW5lTnVtYmVyLCB0cnVlLCB0aGlzLndpZGdldC5wcm92aWRlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyQ2hhbmdlczogbnVtYmVyW10gPSB0aGlzLm1vZGVsLnF1aWNrRGlmZkNoYW5nZXMuZ2V0KHRoaXMud2lkZ2V0LnByb3ZpZGVyKSA/PyB0aGlzLm1vZGVsLnF1aWNrRGlmZkNoYW5nZXMudmFsdWVzKCkubmV4dCgpLnZhbHVlITtcblx0XHRcdGNvbnN0IG1hcEluZGV4ID0gcHJvdmlkZXJDaGFuZ2VzLmZpbmRJbmRleCh2YWx1ZSA9PiB2YWx1ZSA9PT0gdGhpcy53aWRnZXQhLmluZGV4KTtcblx0XHRcdGluZGV4ID0gcHJvdmlkZXJDaGFuZ2VzW3JvdChtYXBJbmRleCArIDEsIHByb3ZpZGVyQ2hhbmdlcy5sZW5ndGgpXTtcblx0XHR9XG5cblx0XHR0aGlzLndpZGdldC5zaG93Q2hhbmdlKGluZGV4KTtcblx0fVxuXG5cdHByZXZpb3VzKGxpbmVOdW1iZXI/OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuYXNzZXJ0V2lkZ2V0KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLndpZGdldCB8fCAhdGhpcy5tb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBpbmRleDogbnVtYmVyO1xuXHRcdGlmICh0aGlzLmVkaXRvci5oYXNNb2RlbCgpICYmICh0eXBlb2YgbGluZU51bWJlciA9PT0gJ251bWJlcicpKSB7XG5cdFx0XHRpbmRleCA9IHRoaXMubW9kZWwuZmluZFByZXZpb3VzQ2xvc2VzdENoYW5nZSh0eXBlb2YgbGluZU51bWJlciA9PT0gJ251bWJlcicgPyBsaW5lTnVtYmVyIDogdGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKS5saW5lTnVtYmVyLCB0cnVlLCB0aGlzLndpZGdldC5wcm92aWRlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyQ2hhbmdlczogbnVtYmVyW10gPSB0aGlzLm1vZGVsLnF1aWNrRGlmZkNoYW5nZXMuZ2V0KHRoaXMud2lkZ2V0LnByb3ZpZGVyKSA/PyB0aGlzLm1vZGVsLnF1aWNrRGlmZkNoYW5nZXMudmFsdWVzKCkubmV4dCgpLnZhbHVlITtcblx0XHRcdGNvbnN0IG1hcEluZGV4ID0gcHJvdmlkZXJDaGFuZ2VzLmZpbmRJbmRleCh2YWx1ZSA9PiB2YWx1ZSA9PT0gdGhpcy53aWRnZXQhLmluZGV4KTtcblx0XHRcdGluZGV4ID0gcHJvdmlkZXJDaGFuZ2VzW3JvdChtYXBJbmRleCAtIDEsIHByb3ZpZGVyQ2hhbmdlcy5sZW5ndGgpXTtcblx0XHR9XG5cblx0XHR0aGlzLndpZGdldC5zaG93Q2hhbmdlKGluZGV4KTtcblx0fVxuXG5cdGNsb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuc2Vzc2lvbi5kaXNwb3NlKCk7XG5cdFx0dGhpcy5zZXNzaW9uID0gRGlzcG9zYWJsZS5Ob25lO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3NlcnRXaWRnZXQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmVuYWJsZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy53aWRnZXQpIHtcblx0XHRcdGlmICghdGhpcy5tb2RlbCB8fCB0aGlzLm1vZGVsLmNoYW5nZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuY2xvc2UoKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3JNb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cblx0XHRpZiAoIWVkaXRvck1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWxSZWYgPSB0aGlzLnF1aWNrRGlmZk1vZGVsU2VydmljZS5jcmVhdGVRdWlja0RpZmZNb2RlbFJlZmVyZW5jZShlZGl0b3JNb2RlbC51cmkpO1xuXG5cdFx0aWYgKCFtb2RlbFJlZikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChtb2RlbFJlZi5vYmplY3QuY2hhbmdlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdG1vZGVsUmVmLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLm1vZGVsID0gbW9kZWxSZWYub2JqZWN0O1xuXHRcdHRoaXMud2lkZ2V0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWlja0RpZmZXaWRnZXQsIHRoaXMuZWRpdG9yLCB0aGlzLm1vZGVsKTtcblx0XHR0aGlzLmlzUXVpY2tEaWZmVmlzaWJsZS5zZXQodHJ1ZSk7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQub25jZSh0aGlzLndpZGdldC5vbkRpZENsb3NlKSh0aGlzLmNsb3NlLCB0aGlzKSk7XG5cdFx0Y29uc3Qgb25EaWRNb2RlbENoYW5nZSA9IEV2ZW50LmNoYWluKHRoaXMubW9kZWwub25EaWRDaGFuZ2UsICQgPT5cblx0XHRcdCQuZmlsdGVyKGUgPT4gZS5kaWZmLmxlbmd0aCA+IDApXG5cdFx0XHRcdC5tYXAoZSA9PiBlLmRpZmYpXG5cdFx0KTtcblxuXHRcdG9uRGlkTW9kZWxDaGFuZ2UodGhpcy5vbkRpZE1vZGVsQ2hhbmdlLCB0aGlzLCBkaXNwb3NhYmxlcyk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWxSZWYpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLndpZGdldCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLm1vZGVsID0gbnVsbDtcblx0XHRcdHRoaXMud2lkZ2V0ID0gbnVsbDtcblx0XHRcdHRoaXMuaXNRdWlja0RpZmZWaXNpYmxlLnNldChmYWxzZSk7XG5cdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuc2Vzc2lvbiA9IGRpc3Bvc2FibGVzO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZE1vZGVsQ2hhbmdlKHNwbGljZXM6IElTcGxpY2U8UXVpY2tEaWZmQ2hhbmdlPltdKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLndpZGdldCB8fCB0aGlzLndpZGdldC5oYXNGb2N1cygpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBzcGxpY2Ugb2Ygc3BsaWNlcykge1xuXHRcdFx0aWYgKHNwbGljZS5zdGFydCA8PSB0aGlzLndpZGdldC5pbmRleCkge1xuXHRcdFx0XHR0aGlzLm5leHQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkVkaXRvck1vdXNlRG93bihlOiBJRWRpdG9yTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMubW91c2VEb3duSW5mbyA9IG51bGw7XG5cblx0XHRjb25zdCByYW5nZSA9IGUudGFyZ2V0LnJhbmdlO1xuXG5cdFx0aWYgKCFyYW5nZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghZS5ldmVudC5sZWZ0QnV0dG9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGUudGFyZ2V0LnR5cGUgIT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9ERUNPUkFUSU9OUykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIWUudGFyZ2V0LmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGUudGFyZ2V0LmVsZW1lbnQuY2xhc3NOYW1lLmluZGV4T2YoJ2RpcnR5LWRpZmYtZ2x5cGgnKSA8IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0gZS50YXJnZXQuZGV0YWlsO1xuXHRcdGNvbnN0IG9mZnNldExlZnRJbkd1dHRlciA9IGUudGFyZ2V0LmVsZW1lbnQub2Zmc2V0TGVmdDtcblx0XHRjb25zdCBndXR0ZXJPZmZzZXRYID0gZGF0YS5vZmZzZXRYIC0gb2Zmc2V0TGVmdEluR3V0dGVyO1xuXG5cdFx0Ly8gVE9ET0Bqb2FvIFRPRE9AYWxleCBUT0RPQG1hcnRpbiB0aGlzIGlzIHN1Y2ggdGhhdCB3ZSBkb24ndCBjb2xsaWRlIHdpdGggZm9sZGluZ1xuXHRcdGlmIChndXR0ZXJPZmZzZXRYIDwgLTMgfHwgZ3V0dGVyT2Zmc2V0WCA+IDMpIHsgLy8gZGlydHkgZGlmZiBkZWNvcmF0aW9uIG9uIGhvdmVyIGlzIDZweCB3aWRlXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5tb3VzZURvd25JbmZvID0geyBsaW5lTnVtYmVyOiByYW5nZS5zdGFydExpbmVOdW1iZXIgfTtcblx0fVxuXG5cdHByaXZhdGUgb25FZGl0b3JNb3VzZVVwKGU6IElFZGl0b3JNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm1vdXNlRG93bkluZm8pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB7IGxpbmVOdW1iZXIgfSA9IHRoaXMubW91c2VEb3duSW5mbztcblx0XHR0aGlzLm1vdXNlRG93bkluZm8gPSBudWxsO1xuXG5cdFx0Y29uc3QgcmFuZ2UgPSBlLnRhcmdldC5yYW5nZTtcblxuXHRcdGlmICghcmFuZ2UgfHwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICE9PSBsaW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGUudGFyZ2V0LnR5cGUgIT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9ERUNPUkFUSU9OUykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvck1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdGlmICghZWRpdG9yTW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbFJlZiA9IHRoaXMucXVpY2tEaWZmTW9kZWxTZXJ2aWNlLmNyZWF0ZVF1aWNrRGlmZk1vZGVsUmVmZXJlbmNlKGVkaXRvck1vZGVsLnVyaSk7XG5cblx0XHRpZiAoIW1vZGVsUmVmKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gbW9kZWxSZWYub2JqZWN0LmNoYW5nZXNcblx0XHRcdFx0LmZpbmRJbmRleChjaGFuZ2UgPT4gbGluZUludGVyc2VjdHNDaGFuZ2UobGluZU51bWJlciwgY2hhbmdlLmNoYW5nZSkpO1xuXG5cdFx0XHRpZiAoaW5kZXggPCAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluZGV4ID09PSB0aGlzLndpZGdldD8uaW5kZXgpIHtcblx0XHRcdFx0dGhpcy5jbG9zZSgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5uZXh0KGxpbmVOdW1iZXIpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRtb2RlbFJlZi5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmd1dHRlckFjdGlvbkRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNob3dQcmV2aW91c0NoYW5nZUFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBvdXRlckVkaXRvcj86IElDb2RlRWRpdG9yKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmRpcnR5ZGlmZi5wcmV2aW91cycsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignc2hvdyBwcmV2aW91cyBjaGFuZ2UnLCBcIlNob3cgUHJldmlvdXMgQ2hhbmdlXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBUZXh0Q29tcGFyZUVkaXRvckFjdGl2ZUNvbnRleHQudG9OZWdhdGVkKCksXG5cdFx0XHRrYk9wdHM6IHsga2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsIHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkYzLCB3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiB9XG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBvdXRlckVkaXRvciA9IHRoaXMub3V0ZXJFZGl0b3IgPz8gZ2V0T3V0ZXJFZGl0b3JGcm9tRGlmZkVkaXRvcihhY2Nlc3Nvcik7XG5cblx0XHRpZiAoIW91dGVyRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IFF1aWNrRGlmZkVkaXRvckNvbnRyb2xsZXIuZ2V0KG91dGVyRWRpdG9yKTtcblxuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghY29udHJvbGxlci5jYW5OYXZpZ2F0ZSgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29udHJvbGxlci5wcmV2aW91cygpO1xuXHR9XG59XG5yZWdpc3RlckVkaXRvckFjdGlvbihTaG93UHJldmlvdXNDaGFuZ2VBY3Rpb24pO1xuXG5leHBvcnQgY2xhc3MgU2hvd05leHRDaGFuZ2VBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgb3V0ZXJFZGl0b3I/OiBJQ29kZUVkaXRvcikge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5kaXJ0eWRpZmYubmV4dCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignc2hvdyBuZXh0IGNoYW5nZScsIFwiU2hvdyBOZXh0IENoYW5nZVwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogVGV4dENvbXBhcmVFZGl0b3JBY3RpdmVDb250ZXh0LnRvTmVnYXRlZCgpLFxuXHRcdFx0a2JPcHRzOiB7IGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLCBwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5GMywgd2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgfVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3V0ZXJFZGl0b3IgPSB0aGlzLm91dGVyRWRpdG9yID8/IGdldE91dGVyRWRpdG9yRnJvbURpZmZFZGl0b3IoYWNjZXNzb3IpO1xuXG5cdFx0aWYgKCFvdXRlckVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBRdWlja0RpZmZFZGl0b3JDb250cm9sbGVyLmdldChvdXRlckVkaXRvcik7XG5cblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWNvbnRyb2xsZXIuY2FuTmF2aWdhdGUoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnRyb2xsZXIubmV4dCgpO1xuXHR9XG59XG5yZWdpc3RlckVkaXRvckFjdGlvbihTaG93TmV4dENoYW5nZUFjdGlvbik7XG5cbmV4cG9ydCBjbGFzcyBHb3RvUHJldmlvdXNDaGFuZ2VBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3IucHJldmlvdXNDaGFuZ2UnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ21vdmUgdG8gcHJldmlvdXMgY2hhbmdlJywgXCJHbyB0byBQcmV2aW91cyBDaGFuZ2VcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChUZXh0Q29tcGFyZUVkaXRvckFjdGl2ZUNvbnRleHQudG9OZWdhdGVkKCksIHF1aWNrRGlmZkRlY29yYXRpb25Db3VudC5ub3RFcXVhbHNUbygwKSksXG5cdFx0XHRrYk9wdHM6IHsga2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsIHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkY1LCB3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiB9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBvdXRlckVkaXRvciA9IGdldE91dGVyRWRpdG9yRnJvbURpZmZFZGl0b3IoYWNjZXNzb3IpO1xuXHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0Y29uc3QgYWNjZXNzaWJpbGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUFjY2Vzc2liaWxpdHlTZXJ2aWNlKTtcblx0XHRjb25zdCBjb2RlRWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrRGlmZk1vZGVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tEaWZmTW9kZWxTZXJ2aWNlKTtcblxuXHRcdGlmICghb3V0ZXJFZGl0b3IgfHwgIW91dGVyRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbFJlZiA9IHF1aWNrRGlmZk1vZGVsU2VydmljZS5jcmVhdGVRdWlja0RpZmZNb2RlbFJlZmVyZW5jZShvdXRlckVkaXRvci5nZXRNb2RlbCgpLnVyaSk7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICghbW9kZWxSZWYgfHwgbW9kZWxSZWYub2JqZWN0LmNoYW5nZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IG91dGVyRWRpdG9yLmdldFBvc2l0aW9uKCkubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IGluZGV4ID0gbW9kZWxSZWYub2JqZWN0LmZpbmRQcmV2aW91c0Nsb3Nlc3RDaGFuZ2UobGluZU51bWJlciwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgY2hhbmdlID0gbW9kZWxSZWYub2JqZWN0LmNoYW5nZXNbaW5kZXhdO1xuXHRcdFx0YXdhaXQgcGxheUFjY2Vzc2liaWxpdHlTeW1ib2xGb3JDaGFuZ2UoY2hhbmdlLmNoYW5nZSwgYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UpO1xuXHRcdFx0c2V0UG9zaXRpb25BbmRTZWxlY3Rpb24oY2hhbmdlLmNoYW5nZSwgb3V0ZXJFZGl0b3IsIGFjY2Vzc2liaWxpdHlTZXJ2aWNlLCBjb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdG1vZGVsUmVmPy5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG59XG5yZWdpc3RlckVkaXRvckFjdGlvbihHb3RvUHJldmlvdXNDaGFuZ2VBY3Rpb24pO1xuXG5leHBvcnQgY2xhc3MgR290b05leHRDaGFuZ2VBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5lZGl0b3IubmV4dENoYW5nZScsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignbW92ZSB0byBuZXh0IGNoYW5nZScsIFwiR28gdG8gTmV4dCBDaGFuZ2VcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChUZXh0Q29tcGFyZUVkaXRvckFjdGl2ZUNvbnRleHQudG9OZWdhdGVkKCksIHF1aWNrRGlmZkRlY29yYXRpb25Db3VudC5ub3RFcXVhbHNUbygwKSksXG5cdFx0XHRrYk9wdHM6IHsga2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsIHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkY1LCB3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiB9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSA9IGFjY2Vzc29yLmdldChJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UpO1xuXHRcdGNvbnN0IG91dGVyRWRpdG9yID0gZ2V0T3V0ZXJFZGl0b3JGcm9tRGlmZkVkaXRvcihhY2Nlc3Nvcik7XG5cdFx0Y29uc3QgYWNjZXNzaWJpbGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUFjY2Vzc2liaWxpdHlTZXJ2aWNlKTtcblx0XHRjb25zdCBjb2RlRWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrRGlmZk1vZGVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tEaWZmTW9kZWxTZXJ2aWNlKTtcblxuXHRcdGlmICghb3V0ZXJFZGl0b3IgfHwgIW91dGVyRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbFJlZiA9IHF1aWNrRGlmZk1vZGVsU2VydmljZS5jcmVhdGVRdWlja0RpZmZNb2RlbFJlZmVyZW5jZShvdXRlckVkaXRvci5nZXRNb2RlbCgpLnVyaSk7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICghbW9kZWxSZWYgfHwgbW9kZWxSZWYub2JqZWN0LmNoYW5nZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IG91dGVyRWRpdG9yLmdldFBvc2l0aW9uKCkubGluZU51bWJlcjtcblx0XHRcdGNvbnN0IGluZGV4ID0gbW9kZWxSZWYub2JqZWN0LmZpbmROZXh0Q2xvc2VzdENoYW5nZShsaW5lTnVtYmVyLCBmYWxzZSk7XG5cdFx0XHRjb25zdCBjaGFuZ2UgPSBtb2RlbFJlZi5vYmplY3QuY2hhbmdlc1tpbmRleF0uY2hhbmdlO1xuXHRcdFx0YXdhaXQgcGxheUFjY2Vzc2liaWxpdHlTeW1ib2xGb3JDaGFuZ2UoY2hhbmdlLCBhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0XHRzZXRQb3NpdGlvbkFuZFNlbGVjdGlvbihjaGFuZ2UsIG91dGVyRWRpdG9yLCBhY2Nlc3NpYmlsaXR5U2VydmljZSwgY29kZUVkaXRvclNlcnZpY2UpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRtb2RlbFJlZj8uZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxufVxucmVnaXN0ZXJFZGl0b3JBY3Rpb24oR290b05leHRDaGFuZ2VBY3Rpb24pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJHb01lbnUsIHtcblx0Z3JvdXA6ICc3X2NoYW5nZV9uYXYnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmRpcnR5ZGlmZi5uZXh0Jyxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlHb3RvTmV4dENoYW5nZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJOZXh0ICYmQ2hhbmdlXCIpXG5cdH0sXG5cdG9yZGVyOiAxXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyR29NZW51LCB7XG5cdGdyb3VwOiAnN19jaGFuZ2VfbmF2Jyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5kaXJ0eWRpZmYucHJldmlvdXMnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUdvdG9QcmV2aW91c0NoYW5nZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJQcmV2aW91cyAmJkNoYW5nZVwiKVxuXHR9LFxuXHRvcmRlcjogMlxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2Nsb3NlUXVpY2tEaWZmJyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgKyA1MCxcblx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdHNlY29uZGFyeTogW0tleU1vZC5TaGlmdCB8IEtleUNvZGUuRXNjYXBlXSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKGlzUXVpY2tEaWZmVmlzaWJsZSksXG5cdGhhbmRsZXI6IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IG91dGVyRWRpdG9yID0gZ2V0T3V0ZXJFZGl0b3JGcm9tRGlmZkVkaXRvcihhY2Nlc3Nvcik7XG5cblx0XHRpZiAoIW91dGVyRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IFF1aWNrRGlmZkVkaXRvckNvbnRyb2xsZXIuZ2V0KG91dGVyRWRpdG9yKTtcblxuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnRyb2xsZXIuY2xvc2UoKTtcblx0fVxufSk7XG5cbmZ1bmN0aW9uIHNldFBvc2l0aW9uQW5kU2VsZWN0aW9uKGNoYW5nZTogSUNoYW5nZSwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSwgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSkge1xuXHRjb25zdCBwb3NpdGlvbiA9IG5ldyBQb3NpdGlvbihjaGFuZ2UubW9kaWZpZWRTdGFydExpbmVOdW1iZXIsIDEpO1xuXHRlZGl0b3Iuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuXHRlZGl0b3IucmV2ZWFsUG9zaXRpb25JbkNlbnRlcihwb3NpdGlvbik7XG5cdGlmIChhY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKSB7XG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbih7IHN0YXJ0TGluZU51bWJlcjogY2hhbmdlLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbjogMCwgZW5kTGluZU51bWJlcjogY2hhbmdlLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyLCBlbmRDb2x1bW46IE51bWJlci5NQVhfVkFMVUUgfSk7XG5cdFx0Y29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpPy53cml0ZVNjcmVlblJlYWRlckNvbnRlbnQoJ2RpZmYtbmF2aWdhdGlvbicpO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHBsYXlBY2Nlc3NpYmlsaXR5U3ltYm9sRm9yQ2hhbmdlKGNoYW5nZTogSUNoYW5nZSwgYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSkge1xuXHRjb25zdCBjaGFuZ2VUeXBlID0gZ2V0Q2hhbmdlVHlwZShjaGFuZ2UpO1xuXHRzd2l0Y2ggKGNoYW5nZVR5cGUpIHtcblx0XHRjYXNlIENoYW5nZVR5cGUuQWRkOlxuXHRcdFx0YWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmRpZmZMaW5lSW5zZXJ0ZWQsIHsgYWxsb3dNYW55SW5QYXJhbGxlbDogdHJ1ZSwgc291cmNlOiAncXVpY2tEaWZmRGVjb3JhdGlvbicgfSk7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlIENoYW5nZVR5cGUuRGVsZXRlOlxuXHRcdFx0YWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmRpZmZMaW5lRGVsZXRlZCwgeyBhbGxvd01hbnlJblBhcmFsbGVsOiB0cnVlLCBzb3VyY2U6ICdxdWlja0RpZmZEZWNvcmF0aW9uJyB9KTtcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgQ2hhbmdlVHlwZS5Nb2RpZnk6XG5cdFx0XHRhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwuZGlmZkxpbmVNb2RpZmllZCwgeyBhbGxvd01hbnlJblBhcmFsbGVsOiB0cnVlLCBzb3VyY2U6ICdxdWlja0RpZmZEZWNvcmF0aW9uJyB9KTtcblx0XHRcdGJyZWFrO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldE91dGVyRWRpdG9yRnJvbURpZmZFZGl0b3IoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBJQ29kZUVkaXRvciB8IG51bGwge1xuXHRjb25zdCBkaWZmRWRpdG9ycyA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmxpc3REaWZmRWRpdG9ycygpO1xuXG5cdGZvciAoY29uc3QgZGlmZkVkaXRvciBvZiBkaWZmRWRpdG9ycykge1xuXHRcdGlmIChkaWZmRWRpdG9yLmhhc1RleHRGb2N1cygpICYmIGRpZmZFZGl0b3IgaW5zdGFuY2VvZiBFbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQpIHtcblx0XHRcdHJldHVybiBkaWZmRWRpdG9yLmdldFBhcmVudEVkaXRvcigpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBnZXRPdXRlckVkaXRvcihhY2Nlc3Nvcik7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixZQUFZLFNBQVM7QUFDckIsWUFBWSxzQkFBc0I7QUFDbEMsU0FBUyxRQUFRLG9CQUE2QjtBQUM5QyxTQUFTLGFBQWE7QUFDdEIsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBc0IscUJBQXFCO0FBQzNDLFNBQVMsZ0JBQWdCLHlCQUF5Qix5QkFBeUIsNkJBQTZCLHNCQUFzQjtBQUM5SCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFnQixjQUFjLFFBQVEsZ0JBQWdCLG9CQUFvQjtBQUMxRSxTQUF5Qyx1QkFBdUI7QUFDaEUsU0FBUyxjQUFjLDRCQUE0QjtBQUNuRCxTQUFTLDZCQUErQztBQUN4RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdDQUFnQztBQUN6QyxTQUE4QixrQkFBa0I7QUFDaEQsU0FBUyw4QkFBOEM7QUFDdkQsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsU0FBUyxnQkFBNkIsb0JBQW9CLHFCQUFxQjtBQUMvRSxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLFdBQVc7QUFFcEIsU0FBUyxZQUFZLGlCQUFpQixlQUFlLG9CQUFvQiwwQkFBMEIsNEJBQTZDO0FBQ2hKLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCLHdCQUF3QjtBQUV0RCxTQUFTLHFCQUFxQixtQ0FBbUM7QUFDakUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxvQkFBd0M7QUFDakQsU0FBUyxnQkFB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QUFNO0FBQUEsRUFDekMsTUFBTSxlQUFlLElBQUksa0JBQWtCO0FBQUEsRUFDM0MsU0FBUyxDQUFDLGFBQStCO0FBQ3hDLFVBQU0sY0FBYyw2QkFBNkIsUUFBUTtBQUV6RCxRQUFJLENBQUMsYUFBYTtBQUNqQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLGFBQWEsMEJBQTBCLElBQUksV0FBVztBQUU1RCxRQUFJLENBQUMsWUFBWTtBQUNoQjtBQUFBLElBQ0Q7QUFFQSxlQUFXLE1BQU07QUFBQSxFQUNsQjtBQUNELENBQUM7QUFFRCxTQUFTLHdCQUF3QixRQUFpQixRQUFxQixzQkFBNkMsbUJBQXVDO0FBQzFKLFFBQU0sV0FBVyxJQUFJLFNBQVMsT0FBTyx5QkFBeUIsQ0FBQztBQUMvRCxTQUFPLFlBQVksUUFBUTtBQUMzQixTQUFPLHVCQUF1QixRQUFRO0FBQ3RDLE1BQUkscUJBQXFCLHdCQUF3QixHQUFHO0FBQ25ELFdBQU8sYUFBYSxFQUFFLGlCQUFpQixPQUFPLHlCQUF5QixhQUFhLEdBQUcsZUFBZSxPQUFPLHlCQUF5QixXQUFXLE9BQU8sVUFBVSxDQUFDO0FBQ25LLHNCQUFrQixvQkFBb0IsR0FBRyx5QkFBeUIsaUJBQWlCO0FBQUEsRUFDcEY7QUFDRDtBQUVBLGVBQWUsaUNBQWlDLFFBQWlCLDRCQUF5RDtBQUN6SCxRQUFNLGFBQWEsY0FBYyxNQUFNO0FBQ3ZDLFVBQVEsWUFBWTtBQUFBLElBQ25CLEtBQUssV0FBVztBQUNmLGlDQUEyQixXQUFXLG9CQUFvQixrQkFBa0IsRUFBRSxxQkFBcUIsTUFBTSxRQUFRLHNCQUFzQixDQUFDO0FBQ3hJO0FBQUEsSUFDRCxLQUFLLFdBQVc7QUFDZixpQ0FBMkIsV0FBVyxvQkFBb0IsaUJBQWlCLEVBQUUscUJBQXFCLE1BQU0sUUFBUSxzQkFBc0IsQ0FBQztBQUN2STtBQUFBLElBQ0QsS0FBSyxXQUFXO0FBQ2YsaUNBQTJCLFdBQVcsb0JBQW9CLGtCQUFrQixFQUFFLHFCQUFxQixNQUFNLFFBQVEsc0JBQXNCLENBQUM7QUFDeEk7QUFBQSxFQUNGO0FBQ0Q7QUFFQSxTQUFTLDZCQUE2QixVQUFnRDtBQUNyRixRQUFNLGNBQWMsU0FBUyxJQUFJLGtCQUFrQixFQUFFLGdCQUFnQjtBQUVyRSxhQUFXLGNBQWMsYUFBYTtBQUNyQyxRQUFJLFdBQVcsYUFBYSxLQUFLLHNCQUFzQiwwQkFBMEI7QUFDaEYsYUFBTyxXQUFXLGdCQUFnQjtBQUFBLElBQ25DO0FBQUEsRUFDRDtBQUVBLFNBQU8sZUFBZSxRQUFRO0FBQy9COyIsCiAgIm5hbWVzIjogWyJjaGFuZ2UiXQp9Cg==
