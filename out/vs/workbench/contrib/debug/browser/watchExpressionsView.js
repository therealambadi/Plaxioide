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
import { ListDragOverEffectPosition, ListDragOverEffectType } from "../../../../base/browser/ui/list/list.js";
import { ElementsDragAndDropData, ListViewTargetSector } from "../../../../base/browser/ui/list/listView.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { localize } from "../../../../nls.js";
import { getContextMenuActions, getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewAction, ViewPane } from "../../../browser/parts/views/viewPane.js";
import { FocusedViewContext } from "../../../common/contextkeys.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { CONTEXT_CAN_VIEW_MEMORY, CONTEXT_EXPRESSION_SELECTED, CONTEXT_VARIABLE_IS_READONLY, CONTEXT_WATCH_EXPRESSIONS_EXIST, CONTEXT_WATCH_EXPRESSIONS_FOCUSED, CONTEXT_WATCH_ITEM_TYPE, IDebugService, WATCH_VIEW_ID } from "../common/debug.js";
import { Expression, Variable, VisualizedExpression } from "../common/debugModel.js";
import { AbstractExpressionDataSource, AbstractExpressionsRenderer, expressionAndScopeLabelProvider, renderViewTree } from "./baseDebugView.js";
import { COPY_WATCH_EXPRESSION_COMMAND_ID } from "./debugCommands.js";
import { DebugExpressionRenderer } from "./debugExpressionRenderer.js";
import { watchExpressionsAdd, watchExpressionsRemoveAll } from "./debugIcons.js";
import { VariablesRenderer, VisualizedVariableRenderer } from "./variablesView.js";
const MAX_VALUE_RENDER_LENGTH_IN_VIEWLET = 1024;
let ignoreViewUpdates = false;
let useCachedEvaluation = false;
let WatchExpressionsView = class extends ViewPane {
  constructor(options, contextMenuService, debugService, keybindingService, instantiationService, viewDescriptorService, configurationService, contextKeyService, openerService, themeService, hoverService, menuService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.debugService = debugService;
    this.needsRefresh = false;
    this.menu = menuService.createMenu(MenuId.DebugWatchContext, contextKeyService);
    this._register(this.menu);
    this.watchExpressionsUpdatedScheduler = new RunOnceScheduler(() => {
      this.needsRefresh = false;
      this.tree.updateChildren();
    }, 50);
    this.watchExpressionsExist = CONTEXT_WATCH_EXPRESSIONS_EXIST.bindTo(contextKeyService);
    this.variableReadonly = CONTEXT_VARIABLE_IS_READONLY.bindTo(contextKeyService);
    this.watchExpressionsExist.set(this.debugService.getModel().getWatchExpressions().length > 0);
    this.watchItemType = CONTEXT_WATCH_ITEM_TYPE.bindTo(contextKeyService);
    this.expressionRenderer = instantiationService.createInstance(DebugExpressionRenderer);
  }
  get treeSelection() {
    return this.tree.getSelection();
  }
  renderBody(container) {
    super.renderBody(container);
    this.element.classList.add("debug-pane");
    container.classList.add("debug-watch");
    const treeContainer = renderViewTree(container);
    const expressionsRenderer = this.instantiationService.createInstance(WatchExpressionsRenderer, this.expressionRenderer);
    this.tree = this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "WatchExpressions",
      treeContainer,
      new WatchExpressionsDelegate(),
      [
        expressionsRenderer,
        this.instantiationService.createInstance(VariablesRenderer, this.expressionRenderer),
        this.instantiationService.createInstance(VisualizedVariableRenderer, this.expressionRenderer)
      ],
      this.instantiationService.createInstance(WatchExpressionsDataSource),
      {
        accessibilityProvider: new WatchExpressionsAccessibilityProvider(),
        identityProvider: { getId: (element) => element.getId() },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (e) => {
            if (e === this.debugService.getViewModel().getSelectedExpression()?.expression) {
              return void 0;
            }
            return expressionAndScopeLabelProvider.getKeyboardNavigationLabel(e);
          }
        },
        dnd: new WatchExpressionsDragAndDrop(this.debugService),
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    this._register(this.tree);
    this.tree.setInput(this.debugService);
    CONTEXT_WATCH_EXPRESSIONS_FOCUSED.bindTo(this.tree.contextKeyService);
    this._register(VisualizedVariableRenderer.rendererOnVisualizationRange(this.debugService.getViewModel(), this.tree));
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.tree.onMouseDblClick((e) => this.onMouseDblClick(e)));
    this._register(this.debugService.getModel().onDidChangeWatchExpressions(async (we) => {
      this.watchExpressionsExist.set(this.debugService.getModel().getWatchExpressions().length > 0);
      if (!this.isBodyVisible()) {
        this.needsRefresh = true;
      } else {
        if (we && !we.name) {
          useCachedEvaluation = true;
        }
        await this.tree.updateChildren();
        useCachedEvaluation = false;
        if (we instanceof Expression) {
          this.tree.reveal(we);
        }
      }
    }));
    this._register(this.debugService.getViewModel().onDidFocusStackFrame(() => {
      if (!this.isBodyVisible()) {
        this.needsRefresh = true;
        return;
      }
      if (!this.watchExpressionsUpdatedScheduler.isScheduled()) {
        this.watchExpressionsUpdatedScheduler.schedule();
      }
    }));
    this._register(this.debugService.getViewModel().onWillUpdateViews(() => {
      if (!ignoreViewUpdates) {
        this.tree.updateChildren();
      }
    }));
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible && this.needsRefresh) {
        this.watchExpressionsUpdatedScheduler.schedule();
      }
    }));
    let horizontalScrolling;
    this._register(this.debugService.getViewModel().onDidSelectExpression((e) => {
      const expression = e?.expression;
      if (expression && this.tree.hasNode(expression)) {
        horizontalScrolling = this.tree.options.horizontalScrolling;
        if (horizontalScrolling) {
          this.tree.updateOptions({ horizontalScrolling: false });
        }
        if (expression.name) {
          this.tree.rerender(expression);
        }
      } else if (!expression && horizontalScrolling !== void 0) {
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
  onMouseDblClick(e) {
    if (e.browserEvent.target.className.indexOf("twistie") >= 0) {
      return;
    }
    const element = e.element;
    const selectedExpression = this.debugService.getViewModel().getSelectedExpression();
    if (element instanceof Expression && element !== selectedExpression?.expression || element instanceof VisualizedExpression && element.treeItem.canEdit) {
      this.debugService.getViewModel().setSelectedExpression(element, false);
    } else if (!element) {
      this.debugService.addWatchExpression();
    }
  }
  onContextMenu(e) {
    const element = e.element;
    const selection = this.tree.getSelection();
    this.watchItemType.set(element instanceof Expression ? "expression" : element instanceof Variable ? "variable" : void 0);
    const attributes = element instanceof Variable ? element.presentationHint?.attributes : void 0;
    this.variableReadonly.set(!!attributes && attributes.indexOf("readOnly") >= 0 || !!element?.presentationHint?.lazy);
    const actions = getFlatContextMenuActions(this.menu.getActions({ arg: element, shouldForwardArgs: true }));
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      getActions: () => actions,
      getActionsContext: () => element && selection.includes(element) ? selection : element ? [element] : []
    });
  }
};
WatchExpressionsView = __decorateClass([
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
], WatchExpressionsView);
class WatchExpressionsDelegate {
  getHeight(_element) {
    return 22;
  }
  getTemplateId(element) {
    if (element instanceof Expression) {
      return WatchExpressionsRenderer.ID;
    }
    if (element instanceof VisualizedExpression) {
      return VisualizedVariableRenderer.ID;
    }
    return VariablesRenderer.ID;
  }
}
function isDebugService(element) {
  return typeof element.getConfigurationManager === "function";
}
class WatchExpressionsDataSource extends AbstractExpressionDataSource {
  hasChildren(element) {
    return isDebugService(element) || element.hasChildren;
  }
  doGetChildren(element) {
    if (isDebugService(element)) {
      const debugService = element;
      const watchExpressions = debugService.getModel().getWatchExpressions();
      const viewModel = debugService.getViewModel();
      return Promise.all(watchExpressions.map((we) => !!we.name && !useCachedEvaluation ? we.evaluate(viewModel.focusedSession, viewModel.focusedStackFrame, "watch").then(() => we) : Promise.resolve(we)));
    }
    return element.getChildren();
  }
}
let WatchExpressionsRenderer = class extends AbstractExpressionsRenderer {
  constructor(expressionRenderer, menuService, contextKeyService, debugService, contextViewService, hoverService, configurationService) {
    super(debugService, contextViewService, hoverService);
    this.expressionRenderer = expressionRenderer;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
  }
  get templateId() {
    return WatchExpressionsRenderer.ID;
  }
  renderElement(node, index, data) {
    data.elementDisposable.clear();
    data.elementDisposable.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("debug.showVariableTypes")) {
        super.renderExpressionElement(node.element, node, data);
      }
    }));
    super.renderExpressionElement(node.element, node, data);
  }
  renderExpression(expression, data, highlights) {
    let text;
    data.type.textContent = "";
    const showType = this.configurationService.getValue("debug").showVariableTypes;
    if (showType && expression.type) {
      text = typeof expression.value === "string" ? `${expression.name}: ` : expression.name;
      data.type.textContent = expression.type + " =";
    } else {
      text = typeof expression.value === "string" ? `${expression.name} =` : expression.name;
    }
    let title;
    if (expression.type) {
      if (showType) {
        title = `${expression.name}`;
      } else {
        title = expression.type === expression.value ? expression.type : `${expression.type}`;
      }
    } else {
      title = expression.value;
    }
    data.label.set(text, highlights, title);
    data.elementDisposable.add(this.expressionRenderer.renderValue(data.value, expression, {
      showChanged: true,
      maxValueLength: MAX_VALUE_RENDER_LENGTH_IN_VIEWLET,
      colorize: true,
      session: expression.getSession()
    }));
  }
  getInputBoxOptions(expression, settingValue) {
    if (settingValue) {
      return {
        initialValue: expression.value,
        ariaLabel: localize("typeNewValue", "Type new value"),
        onFinish: async (value, success) => {
          if (success && value) {
            const focusedFrame = this.debugService.getViewModel().focusedStackFrame;
            if (focusedFrame && (expression instanceof Variable || expression instanceof Expression)) {
              await expression.setExpression(value, focusedFrame);
              this.debugService.getViewModel().updateViews();
            }
          }
        }
      };
    }
    return {
      initialValue: expression.name ? expression.name : "",
      ariaLabel: localize("watchExpressionInputAriaLabel", "Type watch expression"),
      placeholder: localize("watchExpressionPlaceholder", "Expression to watch"),
      onFinish: (value, success) => {
        if (success && value) {
          this.debugService.renameWatchExpression(expression.getId(), value);
          ignoreViewUpdates = true;
          this.debugService.getViewModel().updateViews();
          ignoreViewUpdates = false;
        } else if (!expression.name) {
          this.debugService.removeWatchExpressions(expression.getId());
        }
      }
    };
  }
  renderActionBar(actionBar, expression) {
    const contextKeyService = getContextForWatchExpressionMenu(this.contextKeyService, expression);
    const context = expression;
    const menu = this.menuService.getMenuActions(MenuId.DebugWatchContext, contextKeyService, { arg: context, shouldForwardArgs: false });
    const { primary } = getContextMenuActions(menu, "inline");
    actionBar.clear();
    actionBar.context = context;
    actionBar.push(primary, { icon: true, label: false });
  }
};
WatchExpressionsRenderer.ID = "watchexpression";
WatchExpressionsRenderer = __decorateClass([
  __decorateParam(1, IMenuService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IDebugService),
  __decorateParam(4, IContextViewService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IConfigurationService)
], WatchExpressionsRenderer);
function getContextForWatchExpressionMenu(parentContext, expression) {
  return parentContext.createOverlay([
    [CONTEXT_CAN_VIEW_MEMORY.key, expression.memoryReference !== void 0],
    [CONTEXT_WATCH_ITEM_TYPE.key, "expression"]
  ]);
}
class WatchExpressionsAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize({ comment: ["Debug is a noun in this context, not a verb."], key: "watchAriaTreeLabel" }, "Debug Watch Expressions");
  }
  getAriaLabel(element) {
    if (element instanceof Expression) {
      return localize("watchExpressionAriaLabel", "{0}, value {1}", element.name, element.value);
    }
    return localize("watchVariableAriaLabel", "{0}, value {1}", element.name, element.value);
  }
}
class WatchExpressionsDragAndDrop {
  constructor(debugService) {
    this.debugService = debugService;
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    if (!(data instanceof ElementsDragAndDropData)) {
      return false;
    }
    const expressions = data.elements;
    if (!(expressions.length > 0 && expressions[0] instanceof Expression)) {
      return false;
    }
    let dropEffectPosition = void 0;
    if (targetIndex === void 0) {
      dropEffectPosition = ListDragOverEffectPosition.After;
      targetIndex = -1;
    } else {
      switch (targetSector) {
        case ListViewTargetSector.TOP:
        case ListViewTargetSector.CENTER_TOP:
          dropEffectPosition = ListDragOverEffectPosition.Before;
          break;
        case ListViewTargetSector.CENTER_BOTTOM:
        case ListViewTargetSector.BOTTOM:
          dropEffectPosition = ListDragOverEffectPosition.After;
          break;
      }
    }
    return { accept: true, effect: { type: ListDragOverEffectType.Move, position: dropEffectPosition }, feedback: [targetIndex] };
  }
  getDragURI(element) {
    if (!(element instanceof Expression) || element === this.debugService.getViewModel().getSelectedExpression()?.expression) {
      return null;
    }
    return element.getId();
  }
  getDragLabel(elements) {
    if (elements.length === 1) {
      return elements[0].name;
    }
    return void 0;
  }
  drop(data, targetElement, targetIndex, targetSector, originalEvent) {
    if (!(data instanceof ElementsDragAndDropData)) {
      return;
    }
    const draggedElement = data.elements[0];
    if (!(draggedElement instanceof Expression)) {
      throw new Error("Invalid dragged element");
    }
    const watches = this.debugService.getModel().getWatchExpressions();
    const sourcePosition = watches.indexOf(draggedElement);
    let targetPosition;
    if (targetElement instanceof Expression) {
      targetPosition = watches.indexOf(targetElement);
      switch (targetSector) {
        case ListViewTargetSector.BOTTOM:
        case ListViewTargetSector.CENTER_BOTTOM:
          targetPosition++;
          break;
      }
      if (sourcePosition < targetPosition) {
        targetPosition--;
      }
    } else {
      targetPosition = watches.length - 1;
    }
    this.debugService.moveWatchExpression(draggedElement.getId(), targetPosition);
  }
  dispose() {
  }
}
registerAction2(class Collapse extends ViewAction {
  constructor() {
    super({
      id: "watch.collapse",
      viewId: WATCH_VIEW_ID,
      title: localize("collapse", "Collapse All"),
      f1: false,
      icon: Codicon.collapseAll,
      precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
      menu: {
        id: MenuId.ViewTitle,
        order: 30,
        group: "navigation",
        when: ContextKeyExpr.equals("view", WATCH_VIEW_ID)
      }
    });
  }
  runInView(_accessor, view) {
    view.collapseAll();
  }
});
const ADD_WATCH_ID = "workbench.debug.viewlet.action.addWatchExpression";
const ADD_WATCH_LABEL = localize("addWatchExpression", "Add Expression");
registerAction2(class AddWatchExpressionAction extends Action2 {
  constructor() {
    super({
      id: ADD_WATCH_ID,
      title: ADD_WATCH_LABEL,
      f1: false,
      icon: watchExpressionsAdd,
      menu: {
        id: MenuId.ViewTitle,
        group: "navigation",
        when: ContextKeyExpr.equals("view", WATCH_VIEW_ID)
      }
    });
  }
  run(accessor) {
    const debugService = accessor.get(IDebugService);
    debugService.addWatchExpression();
  }
});
const REMOVE_WATCH_EXPRESSIONS_COMMAND_ID = "workbench.debug.viewlet.action.removeAllWatchExpressions";
const REMOVE_WATCH_EXPRESSIONS_LABEL = localize("removeAllWatchExpressions", "Remove All Expressions");
registerAction2(class RemoveAllWatchExpressionsAction extends Action2 {
  constructor() {
    super({
      id: REMOVE_WATCH_EXPRESSIONS_COMMAND_ID,
      // Use old and long id for backwards compatibility
      title: REMOVE_WATCH_EXPRESSIONS_LABEL,
      f1: false,
      icon: watchExpressionsRemoveAll,
      precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
      menu: {
        id: MenuId.ViewTitle,
        order: 20,
        group: "navigation",
        when: ContextKeyExpr.equals("view", WATCH_VIEW_ID)
      }
    });
  }
  run(accessor) {
    const debugService = accessor.get(IDebugService);
    debugService.removeWatchExpressions();
  }
});
registerAction2(class CopyExpression extends ViewAction {
  constructor() {
    super({
      id: COPY_WATCH_EXPRESSION_COMMAND_ID,
      title: localize("copyWatchExpression", "Copy Expression"),
      f1: false,
      viewId: WATCH_VIEW_ID,
      precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyC,
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(
          FocusedViewContext.isEqualTo(WATCH_VIEW_ID),
          CONTEXT_EXPRESSION_SELECTED.negate()
        )
      },
      menu: {
        id: MenuId.DebugWatchContext,
        order: 20,
        group: "3_modification",
        when: CONTEXT_WATCH_ITEM_TYPE.isEqualTo("expression")
      }
    });
  }
  runInView(accessor, view, value) {
    const clipboardService = accessor.get(IClipboardService);
    if (!value) {
      value = view.treeSelection.at(-1);
    }
    if (value) {
      clipboardService.writeText(value.name);
    }
  }
});
export {
  ADD_WATCH_ID,
  ADD_WATCH_LABEL,
  REMOVE_WATCH_EXPRESSIONS_COMMAND_ID,
  REMOVE_WATCH_EXPRESSIONS_LABEL,
  WatchExpressionsRenderer,
  WatchExpressionsView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL3dhdGNoRXhwcmVzc2lvbnNWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSURyYWdBbmREcm9wRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgSUhpZ2hsaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9oaWdobGlnaHRlZGxhYmVsL2hpZ2hsaWdodGVkTGFiZWwuanMnO1xuaW1wb3J0IHsgSUxpc3RWaXJ0dWFsRGVsZWdhdGUsIExpc3REcmFnT3ZlckVmZmVjdFBvc2l0aW9uLCBMaXN0RHJhZ092ZXJFZmZlY3RUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YSwgTGlzdFZpZXdUYXJnZXRTZWN0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0Vmlldy5qcyc7XG5pbXBvcnQgeyBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVRyZWVDb250ZXh0TWVudUV2ZW50LCBJVHJlZURyYWdBbmREcm9wLCBJVHJlZURyYWdPdmVyUmVhY3Rpb24sIElUcmVlTW91c2VFdmVudCwgSVRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGdldENvbnRleHRNZW51QWN0aW9ucywgZ2V0RmxhdENvbnRleHRNZW51QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJTWVudSwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSwgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaEFzeW5jRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBWaWV3QWN0aW9uLCBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVZpZXdsZXRWaWV3T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld3NWaWV3bGV0LmpzJztcbmltcG9ydCB7IEZvY3VzZWRWaWV3Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IENPTlRFWFRfQ0FOX1ZJRVdfTUVNT1JZLCBDT05URVhUX0VYUFJFU1NJT05fU0VMRUNURUQsIENPTlRFWFRfVkFSSUFCTEVfSVNfUkVBRE9OTFksIENPTlRFWFRfV0FUQ0hfRVhQUkVTU0lPTlNfRVhJU1QsIENPTlRFWFRfV0FUQ0hfRVhQUkVTU0lPTlNfRk9DVVNFRCwgQ09OVEVYVF9XQVRDSF9JVEVNX1RZUEUsIElEZWJ1Z0NvbmZpZ3VyYXRpb24sIElEZWJ1Z1NlcnZpY2UsIElEZWJ1Z1ZpZXdXaXRoVmFyaWFibGVzLCBJRXhwcmVzc2lvbiwgV0FUQ0hfVklFV19JRCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBFeHByZXNzaW9uLCBWYXJpYWJsZSwgVmlzdWFsaXplZEV4cHJlc3Npb24gfSBmcm9tICcuLi9jb21tb24vZGVidWdNb2RlbC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEV4cHJlc3Npb25EYXRhU291cmNlLCBBYnN0cmFjdEV4cHJlc3Npb25zUmVuZGVyZXIsIGV4cHJlc3Npb25BbmRTY29wZUxhYmVsUHJvdmlkZXIsIElFeHByZXNzaW9uVGVtcGxhdGVEYXRhLCBJSW5wdXRCb3hPcHRpb25zLCByZW5kZXJWaWV3VHJlZSB9IGZyb20gJy4vYmFzZURlYnVnVmlldy5qcyc7XG5pbXBvcnQgeyBDT1BZX1dBVENIX0VYUFJFU1NJT05fQ09NTUFORF9JRCB9IGZyb20gJy4vZGVidWdDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlciB9IGZyb20gJy4vZGVidWdFeHByZXNzaW9uUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgd2F0Y2hFeHByZXNzaW9uc0FkZCwgd2F0Y2hFeHByZXNzaW9uc1JlbW92ZUFsbCB9IGZyb20gJy4vZGVidWdJY29ucy5qcyc7XG5pbXBvcnQgeyBWYXJpYWJsZXNSZW5kZXJlciwgVmlzdWFsaXplZFZhcmlhYmxlUmVuZGVyZXIgfSBmcm9tICcuL3ZhcmlhYmxlc1ZpZXcuanMnO1xuXG5jb25zdCBNQVhfVkFMVUVfUkVOREVSX0xFTkdUSF9JTl9WSUVXTEVUID0gMTAyNDtcbmxldCBpZ25vcmVWaWV3VXBkYXRlcyA9IGZhbHNlO1xubGV0IHVzZUNhY2hlZEV2YWx1YXRpb24gPSBmYWxzZTtcblxuZXhwb3J0IGNsYXNzIFdhdGNoRXhwcmVzc2lvbnNWaWV3IGV4dGVuZHMgVmlld1BhbmUgaW1wbGVtZW50cyBJRGVidWdWaWV3V2l0aFZhcmlhYmxlcyB7XG5cblx0cHJpdmF0ZSB3YXRjaEV4cHJlc3Npb25zVXBkYXRlZFNjaGVkdWxlcjogUnVuT25jZVNjaGVkdWxlcjtcblx0cHJpdmF0ZSBuZWVkc1JlZnJlc2ggPSBmYWxzZTtcblx0cHJpdmF0ZSB0cmVlITogV29ya2JlbmNoQXN5bmNEYXRhVHJlZTxJRGVidWdTZXJ2aWNlIHwgSUV4cHJlc3Npb24sIElFeHByZXNzaW9uLCBGdXp6eVNjb3JlPjtcblx0cHJpdmF0ZSB3YXRjaEV4cHJlc3Npb25zRXhpc3Q6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHdhdGNoSXRlbVR5cGU6IElDb250ZXh0S2V5PHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgdmFyaWFibGVSZWFkb25seTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgbWVudTogSU1lbnU7XG5cdHByaXZhdGUgZXhwcmVzc2lvblJlbmRlcmVyOiBEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlcjtcblxuXHRwdWJsaWMgZ2V0IHRyZWVTZWxlY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5nZXRTZWxlY3Rpb24oKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3bGV0Vmlld09wdGlvbnMsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKG9wdGlvbnMsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXG5cdFx0dGhpcy5tZW51ID0gbWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuRGVidWdXYXRjaENvbnRleHQsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1lbnUpO1xuXHRcdHRoaXMud2F0Y2hFeHByZXNzaW9uc1VwZGF0ZWRTY2hlZHVsZXIgPSBuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHR0aGlzLm5lZWRzUmVmcmVzaCA9IGZhbHNlO1xuXHRcdFx0dGhpcy50cmVlLnVwZGF0ZUNoaWxkcmVuKCk7XG5cdFx0fSwgNTApO1xuXHRcdHRoaXMud2F0Y2hFeHByZXNzaW9uc0V4aXN0ID0gQ09OVEVYVF9XQVRDSF9FWFBSRVNTSU9OU19FWElTVC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudmFyaWFibGVSZWFkb25seSA9IENPTlRFWFRfVkFSSUFCTEVfSVNfUkVBRE9OTFkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLndhdGNoRXhwcmVzc2lvbnNFeGlzdC5zZXQodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRXYXRjaEV4cHJlc3Npb25zKCkubGVuZ3RoID4gMCk7XG5cdFx0dGhpcy53YXRjaEl0ZW1UeXBlID0gQ09OVEVYVF9XQVRDSF9JVEVNX1RZUEUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmV4cHJlc3Npb25SZW5kZXJlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlYnVnRXhwcmVzc2lvblJlbmRlcmVyKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZGVidWctcGFuZScpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdkZWJ1Zy13YXRjaCcpO1xuXHRcdGNvbnN0IHRyZWVDb250YWluZXIgPSByZW5kZXJWaWV3VHJlZShjb250YWluZXIpO1xuXG5cdFx0Y29uc3QgZXhwcmVzc2lvbnNSZW5kZXJlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV2F0Y2hFeHByZXNzaW9uc1JlbmRlcmVyLCB0aGlzLmV4cHJlc3Npb25SZW5kZXJlcik7XG5cdFx0dGhpcy50cmVlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElEZWJ1Z1NlcnZpY2UgfCBJRXhwcmVzc2lvbiwgSUV4cHJlc3Npb24sIEZ1enp5U2NvcmU+LCAnV2F0Y2hFeHByZXNzaW9ucycsIHRyZWVDb250YWluZXIsIG5ldyBXYXRjaEV4cHJlc3Npb25zRGVsZWdhdGUoKSxcblx0XHRcdFtcblx0XHRcdFx0ZXhwcmVzc2lvbnNSZW5kZXJlcixcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShWYXJpYWJsZXNSZW5kZXJlciwgdGhpcy5leHByZXNzaW9uUmVuZGVyZXIpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZpc3VhbGl6ZWRWYXJpYWJsZVJlbmRlcmVyLCB0aGlzLmV4cHJlc3Npb25SZW5kZXJlciksXG5cdFx0XHRdLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXYXRjaEV4cHJlc3Npb25zRGF0YVNvdXJjZSksIHtcblx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IFdhdGNoRXhwcmVzc2lvbnNBY2Nlc3NpYmlsaXR5UHJvdmlkZXIoKSxcblx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IHsgZ2V0SWQ6IChlbGVtZW50OiBJRXhwcmVzc2lvbikgPT4gZWxlbWVudC5nZXRJZCgpIH0sXG5cdFx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiB7XG5cdFx0XHRcdGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsOiAoZTogSUV4cHJlc3Npb24pID0+IHtcblx0XHRcdFx0XHRpZiAoZSA9PT0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZ2V0U2VsZWN0ZWRFeHByZXNzaW9uKCk/LmV4cHJlc3Npb24pIHtcblx0XHRcdFx0XHRcdC8vIERvbid0IGZpbHRlciBpbnB1dCBib3hcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIGV4cHJlc3Npb25BbmRTY29wZUxhYmVsUHJvdmlkZXIuZ2V0S2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWwoZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRkbmQ6IG5ldyBXYXRjaEV4cHJlc3Npb25zRHJhZ0FuZERyb3AodGhpcy5kZWJ1Z1NlcnZpY2UpLFxuXHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHRoaXMuZ2V0TG9jYXRpb25CYXNlZENvbG9ycygpLmxpc3RPdmVycmlkZVN0eWxlc1xuXHRcdH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZSk7XG5cdFx0dGhpcy50cmVlLnNldElucHV0KHRoaXMuZGVidWdTZXJ2aWNlKTtcblx0XHRDT05URVhUX1dBVENIX0VYUFJFU1NJT05TX0ZPQ1VTRUQuYmluZFRvKHRoaXMudHJlZS5jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihWaXN1YWxpemVkVmFyaWFibGVSZW5kZXJlci5yZW5kZXJlck9uVmlzdWFsaXphdGlvblJhbmdlKHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLCB0aGlzLnRyZWUpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25Db250ZXh0TWVudShlID0+IHRoaXMub25Db250ZXh0TWVudShlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbk1vdXNlRGJsQ2xpY2soZSA9PiB0aGlzLm9uTW91c2VEYmxDbGljayhlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkub25EaWRDaGFuZ2VXYXRjaEV4cHJlc3Npb25zKGFzeW5jIHdlID0+IHtcblx0XHRcdHRoaXMud2F0Y2hFeHByZXNzaW9uc0V4aXN0LnNldCh0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFdhdGNoRXhwcmVzc2lvbnMoKS5sZW5ndGggPiAwKTtcblx0XHRcdGlmICghdGhpcy5pc0JvZHlWaXNpYmxlKCkpIHtcblx0XHRcdFx0dGhpcy5uZWVkc1JlZnJlc2ggPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHdlICYmICF3ZS5uYW1lKSB7XG5cdFx0XHRcdFx0Ly8gV2UgYXJlIGFkZGluZyBhIG5ldyBpbnB1dCBib3gsIG5vIG5lZWQgdG8gcmUtZXZhbHVhdGUgd2F0Y2ggZXhwcmVzc2lvbnNcblx0XHRcdFx0XHR1c2VDYWNoZWRFdmFsdWF0aW9uID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhd2FpdCB0aGlzLnRyZWUudXBkYXRlQ2hpbGRyZW4oKTtcblx0XHRcdFx0dXNlQ2FjaGVkRXZhbHVhdGlvbiA9IGZhbHNlO1xuXHRcdFx0XHRpZiAod2UgaW5zdGFuY2VvZiBFeHByZXNzaW9uKSB7XG5cdFx0XHRcdFx0dGhpcy50cmVlLnJldmVhbCh3ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRGb2N1c1N0YWNrRnJhbWUoKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLmlzQm9keVZpc2libGUoKSkge1xuXHRcdFx0XHR0aGlzLm5lZWRzUmVmcmVzaCA9IHRydWU7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLndhdGNoRXhwcmVzc2lvbnNVcGRhdGVkU2NoZWR1bGVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0dGhpcy53YXRjaEV4cHJlc3Npb25zVXBkYXRlZFNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5vbldpbGxVcGRhdGVWaWV3cygoKSA9PiB7XG5cdFx0XHRpZiAoIWlnbm9yZVZpZXdVcGRhdGVzKSB7XG5cdFx0XHRcdHRoaXMudHJlZS51cGRhdGVDaGlsZHJlbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eSh2aXNpYmxlID0+IHtcblx0XHRcdGlmICh2aXNpYmxlICYmIHRoaXMubmVlZHNSZWZyZXNoKSB7XG5cdFx0XHRcdHRoaXMud2F0Y2hFeHByZXNzaW9uc1VwZGF0ZWRTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0bGV0IGhvcml6b250YWxTY3JvbGxpbmc6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkub25EaWRTZWxlY3RFeHByZXNzaW9uKGUgPT4ge1xuXHRcdFx0Y29uc3QgZXhwcmVzc2lvbiA9IGU/LmV4cHJlc3Npb247XG5cdFx0XHRpZiAoZXhwcmVzc2lvbiAmJiB0aGlzLnRyZWUuaGFzTm9kZShleHByZXNzaW9uKSkge1xuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nID0gdGhpcy50cmVlLm9wdGlvbnMuaG9yaXpvbnRhbFNjcm9sbGluZztcblx0XHRcdFx0aWYgKGhvcml6b250YWxTY3JvbGxpbmcpIHtcblx0XHRcdFx0XHR0aGlzLnRyZWUudXBkYXRlT3B0aW9ucyh7IGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGV4cHJlc3Npb24ubmFtZSkge1xuXHRcdFx0XHRcdC8vIE9ubHkgcmVyZW5kZXIgaWYgdGhlIGlucHV0IGlzIGFscmVhZHkgZG9uZSBzaW5jZSBvdGhlcndpc2UgdGhlIHRyZWUgaXMgbm90IHlldCBhd2FyZSBvZiB0aGUgbmV3IGVsZW1lbnRcblx0XHRcdFx0XHR0aGlzLnRyZWUucmVyZW5kZXIoZXhwcmVzc2lvbik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoIWV4cHJlc3Npb24gJiYgaG9yaXpvbnRhbFNjcm9sbGluZyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMudHJlZS51cGRhdGVPcHRpb25zKHsgaG9yaXpvbnRhbFNjcm9sbGluZzogaG9yaXpvbnRhbFNjcm9sbGluZyB9KTtcblx0XHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZyA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5vbkRpZEV2YWx1YXRlTGF6eUV4cHJlc3Npb24oYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoZSBpbnN0YW5jZW9mIFZhcmlhYmxlICYmIHRoaXMudHJlZS5oYXNOb2RlKGUpKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudHJlZS51cGRhdGVDaGlsZHJlbihlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHRcdGF3YWl0IHRoaXMudHJlZS5leHBhbmQoZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMudHJlZS5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpOiB2b2lkIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXHRcdHRoaXMudHJlZS5kb21Gb2N1cygpO1xuXHR9XG5cblx0Y29sbGFwc2VBbGwoKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlLmNvbGxhcHNlQWxsKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uTW91c2VEYmxDbGljayhlOiBJVHJlZU1vdXNlRXZlbnQ8SUV4cHJlc3Npb24+KTogdm9pZCB7XG5cdFx0aWYgKChlLmJyb3dzZXJFdmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpLmNsYXNzTmFtZS5pbmRleE9mKCd0d2lzdGllJykgPj0gMCkge1xuXHRcdFx0Ly8gSWdub3JlIGRvdWJsZSBjbGljayBldmVudHMgb24gdHdpc3RpZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVsZW1lbnQgPSBlLmVsZW1lbnQ7XG5cdFx0Ly8gZG91YmxlIGNsaWNrIG9uIHByaW1pdGl2ZSB2YWx1ZTogb3BlbiBpbnB1dCBib3ggdG8gYmUgYWJsZSB0byBzZWxlY3QgYW5kIGNvcHkgdmFsdWUuXG5cdFx0Y29uc3Qgc2VsZWN0ZWRFeHByZXNzaW9uID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZ2V0U2VsZWN0ZWRFeHByZXNzaW9uKCk7XG5cdFx0aWYgKChlbGVtZW50IGluc3RhbmNlb2YgRXhwcmVzc2lvbiAmJiBlbGVtZW50ICE9PSBzZWxlY3RlZEV4cHJlc3Npb24/LmV4cHJlc3Npb24pIHx8IChlbGVtZW50IGluc3RhbmNlb2YgVmlzdWFsaXplZEV4cHJlc3Npb24gJiYgZWxlbWVudC50cmVlSXRlbS5jYW5FZGl0KSkge1xuXHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuc2V0U2VsZWN0ZWRFeHByZXNzaW9uKGVsZW1lbnQsIGZhbHNlKTtcblx0XHR9IGVsc2UgaWYgKCFlbGVtZW50KSB7XG5cdFx0XHQvLyBEb3VibGUgY2xpY2sgaW4gd2F0Y2ggcGFuZWwgdHJpZ2dlcnMgdG8gYWRkIGEgbmV3IHdhdGNoIGV4cHJlc3Npb25cblx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmFkZFdhdGNoRXhwcmVzc2lvbigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Db250ZXh0TWVudShlOiBJVHJlZUNvbnRleHRNZW51RXZlbnQ8SUV4cHJlc3Npb24+KTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGUuZWxlbWVudDtcblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLnRyZWUuZ2V0U2VsZWN0aW9uKCk7XG5cblx0XHR0aGlzLndhdGNoSXRlbVR5cGUuc2V0KGVsZW1lbnQgaW5zdGFuY2VvZiBFeHByZXNzaW9uID8gJ2V4cHJlc3Npb24nIDogZWxlbWVudCBpbnN0YW5jZW9mIFZhcmlhYmxlID8gJ3ZhcmlhYmxlJyA6IHVuZGVmaW5lZCk7XG5cdFx0Y29uc3QgYXR0cmlidXRlcyA9IGVsZW1lbnQgaW5zdGFuY2VvZiBWYXJpYWJsZSA/IGVsZW1lbnQucHJlc2VudGF0aW9uSGludD8uYXR0cmlidXRlcyA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLnZhcmlhYmxlUmVhZG9ubHkuc2V0KCEhYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLmluZGV4T2YoJ3JlYWRPbmx5JykgPj0gMCB8fCAhIWVsZW1lbnQ/LnByZXNlbnRhdGlvbkhpbnQ/LmxhenkpO1xuXHRcdGNvbnN0IGFjdGlvbnMgPSBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zKHRoaXMubWVudS5nZXRBY3Rpb25zKHsgYXJnOiBlbGVtZW50LCBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KSk7XG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZS5hbmNob3IsXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBhY3Rpb25zLFxuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+IGVsZW1lbnQgJiYgc2VsZWN0aW9uLmluY2x1ZGVzKGVsZW1lbnQpID8gc2VsZWN0aW9uIDogZWxlbWVudCA/IFtlbGVtZW50XSA6IFtdLFxuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIFdhdGNoRXhwcmVzc2lvbnNEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPElFeHByZXNzaW9uPiB7XG5cblx0Z2V0SGVpZ2h0KF9lbGVtZW50OiBJRXhwcmVzc2lvbik6IG51bWJlciB7XG5cdFx0cmV0dXJuIDIyO1xuXHR9XG5cblx0Z2V0VGVtcGxhdGVJZChlbGVtZW50OiBJRXhwcmVzc2lvbik6IHN0cmluZyB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBFeHByZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm4gV2F0Y2hFeHByZXNzaW9uc1JlbmRlcmVyLklEO1xuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVmlzdWFsaXplZEV4cHJlc3Npb24pIHtcblx0XHRcdHJldHVybiBWaXN1YWxpemVkVmFyaWFibGVSZW5kZXJlci5JRDtcblx0XHR9XG5cblx0XHQvLyBWYXJpYWJsZVxuXHRcdHJldHVybiBWYXJpYWJsZXNSZW5kZXJlci5JRDtcblx0fVxufVxuXG5mdW5jdGlvbiBpc0RlYnVnU2VydmljZShlbGVtZW50OiBhbnkpOiBlbGVtZW50IGlzIElEZWJ1Z1NlcnZpY2Uge1xuXHRyZXR1cm4gdHlwZW9mIGVsZW1lbnQuZ2V0Q29uZmlndXJhdGlvbk1hbmFnZXIgPT09ICdmdW5jdGlvbic7XG59XG5cbmNsYXNzIFdhdGNoRXhwcmVzc2lvbnNEYXRhU291cmNlIGV4dGVuZHMgQWJzdHJhY3RFeHByZXNzaW9uRGF0YVNvdXJjZTxJRGVidWdTZXJ2aWNlLCBJRXhwcmVzc2lvbj4ge1xuXG5cdHB1YmxpYyBvdmVycmlkZSBoYXNDaGlsZHJlbihlbGVtZW50OiBJRXhwcmVzc2lvbiB8IElEZWJ1Z1NlcnZpY2UpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXNEZWJ1Z1NlcnZpY2UoZWxlbWVudCkgfHwgZWxlbWVudC5oYXNDaGlsZHJlbjtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBkb0dldENoaWxkcmVuKGVsZW1lbnQ6IElEZWJ1Z1NlcnZpY2UgfCBJRXhwcmVzc2lvbik6IFByb21pc2U8QXJyYXk8SUV4cHJlc3Npb24+PiB7XG5cdFx0aWYgKGlzRGVidWdTZXJ2aWNlKGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBlbGVtZW50IGFzIElEZWJ1Z1NlcnZpY2U7XG5cdFx0XHRjb25zdCB3YXRjaEV4cHJlc3Npb25zID0gZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkuZ2V0V2F0Y2hFeHByZXNzaW9ucygpO1xuXHRcdFx0Y29uc3Qgdmlld01vZGVsID0gZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpO1xuXHRcdFx0cmV0dXJuIFByb21pc2UuYWxsKHdhdGNoRXhwcmVzc2lvbnMubWFwKHdlID0+ICEhd2UubmFtZSAmJiAhdXNlQ2FjaGVkRXZhbHVhdGlvblxuXHRcdFx0XHQ/IHdlLmV2YWx1YXRlKHZpZXdNb2RlbC5mb2N1c2VkU2Vzc2lvbiEsIHZpZXdNb2RlbC5mb2N1c2VkU3RhY2tGcmFtZSEsICd3YXRjaCcpLnRoZW4oKCkgPT4gd2UpXG5cdFx0XHRcdDogUHJvbWlzZS5yZXNvbHZlKHdlKSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50LmdldENoaWxkcmVuKCk7XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgV2F0Y2hFeHByZXNzaW9uc1JlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RFeHByZXNzaW9uc1JlbmRlcmVyIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd2F0Y2hleHByZXNzaW9uJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4cHJlc3Npb25SZW5kZXJlcjogRGVidWdFeHByZXNzaW9uUmVuZGVyZXIsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGRlYnVnU2VydmljZSwgY29udGV4dFZpZXdTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHR9XG5cblx0Z2V0IHRlbXBsYXRlSWQoKSB7XG5cdFx0cmV0dXJuIFdhdGNoRXhwcmVzc2lvbnNSZW5kZXJlci5JRDtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSByZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxJRXhwcmVzc2lvbiwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIGRhdGE6IElFeHByZXNzaW9uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5jbGVhcigpO1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGUuYWRkKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2RlYnVnLnNob3dWYXJpYWJsZVR5cGVzJykpIHtcblx0XHRcdFx0c3VwZXIucmVuZGVyRXhwcmVzc2lvbkVsZW1lbnQobm9kZS5lbGVtZW50LCBub2RlLCBkYXRhKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0c3VwZXIucmVuZGVyRXhwcmVzc2lvbkVsZW1lbnQobm9kZS5lbGVtZW50LCBub2RlLCBkYXRhKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJFeHByZXNzaW9uKGV4cHJlc3Npb246IElFeHByZXNzaW9uLCBkYXRhOiBJRXhwcmVzc2lvblRlbXBsYXRlRGF0YSwgaGlnaGxpZ2h0czogSUhpZ2hsaWdodFtdKTogdm9pZCB7XG5cdFx0bGV0IHRleHQ6IHN0cmluZztcblx0XHRkYXRhLnR5cGUudGV4dENvbnRlbnQgPSAnJztcblx0XHRjb25zdCBzaG93VHlwZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykuc2hvd1ZhcmlhYmxlVHlwZXM7XG5cdFx0aWYgKHNob3dUeXBlICYmIGV4cHJlc3Npb24udHlwZSkge1xuXHRcdFx0dGV4dCA9IHR5cGVvZiBleHByZXNzaW9uLnZhbHVlID09PSAnc3RyaW5nJyA/IGAke2V4cHJlc3Npb24ubmFtZX06IGAgOiBleHByZXNzaW9uLm5hbWU7XG5cdFx0XHQvL3JlbmRlciB0eXBlXG5cdFx0XHRkYXRhLnR5cGUudGV4dENvbnRlbnQgPSBleHByZXNzaW9uLnR5cGUgKyAnID0nO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZXh0ID0gdHlwZW9mIGV4cHJlc3Npb24udmFsdWUgPT09ICdzdHJpbmcnID8gYCR7ZXhwcmVzc2lvbi5uYW1lfSA9YCA6IGV4cHJlc3Npb24ubmFtZTtcblx0XHR9XG5cblx0XHRsZXQgdGl0bGU6IHN0cmluZztcblx0XHRpZiAoZXhwcmVzc2lvbi50eXBlKSB7XG5cdFx0XHRpZiAoc2hvd1R5cGUpIHtcblx0XHRcdFx0dGl0bGUgPSBgJHtleHByZXNzaW9uLm5hbWV9YDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRpdGxlID0gZXhwcmVzc2lvbi50eXBlID09PSBleHByZXNzaW9uLnZhbHVlID9cblx0XHRcdFx0XHRleHByZXNzaW9uLnR5cGUgOlxuXHRcdFx0XHRcdGAke2V4cHJlc3Npb24udHlwZX1gO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aXRsZSA9IGV4cHJlc3Npb24udmFsdWU7XG5cdFx0fVxuXG5cdFx0ZGF0YS5sYWJlbC5zZXQodGV4dCwgaGlnaGxpZ2h0cywgdGl0bGUpO1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGUuYWRkKHRoaXMuZXhwcmVzc2lvblJlbmRlcmVyLnJlbmRlclZhbHVlKGRhdGEudmFsdWUsIGV4cHJlc3Npb24sIHtcblx0XHRcdHNob3dDaGFuZ2VkOiB0cnVlLFxuXHRcdFx0bWF4VmFsdWVMZW5ndGg6IE1BWF9WQUxVRV9SRU5ERVJfTEVOR1RIX0lOX1ZJRVdMRVQsXG5cdFx0XHRjb2xvcml6ZTogdHJ1ZSxcblx0XHRcdHNlc3Npb246IGV4cHJlc3Npb24uZ2V0U2Vzc2lvbigpLFxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRJbnB1dEJveE9wdGlvbnMoZXhwcmVzc2lvbjogSUV4cHJlc3Npb24sIHNldHRpbmdWYWx1ZTogYm9vbGVhbik6IElJbnB1dEJveE9wdGlvbnMge1xuXHRcdGlmIChzZXR0aW5nVmFsdWUpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGluaXRpYWxWYWx1ZTogZXhwcmVzc2lvbi52YWx1ZSxcblx0XHRcdFx0YXJpYUxhYmVsOiBsb2NhbGl6ZSgndHlwZU5ld1ZhbHVlJywgXCJUeXBlIG5ldyB2YWx1ZVwiKSxcblx0XHRcdFx0b25GaW5pc2g6IGFzeW5jICh2YWx1ZTogc3RyaW5nLCBzdWNjZXNzOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHN1Y2Nlc3MgJiYgdmFsdWUpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGZvY3VzZWRGcmFtZSA9IHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTdGFja0ZyYW1lO1xuXHRcdFx0XHRcdFx0aWYgKGZvY3VzZWRGcmFtZSAmJiAoZXhwcmVzc2lvbiBpbnN0YW5jZW9mIFZhcmlhYmxlIHx8IGV4cHJlc3Npb24gaW5zdGFuY2VvZiBFeHByZXNzaW9uKSkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBleHByZXNzaW9uLnNldEV4cHJlc3Npb24odmFsdWUsIGZvY3VzZWRGcmFtZSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLnVwZGF0ZVZpZXdzKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpbml0aWFsVmFsdWU6IGV4cHJlc3Npb24ubmFtZSA/IGV4cHJlc3Npb24ubmFtZSA6ICcnLFxuXHRcdFx0YXJpYUxhYmVsOiBsb2NhbGl6ZSgnd2F0Y2hFeHByZXNzaW9uSW5wdXRBcmlhTGFiZWwnLCBcIlR5cGUgd2F0Y2ggZXhwcmVzc2lvblwiKSxcblx0XHRcdHBsYWNlaG9sZGVyOiBsb2NhbGl6ZSgnd2F0Y2hFeHByZXNzaW9uUGxhY2Vob2xkZXInLCBcIkV4cHJlc3Npb24gdG8gd2F0Y2hcIiksXG5cdFx0XHRvbkZpbmlzaDogKHZhbHVlOiBzdHJpbmcsIHN1Y2Nlc3M6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0aWYgKHN1Y2Nlc3MgJiYgdmFsdWUpIHtcblx0XHRcdFx0XHR0aGlzLmRlYnVnU2VydmljZS5yZW5hbWVXYXRjaEV4cHJlc3Npb24oZXhwcmVzc2lvbi5nZXRJZCgpLCB2YWx1ZSk7XG5cdFx0XHRcdFx0aWdub3JlVmlld1VwZGF0ZXMgPSB0cnVlO1xuXHRcdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLnVwZGF0ZVZpZXdzKCk7XG5cdFx0XHRcdFx0aWdub3JlVmlld1VwZGF0ZXMgPSBmYWxzZTtcblx0XHRcdFx0fSBlbHNlIGlmICghZXhwcmVzc2lvbi5uYW1lKSB7XG5cdFx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UucmVtb3ZlV2F0Y2hFeHByZXNzaW9ucyhleHByZXNzaW9uLmdldElkKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJBY3Rpb25CYXIoYWN0aW9uQmFyOiBBY3Rpb25CYXIsIGV4cHJlc3Npb246IElFeHByZXNzaW9uKSB7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBnZXRDb250ZXh0Rm9yV2F0Y2hFeHByZXNzaW9uTWVudSh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCBleHByZXNzaW9uKTtcblx0XHRjb25zdCBjb250ZXh0ID0gZXhwcmVzc2lvbjtcblx0XHRjb25zdCBtZW51ID0gdGhpcy5tZW51U2VydmljZS5nZXRNZW51QWN0aW9ucyhNZW51SWQuRGVidWdXYXRjaENvbnRleHQsIGNvbnRleHRLZXlTZXJ2aWNlLCB7IGFyZzogY29udGV4dCwgc2hvdWxkRm9yd2FyZEFyZ3M6IGZhbHNlIH0pO1xuXG5cdFx0Y29uc3QgeyBwcmltYXJ5IH0gPSBnZXRDb250ZXh0TWVudUFjdGlvbnMobWVudSwgJ2lubGluZScpO1xuXG5cdFx0YWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0YWN0aW9uQmFyLmNvbnRleHQgPSBjb250ZXh0O1xuXHRcdGFjdGlvbkJhci5wdXNoKHByaW1hcnksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHR9XG59XG5cbi8qKlxuICogR2V0cyBhIGNvbnRleHQga2V5IG92ZXJsYXkgdGhhdCBoYXMgY29udGV4dCBmb3IgdGhlIGdpdmVuIGV4cHJlc3Npb24uXG4gKi9cbmZ1bmN0aW9uIGdldENvbnRleHRGb3JXYXRjaEV4cHJlc3Npb25NZW51KHBhcmVudENvbnRleHQ6IElDb250ZXh0S2V5U2VydmljZSwgZXhwcmVzc2lvbjogSUV4cHJlc3Npb24pIHtcblx0cmV0dXJuIHBhcmVudENvbnRleHQuY3JlYXRlT3ZlcmxheShbXG5cdFx0W0NPTlRFWFRfQ0FOX1ZJRVdfTUVNT1JZLmtleSwgZXhwcmVzc2lvbi5tZW1vcnlSZWZlcmVuY2UgIT09IHVuZGVmaW5lZF0sXG5cdFx0W0NPTlRFWFRfV0FUQ0hfSVRFTV9UWVBFLmtleSwgJ2V4cHJlc3Npb24nXVxuXHRdKTtcbn1cblxuY2xhc3MgV2F0Y2hFeHByZXNzaW9uc0FjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPElFeHByZXNzaW9uPiB7XG5cblx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKHsgY29tbWVudDogWydEZWJ1ZyBpcyBhIG5vdW4gaW4gdGhpcyBjb250ZXh0LCBub3QgYSB2ZXJiLiddLCBrZXk6ICd3YXRjaEFyaWFUcmVlTGFiZWwnIH0sIFwiRGVidWcgV2F0Y2ggRXhwcmVzc2lvbnNcIik7XG5cdH1cblxuXHRnZXRBcmlhTGFiZWwoZWxlbWVudDogSUV4cHJlc3Npb24pOiBzdHJpbmcge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgRXhwcmVzc2lvbikge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCd3YXRjaEV4cHJlc3Npb25BcmlhTGFiZWwnLCBcInswfSwgdmFsdWUgezF9XCIsICg8RXhwcmVzc2lvbj5lbGVtZW50KS5uYW1lLCAoPEV4cHJlc3Npb24+ZWxlbWVudCkudmFsdWUpO1xuXHRcdH1cblxuXHRcdC8vIFZhcmlhYmxlXG5cdFx0cmV0dXJuIGxvY2FsaXplKCd3YXRjaFZhcmlhYmxlQXJpYUxhYmVsJywgXCJ7MH0sIHZhbHVlIHsxfVwiLCAoPFZhcmlhYmxlPmVsZW1lbnQpLm5hbWUsICg8VmFyaWFibGU+ZWxlbWVudCkudmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIFdhdGNoRXhwcmVzc2lvbnNEcmFnQW5kRHJvcCBpbXBsZW1lbnRzIElUcmVlRHJhZ0FuZERyb3A8SUV4cHJlc3Npb24+IHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSkgeyB9XG5cblx0b25EcmFnT3ZlcihkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCB0YXJnZXRFbGVtZW50OiBJRXhwcmVzc2lvbiB8IHVuZGVmaW5lZCwgdGFyZ2V0SW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCwgdGFyZ2V0U2VjdG9yOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogYm9vbGVhbiB8IElUcmVlRHJhZ092ZXJSZWFjdGlvbiB7XG5cdFx0aWYgKCEoZGF0YSBpbnN0YW5jZW9mIEVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4cHJlc3Npb25zID0gKGRhdGEgYXMgRWxlbWVudHNEcmFnQW5kRHJvcERhdGE8SUV4cHJlc3Npb24+KS5lbGVtZW50cztcblx0XHRpZiAoIShleHByZXNzaW9ucy5sZW5ndGggPiAwICYmIGV4cHJlc3Npb25zWzBdIGluc3RhbmNlb2YgRXhwcmVzc2lvbikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgZHJvcEVmZmVjdFBvc2l0aW9uOiBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAodGFyZ2V0SW5kZXggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Ly8gSG92ZXJpbmcgb3ZlciB0aGUgbGlzdFxuXHRcdFx0ZHJvcEVmZmVjdFBvc2l0aW9uID0gTGlzdERyYWdPdmVyRWZmZWN0UG9zaXRpb24uQWZ0ZXI7XG5cdFx0XHR0YXJnZXRJbmRleCA9IC0xO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBIb3ZlcmluZyBvdmVyIGFuIGVsZW1lbnRcblx0XHRcdHN3aXRjaCAodGFyZ2V0U2VjdG9yKSB7XG5cdFx0XHRcdGNhc2UgTGlzdFZpZXdUYXJnZXRTZWN0b3IuVE9QOlxuXHRcdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkNFTlRFUl9UT1A6XG5cdFx0XHRcdFx0ZHJvcEVmZmVjdFBvc2l0aW9uID0gTGlzdERyYWdPdmVyRWZmZWN0UG9zaXRpb24uQmVmb3JlOyBicmVhaztcblx0XHRcdFx0Y2FzZSBMaXN0Vmlld1RhcmdldFNlY3Rvci5DRU5URVJfQk9UVE9NOlxuXHRcdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkJPVFRPTTpcblx0XHRcdFx0XHRkcm9wRWZmZWN0UG9zaXRpb24gPSBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbi5BZnRlcjsgYnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgYWNjZXB0OiB0cnVlLCBlZmZlY3Q6IHsgdHlwZTogTGlzdERyYWdPdmVyRWZmZWN0VHlwZS5Nb3ZlLCBwb3NpdGlvbjogZHJvcEVmZmVjdFBvc2l0aW9uIH0sIGZlZWRiYWNrOiBbdGFyZ2V0SW5kZXhdIH0gc2F0aXNmaWVzIElUcmVlRHJhZ092ZXJSZWFjdGlvbjtcblx0fVxuXG5cdGdldERyYWdVUkkoZWxlbWVudDogSUV4cHJlc3Npb24pOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgRXhwcmVzc2lvbikgfHwgZWxlbWVudCA9PT0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZ2V0U2VsZWN0ZWRFeHByZXNzaW9uKCk/LmV4cHJlc3Npb24pIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiBlbGVtZW50LmdldElkKCk7XG5cdH1cblxuXHRnZXREcmFnTGFiZWwoZWxlbWVudHM6IElFeHByZXNzaW9uW10pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmIChlbGVtZW50cy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHJldHVybiBlbGVtZW50c1swXS5uYW1lO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRkcm9wKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldEVsZW1lbnQ6IElFeHByZXNzaW9uLCB0YXJnZXRJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIShkYXRhIGluc3RhbmNlb2YgRWxlbWVudHNEcmFnQW5kRHJvcERhdGEpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZHJhZ2dlZEVsZW1lbnQgPSAoZGF0YSBhcyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YTxJRXhwcmVzc2lvbj4pLmVsZW1lbnRzWzBdO1xuXHRcdGlmICghKGRyYWdnZWRFbGVtZW50IGluc3RhbmNlb2YgRXhwcmVzc2lvbikpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBkcmFnZ2VkIGVsZW1lbnQnKTtcblx0XHR9XG5cblx0XHRjb25zdCB3YXRjaGVzID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRXYXRjaEV4cHJlc3Npb25zKCk7XG5cdFx0Y29uc3Qgc291cmNlUG9zaXRpb24gPSB3YXRjaGVzLmluZGV4T2YoZHJhZ2dlZEVsZW1lbnQpO1xuXG5cdFx0bGV0IHRhcmdldFBvc2l0aW9uO1xuXHRcdGlmICh0YXJnZXRFbGVtZW50IGluc3RhbmNlb2YgRXhwcmVzc2lvbikge1xuXHRcdFx0dGFyZ2V0UG9zaXRpb24gPSB3YXRjaGVzLmluZGV4T2YodGFyZ2V0RWxlbWVudCk7XG5cblx0XHRcdHN3aXRjaCAodGFyZ2V0U2VjdG9yKSB7XG5cdFx0XHRcdGNhc2UgTGlzdFZpZXdUYXJnZXRTZWN0b3IuQk9UVE9NOlxuXHRcdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkNFTlRFUl9CT1RUT006XG5cdFx0XHRcdFx0dGFyZ2V0UG9zaXRpb24rKzsgYnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzb3VyY2VQb3NpdGlvbiA8IHRhcmdldFBvc2l0aW9uKSB7XG5cdFx0XHRcdHRhcmdldFBvc2l0aW9uLS07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhcmdldFBvc2l0aW9uID0gd2F0Y2hlcy5sZW5ndGggLSAxO1xuXHRcdH1cblxuXHRcdHRoaXMuZGVidWdTZXJ2aWNlLm1vdmVXYXRjaEV4cHJlc3Npb24oZHJhZ2dlZEVsZW1lbnQuZ2V0SWQoKSwgdGFyZ2V0UG9zaXRpb24pO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHsgfVxufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgQ29sbGFwc2UgZXh0ZW5kcyBWaWV3QWN0aW9uPFdhdGNoRXhwcmVzc2lvbnNWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd2F0Y2guY29sbGFwc2UnLFxuXHRcdFx0dmlld0lkOiBXQVRDSF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjb2xsYXBzZScsIFwiQ29sbGFwc2UgQWxsXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jb2xsYXBzZUFsbCxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9XQVRDSF9FWFBSRVNTSU9OU19FWElTVCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdG9yZGVyOiAzMCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgV0FUQ0hfVklFV19JRClcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bkluVmlldyhfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFdhdGNoRXhwcmVzc2lvbnNWaWV3KSB7XG5cdFx0dmlldy5jb2xsYXBzZUFsbCgpO1xuXHR9XG59KTtcblxuZXhwb3J0IGNvbnN0IEFERF9XQVRDSF9JRCA9ICd3b3JrYmVuY2guZGVidWcudmlld2xldC5hY3Rpb24uYWRkV2F0Y2hFeHByZXNzaW9uJzsgLy8gVXNlIG9sZCBhbmQgbG9uZyBpZCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbmV4cG9ydCBjb25zdCBBRERfV0FUQ0hfTEFCRUwgPSBsb2NhbGl6ZSgnYWRkV2F0Y2hFeHByZXNzaW9uJywgXCJBZGQgRXhwcmVzc2lvblwiKTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEFkZFdhdGNoRXhwcmVzc2lvbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQUREX1dBVENIX0lELFxuXHRcdFx0dGl0bGU6IEFERF9XQVRDSF9MQUJFTCxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdGljb246IHdhdGNoRXhwcmVzc2lvbnNBZGQsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBXQVRDSF9WSUVXX0lEKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgZGVidWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEZWJ1Z1NlcnZpY2UpO1xuXHRcdGRlYnVnU2VydmljZS5hZGRXYXRjaEV4cHJlc3Npb24oKTtcblx0fVxufSk7XG5cbmV4cG9ydCBjb25zdCBSRU1PVkVfV0FUQ0hfRVhQUkVTU0lPTlNfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guZGVidWcudmlld2xldC5hY3Rpb24ucmVtb3ZlQWxsV2F0Y2hFeHByZXNzaW9ucyc7XG5leHBvcnQgY29uc3QgUkVNT1ZFX1dBVENIX0VYUFJFU1NJT05TX0xBQkVMID0gbG9jYWxpemUoJ3JlbW92ZUFsbFdhdGNoRXhwcmVzc2lvbnMnLCBcIlJlbW92ZSBBbGwgRXhwcmVzc2lvbnNcIik7XG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVtb3ZlQWxsV2F0Y2hFeHByZXNzaW9uc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogUkVNT1ZFX1dBVENIX0VYUFJFU1NJT05TX0NPTU1BTkRfSUQsIC8vIFVzZSBvbGQgYW5kIGxvbmcgaWQgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG5cdFx0XHR0aXRsZTogUkVNT1ZFX1dBVENIX0VYUFJFU1NJT05TX0xBQkVMLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0aWNvbjogd2F0Y2hFeHByZXNzaW9uc1JlbW92ZUFsbCxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9XQVRDSF9FWFBSRVNTSU9OU19FWElTVCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdG9yZGVyOiAyMCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgV0FUQ0hfVklFV19JRClcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0XHRkZWJ1Z1NlcnZpY2UucmVtb3ZlV2F0Y2hFeHByZXNzaW9ucygpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENvcHlFeHByZXNzaW9uIGV4dGVuZHMgVmlld0FjdGlvbjxXYXRjaEV4cHJlc3Npb25zVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ09QWV9XQVRDSF9FWFBSRVNTSU9OX0NPTU1BTkRfSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NvcHlXYXRjaEV4cHJlc3Npb24nLCBcIkNvcHkgRXhwcmVzc2lvblwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdHZpZXdJZDogV0FUQ0hfVklFV19JRCxcblx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9XQVRDSF9FWFBSRVNTSU9OU19FWElTVCxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlDLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdEZvY3VzZWRWaWV3Q29udGV4dC5pc0VxdWFsVG8oV0FUQ0hfVklFV19JRCksXG5cdFx0XHRcdFx0Q09OVEVYVF9FWFBSRVNTSU9OX1NFTEVDVEVELm5lZ2F0ZSgpLFxuXHRcdFx0XHQpLFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5EZWJ1Z1dhdGNoQ29udGV4dCxcblx0XHRcdFx0b3JkZXI6IDIwLFxuXHRcdFx0XHRncm91cDogJzNfbW9kaWZpY2F0aW9uJyxcblx0XHRcdFx0d2hlbjogQ09OVEVYVF9XQVRDSF9JVEVNX1RZUEUuaXNFcXVhbFRvKCdleHByZXNzaW9uJylcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bkluVmlldyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogV2F0Y2hFeHByZXNzaW9uc1ZpZXcsIHZhbHVlPzogSUV4cHJlc3Npb24pOiB2b2lkIHtcblx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHR2YWx1ZSA9IHZpZXcudHJlZVNlbGVjdGlvbi5hdCgtMSk7XG5cdFx0fVxuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0Y2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQodmFsdWUubmFtZSk7XG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBUUEsU0FBK0IsNEJBQTRCLDhCQUE4QjtBQUN6RixTQUFTLHlCQUF5Qiw0QkFBNEI7QUFHOUQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxlQUFlO0FBRXhCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCLGlDQUFpQztBQUNqRSxTQUFTLFNBQWdCLGNBQWMsUUFBUSx1QkFBdUI7QUFDdEUsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQkFBNkIsMEJBQTBCO0FBQ2hFLFNBQVMscUJBQXFCLDJCQUEyQjtBQUN6RCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUErQztBQUN4RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFlBQVksZ0JBQWdCO0FBRXJDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMseUJBQXlCLDZCQUE2Qiw4QkFBOEIsaUNBQWlDLG1DQUFtQyx5QkFBOEMsZUFBcUQscUJBQXFCO0FBQ3pSLFNBQVMsWUFBWSxVQUFVLDRCQUE0QjtBQUMzRCxTQUFTLDhCQUE4Qiw2QkFBNkIsaUNBQTRFLHNCQUFzQjtBQUN0SyxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHFCQUFxQixpQ0FBaUM7QUFDL0QsU0FBUyxtQkFBbUIsa0NBQWtDO0FBRTlE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
