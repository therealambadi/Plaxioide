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
import { DataTransfers } from "../../../../base/browser/dnd.js";
import * as DOM from "../../../../base/browser/dom.js";
import * as cssJs from "../../../../base/browser/cssValue.js";
import { renderMarkdownAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { TreeDragOverBubble } from "../../../../base/browser/ui/tree/tree.js";
import { CollapseAllAction } from "../../../../base/browser/ui/tree/treeDefaults.js";
import { ActionRunner, Separator } from "../../../../base/common/actions.js";
import { timeout } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { createMatches } from "../../../../base/common/filters.js";
import { isMarkdownString, MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../base/common/mime.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename, dirname } from "../../../../base/common/resources.js";
import { isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { isString } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import "./media/views.css";
import { VSDataTransfer } from "../../../../base/common/dataTransfer.js";
import { localize } from "../../../../nls.js";
import { createActionViewItem, getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ColorScheme } from "../../../../platform/theme/common/theme.js";
import { FileThemeIcon, FolderThemeIcon, IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { fillEditorsDragData } from "../../dnd.js";
import { ResourceLabels } from "../../labels.js";
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from "../editor/editorCommands.js";
import { getLocationBasedViewColors, ViewPane } from "./viewPane.js";
import { Extensions, IViewDescriptorService, ResolvableTreeItem, TreeItemCollapsibleState } from "../../../common/views.js";
import { IActivityService, NumberBadge } from "../../../services/activity/common/activity.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../../../platform/hover/browser/hover.js";
import { CodeDataTransfers, LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";
import { toExternalVSDataTransfer } from "../../../../editor/browser/dnd.js";
import { CheckboxStateHandler, TreeItemCheckbox } from "./checkbox.js";
import { setTimeout0 } from "../../../../base/common/platform.js";
import { TelemetryTrustedValue } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { ITreeViewsDnDService } from "../../../../editor/common/services/treeViewsDndService.js";
import { DraggedTreeItemsIdentifier } from "../../../../editor/common/services/treeViewsDnd.js";
import { MarkdownRenderer } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IAccessibleViewInformationService } from "../../../services/accessibility/common/accessibleViewInformationService.js";
let TreeViewPane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, notificationService, hoverService, accessibleViewService) {
    super({ ...options, titleMenuId: MenuId.ViewTitle, donotForwardArgs: false }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, accessibleViewService);
    const { treeView } = Registry.as(Extensions.ViewsRegistry).getView(options.id);
    this.treeView = treeView;
    this._register(this.treeView.onDidChangeActions(() => this.updateActions(), this));
    this._register(this.treeView.onDidChangeTitle((newTitle) => this.updateTitle(newTitle)));
    this._register(this.treeView.onDidChangeDescription((newDescription) => this.updateTitleDescription(newDescription)));
    this._register(toDisposable(() => {
      if (this._container && this.treeView.container && this._container === this.treeView.container) {
        this.treeView.setVisibility(false);
      }
    }));
    this._register(this.onDidChangeBodyVisibility(() => this.updateTreeVisibility()));
    this._register(this.treeView.onDidChangeWelcomeState(() => this._onDidChangeViewWelcomeState.fire()));
    if (options.title !== this.treeView.title) {
      this.updateTitle(this.treeView.title);
    }
    if (options.titleDescription !== this.treeView.description) {
      this.updateTitleDescription(this.treeView.description);
    }
    this._actionRunner = this._register(new MultipleSelectionActionRunner(notificationService, () => this.treeView.getSelection()));
    this.updateTreeVisibility();
  }
  focus() {
    super.focus();
    this.treeView.focus();
  }
  renderBody(container) {
    this._container = container;
    super.renderBody(container);
    this.renderTreeView(container);
  }
  shouldShowWelcome() {
    return (this.treeView.dataProvider === void 0 || !!this.treeView.dataProvider.isTreeEmpty) && (this.treeView.message === void 0 || this.treeView.message === "");
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.layoutTreeView(height, width);
  }
  getOptimalWidth() {
    return this.treeView.getOptimalWidth();
  }
  renderTreeView(container) {
    this.treeView.show(container);
  }
  layoutTreeView(height, width) {
    this.treeView.layout(height, width);
  }
  updateTreeVisibility() {
    this.treeView.setVisibility(this.isBodyVisible());
  }
  getActionRunner() {
    return this._actionRunner;
  }
  getActionsContext() {
    return { $treeViewId: this.id, $focusedTreeItem: true, $selectedTreeItems: true };
  }
};
TreeViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IAccessibleViewInformationService)
], TreeViewPane);
class Root {
  constructor() {
    this.label = { label: "root" };
    this.handle = "0";
    this.parentHandle = void 0;
    this.collapsibleState = TreeItemCollapsibleState.Expanded;
    this.children = void 0;
  }
}
function commandPreconditions(commandId) {
  const command = CommandsRegistry.getCommand(commandId);
  if (command) {
    const commandAction = MenuRegistry.getCommand(command.id);
    return commandAction && commandAction.precondition;
  }
  return void 0;
}
function isTreeCommandEnabled(treeCommand, contextKeyService) {
  const commandId = treeCommand.originalId ? treeCommand.originalId : treeCommand.id;
  const precondition = commandPreconditions(commandId);
  if (precondition) {
    return contextKeyService.contextMatchesRules(precondition);
  }
  return true;
}
function isRenderedMessageValue(messageValue) {
  return !!messageValue && typeof messageValue !== "string" && "element" in messageValue && "disposables" in messageValue;
}
const noDataProviderMessage = localize("no-dataprovider", "There is no data provider registered that can provide view data.");
const RawCustomTreeViewContextKey = new RawContextKey("customTreeView", false);
class Tree extends WorkbenchAsyncDataTree {
}
let AbstractTreeView = class extends Disposable {
  constructor(id, _title, themeService, instantiationService, commandService, configurationService, progressService, contextMenuService, keybindingService, notificationService, viewDescriptorService, hoverService, contextKeyService, activityService, logService, openerService) {
    super();
    this.id = id;
    this._title = _title;
    this.themeService = themeService;
    this.instantiationService = instantiationService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.progressService = progressService;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.notificationService = notificationService;
    this.viewDescriptorService = viewDescriptorService;
    this.hoverService = hoverService;
    this.contextKeyService = contextKeyService;
    this.activityService = activityService;
    this.logService = logService;
    this.openerService = openerService;
    this.isVisible = false;
    this._hasIconForParentNode = false;
    this._hasIconForLeafNode = false;
    this.focused = false;
    this._canSelectMany = false;
    this._manuallyManageCheckboxes = false;
    this.elementsToRefresh = [];
    this.lastSelection = [];
    this._onDidExpandItem = this._register(new Emitter());
    this.onDidExpandItem = this._onDidExpandItem.event;
    this._onDidCollapseItem = this._register(new Emitter());
    this.onDidCollapseItem = this._onDidCollapseItem.event;
    this._onDidChangeSelectionAndFocus = this._register(new Emitter());
    this.onDidChangeSelectionAndFocus = this._onDidChangeSelectionAndFocus.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onDidChangeActions = this._register(new Emitter());
    this.onDidChangeActions = this._onDidChangeActions.event;
    this._onDidChangeWelcomeState = this._register(new Emitter());
    this.onDidChangeWelcomeState = this._onDidChangeWelcomeState.event;
    this._onDidChangeTitle = this._register(new Emitter());
    this.onDidChangeTitle = this._onDidChangeTitle.event;
    this._onDidChangeDescription = this._register(new Emitter());
    this.onDidChangeDescription = this._onDidChangeDescription.event;
    this._onDidChangeCheckboxState = this._register(new Emitter());
    this.onDidChangeCheckboxState = this._onDidChangeCheckboxState.event;
    this._onDidCompleteRefresh = this._register(new Emitter());
    this._isInitialized = false;
    this._activity = this._register(new MutableDisposable());
    this.activated = false;
    this.treeDisposables = this._register(new DisposableStore());
    this._height = 0;
    this._width = 0;
    this.refreshing = false;
    this.root = new Root();
    this.lastActive = this.root;
  }
  initialize() {
    if (this._isInitialized) {
      return;
    }
    this._isInitialized = true;
    this.contextKeyService.bufferChangeEvents(() => {
      this.initializeShowCollapseAllAction();
      this.initializeCollapseAllToggle();
      this.initializeShowRefreshAction();
    });
    this.treeViewDnd = this.instantiationService.createInstance(CustomTreeViewDragAndDrop, this.id);
    if (this._dragAndDropController) {
      this.treeViewDnd.controller = this._dragAndDropController;
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("explorer.decorations")) {
        this.doRefresh([this.root]);
      }
    }));
    this._register(this.viewDescriptorService.onDidChangeLocation(({ views, from, to }) => {
      if (views.some((v) => v.id === this.id)) {
        this.tree?.updateOptions({ overrideStyles: getLocationBasedViewColors(this.viewLocation).listOverrideStyles });
      }
    }));
    this.registerActions();
    this.create();
  }
  get viewContainer() {
    return this.viewDescriptorService.getViewContainerByViewId(this.id);
  }
  get viewLocation() {
    return this.viewDescriptorService.getViewLocationById(this.id);
  }
  get dragAndDropController() {
    return this._dragAndDropController;
  }
  set dragAndDropController(dnd) {
    this._dragAndDropController = dnd;
    if (this.treeViewDnd) {
      this.treeViewDnd.controller = dnd;
    }
  }
  get dataProvider() {
    return this._dataProvider;
  }
  set dataProvider(dataProvider) {
    if (dataProvider) {
      if (this.visible) {
        this.activate();
      }
      const self = this;
      this._dataProvider = new class {
        constructor() {
          this._isEmpty = true;
          this._onDidChangeEmpty = new Emitter();
          this.onDidChangeEmpty = this._onDidChangeEmpty.event;
        }
        get isTreeEmpty() {
          return this._isEmpty;
        }
        async getChildren(element) {
          const batches = await this.getChildrenBatch(element ? [element] : void 0);
          return batches?.[0];
        }
        updateEmptyState(nodes, childrenGroups) {
          if (nodes.length === 1 && nodes[0] instanceof Root) {
            const oldEmpty = this._isEmpty;
            this._isEmpty = childrenGroups.length === 0 || childrenGroups[0].length === 0;
            if (oldEmpty !== this._isEmpty) {
              this._onDidChangeEmpty.fire();
            }
          }
        }
        findCheckboxesUpdated(nodes, childrenGroups) {
          if (childrenGroups.length === 0) {
            return [];
          }
          const checkboxesUpdated = [];
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const children = childrenGroups[i];
            for (const child of children) {
              child.parent = node;
              if (!self.manuallyManageCheckboxes && node?.checkbox?.isChecked === true && child.checkbox?.isChecked === false) {
                child.checkbox.isChecked = true;
                checkboxesUpdated.push(child);
              }
            }
          }
          return checkboxesUpdated;
        }
        async getChildrenBatch(nodes) {
          let childrenGroups;
          let checkboxesUpdated = [];
          if (nodes && nodes.every((node) => !!node.children)) {
            childrenGroups = nodes.map((node) => node.children);
          } else {
            nodes = nodes ?? [self.root];
            const batchedChildren = await (nodes.length === 1 && nodes[0] instanceof Root ? doGetChildrenOrBatch(dataProvider, void 0) : doGetChildrenOrBatch(dataProvider, nodes));
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i];
              node.children = batchedChildren ? batchedChildren[i] : void 0;
            }
            childrenGroups = batchedChildren ?? [];
            checkboxesUpdated = this.findCheckboxesUpdated(nodes, childrenGroups);
          }
          this.updateEmptyState(nodes, childrenGroups);
          if (checkboxesUpdated.length > 0) {
            self._onDidChangeCheckboxState.fire(checkboxesUpdated);
          }
          return childrenGroups;
        }
      }();
      if (this._dataProvider.onDidChangeEmpty) {
        this._register(this._dataProvider.onDidChangeEmpty(() => {
          this.updateCollapseAllToggle();
          this._onDidChangeWelcomeState.fire();
        }));
      }
      this.updateMessage();
      this.refresh();
    } else {
      this._dataProvider = void 0;
      this.treeDisposables.clear();
      this.activated = false;
      this.updateMessage();
    }
    this._onDidChangeWelcomeState.fire();
  }
  get message() {
    return this._message;
  }
  set message(message) {
    this._message = message;
    this.updateMessage();
    this._onDidChangeWelcomeState.fire();
  }
  get title() {
    return this._title;
  }
  set title(name) {
    this._title = name;
    this._onDidChangeTitle.fire(this._title);
  }
  get description() {
    return this._description;
  }
  set description(description) {
    this._description = description;
    this._onDidChangeDescription.fire(this._description);
  }
  get badge() {
    return this._badge;
  }
  set badge(badge) {
    if (this._badge?.value === badge?.value && this._badge?.tooltip === badge?.tooltip) {
      return;
    }
    this._badge = badge;
    if (badge) {
      const activity = {
        badge: new NumberBadge(badge.value, () => badge.tooltip),
        priority: 50
      };
      this._activity.value = this.activityService.showViewActivity(this.id, activity);
    } else {
      this._activity.clear();
    }
  }
  get canSelectMany() {
    return this._canSelectMany;
  }
  set canSelectMany(canSelectMany) {
    const oldCanSelectMany = this._canSelectMany;
    this._canSelectMany = canSelectMany;
    if (this._canSelectMany !== oldCanSelectMany) {
      this.tree?.updateOptions({ multipleSelectionSupport: this.canSelectMany });
    }
  }
  get manuallyManageCheckboxes() {
    return this._manuallyManageCheckboxes;
  }
  set manuallyManageCheckboxes(manuallyManageCheckboxes) {
    this._manuallyManageCheckboxes = manuallyManageCheckboxes;
  }
  get hasIconForParentNode() {
    return this._hasIconForParentNode;
  }
  get hasIconForLeafNode() {
    return this._hasIconForLeafNode;
  }
  get visible() {
    return this.isVisible;
  }
  initializeShowCollapseAllAction(startingValue = false) {
    if (!this.collapseAllContext) {
      this.collapseAllContextKey = new RawContextKey(`treeView.${this.id}.enableCollapseAll`, startingValue, localize("treeView.enableCollapseAll", "Whether the tree view with id {0} enables collapse all.", this.id));
      this.collapseAllContext = this.collapseAllContextKey.bindTo(this.contextKeyService);
    }
    return true;
  }
  get showCollapseAllAction() {
    this.initializeShowCollapseAllAction();
    return !!this.collapseAllContext?.get();
  }
  set showCollapseAllAction(showCollapseAllAction) {
    this.initializeShowCollapseAllAction(showCollapseAllAction);
    this.collapseAllContext?.set(showCollapseAllAction);
  }
  initializeShowRefreshAction(startingValue = false) {
    if (!this.refreshContext) {
      this.refreshContextKey = new RawContextKey(`treeView.${this.id}.enableRefresh`, startingValue, localize("treeView.enableRefresh", "Whether the tree view with id {0} enables refresh.", this.id));
      this.refreshContext = this.refreshContextKey.bindTo(this.contextKeyService);
    }
  }
  get showRefreshAction() {
    this.initializeShowRefreshAction();
    return !!this.refreshContext?.get();
  }
  set showRefreshAction(showRefreshAction) {
    this.initializeShowRefreshAction(showRefreshAction);
    this.refreshContext?.set(showRefreshAction);
  }
  registerActions() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.treeView.${that.id}.refresh`,
          title: localize("refresh", "Refresh"),
          menu: {
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", that.id), that.refreshContextKey),
            group: "navigation",
            order: Number.MAX_SAFE_INTEGER - 1
          },
          icon: Codicon.refresh
        });
      }
      async run() {
        return that.refresh();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.treeView.${that.id}.collapseAll`,
          title: localize("collapseAll", "Collapse All"),
          menu: {
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", that.id), that.collapseAllContextKey),
            group: "navigation",
            order: Number.MAX_SAFE_INTEGER
          },
          precondition: that.collapseAllToggleContextKey,
          icon: Codicon.collapseAll
        });
      }
      async run() {
        if (that.tree) {
          return new CollapseAllAction(that.tree, true).run();
        }
      }
    }));
  }
  setVisibility(isVisible) {
    this.initialize();
    isVisible = !!isVisible;
    if (this.isVisible === isVisible) {
      return;
    }
    this.isVisible = isVisible;
    if (this.tree) {
      if (this.isVisible) {
        DOM.show(this.tree.getHTMLElement());
      } else {
        DOM.hide(this.tree.getHTMLElement());
      }
      if (this.isVisible && this.elementsToRefresh.length && this.dataProvider) {
        this.doRefresh(this.elementsToRefresh);
        this.elementsToRefresh = [];
      }
    }
    setTimeout0(() => {
      if (this.dataProvider) {
        this._onDidChangeVisibility.fire(this.isVisible);
      }
    });
    if (this.visible) {
      this.activate();
    }
  }
  focus(reveal = true, revealItem) {
    if (this.tree && this.root.children && this.root.children.length > 0) {
      const element = revealItem ?? this.tree.getSelection()[0];
      if (element && reveal) {
        this.tree.reveal(element, 0.5);
      }
      this.tree.domFocus();
    } else if (this.tree && this.treeContainer && !this.treeContainer.classList.contains("hide")) {
      this.tree.domFocus();
    } else {
      this.domNode.focus();
    }
  }
  show(container) {
    this._container = container;
    DOM.append(container, this.domNode);
  }
  create() {
    this.domNode = DOM.$(".tree-explorer-viewlet-tree-view");
    this.messageElement = DOM.append(this.domNode, DOM.$(".message"));
    this.updateMessage();
    this.treeContainer = DOM.append(this.domNode, DOM.$(".customview-tree"));
    this.treeContainer.classList.add("file-icon-themable-tree", "show-file-icons");
    const focusTracker = this._register(DOM.trackFocus(this.domNode));
    this._register(focusTracker.onDidFocus(() => this.focused = true));
    this._register(focusTracker.onDidBlur(() => this.focused = false));
  }
  createTree() {
    this.treeDisposables.clear();
    const actionViewItemProvider = createActionViewItem.bind(void 0, this.instantiationService);
    const treeMenus = this.treeDisposables.add(this.instantiationService.createInstance(TreeMenus, this.id));
    this.treeLabels = this.treeDisposables.add(this.instantiationService.createInstance(ResourceLabels, this));
    const dataSource = this.instantiationService.createInstance(TreeDataSource, this, (task) => this.progressService.withProgress({ location: this.id }, () => task));
    const aligner = this.treeDisposables.add(new Aligner(this.themeService));
    const checkboxStateHandler = this.treeDisposables.add(new CheckboxStateHandler());
    const renderer = this.treeDisposables.add(this.instantiationService.createInstance(TreeRenderer, this.id, treeMenus, this.treeLabels, actionViewItemProvider, aligner, checkboxStateHandler, () => this.manuallyManageCheckboxes));
    this.treeDisposables.add(renderer.onDidChangeCheckboxState((e) => this._onDidChangeCheckboxState.fire(e)));
    const widgetAriaLabel = this._title;
    this.tree = this.treeDisposables.add(this.instantiationService.createInstance(
      Tree,
      this.id,
      this.treeContainer,
      new TreeViewDelegate(),
      [renderer],
      dataSource,
      {
        identityProvider: new TreeViewIdentityProvider(),
        accessibilityProvider: {
          getAriaLabel(element) {
            if (element.accessibilityInformation) {
              return element.accessibilityInformation.label;
            }
            if (isString(element.tooltip)) {
              return element.tooltip;
            } else {
              if (element.resourceUri && !element.label) {
                return null;
              }
              let buildAriaLabel = "";
              if (element.label) {
                buildAriaLabel += element.label.label + " ";
              }
              if (element.description) {
                buildAriaLabel += element.description;
              }
              return buildAriaLabel;
            }
          },
          getRole(element) {
            return element.accessibilityInformation?.role ?? "treeitem";
          },
          getWidgetAriaLabel() {
            return widgetAriaLabel;
          }
        },
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (item) => {
            return item.label ? item.label.label : item.resourceUri ? basename(URI.revive(item.resourceUri)) : void 0;
          }
        },
        expandOnlyOnTwistieClick: (e) => {
          return !!e.command || !!e.checkbox || this.configurationService.getValue("workbench.tree.expandMode") === "doubleClick";
        },
        collapseByDefault: (e) => {
          return e.collapsibleState !== TreeItemCollapsibleState.Expanded;
        },
        multipleSelectionSupport: this.canSelectMany,
        dnd: this.treeViewDnd,
        overrideStyles: getLocationBasedViewColors(this.viewLocation).listOverrideStyles
      }
    ));
    this.treeDisposables.add(renderer.onDidChangeMenuContext((e) => e.forEach((e2) => this.tree?.rerender(e2))));
    this.treeDisposables.add(this.tree);
    treeMenus.setContextKeyService(this.tree.contextKeyService);
    aligner.tree = this.tree;
    const actionRunner = this.treeDisposables.add(new MultipleSelectionActionRunner(this.notificationService, () => this.tree.getSelection()));
    renderer.actionRunner = actionRunner;
    this.tree.contextKeyService.createKey(this.id, true);
    const customTreeKey = RawCustomTreeViewContextKey.bindTo(this.tree.contextKeyService);
    customTreeKey.set(true);
    this.treeDisposables.add(this.tree.onContextMenu((e) => this.onContextMenu(treeMenus, e, actionRunner)));
    this.treeDisposables.add(this.tree.onDidChangeSelection((e) => {
      this.lastSelection = e.elements;
      this.lastActive = this.tree?.getFocus()[0] ?? this.lastActive;
      this._onDidChangeSelectionAndFocus.fire({ selection: this.lastSelection, focus: this.lastActive });
    }));
    this.treeDisposables.add(this.tree.onDidChangeFocus((e) => {
      if (e.elements.length && e.elements[0] !== this.lastActive) {
        this.lastActive = e.elements[0];
        this.lastSelection = this.tree?.getSelection() ?? this.lastSelection;
        this._onDidChangeSelectionAndFocus.fire({ selection: this.lastSelection, focus: this.lastActive });
      }
    }));
    this.treeDisposables.add(this.tree.onDidChangeCollapseState((e) => {
      if (!e.node.element) {
        return;
      }
      const element = Array.isArray(e.node.element.element) ? e.node.element.element[0] : e.node.element.element;
      if (e.node.collapsed) {
        this._onDidCollapseItem.fire(element);
      } else {
        this._onDidExpandItem.fire(element);
      }
    }));
    this.tree.setInput(this.root).then(() => this.updateContentAreas());
    this.treeDisposables.add(this.tree.onDidOpen(async (e) => {
      if (!e.browserEvent) {
        return;
      }
      if (e.browserEvent.target && e.browserEvent.target.classList.contains(TreeItemCheckbox.checkboxClass)) {
        return;
      }
      const selection = this.tree.getSelection();
      const command = await this.resolveCommand(selection.length === 1 ? selection[0] : void 0);
      if (command && isTreeCommandEnabled(command, this.contextKeyService)) {
        let args = command.arguments || [];
        if (command.id === API_OPEN_EDITOR_COMMAND_ID || command.id === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
          args = [...args, e];
        }
        try {
          await this.commandService.executeCommand(command.id, ...args);
        } catch (err) {
          this.notificationService.error(err);
        }
      }
    }));
    this.treeDisposables.add(treeMenus.onDidChange((changed) => {
      if (this.tree?.hasNode(changed)) {
        this.tree?.rerender(changed);
      }
    }));
  }
  async resolveCommand(element) {
    let command = element?.command;
    if (element && !command) {
      if (element instanceof ResolvableTreeItem && element.hasResolve) {
        await element.resolve(CancellationToken.None);
        command = element.command;
      }
    }
    return command;
  }
  onContextMenu(treeMenus, treeEvent, actionRunner) {
    this.hoverService.hideHover();
    const node = treeEvent.element;
    if (node === null) {
      return;
    }
    const event = treeEvent.browserEvent;
    event.preventDefault();
    event.stopPropagation();
    this.tree.setFocus([node]);
    let selected = this.canSelectMany ? this.getSelection() : [];
    if (!selected.find((item) => item.handle === node.handle)) {
      selected = [node];
    }
    const actions = treeMenus.getResourceContextActions(selected);
    if (!actions.length) {
      return;
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => treeEvent.anchor,
      getActions: () => actions,
      getActionViewItem: (action) => {
        const keybinding = this.keybindingService.lookupKeybinding(action.id);
        if (keybinding) {
          return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
        }
        return void 0;
      },
      onHide: (wasCancelled) => {
        if (wasCancelled) {
          this.tree.domFocus();
        }
      },
      getActionsContext: () => ({ $treeViewId: this.id, $treeItemHandle: node.handle }),
      actionRunner
    });
  }
  updateMessage() {
    if (this._message) {
      this.showMessage(this._message);
    } else if (!this.dataProvider) {
      this.showMessage(noDataProviderMessage);
    } else {
      this.hideMessage();
    }
    this.updateContentAreas();
  }
  processMessage(message, disposables) {
    const lines = message.value.split("\n");
    const result = [];
    let hasFoundButton = false;
    for (const line of lines) {
      const linkedText = parseLinkedText(line);
      if (linkedText.nodes.length === 1 && typeof linkedText.nodes[0] !== "string") {
        const node = linkedText.nodes[0];
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("button-container");
        const button = new Button(buttonContainer, { title: node.title, secondary: hasFoundButton, supportIcons: true, ...defaultButtonStyles });
        button.label = node.label;
        button.onDidClick((_) => {
          this.openerService.open(node.href, { allowCommands: true });
        }, null, disposables);
        const href = URI.parse(node.href);
        if (href.scheme === Schemas.command) {
          const preConditions = commandPreconditions(href.path);
          if (preConditions) {
            button.enabled = this.contextKeyService.contextMatchesRules(preConditions);
            disposables.add(this.contextKeyService.onDidChangeContext((e) => {
              if (e.affectsSome(new Set(preConditions.keys()))) {
                button.enabled = this.contextKeyService.contextMatchesRules(preConditions);
              }
            }));
          }
        }
        disposables.add(button);
        hasFoundButton = true;
        result.push(buttonContainer);
      } else {
        hasFoundButton = false;
        const rendered = this.markdownRenderer.render(new MarkdownString(line, { isTrusted: message.isTrusted, supportThemeIcons: message.supportThemeIcons, supportHtml: message.supportHtml }));
        result.push(rendered.element);
        disposables.add(rendered);
      }
    }
    const container = document.createElement("div");
    container.classList.add("rendered-message");
    for (const child of result) {
      if (DOM.isHTMLElement(child)) {
        container.appendChild(child);
      } else {
        container.appendChild(child.element);
      }
    }
    return container;
  }
  showMessage(message) {
    if (isRenderedMessageValue(this._messageValue)) {
      this._messageValue.disposables.dispose();
    }
    if (isMarkdownString(message) && !this.markdownRenderer) {
      this.markdownRenderer = this.instantiationService.createInstance(MarkdownRenderer, {});
    }
    if (isMarkdownString(message)) {
      const disposables = new DisposableStore();
      const renderedMessage = this.processMessage(message, disposables);
      this._messageValue = { element: renderedMessage, disposables };
    } else {
      this._messageValue = message;
    }
    if (!this.messageElement) {
      return;
    }
    this.messageElement.classList.remove("hide");
    this.resetMessageElement();
    if (typeof this._messageValue === "string" && !isFalsyOrWhitespace(this._messageValue)) {
      this.messageElement.textContent = this._messageValue;
    } else if (isRenderedMessageValue(this._messageValue)) {
      this.messageElement.appendChild(this._messageValue.element);
    }
    this.layout(this._height, this._width);
  }
  hideMessage() {
    this.resetMessageElement();
    this.messageElement?.classList.add("hide");
    this.layout(this._height, this._width);
  }
  resetMessageElement() {
    if (this.messageElement) {
      DOM.clearNode(this.messageElement);
    }
  }
  layout(height, width) {
    if (height && width && this.messageElement && this.treeContainer) {
      this._height = height;
      this._width = width;
      const treeHeight = height - DOM.getTotalHeight(this.messageElement);
      this.treeContainer.style.height = treeHeight + "px";
      this.tree?.layout(treeHeight, width);
    }
  }
  getOptimalWidth() {
    if (this.tree) {
      const parentNode = this.tree.getHTMLElement();
      const childNodes = [].slice.call(parentNode.querySelectorAll(".outline-item-label > a"));
      return DOM.getLargestChildWidth(parentNode, childNodes);
    }
    return 0;
  }
  updateCheckboxes(elements) {
    return setCascadingCheckboxUpdates(elements);
  }
  async refresh(elements, checkboxes) {
    if (this.dataProvider && this.tree) {
      if (this.refreshing) {
        await Event.toPromise(this._onDidCompleteRefresh.event);
      }
      if (!elements) {
        elements = [this.root];
        this.elementsToRefresh = [];
      }
      for (const element of elements) {
        element.children = void 0;
      }
      if (this.isVisible) {
        const affectedElements = this.updateCheckboxes(checkboxes ?? []);
        return this.doRefresh(elements.concat(affectedElements));
      } else {
        if (this.elementsToRefresh.length) {
          const seen = /* @__PURE__ */ new Set();
          this.elementsToRefresh.forEach((element) => seen.add(element.handle));
          for (const element of elements) {
            if (!seen.has(element.handle)) {
              this.elementsToRefresh.push(element);
            }
          }
        } else {
          this.elementsToRefresh.push(...elements);
        }
      }
    }
    return void 0;
  }
  async expand(itemOrItems) {
    const tree = this.tree;
    if (!tree) {
      return;
    }
    try {
      itemOrItems = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
      for (const element of itemOrItems) {
        await tree.expand(element, false);
      }
    } catch (e) {
    }
  }
  isCollapsed(item) {
    return !!this.tree?.isCollapsed(item);
  }
  setSelection(items) {
    this.tree?.setSelection(items);
  }
  getSelection() {
    return this.tree?.getSelection() ?? [];
  }
  setFocus(item) {
    if (this.tree) {
      if (item) {
        this.focus(true, item);
        this.tree.setFocus([item]);
      } else if (this.tree.getFocus().length === 0) {
        this.tree.setFocus([]);
      }
    }
  }
  async reveal(item) {
    if (this.tree) {
      return this.tree.reveal(item);
    }
  }
  async doRefresh(elements) {
    const tree = this.tree;
    if (tree && this.visible) {
      this.refreshing = true;
      const oldSelection = tree.getSelection();
      try {
        await Promise.all(elements.map((element) => tree.updateChildren(element, true, true)));
      } catch (e) {
        this.logService.error(e);
      }
      const newSelection = tree.getSelection();
      if (oldSelection.length !== newSelection.length || oldSelection.some((value, index) => value.handle !== newSelection[index].handle)) {
        this.lastSelection = newSelection;
        this._onDidChangeSelectionAndFocus.fire({ selection: this.lastSelection, focus: this.lastActive });
      }
      this.refreshing = false;
      this._onDidCompleteRefresh.fire();
      this.updateContentAreas();
      if (this.focused) {
        this.focus(false);
      }
      this.updateCollapseAllToggle();
    }
  }
  initializeCollapseAllToggle() {
    if (!this.collapseAllToggleContext) {
      this.collapseAllToggleContextKey = new RawContextKey(`treeView.${this.id}.toggleCollapseAll`, false, localize("treeView.toggleCollapseAll", "Whether collapse all is toggled for the tree view with id {0}.", this.id));
      this.collapseAllToggleContext = this.collapseAllToggleContextKey.bindTo(this.contextKeyService);
    }
  }
  updateCollapseAllToggle() {
    if (this.showCollapseAllAction) {
      this.initializeCollapseAllToggle();
      this.collapseAllToggleContext?.set(!!this.root.children && this.root.children.length > 0 && this.root.children.some((value) => value.collapsibleState !== TreeItemCollapsibleState.None));
    }
  }
  updateContentAreas() {
    const isTreeEmpty = !this.root.children || this.root.children.length === 0;
    if (this._messageValue && isTreeEmpty && !this.refreshing && this.treeContainer) {
      if (!this.dragAndDropController) {
        this.treeContainer.classList.add("hide");
      }
      this.domNode.setAttribute("tabindex", "0");
    } else if (this.treeContainer) {
      this.treeContainer.classList.remove("hide");
      if (this.domNode === DOM.getActiveElement()) {
        this.focus();
      }
      this.domNode.removeAttribute("tabindex");
    }
  }
  get container() {
    return this._container;
  }
};
AbstractTreeView = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IProgressService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IViewDescriptorService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IContextKeyService),
  __decorateParam(13, IActivityService),
  __decorateParam(14, ILogService),
  __decorateParam(15, IOpenerService)
], AbstractTreeView);
class TreeViewIdentityProvider {
  getId(element) {
    return element.handle;
  }
}
class TreeViewDelegate {
  getHeight(element) {
    return TreeRenderer.ITEM_HEIGHT;
  }
  getTemplateId(element) {
    return TreeRenderer.TREE_TEMPLATE_ID;
  }
}
async function doGetChildrenOrBatch(dataProvider, nodes) {
  if (dataProvider.getChildrenBatch) {
    return dataProvider.getChildrenBatch(nodes);
  } else {
    if (nodes) {
      return Promise.all(nodes.map((node) => dataProvider.getChildren(node).then((children) => children ?? [])));
    } else {
      return [await dataProvider.getChildren()].filter((children) => children !== void 0);
    }
  }
}
class TreeDataSource {
  constructor(treeView, withProgress) {
    this.treeView = treeView;
    this.withProgress = withProgress;
  }
  hasChildren(element) {
    return !!this.treeView.dataProvider && element.collapsibleState !== TreeItemCollapsibleState.None;
  }
  async getChildren(element) {
    const dataProvider = this.treeView.dataProvider;
    if (!dataProvider) {
      return [];
    }
    if (this.batch === void 0) {
      this.batch = [element];
      this.batchPromise = void 0;
    } else {
      this.batch.push(element);
    }
    const indexInBatch = this.batch.length - 1;
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        const batch = this.batch;
        this.batch = void 0;
        if (!this.batchPromise) {
          this.batchPromise = this.withProgress(doGetChildrenOrBatch(dataProvider, batch));
        }
        try {
          const result = await this.batchPromise;
          resolve(result && indexInBatch < result.length ? result[indexInBatch] : []);
        } catch (e) {
          if (!e.message.startsWith("Bad progress location:")) {
            reject(e);
          }
        }
      }, 0);
    });
  }
}
let TreeRenderer = class extends Disposable {
  // tree item handle to template data
  constructor(treeViewId, menus, labels, actionViewItemProvider, aligner, checkboxStateHandler, manuallyManageCheckboxes, themeService, configurationService, labelService, contextKeyService, hoverService, instantiationService) {
    super();
    this.treeViewId = treeViewId;
    this.menus = menus;
    this.labels = labels;
    this.actionViewItemProvider = actionViewItemProvider;
    this.aligner = aligner;
    this.checkboxStateHandler = checkboxStateHandler;
    this.manuallyManageCheckboxes = manuallyManageCheckboxes;
    this.themeService = themeService;
    this.configurationService = configurationService;
    this.labelService = labelService;
    this.contextKeyService = contextKeyService;
    this.hoverService = hoverService;
    this._onDidChangeCheckboxState = this._register(new Emitter());
    this.onDidChangeCheckboxState = this._onDidChangeCheckboxState.event;
    this._onDidChangeMenuContext = this._register(new Emitter());
    this.onDidChangeMenuContext = this._onDidChangeMenuContext.event;
    this._hasCheckbox = false;
    this._renderedElements = /* @__PURE__ */ new Map();
    this._hoverDelegate = this._register(instantiationService.createInstance(WorkbenchHoverDelegate, "mouse", void 0, {}));
    this._register(this.themeService.onDidFileIconThemeChange(() => this.rerender()));
    this._register(this.themeService.onDidColorThemeChange(() => this.rerender()));
    this._register(checkboxStateHandler.onDidChangeCheckboxState((items) => {
      this.updateCheckboxes(items);
    }));
    this._register(this.contextKeyService.onDidChangeContext((e) => this.onDidChangeContext(e)));
  }
  get templateId() {
    return TreeRenderer.TREE_TEMPLATE_ID;
  }
  set actionRunner(actionRunner) {
    this._actionRunner = actionRunner;
  }
  renderTemplate(container) {
    container.classList.add("custom-view-tree-node-item");
    const checkboxContainer = DOM.append(container, DOM.$(""));
    const resourceLabel = this.labels.create(container, { supportHighlights: true, hoverDelegate: this._hoverDelegate });
    const icon = DOM.prepend(resourceLabel.element, DOM.$(".custom-view-tree-node-item-icon"));
    const actionsContainer = DOM.append(resourceLabel.element, DOM.$(".actions"));
    const actionBar = new ActionBar(actionsContainer, {
      actionViewItemProvider: this.actionViewItemProvider
    });
    return { resourceLabel, icon, checkboxContainer, actionBar, container };
  }
  getHover(label, resource, node) {
    if (!(node instanceof ResolvableTreeItem) || !node.hasResolve) {
      if (resource && !node.tooltip) {
        return void 0;
      } else if (node.tooltip === void 0) {
        return label;
      } else if (!isString(node.tooltip)) {
        return { markdown: node.tooltip, markdownNotSupportedFallback: resource ? void 0 : renderMarkdownAsPlaintext(node.tooltip) };
      } else if (node.tooltip !== "") {
        return node.tooltip;
      } else {
        return void 0;
      }
    }
    return {
      markdown: typeof node.tooltip === "string" ? node.tooltip : (token) => {
        return new Promise((resolve) => {
          node.resolve(token).then(() => resolve(node.tooltip));
        });
      },
      markdownNotSupportedFallback: resource ? void 0 : label ?? ""
      // Passing undefined as the fallback for a resource falls back to the old native hover
    };
  }
  renderElement(element, index, templateData) {
    const node = element.element;
    const resource = node.resourceUri ? URI.revive(node.resourceUri) : null;
    const treeItemLabel = node.label ? node.label : resource ? { label: basename(resource) } : void 0;
    const description = isString(node.description) ? node.description : resource && node.description === true ? this.labelService.getUriLabel(dirname(resource), { relative: true }) : void 0;
    const label = treeItemLabel ? treeItemLabel.label : void 0;
    const matches = treeItemLabel && treeItemLabel.highlights && label ? treeItemLabel.highlights.map(([start, end]) => {
      if (start < 0) {
        start = label.length + start;
      }
      if (end < 0) {
        end = label.length + end;
      }
      if (start >= label.length || end > label.length) {
        return { start: 0, end: 0 };
      }
      if (start > end) {
        const swap = start;
        start = end;
        end = swap;
      }
      return { start, end };
    }) : void 0;
    const icon = this.themeService.getColorTheme().type === ColorScheme.LIGHT ? node.icon : node.iconDark;
    const iconUrl = icon ? URI.revive(icon) : void 0;
    const title = this.getHover(label, resource, node);
    templateData.actionBar.clear();
    templateData.icon.style.color = "";
    let commandEnabled = true;
    if (node.command) {
      commandEnabled = isTreeCommandEnabled(node.command, this.contextKeyService);
    }
    this.renderCheckbox(node, templateData);
    if (resource) {
      const fileDecorations = this.configurationService.getValue("explorer.decorations");
      const labelResource = resource ? resource : URI.parse("missing:_icon_resource");
      templateData.resourceLabel.setResource({ name: label, description, resource: labelResource }, {
        fileKind: this.getFileKind(node),
        title,
        hideIcon: this.shouldHideResourceLabelIcon(iconUrl, node.themeIcon),
        fileDecorations,
        extraClasses: ["custom-view-tree-node-item-resourceLabel"],
        matches: matches ? matches : createMatches(element.filterData),
        strikethrough: treeItemLabel?.strikethrough,
        disabledCommand: !commandEnabled,
        labelEscapeNewLines: true,
        forceLabel: !!node.label
      });
    } else {
      templateData.resourceLabel.setResource({ name: label, description }, {
        title,
        hideIcon: true,
        extraClasses: ["custom-view-tree-node-item-resourceLabel"],
        matches: matches ? matches : createMatches(element.filterData),
        strikethrough: treeItemLabel?.strikethrough,
        disabledCommand: !commandEnabled,
        labelEscapeNewLines: true
      });
    }
    if (iconUrl) {
      templateData.icon.className = "custom-view-tree-node-item-icon";
      templateData.icon.style.backgroundImage = cssJs.asCSSUrl(iconUrl);
    } else {
      let iconClass;
      if (this.shouldShowThemeIcon(!!resource, node.themeIcon)) {
        iconClass = ThemeIcon.asClassName(node.themeIcon);
        if (node.themeIcon.color) {
          templateData.icon.style.color = this.themeService.getColorTheme().getColor(node.themeIcon.color.id)?.toString() ?? "";
        }
      }
      templateData.icon.className = iconClass ? `custom-view-tree-node-item-icon ${iconClass}` : "";
      templateData.icon.style.backgroundImage = "";
    }
    if (!commandEnabled) {
      templateData.icon.className = templateData.icon.className + " disabled";
      if (templateData.container.parentElement) {
        templateData.container.parentElement.className = templateData.container.parentElement.className + " disabled";
      }
    }
    templateData.actionBar.context = { $treeViewId: this.treeViewId, $treeItemHandle: node.handle };
    const menuActions = this.menus.getResourceActions([node]);
    templateData.actionBar.push(menuActions, { icon: true, label: false });
    if (this._actionRunner) {
      templateData.actionBar.actionRunner = this._actionRunner;
    }
    this.setAlignment(templateData.container, node);
    const renderedItems = this._renderedElements.get(element.element.handle) ?? [];
    this._renderedElements.set(element.element.handle, [...renderedItems, { original: element, rendered: templateData }]);
  }
  rerender() {
    const keys = new Set(this._renderedElements.keys());
    for (const key of keys) {
      const values = this._renderedElements.get(key) ?? [];
      for (const value of values) {
        this.disposeElement(value.original, 0, value.rendered);
        this.renderElement(value.original, 0, value.rendered);
      }
    }
  }
  renderCheckbox(node, templateData) {
    if (node.checkbox) {
      if (!this._hasCheckbox) {
        this._hasCheckbox = true;
        this.rerender();
      }
      if (!templateData.checkbox) {
        const checkbox = new TreeItemCheckbox(templateData.checkboxContainer, this.checkboxStateHandler, this._hoverDelegate, this.hoverService);
        templateData.checkbox = checkbox;
      }
      templateData.checkbox.render(node);
    } else if (templateData.checkbox) {
      templateData.checkbox.dispose();
      templateData.checkbox = void 0;
    }
  }
  setAlignment(container, treeItem) {
    container.parentElement.classList.toggle("align-icon-with-twisty", !this._hasCheckbox && this.aligner.alignIconWithTwisty(treeItem));
  }
  shouldHideResourceLabelIcon(iconUrl, icon) {
    return !!iconUrl || !!icon && !this.isFileKindThemeIcon(icon);
  }
  shouldShowThemeIcon(hasResource, icon) {
    if (!icon) {
      return false;
    }
    return !(hasResource && this.isFileKindThemeIcon(icon));
  }
  isFolderThemeIcon(icon) {
    return icon?.id === FolderThemeIcon.id;
  }
  isFileKindThemeIcon(icon) {
    if (icon) {
      return icon.id === FileThemeIcon.id || this.isFolderThemeIcon(icon);
    } else {
      return false;
    }
  }
  getFileKind(node) {
    if (node.themeIcon) {
      switch (node.themeIcon.id) {
        case FileThemeIcon.id:
          return FileKind.FILE;
        case FolderThemeIcon.id:
          return FileKind.FOLDER;
      }
    }
    return node.collapsibleState === TreeItemCollapsibleState.Collapsed || node.collapsibleState === TreeItemCollapsibleState.Expanded ? FileKind.FOLDER : FileKind.FILE;
  }
  onDidChangeContext(e) {
    const items = [];
    for (const [_, elements] of this._renderedElements) {
      for (const element of elements) {
        if (e.affectsSome(this.menus.getElementOverlayContexts(element.original.element)) || e.affectsSome(this.menus.getEntireMenuContexts())) {
          items.push(element.original.element);
        }
      }
    }
    if (items.length) {
      this._onDidChangeMenuContext.fire(items);
    }
  }
  updateCheckboxes(items) {
    let allItems = [];
    if (!this.manuallyManageCheckboxes()) {
      allItems = setCascadingCheckboxUpdates(items);
    } else {
      allItems = items;
    }
    allItems.forEach((item) => {
      const renderedItems = this._renderedElements.get(item.handle);
      if (renderedItems) {
        renderedItems.forEach((renderedItems2) => renderedItems2.rendered.checkbox?.render(item));
      }
    });
    this._onDidChangeCheckboxState.fire(allItems);
  }
  disposeElement(resource, index, templateData) {
    const itemRenders = this._renderedElements.get(resource.element.handle) ?? [];
    const renderedIndex = itemRenders.findIndex((renderedItem) => templateData === renderedItem.rendered);
    if (itemRenders.length === 1) {
      this._renderedElements.delete(resource.element.handle);
    } else if (itemRenders.length > 0) {
      itemRenders.splice(renderedIndex, 1);
    }
    templateData.checkbox?.dispose();
    templateData.checkbox = void 0;
  }
  disposeTemplate(templateData) {
    templateData.resourceLabel.dispose();
    templateData.actionBar.dispose();
  }
};
TreeRenderer.ITEM_HEIGHT = 22;
TreeRenderer.TREE_TEMPLATE_ID = "treeExplorer";
TreeRenderer = __decorateClass([
  __decorateParam(7, IThemeService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IInstantiationService)
], TreeRenderer);
class Aligner extends Disposable {
  constructor(themeService) {
    super();
    this.themeService = themeService;
  }
  set tree(tree) {
    this._tree = tree;
  }
  alignIconWithTwisty(treeItem) {
    if (treeItem.collapsibleState !== TreeItemCollapsibleState.None) {
      return false;
    }
    if (!this.hasIcon(treeItem)) {
      return false;
    }
    if (this._tree) {
      const parent = this._tree.getParentElement(treeItem) || this._tree.getInput();
      if (this.hasIcon(parent)) {
        return !!parent.children && parent.children.some((c) => c.collapsibleState !== TreeItemCollapsibleState.None && !this.hasIcon(c));
      }
      return !!parent.children && parent.children.every((c) => c.collapsibleState === TreeItemCollapsibleState.None || !this.hasIcon(c));
    } else {
      return false;
    }
  }
  hasIcon(node) {
    const icon = this.themeService.getColorTheme().type === ColorScheme.LIGHT ? node.icon : node.iconDark;
    if (icon) {
      return true;
    }
    if (node.resourceUri || node.themeIcon) {
      const fileIconTheme = this.themeService.getFileIconTheme();
      const isFolder = node.themeIcon ? node.themeIcon.id === FolderThemeIcon.id : node.collapsibleState !== TreeItemCollapsibleState.None;
      if (isFolder) {
        return fileIconTheme.hasFileIcons && fileIconTheme.hasFolderIcons;
      }
      return fileIconTheme.hasFileIcons;
    }
    return false;
  }
}
class MultipleSelectionActionRunner extends ActionRunner {
  constructor(notificationService, getSelectedResources) {
    super();
    this.getSelectedResources = getSelectedResources;
    this._register(this.onDidRun((e) => {
      if (e.error && !isCancellationError(e.error)) {
        notificationService.error(localize("command-error", "Error running command {1}: {0}. This is likely caused by the extension that contributes {1}.", e.error.message, e.action.id));
      }
    }));
  }
  async runAction(action, context) {
    const selection = this.getSelectedResources();
    let selectionHandleArgs = void 0;
    let actionInSelected = false;
    if (selection.length > 1) {
      selectionHandleArgs = selection.map((selected) => {
        if (selected.handle === context.$treeItemHandle || context.$selectedTreeItems) {
          actionInSelected = true;
        }
        return { $treeViewId: context.$treeViewId, $treeItemHandle: selected.handle };
      });
    }
    if (!actionInSelected && selectionHandleArgs) {
      selectionHandleArgs = void 0;
    }
    await action.run(context, selectionHandleArgs);
  }
}
let TreeMenus = class {
  constructor(id, menuService) {
    this.id = id;
    this.menuService = menuService;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  /**
   * Gets only the actions that apply to all of the given elements.
   */
  getResourceActions(elements) {
    const actions = this.getActions(this.getMenuId(), elements);
    return actions.primary;
  }
  /**
   * Gets only the actions that apply to all of the given elements.
   */
  getResourceContextActions(elements) {
    return this.getActions(this.getMenuId(), elements).secondary;
  }
  setContextKeyService(service) {
    this.contextKeyService = service;
  }
  filterNonUniversalActions(groups, newActions) {
    const newActionsSet = new Set(newActions.map((a) => a.id));
    for (const group of groups) {
      const actions = group.keys();
      for (const action of actions) {
        if (!newActionsSet.has(action)) {
          group.delete(action);
        }
      }
    }
  }
  buildMenu(groups) {
    const result = [];
    for (const group of groups) {
      if (group.size > 0) {
        if (result.length) {
          result.push(new Separator());
        }
        result.push(...group.values());
      }
    }
    return result;
  }
  createGroups(actions) {
    const groups = [];
    let group = /* @__PURE__ */ new Map();
    for (const action of actions) {
      if (action instanceof Separator) {
        groups.push(group);
        group = /* @__PURE__ */ new Map();
      } else {
        group.set(action.id, action);
      }
    }
    groups.push(group);
    return groups;
  }
  getElementOverlayContexts(element) {
    return /* @__PURE__ */ new Map([
      ["view", this.id],
      ["viewItem", element.contextValue]
    ]);
  }
  getEntireMenuContexts() {
    return this.menuService.getMenuContexts(this.getMenuId());
  }
  getMenuId() {
    return MenuId.ViewItemContext;
  }
  getActions(menuId, elements) {
    if (!this.contextKeyService) {
      return { primary: [], secondary: [] };
    }
    let primaryGroups = [];
    let secondaryGroups = [];
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const contextKeyService = this.contextKeyService.createOverlay(this.getElementOverlayContexts(element));
      const menuData = this.menuService.getMenuActions(menuId, contextKeyService, { shouldForwardArgs: true });
      const result = getContextMenuActions(menuData, "inline");
      if (i === 0) {
        primaryGroups = this.createGroups(result.primary);
        secondaryGroups = this.createGroups(result.secondary);
      } else {
        this.filterNonUniversalActions(primaryGroups, result.primary);
        this.filterNonUniversalActions(secondaryGroups, result.secondary);
      }
    }
    return { primary: this.buildMenu(primaryGroups), secondary: this.buildMenu(secondaryGroups) };
  }
  dispose() {
    this.contextKeyService = void 0;
  }
};
TreeMenus = __decorateClass([
  __decorateParam(1, IMenuService)
], TreeMenus);
let CustomTreeView = class extends AbstractTreeView {
  constructor(id, title, extensionId, themeService, instantiationService, commandService, configurationService, progressService, contextMenuService, keybindingService, notificationService, viewDescriptorService, contextKeyService, hoverService, extensionService, activityService, telemetryService, logService, openerService) {
    super(id, title, themeService, instantiationService, commandService, configurationService, progressService, contextMenuService, keybindingService, notificationService, viewDescriptorService, hoverService, contextKeyService, activityService, logService, openerService);
    this.extensionId = extensionId;
    this.extensionService = extensionService;
    this.telemetryService = telemetryService;
  }
  activate() {
    if (!this.activated) {
      this.telemetryService.publicLog2("Extension:ViewActivate", {
        extensionId: new TelemetryTrustedValue(this.extensionId),
        id: this.id
      });
      this.createTree();
      this.progressService.withProgress({ location: this.id }, () => this.extensionService.activateByEvent(`onView:${this.id}`)).then(() => timeout(2e3)).then(() => {
        this.updateMessage();
      });
      this.activated = true;
    }
  }
};
CustomTreeView = __decorateClass([
  __decorateParam(3, IThemeService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IProgressService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, IViewDescriptorService),
  __decorateParam(12, IContextKeyService),
  __decorateParam(13, IHoverService),
  __decorateParam(14, IExtensionService),
  __decorateParam(15, IActivityService),
  __decorateParam(16, ITelemetryService),
  __decorateParam(17, ILogService),
  __decorateParam(18, IOpenerService)
], CustomTreeView);
class TreeView extends AbstractTreeView {
  activate() {
    if (!this.activated) {
      this.createTree();
      this.activated = true;
    }
  }
}
let CustomTreeViewDragAndDrop = class {
  constructor(treeId, labelService, instantiationService, treeViewsDragAndDropService, logService) {
    this.treeId = treeId;
    this.labelService = labelService;
    this.instantiationService = instantiationService;
    this.treeViewsDragAndDropService = treeViewsDragAndDropService;
    this.logService = logService;
    this.treeItemsTransfer = LocalSelectionTransfer.getInstance();
    this.treeMimeType = `application/vnd.code.tree.${treeId.toLowerCase()}`;
  }
  set controller(controller) {
    this.dndController = controller;
  }
  handleDragAndLog(dndController, itemHandles, uuid, dragCancellationToken) {
    return dndController.handleDrag(itemHandles, uuid, dragCancellationToken).then((additionalDataTransfer) => {
      if (additionalDataTransfer) {
        const unlistedTypes = [];
        for (const item of additionalDataTransfer) {
          if (item[0] !== this.treeMimeType && dndController.dragMimeTypes.findIndex((value) => value === item[0]) < 0) {
            unlistedTypes.push(item[0]);
          }
        }
        if (unlistedTypes.length) {
          this.logService.warn(`Drag and drop controller for tree ${this.treeId} adds the following data transfer types but does not declare them in dragMimeTypes: ${unlistedTypes.join(", ")}`);
        }
      }
      return additionalDataTransfer;
    });
  }
  addExtensionProvidedTransferTypes(originalEvent, itemHandles) {
    if (!originalEvent.dataTransfer || !this.dndController) {
      return;
    }
    const uuid = generateUuid();
    this.dragCancellationToken = new CancellationTokenSource();
    this.treeViewsDragAndDropService.addDragOperationTransfer(uuid, this.handleDragAndLog(this.dndController, itemHandles, uuid, this.dragCancellationToken.token));
    this.treeItemsTransfer.setData([new DraggedTreeItemsIdentifier(uuid)], DraggedTreeItemsIdentifier.prototype);
    originalEvent.dataTransfer.clearData(Mimes.text);
    if (this.dndController.dragMimeTypes.find((element) => element === Mimes.uriList)) {
      originalEvent.dataTransfer?.setData(DataTransfers.RESOURCES, "");
    }
    this.dndController.dragMimeTypes.forEach((supportedType) => {
      originalEvent.dataTransfer?.setData(supportedType, "");
    });
  }
  addResourceInfoToTransfer(originalEvent, resources) {
    if (resources.length && originalEvent.dataTransfer) {
      this.instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, resources, originalEvent));
      const fileResources = resources.filter((s) => s.scheme === Schemas.file).map((r) => r.fsPath);
      if (fileResources.length) {
        originalEvent.dataTransfer.setData(CodeDataTransfers.FILES, JSON.stringify(fileResources));
      }
    }
  }
  onDragStart(data, originalEvent) {
    if (originalEvent.dataTransfer) {
      const treeItemsData = data.getData();
      const resources = [];
      const sourceInfo = {
        id: this.treeId,
        itemHandles: []
      };
      treeItemsData.forEach((item) => {
        sourceInfo.itemHandles.push(item.handle);
        if (item.resourceUri) {
          resources.push(URI.revive(item.resourceUri));
        }
      });
      this.addResourceInfoToTransfer(originalEvent, resources);
      this.addExtensionProvidedTransferTypes(originalEvent, sourceInfo.itemHandles);
      originalEvent.dataTransfer.setData(
        this.treeMimeType,
        JSON.stringify(sourceInfo)
      );
    }
  }
  debugLog(types) {
    if (types.size) {
      this.logService.debug(`TreeView dragged mime types: ${Array.from(types).join(", ")}`);
    } else {
      this.logService.debug(`TreeView dragged with no supported mime types.`);
    }
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    const dataTransfer = toExternalVSDataTransfer(originalEvent.dataTransfer);
    const types = new Set(Array.from(dataTransfer, (x) => x[0]));
    if (originalEvent.dataTransfer) {
      for (const item of originalEvent.dataTransfer.items) {
        if (item.kind === "file" || item.type === DataTransfers.RESOURCES.toLowerCase()) {
          types.add(Mimes.uriList);
          break;
        }
      }
    }
    this.debugLog(types);
    const dndController = this.dndController;
    if (!dndController || !originalEvent.dataTransfer || dndController.dropMimeTypes.length === 0) {
      return false;
    }
    const dragContainersSupportedType = Array.from(types).some((value, index) => {
      if (value === this.treeMimeType) {
        return true;
      } else {
        return dndController.dropMimeTypes.indexOf(value) >= 0;
      }
    });
    if (dragContainersSupportedType) {
      return { accept: true, bubble: TreeDragOverBubble.Down, autoExpand: true };
    }
    return false;
  }
  getDragURI(element) {
    if (!this.dndController) {
      return null;
    }
    return element.resourceUri ? URI.revive(element.resourceUri).toString() : element.handle;
  }
  getDragLabel(elements) {
    if (!this.dndController) {
      return void 0;
    }
    if (elements.length > 1) {
      return String(elements.length);
    }
    const element = elements[0];
    return element.label ? element.label.label : element.resourceUri ? this.labelService.getUriLabel(URI.revive(element.resourceUri)) : void 0;
  }
  async drop(data, targetNode, targetIndex, targetSector, originalEvent) {
    const dndController = this.dndController;
    if (!originalEvent.dataTransfer || !dndController) {
      return;
    }
    let treeSourceInfo;
    let willDropUuid;
    if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
      willDropUuid = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype)[0].identifier;
    }
    const originalDataTransfer = toExternalVSDataTransfer(originalEvent.dataTransfer, true);
    const outDataTransfer = new VSDataTransfer();
    for (const [type, item] of originalDataTransfer) {
      if (type === this.treeMimeType || dndController.dropMimeTypes.includes(type) || item.asFile() && dndController.dropMimeTypes.includes(DataTransfers.FILES.toLowerCase())) {
        outDataTransfer.append(type, item);
        if (type === this.treeMimeType) {
          try {
            treeSourceInfo = JSON.parse(await item.asString());
          } catch {
          }
        }
      }
    }
    const additionalDataTransfer = await this.treeViewsDragAndDropService.removeDragOperationTransfer(willDropUuid);
    if (additionalDataTransfer) {
      for (const [type, item] of additionalDataTransfer) {
        outDataTransfer.append(type, item);
      }
    }
    return dndController.handleDrop(outDataTransfer, targetNode, CancellationToken.None, willDropUuid, treeSourceInfo?.id, treeSourceInfo?.itemHandles);
  }
  onDragEnd(originalEvent) {
    if (originalEvent.dataTransfer?.dropEffect === "none") {
      this.dragCancellationToken?.cancel();
    }
  }
  dispose() {
  }
};
CustomTreeViewDragAndDrop = __decorateClass([
  __decorateParam(1, ILabelService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ITreeViewsDnDService),
  __decorateParam(4, ILogService)
], CustomTreeViewDragAndDrop);
function setCascadingCheckboxUpdates(items) {
  const additionalItems = [];
  for (const item of items) {
    if (item.checkbox !== void 0) {
      const checkChildren = (currentItem) => {
        for (const child of currentItem.children ?? []) {
          if (child.checkbox !== void 0 && currentItem.checkbox !== void 0 && child.checkbox.isChecked !== currentItem.checkbox.isChecked) {
            child.checkbox.isChecked = currentItem.checkbox.isChecked;
            additionalItems.push(child);
            checkChildren(child);
          }
        }
      };
      checkChildren(item);
      const visitedParents = /* @__PURE__ */ new Set();
      const checkParents = (currentItem) => {
        if (currentItem.parent && currentItem.parent.checkbox !== void 0 && currentItem.parent.children) {
          if (visitedParents.has(currentItem.parent)) {
            return;
          } else {
            visitedParents.add(currentItem.parent);
          }
          let someUnchecked = false;
          let someChecked = false;
          for (const child of currentItem.parent.children) {
            if (someUnchecked && someChecked) {
              break;
            }
            if (child.checkbox !== void 0) {
              if (child.checkbox.isChecked) {
                someChecked = true;
              } else {
                someUnchecked = true;
              }
            }
          }
          if (someChecked && !someUnchecked && currentItem.parent.checkbox.isChecked !== true) {
            currentItem.parent.checkbox.isChecked = true;
            additionalItems.push(currentItem.parent);
            checkParents(currentItem.parent);
          } else if (someUnchecked && currentItem.parent.checkbox.isChecked !== false) {
            currentItem.parent.checkbox.isChecked = false;
            additionalItems.push(currentItem.parent);
            checkParents(currentItem.parent);
          }
        }
      };
      checkParents(item);
    }
  }
  return items.concat(additionalItems);
}
export {
  CustomTreeView,
  CustomTreeViewDragAndDrop,
  RawCustomTreeViewContextKey,
  TreeView,
  TreeViewPane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy92aWV3cy90cmVlVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERhdGFUcmFuc2ZlcnMsIElEcmFnQW5kRHJvcERhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIGNzc0pzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyByZW5kZXJNYXJrZG93bkFzUGxhaW50ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyLCBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyBJSWRlbnRpdHlQcm92aWRlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IEVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhLCBMaXN0Vmlld1RhcmdldFNlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RWaWV3LmpzJztcbmltcG9ydCB7IElBc3luY0RhdGFTb3VyY2UsIElUcmVlQ29udGV4dE1lbnVFdmVudCwgSVRyZWVEcmFnQW5kRHJvcCwgSVRyZWVEcmFnT3ZlclJlYWN0aW9uLCBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIsIFRyZWVEcmFnT3ZlckJ1YmJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgQ29sbGFwc2VBbGxBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlRGVmYXVsdHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uUnVubmVyLCBJQWN0aW9uLCBTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNYXRjaGVzLCBGdXp6eVNjb3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcsIGlzTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNaW1lcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21pbWUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaXNGYWxzeU9yV2hpdGVzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgJy4vbWVkaWEvdmlld3MuY3NzJztcbmltcG9ydCB7IFZTRGF0YVRyYW5zZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0YVRyYW5zZmVyLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGNyZWF0ZUFjdGlvblZpZXdJdGVtLCBnZXRDb250ZXh0TWVudUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIE1lbnVSZWdpc3RyeSwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgQ29udGV4dEtleUV4cHJlc3Npb24sIElDb250ZXh0S2V5LCBJQ29udGV4dEtleUNoYW5nZUV2ZW50LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IEZpbGVLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaEFzeW5jRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IENvbG9yU2NoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IEZpbGVUaGVtZUljb24sIEZvbGRlclRoZW1lSWNvbiwgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGZpbGxFZGl0b3JzRHJhZ0RhdGEgfSBmcm9tICcuLi8uLi9kbmQuanMnO1xuaW1wb3J0IHsgSVJlc291cmNlTGFiZWwsIFJlc291cmNlTGFiZWxzIH0gZnJvbSAnLi4vLi4vbGFiZWxzLmpzJztcbmltcG9ydCB7IEFQSV9PUEVOX0RJRkZfRURJVE9SX0NPTU1BTkRfSUQsIEFQSV9PUEVOX0VESVRPUl9DT01NQU5EX0lEIH0gZnJvbSAnLi4vZWRpdG9yL2VkaXRvckNvbW1hbmRzLmpzJztcbmltcG9ydCB7IGdldExvY2F0aW9uQmFzZWRWaWV3Q29sb3JzLCBJVmlld1BhbmVPcHRpb25zLCBWaWV3UGFuZSB9IGZyb20gJy4vdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVZpZXdsZXRWaWV3T3B0aW9ucyB9IGZyb20gJy4vdmlld3NWaWV3bGV0LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElUcmVlSXRlbSwgSVRyZWVJdGVtTGFiZWwsIElUcmVlVmlldywgSVRyZWVWaWV3RGF0YVByb3ZpZGVyLCBJVHJlZVZpZXdEZXNjcmlwdG9yLCBJVHJlZVZpZXdEcmFnQW5kRHJvcENvbnRyb2xsZXIsIElWaWV3QmFkZ2UsIElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIElWaWV3c1JlZ2lzdHJ5LCBSZXNvbHZhYmxlVHJlZUl0ZW0sIFRyZWVDb21tYW5kLCBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUsIFRyZWVWaWV3SXRlbUhhbmRsZUFyZywgVHJlZVZpZXdQYW5lSGFuZGxlQXJnLCBWaWV3Q29udGFpbmVyLCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSwgTnVtYmVyQmFkZ2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hY3Rpdml0eS9jb21tb24vYWN0aXZpdHkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UsIFdvcmtiZW5jaEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IENvZGVEYXRhVHJhbnNmZXJzLCBMb2NhbFNlbGVjdGlvblRyYW5zZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZG5kL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCB7IHRvRXh0ZXJuYWxWU0RhdGFUcmFuc2ZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBDaGVja2JveFN0YXRlSGFuZGxlciwgVHJlZUl0ZW1DaGVja2JveCB9IGZyb20gJy4vY2hlY2tib3guanMnO1xuaW1wb3J0IHsgc2V0VGltZW91dDAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBBcmlhUm9sZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgVGVsZW1ldHJ5VHJ1c3RlZFZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBJVHJlZVZpZXdzRG5EU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdHJlZVZpZXdzRG5kU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEcmFnZ2VkVHJlZUl0ZW1zSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdHJlZVZpZXdzRG5kLmpzJztcbmltcG9ydCB7IElNYXJrZG93blJlbmRlclJlc3VsdCwgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgdHlwZSB7IElNYW5hZ2VkSG92ZXJUb29sdGlwTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgcGFyc2VMaW5rZWRUZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkVGV4dC5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0QnV0dG9uU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmxlVmlld0luZm9ybWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2libGVWaWV3SW5mb3JtYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUcmVlVmlld1BhbmUgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IHRyZWVWaWV3OiBJVHJlZVZpZXc7XG5cdHByaXZhdGUgX2NvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2FjdGlvblJ1bm5lcjogTXVsdGlwbGVTZWxlY3Rpb25BY3Rpb25SdW5uZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdsZXRWaWV3T3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmxlVmlld0luZm9ybWF0aW9uU2VydmljZSBhY2Nlc3NpYmxlVmlld1NlcnZpY2U6IElBY2Nlc3NpYmxlVmlld0luZm9ybWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoeyAuLi4ob3B0aW9ucyBhcyBJVmlld1BhbmVPcHRpb25zKSwgdGl0bGVNZW51SWQ6IE1lbnVJZC5WaWV3VGl0bGUsIGRvbm90Rm9yd2FyZEFyZ3M6IGZhbHNlIH0sIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UsIGFjY2Vzc2libGVWaWV3U2VydmljZSk7XG5cdFx0Y29uc3QgeyB0cmVlVmlldyB9ID0gKDxJVHJlZVZpZXdEZXNjcmlwdG9yPlJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpLmdldFZpZXcob3B0aW9ucy5pZCkpO1xuXHRcdHRoaXMudHJlZVZpZXcgPSB0cmVlVmlldztcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWVWaWV3Lm9uRGlkQ2hhbmdlQWN0aW9ucygoKSA9PiB0aGlzLnVwZGF0ZUFjdGlvbnMoKSwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZVZpZXcub25EaWRDaGFuZ2VUaXRsZSgobmV3VGl0bGUpID0+IHRoaXMudXBkYXRlVGl0bGUobmV3VGl0bGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlVmlldy5vbkRpZENoYW5nZURlc2NyaXB0aW9uKChuZXdEZXNjcmlwdGlvbikgPT4gdGhpcy51cGRhdGVUaXRsZURlc2NyaXB0aW9uKG5ld0Rlc2NyaXB0aW9uKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fY29udGFpbmVyICYmIHRoaXMudHJlZVZpZXcuY29udGFpbmVyICYmICh0aGlzLl9jb250YWluZXIgPT09IHRoaXMudHJlZVZpZXcuY29udGFpbmVyKSkge1xuXHRcdFx0XHR0aGlzLnRyZWVWaWV3LnNldFZpc2liaWxpdHkoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkoKCkgPT4gdGhpcy51cGRhdGVUcmVlVmlzaWJpbGl0eSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlVmlldy5vbkRpZENoYW5nZVdlbGNvbWVTdGF0ZSgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZVZpZXdXZWxjb21lU3RhdGUuZmlyZSgpKSk7XG5cdFx0aWYgKG9wdGlvbnMudGl0bGUgIT09IHRoaXMudHJlZVZpZXcudGl0bGUpIHtcblx0XHRcdHRoaXMudXBkYXRlVGl0bGUodGhpcy50cmVlVmlldy50aXRsZSk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLnRpdGxlRGVzY3JpcHRpb24gIT09IHRoaXMudHJlZVZpZXcuZGVzY3JpcHRpb24pIHtcblx0XHRcdHRoaXMudXBkYXRlVGl0bGVEZXNjcmlwdGlvbih0aGlzLnRyZWVWaWV3LmRlc2NyaXB0aW9uKTtcblx0XHR9XG5cdFx0dGhpcy5fYWN0aW9uUnVubmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11bHRpcGxlU2VsZWN0aW9uQWN0aW9uUnVubmVyKG5vdGlmaWNhdGlvblNlcnZpY2UsICgpID0+IHRoaXMudHJlZVZpZXcuZ2V0U2VsZWN0aW9uKCkpKTtcblxuXHRcdHRoaXMudXBkYXRlVHJlZVZpc2liaWxpdHkoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0dGhpcy50cmVlVmlldy5mb2N1cygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckJvZHkoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRhaW5lciA9IGNvbnRhaW5lcjtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cdFx0dGhpcy5yZW5kZXJUcmVlVmlldyhjb250YWluZXIpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2hvdWxkU2hvd1dlbGNvbWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICgodGhpcy50cmVlVmlldy5kYXRhUHJvdmlkZXIgPT09IHVuZGVmaW5lZCkgfHwgISF0aGlzLnRyZWVWaWV3LmRhdGFQcm92aWRlci5pc1RyZWVFbXB0eSkgJiYgKCh0aGlzLnRyZWVWaWV3Lm1lc3NhZ2UgPT09IHVuZGVmaW5lZCkgfHwgKHRoaXMudHJlZVZpZXcubWVzc2FnZSA9PT0gJycpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBsYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIubGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLmxheW91dFRyZWVWaWV3KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0T3B0aW1hbFdpZHRoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZVZpZXcuZ2V0T3B0aW1hbFdpZHRoKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVuZGVyVHJlZVZpZXcoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMudHJlZVZpZXcuc2hvdyhjb250YWluZXIpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGxheW91dFRyZWVWaWV3KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlVmlldy5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRyZWVWaXNpYmlsaXR5KCk6IHZvaWQge1xuXHRcdHRoaXMudHJlZVZpZXcuc2V0VmlzaWJpbGl0eSh0aGlzLmlzQm9keVZpc2libGUoKSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRBY3Rpb25SdW5uZXIoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGlvblJ1bm5lcjtcblx0fVxuXG5cdG92ZXJyaWRlIGdldEFjdGlvbnNDb250ZXh0KCk6IFRyZWVWaWV3UGFuZUhhbmRsZUFyZyB7XG5cdFx0cmV0dXJuIHsgJHRyZWVWaWV3SWQ6IHRoaXMuaWQsICRmb2N1c2VkVHJlZUl0ZW06IHRydWUsICRzZWxlY3RlZFRyZWVJdGVtczogdHJ1ZSB9O1xuXHR9XG5cbn1cblxuY2xhc3MgUm9vdCBpbXBsZW1lbnRzIElUcmVlSXRlbSB7XG5cdGxhYmVsID0geyBsYWJlbDogJ3Jvb3QnIH07XG5cdGhhbmRsZSA9ICcwJztcblx0cGFyZW50SGFuZGxlOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGNvbGxhcHNpYmxlU3RhdGUgPSBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuRXhwYW5kZWQ7XG5cdGNoaWxkcmVuOiBJVHJlZUl0ZW1bXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gY29tbWFuZFByZWNvbmRpdGlvbnMoY29tbWFuZElkOiBzdHJpbmcpOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LmdldENvbW1hbmQoY29tbWFuZElkKTtcblx0aWYgKGNvbW1hbmQpIHtcblx0XHRjb25zdCBjb21tYW5kQWN0aW9uID0gTWVudVJlZ2lzdHJ5LmdldENvbW1hbmQoY29tbWFuZC5pZCk7XG5cdFx0cmV0dXJuIGNvbW1hbmRBY3Rpb24gJiYgY29tbWFuZEFjdGlvbi5wcmVjb25kaXRpb247XG5cdH1cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaXNUcmVlQ29tbWFuZEVuYWJsZWQodHJlZUNvbW1hbmQ6IFRyZWVDb21tYW5kIHwgQ29tbWFuZCwgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSk6IGJvb2xlYW4ge1xuXHRjb25zdCBjb21tYW5kSWQ6IHN0cmluZyA9ICh0cmVlQ29tbWFuZCBhcyBUcmVlQ29tbWFuZCkub3JpZ2luYWxJZCA/ICh0cmVlQ29tbWFuZCBhcyBUcmVlQ29tbWFuZCkub3JpZ2luYWxJZCEgOiB0cmVlQ29tbWFuZC5pZDtcblx0Y29uc3QgcHJlY29uZGl0aW9uID0gY29tbWFuZFByZWNvbmRpdGlvbnMoY29tbWFuZElkKTtcblx0aWYgKHByZWNvbmRpdGlvbikge1xuXHRcdHJldHVybiBjb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHByZWNvbmRpdGlvbik7XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuaW50ZXJmYWNlIFJlbmRlcmVkTWVzc2FnZSB7IGVsZW1lbnQ6IEhUTUxFbGVtZW50OyBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlIH1cblxuZnVuY3Rpb24gaXNSZW5kZXJlZE1lc3NhZ2VWYWx1ZShtZXNzYWdlVmFsdWU6IHN0cmluZyB8IFJlbmRlcmVkTWVzc2FnZSB8IHVuZGVmaW5lZCk6IG1lc3NhZ2VWYWx1ZSBpcyBSZW5kZXJlZE1lc3NhZ2Uge1xuXHRyZXR1cm4gISFtZXNzYWdlVmFsdWUgJiYgdHlwZW9mIG1lc3NhZ2VWYWx1ZSAhPT0gJ3N0cmluZycgJiYgJ2VsZW1lbnQnIGluIG1lc3NhZ2VWYWx1ZSAmJiAnZGlzcG9zYWJsZXMnIGluIG1lc3NhZ2VWYWx1ZTtcbn1cblxuY29uc3Qgbm9EYXRhUHJvdmlkZXJNZXNzYWdlID0gbG9jYWxpemUoJ25vLWRhdGFwcm92aWRlcicsIFwiVGhlcmUgaXMgbm8gZGF0YSBwcm92aWRlciByZWdpc3RlcmVkIHRoYXQgY2FuIHByb3ZpZGUgdmlldyBkYXRhLlwiKTtcblxuZXhwb3J0IGNvbnN0IFJhd0N1c3RvbVRyZWVWaWV3Q29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdjdXN0b21UcmVlVmlldycsIGZhbHNlKTtcblxuY2xhc3MgVHJlZSBleHRlbmRzIFdvcmtiZW5jaEFzeW5jRGF0YVRyZWU8SVRyZWVJdGVtLCBJVHJlZUl0ZW0sIEZ1enp5U2NvcmU+IHsgfVxuXG5hYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFRyZWVWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUcmVlVmlldyB7XG5cblx0cHJpdmF0ZSBpc1Zpc2libGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfaGFzSWNvbkZvclBhcmVudE5vZGUgPSBmYWxzZTtcblx0cHJpdmF0ZSBfaGFzSWNvbkZvckxlYWZOb2RlID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBjb2xsYXBzZUFsbENvbnRleHRLZXk6IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY29sbGFwc2VBbGxDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjb2xsYXBzZUFsbFRvZ2dsZUNvbnRleHRLZXk6IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY29sbGFwc2VBbGxUb2dnbGVDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWZyZXNoQ29udGV4dEtleTogUmF3Q29udGV4dEtleTxib29sZWFuPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWZyZXNoQ29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj4gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBmb2N1c2VkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgZG9tTm9kZSE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRyZWVDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9tZXNzYWdlVmFsdWU6IHN0cmluZyB8IHsgZWxlbWVudDogSFRNTEVsZW1lbnQ7IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY2FuU2VsZWN0TWFueTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9tYW51YWxseU1hbmFnZUNoZWNrYm94ZXM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBtZXNzYWdlRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdHJlZTogVHJlZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB0cmVlTGFiZWxzOiBSZXNvdXJjZUxhYmVscyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB0cmVlVmlld0RuZDogQ3VzdG9tVHJlZVZpZXdEcmFnQW5kRHJvcCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJvb3Q6IElUcmVlSXRlbTtcblx0cHJpdmF0ZSBtYXJrZG93blJlbmRlcmVyOiBNYXJrZG93blJlbmRlcmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGVsZW1lbnRzVG9SZWZyZXNoOiBJVHJlZUl0ZW1bXSA9IFtdO1xuXHRwcml2YXRlIGxhc3RTZWxlY3Rpb246IHJlYWRvbmx5IElUcmVlSXRlbVtdID0gW107XG5cdHByaXZhdGUgbGFzdEFjdGl2ZTogSVRyZWVJdGVtO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRXhwYW5kSXRlbTogRW1pdHRlcjxJVHJlZUl0ZW0+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRyZWVJdGVtPigpKTtcblx0cmVhZG9ubHkgb25EaWRFeHBhbmRJdGVtOiBFdmVudDxJVHJlZUl0ZW0+ID0gdGhpcy5fb25EaWRFeHBhbmRJdGVtLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ29sbGFwc2VJdGVtOiBFbWl0dGVyPElUcmVlSXRlbT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVHJlZUl0ZW0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENvbGxhcHNlSXRlbTogRXZlbnQ8SVRyZWVJdGVtPiA9IHRoaXMuX29uRGlkQ29sbGFwc2VJdGVtLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlU2VsZWN0aW9uQW5kRm9jdXM6IEVtaXR0ZXI8eyBzZWxlY3Rpb246IHJlYWRvbmx5IElUcmVlSXRlbVtdOyBmb2N1czogSVRyZWVJdGVtIH0+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBzZWxlY3Rpb246IHJlYWRvbmx5IElUcmVlSXRlbVtdOyBmb2N1czogSVRyZWVJdGVtIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVNlbGVjdGlvbkFuZEZvY3VzOiBFdmVudDx7IHNlbGVjdGlvbjogcmVhZG9ubHkgSVRyZWVJdGVtW107IGZvY3VzOiBJVHJlZUl0ZW0gfT4gPSB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbkFuZEZvY3VzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVmlzaWJpbGl0eTogRW1pdHRlcjxib29sZWFuPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVZpc2liaWxpdHk6IEV2ZW50PGJvb2xlYW4+ID0gdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQWN0aW9uczogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFjdGlvbnM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VBY3Rpb25zLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlV2VsY29tZVN0YXRlOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlV2VsY29tZVN0YXRlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlV2VsY29tZVN0YXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVGl0bGU6IEVtaXR0ZXI8c3RyaW5nPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVGl0bGU6IEV2ZW50PHN0cmluZz4gPSB0aGlzLl9vbkRpZENoYW5nZVRpdGxlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRGVzY3JpcHRpb246IEVtaXR0ZXI8c3RyaW5nIHwgdW5kZWZpbmVkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZyB8IHVuZGVmaW5lZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGVzY3JpcHRpb246IEV2ZW50PHN0cmluZyB8IHVuZGVmaW5lZD4gPSB0aGlzLl9vbkRpZENoYW5nZURlc2NyaXB0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ2hlY2tib3hTdGF0ZTogRW1pdHRlcjxyZWFkb25seSBJVHJlZUl0ZW1bXT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxyZWFkb25seSBJVHJlZUl0ZW1bXT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ2hlY2tib3hTdGF0ZTogRXZlbnQ8cmVhZG9ubHkgSVRyZWVJdGVtW10+ID0gdGhpcy5fb25EaWRDaGFuZ2VDaGVja2JveFN0YXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ29tcGxldGVSZWZyZXNoOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgaWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIF90aXRsZTogc3RyaW5nLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJvb3QgPSBuZXcgUm9vdCgpO1xuXHRcdHRoaXMubGFzdEFjdGl2ZSA9IHRoaXMucm9vdDtcblx0XHQvLyBUcnkgbm90IHRvIGFkZCBhbnl0aGluZyB0aGF0IGNvdWxkIGJlIGNvc3RseSB0byB0aGlzIGNvbnN0cnVjdG9yLiBJdCBnZXRzIGNhbGxlZCBvbmNlIHBlciB0cmVlIHZpZXdcblx0XHQvLyBkdXJpbmcgc3RhcnR1cCwgYW5kIGFueXRoaW5nIGFkZGVkIGhlcmUgY2FuIGFmZmVjdCBwZXJmb3JtYW5jZS5cblx0fVxuXG5cdHByaXZhdGUgX2lzSW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBpbml0aWFsaXplKCkge1xuXHRcdGlmICh0aGlzLl9pc0luaXRpYWxpemVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2lzSW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG5cdFx0Ly8gUmVtZW1iZXIgd2hlbiBhZGRpbmcgdG8gdGhpcyBtZXRob2QgdGhhdCBpdCBpc24ndCBjYWxsZWQgdW50aWwgdGhlIHZpZXcgaXMgdmlzaWJsZSwgbWVhbmluZyB0aGF0XG5cdFx0Ly8gcHJvcGVydGllcyBjb3VsZCBiZSBzZXQgYW5kIGV2ZW50cyBjb3VsZCBiZSBmaXJlZCBiZWZvcmUgd2UncmUgaW5pdGlhbGl6ZWQgYW5kIHRoYXQgdGhpcyBuZWVkcyB0byBiZSBoYW5kbGVkLlxuXG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZS5idWZmZXJDaGFuZ2VFdmVudHMoKCkgPT4ge1xuXHRcdFx0dGhpcy5pbml0aWFsaXplU2hvd0NvbGxhcHNlQWxsQWN0aW9uKCk7XG5cdFx0XHR0aGlzLmluaXRpYWxpemVDb2xsYXBzZUFsbFRvZ2dsZSgpO1xuXHRcdFx0dGhpcy5pbml0aWFsaXplU2hvd1JlZnJlc2hBY3Rpb24oKTtcblx0XHR9KTtcblxuXHRcdHRoaXMudHJlZVZpZXdEbmQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEN1c3RvbVRyZWVWaWV3RHJhZ0FuZERyb3AsIHRoaXMuaWQpO1xuXHRcdGlmICh0aGlzLl9kcmFnQW5kRHJvcENvbnRyb2xsZXIpIHtcblx0XHRcdHRoaXMudHJlZVZpZXdEbmQuY29udHJvbGxlciA9IHRoaXMuX2RyYWdBbmREcm9wQ29udHJvbGxlcjtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdleHBsb3Jlci5kZWNvcmF0aW9ucycpKSB7XG5cdFx0XHRcdHRoaXMuZG9SZWZyZXNoKFt0aGlzLnJvb3RdKTsgLyoqIHNvZnQgcmVmcmVzaCAqKi9cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2Uub25EaWRDaGFuZ2VMb2NhdGlvbigoeyB2aWV3cywgZnJvbSwgdG8gfSkgPT4ge1xuXHRcdFx0aWYgKHZpZXdzLnNvbWUodiA9PiB2LmlkID09PSB0aGlzLmlkKSkge1xuXHRcdFx0XHR0aGlzLnRyZWU/LnVwZGF0ZU9wdGlvbnMoeyBvdmVycmlkZVN0eWxlczogZ2V0TG9jYXRpb25CYXNlZFZpZXdDb2xvcnModGhpcy52aWV3TG9jYXRpb24pLmxpc3RPdmVycmlkZVN0eWxlcyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5yZWdpc3RlckFjdGlvbnMoKTtcblxuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdH1cblxuXHRnZXQgdmlld0NvbnRhaW5lcigpOiBWaWV3Q29udGFpbmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHRoaXMuaWQpITtcblx0fVxuXG5cdGdldCB2aWV3TG9jYXRpb24oKTogVmlld0NvbnRhaW5lckxvY2F0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0xvY2F0aW9uQnlJZCh0aGlzLmlkKSE7XG5cdH1cblx0cHJpdmF0ZSBfZHJhZ0FuZERyb3BDb250cm9sbGVyOiBJVHJlZVZpZXdEcmFnQW5kRHJvcENvbnRyb2xsZXIgfCB1bmRlZmluZWQ7XG5cdGdldCBkcmFnQW5kRHJvcENvbnRyb2xsZXIoKTogSVRyZWVWaWV3RHJhZ0FuZERyb3BDb250cm9sbGVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fZHJhZ0FuZERyb3BDb250cm9sbGVyO1xuXHR9XG5cdHNldCBkcmFnQW5kRHJvcENvbnRyb2xsZXIoZG5kOiBJVHJlZVZpZXdEcmFnQW5kRHJvcENvbnRyb2xsZXIgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9kcmFnQW5kRHJvcENvbnRyb2xsZXIgPSBkbmQ7XG5cdFx0aWYgKHRoaXMudHJlZVZpZXdEbmQpIHtcblx0XHRcdHRoaXMudHJlZVZpZXdEbmQuY29udHJvbGxlciA9IGRuZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kYXRhUHJvdmlkZXI6IElUcmVlVmlld0RhdGFQcm92aWRlciB8IHVuZGVmaW5lZDtcblx0Z2V0IGRhdGFQcm92aWRlcigpOiBJVHJlZVZpZXdEYXRhUHJvdmlkZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9kYXRhUHJvdmlkZXI7XG5cdH1cblxuXHRzZXQgZGF0YVByb3ZpZGVyKGRhdGFQcm92aWRlcjogSVRyZWVWaWV3RGF0YVByb3ZpZGVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKGRhdGFQcm92aWRlcikge1xuXHRcdFx0aWYgKHRoaXMudmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLmFjdGl2YXRlKCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzZWxmID0gdGhpcztcblx0XHRcdHRoaXMuX2RhdGFQcm92aWRlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElUcmVlVmlld0RhdGFQcm92aWRlciB7XG5cdFx0XHRcdHByaXZhdGUgX2lzRW1wdHk6IGJvb2xlYW4gPSB0cnVlO1xuXHRcdFx0XHRwcml2YXRlIF9vbkRpZENoYW5nZUVtcHR5OiBFbWl0dGVyPHZvaWQ+ID0gbmV3IEVtaXR0ZXIoKTtcblx0XHRcdFx0cHVibGljIG9uRGlkQ2hhbmdlRW1wdHk6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VFbXB0eS5ldmVudDtcblxuXHRcdFx0XHRnZXQgaXNUcmVlRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2lzRW1wdHk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50PzogSVRyZWVJdGVtKTogUHJvbWlzZTxJVHJlZUl0ZW1bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdFx0XHRcdGNvbnN0IGJhdGNoZXMgPSBhd2FpdCB0aGlzLmdldENoaWxkcmVuQmF0Y2goZWxlbWVudCA/IFtlbGVtZW50XSA6IHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0cmV0dXJuIGJhdGNoZXM/LlswXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHByaXZhdGUgdXBkYXRlRW1wdHlTdGF0ZShub2RlczogSVRyZWVJdGVtW10sIGNoaWxkcmVuR3JvdXBzOiBJVHJlZUl0ZW1bXVtdKTogdm9pZCB7XG5cdFx0XHRcdFx0aWYgKChub2Rlcy5sZW5ndGggPT09IDEpICYmIChub2Rlc1swXSBpbnN0YW5jZW9mIFJvb3QpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBvbGRFbXB0eSA9IHRoaXMuX2lzRW1wdHk7XG5cdFx0XHRcdFx0XHR0aGlzLl9pc0VtcHR5ID0gKGNoaWxkcmVuR3JvdXBzLmxlbmd0aCA9PT0gMCkgfHwgKGNoaWxkcmVuR3JvdXBzWzBdLmxlbmd0aCA9PT0gMCk7XG5cdFx0XHRcdFx0XHRpZiAob2xkRW1wdHkgIT09IHRoaXMuX2lzRW1wdHkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VFbXB0eS5maXJlKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cHJpdmF0ZSBmaW5kQ2hlY2tib3hlc1VwZGF0ZWQobm9kZXM6IElUcmVlSXRlbVtdLCBjaGlsZHJlbkdyb3VwczogSVRyZWVJdGVtW11bXSk6IElUcmVlSXRlbVtdIHtcblx0XHRcdFx0XHRpZiAoY2hpbGRyZW5Hcm91cHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGNoZWNrYm94ZXNVcGRhdGVkOiBJVHJlZUl0ZW1bXSA9IFtdO1xuXG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0Y29uc3Qgbm9kZSA9IG5vZGVzW2ldO1xuXHRcdFx0XHRcdFx0Y29uc3QgY2hpbGRyZW4gPSBjaGlsZHJlbkdyb3Vwc1tpXTtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRcdFx0Y2hpbGQucGFyZW50ID0gbm9kZTtcblx0XHRcdFx0XHRcdFx0aWYgKCFzZWxmLm1hbnVhbGx5TWFuYWdlQ2hlY2tib3hlcyAmJiAobm9kZT8uY2hlY2tib3g/LmlzQ2hlY2tlZCA9PT0gdHJ1ZSkgJiYgKGNoaWxkLmNoZWNrYm94Py5pc0NoZWNrZWQgPT09IGZhbHNlKSkge1xuXHRcdFx0XHRcdFx0XHRcdGNoaWxkLmNoZWNrYm94LmlzQ2hlY2tlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0Y2hlY2tib3hlc1VwZGF0ZWQucHVzaChjaGlsZCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGNoZWNrYm94ZXNVcGRhdGVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YXN5bmMgZ2V0Q2hpbGRyZW5CYXRjaChub2Rlcz86IElUcmVlSXRlbVtdKTogUHJvbWlzZTxJVHJlZUl0ZW1bXVtdPiB7XG5cdFx0XHRcdFx0bGV0IGNoaWxkcmVuR3JvdXBzOiBJVHJlZUl0ZW1bXVtdO1xuXHRcdFx0XHRcdGxldCBjaGVja2JveGVzVXBkYXRlZDogSVRyZWVJdGVtW10gPSBbXTtcblx0XHRcdFx0XHRpZiAobm9kZXMgJiYgbm9kZXMuZXZlcnkoKG5vZGUpOiBub2RlIGlzIFJlcXVpcmVkPElUcmVlSXRlbSAmIHsgY2hpbGRyZW46IElUcmVlSXRlbVtdIH0+ID0+ICEhbm9kZS5jaGlsZHJlbikpIHtcblx0XHRcdFx0XHRcdGNoaWxkcmVuR3JvdXBzID0gbm9kZXMubWFwKG5vZGUgPT4gbm9kZS5jaGlsZHJlbik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG5vZGVzID0gbm9kZXMgPz8gW3NlbGYucm9vdF07XG5cdFx0XHRcdFx0XHRjb25zdCBiYXRjaGVkQ2hpbGRyZW4gPSBhd2FpdCAobm9kZXMubGVuZ3RoID09PSAxICYmIG5vZGVzWzBdIGluc3RhbmNlb2YgUm9vdCA/IGRvR2V0Q2hpbGRyZW5PckJhdGNoKGRhdGFQcm92aWRlciwgdW5kZWZpbmVkKSA6IGRvR2V0Q2hpbGRyZW5PckJhdGNoKGRhdGFQcm92aWRlciwgbm9kZXMpKTtcblx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgbm9kZSA9IG5vZGVzW2ldO1xuXHRcdFx0XHRcdFx0XHRub2RlLmNoaWxkcmVuID0gYmF0Y2hlZENoaWxkcmVuID8gYmF0Y2hlZENoaWxkcmVuW2ldIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y2hpbGRyZW5Hcm91cHMgPSBiYXRjaGVkQ2hpbGRyZW4gPz8gW107XG5cdFx0XHRcdFx0XHRjaGVja2JveGVzVXBkYXRlZCA9IHRoaXMuZmluZENoZWNrYm94ZXNVcGRhdGVkKG5vZGVzLCBjaGlsZHJlbkdyb3Vwcyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy51cGRhdGVFbXB0eVN0YXRlKG5vZGVzLCBjaGlsZHJlbkdyb3Vwcyk7XG5cblx0XHRcdFx0XHRpZiAoY2hlY2tib3hlc1VwZGF0ZWQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0c2VsZi5fb25EaWRDaGFuZ2VDaGVja2JveFN0YXRlLmZpcmUoY2hlY2tib3hlc1VwZGF0ZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gY2hpbGRyZW5Hcm91cHM7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRpZiAodGhpcy5fZGF0YVByb3ZpZGVyLm9uRGlkQ2hhbmdlRW1wdHkpIHtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZGF0YVByb3ZpZGVyLm9uRGlkQ2hhbmdlRW1wdHkoKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlQ29sbGFwc2VBbGxUb2dnbGUoKTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVdlbGNvbWVTdGF0ZS5maXJlKCk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlTWVzc2FnZSgpO1xuXHRcdFx0dGhpcy5yZWZyZXNoKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2RhdGFQcm92aWRlciA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMudHJlZURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLmFjdGl2YXRlZCA9IGZhbHNlO1xuXHRcdFx0dGhpcy51cGRhdGVNZXNzYWdlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VXZWxjb21lU3RhdGUuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbWVzc2FnZTogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXQgbWVzc2FnZSgpOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9tZXNzYWdlO1xuXHR9XG5cblx0c2V0IG1lc3NhZ2UobWVzc2FnZTogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fbWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0dGhpcy51cGRhdGVNZXNzYWdlKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VXZWxjb21lU3RhdGUuZmlyZSgpO1xuXHR9XG5cblx0Z2V0IHRpdGxlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3RpdGxlO1xuXHR9XG5cblx0c2V0IHRpdGxlKG5hbWU6IHN0cmluZykge1xuXHRcdHRoaXMuX3RpdGxlID0gbmFtZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVRpdGxlLmZpcmUodGhpcy5fdGl0bGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0IGRlc2NyaXB0aW9uKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2Rlc2NyaXB0aW9uO1xuXHR9XG5cblx0c2V0IGRlc2NyaXB0aW9uKGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVzY3JpcHRpb24uZmlyZSh0aGlzLl9kZXNjcmlwdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIF9iYWRnZTogSVZpZXdCYWRnZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+KCkpO1xuXG5cdGdldCBiYWRnZSgpOiBJVmlld0JhZGdlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fYmFkZ2U7XG5cdH1cblxuXHRzZXQgYmFkZ2UoYmFkZ2U6IElWaWV3QmFkZ2UgfCB1bmRlZmluZWQpIHtcblxuXHRcdGlmICh0aGlzLl9iYWRnZT8udmFsdWUgPT09IGJhZGdlPy52YWx1ZSAmJlxuXHRcdFx0dGhpcy5fYmFkZ2U/LnRvb2x0aXAgPT09IGJhZGdlPy50b29sdGlwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fYmFkZ2UgPSBiYWRnZTtcblx0XHRpZiAoYmFkZ2UpIHtcblx0XHRcdGNvbnN0IGFjdGl2aXR5ID0ge1xuXHRcdFx0XHRiYWRnZTogbmV3IE51bWJlckJhZGdlKGJhZGdlLnZhbHVlLCAoKSA9PiBiYWRnZS50b29sdGlwKSxcblx0XHRcdFx0cHJpb3JpdHk6IDUwXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fYWN0aXZpdHkudmFsdWUgPSB0aGlzLmFjdGl2aXR5U2VydmljZS5zaG93Vmlld0FjdGl2aXR5KHRoaXMuaWQsIGFjdGl2aXR5KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fYWN0aXZpdHkuY2xlYXIoKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgY2FuU2VsZWN0TWFueSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY2FuU2VsZWN0TWFueTtcblx0fVxuXG5cdHNldCBjYW5TZWxlY3RNYW55KGNhblNlbGVjdE1hbnk6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBvbGRDYW5TZWxlY3RNYW55ID0gdGhpcy5fY2FuU2VsZWN0TWFueTtcblx0XHR0aGlzLl9jYW5TZWxlY3RNYW55ID0gY2FuU2VsZWN0TWFueTtcblx0XHRpZiAodGhpcy5fY2FuU2VsZWN0TWFueSAhPT0gb2xkQ2FuU2VsZWN0TWFueSkge1xuXHRcdFx0dGhpcy50cmVlPy51cGRhdGVPcHRpb25zKHsgbXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0OiB0aGlzLmNhblNlbGVjdE1hbnkgfSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IG1hbnVhbGx5TWFuYWdlQ2hlY2tib3hlcygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fbWFudWFsbHlNYW5hZ2VDaGVja2JveGVzO1xuXHR9XG5cblx0c2V0IG1hbnVhbGx5TWFuYWdlQ2hlY2tib3hlcyhtYW51YWxseU1hbmFnZUNoZWNrYm94ZXM6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9tYW51YWxseU1hbmFnZUNoZWNrYm94ZXMgPSBtYW51YWxseU1hbmFnZUNoZWNrYm94ZXM7XG5cdH1cblxuXHRnZXQgaGFzSWNvbkZvclBhcmVudE5vZGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2hhc0ljb25Gb3JQYXJlbnROb2RlO1xuXHR9XG5cblx0Z2V0IGhhc0ljb25Gb3JMZWFmTm9kZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faGFzSWNvbkZvckxlYWZOb2RlO1xuXHR9XG5cblx0Z2V0IHZpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaXNWaXNpYmxlO1xuXHR9XG5cblx0cHJpdmF0ZSBpbml0aWFsaXplU2hvd0NvbGxhcHNlQWxsQWN0aW9uKHN0YXJ0aW5nVmFsdWU6IGJvb2xlYW4gPSBmYWxzZSkge1xuXHRcdGlmICghdGhpcy5jb2xsYXBzZUFsbENvbnRleHQpIHtcblx0XHRcdHRoaXMuY29sbGFwc2VBbGxDb250ZXh0S2V5ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oYHRyZWVWaWV3LiR7dGhpcy5pZH0uZW5hYmxlQ29sbGFwc2VBbGxgLCBzdGFydGluZ1ZhbHVlLCBsb2NhbGl6ZSgndHJlZVZpZXcuZW5hYmxlQ29sbGFwc2VBbGwnLCBcIldoZXRoZXIgdGhlIHRyZWUgdmlldyB3aXRoIGlkIHswfSBlbmFibGVzIGNvbGxhcHNlIGFsbC5cIiwgdGhpcy5pZCkpO1xuXHRcdFx0dGhpcy5jb2xsYXBzZUFsbENvbnRleHQgPSB0aGlzLmNvbGxhcHNlQWxsQ29udGV4dEtleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Z2V0IHNob3dDb2xsYXBzZUFsbEFjdGlvbigpOiBib29sZWFuIHtcblx0XHR0aGlzLmluaXRpYWxpemVTaG93Q29sbGFwc2VBbGxBY3Rpb24oKTtcblx0XHRyZXR1cm4gISF0aGlzLmNvbGxhcHNlQWxsQ29udGV4dD8uZ2V0KCk7XG5cdH1cblxuXHRzZXQgc2hvd0NvbGxhcHNlQWxsQWN0aW9uKHNob3dDb2xsYXBzZUFsbEFjdGlvbjogYm9vbGVhbikge1xuXHRcdHRoaXMuaW5pdGlhbGl6ZVNob3dDb2xsYXBzZUFsbEFjdGlvbihzaG93Q29sbGFwc2VBbGxBY3Rpb24pO1xuXHRcdHRoaXMuY29sbGFwc2VBbGxDb250ZXh0Py5zZXQoc2hvd0NvbGxhcHNlQWxsQWN0aW9uKTtcblx0fVxuXG5cblx0cHJpdmF0ZSBpbml0aWFsaXplU2hvd1JlZnJlc2hBY3Rpb24oc3RhcnRpbmdWYWx1ZTogYm9vbGVhbiA9IGZhbHNlKSB7XG5cdFx0aWYgKCF0aGlzLnJlZnJlc2hDb250ZXh0KSB7XG5cdFx0XHR0aGlzLnJlZnJlc2hDb250ZXh0S2V5ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oYHRyZWVWaWV3LiR7dGhpcy5pZH0uZW5hYmxlUmVmcmVzaGAsIHN0YXJ0aW5nVmFsdWUsIGxvY2FsaXplKCd0cmVlVmlldy5lbmFibGVSZWZyZXNoJywgXCJXaGV0aGVyIHRoZSB0cmVlIHZpZXcgd2l0aCBpZCB7MH0gZW5hYmxlcyByZWZyZXNoLlwiLCB0aGlzLmlkKSk7XG5cdFx0XHR0aGlzLnJlZnJlc2hDb250ZXh0ID0gdGhpcy5yZWZyZXNoQ29udGV4dEtleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHNob3dSZWZyZXNoQWN0aW9uKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuaW5pdGlhbGl6ZVNob3dSZWZyZXNoQWN0aW9uKCk7XG5cdFx0cmV0dXJuICEhdGhpcy5yZWZyZXNoQ29udGV4dD8uZ2V0KCk7XG5cdH1cblxuXHRzZXQgc2hvd1JlZnJlc2hBY3Rpb24oc2hvd1JlZnJlc2hBY3Rpb246IGJvb2xlYW4pIHtcblx0XHR0aGlzLmluaXRpYWxpemVTaG93UmVmcmVzaEFjdGlvbihzaG93UmVmcmVzaEFjdGlvbik7XG5cdFx0dGhpcy5yZWZyZXNoQ29udGV4dD8uc2V0KHNob3dSZWZyZXNoQWN0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJBY3Rpb25zKCkge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb25zLnRyZWVWaWV3LiR7dGhhdC5pZH0ucmVmcmVzaGAsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdyZWZyZXNoJywgXCJSZWZyZXNoXCIpLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIHRoYXQuaWQpLCB0aGF0LnJlZnJlc2hDb250ZXh0S2V5KSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHRvcmRlcjogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIgLSAxLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5yZWZyZXNoXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5yZWZyZXNoKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb25zLnRyZWVWaWV3LiR7dGhhdC5pZH0uY29sbGFwc2VBbGxgLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY29sbGFwc2VBbGwnLCBcIkNvbGxhcHNlIEFsbFwiKSxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCB0aGF0LmlkKSwgdGhhdC5jb2xsYXBzZUFsbENvbnRleHRLZXkpLFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRcdG9yZGVyOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogdGhhdC5jb2xsYXBzZUFsbFRvZ2dsZUNvbnRleHRLZXksXG5cdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5jb2xsYXBzZUFsbFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0aWYgKHRoYXQudHJlZSkge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQ29sbGFwc2VBbGxBY3Rpb248SVRyZWVJdGVtLCBJVHJlZUl0ZW0sIEZ1enp5U2NvcmU+KHRoYXQudHJlZSwgdHJ1ZSkucnVuKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRzZXRWaXNpYmlsaXR5KGlzVmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdC8vIFRocm91Z2hvdXQgc2V0VmlzaWJpbGl0eSB3ZSBuZWVkIHRvIGNoZWNrIGlmIHRoZSB0cmVlIHZpZXcncyBkYXRhIHByb3ZpZGVyIHN0aWxsIGV4aXN0cy5cblx0XHQvLyBUaGlzIGNhbiBoYXBwZW4gYmVjYXVzZSB0aGUgYGdldENoaWxkcmVuYCBjYWxsIHRvIHRoZSBleHRlbnNpb24gY2FuIHJldHVyblxuXHRcdC8vIGFmdGVyIHRoZSB0cmVlIGhhcyBiZWVuIGRpc3Bvc2VkLlxuXG5cdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdFx0aXNWaXNpYmxlID0gISFpc1Zpc2libGU7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlID09PSBpc1Zpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmlzVmlzaWJsZSA9IGlzVmlzaWJsZTtcblxuXHRcdGlmICh0aGlzLnRyZWUpIHtcblx0XHRcdGlmICh0aGlzLmlzVmlzaWJsZSkge1xuXHRcdFx0XHRET00uc2hvdyh0aGlzLnRyZWUuZ2V0SFRNTEVsZW1lbnQoKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRET00uaGlkZSh0aGlzLnRyZWUuZ2V0SFRNTEVsZW1lbnQoKSk7IC8vIG1ha2Ugc3VyZSB0aGUgdHJlZSBnb2VzIG91dCBvZiB0aGUgdGFiaW5kZXggd29ybGQgYnkgaGlkaW5nIGl0XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmlzVmlzaWJsZSAmJiB0aGlzLmVsZW1lbnRzVG9SZWZyZXNoLmxlbmd0aCAmJiB0aGlzLmRhdGFQcm92aWRlcikge1xuXHRcdFx0XHR0aGlzLmRvUmVmcmVzaCh0aGlzLmVsZW1lbnRzVG9SZWZyZXNoKTtcblx0XHRcdFx0dGhpcy5lbGVtZW50c1RvUmVmcmVzaCA9IFtdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHNldFRpbWVvdXQwKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmRhdGFQcm92aWRlcikge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZpc2liaWxpdHkuZmlyZSh0aGlzLmlzVmlzaWJsZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy52aXNpYmxlKSB7XG5cdFx0XHR0aGlzLmFjdGl2YXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGFjdGl2YXRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgYWN0aXZhdGUoKTogdm9pZDtcblxuXHRmb2N1cyhyZXZlYWw6IGJvb2xlYW4gPSB0cnVlLCByZXZlYWxJdGVtPzogSVRyZWVJdGVtKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMudHJlZSAmJiB0aGlzLnJvb3QuY2hpbGRyZW4gJiYgdGhpcy5yb290LmNoaWxkcmVuLmxlbmd0aCA+IDApIHtcblx0XHRcdC8vIE1ha2Ugc3VyZSB0aGUgY3VycmVudCBzZWxlY3RlZCBlbGVtZW50IGlzIHJldmVhbGVkXG5cdFx0XHRjb25zdCBlbGVtZW50ID0gcmV2ZWFsSXRlbSA/PyB0aGlzLnRyZWUuZ2V0U2VsZWN0aW9uKClbMF07XG5cdFx0XHRpZiAoZWxlbWVudCAmJiByZXZlYWwpIHtcblx0XHRcdFx0dGhpcy50cmVlLnJldmVhbChlbGVtZW50LCAwLjUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBQYXNzIEZvY3VzIHRvIFZpZXdlclxuXHRcdFx0dGhpcy50cmVlLmRvbUZvY3VzKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnRyZWUgJiYgdGhpcy50cmVlQ29udGFpbmVyICYmICF0aGlzLnRyZWVDb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdoaWRlJykpIHtcblx0XHRcdHRoaXMudHJlZS5kb21Gb2N1cygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRzaG93KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250YWluZXIgPSBjb250YWluZXI7XG5cdFx0RE9NLmFwcGVuZChjb250YWluZXIsIHRoaXMuZG9tTm9kZSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZSgpIHtcblx0XHR0aGlzLmRvbU5vZGUgPSBET00uJCgnLnRyZWUtZXhwbG9yZXItdmlld2xldC10cmVlLXZpZXcnKTtcblx0XHR0aGlzLm1lc3NhZ2VFbGVtZW50ID0gRE9NLmFwcGVuZCh0aGlzLmRvbU5vZGUsIERPTS4kKCcubWVzc2FnZScpKTtcblx0XHR0aGlzLnVwZGF0ZU1lc3NhZ2UoKTtcblx0XHR0aGlzLnRyZWVDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuZG9tTm9kZSwgRE9NLiQoJy5jdXN0b212aWV3LXRyZWUnKSk7XG5cdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2ZpbGUtaWNvbi10aGVtYWJsZS10cmVlJywgJ3Nob3ctZmlsZS1pY29ucycpO1xuXHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKERPTS50cmFja0ZvY3VzKHRoaXMuZG9tTm9kZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHRoaXMuZm9jdXNlZCA9IHRydWUpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihmb2N1c1RyYWNrZXIub25EaWRCbHVyKCgpID0+IHRoaXMuZm9jdXNlZCA9IGZhbHNlKSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHRyZWVEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJvdGVjdGVkIGNyZWF0ZVRyZWUoKSB7XG5cdFx0dGhpcy50cmVlRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRjb25zdCBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyID0gY3JlYXRlQWN0aW9uVmlld0l0ZW0uYmluZCh1bmRlZmluZWQsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHRyZWVNZW51cyA9IHRoaXMudHJlZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRyZWVNZW51cywgdGhpcy5pZCkpO1xuXHRcdHRoaXMudHJlZUxhYmVscyA9IHRoaXMudHJlZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlTGFiZWxzLCB0aGlzKSk7XG5cdFx0Y29uc3QgZGF0YVNvdXJjZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJlZURhdGFTb3VyY2UsIHRoaXMsIDxUPih0YXNrOiBQcm9taXNlPFQ+KSA9PiB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoeyBsb2NhdGlvbjogdGhpcy5pZCB9LCAoKSA9PiB0YXNrKSk7XG5cdFx0Y29uc3QgYWxpZ25lciA9IHRoaXMudHJlZURpc3Bvc2FibGVzLmFkZChuZXcgQWxpZ25lcih0aGlzLnRoZW1lU2VydmljZSkpO1xuXHRcdGNvbnN0IGNoZWNrYm94U3RhdGVIYW5kbGVyID0gdGhpcy50cmVlRGlzcG9zYWJsZXMuYWRkKG5ldyBDaGVja2JveFN0YXRlSGFuZGxlcigpKTtcblx0XHRjb25zdCByZW5kZXJlciA9IHRoaXMudHJlZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRyZWVSZW5kZXJlciwgdGhpcy5pZCwgdHJlZU1lbnVzLCB0aGlzLnRyZWVMYWJlbHMsIGFjdGlvblZpZXdJdGVtUHJvdmlkZXIsIGFsaWduZXIsIGNoZWNrYm94U3RhdGVIYW5kbGVyLCAoKSA9PiB0aGlzLm1hbnVhbGx5TWFuYWdlQ2hlY2tib3hlcykpO1xuXHRcdHRoaXMudHJlZURpc3Bvc2FibGVzLmFkZChyZW5kZXJlci5vbkRpZENoYW5nZUNoZWNrYm94U3RhdGUoZSA9PiB0aGlzLl9vbkRpZENoYW5nZUNoZWNrYm94U3RhdGUuZmlyZShlKSkpO1xuXG5cdFx0Y29uc3Qgd2lkZ2V0QXJpYUxhYmVsID0gdGhpcy5fdGl0bGU7XG5cblx0XHR0aGlzLnRyZWUgPSB0aGlzLnRyZWVEaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUcmVlLCB0aGlzLmlkLCB0aGlzLnRyZWVDb250YWluZXIhLCBuZXcgVHJlZVZpZXdEZWxlZ2F0ZSgpLCBbcmVuZGVyZXJdLFxuXHRcdFx0ZGF0YVNvdXJjZSwge1xuXHRcdFx0aWRlbnRpdHlQcm92aWRlcjogbmV3IFRyZWVWaWV3SWRlbnRpdHlQcm92aWRlcigpLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdGdldEFyaWFMYWJlbChlbGVtZW50OiBJVHJlZUl0ZW0pOiBzdHJpbmcgfCBudWxsIHtcblx0XHRcdFx0XHRpZiAoZWxlbWVudC5hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb24pIHtcblx0XHRcdFx0XHRcdHJldHVybiBlbGVtZW50LmFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbi5sYWJlbDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoaXNTdHJpbmcoZWxlbWVudC50b29sdGlwKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQudG9vbHRpcDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKGVsZW1lbnQucmVzb3VyY2VVcmkgJiYgIWVsZW1lbnQubGFiZWwpIHtcblx0XHRcdFx0XHRcdFx0Ly8gVGhlIGN1c3RvbSB0cmVlIGhhcyBubyBnb29kIGluZm9ybWF0aW9uIG9uIHdoYXQgc2hvdWxkIGJlIHVzZWQgZm9yIHRoZSBhcmlhIGxhYmVsLlxuXHRcdFx0XHRcdFx0XHQvLyBBbGxvdyB0aGUgdHJlZSB3aWRnZXQncyBkZWZhdWx0IGFyaWEgbGFiZWwgdG8gYmUgdXNlZC5cblx0XHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRsZXQgYnVpbGRBcmlhTGFiZWw6IHN0cmluZyA9ICcnO1xuXHRcdFx0XHRcdFx0aWYgKGVsZW1lbnQubGFiZWwpIHtcblx0XHRcdFx0XHRcdFx0YnVpbGRBcmlhTGFiZWwgKz0gZWxlbWVudC5sYWJlbC5sYWJlbCArICcgJztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChlbGVtZW50LmRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0XHRcdGJ1aWxkQXJpYUxhYmVsICs9IGVsZW1lbnQuZGVzY3JpcHRpb247XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gYnVpbGRBcmlhTGFiZWw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRSb2xlKGVsZW1lbnQ6IElUcmVlSXRlbSk6IEFyaWFSb2xlIHwgdW5kZWZpbmVkIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb24/LnJvbGUgPz8gJ3RyZWVpdGVtJztcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0cmV0dXJuIHdpZGdldEFyaWFMYWJlbDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IHtcblx0XHRcdFx0Z2V0S2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWw6IChpdGVtOiBJVHJlZUl0ZW0pID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gaXRlbS5sYWJlbCA/IGl0ZW0ubGFiZWwubGFiZWwgOiAoaXRlbS5yZXNvdXJjZVVyaSA/IGJhc2VuYW1lKFVSSS5yZXZpdmUoaXRlbS5yZXNvdXJjZVVyaSkpIDogdW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGV4cGFuZE9ubHlPblR3aXN0aWVDbGljazogKGU6IElUcmVlSXRlbSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gISFlLmNvbW1hbmQgfHwgISFlLmNoZWNrYm94IHx8IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J3NpbmdsZUNsaWNrJyB8ICdkb3VibGVDbGljayc+KCd3b3JrYmVuY2gudHJlZS5leHBhbmRNb2RlJykgPT09ICdkb3VibGVDbGljayc7XG5cdFx0XHR9LFxuXHRcdFx0Y29sbGFwc2VCeURlZmF1bHQ6IChlOiBJVHJlZUl0ZW0pOiBib29sZWFuID0+IHtcblx0XHRcdFx0cmV0dXJuIGUuY29sbGFwc2libGVTdGF0ZSAhPT0gVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLkV4cGFuZGVkO1xuXHRcdFx0fSxcblx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogdGhpcy5jYW5TZWxlY3RNYW55LFxuXHRcdFx0ZG5kOiB0aGlzLnRyZWVWaWV3RG5kLFxuXHRcdFx0b3ZlcnJpZGVTdHlsZXM6IGdldExvY2F0aW9uQmFzZWRWaWV3Q29sb3JzKHRoaXMudmlld0xvY2F0aW9uKS5saXN0T3ZlcnJpZGVTdHlsZXNcblx0XHR9KSBhcyBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElUcmVlSXRlbSwgSVRyZWVJdGVtLCBGdXp6eVNjb3JlPik7XG5cblx0XHR0aGlzLnRyZWVEaXNwb3NhYmxlcy5hZGQocmVuZGVyZXIub25EaWRDaGFuZ2VNZW51Q29udGV4dChlID0+IGUuZm9yRWFjaChlID0+IHRoaXMudHJlZT8ucmVyZW5kZXIoZSkpKSk7XG5cblx0XHR0aGlzLnRyZWVEaXNwb3NhYmxlcy5hZGQodGhpcy50cmVlKTtcblx0XHR0cmVlTWVudXMuc2V0Q29udGV4dEtleVNlcnZpY2UodGhpcy50cmVlLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRhbGlnbmVyLnRyZWUgPSB0aGlzLnRyZWU7XG5cdFx0Y29uc3QgYWN0aW9uUnVubmVyID0gdGhpcy50cmVlRGlzcG9zYWJsZXMuYWRkKG5ldyBNdWx0aXBsZVNlbGVjdGlvbkFjdGlvblJ1bm5lcih0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UsICgpID0+IHRoaXMudHJlZSEuZ2V0U2VsZWN0aW9uKCkpKTtcblx0XHRyZW5kZXJlci5hY3Rpb25SdW5uZXIgPSBhY3Rpb25SdW5uZXI7XG5cblx0XHR0aGlzLnRyZWUuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5PGJvb2xlYW4+KHRoaXMuaWQsIHRydWUpO1xuXHRcdGNvbnN0IGN1c3RvbVRyZWVLZXkgPSBSYXdDdXN0b21UcmVlVmlld0NvbnRleHRLZXkuYmluZFRvKHRoaXMudHJlZS5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y3VzdG9tVHJlZUtleS5zZXQodHJ1ZSk7XG5cdFx0dGhpcy50cmVlRGlzcG9zYWJsZXMuYWRkKHRoaXMudHJlZS5vbkNvbnRleHRNZW51KGUgPT4gdGhpcy5vbkNvbnRleHRNZW51KHRyZWVNZW51cywgZSwgYWN0aW9uUnVubmVyKSkpO1xuXG5cdFx0dGhpcy50cmVlRGlzcG9zYWJsZXMuYWRkKHRoaXMudHJlZS5vbkRpZENoYW5nZVNlbGVjdGlvbihlID0+IHtcblx0XHRcdHRoaXMubGFzdFNlbGVjdGlvbiA9IGUuZWxlbWVudHM7XG5cdFx0XHR0aGlzLmxhc3RBY3RpdmUgPSB0aGlzLnRyZWU/LmdldEZvY3VzKClbMF0gPz8gdGhpcy5sYXN0QWN0aXZlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb25BbmRGb2N1cy5maXJlKHsgc2VsZWN0aW9uOiB0aGlzLmxhc3RTZWxlY3Rpb24sIGZvY3VzOiB0aGlzLmxhc3RBY3RpdmUgfSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMudHJlZURpc3Bvc2FibGVzLmFkZCh0aGlzLnRyZWUub25EaWRDaGFuZ2VGb2N1cyhlID0+IHtcblx0XHRcdGlmIChlLmVsZW1lbnRzLmxlbmd0aCAmJiAoZS5lbGVtZW50c1swXSAhPT0gdGhpcy5sYXN0QWN0aXZlKSkge1xuXHRcdFx0XHR0aGlzLmxhc3RBY3RpdmUgPSBlLmVsZW1lbnRzWzBdO1xuXHRcdFx0XHR0aGlzLmxhc3RTZWxlY3Rpb24gPSB0aGlzLnRyZWU/LmdldFNlbGVjdGlvbigpID8/IHRoaXMubGFzdFNlbGVjdGlvbjtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb25BbmRGb2N1cy5maXJlKHsgc2VsZWN0aW9uOiB0aGlzLmxhc3RTZWxlY3Rpb24sIGZvY3VzOiB0aGlzLmxhc3RBY3RpdmUgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudHJlZURpc3Bvc2FibGVzLmFkZCh0aGlzLnRyZWUub25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKGUgPT4ge1xuXHRcdFx0aWYgKCFlLm5vZGUuZWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVsZW1lbnQ6IElUcmVlSXRlbSA9IEFycmF5LmlzQXJyYXkoZS5ub2RlLmVsZW1lbnQuZWxlbWVudCkgPyBlLm5vZGUuZWxlbWVudC5lbGVtZW50WzBdIDogZS5ub2RlLmVsZW1lbnQuZWxlbWVudDtcblx0XHRcdGlmIChlLm5vZGUuY29sbGFwc2VkKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ29sbGFwc2VJdGVtLmZpcmUoZWxlbWVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9vbkRpZEV4cGFuZEl0ZW0uZmlyZShlbGVtZW50KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50cmVlLnNldElucHV0KHRoaXMucm9vdCkudGhlbigoKSA9PiB0aGlzLnVwZGF0ZUNvbnRlbnRBcmVhcygpKTtcblxuXHRcdHRoaXMudHJlZURpc3Bvc2FibGVzLmFkZCh0aGlzLnRyZWUub25EaWRPcGVuKGFzeW5jIChlKSA9PiB7XG5cdFx0XHRpZiAoIWUuYnJvd3NlckV2ZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChlLmJyb3dzZXJFdmVudC50YXJnZXQgJiYgKGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xhc3NMaXN0LmNvbnRhaW5zKFRyZWVJdGVtQ2hlY2tib3guY2hlY2tib3hDbGFzcykpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy50cmVlIS5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdGNvbnN0IGNvbW1hbmQgPSBhd2FpdCB0aGlzLnJlc29sdmVDb21tYW5kKHNlbGVjdGlvbi5sZW5ndGggPT09IDEgPyBzZWxlY3Rpb25bMF0gOiB1bmRlZmluZWQpO1xuXG5cdFx0XHRpZiAoY29tbWFuZCAmJiBpc1RyZWVDb21tYW5kRW5hYmxlZChjb21tYW5kLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKSkge1xuXHRcdFx0XHRsZXQgYXJncyA9IGNvbW1hbmQuYXJndW1lbnRzIHx8IFtdO1xuXHRcdFx0XHRpZiAoY29tbWFuZC5pZCA9PT0gQVBJX09QRU5fRURJVE9SX0NPTU1BTkRfSUQgfHwgY29tbWFuZC5pZCA9PT0gQVBJX09QRU5fRElGRl9FRElUT1JfQ09NTUFORF9JRCkge1xuXHRcdFx0XHRcdC8vIFNvbWUgY29tbWFuZHMgb3duZWQgYnkgdXMgc2hvdWxkIHJlY2VpdmUgdGhlXG5cdFx0XHRcdFx0Ly8gYElPcGVuRXZlbnRgIGFzIGNvbnRleHQgdG8gb3BlbiBwcm9wZXJseVxuXHRcdFx0XHRcdGFyZ3MgPSBbLi4uYXJncywgZV07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZC5pZCwgLi4uYXJncyk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy50cmVlRGlzcG9zYWJsZXMuYWRkKHRyZWVNZW51cy5vbkRpZENoYW5nZSgoY2hhbmdlZCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMudHJlZT8uaGFzTm9kZShjaGFuZ2VkKSkge1xuXHRcdFx0XHR0aGlzLnRyZWU/LnJlcmVuZGVyKGNoYW5nZWQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUNvbW1hbmQoZWxlbWVudDogSVRyZWVJdGVtIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxUcmVlQ29tbWFuZCB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCBjb21tYW5kID0gZWxlbWVudD8uY29tbWFuZDtcblx0XHRpZiAoZWxlbWVudCAmJiAhY29tbWFuZCkge1xuXHRcdFx0aWYgKChlbGVtZW50IGluc3RhbmNlb2YgUmVzb2x2YWJsZVRyZWVJdGVtKSAmJiBlbGVtZW50Lmhhc1Jlc29sdmUpIHtcblx0XHRcdFx0YXdhaXQgZWxlbWVudC5yZXNvbHZlKENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRjb21tYW5kID0gZWxlbWVudC5jb21tYW5kO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gY29tbWFuZDtcblx0fVxuXG5cdHByaXZhdGUgb25Db250ZXh0TWVudSh0cmVlTWVudXM6IFRyZWVNZW51cywgdHJlZUV2ZW50OiBJVHJlZUNvbnRleHRNZW51RXZlbnQ8SVRyZWVJdGVtPiwgYWN0aW9uUnVubmVyOiBNdWx0aXBsZVNlbGVjdGlvbkFjdGlvblJ1bm5lcik6IHZvaWQge1xuXHRcdHRoaXMuaG92ZXJTZXJ2aWNlLmhpZGVIb3ZlcigpO1xuXHRcdGNvbnN0IG5vZGU6IElUcmVlSXRlbSB8IG51bGwgPSB0cmVlRXZlbnQuZWxlbWVudDtcblx0XHRpZiAobm9kZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBldmVudDogVUlFdmVudCA9IHRyZWVFdmVudC5icm93c2VyRXZlbnQ7XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0dGhpcy50cmVlIS5zZXRGb2N1cyhbbm9kZV0pO1xuXHRcdGxldCBzZWxlY3RlZCA9IHRoaXMuY2FuU2VsZWN0TWFueSA/IHRoaXMuZ2V0U2VsZWN0aW9uKCkgOiBbXTtcblx0XHRpZiAoIXNlbGVjdGVkLmZpbmQoaXRlbSA9PiBpdGVtLmhhbmRsZSA9PT0gbm9kZS5oYW5kbGUpKSB7XG5cdFx0XHRzZWxlY3RlZCA9IFtub2RlXTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3Rpb25zID0gdHJlZU1lbnVzLmdldFJlc291cmNlQ29udGV4dEFjdGlvbnMoc2VsZWN0ZWQpO1xuXHRcdGlmICghYWN0aW9ucy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gdHJlZUV2ZW50LmFuY2hvcixcblxuXHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyxcblxuXHRcdFx0Z2V0QWN0aW9uVmlld0l0ZW06IChhY3Rpb24pID0+IHtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uaWQpO1xuXHRcdFx0XHRpZiAoa2V5YmluZGluZykge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQWN0aW9uVmlld0l0ZW0oYWN0aW9uLCBhY3Rpb24sIHsgbGFiZWw6IHRydWUsIGtleWJpbmRpbmc6IGtleWJpbmRpbmcuZ2V0TGFiZWwoKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblxuXHRcdFx0b25IaWRlOiAod2FzQ2FuY2VsbGVkPzogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHRpZiAod2FzQ2FuY2VsbGVkKSB7XG5cdFx0XHRcdFx0dGhpcy50cmVlIS5kb21Gb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gKHsgJHRyZWVWaWV3SWQ6IHRoaXMuaWQsICR0cmVlSXRlbUhhbmRsZTogbm9kZS5oYW5kbGUgfSBzYXRpc2ZpZXMgVHJlZVZpZXdJdGVtSGFuZGxlQXJnKSxcblxuXHRcdFx0YWN0aW9uUnVubmVyXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlTWVzc2FnZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fbWVzc2FnZSkge1xuXHRcdFx0dGhpcy5zaG93TWVzc2FnZSh0aGlzLl9tZXNzYWdlKTtcblx0XHR9IGVsc2UgaWYgKCF0aGlzLmRhdGFQcm92aWRlcikge1xuXHRcdFx0dGhpcy5zaG93TWVzc2FnZShub0RhdGFQcm92aWRlck1lc3NhZ2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmhpZGVNZXNzYWdlKCk7XG5cdFx0fVxuXHRcdHRoaXMudXBkYXRlQ29udGVudEFyZWFzKCk7XG5cdH1cblxuXHRwcml2YXRlIHByb2Nlc3NNZXNzYWdlKG1lc3NhZ2U6IElNYXJrZG93blN0cmluZywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBsaW5lcyA9IG1lc3NhZ2UudmFsdWUuc3BsaXQoJ1xcbicpO1xuXHRcdGNvbnN0IHJlc3VsdDogKElNYXJrZG93blJlbmRlclJlc3VsdCB8IEhUTUxFbGVtZW50KVtdID0gW107XG5cdFx0bGV0IGhhc0ZvdW5kQnV0dG9uID0gZmFsc2U7XG5cdFx0Zm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG5cdFx0XHRjb25zdCBsaW5rZWRUZXh0ID0gcGFyc2VMaW5rZWRUZXh0KGxpbmUpO1xuXG5cdFx0XHRpZiAobGlua2VkVGV4dC5ub2Rlcy5sZW5ndGggPT09IDEgJiYgdHlwZW9mIGxpbmtlZFRleHQubm9kZXNbMF0gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbnN0IG5vZGUgPSBsaW5rZWRUZXh0Lm5vZGVzWzBdO1xuXHRcdFx0XHRjb25zdCBidXR0b25Db250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0YnV0dG9uQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2J1dHRvbi1jb250YWluZXInKTtcblx0XHRcdFx0Y29uc3QgYnV0dG9uID0gbmV3IEJ1dHRvbihidXR0b25Db250YWluZXIsIHsgdGl0bGU6IG5vZGUudGl0bGUsIHNlY29uZGFyeTogaGFzRm91bmRCdXR0b24sIHN1cHBvcnRJY29uczogdHJ1ZSwgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KTtcblx0XHRcdFx0YnV0dG9uLmxhYmVsID0gbm9kZS5sYWJlbDtcblx0XHRcdFx0YnV0dG9uLm9uRGlkQ2xpY2soXyA9PiB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4obm9kZS5ocmVmLCB7IGFsbG93Q29tbWFuZHM6IHRydWUgfSk7XG5cdFx0XHRcdH0sIG51bGwsIGRpc3Bvc2FibGVzKTtcblxuXHRcdFx0XHRjb25zdCBocmVmID0gVVJJLnBhcnNlKG5vZGUuaHJlZik7XG5cdFx0XHRcdGlmIChocmVmLnNjaGVtZSA9PT0gU2NoZW1hcy5jb21tYW5kKSB7XG5cdFx0XHRcdFx0Y29uc3QgcHJlQ29uZGl0aW9ucyA9IGNvbW1hbmRQcmVjb25kaXRpb25zKGhyZWYucGF0aCk7XG5cdFx0XHRcdFx0aWYgKHByZUNvbmRpdGlvbnMpIHtcblx0XHRcdFx0XHRcdGJ1dHRvbi5lbmFibGVkID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHByZUNvbmRpdGlvbnMpO1xuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMuY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0KGUgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoZS5hZmZlY3RzU29tZShuZXcgU2V0KHByZUNvbmRpdGlvbnMua2V5cygpKSkpIHtcblx0XHRcdFx0XHRcdFx0XHRidXR0b24uZW5hYmxlZCA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyhwcmVDb25kaXRpb25zKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChidXR0b24pO1xuXHRcdFx0XHRoYXNGb3VuZEJ1dHRvbiA9IHRydWU7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGJ1dHRvbkNvbnRhaW5lcik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoYXNGb3VuZEJ1dHRvbiA9IGZhbHNlO1xuXHRcdFx0XHRjb25zdCByZW5kZXJlZCA9IHRoaXMubWFya2Rvd25SZW5kZXJlciEucmVuZGVyKG5ldyBNYXJrZG93blN0cmluZyhsaW5lLCB7IGlzVHJ1c3RlZDogbWVzc2FnZS5pc1RydXN0ZWQsIHN1cHBvcnRUaGVtZUljb25zOiBtZXNzYWdlLnN1cHBvcnRUaGVtZUljb25zLCBzdXBwb3J0SHRtbDogbWVzc2FnZS5zdXBwb3J0SHRtbCB9KSk7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHJlbmRlcmVkLmVsZW1lbnQpO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVuZGVyZWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdyZW5kZXJlZC1tZXNzYWdlJyk7XG5cdFx0Zm9yIChjb25zdCBjaGlsZCBvZiByZXN1bHQpIHtcblx0XHRcdGlmIChET00uaXNIVE1MRWxlbWVudChjaGlsZCkpIHtcblx0XHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGNoaWxkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChjaGlsZC5lbGVtZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNvbnRhaW5lcjtcblx0fVxuXG5cdHByaXZhdGUgc2hvd01lc3NhZ2UobWVzc2FnZTogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKGlzUmVuZGVyZWRNZXNzYWdlVmFsdWUodGhpcy5fbWVzc2FnZVZhbHVlKSkge1xuXHRcdFx0dGhpcy5fbWVzc2FnZVZhbHVlLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0aWYgKGlzTWFya2Rvd25TdHJpbmcobWVzc2FnZSkgJiYgIXRoaXMubWFya2Rvd25SZW5kZXJlcikge1xuXHRcdFx0dGhpcy5tYXJrZG93blJlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZG93blJlbmRlcmVyLCB7fSk7XG5cdFx0fVxuXHRcdGlmIChpc01hcmtkb3duU3RyaW5nKG1lc3NhZ2UpKSB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IHJlbmRlcmVkTWVzc2FnZSA9IHRoaXMucHJvY2Vzc01lc3NhZ2UobWVzc2FnZSwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0dGhpcy5fbWVzc2FnZVZhbHVlID0geyBlbGVtZW50OiByZW5kZXJlZE1lc3NhZ2UsIGRpc3Bvc2FibGVzIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX21lc3NhZ2VWYWx1ZSA9IG1lc3NhZ2U7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5tZXNzYWdlRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLm1lc3NhZ2VFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcblx0XHR0aGlzLnJlc2V0TWVzc2FnZUVsZW1lbnQoKTtcblx0XHRpZiAodHlwZW9mIHRoaXMuX21lc3NhZ2VWYWx1ZSA9PT0gJ3N0cmluZycgJiYgIWlzRmFsc3lPcldoaXRlc3BhY2UodGhpcy5fbWVzc2FnZVZhbHVlKSkge1xuXHRcdFx0dGhpcy5tZXNzYWdlRWxlbWVudC50ZXh0Q29udGVudCA9IHRoaXMuX21lc3NhZ2VWYWx1ZTtcblx0XHR9IGVsc2UgaWYgKGlzUmVuZGVyZWRNZXNzYWdlVmFsdWUodGhpcy5fbWVzc2FnZVZhbHVlKSkge1xuXHRcdFx0dGhpcy5tZXNzYWdlRWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl9tZXNzYWdlVmFsdWUuZWxlbWVudCk7XG5cdFx0fVxuXHRcdHRoaXMubGF5b3V0KHRoaXMuX2hlaWdodCwgdGhpcy5fd2lkdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBoaWRlTWVzc2FnZSgpOiB2b2lkIHtcblx0XHR0aGlzLnJlc2V0TWVzc2FnZUVsZW1lbnQoKTtcblx0XHR0aGlzLm1lc3NhZ2VFbGVtZW50Py5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG5cdFx0dGhpcy5sYXlvdXQodGhpcy5faGVpZ2h0LCB0aGlzLl93aWR0aCk7XG5cdH1cblxuXHRwcml2YXRlIHJlc2V0TWVzc2FnZUVsZW1lbnQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubWVzc2FnZUVsZW1lbnQpIHtcblx0XHRcdERPTS5jbGVhck5vZGUodGhpcy5tZXNzYWdlRWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaGVpZ2h0OiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF93aWR0aDogbnVtYmVyID0gMDtcblx0bGF5b3V0KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKSB7XG5cdFx0aWYgKGhlaWdodCAmJiB3aWR0aCAmJiB0aGlzLm1lc3NhZ2VFbGVtZW50ICYmIHRoaXMudHJlZUNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdFx0dGhpcy5fd2lkdGggPSB3aWR0aDtcblx0XHRcdGNvbnN0IHRyZWVIZWlnaHQgPSBoZWlnaHQgLSBET00uZ2V0VG90YWxIZWlnaHQodGhpcy5tZXNzYWdlRWxlbWVudCk7XG5cdFx0XHR0aGlzLnRyZWVDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gdHJlZUhlaWdodCArICdweCc7XG5cdFx0XHR0aGlzLnRyZWU/LmxheW91dCh0cmVlSGVpZ2h0LCB3aWR0aCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0T3B0aW1hbFdpZHRoKCk6IG51bWJlciB7XG5cdFx0aWYgKHRoaXMudHJlZSkge1xuXHRcdFx0Y29uc3QgcGFyZW50Tm9kZSA9IHRoaXMudHJlZS5nZXRIVE1MRWxlbWVudCgpO1xuXHRcdFx0Y29uc3QgY2hpbGROb2RlcyA9IChbXSBhcyBIVE1MRWxlbWVudFtdKS5zbGljZS5jYWxsKHBhcmVudE5vZGUucXVlcnlTZWxlY3RvckFsbCgnLm91dGxpbmUtaXRlbS1sYWJlbCA+IGEnKSk7XG5cdFx0XHRyZXR1cm4gRE9NLmdldExhcmdlc3RDaGlsZFdpZHRoKHBhcmVudE5vZGUsIGNoaWxkTm9kZXMpO1xuXHRcdH1cblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ2hlY2tib3hlcyhlbGVtZW50czogcmVhZG9ubHkgSVRyZWVJdGVtW10pOiBJVHJlZUl0ZW1bXSB7XG5cdFx0cmV0dXJuIHNldENhc2NhZGluZ0NoZWNrYm94VXBkYXRlcyhlbGVtZW50cyk7XG5cdH1cblxuXHRhc3luYyByZWZyZXNoKGVsZW1lbnRzPzogcmVhZG9ubHkgSVRyZWVJdGVtW10sIGNoZWNrYm94ZXM/OiByZWFkb25seSBJVHJlZUl0ZW1bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmRhdGFQcm92aWRlciAmJiB0aGlzLnRyZWUpIHtcblx0XHRcdGlmICh0aGlzLnJlZnJlc2hpbmcpIHtcblx0XHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHRoaXMuX29uRGlkQ29tcGxldGVSZWZyZXNoLmV2ZW50KTtcblx0XHRcdH1cblx0XHRcdGlmICghZWxlbWVudHMpIHtcblx0XHRcdFx0ZWxlbWVudHMgPSBbdGhpcy5yb290XTtcblx0XHRcdFx0Ly8gcmVtb3ZlIGFsbCB3YWl0aW5nIGVsZW1lbnRzIHRvIHJlZnJlc2ggaWYgcm9vdCBpcyBhc2tlZCB0byByZWZyZXNoXG5cdFx0XHRcdHRoaXMuZWxlbWVudHNUb1JlZnJlc2ggPSBbXTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdFx0XHRlbGVtZW50LmNoaWxkcmVuID0gdW5kZWZpbmVkOyAvLyByZXNldCBjaGlsZHJlblxuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuaXNWaXNpYmxlKSB7XG5cdFx0XHRcdGNvbnN0IGFmZmVjdGVkRWxlbWVudHMgPSB0aGlzLnVwZGF0ZUNoZWNrYm94ZXMoY2hlY2tib3hlcyA/PyBbXSk7XG5cdFx0XHRcdHJldHVybiB0aGlzLmRvUmVmcmVzaChlbGVtZW50cy5jb25jYXQoYWZmZWN0ZWRFbGVtZW50cykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHRoaXMuZWxlbWVudHNUb1JlZnJlc2gubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2VlbjogU2V0PHN0cmluZz4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRcdFx0XHR0aGlzLmVsZW1lbnRzVG9SZWZyZXNoLmZvckVhY2goZWxlbWVudCA9PiBzZWVuLmFkZChlbGVtZW50LmhhbmRsZSkpO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdFx0XHRcdFx0aWYgKCFzZWVuLmhhcyhlbGVtZW50LmhhbmRsZSkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5lbGVtZW50c1RvUmVmcmVzaC5wdXNoKGVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmVsZW1lbnRzVG9SZWZyZXNoLnB1c2goLi4uZWxlbWVudHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBleHBhbmQoaXRlbU9ySXRlbXM6IElUcmVlSXRlbSB8IElUcmVlSXRlbVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdHJlZSA9IHRoaXMudHJlZTtcblx0XHRpZiAoIXRyZWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGl0ZW1Pckl0ZW1zID0gQXJyYXkuaXNBcnJheShpdGVtT3JJdGVtcykgPyBpdGVtT3JJdGVtcyA6IFtpdGVtT3JJdGVtc107XG5cdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgaXRlbU9ySXRlbXMpIHtcblx0XHRcdFx0YXdhaXQgdHJlZS5leHBhbmQoZWxlbWVudCwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIFRoZSBleHRlbnNpb24gY291bGQgaGF2ZSBjaGFuZ2VkIHRoZSB0cmVlIGR1cmluZyB0aGUgcmV2ZWFsLlxuXHRcdFx0Ly8gQmVjYXVzZSBvZiB0aGF0LCB3ZSBpZ25vcmUgZXJyb3JzLlxuXHRcdH1cblx0fVxuXG5cdGlzQ29sbGFwc2VkKGl0ZW06IElUcmVlSXRlbSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMudHJlZT8uaXNDb2xsYXBzZWQoaXRlbSk7XG5cdH1cblxuXHRzZXRTZWxlY3Rpb24oaXRlbXM6IElUcmVlSXRlbVtdKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlPy5zZXRTZWxlY3Rpb24oaXRlbXMpO1xuXHR9XG5cblx0Z2V0U2VsZWN0aW9uKCk6IElUcmVlSXRlbVtdIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlPy5nZXRTZWxlY3Rpb24oKSA/PyBbXTtcblx0fVxuXG5cdHNldEZvY3VzKGl0ZW0/OiBJVHJlZUl0ZW0pOiB2b2lkIHtcblx0XHRpZiAodGhpcy50cmVlKSB7XG5cdFx0XHRpZiAoaXRlbSkge1xuXHRcdFx0XHR0aGlzLmZvY3VzKHRydWUsIGl0ZW0pO1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0Rm9jdXMoW2l0ZW1dKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy50cmVlLmdldEZvY3VzKCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHRoaXMudHJlZS5zZXRGb2N1cyhbXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmV2ZWFsKGl0ZW06IElUcmVlSXRlbSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLnRyZWUpIHtcblx0XHRcdHJldHVybiB0aGlzLnRyZWUucmV2ZWFsKGl0ZW0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaGluZzogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIGFzeW5jIGRvUmVmcmVzaChlbGVtZW50czogcmVhZG9ubHkgSVRyZWVJdGVtW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0cmVlID0gdGhpcy50cmVlO1xuXHRcdGlmICh0cmVlICYmIHRoaXMudmlzaWJsZSkge1xuXHRcdFx0dGhpcy5yZWZyZXNoaW5nID0gdHJ1ZTtcblx0XHRcdGNvbnN0IG9sZFNlbGVjdGlvbiA9IHRyZWUuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChlbGVtZW50cy5tYXAoZWxlbWVudCA9PiB0cmVlLnVwZGF0ZUNoaWxkcmVuKGVsZW1lbnQsIHRydWUsIHRydWUpKSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIFdoZW4gbXVsdGlwbGUgY2FsbHMgYXJlIG1hZGUgdG8gcmVmcmVzaCB0aGUgdHJlZSBpbiBxdWljayBzdWNjZXNzaW9uLFxuXHRcdFx0XHQvLyB3ZSBjYW4gZ2V0IGEgXCJUcmVlIGVsZW1lbnQgbm90IGZvdW5kXCIgZXJyb3IuIFRoaXMgaXMgZXhwZWN0ZWQuXG5cdFx0XHRcdC8vIElkZWFsbHkgdGhpcyBpcyBmaXhhYmxlLCBzbyBsb2cgaW5zdGVhZCBvZiBpZ25vcmluZyBzbyB0aGUgZXJyb3IgaXMgcHJlc2VydmVkLlxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBuZXdTZWxlY3Rpb24gPSB0cmVlLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0aWYgKG9sZFNlbGVjdGlvbi5sZW5ndGggIT09IG5ld1NlbGVjdGlvbi5sZW5ndGggfHwgb2xkU2VsZWN0aW9uLnNvbWUoKHZhbHVlLCBpbmRleCkgPT4gdmFsdWUuaGFuZGxlICE9PSBuZXdTZWxlY3Rpb25baW5kZXhdLmhhbmRsZSkpIHtcblx0XHRcdFx0dGhpcy5sYXN0U2VsZWN0aW9uID0gbmV3U2VsZWN0aW9uO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbkFuZEZvY3VzLmZpcmUoeyBzZWxlY3Rpb246IHRoaXMubGFzdFNlbGVjdGlvbiwgZm9jdXM6IHRoaXMubGFzdEFjdGl2ZSB9KTtcblx0XHRcdH1cblx0XHRcdHRoaXMucmVmcmVzaGluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5fb25EaWRDb21wbGV0ZVJlZnJlc2guZmlyZSgpO1xuXHRcdFx0dGhpcy51cGRhdGVDb250ZW50QXJlYXMoKTtcblx0XHRcdGlmICh0aGlzLmZvY3VzZWQpIHtcblx0XHRcdFx0dGhpcy5mb2N1cyhmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZUNvbGxhcHNlQWxsVG9nZ2xlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpbml0aWFsaXplQ29sbGFwc2VBbGxUb2dnbGUoKSB7XG5cdFx0aWYgKCF0aGlzLmNvbGxhcHNlQWxsVG9nZ2xlQ29udGV4dCkge1xuXHRcdFx0dGhpcy5jb2xsYXBzZUFsbFRvZ2dsZUNvbnRleHRLZXkgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPihgdHJlZVZpZXcuJHt0aGlzLmlkfS50b2dnbGVDb2xsYXBzZUFsbGAsIGZhbHNlLCBsb2NhbGl6ZSgndHJlZVZpZXcudG9nZ2xlQ29sbGFwc2VBbGwnLCBcIldoZXRoZXIgY29sbGFwc2UgYWxsIGlzIHRvZ2dsZWQgZm9yIHRoZSB0cmVlIHZpZXcgd2l0aCBpZCB7MH0uXCIsIHRoaXMuaWQpKTtcblx0XHRcdHRoaXMuY29sbGFwc2VBbGxUb2dnbGVDb250ZXh0ID0gdGhpcy5jb2xsYXBzZUFsbFRvZ2dsZUNvbnRleHRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29sbGFwc2VBbGxUb2dnbGUoKSB7XG5cdFx0aWYgKHRoaXMuc2hvd0NvbGxhcHNlQWxsQWN0aW9uKSB7XG5cdFx0XHR0aGlzLmluaXRpYWxpemVDb2xsYXBzZUFsbFRvZ2dsZSgpO1xuXHRcdFx0dGhpcy5jb2xsYXBzZUFsbFRvZ2dsZUNvbnRleHQ/LnNldCghIXRoaXMucm9vdC5jaGlsZHJlbiAmJiAodGhpcy5yb290LmNoaWxkcmVuLmxlbmd0aCA+IDApICYmXG5cdFx0XHRcdHRoaXMucm9vdC5jaGlsZHJlbi5zb21lKHZhbHVlID0+IHZhbHVlLmNvbGxhcHNpYmxlU3RhdGUgIT09IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Ob25lKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb250ZW50QXJlYXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgaXNUcmVlRW1wdHkgPSAhdGhpcy5yb290LmNoaWxkcmVuIHx8IHRoaXMucm9vdC5jaGlsZHJlbi5sZW5ndGggPT09IDA7XG5cdFx0Ly8gSGlkZSB0cmVlIGNvbnRhaW5lciBvbmx5IHdoZW4gdGhlcmUgaXMgYSBtZXNzYWdlIGFuZCB0cmVlIGlzIGVtcHR5IGFuZCBub3QgcmVmcmVzaGluZ1xuXHRcdGlmICh0aGlzLl9tZXNzYWdlVmFsdWUgJiYgaXNUcmVlRW1wdHkgJiYgIXRoaXMucmVmcmVzaGluZyAmJiB0aGlzLnRyZWVDb250YWluZXIpIHtcblx0XHRcdC8vIElmIHRoZXJlJ3MgYSBkbmQgY29udHJvbGxlciB0aGVuIGhpZGluZyB0aGUgdHJlZSBwcmV2ZW50cyBpdCBmcm9tIGJlaW5nIGRyYWdnZWQgaW50by5cblx0XHRcdGlmICghdGhpcy5kcmFnQW5kRHJvcENvbnRyb2xsZXIpIHtcblx0XHRcdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMudHJlZUNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcblx0XHRcdGlmICh0aGlzLmRvbU5vZGUgPT09IERPTS5nZXRBY3RpdmVFbGVtZW50KCkpIHtcblx0XHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5kb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZSgndGFiaW5kZXgnKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgY29udGFpbmVyKCk6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udGFpbmVyO1xuXHR9XG59XG5cbmNsYXNzIFRyZWVWaWV3SWRlbnRpdHlQcm92aWRlciBpbXBsZW1lbnRzIElJZGVudGl0eVByb3ZpZGVyPElUcmVlSXRlbT4ge1xuXHRnZXRJZChlbGVtZW50OiBJVHJlZUl0ZW0pOiB7IHRvU3RyaW5nKCk6IHN0cmluZyB9IHtcblx0XHRyZXR1cm4gZWxlbWVudC5oYW5kbGU7XG5cdH1cbn1cblxuY2xhc3MgVHJlZVZpZXdEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPElUcmVlSXRlbT4ge1xuXG5cdGdldEhlaWdodChlbGVtZW50OiBJVHJlZUl0ZW0pOiBudW1iZXIge1xuXHRcdHJldHVybiBUcmVlUmVuZGVyZXIuSVRFTV9IRUlHSFQ7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IElUcmVlSXRlbSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFRyZWVSZW5kZXJlci5UUkVFX1RFTVBMQVRFX0lEO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRvR2V0Q2hpbGRyZW5PckJhdGNoKGRhdGFQcm92aWRlcjogSVRyZWVWaWV3RGF0YVByb3ZpZGVyLCBub2RlczogSVRyZWVJdGVtW10gfCB1bmRlZmluZWQpOiBQcm9taXNlPElUcmVlSXRlbVtdW10gfCB1bmRlZmluZWQ+IHtcblx0aWYgKGRhdGFQcm92aWRlci5nZXRDaGlsZHJlbkJhdGNoKSB7XG5cdFx0cmV0dXJuIGRhdGFQcm92aWRlci5nZXRDaGlsZHJlbkJhdGNoKG5vZGVzKTtcblx0fSBlbHNlIHtcblx0XHRpZiAobm9kZXMpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChub2Rlcy5tYXAobm9kZSA9PiBkYXRhUHJvdmlkZXIuZ2V0Q2hpbGRyZW4obm9kZSkudGhlbihjaGlsZHJlbiA9PiBjaGlsZHJlbiA/PyBbXSkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIFthd2FpdCBkYXRhUHJvdmlkZXIuZ2V0Q2hpbGRyZW4oKV0uZmlsdGVyKGNoaWxkcmVuID0+IGNoaWxkcmVuICE9PSB1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBUcmVlRGF0YVNvdXJjZSBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8SVRyZWVJdGVtLCBJVHJlZUl0ZW0+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHRyZWVWaWV3OiBJVHJlZVZpZXcsXG5cdFx0cHJpdmF0ZSB3aXRoUHJvZ3Jlc3M6IDxUPih0YXNrOiBQcm9taXNlPFQ+KSA9PiBQcm9taXNlPFQ+XG5cdCkge1xuXHR9XG5cblx0aGFzQ2hpbGRyZW4oZWxlbWVudDogSVRyZWVJdGVtKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy50cmVlVmlldy5kYXRhUHJvdmlkZXIgJiYgKGVsZW1lbnQuY29sbGFwc2libGVTdGF0ZSAhPT0gVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBiYXRjaDogSVRyZWVJdGVtW10gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYmF0Y2hQcm9taXNlOiBQcm9taXNlPElUcmVlSXRlbVtdW10gfCB1bmRlZmluZWQ+IHwgdW5kZWZpbmVkO1xuXHRhc3luYyBnZXRDaGlsZHJlbihlbGVtZW50OiBJVHJlZUl0ZW0pOiBQcm9taXNlPElUcmVlSXRlbVtdPiB7XG5cdFx0Y29uc3QgZGF0YVByb3ZpZGVyID0gdGhpcy50cmVlVmlldy5kYXRhUHJvdmlkZXI7XG5cdFx0aWYgKCFkYXRhUHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuYmF0Y2ggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5iYXRjaCA9IFtlbGVtZW50XTtcblx0XHRcdHRoaXMuYmF0Y2hQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmJhdGNoLnB1c2goZWxlbWVudCk7XG5cdFx0fVxuXHRcdGNvbnN0IGluZGV4SW5CYXRjaCA9IHRoaXMuYmF0Y2gubGVuZ3RoIC0gMTtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8SVRyZWVJdGVtW10+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBiYXRjaCA9IHRoaXMuYmF0Y2g7XG5cdFx0XHRcdHRoaXMuYmF0Y2ggPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICghdGhpcy5iYXRjaFByb21pc2UpIHtcblx0XHRcdFx0XHR0aGlzLmJhdGNoUHJvbWlzZSA9IHRoaXMud2l0aFByb2dyZXNzKGRvR2V0Q2hpbGRyZW5PckJhdGNoKGRhdGFQcm92aWRlciwgYmF0Y2gpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuYmF0Y2hQcm9taXNlO1xuXHRcdFx0XHRcdHJlc29sdmUoKHJlc3VsdCAmJiAoaW5kZXhJbkJhdGNoIDwgcmVzdWx0Lmxlbmd0aCkpID8gcmVzdWx0W2luZGV4SW5CYXRjaF0gOiBbXSk7XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRpZiAoISg8c3RyaW5nPmUubWVzc2FnZSkuc3RhcnRzV2l0aCgnQmFkIHByb2dyZXNzIGxvY2F0aW9uOicpKSB7XG5cdFx0XHRcdFx0XHRyZWplY3QoZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LCAwKTtcblx0XHR9KTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSVRyZWVFeHBsb3JlclRlbXBsYXRlRGF0YSB7XG5cdHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHJlc291cmNlTGFiZWw6IElSZXNvdXJjZUxhYmVsO1xuXHRyZWFkb25seSBpY29uOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgY2hlY2tib3hDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRjaGVja2JveD86IFRyZWVJdGVtQ2hlY2tib3g7XG5cdHJlYWRvbmx5IGFjdGlvbkJhcjogQWN0aW9uQmFyO1xufVxuXG5jbGFzcyBUcmVlUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxJVHJlZUl0ZW0sIEZ1enp5U2NvcmUsIElUcmVlRXhwbG9yZXJUZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IElURU1fSEVJR0hUID0gMjI7XG5cdHN0YXRpYyByZWFkb25seSBUUkVFX1RFTVBMQVRFX0lEID0gJ3RyZWVFeHBsb3Jlcic7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDaGVja2JveFN0YXRlOiBFbWl0dGVyPHJlYWRvbmx5IElUcmVlSXRlbVtdPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHJlYWRvbmx5IElUcmVlSXRlbVtdPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDaGVja2JveFN0YXRlOiBFdmVudDxyZWFkb25seSBJVHJlZUl0ZW1bXT4gPSB0aGlzLl9vbkRpZENoYW5nZUNoZWNrYm94U3RhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VNZW51Q29udGV4dDogRW1pdHRlcjxyZWFkb25seSBJVHJlZUl0ZW1bXT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxyZWFkb25seSBJVHJlZUl0ZW1bXT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTWVudUNvbnRleHQ6IEV2ZW50PHJlYWRvbmx5IElUcmVlSXRlbVtdPiA9IHRoaXMuX29uRGlkQ2hhbmdlTWVudUNvbnRleHQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfYWN0aW9uUnVubmVyOiBNdWx0aXBsZVNlbGVjdGlvbkFjdGlvblJ1bm5lciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cdHByaXZhdGUgX2hhc0NoZWNrYm94OiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3JlbmRlcmVkRWxlbWVudHMgPSBuZXcgTWFwPHN0cmluZywgeyBvcmlnaW5hbDogSVRyZWVOb2RlPElUcmVlSXRlbSwgRnV6enlTY29yZT47IHJlbmRlcmVkOiBJVHJlZUV4cGxvcmVyVGVtcGxhdGVEYXRhIH1bXT4oKTsgLy8gdHJlZSBpdGVtIGhhbmRsZSB0byB0ZW1wbGF0ZSBkYXRhXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSB0cmVlVmlld0lkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBtZW51czogVHJlZU1lbnVzLFxuXHRcdHByaXZhdGUgbGFiZWxzOiBSZXNvdXJjZUxhYmVscyxcblx0XHRwcml2YXRlIGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IElBY3Rpb25WaWV3SXRlbVByb3ZpZGVyLFxuXHRcdHByaXZhdGUgYWxpZ25lcjogQWxpZ25lcixcblx0XHRwcml2YXRlIGNoZWNrYm94U3RhdGVIYW5kbGVyOiBDaGVja2JveFN0YXRlSGFuZGxlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1hbnVhbGx5TWFuYWdlQ2hlY2tib3hlczogKCkgPT4gYm9vbGVhbixcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5faG92ZXJEZWxlZ2F0ZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaEhvdmVyRGVsZWdhdGUsICdtb3VzZScsIHVuZGVmaW5lZCwge30pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRoZW1lU2VydmljZS5vbkRpZEZpbGVJY29uVGhlbWVDaGFuZ2UoKCkgPT4gdGhpcy5yZXJlbmRlcigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKCgpID0+IHRoaXMucmVyZW5kZXIoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNoZWNrYm94U3RhdGVIYW5kbGVyLm9uRGlkQ2hhbmdlQ2hlY2tib3hTdGF0ZShpdGVtcyA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZUNoZWNrYm94ZXMoaXRlbXMpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dChlID0+IHRoaXMub25EaWRDaGFuZ2VDb250ZXh0KGUpKSk7XG5cdH1cblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBUcmVlUmVuZGVyZXIuVFJFRV9URU1QTEFURV9JRDtcblx0fVxuXG5cdHNldCBhY3Rpb25SdW5uZXIoYWN0aW9uUnVubmVyOiBNdWx0aXBsZVNlbGVjdGlvbkFjdGlvblJ1bm5lcikge1xuXHRcdHRoaXMuX2FjdGlvblJ1bm5lciA9IGFjdGlvblJ1bm5lcjtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJVHJlZUV4cGxvcmVyVGVtcGxhdGVEYXRhIHtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnY3VzdG9tLXZpZXctdHJlZS1ub2RlLWl0ZW0nKTtcblxuXHRcdGNvbnN0IGNoZWNrYm94Q29udGFpbmVyID0gRE9NLmFwcGVuZChjb250YWluZXIsIERPTS4kKCcnKSk7XG5cdFx0Y29uc3QgcmVzb3VyY2VMYWJlbCA9IHRoaXMubGFiZWxzLmNyZWF0ZShjb250YWluZXIsIHsgc3VwcG9ydEhpZ2hsaWdodHM6IHRydWUsIGhvdmVyRGVsZWdhdGU6IHRoaXMuX2hvdmVyRGVsZWdhdGUgfSk7XG5cdFx0Y29uc3QgaWNvbiA9IERPTS5wcmVwZW5kKHJlc291cmNlTGFiZWwuZWxlbWVudCwgRE9NLiQoJy5jdXN0b20tdmlldy10cmVlLW5vZGUtaXRlbS1pY29uJykpO1xuXHRcdGNvbnN0IGFjdGlvbnNDb250YWluZXIgPSBET00uYXBwZW5kKHJlc291cmNlTGFiZWwuZWxlbWVudCwgRE9NLiQoJy5hY3Rpb25zJykpO1xuXHRcdGNvbnN0IGFjdGlvbkJhciA9IG5ldyBBY3Rpb25CYXIoYWN0aW9uc0NvbnRhaW5lciwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogdGhpcy5hY3Rpb25WaWV3SXRlbVByb3ZpZGVyXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4geyByZXNvdXJjZUxhYmVsLCBpY29uLCBjaGVja2JveENvbnRhaW5lciwgYWN0aW9uQmFyLCBjb250YWluZXIgfTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0SG92ZXIobGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZCwgcmVzb3VyY2U6IFVSSSB8IG51bGwsIG5vZGU6IElUcmVlSXRlbSk6IHN0cmluZyB8IElNYW5hZ2VkSG92ZXJUb29sdGlwTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICghKG5vZGUgaW5zdGFuY2VvZiBSZXNvbHZhYmxlVHJlZUl0ZW0pIHx8ICFub2RlLmhhc1Jlc29sdmUpIHtcblx0XHRcdGlmIChyZXNvdXJjZSAmJiAhbm9kZS50b29sdGlwKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9IGVsc2UgaWYgKG5vZGUudG9vbHRpcCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybiBsYWJlbDtcblx0XHRcdH0gZWxzZSBpZiAoIWlzU3RyaW5nKG5vZGUudG9vbHRpcCkpIHtcblx0XHRcdFx0cmV0dXJuIHsgbWFya2Rvd246IG5vZGUudG9vbHRpcCwgbWFya2Rvd25Ob3RTdXBwb3J0ZWRGYWxsYmFjazogcmVzb3VyY2UgPyB1bmRlZmluZWQgOiByZW5kZXJNYXJrZG93bkFzUGxhaW50ZXh0KG5vZGUudG9vbHRpcCkgfTsgLy8gUGFzc2luZyB1bmRlZmluZWQgYXMgdGhlIGZhbGxiYWNrIGZvciBhIHJlc291cmNlIGZhbGxzIGJhY2sgdG8gdGhlIG9sZCBuYXRpdmUgaG92ZXJcblx0XHRcdH0gZWxzZSBpZiAobm9kZS50b29sdGlwICE9PSAnJykge1xuXHRcdFx0XHRyZXR1cm4gbm9kZS50b29sdGlwO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bWFya2Rvd246IHR5cGVvZiBub2RlLnRvb2x0aXAgPT09ICdzdHJpbmcnID8gbm9kZS50b29sdGlwIDpcblx0XHRcdFx0KHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SU1hcmtkb3duU3RyaW5nIHwgc3RyaW5nIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPElNYXJrZG93blN0cmluZyB8IHN0cmluZyB8IHVuZGVmaW5lZD4oKHJlc29sdmUpID0+IHtcblx0XHRcdFx0XHRcdG5vZGUucmVzb2x2ZSh0b2tlbikudGhlbigoKSA9PiByZXNvbHZlKG5vZGUudG9vbHRpcCkpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9LFxuXHRcdFx0bWFya2Rvd25Ob3RTdXBwb3J0ZWRGYWxsYmFjazogcmVzb3VyY2UgPyB1bmRlZmluZWQgOiAobGFiZWwgPz8gJycpIC8vIFBhc3NpbmcgdW5kZWZpbmVkIGFzIHRoZSBmYWxsYmFjayBmb3IgYSByZXNvdXJjZSBmYWxscyBiYWNrIHRvIHRoZSBvbGQgbmF0aXZlIGhvdmVyXG5cdFx0fTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPElUcmVlSXRlbSwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVRyZWVFeHBsb3JlclRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGUgPSBlbGVtZW50LmVsZW1lbnQ7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBub2RlLnJlc291cmNlVXJpID8gVVJJLnJldml2ZShub2RlLnJlc291cmNlVXJpKSA6IG51bGw7XG5cdFx0Y29uc3QgdHJlZUl0ZW1MYWJlbDogSVRyZWVJdGVtTGFiZWwgfCB1bmRlZmluZWQgPSBub2RlLmxhYmVsID8gbm9kZS5sYWJlbCA6IChyZXNvdXJjZSA/IHsgbGFiZWw6IGJhc2VuYW1lKHJlc291cmNlKSB9IDogdW5kZWZpbmVkKTtcblx0XHRjb25zdCBkZXNjcmlwdGlvbiA9IGlzU3RyaW5nKG5vZGUuZGVzY3JpcHRpb24pID8gbm9kZS5kZXNjcmlwdGlvbiA6IHJlc291cmNlICYmIG5vZGUuZGVzY3JpcHRpb24gPT09IHRydWUgPyB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChkaXJuYW1lKHJlc291cmNlKSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBsYWJlbCA9IHRyZWVJdGVtTGFiZWwgPyB0cmVlSXRlbUxhYmVsLmxhYmVsIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1hdGNoZXMgPSAodHJlZUl0ZW1MYWJlbCAmJiB0cmVlSXRlbUxhYmVsLmhpZ2hsaWdodHMgJiYgbGFiZWwpID8gdHJlZUl0ZW1MYWJlbC5oaWdobGlnaHRzLm1hcCgoW3N0YXJ0LCBlbmRdKSA9PiB7XG5cdFx0XHRpZiAoc3RhcnQgPCAwKSB7XG5cdFx0XHRcdHN0YXJ0ID0gbGFiZWwubGVuZ3RoICsgc3RhcnQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZW5kIDwgMCkge1xuXHRcdFx0XHRlbmQgPSBsYWJlbC5sZW5ndGggKyBlbmQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoKHN0YXJ0ID49IGxhYmVsLmxlbmd0aCkgfHwgKGVuZCA+IGxhYmVsLmxlbmd0aCkpIHtcblx0XHRcdFx0cmV0dXJuICh7IHN0YXJ0OiAwLCBlbmQ6IDAgfSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc3RhcnQgPiBlbmQpIHtcblx0XHRcdFx0Y29uc3Qgc3dhcCA9IHN0YXJ0O1xuXHRcdFx0XHRzdGFydCA9IGVuZDtcblx0XHRcdFx0ZW5kID0gc3dhcDtcblx0XHRcdH1cblx0XHRcdHJldHVybiAoeyBzdGFydCwgZW5kIH0pO1xuXHRcdH0pIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGljb24gPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkudHlwZSA9PT0gQ29sb3JTY2hlbWUuTElHSFQgPyBub2RlLmljb24gOiBub2RlLmljb25EYXJrO1xuXHRcdGNvbnN0IGljb25VcmwgPSBpY29uID8gVVJJLnJldml2ZShpY29uKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCB0aXRsZSA9IHRoaXMuZ2V0SG92ZXIobGFiZWwsIHJlc291cmNlLCBub2RlKTtcblxuXHRcdC8vIHJlc2V0XG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5jbGVhcigpO1xuXHRcdHRlbXBsYXRlRGF0YS5pY29uLnN0eWxlLmNvbG9yID0gJyc7XG5cblx0XHRsZXQgY29tbWFuZEVuYWJsZWQgPSB0cnVlO1xuXHRcdGlmIChub2RlLmNvbW1hbmQpIHtcblx0XHRcdGNvbW1hbmRFbmFibGVkID0gaXNUcmVlQ29tbWFuZEVuYWJsZWQobm9kZS5jb21tYW5kLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlckNoZWNrYm94KG5vZGUsIHRlbXBsYXRlRGF0YSk7XG5cblx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdGNvbnN0IGZpbGVEZWNvcmF0aW9ucyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8eyBjb2xvcnM6IGJvb2xlYW47IGJhZGdlczogYm9vbGVhbiB9PignZXhwbG9yZXIuZGVjb3JhdGlvbnMnKTtcblx0XHRcdGNvbnN0IGxhYmVsUmVzb3VyY2UgPSByZXNvdXJjZSA/IHJlc291cmNlIDogVVJJLnBhcnNlKCdtaXNzaW5nOl9pY29uX3Jlc291cmNlJyk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEucmVzb3VyY2VMYWJlbC5zZXRSZXNvdXJjZSh7IG5hbWU6IGxhYmVsLCBkZXNjcmlwdGlvbiwgcmVzb3VyY2U6IGxhYmVsUmVzb3VyY2UgfSwge1xuXHRcdFx0XHRmaWxlS2luZDogdGhpcy5nZXRGaWxlS2luZChub2RlKSxcblx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdGhpZGVJY29uOiB0aGlzLnNob3VsZEhpZGVSZXNvdXJjZUxhYmVsSWNvbihpY29uVXJsLCBub2RlLnRoZW1lSWNvbiksXG5cdFx0XHRcdGZpbGVEZWNvcmF0aW9ucyxcblx0XHRcdFx0ZXh0cmFDbGFzc2VzOiBbJ2N1c3RvbS12aWV3LXRyZWUtbm9kZS1pdGVtLXJlc291cmNlTGFiZWwnXSxcblx0XHRcdFx0bWF0Y2hlczogbWF0Y2hlcyA/IG1hdGNoZXMgOiBjcmVhdGVNYXRjaGVzKGVsZW1lbnQuZmlsdGVyRGF0YSksXG5cdFx0XHRcdHN0cmlrZXRocm91Z2g6IHRyZWVJdGVtTGFiZWw/LnN0cmlrZXRocm91Z2gsXG5cdFx0XHRcdGRpc2FibGVkQ29tbWFuZDogIWNvbW1hbmRFbmFibGVkLFxuXHRcdFx0XHRsYWJlbEVzY2FwZU5ld0xpbmVzOiB0cnVlLFxuXHRcdFx0XHRmb3JjZUxhYmVsOiAhIW5vZGUubGFiZWxcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEucmVzb3VyY2VMYWJlbC5zZXRSZXNvdXJjZSh7IG5hbWU6IGxhYmVsLCBkZXNjcmlwdGlvbiB9LCB7XG5cdFx0XHRcdHRpdGxlLFxuXHRcdFx0XHRoaWRlSWNvbjogdHJ1ZSxcblx0XHRcdFx0ZXh0cmFDbGFzc2VzOiBbJ2N1c3RvbS12aWV3LXRyZWUtbm9kZS1pdGVtLXJlc291cmNlTGFiZWwnXSxcblx0XHRcdFx0bWF0Y2hlczogbWF0Y2hlcyA/IG1hdGNoZXMgOiBjcmVhdGVNYXRjaGVzKGVsZW1lbnQuZmlsdGVyRGF0YSksXG5cdFx0XHRcdHN0cmlrZXRocm91Z2g6IHRyZWVJdGVtTGFiZWw/LnN0cmlrZXRocm91Z2gsXG5cdFx0XHRcdGRpc2FibGVkQ29tbWFuZDogIWNvbW1hbmRFbmFibGVkLFxuXHRcdFx0XHRsYWJlbEVzY2FwZU5ld0xpbmVzOiB0cnVlXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoaWNvblVybCkge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmljb24uY2xhc3NOYW1lID0gJ2N1c3RvbS12aWV3LXRyZWUtbm9kZS1pdGVtLWljb24nO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gY3NzSnMuYXNDU1NVcmwoaWNvblVybCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxldCBpY29uQ2xhc3M6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0aGlzLnNob3VsZFNob3dUaGVtZUljb24oISFyZXNvdXJjZSwgbm9kZS50aGVtZUljb24pKSB7XG5cdFx0XHRcdGljb25DbGFzcyA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShub2RlLnRoZW1lSWNvbik7XG5cdFx0XHRcdGlmIChub2RlLnRoZW1lSWNvbi5jb2xvcikge1xuXHRcdFx0XHRcdHRlbXBsYXRlRGF0YS5pY29uLnN0eWxlLmNvbG9yID0gdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLmdldENvbG9yKG5vZGUudGhlbWVJY29uLmNvbG9yLmlkKT8udG9TdHJpbmcoKSA/PyAnJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGVtcGxhdGVEYXRhLmljb24uY2xhc3NOYW1lID0gaWNvbkNsYXNzID8gYGN1c3RvbS12aWV3LXRyZWUtbm9kZS1pdGVtLWljb24gJHtpY29uQ2xhc3N9YCA6ICcnO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7XG5cdFx0fVxuXG5cdFx0aWYgKCFjb21tYW5kRW5hYmxlZCkge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmljb24uY2xhc3NOYW1lID0gdGVtcGxhdGVEYXRhLmljb24uY2xhc3NOYW1lICsgJyBkaXNhYmxlZCc7XG5cdFx0XHRpZiAodGVtcGxhdGVEYXRhLmNvbnRhaW5lci5wYXJlbnRFbGVtZW50KSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5jb250YWluZXIucGFyZW50RWxlbWVudC5jbGFzc05hbWUgPSB0ZW1wbGF0ZURhdGEuY29udGFpbmVyLnBhcmVudEVsZW1lbnQuY2xhc3NOYW1lICsgJyBkaXNhYmxlZCc7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5jb250ZXh0ID0geyAkdHJlZVZpZXdJZDogdGhpcy50cmVlVmlld0lkLCAkdHJlZUl0ZW1IYW5kbGU6IG5vZGUuaGFuZGxlIH0gc2F0aXNmaWVzIFRyZWVWaWV3SXRlbUhhbmRsZUFyZztcblxuXHRcdGNvbnN0IG1lbnVBY3Rpb25zID0gdGhpcy5tZW51cy5nZXRSZXNvdXJjZUFjdGlvbnMoW25vZGVdKTtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLnB1c2gobWVudUFjdGlvbnMsIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXG5cdFx0aWYgKHRoaXMuX2FjdGlvblJ1bm5lcikge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5hY3Rpb25SdW5uZXIgPSB0aGlzLl9hY3Rpb25SdW5uZXI7XG5cdFx0fVxuXHRcdHRoaXMuc2V0QWxpZ25tZW50KHRlbXBsYXRlRGF0YS5jb250YWluZXIsIG5vZGUpO1xuXG5cdFx0Ly8gcmVtZW1iZXIgcmVuZGVyZWQgZWxlbWVudCwgYW4gZWxlbWVudCBjYW4gYmUgcmVuZGVyZWQgbXVsdGlwbGUgdGltZXNcblx0XHRjb25zdCByZW5kZXJlZEl0ZW1zID0gdGhpcy5fcmVuZGVyZWRFbGVtZW50cy5nZXQoZWxlbWVudC5lbGVtZW50LmhhbmRsZSkgPz8gW107XG5cdFx0dGhpcy5fcmVuZGVyZWRFbGVtZW50cy5zZXQoZWxlbWVudC5lbGVtZW50LmhhbmRsZSwgWy4uLnJlbmRlcmVkSXRlbXMsIHsgb3JpZ2luYWw6IGVsZW1lbnQsIHJlbmRlcmVkOiB0ZW1wbGF0ZURhdGEgfV0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZXJlbmRlcigpIHtcblx0XHQvLyBBcyB3ZSBhZGQgaXRlbXMgdG8gdGhlIG1hcCBkdXJpbmcgdGhpcyBjYWxsIHdlIGNhbid0IGRpcmVjdGx5IHVzZSB0aGUgbWFwIGluIHRoZSBmb3IgbG9vcFxuXHRcdC8vIGJ1dCBoYXZlIHRvIGNyZWF0ZSBhIGNvcHkgb2YgdGhlIGtleXMgZmlyc3Rcblx0XHRjb25zdCBrZXlzID0gbmV3IFNldCh0aGlzLl9yZW5kZXJlZEVsZW1lbnRzLmtleXMoKSk7XG5cdFx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuXHRcdFx0Y29uc3QgdmFsdWVzID0gdGhpcy5fcmVuZGVyZWRFbGVtZW50cy5nZXQoa2V5KSA/PyBbXTtcblx0XHRcdGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG5cdFx0XHRcdHRoaXMuZGlzcG9zZUVsZW1lbnQodmFsdWUub3JpZ2luYWwsIDAsIHZhbHVlLnJlbmRlcmVkKTtcblx0XHRcdFx0dGhpcy5yZW5kZXJFbGVtZW50KHZhbHVlLm9yaWdpbmFsLCAwLCB2YWx1ZS5yZW5kZXJlZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDaGVja2JveChub2RlOiBJVHJlZUl0ZW0sIHRlbXBsYXRlRGF0YTogSVRyZWVFeHBsb3JlclRlbXBsYXRlRGF0YSkge1xuXHRcdGlmIChub2RlLmNoZWNrYm94KSB7XG5cdFx0XHQvLyBUaGUgZmlyc3QgdGltZSB3ZSBmaW5kIGEgY2hlY2tib3ggd2Ugd2FudCB0byByZXJlbmRlciB0aGUgdmlzaWJsZSB0cmVlIHRvIGFkYXB0IHRoZSBhbGlnbm1lbnRcblx0XHRcdGlmICghdGhpcy5faGFzQ2hlY2tib3gpIHtcblx0XHRcdFx0dGhpcy5faGFzQ2hlY2tib3ggPSB0cnVlO1xuXHRcdFx0XHR0aGlzLnJlcmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRlbXBsYXRlRGF0YS5jaGVja2JveCkge1xuXHRcdFx0XHRjb25zdCBjaGVja2JveCA9IG5ldyBUcmVlSXRlbUNoZWNrYm94KHRlbXBsYXRlRGF0YS5jaGVja2JveENvbnRhaW5lciwgdGhpcy5jaGVja2JveFN0YXRlSGFuZGxlciwgdGhpcy5faG92ZXJEZWxlZ2F0ZSwgdGhpcy5ob3ZlclNlcnZpY2UpO1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuY2hlY2tib3ggPSBjaGVja2JveDtcblx0XHRcdH1cblx0XHRcdHRlbXBsYXRlRGF0YS5jaGVja2JveC5yZW5kZXIobm9kZSk7XG5cdFx0fSBlbHNlIGlmICh0ZW1wbGF0ZURhdGEuY2hlY2tib3gpIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5jaGVja2JveC5kaXNwb3NlKCk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuY2hlY2tib3ggPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXRBbGlnbm1lbnQoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdHJlZUl0ZW06IElUcmVlSXRlbSkge1xuXHRcdGNvbnRhaW5lci5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QudG9nZ2xlKCdhbGlnbi1pY29uLXdpdGgtdHdpc3R5JywgIXRoaXMuX2hhc0NoZWNrYm94ICYmIHRoaXMuYWxpZ25lci5hbGlnbkljb25XaXRoVHdpc3R5KHRyZWVJdGVtKSk7XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZEhpZGVSZXNvdXJjZUxhYmVsSWNvbihpY29uVXJsOiBVUkkgfCB1bmRlZmluZWQsIGljb246IFRoZW1lSWNvbiB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdC8vIFdlIGFsd2F5cyBoaWRlIHRoZSByZXNvdXJjZSBsYWJlbCBpbiBmYXZvciBvZiB0aGUgaWNvblVybCB3aGVuIGl0J3MgcHJvdmlkZWQuXG5cdFx0Ly8gV2hlbiBgVGhlbWVJY29uYCBpcyBwcm92aWRlZCwgd2UgaGlkZSB0aGUgcmVzb3VyY2UgbGFiZWwgaWNvbiBpbiBmYXZvciBvZiBpdCBvbmx5IGlmIGl0J3MgYSBub3QgYSBmaWxlIGljb24uXG5cdFx0cmV0dXJuICghIWljb25VcmwgfHwgKCEhaWNvbiAmJiAhdGhpcy5pc0ZpbGVLaW5kVGhlbWVJY29uKGljb24pKSk7XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZFNob3dUaGVtZUljb24oaGFzUmVzb3VyY2U6IGJvb2xlYW4sIGljb246IFRoZW1lSWNvbiB8IHVuZGVmaW5lZCk6IGljb24gaXMgVGhlbWVJY29uIHtcblx0XHRpZiAoIWljb24pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBJZiB0aGVyZSdzIGEgcmVzb3VyY2UgYW5kIHRoZSBpY29uIGlzIGEgZmlsZSBpY29uLCB0aGVuIHRoZSBpY29uIChvciBsYWNrIHRoZXJlb2YpIHdpbGwgYWxyZWFkeSBiZSBjb21pbmcgZnJvbSB0aGVcblx0XHQvLyBpY29uIHRoZW1lIGFuZCBzaG91bGQgdXNlIHdoYXRldmVyIHRoZSBpY29uIHRoZW1lIGhhcyBwcm92aWRlZC5cblx0XHRyZXR1cm4gIShoYXNSZXNvdXJjZSAmJiB0aGlzLmlzRmlsZUtpbmRUaGVtZUljb24oaWNvbikpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0ZvbGRlclRoZW1lSWNvbihpY29uOiBUaGVtZUljb24gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaWNvbj8uaWQgPT09IEZvbGRlclRoZW1lSWNvbi5pZDtcblx0fVxuXG5cdHByaXZhdGUgaXNGaWxlS2luZFRoZW1lSWNvbihpY29uOiBUaGVtZUljb24gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAoaWNvbikge1xuXHRcdFx0cmV0dXJuIGljb24uaWQgPT09IEZpbGVUaGVtZUljb24uaWQgfHwgdGhpcy5pc0ZvbGRlclRoZW1lSWNvbihpY29uKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0RmlsZUtpbmQobm9kZTogSVRyZWVJdGVtKTogRmlsZUtpbmQge1xuXHRcdGlmIChub2RlLnRoZW1lSWNvbikge1xuXHRcdFx0c3dpdGNoIChub2RlLnRoZW1lSWNvbi5pZCkge1xuXHRcdFx0XHRjYXNlIEZpbGVUaGVtZUljb24uaWQ6XG5cdFx0XHRcdFx0cmV0dXJuIEZpbGVLaW5kLkZJTEU7XG5cdFx0XHRcdGNhc2UgRm9sZGVyVGhlbWVJY29uLmlkOlxuXHRcdFx0XHRcdHJldHVybiBGaWxlS2luZC5GT0xERVI7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBub2RlLmNvbGxhcHNpYmxlU3RhdGUgPT09IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Db2xsYXBzZWQgfHwgbm9kZS5jb2xsYXBzaWJsZVN0YXRlID09PSBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuRXhwYW5kZWQgPyBGaWxlS2luZC5GT0xERVIgOiBGaWxlS2luZC5GSUxFO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZUNvbnRleHQoZTogSUNvbnRleHRLZXlDaGFuZ2VFdmVudCkge1xuXHRcdGNvbnN0IGl0ZW1zOiBJVHJlZUl0ZW1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW18sIGVsZW1lbnRzXSBvZiB0aGlzLl9yZW5kZXJlZEVsZW1lbnRzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c1NvbWUodGhpcy5tZW51cy5nZXRFbGVtZW50T3ZlcmxheUNvbnRleHRzKGVsZW1lbnQub3JpZ2luYWwuZWxlbWVudCkpIHx8IGUuYWZmZWN0c1NvbWUodGhpcy5tZW51cy5nZXRFbnRpcmVNZW51Q29udGV4dHMoKSkpIHtcblx0XHRcdFx0XHRpdGVtcy5wdXNoKGVsZW1lbnQub3JpZ2luYWwuZWxlbWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VNZW51Q29udGV4dC5maXJlKGl0ZW1zKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNoZWNrYm94ZXMoaXRlbXM6IElUcmVlSXRlbVtdKSB7XG5cdFx0bGV0IGFsbEl0ZW1zOiBJVHJlZUl0ZW1bXSA9IFtdO1xuXG5cdFx0aWYgKCF0aGlzLm1hbnVhbGx5TWFuYWdlQ2hlY2tib3hlcygpKSB7XG5cdFx0XHRhbGxJdGVtcyA9IHNldENhc2NhZGluZ0NoZWNrYm94VXBkYXRlcyhpdGVtcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFsbEl0ZW1zID0gaXRlbXM7XG5cdFx0fVxuXG5cdFx0YWxsSXRlbXMuZm9yRWFjaChpdGVtID0+IHtcblx0XHRcdGNvbnN0IHJlbmRlcmVkSXRlbXMgPSB0aGlzLl9yZW5kZXJlZEVsZW1lbnRzLmdldChpdGVtLmhhbmRsZSk7XG5cdFx0XHRpZiAocmVuZGVyZWRJdGVtcykge1xuXHRcdFx0XHRyZW5kZXJlZEl0ZW1zLmZvckVhY2gocmVuZGVyZWRJdGVtcyA9PiByZW5kZXJlZEl0ZW1zLnJlbmRlcmVkLmNoZWNrYm94Py5yZW5kZXIoaXRlbSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ2hlY2tib3hTdGF0ZS5maXJlKGFsbEl0ZW1zKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KHJlc291cmNlOiBJVHJlZU5vZGU8SVRyZWVJdGVtLCBGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJVHJlZUV4cGxvcmVyVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3QgaXRlbVJlbmRlcnMgPSB0aGlzLl9yZW5kZXJlZEVsZW1lbnRzLmdldChyZXNvdXJjZS5lbGVtZW50LmhhbmRsZSkgPz8gW107XG5cdFx0Y29uc3QgcmVuZGVyZWRJbmRleCA9IGl0ZW1SZW5kZXJzLmZpbmRJbmRleChyZW5kZXJlZEl0ZW0gPT4gdGVtcGxhdGVEYXRhID09PSByZW5kZXJlZEl0ZW0ucmVuZGVyZWQpO1xuXG5cdFx0aWYgKGl0ZW1SZW5kZXJzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0dGhpcy5fcmVuZGVyZWRFbGVtZW50cy5kZWxldGUocmVzb3VyY2UuZWxlbWVudC5oYW5kbGUpO1xuXHRcdH0gZWxzZSBpZiAoaXRlbVJlbmRlcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0aXRlbVJlbmRlcnMuc3BsaWNlKHJlbmRlcmVkSW5kZXgsIDEpO1xuXHRcdH1cblxuXHRcdHRlbXBsYXRlRGF0YS5jaGVja2JveD8uZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5jaGVja2JveCA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElUcmVlRXhwbG9yZXJUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEucmVzb3VyY2VMYWJlbC5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgQWxpZ25lciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF90cmVlOiBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElUcmVlSXRlbSwgSVRyZWVJdGVtLCBGdXp6eVNjb3JlPiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRzZXQgdHJlZSh0cmVlOiBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPElUcmVlSXRlbSwgSVRyZWVJdGVtLCBGdXp6eVNjb3JlPikge1xuXHRcdHRoaXMuX3RyZWUgPSB0cmVlO1xuXHR9XG5cblx0cHVibGljIGFsaWduSWNvbldpdGhUd2lzdHkodHJlZUl0ZW06IElUcmVlSXRlbSk6IGJvb2xlYW4ge1xuXHRcdGlmICh0cmVlSXRlbS5jb2xsYXBzaWJsZVN0YXRlICE9PSBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuaGFzSWNvbih0cmVlSXRlbSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fdHJlZSkge1xuXHRcdFx0Y29uc3QgcGFyZW50OiBJVHJlZUl0ZW0gPSB0aGlzLl90cmVlLmdldFBhcmVudEVsZW1lbnQodHJlZUl0ZW0pIHx8IHRoaXMuX3RyZWUuZ2V0SW5wdXQoKTtcblx0XHRcdGlmICh0aGlzLmhhc0ljb24ocGFyZW50KSkge1xuXHRcdFx0XHRyZXR1cm4gISFwYXJlbnQuY2hpbGRyZW4gJiYgcGFyZW50LmNoaWxkcmVuLnNvbWUoYyA9PiBjLmNvbGxhcHNpYmxlU3RhdGUgIT09IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5Ob25lICYmICF0aGlzLmhhc0ljb24oYykpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuICEhcGFyZW50LmNoaWxkcmVuICYmIHBhcmVudC5jaGlsZHJlbi5ldmVyeShjID0+IGMuY29sbGFwc2libGVTdGF0ZSA9PT0gVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUgfHwgIXRoaXMuaGFzSWNvbihjKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhc0ljb24obm9kZTogSVRyZWVJdGVtKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgaWNvbiA9IHRoaXMudGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS50eXBlID09PSBDb2xvclNjaGVtZS5MSUdIVCA/IG5vZGUuaWNvbiA6IG5vZGUuaWNvbkRhcms7XG5cdFx0aWYgKGljb24pIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAobm9kZS5yZXNvdXJjZVVyaSB8fCBub2RlLnRoZW1lSWNvbikge1xuXHRcdFx0Y29uc3QgZmlsZUljb25UaGVtZSA9IHRoaXMudGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKTtcblx0XHRcdGNvbnN0IGlzRm9sZGVyID0gbm9kZS50aGVtZUljb24gPyBub2RlLnRoZW1lSWNvbi5pZCA9PT0gRm9sZGVyVGhlbWVJY29uLmlkIDogbm9kZS5jb2xsYXBzaWJsZVN0YXRlICE9PSBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZTtcblx0XHRcdGlmIChpc0ZvbGRlcikge1xuXHRcdFx0XHRyZXR1cm4gZmlsZUljb25UaGVtZS5oYXNGaWxlSWNvbnMgJiYgZmlsZUljb25UaGVtZS5oYXNGb2xkZXJJY29ucztcblx0XHRcdH1cblx0XHRcdHJldHVybiBmaWxlSWNvblRoZW1lLmhhc0ZpbGVJY29ucztcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbmNsYXNzIE11bHRpcGxlU2VsZWN0aW9uQWN0aW9uUnVubmVyIGV4dGVuZHMgQWN0aW9uUnVubmVyIHtcblxuXHRjb25zdHJ1Y3Rvcihub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSwgcHJpdmF0ZSBnZXRTZWxlY3RlZFJlc291cmNlczogKCgpID0+IElUcmVlSXRlbVtdKSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZFJ1bihlID0+IHtcblx0XHRcdGlmIChlLmVycm9yICYmICFpc0NhbmNlbGxhdGlvbkVycm9yKGUuZXJyb3IpKSB7XG5cdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobG9jYWxpemUoJ2NvbW1hbmQtZXJyb3InLCAnRXJyb3IgcnVubmluZyBjb21tYW5kIHsxfTogezB9LiBUaGlzIGlzIGxpa2VseSBjYXVzZWQgYnkgdGhlIGV4dGVuc2lvbiB0aGF0IGNvbnRyaWJ1dGVzIHsxfS4nLCBlLmVycm9yLm1lc3NhZ2UsIGUuYWN0aW9uLmlkKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIHJ1bkFjdGlvbihhY3Rpb246IElBY3Rpb24sIGNvbnRleHQ6IFRyZWVWaWV3SXRlbUhhbmRsZUFyZyB8IFRyZWVWaWV3UGFuZUhhbmRsZUFyZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuZ2V0U2VsZWN0ZWRSZXNvdXJjZXMoKTtcblx0XHRsZXQgc2VsZWN0aW9uSGFuZGxlQXJnczogVHJlZVZpZXdJdGVtSGFuZGxlQXJnW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGFjdGlvbkluU2VsZWN0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRpZiAoc2VsZWN0aW9uLmxlbmd0aCA+IDEpIHtcblx0XHRcdHNlbGVjdGlvbkhhbmRsZUFyZ3MgPSBzZWxlY3Rpb24ubWFwKHNlbGVjdGVkID0+IHtcblx0XHRcdFx0aWYgKChzZWxlY3RlZC5oYW5kbGUgPT09IChjb250ZXh0IGFzIFRyZWVWaWV3SXRlbUhhbmRsZUFyZykuJHRyZWVJdGVtSGFuZGxlKSB8fCAoY29udGV4dCBhcyBUcmVlVmlld1BhbmVIYW5kbGVBcmcpLiRzZWxlY3RlZFRyZWVJdGVtcykge1xuXHRcdFx0XHRcdGFjdGlvbkluU2VsZWN0ZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7ICR0cmVlVmlld0lkOiBjb250ZXh0LiR0cmVlVmlld0lkLCAkdHJlZUl0ZW1IYW5kbGU6IHNlbGVjdGVkLmhhbmRsZSB9O1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFhY3Rpb25JblNlbGVjdGVkICYmIHNlbGVjdGlvbkhhbmRsZUFyZ3MpIHtcblx0XHRcdHNlbGVjdGlvbkhhbmRsZUFyZ3MgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0YXdhaXQgYWN0aW9uLnJ1bihjb250ZXh0LCBzZWxlY3Rpb25IYW5kbGVBcmdzKTtcblx0fVxufVxuXG5jbGFzcyBUcmVlTWVudXMgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjxJVHJlZUl0ZW0+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgaWQ6IHN0cmluZyxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZVxuXHQpIHsgfVxuXG5cdC8qKlxuXHQgKiBHZXRzIG9ubHkgdGhlIGFjdGlvbnMgdGhhdCBhcHBseSB0byBhbGwgb2YgdGhlIGdpdmVuIGVsZW1lbnRzLlxuXHQgKi9cblx0Z2V0UmVzb3VyY2VBY3Rpb25zKGVsZW1lbnRzOiBJVHJlZUl0ZW1bXSk6IElBY3Rpb25bXSB7XG5cdFx0Y29uc3QgYWN0aW9ucyA9IHRoaXMuZ2V0QWN0aW9ucyh0aGlzLmdldE1lbnVJZCgpLCBlbGVtZW50cyk7XG5cdFx0cmV0dXJuIGFjdGlvbnMucHJpbWFyeTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIG9ubHkgdGhlIGFjdGlvbnMgdGhhdCBhcHBseSB0byBhbGwgb2YgdGhlIGdpdmVuIGVsZW1lbnRzLlxuXHQgKi9cblx0Z2V0UmVzb3VyY2VDb250ZXh0QWN0aW9ucyhlbGVtZW50czogSVRyZWVJdGVtW10pOiBJQWN0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLmdldEFjdGlvbnModGhpcy5nZXRNZW51SWQoKSwgZWxlbWVudHMpLnNlY29uZGFyeTtcblx0fVxuXG5cdHB1YmxpYyBzZXRDb250ZXh0S2V5U2VydmljZShzZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UpIHtcblx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlID0gc2VydmljZTtcblx0fVxuXG5cdHByaXZhdGUgZmlsdGVyTm9uVW5pdmVyc2FsQWN0aW9ucyhncm91cHM6IE1hcDxzdHJpbmcsIElBY3Rpb24+W10sIG5ld0FjdGlvbnM6IElBY3Rpb25bXSkge1xuXHRcdGNvbnN0IG5ld0FjdGlvbnNTZXQ6IFNldDxzdHJpbmc+ID0gbmV3IFNldChuZXdBY3Rpb25zLm1hcChhID0+IGEuaWQpKTtcblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIGdyb3Vwcykge1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IGdyb3VwLmtleXMoKTtcblx0XHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIGFjdGlvbnMpIHtcblx0XHRcdFx0aWYgKCFuZXdBY3Rpb25zU2V0LmhhcyhhY3Rpb24pKSB7XG5cdFx0XHRcdFx0Z3JvdXAuZGVsZXRlKGFjdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGJ1aWxkTWVudShncm91cHM6IE1hcDxzdHJpbmcsIElBY3Rpb24+W10pOiBJQWN0aW9uW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogSUFjdGlvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiBncm91cHMpIHtcblx0XHRcdGlmIChncm91cC5zaXplID4gMCkge1xuXHRcdFx0XHRpZiAocmVzdWx0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdWx0LnB1c2goLi4uZ3JvdXAudmFsdWVzKCkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVHcm91cHMoYWN0aW9uczogSUFjdGlvbltdKTogTWFwPHN0cmluZywgSUFjdGlvbj5bXSB7XG5cdFx0Y29uc3QgZ3JvdXBzOiBNYXA8c3RyaW5nLCBJQWN0aW9uPltdID0gW107XG5cdFx0bGV0IGdyb3VwOiBNYXA8c3RyaW5nLCBJQWN0aW9uPiA9IG5ldyBNYXAoKTtcblx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBhY3Rpb25zKSB7XG5cdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgU2VwYXJhdG9yKSB7XG5cdFx0XHRcdGdyb3Vwcy5wdXNoKGdyb3VwKTtcblx0XHRcdFx0Z3JvdXAgPSBuZXcgTWFwKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRncm91cC5zZXQoYWN0aW9uLmlkLCBhY3Rpb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRncm91cHMucHVzaChncm91cCk7XG5cdFx0cmV0dXJuIGdyb3Vwcztcblx0fVxuXG5cdHB1YmxpYyBnZXRFbGVtZW50T3ZlcmxheUNvbnRleHRzKGVsZW1lbnQ6IElUcmVlSXRlbSk6IE1hcDxzdHJpbmcsIGFueT4ge1xuXHRcdHJldHVybiBuZXcgTWFwKFtcblx0XHRcdFsndmlldycsIHRoaXMuaWRdLFxuXHRcdFx0Wyd2aWV3SXRlbScsIGVsZW1lbnQuY29udGV4dFZhbHVlXVxuXHRcdF0pO1xuXHR9XG5cblx0cHVibGljIGdldEVudGlyZU1lbnVDb250ZXh0cygpOiBSZWFkb25seVNldDxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5tZW51U2VydmljZS5nZXRNZW51Q29udGV4dHModGhpcy5nZXRNZW51SWQoKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TWVudUlkKCk6IE1lbnVJZCB7XG5cdFx0cmV0dXJuIE1lbnVJZC5WaWV3SXRlbUNvbnRleHQ7XG5cdH1cblxuXHRwcml2YXRlIGdldEFjdGlvbnMobWVudUlkOiBNZW51SWQsIGVsZW1lbnRzOiBJVHJlZUl0ZW1bXSk6IHsgcHJpbWFyeTogSUFjdGlvbltdOyBzZWNvbmRhcnk6IElBY3Rpb25bXSB9IHtcblx0XHRpZiAoIXRoaXMuY29udGV4dEtleVNlcnZpY2UpIHtcblx0XHRcdHJldHVybiB7IHByaW1hcnk6IFtdLCBzZWNvbmRhcnk6IFtdIH07XG5cdFx0fVxuXG5cdFx0bGV0IHByaW1hcnlHcm91cHM6IE1hcDxzdHJpbmcsIElBY3Rpb24+W10gPSBbXTtcblx0XHRsZXQgc2Vjb25kYXJ5R3JvdXBzOiBNYXA8c3RyaW5nLCBJQWN0aW9uPltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGVsZW1lbnRzW2ldO1xuXHRcdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZU92ZXJsYXkodGhpcy5nZXRFbGVtZW50T3ZlcmxheUNvbnRleHRzKGVsZW1lbnQpKTtcblxuXHRcdFx0Y29uc3QgbWVudURhdGEgPSB0aGlzLm1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKG1lbnVJZCwgY29udGV4dEtleVNlcnZpY2UsIHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGdldENvbnRleHRNZW51QWN0aW9ucyhtZW51RGF0YSwgJ2lubGluZScpO1xuXHRcdFx0aWYgKGkgPT09IDApIHtcblx0XHRcdFx0cHJpbWFyeUdyb3VwcyA9IHRoaXMuY3JlYXRlR3JvdXBzKHJlc3VsdC5wcmltYXJ5KTtcblx0XHRcdFx0c2Vjb25kYXJ5R3JvdXBzID0gdGhpcy5jcmVhdGVHcm91cHMocmVzdWx0LnNlY29uZGFyeSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmZpbHRlck5vblVuaXZlcnNhbEFjdGlvbnMocHJpbWFyeUdyb3VwcywgcmVzdWx0LnByaW1hcnkpO1xuXHRcdFx0XHR0aGlzLmZpbHRlck5vblVuaXZlcnNhbEFjdGlvbnMoc2Vjb25kYXJ5R3JvdXBzLCByZXN1bHQuc2Vjb25kYXJ5KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBwcmltYXJ5OiB0aGlzLmJ1aWxkTWVudShwcmltYXJ5R3JvdXBzKSwgc2Vjb25kYXJ5OiB0aGlzLmJ1aWxkTWVudShzZWNvbmRhcnlHcm91cHMpIH07XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UgPSB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEN1c3RvbVRyZWVWaWV3IGV4dGVuZHMgQWJzdHJhY3RUcmVlVmlldyB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aWQ6IHN0cmluZyxcblx0XHR0aXRsZTogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uSWQ6IHN0cmluZyxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJQWN0aXZpdHlTZXJ2aWNlIGFjdGl2aXR5U2VydmljZTogSUFjdGl2aXR5U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGlkLCB0aXRsZSwgdGhlbWVTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgY29tbWFuZFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBwcm9ncmVzc1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwga2V5YmluZGluZ1NlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSwgaG92ZXJTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgYWN0aXZpdHlTZXJ2aWNlLCBsb2dTZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhY3RpdmF0ZSgpIHtcblx0XHRpZiAoIXRoaXMuYWN0aXZhdGVkKSB7XG5cdFx0XHR0eXBlIEV4dGVuc2lvblZpZXdUZWxlbWV0cnkgPSB7XG5cdFx0XHRcdGV4dGVuc2lvbklkOiBUZWxlbWV0cnlUcnVzdGVkVmFsdWU8c3RyaW5nPjtcblx0XHRcdFx0aWQ6IHN0cmluZztcblx0XHRcdH07XG5cdFx0XHR0eXBlIEV4dGVuc2lvblZpZXdUZWxlbWV0cnlNZXRhID0ge1xuXHRcdFx0XHRleHRlbnNpb25JZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0lkIG9mIHRoZSBleHRlbnNpb24nIH07XG5cdFx0XHRcdGlkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnSWQgb2YgdGhlIHZpZXcnIH07XG5cdFx0XHRcdG93bmVyOiAnZGlnaXRhcmFsZCc7XG5cdFx0XHRcdGNvbW1lbnQ6ICdIZWxwcyB0byBnYWluIGluc2lnaHRzIG9uIHdoYXQgZXh0ZW5zaW9uIGNvbnRyaWJ1dGVkIHZpZXdzIGFyZSBtb3N0IHBvcHVsYXInO1xuXHRcdFx0fTtcblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEV4dGVuc2lvblZpZXdUZWxlbWV0cnksIEV4dGVuc2lvblZpZXdUZWxlbWV0cnlNZXRhPignRXh0ZW5zaW9uOlZpZXdBY3RpdmF0ZScsIHtcblx0XHRcdFx0ZXh0ZW5zaW9uSWQ6IG5ldyBUZWxlbWV0cnlUcnVzdGVkVmFsdWUodGhpcy5leHRlbnNpb25JZCksXG5cdFx0XHRcdGlkOiB0aGlzLmlkLFxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmNyZWF0ZVRyZWUoKTtcblx0XHRcdHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiB0aGlzLmlkIH0sICgpID0+IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoYG9uVmlldzoke3RoaXMuaWR9YCkpXG5cdFx0XHRcdC50aGVuKCgpID0+IHRpbWVvdXQoMjAwMCkpXG5cdFx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZU1lc3NhZ2UoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR0aGlzLmFjdGl2YXRlZCA9IHRydWU7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmVlVmlldyBleHRlbmRzIEFic3RyYWN0VHJlZVZpZXcge1xuXG5cdHByb3RlY3RlZCBhY3RpdmF0ZSgpIHtcblx0XHRpZiAoIXRoaXMuYWN0aXZhdGVkKSB7XG5cdFx0XHR0aGlzLmNyZWF0ZVRyZWUoKTtcblx0XHRcdHRoaXMuYWN0aXZhdGVkID0gdHJ1ZTtcblx0XHR9XG5cdH1cbn1cblxuaW50ZXJmYWNlIFRyZWVEcmFnU291cmNlSW5mbyB7XG5cdGlkOiBzdHJpbmc7XG5cdGl0ZW1IYW5kbGVzOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGNsYXNzIEN1c3RvbVRyZWVWaWV3RHJhZ0FuZERyb3AgaW1wbGVtZW50cyBJVHJlZURyYWdBbmREcm9wPElUcmVlSXRlbT4ge1xuXHRwcml2YXRlIHJlYWRvbmx5IHRyZWVNaW1lVHlwZTogc3RyaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IHRyZWVJdGVtc1RyYW5zZmVyID0gTG9jYWxTZWxlY3Rpb25UcmFuc2Zlci5nZXRJbnN0YW5jZTxEcmFnZ2VkVHJlZUl0ZW1zSWRlbnRpZmllcj4oKTtcblx0cHJpdmF0ZSBkcmFnQ2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuU291cmNlIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdHJlZUlkOiBzdHJpbmcsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUcmVlVmlld3NEbkRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdHJlZVZpZXdzRHJhZ0FuZERyb3BTZXJ2aWNlOiBJVHJlZVZpZXdzRG5EU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSkge1xuXHRcdHRoaXMudHJlZU1pbWVUeXBlID0gYGFwcGxpY2F0aW9uL3ZuZC5jb2RlLnRyZWUuJHt0cmVlSWQudG9Mb3dlckNhc2UoKX1gO1xuXHR9XG5cblx0cHJpdmF0ZSBkbmRDb250cm9sbGVyOiBJVHJlZVZpZXdEcmFnQW5kRHJvcENvbnRyb2xsZXIgfCB1bmRlZmluZWQ7XG5cdHNldCBjb250cm9sbGVyKGNvbnRyb2xsZXI6IElUcmVlVmlld0RyYWdBbmREcm9wQ29udHJvbGxlciB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuZG5kQ29udHJvbGxlciA9IGNvbnRyb2xsZXI7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZURyYWdBbmRMb2coZG5kQ29udHJvbGxlcjogSVRyZWVWaWV3RHJhZ0FuZERyb3BDb250cm9sbGVyLCBpdGVtSGFuZGxlczogc3RyaW5nW10sIHV1aWQ6IHN0cmluZywgZHJhZ0NhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VlNEYXRhVHJhbnNmZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gZG5kQ29udHJvbGxlci5oYW5kbGVEcmFnKGl0ZW1IYW5kbGVzLCB1dWlkLCBkcmFnQ2FuY2VsbGF0aW9uVG9rZW4pLnRoZW4oYWRkaXRpb25hbERhdGFUcmFuc2ZlciA9PiB7XG5cdFx0XHRpZiAoYWRkaXRpb25hbERhdGFUcmFuc2Zlcikge1xuXHRcdFx0XHRjb25zdCB1bmxpc3RlZFR5cGVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgYWRkaXRpb25hbERhdGFUcmFuc2Zlcikge1xuXHRcdFx0XHRcdGlmICgoaXRlbVswXSAhPT0gdGhpcy50cmVlTWltZVR5cGUpICYmIChkbmRDb250cm9sbGVyLmRyYWdNaW1lVHlwZXMuZmluZEluZGV4KHZhbHVlID0+IHZhbHVlID09PSBpdGVtWzBdKSA8IDApKSB7XG5cdFx0XHRcdFx0XHR1bmxpc3RlZFR5cGVzLnB1c2goaXRlbVswXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh1bmxpc3RlZFR5cGVzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBEcmFnIGFuZCBkcm9wIGNvbnRyb2xsZXIgZm9yIHRyZWUgJHt0aGlzLnRyZWVJZH0gYWRkcyB0aGUgZm9sbG93aW5nIGRhdGEgdHJhbnNmZXIgdHlwZXMgYnV0IGRvZXMgbm90IGRlY2xhcmUgdGhlbSBpbiBkcmFnTWltZVR5cGVzOiAke3VubGlzdGVkVHlwZXMuam9pbignLCAnKX1gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGFkZGl0aW9uYWxEYXRhVHJhbnNmZXI7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFkZEV4dGVuc2lvblByb3ZpZGVkVHJhbnNmZXJUeXBlcyhvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQsIGl0ZW1IYW5kbGVzOiBzdHJpbmdbXSkge1xuXHRcdGlmICghb3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIgfHwgIXRoaXMuZG5kQ29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB1dWlkID0gZ2VuZXJhdGVVdWlkKCk7XG5cblx0XHR0aGlzLmRyYWdDYW5jZWxsYXRpb25Ub2tlbiA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRoaXMudHJlZVZpZXdzRHJhZ0FuZERyb3BTZXJ2aWNlLmFkZERyYWdPcGVyYXRpb25UcmFuc2Zlcih1dWlkLCB0aGlzLmhhbmRsZURyYWdBbmRMb2codGhpcy5kbmRDb250cm9sbGVyLCBpdGVtSGFuZGxlcywgdXVpZCwgdGhpcy5kcmFnQ2FuY2VsbGF0aW9uVG9rZW4udG9rZW4pKTtcblx0XHR0aGlzLnRyZWVJdGVtc1RyYW5zZmVyLnNldERhdGEoW25ldyBEcmFnZ2VkVHJlZUl0ZW1zSWRlbnRpZmllcih1dWlkKV0sIERyYWdnZWRUcmVlSXRlbXNJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0b3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIuY2xlYXJEYXRhKE1pbWVzLnRleHQpO1xuXHRcdGlmICh0aGlzLmRuZENvbnRyb2xsZXIuZHJhZ01pbWVUeXBlcy5maW5kKChlbGVtZW50KSA9PiBlbGVtZW50ID09PSBNaW1lcy51cmlMaXN0KSkge1xuXHRcdFx0Ly8gQWRkIHRoZSB0eXBlIHRoYXQgdGhlIGVkaXRvciBrbm93c1xuXHRcdFx0b3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXI/LnNldERhdGEoRGF0YVRyYW5zZmVycy5SRVNPVVJDRVMsICcnKTtcblx0XHR9XG5cdFx0dGhpcy5kbmRDb250cm9sbGVyLmRyYWdNaW1lVHlwZXMuZm9yRWFjaChzdXBwb3J0ZWRUeXBlID0+IHtcblx0XHRcdG9yaWdpbmFsRXZlbnQuZGF0YVRyYW5zZmVyPy5zZXREYXRhKHN1cHBvcnRlZFR5cGUsICcnKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYWRkUmVzb3VyY2VJbmZvVG9UcmFuc2ZlcihvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQsIHJlc291cmNlczogVVJJW10pIHtcblx0XHRpZiAocmVzb3VyY2VzLmxlbmd0aCAmJiBvcmlnaW5hbEV2ZW50LmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0Ly8gQXBwbHkgc29tZSBkYXRhdHJhbnNmZXIgdHlwZXMgdG8gYWxsb3cgZm9yIGRyYWdnaW5nIHRoZSBlbGVtZW50IG91dHNpZGUgb2YgdGhlIGFwcGxpY2F0aW9uXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGZpbGxFZGl0b3JzRHJhZ0RhdGEoYWNjZXNzb3IsIHJlc291cmNlcywgb3JpZ2luYWxFdmVudCkpO1xuXG5cdFx0XHQvLyBUaGUgb25seSBjdXN0b20gZGF0YSB0cmFuc2ZlciB3ZSBzZXQgZnJvbSB0aGUgZXhwbG9yZXIgaXMgYSBmaWxlIHRyYW5zZmVyXG5cdFx0XHQvLyB0byBiZSBhYmxlIHRvIERORCBiZXR3ZWVuIG11bHRpcGxlIGNvZGUgZmlsZSBleHBsb3JlcnMgYWNyb3NzIHdpbmRvd3Ncblx0XHRcdGNvbnN0IGZpbGVSZXNvdXJjZXMgPSByZXNvdXJjZXMuZmlsdGVyKHMgPT4gcy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkubWFwKHIgPT4gci5mc1BhdGgpO1xuXHRcdFx0aWYgKGZpbGVSZXNvdXJjZXMubGVuZ3RoKSB7XG5cdFx0XHRcdG9yaWdpbmFsRXZlbnQuZGF0YVRyYW5zZmVyLnNldERhdGEoQ29kZURhdGFUcmFuc2ZlcnMuRklMRVMsIEpTT04uc3RyaW5naWZ5KGZpbGVSZXNvdXJjZXMpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvbkRyYWdTdGFydChkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAob3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdGNvbnN0IHRyZWVJdGVtc0RhdGEgPSAoZGF0YSBhcyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YTxJVHJlZUl0ZW0sIElUcmVlSXRlbVtdPikuZ2V0RGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VzOiBVUklbXSA9IFtdO1xuXHRcdFx0Y29uc3Qgc291cmNlSW5mbzogVHJlZURyYWdTb3VyY2VJbmZvID0ge1xuXHRcdFx0XHRpZDogdGhpcy50cmVlSWQsXG5cdFx0XHRcdGl0ZW1IYW5kbGVzOiBbXVxuXHRcdFx0fTtcblx0XHRcdHRyZWVJdGVtc0RhdGEuZm9yRWFjaChpdGVtID0+IHtcblx0XHRcdFx0c291cmNlSW5mby5pdGVtSGFuZGxlcy5wdXNoKGl0ZW0uaGFuZGxlKTtcblx0XHRcdFx0aWYgKGl0ZW0ucmVzb3VyY2VVcmkpIHtcblx0XHRcdFx0XHRyZXNvdXJjZXMucHVzaChVUkkucmV2aXZlKGl0ZW0ucmVzb3VyY2VVcmkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmFkZFJlc291cmNlSW5mb1RvVHJhbnNmZXIob3JpZ2luYWxFdmVudCwgcmVzb3VyY2VzKTtcblx0XHRcdHRoaXMuYWRkRXh0ZW5zaW9uUHJvdmlkZWRUcmFuc2ZlclR5cGVzKG9yaWdpbmFsRXZlbnQsIHNvdXJjZUluZm8uaXRlbUhhbmRsZXMpO1xuXHRcdFx0b3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YSh0aGlzLnRyZWVNaW1lVHlwZSxcblx0XHRcdFx0SlNPTi5zdHJpbmdpZnkoc291cmNlSW5mbykpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZGVidWdMb2codHlwZXM6IFNldDxzdHJpbmc+KSB7XG5cdFx0aWYgKHR5cGVzLnNpemUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZyhgVHJlZVZpZXcgZHJhZ2dlZCBtaW1lIHR5cGVzOiAke0FycmF5LmZyb20odHlwZXMpLmpvaW4oJywgJyl9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZyhgVHJlZVZpZXcgZHJhZ2dlZCB3aXRoIG5vIHN1cHBvcnRlZCBtaW1lIHR5cGVzLmApO1xuXHRcdH1cblx0fVxuXG5cdG9uRHJhZ092ZXIoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0RWxlbWVudDogSVRyZWVJdGVtLCB0YXJnZXRJbmRleDogbnVtYmVyLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuIHwgSVRyZWVEcmFnT3ZlclJlYWN0aW9uIHtcblx0XHRjb25zdCBkYXRhVHJhbnNmZXIgPSB0b0V4dGVybmFsVlNEYXRhVHJhbnNmZXIob3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIhKTtcblxuXHRcdGNvbnN0IHR5cGVzID0gbmV3IFNldDxzdHJpbmc+KEFycmF5LmZyb20oZGF0YVRyYW5zZmVyLCB4ID0+IHhbMF0pKTtcblxuXHRcdGlmIChvcmlnaW5hbEV2ZW50LmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0Ly8gQWxzbyBhZGQgdXJpLWxpc3QgaWYgd2UgaGF2ZSBhbnkgZmlsZXMuIEF0IHRoaXMgc3RhZ2Ugd2UgY2FuJ3QgYWN0dWFsbHkgYWNjZXNzIHRoZSBmaWxlIGl0c2VsZiB0aG91Z2guXG5cdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2Ygb3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIuaXRlbXMpIHtcblx0XHRcdFx0aWYgKGl0ZW0ua2luZCA9PT0gJ2ZpbGUnIHx8IGl0ZW0udHlwZSA9PT0gRGF0YVRyYW5zZmVycy5SRVNPVVJDRVMudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0XHRcdHR5cGVzLmFkZChNaW1lcy51cmlMaXN0KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuZGVidWdMb2codHlwZXMpO1xuXG5cdFx0Y29uc3QgZG5kQ29udHJvbGxlciA9IHRoaXMuZG5kQ29udHJvbGxlcjtcblx0XHRpZiAoIWRuZENvbnRyb2xsZXIgfHwgIW9yaWdpbmFsRXZlbnQuZGF0YVRyYW5zZmVyIHx8IChkbmRDb250cm9sbGVyLmRyb3BNaW1lVHlwZXMubGVuZ3RoID09PSAwKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBkcmFnQ29udGFpbmVyc1N1cHBvcnRlZFR5cGUgPSBBcnJheS5mcm9tKHR5cGVzKS5zb21lKCh2YWx1ZSwgaW5kZXgpID0+IHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gdGhpcy50cmVlTWltZVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gZG5kQ29udHJvbGxlci5kcm9wTWltZVR5cGVzLmluZGV4T2YodmFsdWUpID49IDA7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aWYgKGRyYWdDb250YWluZXJzU3VwcG9ydGVkVHlwZSkge1xuXHRcdFx0cmV0dXJuIHsgYWNjZXB0OiB0cnVlLCBidWJibGU6IFRyZWVEcmFnT3ZlckJ1YmJsZS5Eb3duLCBhdXRvRXhwYW5kOiB0cnVlIH07XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGdldERyYWdVUkkoZWxlbWVudDogSVRyZWVJdGVtKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLmRuZENvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gZWxlbWVudC5yZXNvdXJjZVVyaSA/IFVSSS5yZXZpdmUoZWxlbWVudC5yZXNvdXJjZVVyaSkudG9TdHJpbmcoKSA6IGVsZW1lbnQuaGFuZGxlO1xuXHR9XG5cblx0Z2V0RHJhZ0xhYmVsPyhlbGVtZW50czogSVRyZWVJdGVtW10pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5kbmRDb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoZWxlbWVudHMubGVuZ3RoID4gMSkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyhlbGVtZW50cy5sZW5ndGgpO1xuXHRcdH1cblx0XHRjb25zdCBlbGVtZW50ID0gZWxlbWVudHNbMF07XG5cdFx0cmV0dXJuIGVsZW1lbnQubGFiZWwgPyBlbGVtZW50LmxhYmVsLmxhYmVsIDogKGVsZW1lbnQucmVzb3VyY2VVcmkgPyB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChVUkkucmV2aXZlKGVsZW1lbnQucmVzb3VyY2VVcmkpKSA6IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRhc3luYyBkcm9wKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldE5vZGU6IElUcmVlSXRlbSB8IHVuZGVmaW5lZCwgdGFyZ2V0SW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCwgdGFyZ2V0U2VjdG9yOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZG5kQ29udHJvbGxlciA9IHRoaXMuZG5kQ29udHJvbGxlcjtcblx0XHRpZiAoIW9yaWdpbmFsRXZlbnQuZGF0YVRyYW5zZmVyIHx8ICFkbmRDb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHRyZWVTb3VyY2VJbmZvOiBUcmVlRHJhZ1NvdXJjZUluZm8gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHdpbGxEcm9wVXVpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLnRyZWVJdGVtc1RyYW5zZmVyLmhhc0RhdGEoRHJhZ2dlZFRyZWVJdGVtc0lkZW50aWZpZXIucHJvdG90eXBlKSkge1xuXHRcdFx0d2lsbERyb3BVdWlkID0gdGhpcy50cmVlSXRlbXNUcmFuc2Zlci5nZXREYXRhKERyYWdnZWRUcmVlSXRlbXNJZGVudGlmaWVyLnByb3RvdHlwZSkhWzBdLmlkZW50aWZpZXI7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3JpZ2luYWxEYXRhVHJhbnNmZXIgPSB0b0V4dGVybmFsVlNEYXRhVHJhbnNmZXIob3JpZ2luYWxFdmVudC5kYXRhVHJhbnNmZXIsIHRydWUpO1xuXG5cdFx0Y29uc3Qgb3V0RGF0YVRyYW5zZmVyID0gbmV3IFZTRGF0YVRyYW5zZmVyKCk7XG5cdFx0Zm9yIChjb25zdCBbdHlwZSwgaXRlbV0gb2Ygb3JpZ2luYWxEYXRhVHJhbnNmZXIpIHtcblx0XHRcdGlmICh0eXBlID09PSB0aGlzLnRyZWVNaW1lVHlwZSB8fCBkbmRDb250cm9sbGVyLmRyb3BNaW1lVHlwZXMuaW5jbHVkZXModHlwZSkgfHwgKGl0ZW0uYXNGaWxlKCkgJiYgZG5kQ29udHJvbGxlci5kcm9wTWltZVR5cGVzLmluY2x1ZGVzKERhdGFUcmFuc2ZlcnMuRklMRVMudG9Mb3dlckNhc2UoKSkpKSB7XG5cdFx0XHRcdG91dERhdGFUcmFuc2Zlci5hcHBlbmQodHlwZSwgaXRlbSk7XG5cdFx0XHRcdGlmICh0eXBlID09PSB0aGlzLnRyZWVNaW1lVHlwZSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR0cmVlU291cmNlSW5mbyA9IEpTT04ucGFyc2UoYXdhaXQgaXRlbS5hc1N0cmluZygpKTtcblx0XHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHRcdC8vIG5vb3Bcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBhZGRpdGlvbmFsRGF0YVRyYW5zZmVyID0gYXdhaXQgdGhpcy50cmVlVmlld3NEcmFnQW5kRHJvcFNlcnZpY2UucmVtb3ZlRHJhZ09wZXJhdGlvblRyYW5zZmVyKHdpbGxEcm9wVXVpZCk7XG5cdFx0aWYgKGFkZGl0aW9uYWxEYXRhVHJhbnNmZXIpIHtcblx0XHRcdGZvciAoY29uc3QgW3R5cGUsIGl0ZW1dIG9mIGFkZGl0aW9uYWxEYXRhVHJhbnNmZXIpIHtcblx0XHRcdFx0b3V0RGF0YVRyYW5zZmVyLmFwcGVuZCh0eXBlLCBpdGVtKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGRuZENvbnRyb2xsZXIuaGFuZGxlRHJvcChvdXREYXRhVHJhbnNmZXIsIHRhcmdldE5vZGUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUsIHdpbGxEcm9wVXVpZCwgdHJlZVNvdXJjZUluZm8/LmlkLCB0cmVlU291cmNlSW5mbz8uaXRlbUhhbmRsZXMpO1xuXHR9XG5cblx0b25EcmFnRW5kKG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuXHRcdC8vIENoZWNrIGlmIHRoZSBkcmFnIHdhcyBjYW5jZWxsZWQuXG5cdFx0aWYgKG9yaWdpbmFsRXZlbnQuZGF0YVRyYW5zZmVyPy5kcm9wRWZmZWN0ID09PSAnbm9uZScpIHtcblx0XHRcdHRoaXMuZHJhZ0NhbmNlbGxhdGlvblRva2VuPy5jYW5jZWwoKTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQgeyB9XG59XG5cbmZ1bmN0aW9uIHNldENhc2NhZGluZ0NoZWNrYm94VXBkYXRlcyhpdGVtczogcmVhZG9ubHkgSVRyZWVJdGVtW10pIHtcblx0Y29uc3QgYWRkaXRpb25hbEl0ZW1zOiBJVHJlZUl0ZW1bXSA9IFtdO1xuXG5cdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuXHRcdGlmIChpdGVtLmNoZWNrYm94ICE9PSB1bmRlZmluZWQpIHtcblxuXHRcdFx0Y29uc3QgY2hlY2tDaGlsZHJlbiA9IChjdXJyZW50SXRlbTogSVRyZWVJdGVtKSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgKGN1cnJlbnRJdGVtLmNoaWxkcmVuID8/IFtdKSkge1xuXHRcdFx0XHRcdGlmICgoY2hpbGQuY2hlY2tib3ggIT09IHVuZGVmaW5lZCkgJiYgKGN1cnJlbnRJdGVtLmNoZWNrYm94ICE9PSB1bmRlZmluZWQpICYmIChjaGlsZC5jaGVja2JveC5pc0NoZWNrZWQgIT09IGN1cnJlbnRJdGVtLmNoZWNrYm94LmlzQ2hlY2tlZCkpIHtcblx0XHRcdFx0XHRcdGNoaWxkLmNoZWNrYm94LmlzQ2hlY2tlZCA9IGN1cnJlbnRJdGVtLmNoZWNrYm94LmlzQ2hlY2tlZDtcblx0XHRcdFx0XHRcdGFkZGl0aW9uYWxJdGVtcy5wdXNoKGNoaWxkKTtcblx0XHRcdFx0XHRcdGNoZWNrQ2hpbGRyZW4oY2hpbGQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdGNoZWNrQ2hpbGRyZW4oaXRlbSk7XG5cblx0XHRcdGNvbnN0IHZpc2l0ZWRQYXJlbnRzOiBTZXQ8SVRyZWVJdGVtPiA9IG5ldyBTZXQoKTtcblx0XHRcdGNvbnN0IGNoZWNrUGFyZW50cyA9IChjdXJyZW50SXRlbTogSVRyZWVJdGVtKSA9PiB7XG5cdFx0XHRcdGlmIChjdXJyZW50SXRlbS5wYXJlbnQgJiYgKGN1cnJlbnRJdGVtLnBhcmVudC5jaGVja2JveCAhPT0gdW5kZWZpbmVkKSAmJiBjdXJyZW50SXRlbS5wYXJlbnQuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRpZiAodmlzaXRlZFBhcmVudHMuaGFzKGN1cnJlbnRJdGVtLnBhcmVudCkpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dmlzaXRlZFBhcmVudHMuYWRkKGN1cnJlbnRJdGVtLnBhcmVudCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bGV0IHNvbWVVbmNoZWNrZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRsZXQgc29tZUNoZWNrZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGN1cnJlbnRJdGVtLnBhcmVudC5jaGlsZHJlbikge1xuXHRcdFx0XHRcdFx0aWYgKHNvbWVVbmNoZWNrZWQgJiYgc29tZUNoZWNrZWQpIHtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoY2hpbGQuY2hlY2tib3ggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRpZiAoY2hpbGQuY2hlY2tib3guaXNDaGVja2VkKSB7XG5cdFx0XHRcdFx0XHRcdFx0c29tZUNoZWNrZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHNvbWVVbmNoZWNrZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChzb21lQ2hlY2tlZCAmJiAhc29tZVVuY2hlY2tlZCAmJiAoY3VycmVudEl0ZW0ucGFyZW50LmNoZWNrYm94LmlzQ2hlY2tlZCAhPT0gdHJ1ZSkpIHtcblx0XHRcdFx0XHRcdGN1cnJlbnRJdGVtLnBhcmVudC5jaGVja2JveC5pc0NoZWNrZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0YWRkaXRpb25hbEl0ZW1zLnB1c2goY3VycmVudEl0ZW0ucGFyZW50KTtcblx0XHRcdFx0XHRcdGNoZWNrUGFyZW50cyhjdXJyZW50SXRlbS5wYXJlbnQpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoc29tZVVuY2hlY2tlZCAmJiAoY3VycmVudEl0ZW0ucGFyZW50LmNoZWNrYm94LmlzQ2hlY2tlZCAhPT0gZmFsc2UpKSB7XG5cdFx0XHRcdFx0XHRjdXJyZW50SXRlbS5wYXJlbnQuY2hlY2tib3guaXNDaGVja2VkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRhZGRpdGlvbmFsSXRlbXMucHVzaChjdXJyZW50SXRlbS5wYXJlbnQpO1xuXHRcdFx0XHRcdFx0Y2hlY2tQYXJlbnRzKGN1cnJlbnRJdGVtLnBhcmVudCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0Y2hlY2tQYXJlbnRzKGl0ZW0pO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBpdGVtcy5jb25jYXQoYWRkaXRpb25hbEl0ZW1zKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxxQkFBdUM7QUFDaEQsWUFBWSxTQUFTO0FBQ3JCLFlBQVksV0FBVztBQUN2QixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGlCQUEwQztBQUNuRCxTQUFTLHNCQUFzQjtBQUkvQixTQUFxSCwwQkFBMEI7QUFDL0ksU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxjQUF1QixpQkFBaUI7QUFDakQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLGVBQWU7QUFDeEIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxxQkFBaUM7QUFDMUMsU0FBMEIsa0JBQWtCLHNCQUFzQjtBQUNsRSxTQUFTLFlBQVksaUJBQThCLG1CQUFtQixvQkFBb0I7QUFDMUYsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFVBQVUsZUFBZTtBQUNsQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTztBQUNQLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCLDZCQUE2QjtBQUM1RCxTQUFTLFNBQVMsY0FBYyxRQUFRLGNBQWMsdUJBQXVCO0FBQzdFLFNBQVMsa0JBQWtCLHVCQUF1QjtBQUNsRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUEyRSxvQkFBb0IscUJBQXFCO0FBQzdILFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZC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
