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
import { Gesture } from "../../../../base/browser/touch.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { InputBox } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { Orientation } from "../../../../base/browser/ui/splitview/splitview.js";
import { Action } from "../../../../base/common/actions.js";
import { equals } from "../../../../base/common/arrays.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import * as resources from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Constants } from "../../../../base/common/uint.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { localize, localize2 } from "../../../../nls.js";
import { getActionBarActions, getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { TextEditorSelectionRevealType } from "../../../../platform/editor/common/editor.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewAction, ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { BREAKPOINTS_VIEW_ID, BREAKPOINT_EDITOR_CONTRIBUTION_ID, CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINTS_FOCUSED, CONTEXT_BREAKPOINT_HAS_MODES, CONTEXT_BREAKPOINT_INPUT_FOCUSED, CONTEXT_BREAKPOINT_ITEM_IS_DATA_BYTES, CONTEXT_BREAKPOINT_ITEM_TYPE, CONTEXT_BREAKPOINT_SUPPORTS_CONDITION, CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_IN_DEBUG_MODE, CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED, DEBUG_SCHEME, DataBreakpointSetType, DebuggerString, IDebugService, State } from "../common/debug.js";
import { Breakpoint, DataBreakpoint, ExceptionBreakpoint, FunctionBreakpoint, InstructionBreakpoint } from "../common/debugModel.js";
import { DisassemblyViewInput } from "../common/disassemblyViewInput.js";
import * as icons from "./debugIcons.js";
const $ = dom.$;
function createCheckbox(disposables) {
  const checkbox = $("input");
  checkbox.type = "checkbox";
  checkbox.tabIndex = -1;
  disposables.add(Gesture.ignoreTarget(checkbox));
  return checkbox;
}
const MAX_VISIBLE_BREAKPOINTS = 9;
function getExpandedBodySize(model, sessionId, countLimit) {
  const length = model.getBreakpoints().length + model.getExceptionBreakpointsForSession(sessionId).length + model.getFunctionBreakpoints().length + model.getDataBreakpoints().length + model.getInstructionBreakpoints().length;
  return Math.min(countLimit, length) * 22;
}
function getModeKindForBreakpoint(breakpoint) {
  const kind = breakpoint instanceof Breakpoint ? "source" : breakpoint instanceof InstructionBreakpoint ? "instruction" : "exception";
  return kind;
}
let BreakpointsView = class extends ViewPane {
  constructor(options, contextMenuService, debugService, keybindingService, instantiationService, themeService, editorService, contextViewService, configurationService, viewDescriptorService, contextKeyService, openerService, labelService, menuService, hoverService, languageService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.debugService = debugService;
    this.editorService = editorService;
    this.contextViewService = contextViewService;
    this.labelService = labelService;
    this.languageService = languageService;
    this.needsRefresh = false;
    this.needsStateChange = false;
    this.ignoreLayout = false;
    this.autoFocusedIndex = -1;
    this.menu = menuService.createMenu(MenuId.DebugBreakpointsContext, contextKeyService);
    this._register(this.menu);
    this.breakpointItemType = CONTEXT_BREAKPOINT_ITEM_TYPE.bindTo(contextKeyService);
    this.breakpointIsDataBytes = CONTEXT_BREAKPOINT_ITEM_IS_DATA_BYTES.bindTo(contextKeyService);
    this.breakpointHasMultipleModes = CONTEXT_BREAKPOINT_HAS_MODES.bindTo(contextKeyService);
    this.breakpointSupportsCondition = CONTEXT_BREAKPOINT_SUPPORTS_CONDITION.bindTo(contextKeyService);
    this.breakpointInputFocused = CONTEXT_BREAKPOINT_INPUT_FOCUSED.bindTo(contextKeyService);
    this._register(this.debugService.getModel().onDidChangeBreakpoints(() => this.onBreakpointsChange()));
    this._register(this.debugService.getViewModel().onDidFocusSession(() => this.onBreakpointsChange()));
    this._register(this.debugService.onDidChangeState(() => this.onStateChange()));
    this.hintDelayer = this._register(new RunOnceScheduler(() => this.updateBreakpointsHint(true), 4e3));
  }
  renderBody(container) {
    super.renderBody(container);
    this.element.classList.add("debug-pane");
    container.classList.add("debug-breakpoints");
    const delegate = new BreakpointsDelegate(this);
    this.list = this.instantiationService.createInstance(WorkbenchList, "Breakpoints", container, delegate, [
      this.instantiationService.createInstance(BreakpointsRenderer, this.menu, this.breakpointHasMultipleModes, this.breakpointSupportsCondition, this.breakpointItemType),
      new ExceptionBreakpointsRenderer(this.menu, this.breakpointHasMultipleModes, this.breakpointSupportsCondition, this.breakpointItemType, this.debugService, this.hoverService),
      new ExceptionBreakpointInputRenderer(this, this.debugService, this.contextViewService),
      this.instantiationService.createInstance(FunctionBreakpointsRenderer, this.menu, this.breakpointSupportsCondition, this.breakpointItemType),
      new FunctionBreakpointInputRenderer(this, this.debugService, this.contextViewService, this.hoverService, this.labelService),
      this.instantiationService.createInstance(DataBreakpointsRenderer, this.menu, this.breakpointHasMultipleModes, this.breakpointSupportsCondition, this.breakpointItemType, this.breakpointIsDataBytes),
      new DataBreakpointInputRenderer(this, this.debugService, this.contextViewService, this.hoverService, this.labelService),
      this.instantiationService.createInstance(InstructionBreakpointsRenderer)
    ], {
      identityProvider: { getId: (element) => element.getId() },
      multipleSelectionSupport: false,
      keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (e) => e },
      accessibilityProvider: new BreakpointsAccessibilityProvider(this.debugService, this.labelService),
      overrideStyles: this.getLocationBasedColors().listOverrideStyles
    });
    CONTEXT_BREAKPOINTS_FOCUSED.bindTo(this.list.contextKeyService);
    this._register(this.list.onContextMenu(this.onListContextMenu, this));
    this._register(this.list.onMouseMiddleClick(async ({ element }) => {
      if (element instanceof Breakpoint) {
        await this.debugService.removeBreakpoints(element.getId());
      } else if (element instanceof FunctionBreakpoint) {
        await this.debugService.removeFunctionBreakpoints(element.getId());
      } else if (element instanceof DataBreakpoint) {
        await this.debugService.removeDataBreakpoints(element.getId());
      } else if (element instanceof InstructionBreakpoint) {
        await this.debugService.removeInstructionBreakpoints(element.instructionReference, element.offset);
      }
    }));
    this._register(this.list.onDidOpen(async (e) => {
      if (!e.element) {
        return;
      }
      if (dom.isMouseEvent(e.browserEvent) && e.browserEvent.button === 1) {
        return;
      }
      if (e.element instanceof Breakpoint) {
        openBreakpointSource(e.element, e.sideBySide, e.editorOptions.preserveFocus || false, e.editorOptions.pinned || !e.editorOptions.preserveFocus, this.debugService, this.editorService);
      }
      if (e.element instanceof InstructionBreakpoint) {
        const disassemblyView = await this.editorService.openEditor(DisassemblyViewInput.instance);
        disassemblyView.goToInstructionAndOffset(e.element.instructionReference, e.element.offset, dom.isMouseEvent(e.browserEvent) && e.browserEvent.detail === 2);
      }
      if (dom.isMouseEvent(e.browserEvent) && e.browserEvent.detail === 2 && e.element instanceof FunctionBreakpoint && e.element !== this.inputBoxData?.breakpoint) {
        this.renderInputBox({ breakpoint: e.element, type: "name" });
      }
    }));
    this.list.splice(0, this.list.length, this.elements);
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible) {
        if (this.needsRefresh) {
          this.onBreakpointsChange();
        }
        if (this.needsStateChange) {
          this.onStateChange();
        }
      }
    }));
    const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id));
    this._register(containerModel.onDidChangeAllViewDescriptors(() => {
      this.updateSize();
    }));
  }
  renderHeaderTitle(container, title) {
    super.renderHeaderTitle(container, title);
    const iconLabelContainer = dom.append(container, $("span.breakpoint-warning"));
    this.hintContainer = this._register(new IconLabel(iconLabelContainer, {
      supportIcons: true,
      hoverDelegate: {
        showHover: (options, focus) => this.hoverService.showInstantHover({ content: options.content, target: this.hintContainer.element }, focus),
        delay: this.configurationService.getValue("workbench.hover.delay")
      }
    }));
    dom.hide(this.hintContainer.element);
  }
  focus() {
    super.focus();
    this.list?.domFocus();
  }
  renderInputBox(data) {
    this._inputBoxData = data;
    this.onBreakpointsChange();
    this._inputBoxData = void 0;
  }
  get inputBoxData() {
    return this._inputBoxData;
  }
  layoutBody(height, width) {
    if (this.ignoreLayout) {
      return;
    }
    super.layoutBody(height, width);
    this.list?.layout(height, width);
    try {
      this.ignoreLayout = true;
      this.updateSize();
    } finally {
      this.ignoreLayout = false;
    }
  }
  onListContextMenu(e) {
    const element = e.element;
    const type = element instanceof Breakpoint ? "breakpoint" : element instanceof ExceptionBreakpoint ? "exceptionBreakpoint" : element instanceof FunctionBreakpoint ? "functionBreakpoint" : element instanceof DataBreakpoint ? "dataBreakpoint" : element instanceof InstructionBreakpoint ? "instructionBreakpoint" : void 0;
    this.breakpointItemType.set(type);
    const session = this.debugService.getViewModel().focusedSession;
    const conditionSupported = element instanceof ExceptionBreakpoint ? element.supportsCondition : !session || !!session.capabilities.supportsConditionalBreakpoints;
    this.breakpointSupportsCondition.set(conditionSupported);
    this.breakpointIsDataBytes.set(element instanceof DataBreakpoint && element.src.type === DataBreakpointSetType.Address);
    this.breakpointHasMultipleModes.set(this.debugService.getModel().getBreakpointModes(getModeKindForBreakpoint(element)).length > 1);
    const { secondary } = getContextMenuActions(this.menu.getActions({ arg: e.element, shouldForwardArgs: false }), "inline");
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => secondary,
      getActionsContext: () => element
    });
  }
  updateSize() {
    const containerModel = this.viewDescriptorService.getViewContainerModel(this.viewDescriptorService.getViewContainerByViewId(this.id));
    const sessionId = this.debugService.getViewModel().focusedSession?.getId();
    this.minimumBodySize = this.orientation === Orientation.VERTICAL ? getExpandedBodySize(this.debugService.getModel(), sessionId, MAX_VISIBLE_BREAKPOINTS) : 170;
    this.maximumBodySize = this.orientation === Orientation.VERTICAL && containerModel.visibleViewDescriptors.length > 1 ? getExpandedBodySize(this.debugService.getModel(), sessionId, Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
  }
  updateBreakpointsHint(delayed = false) {
    if (!this.hintContainer) {
      return;
    }
    const currentType = this.debugService.getViewModel().focusedSession?.configuration.type;
    const dbg = currentType ? this.debugService.getAdapterManager().getDebugger(currentType) : void 0;
    const message = dbg?.strings?.[DebuggerString.UnverifiedBreakpoints];
    const debuggerHasUnverifiedBps = message && this.debugService.getModel().getBreakpoints().filter((bp) => {
      if (bp.verified || !bp.enabled) {
        return false;
      }
      const langId = this.languageService.guessLanguageIdByFilepathOrFirstLine(bp.uri);
      return langId && dbg.interestedInLanguage(langId);
    });
    if (message && debuggerHasUnverifiedBps?.length && this.debugService.getModel().areBreakpointsActivated()) {
      if (delayed) {
        const mdown = new MarkdownString(void 0, { isTrusted: true }).appendMarkdown(message);
        this.hintContainer.setLabel("$(warning)", void 0, { title: { markdown: mdown, markdownNotSupportedFallback: message } });
        dom.show(this.hintContainer.element);
      } else {
        this.hintDelayer.schedule();
      }
    } else {
      dom.hide(this.hintContainer.element);
    }
  }
  onBreakpointsChange() {
    if (this.isBodyVisible()) {
      this.updateSize();
      if (this.list) {
        const lastFocusIndex = this.list.getFocus()[0];
        const needsRefocus = lastFocusIndex && !this.elements.includes(this.list.element(lastFocusIndex));
        this.list.splice(0, this.list.length, this.elements);
        this.needsRefresh = false;
        if (needsRefocus) {
          this.list.focusNth(Math.min(lastFocusIndex, this.list.length - 1));
        }
      }
      this.updateBreakpointsHint();
    } else {
      this.needsRefresh = true;
    }
  }
  onStateChange() {
    if (this.isBodyVisible()) {
      this.needsStateChange = false;
      const thread = this.debugService.getViewModel().focusedThread;
      let found = false;
      if (thread && thread.stoppedDetails && thread.stoppedDetails.hitBreakpointIds && thread.stoppedDetails.hitBreakpointIds.length > 0) {
        const hitBreakpointIds = thread.stoppedDetails.hitBreakpointIds;
        const elements = this.elements;
        const index = elements.findIndex((e) => {
          const id = e.getIdFromAdapter(thread.session.getId());
          return typeof id === "number" && hitBreakpointIds.indexOf(id) !== -1;
        });
        if (index >= 0) {
          this.list.setFocus([index]);
          this.list.setSelection([index]);
          found = true;
          this.autoFocusedIndex = index;
        }
      }
      if (!found) {
        const focus = this.list.getFocus();
        const selection = this.list.getSelection();
        if (this.autoFocusedIndex >= 0 && equals(focus, selection) && focus.indexOf(this.autoFocusedIndex) >= 0) {
          this.list.setFocus([]);
          this.list.setSelection([]);
        }
        this.autoFocusedIndex = -1;
      }
      this.updateBreakpointsHint();
    } else {
      this.needsStateChange = true;
    }
  }
  get elements() {
    const model = this.debugService.getModel();
    const sessionId = this.debugService.getViewModel().focusedSession?.getId();
    const elements = model.getExceptionBreakpointsForSession(sessionId).concat(model.getFunctionBreakpoints()).concat(model.getDataBreakpoints()).concat(model.getBreakpoints()).concat(model.getInstructionBreakpoints());
    return elements;
  }
};
BreakpointsView = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IDebugService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IContextViewService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IViewDescriptorService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IOpenerService),
  __decorateParam(12, ILabelService),
  __decorateParam(13, IMenuService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, ILanguageService)
], BreakpointsView);
class BreakpointsDelegate {
  constructor(view) {
    this.view = view;
  }
  getHeight(_element) {
    return 22;
  }
  getTemplateId(element) {
    if (element instanceof Breakpoint) {
      return BreakpointsRenderer.ID;
    }
    if (element instanceof FunctionBreakpoint) {
      const inputBoxBreakpoint = this.view.inputBoxData?.breakpoint;
      if (!element.name || inputBoxBreakpoint && inputBoxBreakpoint.getId() === element.getId()) {
        return FunctionBreakpointInputRenderer.ID;
      }
      return FunctionBreakpointsRenderer.ID;
    }
    if (element instanceof ExceptionBreakpoint) {
      const inputBoxBreakpoint = this.view.inputBoxData?.breakpoint;
      if (inputBoxBreakpoint && inputBoxBreakpoint.getId() === element.getId()) {
        return ExceptionBreakpointInputRenderer.ID;
      }
      return ExceptionBreakpointsRenderer.ID;
    }
    if (element instanceof DataBreakpoint) {
      const inputBoxBreakpoint = this.view.inputBoxData?.breakpoint;
      if (inputBoxBreakpoint && inputBoxBreakpoint.getId() === element.getId()) {
        return DataBreakpointInputRenderer.ID;
      }
      return DataBreakpointsRenderer.ID;
    }
    if (element instanceof InstructionBreakpoint) {
      return InstructionBreakpointsRenderer.ID;
    }
    return "";
  }
}
const breakpointIdToActionBarDomeNode = /* @__PURE__ */ new Map();
let BreakpointsRenderer = class {
  constructor(menu, breakpointHasMultipleModes, breakpointSupportsCondition, breakpointItemType, debugService, hoverService, labelService) {
    this.menu = menu;
    this.breakpointHasMultipleModes = breakpointHasMultipleModes;
    this.breakpointSupportsCondition = breakpointSupportsCondition;
    this.breakpointItemType = breakpointItemType;
    this.debugService = debugService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  get templateId() {
    return BreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.icon = $(".icon");
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(dom.addStandardDisposableListener(data.checkbox, "change", (e) => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.icon);
    dom.append(data.breakpoint, data.checkbox);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.filePath = dom.append(data.breakpoint, $("span.file-path"));
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(breakpoint, index, data) {
    data.context = breakpoint;
    data.breakpoint.classList.toggle("disabled", !this.debugService.getModel().areBreakpointsActivated());
    data.name.textContent = resources.basenameOrAuthority(breakpoint.uri);
    let badgeContent = breakpoint.lineNumber.toString();
    if (breakpoint.column) {
      badgeContent += `:${breakpoint.column}`;
    }
    if (breakpoint.modeLabel) {
      badgeContent = `${breakpoint.modeLabel}: ${badgeContent}`;
    }
    data.badge.textContent = badgeContent;
    data.filePath.textContent = this.labelService.getUriLabel(resources.dirname(breakpoint.uri), { relative: true });
    data.checkbox.checked = breakpoint.enabled;
    const { message, icon } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), breakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, breakpoint.message || message || ""));
    const debugActive = this.debugService.state === State.Running || this.debugService.state === State.Stopped;
    if (debugActive && !breakpoint.verified) {
      data.breakpoint.classList.add("disabled");
    }
    const session = this.debugService.getViewModel().focusedSession;
    this.breakpointSupportsCondition.set(!session || !!session.capabilities.supportsConditionalBreakpoints);
    this.breakpointItemType.set("breakpoint");
    this.breakpointHasMultipleModes.set(this.debugService.getModel().getBreakpointModes("source").length > 1);
    const { primary } = getActionBarActions(this.menu.getActions({ arg: breakpoint, shouldForwardArgs: true }), "inline");
    data.actionBar.clear();
    data.actionBar.push(primary, { icon: true, label: false });
    breakpointIdToActionBarDomeNode.set(breakpoint.getId(), data.actionBar.domNode);
  }
  disposeElement(a, index, template) {
    template.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
BreakpointsRenderer.ID = "breakpoints";
BreakpointsRenderer = __decorateClass([
  __decorateParam(4, IDebugService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, ILabelService)
], BreakpointsRenderer);
const _ExceptionBreakpointsRenderer = class _ExceptionBreakpointsRenderer {
  constructor(menu, breakpointHasMultipleModes, breakpointSupportsCondition, breakpointItemType, debugService, hoverService) {
    this.menu = menu;
    this.breakpointHasMultipleModes = breakpointHasMultipleModes;
    this.breakpointSupportsCondition = breakpointSupportsCondition;
    this.breakpointItemType = breakpointItemType;
    this.debugService = debugService;
    this.hoverService = hoverService;
  }
  get templateId() {
    return _ExceptionBreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(dom.addStandardDisposableListener(data.checkbox, "change", (e) => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.checkbox);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.condition = dom.append(data.breakpoint, $("span.condition"));
    data.breakpoint.classList.add("exception");
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(exceptionBreakpoint, index, data) {
    data.context = exceptionBreakpoint;
    data.name.textContent = exceptionBreakpoint.label || `${exceptionBreakpoint.filter} exceptions`;
    const exceptionBreakpointtitle = exceptionBreakpoint.verified ? exceptionBreakpoint.description || data.name.textContent : exceptionBreakpoint.message || localize("unverifiedExceptionBreakpoint", "Unverified Exception Breakpoint");
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, exceptionBreakpointtitle));
    data.breakpoint.classList.toggle("disabled", !exceptionBreakpoint.verified);
    data.checkbox.checked = exceptionBreakpoint.enabled;
    data.condition.textContent = exceptionBreakpoint.condition || "";
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.condition, localize("expressionCondition", "Expression condition: {0}", exceptionBreakpoint.condition)));
    if (exceptionBreakpoint.modeLabel) {
      data.badge.textContent = exceptionBreakpoint.modeLabel;
      data.badge.style.display = "block";
    } else {
      data.badge.style.display = "none";
    }
    this.breakpointSupportsCondition.set(exceptionBreakpoint.supportsCondition);
    this.breakpointItemType.set("exceptionBreakpoint");
    this.breakpointHasMultipleModes.set(this.debugService.getModel().getBreakpointModes("exception").length > 1);
    const { primary } = getActionBarActions(this.menu.getActions({ arg: exceptionBreakpoint, shouldForwardArgs: true }), "inline");
    data.actionBar.clear();
    data.actionBar.push(primary, { icon: true, label: false });
    breakpointIdToActionBarDomeNode.set(exceptionBreakpoint.getId(), data.actionBar.domNode);
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
_ExceptionBreakpointsRenderer.ID = "exceptionbreakpoints";
let ExceptionBreakpointsRenderer = _ExceptionBreakpointsRenderer;
let FunctionBreakpointsRenderer = class {
  constructor(menu, breakpointSupportsCondition, breakpointItemType, debugService, hoverService, labelService) {
    this.menu = menu;
    this.breakpointSupportsCondition = breakpointSupportsCondition;
    this.breakpointItemType = breakpointItemType;
    this.debugService = debugService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  get templateId() {
    return FunctionBreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.icon = $(".icon");
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(dom.addStandardDisposableListener(data.checkbox, "change", (e) => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.icon);
    dom.append(data.breakpoint, data.checkbox);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.condition = dom.append(data.breakpoint, $("span.condition"));
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(functionBreakpoint, _index, data) {
    data.context = functionBreakpoint;
    data.name.textContent = functionBreakpoint.name;
    const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), functionBreakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.icon, message ? message : ""));
    data.checkbox.checked = functionBreakpoint.enabled;
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, message ? message : ""));
    if (functionBreakpoint.condition && functionBreakpoint.hitCondition) {
      data.condition.textContent = localize("expressionAndHitCount", "Condition: {0} | Hit Count: {1}", functionBreakpoint.condition, functionBreakpoint.hitCondition);
    } else {
      data.condition.textContent = functionBreakpoint.condition || functionBreakpoint.hitCondition || "";
    }
    if (functionBreakpoint.modeLabel) {
      data.badge.textContent = functionBreakpoint.modeLabel;
      data.badge.style.display = "block";
    } else {
      data.badge.style.display = "none";
    }
    const session = this.debugService.getViewModel().focusedSession;
    data.breakpoint.classList.toggle("disabled", session && !session.capabilities.supportsFunctionBreakpoints || !this.debugService.getModel().areBreakpointsActivated());
    if (session && !session.capabilities.supportsFunctionBreakpoints) {
      data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, localize("functionBreakpointsNotSupported", "Function breakpoints are not supported by this debug type")));
    }
    this.breakpointSupportsCondition.set(!session || !!session.capabilities.supportsConditionalBreakpoints);
    this.breakpointItemType.set("functionBreakpoint");
    const { primary } = getActionBarActions(this.menu.getActions({ arg: functionBreakpoint, shouldForwardArgs: true }), "inline");
    data.actionBar.clear();
    data.actionBar.push(primary, { icon: true, label: false });
    breakpointIdToActionBarDomeNode.set(functionBreakpoint.getId(), data.actionBar.domNode);
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
FunctionBreakpointsRenderer.ID = "functionbreakpoints";
FunctionBreakpointsRenderer = __decorateClass([
  __decorateParam(3, IDebugService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, ILabelService)
], FunctionBreakpointsRenderer);
let DataBreakpointsRenderer = class {
  constructor(menu, breakpointHasMultipleModes, breakpointSupportsCondition, breakpointItemType, breakpointIsDataBytes, debugService, hoverService, labelService) {
    this.menu = menu;
    this.breakpointHasMultipleModes = breakpointHasMultipleModes;
    this.breakpointSupportsCondition = breakpointSupportsCondition;
    this.breakpointItemType = breakpointItemType;
    this.breakpointIsDataBytes = breakpointIsDataBytes;
    this.debugService = debugService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  get templateId() {
    return DataBreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.icon = $(".icon");
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(dom.addStandardDisposableListener(data.checkbox, "change", (e) => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.icon);
    dom.append(data.breakpoint, data.checkbox);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.accessType = dom.append(data.breakpoint, $("span.access-type"));
    data.condition = dom.append(data.breakpoint, $("span.condition"));
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(dataBreakpoint, _index, data) {
    data.context = dataBreakpoint;
    data.name.textContent = dataBreakpoint.description;
    const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), dataBreakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.icon, message ? message : ""));
    data.checkbox.checked = dataBreakpoint.enabled;
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, message ? message : ""));
    if (dataBreakpoint.modeLabel) {
      data.badge.textContent = dataBreakpoint.modeLabel;
      data.badge.style.display = "block";
    } else {
      data.badge.style.display = "none";
    }
    const session = this.debugService.getViewModel().focusedSession;
    data.breakpoint.classList.toggle("disabled", session && !session.capabilities.supportsDataBreakpoints || !this.debugService.getModel().areBreakpointsActivated());
    if (session && !session.capabilities.supportsDataBreakpoints) {
      data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, localize("dataBreakpointsNotSupported", "Data breakpoints are not supported by this debug type")));
    }
    if (dataBreakpoint.accessType) {
      const accessType = dataBreakpoint.accessType === "read" ? localize("read", "Read") : dataBreakpoint.accessType === "write" ? localize("write", "Write") : localize("access", "Access");
      data.accessType.textContent = accessType;
    } else {
      data.accessType.textContent = "";
    }
    if (dataBreakpoint.condition && dataBreakpoint.hitCondition) {
      data.condition.textContent = localize("expressionAndHitCount", "Condition: {0} | Hit Count: {1}", dataBreakpoint.condition, dataBreakpoint.hitCondition);
    } else {
      data.condition.textContent = dataBreakpoint.condition || dataBreakpoint.hitCondition || "";
    }
    this.breakpointSupportsCondition.set(!session || !!session.capabilities.supportsConditionalBreakpoints);
    this.breakpointHasMultipleModes.set(this.debugService.getModel().getBreakpointModes("data").length > 1);
    this.breakpointItemType.set("dataBreakpoint");
    this.breakpointIsDataBytes.set(dataBreakpoint.src.type === DataBreakpointSetType.Address);
    const { primary } = getActionBarActions(this.menu.getActions({ arg: dataBreakpoint, shouldForwardArgs: true }), "inline");
    data.actionBar.clear();
    data.actionBar.push(primary, { icon: true, label: false });
    breakpointIdToActionBarDomeNode.set(dataBreakpoint.getId(), data.actionBar.domNode);
    this.breakpointIsDataBytes.reset();
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
DataBreakpointsRenderer.ID = "databreakpoints";
DataBreakpointsRenderer = __decorateClass([
  __decorateParam(5, IDebugService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, ILabelService)
], DataBreakpointsRenderer);
let InstructionBreakpointsRenderer = class {
  constructor(debugService, hoverService, labelService) {
    this.debugService = debugService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  get templateId() {
    return InstructionBreakpointsRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.elementDisposables = new DisposableStore();
    data.templateDisposables = new DisposableStore();
    data.templateDisposables.add(data.elementDisposables);
    data.breakpoint = dom.append(container, $(".breakpoint"));
    data.icon = $(".icon");
    data.checkbox = createCheckbox(data.templateDisposables);
    data.templateDisposables.add(dom.addStandardDisposableListener(data.checkbox, "change", (e) => {
      this.debugService.enableOrDisableBreakpoints(!data.context.enabled, data.context);
    }));
    dom.append(data.breakpoint, data.icon);
    dom.append(data.breakpoint, data.checkbox);
    data.name = dom.append(data.breakpoint, $("span.name"));
    data.address = dom.append(data.breakpoint, $("span.file-path"));
    data.actionBar = new ActionBar(data.breakpoint);
    data.templateDisposables.add(data.actionBar);
    const badgeContainer = dom.append(data.breakpoint, $(".badge-container"));
    data.badge = dom.append(badgeContainer, $("span.line-number.monaco-count-badge"));
    return data;
  }
  renderElement(breakpoint, index, data) {
    data.context = breakpoint;
    data.breakpoint.classList.toggle("disabled", !this.debugService.getModel().areBreakpointsActivated());
    data.name.textContent = "0x" + breakpoint.address.toString(16);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.name, `Decimal address: breakpoint.address.toString()`));
    data.checkbox.checked = breakpoint.enabled;
    const { message, icon } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), breakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.breakpoint, breakpoint.message || message || ""));
    const debugActive = this.debugService.state === State.Running || this.debugService.state === State.Stopped;
    if (debugActive && !breakpoint.verified) {
      data.breakpoint.classList.add("disabled");
    }
    if (breakpoint.modeLabel) {
      data.badge.textContent = breakpoint.modeLabel;
      data.badge.style.display = "block";
    } else {
      data.badge.style.display = "none";
    }
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
InstructionBreakpointsRenderer.ID = "instructionBreakpoints";
InstructionBreakpointsRenderer = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IHoverService),
  __decorateParam(2, ILabelService)
], InstructionBreakpointsRenderer);
const _FunctionBreakpointInputRenderer = class _FunctionBreakpointInputRenderer {
  constructor(view, debugService, contextViewService, hoverService, labelService) {
    this.view = view;
    this.debugService = debugService;
    this.contextViewService = contextViewService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  get templateId() {
    return _FunctionBreakpointInputRenderer.ID;
  }
  renderTemplate(container) {
    const template = /* @__PURE__ */ Object.create(null);
    const toDispose = new DisposableStore();
    const breakpoint = dom.append(container, $(".breakpoint"));
    template.icon = $(".icon");
    template.checkbox = createCheckbox(toDispose);
    dom.append(breakpoint, template.icon);
    dom.append(breakpoint, template.checkbox);
    this.view.breakpointInputFocused.set(true);
    const inputBoxContainer = dom.append(breakpoint, $(".inputBoxContainer"));
    const inputBox = new InputBox(inputBoxContainer, this.contextViewService, { inputBoxStyles: defaultInputBoxStyles });
    toDispose.add(inputBox);
    const wrapUp = (success) => {
      template.updating = true;
      try {
        this.view.breakpointInputFocused.set(false);
        const id = template.breakpoint.getId();
        if (success) {
          if (template.type === "name") {
            this.debugService.updateFunctionBreakpoint(id, { name: inputBox.value });
          }
          if (template.type === "condition") {
            this.debugService.updateFunctionBreakpoint(id, { condition: inputBox.value });
          }
          if (template.type === "hitCount") {
            this.debugService.updateFunctionBreakpoint(id, { hitCondition: inputBox.value });
          }
        } else {
          if (template.type === "name" && !template.breakpoint.name) {
            this.debugService.removeFunctionBreakpoints(id);
          } else {
            this.view.renderInputBox(void 0);
          }
        }
      } finally {
        template.updating = false;
      }
    };
    toDispose.add(dom.addStandardDisposableListener(inputBox.inputElement, "keydown", (e) => {
      const isEscape = e.equals(KeyCode.Escape);
      const isEnter = e.equals(KeyCode.Enter);
      if (isEscape || isEnter) {
        e.preventDefault();
        e.stopPropagation();
        wrapUp(isEnter);
      }
    }));
    toDispose.add(dom.addDisposableListener(inputBox.inputElement, "blur", () => {
      if (!template.updating) {
        wrapUp(!!inputBox.value);
      }
    }));
    template.inputBox = inputBox;
    template.elementDisposables = new DisposableStore();
    template.templateDisposables = toDispose;
    template.templateDisposables.add(template.elementDisposables);
    return template;
  }
  renderElement(functionBreakpoint, _index, data) {
    data.breakpoint = functionBreakpoint;
    data.type = this.view.inputBoxData?.type || "name";
    const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), functionBreakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.icon, message ? message : ""));
    data.checkbox.checked = functionBreakpoint.enabled;
    data.checkbox.disabled = true;
    data.inputBox.value = functionBreakpoint.name || "";
    let placeholder = localize("functionBreakpointPlaceholder", "Function to break on");
    let ariaLabel = localize("functionBreakPointInputAriaLabel", "Type function breakpoint.");
    if (data.type === "condition") {
      data.inputBox.value = functionBreakpoint.condition || "";
      placeholder = localize("functionBreakpointExpressionPlaceholder", "Break when expression evaluates to true");
      ariaLabel = localize("functionBreakPointExpresionAriaLabel", "Type expression. Function breakpoint will break when expression evaluates to true");
    } else if (data.type === "hitCount") {
      data.inputBox.value = functionBreakpoint.hitCondition || "";
      placeholder = localize("functionBreakpointHitCountPlaceholder", "Break when hit count is met");
      ariaLabel = localize("functionBreakPointHitCountAriaLabel", "Type hit count. Function breakpoint will break when hit count is met.");
    }
    data.inputBox.setAriaLabel(ariaLabel);
    data.inputBox.setPlaceHolder(placeholder);
    setTimeout(() => {
      data.inputBox.focus();
      data.inputBox.select();
    }, 0);
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
_FunctionBreakpointInputRenderer.ID = "functionbreakpointinput";
let FunctionBreakpointInputRenderer = _FunctionBreakpointInputRenderer;
const _DataBreakpointInputRenderer = class _DataBreakpointInputRenderer {
  constructor(view, debugService, contextViewService, hoverService, labelService) {
    this.view = view;
    this.debugService = debugService;
    this.contextViewService = contextViewService;
    this.hoverService = hoverService;
    this.labelService = labelService;
  }
  get templateId() {
    return _DataBreakpointInputRenderer.ID;
  }
  renderTemplate(container) {
    const template = /* @__PURE__ */ Object.create(null);
    const toDispose = new DisposableStore();
    const breakpoint = dom.append(container, $(".breakpoint"));
    template.icon = $(".icon");
    template.checkbox = createCheckbox(toDispose);
    dom.append(breakpoint, template.icon);
    dom.append(breakpoint, template.checkbox);
    this.view.breakpointInputFocused.set(true);
    const inputBoxContainer = dom.append(breakpoint, $(".inputBoxContainer"));
    const inputBox = new InputBox(inputBoxContainer, this.contextViewService, { inputBoxStyles: defaultInputBoxStyles });
    toDispose.add(inputBox);
    const wrapUp = (success) => {
      template.updating = true;
      try {
        this.view.breakpointInputFocused.set(false);
        const id = template.breakpoint.getId();
        if (success) {
          if (template.type === "condition") {
            this.debugService.updateDataBreakpoint(id, { condition: inputBox.value });
          }
          if (template.type === "hitCount") {
            this.debugService.updateDataBreakpoint(id, { hitCondition: inputBox.value });
          }
        } else {
          this.view.renderInputBox(void 0);
        }
      } finally {
        template.updating = false;
      }
    };
    toDispose.add(dom.addStandardDisposableListener(inputBox.inputElement, "keydown", (e) => {
      const isEscape = e.equals(KeyCode.Escape);
      const isEnter = e.equals(KeyCode.Enter);
      if (isEscape || isEnter) {
        e.preventDefault();
        e.stopPropagation();
        wrapUp(isEnter);
      }
    }));
    toDispose.add(dom.addDisposableListener(inputBox.inputElement, "blur", () => {
      if (!template.updating) {
        wrapUp(!!inputBox.value);
      }
    }));
    template.inputBox = inputBox;
    template.elementDisposables = new DisposableStore();
    template.templateDisposables = toDispose;
    template.templateDisposables.add(template.elementDisposables);
    return template;
  }
  renderElement(dataBreakpoint, _index, data) {
    data.breakpoint = dataBreakpoint;
    data.type = this.view.inputBoxData?.type || "condition";
    const { icon, message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), dataBreakpoint, this.labelService, this.debugService.getModel());
    data.icon.className = ThemeIcon.asClassName(icon);
    data.elementDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.icon, message ?? ""));
    data.checkbox.checked = dataBreakpoint.enabled;
    data.checkbox.disabled = true;
    data.inputBox.value = "";
    let placeholder = "";
    let ariaLabel = "";
    if (data.type === "condition") {
      data.inputBox.value = dataBreakpoint.condition || "";
      placeholder = localize("dataBreakpointExpressionPlaceholder", "Break when expression evaluates to true");
      ariaLabel = localize("dataBreakPointExpresionAriaLabel", "Type expression. Data breakpoint will break when expression evaluates to true");
    } else if (data.type === "hitCount") {
      data.inputBox.value = dataBreakpoint.hitCondition || "";
      placeholder = localize("dataBreakpointHitCountPlaceholder", "Break when hit count is met");
      ariaLabel = localize("dataBreakPointHitCountAriaLabel", "Type hit count. Data breakpoint will break when hit count is met.");
    }
    data.inputBox.setAriaLabel(ariaLabel);
    data.inputBox.setPlaceHolder(placeholder);
    setTimeout(() => {
      data.inputBox.focus();
      data.inputBox.select();
    }, 0);
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
_DataBreakpointInputRenderer.ID = "databreakpointinput";
let DataBreakpointInputRenderer = _DataBreakpointInputRenderer;
const _ExceptionBreakpointInputRenderer = class _ExceptionBreakpointInputRenderer {
  constructor(view, debugService, contextViewService) {
    this.view = view;
    this.debugService = debugService;
    this.contextViewService = contextViewService;
  }
  get templateId() {
    return _ExceptionBreakpointInputRenderer.ID;
  }
  renderTemplate(container) {
    const toDispose = new DisposableStore();
    const breakpoint = dom.append(container, $(".breakpoint"));
    breakpoint.classList.add("exception");
    const checkbox = createCheckbox(toDispose);
    dom.append(breakpoint, checkbox);
    this.view.breakpointInputFocused.set(true);
    const inputBoxContainer = dom.append(breakpoint, $(".inputBoxContainer"));
    const inputBox = new InputBox(inputBoxContainer, this.contextViewService, {
      ariaLabel: localize("exceptionBreakpointAriaLabel", "Type exception breakpoint condition"),
      inputBoxStyles: defaultInputBoxStyles
    });
    toDispose.add(inputBox);
    const wrapUp = (success) => {
      if (!templateData.currentBreakpoint) {
        return;
      }
      this.view.breakpointInputFocused.set(false);
      let newCondition = templateData.currentBreakpoint.condition;
      if (success) {
        newCondition = inputBox.value !== "" ? inputBox.value : void 0;
      }
      this.debugService.setExceptionBreakpointCondition(templateData.currentBreakpoint, newCondition);
    };
    toDispose.add(dom.addStandardDisposableListener(inputBox.inputElement, "keydown", (e) => {
      const isEscape = e.equals(KeyCode.Escape);
      const isEnter = e.equals(KeyCode.Enter);
      if (isEscape || isEnter) {
        e.preventDefault();
        e.stopPropagation();
        wrapUp(isEnter);
      }
    }));
    toDispose.add(dom.addDisposableListener(inputBox.inputElement, "blur", () => {
      setTimeout(() => {
        wrapUp(true);
      });
    }));
    const elementDisposables = new DisposableStore();
    toDispose.add(elementDisposables);
    const templateData = {
      inputBox,
      checkbox,
      templateDisposables: toDispose,
      elementDisposables: new DisposableStore()
    };
    return templateData;
  }
  renderElement(exceptionBreakpoint, _index, data) {
    const placeHolder = exceptionBreakpoint.conditionDescription || localize("exceptionBreakpointPlaceholder", "Break when expression evaluates to true");
    data.inputBox.setPlaceHolder(placeHolder);
    data.currentBreakpoint = exceptionBreakpoint;
    data.checkbox.checked = exceptionBreakpoint.enabled;
    data.checkbox.disabled = true;
    data.inputBox.value = exceptionBreakpoint.condition || "";
    setTimeout(() => {
      data.inputBox.focus();
      data.inputBox.select();
    }, 0);
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
_ExceptionBreakpointInputRenderer.ID = "exceptionbreakpointinput";
let ExceptionBreakpointInputRenderer = _ExceptionBreakpointInputRenderer;
class BreakpointsAccessibilityProvider {
  constructor(debugService, labelService) {
    this.debugService = debugService;
    this.labelService = labelService;
  }
  getWidgetAriaLabel() {
    return localize("breakpoints", "Breakpoints");
  }
  getRole() {
    return "checkbox";
  }
  isChecked(breakpoint) {
    return breakpoint.enabled;
  }
  getAriaLabel(element) {
    if (element instanceof ExceptionBreakpoint) {
      return element.toString();
    }
    const { message } = getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), element, this.labelService, this.debugService.getModel());
    const toString = element.toString();
    return message ? `${toString}, ${message}` : toString;
  }
}
function openBreakpointSource(breakpoint, sideBySide, preserveFocus, pinned, debugService, editorService) {
  if (breakpoint.uri.scheme === DEBUG_SCHEME && debugService.state === State.Inactive) {
    return Promise.resolve(void 0);
  }
  const selection = breakpoint.endLineNumber ? {
    startLineNumber: breakpoint.lineNumber,
    endLineNumber: breakpoint.endLineNumber,
    startColumn: breakpoint.column || 1,
    endColumn: breakpoint.endColumn || Constants.MAX_SAFE_SMALL_INTEGER
  } : {
    startLineNumber: breakpoint.lineNumber,
    startColumn: breakpoint.column || 1,
    endLineNumber: breakpoint.lineNumber,
    endColumn: breakpoint.column || Constants.MAX_SAFE_SMALL_INTEGER
  };
  return editorService.openEditor({
    resource: breakpoint.uri,
    options: {
      preserveFocus,
      selection,
      revealIfOpened: true,
      selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport,
      pinned
    }
  }, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
}
function getBreakpointMessageAndIcon(state, breakpointsActivated, breakpoint, labelService, debugModel) {
  const debugActive = state === State.Running || state === State.Stopped;
  const breakpointIcon = breakpoint instanceof DataBreakpoint ? icons.dataBreakpoint : breakpoint instanceof FunctionBreakpoint ? icons.functionBreakpoint : breakpoint.logMessage ? icons.logBreakpoint : icons.breakpoint;
  if (!breakpoint.enabled || !breakpointsActivated) {
    return {
      icon: breakpointIcon.disabled,
      message: breakpoint.logMessage ? localize("disabledLogpoint", "Disabled Logpoint") : localize("disabledBreakpoint", "Disabled Breakpoint")
    };
  }
  const appendMessage = (text) => {
    return "message" in breakpoint && breakpoint.message ? text.concat(", " + breakpoint.message) : text;
  };
  if (debugActive && breakpoint instanceof Breakpoint && breakpoint.pending) {
    return {
      icon: icons.breakpoint.pending
    };
  }
  if (debugActive && !breakpoint.verified) {
    return {
      icon: breakpointIcon.unverified,
      message: "message" in breakpoint && breakpoint.message ? breakpoint.message : breakpoint.logMessage ? localize("unverifiedLogpoint", "Unverified Logpoint") : localize("unverifiedBreakpoint", "Unverified Breakpoint"),
      showAdapterUnverifiedMessage: true
    };
  }
  if (breakpoint instanceof DataBreakpoint) {
    if (!breakpoint.supported) {
      return {
        icon: breakpointIcon.unverified,
        message: localize("dataBreakpointUnsupported", "Data breakpoints not supported by this debug type")
      };
    }
    return {
      icon: breakpointIcon.regular,
      message: breakpoint.message || localize("dataBreakpoint", "Data Breakpoint")
    };
  }
  if (breakpoint instanceof FunctionBreakpoint) {
    if (!breakpoint.supported) {
      return {
        icon: breakpointIcon.unverified,
        message: localize("functionBreakpointUnsupported", "Function breakpoints not supported by this debug type")
      };
    }
    const messages = [];
    messages.push(breakpoint.message || localize("functionBreakpoint", "Function Breakpoint"));
    if (breakpoint.condition) {
      messages.push(localize("expression", "Condition: {0}", breakpoint.condition));
    }
    if (breakpoint.hitCondition) {
      messages.push(localize("hitCount", "Hit Count: {0}", breakpoint.hitCondition));
    }
    return {
      icon: breakpointIcon.regular,
      message: appendMessage(messages.join("\n"))
    };
  }
  if (breakpoint instanceof InstructionBreakpoint) {
    if (!breakpoint.supported) {
      return {
        icon: breakpointIcon.unverified,
        message: localize("instructionBreakpointUnsupported", "Instruction breakpoints not supported by this debug type")
      };
    }
    const messages = [];
    if (breakpoint.message) {
      messages.push(breakpoint.message);
    } else if (breakpoint.instructionReference) {
      messages.push(localize("instructionBreakpointAtAddress", "Instruction breakpoint at address {0}", breakpoint.instructionReference));
    } else {
      messages.push(localize("instructionBreakpoint", "Instruction breakpoint"));
    }
    if (breakpoint.hitCondition) {
      messages.push(localize("hitCount", "Hit Count: {0}", breakpoint.hitCondition));
    }
    return {
      icon: breakpointIcon.regular,
      message: appendMessage(messages.join("\n"))
    };
  }
  let triggeringBreakpoint;
  if (breakpoint instanceof Breakpoint && breakpoint.triggeredBy) {
    triggeringBreakpoint = debugModel.getBreakpoints().find((bp) => bp.getId() === breakpoint.triggeredBy);
  }
  if (breakpoint.logMessage || breakpoint.condition || breakpoint.hitCondition || triggeringBreakpoint) {
    const messages = [];
    let icon = breakpoint.logMessage ? icons.logBreakpoint.regular : icons.conditionalBreakpoint.regular;
    if (!breakpoint.supported) {
      icon = icons.debugBreakpointUnsupported;
      messages.push(localize("breakpointUnsupported", "Breakpoints of this type are not supported by the debugger"));
    }
    if (breakpoint.logMessage) {
      messages.push(localize("logMessage", "Log Message: {0}", breakpoint.logMessage));
    }
    if (breakpoint.condition) {
      messages.push(localize("expression", "Condition: {0}", breakpoint.condition));
    }
    if (breakpoint.hitCondition) {
      messages.push(localize("hitCount", "Hit Count: {0}", breakpoint.hitCondition));
    }
    if (triggeringBreakpoint) {
      messages.push(localize("triggeredBy", "Hit after breakpoint: {0}", `${labelService.getUriLabel(triggeringBreakpoint.uri, { relative: true })}: ${triggeringBreakpoint.lineNumber}`));
    }
    return {
      icon,
      message: appendMessage(messages.join("\n"))
    };
  }
  const message = "message" in breakpoint && breakpoint.message ? breakpoint.message : breakpoint instanceof Breakpoint && labelService ? labelService.getUriLabel(breakpoint.uri) : localize("breakpoint", "Breakpoint");
  return {
    icon: breakpointIcon.regular,
    message
  };
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.addFunctionBreakpointAction",
      title: {
        ...localize2("addFunctionBreakpoint", "Add Function Breakpoint"),
        mnemonicTitle: localize({ key: "miFunctionBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Function Breakpoint...")
      },
      f1: true,
      icon: icons.watchExpressionsAddFuncBreakpoint,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 10,
        when: ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID)
      }, {
        id: MenuId.MenubarNewBreakpointMenu,
        group: "1_breakpoints",
        order: 3,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }]
    });
  }
  async run(accessor) {
    const debugService = accessor.get(IDebugService);
    const viewService = accessor.get(IViewsService);
    await viewService.openView(BREAKPOINTS_VIEW_ID);
    debugService.addFunctionBreakpoint();
  }
});
class MemoryBreakpointAction extends Action2 {
  async run(accessor, existingBreakpoint) {
    const debugService = accessor.get(IDebugService);
    const session = debugService.getViewModel().focusedSession;
    if (!session) {
      return;
    }
    let defaultValue = void 0;
    if (existingBreakpoint && existingBreakpoint.src.type === DataBreakpointSetType.Address) {
      defaultValue = `${existingBreakpoint.src.address} + ${existingBreakpoint.src.bytes}`;
    }
    const quickInput = accessor.get(IQuickInputService);
    const notifications = accessor.get(INotificationService);
    const range = await this.getRange(quickInput, defaultValue);
    if (!range) {
      return;
    }
    let info;
    try {
      info = await session.dataBytesBreakpointInfo(range.address, range.bytes);
    } catch (e) {
      notifications.error(localize("dataBreakpointError", "Failed to set data breakpoint at {0}: {1}", range.address, e.message));
    }
    if (!info?.dataId) {
      return;
    }
    let accessType = "write";
    if (info.accessTypes && info.accessTypes?.length > 1) {
      const accessTypes = info.accessTypes.map((type) => ({ label: type }));
      const selectedAccessType = await quickInput.pick(accessTypes, { placeHolder: localize("dataBreakpointAccessType", "Select the access type to monitor") });
      if (!selectedAccessType) {
        return;
      }
      accessType = selectedAccessType.label;
    }
    const src = { type: DataBreakpointSetType.Address, ...range };
    if (existingBreakpoint) {
      await debugService.removeDataBreakpoints(existingBreakpoint.getId());
    }
    await debugService.addDataBreakpoint({
      description: info.description,
      src,
      canPersist: true,
      accessTypes: info.accessTypes,
      accessType,
      initialSessionData: { session, dataId: info.dataId }
    });
  }
  getRange(quickInput, defaultValue) {
    return new Promise((resolve) => {
      const disposables = new DisposableStore();
      const input = disposables.add(quickInput.createInputBox());
      input.prompt = localize("dataBreakpointMemoryRangePrompt", "Enter a memory range in which to break");
      input.placeholder = localize("dataBreakpointMemoryRangePlaceholder", "Absolute range (0x1234 - 0x1300) or range of bytes after an address (0x1234 + 0xff)");
      if (defaultValue) {
        input.value = defaultValue;
        input.valueSelection = [0, defaultValue.length];
      }
      disposables.add(input.onDidChangeValue((e) => {
        const err = this.parseAddress(e, false);
        input.validationMessage = err?.error;
      }));
      disposables.add(input.onDidAccept(() => {
        const r = this.parseAddress(input.value, true);
        if ("error" in r) {
          input.validationMessage = r.error;
        } else {
          resolve(r);
        }
        input.dispose();
      }));
      disposables.add(input.onDidHide(() => {
        resolve(void 0);
        disposables.dispose();
      }));
      input.ignoreFocusOut = true;
      input.show();
    });
  }
  parseAddress(range, isFinal) {
    const parts = /^(\S+)\s*(?:([+-])\s*(\S+))?/.exec(range);
    if (!parts) {
      return { error: localize("dataBreakpointAddrFormat", 'Address should be a range of numbers the form "[Start] - [End]" or "[Start] + [Bytes]"') };
    }
    const isNum = (e) => isFinal ? /^0x[0-9a-f]*|[0-9]*$/i.test(e) : /^0x[0-9a-f]+|[0-9]+$/i.test(e);
    const [, startStr, sign = "+", endStr = "1"] = parts;
    for (const n of [startStr, endStr]) {
      if (!isNum(n)) {
        return { error: localize("dataBreakpointAddrStartEnd", 'Number must be a decimal integer or hex value starting with "0x", got {0}', n) };
      }
    }
    if (!isFinal) {
      return;
    }
    const start = BigInt(startStr);
    const end = BigInt(endStr);
    const address = `0x${start.toString(16)}`;
    if (sign === "-") {
      return { address, bytes: Number(start - end) };
    }
    return { address, bytes: Number(end) };
  }
}
registerAction2(class extends MemoryBreakpointAction {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.addDataBreakpointOnAddress",
      title: {
        ...localize2("addDataBreakpointOnAddress", "Add Data Breakpoint at Address"),
        mnemonicTitle: localize({ key: "miDataBreakpoint", comment: ["&& denotes a mnemonic"] }, "&&Data Breakpoint...")
      },
      f1: true,
      icon: icons.watchExpressionsAddDataBreakpoint,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 11,
        when: ContextKeyExpr.and(CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED, ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID))
      }, {
        id: MenuId.MenubarNewBreakpointMenu,
        group: "1_breakpoints",
        order: 4,
        when: CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED
      }]
    });
  }
});
registerAction2(class extends MemoryBreakpointAction {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.editDataBreakpointOnAddress",
      title: localize2("editDataBreakpointOnAddress", "Edit Address..."),
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        when: ContextKeyExpr.and(CONTEXT_SET_DATA_BREAKPOINT_BYTES_SUPPORTED, CONTEXT_BREAKPOINT_ITEM_IS_DATA_BYTES),
        group: "navigation",
        order: 15
      }]
    });
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.toggleBreakpointsActivatedAction",
      title: localize2("activateBreakpoints", "Toggle Activate Breakpoints"),
      f1: true,
      icon: icons.breakpointsActivate,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 20,
        when: ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID)
      }
    });
  }
  run(accessor) {
    const debugService = accessor.get(IDebugService);
    debugService.setBreakpointsActivated(!debugService.getModel().areBreakpointsActivated());
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.removeBreakpoint",
      title: localize("removeBreakpoint", "Remove Breakpoint"),
      icon: Codicon.removeClose,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "3_modification",
        order: 10,
        when: CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint")
      }, {
        id: MenuId.DebugBreakpointsContext,
        group: "inline",
        order: 20,
        when: CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint")
      }]
    });
  }
  async run(accessor, breakpoint) {
    const debugService = accessor.get(IDebugService);
    if (breakpoint instanceof Breakpoint) {
      await debugService.removeBreakpoints(breakpoint.getId());
    } else if (breakpoint instanceof FunctionBreakpoint) {
      await debugService.removeFunctionBreakpoints(breakpoint.getId());
    } else if (breakpoint instanceof DataBreakpoint) {
      await debugService.removeDataBreakpoints(breakpoint.getId());
    } else if (breakpoint instanceof InstructionBreakpoint) {
      await debugService.removeInstructionBreakpoints(breakpoint.instructionReference, breakpoint.offset);
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.removeAllBreakpoints",
      title: {
        ...localize2("removeAllBreakpoints", "Remove All Breakpoints"),
        mnemonicTitle: localize({ key: "miRemoveAllBreakpoints", comment: ["&& denotes a mnemonic"] }, "Remove &&All Breakpoints")
      },
      f1: true,
      icon: icons.breakpointsRemoveAll,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 30,
        when: ContextKeyExpr.equals("view", BREAKPOINTS_VIEW_ID)
      }, {
        id: MenuId.DebugBreakpointsContext,
        group: "3_modification",
        order: 20,
        when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint"))
      }, {
        id: MenuId.MenubarDebugMenu,
        group: "5_breakpoints",
        order: 3,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }]
    });
  }
  run(accessor) {
    const debugService = accessor.get(IDebugService);
    debugService.removeBreakpoints();
    debugService.removeFunctionBreakpoints();
    debugService.removeDataBreakpoints();
    debugService.removeInstructionBreakpoints();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.enableAllBreakpoints",
      title: {
        ...localize2("enableAllBreakpoints", "Enable All Breakpoints"),
        mnemonicTitle: localize({ key: "miEnableAllBreakpoints", comment: ["&& denotes a mnemonic"] }, "&&Enable All Breakpoints")
      },
      f1: true,
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "z_commands",
        order: 10,
        when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint"))
      }, {
        id: MenuId.MenubarDebugMenu,
        group: "5_breakpoints",
        order: 1,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }]
    });
  }
  async run(accessor) {
    const debugService = accessor.get(IDebugService);
    await debugService.enableOrDisableBreakpoints(true);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.disableAllBreakpoints",
      title: {
        ...localize2("disableAllBreakpoints", "Disable All Breakpoints"),
        mnemonicTitle: localize({ key: "miDisableAllBreakpoints", comment: ["&& denotes a mnemonic"] }, "Disable A&&ll Breakpoints")
      },
      f1: true,
      precondition: CONTEXT_DEBUGGERS_AVAILABLE,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "z_commands",
        order: 20,
        when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint"))
      }, {
        id: MenuId.MenubarDebugMenu,
        group: "5_breakpoints",
        order: 2,
        when: CONTEXT_DEBUGGERS_AVAILABLE
      }]
    });
  }
  async run(accessor) {
    const debugService = accessor.get(IDebugService);
    await debugService.enableOrDisableBreakpoints(false);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.debug.viewlet.action.reapplyBreakpointsAction",
      title: localize2("reapplyAllBreakpoints", "Reapply All Breakpoints"),
      f1: true,
      precondition: CONTEXT_IN_DEBUG_MODE,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "z_commands",
        order: 30,
        when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_EXIST, CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("exceptionBreakpoint"))
      }]
    });
  }
  async run(accessor) {
    const debugService = accessor.get(IDebugService);
    await debugService.setBreakpointsActivated(true);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.editBreakpoint",
      viewId: BREAKPOINTS_VIEW_ID,
      title: localize("editCondition", "Edit Condition..."),
      icon: Codicon.edit,
      precondition: CONTEXT_BREAKPOINT_SUPPORTS_CONDITION,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        when: CONTEXT_BREAKPOINT_ITEM_TYPE.notEqualsTo("functionBreakpoint"),
        group: "navigation",
        order: 10
      }, {
        id: MenuId.DebugBreakpointsContext,
        group: "inline",
        order: 10
      }]
    });
  }
  async runInView(accessor, view, breakpoint) {
    const debugService = accessor.get(IDebugService);
    const editorService = accessor.get(IEditorService);
    if (breakpoint instanceof Breakpoint) {
      const editor = await openBreakpointSource(breakpoint, false, false, true, debugService, editorService);
      if (editor) {
        const codeEditor = editor.getControl();
        if (isCodeEditor(codeEditor)) {
          codeEditor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID)?.showBreakpointWidget(breakpoint.lineNumber, breakpoint.column);
        }
      }
    } else if (breakpoint instanceof FunctionBreakpoint) {
      const contextMenuService = accessor.get(IContextMenuService);
      const actions = [
        new Action("breakpoint.editCondition", localize("editCondition", "Edit Condition..."), void 0, true, async () => view.renderInputBox({ breakpoint, type: "condition" })),
        new Action("breakpoint.editCondition", localize("editHitCount", "Edit Hit Count..."), void 0, true, async () => view.renderInputBox({ breakpoint, type: "hitCount" }))
      ];
      const domNode = breakpointIdToActionBarDomeNode.get(breakpoint.getId());
      if (domNode) {
        contextMenuService.showContextMenu({
          getActions: () => actions,
          getAnchor: () => domNode,
          onHide: () => dispose(actions)
        });
      }
    } else {
      view.renderInputBox({ breakpoint, type: "condition" });
    }
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.editFunctionBreakpoint",
      viewId: BREAKPOINTS_VIEW_ID,
      title: localize("editBreakpoint", "Edit Function Condition..."),
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "navigation",
        order: 10,
        when: CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("functionBreakpoint")
      }]
    });
  }
  runInView(_accessor, view, breakpoint) {
    view.renderInputBox({ breakpoint, type: "name" });
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.editFunctionBreakpointHitCount",
      viewId: BREAKPOINTS_VIEW_ID,
      title: localize("editHitCount", "Edit Hit Count..."),
      precondition: CONTEXT_BREAKPOINT_SUPPORTS_CONDITION,
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "navigation",
        order: 20,
        when: ContextKeyExpr.or(CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("functionBreakpoint"), CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("dataBreakpoint"))
      }]
    });
  }
  runInView(_accessor, view, breakpoint) {
    view.renderInputBox({ breakpoint, type: "hitCount" });
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "debug.editBreakpointMode",
      viewId: BREAKPOINTS_VIEW_ID,
      title: localize("editMode", "Edit Mode..."),
      menu: [{
        id: MenuId.DebugBreakpointsContext,
        group: "navigation",
        order: 20,
        when: ContextKeyExpr.and(
          CONTEXT_BREAKPOINT_HAS_MODES,
          ContextKeyExpr.or(CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("breakpoint"), CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("exceptionBreakpoint"), CONTEXT_BREAKPOINT_ITEM_TYPE.isEqualTo("instructionBreakpoint"))
        )
      }]
    });
  }
  async runInView(accessor, view, breakpoint) {
    const debugService = accessor.get(IDebugService);
    const kind = getModeKindForBreakpoint(breakpoint);
    const modes = debugService.getModel().getBreakpointModes(kind);
    const picked = await accessor.get(IQuickInputService).pick(
      modes.map((mode) => ({ label: mode.label, description: mode.description, mode: mode.mode })),
      { placeHolder: localize("selectBreakpointMode", "Select Breakpoint Mode") }
    );
    if (!picked) {
      return;
    }
    if (kind === "source") {
      const data = /* @__PURE__ */ new Map();
      data.set(breakpoint.getId(), { mode: picked.mode, modeLabel: picked.label });
      debugService.updateBreakpoints(breakpoint.originalUri, data, false);
    } else if (breakpoint instanceof InstructionBreakpoint) {
      debugService.removeInstructionBreakpoints(breakpoint.instructionReference, breakpoint.offset);
      debugService.addInstructionBreakpoint({ ...breakpoint.toJSON(), mode: picked.mode, modeLabel: picked.label });
    } else if (breakpoint instanceof ExceptionBreakpoint) {
      breakpoint.mode = picked.mode;
      breakpoint.modeLabel = picked.label;
      debugService.setExceptionBreakpointCondition(breakpoint, breakpoint.condition);
    }
  }
});
export {
  BreakpointsView,
  getBreakpointMessageAndIcon,
  getExpandedBodySize,
  openBreakpointSource
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2JyZWFrcG9pbnRzVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgR2VzdHVyZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci90b3VjaC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBBcmlhUm9sZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSWNvbkxhYmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWwuanMnO1xuaW1wb3J0IHsgSW5wdXRCb3ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3guanMnO1xuaW1wb3J0IHsgSUxpc3RDb250ZXh0TWVudUV2ZW50LCBJTGlzdFJlbmRlcmVyLCBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IE9yaWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NwbGl0dmlldy9zcGxpdHZpZXcuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgcmVzb3VyY2VzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgQ29uc3RhbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdWludC5qcyc7XG5pbXBvcnQgeyBpc0NvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGdldEFjdGlvbkJhckFjdGlvbnMsIGdldENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJTWVudSwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSwgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IGRlZmF1bHRJbnB1dEJveFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBWaWV3QWN0aW9uLCBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVZpZXdsZXRWaWV3T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld3NWaWV3bGV0LmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IEFDVElWRV9HUk9VUCwgSUVkaXRvclNlcnZpY2UsIFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQlJFQUtQT0lOVFNfVklFV19JRCwgQlJFQUtQT0lOVF9FRElUT1JfQ09OVFJJQlVUSU9OX0lELCBDT05URVhUX0JSRUFLUE9JTlRTX0VYSVNULCBDT05URVhUX0JSRUFLUE9JTlRTX0ZPQ1VTRUQsIENPTlRFWFRfQlJFQUtQT0lOVF9IQVNfTU9ERVMsIENPTlRFWFRfQlJFQUtQT0lOVF9JTlBVVF9GT0NVU0VELCBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9JU19EQVRBX0JZVEVTLCBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLCBDT05URVhUX0JSRUFLUE9JTlRfU1VQUE9SVFNfQ09ORElUSU9OLCBDT05URVhUX0RFQlVHR0VSU19BVkFJTEFCTEUsIENPTlRFWFRfSU5fREVCVUdfTU9ERSwgQ09OVEVYVF9TRVRfREFUQV9CUkVBS1BPSU5UX0JZVEVTX1NVUFBPUlRFRCwgREVCVUdfU0NIRU1FLCBEYXRhQnJlYWtwb2ludFNldFR5cGUsIERhdGFCcmVha3BvaW50U291cmNlLCBEZWJ1Z2dlclN0cmluZywgSUJhc2VCcmVha3BvaW50LCBJQnJlYWtwb2ludCwgSUJyZWFrcG9pbnRFZGl0b3JDb250cmlidXRpb24sIElCcmVha3BvaW50VXBkYXRlRGF0YSwgSURhdGFCcmVha3BvaW50LCBJRGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2UsIElEZWJ1Z01vZGVsLCBJRGVidWdTZXJ2aWNlLCBJRW5hYmxlbWVudCwgSUV4Y2VwdGlvbkJyZWFrcG9pbnQsIElGdW5jdGlvbkJyZWFrcG9pbnQsIElJbnN0cnVjdGlvbkJyZWFrcG9pbnQsIFN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IEJyZWFrcG9pbnQsIERhdGFCcmVha3BvaW50LCBFeGNlcHRpb25CcmVha3BvaW50LCBGdW5jdGlvbkJyZWFrcG9pbnQsIEluc3RydWN0aW9uQnJlYWtwb2ludCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z01vZGVsLmpzJztcbmltcG9ydCB7IERpc2Fzc2VtYmx5Vmlld0lucHV0IH0gZnJvbSAnLi4vY29tbW9uL2Rpc2Fzc2VtYmx5Vmlld0lucHV0LmpzJztcbmltcG9ydCAqIGFzIGljb25zIGZyb20gJy4vZGVidWdJY29ucy5qcyc7XG5pbXBvcnQgeyBEaXNhc3NlbWJseVZpZXcgfSBmcm9tICcuL2Rpc2Fzc2VtYmx5Vmlldy5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuZnVuY3Rpb24gY3JlYXRlQ2hlY2tib3goZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IEhUTUxJbnB1dEVsZW1lbnQge1xuXHRjb25zdCBjaGVja2JveCA9IDxIVE1MSW5wdXRFbGVtZW50PiQoJ2lucHV0Jyk7XG5cdGNoZWNrYm94LnR5cGUgPSAnY2hlY2tib3gnO1xuXHRjaGVja2JveC50YWJJbmRleCA9IC0xO1xuXHRkaXNwb3NhYmxlcy5hZGQoR2VzdHVyZS5pZ25vcmVUYXJnZXQoY2hlY2tib3gpKTtcblxuXHRyZXR1cm4gY2hlY2tib3g7XG59XG5cbmNvbnN0IE1BWF9WSVNJQkxFX0JSRUFLUE9JTlRTID0gOTtcbmV4cG9ydCBmdW5jdGlvbiBnZXRFeHBhbmRlZEJvZHlTaXplKG1vZGVsOiBJRGVidWdNb2RlbCwgc2Vzc2lvbklkOiBzdHJpbmcgfCB1bmRlZmluZWQsIGNvdW50TGltaXQ6IG51bWJlcik6IG51bWJlciB7XG5cdGNvbnN0IGxlbmd0aCA9IG1vZGVsLmdldEJyZWFrcG9pbnRzKCkubGVuZ3RoICsgbW9kZWwuZ2V0RXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKHNlc3Npb25JZCkubGVuZ3RoICsgbW9kZWwuZ2V0RnVuY3Rpb25CcmVha3BvaW50cygpLmxlbmd0aCArIG1vZGVsLmdldERhdGFCcmVha3BvaW50cygpLmxlbmd0aCArIG1vZGVsLmdldEluc3RydWN0aW9uQnJlYWtwb2ludHMoKS5sZW5ndGg7XG5cdHJldHVybiBNYXRoLm1pbihjb3VudExpbWl0LCBsZW5ndGgpICogMjI7XG59XG50eXBlIEJyZWFrcG9pbnRJdGVtID0gSUJyZWFrcG9pbnQgfCBJRnVuY3Rpb25CcmVha3BvaW50IHwgSURhdGFCcmVha3BvaW50IHwgSUV4Y2VwdGlvbkJyZWFrcG9pbnQgfCBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50O1xuXG5pbnRlcmZhY2UgSW5wdXRCb3hEYXRhIHtcblx0YnJlYWtwb2ludDogSUZ1bmN0aW9uQnJlYWtwb2ludCB8IElFeGNlcHRpb25CcmVha3BvaW50IHwgSURhdGFCcmVha3BvaW50O1xuXHR0eXBlOiAnY29uZGl0aW9uJyB8ICdoaXRDb3VudCcgfCAnbmFtZSc7XG59XG5cbmZ1bmN0aW9uIGdldE1vZGVLaW5kRm9yQnJlYWtwb2ludChicmVha3BvaW50OiBJQnJlYWtwb2ludCkge1xuXHRjb25zdCBraW5kID0gYnJlYWtwb2ludCBpbnN0YW5jZW9mIEJyZWFrcG9pbnQgPyAnc291cmNlJyA6IGJyZWFrcG9pbnQgaW5zdGFuY2VvZiBJbnN0cnVjdGlvbkJyZWFrcG9pbnQgPyAnaW5zdHJ1Y3Rpb24nIDogJ2V4Y2VwdGlvbic7XG5cdHJldHVybiBraW5kO1xufVxuXG5leHBvcnQgY2xhc3MgQnJlYWtwb2ludHNWaWV3IGV4dGVuZHMgVmlld1BhbmUge1xuXG5cdHByaXZhdGUgbGlzdCE6IFdvcmtiZW5jaExpc3Q8QnJlYWtwb2ludEl0ZW0+O1xuXHRwcml2YXRlIG5lZWRzUmVmcmVzaCA9IGZhbHNlO1xuXHRwcml2YXRlIG5lZWRzU3RhdGVDaGFuZ2UgPSBmYWxzZTtcblx0cHJpdmF0ZSBpZ25vcmVMYXlvdXQgPSBmYWxzZTtcblx0cHJpdmF0ZSBtZW51OiBJTWVudTtcblx0cHJpdmF0ZSBicmVha3BvaW50SXRlbVR5cGU6IElDb250ZXh0S2V5PHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgYnJlYWtwb2ludElzRGF0YUJ5dGVzOiBJQ29udGV4dEtleTxib29sZWFuIHwgdW5kZWZpbmVkPjtcblx0cHJpdmF0ZSBicmVha3BvaW50SGFzTXVsdGlwbGVNb2RlczogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgYnJlYWtwb2ludFN1cHBvcnRzQ29uZGl0aW9uOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfaW5wdXRCb3hEYXRhOiBJbnB1dEJveERhdGEgfCB1bmRlZmluZWQ7XG5cdGJyZWFrcG9pbnRJbnB1dEZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGF1dG9Gb2N1c2VkSW5kZXggPSAtMTtcblxuXHRwcml2YXRlIGhpbnRDb250YWluZXI6IEljb25MYWJlbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBoaW50RGVsYXllcjogUnVuT25jZVNjaGVkdWxlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJVmlld2xldFZpZXdPcHRpb25zLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cblx0XHR0aGlzLm1lbnUgPSBtZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5EZWJ1Z0JyZWFrcG9pbnRzQ29udGV4dCwgY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubWVudSk7XG5cdFx0dGhpcy5icmVha3BvaW50SXRlbVR5cGUgPSBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5icmVha3BvaW50SXNEYXRhQnl0ZXMgPSBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9JU19EQVRBX0JZVEVTLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5icmVha3BvaW50SGFzTXVsdGlwbGVNb2RlcyA9IENPTlRFWFRfQlJFQUtQT0lOVF9IQVNfTU9ERVMuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmJyZWFrcG9pbnRTdXBwb3J0c0NvbmRpdGlvbiA9IENPTlRFWFRfQlJFQUtQT0lOVF9TVVBQT1JUU19DT05ESVRJT04uYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmJyZWFrcG9pbnRJbnB1dEZvY3VzZWQgPSBDT05URVhUX0JSRUFLUE9JTlRfSU5QVVRfRk9DVVNFRC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkub25EaWRDaGFuZ2VCcmVha3BvaW50cygoKSA9PiB0aGlzLm9uQnJlYWtwb2ludHNDaGFuZ2UoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLm9uRGlkRm9jdXNTZXNzaW9uKCgpID0+IHRoaXMub25CcmVha3BvaW50c0NoYW5nZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2Uub25EaWRDaGFuZ2VTdGF0ZSgoKSA9PiB0aGlzLm9uU3RhdGVDaGFuZ2UoKSkpO1xuXHRcdHRoaXMuaGludERlbGF5ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLnVwZGF0ZUJyZWFrcG9pbnRzSGludCh0cnVlKSwgNDAwMCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckJvZHkoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlckJvZHkoY29udGFpbmVyKTtcblxuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkZWJ1Zy1wYW5lJyk7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2RlYnVnLWJyZWFrcG9pbnRzJyk7XG5cdFx0Y29uc3QgZGVsZWdhdGUgPSBuZXcgQnJlYWtwb2ludHNEZWxlZ2F0ZSh0aGlzKTtcblxuXHRcdHRoaXMubGlzdCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoTGlzdCwgJ0JyZWFrcG9pbnRzJywgY29udGFpbmVyLCBkZWxlZ2F0ZSwgW1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCcmVha3BvaW50c1JlbmRlcmVyLCB0aGlzLm1lbnUsIHRoaXMuYnJlYWtwb2ludEhhc011bHRpcGxlTW9kZXMsIHRoaXMuYnJlYWtwb2ludFN1cHBvcnRzQ29uZGl0aW9uLCB0aGlzLmJyZWFrcG9pbnRJdGVtVHlwZSksXG5cdFx0XHRuZXcgRXhjZXB0aW9uQnJlYWtwb2ludHNSZW5kZXJlcih0aGlzLm1lbnUsIHRoaXMuYnJlYWtwb2ludEhhc011bHRpcGxlTW9kZXMsIHRoaXMuYnJlYWtwb2ludFN1cHBvcnRzQ29uZGl0aW9uLCB0aGlzLmJyZWFrcG9pbnRJdGVtVHlwZSwgdGhpcy5kZWJ1Z1NlcnZpY2UsIHRoaXMuaG92ZXJTZXJ2aWNlKSxcblx0XHRcdG5ldyBFeGNlcHRpb25CcmVha3BvaW50SW5wdXRSZW5kZXJlcih0aGlzLCB0aGlzLmRlYnVnU2VydmljZSwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UpLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGdW5jdGlvbkJyZWFrcG9pbnRzUmVuZGVyZXIsIHRoaXMubWVudSwgdGhpcy5icmVha3BvaW50U3VwcG9ydHNDb25kaXRpb24sIHRoaXMuYnJlYWtwb2ludEl0ZW1UeXBlKSxcblx0XHRcdG5ldyBGdW5jdGlvbkJyZWFrcG9pbnRJbnB1dFJlbmRlcmVyKHRoaXMsIHRoaXMuZGVidWdTZXJ2aWNlLCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwgdGhpcy5ob3ZlclNlcnZpY2UsIHRoaXMubGFiZWxTZXJ2aWNlKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGF0YUJyZWFrcG9pbnRzUmVuZGVyZXIsIHRoaXMubWVudSwgdGhpcy5icmVha3BvaW50SGFzTXVsdGlwbGVNb2RlcywgdGhpcy5icmVha3BvaW50U3VwcG9ydHNDb25kaXRpb24sIHRoaXMuYnJlYWtwb2ludEl0ZW1UeXBlLCB0aGlzLmJyZWFrcG9pbnRJc0RhdGFCeXRlcyksXG5cdFx0XHRuZXcgRGF0YUJyZWFrcG9pbnRJbnB1dFJlbmRlcmVyKHRoaXMsIHRoaXMuZGVidWdTZXJ2aWNlLCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwgdGhpcy5ob3ZlclNlcnZpY2UsIHRoaXMubGFiZWxTZXJ2aWNlKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdHJ1Y3Rpb25CcmVha3BvaW50c1JlbmRlcmVyKSxcblx0XHRdLCB7XG5cdFx0XHRpZGVudGl0eVByb3ZpZGVyOiB7IGdldElkOiAoZWxlbWVudDogSUVuYWJsZW1lbnQpID0+IGVsZW1lbnQuZ2V0SWQoKSB9LFxuXHRcdFx0bXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0OiBmYWxzZSxcblx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IHsgZ2V0S2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWw6IChlOiBJRW5hYmxlbWVudCkgPT4gZSB9LFxuXHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBuZXcgQnJlYWtwb2ludHNBY2Nlc3NpYmlsaXR5UHJvdmlkZXIodGhpcy5kZWJ1Z1NlcnZpY2UsIHRoaXMubGFiZWxTZXJ2aWNlKSxcblx0XHRcdG92ZXJyaWRlU3R5bGVzOiB0aGlzLmdldExvY2F0aW9uQmFzZWRDb2xvcnMoKS5saXN0T3ZlcnJpZGVTdHlsZXNcblx0XHR9KSBhcyBXb3JrYmVuY2hMaXN0PEJyZWFrcG9pbnRJdGVtPjtcblxuXHRcdENPTlRFWFRfQlJFQUtQT0lOVFNfRk9DVVNFRC5iaW5kVG8odGhpcy5saXN0LmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlzdC5vbkNvbnRleHRNZW51KHRoaXMub25MaXN0Q29udGV4dE1lbnUsIHRoaXMpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlzdC5vbk1vdXNlTWlkZGxlQ2xpY2soYXN5bmMgKHsgZWxlbWVudCB9KSA9PiB7XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEJyZWFrcG9pbnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5kZWJ1Z1NlcnZpY2UucmVtb3ZlQnJlYWtwb2ludHMoZWxlbWVudC5nZXRJZCgpKTtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZ1bmN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS5yZW1vdmVGdW5jdGlvbkJyZWFrcG9pbnRzKGVsZW1lbnQuZ2V0SWQoKSk7XG5cdFx0XHR9IGVsc2UgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBEYXRhQnJlYWtwb2ludCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS5yZW1vdmVEYXRhQnJlYWtwb2ludHMoZWxlbWVudC5nZXRJZCgpKTtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEluc3RydWN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS5yZW1vdmVJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKGVsZW1lbnQuaW5zdHJ1Y3Rpb25SZWZlcmVuY2UsIGVsZW1lbnQub2Zmc2V0KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxpc3Qub25EaWRPcGVuKGFzeW5jIGUgPT4ge1xuXHRcdFx0aWYgKCFlLmVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZG9tLmlzTW91c2VFdmVudChlLmJyb3dzZXJFdmVudCkgJiYgZS5icm93c2VyRXZlbnQuYnV0dG9uID09PSAxKSB7IC8vIG1pZGRsZSBjbGlja1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLmVsZW1lbnQgaW5zdGFuY2VvZiBCcmVha3BvaW50KSB7XG5cdFx0XHRcdG9wZW5CcmVha3BvaW50U291cmNlKGUuZWxlbWVudCwgZS5zaWRlQnlTaWRlLCBlLmVkaXRvck9wdGlvbnMucHJlc2VydmVGb2N1cyB8fCBmYWxzZSwgZS5lZGl0b3JPcHRpb25zLnBpbm5lZCB8fCAhZS5lZGl0b3JPcHRpb25zLnByZXNlcnZlRm9jdXMsIHRoaXMuZGVidWdTZXJ2aWNlLCB0aGlzLmVkaXRvclNlcnZpY2UpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuZWxlbWVudCBpbnN0YW5jZW9mIEluc3RydWN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0XHRjb25zdCBkaXNhc3NlbWJseVZpZXcgPSBhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihEaXNhc3NlbWJseVZpZXdJbnB1dC5pbnN0YW5jZSk7XG5cdFx0XHRcdC8vIEZvY3VzIG9uIGRvdWJsZSBjbGlja1xuXHRcdFx0XHQoZGlzYXNzZW1ibHlWaWV3IGFzIERpc2Fzc2VtYmx5VmlldykuZ29Ub0luc3RydWN0aW9uQW5kT2Zmc2V0KGUuZWxlbWVudC5pbnN0cnVjdGlvblJlZmVyZW5jZSwgZS5lbGVtZW50Lm9mZnNldCwgZG9tLmlzTW91c2VFdmVudChlLmJyb3dzZXJFdmVudCkgJiYgZS5icm93c2VyRXZlbnQuZGV0YWlsID09PSAyKTtcblx0XHRcdH1cblx0XHRcdGlmIChkb20uaXNNb3VzZUV2ZW50KGUuYnJvd3NlckV2ZW50KSAmJiBlLmJyb3dzZXJFdmVudC5kZXRhaWwgPT09IDIgJiYgZS5lbGVtZW50IGluc3RhbmNlb2YgRnVuY3Rpb25CcmVha3BvaW50ICYmIGUuZWxlbWVudCAhPT0gdGhpcy5pbnB1dEJveERhdGE/LmJyZWFrcG9pbnQpIHtcblx0XHRcdFx0Ly8gZG91YmxlIGNsaWNrXG5cdFx0XHRcdHRoaXMucmVuZGVySW5wdXRCb3goeyBicmVha3BvaW50OiBlLmVsZW1lbnQsIHR5cGU6ICduYW1lJyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLmxpc3Quc3BsaWNlKDAsIHRoaXMubGlzdC5sZW5ndGgsIHRoaXMuZWxlbWVudHMpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5KHZpc2libGUgPT4ge1xuXHRcdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdFx0aWYgKHRoaXMubmVlZHNSZWZyZXNoKSB7XG5cdFx0XHRcdFx0dGhpcy5vbkJyZWFrcG9pbnRzQ2hhbmdlKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5uZWVkc1N0YXRlQ2hhbmdlKSB7XG5cdFx0XHRcdFx0dGhpcy5vblN0YXRlQ2hhbmdlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBjb250YWluZXJNb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodGhpcy5pZCkhKSE7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29udGFpbmVyTW9kZWwub25EaWRDaGFuZ2VBbGxWaWV3RGVzY3JpcHRvcnMoKCkgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVTaXplKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckhlYWRlclRpdGxlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHRpdGxlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJIZWFkZXJUaXRsZShjb250YWluZXIsIHRpdGxlKTtcblxuXHRcdGNvbnN0IGljb25MYWJlbENvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCdzcGFuLmJyZWFrcG9pbnQtd2FybmluZycpKTtcblx0XHR0aGlzLmhpbnRDb250YWluZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgSWNvbkxhYmVsKGljb25MYWJlbENvbnRhaW5lciwge1xuXHRcdFx0c3VwcG9ydEljb25zOiB0cnVlLCBob3ZlckRlbGVnYXRlOiB7XG5cdFx0XHRcdHNob3dIb3ZlcjogKG9wdGlvbnMsIGZvY3VzPykgPT4gdGhpcy5ob3ZlclNlcnZpY2Uuc2hvd0luc3RhbnRIb3Zlcih7IGNvbnRlbnQ6IG9wdGlvbnMuY29udGVudCwgdGFyZ2V0OiB0aGlzLmhpbnRDb250YWluZXIhLmVsZW1lbnQgfSwgZm9jdXMpLFxuXHRcdFx0XHRkZWxheTogPG51bWJlcj50aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd3b3JrYmVuY2guaG92ZXIuZGVsYXknKVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkb20uaGlkZSh0aGlzLmhpbnRDb250YWluZXIuZWxlbWVudCk7XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpOiB2b2lkIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXHRcdHRoaXMubGlzdD8uZG9tRm9jdXMoKTtcblx0fVxuXG5cdHJlbmRlcklucHV0Qm94KGRhdGE6IElucHV0Qm94RGF0YSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX2lucHV0Qm94RGF0YSA9IGRhdGE7XG5cdFx0dGhpcy5vbkJyZWFrcG9pbnRzQ2hhbmdlKCk7XG5cdFx0dGhpcy5faW5wdXRCb3hEYXRhID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IGlucHV0Qm94RGF0YSgpOiBJbnB1dEJveERhdGEgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9pbnB1dEJveERhdGE7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgbGF5b3V0Qm9keShoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlnbm9yZUxheW91dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN1cGVyLmxheW91dEJvZHkoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0dGhpcy5saXN0Py5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuaWdub3JlTGF5b3V0ID0gdHJ1ZTtcblx0XHRcdHRoaXMudXBkYXRlU2l6ZSgpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLmlnbm9yZUxheW91dCA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25MaXN0Q29udGV4dE1lbnUoZTogSUxpc3RDb250ZXh0TWVudUV2ZW50PElFbmFibGVtZW50Pik6IHZvaWQge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBlLmVsZW1lbnQ7XG5cdFx0Y29uc3QgdHlwZSA9IGVsZW1lbnQgaW5zdGFuY2VvZiBCcmVha3BvaW50ID8gJ2JyZWFrcG9pbnQnIDogZWxlbWVudCBpbnN0YW5jZW9mIEV4Y2VwdGlvbkJyZWFrcG9pbnQgPyAnZXhjZXB0aW9uQnJlYWtwb2ludCcgOlxuXHRcdFx0ZWxlbWVudCBpbnN0YW5jZW9mIEZ1bmN0aW9uQnJlYWtwb2ludCA/ICdmdW5jdGlvbkJyZWFrcG9pbnQnIDogZWxlbWVudCBpbnN0YW5jZW9mIERhdGFCcmVha3BvaW50ID8gJ2RhdGFCcmVha3BvaW50JyA6XG5cdFx0XHRcdGVsZW1lbnQgaW5zdGFuY2VvZiBJbnN0cnVjdGlvbkJyZWFrcG9pbnQgPyAnaW5zdHJ1Y3Rpb25CcmVha3BvaW50JyA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLmJyZWFrcG9pbnRJdGVtVHlwZS5zZXQodHlwZSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTZXNzaW9uO1xuXHRcdGNvbnN0IGNvbmRpdGlvblN1cHBvcnRlZCA9IGVsZW1lbnQgaW5zdGFuY2VvZiBFeGNlcHRpb25CcmVha3BvaW50ID8gZWxlbWVudC5zdXBwb3J0c0NvbmRpdGlvbiA6ICghc2Vzc2lvbiB8fCAhIXNlc3Npb24uY2FwYWJpbGl0aWVzLnN1cHBvcnRzQ29uZGl0aW9uYWxCcmVha3BvaW50cyk7XG5cdFx0dGhpcy5icmVha3BvaW50U3VwcG9ydHNDb25kaXRpb24uc2V0KGNvbmRpdGlvblN1cHBvcnRlZCk7XG5cdFx0dGhpcy5icmVha3BvaW50SXNEYXRhQnl0ZXMuc2V0KGVsZW1lbnQgaW5zdGFuY2VvZiBEYXRhQnJlYWtwb2ludCAmJiBlbGVtZW50LnNyYy50eXBlID09PSBEYXRhQnJlYWtwb2ludFNldFR5cGUuQWRkcmVzcyk7XG5cdFx0dGhpcy5icmVha3BvaW50SGFzTXVsdGlwbGVNb2Rlcy5zZXQodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50TW9kZXMoZ2V0TW9kZUtpbmRGb3JCcmVha3BvaW50KGVsZW1lbnQgYXMgSUJyZWFrcG9pbnQpKS5sZW5ndGggPiAxKTtcblxuXHRcdGNvbnN0IHsgc2Vjb25kYXJ5IH0gPSBnZXRDb250ZXh0TWVudUFjdGlvbnModGhpcy5tZW51LmdldEFjdGlvbnMoeyBhcmc6IGUuZWxlbWVudCwgc2hvdWxkRm9yd2FyZEFyZ3M6IGZhbHNlIH0pLCAnaW5saW5lJyk7XG5cblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBlLmFuY2hvcixcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHNlY29uZGFyeSxcblx0XHRcdGdldEFjdGlvbnNDb250ZXh0OiAoKSA9PiBlbGVtZW50XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNpemUoKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udGFpbmVyTW9kZWwgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHRoaXMuaWQpISkhO1xuXG5cdFx0Ly8gQWRqdXN0IGV4cGFuZGVkIGJvZHkgc2l6ZVxuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTZXNzaW9uPy5nZXRJZCgpO1xuXHRcdHRoaXMubWluaW11bUJvZHlTaXplID0gdGhpcy5vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwgPyBnZXRFeHBhbmRlZEJvZHlTaXplKHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCksIHNlc3Npb25JZCwgTUFYX1ZJU0lCTEVfQlJFQUtQT0lOVFMpIDogMTcwO1xuXHRcdHRoaXMubWF4aW11bUJvZHlTaXplID0gdGhpcy5vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwgJiYgY29udGFpbmVyTW9kZWwudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGggPiAxID8gZ2V0RXhwYW5kZWRCb2R5U2l6ZSh0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLCBzZXNzaW9uSWQsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUJyZWFrcG9pbnRzSGludChkZWxheWVkID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaGludENvbnRhaW5lcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGN1cnJlbnRUeXBlID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb24/LmNvbmZpZ3VyYXRpb24udHlwZTtcblx0XHRjb25zdCBkYmcgPSBjdXJyZW50VHlwZSA/IHRoaXMuZGVidWdTZXJ2aWNlLmdldEFkYXB0ZXJNYW5hZ2VyKCkuZ2V0RGVidWdnZXIoY3VycmVudFR5cGUpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1lc3NhZ2UgPSBkYmc/LnN0cmluZ3M/LltEZWJ1Z2dlclN0cmluZy5VbnZlcmlmaWVkQnJlYWtwb2ludHNdO1xuXHRcdGNvbnN0IGRlYnVnZ2VySGFzVW52ZXJpZmllZEJwcyA9IG1lc3NhZ2UgJiYgdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50cygpLmZpbHRlcihicCA9PiB7XG5cdFx0XHRpZiAoYnAudmVyaWZpZWQgfHwgIWJwLmVuYWJsZWQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBsYW5nSWQgPSB0aGlzLmxhbmd1YWdlU2VydmljZS5ndWVzc0xhbmd1YWdlSWRCeUZpbGVwYXRoT3JGaXJzdExpbmUoYnAudXJpKTtcblx0XHRcdHJldHVybiBsYW5nSWQgJiYgZGJnLmludGVyZXN0ZWRJbkxhbmd1YWdlKGxhbmdJZCk7XG5cdFx0fSk7XG5cblx0XHRpZiAobWVzc2FnZSAmJiBkZWJ1Z2dlckhhc1VudmVyaWZpZWRCcHM/Lmxlbmd0aCAmJiB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCkpIHtcblx0XHRcdGlmIChkZWxheWVkKSB7XG5cdFx0XHRcdGNvbnN0IG1kb3duID0gbmV3IE1hcmtkb3duU3RyaW5nKHVuZGVmaW5lZCwgeyBpc1RydXN0ZWQ6IHRydWUgfSkuYXBwZW5kTWFya2Rvd24obWVzc2FnZSk7XG5cdFx0XHRcdHRoaXMuaGludENvbnRhaW5lci5zZXRMYWJlbCgnJCh3YXJuaW5nKScsIHVuZGVmaW5lZCwgeyB0aXRsZTogeyBtYXJrZG93bjogbWRvd24sIG1hcmtkb3duTm90U3VwcG9ydGVkRmFsbGJhY2s6IG1lc3NhZ2UgfSB9KTtcblx0XHRcdFx0ZG9tLnNob3codGhpcy5oaW50Q29udGFpbmVyLmVsZW1lbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5oaW50RGVsYXllci5zY2hlZHVsZSgpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRkb20uaGlkZSh0aGlzLmhpbnRDb250YWluZXIuZWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkJyZWFrcG9pbnRzQ2hhbmdlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzQm9keVZpc2libGUoKSkge1xuXHRcdFx0dGhpcy51cGRhdGVTaXplKCk7XG5cdFx0XHRpZiAodGhpcy5saXN0KSB7XG5cdFx0XHRcdGNvbnN0IGxhc3RGb2N1c0luZGV4ID0gdGhpcy5saXN0LmdldEZvY3VzKClbMF07XG5cdFx0XHRcdC8vIENoZWNrIHdoZXRoZXIgZm9jdXNlZCBlbGVtZW50IHdhcyByZW1vdmVkXG5cdFx0XHRcdGNvbnN0IG5lZWRzUmVmb2N1cyA9IGxhc3RGb2N1c0luZGV4ICYmICF0aGlzLmVsZW1lbnRzLmluY2x1ZGVzKHRoaXMubGlzdC5lbGVtZW50KGxhc3RGb2N1c0luZGV4KSk7XG5cdFx0XHRcdHRoaXMubGlzdC5zcGxpY2UoMCwgdGhpcy5saXN0Lmxlbmd0aCwgdGhpcy5lbGVtZW50cyk7XG5cdFx0XHRcdHRoaXMubmVlZHNSZWZyZXNoID0gZmFsc2U7XG5cdFx0XHRcdGlmIChuZWVkc1JlZm9jdXMpIHtcblx0XHRcdFx0XHR0aGlzLmxpc3QuZm9jdXNOdGgoTWF0aC5taW4obGFzdEZvY3VzSW5kZXgsIHRoaXMubGlzdC5sZW5ndGggLSAxKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlQnJlYWtwb2ludHNIaW50KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubmVlZHNSZWZyZXNoID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uU3RhdGVDaGFuZ2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNCb2R5VmlzaWJsZSgpKSB7XG5cdFx0XHR0aGlzLm5lZWRzU3RhdGVDaGFuZ2UgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHRocmVhZCA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRUaHJlYWQ7XG5cdFx0XHRsZXQgZm91bmQgPSBmYWxzZTtcblx0XHRcdGlmICh0aHJlYWQgJiYgdGhyZWFkLnN0b3BwZWREZXRhaWxzICYmIHRocmVhZC5zdG9wcGVkRGV0YWlscy5oaXRCcmVha3BvaW50SWRzICYmIHRocmVhZC5zdG9wcGVkRGV0YWlscy5oaXRCcmVha3BvaW50SWRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3QgaGl0QnJlYWtwb2ludElkcyA9IHRocmVhZC5zdG9wcGVkRGV0YWlscy5oaXRCcmVha3BvaW50SWRzO1xuXHRcdFx0XHRjb25zdCBlbGVtZW50cyA9IHRoaXMuZWxlbWVudHM7XG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gZWxlbWVudHMuZmluZEluZGV4KGUgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGlkID0gZS5nZXRJZEZyb21BZGFwdGVyKHRocmVhZC5zZXNzaW9uLmdldElkKCkpO1xuXHRcdFx0XHRcdHJldHVybiB0eXBlb2YgaWQgPT09ICdudW1iZXInICYmIGhpdEJyZWFrcG9pbnRJZHMuaW5kZXhPZihpZCkgIT09IC0xO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHRcdFx0dGhpcy5saXN0LnNldFNlbGVjdGlvbihbaW5kZXhdKTtcblx0XHRcdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5hdXRvRm9jdXNlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghZm91bmQpIHtcblx0XHRcdFx0Ly8gRGVzZWxlY3QgYnJlYWtwb2ludCBpbiBicmVha3BvaW50IHZpZXcgd2hlbiBubyBsb25nZXIgc3RvcHBlZCBvbiBpdCAjMTI1NTI4XG5cdFx0XHRcdGNvbnN0IGZvY3VzID0gdGhpcy5saXN0LmdldEZvY3VzKCk7XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMubGlzdC5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdFx0aWYgKHRoaXMuYXV0b0ZvY3VzZWRJbmRleCA+PSAwICYmIGVxdWFscyhmb2N1cywgc2VsZWN0aW9uKSAmJiBmb2N1cy5pbmRleE9mKHRoaXMuYXV0b0ZvY3VzZWRJbmRleCkgPj0gMCkge1xuXHRcdFx0XHRcdHRoaXMubGlzdC5zZXRGb2N1cyhbXSk7XG5cdFx0XHRcdFx0dGhpcy5saXN0LnNldFNlbGVjdGlvbihbXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5hdXRvRm9jdXNlZEluZGV4ID0gLTE7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZUJyZWFrcG9pbnRzSGludCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm5lZWRzU3RhdGVDaGFuZ2UgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0IGVsZW1lbnRzKCk6IEJyZWFrcG9pbnRJdGVtW10ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbj8uZ2V0SWQoKTtcblx0XHRjb25zdCBlbGVtZW50cyA9ICg8UmVhZG9ubHlBcnJheTxJRW5hYmxlbWVudD4+bW9kZWwuZ2V0RXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKHNlc3Npb25JZCkpLmNvbmNhdChtb2RlbC5nZXRGdW5jdGlvbkJyZWFrcG9pbnRzKCkpLmNvbmNhdChtb2RlbC5nZXREYXRhQnJlYWtwb2ludHMoKSkuY29uY2F0KG1vZGVsLmdldEJyZWFrcG9pbnRzKCkpLmNvbmNhdChtb2RlbC5nZXRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKCkpO1xuXG5cdFx0cmV0dXJuIGVsZW1lbnRzIGFzIEJyZWFrcG9pbnRJdGVtW107XG5cdH1cbn1cblxuY2xhc3MgQnJlYWtwb2ludHNEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPEJyZWFrcG9pbnRJdGVtPiB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSB2aWV3OiBCcmVha3BvaW50c1ZpZXcpIHtcblx0XHQvLyBub29wXG5cdH1cblxuXHRnZXRIZWlnaHQoX2VsZW1lbnQ6IEJyZWFrcG9pbnRJdGVtKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMjI7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IEJyZWFrcG9pbnRJdGVtKTogc3RyaW5nIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEJyZWFrcG9pbnQpIHtcblx0XHRcdHJldHVybiBCcmVha3BvaW50c1JlbmRlcmVyLklEO1xuXHRcdH1cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZ1bmN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0Y29uc3QgaW5wdXRCb3hCcmVha3BvaW50ID0gdGhpcy52aWV3LmlucHV0Qm94RGF0YT8uYnJlYWtwb2ludDtcblx0XHRcdGlmICghZWxlbWVudC5uYW1lIHx8IChpbnB1dEJveEJyZWFrcG9pbnQgJiYgaW5wdXRCb3hCcmVha3BvaW50LmdldElkKCkgPT09IGVsZW1lbnQuZ2V0SWQoKSkpIHtcblx0XHRcdFx0cmV0dXJuIEZ1bmN0aW9uQnJlYWtwb2ludElucHV0UmVuZGVyZXIuSUQ7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBGdW5jdGlvbkJyZWFrcG9pbnRzUmVuZGVyZXIuSUQ7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgRXhjZXB0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0Y29uc3QgaW5wdXRCb3hCcmVha3BvaW50ID0gdGhpcy52aWV3LmlucHV0Qm94RGF0YT8uYnJlYWtwb2ludDtcblx0XHRcdGlmIChpbnB1dEJveEJyZWFrcG9pbnQgJiYgaW5wdXRCb3hCcmVha3BvaW50LmdldElkKCkgPT09IGVsZW1lbnQuZ2V0SWQoKSkge1xuXHRcdFx0XHRyZXR1cm4gRXhjZXB0aW9uQnJlYWtwb2ludElucHV0UmVuZGVyZXIuSUQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gRXhjZXB0aW9uQnJlYWtwb2ludHNSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBEYXRhQnJlYWtwb2ludCkge1xuXHRcdFx0Y29uc3QgaW5wdXRCb3hCcmVha3BvaW50ID0gdGhpcy52aWV3LmlucHV0Qm94RGF0YT8uYnJlYWtwb2ludDtcblx0XHRcdGlmIChpbnB1dEJveEJyZWFrcG9pbnQgJiYgaW5wdXRCb3hCcmVha3BvaW50LmdldElkKCkgPT09IGVsZW1lbnQuZ2V0SWQoKSkge1xuXHRcdFx0XHRyZXR1cm4gRGF0YUJyZWFrcG9pbnRJbnB1dFJlbmRlcmVyLklEO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gRGF0YUJyZWFrcG9pbnRzUmVuZGVyZXIuSUQ7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgSW5zdHJ1Y3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRyZXR1cm4gSW5zdHJ1Y3Rpb25CcmVha3BvaW50c1JlbmRlcmVyLklEO1xuXHRcdH1cblxuXHRcdHJldHVybiAnJztcblx0fVxufVxuXG5pbnRlcmZhY2UgSUJhc2VCcmVha3BvaW50VGVtcGxhdGVEYXRhIHtcblx0YnJlYWtwb2ludDogSFRNTEVsZW1lbnQ7XG5cdG5hbWU6IEhUTUxFbGVtZW50O1xuXHRjaGVja2JveDogSFRNTElucHV0RWxlbWVudDtcblx0Y29udGV4dDogQnJlYWtwb2ludEl0ZW07XG5cdGFjdGlvbkJhcjogQWN0aW9uQmFyO1xuXHR0ZW1wbGF0ZURpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGVsZW1lbnREaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRiYWRnZTogSFRNTEVsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBJQmFzZUJyZWFrcG9pbnRXaXRoSWNvblRlbXBsYXRlRGF0YSBleHRlbmRzIElCYXNlQnJlYWtwb2ludFRlbXBsYXRlRGF0YSB7XG5cdGljb246IEhUTUxFbGVtZW50O1xufVxuXG5pbnRlcmZhY2UgSUJyZWFrcG9pbnRUZW1wbGF0ZURhdGEgZXh0ZW5kcyBJQmFzZUJyZWFrcG9pbnRXaXRoSWNvblRlbXBsYXRlRGF0YSB7XG5cdGZpbGVQYXRoOiBIVE1MRWxlbWVudDtcbn1cblxuaW50ZXJmYWNlIElFeGNlcHRpb25CcmVha3BvaW50VGVtcGxhdGVEYXRhIGV4dGVuZHMgSUJhc2VCcmVha3BvaW50VGVtcGxhdGVEYXRhIHtcblx0Y29uZGl0aW9uOiBIVE1MRWxlbWVudDtcbn1cblxuaW50ZXJmYWNlIElGdW5jdGlvbkJyZWFrcG9pbnRUZW1wbGF0ZURhdGEgZXh0ZW5kcyBJQmFzZUJyZWFrcG9pbnRXaXRoSWNvblRlbXBsYXRlRGF0YSB7XG5cdGNvbmRpdGlvbjogSFRNTEVsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBJRGF0YUJyZWFrcG9pbnRUZW1wbGF0ZURhdGEgZXh0ZW5kcyBJQmFzZUJyZWFrcG9pbnRXaXRoSWNvblRlbXBsYXRlRGF0YSB7XG5cdGFjY2Vzc1R5cGU6IEhUTUxFbGVtZW50O1xuXHRjb25kaXRpb246IEhUTUxFbGVtZW50O1xufVxuXG5pbnRlcmZhY2UgSUluc3RydWN0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YSBleHRlbmRzIElCYXNlQnJlYWtwb2ludFdpdGhJY29uVGVtcGxhdGVEYXRhIHtcblx0YWRkcmVzczogSFRNTEVsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBJRnVuY3Rpb25CcmVha3BvaW50SW5wdXRUZW1wbGF0ZURhdGEge1xuXHRpbnB1dEJveDogSW5wdXRCb3g7XG5cdGNoZWNrYm94OiBIVE1MSW5wdXRFbGVtZW50O1xuXHRpY29uOiBIVE1MRWxlbWVudDtcblx0YnJlYWtwb2ludDogSUZ1bmN0aW9uQnJlYWtwb2ludDtcblx0dGVtcGxhdGVEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRlbGVtZW50RGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0dHlwZTogJ2hpdENvdW50JyB8ICdjb25kaXRpb24nIHwgJ25hbWUnO1xuXHR1cGRhdGluZz86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJRGF0YUJyZWFrcG9pbnRJbnB1dFRlbXBsYXRlRGF0YSB7XG5cdGlucHV0Qm94OiBJbnB1dEJveDtcblx0Y2hlY2tib3g6IEhUTUxJbnB1dEVsZW1lbnQ7XG5cdGljb246IEhUTUxFbGVtZW50O1xuXHRicmVha3BvaW50OiBJRGF0YUJyZWFrcG9pbnQ7XG5cdGVsZW1lbnREaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHR0ZW1wbGF0ZURpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHR5cGU6ICdoaXRDb3VudCcgfCAnY29uZGl0aW9uJyB8ICduYW1lJztcblx0dXBkYXRpbmc/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSUV4Y2VwdGlvbkJyZWFrcG9pbnRJbnB1dFRlbXBsYXRlRGF0YSB7XG5cdGlucHV0Qm94OiBJbnB1dEJveDtcblx0Y2hlY2tib3g6IEhUTUxJbnB1dEVsZW1lbnQ7XG5cdGN1cnJlbnRCcmVha3BvaW50PzogSUV4Y2VwdGlvbkJyZWFrcG9pbnQ7XG5cdHRlbXBsYXRlRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0ZWxlbWVudERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG59XG5cbmNvbnN0IGJyZWFrcG9pbnRJZFRvQWN0aW9uQmFyRG9tZU5vZGUgPSBuZXcgTWFwPHN0cmluZywgSFRNTEVsZW1lbnQ+KCk7XG5jbGFzcyBCcmVha3BvaW50c1JlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxJQnJlYWtwb2ludCwgSUJyZWFrcG9pbnRUZW1wbGF0ZURhdGE+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIG1lbnU6IElNZW51LFxuXHRcdHByaXZhdGUgYnJlYWtwb2ludEhhc011bHRpcGxlTW9kZXM6IElDb250ZXh0S2V5PGJvb2xlYW4+LFxuXHRcdHByaXZhdGUgYnJlYWtwb2ludFN1cHBvcnRzQ29uZGl0aW9uOiBJQ29udGV4dEtleTxib29sZWFuPixcblx0XHRwcml2YXRlIGJyZWFrcG9pbnRJdGVtVHlwZTogSUNvbnRleHRLZXk8c3RyaW5nIHwgdW5kZWZpbmVkPixcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZVxuXHQpIHtcblx0XHQvLyBub29wXG5cdH1cblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnYnJlYWtwb2ludHMnO1xuXG5cdGdldCB0ZW1wbGF0ZUlkKCkge1xuXHRcdHJldHVybiBCcmVha3BvaW50c1JlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElCcmVha3BvaW50VGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBkYXRhOiBJQnJlYWtwb2ludFRlbXBsYXRlRGF0YSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0ZGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMpO1xuXG5cdFx0ZGF0YS5icmVha3BvaW50ID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5icmVha3BvaW50JykpO1xuXG5cdFx0ZGF0YS5pY29uID0gJCgnLmljb24nKTtcblx0XHRkYXRhLmNoZWNrYm94ID0gY3JlYXRlQ2hlY2tib3goZGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzKTtcblxuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKGRhdGEuY2hlY2tib3gsICdjaGFuZ2UnLCAoZSkgPT4ge1xuXHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHMoIWRhdGEuY29udGV4dC5lbmFibGVkLCBkYXRhLmNvbnRleHQpO1xuXHRcdH0pKTtcblxuXHRcdGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCBkYXRhLmljb24pO1xuXHRcdGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCBkYXRhLmNoZWNrYm94KTtcblxuXHRcdGRhdGEubmFtZSA9IGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCAkKCdzcGFuLm5hbWUnKSk7XG5cblx0XHRkYXRhLmZpbGVQYXRoID0gZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsICQoJ3NwYW4uZmlsZS1wYXRoJykpO1xuXHRcdGRhdGEuYWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcihkYXRhLmJyZWFrcG9pbnQpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZGF0YS5hY3Rpb25CYXIpO1xuXHRcdGNvbnN0IGJhZGdlQ29udGFpbmVyID0gZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsICQoJy5iYWRnZS1jb250YWluZXInKSk7XG5cdFx0ZGF0YS5iYWRnZSA9IGRvbS5hcHBlbmQoYmFkZ2VDb250YWluZXIsICQoJ3NwYW4ubGluZS1udW1iZXIubW9uYWNvLWNvdW50LWJhZGdlJykpO1xuXG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGJyZWFrcG9pbnQ6IElCcmVha3BvaW50LCBpbmRleDogbnVtYmVyLCBkYXRhOiBJQnJlYWtwb2ludFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEuY29udGV4dCA9IGJyZWFrcG9pbnQ7XG5cdFx0ZGF0YS5icmVha3BvaW50LmNsYXNzTGlzdC50b2dnbGUoJ2Rpc2FibGVkJywgIXRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuYXJlQnJlYWtwb2ludHNBY3RpdmF0ZWQoKSk7XG5cblx0XHRkYXRhLm5hbWUudGV4dENvbnRlbnQgPSByZXNvdXJjZXMuYmFzZW5hbWVPckF1dGhvcml0eShicmVha3BvaW50LnVyaSk7XG5cdFx0bGV0IGJhZGdlQ29udGVudCA9IGJyZWFrcG9pbnQubGluZU51bWJlci50b1N0cmluZygpO1xuXHRcdGlmIChicmVha3BvaW50LmNvbHVtbikge1xuXHRcdFx0YmFkZ2VDb250ZW50ICs9IGA6JHticmVha3BvaW50LmNvbHVtbn1gO1xuXHRcdH1cblx0XHRpZiAoYnJlYWtwb2ludC5tb2RlTGFiZWwpIHtcblx0XHRcdGJhZGdlQ29udGVudCA9IGAke2JyZWFrcG9pbnQubW9kZUxhYmVsfTogJHtiYWRnZUNvbnRlbnR9YDtcblx0XHR9XG5cdFx0ZGF0YS5iYWRnZS50ZXh0Q29udGVudCA9IGJhZGdlQ29udGVudDtcblx0XHRkYXRhLmZpbGVQYXRoLnRleHRDb250ZW50ID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwocmVzb3VyY2VzLmRpcm5hbWUoYnJlYWtwb2ludC51cmkpLCB7IHJlbGF0aXZlOiB0cnVlIH0pO1xuXHRcdGRhdGEuY2hlY2tib3guY2hlY2tlZCA9IGJyZWFrcG9pbnQuZW5hYmxlZDtcblxuXHRcdGNvbnN0IHsgbWVzc2FnZSwgaWNvbiB9ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlLCB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCksIGJyZWFrcG9pbnQsIHRoaXMubGFiZWxTZXJ2aWNlLCB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpKTtcblx0XHRkYXRhLmljb24uY2xhc3NOYW1lID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb24pO1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgZGF0YS5icmVha3BvaW50LCBicmVha3BvaW50Lm1lc3NhZ2UgfHwgbWVzc2FnZSB8fCAnJykpO1xuXG5cdFx0Y29uc3QgZGVidWdBY3RpdmUgPSB0aGlzLmRlYnVnU2VydmljZS5zdGF0ZSA9PT0gU3RhdGUuUnVubmluZyB8fCB0aGlzLmRlYnVnU2VydmljZS5zdGF0ZSA9PT0gU3RhdGUuU3RvcHBlZDtcblx0XHRpZiAoZGVidWdBY3RpdmUgJiYgIWJyZWFrcG9pbnQudmVyaWZpZWQpIHtcblx0XHRcdGRhdGEuYnJlYWtwb2ludC5jbGFzc0xpc3QuYWRkKCdkaXNhYmxlZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHR0aGlzLmJyZWFrcG9pbnRTdXBwb3J0c0NvbmRpdGlvbi5zZXQoIXNlc3Npb24gfHwgISFzZXNzaW9uLmNhcGFiaWxpdGllcy5zdXBwb3J0c0NvbmRpdGlvbmFsQnJlYWtwb2ludHMpO1xuXHRcdHRoaXMuYnJlYWtwb2ludEl0ZW1UeXBlLnNldCgnYnJlYWtwb2ludCcpO1xuXHRcdHRoaXMuYnJlYWtwb2ludEhhc011bHRpcGxlTW9kZXMuc2V0KHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0QnJlYWtwb2ludE1vZGVzKCdzb3VyY2UnKS5sZW5ndGggPiAxKTtcblx0XHRjb25zdCB7IHByaW1hcnkgfSA9IGdldEFjdGlvbkJhckFjdGlvbnModGhpcy5tZW51LmdldEFjdGlvbnMoeyBhcmc6IGJyZWFrcG9pbnQsIHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pLCAnaW5saW5lJyk7XG5cdFx0ZGF0YS5hY3Rpb25CYXIuY2xlYXIoKTtcblx0XHRkYXRhLmFjdGlvbkJhci5wdXNoKHByaW1hcnksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHRcdGJyZWFrcG9pbnRJZFRvQWN0aW9uQmFyRG9tZU5vZGUuc2V0KGJyZWFrcG9pbnQuZ2V0SWQoKSwgZGF0YS5hY3Rpb25CYXIuZG9tTm9kZSk7XG5cdH1cblxuXG5cblx0ZGlzcG9zZUVsZW1lbnQoYTogYW55LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZTogSUJyZWFrcG9pbnRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElCcmVha3BvaW50VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIEV4Y2VwdGlvbkJyZWFrcG9pbnRzUmVuZGVyZXIgaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPElFeGNlcHRpb25CcmVha3BvaW50LCBJRXhjZXB0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YT4ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgbWVudTogSU1lbnUsXG5cdFx0cHJpdmF0ZSBicmVha3BvaW50SGFzTXVsdGlwbGVNb2RlczogSUNvbnRleHRLZXk8Ym9vbGVhbj4sXG5cdFx0cHJpdmF0ZSBicmVha3BvaW50U3VwcG9ydHNDb25kaXRpb246IElDb250ZXh0S2V5PGJvb2xlYW4+LFxuXHRcdHByaXZhdGUgYnJlYWtwb2ludEl0ZW1UeXBlOiBJQ29udGV4dEtleTxzdHJpbmcgfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHQvLyBub29wXG5cdH1cblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZXhjZXB0aW9uYnJlYWtwb2ludHMnO1xuXG5cdGdldCB0ZW1wbGF0ZUlkKCkge1xuXHRcdHJldHVybiBFeGNlcHRpb25CcmVha3BvaW50c1JlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElFeGNlcHRpb25CcmVha3BvaW50VGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBkYXRhOiBJRXhjZXB0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0ZGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMpO1xuXHRcdGRhdGEuYnJlYWtwb2ludCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcuYnJlYWtwb2ludCcpKTtcblxuXHRcdGRhdGEuY2hlY2tib3ggPSBjcmVhdGVDaGVja2JveChkYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKGRhdGEuY2hlY2tib3gsICdjaGFuZ2UnLCAoZSkgPT4ge1xuXHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHMoIWRhdGEuY29udGV4dC5lbmFibGVkLCBkYXRhLmNvbnRleHQpO1xuXHRcdH0pKTtcblxuXHRcdGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCBkYXRhLmNoZWNrYm94KTtcblxuXHRcdGRhdGEubmFtZSA9IGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCAkKCdzcGFuLm5hbWUnKSk7XG5cdFx0ZGF0YS5jb25kaXRpb24gPSBkb20uYXBwZW5kKGRhdGEuYnJlYWtwb2ludCwgJCgnc3Bhbi5jb25kaXRpb24nKSk7XG5cdFx0ZGF0YS5icmVha3BvaW50LmNsYXNzTGlzdC5hZGQoJ2V4Y2VwdGlvbicpO1xuXG5cdFx0ZGF0YS5hY3Rpb25CYXIgPSBuZXcgQWN0aW9uQmFyKGRhdGEuYnJlYWtwb2ludCk7XG5cdFx0ZGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChkYXRhLmFjdGlvbkJhcik7XG5cdFx0Y29uc3QgYmFkZ2VDb250YWluZXIgPSBkb20uYXBwZW5kKGRhdGEuYnJlYWtwb2ludCwgJCgnLmJhZGdlLWNvbnRhaW5lcicpKTtcblx0XHRkYXRhLmJhZGdlID0gZG9tLmFwcGVuZChiYWRnZUNvbnRhaW5lciwgJCgnc3Bhbi5saW5lLW51bWJlci5tb25hY28tY291bnQtYmFkZ2UnKSk7XG5cblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZXhjZXB0aW9uQnJlYWtwb2ludDogSUV4Y2VwdGlvbkJyZWFrcG9pbnQsIGluZGV4OiBudW1iZXIsIGRhdGE6IElFeGNlcHRpb25CcmVha3BvaW50VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0ZGF0YS5jb250ZXh0ID0gZXhjZXB0aW9uQnJlYWtwb2ludDtcblx0XHRkYXRhLm5hbWUudGV4dENvbnRlbnQgPSBleGNlcHRpb25CcmVha3BvaW50LmxhYmVsIHx8IGAke2V4Y2VwdGlvbkJyZWFrcG9pbnQuZmlsdGVyfSBleGNlcHRpb25zYDtcblx0XHRjb25zdCBleGNlcHRpb25CcmVha3BvaW50dGl0bGUgPSBleGNlcHRpb25CcmVha3BvaW50LnZlcmlmaWVkID8gKGV4Y2VwdGlvbkJyZWFrcG9pbnQuZGVzY3JpcHRpb24gfHwgZGF0YS5uYW1lLnRleHRDb250ZW50KSA6IGV4Y2VwdGlvbkJyZWFrcG9pbnQubWVzc2FnZSB8fCBsb2NhbGl6ZSgndW52ZXJpZmllZEV4Y2VwdGlvbkJyZWFrcG9pbnQnLCBcIlVudmVyaWZpZWQgRXhjZXB0aW9uIEJyZWFrcG9pbnRcIik7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBkYXRhLmJyZWFrcG9pbnQsIGV4Y2VwdGlvbkJyZWFrcG9pbnR0aXRsZSkpO1xuXHRcdGRhdGEuYnJlYWtwb2ludC5jbGFzc0xpc3QudG9nZ2xlKCdkaXNhYmxlZCcsICFleGNlcHRpb25CcmVha3BvaW50LnZlcmlmaWVkKTtcblx0XHRkYXRhLmNoZWNrYm94LmNoZWNrZWQgPSBleGNlcHRpb25CcmVha3BvaW50LmVuYWJsZWQ7XG5cdFx0ZGF0YS5jb25kaXRpb24udGV4dENvbnRlbnQgPSBleGNlcHRpb25CcmVha3BvaW50LmNvbmRpdGlvbiB8fCAnJztcblx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGRhdGEuY29uZGl0aW9uLCBsb2NhbGl6ZSgnZXhwcmVzc2lvbkNvbmRpdGlvbicsIFwiRXhwcmVzc2lvbiBjb25kaXRpb246IHswfVwiLCBleGNlcHRpb25CcmVha3BvaW50LmNvbmRpdGlvbikpKTtcblxuXHRcdGlmIChleGNlcHRpb25CcmVha3BvaW50Lm1vZGVMYWJlbCkge1xuXHRcdFx0ZGF0YS5iYWRnZS50ZXh0Q29udGVudCA9IGV4Y2VwdGlvbkJyZWFrcG9pbnQubW9kZUxhYmVsO1xuXHRcdFx0ZGF0YS5iYWRnZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGF0YS5iYWRnZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblxuXHRcdHRoaXMuYnJlYWtwb2ludFN1cHBvcnRzQ29uZGl0aW9uLnNldCgoZXhjZXB0aW9uQnJlYWtwb2ludCBhcyBFeGNlcHRpb25CcmVha3BvaW50KS5zdXBwb3J0c0NvbmRpdGlvbik7XG5cdFx0dGhpcy5icmVha3BvaW50SXRlbVR5cGUuc2V0KCdleGNlcHRpb25CcmVha3BvaW50Jyk7XG5cdFx0dGhpcy5icmVha3BvaW50SGFzTXVsdGlwbGVNb2Rlcy5zZXQodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50TW9kZXMoJ2V4Y2VwdGlvbicpLmxlbmd0aCA+IDEpO1xuXHRcdGNvbnN0IHsgcHJpbWFyeSB9ID0gZ2V0QWN0aW9uQmFyQWN0aW9ucyh0aGlzLm1lbnUuZ2V0QWN0aW9ucyh7IGFyZzogZXhjZXB0aW9uQnJlYWtwb2ludCwgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSksICdpbmxpbmUnKTtcblx0XHRkYXRhLmFjdGlvbkJhci5jbGVhcigpO1xuXHRcdGRhdGEuYWN0aW9uQmFyLnB1c2gocHJpbWFyeSwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0YnJlYWtwb2ludElkVG9BY3Rpb25CYXJEb21lTm9kZS5zZXQoZXhjZXB0aW9uQnJlYWtwb2ludC5nZXRJZCgpLCBkYXRhLmFjdGlvbkJhci5kb21Ob2RlKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElFeGNlcHRpb25CcmVha3BvaW50LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElFeGNlcHRpb25CcmVha3BvaW50VGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElFeGNlcHRpb25CcmVha3BvaW50VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIEZ1bmN0aW9uQnJlYWtwb2ludHNSZW5kZXJlciBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8RnVuY3Rpb25CcmVha3BvaW50LCBJRnVuY3Rpb25CcmVha3BvaW50VGVtcGxhdGVEYXRhPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBtZW51OiBJTWVudSxcblx0XHRwcml2YXRlIGJyZWFrcG9pbnRTdXBwb3J0c0NvbmRpdGlvbjogSUNvbnRleHRLZXk8Ym9vbGVhbj4sXG5cdFx0cHJpdmF0ZSBicmVha3BvaW50SXRlbVR5cGU6IElDb250ZXh0S2V5PHN0cmluZyB8IHVuZGVmaW5lZD4sXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2Vcblx0KSB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2Z1bmN0aW9uYnJlYWtwb2ludHMnO1xuXG5cdGdldCB0ZW1wbGF0ZUlkKCkge1xuXHRcdHJldHVybiBGdW5jdGlvbkJyZWFrcG9pbnRzUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUZ1bmN0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGF0YTogSUZ1bmN0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0ZGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMpO1xuXHRcdGRhdGEuYnJlYWtwb2ludCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcuYnJlYWtwb2ludCcpKTtcblxuXHRcdGRhdGEuaWNvbiA9ICQoJy5pY29uJyk7XG5cdFx0ZGF0YS5jaGVja2JveCA9IGNyZWF0ZUNoZWNrYm94KGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcyk7XG5cdFx0ZGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoZGF0YS5jaGVja2JveCwgJ2NoYW5nZScsIChlKSA9PiB7XG5cdFx0XHR0aGlzLmRlYnVnU2VydmljZS5lbmFibGVPckRpc2FibGVCcmVha3BvaW50cyghZGF0YS5jb250ZXh0LmVuYWJsZWQsIGRhdGEuY29udGV4dCk7XG5cdFx0fSkpO1xuXG5cdFx0ZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsIGRhdGEuaWNvbik7XG5cdFx0ZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsIGRhdGEuY2hlY2tib3gpO1xuXG5cdFx0ZGF0YS5uYW1lID0gZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsICQoJ3NwYW4ubmFtZScpKTtcblx0XHRkYXRhLmNvbmRpdGlvbiA9IGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCAkKCdzcGFuLmNvbmRpdGlvbicpKTtcblxuXHRcdGRhdGEuYWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcihkYXRhLmJyZWFrcG9pbnQpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZGF0YS5hY3Rpb25CYXIpO1xuXHRcdGNvbnN0IGJhZGdlQ29udGFpbmVyID0gZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsICQoJy5iYWRnZS1jb250YWluZXInKSk7XG5cdFx0ZGF0YS5iYWRnZSA9IGRvbS5hcHBlbmQoYmFkZ2VDb250YWluZXIsICQoJ3NwYW4ubGluZS1udW1iZXIubW9uYWNvLWNvdW50LWJhZGdlJykpO1xuXG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGZ1bmN0aW9uQnJlYWtwb2ludDogRnVuY3Rpb25CcmVha3BvaW50LCBfaW5kZXg6IG51bWJlciwgZGF0YTogSUZ1bmN0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEuY29udGV4dCA9IGZ1bmN0aW9uQnJlYWtwb2ludDtcblx0XHRkYXRhLm5hbWUudGV4dENvbnRlbnQgPSBmdW5jdGlvbkJyZWFrcG9pbnQubmFtZTtcblx0XHRjb25zdCB7IGljb24sIG1lc3NhZ2UgfSA9IGdldEJyZWFrcG9pbnRNZXNzYWdlQW5kSWNvbih0aGlzLmRlYnVnU2VydmljZS5zdGF0ZSwgdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5hcmVCcmVha3BvaW50c0FjdGl2YXRlZCgpLCBmdW5jdGlvbkJyZWFrcG9pbnQsIHRoaXMubGFiZWxTZXJ2aWNlLCB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpKTtcblx0XHRkYXRhLmljb24uY2xhc3NOYW1lID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb24pO1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgZGF0YS5pY29uLCBtZXNzYWdlID8gbWVzc2FnZSA6ICcnKSk7XG5cdFx0ZGF0YS5jaGVja2JveC5jaGVja2VkID0gZnVuY3Rpb25CcmVha3BvaW50LmVuYWJsZWQ7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBkYXRhLmJyZWFrcG9pbnQsIG1lc3NhZ2UgPyBtZXNzYWdlIDogJycpKTtcblx0XHRpZiAoZnVuY3Rpb25CcmVha3BvaW50LmNvbmRpdGlvbiAmJiBmdW5jdGlvbkJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uKSB7XG5cdFx0XHRkYXRhLmNvbmRpdGlvbi50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdleHByZXNzaW9uQW5kSGl0Q291bnQnLCBcIkNvbmRpdGlvbjogezB9IHwgSGl0IENvdW50OiB7MX1cIiwgZnVuY3Rpb25CcmVha3BvaW50LmNvbmRpdGlvbiwgZnVuY3Rpb25CcmVha3BvaW50LmhpdENvbmRpdGlvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRhdGEuY29uZGl0aW9uLnRleHRDb250ZW50ID0gZnVuY3Rpb25CcmVha3BvaW50LmNvbmRpdGlvbiB8fCBmdW5jdGlvbkJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uIHx8ICcnO1xuXHRcdH1cblxuXHRcdGlmIChmdW5jdGlvbkJyZWFrcG9pbnQubW9kZUxhYmVsKSB7XG5cdFx0XHRkYXRhLmJhZGdlLnRleHRDb250ZW50ID0gZnVuY3Rpb25CcmVha3BvaW50Lm1vZGVMYWJlbDtcblx0XHRcdGRhdGEuYmFkZ2Uuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRhdGEuYmFkZ2Uuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR9XG5cblx0XHQvLyBNYXJrIGZ1bmN0aW9uIGJyZWFrcG9pbnRzIGFzIGRpc2FibGVkIGlmIGRlYWN0aXZhdGVkIG9yIGlmIGRlYnVnIHR5cGUgZG9lcyBub3Qgc3VwcG9ydCB0aGVtICM5MDk5XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTZXNzaW9uO1xuXHRcdGRhdGEuYnJlYWtwb2ludC5jbGFzc0xpc3QudG9nZ2xlKCdkaXNhYmxlZCcsIChzZXNzaW9uICYmICFzZXNzaW9uLmNhcGFiaWxpdGllcy5zdXBwb3J0c0Z1bmN0aW9uQnJlYWtwb2ludHMpIHx8ICF0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCkpO1xuXHRcdGlmIChzZXNzaW9uICYmICFzZXNzaW9uLmNhcGFiaWxpdGllcy5zdXBwb3J0c0Z1bmN0aW9uQnJlYWtwb2ludHMpIHtcblx0XHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgZGF0YS5icmVha3BvaW50LCBsb2NhbGl6ZSgnZnVuY3Rpb25CcmVha3BvaW50c05vdFN1cHBvcnRlZCcsIFwiRnVuY3Rpb24gYnJlYWtwb2ludHMgYXJlIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBkZWJ1ZyB0eXBlXCIpKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5icmVha3BvaW50U3VwcG9ydHNDb25kaXRpb24uc2V0KCFzZXNzaW9uIHx8ICEhc2Vzc2lvbi5jYXBhYmlsaXRpZXMuc3VwcG9ydHNDb25kaXRpb25hbEJyZWFrcG9pbnRzKTtcblx0XHR0aGlzLmJyZWFrcG9pbnRJdGVtVHlwZS5zZXQoJ2Z1bmN0aW9uQnJlYWtwb2ludCcpO1xuXHRcdGNvbnN0IHsgcHJpbWFyeSB9ID0gZ2V0QWN0aW9uQmFyQWN0aW9ucyh0aGlzLm1lbnUuZ2V0QWN0aW9ucyh7IGFyZzogZnVuY3Rpb25CcmVha3BvaW50LCBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KSwgJ2lubGluZScpO1xuXHRcdGRhdGEuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0ZGF0YS5hY3Rpb25CYXIucHVzaChwcmltYXJ5LCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHRicmVha3BvaW50SWRUb0FjdGlvbkJhckRvbWVOb2RlLnNldChmdW5jdGlvbkJyZWFrcG9pbnQuZ2V0SWQoKSwgZGF0YS5hY3Rpb25CYXIuZG9tTm9kZSk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChlbGVtZW50OiBGdW5jdGlvbkJyZWFrcG9pbnQsIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUZ1bmN0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJRnVuY3Rpb25CcmVha3BvaW50VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIERhdGFCcmVha3BvaW50c1JlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxEYXRhQnJlYWtwb2ludCwgSURhdGFCcmVha3BvaW50VGVtcGxhdGVEYXRhPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBtZW51OiBJTWVudSxcblx0XHRwcml2YXRlIGJyZWFrcG9pbnRIYXNNdWx0aXBsZU1vZGVzOiBJQ29udGV4dEtleTxib29sZWFuPixcblx0XHRwcml2YXRlIGJyZWFrcG9pbnRTdXBwb3J0c0NvbmRpdGlvbjogSUNvbnRleHRLZXk8Ym9vbGVhbj4sXG5cdFx0cHJpdmF0ZSBicmVha3BvaW50SXRlbVR5cGU6IElDb250ZXh0S2V5PHN0cmluZyB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSBicmVha3BvaW50SXNEYXRhQnl0ZXM6IElDb250ZXh0S2V5PGJvb2xlYW4gfCB1bmRlZmluZWQ+LFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlXG5cdCkge1xuXHRcdC8vIG5vb3Bcblx0fVxuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdkYXRhYnJlYWtwb2ludHMnO1xuXG5cdGdldCB0ZW1wbGF0ZUlkKCkge1xuXHRcdHJldHVybiBEYXRhQnJlYWtwb2ludHNSZW5kZXJlci5JRDtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRGF0YUJyZWFrcG9pbnRUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGRhdGE6IElEYXRhQnJlYWtwb2ludFRlbXBsYXRlRGF0YSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0ZGF0YS5icmVha3BvaW50ID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5icmVha3BvaW50JykpO1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKGRhdGEuZWxlbWVudERpc3Bvc2FibGVzKTtcblxuXHRcdGRhdGEuaWNvbiA9ICQoJy5pY29uJyk7XG5cdFx0ZGF0YS5jaGVja2JveCA9IGNyZWF0ZUNoZWNrYm94KGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcyk7XG5cdFx0ZGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoZGF0YS5jaGVja2JveCwgJ2NoYW5nZScsIChlKSA9PiB7XG5cdFx0XHR0aGlzLmRlYnVnU2VydmljZS5lbmFibGVPckRpc2FibGVCcmVha3BvaW50cyghZGF0YS5jb250ZXh0LmVuYWJsZWQsIGRhdGEuY29udGV4dCk7XG5cdFx0fSkpO1xuXG5cdFx0ZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsIGRhdGEuaWNvbik7XG5cdFx0ZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsIGRhdGEuY2hlY2tib3gpO1xuXG5cdFx0ZGF0YS5uYW1lID0gZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsICQoJ3NwYW4ubmFtZScpKTtcblx0XHRkYXRhLmFjY2Vzc1R5cGUgPSBkb20uYXBwZW5kKGRhdGEuYnJlYWtwb2ludCwgJCgnc3Bhbi5hY2Nlc3MtdHlwZScpKTtcblx0XHRkYXRhLmNvbmRpdGlvbiA9IGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCAkKCdzcGFuLmNvbmRpdGlvbicpKTtcblxuXHRcdGRhdGEuYWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcihkYXRhLmJyZWFrcG9pbnQpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZGF0YS5hY3Rpb25CYXIpO1xuXHRcdGNvbnN0IGJhZGdlQ29udGFpbmVyID0gZG9tLmFwcGVuZChkYXRhLmJyZWFrcG9pbnQsICQoJy5iYWRnZS1jb250YWluZXInKSk7XG5cdFx0ZGF0YS5iYWRnZSA9IGRvbS5hcHBlbmQoYmFkZ2VDb250YWluZXIsICQoJ3NwYW4ubGluZS1udW1iZXIubW9uYWNvLWNvdW50LWJhZGdlJykpO1xuXG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGRhdGFCcmVha3BvaW50OiBEYXRhQnJlYWtwb2ludCwgX2luZGV4OiBudW1iZXIsIGRhdGE6IElEYXRhQnJlYWtwb2ludFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEuY29udGV4dCA9IGRhdGFCcmVha3BvaW50O1xuXHRcdGRhdGEubmFtZS50ZXh0Q29udGVudCA9IGRhdGFCcmVha3BvaW50LmRlc2NyaXB0aW9uO1xuXHRcdGNvbnN0IHsgaWNvbiwgbWVzc2FnZSB9ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlLCB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCksIGRhdGFCcmVha3BvaW50LCB0aGlzLmxhYmVsU2VydmljZSwgdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKSk7XG5cdFx0ZGF0YS5pY29uLmNsYXNzTmFtZSA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShpY29uKTtcblx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGRhdGEuaWNvbiwgbWVzc2FnZSA/IG1lc3NhZ2UgOiAnJykpO1xuXHRcdGRhdGEuY2hlY2tib3guY2hlY2tlZCA9IGRhdGFCcmVha3BvaW50LmVuYWJsZWQ7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBkYXRhLmJyZWFrcG9pbnQsIG1lc3NhZ2UgPyBtZXNzYWdlIDogJycpKTtcblxuXHRcdGlmIChkYXRhQnJlYWtwb2ludC5tb2RlTGFiZWwpIHtcblx0XHRcdGRhdGEuYmFkZ2UudGV4dENvbnRlbnQgPSBkYXRhQnJlYWtwb2ludC5tb2RlTGFiZWw7XG5cdFx0XHRkYXRhLmJhZGdlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLmJhZGdlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fVxuXG5cdFx0Ly8gTWFyayBkYXRhIGJyZWFrcG9pbnRzIGFzIGRpc2FibGVkIGlmIGRlYWN0aXZhdGVkIG9yIGlmIGRlYnVnIHR5cGUgZG9lcyBub3Qgc3VwcG9ydCB0aGVtXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTZXNzaW9uO1xuXHRcdGRhdGEuYnJlYWtwb2ludC5jbGFzc0xpc3QudG9nZ2xlKCdkaXNhYmxlZCcsIChzZXNzaW9uICYmICFzZXNzaW9uLmNhcGFiaWxpdGllcy5zdXBwb3J0c0RhdGFCcmVha3BvaW50cykgfHwgIXRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuYXJlQnJlYWtwb2ludHNBY3RpdmF0ZWQoKSk7XG5cdFx0aWYgKHNlc3Npb24gJiYgIXNlc3Npb24uY2FwYWJpbGl0aWVzLnN1cHBvcnRzRGF0YUJyZWFrcG9pbnRzKSB7XG5cdFx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGRhdGEuYnJlYWtwb2ludCwgbG9jYWxpemUoJ2RhdGFCcmVha3BvaW50c05vdFN1cHBvcnRlZCcsIFwiRGF0YSBicmVha3BvaW50cyBhcmUgbm90IHN1cHBvcnRlZCBieSB0aGlzIGRlYnVnIHR5cGVcIikpKTtcblx0XHR9XG5cdFx0aWYgKGRhdGFCcmVha3BvaW50LmFjY2Vzc1R5cGUpIHtcblx0XHRcdGNvbnN0IGFjY2Vzc1R5cGUgPSBkYXRhQnJlYWtwb2ludC5hY2Nlc3NUeXBlID09PSAncmVhZCcgPyBsb2NhbGl6ZSgncmVhZCcsIFwiUmVhZFwiKSA6IGRhdGFCcmVha3BvaW50LmFjY2Vzc1R5cGUgPT09ICd3cml0ZScgPyBsb2NhbGl6ZSgnd3JpdGUnLCBcIldyaXRlXCIpIDogbG9jYWxpemUoJ2FjY2VzcycsIFwiQWNjZXNzXCIpO1xuXHRcdFx0ZGF0YS5hY2Nlc3NUeXBlLnRleHRDb250ZW50ID0gYWNjZXNzVHlwZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGF0YS5hY2Nlc3NUeXBlLnRleHRDb250ZW50ID0gJyc7XG5cdFx0fVxuXHRcdGlmIChkYXRhQnJlYWtwb2ludC5jb25kaXRpb24gJiYgZGF0YUJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uKSB7XG5cdFx0XHRkYXRhLmNvbmRpdGlvbi50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdleHByZXNzaW9uQW5kSGl0Q291bnQnLCBcIkNvbmRpdGlvbjogezB9IHwgSGl0IENvdW50OiB7MX1cIiwgZGF0YUJyZWFrcG9pbnQuY29uZGl0aW9uLCBkYXRhQnJlYWtwb2ludC5oaXRDb25kaXRpb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLmNvbmRpdGlvbi50ZXh0Q29udGVudCA9IGRhdGFCcmVha3BvaW50LmNvbmRpdGlvbiB8fCBkYXRhQnJlYWtwb2ludC5oaXRDb25kaXRpb24gfHwgJyc7XG5cdFx0fVxuXG5cdFx0dGhpcy5icmVha3BvaW50U3VwcG9ydHNDb25kaXRpb24uc2V0KCFzZXNzaW9uIHx8ICEhc2Vzc2lvbi5jYXBhYmlsaXRpZXMuc3VwcG9ydHNDb25kaXRpb25hbEJyZWFrcG9pbnRzKTtcblx0XHR0aGlzLmJyZWFrcG9pbnRIYXNNdWx0aXBsZU1vZGVzLnNldCh0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldEJyZWFrcG9pbnRNb2RlcygnZGF0YScpLmxlbmd0aCA+IDEpO1xuXHRcdHRoaXMuYnJlYWtwb2ludEl0ZW1UeXBlLnNldCgnZGF0YUJyZWFrcG9pbnQnKTtcblx0XHR0aGlzLmJyZWFrcG9pbnRJc0RhdGFCeXRlcy5zZXQoZGF0YUJyZWFrcG9pbnQuc3JjLnR5cGUgPT09IERhdGFCcmVha3BvaW50U2V0VHlwZS5BZGRyZXNzKTtcblx0XHRjb25zdCB7IHByaW1hcnkgfSA9IGdldEFjdGlvbkJhckFjdGlvbnModGhpcy5tZW51LmdldEFjdGlvbnMoeyBhcmc6IGRhdGFCcmVha3BvaW50LCBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KSwgJ2lubGluZScpO1xuXHRcdGRhdGEuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0ZGF0YS5hY3Rpb25CYXIucHVzaChwcmltYXJ5LCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHRicmVha3BvaW50SWRUb0FjdGlvbkJhckRvbWVOb2RlLnNldChkYXRhQnJlYWtwb2ludC5nZXRJZCgpLCBkYXRhLmFjdGlvbkJhci5kb21Ob2RlKTtcblx0XHR0aGlzLmJyZWFrcG9pbnRJc0RhdGFCeXRlcy5yZXNldCgpO1xuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoZWxlbWVudDogRGF0YUJyZWFrcG9pbnQsIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSURhdGFCcmVha3BvaW50VGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElCYXNlQnJlYWtwb2ludFdpdGhJY29uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIEluc3RydWN0aW9uQnJlYWtwb2ludHNSZW5kZXJlciBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8SUluc3RydWN0aW9uQnJlYWtwb2ludCwgSUluc3RydWN0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YT4ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlXG5cdCkge1xuXHRcdC8vIG5vb3Bcblx0fVxuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdpbnN0cnVjdGlvbkJyZWFrcG9pbnRzJztcblxuXHRnZXQgdGVtcGxhdGVJZCgpIHtcblx0XHRyZXR1cm4gSW5zdHJ1Y3Rpb25CcmVha3BvaW50c1JlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGRhdGE6IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRUZW1wbGF0ZURhdGEgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKGRhdGEuZWxlbWVudERpc3Bvc2FibGVzKTtcblx0XHRkYXRhLmJyZWFrcG9pbnQgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLmJyZWFrcG9pbnQnKSk7XG5cblx0XHRkYXRhLmljb24gPSAkKCcuaWNvbicpO1xuXHRcdGRhdGEuY2hlY2tib3ggPSBjcmVhdGVDaGVja2JveChkYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMpO1xuXHRcdGRhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKGRhdGEuY2hlY2tib3gsICdjaGFuZ2UnLCAoZSkgPT4ge1xuXHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHMoIWRhdGEuY29udGV4dC5lbmFibGVkLCBkYXRhLmNvbnRleHQpO1xuXHRcdH0pKTtcblxuXHRcdGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCBkYXRhLmljb24pO1xuXHRcdGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCBkYXRhLmNoZWNrYm94KTtcblxuXHRcdGRhdGEubmFtZSA9IGRvbS5hcHBlbmQoZGF0YS5icmVha3BvaW50LCAkKCdzcGFuLm5hbWUnKSk7XG5cblx0XHRkYXRhLmFkZHJlc3MgPSBkb20uYXBwZW5kKGRhdGEuYnJlYWtwb2ludCwgJCgnc3Bhbi5maWxlLXBhdGgnKSk7XG5cdFx0ZGF0YS5hY3Rpb25CYXIgPSBuZXcgQWN0aW9uQmFyKGRhdGEuYnJlYWtwb2ludCk7XG5cdFx0ZGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChkYXRhLmFjdGlvbkJhcik7XG5cdFx0Y29uc3QgYmFkZ2VDb250YWluZXIgPSBkb20uYXBwZW5kKGRhdGEuYnJlYWtwb2ludCwgJCgnLmJhZGdlLWNvbnRhaW5lcicpKTtcblx0XHRkYXRhLmJhZGdlID0gZG9tLmFwcGVuZChiYWRnZUNvbnRhaW5lciwgJCgnc3Bhbi5saW5lLW51bWJlci5tb25hY28tY291bnQtYmFkZ2UnKSk7XG5cblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoYnJlYWtwb2ludDogSUluc3RydWN0aW9uQnJlYWtwb2ludCwgaW5kZXg6IG51bWJlciwgZGF0YTogSUluc3RydWN0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEuY29udGV4dCA9IGJyZWFrcG9pbnQ7XG5cdFx0ZGF0YS5icmVha3BvaW50LmNsYXNzTGlzdC50b2dnbGUoJ2Rpc2FibGVkJywgIXRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuYXJlQnJlYWtwb2ludHNBY3RpdmF0ZWQoKSk7XG5cblx0XHRkYXRhLm5hbWUudGV4dENvbnRlbnQgPSAnMHgnICsgYnJlYWtwb2ludC5hZGRyZXNzLnRvU3RyaW5nKDE2KTtcblx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGRhdGEubmFtZSwgYERlY2ltYWwgYWRkcmVzczogYnJlYWtwb2ludC5hZGRyZXNzLnRvU3RyaW5nKClgKSk7XG5cdFx0ZGF0YS5jaGVja2JveC5jaGVja2VkID0gYnJlYWtwb2ludC5lbmFibGVkO1xuXG5cdFx0Y29uc3QgeyBtZXNzYWdlLCBpY29uIH0gPSBnZXRCcmVha3BvaW50TWVzc2FnZUFuZEljb24odGhpcy5kZWJ1Z1NlcnZpY2Uuc3RhdGUsIHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuYXJlQnJlYWtwb2ludHNBY3RpdmF0ZWQoKSwgYnJlYWtwb2ludCwgdGhpcy5sYWJlbFNlcnZpY2UsIHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkpO1xuXHRcdGRhdGEuaWNvbi5jbGFzc05hbWUgPSBUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbik7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBkYXRhLmJyZWFrcG9pbnQsIGJyZWFrcG9pbnQubWVzc2FnZSB8fCBtZXNzYWdlIHx8ICcnKSk7XG5cblx0XHRjb25zdCBkZWJ1Z0FjdGl2ZSA9IHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlID09PSBTdGF0ZS5SdW5uaW5nIHx8IHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlID09PSBTdGF0ZS5TdG9wcGVkO1xuXHRcdGlmIChkZWJ1Z0FjdGl2ZSAmJiAhYnJlYWtwb2ludC52ZXJpZmllZCkge1xuXHRcdFx0ZGF0YS5icmVha3BvaW50LmNsYXNzTGlzdC5hZGQoJ2Rpc2FibGVkJyk7XG5cdFx0fVxuXG5cdFx0aWYgKGJyZWFrcG9pbnQubW9kZUxhYmVsKSB7XG5cdFx0XHRkYXRhLmJhZGdlLnRleHRDb250ZW50ID0gYnJlYWtwb2ludC5tb2RlTGFiZWw7XG5cdFx0XHRkYXRhLmJhZGdlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLmJhZGdlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fVxuXHR9XG5cblxuXHRkaXNwb3NlRWxlbWVudChlbGVtZW50OiBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRUZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSUluc3RydWN0aW9uQnJlYWtwb2ludFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBGdW5jdGlvbkJyZWFrcG9pbnRJbnB1dFJlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxJRnVuY3Rpb25CcmVha3BvaW50LCBJRnVuY3Rpb25CcmVha3BvaW50SW5wdXRUZW1wbGF0ZURhdGE+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHZpZXc6IEJyZWFrcG9pbnRzVmlldyxcblx0XHRwcml2YXRlIGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRwcml2YXRlIGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRwcml2YXRlIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZVxuXHQpIHsgfVxuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdmdW5jdGlvbmJyZWFrcG9pbnRpbnB1dCc7XG5cblx0Z2V0IHRlbXBsYXRlSWQoKSB7XG5cdFx0cmV0dXJuIEZ1bmN0aW9uQnJlYWtwb2ludElucHV0UmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUZ1bmN0aW9uQnJlYWtwb2ludElucHV0VGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCB0ZW1wbGF0ZTogSUZ1bmN0aW9uQnJlYWtwb2ludElucHV0VGVtcGxhdGVEYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRjb25zdCB0b0Rpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBicmVha3BvaW50ID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5icmVha3BvaW50JykpO1xuXHRcdHRlbXBsYXRlLmljb24gPSAkKCcuaWNvbicpO1xuXHRcdHRlbXBsYXRlLmNoZWNrYm94ID0gY3JlYXRlQ2hlY2tib3godG9EaXNwb3NlKTtcblxuXHRcdGRvbS5hcHBlbmQoYnJlYWtwb2ludCwgdGVtcGxhdGUuaWNvbik7XG5cdFx0ZG9tLmFwcGVuZChicmVha3BvaW50LCB0ZW1wbGF0ZS5jaGVja2JveCk7XG5cdFx0dGhpcy52aWV3LmJyZWFrcG9pbnRJbnB1dEZvY3VzZWQuc2V0KHRydWUpO1xuXHRcdGNvbnN0IGlucHV0Qm94Q29udGFpbmVyID0gZG9tLmFwcGVuZChicmVha3BvaW50LCAkKCcuaW5wdXRCb3hDb250YWluZXInKSk7XG5cblxuXHRcdGNvbnN0IGlucHV0Qm94ID0gbmV3IElucHV0Qm94KGlucHV0Qm94Q29udGFpbmVyLCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwgeyBpbnB1dEJveFN0eWxlczogZGVmYXVsdElucHV0Qm94U3R5bGVzIH0pO1xuXG5cdFx0dG9EaXNwb3NlLmFkZChpbnB1dEJveCk7XG5cblx0XHRjb25zdCB3cmFwVXAgPSAoc3VjY2VzczogYm9vbGVhbikgPT4ge1xuXHRcdFx0dGVtcGxhdGUudXBkYXRpbmcgPSB0cnVlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy52aWV3LmJyZWFrcG9pbnRJbnB1dEZvY3VzZWQuc2V0KGZhbHNlKTtcblx0XHRcdFx0Y29uc3QgaWQgPSB0ZW1wbGF0ZS5icmVha3BvaW50LmdldElkKCk7XG5cblx0XHRcdFx0aWYgKHN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRpZiAodGVtcGxhdGUudHlwZSA9PT0gJ25hbWUnKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS51cGRhdGVGdW5jdGlvbkJyZWFrcG9pbnQoaWQsIHsgbmFtZTogaW5wdXRCb3gudmFsdWUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh0ZW1wbGF0ZS50eXBlID09PSAnY29uZGl0aW9uJykge1xuXHRcdFx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UudXBkYXRlRnVuY3Rpb25CcmVha3BvaW50KGlkLCB7IGNvbmRpdGlvbjogaW5wdXRCb3gudmFsdWUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh0ZW1wbGF0ZS50eXBlID09PSAnaGl0Q291bnQnKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS51cGRhdGVGdW5jdGlvbkJyZWFrcG9pbnQoaWQsIHsgaGl0Q29uZGl0aW9uOiBpbnB1dEJveC52YWx1ZSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKHRlbXBsYXRlLnR5cGUgPT09ICduYW1lJyAmJiAhdGVtcGxhdGUuYnJlYWtwb2ludC5uYW1lKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS5yZW1vdmVGdW5jdGlvbkJyZWFrcG9pbnRzKGlkKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy52aWV3LnJlbmRlcklucHV0Qm94KHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0ZW1wbGF0ZS51cGRhdGluZyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0b0Rpc3Bvc2UuYWRkKGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihpbnB1dEJveC5pbnB1dEVsZW1lbnQsICdrZXlkb3duJywgKGU6IElLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBpc0VzY2FwZSA9IGUuZXF1YWxzKEtleUNvZGUuRXNjYXBlKTtcblx0XHRcdGNvbnN0IGlzRW50ZXIgPSBlLmVxdWFscyhLZXlDb2RlLkVudGVyKTtcblx0XHRcdGlmIChpc0VzY2FwZSB8fCBpc0VudGVyKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0d3JhcFVwKGlzRW50ZXIpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0b0Rpc3Bvc2UuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoaW5wdXRCb3guaW5wdXRFbGVtZW50LCAnYmx1cicsICgpID0+IHtcblx0XHRcdGlmICghdGVtcGxhdGUudXBkYXRpbmcpIHtcblx0XHRcdFx0d3JhcFVwKCEhaW5wdXRCb3gudmFsdWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRlbXBsYXRlLmlucHV0Qm94ID0gaW5wdXRCb3g7XG5cdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRlbXBsYXRlLnRlbXBsYXRlRGlzcG9zYWJsZXMgPSB0b0Rpc3Bvc2U7XG5cdFx0dGVtcGxhdGUudGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQodGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzKTtcblx0XHRyZXR1cm4gdGVtcGxhdGU7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGZ1bmN0aW9uQnJlYWtwb2ludDogRnVuY3Rpb25CcmVha3BvaW50LCBfaW5kZXg6IG51bWJlciwgZGF0YTogSUZ1bmN0aW9uQnJlYWtwb2ludElucHV0VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0ZGF0YS5icmVha3BvaW50ID0gZnVuY3Rpb25CcmVha3BvaW50O1xuXHRcdGRhdGEudHlwZSA9IHRoaXMudmlldy5pbnB1dEJveERhdGE/LnR5cGUgfHwgJ25hbWUnOyAvLyBJZiB0aGVyZSBpcyBubyB0eXBlIHNldCB0YWtlIHRoZSAnbmFtZScgYXMgdGhlIGRlZmF1bHRcblx0XHRjb25zdCB7IGljb24sIG1lc3NhZ2UgfSA9IGdldEJyZWFrcG9pbnRNZXNzYWdlQW5kSWNvbih0aGlzLmRlYnVnU2VydmljZS5zdGF0ZSwgdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5hcmVCcmVha3BvaW50c0FjdGl2YXRlZCgpLCBmdW5jdGlvbkJyZWFrcG9pbnQsIHRoaXMubGFiZWxTZXJ2aWNlLCB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpKTtcblxuXHRcdGRhdGEuaWNvbi5jbGFzc05hbWUgPSBUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbik7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBkYXRhLmljb24sIG1lc3NhZ2UgPyBtZXNzYWdlIDogJycpKTtcblx0XHRkYXRhLmNoZWNrYm94LmNoZWNrZWQgPSBmdW5jdGlvbkJyZWFrcG9pbnQuZW5hYmxlZDtcblx0XHRkYXRhLmNoZWNrYm94LmRpc2FibGVkID0gdHJ1ZTtcblx0XHRkYXRhLmlucHV0Qm94LnZhbHVlID0gZnVuY3Rpb25CcmVha3BvaW50Lm5hbWUgfHwgJyc7XG5cblx0XHRsZXQgcGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnZnVuY3Rpb25CcmVha3BvaW50UGxhY2Vob2xkZXInLCBcIkZ1bmN0aW9uIHRvIGJyZWFrIG9uXCIpO1xuXHRcdGxldCBhcmlhTGFiZWwgPSBsb2NhbGl6ZSgnZnVuY3Rpb25CcmVha1BvaW50SW5wdXRBcmlhTGFiZWwnLCBcIlR5cGUgZnVuY3Rpb24gYnJlYWtwb2ludC5cIik7XG5cdFx0aWYgKGRhdGEudHlwZSA9PT0gJ2NvbmRpdGlvbicpIHtcblx0XHRcdGRhdGEuaW5wdXRCb3gudmFsdWUgPSBmdW5jdGlvbkJyZWFrcG9pbnQuY29uZGl0aW9uIHx8ICcnO1xuXHRcdFx0cGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnZnVuY3Rpb25CcmVha3BvaW50RXhwcmVzc2lvblBsYWNlaG9sZGVyJywgXCJCcmVhayB3aGVuIGV4cHJlc3Npb24gZXZhbHVhdGVzIHRvIHRydWVcIik7XG5cdFx0XHRhcmlhTGFiZWwgPSBsb2NhbGl6ZSgnZnVuY3Rpb25CcmVha1BvaW50RXhwcmVzaW9uQXJpYUxhYmVsJywgXCJUeXBlIGV4cHJlc3Npb24uIEZ1bmN0aW9uIGJyZWFrcG9pbnQgd2lsbCBicmVhayB3aGVuIGV4cHJlc3Npb24gZXZhbHVhdGVzIHRvIHRydWVcIik7XG5cdFx0fSBlbHNlIGlmIChkYXRhLnR5cGUgPT09ICdoaXRDb3VudCcpIHtcblx0XHRcdGRhdGEuaW5wdXRCb3gudmFsdWUgPSBmdW5jdGlvbkJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uIHx8ICcnO1xuXHRcdFx0cGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnZnVuY3Rpb25CcmVha3BvaW50SGl0Q291bnRQbGFjZWhvbGRlcicsIFwiQnJlYWsgd2hlbiBoaXQgY291bnQgaXMgbWV0XCIpO1xuXHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoJ2Z1bmN0aW9uQnJlYWtQb2ludEhpdENvdW50QXJpYUxhYmVsJywgXCJUeXBlIGhpdCBjb3VudC4gRnVuY3Rpb24gYnJlYWtwb2ludCB3aWxsIGJyZWFrIHdoZW4gaGl0IGNvdW50IGlzIG1ldC5cIik7XG5cdFx0fVxuXHRcdGRhdGEuaW5wdXRCb3guc2V0QXJpYUxhYmVsKGFyaWFMYWJlbCk7XG5cdFx0ZGF0YS5pbnB1dEJveC5zZXRQbGFjZUhvbGRlcihwbGFjZWhvbGRlcik7XG5cblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGRhdGEuaW5wdXRCb3guZm9jdXMoKTtcblx0XHRcdGRhdGEuaW5wdXRCb3guc2VsZWN0KCk7XG5cdFx0fSwgMCk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChlbGVtZW50OiBJRnVuY3Rpb25CcmVha3BvaW50LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElGdW5jdGlvbkJyZWFrcG9pbnRJbnB1dFRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJRnVuY3Rpb25CcmVha3BvaW50SW5wdXRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgRGF0YUJyZWFrcG9pbnRJbnB1dFJlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxJRGF0YUJyZWFrcG9pbnQsIElEYXRhQnJlYWtwb2ludElucHV0VGVtcGxhdGVEYXRhPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSB2aWV3OiBCcmVha3BvaW50c1ZpZXcsXG5cdFx0cHJpdmF0ZSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2Vcblx0KSB7IH1cblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZGF0YWJyZWFrcG9pbnRpbnB1dCc7XG5cblx0Z2V0IHRlbXBsYXRlSWQoKSB7XG5cdFx0cmV0dXJuIERhdGFCcmVha3BvaW50SW5wdXRSZW5kZXJlci5JRDtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRGF0YUJyZWFrcG9pbnRJbnB1dFRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgdGVtcGxhdGU6IElEYXRhQnJlYWtwb2ludElucHV0VGVtcGxhdGVEYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRjb25zdCB0b0Rpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBicmVha3BvaW50ID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5icmVha3BvaW50JykpO1xuXHRcdHRlbXBsYXRlLmljb24gPSAkKCcuaWNvbicpO1xuXHRcdHRlbXBsYXRlLmNoZWNrYm94ID0gY3JlYXRlQ2hlY2tib3godG9EaXNwb3NlKTtcblxuXHRcdGRvbS5hcHBlbmQoYnJlYWtwb2ludCwgdGVtcGxhdGUuaWNvbik7XG5cdFx0ZG9tLmFwcGVuZChicmVha3BvaW50LCB0ZW1wbGF0ZS5jaGVja2JveCk7XG5cdFx0dGhpcy52aWV3LmJyZWFrcG9pbnRJbnB1dEZvY3VzZWQuc2V0KHRydWUpO1xuXHRcdGNvbnN0IGlucHV0Qm94Q29udGFpbmVyID0gZG9tLmFwcGVuZChicmVha3BvaW50LCAkKCcuaW5wdXRCb3hDb250YWluZXInKSk7XG5cblxuXHRcdGNvbnN0IGlucHV0Qm94ID0gbmV3IElucHV0Qm94KGlucHV0Qm94Q29udGFpbmVyLCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwgeyBpbnB1dEJveFN0eWxlczogZGVmYXVsdElucHV0Qm94U3R5bGVzIH0pO1xuXHRcdHRvRGlzcG9zZS5hZGQoaW5wdXRCb3gpO1xuXG5cdFx0Y29uc3Qgd3JhcFVwID0gKHN1Y2Nlc3M6IGJvb2xlYW4pID0+IHtcblx0XHRcdHRlbXBsYXRlLnVwZGF0aW5nID0gdHJ1ZTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMudmlldy5icmVha3BvaW50SW5wdXRGb2N1c2VkLnNldChmYWxzZSk7XG5cdFx0XHRcdGNvbnN0IGlkID0gdGVtcGxhdGUuYnJlYWtwb2ludC5nZXRJZCgpO1xuXG5cdFx0XHRcdGlmIChzdWNjZXNzKSB7XG5cdFx0XHRcdFx0aWYgKHRlbXBsYXRlLnR5cGUgPT09ICdjb25kaXRpb24nKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS51cGRhdGVEYXRhQnJlYWtwb2ludChpZCwgeyBjb25kaXRpb246IGlucHV0Qm94LnZhbHVlIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGVtcGxhdGUudHlwZSA9PT0gJ2hpdENvdW50Jykge1xuXHRcdFx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UudXBkYXRlRGF0YUJyZWFrcG9pbnQoaWQsIHsgaGl0Q29uZGl0aW9uOiBpbnB1dEJveC52YWx1ZSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy52aWV3LnJlbmRlcklucHV0Qm94KHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRlbXBsYXRlLnVwZGF0aW5nID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRvRGlzcG9zZS5hZGQoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKGlucHV0Qm94LmlucHV0RWxlbWVudCwgJ2tleWRvd24nLCAoZTogSUtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IGlzRXNjYXBlID0gZS5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpO1xuXHRcdFx0Y29uc3QgaXNFbnRlciA9IGUuZXF1YWxzKEtleUNvZGUuRW50ZXIpO1xuXHRcdFx0aWYgKGlzRXNjYXBlIHx8IGlzRW50ZXIpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHR3cmFwVXAoaXNFbnRlcik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRvRGlzcG9zZS5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihpbnB1dEJveC5pbnB1dEVsZW1lbnQsICdibHVyJywgKCkgPT4ge1xuXHRcdFx0aWYgKCF0ZW1wbGF0ZS51cGRhdGluZykge1xuXHRcdFx0XHR3cmFwVXAoISFpbnB1dEJveC52YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGVtcGxhdGUuaW5wdXRCb3ggPSBpbnB1dEJveDtcblx0XHR0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGVtcGxhdGUudGVtcGxhdGVEaXNwb3NhYmxlcyA9IHRvRGlzcG9zZTtcblx0XHR0ZW1wbGF0ZS50ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0ZW1wbGF0ZS5lbGVtZW50RGlzcG9zYWJsZXMpO1xuXHRcdHJldHVybiB0ZW1wbGF0ZTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZGF0YUJyZWFrcG9pbnQ6IERhdGFCcmVha3BvaW50LCBfaW5kZXg6IG51bWJlciwgZGF0YTogSURhdGFCcmVha3BvaW50SW5wdXRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRkYXRhLmJyZWFrcG9pbnQgPSBkYXRhQnJlYWtwb2ludDtcblx0XHRkYXRhLnR5cGUgPSB0aGlzLnZpZXcuaW5wdXRCb3hEYXRhPy50eXBlIHx8ICdjb25kaXRpb24nOyAvLyBJZiB0aGVyZSBpcyBubyB0eXBlIHNldCB0YWtlIHRoZSAnY29uZGl0aW9uJyBhcyB0aGUgZGVmYXVsdFxuXHRcdGNvbnN0IHsgaWNvbiwgbWVzc2FnZSB9ID0gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlLCB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCksIGRhdGFCcmVha3BvaW50LCB0aGlzLmxhYmVsU2VydmljZSwgdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKSk7XG5cblx0XHRkYXRhLmljb24uY2xhc3NOYW1lID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb24pO1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgZGF0YS5pY29uLCBtZXNzYWdlID8/ICcnKSk7XG5cdFx0ZGF0YS5jaGVja2JveC5jaGVja2VkID0gZGF0YUJyZWFrcG9pbnQuZW5hYmxlZDtcblx0XHRkYXRhLmNoZWNrYm94LmRpc2FibGVkID0gdHJ1ZTtcblx0XHRkYXRhLmlucHV0Qm94LnZhbHVlID0gJyc7XG5cdFx0bGV0IHBsYWNlaG9sZGVyID0gJyc7XG5cdFx0bGV0IGFyaWFMYWJlbCA9ICcnO1xuXHRcdGlmIChkYXRhLnR5cGUgPT09ICdjb25kaXRpb24nKSB7XG5cdFx0XHRkYXRhLmlucHV0Qm94LnZhbHVlID0gZGF0YUJyZWFrcG9pbnQuY29uZGl0aW9uIHx8ICcnO1xuXHRcdFx0cGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnZGF0YUJyZWFrcG9pbnRFeHByZXNzaW9uUGxhY2Vob2xkZXInLCBcIkJyZWFrIHdoZW4gZXhwcmVzc2lvbiBldmFsdWF0ZXMgdG8gdHJ1ZVwiKTtcblx0XHRcdGFyaWFMYWJlbCA9IGxvY2FsaXplKCdkYXRhQnJlYWtQb2ludEV4cHJlc2lvbkFyaWFMYWJlbCcsIFwiVHlwZSBleHByZXNzaW9uLiBEYXRhIGJyZWFrcG9pbnQgd2lsbCBicmVhayB3aGVuIGV4cHJlc3Npb24gZXZhbHVhdGVzIHRvIHRydWVcIik7XG5cdFx0fSBlbHNlIGlmIChkYXRhLnR5cGUgPT09ICdoaXRDb3VudCcpIHtcblx0XHRcdGRhdGEuaW5wdXRCb3gudmFsdWUgPSBkYXRhQnJlYWtwb2ludC5oaXRDb25kaXRpb24gfHwgJyc7XG5cdFx0XHRwbGFjZWhvbGRlciA9IGxvY2FsaXplKCdkYXRhQnJlYWtwb2ludEhpdENvdW50UGxhY2Vob2xkZXInLCBcIkJyZWFrIHdoZW4gaGl0IGNvdW50IGlzIG1ldFwiKTtcblx0XHRcdGFyaWFMYWJlbCA9IGxvY2FsaXplKCdkYXRhQnJlYWtQb2ludEhpdENvdW50QXJpYUxhYmVsJywgXCJUeXBlIGhpdCBjb3VudC4gRGF0YSBicmVha3BvaW50IHdpbGwgYnJlYWsgd2hlbiBoaXQgY291bnQgaXMgbWV0LlwiKTtcblx0XHR9XG5cdFx0ZGF0YS5pbnB1dEJveC5zZXRBcmlhTGFiZWwoYXJpYUxhYmVsKTtcblx0XHRkYXRhLmlucHV0Qm94LnNldFBsYWNlSG9sZGVyKHBsYWNlaG9sZGVyKTtcblxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0ZGF0YS5pbnB1dEJveC5mb2N1cygpO1xuXHRcdFx0ZGF0YS5pbnB1dEJveC5zZWxlY3QoKTtcblx0XHR9LCAwKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElEYXRhQnJlYWtwb2ludCwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRGF0YUJyZWFrcG9pbnRJbnB1dFRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJRGF0YUJyZWFrcG9pbnRJbnB1dFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBFeGNlcHRpb25CcmVha3BvaW50SW5wdXRSZW5kZXJlciBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8SUV4Y2VwdGlvbkJyZWFrcG9pbnQsIElFeGNlcHRpb25CcmVha3BvaW50SW5wdXRUZW1wbGF0ZURhdGE+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHZpZXc6IEJyZWFrcG9pbnRzVmlldyxcblx0XHRwcml2YXRlIGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRwcml2YXRlIGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0KSB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2V4Y2VwdGlvbmJyZWFrcG9pbnRpbnB1dCc7XG5cblx0Z2V0IHRlbXBsYXRlSWQoKSB7XG5cdFx0cmV0dXJuIEV4Y2VwdGlvbkJyZWFrcG9pbnRJbnB1dFJlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElFeGNlcHRpb25CcmVha3BvaW50SW5wdXRUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IHRvRGlzcG9zZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IGJyZWFrcG9pbnQgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLmJyZWFrcG9pbnQnKSk7XG5cdFx0YnJlYWtwb2ludC5jbGFzc0xpc3QuYWRkKCdleGNlcHRpb24nKTtcblx0XHRjb25zdCBjaGVja2JveCA9IGNyZWF0ZUNoZWNrYm94KHRvRGlzcG9zZSk7XG5cblx0XHRkb20uYXBwZW5kKGJyZWFrcG9pbnQsIGNoZWNrYm94KTtcblx0XHR0aGlzLnZpZXcuYnJlYWtwb2ludElucHV0Rm9jdXNlZC5zZXQodHJ1ZSk7XG5cdFx0Y29uc3QgaW5wdXRCb3hDb250YWluZXIgPSBkb20uYXBwZW5kKGJyZWFrcG9pbnQsICQoJy5pbnB1dEJveENvbnRhaW5lcicpKTtcblx0XHRjb25zdCBpbnB1dEJveCA9IG5ldyBJbnB1dEJveChpbnB1dEJveENvbnRhaW5lciwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ2V4Y2VwdGlvbkJyZWFrcG9pbnRBcmlhTGFiZWwnLCBcIlR5cGUgZXhjZXB0aW9uIGJyZWFrcG9pbnQgY29uZGl0aW9uXCIpLFxuXHRcdFx0aW5wdXRCb3hTdHlsZXM6IGRlZmF1bHRJbnB1dEJveFN0eWxlc1xuXHRcdH0pO1xuXG5cblx0XHR0b0Rpc3Bvc2UuYWRkKGlucHV0Qm94KTtcblx0XHRjb25zdCB3cmFwVXAgPSAoc3VjY2VzczogYm9vbGVhbikgPT4ge1xuXHRcdFx0aWYgKCF0ZW1wbGF0ZURhdGEuY3VycmVudEJyZWFrcG9pbnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnZpZXcuYnJlYWtwb2ludElucHV0Rm9jdXNlZC5zZXQoZmFsc2UpO1xuXHRcdFx0bGV0IG5ld0NvbmRpdGlvbiA9IHRlbXBsYXRlRGF0YS5jdXJyZW50QnJlYWtwb2ludC5jb25kaXRpb247XG5cdFx0XHRpZiAoc3VjY2Vzcykge1xuXHRcdFx0XHRuZXdDb25kaXRpb24gPSBpbnB1dEJveC52YWx1ZSAhPT0gJycgPyBpbnB1dEJveC52YWx1ZSA6IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLnNldEV4Y2VwdGlvbkJyZWFrcG9pbnRDb25kaXRpb24odGVtcGxhdGVEYXRhLmN1cnJlbnRCcmVha3BvaW50LCBuZXdDb25kaXRpb24pO1xuXHRcdH07XG5cblx0XHR0b0Rpc3Bvc2UuYWRkKGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihpbnB1dEJveC5pbnB1dEVsZW1lbnQsICdrZXlkb3duJywgKGU6IElLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBpc0VzY2FwZSA9IGUuZXF1YWxzKEtleUNvZGUuRXNjYXBlKTtcblx0XHRcdGNvbnN0IGlzRW50ZXIgPSBlLmVxdWFscyhLZXlDb2RlLkVudGVyKTtcblx0XHRcdGlmIChpc0VzY2FwZSB8fCBpc0VudGVyKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0d3JhcFVwKGlzRW50ZXIpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0b0Rpc3Bvc2UuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoaW5wdXRCb3guaW5wdXRFbGVtZW50LCAnYmx1cicsICgpID0+IHtcblx0XHRcdC8vIE5lZWQgdG8gcmVhY3Qgd2l0aCBhIHRpbWVvdXQgb24gdGhlIGJsdXIgZXZlbnQgZHVlIHRvIHBvc3NpYmxlIGNvbmN1cmVudCBzcGxpY2VzICM1NjQ0M1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHdyYXBVcCh0cnVlKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGVsZW1lbnREaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0b0Rpc3Bvc2UuYWRkKGVsZW1lbnREaXNwb3NhYmxlcyk7XG5cblx0XHRjb25zdCB0ZW1wbGF0ZURhdGE6IElFeGNlcHRpb25CcmVha3BvaW50SW5wdXRUZW1wbGF0ZURhdGEgPSB7XG5cdFx0XHRpbnB1dEJveCxcblx0XHRcdGNoZWNrYm94LFxuXHRcdFx0dGVtcGxhdGVEaXNwb3NhYmxlczogdG9EaXNwb3NlLFxuXHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCksXG5cdFx0fTtcblxuXHRcdHJldHVybiB0ZW1wbGF0ZURhdGE7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGV4Y2VwdGlvbkJyZWFrcG9pbnQ6IEV4Y2VwdGlvbkJyZWFrcG9pbnQsIF9pbmRleDogbnVtYmVyLCBkYXRhOiBJRXhjZXB0aW9uQnJlYWtwb2ludElucHV0VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3QgcGxhY2VIb2xkZXIgPSBleGNlcHRpb25CcmVha3BvaW50LmNvbmRpdGlvbkRlc2NyaXB0aW9uIHx8IGxvY2FsaXplKCdleGNlcHRpb25CcmVha3BvaW50UGxhY2Vob2xkZXInLCBcIkJyZWFrIHdoZW4gZXhwcmVzc2lvbiBldmFsdWF0ZXMgdG8gdHJ1ZVwiKTtcblx0XHRkYXRhLmlucHV0Qm94LnNldFBsYWNlSG9sZGVyKHBsYWNlSG9sZGVyKTtcblx0XHRkYXRhLmN1cnJlbnRCcmVha3BvaW50ID0gZXhjZXB0aW9uQnJlYWtwb2ludDtcblx0XHRkYXRhLmNoZWNrYm94LmNoZWNrZWQgPSBleGNlcHRpb25CcmVha3BvaW50LmVuYWJsZWQ7XG5cdFx0ZGF0YS5jaGVja2JveC5kaXNhYmxlZCA9IHRydWU7XG5cdFx0ZGF0YS5pbnB1dEJveC52YWx1ZSA9IGV4Y2VwdGlvbkJyZWFrcG9pbnQuY29uZGl0aW9uIHx8ICcnO1xuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0ZGF0YS5pbnB1dEJveC5mb2N1cygpO1xuXHRcdFx0ZGF0YS5pbnB1dEJveC5zZWxlY3QoKTtcblx0XHR9LCAwKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElFeGNlcHRpb25CcmVha3BvaW50LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElFeGNlcHRpb25CcmVha3BvaW50SW5wdXRUZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSUV4Y2VwdGlvbkJyZWFrcG9pbnRJbnB1dFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBCcmVha3BvaW50c0FjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPEJyZWFrcG9pbnRJdGVtPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2Vcblx0KSB7IH1cblxuXHRnZXRXaWRnZXRBcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ2JyZWFrcG9pbnRzJywgXCJCcmVha3BvaW50c1wiKTtcblx0fVxuXG5cdGdldFJvbGUoKTogQXJpYVJvbGUge1xuXHRcdHJldHVybiAnY2hlY2tib3gnO1xuXHR9XG5cblx0aXNDaGVja2VkKGJyZWFrcG9pbnQ6IElFbmFibGVtZW50KSB7XG5cdFx0cmV0dXJuIGJyZWFrcG9pbnQuZW5hYmxlZDtcblx0fVxuXG5cdGdldEFyaWFMYWJlbChlbGVtZW50OiBCcmVha3BvaW50SXRlbSk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgRXhjZXB0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQudG9TdHJpbmcoKTtcblx0XHR9XG5cblx0XHRjb25zdCB7IG1lc3NhZ2UgfSA9IGdldEJyZWFrcG9pbnRNZXNzYWdlQW5kSWNvbih0aGlzLmRlYnVnU2VydmljZS5zdGF0ZSwgdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5hcmVCcmVha3BvaW50c0FjdGl2YXRlZCgpLCBlbGVtZW50IGFzIElCcmVha3BvaW50IHwgSURhdGFCcmVha3BvaW50IHwgSUZ1bmN0aW9uQnJlYWtwb2ludCwgdGhpcy5sYWJlbFNlcnZpY2UsIHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkpO1xuXHRcdGNvbnN0IHRvU3RyaW5nID0gZWxlbWVudC50b1N0cmluZygpO1xuXG5cdFx0cmV0dXJuIG1lc3NhZ2UgPyBgJHt0b1N0cmluZ30sICR7bWVzc2FnZX1gIDogdG9TdHJpbmc7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5CcmVha3BvaW50U291cmNlKGJyZWFrcG9pbnQ6IElCcmVha3BvaW50LCBzaWRlQnlTaWRlOiBib29sZWFuLCBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuLCBwaW5uZWQ6IGJvb2xlYW4sIGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSwgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UpOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdGlmIChicmVha3BvaW50LnVyaS5zY2hlbWUgPT09IERFQlVHX1NDSEVNRSAmJiBkZWJ1Z1NlcnZpY2Uuc3RhdGUgPT09IFN0YXRlLkluYWN0aXZlKSB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0Y29uc3Qgc2VsZWN0aW9uID0gYnJlYWtwb2ludC5lbmRMaW5lTnVtYmVyID8ge1xuXHRcdHN0YXJ0TGluZU51bWJlcjogYnJlYWtwb2ludC5saW5lTnVtYmVyLFxuXHRcdGVuZExpbmVOdW1iZXI6IGJyZWFrcG9pbnQuZW5kTGluZU51bWJlcixcblx0XHRzdGFydENvbHVtbjogYnJlYWtwb2ludC5jb2x1bW4gfHwgMSxcblx0XHRlbmRDb2x1bW46IGJyZWFrcG9pbnQuZW5kQ29sdW1uIHx8IENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSXG5cdH0gOiB7XG5cdFx0c3RhcnRMaW5lTnVtYmVyOiBicmVha3BvaW50LmxpbmVOdW1iZXIsXG5cdFx0c3RhcnRDb2x1bW46IGJyZWFrcG9pbnQuY29sdW1uIHx8IDEsXG5cdFx0ZW5kTGluZU51bWJlcjogYnJlYWtwb2ludC5saW5lTnVtYmVyLFxuXHRcdGVuZENvbHVtbjogYnJlYWtwb2ludC5jb2x1bW4gfHwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVJcblx0fTtcblxuXHRyZXR1cm4gZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRyZXNvdXJjZTogYnJlYWtwb2ludC51cmksXG5cdFx0b3B0aW9uczoge1xuXHRcdFx0cHJlc2VydmVGb2N1cyxcblx0XHRcdHNlbGVjdGlvbixcblx0XHRcdHJldmVhbElmT3BlbmVkOiB0cnVlLFxuXHRcdFx0c2VsZWN0aW9uUmV2ZWFsVHlwZTogVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUuQ2VudGVySWZPdXRzaWRlVmlld3BvcnQsXG5cdFx0XHRwaW5uZWRcblx0XHR9XG5cdH0sIHNpZGVCeVNpZGUgPyBTSURFX0dST1VQIDogQUNUSVZFX0dST1VQKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJyZWFrcG9pbnRNZXNzYWdlQW5kSWNvbihzdGF0ZTogU3RhdGUsIGJyZWFrcG9pbnRzQWN0aXZhdGVkOiBib29sZWFuLCBicmVha3BvaW50OiBCcmVha3BvaW50SXRlbSwgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLCBkZWJ1Z01vZGVsOiBJRGVidWdNb2RlbCk6IHsgbWVzc2FnZT86IHN0cmluZzsgaWNvbjogVGhlbWVJY29uOyBzaG93QWRhcHRlclVudmVyaWZpZWRNZXNzYWdlPzogYm9vbGVhbiB9IHtcblx0Y29uc3QgZGVidWdBY3RpdmUgPSBzdGF0ZSA9PT0gU3RhdGUuUnVubmluZyB8fCBzdGF0ZSA9PT0gU3RhdGUuU3RvcHBlZDtcblxuXHRjb25zdCBicmVha3BvaW50SWNvbiA9IGJyZWFrcG9pbnQgaW5zdGFuY2VvZiBEYXRhQnJlYWtwb2ludCA/IGljb25zLmRhdGFCcmVha3BvaW50IDogYnJlYWtwb2ludCBpbnN0YW5jZW9mIEZ1bmN0aW9uQnJlYWtwb2ludCA/IGljb25zLmZ1bmN0aW9uQnJlYWtwb2ludCA6IGJyZWFrcG9pbnQubG9nTWVzc2FnZSA/IGljb25zLmxvZ0JyZWFrcG9pbnQgOiBpY29ucy5icmVha3BvaW50O1xuXG5cdGlmICghYnJlYWtwb2ludC5lbmFibGVkIHx8ICFicmVha3BvaW50c0FjdGl2YXRlZCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpY29uOiBicmVha3BvaW50SWNvbi5kaXNhYmxlZCxcblx0XHRcdG1lc3NhZ2U6IGJyZWFrcG9pbnQubG9nTWVzc2FnZSA/IGxvY2FsaXplKCdkaXNhYmxlZExvZ3BvaW50JywgXCJEaXNhYmxlZCBMb2dwb2ludFwiKSA6IGxvY2FsaXplKCdkaXNhYmxlZEJyZWFrcG9pbnQnLCBcIkRpc2FibGVkIEJyZWFrcG9pbnRcIiksXG5cdFx0fTtcblx0fVxuXG5cdGNvbnN0IGFwcGVuZE1lc3NhZ2UgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+IHtcblx0XHRyZXR1cm4gKCdtZXNzYWdlJyBpbiBicmVha3BvaW50ICYmIGJyZWFrcG9pbnQubWVzc2FnZSkgPyB0ZXh0LmNvbmNhdCgnLCAnICsgYnJlYWtwb2ludC5tZXNzYWdlKSA6IHRleHQ7XG5cdH07XG5cblx0aWYgKGRlYnVnQWN0aXZlICYmIGJyZWFrcG9pbnQgaW5zdGFuY2VvZiBCcmVha3BvaW50ICYmIGJyZWFrcG9pbnQucGVuZGluZykge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpY29uOiBpY29ucy5icmVha3BvaW50LnBlbmRpbmdcblx0XHR9O1xuXHR9XG5cblx0aWYgKGRlYnVnQWN0aXZlICYmICFicmVha3BvaW50LnZlcmlmaWVkKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGljb246IGJyZWFrcG9pbnRJY29uLnVudmVyaWZpZWQsXG5cdFx0XHRtZXNzYWdlOiAoJ21lc3NhZ2UnIGluIGJyZWFrcG9pbnQgJiYgYnJlYWtwb2ludC5tZXNzYWdlKSA/IGJyZWFrcG9pbnQubWVzc2FnZSA6IChicmVha3BvaW50LmxvZ01lc3NhZ2UgPyBsb2NhbGl6ZSgndW52ZXJpZmllZExvZ3BvaW50JywgXCJVbnZlcmlmaWVkIExvZ3BvaW50XCIpIDogbG9jYWxpemUoJ3VudmVyaWZpZWRCcmVha3BvaW50JywgXCJVbnZlcmlmaWVkIEJyZWFrcG9pbnRcIikpLFxuXHRcdFx0c2hvd0FkYXB0ZXJVbnZlcmlmaWVkTWVzc2FnZTogdHJ1ZVxuXHRcdH07XG5cdH1cblxuXHRpZiAoYnJlYWtwb2ludCBpbnN0YW5jZW9mIERhdGFCcmVha3BvaW50KSB7XG5cdFx0aWYgKCFicmVha3BvaW50LnN1cHBvcnRlZCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWNvbjogYnJlYWtwb2ludEljb24udW52ZXJpZmllZCxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2RhdGFCcmVha3BvaW50VW5zdXBwb3J0ZWQnLCBcIkRhdGEgYnJlYWtwb2ludHMgbm90IHN1cHBvcnRlZCBieSB0aGlzIGRlYnVnIHR5cGVcIiksXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpY29uOiBicmVha3BvaW50SWNvbi5yZWd1bGFyLFxuXHRcdFx0bWVzc2FnZTogYnJlYWtwb2ludC5tZXNzYWdlIHx8IGxvY2FsaXplKCdkYXRhQnJlYWtwb2ludCcsIFwiRGF0YSBCcmVha3BvaW50XCIpXG5cdFx0fTtcblx0fVxuXG5cdGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgRnVuY3Rpb25CcmVha3BvaW50KSB7XG5cdFx0aWYgKCFicmVha3BvaW50LnN1cHBvcnRlZCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWNvbjogYnJlYWtwb2ludEljb24udW52ZXJpZmllZCxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2Z1bmN0aW9uQnJlYWtwb2ludFVuc3VwcG9ydGVkJywgXCJGdW5jdGlvbiBicmVha3BvaW50cyBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgZGVidWcgdHlwZVwiKSxcblx0XHRcdH07XG5cdFx0fVxuXHRcdGNvbnN0IG1lc3NhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdG1lc3NhZ2VzLnB1c2goYnJlYWtwb2ludC5tZXNzYWdlIHx8IGxvY2FsaXplKCdmdW5jdGlvbkJyZWFrcG9pbnQnLCBcIkZ1bmN0aW9uIEJyZWFrcG9pbnRcIikpO1xuXHRcdGlmIChicmVha3BvaW50LmNvbmRpdGlvbikge1xuXHRcdFx0bWVzc2FnZXMucHVzaChsb2NhbGl6ZSgnZXhwcmVzc2lvbicsIFwiQ29uZGl0aW9uOiB7MH1cIiwgYnJlYWtwb2ludC5jb25kaXRpb24pKTtcblx0XHR9XG5cdFx0aWYgKGJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uKSB7XG5cdFx0XHRtZXNzYWdlcy5wdXNoKGxvY2FsaXplKCdoaXRDb3VudCcsIFwiSGl0IENvdW50OiB7MH1cIiwgYnJlYWtwb2ludC5oaXRDb25kaXRpb24pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aWNvbjogYnJlYWtwb2ludEljb24ucmVndWxhcixcblx0XHRcdG1lc3NhZ2U6IGFwcGVuZE1lc3NhZ2UobWVzc2FnZXMuam9pbignXFxuJykpXG5cdFx0fTtcblx0fVxuXG5cdGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgSW5zdHJ1Y3Rpb25CcmVha3BvaW50KSB7XG5cdFx0aWYgKCFicmVha3BvaW50LnN1cHBvcnRlZCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWNvbjogYnJlYWtwb2ludEljb24udW52ZXJpZmllZCxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2luc3RydWN0aW9uQnJlYWtwb2ludFVuc3VwcG9ydGVkJywgXCJJbnN0cnVjdGlvbiBicmVha3BvaW50cyBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgZGVidWcgdHlwZVwiKSxcblx0XHRcdH07XG5cdFx0fVxuXHRcdGNvbnN0IG1lc3NhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGlmIChicmVha3BvaW50Lm1lc3NhZ2UpIHtcblx0XHRcdG1lc3NhZ2VzLnB1c2goYnJlYWtwb2ludC5tZXNzYWdlKTtcblx0XHR9IGVsc2UgaWYgKGJyZWFrcG9pbnQuaW5zdHJ1Y3Rpb25SZWZlcmVuY2UpIHtcblx0XHRcdG1lc3NhZ2VzLnB1c2gobG9jYWxpemUoJ2luc3RydWN0aW9uQnJlYWtwb2ludEF0QWRkcmVzcycsIFwiSW5zdHJ1Y3Rpb24gYnJlYWtwb2ludCBhdCBhZGRyZXNzIHswfVwiLCBicmVha3BvaW50Lmluc3RydWN0aW9uUmVmZXJlbmNlKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lc3NhZ2VzLnB1c2gobG9jYWxpemUoJ2luc3RydWN0aW9uQnJlYWtwb2ludCcsIFwiSW5zdHJ1Y3Rpb24gYnJlYWtwb2ludFwiKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uKSB7XG5cdFx0XHRtZXNzYWdlcy5wdXNoKGxvY2FsaXplKCdoaXRDb3VudCcsIFwiSGl0IENvdW50OiB7MH1cIiwgYnJlYWtwb2ludC5oaXRDb25kaXRpb24pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aWNvbjogYnJlYWtwb2ludEljb24ucmVndWxhcixcblx0XHRcdG1lc3NhZ2U6IGFwcGVuZE1lc3NhZ2UobWVzc2FnZXMuam9pbignXFxuJykpXG5cdFx0fTtcblx0fVxuXG5cdC8vIGNhbiBjaGFuZ2UgdGhpcyB3aGVuIGFsbCBicmVha3BvaW50IHN1cHBvcnRzIGRlcGVuZGVudCBicmVha3BvaW50IGNvbmRpdGlvblxuXHRsZXQgdHJpZ2dlcmluZ0JyZWFrcG9pbnQ6IElCcmVha3BvaW50IHwgdW5kZWZpbmVkO1xuXHRpZiAoYnJlYWtwb2ludCBpbnN0YW5jZW9mIEJyZWFrcG9pbnQgJiYgYnJlYWtwb2ludC50cmlnZ2VyZWRCeSkge1xuXHRcdHRyaWdnZXJpbmdCcmVha3BvaW50ID0gZGVidWdNb2RlbC5nZXRCcmVha3BvaW50cygpLmZpbmQoYnAgPT4gYnAuZ2V0SWQoKSA9PT0gYnJlYWtwb2ludC50cmlnZ2VyZWRCeSk7XG5cdH1cblxuXHRpZiAoYnJlYWtwb2ludC5sb2dNZXNzYWdlIHx8IGJyZWFrcG9pbnQuY29uZGl0aW9uIHx8IGJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uIHx8IHRyaWdnZXJpbmdCcmVha3BvaW50KSB7XG5cdFx0Y29uc3QgbWVzc2FnZXM6IHN0cmluZ1tdID0gW107XG5cdFx0bGV0IGljb24gPSBicmVha3BvaW50LmxvZ01lc3NhZ2UgPyBpY29ucy5sb2dCcmVha3BvaW50LnJlZ3VsYXIgOiBpY29ucy5jb25kaXRpb25hbEJyZWFrcG9pbnQucmVndWxhcjtcblx0XHRpZiAoIWJyZWFrcG9pbnQuc3VwcG9ydGVkKSB7XG5cdFx0XHRpY29uID0gaWNvbnMuZGVidWdCcmVha3BvaW50VW5zdXBwb3J0ZWQ7XG5cdFx0XHRtZXNzYWdlcy5wdXNoKGxvY2FsaXplKCdicmVha3BvaW50VW5zdXBwb3J0ZWQnLCBcIkJyZWFrcG9pbnRzIG9mIHRoaXMgdHlwZSBhcmUgbm90IHN1cHBvcnRlZCBieSB0aGUgZGVidWdnZXJcIikpO1xuXHRcdH1cblxuXHRcdGlmIChicmVha3BvaW50LmxvZ01lc3NhZ2UpIHtcblx0XHRcdG1lc3NhZ2VzLnB1c2gobG9jYWxpemUoJ2xvZ01lc3NhZ2UnLCBcIkxvZyBNZXNzYWdlOiB7MH1cIiwgYnJlYWtwb2ludC5sb2dNZXNzYWdlKSk7XG5cdFx0fVxuXHRcdGlmIChicmVha3BvaW50LmNvbmRpdGlvbikge1xuXHRcdFx0bWVzc2FnZXMucHVzaChsb2NhbGl6ZSgnZXhwcmVzc2lvbicsIFwiQ29uZGl0aW9uOiB7MH1cIiwgYnJlYWtwb2ludC5jb25kaXRpb24pKTtcblx0XHR9XG5cdFx0aWYgKGJyZWFrcG9pbnQuaGl0Q29uZGl0aW9uKSB7XG5cdFx0XHRtZXNzYWdlcy5wdXNoKGxvY2FsaXplKCdoaXRDb3VudCcsIFwiSGl0IENvdW50OiB7MH1cIiwgYnJlYWtwb2ludC5oaXRDb25kaXRpb24pKTtcblx0XHR9XG5cdFx0aWYgKHRyaWdnZXJpbmdCcmVha3BvaW50KSB7XG5cdFx0XHRtZXNzYWdlcy5wdXNoKGxvY2FsaXplKCd0cmlnZ2VyZWRCeScsIFwiSGl0IGFmdGVyIGJyZWFrcG9pbnQ6IHswfVwiLCBgJHtsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodHJpZ2dlcmluZ0JyZWFrcG9pbnQudXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pfTogJHt0cmlnZ2VyaW5nQnJlYWtwb2ludC5saW5lTnVtYmVyfWApKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aWNvbixcblx0XHRcdG1lc3NhZ2U6IGFwcGVuZE1lc3NhZ2UobWVzc2FnZXMuam9pbignXFxuJykpXG5cdFx0fTtcblx0fVxuXG5cdGNvbnN0IG1lc3NhZ2UgPSAoJ21lc3NhZ2UnIGluIGJyZWFrcG9pbnQgJiYgYnJlYWtwb2ludC5tZXNzYWdlKSA/IGJyZWFrcG9pbnQubWVzc2FnZSA6IGJyZWFrcG9pbnQgaW5zdGFuY2VvZiBCcmVha3BvaW50ICYmIGxhYmVsU2VydmljZSA/IGxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChicmVha3BvaW50LnVyaSkgOiBsb2NhbGl6ZSgnYnJlYWtwb2ludCcsIFwiQnJlYWtwb2ludFwiKTtcblx0cmV0dXJuIHtcblx0XHRpY29uOiBicmVha3BvaW50SWNvbi5yZWd1bGFyLFxuXHRcdG1lc3NhZ2Vcblx0fTtcbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmRlYnVnLnZpZXdsZXQuYWN0aW9uLmFkZEZ1bmN0aW9uQnJlYWtwb2ludEFjdGlvbicsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ2FkZEZ1bmN0aW9uQnJlYWtwb2ludCcsIFwiQWRkIEZ1bmN0aW9uIEJyZWFrcG9pbnRcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlGdW5jdGlvbkJyZWFrcG9pbnQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZGdW5jdGlvbiBCcmVha3BvaW50Li4uXCIpLFxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0aWNvbjogaWNvbnMud2F0Y2hFeHByZXNzaW9uc0FkZEZ1bmNCcmVha3BvaW50LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxMCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgQlJFQUtQT0lOVFNfVklFV19JRClcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyTmV3QnJlYWtwb2ludE1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnMV9icmVha3BvaW50cycsXG5cdFx0XHRcdG9yZGVyOiAzLFxuXHRcdFx0XHR3aGVuOiBDT05URVhUX0RFQlVHR0VSU19BVkFJTEFCTEVcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0Y29uc3Qgdmlld1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0YXdhaXQgdmlld1NlcnZpY2Uub3BlblZpZXcoQlJFQUtQT0lOVFNfVklFV19JRCk7XG5cdFx0ZGVidWdTZXJ2aWNlLmFkZEZ1bmN0aW9uQnJlYWtwb2ludCgpO1xuXHR9XG59KTtcblxuYWJzdHJhY3QgY2xhc3MgTWVtb3J5QnJlYWtwb2ludEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGV4aXN0aW5nQnJlYWtwb2ludD86IElEYXRhQnJlYWtwb2ludCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRjb25zdCBzZXNzaW9uID0gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTZXNzaW9uO1xuXHRcdGlmICghc2Vzc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBkZWZhdWx0VmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGV4aXN0aW5nQnJlYWtwb2ludCAmJiBleGlzdGluZ0JyZWFrcG9pbnQuc3JjLnR5cGUgPT09IERhdGFCcmVha3BvaW50U2V0VHlwZS5BZGRyZXNzKSB7XG5cdFx0XHRkZWZhdWx0VmFsdWUgPSBgJHtleGlzdGluZ0JyZWFrcG9pbnQuc3JjLmFkZHJlc3N9ICsgJHtleGlzdGluZ0JyZWFrcG9pbnQuc3JjLmJ5dGVzfWA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcXVpY2tJbnB1dCA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGlmaWNhdGlvbnMgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHJhbmdlID0gYXdhaXQgdGhpcy5nZXRSYW5nZShxdWlja0lucHV0LCBkZWZhdWx0VmFsdWUpO1xuXHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgaW5mbzogSURhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRpbmZvID0gYXdhaXQgc2Vzc2lvbi5kYXRhQnl0ZXNCcmVha3BvaW50SW5mbyhyYW5nZS5hZGRyZXNzLCByYW5nZS5ieXRlcyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0bm90aWZpY2F0aW9ucy5lcnJvcihsb2NhbGl6ZSgnZGF0YUJyZWFrcG9pbnRFcnJvcicsIFwiRmFpbGVkIHRvIHNldCBkYXRhIGJyZWFrcG9pbnQgYXQgezB9OiB7MX1cIiwgcmFuZ2UuYWRkcmVzcywgZS5tZXNzYWdlKSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFpbmZvPy5kYXRhSWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgYWNjZXNzVHlwZTogRGVidWdQcm90b2NvbC5EYXRhQnJlYWtwb2ludEFjY2Vzc1R5cGUgPSAnd3JpdGUnO1xuXHRcdGlmIChpbmZvLmFjY2Vzc1R5cGVzICYmIGluZm8uYWNjZXNzVHlwZXM/Lmxlbmd0aCA+IDEpIHtcblx0XHRcdGNvbnN0IGFjY2Vzc1R5cGVzID0gaW5mby5hY2Nlc3NUeXBlcy5tYXAodHlwZSA9PiAoeyBsYWJlbDogdHlwZSB9KSk7XG5cdFx0XHRjb25zdCBzZWxlY3RlZEFjY2Vzc1R5cGUgPSBhd2FpdCBxdWlja0lucHV0LnBpY2soYWNjZXNzVHlwZXMsIHsgcGxhY2VIb2xkZXI6IGxvY2FsaXplKCdkYXRhQnJlYWtwb2ludEFjY2Vzc1R5cGUnLCBcIlNlbGVjdCB0aGUgYWNjZXNzIHR5cGUgdG8gbW9uaXRvclwiKSB9KTtcblx0XHRcdGlmICghc2VsZWN0ZWRBY2Nlc3NUeXBlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0YWNjZXNzVHlwZSA9IHNlbGVjdGVkQWNjZXNzVHlwZS5sYWJlbDtcblx0XHR9XG5cblx0XHRjb25zdCBzcmM6IERhdGFCcmVha3BvaW50U291cmNlID0geyB0eXBlOiBEYXRhQnJlYWtwb2ludFNldFR5cGUuQWRkcmVzcywgLi4ucmFuZ2UgfTtcblx0XHRpZiAoZXhpc3RpbmdCcmVha3BvaW50KSB7XG5cdFx0XHRhd2FpdCBkZWJ1Z1NlcnZpY2UucmVtb3ZlRGF0YUJyZWFrcG9pbnRzKGV4aXN0aW5nQnJlYWtwb2ludC5nZXRJZCgpKTtcblx0XHR9XG5cblx0XHRhd2FpdCBkZWJ1Z1NlcnZpY2UuYWRkRGF0YUJyZWFrcG9pbnQoe1xuXHRcdFx0ZGVzY3JpcHRpb246IGluZm8uZGVzY3JpcHRpb24sXG5cdFx0XHRzcmMsXG5cdFx0XHRjYW5QZXJzaXN0OiB0cnVlLFxuXHRcdFx0YWNjZXNzVHlwZXM6IGluZm8uYWNjZXNzVHlwZXMsXG5cdFx0XHRhY2Nlc3NUeXBlOiBhY2Nlc3NUeXBlLFxuXHRcdFx0aW5pdGlhbFNlc3Npb25EYXRhOiB7IHNlc3Npb24sIGRhdGFJZDogaW5mby5kYXRhSWQgfVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSYW5nZShxdWlja0lucHV0OiBJUXVpY2tJbnB1dFNlcnZpY2UsIGRlZmF1bHRWYWx1ZT86IHN0cmluZykge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx7IGFkZHJlc3M6IHN0cmluZzsgYnl0ZXM6IG51bWJlciB9IHwgdW5kZWZpbmVkPihyZXNvbHZlID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBkaXNwb3NhYmxlcy5hZGQocXVpY2tJbnB1dC5jcmVhdGVJbnB1dEJveCgpKTtcblx0XHRcdGlucHV0LnByb21wdCA9IGxvY2FsaXplKCdkYXRhQnJlYWtwb2ludE1lbW9yeVJhbmdlUHJvbXB0JywgXCJFbnRlciBhIG1lbW9yeSByYW5nZSBpbiB3aGljaCB0byBicmVha1wiKTtcblx0XHRcdGlucHV0LnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ2RhdGFCcmVha3BvaW50TWVtb3J5UmFuZ2VQbGFjZWhvbGRlcicsICdBYnNvbHV0ZSByYW5nZSAoMHgxMjM0IC0gMHgxMzAwKSBvciByYW5nZSBvZiBieXRlcyBhZnRlciBhbiBhZGRyZXNzICgweDEyMzQgKyAweGZmKScpO1xuXHRcdFx0aWYgKGRlZmF1bHRWYWx1ZSkge1xuXHRcdFx0XHRpbnB1dC52YWx1ZSA9IGRlZmF1bHRWYWx1ZTtcblx0XHRcdFx0aW5wdXQudmFsdWVTZWxlY3Rpb24gPSBbMCwgZGVmYXVsdFZhbHVlLmxlbmd0aF07XG5cdFx0XHR9XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoaW5wdXQub25EaWRDaGFuZ2VWYWx1ZShlID0+IHtcblx0XHRcdFx0Y29uc3QgZXJyID0gdGhpcy5wYXJzZUFkZHJlc3MoZSwgZmFsc2UpO1xuXHRcdFx0XHRpbnB1dC52YWxpZGF0aW9uTWVzc2FnZSA9IGVycj8uZXJyb3I7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoaW5wdXQub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByID0gdGhpcy5wYXJzZUFkZHJlc3MoaW5wdXQudmFsdWUsIHRydWUpO1xuXHRcdFx0XHRpZiAoJ2Vycm9yJyBpbiByKSB7XG5cdFx0XHRcdFx0aW5wdXQudmFsaWRhdGlvbk1lc3NhZ2UgPSByLmVycm9yO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc29sdmUocik7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5wdXQuZGlzcG9zZSgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGlucHV0Lm9uRGlkSGlkZSgoKSA9PiB7XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0aW5wdXQuaWdub3JlRm9jdXNPdXQgPSB0cnVlO1xuXHRcdFx0aW5wdXQuc2hvdygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBwYXJzZUFkZHJlc3MocmFuZ2U6IHN0cmluZywgaXNGaW5hbDogZmFsc2UpOiB7IGVycm9yOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBwYXJzZUFkZHJlc3MocmFuZ2U6IHN0cmluZywgaXNGaW5hbDogdHJ1ZSk6IHsgZXJyb3I6IHN0cmluZyB9IHwgeyBhZGRyZXNzOiBzdHJpbmc7IGJ5dGVzOiBudW1iZXIgfTtcblx0cHJpdmF0ZSBwYXJzZUFkZHJlc3MocmFuZ2U6IHN0cmluZywgaXNGaW5hbDogYm9vbGVhbik6IHsgZXJyb3I6IHN0cmluZyB9IHwgeyBhZGRyZXNzOiBzdHJpbmc7IGJ5dGVzOiBudW1iZXIgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcGFydHMgPSAvXihcXFMrKVxccyooPzooWystXSlcXHMqKFxcUyspKT8vLmV4ZWMocmFuZ2UpO1xuXHRcdGlmICghcGFydHMpIHtcblx0XHRcdHJldHVybiB7IGVycm9yOiBsb2NhbGl6ZSgnZGF0YUJyZWFrcG9pbnRBZGRyRm9ybWF0JywgJ0FkZHJlc3Mgc2hvdWxkIGJlIGEgcmFuZ2Ugb2YgbnVtYmVycyB0aGUgZm9ybSBcIltTdGFydF0gLSBbRW5kXVwiIG9yIFwiW1N0YXJ0XSArIFtCeXRlc11cIicpIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNOdW0gPSAoZTogc3RyaW5nKSA9PiBpc0ZpbmFsID8gL14weFswLTlhLWZdKnxbMC05XSokL2kudGVzdChlKSA6IC9eMHhbMC05YS1mXSt8WzAtOV0rJC9pLnRlc3QoZSk7XG5cdFx0Y29uc3QgWywgc3RhcnRTdHIsIHNpZ24gPSAnKycsIGVuZFN0ciA9ICcxJ10gPSBwYXJ0cztcblxuXHRcdGZvciAoY29uc3QgbiBvZiBbc3RhcnRTdHIsIGVuZFN0cl0pIHtcblx0XHRcdGlmICghaXNOdW0obikpIHtcblx0XHRcdFx0cmV0dXJuIHsgZXJyb3I6IGxvY2FsaXplKCdkYXRhQnJlYWtwb2ludEFkZHJTdGFydEVuZCcsICdOdW1iZXIgbXVzdCBiZSBhIGRlY2ltYWwgaW50ZWdlciBvciBoZXggdmFsdWUgc3RhcnRpbmcgd2l0aCBcXFwiMHhcXFwiLCBnb3QgezB9JywgbikgfTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWlzRmluYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydCA9IEJpZ0ludChzdGFydFN0cik7XG5cdFx0Y29uc3QgZW5kID0gQmlnSW50KGVuZFN0cik7XG5cdFx0Y29uc3QgYWRkcmVzcyA9IGAweCR7c3RhcnQudG9TdHJpbmcoMTYpfWA7XG5cdFx0aWYgKHNpZ24gPT09ICctJykge1xuXHRcdFx0cmV0dXJuIHsgYWRkcmVzcywgYnl0ZXM6IE51bWJlcihzdGFydCAtIGVuZCkgfTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBhZGRyZXNzLCBieXRlczogTnVtYmVyKGVuZCkgfTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBNZW1vcnlCcmVha3BvaW50QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZGVidWcudmlld2xldC5hY3Rpb24uYWRkRGF0YUJyZWFrcG9pbnRPbkFkZHJlc3MnLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdhZGREYXRhQnJlYWtwb2ludE9uQWRkcmVzcycsIFwiQWRkIERhdGEgQnJlYWtwb2ludCBhdCBBZGRyZXNzXCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pRGF0YUJyZWFrcG9pbnQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZEYXRhIEJyZWFrcG9pbnQuLi5cIiksXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRpY29uOiBpY29ucy53YXRjaEV4cHJlc3Npb25zQWRkRGF0YUJyZWFrcG9pbnQsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDExLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TRVRfREFUQV9CUkVBS1BPSU5UX0JZVEVTX1NVUFBPUlRFRCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgQlJFQUtQT0lOVFNfVklFV19JRCkpXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhck5ld0JyZWFrcG9pbnRNZW51LFxuXHRcdFx0XHRncm91cDogJzFfYnJlYWtwb2ludHMnLFxuXHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdFx0d2hlbjogQ09OVEVYVF9TRVRfREFUQV9CUkVBS1BPSU5UX0JZVEVTX1NVUFBPUlRFRFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIE1lbW9yeUJyZWFrcG9pbnRBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5kZWJ1Zy52aWV3bGV0LmFjdGlvbi5lZGl0RGF0YUJyZWFrcG9pbnRPbkFkZHJlc3MnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZWRpdERhdGFCcmVha3BvaW50T25BZGRyZXNzJywgXCJFZGl0IEFkZHJlc3MuLi5cIiksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkRlYnVnQnJlYWtwb2ludHNDb250ZXh0LFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TRVRfREFUQV9CUkVBS1BPSU5UX0JZVEVTX1NVUFBPUlRFRCwgQ09OVEVYVF9CUkVBS1BPSU5UX0lURU1fSVNfREFUQV9CWVRFUyksXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxNSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZGVidWcudmlld2xldC5hY3Rpb24udG9nZ2xlQnJlYWtwb2ludHNBY3RpdmF0ZWRBY3Rpb24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignYWN0aXZhdGVCcmVha3BvaW50cycsICdUb2dnbGUgQWN0aXZhdGUgQnJlYWtwb2ludHMnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0aWNvbjogaWNvbnMuYnJlYWtwb2ludHNBY3RpdmF0ZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAyMCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgQlJFQUtQT0lOVFNfVklFV19JRClcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRkZWJ1Z1NlcnZpY2Uuc2V0QnJlYWtwb2ludHNBY3RpdmF0ZWQoIWRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCkpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmRlYnVnLnZpZXdsZXQuYWN0aW9uLnJlbW92ZUJyZWFrcG9pbnQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdyZW1vdmVCcmVha3BvaW50JywgXCJSZW1vdmUgQnJlYWtwb2ludFwiKSxcblx0XHRcdGljb246IENvZGljb24ucmVtb3ZlQ2xvc2UsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkRlYnVnQnJlYWtwb2ludHNDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJzNfbW9kaWZpY2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDEwLFxuXHRcdFx0XHR3aGVuOiBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLm5vdEVxdWFsc1RvKCdleGNlcHRpb25CcmVha3BvaW50Jylcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5EZWJ1Z0JyZWFrcG9pbnRzQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICdpbmxpbmUnLFxuXHRcdFx0XHRvcmRlcjogMjAsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfQlJFQUtQT0lOVF9JVEVNX1RZUEUubm90RXF1YWxzVG8oJ2V4Y2VwdGlvbkJyZWFrcG9pbnQnKVxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYnJlYWtwb2ludDogSUJhc2VCcmVha3BvaW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgQnJlYWtwb2ludCkge1xuXHRcdFx0YXdhaXQgZGVidWdTZXJ2aWNlLnJlbW92ZUJyZWFrcG9pbnRzKGJyZWFrcG9pbnQuZ2V0SWQoKSk7XG5cdFx0fSBlbHNlIGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgRnVuY3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRhd2FpdCBkZWJ1Z1NlcnZpY2UucmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cyhicmVha3BvaW50LmdldElkKCkpO1xuXHRcdH0gZWxzZSBpZiAoYnJlYWtwb2ludCBpbnN0YW5jZW9mIERhdGFCcmVha3BvaW50KSB7XG5cdFx0XHRhd2FpdCBkZWJ1Z1NlcnZpY2UucmVtb3ZlRGF0YUJyZWFrcG9pbnRzKGJyZWFrcG9pbnQuZ2V0SWQoKSk7XG5cdFx0fSBlbHNlIGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgSW5zdHJ1Y3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRhd2FpdCBkZWJ1Z1NlcnZpY2UucmVtb3ZlSW5zdHJ1Y3Rpb25CcmVha3BvaW50cyhicmVha3BvaW50Lmluc3RydWN0aW9uUmVmZXJlbmNlLCBicmVha3BvaW50Lm9mZnNldCk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmRlYnVnLnZpZXdsZXQuYWN0aW9uLnJlbW92ZUFsbEJyZWFrcG9pbnRzJyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLmxvY2FsaXplMigncmVtb3ZlQWxsQnJlYWtwb2ludHMnLCBcIlJlbW92ZSBBbGwgQnJlYWtwb2ludHNcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlSZW1vdmVBbGxCcmVha3BvaW50cycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJSZW1vdmUgJiZBbGwgQnJlYWtwb2ludHNcIiksXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRpY29uOiBpY29ucy5icmVha3BvaW50c1JlbW92ZUFsbCxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMzAsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIEJSRUFLUE9JTlRTX1ZJRVdfSUQpXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRGVidWdCcmVha3BvaW50c0NvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnM19tb2RpZmljYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMjAsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0JSRUFLUE9JTlRTX0VYSVNULCBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLm5vdEVxdWFsc1RvKCdleGNlcHRpb25CcmVha3BvaW50JykpXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhckRlYnVnTWVudSxcblx0XHRcdFx0Z3JvdXA6ICc1X2JyZWFrcG9pbnRzJyxcblx0XHRcdFx0b3JkZXI6IDMsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRVxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRkZWJ1Z1NlcnZpY2UucmVtb3ZlQnJlYWtwb2ludHMoKTtcblx0XHRkZWJ1Z1NlcnZpY2UucmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cygpO1xuXHRcdGRlYnVnU2VydmljZS5yZW1vdmVEYXRhQnJlYWtwb2ludHMoKTtcblx0XHRkZWJ1Z1NlcnZpY2UucmVtb3ZlSW5zdHJ1Y3Rpb25CcmVha3BvaW50cygpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmRlYnVnLnZpZXdsZXQuYWN0aW9uLmVuYWJsZUFsbEJyZWFrcG9pbnRzJyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLmxvY2FsaXplMignZW5hYmxlQWxsQnJlYWtwb2ludHMnLCBcIkVuYWJsZSBBbGwgQnJlYWtwb2ludHNcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlFbmFibGVBbGxCcmVha3BvaW50cycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkVuYWJsZSBBbGwgQnJlYWtwb2ludHNcIiksXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuRGVidWdCcmVha3BvaW50c0NvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnel9jb21tYW5kcycsXG5cdFx0XHRcdG9yZGVyOiAxMCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfQlJFQUtQT0lOVFNfRVhJU1QsIENPTlRFWFRfQlJFQUtQT0lOVF9JVEVNX1RZUEUubm90RXF1YWxzVG8oJ2V4Y2VwdGlvbkJyZWFrcG9pbnQnKSlcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyRGVidWdNZW51LFxuXHRcdFx0XHRncm91cDogJzVfYnJlYWtwb2ludHMnLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0d2hlbjogQ09OVEVYVF9ERUJVR0dFUlNfQVZBSUxBQkxFXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGF3YWl0IGRlYnVnU2VydmljZS5lbmFibGVPckRpc2FibGVCcmVha3BvaW50cyh0cnVlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5kZWJ1Zy52aWV3bGV0LmFjdGlvbi5kaXNhYmxlQWxsQnJlYWtwb2ludHMnLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdkaXNhYmxlQWxsQnJlYWtwb2ludHMnLCBcIkRpc2FibGUgQWxsIEJyZWFrcG9pbnRzXCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pRGlzYWJsZUFsbEJyZWFrcG9pbnRzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkRpc2FibGUgQSYmbGwgQnJlYWtwb2ludHNcIiksXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfREVCVUdHRVJTX0FWQUlMQUJMRSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuRGVidWdCcmVha3BvaW50c0NvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnel9jb21tYW5kcycsXG5cdFx0XHRcdG9yZGVyOiAyMCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfQlJFQUtQT0lOVFNfRVhJU1QsIENPTlRFWFRfQlJFQUtQT0lOVF9JVEVNX1RZUEUubm90RXF1YWxzVG8oJ2V4Y2VwdGlvbkJyZWFrcG9pbnQnKSlcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyRGVidWdNZW51LFxuXHRcdFx0XHRncm91cDogJzVfYnJlYWtwb2ludHMnLFxuXHRcdFx0XHRvcmRlcjogMixcblx0XHRcdFx0d2hlbjogQ09OVEVYVF9ERUJVR0dFUlNfQVZBSUxBQkxFXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGF3YWl0IGRlYnVnU2VydmljZS5lbmFibGVPckRpc2FibGVCcmVha3BvaW50cyhmYWxzZSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZGVidWcudmlld2xldC5hY3Rpb24ucmVhcHBseUJyZWFrcG9pbnRzQWN0aW9uJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3JlYXBwbHlBbGxCcmVha3BvaW50cycsICdSZWFwcGx5IEFsbCBCcmVha3BvaW50cycpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfSU5fREVCVUdfTU9ERSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuRGVidWdCcmVha3BvaW50c0NvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnel9jb21tYW5kcycsXG5cdFx0XHRcdG9yZGVyOiAzMCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfQlJFQUtQT0lOVFNfRVhJU1QsIENPTlRFWFRfQlJFQUtQT0lOVF9JVEVNX1RZUEUubm90RXF1YWxzVG8oJ2V4Y2VwdGlvbkJyZWFrcG9pbnQnKSlcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0YXdhaXQgZGVidWdTZXJ2aWNlLnNldEJyZWFrcG9pbnRzQWN0aXZhdGVkKHRydWUpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxCcmVha3BvaW50c1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdkZWJ1Zy5lZGl0QnJlYWtwb2ludCcsXG5cdFx0XHR2aWV3SWQ6IEJSRUFLUE9JTlRTX1ZJRVdfSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2VkaXRDb25kaXRpb24nLCBcIkVkaXQgQ29uZGl0aW9uLi4uXCIpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5lZGl0LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0JSRUFLUE9JTlRfU1VQUE9SVFNfQ09ORElUSU9OLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5EZWJ1Z0JyZWFrcG9pbnRzQ29udGV4dCxcblx0XHRcdFx0d2hlbjogQ09OVEVYVF9CUkVBS1BPSU5UX0lURU1fVFlQRS5ub3RFcXVhbHNUbygnZnVuY3Rpb25CcmVha3BvaW50JyksXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxMFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkRlYnVnQnJlYWtwb2ludHNDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ2lubGluZScsXG5cdFx0XHRcdG9yZGVyOiAxMFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bkluVmlldyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogQnJlYWtwb2ludHNWaWV3LCBicmVha3BvaW50OiBFeGNlcHRpb25CcmVha3BvaW50IHwgQnJlYWtwb2ludCB8IEZ1bmN0aW9uQnJlYWtwb2ludCB8IERhdGFCcmVha3BvaW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgQnJlYWtwb2ludCkge1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgb3BlbkJyZWFrcG9pbnRTb3VyY2UoYnJlYWtwb2ludCwgZmFsc2UsIGZhbHNlLCB0cnVlLCBkZWJ1Z1NlcnZpY2UsIGVkaXRvclNlcnZpY2UpO1xuXHRcdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0XHRjb25zdCBjb2RlRWRpdG9yID0gZWRpdG9yLmdldENvbnRyb2woKTtcblx0XHRcdFx0aWYgKGlzQ29kZUVkaXRvcihjb2RlRWRpdG9yKSkge1xuXHRcdFx0XHRcdGNvZGVFZGl0b3IuZ2V0Q29udHJpYnV0aW9uPElCcmVha3BvaW50RWRpdG9yQ29udHJpYnV0aW9uPihCUkVBS1BPSU5UX0VESVRPUl9DT05UUklCVVRJT05fSUQpPy5zaG93QnJlYWtwb2ludFdpZGdldChicmVha3BvaW50LmxpbmVOdW1iZXIsIGJyZWFrcG9pbnQuY29sdW1uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoYnJlYWtwb2ludCBpbnN0YW5jZW9mIEZ1bmN0aW9uQnJlYWtwb2ludCkge1xuXHRcdFx0Y29uc3QgY29udGV4dE1lbnVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0TWVudVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgYWN0aW9uczogQWN0aW9uW10gPSBbbmV3IEFjdGlvbignYnJlYWtwb2ludC5lZGl0Q29uZGl0aW9uJywgbG9jYWxpemUoJ2VkaXRDb25kaXRpb24nLCBcIkVkaXQgQ29uZGl0aW9uLi4uXCIpLCB1bmRlZmluZWQsIHRydWUsIGFzeW5jICgpID0+IHZpZXcucmVuZGVySW5wdXRCb3goeyBicmVha3BvaW50LCB0eXBlOiAnY29uZGl0aW9uJyB9KSksXG5cdFx0XHRuZXcgQWN0aW9uKCdicmVha3BvaW50LmVkaXRDb25kaXRpb24nLCBsb2NhbGl6ZSgnZWRpdEhpdENvdW50JywgXCJFZGl0IEhpdCBDb3VudC4uLlwiKSwgdW5kZWZpbmVkLCB0cnVlLCBhc3luYyAoKSA9PiB2aWV3LnJlbmRlcklucHV0Qm94KHsgYnJlYWtwb2ludCwgdHlwZTogJ2hpdENvdW50JyB9KSldO1xuXHRcdFx0Y29uc3QgZG9tTm9kZSA9IGJyZWFrcG9pbnRJZFRvQWN0aW9uQmFyRG9tZU5vZGUuZ2V0KGJyZWFrcG9pbnQuZ2V0SWQoKSk7XG5cblx0XHRcdGlmIChkb21Ob2RlKSB7XG5cdFx0XHRcdGNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMsXG5cdFx0XHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBkb21Ob2RlLFxuXHRcdFx0XHRcdG9uSGlkZTogKCkgPT4gZGlzcG9zZShhY3Rpb25zKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dmlldy5yZW5kZXJJbnB1dEJveCh7IGJyZWFrcG9pbnQsIHR5cGU6ICdjb25kaXRpb24nIH0pO1xuXHRcdH1cblx0fVxufSk7XG5cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxCcmVha3BvaW50c1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdkZWJ1Zy5lZGl0RnVuY3Rpb25CcmVha3BvaW50Jyxcblx0XHRcdHZpZXdJZDogQlJFQUtQT0lOVFNfVklFV19JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZWRpdEJyZWFrcG9pbnQnLCBcIkVkaXQgRnVuY3Rpb24gQ29uZGl0aW9uLi4uXCIpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5EZWJ1Z0JyZWFrcG9pbnRzQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDEwLFxuXHRcdFx0XHR3aGVuOiBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLmlzRXF1YWxUbygnZnVuY3Rpb25CcmVha3BvaW50Jylcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRydW5JblZpZXcoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBCcmVha3BvaW50c1ZpZXcsIGJyZWFrcG9pbnQ6IElGdW5jdGlvbkJyZWFrcG9pbnQpIHtcblx0XHR2aWV3LnJlbmRlcklucHV0Qm94KHsgYnJlYWtwb2ludCwgdHlwZTogJ25hbWUnIH0pO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxCcmVha3BvaW50c1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdkZWJ1Zy5lZGl0RnVuY3Rpb25CcmVha3BvaW50SGl0Q291bnQnLFxuXHRcdFx0dmlld0lkOiBCUkVBS1BPSU5UU19WSUVXX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdlZGl0SGl0Q291bnQnLCBcIkVkaXQgSGl0IENvdW50Li4uXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX0JSRUFLUE9JTlRfU1VQUE9SVFNfQ09ORElUSU9OLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5EZWJ1Z0JyZWFrcG9pbnRzQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDIwLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLmlzRXF1YWxUbygnZnVuY3Rpb25CcmVha3BvaW50JyksIENPTlRFWFRfQlJFQUtQT0lOVF9JVEVNX1RZUEUuaXNFcXVhbFRvKCdkYXRhQnJlYWtwb2ludCcpKVxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bkluVmlldyhfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IEJyZWFrcG9pbnRzVmlldywgYnJlYWtwb2ludDogSUZ1bmN0aW9uQnJlYWtwb2ludCkge1xuXHRcdHZpZXcucmVuZGVySW5wdXRCb3goeyBicmVha3BvaW50LCB0eXBlOiAnaGl0Q291bnQnIH0pO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxCcmVha3BvaW50c1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdkZWJ1Zy5lZGl0QnJlYWtwb2ludE1vZGUnLFxuXHRcdFx0dmlld0lkOiBCUkVBS1BPSU5UU19WSUVXX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdlZGl0TW9kZScsIFwiRWRpdCBNb2RlLi4uXCIpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5EZWJ1Z0JyZWFrcG9pbnRzQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDIwLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Q09OVEVYVF9CUkVBS1BPSU5UX0hBU19NT0RFUyxcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLmlzRXF1YWxUbygnYnJlYWtwb2ludCcpLCBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLmlzRXF1YWxUbygnZXhjZXB0aW9uQnJlYWtwb2ludCcpLCBDT05URVhUX0JSRUFLUE9JTlRfSVRFTV9UWVBFLmlzRXF1YWxUbygnaW5zdHJ1Y3Rpb25CcmVha3BvaW50JykpXG5cdFx0XHRcdClcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5JblZpZXcoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IEJyZWFrcG9pbnRzVmlldywgYnJlYWtwb2ludDogSUJyZWFrcG9pbnQpIHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0Y29uc3Qga2luZCA9IGdldE1vZGVLaW5kRm9yQnJlYWtwb2ludChicmVha3BvaW50KTtcblx0XHRjb25zdCBtb2RlcyA9IGRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldEJyZWFrcG9pbnRNb2RlcyhraW5kKTtcblx0XHRjb25zdCBwaWNrZWQgPSBhd2FpdCBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKS5waWNrKFxuXHRcdFx0bW9kZXMubWFwKG1vZGUgPT4gKHsgbGFiZWw6IG1vZGUubGFiZWwsIGRlc2NyaXB0aW9uOiBtb2RlLmRlc2NyaXB0aW9uLCBtb2RlOiBtb2RlLm1vZGUgfSkpLFxuXHRcdFx0eyBwbGFjZUhvbGRlcjogbG9jYWxpemUoJ3NlbGVjdEJyZWFrcG9pbnRNb2RlJywgXCJTZWxlY3QgQnJlYWtwb2ludCBNb2RlXCIpIH1cblx0XHQpO1xuXG5cdFx0aWYgKCFwaWNrZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoa2luZCA9PT0gJ3NvdXJjZScpIHtcblx0XHRcdGNvbnN0IGRhdGEgPSBuZXcgTWFwPHN0cmluZywgSUJyZWFrcG9pbnRVcGRhdGVEYXRhPigpO1xuXHRcdFx0ZGF0YS5zZXQoYnJlYWtwb2ludC5nZXRJZCgpLCB7IG1vZGU6IHBpY2tlZC5tb2RlLCBtb2RlTGFiZWw6IHBpY2tlZC5sYWJlbCB9KTtcblx0XHRcdGRlYnVnU2VydmljZS51cGRhdGVCcmVha3BvaW50cyhicmVha3BvaW50Lm9yaWdpbmFsVXJpLCBkYXRhLCBmYWxzZSk7XG5cdFx0fSBlbHNlIGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgSW5zdHJ1Y3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRkZWJ1Z1NlcnZpY2UucmVtb3ZlSW5zdHJ1Y3Rpb25CcmVha3BvaW50cyhicmVha3BvaW50Lmluc3RydWN0aW9uUmVmZXJlbmNlLCBicmVha3BvaW50Lm9mZnNldCk7XG5cdFx0XHRkZWJ1Z1NlcnZpY2UuYWRkSW5zdHJ1Y3Rpb25CcmVha3BvaW50KHsgLi4uYnJlYWtwb2ludC50b0pTT04oKSwgbW9kZTogcGlja2VkLm1vZGUsIG1vZGVMYWJlbDogcGlja2VkLmxhYmVsIH0pO1xuXHRcdH0gZWxzZSBpZiAoYnJlYWtwb2ludCBpbnN0YW5jZW9mIEV4Y2VwdGlvbkJyZWFrcG9pbnQpIHtcblx0XHRcdGJyZWFrcG9pbnQubW9kZSA9IHBpY2tlZC5tb2RlO1xuXHRcdFx0YnJlYWtwb2ludC5tb2RlTGFiZWwgPSBwaWNrZWQubGFiZWw7XG5cdFx0XHRkZWJ1Z1NlcnZpY2Uuc2V0RXhjZXB0aW9uQnJlYWtwb2ludENvbmRpdGlvbihicmVha3BvaW50LCBicmVha3BvaW50LmNvbmRpdGlvbik7IC8vIG5vLW9wIHRvIHRyaWdnZXIgYSByZS1zZW5kXG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGlCQUFpQjtBQUUxQixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQjtBQUd6QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGNBQWM7QUFDdkIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZUFBZTtBQUN4QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsZUFBZTtBQUN6QyxZQUFZLGVBQWU7QUFDM0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLHFCQUFxQiw2QkFBNkI7QUFDM0QsU0FBUyxTQUFnQixjQUFjLFFBQVEsdUJBQXVCO0FBQ3RFLFNBQVMsNkJBQTZCO0FB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
