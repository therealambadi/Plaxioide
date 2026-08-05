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
import * as dom from "../../../../base/browser/dom.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { ActionBar, ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Action } from "../../../../base/common/actions.js";
import { mapFindFirst } from "../../../../base/common/arraysFind.js";
import { assert, assertNever } from "../../../../base/common/assert.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, derived, observableFromEvent } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { isUriComponents, URI } from "../../../../base/common/uri.js";
import { isCodeEditor, MouseTargetType, OverlayWidgetPositionPreference } from "../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { InjectedTextCursorStops } from "../../../../editor/common/model.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { bindContextKey, observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ActiveEditorContext } from "../../../common/contextkeys.js";
import { TEXT_FILE_EDITOR_ID } from "../../files/common/files.js";
import { getTestingConfiguration, TestingConfigKeys } from "../common/configuration.js";
import { TestCommandId } from "../common/constants.js";
import { FileCoverage } from "../common/testCoverage.js";
import { ITestCoverageService } from "../common/testCoverageService.js";
import { TestId } from "../common/testId.js";
import { ITestService } from "../common/testService.js";
import { DetailType } from "../common/testTypes.js";
import { TestingContextKeys } from "../common/testingContextKeys.js";
import * as coverUtils from "./codeCoverageDisplayUtils.js";
import { testingCoverageMissingBranch, testingCoverageReport, testingFilterIcon, testingRerunIcon } from "./icons.js";
import { ManagedTestCoverageBars } from "./testCoverageBars.js";
const CLASS_HIT = "coverage-deco-hit";
const CLASS_MISS = "coverage-deco-miss";
const TOGGLE_INLINE_COMMAND_TEXT = localize("testing.toggleInlineCoverage", "Toggle Inline");
const TOGGLE_INLINE_COMMAND_ID = "testing.toggleInlineCoverage";
const BRANCH_MISS_INDICATOR_CHARS = 4;
let CodeCoverageDecorations = class extends Disposable {
  constructor(editor, instantiationService, coverage, configurationService, log, contextKeyService) {
    super();
    this.editor = editor;
    this.coverage = coverage;
    this.log = log;
    this.displayedStore = this._register(new DisposableStore());
    this.hoveredStore = this._register(new DisposableStore());
    this.decorationIds = /* @__PURE__ */ new Map();
    this.summaryWidget = new Lazy(() => this._register(instantiationService.createInstance(CoverageToolbarWidget, this.editor)));
    const modelObs = observableFromEvent(this, editor.onDidChangeModel, () => editor.getModel());
    const configObs = observableFromEvent(this, editor.onDidChangeConfiguration, (i) => i);
    const fileCoverage = derived((reader) => {
      const report = coverage.selected.read(reader);
      if (!report) {
        return;
      }
      const model = modelObs.read(reader);
      if (!model) {
        return;
      }
      const file = report.getUri(model.uri);
      if (!file) {
        return;
      }
      report.didAddCoverage.read(reader);
      return { file, testId: coverage.filterToTest.read(reader) };
    });
    this._register(bindContextKey(
      TestingContextKeys.hasPerTestCoverage,
      contextKeyService,
      (reader) => !!fileCoverage.read(reader)?.file.perTestData?.size
    ));
    this._register(autorun((reader) => {
      const c = fileCoverage.read(reader);
      if (c) {
        this.apply(editor.getModel(), c.file, c.testId, coverage.showInline.read(reader));
      } else {
        this.clear();
      }
    }));
    const toolbarEnabled = observableConfigValue(TestingConfigKeys.CoverageToolbarEnabled, true, configurationService);
    this._register(autorun((reader) => {
      const c = fileCoverage.read(reader);
      if (c && toolbarEnabled.read(reader)) {
        this.summaryWidget.value.setCoverage(c.file, c.testId);
      } else {
        this.summaryWidget.rawValue?.clearCoverage();
      }
    }));
    this._register(autorun((reader) => {
      const c = fileCoverage.read(reader);
      if (c) {
        const evt = configObs.read(reader);
        if (evt?.hasChanged(EditorOption.lineHeight) !== false) {
          this.updateEditorStyles();
        }
      }
    }));
    this._register(editor.onMouseMove((e) => {
      const model = editor.getModel();
      if (e.target.type === MouseTargetType.GUTTER_LINE_NUMBERS && model) {
        this.hoverLineNumber(editor.getModel());
      } else if (coverage.showInline.get() && e.target.type === MouseTargetType.CONTENT_TEXT && model) {
        this.hoverInlineDecoration(model, e.target.position);
      } else {
        this.hoveredStore.clear();
      }
    }));
    this._register(editor.onWillChangeModel(() => {
      const model = editor.getModel();
      if (!this.details || !model) {
        return;
      }
      for (const decoration of model.getAllDecorations()) {
        const own = this.decorationIds.get(decoration.id);
        if (own) {
          own.detail.range = decoration.range;
        }
      }
    }));
  }
  updateEditorStyles() {
    const lineHeight = this.editor.getOption(EditorOption.lineHeight);
    const { style } = this.editor.getContainerDomNode();
    style.setProperty("--vscode-testing-coverage-lineHeight", `${lineHeight}px`);
  }
  hoverInlineDecoration(model, position) {
    const allDecorations = model.getDecorationsInRange(Range.fromPositions(position));
    const decoration = mapFindFirst(allDecorations, ({ id }) => this.decorationIds.has(id) ? { id, deco: this.decorationIds.get(id) } : void 0);
    if (decoration === this.hoveredSubject) {
      return;
    }
    this.hoveredStore.clear();
    this.hoveredSubject = decoration;
    if (!decoration) {
      return;
    }
    model.changeDecorations((e) => {
      e.changeDecorationOptions(decoration.id, {
        ...decoration.deco.options,
        className: `${decoration.deco.options.className} coverage-deco-hovered`
      });
    });
    this.hoveredStore.add(toDisposable(() => {
      this.hoveredSubject = void 0;
      model.changeDecorations((e) => {
        e.changeDecorationOptions(decoration.id, decoration.deco.options);
      });
    }));
  }
  hoverLineNumber(model) {
    if (this.hoveredSubject === "lineNo" || !this.details || this.coverage.showInline.get()) {
      return;
    }
    this.hoveredStore.clear();
    this.hoveredSubject = "lineNo";
    model.changeDecorations((e) => {
      for (const [id, decoration] of this.decorationIds) {
        const { applyHoverOptions, options } = decoration;
        const dup = { ...options };
        applyHoverOptions(dup);
        e.changeDecorationOptions(id, dup);
      }
    });
    this.hoveredStore.add(this.editor.onMouseLeave(() => {
      this.hoveredStore.clear();
    }));
    this.hoveredStore.add(toDisposable(() => {
      this.hoveredSubject = void 0;
      model.changeDecorations((e) => {
        for (const [id, decoration] of this.decorationIds) {
          e.changeDecorationOptions(id, decoration.options);
        }
      });
    }));
  }
  async apply(model, coverage, testId, showInlineByDefault) {
    const details = this.details = await this.loadDetails(coverage, testId, model);
    if (!details) {
      return this.clear();
    }
    this.displayedStore.clear();
    model.changeDecorations((e) => {
      for (const detailRange of details.ranges) {
        const { metadata: { detail, description }, range, primary } = detailRange;
        if (detail.type === DetailType.Branch) {
          const hits = detail.detail.branches[detail.branch].count;
          const cls = hits ? CLASS_HIT : CLASS_MISS;
          const showMissIndicator = !hits && range.isEmpty() && detail.detail.branches.some((b) => b.count);
          const options = {
            showIfCollapsed: showMissIndicator,
            // only avoid collapsing if we want to show the miss indicator
            description: "coverage-gutter",
            lineNumberClassName: `coverage-deco-gutter ${cls}`
          };
          const applyHoverOptions = (target) => {
            target.hoverMessage = description;
            if (showMissIndicator) {
              target.after = {
                content: "\xA0".repeat(BRANCH_MISS_INDICATOR_CHARS),
                // nbsp
                inlineClassName: `coverage-deco-branch-miss-indicator ${ThemeIcon.asClassName(testingCoverageMissingBranch)}`,
                inlineClassNameAffectsLetterSpacing: true,
                cursorStops: InjectedTextCursorStops.None
              };
            } else {
              target.className = `coverage-deco-inline ${cls}`;
              if (primary && typeof hits === "number") {
                target.before = countBadge(hits);
              }
            }
          };
          if (showInlineByDefault) {
            applyHoverOptions(options);
          }
          this.decorationIds.set(e.addDecoration(range, options), { options, applyHoverOptions, detail: detailRange });
        } else if (detail.type === DetailType.Statement) {
          const cls = detail.count ? CLASS_HIT : CLASS_MISS;
          const options = {
            showIfCollapsed: false,
            description: "coverage-inline",
            lineNumberClassName: `coverage-deco-gutter ${cls}`
          };
          const applyHoverOptions = (target) => {
            target.className = `coverage-deco-inline ${cls}`;
            target.hoverMessage = description;
            if (primary && typeof detail.count === "number") {
              target.before = countBadge(detail.count);
            }
          };
          if (showInlineByDefault) {
            applyHoverOptions(options);
          }
          this.decorationIds.set(e.addDecoration(range, options), { options, applyHoverOptions, detail: detailRange });
        }
      }
    });
    this.displayedStore.add(toDisposable(() => {
      model.changeDecorations((e) => {
        for (const decoration of this.decorationIds.keys()) {
          e.removeDecoration(decoration);
        }
        this.decorationIds.clear();
      });
    }));
  }
  clear() {
    this.loadingCancellation?.cancel();
    this.loadingCancellation = void 0;
    this.displayedStore.clear();
    this.hoveredStore.clear();
  }
  async loadDetails(coverage, testId, textModel) {
    const cts = this.loadingCancellation = new CancellationTokenSource();
    this.displayedStore.add(this.loadingCancellation);
    try {
      const details = testId ? await coverage.detailsForTest(testId, this.loadingCancellation.token) : await coverage.details(this.loadingCancellation.token);
      if (cts.token.isCancellationRequested) {
        return;
      }
      return new CoverageDetailsModel(details, textModel);
    } catch (e) {
      this.log.error("Error loading coverage details", e);
    }
    return void 0;
  }
};
CodeCoverageDecorations = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITestCoverageService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IContextKeyService)
], CodeCoverageDecorations);
const countBadge = (count) => {
  if (count === 0) {
    return void 0;
  }
  return {
    content: `${count > 99 ? "99+" : count}x`,
    cursorStops: InjectedTextCursorStops.None,
    inlineClassName: `coverage-deco-inline-count`,
    inlineClassNameAffectsLetterSpacing: true
  };
};
class CoverageDetailsModel {
  constructor(details, textModel) {
    this.details = details;
    this.ranges = [];
    const detailRanges = details.map((detail) => ({
      range: tidyLocation(detail.location),
      primary: true,
      metadata: { detail, description: this.describe(detail, textModel) }
    }));
    for (const { range, metadata: { detail } } of detailRanges) {
      if (detail.type === DetailType.Statement && detail.branches) {
        for (let i = 0; i < detail.branches.length; i++) {
          const branch = { type: DetailType.Branch, branch: i, detail };
          detailRanges.push({
            range: tidyLocation(detail.branches[i].location || Range.fromPositions(range.getEndPosition())),
            primary: true,
            metadata: {
              detail: branch,
              description: this.describe(branch, textModel)
            }
          });
        }
      }
    }
    detailRanges.sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range) || a.metadata.detail.type - b.metadata.detail.type);
    const stack = [];
    const result = this.ranges = [];
    const pop = () => {
      const next = stack.pop();
      const prev = stack[stack.length - 1];
      if (prev) {
        prev.range = prev.range.setStartPosition(next.range.endLineNumber, next.range.endColumn);
      }
      result.push(next);
    };
    for (const item of detailRanges) {
      const start = item.range.getStartPosition();
      while (stack[stack.length - 1]?.range.containsPosition(start) === false) {
        pop();
      }
      if (item.range.isEmpty()) {
        result.push(item);
        continue;
      }
      const prev = stack[stack.length - 1];
      if (prev) {
        const primary = prev.primary;
        const si = prev.range.setEndPosition(start.lineNumber, start.column);
        prev.range = prev.range.setStartPosition(item.range.endLineNumber, item.range.endColumn);
        prev.primary = false;
        if (prev.range.isEmpty()) {
          stack.pop();
        }
        result.push({ range: si, primary, metadata: prev.metadata });
      }
      stack.push(item);
    }
    while (stack.length) {
      pop();
    }
  }
  /** Gets the markdown description for the given detail */
  describe(detail, model) {
    if (detail.type === DetailType.Declaration) {
      return namedDetailLabel(detail.name, detail);
    } else if (detail.type === DetailType.Statement) {
      const text = wrapName(model.getValueInRange(tidyLocation(detail.location)).trim() || `<empty statement>`);
      if (detail.branches?.length) {
        const covered = detail.branches.filter((b) => !!b.count).length;
        return new MarkdownString().appendMarkdown(localize("coverage.branches", "{0} of {1} of branches in {2} were covered.", covered, detail.branches.length, text));
      } else {
        return namedDetailLabel(text, detail);
      }
    } else if (detail.type === DetailType.Branch) {
      const text = wrapName(model.getValueInRange(tidyLocation(detail.detail.location)).trim() || `<empty statement>`);
      const { count, label } = detail.detail.branches[detail.branch];
      const label2 = label ? wrapInBackticks(label) : `#${detail.branch + 1}`;
      if (!count) {
        return new MarkdownString().appendMarkdown(localize("coverage.branchNotCovered", "Branch {0} in {1} was not covered.", label2, text));
      } else if (count === true) {
        return new MarkdownString().appendMarkdown(localize("coverage.branchCoveredYes", "Branch {0} in {1} was executed.", label2, text));
      } else {
        return new MarkdownString().appendMarkdown(localize("coverage.branchCovered", "Branch {0} in {1} was executed {2} time(s).", label2, text, count));
      }
    }
    assertNever(detail);
  }
}
function namedDetailLabel(name, detail) {
  return new MarkdownString().appendMarkdown(
    !detail.count ? localize("coverage.declExecutedNo", "`{0}` was not executed.", name) : typeof detail.count === "number" ? localize("coverage.declExecutedCount", "`{0}` was executed {1} time(s).", name, detail.count) : localize("coverage.declExecutedYes", "`{0}` was executed.", name)
  );
}
function tidyLocation(location) {
  if (location instanceof Position) {
    return Range.fromPositions(location, new Position(location.lineNumber, 2147483647));
  }
  return location;
}
function wrapInBackticks(str) {
  return "`" + str.replace(/[\n\r`]/g, "") + "`";
}
function wrapName(functionNameOrCode) {
  if (functionNameOrCode.length > 50) {
    functionNameOrCode = functionNameOrCode.slice(0, 40) + "...";
  }
  return wrapInBackticks(functionNameOrCode);
}
let CoverageToolbarWidget = class extends Disposable {
  constructor(editor, configurationService, contextMenuService, testService, keybindingService, commandService, coverage, instaService) {
    super();
    this.editor = editor;
    this.configurationService = configurationService;
    this.contextMenuService = contextMenuService;
    this.testService = testService;
    this.keybindingService = keybindingService;
    this.commandService = commandService;
    this.coverage = coverage;
    this.registered = false;
    this.isRunning = false;
    this.showStore = this._register(new DisposableStore());
    this._domNode = dom.h("div.coverage-summary-widget", [
      dom.h("div", [
        dom.h("span.bars@bars"),
        dom.h("span.toolbar@toolbar")
      ])
    ]);
    this.bars = this._register(instaService.createInstance(ManagedTestCoverageBars, {
      compact: false,
      overall: false,
      container: this._domNode.bars
    }));
    this.actionBar = this._register(instaService.createInstance(ActionBar, this._domNode.toolbar, {
      orientation: ActionsOrientation.HORIZONTAL,
      actionViewItemProvider: (action, options) => {
        const vm = new CodiconActionViewItem(void 0, action, options);
        if (action instanceof ActionWithIcon) {
          vm.themeIcon = action.icon;
        }
        return vm;
      }
    }));
    this._register(autorun((reader) => {
      coverage.showInline.read(reader);
      this.setActions();
    }));
    this._register(dom.addStandardDisposableListener(this._domNode.root, dom.EventType.CONTEXT_MENU, (e) => {
      this.contextMenuService.showContextMenu({
        menuId: MenuId.StickyScrollContext,
        getAnchor: () => e
      });
    }));
  }
  /** @inheritdoc */
  getId() {
    return "coverage-summary-widget";
  }
  /** @inheritdoc */
  getDomNode() {
    return this._domNode.root;
  }
  /** @inheritdoc */
  getPosition() {
    return {
      preference: OverlayWidgetPositionPreference.TOP_CENTER,
      stackOridinal: 9
    };
  }
  clearCoverage() {
    this.current = void 0;
    this.bars.setCoverageInfo(void 0);
    this.hide();
  }
  setCoverage(coverage, testId) {
    this.current = { coverage, testId };
    this.bars.setCoverageInfo(coverage);
    if (!coverage) {
      this.hide();
    } else {
      this.setActions();
      this.show();
    }
  }
  setActions() {
    this.actionBar.clear();
    const current = this.current;
    if (!current) {
      return;
    }
    const toggleAction = new ActionWithIcon(
      "toggleInline",
      this.coverage.showInline.get() ? localize("testing.hideInlineCoverage", "Hide Inline Coverage") : localize("testing.showInlineCoverage", "Show Inline Coverage"),
      testingCoverageReport,
      void 0,
      () => this.coverage.showInline.set(!this.coverage.showInline.get(), void 0)
    );
    const kb = this.keybindingService.lookupKeybinding(TOGGLE_INLINE_COMMAND_ID);
    if (kb) {
      toggleAction.tooltip = `${TOGGLE_INLINE_COMMAND_TEXT} (${kb.getLabel()})`;
    }
    this.actionBar.push(toggleAction);
    if (current.testId) {
      const testItem = current.coverage.fromResult.getTestById(current.testId.toString());
      assert(!!testItem, "got coverage for an unreported test");
      this.actionBar.push(new ActionWithIcon(
        "perTestFilter",
        coverUtils.labels.showingFilterFor(testItem.label),
        testingFilterIcon,
        void 0,
        () => this.commandService.executeCommand(TestCommandId.CoverageFilterToTestInEditor, this.current, this.editor)
      ));
    } else if (current.coverage.perTestData?.size) {
      this.actionBar.push(new ActionWithIcon(
        "perTestFilter",
        localize("testing.coverageForTestAvailable", "{0} test(s) ran code in this file", current.coverage.perTestData.size),
        testingFilterIcon,
        void 0,
        () => this.commandService.executeCommand(TestCommandId.CoverageFilterToTestInEditor, this.current, this.editor)
      ));
    }
    this.actionBar.push(new ActionWithIcon(
      "rerun",
      localize("testing.rerun", "Rerun"),
      testingRerunIcon,
      !this.isRunning,
      () => this.rerunTest()
    ));
  }
  show() {
    if (this.registered) {
      return;
    }
    this.registered = true;
    let viewZoneId;
    const ds = this.showStore;
    this.editor.addOverlayWidget(this);
    this.editor.changeViewZones((accessor) => {
      viewZoneId = accessor.addZone({
        // make space for the widget
        afterLineNumber: 0,
        afterColumn: 0,
        domNode: document.createElement("div"),
        heightInPx: 30,
        ordinal: -1
        // show before code lenses
      });
    });
    ds.add(toDisposable(() => {
      this.registered = false;
      this.editor.removeOverlayWidget(this);
      this.editor.changeViewZones((accessor) => {
        accessor.removeZone(viewZoneId);
      });
    }));
    ds.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (this.current && (e.affectsConfiguration(TestingConfigKeys.CoverageBarThresholds) || e.affectsConfiguration(TestingConfigKeys.CoveragePercent))) {
        this.setCoverage(this.current.coverage, this.current.testId);
      }
    }));
  }
  rerunTest() {
    const current = this.current;
    if (current) {
      this.isRunning = true;
      this.setActions();
      this.testService.runResolvedTests(current.coverage.fromResult.request).finally(() => {
        this.isRunning = false;
        this.setActions();
      });
    }
  }
  hide() {
    this.showStore.clear();
  }
};
CoverageToolbarWidget = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, ITestService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, ITestCoverageService),
  __decorateParam(7, IInstantiationService)
], CoverageToolbarWidget);
registerAction2(class ToggleInlineCoverage extends Action2 {
  constructor() {
    super({
      id: TOGGLE_INLINE_COMMAND_ID,
      // note: ideally this would be "show inline", but the command palette does
      // not use the 'toggled' titles, so we need to make this generic.
      title: localize2("coverage.toggleInline", "Toggle Inline Coverage"),
      category: Categories.Test,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI)
      },
      toggled: {
        condition: TestingContextKeys.inlineCoverageEnabled,
        title: localize("coverage.hideInline", "Hide Inline Coverage")
      },
      icon: testingCoverageReport,
      menu: [
        { id: MenuId.CommandPalette, when: TestingContextKeys.isTestCoverageOpen },
        { id: MenuId.EditorTitle, when: ContextKeyExpr.and(TestingContextKeys.isTestCoverageOpen, TestingContextKeys.coverageToolbarEnabled.notEqualsTo(true)), group: "navigation" }
      ]
    });
  }
  run(accessor) {
    const coverage = accessor.get(ITestCoverageService);
    coverage.showInline.set(!coverage.showInline.get(), void 0);
  }
});
registerAction2(class ToggleCoverageToolbar extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CoverageToggleToolbar,
      title: localize2("testing.toggleToolbarTitle", "Test Coverage Toolbar"),
      metadata: {
        description: localize2("testing.toggleToolbarDesc", "Toggle the sticky coverage bar in the editor.")
      },
      category: Categories.Test,
      toggled: {
        condition: TestingContextKeys.coverageToolbarEnabled
      },
      menu: [
        { id: MenuId.CommandPalette, when: TestingContextKeys.isTestCoverageOpen },
        { id: MenuId.StickyScrollContext, when: TestingContextKeys.isTestCoverageOpen },
        { id: MenuId.EditorTitle, when: TestingContextKeys.isTestCoverageOpen, group: "coverage@1" }
      ]
    });
  }
  run(accessor) {
    const config = accessor.get(IConfigurationService);
    const value = getTestingConfiguration(config, TestingConfigKeys.CoverageToolbarEnabled);
    config.updateValue(TestingConfigKeys.CoverageToolbarEnabled, !value);
  }
});
registerAction2(class FilterCoverageToTestInEditor extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CoverageFilterToTestInEditor,
      title: localize2("testing.filterActionLabel", "Filter Coverage to Test"),
      category: Categories.Test,
      icon: Codicon.filter,
      toggled: {
        icon: Codicon.filterFilled,
        condition: TestingContextKeys.isCoverageFilteredToTest
      },
      menu: [
        {
          id: MenuId.EditorTitle,
          when: ContextKeyExpr.and(
            TestingContextKeys.isTestCoverageOpen,
            TestingContextKeys.coverageToolbarEnabled.notEqualsTo(true),
            TestingContextKeys.hasPerTestCoverage,
            ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID)
          ),
          group: "navigation"
        }
      ]
    });
  }
  run(accessor, coverageOrUri, editor) {
    const testCoverageService = accessor.get(ITestCoverageService);
    const quickInputService = accessor.get(IQuickInputService);
    const activeEditor = isCodeEditor(editor) ? editor : accessor.get(ICodeEditorService).getActiveCodeEditor();
    let coverage;
    if (coverageOrUri instanceof FileCoverage) {
      coverage = coverageOrUri;
    } else if (isUriComponents(coverageOrUri)) {
      coverage = testCoverageService.selected.get()?.getUri(URI.from(coverageOrUri));
    } else {
      const uri = activeEditor?.getModel()?.uri;
      coverage = uri && testCoverageService.selected.get()?.getUri(uri);
    }
    if (!coverage || !coverage.perTestData?.size) {
      return;
    }
    const tests = [...coverage.perTestData].map(TestId.fromString);
    const commonPrefix = TestId.getLengthOfCommonPrefix(tests.length, (i) => tests[i]);
    const result = coverage.fromResult;
    const previousSelection = testCoverageService.filterToTest.get();
    const items = [
      { label: coverUtils.labels.allTests, testId: void 0 },
      { type: "separator" },
      ...tests.map((id) => ({ label: coverUtils.getLabelForItem(result, id, commonPrefix), testId: id }))
    ];
    const scrollTop = activeEditor?.getScrollTop() || 0;
    const revealScrollCts = new MutableDisposable();
    quickInputService.pick(items, {
      activeItem: items.find((item) => "item" in item && item.item === coverage),
      placeHolder: coverUtils.labels.pickShowCoverage,
      onDidFocus: (entry) => {
        if (!entry.testId) {
          revealScrollCts.clear();
          activeEditor?.setScrollTop(scrollTop);
          testCoverageService.filterToTest.set(void 0, void 0);
        } else {
          const cts = revealScrollCts.value = new CancellationTokenSource();
          coverage.detailsForTest(entry.testId, cts.token).then(
            (details) => {
              const first = details.find((d) => d.type === DetailType.Statement);
              if (!cts.token.isCancellationRequested && first) {
                activeEditor?.revealLineNearTop(first.location instanceof Position ? first.location.lineNumber : first.location.startLineNumber);
              }
            },
            () => {
            }
          );
          testCoverageService.filterToTest.set(entry.testId, void 0);
        }
      }
    }).then((selected) => {
      if (!selected) {
        activeEditor?.setScrollTop(scrollTop);
      }
      revealScrollCts.dispose();
      testCoverageService.filterToTest.set(selected ? selected.testId : previousSelection, void 0);
    });
  }
});
class ActionWithIcon extends Action {
  constructor(id, title, icon, enabled, run) {
    super(id, title, void 0, enabled, run);
    this.icon = icon;
  }
}
class CodiconActionViewItem extends ActionViewItem {
  updateLabel() {
    if (this.options.label && this.label && this.themeIcon) {
      dom.reset(this.label, renderIcon(this.themeIcon), this.action.label);
    }
  }
}
export {
  CodeCoverageDecorations,
  CoverageDetailsModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvY29kZUNvdmVyYWdlRGVjb3JhdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciwgQWN0aW9uc09yaWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgcmVuZGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IG1hcEZpbmRGaXJzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5c0ZpbmQuanMnO1xuaW1wb3J0IHsgYXNzZXJ0LCBhc3NlcnROZXZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Fzc2VydC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nLCBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgZGVyaXZlZCwgb2JzZXJ2YWJsZUZyb21FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGlzVXJpQ29tcG9uZW50cywgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJT3ZlcmxheVdpZGdldCwgSU92ZXJsYXlXaWRnZXRQb3NpdGlvbiwgaXNDb2RlRWRpdG9yLCBNb3VzZVRhcmdldFR5cGUsIE92ZXJsYXlXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElNb2RlbERlY29yYXRpb25PcHRpb25zLCBJbmplY3RlZFRleHRDdXJzb3JTdG9wcywgSW5qZWN0ZWRUZXh0T3B0aW9ucywgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBiaW5kQ29udGV4dEtleSwgb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vcGxhdGZvcm1PYnNlcnZhYmxlVXRpbHMuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBRdWlja1BpY2tJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgQWN0aXZlRWRpdG9yQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBURVhUX0ZJTEVfRURJVE9SX0lEIH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IGdldFRlc3RpbmdDb25maWd1cmF0aW9uLCBUZXN0aW5nQ29uZmlnS2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb21tYW5kSWQgfSBmcm9tICcuLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEZpbGVDb3ZlcmFnZSB9IGZyb20gJy4uL2NvbW1vbi90ZXN0Q292ZXJhZ2UuanMnO1xuaW1wb3J0IHsgSVRlc3RDb3ZlcmFnZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdENvdmVyYWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SWQgfSBmcm9tICcuLi9jb21tb24vdGVzdElkLmpzJztcbmltcG9ydCB7IElUZXN0U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi90ZXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb3ZlcmFnZURldGFpbHMsIERldGFpbFR5cGUsIElEZWNsYXJhdGlvbkNvdmVyYWdlLCBJU3RhdGVtZW50Q292ZXJhZ2UgfSBmcm9tICcuLi9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IFRlc3RpbmdDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi90ZXN0aW5nQ29udGV4dEtleXMuanMnO1xuaW1wb3J0ICogYXMgY292ZXJVdGlscyBmcm9tICcuL2NvZGVDb3ZlcmFnZURpc3BsYXlVdGlscy5qcyc7XG5pbXBvcnQgeyB0ZXN0aW5nQ292ZXJhZ2VNaXNzaW5nQnJhbmNoLCB0ZXN0aW5nQ292ZXJhZ2VSZXBvcnQsIHRlc3RpbmdGaWx0ZXJJY29uLCB0ZXN0aW5nUmVydW5JY29uIH0gZnJvbSAnLi9pY29ucy5qcyc7XG5pbXBvcnQgeyBNYW5hZ2VkVGVzdENvdmVyYWdlQmFycyB9IGZyb20gJy4vdGVzdENvdmVyYWdlQmFycy5qcyc7XG5cbmNvbnN0IENMQVNTX0hJVCA9ICdjb3ZlcmFnZS1kZWNvLWhpdCc7XG5jb25zdCBDTEFTU19NSVNTID0gJ2NvdmVyYWdlLWRlY28tbWlzcyc7XG5jb25zdCBUT0dHTEVfSU5MSU5FX0NPTU1BTkRfVEVYVCA9IGxvY2FsaXplKCd0ZXN0aW5nLnRvZ2dsZUlubGluZUNvdmVyYWdlJywgJ1RvZ2dsZSBJbmxpbmUnKTtcbmNvbnN0IFRPR0dMRV9JTkxJTkVfQ09NTUFORF9JRCA9ICd0ZXN0aW5nLnRvZ2dsZUlubGluZUNvdmVyYWdlJztcbmNvbnN0IEJSQU5DSF9NSVNTX0lORElDQVRPUl9DSEFSUyA9IDQ7XG5cbmV4cG9ydCBjbGFzcyBDb2RlQ292ZXJhZ2VEZWNvcmF0aW9ucyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblx0cHJpdmF0ZSBsb2FkaW5nQ2FuY2VsbGF0aW9uPzogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcGxheWVkU3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGhvdmVyZWRTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgc3VtbWFyeVdpZGdldDogTGF6eTxDb3ZlcmFnZVRvb2xiYXJXaWRnZXQ+O1xuXHRwcml2YXRlIGRlY29yYXRpb25JZHMgPSBuZXcgTWFwPHN0cmluZywge1xuXHRcdGRldGFpbDogRGV0YWlsUmFuZ2U7XG5cdFx0b3B0aW9uczogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnM7XG5cdFx0YXBwbHlIb3Zlck9wdGlvbnModGFyZ2V0OiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyk6IHZvaWQ7XG5cdH0+KCk7XG5cdHByaXZhdGUgaG92ZXJlZFN1YmplY3Q/OiB1bmtub3duO1xuXHRwcml2YXRlIGRldGFpbHM/OiBDb3ZlcmFnZURldGFpbHNNb2RlbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVzdENvdmVyYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvdmVyYWdlOiBJVGVzdENvdmVyYWdlU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nOiBJTG9nU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnN1bW1hcnlXaWRnZXQgPSBuZXcgTGF6eSgoKSA9PiB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb3ZlcmFnZVRvb2xiYXJXaWRnZXQsIHRoaXMuZWRpdG9yKSkpO1xuXG5cdFx0Y29uc3QgbW9kZWxPYnMgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsIGVkaXRvci5vbkRpZENoYW5nZU1vZGVsLCAoKSA9PiBlZGl0b3IuZ2V0TW9kZWwoKSk7XG5cdFx0Y29uc3QgY29uZmlnT2JzID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCBlZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBpID0+IGkpO1xuXG5cdFx0Y29uc3QgZmlsZUNvdmVyYWdlID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgcmVwb3J0ID0gY292ZXJhZ2Uuc2VsZWN0ZWQucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFyZXBvcnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2RlbCA9IG1vZGVsT2JzLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghbW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmaWxlID0gcmVwb3J0LmdldFVyaShtb2RlbC51cmkpO1xuXHRcdFx0aWYgKCFmaWxlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0cmVwb3J0LmRpZEFkZENvdmVyYWdlLnJlYWQocmVhZGVyKTsgLy8gcmUtcmVhZCBpZiBjaGFuZ2VzIHdoZW4gdGhlcmUncyBubyByZXBvcnRcblx0XHRcdHJldHVybiB7IGZpbGUsIHRlc3RJZDogY292ZXJhZ2UuZmlsdGVyVG9UZXN0LnJlYWQocmVhZGVyKSB9O1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYmluZENvbnRleHRLZXkoXG5cdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuaGFzUGVyVGVzdENvdmVyYWdlLFxuXHRcdFx0Y29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRyZWFkZXIgPT4gISFmaWxlQ292ZXJhZ2UucmVhZChyZWFkZXIpPy5maWxlLnBlclRlc3REYXRhPy5zaXplLFxuXHRcdCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgYyA9IGZpbGVDb3ZlcmFnZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoYykge1xuXHRcdFx0XHR0aGlzLmFwcGx5KGVkaXRvci5nZXRNb2RlbCgpISwgYy5maWxlLCBjLnRlc3RJZCwgY292ZXJhZ2Uuc2hvd0lubGluZS5yZWFkKHJlYWRlcikpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5jbGVhcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHRvb2xiYXJFbmFibGVkID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlKFRlc3RpbmdDb25maWdLZXlzLkNvdmVyYWdlVG9vbGJhckVuYWJsZWQsIHRydWUsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBjID0gZmlsZUNvdmVyYWdlLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmIChjICYmIHRvb2xiYXJFbmFibGVkLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0XHR0aGlzLnN1bW1hcnlXaWRnZXQudmFsdWUuc2V0Q292ZXJhZ2UoYy5maWxlLCBjLnRlc3RJZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnN1bW1hcnlXaWRnZXQucmF3VmFsdWU/LmNsZWFyQ292ZXJhZ2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBjID0gZmlsZUNvdmVyYWdlLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmIChjKSB7XG5cdFx0XHRcdGNvbnN0IGV2dCA9IGNvbmZpZ09icy5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGlmIChldnQ/Lmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpICE9PSBmYWxzZSkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlRWRpdG9yU3R5bGVzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25Nb3VzZU1vdmUoZSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0aWYgKGUudGFyZ2V0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfTElORV9OVU1CRVJTICYmIG1vZGVsKSB7XG5cdFx0XHRcdHRoaXMuaG92ZXJMaW5lTnVtYmVyKGVkaXRvci5nZXRNb2RlbCgpISk7XG5cdFx0XHR9IGVsc2UgaWYgKGNvdmVyYWdlLnNob3dJbmxpbmUuZ2V0KCkgJiYgZS50YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVEVYVCAmJiBtb2RlbCkge1xuXHRcdFx0XHR0aGlzLmhvdmVySW5saW5lRGVjb3JhdGlvbihtb2RlbCwgZS50YXJnZXQucG9zaXRpb24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5ob3ZlcmVkU3RvcmUuY2xlYXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25XaWxsQ2hhbmdlTW9kZWwoKCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGlmICghdGhpcy5kZXRhaWxzIHx8ICFtb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIERlY29yYXRpb25zIGFkanVzdCB0byBsb2NhbCBjaGFuZ2VzIG1hZGUgaW4tZWRpdG9yLCBrZWVwIHRoZW0gc3luY2VkIGluIGNhc2UgdGhlIGZpbGUgaXMgcmVvcGVuZWQ6XG5cdFx0XHRmb3IgKGNvbnN0IGRlY29yYXRpb24gb2YgbW9kZWwuZ2V0QWxsRGVjb3JhdGlvbnMoKSkge1xuXHRcdFx0XHRjb25zdCBvd24gPSB0aGlzLmRlY29yYXRpb25JZHMuZ2V0KGRlY29yYXRpb24uaWQpO1xuXHRcdFx0XHRpZiAob3duKSB7XG5cdFx0XHRcdFx0b3duLmRldGFpbC5yYW5nZSA9IGRlY29yYXRpb24ucmFuZ2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUVkaXRvclN0eWxlcygpIHtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHRjb25zdCB7IHN0eWxlIH0gPSB0aGlzLmVkaXRvci5nZXRDb250YWluZXJEb21Ob2RlKCk7XG5cdFx0c3R5bGUuc2V0UHJvcGVydHkoJy0tdnNjb2RlLXRlc3RpbmctY292ZXJhZ2UtbGluZUhlaWdodCcsIGAke2xpbmVIZWlnaHR9cHhgKTtcblx0fVxuXG5cdHByaXZhdGUgaG92ZXJJbmxpbmVEZWNvcmF0aW9uKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24pIHtcblx0XHRjb25zdCBhbGxEZWNvcmF0aW9ucyA9IG1vZGVsLmdldERlY29yYXRpb25zSW5SYW5nZShSYW5nZS5mcm9tUG9zaXRpb25zKHBvc2l0aW9uKSk7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbiA9IG1hcEZpbmRGaXJzdChhbGxEZWNvcmF0aW9ucywgKHsgaWQgfSkgPT4gdGhpcy5kZWNvcmF0aW9uSWRzLmhhcyhpZCkgPyB7IGlkLCBkZWNvOiB0aGlzLmRlY29yYXRpb25JZHMuZ2V0KGlkKSEgfSA6IHVuZGVmaW5lZCk7XG5cdFx0aWYgKGRlY29yYXRpb24gPT09IHRoaXMuaG92ZXJlZFN1YmplY3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmhvdmVyZWRTdG9yZS5jbGVhcigpO1xuXHRcdHRoaXMuaG92ZXJlZFN1YmplY3QgPSBkZWNvcmF0aW9uO1xuXG5cdFx0aWYgKCFkZWNvcmF0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoZSA9PiB7XG5cdFx0XHRlLmNoYW5nZURlY29yYXRpb25PcHRpb25zKGRlY29yYXRpb24uaWQsIHtcblx0XHRcdFx0Li4uZGVjb3JhdGlvbi5kZWNvLm9wdGlvbnMsXG5cdFx0XHRcdGNsYXNzTmFtZTogYCR7ZGVjb3JhdGlvbi5kZWNvLm9wdGlvbnMuY2xhc3NOYW1lfSBjb3ZlcmFnZS1kZWNvLWhvdmVyZWRgLFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmhvdmVyZWRTdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuaG92ZXJlZFN1YmplY3QgPSB1bmRlZmluZWQ7XG5cdFx0XHRtb2RlbC5jaGFuZ2VEZWNvcmF0aW9ucyhlID0+IHtcblx0XHRcdFx0ZS5jaGFuZ2VEZWNvcmF0aW9uT3B0aW9ucyhkZWNvcmF0aW9uIS5pZCwgZGVjb3JhdGlvbiEuZGVjby5vcHRpb25zKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgaG92ZXJMaW5lTnVtYmVyKG1vZGVsOiBJVGV4dE1vZGVsKSB7XG5cdFx0aWYgKHRoaXMuaG92ZXJlZFN1YmplY3QgPT09ICdsaW5lTm8nIHx8ICF0aGlzLmRldGFpbHMgfHwgdGhpcy5jb3ZlcmFnZS5zaG93SW5saW5lLmdldCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5ob3ZlcmVkU3RvcmUuY2xlYXIoKTtcblx0XHR0aGlzLmhvdmVyZWRTdWJqZWN0ID0gJ2xpbmVObyc7XG5cblx0XHRtb2RlbC5jaGFuZ2VEZWNvcmF0aW9ucyhlID0+IHtcblx0XHRcdGZvciAoY29uc3QgW2lkLCBkZWNvcmF0aW9uXSBvZiB0aGlzLmRlY29yYXRpb25JZHMpIHtcblx0XHRcdFx0Y29uc3QgeyBhcHBseUhvdmVyT3B0aW9ucywgb3B0aW9ucyB9ID0gZGVjb3JhdGlvbjtcblx0XHRcdFx0Y29uc3QgZHVwID0geyAuLi5vcHRpb25zIH07XG5cdFx0XHRcdGFwcGx5SG92ZXJPcHRpb25zKGR1cCk7XG5cdFx0XHRcdGUuY2hhbmdlRGVjb3JhdGlvbk9wdGlvbnMoaWQsIGR1cCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLmhvdmVyZWRTdG9yZS5hZGQodGhpcy5lZGl0b3Iub25Nb3VzZUxlYXZlKCgpID0+IHtcblx0XHRcdHRoaXMuaG92ZXJlZFN0b3JlLmNsZWFyKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5ob3ZlcmVkU3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLmhvdmVyZWRTdWJqZWN0ID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRtb2RlbC5jaGFuZ2VEZWNvcmF0aW9ucyhlID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCBbaWQsIGRlY29yYXRpb25dIG9mIHRoaXMuZGVjb3JhdGlvbklkcykge1xuXHRcdFx0XHRcdGUuY2hhbmdlRGVjb3JhdGlvbk9wdGlvbnMoaWQsIGRlY29yYXRpb24ub3B0aW9ucyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYXBwbHkobW9kZWw6IElUZXh0TW9kZWwsIGNvdmVyYWdlOiBGaWxlQ292ZXJhZ2UsIHRlc3RJZDogVGVzdElkIHwgdW5kZWZpbmVkLCBzaG93SW5saW5lQnlEZWZhdWx0OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgZGV0YWlscyA9IHRoaXMuZGV0YWlscyA9IGF3YWl0IHRoaXMubG9hZERldGFpbHMoY292ZXJhZ2UsIHRlc3RJZCwgbW9kZWwpO1xuXHRcdGlmICghZGV0YWlscykge1xuXHRcdFx0cmV0dXJuIHRoaXMuY2xlYXIoKTtcblx0XHR9XG5cblx0XHR0aGlzLmRpc3BsYXllZFN0b3JlLmNsZWFyKCk7XG5cblx0XHRtb2RlbC5jaGFuZ2VEZWNvcmF0aW9ucyhlID0+IHtcblx0XHRcdGZvciAoY29uc3QgZGV0YWlsUmFuZ2Ugb2YgZGV0YWlscy5yYW5nZXMpIHtcblx0XHRcdFx0Y29uc3QgeyBtZXRhZGF0YTogeyBkZXRhaWwsIGRlc2NyaXB0aW9uIH0sIHJhbmdlLCBwcmltYXJ5IH0gPSBkZXRhaWxSYW5nZTtcblx0XHRcdFx0aWYgKGRldGFpbC50eXBlID09PSBEZXRhaWxUeXBlLkJyYW5jaCkge1xuXHRcdFx0XHRcdGNvbnN0IGhpdHMgPSBkZXRhaWwuZGV0YWlsLmJyYW5jaGVzIVtkZXRhaWwuYnJhbmNoXS5jb3VudDtcblx0XHRcdFx0XHRjb25zdCBjbHMgPSBoaXRzID8gQ0xBU1NfSElUIDogQ0xBU1NfTUlTUztcblx0XHRcdFx0XHQvLyBkb24ndCBib3RoZXIgc2hvd2luZyB0aGUgbWlzcyBpbmRpY2F0b3IgaWYgdGhlIGNvbmRpdGlvbiB3YXNuJ3QgZXhlY3V0ZWQgYXQgYWxsOlxuXHRcdFx0XHRcdGNvbnN0IHNob3dNaXNzSW5kaWNhdG9yID0gIWhpdHMgJiYgcmFuZ2UuaXNFbXB0eSgpICYmIGRldGFpbC5kZXRhaWwuYnJhbmNoZXMhLnNvbWUoYiA9PiBiLmNvdW50KTtcblx0XHRcdFx0XHRjb25zdCBvcHRpb25zOiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRcdHNob3dJZkNvbGxhcHNlZDogc2hvd01pc3NJbmRpY2F0b3IsIC8vIG9ubHkgYXZvaWQgY29sbGFwc2luZyBpZiB3ZSB3YW50IHRvIHNob3cgdGhlIG1pc3MgaW5kaWNhdG9yXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ2NvdmVyYWdlLWd1dHRlcicsXG5cdFx0XHRcdFx0XHRsaW5lTnVtYmVyQ2xhc3NOYW1lOiBgY292ZXJhZ2UtZGVjby1ndXR0ZXIgJHtjbHN9YCxcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0Y29uc3QgYXBwbHlIb3Zlck9wdGlvbnMgPSAodGFyZ2V0OiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucykgPT4ge1xuXHRcdFx0XHRcdFx0dGFyZ2V0LmhvdmVyTWVzc2FnZSA9IGRlc2NyaXB0aW9uO1xuXHRcdFx0XHRcdFx0aWYgKHNob3dNaXNzSW5kaWNhdG9yKSB7XG5cdFx0XHRcdFx0XHRcdHRhcmdldC5hZnRlciA9IHtcblx0XHRcdFx0XHRcdFx0XHRjb250ZW50OiAnXFx4YTAnLnJlcGVhdChCUkFOQ0hfTUlTU19JTkRJQ0FUT1JfQ0hBUlMpLCAvLyBuYnNwXG5cdFx0XHRcdFx0XHRcdFx0aW5saW5lQ2xhc3NOYW1lOiBgY292ZXJhZ2UtZGVjby1icmFuY2gtbWlzcy1pbmRpY2F0b3IgJHtUaGVtZUljb24uYXNDbGFzc05hbWUodGVzdGluZ0NvdmVyYWdlTWlzc2luZ0JyYW5jaCl9YCxcblx0XHRcdFx0XHRcdFx0XHRpbmxpbmVDbGFzc05hbWVBZmZlY3RzTGV0dGVyU3BhY2luZzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRjdXJzb3JTdG9wczogSW5qZWN0ZWRUZXh0Q3Vyc29yU3RvcHMuTm9uZSxcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRhcmdldC5jbGFzc05hbWUgPSBgY292ZXJhZ2UtZGVjby1pbmxpbmUgJHtjbHN9YDtcblx0XHRcdFx0XHRcdFx0aWYgKHByaW1hcnkgJiYgdHlwZW9mIGhpdHMgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGFyZ2V0LmJlZm9yZSA9IGNvdW50QmFkZ2UoaGl0cyk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0aWYgKHNob3dJbmxpbmVCeURlZmF1bHQpIHtcblx0XHRcdFx0XHRcdGFwcGx5SG92ZXJPcHRpb25zKG9wdGlvbnMpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuZGVjb3JhdGlvbklkcy5zZXQoZS5hZGREZWNvcmF0aW9uKHJhbmdlLCBvcHRpb25zKSwgeyBvcHRpb25zLCBhcHBseUhvdmVyT3B0aW9ucywgZGV0YWlsOiBkZXRhaWxSYW5nZSB9KTtcblx0XHRcdFx0fSBlbHNlIGlmIChkZXRhaWwudHlwZSA9PT0gRGV0YWlsVHlwZS5TdGF0ZW1lbnQpIHtcblx0XHRcdFx0XHRjb25zdCBjbHMgPSBkZXRhaWwuY291bnQgPyBDTEFTU19ISVQgOiBDTEFTU19NSVNTO1xuXHRcdFx0XHRcdGNvbnN0IG9wdGlvbnM6IElNb2RlbERlY29yYXRpb25PcHRpb25zID0ge1xuXHRcdFx0XHRcdFx0c2hvd0lmQ29sbGFwc2VkOiBmYWxzZSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnY292ZXJhZ2UtaW5saW5lJyxcblx0XHRcdFx0XHRcdGxpbmVOdW1iZXJDbGFzc05hbWU6IGBjb3ZlcmFnZS1kZWNvLWd1dHRlciAke2Nsc31gLFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRjb25zdCBhcHBseUhvdmVyT3B0aW9ucyA9ICh0YXJnZXQ6IElNb2RlbERlY29yYXRpb25PcHRpb25zKSA9PiB7XG5cdFx0XHRcdFx0XHR0YXJnZXQuY2xhc3NOYW1lID0gYGNvdmVyYWdlLWRlY28taW5saW5lICR7Y2xzfWA7XG5cdFx0XHRcdFx0XHR0YXJnZXQuaG92ZXJNZXNzYWdlID0gZGVzY3JpcHRpb247XG5cdFx0XHRcdFx0XHRpZiAocHJpbWFyeSAmJiB0eXBlb2YgZGV0YWlsLmNvdW50ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0XHR0YXJnZXQuYmVmb3JlID0gY291bnRCYWRnZShkZXRhaWwuY291bnQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRpZiAoc2hvd0lubGluZUJ5RGVmYXVsdCkge1xuXHRcdFx0XHRcdFx0YXBwbHlIb3Zlck9wdGlvbnMob3B0aW9ucyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5kZWNvcmF0aW9uSWRzLnNldChlLmFkZERlY29yYXRpb24ocmFuZ2UsIG9wdGlvbnMpLCB7IG9wdGlvbnMsIGFwcGx5SG92ZXJPcHRpb25zLCBkZXRhaWw6IGRldGFpbFJhbmdlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLmRpc3BsYXllZFN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0bW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoZSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiB0aGlzLmRlY29yYXRpb25JZHMua2V5cygpKSB7XG5cdFx0XHRcdFx0ZS5yZW1vdmVEZWNvcmF0aW9uKGRlY29yYXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuZGVjb3JhdGlvbklkcy5jbGVhcigpO1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpIHtcblx0XHR0aGlzLmxvYWRpbmdDYW5jZWxsYXRpb24/LmNhbmNlbCgpO1xuXHRcdHRoaXMubG9hZGluZ0NhbmNlbGxhdGlvbiA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmRpc3BsYXllZFN0b3JlLmNsZWFyKCk7XG5cdFx0dGhpcy5ob3ZlcmVkU3RvcmUuY2xlYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbG9hZERldGFpbHMoY292ZXJhZ2U6IEZpbGVDb3ZlcmFnZSwgdGVzdElkOiBUZXN0SWQgfCB1bmRlZmluZWQsIHRleHRNb2RlbDogSVRleHRNb2RlbCkge1xuXHRcdGNvbnN0IGN0cyA9IHRoaXMubG9hZGluZ0NhbmNlbGxhdGlvbiA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRoaXMuZGlzcGxheWVkU3RvcmUuYWRkKHRoaXMubG9hZGluZ0NhbmNlbGxhdGlvbik7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZGV0YWlscyA9IHRlc3RJZFxuXHRcdFx0XHQ/IGF3YWl0IGNvdmVyYWdlLmRldGFpbHNGb3JUZXN0KHRlc3RJZCwgdGhpcy5sb2FkaW5nQ2FuY2VsbGF0aW9uLnRva2VuKVxuXHRcdFx0XHQ6IGF3YWl0IGNvdmVyYWdlLmRldGFpbHModGhpcy5sb2FkaW5nQ2FuY2VsbGF0aW9uLnRva2VuKTtcblx0XHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyBDb3ZlcmFnZURldGFpbHNNb2RlbChkZXRhaWxzLCB0ZXh0TW9kZWwpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nLmVycm9yKCdFcnJvciBsb2FkaW5nIGNvdmVyYWdlIGRldGFpbHMnLCBlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmNvbnN0IGNvdW50QmFkZ2UgPSAoY291bnQ6IG51bWJlcik6IEluamVjdGVkVGV4dE9wdGlvbnMgfCB1bmRlZmluZWQgPT4ge1xuXHRpZiAoY291bnQgPT09IDApIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjb250ZW50OiBgJHtjb3VudCA+IDk5ID8gJzk5KycgOiBjb3VudH14YCxcblx0XHRjdXJzb3JTdG9wczogSW5qZWN0ZWRUZXh0Q3Vyc29yU3RvcHMuTm9uZSxcblx0XHRpbmxpbmVDbGFzc05hbWU6IGBjb3ZlcmFnZS1kZWNvLWlubGluZS1jb3VudGAsXG5cdFx0aW5saW5lQ2xhc3NOYW1lQWZmZWN0c0xldHRlclNwYWNpbmc6IHRydWUsXG5cdH07XG59O1xuXG50eXBlIENvdmVyYWdlRGV0YWlsc1dpdGhCcmFuY2ggPSBDb3ZlcmFnZURldGFpbHMgfCB7IHR5cGU6IERldGFpbFR5cGUuQnJhbmNoOyBicmFuY2g6IG51bWJlcjsgZGV0YWlsOiBJU3RhdGVtZW50Q292ZXJhZ2UgfTtcbnR5cGUgRGV0YWlsUmFuZ2UgPSB7IHJhbmdlOiBSYW5nZTsgcHJpbWFyeTogYm9vbGVhbjsgbWV0YWRhdGE6IHsgZGV0YWlsOiBDb3ZlcmFnZURldGFpbHNXaXRoQnJhbmNoOyBkZXNjcmlwdGlvbjogSU1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkIH0gfTtcblxuZXhwb3J0IGNsYXNzIENvdmVyYWdlRGV0YWlsc01vZGVsIHtcblx0cHVibGljIHJlYWRvbmx5IHJhbmdlczogRGV0YWlsUmFuZ2VbXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBkZXRhaWxzOiBDb3ZlcmFnZURldGFpbHNbXSwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsKSB7XG5cblx0XHQvLyNyZWdpb24gZGVjb3JhdGlvbiBnZW5lcmF0aW9uXG5cdFx0Ly8gQ292ZXJhZ2UgZnJvbSBhIHByb3ZpZGVyIGNhbiBoYXZlIGEgcmFuZ2UgdGhhdCBjb250YWlucyBzbWFsbGVyIHJhbmdlcyxcblx0XHQvLyBzdWNoIGFzIGEgZnVuY3Rpb24gZGVjbGFyYXRpb24gdGhhdCBoYXMgbmVzdGVkIHN0YXRlbWVudHMuIEluIHRoaXMgd2Vcblx0XHQvLyBtYWtlIHNlcXVlbnRpYWwsIG5vbi1vdmVybGFwcGluZyByYW5nZXMgZm9yIGVhY2ggZGV0YWlsIGZvciBkaXNwbGF5IGluXG5cdFx0Ly8gdGhlIGVkaXRvciB3aXRob3V0IHVnbHkgb3ZlcmxhcHMuXG5cdFx0Y29uc3QgZGV0YWlsUmFuZ2VzOiBEZXRhaWxSYW5nZVtdID0gZGV0YWlscy5tYXAoZGV0YWlsID0+ICh7XG5cdFx0XHRyYW5nZTogdGlkeUxvY2F0aW9uKGRldGFpbC5sb2NhdGlvbiksXG5cdFx0XHRwcmltYXJ5OiB0cnVlLFxuXHRcdFx0bWV0YWRhdGE6IHsgZGV0YWlsLCBkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmliZShkZXRhaWwsIHRleHRNb2RlbCkgfVxuXHRcdH0pKTtcblxuXHRcdGZvciAoY29uc3QgeyByYW5nZSwgbWV0YWRhdGE6IHsgZGV0YWlsIH0gfSBvZiBkZXRhaWxSYW5nZXMpIHtcblx0XHRcdGlmIChkZXRhaWwudHlwZSA9PT0gRGV0YWlsVHlwZS5TdGF0ZW1lbnQgJiYgZGV0YWlsLmJyYW5jaGVzKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZGV0YWlsLmJyYW5jaGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3QgYnJhbmNoOiBDb3ZlcmFnZURldGFpbHNXaXRoQnJhbmNoID0geyB0eXBlOiBEZXRhaWxUeXBlLkJyYW5jaCwgYnJhbmNoOiBpLCBkZXRhaWwgfTtcblx0XHRcdFx0XHRkZXRhaWxSYW5nZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRyYW5nZTogdGlkeUxvY2F0aW9uKGRldGFpbC5icmFuY2hlc1tpXS5sb2NhdGlvbiB8fCBSYW5nZS5mcm9tUG9zaXRpb25zKHJhbmdlLmdldEVuZFBvc2l0aW9uKCkpKSxcblx0XHRcdFx0XHRcdHByaW1hcnk6IHRydWUsXG5cdFx0XHRcdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRcdFx0XHRkZXRhaWw6IGJyYW5jaCxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IHRoaXMuZGVzY3JpYmUoYnJhbmNoLCB0ZXh0TW9kZWwpLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHR5cGUgb3JkZXJpbmcgaXMgZG9uZSBzbyB0aGF0IGZ1bmN0aW9uIGRlY2xhcmF0aW9ucyBjb21lIGZpcnN0IG9uIGEgdGllIHNvIHRoYXRcblx0XHQvLyBzaW5nbGUtc3RhdGVtZW50IGZ1bmN0aW9ucyAoYCgpID0+IGZvbygpYCBmb3IgZXhhbXBsZSkgZ2V0IGlubGluZSBkZWNvcmF0aW9ucy5cblx0XHRkZXRhaWxSYW5nZXMuc29ydCgoYSwgYikgPT4gUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKGEucmFuZ2UsIGIucmFuZ2UpIHx8IGEubWV0YWRhdGEuZGV0YWlsLnR5cGUgLSBiLm1ldGFkYXRhLmRldGFpbC50eXBlKTtcblxuXHRcdGNvbnN0IHN0YWNrOiBEZXRhaWxSYW5nZVtdID0gW107XG5cdFx0Y29uc3QgcmVzdWx0OiBEZXRhaWxSYW5nZVtdID0gdGhpcy5yYW5nZXMgPSBbXTtcblx0XHRjb25zdCBwb3AgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBuZXh0ID0gc3RhY2sucG9wKCkhO1xuXHRcdFx0Y29uc3QgcHJldiA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xuXHRcdFx0aWYgKHByZXYpIHtcblx0XHRcdFx0cHJldi5yYW5nZSA9IHByZXYucmFuZ2Uuc2V0U3RhcnRQb3NpdGlvbihuZXh0LnJhbmdlLmVuZExpbmVOdW1iZXIsIG5leHQucmFuZ2UuZW5kQ29sdW1uKTtcblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0LnB1c2gobmV4dCk7XG5cdFx0fTtcblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBkZXRhaWxSYW5nZXMpIHtcblx0XHRcdC8vIDEuIEVuc3VyZSB0aGF0IGFueSByYW5nZXMgaW4gdGhlIHN0YWNrIHRoYXQgZW5kZWQgYmVmb3JlIHRoaXMgYXJlIGZsdXNoZWRcblx0XHRcdGNvbnN0IHN0YXJ0ID0gaXRlbS5yYW5nZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdFx0XHR3aGlsZSAoc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0/LnJhbmdlLmNvbnRhaW5zUG9zaXRpb24oc3RhcnQpID09PSBmYWxzZSkge1xuXHRcdFx0XHRwb3AoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRW1wdHkgcmFuZ2VzICh1c3VhbGx5IHJlcHJlc2VudGluZyBtaXNzaW5nIGJyYW5jaGVzKSBjYW4gYmUgYWRkZWRcblx0XHRcdC8vIHdpdGhvdXQgd29ycnkgYWJvdXQgb3ZlcmxheS5cblx0XHRcdGlmIChpdGVtLnJhbmdlLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChpdGVtKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIDIuIFRha2UgdGhlIGxhc3QgKG92ZXJsYXBwaW5nKSBpdGVtIGluIHRoZSBzdGFjaywgcHVzaCByYW5nZSBiZWZvcmVcblx0XHRcdC8vIHRoZSBgaXRlbS5yYW5nZWAgaW50byB0aGUgcmVzdWx0IGFuZCBtb2RpZnkgaXRzIHN0YWNrIHRvIHB1c2ggdGhlIHN0YXJ0XG5cdFx0XHQvLyB1bnRpbCBhZnRlciB0aGUgYGl0ZW0ucmFuZ2VgIGVuZHMuXG5cdFx0XHRjb25zdCBwcmV2ID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG5cdFx0XHRpZiAocHJldikge1xuXHRcdFx0XHRjb25zdCBwcmltYXJ5ID0gcHJldi5wcmltYXJ5O1xuXHRcdFx0XHRjb25zdCBzaSA9IHByZXYucmFuZ2Uuc2V0RW5kUG9zaXRpb24oc3RhcnQubGluZU51bWJlciwgc3RhcnQuY29sdW1uKTtcblx0XHRcdFx0cHJldi5yYW5nZSA9IHByZXYucmFuZ2Uuc2V0U3RhcnRQb3NpdGlvbihpdGVtLnJhbmdlLmVuZExpbmVOdW1iZXIsIGl0ZW0ucmFuZ2UuZW5kQ29sdW1uKTtcblx0XHRcdFx0cHJldi5wcmltYXJ5ID0gZmFsc2U7XG5cdFx0XHRcdC8vIGRpc2NhcmQgdGhlIHByZXZpb3VzIHJhbmdlIGlmIGl0IGJlY2FtZSBlbXB0eSwgZS5nLiBhIG5lc3RlZCBzdGF0ZW1lbnRcblx0XHRcdFx0aWYgKHByZXYucmFuZ2UuaXNFbXB0eSgpKSB7IHN0YWNrLnBvcCgpOyB9XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHsgcmFuZ2U6IHNpLCBwcmltYXJ5LCBtZXRhZGF0YTogcHJldi5tZXRhZGF0YSB9KTtcblx0XHRcdH1cblxuXHRcdFx0c3RhY2sucHVzaChpdGVtKTtcblx0XHR9XG5cdFx0d2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuXHRcdFx0cG9wKCk7XG5cdFx0fVxuXHRcdC8vI2VuZHJlZ2lvblxuXHR9XG5cblx0LyoqIEdldHMgdGhlIG1hcmtkb3duIGRlc2NyaXB0aW9uIGZvciB0aGUgZ2l2ZW4gZGV0YWlsICovXG5cdHB1YmxpYyBkZXNjcmliZShkZXRhaWw6IENvdmVyYWdlRGV0YWlsc1dpdGhCcmFuY2gsIG1vZGVsOiBJVGV4dE1vZGVsKTogSU1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoZGV0YWlsLnR5cGUgPT09IERldGFpbFR5cGUuRGVjbGFyYXRpb24pIHtcblx0XHRcdHJldHVybiBuYW1lZERldGFpbExhYmVsKGRldGFpbC5uYW1lLCBkZXRhaWwpO1xuXHRcdH0gZWxzZSBpZiAoZGV0YWlsLnR5cGUgPT09IERldGFpbFR5cGUuU3RhdGVtZW50KSB7XG5cdFx0XHRjb25zdCB0ZXh0ID0gd3JhcE5hbWUobW9kZWwuZ2V0VmFsdWVJblJhbmdlKHRpZHlMb2NhdGlvbihkZXRhaWwubG9jYXRpb24pKS50cmltKCkgfHwgYDxlbXB0eSBzdGF0ZW1lbnQ+YCk7XG5cdFx0XHRpZiAoZGV0YWlsLmJyYW5jaGVzPy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgY292ZXJlZCA9IGRldGFpbC5icmFuY2hlcy5maWx0ZXIoYiA9PiAhIWIuY291bnQpLmxlbmd0aDtcblx0XHRcdFx0cmV0dXJuIG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKCdjb3ZlcmFnZS5icmFuY2hlcycsICd7MH0gb2YgezF9IG9mIGJyYW5jaGVzIGluIHsyfSB3ZXJlIGNvdmVyZWQuJywgY292ZXJlZCwgZGV0YWlsLmJyYW5jaGVzLmxlbmd0aCwgdGV4dCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIG5hbWVkRGV0YWlsTGFiZWwodGV4dCwgZGV0YWlsKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGRldGFpbC50eXBlID09PSBEZXRhaWxUeXBlLkJyYW5jaCkge1xuXHRcdFx0Y29uc3QgdGV4dCA9IHdyYXBOYW1lKG1vZGVsLmdldFZhbHVlSW5SYW5nZSh0aWR5TG9jYXRpb24oZGV0YWlsLmRldGFpbC5sb2NhdGlvbikpLnRyaW0oKSB8fCBgPGVtcHR5IHN0YXRlbWVudD5gKTtcblx0XHRcdGNvbnN0IHsgY291bnQsIGxhYmVsIH0gPSBkZXRhaWwuZGV0YWlsLmJyYW5jaGVzIVtkZXRhaWwuYnJhbmNoXTtcblx0XHRcdGNvbnN0IGxhYmVsMiA9IGxhYmVsID8gd3JhcEluQmFja3RpY2tzKGxhYmVsKSA6IGAjJHtkZXRhaWwuYnJhbmNoICsgMX1gO1xuXHRcdFx0aWYgKCFjb3VudCkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kTWFya2Rvd24obG9jYWxpemUoJ2NvdmVyYWdlLmJyYW5jaE5vdENvdmVyZWQnLCAnQnJhbmNoIHswfSBpbiB7MX0gd2FzIG5vdCBjb3ZlcmVkLicsIGxhYmVsMiwgdGV4dCkpO1xuXHRcdFx0fSBlbHNlIGlmIChjb3VudCA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kTWFya2Rvd24obG9jYWxpemUoJ2NvdmVyYWdlLmJyYW5jaENvdmVyZWRZZXMnLCAnQnJhbmNoIHswfSBpbiB7MX0gd2FzIGV4ZWN1dGVkLicsIGxhYmVsMiwgdGV4dCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKCdjb3ZlcmFnZS5icmFuY2hDb3ZlcmVkJywgJ0JyYW5jaCB7MH0gaW4gezF9IHdhcyBleGVjdXRlZCB7Mn0gdGltZShzKS4nLCBsYWJlbDIsIHRleHQsIGNvdW50KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXNzZXJ0TmV2ZXIoZGV0YWlsKTtcblx0fVxufVxuXG5mdW5jdGlvbiBuYW1lZERldGFpbExhYmVsKG5hbWU6IHN0cmluZywgZGV0YWlsOiBJU3RhdGVtZW50Q292ZXJhZ2UgfCBJRGVjbGFyYXRpb25Db3ZlcmFnZSkge1xuXHRyZXR1cm4gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kTWFya2Rvd24oXG5cdFx0IWRldGFpbC5jb3VudCAvLyAwIG9yIGZhbHNlXG5cdFx0XHQ/IGxvY2FsaXplKCdjb3ZlcmFnZS5kZWNsRXhlY3V0ZWRObycsICdgezB9YCB3YXMgbm90IGV4ZWN1dGVkLicsIG5hbWUpXG5cdFx0XHQ6IHR5cGVvZiBkZXRhaWwuY291bnQgPT09ICdudW1iZXInXG5cdFx0XHRcdD8gbG9jYWxpemUoJ2NvdmVyYWdlLmRlY2xFeGVjdXRlZENvdW50JywgJ2B7MH1gIHdhcyBleGVjdXRlZCB7MX0gdGltZShzKS4nLCBuYW1lLCBkZXRhaWwuY291bnQpXG5cdFx0XHRcdDogbG9jYWxpemUoJ2NvdmVyYWdlLmRlY2xFeGVjdXRlZFllcycsICdgezB9YCB3YXMgZXhlY3V0ZWQuJywgbmFtZSlcblx0KTtcbn1cblxuLy8gJ3RpZGllcycgdGhlIHJhbmdlIGJ5IG5vcm1hbGl6aW5nIGl0IGludG8gYSByYW5nZSBhbmQgcmVtb3ZpbmcgbGVhZGluZ1xuLy8gYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2UuXG5mdW5jdGlvbiB0aWR5TG9jYXRpb24obG9jYXRpb246IFJhbmdlIHwgUG9zaXRpb24pOiBSYW5nZSB7XG5cdGlmIChsb2NhdGlvbiBpbnN0YW5jZW9mIFBvc2l0aW9uKSB7XG5cdFx0cmV0dXJuIFJhbmdlLmZyb21Qb3NpdGlvbnMobG9jYXRpb24sIG5ldyBQb3NpdGlvbihsb2NhdGlvbi5saW5lTnVtYmVyLCAweDdGRkZGRkZGKSk7XG5cdH1cblxuXHRyZXR1cm4gbG9jYXRpb247XG59XG5cbmZ1bmN0aW9uIHdyYXBJbkJhY2t0aWNrcyhzdHI6IHN0cmluZykge1xuXHRyZXR1cm4gJ2AnICsgc3RyLnJlcGxhY2UoL1tcXG5cXHJgXS9nLCAnJykgKyAnYCc7XG59XG5cbmZ1bmN0aW9uIHdyYXBOYW1lKGZ1bmN0aW9uTmFtZU9yQ29kZTogc3RyaW5nKSB7XG5cdGlmIChmdW5jdGlvbk5hbWVPckNvZGUubGVuZ3RoID4gNTApIHtcblx0XHRmdW5jdGlvbk5hbWVPckNvZGUgPSBmdW5jdGlvbk5hbWVPckNvZGUuc2xpY2UoMCwgNDApICsgJy4uLic7XG5cdH1cblx0cmV0dXJuIHdyYXBJbkJhY2t0aWNrcyhmdW5jdGlvbk5hbWVPckNvZGUpO1xufVxuXG5jbGFzcyBDb3ZlcmFnZVRvb2xiYXJXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU92ZXJsYXlXaWRnZXQge1xuXHRwcml2YXRlIGN1cnJlbnQ6IHsgY292ZXJhZ2U6IEZpbGVDb3ZlcmFnZTsgdGVzdElkOiBUZXN0SWQgfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWdpc3RlcmVkID0gZmFsc2U7XG5cdHByaXZhdGUgaXNSdW5uaW5nID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgc2hvd1N0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBhY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZSA9IGRvbS5oKCdkaXYuY292ZXJhZ2Utc3VtbWFyeS13aWRnZXQnLCBbXG5cdFx0ZG9tLmgoJ2RpdicsIFtcblx0XHRcdGRvbS5oKCdzcGFuLmJhcnNAYmFycycpLFxuXHRcdFx0ZG9tLmgoJ3NwYW4udG9vbGJhckB0b29sYmFyJyksXG5cdFx0XSksXG5cdF0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgYmFyczogTWFuYWdlZFRlc3RDb3ZlcmFnZUJhcnM7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJVGVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXN0U2VydmljZTogSVRlc3RTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJVGVzdENvdmVyYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvdmVyYWdlOiBJVGVzdENvdmVyYWdlU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5iYXJzID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hbmFnZWRUZXN0Q292ZXJhZ2VCYXJzLCB7XG5cdFx0XHRjb21wYWN0OiBmYWxzZSxcblx0XHRcdG92ZXJhbGw6IGZhbHNlLFxuXHRcdFx0Y29udGFpbmVyOiB0aGlzLl9kb21Ob2RlLmJhcnMsXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5hY3Rpb25CYXIgPSB0aGlzLl9yZWdpc3RlcihpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQWN0aW9uQmFyLCB0aGlzLl9kb21Ob2RlLnRvb2xiYXIsIHtcblx0XHRcdG9yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0Y29uc3Qgdm0gPSBuZXcgQ29kaWNvbkFjdGlvblZpZXdJdGVtKHVuZGVmaW5lZCwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIEFjdGlvbldpdGhJY29uKSB7XG5cdFx0XHRcdFx0dm0udGhlbWVJY29uID0gYWN0aW9uLmljb247XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHZtO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y292ZXJhZ2Uuc2hvd0lubGluZS5yZWFkKHJlYWRlcik7XG5cdFx0XHR0aGlzLnNldEFjdGlvbnMoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fZG9tTm9kZS5yb290LCBkb20uRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgZSA9PiB7XG5cdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5TdGlja3lTY3JvbGxDb250ZXh0LFxuXHRcdFx0XHRnZXRBbmNob3I6ICgpID0+IGUsXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICdjb3ZlcmFnZS1zdW1tYXJ5LXdpZGdldCc7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9kb21Ob2RlLnJvb3Q7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIGdldFBvc2l0aW9uKCk6IElPdmVybGF5V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJlZmVyZW5jZTogT3ZlcmxheVdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5UT1BfQ0VOVEVSLFxuXHRcdFx0c3RhY2tPcmlkaW5hbDogOSxcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGNsZWFyQ292ZXJhZ2UoKSB7XG5cdFx0dGhpcy5jdXJyZW50ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuYmFycy5zZXRDb3ZlcmFnZUluZm8odW5kZWZpbmVkKTtcblx0XHR0aGlzLmhpZGUoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRDb3ZlcmFnZShjb3ZlcmFnZTogRmlsZUNvdmVyYWdlLCB0ZXN0SWQ6IFRlc3RJZCB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuY3VycmVudCA9IHsgY292ZXJhZ2UsIHRlc3RJZCB9O1xuXHRcdHRoaXMuYmFycy5zZXRDb3ZlcmFnZUluZm8oY292ZXJhZ2UpO1xuXG5cdFx0aWYgKCFjb3ZlcmFnZSkge1xuXHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2V0QWN0aW9ucygpO1xuXHRcdFx0dGhpcy5zaG93KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXRBY3Rpb25zKCkge1xuXHRcdHRoaXMuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0Y29uc3QgY3VycmVudCA9IHRoaXMuY3VycmVudDtcblx0XHRpZiAoIWN1cnJlbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0b2dnbGVBY3Rpb24gPSBuZXcgQWN0aW9uV2l0aEljb24oXG5cdFx0XHQndG9nZ2xlSW5saW5lJyxcblx0XHRcdHRoaXMuY292ZXJhZ2Uuc2hvd0lubGluZS5nZXQoKVxuXHRcdFx0XHQ/IGxvY2FsaXplKCd0ZXN0aW5nLmhpZGVJbmxpbmVDb3ZlcmFnZScsICdIaWRlIElubGluZSBDb3ZlcmFnZScpXG5cdFx0XHRcdDogbG9jYWxpemUoJ3Rlc3Rpbmcuc2hvd0lubGluZUNvdmVyYWdlJywgJ1Nob3cgSW5saW5lIENvdmVyYWdlJyksXG5cdFx0XHR0ZXN0aW5nQ292ZXJhZ2VSZXBvcnQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHQoKSA9PiB0aGlzLmNvdmVyYWdlLnNob3dJbmxpbmUuc2V0KCF0aGlzLmNvdmVyYWdlLnNob3dJbmxpbmUuZ2V0KCksIHVuZGVmaW5lZCksXG5cdFx0KTtcblxuXHRcdGNvbnN0IGtiID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKFRPR0dMRV9JTkxJTkVfQ09NTUFORF9JRCk7XG5cdFx0aWYgKGtiKSB7XG5cdFx0XHR0b2dnbGVBY3Rpb24udG9vbHRpcCA9IGAke1RPR0dMRV9JTkxJTkVfQ09NTUFORF9URVhUfSAoJHtrYi5nZXRMYWJlbCgpfSlgO1xuXHRcdH1cblxuXHRcdHRoaXMuYWN0aW9uQmFyLnB1c2godG9nZ2xlQWN0aW9uKTtcblxuXHRcdGlmIChjdXJyZW50LnRlc3RJZCkge1xuXHRcdFx0Y29uc3QgdGVzdEl0ZW0gPSBjdXJyZW50LmNvdmVyYWdlLmZyb21SZXN1bHQuZ2V0VGVzdEJ5SWQoY3VycmVudC50ZXN0SWQudG9TdHJpbmcoKSk7XG5cdFx0XHRhc3NlcnQoISF0ZXN0SXRlbSwgJ2dvdCBjb3ZlcmFnZSBmb3IgYW4gdW5yZXBvcnRlZCB0ZXN0Jyk7XG5cdFx0XHR0aGlzLmFjdGlvbkJhci5wdXNoKG5ldyBBY3Rpb25XaXRoSWNvbigncGVyVGVzdEZpbHRlcicsXG5cdFx0XHRcdGNvdmVyVXRpbHMubGFiZWxzLnNob3dpbmdGaWx0ZXJGb3IodGVzdEl0ZW0ubGFiZWwpLFxuXHRcdFx0XHR0ZXN0aW5nRmlsdGVySWNvbixcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFRlc3RDb21tYW5kSWQuQ292ZXJhZ2VGaWx0ZXJUb1Rlc3RJbkVkaXRvciwgdGhpcy5jdXJyZW50LCB0aGlzLmVkaXRvciksXG5cdFx0XHQpKTtcblx0XHR9IGVsc2UgaWYgKGN1cnJlbnQuY292ZXJhZ2UucGVyVGVzdERhdGE/LnNpemUpIHtcblx0XHRcdHRoaXMuYWN0aW9uQmFyLnB1c2gobmV3IEFjdGlvbldpdGhJY29uKCdwZXJUZXN0RmlsdGVyJyxcblx0XHRcdFx0bG9jYWxpemUoJ3Rlc3RpbmcuY292ZXJhZ2VGb3JUZXN0QXZhaWxhYmxlJywgXCJ7MH0gdGVzdChzKSByYW4gY29kZSBpbiB0aGlzIGZpbGVcIiwgY3VycmVudC5jb3ZlcmFnZS5wZXJUZXN0RGF0YS5zaXplKSxcblx0XHRcdFx0dGVzdGluZ0ZpbHRlckljb24sXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0KCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChUZXN0Q29tbWFuZElkLkNvdmVyYWdlRmlsdGVyVG9UZXN0SW5FZGl0b3IsIHRoaXMuY3VycmVudCwgdGhpcy5lZGl0b3IpLFxuXHRcdFx0KSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5hY3Rpb25CYXIucHVzaChuZXcgQWN0aW9uV2l0aEljb24oXG5cdFx0XHQncmVydW4nLFxuXHRcdFx0bG9jYWxpemUoJ3Rlc3RpbmcucmVydW4nLCAnUmVydW4nKSxcblx0XHRcdHRlc3RpbmdSZXJ1bkljb24sXG5cdFx0XHQhdGhpcy5pc1J1bm5pbmcsXG5cdFx0XHQoKSA9PiB0aGlzLnJlcnVuVGVzdCgpXG5cdFx0KSk7XG5cdH1cblxuXHRwcml2YXRlIHNob3coKSB7XG5cdFx0aWYgKHRoaXMucmVnaXN0ZXJlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMucmVnaXN0ZXJlZCA9IHRydWU7XG5cdFx0bGV0IHZpZXdab25lSWQ6IHN0cmluZztcblx0XHRjb25zdCBkcyA9IHRoaXMuc2hvd1N0b3JlO1xuXG5cdFx0dGhpcy5lZGl0b3IuYWRkT3ZlcmxheVdpZGdldCh0aGlzKTtcblx0XHR0aGlzLmVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0dmlld1pvbmVJZCA9IGFjY2Vzc29yLmFkZFpvbmUoeyAvLyBtYWtlIHNwYWNlIGZvciB0aGUgd2lkZ2V0XG5cdFx0XHRcdGFmdGVyTGluZU51bWJlcjogMCxcblx0XHRcdFx0YWZ0ZXJDb2x1bW46IDAsXG5cdFx0XHRcdGRvbU5vZGU6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuXHRcdFx0XHRoZWlnaHRJblB4OiAzMCxcblx0XHRcdFx0b3JkaW5hbDogLTEsIC8vIHNob3cgYmVmb3JlIGNvZGUgbGVuc2VzXG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdGRzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5yZWdpc3RlcmVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLmVkaXRvci5yZW1vdmVPdmVybGF5V2lkZ2V0KHRoaXMpO1xuXHRcdFx0dGhpcy5lZGl0b3IuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZSh2aWV3Wm9uZUlkKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdGRzLmFkZCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmICh0aGlzLmN1cnJlbnQgJiYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVzdGluZ0NvbmZpZ0tleXMuQ292ZXJhZ2VCYXJUaHJlc2hvbGRzKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlc3RpbmdDb25maWdLZXlzLkNvdmVyYWdlUGVyY2VudCkpKSB7XG5cdFx0XHRcdHRoaXMuc2V0Q292ZXJhZ2UodGhpcy5jdXJyZW50LmNvdmVyYWdlLCB0aGlzLmN1cnJlbnQudGVzdElkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlcnVuVGVzdCgpIHtcblx0XHRjb25zdCBjdXJyZW50ID0gdGhpcy5jdXJyZW50O1xuXHRcdGlmIChjdXJyZW50KSB7XG5cdFx0XHR0aGlzLmlzUnVubmluZyA9IHRydWU7XG5cdFx0XHR0aGlzLnNldEFjdGlvbnMoKTtcblx0XHRcdHRoaXMudGVzdFNlcnZpY2UucnVuUmVzb2x2ZWRUZXN0cyhjdXJyZW50LmNvdmVyYWdlLmZyb21SZXN1bHQucmVxdWVzdCkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuaXNSdW5uaW5nID0gZmFsc2U7XG5cdFx0XHRcdHRoaXMuc2V0QWN0aW9ucygpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoaWRlKCkge1xuXHRcdHRoaXMuc2hvd1N0b3JlLmNsZWFyKCk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFRvZ2dsZUlubGluZUNvdmVyYWdlIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUT0dHTEVfSU5MSU5FX0NPTU1BTkRfSUQsXG5cdFx0XHQvLyBub3RlOiBpZGVhbGx5IHRoaXMgd291bGQgYmUgXCJzaG93IGlubGluZVwiLCBidXQgdGhlIGNvbW1hbmQgcGFsZXR0ZSBkb2VzXG5cdFx0XHQvLyBub3QgdXNlIHRoZSAndG9nZ2xlZCcgdGl0bGVzLCBzbyB3ZSBuZWVkIHRvIG1ha2UgdGhpcyBnZW5lcmljLlxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY292ZXJhZ2UudG9nZ2xlSW5saW5lJywgXCJUb2dnbGUgSW5saW5lIENvdmVyYWdlXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVGVzdCxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TZW1pY29sb24sIEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlJKSxcblx0XHRcdH0sXG5cdFx0XHR0b2dnbGVkOiB7XG5cdFx0XHRcdGNvbmRpdGlvbjogVGVzdGluZ0NvbnRleHRLZXlzLmlubGluZUNvdmVyYWdlRW5hYmxlZCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjb3ZlcmFnZS5oaWRlSW5saW5lJywgXCJIaWRlIElubGluZSBDb3ZlcmFnZVwiKSxcblx0XHRcdH0sXG5cdFx0XHRpY29uOiB0ZXN0aW5nQ292ZXJhZ2VSZXBvcnQsXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgd2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmlzVGVzdENvdmVyYWdlT3BlbiB9LFxuXHRcdFx0XHR7IGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsIHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUZXN0aW5nQ29udGV4dEtleXMuaXNUZXN0Q292ZXJhZ2VPcGVuLCBUZXN0aW5nQ29udGV4dEtleXMuY292ZXJhZ2VUb29sYmFyRW5hYmxlZC5ub3RFcXVhbHNUbyh0cnVlKSksIGdyb3VwOiAnbmF2aWdhdGlvbicgfSxcblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBjb3ZlcmFnZSA9IGFjY2Vzc29yLmdldChJVGVzdENvdmVyYWdlU2VydmljZSk7XG5cdFx0Y292ZXJhZ2Uuc2hvd0lubGluZS5zZXQoIWNvdmVyYWdlLnNob3dJbmxpbmUuZ2V0KCksIHVuZGVmaW5lZCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlQ292ZXJhZ2VUb29sYmFyIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNvdmVyYWdlVG9nZ2xlVG9vbGJhcixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcudG9nZ2xlVG9vbGJhclRpdGxlJywgXCJUZXN0IENvdmVyYWdlIFRvb2xiYXJcIiksXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUyKCd0ZXN0aW5nLnRvZ2dsZVRvb2xiYXJEZXNjJywgJ1RvZ2dsZSB0aGUgc3RpY2t5IGNvdmVyYWdlIGJhciBpbiB0aGUgZWRpdG9yLicpXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVGVzdCxcblx0XHRcdHRvZ2dsZWQ6IHtcblx0XHRcdFx0Y29uZGl0aW9uOiBUZXN0aW5nQ29udGV4dEtleXMuY292ZXJhZ2VUb29sYmFyRW5hYmxlZCxcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgd2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmlzVGVzdENvdmVyYWdlT3BlbiB9LFxuXHRcdFx0XHR7IGlkOiBNZW51SWQuU3RpY2t5U2Nyb2xsQ29udGV4dCwgd2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmlzVGVzdENvdmVyYWdlT3BlbiB9LFxuXHRcdFx0XHR7IGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsIHdoZW46IFRlc3RpbmdDb250ZXh0S2V5cy5pc1Rlc3RDb3ZlcmFnZU9wZW4sIGdyb3VwOiAnY292ZXJhZ2VAMScgfSxcblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbmZpZyA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHZhbHVlID0gZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24oY29uZmlnLCBUZXN0aW5nQ29uZmlnS2V5cy5Db3ZlcmFnZVRvb2xiYXJFbmFibGVkKTtcblx0XHRjb25maWcudXBkYXRlVmFsdWUoVGVzdGluZ0NvbmZpZ0tleXMuQ292ZXJhZ2VUb29sYmFyRW5hYmxlZCwgIXZhbHVlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGaWx0ZXJDb3ZlcmFnZVRvVGVzdEluRWRpdG9yIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNvdmVyYWdlRmlsdGVyVG9UZXN0SW5FZGl0b3IsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmZpbHRlckFjdGlvbkxhYmVsJywgXCJGaWx0ZXIgQ292ZXJhZ2UgdG8gVGVzdFwiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlRlc3QsXG5cdFx0XHRpY29uOiBDb2RpY29uLmZpbHRlcixcblx0XHRcdHRvZ2dsZWQ6IHtcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5maWx0ZXJGaWxsZWQsXG5cdFx0XHRcdGNvbmRpdGlvbjogVGVzdGluZ0NvbnRleHRLZXlzLmlzQ292ZXJhZ2VGaWx0ZXJlZFRvVGVzdCxcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5pc1Rlc3RDb3ZlcmFnZU9wZW4sXG5cdFx0XHRcdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuY292ZXJhZ2VUb29sYmFyRW5hYmxlZC5ub3RFcXVhbHNUbyh0cnVlKSxcblx0XHRcdFx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5oYXNQZXJUZXN0Q292ZXJhZ2UsXG5cdFx0XHRcdFx0XHRBY3RpdmVFZGl0b3JDb250ZXh0LmlzRXF1YWxUbyhURVhUX0ZJTEVfRURJVE9SX0lEKSxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdH0sXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvdmVyYWdlT3JVcmk/OiBGaWxlQ292ZXJhZ2UgfCBVUkksIGVkaXRvcj86IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgdGVzdENvdmVyYWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdENvdmVyYWdlU2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBpc0NvZGVFZGl0b3IoZWRpdG9yKSA/IGVkaXRvciA6IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmdldEFjdGl2ZUNvZGVFZGl0b3IoKTtcblx0XHRsZXQgY292ZXJhZ2U6IEZpbGVDb3ZlcmFnZSB8IHVuZGVmaW5lZDtcblx0XHRpZiAoY292ZXJhZ2VPclVyaSBpbnN0YW5jZW9mIEZpbGVDb3ZlcmFnZSkge1xuXHRcdFx0Y292ZXJhZ2UgPSBjb3ZlcmFnZU9yVXJpO1xuXHRcdH0gZWxzZSBpZiAoaXNVcmlDb21wb25lbnRzKGNvdmVyYWdlT3JVcmkpKSB7XG5cdFx0XHRjb3ZlcmFnZSA9IHRlc3RDb3ZlcmFnZVNlcnZpY2Uuc2VsZWN0ZWQuZ2V0KCk/LmdldFVyaShVUkkuZnJvbShjb3ZlcmFnZU9yVXJpKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHVyaSA9IGFjdGl2ZUVkaXRvcj8uZ2V0TW9kZWwoKT8udXJpO1xuXHRcdFx0Y292ZXJhZ2UgPSB1cmkgJiYgdGVzdENvdmVyYWdlU2VydmljZS5zZWxlY3RlZC5nZXQoKT8uZ2V0VXJpKHVyaSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFjb3ZlcmFnZSB8fCAhY292ZXJhZ2UucGVyVGVzdERhdGE/LnNpemUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXN0cyA9IFsuLi5jb3ZlcmFnZS5wZXJUZXN0RGF0YV0ubWFwKFRlc3RJZC5mcm9tU3RyaW5nKTtcblx0XHRjb25zdCBjb21tb25QcmVmaXggPSBUZXN0SWQuZ2V0TGVuZ3RoT2ZDb21tb25QcmVmaXgodGVzdHMubGVuZ3RoLCBpID0+IHRlc3RzW2ldKTtcblx0XHRjb25zdCByZXN1bHQgPSBjb3ZlcmFnZS5mcm9tUmVzdWx0O1xuXHRcdGNvbnN0IHByZXZpb3VzU2VsZWN0aW9uID0gdGVzdENvdmVyYWdlU2VydmljZS5maWx0ZXJUb1Rlc3QuZ2V0KCk7XG5cblx0XHR0eXBlIFRJdGVtID0geyBsYWJlbDogc3RyaW5nOyB0ZXN0SWQ6IFRlc3RJZCB8IHVuZGVmaW5lZCB9O1xuXG5cdFx0Y29uc3QgaXRlbXM6IFF1aWNrUGlja0lucHV0PFRJdGVtPltdID0gW1xuXHRcdFx0eyBsYWJlbDogY292ZXJVdGlscy5sYWJlbHMuYWxsVGVzdHMsIHRlc3RJZDogdW5kZWZpbmVkIH0sXG5cdFx0XHR7IHR5cGU6ICdzZXBhcmF0b3InIH0sXG5cdFx0XHQuLi50ZXN0cy5tYXAoaWQgPT4gKHsgbGFiZWw6IGNvdmVyVXRpbHMuZ2V0TGFiZWxGb3JJdGVtKHJlc3VsdCwgaWQsIGNvbW1vblByZWZpeCksIHRlc3RJZDogaWQgfSkpLFxuXHRcdF07XG5cblx0XHQvLyBUaGVzZSBoYW5kbGUgdGhlIGJlaGF2aW9yIHRoYXQgcmV2ZWFscyB0aGUgc3RhcnQgb2YgY292ZXJhZ2Ugd2hlbiB0aGVcblx0XHQvLyB1c2VyIHBpY2tzIGZyb20gdGhlIHF1aWNrcGljay4gU2Nyb2xsIHBvc2l0aW9uIGlzIHJlc3RvcmVkIGlmIHRoZSB1c2VyXG5cdFx0Ly8gZXhpdHMgd2l0aG91dCBwaWNraW5nIGFuIGl0ZW0sIG9yIHBpY2tzIFwiYWxsIHRldHNcIi5cblx0XHRjb25zdCBzY3JvbGxUb3AgPSBhY3RpdmVFZGl0b3I/LmdldFNjcm9sbFRvcCgpIHx8IDA7XG5cdFx0Y29uc3QgcmV2ZWFsU2Nyb2xsQ3RzID0gbmV3IE11dGFibGVEaXNwb3NhYmxlPENhbmNlbGxhdGlvblRva2VuU291cmNlPigpO1xuXG5cdFx0cXVpY2tJbnB1dFNlcnZpY2UucGljayhpdGVtcywge1xuXHRcdFx0YWN0aXZlSXRlbTogaXRlbXMuZmluZCgoaXRlbSk6IGl0ZW0gaXMgVEl0ZW0gPT4gJ2l0ZW0nIGluIGl0ZW0gJiYgaXRlbS5pdGVtID09PSBjb3ZlcmFnZSksXG5cdFx0XHRwbGFjZUhvbGRlcjogY292ZXJVdGlscy5sYWJlbHMucGlja1Nob3dDb3ZlcmFnZSxcblx0XHRcdG9uRGlkRm9jdXM6IChlbnRyeSkgPT4ge1xuXHRcdFx0XHRpZiAoIWVudHJ5LnRlc3RJZCkge1xuXHRcdFx0XHRcdHJldmVhbFNjcm9sbEN0cy5jbGVhcigpO1xuXHRcdFx0XHRcdGFjdGl2ZUVkaXRvcj8uc2V0U2Nyb2xsVG9wKHNjcm9sbFRvcCk7XG5cdFx0XHRcdFx0dGVzdENvdmVyYWdlU2VydmljZS5maWx0ZXJUb1Rlc3Quc2V0KHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBjdHMgPSByZXZlYWxTY3JvbGxDdHMudmFsdWUgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdFx0XHRjb3ZlcmFnZS5kZXRhaWxzRm9yVGVzdChlbnRyeS50ZXN0SWQsIGN0cy50b2tlbikudGhlbihcblx0XHRcdFx0XHRcdGRldGFpbHMgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBmaXJzdCA9IGRldGFpbHMuZmluZChkID0+IGQudHlwZSA9PT0gRGV0YWlsVHlwZS5TdGF0ZW1lbnQpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIWN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCAmJiBmaXJzdCkge1xuXHRcdFx0XHRcdFx0XHRcdGFjdGl2ZUVkaXRvcj8ucmV2ZWFsTGluZU5lYXJUb3AoZmlyc3QubG9jYXRpb24gaW5zdGFuY2VvZiBQb3NpdGlvbiA/IGZpcnN0LmxvY2F0aW9uLmxpbmVOdW1iZXIgOiBmaXJzdC5sb2NhdGlvbi5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0KCkgPT4geyAvKiBpZ25vcmVkICovIH1cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdHRlc3RDb3ZlcmFnZVNlcnZpY2UuZmlsdGVyVG9UZXN0LnNldChlbnRyeS50ZXN0SWQsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSkudGhlbihzZWxlY3RlZCA9PiB7XG5cdFx0XHRpZiAoIXNlbGVjdGVkKSB7XG5cdFx0XHRcdGFjdGl2ZUVkaXRvcj8uc2V0U2Nyb2xsVG9wKHNjcm9sbFRvcCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldmVhbFNjcm9sbEN0cy5kaXNwb3NlKCk7XG5cdFx0XHR0ZXN0Q292ZXJhZ2VTZXJ2aWNlLmZpbHRlclRvVGVzdC5zZXQoc2VsZWN0ZWQgPyBzZWxlY3RlZC50ZXN0SWQgOiBwcmV2aW91c1NlbGVjdGlvbiwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblx0fVxufSk7XG5cbmNsYXNzIEFjdGlvbldpdGhJY29uIGV4dGVuZHMgQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZywgcHVibGljIHJlYWRvbmx5IGljb246IFRoZW1lSWNvbiwgZW5hYmxlZDogYm9vbGVhbiB8IHVuZGVmaW5lZCwgcnVuOiAoKSA9PiB2b2lkKSB7XG5cdFx0c3VwZXIoaWQsIHRpdGxlLCB1bmRlZmluZWQsIGVuYWJsZWQsIHJ1bik7XG5cdH1cbn1cblxuY2xhc3MgQ29kaWNvbkFjdGlvblZpZXdJdGVtIGV4dGVuZHMgQWN0aW9uVmlld0l0ZW0ge1xuXG5cdHB1YmxpYyB0aGVtZUljb24/OiBUaGVtZUljb247XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUxhYmVsKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLm9wdGlvbnMubGFiZWwgJiYgdGhpcy5sYWJlbCAmJiB0aGlzLnRoZW1lSWNvbikge1xuXHRcdFx0ZG9tLnJlc2V0KHRoaXMubGFiZWwsIHJlbmRlckljb24odGhpcy50aGVtZUljb24pLCB0aGlzLmFjdGlvbi5sYWJlbCk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFdBQVcsMEJBQTBCO0FBQzlDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsY0FBYztBQUN2QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFFBQVEsbUJBQW1CO0FBQ3BDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZUFBZTtBQUN4QixTQUEwQixzQkFBc0I7QUFDaEQsU0FBUyxVQUFVLFNBQVMsY0FBYztBQUMxQyxTQUFTLFlBQVk7QUFDckIsU0FBUyxZQUFZLGlCQUFpQixtQkFBbUIsb0JBQW9CO0FBQzdFLFNBQVMsU0FBUyxTQUFTLDJCQUEyQjtBQUN0RCxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGlCQUFpQixXQUFXO0FBQ3JDLFNBQThELGNBQWMsaUJBQWlCLHVDQUF1QztBQUNwSSxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFFdEIsU0FBa0MsK0JBQWdFO0FBQ2xHLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBQ2pELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0JBQWdCLDBCQUEwQjtBQUNuRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDZCQUErQztBQUN4RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdCQUFnQiw2QkFBNkI7QUFDdEQs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
