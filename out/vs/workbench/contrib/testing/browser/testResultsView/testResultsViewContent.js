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
import { StandardKeyboardEvent } from "../../../../../base/browser/keyboardEvent.js";
import { renderLabelWithIcons } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Orientation, Sizing, SplitView } from "../../../../../base/browser/ui/splitview/splitview.js";
import { findAsync } from "../../../../../base/common/arrays.js";
import { Limiter } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Emitter, Event, Relay } from "../../../../../base/common/event.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { FloatingClickMenu } from "../../../../../platform/actions/browser/floatingMenu.js";
import { createActionViewItem } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { CallStackFrame, CallStackWidget, CustomStackFrame } from "../../../debug/browser/callStackWidget.js";
import { TestCommandId } from "../../common/constants.js";
import { capabilityContextKeys, ITestProfileService } from "../../common/testProfileService.js";
import { LiveTestResult } from "../../common/testResult.js";
import { ITestService } from "../../common/testService.js";
import { TestRunProfileBitset } from "../../common/testTypes.js";
import { TestingContextKeys } from "../../common/testingContextKeys.js";
import * as icons from "../icons.js";
import { DiffContentProvider, MarkdownTestMessagePeek, PlainTextMessagePeek, TerminalMessagePeek } from "./testResultsOutput.js";
import { equalsSubject, getSubjectTestItem, MessageSubject, TaskSubject, TestOutputSubject } from "./testResultsSubject.js";
import { OutputPeekTree } from "./testResultsTree.js";
import "./testResultsViewContent.css";
var SubView = /* @__PURE__ */ ((SubView2) => {
  SubView2[SubView2["Diff"] = 0] = "Diff";
  SubView2[SubView2["History"] = 1] = "History";
  return SubView2;
})(SubView || {});
let MessageStackFrame = class extends CustomStackFrame {
  constructor(message, followup, subject, instantiationService, contextKeyService, profileService) {
    super();
    this.message = message;
    this.followup = followup;
    this.subject = subject;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.profileService = profileService;
    this.height = observableValue("MessageStackFrame.height", 100);
    this.icon = icons.testingViewIcon;
    this.label = subject instanceof MessageSubject ? subject.test.label : subject instanceof TestOutputSubject ? subject.test.item.label : subject.result.name;
  }
  render(container) {
    this.message.style.visibility = "visible";
    container.appendChild(this.message);
    return toDisposable(() => this.message.remove());
  }
  renderActions(container) {
    const store = new DisposableStore();
    container.appendChild(this.followup.domNode);
    store.add(toDisposable(() => this.followup.domNode.remove()));
    const test = getSubjectTestItem(this.subject);
    const capabilities = test && this.profileService.capabilitiesForTest(test);
    let contextKeyService;
    if (capabilities) {
      contextKeyService = this.contextKeyService.createOverlay(capabilityContextKeys(capabilities));
    } else {
      const profiles = this.profileService.getControllerProfiles(this.subject.controllerId);
      contextKeyService = this.contextKeyService.createOverlay([
        [TestingContextKeys.hasRunnableTests.key, profiles.some((p) => p.group & TestRunProfileBitset.Run)],
        [TestingContextKeys.hasDebuggableTests.key, profiles.some((p) => p.group & TestRunProfileBitset.Debug)]
      ]);
    }
    const instaService = store.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    const toolbar = store.add(instaService.createInstance(MenuWorkbenchToolBar, container, MenuId.TestCallStack, {
      menuOptions: { shouldForwardArgs: true },
      actionViewItemProvider: (action, options) => createActionViewItem(this.instantiationService, action, options)
    }));
    toolbar.context = this.subject;
    store.add(toolbar);
    return store;
  }
};
MessageStackFrame = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, ITestProfileService)
], MessageStackFrame);
function runInLast(accessor, bitset, subject) {
  if (subject instanceof TaskSubject) {
    return accessor.get(ICommandService).executeCommand(
      bitset === TestRunProfileBitset.Debug ? TestCommandId.DebugLastRun : TestCommandId.ReRunLastRun,
      subject.result.id
    );
  }
  const testService = accessor.get(ITestService);
  const plainTest = subject instanceof MessageSubject ? subject.test : subject.test.item;
  const currentTest = testService.collection.getNodeById(plainTest.extId);
  if (!currentTest) {
    return;
  }
  return testService.runTests({
    group: bitset,
    tests: [currentTest]
  });
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "testing.callStack.run",
      title: localize("testing.callStack.run", "Rerun Test"),
      icon: icons.testingRunIcon,
      menu: {
        id: MenuId.TestCallStack,
        when: TestingContextKeys.hasRunnableTests,
        group: "navigation"
      }
    });
  }
  run(accessor, subject) {
    runInLast(accessor, TestRunProfileBitset.Run, subject);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "testing.callStack.debug",
      title: localize("testing.callStack.debug", "Debug Test"),
      icon: icons.testingDebugIcon,
      menu: {
        id: MenuId.TestCallStack,
        when: TestingContextKeys.hasDebuggableTests,
        group: "navigation"
      }
    });
  }
  run(accessor, subject) {
    runInLast(accessor, TestRunProfileBitset.Debug, subject);
  }
});
let TestResultsViewContent = class extends Disposable {
  constructor(editor, options, instantiationService, modelService, contextKeyService, uriIdentityService) {
    super();
    this.editor = editor;
    this.options = options;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.contextKeyService = contextKeyService;
    this.uriIdentityService = uriIdentityService;
    this.didReveal = this._register(new Emitter());
    this.currentSubjectStore = this._register(new DisposableStore());
    this.onCloseEmitter = this._register(new Relay());
    this.contentProvidersUpdateLimiter = this._register(new Limiter(1));
    this.onClose = this.onCloseEmitter.event;
  }
  get uiState() {
    return {
      splitViewWidths: Array.from(
        { length: this.splitView.length },
        (_, i) => this.splitView.getViewSize(i)
      )
    };
  }
  get onDidChangeContentHeight() {
    return this.callStackWidget.onDidChangeContentHeight;
  }
  get contentHeight() {
    return this.callStackWidget?.contentHeight || 0;
  }
  fillBody(containerElement) {
    const initialSpitWidth = TestResultsViewContent.lastSplitWidth;
    this.splitView = new SplitView(containerElement, { orientation: Orientation.HORIZONTAL });
    const { historyVisible, showRevealLocationOnMessages } = this.options;
    const isInPeekView = this.editor !== void 0;
    const messageContainer = this.messageContainer = dom.$(".test-output-peek-message-container");
    this.stackContainer = dom.append(containerElement, dom.$(".test-output-call-stack-container"));
    this.callStackWidget = this._register(this.instantiationService.createInstance(CallStackWidget, this.stackContainer, this.editor));
    this.followupWidget = this._register(this.instantiationService.createInstance(FollowupActionWidget, this.editor));
    this.onCloseEmitter.input = this.followupWidget.onClose;
    this.contentProviders = [
      this._register(this.instantiationService.createInstance(DiffContentProvider, this.editor, messageContainer)),
      this._register(this.instantiationService.createInstance(MarkdownTestMessagePeek, messageContainer)),
      this._register(this.instantiationService.createInstance(TerminalMessagePeek, messageContainer, isInPeekView)),
      this._register(this.instantiationService.createInstance(PlainTextMessagePeek, this.editor, messageContainer))
    ];
    this.messageContextKeyService = this._register(this.contextKeyService.createScoped(containerElement));
    this.contextKeyTestMessage = TestingContextKeys.testMessageContext.bindTo(this.messageContextKeyService);
    this.contextKeyResultOutdated = TestingContextKeys.testResultOutdated.bindTo(this.messageContextKeyService);
    const treeContainer = dom.append(containerElement, dom.$(".test-output-peek-tree.testing-stdtree"));
    const tree = this._register(this.instantiationService.createInstance(
      OutputPeekTree,
      treeContainer,
      this.didReveal.event,
      { showRevealLocationOnMessages, locationForProgress: this.options.locationForProgress }
    ));
    this.onDidRequestReveal = tree.onDidRequestReview;
    this.splitView.addView({
      onDidChange: Event.None,
      element: this.stackContainer,
      minimumSize: 200,
      maximumSize: Number.MAX_VALUE,
      layout: (width) => {
        TestResultsViewContent.lastSplitWidth = width;
        if (this.dimension) {
          this.callStackWidget?.layout(this.dimension.height, width);
          this.layoutContentWidgets(this.dimension, width);
        }
      }
    }, Sizing.Distribute);
    this.splitView.addView({
      onDidChange: Event.None,
      element: treeContainer,
      minimumSize: 100,
      maximumSize: Number.MAX_VALUE,
      layout: (width) => {
        if (this.dimension) {
          tree.layout(this.dimension.height, width);
        }
      }
    }, Sizing.Distribute);
    this.splitView.setViewVisible(1 /* History */, historyVisible.value);
    this._register(historyVisible.onDidChange((visible) => {
      this.splitView.setViewVisible(1 /* History */, visible);
    }));
    if (initialSpitWidth) {
      queueMicrotask(() => this.splitView.resizeView(0, initialSpitWidth));
    }
  }
  /**
   * Shows a message in-place without showing or changing the peek location.
   * This is mostly used if peeking a message without a location.
   */
  reveal(opts) {
    this.didReveal.fire(opts);
    if (this.current && equalsSubject(this.current, opts.subject)) {
      return Promise.resolve();
    }
    this.current = opts.subject;
    return this.contentProvidersUpdateLimiter.queue(async () => {
      this.currentSubjectStore.clear();
      const callFrames = this.getCallFrames(opts.subject) || [];
      const topFrame = await this.prepareTopFrame(opts.subject, callFrames);
      this.setCallStackFrames(topFrame, callFrames);
      this.followupWidget.show(opts.subject);
      this.populateFloatingClick(opts.subject);
    });
  }
  setCallStackFrames(messageFrame, stack) {
    this.callStackWidget.setFrames([messageFrame, ...stack.map((frame) => new CallStackFrame(
      frame.label,
      frame.uri,
      frame.position?.lineNumber,
      frame.position?.column
    ))]);
  }
  /**
   * Collapses all displayed stack frames.
   */
  collapseStack() {
    this.callStackWidget.collapseAll();
  }
  getCallFrames(subject) {
    if (!(subject instanceof MessageSubject)) {
      return void 0;
    }
    const frames = subject.stack;
    if (!frames?.length || !this.editor) {
      return frames;
    }
    const topFrame = frames[0];
    const peekLocation = subject.revealLocation;
    const isTopFrameSame = peekLocation && topFrame.position && topFrame.uri && topFrame.position.lineNumber === peekLocation.range.startLineNumber && topFrame.position.column === peekLocation.range.startColumn && this.uriIdentityService.extUri.isEqual(topFrame.uri, peekLocation.uri);
    return isTopFrameSame ? frames.slice(1) : frames;
  }
  async prepareTopFrame(subject, callFrames) {
    this.messageContainer.style.visibility = "hidden";
    this.stackContainer.appendChild(this.messageContainer);
    const topFrame = this.currentTopFrame = this.instantiationService.createInstance(MessageStackFrame, this.messageContainer, this.followupWidget, subject);
    const hasMultipleFrames = callFrames.length > 0;
    topFrame.showHeader.set(hasMultipleFrames, void 0);
    const provider = await findAsync(this.contentProviders, (p) => p.update(subject));
    if (provider) {
      const width = this.splitView.getViewSize(0 /* Diff */);
      if (width !== -1 && this.dimension) {
        topFrame.height.set(provider.layout({ width, height: this.dimension?.height }, hasMultipleFrames), void 0);
      }
      if (provider.onScrolled) {
        this.currentSubjectStore.add(this.callStackWidget.onDidScroll((evt) => {
          provider.onScrolled(evt);
        }));
      }
      if (provider.onDidContentSizeChange) {
        this.currentSubjectStore.add(provider.onDidContentSizeChange(() => {
          if (this.dimension && !this.isDoingLayoutUpdate) {
            this.isDoingLayoutUpdate = true;
            topFrame.height.set(provider.layout(this.dimension, hasMultipleFrames), void 0);
            this.isDoingLayoutUpdate = false;
          }
        }));
      }
    }
    return topFrame;
  }
  layoutContentWidgets(dimension, width = this.splitView.getViewSize(0 /* Diff */)) {
    this.isDoingLayoutUpdate = true;
    for (const provider of this.contentProviders) {
      const frameHeight = provider.layout({ height: dimension.height, width }, !!this.currentTopFrame?.showHeader.get());
      if (frameHeight) {
        this.currentTopFrame?.height.set(frameHeight, void 0);
      }
    }
    this.isDoingLayoutUpdate = false;
  }
  populateFloatingClick(subject) {
    if (!(subject instanceof MessageSubject)) {
      return;
    }
    this.currentSubjectStore.add(toDisposable(() => {
      this.contextKeyResultOutdated.reset();
      this.contextKeyTestMessage.reset();
    }));
    this.contextKeyTestMessage.set(subject.contextValue || "");
    if (subject.result instanceof LiveTestResult) {
      this.contextKeyResultOutdated.set(subject.result.getStateById(subject.test.extId)?.retired ?? false);
      this.currentSubjectStore.add(subject.result.onChange((ev) => {
        if (ev.item.item.extId === subject.test.extId) {
          this.contextKeyResultOutdated.set(ev.item.retired ?? false);
        }
      }));
    } else {
      this.contextKeyResultOutdated.set(true);
    }
    const instaService = this.currentSubjectStore.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.messageContextKeyService])));
    this.currentSubjectStore.add(instaService.createInstance(FloatingClickMenu, {
      container: this.messageContainer,
      menuId: MenuId.TestMessageContent,
      getActionArg: () => subject.context
    }));
  }
  onLayoutBody(height, width) {
    this.dimension = new dom.Dimension(width, height);
    this.splitView.layout(width);
  }
  onWidth(width) {
    this.splitView.layout(width);
  }
};
TestResultsViewContent = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ITextModelService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IUriIdentityService)
], TestResultsViewContent);
const FOLLOWUP_ANIMATION_MIN_TIME = 500;
let FollowupActionWidget = class extends Disposable {
  constructor(editor, testService, quickInput) {
    super();
    this.editor = editor;
    this.testService = testService;
    this.quickInput = quickInput;
    this.el = dom.h("div.testing-followup-action", []);
    this.visibleStore = this._register(new DisposableStore());
    this.onCloseEmitter = this._register(new Emitter());
    this.onClose = this.onCloseEmitter.event;
  }
  get domNode() {
    return this.el.root;
  }
  show(subject) {
    this.visibleStore.clear();
    if (subject instanceof MessageSubject) {
      this.showMessage(subject);
    }
  }
  async showMessage(subject) {
    const cts = this.visibleStore.add(new CancellationTokenSource());
    const start = Date.now();
    if (subject.result instanceof LiveTestResult && !subject.result.completedAt) {
      await new Promise((r) => Event.once(subject.result.onComplete)(r));
    }
    const followups = await this.testService.provideTestFollowups({
      extId: subject.test.extId,
      messageIndex: subject.messageIndex,
      resultId: subject.result.id,
      taskIndex: subject.taskIndex
    }, cts.token);
    if (!followups.followups.length || cts.token.isCancellationRequested) {
      followups.dispose();
      return;
    }
    this.visibleStore.add(followups);
    dom.clearNode(this.el.root);
    this.el.root.classList.toggle("animated", Date.now() - start > FOLLOWUP_ANIMATION_MIN_TIME);
    this.el.root.appendChild(this.makeFollowupLink(followups.followups[0]));
    if (followups.followups.length > 1) {
      this.el.root.appendChild(this.makeMoreLink(followups.followups));
    }
    this.visibleStore.add(toDisposable(() => {
      this.el.root.remove();
    }));
  }
  makeFollowupLink(first) {
    const link = this.makeLink(() => this.actionFollowup(link, first));
    dom.reset(link, ...renderLabelWithIcons(first.message));
    return link;
  }
  makeMoreLink(followups) {
    const link = this.makeLink(
      () => this.quickInput.pick(followups.map((f, i) => ({
        label: f.message,
        index: i
      }))).then((picked) => {
        if (picked?.length) {
          followups[picked[0].index].execute();
        }
      })
    );
    link.innerText = localize("testFollowup.more", "+{0} More...", followups.length - 1);
    return link;
  }
  makeLink(onClick) {
    const link = document.createElement("a");
    link.tabIndex = 0;
    this.visibleStore.add(dom.addDisposableListener(link, "click", onClick));
    this.visibleStore.add(dom.addDisposableListener(link, "keydown", (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Space) || event.equals(KeyCode.Enter)) {
        onClick();
      }
    }));
    return link;
  }
  actionFollowup(link, fu) {
    if (link.ariaDisabled !== "true") {
      link.ariaDisabled = "true";
      fu.execute();
      if (this.editor) {
        this.onCloseEmitter.fire();
      }
    }
  }
};
FollowupActionWidget = __decorateClass([
  __decorateParam(1, ITestService),
  __decorateParam(2, IQuickInputService)
], FollowupActionWidget);
export {
  TestResultsViewContent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdFJlc3VsdHNWaWV3L3Rlc3RSZXN1bHRzVmlld0NvbnRlbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBPcmllbnRhdGlvbiwgU2l6aW5nLCBTcGxpdFZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc3BsaXR2aWV3L3NwbGl0dmlldy5qcyc7XG5pbXBvcnQgeyBmaW5kQXN5bmMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgTGltaXRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50LCBSZWxheSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBGbG9hdGluZ0NsaWNrTWVudSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9mbG9hdGluZ01lbnUuanMnO1xuaW1wb3J0IHsgY3JlYXRlQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgTWVudVdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgQW55U3RhY2tGcmFtZSwgQ2FsbFN0YWNrRnJhbWUsIENhbGxTdGFja1dpZGdldCwgQ3VzdG9tU3RhY2tGcmFtZSB9IGZyb20gJy4uLy4uLy4uL2RlYnVnL2Jyb3dzZXIvY2FsbFN0YWNrV2lkZ2V0LmpzJztcbmltcG9ydCB7IFRlc3RDb21tYW5kSWQgfSBmcm9tICcuLi8uLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi9jb21tb24vb2JzZXJ2YWJsZVZhbHVlLmpzJztcbmltcG9ydCB7IGNhcGFiaWxpdHlDb250ZXh0S2V5cywgSVRlc3RQcm9maWxlU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0UHJvZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTGl2ZVRlc3RSZXN1bHQgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFJlc3VsdC5qcyc7XG5pbXBvcnQgeyBJVGVzdEZvbGxvd3VwLCBJVGVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlc3RNZXNzYWdlU3RhY2tGcmFtZSwgVGVzdFJ1blByb2ZpbGVCaXRzZXQgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IFRlc3RpbmdDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0aW5nQ29udGV4dEtleXMuanMnO1xuaW1wb3J0ICogYXMgaWNvbnMgZnJvbSAnLi4vaWNvbnMuanMnO1xuaW1wb3J0IHsgRGlmZkNvbnRlbnRQcm92aWRlciwgSVBlZWtPdXRwdXRSZW5kZXJlciwgTWFya2Rvd25UZXN0TWVzc2FnZVBlZWssIFBsYWluVGV4dE1lc3NhZ2VQZWVrLCBUZXJtaW5hbE1lc3NhZ2VQZWVrIH0gZnJvbSAnLi90ZXN0UmVzdWx0c091dHB1dC5qcyc7XG5pbXBvcnQgeyBlcXVhbHNTdWJqZWN0LCBnZXRTdWJqZWN0VGVzdEl0ZW0sIEluc3BlY3RTdWJqZWN0LCBNZXNzYWdlU3ViamVjdCwgVGFza1N1YmplY3QsIFRlc3RPdXRwdXRTdWJqZWN0IH0gZnJvbSAnLi90ZXN0UmVzdWx0c1N1YmplY3QuanMnO1xuaW1wb3J0IHsgT3V0cHV0UGVla1RyZWUgfSBmcm9tICcuL3Rlc3RSZXN1bHRzVHJlZS5qcyc7XG5pbXBvcnQgJy4vdGVzdFJlc3VsdHNWaWV3Q29udGVudC5jc3MnO1xuXG5jb25zdCBlbnVtIFN1YlZpZXcge1xuXHREaWZmID0gMCxcblx0SGlzdG9yeSA9IDEsXG59XG5cbi8qKiBVSSBzdGF0ZSB0aGF0IGNhbiBiZSBzYXZlZC9yZXN0b3JlZCwgdXNlZCB0byBnaXZlIGEgbmljZSBleHBlcmllbmNlIHdoZW4gc3dpdGNoaW5nIHN0YWNrIGZyYW1lcyAqL1xuZXhwb3J0IGludGVyZmFjZSBJVGVzdFJlc3VsdHNWaWV3Q29udGVudFVpU3RhdGUge1xuXHRzcGxpdFZpZXdXaWR0aHM6IG51bWJlcltdO1xufVxuXG5jbGFzcyBNZXNzYWdlU3RhY2tGcmFtZSBleHRlbmRzIEN1c3RvbVN0YWNrRnJhbWUge1xuXHRwdWJsaWMgb3ZlcnJpZGUgaGVpZ2h0ID0gb2JzZXJ2YWJsZVZhbHVlKCdNZXNzYWdlU3RhY2tGcmFtZS5oZWlnaHQnLCAxMDApO1xuXHRwdWJsaWMgb3ZlcnJpZGUgbGFiZWw6IHN0cmluZztcblx0cHVibGljIG92ZXJyaWRlIGljb24gPSBpY29ucy50ZXN0aW5nVmlld0ljb247XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtZXNzYWdlOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZvbGxvd3VwOiBGb2xsb3d1cEFjdGlvbldpZGdldCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHN1YmplY3Q6IEluc3BlY3RTdWJqZWN0LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVGVzdFByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZmlsZVNlcnZpY2U6IElUZXN0UHJvZmlsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmxhYmVsID0gc3ViamVjdCBpbnN0YW5jZW9mIE1lc3NhZ2VTdWJqZWN0XG5cdFx0XHQ/IHN1YmplY3QudGVzdC5sYWJlbFxuXHRcdFx0OiBzdWJqZWN0IGluc3RhbmNlb2YgVGVzdE91dHB1dFN1YmplY3Rcblx0XHRcdFx0PyBzdWJqZWN0LnRlc3QuaXRlbS5sYWJlbFxuXHRcdFx0XHQ6IHN1YmplY3QucmVzdWx0Lm5hbWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5tZXNzYWdlLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMubWVzc2FnZSk7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLm1lc3NhZ2UucmVtb3ZlKCkpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHJlbmRlckFjdGlvbnMoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmZvbGxvd3VwLmRvbU5vZGUpO1xuXHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5mb2xsb3d1cC5kb21Ob2RlLnJlbW92ZSgpKSk7XG5cblx0XHRjb25zdCB0ZXN0ID0gZ2V0U3ViamVjdFRlc3RJdGVtKHRoaXMuc3ViamVjdCk7XG5cdFx0Y29uc3QgY2FwYWJpbGl0aWVzID0gdGVzdCAmJiB0aGlzLnByb2ZpbGVTZXJ2aWNlLmNhcGFiaWxpdGllc0ZvclRlc3QodGVzdCk7XG5cdFx0bGV0IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cdFx0aWYgKGNhcGFiaWxpdGllcykge1xuXHRcdFx0Y29udGV4dEtleVNlcnZpY2UgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZU92ZXJsYXkoY2FwYWJpbGl0eUNvbnRleHRLZXlzKGNhcGFiaWxpdGllcykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBwcm9maWxlcyA9IHRoaXMucHJvZmlsZVNlcnZpY2UuZ2V0Q29udHJvbGxlclByb2ZpbGVzKHRoaXMuc3ViamVjdC5jb250cm9sbGVySWQpO1xuXHRcdFx0Y29udGV4dEtleVNlcnZpY2UgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZU92ZXJsYXkoW1xuXHRcdFx0XHRbVGVzdGluZ0NvbnRleHRLZXlzLmhhc1J1bm5hYmxlVGVzdHMua2V5LCBwcm9maWxlcy5zb21lKHAgPT4gcC5ncm91cCAmIFRlc3RSdW5Qcm9maWxlQml0c2V0LlJ1bildLFxuXHRcdFx0XHRbVGVzdGluZ0NvbnRleHRLZXlzLmhhc0RlYnVnZ2FibGVUZXN0cy5rZXksIHByb2ZpbGVzLnNvbWUocCA9PiBwLmdyb3VwICYgVGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcpXSxcblx0XHRcdF0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluc3RhU2VydmljZSA9IHN0b3JlLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZV0pKSk7XG5cblx0XHRjb25zdCB0b29sYmFyID0gc3RvcmUuYWRkKGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoVG9vbEJhciwgY29udGFpbmVyLCBNZW51SWQuVGVzdENhbGxTdGFjaywge1xuXHRcdFx0bWVudU9wdGlvbnM6IHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSxcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IGNyZWF0ZUFjdGlvblZpZXdJdGVtKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIGFjdGlvbiwgb3B0aW9ucyksXG5cdFx0fSkpO1xuXHRcdHRvb2xiYXIuY29udGV4dCA9IHRoaXMuc3ViamVjdDtcblx0XHRzdG9yZS5hZGQodG9vbGJhcik7XG5cblx0XHRyZXR1cm4gc3RvcmU7XG5cdH1cbn1cblxuZnVuY3Rpb24gcnVuSW5MYXN0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBiaXRzZXQ6IFRlc3RSdW5Qcm9maWxlQml0c2V0LCBzdWJqZWN0OiBJbnNwZWN0U3ViamVjdCkge1xuXHQvLyBMZXQgdGhlIGZ1bGwgY29tbWFuZCBkbyBpdHMgdGhpbmcgaWYgd2Ugd2FudCB0byBydW4gdGhlIHdob2xlIHNldCBvZiB0ZXN0c1xuXHRpZiAoc3ViamVjdCBpbnN0YW5jZW9mIFRhc2tTdWJqZWN0KSB7XG5cdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpLmV4ZWN1dGVDb21tYW5kKFxuXHRcdFx0Yml0c2V0ID09PSBUZXN0UnVuUHJvZmlsZUJpdHNldC5EZWJ1ZyA/IFRlc3RDb21tYW5kSWQuRGVidWdMYXN0UnVuIDogVGVzdENvbW1hbmRJZC5SZVJ1bkxhc3RSdW4sXG5cdFx0XHRzdWJqZWN0LnJlc3VsdC5pZCxcblx0XHQpO1xuXHR9XG5cblx0Y29uc3QgdGVzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlc3RTZXJ2aWNlKTtcblx0Y29uc3QgcGxhaW5UZXN0ID0gc3ViamVjdCBpbnN0YW5jZW9mIE1lc3NhZ2VTdWJqZWN0ID8gc3ViamVjdC50ZXN0IDogc3ViamVjdC50ZXN0Lml0ZW07XG5cdGNvbnN0IGN1cnJlbnRUZXN0ID0gdGVzdFNlcnZpY2UuY29sbGVjdGlvbi5nZXROb2RlQnlJZChwbGFpblRlc3QuZXh0SWQpO1xuXHRpZiAoIWN1cnJlbnRUZXN0KSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmV0dXJuIHRlc3RTZXJ2aWNlLnJ1blRlc3RzKHtcblx0XHRncm91cDogYml0c2V0LFxuXHRcdHRlc3RzOiBbY3VycmVudFRlc3RdLFxuXHR9KTtcbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAndGVzdGluZy5jYWxsU3RhY2sucnVuJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgndGVzdGluZy5jYWxsU3RhY2sucnVuJywgXCJSZXJ1biBUZXN0XCIpLFxuXHRcdFx0aWNvbjogaWNvbnMudGVzdGluZ1J1bkljb24sXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGVzdENhbGxTdGFjayxcblx0XHRcdFx0d2hlbjogVGVzdGluZ0NvbnRleHRLZXlzLmhhc1J1bm5hYmxlVGVzdHMsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBzdWJqZWN0OiBJbnNwZWN0U3ViamVjdCk6IHZvaWQge1xuXHRcdHJ1bkluTGFzdChhY2Nlc3NvciwgVGVzdFJ1blByb2ZpbGVCaXRzZXQuUnVuLCBzdWJqZWN0KTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3Rlc3RpbmcuY2FsbFN0YWNrLmRlYnVnJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgndGVzdGluZy5jYWxsU3RhY2suZGVidWcnLCBcIkRlYnVnIFRlc3RcIiksXG5cdFx0XHRpY29uOiBpY29ucy50ZXN0aW5nRGVidWdJY29uLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlRlc3RDYWxsU3RhY2ssXG5cdFx0XHRcdHdoZW46IFRlc3RpbmdDb250ZXh0S2V5cy5oYXNEZWJ1Z2dhYmxlVGVzdHMsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBzdWJqZWN0OiBJbnNwZWN0U3ViamVjdCk6IHZvaWQge1xuXHRcdHJ1bkluTGFzdChhY2Nlc3NvciwgVGVzdFJ1blByb2ZpbGVCaXRzZXQuRGVidWcsIHN1YmplY3QpO1xuXHR9XG59KTtcblxuZXhwb3J0IGNsYXNzIFRlc3RSZXN1bHRzVmlld0NvbnRlbnQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBzdGF0aWMgbGFzdFNwbGl0V2lkdGg/OiBudW1iZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaWRSZXZlYWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHN1YmplY3Q6IEluc3BlY3RTdWJqZWN0OyBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuIH0+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGN1cnJlbnRTdWJqZWN0U3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uQ2xvc2VFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJlbGF5PHZvaWQ+KCkpO1xuXHRwcml2YXRlIGZvbGxvd3VwV2lkZ2V0ITogRm9sbG93dXBBY3Rpb25XaWRnZXQ7XG5cdHByaXZhdGUgbWVzc2FnZUNvbnRleHRLZXlTZXJ2aWNlITogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIGNvbnRleHRLZXlUZXN0TWVzc2FnZSE6IElDb250ZXh0S2V5PHN0cmluZz47XG5cdHByaXZhdGUgY29udGV4dEtleVJlc3VsdE91dGRhdGVkITogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgc3RhY2tDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBjYWxsU3RhY2tXaWRnZXQhOiBDYWxsU3RhY2tXaWRnZXQ7XG5cdHByaXZhdGUgY3VycmVudFRvcEZyYW1lPzogTWVzc2FnZVN0YWNrRnJhbWU7XG5cdHByaXZhdGUgaXNEb2luZ0xheW91dFVwZGF0ZT86IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBkaW1lbnNpb24/OiBkb20uRGltZW5zaW9uO1xuXHRwcml2YXRlIHNwbGl0VmlldyE6IFNwbGl0Vmlldztcblx0cHJpdmF0ZSBtZXNzYWdlQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgY29udGVudFByb3ZpZGVycyE6IElQZWVrT3V0cHV0UmVuZGVyZXJbXTtcblx0cHJpdmF0ZSBjb250ZW50UHJvdmlkZXJzVXBkYXRlTGltaXRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBMaW1pdGVyKDEpKTtcblxuXHRwdWJsaWMgY3VycmVudD86IEluc3BlY3RTdWJqZWN0O1xuXG5cdC8qKiBGaXJlZCB3aGVuIGEgdHJlZSBpdGVtIGlzIHNlbGVjdGVkLiBQb3B1bGF0ZWQgb25seSBvbiAuZmlsbEJvZHkoKSAqL1xuXHRwdWJsaWMgb25EaWRSZXF1ZXN0UmV2ZWFsITogRXZlbnQ8SW5zcGVjdFN1YmplY3Q+O1xuXG5cdHB1YmxpYyByZWFkb25seSBvbkNsb3NlID0gdGhpcy5vbkNsb3NlRW1pdHRlci5ldmVudDtcblxuXHRwdWJsaWMgZ2V0IHVpU3RhdGUoKTogSVRlc3RSZXN1bHRzVmlld0NvbnRlbnRVaVN0YXRlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3BsaXRWaWV3V2lkdGhzOiBBcnJheS5mcm9tKFxuXHRcdFx0XHR7IGxlbmd0aDogdGhpcy5zcGxpdFZpZXcubGVuZ3RoIH0sXG5cdFx0XHRcdChfLCBpKSA9PiB0aGlzLnNwbGl0Vmlldy5nZXRWaWV3U2l6ZShpKVxuXHRcdFx0KSxcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGdldCBvbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuY2FsbFN0YWNrV2lkZ2V0Lm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgY29udGVudEhlaWdodCgpIHtcblx0XHRyZXR1cm4gdGhpcy5jYWxsU3RhY2tXaWRnZXQ/LmNvbnRlbnRIZWlnaHQgfHwgMDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvciB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IHtcblx0XHRcdGhpc3RvcnlWaXNpYmxlOiBJT2JzZXJ2YWJsZVZhbHVlPGJvb2xlYW4+O1xuXHRcdFx0c2hvd1JldmVhbExvY2F0aW9uT25NZXNzYWdlczogYm9vbGVhbjtcblx0XHRcdGxvY2F0aW9uRm9yUHJvZ3Jlc3M6IHN0cmluZztcblx0XHR9LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBmaWxsQm9keShjb250YWluZXJFbGVtZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGluaXRpYWxTcGl0V2lkdGggPSBUZXN0UmVzdWx0c1ZpZXdDb250ZW50Lmxhc3RTcGxpdFdpZHRoO1xuXHRcdHRoaXMuc3BsaXRWaWV3ID0gbmV3IFNwbGl0Vmlldyhjb250YWluZXJFbGVtZW50LCB7IG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIH0pO1xuXG5cdFx0Y29uc3QgeyBoaXN0b3J5VmlzaWJsZSwgc2hvd1JldmVhbExvY2F0aW9uT25NZXNzYWdlcyB9ID0gdGhpcy5vcHRpb25zO1xuXHRcdGNvbnN0IGlzSW5QZWVrVmlldyA9IHRoaXMuZWRpdG9yICE9PSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBtZXNzYWdlQ29udGFpbmVyID0gdGhpcy5tZXNzYWdlQ29udGFpbmVyID0gZG9tLiQoJy50ZXN0LW91dHB1dC1wZWVrLW1lc3NhZ2UtY29udGFpbmVyJyk7XG5cdFx0dGhpcy5zdGFja0NvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyRWxlbWVudCwgZG9tLiQoJy50ZXN0LW91dHB1dC1jYWxsLXN0YWNrLWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLmNhbGxTdGFja1dpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2FsbFN0YWNrV2lkZ2V0LCB0aGlzLnN0YWNrQ29udGFpbmVyLCB0aGlzLmVkaXRvcikpO1xuXHRcdHRoaXMuZm9sbG93dXBXaWRnZXQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZvbGxvd3VwQWN0aW9uV2lkZ2V0LCB0aGlzLmVkaXRvcikpO1xuXHRcdHRoaXMub25DbG9zZUVtaXR0ZXIuaW5wdXQgPSB0aGlzLmZvbGxvd3VwV2lkZ2V0Lm9uQ2xvc2U7XG5cblx0XHR0aGlzLmNvbnRlbnRQcm92aWRlcnMgPSBbXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERpZmZDb250ZW50UHJvdmlkZXIsIHRoaXMuZWRpdG9yLCBtZXNzYWdlQ29udGFpbmVyKSksXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtkb3duVGVzdE1lc3NhZ2VQZWVrLCBtZXNzYWdlQ29udGFpbmVyKSksXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTWVzc2FnZVBlZWssIG1lc3NhZ2VDb250YWluZXIsIGlzSW5QZWVrVmlldykpLFxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQbGFpblRleHRNZXNzYWdlUGVlaywgdGhpcy5lZGl0b3IsIG1lc3NhZ2VDb250YWluZXIpKSxcblx0XHRdO1xuXG5cdFx0dGhpcy5tZXNzYWdlQ29udGV4dEtleVNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChjb250YWluZXJFbGVtZW50KSk7XG5cdFx0dGhpcy5jb250ZXh0S2V5VGVzdE1lc3NhZ2UgPSBUZXN0aW5nQ29udGV4dEtleXMudGVzdE1lc3NhZ2VDb250ZXh0LmJpbmRUbyh0aGlzLm1lc3NhZ2VDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5jb250ZXh0S2V5UmVzdWx0T3V0ZGF0ZWQgPSBUZXN0aW5nQ29udGV4dEtleXMudGVzdFJlc3VsdE91dGRhdGVkLmJpbmRUbyh0aGlzLm1lc3NhZ2VDb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjb25zdCB0cmVlQ29udGFpbmVyID0gZG9tLmFwcGVuZChjb250YWluZXJFbGVtZW50LCBkb20uJCgnLnRlc3Qtb3V0cHV0LXBlZWstdHJlZS50ZXN0aW5nLXN0ZHRyZWUnKSk7XG5cdFx0Y29uc3QgdHJlZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRPdXRwdXRQZWVrVHJlZSxcblx0XHRcdHRyZWVDb250YWluZXIsXG5cdFx0XHR0aGlzLmRpZFJldmVhbC5ldmVudCxcblx0XHRcdHsgc2hvd1JldmVhbExvY2F0aW9uT25NZXNzYWdlcywgbG9jYXRpb25Gb3JQcm9ncmVzczogdGhpcy5vcHRpb25zLmxvY2F0aW9uRm9yUHJvZ3Jlc3MgfSxcblx0XHQpKTtcblxuXHRcdHRoaXMub25EaWRSZXF1ZXN0UmV2ZWFsID0gdHJlZS5vbkRpZFJlcXVlc3RSZXZpZXc7XG5cblx0XHR0aGlzLnNwbGl0Vmlldy5hZGRWaWV3KHtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0ZWxlbWVudDogdGhpcy5zdGFja0NvbnRhaW5lcixcblx0XHRcdG1pbmltdW1TaXplOiAyMDAsXG5cdFx0XHRtYXhpbXVtU2l6ZTogTnVtYmVyLk1BWF9WQUxVRSxcblx0XHRcdGxheW91dDogd2lkdGggPT4ge1xuXHRcdFx0XHRUZXN0UmVzdWx0c1ZpZXdDb250ZW50Lmxhc3RTcGxpdFdpZHRoID0gd2lkdGg7XG5cblx0XHRcdFx0aWYgKHRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5jYWxsU3RhY2tXaWRnZXQ/LmxheW91dCh0aGlzLmRpbWVuc2lvbi5oZWlnaHQsIHdpZHRoKTtcblx0XHRcdFx0XHR0aGlzLmxheW91dENvbnRlbnRXaWRnZXRzKHRoaXMuZGltZW5zaW9uLCB3aWR0aCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXG5cdFx0dGhpcy5zcGxpdFZpZXcuYWRkVmlldyh7XG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdGVsZW1lbnQ6IHRyZWVDb250YWluZXIsXG5cdFx0XHRtaW5pbXVtU2l6ZTogMTAwLFxuXHRcdFx0bWF4aW11bVNpemU6IE51bWJlci5NQVhfVkFMVUUsXG5cdFx0XHRsYXlvdXQ6IHdpZHRoID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHRcdFx0dHJlZS5sYXlvdXQodGhpcy5kaW1lbnNpb24uaGVpZ2h0LCB3aWR0aCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXG5cblx0XHR0aGlzLnNwbGl0Vmlldy5zZXRWaWV3VmlzaWJsZShTdWJWaWV3Lkhpc3RvcnksIGhpc3RvcnlWaXNpYmxlLnZhbHVlKTtcblx0XHR0aGlzLl9yZWdpc3RlcihoaXN0b3J5VmlzaWJsZS5vbkRpZENoYW5nZSh2aXNpYmxlID0+IHtcblx0XHRcdHRoaXMuc3BsaXRWaWV3LnNldFZpZXdWaXNpYmxlKFN1YlZpZXcuSGlzdG9yeSwgdmlzaWJsZSk7XG5cdFx0fSkpO1xuXG5cdFx0aWYgKGluaXRpYWxTcGl0V2lkdGgpIHtcblx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHRoaXMuc3BsaXRWaWV3LnJlc2l6ZVZpZXcoMCwgaW5pdGlhbFNwaXRXaWR0aCkpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTaG93cyBhIG1lc3NhZ2UgaW4tcGxhY2Ugd2l0aG91dCBzaG93aW5nIG9yIGNoYW5naW5nIHRoZSBwZWVrIGxvY2F0aW9uLlxuXHQgKiBUaGlzIGlzIG1vc3RseSB1c2VkIGlmIHBlZWtpbmcgYSBtZXNzYWdlIHdpdGhvdXQgYSBsb2NhdGlvbi5cblx0ICovXG5cdHB1YmxpYyByZXZlYWwob3B0czoge1xuXHRcdHN1YmplY3Q6IEluc3BlY3RTdWJqZWN0O1xuXHRcdHByZXNlcnZlRm9jdXM6IGJvb2xlYW47XG5cdH0pIHtcblx0XHR0aGlzLmRpZFJldmVhbC5maXJlKG9wdHMpO1xuXG5cdFx0aWYgKHRoaXMuY3VycmVudCAmJiBlcXVhbHNTdWJqZWN0KHRoaXMuY3VycmVudCwgb3B0cy5zdWJqZWN0KSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuY3VycmVudCA9IG9wdHMuc3ViamVjdDtcblx0XHRyZXR1cm4gdGhpcy5jb250ZW50UHJvdmlkZXJzVXBkYXRlTGltaXRlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLmN1cnJlbnRTdWJqZWN0U3RvcmUuY2xlYXIoKTtcblx0XHRcdGNvbnN0IGNhbGxGcmFtZXMgPSB0aGlzLmdldENhbGxGcmFtZXMob3B0cy5zdWJqZWN0KSB8fCBbXTtcblx0XHRcdGNvbnN0IHRvcEZyYW1lID0gYXdhaXQgdGhpcy5wcmVwYXJlVG9wRnJhbWUob3B0cy5zdWJqZWN0LCBjYWxsRnJhbWVzKTtcblx0XHRcdHRoaXMuc2V0Q2FsbFN0YWNrRnJhbWVzKHRvcEZyYW1lLCBjYWxsRnJhbWVzKTtcblxuXHRcdFx0dGhpcy5mb2xsb3d1cFdpZGdldC5zaG93KG9wdHMuc3ViamVjdCk7XG5cdFx0XHR0aGlzLnBvcHVsYXRlRmxvYXRpbmdDbGljayhvcHRzLnN1YmplY3QpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRDYWxsU3RhY2tGcmFtZXMobWVzc2FnZUZyYW1lOiBBbnlTdGFja0ZyYW1lLCBzdGFjazogSVRlc3RNZXNzYWdlU3RhY2tGcmFtZVtdKSB7XG5cdFx0dGhpcy5jYWxsU3RhY2tXaWRnZXQuc2V0RnJhbWVzKFttZXNzYWdlRnJhbWUsIC4uLnN0YWNrLm1hcChmcmFtZSA9PiBuZXcgQ2FsbFN0YWNrRnJhbWUoXG5cdFx0XHRmcmFtZS5sYWJlbCxcblx0XHRcdGZyYW1lLnVyaSxcblx0XHRcdGZyYW1lLnBvc2l0aW9uPy5saW5lTnVtYmVyLFxuXHRcdFx0ZnJhbWUucG9zaXRpb24/LmNvbHVtbixcblx0XHQpKV0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbGxhcHNlcyBhbGwgZGlzcGxheWVkIHN0YWNrIGZyYW1lcy5cblx0ICovXG5cdHB1YmxpYyBjb2xsYXBzZVN0YWNrKCkge1xuXHRcdHRoaXMuY2FsbFN0YWNrV2lkZ2V0LmNvbGxhcHNlQWxsKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldENhbGxGcmFtZXMoc3ViamVjdDogSW5zcGVjdFN1YmplY3QpIHtcblx0XHRpZiAoIShzdWJqZWN0IGluc3RhbmNlb2YgTWVzc2FnZVN1YmplY3QpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBmcmFtZXMgPSBzdWJqZWN0LnN0YWNrO1xuXHRcdGlmICghZnJhbWVzPy5sZW5ndGggfHwgIXRoaXMuZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gZnJhbWVzO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZSB0ZXN0IGV4dGVuc2lvbiBqdXN0IHNldHMgdGhlIHRvcCBmcmFtZSBhcyB0aGUgc2FtZSBsb2NhdGlvblxuXHRcdC8vIHdoZXJlIHRoZSBtZXNzYWdlIGlzIGRpc3BsYXllZCwgaW4gdGhlIGNhc2Ugb2YgYSBwZWVrIGluIGFuIGVkaXRvcixcblx0XHQvLyBkb24ndCBzaG93IGl0IGFnYWluIGJlY2F1c2UgaXQncyBqdXN0IGEgZHVwbGljYXRlXG5cdFx0Y29uc3QgdG9wRnJhbWUgPSBmcmFtZXNbMF07XG5cdFx0Y29uc3QgcGVla0xvY2F0aW9uID0gc3ViamVjdC5yZXZlYWxMb2NhdGlvbjtcblx0XHRjb25zdCBpc1RvcEZyYW1lU2FtZSA9IHBlZWtMb2NhdGlvbiAmJiB0b3BGcmFtZS5wb3NpdGlvbiAmJiB0b3BGcmFtZS51cmlcblx0XHRcdCYmIHRvcEZyYW1lLnBvc2l0aW9uLmxpbmVOdW1iZXIgPT09IHBlZWtMb2NhdGlvbi5yYW5nZS5zdGFydExpbmVOdW1iZXJcblx0XHRcdCYmIHRvcEZyYW1lLnBvc2l0aW9uLmNvbHVtbiA9PT0gcGVla0xvY2F0aW9uLnJhbmdlLnN0YXJ0Q29sdW1uXG5cdFx0XHQmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbCh0b3BGcmFtZS51cmksIHBlZWtMb2NhdGlvbi51cmkpO1xuXG5cdFx0cmV0dXJuIGlzVG9wRnJhbWVTYW1lID8gZnJhbWVzLnNsaWNlKDEpIDogZnJhbWVzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwcmVwYXJlVG9wRnJhbWUoc3ViamVjdDogSW5zcGVjdFN1YmplY3QsIGNhbGxGcmFtZXM6IElUZXN0TWVzc2FnZVN0YWNrRnJhbWVbXSkge1xuXHRcdC8vIGVuc3VyZSB0aGUgbWVzc2FnZUNvbnRhaW5lciBpcyBpbiB0aGUgRE9NIHNvIHJlbmRlcmVycyBjYW4gY2FsY3VsYXRlIHRoZVxuXHRcdC8vIGRpbWVuc2lvbnMgYmVmb3JlIGl0J3MgcmVuZGVyZWQgaW4gdGhlIGxpc3QuXG5cdFx0dGhpcy5tZXNzYWdlQ29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcblx0XHR0aGlzLnN0YWNrQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMubWVzc2FnZUNvbnRhaW5lcik7XG5cblx0XHRjb25zdCB0b3BGcmFtZSA9IHRoaXMuY3VycmVudFRvcEZyYW1lID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZXNzYWdlU3RhY2tGcmFtZSwgdGhpcy5tZXNzYWdlQ29udGFpbmVyLCB0aGlzLmZvbGxvd3VwV2lkZ2V0LCBzdWJqZWN0KTtcblxuXHRcdGNvbnN0IGhhc011bHRpcGxlRnJhbWVzID0gY2FsbEZyYW1lcy5sZW5ndGggPiAwO1xuXHRcdHRvcEZyYW1lLnNob3dIZWFkZXIuc2V0KGhhc011bHRpcGxlRnJhbWVzLCB1bmRlZmluZWQpO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBhd2FpdCBmaW5kQXN5bmModGhpcy5jb250ZW50UHJvdmlkZXJzLCBwID0+IHAudXBkYXRlKHN1YmplY3QpKTtcblx0XHRpZiAocHJvdmlkZXIpIHtcblx0XHRcdGNvbnN0IHdpZHRoID0gdGhpcy5zcGxpdFZpZXcuZ2V0Vmlld1NpemUoU3ViVmlldy5EaWZmKTtcblx0XHRcdGlmICh3aWR0aCAhPT0gLTEgJiYgdGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdFx0dG9wRnJhbWUuaGVpZ2h0LnNldChwcm92aWRlci5sYXlvdXQoeyB3aWR0aCwgaGVpZ2h0OiB0aGlzLmRpbWVuc2lvbj8uaGVpZ2h0IH0sIGhhc011bHRpcGxlRnJhbWVzKSEsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwcm92aWRlci5vblNjcm9sbGVkKSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFN1YmplY3RTdG9yZS5hZGQodGhpcy5jYWxsU3RhY2tXaWRnZXQub25EaWRTY3JvbGwoZXZ0ID0+IHtcblx0XHRcdFx0XHRwcm92aWRlci5vblNjcm9sbGVkIShldnQpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwcm92aWRlci5vbkRpZENvbnRlbnRTaXplQ2hhbmdlKSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudFN1YmplY3RTdG9yZS5hZGQocHJvdmlkZXIub25EaWRDb250ZW50U2l6ZUNoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuZGltZW5zaW9uICYmICF0aGlzLmlzRG9pbmdMYXlvdXRVcGRhdGUpIHtcblx0XHRcdFx0XHRcdHRoaXMuaXNEb2luZ0xheW91dFVwZGF0ZSA9IHRydWU7XG5cdFx0XHRcdFx0XHR0b3BGcmFtZS5oZWlnaHQuc2V0KHByb3ZpZGVyLmxheW91dCh0aGlzLmRpbWVuc2lvbiwgaGFzTXVsdGlwbGVGcmFtZXMpISwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdHRoaXMuaXNEb2luZ0xheW91dFVwZGF0ZSA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0b3BGcmFtZTtcblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0Q29udGVudFdpZGdldHMoZGltZW5zaW9uOiBkb20uRGltZW5zaW9uLCB3aWR0aCA9IHRoaXMuc3BsaXRWaWV3LmdldFZpZXdTaXplKFN1YlZpZXcuRGlmZikpIHtcblx0XHR0aGlzLmlzRG9pbmdMYXlvdXRVcGRhdGUgPSB0cnVlO1xuXHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgdGhpcy5jb250ZW50UHJvdmlkZXJzKSB7XG5cdFx0XHRjb25zdCBmcmFtZUhlaWdodCA9IHByb3ZpZGVyLmxheW91dCh7IGhlaWdodDogZGltZW5zaW9uLmhlaWdodCwgd2lkdGggfSwgISF0aGlzLmN1cnJlbnRUb3BGcmFtZT8uc2hvd0hlYWRlci5nZXQoKSk7XG5cdFx0XHRpZiAoZnJhbWVIZWlnaHQpIHtcblx0XHRcdFx0dGhpcy5jdXJyZW50VG9wRnJhbWU/LmhlaWdodC5zZXQoZnJhbWVIZWlnaHQsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuaXNEb2luZ0xheW91dFVwZGF0ZSA9IGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBwb3B1bGF0ZUZsb2F0aW5nQ2xpY2soc3ViamVjdDogSW5zcGVjdFN1YmplY3QpIHtcblx0XHRpZiAoIShzdWJqZWN0IGluc3RhbmNlb2YgTWVzc2FnZVN1YmplY3QpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jdXJyZW50U3ViamVjdFN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5jb250ZXh0S2V5UmVzdWx0T3V0ZGF0ZWQucmVzZXQoKTtcblx0XHRcdHRoaXMuY29udGV4dEtleVRlc3RNZXNzYWdlLnJlc2V0KCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5jb250ZXh0S2V5VGVzdE1lc3NhZ2Uuc2V0KHN1YmplY3QuY29udGV4dFZhbHVlIHx8ICcnKTtcblx0XHRpZiAoc3ViamVjdC5yZXN1bHQgaW5zdGFuY2VvZiBMaXZlVGVzdFJlc3VsdCkge1xuXHRcdFx0dGhpcy5jb250ZXh0S2V5UmVzdWx0T3V0ZGF0ZWQuc2V0KHN1YmplY3QucmVzdWx0LmdldFN0YXRlQnlJZChzdWJqZWN0LnRlc3QuZXh0SWQpPy5yZXRpcmVkID8/IGZhbHNlKTtcblx0XHRcdHRoaXMuY3VycmVudFN1YmplY3RTdG9yZS5hZGQoc3ViamVjdC5yZXN1bHQub25DaGFuZ2UoZXYgPT4ge1xuXHRcdFx0XHRpZiAoZXYuaXRlbS5pdGVtLmV4dElkID09PSBzdWJqZWN0LnRlc3QuZXh0SWQpIHtcblx0XHRcdFx0XHR0aGlzLmNvbnRleHRLZXlSZXN1bHRPdXRkYXRlZC5zZXQoZXYuaXRlbS5yZXRpcmVkID8/IGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmNvbnRleHRLZXlSZXN1bHRPdXRkYXRlZC5zZXQodHJ1ZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5zdGFTZXJ2aWNlID0gdGhpcy5jdXJyZW50U3ViamVjdFN0b3JlLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdFx0XHQuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJQ29udGV4dEtleVNlcnZpY2UsIHRoaXMubWVzc2FnZUNvbnRleHRLZXlTZXJ2aWNlXSkpKTtcblxuXHRcdHRoaXMuY3VycmVudFN1YmplY3RTdG9yZS5hZGQoaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZsb2F0aW5nQ2xpY2tNZW51LCB7XG5cdFx0XHRjb250YWluZXI6IHRoaXMubWVzc2FnZUNvbnRhaW5lcixcblx0XHRcdG1lbnVJZDogTWVudUlkLlRlc3RNZXNzYWdlQ29udGVudCxcblx0XHRcdGdldEFjdGlvbkFyZzogKCkgPT4gKHN1YmplY3QgYXMgTWVzc2FnZVN1YmplY3QpLmNvbnRleHQsXG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIG9uTGF5b3V0Qm9keShoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcikge1xuXHRcdHRoaXMuZGltZW5zaW9uID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGgsIGhlaWdodCk7XG5cdFx0dGhpcy5zcGxpdFZpZXcubGF5b3V0KHdpZHRoKTtcblx0fVxuXG5cdHB1YmxpYyBvbldpZHRoKHdpZHRoOiBudW1iZXIpIHtcblx0XHR0aGlzLnNwbGl0Vmlldy5sYXlvdXQod2lkdGgpO1xuXHR9XG59XG5cbmNvbnN0IEZPTExPV1VQX0FOSU1BVElPTl9NSU5fVElNRSA9IDUwMDtcblxuY2xhc3MgRm9sbG93dXBBY3Rpb25XaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBlbCA9IGRvbS5oKCdkaXYudGVzdGluZy1mb2xsb3d1cC1hY3Rpb24nLCBbXSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdmlzaWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkNsb3NlRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25DbG9zZSA9IHRoaXMub25DbG9zZUVtaXR0ZXIuZXZlbnQ7XG5cblx0cHVibGljIGdldCBkb21Ob2RlKCkge1xuXHRcdHJldHVybiB0aGlzLmVsLnJvb3Q7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQsXG5cdFx0QElUZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlc3RTZXJ2aWNlOiBJVGVzdFNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXQ6IElRdWlja0lucHV0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBzaG93KHN1YmplY3Q6IEluc3BlY3RTdWJqZWN0KSB7XG5cdFx0dGhpcy52aXNpYmxlU3RvcmUuY2xlYXIoKTtcblx0XHRpZiAoc3ViamVjdCBpbnN0YW5jZW9mIE1lc3NhZ2VTdWJqZWN0KSB7XG5cdFx0XHR0aGlzLnNob3dNZXNzYWdlKHN1YmplY3QpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2hvd01lc3NhZ2Uoc3ViamVjdDogTWVzc2FnZVN1YmplY3QpIHtcblx0XHRjb25zdCBjdHMgPSB0aGlzLnZpc2libGVTdG9yZS5hZGQobmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkpO1xuXHRcdGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcblxuXHRcdC8vIFdhaXQgZm9yIGNvbXBsZXRpb24gb3RoZXJ3aXNlIHJlc3VsdHMgd2lsbCBub3QgYmUgYXZhaWxhYmxlIHRvIHRoZSBleHQgaG9zdDpcblx0XHRpZiAoc3ViamVjdC5yZXN1bHQgaW5zdGFuY2VvZiBMaXZlVGVzdFJlc3VsdCAmJiAhc3ViamVjdC5yZXN1bHQuY29tcGxldGVkQXQpIHtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gRXZlbnQub25jZSgoc3ViamVjdC5yZXN1bHQgYXMgTGl2ZVRlc3RSZXN1bHQpLm9uQ29tcGxldGUpKHIpKTtcblx0XHR9XG5cblx0XHRjb25zdCBmb2xsb3d1cHMgPSBhd2FpdCB0aGlzLnRlc3RTZXJ2aWNlLnByb3ZpZGVUZXN0Rm9sbG93dXBzKHtcblx0XHRcdGV4dElkOiBzdWJqZWN0LnRlc3QuZXh0SWQsXG5cdFx0XHRtZXNzYWdlSW5kZXg6IHN1YmplY3QubWVzc2FnZUluZGV4LFxuXHRcdFx0cmVzdWx0SWQ6IHN1YmplY3QucmVzdWx0LmlkLFxuXHRcdFx0dGFza0luZGV4OiBzdWJqZWN0LnRhc2tJbmRleCxcblx0XHR9LCBjdHMudG9rZW4pO1xuXG5cblx0XHRpZiAoIWZvbGxvd3Vwcy5mb2xsb3d1cHMubGVuZ3RoIHx8IGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0Zm9sbG93dXBzLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnZpc2libGVTdG9yZS5hZGQoZm9sbG93dXBzKTtcblxuXHRcdGRvbS5jbGVhck5vZGUodGhpcy5lbC5yb290KTtcblx0XHR0aGlzLmVsLnJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnYW5pbWF0ZWQnLCBEYXRlLm5vdygpIC0gc3RhcnQgPiBGT0xMT1dVUF9BTklNQVRJT05fTUlOX1RJTUUpO1xuXG5cdFx0dGhpcy5lbC5yb290LmFwcGVuZENoaWxkKHRoaXMubWFrZUZvbGxvd3VwTGluayhmb2xsb3d1cHMuZm9sbG93dXBzWzBdKSk7XG5cdFx0aWYgKGZvbGxvd3Vwcy5mb2xsb3d1cHMubGVuZ3RoID4gMSkge1xuXHRcdFx0dGhpcy5lbC5yb290LmFwcGVuZENoaWxkKHRoaXMubWFrZU1vcmVMaW5rKGZvbGxvd3Vwcy5mb2xsb3d1cHMpKTtcblx0XHR9XG5cblx0XHR0aGlzLnZpc2libGVTdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuZWwucm9vdC5yZW1vdmUoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIG1ha2VGb2xsb3d1cExpbmsoZmlyc3Q6IElUZXN0Rm9sbG93dXApIHtcblx0XHRjb25zdCBsaW5rID0gdGhpcy5tYWtlTGluaygoKSA9PiB0aGlzLmFjdGlvbkZvbGxvd3VwKGxpbmssIGZpcnN0KSk7XG5cdFx0ZG9tLnJlc2V0KGxpbmssIC4uLnJlbmRlckxhYmVsV2l0aEljb25zKGZpcnN0Lm1lc3NhZ2UpKTtcblx0XHRyZXR1cm4gbGluaztcblx0fVxuXG5cdHByaXZhdGUgbWFrZU1vcmVMaW5rKGZvbGxvd3VwczogSVRlc3RGb2xsb3d1cFtdKSB7XG5cdFx0Y29uc3QgbGluayA9IHRoaXMubWFrZUxpbmsoKCkgPT5cblx0XHRcdHRoaXMucXVpY2tJbnB1dC5waWNrKGZvbGxvd3Vwcy5tYXAoKGYsIGkpID0+ICh7XG5cdFx0XHRcdGxhYmVsOiBmLm1lc3NhZ2UsXG5cdFx0XHRcdGluZGV4OiBpXG5cdFx0XHR9KSkpLnRoZW4ocGlja2VkID0+IHtcblx0XHRcdFx0aWYgKHBpY2tlZD8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Zm9sbG93dXBzW3BpY2tlZFswXS5pbmRleF0uZXhlY3V0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHRsaW5rLmlubmVyVGV4dCA9IGxvY2FsaXplKCd0ZXN0Rm9sbG93dXAubW9yZScsICcrezB9IE1vcmUuLi4nLCBmb2xsb3d1cHMubGVuZ3RoIC0gMSk7XG5cdFx0cmV0dXJuIGxpbms7XG5cdH1cblxuXHRwcml2YXRlIG1ha2VMaW5rKG9uQ2xpY2s6ICgpID0+IHZvaWQpIHtcblx0XHRjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRcdGxpbmsudGFiSW5kZXggPSAwO1xuXHRcdHRoaXMudmlzaWJsZVN0b3JlLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGxpbmssICdjbGljaycsIG9uQ2xpY2spKTtcblx0XHR0aGlzLnZpc2libGVTdG9yZS5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihsaW5rLCAna2V5ZG93bicsIGUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBldmVudC5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0b25DbGljaygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBsaW5rO1xuXHR9XG5cblx0cHJpdmF0ZSBhY3Rpb25Gb2xsb3d1cChsaW5rOiBIVE1MQW5jaG9yRWxlbWVudCwgZnU6IElUZXN0Rm9sbG93dXApIHtcblx0XHRpZiAobGluay5hcmlhRGlzYWJsZWQgIT09ICd0cnVlJykge1xuXHRcdFx0bGluay5hcmlhRGlzYWJsZWQgPSAndHJ1ZSc7XG5cdFx0XHRmdS5leGVjdXRlKCk7XG5cblx0XHRcdGlmICh0aGlzLmVkaXRvcikge1xuXHRcdFx0XHR0aGlzLm9uQ2xvc2VFbWl0dGVyLmZpcmUoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsYUFBYSxRQUFRLGlCQUFpQjtBQUMvQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGVBQWU7QUFDeEIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxTQUFTLE9BQU8sYUFBYTtBQUN0QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsU0FBUyx1QkFBdUI7QUFF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LENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLGlCQUFpQixPQUFzQjtBQUM5QyxVQUFNLE9BQU8sS0FBSyxTQUFTLE1BQU0sS0FBSyxlQUFlLE1BQU0sS0FBSyxDQUFDO0FBQ2pFLFFBQUksTUFBTSxNQUFNLEdBQUcscUJBQXFCLE1BQU0sT0FBTyxDQUFDO0FBQ3RELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxhQUFhLFdBQTRCO0FBQ2hELFVBQU0sT0FBTyxLQUFLO0FBQUEsTUFBUyxNQUMxQixLQUFLLFdBQVcsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFHLE9BQU87QUFBQSxRQUM3QyxPQUFPLEVBQUU7QUFBQSxRQUNULE9BQU87QUFBQSxNQUNSLEVBQUUsQ0FBQyxFQUFFLEtBQUssWUFBVTtBQUNuQixZQUFJLFFBQVEsUUFBUTtBQUNuQixvQkFBVSxPQUFPLENBQUMsRUFBRSxLQUFLLEVBQUUsUUFBUTtBQUFBLFFBQ3BDO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRjtBQUVBLFNBQUssWUFBWSxTQUFTLHFCQUFxQixnQkFBZ0IsVUFBVSxTQUFTLENBQUM7QUFDbkYsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLFNBQVMsU0FBcUI7QUFDckMsVUFBTSxPQUFPLFNBQVMsY0FBYyxHQUFHO0FBQ3ZDLFNBQUssV0FBVztBQUNoQixTQUFLLGFBQWEsSUFBSSxJQUFJLHNCQUFzQixNQUFNLFNBQVMsT0FBTyxDQUFDO0FBQ3ZFLFNBQUssYUFBYSxJQUFJLElBQUksc0JBQXNCLE1BQU0sV0FBVyxPQUFLO0FBQ3JFLFlBQU0sUUFBUSxJQUFJLHNCQUFzQixDQUFDO0FBQ3pDLFVBQUksTUFBTSxPQUFPLFFBQVEsS0FBSyxLQUFLLE1BQU0sT0FBTyxRQUFRLEtBQUssR0FBRztBQUMvRCxnQkFBUTtBQUFBLE1BQ1Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxlQUFlLE1BQXlCLElBQW1CO0FBQ2xFLFFBQUksS0FBSyxpQkFBaUIsUUFBUTtBQUNqQyxXQUFLLGVBQWU7QUFDcEIsU0FBRyxRQUFRO0FBRVgsVUFBSSxLQUFLLFFBQVE7QUFDaEIsYUFBSyxlQUFlLEtBQUs7QUFBQSxNQUMxQjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUE1R00sdUJBQU47QUFBQSxFQVlHO0FBQUEsRUFDQTtBQUFBLEdBYkc7IiwKICAibmFtZXMiOiBbIlN1YlZpZXciXQp9Cg==
