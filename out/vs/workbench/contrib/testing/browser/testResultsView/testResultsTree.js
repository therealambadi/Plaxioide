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
import * as dom from "../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Action, Separator } from "../../../../../base/common/actions.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../../base/common/marshallingIds.js";
import { autorun } from "../../../../../base/common/observable.js";
import { count } from "../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isDefined } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { MenuEntryActionViewItem, fillInActionBarActions } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchCompressibleObjectTree } from "../../../../../platform/list/browser/listService.js";
import { IProgressService } from "../../../../../platform/progress/common/progress.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { widgetClose } from "../../../../../platform/theme/common/iconRegistry.js";
import { getTestItemContextOverlay } from "../explorerProjections/testItemContextOverlay.js";
import * as icons from "../icons.js";
import { renderTestMessageAsText } from "../testMessageColorizer.js";
import { MessageSubject, TaskSubject, TestOutputSubject, getMessageArgs, mapFindTestMessage } from "./testResultsSubject.js";
import { TestCommandId, Testing } from "../../common/constants.js";
import { ITestCoverageService } from "../../common/testCoverageService.js";
import { ITestExplorerFilterState } from "../../common/testExplorerFilterState.js";
import { ITestProfileService } from "../../common/testProfileService.js";
import { LiveTestResult, TestResultItemChangeReason, maxCountPriority } from "../../common/testResult.js";
import { ITestResultService } from "../../common/testResultService.js";
import { InternalTestItem, TestMessageType, TestResultState, TestRunProfileBitset, testResultStateToContextValues } from "../../common/testTypes.js";
import { TestingContextKeys } from "../../common/testingContextKeys.js";
import { cmpPriority } from "../../common/testingStates.js";
import { TestUriType, buildTestUri } from "../../common/testingUri.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
class TestResultElement {
  constructor(value) {
    this.value = value;
    this.changeEmitter = new Emitter();
    this.onDidChange = this.changeEmitter.event;
    this.type = "result";
    this.context = this.value.id;
    this.id = this.value.id;
    this.label = this.value.name;
  }
  get icon() {
    return icons.testingStatesToIcons.get(
      this.value.completedAt === void 0 ? TestResultState.Running : maxCountPriority(this.value.counts)
    );
  }
}
const openCoverageLabel = localize("openTestCoverage", "View Test Coverage");
const closeCoverageLabel = localize("closeTestCoverage", "Close Test Coverage");
class CoverageElement {
  constructor(results, task, coverageService) {
    this.results = results;
    this.task = task;
    this.coverageService = coverageService;
    this.type = "coverage";
    this.id = `coverage-${this.results.id}/${this.task.id}`;
    this.onDidChange = Event.fromObservableLight(coverageService.selected);
  }
  get label() {
    return this.isOpen ? closeCoverageLabel : openCoverageLabel;
  }
  get icon() {
    return this.isOpen ? widgetClose : icons.testingCoverageReport;
  }
  get isOpen() {
    return this.coverageService.selected.get()?.fromTaskId === this.task.id;
  }
}
class OlderResultsElement {
  constructor(n) {
    this.n = n;
    this.type = "older";
    this.id = `older-${this.n}`;
    this.onDidChange = Event.None;
    this.label = localize("nOlderResults", "{0} older results", n);
  }
}
class TestCaseElement {
  constructor(results, test, taskIndex) {
    this.results = results;
    this.test = test;
    this.taskIndex = taskIndex;
    this.type = "test";
    this.context = {
      $mid: MarshalledId.TestItemContext,
      tests: [InternalTestItem.serialize(this.test)]
    };
    this.id = `${this.results.id}/${this.test.item.extId}`;
  }
  get onDidChange() {
    if (!(this.results instanceof LiveTestResult)) {
      return Event.None;
    }
    return Event.filter(this.results.onChange, (e) => e.item.item.extId === this.test.item.extId);
  }
  get state() {
    return this.test.tasks[this.taskIndex].state;
  }
  get label() {
    return this.test.item.label;
  }
  get labelWithIcons() {
    return renderLabelWithIcons(this.label);
  }
  get icon() {
    return icons.testingStatesToIcons.get(this.state);
  }
  get outputSubject() {
    return new TestOutputSubject(this.results, this.taskIndex, this.test);
  }
}
class TaskElement {
  constructor(results, task, index) {
    this.results = results;
    this.task = task;
    this.index = index;
    this.changeEmitter = new Emitter();
    this.onDidChange = this.changeEmitter.event;
    this.type = "task";
    this.itemsCache = new CreationCache();
    this.id = `${results.id}/${index}`;
    this.task = results.tasks[index];
    this.context = { resultId: results.id, taskId: this.task.id };
    this.label = this.task.name;
  }
  get icon() {
    return this.results.tasks[this.index].running ? icons.testingStatesToIcons.get(TestResultState.Running) : void 0;
  }
}
class TestMessageElement {
  constructor(result, test, taskIndex, messageIndex) {
    this.result = result;
    this.test = test;
    this.taskIndex = taskIndex;
    this.messageIndex = messageIndex;
    this.type = "message";
    const m = this.message = test.tasks[taskIndex].messages[messageIndex];
    this.location = m.location;
    this.contextValue = m.type === TestMessageType.Error ? m.contextValue : void 0;
    this.uri = buildTestUri({
      type: TestUriType.ResultMessage,
      messageIndex,
      resultId: result.id,
      taskIndex,
      testExtId: test.item.extId
    });
    this.id = this.uri.toString();
    const asPlaintext = renderTestMessageAsText(m.message);
    const lines = count(asPlaintext.trimEnd(), "\n");
    this.label = firstLine(asPlaintext);
    if (lines > 0) {
      this.description = lines > 1 ? localize("messageMoreLinesN", "+ {0} more lines", lines) : localize("messageMoreLines1", "+ 1 more line");
    }
  }
  get onDidChange() {
    if (!(this.result instanceof LiveTestResult)) {
      return Event.None;
    }
    return Event.filter(this.result.onChange, (e) => e.item.item.extId === this.test.item.extId);
  }
  get context() {
    return getMessageArgs(this.test, this.message);
  }
  get outputSubject() {
    return new TestOutputSubject(this.result, this.taskIndex, this.test);
  }
}
let OutputPeekTree = class extends Disposable {
  constructor(container, onDidReveal, options, contextMenuService, results, instantiationService, explorerFilter, coverageService, progressService, telemetryService) {
    super();
    this.contextMenuService = contextMenuService;
    this.disposed = false;
    this.requestReveal = this._register(new Emitter());
    this.onDidRequestReview = this.requestReveal.event;
    this.treeActions = instantiationService.createInstance(TreeActionsProvider, options.showRevealLocationOnMessages, this.requestReveal);
    const diffIdentityProvider = {
      getId(e) {
        return e.id;
      }
    };
    this.tree = this._register(instantiationService.createInstance(
      WorkbenchCompressibleObjectTree,
      "Test Output Peek",
      container,
      {
        getHeight: () => 22,
        getTemplateId: () => TestRunElementRenderer.ID
      },
      [instantiationService.createInstance(TestRunElementRenderer, this.treeActions)],
      {
        compressionEnabled: true,
        hideTwistiesOfChildlessElements: true,
        identityProvider: diffIdentityProvider,
        alwaysConsumeMouseWheel: false,
        sorter: {
          compare(a, b) {
            if (a instanceof TestCaseElement && b instanceof TestCaseElement) {
              return cmpPriority(a.state, b.state);
            }
            return 0;
          }
        },
        accessibilityProvider: {
          getAriaLabel(element) {
            return element.ariaLabel || element.label;
          },
          getWidgetAriaLabel() {
            return localize("testingPeekLabel", "Test Result Messages");
          }
        }
      }
    ));
    const cc = new CreationCache();
    const getTaskChildren = (taskElem) => {
      const { results: results2, index, itemsCache, task } = taskElem;
      const tests = Iterable.filter(results2.tests, (test) => test.tasks[index].state >= TestResultState.Running || test.tasks[index].messages.length > 0);
      let result = Iterable.map(tests, (test) => ({
        element: itemsCache.getOrCreate(test, () => new TestCaseElement(results2, test, index)),
        incompressible: true,
        children: getTestChildren(results2, test, index)
      }));
      if (task.coverage.get()) {
        result = Iterable.concat(
          Iterable.single({
            element: new CoverageElement(results2, task, coverageService),
            collapsible: true,
            incompressible: true
          }),
          result
        );
      }
      return result;
    };
    const getTestChildren = (result, test, taskIndex) => {
      return test.tasks[taskIndex].messages.map(
        (m, messageIndex) => m.type === TestMessageType.Error ? { element: cc.getOrCreate(m, () => new TestMessageElement(result, test, taskIndex, messageIndex)), incompressible: false } : void 0
      ).filter(isDefined);
    };
    const getResultChildren = (result) => {
      return result.tasks.map((task, taskIndex) => {
        const taskElem = cc.getOrCreate(task, () => new TaskElement(result, task, taskIndex));
        return {
          element: taskElem,
          incompressible: false,
          collapsible: true,
          children: getTaskChildren(taskElem)
        };
      });
    };
    const getRootChildren = () => {
      let children = [];
      const older = [];
      for (const result of results.results) {
        if (!children.length && result.tasks.length) {
          children = getResultChildren(result);
        } else if (children) {
          const element = cc.getOrCreate(result, () => new TestResultElement(result));
          older.push({
            element,
            incompressible: true,
            collapsible: true,
            collapsed: this.tree.hasElement(element) ? this.tree.isCollapsed(element) : true,
            children: getResultChildren(result)
          });
        }
      }
      if (!children.length) {
        return older;
      }
      if (older.length) {
        children.push({
          element: new OlderResultsElement(older.length),
          incompressible: true,
          collapsible: true,
          collapsed: true,
          children: older
        });
      }
      return children;
    };
    const taskChildrenToUpdate = /* @__PURE__ */ new Set();
    const taskChildrenUpdate = this._register(new RunOnceScheduler(() => {
      for (const taskNode of taskChildrenToUpdate) {
        if (this.tree.hasElement(taskNode)) {
          this.tree.setChildren(taskNode, getTaskChildren(taskNode), { diffIdentityProvider });
        }
      }
      taskChildrenToUpdate.clear();
    }, 300));
    const queueTaskChildrenUpdate = (taskNode) => {
      taskChildrenToUpdate.add(taskNode);
      if (!taskChildrenUpdate.isScheduled()) {
        taskChildrenUpdate.schedule();
      }
    };
    const attachToResults = (result) => {
      const disposable = new DisposableStore();
      disposable.add(result.onNewTask((i) => {
        this.tree.setChildren(null, getRootChildren(), { diffIdentityProvider });
        if (result.tasks.length === 1) {
          this.requestReveal.fire(new TaskSubject(result, 0));
        }
        const task = result.tasks[i];
        disposable.add(autorun((reader) => {
          task.coverage.read(reader);
          queueTaskChildrenUpdate(cc.get(task));
        }));
      }));
      disposable.add(result.onEndTask((index) => {
        cc.get(result.tasks[index])?.changeEmitter.fire();
      }));
      disposable.add(result.onChange((e) => {
        for (const [index, task] of result.tasks.entries()) {
          const taskNode = cc.get(task);
          if (!this.tree.hasElement(taskNode)) {
            continue;
          }
          const itemNode = taskNode.itemsCache.get(e.item);
          if (itemNode && this.tree.hasElement(itemNode)) {
            if (e.reason === TestResultItemChangeReason.NewMessage && e.message.type === TestMessageType.Error) {
              this.tree.setChildren(itemNode, getTestChildren(result, e.item, index), { diffIdentityProvider });
            }
            return;
          }
          queueTaskChildrenUpdate(taskNode);
        }
      }));
      disposable.add(result.onComplete(() => {
        cc.get(result)?.changeEmitter.fire();
        disposable.dispose();
      }));
    };
    this._register(results.onResultsChanged((e) => {
      if (this.disposed) {
        return;
      }
      if ("completed" in e) {
        cc.get(e.completed)?.changeEmitter.fire();
      } else if ("started" in e) {
        attachToResults(e.started);
      } else {
        this.tree.setChildren(null, getRootChildren(), { diffIdentityProvider });
      }
    }));
    const revealItem = (element, preserveFocus) => {
      this.tree.setFocus([element]);
      this.tree.setSelection([element]);
      if (!preserveFocus) {
        this.tree.domFocus();
      }
    };
    this._register(onDidReveal(async ({ subject, preserveFocus = false }) => {
      if (subject instanceof TaskSubject) {
        const resultItem = this.tree.getNode(null).children.find((c) => {
          if (c.element instanceof TaskElement) {
            return c.element.results.id === subject.result.id && c.element.index === subject.taskIndex;
          }
          if (c.element instanceof TestResultElement) {
            return c.element.id === subject.result.id;
          }
          return false;
        });
        if (resultItem) {
          revealItem(resultItem.element, preserveFocus);
        }
        return;
      }
      const revealElement = subject instanceof TestOutputSubject ? cc.get(subject.task)?.itemsCache.get(subject.test) : cc.get(subject.message);
      if (!revealElement || !this.tree.hasElement(revealElement)) {
        return;
      }
      const parents = [];
      for (let parent = this.tree.getParentElement(revealElement); parent; parent = this.tree.getParentElement(parent)) {
        parents.unshift(parent);
      }
      for (const parent of parents) {
        this.tree.expand(parent);
      }
      if (this.tree.getRelativeTop(revealElement) === null) {
        this.tree.reveal(revealElement, 0.5);
      }
      revealItem(revealElement, preserveFocus);
    }));
    this._register(this.tree.onDidOpen(async (e) => {
      if (e.element instanceof TestMessageElement) {
        this.requestReveal.fire(new MessageSubject(e.element.result, e.element.test, e.element.taskIndex, e.element.messageIndex));
      } else if (e.element instanceof TestCaseElement) {
        const t = e.element;
        const message = mapFindTestMessage(e.element.test, (_t, _m, mesasgeIndex, taskIndex) => new MessageSubject(t.results, t.test, taskIndex, mesasgeIndex));
        this.requestReveal.fire(message || new TestOutputSubject(t.results, 0, t.test));
      } else if (e.element instanceof CoverageElement) {
        const task = e.element.task;
        if (e.element.isOpen) {
          return coverageService.closeCoverage();
        }
        progressService.withProgress(
          { location: options.locationForProgress },
          () => coverageService.openCoverage(task, true)
        );
      }
    }));
    this._register(this.tree.onDidChangeSelection((evt) => {
      for (const element of evt.elements) {
        if (element && "test" in element) {
          explorerFilter.reveal.set(element.test.item.extId, void 0);
          break;
        }
      }
    }));
    this._register(explorerFilter.onDidSelectTestInExplorer((testId) => {
      if (this.tree.getSelection().some((e) => e && "test" in e && e.test.item.extId === testId)) {
        return;
      }
      for (const node of this.tree.getNode(null).children) {
        if (node.element instanceof TaskElement) {
          for (const testNode of node.children) {
            if (testNode.element instanceof TestCaseElement && testNode.element.test.item.extId === testId) {
              this.tree.setSelection([testNode.element]);
              if (this.tree.getRelativeTop(testNode.element) === null) {
                this.tree.reveal(testNode.element, 0.5);
              }
              break;
            }
          }
        }
      }
    }));
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.tree.onDidChangeCollapseState((e) => {
      if (e.node.element instanceof OlderResultsElement && !e.node.collapsed) {
        telemetryService.publicLog2("testing.expandOlderResults");
      }
    }));
    this.tree.setChildren(null, getRootChildren());
    for (const result of results.results) {
      if (!result.completedAt && result instanceof LiveTestResult) {
        attachToResults(result);
      }
    }
  }
  layout(height, width) {
    this.tree.layout(height, width);
  }
  onContextMenu(evt) {
    if (!evt.element) {
      return;
    }
    const actions = this.treeActions.provideActionBar(evt.element);
    this.contextMenuService.showContextMenu({
      getAnchor: () => evt.anchor,
      getActions: () => actions.secondary.length ? [...actions.primary, new Separator(), ...actions.secondary] : actions.primary,
      getActionsContext: () => evt.element?.context
    });
  }
  dispose() {
    super.dispose();
    this.disposed = true;
  }
};
OutputPeekTree = __decorateClass([
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, ITestResultService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ITestExplorerFilterState),
  __decorateParam(7, ITestCoverageService),
  __decorateParam(8, IProgressService),
  __decorateParam(9, ITelemetryService)
], OutputPeekTree);
let TestRunElementRenderer = class {
  constructor(treeActions, instantiationService) {
    this.treeActions = treeActions;
    this.instantiationService = instantiationService;
    this.templateId = TestRunElementRenderer.ID;
  }
  /** @inheritdoc */
  renderCompressedElements(node, _index, templateData) {
    const chain = node.element.elements;
    const lastElement = chain[chain.length - 1];
    if ((lastElement instanceof TaskElement || lastElement instanceof TestMessageElement) && chain.length >= 2) {
      this.doRender(chain[chain.length - 2], templateData, lastElement);
    } else {
      this.doRender(lastElement, templateData);
    }
  }
  /** @inheritdoc */
  renderTemplate(container) {
    const templateDisposable = new DisposableStore();
    container.classList.add("testing-stdtree-container");
    const icon = dom.append(container, dom.$(".state"));
    const label = dom.append(container, dom.$(".label"));
    const actionBar = new ActionBar(container, {
      actionViewItemProvider: (action, options) => action instanceof MenuItemAction ? this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate }) : void 0
    });
    const elementDisposable = new DisposableStore();
    templateDisposable.add(elementDisposable);
    templateDisposable.add(actionBar);
    return {
      icon,
      label,
      actionBar,
      elementDisposable,
      templateDisposable
    };
  }
  /** @inheritdoc */
  renderElement(element, _index, templateData) {
    this.doRender(element.element, templateData);
  }
  /** @inheritdoc */
  disposeTemplate(templateData) {
    templateData.templateDisposable.dispose();
  }
  /** Called to render a new element */
  doRender(element, templateData, subjectElement) {
    templateData.elementDisposable.clear();
    templateData.elementDisposable.add(
      element.onDidChange(() => this.doRender(element, templateData, subjectElement))
    );
    this.doRenderInner(element, templateData, subjectElement);
  }
  /** Called, and may be re-called, to render or re-render an element */
  doRenderInner(element, templateData, subjectElement) {
    let { label, labelWithIcons, description } = element;
    if (subjectElement instanceof TestMessageElement) {
      description = subjectElement.label;
    }
    const descriptionElement = description ? dom.$("span.test-label-description", {}, description) : "";
    if (labelWithIcons) {
      dom.reset(templateData.label, ...labelWithIcons, descriptionElement);
    } else {
      dom.reset(templateData.label, label, descriptionElement);
    }
    const icon = element.icon;
    templateData.icon.className = `computed-state ${icon ? ThemeIcon.asClassName(icon) : ""}`;
    const actions = this.treeActions.provideActionBar(element);
    templateData.actionBar.clear();
    templateData.actionBar.context = element.context;
    templateData.actionBar.push(actions.primary, { icon: true, label: false });
  }
};
TestRunElementRenderer.ID = "testRunElementRenderer";
TestRunElementRenderer = __decorateClass([
  __decorateParam(1, IInstantiationService)
], TestRunElementRenderer);
let TreeActionsProvider = class {
  constructor(showRevealLocationOnMessages, requestReveal, contextKeyService, menuService, commandService, testProfileService, editorService) {
    this.showRevealLocationOnMessages = showRevealLocationOnMessages;
    this.requestReveal = requestReveal;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this.commandService = commandService;
    this.testProfileService = testProfileService;
    this.editorService = editorService;
  }
  provideActionBar(element) {
    const test = element instanceof TestCaseElement ? element.test : void 0;
    const capabilities = test ? this.testProfileService.capabilitiesForTest(test.item) : 0;
    const contextKeys = [
      ["peek", Testing.OutputPeekContributionId],
      [TestingContextKeys.peekItemType.key, element.type]
    ];
    let id = MenuId.TestPeekElement;
    const primary = [];
    const secondary = [];
    if (element instanceof TaskElement) {
      primary.push(new Action(
        "testing.outputPeek.showResultOutput",
        localize("testing.showResultOutput", "Show Result Output"),
        ThemeIcon.asClassName(Codicon.terminal),
        void 0,
        () => this.requestReveal.fire(new TaskSubject(element.results, element.index))
      ));
      if (element.task.running) {
        primary.push(new Action(
          "testing.outputPeek.cancel",
          localize("testing.cancelRun", "Cancel Test Run"),
          ThemeIcon.asClassName(icons.testingCancelIcon),
          void 0,
          () => this.commandService.executeCommand(TestCommandId.CancelTestRunAction, element.results.id, element.task.id)
        ));
      } else {
        primary.push(new Action(
          "testing.outputPeek.rerun",
          localize("testing.reRunLastRun", "Rerun Last Run"),
          ThemeIcon.asClassName(icons.testingRerunIcon),
          void 0,
          () => this.commandService.executeCommand(TestCommandId.ReRunLastRun, element.results.id)
        ));
        primary.push(new Action(
          "testing.outputPeek.debug",
          localize("testing.debugLastRun", "Debug Last Run"),
          ThemeIcon.asClassName(icons.testingDebugIcon),
          void 0,
          () => this.commandService.executeCommand(TestCommandId.DebugLastRun, element.results.id)
        ));
      }
    }
    if (element instanceof TestResultElement) {
      if (element.value.tasks.length === 1) {
        primary.push(new Action(
          "testing.outputPeek.showResultOutput",
          localize("testing.showResultOutput", "Show Result Output"),
          ThemeIcon.asClassName(Codicon.terminal),
          void 0,
          () => this.requestReveal.fire(new TaskSubject(element.value, 0))
        ));
      }
      primary.push(new Action(
        "testing.outputPeek.reRunLastRun",
        localize("testing.reRunTest", "Rerun Test"),
        ThemeIcon.asClassName(icons.testingRunIcon),
        void 0,
        () => this.commandService.executeCommand("testing.reRunLastRun", element.value.id)
      ));
      if (capabilities & TestRunProfileBitset.Debug) {
        primary.push(new Action(
          "testing.outputPeek.debugLastRun",
          localize("testing.debugTest", "Debug Test"),
          ThemeIcon.asClassName(icons.testingDebugIcon),
          void 0,
          () => this.commandService.executeCommand("testing.debugLastRun", element.value.id)
        ));
      }
    }
    if (element instanceof TestCaseElement || element instanceof TestMessageElement) {
      contextKeys.push(
        [TestingContextKeys.testResultOutdated.key, element.test.retired],
        [TestingContextKeys.testResultState.key, testResultStateToContextValues[element.test.ownComputedState]],
        ...getTestItemContextOverlay(element.test, capabilities)
      );
      const extId = element.test.item.extId;
      if (element.test.tasks[element.taskIndex].messages.some((m) => m.type === TestMessageType.Output)) {
        primary.push(new Action(
          "testing.outputPeek.showResultOutput",
          localize("testing.showResultOutput", "Show Result Output"),
          ThemeIcon.asClassName(Codicon.terminal),
          void 0,
          () => this.requestReveal.fire(element.outputSubject)
        ));
      }
      secondary.push(new Action(
        "testing.outputPeek.revealInExplorer",
        localize("testing.revealInExplorer", "Reveal in Test Explorer"),
        ThemeIcon.asClassName(Codicon.listTree),
        void 0,
        () => this.commandService.executeCommand("_revealTestInExplorer", extId)
      ));
      if (capabilities & TestRunProfileBitset.Run) {
        primary.push(new Action(
          "testing.outputPeek.runTest",
          localize("run test", "Run Test"),
          ThemeIcon.asClassName(icons.testingRunIcon),
          void 0,
          () => this.commandService.executeCommand("vscode.runTestsById", TestRunProfileBitset.Run, extId)
        ));
      }
      if (capabilities & TestRunProfileBitset.Debug) {
        primary.push(new Action(
          "testing.outputPeek.debugTest",
          localize("debug test", "Debug Test"),
          ThemeIcon.asClassName(icons.testingDebugIcon),
          void 0,
          () => this.commandService.executeCommand("vscode.runTestsById", TestRunProfileBitset.Debug, extId)
        ));
      }
    }
    if (element instanceof TestMessageElement) {
      id = MenuId.TestMessageContext;
      contextKeys.push([TestingContextKeys.testMessageContext.key, element.contextValue]);
      primary.push(new Action(
        "testing.outputPeek.goToTest",
        localize("testing.goToTest", "Go to Test"),
        ThemeIcon.asClassName(Codicon.goToFile),
        void 0,
        () => this.commandService.executeCommand("vscode.revealTest", element.test.item.extId)
      ));
      if (this.showRevealLocationOnMessages && element.location) {
        primary.push(new Action(
          "testing.outputPeek.goToError",
          localize("testing.goToError", "Go to Error"),
          ThemeIcon.asClassName(Codicon.debugStackframe),
          void 0,
          () => this.editorService.openEditor({
            resource: element.location.uri,
            options: {
              selection: element.location.range,
              preserveFocus: true
            }
          })
        ));
      }
    }
    const contextOverlay = this.contextKeyService.createOverlay(contextKeys);
    const result = { primary, secondary };
    const menu = this.menuService.getMenuActions(id, contextOverlay, { arg: element.context });
    fillInActionBarActions(menu, result, "inline");
    return result;
  }
};
TreeActionsProvider = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IMenuService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, ITestProfileService),
  __decorateParam(6, IEditorService)
], TreeActionsProvider);
class CreationCache {
  constructor() {
    this.v = /* @__PURE__ */ new WeakMap();
  }
  get(key) {
    return this.v.get(key);
  }
  getOrCreate(ref, factory) {
    const existing = this.v.get(ref);
    if (existing) {
      return existing;
    }
    const fresh = factory();
    this.v.set(ref, fresh);
    return fresh;
  }
}
const firstLine = (str) => {
  const index = str.indexOf("\n");
  return index === -1 ? str : str.slice(0, index);
};
export {
  OutputPeekTree
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdFJlc3VsdHNWaWV3L3Rlc3RSZXN1bHRzVHJlZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJQ29tcHJlc3NlZFRyZWVFbGVtZW50LCBJQ29tcHJlc3NlZFRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvY29tcHJlc3NlZE9iamVjdFRyZWVNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvb2JqZWN0VHJlZS5qcyc7XG5pbXBvcnQgeyBJVHJlZUNvbnRleHRNZW51RXZlbnQsIElUcmVlTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgQWN0aW9uLCBJQWN0aW9uLCBTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBGdXp6eVNjb3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGlzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBNZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgZmlsbEluQWN0aW9uQmFyQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoQ29tcHJlc3NpYmxlT2JqZWN0VHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgd2lkZ2V0Q2xvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGdldFRlc3RJdGVtQ29udGV4dE92ZXJsYXkgfSBmcm9tICcuLi9leHBsb3JlclByb2plY3Rpb25zL3Rlc3RJdGVtQ29udGV4dE92ZXJsYXkuanMnO1xuaW1wb3J0ICogYXMgaWNvbnMgZnJvbSAnLi4vaWNvbnMuanMnO1xuaW1wb3J0IHsgcmVuZGVyVGVzdE1lc3NhZ2VBc1RleHQgfSBmcm9tICcuLi90ZXN0TWVzc2FnZUNvbG9yaXplci5qcyc7XG5pbXBvcnQgeyBJbnNwZWN0U3ViamVjdCwgTWVzc2FnZVN1YmplY3QsIFRhc2tTdWJqZWN0LCBUZXN0T3V0cHV0U3ViamVjdCwgZ2V0TWVzc2FnZUFyZ3MsIG1hcEZpbmRUZXN0TWVzc2FnZSB9IGZyb20gJy4vdGVzdFJlc3VsdHNTdWJqZWN0LmpzJztcbmltcG9ydCB7IFRlc3RDb21tYW5kSWQsIFRlc3RpbmcgfSBmcm9tICcuLi8uLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElUZXN0Q292ZXJhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RDb3ZlcmFnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RFeHBsb3JlckZpbHRlclN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RFeHBsb3JlckZpbHRlclN0YXRlLmpzJztcbmltcG9ydCB7IElUZXN0UHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFByb2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXN0UmVzdWx0LCBJVGVzdFJ1blRhc2tSZXN1bHRzLCBMaXZlVGVzdFJlc3VsdCwgVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24sIG1heENvdW50UHJpb3JpdHkgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFJlc3VsdC5qcyc7XG5pbXBvcnQgeyBJVGVzdFJlc3VsdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFJlc3VsdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVJpY2hMb2NhdGlvbiwgSVRlc3RJdGVtQ29udGV4dCwgSVRlc3RNZXNzYWdlLCBJVGVzdE1lc3NhZ2VNZW51QXJncywgSW50ZXJuYWxUZXN0SXRlbSwgVGVzdE1lc3NhZ2VUeXBlLCBUZXN0UmVzdWx0SXRlbSwgVGVzdFJlc3VsdFN0YXRlLCBUZXN0UnVuUHJvZmlsZUJpdHNldCwgdGVzdFJlc3VsdFN0YXRlVG9Db250ZXh0VmFsdWVzIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBUZXN0aW5nQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdGluZ0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGNtcFByaW9yaXR5IH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RpbmdTdGF0ZXMuanMnO1xuaW1wb3J0IHsgVGVzdFVyaVR5cGUsIGJ1aWxkVGVzdFVyaSB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0aW5nVXJpLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcblxuXG5pbnRlcmZhY2UgSVRyZWVFbGVtZW50IHtcblx0dHlwZTogc3RyaW5nO1xuXHRjb250ZXh0OiB1bmtub3duO1xuXHRpZDogc3RyaW5nO1xuXHRsYWJlbDogc3RyaW5nO1xuXHRvbkRpZENoYW5nZTogRXZlbnQ8dm9pZD47XG5cdGxhYmVsV2l0aEljb25zPzogcmVhZG9ubHkgKEhUTUxTcGFuRWxlbWVudCB8IHN0cmluZylbXTtcblx0aWNvbj86IFRoZW1lSWNvbjtcblx0ZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdGFyaWFMYWJlbD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElUcmVlRWxlbWVudCB7XG5cdHR5cGU6IHN0cmluZztcblx0Y29udGV4dDogdW5rbm93bjtcblx0aWQ6IHN0cmluZztcblx0bGFiZWw6IHN0cmluZztcblx0b25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+O1xuXHRsYWJlbFdpdGhJY29ucz86IHJlYWRvbmx5IChIVE1MU3BhbkVsZW1lbnQgfCBzdHJpbmcpW107XG5cdGljb24/OiBUaGVtZUljb247XG5cdGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRhcmlhTGFiZWw/OiBzdHJpbmc7XG59XG5cbmNsYXNzIFRlc3RSZXN1bHRFbGVtZW50IGltcGxlbWVudHMgSVRyZWVFbGVtZW50IHtcblx0cHVibGljIHJlYWRvbmx5IGNoYW5nZUVtaXR0ZXIgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLmNoYW5nZUVtaXR0ZXIuZXZlbnQ7XG5cdHB1YmxpYyByZWFkb25seSB0eXBlID0gJ3Jlc3VsdCc7XG5cdHB1YmxpYyByZWFkb25seSBjb250ZXh0ID0gdGhpcy52YWx1ZS5pZDtcblx0cHVibGljIHJlYWRvbmx5IGlkID0gdGhpcy52YWx1ZS5pZDtcblx0cHVibGljIHJlYWRvbmx5IGxhYmVsID0gdGhpcy52YWx1ZS5uYW1lO1xuXG5cdHB1YmxpYyBnZXQgaWNvbigpIHtcblx0XHRyZXR1cm4gaWNvbnMudGVzdGluZ1N0YXRlc1RvSWNvbnMuZ2V0KFxuXHRcdFx0dGhpcy52YWx1ZS5jb21wbGV0ZWRBdCA9PT0gdW5kZWZpbmVkXG5cdFx0XHRcdD8gVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmdcblx0XHRcdFx0OiBtYXhDb3VudFByaW9yaXR5KHRoaXMudmFsdWUuY291bnRzKVxuXHRcdCk7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgdmFsdWU6IElUZXN0UmVzdWx0KSB7IH1cbn1cblxuY29uc3Qgb3BlbkNvdmVyYWdlTGFiZWwgPSBsb2NhbGl6ZSgnb3BlblRlc3RDb3ZlcmFnZScsICdWaWV3IFRlc3QgQ292ZXJhZ2UnKTtcbmNvbnN0IGNsb3NlQ292ZXJhZ2VMYWJlbCA9IGxvY2FsaXplKCdjbG9zZVRlc3RDb3ZlcmFnZScsICdDbG9zZSBUZXN0IENvdmVyYWdlJyk7XG5cbmNsYXNzIENvdmVyYWdlRWxlbWVudCBpbXBsZW1lbnRzIElUcmVlRWxlbWVudCB7XG5cdHB1YmxpYyByZWFkb25seSB0eXBlID0gJ2NvdmVyYWdlJztcblx0cHVibGljIHJlYWRvbmx5IGNvbnRleHQ6IHVuZGVmaW5lZDtcblx0cHVibGljIHJlYWRvbmx5IGlkID0gYGNvdmVyYWdlLSR7dGhpcy5yZXN1bHRzLmlkfS8ke3RoaXMudGFzay5pZH1gO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+O1xuXG5cdHB1YmxpYyBnZXQgbGFiZWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuaXNPcGVuID8gY2xvc2VDb3ZlcmFnZUxhYmVsIDogb3BlbkNvdmVyYWdlTGFiZWw7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGljb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuaXNPcGVuID8gd2lkZ2V0Q2xvc2UgOiBpY29ucy50ZXN0aW5nQ292ZXJhZ2VSZXBvcnQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzT3BlbigpIHtcblx0XHRyZXR1cm4gdGhpcy5jb3ZlcmFnZVNlcnZpY2Uuc2VsZWN0ZWQuZ2V0KCk/LmZyb21UYXNrSWQgPT09IHRoaXMudGFzay5pZDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVzdWx0czogSVRlc3RSZXN1bHQsXG5cdFx0cHVibGljIHJlYWRvbmx5IHRhc2s6IElUZXN0UnVuVGFza1Jlc3VsdHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb3ZlcmFnZVNlcnZpY2U6IElUZXN0Q292ZXJhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLm9uRGlkQ2hhbmdlID0gRXZlbnQuZnJvbU9ic2VydmFibGVMaWdodChjb3ZlcmFnZVNlcnZpY2Uuc2VsZWN0ZWQpO1xuXHR9XG59XG5cbmNsYXNzIE9sZGVyUmVzdWx0c0VsZW1lbnQgaW1wbGVtZW50cyBJVHJlZUVsZW1lbnQge1xuXHRwdWJsaWMgcmVhZG9ubHkgdHlwZSA9ICdvbGRlcic7XG5cdHB1YmxpYyByZWFkb25seSBjb250ZXh0OiB1bmRlZmluZWQ7XG5cdHB1YmxpYyByZWFkb25seSBpZCA9IGBvbGRlci0ke3RoaXMubn1gO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2UgPSBFdmVudC5Ob25lO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGFiZWw6IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IG46IG51bWJlcikge1xuXHRcdHRoaXMubGFiZWwgPSBsb2NhbGl6ZSgnbk9sZGVyUmVzdWx0cycsICd7MH0gb2xkZXIgcmVzdWx0cycsIG4pO1xuXG5cdH1cbn1cblxuY2xhc3MgVGVzdENhc2VFbGVtZW50IGltcGxlbWVudHMgSVRyZWVFbGVtZW50IHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSAndGVzdCc7XG5cdHB1YmxpYyByZWFkb25seSBjb250ZXh0OiBJVGVzdEl0ZW1Db250ZXh0ID0ge1xuXHRcdCRtaWQ6IE1hcnNoYWxsZWRJZC5UZXN0SXRlbUNvbnRleHQsXG5cdFx0dGVzdHM6IFtJbnRlcm5hbFRlc3RJdGVtLnNlcmlhbGl6ZSh0aGlzLnRlc3QpXSxcblx0fTtcblx0cHVibGljIHJlYWRvbmx5IGlkID0gYCR7dGhpcy5yZXN1bHRzLmlkfS8ke3RoaXMudGVzdC5pdGVtLmV4dElkfWA7XG5cdHB1YmxpYyByZWFkb25seSBkZXNjcmlwdGlvbj86IHN0cmluZztcblxuXHRwdWJsaWMgZ2V0IG9uRGlkQ2hhbmdlKCkge1xuXHRcdGlmICghKHRoaXMucmVzdWx0cyBpbnN0YW5jZW9mIExpdmVUZXN0UmVzdWx0KSkge1xuXHRcdFx0cmV0dXJuIEV2ZW50Lk5vbmU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIEV2ZW50LmZpbHRlcih0aGlzLnJlc3VsdHMub25DaGFuZ2UsIGUgPT4gZS5pdGVtLml0ZW0uZXh0SWQgPT09IHRoaXMudGVzdC5pdGVtLmV4dElkKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgc3RhdGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMudGVzdC50YXNrc1t0aGlzLnRhc2tJbmRleF0uc3RhdGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGxhYmVsKCkge1xuXHRcdHJldHVybiB0aGlzLnRlc3QuaXRlbS5sYWJlbDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbGFiZWxXaXRoSWNvbnMoKSB7XG5cdFx0cmV0dXJuIHJlbmRlckxhYmVsV2l0aEljb25zKHRoaXMubGFiZWwpO1xuXHR9XG5cblx0cHVibGljIGdldCBpY29uKCkge1xuXHRcdHJldHVybiBpY29ucy50ZXN0aW5nU3RhdGVzVG9JY29ucy5nZXQodGhpcy5zdGF0ZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG91dHB1dFN1YmplY3QoKSB7XG5cdFx0cmV0dXJuIG5ldyBUZXN0T3V0cHV0U3ViamVjdCh0aGlzLnJlc3VsdHMsIHRoaXMudGFza0luZGV4LCB0aGlzLnRlc3QpO1xuXHR9XG5cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVzdWx0czogSVRlc3RSZXN1bHQsXG5cdFx0cHVibGljIHJlYWRvbmx5IHRlc3Q6IFRlc3RSZXN1bHRJdGVtLFxuXHRcdHB1YmxpYyByZWFkb25seSB0YXNrSW5kZXg6IG51bWJlcixcblx0KSB7IH1cbn1cblxuY2xhc3MgVGFza0VsZW1lbnQgaW1wbGVtZW50cyBJVHJlZUVsZW1lbnQge1xuXHRwdWJsaWMgcmVhZG9ubHkgY2hhbmdlRW1pdHRlciA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuY2hhbmdlRW1pdHRlci5ldmVudDtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSAndGFzayc7XG5cdHB1YmxpYyByZWFkb25seSBjb250ZXh0OiB7IHJlc3VsdElkOiBzdHJpbmc7IHRhc2tJZDogc3RyaW5nIH07XG5cdHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGFiZWw6IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IGl0ZW1zQ2FjaGUgPSBuZXcgQ3JlYXRpb25DYWNoZTxUZXN0Q2FzZUVsZW1lbnQ+KCk7XG5cblx0cHVibGljIGdldCBpY29uKCkge1xuXHRcdHJldHVybiB0aGlzLnJlc3VsdHMudGFza3NbdGhpcy5pbmRleF0ucnVubmluZyA/IGljb25zLnRlc3RpbmdTdGF0ZXNUb0ljb25zLmdldChUZXN0UmVzdWx0U3RhdGUuUnVubmluZykgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgcmVzdWx0czogSVRlc3RSZXN1bHQsIHB1YmxpYyByZWFkb25seSB0YXNrOiBJVGVzdFJ1blRhc2tSZXN1bHRzLCBwdWJsaWMgcmVhZG9ubHkgaW5kZXg6IG51bWJlcikge1xuXHRcdHRoaXMuaWQgPSBgJHtyZXN1bHRzLmlkfS8ke2luZGV4fWA7XG5cdFx0dGhpcy50YXNrID0gcmVzdWx0cy50YXNrc1tpbmRleF07XG5cdFx0dGhpcy5jb250ZXh0ID0geyByZXN1bHRJZDogcmVzdWx0cy5pZCwgdGFza0lkOiB0aGlzLnRhc2suaWQgfTtcblx0XHR0aGlzLmxhYmVsID0gdGhpcy50YXNrLm5hbWU7XG5cdH1cbn1cblxuY2xhc3MgVGVzdE1lc3NhZ2VFbGVtZW50IGltcGxlbWVudHMgSVRyZWVFbGVtZW50IHtcblx0cHVibGljIHJlYWRvbmx5IHR5cGUgPSAnbWVzc2FnZSc7XG5cdHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xuXHRwdWJsaWMgcmVhZG9ubHkgbGFiZWw6IHN0cmluZztcblx0cHVibGljIHJlYWRvbmx5IHVyaTogVVJJO1xuXHRwdWJsaWMgcmVhZG9ubHkgbG9jYXRpb24/OiBJUmljaExvY2F0aW9uO1xuXHRwdWJsaWMgcmVhZG9ubHkgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdHB1YmxpYyByZWFkb25seSBjb250ZXh0VmFsdWU/OiBzdHJpbmc7XG5cdHB1YmxpYyByZWFkb25seSBtZXNzYWdlOiBJVGVzdE1lc3NhZ2U7XG5cblx0cHVibGljIGdldCBvbkRpZENoYW5nZSgpIHtcblx0XHRpZiAoISh0aGlzLnJlc3VsdCBpbnN0YW5jZW9mIExpdmVUZXN0UmVzdWx0KSkge1xuXHRcdFx0cmV0dXJuIEV2ZW50Lk5vbmU7XG5cdFx0fVxuXG5cdFx0Ly8gcmVyZW5kZXIgd2hlbiB0aGUgdGVzdCBjYXNlIGNoYW5nZXMgc28gaXQgZ2V0cyByZXRpcmVkIGV2ZW50c1xuXHRcdHJldHVybiBFdmVudC5maWx0ZXIodGhpcy5yZXN1bHQub25DaGFuZ2UsIGUgPT4gZS5pdGVtLml0ZW0uZXh0SWQgPT09IHRoaXMudGVzdC5pdGVtLmV4dElkKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgY29udGV4dCgpOiBJVGVzdE1lc3NhZ2VNZW51QXJncyB7XG5cdFx0cmV0dXJuIGdldE1lc3NhZ2VBcmdzKHRoaXMudGVzdCwgdGhpcy5tZXNzYWdlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgb3V0cHV0U3ViamVjdCgpIHtcblx0XHRyZXR1cm4gbmV3IFRlc3RPdXRwdXRTdWJqZWN0KHRoaXMucmVzdWx0LCB0aGlzLnRhc2tJbmRleCwgdGhpcy50ZXN0KTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSByZXN1bHQ6IElUZXN0UmVzdWx0LFxuXHRcdHB1YmxpYyByZWFkb25seSB0ZXN0OiBUZXN0UmVzdWx0SXRlbSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdGFza0luZGV4OiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IG1lc3NhZ2VJbmRleDogbnVtYmVyLFxuXHQpIHtcblx0XHRjb25zdCBtID0gdGhpcy5tZXNzYWdlID0gdGVzdC50YXNrc1t0YXNrSW5kZXhdLm1lc3NhZ2VzW21lc3NhZ2VJbmRleF07XG5cblx0XHR0aGlzLmxvY2F0aW9uID0gbS5sb2NhdGlvbjtcblx0XHR0aGlzLmNvbnRleHRWYWx1ZSA9IG0udHlwZSA9PT0gVGVzdE1lc3NhZ2VUeXBlLkVycm9yID8gbS5jb250ZXh0VmFsdWUgOiB1bmRlZmluZWQ7XG5cdFx0dGhpcy51cmkgPSBidWlsZFRlc3RVcmkoe1xuXHRcdFx0dHlwZTogVGVzdFVyaVR5cGUuUmVzdWx0TWVzc2FnZSxcblx0XHRcdG1lc3NhZ2VJbmRleCxcblx0XHRcdHJlc3VsdElkOiByZXN1bHQuaWQsXG5cdFx0XHR0YXNrSW5kZXgsXG5cdFx0XHR0ZXN0RXh0SWQ6IHRlc3QuaXRlbS5leHRJZFxuXHRcdH0pO1xuXG5cdFx0dGhpcy5pZCA9IHRoaXMudXJpLnRvU3RyaW5nKCk7XG5cblx0XHRjb25zdCBhc1BsYWludGV4dCA9IHJlbmRlclRlc3RNZXNzYWdlQXNUZXh0KG0ubWVzc2FnZSk7XG5cdFx0Y29uc3QgbGluZXMgPSBjb3VudChhc1BsYWludGV4dC50cmltRW5kKCksICdcXG4nKTtcblx0XHR0aGlzLmxhYmVsID0gZmlyc3RMaW5lKGFzUGxhaW50ZXh0KTtcblx0XHRpZiAobGluZXMgPiAwKSB7XG5cdFx0XHR0aGlzLmRlc2NyaXB0aW9uID0gbGluZXMgPiAxXG5cdFx0XHRcdD8gbG9jYWxpemUoJ21lc3NhZ2VNb3JlTGluZXNOJywgJysgezB9IG1vcmUgbGluZXMnLCBsaW5lcylcblx0XHRcdFx0OiBsb2NhbGl6ZSgnbWVzc2FnZU1vcmVMaW5lczEnLCAnKyAxIG1vcmUgbGluZScpO1xuXHRcdH1cblx0fVxufVxuXG50eXBlIFRyZWVFbGVtZW50ID0gVGVzdFJlc3VsdEVsZW1lbnQgfCBUZXN0Q2FzZUVsZW1lbnQgfCBUZXN0TWVzc2FnZUVsZW1lbnQgfCBUYXNrRWxlbWVudCB8IENvdmVyYWdlRWxlbWVudCB8IE9sZGVyUmVzdWx0c0VsZW1lbnQ7XG5cbmV4cG9ydCBjbGFzcyBPdXRwdXRQZWVrVHJlZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIGRpc3Bvc2VkID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgdHJlZTogV29ya2JlbmNoQ29tcHJlc3NpYmxlT2JqZWN0VHJlZTxUcmVlRWxlbWVudCwgRnV6enlTY29yZT47XG5cdHByaXZhdGUgcmVhZG9ubHkgdHJlZUFjdGlvbnM6IFRyZWVBY3Rpb25zUHJvdmlkZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdFJldmVhbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPEluc3BlY3RTdWJqZWN0PigpKTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRSZXF1ZXN0UmV2aWV3ID0gdGhpcy5yZXF1ZXN0UmV2ZWFsLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0b25EaWRSZXZlYWw6IEV2ZW50PHsgc3ViamVjdDogSW5zcGVjdFN1YmplY3Q7IHByZXNlcnZlRm9jdXM6IGJvb2xlYW4gfT4sXG5cdFx0b3B0aW9uczogeyBzaG93UmV2ZWFsTG9jYXRpb25Pbk1lc3NhZ2VzOiBib29sZWFuOyBsb2NhdGlvbkZvclByb2dyZXNzOiBzdHJpbmcgfSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASVRlc3RSZXN1bHRTZXJ2aWNlIHJlc3VsdHM6IElUZXN0UmVzdWx0U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZSBleHBsb3JlckZpbHRlcjogSVRlc3RFeHBsb3JlckZpbHRlclN0YXRlLFxuXHRcdEBJVGVzdENvdmVyYWdlU2VydmljZSBjb3ZlcmFnZVNlcnZpY2U6IElUZXN0Q292ZXJhZ2VTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnRyZWVBY3Rpb25zID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJlZUFjdGlvbnNQcm92aWRlciwgb3B0aW9ucy5zaG93UmV2ZWFsTG9jYXRpb25Pbk1lc3NhZ2VzLCB0aGlzLnJlcXVlc3RSZXZlYWwsKTtcblx0XHRjb25zdCBkaWZmSWRlbnRpdHlQcm92aWRlcjogSUlkZW50aXR5UHJvdmlkZXI8VHJlZUVsZW1lbnQ+ID0ge1xuXHRcdFx0Z2V0SWQoZTogVHJlZUVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuIGUuaWQ7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMudHJlZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0V29ya2JlbmNoQ29tcHJlc3NpYmxlT2JqZWN0VHJlZSxcblx0XHRcdCdUZXN0IE91dHB1dCBQZWVrJyxcblx0XHRcdGNvbnRhaW5lcixcblx0XHRcdHtcblx0XHRcdFx0Z2V0SGVpZ2h0OiAoKSA9PiAyMixcblx0XHRcdFx0Z2V0VGVtcGxhdGVJZDogKCkgPT4gVGVzdFJ1bkVsZW1lbnRSZW5kZXJlci5JRCxcblx0XHRcdH0sXG5cdFx0XHRbaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFJ1bkVsZW1lbnRSZW5kZXJlciwgdGhpcy50cmVlQWN0aW9ucyldLFxuXHRcdFx0e1xuXHRcdFx0XHRjb21wcmVzc2lvbkVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdGhpZGVUd2lzdGllc09mQ2hpbGRsZXNzRWxlbWVudHM6IHRydWUsXG5cdFx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IGRpZmZJZGVudGl0eVByb3ZpZGVyLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0XHRcdHNvcnRlcjoge1xuXHRcdFx0XHRcdGNvbXBhcmUoYSwgYikge1xuXHRcdFx0XHRcdFx0aWYgKGEgaW5zdGFuY2VvZiBUZXN0Q2FzZUVsZW1lbnQgJiYgYiBpbnN0YW5jZW9mIFRlc3RDYXNlRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gY21wUHJpb3JpdHkoYS5zdGF0ZSwgYi5zdGF0ZSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldEFyaWFMYWJlbChlbGVtZW50OiBJVHJlZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBlbGVtZW50LmFyaWFMYWJlbCB8fCBlbGVtZW50LmxhYmVsO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0ZXN0aW5nUGVla0xhYmVsJywgJ1Rlc3QgUmVzdWx0IE1lc3NhZ2VzJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdCkpIGFzIFdvcmtiZW5jaENvbXByZXNzaWJsZU9iamVjdFRyZWU8VHJlZUVsZW1lbnQsIEZ1enp5U2NvcmU+O1xuXG5cdFx0Y29uc3QgY2MgPSBuZXcgQ3JlYXRpb25DYWNoZTxUcmVlRWxlbWVudD4oKTtcblxuXHRcdGNvbnN0IGdldFRhc2tDaGlsZHJlbiA9ICh0YXNrRWxlbTogVGFza0VsZW1lbnQpOiBJdGVyYWJsZTxJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFRyZWVFbGVtZW50Pj4gPT4ge1xuXHRcdFx0Y29uc3QgeyByZXN1bHRzLCBpbmRleCwgaXRlbXNDYWNoZSwgdGFzayB9ID0gdGFza0VsZW07XG5cdFx0XHRjb25zdCB0ZXN0cyA9IEl0ZXJhYmxlLmZpbHRlcihyZXN1bHRzLnRlc3RzLCB0ZXN0ID0+IHRlc3QudGFza3NbaW5kZXhdLnN0YXRlID49IFRlc3RSZXN1bHRTdGF0ZS5SdW5uaW5nIHx8IHRlc3QudGFza3NbaW5kZXhdLm1lc3NhZ2VzLmxlbmd0aCA+IDApO1xuXHRcdFx0bGV0IHJlc3VsdDogSXRlcmFibGU8SUNvbXByZXNzZWRUcmVlRWxlbWVudDxUcmVlRWxlbWVudD4+ID0gSXRlcmFibGUubWFwKHRlc3RzLCB0ZXN0ID0+ICh7XG5cdFx0XHRcdGVsZW1lbnQ6IGl0ZW1zQ2FjaGUuZ2V0T3JDcmVhdGUodGVzdCwgKCkgPT4gbmV3IFRlc3RDYXNlRWxlbWVudChyZXN1bHRzLCB0ZXN0LCBpbmRleCkpLFxuXHRcdFx0XHRpbmNvbXByZXNzaWJsZTogdHJ1ZSxcblx0XHRcdFx0Y2hpbGRyZW46IGdldFRlc3RDaGlsZHJlbihyZXN1bHRzLCB0ZXN0LCBpbmRleCksXG5cdFx0XHR9KSk7XG5cblx0XHRcdGlmICh0YXNrLmNvdmVyYWdlLmdldCgpKSB7XG5cdFx0XHRcdHJlc3VsdCA9IEl0ZXJhYmxlLmNvbmNhdChcblx0XHRcdFx0XHRJdGVyYWJsZS5zaW5nbGU8SUNvbXByZXNzZWRUcmVlRWxlbWVudDxUcmVlRWxlbWVudD4+KHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IG5ldyBDb3ZlcmFnZUVsZW1lbnQocmVzdWx0cywgdGFzaywgY292ZXJhZ2VTZXJ2aWNlKSxcblx0XHRcdFx0XHRcdGNvbGxhcHNpYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0aW5jb21wcmVzc2libGU6IHRydWUsXG5cdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0cmVzdWx0LFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH07XG5cblx0XHRjb25zdCBnZXRUZXN0Q2hpbGRyZW4gPSAocmVzdWx0OiBJVGVzdFJlc3VsdCwgdGVzdDogVGVzdFJlc3VsdEl0ZW0sIHRhc2tJbmRleDogbnVtYmVyKTogSXRlcmFibGU8SUNvbXByZXNzZWRUcmVlRWxlbWVudDxUcmVlRWxlbWVudD4+ID0+IHtcblx0XHRcdHJldHVybiB0ZXN0LnRhc2tzW3Rhc2tJbmRleF0ubWVzc2FnZXNcblx0XHRcdFx0Lm1hcCgobSwgbWVzc2FnZUluZGV4KSA9PlxuXHRcdFx0XHRcdG0udHlwZSA9PT0gVGVzdE1lc3NhZ2VUeXBlLkVycm9yXG5cdFx0XHRcdFx0XHQ/IHsgZWxlbWVudDogY2MuZ2V0T3JDcmVhdGUobSwgKCkgPT4gbmV3IFRlc3RNZXNzYWdlRWxlbWVudChyZXN1bHQsIHRlc3QsIHRhc2tJbmRleCwgbWVzc2FnZUluZGV4KSksIGluY29tcHJlc3NpYmxlOiBmYWxzZSB9XG5cdFx0XHRcdFx0XHQ6IHVuZGVmaW5lZFxuXHRcdFx0XHQpXG5cdFx0XHRcdC5maWx0ZXIoaXNEZWZpbmVkKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgZ2V0UmVzdWx0Q2hpbGRyZW4gPSAocmVzdWx0OiBJVGVzdFJlc3VsdCk6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VHJlZUVsZW1lbnQ+W10gPT4ge1xuXHRcdFx0cmV0dXJuIHJlc3VsdC50YXNrcy5tYXAoKHRhc2ssIHRhc2tJbmRleCkgPT4ge1xuXHRcdFx0XHRjb25zdCB0YXNrRWxlbSA9IGNjLmdldE9yQ3JlYXRlKHRhc2ssICgpID0+IG5ldyBUYXNrRWxlbWVudChyZXN1bHQsIHRhc2ssIHRhc2tJbmRleCkpO1xuXHRcdFx0XHRyZXR1cm4gKHtcblx0XHRcdFx0XHRlbGVtZW50OiB0YXNrRWxlbSxcblx0XHRcdFx0XHRpbmNvbXByZXNzaWJsZTogZmFsc2UsXG5cdFx0XHRcdFx0Y29sbGFwc2libGU6IHRydWUsXG5cdFx0XHRcdFx0Y2hpbGRyZW46IGdldFRhc2tDaGlsZHJlbih0YXNrRWxlbSksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGdldFJvb3RDaGlsZHJlbiA9ICgpOiBJdGVyYWJsZTxJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFRyZWVFbGVtZW50Pj4gPT4ge1xuXHRcdFx0bGV0IGNoaWxkcmVuOiBJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFRyZWVFbGVtZW50PltdID0gW107XG5cblx0XHRcdGNvbnN0IG9sZGVyID0gW107XG5cblx0XHRcdGZvciAoY29uc3QgcmVzdWx0IG9mIHJlc3VsdHMucmVzdWx0cykge1xuXHRcdFx0XHRpZiAoIWNoaWxkcmVuLmxlbmd0aCAmJiByZXN1bHQudGFza3MubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y2hpbGRyZW4gPSBnZXRSZXN1bHRDaGlsZHJlbihyZXN1bHQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWxlbWVudCA9IGNjLmdldE9yQ3JlYXRlKHJlc3VsdCwgKCkgPT4gbmV3IFRlc3RSZXN1bHRFbGVtZW50KHJlc3VsdCkpO1xuXHRcdFx0XHRcdG9sZGVyLnB1c2goe1xuXHRcdFx0XHRcdFx0ZWxlbWVudCxcblx0XHRcdFx0XHRcdGluY29tcHJlc3NpYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0Y29sbGFwc2libGU6IHRydWUsXG5cdFx0XHRcdFx0XHRjb2xsYXBzZWQ6IHRoaXMudHJlZS5oYXNFbGVtZW50KGVsZW1lbnQpID8gdGhpcy50cmVlLmlzQ29sbGFwc2VkKGVsZW1lbnQpIDogdHJ1ZSxcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiBnZXRSZXN1bHRDaGlsZHJlbihyZXN1bHQpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFjaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIG9sZGVyO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob2xkZXIubGVuZ3RoKSB7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2goe1xuXHRcdFx0XHRcdGVsZW1lbnQ6IG5ldyBPbGRlclJlc3VsdHNFbGVtZW50KG9sZGVyLmxlbmd0aCksXG5cdFx0XHRcdFx0aW5jb21wcmVzc2libGU6IHRydWUsXG5cdFx0XHRcdFx0Y29sbGFwc2libGU6IHRydWUsXG5cdFx0XHRcdFx0Y29sbGFwc2VkOiB0cnVlLFxuXHRcdFx0XHRcdGNoaWxkcmVuOiBvbGRlcixcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjaGlsZHJlbjtcblx0XHR9O1xuXG5cdFx0Ly8gUXVldWVkIHJlc3VsdCB1cGRhdGVzIHRvIHByZXZlbnQgc3BhbW1pbmcgQ1BVIHdoZW4gbG90cyBvZiB0ZXN0cyBhcmVcblx0XHQvLyBjb21wbGV0aW5nIGFuZCBtZXNzYWdpbmcgcXVpY2tseSAoIzE0MjUxNClcblx0XHRjb25zdCB0YXNrQ2hpbGRyZW5Ub1VwZGF0ZSA9IG5ldyBTZXQ8VGFza0VsZW1lbnQ+KCk7XG5cdFx0Y29uc3QgdGFza0NoaWxkcmVuVXBkYXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCB0YXNrTm9kZSBvZiB0YXNrQ2hpbGRyZW5Ub1VwZGF0ZSkge1xuXHRcdFx0XHRpZiAodGhpcy50cmVlLmhhc0VsZW1lbnQodGFza05vZGUpKSB7XG5cdFx0XHRcdFx0dGhpcy50cmVlLnNldENoaWxkcmVuKHRhc2tOb2RlLCBnZXRUYXNrQ2hpbGRyZW4odGFza05vZGUpLCB7IGRpZmZJZGVudGl0eVByb3ZpZGVyIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0YXNrQ2hpbGRyZW5Ub1VwZGF0ZS5jbGVhcigpO1xuXHRcdH0sIDMwMCkpO1xuXG5cdFx0Y29uc3QgcXVldWVUYXNrQ2hpbGRyZW5VcGRhdGUgPSAodGFza05vZGU6IFRhc2tFbGVtZW50KSA9PiB7XG5cdFx0XHR0YXNrQ2hpbGRyZW5Ub1VwZGF0ZS5hZGQodGFza05vZGUpO1xuXHRcdFx0aWYgKCF0YXNrQ2hpbGRyZW5VcGRhdGUuaXNTY2hlZHVsZWQoKSkge1xuXHRcdFx0XHR0YXNrQ2hpbGRyZW5VcGRhdGUuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgYXR0YWNoVG9SZXN1bHRzID0gKHJlc3VsdDogTGl2ZVRlc3RSZXN1bHQpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRkaXNwb3NhYmxlLmFkZChyZXN1bHQub25OZXdUYXNrKGkgPT4ge1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0Q2hpbGRyZW4obnVsbCwgZ2V0Um9vdENoaWxkcmVuKCksIHsgZGlmZklkZW50aXR5UHJvdmlkZXIgfSk7XG5cblx0XHRcdFx0aWYgKHJlc3VsdC50YXNrcy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHR0aGlzLnJlcXVlc3RSZXZlYWwuZmlyZShuZXcgVGFza1N1YmplY3QocmVzdWx0LCAwKSk7IC8vIHJldmVhbCB0aGUgZmlyc3QgdGFzayBpbiBuZXcgcnVuc1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gbm90ZTogdGFza3MgYXJlIGJvdW5kZWQgYW5kIHRoZWlyIGxpZmV0aW1lIGlzIGVxdWl2YWxlbnQgdG8gdGhhdCBvZlxuXHRcdFx0XHQvLyB0aGUgdGVzdCByZXN1bHQsIHNvIHRoaXMgZG9lc24ndCBsZWFrIGluZGVmaW5pdGVseS5cblx0XHRcdFx0Y29uc3QgdGFzayA9IHJlc3VsdC50YXNrc1tpXTtcblx0XHRcdFx0ZGlzcG9zYWJsZS5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRcdHRhc2suY292ZXJhZ2UucmVhZChyZWFkZXIpOyAvLyBhZGQgaXQgdG8gdGhlIGF1dG9ydW5cblx0XHRcdFx0XHRxdWV1ZVRhc2tDaGlsZHJlblVwZGF0ZShjYy5nZXQodGFzaykgYXMgVGFza0VsZW1lbnQpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRpc3Bvc2FibGUuYWRkKHJlc3VsdC5vbkVuZFRhc2soaW5kZXggPT4ge1xuXHRcdFx0XHQoY2MuZ2V0KHJlc3VsdC50YXNrc1tpbmRleF0pIGFzIFRhc2tFbGVtZW50IHwgdW5kZWZpbmVkKT8uY2hhbmdlRW1pdHRlci5maXJlKCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRpc3Bvc2FibGUuYWRkKHJlc3VsdC5vbkNoYW5nZShlID0+IHtcblx0XHRcdFx0Ly8gdHJ5IHVwZGF0aW5nIHRoZSBpdGVtIGluIGVhY2ggb2YgaXRzIHRhc2tzXG5cdFx0XHRcdGZvciAoY29uc3QgW2luZGV4LCB0YXNrXSBvZiByZXN1bHQudGFza3MuZW50cmllcygpKSB7XG5cdFx0XHRcdFx0Y29uc3QgdGFza05vZGUgPSBjYy5nZXQodGFzaykgYXMgVGFza0VsZW1lbnQ7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLnRyZWUuaGFzRWxlbWVudCh0YXNrTm9kZSkpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGl0ZW1Ob2RlID0gdGFza05vZGUuaXRlbXNDYWNoZS5nZXQoZS5pdGVtKTtcblx0XHRcdFx0XHRpZiAoaXRlbU5vZGUgJiYgdGhpcy50cmVlLmhhc0VsZW1lbnQoaXRlbU5vZGUpKSB7XG5cdFx0XHRcdFx0XHRpZiAoZS5yZWFzb24gPT09IFRlc3RSZXN1bHRJdGVtQ2hhbmdlUmVhc29uLk5ld01lc3NhZ2UgJiYgZS5tZXNzYWdlLnR5cGUgPT09IFRlc3RNZXNzYWdlVHlwZS5FcnJvcikge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnRyZWUuc2V0Q2hpbGRyZW4oaXRlbU5vZGUsIGdldFRlc3RDaGlsZHJlbihyZXN1bHQsIGUuaXRlbSwgaW5kZXgpLCB7IGRpZmZJZGVudGl0eVByb3ZpZGVyIH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHF1ZXVlVGFza0NoaWxkcmVuVXBkYXRlKHRhc2tOb2RlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRkaXNwb3NhYmxlLmFkZChyZXN1bHQub25Db21wbGV0ZSgoKSA9PiB7XG5cdFx0XHRcdChjYy5nZXQocmVzdWx0KSBhcyBUZXN0UmVzdWx0RWxlbWVudCB8IHVuZGVmaW5lZCk/LmNoYW5nZUVtaXR0ZXIuZmlyZSgpO1xuXHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdH0pKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVzdWx0cy5vblJlc3VsdHNDaGFuZ2VkKGUgPT4ge1xuXHRcdFx0Ly8gbGl0dGxlIGhhY2sgaGVyZTogYSByZXN1bHQgY2hhbmdlIGNhbiBjYXVzZSB0aGUgcGVlayB0byBiZSBkaXNwb3NlZCxcblx0XHRcdC8vIGJ1dCB0aGlzIGxpc3RlbmVyIHdpbGwgc3RpbGwgYmUgcXVldWVkLiBEb2luZyBzdHVmZiB3aXRoIHRoZSB0cmVlXG5cdFx0XHQvLyB3aWxsIGNhdXNlIGVycm9ycy5cblx0XHRcdGlmICh0aGlzLmRpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCdjb21wbGV0ZWQnIGluIGUpIHtcblx0XHRcdFx0KGNjLmdldChlLmNvbXBsZXRlZCkgYXMgVGVzdFJlc3VsdEVsZW1lbnQgfCB1bmRlZmluZWQpPy5jaGFuZ2VFbWl0dGVyLmZpcmUoKTtcblx0XHRcdH0gZWxzZSBpZiAoJ3N0YXJ0ZWQnIGluIGUpIHtcblx0XHRcdFx0YXR0YWNoVG9SZXN1bHRzKGUuc3RhcnRlZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0Q2hpbGRyZW4obnVsbCwgZ2V0Um9vdENoaWxkcmVuKCksIHsgZGlmZklkZW50aXR5UHJvdmlkZXIgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgcmV2ZWFsSXRlbSA9IChlbGVtZW50OiBUcmVlRWxlbWVudCwgcHJlc2VydmVGb2N1czogYm9vbGVhbikgPT4ge1xuXHRcdFx0dGhpcy50cmVlLnNldEZvY3VzKFtlbGVtZW50XSk7XG5cdFx0XHR0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtlbGVtZW50XSk7XG5cdFx0XHRpZiAoIXByZXNlcnZlRm9jdXMpIHtcblx0XHRcdFx0dGhpcy50cmVlLmRvbUZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKG9uRGlkUmV2ZWFsKGFzeW5jICh7IHN1YmplY3QsIHByZXNlcnZlRm9jdXMgPSBmYWxzZSB9KSA9PiB7XG5cdFx0XHRpZiAoc3ViamVjdCBpbnN0YW5jZW9mIFRhc2tTdWJqZWN0KSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdEl0ZW0gPSB0aGlzLnRyZWUuZ2V0Tm9kZShudWxsKS5jaGlsZHJlbi5maW5kKGMgPT4ge1xuXHRcdFx0XHRcdGlmIChjLmVsZW1lbnQgaW5zdGFuY2VvZiBUYXNrRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGMuZWxlbWVudC5yZXN1bHRzLmlkID09PSBzdWJqZWN0LnJlc3VsdC5pZCAmJiBjLmVsZW1lbnQuaW5kZXggPT09IHN1YmplY3QudGFza0luZGV4O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoYy5lbGVtZW50IGluc3RhbmNlb2YgVGVzdFJlc3VsdEVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBjLmVsZW1lbnQuaWQgPT09IHN1YmplY3QucmVzdWx0LmlkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChyZXN1bHRJdGVtKSB7XG5cdFx0XHRcdFx0cmV2ZWFsSXRlbShyZXN1bHRJdGVtLmVsZW1lbnQhLCBwcmVzZXJ2ZUZvY3VzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJldmVhbEVsZW1lbnQgPSBzdWJqZWN0IGluc3RhbmNlb2YgVGVzdE91dHB1dFN1YmplY3Rcblx0XHRcdFx0PyBjYy5nZXQ8VGFza0VsZW1lbnQ+KHN1YmplY3QudGFzayk/Lml0ZW1zQ2FjaGUuZ2V0KHN1YmplY3QudGVzdClcblx0XHRcdFx0OiBjYy5nZXQoc3ViamVjdC5tZXNzYWdlKTtcblx0XHRcdGlmICghcmV2ZWFsRWxlbWVudCB8fCAhdGhpcy50cmVlLmhhc0VsZW1lbnQocmV2ZWFsRWxlbWVudCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwYXJlbnRzOiBUcmVlRWxlbWVudFtdID0gW107XG5cdFx0XHRmb3IgKGxldCBwYXJlbnQgPSB0aGlzLnRyZWUuZ2V0UGFyZW50RWxlbWVudChyZXZlYWxFbGVtZW50KTsgcGFyZW50OyBwYXJlbnQgPSB0aGlzLnRyZWUuZ2V0UGFyZW50RWxlbWVudChwYXJlbnQpKSB7XG5cdFx0XHRcdHBhcmVudHMudW5zaGlmdChwYXJlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IHBhcmVudCBvZiBwYXJlbnRzKSB7XG5cdFx0XHRcdHRoaXMudHJlZS5leHBhbmQocGFyZW50KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMudHJlZS5nZXRSZWxhdGl2ZVRvcChyZXZlYWxFbGVtZW50KSA9PT0gbnVsbCkge1xuXHRcdFx0XHR0aGlzLnRyZWUucmV2ZWFsKHJldmVhbEVsZW1lbnQsIDAuNSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldmVhbEl0ZW0ocmV2ZWFsRWxlbWVudCwgcHJlc2VydmVGb2N1cyk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uRGlkT3Blbihhc3luYyBlID0+IHtcblx0XHRcdGlmIChlLmVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0TWVzc2FnZUVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5yZXF1ZXN0UmV2ZWFsLmZpcmUobmV3IE1lc3NhZ2VTdWJqZWN0KGUuZWxlbWVudC5yZXN1bHQsIGUuZWxlbWVudC50ZXN0LCBlLmVsZW1lbnQudGFza0luZGV4LCBlLmVsZW1lbnQubWVzc2FnZUluZGV4KSk7XG5cdFx0XHR9IGVsc2UgaWYgKGUuZWxlbWVudCBpbnN0YW5jZW9mIFRlc3RDYXNlRWxlbWVudCkge1xuXHRcdFx0XHRjb25zdCB0ID0gZS5lbGVtZW50O1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gbWFwRmluZFRlc3RNZXNzYWdlKGUuZWxlbWVudC50ZXN0LCAoX3QsIF9tLCBtZXNhc2dlSW5kZXgsIHRhc2tJbmRleCkgPT5cblx0XHRcdFx0XHRuZXcgTWVzc2FnZVN1YmplY3QodC5yZXN1bHRzLCB0LnRlc3QsIHRhc2tJbmRleCwgbWVzYXNnZUluZGV4KSk7XG5cdFx0XHRcdHRoaXMucmVxdWVzdFJldmVhbC5maXJlKG1lc3NhZ2UgfHwgbmV3IFRlc3RPdXRwdXRTdWJqZWN0KHQucmVzdWx0cywgMCwgdC50ZXN0KSk7XG5cdFx0XHR9IGVsc2UgaWYgKGUuZWxlbWVudCBpbnN0YW5jZW9mIENvdmVyYWdlRWxlbWVudCkge1xuXHRcdFx0XHRjb25zdCB0YXNrID0gZS5lbGVtZW50LnRhc2s7XG5cdFx0XHRcdGlmIChlLmVsZW1lbnQuaXNPcGVuKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvdmVyYWdlU2VydmljZS5jbG9zZUNvdmVyYWdlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyhcblx0XHRcdFx0XHR7IGxvY2F0aW9uOiBvcHRpb25zLmxvY2F0aW9uRm9yUHJvZ3Jlc3MgfSxcblx0XHRcdFx0XHQoKSA9PiBjb3ZlcmFnZVNlcnZpY2Uub3BlbkNvdmVyYWdlKHRhc2ssIHRydWUpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGV2dCA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZXZ0LmVsZW1lbnRzKSB7XG5cdFx0XHRcdGlmIChlbGVtZW50ICYmICd0ZXN0JyBpbiBlbGVtZW50KSB7XG5cdFx0XHRcdFx0ZXhwbG9yZXJGaWx0ZXIucmV2ZWFsLnNldChlbGVtZW50LnRlc3QuaXRlbS5leHRJZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGV4cGxvcmVyRmlsdGVyLm9uRGlkU2VsZWN0VGVzdEluRXhwbG9yZXIodGVzdElkID0+IHtcblx0XHRcdGlmICh0aGlzLnRyZWUuZ2V0U2VsZWN0aW9uKCkuc29tZShlID0+IGUgJiYgJ3Rlc3QnIGluIGUgJiYgZS50ZXN0Lml0ZW0uZXh0SWQgPT09IHRlc3RJZCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgdGhpcy50cmVlLmdldE5vZGUobnVsbCkuY2hpbGRyZW4pIHtcblx0XHRcdFx0aWYgKG5vZGUuZWxlbWVudCBpbnN0YW5jZW9mIFRhc2tFbGVtZW50KSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB0ZXN0Tm9kZSBvZiBub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRpZiAodGVzdE5vZGUuZWxlbWVudCBpbnN0YW5jZW9mIFRlc3RDYXNlRWxlbWVudCAmJiB0ZXN0Tm9kZS5lbGVtZW50LnRlc3QuaXRlbS5leHRJZCA9PT0gdGVzdElkKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudHJlZS5zZXRTZWxlY3Rpb24oW3Rlc3ROb2RlLmVsZW1lbnRdKTtcblx0XHRcdFx0XHRcdFx0aWYgKHRoaXMudHJlZS5nZXRSZWxhdGl2ZVRvcCh0ZXN0Tm9kZS5lbGVtZW50KSA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMudHJlZS5yZXZlYWwodGVzdE5vZGUuZWxlbWVudCwgMC41KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkNvbnRleHRNZW51KGUgPT4gdGhpcy5vbkNvbnRleHRNZW51KGUpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKGUgPT4ge1xuXHRcdFx0aWYgKGUubm9kZS5lbGVtZW50IGluc3RhbmNlb2YgT2xkZXJSZXN1bHRzRWxlbWVudCAmJiAhZS5ub2RlLmNvbGxhcHNlZCkge1xuXHRcdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8e30sIHtcblx0XHRcdFx0XHRvd25lcjogJ2Nvbm5vcjQzMTInO1xuXHRcdFx0XHRcdC8vIHdlJ3JlIGNvbnNpZGVyaW5nIHJlbW92aW5nIG9yIGRlcHJvbW90aW5nIHRoaXMgZmVhdHVyZSBiZWNhdXNlIHdlIGRvbid0IHRoaW5rIGl0J3MgdXNlZDpcblx0XHRcdFx0XHRjb21tZW50OiAnUmVjb3JkcyB0aGF0IHRlc3QgaGlzdG9yeSB3YXMgdXNlZCc7XG5cdFx0XHRcdH0+KCd0ZXN0aW5nLmV4cGFuZE9sZGVyUmVzdWx0cycpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMudHJlZS5zZXRDaGlsZHJlbihudWxsLCBnZXRSb290Q2hpbGRyZW4oKSk7XG5cdFx0Zm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cy5yZXN1bHRzKSB7XG5cdFx0XHRpZiAoIXJlc3VsdC5jb21wbGV0ZWRBdCAmJiByZXN1bHQgaW5zdGFuY2VvZiBMaXZlVGVzdFJlc3VsdCkge1xuXHRcdFx0XHRhdHRhY2hUb1Jlc3VsdHMocmVzdWx0KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKSB7XG5cdFx0dGhpcy50cmVlLmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0fVxuXG5cdHByaXZhdGUgb25Db250ZXh0TWVudShldnQ6IElUcmVlQ29udGV4dE1lbnVFdmVudDxJVHJlZUVsZW1lbnQgfCBudWxsPikge1xuXHRcdGlmICghZXZ0LmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhY3Rpb25zID0gdGhpcy50cmVlQWN0aW9ucy5wcm92aWRlQWN0aW9uQmFyKGV2dC5lbGVtZW50KTtcblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBldnQuYW5jaG9yLFxuXHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucy5zZWNvbmRhcnkubGVuZ3RoXG5cdFx0XHRcdD8gWy4uLmFjdGlvbnMucHJpbWFyeSwgbmV3IFNlcGFyYXRvcigpLCAuLi5hY3Rpb25zLnNlY29uZGFyeV1cblx0XHRcdFx0OiBhY3Rpb25zLnByaW1hcnksXG5cdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gZXZ0LmVsZW1lbnQ/LmNvbnRleHRcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmRpc3Bvc2VkID0gdHJ1ZTtcblx0fVxufVxuXG5pbnRlcmZhY2UgVGVtcGxhdGVEYXRhIHtcblx0bGFiZWw6IEhUTUxFbGVtZW50O1xuXHRpY29uOiBIVE1MRWxlbWVudDtcblx0YWN0aW9uQmFyOiBBY3Rpb25CYXI7XG5cdGVsZW1lbnREaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHRlbXBsYXRlRGlzcG9zYWJsZTogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5jbGFzcyBUZXN0UnVuRWxlbWVudFJlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxJVHJlZUVsZW1lbnQsIEZ1enp5U2NvcmUsIFRlbXBsYXRlRGF0YT4ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ3Rlc3RSdW5FbGVtZW50UmVuZGVyZXInO1xuXHRwdWJsaWMgcmVhZG9ubHkgdGVtcGxhdGVJZCA9IFRlc3RSdW5FbGVtZW50UmVuZGVyZXIuSUQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0cmVlQWN0aW9uczogVHJlZUFjdGlvbnNQcm92aWRlcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7IH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxJVHJlZUVsZW1lbnQ+LCBGdXp6eVNjb3JlPiwgX2luZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3QgY2hhaW4gPSBub2RlLmVsZW1lbnQuZWxlbWVudHM7XG5cdFx0Y29uc3QgbGFzdEVsZW1lbnQgPSBjaGFpbltjaGFpbi5sZW5ndGggLSAxXTtcblx0XHRpZiAoKGxhc3RFbGVtZW50IGluc3RhbmNlb2YgVGFza0VsZW1lbnQgfHwgbGFzdEVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0TWVzc2FnZUVsZW1lbnQpICYmIGNoYWluLmxlbmd0aCA+PSAyKSB7XG5cdFx0XHR0aGlzLmRvUmVuZGVyKGNoYWluW2NoYWluLmxlbmd0aCAtIDJdLCB0ZW1wbGF0ZURhdGEsIGxhc3RFbGVtZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kb1JlbmRlcihsYXN0RWxlbWVudCwgdGVtcGxhdGVEYXRhKTtcblx0XHR9XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IHRlbXBsYXRlRGlzcG9zYWJsZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgndGVzdGluZy1zdGR0cmVlLWNvbnRhaW5lcicpO1xuXHRcdGNvbnN0IGljb24gPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgZG9tLiQoJy5zdGF0ZScpKTtcblx0XHRjb25zdCBsYWJlbCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLmxhYmVsJykpO1xuXG5cdFx0Y29uc3QgYWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcihjb250YWluZXIsIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+XG5cdFx0XHRcdGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uXG5cdFx0XHRcdFx0PyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHsgaG92ZXJEZWxlZ2F0ZTogb3B0aW9ucy5ob3ZlckRlbGVnYXRlIH0pXG5cdFx0XHRcdFx0OiB1bmRlZmluZWRcblx0XHR9KTtcblxuXHRcdGNvbnN0IGVsZW1lbnREaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRlbXBsYXRlRGlzcG9zYWJsZS5hZGQoZWxlbWVudERpc3Bvc2FibGUpO1xuXHRcdHRlbXBsYXRlRGlzcG9zYWJsZS5hZGQoYWN0aW9uQmFyKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRpY29uLFxuXHRcdFx0bGFiZWwsXG5cdFx0XHRhY3Rpb25CYXIsXG5cdFx0XHRlbGVtZW50RGlzcG9zYWJsZSxcblx0XHRcdHRlbXBsYXRlRGlzcG9zYWJsZSxcblx0XHR9O1xuXHR9XG5cblx0LyoqIEBpbmhlcml0ZG9jICovXG5cdHB1YmxpYyByZW5kZXJFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxJVHJlZUVsZW1lbnQsIEZ1enp5U2NvcmU+LCBfaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0aGlzLmRvUmVuZGVyKGVsZW1lbnQuZWxlbWVudCwgdGVtcGxhdGVEYXRhKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH1cblxuXHQvKiogQ2FsbGVkIHRvIHJlbmRlciBhIG5ldyBlbGVtZW50ICovXG5cdHByaXZhdGUgZG9SZW5kZXIoZWxlbWVudDogSVRyZWVFbGVtZW50LCB0ZW1wbGF0ZURhdGE6IFRlbXBsYXRlRGF0YSwgc3ViamVjdEVsZW1lbnQ/OiBJVHJlZUVsZW1lbnQpIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGUuYWRkKFxuXHRcdFx0ZWxlbWVudC5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLmRvUmVuZGVyKGVsZW1lbnQsIHRlbXBsYXRlRGF0YSwgc3ViamVjdEVsZW1lbnQpKSxcblx0XHQpO1xuXHRcdHRoaXMuZG9SZW5kZXJJbm5lcihlbGVtZW50LCB0ZW1wbGF0ZURhdGEsIHN1YmplY3RFbGVtZW50KTtcblx0fVxuXG5cdC8qKiBDYWxsZWQsIGFuZCBtYXkgYmUgcmUtY2FsbGVkLCB0byByZW5kZXIgb3IgcmUtcmVuZGVyIGFuIGVsZW1lbnQgKi9cblx0cHJpdmF0ZSBkb1JlbmRlcklubmVyKGVsZW1lbnQ6IElUcmVlRWxlbWVudCwgdGVtcGxhdGVEYXRhOiBUZW1wbGF0ZURhdGEsIHN1YmplY3RFbGVtZW50OiBJVHJlZUVsZW1lbnQgfCB1bmRlZmluZWQpIHtcblx0XHRsZXQgeyBsYWJlbCwgbGFiZWxXaXRoSWNvbnMsIGRlc2NyaXB0aW9uIH0gPSBlbGVtZW50O1xuXHRcdGlmIChzdWJqZWN0RWxlbWVudCBpbnN0YW5jZW9mIFRlc3RNZXNzYWdlRWxlbWVudCkge1xuXHRcdFx0ZGVzY3JpcHRpb24gPSBzdWJqZWN0RWxlbWVudC5sYWJlbDtcblx0XHR9XG5cblx0XHRjb25zdCBkZXNjcmlwdGlvbkVsZW1lbnQgPSBkZXNjcmlwdGlvbiA/IGRvbS4kKCdzcGFuLnRlc3QtbGFiZWwtZGVzY3JpcHRpb24nLCB7fSwgZGVzY3JpcHRpb24pIDogJyc7XG5cdFx0aWYgKGxhYmVsV2l0aEljb25zKSB7XG5cdFx0XHRkb20ucmVzZXQodGVtcGxhdGVEYXRhLmxhYmVsLCAuLi5sYWJlbFdpdGhJY29ucywgZGVzY3JpcHRpb25FbGVtZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZG9tLnJlc2V0KHRlbXBsYXRlRGF0YS5sYWJlbCwgbGFiZWwsIGRlc2NyaXB0aW9uRWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaWNvbiA9IGVsZW1lbnQuaWNvbjtcblx0XHR0ZW1wbGF0ZURhdGEuaWNvbi5jbGFzc05hbWUgPSBgY29tcHV0ZWQtc3RhdGUgJHtpY29uID8gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb24pIDogJyd9YDtcblxuXHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLnRyZWVBY3Rpb25zLnByb3ZpZGVBY3Rpb25CYXIoZWxlbWVudCk7XG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5jbGVhcigpO1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuY29udGV4dCA9IGVsZW1lbnQuY29udGV4dDtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLnB1c2goYWN0aW9ucy5wcmltYXJ5LCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0fVxufVxuXG5jbGFzcyBUcmVlQWN0aW9uc1Byb3ZpZGVyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzaG93UmV2ZWFsTG9jYXRpb25Pbk1lc3NhZ2VzOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdFJldmVhbDogRW1pdHRlcjxJbnNwZWN0U3ViamVjdD4sXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElUZXN0UHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXN0UHJvZmlsZVNlcnZpY2U6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdCkgeyB9XG5cblx0cHVibGljIHByb3ZpZGVBY3Rpb25CYXIoZWxlbWVudDogSVRyZWVFbGVtZW50KSB7XG5cdFx0Y29uc3QgdGVzdCA9IGVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0Q2FzZUVsZW1lbnQgPyBlbGVtZW50LnRlc3QgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgY2FwYWJpbGl0aWVzID0gdGVzdCA/IHRoaXMudGVzdFByb2ZpbGVTZXJ2aWNlLmNhcGFiaWxpdGllc0ZvclRlc3QodGVzdC5pdGVtKSA6IDA7XG5cblx0XHRjb25zdCBjb250ZXh0S2V5czogW3N0cmluZywgdW5rbm93bl1bXSA9IFtcblx0XHRcdFsncGVlaycsIFRlc3RpbmcuT3V0cHV0UGVla0NvbnRyaWJ1dGlvbklkXSxcblx0XHRcdFtUZXN0aW5nQ29udGV4dEtleXMucGVla0l0ZW1UeXBlLmtleSwgZWxlbWVudC50eXBlXSxcblx0XHRdO1xuXG5cdFx0bGV0IGlkID0gTWVudUlkLlRlc3RQZWVrRWxlbWVudDtcblx0XHRjb25zdCBwcmltYXJ5OiBJQWN0aW9uW10gPSBbXTtcblx0XHRjb25zdCBzZWNvbmRhcnk6IElBY3Rpb25bXSA9IFtdO1xuXG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBUYXNrRWxlbWVudCkge1xuXHRcdFx0cHJpbWFyeS5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdCd0ZXN0aW5nLm91dHB1dFBlZWsuc2hvd1Jlc3VsdE91dHB1dCcsXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLnNob3dSZXN1bHRPdXRwdXQnLCBcIlNob3cgUmVzdWx0IE91dHB1dFwiKSxcblx0XHRcdFx0VGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24udGVybWluYWwpLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdCgpID0+IHRoaXMucmVxdWVzdFJldmVhbC5maXJlKG5ldyBUYXNrU3ViamVjdChlbGVtZW50LnJlc3VsdHMsIGVsZW1lbnQuaW5kZXgpKSxcblx0XHRcdCkpO1xuXHRcdFx0aWYgKGVsZW1lbnQudGFzay5ydW5uaW5nKSB7XG5cdFx0XHRcdHByaW1hcnkucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHRcdCd0ZXN0aW5nLm91dHB1dFBlZWsuY2FuY2VsJyxcblx0XHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5jYW5jZWxSdW4nLCAnQ2FuY2VsIFRlc3QgUnVuJyksXG5cdFx0XHRcdFx0VGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb25zLnRlc3RpbmdDYW5jZWxJY29uKSxcblx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChUZXN0Q29tbWFuZElkLkNhbmNlbFRlc3RSdW5BY3Rpb24sIGVsZW1lbnQucmVzdWx0cy5pZCwgZWxlbWVudC50YXNrLmlkKSxcblx0XHRcdFx0KSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwcmltYXJ5LnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0XHQndGVzdGluZy5vdXRwdXRQZWVrLnJlcnVuJyxcblx0XHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5yZVJ1bkxhc3RSdW4nLCAnUmVydW4gTGFzdCBSdW4nKSxcblx0XHRcdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbnMudGVzdGluZ1JlcnVuSWNvbiksXG5cdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdCgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoVGVzdENvbW1hbmRJZC5SZVJ1bkxhc3RSdW4sIGVsZW1lbnQucmVzdWx0cy5pZCksXG5cdFx0XHRcdCkpO1xuXHRcdFx0XHRwcmltYXJ5LnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0XHQndGVzdGluZy5vdXRwdXRQZWVrLmRlYnVnJyxcblx0XHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5kZWJ1Z0xhc3RSdW4nLCAnRGVidWcgTGFzdCBSdW4nKSxcblx0XHRcdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbnMudGVzdGluZ0RlYnVnSWNvbiksXG5cdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdCgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoVGVzdENvbW1hbmRJZC5EZWJ1Z0xhc3RSdW4sIGVsZW1lbnQucmVzdWx0cy5pZCksXG5cdFx0XHRcdCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVGVzdFJlc3VsdEVsZW1lbnQpIHtcblx0XHRcdC8vIG9ubHkgc2hvdyBpZiB0aGVyZSBhcmUgbm8gY29sbGFwc2VkIHRlc3Qgbm9kZXMgdGhhdCBoYXZlIG1vcmUgc3BlY2lmaWMgY2hvaWNlc1xuXHRcdFx0aWYgKGVsZW1lbnQudmFsdWUudGFza3MubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdHByaW1hcnkucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHRcdCd0ZXN0aW5nLm91dHB1dFBlZWsuc2hvd1Jlc3VsdE91dHB1dCcsXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3Rlc3Rpbmcuc2hvd1Jlc3VsdE91dHB1dCcsIFwiU2hvdyBSZXN1bHQgT3V0cHV0XCIpLFxuXHRcdFx0XHRcdFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnRlcm1pbmFsKSxcblx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5yZXF1ZXN0UmV2ZWFsLmZpcmUobmV3IFRhc2tTdWJqZWN0KGVsZW1lbnQudmFsdWUsIDApKSxcblx0XHRcdFx0KSk7XG5cdFx0XHR9XG5cblx0XHRcdHByaW1hcnkucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHQndGVzdGluZy5vdXRwdXRQZWVrLnJlUnVuTGFzdFJ1bicsXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLnJlUnVuVGVzdCcsIFwiUmVydW4gVGVzdFwiKSxcblx0XHRcdFx0VGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb25zLnRlc3RpbmdSdW5JY29uKSxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd0ZXN0aW5nLnJlUnVuTGFzdFJ1bicsIGVsZW1lbnQudmFsdWUuaWQpLFxuXHRcdFx0KSk7XG5cblx0XHRcdGlmIChjYXBhYmlsaXRpZXMgJiBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1Zykge1xuXHRcdFx0XHRwcmltYXJ5LnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0XHQndGVzdGluZy5vdXRwdXRQZWVrLmRlYnVnTGFzdFJ1bicsXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3Rlc3RpbmcuZGVidWdUZXN0JywgXCJEZWJ1ZyBUZXN0XCIpLFxuXHRcdFx0XHRcdFRoZW1lSWNvbi5hc0NsYXNzTmFtZShpY29ucy50ZXN0aW5nRGVidWdJY29uKSxcblx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgndGVzdGluZy5kZWJ1Z0xhc3RSdW4nLCBlbGVtZW50LnZhbHVlLmlkKSxcblx0XHRcdFx0KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBUZXN0Q2FzZUVsZW1lbnQgfHwgZWxlbWVudCBpbnN0YW5jZW9mIFRlc3RNZXNzYWdlRWxlbWVudCkge1xuXHRcdFx0Y29udGV4dEtleXMucHVzaChcblx0XHRcdFx0W1Rlc3RpbmdDb250ZXh0S2V5cy50ZXN0UmVzdWx0T3V0ZGF0ZWQua2V5LCBlbGVtZW50LnRlc3QucmV0aXJlZF0sXG5cdFx0XHRcdFtUZXN0aW5nQ29udGV4dEtleXMudGVzdFJlc3VsdFN0YXRlLmtleSwgdGVzdFJlc3VsdFN0YXRlVG9Db250ZXh0VmFsdWVzW2VsZW1lbnQudGVzdC5vd25Db21wdXRlZFN0YXRlXV0sXG5cdFx0XHRcdC4uLmdldFRlc3RJdGVtQ29udGV4dE92ZXJsYXkoZWxlbWVudC50ZXN0LCBjYXBhYmlsaXRpZXMpLFxuXHRcdFx0KTtcblxuXHRcdFx0Y29uc3QgZXh0SWQgPSBlbGVtZW50LnRlc3QuaXRlbS5leHRJZDtcblx0XHRcdGlmIChlbGVtZW50LnRlc3QudGFza3NbZWxlbWVudC50YXNrSW5kZXhdLm1lc3NhZ2VzLnNvbWUobSA9PiBtLnR5cGUgPT09IFRlc3RNZXNzYWdlVHlwZS5PdXRwdXQpKSB7XG5cdFx0XHRcdHByaW1hcnkucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHRcdCd0ZXN0aW5nLm91dHB1dFBlZWsuc2hvd1Jlc3VsdE91dHB1dCcsXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3Rlc3Rpbmcuc2hvd1Jlc3VsdE91dHB1dCcsIFwiU2hvdyBSZXN1bHQgT3V0cHV0XCIpLFxuXHRcdFx0XHRcdFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnRlcm1pbmFsKSxcblx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5yZXF1ZXN0UmV2ZWFsLmZpcmUoZWxlbWVudC5vdXRwdXRTdWJqZWN0KSxcblx0XHRcdFx0KSk7XG5cdFx0XHR9XG5cblx0XHRcdHNlY29uZGFyeS5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdCd0ZXN0aW5nLm91dHB1dFBlZWsucmV2ZWFsSW5FeHBsb3JlcicsXG5cdFx0XHRcdGxvY2FsaXplKCd0ZXN0aW5nLnJldmVhbEluRXhwbG9yZXInLCBcIlJldmVhbCBpbiBUZXN0IEV4cGxvcmVyXCIpLFxuXHRcdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5saXN0VHJlZSksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0KCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnX3JldmVhbFRlc3RJbkV4cGxvcmVyJywgZXh0SWQpLFxuXHRcdFx0KSk7XG5cblx0XHRcdGlmIChjYXBhYmlsaXRpZXMgJiBUZXN0UnVuUHJvZmlsZUJpdHNldC5SdW4pIHtcblx0XHRcdFx0cHJpbWFyeS5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdFx0J3Rlc3Rpbmcub3V0cHV0UGVlay5ydW5UZXN0Jyxcblx0XHRcdFx0XHRsb2NhbGl6ZSgncnVuIHRlc3QnLCAnUnVuIFRlc3QnKSxcblx0XHRcdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbnMudGVzdGluZ1J1bkljb24pLFxuXHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHQoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd2c2NvZGUucnVuVGVzdHNCeUlkJywgVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuLCBleHRJZCksXG5cdFx0XHRcdCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY2FwYWJpbGl0aWVzICYgVGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcpIHtcblx0XHRcdFx0cHJpbWFyeS5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdFx0J3Rlc3Rpbmcub3V0cHV0UGVlay5kZWJ1Z1Rlc3QnLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdkZWJ1ZyB0ZXN0JywgJ0RlYnVnIFRlc3QnKSxcblx0XHRcdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbnMudGVzdGluZ0RlYnVnSWNvbiksXG5cdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdCgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5ydW5UZXN0c0J5SWQnLCBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1ZywgZXh0SWQpLFxuXHRcdFx0XHQpKTtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVGVzdE1lc3NhZ2VFbGVtZW50KSB7XG5cdFx0XHRpZCA9IE1lbnVJZC5UZXN0TWVzc2FnZUNvbnRleHQ7XG5cdFx0XHRjb250ZXh0S2V5cy5wdXNoKFtUZXN0aW5nQ29udGV4dEtleXMudGVzdE1lc3NhZ2VDb250ZXh0LmtleSwgZWxlbWVudC5jb250ZXh0VmFsdWVdKTtcblxuXHRcdFx0cHJpbWFyeS5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdCd0ZXN0aW5nLm91dHB1dFBlZWsuZ29Ub1Rlc3QnLFxuXHRcdFx0XHRsb2NhbGl6ZSgndGVzdGluZy5nb1RvVGVzdCcsIFwiR28gdG8gVGVzdFwiKSxcblx0XHRcdFx0VGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uZ29Ub0ZpbGUpLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdCgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5yZXZlYWxUZXN0JywgZWxlbWVudC50ZXN0Lml0ZW0uZXh0SWQpLFxuXHRcdFx0KSk7XG5cblx0XHRcdGlmICh0aGlzLnNob3dSZXZlYWxMb2NhdGlvbk9uTWVzc2FnZXMgJiYgZWxlbWVudC5sb2NhdGlvbikge1xuXHRcdFx0XHRwcmltYXJ5LnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0XHQndGVzdGluZy5vdXRwdXRQZWVrLmdvVG9FcnJvcicsXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3Rlc3RpbmcuZ29Ub0Vycm9yJywgXCJHbyB0byBFcnJvclwiKSxcblx0XHRcdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5kZWJ1Z1N0YWNrZnJhbWUpLFxuXHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHQoKSA9PiB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogZWxlbWVudC5sb2NhdGlvbiEudXJpLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRzZWxlY3Rpb246IGVsZW1lbnQubG9jYXRpb24hLnJhbmdlLFxuXHRcdFx0XHRcdFx0XHRwcmVzZXJ2ZUZvY3VzOiB0cnVlLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pLFxuXHRcdFx0XHQpKTtcblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdGNvbnN0IGNvbnRleHRPdmVybGF5ID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVPdmVybGF5KGNvbnRleHRLZXlzKTtcblx0XHRjb25zdCByZXN1bHQgPSB7IHByaW1hcnksIHNlY29uZGFyeSB9O1xuXHRcdGNvbnN0IG1lbnUgPSB0aGlzLm1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKGlkLCBjb250ZXh0T3ZlcmxheSwgeyBhcmc6IGVsZW1lbnQuY29udGV4dCB9KTtcblx0XHRmaWxsSW5BY3Rpb25CYXJBY3Rpb25zKG1lbnUsIHJlc3VsdCwgJ2lubGluZScpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuY2xhc3MgQ3JlYXRpb25DYWNoZTxUPiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgdiA9IG5ldyBXZWFrTWFwPG9iamVjdCwgVD4oKTtcblxuXHRwdWJsaWMgZ2V0PFQyIGV4dGVuZHMgVCA9IFQ+KGtleTogb2JqZWN0KTogVDIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnYuZ2V0KGtleSkgYXMgVDIgfCB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0T3JDcmVhdGU8VDIgZXh0ZW5kcyBUPihyZWY6IG9iamVjdCwgZmFjdG9yeTogKCkgPT4gVDIpOiBUMiB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLnYuZ2V0KHJlZik7XG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRyZXR1cm4gZXhpc3RpbmcgYXMgVDI7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnJlc2ggPSBmYWN0b3J5KCk7XG5cdFx0dGhpcy52LnNldChyZWYsIGZyZXNoKTtcblx0XHRyZXR1cm4gZnJlc2g7XG5cdH1cbn1cblxuY29uc3QgZmlyc3RMaW5lID0gKHN0cjogc3RyaW5nKSA9PiB7XG5cdGNvbnN0IGluZGV4ID0gc3RyLmluZGV4T2YoJ1xcbicpO1xuXHRyZXR1cm4gaW5kZXggPT09IC0xID8gc3RyIDogc3RyLnNsaWNlKDAsIGluZGV4KTtcbn07XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLDRCQUE0QjtBQUtyQyxTQUFTLFFBQWlCLGlCQUFpQjtBQUMzQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxTQUFTLGFBQWE7QUFFL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCLDhCQUE4QjtBQUNoRSxTQUFTLGNBQWMsUUFBUSxzQkFBc0I7QUFDckQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxpQ0FBaUM7QUFDMUMsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQXlCLGdCQUFnQixhQUFh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
