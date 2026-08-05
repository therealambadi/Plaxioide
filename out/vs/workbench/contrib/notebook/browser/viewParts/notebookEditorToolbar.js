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
import * as DOM from "../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ToolBar } from "../../../../../base/browser/ui/toolbar/toolbar.js";
import { Separator } from "../../../../../base/common/actions.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ScrollbarVisibility } from "../../../../../base/common/scrollable.js";
import { MenuEntryActionViewItem, SubmenuEntryActionViewItem } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, MenuItemAction, SubmenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { SELECT_KERNEL_ID } from "../controller/coreActions.js";
import { NOTEBOOK_EDITOR_ID, NotebookSetting } from "../../common/notebookCommon.js";
import { NotebooKernelActionViewItem } from "./notebookKernelView.js";
import { ActionViewWithLabel, UnifiedSubmenuActionView } from "../view/cellParts/cellActionView.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IWorkbenchAssignmentService } from "../../../../services/assignment/common/assignmentService.js";
import { disposableTimeout } from "../../../../../base/common/async.js";
import { HiddenItemStrategy, WorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { WorkbenchHoverDelegate } from "../../../../../platform/hover/browser/hover.js";
var RenderLabel = /* @__PURE__ */ ((RenderLabel2) => {
  RenderLabel2[RenderLabel2["Always"] = 0] = "Always";
  RenderLabel2[RenderLabel2["Never"] = 1] = "Never";
  RenderLabel2[RenderLabel2["Dynamic"] = 2] = "Dynamic";
  return RenderLabel2;
})(RenderLabel || {});
function convertConfiguration(value) {
  switch (value) {
    case true:
      return 0 /* Always */;
    case false:
      return 1 /* Never */;
    case "always":
      return 0 /* Always */;
    case "never":
      return 1 /* Never */;
    case "dynamic":
      return 2 /* Dynamic */;
  }
}
const ICON_ONLY_ACTION_WIDTH = 21;
const TOGGLE_MORE_ACTION_WIDTH = 21;
const ACTION_PADDING = 8;
class WorkbenchAlwaysLabelStrategy {
  constructor(notebookEditor, editorToolbar, goToMenu, instantiationService) {
    this.notebookEditor = notebookEditor;
    this.editorToolbar = editorToolbar;
    this.goToMenu = goToMenu;
    this.instantiationService = instantiationService;
  }
  actionProvider(action, options) {
    if (action.id === SELECT_KERNEL_ID) {
      return this.instantiationService.createInstance(NotebooKernelActionViewItem, action, this.notebookEditor, options);
    }
    if (action instanceof MenuItemAction) {
      return this.instantiationService.createInstance(ActionViewWithLabel, action, { hoverDelegate: options.hoverDelegate });
    }
    if (action instanceof SubmenuItemAction && action.item.submenu.id === MenuId.NotebookCellExecuteGoTo.id) {
      return this.instantiationService.createInstance(UnifiedSubmenuActionView, action, { hoverDelegate: options.hoverDelegate }, true, {
        getActions: () => {
          return this.goToMenu.getActions().find(([group]) => group === "navigation/execute")?.[1] ?? [];
        }
      }, this.actionProvider.bind(this));
    }
    return void 0;
  }
  calculateActions(leftToolbarContainerMaxWidth) {
    const initialPrimaryActions = this.editorToolbar.primaryActions;
    const initialSecondaryActions = this.editorToolbar.secondaryActions;
    const actionOutput = workbenchCalculateActions(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth);
    return {
      primaryActions: actionOutput.primaryActions.map((a) => a.action),
      secondaryActions: actionOutput.secondaryActions
    };
  }
}
class WorkbenchNeverLabelStrategy {
  constructor(notebookEditor, editorToolbar, goToMenu, instantiationService) {
    this.notebookEditor = notebookEditor;
    this.editorToolbar = editorToolbar;
    this.goToMenu = goToMenu;
    this.instantiationService = instantiationService;
  }
  actionProvider(action, options) {
    if (action.id === SELECT_KERNEL_ID) {
      return this.instantiationService.createInstance(NotebooKernelActionViewItem, action, this.notebookEditor, options);
    }
    if (action instanceof MenuItemAction) {
      return this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate });
    }
    if (action instanceof SubmenuItemAction) {
      if (action.item.submenu.id === MenuId.NotebookCellExecuteGoTo.id) {
        return this.instantiationService.createInstance(UnifiedSubmenuActionView, action, { hoverDelegate: options.hoverDelegate }, false, {
          getActions: () => {
            return this.goToMenu.getActions().find(([group]) => group === "navigation/execute")?.[1] ?? [];
          }
        }, this.actionProvider.bind(this));
      } else {
        return this.instantiationService.createInstance(SubmenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate });
      }
    }
    return void 0;
  }
  calculateActions(leftToolbarContainerMaxWidth) {
    const initialPrimaryActions = this.editorToolbar.primaryActions;
    const initialSecondaryActions = this.editorToolbar.secondaryActions;
    const actionOutput = workbenchCalculateActions(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth);
    return {
      primaryActions: actionOutput.primaryActions.map((a) => a.action),
      secondaryActions: actionOutput.secondaryActions
    };
  }
}
class WorkbenchDynamicLabelStrategy {
  constructor(notebookEditor, editorToolbar, goToMenu, instantiationService) {
    this.notebookEditor = notebookEditor;
    this.editorToolbar = editorToolbar;
    this.goToMenu = goToMenu;
    this.instantiationService = instantiationService;
  }
  actionProvider(action, options) {
    if (action.id === SELECT_KERNEL_ID) {
      return this.instantiationService.createInstance(NotebooKernelActionViewItem, action, this.notebookEditor, options);
    }
    const a = this.editorToolbar.primaryActions.find((a2) => a2.action.id === action.id);
    if (!a || a.renderLabel) {
      if (action instanceof MenuItemAction) {
        return this.instantiationService.createInstance(ActionViewWithLabel, action, { hoverDelegate: options.hoverDelegate });
      }
      if (action instanceof SubmenuItemAction && action.item.submenu.id === MenuId.NotebookCellExecuteGoTo.id) {
        return this.instantiationService.createInstance(UnifiedSubmenuActionView, action, { hoverDelegate: options.hoverDelegate }, true, {
          getActions: () => {
            return this.goToMenu.getActions().find(([group]) => group === "navigation/execute")?.[1] ?? [];
          }
        }, this.actionProvider.bind(this));
      }
      return void 0;
    } else {
      if (action instanceof MenuItemAction) {
        this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate });
      }
      if (action instanceof SubmenuItemAction) {
        if (action.item.submenu.id === MenuId.NotebookCellExecuteGoTo.id) {
          return this.instantiationService.createInstance(UnifiedSubmenuActionView, action, { hoverDelegate: options.hoverDelegate }, false, {
            getActions: () => {
              return this.goToMenu.getActions().find(([group]) => group === "navigation/execute")?.[1] ?? [];
            }
          }, this.actionProvider.bind(this));
        } else {
          return this.instantiationService.createInstance(SubmenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate });
        }
      }
      return void 0;
    }
  }
  calculateActions(leftToolbarContainerMaxWidth) {
    const initialPrimaryActions = this.editorToolbar.primaryActions;
    const initialSecondaryActions = this.editorToolbar.secondaryActions;
    const actionOutput = workbenchDynamicCalculateActions(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth);
    return {
      primaryActions: actionOutput.primaryActions.map((a) => a.action),
      secondaryActions: actionOutput.secondaryActions
    };
  }
}
let NotebookEditorWorkbenchToolbar = class extends Disposable {
  constructor(notebookEditor, contextKeyService, notebookOptions, domNode, instantiationService, configurationService, contextMenuService, menuService, editorService, keybindingService, experimentService) {
    super();
    this.notebookEditor = notebookEditor;
    this.contextKeyService = contextKeyService;
    this.notebookOptions = notebookOptions;
    this.domNode = domNode;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.contextMenuService = contextMenuService;
    this.menuService = menuService;
    this.editorService = editorService;
    this.keybindingService = keybindingService;
    this.experimentService = experimentService;
    this._useGlobalToolbar = false;
    this._renderLabel = 0 /* Always */;
    this._visible = false;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._dimension = null;
    this._primaryActions = [];
    this._secondaryActions = [];
    this._buildBody();
    this._register(Event.debounce(
      this.editorService.onDidActiveEditorChange,
      (last, _current) => last,
      200
    )(this._updatePerEditorChange, this));
    this._registerNotebookActionsToolbar();
    this._register(DOM.addDisposableListener(this.domNode, DOM.EventType.CONTEXT_MENU, (e) => {
      const event = new StandardMouseEvent(DOM.getWindow(this.domNode), e);
      this.contextMenuService.showContextMenu({
        menuId: MenuId.NotebookToolbarContext,
        getAnchor: () => event
      });
    }));
  }
  get primaryActions() {
    return this._primaryActions;
  }
  get secondaryActions() {
    return this._secondaryActions;
  }
  set visible(visible) {
    if (this._visible !== visible) {
      this._visible = visible;
      this._onDidChangeVisibility.fire(visible);
    }
  }
  get useGlobalToolbar() {
    return this._useGlobalToolbar;
  }
  _buildBody() {
    this._notebookTopLeftToolbarContainer = document.createElement("div");
    this._notebookTopLeftToolbarContainer.classList.add("notebook-toolbar-left");
    this._leftToolbarScrollable = new DomScrollableElement(this._notebookTopLeftToolbarContainer, {
      vertical: ScrollbarVisibility.Hidden,
      horizontal: ScrollbarVisibility.Visible,
      horizontalScrollbarSize: 3,
      useShadows: false,
      scrollYToX: true
    });
    this._register(this._leftToolbarScrollable);
    DOM.append(this.domNode, this._leftToolbarScrollable.getDomNode());
    this._notebookTopRightToolbarContainer = document.createElement("div");
    this._notebookTopRightToolbarContainer.classList.add("notebook-toolbar-right");
    DOM.append(this.domNode, this._notebookTopRightToolbarContainer);
  }
  _updatePerEditorChange() {
    if (this.editorService.activeEditorPane?.getId() === NOTEBOOK_EDITOR_ID) {
      const notebookEditor = this.editorService.activeEditorPane.getControl();
      if (notebookEditor === this.notebookEditor) {
        this._showNotebookActionsinEditorToolbar();
        return;
      }
    }
  }
  _registerNotebookActionsToolbar() {
    this._notebookGlobalActionsMenu = this._register(this.menuService.createMenu(this.notebookEditor.creationOptions.menuIds.notebookToolbar, this.contextKeyService));
    this._executeGoToActionsMenu = this._register(this.menuService.createMenu(MenuId.NotebookCellExecuteGoTo, this.contextKeyService));
    this._useGlobalToolbar = this.notebookOptions.getDisplayOptions().globalToolbar;
    this._renderLabel = this._convertConfiguration(this.configurationService.getValue(NotebookSetting.globalToolbarShowLabel));
    this._updateStrategy();
    const context = {
      ui: true,
      notebookEditor: this.notebookEditor,
      source: "notebookToolbar"
    };
    const actionProvider = (action, options) => {
      if (action.id === SELECT_KERNEL_ID) {
        return this.instantiationService.createInstance(NotebooKernelActionViewItem, action, this.notebookEditor, options);
      }
      if (this._renderLabel !== 1 /* Never */) {
        const a = this._primaryActions.find((a2) => a2.action.id === action.id);
        if (a && a.renderLabel) {
          return action instanceof MenuItemAction ? this.instantiationService.createInstance(ActionViewWithLabel, action, { hoverDelegate: options.hoverDelegate }) : void 0;
        } else {
          return action instanceof MenuItemAction ? this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate }) : void 0;
        }
      } else {
        return action instanceof MenuItemAction ? this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate }) : void 0;
      }
    };
    const hoverDelegate = this._register(this.instantiationService.createInstance(WorkbenchHoverDelegate, "element", { instantHover: true }, {}));
    hoverDelegate.setInstantHoverTimeLimit(600);
    const leftToolbarOptions = {
      hiddenItemStrategy: HiddenItemStrategy.RenderInSecondaryGroup,
      resetMenu: MenuId.NotebookToolbar,
      actionViewItemProvider: (action, options) => {
        return this._strategy.actionProvider(action, options);
      },
      getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id),
      renderDropdownAsChildElement: true,
      hoverDelegate
    };
    this._notebookLeftToolbar = this.instantiationService.createInstance(
      WorkbenchToolBar,
      this._notebookTopLeftToolbarContainer,
      leftToolbarOptions
    );
    this._register(this._notebookLeftToolbar);
    this._notebookLeftToolbar.context = context;
    this._notebookRightToolbar = new ToolBar(this._notebookTopRightToolbarContainer, this.contextMenuService, {
      getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id),
      actionViewItemProvider: actionProvider,
      renderDropdownAsChildElement: true,
      hoverDelegate
    });
    this._register(this._notebookRightToolbar);
    this._notebookRightToolbar.context = context;
    this._showNotebookActionsinEditorToolbar();
    let dropdownIsVisible = false;
    let deferredUpdate;
    this._register(this._notebookGlobalActionsMenu.onDidChange(() => {
      if (dropdownIsVisible) {
        deferredUpdate = () => this._showNotebookActionsinEditorToolbar();
        return;
      }
      if (this.notebookEditor.isVisible) {
        this._showNotebookActionsinEditorToolbar();
      }
    }));
    this._register(this._notebookLeftToolbar.onDidChangeDropdownVisibility((visible) => {
      dropdownIsVisible = visible;
      if (deferredUpdate && !visible) {
        setTimeout(() => {
          deferredUpdate?.();
        }, 0);
        deferredUpdate = void 0;
      }
    }));
    this._register(this.notebookOptions.onDidChangeOptions((e) => {
      if (e.globalToolbar !== void 0) {
        this._useGlobalToolbar = this.notebookOptions.getDisplayOptions().globalToolbar;
        this._showNotebookActionsinEditorToolbar();
      }
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.globalToolbarShowLabel)) {
        this._renderLabel = this._convertConfiguration(this.configurationService.getValue(NotebookSetting.globalToolbarShowLabel));
        this._updateStrategy();
        const oldElement = this._notebookLeftToolbar.getElement();
        oldElement.remove();
        this._notebookLeftToolbar.dispose();
        this._notebookLeftToolbar = this.instantiationService.createInstance(
          WorkbenchToolBar,
          this._notebookTopLeftToolbarContainer,
          leftToolbarOptions
        );
        this._register(this._notebookLeftToolbar);
        this._notebookLeftToolbar.context = context;
        this._showNotebookActionsinEditorToolbar();
        return;
      }
    }));
    if (this.experimentService) {
      this.experimentService.getTreatment("nbtoolbarineditor").then((treatment) => {
        if (treatment === void 0) {
          return;
        }
        if (this._useGlobalToolbar !== treatment) {
          this._useGlobalToolbar = treatment;
          this._showNotebookActionsinEditorToolbar();
        }
      });
    }
  }
  _updateStrategy() {
    switch (this._renderLabel) {
      case 0 /* Always */:
        this._strategy = new WorkbenchAlwaysLabelStrategy(this.notebookEditor, this, this._executeGoToActionsMenu, this.instantiationService);
        break;
      case 1 /* Never */:
        this._strategy = new WorkbenchNeverLabelStrategy(this.notebookEditor, this, this._executeGoToActionsMenu, this.instantiationService);
        break;
      case 2 /* Dynamic */:
        this._strategy = new WorkbenchDynamicLabelStrategy(this.notebookEditor, this, this._executeGoToActionsMenu, this.instantiationService);
        break;
    }
  }
  _convertConfiguration(value) {
    switch (value) {
      case true:
        return 0 /* Always */;
      case false:
        return 1 /* Never */;
      case "always":
        return 0 /* Always */;
      case "never":
        return 1 /* Never */;
      case "dynamic":
        return 2 /* Dynamic */;
    }
  }
  _showNotebookActionsinEditorToolbar() {
    if (!this.notebookEditor.hasModel()) {
      this._deferredActionUpdate?.dispose();
      this._deferredActionUpdate = void 0;
      this.visible = false;
      return;
    }
    if (this._deferredActionUpdate) {
      return;
    }
    if (!this._useGlobalToolbar) {
      this.domNode.style.display = "none";
      this._deferredActionUpdate = void 0;
      this.visible = false;
    } else {
      this._deferredActionUpdate = disposableTimeout(async () => {
        await this._setNotebookActions();
        this.visible = true;
        this._deferredActionUpdate?.dispose();
        this._deferredActionUpdate = void 0;
      }, 50);
    }
  }
  async _setNotebookActions() {
    const groups = this._notebookGlobalActionsMenu.getActions({ shouldForwardArgs: true, renderShortTitle: true });
    this.domNode.style.display = "flex";
    const primaryLeftGroups = groups.filter((group) => /^navigation/.test(group[0]));
    const primaryActions = [];
    primaryLeftGroups.sort((a, b) => {
      if (a[0] === "navigation") {
        return 1;
      }
      if (b[0] === "navigation") {
        return -1;
      }
      return 0;
    }).forEach((group, index) => {
      primaryActions.push(...group[1]);
      if (index < primaryLeftGroups.length - 1) {
        primaryActions.push(new Separator());
      }
    });
    const primaryRightGroup = groups.find((group) => /^status/.test(group[0]));
    const primaryRightActions = primaryRightGroup ? primaryRightGroup[1] : [];
    const secondaryActions = groups.filter((group) => !/^navigation/.test(group[0]) && !/^status/.test(group[0])).reduce((prev, curr) => {
      prev.push(...curr[1]);
      return prev;
    }, []);
    this._notebookLeftToolbar.setActions([], []);
    this._primaryActions = primaryActions.map((action) => ({
      action,
      size: action instanceof Separator ? 1 : 0,
      renderLabel: true,
      visible: true
    }));
    this._notebookLeftToolbar.setActions(primaryActions, secondaryActions);
    this._secondaryActions = secondaryActions;
    this._notebookRightToolbar.setActions(primaryRightActions, []);
    this._secondaryActions = secondaryActions;
    if (this._dimension && this._dimension.width >= 0 && this._dimension.height >= 0) {
      this._cacheItemSizes(this._notebookLeftToolbar);
    }
    this._computeSizes();
  }
  _cacheItemSizes(toolbar) {
    for (let i = 0; i < toolbar.getItemsLength(); i++) {
      const action = toolbar.getItemAction(i);
      if (action && action.id !== "toolbar.toggle.more") {
        const existing = this._primaryActions.find((a) => a.action.id === action.id);
        if (existing) {
          existing.size = toolbar.getItemWidth(i);
        }
      }
    }
  }
  _computeSizes() {
    const toolbar = this._notebookLeftToolbar;
    const rightToolbar = this._notebookRightToolbar;
    if (toolbar && rightToolbar && this._dimension && this._dimension.height >= 0 && this._dimension.width >= 0) {
      if (this._primaryActions.length === 0 && toolbar.getItemsLength() !== this._primaryActions.length) {
        this._cacheItemSizes(this._notebookLeftToolbar);
      }
      if (this._primaryActions.length === 0) {
        return;
      }
      const kernelWidth = (rightToolbar.getItemsLength() ? rightToolbar.getItemWidth(0) : 0) + ACTION_PADDING;
      const leftToolbarContainerMaxWidth = this._dimension.width - kernelWidth - (ACTION_PADDING + TOGGLE_MORE_ACTION_WIDTH) - /** toolbar left margin */
      ACTION_PADDING - /** toolbar right margin */
      ACTION_PADDING;
      const calculatedActions = this._strategy.calculateActions(leftToolbarContainerMaxWidth);
      this._notebookLeftToolbar.setActions(calculatedActions.primaryActions, calculatedActions.secondaryActions);
    }
  }
  layout(dimension) {
    this._dimension = dimension;
    if (!this._useGlobalToolbar) {
      this.domNode.style.display = "none";
    } else {
      this.domNode.style.display = "flex";
    }
    this._computeSizes();
  }
  dispose() {
    this._notebookLeftToolbar.context = void 0;
    this._notebookRightToolbar.context = void 0;
    this._notebookLeftToolbar.dispose();
    this._notebookRightToolbar.dispose();
    this._notebookLeftToolbar = null;
    this._notebookRightToolbar = null;
    this._deferredActionUpdate?.dispose();
    this._deferredActionUpdate = void 0;
    super.dispose();
  }
};
NotebookEditorWorkbenchToolbar = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IWorkbenchAssignmentService)
], NotebookEditorWorkbenchToolbar);
function workbenchCalculateActions(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth) {
  return actionOverflowHelper(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth, false);
}
function workbenchDynamicCalculateActions(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth) {
  if (initialPrimaryActions.length === 0) {
    return { primaryActions: [], secondaryActions: initialSecondaryActions };
  }
  const visibleActionLength = initialPrimaryActions.filter((action) => action.size !== 0).length;
  const totalWidthWithLabels = initialPrimaryActions.map((action) => action.size).reduce((a, b) => a + b, 0) + (visibleActionLength - 1) * ACTION_PADDING;
  if (totalWidthWithLabels <= leftToolbarContainerMaxWidth) {
    initialPrimaryActions.forEach((action) => {
      action.renderLabel = true;
    });
    return actionOverflowHelper(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth, false);
  }
  if (visibleActionLength * ICON_ONLY_ACTION_WIDTH + (visibleActionLength - 1) * ACTION_PADDING > leftToolbarContainerMaxWidth) {
    initialPrimaryActions.forEach((action) => {
      action.renderLabel = false;
    });
    return actionOverflowHelper(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth, true);
  }
  let sum = 0;
  let lastActionWithLabel = -1;
  for (let i = 0; i < initialPrimaryActions.length; i++) {
    sum += initialPrimaryActions[i].size + ACTION_PADDING;
    if (initialPrimaryActions[i].action instanceof Separator) {
      const remainingItems = initialPrimaryActions.slice(i + 1).filter((action) => action.size !== 0);
      const newTotalSum = sum + (remainingItems.length === 0 ? 0 : remainingItems.length * ICON_ONLY_ACTION_WIDTH + (remainingItems.length - 1) * ACTION_PADDING);
      if (newTotalSum <= leftToolbarContainerMaxWidth) {
        lastActionWithLabel = i;
      }
    } else {
      continue;
    }
  }
  if (lastActionWithLabel < 0) {
    initialPrimaryActions.forEach((action) => {
      action.renderLabel = false;
    });
    return actionOverflowHelper(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth, true);
  }
  initialPrimaryActions.slice(0, lastActionWithLabel + 1).forEach((action) => {
    action.renderLabel = true;
  });
  initialPrimaryActions.slice(lastActionWithLabel + 1).forEach((action) => {
    action.renderLabel = false;
  });
  return {
    primaryActions: initialPrimaryActions,
    secondaryActions: initialSecondaryActions
  };
}
function actionOverflowHelper(initialPrimaryActions, initialSecondaryActions, leftToolbarContainerMaxWidth, iconOnly) {
  const renderActions = [];
  const overflow = [];
  let currentSize = 0;
  let nonZeroAction = false;
  let containerFull = false;
  if (initialPrimaryActions.length === 0) {
    return { primaryActions: [], secondaryActions: initialSecondaryActions };
  }
  for (let i = 0; i < initialPrimaryActions.length; i++) {
    const actionModel = initialPrimaryActions[i];
    const itemSize = iconOnly ? actionModel.size === 0 ? 0 : ICON_ONLY_ACTION_WIDTH : actionModel.size;
    if (actionModel.action instanceof Separator && renderActions.length > 0 && renderActions[renderActions.length - 1].action instanceof Separator) {
      continue;
    }
    if (actionModel.action instanceof Separator && !nonZeroAction) {
      continue;
    }
    if (currentSize + itemSize <= leftToolbarContainerMaxWidth && !containerFull) {
      currentSize += ACTION_PADDING + itemSize;
      renderActions.push(actionModel);
      if (itemSize !== 0) {
        nonZeroAction = true;
      }
      if (actionModel.action instanceof Separator) {
        nonZeroAction = false;
      }
    } else {
      containerFull = true;
      if (itemSize === 0) {
        renderActions.push(actionModel);
      } else {
        if (actionModel.action instanceof Separator) {
          continue;
        }
        overflow.push(actionModel.action);
      }
    }
  }
  for (let i = renderActions.length - 1; i > 0; i--) {
    const temp = renderActions[i];
    if (temp.size === 0) {
      continue;
    }
    if (temp.action instanceof Separator) {
      renderActions.splice(i, 1);
    }
    break;
  }
  if (renderActions.length && renderActions[renderActions.length - 1].action instanceof Separator) {
    renderActions.pop();
  }
  if (overflow.length !== 0) {
    overflow.push(new Separator());
  }
  if (iconOnly) {
    const markdownIndex = renderActions.findIndex((a) => a.action.id === "notebook.cell.insertMarkdownCellBelow");
    if (markdownIndex !== -1) {
      renderActions.splice(markdownIndex, 1);
    }
  }
  return {
    primaryActions: renderActions,
    secondaryActions: [...overflow, ...initialSecondaryActions]
  };
}
export {
  NotebookEditorWorkbenchToolbar,
  RenderLabel,
  convertConfiguration,
  workbenchCalculateActions,
  workbenchDynamicCalculateActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXdQYXJ0cy9ub3RlYm9va0VkaXRvclRvb2xiYXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBEb21TY3JvbGxhYmxlRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zY3JvbGxiYXIvc2Nyb2xsYWJsZUVsZW1lbnQuanMnO1xuaW1wb3J0IHsgVG9vbEJhciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90b29sYmFyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiwgU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjcm9sbGJhclZpc2liaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcbmltcG9ydCB7IE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBTdWJtZW51RW50cnlBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudSwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIE1lbnVJdGVtQWN0aW9uLCBTdWJtZW51SXRlbUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBTRUxFQ1RfS0VSTkVMX0lEIH0gZnJvbSAnLi4vY29udHJvbGxlci9jb3JlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19FRElUT1JfSUQsIE5vdGVib29rU2V0dGluZyB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSB9IGZyb20gJy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9vS2VybmVsQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuL25vdGVib29rS2VybmVsVmlldy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25WaWV3V2l0aExhYmVsLCBVbmlmaWVkU3VibWVudUFjdGlvblZpZXcgfSBmcm9tICcuLi92aWV3L2NlbGxQYXJ0cy9jZWxsQWN0aW9uVmlldy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9hc3NpZ25tZW50L2NvbW1vbi9hc3NpZ25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va09wdGlvbnMgfSBmcm9tICcuLi9ub3RlYm9va09wdGlvbnMuanMnO1xuaW1wb3J0IHsgSUFjdGlvblZpZXdJdGVtLCBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IGRpc3Bvc2FibGVUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSGlkZGVuSXRlbVN0cmF0ZWd5LCBJV29ya2JlbmNoVG9vbEJhck9wdGlvbnMsIFdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uVmlld0l0ZW1PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuXG5pbnRlcmZhY2UgSUFjdGlvbk1vZGVsIHtcblx0YWN0aW9uOiBJQWN0aW9uO1xuXHRzaXplOiBudW1iZXI7XG5cdHZpc2libGU6IGJvb2xlYW47XG5cdHJlbmRlckxhYmVsOiBib29sZWFuO1xufVxuXG5leHBvcnQgZW51bSBSZW5kZXJMYWJlbCB7XG5cdEFsd2F5cyA9IDAsXG5cdE5ldmVyID0gMSxcblx0RHluYW1pYyA9IDJcbn1cblxuZXhwb3J0IHR5cGUgUmVuZGVyTGFiZWxXaXRoRmFsbGJhY2sgPSB0cnVlIHwgZmFsc2UgfCAnYWx3YXlzJyB8ICduZXZlcicgfCAnZHluYW1pYyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0Q29uZmlndXJhdGlvbih2YWx1ZTogUmVuZGVyTGFiZWxXaXRoRmFsbGJhY2spOiBSZW5kZXJMYWJlbCB7XG5cdHN3aXRjaCAodmFsdWUpIHtcblx0XHRjYXNlIHRydWU6XG5cdFx0XHRyZXR1cm4gUmVuZGVyTGFiZWwuQWx3YXlzO1xuXHRcdGNhc2UgZmFsc2U6XG5cdFx0XHRyZXR1cm4gUmVuZGVyTGFiZWwuTmV2ZXI7XG5cdFx0Y2FzZSAnYWx3YXlzJzpcblx0XHRcdHJldHVybiBSZW5kZXJMYWJlbC5BbHdheXM7XG5cdFx0Y2FzZSAnbmV2ZXInOlxuXHRcdFx0cmV0dXJuIFJlbmRlckxhYmVsLk5ldmVyO1xuXHRcdGNhc2UgJ2R5bmFtaWMnOlxuXHRcdFx0cmV0dXJuIFJlbmRlckxhYmVsLkR5bmFtaWM7XG5cdH1cbn1cblxuY29uc3QgSUNPTl9PTkxZX0FDVElPTl9XSURUSCA9IDIxO1xuY29uc3QgVE9HR0xFX01PUkVfQUNUSU9OX1dJRFRIID0gMjE7XG5jb25zdCBBQ1RJT05fUEFERElORyA9IDg7XG5cbmludGVyZmFjZSBJQWN0aW9uTGF5b3V0U3RyYXRlZ3kge1xuXHRhY3Rpb25Qcm92aWRlcjogSUFjdGlvblZpZXdJdGVtUHJvdmlkZXI7XG5cdGNhbGN1bGF0ZUFjdGlvbnMobGVmdFRvb2xiYXJDb250YWluZXJNYXhXaWR0aDogbnVtYmVyKTogeyBwcmltYXJ5QWN0aW9uczogSUFjdGlvbltdOyBzZWNvbmRhcnlBY3Rpb25zOiBJQWN0aW9uW10gfTtcbn1cblxuY2xhc3MgV29ya2JlbmNoQWx3YXlzTGFiZWxTdHJhdGVneSBpbXBsZW1lbnRzIElBY3Rpb25MYXlvdXRTdHJhdGVneSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSxcblx0XHRyZWFkb25seSBlZGl0b3JUb29sYmFyOiBOb3RlYm9va0VkaXRvcldvcmtiZW5jaFRvb2xiYXIsXG5cdFx0cmVhZG9ubHkgZ29Ub01lbnU6IElNZW51LFxuXHRcdHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpIHsgfVxuXG5cdGFjdGlvblByb3ZpZGVyKGFjdGlvbjogSUFjdGlvbiwgb3B0aW9uczogSUFjdGlvblZpZXdJdGVtT3B0aW9ucyk6IElBY3Rpb25WaWV3SXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGFjdGlvbi5pZCA9PT0gU0VMRUNUX0tFUk5FTF9JRCkge1xuXHRcdFx0Ly9cdHRoaXMgaXMgYmVpbmcgZGlzcG9zZWQgYnkgdGhlIGNvbnN1bWVyXG5cdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9vS2VybmVsQWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwgdGhpcy5ub3RlYm9va0VkaXRvciwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShBY3Rpb25WaWV3V2l0aExhYmVsLCBhY3Rpb24sIHsgaG92ZXJEZWxlZ2F0ZTogb3B0aW9ucy5ob3ZlckRlbGVnYXRlIH0pO1xuXHRcdH1cblxuXHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBTdWJtZW51SXRlbUFjdGlvbiAmJiBhY3Rpb24uaXRlbS5zdWJtZW51LmlkID09PSBNZW51SWQuTm90ZWJvb2tDZWxsRXhlY3V0ZUdvVG8uaWQpIHtcblx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVuaWZpZWRTdWJtZW51QWN0aW9uVmlldywgYWN0aW9uLCB7IGhvdmVyRGVsZWdhdGU6IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9LCB0cnVlLCB7XG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5nb1RvTWVudS5nZXRBY3Rpb25zKCkuZmluZCgoW2dyb3VwXSkgPT4gZ3JvdXAgPT09ICduYXZpZ2F0aW9uL2V4ZWN1dGUnKT8uWzFdID8/IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzLmFjdGlvblByb3ZpZGVyLmJpbmQodGhpcykpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjYWxjdWxhdGVBY3Rpb25zKGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGg6IG51bWJlcik6IHsgcHJpbWFyeUFjdGlvbnM6IElBY3Rpb25bXTsgc2Vjb25kYXJ5QWN0aW9uczogSUFjdGlvbltdIH0ge1xuXHRcdGNvbnN0IGluaXRpYWxQcmltYXJ5QWN0aW9ucyA9IHRoaXMuZWRpdG9yVG9vbGJhci5wcmltYXJ5QWN0aW9ucztcblx0XHRjb25zdCBpbml0aWFsU2Vjb25kYXJ5QWN0aW9ucyA9IHRoaXMuZWRpdG9yVG9vbGJhci5zZWNvbmRhcnlBY3Rpb25zO1xuXG5cdFx0Y29uc3QgYWN0aW9uT3V0cHV0ID0gd29ya2JlbmNoQ2FsY3VsYXRlQWN0aW9ucyhpbml0aWFsUHJpbWFyeUFjdGlvbnMsIGluaXRpYWxTZWNvbmRhcnlBY3Rpb25zLCBsZWZ0VG9vbGJhckNvbnRhaW5lck1heFdpZHRoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJpbWFyeUFjdGlvbnM6IGFjdGlvbk91dHB1dC5wcmltYXJ5QWN0aW9ucy5tYXAoYSA9PiBhLmFjdGlvbiksXG5cdFx0XHRzZWNvbmRhcnlBY3Rpb25zOiBhY3Rpb25PdXRwdXQuc2Vjb25kYXJ5QWN0aW9uc1xuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgV29ya2JlbmNoTmV2ZXJMYWJlbFN0cmF0ZWd5IGltcGxlbWVudHMgSUFjdGlvbkxheW91dFN0cmF0ZWd5IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbm90ZWJvb2tFZGl0b3I6IElOb3RlYm9va0VkaXRvckRlbGVnYXRlLFxuXHRcdHJlYWRvbmx5IGVkaXRvclRvb2xiYXI6IE5vdGVib29rRWRpdG9yV29ya2JlbmNoVG9vbGJhcixcblx0XHRyZWFkb25seSBnb1RvTWVudTogSU1lbnUsXG5cdFx0cmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSkgeyB9XG5cblx0YWN0aW9uUHJvdmlkZXIoYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zKTogSUFjdGlvblZpZXdJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoYWN0aW9uLmlkID09PSBTRUxFQ1RfS0VSTkVMX0lEKSB7XG5cdFx0XHQvL1x0dGhpcyBpcyBiZWluZyBkaXNwb3NlZCBieSB0aGUgY29uc3VtZXJcblx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29LZXJuZWxBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCB0aGlzLm5vdGVib29rRWRpdG9yLCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHsgaG92ZXJEZWxlZ2F0ZTogb3B0aW9ucy5ob3ZlckRlbGVnYXRlIH0pO1xuXHRcdH1cblxuXHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBTdWJtZW51SXRlbUFjdGlvbikge1xuXHRcdFx0aWYgKGFjdGlvbi5pdGVtLnN1Ym1lbnUuaWQgPT09IE1lbnVJZC5Ob3RlYm9va0NlbGxFeGVjdXRlR29Uby5pZCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVbmlmaWVkU3VibWVudUFjdGlvblZpZXcsIGFjdGlvbiwgeyBob3ZlckRlbGVnYXRlOiBvcHRpb25zLmhvdmVyRGVsZWdhdGUgfSwgZmFsc2UsIHtcblx0XHRcdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5nb1RvTWVudS5nZXRBY3Rpb25zKCkuZmluZCgoW2dyb3VwXSkgPT4gZ3JvdXAgPT09ICduYXZpZ2F0aW9uL2V4ZWN1dGUnKT8uWzFdID8/IFtdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgdGhpcy5hY3Rpb25Qcm92aWRlci5iaW5kKHRoaXMpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN1Ym1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHsgaG92ZXJEZWxlZ2F0ZTogb3B0aW9ucy5ob3ZlckRlbGVnYXRlIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjYWxjdWxhdGVBY3Rpb25zKGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGg6IG51bWJlcik6IHsgcHJpbWFyeUFjdGlvbnM6IElBY3Rpb25bXTsgc2Vjb25kYXJ5QWN0aW9uczogSUFjdGlvbltdIH0ge1xuXHRcdGNvbnN0IGluaXRpYWxQcmltYXJ5QWN0aW9ucyA9IHRoaXMuZWRpdG9yVG9vbGJhci5wcmltYXJ5QWN0aW9ucztcblx0XHRjb25zdCBpbml0aWFsU2Vjb25kYXJ5QWN0aW9ucyA9IHRoaXMuZWRpdG9yVG9vbGJhci5zZWNvbmRhcnlBY3Rpb25zO1xuXG5cdFx0Y29uc3QgYWN0aW9uT3V0cHV0ID0gd29ya2JlbmNoQ2FsY3VsYXRlQWN0aW9ucyhpbml0aWFsUHJpbWFyeUFjdGlvbnMsIGluaXRpYWxTZWNvbmRhcnlBY3Rpb25zLCBsZWZ0VG9vbGJhckNvbnRhaW5lck1heFdpZHRoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cHJpbWFyeUFjdGlvbnM6IGFjdGlvbk91dHB1dC5wcmltYXJ5QWN0aW9ucy5tYXAoYSA9PiBhLmFjdGlvbiksXG5cdFx0XHRzZWNvbmRhcnlBY3Rpb25zOiBhY3Rpb25PdXRwdXQuc2Vjb25kYXJ5QWN0aW9uc1xuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgV29ya2JlbmNoRHluYW1pY0xhYmVsU3RyYXRlZ3kgaW1wbGVtZW50cyBJQWN0aW9uTGF5b3V0U3RyYXRlZ3kge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yRGVsZWdhdGUsXG5cdFx0cmVhZG9ubHkgZWRpdG9yVG9vbGJhcjogTm90ZWJvb2tFZGl0b3JXb3JrYmVuY2hUb29sYmFyLFxuXHRcdHJlYWRvbmx5IGdvVG9NZW51OiBJTWVudSxcblx0XHRyZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKSB7IH1cblxuXHRhY3Rpb25Qcm92aWRlcihhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMpOiBJQWN0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGlmIChhY3Rpb24uaWQgPT09IFNFTEVDVF9LRVJORUxfSUQpIHtcblx0XHRcdC8vXHR0aGlzIGlzIGJlaW5nIGRpc3Bvc2VkIGJ5IHRoZSBjb25zdW1lclxuXHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb0tlcm5lbEFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHRoaXMubm90ZWJvb2tFZGl0b3IsIG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGEgPSB0aGlzLmVkaXRvclRvb2xiYXIucHJpbWFyeUFjdGlvbnMuZmluZChhID0+IGEuYWN0aW9uLmlkID09PSBhY3Rpb24uaWQpO1xuXHRcdGlmICghYSB8fCBhLnJlbmRlckxhYmVsKSB7XG5cdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQWN0aW9uVmlld1dpdGhMYWJlbCwgYWN0aW9uLCB7IGhvdmVyRGVsZWdhdGU6IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIFN1Ym1lbnVJdGVtQWN0aW9uICYmIGFjdGlvbi5pdGVtLnN1Ym1lbnUuaWQgPT09IE1lbnVJZC5Ob3RlYm9va0NlbGxFeGVjdXRlR29Uby5pZCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVbmlmaWVkU3VibWVudUFjdGlvblZpZXcsIGFjdGlvbiwgeyBob3ZlckRlbGVnYXRlOiBvcHRpb25zLmhvdmVyRGVsZWdhdGUgfSwgdHJ1ZSwge1xuXHRcdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmdvVG9NZW51LmdldEFjdGlvbnMoKS5maW5kKChbZ3JvdXBdKSA9PiBncm91cCA9PT0gJ25hdmlnYXRpb24vZXhlY3V0ZScpPy5bMV0gPz8gW107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCB0aGlzLmFjdGlvblByb3ZpZGVyLmJpbmQodGhpcykpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCB7IGhvdmVyRGVsZWdhdGU6IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIFN1Ym1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdGlmIChhY3Rpb24uaXRlbS5zdWJtZW51LmlkID09PSBNZW51SWQuTm90ZWJvb2tDZWxsRXhlY3V0ZUdvVG8uaWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVbmlmaWVkU3VibWVudUFjdGlvblZpZXcsIGFjdGlvbiwgeyBob3ZlckRlbGVnYXRlOiBvcHRpb25zLmhvdmVyRGVsZWdhdGUgfSwgZmFsc2UsIHtcblx0XHRcdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuZ29Ub01lbnUuZ2V0QWN0aW9ucygpLmZpbmQoKFtncm91cF0pID0+IGdyb3VwID09PSAnbmF2aWdhdGlvbi9leGVjdXRlJyk/LlsxXSA/PyBbXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LCB0aGlzLmFjdGlvblByb3ZpZGVyLmJpbmQodGhpcykpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN1Ym1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHsgaG92ZXJEZWxlZ2F0ZTogb3B0aW9ucy5ob3ZlckRlbGVnYXRlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0Y2FsY3VsYXRlQWN0aW9ucyhsZWZ0VG9vbGJhckNvbnRhaW5lck1heFdpZHRoOiBudW1iZXIpOiB7IHByaW1hcnlBY3Rpb25zOiBJQWN0aW9uW107IHNlY29uZGFyeUFjdGlvbnM6IElBY3Rpb25bXSB9IHtcblx0XHRjb25zdCBpbml0aWFsUHJpbWFyeUFjdGlvbnMgPSB0aGlzLmVkaXRvclRvb2xiYXIucHJpbWFyeUFjdGlvbnM7XG5cdFx0Y29uc3QgaW5pdGlhbFNlY29uZGFyeUFjdGlvbnMgPSB0aGlzLmVkaXRvclRvb2xiYXIuc2Vjb25kYXJ5QWN0aW9ucztcblxuXHRcdGNvbnN0IGFjdGlvbk91dHB1dCA9IHdvcmtiZW5jaER5bmFtaWNDYWxjdWxhdGVBY3Rpb25zKGluaXRpYWxQcmltYXJ5QWN0aW9ucywgaW5pdGlhbFNlY29uZGFyeUFjdGlvbnMsIGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGgpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRwcmltYXJ5QWN0aW9uczogYWN0aW9uT3V0cHV0LnByaW1hcnlBY3Rpb25zLm1hcChhID0+IGEuYWN0aW9uKSxcblx0XHRcdHNlY29uZGFyeUFjdGlvbnM6IGFjdGlvbk91dHB1dC5zZWNvbmRhcnlBY3Rpb25zXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tFZGl0b3JXb3JrYmVuY2hUb29sYmFyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX2xlZnRUb29sYmFyU2Nyb2xsYWJsZSE6IERvbVNjcm9sbGFibGVFbGVtZW50O1xuXHRwcml2YXRlIF9ub3RlYm9va1RvcExlZnRUb29sYmFyQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX25vdGVib29rVG9wUmlnaHRUb29sYmFyQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX25vdGVib29rR2xvYmFsQWN0aW9uc01lbnUhOiBJTWVudTtcblx0cHJpdmF0ZSBfZXhlY3V0ZUdvVG9BY3Rpb25zTWVudSE6IElNZW51O1xuXHRwcml2YXRlIF9ub3RlYm9va0xlZnRUb29sYmFyITogV29ya2JlbmNoVG9vbEJhcjtcblx0cHJpdmF0ZSBfcHJpbWFyeUFjdGlvbnM6IElBY3Rpb25Nb2RlbFtdO1xuXHRnZXQgcHJpbWFyeUFjdGlvbnMoKTogSUFjdGlvbk1vZGVsW10ge1xuXHRcdHJldHVybiB0aGlzLl9wcmltYXJ5QWN0aW9ucztcblx0fVxuXHRwcml2YXRlIF9zZWNvbmRhcnlBY3Rpb25zOiBJQWN0aW9uW107XG5cdGdldCBzZWNvbmRhcnlBY3Rpb25zKCk6IElBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NlY29uZGFyeUFjdGlvbnM7XG5cdH1cblx0cHJpdmF0ZSBfbm90ZWJvb2tSaWdodFRvb2xiYXIhOiBUb29sQmFyO1xuXHRwcml2YXRlIF91c2VHbG9iYWxUb29sYmFyOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3N0cmF0ZWd5ITogSUFjdGlvbkxheW91dFN0cmF0ZWd5O1xuXHRwcml2YXRlIF9yZW5kZXJMYWJlbDogUmVuZGVyTGFiZWwgPSBSZW5kZXJMYWJlbC5BbHdheXM7XG5cblx0cHJpdmF0ZSBfdmlzaWJsZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRzZXQgdmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuX3Zpc2libGUgIT09IHZpc2libGUpIHtcblx0XHRcdHRoaXMuX3Zpc2libGUgPSB2aXNpYmxlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmZpcmUodmlzaWJsZSk7XG5cdFx0fVxuXHR9XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVmlzaWJpbGl0eSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRvbkRpZENoYW5nZVZpc2liaWxpdHk6IEV2ZW50PGJvb2xlYW4+ID0gdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmV2ZW50O1xuXG5cdGdldCB1c2VHbG9iYWxUb29sYmFyKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl91c2VHbG9iYWxUb29sYmFyO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGltZW5zaW9uOiBET00uRGltZW5zaW9uIHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSBfZGVmZXJyZWRBY3Rpb25VcGRhdGU6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSxcblx0XHRyZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdHJlYWRvbmx5IG5vdGVib29rT3B0aW9uczogTm90ZWJvb2tPcHRpb25zLFxuXHRcdHJlYWRvbmx5IGRvbU5vZGU6IEhUTUxFbGVtZW50LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHBlcmltZW50U2VydmljZTogSVdvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcHJpbWFyeUFjdGlvbnMgPSBbXTtcblx0XHR0aGlzLl9zZWNvbmRhcnlBY3Rpb25zID0gW107XG5cdFx0dGhpcy5fYnVpbGRCb2R5KCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5kZWJvdW5jZTx2b2lkLCB2b2lkPihcblx0XHRcdHRoaXMuZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSxcblx0XHRcdChsYXN0LCBfY3VycmVudCkgPT4gbGFzdCxcblx0XHRcdDIwMFxuXHRcdCkodGhpcy5fdXBkYXRlUGVyRWRpdG9yQ2hhbmdlLCB0aGlzKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlck5vdGVib29rQWN0aW9uc1Rvb2xiYXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCBET00uRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgZSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoRE9NLmdldFdpbmRvdyh0aGlzLmRvbU5vZGUpLCBlKTtcblx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLk5vdGVib29rVG9vbGJhckNvbnRleHQsXG5cdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9idWlsZEJvZHkoKSB7XG5cdFx0dGhpcy5fbm90ZWJvb2tUb3BMZWZ0VG9vbGJhckNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX25vdGVib29rVG9wTGVmdFRvb2xiYXJDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbm90ZWJvb2stdG9vbGJhci1sZWZ0Jyk7XG5cdFx0dGhpcy5fbGVmdFRvb2xiYXJTY3JvbGxhYmxlID0gbmV3IERvbVNjcm9sbGFibGVFbGVtZW50KHRoaXMuX25vdGVib29rVG9wTGVmdFRvb2xiYXJDb250YWluZXIsIHtcblx0XHRcdHZlcnRpY2FsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkhpZGRlbixcblx0XHRcdGhvcml6b250YWw6IFNjcm9sbGJhclZpc2liaWxpdHkuVmlzaWJsZSxcblx0XHRcdGhvcml6b250YWxTY3JvbGxiYXJTaXplOiAzLFxuXHRcdFx0dXNlU2hhZG93czogZmFsc2UsXG5cdFx0XHRzY3JvbGxZVG9YOiB0cnVlXG5cdFx0fSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGVmdFRvb2xiYXJTY3JvbGxhYmxlKTtcblxuXHRcdERPTS5hcHBlbmQodGhpcy5kb21Ob2RlLCB0aGlzLl9sZWZ0VG9vbGJhclNjcm9sbGFibGUuZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLl9ub3RlYm9va1RvcFJpZ2h0VG9vbGJhckNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX25vdGVib29rVG9wUmlnaHRUb29sYmFyQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ25vdGVib29rLXRvb2xiYXItcmlnaHQnKTtcblx0XHRET00uYXBwZW5kKHRoaXMuZG9tTm9kZSwgdGhpcy5fbm90ZWJvb2tUb3BSaWdodFRvb2xiYXJDb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlUGVyRWRpdG9yQ2hhbmdlKCkge1xuXHRcdGlmICh0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZT8uZ2V0SWQoKSA9PT0gTk9URUJPT0tfRURJVE9SX0lEKSB7XG5cdFx0XHRjb25zdCBub3RlYm9va0VkaXRvciA9IHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lLmdldENvbnRyb2woKSBhcyBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZTtcblx0XHRcdGlmIChub3RlYm9va0VkaXRvciA9PT0gdGhpcy5ub3RlYm9va0VkaXRvcikge1xuXHRcdFx0XHQvLyB0aGlzIGlzIHRoZSBhY3RpdmUgZWRpdG9yXG5cdFx0XHRcdHRoaXMuX3Nob3dOb3RlYm9va0FjdGlvbnNpbkVkaXRvclRvb2xiYXIoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyTm90ZWJvb2tBY3Rpb25zVG9vbGJhcigpIHtcblx0XHR0aGlzLl9ub3RlYm9va0dsb2JhbEFjdGlvbnNNZW51ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KHRoaXMubm90ZWJvb2tFZGl0b3IuY3JlYXRpb25PcHRpb25zLm1lbnVJZHMubm90ZWJvb2tUb29sYmFyLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fZXhlY3V0ZUdvVG9BY3Rpb25zTWVudSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMubWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuTm90ZWJvb2tDZWxsRXhlY3V0ZUdvVG8sIHRoaXMuY29udGV4dEtleVNlcnZpY2UpKTtcblxuXHRcdHRoaXMuX3VzZUdsb2JhbFRvb2xiYXIgPSB0aGlzLm5vdGVib29rT3B0aW9ucy5nZXREaXNwbGF5T3B0aW9ucygpLmdsb2JhbFRvb2xiYXI7XG5cdFx0dGhpcy5fcmVuZGVyTGFiZWwgPSB0aGlzLl9jb252ZXJ0Q29uZmlndXJhdGlvbih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKE5vdGVib29rU2V0dGluZy5nbG9iYWxUb29sYmFyU2hvd0xhYmVsKSk7XG5cdFx0dGhpcy5fdXBkYXRlU3RyYXRlZ3koKTtcblxuXHRcdGNvbnN0IGNvbnRleHQgPSB7XG5cdFx0XHR1aTogdHJ1ZSxcblx0XHRcdG5vdGVib29rRWRpdG9yOiB0aGlzLm5vdGVib29rRWRpdG9yLFxuXHRcdFx0c291cmNlOiAnbm90ZWJvb2tUb29sYmFyJ1xuXHRcdH07XG5cblx0XHRjb25zdCBhY3Rpb25Qcm92aWRlciA9IChhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMpID0+IHtcblx0XHRcdGlmIChhY3Rpb24uaWQgPT09IFNFTEVDVF9LRVJORUxfSUQpIHtcblx0XHRcdFx0Ly8gdGhpcyBpcyBiZWluZyBkaXNwb3NlZCBieSB0aGUgY29uc3VtZXJcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb0tlcm5lbEFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIHRoaXMubm90ZWJvb2tFZGl0b3IsIG9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fcmVuZGVyTGFiZWwgIT09IFJlbmRlckxhYmVsLk5ldmVyKSB7XG5cdFx0XHRcdGNvbnN0IGEgPSB0aGlzLl9wcmltYXJ5QWN0aW9ucy5maW5kKGEgPT4gYS5hY3Rpb24uaWQgPT09IGFjdGlvbi5pZCk7XG5cdFx0XHRcdGlmIChhICYmIGEucmVuZGVyTGFiZWwpIHtcblx0XHRcdFx0XHRyZXR1cm4gYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24gPyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEFjdGlvblZpZXdXaXRoTGFiZWwsIGFjdGlvbiwgeyBob3ZlckRlbGVnYXRlOiBvcHRpb25zLmhvdmVyRGVsZWdhdGUgfSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uID8gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCB7IGhvdmVyRGVsZWdhdGU6IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9KSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uID8gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCB7IGhvdmVyRGVsZWdhdGU6IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9KSA6IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gTWFrZSBzdXJlIGJvdGggdG9vbGJhcnMgaGF2ZSB0aGUgc2FtZSBob3ZlciBkZWxlZ2F0ZSBmb3IgaW5zdGFudCBob3ZlciB0byB3b3JrXG5cdFx0Ly8gRHVlIHRvIHRoZSBlbGVtZW50cyBiZWluZyBmdXJ0aGVyIGFwYXJ0IHRoYW4gbm9ybWFsIHRvb2xiYXJzLCB0aGUgZGVmYXVsdCB0aW1lIGxpbWl0IGlzIHRvIHNob3J0IGFuZCBoYXMgdG8gYmUgaW5jcmVhc2VkXG5cdFx0Y29uc3QgaG92ZXJEZWxlZ2F0ZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoSG92ZXJEZWxlZ2F0ZSwgJ2VsZW1lbnQnLCB7IGluc3RhbnRIb3ZlcjogdHJ1ZSB9LCB7fSkpO1xuXHRcdGhvdmVyRGVsZWdhdGUuc2V0SW5zdGFudEhvdmVyVGltZUxpbWl0KDYwMCk7XG5cblx0XHRjb25zdCBsZWZ0VG9vbGJhck9wdGlvbnM6IElXb3JrYmVuY2hUb29sQmFyT3B0aW9ucyA9IHtcblx0XHRcdGhpZGRlbkl0ZW1TdHJhdGVneTogSGlkZGVuSXRlbVN0cmF0ZWd5LlJlbmRlckluU2Vjb25kYXJ5R3JvdXAsXG5cdFx0XHRyZXNldE1lbnU6IE1lbnVJZC5Ob3RlYm9va1Rvb2xiYXIsXG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9zdHJhdGVneS5hY3Rpb25Qcm92aWRlcihhY3Rpb24sIG9wdGlvbnMpO1xuXHRcdFx0fSxcblx0XHRcdGdldEtleUJpbmRpbmc6IGFjdGlvbiA9PiB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKSxcblx0XHRcdHJlbmRlckRyb3Bkb3duQXNDaGlsZEVsZW1lbnQ6IHRydWUsXG5cdFx0XHRob3ZlckRlbGVnYXRlXG5cdFx0fTtcblxuXHRcdHRoaXMuX25vdGVib29rTGVmdFRvb2xiYXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0V29ya2JlbmNoVG9vbEJhcixcblx0XHRcdHRoaXMuX25vdGVib29rVG9wTGVmdFRvb2xiYXJDb250YWluZXIsXG5cdFx0XHRsZWZ0VG9vbGJhck9wdGlvbnNcblx0XHQpO1xuXG5cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX25vdGVib29rTGVmdFRvb2xiYXIpO1xuXHRcdHRoaXMuX25vdGVib29rTGVmdFRvb2xiYXIuY29udGV4dCA9IGNvbnRleHQ7XG5cblx0XHR0aGlzLl9ub3RlYm9va1JpZ2h0VG9vbGJhciA9IG5ldyBUb29sQmFyKHRoaXMuX25vdGVib29rVG9wUmlnaHRUb29sYmFyQ29udGFpbmVyLCB0aGlzLmNvbnRleHRNZW51U2VydmljZSwge1xuXHRcdFx0Z2V0S2V5QmluZGluZzogYWN0aW9uID0+IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uaWQpLFxuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogYWN0aW9uUHJvdmlkZXIsXG5cdFx0XHRyZW5kZXJEcm9wZG93bkFzQ2hpbGRFbGVtZW50OiB0cnVlLFxuXHRcdFx0aG92ZXJEZWxlZ2F0ZVxuXHRcdH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX25vdGVib29rUmlnaHRUb29sYmFyKTtcblx0XHR0aGlzLl9ub3RlYm9va1JpZ2h0VG9vbGJhci5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdHRoaXMuX3Nob3dOb3RlYm9va0FjdGlvbnNpbkVkaXRvclRvb2xiYXIoKTtcblx0XHRsZXQgZHJvcGRvd25Jc1Zpc2libGUgPSBmYWxzZTtcblx0XHRsZXQgZGVmZXJyZWRVcGRhdGU6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX25vdGVib29rR2xvYmFsQWN0aW9uc01lbnUub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0aWYgKGRyb3Bkb3duSXNWaXNpYmxlKSB7XG5cdFx0XHRcdGRlZmVycmVkVXBkYXRlID0gKCkgPT4gdGhpcy5fc2hvd05vdGVib29rQWN0aW9uc2luRWRpdG9yVG9vbGJhcigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLm5vdGVib29rRWRpdG9yLmlzVmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLl9zaG93Tm90ZWJvb2tBY3Rpb25zaW5FZGl0b3JUb29sYmFyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbm90ZWJvb2tMZWZ0VG9vbGJhci5vbkRpZENoYW5nZURyb3Bkb3duVmlzaWJpbGl0eSh2aXNpYmxlID0+IHtcblx0XHRcdGRyb3Bkb3duSXNWaXNpYmxlID0gdmlzaWJsZTtcblxuXHRcdFx0aWYgKGRlZmVycmVkVXBkYXRlICYmICF2aXNpYmxlKSB7XG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdGRlZmVycmVkVXBkYXRlPy4oKTtcblx0XHRcdFx0fSwgMCk7XG5cdFx0XHRcdGRlZmVycmVkVXBkYXRlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubm90ZWJvb2tPcHRpb25zLm9uRGlkQ2hhbmdlT3B0aW9ucyhlID0+IHtcblx0XHRcdGlmIChlLmdsb2JhbFRvb2xiYXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLl91c2VHbG9iYWxUb29sYmFyID0gdGhpcy5ub3RlYm9va09wdGlvbnMuZ2V0RGlzcGxheU9wdGlvbnMoKS5nbG9iYWxUb29sYmFyO1xuXHRcdFx0XHR0aGlzLl9zaG93Tm90ZWJvb2tBY3Rpb25zaW5FZGl0b3JUb29sYmFyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuZ2xvYmFsVG9vbGJhclNob3dMYWJlbCkpIHtcblx0XHRcdFx0dGhpcy5fcmVuZGVyTGFiZWwgPSB0aGlzLl9jb252ZXJ0Q29uZmlndXJhdGlvbih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPFJlbmRlckxhYmVsV2l0aEZhbGxiYWNrPihOb3RlYm9va1NldHRpbmcuZ2xvYmFsVG9vbGJhclNob3dMYWJlbCkpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVTdHJhdGVneSgpO1xuXHRcdFx0XHRjb25zdCBvbGRFbGVtZW50ID0gdGhpcy5fbm90ZWJvb2tMZWZ0VG9vbGJhci5nZXRFbGVtZW50KCk7XG5cdFx0XHRcdG9sZEVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMuX25vdGVib29rTGVmdFRvb2xiYXIuZGlzcG9zZSgpO1xuXG5cdFx0XHRcdHRoaXMuX25vdGVib29rTGVmdFRvb2xiYXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRcdFdvcmtiZW5jaFRvb2xCYXIsXG5cdFx0XHRcdFx0dGhpcy5fbm90ZWJvb2tUb3BMZWZ0VG9vbGJhckNvbnRhaW5lcixcblx0XHRcdFx0XHRsZWZ0VG9vbGJhck9wdGlvbnNcblx0XHRcdFx0KTtcblxuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9ub3RlYm9va0xlZnRUb29sYmFyKTtcblx0XHRcdFx0dGhpcy5fbm90ZWJvb2tMZWZ0VG9vbGJhci5jb250ZXh0ID0gY29udGV4dDtcblx0XHRcdFx0dGhpcy5fc2hvd05vdGVib29rQWN0aW9uc2luRWRpdG9yVG9vbGJhcigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKHRoaXMuZXhwZXJpbWVudFNlcnZpY2UpIHtcblx0XHRcdHRoaXMuZXhwZXJpbWVudFNlcnZpY2UuZ2V0VHJlYXRtZW50PGJvb2xlYW4+KCduYnRvb2xiYXJpbmVkaXRvcicpLnRoZW4odHJlYXRtZW50ID0+IHtcblx0XHRcdFx0aWYgKHRyZWF0bWVudCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0aGlzLl91c2VHbG9iYWxUb29sYmFyICE9PSB0cmVhdG1lbnQpIHtcblx0XHRcdFx0XHR0aGlzLl91c2VHbG9iYWxUb29sYmFyID0gdHJlYXRtZW50O1xuXHRcdFx0XHRcdHRoaXMuX3Nob3dOb3RlYm9va0FjdGlvbnNpbkVkaXRvclRvb2xiYXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlU3RyYXRlZ3koKSB7XG5cdFx0c3dpdGNoICh0aGlzLl9yZW5kZXJMYWJlbCkge1xuXHRcdFx0Y2FzZSBSZW5kZXJMYWJlbC5BbHdheXM6XG5cdFx0XHRcdHRoaXMuX3N0cmF0ZWd5ID0gbmV3IFdvcmtiZW5jaEFsd2F5c0xhYmVsU3RyYXRlZ3kodGhpcy5ub3RlYm9va0VkaXRvciwgdGhpcywgdGhpcy5fZXhlY3V0ZUdvVG9BY3Rpb25zTWVudSwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSZW5kZXJMYWJlbC5OZXZlcjpcblx0XHRcdFx0dGhpcy5fc3RyYXRlZ3kgPSBuZXcgV29ya2JlbmNoTmV2ZXJMYWJlbFN0cmF0ZWd5KHRoaXMubm90ZWJvb2tFZGl0b3IsIHRoaXMsIHRoaXMuX2V4ZWN1dGVHb1RvQWN0aW9uc01lbnUsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUmVuZGVyTGFiZWwuRHluYW1pYzpcblx0XHRcdFx0dGhpcy5fc3RyYXRlZ3kgPSBuZXcgV29ya2JlbmNoRHluYW1pY0xhYmVsU3RyYXRlZ3kodGhpcy5ub3RlYm9va0VkaXRvciwgdGhpcywgdGhpcy5fZXhlY3V0ZUdvVG9BY3Rpb25zTWVudSwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NvbnZlcnRDb25maWd1cmF0aW9uKHZhbHVlOiBSZW5kZXJMYWJlbFdpdGhGYWxsYmFjayk6IFJlbmRlckxhYmVsIHtcblx0XHRzd2l0Y2ggKHZhbHVlKSB7XG5cdFx0XHRjYXNlIHRydWU6XG5cdFx0XHRcdHJldHVybiBSZW5kZXJMYWJlbC5BbHdheXM7XG5cdFx0XHRjYXNlIGZhbHNlOlxuXHRcdFx0XHRyZXR1cm4gUmVuZGVyTGFiZWwuTmV2ZXI7XG5cdFx0XHRjYXNlICdhbHdheXMnOlxuXHRcdFx0XHRyZXR1cm4gUmVuZGVyTGFiZWwuQWx3YXlzO1xuXHRcdFx0Y2FzZSAnbmV2ZXInOlxuXHRcdFx0XHRyZXR1cm4gUmVuZGVyTGFiZWwuTmV2ZXI7XG5cdFx0XHRjYXNlICdkeW5hbWljJzpcblx0XHRcdFx0cmV0dXJuIFJlbmRlckxhYmVsLkR5bmFtaWM7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd05vdGVib29rQWN0aW9uc2luRWRpdG9yVG9vbGJhcigpIHtcblx0XHQvLyB3aGVuIHRoZXJlIGlzIG5vIHZpZXcgbW9kZWwsIGp1c3QgaWdub3JlLlxuXHRcdGlmICghdGhpcy5ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHR0aGlzLl9kZWZlcnJlZEFjdGlvblVwZGF0ZT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fZGVmZXJyZWRBY3Rpb25VcGRhdGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLnZpc2libGUgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZGVmZXJyZWRBY3Rpb25VcGRhdGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX3VzZUdsb2JhbFRvb2xiYXIpIHtcblx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0dGhpcy5fZGVmZXJyZWRBY3Rpb25VcGRhdGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLnZpc2libGUgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZGVmZXJyZWRBY3Rpb25VcGRhdGUgPSBkaXNwb3NhYmxlVGltZW91dChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3NldE5vdGVib29rQWN0aW9ucygpO1xuXHRcdFx0XHR0aGlzLnZpc2libGUgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9kZWZlcnJlZEFjdGlvblVwZGF0ZT8uZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9kZWZlcnJlZEFjdGlvblVwZGF0ZSA9IHVuZGVmaW5lZDtcblx0XHRcdH0sIDUwKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9zZXROb3RlYm9va0FjdGlvbnMoKSB7XG5cdFx0Y29uc3QgZ3JvdXBzID0gdGhpcy5fbm90ZWJvb2tHbG9iYWxBY3Rpb25zTWVudS5nZXRBY3Rpb25zKHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUsIHJlbmRlclNob3J0VGl0bGU6IHRydWUgfSk7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0Y29uc3QgcHJpbWFyeUxlZnRHcm91cHMgPSBncm91cHMuZmlsdGVyKGdyb3VwID0+IC9ebmF2aWdhdGlvbi8udGVzdChncm91cFswXSkpO1xuXHRcdGNvbnN0IHByaW1hcnlBY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRwcmltYXJ5TGVmdEdyb3Vwcy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoYVswXSA9PT0gJ25hdmlnYXRpb24nKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYlswXSA9PT0gJ25hdmlnYXRpb24nKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSkuZm9yRWFjaCgoZ3JvdXAsIGluZGV4KSA9PiB7XG5cdFx0XHRwcmltYXJ5QWN0aW9ucy5wdXNoKC4uLmdyb3VwWzFdKTtcblx0XHRcdGlmIChpbmRleCA8IHByaW1hcnlMZWZ0R3JvdXBzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0cHJpbWFyeUFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IHByaW1hcnlSaWdodEdyb3VwID0gZ3JvdXBzLmZpbmQoZ3JvdXAgPT4gL15zdGF0dXMvLnRlc3QoZ3JvdXBbMF0pKTtcblx0XHRjb25zdCBwcmltYXJ5UmlnaHRBY3Rpb25zID0gcHJpbWFyeVJpZ2h0R3JvdXAgPyBwcmltYXJ5UmlnaHRHcm91cFsxXSA6IFtdO1xuXHRcdGNvbnN0IHNlY29uZGFyeUFjdGlvbnMgPSBncm91cHMuZmlsdGVyKGdyb3VwID0+ICEvXm5hdmlnYXRpb24vLnRlc3QoZ3JvdXBbMF0pICYmICEvXnN0YXR1cy8udGVzdChncm91cFswXSkpLnJlZHVjZSgocHJldjogKE1lbnVJdGVtQWN0aW9uIHwgU3VibWVudUl0ZW1BY3Rpb24pW10sIGN1cnIpID0+IHsgcHJldi5wdXNoKC4uLmN1cnJbMV0pOyByZXR1cm4gcHJldjsgfSwgW10pO1xuXG5cdFx0dGhpcy5fbm90ZWJvb2tMZWZ0VG9vbGJhci5zZXRBY3Rpb25zKFtdLCBbXSk7XG5cblx0XHR0aGlzLl9wcmltYXJ5QWN0aW9ucyA9IHByaW1hcnlBY3Rpb25zLm1hcChhY3Rpb24gPT4gKHtcblx0XHRcdGFjdGlvbjogYWN0aW9uLFxuXHRcdFx0c2l6ZTogKGFjdGlvbiBpbnN0YW5jZW9mIFNlcGFyYXRvciA/IDEgOiAwKSxcblx0XHRcdHJlbmRlckxhYmVsOiB0cnVlLFxuXHRcdFx0dmlzaWJsZTogdHJ1ZVxuXHRcdH0pKTtcblx0XHR0aGlzLl9ub3RlYm9va0xlZnRUb29sYmFyLnNldEFjdGlvbnMocHJpbWFyeUFjdGlvbnMsIHNlY29uZGFyeUFjdGlvbnMpO1xuXHRcdHRoaXMuX3NlY29uZGFyeUFjdGlvbnMgPSBzZWNvbmRhcnlBY3Rpb25zO1xuXG5cdFx0dGhpcy5fbm90ZWJvb2tSaWdodFRvb2xiYXIuc2V0QWN0aW9ucyhwcmltYXJ5UmlnaHRBY3Rpb25zLCBbXSk7XG5cdFx0dGhpcy5fc2Vjb25kYXJ5QWN0aW9ucyA9IHNlY29uZGFyeUFjdGlvbnM7XG5cblxuXHRcdGlmICh0aGlzLl9kaW1lbnNpb24gJiYgdGhpcy5fZGltZW5zaW9uLndpZHRoID49IDAgJiYgdGhpcy5fZGltZW5zaW9uLmhlaWdodCA+PSAwKSB7XG5cdFx0XHR0aGlzLl9jYWNoZUl0ZW1TaXplcyh0aGlzLl9ub3RlYm9va0xlZnRUb29sYmFyKTtcblx0XHR9XG5cblx0XHR0aGlzLl9jb21wdXRlU2l6ZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgX2NhY2hlSXRlbVNpemVzKHRvb2xiYXI6IFdvcmtiZW5jaFRvb2xCYXIpIHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRvb2xiYXIuZ2V0SXRlbXNMZW5ndGgoKTsgaSsrKSB7XG5cdFx0XHRjb25zdCBhY3Rpb24gPSB0b29sYmFyLmdldEl0ZW1BY3Rpb24oaSk7XG5cdFx0XHRpZiAoYWN0aW9uICYmIGFjdGlvbi5pZCAhPT0gJ3Rvb2xiYXIudG9nZ2xlLm1vcmUnKSB7XG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5fcHJpbWFyeUFjdGlvbnMuZmluZChhID0+IGEuYWN0aW9uLmlkID09PSBhY3Rpb24uaWQpO1xuXHRcdFx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdFx0XHRleGlzdGluZy5zaXplID0gdG9vbGJhci5nZXRJdGVtV2lkdGgoaSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jb21wdXRlU2l6ZXMoKSB7XG5cdFx0Y29uc3QgdG9vbGJhciA9IHRoaXMuX25vdGVib29rTGVmdFRvb2xiYXI7XG5cdFx0Y29uc3QgcmlnaHRUb29sYmFyID0gdGhpcy5fbm90ZWJvb2tSaWdodFRvb2xiYXI7XG5cdFx0aWYgKHRvb2xiYXIgJiYgcmlnaHRUb29sYmFyICYmIHRoaXMuX2RpbWVuc2lvbiAmJiB0aGlzLl9kaW1lbnNpb24uaGVpZ2h0ID49IDAgJiYgdGhpcy5fZGltZW5zaW9uLndpZHRoID49IDApIHtcblx0XHRcdC8vIGNvbXB1dGUgc2l6ZSBvbmx5IGlmIGl0J3MgdmlzaWJsZVxuXHRcdFx0aWYgKHRoaXMuX3ByaW1hcnlBY3Rpb25zLmxlbmd0aCA9PT0gMCAmJiB0b29sYmFyLmdldEl0ZW1zTGVuZ3RoKCkgIT09IHRoaXMuX3ByaW1hcnlBY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLl9jYWNoZUl0ZW1TaXplcyh0aGlzLl9ub3RlYm9va0xlZnRUb29sYmFyKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX3ByaW1hcnlBY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGtlcm5lbFdpZHRoID0gKHJpZ2h0VG9vbGJhci5nZXRJdGVtc0xlbmd0aCgpID8gcmlnaHRUb29sYmFyLmdldEl0ZW1XaWR0aCgwKSA6IDApICsgQUNUSU9OX1BBRERJTkc7XG5cdFx0XHRjb25zdCBsZWZ0VG9vbGJhckNvbnRhaW5lck1heFdpZHRoID0gdGhpcy5fZGltZW5zaW9uLndpZHRoIC0ga2VybmVsV2lkdGggLSAoQUNUSU9OX1BBRERJTkcgKyBUT0dHTEVfTU9SRV9BQ1RJT05fV0lEVEgpIC0gKC8qKiB0b29sYmFyIGxlZnQgbWFyZ2luICovQUNUSU9OX1BBRERJTkcpIC0gKC8qKiB0b29sYmFyIHJpZ2h0IG1hcmdpbiAqL0FDVElPTl9QQURESU5HKTtcblx0XHRcdGNvbnN0IGNhbGN1bGF0ZWRBY3Rpb25zID0gdGhpcy5fc3RyYXRlZ3kuY2FsY3VsYXRlQWN0aW9ucyhsZWZ0VG9vbGJhckNvbnRhaW5lck1heFdpZHRoKTtcblx0XHRcdHRoaXMuX25vdGVib29rTGVmdFRvb2xiYXIuc2V0QWN0aW9ucyhjYWxjdWxhdGVkQWN0aW9ucy5wcmltYXJ5QWN0aW9ucywgY2FsY3VsYXRlZEFjdGlvbnMuc2Vjb25kYXJ5QWN0aW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0bGF5b3V0KGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbikge1xuXHRcdHRoaXMuX2RpbWVuc2lvbiA9IGRpbWVuc2lvbjtcblxuXHRcdGlmICghdGhpcy5fdXNlR2xvYmFsVG9vbGJhcikge1xuXHRcdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdH1cblx0XHR0aGlzLl9jb21wdXRlU2l6ZXMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5fbm90ZWJvb2tMZWZ0VG9vbGJhci5jb250ZXh0ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX25vdGVib29rUmlnaHRUb29sYmFyLmNvbnRleHQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fbm90ZWJvb2tMZWZ0VG9vbGJhci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fbm90ZWJvb2tSaWdodFRvb2xiYXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX25vdGVib29rTGVmdFRvb2xiYXIgPSBudWxsITtcblx0XHR0aGlzLl9ub3RlYm9va1JpZ2h0VG9vbGJhciA9IG51bGwhO1xuXHRcdHRoaXMuX2RlZmVycmVkQWN0aW9uVXBkYXRlPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGVmZXJyZWRBY3Rpb25VcGRhdGUgPSB1bmRlZmluZWQ7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdvcmtiZW5jaENhbGN1bGF0ZUFjdGlvbnMoaW5pdGlhbFByaW1hcnlBY3Rpb25zOiBJQWN0aW9uTW9kZWxbXSwgaW5pdGlhbFNlY29uZGFyeUFjdGlvbnM6IElBY3Rpb25bXSwgbGVmdFRvb2xiYXJDb250YWluZXJNYXhXaWR0aDogbnVtYmVyKTogeyBwcmltYXJ5QWN0aW9uczogSUFjdGlvbk1vZGVsW107IHNlY29uZGFyeUFjdGlvbnM6IElBY3Rpb25bXSB9IHtcblx0cmV0dXJuIGFjdGlvbk92ZXJmbG93SGVscGVyKGluaXRpYWxQcmltYXJ5QWN0aW9ucywgaW5pdGlhbFNlY29uZGFyeUFjdGlvbnMsIGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGgsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdvcmtiZW5jaER5bmFtaWNDYWxjdWxhdGVBY3Rpb25zKGluaXRpYWxQcmltYXJ5QWN0aW9uczogSUFjdGlvbk1vZGVsW10sIGluaXRpYWxTZWNvbmRhcnlBY3Rpb25zOiBJQWN0aW9uW10sIGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGg6IG51bWJlcik6IHsgcHJpbWFyeUFjdGlvbnM6IElBY3Rpb25Nb2RlbFtdOyBzZWNvbmRhcnlBY3Rpb25zOiBJQWN0aW9uW10gfSB7XG5cblx0aWYgKGluaXRpYWxQcmltYXJ5QWN0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4geyBwcmltYXJ5QWN0aW9uczogW10sIHNlY29uZGFyeUFjdGlvbnM6IGluaXRpYWxTZWNvbmRhcnlBY3Rpb25zIH07XG5cdH1cblxuXHQvLyBmaW5kIHRydWUgbGVuZ3RoIG9mIGFycmF5LCBhZGQgMSBmb3IgZWFjaCBwcmltYXJ5IGFjdGlvbnMsIGlnbm9yaW5nIGFuIGl0ZW0gd2hlbiBzaXplID0gMFxuXHRjb25zdCB2aXNpYmxlQWN0aW9uTGVuZ3RoID0gaW5pdGlhbFByaW1hcnlBY3Rpb25zLmZpbHRlcihhY3Rpb24gPT4gYWN0aW9uLnNpemUgIT09IDApLmxlbmd0aDtcblxuXHQvLyBzdGVwIDE6IHRyeSB0byBmaXQgYWxsIHByaW1hcnkgYWN0aW9uc1xuXHRjb25zdCB0b3RhbFdpZHRoV2l0aExhYmVscyA9IGluaXRpYWxQcmltYXJ5QWN0aW9ucy5tYXAoYWN0aW9uID0+IGFjdGlvbi5zaXplKS5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSArICh2aXNpYmxlQWN0aW9uTGVuZ3RoIC0gMSkgKiBBQ1RJT05fUEFERElORztcblx0aWYgKHRvdGFsV2lkdGhXaXRoTGFiZWxzIDw9IGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGgpIHtcblx0XHRpbml0aWFsUHJpbWFyeUFjdGlvbnMuZm9yRWFjaChhY3Rpb24gPT4ge1xuXHRcdFx0YWN0aW9uLnJlbmRlckxhYmVsID0gdHJ1ZTtcblx0XHR9KTtcblx0XHRyZXR1cm4gYWN0aW9uT3ZlcmZsb3dIZWxwZXIoaW5pdGlhbFByaW1hcnlBY3Rpb25zLCBpbml0aWFsU2Vjb25kYXJ5QWN0aW9ucywgbGVmdFRvb2xiYXJDb250YWluZXJNYXhXaWR0aCwgZmFsc2UpO1xuXHR9XG5cblx0Ly8gc3RlcCAyOiBjaGVjayBpZiB0aGV5IGZpdCB3aXRob3V0IGxhYmVsc1xuXHRpZiAoKHZpc2libGVBY3Rpb25MZW5ndGggKiBJQ09OX09OTFlfQUNUSU9OX1dJRFRIICsgKHZpc2libGVBY3Rpb25MZW5ndGggLSAxKSAqIEFDVElPTl9QQURESU5HKSA+IGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGgpIHtcblx0XHRpbml0aWFsUHJpbWFyeUFjdGlvbnMuZm9yRWFjaChhY3Rpb24gPT4geyBhY3Rpb24ucmVuZGVyTGFiZWwgPSBmYWxzZTsgfSk7XG5cdFx0cmV0dXJuIGFjdGlvbk92ZXJmbG93SGVscGVyKGluaXRpYWxQcmltYXJ5QWN0aW9ucywgaW5pdGlhbFNlY29uZGFyeUFjdGlvbnMsIGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGgsIHRydWUpO1xuXHR9XG5cblx0Ly8gc3RlcCAzOiByZW5kZXIgYXMgbWFueSBhY3Rpb25zIGFzIHBvc3NpYmxlIHdpdGggbGFiZWxzLCByZXN0IHdpdGhvdXQuXG5cdGxldCBzdW0gPSAwO1xuXHRsZXQgbGFzdEFjdGlvbldpdGhMYWJlbCA9IC0xO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGluaXRpYWxQcmltYXJ5QWN0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdHN1bSArPSBpbml0aWFsUHJpbWFyeUFjdGlvbnNbaV0uc2l6ZSArIEFDVElPTl9QQURESU5HO1xuXG5cdFx0aWYgKGluaXRpYWxQcmltYXJ5QWN0aW9uc1tpXS5hY3Rpb24gaW5zdGFuY2VvZiBTZXBhcmF0b3IpIHtcblx0XHRcdC8vIGZpbmQgZ3JvdXAgc2VwYXJhdG9yXG5cdFx0XHRjb25zdCByZW1haW5pbmdJdGVtcyA9IGluaXRpYWxQcmltYXJ5QWN0aW9ucy5zbGljZShpICsgMSkuZmlsdGVyKGFjdGlvbiA9PiBhY3Rpb24uc2l6ZSAhPT0gMCk7IC8vIHRvZG86IG5lZWQgdG8gZXhjbHVkZSBzaXplIDAgaXRlbXMgZnJvbSB0aGlzXG5cdFx0XHRjb25zdCBuZXdUb3RhbFN1bSA9IHN1bSArIChyZW1haW5pbmdJdGVtcy5sZW5ndGggPT09IDAgPyAwIDogKHJlbWFpbmluZ0l0ZW1zLmxlbmd0aCAqIElDT05fT05MWV9BQ1RJT05fV0lEVEggKyAocmVtYWluaW5nSXRlbXMubGVuZ3RoIC0gMSkgKiBBQ1RJT05fUEFERElORykpO1xuXHRcdFx0aWYgKG5ld1RvdGFsU3VtIDw9IGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGgpIHtcblx0XHRcdFx0bGFzdEFjdGlvbldpdGhMYWJlbCA9IGk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblx0fVxuXG5cdC8vIGljb25zIG9ubHkgZG9uJ3QgZml0IGVpdGhlclxuXHRpZiAobGFzdEFjdGlvbldpdGhMYWJlbCA8IDApIHtcblx0XHRpbml0aWFsUHJpbWFyeUFjdGlvbnMuZm9yRWFjaChhY3Rpb24gPT4geyBhY3Rpb24ucmVuZGVyTGFiZWwgPSBmYWxzZTsgfSk7XG5cdFx0cmV0dXJuIGFjdGlvbk92ZXJmbG93SGVscGVyKGluaXRpYWxQcmltYXJ5QWN0aW9ucywgaW5pdGlhbFNlY29uZGFyeUFjdGlvbnMsIGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGgsIHRydWUpO1xuXHR9XG5cblx0Ly8gcmVuZGVyIGxhYmVscyBmb3IgdGhlIGFjdGlvbnMgdGhhdCBoYXZlIHNwYWNlXG5cdGluaXRpYWxQcmltYXJ5QWN0aW9ucy5zbGljZSgwLCBsYXN0QWN0aW9uV2l0aExhYmVsICsgMSkuZm9yRWFjaChhY3Rpb24gPT4geyBhY3Rpb24ucmVuZGVyTGFiZWwgPSB0cnVlOyB9KTtcblx0aW5pdGlhbFByaW1hcnlBY3Rpb25zLnNsaWNlKGxhc3RBY3Rpb25XaXRoTGFiZWwgKyAxKS5mb3JFYWNoKGFjdGlvbiA9PiB7IGFjdGlvbi5yZW5kZXJMYWJlbCA9IGZhbHNlOyB9KTtcblx0cmV0dXJuIHtcblx0XHRwcmltYXJ5QWN0aW9uczogaW5pdGlhbFByaW1hcnlBY3Rpb25zLFxuXHRcdHNlY29uZGFyeUFjdGlvbnM6IGluaXRpYWxTZWNvbmRhcnlBY3Rpb25zXG5cdH07XG59XG5cbmZ1bmN0aW9uIGFjdGlvbk92ZXJmbG93SGVscGVyKGluaXRpYWxQcmltYXJ5QWN0aW9uczogSUFjdGlvbk1vZGVsW10sIGluaXRpYWxTZWNvbmRhcnlBY3Rpb25zOiBJQWN0aW9uW10sIGxlZnRUb29sYmFyQ29udGFpbmVyTWF4V2lkdGg6IG51bWJlciwgaWNvbk9ubHk6IGJvb2xlYW4pOiB7IHByaW1hcnlBY3Rpb25zOiBJQWN0aW9uTW9kZWxbXTsgc2Vjb25kYXJ5QWN0aW9uczogSUFjdGlvbltdIH0ge1xuXHRjb25zdCByZW5kZXJBY3Rpb25zOiBJQWN0aW9uTW9kZWxbXSA9IFtdO1xuXHRjb25zdCBvdmVyZmxvdzogSUFjdGlvbltdID0gW107XG5cblx0bGV0IGN1cnJlbnRTaXplID0gMDtcblx0bGV0IG5vblplcm9BY3Rpb24gPSBmYWxzZTtcblx0bGV0IGNvbnRhaW5lckZ1bGwgPSBmYWxzZTtcblxuXHRpZiAoaW5pdGlhbFByaW1hcnlBY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiB7IHByaW1hcnlBY3Rpb25zOiBbXSwgc2Vjb25kYXJ5QWN0aW9uczogaW5pdGlhbFNlY29uZGFyeUFjdGlvbnMgfTtcblx0fVxuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgaW5pdGlhbFByaW1hcnlBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgYWN0aW9uTW9kZWwgPSBpbml0aWFsUHJpbWFyeUFjdGlvbnNbaV07XG5cdFx0Y29uc3QgaXRlbVNpemUgPSBpY29uT25seSA/IChhY3Rpb25Nb2RlbC5zaXplID09PSAwID8gMCA6IElDT05fT05MWV9BQ1RJT05fV0lEVEgpIDogYWN0aW9uTW9kZWwuc2l6ZTtcblxuXHRcdC8vIGlmIHR3byBzZXBhcmF0b3JzIGluIGEgcm93LCBpZ25vcmUgdGhlIHNlY29uZFxuXHRcdGlmIChhY3Rpb25Nb2RlbC5hY3Rpb24gaW5zdGFuY2VvZiBTZXBhcmF0b3IgJiYgcmVuZGVyQWN0aW9ucy5sZW5ndGggPiAwICYmIHJlbmRlckFjdGlvbnNbcmVuZGVyQWN0aW9ucy5sZW5ndGggLSAxXS5hY3Rpb24gaW5zdGFuY2VvZiBTZXBhcmF0b3IpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdC8vIGlmIGEgc2VwYXJhdG9yIGlzIHRoZSBmaXJzdCBub25aZXJvIGFjdGlvbiwgaWdub3JlIGl0XG5cdFx0aWYgKGFjdGlvbk1vZGVsLmFjdGlvbiBpbnN0YW5jZW9mIFNlcGFyYXRvciAmJiAhbm9uWmVyb0FjdGlvbikge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cblx0XHRpZiAoY3VycmVudFNpemUgKyBpdGVtU2l6ZSA8PSBsZWZ0VG9vbGJhckNvbnRhaW5lck1heFdpZHRoICYmICFjb250YWluZXJGdWxsKSB7XG5cdFx0XHRjdXJyZW50U2l6ZSArPSBBQ1RJT05fUEFERElORyArIGl0ZW1TaXplO1xuXHRcdFx0cmVuZGVyQWN0aW9ucy5wdXNoKGFjdGlvbk1vZGVsKTtcblx0XHRcdGlmIChpdGVtU2l6ZSAhPT0gMCkge1xuXHRcdFx0XHRub25aZXJvQWN0aW9uID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmIChhY3Rpb25Nb2RlbC5hY3Rpb24gaW5zdGFuY2VvZiBTZXBhcmF0b3IpIHtcblx0XHRcdFx0bm9uWmVyb0FjdGlvbiA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250YWluZXJGdWxsID0gdHJ1ZTtcblx0XHRcdGlmIChpdGVtU2l6ZSA9PT0gMCkgeyAvLyBzaXplIDAgaW1wbGllcyBhIGhpZGRlbiBpdGVtLCBrZWVwIGluIHByaW1hcnkgdG8gYWxsb3cgZm9yIFdvcmtiZW5jaCB0byBoYW5kbGUgdmlzaWJpbGl0eVxuXHRcdFx0XHRyZW5kZXJBY3Rpb25zLnB1c2goYWN0aW9uTW9kZWwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGFjdGlvbk1vZGVsLmFjdGlvbiBpbnN0YW5jZW9mIFNlcGFyYXRvcikgeyAvLyBuZXZlciBwdXNoIGEgc2VwYXJhdG9yIHRvIG92ZXJmbG93XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0b3ZlcmZsb3cucHVzaChhY3Rpb25Nb2RlbC5hY3Rpb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGZvciAobGV0IGkgPSAocmVuZGVyQWN0aW9ucy5sZW5ndGggLSAxKTsgaSA+IDA7IGktLSkge1xuXHRcdGNvbnN0IHRlbXAgPSByZW5kZXJBY3Rpb25zW2ldO1xuXHRcdGlmICh0ZW1wLnNpemUgPT09IDApIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblx0XHRpZiAodGVtcC5hY3Rpb24gaW5zdGFuY2VvZiBTZXBhcmF0b3IpIHtcblx0XHRcdHJlbmRlckFjdGlvbnMuc3BsaWNlKGksIDEpO1xuXHRcdH1cblx0XHRicmVhaztcblx0fVxuXG5cblx0aWYgKHJlbmRlckFjdGlvbnMubGVuZ3RoICYmIHJlbmRlckFjdGlvbnNbcmVuZGVyQWN0aW9ucy5sZW5ndGggLSAxXS5hY3Rpb24gaW5zdGFuY2VvZiBTZXBhcmF0b3IpIHtcblx0XHRyZW5kZXJBY3Rpb25zLnBvcCgpO1xuXHR9XG5cblx0aWYgKG92ZXJmbG93Lmxlbmd0aCAhPT0gMCkge1xuXHRcdG92ZXJmbG93LnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0fVxuXG5cdGlmIChpY29uT25seSkge1xuXHRcdC8vIGlmIGljb24gb25seSBtb2RlLCBkb24ndCByZW5kZXIgYm90aCAoKyBjb2RlKSBhbmQgKCsgbWFya2Rvd24pIGJ1dHRvbnMuIHJlbW92ZSBvZiBtYXJrZG93biBhY3Rpb25cblx0XHRjb25zdCBtYXJrZG93bkluZGV4ID0gcmVuZGVyQWN0aW9ucy5maW5kSW5kZXgoYSA9PiBhLmFjdGlvbi5pZCA9PT0gJ25vdGVib29rLmNlbGwuaW5zZXJ0TWFya2Rvd25DZWxsQmVsb3cnKTtcblx0XHRpZiAobWFya2Rvd25JbmRleCAhPT0gLTEpIHtcblx0XHRcdHJlbmRlckFjdGlvbnMuc3BsaWNlKG1hcmtkb3duSW5kZXgsIDEpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB7XG5cdFx0cHJpbWFyeUFjdGlvbnM6IHJlbmRlckFjdGlvbnMsXG5cdFx0c2Vjb25kYXJ5QWN0aW9uczogWy4uLm92ZXJmbG93LCAuLi5pbml0aWFsU2Vjb25kYXJ5QWN0aW9uc11cblx0fTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZUFBZTtBQUN4QixTQUFrQixpQkFBaUI7QUFDbkMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx5QkFBeUIsa0NBQWtDO0FBQ3BFLFNBQWdCLGNBQWMsUUFBUSxnQkFBZ0IseUJBQXlCO0FBQy9FLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsb0JBQW9CLHVCQUF1QjtBQUVwRCxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLHFCQUFxQixnQ0FBZ0M7QUFDOUQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxtQ0FBbUM7QUFHNUMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxvQkFBOEMsd0JBQXdCO0FBRS9FLFNBQVMsOEJBQThCO0FBU2hDLElBQUssY0FBTCxrQkFBS0EsaUJBQUw7QUFDTixFQUFBQSwwQkFBQSxZQUFTLEtBQVQ7QUFDQSxFQUFBQSwwQkFBQSxXQUFRLEtBQVI7QUFDQSxFQUFBQSwwQkFBQSxhQUFVLEtBQVY7QUFIVyxTQUFBQTtBQUFBLEdBQUE7QUFRTCxTQUFTLHFCQUFxQixPQUE2QztBQUNqRixVQUFRLE9BQU87QUFBQSxJQUNkLEtBQUs7QUFDSixhQUFPO0FBQUEsSUFDUixLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1IsS0FBSztBQUNKLGFBQU87QUFBQSxJQUNSLEtBQUs7QUFDSixhQUFPO0FBQUEsSUFDUixLQUFLO0FBQ0osYUFBTztBQUFBLEVBQ1Q7QUFDRDtBQUVBLE1BQU0seUJBQXlCO0FBQy9CLE1BQU0sMkJBQTJCO0FBQ2pDLE1B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
