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
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { DefaultKeyboardNavigationDelegate } from "../../../../base/browser/ui/list/listWidget.js";
import { TreeVisibility } from "../../../../base/browser/ui/tree/tree.js";
import { Action, ActionRunner, Separator } from "../../../../base/common/actions.js";
import { mapFindFirst } from "../../../../base/common/arraysFind.js";
import { RunOnceScheduler, disposableTimeout } from "../../../../base/common/async.js";
import { groupBy } from "../../../../base/common/collections.js";
import { Color, RGBA } from "../../../../base/common/color.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent } from "../../../../base/common/observable.js";
import { fuzzyContains } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { isDefined } from "../../../../base/common/types.js";
import { MarkdownRenderer } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { localize } from "../../../../nls.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { MenuEntryActionViewItem, createActionViewItem, getActionBarActions, getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { UnmanagedProgress } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from "../../../../platform/storage/common/storage.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { foreground } from "../../../../platform/theme/common/colorRegistry.js";
import { spinningLoading } from "../../../../platform/theme/common/iconRegistry.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { DiffEditorInput } from "../../../common/editor/diffEditorInput.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IActivityService, IconBadge, NumberBadge } from "../../../services/activity/common/activity.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { TestingConfigKeys, TestingCountBadge, getTestingConfiguration } from "../common/configuration.js";
import { TestCommandId, TestExplorerViewMode, TestExplorerViewSorting, Testing, labelForTestInState } from "../common/constants.js";
import { StoredValue } from "../common/storedValue.js";
import { ITestExplorerFilterState, TestFilterTerm } from "../common/testExplorerFilterState.js";
import { TestId } from "../common/testId.js";
import { ITestProfileService, canUseProfileWithTest } from "../common/testProfileService.js";
import { LiveTestResult, TestResultItemChangeReason } from "../common/testResult.js";
import { ITestResultService } from "../common/testResultService.js";
import { ITestService, testCollectionIsEmpty } from "../common/testService.js";
import { TestControllerCapability, TestItemExpandState, TestResultState, TestRunProfileBitset, testProfileBitset, testResultStateToContextValues } from "../common/testTypes.js";
import { TestingContextKeys } from "../common/testingContextKeys.js";
import { ITestingContinuousRunService } from "../common/testingContinuousRunService.js";
import { ITestingPeekOpener } from "../common/testingPeekOpener.js";
import { cmpPriority, isFailedState, isStateWithResult, statesInOrder } from "../common/testingStates.js";
import { TestItemTreeElement, TestTreeErrorMessage } from "./explorerProjections/index.js";
import { ListProjection } from "./explorerProjections/listProjection.js";
import { getTestItemContextOverlay } from "./explorerProjections/testItemContextOverlay.js";
import { TestingObjectTree } from "./explorerProjections/testingObjectTree.js";
import { TreeProjection } from "./explorerProjections/treeProjection.js";
import * as icons from "./icons.js";
import "./media/testing.css";
import { DebugLastRun, ReRunLastRun } from "./testExplorerActions.js";
import { TestingExplorerFilter } from "./testingExplorerFilter.js";
import { collectTestStateCounts, getTestProgressText } from "./testingProgressUiService.js";
var LastFocusState = /* @__PURE__ */ ((LastFocusState2) => {
  LastFocusState2[LastFocusState2["Input"] = 0] = "Input";
  LastFocusState2[LastFocusState2["Tree"] = 1] = "Tree";
  return LastFocusState2;
})(LastFocusState || {});
let TestingExplorerView = class extends ViewPane {
  constructor(options, contextMenuService, keybindingService, configurationService, instantiationService, viewDescriptorService, contextKeyService, openerService, themeService, testService, hoverService, testProfileService, commandService, menuService, crService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.testService = testService;
    this.testProfileService = testProfileService;
    this.commandService = commandService;
    this.menuService = menuService;
    this.crService = crService;
    this.filterActionBar = this._register(new MutableDisposable());
    this.discoveryProgress = this._register(new MutableDisposable());
    this.filter = this._register(new MutableDisposable());
    this.filterFocusListener = this._register(new MutableDisposable());
    this.dimensions = { width: 0, height: 0 };
    this.lastFocusState = 0 /* Input */;
    const relayout = this._register(new RunOnceScheduler(() => this.layoutBody(), 1));
    this._register(this.onDidChangeViewWelcomeState(() => {
      if (!this.shouldShowWelcome()) {
        relayout.schedule();
      }
    }));
    this._register(Event.any(crService.onDidChange, testProfileService.onDidChange)(() => {
      this.updateActions();
    }));
    this._register(testService.collection.onBusyProvidersChange((busy) => {
      this.updateDiscoveryProgress(busy);
    }));
    this._register(testProfileService.onDidChange(() => this.updateActions()));
  }
  get focusedTreeElements() {
    return this.viewModel.tree.getFocus().filter(isDefined);
  }
  shouldShowWelcome() {
    return this.viewModel?.welcomeExperience === 1 /* ForWorkspace */;
  }
  focus() {
    super.focus();
    if (this.lastFocusState === 1 /* Tree */) {
      this.viewModel.tree.domFocus();
    } else {
      this.filter.value?.focus();
    }
  }
  /**
   * Gets include/exclude items in the tree, based either on visible tests
   * or a use selection. If a profile is given, only tests in that profile
   * are collected. If a bitset is given, any test that can run in that
   * bitset is collected.
   */
  getTreeIncludeExclude(profileOrBitset, withinItems, filterToType = "visible") {
    const projection = this.viewModel.projection.value;
    if (!projection) {
      return { include: [], exclude: [] };
    }
    const include = /* @__PURE__ */ new Set();
    const exclude = [];
    const runnableWithProfileOrBitset = /* @__PURE__ */ new Map();
    const isRunnableWithProfileOrBitset = (item) => {
      let value = runnableWithProfileOrBitset.get(item);
      if (value === void 0) {
        value = typeof profileOrBitset === "number" ? !!this.testProfileService.getDefaultProfileForTest(profileOrBitset, item) : canUseProfileWithTest(profileOrBitset, item);
        runnableWithProfileOrBitset.set(item, value);
      }
      return value;
    };
    const attempt = (element, alreadyIncluded) => {
      if (!(element instanceof TestItemTreeElement) || !this.viewModel.tree.hasElement(element)) {
        return;
      }
      const inTree = this.viewModel.tree.getNode(element);
      if (!inTree.visible) {
        if (alreadyIncluded) {
          exclude.push(element.test);
        }
        return;
      }
      const visibleRunnableChildren = inTree.children.filter(
        (c) => c.visible && c.element instanceof TestItemTreeElement && isRunnableWithProfileOrBitset(c.element.test)
      ).length;
      if (
        // If it's not already included...
        !alreadyIncluded && isRunnableWithProfileOrBitset(element.test) && (visibleRunnableChildren === 0 || visibleRunnableChildren * 2 >= inTree.children.length) && visibleRunnableChildren !== 1
      ) {
        include.add(element.test);
        alreadyIncluded = true;
      }
      for (const child of element.children) {
        attempt(child, alreadyIncluded);
      }
    };
    if (filterToType === "selected") {
      const sel = this.viewModel.tree.getSelection().filter(isDefined);
      if (sel.length) {
        L:
          for (const node of sel) {
            if (node instanceof TestItemTreeElement) {
              for (let i = node; i; i = i.parent) {
                if (include.has(i.test)) {
                  continue L;
                }
              }
              include.add(node.test);
              node.children.forEach((c) => attempt(c, true));
            }
          }
        return { include: [...include], exclude };
      }
    }
    for (const root of withinItems || this.testService.collection.rootItems) {
      const element = projection.getElementByTestId(root.item.extId);
      if (!element) {
        continue;
      }
      if (typeof profileOrBitset === "object" && !canUseProfileWithTest(profileOrBitset, root)) {
        continue;
      }
      if (!this.viewModel.tree.hasElement(element)) {
        const visibleChildren = [...element.children].reduce((acc, c) => this.viewModel.tree.hasElement(c) && this.viewModel.tree.getNode(c).visible ? acc + 1 : acc, 0);
        if (element.children.size > 0 && visibleChildren * 2 >= element.children.size) {
          include.add(element.test);
          element.children.forEach((c) => attempt(c, true));
        } else {
          element.children.forEach((c) => attempt(c, false));
        }
      } else {
        attempt(element, false);
      }
    }
    return { include: [...include], exclude };
  }
  render() {
    super.render();
    this._register(registerNavigableContainer({
      name: "testingExplorerView",
      focusNotifiers: [this],
      focusNextWidget: () => {
        if (!this.viewModel.tree.isDOMFocused()) {
          this.viewModel.tree.domFocus();
        }
      },
      focusPreviousWidget: () => {
        if (this.viewModel.tree.isDOMFocused()) {
          this.filter.value?.focus();
        }
      }
    }));
  }
  /**
   * @override
   */
  renderBody(container) {
    super.renderBody(container);
    this.container = dom.append(container, dom.$(".test-explorer"));
    this.treeHeader = dom.append(this.container, dom.$(".test-explorer-header"));
    this.filterActionBar.value = this.createFilterActionBar();
    const messagesContainer = dom.append(this.treeHeader, dom.$(".result-summary-container"));
    this._register(this.instantiationService.createInstance(ResultSummaryView, messagesContainer));
    const listContainer = dom.append(this.container, dom.$(".test-explorer-tree"));
    this.viewModel = this.instantiationService.createInstance(TestingExplorerViewModel, listContainer, this.onDidChangeBodyVisibility);
    this._register(this.viewModel.tree.onDidFocus(() => this.lastFocusState = 1 /* Tree */));
    this._register(this.viewModel.onChangeWelcomeVisibility(() => this._onDidChangeViewWelcomeState.fire()));
    this._register(this.viewModel);
    this._onDidChangeViewWelcomeState.fire();
  }
  /** @override  */
  createActionViewItem(action, options) {
    switch (action.id) {
      case TestCommandId.FilterAction:
        this.filter.value = this.instantiationService.createInstance(TestingExplorerFilter, action, options);
        this.filterFocusListener.value = this.filter.value.onDidFocus(() => this.lastFocusState = 0 /* Input */);
        return this.filter.value;
      case TestCommandId.RunSelectedAction:
        return this.getRunGroupDropdown(TestRunProfileBitset.Run, action, options);
      case TestCommandId.DebugSelectedAction:
        return this.getRunGroupDropdown(TestRunProfileBitset.Debug, action, options);
      case TestCommandId.StartContinousRun:
      case TestCommandId.StopContinousRun:
        return this.getContinuousRunDropdown(action, options);
      default:
        return super.createActionViewItem(action, options);
    }
  }
  /** @inheritdoc */
  getTestConfigGroupActions(group) {
    const profileActions = [];
    let participatingGroups = 0;
    let participatingProfiles = 0;
    let hasConfigurable = false;
    const defaults = this.testProfileService.getGroupDefaultProfiles(group);
    for (const { profiles, controller } of this.testProfileService.all()) {
      let hasAdded = false;
      for (const profile of profiles) {
        if (profile.group !== group) {
          continue;
        }
        if (!hasAdded) {
          hasAdded = true;
          participatingGroups++;
          profileActions.push(new Action(`${controller.id}.$root`, controller.label.get(), void 0, false));
        }
        hasConfigurable = hasConfigurable || profile.hasConfigurationHandler;
        participatingProfiles++;
        profileActions.push(new Action(
          `${controller.id}.${profile.profileId}`,
          defaults.includes(profile) ? localize("defaultTestProfile", "{0} (Default)", profile.label) : profile.label,
          void 0,
          void 0,
          () => {
            const { include, exclude } = this.getTreeIncludeExclude(profile);
            this.testService.runResolvedTests({
              exclude: exclude.map((e) => e.item.extId),
              group: profile.group,
              targets: [{
                profileId: profile.profileId,
                controllerId: profile.controllerId,
                testIds: include.map((i) => i.item.extId)
              }]
            });
          }
        ));
      }
    }
    const contextKeys = [];
    if (group === TestRunProfileBitset.Run) {
      contextKeys.push(["testing.profile.context.group", "run"]);
    }
    if (group === TestRunProfileBitset.Debug) {
      contextKeys.push(["testing.profile.context.group", "debug"]);
    }
    if (group === TestRunProfileBitset.Coverage) {
      contextKeys.push(["testing.profile.context.group", "coverage"]);
    }
    const key = this.contextKeyService.createOverlay(contextKeys);
    const menu = this.menuService.getMenuActions(MenuId.TestProfilesContext, key);
    const menuActions = getFlatContextMenuActions(menu);
    const postActions = [];
    if (participatingProfiles > 1) {
      postActions.push(new Action(
        "selectDefaultTestConfigurations",
        localize("selectDefaultConfigs", "Select Default Profile"),
        void 0,
        void 0,
        () => this.commandService.executeCommand(TestCommandId.SelectDefaultTestProfiles, group)
      ));
    }
    if (hasConfigurable) {
      postActions.push(new Action(
        "configureTestProfiles",
        localize("configureTestProfiles", "Configure Test Profiles"),
        void 0,
        void 0,
        () => this.commandService.executeCommand(TestCommandId.ConfigureTestProfilesAction, group)
      ));
    }
    return {
      numberOfProfiles: participatingProfiles,
      actions: menuActions.length > 0 ? Separator.join(profileActions, menuActions, postActions) : Separator.join(profileActions, postActions)
    };
  }
  /**
   * @override
   */
  saveState() {
    this.filter.value?.saveState();
    super.saveState();
  }
  getRunGroupDropdown(group, defaultAction, options) {
    const dropdownActions = this.getTestConfigGroupActions(group);
    if (dropdownActions.numberOfProfiles < 2) {
      return super.createActionViewItem(defaultAction, options);
    }
    const primaryAction = this.instantiationService.createInstance(MenuItemAction, {
      id: defaultAction.id,
      title: defaultAction.label,
      icon: group === TestRunProfileBitset.Run ? icons.testingRunAllIcon : icons.testingDebugAllIcon
    }, void 0, void 0, void 0, void 0);
    return this.instantiationService.createInstance(
      DropdownWithPrimaryActionViewItem,
      primaryAction,
      this.getDropdownAction(),
      dropdownActions.actions,
      "",
      options
    );
  }
  getDropdownAction() {
    return new Action("selectRunConfig", localize("testingSelectConfig", "Select Configuration..."), "codicon-chevron-down", true);
  }
  getContinuousRunDropdown(defaultAction, options) {
    const allProfiles = [...Iterable.flatMap(this.testProfileService.all(), (cr) => {
      if (this.testService.collection.getNodeById(cr.controller.id)?.children.size) {
        return Iterable.filter(cr.profiles, (p) => p.supportsContinuousRun);
      }
      return Iterable.empty();
    })];
    if (allProfiles.length <= 1) {
      return super.createActionViewItem(defaultAction, options);
    }
    const primaryAction = this.instantiationService.createInstance(MenuItemAction, {
      id: defaultAction.id,
      title: defaultAction.label,
      icon: defaultAction.id === TestCommandId.StartContinousRun ? icons.testingTurnContinuousRunOn : icons.testingTurnContinuousRunOff
    }, void 0, void 0, void 0, void 0);
    const dropdownActions = [];
    const groups = groupBy(allProfiles, (p) => p.group);
    const crService = this.crService;
    for (const group of [TestRunProfileBitset.Run, TestRunProfileBitset.Debug, TestRunProfileBitset.Coverage]) {
      const profiles = groups[group];
      if (!profiles) {
        continue;
      }
      if (Object.keys(groups).length > 1) {
        dropdownActions.push({
          id: `${group}.label`,
          label: testProfileBitset[group],
          enabled: false,
          class: void 0,
          tooltip: testProfileBitset[group],
          run: () => {
          }
        });
      }
      for (const profile of profiles) {
        dropdownActions.push({
          id: `${group}.${profile.profileId}`,
          label: profile.label,
          enabled: true,
          class: void 0,
          tooltip: profile.label,
          checked: crService.isEnabledForProfile(profile),
          run: () => crService.isEnabledForProfile(profile) ? crService.stopProfile(profile) : crService.start([profile])
        });
      }
    }
    return this.instantiationService.createInstance(
      DropdownWithPrimaryActionViewItem,
      primaryAction,
      this.getDropdownAction(),
      dropdownActions,
      "",
      options
    );
  }
  createFilterActionBar() {
    const bar = new ActionBar(this.treeHeader, {
      actionViewItemProvider: (action, options) => this.createActionViewItem(action, options),
      triggerKeys: { keyDown: false, keys: [] }
    });
    bar.push(new Action(TestCommandId.FilterAction));
    bar.getContainer().classList.add("testing-filter-action-bar");
    return bar;
  }
  updateDiscoveryProgress(busy) {
    if (!busy && this.discoveryProgress) {
      this.discoveryProgress.clear();
    } else if (busy && !this.discoveryProgress.value) {
      this.discoveryProgress.value = this.instantiationService.createInstance(UnmanagedProgress, { location: this.getProgressLocation() });
    }
  }
  /**
   * @override
   */
  layoutBody(height = this.dimensions.height, width = this.dimensions.width) {
    super.layoutBody(height, width);
    this.dimensions.height = height;
    this.dimensions.width = width;
    this.container.style.height = `${height}px`;
    this.viewModel?.layout(height - this.treeHeader.clientHeight, width);
    this.filter.value?.layout(width);
  }
};
TestingExplorerView = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, ITestService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, ITestProfileService),
  __decorateParam(12, ICommandService),
  __decorateParam(13, IMenuService),
  __decorateParam(14, ITestingContinuousRunService)
], TestingExplorerView);
const SUMMARY_RENDER_INTERVAL = 200;
let ResultSummaryView = class extends Disposable {
  constructor(container, resultService, activityService, crService, configurationService, instantiationService, hoverService) {
    super();
    this.container = container;
    this.resultService = resultService;
    this.activityService = activityService;
    this.crService = crService;
    this.elementsWereAttached = false;
    this.badgeDisposable = this._register(new MutableDisposable());
    this.renderLoop = this._register(new RunOnceScheduler(() => this.render(), SUMMARY_RENDER_INTERVAL));
    this.elements = dom.h("div.result-summary", [
      dom.h("div@status"),
      dom.h("div@count"),
      dom.h("div@count"),
      dom.h("span"),
      dom.h("duration@duration"),
      dom.h("a@rerun")
    ]);
    this.badgeType = configurationService.getValue(TestingConfigKeys.CountBadge);
    this._register(resultService.onResultsChanged(this.render, this));
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TestingConfigKeys.CountBadge)) {
        this.badgeType = configurationService.getValue(TestingConfigKeys.CountBadge);
        this.render();
      }
    }));
    this.countHover = this._register(hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.elements.count, ""));
    const ab = this._register(new ActionBar(this.elements.rerun, {
      actionViewItemProvider: (action, options) => createActionViewItem(instantiationService, action, options)
    }));
    ab.push(instantiationService.createInstance(
      MenuItemAction,
      { ...new ReRunLastRun().desc, icon: icons.testingRerunIcon },
      { ...new DebugLastRun().desc, icon: icons.testingDebugIcon },
      {},
      void 0,
      void 0
    ), { icon: true, label: false });
    this.render();
  }
  render() {
    const { results } = this.resultService;
    const { count, root, status, duration, rerun } = this.elements;
    if (!results.length) {
      if (this.elementsWereAttached) {
        root.remove();
        this.elementsWereAttached = false;
      }
      this.container.innerText = localize("noResults", "No test results yet.");
      this.badgeDisposable.clear();
      return;
    }
    const live = results.filter((r) => !r.completedAt);
    let counts;
    if (live.length) {
      status.className = ThemeIcon.asClassName(spinningLoading);
      counts = collectTestStateCounts(true, live);
      this.renderLoop.schedule();
      const last = live[live.length - 1];
      duration.textContent = formatDuration(Date.now() - last.startedAt);
      rerun.style.display = "none";
    } else {
      const last = results[0];
      const dominantState = mapFindFirst(statesInOrder, (s) => last.counts[s] > 0 ? s : void 0);
      status.className = ThemeIcon.asClassName(icons.testingStatesToIcons.get(dominantState ?? TestResultState.Unset));
      counts = collectTestStateCounts(false, [last]);
      duration.textContent = last instanceof LiveTestResult ? formatDuration(last.completedAt - last.startedAt) : "";
      rerun.style.display = "block";
    }
    count.textContent = `${counts.passed}/${counts.totalWillBeRun}`;
    this.countHover.update(getTestProgressText(counts));
    this.renderActivityBadge(counts);
    if (!this.elementsWereAttached) {
      dom.clearNode(this.container);
      this.container.appendChild(root);
      this.elementsWereAttached = true;
    }
  }
  renderActivityBadge(countSummary) {
    if (countSummary && this.badgeType !== TestingCountBadge.Off && countSummary[this.badgeType] !== 0) {
      if (this.lastBadge instanceof NumberBadge && this.lastBadge.number === countSummary[this.badgeType]) {
        return;
      }
      this.lastBadge = new NumberBadge(countSummary[this.badgeType], (num) => this.getLocalizedBadgeString(this.badgeType, num));
    } else if (this.crService.isEnabled()) {
      if (this.lastBadge instanceof IconBadge && this.lastBadge.icon === icons.testingContinuousIsOn) {
        return;
      }
      this.lastBadge = new IconBadge(icons.testingContinuousIsOn, () => localize("testingContinuousBadge", "Tests are being watched for changes"));
    } else {
      if (!this.lastBadge) {
        return;
      }
      this.lastBadge = void 0;
    }
    this.badgeDisposable.value = this.lastBadge && this.activityService.showViewActivity(Testing.ExplorerViewId, { badge: this.lastBadge });
  }
  getLocalizedBadgeString(countBadgeType, count) {
    switch (countBadgeType) {
      case TestingCountBadge.Passed:
        return localize("testingCountBadgePassed", "{0} passed tests", count);
      case TestingCountBadge.Skipped:
        return localize("testingCountBadgeSkipped", "{0} skipped tests", count);
      default:
        return localize("testingCountBadgeFailed", "{0} failed tests", count);
    }
  }
};
ResultSummaryView = __decorateClass([
  __decorateParam(1, ITestResultService),
  __decorateParam(2, IActivityService),
  __decorateParam(3, ITestingContinuousRunService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IHoverService)
], ResultSummaryView);
var WelcomeExperience = /* @__PURE__ */ ((WelcomeExperience2) => {
  WelcomeExperience2[WelcomeExperience2["None"] = 0] = "None";
  WelcomeExperience2[WelcomeExperience2["ForWorkspace"] = 1] = "ForWorkspace";
  WelcomeExperience2[WelcomeExperience2["ForDocument"] = 2] = "ForDocument";
  return WelcomeExperience2;
})(WelcomeExperience || {});
let TestingExplorerViewModel = class extends Disposable {
  constructor(listContainer, onDidChangeVisibility, configurationService, editorService, editorGroupsService, menuService, contextMenuService, testService, filterState, instantiationService, storageService, contextKeyService, testResults, peekOpener, testProfileService, crService, commandService) {
    super();
    this.menuService = menuService;
    this.contextMenuService = contextMenuService;
    this.testService = testService;
    this.filterState = filterState;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.contextKeyService = contextKeyService;
    this.testResults = testResults;
    this.peekOpener = peekOpener;
    this.testProfileService = testProfileService;
    this.crService = crService;
    this.projection = this._register(new MutableDisposable());
    this.revealTimeout = new MutableDisposable();
    this._viewMode = TestingContextKeys.viewMode.bindTo(this.contextKeyService);
    this._viewSorting = TestingContextKeys.viewSorting.bindTo(this.contextKeyService);
    this.welcomeVisibilityEmitter = new Emitter();
    this.actionRunner = this._register(new TestExplorerActionRunner(() => this.tree.getSelection().filter(isDefined)));
    this.lastViewState = this._register(new StoredValue({
      key: "testing.treeState",
      scope: StorageScope.WORKSPACE,
      target: StorageTarget.MACHINE
    }, this.storageService));
    /**
     * Whether there's a reveal request which has not yet been delivered. This
     * can happen if the user asks to reveal before the test tree is loaded.
     * We check to see if the reveal request is present on each tree update,
     * and do it then if so.
     */
    this.hasPendingReveal = false;
    /**
     * Fires when the visibility of the placeholder state changes.
     */
    this.onChangeWelcomeVisibility = this.welcomeVisibilityEmitter.event;
    /**
     * Gets whether the welcome should be visible.
     */
    this.welcomeExperience = 0 /* None */;
    this.hasPendingReveal = !!filterState.reveal.get();
    this.noTestForDocumentWidget = this._register(instantiationService.createInstance(NoTestsForDocumentWidget, listContainer));
    this._viewMode.set(this.storageService.get("testing.viewMode", StorageScope.WORKSPACE, TestExplorerViewMode.Tree));
    this._viewSorting.set(this.storageService.get("testing.viewSorting", StorageScope.WORKSPACE, TestExplorerViewSorting.ByLocation));
    this.reevaluateWelcomeState();
    this.filter = this.instantiationService.createInstance(TestsFilter, testService.collection);
    this.tree = instantiationService.createInstance(
      TestingObjectTree,
      "Test Explorer List",
      listContainer,
      new ListDelegate(),
      [
        instantiationService.createInstance(TestItemRenderer, this.actionRunner),
        instantiationService.createInstance(ErrorRenderer)
      ],
      {
        identityProvider: instantiationService.createInstance(IdentityProvider),
        hideTwistiesOfChildlessElements: false,
        sorter: instantiationService.createInstance(TreeSorter, this),
        keyboardNavigationLabelProvider: instantiationService.createInstance(TreeKeyboardNavigationLabelProvider),
        accessibilityProvider: instantiationService.createInstance(ListAccessibilityProvider),
        filter: this.filter,
        findWidgetEnabled: false
      }
    );
    const collapseStateSaver = this._register(new RunOnceScheduler(() => {
      const state = this.tree.getOptimizedViewState(this.lastViewState.get({}));
      const projection = this.projection.value;
      if (projection) {
        projection.lastState = state;
      }
    }, 3e3));
    this._register(this.tree.onDidChangeCollapseState((evt) => {
      if (evt.node.element instanceof TestItemTreeElement) {
        if (!evt.node.collapsed) {
          this.projection.value?.expandElement(evt.node.element, evt.deep ? Infinity : 0);
        }
        collapseStateSaver.schedule();
      }
    }));
    this._register(this.crService.onDidChange((testId) => {
      if (testId) {
        const elem = this.projection.value?.getElementByTestId(testId);
        this.tree.resort(elem?.parent && this.tree.hasElement(elem.parent) ? elem.parent : null, false);
      }
    }));
    this._register(onDidChangeVisibility((visible) => {
      if (visible) {
        this.ensureProjection();
      }
    }));
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    this._register(Event.any(
      filterState.text.onDidChange,
      filterState.fuzzy.onDidChange,
      testService.excluded.onTestExclusionsChanged
    )(() => {
      if (!filterState.text.value) {
        return this.tree.refilter();
      }
      const items = this.filter.lastIncludedTests = /* @__PURE__ */ new Set();
      this.tree.refilter();
      this.filter.lastIncludedTests = void 0;
      for (const test of items) {
        this.tree.expandTo(test);
      }
    }));
    this._register(this.tree.onDidOpen((e) => {
      if (!(e.element instanceof TestItemTreeElement)) {
        return;
      }
      filterState.didSelectTestInExplorer(e.element.test.item.extId);
      if (!e.element.children.size && e.element.test.item.uri) {
        if (!this.tryPeekError(e.element)) {
          commandService.executeCommand("vscode.revealTest", e.element.test.item.extId, {
            openToSide: e.sideBySide,
            preserveFocus: true
          });
        }
      }
    }));
    this._register(this.tree);
    this._register(this.onChangeWelcomeVisibility((e) => {
      this.noTestForDocumentWidget.setVisible(e === 2 /* ForDocument */);
    }));
    this._register(dom.addStandardDisposableListener(this.tree.getHTMLElement(), "keydown", (evt) => {
      if (evt.equals(KeyCode.Enter)) {
        this.handleExecuteKeypress(evt);
      } else if (DefaultKeyboardNavigationDelegate.mightProducePrintableCharacter(evt)) {
        filterState.text.value = evt.browserEvent.key;
        filterState.focusInput();
      }
    }));
    this._register(autorun((reader) => {
      this.revealById(filterState.reveal.read(reader), void 0, false);
    }));
    this._register(onDidChangeVisibility((visible) => {
      if (visible) {
        filterState.focusInput();
      }
    }));
    let followRunningTests = getTestingConfiguration(configurationService, TestingConfigKeys.FollowRunningTest);
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TestingConfigKeys.FollowRunningTest)) {
        followRunningTests = getTestingConfiguration(configurationService, TestingConfigKeys.FollowRunningTest);
      }
    }));
    let alwaysRevealTestAfterStateChange = getTestingConfiguration(configurationService, TestingConfigKeys.AlwaysRevealTestOnStateChange);
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TestingConfigKeys.AlwaysRevealTestOnStateChange)) {
        alwaysRevealTestAfterStateChange = getTestingConfiguration(configurationService, TestingConfigKeys.AlwaysRevealTestOnStateChange);
      }
    }));
    this._register(testResults.onTestChanged((evt) => {
      if (!followRunningTests) {
        return;
      }
      if (evt.reason !== TestResultItemChangeReason.OwnStateChange) {
        return;
      }
      if (this.tree.selectionSize > 1) {
        return;
      }
      if (evt.item.ownComputedState !== TestResultState.Running && !(evt.previousState === TestResultState.Queued && isStateWithResult(evt.item.ownComputedState))) {
        return;
      }
      this.revealById(evt.item.item.extId, alwaysRevealTestAfterStateChange, false);
    }));
    this._register(testResults.onResultsChanged(() => {
      this.tree.resort(null);
    }));
    this._register(this.testProfileService.onDidChange(() => {
      this.tree.rerender();
    }));
    const allOpenEditorInputs = observableFromEvent(
      this,
      editorService.onDidEditorsChange,
      () => new Set(editorGroupsService.groups.flatMap((g) => g.editors).map((e) => e.resource).filter(isDefined))
    );
    const activeResource = observableFromEvent(this, editorService.onDidActiveEditorChange, () => {
      if (editorService.activeEditor instanceof DiffEditorInput) {
        return editorService.activeEditor.primary.resource;
      } else {
        return editorService.activeEditor?.resource;
      }
    });
    const filterText = observableFromEvent(this.filterState.text.onDidChange, () => this.filterState.text);
    this._register(autorun((reader) => {
      filterText.read(reader);
      if (this.filterState.isFilteringFor(TestFilterTerm.OpenedFiles)) {
        this.filter.filterToDocumentUri([...allOpenEditorInputs.read(reader)]);
      } else {
        this.filter.filterToDocumentUri([activeResource.read(reader)].filter(isDefined));
      }
      if (this.filterState.isFilteringFor(TestFilterTerm.CurrentDoc) || this.filterState.isFilteringFor(TestFilterTerm.OpenedFiles)) {
        this.tree.refilter();
      }
    }));
    this._register(this.storageService.onWillSaveState(({ reason }) => {
      if (reason === WillSaveStateReason.SHUTDOWN) {
        this.lastViewState.store(this.tree.getOptimizedViewState());
      }
    }));
  }
  get viewMode() {
    return this._viewMode.get() ?? TestExplorerViewMode.Tree;
  }
  set viewMode(newMode) {
    if (newMode === this._viewMode.get()) {
      return;
    }
    this._viewMode.set(newMode);
    this.updatePreferredProjection();
    this.storageService.store("testing.viewMode", newMode, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  get viewSorting() {
    return this._viewSorting.get() ?? TestExplorerViewSorting.ByStatus;
  }
  set viewSorting(newSorting) {
    if (newSorting === this._viewSorting.get()) {
      return;
    }
    this._viewSorting.set(newSorting);
    this.tree.resort(null);
    this.storageService.store("testing.viewSorting", newSorting, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  /**
   * Re-layout the tree.
   */
  layout(height, width) {
    this.tree.layout(height, width);
  }
  /**
   * Tries to reveal by extension ID. Queues the request if the extension
   * ID is not currently available.
   */
  revealById(id, expand = true, focus = true) {
    if (!id) {
      this.hasPendingReveal = false;
      return;
    }
    const projection = this.ensureProjection();
    let expandToLevel = 0;
    const idPath = [...TestId.fromString(id).idsFromRoot()];
    for (let i = idPath.length - 1; i >= expandToLevel; i--) {
      const element = projection.getElementByTestId(idPath[i].toString());
      if (!element || !this.tree.hasElement(element)) {
        continue;
      }
      if (i < idPath.length - 1) {
        if (expand) {
          this.tree.expand(element);
          expandToLevel = i + 1;
          i = idPath.length - 1;
          continue;
        }
      }
      let focusTarget = element;
      for (let n = element; n instanceof TestItemTreeElement; n = n.parent) {
        if (n.test && this.testService.excluded.contains(n.test)) {
          this.filterState.toggleFilteringFor(TestFilterTerm.Hidden, true);
          break;
        }
        if (!expand && (this.tree.hasElement(n) && this.tree.isCollapsed(n))) {
          focusTarget = n;
        }
      }
      this.filterState.reveal.set(void 0, void 0);
      this.hasPendingReveal = false;
      if (focus) {
        this.tree.domFocus();
      }
      if (this.tree.getRelativeTop(focusTarget) === null) {
        this.tree.reveal(focusTarget, 0.5);
      }
      this.revealTimeout.value = disposableTimeout(() => {
        this.tree.setFocus([focusTarget]);
        this.tree.setSelection([focusTarget]);
      }, 1);
      return;
    }
    this.hasPendingReveal = true;
  }
  /**
   * Collapse all items in the tree.
   */
  async collapseAll() {
    this.tree.collapseAll();
  }
  /**
   * Tries to peek the first test error, if the item is in a failed state.
   */
  tryPeekError(item) {
    const lookup = item.test && this.testResults.getStateById(item.test.item.extId);
    return lookup && lookup[1].tasks.some((s) => isFailedState(s.state)) ? this.peekOpener.tryPeekFirstError(lookup[0], lookup[1], { preserveFocus: true }) : false;
  }
  onContextMenu(evt) {
    const element = evt.element;
    if (!(element instanceof TestItemTreeElement)) {
      return;
    }
    const { actions } = getActionableElementActions(this.contextKeyService, this.menuService, this.testService, this.crService, this.testProfileService, element);
    this.contextMenuService.showContextMenu({
      getAnchor: () => evt.anchor,
      getActions: () => actions.secondary,
      getActionsContext: () => element,
      actionRunner: this.actionRunner
    });
  }
  handleExecuteKeypress(evt) {
    const focused = this.tree.getFocus();
    const selected = this.tree.getSelection();
    let targeted;
    if (focused.length === 1 && selected.includes(focused[0])) {
      evt.browserEvent?.preventDefault();
      targeted = selected;
    } else {
      targeted = focused;
    }
    const toRun = targeted.filter((e) => e instanceof TestItemTreeElement);
    if (toRun.length) {
      this.testService.runTests({
        group: TestRunProfileBitset.Run,
        tests: toRun.map((t) => t.test)
      });
    }
  }
  reevaluateWelcomeState() {
    const shouldShowWelcome = this.testService.collection.busyProviders === 0 && testCollectionIsEmpty(this.testService.collection);
    const welcomeExperience = shouldShowWelcome ? this.filterState.isFilteringFor(TestFilterTerm.CurrentDoc) ? 2 /* ForDocument */ : 1 /* ForWorkspace */ : 0 /* None */;
    if (welcomeExperience !== this.welcomeExperience) {
      this.welcomeExperience = welcomeExperience;
      this.welcomeVisibilityEmitter.fire(welcomeExperience);
    }
  }
  ensureProjection() {
    return this.projection.value ?? this.updatePreferredProjection();
  }
  updatePreferredProjection() {
    this.projection.clear();
    const lastState = this.lastViewState.get({});
    if (this._viewMode.get() === TestExplorerViewMode.List) {
      this.projection.value = this.instantiationService.createInstance(ListProjection, lastState);
    } else {
      this.projection.value = this.instantiationService.createInstance(TreeProjection, lastState);
    }
    const scheduler = this._register(new RunOnceScheduler(() => this.applyProjectionChanges(), 200));
    this.projection.value.onUpdate(() => {
      if (!scheduler.isScheduled()) {
        scheduler.schedule();
      }
    });
    this.applyProjectionChanges();
    return this.projection.value;
  }
  applyProjectionChanges() {
    this.reevaluateWelcomeState();
    this.projection.value?.applyTo(this.tree);
    this.tree.refilter();
    if (this.hasPendingReveal) {
      this.revealById(this.filterState.reveal.get());
    }
  }
  /**
   * Gets the selected tests from the tree.
   */
  getSelectedTests() {
    return this.tree.getSelection();
  }
};
TestingExplorerViewModel = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, ITestService),
  __decorateParam(8, ITestExplorerFilterState),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, ITestResultService),
  __decorateParam(13, ITestingPeekOpener),
  __decorateParam(14, ITestProfileService),
  __decorateParam(15, ITestingContinuousRunService),
  __decorateParam(16, ICommandService)
], TestingExplorerViewModel);
var FilterResult = /* @__PURE__ */ ((FilterResult2) => {
  FilterResult2[FilterResult2["Exclude"] = 0] = "Exclude";
  FilterResult2[FilterResult2["Inherit"] = 1] = "Inherit";
  FilterResult2[FilterResult2["Include"] = 2] = "Include";
  return FilterResult2;
})(FilterResult || {});
const hasNodeInOrParentOfUri = (collection, ident, testUri, fromNode) => {
  const queue = [fromNode ? [fromNode] : collection.rootIds];
  while (queue.length) {
    for (const id of queue.pop()) {
      const node = collection.getNodeById(id);
      if (!node) {
        continue;
      }
      if (!node.item.uri || !ident.extUri.isEqualOrParent(testUri, node.item.uri)) {
        continue;
      }
      if (node.item.range || node.expand === TestItemExpandState.Expandable) {
        return true;
      }
      queue.push(node.children);
    }
  }
  return false;
};
let TestsFilter = class {
  constructor(collection, state, testService, uriIdentityService) {
    this.collection = collection;
    this.state = state;
    this.testService = testService;
    this.uriIdentityService = uriIdentityService;
    this.documentUris = [];
  }
  /**
   * @inheritdoc
   */
  filter(element) {
    if (element instanceof TestTreeErrorMessage) {
      return TreeVisibility.Visible;
    }
    if (element.test && !this.state.isFilteringFor(TestFilterTerm.Hidden) && this.testService.excluded.contains(element.test)) {
      return TreeVisibility.Hidden;
    }
    switch (Math.min(this.testFilterText(element), this.testLocation(element), this.testState(element), this.testTags(element))) {
      case 0 /* Exclude */:
        return TreeVisibility.Hidden;
      case 2 /* Include */:
        this.lastIncludedTests?.add(element);
        return TreeVisibility.Visible;
      default:
        return TreeVisibility.Recurse;
    }
  }
  filterToDocumentUri(uris) {
    this.documentUris = [...uris];
  }
  testTags(element) {
    if (!this.state.includeTags.size && !this.state.excludeTags.size) {
      return 2 /* Include */;
    }
    return (this.state.includeTags.size ? element.test.item.tags.some((t) => this.state.includeTags.has(t)) : true) && element.test.item.tags.every((t) => !this.state.excludeTags.has(t)) ? 2 /* Include */ : 1 /* Inherit */;
  }
  testState(element) {
    if (this.state.isFilteringFor(TestFilterTerm.Failed)) {
      return isFailedState(element.state) ? 2 /* Include */ : 1 /* Inherit */;
    }
    if (this.state.isFilteringFor(TestFilterTerm.Executed)) {
      return element.state !== TestResultState.Unset ? 2 /* Include */ : 1 /* Inherit */;
    }
    return 2 /* Include */;
  }
  testLocation(element) {
    if (this.documentUris.length === 0) {
      return 2 /* Include */;
    }
    if (!this.state.isFilteringFor(TestFilterTerm.CurrentDoc) && !this.state.isFilteringFor(TestFilterTerm.OpenedFiles) || !(element instanceof TestItemTreeElement)) {
      return 2 /* Include */;
    }
    if (this.documentUris.some((uri) => hasNodeInOrParentOfUri(this.collection, this.uriIdentityService, uri, element.test.item.extId))) {
      return 2 /* Include */;
    }
    return 1 /* Inherit */;
  }
  testFilterText(element) {
    if (this.state.globList.length === 0) {
      return 2 /* Include */;
    }
    const fuzzy = this.state.fuzzy.value;
    for (let e = element; e; e = e.parent) {
      let included = this.state.globList[0].include === false ? 2 /* Include */ : 1 /* Inherit */;
      const data = e.test.item.label.toLowerCase();
      for (const { include, text } of this.state.globList) {
        if (fuzzy ? fuzzyContains(data, text) : data.includes(text)) {
          included = include ? 2 /* Include */ : 0 /* Exclude */;
        }
      }
      if (included !== 1 /* Inherit */) {
        return included;
      }
    }
    return 1 /* Inherit */;
  }
};
TestsFilter = __decorateClass([
  __decorateParam(1, ITestExplorerFilterState),
  __decorateParam(2, ITestService),
  __decorateParam(3, IUriIdentityService)
], TestsFilter);
class TreeSorter {
  constructor(viewModel) {
    this.viewModel = viewModel;
  }
  compare(a, b) {
    if (a instanceof TestTreeErrorMessage || b instanceof TestTreeErrorMessage) {
      return (a instanceof TestTreeErrorMessage ? -1 : 0) + (b instanceof TestTreeErrorMessage ? 1 : 0);
    }
    const durationDelta = (b.duration || 0) - (a.duration || 0);
    if (this.viewModel.viewSorting === TestExplorerViewSorting.ByDuration && durationDelta !== 0) {
      return durationDelta;
    }
    const stateDelta = cmpPriority(a.state, b.state);
    if (this.viewModel.viewSorting === TestExplorerViewSorting.ByStatus && stateDelta !== 0) {
      return stateDelta;
    }
    let inSameLocation = false;
    if (a instanceof TestItemTreeElement && b instanceof TestItemTreeElement && a.test.item.uri && b.test.item.uri && a.test.item.uri.toString() === b.test.item.uri.toString() && a.test.item.range && b.test.item.range) {
      inSameLocation = true;
      const delta = a.test.item.range.startLineNumber - b.test.item.range.startLineNumber;
      if (delta !== 0) {
        return delta;
      }
    }
    const sa = a.test.item.sortText;
    const sb = b.test.item.sortText;
    return inSameLocation && !sa && !sb ? 0 : (sa || a.test.item.label).localeCompare(sb || b.test.item.label);
  }
}
let NoTestsForDocumentWidget = class extends Disposable {
  constructor(container, filterState) {
    super();
    const el = this.el = dom.append(container, dom.$(".testing-no-test-placeholder"));
    const emptyParagraph = dom.append(el, dom.$("p"));
    emptyParagraph.innerText = localize("testingNoTest", "No tests were found in this file.");
    const buttonLabel = localize("testingFindExtension", "Show Workspace Tests");
    const button = this._register(new Button(el, { title: buttonLabel, ...defaultButtonStyles }));
    button.label = buttonLabel;
    this._register(button.onDidClick(() => filterState.toggleFilteringFor(TestFilterTerm.CurrentDoc, false)));
  }
  setVisible(isVisible) {
    this.el.classList.toggle("visible", isVisible);
  }
};
NoTestsForDocumentWidget = __decorateClass([
  __decorateParam(1, ITestExplorerFilterState)
], NoTestsForDocumentWidget);
class TestExplorerActionRunner extends ActionRunner {
  constructor(getSelectedTests) {
    super();
    this.getSelectedTests = getSelectedTests;
  }
  async runAction(action, context) {
    if (!(action instanceof MenuItemAction)) {
      return super.runAction(action, context);
    }
    const selection = this.getSelectedTests();
    const contextIsSelected = selection.some((s) => s === context);
    const actualContext = contextIsSelected ? selection : [context];
    const actionable = actualContext.filter((t) => t instanceof TestItemTreeElement);
    await action.run(...actionable);
  }
}
const getLabelForTestTreeElement = (element) => {
  let label = labelForTestInState(element.description || element.test.item.label, element.state);
  if (element instanceof TestItemTreeElement) {
    if (element.duration !== void 0) {
      label = localize({
        key: "testing.treeElementLabelDuration",
        comment: ["{0} is the original label in testing.treeElementLabel, {1} is a duration"]
      }, "{0}, in {1}", label, formatDuration(element.duration));
    }
    if (element.retired) {
      label = localize({
        key: "testing.treeElementLabelOutdated",
        comment: ["{0} is the original label in testing.treeElementLabel"]
      }, "{0}, outdated result", label);
    }
  }
  return label;
};
class ListAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize("testExplorer", "Test Explorer");
  }
  getAriaLabel(element) {
    return element instanceof TestTreeErrorMessage ? element.description : getLabelForTestTreeElement(element);
  }
}
class TreeKeyboardNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    return element instanceof TestTreeErrorMessage ? element.message : element.test.item.label;
  }
}
class ListDelegate {
  getHeight(element) {
    return element instanceof TestTreeErrorMessage ? 17 + 10 : 22;
  }
  getTemplateId(element) {
    if (element instanceof TestTreeErrorMessage) {
      return ErrorRenderer.ID;
    }
    return TestItemRenderer.ID;
  }
}
class IdentityProvider {
  getId(element) {
    return element.treeId;
  }
}
let ErrorRenderer = class {
  constructor(hoverService, instantionService) {
    this.hoverService = hoverService;
    this.renderer = instantionService.createInstance(MarkdownRenderer, {});
  }
  get templateId() {
    return ErrorRenderer.ID;
  }
  renderTemplate(container) {
    const label = dom.append(container, dom.$(".error"));
    return { label, disposable: new DisposableStore() };
  }
  renderElement({ element }, _, data) {
    dom.clearNode(data.label);
    if (typeof element.message === "string") {
      data.label.innerText = element.message;
    } else {
      const result = this.renderer.render(element.message, { inline: true });
      data.label.appendChild(result.element);
    }
    data.disposable.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.label, element.description));
  }
  disposeTemplate(data) {
    data.disposable.dispose();
  }
};
ErrorRenderer.ID = "error";
ErrorRenderer = __decorateClass([
  __decorateParam(0, IHoverService),
  __decorateParam(1, IInstantiationService)
], ErrorRenderer);
let TestItemRenderer = class extends Disposable {
  constructor(actionRunner, menuService, testService, profiles, contextKeyService, instantiationService, crService, hoverService) {
    super();
    this.actionRunner = actionRunner;
    this.menuService = menuService;
    this.testService = testService;
    this.profiles = profiles;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.crService = crService;
    this.hoverService = hoverService;
    /**
     * @inheritdoc
     */
    this.templateId = TestItemRenderer.ID;
  }
  /**
   * @inheritdoc
   */
  renderTemplate(wrapper) {
    wrapper.classList.add("testing-stdtree-container");
    const icon = dom.append(wrapper, dom.$(".computed-state"));
    const label = dom.append(wrapper, dom.$(".label"));
    const disposable = new DisposableStore();
    dom.append(wrapper, dom.$(ThemeIcon.asCSSSelector(icons.testingHiddenIcon)));
    const actionBar = disposable.add(new ActionBar(wrapper, {
      actionRunner: this.actionRunner,
      actionViewItemProvider: (action, options) => action instanceof MenuItemAction ? this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate }) : void 0
    }));
    disposable.add(this.crService.onDidChange((changed) => {
      const id = templateData.current?.test.item.extId;
      if (id && (!changed || changed === id || TestId.isChild(id, changed))) {
        this.fillActionBar(templateData.current, templateData);
      }
    }));
    const templateData = { wrapper, label, actionBar, icon, elementDisposable: new DisposableStore(), templateDisposable: disposable };
    return templateData;
  }
  /**
   * @inheritdoc
   */
  disposeTemplate(templateData) {
    templateData.templateDisposable.clear();
  }
  /**
   * @inheritdoc
   */
  disposeElement(_element, _, templateData) {
    templateData.elementDisposable.clear();
  }
  fillActionBar(element, data) {
    const { actions, contextOverlay } = getActionableElementActions(this.contextKeyService, this.menuService, this.testService, this.crService, this.profiles, element);
    const crSelf = !!contextOverlay.getContextKeyValue(TestingContextKeys.isContinuousModeOn.key);
    const crChild = !crSelf && this.crService.isEnabledForAChildOf(element.test.item.extId);
    data.actionBar.domNode.classList.toggle("testing-is-continuous-run", crSelf || crChild);
    data.actionBar.clear();
    data.actionBar.context = element;
    data.actionBar.push(actions.primary, { icon: true, label: false });
  }
  /**
   * @inheritdoc
   */
  renderElement(node, _depth, data) {
    data.elementDisposable.clear();
    data.current = node.element;
    data.elementDisposable.add(node.element.onChange(() => this._renderElement(node, data)));
    this._renderElement(node, data);
  }
  _renderElement(node, data) {
    this.fillActionBar(node.element, data);
    const testHidden = this.testService.excluded.contains(node.element.test);
    data.wrapper.classList.toggle("test-is-hidden", testHidden);
    const icon = icons.testingStatesToIcons.get(
      node.element.test.expand === TestItemExpandState.BusyExpanding || node.element.test.item.busy ? TestResultState.Running : node.element.state
    );
    data.icon.className = "computed-state " + (icon ? ThemeIcon.asClassName(icon) : "");
    if (node.element.retired) {
      data.icon.className += " retired";
    }
    data.elementDisposable.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.label, getLabelForTestTreeElement(node.element)));
    if (node.element.test.item.label.trim()) {
      dom.reset(data.label, ...renderLabelWithIcons(node.element.test.item.label));
    } else {
      data.label.textContent = String.fromCharCode(160);
    }
    let description = node.element.description;
    if (node.element.duration !== void 0) {
      description = description ? `${description}: ${formatDuration(node.element.duration)}` : formatDuration(node.element.duration);
    }
    if (description) {
      dom.append(data.label, dom.$("span.test-label-description", {}, description));
    }
  }
};
TestItemRenderer.ID = "testItem";
TestItemRenderer = __decorateClass([
  __decorateParam(1, IMenuService),
  __decorateParam(2, ITestService),
  __decorateParam(3, ITestProfileService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ITestingContinuousRunService),
  __decorateParam(7, IHoverService)
], TestItemRenderer);
const formatDuration = (ms) => {
  if (ms < 10) {
    return `${ms.toFixed(1)}ms`;
  }
  if (ms < 1e3) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1e3).toFixed(1)}s`;
};
const getActionableElementActions = (contextKeyService, menuService, testService, crService, profiles, element) => {
  const test = element instanceof TestItemTreeElement ? element.test : void 0;
  const contextKeys = getTestItemContextOverlay(test, test ? profiles.capabilitiesForTest(test.item) : 0);
  contextKeys.push(["view", Testing.ExplorerViewId]);
  if (test) {
    const ctrl = testService.getTestController(test.controllerId);
    const supportsCr = !!ctrl && profiles.getControllerProfiles(ctrl.id).some((p) => p.supportsContinuousRun && canUseProfileWithTest(p, test));
    contextKeys.push([
      TestingContextKeys.canRefreshTests.key,
      ctrl && !!(ctrl.capabilities.get() & TestControllerCapability.Refresh) && TestId.isRoot(test.item.extId)
    ], [
      TestingContextKeys.testItemIsHidden.key,
      testService.excluded.contains(test)
    ], [
      TestingContextKeys.isContinuousModeOn.key,
      supportsCr && crService.isSpecificallyEnabledFor(test.item.extId)
    ], [
      TestingContextKeys.isParentRunningContinuously.key,
      supportsCr && crService.isEnabledForAParentOf(test.item.extId)
    ], [
      TestingContextKeys.supportsContinuousRun.key,
      supportsCr
    ], [
      TestingContextKeys.testResultOutdated.key,
      element.retired
    ], [
      TestingContextKeys.testResultState.key,
      testResultStateToContextValues[element.state]
    ]);
  }
  const contextOverlay = contextKeyService.createOverlay(contextKeys);
  const menu = menuService.getMenuActions(MenuId.TestItem, contextOverlay, {
    shouldForwardArgs: true
  });
  const actions = getActionBarActions(menu, "inline");
  return { actions, contextOverlay };
};
registerThemingParticipant((theme, collector) => {
  if (theme.type === "dark") {
    const foregroundColor = theme.getColor(foreground);
    if (foregroundColor) {
      const fgWithOpacity = new Color(new RGBA(foregroundColor.rgba.r, foregroundColor.rgba.g, foregroundColor.rgba.b, 0.65));
      collector.addRule(`.test-explorer .test-explorer-messages { color: ${fgWithOpacity}; }`);
    }
  }
});
export {
  TestingExplorerView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdGluZ0V4cGxvcmVyVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgSUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciwgSUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHR5cGUgeyBJTWFuYWdlZEhvdmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyLCBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IERlZmF1bHRLZXlib2FyZE5hdmlnYXRpb25EZWxlZ2F0ZSwgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IElUcmVlQ29udGV4dE1lbnVFdmVudCwgSVRyZWVGaWx0ZXIsIElUcmVlTm9kZSwgSVRyZWVSZW5kZXJlciwgSVRyZWVTb3J0ZXIsIFRyZWVGaWx0ZXJSZXN1bHQsIFRyZWVWaXNpYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIEFjdGlvblJ1bm5lciwgSUFjdGlvbiwgU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBtYXBGaW5kRmlyc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIsIGRpc3Bvc2FibGVUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZ3JvdXBCeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbG9yLCBSR0JBIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBGdXp6eVNjb3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIG9ic2VydmFibGVGcm9tRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGZ1enp5Q29udGFpbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBpc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvZHJvcGRvd25XaXRoUHJpbWFyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBjcmVhdGVBY3Rpb25WaWV3SXRlbSwgZ2V0QWN0aW9uQmFyQWN0aW9ucywgZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgVW5tYW5hZ2VkUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQsIFdpbGxTYXZlU3RhdGVSZWFzb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgZm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHNwaW5uaW5nTG9hZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSwgcmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJOYXZpZ2FibGVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2FjdGlvbnMvd2lkZ2V0TmF2aWdhdGlvbkNvbW1hbmRzLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJVmlld2xldFZpZXdPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3c1ZpZXdsZXQuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9kaWZmRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJQWN0aXZpdHlTZXJ2aWNlLCBJY29uQmFkZ2UsIE51bWJlckJhZGdlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYWN0aXZpdHkvY29tbW9uL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RpbmdDb25maWdLZXlzLCBUZXN0aW5nQ291bnRCYWRnZSwgZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29tbWFuZElkLCBUZXN0RXhwbG9yZXJWaWV3TW9kZSwgVGVzdEV4cGxvcmVyVmlld1NvcnRpbmcsIFRlc3RpbmcsIGxhYmVsRm9yVGVzdEluU3RhdGUgfSBmcm9tICcuLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFN0b3JlZFZhbHVlIH0gZnJvbSAnLi4vY29tbW9uL3N0b3JlZFZhbHVlLmpzJztcbmltcG9ydCB7IElUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZSwgVGVzdEV4cGxvcmVyRmlsdGVyU3RhdGUsIFRlc3RGaWx0ZXJUZXJtIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RFeHBsb3JlckZpbHRlclN0YXRlLmpzJztcbmltcG9ydCB7IFRlc3RJZCB9IGZyb20gJy4uL2NvbW1vbi90ZXN0SWQuanMnO1xuaW1wb3J0IHsgSVRlc3RQcm9maWxlU2VydmljZSwgY2FuVXNlUHJvZmlsZVdpdGhUZXN0IH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RQcm9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBMaXZlVGVzdFJlc3VsdCwgVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24gfSBmcm9tICcuLi9jb21tb24vdGVzdFJlc3VsdC5qcyc7XG5pbXBvcnQgeyBJVGVzdFJlc3VsdFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdFJlc3VsdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1haW5UaHJlYWRUZXN0Q29sbGVjdGlvbiwgSVRlc3RTZXJ2aWNlLCB0ZXN0Q29sbGVjdGlvbklzRW1wdHkgfSBmcm9tICcuLi9jb21tb24vdGVzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RSdW5Qcm9maWxlLCBJbnRlcm5hbFRlc3RJdGVtLCBUZXN0Q29udHJvbGxlckNhcGFiaWxpdHksIFRlc3RJdGVtRXhwYW5kU3RhdGUsIFRlc3RSZXN1bHRTdGF0ZSwgVGVzdFJ1blByb2ZpbGVCaXRzZXQsIHRlc3RQcm9maWxlQml0c2V0LCB0ZXN0UmVzdWx0U3RhdGVUb0NvbnRleHRWYWx1ZXMgfSBmcm9tICcuLi9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IFRlc3RpbmdDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi90ZXN0aW5nQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSVRlc3RpbmdDb250aW51b3VzUnVuU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi90ZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RpbmdQZWVrT3BlbmVyIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RpbmdQZWVrT3BlbmVyLmpzJztcbmltcG9ydCB7IGNtcFByaW9yaXR5LCBpc0ZhaWxlZFN0YXRlLCBpc1N0YXRlV2l0aFJlc3VsdCwgc3RhdGVzSW5PcmRlciB9IGZyb20gJy4uL2NvbW1vbi90ZXN0aW5nU3RhdGVzLmpzJztcbmltcG9ydCB7IElUZXN0VHJlZVByb2plY3Rpb24sIFRlc3RFeHBsb3JlclRyZWVFbGVtZW50LCBUZXN0SXRlbVRyZWVFbGVtZW50LCBUZXN0VHJlZUVycm9yTWVzc2FnZSB9IGZyb20gJy4vZXhwbG9yZXJQcm9qZWN0aW9ucy9pbmRleC5qcyc7XG5pbXBvcnQgeyBMaXN0UHJvamVjdGlvbiB9IGZyb20gJy4vZXhwbG9yZXJQcm9qZWN0aW9ucy9saXN0UHJvamVjdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRUZXN0SXRlbUNvbnRleHRPdmVybGF5IH0gZnJvbSAnLi9leHBsb3JlclByb2plY3Rpb25zL3Rlc3RJdGVtQ29udGV4dE92ZXJsYXkuanMnO1xuaW1wb3J0IHsgVGVzdGluZ09iamVjdFRyZWUgfSBmcm9tICcuL2V4cGxvcmVyUHJvamVjdGlvbnMvdGVzdGluZ09iamVjdFRyZWUuanMnO1xuaW1wb3J0IHsgSVNlcmlhbGl6ZWRUZXN0VHJlZUNvbGxhcHNlU3RhdGUgfSBmcm9tICcuL2V4cGxvcmVyUHJvamVjdGlvbnMvdGVzdGluZ1ZpZXdTdGF0ZS5qcyc7XG5pbXBvcnQgeyBUcmVlUHJvamVjdGlvbiB9IGZyb20gJy4vZXhwbG9yZXJQcm9qZWN0aW9ucy90cmVlUHJvamVjdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuL2ljb25zLmpzJztcbmltcG9ydCAnLi9tZWRpYS90ZXN0aW5nLmNzcyc7XG5pbXBvcnQgeyBEZWJ1Z0xhc3RSdW4sIFJlUnVuTGFzdFJ1biB9IGZyb20gJy4vdGVzdEV4cGxvcmVyQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBUZXN0aW5nRXhwbG9yZXJGaWx0ZXIgfSBmcm9tICcuL3Rlc3RpbmdFeHBsb3JlckZpbHRlci5qcyc7XG5pbXBvcnQgeyBDb3VudFN1bW1hcnksIGNvbGxlY3RUZXN0U3RhdGVDb3VudHMsIGdldFRlc3RQcm9ncmVzc1RleHQgfSBmcm9tICcuL3Rlc3RpbmdQcm9ncmVzc1VpU2VydmljZS5qcyc7XG5cbmNvbnN0IGVudW0gTGFzdEZvY3VzU3RhdGUge1xuXHRJbnB1dCxcblx0VHJlZSxcbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RpbmdFeHBsb3JlclZpZXcgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cdHB1YmxpYyB2aWV3TW9kZWwhOiBUZXN0aW5nRXhwbG9yZXJWaWV3TW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsdGVyQWN0aW9uQmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIGNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRyZWVIZWFkZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBkaXNjb3ZlcnlQcm9ncmVzcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxVbm1hbmFnZWRQcm9ncmVzcz4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsdGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPFRlc3RpbmdFeHBsb3JlckZpbHRlcj4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsdGVyRm9jdXNMaXN0ZW5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBkaW1lbnNpb25zID0geyB3aWR0aDogMCwgaGVpZ2h0OiAwIH07XG5cdHByaXZhdGUgbGFzdEZvY3VzU3RhdGUgPSBMYXN0Rm9jdXNTdGF0ZS5JbnB1dDtcblxuXHRwdWJsaWMgZ2V0IGZvY3VzZWRUcmVlRWxlbWVudHMoKSB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsLnRyZWUuZ2V0Rm9jdXMoKS5maWx0ZXIoaXNEZWZpbmVkKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3bGV0Vmlld09wdGlvbnMsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVzdFNlcnZpY2U6IElUZXN0U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElUZXN0UHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXN0UHJvZmlsZVNlcnZpY2U6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjclNlcnZpY2U6IElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKG9wdGlvbnMsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcmVsYXlvdXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmxheW91dEJvZHkoKSwgMSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlKCgpID0+IHtcblx0XHRcdGlmICghdGhpcy5zaG91bGRTaG93V2VsY29tZSgpKSB7XG5cdFx0XHRcdHJlbGF5b3V0LnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KGNyU2VydmljZS5vbkRpZENoYW5nZSwgdGVzdFByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlKSgoKSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZUFjdGlvbnMoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXN0U2VydmljZS5jb2xsZWN0aW9uLm9uQnVzeVByb3ZpZGVyc0NoYW5nZShidXN5ID0+IHtcblx0XHRcdHRoaXMudXBkYXRlRGlzY292ZXJ5UHJvZ3Jlc3MoYnVzeSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGVzdFByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlQWN0aW9ucygpKSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgc2hvdWxkU2hvd1dlbGNvbWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsPy53ZWxjb21lRXhwZXJpZW5jZSA9PT0gV2VsY29tZUV4cGVyaWVuY2UuRm9yV29ya3NwYWNlO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGZvY3VzKCkge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0aWYgKHRoaXMubGFzdEZvY3VzU3RhdGUgPT09IExhc3RGb2N1c1N0YXRlLlRyZWUpIHtcblx0XHRcdHRoaXMudmlld01vZGVsLnRyZWUuZG9tRm9jdXMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5maWx0ZXIudmFsdWU/LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgaW5jbHVkZS9leGNsdWRlIGl0ZW1zIGluIHRoZSB0cmVlLCBiYXNlZCBlaXRoZXIgb24gdmlzaWJsZSB0ZXN0c1xuXHQgKiBvciBhIHVzZSBzZWxlY3Rpb24uIElmIGEgcHJvZmlsZSBpcyBnaXZlbiwgb25seSB0ZXN0cyBpbiB0aGF0IHByb2ZpbGVcblx0ICogYXJlIGNvbGxlY3RlZC4gSWYgYSBiaXRzZXQgaXMgZ2l2ZW4sIGFueSB0ZXN0IHRoYXQgY2FuIHJ1biBpbiB0aGF0XG5cdCAqIGJpdHNldCBpcyBjb2xsZWN0ZWQuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0VHJlZUluY2x1ZGVFeGNsdWRlKHByb2ZpbGVPckJpdHNldDogSVRlc3RSdW5Qcm9maWxlIHwgVGVzdFJ1blByb2ZpbGVCaXRzZXQsIHdpdGhpbkl0ZW1zPzogSW50ZXJuYWxUZXN0SXRlbVtdLCBmaWx0ZXJUb1R5cGU6ICd2aXNpYmxlJyB8ICdzZWxlY3RlZCcgPSAndmlzaWJsZScpIHtcblx0XHRjb25zdCBwcm9qZWN0aW9uID0gdGhpcy52aWV3TW9kZWwucHJvamVjdGlvbi52YWx1ZTtcblx0XHRpZiAoIXByb2plY3Rpb24pIHtcblx0XHRcdHJldHVybiB7IGluY2x1ZGU6IFtdLCBleGNsdWRlOiBbXSB9O1xuXHRcdH1cblxuXHRcdC8vIFRvIGNhbGN1bGF0ZSBpbmNsdWRlcyBhbmQgZXhjbHVkZXMsIHdlIGluY2x1ZGUgdGhlIGZpcnN0IGNoaWxkcmVuIHRoYXRcblx0XHQvLyBoYXZlIGEgbWFqb3JpdHkgb2YgdGhlaXIgaXRlbXMgaW5jbHVkZWQgdG9vLCBhbmQgdGhlbiBhcHBseSBleGNsdXNpb25zLlxuXHRcdGNvbnN0IGluY2x1ZGUgPSBuZXcgU2V0PEludGVybmFsVGVzdEl0ZW0+KCk7XG5cdFx0Y29uc3QgZXhjbHVkZTogSW50ZXJuYWxUZXN0SXRlbVtdID0gW107XG5cblx0XHRjb25zdCBydW5uYWJsZVdpdGhQcm9maWxlT3JCaXRzZXQgPSBuZXcgTWFwPEludGVybmFsVGVzdEl0ZW0sIGJvb2xlYW4+KCk7XG5cdFx0Y29uc3QgaXNSdW5uYWJsZVdpdGhQcm9maWxlT3JCaXRzZXQgPSAoaXRlbTogSW50ZXJuYWxUZXN0SXRlbSkgPT4ge1xuXHRcdFx0bGV0IHZhbHVlID0gcnVubmFibGVXaXRoUHJvZmlsZU9yQml0c2V0LmdldChpdGVtKTtcblx0XHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHZhbHVlID0gdHlwZW9mIHByb2ZpbGVPckJpdHNldCA9PT0gJ251bWJlcidcblx0XHRcdFx0XHQ/ICEhdGhpcy50ZXN0UHJvZmlsZVNlcnZpY2UuZ2V0RGVmYXVsdFByb2ZpbGVGb3JUZXN0KHByb2ZpbGVPckJpdHNldCwgaXRlbSlcblx0XHRcdFx0XHQ6IGNhblVzZVByb2ZpbGVXaXRoVGVzdChwcm9maWxlT3JCaXRzZXQsIGl0ZW0pO1xuXHRcdFx0XHRydW5uYWJsZVdpdGhQcm9maWxlT3JCaXRzZXQuc2V0KGl0ZW0sIHZhbHVlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9O1xuXG5cblx0XHRjb25zdCBhdHRlbXB0ID0gKGVsZW1lbnQ6IFRlc3RFeHBsb3JlclRyZWVFbGVtZW50LCBhbHJlYWR5SW5jbHVkZWQ6IGJvb2xlYW4pID0+IHtcblx0XHRcdC8vIHNhbml0eSBjaGVjayBoYXNFbGVtZW50IHNpbmNlIHVwZGF0ZXMgYXJlIGRlYm91bmNlZCBhbmQgdGhleSBtYXkgZXhpc3Rcblx0XHRcdC8vIGJ1dCBub3QgYmUgcmVuZGVyZWQgeWV0XG5cdFx0XHRpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgVGVzdEl0ZW1UcmVlRWxlbWVudCkgfHwgIXRoaXMudmlld01vZGVsLnRyZWUuaGFzRWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHRoZSBjdXJyZW50IG5vZGUgaXMgbm90IHZpc2libGUgb3IgcnVubmFibGUgaW4gdGhlIGN1cnJlbnQgcHJvZmlsZSwgaXQncyBleGNsdWRlZFxuXHRcdFx0Y29uc3QgaW5UcmVlID0gdGhpcy52aWV3TW9kZWwudHJlZS5nZXROb2RlKGVsZW1lbnQpO1xuXHRcdFx0aWYgKCFpblRyZWUudmlzaWJsZSkge1xuXHRcdFx0XHRpZiAoYWxyZWFkeUluY2x1ZGVkKSB7IGV4Y2x1ZGUucHVzaChlbGVtZW50LnRlc3QpOyB9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gT25seSBjb3VudCByZWxldmFudCBjaGlsZHJlbiB3aGVuIGRlY2lkaW5nIHdoZXRoZXIgdG8gaW5jbHVkZSB0aGlzIG5vZGUsICMyMjkxMjBcblx0XHRcdGNvbnN0IHZpc2libGVSdW5uYWJsZUNoaWxkcmVuID0gaW5UcmVlLmNoaWxkcmVuLmZpbHRlcihcblx0XHRcdFx0YyA9PiBjLnZpc2libGVcblx0XHRcdFx0XHQmJiBjLmVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0SXRlbVRyZWVFbGVtZW50XG5cdFx0XHRcdFx0JiYgaXNSdW5uYWJsZVdpdGhQcm9maWxlT3JCaXRzZXQoYy5lbGVtZW50LnRlc3QpLFxuXHRcdFx0KS5sZW5ndGg7XG5cblx0XHRcdC8vIElmIGl0J3Mgbm90IGFscmVhZHkgaW5jbHVkZWQgYnV0IG1vc3Qgb2YgaXRzIGNoaWxkcmVuIGFyZSwgdGhlbiBhZGQgaXRcblx0XHRcdC8vIGlmIGl0IGNhbiBiZSBydW4gdW5kZXIgdGhlIGN1cnJlbnQgcHJvZmlsZSAod2hlbiBzcGVjaWZpZWQpXG5cdFx0XHRpZiAoXG5cdFx0XHRcdC8vIElmIGl0J3Mgbm90IGFscmVhZHkgaW5jbHVkZWQuLi5cblx0XHRcdFx0IWFscmVhZHlJbmNsdWRlZFxuXHRcdFx0XHQvLyBBbmQgaXQgY2FuIGJlIHJ1biB1c2luZyB0aGUgY3VycmVudCBwcm9maWxlIChpZiBhbnkpXG5cdFx0XHRcdCYmIGlzUnVubmFibGVXaXRoUHJvZmlsZU9yQml0c2V0KGVsZW1lbnQudGVzdClcblx0XHRcdFx0Ly8gQW5kIGVpdGhlciBpdCdzIGEgbGVhZiBub2RlIG9yIG1vc3QgY2hpbGRyZW4gYXJlIGluY2x1ZGVkLCB0aGUgIGluY2x1ZGUgaXQuXG5cdFx0XHRcdCYmICh2aXNpYmxlUnVubmFibGVDaGlsZHJlbiA9PT0gMCB8fCB2aXNpYmxlUnVubmFibGVDaGlsZHJlbiAqIDIgPj0gaW5UcmVlLmNoaWxkcmVuLmxlbmd0aClcblx0XHRcdFx0Ly8gQW5kIG5vdCBpZiB3ZSdyZSBvbmx5IHNob3dpbmcgYSBzaW5nbGUgb2YgaXRzIGNoaWxkcmVuLCBzaW5jZSBpdFxuXHRcdFx0XHQvLyBwcm9iYWJseSBmYW5zIG91dCBsYXRlci4gKFdvcnNlIGNhc2Ugd2UnbGwgZGlyZWN0bHkgaW5jbHVkZSBpdHMgc2luZ2xlIGNoaWxkKVxuXHRcdFx0XHQmJiB2aXNpYmxlUnVubmFibGVDaGlsZHJlbiAhPT0gMVxuXHRcdFx0KSB7XG5cdFx0XHRcdGluY2x1ZGUuYWRkKGVsZW1lbnQudGVzdCk7XG5cdFx0XHRcdGFscmVhZHlJbmNsdWRlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlY3Vyc2UgXHUyNzI4XG5cdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGVsZW1lbnQuY2hpbGRyZW4pIHtcblx0XHRcdFx0YXR0ZW1wdChjaGlsZCwgYWxyZWFkeUluY2x1ZGVkKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKGZpbHRlclRvVHlwZSA9PT0gJ3NlbGVjdGVkJykge1xuXHRcdFx0Y29uc3Qgc2VsID0gdGhpcy52aWV3TW9kZWwudHJlZS5nZXRTZWxlY3Rpb24oKS5maWx0ZXIoaXNEZWZpbmVkKTtcblx0XHRcdGlmIChzZWwubGVuZ3RoKSB7XG5cblx0XHRcdFx0TDpcblx0XHRcdFx0Zm9yIChjb25zdCBub2RlIG9mIHNlbCkge1xuXHRcdFx0XHRcdGlmIChub2RlIGluc3RhbmNlb2YgVGVzdEl0ZW1UcmVlRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0Ly8gYXZvaWQgYWRkaW5nIGFuIGl0ZW0gaWYgaXRzIHBhcmVudCBpcyBhbHJlYWR5IGluY2x1ZGVkXG5cdFx0XHRcdFx0XHRmb3IgKGxldCBpOiBUZXN0SXRlbVRyZWVFbGVtZW50IHwgbnVsbCA9IG5vZGU7IGk7IGkgPSBpLnBhcmVudCkge1xuXHRcdFx0XHRcdFx0XHRpZiAoaW5jbHVkZS5oYXMoaS50ZXN0KSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlIEw7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aW5jbHVkZS5hZGQobm9kZS50ZXN0KTtcblx0XHRcdFx0XHRcdG5vZGUuY2hpbGRyZW4uZm9yRWFjaChjID0+IGF0dGVtcHQoYywgdHJ1ZSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7IGluY2x1ZGU6IFsuLi5pbmNsdWRlXSwgZXhjbHVkZSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoY29uc3Qgcm9vdCBvZiB3aXRoaW5JdGVtcyB8fCB0aGlzLnRlc3RTZXJ2aWNlLmNvbGxlY3Rpb24ucm9vdEl0ZW1zKSB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gcHJvamVjdGlvbi5nZXRFbGVtZW50QnlUZXN0SWQocm9vdC5pdGVtLmV4dElkKTtcblx0XHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHR5cGVvZiBwcm9maWxlT3JCaXRzZXQgPT09ICdvYmplY3QnICYmICFjYW5Vc2VQcm9maWxlV2l0aFRlc3QocHJvZmlsZU9yQml0c2V0LCByb290KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gc2luZ2xlIGNvbnRyb2xsZXJzIHdvbid0IGhhdmUgdmlzaWJsZSByb290IElEIG5vZGVzLCBoYW5kbGUgdGhhdCAgY2FzZSBzcGVjaWFsbHlcblx0XHRcdGlmICghdGhpcy52aWV3TW9kZWwudHJlZS5oYXNFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHRcdGNvbnN0IHZpc2libGVDaGlsZHJlbiA9IFsuLi5lbGVtZW50LmNoaWxkcmVuXS5yZWR1Y2UoKGFjYywgYykgPT5cblx0XHRcdFx0XHR0aGlzLnZpZXdNb2RlbC50cmVlLmhhc0VsZW1lbnQoYykgJiYgdGhpcy52aWV3TW9kZWwudHJlZS5nZXROb2RlKGMpLnZpc2libGUgPyBhY2MgKyAxIDogYWNjLCAwKTtcblxuXHRcdFx0XHQvLyBub3RlIHdlIGludGVudGlvbmFsbHkgY2hlY2sgY2hpbGRyZW4gPiAwIGhlcmUsIHVubGlrZSBhYm92ZSwgc2luY2Vcblx0XHRcdFx0Ly8gd2UgZG9uJ3Qgd2FudCB0byBib3RoZXIgZGlzcGF0Y2hpbmcgdG8gY29udHJvbGxlcnMgd2hvIGhhdmUgbm8gZGlzY292ZXJlZCB0ZXN0c1xuXHRcdFx0XHRpZiAoZWxlbWVudC5jaGlsZHJlbi5zaXplID4gMCAmJiB2aXNpYmxlQ2hpbGRyZW4gKiAyID49IGVsZW1lbnQuY2hpbGRyZW4uc2l6ZSkge1xuXHRcdFx0XHRcdGluY2x1ZGUuYWRkKGVsZW1lbnQudGVzdCk7XG5cdFx0XHRcdFx0ZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKGMgPT4gYXR0ZW1wdChjLCB0cnVlKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5jaGlsZHJlbi5mb3JFYWNoKGMgPT4gYXR0ZW1wdChjLCBmYWxzZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhdHRlbXB0KGVsZW1lbnQsIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBpbmNsdWRlOiBbLi4uaW5jbHVkZV0sIGV4Y2x1ZGUgfTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcigpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3Rlck5hdmlnYWJsZUNvbnRhaW5lcih7XG5cdFx0XHRuYW1lOiAndGVzdGluZ0V4cGxvcmVyVmlldycsXG5cdFx0XHRmb2N1c05vdGlmaWVyczogW3RoaXNdLFxuXHRcdFx0Zm9jdXNOZXh0V2lkZ2V0OiAoKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy52aWV3TW9kZWwudHJlZS5pc0RPTUZvY3VzZWQoKSkge1xuXHRcdFx0XHRcdHRoaXMudmlld01vZGVsLnRyZWUuZG9tRm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZvY3VzUHJldmlvdXNXaWRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMudmlld01vZGVsLnRyZWUuaXNET01Gb2N1c2VkKCkpIHtcblx0XHRcdFx0XHR0aGlzLmZpbHRlci52YWx1ZT8uZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAb3ZlcnJpZGVcblx0ICovXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLmNvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLnRlc3QtZXhwbG9yZXInKSk7XG5cdFx0dGhpcy50cmVlSGVhZGVyID0gZG9tLmFwcGVuZCh0aGlzLmNvbnRhaW5lciwgZG9tLiQoJy50ZXN0LWV4cGxvcmVyLWhlYWRlcicpKTtcblx0XHR0aGlzLmZpbHRlckFjdGlvbkJhci52YWx1ZSA9IHRoaXMuY3JlYXRlRmlsdGVyQWN0aW9uQmFyKCk7XG5cblx0XHRjb25zdCBtZXNzYWdlc0NvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy50cmVlSGVhZGVyLCBkb20uJCgnLnJlc3VsdC1zdW1tYXJ5LWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc3VsdFN1bW1hcnlWaWV3LCBtZXNzYWdlc0NvbnRhaW5lcikpO1xuXG5cdFx0Y29uc3QgbGlzdENvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy5jb250YWluZXIsIGRvbS4kKCcudGVzdC1leHBsb3Jlci10cmVlJykpO1xuXHRcdHRoaXMudmlld01vZGVsID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0aW5nRXhwbG9yZXJWaWV3TW9kZWwsIGxpc3RDb250YWluZXIsIHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3TW9kZWwudHJlZS5vbkRpZEZvY3VzKCgpID0+IHRoaXMubGFzdEZvY3VzU3RhdGUgPSBMYXN0Rm9jdXNTdGF0ZS5UcmVlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3TW9kZWwub25DaGFuZ2VXZWxjb21lVmlzaWJpbGl0eSgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZVZpZXdXZWxjb21lU3RhdGUuZmlyZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3TW9kZWwpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlld1dlbGNvbWVTdGF0ZS5maXJlKCk7XG5cdH1cblxuXHQvKiogQG92ZXJyaWRlICAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgY3JlYXRlQWN0aW9uVmlld0l0ZW0oYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zKTogSUFjdGlvblZpZXdJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRzd2l0Y2ggKGFjdGlvbi5pZCkge1xuXHRcdFx0Y2FzZSBUZXN0Q29tbWFuZElkLkZpbHRlckFjdGlvbjpcblx0XHRcdFx0dGhpcy5maWx0ZXIudmFsdWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RpbmdFeHBsb3JlckZpbHRlciwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHRcdFx0dGhpcy5maWx0ZXJGb2N1c0xpc3RlbmVyLnZhbHVlID0gdGhpcy5maWx0ZXIudmFsdWUub25EaWRGb2N1cygoKSA9PiB0aGlzLmxhc3RGb2N1c1N0YXRlID0gTGFzdEZvY3VzU3RhdGUuSW5wdXQpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5maWx0ZXIudmFsdWU7XG5cdFx0XHRjYXNlIFRlc3RDb21tYW5kSWQuUnVuU2VsZWN0ZWRBY3Rpb246XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFJ1bkdyb3VwRHJvcGRvd24oVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuLCBhY3Rpb24sIG9wdGlvbnMpO1xuXHRcdFx0Y2FzZSBUZXN0Q29tbWFuZElkLkRlYnVnU2VsZWN0ZWRBY3Rpb246XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFJ1bkdyb3VwRHJvcGRvd24oVGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcsIGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0XHRjYXNlIFRlc3RDb21tYW5kSWQuU3RhcnRDb250aW5vdXNSdW46XG5cdFx0XHRjYXNlIFRlc3RDb21tYW5kSWQuU3RvcENvbnRpbm91c1J1bjpcblx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0Q29udGludW91c1J1bkRyb3Bkb3duKGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gc3VwZXIuY3JlYXRlQWN0aW9uVmlld0l0ZW0oYWN0aW9uLCBvcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHJpdmF0ZSBnZXRUZXN0Q29uZmlnR3JvdXBBY3Rpb25zKGdyb3VwOiBUZXN0UnVuUHJvZmlsZUJpdHNldCkge1xuXHRcdGNvbnN0IHByb2ZpbGVBY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblxuXHRcdGxldCBwYXJ0aWNpcGF0aW5nR3JvdXBzID0gMDtcblx0XHRsZXQgcGFydGljaXBhdGluZ1Byb2ZpbGVzID0gMDtcblx0XHRsZXQgaGFzQ29uZmlndXJhYmxlID0gZmFsc2U7XG5cdFx0Y29uc3QgZGVmYXVsdHMgPSB0aGlzLnRlc3RQcm9maWxlU2VydmljZS5nZXRHcm91cERlZmF1bHRQcm9maWxlcyhncm91cCk7XG5cdFx0Zm9yIChjb25zdCB7IHByb2ZpbGVzLCBjb250cm9sbGVyIH0gb2YgdGhpcy50ZXN0UHJvZmlsZVNlcnZpY2UuYWxsKCkpIHtcblx0XHRcdGxldCBoYXNBZGRlZCA9IGZhbHNlO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHByb2ZpbGUgb2YgcHJvZmlsZXMpIHtcblx0XHRcdFx0aWYgKHByb2ZpbGUuZ3JvdXAgIT09IGdyb3VwKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWhhc0FkZGVkKSB7XG5cdFx0XHRcdFx0aGFzQWRkZWQgPSB0cnVlO1xuXHRcdFx0XHRcdHBhcnRpY2lwYXRpbmdHcm91cHMrKztcblx0XHRcdFx0XHRwcm9maWxlQWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oYCR7Y29udHJvbGxlci5pZH0uJHJvb3RgLCBjb250cm9sbGVyLmxhYmVsLmdldCgpLCB1bmRlZmluZWQsIGZhbHNlKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRoYXNDb25maWd1cmFibGUgPSBoYXNDb25maWd1cmFibGUgfHwgcHJvZmlsZS5oYXNDb25maWd1cmF0aW9uSGFuZGxlcjtcblx0XHRcdFx0cGFydGljaXBhdGluZ1Byb2ZpbGVzKys7XG5cdFx0XHRcdHByb2ZpbGVBY3Rpb25zLnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0XHRgJHtjb250cm9sbGVyLmlkfS4ke3Byb2ZpbGUucHJvZmlsZUlkfWAsXG5cdFx0XHRcdFx0ZGVmYXVsdHMuaW5jbHVkZXMocHJvZmlsZSkgPyBsb2NhbGl6ZSgnZGVmYXVsdFRlc3RQcm9maWxlJywgJ3swfSAoRGVmYXVsdCknLCBwcm9maWxlLmxhYmVsKSA6IHByb2ZpbGUubGFiZWwsXG5cdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHQoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCB7IGluY2x1ZGUsIGV4Y2x1ZGUgfSA9IHRoaXMuZ2V0VHJlZUluY2x1ZGVFeGNsdWRlKHByb2ZpbGUpO1xuXHRcdFx0XHRcdFx0dGhpcy50ZXN0U2VydmljZS5ydW5SZXNvbHZlZFRlc3RzKHtcblx0XHRcdFx0XHRcdFx0ZXhjbHVkZTogZXhjbHVkZS5tYXAoZSA9PiBlLml0ZW0uZXh0SWQpLFxuXHRcdFx0XHRcdFx0XHRncm91cDogcHJvZmlsZS5ncm91cCxcblx0XHRcdFx0XHRcdFx0dGFyZ2V0czogW3tcblx0XHRcdFx0XHRcdFx0XHRwcm9maWxlSWQ6IHByb2ZpbGUucHJvZmlsZUlkLFxuXHRcdFx0XHRcdFx0XHRcdGNvbnRyb2xsZXJJZDogcHJvZmlsZS5jb250cm9sbGVySWQsXG5cdFx0XHRcdFx0XHRcdFx0dGVzdElkczogaW5jbHVkZS5tYXAoaSA9PiBpLml0ZW0uZXh0SWQpLFxuXHRcdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGV4dEtleXM6IFtzdHJpbmcsIHVua25vd25dW10gPSBbXTtcblx0XHQvLyBhbGxvdyBleHRlbnNpb24gYXV0aG9yIHRvIGRlZmluZSBjb250ZXh0IGZvciB3aGVuIHRvIHNob3cgdGhlIHRlc3QgbWVudSBhY3Rpb25zIGZvciBydW4gb3IgZGVidWcgbWVudXNcblx0XHRpZiAoZ3JvdXAgPT09IFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1bikge1xuXHRcdFx0Y29udGV4dEtleXMucHVzaChbJ3Rlc3RpbmcucHJvZmlsZS5jb250ZXh0Lmdyb3VwJywgJ3J1biddKTtcblx0XHR9XG5cdFx0aWYgKGdyb3VwID09PSBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1Zykge1xuXHRcdFx0Y29udGV4dEtleXMucHVzaChbJ3Rlc3RpbmcucHJvZmlsZS5jb250ZXh0Lmdyb3VwJywgJ2RlYnVnJ10pO1xuXHRcdH1cblx0XHRpZiAoZ3JvdXAgPT09IFRlc3RSdW5Qcm9maWxlQml0c2V0LkNvdmVyYWdlKSB7XG5cdFx0XHRjb250ZXh0S2V5cy5wdXNoKFsndGVzdGluZy5wcm9maWxlLmNvbnRleHQuZ3JvdXAnLCAnY292ZXJhZ2UnXSk7XG5cdFx0fVxuXHRcdGNvbnN0IGtleSA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlT3ZlcmxheShjb250ZXh0S2V5cyk7XG5cdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLlRlc3RQcm9maWxlc0NvbnRleHQsIGtleSk7XG5cblx0XHQvLyBmaWxsIGlmIHRoZXJlIGFyZSBhbnkgYWN0aW9uc1xuXHRcdGNvbnN0IG1lbnVBY3Rpb25zID0gZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyhtZW51KTtcblxuXHRcdGNvbnN0IHBvc3RBY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRpZiAocGFydGljaXBhdGluZ1Byb2ZpbGVzID4gMSkge1xuXHRcdFx0cG9zdEFjdGlvbnMucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHQnc2VsZWN0RGVmYXVsdFRlc3RDb25maWd1cmF0aW9ucycsXG5cdFx0XHRcdGxvY2FsaXplKCdzZWxlY3REZWZhdWx0Q29uZmlncycsICdTZWxlY3QgRGVmYXVsdCBQcm9maWxlJyksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kPElUZXN0UnVuUHJvZmlsZT4oVGVzdENvbW1hbmRJZC5TZWxlY3REZWZhdWx0VGVzdFByb2ZpbGVzLCBncm91cCksXG5cdFx0XHQpKTtcblx0XHR9XG5cblx0XHRpZiAoaGFzQ29uZmlndXJhYmxlKSB7XG5cdFx0XHRwb3N0QWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdCdjb25maWd1cmVUZXN0UHJvZmlsZXMnLFxuXHRcdFx0XHRsb2NhbGl6ZSgnY29uZmlndXJlVGVzdFByb2ZpbGVzJywgJ0NvbmZpZ3VyZSBUZXN0IFByb2ZpbGVzJyksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kPElUZXN0UnVuUHJvZmlsZT4oVGVzdENvbW1hbmRJZC5Db25maWd1cmVUZXN0UHJvZmlsZXNBY3Rpb24sIGdyb3VwKSxcblx0XHRcdCkpO1xuXHRcdH1cblxuXHRcdC8vIHNob3cgbWVudSBhY3Rpb25zIGlmIHRoZXJlIGFyZSBhbnkgb3RoZXJ3aXNlIGRvbid0XG5cdFx0cmV0dXJuIHtcblx0XHRcdG51bWJlck9mUHJvZmlsZXM6IHBhcnRpY2lwYXRpbmdQcm9maWxlcyxcblx0XHRcdGFjdGlvbnM6IG1lbnVBY3Rpb25zLmxlbmd0aCA+IDBcblx0XHRcdFx0PyBTZXBhcmF0b3Iuam9pbihwcm9maWxlQWN0aW9ucywgbWVudUFjdGlvbnMsIHBvc3RBY3Rpb25zKVxuXHRcdFx0XHQ6IFNlcGFyYXRvci5qb2luKHByb2ZpbGVBY3Rpb25zLCBwb3N0QWN0aW9ucyksXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAb3ZlcnJpZGVcblx0ICovXG5cdHB1YmxpYyBvdmVycmlkZSBzYXZlU3RhdGUoKSB7XG5cdFx0dGhpcy5maWx0ZXIudmFsdWU/LnNhdmVTdGF0ZSgpO1xuXHRcdHN1cGVyLnNhdmVTdGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSdW5Hcm91cERyb3Bkb3duKGdyb3VwOiBUZXN0UnVuUHJvZmlsZUJpdHNldCwgZGVmYXVsdEFjdGlvbjogSUFjdGlvbiwgb3B0aW9uczogSUFjdGlvblZpZXdJdGVtT3B0aW9ucykge1xuXHRcdGNvbnN0IGRyb3Bkb3duQWN0aW9ucyA9IHRoaXMuZ2V0VGVzdENvbmZpZ0dyb3VwQWN0aW9ucyhncm91cCk7XG5cdFx0aWYgKGRyb3Bkb3duQWN0aW9ucy5udW1iZXJPZlByb2ZpbGVzIDwgMikge1xuXHRcdFx0cmV0dXJuIHN1cGVyLmNyZWF0ZUFjdGlvblZpZXdJdGVtKGRlZmF1bHRBY3Rpb24sIG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByaW1hcnlBY3Rpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVJdGVtQWN0aW9uLCB7XG5cdFx0XHRpZDogZGVmYXVsdEFjdGlvbi5pZCxcblx0XHRcdHRpdGxlOiBkZWZhdWx0QWN0aW9uLmxhYmVsLFxuXHRcdFx0aWNvbjogZ3JvdXAgPT09IFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1blxuXHRcdFx0XHQ/IGljb25zLnRlc3RpbmdSdW5BbGxJY29uXG5cdFx0XHRcdDogaWNvbnMudGVzdGluZ0RlYnVnQWxsSWNvbixcblx0XHR9LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHREcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0sXG5cdFx0XHRwcmltYXJ5QWN0aW9uLCB0aGlzLmdldERyb3Bkb3duQWN0aW9uKCksIGRyb3Bkb3duQWN0aW9ucy5hY3Rpb25zLFxuXHRcdFx0JycsXG5cdFx0XHRvcHRpb25zXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RHJvcGRvd25BY3Rpb24oKSB7XG5cdFx0cmV0dXJuIG5ldyBBY3Rpb24oJ3NlbGVjdFJ1bkNvbmZpZycsIGxvY2FsaXplKCd0ZXN0aW5nU2VsZWN0Q29uZmlnJywgJ1NlbGVjdCBDb25maWd1cmF0aW9uLi4uJyksICdjb2RpY29uLWNoZXZyb24tZG93bicsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb250aW51b3VzUnVuRHJvcGRvd24oZGVmYXVsdEFjdGlvbjogSUFjdGlvbiwgb3B0aW9uczogSUFjdGlvblZpZXdJdGVtT3B0aW9ucykge1xuXHRcdGNvbnN0IGFsbFByb2ZpbGVzID0gWy4uLkl0ZXJhYmxlLmZsYXRNYXAodGhpcy50ZXN0UHJvZmlsZVNlcnZpY2UuYWxsKCksIChjcik6IEl0ZXJhYmxlPElUZXN0UnVuUHJvZmlsZT4gPT4ge1xuXHRcdFx0aWYgKHRoaXMudGVzdFNlcnZpY2UuY29sbGVjdGlvbi5nZXROb2RlQnlJZChjci5jb250cm9sbGVyLmlkKT8uY2hpbGRyZW4uc2l6ZSkge1xuXHRcdFx0XHRyZXR1cm4gSXRlcmFibGUuZmlsdGVyKGNyLnByb2ZpbGVzLCBwID0+IHAuc3VwcG9ydHNDb250aW51b3VzUnVuKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBJdGVyYWJsZS5lbXB0eSgpO1xuXHRcdH0pXTtcblxuXHRcdGlmIChhbGxQcm9maWxlcy5sZW5ndGggPD0gMSkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLmNyZWF0ZUFjdGlvblZpZXdJdGVtKGRlZmF1bHRBY3Rpb24sIG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByaW1hcnlBY3Rpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVJdGVtQWN0aW9uLCB7XG5cdFx0XHRpZDogZGVmYXVsdEFjdGlvbi5pZCxcblx0XHRcdHRpdGxlOiBkZWZhdWx0QWN0aW9uLmxhYmVsLFxuXHRcdFx0aWNvbjogZGVmYXVsdEFjdGlvbi5pZCA9PT0gVGVzdENvbW1hbmRJZC5TdGFydENvbnRpbm91c1J1biA/IGljb25zLnRlc3RpbmdUdXJuQ29udGludW91c1J1bk9uIDogaWNvbnMudGVzdGluZ1R1cm5Db250aW51b3VzUnVuT2ZmLFxuXHRcdH0sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCBkcm9wZG93bkFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRcdGNvbnN0IGdyb3VwcyA9IGdyb3VwQnkoYWxsUHJvZmlsZXMsIHAgPT4gcC5ncm91cCk7XG5cdFx0Y29uc3QgY3JTZXJ2aWNlID0gdGhpcy5jclNlcnZpY2U7XG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiBbVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuLCBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1ZywgVGVzdFJ1blByb2ZpbGVCaXRzZXQuQ292ZXJhZ2VdIGFzIGNvbnN0KSB7XG5cdFx0XHRjb25zdCBwcm9maWxlcyA9IGdyb3Vwc1tncm91cF07XG5cdFx0XHRpZiAoIXByb2ZpbGVzKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoT2JqZWN0LmtleXMoZ3JvdXBzKS5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdGRyb3Bkb3duQWN0aW9ucy5wdXNoKHtcblx0XHRcdFx0XHRpZDogYCR7Z3JvdXB9LmxhYmVsYCxcblx0XHRcdFx0XHRsYWJlbDogdGVzdFByb2ZpbGVCaXRzZXRbZ3JvdXBdLFxuXHRcdFx0XHRcdGVuYWJsZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dG9vbHRpcDogdGVzdFByb2ZpbGVCaXRzZXRbZ3JvdXBdLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4geyB9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBwcm9maWxlIG9mIHByb2ZpbGVzKSB7XG5cdFx0XHRcdGRyb3Bkb3duQWN0aW9ucy5wdXNoKHtcblx0XHRcdFx0XHRpZDogYCR7Z3JvdXB9LiR7cHJvZmlsZS5wcm9maWxlSWR9YCxcblx0XHRcdFx0XHRsYWJlbDogcHJvZmlsZS5sYWJlbCxcblx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dG9vbHRpcDogcHJvZmlsZS5sYWJlbCxcblx0XHRcdFx0XHRjaGVja2VkOiBjclNlcnZpY2UuaXNFbmFibGVkRm9yUHJvZmlsZShwcm9maWxlKSxcblx0XHRcdFx0XHRydW46ICgpID0+IGNyU2VydmljZS5pc0VuYWJsZWRGb3JQcm9maWxlKHByb2ZpbGUpXG5cdFx0XHRcdFx0XHQ/IGNyU2VydmljZS5zdG9wUHJvZmlsZShwcm9maWxlKVxuXHRcdFx0XHRcdFx0OiBjclNlcnZpY2Uuc3RhcnQoW3Byb2ZpbGVdKSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHREcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0sXG5cdFx0XHRwcmltYXJ5QWN0aW9uLCB0aGlzLmdldERyb3Bkb3duQWN0aW9uKCksIGRyb3Bkb3duQWN0aW9ucyxcblx0XHRcdCcnLFxuXHRcdFx0b3B0aW9uc1xuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUZpbHRlckFjdGlvbkJhcigpIHtcblx0XHRjb25zdCBiYXIgPSBuZXcgQWN0aW9uQmFyKHRoaXMudHJlZUhlYWRlciwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4gdGhpcy5jcmVhdGVBY3Rpb25WaWV3SXRlbShhY3Rpb24sIG9wdGlvbnMpLFxuXHRcdFx0dHJpZ2dlcktleXM6IHsga2V5RG93bjogZmFsc2UsIGtleXM6IFtdIH0sXG5cdFx0fSk7XG5cdFx0YmFyLnB1c2gobmV3IEFjdGlvbihUZXN0Q29tbWFuZElkLkZpbHRlckFjdGlvbikpO1xuXHRcdGJhci5nZXRDb250YWluZXIoKS5jbGFzc0xpc3QuYWRkKCd0ZXN0aW5nLWZpbHRlci1hY3Rpb24tYmFyJyk7XG5cdFx0cmV0dXJuIGJhcjtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRGlzY292ZXJ5UHJvZ3Jlc3MoYnVzeTogbnVtYmVyKSB7XG5cdFx0aWYgKCFidXN5ICYmIHRoaXMuZGlzY292ZXJ5UHJvZ3Jlc3MpIHtcblx0XHRcdHRoaXMuZGlzY292ZXJ5UHJvZ3Jlc3MuY2xlYXIoKTtcblx0XHR9IGVsc2UgaWYgKGJ1c3kgJiYgIXRoaXMuZGlzY292ZXJ5UHJvZ3Jlc3MudmFsdWUpIHtcblx0XHRcdHRoaXMuZGlzY292ZXJ5UHJvZ3Jlc3MudmFsdWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVubWFuYWdlZFByb2dyZXNzLCB7IGxvY2F0aW9uOiB0aGlzLmdldFByb2dyZXNzTG9jYXRpb24oKSB9KTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgbGF5b3V0Qm9keShoZWlnaHQgPSB0aGlzLmRpbWVuc2lvbnMuaGVpZ2h0LCB3aWR0aCA9IHRoaXMuZGltZW5zaW9ucy53aWR0aCk6IHZvaWQge1xuXHRcdHN1cGVyLmxheW91dEJvZHkoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0dGhpcy5kaW1lbnNpb25zLmhlaWdodCA9IGhlaWdodDtcblx0XHR0aGlzLmRpbWVuc2lvbnMud2lkdGggPSB3aWR0aDtcblx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHR9cHhgO1xuXHRcdHRoaXMudmlld01vZGVsPy5sYXlvdXQoaGVpZ2h0IC0gdGhpcy50cmVlSGVhZGVyLmNsaWVudEhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMuZmlsdGVyLnZhbHVlPy5sYXlvdXQod2lkdGgpO1xuXHR9XG59XG5cbmNvbnN0IFNVTU1BUllfUkVOREVSX0lOVEVSVkFMID0gMjAwO1xuXG5jbGFzcyBSZXN1bHRTdW1tYXJ5VmlldyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIGVsZW1lbnRzV2VyZUF0dGFjaGVkID0gZmFsc2U7XG5cdHByaXZhdGUgYmFkZ2VUeXBlOiBUZXN0aW5nQ291bnRCYWRnZTtcblx0cHJpdmF0ZSBsYXN0QmFkZ2U/OiBOdW1iZXJCYWRnZSB8IEljb25CYWRnZTtcblx0cHJpdmF0ZSBjb3VudEhvdmVyOiBJTWFuYWdlZEhvdmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IGJhZGdlRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSByZW5kZXJMb29wID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5yZW5kZXIoKSwgU1VNTUFSWV9SRU5ERVJfSU5URVJWQUwpKTtcblx0cHJpdmF0ZSByZWFkb25seSBlbGVtZW50cyA9IGRvbS5oKCdkaXYucmVzdWx0LXN1bW1hcnknLCBbXG5cdFx0ZG9tLmgoJ2RpdkBzdGF0dXMnKSxcblx0XHRkb20uaCgnZGl2QGNvdW50JyksXG5cdFx0ZG9tLmgoJ2RpdkBjb3VudCcpLFxuXHRcdGRvbS5oKCdzcGFuJyksXG5cdFx0ZG9tLmgoJ2R1cmF0aW9uQGR1cmF0aW9uJyksXG5cdFx0ZG9tLmgoJ2FAcmVydW4nKSxcblx0XSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJVGVzdFJlc3VsdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZXN1bHRTZXJ2aWNlOiBJVGVzdFJlc3VsdFNlcnZpY2UsXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjclNlcnZpY2U6IElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmJhZGdlVHlwZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPFRlc3RpbmdDb3VudEJhZGdlPihUZXN0aW5nQ29uZmlnS2V5cy5Db3VudEJhZGdlKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZXN1bHRTZXJ2aWNlLm9uUmVzdWx0c0NoYW5nZWQodGhpcy5yZW5kZXIsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXN0aW5nQ29uZmlnS2V5cy5Db3VudEJhZGdlKSkge1xuXHRcdFx0XHR0aGlzLmJhZGdlVHlwZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlc3RpbmdDb25maWdLZXlzLkNvdW50QmFkZ2UpO1xuXHRcdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuY291bnRIb3ZlciA9IHRoaXMuX3JlZ2lzdGVyKGhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5lbGVtZW50cy5jb3VudCwgJycpKTtcblxuXHRcdGNvbnN0IGFiID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcih0aGlzLmVsZW1lbnRzLnJlcnVuLCB7XG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiBjcmVhdGVBY3Rpb25WaWV3SXRlbShpbnN0YW50aWF0aW9uU2VydmljZSwgYWN0aW9uLCBvcHRpb25zKSxcblx0XHR9KSk7XG5cdFx0YWIucHVzaChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51SXRlbUFjdGlvbixcblx0XHRcdHsgLi4ubmV3IFJlUnVuTGFzdFJ1bigpLmRlc2MsIGljb246IGljb25zLnRlc3RpbmdSZXJ1bkljb24gfSxcblx0XHRcdHsgLi4ubmV3IERlYnVnTGFzdFJ1bigpLmRlc2MsIGljb246IGljb25zLnRlc3RpbmdEZWJ1Z0ljb24gfSxcblx0XHRcdHt9LFxuXHRcdFx0dW5kZWZpbmVkLCB1bmRlZmluZWRcblx0XHQpLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblxuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcigpIHtcblx0XHRjb25zdCB7IHJlc3VsdHMgfSA9IHRoaXMucmVzdWx0U2VydmljZTtcblx0XHRjb25zdCB7IGNvdW50LCByb290LCBzdGF0dXMsIGR1cmF0aW9uLCByZXJ1biB9ID0gdGhpcy5lbGVtZW50cztcblx0XHRpZiAoIXJlc3VsdHMubGVuZ3RoKSB7XG5cdFx0XHRpZiAodGhpcy5lbGVtZW50c1dlcmVBdHRhY2hlZCkge1xuXHRcdFx0XHRyb290LnJlbW92ZSgpO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnRzV2VyZUF0dGFjaGVkID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5pbm5lclRleHQgPSBsb2NhbGl6ZSgnbm9SZXN1bHRzJywgJ05vIHRlc3QgcmVzdWx0cyB5ZXQuJyk7XG5cdFx0XHR0aGlzLmJhZGdlRGlzcG9zYWJsZS5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpdmUgPSByZXN1bHRzLmZpbHRlcihyID0+ICFyLmNvbXBsZXRlZEF0KSBhcyBMaXZlVGVzdFJlc3VsdFtdO1xuXHRcdGxldCBjb3VudHM6IENvdW50U3VtbWFyeTtcblx0XHRpZiAobGl2ZS5sZW5ndGgpIHtcblx0XHRcdHN0YXR1cy5jbGFzc05hbWUgPSBUaGVtZUljb24uYXNDbGFzc05hbWUoc3Bpbm5pbmdMb2FkaW5nKTtcblx0XHRcdGNvdW50cyA9IGNvbGxlY3RUZXN0U3RhdGVDb3VudHModHJ1ZSwgbGl2ZSk7XG5cdFx0XHR0aGlzLnJlbmRlckxvb3Auc2NoZWR1bGUoKTtcblxuXHRcdFx0Y29uc3QgbGFzdCA9IGxpdmVbbGl2ZS5sZW5ndGggLSAxXTtcblx0XHRcdGR1cmF0aW9uLnRleHRDb250ZW50ID0gZm9ybWF0RHVyYXRpb24oRGF0ZS5ub3coKSAtIGxhc3Quc3RhcnRlZEF0KTtcblx0XHRcdHJlcnVuLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGxhc3QgPSByZXN1bHRzWzBdO1xuXHRcdFx0Y29uc3QgZG9taW5hbnRTdGF0ZSA9IG1hcEZpbmRGaXJzdChzdGF0ZXNJbk9yZGVyLCBzID0+IGxhc3QuY291bnRzW3NdID4gMCA/IHMgOiB1bmRlZmluZWQpO1xuXHRcdFx0c3RhdHVzLmNsYXNzTmFtZSA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShpY29ucy50ZXN0aW5nU3RhdGVzVG9JY29ucy5nZXQoZG9taW5hbnRTdGF0ZSA/PyBUZXN0UmVzdWx0U3RhdGUuVW5zZXQpISk7XG5cdFx0XHRjb3VudHMgPSBjb2xsZWN0VGVzdFN0YXRlQ291bnRzKGZhbHNlLCBbbGFzdF0pO1xuXHRcdFx0ZHVyYXRpb24udGV4dENvbnRlbnQgPSBsYXN0IGluc3RhbmNlb2YgTGl2ZVRlc3RSZXN1bHQgPyBmb3JtYXREdXJhdGlvbihsYXN0LmNvbXBsZXRlZEF0ISAtIGxhc3Quc3RhcnRlZEF0KSA6ICcnO1xuXHRcdFx0cmVydW4uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0fVxuXG5cdFx0Y291bnQudGV4dENvbnRlbnQgPSBgJHtjb3VudHMucGFzc2VkfS8ke2NvdW50cy50b3RhbFdpbGxCZVJ1bn1gO1xuXHRcdHRoaXMuY291bnRIb3Zlci51cGRhdGUoZ2V0VGVzdFByb2dyZXNzVGV4dChjb3VudHMpKTtcblx0XHR0aGlzLnJlbmRlckFjdGl2aXR5QmFkZ2UoY291bnRzKTtcblxuXHRcdGlmICghdGhpcy5lbGVtZW50c1dlcmVBdHRhY2hlZCkge1xuXHRcdFx0ZG9tLmNsZWFyTm9kZSh0aGlzLmNvbnRhaW5lcik7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZChyb290KTtcblx0XHRcdHRoaXMuZWxlbWVudHNXZXJlQXR0YWNoZWQgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQWN0aXZpdHlCYWRnZShjb3VudFN1bW1hcnk6IENvdW50U3VtbWFyeSkge1xuXHRcdGlmIChjb3VudFN1bW1hcnkgJiYgdGhpcy5iYWRnZVR5cGUgIT09IFRlc3RpbmdDb3VudEJhZGdlLk9mZiAmJiBjb3VudFN1bW1hcnlbdGhpcy5iYWRnZVR5cGVdICE9PSAwKSB7XG5cdFx0XHRpZiAodGhpcy5sYXN0QmFkZ2UgaW5zdGFuY2VvZiBOdW1iZXJCYWRnZSAmJiB0aGlzLmxhc3RCYWRnZS5udW1iZXIgPT09IGNvdW50U3VtbWFyeVt0aGlzLmJhZGdlVHlwZV0pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmxhc3RCYWRnZSA9IG5ldyBOdW1iZXJCYWRnZShjb3VudFN1bW1hcnlbdGhpcy5iYWRnZVR5cGVdLCBudW0gPT4gdGhpcy5nZXRMb2NhbGl6ZWRCYWRnZVN0cmluZyh0aGlzLmJhZGdlVHlwZSwgbnVtKSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmNyU2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0aWYgKHRoaXMubGFzdEJhZGdlIGluc3RhbmNlb2YgSWNvbkJhZGdlICYmIHRoaXMubGFzdEJhZGdlLmljb24gPT09IGljb25zLnRlc3RpbmdDb250aW51b3VzSXNPbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMubGFzdEJhZGdlID0gbmV3IEljb25CYWRnZShpY29ucy50ZXN0aW5nQ29udGludW91c0lzT24sICgpID0+IGxvY2FsaXplKCd0ZXN0aW5nQ29udGludW91c0JhZGdlJywgJ1Rlc3RzIGFyZSBiZWluZyB3YXRjaGVkIGZvciBjaGFuZ2VzJykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoIXRoaXMubGFzdEJhZGdlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5sYXN0QmFkZ2UgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5iYWRnZURpc3Bvc2FibGUudmFsdWUgPSB0aGlzLmxhc3RCYWRnZSAmJiB0aGlzLmFjdGl2aXR5U2VydmljZS5zaG93Vmlld0FjdGl2aXR5KFRlc3RpbmcuRXhwbG9yZXJWaWV3SWQsIHsgYmFkZ2U6IHRoaXMubGFzdEJhZGdlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRMb2NhbGl6ZWRCYWRnZVN0cmluZyhjb3VudEJhZGdlVHlwZTogVGVzdGluZ0NvdW50QmFkZ2UsIGNvdW50OiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAoY291bnRCYWRnZVR5cGUpIHtcblx0XHRcdGNhc2UgVGVzdGluZ0NvdW50QmFkZ2UuUGFzc2VkOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Rlc3RpbmdDb3VudEJhZGdlUGFzc2VkJywgJ3swfSBwYXNzZWQgdGVzdHMnLCBjb3VudCk7XG5cdFx0XHRjYXNlIFRlc3RpbmdDb3VudEJhZGdlLlNraXBwZWQ6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndGVzdGluZ0NvdW50QmFkZ2VTa2lwcGVkJywgJ3swfSBza2lwcGVkIHRlc3RzJywgY291bnQpO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0ZXN0aW5nQ291bnRCYWRnZUZhaWxlZCcsICd7MH0gZmFpbGVkIHRlc3RzJywgY291bnQpO1xuXHRcdH1cblx0fVxufVxuXG5jb25zdCBlbnVtIFdlbGNvbWVFeHBlcmllbmNlIHtcblx0Tm9uZSxcblx0Rm9yV29ya3NwYWNlLFxuXHRGb3JEb2N1bWVudCxcbn1cblxuY2xhc3MgVGVzdGluZ0V4cGxvcmVyVmlld01vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHB1YmxpYyB0cmVlOiBUZXN0aW5nT2JqZWN0VHJlZTxGdXp6eVNjb3JlPjtcblx0cHJpdmF0ZSBmaWx0ZXI6IFRlc3RzRmlsdGVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgcHJvamVjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJVGVzdFRyZWVQcm9qZWN0aW9uPigpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJldmVhbFRpbWVvdXQgPSBuZXcgTXV0YWJsZURpc3Bvc2FibGUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfdmlld01vZGUgPSBUZXN0aW5nQ29udGV4dEtleXMudmlld01vZGUuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3U29ydGluZyA9IFRlc3RpbmdDb250ZXh0S2V5cy52aWV3U29ydGluZy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgd2VsY29tZVZpc2liaWxpdHlFbWl0dGVyID0gbmV3IEVtaXR0ZXI8V2VsY29tZUV4cGVyaWVuY2U+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aW9uUnVubmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRlc3RFeHBsb3JlckFjdGlvblJ1bm5lcigoKSA9PiB0aGlzLnRyZWUuZ2V0U2VsZWN0aW9uKCkuZmlsdGVyKGlzRGVmaW5lZCkpKTtcblx0cHJpdmF0ZSByZWFkb25seSBsYXN0Vmlld1N0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFN0b3JlZFZhbHVlPElTZXJpYWxpemVkVGVzdFRyZWVDb2xsYXBzZVN0YXRlPih7XG5cdFx0a2V5OiAndGVzdGluZy50cmVlU3RhdGUnLFxuXHRcdHNjb3BlOiBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLFxuXHRcdHRhcmdldDogU3RvcmFnZVRhcmdldC5NQUNISU5FLFxuXHR9LCB0aGlzLnN0b3JhZ2VTZXJ2aWNlKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbm9UZXN0Rm9yRG9jdW1lbnRXaWRnZXQ6IE5vVGVzdHNGb3JEb2N1bWVudFdpZGdldDtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGVyZSdzIGEgcmV2ZWFsIHJlcXVlc3Qgd2hpY2ggaGFzIG5vdCB5ZXQgYmVlbiBkZWxpdmVyZWQuIFRoaXNcblx0ICogY2FuIGhhcHBlbiBpZiB0aGUgdXNlciBhc2tzIHRvIHJldmVhbCBiZWZvcmUgdGhlIHRlc3QgdHJlZSBpcyBsb2FkZWQuXG5cdCAqIFdlIGNoZWNrIHRvIHNlZSBpZiB0aGUgcmV2ZWFsIHJlcXVlc3QgaXMgcHJlc2VudCBvbiBlYWNoIHRyZWUgdXBkYXRlLFxuXHQgKiBhbmQgZG8gaXQgdGhlbiBpZiBzby5cblx0ICovXG5cdHByaXZhdGUgaGFzUGVuZGluZ1JldmVhbCA9IGZhbHNlO1xuXHQvKipcblx0ICogRmlyZXMgd2hlbiB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgcGxhY2Vob2xkZXIgc3RhdGUgY2hhbmdlcy5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBvbkNoYW5nZVdlbGNvbWVWaXNpYmlsaXR5ID0gdGhpcy53ZWxjb21lVmlzaWJpbGl0eUVtaXR0ZXIuZXZlbnQ7XG5cblx0LyoqXG5cdCAqIEdldHMgd2hldGhlciB0aGUgd2VsY29tZSBzaG91bGQgYmUgdmlzaWJsZS5cblx0ICovXG5cdHB1YmxpYyB3ZWxjb21lRXhwZXJpZW5jZSA9IFdlbGNvbWVFeHBlcmllbmNlLk5vbmU7XG5cblx0cHVibGljIGdldCB2aWV3TW9kZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdmlld01vZGUuZ2V0KCkgPz8gVGVzdEV4cGxvcmVyVmlld01vZGUuVHJlZTtcblx0fVxuXG5cdHB1YmxpYyBzZXQgdmlld01vZGUobmV3TW9kZTogVGVzdEV4cGxvcmVyVmlld01vZGUpIHtcblx0XHRpZiAobmV3TW9kZSA9PT0gdGhpcy5fdmlld01vZGUuZ2V0KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl92aWV3TW9kZS5zZXQobmV3TW9kZSk7XG5cdFx0dGhpcy51cGRhdGVQcmVmZXJyZWRQcm9qZWN0aW9uKCk7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSgndGVzdGluZy52aWV3TW9kZScsIG5ld01vZGUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXG5cdHB1YmxpYyBnZXQgdmlld1NvcnRpbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZpZXdTb3J0aW5nLmdldCgpID8/IFRlc3RFeHBsb3JlclZpZXdTb3J0aW5nLkJ5U3RhdHVzO1xuXHR9XG5cblx0cHVibGljIHNldCB2aWV3U29ydGluZyhuZXdTb3J0aW5nOiBUZXN0RXhwbG9yZXJWaWV3U29ydGluZykge1xuXHRcdGlmIChuZXdTb3J0aW5nID09PSB0aGlzLl92aWV3U29ydGluZy5nZXQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3ZpZXdTb3J0aW5nLnNldChuZXdTb3J0aW5nKTtcblx0XHR0aGlzLnRyZWUucmVzb3J0KG51bGwpO1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ3Rlc3Rpbmcudmlld1NvcnRpbmcnLCBuZXdTb3J0aW5nLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bGlzdENvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0b25EaWRDaGFuZ2VWaXNpYmlsaXR5OiBFdmVudDxib29sZWFuPixcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBlZGl0b3JHcm91cHNTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASVRlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVzdFNlcnZpY2U6IElUZXN0U2VydmljZSxcblx0XHRASVRlc3RFeHBsb3JlckZpbHRlclN0YXRlIHByaXZhdGUgcmVhZG9ubHkgZmlsdGVyU3RhdGU6IFRlc3RFeHBsb3JlckZpbHRlclN0YXRlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVGVzdFJlc3VsdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXN0UmVzdWx0czogSVRlc3RSZXN1bHRTZXJ2aWNlLFxuXHRcdEBJVGVzdGluZ1BlZWtPcGVuZXIgcHJpdmF0ZSByZWFkb25seSBwZWVrT3BlbmVyOiBJVGVzdGluZ1BlZWtPcGVuZXIsXG5cdFx0QElUZXN0UHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXN0UHJvZmlsZVNlcnZpY2U6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdFx0QElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjclNlcnZpY2U6IElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5oYXNQZW5kaW5nUmV2ZWFsID0gISFmaWx0ZXJTdGF0ZS5yZXZlYWwuZ2V0KCk7XG5cdFx0dGhpcy5ub1Rlc3RGb3JEb2N1bWVudFdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vVGVzdHNGb3JEb2N1bWVudFdpZGdldCwgbGlzdENvbnRhaW5lcikpO1xuXHRcdHRoaXMuX3ZpZXdNb2RlLnNldCh0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldCgndGVzdGluZy52aWV3TW9kZScsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFRlc3RFeHBsb3JlclZpZXdNb2RlLlRyZWUpIGFzIFRlc3RFeHBsb3JlclZpZXdNb2RlKTtcblx0XHR0aGlzLl92aWV3U29ydGluZy5zZXQodGhpcy5zdG9yYWdlU2VydmljZS5nZXQoJ3Rlc3Rpbmcudmlld1NvcnRpbmcnLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBUZXN0RXhwbG9yZXJWaWV3U29ydGluZy5CeUxvY2F0aW9uKSBhcyBUZXN0RXhwbG9yZXJWaWV3U29ydGluZyk7XG5cblx0XHR0aGlzLnJlZXZhbHVhdGVXZWxjb21lU3RhdGUoKTtcblx0XHR0aGlzLmZpbHRlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdHNGaWx0ZXIsIHRlc3RTZXJ2aWNlLmNvbGxlY3Rpb24pO1xuXHRcdHRoaXMudHJlZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0VGVzdGluZ09iamVjdFRyZWUsXG5cdFx0XHQnVGVzdCBFeHBsb3JlciBMaXN0Jyxcblx0XHRcdGxpc3RDb250YWluZXIsXG5cdFx0XHRuZXcgTGlzdERlbGVnYXRlKCksXG5cdFx0XHRbXG5cdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RJdGVtUmVuZGVyZXIsIHRoaXMuYWN0aW9uUnVubmVyKSxcblx0XHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXJyb3JSZW5kZXJlciksXG5cdFx0XHRdLFxuXHRcdFx0e1xuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJZGVudGl0eVByb3ZpZGVyKSxcblx0XHRcdFx0aGlkZVR3aXN0aWVzT2ZDaGlsZGxlc3NFbGVtZW50czogZmFsc2UsXG5cdFx0XHRcdHNvcnRlcjogaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJlZVNvcnRlciwgdGhpcyksXG5cdFx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRyZWVLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyKSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyKSxcblx0XHRcdFx0ZmlsdGVyOiB0aGlzLmZpbHRlcixcblx0XHRcdFx0ZmluZFdpZGdldEVuYWJsZWQ6IGZhbHNlLFxuXHRcdFx0fSkgYXMgVGVzdGluZ09iamVjdFRyZWU8RnV6enlTY29yZT47XG5cblxuXHRcdC8vIHNhdmVzIHRoZSBjb2xsYXBzZSBzdGF0ZSBzbyB0aGF0IGlmIGl0ZW1zIGFyZSByZW1vdmVkIG9yIHJlZnJlc2hlZCwgdGhleVxuXHRcdC8vIHJldGFpbiB0aGUgc2FtZSBzdGF0ZSAoIzE3MDE2OSlcblx0XHRjb25zdCBjb2xsYXBzZVN0YXRlU2F2ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHQvLyByZXVzZSB0aGUgbGFzdCB2aWV3IHN0YXRlIHRvIGF2b2lkIG1ha2luZyBhIGJ1bmNoIG9mIG9iamVjdCBnYXJiYWdlOlxuXHRcdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLnRyZWUuZ2V0T3B0aW1pemVkVmlld1N0YXRlKHRoaXMubGFzdFZpZXdTdGF0ZS5nZXQoe30pKTtcblx0XHRcdGNvbnN0IHByb2plY3Rpb24gPSB0aGlzLnByb2plY3Rpb24udmFsdWU7XG5cdFx0XHRpZiAocHJvamVjdGlvbikge1xuXHRcdFx0XHRwcm9qZWN0aW9uLmxhc3RTdGF0ZSA9IHN0YXRlO1xuXHRcdFx0fVxuXHRcdH0sIDMwMDApKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkRpZENoYW5nZUNvbGxhcHNlU3RhdGUoZXZ0ID0+IHtcblx0XHRcdGlmIChldnQubm9kZS5lbGVtZW50IGluc3RhbmNlb2YgVGVzdEl0ZW1UcmVlRWxlbWVudCkge1xuXHRcdFx0XHRpZiAoIWV2dC5ub2RlLmNvbGxhcHNlZCkge1xuXHRcdFx0XHRcdHRoaXMucHJvamVjdGlvbi52YWx1ZT8uZXhwYW5kRWxlbWVudChldnQubm9kZS5lbGVtZW50LCBldnQuZGVlcCA/IEluZmluaXR5IDogMCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29sbGFwc2VTdGF0ZVNhdmVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jclNlcnZpY2Uub25EaWRDaGFuZ2UodGVzdElkID0+IHtcblx0XHRcdGlmICh0ZXN0SWQpIHtcblx0XHRcdFx0Ly8gYSBjb250aW51b3VzIHJ1biB0ZXN0IHdpbGwgc29ydCB0byB0aGUgdG9wOlxuXHRcdFx0XHRjb25zdCBlbGVtID0gdGhpcy5wcm9qZWN0aW9uLnZhbHVlPy5nZXRFbGVtZW50QnlUZXN0SWQodGVzdElkKTtcblx0XHRcdFx0dGhpcy50cmVlLnJlc29ydChlbGVtPy5wYXJlbnQgJiYgdGhpcy50cmVlLmhhc0VsZW1lbnQoZWxlbS5wYXJlbnQpID8gZWxlbS5wYXJlbnQgOiBudWxsLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIob25EaWRDaGFuZ2VWaXNpYmlsaXR5KHZpc2libGUgPT4ge1xuXHRcdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdFx0dGhpcy5lbnN1cmVQcm9qZWN0aW9uKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uQ29udGV4dE1lbnUoZSA9PiB0aGlzLm9uQ29udGV4dE1lbnUoZSkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueShcblx0XHRcdGZpbHRlclN0YXRlLnRleHQub25EaWRDaGFuZ2UsXG5cdFx0XHRmaWx0ZXJTdGF0ZS5mdXp6eS5vbkRpZENoYW5nZSxcblx0XHRcdHRlc3RTZXJ2aWNlLmV4Y2x1ZGVkLm9uVGVzdEV4Y2x1c2lvbnNDaGFuZ2VkLFxuXHRcdCkoKCkgPT4ge1xuXHRcdFx0aWYgKCFmaWx0ZXJTdGF0ZS50ZXh0LnZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnRyZWUucmVmaWx0ZXIoKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaXRlbXMgPSB0aGlzLmZpbHRlci5sYXN0SW5jbHVkZWRUZXN0cyA9IG5ldyBTZXQoKTtcblx0XHRcdHRoaXMudHJlZS5yZWZpbHRlcigpO1xuXHRcdFx0dGhpcy5maWx0ZXIubGFzdEluY2x1ZGVkVGVzdHMgPSB1bmRlZmluZWQ7XG5cblx0XHRcdGZvciAoY29uc3QgdGVzdCBvZiBpdGVtcykge1xuXHRcdFx0XHR0aGlzLnRyZWUuZXhwYW5kVG8odGVzdCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uRGlkT3BlbihlID0+IHtcblx0XHRcdGlmICghKGUuZWxlbWVudCBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZmlsdGVyU3RhdGUuZGlkU2VsZWN0VGVzdEluRXhwbG9yZXIoZS5lbGVtZW50LnRlc3QuaXRlbS5leHRJZCk7XG5cblx0XHRcdGlmICghZS5lbGVtZW50LmNoaWxkcmVuLnNpemUgJiYgZS5lbGVtZW50LnRlc3QuaXRlbS51cmkpIHtcblx0XHRcdFx0aWYgKCF0aGlzLnRyeVBlZWtFcnJvcihlLmVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5yZXZlYWxUZXN0JywgZS5lbGVtZW50LnRlc3QuaXRlbS5leHRJZCwge1xuXHRcdFx0XHRcdFx0b3BlblRvU2lkZTogZS5zaWRlQnlTaWRlLFxuXHRcdFx0XHRcdFx0cHJlc2VydmVGb2N1czogdHJ1ZSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uQ2hhbmdlV2VsY29tZVZpc2liaWxpdHkoZSA9PiB7XG5cdFx0XHR0aGlzLm5vVGVzdEZvckRvY3VtZW50V2lkZ2V0LnNldFZpc2libGUoZSA9PT0gV2VsY29tZUV4cGVyaWVuY2UuRm9yRG9jdW1lbnQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnRyZWUuZ2V0SFRNTEVsZW1lbnQoKSwgJ2tleWRvd24nLCBldnQgPT4ge1xuXHRcdFx0aWYgKGV2dC5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0dGhpcy5oYW5kbGVFeGVjdXRlS2V5cHJlc3MoZXZ0KTtcblx0XHRcdH0gZWxzZSBpZiAoRGVmYXVsdEtleWJvYXJkTmF2aWdhdGlvbkRlbGVnYXRlLm1pZ2h0UHJvZHVjZVByaW50YWJsZUNoYXJhY3RlcihldnQpKSB7XG5cdFx0XHRcdGZpbHRlclN0YXRlLnRleHQudmFsdWUgPSBldnQuYnJvd3NlckV2ZW50LmtleTtcblx0XHRcdFx0ZmlsdGVyU3RhdGUuZm9jdXNJbnB1dCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdHRoaXMucmV2ZWFsQnlJZChmaWx0ZXJTdGF0ZS5yZXZlYWwucmVhZChyZWFkZXIpLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihvbkRpZENoYW5nZVZpc2liaWxpdHkodmlzaWJsZSA9PiB7XG5cdFx0XHRpZiAodmlzaWJsZSkge1xuXHRcdFx0XHRmaWx0ZXJTdGF0ZS5mb2N1c0lucHV0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGZvbGxvd1J1bm5pbmdUZXN0cyA9IGdldFRlc3RpbmdDb25maWd1cmF0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBUZXN0aW5nQ29uZmlnS2V5cy5Gb2xsb3dSdW5uaW5nVGVzdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVzdGluZ0NvbmZpZ0tleXMuRm9sbG93UnVubmluZ1Rlc3QpKSB7XG5cdFx0XHRcdGZvbGxvd1J1bm5pbmdUZXN0cyA9IGdldFRlc3RpbmdDb25maWd1cmF0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBUZXN0aW5nQ29uZmlnS2V5cy5Gb2xsb3dSdW5uaW5nVGVzdCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGFsd2F5c1JldmVhbFRlc3RBZnRlclN0YXRlQ2hhbmdlID0gZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvblNlcnZpY2UsIFRlc3RpbmdDb25maWdLZXlzLkFsd2F5c1JldmVhbFRlc3RPblN0YXRlQ2hhbmdlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXN0aW5nQ29uZmlnS2V5cy5BbHdheXNSZXZlYWxUZXN0T25TdGF0ZUNoYW5nZSkpIHtcblx0XHRcdFx0YWx3YXlzUmV2ZWFsVGVzdEFmdGVyU3RhdGVDaGFuZ2UgPSBnZXRUZXN0aW5nQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uU2VydmljZSwgVGVzdGluZ0NvbmZpZ0tleXMuQWx3YXlzUmV2ZWFsVGVzdE9uU3RhdGVDaGFuZ2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRlc3RSZXN1bHRzLm9uVGVzdENoYW5nZWQoZXZ0ID0+IHtcblx0XHRcdGlmICghZm9sbG93UnVubmluZ1Rlc3RzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV2dC5yZWFzb24gIT09IFRlc3RSZXN1bHRJdGVtQ2hhbmdlUmVhc29uLk93blN0YXRlQ2hhbmdlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMudHJlZS5zZWxlY3Rpb25TaXplID4gMSkge1xuXHRcdFx0XHRyZXR1cm47IC8vIGRvbid0IGNoYW5nZSBhIG11bHRpLXNlbGVjdGlvbiAjMTgwOTUwXG5cdFx0XHR9XG5cblx0XHRcdC8vIGZvbGxvdyBydW5uaW5nIHRlc3RzLCBvciB0ZXN0cyB3aG9zZSBzdGF0ZSBjaGFuZ2VkLiBUZXN0cyB0aGF0XG5cdFx0XHQvLyBjb21wbGV0ZSB2ZXJ5IGZhc3QgbWF5IG5vdCBlbnRlciB0aGUgcnVubmluZyBzdGF0ZSBhdCBhbGwuXG5cdFx0XHRpZiAoZXZ0Lml0ZW0ub3duQ29tcHV0ZWRTdGF0ZSAhPT0gVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmcgJiYgIShldnQucHJldmlvdXNTdGF0ZSA9PT0gVGVzdFJlc3VsdFN0YXRlLlF1ZXVlZCAmJiBpc1N0YXRlV2l0aFJlc3VsdChldnQuaXRlbS5vd25Db21wdXRlZFN0YXRlKSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnJldmVhbEJ5SWQoZXZ0Lml0ZW0uaXRlbS5leHRJZCwgYWx3YXlzUmV2ZWFsVGVzdEFmdGVyU3RhdGVDaGFuZ2UsIGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXN0UmVzdWx0cy5vblJlc3VsdHNDaGFuZ2VkKCgpID0+IHtcblx0XHRcdHRoaXMudHJlZS5yZXNvcnQobnVsbCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXN0UHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy50cmVlLnJlcmVuZGVyKCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgYWxsT3BlbkVkaXRvcklucHV0cyA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcyxcblx0XHRcdGVkaXRvclNlcnZpY2Uub25EaWRFZGl0b3JzQ2hhbmdlLFxuXHRcdFx0KCkgPT4gbmV3IFNldChlZGl0b3JHcm91cHNTZXJ2aWNlLmdyb3Vwcy5mbGF0TWFwKGcgPT4gZy5lZGl0b3JzKS5tYXAoZSA9PiBlLnJlc291cmNlKS5maWx0ZXIoaXNEZWZpbmVkKSksXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdGl2ZVJlc291cmNlID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCBlZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlLCAoKSA9PiB7XG5cdFx0XHRpZiAoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IgaW5zdGFuY2VvZiBEaWZmRWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0cmV0dXJuIGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yLnByaW1hcnkucmVzb3VyY2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I/LnJlc291cmNlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZmlsdGVyVGV4dCA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcy5maWx0ZXJTdGF0ZS50ZXh0Lm9uRGlkQ2hhbmdlLCAoKSA9PiB0aGlzLmZpbHRlclN0YXRlLnRleHQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGZpbHRlclRleHQucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKHRoaXMuZmlsdGVyU3RhdGUuaXNGaWx0ZXJpbmdGb3IoVGVzdEZpbHRlclRlcm0uT3BlbmVkRmlsZXMpKSB7XG5cdFx0XHRcdHRoaXMuZmlsdGVyLmZpbHRlclRvRG9jdW1lbnRVcmkoWy4uLmFsbE9wZW5FZGl0b3JJbnB1dHMucmVhZChyZWFkZXIpXSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmZpbHRlci5maWx0ZXJUb0RvY3VtZW50VXJpKFthY3RpdmVSZXNvdXJjZS5yZWFkKHJlYWRlcildLmZpbHRlcihpc0RlZmluZWQpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuZmlsdGVyU3RhdGUuaXNGaWx0ZXJpbmdGb3IoVGVzdEZpbHRlclRlcm0uQ3VycmVudERvYykgfHwgdGhpcy5maWx0ZXJTdGF0ZS5pc0ZpbHRlcmluZ0ZvcihUZXN0RmlsdGVyVGVybS5PcGVuZWRGaWxlcykpIHtcblx0XHRcdFx0dGhpcy50cmVlLnJlZmlsdGVyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zdG9yYWdlU2VydmljZS5vbldpbGxTYXZlU3RhdGUoKHsgcmVhc29uLCB9KSA9PiB7XG5cdFx0XHRpZiAocmVhc29uID09PSBXaWxsU2F2ZVN0YXRlUmVhc29uLlNIVVRET1dOKSB7XG5cdFx0XHRcdHRoaXMubGFzdFZpZXdTdGF0ZS5zdG9yZSh0aGlzLnRyZWUuZ2V0T3B0aW1pemVkVmlld1N0YXRlKCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZS1sYXlvdXQgdGhlIHRyZWUuXG5cdCAqL1xuXHRwdWJsaWMgbGF5b3V0KGhlaWdodD86IG51bWJlciwgd2lkdGg/OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRyaWVzIHRvIHJldmVhbCBieSBleHRlbnNpb24gSUQuIFF1ZXVlcyB0aGUgcmVxdWVzdCBpZiB0aGUgZXh0ZW5zaW9uXG5cdCAqIElEIGlzIG5vdCBjdXJyZW50bHkgYXZhaWxhYmxlLlxuXHQgKi9cblx0cHJpdmF0ZSByZXZlYWxCeUlkKGlkOiBzdHJpbmcgfCB1bmRlZmluZWQsIGV4cGFuZCA9IHRydWUsIGZvY3VzID0gdHJ1ZSkge1xuXHRcdGlmICghaWQpIHtcblx0XHRcdHRoaXMuaGFzUGVuZGluZ1JldmVhbCA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb2plY3Rpb24gPSB0aGlzLmVuc3VyZVByb2plY3Rpb24oKTtcblxuXHRcdC8vIElmIHRoZSBpdGVtIGl0c2VsZiBpcyB2aXNpYmxlIGluIHRoZSB0cmVlLCBzaG93IGl0LiBPdGhlcndpc2UsIGV4cGFuZFxuXHRcdC8vIGl0cyBjbG9zZXN0IHBhcmVudC5cblx0XHRsZXQgZXhwYW5kVG9MZXZlbCA9IDA7XG5cdFx0Y29uc3QgaWRQYXRoID0gWy4uLlRlc3RJZC5mcm9tU3RyaW5nKGlkKS5pZHNGcm9tUm9vdCgpXTtcblx0XHRmb3IgKGxldCBpID0gaWRQYXRoLmxlbmd0aCAtIDE7IGkgPj0gZXhwYW5kVG9MZXZlbDsgaS0tKSB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gcHJvamVjdGlvbi5nZXRFbGVtZW50QnlUZXN0SWQoaWRQYXRoW2ldLnRvU3RyaW5nKCkpO1xuXHRcdFx0Ly8gU2tpcCBhbGwgZWxlbWVudHMgdGhhdCBhcmVuJ3QgaW4gdGhlIHRyZWUuXG5cdFx0XHRpZiAoIWVsZW1lbnQgfHwgIXRoaXMudHJlZS5oYXNFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiB0aGlzICdpZicgaXMgdHJ1ZSwgd2UncmUgYXQgdGhlIGNsb3Nlc3QtdmlzaWJsZSBwYXJlbnQgdG8gdGhlIG5vZGVcblx0XHRcdC8vIHdlIHdhbnQgdG8gZXhwYW5kLiBFeHBhbmQgdGhhdCwgYW5kIHRoZW4gc3RhcnQgdGhlIGxvb3AgYWdhaW4gYmVjYXVzZVxuXHRcdFx0Ly8gd2UgbWlnaHQgYWxyZWFkeSBoYXZlIGNoaWxkcmVuIGZvciBpdC5cblx0XHRcdGlmIChpIDwgaWRQYXRoLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0aWYgKGV4cGFuZCkge1xuXHRcdFx0XHRcdHRoaXMudHJlZS5leHBhbmQoZWxlbWVudCk7XG5cdFx0XHRcdFx0ZXhwYW5kVG9MZXZlbCA9IGkgKyAxOyAvLyBhdm9pZCBhbiBpbmZpbml0ZSBsb29wIGlmIHRoZSB0ZXN0IGRvZXMgbm90IGV4aXN0XG5cdFx0XHRcdFx0aSA9IGlkUGF0aC5sZW5ndGggLSAxOyAvLyByZXN0YXJ0IHRoZSBsb29wIHNpbmNlIG5ldyBjaGlsZHJlbiBtYXkgbm93IGJlIHZpc2libGVcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBPdGhlcndpc2UsIHdlJ3ZlIGFycml2ZWQhXG5cblx0XHRcdC8vIElmIHRoZSBub2RlIG9yIGFueSBvZiBpdHMgY2hpbGRyZW4gYXJlIGV4Y2x1ZGVkLCBmbGlwIG9uIHRoZSAnc2hvd1xuXHRcdFx0Ly8gZXhjbHVkZWQgdGVzdHMnIGNoZWNrYm94IGF1dG9tYXRpY2FsbHkuIElmIHdlIGRpZG4ndCBleHBhbmQsIHRoZW4gc2V0XG5cdFx0XHQvLyB0YXJnZXQgZm9jdXMgdGFyZ2V0IHRvIHRoZSBmaXJzdCBjb2xsYXBzZWQgZWxlbWVudC5cblxuXHRcdFx0bGV0IGZvY3VzVGFyZ2V0ID0gZWxlbWVudDtcblx0XHRcdGZvciAobGV0IG46IFRlc3RJdGVtVHJlZUVsZW1lbnQgfCBudWxsID0gZWxlbWVudDsgbiBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQ7IG4gPSBuLnBhcmVudCkge1xuXHRcdFx0XHRpZiAobi50ZXN0ICYmIHRoaXMudGVzdFNlcnZpY2UuZXhjbHVkZWQuY29udGFpbnMobi50ZXN0KSkge1xuXHRcdFx0XHRcdHRoaXMuZmlsdGVyU3RhdGUudG9nZ2xlRmlsdGVyaW5nRm9yKFRlc3RGaWx0ZXJUZXJtLkhpZGRlbiwgdHJ1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWV4cGFuZCAmJiAodGhpcy50cmVlLmhhc0VsZW1lbnQobikgJiYgdGhpcy50cmVlLmlzQ29sbGFwc2VkKG4pKSkge1xuXHRcdFx0XHRcdGZvY3VzVGFyZ2V0ID0gbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmZpbHRlclN0YXRlLnJldmVhbC5zZXQodW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5oYXNQZW5kaW5nUmV2ZWFsID0gZmFsc2U7XG5cdFx0XHRpZiAoZm9jdXMpIHtcblx0XHRcdFx0dGhpcy50cmVlLmRvbUZvY3VzKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnRyZWUuZ2V0UmVsYXRpdmVUb3AoZm9jdXNUYXJnZXQpID09PSBudWxsKSB7XG5cdFx0XHRcdHRoaXMudHJlZS5yZXZlYWwoZm9jdXNUYXJnZXQsIDAuNSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucmV2ZWFsVGltZW91dC52YWx1ZSA9IGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy50cmVlLnNldEZvY3VzKFtmb2N1c1RhcmdldF0pO1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtmb2N1c1RhcmdldF0pO1xuXHRcdFx0fSwgMSk7XG5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBJZiBoZXJlLCB3ZSd2ZSBleHBhbmRlZCBhbGwgcGFyZW50cyB3ZSBjYW4uIFdhaXRpbmcgb24gZGF0YSB0byBjb21lXG5cdFx0Ly8gaW4gdG8gcG9zc2libHkgc2hvdyB0aGUgcmV2ZWFsZWQgdGVzdC5cblx0XHR0aGlzLmhhc1BlbmRpbmdSZXZlYWwgPSB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbGxhcHNlIGFsbCBpdGVtcyBpbiB0aGUgdHJlZS5cblx0ICovXG5cdHB1YmxpYyBhc3luYyBjb2xsYXBzZUFsbCgpIHtcblx0XHR0aGlzLnRyZWUuY29sbGFwc2VBbGwoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUcmllcyB0byBwZWVrIHRoZSBmaXJzdCB0ZXN0IGVycm9yLCBpZiB0aGUgaXRlbSBpcyBpbiBhIGZhaWxlZCBzdGF0ZS5cblx0ICovXG5cdHByaXZhdGUgdHJ5UGVla0Vycm9yKGl0ZW06IFRlc3RJdGVtVHJlZUVsZW1lbnQpIHtcblx0XHRjb25zdCBsb29rdXAgPSBpdGVtLnRlc3QgJiYgdGhpcy50ZXN0UmVzdWx0cy5nZXRTdGF0ZUJ5SWQoaXRlbS50ZXN0Lml0ZW0uZXh0SWQpO1xuXHRcdHJldHVybiBsb29rdXAgJiYgbG9va3VwWzFdLnRhc2tzLnNvbWUocyA9PiBpc0ZhaWxlZFN0YXRlKHMuc3RhdGUpKVxuXHRcdFx0PyB0aGlzLnBlZWtPcGVuZXIudHJ5UGVla0ZpcnN0RXJyb3IobG9va3VwWzBdLCBsb29rdXBbMV0sIHsgcHJlc2VydmVGb2N1czogdHJ1ZSB9KVxuXHRcdFx0OiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgb25Db250ZXh0TWVudShldnQ6IElUcmVlQ29udGV4dE1lbnVFdmVudDxUZXN0RXhwbG9yZXJUcmVlRWxlbWVudCB8IG51bGw+KSB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGV2dC5lbGVtZW50O1xuXHRcdGlmICghKGVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0SXRlbVRyZWVFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgYWN0aW9ucyB9ID0gZ2V0QWN0aW9uYWJsZUVsZW1lbnRBY3Rpb25zKHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHRoaXMubWVudVNlcnZpY2UsIHRoaXMudGVzdFNlcnZpY2UsIHRoaXMuY3JTZXJ2aWNlLCB0aGlzLnRlc3RQcm9maWxlU2VydmljZSwgZWxlbWVudCk7XG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZ0LmFuY2hvcixcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMuc2Vjb25kYXJ5LFxuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+IGVsZW1lbnQsXG5cdFx0XHRhY3Rpb25SdW5uZXI6IHRoaXMuYWN0aW9uUnVubmVyLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVFeGVjdXRlS2V5cHJlc3MoZXZ0OiBJS2V5Ym9hcmRFdmVudCkge1xuXHRcdGNvbnN0IGZvY3VzZWQgPSB0aGlzLnRyZWUuZ2V0Rm9jdXMoKTtcblx0XHRjb25zdCBzZWxlY3RlZCA9IHRoaXMudHJlZS5nZXRTZWxlY3Rpb24oKTtcblx0XHRsZXQgdGFyZ2V0ZWQ6IChUZXN0RXhwbG9yZXJUcmVlRWxlbWVudCB8IG51bGwpW107XG5cdFx0aWYgKGZvY3VzZWQubGVuZ3RoID09PSAxICYmIHNlbGVjdGVkLmluY2x1ZGVzKGZvY3VzZWRbMF0pKSB7XG5cdFx0XHRldnQuYnJvd3NlckV2ZW50Py5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGFyZ2V0ZWQgPSBzZWxlY3RlZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFyZ2V0ZWQgPSBmb2N1c2VkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvUnVuID0gdGFyZ2V0ZWRcblx0XHRcdC5maWx0ZXIoKGUpOiBlIGlzIFRlc3RJdGVtVHJlZUVsZW1lbnQgPT4gZSBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQpO1xuXG5cdFx0aWYgKHRvUnVuLmxlbmd0aCkge1xuXHRcdFx0dGhpcy50ZXN0U2VydmljZS5ydW5UZXN0cyh7XG5cdFx0XHRcdGdyb3VwOiBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4sXG5cdFx0XHRcdHRlc3RzOiB0b1J1bi5tYXAodCA9PiB0LnRlc3QpLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWV2YWx1YXRlV2VsY29tZVN0YXRlKCkge1xuXHRcdGNvbnN0IHNob3VsZFNob3dXZWxjb21lID0gdGhpcy50ZXN0U2VydmljZS5jb2xsZWN0aW9uLmJ1c3lQcm92aWRlcnMgPT09IDAgJiYgdGVzdENvbGxlY3Rpb25Jc0VtcHR5KHRoaXMudGVzdFNlcnZpY2UuY29sbGVjdGlvbik7XG5cdFx0Y29uc3Qgd2VsY29tZUV4cGVyaWVuY2UgPSBzaG91bGRTaG93V2VsY29tZVxuXHRcdFx0PyAodGhpcy5maWx0ZXJTdGF0ZS5pc0ZpbHRlcmluZ0ZvcihUZXN0RmlsdGVyVGVybS5DdXJyZW50RG9jKSA/IFdlbGNvbWVFeHBlcmllbmNlLkZvckRvY3VtZW50IDogV2VsY29tZUV4cGVyaWVuY2UuRm9yV29ya3NwYWNlKVxuXHRcdFx0OiBXZWxjb21lRXhwZXJpZW5jZS5Ob25lO1xuXG5cdFx0aWYgKHdlbGNvbWVFeHBlcmllbmNlICE9PSB0aGlzLndlbGNvbWVFeHBlcmllbmNlKSB7XG5cdFx0XHR0aGlzLndlbGNvbWVFeHBlcmllbmNlID0gd2VsY29tZUV4cGVyaWVuY2U7XG5cdFx0XHR0aGlzLndlbGNvbWVWaXNpYmlsaXR5RW1pdHRlci5maXJlKHdlbGNvbWVFeHBlcmllbmNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZVByb2plY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMucHJvamVjdGlvbi52YWx1ZSA/PyB0aGlzLnVwZGF0ZVByZWZlcnJlZFByb2plY3Rpb24oKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUHJlZmVycmVkUHJvamVjdGlvbigpIHtcblx0XHR0aGlzLnByb2plY3Rpb24uY2xlYXIoKTtcblxuXHRcdGNvbnN0IGxhc3RTdGF0ZSA9IHRoaXMubGFzdFZpZXdTdGF0ZS5nZXQoe30pO1xuXHRcdGlmICh0aGlzLl92aWV3TW9kZS5nZXQoKSA9PT0gVGVzdEV4cGxvcmVyVmlld01vZGUuTGlzdCkge1xuXHRcdFx0dGhpcy5wcm9qZWN0aW9uLnZhbHVlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMaXN0UHJvamVjdGlvbiwgbGFzdFN0YXRlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5wcm9qZWN0aW9uLnZhbHVlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUcmVlUHJvamVjdGlvbiwgbGFzdFN0YXRlKTtcblx0XHR9XG5cblx0XHRjb25zdCBzY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmFwcGx5UHJvamVjdGlvbkNoYW5nZXMoKSwgMjAwKSk7XG5cdFx0dGhpcy5wcm9qZWN0aW9uLnZhbHVlLm9uVXBkYXRlKCgpID0+IHtcblx0XHRcdGlmICghc2NoZWR1bGVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0c2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLmFwcGx5UHJvamVjdGlvbkNoYW5nZXMoKTtcblx0XHRyZXR1cm4gdGhpcy5wcm9qZWN0aW9uLnZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseVByb2plY3Rpb25DaGFuZ2VzKCkge1xuXHRcdHRoaXMucmVldmFsdWF0ZVdlbGNvbWVTdGF0ZSgpO1xuXHRcdHRoaXMucHJvamVjdGlvbi52YWx1ZT8uYXBwbHlUbyh0aGlzLnRyZWUpO1xuXG5cdFx0dGhpcy50cmVlLnJlZmlsdGVyKCk7XG5cblx0XHRpZiAodGhpcy5oYXNQZW5kaW5nUmV2ZWFsKSB7XG5cdFx0XHR0aGlzLnJldmVhbEJ5SWQodGhpcy5maWx0ZXJTdGF0ZS5yZXZlYWwuZ2V0KCkpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBzZWxlY3RlZCB0ZXN0cyBmcm9tIHRoZSB0cmVlLlxuXHQgKi9cblx0cHVibGljIGdldFNlbGVjdGVkVGVzdHMoKSB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5nZXRTZWxlY3Rpb24oKTtcblx0fVxufVxuXG5jb25zdCBlbnVtIEZpbHRlclJlc3VsdCB7XG5cdEV4Y2x1ZGUsXG5cdEluaGVyaXQsXG5cdEluY2x1ZGUsXG59XG5cbmNvbnN0IGhhc05vZGVJbk9yUGFyZW50T2ZVcmkgPSAoY29sbGVjdGlvbjogSU1haW5UaHJlYWRUZXN0Q29sbGVjdGlvbiwgaWRlbnQ6IElVcmlJZGVudGl0eVNlcnZpY2UsIHRlc3RVcmk6IFVSSSwgZnJvbU5vZGU/OiBzdHJpbmcpID0+IHtcblx0Y29uc3QgcXVldWU6IEl0ZXJhYmxlPHN0cmluZz5bXSA9IFtmcm9tTm9kZSA/IFtmcm9tTm9kZV0gOiBjb2xsZWN0aW9uLnJvb3RJZHNdO1xuXHR3aGlsZSAocXVldWUubGVuZ3RoKSB7XG5cdFx0Zm9yIChjb25zdCBpZCBvZiBxdWV1ZS5wb3AoKSEpIHtcblx0XHRcdGNvbnN0IG5vZGUgPSBjb2xsZWN0aW9uLmdldE5vZGVCeUlkKGlkKTtcblx0XHRcdGlmICghbm9kZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFub2RlLml0ZW0udXJpIHx8ICFpZGVudC5leHRVcmkuaXNFcXVhbE9yUGFyZW50KHRlc3RVcmksIG5vZGUuaXRlbS51cmkpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBPbmx5IHNob3cgbm9kZXMgdGhhdCBjYW4gYmUgZXhwYW5kZWQgKGFuZCBtaWdodCBoYXZlIGEgY2hpbGQgd2l0aFxuXHRcdFx0Ly8gYSByYW5nZSkgb3Igb25lcyB0aGF0IGhhdmUgYSBwaHlzaWNhbCBsb2NhdGlvbi5cblx0XHRcdGlmIChub2RlLml0ZW0ucmFuZ2UgfHwgbm9kZS5leHBhbmQgPT09IFRlc3RJdGVtRXhwYW5kU3RhdGUuRXhwYW5kYWJsZSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0cXVldWUucHVzaChub2RlLmNoaWxkcmVuKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59O1xuXG5jbGFzcyBUZXN0c0ZpbHRlciBpbXBsZW1lbnRzIElUcmVlRmlsdGVyPFRlc3RFeHBsb3JlclRyZWVFbGVtZW50PiB7XG5cdHByaXZhdGUgZG9jdW1lbnRVcmlzOiBVUklbXSA9IFtdO1xuXG5cdHB1YmxpYyBsYXN0SW5jbHVkZWRUZXN0cz86IFNldDxUZXN0RXhwbG9yZXJUcmVlRWxlbWVudD47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb2xsZWN0aW9uOiBJTWFpblRocmVhZFRlc3RDb2xsZWN0aW9uLFxuXHRcdEBJVGVzdEV4cGxvcmVyRmlsdGVyU3RhdGUgcHJpdmF0ZSByZWFkb25seSBzdGF0ZTogSVRlc3RFeHBsb3JlckZpbHRlclN0YXRlLFxuXHRcdEBJVGVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXN0U2VydmljZTogSVRlc3RTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGZpbHRlcihlbGVtZW50OiBUZXN0SXRlbVRyZWVFbGVtZW50KTogVHJlZUZpbHRlclJlc3VsdDx2b2lkPiB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0VHJlZUVycm9yTWVzc2FnZSkge1xuXHRcdFx0cmV0dXJuIFRyZWVWaXNpYmlsaXR5LlZpc2libGU7XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0ZWxlbWVudC50ZXN0XG5cdFx0XHQmJiAhdGhpcy5zdGF0ZS5pc0ZpbHRlcmluZ0ZvcihUZXN0RmlsdGVyVGVybS5IaWRkZW4pXG5cdFx0XHQmJiB0aGlzLnRlc3RTZXJ2aWNlLmV4Y2x1ZGVkLmNvbnRhaW5zKGVsZW1lbnQudGVzdClcblx0XHQpIHtcblx0XHRcdHJldHVybiBUcmVlVmlzaWJpbGl0eS5IaWRkZW47XG5cdFx0fVxuXG5cdFx0c3dpdGNoIChNYXRoLm1pbih0aGlzLnRlc3RGaWx0ZXJUZXh0KGVsZW1lbnQpLCB0aGlzLnRlc3RMb2NhdGlvbihlbGVtZW50KSwgdGhpcy50ZXN0U3RhdGUoZWxlbWVudCksIHRoaXMudGVzdFRhZ3MoZWxlbWVudCkpKSB7XG5cdFx0XHRjYXNlIEZpbHRlclJlc3VsdC5FeGNsdWRlOlxuXHRcdFx0XHRyZXR1cm4gVHJlZVZpc2liaWxpdHkuSGlkZGVuO1xuXHRcdFx0Y2FzZSBGaWx0ZXJSZXN1bHQuSW5jbHVkZTpcblx0XHRcdFx0dGhpcy5sYXN0SW5jbHVkZWRUZXN0cz8uYWRkKGVsZW1lbnQpO1xuXHRcdFx0XHRyZXR1cm4gVHJlZVZpc2liaWxpdHkuVmlzaWJsZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBUcmVlVmlzaWJpbGl0eS5SZWN1cnNlO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBmaWx0ZXJUb0RvY3VtZW50VXJpKHVyaXM6IHJlYWRvbmx5IFVSSVtdKSB7XG5cdFx0dGhpcy5kb2N1bWVudFVyaXMgPSBbLi4udXJpc107XG5cdH1cblxuXHRwcml2YXRlIHRlc3RUYWdzKGVsZW1lbnQ6IFRlc3RJdGVtVHJlZUVsZW1lbnQpOiBGaWx0ZXJSZXN1bHQge1xuXHRcdGlmICghdGhpcy5zdGF0ZS5pbmNsdWRlVGFncy5zaXplICYmICF0aGlzLnN0YXRlLmV4Y2x1ZGVUYWdzLnNpemUpIHtcblx0XHRcdHJldHVybiBGaWx0ZXJSZXN1bHQuSW5jbHVkZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gKHRoaXMuc3RhdGUuaW5jbHVkZVRhZ3Muc2l6ZSA/XG5cdFx0XHRlbGVtZW50LnRlc3QuaXRlbS50YWdzLnNvbWUodCA9PiB0aGlzLnN0YXRlLmluY2x1ZGVUYWdzLmhhcyh0KSkgOlxuXHRcdFx0dHJ1ZSkgJiYgZWxlbWVudC50ZXN0Lml0ZW0udGFncy5ldmVyeSh0ID0+ICF0aGlzLnN0YXRlLmV4Y2x1ZGVUYWdzLmhhcyh0KSlcblx0XHRcdD8gRmlsdGVyUmVzdWx0LkluY2x1ZGVcblx0XHRcdDogRmlsdGVyUmVzdWx0LkluaGVyaXQ7XG5cdH1cblxuXHRwcml2YXRlIHRlc3RTdGF0ZShlbGVtZW50OiBUZXN0SXRlbVRyZWVFbGVtZW50KTogRmlsdGVyUmVzdWx0IHtcblx0XHRpZiAodGhpcy5zdGF0ZS5pc0ZpbHRlcmluZ0ZvcihUZXN0RmlsdGVyVGVybS5GYWlsZWQpKSB7XG5cdFx0XHRyZXR1cm4gaXNGYWlsZWRTdGF0ZShlbGVtZW50LnN0YXRlKSA/IEZpbHRlclJlc3VsdC5JbmNsdWRlIDogRmlsdGVyUmVzdWx0LkluaGVyaXQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3RhdGUuaXNGaWx0ZXJpbmdGb3IoVGVzdEZpbHRlclRlcm0uRXhlY3V0ZWQpKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5zdGF0ZSAhPT0gVGVzdFJlc3VsdFN0YXRlLlVuc2V0ID8gRmlsdGVyUmVzdWx0LkluY2x1ZGUgOiBGaWx0ZXJSZXN1bHQuSW5oZXJpdDtcblx0XHR9XG5cblx0XHRyZXR1cm4gRmlsdGVyUmVzdWx0LkluY2x1ZGU7XG5cdH1cblxuXHRwcml2YXRlIHRlc3RMb2NhdGlvbihlbGVtZW50OiBUZXN0SXRlbVRyZWVFbGVtZW50KTogRmlsdGVyUmVzdWx0IHtcblx0XHRpZiAodGhpcy5kb2N1bWVudFVyaXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gRmlsdGVyUmVzdWx0LkluY2x1ZGU7XG5cdFx0fVxuXG5cdFx0aWYgKCghdGhpcy5zdGF0ZS5pc0ZpbHRlcmluZ0ZvcihUZXN0RmlsdGVyVGVybS5DdXJyZW50RG9jKSAmJiAhdGhpcy5zdGF0ZS5pc0ZpbHRlcmluZ0ZvcihUZXN0RmlsdGVyVGVybS5PcGVuZWRGaWxlcykpIHx8ICEoZWxlbWVudCBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gRmlsdGVyUmVzdWx0LkluY2x1ZGU7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZG9jdW1lbnRVcmlzLnNvbWUodXJpID0+IGhhc05vZGVJbk9yUGFyZW50T2ZVcmkodGhpcy5jb2xsZWN0aW9uLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSwgdXJpLCBlbGVtZW50LnRlc3QuaXRlbS5leHRJZCkpKSB7XG5cdFx0XHRyZXR1cm4gRmlsdGVyUmVzdWx0LkluY2x1ZGU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEZpbHRlclJlc3VsdC5Jbmhlcml0O1xuXHR9XG5cblx0cHJpdmF0ZSB0ZXN0RmlsdGVyVGV4dChlbGVtZW50OiBUZXN0SXRlbVRyZWVFbGVtZW50KSB7XG5cdFx0aWYgKHRoaXMuc3RhdGUuZ2xvYkxpc3QubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gRmlsdGVyUmVzdWx0LkluY2x1ZGU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnV6enkgPSB0aGlzLnN0YXRlLmZ1enp5LnZhbHVlO1xuXHRcdGZvciAobGV0IGU6IFRlc3RJdGVtVHJlZUVsZW1lbnQgfCBudWxsID0gZWxlbWVudDsgZTsgZSA9IGUucGFyZW50KSB7XG5cdFx0XHQvLyBzdGFydCBhcyBpbmNsdWRlZCBpZiB0aGUgZmlyc3QgZ2xvYiBpcyBhIG5lZ2F0aW9uXG5cdFx0XHRsZXQgaW5jbHVkZWQgPSB0aGlzLnN0YXRlLmdsb2JMaXN0WzBdLmluY2x1ZGUgPT09IGZhbHNlID8gRmlsdGVyUmVzdWx0LkluY2x1ZGUgOiBGaWx0ZXJSZXN1bHQuSW5oZXJpdDtcblx0XHRcdGNvbnN0IGRhdGEgPSBlLnRlc3QuaXRlbS5sYWJlbC50b0xvd2VyQ2FzZSgpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHsgaW5jbHVkZSwgdGV4dCB9IG9mIHRoaXMuc3RhdGUuZ2xvYkxpc3QpIHtcblx0XHRcdFx0aWYgKGZ1enp5ID8gZnV6enlDb250YWlucyhkYXRhLCB0ZXh0KSA6IGRhdGEuaW5jbHVkZXModGV4dCkpIHtcblx0XHRcdFx0XHRpbmNsdWRlZCA9IGluY2x1ZGUgPyBGaWx0ZXJSZXN1bHQuSW5jbHVkZSA6IEZpbHRlclJlc3VsdC5FeGNsdWRlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbmNsdWRlZCAhPT0gRmlsdGVyUmVzdWx0LkluaGVyaXQpIHtcblx0XHRcdFx0cmV0dXJuIGluY2x1ZGVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBGaWx0ZXJSZXN1bHQuSW5oZXJpdDtcblx0fVxufVxuXG5jbGFzcyBUcmVlU29ydGVyIGltcGxlbWVudHMgSVRyZWVTb3J0ZXI8VGVzdEV4cGxvcmVyVHJlZUVsZW1lbnQ+IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2aWV3TW9kZWw6IFRlc3RpbmdFeHBsb3JlclZpZXdNb2RlbCxcblx0KSB7IH1cblxuXHRwdWJsaWMgY29tcGFyZShhOiBUZXN0RXhwbG9yZXJUcmVlRWxlbWVudCwgYjogVGVzdEV4cGxvcmVyVHJlZUVsZW1lbnQpOiBudW1iZXIge1xuXHRcdGlmIChhIGluc3RhbmNlb2YgVGVzdFRyZWVFcnJvck1lc3NhZ2UgfHwgYiBpbnN0YW5jZW9mIFRlc3RUcmVlRXJyb3JNZXNzYWdlKSB7XG5cdFx0XHRyZXR1cm4gKGEgaW5zdGFuY2VvZiBUZXN0VHJlZUVycm9yTWVzc2FnZSA/IC0xIDogMCkgKyAoYiBpbnN0YW5jZW9mIFRlc3RUcmVlRXJyb3JNZXNzYWdlID8gMSA6IDApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGR1cmF0aW9uRGVsdGEgPSAoYi5kdXJhdGlvbiB8fCAwKSAtIChhLmR1cmF0aW9uIHx8IDApO1xuXHRcdGlmICh0aGlzLnZpZXdNb2RlbC52aWV3U29ydGluZyA9PT0gVGVzdEV4cGxvcmVyVmlld1NvcnRpbmcuQnlEdXJhdGlvbiAmJiBkdXJhdGlvbkRlbHRhICE9PSAwKSB7XG5cdFx0XHRyZXR1cm4gZHVyYXRpb25EZWx0YTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0ZURlbHRhID0gY21wUHJpb3JpdHkoYS5zdGF0ZSwgYi5zdGF0ZSk7XG5cdFx0aWYgKHRoaXMudmlld01vZGVsLnZpZXdTb3J0aW5nID09PSBUZXN0RXhwbG9yZXJWaWV3U29ydGluZy5CeVN0YXR1cyAmJiBzdGF0ZURlbHRhICE9PSAwKSB7XG5cdFx0XHRyZXR1cm4gc3RhdGVEZWx0YTtcblx0XHR9XG5cblx0XHRsZXQgaW5TYW1lTG9jYXRpb24gPSBmYWxzZTtcblx0XHRpZiAoYSBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQgJiYgYiBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQgJiYgYS50ZXN0Lml0ZW0udXJpICYmIGIudGVzdC5pdGVtLnVyaSAmJiBhLnRlc3QuaXRlbS51cmkudG9TdHJpbmcoKSA9PT0gYi50ZXN0Lml0ZW0udXJpLnRvU3RyaW5nKCkgJiYgYS50ZXN0Lml0ZW0ucmFuZ2UgJiYgYi50ZXN0Lml0ZW0ucmFuZ2UpIHtcblx0XHRcdGluU2FtZUxvY2F0aW9uID0gdHJ1ZTtcblxuXHRcdFx0Y29uc3QgZGVsdGEgPSBhLnRlc3QuaXRlbS5yYW5nZS5zdGFydExpbmVOdW1iZXIgLSBiLnRlc3QuaXRlbS5yYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRpZiAoZGVsdGEgIT09IDApIHtcblx0XHRcdFx0cmV0dXJuIGRlbHRhO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHNhID0gYS50ZXN0Lml0ZW0uc29ydFRleHQ7XG5cdFx0Y29uc3Qgc2IgPSBiLnRlc3QuaXRlbS5zb3J0VGV4dDtcblx0XHQvLyBJZiB0ZXN0cyBhcmUgaW4gdGhlIHNhbWUgbG9jYXRpb24gYW5kIHRoZXJlJ3Mgbm8gcHJlZmVycmVkIHNvcnRUZXh0LFxuXHRcdC8vIGtlZXAgdGhlIGV4dGVuc2lvbidzIGluc2VydGlvbiBvcmRlciAoIzE2MzQ0OSkuXG5cdFx0cmV0dXJuIGluU2FtZUxvY2F0aW9uICYmICFzYSAmJiAhc2IgPyAwIDogKHNhIHx8IGEudGVzdC5pdGVtLmxhYmVsKS5sb2NhbGVDb21wYXJlKHNiIHx8IGIudGVzdC5pdGVtLmxhYmVsKTtcblx0fVxufVxuXG5jbGFzcyBOb1Rlc3RzRm9yRG9jdW1lbnRXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBlbDogSFRNTEVsZW1lbnQ7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0QElUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZSBmaWx0ZXJTdGF0ZTogSVRlc3RFeHBsb3JlckZpbHRlclN0YXRlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0Y29uc3QgZWwgPSB0aGlzLmVsID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcudGVzdGluZy1uby10ZXN0LXBsYWNlaG9sZGVyJykpO1xuXHRcdGNvbnN0IGVtcHR5UGFyYWdyYXBoID0gZG9tLmFwcGVuZChlbCwgZG9tLiQoJ3AnKSk7XG5cdFx0ZW1wdHlQYXJhZ3JhcGguaW5uZXJUZXh0ID0gbG9jYWxpemUoJ3Rlc3RpbmdOb1Rlc3QnLCAnTm8gdGVzdHMgd2VyZSBmb3VuZCBpbiB0aGlzIGZpbGUuJyk7XG5cdFx0Y29uc3QgYnV0dG9uTGFiZWwgPSBsb2NhbGl6ZSgndGVzdGluZ0ZpbmRFeHRlbnNpb24nLCAnU2hvdyBXb3Jrc3BhY2UgVGVzdHMnKTtcblx0XHRjb25zdCBidXR0b24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKGVsLCB7IHRpdGxlOiBidXR0b25MYWJlbCwgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KSk7XG5cdFx0YnV0dG9uLmxhYmVsID0gYnV0dG9uTGFiZWw7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYnV0dG9uLm9uRGlkQ2xpY2soKCkgPT4gZmlsdGVyU3RhdGUudG9nZ2xlRmlsdGVyaW5nRm9yKFRlc3RGaWx0ZXJUZXJtLkN1cnJlbnREb2MsIGZhbHNlKSkpO1xuXHR9XG5cblx0cHVibGljIHNldFZpc2libGUoaXNWaXNpYmxlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5lbC5jbGFzc0xpc3QudG9nZ2xlKCd2aXNpYmxlJywgaXNWaXNpYmxlKTtcblx0fVxufVxuXG5jbGFzcyBUZXN0RXhwbG9yZXJBY3Rpb25SdW5uZXIgZXh0ZW5kcyBBY3Rpb25SdW5uZXIge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGdldFNlbGVjdGVkVGVzdHM6ICgpID0+IFJlYWRvbmx5QXJyYXk8VGVzdEV4cGxvcmVyVHJlZUVsZW1lbnQ+KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBydW5BY3Rpb24oYWN0aW9uOiBJQWN0aW9uLCBjb250ZXh0OiBUZXN0RXhwbG9yZXJUcmVlRWxlbWVudCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCEoYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pKSB7XG5cdFx0XHRyZXR1cm4gc3VwZXIucnVuQWN0aW9uKGFjdGlvbiwgY29udGV4dCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5nZXRTZWxlY3RlZFRlc3RzKCk7XG5cdFx0Y29uc3QgY29udGV4dElzU2VsZWN0ZWQgPSBzZWxlY3Rpb24uc29tZShzID0+IHMgPT09IGNvbnRleHQpO1xuXHRcdGNvbnN0IGFjdHVhbENvbnRleHQgPSBjb250ZXh0SXNTZWxlY3RlZCA/IHNlbGVjdGlvbiA6IFtjb250ZXh0XTtcblx0XHRjb25zdCBhY3Rpb25hYmxlID0gYWN0dWFsQ29udGV4dC5maWx0ZXIoKHQpOiB0IGlzIFRlc3RJdGVtVHJlZUVsZW1lbnQgPT4gdCBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQpO1xuXHRcdGF3YWl0IGFjdGlvbi5ydW4oLi4uYWN0aW9uYWJsZSk7XG5cdH1cbn1cblxuY29uc3QgZ2V0TGFiZWxGb3JUZXN0VHJlZUVsZW1lbnQgPSAoZWxlbWVudDogVGVzdEl0ZW1UcmVlRWxlbWVudCkgPT4ge1xuXHRsZXQgbGFiZWwgPSBsYWJlbEZvclRlc3RJblN0YXRlKGVsZW1lbnQuZGVzY3JpcHRpb24gfHwgZWxlbWVudC50ZXN0Lml0ZW0ubGFiZWwsIGVsZW1lbnQuc3RhdGUpO1xuXG5cdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVGVzdEl0ZW1UcmVlRWxlbWVudCkge1xuXHRcdGlmIChlbGVtZW50LmR1cmF0aW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGxhYmVsID0gbG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICd0ZXN0aW5nLnRyZWVFbGVtZW50TGFiZWxEdXJhdGlvbicsXG5cdFx0XHRcdGNvbW1lbnQ6IFsnezB9IGlzIHRoZSBvcmlnaW5hbCBsYWJlbCBpbiB0ZXN0aW5nLnRyZWVFbGVtZW50TGFiZWwsIHsxfSBpcyBhIGR1cmF0aW9uJ10sXG5cdFx0XHR9LCAnezB9LCBpbiB7MX0nLCBsYWJlbCwgZm9ybWF0RHVyYXRpb24oZWxlbWVudC5kdXJhdGlvbikpO1xuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50LnJldGlyZWQpIHtcblx0XHRcdGxhYmVsID0gbG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICd0ZXN0aW5nLnRyZWVFbGVtZW50TGFiZWxPdXRkYXRlZCcsXG5cdFx0XHRcdGNvbW1lbnQ6IFsnezB9IGlzIHRoZSBvcmlnaW5hbCBsYWJlbCBpbiB0ZXN0aW5nLnRyZWVFbGVtZW50TGFiZWwnXSxcblx0XHRcdH0sICd7MH0sIG91dGRhdGVkIHJlc3VsdCcsIGxhYmVsKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbGFiZWw7XG59O1xuXG5jbGFzcyBMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VGVzdEV4cGxvcmVyVHJlZUVsZW1lbnQ+IHtcblx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCd0ZXN0RXhwbG9yZXInLCBcIlRlc3QgRXhwbG9yZXJcIik7XG5cdH1cblxuXHRnZXRBcmlhTGFiZWwoZWxlbWVudDogVGVzdEV4cGxvcmVyVHJlZUVsZW1lbnQpOiBzdHJpbmcge1xuXHRcdHJldHVybiBlbGVtZW50IGluc3RhbmNlb2YgVGVzdFRyZWVFcnJvck1lc3NhZ2Vcblx0XHRcdD8gZWxlbWVudC5kZXNjcmlwdGlvblxuXHRcdFx0OiBnZXRMYWJlbEZvclRlc3RUcmVlRWxlbWVudChlbGVtZW50KTtcblx0fVxufVxuXG5jbGFzcyBUcmVlS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciBpbXBsZW1lbnRzIElLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyPFRlc3RFeHBsb3JlclRyZWVFbGVtZW50PiB7XG5cdGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKGVsZW1lbnQ6IFRlc3RFeHBsb3JlclRyZWVFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0VHJlZUVycm9yTWVzc2FnZSA/IGVsZW1lbnQubWVzc2FnZSA6IGVsZW1lbnQudGVzdC5pdGVtLmxhYmVsO1xuXHR9XG59XG5cbmNsYXNzIExpc3REZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPFRlc3RFeHBsb3JlclRyZWVFbGVtZW50PiB7XG5cdGdldEhlaWdodChlbGVtZW50OiBUZXN0RXhwbG9yZXJUcmVlRWxlbWVudCkge1xuXHRcdHJldHVybiBlbGVtZW50IGluc3RhbmNlb2YgVGVzdFRyZWVFcnJvck1lc3NhZ2UgPyAxNyArIDEwIDogMjI7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IFRlc3RFeHBsb3JlclRyZWVFbGVtZW50KSB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0VHJlZUVycm9yTWVzc2FnZSkge1xuXHRcdFx0cmV0dXJuIEVycm9yUmVuZGVyZXIuSUQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFRlc3RJdGVtUmVuZGVyZXIuSUQ7XG5cdH1cbn1cblxuY2xhc3MgSWRlbnRpdHlQcm92aWRlciBpbXBsZW1lbnRzIElJZGVudGl0eVByb3ZpZGVyPFRlc3RFeHBsb3JlclRyZWVFbGVtZW50PiB7XG5cdHB1YmxpYyBnZXRJZChlbGVtZW50OiBUZXN0RXhwbG9yZXJUcmVlRWxlbWVudCkge1xuXHRcdHJldHVybiBlbGVtZW50LnRyZWVJZDtcblx0fVxufVxuXG5pbnRlcmZhY2UgSUVycm9yVGVtcGxhdGVEYXRhIHtcblx0bGFiZWw6IEhUTUxFbGVtZW50O1xuXHRkaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmU7XG59XG5cbmNsYXNzIEVycm9yUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFRlc3RUcmVlRXJyb3JNZXNzYWdlLCBGdXp6eVNjb3JlLCBJRXJyb3JUZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2Vycm9yJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlbmRlcmVyOiBNYXJrZG93blJlbmRlcmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5yZW5kZXJlciA9IGluc3RhbnRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtkb3duUmVuZGVyZXIsIHt9KTtcblx0fVxuXG5cdGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEVycm9yUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUVycm9yVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBsYWJlbCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLmVycm9yJykpO1xuXHRcdHJldHVybiB7IGxhYmVsLCBkaXNwb3NhYmxlOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCkgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoeyBlbGVtZW50IH06IElUcmVlTm9kZTxUZXN0VHJlZUVycm9yTWVzc2FnZSwgRnV6enlTY29yZT4sIF86IG51bWJlciwgZGF0YTogSUVycm9yVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0ZG9tLmNsZWFyTm9kZShkYXRhLmxhYmVsKTtcblxuXHRcdGlmICh0eXBlb2YgZWxlbWVudC5tZXNzYWdlID09PSAnc3RyaW5nJykge1xuXHRcdFx0ZGF0YS5sYWJlbC5pbm5lclRleHQgPSBlbGVtZW50Lm1lc3NhZ2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMucmVuZGVyZXIucmVuZGVyKGVsZW1lbnQubWVzc2FnZSwgeyBpbmxpbmU6IHRydWUgfSk7XG5cdFx0XHRkYXRhLmxhYmVsLmFwcGVuZENoaWxkKHJlc3VsdC5lbGVtZW50KTtcblx0XHR9XG5cdFx0ZGF0YS5kaXNwb3NhYmxlLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgZGF0YS5sYWJlbCwgZWxlbWVudC5kZXNjcmlwdGlvbikpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKGRhdGE6IElFcnJvclRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEuZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElUZXN0RWxlbWVudFRlbXBsYXRlRGF0YSB7XG5cdGN1cnJlbnQ/OiBUZXN0SXRlbVRyZWVFbGVtZW50O1xuXHRsYWJlbDogSFRNTEVsZW1lbnQ7XG5cdGljb246IEhUTUxFbGVtZW50O1xuXHR3cmFwcGVyOiBIVE1MRWxlbWVudDtcblx0YWN0aW9uQmFyOiBBY3Rpb25CYXI7XG5cdGVsZW1lbnREaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHRlbXBsYXRlRGlzcG9zYWJsZTogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5jbGFzcyBUZXN0SXRlbVJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZVxuXHRpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8VGVzdEl0ZW1UcmVlRWxlbWVudCwgRnV6enlTY29yZSwgSVRlc3RFbGVtZW50VGVtcGxhdGVEYXRhPiB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAndGVzdEl0ZW0nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYWN0aW9uUnVubmVyOiBUZXN0RXhwbG9yZXJBY3Rpb25SdW5uZXIsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElUZXN0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgdGVzdFNlcnZpY2U6IElUZXN0U2VydmljZSxcblx0XHRASVRlc3RQcm9maWxlU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgcHJvZmlsZXM6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjclNlcnZpY2U6IElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZUlkID0gVGVzdEl0ZW1SZW5kZXJlci5JRDtcblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyByZW5kZXJUZW1wbGF0ZSh3cmFwcGVyOiBIVE1MRWxlbWVudCk6IElUZXN0RWxlbWVudFRlbXBsYXRlRGF0YSB7XG5cdFx0d3JhcHBlci5jbGFzc0xpc3QuYWRkKCd0ZXN0aW5nLXN0ZHRyZWUtY29udGFpbmVyJyk7XG5cblx0XHRjb25zdCBpY29uID0gZG9tLmFwcGVuZCh3cmFwcGVyLCBkb20uJCgnLmNvbXB1dGVkLXN0YXRlJykpO1xuXHRcdGNvbnN0IGxhYmVsID0gZG9tLmFwcGVuZCh3cmFwcGVyLCBkb20uJCgnLmxhYmVsJykpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRkb20uYXBwZW5kKHdyYXBwZXIsIGRvbS4kKFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLnRlc3RpbmdIaWRkZW5JY29uKSkpO1xuXHRcdGNvbnN0IGFjdGlvbkJhciA9IGRpc3Bvc2FibGUuYWRkKG5ldyBBY3Rpb25CYXIod3JhcHBlciwge1xuXHRcdFx0YWN0aW9uUnVubmVyOiB0aGlzLmFjdGlvblJ1bm5lcixcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+XG5cdFx0XHRcdGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uXG5cdFx0XHRcdFx0PyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHsgaG92ZXJEZWxlZ2F0ZTogb3B0aW9ucy5ob3ZlckRlbGVnYXRlIH0pXG5cdFx0XHRcdFx0OiB1bmRlZmluZWRcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlLmFkZCh0aGlzLmNyU2VydmljZS5vbkRpZENoYW5nZShjaGFuZ2VkID0+IHtcblx0XHRcdGNvbnN0IGlkID0gdGVtcGxhdGVEYXRhLmN1cnJlbnQ/LnRlc3QuaXRlbS5leHRJZDtcblx0XHRcdGlmIChpZCAmJiAoIWNoYW5nZWQgfHwgY2hhbmdlZCA9PT0gaWQgfHwgVGVzdElkLmlzQ2hpbGQoaWQsIGNoYW5nZWQpKSkge1xuXHRcdFx0XHR0aGlzLmZpbGxBY3Rpb25CYXIodGVtcGxhdGVEYXRhLmN1cnJlbnQhLCB0ZW1wbGF0ZURhdGEpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHRlbXBsYXRlRGF0YTogSVRlc3RFbGVtZW50VGVtcGxhdGVEYXRhID0geyB3cmFwcGVyLCBsYWJlbCwgYWN0aW9uQmFyLCBpY29uLCBlbGVtZW50RGlzcG9zYWJsZTogbmV3IERpc3Bvc2FibGVTdG9yZSgpLCB0ZW1wbGF0ZURpc3Bvc2FibGU6IGRpc3Bvc2FibGUgfTtcblx0XHRyZXR1cm4gdGVtcGxhdGVEYXRhO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJVGVzdEVsZW1lbnRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEudGVtcGxhdGVEaXNwb3NhYmxlLmNsZWFyKCk7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdGRpc3Bvc2VFbGVtZW50KF9lbGVtZW50OiBJVHJlZU5vZGU8VGVzdEl0ZW1UcmVlRWxlbWVudCwgRnV6enlTY29yZT4sIF86IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJVGVzdEVsZW1lbnRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGUuY2xlYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgZmlsbEFjdGlvbkJhcihlbGVtZW50OiBUZXN0SXRlbVRyZWVFbGVtZW50LCBkYXRhOiBJVGVzdEVsZW1lbnRUZW1wbGF0ZURhdGEpIHtcblx0XHRjb25zdCB7IGFjdGlvbnMsIGNvbnRleHRPdmVybGF5IH0gPSBnZXRBY3Rpb25hYmxlRWxlbWVudEFjdGlvbnModGhpcy5jb250ZXh0S2V5U2VydmljZSwgdGhpcy5tZW51U2VydmljZSwgdGhpcy50ZXN0U2VydmljZSwgdGhpcy5jclNlcnZpY2UsIHRoaXMucHJvZmlsZXMsIGVsZW1lbnQpO1xuXHRcdGNvbnN0IGNyU2VsZiA9ICEhY29udGV4dE92ZXJsYXkuZ2V0Q29udGV4dEtleVZhbHVlKFRlc3RpbmdDb250ZXh0S2V5cy5pc0NvbnRpbnVvdXNNb2RlT24ua2V5KTtcblx0XHRjb25zdCBjckNoaWxkID0gIWNyU2VsZiAmJiB0aGlzLmNyU2VydmljZS5pc0VuYWJsZWRGb3JBQ2hpbGRPZihlbGVtZW50LnRlc3QuaXRlbS5leHRJZCk7XG5cdFx0ZGF0YS5hY3Rpb25CYXIuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCd0ZXN0aW5nLWlzLWNvbnRpbnVvdXMtcnVuJywgY3JTZWxmIHx8IGNyQ2hpbGQpO1xuXHRcdGRhdGEuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0ZGF0YS5hY3Rpb25CYXIuY29udGV4dCA9IGVsZW1lbnQ7XG5cdFx0ZGF0YS5hY3Rpb25CYXIucHVzaChhY3Rpb25zLnByaW1hcnksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgcmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8VGVzdEl0ZW1UcmVlRWxlbWVudCwgRnV6enlTY29yZT4sIF9kZXB0aDogbnVtYmVyLCBkYXRhOiBJVGVzdEVsZW1lbnRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0ZGF0YS5jdXJyZW50ID0gbm9kZS5lbGVtZW50O1xuXG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5hZGQobm9kZS5lbGVtZW50Lm9uQ2hhbmdlKCgpID0+IHRoaXMuX3JlbmRlckVsZW1lbnQobm9kZSwgZGF0YSkpKTtcblx0XHR0aGlzLl9yZW5kZXJFbGVtZW50KG5vZGUsIGRhdGEpO1xuXHR9XG5cblx0cHVibGljIF9yZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxUZXN0SXRlbVRyZWVFbGVtZW50LCBGdXp6eVNjb3JlPiwgZGF0YTogSVRlc3RFbGVtZW50VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGhpcy5maWxsQWN0aW9uQmFyKG5vZGUuZWxlbWVudCwgZGF0YSk7XG5cblx0XHRjb25zdCB0ZXN0SGlkZGVuID0gdGhpcy50ZXN0U2VydmljZS5leGNsdWRlZC5jb250YWlucyhub2RlLmVsZW1lbnQudGVzdCk7XG5cdFx0ZGF0YS53cmFwcGVyLmNsYXNzTGlzdC50b2dnbGUoJ3Rlc3QtaXMtaGlkZGVuJywgdGVzdEhpZGRlbik7XG5cblx0XHRjb25zdCBpY29uID0gaWNvbnMudGVzdGluZ1N0YXRlc1RvSWNvbnMuZ2V0KFxuXHRcdFx0bm9kZS5lbGVtZW50LnRlc3QuZXhwYW5kID09PSBUZXN0SXRlbUV4cGFuZFN0YXRlLkJ1c3lFeHBhbmRpbmcgfHwgbm9kZS5lbGVtZW50LnRlc3QuaXRlbS5idXN5XG5cdFx0XHRcdD8gVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmdcblx0XHRcdFx0OiBub2RlLmVsZW1lbnQuc3RhdGUpO1xuXG5cdFx0ZGF0YS5pY29uLmNsYXNzTmFtZSA9ICdjb21wdXRlZC1zdGF0ZSAnICsgKGljb24gPyBUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbikgOiAnJyk7XG5cdFx0aWYgKG5vZGUuZWxlbWVudC5yZXRpcmVkKSB7XG5cdFx0XHRkYXRhLmljb24uY2xhc3NOYW1lICs9ICcgcmV0aXJlZCc7XG5cdFx0fVxuXG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGRhdGEubGFiZWwsIGdldExhYmVsRm9yVGVzdFRyZWVFbGVtZW50KG5vZGUuZWxlbWVudCkpKTtcblx0XHRpZiAobm9kZS5lbGVtZW50LnRlc3QuaXRlbS5sYWJlbC50cmltKCkpIHtcblx0XHRcdGRvbS5yZXNldChkYXRhLmxhYmVsLCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyhub2RlLmVsZW1lbnQudGVzdC5pdGVtLmxhYmVsKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRhdGEubGFiZWwudGV4dENvbnRlbnQgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4QTApOyAvLyAmbmJzcDtcblx0XHR9XG5cblx0XHRsZXQgZGVzY3JpcHRpb24gPSBub2RlLmVsZW1lbnQuZGVzY3JpcHRpb247XG5cdFx0aWYgKG5vZGUuZWxlbWVudC5kdXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRkZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uXG5cdFx0XHRcdD8gYCR7ZGVzY3JpcHRpb259OiAke2Zvcm1hdER1cmF0aW9uKG5vZGUuZWxlbWVudC5kdXJhdGlvbil9YFxuXHRcdFx0XHQ6IGZvcm1hdER1cmF0aW9uKG5vZGUuZWxlbWVudC5kdXJhdGlvbik7XG5cdFx0fVxuXG5cdFx0aWYgKGRlc2NyaXB0aW9uKSB7XG5cdFx0XHRkb20uYXBwZW5kKGRhdGEubGFiZWwsIGRvbS4kKCdzcGFuLnRlc3QtbGFiZWwtZGVzY3JpcHRpb24nLCB7fSwgZGVzY3JpcHRpb24pKTtcblx0XHR9XG5cdH1cbn1cblxuY29uc3QgZm9ybWF0RHVyYXRpb24gPSAobXM6IG51bWJlcikgPT4ge1xuXHRpZiAobXMgPCAxMCkge1xuXHRcdHJldHVybiBgJHttcy50b0ZpeGVkKDEpfW1zYDtcblx0fVxuXG5cdGlmIChtcyA8IDFfMDAwKSB7XG5cdFx0cmV0dXJuIGAke21zLnRvRml4ZWQoMCl9bXNgO1xuXHR9XG5cblx0cmV0dXJuIGAkeyhtcyAvIDEwMDApLnRvRml4ZWQoMSl9c2A7XG59O1xuXG5jb25zdCBnZXRBY3Rpb25hYmxlRWxlbWVudEFjdGlvbnMgPSAoXG5cdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdHRlc3RTZXJ2aWNlOiBJVGVzdFNlcnZpY2UsXG5cdGNyU2VydmljZTogSVRlc3RpbmdDb250aW51b3VzUnVuU2VydmljZSxcblx0cHJvZmlsZXM6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdGVsZW1lbnQ6IFRlc3RJdGVtVHJlZUVsZW1lbnQsXG4pID0+IHtcblx0Y29uc3QgdGVzdCA9IGVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0SXRlbVRyZWVFbGVtZW50ID8gZWxlbWVudC50ZXN0IDogdW5kZWZpbmVkO1xuXHRjb25zdCBjb250ZXh0S2V5czogW3N0cmluZywgdW5rbm93bl1bXSA9IGdldFRlc3RJdGVtQ29udGV4dE92ZXJsYXkodGVzdCwgdGVzdCA/IHByb2ZpbGVzLmNhcGFiaWxpdGllc0ZvclRlc3QodGVzdC5pdGVtKSA6IDApO1xuXHRjb250ZXh0S2V5cy5wdXNoKFsndmlldycsIFRlc3RpbmcuRXhwbG9yZXJWaWV3SWRdKTtcblx0aWYgKHRlc3QpIHtcblx0XHRjb25zdCBjdHJsID0gdGVzdFNlcnZpY2UuZ2V0VGVzdENvbnRyb2xsZXIodGVzdC5jb250cm9sbGVySWQpO1xuXHRcdGNvbnN0IHN1cHBvcnRzQ3IgPSAhIWN0cmwgJiYgcHJvZmlsZXMuZ2V0Q29udHJvbGxlclByb2ZpbGVzKGN0cmwuaWQpLnNvbWUocCA9PlxuXHRcdFx0cC5zdXBwb3J0c0NvbnRpbnVvdXNSdW4gJiYgY2FuVXNlUHJvZmlsZVdpdGhUZXN0KHAsIHRlc3QpKTtcblx0XHRjb250ZXh0S2V5cy5wdXNoKFtcblx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5jYW5SZWZyZXNoVGVzdHMua2V5LFxuXHRcdFx0Y3RybCAmJiAhIShjdHJsLmNhcGFiaWxpdGllcy5nZXQoKSAmIFRlc3RDb250cm9sbGVyQ2FwYWJpbGl0eS5SZWZyZXNoKSAmJiBUZXN0SWQuaXNSb290KHRlc3QuaXRlbS5leHRJZCksXG5cdFx0XSwgW1xuXHRcdFx0VGVzdGluZ0NvbnRleHRLZXlzLnRlc3RJdGVtSXNIaWRkZW4ua2V5LFxuXHRcdFx0dGVzdFNlcnZpY2UuZXhjbHVkZWQuY29udGFpbnModGVzdClcblx0XHRdLCBbXG5cdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuaXNDb250aW51b3VzTW9kZU9uLmtleSxcblx0XHRcdHN1cHBvcnRzQ3IgJiYgY3JTZXJ2aWNlLmlzU3BlY2lmaWNhbGx5RW5hYmxlZEZvcih0ZXN0Lml0ZW0uZXh0SWQpXG5cdFx0XSwgW1xuXHRcdFx0VGVzdGluZ0NvbnRleHRLZXlzLmlzUGFyZW50UnVubmluZ0NvbnRpbnVvdXNseS5rZXksXG5cdFx0XHRzdXBwb3J0c0NyICYmIGNyU2VydmljZS5pc0VuYWJsZWRGb3JBUGFyZW50T2YodGVzdC5pdGVtLmV4dElkKVxuXHRcdF0sIFtcblx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5zdXBwb3J0c0NvbnRpbnVvdXNSdW4ua2V5LFxuXHRcdFx0c3VwcG9ydHNDcixcblx0XHRdLCBbXG5cdFx0XHRUZXN0aW5nQ29udGV4dEtleXMudGVzdFJlc3VsdE91dGRhdGVkLmtleSxcblx0XHRcdGVsZW1lbnQucmV0aXJlZCxcblx0XHRdLCBbXG5cdFx0XHRUZXN0aW5nQ29udGV4dEtleXMudGVzdFJlc3VsdFN0YXRlLmtleSxcblx0XHRcdHRlc3RSZXN1bHRTdGF0ZVRvQ29udGV4dFZhbHVlc1tlbGVtZW50LnN0YXRlXSxcblx0XHRdKTtcblx0fVxuXG5cdGNvbnN0IGNvbnRleHRPdmVybGF5ID0gY29udGV4dEtleVNlcnZpY2UuY3JlYXRlT3ZlcmxheShjb250ZXh0S2V5cyk7XG5cdGNvbnN0IG1lbnUgPSBtZW51U2VydmljZS5nZXRNZW51QWN0aW9ucyhNZW51SWQuVGVzdEl0ZW0sIGNvbnRleHRPdmVybGF5LCB7XG5cdFx0c2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUsXG5cdH0pO1xuXG5cdGNvbnN0IGFjdGlvbnMgPSBnZXRBY3Rpb25CYXJBY3Rpb25zKG1lbnUsICdpbmxpbmUnKTtcblxuXHRyZXR1cm4geyBhY3Rpb25zLCBjb250ZXh0T3ZlcmxheSB9O1xufTtcblxucmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQoKHRoZW1lLCBjb2xsZWN0b3IpID0+IHtcblx0aWYgKHRoZW1lLnR5cGUgPT09ICdkYXJrJykge1xuXHRcdGNvbnN0IGZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGZvcmVncm91bmQpO1xuXHRcdGlmIChmb3JlZ3JvdW5kQ29sb3IpIHtcblx0XHRcdGNvbnN0IGZnV2l0aE9wYWNpdHkgPSBuZXcgQ29sb3IobmV3IFJHQkEoZm9yZWdyb3VuZENvbG9yLnJnYmEuciwgZm9yZWdyb3VuZENvbG9yLnJnYmEuZywgZm9yZWdyb3VuZENvbG9yLnJnYmEuYiwgMC42NSkpO1xuXHRcdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC50ZXN0LWV4cGxvcmVyIC50ZXN0LWV4cGxvcmVyLW1lc3NhZ2VzIHsgY29sb3I6ICR7ZmdXaXRoT3BhY2l0eX07IH1gKTtcblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFHckIsU0FBUyxpQkFBa0M7QUFDM0MsU0FBUyxjQUFjO0FBRXZCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMseUNBQXFFO0FBQzlFLFNBQXNHLHNCQUFzQjtBQUM1SCxTQUFTLFFBQVEsY0FBdUIsaUJBQWlCO0FBQ3pELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsa0JBQWtCLHlCQUF5QjtBQUNwRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxPQUFPLFlBQVk7QUFDNUIsU0FBUyxTQUFTLGFB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RUFDRjtBQUVBLFFBQU0saUJBQWlCLGtCQUFrQixjQUFjLFdBQVc7QUFDbEUsUUFBTSxPQUFPLFlBQVksZUFBZSxPQUFPLFVBQVUsZ0JBQWdCO0FBQUEsSUFDeEUsbUJBQW1CO0FBQUEsRUFDcEIsQ0FBQztBQUVELFFBQU0sVUFBVSxvQkFBb0IsTUFBTSxRQUFRO0FBRWxELFNBQU8sRUFBRSxTQUFTLGVBQWU7QUFDbEM7QUFFQSwyQkFBMkIsQ0FBQyxPQUFPLGNBQWM7QUFDaEQsTUFBSSxNQUFNLFNBQVMsUUFBUTtBQUMxQixVQUFNLGtCQUFrQixNQUFNLFNBQVMsVUFBVTtBQUNqRCxRQUFJLGlCQUFpQjtBQUNwQixZQUFNLGdCQUFnQixJQUFJLE1BQU0sSUFBSSxLQUFLLGdCQUFnQixLQUFLLEdBQUcsZ0JBQWdCLEtBQUssR0FBRyxnQkFBZ0IsS0FBSyxHQUFHLElBQUksQ0FBQztBQUN0SCxnQkFBVSxRQUFRLG1EQUFtRCxhQUFhLEtBQUs7QUFBQSxJQUN4RjtBQUFBLEVBQ0Q7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJMYXN0Rm9jdXNTdGF0ZSIsICJXZWxjb21lRXhwZXJpZW5jZSIsICJGaWx0ZXJSZXN1bHQiXQp9Cg==
