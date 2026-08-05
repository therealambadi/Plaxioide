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
import { HighlightedLabel } from "../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { Action } from "../../../../base/common/actions.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { createMatches } from "../../../../base/common/filters.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewAction, ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED, CONTEXT_BREAK_WHEN_VALUE_IS_ACCESSED_SUPPORTED, CONTEXT_BREAK_WHEN_VALUE_IS_READ_SUPPORTED, CONTEXT_VARIABLES_FOCUSED, DataBreakpointSetType, DebugVisualizationType, IDebugService, VARIABLES_VIEW_ID, WATCH_VIEW_ID } from "../common/debug.js";
import { getContextForVariable } from "../common/debugContext.js";
import { ErrorScope, Expression, Scope, StackFrame, Variable, VisualizedExpression, getUriForDebugMemory } from "../common/debugModel.js";
import { IDebugVisualizerService } from "../common/debugVisualizers.js";
import { AbstractExpressionDataSource, AbstractExpressionsRenderer, expressionAndScopeLabelProvider, renderViewTree } from "./baseDebugView.js";
import { ADD_TO_WATCH_ID, ADD_TO_WATCH_LABEL, COPY_EVALUATE_PATH_ID, COPY_EVALUATE_PATH_LABEL, COPY_VALUE_ID, COPY_VALUE_LABEL } from "./debugCommands.js";
import { DebugExpressionRenderer } from "./debugExpressionRenderer.js";
const $ = dom.$;
let forgetScopes = true;
let variableInternalContext;
let dataBreakpointInfoResponse;
let VariablesView = class extends ViewPane {
  constructor(options, contextMenuService, debugService, keybindingService, configurationService, instantiationService, viewDescriptorService, contextKeyService, openerService, themeService, hoverService, menuService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.debugService = debugService;
    this.menuService = menuService;
    this.needsRefresh = false;
    this.savedViewState = /* @__PURE__ */ new Map();
    this.autoExpandedScopes = /* @__PURE__ */ new Set();
    this.updateTreeScheduler = new RunOnceScheduler(async () => {
      const stackFrame = this.debugService.getViewModel().focusedStackFrame;
      this.needsRefresh = false;
      const input = this.tree.getInput();
      if (input) {
        this.savedViewState.set(input.getId(), this.tree.getViewState());
      }
      if (!stackFrame) {
        await this.tree.setInput(null);
        return;
      }
      const viewState = this.savedViewState.get(stackFrame.getId());
      await this.tree.setInput(stackFrame, viewState);
      const scopes = await stackFrame.getScopes();
      const toExpand = scopes.find((s) => !s.expensive);
      if (toExpand && this.tree.hasNode(toExpand)) {
        this.autoExpandedScopes.add(toExpand.getId());
        await this.tree.expand(toExpand);
      }
    }, 400);
  }
  get treeSelection() {
    return this.tree.getSelection();
  }
  renderBody(container) {
    super.renderBody(container);
    this.element.classList.add("debug-pane");
    container.classList.add("debug-variables");
    const treeContainer = renderViewTree(container);
    const expressionRenderer = this.instantiationService.createInstance(DebugExpressionRenderer);
    this.tree = this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "VariablesView",
      treeContainer,
      new VariablesDelegate(),
      [
        this.instantiationService.createInstance(VariablesRenderer, expressionRenderer),
        this.instantiationService.createInstance(VisualizedVariableRenderer, expressionRenderer),
        new ScopesRenderer(),
        new ScopeErrorRenderer()
      ],
      this.instantiationService.createInstance(VariablesDataSource),
      {
        accessibilityProvider: new VariablesAccessibilityProvider(),
        identityProvider: { getId: (element) => element.getId() },
        keyboardNavigationLabelProvider: expressionAndScopeLabelProvider,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    this._register(VisualizedVariableRenderer.rendererOnVisualizationRange(this.debugService.getViewModel(), this.tree));
    this.tree.setInput(this.debugService.getViewModel().focusedStackFrame ?? null);
    CONTEXT_VARIABLES_FOCUSED.bindTo(this.tree.contextKeyService);
    this._register(this.debugService.getViewModel().onDidFocusStackFrame((sf) => {
      if (!this.isBodyVisible()) {
        this.needsRefresh = true;
        return;
      }
      const timeout = sf.explicit ? 0 : void 0;
      this.updateTreeScheduler.schedule(timeout);
    }));
    this._register(this.debugService.getViewModel().onWillUpdateViews(() => {
      const stackFrame = this.debugService.getViewModel().focusedStackFrame;
      if (stackFrame && forgetScopes) {
        stackFrame.forgetScopes();
      }
      forgetScopes = true;
      this.tree.updateChildren();
    }));
    this._register(this.tree);
    this._register(this.tree.onMouseDblClick((e) => this.onMouseDblClick(e)));
    this._register(this.tree.onContextMenu(async (e) => await this.onContextMenu(e)));
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible && this.needsRefresh) {
        this.updateTreeScheduler.schedule();
      }
    }));
    let horizontalScrolling;
    this._register(this.debugService.getViewModel().onDidSelectExpression((e) => {
      const variable = e?.expression;
      if (variable && this.tree.hasNode(variable)) {
        horizontalScrolling = this.tree.options.horizontalScrolling;
        if (horizontalScrolling) {
          this.tree.updateOptions({ horizontalScrolling: false });
        }
        this.tree.rerender(variable);
      } else if (!e && horizontalScrolling !== void 0) {
        this.tree.updateOptions({ horizontalScrolling });
        horizontalScrolling = void 0;
      }
    }));
    this._register(this.debugService.getViewModel().onDidEvaluateLazyExpression(async (e) => {
      if (e instanceof Variable && this.tree.hasNode(e)) {
        await this.tree.updateChildren(e, false, true);
        await this.tree.expand(e);
      }
    }));
    this._register(this.debugService.onDidEndSession(() => {
      this.savedViewState.clear();
      this.autoExpandedScopes.clear();
    }));
  }
  layoutBody(width, height) {
    super.layoutBody(height, width);
    this.tree.layout(width, height);
  }
  focus() {
    super.focus();
    this.tree.domFocus();
  }
  collapseAll() {
    this.tree.collapseAll();
  }
  onMouseDblClick(e) {
    if (this.canSetExpressionValue(e.element)) {
      this.debugService.getViewModel().setSelectedExpression(e.element, false);
    }
  }
  canSetExpressionValue(e) {
    const session = this.debugService.getViewModel().focusedSession;
    if (!session) {
      return false;
    }
    if (e instanceof VisualizedExpression) {
      return !!e.treeItem.canEdit;
    }
    return e instanceof Variable && !e.presentationHint?.attributes?.includes("readOnly") && !e.presentationHint?.lazy;
  }
  async onContextMenu(e) {
    const variable = e.element;
    if (!(variable instanceof Variable) || !variable.value) {
      return;
    }
    return openContextMenuForVariableTreeElement(this.contextKeyService, this.menuService, this.contextMenuService, MenuId.DebugVariablesContext, e);
  }
};
VariablesView = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IDebugService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IViewDescriptorService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IMenuService)
], VariablesView);
async function openContextMenuForVariableTreeElement(parentContextKeyService, menuService, contextMenuService, menuId, e) {
  const variable = e.element;
  if (!(variable instanceof Variable) || !variable.value) {
    return;
  }
  const contextKeyService = await getContextForVariableMenuWithDataAccess(parentContextKeyService, variable);
  const context = getVariablesContext(variable);
  const menu = menuService.getMenuActions(menuId, contextKeyService, { arg: context, shouldForwardArgs: false });
  const { secondary } = getContextMenuActions(menu, "inline");
  contextMenuService.showContextMenu({
    getAnchor: () => e.anchor,
    getActions: () => secondary
  });
}
const getVariablesContext = (variable) => ({
  sessionId: variable.getSession()?.getId(),
  container: variable.parent instanceof Expression ? { expression: variable.parent.name } : variable.parent.toDebugProtocolObject(),
  variable: variable.toDebugProtocolObject()
});
async function getContextForVariableMenuWithDataAccess(parentContext, variable) {
  const session = variable.getSession();
  if (!session || !session.capabilities.supportsDataBreakpoints) {
    return getContextForVariableMenuBase(parentContext, variable);
  }
  const contextKeys = [];
  dataBreakpointInfoResponse = await session.dataBreakpointInfo(variable.name, variable.parent.reference);
  const dataBreakpointId = dataBreakpointInfoResponse?.dataId;
  const dataBreakpointAccessTypes = dataBreakpointInfoResponse?.accessTypes;
  if (!dataBreakpointAccessTypes) {
    contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED.key, !!dataBreakpointId]);
  } else {
    for (const accessType of dataBreakpointAccessTypes) {
      switch (accessType) {
        case "read":
          contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_IS_READ_SUPPORTED.key, !!dataBreakpointId]);
          break;
        case "write":
          contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED.key, !!dataBreakpointId]);
          break;
        case "readWrite":
          contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_IS_ACCESSED_SUPPORTED.key, !!dataBreakpointId]);
          break;
      }
    }
  }
  return getContextForVariableMenuBase(parentContext, variable, contextKeys);
}
function getContextForVariableMenuBase(parentContext, variable, additionalContext = []) {
  variableInternalContext = variable;
  return getContextForVariable(parentContext, variable, additionalContext);
}
function isStackFrame(obj) {
  return obj instanceof StackFrame;
}
class VariablesDataSource extends AbstractExpressionDataSource {
  hasChildren(element) {
    if (!element) {
      return false;
    }
    if (isStackFrame(element)) {
      return true;
    }
    return element.hasChildren;
  }
  doGetChildren(element) {
    if (isStackFrame(element)) {
      return element.getScopes();
    }
    return element.getChildren();
  }
}
class VariablesDelegate {
  getHeight(element) {
    return 22;
  }
  getTemplateId(element) {
    if (element instanceof ErrorScope) {
      return ScopeErrorRenderer.ID;
    }
    if (element instanceof Scope) {
      return ScopesRenderer.ID;
    }
    if (element instanceof VisualizedExpression) {
      return VisualizedVariableRenderer.ID;
    }
    return VariablesRenderer.ID;
  }
}
const _ScopesRenderer = class _ScopesRenderer {
  get templateId() {
    return _ScopesRenderer.ID;
  }
  renderTemplate(container) {
    const name = dom.append(container, $(".scope"));
    const label = new HighlightedLabel(name);
    return { name, label };
  }
  renderElement(element, index, templateData) {
    templateData.label.set(element.element.name, createMatches(element.filterData));
  }
  disposeTemplate(templateData) {
    templateData.label.dispose();
  }
};
_ScopesRenderer.ID = "scope";
let ScopesRenderer = _ScopesRenderer;
const _ScopeErrorRenderer = class _ScopeErrorRenderer {
  get templateId() {
    return _ScopeErrorRenderer.ID;
  }
  renderTemplate(container) {
    const wrapper = dom.append(container, $(".scope"));
    const error = dom.append(wrapper, $(".error"));
    return { error };
  }
  renderElement(element, index, templateData) {
    templateData.error.innerText = element.element.name;
  }
  disposeTemplate() {
  }
};
_ScopeErrorRenderer.ID = "scopeError";
let ScopeErrorRenderer = _ScopeErrorRenderer;
let VisualizedVariableRenderer = class extends AbstractExpressionsRenderer {
  constructor(expressionRenderer, debugService, contextViewService, hoverService, menuService, contextKeyService) {
    super(debugService, contextViewService, hoverService);
    this.expressionRenderer = expressionRenderer;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
  }
  /**
   * Registers a helper that rerenders the tree when visualization is requested
   * or cancelled./
   */
  static rendererOnVisualizationRange(model, tree) {
    return model.onDidChangeVisualization(({ original }) => {
      if (!tree.hasNode(original)) {
        return;
      }
      const parent = tree.getParentElement(original);
      tree.updateChildren(parent, false, false);
    });
  }
  get templateId() {
    return VisualizedVariableRenderer.ID;
  }
  renderElement(node, index, data) {
    data.elementDisposable.clear();
    super.renderExpressionElement(node.element, node, data);
  }
  renderExpression(expression, data, highlights) {
    const viz = expression;
    let text = viz.name;
    if (viz.value && typeof viz.name === "string") {
      text += ":";
    }
    data.label.set(text, highlights, viz.name);
    data.elementDisposable.add(this.expressionRenderer.renderValue(data.value, viz, {
      showChanged: false,
      maxValueLength: 1024,
      colorize: true,
      session: expression.getSession()
    }));
  }
  getInputBoxOptions(expression) {
    const viz = expression;
    return {
      initialValue: expression.value,
      ariaLabel: localize("variableValueAriaLabel", "Type new variable value"),
      validationOptions: {
        validation: () => viz.errorMessage ? { content: viz.errorMessage } : null
      },
      onFinish: (value, success) => {
        viz.errorMessage = void 0;
        if (success) {
          viz.edit(value).then(() => {
            forgetScopes = false;
            this.debugService.getViewModel().updateViews();
          });
        }
      }
    };
  }
  renderActionBar(actionBar, expression, _data) {
    const viz = expression;
    const contextKeyService = viz.original ? getContextForVariableMenuBase(this.contextKeyService, viz.original) : this.contextKeyService;
    const context = viz.original ? getVariablesContext(viz.original) : void 0;
    const menu = this.menuService.getMenuActions(MenuId.DebugVariablesContext, contextKeyService, { arg: context, shouldForwardArgs: false });
    const { primary } = getContextMenuActions(menu, "inline");
    if (viz.original) {
      const action = new Action("debugViz", localize("removeVisualizer", "Remove Visualizer"), ThemeIcon.asClassName(Codicon.eye), true, () => this.debugService.getViewModel().setVisualizedExpression(viz.original, void 0));
      action.checked = true;
      primary.push(action);
      actionBar.domNode.style.display = "initial";
    }
    actionBar.clear();
    actionBar.context = context;
    actionBar.push(primary, { icon: true, label: false });
  }
};
VisualizedVariableRenderer.ID = "viz";
VisualizedVariableRenderer = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IMenuService),
  __decorateParam(5, IContextKeyService)
], VisualizedVariableRenderer);
let VariablesRenderer = class extends AbstractExpressionsRenderer {
  constructor(expressionRenderer, menuService, contextKeyService, visualization, contextMenuService, debugService, contextViewService, hoverService) {
    super(debugService, contextViewService, hoverService);
    this.expressionRenderer = expressionRenderer;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.visualization = visualization;
    this.contextMenuService = contextMenuService;
  }
  get templateId() {
    return VariablesRenderer.ID;
  }
  renderExpression(expression, data, highlights) {
    data.elementDisposable.add(this.expressionRenderer.renderVariable(data, expression, {
      highlights,
      showChanged: true
    }));
  }
  renderElement(node, index, data) {
    data.elementDisposable.clear();
    super.renderExpressionElement(node.element, node, data);
  }
  getInputBoxOptions(expression) {
    const variable = expression;
    return {
      initialValue: expression.value,
      ariaLabel: localize("variableValueAriaLabel", "Type new variable value"),
      validationOptions: {
        validation: () => variable.errorMessage ? { content: variable.errorMessage } : null
      },
      onFinish: (value, success) => {
        variable.errorMessage = void 0;
        const focusedStackFrame = this.debugService.getViewModel().focusedStackFrame;
        if (success && variable.value !== value && focusedStackFrame) {
          variable.setVariable(value, focusedStackFrame).then(() => {
            forgetScopes = false;
            this.debugService.getViewModel().updateViews();
          });
        }
      }
    };
  }
  renderActionBar(actionBar, expression, data) {
    const variable = expression;
    const contextKeyService = getContextForVariableMenuBase(this.contextKeyService, variable);
    const context = getVariablesContext(variable);
    const menu = this.menuService.getMenuActions(MenuId.DebugVariablesContext, contextKeyService, { arg: context, shouldForwardArgs: false });
    const { primary } = getContextMenuActions(menu, "inline");
    actionBar.clear();
    actionBar.context = context;
    actionBar.push(primary, { icon: true, label: false });
    const cts = new CancellationTokenSource();
    data.elementDisposable.add(toDisposable(() => cts.dispose(true)));
    this.visualization.getApplicableFor(expression, cts.token).then((result) => {
      data.elementDisposable.add(result);
      const originalExpression = expression instanceof VisualizedExpression && expression.original || expression;
      const actions = result.object.map((v) => new Action("debugViz", v.name, v.iconClass || "debug-viz-icon", void 0, this.useVisualizer(v, originalExpression, cts.token)));
      if (actions.length === 0) {
      } else if (actions.length === 1) {
        actionBar.push(actions[0], { icon: true, label: false });
      } else {
        actionBar.push(new Action("debugViz", localize("useVisualizer", "Visualize Variable..."), ThemeIcon.asClassName(Codicon.eye), void 0, () => this.pickVisualizer(actions, originalExpression, data)), { icon: true, label: false });
      }
    });
  }
  pickVisualizer(actions, expression, data) {
    this.contextMenuService.showContextMenu({
      getAnchor: () => data.actionBar.getContainer(),
      getActions: () => actions
    });
  }
  useVisualizer(viz, expression, token) {
    return async () => {
      const resolved = await viz.resolve(token);
      if (token.isCancellationRequested) {
        return;
      }
      if (resolved.type === DebugVisualizationType.Command) {
        viz.execute();
      } else {
        const replacement = await this.visualization.getVisualizedNodeFor(resolved.id, expression);
        if (replacement) {
          this.debugService.getViewModel().setVisualizedExpression(expression, replacement);
        }
      }
    };
  }
};
VariablesRenderer.ID = "variable";
VariablesRenderer = __decorateClass([
  __decorateParam(1, IMenuService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IDebugVisualizerService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IDebugService),
  __decorateParam(6, IContextViewService),
  __decorateParam(7, IHoverService)
], VariablesRenderer);
class VariablesAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize("variablesAriaTreeLabel", "Debug Variables");
  }
  getAriaLabel(element) {
    if (element instanceof Scope) {
      return localize("variableScopeAriaLabel", "Scope {0}", element.name);
    }
    if (element instanceof Variable) {
      return localize({ key: "variableAriaLabel", comment: ["Placeholders are variable name and variable value respectivly. They should not be translated."] }, "{0}, value {1}", element.name, element.value);
    }
    return null;
  }
}
const SET_VARIABLE_ID = "debug.setVariable";
CommandsRegistry.registerCommand({
  id: SET_VARIABLE_ID,
  handler: (accessor) => {
    const debugService = accessor.get(IDebugService);
    debugService.getViewModel().setSelectedExpression(variableInternalContext, false);
  }
});
CommandsRegistry.registerCommand({
  metadata: {
    description: COPY_VALUE_LABEL
  },
  id: COPY_VALUE_ID,
  handler: async (accessor, arg, ctx) => {
    if (!arg) {
      const viewService = accessor.get(IViewsService);
      const view = viewService.getActiveViewWithId(WATCH_VIEW_ID) || viewService.getActiveViewWithId(VARIABLES_VIEW_ID);
      if (view) {
      }
    }
    const debugService = accessor.get(IDebugService);
    const clipboardService = accessor.get(IClipboardService);
    let elementContext = "";
    let elements;
    if (!arg) {
      const viewService = accessor.get(IViewsService);
      const focusedView = viewService.getFocusedView();
      let view;
      if (focusedView?.id === WATCH_VIEW_ID) {
        view = viewService.getActiveViewWithId(WATCH_VIEW_ID);
        elementContext = "watch";
      } else if (focusedView?.id === VARIABLES_VIEW_ID) {
        view = viewService.getActiveViewWithId(VARIABLES_VIEW_ID);
        elementContext = "variables";
      }
      if (!view) {
        return;
      }
      elements = view.treeSelection.filter((e) => e instanceof Expression || e instanceof Variable);
    } else if (arg instanceof Variable || arg instanceof Expression) {
      elementContext = "watch";
      elements = ctx ? ctx : [];
    } else {
      elementContext = "variables";
      elements = variableInternalContext ? [variableInternalContext] : [];
    }
    const stackFrame = debugService.getViewModel().focusedStackFrame;
    const session = debugService.getViewModel().focusedSession;
    if (!stackFrame || !session || elements.length === 0) {
      return;
    }
    const evalContext = session.capabilities.supportsClipboardContext ? "clipboard" : elementContext;
    const toEvaluate = elements.map((element) => element instanceof Variable ? element.evaluateName || element.value : element.name);
    try {
      const evaluations = await Promise.all(toEvaluate.map((expr) => session.evaluate(expr, stackFrame.frameId, evalContext)));
      const result = coalesce(evaluations).map((evaluation) => evaluation.body.result);
      if (result.length) {
        clipboardService.writeText(result.join("\n"));
      }
    } catch (e) {
      const result = elements.map((element) => element.value);
      clipboardService.writeText(result.join("\n"));
    }
  }
});
const VIEW_MEMORY_ID = "workbench.debug.viewlet.action.viewMemory";
const HEX_EDITOR_EXTENSION_ID = "ms-vscode.hexeditor";
const HEX_EDITOR_EDITOR_ID = "hexEditor.hexedit";
CommandsRegistry.registerCommand({
  id: VIEW_MEMORY_ID,
  handler: async (accessor, arg, ctx) => {
    const debugService = accessor.get(IDebugService);
    let sessionId;
    let memoryReference;
    if ("sessionId" in arg) {
      if (!arg.sessionId || !arg.variable.memoryReference) {
        return;
      }
      sessionId = arg.sessionId;
      memoryReference = arg.variable.memoryReference;
    } else {
      if (!arg.memoryReference) {
        return;
      }
      const focused = debugService.getViewModel().focusedSession;
      if (!focused) {
        return;
      }
      sessionId = focused.getId();
      memoryReference = arg.memoryReference;
    }
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    const editorService = accessor.get(IEditorService);
    const notificationService = accessor.get(INotificationService);
    const extensionService = accessor.get(IExtensionService);
    const telemetryService = accessor.get(ITelemetryService);
    const ext = await extensionService.getExtension(HEX_EDITOR_EXTENSION_ID);
    if (ext || await tryInstallHexEditor(extensionsWorkbenchService, notificationService)) {
      telemetryService.publicLog("debug/didViewMemory", {
        debugType: debugService.getModel().getSession(sessionId)?.configuration.type
      });
      await editorService.openEditor({
        resource: getUriForDebugMemory(sessionId, memoryReference),
        options: {
          revealIfOpened: true,
          override: HEX_EDITOR_EDITOR_ID
        }
      }, SIDE_GROUP);
    }
  }
});
async function tryInstallHexEditor(extensionsWorkbenchService, notificationService) {
  try {
    await extensionsWorkbenchService.install(HEX_EDITOR_EXTENSION_ID, {
      justification: localize("viewMemory.prompt", "Inspecting binary data requires this extension."),
      enable: true
    }, ProgressLocation.Notification);
    return true;
  } catch (error) {
    notificationService.error(error);
    return false;
  }
}
const BREAK_WHEN_VALUE_CHANGES_ID = "debug.breakWhenValueChanges";
CommandsRegistry.registerCommand({
  id: BREAK_WHEN_VALUE_CHANGES_ID,
  handler: async (accessor) => {
    const debugService = accessor.get(IDebugService);
    if (dataBreakpointInfoResponse) {
      await debugService.addDataBreakpoint({ description: dataBreakpointInfoResponse.description, src: { type: DataBreakpointSetType.Variable, dataId: dataBreakpointInfoResponse.dataId }, canPersist: !!dataBreakpointInfoResponse.canPersist, accessTypes: dataBreakpointInfoResponse.accessTypes, accessType: "write" });
    }
  }
});
const BREAK_WHEN_VALUE_IS_ACCESSED_ID = "debug.breakWhenValueIsAccessed";
CommandsRegistry.registerCommand({
  id: BREAK_WHEN_VALUE_IS_ACCESSED_ID,
  handler: async (accessor) => {
    const debugService = accessor.get(IDebugService);
    if (dataBreakpointInfoResponse) {
      await debugService.addDataBreakpoint({ description: dataBreakpointInfoResponse.description, src: { type: DataBreakpointSetType.Variable, dataId: dataBreakpointInfoResponse.dataId }, canPersist: !!dataBreakpointInfoResponse.canPersist, accessTypes: dataBreakpointInfoResponse.accessTypes, accessType: "readWrite" });
    }
  }
});
const BREAK_WHEN_VALUE_IS_READ_ID = "debug.breakWhenValueIsRead";
CommandsRegistry.registerCommand({
  id: BREAK_WHEN_VALUE_IS_READ_ID,
  handler: async (accessor) => {
    const debugService = accessor.get(IDebugService);
    if (dataBreakpointInfoResponse) {
      await debugService.addDataBreakpoint({ description: dataBreakpointInfoResponse.description, src: { type: DataBreakpointSetType.Variable, dataId: dataBreakpointInfoResponse.dataId }, canPersist: !!dataBreakpointInfoResponse.canPersist, accessTypes: dataBreakpointInfoResponse.accessTypes, accessType: "read" });
    }
  }
});
CommandsRegistry.registerCommand({
  metadata: {
    description: COPY_EVALUATE_PATH_LABEL
  },
  id: COPY_EVALUATE_PATH_ID,
  handler: async (accessor, context) => {
    const clipboardService = accessor.get(IClipboardService);
    await clipboardService.writeText(context.variable.evaluateName);
  }
});
CommandsRegistry.registerCommand({
  metadata: {
    description: ADD_TO_WATCH_LABEL
  },
  id: ADD_TO_WATCH_ID,
  handler: async (accessor, context) => {
    const debugService = accessor.get(IDebugService);
    debugService.addWatchExpression(context.variable.evaluateName);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "variables.collapse",
      viewId: VARIABLES_VIEW_ID,
      title: localize("collapse", "Collapse All"),
      f1: false,
      icon: Codicon.collapseAll,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", VARIABLES_VIEW_ID)
      }
    });
  }
  runInView(_accessor, view) {
    view.collapseAll();
  }
});
export {
  BREAK_WHEN_VALUE_CHANGES_ID,
  BREAK_WHEN_VALUE_IS_ACCESSED_ID,
  BREAK_WHEN_VALUE_IS_READ_ID,
  SET_VARIABLE_ID,
  VIEW_MEMORY_ID,
  VariablesRenderer,
  VariablesView,
  VisualizedVariableRenderer,
  openContextMenuForVariableTreeElement
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL3ZhcmlhYmxlc1ZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBIaWdobGlnaHRlZExhYmVsLCBJSGlnaGxpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hpZ2hsaWdodGVkbGFiZWwvaGlnaGxpZ2h0ZWRMYWJlbC5qcyc7XG5pbXBvcnQgeyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IEFzeW5jRGF0YVRyZWUsIElBc3luY0RhdGFUcmVlVmlld1N0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvYXN5bmNEYXRhVHJlZS5qcyc7XG5pbXBvcnQgeyBJVHJlZUNvbnRleHRNZW51RXZlbnQsIElUcmVlTW91c2VFdmVudCwgSVRyZWVOb2RlLCBJVHJlZVJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUsIGNyZWF0ZU1hdGNoZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGdldENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSwgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaEFzeW5jRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBWaWV3QWN0aW9uLCBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVZpZXdsZXRWaWV3T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld3NWaWV3bGV0LmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UsIFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9CUkVBS19XSEVOX1ZBTFVFX0NIQU5HRVNfU1VQUE9SVEVELCBDT05URVhUX0JSRUFLX1dIRU5fVkFMVUVfSVNfQUNDRVNTRURfU1VQUE9SVEVELCBDT05URVhUX0JSRUFLX1dIRU5fVkFMVUVfSVNfUkVBRF9TVVBQT1JURUQsIENPTlRFWFRfVkFSSUFCTEVTX0ZPQ1VTRUQsIERhdGFCcmVha3BvaW50U2V0VHlwZSwgRGVidWdWaXN1YWxpemF0aW9uVHlwZSwgSURhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlLCBJRGVidWdTZXJ2aWNlLCBJRGVidWdWaWV3V2l0aFZhcmlhYmxlcywgSUV4cHJlc3Npb24sIElTY29wZSwgSVN0YWNrRnJhbWUsIElWaWV3TW9kZWwsIFZBUklBQkxFU19WSUVXX0lELCBXQVRDSF9WSUVXX0lEIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IGdldENvbnRleHRGb3JWYXJpYWJsZSB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z0NvbnRleHQuanMnO1xuaW1wb3J0IHsgRXJyb3JTY29wZSwgRXhwcmVzc2lvbiwgU2NvcGUsIFN0YWNrRnJhbWUsIFZhcmlhYmxlLCBWaXN1YWxpemVkRXhwcmVzc2lvbiwgZ2V0VXJpRm9yRGVidWdNZW1vcnkgfSBmcm9tICcuLi9jb21tb24vZGVidWdNb2RlbC5qcyc7XG5pbXBvcnQgeyBEZWJ1Z1Zpc3VhbGl6ZXIsIElEZWJ1Z1Zpc3VhbGl6ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnVmlzdWFsaXplcnMuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RFeHByZXNzaW9uRGF0YVNvdXJjZSwgQWJzdHJhY3RFeHByZXNzaW9uc1JlbmRlcmVyLCBleHByZXNzaW9uQW5kU2NvcGVMYWJlbFByb3ZpZGVyLCBJRXhwcmVzc2lvblRlbXBsYXRlRGF0YSwgSUlucHV0Qm94T3B0aW9ucywgcmVuZGVyVmlld1RyZWUgfSBmcm9tICcuL2Jhc2VEZWJ1Z1ZpZXcuanMnO1xuaW1wb3J0IHsgQUREX1RPX1dBVENIX0lELCBBRERfVE9fV0FUQ0hfTEFCRUwsIENPUFlfRVZBTFVBVEVfUEFUSF9JRCwgQ09QWV9FVkFMVUFURV9QQVRIX0xBQkVMLCBDT1BZX1ZBTFVFX0lELCBDT1BZX1ZBTFVFX0xBQkVMIH0gZnJvbSAnLi9kZWJ1Z0NvbW1hbmRzLmpzJztcbmltcG9ydCB7IERlYnVnRXhwcmVzc2lvblJlbmRlcmVyIH0gZnJvbSAnLi9kZWJ1Z0V4cHJlc3Npb25SZW5kZXJlci5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcbmxldCBmb3JnZXRTY29wZXMgPSB0cnVlO1xuXG5sZXQgdmFyaWFibGVJbnRlcm5hbENvbnRleHQ6IFZhcmlhYmxlIHwgdW5kZWZpbmVkO1xubGV0IGRhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlOiBJRGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2UgfCB1bmRlZmluZWQ7XG5cbmludGVyZmFjZSBJVmFyaWFibGVzQ29udGV4dCB7XG5cdHNlc3Npb25JZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRjb250YWluZXI6IERlYnVnUHJvdG9jb2wuVmFyaWFibGUgfCBEZWJ1Z1Byb3RvY29sLlNjb3BlIHwgRGVidWdQcm90b2NvbC5FdmFsdWF0ZUFyZ3VtZW50cztcblx0dmFyaWFibGU6IERlYnVnUHJvdG9jb2wuVmFyaWFibGU7XG59XG5cbmV4cG9ydCBjbGFzcyBWYXJpYWJsZXNWaWV3IGV4dGVuZHMgVmlld1BhbmUgaW1wbGVtZW50cyBJRGVidWdWaWV3V2l0aFZhcmlhYmxlcyB7XG5cblx0cHJpdmF0ZSB1cGRhdGVUcmVlU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIG5lZWRzUmVmcmVzaCA9IGZhbHNlO1xuXHRwcml2YXRlIHRyZWUhOiBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElTdGFja0ZyYW1lIHwgbnVsbCwgSUV4cHJlc3Npb24gfCBJU2NvcGUsIEZ1enp5U2NvcmU+O1xuXHRwcml2YXRlIHNhdmVkVmlld1N0YXRlID0gbmV3IE1hcDxzdHJpbmcsIElBc3luY0RhdGFUcmVlVmlld1N0YXRlPigpO1xuXHRwcml2YXRlIGF1dG9FeHBhbmRlZFNjb3BlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdHB1YmxpYyBnZXQgdHJlZVNlbGVjdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLmdldFNlbGVjdGlvbigpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdsZXRWaWV3T3B0aW9ucyxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihvcHRpb25zLCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIHRoZW1lU2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblxuXHRcdC8vIFVzZSBzY2hlZHVsZXIgdG8gcHJldmVudCB1bm5lY2Vzc2FyeSBmbGFzaGluZ1xuXHRcdHRoaXMudXBkYXRlVHJlZVNjaGVkdWxlciA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHN0YWNrRnJhbWUgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZTtcblxuXHRcdFx0dGhpcy5uZWVkc1JlZnJlc2ggPSBmYWxzZTtcblx0XHRcdGNvbnN0IGlucHV0ID0gdGhpcy50cmVlLmdldElucHV0KCk7XG5cdFx0XHRpZiAoaW5wdXQpIHtcblx0XHRcdFx0dGhpcy5zYXZlZFZpZXdTdGF0ZS5zZXQoaW5wdXQuZ2V0SWQoKSwgdGhpcy50cmVlLmdldFZpZXdTdGF0ZSgpKTtcblx0XHRcdH1cblx0XHRcdGlmICghc3RhY2tGcmFtZSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnRyZWUuc2V0SW5wdXQobnVsbCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgdmlld1N0YXRlID0gdGhpcy5zYXZlZFZpZXdTdGF0ZS5nZXQoc3RhY2tGcmFtZS5nZXRJZCgpKTtcblx0XHRcdGF3YWl0IHRoaXMudHJlZS5zZXRJbnB1dChzdGFja0ZyYW1lLCB2aWV3U3RhdGUpO1xuXG5cdFx0XHQvLyBBdXRvbWF0aWNhbGx5IGV4cGFuZCB0aGUgZmlyc3Qgbm9uLWV4cGVuc2l2ZSBzY29wZVxuXHRcdFx0Y29uc3Qgc2NvcGVzID0gYXdhaXQgc3RhY2tGcmFtZS5nZXRTY29wZXMoKTtcblx0XHRcdGNvbnN0IHRvRXhwYW5kID0gc2NvcGVzLmZpbmQocyA9PiAhcy5leHBlbnNpdmUpO1xuXG5cdFx0XHQvLyBBIHJhY2UgY29uZGl0aW9uIGNvdWxkIGJlIHByZXNlbnQgY2F1c2luZyB0aGUgc2NvcGVzIGhlcmUgdG8gYmUgZGlmZmVyZW50IGZyb20gdGhlIHNjb3BlcyB0aGF0IHRoZSB0cmVlIGp1c3QgcmV0cmlldmVkLlxuXHRcdFx0Ly8gSWYgdGhhdCBoYXBwZW5lZCwgZG9uJ3QgdHJ5IHRvIHJldmVhbCBhbnl0aGluZywgaXQgd2lsbCBiZSBzdHJhaWdodGVuZWQgb3V0IG9uIHRoZSBuZXh0IHVwZGF0ZVxuXHRcdFx0aWYgKHRvRXhwYW5kICYmIHRoaXMudHJlZS5oYXNOb2RlKHRvRXhwYW5kKSkge1xuXHRcdFx0XHR0aGlzLmF1dG9FeHBhbmRlZFNjb3Blcy5hZGQodG9FeHBhbmQuZ2V0SWQoKSk7XG5cdFx0XHRcdGF3YWl0IHRoaXMudHJlZS5leHBhbmQodG9FeHBhbmQpO1xuXHRcdFx0fVxuXHRcdH0sIDQwMCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2RlYnVnLXBhbmUnKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZGVidWctdmFyaWFibGVzJyk7XG5cdFx0Y29uc3QgdHJlZUNvbnRhaW5lciA9IHJlbmRlclZpZXdUcmVlKGNvbnRhaW5lcik7XG5cdFx0Y29uc3QgZXhwcmVzc2lvblJlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlcik7XG5cdFx0dGhpcy50cmVlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElTdGFja0ZyYW1lIHwgbnVsbCwgSUV4cHJlc3Npb24gfCBJU2NvcGUsIEZ1enp5U2NvcmU+LCAnVmFyaWFibGVzVmlldycsIHRyZWVDb250YWluZXIsIG5ldyBWYXJpYWJsZXNEZWxlZ2F0ZSgpLFxuXHRcdFx0W1xuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZhcmlhYmxlc1JlbmRlcmVyLCBleHByZXNzaW9uUmVuZGVyZXIpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZpc3VhbGl6ZWRWYXJpYWJsZVJlbmRlcmVyLCBleHByZXNzaW9uUmVuZGVyZXIpLFxuXHRcdFx0XHRuZXcgU2NvcGVzUmVuZGVyZXIoKSxcblx0XHRcdFx0bmV3IFNjb3BlRXJyb3JSZW5kZXJlcigpLFxuXHRcdFx0XSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVmFyaWFibGVzRGF0YVNvdXJjZSksIHtcblx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IFZhcmlhYmxlc0FjY2Vzc2liaWxpdHlQcm92aWRlcigpLFxuXHRcdFx0aWRlbnRpdHlQcm92aWRlcjogeyBnZXRJZDogKGVsZW1lbnQ6IElFeHByZXNzaW9uIHwgSVNjb3BlKSA9PiBlbGVtZW50LmdldElkKCkgfSxcblx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IGV4cHJlc3Npb25BbmRTY29wZUxhYmVsUHJvdmlkZXIsXG5cdFx0XHRvdmVycmlkZVN0eWxlczogdGhpcy5nZXRMb2NhdGlvbkJhc2VkQ29sb3JzKCkubGlzdE92ZXJyaWRlU3R5bGVzXG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihWaXN1YWxpemVkVmFyaWFibGVSZW5kZXJlci5yZW5kZXJlck9uVmlzdWFsaXphdGlvblJhbmdlKHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLCB0aGlzLnRyZWUpKTtcblx0XHR0aGlzLnRyZWUuc2V0SW5wdXQodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWUgPz8gbnVsbCk7XG5cblx0XHRDT05URVhUX1ZBUklBQkxFU19GT0NVU0VELmJpbmRUbyh0aGlzLnRyZWUuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRGb2N1c1N0YWNrRnJhbWUoc2YgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLmlzQm9keVZpc2libGUoKSkge1xuXHRcdFx0XHR0aGlzLm5lZWRzUmVmcmVzaCA9IHRydWU7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVmcmVzaCB0aGUgdHJlZSBpbW1lZGlhdGVseSBpZiB0aGUgdXNlciBleHBsaWN0bHkgY2hhbmdlZCBzdGFjayBmcmFtZXMuXG5cdFx0XHQvLyBPdGhlcndpc2UgcG9zdHBvbmUgdGhlIHJlZnJlc2ggdW50aWwgdXNlciBzdG9wcyBzdGVwcGluZy5cblx0XHRcdGNvbnN0IHRpbWVvdXQgPSBzZi5leHBsaWNpdCA/IDAgOiB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLnVwZGF0ZVRyZWVTY2hlZHVsZXIuc2NoZWR1bGUodGltZW91dCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLm9uV2lsbFVwZGF0ZVZpZXdzKCgpID0+IHtcblx0XHRcdGNvbnN0IHN0YWNrRnJhbWUgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU3RhY2tGcmFtZTtcblx0XHRcdGlmIChzdGFja0ZyYW1lICYmIGZvcmdldFNjb3Blcykge1xuXHRcdFx0XHRzdGFja0ZyYW1lLmZvcmdldFNjb3BlcygpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yZ2V0U2NvcGVzID0gdHJ1ZTtcblx0XHRcdHRoaXMudHJlZS51cGRhdGVDaGlsZHJlbigpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbk1vdXNlRGJsQ2xpY2soZSA9PiB0aGlzLm9uTW91c2VEYmxDbGljayhlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkNvbnRleHRNZW51KGFzeW5jIGUgPT4gYXdhaXQgdGhpcy5vbkNvbnRleHRNZW51KGUpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkodmlzaWJsZSA9PiB7XG5cdFx0XHRpZiAodmlzaWJsZSAmJiB0aGlzLm5lZWRzUmVmcmVzaCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVRyZWVTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0bGV0IGhvcml6b250YWxTY3JvbGxpbmc6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRTZWxlY3RFeHByZXNzaW9uKGUgPT4ge1xuXHRcdFx0Y29uc3QgdmFyaWFibGUgPSBlPy5leHByZXNzaW9uO1xuXHRcdFx0aWYgKHZhcmlhYmxlICYmIHRoaXMudHJlZS5oYXNOb2RlKHZhcmlhYmxlKSkge1xuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nID0gdGhpcy50cmVlLm9wdGlvbnMuaG9yaXpvbnRhbFNjcm9sbGluZztcblx0XHRcdFx0aWYgKGhvcml6b250YWxTY3JvbGxpbmcpIHtcblx0XHRcdFx0XHR0aGlzLnRyZWUudXBkYXRlT3B0aW9ucyh7IGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy50cmVlLnJlcmVuZGVyKHZhcmlhYmxlKTtcblx0XHRcdH0gZWxzZSBpZiAoIWUgJiYgaG9yaXpvbnRhbFNjcm9sbGluZyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMudHJlZS51cGRhdGVPcHRpb25zKHsgaG9yaXpvbnRhbFNjcm9sbGluZzogaG9yaXpvbnRhbFNjcm9sbGluZyB9KTtcblx0XHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZyA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRFdmFsdWF0ZUxhenlFeHByZXNzaW9uKGFzeW5jIGUgPT4ge1xuXHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBWYXJpYWJsZSAmJiB0aGlzLnRyZWUuaGFzTm9kZShlKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnRyZWUudXBkYXRlQ2hpbGRyZW4oZSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnRyZWUuZXhwYW5kKGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlYnVnU2VydmljZS5vbkRpZEVuZFNlc3Npb24oKCkgPT4ge1xuXHRcdFx0dGhpcy5zYXZlZFZpZXdTdGF0ZS5jbGVhcigpO1xuXHRcdFx0dGhpcy5hdXRvRXhwYW5kZWRTY29wZXMuY2xlYXIoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgbGF5b3V0Qm9keSh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHN1cGVyLmxheW91dEJvZHkoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0dGhpcy50cmVlLmxheW91dCh3aWR0aCwgaGVpZ2h0KTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0dGhpcy50cmVlLmRvbUZvY3VzKCk7XG5cdH1cblxuXHRjb2xsYXBzZUFsbCgpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUuY29sbGFwc2VBbGwoKTtcblx0fVxuXG5cdHByaXZhdGUgb25Nb3VzZURibENsaWNrKGU6IElUcmVlTW91c2VFdmVudDxJRXhwcmVzc2lvbiB8IElTY29wZT4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jYW5TZXRFeHByZXNzaW9uVmFsdWUoZS5lbGVtZW50KSkge1xuXHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuc2V0U2VsZWN0ZWRFeHByZXNzaW9uKGUuZWxlbWVudCwgZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2FuU2V0RXhwcmVzc2lvblZhbHVlKGU6IElFeHByZXNzaW9uIHwgSVNjb3BlIHwgbnVsbCk6IGUgaXMgSUV4cHJlc3Npb24ge1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRpZiAoIXNlc3Npb24pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoZSBpbnN0YW5jZW9mIFZpc3VhbGl6ZWRFeHByZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm4gISFlLnRyZWVJdGVtLmNhbkVkaXQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGUgaW5zdGFuY2VvZiBWYXJpYWJsZSAmJiAhZS5wcmVzZW50YXRpb25IaW50Py5hdHRyaWJ1dGVzPy5pbmNsdWRlcygncmVhZE9ubHknKSAmJiAhZS5wcmVzZW50YXRpb25IaW50Py5sYXp5O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbkNvbnRleHRNZW51KGU6IElUcmVlQ29udGV4dE1lbnVFdmVudDxJRXhwcmVzc2lvbiB8IElTY29wZT4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB2YXJpYWJsZSA9IGUuZWxlbWVudDtcblx0XHRpZiAoISh2YXJpYWJsZSBpbnN0YW5jZW9mIFZhcmlhYmxlKSB8fCAhdmFyaWFibGUudmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3BlbkNvbnRleHRNZW51Rm9yVmFyaWFibGVUcmVlRWxlbWVudCh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLm1lbnVTZXJ2aWNlLCB0aGlzLmNvbnRleHRNZW51U2VydmljZSwgTWVudUlkLkRlYnVnVmFyaWFibGVzQ29udGV4dCwgZSk7XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5Db250ZXh0TWVudUZvclZhcmlhYmxlVHJlZUVsZW1lbnQocGFyZW50Q29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSwgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLCBtZW51SWQ6IE1lbnVJZCwgZTogSVRyZWVDb250ZXh0TWVudUV2ZW50PElFeHByZXNzaW9uIHwgSVNjb3BlPikge1xuXHRjb25zdCB2YXJpYWJsZSA9IGUuZWxlbWVudDtcblx0aWYgKCEodmFyaWFibGUgaW5zdGFuY2VvZiBWYXJpYWJsZSkgfHwgIXZhcmlhYmxlLnZhbHVlKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhd2FpdCBnZXRDb250ZXh0Rm9yVmFyaWFibGVNZW51V2l0aERhdGFBY2Nlc3MocGFyZW50Q29udGV4dEtleVNlcnZpY2UsIHZhcmlhYmxlKTtcblx0Y29uc3QgY29udGV4dDogSVZhcmlhYmxlc0NvbnRleHQgPSBnZXRWYXJpYWJsZXNDb250ZXh0KHZhcmlhYmxlKTtcblx0Y29uc3QgbWVudSA9IG1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKG1lbnVJZCwgY29udGV4dEtleVNlcnZpY2UsIHsgYXJnOiBjb250ZXh0LCBzaG91bGRGb3J3YXJkQXJnczogZmFsc2UgfSk7XG5cblx0Y29uc3QgeyBzZWNvbmRhcnkgfSA9IGdldENvbnRleHRNZW51QWN0aW9ucyhtZW51LCAnaW5saW5lJyk7XG5cdGNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdGdldEFuY2hvcjogKCkgPT4gZS5hbmNob3IsXG5cdFx0Z2V0QWN0aW9uczogKCkgPT4gc2Vjb25kYXJ5XG5cdH0pO1xufVxuXG5jb25zdCBnZXRWYXJpYWJsZXNDb250ZXh0ID0gKHZhcmlhYmxlOiBWYXJpYWJsZSk6IElWYXJpYWJsZXNDb250ZXh0ID0+ICh7XG5cdHNlc3Npb25JZDogdmFyaWFibGUuZ2V0U2Vzc2lvbigpPy5nZXRJZCgpLFxuXHRjb250YWluZXI6IHZhcmlhYmxlLnBhcmVudCBpbnN0YW5jZW9mIEV4cHJlc3Npb25cblx0XHQ/IHsgZXhwcmVzc2lvbjogdmFyaWFibGUucGFyZW50Lm5hbWUgfVxuXHRcdDogKHZhcmlhYmxlLnBhcmVudCBhcyAoVmFyaWFibGUgfCBTY29wZSkpLnRvRGVidWdQcm90b2NvbE9iamVjdCgpLFxuXHR2YXJpYWJsZTogdmFyaWFibGUudG9EZWJ1Z1Byb3RvY29sT2JqZWN0KClcbn0pO1xuXG4vKipcbiAqIEdldHMgYSBjb250ZXh0IGtleSBvdmVybGF5IHRoYXQgaGFzIGNvbnRleHQgZm9yIHRoZSBnaXZlbiB2YXJpYWJsZSwgaW5jbHVkaW5nIGRhdGEgYWNjZXNzIGluZm8uXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldENvbnRleHRGb3JWYXJpYWJsZU1lbnVXaXRoRGF0YUFjY2VzcyhwYXJlbnRDb250ZXh0OiBJQ29udGV4dEtleVNlcnZpY2UsIHZhcmlhYmxlOiBWYXJpYWJsZSkge1xuXHRjb25zdCBzZXNzaW9uID0gdmFyaWFibGUuZ2V0U2Vzc2lvbigpO1xuXHRpZiAoIXNlc3Npb24gfHwgIXNlc3Npb24uY2FwYWJpbGl0aWVzLnN1cHBvcnRzRGF0YUJyZWFrcG9pbnRzKSB7XG5cdFx0cmV0dXJuIGdldENvbnRleHRGb3JWYXJpYWJsZU1lbnVCYXNlKHBhcmVudENvbnRleHQsIHZhcmlhYmxlKTtcblx0fVxuXG5cdGNvbnN0IGNvbnRleHRLZXlzOiBbc3RyaW5nLCB1bmtub3duXVtdID0gW107XG5cdGRhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlID0gYXdhaXQgc2Vzc2lvbi5kYXRhQnJlYWtwb2ludEluZm8odmFyaWFibGUubmFtZSwgdmFyaWFibGUucGFyZW50LnJlZmVyZW5jZSk7XG5cdGNvbnN0IGRhdGFCcmVha3BvaW50SWQgPSBkYXRhQnJlYWtwb2ludEluZm9SZXNwb25zZT8uZGF0YUlkO1xuXHRjb25zdCBkYXRhQnJlYWtwb2ludEFjY2Vzc1R5cGVzID0gZGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2U/LmFjY2Vzc1R5cGVzO1xuXG5cdGlmICghZGF0YUJyZWFrcG9pbnRBY2Nlc3NUeXBlcykge1xuXHRcdGNvbnRleHRLZXlzLnB1c2goW0NPTlRFWFRfQlJFQUtfV0hFTl9WQUxVRV9DSEFOR0VTX1NVUFBPUlRFRC5rZXksICEhZGF0YUJyZWFrcG9pbnRJZF0pO1xuXHR9IGVsc2Uge1xuXHRcdGZvciAoY29uc3QgYWNjZXNzVHlwZSBvZiBkYXRhQnJlYWtwb2ludEFjY2Vzc1R5cGVzKSB7XG5cdFx0XHRzd2l0Y2ggKGFjY2Vzc1R5cGUpIHtcblx0XHRcdFx0Y2FzZSAncmVhZCc6XG5cdFx0XHRcdFx0Y29udGV4dEtleXMucHVzaChbQ09OVEVYVF9CUkVBS19XSEVOX1ZBTFVFX0lTX1JFQURfU1VQUE9SVEVELmtleSwgISFkYXRhQnJlYWtwb2ludElkXSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3dyaXRlJzpcblx0XHRcdFx0XHRjb250ZXh0S2V5cy5wdXNoKFtDT05URVhUX0JSRUFLX1dIRU5fVkFMVUVfQ0hBTkdFU19TVVBQT1JURUQua2V5LCAhIWRhdGFCcmVha3BvaW50SWRdKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAncmVhZFdyaXRlJzpcblx0XHRcdFx0XHRjb250ZXh0S2V5cy5wdXNoKFtDT05URVhUX0JSRUFLX1dIRU5fVkFMVUVfSVNfQUNDRVNTRURfU1VQUE9SVEVELmtleSwgISFkYXRhQnJlYWtwb2ludElkXSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGdldENvbnRleHRGb3JWYXJpYWJsZU1lbnVCYXNlKHBhcmVudENvbnRleHQsIHZhcmlhYmxlLCBjb250ZXh0S2V5cyk7XG59XG5cbi8qKlxuICogR2V0cyBhIGNvbnRleHQga2V5IG92ZXJsYXkgdGhhdCBoYXMgY29udGV4dCBmb3IgdGhlIGdpdmVuIHZhcmlhYmxlLlxuICovXG5mdW5jdGlvbiBnZXRDb250ZXh0Rm9yVmFyaWFibGVNZW51QmFzZShwYXJlbnRDb250ZXh0OiBJQ29udGV4dEtleVNlcnZpY2UsIHZhcmlhYmxlOiBWYXJpYWJsZSwgYWRkaXRpb25hbENvbnRleHQ6IFtzdHJpbmcsIHVua25vd25dW10gPSBbXSkge1xuXHR2YXJpYWJsZUludGVybmFsQ29udGV4dCA9IHZhcmlhYmxlO1xuXHRyZXR1cm4gZ2V0Q29udGV4dEZvclZhcmlhYmxlKHBhcmVudENvbnRleHQsIHZhcmlhYmxlLCBhZGRpdGlvbmFsQ29udGV4dCk7XG59XG5cbmZ1bmN0aW9uIGlzU3RhY2tGcmFtZShvYmo6IGFueSk6IG9iaiBpcyBJU3RhY2tGcmFtZSB7XG5cdHJldHVybiBvYmogaW5zdGFuY2VvZiBTdGFja0ZyYW1lO1xufVxuXG5jbGFzcyBWYXJpYWJsZXNEYXRhU291cmNlIGV4dGVuZHMgQWJzdHJhY3RFeHByZXNzaW9uRGF0YVNvdXJjZTxJU3RhY2tGcmFtZSB8IG51bGwsIElFeHByZXNzaW9uIHwgSVNjb3BlPiB7XG5cblx0cHVibGljIG92ZXJyaWRlIGhhc0NoaWxkcmVuKGVsZW1lbnQ6IElTdGFja0ZyYW1lIHwgbnVsbCB8IElFeHByZXNzaW9uIHwgSVNjb3BlKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChpc1N0YWNrRnJhbWUoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50Lmhhc0NoaWxkcmVuO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGRvR2V0Q2hpbGRyZW4oZWxlbWVudDogSVN0YWNrRnJhbWUgfCBJRXhwcmVzc2lvbiB8IElTY29wZSk6IFByb21pc2U8KElFeHByZXNzaW9uIHwgSVNjb3BlKVtdPiB7XG5cdFx0aWYgKGlzU3RhY2tGcmFtZShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQuZ2V0U2NvcGVzKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVsZW1lbnQuZ2V0Q2hpbGRyZW4oKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSVNjb3BlVGVtcGxhdGVEYXRhIHtcblx0bmFtZTogSFRNTEVsZW1lbnQ7XG5cdGxhYmVsOiBIaWdobGlnaHRlZExhYmVsO1xufVxuXG5jbGFzcyBWYXJpYWJsZXNEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPElFeHByZXNzaW9uIHwgSVNjb3BlPiB7XG5cblx0Z2V0SGVpZ2h0KGVsZW1lbnQ6IElFeHByZXNzaW9uIHwgSVNjb3BlKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMjI7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IElFeHByZXNzaW9uIHwgSVNjb3BlKTogc3RyaW5nIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEVycm9yU2NvcGUpIHtcblx0XHRcdHJldHVybiBTY29wZUVycm9yUmVuZGVyZXIuSUQ7XG5cdFx0fVxuXG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBTY29wZSkge1xuXHRcdFx0cmV0dXJuIFNjb3Blc1JlbmRlcmVyLklEO1xuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVmlzdWFsaXplZEV4cHJlc3Npb24pIHtcblx0XHRcdHJldHVybiBWaXN1YWxpemVkVmFyaWFibGVSZW5kZXJlci5JRDtcblx0XHR9XG5cblx0XHRyZXR1cm4gVmFyaWFibGVzUmVuZGVyZXIuSUQ7XG5cdH1cbn1cblxuY2xhc3MgU2NvcGVzUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPElTY29wZSwgRnV6enlTY29yZSwgSVNjb3BlVGVtcGxhdGVEYXRhPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3Njb3BlJztcblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBTY29wZXNSZW5kZXJlci5JRDtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJU2NvcGVUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IG5hbWUgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNjb3BlJykpO1xuXHRcdGNvbnN0IGxhYmVsID0gbmV3IEhpZ2hsaWdodGVkTGFiZWwobmFtZSk7XG5cblx0XHRyZXR1cm4geyBuYW1lLCBsYWJlbCB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8SVNjb3BlLCBGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU2NvcGVUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0KGVsZW1lbnQuZWxlbWVudC5uYW1lLCBjcmVhdGVNYXRjaGVzKGVsZW1lbnQuZmlsdGVyRGF0YSkpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVNjb3BlVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSVNjb3BlRXJyb3JUZW1wbGF0ZURhdGEge1xuXHRlcnJvcjogSFRNTEVsZW1lbnQ7XG59XG5cbmNsYXNzIFNjb3BlRXJyb3JSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8SVNjb3BlLCBGdXp6eVNjb3JlLCBJU2NvcGVFcnJvclRlbXBsYXRlRGF0YT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdzY29wZUVycm9yJztcblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBTY29wZUVycm9yUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVNjb3BlRXJyb3JUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IHdyYXBwZXIgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNjb3BlJykpO1xuXHRcdGNvbnN0IGVycm9yID0gZG9tLmFwcGVuZCh3cmFwcGVyLCAkKCcuZXJyb3InKSk7XG5cdFx0cmV0dXJuIHsgZXJyb3IgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPElTY29wZSwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVNjb3BlRXJyb3JUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZXJyb3IuaW5uZXJUZXh0ID0gZWxlbWVudC5lbGVtZW50Lm5hbWU7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUoKTogdm9pZCB7XG5cdFx0Ly8gbm9vcFxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBWaXN1YWxpemVkVmFyaWFibGVSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0RXhwcmVzc2lvbnNSZW5kZXJlciB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAndml6JztcblxuXHQvKipcblx0ICogUmVnaXN0ZXJzIGEgaGVscGVyIHRoYXQgcmVyZW5kZXJzIHRoZSB0cmVlIHdoZW4gdmlzdWFsaXphdGlvbiBpcyByZXF1ZXN0ZWRcblx0ICogb3IgY2FuY2VsbGVkLi9cblx0ICovXG5cdHB1YmxpYyBzdGF0aWMgcmVuZGVyZXJPblZpc3VhbGl6YXRpb25SYW5nZShtb2RlbDogSVZpZXdNb2RlbCwgdHJlZTogQXN5bmNEYXRhVHJlZTxhbnksIGFueSwgYW55Pik6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gbW9kZWwub25EaWRDaGFuZ2VWaXN1YWxpemF0aW9uKCh7IG9yaWdpbmFsIH0pID0+IHtcblx0XHRcdGlmICghdHJlZS5oYXNOb2RlKG9yaWdpbmFsKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHBhcmVudDogSUV4cHJlc3Npb24gPSB0cmVlLmdldFBhcmVudEVsZW1lbnQob3JpZ2luYWwpO1xuXHRcdFx0dHJlZS51cGRhdGVDaGlsZHJlbihwYXJlbnQsIGZhbHNlLCBmYWxzZSk7XG5cdFx0fSk7XG5cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXhwcmVzc2lvblJlbmRlcmVyOiBEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlcixcblx0XHRASURlYnVnU2VydmljZSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoZGVidWdTZXJ2aWNlLCBjb250ZXh0Vmlld1NlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gVmlzdWFsaXplZFZhcmlhYmxlUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SUV4cHJlc3Npb24sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCBkYXRhOiBJRXhwcmVzc2lvblRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRzdXBlci5yZW5kZXJFeHByZXNzaW9uRWxlbWVudChub2RlLmVsZW1lbnQsIG5vZGUsIGRhdGEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckV4cHJlc3Npb24oZXhwcmVzc2lvbjogSUV4cHJlc3Npb24sIGRhdGE6IElFeHByZXNzaW9uVGVtcGxhdGVEYXRhLCBoaWdobGlnaHRzOiBJSGlnaGxpZ2h0W10pOiB2b2lkIHtcblx0XHRjb25zdCB2aXogPSBleHByZXNzaW9uIGFzIFZpc3VhbGl6ZWRFeHByZXNzaW9uO1xuXG5cdFx0bGV0IHRleHQgPSB2aXoubmFtZTtcblx0XHRpZiAodml6LnZhbHVlICYmIHR5cGVvZiB2aXoubmFtZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRleHQgKz0gJzonO1xuXHRcdH1cblx0XHRkYXRhLmxhYmVsLnNldCh0ZXh0LCBoaWdobGlnaHRzLCB2aXoubmFtZSk7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5hZGQodGhpcy5leHByZXNzaW9uUmVuZGVyZXIucmVuZGVyVmFsdWUoZGF0YS52YWx1ZSwgdml6LCB7XG5cdFx0XHRzaG93Q2hhbmdlZDogZmFsc2UsXG5cdFx0XHRtYXhWYWx1ZUxlbmd0aDogMTAyNCxcblx0XHRcdGNvbG9yaXplOiB0cnVlLFxuXHRcdFx0c2Vzc2lvbjogZXhwcmVzc2lvbi5nZXRTZXNzaW9uKCksXG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldElucHV0Qm94T3B0aW9ucyhleHByZXNzaW9uOiBJRXhwcmVzc2lvbik6IElJbnB1dEJveE9wdGlvbnMgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHZpeiA9IDxWaXN1YWxpemVkRXhwcmVzc2lvbj5leHByZXNzaW9uO1xuXHRcdHJldHVybiB7XG5cdFx0XHRpbml0aWFsVmFsdWU6IGV4cHJlc3Npb24udmFsdWUsXG5cdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCd2YXJpYWJsZVZhbHVlQXJpYUxhYmVsJywgXCJUeXBlIG5ldyB2YXJpYWJsZSB2YWx1ZVwiKSxcblx0XHRcdHZhbGlkYXRpb25PcHRpb25zOiB7XG5cdFx0XHRcdHZhbGlkYXRpb246ICgpID0+IHZpei5lcnJvck1lc3NhZ2UgPyAoeyBjb250ZW50OiB2aXouZXJyb3JNZXNzYWdlIH0pIDogbnVsbFxuXHRcdFx0fSxcblx0XHRcdG9uRmluaXNoOiAodmFsdWU6IHN0cmluZywgc3VjY2VzczogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHR2aXouZXJyb3JNZXNzYWdlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoc3VjY2Vzcykge1xuXHRcdFx0XHRcdHZpei5lZGl0KHZhbHVlKS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRcdC8vIERvIG5vdCByZWZyZXNoIHNjb3BlcyBkdWUgdG8gYSBub2RlIGxpbWl0YXRpb24gIzE1NTIwXG5cdFx0XHRcdFx0XHRmb3JnZXRTY29wZXMgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLnVwZGF0ZVZpZXdzKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckFjdGlvbkJhcihhY3Rpb25CYXI6IEFjdGlvbkJhciwgZXhwcmVzc2lvbjogSUV4cHJlc3Npb24sIF9kYXRhOiBJRXhwcmVzc2lvblRlbXBsYXRlRGF0YSkge1xuXHRcdGNvbnN0IHZpeiA9IGV4cHJlc3Npb24gYXMgVmlzdWFsaXplZEV4cHJlc3Npb247XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSB2aXoub3JpZ2luYWwgPyBnZXRDb250ZXh0Rm9yVmFyaWFibGVNZW51QmFzZSh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB2aXoub3JpZ2luYWwpIDogdGhpcy5jb250ZXh0S2V5U2VydmljZTtcblx0XHRjb25zdCBjb250ZXh0ID0gdml6Lm9yaWdpbmFsID8gZ2V0VmFyaWFibGVzQ29udGV4dCh2aXoub3JpZ2luYWwpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1lbnUgPSB0aGlzLm1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKE1lbnVJZC5EZWJ1Z1ZhcmlhYmxlc0NvbnRleHQsIGNvbnRleHRLZXlTZXJ2aWNlLCB7IGFyZzogY29udGV4dCwgc2hvdWxkRm9yd2FyZEFyZ3M6IGZhbHNlIH0pO1xuXG5cdFx0Y29uc3QgeyBwcmltYXJ5IH0gPSBnZXRDb250ZXh0TWVudUFjdGlvbnMobWVudSwgJ2lubGluZScpO1xuXG5cdFx0aWYgKHZpei5vcmlnaW5hbCkge1xuXHRcdFx0Y29uc3QgYWN0aW9uID0gbmV3IEFjdGlvbignZGVidWdWaXonLCBsb2NhbGl6ZSgncmVtb3ZlVmlzdWFsaXplcicsICdSZW1vdmUgVmlzdWFsaXplcicpLCBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5leWUpLCB0cnVlLCAoKSA9PiB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5zZXRWaXN1YWxpemVkRXhwcmVzc2lvbih2aXoub3JpZ2luYWwhLCB1bmRlZmluZWQpKTtcblx0XHRcdGFjdGlvbi5jaGVja2VkID0gdHJ1ZTtcblx0XHRcdHByaW1hcnkucHVzaChhY3Rpb24pO1xuXHRcdFx0YWN0aW9uQmFyLmRvbU5vZGUuc3R5bGUuZGlzcGxheSA9ICdpbml0aWFsJztcblx0XHR9XG5cdFx0YWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0YWN0aW9uQmFyLmNvbnRleHQgPSBjb250ZXh0O1xuXHRcdGFjdGlvbkJhci5wdXNoKHByaW1hcnksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBWYXJpYWJsZXNSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0RXhwcmVzc2lvbnNSZW5kZXJlciB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3ZhcmlhYmxlJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4cHJlc3Npb25SZW5kZXJlcjogRGVidWdFeHByZXNzaW9uUmVuZGVyZXIsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElEZWJ1Z1Zpc3VhbGl6ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdmlzdWFsaXphdGlvbjogSURlYnVnVmlzdWFsaXplclNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGRlYnVnU2VydmljZSwgY29udGV4dFZpZXdTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHR9XG5cblx0Z2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gVmFyaWFibGVzUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVuZGVyRXhwcmVzc2lvbihleHByZXNzaW9uOiBJRXhwcmVzc2lvbiwgZGF0YTogSUV4cHJlc3Npb25UZW1wbGF0ZURhdGEsIGhpZ2hsaWdodHM6IElIaWdobGlnaHRbXSk6IHZvaWQge1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGUuYWRkKHRoaXMuZXhwcmVzc2lvblJlbmRlcmVyLnJlbmRlclZhcmlhYmxlKGRhdGEsIGV4cHJlc3Npb24gYXMgVmFyaWFibGUsIHtcblx0XHRcdGhpZ2hsaWdodHMsXG5cdFx0XHRzaG93Q2hhbmdlZDogdHJ1ZSxcblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SUV4cHJlc3Npb24sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCBkYXRhOiBJRXhwcmVzc2lvblRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRzdXBlci5yZW5kZXJFeHByZXNzaW9uRWxlbWVudChub2RlLmVsZW1lbnQsIG5vZGUsIGRhdGEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldElucHV0Qm94T3B0aW9ucyhleHByZXNzaW9uOiBJRXhwcmVzc2lvbik6IElJbnB1dEJveE9wdGlvbnMge1xuXHRcdGNvbnN0IHZhcmlhYmxlID0gPFZhcmlhYmxlPmV4cHJlc3Npb247XG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxWYWx1ZTogZXhwcmVzc2lvbi52YWx1ZSxcblx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ3ZhcmlhYmxlVmFsdWVBcmlhTGFiZWwnLCBcIlR5cGUgbmV3IHZhcmlhYmxlIHZhbHVlXCIpLFxuXHRcdFx0dmFsaWRhdGlvbk9wdGlvbnM6IHtcblx0XHRcdFx0dmFsaWRhdGlvbjogKCkgPT4gdmFyaWFibGUuZXJyb3JNZXNzYWdlID8gKHsgY29udGVudDogdmFyaWFibGUuZXJyb3JNZXNzYWdlIH0pIDogbnVsbFxuXHRcdFx0fSxcblx0XHRcdG9uRmluaXNoOiAodmFsdWU6IHN0cmluZywgc3VjY2VzczogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHR2YXJpYWJsZS5lcnJvck1lc3NhZ2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IGZvY3VzZWRTdGFja0ZyYW1lID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWU7XG5cdFx0XHRcdGlmIChzdWNjZXNzICYmIHZhcmlhYmxlLnZhbHVlICE9PSB2YWx1ZSAmJiBmb2N1c2VkU3RhY2tGcmFtZSkge1xuXHRcdFx0XHRcdHZhcmlhYmxlLnNldFZhcmlhYmxlKHZhbHVlLCBmb2N1c2VkU3RhY2tGcmFtZSlcblx0XHRcdFx0XHRcdC8vIE5lZWQgdG8gZm9yY2Ugd2F0Y2ggZXhwcmVzc2lvbnMgYW5kIHZhcmlhYmxlcyB0byB1cGRhdGUgc2luY2UgYSB2YXJpYWJsZSBjaGFuZ2UgY2FuIGhhdmUgYW4gZWZmZWN0IG9uIGJvdGhcblx0XHRcdFx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRcdFx0Ly8gRG8gbm90IHJlZnJlc2ggc2NvcGVzIGR1ZSB0byBhIG5vZGUgbGltaXRhdGlvbiAjMTU1MjBcblx0XHRcdFx0XHRcdFx0Zm9yZ2V0U2NvcGVzID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLnVwZGF0ZVZpZXdzKCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQWN0aW9uQmFyKGFjdGlvbkJhcjogQWN0aW9uQmFyLCBleHByZXNzaW9uOiBJRXhwcmVzc2lvbiwgZGF0YTogSUV4cHJlc3Npb25UZW1wbGF0ZURhdGEpIHtcblx0XHRjb25zdCB2YXJpYWJsZSA9IGV4cHJlc3Npb24gYXMgVmFyaWFibGU7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBnZXRDb250ZXh0Rm9yVmFyaWFibGVNZW51QmFzZSh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB2YXJpYWJsZSk7XG5cblx0XHRjb25zdCBjb250ZXh0ID0gZ2V0VmFyaWFibGVzQ29udGV4dCh2YXJpYWJsZSk7XG5cdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLkRlYnVnVmFyaWFibGVzQ29udGV4dCwgY29udGV4dEtleVNlcnZpY2UsIHsgYXJnOiBjb250ZXh0LCBzaG91bGRGb3J3YXJkQXJnczogZmFsc2UgfSk7XG5cdFx0Y29uc3QgeyBwcmltYXJ5IH0gPSBnZXRDb250ZXh0TWVudUFjdGlvbnMobWVudSwgJ2lubGluZScpO1xuXG5cdFx0YWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0YWN0aW9uQmFyLmNvbnRleHQgPSBjb250ZXh0O1xuXHRcdGFjdGlvbkJhci5wdXNoKHByaW1hcnksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cdFx0dGhpcy52aXN1YWxpemF0aW9uLmdldEFwcGxpY2FibGVGb3IoZXhwcmVzc2lvbiwgY3RzLnRva2VuKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlLmFkZChyZXN1bHQpO1xuXG5cdFx0XHRjb25zdCBvcmlnaW5hbEV4cHJlc3Npb24gPSAoZXhwcmVzc2lvbiBpbnN0YW5jZW9mIFZpc3VhbGl6ZWRFeHByZXNzaW9uICYmIGV4cHJlc3Npb24ub3JpZ2luYWwpIHx8IGV4cHJlc3Npb247XG5cdFx0XHRjb25zdCBhY3Rpb25zID0gcmVzdWx0Lm9iamVjdC5tYXAodiA9PiBuZXcgQWN0aW9uKCdkZWJ1Z1ZpeicsIHYubmFtZSwgdi5pY29uQ2xhc3MgfHwgJ2RlYnVnLXZpei1pY29uJywgdW5kZWZpbmVkLCB0aGlzLnVzZVZpc3VhbGl6ZXIodiwgb3JpZ2luYWxFeHByZXNzaW9uLCBjdHMudG9rZW4pKSk7XG5cdFx0XHRpZiAoYWN0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Ly8gbm8tb3Bcblx0XHRcdH0gZWxzZSBpZiAoYWN0aW9ucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0YWN0aW9uQmFyLnB1c2goYWN0aW9uc1swXSwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhY3Rpb25CYXIucHVzaChuZXcgQWN0aW9uKCdkZWJ1Z1ZpeicsIGxvY2FsaXplKCd1c2VWaXN1YWxpemVyJywgJ1Zpc3VhbGl6ZSBWYXJpYWJsZS4uLicpLCBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5leWUpLCB1bmRlZmluZWQsICgpID0+IHRoaXMucGlja1Zpc3VhbGl6ZXIoYWN0aW9ucywgb3JpZ2luYWxFeHByZXNzaW9uLCBkYXRhKSksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBwaWNrVmlzdWFsaXplcihhY3Rpb25zOiBJQWN0aW9uW10sIGV4cHJlc3Npb246IElFeHByZXNzaW9uLCBkYXRhOiBJRXhwcmVzc2lvblRlbXBsYXRlRGF0YSkge1xuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGRhdGEuYWN0aW9uQmFyIS5nZXRDb250YWluZXIoKSxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMsXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHVzZVZpc3VhbGl6ZXIodml6OiBEZWJ1Z1Zpc3VhbGl6ZXIsIGV4cHJlc3Npb246IElFeHByZXNzaW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblx0XHRyZXR1cm4gYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWQgPSBhd2FpdCB2aXoucmVzb2x2ZSh0b2tlbik7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzb2x2ZWQudHlwZSA9PT0gRGVidWdWaXN1YWxpemF0aW9uVHlwZS5Db21tYW5kKSB7XG5cdFx0XHRcdHZpei5leGVjdXRlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCByZXBsYWNlbWVudCA9IGF3YWl0IHRoaXMudmlzdWFsaXphdGlvbi5nZXRWaXN1YWxpemVkTm9kZUZvcihyZXNvbHZlZC5pZCwgZXhwcmVzc2lvbik7XG5cdFx0XHRcdGlmIChyZXBsYWNlbWVudCkge1xuXHRcdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLnNldFZpc3VhbGl6ZWRFeHByZXNzaW9uKGV4cHJlc3Npb24sIHJlcGxhY2VtZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgVmFyaWFibGVzQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8SUV4cHJlc3Npb24gfCBJU2NvcGU+IHtcblxuXHRnZXRXaWRnZXRBcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ3ZhcmlhYmxlc0FyaWFUcmVlTGFiZWwnLCBcIkRlYnVnIFZhcmlhYmxlc1wiKTtcblx0fVxuXG5cdGdldEFyaWFMYWJlbChlbGVtZW50OiBJRXhwcmVzc2lvbiB8IElTY29wZSk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgU2NvcGUpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgndmFyaWFibGVTY29wZUFyaWFMYWJlbCcsIFwiU2NvcGUgezB9XCIsIGVsZW1lbnQubmFtZSk7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVmFyaWFibGUpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSh7IGtleTogJ3ZhcmlhYmxlQXJpYUxhYmVsJywgY29tbWVudDogWydQbGFjZWhvbGRlcnMgYXJlIHZhcmlhYmxlIG5hbWUgYW5kIHZhcmlhYmxlIHZhbHVlIHJlc3BlY3Rpdmx5LiBUaGV5IHNob3VsZCBub3QgYmUgdHJhbnNsYXRlZC4nXSB9LCBcInswfSwgdmFsdWUgezF9XCIsIGVsZW1lbnQubmFtZSwgZWxlbWVudC52YWx1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IFNFVF9WQVJJQUJMRV9JRCA9ICdkZWJ1Zy5zZXRWYXJpYWJsZSc7XG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBTRVRfVkFSSUFCTEVfSUQsXG5cdGhhbmRsZXI6IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuc2V0U2VsZWN0ZWRFeHByZXNzaW9uKHZhcmlhYmxlSW50ZXJuYWxDb250ZXh0LCBmYWxzZSk7XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdG1ldGFkYXRhOiB7XG5cdFx0ZGVzY3JpcHRpb246IENPUFlfVkFMVUVfTEFCRUwsXG5cdH0sXG5cdGlkOiBDT1BZX1ZBTFVFX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZzogVmFyaWFibGUgfCBFeHByZXNzaW9uIHwgSVZhcmlhYmxlc0NvbnRleHQgfCB1bmRlZmluZWQsIGN0eD86IChWYXJpYWJsZSB8IEV4cHJlc3Npb24pW10pID0+IHtcblx0XHRpZiAoIWFyZykge1xuXHRcdFx0Y29uc3Qgdmlld1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCB2aWV3ID0gdmlld1NlcnZpY2UuZ2V0QWN0aXZlVmlld1dpdGhJZChXQVRDSF9WSUVXX0lEKSB8fCB2aWV3U2VydmljZS5nZXRBY3RpdmVWaWV3V2l0aElkKFZBUklBQkxFU19WSUVXX0lEKTtcblx0XHRcdGlmICh2aWV3KSB7XG5cblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdGxldCBlbGVtZW50Q29udGV4dCA9ICcnO1xuXHRcdGxldCBlbGVtZW50czogKFZhcmlhYmxlIHwgRXhwcmVzc2lvbilbXTtcblx0XHRpZiAoIWFyZykge1xuXHRcdFx0Y29uc3Qgdmlld1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBmb2N1c2VkVmlldyA9IHZpZXdTZXJ2aWNlLmdldEZvY3VzZWRWaWV3KCk7XG5cdFx0XHRsZXQgdmlldzogSURlYnVnVmlld1dpdGhWYXJpYWJsZXMgfCBudWxsIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGZvY3VzZWRWaWV3Py5pZCA9PT0gV0FUQ0hfVklFV19JRCkge1xuXHRcdFx0XHR2aWV3ID0gdmlld1NlcnZpY2UuZ2V0QWN0aXZlVmlld1dpdGhJZDxJRGVidWdWaWV3V2l0aFZhcmlhYmxlcz4oV0FUQ0hfVklFV19JRCk7XG5cdFx0XHRcdGVsZW1lbnRDb250ZXh0ID0gJ3dhdGNoJztcblx0XHRcdH0gZWxzZSBpZiAoZm9jdXNlZFZpZXc/LmlkID09PSBWQVJJQUJMRVNfVklFV19JRCkge1xuXHRcdFx0XHR2aWV3ID0gdmlld1NlcnZpY2UuZ2V0QWN0aXZlVmlld1dpdGhJZDxJRGVidWdWaWV3V2l0aFZhcmlhYmxlcz4oVkFSSUFCTEVTX1ZJRVdfSUQpO1xuXHRcdFx0XHRlbGVtZW50Q29udGV4dCA9ICd2YXJpYWJsZXMnO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF2aWV3KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGVsZW1lbnRzID0gdmlldy50cmVlU2VsZWN0aW9uLmZpbHRlcihlID0+IGUgaW5zdGFuY2VvZiBFeHByZXNzaW9uIHx8IGUgaW5zdGFuY2VvZiBWYXJpYWJsZSk7XG5cdFx0fSBlbHNlIGlmIChhcmcgaW5zdGFuY2VvZiBWYXJpYWJsZSB8fCBhcmcgaW5zdGFuY2VvZiBFeHByZXNzaW9uKSB7XG5cdFx0XHRlbGVtZW50Q29udGV4dCA9ICd3YXRjaCc7XG5cdFx0XHRlbGVtZW50cyA9IGN0eCA/IGN0eCA6IFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRlbGVtZW50Q29udGV4dCA9ICd2YXJpYWJsZXMnO1xuXHRcdFx0ZWxlbWVudHMgPSB2YXJpYWJsZUludGVybmFsQ29udGV4dCA/IFt2YXJpYWJsZUludGVybmFsQ29udGV4dF0gOiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFja0ZyYW1lID0gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTdGFja0ZyYW1lO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb247XG5cdFx0aWYgKCFzdGFja0ZyYW1lIHx8ICFzZXNzaW9uIHx8IGVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV2YWxDb250ZXh0ID0gc2Vzc2lvbi5jYXBhYmlsaXRpZXMuc3VwcG9ydHNDbGlwYm9hcmRDb250ZXh0ID8gJ2NsaXBib2FyZCcgOiBlbGVtZW50Q29udGV4dDtcblx0XHRjb25zdCB0b0V2YWx1YXRlID0gZWxlbWVudHMubWFwKGVsZW1lbnQgPT4gZWxlbWVudCBpbnN0YW5jZW9mIFZhcmlhYmxlID8gKGVsZW1lbnQuZXZhbHVhdGVOYW1lIHx8IGVsZW1lbnQudmFsdWUpIDogZWxlbWVudC5uYW1lKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBldmFsdWF0aW9ucyA9IGF3YWl0IFByb21pc2UuYWxsKHRvRXZhbHVhdGUubWFwKGV4cHIgPT4gc2Vzc2lvbi5ldmFsdWF0ZShleHByLCBzdGFja0ZyYW1lLmZyYW1lSWQsIGV2YWxDb250ZXh0KSkpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gY29hbGVzY2UoZXZhbHVhdGlvbnMpLm1hcChldmFsdWF0aW9uID0+IGV2YWx1YXRpb24uYm9keS5yZXN1bHQpO1xuXHRcdFx0aWYgKHJlc3VsdC5sZW5ndGgpIHtcblx0XHRcdFx0Y2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQocmVzdWx0LmpvaW4oJ1xcbicpKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBlbGVtZW50cy5tYXAoZWxlbWVudCA9PiBlbGVtZW50LnZhbHVlKTtcblx0XHRcdGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHJlc3VsdC5qb2luKCdcXG4nKSk7XG5cdFx0fVxuXHR9XG59KTtcblxuZXhwb3J0IGNvbnN0IFZJRVdfTUVNT1JZX0lEID0gJ3dvcmtiZW5jaC5kZWJ1Zy52aWV3bGV0LmFjdGlvbi52aWV3TWVtb3J5JztcblxuY29uc3QgSEVYX0VESVRPUl9FWFRFTlNJT05fSUQgPSAnbXMtdnNjb2RlLmhleGVkaXRvcic7XG5jb25zdCBIRVhfRURJVE9SX0VESVRPUl9JRCA9ICdoZXhFZGl0b3IuaGV4ZWRpdCc7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IFZJRVdfTUVNT1JZX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZzogSVZhcmlhYmxlc0NvbnRleHQgfCBJRXhwcmVzc2lvbiwgY3R4PzogKFZhcmlhYmxlIHwgRXhwcmVzc2lvbilbXSkgPT4ge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRsZXQgc2Vzc2lvbklkOiBzdHJpbmc7XG5cdFx0bGV0IG1lbW9yeVJlZmVyZW5jZTogc3RyaW5nO1xuXHRcdGlmICgnc2Vzc2lvbklkJyBpbiBhcmcpIHsgLy8gSVZhcmlhYmxlc0NvbnRleHRcblx0XHRcdGlmICghYXJnLnNlc3Npb25JZCB8fCAhYXJnLnZhcmlhYmxlLm1lbW9yeVJlZmVyZW5jZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzZXNzaW9uSWQgPSBhcmcuc2Vzc2lvbklkO1xuXHRcdFx0bWVtb3J5UmVmZXJlbmNlID0gYXJnLnZhcmlhYmxlLm1lbW9yeVJlZmVyZW5jZTtcblx0XHR9IGVsc2UgeyAvLyBJRXhwcmVzc2lvblxuXHRcdFx0aWYgKCFhcmcubWVtb3J5UmVmZXJlbmNlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGZvY3VzZWQgPSBkZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFNlc3Npb247XG5cdFx0XHRpZiAoIWZvY3VzZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzZXNzaW9uSWQgPSBmb2N1c2VkLmdldElkKCk7XG5cdFx0XHRtZW1vcnlSZWZlcmVuY2UgPSBhcmcubWVtb3J5UmVmZXJlbmNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uU2VydmljZSk7XG5cdFx0Y29uc3QgdGVsZW1ldHJ5U2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVsZW1ldHJ5U2VydmljZSk7XG5cblx0XHRjb25zdCBleHQgPSBhd2FpdCBleHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvbihIRVhfRURJVE9SX0VYVEVOU0lPTl9JRCk7XG5cdFx0aWYgKGV4dCB8fCBhd2FpdCB0cnlJbnN0YWxsSGV4RWRpdG9yKGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlKSkge1xuXHRcdFx0LyogX19HRFBSX19cblx0XHRcdFx0XCJkZWJ1Zy9kaWRWaWV3TWVtb3J5XCIgOiB7XG5cdFx0XHRcdFx0XCJvd25lclwiOiBcImNvbm5vcjQzMTJcIixcblx0XHRcdFx0XHRcImRlYnVnVHlwZVwiIDogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiB9XG5cdFx0XHRcdH1cblx0XHRcdCovXG5cdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZygnZGVidWcvZGlkVmlld01lbW9yeScsIHtcblx0XHRcdFx0ZGVidWdUeXBlOiBkZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9uKHNlc3Npb25JZCk/LmNvbmZpZ3VyYXRpb24udHlwZSxcblx0XHRcdH0pO1xuXG5cdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZTogZ2V0VXJpRm9yRGVidWdNZW1vcnkoc2Vzc2lvbklkLCBtZW1vcnlSZWZlcmVuY2UpLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0cmV2ZWFsSWZPcGVuZWQ6IHRydWUsXG5cdFx0XHRcdFx0b3ZlcnJpZGU6IEhFWF9FRElUT1JfRURJVE9SX0lELFxuXHRcdFx0XHR9LFxuXHRcdFx0fSwgU0lERV9HUk9VUCk7XG5cdFx0fVxuXHR9XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gdHJ5SW5zdGFsbEhleEVkaXRvcihleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHR0cnkge1xuXHRcdGF3YWl0IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGwoSEVYX0VESVRPUl9FWFRFTlNJT05fSUQsIHtcblx0XHRcdGp1c3RpZmljYXRpb246IGxvY2FsaXplKFwidmlld01lbW9yeS5wcm9tcHRcIiwgXCJJbnNwZWN0aW5nIGJpbmFyeSBkYXRhIHJlcXVpcmVzIHRoaXMgZXh0ZW5zaW9uLlwiKSxcblx0XHRcdGVuYWJsZTogdHJ1ZVxuXHRcdH0sIFByb2dyZXNzTG9jYXRpb24uTm90aWZpY2F0aW9uKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IEJSRUFLX1dIRU5fVkFMVUVfQ0hBTkdFU19JRCA9ICdkZWJ1Zy5icmVha1doZW5WYWx1ZUNoYW5nZXMnO1xuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogQlJFQUtfV0hFTl9WQUxVRV9DSEFOR0VTX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0aWYgKGRhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlKSB7XG5cdFx0XHRhd2FpdCBkZWJ1Z1NlcnZpY2UuYWRkRGF0YUJyZWFrcG9pbnQoeyBkZXNjcmlwdGlvbjogZGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2UuZGVzY3JpcHRpb24sIHNyYzogeyB0eXBlOiBEYXRhQnJlYWtwb2ludFNldFR5cGUuVmFyaWFibGUsIGRhdGFJZDogZGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2UuZGF0YUlkISB9LCBjYW5QZXJzaXN0OiAhIWRhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlLmNhblBlcnNpc3QsIGFjY2Vzc1R5cGVzOiBkYXRhQnJlYWtwb2ludEluZm9SZXNwb25zZS5hY2Nlc3NUeXBlcywgYWNjZXNzVHlwZTogJ3dyaXRlJyB9KTtcblx0XHR9XG5cdH1cbn0pO1xuXG5leHBvcnQgY29uc3QgQlJFQUtfV0hFTl9WQUxVRV9JU19BQ0NFU1NFRF9JRCA9ICdkZWJ1Zy5icmVha1doZW5WYWx1ZUlzQWNjZXNzZWQnO1xuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogQlJFQUtfV0hFTl9WQUxVRV9JU19BQ0NFU1NFRF9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGlmIChkYXRhQnJlYWtwb2ludEluZm9SZXNwb25zZSkge1xuXHRcdFx0YXdhaXQgZGVidWdTZXJ2aWNlLmFkZERhdGFCcmVha3BvaW50KHsgZGVzY3JpcHRpb246IGRhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlLmRlc2NyaXB0aW9uLCBzcmM6IHsgdHlwZTogRGF0YUJyZWFrcG9pbnRTZXRUeXBlLlZhcmlhYmxlLCBkYXRhSWQ6IGRhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlLmRhdGFJZCEgfSwgY2FuUGVyc2lzdDogISFkYXRhQnJlYWtwb2ludEluZm9SZXNwb25zZS5jYW5QZXJzaXN0LCBhY2Nlc3NUeXBlczogZGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2UuYWNjZXNzVHlwZXMsIGFjY2Vzc1R5cGU6ICdyZWFkV3JpdGUnIH0pO1xuXHRcdH1cblx0fVxufSk7XG5cbmV4cG9ydCBjb25zdCBCUkVBS19XSEVOX1ZBTFVFX0lTX1JFQURfSUQgPSAnZGVidWcuYnJlYWtXaGVuVmFsdWVJc1JlYWQnO1xuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogQlJFQUtfV0hFTl9WQUxVRV9JU19SRUFEX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdFx0aWYgKGRhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlKSB7XG5cdFx0XHRhd2FpdCBkZWJ1Z1NlcnZpY2UuYWRkRGF0YUJyZWFrcG9pbnQoeyBkZXNjcmlwdGlvbjogZGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2UuZGVzY3JpcHRpb24sIHNyYzogeyB0eXBlOiBEYXRhQnJlYWtwb2ludFNldFR5cGUuVmFyaWFibGUsIGRhdGFJZDogZGF0YUJyZWFrcG9pbnRJbmZvUmVzcG9uc2UuZGF0YUlkISB9LCBjYW5QZXJzaXN0OiAhIWRhdGFCcmVha3BvaW50SW5mb1Jlc3BvbnNlLmNhblBlcnNpc3QsIGFjY2Vzc1R5cGVzOiBkYXRhQnJlYWtwb2ludEluZm9SZXNwb25zZS5hY2Nlc3NUeXBlcywgYWNjZXNzVHlwZTogJ3JlYWQnIH0pO1xuXHRcdH1cblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0bWV0YWRhdGE6IHtcblx0XHRkZXNjcmlwdGlvbjogQ09QWV9FVkFMVUFURV9QQVRIX0xBQkVMLFxuXHR9LFxuXHRpZDogQ09QWV9FVkFMVUFURV9QQVRIX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElWYXJpYWJsZXNDb250ZXh0KSA9PiB7XG5cdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2xpcGJvYXJkU2VydmljZSk7XG5cdFx0YXdhaXQgY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoY29udGV4dC52YXJpYWJsZS5ldmFsdWF0ZU5hbWUhKTtcblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0bWV0YWRhdGE6IHtcblx0XHRkZXNjcmlwdGlvbjogQUREX1RPX1dBVENIX0xBQkVMLFxuXHR9LFxuXHRpZDogQUREX1RPX1dBVENIX0lELFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElWYXJpYWJsZXNDb250ZXh0KSA9PiB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGRlYnVnU2VydmljZS5hZGRXYXRjaEV4cHJlc3Npb24oY29udGV4dC52YXJpYWJsZS5ldmFsdWF0ZU5hbWUpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxWYXJpYWJsZXNWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAndmFyaWFibGVzLmNvbGxhcHNlJyxcblx0XHRcdHZpZXdJZDogVkFSSUFCTEVTX1ZJRVdfSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NvbGxhcHNlJywgXCJDb2xsYXBzZSBBbGxcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRpY29uOiBDb2RpY29uLmNvbGxhcHNlQWxsLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgVkFSSUFCTEVTX1ZJRVdfSUQpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRydW5JblZpZXcoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBWYXJpYWJsZXNWaWV3KSB7XG5cdFx0dmlldy5jb2xsYXBzZUFsbCgpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQVMsd0JBQW9DO0FBSzdDLFNBQVMsY0FBdUI7QUFDaEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3QkFBd0I7QUFDakMsU0FBNEIsK0JBQStCO0FBQzNELFNBQVMsZUFBZTtBQUN4QixTQUFxQixxQkFBcUI7QUFDMUMsU0FBc0Isb0JBQW9CO0FBQzFDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsY0FBYyxRQUFRLHVCQUF1QjtBQUN0RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQiwwQkFBMEI7QUFDbkQsU0FBUyxxQkFBcUIsMkJBQTJCO0FBQ3pELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsWUFBWSxnQkFBZ0I7QUFFckMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxnQkFBZ0Isa0JBQWtCO0FBQzNDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsNENBQTRDLGdEQUFnRCw0Q0FBNEMsMkJBQTJCLHVCQUF1Qix3QkFBcUQsZUFBc0YsbUJBQW1CLHFCQUFxQjtBQUN0WCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLFlBQVksWUFBWSxPQUFPLFlBQVksVUFBVSxzQkFBc0IsNEJBQTRCO0FBQ2hILFNBQTBCLCtCQUErQjtBQUN6RCxTQUFT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
