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
import { HighlightedLabel } from "../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { Action } from "../../../../base/common/actions.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Event } from "../../../../base/common/event.js";
import { createMatches } from "../../../../base/common/filters.js";
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { posix } from "../../../../base/common/path.js";
import { commonSuffixLength } from "../../../../base/common/strings.js";
import { localize } from "../../../../nls.js";
import { getActionBarActions, getContextMenuActions, MenuEntryActionViewItem, SubmenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, MenuItemAction, MenuRegistry, registerAction2, SubmenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchCompressibleAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { asCssVariable, textLinkForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ViewAction, ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { renderViewTree } from "./baseDebugView.js";
import { CONTINUE_ID, CONTINUE_LABEL, DISCONNECT_ID, DISCONNECT_LABEL, PAUSE_ID, PAUSE_LABEL, RESTART_LABEL, RESTART_SESSION_ID, STEP_INTO_ID, STEP_INTO_LABEL, STEP_OUT_ID, STEP_OUT_LABEL, STEP_OVER_ID, STEP_OVER_LABEL, STOP_ID, STOP_LABEL } from "./debugCommands.js";
import * as icons from "./debugIcons.js";
import { createDisconnectMenuItemAction } from "./debugToolBar.js";
import { CALLSTACK_VIEW_ID, CONTEXT_CALLSTACK_FOCUSED, CONTEXT_CALLSTACK_ITEM_STOPPED, CONTEXT_CALLSTACK_ITEM_TYPE, CONTEXT_CALLSTACK_SESSION_HAS_ONE_THREAD, CONTEXT_CALLSTACK_SESSION_IS_ATTACH, CONTEXT_DEBUG_STATE, CONTEXT_FOCUSED_SESSION_IS_NO_DEBUG, CONTEXT_STACK_FRAME_SUPPORTS_RESTART, getStateLabel, IDebugService, isFrameDeemphasized, State } from "../common/debug.js";
import { StackFrame, Thread, ThreadAndSessionIds } from "../common/debugModel.js";
import { isSessionAttach } from "../common/debugUtils.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const $ = dom.$;
function assignSessionContext(element, context) {
  context.sessionId = element.getId();
  return context;
}
function assignThreadContext(element, context) {
  context.threadId = element.getId();
  assignSessionContext(element.session, context);
  return context;
}
function assignStackFrameContext(element, context) {
  context.frameId = element.getId();
  context.frameName = element.name;
  context.frameLocation = { range: element.range, source: element.source.raw };
  assignThreadContext(element.thread, context);
  return context;
}
function getContext(element) {
  if (element instanceof StackFrame) {
    return assignStackFrameContext(element, {});
  } else if (element instanceof Thread) {
    return assignThreadContext(element, {});
  } else if (isDebugSession(element)) {
    return assignSessionContext(element, {});
  } else {
    return void 0;
  }
}
function getContextForContributedActions(element) {
  if (element instanceof StackFrame) {
    if (element.source.inMemory) {
      return element.source.raw.path || element.source.reference || element.source.name;
    }
    return element.source.uri.toString();
  }
  if (element instanceof Thread) {
    return element.threadId;
  }
  if (isDebugSession(element)) {
    return element.getId();
  }
  return "";
}
function getSpecificSourceName(stackFrame) {
  let callStack = stackFrame.thread.getStaleCallStack();
  callStack = callStack.length > 0 ? callStack : stackFrame.thread.getCallStack();
  const otherSources = callStack.map((sf) => sf.source).filter((s) => s !== stackFrame.source);
  let suffixLength = 0;
  otherSources.forEach((s) => {
    if (s.name === stackFrame.source.name) {
      suffixLength = Math.max(suffixLength, commonSuffixLength(stackFrame.source.uri.path, s.uri.path));
    }
  });
  if (suffixLength === 0) {
    return stackFrame.source.name;
  }
  const from = Math.max(0, stackFrame.source.uri.path.lastIndexOf(posix.sep, stackFrame.source.uri.path.length - suffixLength - 1));
  return (from > 0 ? "..." : "") + stackFrame.source.uri.path.substring(from);
}
async function expandTo(session, tree) {
  if (session.parentSession) {
    await expandTo(session.parentSession, tree);
  }
  await tree.expand(session);
}
let CallStackView = class extends ViewPane {
  constructor(options, contextMenuService, debugService, keybindingService, instantiationService, viewDescriptorService, configurationService, contextKeyService, openerService, themeService, hoverService, menuService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.options = options;
    this.debugService = debugService;
    this.menuService = menuService;
    this.needsRefresh = false;
    this.ignoreSelectionChangedEvent = false;
    this.ignoreFocusStackFrameEvent = false;
    this.autoExpandedSessions = /* @__PURE__ */ new Set();
    this.selectionNeedsUpdate = false;
    this.onCallStackChangeScheduler = this._register(new RunOnceScheduler(async () => {
      const sessions = this.debugService.getModel().getSessions();
      if (sessions.length === 0) {
        this.autoExpandedSessions.clear();
      }
      const thread = sessions.length === 1 && sessions[0].getAllThreads().length === 1 ? sessions[0].getAllThreads()[0] : void 0;
      const stoppedDetails = sessions.length === 1 ? sessions[0].getStoppedDetails() : void 0;
      if (stoppedDetails && (thread || typeof stoppedDetails.threadId !== "number")) {
        this.stateMessageLabel.textContent = stoppedDescription(stoppedDetails);
        this.stateMessageLabelHover.update(stoppedText(stoppedDetails));
        this.stateMessageLabel.classList.toggle("exception", stoppedDetails.reason === "exception");
        this.stateMessage.hidden = false;
      } else if (sessions.length === 1 && sessions[0].state === State.Running) {
        this.stateMessageLabel.textContent = localize({ key: "running", comment: ["indicates state"] }, "Running");
        this.stateMessageLabelHover.update(sessions[0].getLabel());
        this.stateMessageLabel.classList.remove("exception");
        this.stateMessage.hidden = false;
      } else {
        this.stateMessage.hidden = true;
      }
      this.updateActions();
      this.needsRefresh = false;
      this.dataSource.deemphasizedStackFramesToShow = [];
      await this.tree.updateChildren();
      try {
        const toExpand = /* @__PURE__ */ new Set();
        sessions.forEach((s) => {
          if (s.parentSession && !this.autoExpandedSessions.has(s.parentSession)) {
            toExpand.add(s.parentSession);
          }
        });
        for (const session of toExpand) {
          await expandTo(session, this.tree);
          this.autoExpandedSessions.add(session);
        }
      } catch (e) {
      }
      if (this.selectionNeedsUpdate) {
        this.selectionNeedsUpdate = false;
        await this.updateTreeSelection();
      }
    }, 50));
  }
  renderHeaderTitle(container) {
    super.renderHeaderTitle(container, this.options.title);
    this.stateMessage = dom.append(container, $("span.call-stack-state-message"));
    this.stateMessage.hidden = true;
    this.stateMessageLabel = dom.append(this.stateMessage, $("span.label"));
    this.stateMessageLabelHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.stateMessage, ""));
  }
  renderBody(container) {
    super.renderBody(container);
    this.element.classList.add("debug-pane");
    container.classList.add("debug-call-stack");
    const treeContainer = renderViewTree(container);
    this.dataSource = new CallStackDataSource(this.debugService);
    this.tree = this.instantiationService.createInstance(WorkbenchCompressibleAsyncDataTree, "CallStackView", treeContainer, new CallStackDelegate(), new CallStackCompressionDelegate(this.debugService), [
      this.instantiationService.createInstance(SessionsRenderer),
      this.instantiationService.createInstance(ThreadsRenderer),
      this.instantiationService.createInstance(StackFramesRenderer),
      this.instantiationService.createInstance(ErrorsRenderer),
      new LoadMoreRenderer(),
      new ShowMoreRenderer()
    ], this.dataSource, {
      accessibilityProvider: new CallStackAccessibilityProvider(),
      compressionEnabled: true,
      autoExpandSingleChildren: true,
      identityProvider: {
        getId: (element) => {
          if (typeof element === "string") {
            return element;
          }
          if (element instanceof Array) {
            return `showMore ${element[0].getId()}`;
          }
          return element.getId();
        }
      },
      keyboardNavigationLabelProvider: {
        getKeyboardNavigationLabel: (e) => {
          if (isDebugSession(e)) {
            return e.getLabel();
          }
          if (e instanceof Thread) {
            return `${e.name} ${e.stateLabel}`;
          }
          if (e instanceof StackFrame || typeof e === "string") {
            return e;
          }
          if (e instanceof ThreadAndSessionIds) {
            return LoadMoreRenderer.LABEL;
          }
          return localize("showMoreStackFrames2", "Show More Stack Frames");
        },
        getCompressedNodeKeyboardNavigationLabel: (e) => {
          const firstItem = e[0];
          if (isDebugSession(firstItem)) {
            return firstItem.getLabel();
          }
          return "";
        }
      },
      expandOnlyOnTwistieClick: true,
      overrideStyles: this.getLocationBasedColors().listOverrideStyles
    });
    CONTEXT_CALLSTACK_FOCUSED.bindTo(this.tree.contextKeyService);
    this.tree.setInput(this.debugService.getModel());
    this._register(this.tree);
    this._register(this.tree.onDidOpen(async (e) => {
      if (this.ignoreSelectionChangedEvent) {
        return;
      }
      const focusStackFrame = (stackFrame, thread, session, options = {}) => {
        this.ignoreFocusStackFrameEvent = true;
        try {
          this.debugService.focusStackFrame(stackFrame, thread, session, { ...options, ...{ explicit: true } });
        } finally {
          this.ignoreFocusStackFrameEvent = false;
        }
      };
      const element = e.element;
      if (element instanceof StackFrame) {
        const opts = {
          preserveFocus: e.editorOptions.preserveFocus,
          sideBySide: e.sideBySide,
          pinned: e.editorOptions.pinned
        };
        focusStackFrame(element, element.thread, element.thread.session, opts);
      }
      if (element instanceof Thread) {
        focusStackFrame(void 0, element, element.session);
      }
      if (isDebugSession(element)) {
        focusStackFrame(void 0, void 0, element);
      }
      if (element instanceof ThreadAndSessionIds) {
        const session = this.debugService.getModel().getSession(element.sessionId);
        const thread = session && session.getThread(element.threadId);
        if (thread) {
          const totalFrames = thread.stoppedDetails?.totalFrames;
          const remainingFramesCount = typeof totalFrames === "number" ? totalFrames - thread.getCallStack().length : void 0;
          await thread.fetchCallStack(remainingFramesCount);
          await this.tree.updateChildren();
        }
      }
      if (element instanceof Array) {
        this.dataSource.deemphasizedStackFramesToShow.push(...element);
        this.tree.updateChildren();
      }
    }));
    this._register(this.debugService.getModel().onDidChangeCallStack(() => {
      if (!this.isBodyVisible()) {
        this.needsRefresh = true;
        return;
      }
      if (!this.onCallStackChangeScheduler.isScheduled()) {
        this.onCallStackChangeScheduler.schedule();
      }
    }));
    const onFocusChange = Event.any(this.debugService.getViewModel().onDidFocusStackFrame, this.debugService.getViewModel().onDidFocusSession);
    this._register(onFocusChange(async () => {
      if (this.ignoreFocusStackFrameEvent) {
        return;
      }
      if (!this.isBodyVisible()) {
        this.needsRefresh = true;
        this.selectionNeedsUpdate = true;
        return;
      }
      if (this.onCallStackChangeScheduler.isScheduled()) {
        this.selectionNeedsUpdate = true;
        return;
      }
      await this.updateTreeSelection();
    }));
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    if (this.debugService.state === State.Stopped) {
      this.onCallStackChangeScheduler.schedule(0);
    }
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible && this.needsRefresh) {
        this.onCallStackChangeScheduler.schedule();
      }
    }));
    this._register(this.debugService.onDidNewSession((s) => {
      const sessionListeners = [];
      sessionListeners.push(s.onDidChangeName(() => {
        if (this.tree.hasNode(s)) {
          this.tree.rerender(s);
        }
      }));
      sessionListeners.push(s.onDidEndAdapter(() => dispose(sessionListeners)));
      if (s.parentSession) {
        this.autoExpandedSessions.delete(s.parentSession);
      }
    }));
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.tree.layout(height, width);
  }
  focus() {
    super.focus();
    this.tree.domFocus();
  }
  collapseAll() {
    this.tree.collapseAll();
  }
  async updateTreeSelection() {
    if (!this.tree || !this.tree.getInput()) {
      return;
    }
    const updateSelectionAndReveal = (element) => {
      this.ignoreSelectionChangedEvent = true;
      try {
        this.tree.setSelection([element]);
        if (this.tree.getRelativeTop(element) === null) {
          this.tree.reveal(element, 0.5);
        } else {
          this.tree.reveal(element);
        }
      } catch (e) {
      } finally {
        this.ignoreSelectionChangedEvent = false;
      }
    };
    const thread = this.debugService.getViewModel().focusedThread;
    const session = this.debugService.getViewModel().focusedSession;
    const stackFrame = this.debugService.getViewModel().focusedStackFrame;
    if (!thread) {
      if (!session) {
        this.tree.setSelection([]);
      } else {
        updateSelectionAndReveal(session);
      }
    } else {
      try {
        await expandTo(thread.session, this.tree);
      } catch (e) {
      }
      try {
        await this.tree.expand(thread);
      } catch (e) {
      }
      const toReveal = stackFrame || session;
      if (toReveal) {
        updateSelectionAndReveal(toReveal);
      }
    }
  }
  onContextMenu(e) {
    const element = e.element;
    let overlay = [];
    if (isDebugSession(element)) {
      overlay = getSessionContextOverlay(element);
    } else if (element instanceof Thread) {
      overlay = getThreadContextOverlay(element);
    } else if (element instanceof StackFrame) {
      overlay = getStackFrameContextOverlay(element);
    }
    const contextKeyService = this.contextKeyService.createOverlay(overlay);
    const menu = this.menuService.getMenuActions(MenuId.DebugCallStackContext, contextKeyService, { arg: getContextForContributedActions(element), shouldForwardArgs: true });
    const result = getContextMenuActions(menu, "inline");
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => result.secondary,
      getActionsContext: () => getContext(element)
    });
  }
};
CallStackView = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IDebugService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IMenuService)
], CallStackView);
function getSessionContextOverlay(session) {
  return [
    [CONTEXT_CALLSTACK_ITEM_TYPE.key, "session"],
    [CONTEXT_CALLSTACK_SESSION_IS_ATTACH.key, isSessionAttach(session)],
    [CONTEXT_CALLSTACK_ITEM_STOPPED.key, session.state === State.Stopped],
    [CONTEXT_CALLSTACK_SESSION_HAS_ONE_THREAD.key, session.getAllThreads().length === 1]
  ];
}
let SessionsRenderer = class {
  constructor(instantiationService, contextKeyService, hoverService, menuService) {
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.hoverService = hoverService;
    this.menuService = menuService;
  }
  get templateId() {
    return SessionsRenderer.ID;
  }
  renderTemplate(container) {
    const session = dom.append(container, $(".session"));
    dom.append(session, $(ThemeIcon.asCSSSelector(icons.callstackViewSession)));
    const name = dom.append(session, $(".name"));
    const stateLabel = dom.append(session, $("span.state.label.monaco-count-badge.long"));
    const templateDisposable = new DisposableStore();
    const label = templateDisposable.add(new HighlightedLabel(name));
    const stopActionViewItemDisposables = templateDisposable.add(new DisposableStore());
    const actionBar = templateDisposable.add(new ActionBar(session, {
      actionViewItemProvider: (action, options) => {
        if ((action.id === STOP_ID || action.id === DISCONNECT_ID) && action instanceof MenuItemAction) {
          stopActionViewItemDisposables.clear();
          const item = this.instantiationService.invokeFunction((accessor) => createDisconnectMenuItemAction(action, stopActionViewItemDisposables, accessor, { ...options, menuAsChild: false }));
          if (item) {
            return item;
          }
        }
        if (action instanceof MenuItemAction) {
          return this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate });
        } else if (action instanceof SubmenuItemAction) {
          return this.instantiationService.createInstance(SubmenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate });
        }
        return void 0;
      }
    }));
    const elementDisposable = templateDisposable.add(new DisposableStore());
    return { session, name, stateLabel, label, actionBar, elementDisposable, templateDisposable };
  }
  renderElement(element, _, data) {
    this.doRenderElement(element.element, createMatches(element.filterData), data);
  }
  renderCompressedElements(node, _index, templateData) {
    const lastElement = node.element.elements[node.element.elements.length - 1];
    const matches = createMatches(node.filterData);
    this.doRenderElement(lastElement, matches, templateData);
  }
  doRenderElement(session, matches, data) {
    const sessionHover = data.elementDisposable.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.session, localize({ key: "session", comment: ["Session is a noun"] }, "Session")));
    data.label.set(session.getLabel(), matches);
    const stoppedDetails = session.getStoppedDetails();
    const thread = session.getAllThreads().find((t) => t.stopped);
    const contextKeyService = this.contextKeyService.createOverlay(getSessionContextOverlay(session));
    const menu = data.elementDisposable.add(this.menuService.createMenu(MenuId.DebugCallStackContext, contextKeyService));
    const setupActionBar = () => {
      data.actionBar.clear();
      const { primary } = getActionBarActions(menu.getActions({ arg: getContextForContributedActions(session), shouldForwardArgs: true }), "inline");
      data.actionBar.push(primary, { icon: true, label: false });
      data.actionBar.context = getContext(session);
    };
    data.elementDisposable.add(menu.onDidChange(() => setupActionBar()));
    setupActionBar();
    data.stateLabel.style.display = "";
    if (stoppedDetails) {
      data.stateLabel.textContent = stoppedDescription(stoppedDetails);
      sessionHover.update(`${session.getLabel()}: ${stoppedText(stoppedDetails)}`);
      data.stateLabel.classList.toggle("exception", stoppedDetails.reason === "exception");
    } else if (thread && thread.stoppedDetails) {
      data.stateLabel.textContent = stoppedDescription(thread.stoppedDetails);
      sessionHover.update(`${session.getLabel()}: ${stoppedText(thread.stoppedDetails)}`);
      data.stateLabel.classList.toggle("exception", thread.stoppedDetails.reason === "exception");
    } else {
      data.stateLabel.textContent = localize({ key: "running", comment: ["indicates state"] }, "Running");
      data.stateLabel.classList.remove("exception");
    }
  }
  disposeTemplate(templateData) {
    templateData.templateDisposable.dispose();
  }
  disposeElement(_element, _, templateData) {
    templateData.elementDisposable.clear();
  }
  disposeCompressedElements(node, index, templateData, height) {
    templateData.elementDisposable.clear();
  }
};
SessionsRenderer.ID = "session";
SessionsRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IHoverService),
  __decorateParam(3, IMenuService)
], SessionsRenderer);
function getThreadContextOverlay(thread) {
  return [
    [CONTEXT_CALLSTACK_ITEM_TYPE.key, "thread"],
    [CONTEXT_CALLSTACK_ITEM_STOPPED.key, thread.stopped]
  ];
}
let ThreadsRenderer = class {
  constructor(contextKeyService, hoverService, menuService) {
    this.contextKeyService = contextKeyService;
    this.hoverService = hoverService;
    this.menuService = menuService;
  }
  get templateId() {
    return ThreadsRenderer.ID;
  }
  renderTemplate(container) {
    const thread = dom.append(container, $(".thread"));
    const name = dom.append(thread, $(".name"));
    const stateLabel = dom.append(thread, $("span.state.label.monaco-count-badge.long"));
    const templateDisposable = new DisposableStore();
    const label = templateDisposable.add(new HighlightedLabel(name));
    const actionBar = templateDisposable.add(new ActionBar(thread));
    const elementDisposable = templateDisposable.add(new DisposableStore());
    return { thread, name, stateLabel, label, actionBar, elementDisposable, templateDisposable };
  }
  renderElement(element, _index, data) {
    const thread = element.element;
    data.elementDisposable.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.thread, thread.name));
    data.label.set(thread.name, createMatches(element.filterData));
    data.stateLabel.textContent = thread.stateLabel;
    data.stateLabel.classList.toggle("exception", thread.stoppedDetails?.reason === "exception");
    const contextKeyService = this.contextKeyService.createOverlay(getThreadContextOverlay(thread));
    const menu = data.elementDisposable.add(this.menuService.createMenu(MenuId.DebugCallStackContext, contextKeyService));
    const setupActionBar = () => {
      data.actionBar.clear();
      const { primary } = getActionBarActions(menu.getActions({ arg: getContextForContributedActions(thread), shouldForwardArgs: true }), "inline");
      data.actionBar.push(primary, { icon: true, label: false });
      data.actionBar.context = getContext(thread);
    };
    data.elementDisposable.add(menu.onDidChange(() => setupActionBar()));
    setupActionBar();
  }
  renderCompressedElements(_node, _index, _templateData, _height) {
    throw new Error("Method not implemented.");
  }
  disposeElement(_element, _index, templateData) {
    templateData.elementDisposable.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposable.dispose();
  }
};
ThreadsRenderer.ID = "thread";
ThreadsRenderer = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IHoverService),
  __decorateParam(2, IMenuService)
], ThreadsRenderer);
function getStackFrameContextOverlay(stackFrame) {
  return [
    [CONTEXT_CALLSTACK_ITEM_TYPE.key, "stackFrame"],
    [CONTEXT_STACK_FRAME_SUPPORTS_RESTART.key, stackFrame.canRestart]
  ];
}
let StackFramesRenderer = class {
  constructor(hoverService, labelService, notificationService) {
    this.hoverService = hoverService;
    this.labelService = labelService;
    this.notificationService = notificationService;
  }
  get templateId() {
    return StackFramesRenderer.ID;
  }
  renderTemplate(container) {
    const stackFrame = dom.append(container, $(".stack-frame"));
    const labelDiv = dom.append(stackFrame, $("span.label.expression"));
    const file = dom.append(stackFrame, $(".file"));
    const fileName = dom.append(file, $("span.file-name"));
    const wrapper = dom.append(file, $("span.line-number-wrapper"));
    const lineNumber = dom.append(wrapper, $("span.line-number.monaco-count-badge"));
    const templateDisposable = new DisposableStore();
    const label = templateDisposable.add(new HighlightedLabel(labelDiv));
    const actionBar = templateDisposable.add(new ActionBar(stackFrame));
    return { file, fileName, label, lineNumber, stackFrame, actionBar, templateDisposable };
  }
  renderElement(element, index, data) {
    const stackFrame = element.element;
    data.stackFrame.classList.toggle("disabled", !stackFrame.source || !stackFrame.source.available || isFrameDeemphasized(stackFrame));
    data.stackFrame.classList.toggle("label", stackFrame.presentationHint === "label");
    const hasActions = !!stackFrame.thread.session.capabilities.supportsRestartFrame && stackFrame.presentationHint !== "label" && stackFrame.presentationHint !== "subtle" && stackFrame.canRestart;
    data.stackFrame.classList.toggle("has-actions", hasActions);
    let title = stackFrame.source.inMemory ? stackFrame.source.uri.path : this.labelService.getUriLabel(stackFrame.source.uri);
    if (stackFrame.source.raw.origin) {
      title += `
${stackFrame.source.raw.origin}`;
    }
    data.templateDisposable.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.file, title));
    data.label.set(stackFrame.name, createMatches(element.filterData), stackFrame.name);
    data.fileName.textContent = getSpecificSourceName(stackFrame);
    if (stackFrame.range.startLineNumber !== void 0) {
      data.lineNumber.textContent = `${stackFrame.range.startLineNumber}`;
      if (stackFrame.range.startColumn) {
        data.lineNumber.textContent += `:${stackFrame.range.startColumn}`;
      }
      data.lineNumber.classList.remove("unavailable");
    } else {
      data.lineNumber.classList.add("unavailable");
    }
    data.actionBar.clear();
    if (hasActions) {
      const action = new Action("debug.callStack.restartFrame", localize("restartFrame", "Restart Frame"), ThemeIcon.asClassName(icons.debugRestartFrame), true, async () => {
        try {
          await stackFrame.restart();
        } catch (e) {
          this.notificationService.error(e);
        }
      });
      data.actionBar.push(action, { icon: true, label: false });
    }
  }
  renderCompressedElements(node, index, templateData, height) {
    throw new Error("Method not implemented.");
  }
  disposeTemplate(templateData) {
    templateData.actionBar.dispose();
  }
};
StackFramesRenderer.ID = "stackFrame";
StackFramesRenderer = __decorateClass([
  __decorateParam(0, IHoverService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, INotificationService)
], StackFramesRenderer);
let ErrorsRenderer = class {
  constructor(hoverService) {
    this.hoverService = hoverService;
  }
  get templateId() {
    return ErrorsRenderer.ID;
  }
  renderTemplate(container) {
    const label = dom.append(container, $(".error"));
    return { label, templateDisposable: new DisposableStore() };
  }
  renderElement(element, index, data) {
    const error = element.element;
    data.label.textContent = error;
    data.templateDisposable.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.label, error));
  }
  renderCompressedElements(node, index, templateData, height) {
    throw new Error("Method not implemented.");
  }
  disposeTemplate(templateData) {
  }
};
ErrorsRenderer.ID = "error";
ErrorsRenderer = __decorateClass([
  __decorateParam(0, IHoverService)
], ErrorsRenderer);
const _LoadMoreRenderer = class _LoadMoreRenderer {
  constructor() {
  }
  get templateId() {
    return _LoadMoreRenderer.ID;
  }
  renderTemplate(container) {
    const label = dom.append(container, $(".load-all"));
    label.style.color = asCssVariable(textLinkForeground);
    return { label };
  }
  renderElement(element, index, data) {
    data.label.textContent = _LoadMoreRenderer.LABEL;
  }
  renderCompressedElements(node, index, templateData, height) {
    throw new Error("Method not implemented.");
  }
  disposeTemplate(templateData) {
  }
};
_LoadMoreRenderer.ID = "loadMore";
_LoadMoreRenderer.LABEL = localize("loadAllStackFrames", "Load More Stack Frames");
let LoadMoreRenderer = _LoadMoreRenderer;
const _ShowMoreRenderer = class _ShowMoreRenderer {
  constructor() {
  }
  get templateId() {
    return _ShowMoreRenderer.ID;
  }
  renderTemplate(container) {
    const label = dom.append(container, $(".show-more"));
    label.style.color = asCssVariable(textLinkForeground);
    return { label };
  }
  renderElement(element, index, data) {
    const stackFrames = element.element;
    if (stackFrames.every((sf) => !!(sf.source && sf.source.origin && sf.source.origin === stackFrames[0].source.origin))) {
      data.label.textContent = localize("showMoreAndOrigin", "Show {0} More: {1}", stackFrames.length, stackFrames[0].source.origin);
    } else {
      data.label.textContent = localize("showMoreStackFrames", "Show {0} More Stack Frames", stackFrames.length);
    }
  }
  renderCompressedElements(node, index, templateData, height) {
    throw new Error("Method not implemented.");
  }
  disposeTemplate(templateData) {
  }
};
_ShowMoreRenderer.ID = "showMore";
let ShowMoreRenderer = _ShowMoreRenderer;
class CallStackDelegate {
  getHeight(element) {
    if (element instanceof StackFrame && element.presentationHint === "label") {
      return 16;
    }
    if (element instanceof ThreadAndSessionIds || element instanceof Array) {
      return 16;
    }
    return 22;
  }
  getTemplateId(element) {
    if (isDebugSession(element)) {
      return SessionsRenderer.ID;
    }
    if (element instanceof Thread) {
      return ThreadsRenderer.ID;
    }
    if (element instanceof StackFrame) {
      return StackFramesRenderer.ID;
    }
    if (typeof element === "string") {
      return ErrorsRenderer.ID;
    }
    if (element instanceof ThreadAndSessionIds) {
      return LoadMoreRenderer.ID;
    }
    return ShowMoreRenderer.ID;
  }
}
function stoppedText(stoppedDetails) {
  return stoppedDetails.text ?? stoppedDescription(stoppedDetails);
}
function stoppedDescription(stoppedDetails) {
  return stoppedDetails.description || (stoppedDetails.reason ? localize({ key: "pausedOn", comment: ["indicates reason for program being paused"] }, "Paused on {0}", stoppedDetails.reason) : localize("paused", "Paused"));
}
function isDebugModel(obj) {
  return typeof obj.getSessions === "function";
}
function isDebugSession(obj) {
  return obj && typeof obj.getAllThreads === "function";
}
class CallStackDataSource {
  constructor(debugService) {
    this.debugService = debugService;
    this.deemphasizedStackFramesToShow = [];
  }
  hasChildren(element) {
    if (isDebugSession(element)) {
      const threads = element.getAllThreads();
      return threads.length > 1 || threads.length === 1 && threads[0].stopped || !!this.debugService.getModel().getSessions().find((s) => s.parentSession === element);
    }
    return isDebugModel(element) || element instanceof Thread && element.stopped;
  }
  async getChildren(element) {
    if (isDebugModel(element)) {
      const sessions = element.getSessions();
      if (sessions.length === 0) {
        return Promise.resolve([]);
      }
      if (sessions.length > 1 || this.debugService.getViewModel().isMultiSessionView()) {
        return Promise.resolve(sessions.filter((s) => !s.parentSession));
      }
      const threads = sessions[0].getAllThreads();
      return threads.length === 1 ? this.getThreadChildren(threads[0]) : Promise.resolve(threads);
    } else if (isDebugSession(element)) {
      const childSessions = this.debugService.getModel().getSessions().filter((s) => s.parentSession === element);
      const threads = element.getAllThreads();
      if (threads.length === 1) {
        const children = await this.getThreadChildren(threads[0]);
        return children.concat(childSessions);
      }
      return Promise.resolve(threads.concat(childSessions));
    } else {
      return this.getThreadChildren(element);
    }
  }
  getThreadChildren(thread) {
    return this.getThreadCallstack(thread).then((children) => {
      const result = [];
      children.forEach((child, index) => {
        if (child instanceof StackFrame && child.source && isFrameDeemphasized(child)) {
          if (this.deemphasizedStackFramesToShow.indexOf(child) === -1) {
            if (result.length) {
              const last = result[result.length - 1];
              if (last instanceof Array) {
                last.push(child);
                return;
              }
            }
            const nextChild = index < children.length - 1 ? children[index + 1] : void 0;
            if (nextChild instanceof StackFrame && nextChild.source && isFrameDeemphasized(nextChild)) {
              result.push([child]);
              return;
            }
          }
        }
        result.push(child);
      });
      return result;
    });
  }
  async getThreadCallstack(thread) {
    let callStack = thread.getCallStack();
    if (!callStack || !callStack.length) {
      await thread.fetchCallStack();
      callStack = thread.getCallStack();
    }
    if (callStack.length === 1 && thread.session.capabilities.supportsDelayedStackTraceLoading && thread.stoppedDetails && thread.stoppedDetails.totalFrames && thread.stoppedDetails.totalFrames > 1) {
      callStack = callStack.concat(thread.getStaleCallStack().slice(1));
    }
    if (thread.stoppedDetails && thread.stoppedDetails.framesErrorMessage) {
      callStack = callStack.concat([thread.stoppedDetails.framesErrorMessage]);
    }
    if (!thread.reachedEndOfCallStack && thread.stoppedDetails) {
      callStack = callStack.concat([new ThreadAndSessionIds(thread.session.getId(), thread.threadId)]);
    }
    return callStack;
  }
}
class CallStackAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize({ comment: ["Debug is a noun in this context, not a verb."], key: "callStackAriaLabel" }, "Debug Call Stack");
  }
  getWidgetRole() {
    return "treegrid";
  }
  getRole(_element) {
    return "row";
  }
  getAriaLabel(element) {
    if (element instanceof Thread) {
      return localize({ key: "threadAriaLabel", comment: ['Placeholders stand for the thread name and the thread state.For example "Thread 1" and "Stopped'] }, "Thread {0} {1}", element.name, element.stateLabel);
    }
    if (element instanceof StackFrame) {
      return localize("stackFrameAriaLabel", "Stack Frame {0}, line {1}, {2}", element.name, element.range.startLineNumber, getSpecificSourceName(element));
    }
    if (isDebugSession(element)) {
      const thread = element.getAllThreads().find((t) => t.stopped);
      const state = thread ? thread.stateLabel : localize({ key: "running", comment: ["indicates state"] }, "Running");
      return localize({ key: "sessionLabel", comment: ['Placeholders stand for the session name and the session state. For example "Launch Program" and "Running"'] }, "Session {0} {1}", element.getLabel(), state);
    }
    if (typeof element === "string") {
      return element;
    }
    if (element instanceof Array) {
      return localize("showMoreStackFrames", "Show {0} More Stack Frames", element.length);
    }
    return LoadMoreRenderer.LABEL;
  }
}
class CallStackCompressionDelegate {
  constructor(debugService) {
    this.debugService = debugService;
  }
  isIncompressible(stat) {
    if (isDebugSession(stat)) {
      if (stat.compact) {
        return false;
      }
      const sessions = this.debugService.getModel().getSessions();
      if (sessions.some((s) => s.parentSession === stat && s.compact)) {
        return false;
      }
      return true;
    }
    return true;
  }
}
registerAction2(class Collapse extends ViewAction {
  constructor() {
    super({
      id: "callStack.collapse",
      viewId: CALLSTACK_VIEW_ID,
      title: localize("collapse", "Collapse All"),
      f1: false,
      icon: Codicon.collapseAll,
      precondition: CONTEXT_DEBUG_STATE.isEqualTo(getStateLabel(State.Stopped)),
      menu: {
        id: MenuId.ViewTitle,
        order: 10,
        group: "navigation",
        when: ContextKeyExpr.equals("view", CALLSTACK_VIEW_ID)
      }
    });
  }
  runInView(_accessor, view) {
    view.collapseAll();
  }
});
function registerCallStackInlineMenuItem(id, title, icon, when, order, precondition) {
  MenuRegistry.appendMenuItem(MenuId.DebugCallStackContext, {
    group: "inline",
    order,
    when,
    command: { id, title, icon, precondition }
  });
}
const threadOrSessionWithOneThread = ContextKeyExpr.or(CONTEXT_CALLSTACK_ITEM_TYPE.isEqualTo("thread"), ContextKeyExpr.and(CONTEXT_CALLSTACK_ITEM_TYPE.isEqualTo("session"), CONTEXT_CALLSTACK_SESSION_HAS_ONE_THREAD));
registerCallStackInlineMenuItem(PAUSE_ID, PAUSE_LABEL, icons.debugPause, ContextKeyExpr.and(threadOrSessionWithOneThread, CONTEXT_CALLSTACK_ITEM_STOPPED.toNegated()), 10, CONTEXT_FOCUSED_SESSION_IS_NO_DEBUG.toNegated());
registerCallStackInlineMenuItem(CONTINUE_ID, CONTINUE_LABEL, icons.debugContinue, ContextKeyExpr.and(threadOrSessionWithOneThread, CONTEXT_CALLSTACK_ITEM_STOPPED), 10);
registerCallStackInlineMenuItem(STEP_OVER_ID, STEP_OVER_LABEL, icons.debugStepOver, threadOrSessionWithOneThread, 20, CONTEXT_CALLSTACK_ITEM_STOPPED);
registerCallStackInlineMenuItem(STEP_INTO_ID, STEP_INTO_LABEL, icons.debugStepInto, threadOrSessionWithOneThread, 30, CONTEXT_CALLSTACK_ITEM_STOPPED);
registerCallStackInlineMenuItem(STEP_OUT_ID, STEP_OUT_LABEL, icons.debugStepOut, threadOrSessionWithOneThread, 40, CONTEXT_CALLSTACK_ITEM_STOPPED);
registerCallStackInlineMenuItem(RESTART_SESSION_ID, RESTART_LABEL, icons.debugRestart, CONTEXT_CALLSTACK_ITEM_TYPE.isEqualTo("session"), 50);
registerCallStackInlineMenuItem(STOP_ID, STOP_LABEL, icons.debugStop, ContextKeyExpr.and(CONTEXT_CALLSTACK_SESSION_IS_ATTACH.toNegated(), CONTEXT_CALLSTACK_ITEM_TYPE.isEqualTo("session")), 60);
registerCallStackInlineMenuItem(DISCONNECT_ID, DISCONNECT_LABEL, icons.debugDisconnect, ContextKeyExpr.and(CONTEXT_CALLSTACK_SESSION_IS_ATTACH, CONTEXT_CALLSTACK_ITEM_TYPE.isEqualTo("session")), 60);
export {
  CallStackView,
  getContext,
  getContextForContributedActions,
  getSpecificSourceName
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2NhbGxTdGFja1ZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBBcmlhUm9sZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgSGlnaGxpZ2h0ZWRMYWJlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9oaWdobGlnaHRlZGxhYmVsL2hpZ2hsaWdodGVkTGFiZWwuanMnO1xuaW1wb3J0IHsgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBJVHJlZUNvbXByZXNzaW9uRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hc3luY0RhdGFUcmVlLmpzJztcbmltcG9ydCB7IElDb21wcmVzc2VkVHJlZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9jb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsLmpzJztcbmltcG9ydCB7IElDb21wcmVzc2libGVUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9vYmplY3RUcmVlLmpzJztcbmltcG9ydCB7IElBc3luY0RhdGFTb3VyY2UsIElUcmVlQ29udGV4dE1lbnVFdmVudCwgSVRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNYXRjaGVzLCBGdXp6eVNjb3JlLCBJTWF0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcG9zaXggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGNvbW1vblN1ZmZpeExlbmd0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRBY3Rpb25UaXRsZSwgSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IGdldEFjdGlvbkJhckFjdGlvbnMsIGdldENvbnRleHRNZW51QWN0aW9ucywgTWVudUVudHJ5QWN0aW9uVmlld0l0ZW0sIFN1Ym1lbnVFbnRyeUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkLCBNZW51SXRlbUFjdGlvbiwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIsIFN1Ym1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBDb250ZXh0S2V5RXhwcmVzc2lvbiwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlLCB0ZXh0TGlua0ZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVmlld0FjdGlvbiwgVmlld1BhbmUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lLmpzJztcbmltcG9ydCB7IElWaWV3bGV0Vmlld09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdzVmlld2xldC5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IHJlbmRlclZpZXdUcmVlIH0gZnJvbSAnLi9iYXNlRGVidWdWaWV3LmpzJztcbmltcG9ydCB7IENPTlRJTlVFX0lELCBDT05USU5VRV9MQUJFTCwgRElTQ09OTkVDVF9JRCwgRElTQ09OTkVDVF9MQUJFTCwgUEFVU0VfSUQsIFBBVVNFX0xBQkVMLCBSRVNUQVJUX0xBQkVMLCBSRVNUQVJUX1NFU1NJT05fSUQsIFNURVBfSU5UT19JRCwgU1RFUF9JTlRPX0xBQkVMLCBTVEVQX09VVF9JRCwgU1RFUF9PVVRfTEFCRUwsIFNURVBfT1ZFUl9JRCwgU1RFUF9PVkVSX0xBQkVMLCBTVE9QX0lELCBTVE9QX0xBQkVMIH0gZnJvbSAnLi9kZWJ1Z0NvbW1hbmRzLmpzJztcbmltcG9ydCAqIGFzIGljb25zIGZyb20gJy4vZGVidWdJY29ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEaXNjb25uZWN0TWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuL2RlYnVnVG9vbEJhci5qcyc7XG5pbXBvcnQgeyBDQUxMU1RBQ0tfVklFV19JRCwgQ09OVEVYVF9DQUxMU1RBQ0tfRk9DVVNFRCwgQ09OVEVYVF9DQUxMU1RBQ0tfSVRFTV9TVE9QUEVELCBDT05URVhUX0NBTExTVEFDS19JVEVNX1RZUEUsIENPTlRFWFRfQ0FMTFNUQUNLX1NFU1NJT05fSEFTX09ORV9USFJFQUQsIENPTlRFWFRfQ0FMTFNUQUNLX1NFU1NJT05fSVNfQVRUQUNILCBDT05URVhUX0RFQlVHX1NUQVRFLCBDT05URVhUX0ZPQ1VTRURfU0VTU0lPTl9JU19OT19ERUJVRywgQ09OVEVYVF9TVEFDS19GUkFNRV9TVVBQT1JUU19SRVNUQVJULCBnZXRTdGF0ZUxhYmVsLCBJRGVidWdNb2RlbCwgSURlYnVnU2VydmljZSwgSURlYnVnU2Vzc2lvbiwgSVJhd1N0b3BwZWREZXRhaWxzLCBpc0ZyYW1lRGVlbXBoYXNpemVkLCBJU3RhY2tGcmFtZSwgSVRocmVhZCwgU3RhdGUgfSBmcm9tICcuLi9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgU3RhY2tGcmFtZSwgVGhyZWFkLCBUaHJlYWRBbmRTZXNzaW9uSWRzIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnTW9kZWwuanMnO1xuaW1wb3J0IHsgaXNTZXNzaW9uQXR0YWNoIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnVXRpbHMuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHR5cGUgeyBJTWFuYWdlZEhvdmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG50eXBlIENhbGxTdGFja0l0ZW0gPSBJU3RhY2tGcmFtZSB8IElUaHJlYWQgfCBJRGVidWdTZXNzaW9uIHwgc3RyaW5nIHwgVGhyZWFkQW5kU2Vzc2lvbklkcyB8IElTdGFja0ZyYW1lW107XG5cbmZ1bmN0aW9uIGFzc2lnblNlc3Npb25Db250ZXh0KGVsZW1lbnQ6IElEZWJ1Z1Nlc3Npb24sIGNvbnRleHQ6IGFueSkge1xuXHRjb250ZXh0LnNlc3Npb25JZCA9IGVsZW1lbnQuZ2V0SWQoKTtcblx0cmV0dXJuIGNvbnRleHQ7XG59XG5cbmZ1bmN0aW9uIGFzc2lnblRocmVhZENvbnRleHQoZWxlbWVudDogSVRocmVhZCwgY29udGV4dDogYW55KSB7XG5cdGNvbnRleHQudGhyZWFkSWQgPSBlbGVtZW50LmdldElkKCk7XG5cdGFzc2lnblNlc3Npb25Db250ZXh0KGVsZW1lbnQuc2Vzc2lvbiwgY29udGV4dCk7XG5cdHJldHVybiBjb250ZXh0O1xufVxuXG5mdW5jdGlvbiBhc3NpZ25TdGFja0ZyYW1lQ29udGV4dChlbGVtZW50OiBTdGFja0ZyYW1lLCBjb250ZXh0OiBhbnkpIHtcblx0Y29udGV4dC5mcmFtZUlkID0gZWxlbWVudC5nZXRJZCgpO1xuXHRjb250ZXh0LmZyYW1lTmFtZSA9IGVsZW1lbnQubmFtZTtcblx0Y29udGV4dC5mcmFtZUxvY2F0aW9uID0geyByYW5nZTogZWxlbWVudC5yYW5nZSwgc291cmNlOiBlbGVtZW50LnNvdXJjZS5yYXcgfTtcblx0YXNzaWduVGhyZWFkQ29udGV4dChlbGVtZW50LnRocmVhZCwgY29udGV4dCk7XG5cdHJldHVybiBjb250ZXh0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q29udGV4dChlbGVtZW50OiBDYWxsU3RhY2tJdGVtIHwgbnVsbCk6IGFueSB7XG5cdGlmIChlbGVtZW50IGluc3RhbmNlb2YgU3RhY2tGcmFtZSkge1xuXHRcdHJldHVybiBhc3NpZ25TdGFja0ZyYW1lQ29udGV4dChlbGVtZW50LCB7fSk7XG5cdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRocmVhZCkge1xuXHRcdHJldHVybiBhc3NpZ25UaHJlYWRDb250ZXh0KGVsZW1lbnQsIHt9KTtcblx0fSBlbHNlIGlmIChpc0RlYnVnU2Vzc2lvbihlbGVtZW50KSkge1xuXHRcdHJldHVybiBhc3NpZ25TZXNzaW9uQ29udGV4dChlbGVtZW50LCB7fSk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG4vLyBFeHRlbnNpb25zIGRlcGVuZCBvbiB0aGlzIGNvbnRleHQsIHNob3VsZCBub3QgYmUgY2hhbmdlZCBldmVuIHRob3VnaCBpdCBpcyBub3QgZnVsbHkgZGV0ZXJtaW5pc3RpY1xuZXhwb3J0IGZ1bmN0aW9uIGdldENvbnRleHRGb3JDb250cmlidXRlZEFjdGlvbnMoZWxlbWVudDogQ2FsbFN0YWNrSXRlbSB8IG51bGwpOiBzdHJpbmcgfCBudW1iZXIge1xuXHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFN0YWNrRnJhbWUpIHtcblx0XHRpZiAoZWxlbWVudC5zb3VyY2UuaW5NZW1vcnkpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LnNvdXJjZS5yYXcucGF0aCB8fCBlbGVtZW50LnNvdXJjZS5yZWZlcmVuY2UgfHwgZWxlbWVudC5zb3VyY2UubmFtZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZWxlbWVudC5zb3VyY2UudXJpLnRvU3RyaW5nKCk7XG5cdH1cblx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBUaHJlYWQpIHtcblx0XHRyZXR1cm4gZWxlbWVudC50aHJlYWRJZDtcblx0fVxuXHRpZiAoaXNEZWJ1Z1Nlc3Npb24oZWxlbWVudCkpIHtcblx0XHRyZXR1cm4gZWxlbWVudC5nZXRJZCgpO1xuXHR9XG5cblx0cmV0dXJuICcnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3BlY2lmaWNTb3VyY2VOYW1lKHN0YWNrRnJhbWU6IElTdGFja0ZyYW1lKTogc3RyaW5nIHtcblx0Ly8gVG8gcmVkdWNlIGZsYXNoaW5nIG9mIHRoZSBwYXRoIG5hbWUgYW5kIHRoZSB3YXkgd2UgZmV0Y2ggc3RhY2sgZnJhbWVzXG5cdC8vIFdlIG5lZWQgdG8gY29tcHV0ZSB0aGUgc291cmNlIG5hbWUgYmFzZWQgb24gdGhlIG90aGVyIGZyYW1lcyBpbiB0aGUgc3RhbGUgY2FsbCBzdGFja1xuXHRsZXQgY2FsbFN0YWNrID0gKDxUaHJlYWQ+c3RhY2tGcmFtZS50aHJlYWQpLmdldFN0YWxlQ2FsbFN0YWNrKCk7XG5cdGNhbGxTdGFjayA9IGNhbGxTdGFjay5sZW5ndGggPiAwID8gY2FsbFN0YWNrIDogc3RhY2tGcmFtZS50aHJlYWQuZ2V0Q2FsbFN0YWNrKCk7XG5cdGNvbnN0IG90aGVyU291cmNlcyA9IGNhbGxTdGFjay5tYXAoc2YgPT4gc2Yuc291cmNlKS5maWx0ZXIocyA9PiBzICE9PSBzdGFja0ZyYW1lLnNvdXJjZSk7XG5cdGxldCBzdWZmaXhMZW5ndGggPSAwO1xuXHRvdGhlclNvdXJjZXMuZm9yRWFjaChzID0+IHtcblx0XHRpZiAocy5uYW1lID09PSBzdGFja0ZyYW1lLnNvdXJjZS5uYW1lKSB7XG5cdFx0XHRzdWZmaXhMZW5ndGggPSBNYXRoLm1heChzdWZmaXhMZW5ndGgsIGNvbW1vblN1ZmZpeExlbmd0aChzdGFja0ZyYW1lLnNvdXJjZS51cmkucGF0aCwgcy51cmkucGF0aCkpO1xuXHRcdH1cblx0fSk7XG5cdGlmIChzdWZmaXhMZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gc3RhY2tGcmFtZS5zb3VyY2UubmFtZTtcblx0fVxuXG5cdGNvbnN0IGZyb20gPSBNYXRoLm1heCgwLCBzdGFja0ZyYW1lLnNvdXJjZS51cmkucGF0aC5sYXN0SW5kZXhPZihwb3NpeC5zZXAsIHN0YWNrRnJhbWUuc291cmNlLnVyaS5wYXRoLmxlbmd0aCAtIHN1ZmZpeExlbmd0aCAtIDEpKTtcblx0cmV0dXJuIChmcm9tID4gMCA/ICcuLi4nIDogJycpICsgc3RhY2tGcmFtZS5zb3VyY2UudXJpLnBhdGguc3Vic3RyaW5nKGZyb20pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBleHBhbmRUbyhzZXNzaW9uOiBJRGVidWdTZXNzaW9uLCB0cmVlOiBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPElEZWJ1Z01vZGVsLCBDYWxsU3RhY2tJdGVtLCBGdXp6eVNjb3JlPik6IFByb21pc2U8dm9pZD4ge1xuXHRpZiAoc2Vzc2lvbi5wYXJlbnRTZXNzaW9uKSB7XG5cdFx0YXdhaXQgZXhwYW5kVG8oc2Vzc2lvbi5wYXJlbnRTZXNzaW9uLCB0cmVlKTtcblx0fVxuXHRhd2FpdCB0cmVlLmV4cGFuZChzZXNzaW9uKTtcbn1cblxuZXhwb3J0IGNsYXNzIENhbGxTdGFja1ZpZXcgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cdHByaXZhdGUgc3RhdGVNZXNzYWdlITogSFRNTFNwYW5FbGVtZW50O1xuXHRwcml2YXRlIHN0YXRlTWVzc2FnZUxhYmVsITogSFRNTFNwYW5FbGVtZW50O1xuXHRwcml2YXRlIHN0YXRlTWVzc2FnZUxhYmVsSG92ZXIhOiBJTWFuYWdlZEhvdmVyO1xuXHRwcml2YXRlIG9uQ2FsbFN0YWNrQ2hhbmdlU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIG5lZWRzUmVmcmVzaCA9IGZhbHNlO1xuXHRwcml2YXRlIGlnbm9yZVNlbGVjdGlvbkNoYW5nZWRFdmVudCA9IGZhbHNlO1xuXHRwcml2YXRlIGlnbm9yZUZvY3VzU3RhY2tGcmFtZUV2ZW50ID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBkYXRhU291cmNlITogQ2FsbFN0YWNrRGF0YVNvdXJjZTtcblx0cHJpdmF0ZSB0cmVlITogV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxJRGVidWdNb2RlbCwgQ2FsbFN0YWNrSXRlbSwgRnV6enlTY29yZT47XG5cdHByaXZhdGUgYXV0b0V4cGFuZGVkU2Vzc2lvbnMgPSBuZXcgU2V0PElEZWJ1Z1Nlc3Npb24+KCk7XG5cdHByaXZhdGUgc2VsZWN0aW9uTmVlZHNVcGRhdGUgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIG9wdGlvbnM6IElWaWV3bGV0Vmlld09wdGlvbnMsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKG9wdGlvbnMsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXG5cdFx0Ly8gQ3JlYXRlIHNjaGVkdWxlciB0byBwcmV2ZW50IHVubmVjZXNzYXJ5IGZsYXNoaW5nIG9mIHRyZWUgd2hlbiByZWFjdGluZyB0byBjaGFuZ2VzXG5cdFx0dGhpcy5vbkNhbGxTdGFja0NoYW5nZVNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKGFzeW5jICgpID0+IHtcblx0XHRcdC8vIE9ubHkgc2hvdyB0aGUgZ2xvYmFsIHBhdXNlIG1lc3NhZ2UgaWYgd2UgZG8gbm90IGRpc3BsYXkgdGhyZWFkcy5cblx0XHRcdC8vIE90aGVyd2lzZSB0aGVyZSB3aWxsIGJlIGEgcGF1c2UgbWVzc2FnZSBwZXIgdGhyZWFkIGFuZCB0aGVyZSBpcyBubyBuZWVkIGZvciBhIGdsb2JhbCBvbmUuXG5cdFx0XHRjb25zdCBzZXNzaW9ucyA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbnMoKTtcblx0XHRcdGlmIChzZXNzaW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dGhpcy5hdXRvRXhwYW5kZWRTZXNzaW9ucy5jbGVhcigpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0aHJlYWQgPSBzZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc2Vzc2lvbnNbMF0uZ2V0QWxsVGhyZWFkcygpLmxlbmd0aCA9PT0gMSA/IHNlc3Npb25zWzBdLmdldEFsbFRocmVhZHMoKVswXSA6IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IHN0b3BwZWREZXRhaWxzID0gc2Vzc2lvbnMubGVuZ3RoID09PSAxID8gc2Vzc2lvbnNbMF0uZ2V0U3RvcHBlZERldGFpbHMoKSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmIChzdG9wcGVkRGV0YWlscyAmJiAodGhyZWFkIHx8IHR5cGVvZiBzdG9wcGVkRGV0YWlscy50aHJlYWRJZCAhPT0gJ251bWJlcicpKSB7XG5cdFx0XHRcdHRoaXMuc3RhdGVNZXNzYWdlTGFiZWwudGV4dENvbnRlbnQgPSBzdG9wcGVkRGVzY3JpcHRpb24oc3RvcHBlZERldGFpbHMpO1xuXHRcdFx0XHR0aGlzLnN0YXRlTWVzc2FnZUxhYmVsSG92ZXIudXBkYXRlKHN0b3BwZWRUZXh0KHN0b3BwZWREZXRhaWxzKSk7XG5cdFx0XHRcdHRoaXMuc3RhdGVNZXNzYWdlTGFiZWwuY2xhc3NMaXN0LnRvZ2dsZSgnZXhjZXB0aW9uJywgc3RvcHBlZERldGFpbHMucmVhc29uID09PSAnZXhjZXB0aW9uJyk7XG5cdFx0XHRcdHRoaXMuc3RhdGVNZXNzYWdlLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0fSBlbHNlIGlmIChzZXNzaW9ucy5sZW5ndGggPT09IDEgJiYgc2Vzc2lvbnNbMF0uc3RhdGUgPT09IFN0YXRlLlJ1bm5pbmcpIHtcblx0XHRcdFx0dGhpcy5zdGF0ZU1lc3NhZ2VMYWJlbC50ZXh0Q29udGVudCA9IGxvY2FsaXplKHsga2V5OiAncnVubmluZycsIGNvbW1lbnQ6IFsnaW5kaWNhdGVzIHN0YXRlJ10gfSwgXCJSdW5uaW5nXCIpO1xuXHRcdFx0XHR0aGlzLnN0YXRlTWVzc2FnZUxhYmVsSG92ZXIudXBkYXRlKHNlc3Npb25zWzBdLmdldExhYmVsKCkpO1xuXHRcdFx0XHR0aGlzLnN0YXRlTWVzc2FnZUxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoJ2V4Y2VwdGlvbicpO1xuXHRcdFx0XHR0aGlzLnN0YXRlTWVzc2FnZS5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc3RhdGVNZXNzYWdlLmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZUFjdGlvbnMoKTtcblxuXHRcdFx0dGhpcy5uZWVkc1JlZnJlc2ggPSBmYWxzZTtcblx0XHRcdHRoaXMuZGF0YVNvdXJjZS5kZWVtcGhhc2l6ZWRTdGFja0ZyYW1lc1RvU2hvdyA9IFtdO1xuXHRcdFx0YXdhaXQgdGhpcy50cmVlLnVwZGF0ZUNoaWxkcmVuKCk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCB0b0V4cGFuZCA9IG5ldyBTZXQ8SURlYnVnU2Vzc2lvbj4oKTtcblx0XHRcdFx0c2Vzc2lvbnMuZm9yRWFjaChzID0+IHtcblx0XHRcdFx0XHQvLyBBdXRvbWF0aWNhbGx5IGV4cGFuZCBzZXNzaW9ucyB0aGF0IGhhdmUgY2hpbGRyZW4sIGJ1dCBvbmx5IGRvIHRoaXMgb25jZS5cblx0XHRcdFx0XHRpZiAocy5wYXJlbnRTZXNzaW9uICYmICF0aGlzLmF1dG9FeHBhbmRlZFNlc3Npb25zLmhhcyhzLnBhcmVudFNlc3Npb24pKSB7XG5cdFx0XHRcdFx0XHR0b0V4cGFuZC5hZGQocy5wYXJlbnRTZXNzaW9uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNlc3Npb24gb2YgdG9FeHBhbmQpIHtcblx0XHRcdFx0XHRhd2FpdCBleHBhbmRUbyhzZXNzaW9uLCB0aGlzLnRyZWUpO1xuXHRcdFx0XHRcdHRoaXMuYXV0b0V4cGFuZGVkU2Vzc2lvbnMuYWRkKHNlc3Npb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIElnbm9yZSB0cmVlIGV4cGFuZCBlcnJvcnMgaWYgZWxlbWVudCBubyBsb25nZXIgcHJlc2VudFxuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuc2VsZWN0aW9uTmVlZHNVcGRhdGUpIHtcblx0XHRcdFx0dGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSA9IGZhbHNlO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVwZGF0ZVRyZWVTZWxlY3Rpb24oKTtcblx0XHRcdH1cblx0XHR9LCA1MCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckhlYWRlclRpdGxlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJIZWFkZXJUaXRsZShjb250YWluZXIsIHRoaXMub3B0aW9ucy50aXRsZSk7XG5cblx0XHR0aGlzLnN0YXRlTWVzc2FnZSA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCdzcGFuLmNhbGwtc3RhY2stc3RhdGUtbWVzc2FnZScpKTtcblx0XHR0aGlzLnN0YXRlTWVzc2FnZS5oaWRkZW4gPSB0cnVlO1xuXHRcdHRoaXMuc3RhdGVNZXNzYWdlTGFiZWwgPSBkb20uYXBwZW5kKHRoaXMuc3RhdGVNZXNzYWdlLCAkKCdzcGFuLmxhYmVsJykpO1xuXHRcdHRoaXMuc3RhdGVNZXNzYWdlTGFiZWxIb3ZlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0aGlzLnN0YXRlTWVzc2FnZSwgJycpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2RlYnVnLXBhbmUnKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZGVidWctY2FsbC1zdGFjaycpO1xuXHRcdGNvbnN0IHRyZWVDb250YWluZXIgPSByZW5kZXJWaWV3VHJlZShjb250YWluZXIpO1xuXG5cdFx0dGhpcy5kYXRhU291cmNlID0gbmV3IENhbGxTdGFja0RhdGFTb3VyY2UodGhpcy5kZWJ1Z1NlcnZpY2UpO1xuXHRcdHRoaXMudHJlZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxJRGVidWdNb2RlbCwgQ2FsbFN0YWNrSXRlbSwgRnV6enlTY29yZT4sICdDYWxsU3RhY2tWaWV3JywgdHJlZUNvbnRhaW5lciwgbmV3IENhbGxTdGFja0RlbGVnYXRlKCksIG5ldyBDYWxsU3RhY2tDb21wcmVzc2lvbkRlbGVnYXRlKHRoaXMuZGVidWdTZXJ2aWNlKSwgW1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXNzaW9uc1JlbmRlcmVyKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGhyZWFkc1JlbmRlcmVyKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3RhY2tGcmFtZXNSZW5kZXJlciksXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVycm9yc1JlbmRlcmVyKSxcblx0XHRcdG5ldyBMb2FkTW9yZVJlbmRlcmVyKCksXG5cdFx0XHRuZXcgU2hvd01vcmVSZW5kZXJlcigpXG5cdFx0XSwgdGhpcy5kYXRhU291cmNlLCB7XG5cdFx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IG5ldyBDYWxsU3RhY2tBY2Nlc3NpYmlsaXR5UHJvdmlkZXIoKSxcblx0XHRcdGNvbXByZXNzaW9uRW5hYmxlZDogdHJ1ZSxcblx0XHRcdGF1dG9FeHBhbmRTaW5nbGVDaGlsZHJlbjogdHJ1ZSxcblx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IHtcblx0XHRcdFx0Z2V0SWQ6IChlbGVtZW50OiBDYWxsU3RhY2tJdGVtKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQXJyYXkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBgc2hvd01vcmUgJHtlbGVtZW50WzBdLmdldElkKCl9YDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5nZXRJZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0a2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjoge1xuXHRcdFx0XHRnZXRLZXlib2FyZE5hdmlnYXRpb25MYWJlbDogKGU6IENhbGxTdGFja0l0ZW0pID0+IHtcblx0XHRcdFx0XHRpZiAoaXNEZWJ1Z1Nlc3Npb24oZSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBlLmdldExhYmVsKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChlIGluc3RhbmNlb2YgVGhyZWFkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYCR7ZS5uYW1lfSAke2Uuc3RhdGVMYWJlbH1gO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZSBpbnN0YW5jZW9mIFN0YWNrRnJhbWUgfHwgdHlwZW9mIGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBUaHJlYWRBbmRTZXNzaW9uSWRzKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gTG9hZE1vcmVSZW5kZXJlci5MQUJFTDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Nob3dNb3JlU3RhY2tGcmFtZXMyJywgXCJTaG93IE1vcmUgU3RhY2sgRnJhbWVzXCIpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRDb21wcmVzc2VkTm9kZUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsOiAoZTogQ2FsbFN0YWNrSXRlbVtdKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZmlyc3RJdGVtID0gZVswXTtcblx0XHRcdFx0XHRpZiAoaXNEZWJ1Z1Nlc3Npb24oZmlyc3RJdGVtKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZpcnN0SXRlbS5nZXRMYWJlbCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRleHBhbmRPbmx5T25Ud2lzdGllQ2xpY2s6IHRydWUsXG5cdFx0XHRvdmVycmlkZVN0eWxlczogdGhpcy5nZXRMb2NhdGlvbkJhc2VkQ29sb3JzKCkubGlzdE92ZXJyaWRlU3R5bGVzXG5cdFx0fSk7XG5cblx0XHRDT05URVhUX0NBTExTVEFDS19GT0NVU0VELmJpbmRUbyh0aGlzLnRyZWUuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy50cmVlLnNldElucHV0KHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uRGlkT3Blbihhc3luYyBlID0+IHtcblx0XHRcdGlmICh0aGlzLmlnbm9yZVNlbGVjdGlvbkNoYW5nZWRFdmVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZvY3VzU3RhY2tGcmFtZSA9IChzdGFja0ZyYW1lOiBJU3RhY2tGcmFtZSB8IHVuZGVmaW5lZCwgdGhyZWFkOiBJVGhyZWFkIHwgdW5kZWZpbmVkLCBzZXNzaW9uOiBJRGVidWdTZXNzaW9uLCBvcHRpb25zOiB7IGV4cGxpY2l0PzogYm9vbGVhbjsgcHJlc2VydmVGb2N1cz86IGJvb2xlYW47IHNpZGVCeVNpZGU/OiBib29sZWFuOyBwaW5uZWQ/OiBib29sZWFuIH0gPSB7fSkgPT4ge1xuXHRcdFx0XHR0aGlzLmlnbm9yZUZvY3VzU3RhY2tGcmFtZUV2ZW50ID0gdHJ1ZTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS5mb2N1c1N0YWNrRnJhbWUoc3RhY2tGcmFtZSwgdGhyZWFkLCBzZXNzaW9uLCB7IC4uLm9wdGlvbnMsIC4uLnsgZXhwbGljaXQ6IHRydWUgfSB9KTtcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHR0aGlzLmlnbm9yZUZvY3VzU3RhY2tGcmFtZUV2ZW50ID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGVsZW1lbnQgPSBlLmVsZW1lbnQ7XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFN0YWNrRnJhbWUpIHtcblx0XHRcdFx0Y29uc3Qgb3B0cyA9IHtcblx0XHRcdFx0XHRwcmVzZXJ2ZUZvY3VzOiBlLmVkaXRvck9wdGlvbnMucHJlc2VydmVGb2N1cyxcblx0XHRcdFx0XHRzaWRlQnlTaWRlOiBlLnNpZGVCeVNpZGUsXG5cdFx0XHRcdFx0cGlubmVkOiBlLmVkaXRvck9wdGlvbnMucGlubmVkXG5cdFx0XHRcdH07XG5cdFx0XHRcdGZvY3VzU3RhY2tGcmFtZShlbGVtZW50LCBlbGVtZW50LnRocmVhZCwgZWxlbWVudC50aHJlYWQuc2Vzc2lvbiwgb3B0cyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRocmVhZCkge1xuXHRcdFx0XHRmb2N1c1N0YWNrRnJhbWUodW5kZWZpbmVkLCBlbGVtZW50LCBlbGVtZW50LnNlc3Npb24pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGlzRGVidWdTZXNzaW9uKGVsZW1lbnQpKSB7XG5cdFx0XHRcdGZvY3VzU3RhY2tGcmFtZSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgZWxlbWVudCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRocmVhZEFuZFNlc3Npb25JZHMpIHtcblx0XHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0U2Vzc2lvbihlbGVtZW50LnNlc3Npb25JZCk7XG5cdFx0XHRcdGNvbnN0IHRocmVhZCA9IHNlc3Npb24gJiYgc2Vzc2lvbi5nZXRUaHJlYWQoZWxlbWVudC50aHJlYWRJZCk7XG5cdFx0XHRcdGlmICh0aHJlYWQpIHtcblx0XHRcdFx0XHRjb25zdCB0b3RhbEZyYW1lcyA9IHRocmVhZC5zdG9wcGVkRGV0YWlscz8udG90YWxGcmFtZXM7XG5cdFx0XHRcdFx0Y29uc3QgcmVtYWluaW5nRnJhbWVzQ291bnQgPSB0eXBlb2YgdG90YWxGcmFtZXMgPT09ICdudW1iZXInID8gKHRvdGFsRnJhbWVzIC0gdGhyZWFkLmdldENhbGxTdGFjaygpLmxlbmd0aCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Ly8gR2V0IGFsbCB0aGUgcmVtYWluaW5nIGZyYW1lc1xuXHRcdFx0XHRcdGF3YWl0ICg8VGhyZWFkPnRocmVhZCkuZmV0Y2hDYWxsU3RhY2socmVtYWluaW5nRnJhbWVzQ291bnQpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudHJlZS51cGRhdGVDaGlsZHJlbigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEFycmF5KSB7XG5cdFx0XHRcdHRoaXMuZGF0YVNvdXJjZS5kZWVtcGhhc2l6ZWRTdGFja0ZyYW1lc1RvU2hvdy5wdXNoKC4uLmVsZW1lbnQpO1xuXHRcdFx0XHR0aGlzLnRyZWUudXBkYXRlQ2hpbGRyZW4oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLm9uRGlkQ2hhbmdlQ2FsbFN0YWNrKCgpID0+IHtcblx0XHRcdGlmICghdGhpcy5pc0JvZHlWaXNpYmxlKCkpIHtcblx0XHRcdFx0dGhpcy5uZWVkc1JlZnJlc2ggPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5vbkNhbGxTdGFja0NoYW5nZVNjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdHRoaXMub25DYWxsU3RhY2tDaGFuZ2VTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0Y29uc3Qgb25Gb2N1c0NoYW5nZSA9IEV2ZW50LmFueTxhbnk+KHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLm9uRGlkRm9jdXNTdGFja0ZyYW1lLCB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5vbkRpZEZvY3VzU2Vzc2lvbik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob25Gb2N1c0NoYW5nZShhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pZ25vcmVGb2N1c1N0YWNrRnJhbWVFdmVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRoaXMuaXNCb2R5VmlzaWJsZSgpKSB7XG5cdFx0XHRcdHRoaXMubmVlZHNSZWZyZXNoID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSA9IHRydWU7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLm9uQ2FsbFN0YWNrQ2hhbmdlU2NoZWR1bGVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0dGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSA9IHRydWU7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdGhpcy51cGRhdGVUcmVlU2VsZWN0aW9uKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkNvbnRleHRNZW51KGUgPT4gdGhpcy5vbkNvbnRleHRNZW51KGUpKSk7XG5cblx0XHQvLyBTY2hlZHVsZSB0aGUgdXBkYXRlIG9mIHRoZSBjYWxsIHN0YWNrIHRyZWUgaWYgdGhlIHZpZXdsZXQgaXMgb3BlbmVkIGFmdGVyIGEgc2Vzc2lvbiBzdGFydGVkICMxNDY4NFxuXHRcdGlmICh0aGlzLmRlYnVnU2VydmljZS5zdGF0ZSA9PT0gU3RhdGUuU3RvcHBlZCkge1xuXHRcdFx0dGhpcy5vbkNhbGxTdGFja0NoYW5nZVNjaGVkdWxlci5zY2hlZHVsZSgwKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkodmlzaWJsZSA9PiB7XG5cdFx0XHRpZiAodmlzaWJsZSAmJiB0aGlzLm5lZWRzUmVmcmVzaCkge1xuXHRcdFx0XHR0aGlzLm9uQ2FsbFN0YWNrQ2hhbmdlU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2Uub25EaWROZXdTZXNzaW9uKHMgPT4ge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbkxpc3RlbmVyczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXHRcdFx0c2Vzc2lvbkxpc3RlbmVycy5wdXNoKHMub25EaWRDaGFuZ2VOYW1lKCgpID0+IHtcblx0XHRcdFx0Ly8gdGhpcy50cmVlLnVwZGF0ZUNoaWxkcmVuIGlzIGNhbGxlZCBvbiBhIGRlbGF5IGFmdGVyIGEgc2Vzc2lvbiBpcyBhZGRlZCxcblx0XHRcdFx0Ly8gc28gZG9uJ3QgcmVyZW5kZXIgaWYgdGhlIHRyZWUgZG9lc24ndCBoYXZlIHRoZSBub2RlIHlldFxuXHRcdFx0XHRpZiAodGhpcy50cmVlLmhhc05vZGUocykpIHtcblx0XHRcdFx0XHR0aGlzLnRyZWUucmVyZW5kZXIocyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHNlc3Npb25MaXN0ZW5lcnMucHVzaChzLm9uRGlkRW5kQWRhcHRlcigoKSA9PiBkaXNwb3NlKHNlc3Npb25MaXN0ZW5lcnMpKSk7XG5cdFx0XHRpZiAocy5wYXJlbnRTZXNzaW9uKSB7XG5cdFx0XHRcdC8vIEEgc2Vzc2lvbiB3ZSBhbHJlYWR5IGV4cGFuZGVkIGhhcyBhIG5ldyBjaGlsZCBzZXNzaW9uLCBhbGxvdyB0byBleHBhbmQgaXQgYWdhaW4uXG5cdFx0XHRcdHRoaXMuYXV0b0V4cGFuZGVkU2Vzc2lvbnMuZGVsZXRlKHMucGFyZW50U2Vzc2lvbik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMudHJlZS5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpOiB2b2lkIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXHRcdHRoaXMudHJlZS5kb21Gb2N1cygpO1xuXHR9XG5cblx0Y29sbGFwc2VBbGwoKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlLmNvbGxhcHNlQWxsKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZVRyZWVTZWxlY3Rpb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnRyZWUgfHwgIXRoaXMudHJlZS5nZXRJbnB1dCgpKSB7XG5cdFx0XHQvLyBUcmVlIG5vdCBpbml0aWFsaXplZCB5ZXRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB1cGRhdGVTZWxlY3Rpb25BbmRSZXZlYWwgPSAoZWxlbWVudDogSVN0YWNrRnJhbWUgfCBJRGVidWdTZXNzaW9uKSA9PiB7XG5cdFx0XHR0aGlzLmlnbm9yZVNlbGVjdGlvbkNoYW5nZWRFdmVudCA9IHRydWU7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtlbGVtZW50XSk7XG5cdFx0XHRcdC8vIElmIHRoZSBlbGVtZW50IGlzIG91dHNpZGUgb2YgdGhlIHNjcmVlbiBib3VuZHMsXG5cdFx0XHRcdC8vIHBvc2l0aW9uIGl0IGluIHRoZSBtaWRkbGVcblx0XHRcdFx0aWYgKHRoaXMudHJlZS5nZXRSZWxhdGl2ZVRvcChlbGVtZW50KSA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdHRoaXMudHJlZS5yZXZlYWwoZWxlbWVudCwgMC41KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnRyZWUucmV2ZWFsKGVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7IH1cblx0XHRcdGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLmlnbm9yZVNlbGVjdGlvbkNoYW5nZWRFdmVudCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkVGhyZWFkO1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRjb25zdCBzdGFja0ZyYW1lID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWU7XG5cdFx0aWYgKCF0aHJlYWQpIHtcblx0XHRcdGlmICghc2Vzc2lvbikge1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVwZGF0ZVNlbGVjdGlvbkFuZFJldmVhbChzZXNzaW9uKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gSWdub3JlIGVycm9ycyBmcm9tIHRoaXMgZXhwYW5zaW9ucyBiZWNhdXNlIHdlIGFyZSBub3QgYXdhcmUgaWYgd2UgcmVuZGVyZWQgdGhlIHRocmVhZHMgYW5kIHNlc3Npb25zIG9yIHdlIGhpZGUgdGhlbSB0byBkZWNsdXR0ZXIgdGhlIHZpZXdcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IGV4cGFuZFRvKHRocmVhZC5zZXNzaW9uLCB0aGlzLnRyZWUpO1xuXHRcdFx0fSBjYXRjaCAoZSkgeyB9XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnRyZWUuZXhwYW5kKHRocmVhZCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7IH1cblxuXHRcdFx0Y29uc3QgdG9SZXZlYWwgPSBzdGFja0ZyYW1lIHx8IHNlc3Npb247XG5cdFx0XHRpZiAodG9SZXZlYWwpIHtcblx0XHRcdFx0dXBkYXRlU2VsZWN0aW9uQW5kUmV2ZWFsKHRvUmV2ZWFsKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uQ29udGV4dE1lbnUoZTogSVRyZWVDb250ZXh0TWVudUV2ZW50PENhbGxTdGFja0l0ZW0+KTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGUuZWxlbWVudDtcblx0XHRsZXQgb3ZlcmxheTogW3N0cmluZywgYW55XVtdID0gW107XG5cdFx0aWYgKGlzRGVidWdTZXNzaW9uKGVsZW1lbnQpKSB7XG5cdFx0XHRvdmVybGF5ID0gZ2V0U2Vzc2lvbkNvbnRleHRPdmVybGF5KGVsZW1lbnQpO1xuXHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRocmVhZCkge1xuXHRcdFx0b3ZlcmxheSA9IGdldFRocmVhZENvbnRleHRPdmVybGF5KGVsZW1lbnQpO1xuXHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFN0YWNrRnJhbWUpIHtcblx0XHRcdG92ZXJsYXkgPSBnZXRTdGFja0ZyYW1lQ29udGV4dE92ZXJsYXkoZWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZU92ZXJsYXkob3ZlcmxheSk7XG5cdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLkRlYnVnQ2FsbFN0YWNrQ29udGV4dCwgY29udGV4dEtleVNlcnZpY2UsIHsgYXJnOiBnZXRDb250ZXh0Rm9yQ29udHJpYnV0ZWRBY3Rpb25zKGVsZW1lbnQpLCBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KTtcblx0XHRjb25zdCByZXN1bHQgPSBnZXRDb250ZXh0TWVudUFjdGlvbnMobWVudSwgJ2lubGluZScpO1xuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGUuYW5jaG9yLFxuXHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gcmVzdWx0LnNlY29uZGFyeSxcblx0XHRcdGdldEFjdGlvbnNDb250ZXh0OiAoKSA9PiBnZXRDb250ZXh0KGVsZW1lbnQpXG5cdFx0fSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElUaHJlYWRUZW1wbGF0ZURhdGEge1xuXHR0aHJlYWQ6IEhUTUxFbGVtZW50O1xuXHRuYW1lOiBIVE1MRWxlbWVudDtcblx0c3RhdGVMYWJlbDogSFRNTFNwYW5FbGVtZW50O1xuXHRsYWJlbDogSGlnaGxpZ2h0ZWRMYWJlbDtcblx0YWN0aW9uQmFyOiBBY3Rpb25CYXI7XG5cdGVsZW1lbnREaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHRlbXBsYXRlRGlzcG9zYWJsZTogSURpc3Bvc2FibGU7XG59XG5cbmludGVyZmFjZSBJU2Vzc2lvblRlbXBsYXRlRGF0YSB7XG5cdHNlc3Npb246IEhUTUxFbGVtZW50O1xuXHRuYW1lOiBIVE1MRWxlbWVudDtcblx0c3RhdGVMYWJlbDogSFRNTFNwYW5FbGVtZW50O1xuXHRsYWJlbDogSGlnaGxpZ2h0ZWRMYWJlbDtcblx0YWN0aW9uQmFyOiBBY3Rpb25CYXI7XG5cdGVsZW1lbnREaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHRlbXBsYXRlRGlzcG9zYWJsZTogSURpc3Bvc2FibGU7XG59XG5cbmludGVyZmFjZSBJRXJyb3JUZW1wbGF0ZURhdGEge1xuXHRsYWJlbDogSFRNTEVsZW1lbnQ7XG5cdHRlbXBsYXRlRGlzcG9zYWJsZTogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5pbnRlcmZhY2UgSUxhYmVsVGVtcGxhdGVEYXRhIHtcblx0bGFiZWw6IEhUTUxFbGVtZW50O1xufVxuXG5pbnRlcmZhY2UgSVN0YWNrRnJhbWVUZW1wbGF0ZURhdGEge1xuXHRzdGFja0ZyYW1lOiBIVE1MRWxlbWVudDtcblx0ZmlsZTogSFRNTEVsZW1lbnQ7XG5cdGZpbGVOYW1lOiBIVE1MRWxlbWVudDtcblx0bGluZU51bWJlcjogSFRNTEVsZW1lbnQ7XG5cdGxhYmVsOiBIaWdobGlnaHRlZExhYmVsO1xuXHRhY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0dGVtcGxhdGVEaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmU7XG59XG5cbmZ1bmN0aW9uIGdldFNlc3Npb25Db250ZXh0T3ZlcmxheShzZXNzaW9uOiBJRGVidWdTZXNzaW9uKTogW3N0cmluZywgYW55XVtdIHtcblx0cmV0dXJuIFtcblx0XHRbQ09OVEVYVF9DQUxMU1RBQ0tfSVRFTV9UWVBFLmtleSwgJ3Nlc3Npb24nXSxcblx0XHRbQ09OVEVYVF9DQUxMU1RBQ0tfU0VTU0lPTl9JU19BVFRBQ0gua2V5LCBpc1Nlc3Npb25BdHRhY2goc2Vzc2lvbildLFxuXHRcdFtDT05URVhUX0NBTExTVEFDS19JVEVNX1NUT1BQRUQua2V5LCBzZXNzaW9uLnN0YXRlID09PSBTdGF0ZS5TdG9wcGVkXSxcblx0XHRbQ09OVEVYVF9DQUxMU1RBQ0tfU0VTU0lPTl9IQVNfT05FX1RIUkVBRC5rZXksIHNlc3Npb24uZ2V0QWxsVGhyZWFkcygpLmxlbmd0aCA9PT0gMV0sXG5cdF07XG59XG5cbmNsYXNzIFNlc3Npb25zUmVuZGVyZXIgaW1wbGVtZW50cyBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyPElEZWJ1Z1Nlc3Npb24sIEZ1enp5U2NvcmUsIElTZXNzaW9uVGVtcGxhdGVEYXRhPiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdzZXNzaW9uJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0KSB7IH1cblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBTZXNzaW9uc1JlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElTZXNzaW9uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBzZXNzaW9uID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5zZXNzaW9uJykpO1xuXHRcdGRvbS5hcHBlbmQoc2Vzc2lvbiwgJChUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5jYWxsc3RhY2tWaWV3U2Vzc2lvbikpKTtcblx0XHRjb25zdCBuYW1lID0gZG9tLmFwcGVuZChzZXNzaW9uLCAkKCcubmFtZScpKTtcblx0XHRjb25zdCBzdGF0ZUxhYmVsID0gZG9tLmFwcGVuZChzZXNzaW9uLCAkKCdzcGFuLnN0YXRlLmxhYmVsLm1vbmFjby1jb3VudC1iYWRnZS5sb25nJykpO1xuXHRcdGNvbnN0IHRlbXBsYXRlRGlzcG9zYWJsZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsYWJlbCA9IHRlbXBsYXRlRGlzcG9zYWJsZS5hZGQobmV3IEhpZ2hsaWdodGVkTGFiZWwobmFtZSkpO1xuXG5cdFx0Y29uc3Qgc3RvcEFjdGlvblZpZXdJdGVtRGlzcG9zYWJsZXMgPSB0ZW1wbGF0ZURpc3Bvc2FibGUuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0Y29uc3QgYWN0aW9uQmFyID0gdGVtcGxhdGVEaXNwb3NhYmxlLmFkZChuZXcgQWN0aW9uQmFyKHNlc3Npb24sIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKChhY3Rpb24uaWQgPT09IFNUT1BfSUQgfHwgYWN0aW9uLmlkID09PSBESVNDT05ORUNUX0lEKSAmJiBhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikge1xuXHRcdFx0XHRcdHN0b3BBY3Rpb25WaWV3SXRlbURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gY3JlYXRlRGlzY29ubmVjdE1lbnVJdGVtQWN0aW9uKGFjdGlvbiBhcyBNZW51SXRlbUFjdGlvbiwgc3RvcEFjdGlvblZpZXdJdGVtRGlzcG9zYWJsZXMsIGFjY2Vzc29yLCB7IC4uLm9wdGlvbnMsIG1lbnVBc0NoaWxkOiBmYWxzZSB9KSk7XG5cdFx0XHRcdFx0aWYgKGl0ZW0pIHtcblx0XHRcdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHsgaG92ZXJEZWxlZ2F0ZTogb3B0aW9ucy5ob3ZlckRlbGVnYXRlIH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGFjdGlvbiBpbnN0YW5jZW9mIFN1Ym1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3VibWVudUVudHJ5QWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwgeyBob3ZlckRlbGVnYXRlOiBvcHRpb25zLmhvdmVyRGVsZWdhdGUgfSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGVsZW1lbnREaXNwb3NhYmxlID0gdGVtcGxhdGVEaXNwb3NhYmxlLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdHJldHVybiB7IHNlc3Npb24sIG5hbWUsIHN0YXRlTGFiZWwsIGxhYmVsLCBhY3Rpb25CYXIsIGVsZW1lbnREaXNwb3NhYmxlLCB0ZW1wbGF0ZURpc3Bvc2FibGUgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPElEZWJ1Z1Nlc3Npb24sIEZ1enp5U2NvcmU+LCBfOiBudW1iZXIsIGRhdGE6IElTZXNzaW9uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGhpcy5kb1JlbmRlckVsZW1lbnQoZWxlbWVudC5lbGVtZW50LCBjcmVhdGVNYXRjaGVzKGVsZW1lbnQuZmlsdGVyRGF0YSksIGRhdGEpO1xuXHR9XG5cblx0cmVuZGVyQ29tcHJlc3NlZEVsZW1lbnRzKG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPElEZWJ1Z1Nlc3Npb24+LCBGdXp6eVNjb3JlPiwgX2luZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVNlc3Npb25UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBsYXN0RWxlbWVudCA9IG5vZGUuZWxlbWVudC5lbGVtZW50c1tub2RlLmVsZW1lbnQuZWxlbWVudHMubGVuZ3RoIC0gMV07XG5cdFx0Y29uc3QgbWF0Y2hlcyA9IGNyZWF0ZU1hdGNoZXMobm9kZS5maWx0ZXJEYXRhKTtcblx0XHR0aGlzLmRvUmVuZGVyRWxlbWVudChsYXN0RWxlbWVudCwgbWF0Y2hlcywgdGVtcGxhdGVEYXRhKTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZW5kZXJFbGVtZW50KHNlc3Npb246IElEZWJ1Z1Nlc3Npb24sIG1hdGNoZXM6IElNYXRjaFtdLCBkYXRhOiBJU2Vzc2lvblRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IHNlc3Npb25Ib3ZlciA9IGRhdGEuZWxlbWVudERpc3Bvc2FibGUuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBkYXRhLnNlc3Npb24sIGxvY2FsaXplKHsga2V5OiAnc2Vzc2lvbicsIGNvbW1lbnQ6IFsnU2Vzc2lvbiBpcyBhIG5vdW4nXSB9LCBcIlNlc3Npb25cIikpKTtcblx0XHRkYXRhLmxhYmVsLnNldChzZXNzaW9uLmdldExhYmVsKCksIG1hdGNoZXMpO1xuXHRcdGNvbnN0IHN0b3BwZWREZXRhaWxzID0gc2Vzc2lvbi5nZXRTdG9wcGVkRGV0YWlscygpO1xuXHRcdGNvbnN0IHRocmVhZCA9IHNlc3Npb24uZ2V0QWxsVGhyZWFkcygpLmZpbmQodCA9PiB0LnN0b3BwZWQpO1xuXG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZU92ZXJsYXkoZ2V0U2Vzc2lvbkNvbnRleHRPdmVybGF5KHNlc3Npb24pKTtcblx0XHRjb25zdCBtZW51ID0gZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5hZGQodGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5EZWJ1Z0NhbGxTdGFja0NvbnRleHQsIGNvbnRleHRLZXlTZXJ2aWNlKSk7XG5cblx0XHRjb25zdCBzZXR1cEFjdGlvbkJhciA9ICgpID0+IHtcblx0XHRcdGRhdGEuYWN0aW9uQmFyLmNsZWFyKCk7XG5cblx0XHRcdGNvbnN0IHsgcHJpbWFyeSB9ID0gZ2V0QWN0aW9uQmFyQWN0aW9ucyhtZW51LmdldEFjdGlvbnMoeyBhcmc6IGdldENvbnRleHRGb3JDb250cmlidXRlZEFjdGlvbnMoc2Vzc2lvbiksIHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pLCAnaW5saW5lJyk7XG5cdFx0XHRkYXRhLmFjdGlvbkJhci5wdXNoKHByaW1hcnksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHRcdFx0Ly8gV2UgbmVlZCB0byBzZXQgb3VyIGludGVybmFsIGNvbnRleHQgb24gdGhlIGFjdGlvbiBiYXIsIHNpbmNlIG91ciBjb21tYW5kcyBkZXBlbmQgb24gdGhhdCBvbmVcblx0XHRcdC8vIFdoaWxlIHRoZSBleHRlcm5hbCBjb250ZXh0IG91ciBleHRlbnNpb25zIHJlbHkgb25cblx0XHRcdGRhdGEuYWN0aW9uQmFyLmNvbnRleHQgPSBnZXRDb250ZXh0KHNlc3Npb24pO1xuXHRcdH07XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5hZGQobWVudS5vbkRpZENoYW5nZSgoKSA9PiBzZXR1cEFjdGlvbkJhcigpKSk7XG5cdFx0c2V0dXBBY3Rpb25CYXIoKTtcblxuXHRcdGRhdGEuc3RhdGVMYWJlbC5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cblx0XHRpZiAoc3RvcHBlZERldGFpbHMpIHtcblx0XHRcdGRhdGEuc3RhdGVMYWJlbC50ZXh0Q29udGVudCA9IHN0b3BwZWREZXNjcmlwdGlvbihzdG9wcGVkRGV0YWlscyk7XG5cdFx0XHRzZXNzaW9uSG92ZXIudXBkYXRlKGAke3Nlc3Npb24uZ2V0TGFiZWwoKX06ICR7c3RvcHBlZFRleHQoc3RvcHBlZERldGFpbHMpfWApO1xuXHRcdFx0ZGF0YS5zdGF0ZUxhYmVsLmNsYXNzTGlzdC50b2dnbGUoJ2V4Y2VwdGlvbicsIHN0b3BwZWREZXRhaWxzLnJlYXNvbiA9PT0gJ2V4Y2VwdGlvbicpO1xuXHRcdH0gZWxzZSBpZiAodGhyZWFkICYmIHRocmVhZC5zdG9wcGVkRGV0YWlscykge1xuXHRcdFx0ZGF0YS5zdGF0ZUxhYmVsLnRleHRDb250ZW50ID0gc3RvcHBlZERlc2NyaXB0aW9uKHRocmVhZC5zdG9wcGVkRGV0YWlscyk7XG5cdFx0XHRzZXNzaW9uSG92ZXIudXBkYXRlKGAke3Nlc3Npb24uZ2V0TGFiZWwoKX06ICR7c3RvcHBlZFRleHQodGhyZWFkLnN0b3BwZWREZXRhaWxzKX1gKTtcblx0XHRcdGRhdGEuc3RhdGVMYWJlbC5jbGFzc0xpc3QudG9nZ2xlKCdleGNlcHRpb24nLCB0aHJlYWQuc3RvcHBlZERldGFpbHMucmVhc29uID09PSAnZXhjZXB0aW9uJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRhdGEuc3RhdGVMYWJlbC50ZXh0Q29udGVudCA9IGxvY2FsaXplKHsga2V5OiAncnVubmluZycsIGNvbW1lbnQ6IFsnaW5kaWNhdGVzIHN0YXRlJ10gfSwgXCJSdW5uaW5nXCIpO1xuXHRcdFx0ZGF0YS5zdGF0ZUxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoJ2V4Y2VwdGlvbicpO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElTZXNzaW9uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChfZWxlbWVudDogSVRyZWVOb2RlPElEZWJ1Z1Nlc3Npb24sIEZ1enp5U2NvcmU+LCBfOiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVNlc3Npb25UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGUuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8SURlYnVnU2Vzc2lvbj4sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElTZXNzaW9uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZS5jbGVhcigpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldFRocmVhZENvbnRleHRPdmVybGF5KHRocmVhZDogSVRocmVhZCk6IFtzdHJpbmcsIGFueV1bXSB7XG5cdHJldHVybiBbXG5cdFx0W0NPTlRFWFRfQ0FMTFNUQUNLX0lURU1fVFlQRS5rZXksICd0aHJlYWQnXSxcblx0XHRbQ09OVEVYVF9DQUxMU1RBQ0tfSVRFTV9TVE9QUEVELmtleSwgdGhyZWFkLnN0b3BwZWRdXG5cdF07XG59XG5cbmNsYXNzIFRocmVhZHNSZW5kZXJlciBpbXBsZW1lbnRzIElDb21wcmVzc2libGVUcmVlUmVuZGVyZXI8SVRocmVhZCwgRnV6enlTY29yZSwgSVRocmVhZFRlbXBsYXRlRGF0YT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAndGhyZWFkJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0KSB7IH1cblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBUaHJlYWRzUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVRocmVhZFRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgdGhyZWFkID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy50aHJlYWQnKSk7XG5cdFx0Y29uc3QgbmFtZSA9IGRvbS5hcHBlbmQodGhyZWFkLCAkKCcubmFtZScpKTtcblx0XHRjb25zdCBzdGF0ZUxhYmVsID0gZG9tLmFwcGVuZCh0aHJlYWQsICQoJ3NwYW4uc3RhdGUubGFiZWwubW9uYWNvLWNvdW50LWJhZGdlLmxvbmcnKSk7XG5cblx0XHRjb25zdCB0ZW1wbGF0ZURpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbGFiZWwgPSB0ZW1wbGF0ZURpc3Bvc2FibGUuYWRkKG5ldyBIaWdobGlnaHRlZExhYmVsKG5hbWUpKTtcblxuXHRcdGNvbnN0IGFjdGlvbkJhciA9IHRlbXBsYXRlRGlzcG9zYWJsZS5hZGQobmV3IEFjdGlvbkJhcih0aHJlYWQpKTtcblx0XHRjb25zdCBlbGVtZW50RGlzcG9zYWJsZSA9IHRlbXBsYXRlRGlzcG9zYWJsZS5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRcdHJldHVybiB7IHRocmVhZCwgbmFtZSwgc3RhdGVMYWJlbCwgbGFiZWwsIGFjdGlvbkJhciwgZWxlbWVudERpc3Bvc2FibGUsIHRlbXBsYXRlRGlzcG9zYWJsZSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8SVRocmVhZCwgRnV6enlTY29yZT4sIF9pbmRleDogbnVtYmVyLCBkYXRhOiBJVGhyZWFkVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhyZWFkID0gZWxlbWVudC5lbGVtZW50O1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGUuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBkYXRhLnRocmVhZCwgdGhyZWFkLm5hbWUpKTtcblx0XHRkYXRhLmxhYmVsLnNldCh0aHJlYWQubmFtZSwgY3JlYXRlTWF0Y2hlcyhlbGVtZW50LmZpbHRlckRhdGEpKTtcblx0XHRkYXRhLnN0YXRlTGFiZWwudGV4dENvbnRlbnQgPSB0aHJlYWQuc3RhdGVMYWJlbDtcblx0XHRkYXRhLnN0YXRlTGFiZWwuY2xhc3NMaXN0LnRvZ2dsZSgnZXhjZXB0aW9uJywgdGhyZWFkLnN0b3BwZWREZXRhaWxzPy5yZWFzb24gPT09ICdleGNlcHRpb24nKTtcblxuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVPdmVybGF5KGdldFRocmVhZENvbnRleHRPdmVybGF5KHRocmVhZCkpO1xuXHRcdGNvbnN0IG1lbnUgPSBkYXRhLmVsZW1lbnREaXNwb3NhYmxlLmFkZCh0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLkRlYnVnQ2FsbFN0YWNrQ29udGV4dCwgY29udGV4dEtleVNlcnZpY2UpKTtcblxuXHRcdGNvbnN0IHNldHVwQWN0aW9uQmFyID0gKCkgPT4ge1xuXHRcdFx0ZGF0YS5hY3Rpb25CYXIuY2xlYXIoKTtcblxuXHRcdFx0Y29uc3QgeyBwcmltYXJ5IH0gPSBnZXRBY3Rpb25CYXJBY3Rpb25zKG1lbnUuZ2V0QWN0aW9ucyh7IGFyZzogZ2V0Q29udGV4dEZvckNvbnRyaWJ1dGVkQWN0aW9ucyh0aHJlYWQpLCBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KSwgJ2lubGluZScpO1xuXHRcdFx0ZGF0YS5hY3Rpb25CYXIucHVzaChwcmltYXJ5LCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHRcdC8vIFdlIG5lZWQgdG8gc2V0IG91ciBpbnRlcm5hbCBjb250ZXh0IG9uIHRoZSBhY3Rpb24gYmFyLCBzaW5jZSBvdXIgY29tbWFuZHMgZGVwZW5kIG9uIHRoYXQgb25lXG5cdFx0XHQvLyBXaGlsZSB0aGUgZXh0ZXJuYWwgY29udGV4dCBvdXIgZXh0ZW5zaW9ucyByZWx5IG9uXG5cdFx0XHRkYXRhLmFjdGlvbkJhci5jb250ZXh0ID0gZ2V0Q29udGV4dCh0aHJlYWQpO1xuXHRcdH07XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5hZGQobWVudS5vbkRpZENoYW5nZSgoKSA9PiBzZXR1cEFjdGlvbkJhcigpKSk7XG5cdFx0c2V0dXBBY3Rpb25CYXIoKTtcblx0fVxuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhfbm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8SVRocmVhZD4sIEZ1enp5U2NvcmU+LCBfaW5kZXg6IG51bWJlciwgX3RlbXBsYXRlRGF0YTogSVRocmVhZFRlbXBsYXRlRGF0YSwgX2hlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoX2VsZW1lbnQ6IGFueSwgX2luZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVRocmVhZFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZS5jbGVhcigpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVRocmVhZFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldFN0YWNrRnJhbWVDb250ZXh0T3ZlcmxheShzdGFja0ZyYW1lOiBJU3RhY2tGcmFtZSk6IFtzdHJpbmcsIGFueV1bXSB7XG5cdHJldHVybiBbXG5cdFx0W0NPTlRFWFRfQ0FMTFNUQUNLX0lURU1fVFlQRS5rZXksICdzdGFja0ZyYW1lJ10sXG5cdFx0W0NPTlRFWFRfU1RBQ0tfRlJBTUVfU1VQUE9SVFNfUkVTVEFSVC5rZXksIHN0YWNrRnJhbWUuY2FuUmVzdGFydF1cblx0XTtcbn1cblxuY2xhc3MgU3RhY2tGcmFtZXNSZW5kZXJlciBpbXBsZW1lbnRzIElDb21wcmVzc2libGVUcmVlUmVuZGVyZXI8SVN0YWNrRnJhbWUsIEZ1enp5U2NvcmUsIElTdGFja0ZyYW1lVGVtcGxhdGVEYXRhPiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdzdGFja0ZyYW1lJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0KSB7IH1cblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBTdGFja0ZyYW1lc1JlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElTdGFja0ZyYW1lVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBzdGFja0ZyYW1lID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5zdGFjay1mcmFtZScpKTtcblx0XHRjb25zdCBsYWJlbERpdiA9IGRvbS5hcHBlbmQoc3RhY2tGcmFtZSwgJCgnc3Bhbi5sYWJlbC5leHByZXNzaW9uJykpO1xuXHRcdGNvbnN0IGZpbGUgPSBkb20uYXBwZW5kKHN0YWNrRnJhbWUsICQoJy5maWxlJykpO1xuXHRcdGNvbnN0IGZpbGVOYW1lID0gZG9tLmFwcGVuZChmaWxlLCAkKCdzcGFuLmZpbGUtbmFtZScpKTtcblx0XHRjb25zdCB3cmFwcGVyID0gZG9tLmFwcGVuZChmaWxlLCAkKCdzcGFuLmxpbmUtbnVtYmVyLXdyYXBwZXInKSk7XG5cdFx0Y29uc3QgbGluZU51bWJlciA9IGRvbS5hcHBlbmQod3JhcHBlciwgJCgnc3Bhbi5saW5lLW51bWJlci5tb25hY28tY291bnQtYmFkZ2UnKSk7XG5cblx0XHRjb25zdCB0ZW1wbGF0ZURpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbGFiZWwgPSB0ZW1wbGF0ZURpc3Bvc2FibGUuYWRkKG5ldyBIaWdobGlnaHRlZExhYmVsKGxhYmVsRGl2KSk7XG5cblx0XHRjb25zdCBhY3Rpb25CYXIgPSB0ZW1wbGF0ZURpc3Bvc2FibGUuYWRkKG5ldyBBY3Rpb25CYXIoc3RhY2tGcmFtZSkpO1xuXG5cdFx0cmV0dXJuIHsgZmlsZSwgZmlsZU5hbWUsIGxhYmVsLCBsaW5lTnVtYmVyLCBzdGFja0ZyYW1lLCBhY3Rpb25CYXIsIHRlbXBsYXRlRGlzcG9zYWJsZSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8SVN0YWNrRnJhbWUsIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCBkYXRhOiBJU3RhY2tGcmFtZVRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IHN0YWNrRnJhbWUgPSBlbGVtZW50LmVsZW1lbnQ7XG5cdFx0ZGF0YS5zdGFja0ZyYW1lLmNsYXNzTGlzdC50b2dnbGUoJ2Rpc2FibGVkJywgIXN0YWNrRnJhbWUuc291cmNlIHx8ICFzdGFja0ZyYW1lLnNvdXJjZS5hdmFpbGFibGUgfHwgaXNGcmFtZURlZW1waGFzaXplZChzdGFja0ZyYW1lKSk7XG5cdFx0ZGF0YS5zdGFja0ZyYW1lLmNsYXNzTGlzdC50b2dnbGUoJ2xhYmVsJywgc3RhY2tGcmFtZS5wcmVzZW50YXRpb25IaW50ID09PSAnbGFiZWwnKTtcblx0XHRjb25zdCBoYXNBY3Rpb25zID0gISFzdGFja0ZyYW1lLnRocmVhZC5zZXNzaW9uLmNhcGFiaWxpdGllcy5zdXBwb3J0c1Jlc3RhcnRGcmFtZSAmJiBzdGFja0ZyYW1lLnByZXNlbnRhdGlvbkhpbnQgIT09ICdsYWJlbCcgJiYgc3RhY2tGcmFtZS5wcmVzZW50YXRpb25IaW50ICE9PSAnc3VidGxlJyAmJiBzdGFja0ZyYW1lLmNhblJlc3RhcnQ7XG5cdFx0ZGF0YS5zdGFja0ZyYW1lLmNsYXNzTGlzdC50b2dnbGUoJ2hhcy1hY3Rpb25zJywgaGFzQWN0aW9ucyk7XG5cblx0XHRsZXQgdGl0bGUgPSBzdGFja0ZyYW1lLnNvdXJjZS5pbk1lbW9yeSA/IHN0YWNrRnJhbWUuc291cmNlLnVyaS5wYXRoIDogdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoc3RhY2tGcmFtZS5zb3VyY2UudXJpKTtcblx0XHRpZiAoc3RhY2tGcmFtZS5zb3VyY2UucmF3Lm9yaWdpbikge1xuXHRcdFx0dGl0bGUgKz0gYFxcbiR7c3RhY2tGcmFtZS5zb3VyY2UucmF3Lm9yaWdpbn1gO1xuXHRcdH1cblx0XHRkYXRhLnRlbXBsYXRlRGlzcG9zYWJsZS5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGRhdGEuZmlsZSwgdGl0bGUpKTtcblxuXHRcdGRhdGEubGFiZWwuc2V0KHN0YWNrRnJhbWUubmFtZSwgY3JlYXRlTWF0Y2hlcyhlbGVtZW50LmZpbHRlckRhdGEpLCBzdGFja0ZyYW1lLm5hbWUpO1xuXHRcdGRhdGEuZmlsZU5hbWUudGV4dENvbnRlbnQgPSBnZXRTcGVjaWZpY1NvdXJjZU5hbWUoc3RhY2tGcmFtZSk7XG5cdFx0aWYgKHN0YWNrRnJhbWUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGRhdGEubGluZU51bWJlci50ZXh0Q29udGVudCA9IGAke3N0YWNrRnJhbWUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyfWA7XG5cdFx0XHRpZiAoc3RhY2tGcmFtZS5yYW5nZS5zdGFydENvbHVtbikge1xuXHRcdFx0XHRkYXRhLmxpbmVOdW1iZXIudGV4dENvbnRlbnQgKz0gYDoke3N0YWNrRnJhbWUucmFuZ2Uuc3RhcnRDb2x1bW59YDtcblx0XHRcdH1cblx0XHRcdGRhdGEubGluZU51bWJlci5jbGFzc0xpc3QucmVtb3ZlKCd1bmF2YWlsYWJsZScpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLmxpbmVOdW1iZXIuY2xhc3NMaXN0LmFkZCgndW5hdmFpbGFibGUnKTtcblx0XHR9XG5cblx0XHRkYXRhLmFjdGlvbkJhci5jbGVhcigpO1xuXHRcdGlmIChoYXNBY3Rpb25zKSB7XG5cdFx0XHRjb25zdCBhY3Rpb24gPSBuZXcgQWN0aW9uKCdkZWJ1Zy5jYWxsU3RhY2sucmVzdGFydEZyYW1lJywgbG9jYWxpemUoJ3Jlc3RhcnRGcmFtZScsIFwiUmVzdGFydCBGcmFtZVwiKSwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb25zLmRlYnVnUmVzdGFydEZyYW1lKSwgdHJ1ZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHN0YWNrRnJhbWUucmVzdGFydCgpO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGRhdGEuYWN0aW9uQmFyLnB1c2goYWN0aW9uLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHR9XG5cdH1cblxuXHRyZW5kZXJDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8SVN0YWNrRnJhbWU+LCBGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU3RhY2tGcmFtZVRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJU3RhY2tGcmFtZVRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIEVycm9yc1JlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxzdHJpbmcsIEZ1enp5U2NvcmUsIElFcnJvclRlbXBsYXRlRGF0YT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZXJyb3InO1xuXG5cdGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEVycm9yc1JlbmRlcmVyLklEO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2Vcblx0KSB7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUVycm9yVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBsYWJlbCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcuZXJyb3InKSk7XG5cblx0XHRyZXR1cm4geyBsYWJlbCwgdGVtcGxhdGVEaXNwb3NhYmxlOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCkgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPHN0cmluZywgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIGRhdGE6IElFcnJvclRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IGVycm9yID0gZWxlbWVudC5lbGVtZW50O1xuXHRcdGRhdGEubGFiZWwudGV4dENvbnRlbnQgPSBlcnJvcjtcblx0XHRkYXRhLnRlbXBsYXRlRGlzcG9zYWJsZS5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGRhdGEubGFiZWwsIGVycm9yKSk7XG5cdH1cblxuXHRyZW5kZXJDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8c3RyaW5nPiwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUVycm9yVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElFcnJvclRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdC8vIG5vb3Bcblx0fVxufVxuXG5jbGFzcyBMb2FkTW9yZVJlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxUaHJlYWRBbmRTZXNzaW9uSWRzLCBGdXp6eVNjb3JlLCBJTGFiZWxUZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2xvYWRNb3JlJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2xvYWRBbGxTdGFja0ZyYW1lcycsIFwiTG9hZCBNb3JlIFN0YWNrIEZyYW1lc1wiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHsgfVxuXG5cdGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIExvYWRNb3JlUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUxhYmVsVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBsYWJlbCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcubG9hZC1hbGwnKSk7XG5cdFx0bGFiZWwuc3R5bGUuY29sb3IgPSBhc0Nzc1ZhcmlhYmxlKHRleHRMaW5rRm9yZWdyb3VuZCk7XG5cdFx0cmV0dXJuIHsgbGFiZWwgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPFRocmVhZEFuZFNlc3Npb25JZHMsIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCBkYXRhOiBJTGFiZWxUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRkYXRhLmxhYmVsLnRleHRDb250ZW50ID0gTG9hZE1vcmVSZW5kZXJlci5MQUJFTDtcblx0fVxuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxUaHJlYWRBbmRTZXNzaW9uSWRzPiwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUxhYmVsVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElMYWJlbFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdC8vIG5vb3Bcblx0fVxufVxuXG5jbGFzcyBTaG93TW9yZVJlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxJU3RhY2tGcmFtZVtdLCBGdXp6eVNjb3JlLCBJTGFiZWxUZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3Nob3dNb3JlJztcblxuXHRjb25zdHJ1Y3RvcigpIHsgfVxuXG5cblx0Z2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gU2hvd01vcmVSZW5kZXJlci5JRDtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJTGFiZWxUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGxhYmVsID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5zaG93LW1vcmUnKSk7XG5cdFx0bGFiZWwuc3R5bGUuY29sb3IgPSBhc0Nzc1ZhcmlhYmxlKHRleHRMaW5rRm9yZWdyb3VuZCk7XG5cdFx0cmV0dXJuIHsgbGFiZWwgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPElTdGFja0ZyYW1lW10sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCBkYXRhOiBJTGFiZWxUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBzdGFja0ZyYW1lcyA9IGVsZW1lbnQuZWxlbWVudDtcblx0XHRpZiAoc3RhY2tGcmFtZXMuZXZlcnkoc2YgPT4gISEoc2Yuc291cmNlICYmIHNmLnNvdXJjZS5vcmlnaW4gJiYgc2Yuc291cmNlLm9yaWdpbiA9PT0gc3RhY2tGcmFtZXNbMF0uc291cmNlLm9yaWdpbikpKSB7XG5cdFx0XHRkYXRhLmxhYmVsLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ3Nob3dNb3JlQW5kT3JpZ2luJywgXCJTaG93IHswfSBNb3JlOiB7MX1cIiwgc3RhY2tGcmFtZXMubGVuZ3RoLCBzdGFja0ZyYW1lc1swXS5zb3VyY2Uub3JpZ2luKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGF0YS5sYWJlbC50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdzaG93TW9yZVN0YWNrRnJhbWVzJywgXCJTaG93IHswfSBNb3JlIFN0YWNrIEZyYW1lc1wiLCBzdGFja0ZyYW1lcy5sZW5ndGgpO1xuXHRcdH1cblx0fVxuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxJU3RhY2tGcmFtZVtdPiwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUxhYmVsVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElMYWJlbFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdC8vIG5vb3Bcblx0fVxufVxuXG5jbGFzcyBDYWxsU3RhY2tEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPENhbGxTdGFja0l0ZW0+IHtcblxuXHRnZXRIZWlnaHQoZWxlbWVudDogQ2FsbFN0YWNrSXRlbSk6IG51bWJlciB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBTdGFja0ZyYW1lICYmIGVsZW1lbnQucHJlc2VudGF0aW9uSGludCA9PT0gJ2xhYmVsJykge1xuXHRcdFx0cmV0dXJuIDE2O1xuXHRcdH1cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRocmVhZEFuZFNlc3Npb25JZHMgfHwgZWxlbWVudCBpbnN0YW5jZW9mIEFycmF5KSB7XG5cdFx0XHRyZXR1cm4gMTY7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIDIyO1xuXHR9XG5cblx0Z2V0VGVtcGxhdGVJZChlbGVtZW50OiBDYWxsU3RhY2tJdGVtKTogc3RyaW5nIHtcblx0XHRpZiAoaXNEZWJ1Z1Nlc3Npb24oZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBTZXNzaW9uc1JlbmRlcmVyLklEO1xuXHRcdH1cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRocmVhZCkge1xuXHRcdFx0cmV0dXJuIFRocmVhZHNSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBTdGFja0ZyYW1lKSB7XG5cdFx0XHRyZXR1cm4gU3RhY2tGcmFtZXNSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIEVycm9yc1JlbmRlcmVyLklEO1xuXHRcdH1cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFRocmVhZEFuZFNlc3Npb25JZHMpIHtcblx0XHRcdHJldHVybiBMb2FkTW9yZVJlbmRlcmVyLklEO1xuXHRcdH1cblxuXHRcdC8vIGVsZW1lbnQgaW5zdGFuY2VvZiBBcnJheVxuXHRcdHJldHVybiBTaG93TW9yZVJlbmRlcmVyLklEO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHN0b3BwZWRUZXh0KHN0b3BwZWREZXRhaWxzOiBJUmF3U3RvcHBlZERldGFpbHMpOiBzdHJpbmcge1xuXHRyZXR1cm4gc3RvcHBlZERldGFpbHMudGV4dCA/PyBzdG9wcGVkRGVzY3JpcHRpb24oc3RvcHBlZERldGFpbHMpO1xufVxuXG5mdW5jdGlvbiBzdG9wcGVkRGVzY3JpcHRpb24oc3RvcHBlZERldGFpbHM6IElSYXdTdG9wcGVkRGV0YWlscyk6IHN0cmluZyB7XG5cdHJldHVybiBzdG9wcGVkRGV0YWlscy5kZXNjcmlwdGlvbiB8fFxuXHRcdChzdG9wcGVkRGV0YWlscy5yZWFzb24gPyBsb2NhbGl6ZSh7IGtleTogJ3BhdXNlZE9uJywgY29tbWVudDogWydpbmRpY2F0ZXMgcmVhc29uIGZvciBwcm9ncmFtIGJlaW5nIHBhdXNlZCddIH0sIFwiUGF1c2VkIG9uIHswfVwiLCBzdG9wcGVkRGV0YWlscy5yZWFzb24pIDogbG9jYWxpemUoJ3BhdXNlZCcsIFwiUGF1c2VkXCIpKTtcbn1cblxuZnVuY3Rpb24gaXNEZWJ1Z01vZGVsKG9iajogYW55KTogb2JqIGlzIElEZWJ1Z01vZGVsIHtcblx0cmV0dXJuIHR5cGVvZiBvYmouZ2V0U2Vzc2lvbnMgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzRGVidWdTZXNzaW9uKG9iajogYW55KTogb2JqIGlzIElEZWJ1Z1Nlc3Npb24ge1xuXHRyZXR1cm4gb2JqICYmIHR5cGVvZiBvYmouZ2V0QWxsVGhyZWFkcyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuY2xhc3MgQ2FsbFN0YWNrRGF0YVNvdXJjZSBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8SURlYnVnTW9kZWwsIENhbGxTdGFja0l0ZW0+IHtcblx0ZGVlbXBoYXNpemVkU3RhY2tGcmFtZXNUb1Nob3c6IElTdGFja0ZyYW1lW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSkgeyB9XG5cblx0aGFzQ2hpbGRyZW4oZWxlbWVudDogSURlYnVnTW9kZWwgfCBDYWxsU3RhY2tJdGVtKTogYm9vbGVhbiB7XG5cdFx0aWYgKGlzRGVidWdTZXNzaW9uKGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCB0aHJlYWRzID0gZWxlbWVudC5nZXRBbGxUaHJlYWRzKCk7XG5cdFx0XHRyZXR1cm4gKHRocmVhZHMubGVuZ3RoID4gMSkgfHwgKHRocmVhZHMubGVuZ3RoID09PSAxICYmIHRocmVhZHNbMF0uc3RvcHBlZCkgfHwgISEodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9ucygpLmZpbmQocyA9PiBzLnBhcmVudFNlc3Npb24gPT09IGVsZW1lbnQpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gaXNEZWJ1Z01vZGVsKGVsZW1lbnQpIHx8IChlbGVtZW50IGluc3RhbmNlb2YgVGhyZWFkICYmIGVsZW1lbnQuc3RvcHBlZCk7XG5cdH1cblxuXHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50OiBJRGVidWdNb2RlbCB8IENhbGxTdGFja0l0ZW0pOiBQcm9taXNlPENhbGxTdGFja0l0ZW1bXT4ge1xuXHRcdGlmIChpc0RlYnVnTW9kZWwoZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IHNlc3Npb25zID0gZWxlbWVudC5nZXRTZXNzaW9ucygpO1xuXHRcdFx0aWYgKHNlc3Npb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtdKTtcblx0XHRcdH1cblx0XHRcdGlmIChzZXNzaW9ucy5sZW5ndGggPiAxIHx8IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmlzTXVsdGlTZXNzaW9uVmlldygpKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbnMuZmlsdGVyKHMgPT4gIXMucGFyZW50U2Vzc2lvbikpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0aHJlYWRzID0gc2Vzc2lvbnNbMF0uZ2V0QWxsVGhyZWFkcygpO1xuXHRcdFx0Ly8gT25seSBzaG93IHRoZSB0aHJlYWRzIGluIHRoZSBjYWxsIHN0YWNrIGlmIHRoZXJlIGlzIG1vcmUgdGhhbiAxIHRocmVhZC5cblx0XHRcdHJldHVybiB0aHJlYWRzLmxlbmd0aCA9PT0gMSA/IHRoaXMuZ2V0VGhyZWFkQ2hpbGRyZW4oPFRocmVhZD50aHJlYWRzWzBdKSA6IFByb21pc2UucmVzb2x2ZSh0aHJlYWRzKTtcblx0XHR9IGVsc2UgaWYgKGlzRGVidWdTZXNzaW9uKGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCBjaGlsZFNlc3Npb25zID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9ucygpLmZpbHRlcihzID0+IHMucGFyZW50U2Vzc2lvbiA9PT0gZWxlbWVudCk7XG5cdFx0XHRjb25zdCB0aHJlYWRzOiBDYWxsU3RhY2tJdGVtW10gPSBlbGVtZW50LmdldEFsbFRocmVhZHMoKTtcblx0XHRcdGlmICh0aHJlYWRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHQvLyBEbyBub3Qgc2hvdyB0aHJlYWQgd2hlbiB0aGVyZSBpcyBvbmx5IG9uZSB0byBiZSBjb21wYWN0LlxuXHRcdFx0XHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IHRoaXMuZ2V0VGhyZWFkQ2hpbGRyZW4oPFRocmVhZD50aHJlYWRzWzBdKTtcblx0XHRcdFx0cmV0dXJuIGNoaWxkcmVuLmNvbmNhdChjaGlsZFNlc3Npb25zKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aHJlYWRzLmNvbmNhdChjaGlsZFNlc3Npb25zKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLmdldFRocmVhZENoaWxkcmVuKDxUaHJlYWQ+ZWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRUaHJlYWRDaGlsZHJlbih0aHJlYWQ6IFRocmVhZCk6IFByb21pc2U8Q2FsbFN0YWNrSXRlbVtdPiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0VGhyZWFkQ2FsbHN0YWNrKHRocmVhZCkudGhlbihjaGlsZHJlbiA9PiB7XG5cdFx0XHQvLyBDaGVjayBpZiBzb21lIHN0YWNrIGZyYW1lcyBzaG91bGQgYmUgaGlkZGVuIHVuZGVyIGEgcGFyZW50IGVsZW1lbnQgc2luY2UgdGhleSBhcmUgZGVlbXBoYXNpemVkXG5cdFx0XHRjb25zdCByZXN1bHQ6IENhbGxTdGFja0l0ZW1bXSA9IFtdO1xuXHRcdFx0Y2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQsIGluZGV4KSA9PiB7XG5cdFx0XHRcdGlmIChjaGlsZCBpbnN0YW5jZW9mIFN0YWNrRnJhbWUgJiYgY2hpbGQuc291cmNlICYmIGlzRnJhbWVEZWVtcGhhc2l6ZWQoY2hpbGQpKSB7XG5cdFx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIHVzZXIgY2xpY2tlZCB0byBzaG93IHRoZSBkZWVtcGhhc2l6ZWQgc291cmNlXG5cdFx0XHRcdFx0aWYgKHRoaXMuZGVlbXBoYXNpemVkU3RhY2tGcmFtZXNUb1Nob3cuaW5kZXhPZihjaGlsZCkgPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRpZiAocmVzdWx0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBsYXN0ID0gcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXTtcblx0XHRcdFx0XHRcdFx0aWYgKGxhc3QgaW5zdGFuY2VvZiBBcnJheSkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIENvbGxlY3QgYWxsIHRoZSBzdGFja2ZyYW1lcyB0aGF0IHdpbGwgYmUgXCJjb2xsYXBzZWRcIlxuXHRcdFx0XHRcdFx0XHRcdGxhc3QucHVzaChjaGlsZCk7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IG5leHRDaGlsZCA9IGluZGV4IDwgY2hpbGRyZW4ubGVuZ3RoIC0gMSA/IGNoaWxkcmVuW2luZGV4ICsgMV0gOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRpZiAobmV4dENoaWxkIGluc3RhbmNlb2YgU3RhY2tGcmFtZSAmJiBuZXh0Q2hpbGQuc291cmNlICYmIGlzRnJhbWVEZWVtcGhhc2l6ZWQobmV4dENoaWxkKSkge1xuXHRcdFx0XHRcdFx0XHQvLyBTdGFydCBjb2xsZWN0aW5nIHN0YWNrZnJhbWVzIHRoYXQgd2lsbCBiZSBcImNvbGxhcHNlZFwiXG5cdFx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKFtjaGlsZF0pO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmVzdWx0LnB1c2goY2hpbGQpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFRocmVhZENhbGxzdGFjayh0aHJlYWQ6IFRocmVhZCk6IFByb21pc2U8QXJyYXk8SVN0YWNrRnJhbWUgfCBzdHJpbmcgfCBUaHJlYWRBbmRTZXNzaW9uSWRzPj4ge1xuXHRcdGxldCBjYWxsU3RhY2s6IGFueVtdID0gdGhyZWFkLmdldENhbGxTdGFjaygpO1xuXHRcdGlmICghY2FsbFN0YWNrIHx8ICFjYWxsU3RhY2subGVuZ3RoKSB7XG5cdFx0XHRhd2FpdCB0aHJlYWQuZmV0Y2hDYWxsU3RhY2soKTtcblx0XHRcdGNhbGxTdGFjayA9IHRocmVhZC5nZXRDYWxsU3RhY2soKTtcblx0XHR9XG5cblx0XHRpZiAoY2FsbFN0YWNrLmxlbmd0aCA9PT0gMSAmJiB0aHJlYWQuc2Vzc2lvbi5jYXBhYmlsaXRpZXMuc3VwcG9ydHNEZWxheWVkU3RhY2tUcmFjZUxvYWRpbmcgJiYgdGhyZWFkLnN0b3BwZWREZXRhaWxzICYmIHRocmVhZC5zdG9wcGVkRGV0YWlscy50b3RhbEZyYW1lcyAmJiB0aHJlYWQuc3RvcHBlZERldGFpbHMudG90YWxGcmFtZXMgPiAxKSB7XG5cdFx0XHQvLyBUbyByZWR1Y2UgZmxhc2hpbmcgb2YgdGhlIGNhbGwgc3RhY2sgdmlldyBzaW1wbHkgYXBwZW5kIHRoZSBzdGFsZSBjYWxsIHN0YWNrXG5cdFx0XHQvLyBvbmNlIHdlIGhhdmUgdGhlIGNvcnJlY3QgZGF0YSB0aGUgdHJlZSB3aWxsIHJlZnJlc2ggYW5kIHdlIHdpbGwgbm8gbG9uZ2VyIGRpc3BsYXkgaXQuXG5cdFx0XHRjYWxsU3RhY2sgPSBjYWxsU3RhY2suY29uY2F0KHRocmVhZC5nZXRTdGFsZUNhbGxTdGFjaygpLnNsaWNlKDEpKTtcblx0XHR9XG5cblx0XHRpZiAodGhyZWFkLnN0b3BwZWREZXRhaWxzICYmIHRocmVhZC5zdG9wcGVkRGV0YWlscy5mcmFtZXNFcnJvck1lc3NhZ2UpIHtcblx0XHRcdGNhbGxTdGFjayA9IGNhbGxTdGFjay5jb25jYXQoW3RocmVhZC5zdG9wcGVkRGV0YWlscy5mcmFtZXNFcnJvck1lc3NhZ2VdKTtcblx0XHR9XG5cdFx0aWYgKCF0aHJlYWQucmVhY2hlZEVuZE9mQ2FsbFN0YWNrICYmIHRocmVhZC5zdG9wcGVkRGV0YWlscykge1xuXHRcdFx0Y2FsbFN0YWNrID0gY2FsbFN0YWNrLmNvbmNhdChbbmV3IFRocmVhZEFuZFNlc3Npb25JZHModGhyZWFkLnNlc3Npb24uZ2V0SWQoKSwgdGhyZWFkLnRocmVhZElkKV0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBjYWxsU3RhY2s7XG5cdH1cbn1cblxuY2xhc3MgQ2FsbFN0YWNrQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8Q2FsbFN0YWNrSXRlbT4ge1xuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnRGVidWcgaXMgYSBub3VuIGluIHRoaXMgY29udGV4dCwgbm90IGEgdmVyYi4nXSwga2V5OiAnY2FsbFN0YWNrQXJpYUxhYmVsJyB9LCBcIkRlYnVnIENhbGwgU3RhY2tcIik7XG5cdH1cblxuXHRnZXRXaWRnZXRSb2xlKCk6IEFyaWFSb2xlIHtcblx0XHQvLyBVc2UgdHJlZWdyaWQgYXMgYSByb2xlIHNpbmNlIGVhY2ggZWxlbWVudCBjYW4gaGF2ZSBhZGRpdGlvbmFsIGFjdGlvbnMgaW5zaWRlICMxNDYyMTBcblx0XHRyZXR1cm4gJ3RyZWVncmlkJztcblx0fVxuXG5cdGdldFJvbGUoX2VsZW1lbnQ6IENhbGxTdGFja0l0ZW0pOiBBcmlhUm9sZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuICdyb3cnO1xuXHR9XG5cblx0Z2V0QXJpYUxhYmVsKGVsZW1lbnQ6IENhbGxTdGFja0l0ZW0pOiBzdHJpbmcge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVGhyZWFkKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoeyBrZXk6ICd0aHJlYWRBcmlhTGFiZWwnLCBjb21tZW50OiBbJ1BsYWNlaG9sZGVycyBzdGFuZCBmb3IgdGhlIHRocmVhZCBuYW1lIGFuZCB0aGUgdGhyZWFkIHN0YXRlLkZvciBleGFtcGxlIFwiVGhyZWFkIDFcIiBhbmQgXCJTdG9wcGVkJ10gfSwgXCJUaHJlYWQgezB9IHsxfVwiLCBlbGVtZW50Lm5hbWUsIGVsZW1lbnQuc3RhdGVMYWJlbCk7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgU3RhY2tGcmFtZSkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzdGFja0ZyYW1lQXJpYUxhYmVsJywgXCJTdGFjayBGcmFtZSB7MH0sIGxpbmUgezF9LCB7Mn1cIiwgZWxlbWVudC5uYW1lLCBlbGVtZW50LnJhbmdlLnN0YXJ0TGluZU51bWJlciwgZ2V0U3BlY2lmaWNTb3VyY2VOYW1lKGVsZW1lbnQpKTtcblx0XHR9XG5cdFx0aWYgKGlzRGVidWdTZXNzaW9uKGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCB0aHJlYWQgPSBlbGVtZW50LmdldEFsbFRocmVhZHMoKS5maW5kKHQgPT4gdC5zdG9wcGVkKTtcblx0XHRcdGNvbnN0IHN0YXRlID0gdGhyZWFkID8gdGhyZWFkLnN0YXRlTGFiZWwgOiBsb2NhbGl6ZSh7IGtleTogJ3J1bm5pbmcnLCBjb21tZW50OiBbJ2luZGljYXRlcyBzdGF0ZSddIH0sIFwiUnVubmluZ1wiKTtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSh7IGtleTogJ3Nlc3Npb25MYWJlbCcsIGNvbW1lbnQ6IFsnUGxhY2Vob2xkZXJzIHN0YW5kIGZvciB0aGUgc2Vzc2lvbiBuYW1lIGFuZCB0aGUgc2Vzc2lvbiBzdGF0ZS4gRm9yIGV4YW1wbGUgXCJMYXVuY2ggUHJvZ3JhbVwiIGFuZCBcIlJ1bm5pbmdcIiddIH0sIFwiU2Vzc2lvbiB7MH0gezF9XCIsIGVsZW1lbnQuZ2V0TGFiZWwoKSwgc3RhdGUpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBBcnJheSkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaG93TW9yZVN0YWNrRnJhbWVzJywgXCJTaG93IHswfSBNb3JlIFN0YWNrIEZyYW1lc1wiLCBlbGVtZW50Lmxlbmd0aCk7XG5cdFx0fVxuXG5cdFx0Ly8gZWxlbWVudCBpbnN0YW5jZW9mIFRocmVhZEFuZFNlc3Npb25JZHNcblx0XHRyZXR1cm4gTG9hZE1vcmVSZW5kZXJlci5MQUJFTDtcblx0fVxufVxuXG5jbGFzcyBDYWxsU3RhY2tDb21wcmVzc2lvbkRlbGVnYXRlIGltcGxlbWVudHMgSVRyZWVDb21wcmVzc2lvbkRlbGVnYXRlPENhbGxTdGFja0l0ZW0+IHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSkgeyB9XG5cblx0aXNJbmNvbXByZXNzaWJsZShzdGF0OiBDYWxsU3RhY2tJdGVtKTogYm9vbGVhbiB7XG5cdFx0aWYgKGlzRGVidWdTZXNzaW9uKHN0YXQpKSB7XG5cdFx0XHRpZiAoc3RhdC5jb21wYWN0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHNlc3Npb25zID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9ucygpO1xuXHRcdFx0aWYgKHNlc3Npb25zLnNvbWUocyA9PiBzLnBhcmVudFNlc3Npb24gPT09IHN0YXQgJiYgcy5jb21wYWN0KSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDb2xsYXBzZSBleHRlbmRzIFZpZXdBY3Rpb248Q2FsbFN0YWNrVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2NhbGxTdGFjay5jb2xsYXBzZScsXG5cdFx0XHR2aWV3SWQ6IENBTExTVEFDS19WSUVXX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjb2xsYXBzZScsIFwiQ29sbGFwc2UgQWxsXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jb2xsYXBzZUFsbCxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oZ2V0U3RhdGVMYWJlbChTdGF0ZS5TdG9wcGVkKSksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRvcmRlcjogMTAsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIENBTExTVEFDS19WSUVXX0lEKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuSW5WaWV3KF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogQ2FsbFN0YWNrVmlldykge1xuXHRcdHZpZXcuY29sbGFwc2VBbGwoKTtcblx0fVxufSk7XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQ2FsbFN0YWNrSW5saW5lTWVudUl0ZW0oaWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZyB8IElDb21tYW5kQWN0aW9uVGl0bGUsIGljb246IEljb24sIHdoZW46IENvbnRleHRLZXlFeHByZXNzaW9uLCBvcmRlcjogbnVtYmVyLCBwcmVjb25kaXRpb24/OiBDb250ZXh0S2V5RXhwcmVzc2lvbik6IHZvaWQge1xuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkRlYnVnQ2FsbFN0YWNrQ29udGV4dCwge1xuXHRcdGdyb3VwOiAnaW5saW5lJyxcblx0XHRvcmRlcixcblx0XHR3aGVuLFxuXHRcdGNvbW1hbmQ6IHsgaWQsIHRpdGxlLCBpY29uLCBwcmVjb25kaXRpb24gfVxuXHR9KTtcbn1cblxuY29uc3QgdGhyZWFkT3JTZXNzaW9uV2l0aE9uZVRocmVhZCA9IENvbnRleHRLZXlFeHByLm9yKENPTlRFWFRfQ0FMTFNUQUNLX0lURU1fVFlQRS5pc0VxdWFsVG8oJ3RocmVhZCcpLCBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9DQUxMU1RBQ0tfSVRFTV9UWVBFLmlzRXF1YWxUbygnc2Vzc2lvbicpLCBDT05URVhUX0NBTExTVEFDS19TRVNTSU9OX0hBU19PTkVfVEhSRUFEKSkhO1xucmVnaXN0ZXJDYWxsU3RhY2tJbmxpbmVNZW51SXRlbShQQVVTRV9JRCwgUEFVU0VfTEFCRUwsIGljb25zLmRlYnVnUGF1c2UsIENvbnRleHRLZXlFeHByLmFuZCh0aHJlYWRPclNlc3Npb25XaXRoT25lVGhyZWFkLCBDT05URVhUX0NBTExTVEFDS19JVEVNX1NUT1BQRUQudG9OZWdhdGVkKCkpISwgMTAsIENPTlRFWFRfRk9DVVNFRF9TRVNTSU9OX0lTX05PX0RFQlVHLnRvTmVnYXRlZCgpKTtcbnJlZ2lzdGVyQ2FsbFN0YWNrSW5saW5lTWVudUl0ZW0oQ09OVElOVUVfSUQsIENPTlRJTlVFX0xBQkVMLCBpY29ucy5kZWJ1Z0NvbnRpbnVlLCBDb250ZXh0S2V5RXhwci5hbmQodGhyZWFkT3JTZXNzaW9uV2l0aE9uZVRocmVhZCwgQ09OVEVYVF9DQUxMU1RBQ0tfSVRFTV9TVE9QUEVEKSEsIDEwKTtcbnJlZ2lzdGVyQ2FsbFN0YWNrSW5saW5lTWVudUl0ZW0oU1RFUF9PVkVSX0lELCBTVEVQX09WRVJfTEFCRUwsIGljb25zLmRlYnVnU3RlcE92ZXIsIHRocmVhZE9yU2Vzc2lvbldpdGhPbmVUaHJlYWQsIDIwLCBDT05URVhUX0NBTExTVEFDS19JVEVNX1NUT1BQRUQpO1xucmVnaXN0ZXJDYWxsU3RhY2tJbmxpbmVNZW51SXRlbShTVEVQX0lOVE9fSUQsIFNURVBfSU5UT19MQUJFTCwgaWNvbnMuZGVidWdTdGVwSW50bywgdGhyZWFkT3JTZXNzaW9uV2l0aE9uZVRocmVhZCwgMzAsIENPTlRFWFRfQ0FMTFNUQUNLX0lURU1fU1RPUFBFRCk7XG5yZWdpc3RlckNhbGxTdGFja0lubGluZU1lbnVJdGVtKFNURVBfT1VUX0lELCBTVEVQX09VVF9MQUJFTCwgaWNvbnMuZGVidWdTdGVwT3V0LCB0aHJlYWRPclNlc3Npb25XaXRoT25lVGhyZWFkLCA0MCwgQ09OVEVYVF9DQUxMU1RBQ0tfSVRFTV9TVE9QUEVEKTtcbnJlZ2lzdGVyQ2FsbFN0YWNrSW5saW5lTWVudUl0ZW0oUkVTVEFSVF9TRVNTSU9OX0lELCBSRVNUQVJUX0xBQkVMLCBpY29ucy5kZWJ1Z1Jlc3RhcnQsIENPTlRFWFRfQ0FMTFNUQUNLX0lURU1fVFlQRS5pc0VxdWFsVG8oJ3Nlc3Npb24nKSwgNTApO1xucmVnaXN0ZXJDYWxsU3RhY2tJbmxpbmVNZW51SXRlbShTVE9QX0lELCBTVE9QX0xBQkVMLCBpY29ucy5kZWJ1Z1N0b3AsIENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0NBTExTVEFDS19TRVNTSU9OX0lTX0FUVEFDSC50b05lZ2F0ZWQoKSwgQ09OVEVYVF9DQUxMU1RBQ0tfSVRFTV9UWVBFLmlzRXF1YWxUbygnc2Vzc2lvbicpKSEsIDYwKTtcbnJlZ2lzdGVyQ2FsbFN0YWNrSW5saW5lTWVudUl0ZW0oRElTQ09OTkVDVF9JRCwgRElTQ09OTkVDVF9MQUJFTCwgaWNvbnMuZGVidWdEaXNjb25uZWN0LCBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9DQUxMU1RBQ0tfU0VTU0lPTl9JU19BVFRBQ0gsIENPTlRFWFRfQ0FMTFNUQUNLX0lURU1fVFlQRS5pc0VxdWFsVG8oJ3Nlc3Npb24nKSkhLCA2MCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGlCQUFpQjtBQUUxQixTQUFTLHdCQUF3QjtBQU9qQyxTQUFTLGNBQWM7QUFDdkIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtB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
