import { distinct } from "../../../../base/common/arrays.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isDefined } from "../../../../base/common/types.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { SymbolNavigationAction } from "../../../../editor/contrib/gotoSymbol/browser/goToCommands.js";
import { ReferencesModel } from "../../../../editor/contrib/gotoSymbol/browser/referencesModel.js";
import { MessageController } from "../../../../editor/contrib/message/browser/messageController.js";
import { PeekContext } from "../../../../editor/contrib/peekView/browser/peekView.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, ContextKeyGreaterExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { widgetClose } from "../../../../platform/theme/common/iconRegistry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ViewAction } from "../../../browser/parts/views/viewPane.js";
import { FocusedViewContext } from "../../../common/contextkeys.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { TestItemTreeElement } from "./explorerProjections/index.js";
import * as icons from "./icons.js";
import { TestingConfigKeys, getTestingConfiguration } from "../common/configuration.js";
import { TestCommandId, TestExplorerViewMode, TestExplorerViewSorting, Testing, testConfigurationGroupNames } from "../common/constants.js";
import { ITestCoverageService } from "../common/testCoverageService.js";
import { TestId } from "../common/testId.js";
import { ITestProfileService, canUseProfileWithTest } from "../common/testProfileService.js";
import { ITestResultService } from "../common/testResultService.js";
import { ITestService, expandAndGetTestById, testsInFile, testsUnderUri } from "../common/testService.js";
import { ExtTestRunProfileKind, TestItemExpandState, TestRunProfileBitset } from "../common/testTypes.js";
import { TestingContextKeys } from "../common/testingContextKeys.js";
import { ITestingContinuousRunService } from "../common/testingContinuousRunService.js";
import { ITestingPeekOpener } from "../common/testingPeekOpener.js";
import { isFailedState } from "../common/testingStates.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
const category = Categories.Test;
var ActionOrder = /* @__PURE__ */ ((ActionOrder2) => {
  ActionOrder2[ActionOrder2["Refresh"] = 10] = "Refresh";
  ActionOrder2[ActionOrder2["Run"] = 11] = "Run";
  ActionOrder2[ActionOrder2["Debug"] = 12] = "Debug";
  ActionOrder2[ActionOrder2["Coverage"] = 13] = "Coverage";
  ActionOrder2[ActionOrder2["RunContinuous"] = 14] = "RunContinuous";
  ActionOrder2[ActionOrder2["RunUsing"] = 15] = "RunUsing";
  ActionOrder2[ActionOrder2["Collapse"] = 16] = "Collapse";
  ActionOrder2[ActionOrder2["ClearResults"] = 17] = "ClearResults";
  ActionOrder2[ActionOrder2["DisplayMode"] = 18] = "DisplayMode";
  ActionOrder2[ActionOrder2["Sort"] = 19] = "Sort";
  ActionOrder2[ActionOrder2["GoToTest"] = 20] = "GoToTest";
  ActionOrder2[ActionOrder2["HideTest"] = 21] = "HideTest";
  ActionOrder2[ActionOrder2["ContinuousRunTest"] = 2147483647] = "ContinuousRunTest";
  return ActionOrder2;
})(ActionOrder || {});
const hasAnyTestProvider = ContextKeyGreaterExpr.create(TestingContextKeys.providerCount.key, 0);
const LABEL_RUN_TESTS = localize2("runSelectedTests", "Run Tests");
const LABEL_DEBUG_TESTS = localize2("debugSelectedTests", "Debug Tests");
const LABEL_COVERAGE_TESTS = localize2("coverageSelectedTests", "Run Tests with Coverage");
class HideTestAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.HideTestAction,
      title: localize2("hideTest", "Hide Test"),
      menu: {
        id: MenuId.TestItem,
        group: "builtin@2",
        when: TestingContextKeys.testItemIsHidden.isEqualTo(false)
      }
    });
  }
  run(accessor, ...elements) {
    const service = accessor.get(ITestService);
    for (const element of elements) {
      service.excluded.toggle(element.test, true);
    }
    return Promise.resolve();
  }
}
class UnhideTestAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.UnhideTestAction,
      title: localize2("unhideTest", "Unhide Test"),
      menu: {
        id: MenuId.TestItem,
        order: 21 /* HideTest */,
        when: TestingContextKeys.testItemIsHidden.isEqualTo(true)
      }
    });
  }
  run(accessor, ...elements) {
    const service = accessor.get(ITestService);
    for (const element of elements) {
      if (element instanceof TestItemTreeElement) {
        service.excluded.toggle(element.test, false);
      }
    }
    return Promise.resolve();
  }
}
class UnhideAllTestsAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.UnhideAllTestsAction,
      title: localize2("unhideAllTests", "Unhide All Tests")
    });
  }
  run(accessor) {
    const service = accessor.get(ITestService);
    service.excluded.clear();
    return Promise.resolve();
  }
}
const testItemInlineAndInContext = (order, when) => [
  {
    id: MenuId.TestItem,
    group: "inline",
    order,
    when
  },
  {
    id: MenuId.TestItem,
    group: "builtin@1",
    order,
    when
  }
];
class RunVisibleAction extends ViewAction {
  constructor(bitset, desc) {
    super({
      ...desc,
      viewId: Testing.ExplorerViewId
    });
    this.bitset = bitset;
  }
  /**
   * @override
   */
  runInView(accessor, view, ...elements) {
    const { include, exclude } = view.getTreeIncludeExclude(this.bitset, elements.map((e) => e.test));
    return accessor.get(ITestService).runTests({
      tests: include,
      exclude,
      group: this.bitset
    });
  }
}
class DebugAction extends RunVisibleAction {
  constructor() {
    super(TestRunProfileBitset.Debug, {
      id: TestCommandId.DebugAction,
      title: localize2("debug test", "Debug Test"),
      icon: icons.testingDebugIcon,
      menu: testItemInlineAndInContext(12 /* Debug */, TestingContextKeys.hasDebuggableTests.isEqualTo(true))
    });
  }
}
class CoverageAction extends RunVisibleAction {
  constructor() {
    super(TestRunProfileBitset.Coverage, {
      id: TestCommandId.RunWithCoverageAction,
      title: localize2("run with cover test", "Run Test with Coverage"),
      icon: icons.testingCoverageIcon,
      menu: testItemInlineAndInContext(13 /* Coverage */, TestingContextKeys.hasCoverableTests.isEqualTo(true))
    });
  }
}
class RunUsingProfileAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.RunUsingProfileAction,
      title: localize2("testing.runUsing", "Execute Using Profile..."),
      icon: icons.testingDebugIcon,
      menu: {
        id: MenuId.TestItem,
        order: 15 /* RunUsing */,
        group: "builtin@2",
        when: TestingContextKeys.hasNonDefaultProfile.isEqualTo(true)
      }
    });
  }
  async run(acessor, ...elements) {
    const commandService = acessor.get(ICommandService);
    const testService = acessor.get(ITestService);
    const profile = await commandService.executeCommand("vscode.pickTestProfile", {
      onlyForTest: elements[0].test
    });
    if (!profile) {
      return;
    }
    testService.runResolvedTests({
      group: profile.group,
      targets: [{
        profileId: profile.profileId,
        controllerId: profile.controllerId,
        testIds: elements.filter((t) => canUseProfileWithTest(profile, t.test)).map((t) => t.test.item.extId)
      }]
    });
  }
}
class RunAction extends RunVisibleAction {
  constructor() {
    super(TestRunProfileBitset.Run, {
      id: TestCommandId.RunAction,
      title: localize2("run test", "Run Test"),
      icon: icons.testingRunIcon,
      menu: testItemInlineAndInContext(11 /* Run */, TestingContextKeys.hasRunnableTests.isEqualTo(true))
    });
  }
}
class SelectDefaultTestProfiles extends Action2 {
  constructor() {
    super({
      id: TestCommandId.SelectDefaultTestProfiles,
      title: localize2("testing.selectDefaultTestProfiles", "Select Default Profile"),
      icon: icons.testingUpdateProfiles,
      category
    });
  }
  async run(acessor, onlyGroup) {
    const commands = acessor.get(ICommandService);
    const testProfileService = acessor.get(ITestProfileService);
    const profiles = await commands.executeCommand("vscode.pickMultipleTestProfiles", {
      showConfigureButtons: false,
      selected: testProfileService.getGroupDefaultProfiles(onlyGroup),
      onlyGroup
    });
    if (profiles?.length) {
      testProfileService.setGroupDefaultProfiles(onlyGroup, profiles);
    }
  }
}
class ContinuousRunTestAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ToggleContinousRunForTest,
      title: localize2("testing.toggleContinuousRunOn", "Turn on Continuous Run"),
      icon: icons.testingTurnContinuousRunOn,
      precondition: ContextKeyExpr.or(
        TestingContextKeys.isContinuousModeOn.isEqualTo(true),
        TestingContextKeys.isParentRunningContinuously.isEqualTo(false)
      ),
      toggled: {
        condition: TestingContextKeys.isContinuousModeOn.isEqualTo(true),
        icon: icons.testingContinuousIsOn,
        title: localize("testing.toggleContinuousRunOff", "Turn off Continuous Run")
      },
      menu: testItemInlineAndInContext(2147483647 /* ContinuousRunTest */, TestingContextKeys.supportsContinuousRun.isEqualTo(true))
    });
  }
  async run(accessor, ...elements) {
    const crService = accessor.get(ITestingContinuousRunService);
    for (const element of elements) {
      const id = element.test.item.extId;
      if (crService.isSpecificallyEnabledFor(id)) {
        crService.stop(id);
        continue;
      }
      crService.start(TestRunProfileBitset.Run, id);
    }
  }
}
class ContinuousRunUsingProfileTestAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ContinousRunUsingForTest,
      title: localize2("testing.startContinuousRunUsing", "Start Continous Run Using..."),
      icon: icons.testingDebugIcon,
      menu: [
        {
          id: MenuId.TestItem,
          order: 14 /* RunContinuous */,
          group: "builtin@2",
          when: ContextKeyExpr.and(
            TestingContextKeys.supportsContinuousRun.isEqualTo(true),
            TestingContextKeys.isContinuousModeOn.isEqualTo(false)
          )
        }
      ]
    });
  }
  async run(accessor, ...elements) {
    const crService = accessor.get(ITestingContinuousRunService);
    const profileService = accessor.get(ITestProfileService);
    const notificationService = accessor.get(INotificationService);
    const quickInputService = accessor.get(IQuickInputService);
    for (const element of elements) {
      const selected = await selectContinuousRunProfiles(
        crService,
        notificationService,
        quickInputService,
        [{ profiles: profileService.getControllerProfiles(element.test.controllerId) }]
      );
      if (selected.length) {
        crService.start(selected, element.test.item.extId);
      }
    }
  }
}
class ConfigureTestProfilesAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ConfigureTestProfilesAction,
      title: localize2("testing.configureProfile", "Configure Test Profiles"),
      icon: icons.testingUpdateProfiles,
      f1: true,
      category,
      menu: {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasConfigurableProfile.isEqualTo(true)
      }
    });
  }
  async run(acessor, onlyGroup) {
    const commands = acessor.get(ICommandService);
    const testProfileService = acessor.get(ITestProfileService);
    const profile = await commands.executeCommand("vscode.pickTestProfile", {
      placeholder: localize("configureProfile", "Select a profile to update"),
      showConfigureButtons: false,
      onlyConfigurable: true,
      onlyGroup
    });
    if (profile) {
      testProfileService.configure(profile.controllerId, profile.profileId);
    }
  }
}
const continuousMenus = (whenIsContinuousOn) => [
  {
    id: MenuId.ViewTitle,
    group: "navigation",
    order: 15 /* RunUsing */,
    when: ContextKeyExpr.and(
      ContextKeyExpr.equals("view", Testing.ExplorerViewId),
      TestingContextKeys.supportsContinuousRun.isEqualTo(true),
      TestingContextKeys.isContinuousModeOn.isEqualTo(whenIsContinuousOn)
    )
  },
  {
    id: MenuId.CommandPalette,
    when: TestingContextKeys.supportsContinuousRun.isEqualTo(true)
  }
];
class StopContinuousRunAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.StopContinousRun,
      title: localize2("testing.stopContinuous", "Stop Continuous Run"),
      category,
      icon: icons.testingTurnContinuousRunOff,
      menu: continuousMenus(true)
    });
  }
  run(accessor) {
    accessor.get(ITestingContinuousRunService).stop();
  }
}
function selectContinuousRunProfiles(crs, notificationService, quickInputService, profilesToPickFrom) {
  const items = [];
  for (const { controller, profiles } of profilesToPickFrom) {
    for (const profile of profiles) {
      if (profile.supportsContinuousRun) {
        items.push({
          label: profile.label || controller?.label.get() || "",
          description: controller?.label.get(),
          profile
        });
      }
    }
  }
  if (items.length === 0) {
    notificationService.info(localize("testing.noProfiles", "No test continuous run-enabled profiles were found"));
    return Promise.resolve([]);
  }
  if (items.length === 1) {
    return Promise.resolve([items[0].profile]);
  }
  const qpItems = [];
  const selectedItems = [];
  const lastRun = crs.lastRunProfileIds;
  items.sort((a, b) => a.profile.group - b.profile.group || a.profile.controllerId.localeCompare(b.profile.controllerId) || a.label.localeCompare(b.label));
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i === 0 || items[i - 1].profile.group !== item.profile.group) {
      qpItems.push({ type: "separator", label: testConfigurationGroupNames[item.profile.group] });
    }
    qpItems.push(item);
    if (lastRun.has(item.profile.profileId)) {
      selectedItems.push(item);
    }
  }
  const disposables = new DisposableStore();
  const quickpick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
  quickpick.title = localize("testing.selectContinuousProfiles", "Select profiles to run when files change:");
  quickpick.canSelectMany = true;
  quickpick.items = qpItems;
  quickpick.selectedItems = selectedItems;
  quickpick.show();
  return new Promise((resolve) => {
    disposables.add(quickpick.onDidAccept(() => {
      resolve(quickpick.selectedItems.map((i) => i.profile));
      disposables.dispose();
    }));
    disposables.add(quickpick.onDidHide(() => {
      resolve([]);
      disposables.dispose();
    }));
  });
}
class StartContinuousRunAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.StartContinousRun,
      title: localize2("testing.startContinuous", "Start Continuous Run"),
      category,
      icon: icons.testingTurnContinuousRunOn,
      menu: continuousMenus(false)
    });
  }
  async run(accessor) {
    const crs = accessor.get(ITestingContinuousRunService);
    const profileService = accessor.get(ITestProfileService);
    const lastRunProfiles = [...profileService.all()].flatMap((p) => p.profiles.filter((p2) => crs.lastRunProfileIds.has(p2.profileId)));
    if (lastRunProfiles.length) {
      return crs.start(lastRunProfiles);
    }
    const selected = await selectContinuousRunProfiles(crs, accessor.get(INotificationService), accessor.get(IQuickInputService), accessor.get(ITestProfileService).all());
    if (selected.length) {
      crs.start(selected);
    }
  }
}
class ExecuteSelectedAction extends ViewAction {
  constructor(options, group) {
    super({
      ...options,
      menu: [{
        id: MenuId.ViewTitle,
        order: group === TestRunProfileBitset.Run ? 11 /* Run */ : group === TestRunProfileBitset.Debug ? 12 /* Debug */ : 13 /* Coverage */,
        group: "navigation",
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("view", Testing.ExplorerViewId),
          TestingContextKeys.isRunning.isEqualTo(false),
          TestingContextKeys.capabilityToContextKey[group].isEqualTo(true)
        )
      }],
      category,
      viewId: Testing.ExplorerViewId
    });
    this.group = group;
  }
  /**
   * @override
   */
  runInView(accessor, view) {
    const { include, exclude } = view.getTreeIncludeExclude(this.group);
    return accessor.get(ITestService).runTests({ tests: include, exclude, group: this.group });
  }
}
class GetSelectedProfiles extends Action2 {
  constructor() {
    super({ id: TestCommandId.GetSelectedProfiles, title: localize2("getSelectedProfiles", "Get Selected Profiles") });
  }
  /**
   * @override
   */
  run(accessor) {
    const profiles = accessor.get(ITestProfileService);
    return [
      ...profiles.getGroupDefaultProfiles(TestRunProfileBitset.Run),
      ...profiles.getGroupDefaultProfiles(TestRunProfileBitset.Debug),
      ...profiles.getGroupDefaultProfiles(TestRunProfileBitset.Coverage)
    ].map((p) => ({
      controllerId: p.controllerId,
      label: p.label,
      kind: p.group & TestRunProfileBitset.Coverage ? ExtTestRunProfileKind.Coverage : p.group & TestRunProfileBitset.Debug ? ExtTestRunProfileKind.Debug : ExtTestRunProfileKind.Run
    }));
  }
}
class GetExplorerSelection extends ViewAction {
  constructor() {
    super({ id: TestCommandId.GetExplorerSelection, title: localize2("getExplorerSelection", "Get Explorer Selection"), viewId: Testing.ExplorerViewId });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    const { include, exclude } = view.getTreeIncludeExclude(TestRunProfileBitset.Run, void 0, "selected");
    const mapper = (i) => i.item.extId;
    return { include: include.map(mapper), exclude: exclude.map(mapper) };
  }
}
class RunSelectedAction extends ExecuteSelectedAction {
  constructor() {
    super({
      id: TestCommandId.RunSelectedAction,
      title: LABEL_RUN_TESTS,
      icon: icons.testingRunAllIcon
    }, TestRunProfileBitset.Run);
  }
}
class DebugSelectedAction extends ExecuteSelectedAction {
  constructor() {
    super({
      id: TestCommandId.DebugSelectedAction,
      title: LABEL_DEBUG_TESTS,
      icon: icons.testingDebugAllIcon
    }, TestRunProfileBitset.Debug);
  }
}
class CoverageSelectedAction extends ExecuteSelectedAction {
  constructor() {
    super({
      id: TestCommandId.CoverageSelectedAction,
      title: LABEL_COVERAGE_TESTS,
      icon: icons.testingCoverageAllIcon
    }, TestRunProfileBitset.Coverage);
  }
}
const showDiscoveringWhile = (progress, task) => {
  return progress.withProgress(
    {
      location: ProgressLocation.Window,
      title: localize("discoveringTests", "Discovering Tests")
    },
    () => task
  );
};
class RunOrDebugAllTestsAction extends Action2 {
  constructor(options, group, noTestsFoundError) {
    super({
      ...options,
      category,
      menu: [{
        id: MenuId.CommandPalette,
        when: TestingContextKeys.capabilityToContextKey[group].isEqualTo(true)
      }]
    });
    this.group = group;
    this.noTestsFoundError = noTestsFoundError;
  }
  async run(accessor) {
    const testService = accessor.get(ITestService);
    const notifications = accessor.get(INotificationService);
    const roots = [...testService.collection.rootItems].filter((r) => r.children.size || r.expand === TestItemExpandState.Expandable || r.expand === TestItemExpandState.BusyExpanding);
    if (!roots.length) {
      notifications.info(this.noTestsFoundError);
      return;
    }
    await testService.runTests({ tests: roots, group: this.group });
  }
}
class RunAllAction extends RunOrDebugAllTestsAction {
  constructor() {
    super(
      {
        id: TestCommandId.RunAllAction,
        title: localize2("runAllTests", "Run All Tests"),
        icon: icons.testingRunAllIcon,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyA)
        }
      },
      TestRunProfileBitset.Run,
      localize("noTestProvider", "No tests found in this workspace. You may need to install a test provider extension")
    );
  }
}
class DebugAllAction extends RunOrDebugAllTestsAction {
  constructor() {
    super(
      {
        id: TestCommandId.DebugAllAction,
        title: localize2("debugAllTests", "Debug All Tests"),
        icon: icons.testingDebugIcon,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyA)
        }
      },
      TestRunProfileBitset.Debug,
      localize("noDebugTestProvider", "No debuggable tests found in this workspace. You may need to install a test provider extension")
    );
  }
}
class CoverageAllAction extends RunOrDebugAllTestsAction {
  constructor() {
    super(
      {
        id: TestCommandId.RunAllWithCoverageAction,
        title: localize2("runAllWithCoverage", "Run All Tests with Coverage"),
        icon: icons.testingCoverageIcon,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA)
        }
      },
      TestRunProfileBitset.Coverage,
      localize("noCoverageTestProvider", "No tests with coverage runners found in this workspace. You may need to install a test provider extension")
    );
  }
}
class CancelTestRunAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CancelTestRunAction,
      title: localize2("testing.cancelRun", "Cancel Test Run"),
      icon: icons.testingCancelIcon,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyX)
      },
      menu: [{
        id: MenuId.ViewTitle,
        order: 11 /* Run */,
        group: "navigation",
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("view", Testing.ExplorerViewId),
          ContextKeyExpr.equals(TestingContextKeys.isRunning.serialize(), true)
        )
      }]
    });
  }
  /**
   * @override
   */
  async run(accessor, resultId, taskId) {
    const resultService = accessor.get(ITestResultService);
    const testService = accessor.get(ITestService);
    if (resultId) {
      testService.cancelTestRun(resultId, taskId);
    } else {
      for (const run of resultService.results) {
        if (!run.completedAt) {
          testService.cancelTestRun(run.id);
        }
      }
    }
  }
}
class TestingViewAsListAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingViewAsListAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.viewAsList", "View as List"),
      toggled: TestingContextKeys.viewMode.isEqualTo(TestExplorerViewMode.List),
      menu: {
        id: MenuId.ViewTitle,
        order: 18 /* DisplayMode */,
        group: "viewAs",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewMode = TestExplorerViewMode.List;
  }
}
class TestingViewAsTreeAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingViewAsTreeAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.viewAsTree", "View as Tree"),
      toggled: TestingContextKeys.viewMode.isEqualTo(TestExplorerViewMode.Tree),
      menu: {
        id: MenuId.ViewTitle,
        order: 18 /* DisplayMode */,
        group: "viewAs",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewMode = TestExplorerViewMode.Tree;
  }
}
class TestingSortByStatusAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingSortByStatusAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.sortByStatus", "Sort by Status"),
      toggled: TestingContextKeys.viewSorting.isEqualTo(TestExplorerViewSorting.ByStatus),
      menu: {
        id: MenuId.ViewTitle,
        order: 19 /* Sort */,
        group: "sortBy",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewSorting = TestExplorerViewSorting.ByStatus;
  }
}
class TestingSortByLocationAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingSortByLocationAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.sortByLocation", "Sort by Location"),
      toggled: TestingContextKeys.viewSorting.isEqualTo(TestExplorerViewSorting.ByLocation),
      menu: {
        id: MenuId.ViewTitle,
        order: 19 /* Sort */,
        group: "sortBy",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewSorting = TestExplorerViewSorting.ByLocation;
  }
}
class TestingSortByDurationAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingSortByDurationAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.sortByDuration", "Sort by Duration"),
      toggled: TestingContextKeys.viewSorting.isEqualTo(TestExplorerViewSorting.ByDuration),
      menu: {
        id: MenuId.ViewTitle,
        order: 19 /* Sort */,
        group: "sortBy",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewSorting = TestExplorerViewSorting.ByDuration;
  }
}
class ShowMostRecentOutputAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ShowMostRecentOutputAction,
      title: localize2("testing.showMostRecentOutput", "Show Output"),
      category,
      icon: Codicon.terminal,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyO)
      },
      precondition: TestingContextKeys.hasAnyResults.isEqualTo(true),
      menu: [{
        id: MenuId.ViewTitle,
        order: 16 /* Collapse */,
        group: "navigation",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }, {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }]
    });
  }
  async run(accessor) {
    const viewService = accessor.get(IViewsService);
    const testView = await viewService.openView(Testing.ResultsViewId, true);
    testView?.showLatestRun();
  }
}
class CollapseAllAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.CollapseAllAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.collapseAll", "Collapse All Tests"),
      icon: Codicon.collapseAll,
      menu: {
        id: MenuId.ViewTitle,
        order: 16 /* Collapse */,
        group: "displayAction",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.collapseAll();
  }
}
class ClearTestResultsAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ClearTestResultsAction,
      title: localize2("testing.clearResults", "Clear All Results"),
      category,
      icon: Codicon.clearAll,
      menu: [{
        id: MenuId.TestPeekTitle
      }, {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }, {
        id: MenuId.ViewTitle,
        order: 17 /* ClearResults */,
        group: "displayAction",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }, {
        id: MenuId.ViewTitle,
        order: 17 /* ClearResults */,
        group: "navigation",
        when: ContextKeyExpr.equals("view", Testing.ResultsViewId)
      }]
    });
  }
  /**
   * @override
   */
  run(accessor) {
    accessor.get(ITestResultService).clear();
  }
}
class GoToTest extends Action2 {
  constructor() {
    super({
      id: TestCommandId.GoToTest,
      title: localize2("testing.editFocusedTest", "Go to Test"),
      icon: Codicon.goToFile,
      menu: {
        id: MenuId.TestItem,
        group: "builtin@1",
        order: 20 /* GoToTest */,
        when: TestingContextKeys.testItemHasUri.isEqualTo(true)
      },
      keybinding: {
        weight: KeybindingWeight.EditorContrib - 10,
        when: FocusedViewContext.isEqualTo(Testing.ExplorerViewId),
        primary: KeyCode.Enter | KeyMod.Alt
      }
    });
  }
  async run(accessor, element, preserveFocus) {
    if (!element) {
      const view = accessor.get(IViewsService).getActiveViewWithId(Testing.ExplorerViewId);
      element = view?.focusedTreeElements[0];
    }
    if (element && element instanceof TestItemTreeElement) {
      accessor.get(ICommandService).executeCommand("vscode.revealTest", element.test.item.extId, preserveFocus);
    }
  }
}
async function getTestsAtCursor(testService, uriIdentityService, uri, position, filter) {
  let bestNodes = [];
  let bestRange;
  let bestNodesBefore = [];
  let bestRangeBefore;
  for await (const test of testsInFile(testService, uriIdentityService, uri)) {
    if (!test.item.range || filter?.(test) === false) {
      continue;
    }
    const irange = Range.lift(test.item.range);
    if (irange.containsPosition(position)) {
      if (bestRange && Range.equalsRange(test.item.range, bestRange)) {
        if (!bestNodes.some((b) => TestId.isChild(b.item.extId, test.item.extId))) {
          bestNodes.push(test);
        }
      } else {
        bestRange = irange;
        bestNodes = [test];
      }
    } else if (Position.isBefore(irange.getStartPosition(), position)) {
      if (!bestRangeBefore || bestRangeBefore.getStartPosition().isBefore(irange.getStartPosition())) {
        bestRangeBefore = irange;
        bestNodesBefore = [test];
      } else if (irange.equalsRange(bestRangeBefore) && !bestNodesBefore.some((b) => TestId.isChild(b.item.extId, test.item.extId))) {
        bestNodesBefore.push(test);
      }
    }
  }
  return bestNodes.length ? bestNodes : bestNodesBefore;
}
var EditorContextOrder = /* @__PURE__ */ ((EditorContextOrder2) => {
  EditorContextOrder2[EditorContextOrder2["RunAtCursor"] = 0] = "RunAtCursor";
  EditorContextOrder2[EditorContextOrder2["DebugAtCursor"] = 1] = "DebugAtCursor";
  EditorContextOrder2[EditorContextOrder2["RunInFile"] = 2] = "RunInFile";
  EditorContextOrder2[EditorContextOrder2["DebugInFile"] = 3] = "DebugInFile";
  EditorContextOrder2[EditorContextOrder2["GoToRelated"] = 4] = "GoToRelated";
  EditorContextOrder2[EditorContextOrder2["PeekRelated"] = 5] = "PeekRelated";
  return EditorContextOrder2;
})(EditorContextOrder || {});
class ExecuteTestAtCursor extends Action2 {
  constructor(options, group) {
    super({
      ...options,
      menu: [{
        id: MenuId.CommandPalette,
        when: hasAnyTestProvider
      }, {
        id: MenuId.EditorContext,
        group: "testing",
        order: group === TestRunProfileBitset.Run ? 0 /* RunAtCursor */ : 1 /* DebugAtCursor */,
        when: ContextKeyExpr.and(TestingContextKeys.activeEditorHasTests, TestingContextKeys.capabilityToContextKey[group])
      }]
    });
    this.group = group;
  }
  /**
   * @override
   */
  async run(accessor) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const editorService = accessor.get(IEditorService);
    const activeEditorPane = editorService.activeEditorPane;
    let editor = codeEditorService.getActiveCodeEditor();
    if (!activeEditorPane || !editor) {
      return;
    }
    if (editor instanceof EmbeddedCodeEditorWidget) {
      editor = editor.getParentEditor();
    }
    const position = editor?.getPosition();
    const model = editor?.getModel();
    if (!position || !model || !("uri" in model)) {
      return;
    }
    const testService = accessor.get(ITestService);
    const profileService = accessor.get(ITestProfileService);
    const uriIdentityService = accessor.get(IUriIdentityService);
    const progressService = accessor.get(IProgressService);
    const configurationService = accessor.get(IConfigurationService);
    const saveBeforeTest = getTestingConfiguration(configurationService, TestingConfigKeys.SaveBeforeTest);
    if (saveBeforeTest) {
      await editorService.save({ editor: activeEditorPane.input, groupId: activeEditorPane.group.id });
      await testService.syncTests();
    }
    const testsToRun = await showDiscoveringWhile(
      progressService,
      getTestsAtCursor(
        testService,
        uriIdentityService,
        model.uri,
        position,
        (test) => !!(profileService.capabilitiesForTest(test.item) & this.group)
      )
    );
    if (testsToRun.length) {
      await testService.runTests({ group: this.group, tests: testsToRun });
      return;
    }
    const relatedTests = await testService.getTestsRelatedToCode(model.uri, position);
    if (relatedTests.length) {
      await testService.runTests({ group: this.group, tests: relatedTests });
      return;
    }
    if (editor) {
      MessageController.get(editor)?.showMessage(localize("noTestsAtCursor", "No tests found here"), position);
    }
  }
}
class RunAtCursor extends ExecuteTestAtCursor {
  constructor() {
    super({
      id: TestCommandId.RunAtCursor,
      title: localize2("testing.runAtCursor", "Run Test at Cursor"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyC)
      }
    }, TestRunProfileBitset.Run);
  }
}
class DebugAtCursor extends ExecuteTestAtCursor {
  constructor() {
    super({
      id: TestCommandId.DebugAtCursor,
      title: localize2("testing.debugAtCursor", "Debug Test at Cursor"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyC)
      }
    }, TestRunProfileBitset.Debug);
  }
}
class CoverageAtCursor extends ExecuteTestAtCursor {
  constructor() {
    super({
      id: TestCommandId.CoverageAtCursor,
      title: localize2("testing.coverageAtCursor", "Run Test at Cursor with Coverage"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC)
      }
    }, TestRunProfileBitset.Coverage);
  }
}
class ExecuteTestsUnderUriAction extends Action2 {
  constructor(options, group) {
    super({
      ...options,
      menu: [{
        id: MenuId.ExplorerContext,
        when: TestingContextKeys.capabilityToContextKey[group].isEqualTo(true),
        group: "6.5_testing",
        order: (group === TestRunProfileBitset.Run ? 11 /* Run */ : 12 /* Debug */) + 0.1
      }]
    });
    this.group = group;
  }
  async run(accessor, uri) {
    const testService = accessor.get(ITestService);
    const notificationService = accessor.get(INotificationService);
    const tests = await Iterable.asyncToArray(testsUnderUri(
      testService,
      accessor.get(IUriIdentityService),
      uri
    ));
    if (!tests.length) {
      notificationService.notify({ message: localize("noTests", "No tests found in the selected file or folder"), severity: Severity.Info });
      return;
    }
    return testService.runTests({ tests, group: this.group });
  }
}
class RunTestsUnderUri extends ExecuteTestsUnderUriAction {
  constructor() {
    super({
      id: TestCommandId.RunByUri,
      title: LABEL_RUN_TESTS,
      category
    }, TestRunProfileBitset.Run);
  }
}
class DebugTestsUnderUri extends ExecuteTestsUnderUriAction {
  constructor() {
    super({
      id: TestCommandId.DebugByUri,
      title: LABEL_DEBUG_TESTS,
      category
    }, TestRunProfileBitset.Debug);
  }
}
class CoverageTestsUnderUri extends ExecuteTestsUnderUriAction {
  constructor() {
    super({
      id: TestCommandId.CoverageByUri,
      title: LABEL_COVERAGE_TESTS,
      category
    }, TestRunProfileBitset.Coverage);
  }
}
class ExecuteTestsInCurrentFile extends Action2 {
  constructor(options, group) {
    super({
      ...options,
      menu: [{
        id: MenuId.CommandPalette,
        when: TestingContextKeys.capabilityToContextKey[group].isEqualTo(true)
      }, {
        id: MenuId.EditorContext,
        group: "testing",
        order: group === TestRunProfileBitset.Run ? 2 /* RunInFile */ : 3 /* DebugInFile */,
        when: ContextKeyExpr.and(TestingContextKeys.activeEditorHasTests, TestingContextKeys.capabilityToContextKey[group])
      }]
    });
    this.group = group;
  }
  /**
   * @override
   */
  run(accessor) {
    let editor = accessor.get(ICodeEditorService).getActiveCodeEditor();
    if (!editor) {
      return;
    }
    if (editor instanceof EmbeddedCodeEditorWidget) {
      editor = editor.getParentEditor();
    }
    const position = editor?.getPosition();
    const model = editor?.getModel();
    if (!position || !model || !("uri" in model)) {
      return;
    }
    const testService = accessor.get(ITestService);
    const demandedUri = model.uri.toString();
    const queue = [testService.collection.rootIds];
    const discovered = [];
    while (queue.length) {
      for (const id of queue.pop()) {
        const node = testService.collection.getNodeById(id);
        if (node.item.uri?.toString() === demandedUri) {
          discovered.push(node);
        } else {
          queue.push(node.children);
        }
      }
    }
    if (discovered.length) {
      return testService.runTests({
        tests: discovered,
        group: this.group
      });
    }
    if (editor) {
      MessageController.get(editor)?.showMessage(localize("noTestsInFile", "No tests found in this file"), position);
    }
    return void 0;
  }
}
class RunCurrentFile extends ExecuteTestsInCurrentFile {
  constructor() {
    super({
      id: TestCommandId.RunCurrentFile,
      title: localize2("testing.runCurrentFile", "Run Tests in Current File"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyF)
      }
    }, TestRunProfileBitset.Run);
  }
}
class DebugCurrentFile extends ExecuteTestsInCurrentFile {
  constructor() {
    super({
      id: TestCommandId.DebugCurrentFile,
      title: localize2("testing.debugCurrentFile", "Debug Tests in Current File"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyF)
      }
    }, TestRunProfileBitset.Debug);
  }
}
class CoverageCurrentFile extends ExecuteTestsInCurrentFile {
  constructor() {
    super({
      id: TestCommandId.CoverageCurrentFile,
      title: localize2("testing.coverageCurrentFile", "Run Tests with Coverage in Current File"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF)
      }
    }, TestRunProfileBitset.Coverage);
  }
}
const discoverAndRunTests = async (collection, progress, ids, runTests) => {
  const todo = Promise.all(ids.map((p) => expandAndGetTestById(collection, p)));
  const tests = (await showDiscoveringWhile(progress, todo)).filter(isDefined);
  return tests.length ? await runTests(tests) : void 0;
};
class RunOrDebugExtsByPath extends Action2 {
  /**
   * @override
   */
  async run(accessor, ...args) {
    const testService = accessor.get(ITestService);
    await discoverAndRunTests(
      accessor.get(ITestService).collection,
      accessor.get(IProgressService),
      [...this.getTestExtIdsToRun(accessor, ...args)],
      (tests) => this.runTest(testService, tests)
    );
  }
}
class RunOrDebugFailedTests extends RunOrDebugExtsByPath {
  constructor(options) {
    super({
      ...options,
      menu: {
        id: MenuId.CommandPalette,
        when: hasAnyTestProvider
      }
    });
  }
  /**
   * @inheritdoc
   */
  getTestExtIdsToRun(accessor) {
    const { results } = accessor.get(ITestResultService);
    const ids = /* @__PURE__ */ new Set();
    for (let i = results.length - 1; i >= 0; i--) {
      const resultSet = results[i];
      for (const test of resultSet.tests) {
        if (isFailedState(test.ownComputedState)) {
          ids.add(test.item.extId);
        } else {
          ids.delete(test.item.extId);
        }
      }
    }
    return ids;
  }
}
class RunOrDebugLastRun extends Action2 {
  constructor(options) {
    super({
      ...options,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(
          hasAnyTestProvider,
          TestingContextKeys.hasAnyResults.isEqualTo(true)
        )
      }
    });
  }
  getLastTestRunRequest(accessor, runId) {
    const resultService = accessor.get(ITestResultService);
    const lastResult = runId ? resultService.results.find((r) => r.id === runId) : resultService.results[0];
    return lastResult?.request;
  }
  /** @inheritdoc */
  async run(accessor, runId) {
    const resultService = accessor.get(ITestResultService);
    const lastResult = runId ? resultService.results.find((r) => r.id === runId) : resultService.results[0];
    if (!lastResult) {
      return;
    }
    const req = lastResult.request;
    const testService = accessor.get(ITestService);
    const profileService = accessor.get(ITestProfileService);
    const profileExists = (t) => profileService.getControllerProfiles(t.controllerId).some((p) => p.profileId === t.profileId);
    await discoverAndRunTests(
      testService.collection,
      accessor.get(IProgressService),
      req.targets.flatMap((t) => t.testIds),
      (tests) => {
        if (this.getGroup() & req.group && req.targets.every(profileExists)) {
          return testService.runResolvedTests({
            targets: req.targets,
            group: req.group,
            exclude: req.exclude
          });
        } else {
          return testService.runTests({ tests, group: this.getGroup() });
        }
      }
    );
  }
}
class ReRunFailedTests extends RunOrDebugFailedTests {
  constructor() {
    super({
      id: TestCommandId.ReRunFailedTests,
      title: localize2("testing.reRunFailTests", "Rerun Failed Tests"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyE)
      }
    });
  }
  runTest(service, internalTests) {
    return service.runTests({
      group: TestRunProfileBitset.Run,
      tests: internalTests
    });
  }
}
class DebugFailedTests extends RunOrDebugFailedTests {
  constructor() {
    super({
      id: TestCommandId.DebugFailedTests,
      title: localize2("testing.debugFailTests", "Debug Failed Tests"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyE)
      }
    });
  }
  runTest(service, internalTests) {
    return service.runTests({
      group: TestRunProfileBitset.Debug,
      tests: internalTests
    });
  }
}
class ReRunLastRun extends RunOrDebugLastRun {
  constructor() {
    super({
      id: TestCommandId.ReRunLastRun,
      title: localize2("testing.reRunLastRun", "Rerun Last Run"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyL)
      }
    });
  }
  getGroup() {
    return TestRunProfileBitset.Run;
  }
}
class DebugLastRun extends RunOrDebugLastRun {
  constructor() {
    super({
      id: TestCommandId.DebugLastRun,
      title: localize2("testing.debugLastRun", "Debug Last Run"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyL)
      }
    });
  }
  getGroup() {
    return TestRunProfileBitset.Debug;
  }
}
class CoverageLastRun extends RunOrDebugLastRun {
  constructor() {
    super({
      id: TestCommandId.CoverageLastRun,
      title: localize2("testing.coverageLastRun", "Rerun Last Run with Coverage"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL)
      }
    });
  }
  getGroup() {
    return TestRunProfileBitset.Coverage;
  }
}
class SearchForTestExtension extends Action2 {
  constructor() {
    super({
      id: TestCommandId.SearchForTestExtension,
      title: localize2("testing.searchForTestExtension", "Search for Test Extension")
    });
  }
  async run(accessor) {
    accessor.get(IExtensionsWorkbenchService).openSearch('@category:"testing"');
  }
}
class OpenOutputPeek extends Action2 {
  constructor() {
    super({
      id: TestCommandId.OpenOutputPeek,
      title: localize2("testing.openOutputPeek", "Peek Output"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyM)
      },
      menu: {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }
    });
  }
  async run(accessor) {
    accessor.get(ITestingPeekOpener).open();
  }
}
class ToggleInlineTestOutput extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ToggleInlineTestOutput,
      title: localize2("testing.toggleInlineTestOutput", "Toggle Inline Test Output"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyI)
      },
      menu: {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }
    });
  }
  async run(accessor) {
    const testService = accessor.get(ITestService);
    testService.showInlineOutput.value = !testService.showInlineOutput.value;
  }
}
const refreshMenus = (whenIsRefreshing) => [
  {
    id: MenuId.TestItem,
    group: "inline",
    order: 10 /* Refresh */,
    when: ContextKeyExpr.and(
      TestingContextKeys.canRefreshTests.isEqualTo(true),
      TestingContextKeys.isRefreshingTests.isEqualTo(whenIsRefreshing)
    )
  },
  {
    id: MenuId.ViewTitle,
    group: "navigation",
    order: 10 /* Refresh */,
    when: ContextKeyExpr.and(
      ContextKeyExpr.equals("view", Testing.ExplorerViewId),
      TestingContextKeys.canRefreshTests.isEqualTo(true),
      TestingContextKeys.isRefreshingTests.isEqualTo(whenIsRefreshing)
    )
  },
  {
    id: MenuId.CommandPalette,
    when: TestingContextKeys.canRefreshTests.isEqualTo(true)
  }
];
class RefreshTestsAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.RefreshTestsAction,
      title: localize2("testing.refreshTests", "Refresh Tests"),
      category,
      icon: icons.testingRefreshTests,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyR),
        when: TestingContextKeys.canRefreshTests.isEqualTo(true)
      },
      menu: refreshMenus(false)
    });
  }
  async run(accessor, ...elements) {
    const testService = accessor.get(ITestService);
    const progressService = accessor.get(IProgressService);
    const controllerIds = distinct(elements.filter(isDefined).map((e) => e.test.controllerId));
    return progressService.withProgress({ location: Testing.ViewletId }, async () => {
      if (controllerIds.length) {
        await Promise.all(controllerIds.map((id) => testService.refreshTests(id)));
      } else {
        await testService.refreshTests();
      }
    });
  }
}
class CancelTestRefreshAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CancelTestRefreshAction,
      title: localize2("testing.cancelTestRefresh", "Cancel Test Refresh"),
      category,
      icon: icons.testingCancelRefreshTests,
      menu: refreshMenus(true)
    });
  }
  async run(accessor) {
    accessor.get(ITestService).cancelRefreshTests();
  }
}
class CleareCoverage extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CoverageClear,
      title: localize2("testing.clearCoverage", "Clear Coverage"),
      icon: widgetClose,
      category,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 10 /* Refresh */,
        when: ContextKeyExpr.equals("view", Testing.CoverageViewId)
      }, {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.isTestCoverageOpen.isEqualTo(true)
      }]
    });
  }
  run(accessor) {
    accessor.get(ITestCoverageService).closeCoverage();
  }
}
class OpenCoverage extends Action2 {
  constructor() {
    super({
      id: TestCommandId.OpenCoverage,
      title: localize2("testing.openCoverage", "Open Coverage"),
      category,
      menu: [{
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }]
    });
  }
  run(accessor) {
    const results = accessor.get(ITestResultService).results;
    const task = results.length && results[0].tasks.find((r) => r.coverage);
    if (!task) {
      const notificationService = accessor.get(INotificationService);
      notificationService.info(localize("testing.noCoverage", "No coverage information available on the last test run."));
      return;
    }
    accessor.get(ITestCoverageService).openCoverage(task, true);
  }
}
class TestNavigationAction extends SymbolNavigationAction {
  runEditorCommand(accessor, editor, ...args) {
    this.testService = accessor.get(ITestService);
    this.uriIdentityService = accessor.get(IUriIdentityService);
    return super.runEditorCommand(accessor, editor, ...args);
  }
  _getAlternativeCommand(editor) {
    return editor.getOption(EditorOption.gotoLocation).alternativeTestsCommand;
  }
  _getGoToPreference(editor) {
    return editor.getOption(EditorOption.gotoLocation).multipleTests || "peek";
  }
}
class GoToRelatedTestAction extends TestNavigationAction {
  async _getLocationModel(_languageFeaturesService, model, position, token) {
    const tests = await this.testService.getTestsRelatedToCode(model.uri, position, token);
    return new ReferencesModel(
      tests.map((t) => t.item.uri && { uri: t.item.uri, range: t.item.range || new Range(1, 1, 1, 1) }).filter(isDefined),
      localize("relatedTests", "Related Tests")
    );
  }
  _getNoResultFoundMessage() {
    return localize("noTestFound", "No related tests found.");
  }
}
class GoToRelatedTest extends GoToRelatedTestAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: TestCommandId.GoToRelatedTest,
      title: localize2("testing.goToRelatedTest", "Go to Related Test"),
      category,
      precondition: ContextKeyExpr.and(
        // todo@connor4312: make this more explicit based on cursor position
        ContextKeyExpr.not(TestingContextKeys.activeEditorHasTests.key),
        TestingContextKeys.canGoToRelatedTest
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "testing",
        order: 4 /* GoToRelated */
      }]
    });
  }
}
class PeekRelatedTest extends GoToRelatedTestAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: TestCommandId.PeekRelatedTest,
      title: localize2("testing.peekToRelatedTest", "Peek Related Test"),
      category,
      precondition: ContextKeyExpr.and(
        TestingContextKeys.canGoToRelatedTest,
        // todo@connor4312: make this more explicit based on cursor position
        ContextKeyExpr.not(TestingContextKeys.activeEditorHasTests.key),
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "testing",
        order: 5 /* PeekRelated */
      }]
    });
  }
}
class GoToRelatedCodeAction extends TestNavigationAction {
  async _getLocationModel(_languageFeaturesService, model, position, token) {
    const testsAtCursor = await getTestsAtCursor(this.testService, this.uriIdentityService, model.uri, position);
    const code = await Promise.all(testsAtCursor.map((t) => this.testService.getCodeRelatedToTest(t)));
    return new ReferencesModel(code.flat(), localize("relatedCode", "Related Code"));
  }
  _getNoResultFoundMessage() {
    return localize("noRelatedCode", "No related code found.");
  }
}
class GoToRelatedCode extends GoToRelatedCodeAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: TestCommandId.GoToRelatedCode,
      title: localize2("testing.goToRelatedCode", "Go to Related Code"),
      category,
      precondition: ContextKeyExpr.and(
        TestingContextKeys.activeEditorHasTests,
        TestingContextKeys.canGoToRelatedCode
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "testing",
        order: 4 /* GoToRelated */
      }]
    });
  }
}
class PeekRelatedCode extends GoToRelatedCodeAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: TestCommandId.PeekRelatedCode,
      title: localize2("testing.peekToRelatedCode", "Peek Related Code"),
      category,
      precondition: ContextKeyExpr.and(
        TestingContextKeys.activeEditorHasTests,
        TestingContextKeys.canGoToRelatedCode,
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "testing",
        order: 5 /* PeekRelated */
      }]
    });
  }
}
const allTestActions = [
  CancelTestRefreshAction,
  CancelTestRunAction,
  CleareCoverage,
  ClearTestResultsAction,
  CollapseAllAction,
  ConfigureTestProfilesAction,
  ContinuousRunTestAction,
  ContinuousRunUsingProfileTestAction,
  CoverageAction,
  CoverageAllAction,
  CoverageAtCursor,
  CoverageCurrentFile,
  CoverageLastRun,
  CoverageSelectedAction,
  CoverageTestsUnderUri,
  DebugAction,
  DebugAllAction,
  DebugAtCursor,
  DebugCurrentFile,
  DebugFailedTests,
  DebugLastRun,
  DebugSelectedAction,
  DebugTestsUnderUri,
  GetExplorerSelection,
  GetSelectedProfiles,
  GoToRelatedCode,
  GoToRelatedTest,
  GoToTest,
  HideTestAction,
  OpenCoverage,
  OpenOutputPeek,
  PeekRelatedCode,
  PeekRelatedTest,
  RefreshTestsAction,
  ReRunFailedTests,
  ReRunLastRun,
  RunAction,
  RunAllAction,
  RunAtCursor,
  RunCurrentFile,
  RunSelectedAction,
  RunTestsUnderUri,
  RunUsingProfileAction,
  SearchForTestExtension,
  SelectDefaultTestProfiles,
  ShowMostRecentOutputAction,
  StartContinuousRunAction,
  StopContinuousRunAction,
  TestingSortByDurationAction,
  TestingSortByLocationAction,
  TestingSortByStatusAction,
  TestingViewAsListAction,
  TestingViewAsTreeAction,
  ToggleInlineTestOutput,
  UnhideAllTestsAction,
  UnhideTestAction
];
export {
  CancelTestRefreshAction,
  CancelTestRunAction,
  ClearTestResultsAction,
  CleareCoverage,
  CollapseAllAction,
  ConfigureTestProfilesAction,
  ContinuousRunTestAction,
  ContinuousRunUsingProfileTestAction,
  CoverageAction,
  CoverageAllAction,
  CoverageAtCursor,
  CoverageCurrentFile,
  CoverageLastRun,
  CoverageSelectedAction,
  DebugAction,
  DebugAllAction,
  DebugAtCursor,
  DebugCurrentFile,
  DebugFailedTests,
  DebugLastRun,
  DebugSelectedAction,
  GetExplorerSelection,
  GetSelectedProfiles,
  GoToTest,
  HideTestAction,
  OpenCoverage,
  OpenOutputPeek,
  ReRunFailedTests,
  ReRunLastRun,
  RefreshTestsAction,
  RunAction,
  RunAllAction,
  RunAtCursor,
  RunCurrentFile,
  RunSelectedAction,
  RunUsingProfileAction,
  SearchForTestExtension,
  SelectDefaultTestProfiles,
  ShowMostRecentOutputAction,
  TestingSortByDurationAction,
  TestingSortByLocationAction,
  TestingSortByStatusAction,
  TestingViewAsListAction,
  TestingViewAsTreeAction,
  ToggleInlineTestOutput,
  UnhideAllTestsAction,
  UnhideTestAction,
  allTestActions,
  discoverAndRunTests
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdEV4cGxvcmVyQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElBY3RpdmVDb2RlRWRpdG9yLCBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiwgR29Ub0xvY2F0aW9uVmFsdWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgU3ltYm9sTmF2aWdhdGlvbkFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2dvdG9TeW1ib2wvYnJvd3Nlci9nb1RvQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgUmVmZXJlbmNlc01vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZ290b1N5bWJvbC9icm93c2VyL3JlZmVyZW5jZXNNb2RlbC5qcyc7XG5pbXBvcnQgeyBNZXNzYWdlQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL21lc3NhZ2UvYnJvd3Nlci9tZXNzYWdlQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBQZWVrQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3BlZWtWaWV3L2Jyb3dzZXIvcGVla1ZpZXcuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIElBY3Rpb24yT3B0aW9ucywgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgQ29udGV4dEtleUV4cHJlc3Npb24sIENvbnRleHRLZXlHcmVhdGVyRXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyB3aWRnZXRDbG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBWaWV3QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBGb2N1c2VkVmlld0NvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBUZXN0RXhwbG9yZXJUcmVlRWxlbWVudCwgVGVzdEl0ZW1UcmVlRWxlbWVudCB9IGZyb20gJy4vZXhwbG9yZXJQcm9qZWN0aW9ucy9pbmRleC5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuL2ljb25zLmpzJztcbmltcG9ydCB7IFRlc3RpbmdFeHBsb3JlclZpZXcgfSBmcm9tICcuL3Rlc3RpbmdFeHBsb3JlclZpZXcuanMnO1xuaW1wb3J0IHsgVGVzdFJlc3VsdHNWaWV3IH0gZnJvbSAnLi90ZXN0aW5nT3V0cHV0UGVlay5qcyc7XG5pbXBvcnQgeyBUZXN0aW5nQ29uZmlnS2V5cywgZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29tbWFuZElkLCBUZXN0RXhwbG9yZXJWaWV3TW9kZSwgVGVzdEV4cGxvcmVyVmlld1NvcnRpbmcsIFRlc3RpbmcsIHRlc3RDb25maWd1cmF0aW9uR3JvdXBOYW1lcyB9IGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSVRlc3RDb3ZlcmFnZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdENvdmVyYWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0SWQgfSBmcm9tICcuLi9jb21tb24vdGVzdElkLmpzJztcbmltcG9ydCB7IElUZXN0UHJvZmlsZVNlcnZpY2UsIGNhblVzZVByb2ZpbGVXaXRoVGVzdCB9IGZyb20gJy4uL2NvbW1vbi90ZXN0UHJvZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RSZXN1bHQgfSBmcm9tICcuLi9jb21tb24vdGVzdFJlc3VsdC5qcyc7XG5pbXBvcnQgeyBJVGVzdFJlc3VsdFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdFJlc3VsdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1haW5UaHJlYWRUZXN0Q29sbGVjdGlvbiwgSU1haW5UaHJlYWRUZXN0Q29udHJvbGxlciwgSVRlc3RTZXJ2aWNlLCBleHBhbmRBbmRHZXRUZXN0QnlJZCwgdGVzdHNJbkZpbGUsIHRlc3RzVW5kZXJVcmkgfSBmcm9tICcuLi9jb21tb24vdGVzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0VGVzdFJ1blByb2ZpbGVLaW5kLCBJVGVzdFJ1blByb2ZpbGUsIEludGVybmFsVGVzdEl0ZW0sIFRlc3RJdGVtRXhwYW5kU3RhdGUsIFRlc3RSdW5Qcm9maWxlQml0c2V0IH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBUZXN0aW5nQ29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vdGVzdGluZ0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdGluZ0NvbnRpbnVvdXNSdW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXN0aW5nUGVla09wZW5lciB9IGZyb20gJy4uL2NvbW1vbi90ZXN0aW5nUGVla09wZW5lci5qcyc7XG5pbXBvcnQgeyBpc0ZhaWxlZFN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RpbmdTdGF0ZXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuXG5jb25zdCBjYXRlZ29yeSA9IENhdGVnb3JpZXMuVGVzdDtcblxuY29uc3QgZW51bSBBY3Rpb25PcmRlciB7XG5cdC8vIE5hdmlnYXRpb246XG5cdFJlZnJlc2ggPSAxMCxcblx0UnVuLFxuXHREZWJ1Zyxcblx0Q292ZXJhZ2UsXG5cdFJ1bkNvbnRpbnVvdXMsXG5cdFJ1blVzaW5nLFxuXG5cdC8vIFN1Ym1lbnU6XG5cdENvbGxhcHNlLFxuXHRDbGVhclJlc3VsdHMsXG5cdERpc3BsYXlNb2RlLFxuXHRTb3J0LFxuXHRHb1RvVGVzdCxcblx0SGlkZVRlc3QsXG5cdENvbnRpbnVvdXNSdW5UZXN0ID0gLTEgPj4+IDEsIC8vIG1heCBpbnQsIGFsd2F5cyBhdCB0aGUgZW5kIHRvIGF2b2lkIHNoaWZ0aW5nIG9uIGhvdmVyXG59XG5cbmNvbnN0IGhhc0FueVRlc3RQcm92aWRlciA9IENvbnRleHRLZXlHcmVhdGVyRXhwci5jcmVhdGUoVGVzdGluZ0NvbnRleHRLZXlzLnByb3ZpZGVyQ291bnQua2V5LCAwKTtcblxuY29uc3QgTEFCRUxfUlVOX1RFU1RTID0gbG9jYWxpemUyKCdydW5TZWxlY3RlZFRlc3RzJywgXCJSdW4gVGVzdHNcIik7XG5jb25zdCBMQUJFTF9ERUJVR19URVNUUyA9IGxvY2FsaXplMignZGVidWdTZWxlY3RlZFRlc3RzJywgXCJEZWJ1ZyBUZXN0c1wiKTtcbmNvbnN0IExBQkVMX0NPVkVSQUdFX1RFU1RTID0gbG9jYWxpemUyKCdjb3ZlcmFnZVNlbGVjdGVkVGVzdHMnLCBcIlJ1biBUZXN0cyB3aXRoIENvdmVyYWdlXCIpO1xuXG5leHBvcnQgY2xhc3MgSGlkZVRlc3RBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuSGlkZVRlc3RBY3Rpb24sXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdoaWRlVGVzdCcsICdIaWRlIFRlc3QnKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXN0SXRlbSxcblx0XHRcdFx0Z3JvdXA6ICdidWlsdGluQDInLFxuXHRcdFx0XHR3aGVuOiBUZXN0aW5nQ29udGV4dEtleXMudGVzdEl0ZW1Jc0hpZGRlbi5pc0VxdWFsVG8oZmFsc2UpXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uZWxlbWVudHM6IFRlc3RJdGVtVHJlZUVsZW1lbnRbXSkge1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlc3RTZXJ2aWNlKTtcblx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRcdHNlcnZpY2UuZXhjbHVkZWQudG9nZ2xlKGVsZW1lbnQudGVzdCwgdHJ1ZSk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVW5oaWRlVGVzdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5VbmhpZGVUZXN0QWN0aW9uLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndW5oaWRlVGVzdCcsICdVbmhpZGUgVGVzdCcpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlRlc3RJdGVtLFxuXHRcdFx0XHRvcmRlcjogQWN0aW9uT3JkZXIuSGlkZVRlc3QsXG5cdFx0XHRcdHdoZW46IFRlc3RpbmdDb250ZXh0S2V5cy50ZXN0SXRlbUlzSGlkZGVuLmlzRXF1YWxUbyh0cnVlKVxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmVsZW1lbnRzOiBJbnRlcm5hbFRlc3RJdGVtW10pIHtcblx0XHRjb25zdCBzZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXN0U2VydmljZSk7XG5cdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRlc3RJdGVtVHJlZUVsZW1lbnQpIHtcblx0XHRcdFx0c2VydmljZS5leGNsdWRlZC50b2dnbGUoZWxlbWVudC50ZXN0LCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVW5oaWRlQWxsVGVzdHNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuVW5oaWRlQWxsVGVzdHNBY3Rpb24sXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd1bmhpZGVBbGxUZXN0cycsICdVbmhpZGUgQWxsIFRlc3RzJyksXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3Qgc2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFNlcnZpY2UpO1xuXHRcdHNlcnZpY2UuZXhjbHVkZWQuY2xlYXIoKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cbn1cblxuY29uc3QgdGVzdEl0ZW1JbmxpbmVBbmRJbkNvbnRleHQgPSAob3JkZXI6IEFjdGlvbk9yZGVyLCB3aGVuPzogQ29udGV4dEtleUV4cHJlc3Npb24pID0+IFtcblx0e1xuXHRcdGlkOiBNZW51SWQuVGVzdEl0ZW0sXG5cdFx0Z3JvdXA6ICdpbmxpbmUnLFxuXHRcdG9yZGVyLFxuXHRcdHdoZW4sXG5cdH0sIHtcblx0XHRpZDogTWVudUlkLlRlc3RJdGVtLFxuXHRcdGdyb3VwOiAnYnVpbHRpbkAxJyxcblx0XHRvcmRlcixcblx0XHR3aGVuLFxuXHR9XG5dO1xuXG5hYnN0cmFjdCBjbGFzcyBSdW5WaXNpYmxlQWN0aW9uIGV4dGVuZHMgVmlld0FjdGlvbjxUZXN0aW5nRXhwbG9yZXJWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgYml0c2V0OiBUZXN0UnVuUHJvZmlsZUJpdHNldCwgZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPikge1xuXHRcdHN1cGVyKHtcblx0XHRcdC4uLmRlc2MsXG5cdFx0XHR2aWV3SWQ6IFRlc3RpbmcuRXhwbG9yZXJWaWV3SWQsXG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwdWJsaWMgcnVuSW5WaWV3KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBUZXN0aW5nRXhwbG9yZXJWaWV3LCAuLi5lbGVtZW50czogVGVzdEl0ZW1UcmVlRWxlbWVudFtdKTogUHJvbWlzZTx1bmtub3duPiB7XG5cdFx0Y29uc3QgeyBpbmNsdWRlLCBleGNsdWRlIH0gPSB2aWV3LmdldFRyZWVJbmNsdWRlRXhjbHVkZSh0aGlzLmJpdHNldCwgZWxlbWVudHMubWFwKGUgPT4gZS50ZXN0KSk7XG5cdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJVGVzdFNlcnZpY2UpLnJ1blRlc3RzKHtcblx0XHRcdHRlc3RzOiBpbmNsdWRlLFxuXHRcdFx0ZXhjbHVkZSxcblx0XHRcdGdyb3VwOiB0aGlzLmJpdHNldCxcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGVidWdBY3Rpb24gZXh0ZW5kcyBSdW5WaXNpYmxlQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoVGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcsIHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkRlYnVnQWN0aW9uLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZGVidWcgdGVzdCcsICdEZWJ1ZyBUZXN0JyksXG5cdFx0XHRpY29uOiBpY29ucy50ZXN0aW5nRGVidWdJY29uLFxuXHRcdFx0bWVudTogdGVzdEl0ZW1JbmxpbmVBbmRJbkNvbnRleHQoQWN0aW9uT3JkZXIuRGVidWcsIFRlc3RpbmdDb250ZXh0S2V5cy5oYXNEZWJ1Z2dhYmxlVGVzdHMuaXNFcXVhbFRvKHRydWUpKSxcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ292ZXJhZ2VBY3Rpb24gZXh0ZW5kcyBSdW5WaXNpYmxlQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoVGVzdFJ1blByb2ZpbGVCaXRzZXQuQ292ZXJhZ2UsIHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlJ1bldpdGhDb3ZlcmFnZUFjdGlvbixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3J1biB3aXRoIGNvdmVyIHRlc3QnLCAnUnVuIFRlc3Qgd2l0aCBDb3ZlcmFnZScpLFxuXHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ0NvdmVyYWdlSWNvbixcblx0XHRcdG1lbnU6IHRlc3RJdGVtSW5saW5lQW5kSW5Db250ZXh0KEFjdGlvbk9yZGVyLkNvdmVyYWdlLCBUZXN0aW5nQ29udGV4dEtleXMuaGFzQ292ZXJhYmxlVGVzdHMuaXNFcXVhbFRvKHRydWUpKSxcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUnVuVXNpbmdQcm9maWxlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlJ1blVzaW5nUHJvZmlsZUFjdGlvbixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcucnVuVXNpbmcnLCAnRXhlY3V0ZSBVc2luZyBQcm9maWxlLi4uJyksXG5cdFx0XHRpY29uOiBpY29ucy50ZXN0aW5nRGVidWdJY29uLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlRlc3RJdGVtLFxuXHRcdFx0XHRvcmRlcjogQWN0aW9uT3JkZXIuUnVuVXNpbmcsXG5cdFx0XHRcdGdyb3VwOiAnYnVpbHRpbkAyJyxcblx0XHRcdFx0d2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmhhc05vbkRlZmF1bHRQcm9maWxlLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgYXN5bmMgcnVuKGFjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmVsZW1lbnRzOiBUZXN0SXRlbVRyZWVFbGVtZW50W10pOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IGFjZXNzb3IuZ2V0KElUZXN0U2VydmljZSk7XG5cdFx0Y29uc3QgcHJvZmlsZTogSVRlc3RSdW5Qcm9maWxlIHwgdW5kZWZpbmVkID0gYXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5waWNrVGVzdFByb2ZpbGUnLCB7XG5cdFx0XHRvbmx5Rm9yVGVzdDogZWxlbWVudHNbMF0udGVzdCxcblx0XHR9KTtcblx0XHRpZiAoIXByb2ZpbGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0ZXN0U2VydmljZS5ydW5SZXNvbHZlZFRlc3RzKHtcblx0XHRcdGdyb3VwOiBwcm9maWxlLmdyb3VwLFxuXHRcdFx0dGFyZ2V0czogW3tcblx0XHRcdFx0cHJvZmlsZUlkOiBwcm9maWxlLnByb2ZpbGVJZCxcblx0XHRcdFx0Y29udHJvbGxlcklkOiBwcm9maWxlLmNvbnRyb2xsZXJJZCxcblx0XHRcdFx0dGVzdElkczogZWxlbWVudHMuZmlsdGVyKHQgPT4gY2FuVXNlUHJvZmlsZVdpdGhUZXN0KHByb2ZpbGUsIHQudGVzdCkpLm1hcCh0ID0+IHQudGVzdC5pdGVtLmV4dElkKVxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUnVuQWN0aW9uIGV4dGVuZHMgUnVuVmlzaWJsZUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1biwge1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuUnVuQWN0aW9uLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncnVuIHRlc3QnLCAnUnVuIFRlc3QnKSxcblx0XHRcdGljb246IGljb25zLnRlc3RpbmdSdW5JY29uLFxuXHRcdFx0bWVudTogdGVzdEl0ZW1JbmxpbmVBbmRJbkNvbnRleHQoQWN0aW9uT3JkZXIuUnVuLCBUZXN0aW5nQ29udGV4dEtleXMuaGFzUnVubmFibGVUZXN0cy5pc0VxdWFsVG8odHJ1ZSkpLFxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZWxlY3REZWZhdWx0VGVzdFByb2ZpbGVzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlNlbGVjdERlZmF1bHRUZXN0UHJvZmlsZXMsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLnNlbGVjdERlZmF1bHRUZXN0UHJvZmlsZXMnLCAnU2VsZWN0IERlZmF1bHQgUHJvZmlsZScpLFxuXHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ1VwZGF0ZVByb2ZpbGVzLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgYXN5bmMgcnVuKGFjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG9ubHlHcm91cDogVGVzdFJ1blByb2ZpbGVCaXRzZXQpIHtcblx0XHRjb25zdCBjb21tYW5kcyA9IGFjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0Y29uc3QgdGVzdFByb2ZpbGVTZXJ2aWNlID0gYWNlc3Nvci5nZXQoSVRlc3RQcm9maWxlU2VydmljZSk7XG5cdFx0Y29uc3QgcHJvZmlsZXMgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDxJVGVzdFJ1blByb2ZpbGVbXT4oJ3ZzY29kZS5waWNrTXVsdGlwbGVUZXN0UHJvZmlsZXMnLCB7XG5cdFx0XHRzaG93Q29uZmlndXJlQnV0dG9uczogZmFsc2UsXG5cdFx0XHRzZWxlY3RlZDogdGVzdFByb2ZpbGVTZXJ2aWNlLmdldEdyb3VwRGVmYXVsdFByb2ZpbGVzKG9ubHlHcm91cCksXG5cdFx0XHRvbmx5R3JvdXAsXG5cdFx0fSk7XG5cblx0XHRpZiAocHJvZmlsZXM/Lmxlbmd0aCkge1xuXHRcdFx0dGVzdFByb2ZpbGVTZXJ2aWNlLnNldEdyb3VwRGVmYXVsdFByb2ZpbGVzKG9ubHlHcm91cCwgcHJvZmlsZXMpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29udGludW91c1J1blRlc3RBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuVG9nZ2xlQ29udGlub3VzUnVuRm9yVGVzdCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcudG9nZ2xlQ29udGludW91c1J1bk9uJywgJ1R1cm4gb24gQ29udGludW91cyBSdW4nKSxcblx0XHRcdGljb246IGljb25zLnRlc3RpbmdUdXJuQ29udGludW91c1J1bk9uLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0VGVzdGluZ0NvbnRleHRLZXlzLmlzQ29udGludW91c01vZGVPbi5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5pc1BhcmVudFJ1bm5pbmdDb250aW51b3VzbHkuaXNFcXVhbFRvKGZhbHNlKVxuXHRcdFx0KSxcblx0XHRcdHRvZ2dsZWQ6IHtcblx0XHRcdFx0Y29uZGl0aW9uOiBUZXN0aW5nQ29udGV4dEtleXMuaXNDb250aW51b3VzTW9kZU9uLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ0NvbnRpbnVvdXNJc09uLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3Rlc3RpbmcudG9nZ2xlQ29udGludW91c1J1bk9mZicsICdUdXJuIG9mZiBDb250aW51b3VzIFJ1bicpLFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHRlc3RJdGVtSW5saW5lQW5kSW5Db250ZXh0KEFjdGlvbk9yZGVyLkNvbnRpbnVvdXNSdW5UZXN0LCBUZXN0aW5nQ29udGV4dEtleXMuc3VwcG9ydHNDb250aW51b3VzUnVuLmlzRXF1YWxUbyh0cnVlKSksXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5lbGVtZW50czogVGVzdEl0ZW1UcmVlRWxlbWVudFtdKTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCBjclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlc3RpbmdDb250aW51b3VzUnVuU2VydmljZSk7XG5cdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0XHRjb25zdCBpZCA9IGVsZW1lbnQudGVzdC5pdGVtLmV4dElkO1xuXHRcdFx0aWYgKGNyU2VydmljZS5pc1NwZWNpZmljYWxseUVuYWJsZWRGb3IoaWQpKSB7XG5cdFx0XHRcdGNyU2VydmljZS5zdG9wKGlkKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNyU2VydmljZS5zdGFydChUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4sIGlkKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbnRpbnVvdXNSdW5Vc2luZ1Byb2ZpbGVUZXN0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNvbnRpbm91c1J1blVzaW5nRm9yVGVzdCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3Rpbmcuc3RhcnRDb250aW51b3VzUnVuVXNpbmcnLCAnU3RhcnQgQ29udGlub3VzIFJ1biBVc2luZy4uLicpLFxuXHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ0RlYnVnSWNvbixcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuVGVzdEl0ZW0sXG5cdFx0XHRcdFx0b3JkZXI6IEFjdGlvbk9yZGVyLlJ1bkNvbnRpbnVvdXMsXG5cdFx0XHRcdFx0Z3JvdXA6ICdidWlsdGluQDInLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5zdXBwb3J0c0NvbnRpbnVvdXNSdW4uaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0XHRcdFx0VGVzdGluZ0NvbnRleHRLZXlzLmlzQ29udGludW91c01vZGVPbi5pc0VxdWFsVG8oZmFsc2UpLFxuXHRcdFx0XHRcdClcblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmVsZW1lbnRzOiBUZXN0SXRlbVRyZWVFbGVtZW50W10pOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IGNyU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdGluZ0NvbnRpbnVvdXNSdW5TZXJ2aWNlKTtcblx0XHRjb25zdCBwcm9maWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFByb2ZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXG5cdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0XHRjb25zdCBzZWxlY3RlZCA9IGF3YWl0IHNlbGVjdENvbnRpbnVvdXNSdW5Qcm9maWxlcyhjclNlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2UsIHF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdFx0XHRbeyBwcm9maWxlczogcHJvZmlsZVNlcnZpY2UuZ2V0Q29udHJvbGxlclByb2ZpbGVzKGVsZW1lbnQudGVzdC5jb250cm9sbGVySWQpIH1dKTtcblxuXHRcdFx0aWYgKHNlbGVjdGVkLmxlbmd0aCkge1xuXHRcdFx0XHRjclNlcnZpY2Uuc3RhcnQoc2VsZWN0ZWQsIGVsZW1lbnQudGVzdC5pdGVtLmV4dElkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbmZpZ3VyZVRlc3RQcm9maWxlc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5Db25maWd1cmVUZXN0UHJvZmlsZXNBY3Rpb24sXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmNvbmZpZ3VyZVByb2ZpbGUnLCBcIkNvbmZpZ3VyZSBUZXN0IFByb2ZpbGVzXCIpLFxuXHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ1VwZGF0ZVByb2ZpbGVzLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmhhc0NvbmZpZ3VyYWJsZVByb2ZpbGUuaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyBydW4oYWNlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgb25seUdyb3VwPzogVGVzdFJ1blByb2ZpbGVCaXRzZXQpIHtcblx0XHRjb25zdCBjb21tYW5kcyA9IGFjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0Y29uc3QgdGVzdFByb2ZpbGVTZXJ2aWNlID0gYWNlc3Nvci5nZXQoSVRlc3RQcm9maWxlU2VydmljZSk7XG5cdFx0Y29uc3QgcHJvZmlsZSA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPElUZXN0UnVuUHJvZmlsZT4oJ3ZzY29kZS5waWNrVGVzdFByb2ZpbGUnLCB7XG5cdFx0XHRwbGFjZWhvbGRlcjogbG9jYWxpemUoJ2NvbmZpZ3VyZVByb2ZpbGUnLCAnU2VsZWN0IGEgcHJvZmlsZSB0byB1cGRhdGUnKSxcblx0XHRcdHNob3dDb25maWd1cmVCdXR0b25zOiBmYWxzZSxcblx0XHRcdG9ubHlDb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRvbmx5R3JvdXAsXG5cdFx0fSk7XG5cblx0XHRpZiAocHJvZmlsZSkge1xuXHRcdFx0dGVzdFByb2ZpbGVTZXJ2aWNlLmNvbmZpZ3VyZShwcm9maWxlLmNvbnRyb2xsZXJJZCwgcHJvZmlsZS5wcm9maWxlSWQpO1xuXHRcdH1cblx0fVxufVxuXG5jb25zdCBjb250aW51b3VzTWVudXMgPSAod2hlbklzQ29udGludW91c09uOiBib29sZWFuKTogSUFjdGlvbjJPcHRpb25zWydtZW51J10gPT4gW1xuXHR7XG5cdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRvcmRlcjogQWN0aW9uT3JkZXIuUnVuVXNpbmcsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVGVzdGluZy5FeHBsb3JlclZpZXdJZCksXG5cdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuc3VwcG9ydHNDb250aW51b3VzUnVuLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5pc0NvbnRpbnVvdXNNb2RlT24uaXNFcXVhbFRvKHdoZW5Jc0NvbnRpbnVvdXNPbiksXG5cdFx0KSxcblx0fSxcblx0e1xuXHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0d2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLnN1cHBvcnRzQ29udGludW91c1J1bi5pc0VxdWFsVG8odHJ1ZSksXG5cdH0sXG5dO1xuXG5jbGFzcyBTdG9wQ29udGludW91c1J1bkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5TdG9wQ29udGlub3VzUnVuLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGVzdGluZy5zdG9wQ29udGludW91cycsICdTdG9wIENvbnRpbnVvdXMgUnVuJyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGljb246IGljb25zLnRlc3RpbmdUdXJuQ29udGludW91c1J1bk9mZixcblx0XHRcdG1lbnU6IGNvbnRpbnVvdXNNZW51cyh0cnVlKSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGFjY2Vzc29yLmdldChJVGVzdGluZ0NvbnRpbnVvdXNSdW5TZXJ2aWNlKS5zdG9wKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2VsZWN0Q29udGludW91c1J1blByb2ZpbGVzKFxuXHRjcnM6IElUZXN0aW5nQ29udGludW91c1J1blNlcnZpY2UsXG5cdG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRwcm9maWxlc1RvUGlja0Zyb206IEl0ZXJhYmxlPFJlYWRvbmx5PHtcblx0XHRjb250cm9sbGVyPzogSU1haW5UaHJlYWRUZXN0Q29udHJvbGxlcjtcblx0XHRwcm9maWxlczogSVRlc3RSdW5Qcm9maWxlW107XG5cdH0+Pixcbik6IFByb21pc2U8SVRlc3RSdW5Qcm9maWxlW10+IHtcblx0dHlwZSBJdGVtVHlwZSA9IElRdWlja1BpY2tJdGVtICYgeyBwcm9maWxlOiBJVGVzdFJ1blByb2ZpbGUgfTtcblxuXHRjb25zdCBpdGVtczogSXRlbVR5cGVbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IHsgY29udHJvbGxlciwgcHJvZmlsZXMgfSBvZiBwcm9maWxlc1RvUGlja0Zyb20pIHtcblx0XHRmb3IgKGNvbnN0IHByb2ZpbGUgb2YgcHJvZmlsZXMpIHtcblx0XHRcdGlmIChwcm9maWxlLnN1cHBvcnRzQ29udGludW91c1J1bikge1xuXHRcdFx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdFx0XHRsYWJlbDogcHJvZmlsZS5sYWJlbCB8fCBjb250cm9sbGVyPy5sYWJlbC5nZXQoKSB8fCAnJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogY29udHJvbGxlcj8ubGFiZWwuZ2V0KCksXG5cdFx0XHRcdFx0cHJvZmlsZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuaW5mbyhsb2NhbGl6ZSgndGVzdGluZy5ub1Byb2ZpbGVzJywgJ05vIHRlc3QgY29udGludW91cyBydW4tZW5hYmxlZCBwcm9maWxlcyB3ZXJlIGZvdW5kJykpO1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoW10pO1xuXHR9XG5cblx0Ly8gc3BlY2lhbCBjYXNlOiBkb24ndCBib3RoZXIgdG8gcXVpY2sgYSBwaWNrcGljayBpZiB0aGVyZSdzIG9ubHkgYSBzaW5nbGUgcHJvZmlsZVxuXHRpZiAoaXRlbXMubGVuZ3RoID09PSAxKSB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShbaXRlbXNbMF0ucHJvZmlsZV0pO1xuXHR9XG5cblx0Y29uc3QgcXBJdGVtczogKEl0ZW1UeXBlIHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSA9IFtdO1xuXHRjb25zdCBzZWxlY3RlZEl0ZW1zOiBJdGVtVHlwZVtdID0gW107XG5cdGNvbnN0IGxhc3RSdW4gPSBjcnMubGFzdFJ1blByb2ZpbGVJZHM7XG5cblx0aXRlbXMuc29ydCgoYSwgYikgPT4gYS5wcm9maWxlLmdyb3VwIC0gYi5wcm9maWxlLmdyb3VwXG5cdFx0fHwgYS5wcm9maWxlLmNvbnRyb2xsZXJJZC5sb2NhbGVDb21wYXJlKGIucHJvZmlsZS5jb250cm9sbGVySWQpXG5cdFx0fHwgYS5sYWJlbC5sb2NhbGVDb21wYXJlKGIubGFiZWwpKTtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgaXRlbSA9IGl0ZW1zW2ldO1xuXHRcdGlmIChpID09PSAwIHx8IGl0ZW1zW2kgLSAxXS5wcm9maWxlLmdyb3VwICE9PSBpdGVtLnByb2ZpbGUuZ3JvdXApIHtcblx0XHRcdHFwSXRlbXMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogdGVzdENvbmZpZ3VyYXRpb25Hcm91cE5hbWVzW2l0ZW0ucHJvZmlsZS5ncm91cF0gfSk7XG5cdFx0fVxuXG5cdFx0cXBJdGVtcy5wdXNoKGl0ZW0pO1xuXHRcdGlmIChsYXN0UnVuLmhhcyhpdGVtLnByb2ZpbGUucHJvZmlsZUlkKSkge1xuXHRcdFx0c2VsZWN0ZWRJdGVtcy5wdXNoKGl0ZW0pO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRjb25zdCBxdWlja3BpY2sgPSBkaXNwb3NhYmxlcy5hZGQocXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPElRdWlja1BpY2tJdGVtICYgeyBwcm9maWxlOiBJVGVzdFJ1blByb2ZpbGUgfT4oeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0pKTtcblx0cXVpY2twaWNrLnRpdGxlID0gbG9jYWxpemUoJ3Rlc3Rpbmcuc2VsZWN0Q29udGludW91c1Byb2ZpbGVzJywgJ1NlbGVjdCBwcm9maWxlcyB0byBydW4gd2hlbiBmaWxlcyBjaGFuZ2U6Jyk7XG5cdHF1aWNrcGljay5jYW5TZWxlY3RNYW55ID0gdHJ1ZTtcblx0cXVpY2twaWNrLml0ZW1zID0gcXBJdGVtcztcblx0cXVpY2twaWNrLnNlbGVjdGVkSXRlbXMgPSBzZWxlY3RlZEl0ZW1zO1xuXHRxdWlja3BpY2suc2hvdygpO1xuXHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrcGljay5vbkRpZEFjY2VwdCgoKSA9PiB7XG5cdFx0XHRyZXNvbHZlKHF1aWNrcGljay5zZWxlY3RlZEl0ZW1zLm1hcChpID0+IGkucHJvZmlsZSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja3BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdHJlc29sdmUoW10pO1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0fSk7XG59XG5cbmNsYXNzIFN0YXJ0Q29udGludW91c1J1bkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5TdGFydENvbnRpbm91c1J1bixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3Rpbmcuc3RhcnRDb250aW51b3VzJywgXCJTdGFydCBDb250aW51b3VzIFJ1blwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ1R1cm5Db250aW51b3VzUnVuT24sXG5cdFx0XHRtZW51OiBjb250aW51b3VzTWVudXMoZmFsc2UpLFxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNycyA9IGFjY2Vzc29yLmdldChJVGVzdGluZ0NvbnRpbnVvdXNSdW5TZXJ2aWNlKTtcblx0XHRjb25zdCBwcm9maWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFByb2ZpbGVTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGxhc3RSdW5Qcm9maWxlcyA9IFsuLi5wcm9maWxlU2VydmljZS5hbGwoKV0uZmxhdE1hcChwID0+IHAucHJvZmlsZXMuZmlsdGVyKHAgPT4gY3JzLmxhc3RSdW5Qcm9maWxlSWRzLmhhcyhwLnByb2ZpbGVJZCkpKTtcblx0XHRpZiAobGFzdFJ1blByb2ZpbGVzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGNycy5zdGFydChsYXN0UnVuUHJvZmlsZXMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGVkID0gYXdhaXQgc2VsZWN0Q29udGludW91c1J1blByb2ZpbGVzKGNycywgYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSksIGFjY2Vzc29yLmdldChJVGVzdFByb2ZpbGVTZXJ2aWNlKS5hbGwoKSk7XG5cdFx0aWYgKHNlbGVjdGVkLmxlbmd0aCkge1xuXHRcdFx0Y3JzLnN0YXJ0KHNlbGVjdGVkKTtcblx0XHR9XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgRXhlY3V0ZVNlbGVjdGVkQWN0aW9uIGV4dGVuZHMgVmlld0FjdGlvbjxUZXN0aW5nRXhwbG9yZXJWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnM6IElBY3Rpb24yT3B0aW9ucywgcHJpdmF0ZSByZWFkb25seSBncm91cDogVGVzdFJ1blByb2ZpbGVCaXRzZXQpIHtcblx0XHRzdXBlcih7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdG9yZGVyOiBncm91cCA9PT0gVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuXG5cdFx0XHRcdFx0PyBBY3Rpb25PcmRlci5SdW5cblx0XHRcdFx0XHQ6IGdyb3VwID09PSBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1Z1xuXHRcdFx0XHRcdFx0PyBBY3Rpb25PcmRlci5EZWJ1Z1xuXHRcdFx0XHRcdFx0OiBBY3Rpb25PcmRlci5Db3ZlcmFnZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFRlc3RpbmcuRXhwbG9yZXJWaWV3SWQpLFxuXHRcdFx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5pc1J1bm5pbmcuaXNFcXVhbFRvKGZhbHNlKSxcblx0XHRcdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuY2FwYWJpbGl0eVRvQ29udGV4dEtleVtncm91cF0uaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0XHQpXG5cdFx0XHR9XSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0dmlld0lkOiBUZXN0aW5nLkV4cGxvcmVyVmlld0lkLFxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBvdmVycmlkZVxuXHQgKi9cblx0cHVibGljIHJ1bkluVmlldyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogVGVzdGluZ0V4cGxvcmVyVmlldyk6IFByb21pc2U8SVRlc3RSZXN1bHQgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB7IGluY2x1ZGUsIGV4Y2x1ZGUgfSA9IHZpZXcuZ2V0VHJlZUluY2x1ZGVFeGNsdWRlKHRoaXMuZ3JvdXApO1xuXHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVRlc3RTZXJ2aWNlKS5ydW5UZXN0cyh7IHRlc3RzOiBpbmNsdWRlLCBleGNsdWRlLCBncm91cDogdGhpcy5ncm91cCB9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgR2V0U2VsZWN0ZWRQcm9maWxlcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7IGlkOiBUZXN0Q29tbWFuZElkLkdldFNlbGVjdGVkUHJvZmlsZXMsIHRpdGxlOiBsb2NhbGl6ZTIoJ2dldFNlbGVjdGVkUHJvZmlsZXMnLCAnR2V0IFNlbGVjdGVkIFByb2ZpbGVzJykgfSk7XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgcHJvZmlsZXMgPSBhY2Nlc3Nvci5nZXQoSVRlc3RQcm9maWxlU2VydmljZSk7XG5cdFx0cmV0dXJuIFtcblx0XHRcdC4uLnByb2ZpbGVzLmdldEdyb3VwRGVmYXVsdFByb2ZpbGVzKFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1biksXG5cdFx0XHQuLi5wcm9maWxlcy5nZXRHcm91cERlZmF1bHRQcm9maWxlcyhUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1ZyksXG5cdFx0XHQuLi5wcm9maWxlcy5nZXRHcm91cERlZmF1bHRQcm9maWxlcyhUZXN0UnVuUHJvZmlsZUJpdHNldC5Db3ZlcmFnZSksXG5cdFx0XS5tYXAocCA9PiAoe1xuXHRcdFx0Y29udHJvbGxlcklkOiBwLmNvbnRyb2xsZXJJZCxcblx0XHRcdGxhYmVsOiBwLmxhYmVsLFxuXHRcdFx0a2luZDogcC5ncm91cCAmIFRlc3RSdW5Qcm9maWxlQml0c2V0LkNvdmVyYWdlXG5cdFx0XHRcdD8gRXh0VGVzdFJ1blByb2ZpbGVLaW5kLkNvdmVyYWdlXG5cdFx0XHRcdDogcC5ncm91cCAmIFRlc3RSdW5Qcm9maWxlQml0c2V0LkRlYnVnXG5cdFx0XHRcdFx0PyBFeHRUZXN0UnVuUHJvZmlsZUtpbmQuRGVidWdcblx0XHRcdFx0XHQ6IEV4dFRlc3RSdW5Qcm9maWxlS2luZC5SdW4sXG5cdFx0fSkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBHZXRFeHBsb3JlclNlbGVjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248VGVzdGluZ0V4cGxvcmVyVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7IGlkOiBUZXN0Q29tbWFuZElkLkdldEV4cGxvcmVyU2VsZWN0aW9uLCB0aXRsZTogbG9jYWxpemUyKCdnZXRFeHBsb3JlclNlbGVjdGlvbicsICdHZXQgRXhwbG9yZXIgU2VsZWN0aW9uJyksIHZpZXdJZDogVGVzdGluZy5FeHBsb3JlclZpZXdJZCB9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAb3ZlcnJpZGVcblx0ICovXG5cdHB1YmxpYyBvdmVycmlkZSBydW5JblZpZXcoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBUZXN0aW5nRXhwbG9yZXJWaWV3KSB7XG5cdFx0Y29uc3QgeyBpbmNsdWRlLCBleGNsdWRlIH0gPSB2aWV3LmdldFRyZWVJbmNsdWRlRXhjbHVkZShUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4sIHVuZGVmaW5lZCwgJ3NlbGVjdGVkJyk7XG5cdFx0Y29uc3QgbWFwcGVyID0gKGk6IEludGVybmFsVGVzdEl0ZW0pID0+IGkuaXRlbS5leHRJZDtcblx0XHRyZXR1cm4geyBpbmNsdWRlOiBpbmNsdWRlLm1hcChtYXBwZXIpLCBleGNsdWRlOiBleGNsdWRlLm1hcChtYXBwZXIpIH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJ1blNlbGVjdGVkQWN0aW9uIGV4dGVuZHMgRXhlY3V0ZVNlbGVjdGVkQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuUnVuU2VsZWN0ZWRBY3Rpb24sXG5cdFx0XHR0aXRsZTogTEFCRUxfUlVOX1RFU1RTLFxuXHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ1J1bkFsbEljb24sXG5cdFx0fSwgVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGVidWdTZWxlY3RlZEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVTZWxlY3RlZEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkRlYnVnU2VsZWN0ZWRBY3Rpb24sXG5cdFx0XHR0aXRsZTogTEFCRUxfREVCVUdfVEVTVFMsXG5cdFx0XHRpY29uOiBpY29ucy50ZXN0aW5nRGVidWdBbGxJY29uLFxuXHRcdH0sIFRlc3RSdW5Qcm9maWxlQml0c2V0LkRlYnVnKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ292ZXJhZ2VTZWxlY3RlZEFjdGlvbiBleHRlbmRzIEV4ZWN1dGVTZWxlY3RlZEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNvdmVyYWdlU2VsZWN0ZWRBY3Rpb24sXG5cdFx0XHR0aXRsZTogTEFCRUxfQ09WRVJBR0VfVEVTVFMsXG5cdFx0XHRpY29uOiBpY29ucy50ZXN0aW5nQ292ZXJhZ2VBbGxJY29uLFxuXHRcdH0sIFRlc3RSdW5Qcm9maWxlQml0c2V0LkNvdmVyYWdlKTtcblx0fVxufVxuXG5jb25zdCBzaG93RGlzY292ZXJpbmdXaGlsZSA9IDxSPihwcm9ncmVzczogSVByb2dyZXNzU2VydmljZSwgdGFzazogUHJvbWlzZTxSPik6IFByb21pc2U8Uj4gPT4ge1xuXHRyZXR1cm4gcHJvZ3Jlc3Mud2l0aFByb2dyZXNzKFxuXHRcdHtcblx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZGlzY292ZXJpbmdUZXN0cycsICdEaXNjb3ZlcmluZyBUZXN0cycpLFxuXHRcdH0sXG5cdFx0KCkgPT4gdGFzayxcblx0KTtcbn07XG5cbmFic3RyYWN0IGNsYXNzIFJ1bk9yRGVidWdBbGxUZXN0c0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zOiBJQWN0aW9uMk9wdGlvbnMsIHByaXZhdGUgcmVhZG9ubHkgZ3JvdXA6IFRlc3RSdW5Qcm9maWxlQml0c2V0LCBwcml2YXRlIG5vVGVzdHNGb3VuZEVycm9yOiBzdHJpbmcpIHtcblx0XHRzdXBlcih7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBUZXN0aW5nQ29udGV4dEtleXMuY2FwYWJpbGl0eVRvQ29udGV4dEtleVtncm91cF0uaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGlmaWNhdGlvbnMgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgcm9vdHMgPSBbLi4udGVzdFNlcnZpY2UuY29sbGVjdGlvbi5yb290SXRlbXNdLmZpbHRlcihyID0+IHIuY2hpbGRyZW4uc2l6ZVxuXHRcdFx0fHwgci5leHBhbmQgPT09IFRlc3RJdGVtRXhwYW5kU3RhdGUuRXhwYW5kYWJsZSB8fCByLmV4cGFuZCA9PT0gVGVzdEl0ZW1FeHBhbmRTdGF0ZS5CdXN5RXhwYW5kaW5nKTtcblx0XHRpZiAoIXJvb3RzLmxlbmd0aCkge1xuXHRcdFx0bm90aWZpY2F0aW9ucy5pbmZvKHRoaXMubm9UZXN0c0ZvdW5kRXJyb3IpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRlc3RTZXJ2aWNlLnJ1blRlc3RzKHsgdGVzdHM6IHJvb3RzLCBncm91cDogdGhpcy5ncm91cCB9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUnVuQWxsQWN0aW9uIGV4dGVuZHMgUnVuT3JEZWJ1Z0FsbFRlc3RzQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlJ1bkFsbEFjdGlvbixcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigncnVuQWxsVGVzdHMnLCAnUnVuIEFsbCBUZXN0cycpLFxuXHRcdFx0XHRpY29uOiBpY29ucy50ZXN0aW5nUnVuQWxsSWNvbixcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TZW1pY29sb24sIEtleUNvZGUuS2V5QSksXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0VGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuLFxuXHRcdFx0bG9jYWxpemUoJ25vVGVzdFByb3ZpZGVyJywgJ05vIHRlc3RzIGZvdW5kIGluIHRoaXMgd29ya3NwYWNlLiBZb3UgbWF5IG5lZWQgdG8gaW5zdGFsbCBhIHRlc3QgcHJvdmlkZXIgZXh0ZW5zaW9uJyksXG5cdFx0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGVidWdBbGxBY3Rpb24gZXh0ZW5kcyBSdW5PckRlYnVnQWxsVGVzdHNBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdHtcblx0XHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuRGVidWdBbGxBY3Rpb24sXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2RlYnVnQWxsVGVzdHMnLCAnRGVidWcgQWxsIFRlc3RzJyksXG5cdFx0XHRcdGljb246IGljb25zLnRlc3RpbmdEZWJ1Z0ljb24sXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2VtaWNvbG9uLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5QSksXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0VGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcsXG5cdFx0XHRsb2NhbGl6ZSgnbm9EZWJ1Z1Rlc3RQcm92aWRlcicsICdObyBkZWJ1Z2dhYmxlIHRlc3RzIGZvdW5kIGluIHRoaXMgd29ya3NwYWNlLiBZb3UgbWF5IG5lZWQgdG8gaW5zdGFsbCBhIHRlc3QgcHJvdmlkZXIgZXh0ZW5zaW9uJyksXG5cdFx0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ292ZXJhZ2VBbGxBY3Rpb24gZXh0ZW5kcyBSdW5PckRlYnVnQWxsVGVzdHNBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdHtcblx0XHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuUnVuQWxsV2l0aENvdmVyYWdlQWN0aW9uLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdydW5BbGxXaXRoQ292ZXJhZ2UnLCAnUnVuIEFsbCBUZXN0cyB3aXRoIENvdmVyYWdlJyksXG5cdFx0XHRcdGljb246IGljb25zLnRlc3RpbmdDb3ZlcmFnZUljb24sXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2VtaWNvbG9uLCBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5QSksXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0VGVzdFJ1blByb2ZpbGVCaXRzZXQuQ292ZXJhZ2UsXG5cdFx0XHRsb2NhbGl6ZSgnbm9Db3ZlcmFnZVRlc3RQcm92aWRlcicsICdObyB0ZXN0cyB3aXRoIGNvdmVyYWdlIHJ1bm5lcnMgZm91bmQgaW4gdGhpcyB3b3Jrc3BhY2UuIFlvdSBtYXkgbmVlZCB0byBpbnN0YWxsIGEgdGVzdCBwcm92aWRlciBleHRlbnNpb24nKSxcblx0XHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDYW5jZWxUZXN0UnVuQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNhbmNlbFRlc3RSdW5BY3Rpb24sXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmNhbmNlbFJ1bicsICdDYW5jZWwgVGVzdCBSdW4nKSxcblx0XHRcdGljb246IGljb25zLnRlc3RpbmdDYW5jZWxJY29uLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNlbWljb2xvbiwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVgpLFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRvcmRlcjogQWN0aW9uT3JkZXIuUnVuLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVGVzdGluZy5FeHBsb3JlclZpZXdJZCksXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKFRlc3RpbmdDb250ZXh0S2V5cy5pc1J1bm5pbmcuc2VyaWFsaXplKCksIHRydWUpLFxuXHRcdFx0XHQpXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBvdmVycmlkZVxuXHQgKi9cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVzdWx0SWQ/OiBzdHJpbmcsIHRhc2tJZD86IHN0cmluZykge1xuXHRcdGNvbnN0IHJlc3VsdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlc3RSZXN1bHRTZXJ2aWNlKTtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFNlcnZpY2UpO1xuXHRcdGlmIChyZXN1bHRJZCkge1xuXHRcdFx0dGVzdFNlcnZpY2UuY2FuY2VsVGVzdFJ1bihyZXN1bHRJZCwgdGFza0lkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChjb25zdCBydW4gb2YgcmVzdWx0U2VydmljZS5yZXN1bHRzKSB7XG5cdFx0XHRcdGlmICghcnVuLmNvbXBsZXRlZEF0KSB7XG5cdFx0XHRcdFx0dGVzdFNlcnZpY2UuY2FuY2VsVGVzdFJ1bihydW4uaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0aW5nVmlld0FzTGlzdEFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248VGVzdGluZ0V4cGxvcmVyVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5UZXN0aW5nVmlld0FzTGlzdEFjdGlvbixcblx0XHRcdHZpZXdJZDogVGVzdGluZy5FeHBsb3JlclZpZXdJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3Rpbmcudmlld0FzTGlzdCcsICdWaWV3IGFzIExpc3QnKSxcblx0XHRcdHRvZ2dsZWQ6IFRlc3RpbmdDb250ZXh0S2V5cy52aWV3TW9kZS5pc0VxdWFsVG8oVGVzdEV4cGxvcmVyVmlld01vZGUuTGlzdCksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRvcmRlcjogQWN0aW9uT3JkZXIuRGlzcGxheU1vZGUsXG5cdFx0XHRcdGdyb3VwOiAndmlld0FzJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVGVzdGluZy5FeHBsb3JlclZpZXdJZClcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAb3ZlcnJpZGVcblx0ICovXG5cdHB1YmxpYyBydW5JblZpZXcoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBUZXN0aW5nRXhwbG9yZXJWaWV3KSB7XG5cdFx0dmlldy52aWV3TW9kZWwudmlld01vZGUgPSBUZXN0RXhwbG9yZXJWaWV3TW9kZS5MaXN0O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0aW5nVmlld0FzVHJlZUFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248VGVzdGluZ0V4cGxvcmVyVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5UZXN0aW5nVmlld0FzVHJlZUFjdGlvbixcblx0XHRcdHZpZXdJZDogVGVzdGluZy5FeHBsb3JlclZpZXdJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3Rpbmcudmlld0FzVHJlZScsICdWaWV3IGFzIFRyZWUnKSxcblx0XHRcdHRvZ2dsZWQ6IFRlc3RpbmdDb250ZXh0S2V5cy52aWV3TW9kZS5pc0VxdWFsVG8oVGVzdEV4cGxvcmVyVmlld01vZGUuVHJlZSksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRvcmRlcjogQWN0aW9uT3JkZXIuRGlzcGxheU1vZGUsXG5cdFx0XHRcdGdyb3VwOiAndmlld0FzJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVGVzdGluZy5FeHBsb3JlclZpZXdJZClcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAb3ZlcnJpZGVcblx0ICovXG5cdHB1YmxpYyBydW5JblZpZXcoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBUZXN0aW5nRXhwbG9yZXJWaWV3KSB7XG5cdFx0dmlldy52aWV3TW9kZWwudmlld01vZGUgPSBUZXN0RXhwbG9yZXJWaWV3TW9kZS5UcmVlO1xuXHR9XG59XG5cblxuZXhwb3J0IGNsYXNzIFRlc3RpbmdTb3J0QnlTdGF0dXNBY3Rpb24gZXh0ZW5kcyBWaWV3QWN0aW9uPFRlc3RpbmdFeHBsb3JlclZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuVGVzdGluZ1NvcnRCeVN0YXR1c0FjdGlvbixcblx0XHRcdHZpZXdJZDogVGVzdGluZy5FeHBsb3JlclZpZXdJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3Rpbmcuc29ydEJ5U3RhdHVzJywgJ1NvcnQgYnkgU3RhdHVzJyksXG5cdFx0XHR0b2dnbGVkOiBUZXN0aW5nQ29udGV4dEtleXMudmlld1NvcnRpbmcuaXNFcXVhbFRvKFRlc3RFeHBsb3JlclZpZXdTb3J0aW5nLkJ5U3RhdHVzKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdG9yZGVyOiBBY3Rpb25PcmRlci5Tb3J0LFxuXHRcdFx0XHRncm91cDogJ3NvcnRCeScsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFRlc3RpbmcuRXhwbG9yZXJWaWV3SWQpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwdWJsaWMgcnVuSW5WaWV3KF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogVGVzdGluZ0V4cGxvcmVyVmlldykge1xuXHRcdHZpZXcudmlld01vZGVsLnZpZXdTb3J0aW5nID0gVGVzdEV4cGxvcmVyVmlld1NvcnRpbmcuQnlTdGF0dXM7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RpbmdTb3J0QnlMb2NhdGlvbkFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248VGVzdGluZ0V4cGxvcmVyVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5UZXN0aW5nU29ydEJ5TG9jYXRpb25BY3Rpb24sXG5cdFx0XHR2aWV3SWQ6IFRlc3RpbmcuRXhwbG9yZXJWaWV3SWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLnNvcnRCeUxvY2F0aW9uJywgJ1NvcnQgYnkgTG9jYXRpb24nKSxcblx0XHRcdHRvZ2dsZWQ6IFRlc3RpbmdDb250ZXh0S2V5cy52aWV3U29ydGluZy5pc0VxdWFsVG8oVGVzdEV4cGxvcmVyVmlld1NvcnRpbmcuQnlMb2NhdGlvbiksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRvcmRlcjogQWN0aW9uT3JkZXIuU29ydCxcblx0XHRcdFx0Z3JvdXA6ICdzb3J0QnknLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBUZXN0aW5nLkV4cGxvcmVyVmlld0lkKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBvdmVycmlkZVxuXHQgKi9cblx0cHVibGljIHJ1bkluVmlldyhfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFRlc3RpbmdFeHBsb3JlclZpZXcpIHtcblx0XHR2aWV3LnZpZXdNb2RlbC52aWV3U29ydGluZyA9IFRlc3RFeHBsb3JlclZpZXdTb3J0aW5nLkJ5TG9jYXRpb247XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RpbmdTb3J0QnlEdXJhdGlvbkFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248VGVzdGluZ0V4cGxvcmVyVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5UZXN0aW5nU29ydEJ5RHVyYXRpb25BY3Rpb24sXG5cdFx0XHR2aWV3SWQ6IFRlc3RpbmcuRXhwbG9yZXJWaWV3SWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLnNvcnRCeUR1cmF0aW9uJywgJ1NvcnQgYnkgRHVyYXRpb24nKSxcblx0XHRcdHRvZ2dsZWQ6IFRlc3RpbmdDb250ZXh0S2V5cy52aWV3U29ydGluZy5pc0VxdWFsVG8oVGVzdEV4cGxvcmVyVmlld1NvcnRpbmcuQnlEdXJhdGlvbiksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRvcmRlcjogQWN0aW9uT3JkZXIuU29ydCxcblx0XHRcdFx0Z3JvdXA6ICdzb3J0QnknLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBUZXN0aW5nLkV4cGxvcmVyVmlld0lkKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBvdmVycmlkZVxuXHQgKi9cblx0cHVibGljIHJ1bkluVmlldyhfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFRlc3RpbmdFeHBsb3JlclZpZXcpIHtcblx0XHR2aWV3LnZpZXdNb2RlbC52aWV3U29ydGluZyA9IFRlc3RFeHBsb3JlclZpZXdTb3J0aW5nLkJ5RHVyYXRpb247XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNob3dNb3N0UmVjZW50T3V0cHV0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlNob3dNb3N0UmVjZW50T3V0cHV0QWN0aW9uLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGVzdGluZy5zaG93TW9zdFJlY2VudE91dHB1dCcsICdTaG93IE91dHB1dCcpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRpY29uOiBDb2RpY29uLnRlcm1pbmFsLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNlbWljb2xvbiwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleU8pLFxuXHRcdFx0fSxcblx0XHRcdHByZWNvbmRpdGlvbjogVGVzdGluZ0NvbnRleHRLZXlzLmhhc0FueVJlc3VsdHMuaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdG9yZGVyOiBBY3Rpb25PcmRlci5Db2xsYXBzZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVGVzdGluZy5FeHBsb3JlclZpZXdJZCksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IFRlc3RpbmdDb250ZXh0S2V5cy5oYXNBbnlSZXN1bHRzLmlzRXF1YWxUbyh0cnVlKVxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCB2aWV3U2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRjb25zdCB0ZXN0VmlldyA9IGF3YWl0IHZpZXdTZXJ2aWNlLm9wZW5WaWV3PFRlc3RSZXN1bHRzVmlldz4oVGVzdGluZy5SZXN1bHRzVmlld0lkLCB0cnVlKTtcblx0XHR0ZXN0Vmlldz8uc2hvd0xhdGVzdFJ1bigpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb2xsYXBzZUFsbEFjdGlvbiBleHRlbmRzIFZpZXdBY3Rpb248VGVzdGluZ0V4cGxvcmVyVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5Db2xsYXBzZUFsbEFjdGlvbixcblx0XHRcdHZpZXdJZDogVGVzdGluZy5FeHBsb3JlclZpZXdJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcuY29sbGFwc2VBbGwnLCAnQ29sbGFwc2UgQWxsIFRlc3RzJyksXG5cdFx0XHRpY29uOiBDb2RpY29uLmNvbGxhcHNlQWxsLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0b3JkZXI6IEFjdGlvbk9yZGVyLkNvbGxhcHNlLFxuXHRcdFx0XHRncm91cDogJ2Rpc3BsYXlBY3Rpb24nLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBUZXN0aW5nLkV4cGxvcmVyVmlld0lkKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBvdmVycmlkZVxuXHQgKi9cblx0cHVibGljIHJ1bkluVmlldyhfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFRlc3RpbmdFeHBsb3JlclZpZXcpIHtcblx0XHR2aWV3LnZpZXdNb2RlbC5jb2xsYXBzZUFsbCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGVhclRlc3RSZXN1bHRzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNsZWFyVGVzdFJlc3VsdHNBY3Rpb24sXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmNsZWFyUmVzdWx0cycsICdDbGVhciBBbGwgUmVzdWx0cycpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRpY29uOiBDb2RpY29uLmNsZWFyQWxsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5UZXN0UGVla1RpdGxlLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBUZXN0aW5nQ29udGV4dEtleXMuaGFzQW55UmVzdWx0cy5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRvcmRlcjogQWN0aW9uT3JkZXIuQ2xlYXJSZXN1bHRzLFxuXHRcdFx0XHRncm91cDogJ2Rpc3BsYXlBY3Rpb24nLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBUZXN0aW5nLkV4cGxvcmVyVmlld0lkKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0b3JkZXI6IEFjdGlvbk9yZGVyLkNsZWFyUmVzdWx0cyxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVGVzdGluZy5SZXN1bHRzVmlld0lkKVxuXHRcdFx0fV0sXG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0YWNjZXNzb3IuZ2V0KElUZXN0UmVzdWx0U2VydmljZSkuY2xlYXIoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgR29Ub1Rlc3QgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuR29Ub1Rlc3QsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmVkaXRGb2N1c2VkVGVzdCcsICdHbyB0byBUZXN0JyksXG5cdFx0XHRpY29uOiBDb2RpY29uLmdvVG9GaWxlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlRlc3RJdGVtLFxuXHRcdFx0XHRncm91cDogJ2J1aWx0aW5AMScsXG5cdFx0XHRcdG9yZGVyOiBBY3Rpb25PcmRlci5Hb1RvVGVzdCxcblx0XHRcdFx0d2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLnRlc3RJdGVtSGFzVXJpLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdH0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliIC0gMTAsXG5cdFx0XHRcdHdoZW46IEZvY3VzZWRWaWV3Q29udGV4dC5pc0VxdWFsVG8oVGVzdGluZy5FeHBsb3JlclZpZXdJZCksXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXIgfCBLZXlNb2QuQWx0LFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVsZW1lbnQ/OiBUZXN0RXhwbG9yZXJUcmVlRWxlbWVudCwgcHJlc2VydmVGb2N1cz86IGJvb2xlYW4pIHtcblx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdGNvbnN0IHZpZXcgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkuZ2V0QWN0aXZlVmlld1dpdGhJZDxUZXN0aW5nRXhwbG9yZXJWaWV3PihUZXN0aW5nLkV4cGxvcmVyVmlld0lkKTtcblx0XHRcdGVsZW1lbnQgPSB2aWV3Py5mb2N1c2VkVHJlZUVsZW1lbnRzWzBdO1xuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50ICYmIGVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0SXRlbVRyZWVFbGVtZW50KSB7XG5cdFx0XHRhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKS5leGVjdXRlQ29tbWFuZCgndnNjb2RlLnJldmVhbFRlc3QnLCBlbGVtZW50LnRlc3QuaXRlbS5leHRJZCwgcHJlc2VydmVGb2N1cyk7XG5cdFx0fVxuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFRlc3RzQXRDdXJzb3IodGVzdFNlcnZpY2U6IElUZXN0U2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLCB1cmk6IFVSSSwgcG9zaXRpb246IFBvc2l0aW9uLCBmaWx0ZXI/OiAodGVzdDogSW50ZXJuYWxUZXN0SXRlbSkgPT4gYm9vbGVhbikge1xuXHQvLyB0ZXN0c0luRmlsZSB3aWxsIGRlc2NlbmQgaW4gdGhlIHRlc3QgdHJlZS4gV2UgYXNzdW1lIHRoYXQgYXMgd2UgZ29cblx0Ly8gZGVlcGVyLCByYW5nZXMgZ2V0IG1vcmUgc3BlY2lmaWMuIFdlJ2xsIHdhbnQgdG8gcnVuIGFsbCB0ZXN0cyB3aG9zZVxuXHQvLyByYW5nZSBpcyBlcXVhbCB0byB0aGUgbW9zdCBzcGVjaWZpYyByYW5nZSB3ZSBmaW5kIChzZWUgIzEzMzUxOSlcblx0Ly9cblx0Ly8gSWYgd2UgZG9uJ3QgZmluZCBhbnkgdGVzdCB3aG9zZSByYW5nZSBjb250YWlucyB0aGUgcG9zaXRpb24sIHdlIHBpY2tcblx0Ly8gdGhlIGNsb3Nlc3Qgb25lIGJlZm9yZSB0aGUgcG9zaXRpb24uIEFnYWluLCBpZiB3ZSBmaW5kIHNldmVyYWwgdGVzdHNcblx0Ly8gd2hvc2UgcmFuZ2UgaXMgZXF1YWwgdG8gdGhlIGNsb3Nlc3Qgb25lLCB3ZSBydW4gdGhlbSBhbGwuXG5cblx0bGV0IGJlc3ROb2RlczogSW50ZXJuYWxUZXN0SXRlbVtdID0gW107XG5cdGxldCBiZXN0UmFuZ2U6IFJhbmdlIHwgdW5kZWZpbmVkO1xuXG5cdGxldCBiZXN0Tm9kZXNCZWZvcmU6IEludGVybmFsVGVzdEl0ZW1bXSA9IFtdO1xuXHRsZXQgYmVzdFJhbmdlQmVmb3JlOiBSYW5nZSB8IHVuZGVmaW5lZDtcblxuXHRmb3IgYXdhaXQgKGNvbnN0IHRlc3Qgb2YgdGVzdHNJbkZpbGUodGVzdFNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgdXJpKSkge1xuXHRcdGlmICghdGVzdC5pdGVtLnJhbmdlIHx8IGZpbHRlcj8uKHRlc3QpID09PSBmYWxzZSkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXJhbmdlID0gUmFuZ2UubGlmdCh0ZXN0Lml0ZW0ucmFuZ2UpO1xuXHRcdGlmIChpcmFuZ2UuY29udGFpbnNQb3NpdGlvbihwb3NpdGlvbikpIHtcblx0XHRcdGlmIChiZXN0UmFuZ2UgJiYgUmFuZ2UuZXF1YWxzUmFuZ2UodGVzdC5pdGVtLnJhbmdlLCBiZXN0UmFuZ2UpKSB7XG5cdFx0XHRcdC8vIGNoZWNrIHRoYXQgYSBwYXJlbnQgaXNuJ3QgYWxyZWFkeSBpbmNsdWRlZCAoIzE4MDc2MClcblx0XHRcdFx0aWYgKCFiZXN0Tm9kZXMuc29tZShiID0+IFRlc3RJZC5pc0NoaWxkKGIuaXRlbS5leHRJZCwgdGVzdC5pdGVtLmV4dElkKSkpIHtcblx0XHRcdFx0XHRiZXN0Tm9kZXMucHVzaCh0ZXN0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YmVzdFJhbmdlID0gaXJhbmdlO1xuXHRcdFx0XHRiZXN0Tm9kZXMgPSBbdGVzdF07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChQb3NpdGlvbi5pc0JlZm9yZShpcmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpLCBwb3NpdGlvbikpIHtcblx0XHRcdGlmICghYmVzdFJhbmdlQmVmb3JlIHx8IGJlc3RSYW5nZUJlZm9yZS5nZXRTdGFydFBvc2l0aW9uKCkuaXNCZWZvcmUoaXJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSkpIHtcblx0XHRcdFx0YmVzdFJhbmdlQmVmb3JlID0gaXJhbmdlO1xuXHRcdFx0XHRiZXN0Tm9kZXNCZWZvcmUgPSBbdGVzdF07XG5cdFx0XHR9IGVsc2UgaWYgKGlyYW5nZS5lcXVhbHNSYW5nZShiZXN0UmFuZ2VCZWZvcmUpICYmICFiZXN0Tm9kZXNCZWZvcmUuc29tZShiID0+IFRlc3RJZC5pc0NoaWxkKGIuaXRlbS5leHRJZCwgdGVzdC5pdGVtLmV4dElkKSkpIHtcblx0XHRcdFx0YmVzdE5vZGVzQmVmb3JlLnB1c2godGVzdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGJlc3ROb2Rlcy5sZW5ndGggPyBiZXN0Tm9kZXMgOiBiZXN0Tm9kZXNCZWZvcmU7XG59XG5cbmNvbnN0IGVudW0gRWRpdG9yQ29udGV4dE9yZGVyIHtcblx0UnVuQXRDdXJzb3IsXG5cdERlYnVnQXRDdXJzb3IsXG5cdFJ1bkluRmlsZSxcblx0RGVidWdJbkZpbGUsXG5cdEdvVG9SZWxhdGVkLFxuXHRQZWVrUmVsYXRlZCxcbn1cblxuYWJzdHJhY3QgY2xhc3MgRXhlY3V0ZVRlc3RBdEN1cnNvciBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zOiBJQWN0aW9uMk9wdGlvbnMsIHByb3RlY3RlZCByZWFkb25seSBncm91cDogVGVzdFJ1blByb2ZpbGVCaXRzZXQpIHtcblx0XHRzdXBlcih7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogaGFzQW55VGVzdFByb3ZpZGVyLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAndGVzdGluZycsXG5cdFx0XHRcdG9yZGVyOiBncm91cCA9PT0gVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuID8gRWRpdG9yQ29udGV4dE9yZGVyLlJ1bkF0Q3Vyc29yIDogRWRpdG9yQ29udGV4dE9yZGVyLkRlYnVnQXRDdXJzb3IsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUZXN0aW5nQ29udGV4dEtleXMuYWN0aXZlRWRpdG9ySGFzVGVzdHMsIFRlc3RpbmdDb250ZXh0S2V5cy5jYXBhYmlsaXR5VG9Db250ZXh0S2V5W2dyb3VwXSksXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBvdmVycmlkZVxuXHQgKi9cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGNvZGVFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb2RlRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRsZXQgZWRpdG9yID0gY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpO1xuXHRcdGlmICghYWN0aXZlRWRpdG9yUGFuZSB8fCAhZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRvciBpbnN0YW5jZW9mIEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCkge1xuXHRcdFx0ZWRpdG9yID0gZWRpdG9yLmdldFBhcmVudEVkaXRvcigpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBvc2l0aW9uID0gZWRpdG9yPy5nZXRQb3NpdGlvbigpO1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yPy5nZXRNb2RlbCgpO1xuXHRcdGlmICghcG9zaXRpb24gfHwgIW1vZGVsIHx8ICEoJ3VyaScgaW4gbW9kZWwpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGVzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBwcm9maWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFByb2ZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmlJZGVudGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0Y29uc3QgcHJvZ3Jlc3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQcm9ncmVzc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBzYXZlQmVmb3JlVGVzdCA9IGdldFRlc3RpbmdDb25maWd1cmF0aW9uKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBUZXN0aW5nQ29uZmlnS2V5cy5TYXZlQmVmb3JlVGVzdCk7XG5cdFx0aWYgKHNhdmVCZWZvcmVUZXN0KSB7XG5cdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLnNhdmUoeyBlZGl0b3I6IGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQsIGdyb3VwSWQ6IGFjdGl2ZUVkaXRvclBhbmUuZ3JvdXAuaWQgfSk7XG5cdFx0XHRhd2FpdCB0ZXN0U2VydmljZS5zeW5jVGVzdHMoKTtcblx0XHR9XG5cblxuXHRcdC8vIHRlc3RzSW5GaWxlIHdpbGwgZGVzY2VuZCBpbiB0aGUgdGVzdCB0cmVlLiBXZSBhc3N1bWUgdGhhdCBhcyB3ZSBnb1xuXHRcdC8vIGRlZXBlciwgcmFuZ2VzIGdldCBtb3JlIHNwZWNpZmljLiBXZSdsbCB3YW50IHRvIHJ1biBhbGwgdGVzdHMgd2hvc2Vcblx0XHQvLyByYW5nZSBpcyBlcXVhbCB0byB0aGUgbW9zdCBzcGVjaWZpYyByYW5nZSB3ZSBmaW5kIChzZWUgIzEzMzUxOSlcblx0XHQvL1xuXHRcdC8vIElmIHdlIGRvbid0IGZpbmQgYW55IHRlc3Qgd2hvc2UgcmFuZ2UgY29udGFpbnMgdGhlIHBvc2l0aW9uLCB3ZSBwaWNrXG5cdFx0Ly8gdGhlIGNsb3Nlc3Qgb25lIGJlZm9yZSB0aGUgcG9zaXRpb24uIEFnYWluLCBpZiB3ZSBmaW5kIHNldmVyYWwgdGVzdHNcblx0XHQvLyB3aG9zZSByYW5nZSBpcyBlcXVhbCB0byB0aGUgY2xvc2VzdCBvbmUsIHdlIHJ1biB0aGVtIGFsbC5cblx0XHRjb25zdCB0ZXN0c1RvUnVuID0gYXdhaXQgc2hvd0Rpc2NvdmVyaW5nV2hpbGUocHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdFx0Z2V0VGVzdHNBdEN1cnNvcihcblx0XHRcdFx0dGVzdFNlcnZpY2UsXG5cdFx0XHRcdHVyaUlkZW50aXR5U2VydmljZSxcblx0XHRcdFx0bW9kZWwudXJpLFxuXHRcdFx0XHRwb3NpdGlvbixcblx0XHRcdFx0dGVzdCA9PiAhIShwcm9maWxlU2VydmljZS5jYXBhYmlsaXRpZXNGb3JUZXN0KHRlc3QuaXRlbSkgJiB0aGlzLmdyb3VwKVxuXHRcdFx0KVxuXHRcdCk7XG5cblx0XHRpZiAodGVzdHNUb1J1bi5sZW5ndGgpIHtcblx0XHRcdGF3YWl0IHRlc3RTZXJ2aWNlLnJ1blRlc3RzKHsgZ3JvdXA6IHRoaXMuZ3JvdXAsIHRlc3RzOiB0ZXN0c1RvUnVuIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlbGF0ZWRUZXN0cyA9IGF3YWl0IHRlc3RTZXJ2aWNlLmdldFRlc3RzUmVsYXRlZFRvQ29kZShtb2RlbC51cmksIHBvc2l0aW9uKTtcblx0XHRpZiAocmVsYXRlZFRlc3RzLmxlbmd0aCkge1xuXHRcdFx0YXdhaXQgdGVzdFNlcnZpY2UucnVuVGVzdHMoeyBncm91cDogdGhpcy5ncm91cCwgdGVzdHM6IHJlbGF0ZWRUZXN0cyB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRNZXNzYWdlQ29udHJvbGxlci5nZXQoZWRpdG9yKT8uc2hvd01lc3NhZ2UobG9jYWxpemUoJ25vVGVzdHNBdEN1cnNvcicsIFwiTm8gdGVzdHMgZm91bmQgaGVyZVwiKSwgcG9zaXRpb24pO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUnVuQXRDdXJzb3IgZXh0ZW5kcyBFeGVjdXRlVGVzdEF0Q3Vyc29yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuUnVuQXRDdXJzb3IsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLnJ1bkF0Q3Vyc29yJywgJ1J1biBUZXN0IGF0IEN1cnNvcicpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TZW1pY29sb24sIEtleUNvZGUuS2V5QyksXG5cdFx0XHR9LFxuXHRcdH0sIFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1bik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlYnVnQXRDdXJzb3IgZXh0ZW5kcyBFeGVjdXRlVGVzdEF0Q3Vyc29yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuRGVidWdBdEN1cnNvcixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcuZGVidWdBdEN1cnNvcicsICdEZWJ1ZyBUZXN0IGF0IEN1cnNvcicpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TZW1pY29sb24sIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlDKSxcblx0XHRcdH0sXG5cdFx0fSwgVGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb3ZlcmFnZUF0Q3Vyc29yIGV4dGVuZHMgRXhlY3V0ZVRlc3RBdEN1cnNvciB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNvdmVyYWdlQXRDdXJzb3IsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmNvdmVyYWdlQXRDdXJzb3InLCAnUnVuIFRlc3QgYXQgQ3Vyc29yIHdpdGggQ292ZXJhZ2UnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2VtaWNvbG9uLCBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5QyksXG5cdFx0XHR9LFxuXHRcdH0sIFRlc3RSdW5Qcm9maWxlQml0c2V0LkNvdmVyYWdlKTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBFeGVjdXRlVGVzdHNVbmRlclVyaUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zOiBJQWN0aW9uMk9wdGlvbnMsIHByb3RlY3RlZCByZWFkb25seSBncm91cDogVGVzdFJ1blByb2ZpbGVCaXRzZXQpIHtcblx0XHRzdXBlcih7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHBsb3JlckNvbnRleHQsXG5cdFx0XHRcdHdoZW46IFRlc3RpbmdDb250ZXh0S2V5cy5jYXBhYmlsaXR5VG9Db250ZXh0S2V5W2dyb3VwXS5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHRcdGdyb3VwOiAnNi41X3Rlc3RpbmcnLFxuXHRcdFx0XHRvcmRlcjogKGdyb3VwID09PSBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4gPyBBY3Rpb25PcmRlci5SdW4gOiBBY3Rpb25PcmRlci5EZWJ1ZykgKyAwLjEsXG5cdFx0XHR9XSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHVyaTogVVJJKTogUHJvbWlzZTx1bmtub3duPiB7XG5cdFx0Y29uc3QgdGVzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCB0ZXN0cyA9IGF3YWl0IEl0ZXJhYmxlLmFzeW5jVG9BcnJheSh0ZXN0c1VuZGVyVXJpKFxuXHRcdFx0dGVzdFNlcnZpY2UsXG5cdFx0XHRhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSksXG5cdFx0XHR1cmlcblx0XHQpKTtcblxuXHRcdGlmICghdGVzdHMubGVuZ3RoKSB7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7IG1lc3NhZ2U6IGxvY2FsaXplKCdub1Rlc3RzJywgJ05vIHRlc3RzIGZvdW5kIGluIHRoZSBzZWxlY3RlZCBmaWxlIG9yIGZvbGRlcicpLCBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGVzdFNlcnZpY2UucnVuVGVzdHMoeyB0ZXN0cywgZ3JvdXA6IHRoaXMuZ3JvdXAgfSk7XG5cdH1cbn1cblxuY2xhc3MgUnVuVGVzdHNVbmRlclVyaSBleHRlbmRzIEV4ZWN1dGVUZXN0c1VuZGVyVXJpQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuUnVuQnlVcmksXG5cdFx0XHR0aXRsZTogTEFCRUxfUlVOX1RFU1RTLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0fSwgVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuKTtcblx0fVxufVxuXG5jbGFzcyBEZWJ1Z1Rlc3RzVW5kZXJVcmkgZXh0ZW5kcyBFeGVjdXRlVGVzdHNVbmRlclVyaUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkRlYnVnQnlVcmksXG5cdFx0XHR0aXRsZTogTEFCRUxfREVCVUdfVEVTVFMsXG5cdFx0XHRjYXRlZ29yeSxcblx0XHR9LCBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1Zyk7XG5cdH1cbn1cblxuY2xhc3MgQ292ZXJhZ2VUZXN0c1VuZGVyVXJpIGV4dGVuZHMgRXhlY3V0ZVRlc3RzVW5kZXJVcmlBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5Db3ZlcmFnZUJ5VXJpLFxuXHRcdFx0dGl0bGU6IExBQkVMX0NPVkVSQUdFX1RFU1RTLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0fSwgVGVzdFJ1blByb2ZpbGVCaXRzZXQuQ292ZXJhZ2UpO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIEV4ZWN1dGVUZXN0c0luQ3VycmVudEZpbGUgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3Iob3B0aW9uczogSUFjdGlvbjJPcHRpb25zLCBwcm90ZWN0ZWQgcmVhZG9ubHkgZ3JvdXA6IFRlc3RSdW5Qcm9maWxlQml0c2V0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IFRlc3RpbmdDb250ZXh0S2V5cy5jYXBhYmlsaXR5VG9Db250ZXh0S2V5W2dyb3VwXS5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICd0ZXN0aW5nJyxcblx0XHRcdFx0b3JkZXI6IGdyb3VwID09PSBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4gPyBFZGl0b3JDb250ZXh0T3JkZXIuUnVuSW5GaWxlIDogRWRpdG9yQ29udGV4dE9yZGVyLkRlYnVnSW5GaWxlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoVGVzdGluZ0NvbnRleHRLZXlzLmFjdGl2ZUVkaXRvckhhc1Rlc3RzLCBUZXN0aW5nQ29udGV4dEtleXMuY2FwYWJpbGl0eVRvQ29udGV4dEtleVtncm91cF0pLFxuXHRcdFx0fV0sXG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0bGV0IGVkaXRvciA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmdldEFjdGl2ZUNvZGVFZGl0b3IoKTtcblx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoZWRpdG9yIGluc3RhbmNlb2YgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0KSB7XG5cdFx0XHRlZGl0b3IgPSBlZGl0b3IuZ2V0UGFyZW50RWRpdG9yKCk7XG5cdFx0fVxuXHRcdGNvbnN0IHBvc2l0aW9uID0gZWRpdG9yPy5nZXRQb3NpdGlvbigpO1xuXHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yPy5nZXRNb2RlbCgpO1xuXHRcdGlmICghcG9zaXRpb24gfHwgIW1vZGVsIHx8ICEoJ3VyaScgaW4gbW9kZWwpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGVzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBkZW1hbmRlZFVyaSA9IG1vZGVsLnVyaS50b1N0cmluZygpO1xuXG5cdFx0Ly8gSXRlcmF0ZSB0aHJvdWdoIHRoZSBlbnRpcmUgY29sbGVjdGlvbiBhbmQgcnVuIGFueSB0ZXN0cyB0aGF0IGFyZSBpbiB0aGVcblx0XHQvLyB1cmkuIFNlZSAjMTM4MDA3LlxuXHRcdGNvbnN0IHF1ZXVlID0gW3Rlc3RTZXJ2aWNlLmNvbGxlY3Rpb24ucm9vdElkc107XG5cdFx0Y29uc3QgZGlzY292ZXJlZDogSW50ZXJuYWxUZXN0SXRlbVtdID0gW107XG5cdFx0d2hpbGUgKHF1ZXVlLmxlbmd0aCkge1xuXHRcdFx0Zm9yIChjb25zdCBpZCBvZiBxdWV1ZS5wb3AoKSEpIHtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHRlc3RTZXJ2aWNlLmNvbGxlY3Rpb24uZ2V0Tm9kZUJ5SWQoaWQpITtcblx0XHRcdFx0aWYgKG5vZGUuaXRlbS51cmk/LnRvU3RyaW5nKCkgPT09IGRlbWFuZGVkVXJpKSB7XG5cdFx0XHRcdFx0ZGlzY292ZXJlZC5wdXNoKG5vZGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHF1ZXVlLnB1c2gobm9kZS5jaGlsZHJlbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZGlzY292ZXJlZC5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB0ZXN0U2VydmljZS5ydW5UZXN0cyh7XG5cdFx0XHRcdHRlc3RzOiBkaXNjb3ZlcmVkLFxuXHRcdFx0XHRncm91cDogdGhpcy5ncm91cCxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdE1lc3NhZ2VDb250cm9sbGVyLmdldChlZGl0b3IpPy5zaG93TWVzc2FnZShsb2NhbGl6ZSgnbm9UZXN0c0luRmlsZScsIFwiTm8gdGVzdHMgZm91bmQgaW4gdGhpcyBmaWxlXCIpLCBwb3NpdGlvbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUnVuQ3VycmVudEZpbGUgZXh0ZW5kcyBFeGVjdXRlVGVzdHNJbkN1cnJlbnRGaWxlIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5SdW5DdXJyZW50RmlsZSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcucnVuQ3VycmVudEZpbGUnLCAnUnVuIFRlc3RzIGluIEN1cnJlbnQgRmlsZScpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TZW1pY29sb24sIEtleUNvZGUuS2V5RiksXG5cdFx0XHR9LFxuXHRcdH0sIFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1bik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlYnVnQ3VycmVudEZpbGUgZXh0ZW5kcyBFeGVjdXRlVGVzdHNJbkN1cnJlbnRGaWxlIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuRGVidWdDdXJyZW50RmlsZSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcuZGVidWdDdXJyZW50RmlsZScsICdEZWJ1ZyBUZXN0cyBpbiBDdXJyZW50IEZpbGUnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2VtaWNvbG9uLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5RiksXG5cdFx0XHR9LFxuXHRcdH0sIFRlc3RSdW5Qcm9maWxlQml0c2V0LkRlYnVnKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ292ZXJhZ2VDdXJyZW50RmlsZSBleHRlbmRzIEV4ZWN1dGVUZXN0c0luQ3VycmVudEZpbGUge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5Db3ZlcmFnZUN1cnJlbnRGaWxlLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGVzdGluZy5jb3ZlcmFnZUN1cnJlbnRGaWxlJywgJ1J1biBUZXN0cyB3aXRoIENvdmVyYWdlIGluIEN1cnJlbnQgRmlsZScpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TZW1pY29sb24sIEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlGKSxcblx0XHRcdH0sXG5cdFx0fSwgVGVzdFJ1blByb2ZpbGVCaXRzZXQuQ292ZXJhZ2UpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBkaXNjb3ZlckFuZFJ1blRlc3RzID0gYXN5bmMgKFxuXHRjb2xsZWN0aW9uOiBJTWFpblRocmVhZFRlc3RDb2xsZWN0aW9uLFxuXHRwcm9ncmVzczogSVByb2dyZXNzU2VydmljZSxcblx0aWRzOiBSZWFkb25seUFycmF5PHN0cmluZz4sXG5cdHJ1blRlc3RzOiAodGVzdHM6IFJlYWRvbmx5QXJyYXk8SW50ZXJuYWxUZXN0SXRlbT4pID0+IFByb21pc2U8SVRlc3RSZXN1bHQ+LFxuKTogUHJvbWlzZTxJVGVzdFJlc3VsdCB8IHVuZGVmaW5lZD4gPT4ge1xuXHRjb25zdCB0b2RvID0gUHJvbWlzZS5hbGwoaWRzLm1hcChwID0+IGV4cGFuZEFuZEdldFRlc3RCeUlkKGNvbGxlY3Rpb24sIHApKSk7XG5cdGNvbnN0IHRlc3RzID0gKGF3YWl0IHNob3dEaXNjb3ZlcmluZ1doaWxlKHByb2dyZXNzLCB0b2RvKSkuZmlsdGVyKGlzRGVmaW5lZCk7XG5cdHJldHVybiB0ZXN0cy5sZW5ndGggPyBhd2FpdCBydW5UZXN0cyh0ZXN0cykgOiB1bmRlZmluZWQ7XG59O1xuXG5hYnN0cmFjdCBjbGFzcyBSdW5PckRlYnVnRXh0c0J5UGF0aCBleHRlbmRzIEFjdGlvbjIge1xuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiB1bmtub3duW10pIHtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFNlcnZpY2UpO1xuXHRcdGF3YWl0IGRpc2NvdmVyQW5kUnVuVGVzdHMoXG5cdFx0XHRhY2Nlc3Nvci5nZXQoSVRlc3RTZXJ2aWNlKS5jb2xsZWN0aW9uLFxuXHRcdFx0YWNjZXNzb3IuZ2V0KElQcm9ncmVzc1NlcnZpY2UpLFxuXHRcdFx0Wy4uLnRoaXMuZ2V0VGVzdEV4dElkc1RvUnVuKGFjY2Vzc29yLCAuLi5hcmdzKV0sXG5cdFx0XHR0ZXN0cyA9PiB0aGlzLnJ1blRlc3QodGVzdFNlcnZpY2UsIHRlc3RzKSxcblx0XHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGdldFRlc3RFeHRJZHNUb1J1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKTogSXRlcmFibGU8c3RyaW5nPjtcblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgcnVuVGVzdChzZXJ2aWNlOiBJVGVzdFNlcnZpY2UsIG5vZGU6IHJlYWRvbmx5IEludGVybmFsVGVzdEl0ZW1bXSk6IFByb21pc2U8SVRlc3RSZXN1bHQ+O1xufVxuXG5hYnN0cmFjdCBjbGFzcyBSdW5PckRlYnVnRmFpbGVkVGVzdHMgZXh0ZW5kcyBSdW5PckRlYnVnRXh0c0J5UGF0aCB7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnM6IElBY3Rpb24yT3B0aW9ucykge1xuXHRcdHN1cGVyKHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IGhhc0FueVRlc3RQcm92aWRlcixcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwcm90ZWN0ZWQgZ2V0VGVzdEV4dElkc1RvUnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgeyByZXN1bHRzIH0gPSBhY2Nlc3Nvci5nZXQoSVRlc3RSZXN1bHRTZXJ2aWNlKTtcblx0XHRjb25zdCBpZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRmb3IgKGxldCBpID0gcmVzdWx0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgcmVzdWx0U2V0ID0gcmVzdWx0c1tpXTtcblx0XHRcdGZvciAoY29uc3QgdGVzdCBvZiByZXN1bHRTZXQudGVzdHMpIHtcblx0XHRcdFx0aWYgKGlzRmFpbGVkU3RhdGUodGVzdC5vd25Db21wdXRlZFN0YXRlKSkge1xuXHRcdFx0XHRcdGlkcy5hZGQodGVzdC5pdGVtLmV4dElkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZHMuZGVsZXRlKHRlc3QuaXRlbS5leHRJZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gaWRzO1xuXHR9XG59XG5cblxuYWJzdHJhY3QgY2xhc3MgUnVuT3JEZWJ1Z0xhc3RSdW4gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3Iob3B0aW9uczogSUFjdGlvbjJPcHRpb25zKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdGhhc0FueVRlc3RQcm92aWRlcixcblx0XHRcdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuaGFzQW55UmVzdWx0cy5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHRcdCksXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGdldEdyb3VwKCk6IFRlc3RSdW5Qcm9maWxlQml0c2V0O1xuXG5cdHByb3RlY3RlZCBnZXRMYXN0VGVzdFJ1blJlcXVlc3QoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJ1bklkPzogc3RyaW5nKSB7XG5cdFx0Y29uc3QgcmVzdWx0U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFJlc3VsdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGxhc3RSZXN1bHQgPSBydW5JZCA/IHJlc3VsdFNlcnZpY2UucmVzdWx0cy5maW5kKHIgPT4gci5pZCA9PT0gcnVuSWQpIDogcmVzdWx0U2VydmljZS5yZXN1bHRzWzBdO1xuXHRcdHJldHVybiBsYXN0UmVzdWx0Py5yZXF1ZXN0O1xuXHR9XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyBvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJ1bklkPzogc3RyaW5nKSB7XG5cdFx0Y29uc3QgcmVzdWx0U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFJlc3VsdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGxhc3RSZXN1bHQgPSBydW5JZCA/IHJlc3VsdFNlcnZpY2UucmVzdWx0cy5maW5kKHIgPT4gci5pZCA9PT0gcnVuSWQpIDogcmVzdWx0U2VydmljZS5yZXN1bHRzWzBdO1xuXHRcdGlmICghbGFzdFJlc3VsdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlcSA9IGxhc3RSZXN1bHQucmVxdWVzdDtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFNlcnZpY2UpO1xuXHRcdGNvbnN0IHByb2ZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXN0UHJvZmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHByb2ZpbGVFeGlzdHMgPSAodDogeyBjb250cm9sbGVySWQ6IHN0cmluZzsgcHJvZmlsZUlkOiBudW1iZXIgfSkgPT5cblx0XHRcdHByb2ZpbGVTZXJ2aWNlLmdldENvbnRyb2xsZXJQcm9maWxlcyh0LmNvbnRyb2xsZXJJZCkuc29tZShwID0+IHAucHJvZmlsZUlkID09PSB0LnByb2ZpbGVJZCk7XG5cblx0XHRhd2FpdCBkaXNjb3ZlckFuZFJ1blRlc3RzKFxuXHRcdFx0dGVzdFNlcnZpY2UuY29sbGVjdGlvbixcblx0XHRcdGFjY2Vzc29yLmdldChJUHJvZ3Jlc3NTZXJ2aWNlKSxcblx0XHRcdHJlcS50YXJnZXRzLmZsYXRNYXAodCA9PiB0LnRlc3RJZHMpLFxuXHRcdFx0dGVzdHMgPT4ge1xuXHRcdFx0XHQvLyBJZiB3ZSdyZSByZXF1ZXN0aW5nIGEgcmUtcnVuIGluIHRoZSBzYW1lIGdyb3VwIGFuZCBoYXZlIHRoZSBzYW1lIHByb2ZpbGVzXG5cdFx0XHRcdC8vIGFzIHdlcmUgdXNlZCBiZWZvcmUsIHRoZW4gdXNlIHRob3NlIGV4YWN0bHkuIE90aGVyd2lzZSBndWVzcyBuYWl2ZWx5LlxuXHRcdFx0XHRpZiAodGhpcy5nZXRHcm91cCgpICYgcmVxLmdyb3VwICYmIHJlcS50YXJnZXRzLmV2ZXJ5KHByb2ZpbGVFeGlzdHMpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRlc3RTZXJ2aWNlLnJ1blJlc29sdmVkVGVzdHMoe1xuXHRcdFx0XHRcdFx0dGFyZ2V0czogcmVxLnRhcmdldHMsXG5cdFx0XHRcdFx0XHRncm91cDogcmVxLmdyb3VwLFxuXHRcdFx0XHRcdFx0ZXhjbHVkZTogcmVxLmV4Y2x1ZGUsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRlc3RTZXJ2aWNlLnJ1blRlc3RzKHsgdGVzdHMsIGdyb3VwOiB0aGlzLmdldEdyb3VwKCkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVSdW5GYWlsZWRUZXN0cyBleHRlbmRzIFJ1bk9yRGVidWdGYWlsZWRUZXN0cyB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlJlUnVuRmFpbGVkVGVzdHMsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLnJlUnVuRmFpbFRlc3RzJywgJ1JlcnVuIEZhaWxlZCBUZXN0cycpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2VtaWNvbG9uLCBLZXlDb2RlLktleUUpLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBydW5UZXN0KHNlcnZpY2U6IElUZXN0U2VydmljZSwgaW50ZXJuYWxUZXN0czogSW50ZXJuYWxUZXN0SXRlbVtdKTogUHJvbWlzZTxJVGVzdFJlc3VsdD4ge1xuXHRcdHJldHVybiBzZXJ2aWNlLnJ1blRlc3RzKHtcblx0XHRcdGdyb3VwOiBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4sXG5cdFx0XHR0ZXN0czogaW50ZXJuYWxUZXN0cyxcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGVidWdGYWlsZWRUZXN0cyBleHRlbmRzIFJ1bk9yRGVidWdGYWlsZWRUZXN0cyB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkRlYnVnRmFpbGVkVGVzdHMsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmRlYnVnRmFpbFRlc3RzJywgJ0RlYnVnIEZhaWxlZCBUZXN0cycpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuU2VtaWNvbG9uLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5RSksXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJ1blRlc3Qoc2VydmljZTogSVRlc3RTZXJ2aWNlLCBpbnRlcm5hbFRlc3RzOiBJbnRlcm5hbFRlc3RJdGVtW10pOiBQcm9taXNlPElUZXN0UmVzdWx0PiB7XG5cdFx0cmV0dXJuIHNlcnZpY2UucnVuVGVzdHMoe1xuXHRcdFx0Z3JvdXA6IFRlc3RSdW5Qcm9maWxlQml0c2V0LkRlYnVnLFxuXHRcdFx0dGVzdHM6IGludGVybmFsVGVzdHMsXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlUnVuTGFzdFJ1biBleHRlbmRzIFJ1bk9yRGVidWdMYXN0UnVuIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuUmVSdW5MYXN0UnVuLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGVzdGluZy5yZVJ1bkxhc3RSdW4nLCAnUmVydW4gTGFzdCBSdW4nKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNlbWljb2xvbiwgS2V5Q29kZS5LZXlMKSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0R3JvdXAoKTogVGVzdFJ1blByb2ZpbGVCaXRzZXQge1xuXHRcdHJldHVybiBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW47XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlYnVnTGFzdFJ1biBleHRlbmRzIFJ1bk9yRGVidWdMYXN0UnVuIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuRGVidWdMYXN0UnVuLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGVzdGluZy5kZWJ1Z0xhc3RSdW4nLCAnRGVidWcgTGFzdCBSdW4nKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNlbWljb2xvbiwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUwpLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRHcm91cCgpOiBUZXN0UnVuUHJvZmlsZUJpdHNldCB7XG5cdFx0cmV0dXJuIFRlc3RSdW5Qcm9maWxlQml0c2V0LkRlYnVnO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb3ZlcmFnZUxhc3RSdW4gZXh0ZW5kcyBSdW5PckRlYnVnTGFzdFJ1biB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLkNvdmVyYWdlTGFzdFJ1bixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcuY292ZXJhZ2VMYXN0UnVuJywgJ1JlcnVuIExhc3QgUnVuIHdpdGggQ292ZXJhZ2UnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNlbWljb2xvbiwgS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUwpLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRHcm91cCgpOiBUZXN0UnVuUHJvZmlsZUJpdHNldCB7XG5cdFx0cmV0dXJuIFRlc3RSdW5Qcm9maWxlQml0c2V0LkNvdmVyYWdlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZWFyY2hGb3JUZXN0RXh0ZW5zaW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlNlYXJjaEZvclRlc3RFeHRlbnNpb24sXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLnNlYXJjaEZvclRlc3RFeHRlbnNpb24nLCAnU2VhcmNoIGZvciBUZXN0IEV4dGVuc2lvbicpLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpLm9wZW5TZWFyY2goJ0BjYXRlZ29yeTpcInRlc3RpbmdcIicpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBPcGVuT3V0cHV0UGVlayBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5PcGVuT3V0cHV0UGVlayxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3Rpbmcub3Blbk91dHB1dFBlZWsnLCAnUGVlayBPdXRwdXQnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNlbWljb2xvbiwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleU0pLFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmhhc0FueVJlc3VsdHMuaXNFcXVhbFRvKHRydWUpLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRhY2Nlc3Nvci5nZXQoSVRlc3RpbmdQZWVrT3BlbmVyKS5vcGVuKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRvZ2dsZUlubGluZVRlc3RPdXRwdXQgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuVG9nZ2xlSW5saW5lVGVzdE91dHB1dCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcudG9nZ2xlSW5saW5lVGVzdE91dHB1dCcsICdUb2dnbGUgSW5saW5lIFRlc3QgT3V0cHV0JyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TZW1pY29sb24sIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlJKSxcblx0XHRcdH0sXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IFRlc3RpbmdDb250ZXh0S2V5cy5oYXNBbnlSZXN1bHRzLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgdGVzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlc3RTZXJ2aWNlKTtcblx0XHR0ZXN0U2VydmljZS5zaG93SW5saW5lT3V0cHV0LnZhbHVlID0gIXRlc3RTZXJ2aWNlLnNob3dJbmxpbmVPdXRwdXQudmFsdWU7XG5cdH1cbn1cblxuY29uc3QgcmVmcmVzaE1lbnVzID0gKHdoZW5Jc1JlZnJlc2hpbmc6IGJvb2xlYW4pOiBJQWN0aW9uMk9wdGlvbnNbJ21lbnUnXSA9PiBbXG5cdHtcblx0XHRpZDogTWVudUlkLlRlc3RJdGVtLFxuXHRcdGdyb3VwOiAnaW5saW5lJyxcblx0XHRvcmRlcjogQWN0aW9uT3JkZXIuUmVmcmVzaCxcblx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuY2FuUmVmcmVzaFRlc3RzLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5pc1JlZnJlc2hpbmdUZXN0cy5pc0VxdWFsVG8od2hlbklzUmVmcmVzaGluZyksXG5cdFx0KSxcblx0fSxcblx0e1xuXHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0b3JkZXI6IEFjdGlvbk9yZGVyLlJlZnJlc2gsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVGVzdGluZy5FeHBsb3JlclZpZXdJZCksXG5cdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuY2FuUmVmcmVzaFRlc3RzLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5pc1JlZnJlc2hpbmdUZXN0cy5pc0VxdWFsVG8od2hlbklzUmVmcmVzaGluZyksXG5cdFx0KSxcblx0fSxcblx0e1xuXHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0d2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmNhblJlZnJlc2hUZXN0cy5pc0VxdWFsVG8odHJ1ZSksXG5cdH0sXG5dO1xuXG5leHBvcnQgY2xhc3MgUmVmcmVzaFRlc3RzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlJlZnJlc2hUZXN0c0FjdGlvbixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcucmVmcmVzaFRlc3RzJywgJ1JlZnJlc2ggVGVzdHMnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ1JlZnJlc2hUZXN0cyxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5TZW1pY29sb24sIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlSKSxcblx0XHRcdFx0d2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmNhblJlZnJlc2hUZXN0cy5pc0VxdWFsVG8odHJ1ZSksXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogcmVmcmVzaE1lbnVzKGZhbHNlKSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmVsZW1lbnRzOiBUZXN0SXRlbVRyZWVFbGVtZW50W10pIHtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVzdFNlcnZpY2UpO1xuXHRcdGNvbnN0IHByb2dyZXNzU2VydmljZSA9IGFjY2Vzc29yLmdldChJUHJvZ3Jlc3NTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbnRyb2xsZXJJZHMgPSBkaXN0aW5jdChlbGVtZW50cy5maWx0ZXIoaXNEZWZpbmVkKS5tYXAoZSA9PiBlLnRlc3QuY29udHJvbGxlcklkKSk7XG5cdFx0cmV0dXJuIHByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoeyBsb2NhdGlvbjogVGVzdGluZy5WaWV3bGV0SWQgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKGNvbnRyb2xsZXJJZHMubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGNvbnRyb2xsZXJJZHMubWFwKGlkID0+IHRlc3RTZXJ2aWNlLnJlZnJlc2hUZXN0cyhpZCkpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRlc3RTZXJ2aWNlLnJlZnJlc2hUZXN0cygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDYW5jZWxUZXN0UmVmcmVzaEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5DYW5jZWxUZXN0UmVmcmVzaEFjdGlvbixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcuY2FuY2VsVGVzdFJlZnJlc2gnLCAnQ2FuY2VsIFRlc3QgUmVmcmVzaCcpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRpY29uOiBpY29ucy50ZXN0aW5nQ2FuY2VsUmVmcmVzaFRlc3RzLFxuXHRcdFx0bWVudTogcmVmcmVzaE1lbnVzKHRydWUpLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGFjY2Vzc29yLmdldChJVGVzdFNlcnZpY2UpLmNhbmNlbFJlZnJlc2hUZXN0cygpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGVhcmVDb3ZlcmFnZSBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5Db3ZlcmFnZUNsZWFyLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGVzdGluZy5jbGVhckNvdmVyYWdlJywgJ0NsZWFyIENvdmVyYWdlJyksXG5cdFx0XHRpY29uOiB3aWRnZXRDbG9zZSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiBBY3Rpb25PcmRlci5SZWZyZXNoLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBUZXN0aW5nLkNvdmVyYWdlVmlld0lkKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBUZXN0aW5nQ29udGV4dEtleXMuaXNUZXN0Q292ZXJhZ2VPcGVuLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0YWNjZXNzb3IuZ2V0KElUZXN0Q292ZXJhZ2VTZXJ2aWNlKS5jbG9zZUNvdmVyYWdlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5Db3ZlcmFnZSBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5PcGVuQ292ZXJhZ2UsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLm9wZW5Db3ZlcmFnZScsICdPcGVuIENvdmVyYWdlJyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IFRlc3RpbmdDb250ZXh0S2V5cy5oYXNBbnlSZXN1bHRzLmlzRXF1YWxUbyh0cnVlKSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgcmVzdWx0cyA9IGFjY2Vzc29yLmdldChJVGVzdFJlc3VsdFNlcnZpY2UpLnJlc3VsdHM7XG5cdFx0Y29uc3QgdGFzayA9IHJlc3VsdHMubGVuZ3RoICYmIHJlc3VsdHNbMF0udGFza3MuZmluZChyID0+IHIuY292ZXJhZ2UpO1xuXHRcdGlmICghdGFzaykge1xuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obG9jYWxpemUoJ3Rlc3Rpbmcubm9Db3ZlcmFnZScsICdObyBjb3ZlcmFnZSBpbmZvcm1hdGlvbiBhdmFpbGFibGUgb24gdGhlIGxhc3QgdGVzdCBydW4uJykpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGFjY2Vzc29yLmdldChJVGVzdENvdmVyYWdlU2VydmljZSkub3BlbkNvdmVyYWdlKHRhc2ssIHRydWUpO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIFRlc3ROYXZpZ2F0aW9uQWN0aW9uIGV4dGVuZHMgU3ltYm9sTmF2aWdhdGlvbkFjdGlvbiB7XG5cdHByb3RlY3RlZCB0ZXN0U2VydmljZSE6IElUZXN0U2VydmljZTsgLy8gbGl0dGxlIGhhY2suLi5cblx0cHJvdGVjdGVkIHVyaUlkZW50aXR5U2VydmljZSE6IElVcmlJZGVudGl0eVNlcnZpY2U7XG5cblx0b3ZlcnJpZGUgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgLi4uYXJnczogYW55W10pIHtcblx0XHR0aGlzLnRlc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXN0U2VydmljZSk7XG5cdFx0dGhpcy51cmlJZGVudGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0cmV0dXJuIHN1cGVyLnJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3IsIGVkaXRvciwgLi4uYXJncyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX2dldEFsdGVybmF0aXZlQ29tbWFuZChlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZ290b0xvY2F0aW9uKS5hbHRlcm5hdGl2ZVRlc3RzQ29tbWFuZDtcblx0fVxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX2dldEdvVG9QcmVmZXJlbmNlKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IpOiBHb1RvTG9jYXRpb25WYWx1ZXMge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5nb3RvTG9jYXRpb24pLm11bHRpcGxlVGVzdHMgfHwgJ3BlZWsnO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIEdvVG9SZWxhdGVkVGVzdEFjdGlvbiBleHRlbmRzIFRlc3ROYXZpZ2F0aW9uQWN0aW9uIHtcblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIF9nZXRMb2NhdGlvbk1vZGVsKF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogdW5rbm93biwgbW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxSZWZlcmVuY2VzTW9kZWwgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB0ZXN0cyA9IGF3YWl0IHRoaXMudGVzdFNlcnZpY2UuZ2V0VGVzdHNSZWxhdGVkVG9Db2RlKG1vZGVsLnVyaSwgcG9zaXRpb24sIHRva2VuKTtcblx0XHRyZXR1cm4gbmV3IFJlZmVyZW5jZXNNb2RlbChcblx0XHRcdHRlc3RzLm1hcCh0ID0+IHQuaXRlbS51cmkgJiYgKHsgdXJpOiB0Lml0ZW0udXJpLCByYW5nZTogdC5pdGVtLnJhbmdlIHx8IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSB9KSkuZmlsdGVyKGlzRGVmaW5lZCksXG5cdFx0XHRsb2NhbGl6ZSgncmVsYXRlZFRlc3RzJywgJ1JlbGF0ZWQgVGVzdHMnKSxcblx0XHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9nZXROb1Jlc3VsdEZvdW5kTWVzc2FnZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnbm9UZXN0Rm91bmQnLCAnTm8gcmVsYXRlZCB0ZXN0cyBmb3VuZC4nKTtcblx0fVxufVxuXG5jbGFzcyBHb1RvUmVsYXRlZFRlc3QgZXh0ZW5kcyBHb1RvUmVsYXRlZFRlc3RBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRvcGVuVG9TaWRlOiBmYWxzZSxcblx0XHRcdG9wZW5JblBlZWs6IGZhbHNlLFxuXHRcdFx0bXV0ZU1lc3NhZ2U6IGZhbHNlXG5cdFx0fSwge1xuXHRcdFx0aWQ6IFRlc3RDb21tYW5kSWQuR29Ub1JlbGF0ZWRUZXN0LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGVzdGluZy5nb1RvUmVsYXRlZFRlc3QnLCAnR28gdG8gUmVsYXRlZCBUZXN0JyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHQvLyB0b2RvQGNvbm5vcjQzMTI6IG1ha2UgdGhpcyBtb3JlIGV4cGxpY2l0IGJhc2VkIG9uIGN1cnNvciBwb3NpdGlvblxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3QoVGVzdGluZ0NvbnRleHRLZXlzLmFjdGl2ZUVkaXRvckhhc1Rlc3RzLmtleSksIFRlc3RpbmdDb250ZXh0S2V5cy5jYW5Hb1RvUmVsYXRlZFRlc3QsXG5cdFx0XHQpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ3Rlc3RpbmcnLFxuXHRcdFx0XHRvcmRlcjogRWRpdG9yQ29udGV4dE9yZGVyLkdvVG9SZWxhdGVkLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBQZWVrUmVsYXRlZFRlc3QgZXh0ZW5kcyBHb1RvUmVsYXRlZFRlc3RBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRvcGVuVG9TaWRlOiBmYWxzZSxcblx0XHRcdG9wZW5JblBlZWs6IHRydWUsXG5cdFx0XHRtdXRlTWVzc2FnZTogZmFsc2Vcblx0XHR9LCB7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5QZWVrUmVsYXRlZFRlc3QsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLnBlZWtUb1JlbGF0ZWRUZXN0JywgJ1BlZWsgUmVsYXRlZCBUZXN0JyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRUZXN0aW5nQ29udGV4dEtleXMuY2FuR29Ub1JlbGF0ZWRUZXN0LFxuXHRcdFx0XHQvLyB0b2RvQGNvbm5vcjQzMTI6IG1ha2UgdGhpcyBtb3JlIGV4cGxpY2l0IGJhc2VkIG9uIGN1cnNvciBwb3NpdGlvblxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3QoVGVzdGluZ0NvbnRleHRLZXlzLmFjdGl2ZUVkaXRvckhhc1Rlc3RzLmtleSksXG5cdFx0XHRcdFBlZWtDb250ZXh0Lm5vdEluUGVla0VkaXRvcixcblx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaXNJbkVtYmVkZGVkRWRpdG9yLnRvTmVnYXRlZCgpXG5cdFx0XHQpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ3Rlc3RpbmcnLFxuXHRcdFx0XHRvcmRlcjogRWRpdG9yQ29udGV4dE9yZGVyLlBlZWtSZWxhdGVkLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBHb1RvUmVsYXRlZENvZGVBY3Rpb24gZXh0ZW5kcyBUZXN0TmF2aWdhdGlvbkFjdGlvbiB7XG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBfZ2V0TG9jYXRpb25Nb2RlbChfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IHVua25vd24sIG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UmVmZXJlbmNlc01vZGVsIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdGVzdHNBdEN1cnNvciA9IGF3YWl0IGdldFRlc3RzQXRDdXJzb3IodGhpcy50ZXN0U2VydmljZSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UsIG1vZGVsLnVyaSwgcG9zaXRpb24pO1xuXHRcdGNvbnN0IGNvZGUgPSBhd2FpdCBQcm9taXNlLmFsbCh0ZXN0c0F0Q3Vyc29yLm1hcCh0ID0+IHRoaXMudGVzdFNlcnZpY2UuZ2V0Q29kZVJlbGF0ZWRUb1Rlc3QodCkpKTtcblx0XHRyZXR1cm4gbmV3IFJlZmVyZW5jZXNNb2RlbChjb2RlLmZsYXQoKSwgbG9jYWxpemUoJ3JlbGF0ZWRDb2RlJywgJ1JlbGF0ZWQgQ29kZScpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfZ2V0Tm9SZXN1bHRGb3VuZE1lc3NhZ2UoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ25vUmVsYXRlZENvZGUnLCAnTm8gcmVsYXRlZCBjb2RlIGZvdW5kLicpO1xuXHR9XG59XG5cbmNsYXNzIEdvVG9SZWxhdGVkQ29kZSBleHRlbmRzIEdvVG9SZWxhdGVkQ29kZUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdG9wZW5Ub1NpZGU6IGZhbHNlLFxuXHRcdFx0b3BlbkluUGVlazogZmFsc2UsXG5cdFx0XHRtdXRlTWVzc2FnZTogZmFsc2Vcblx0XHR9LCB7XG5cdFx0XHRpZDogVGVzdENvbW1hbmRJZC5Hb1RvUmVsYXRlZENvZGUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0ZXN0aW5nLmdvVG9SZWxhdGVkQ29kZScsICdHbyB0byBSZWxhdGVkIENvZGUnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5hY3RpdmVFZGl0b3JIYXNUZXN0cyxcblx0XHRcdFx0VGVzdGluZ0NvbnRleHRLZXlzLmNhbkdvVG9SZWxhdGVkQ29kZSxcblx0XHRcdCksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAndGVzdGluZycsXG5cdFx0XHRcdG9yZGVyOiBFZGl0b3JDb250ZXh0T3JkZXIuR29Ub1JlbGF0ZWQsXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIFBlZWtSZWxhdGVkQ29kZSBleHRlbmRzIEdvVG9SZWxhdGVkQ29kZUFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdG9wZW5Ub1NpZGU6IGZhbHNlLFxuXHRcdFx0b3BlbkluUGVlazogdHJ1ZSxcblx0XHRcdG11dGVNZXNzYWdlOiBmYWxzZVxuXHRcdH0sIHtcblx0XHRcdGlkOiBUZXN0Q29tbWFuZElkLlBlZWtSZWxhdGVkQ29kZSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Rlc3RpbmcucGVla1RvUmVsYXRlZENvZGUnLCAnUGVlayBSZWxhdGVkIENvZGUnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFRlc3RpbmdDb250ZXh0S2V5cy5hY3RpdmVFZGl0b3JIYXNUZXN0cyxcblx0XHRcdFx0VGVzdGluZ0NvbnRleHRLZXlzLmNhbkdvVG9SZWxhdGVkQ29kZSxcblx0XHRcdFx0UGVla0NvbnRleHQubm90SW5QZWVrRWRpdG9yLFxuXHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5pc0luRW1iZWRkZWRFZGl0b3IudG9OZWdhdGVkKClcblx0XHRcdCksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAndGVzdGluZycsXG5cdFx0XHRcdG9yZGVyOiBFZGl0b3JDb250ZXh0T3JkZXIuUGVla1JlbGF0ZWQsXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBhbGxUZXN0QWN0aW9ucyA9IFtcblx0Q2FuY2VsVGVzdFJlZnJlc2hBY3Rpb24sXG5cdENhbmNlbFRlc3RSdW5BY3Rpb24sXG5cdENsZWFyZUNvdmVyYWdlLFxuXHRDbGVhclRlc3RSZXN1bHRzQWN0aW9uLFxuXHRDb2xsYXBzZUFsbEFjdGlvbixcblx0Q29uZmlndXJlVGVzdFByb2ZpbGVzQWN0aW9uLFxuXHRDb250aW51b3VzUnVuVGVzdEFjdGlvbixcblx0Q29udGludW91c1J1blVzaW5nUHJvZmlsZVRlc3RBY3Rpb24sXG5cdENvdmVyYWdlQWN0aW9uLFxuXHRDb3ZlcmFnZUFsbEFjdGlvbixcblx0Q292ZXJhZ2VBdEN1cnNvcixcblx0Q292ZXJhZ2VDdXJyZW50RmlsZSxcblx0Q292ZXJhZ2VMYXN0UnVuLFxuXHRDb3ZlcmFnZVNlbGVjdGVkQWN0aW9uLFxuXHRDb3ZlcmFnZVRlc3RzVW5kZXJVcmksXG5cdERlYnVnQWN0aW9uLFxuXHREZWJ1Z0FsbEFjdGlvbixcblx0RGVidWdBdEN1cnNvcixcblx0RGVidWdDdXJyZW50RmlsZSxcblx0RGVidWdGYWlsZWRUZXN0cyxcblx0RGVidWdMYXN0UnVuLFxuXHREZWJ1Z1NlbGVjdGVkQWN0aW9uLFxuXHREZWJ1Z1Rlc3RzVW5kZXJVcmksXG5cdEdldEV4cGxvcmVyU2VsZWN0aW9uLFxuXHRHZXRTZWxlY3RlZFByb2ZpbGVzLFxuXHRHb1RvUmVsYXRlZENvZGUsXG5cdEdvVG9SZWxhdGVkVGVzdCxcblx0R29Ub1Rlc3QsXG5cdEhpZGVUZXN0QWN0aW9uLFxuXHRPcGVuQ292ZXJhZ2UsXG5cdE9wZW5PdXRwdXRQZWVrLFxuXHRQZWVrUmVsYXRlZENvZGUsXG5cdFBlZWtSZWxhdGVkVGVzdCxcblx0UmVmcmVzaFRlc3RzQWN0aW9uLFxuXHRSZVJ1bkZhaWxlZFRlc3RzLFxuXHRSZVJ1bkxhc3RSdW4sXG5cdFJ1bkFjdGlvbixcblx0UnVuQWxsQWN0aW9uLFxuXHRSdW5BdEN1cnNvcixcblx0UnVuQ3VycmVudEZpbGUsXG5cdFJ1blNlbGVjdGVkQWN0aW9uLFxuXHRSdW5UZXN0c1VuZGVyVXJpLFxuXHRSdW5Vc2luZ1Byb2ZpbGVBY3Rpb24sXG5cdFNlYXJjaEZvclRlc3RFeHRlbnNpb24sXG5cdFNlbGVjdERlZmF1bHRUZXN0UHJvZmlsZXMsXG5cdFNob3dNb3N0UmVjZW50T3V0cHV0QWN0aW9uLFxuXHRTdGFydENvbnRpbnVvdXNSdW5BY3Rpb24sXG5cdFN0b3BDb250aW51b3VzUnVuQWN0aW9uLFxuXHRUZXN0aW5nU29ydEJ5RHVyYXRpb25BY3Rpb24sXG5cdFRlc3RpbmdTb3J0QnlMb2NhdGlvbkFjdGlvbixcblx0VGVzdGluZ1NvcnRCeVN0YXR1c0FjdGlvbixcblx0VGVzdGluZ1ZpZXdBc0xpc3RBY3Rpb24sXG5cdFRlc3RpbmdWaWV3QXNUcmVlQWN0aW9uLFxuXHRUb2dnbGVJbmxpbmVUZXN0T3V0cHV0LFxuXHRVbmhpZGVBbGxUZXN0c0FjdGlvbixcblx0VW5oaWRlVGVzdEFjdGlvbixcbl07XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxVQUFVLFNBQVMsY0FBYztBQUMxQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlCQUFpQjtBQUcxQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLG9CQUF3QztBQUNqRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLGtC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
