import { ElementsDragAndDropData } from "../list/listView.js";
import { ComposedTreeDelegate, TreeFindMode, FindFilter, FindController } from "./abstractTree.js";
import { getVisibleState, isFilterResult } from "./indexTreeModel.js";
import { CompressibleObjectTree, ObjectTree } from "./objectTree.js";
import { ObjectTreeElementCollapseState, TreeError, TreeVisibility, WeakMapper } from "./tree.js";
import { createCancelablePromise, Promises, ThrottledDelayer, timeout } from "../../../common/async.js";
import { Codicon } from "../../../common/codicons.js";
import { ThemeIcon } from "../../../common/themables.js";
import { isCancellationError, onUnexpectedError } from "../../../common/errors.js";
import { Emitter, Event } from "../../../common/event.js";
import { Iterable } from "../../../common/iterator.js";
import { DisposableStore, dispose, toDisposable } from "../../../common/lifecycle.js";
import { isIterable } from "../../../common/types.js";
import { CancellationTokenSource } from "../../../common/cancellation.js";
import { FuzzyScore } from "../../../common/filters.js";
import { insertInto, splice } from "../../../common/arrays.js";
import { localize } from "../../../../nls.js";
function createAsyncDataTreeNode(props) {
  return {
    ...props,
    children: [],
    refreshPromise: void 0,
    stale: true,
    slow: false,
    forceExpanded: false
  };
}
function isAncestor(ancestor, descendant) {
  if (!descendant.parent) {
    return false;
  } else if (descendant.parent === ancestor) {
    return true;
  } else {
    return isAncestor(ancestor, descendant.parent);
  }
}
function intersects(node, other) {
  return node === other || isAncestor(node, other) || isAncestor(other, node);
}
class AsyncDataTreeNodeWrapper {
  constructor(node) {
    this.node = node;
  }
  get element() {
    return this.node.element.element;
  }
  get children() {
    return this.node.children.map((node) => new AsyncDataTreeNodeWrapper(node));
  }
  get depth() {
    return this.node.depth;
  }
  get visibleChildrenCount() {
    return this.node.visibleChildrenCount;
  }
  get visibleChildIndex() {
    return this.node.visibleChildIndex;
  }
  get collapsible() {
    return this.node.collapsible;
  }
  get collapsed() {
    return this.node.collapsed;
  }
  get visible() {
    return this.node.visible;
  }
  get filterData() {
    return this.node.filterData;
  }
}
class AsyncDataTreeRenderer {
  constructor(renderer, nodeMapper, onDidChangeTwistieState) {
    this.renderer = renderer;
    this.nodeMapper = nodeMapper;
    this.onDidChangeTwistieState = onDidChangeTwistieState;
    this.renderedNodes = /* @__PURE__ */ new Map();
    this.templateId = renderer.templateId;
  }
  renderTemplate(container) {
    const templateData = this.renderer.renderTemplate(container);
    return { templateData };
  }
  renderElement(node, index, templateData, height) {
    this.renderer.renderElement(this.nodeMapper.map(node), index, templateData.templateData, height);
  }
  renderTwistie(element, twistieElement) {
    if (element.slow) {
      twistieElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.treeItemLoading));
      return true;
    } else {
      twistieElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.treeItemLoading));
      return false;
    }
  }
  disposeElement(node, index, templateData, height) {
    this.renderer.disposeElement?.(this.nodeMapper.map(node), index, templateData.templateData, height);
  }
  disposeTemplate(templateData) {
    this.renderer.disposeTemplate(templateData.templateData);
  }
  dispose() {
    this.renderedNodes.clear();
  }
}
function asTreeEvent(e) {
  return {
    browserEvent: e.browserEvent,
    elements: e.elements.map((e2) => e2.element)
  };
}
function asTreeMouseEvent(e) {
  return {
    browserEvent: e.browserEvent,
    element: e.element && e.element.element,
    target: e.target
  };
}
function asTreeContextMenuEvent(e) {
  return {
    browserEvent: e.browserEvent,
    element: e.element && e.element.element,
    anchor: e.anchor,
    isStickyScroll: e.isStickyScroll
  };
}
class AsyncDataTreeElementsDragAndDropData extends ElementsDragAndDropData {
  constructor(data) {
    super(data.elements.map((node) => node.element));
    this.data = data;
  }
  set context(context) {
    this.data.context = context;
  }
  get context() {
    return this.data.context;
  }
}
function asAsyncDataTreeDragAndDropData(data) {
  if (data instanceof ElementsDragAndDropData) {
    return new AsyncDataTreeElementsDragAndDropData(data);
  }
  return data;
}
class AsyncDataTreeNodeListDragAndDrop {
  constructor(dnd) {
    this.dnd = dnd;
  }
  getDragURI(node) {
    return this.dnd.getDragURI(node.element);
  }
  getDragLabel(nodes, originalEvent) {
    if (this.dnd.getDragLabel) {
      return this.dnd.getDragLabel(nodes.map((node) => node.element), originalEvent);
    }
    return void 0;
  }
  onDragStart(data, originalEvent) {
    this.dnd.onDragStart?.(asAsyncDataTreeDragAndDropData(data), originalEvent);
  }
  onDragOver(data, targetNode, targetIndex, targetSector, originalEvent, raw = true) {
    return this.dnd.onDragOver(asAsyncDataTreeDragAndDropData(data), targetNode && targetNode.element, targetIndex, targetSector, originalEvent);
  }
  drop(data, targetNode, targetIndex, targetSector, originalEvent) {
    this.dnd.drop(asAsyncDataTreeDragAndDropData(data), targetNode && targetNode.element, targetIndex, targetSector, originalEvent);
  }
  onDragEnd(originalEvent) {
    this.dnd.onDragEnd?.(originalEvent);
  }
  dispose() {
    this.dnd.dispose();
  }
}
class AsyncFindFilter extends FindFilter {
  constructor(findProvider, keyboardNavigationLabelProvider, filter) {
    super(keyboardNavigationLabelProvider, filter);
    this.findProvider = findProvider;
    this.isFindSessionActive = false;
  }
  filter(element, parentVisibility) {
    const filterResult = super.filter(element, parentVisibility);
    if (!this.isFindSessionActive || this.findMode === TreeFindMode.Highlight || !this.findProvider.isVisible) {
      return filterResult;
    }
    const visibility = isFilterResult(filterResult) ? filterResult.visibility : filterResult;
    if (getVisibleState(visibility) === TreeVisibility.Hidden) {
      return TreeVisibility.Hidden;
    }
    return this.findProvider.isVisible(element) ? filterResult : TreeVisibility.Hidden;
  }
}
class AsyncFindController extends FindController {
  constructor(tree, findProvider, filter, contextViewProvider, options) {
    super(tree, filter, contextViewProvider, options);
    this.findProvider = findProvider;
    this.filter = filter;
    this.activeSession = false;
    this.asyncWorkInProgress = false;
    this.taskQueue = new ThrottledDelayer(250);
    this.disposables.add(toDisposable(async () => {
      if (this.activeSession) {
        await this.findProvider.endSession?.();
      }
    }));
  }
  applyPattern(_pattern) {
    this.renderMessage(false);
    this.activeTokenSource?.cancel();
    this.activeTokenSource = new CancellationTokenSource();
    this.taskQueue.trigger(() => this.applyPatternAsync());
  }
  async applyPatternAsync() {
    const token = this.activeTokenSource?.token;
    if (!token || token.isCancellationRequested) {
      return;
    }
    const pattern = this.pattern;
    if (pattern === "") {
      if (this.activeSession) {
        this.asyncWorkInProgress = true;
        await this.deactivateFindSession();
        this.asyncWorkInProgress = false;
        if (!token.isCancellationRequested) {
          this.filter.reset();
          super.applyPattern("");
        }
      }
      return;
    }
    if (!this.activeSession) {
      this.activateFindSession();
    }
    this.asyncWorkInProgress = true;
    this.activeFindMetadata = void 0;
    const findMetadata = await this.findProvider.find(pattern, { matchType: this.matchType, findMode: this.mode }, token);
    if (token.isCancellationRequested || findMetadata === void 0) {
      return;
    }
    this.asyncWorkInProgress = false;
    this.activeFindMetadata = findMetadata;
    this.filter.reset();
    super.applyPattern(pattern);
    if (findMetadata.warningMessage) {
      this.renderMessage(true, findMetadata.warningMessage);
    }
  }
  activateFindSession() {
    this.activeSession = true;
    this.filter.isFindSessionActive = true;
    this.findProvider.startSession?.();
  }
  async deactivateFindSession() {
    this.activeSession = false;
    this.filter.isFindSessionActive = false;
    await this.findProvider.endSession?.();
  }
  render() {
    if (this.asyncWorkInProgress || !this.activeFindMetadata) {
      return;
    }
    const showNotFound = this.activeFindMetadata.matchCount === 0 && this.pattern.length > 0;
    this.renderMessage(showNotFound);
    if (this.pattern.length) {
      this.alertResults(this.activeFindMetadata.matchCount);
    }
  }
  onDidToggleChange(e) {
    this.toggles.set(e.id, e.isChecked);
    this.filter.findMode = this.mode;
    this.filter.findMatchType = this.matchType;
    this.placeholder = this.mode === TreeFindMode.Filter ? localize("type to filter", "Type to filter") : localize("type to search", "Type to search");
    this.applyPattern(this.pattern);
  }
  shouldAllowFocus(node) {
    return this.shouldFocusWhenNavigating(node);
  }
  shouldFocusWhenNavigating(node) {
    if (!this.activeSession || !this.activeFindMetadata) {
      return true;
    }
    const element = node.element?.element;
    if (element && this.activeFindMetadata.isMatch(element)) {
      return true;
    }
    return !FuzzyScore.isDefault(node.filterData);
  }
}
function asObjectTreeOptions(options) {
  return options && {
    ...options,
    collapseByDefault: true,
    identityProvider: options.identityProvider && {
      getId(el) {
        return options.identityProvider.getId(el.element);
      }
    },
    dnd: options.dnd && new AsyncDataTreeNodeListDragAndDrop(options.dnd),
    multipleSelectionController: options.multipleSelectionController && {
      isSelectionSingleChangeEvent(e) {
        return options.multipleSelectionController.isSelectionSingleChangeEvent({ ...e, element: e.element });
      },
      isSelectionRangeChangeEvent(e) {
        return options.multipleSelectionController.isSelectionRangeChangeEvent({ ...e, element: e.element });
      }
    },
    accessibilityProvider: options.accessibilityProvider && {
      ...options.accessibilityProvider,
      getPosInSet: void 0,
      getSetSize: void 0,
      getRole: options.accessibilityProvider.getRole ? (el) => {
        return options.accessibilityProvider.getRole(el.element);
      } : () => "treeitem",
      isChecked: options.accessibilityProvider.isChecked ? (e) => {
        return !!options.accessibilityProvider?.isChecked(e.element);
      } : void 0,
      getAriaLabel(e) {
        return options.accessibilityProvider.getAriaLabel(e.element);
      },
      getWidgetAriaLabel() {
        return options.accessibilityProvider.getWidgetAriaLabel();
      },
      getWidgetRole: options.accessibilityProvider.getWidgetRole ? () => options.accessibilityProvider.getWidgetRole() : () => "tree",
      getAriaLevel: options.accessibilityProvider.getAriaLevel && ((node) => {
        return options.accessibilityProvider.getAriaLevel(node.element);
      }),
      getActiveDescendantId: options.accessibilityProvider.getActiveDescendantId && ((node) => {
        return options.accessibilityProvider.getActiveDescendantId(node.element);
      })
    },
    filter: options.filter && {
      filter(e, parentVisibility) {
        return options.filter.filter(e.element, parentVisibility);
      }
    },
    keyboardNavigationLabelProvider: options.keyboardNavigationLabelProvider && {
      ...options.keyboardNavigationLabelProvider,
      getKeyboardNavigationLabel(e) {
        return options.keyboardNavigationLabelProvider.getKeyboardNavigationLabel(e.element);
      }
    },
    sorter: void 0,
    expandOnlyOnTwistieClick: typeof options.expandOnlyOnTwistieClick === "undefined" ? void 0 : typeof options.expandOnlyOnTwistieClick !== "function" ? options.expandOnlyOnTwistieClick : (e) => options.expandOnlyOnTwistieClick(e.element),
    defaultFindVisibility: (e) => {
      if (e.hasChildren && e.stale) {
        return TreeVisibility.Visible;
      } else if (typeof options.defaultFindVisibility === "number") {
        return options.defaultFindVisibility;
      } else if (typeof options.defaultFindVisibility === "undefined") {
        return TreeVisibility.Recurse;
      } else {
        return options.defaultFindVisibility(e.element);
      }
    }
  };
}
function dfs(node, fn) {
  fn(node);
  node.children.forEach((child) => dfs(child, fn));
}
class AsyncDataTree {
  constructor(user, container, delegate, renderers, dataSource, options = {}) {
    this.user = user;
    this.dataSource = dataSource;
    this.nodes = /* @__PURE__ */ new Map();
    this.subTreeRefreshPromises = /* @__PURE__ */ new Map();
    this.refreshPromises = /* @__PURE__ */ new Map();
    this._onDidRender = new Emitter();
    this._onDidChangeNodeSlowState = new Emitter();
    this.nodeMapper = new WeakMapper((node) => new AsyncDataTreeNodeWrapper(node));
    this.disposables = new DisposableStore();
    this.identityProvider = options.identityProvider;
    this.autoExpandSingleChildren = typeof options.autoExpandSingleChildren === "undefined" ? false : options.autoExpandSingleChildren;
    this.sorter = options.sorter;
    this.getDefaultCollapseState = (e) => options.collapseByDefault ? options.collapseByDefault(e) ? ObjectTreeElementCollapseState.PreserveOrCollapsed : ObjectTreeElementCollapseState.PreserveOrExpanded : void 0;
    let asyncFindEnabled = false;
    let findFilter;
    if (options.findProvider && (options.findWidgetEnabled ?? true) && options.keyboardNavigationLabelProvider && options.contextViewProvider) {
      asyncFindEnabled = true;
      findFilter = new AsyncFindFilter(options.findProvider, options.keyboardNavigationLabelProvider, options.filter);
    }
    this.tree = this.createTree(user, container, delegate, renderers, { ...options, findWidgetEnabled: !asyncFindEnabled, filter: findFilter ?? options.filter });
    this.root = createAsyncDataTreeNode({
      element: void 0,
      parent: null,
      hasChildren: true,
      defaultCollapseState: void 0
    });
    if (this.identityProvider) {
      this.root = {
        ...this.root,
        id: null
      };
    }
    this.nodes.set(null, this.root);
    this.tree.onDidChangeCollapseState(this._onDidChangeCollapseState, this, this.disposables);
    if (asyncFindEnabled) {
      const findOptions = {
        styles: options.findWidgetStyles,
        showNotFoundMessage: options.showNotFoundMessage,
        defaultFindMatchType: options.defaultFindMatchType,
        defaultFindMode: options.defaultFindMode
      };
      this.findController = this.disposables.add(new AsyncFindController(this.tree, options.findProvider, findFilter, this.tree.options.contextViewProvider, findOptions));
      this.focusNavigationFilter = (node) => this.findController.shouldFocusWhenNavigating(node);
      this.onDidChangeFindOpenState = this.findController.onDidChangeOpenState;
      this.onDidChangeFindMode = this.findController.onDidChangeMode;
      this.onDidChangeFindMatchType = this.findController.onDidChangeMatchType;
    } else {
      this.onDidChangeFindOpenState = this.tree.onDidChangeFindOpenState;
      this.onDidChangeFindMode = this.tree.onDidChangeFindMode;
      this.onDidChangeFindMatchType = this.tree.onDidChangeFindMatchType;
    }
  }
  get onDidScroll() {
    return this.tree.onDidScroll;
  }
  get onDidChangeFocus() {
    return Event.map(this.tree.onDidChangeFocus, asTreeEvent);
  }
  get onDidChangeSelection() {
    return Event.map(this.tree.onDidChangeSelection, asTreeEvent);
  }
  get onKeyDown() {
    return this.tree.onKeyDown;
  }
  get onMouseClick() {
    return Event.map(this.tree.onMouseClick, asTreeMouseEvent);
  }
  get onMouseDblClick() {
    return Event.map(this.tree.onMouseDblClick, asTreeMouseEvent);
  }
  get onContextMenu() {
    return Event.map(this.tree.onContextMenu, asTreeContextMenuEvent);
  }
  get onTap() {
    return Event.map(this.tree.onTap, asTreeMouseEvent);
  }
  get onPointer() {
    return Event.map(this.tree.onPointer, asTreeMouseEvent);
  }
  get onDidFocus() {
    return this.tree.onDidFocus;
  }
  get onDidBlur() {
    return this.tree.onDidBlur;
  }
  /**
   * To be used internally only!
   * @deprecated
   */
  get onDidChangeModel() {
    return this.tree.onDidChangeModel;
  }
  get onDidChangeCollapseState() {
    return this.tree.onDidChangeCollapseState;
  }
  get onDidUpdateOptions() {
    return this.tree.onDidUpdateOptions;
  }
  get onDidChangeStickyScrollFocused() {
    return this.tree.onDidChangeStickyScrollFocused;
  }
  get findMode() {
    return this.findController ? this.findController.mode : this.tree.findMode;
  }
  set findMode(mode) {
    this.findController ? this.findController.mode = mode : this.tree.findMode = mode;
  }
  get findMatchType() {
    return this.findController ? this.findController.matchType : this.tree.findMatchType;
  }
  set findMatchType(matchType) {
    this.findController ? this.findController.matchType = matchType : this.tree.findMatchType = matchType;
  }
  get expandOnlyOnTwistieClick() {
    if (typeof this.tree.expandOnlyOnTwistieClick === "boolean") {
      return this.tree.expandOnlyOnTwistieClick;
    }
    const fn = this.tree.expandOnlyOnTwistieClick;
    return (element) => fn(this.nodes.get(element === this.root.element ? null : element) || null);
  }
  get onDidDispose() {
    return this.tree.onDidDispose;
  }
  createTree(user, container, delegate, renderers, options) {
    const objectTreeDelegate = new ComposedTreeDelegate(delegate);
    const objectTreeRenderers = renderers.map((r) => new AsyncDataTreeRenderer(r, this.nodeMapper, this._onDidChangeNodeSlowState.event));
    const objectTreeOptions = asObjectTreeOptions(options) || {};
    return new ObjectTree(user, container, objectTreeDelegate, objectTreeRenderers, objectTreeOptions);
  }
  updateOptions(optionsUpdate = {}) {
    if (this.findController) {
      if (optionsUpdate.defaultFindMode !== void 0) {
        this.findController.mode = optionsUpdate.defaultFindMode;
      }
      if (optionsUpdate.defaultFindMatchType !== void 0) {
        this.findController.matchType = optionsUpdate.defaultFindMatchType;
      }
    }
    this.tree.updateOptions(optionsUpdate);
  }
  get options() {
    return this.tree.options;
  }
  // Widget
  getHTMLElement() {
    return this.tree.getHTMLElement();
  }
  get contentHeight() {
    return this.tree.contentHeight;
  }
  get contentWidth() {
    return this.tree.contentWidth;
  }
  get onDidChangeContentHeight() {
    return this.tree.onDidChangeContentHeight;
  }
  get onDidChangeContentWidth() {
    return this.tree.onDidChangeContentWidth;
  }
  get scrollTop() {
    return this.tree.scrollTop;
  }
  set scrollTop(scrollTop) {
    this.tree.scrollTop = scrollTop;
  }
  get scrollLeft() {
    return this.tree.scrollLeft;
  }
  set scrollLeft(scrollLeft) {
    this.tree.scrollLeft = scrollLeft;
  }
  get scrollHeight() {
    return this.tree.scrollHeight;
  }
  get renderHeight() {
    return this.tree.renderHeight;
  }
  get lastVisibleElement() {
    return this.tree.lastVisibleElement.element;
  }
  get ariaLabel() {
    return this.tree.ariaLabel;
  }
  set ariaLabel(value) {
    this.tree.ariaLabel = value;
  }
  domFocus() {
    this.tree.domFocus();
  }
  isDOMFocused() {
    return this.tree.isDOMFocused();
  }
  navigate(start) {
    let startNode;
    if (start) {
      startNode = this.getDataNode(start);
    }
    return new AsyncDataTreeNavigator(this.tree.navigate(startNode));
  }
  layout(height, width) {
    this.tree.layout(height, width);
  }
  style(styles) {
    this.tree.style(styles);
  }
  // Model
  getInput() {
    return this.root.element;
  }
  async setInput(input, viewState) {
    this.refreshPromises.forEach((promise) => promise.cancel());
    this.refreshPromises.clear();
    this.root.element = input;
    const viewStateContext = viewState && { viewState, focus: [], selection: [] };
    await this._updateChildren(input, true, false, viewStateContext);
    if (viewStateContext) {
      this.tree.setFocus(viewStateContext.focus);
      this.tree.setSelection(viewStateContext.selection);
    }
    if (viewState && typeof viewState.scrollTop === "number") {
      this.scrollTop = viewState.scrollTop;
    }
  }
  async updateChildren(element = this.root.element, recursive = true, rerender = false, options) {
    await this._updateChildren(element, recursive, rerender, void 0, options);
  }
  async _updateChildren(element = this.root.element, recursive = true, rerender = false, viewStateContext, options) {
    if (typeof this.root.element === "undefined") {
      throw new TreeError(this.user, "Tree input not set");
    }
    if (this.root.refreshPromise) {
      await this.root.refreshPromise;
      await Event.toPromise(this._onDidRender.event);
    }
    const node = this.getDataNode(element);
    await this.refreshAndRenderNode(node, recursive, viewStateContext, options);
    if (rerender) {
      try {
        this.tree.rerender(node);
      } catch {
      }
    }
  }
  resort(element = this.root.element, recursive = true) {
    this.tree.resort(this.getDataNode(element), recursive);
  }
  hasNode(element) {
    return element === this.root.element || this.nodes.has(element);
  }
  // View
  rerender(element) {
    if (element === void 0 || element === this.root.element) {
      this.tree.rerender();
      return;
    }
    const node = this.getDataNode(element);
    this.tree.rerender(node);
  }
  updateElementHeight(element, height) {
    const node = this.getDataNode(element);
    this.tree.updateElementHeight(node, height);
  }
  updateWidth(element) {
    const node = this.getDataNode(element);
    this.tree.updateWidth(node);
  }
  // Tree
  getNode(element = this.root.element) {
    const dataNode = this.getDataNode(element);
    const node = this.tree.getNode(dataNode === this.root ? null : dataNode);
    return this.nodeMapper.map(node);
  }
  collapse(element, recursive = false) {
    const node = this.getDataNode(element);
    return this.tree.collapse(node === this.root ? null : node, recursive);
  }
  async expand(element, recursive = false) {
    if (typeof this.root.element === "undefined") {
      throw new TreeError(this.user, "Tree input not set");
    }
    if (this.root.refreshPromise) {
      await this.root.refreshPromise;
      await Event.toPromise(this._onDidRender.event);
    }
    const node = this.getDataNode(element);
    if (this.tree.hasElement(node) && !this.tree.isCollapsible(node)) {
      return false;
    }
    if (node.refreshPromise) {
      await this.root.refreshPromise;
      await Event.toPromise(this._onDidRender.event);
    }
    if (node !== this.root && !node.refreshPromise && !this.tree.isCollapsed(node)) {
      return false;
    }
    const result = this.tree.expand(node === this.root ? null : node, recursive);
    if (node.refreshPromise) {
      await this.root.refreshPromise;
      await Event.toPromise(this._onDidRender.event);
    }
    return result;
  }
  toggleCollapsed(element, recursive = false) {
    return this.tree.toggleCollapsed(this.getDataNode(element), recursive);
  }
  expandAll() {
    this.tree.expandAll();
  }
  async expandTo(element) {
    if (!this.dataSource.getParent) {
      throw new Error("Can't expand to element without getParent method");
    }
    const elements = [];
    while (!this.hasNode(element)) {
      element = this.dataSource.getParent(element);
      if (element !== this.root.element) {
        elements.push(element);
      }
    }
    for (const element2 of Iterable.reverse(elements)) {
      await this.expand(element2);
    }
    this.tree.expandTo(this.getDataNode(element));
  }
  collapseAll() {
    this.tree.collapseAll();
  }
  isCollapsible(element) {
    return this.tree.isCollapsible(this.getDataNode(element));
  }
  isCollapsed(element) {
    return this.tree.isCollapsed(this.getDataNode(element));
  }
  triggerTypeNavigation() {
    this.tree.triggerTypeNavigation();
  }
  openFind() {
    if (this.findController) {
      this.findController.open();
    } else {
      this.tree.openFind();
    }
  }
  closeFind() {
    if (this.findController) {
      this.findController.close();
    } else {
      this.tree.closeFind();
    }
  }
  refilter() {
    this.tree.refilter();
  }
  setAnchor(element) {
    this.tree.setAnchor(typeof element === "undefined" ? void 0 : this.getDataNode(element));
  }
  getAnchor() {
    const node = this.tree.getAnchor();
    return node?.element;
  }
  setSelection(elements, browserEvent) {
    const nodes = elements.map((e) => this.getDataNode(e));
    this.tree.setSelection(nodes, browserEvent);
  }
  getSelection() {
    const nodes = this.tree.getSelection();
    return nodes.map((n) => n.element);
  }
  setFocus(elements, browserEvent) {
    const nodes = elements.map((e) => this.getDataNode(e));
    this.tree.setFocus(nodes, browserEvent);
  }
  focusNext(n = 1, loop = false, browserEvent) {
    this.tree.focusNext(n, loop, browserEvent, this.focusNavigationFilter);
  }
  focusPrevious(n = 1, loop = false, browserEvent) {
    this.tree.focusPrevious(n, loop, browserEvent, this.focusNavigationFilter);
  }
  focusNextPage(browserEvent) {
    return this.tree.focusNextPage(browserEvent, this.focusNavigationFilter);
  }
  focusPreviousPage(browserEvent) {
    return this.tree.focusPreviousPage(browserEvent, this.focusNavigationFilter);
  }
  focusLast(browserEvent) {
    this.tree.focusLast(browserEvent, this.focusNavigationFilter);
  }
  focusFirst(browserEvent) {
    this.tree.focusFirst(browserEvent, this.focusNavigationFilter);
  }
  getFocus() {
    const nodes = this.tree.getFocus();
    return nodes.map((n) => n.element);
  }
  getStickyScrollFocus() {
    const nodes = this.tree.getStickyScrollFocus();
    return nodes.map((n) => n.element);
  }
  getFocusedPart() {
    return this.tree.getFocusedPart();
  }
  reveal(element, relativeTop) {
    this.tree.reveal(this.getDataNode(element), relativeTop);
  }
  getRelativeTop(element) {
    return this.tree.getRelativeTop(this.getDataNode(element));
  }
  // Tree navigation
  getParentElement(element) {
    const node = this.tree.getParentElement(this.getDataNode(element));
    return node && node.element;
  }
  getFirstElementChild(element = this.root.element) {
    const dataNode = this.getDataNode(element);
    const node = this.tree.getFirstElementChild(dataNode === this.root ? null : dataNode);
    return node && node.element;
  }
  // Implementation
  getDataNode(element) {
    const node = this.nodes.get(element === this.root.element ? null : element);
    if (!node) {
      const nodeIdentity = this.identityProvider?.getId(element).toString();
      throw new TreeError(this.user, `Data tree node not found${nodeIdentity ? `: ${nodeIdentity}` : ""}`);
    }
    return node;
  }
  async refreshAndRenderNode(node, recursive, viewStateContext, options) {
    if (this.disposables.isDisposed) {
      return;
    }
    await this.refreshNode(node, recursive, viewStateContext);
    if (this.disposables.isDisposed) {
      return;
    }
    this.render(node, viewStateContext, options);
  }
  async refreshNode(node, recursive, viewStateContext) {
    let result;
    this.subTreeRefreshPromises.forEach((refreshPromise, refreshNode) => {
      if (!result && intersects(refreshNode, node)) {
        result = refreshPromise.then(() => this.refreshNode(node, recursive, viewStateContext));
      }
    });
    if (result) {
      return result;
    }
    if (node !== this.root) {
      const treeNode = this.tree.getNode(node);
      if (treeNode.collapsed) {
        node.hasChildren = !!this.dataSource.hasChildren(node.element);
        node.stale = true;
        this.setChildren(node, [], recursive, viewStateContext);
        return;
      }
    }
    return this.doRefreshSubTree(node, recursive, viewStateContext);
  }
  async doRefreshSubTree(node, recursive, viewStateContext) {
    let done;
    node.refreshPromise = new Promise((c) => done = c);
    this.subTreeRefreshPromises.set(node, node.refreshPromise);
    node.refreshPromise.finally(() => {
      node.refreshPromise = void 0;
      this.subTreeRefreshPromises.delete(node);
    });
    try {
      const childrenToRefresh = await this.doRefreshNode(node, recursive, viewStateContext);
      node.stale = false;
      await Promises.settled(childrenToRefresh.map((child) => this.doRefreshSubTree(child, recursive, viewStateContext)));
    } finally {
      done();
    }
  }
  async doRefreshNode(node, recursive, viewStateContext) {
    node.hasChildren = !!this.dataSource.hasChildren(node.element);
    let childrenPromise;
    if (!node.hasChildren) {
      childrenPromise = Promise.resolve(Iterable.empty());
    } else {
      const children = this.doGetChildren(node);
      if (isIterable(children)) {
        childrenPromise = Promise.resolve(children);
      } else {
        const slowTimeout = timeout(800);
        slowTimeout.then(() => {
          node.slow = true;
          this._onDidChangeNodeSlowState.fire(node);
        }, (_) => null);
        childrenPromise = children.finally(() => slowTimeout.cancel());
      }
    }
    try {
      const children = await childrenPromise;
      return this.setChildren(node, children, recursive, viewStateContext);
    } catch (err) {
      if (node !== this.root && this.tree.hasElement(node)) {
        this.tree.collapse(node);
      }
      if (isCancellationError(err)) {
        return [];
      }
      throw err;
    } finally {
      if (node.slow) {
        node.slow = false;
        this._onDidChangeNodeSlowState.fire(node);
      }
    }
  }
  doGetChildren(node) {
    let result = this.refreshPromises.get(node);
    if (result) {
      return result;
    }
    const children = this.dataSource.getChildren(node.element);
    if (isIterable(children)) {
      return this.processChildren(children);
    } else {
      result = createCancelablePromise(async () => this.processChildren(await children));
      this.refreshPromises.set(node, result);
      return result.finally(() => {
        this.refreshPromises.delete(node);
      });
    }
  }
  _onDidChangeCollapseState({ node, deep }) {
    if (node.element === null) {
      return;
    }
    if (!node.collapsed && node.element.stale) {
      if (deep) {
        this.collapse(node.element.element);
      } else {
        this.refreshAndRenderNode(node.element, false).catch(onUnexpectedError);
      }
    }
  }
  setChildren(node, childrenElementsIterable, recursive, viewStateContext) {
    const childrenElements = [...childrenElementsIterable];
    if (node.children.length === 0 && childrenElements.length === 0) {
      return [];
    }
    const nodesToForget = /* @__PURE__ */ new Map();
    const childrenTreeNodesById = /* @__PURE__ */ new Map();
    for (const child of node.children) {
      nodesToForget.set(child.element, child);
      if (this.identityProvider) {
        childrenTreeNodesById.set(child.id, { node: child, collapsed: this.tree.hasElement(child) && this.tree.isCollapsed(child) });
      }
    }
    const childrenToRefresh = [];
    const children = childrenElements.map((element) => {
      const hasChildren = !!this.dataSource.hasChildren(element);
      if (!this.identityProvider) {
        const asyncDataTreeNode = createAsyncDataTreeNode({ element, parent: node, hasChildren, defaultCollapseState: this.getDefaultCollapseState(element) });
        if (hasChildren && asyncDataTreeNode.defaultCollapseState === ObjectTreeElementCollapseState.PreserveOrExpanded) {
          childrenToRefresh.push(asyncDataTreeNode);
        }
        return asyncDataTreeNode;
      }
      const id = this.identityProvider.getId(element).toString();
      const result = childrenTreeNodesById.get(id);
      if (result) {
        const asyncDataTreeNode = result.node;
        nodesToForget.delete(asyncDataTreeNode.element);
        this.nodes.delete(asyncDataTreeNode.element);
        this.nodes.set(element, asyncDataTreeNode);
        asyncDataTreeNode.element = element;
        asyncDataTreeNode.hasChildren = hasChildren;
        if (recursive) {
          if (result.collapsed) {
            asyncDataTreeNode.children.forEach((node2) => dfs(node2, (node3) => this.nodes.delete(node3.element)));
            asyncDataTreeNode.children.splice(0, asyncDataTreeNode.children.length);
            asyncDataTreeNode.stale = true;
          } else {
            childrenToRefresh.push(asyncDataTreeNode);
          }
        } else if (hasChildren && !result.collapsed) {
          childrenToRefresh.push(asyncDataTreeNode);
        }
        return asyncDataTreeNode;
      }
      const childAsyncDataTreeNode = createAsyncDataTreeNode({ element, parent: node, id, hasChildren, defaultCollapseState: this.getDefaultCollapseState(element) });
      if (viewStateContext && viewStateContext.viewState.focus && viewStateContext.viewState.focus.indexOf(id) > -1) {
        viewStateContext.focus.push(childAsyncDataTreeNode);
      }
      if (viewStateContext && viewStateContext.viewState.selection && viewStateContext.viewState.selection.indexOf(id) > -1) {
        viewStateContext.selection.push(childAsyncDataTreeNode);
      }
      if (viewStateContext && viewStateContext.viewState.expanded && viewStateContext.viewState.expanded.indexOf(id) > -1) {
        childrenToRefresh.push(childAsyncDataTreeNode);
      } else if (hasChildren && childAsyncDataTreeNode.defaultCollapseState === ObjectTreeElementCollapseState.PreserveOrExpanded) {
        childrenToRefresh.push(childAsyncDataTreeNode);
      }
      return childAsyncDataTreeNode;
    });
    for (const node2 of nodesToForget.values()) {
      dfs(node2, (node3) => this.nodes.delete(node3.element));
    }
    for (const child of children) {
      this.nodes.set(child.element, child);
    }
    splice(node.children, 0, node.children.length, children);
    if (node !== this.root && this.autoExpandSingleChildren && children.length === 1 && childrenToRefresh.length === 0) {
      children[0].forceExpanded = true;
      childrenToRefresh.push(children[0]);
    }
    return childrenToRefresh;
  }
  render(node, viewStateContext, options) {
    const children = node.children.map((node2) => this.asTreeElement(node2, viewStateContext));
    const objectTreeOptions = options && {
      ...options,
      diffIdentityProvider: options.diffIdentityProvider && {
        getId(node2) {
          return options.diffIdentityProvider.getId(node2.element);
        }
      }
    };
    this.tree.setChildren(node === this.root ? null : node, children, objectTreeOptions);
    if (node !== this.root) {
      this.tree.setCollapsible(node, node.hasChildren);
    }
    this._onDidRender.fire();
  }
  asTreeElement(node, viewStateContext) {
    if (node.stale) {
      return {
        element: node,
        collapsible: node.hasChildren,
        collapsed: true
      };
    }
    let collapsed;
    if (viewStateContext && viewStateContext.viewState.expanded && node.id && viewStateContext.viewState.expanded.indexOf(node.id) > -1) {
      collapsed = false;
    } else if (node.forceExpanded) {
      collapsed = false;
      node.forceExpanded = false;
    } else {
      collapsed = node.defaultCollapseState;
    }
    return {
      element: node,
      children: node.hasChildren ? Iterable.map(node.children, (child) => this.asTreeElement(child, viewStateContext)) : [],
      collapsible: node.hasChildren,
      collapsed
    };
  }
  processChildren(children) {
    if (this.sorter) {
      children = [...children].sort(this.sorter.compare.bind(this.sorter));
    }
    return children;
  }
  // view state
  getViewState() {
    if (!this.identityProvider) {
      throw new TreeError(this.user, "Can't get tree view state without an identity provider");
    }
    const getId = (element) => this.identityProvider.getId(element).toString();
    const focus = this.getFocus().map(getId);
    const selection = this.getSelection().map(getId);
    const expanded = [];
    const root = this.tree.getNode();
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node !== root && node.collapsible && !node.collapsed) {
        expanded.push(getId(node.element.element));
      }
      insertInto(stack, stack.length, node.children);
    }
    return { focus, selection, expanded, scrollTop: this.scrollTop };
  }
  dispose() {
    this.disposables.dispose();
    this.tree.dispose();
  }
}
class CompressibleAsyncDataTreeNodeWrapper {
  constructor(node) {
    this.node = node;
  }
  get element() {
    return {
      elements: this.node.element.elements.map((e) => e.element),
      incompressible: this.node.element.incompressible
    };
  }
  get children() {
    return this.node.children.map((node) => new CompressibleAsyncDataTreeNodeWrapper(node));
  }
  get depth() {
    return this.node.depth;
  }
  get visibleChildrenCount() {
    return this.node.visibleChildrenCount;
  }
  get visibleChildIndex() {
    return this.node.visibleChildIndex;
  }
  get collapsible() {
    return this.node.collapsible;
  }
  get collapsed() {
    return this.node.collapsed;
  }
  get visible() {
    return this.node.visible;
  }
  get filterData() {
    return this.node.filterData;
  }
}
class CompressibleAsyncDataTreeRenderer {
  constructor(renderer, nodeMapper, compressibleNodeMapperProvider, onDidChangeTwistieState) {
    this.renderer = renderer;
    this.nodeMapper = nodeMapper;
    this.compressibleNodeMapperProvider = compressibleNodeMapperProvider;
    this.onDidChangeTwistieState = onDidChangeTwistieState;
    this.renderedNodes = /* @__PURE__ */ new Map();
    this.disposables = [];
    this.templateId = renderer.templateId;
  }
  renderTemplate(container) {
    const templateData = this.renderer.renderTemplate(container);
    return { templateData };
  }
  renderElement(node, index, templateData, height) {
    this.renderer.renderElement(this.nodeMapper.map(node), index, templateData.templateData, height);
  }
  renderCompressedElements(node, index, templateData, height) {
    this.renderer.renderCompressedElements(this.compressibleNodeMapperProvider().map(node), index, templateData.templateData, height);
  }
  renderTwistie(element, twistieElement) {
    if (element.slow) {
      twistieElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.treeItemLoading));
      return true;
    } else {
      twistieElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.treeItemLoading));
      return false;
    }
  }
  disposeElement(node, index, templateData, height) {
    this.renderer.disposeElement?.(this.nodeMapper.map(node), index, templateData.templateData, height);
  }
  disposeCompressedElements(node, index, templateData, height) {
    this.renderer.disposeCompressedElements?.(this.compressibleNodeMapperProvider().map(node), index, templateData.templateData, height);
  }
  disposeTemplate(templateData) {
    this.renderer.disposeTemplate(templateData.templateData);
  }
  dispose() {
    this.renderedNodes.clear();
    this.disposables = dispose(this.disposables);
  }
}
function asCompressibleObjectTreeOptions(options) {
  const objectTreeOptions = options && asObjectTreeOptions(options);
  return objectTreeOptions && {
    ...objectTreeOptions,
    keyboardNavigationLabelProvider: objectTreeOptions.keyboardNavigationLabelProvider && {
      ...objectTreeOptions.keyboardNavigationLabelProvider,
      getCompressedNodeKeyboardNavigationLabel(els) {
        return options.keyboardNavigationLabelProvider.getCompressedNodeKeyboardNavigationLabel(els.map((e) => e.element));
      }
    }
  };
}
class CompressibleAsyncDataTree extends AsyncDataTree {
  constructor(user, container, virtualDelegate, compressionDelegate, renderers, dataSource, options = {}) {
    super(user, container, virtualDelegate, renderers, dataSource, options);
    this.compressionDelegate = compressionDelegate;
    this.compressibleNodeMapper = new WeakMapper((node) => new CompressibleAsyncDataTreeNodeWrapper(node));
    this.filter = options.filter;
  }
  getCompressedTreeNode(e) {
    const node = this.getDataNode(e);
    return this.tree.getCompressedTreeNode(node).element;
  }
  createTree(user, container, delegate, renderers, options) {
    const objectTreeDelegate = new ComposedTreeDelegate(delegate);
    const objectTreeRenderers = renderers.map((r) => new CompressibleAsyncDataTreeRenderer(r, this.nodeMapper, () => this.compressibleNodeMapper, this._onDidChangeNodeSlowState.event));
    const objectTreeOptions = asCompressibleObjectTreeOptions(options) || {};
    return new CompressibleObjectTree(user, container, objectTreeDelegate, objectTreeRenderers, objectTreeOptions);
  }
  asTreeElement(node, viewStateContext) {
    return {
      incompressible: this.compressionDelegate.isIncompressible(node.element),
      ...super.asTreeElement(node, viewStateContext)
    };
  }
  getViewState() {
    if (!this.identityProvider) {
      throw new TreeError(this.user, "Can't get tree view state without an identity provider");
    }
    const getId = (element) => this.identityProvider.getId(element).toString();
    const focus = this.getFocus().map(getId);
    const selection = this.getSelection().map(getId);
    const expanded = [];
    const root = this.tree.getCompressedTreeNode();
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node !== root && node.collapsible && !node.collapsed) {
        for (const asyncNode of node.element.elements) {
          expanded.push(getId(asyncNode.element));
        }
      }
      stack.push(...node.children);
    }
    return { focus, selection, expanded, scrollTop: this.scrollTop };
  }
  render(node, viewStateContext, options) {
    if (!this.identityProvider) {
      return super.render(node, viewStateContext);
    }
    const getId = (element) => this.identityProvider.getId(element).toString();
    const getUncompressedIds = (nodes) => {
      const result = /* @__PURE__ */ new Set();
      for (const node2 of nodes) {
        const compressedNode = this.tree.getCompressedTreeNode(node2 === this.root ? null : node2);
        if (!compressedNode.element) {
          continue;
        }
        for (const node3 of compressedNode.element.elements) {
          result.add(getId(node3.element));
        }
      }
      return result;
    };
    const oldSelection = getUncompressedIds(this.tree.getSelection());
    const oldFocus = getUncompressedIds(this.tree.getFocus());
    super.render(node, viewStateContext, options);
    const selection = this.getSelection();
    let didChangeSelection = false;
    const focus = this.getFocus();
    let didChangeFocus = false;
    const visit = (node2) => {
      const compressedNode = node2.element;
      if (compressedNode) {
        for (let i = 0; i < compressedNode.elements.length; i++) {
          const id = getId(compressedNode.elements[i].element);
          const element = compressedNode.elements[compressedNode.elements.length - 1].element;
          if (oldSelection.has(id) && selection.indexOf(element) === -1) {
            selection.push(element);
            didChangeSelection = true;
          }
          if (oldFocus.has(id) && focus.indexOf(element) === -1) {
            focus.push(element);
            didChangeFocus = true;
          }
        }
      }
      node2.children.forEach(visit);
    };
    visit(this.tree.getCompressedTreeNode(node === this.root ? null : node));
    if (didChangeSelection) {
      this.setSelection(selection);
    }
    if (didChangeFocus) {
      this.setFocus(focus);
    }
  }
  // For compressed async data trees, `TreeVisibility.Recurse` doesn't currently work
  // and we have to filter everything beforehand
  // Related to #85193 and #85835
  processChildren(children) {
    if (this.filter) {
      children = Iterable.filter(children, (e) => {
        const result = this.filter.filter(e, TreeVisibility.Visible);
        const visibility = getVisibility(result);
        if (visibility === TreeVisibility.Recurse) {
          throw new Error("Recursive tree visibility not supported in async data compressed trees");
        }
        return visibility === TreeVisibility.Visible;
      });
    }
    return super.processChildren(children);
  }
  navigate(start) {
    return super.navigate(start);
  }
}
function getVisibility(filterResult) {
  if (typeof filterResult === "boolean") {
    return filterResult ? TreeVisibility.Visible : TreeVisibility.Hidden;
  } else if (isFilterResult(filterResult)) {
    return getVisibleState(filterResult.visibility);
  } else {
    return getVisibleState(filterResult);
  }
}
class AsyncDataTreeNavigator {
  constructor(navigator) {
    this.navigator = navigator;
  }
  current() {
    const current = this.navigator.current();
    if (current === null) {
      return null;
    }
    return current.element;
  }
  previous() {
    this.navigator.previous();
    return this.current();
  }
  first() {
    this.navigator.first();
    return this.current();
  }
  last() {
    this.navigator.last();
    return this.current();
  }
  next() {
    this.navigator.next();
    return this.current();
  }
}
export {
  AsyncDataTree,
  CompressibleAsyncDataTree
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hc3luY0RhdGFUcmVlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSURyYWdBbmREcm9wRGF0YSB9IGZyb20gJy4uLy4uL2RuZC5qcyc7XG5pbXBvcnQgeyBJSWRlbnRpdHlQcm92aWRlciwgSUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIsIElMaXN0RHJhZ0FuZERyb3AsIElMaXN0RHJhZ092ZXJSZWFjdGlvbiwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgRWxlbWVudHNEcmFnQW5kRHJvcERhdGEsIExpc3RWaWV3VGFyZ2V0U2VjdG9yIH0gZnJvbSAnLi4vbGlzdC9saXN0Vmlldy5qcyc7XG5pbXBvcnQgeyBJTGlzdFN0eWxlcyB9IGZyb20gJy4uL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBDb21wb3NlZFRyZWVEZWxlZ2F0ZSwgVHJlZUZpbmRNb2RlIGFzIFRyZWVGaW5kTW9kZSwgSUFic3RyYWN0VHJlZU9wdGlvbnMsIElBYnN0cmFjdFRyZWVPcHRpb25zVXBkYXRlLCBUcmVlRmluZE1hdGNoVHlwZSwgQWJzdHJhY3RUcmVlUGFydCwgTGFiZWxGdXp6eVNjb3JlLCBGaW5kRmlsdGVyLCBGaW5kQ29udHJvbGxlciwgSVRyZWVGaW5kVG9nZ2xlQ2hhbmdlRXZlbnQsIElGaW5kQ29udHJvbGxlck9wdGlvbnMgfSBmcm9tICcuL2Fic3RyYWN0VHJlZS5qcyc7XG5pbXBvcnQgeyBJQ29tcHJlc3NlZFRyZWVFbGVtZW50LCBJQ29tcHJlc3NlZFRyZWVOb2RlIH0gZnJvbSAnLi9jb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsLmpzJztcbmltcG9ydCB7IGdldFZpc2libGVTdGF0ZSwgaXNGaWx0ZXJSZXN1bHQgfSBmcm9tICcuL2luZGV4VHJlZU1vZGVsLmpzJztcbmltcG9ydCB7IENvbXByZXNzaWJsZU9iamVjdFRyZWUsIElDb21wcmVzc2libGVLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyLCBJQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU9wdGlvbnMsIElDb21wcmVzc2libGVUcmVlUmVuZGVyZXIsIElPYmplY3RUcmVlT3B0aW9ucywgSU9iamVjdFRyZWVTZXRDaGlsZHJlbk9wdGlvbnMsIE9iamVjdFRyZWUgfSBmcm9tICcuL29iamVjdFRyZWUuanMnO1xuaW1wb3J0IHsgSUFzeW5jRGF0YVNvdXJjZSwgSUNvbGxhcHNlU3RhdGVDaGFuZ2VFdmVudCwgSU9iamVjdFRyZWVFbGVtZW50LCBJVHJlZUNvbnRleHRNZW51RXZlbnQsIElUcmVlRHJhZ0FuZERyb3AsIElUcmVlRXZlbnQsIElUcmVlRmlsdGVyLCBJVHJlZU1vdXNlRXZlbnQsIElUcmVlTmF2aWdhdG9yLCBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIsIElUcmVlU29ydGVyLCBPYmplY3RUcmVlRWxlbWVudENvbGxhcHNlU3RhdGUsIFRyZWVFcnJvciwgVHJlZUZpbHRlclJlc3VsdCwgVHJlZVZpc2liaWxpdHksIFdlYWtNYXBwZXIgfSBmcm9tICcuL3RyZWUuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBQcm9taXNlcywgVGhyb3R0bGVkRGVsYXllciwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2Nyb2xsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgeyBpc0l0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRWaWV3UHJvdmlkZXIgfSBmcm9tICcuLi9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBGdXp6eVNjb3JlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgaW5zZXJ0SW50bywgc3BsaWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbmludGVyZmFjZSBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiB7XG5cdGVsZW1lbnQ6IFRJbnB1dCB8IFQ7XG5cdHJlYWRvbmx5IHBhcmVudDogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4gfCBudWxsO1xuXHRyZWFkb25seSBjaGlsZHJlbjogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD5bXTtcblx0cmVhZG9ubHkgaWQ/OiBzdHJpbmcgfCBudWxsO1xuXHRyZWZyZXNoUHJvbWlzZTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblx0aGFzQ2hpbGRyZW46IGJvb2xlYW47XG5cdHN0YWxlOiBib29sZWFuO1xuXHRzbG93OiBib29sZWFuO1xuXHRyZWFkb25seSBkZWZhdWx0Q29sbGFwc2VTdGF0ZTogdW5kZWZpbmVkIHwgT2JqZWN0VHJlZUVsZW1lbnRDb2xsYXBzZVN0YXRlLlByZXNlcnZlT3JDb2xsYXBzZWQgfCBPYmplY3RUcmVlRWxlbWVudENvbGxhcHNlU3RhdGUuUHJlc2VydmVPckV4cGFuZGVkO1xuXHRmb3JjZUV4cGFuZGVkOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSUFzeW5jRGF0YVRyZWVOb2RlUmVxdWlyZWRQcm9wczxUSW5wdXQsIFQ+IGV4dGVuZHMgUGFydGlhbDxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPj4ge1xuXHRyZWFkb25seSBlbGVtZW50OiBUSW5wdXQgfCBUO1xuXHRyZWFkb25seSBwYXJlbnQ6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHwgbnVsbDtcblx0cmVhZG9ubHkgaGFzQ2hpbGRyZW46IGJvb2xlYW47XG5cdHJlYWRvbmx5IGRlZmF1bHRDb2xsYXBzZVN0YXRlOiB1bmRlZmluZWQgfCBPYmplY3RUcmVlRWxlbWVudENvbGxhcHNlU3RhdGUuUHJlc2VydmVPckNvbGxhcHNlZCB8IE9iamVjdFRyZWVFbGVtZW50Q29sbGFwc2VTdGF0ZS5QcmVzZXJ2ZU9yRXhwYW5kZWQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4ocHJvcHM6IElBc3luY0RhdGFUcmVlTm9kZVJlcXVpcmVkUHJvcHM8VElucHV0LCBUPik6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHtcblx0cmV0dXJuIHtcblx0XHQuLi5wcm9wcyxcblx0XHRjaGlsZHJlbjogW10sXG5cdFx0cmVmcmVzaFByb21pc2U6IHVuZGVmaW5lZCxcblx0XHRzdGFsZTogdHJ1ZSxcblx0XHRzbG93OiBmYWxzZSxcblx0XHRmb3JjZUV4cGFuZGVkOiBmYWxzZVxuXHR9O1xufVxuXG5mdW5jdGlvbiBpc0FuY2VzdG9yPFRJbnB1dCwgVD4oYW5jZXN0b3I6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBkZXNjZW5kYW50OiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPik6IGJvb2xlYW4ge1xuXHRpZiAoIWRlc2NlbmRhbnQucGFyZW50KSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9IGVsc2UgaWYgKGRlc2NlbmRhbnQucGFyZW50ID09PSBhbmNlc3Rvcikge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBpc0FuY2VzdG9yKGFuY2VzdG9yLCBkZXNjZW5kYW50LnBhcmVudCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gaW50ZXJzZWN0czxUSW5wdXQsIFQ+KG5vZGU6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBvdGhlcjogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4pOiBib29sZWFuIHtcblx0cmV0dXJuIG5vZGUgPT09IG90aGVyIHx8IGlzQW5jZXN0b3Iobm9kZSwgb3RoZXIpIHx8IGlzQW5jZXN0b3Iob3RoZXIsIG5vZGUpO1xufVxuXG5pbnRlcmZhY2UgSURhdGFUcmVlTGlzdFRlbXBsYXRlRGF0YTxUPiB7XG5cdHRlbXBsYXRlRGF0YTogVDtcbn1cblxudHlwZSBBc3luY0RhdGFUcmVlTm9kZU1hcHBlcjxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPiA9IFdlYWtNYXBwZXI8SVRyZWVOb2RlPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHwgbnVsbCwgVEZpbHRlckRhdGE+LCBJVHJlZU5vZGU8VElucHV0IHwgVCwgVEZpbHRlckRhdGE+PjtcblxuY2xhc3MgQXN5bmNEYXRhVHJlZU5vZGVXcmFwcGVyPFRJbnB1dCwgVCwgVEZpbHRlckRhdGE+IGltcGxlbWVudHMgSVRyZWVOb2RlPFRJbnB1dCB8IFQsIFRGaWx0ZXJEYXRhPiB7XG5cblx0Z2V0IGVsZW1lbnQoKTogVCB7IHJldHVybiB0aGlzLm5vZGUuZWxlbWVudCEuZWxlbWVudCBhcyBUOyB9XG5cdGdldCBjaGlsZHJlbigpOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+W10geyByZXR1cm4gdGhpcy5ub2RlLmNoaWxkcmVuLm1hcChub2RlID0+IG5ldyBBc3luY0RhdGFUcmVlTm9kZVdyYXBwZXIobm9kZSkpOyB9XG5cdGdldCBkZXB0aCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5ub2RlLmRlcHRoOyB9XG5cdGdldCB2aXNpYmxlQ2hpbGRyZW5Db3VudCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5ub2RlLnZpc2libGVDaGlsZHJlbkNvdW50OyB9XG5cdGdldCB2aXNpYmxlQ2hpbGRJbmRleCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5ub2RlLnZpc2libGVDaGlsZEluZGV4OyB9XG5cdGdldCBjb2xsYXBzaWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMubm9kZS5jb2xsYXBzaWJsZTsgfVxuXHRnZXQgY29sbGFwc2VkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5ub2RlLmNvbGxhcHNlZDsgfVxuXHRnZXQgdmlzaWJsZSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMubm9kZS52aXNpYmxlOyB9XG5cdGdldCBmaWx0ZXJEYXRhKCk6IFRGaWx0ZXJEYXRhIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMubm9kZS5maWx0ZXJEYXRhOyB9XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBub2RlOiBJVHJlZU5vZGU8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4gfCBudWxsLCBURmlsdGVyRGF0YT4pIHsgfVxufVxuXG5jbGFzcyBBc3luY0RhdGFUcmVlUmVuZGVyZXI8VElucHV0LCBULCBURmlsdGVyRGF0YSwgVFRlbXBsYXRlRGF0YT4gaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBURmlsdGVyRGF0YSwgSURhdGFUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPj4ge1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZztcblx0cHJpdmF0ZSByZW5kZXJlZE5vZGVzID0gbmV3IE1hcDxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgSURhdGFUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVuZGVyZXI6IElUcmVlUmVuZGVyZXI8VCwgVEZpbHRlckRhdGEsIFRUZW1wbGF0ZURhdGE+LFxuXHRcdHByb3RlY3RlZCBub2RlTWFwcGVyOiBBc3luY0RhdGFUcmVlTm9kZU1hcHBlcjxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPixcblx0XHRyZWFkb25seSBvbkRpZENoYW5nZVR3aXN0aWVTdGF0ZTogRXZlbnQ8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4+XG5cdCkge1xuXHRcdHRoaXMudGVtcGxhdGVJZCA9IHJlbmRlcmVyLnRlbXBsYXRlSWQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSURhdGFUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPiB7XG5cdFx0Y29uc3QgdGVtcGxhdGVEYXRhID0gdGhpcy5yZW5kZXJlci5yZW5kZXJUZW1wbGF0ZShjb250YWluZXIpO1xuXHRcdHJldHVybiB7IHRlbXBsYXRlRGF0YSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRGaWx0ZXJEYXRhPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRGF0YVRyZWVMaXN0VGVtcGxhdGVEYXRhPFRUZW1wbGF0ZURhdGE+LCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyRWxlbWVudCh0aGlzLm5vZGVNYXBwZXIubWFwKG5vZGUpIGFzIElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIGluZGV4LCB0ZW1wbGF0ZURhdGEudGVtcGxhdGVEYXRhLCBoZWlnaHQpO1xuXHR9XG5cblx0cmVuZGVyVHdpc3RpZShlbGVtZW50OiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgdHdpc3RpZUVsZW1lbnQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKGVsZW1lbnQuc2xvdykge1xuXHRcdFx0dHdpc3RpZUVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLnRyZWVJdGVtTG9hZGluZykpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHR3aXN0aWVFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi50cmVlSXRlbUxvYWRpbmcpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRGaWx0ZXJEYXRhPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRGF0YVRyZWVMaXN0VGVtcGxhdGVEYXRhPFRUZW1wbGF0ZURhdGE+LCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyZXIuZGlzcG9zZUVsZW1lbnQ/Lih0aGlzLm5vZGVNYXBwZXIubWFwKG5vZGUpIGFzIElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIGluZGV4LCB0ZW1wbGF0ZURhdGEudGVtcGxhdGVEYXRhLCBoZWlnaHQpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSURhdGFUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPik6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyZXIuZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlcmVkTm9kZXMuY2xlYXIoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBhc1RyZWVFdmVudDxUSW5wdXQsIFQ+KGU6IElUcmVlRXZlbnQ8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4gfCBudWxsPik6IElUcmVlRXZlbnQ8VD4ge1xuXHRyZXR1cm4ge1xuXHRcdGJyb3dzZXJFdmVudDogZS5icm93c2VyRXZlbnQsXG5cdFx0ZWxlbWVudHM6IGUuZWxlbWVudHMubWFwKGUgPT4gZSEuZWxlbWVudCBhcyBUKVxuXHR9O1xufVxuXG5mdW5jdGlvbiBhc1RyZWVNb3VzZUV2ZW50PFRJbnB1dCwgVD4oZTogSVRyZWVNb3VzZUV2ZW50PElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHwgbnVsbD4pOiBJVHJlZU1vdXNlRXZlbnQ8VD4ge1xuXHRyZXR1cm4ge1xuXHRcdGJyb3dzZXJFdmVudDogZS5icm93c2VyRXZlbnQsXG5cdFx0ZWxlbWVudDogZS5lbGVtZW50ICYmIGUuZWxlbWVudC5lbGVtZW50IGFzIFQsXG5cdFx0dGFyZ2V0OiBlLnRhcmdldFxuXHR9O1xufVxuXG5mdW5jdGlvbiBhc1RyZWVDb250ZXh0TWVudUV2ZW50PFRJbnB1dCwgVD4oZTogSVRyZWVDb250ZXh0TWVudUV2ZW50PElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHwgbnVsbD4pOiBJVHJlZUNvbnRleHRNZW51RXZlbnQ8VD4ge1xuXHRyZXR1cm4ge1xuXHRcdGJyb3dzZXJFdmVudDogZS5icm93c2VyRXZlbnQsXG5cdFx0ZWxlbWVudDogZS5lbGVtZW50ICYmIGUuZWxlbWVudC5lbGVtZW50IGFzIFQsXG5cdFx0YW5jaG9yOiBlLmFuY2hvcixcblx0XHRpc1N0aWNreVNjcm9sbDogZS5pc1N0aWNreVNjcm9sbFxuXHR9O1xufVxuXG5jbGFzcyBBc3luY0RhdGFUcmVlRWxlbWVudHNEcmFnQW5kRHJvcERhdGE8VElucHV0LCBULCBUQ29udGV4dD4gZXh0ZW5kcyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YTxULCBUQ29udGV4dD4ge1xuXG5cdG92ZXJyaWRlIHNldCBjb250ZXh0KGNvbnRleHQ6IFRDb250ZXh0IHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5kYXRhLmNvbnRleHQgPSBjb250ZXh0O1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IGNvbnRleHQoKTogVENvbnRleHQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmRhdGEuY29udGV4dDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgZGF0YTogRWxlbWVudHNEcmFnQW5kRHJvcERhdGE8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRDb250ZXh0Pikge1xuXHRcdHN1cGVyKGRhdGEuZWxlbWVudHMubWFwKG5vZGUgPT4gbm9kZS5lbGVtZW50IGFzIFQpKTtcblx0fVxufVxuXG5mdW5jdGlvbiBhc0FzeW5jRGF0YVRyZWVEcmFnQW5kRHJvcERhdGE8VElucHV0LCBUPihkYXRhOiBJRHJhZ0FuZERyb3BEYXRhKTogSURyYWdBbmREcm9wRGF0YSB7XG5cdGlmIChkYXRhIGluc3RhbmNlb2YgRWxlbWVudHNEcmFnQW5kRHJvcERhdGEpIHtcblx0XHRyZXR1cm4gbmV3IEFzeW5jRGF0YVRyZWVFbGVtZW50c0RyYWdBbmREcm9wRGF0YShkYXRhKTtcblx0fVxuXG5cdHJldHVybiBkYXRhO1xufVxuXG5jbGFzcyBBc3luY0RhdGFUcmVlTm9kZUxpc3REcmFnQW5kRHJvcDxUSW5wdXQsIFQ+IGltcGxlbWVudHMgSUxpc3REcmFnQW5kRHJvcDxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPj4ge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgZG5kOiBJVHJlZURyYWdBbmREcm9wPFQ+KSB7IH1cblxuXHRnZXREcmFnVVJJKG5vZGU6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+KTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuZG5kLmdldERyYWdVUkkobm9kZS5lbGVtZW50IGFzIFQpO1xuXHR9XG5cblx0Z2V0RHJhZ0xhYmVsKG5vZGVzOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPltdLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLmRuZC5nZXREcmFnTGFiZWwpIHtcblx0XHRcdHJldHVybiB0aGlzLmRuZC5nZXREcmFnTGFiZWwobm9kZXMubWFwKG5vZGUgPT4gbm9kZS5lbGVtZW50IGFzIFQpLCBvcmlnaW5hbEV2ZW50KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0b25EcmFnU3RhcnQoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5kbmQub25EcmFnU3RhcnQ/Lihhc0FzeW5jRGF0YVRyZWVEcmFnQW5kRHJvcERhdGEoZGF0YSksIG9yaWdpbmFsRXZlbnQpO1xuXHR9XG5cblx0b25EcmFnT3ZlcihkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCB0YXJnZXROb2RlOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiB8IHVuZGVmaW5lZCwgdGFyZ2V0SW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCwgdGFyZ2V0U2VjdG9yOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50LCByYXcgPSB0cnVlKTogYm9vbGVhbiB8IElMaXN0RHJhZ092ZXJSZWFjdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuZG5kLm9uRHJhZ092ZXIoYXNBc3luY0RhdGFUcmVlRHJhZ0FuZERyb3BEYXRhKGRhdGEpLCB0YXJnZXROb2RlICYmIHRhcmdldE5vZGUuZWxlbWVudCBhcyBULCB0YXJnZXRJbmRleCwgdGFyZ2V0U2VjdG9yLCBvcmlnaW5hbEV2ZW50KTtcblx0fVxuXG5cdGRyb3AoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0Tm9kZTogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4gfCB1bmRlZmluZWQsIHRhcmdldEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQsIHRhcmdldFNlY3RvcjogTGlzdFZpZXdUYXJnZXRTZWN0b3IgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuZG5kLmRyb3AoYXNBc3luY0RhdGFUcmVlRHJhZ0FuZERyb3BEYXRhKGRhdGEpLCB0YXJnZXROb2RlICYmIHRhcmdldE5vZGUuZWxlbWVudCBhcyBULCB0YXJnZXRJbmRleCwgdGFyZ2V0U2VjdG9yLCBvcmlnaW5hbEV2ZW50KTtcblx0fVxuXG5cdG9uRHJhZ0VuZChvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLmRuZC5vbkRyYWdFbmQ/LihvcmlnaW5hbEV2ZW50KTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kbmQuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFzeW5jRmluZFRvZ2dsZXMge1xuXHRtYXRjaFR5cGU6IFRyZWVGaW5kTWF0Y2hUeXBlO1xuXHRmaW5kTW9kZTogVHJlZUZpbmRNb2RlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBc3luY0ZpbmRSZXN1bHQ8VD4ge1xuXHR3YXJuaW5nTWVzc2FnZT86IHN0cmluZztcblx0bWF0Y2hDb3VudDogbnVtYmVyO1xuXHRpc01hdGNoKGVsZW1lbnQ6IFQpOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBc3luY0ZpbmRQcm92aWRlcjxUPiB7XG5cdC8qKlxuXHQgKiBgc3RhcnRTZXNzaW9uYCBpcyBjYWxsZWQgd2hlbiB0aGUgdXNlciBlbnRlcnMgdGhlIGZpcnN0IGNoYXJhY3RlciBpbiB0aGUgZmluZCB3aWRnZXQuXG5cdCAqIFRoaXMgY2FuIGJlIHVzZWQgdG8gYWxsb2NhdGUgc29tZSBzdGF0ZSB0byBwcmVzZXJ2ZSBmb3IgdGhlIHNlc3Npb24uXG5cdCAqL1xuXHRzdGFydFNlc3Npb24/KCk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIGBmaW5kYCBpcyBjYWxsZWQgd2hlbiB0aGUgdXNlciB0eXBlcyBvbmUgb3IgbW9yZSBjaGFyYWN0ZXIgaW50byB0aGUgZmluZCBpbnB1dC5cblx0ICovXG5cdGZpbmQocGF0dGVybjogc3RyaW5nLCB0b2dnbGVzOiBJQXN5bmNGaW5kVG9nZ2xlcywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQXN5bmNGaW5kUmVzdWx0PFQ+IHwgdW5kZWZpbmVkPjtcblxuXHQvKipcblx0ICogYGlzVmlzaWJsZWAgaXMgY2FsbGVkIHRvIGNoZWNrIGlmIGFuIGVsZW1lbnQgc2hvdWxkIGJlIHZpc2libGUuXG5cdCAqIEZvciBhbiBlbGVtZW50IHRvIGJlIHZpc2libGUsIGFsbCBpdHMgYW5jZXN0b3JzIG11c3QgYWxzbyBiZSB2aXNpYmxlIGFuZCB0aGUgbGFiZWwgbXVzdCBtYXRjaCB0aGUgZmluZCBwYXR0ZXJuLlxuXHQgKi9cblx0aXNWaXNpYmxlPyhlbGVtZW50OiBUKTogYm9vbGVhbjtcblxuXHQvKipcblx0ICogRW5kIFNlc3Npb24gaXMgY2FsbGVkIHdoZW4gdGhlIHVzZXIgZWl0aGVyIGNsb3NlcyB0aGUgZmluZCB3aWRnZXQgb3IgaGFzIGFuIGVtcHR5IGZpbmQgaW5wdXQuXG5cdCAqIFRoaXMgY2FuIGJlIHVzZWQgdG8gZGVhbGxvY2F0ZSBhbnkgc3RhdGUgdGhhdCB3YXMgYWxsb2NhdGVkLlxuXHQgKi9cblx0ZW5kU2Vzc2lvbj8oKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuY2xhc3MgQXN5bmNGaW5kRmlsdGVyPFQ+IGV4dGVuZHMgRmluZEZpbHRlcjxUPiB7XG5cblx0cHVibGljIGlzRmluZFNlc3Npb25BY3RpdmUgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgZmluZFByb3ZpZGVyOiBJQXN5bmNGaW5kUHJvdmlkZXI8VD4sIC8vIHJlbW92ZSBwdWJsaWNcblx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjxUPixcblx0XHRmaWx0ZXI6IElUcmVlRmlsdGVyPFQsIEZ1enp5U2NvcmU+XG5cdCkge1xuXHRcdHN1cGVyKGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIsIGZpbHRlcik7XG5cdH1cblxuXHRvdmVycmlkZSBmaWx0ZXIoZWxlbWVudDogVCwgcGFyZW50VmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHkpOiBUcmVlRmlsdGVyUmVzdWx0PEZ1enp5U2NvcmUgfCBMYWJlbEZ1enp5U2NvcmU+IHtcblx0XHRjb25zdCBmaWx0ZXJSZXN1bHQgPSBzdXBlci5maWx0ZXIoZWxlbWVudCwgcGFyZW50VmlzaWJpbGl0eSk7XG5cblx0XHRpZiAoIXRoaXMuaXNGaW5kU2Vzc2lvbkFjdGl2ZSB8fCB0aGlzLmZpbmRNb2RlID09PSBUcmVlRmluZE1vZGUuSGlnaGxpZ2h0IHx8ICF0aGlzLmZpbmRQcm92aWRlci5pc1Zpc2libGUpIHtcblx0XHRcdHJldHVybiBmaWx0ZXJSZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmlzaWJpbGl0eSA9IGlzRmlsdGVyUmVzdWx0KGZpbHRlclJlc3VsdCkgPyBmaWx0ZXJSZXN1bHQudmlzaWJpbGl0eSA6IGZpbHRlclJlc3VsdDtcblx0XHRpZiAoZ2V0VmlzaWJsZVN0YXRlKHZpc2liaWxpdHkpID09PSBUcmVlVmlzaWJpbGl0eS5IaWRkZW4pIHtcblx0XHRcdHJldHVybiBUcmVlVmlzaWJpbGl0eS5IaWRkZW47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZmluZFByb3ZpZGVyLmlzVmlzaWJsZShlbGVtZW50KSA/IGZpbHRlclJlc3VsdCA6IFRyZWVWaXNpYmlsaXR5LkhpZGRlbjtcblx0fVxuXG59XG5cbi8vIFRPRE8gRml4IHR5cGVzXG5jbGFzcyBBc3luY0ZpbmRDb250cm9sbGVyPFRJbnB1dCwgVCwgVEZpbHRlckRhdGE+IGV4dGVuZHMgRmluZENvbnRyb2xsZXI8VCwgVEZpbHRlckRhdGE+IHtcblx0cHJpdmF0ZSBhY3RpdmVUb2tlblNvdXJjZTogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYWN0aXZlRmluZE1ldGFkYXRhOiBJQXN5bmNGaW5kUmVzdWx0PFQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGFjdGl2ZVNlc3Npb24gPSBmYWxzZTtcblx0cHJpdmF0ZSBhc3luY1dvcmtJblByb2dyZXNzID0gZmFsc2U7XG5cdHByaXZhdGUgdGFza1F1ZXVlID0gbmV3IFRocm90dGxlZERlbGF5ZXIoMjUwKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR0cmVlOiBPYmplY3RUcmVlPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBURmlsdGVyRGF0YT4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmaW5kUHJvdmlkZXI6IElBc3luY0ZpbmRQcm92aWRlcjxUPixcblx0XHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZmlsdGVyOiBBc3luY0ZpbmRGaWx0ZXI8VD4sXG5cdFx0Y29udGV4dFZpZXdQcm92aWRlcjogSUNvbnRleHRWaWV3UHJvdmlkZXIsXG5cdFx0b3B0aW9uczogSUFic3RyYWN0VHJlZU9wdGlvbnM8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRGaWx0ZXJEYXRhPixcblx0KSB7XG5cdFx0c3VwZXIodHJlZSBhcyBhbnksIGZpbHRlciwgY29udGV4dFZpZXdQcm92aWRlciwgb3B0aW9ucyk7XG5cdFx0Ly8gQWx3YXlzIG1ha2Ugc3VyZSB0byBlbmQgdGhlIHNlc3Npb24gYmVmb3JlIGRpc3Bvc2luZ1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZShhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5hY3RpdmVTZXNzaW9uKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZmluZFByb3ZpZGVyLmVuZFNlc3Npb24/LigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhcHBseVBhdHRlcm4oX3BhdHRlcm46IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyTWVzc2FnZShmYWxzZSk7XG5cblx0XHR0aGlzLmFjdGl2ZVRva2VuU291cmNlPy5jYW5jZWwoKTtcblx0XHR0aGlzLmFjdGl2ZVRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHR0aGlzLnRhc2tRdWV1ZS50cmlnZ2VyKCgpID0+IHRoaXMuYXBwbHlQYXR0ZXJuQXN5bmMoKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFwcGx5UGF0dGVybkFzeW5jKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRva2VuID0gdGhpcy5hY3RpdmVUb2tlblNvdXJjZT8udG9rZW47XG5cdFx0aWYgKCF0b2tlbiB8fCB0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBwYXR0ZXJuID0gdGhpcy5wYXR0ZXJuO1xuXG5cdFx0aWYgKHBhdHRlcm4gPT09ICcnKSB7XG5cdFx0XHRpZiAodGhpcy5hY3RpdmVTZXNzaW9uKSB7XG5cdFx0XHRcdHRoaXMuYXN5bmNXb3JrSW5Qcm9ncmVzcyA9IHRydWU7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZGVhY3RpdmF0ZUZpbmRTZXNzaW9uKCk7XG5cdFx0XHRcdHRoaXMuYXN5bmNXb3JrSW5Qcm9ncmVzcyA9IGZhbHNlO1xuXG5cdFx0XHRcdGlmICghdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHR0aGlzLmZpbHRlci5yZXNldCgpO1xuXHRcdFx0XHRcdHN1cGVyLmFwcGx5UGF0dGVybignJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuYWN0aXZlU2Vzc2lvbikge1xuXHRcdFx0dGhpcy5hY3RpdmF0ZUZpbmRTZXNzaW9uKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5hc3luY1dvcmtJblByb2dyZXNzID0gdHJ1ZTtcblx0XHR0aGlzLmFjdGl2ZUZpbmRNZXRhZGF0YSA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGZpbmRNZXRhZGF0YSA9IGF3YWl0IHRoaXMuZmluZFByb3ZpZGVyLmZpbmQocGF0dGVybiwgeyBtYXRjaFR5cGU6IHRoaXMubWF0Y2hUeXBlLCBmaW5kTW9kZTogdGhpcy5tb2RlIH0sIHRva2VuKTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQgfHwgZmluZE1ldGFkYXRhID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmFzeW5jV29ya0luUHJvZ3Jlc3MgPSBmYWxzZTtcblx0XHR0aGlzLmFjdGl2ZUZpbmRNZXRhZGF0YSA9IGZpbmRNZXRhZGF0YTtcblxuXHRcdHRoaXMuZmlsdGVyLnJlc2V0KCk7XG5cdFx0c3VwZXIuYXBwbHlQYXR0ZXJuKHBhdHRlcm4pO1xuXG5cdFx0aWYgKGZpbmRNZXRhZGF0YS53YXJuaW5nTWVzc2FnZSkge1xuXHRcdFx0dGhpcy5yZW5kZXJNZXNzYWdlKHRydWUsIGZpbmRNZXRhZGF0YS53YXJuaW5nTWVzc2FnZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhY3RpdmF0ZUZpbmRTZXNzaW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuYWN0aXZlU2Vzc2lvbiA9IHRydWU7XG5cdFx0dGhpcy5maWx0ZXIuaXNGaW5kU2Vzc2lvbkFjdGl2ZSA9IHRydWU7XG5cdFx0dGhpcy5maW5kUHJvdmlkZXIuc3RhcnRTZXNzaW9uPy4oKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZGVhY3RpdmF0ZUZpbmRTZXNzaW9uKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuYWN0aXZlU2Vzc2lvbiA9IGZhbHNlO1xuXHRcdHRoaXMuZmlsdGVyLmlzRmluZFNlc3Npb25BY3RpdmUgPSBmYWxzZTtcblx0XHRhd2FpdCB0aGlzLmZpbmRQcm92aWRlci5lbmRTZXNzaW9uPy4oKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXIoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuYXN5bmNXb3JrSW5Qcm9ncmVzcyB8fCAhdGhpcy5hY3RpdmVGaW5kTWV0YWRhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzaG93Tm90Rm91bmQgPSB0aGlzLmFjdGl2ZUZpbmRNZXRhZGF0YS5tYXRjaENvdW50ID09PSAwICYmIHRoaXMucGF0dGVybi5sZW5ndGggPiAwO1xuXHRcdHRoaXMucmVuZGVyTWVzc2FnZShzaG93Tm90Rm91bmQpO1xuXG5cdFx0aWYgKHRoaXMucGF0dGVybi5sZW5ndGgpIHtcblx0XHRcdHRoaXMuYWxlcnRSZXN1bHRzKHRoaXMuYWN0aXZlRmluZE1ldGFkYXRhLm1hdGNoQ291bnQpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbkRpZFRvZ2dsZUNoYW5nZShlOiBJVHJlZUZpbmRUb2dnbGVDaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdC8vIFRPRE9AYmVuaWJlbmogaGFuZGxlIHRvZ2dsZXMgbmljZWx5IGFjcm9zcyBhbGwgY29udHJvbGxlcnMgYW5kIGJldHdlZW4gY29udHJvbGxlciBhbmQgZmlsdGVyXG5cdFx0dGhpcy50b2dnbGVzLnNldChlLmlkLCBlLmlzQ2hlY2tlZCk7XG5cdFx0dGhpcy5maWx0ZXIuZmluZE1vZGUgPSB0aGlzLm1vZGU7XG5cdFx0dGhpcy5maWx0ZXIuZmluZE1hdGNoVHlwZSA9IHRoaXMubWF0Y2hUeXBlO1xuXHRcdHRoaXMucGxhY2Vob2xkZXIgPSB0aGlzLm1vZGUgPT09IFRyZWVGaW5kTW9kZS5GaWx0ZXIgPyBsb2NhbGl6ZSgndHlwZSB0byBmaWx0ZXInLCBcIlR5cGUgdG8gZmlsdGVyXCIpIDogbG9jYWxpemUoJ3R5cGUgdG8gc2VhcmNoJywgXCJUeXBlIHRvIHNlYXJjaFwiKTtcblxuXHRcdHRoaXMuYXBwbHlQYXR0ZXJuKHRoaXMucGF0dGVybik7XG5cdH1cblxuXHRvdmVycmlkZSBzaG91bGRBbGxvd0ZvY3VzKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5zaG91bGRGb2N1c1doZW5OYXZpZ2F0aW5nKG5vZGUgYXMgSVRyZWVOb2RlPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHwgbnVsbCwgVEZpbHRlckRhdGE+KTtcblx0fVxuXG5cdHNob3VsZEZvY3VzV2hlbk5hdmlnYXRpbmcobm9kZTogSVRyZWVOb2RlPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHwgbnVsbCwgVEZpbHRlckRhdGE+KTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmFjdGl2ZVNlc3Npb24gfHwgIXRoaXMuYWN0aXZlRmluZE1ldGFkYXRhKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50ID0gbm9kZS5lbGVtZW50Py5lbGVtZW50IGFzIFQgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGVsZW1lbnQgJiYgdGhpcy5hY3RpdmVGaW5kTWV0YWRhdGEuaXNNYXRjaChlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICFGdXp6eVNjb3JlLmlzRGVmYXVsdChub2RlLmZpbHRlckRhdGEgYXMgYW55IGFzIEZ1enp5U2NvcmUpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGFzT2JqZWN0VHJlZU9wdGlvbnM8VElucHV0LCBULCBURmlsdGVyRGF0YT4ob3B0aW9ucz86IElBc3luY0RhdGFUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4pOiBJT2JqZWN0VHJlZU9wdGlvbnM8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBvcHRpb25zICYmIHtcblx0XHQuLi5vcHRpb25zLFxuXHRcdGNvbGxhcHNlQnlEZWZhdWx0OiB0cnVlLFxuXHRcdGlkZW50aXR5UHJvdmlkZXI6IG9wdGlvbnMuaWRlbnRpdHlQcm92aWRlciAmJiB7XG5cdFx0XHRnZXRJZChlbCkge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5pZGVudGl0eVByb3ZpZGVyIS5nZXRJZChlbC5lbGVtZW50IGFzIFQpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZG5kOiBvcHRpb25zLmRuZCAmJiBuZXcgQXN5bmNEYXRhVHJlZU5vZGVMaXN0RHJhZ0FuZERyb3Aob3B0aW9ucy5kbmQpLFxuXHRcdG11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlcjogb3B0aW9ucy5tdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXIgJiYge1xuXHRcdFx0aXNTZWxlY3Rpb25TaW5nbGVDaGFuZ2VFdmVudChlKSB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlciEuaXNTZWxlY3Rpb25TaW5nbGVDaGFuZ2VFdmVudCh7IC4uLmUsIGVsZW1lbnQ6IGUuZWxlbWVudCB9IGFzIGFueSk7XG5cdFx0XHR9LFxuXHRcdFx0aXNTZWxlY3Rpb25SYW5nZUNoYW5nZUV2ZW50KGUpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyIS5pc1NlbGVjdGlvblJhbmdlQ2hhbmdlRXZlbnQoeyAuLi5lLCBlbGVtZW50OiBlLmVsZW1lbnQgfSBhcyBhbnkpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlciAmJiB7XG5cdFx0XHQuLi5vcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlcixcblx0XHRcdGdldFBvc0luU2V0OiB1bmRlZmluZWQsXG5cdFx0XHRnZXRTZXRTaXplOiB1bmRlZmluZWQsXG5cdFx0XHRnZXRSb2xlOiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRSb2xlID8gKGVsKSA9PiB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlciEuZ2V0Um9sZSEoZWwuZWxlbWVudCBhcyBUKTtcblx0XHRcdH0gOiAoKSA9PiAndHJlZWl0ZW0nLFxuXHRcdFx0aXNDaGVja2VkOiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlci5pc0NoZWNrZWQgPyAoZSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gISEob3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXI/LmlzQ2hlY2tlZCEoZS5lbGVtZW50IGFzIFQpKTtcblx0XHRcdH0gOiB1bmRlZmluZWQsXG5cdFx0XHRnZXRBcmlhTGFiZWwoZSkge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIhLmdldEFyaWFMYWJlbChlLmVsZW1lbnQgYXMgVCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCkge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIhLmdldFdpZGdldEFyaWFMYWJlbCgpO1xuXHRcdFx0fSxcblx0XHRcdGdldFdpZGdldFJvbGU6IG9wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyLmdldFdpZGdldFJvbGUgPyAoKSA9PiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlciEuZ2V0V2lkZ2V0Um9sZSEoKSA6ICgpID0+ICd0cmVlJyxcblx0XHRcdGdldEFyaWFMZXZlbDogb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0QXJpYUxldmVsICYmIChub2RlID0+IHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyIS5nZXRBcmlhTGV2ZWwhKG5vZGUuZWxlbWVudCBhcyBUKTtcblx0XHRcdH0pLFxuXHRcdFx0Z2V0QWN0aXZlRGVzY2VuZGFudElkOiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRBY3RpdmVEZXNjZW5kYW50SWQgJiYgKG5vZGUgPT4ge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIhLmdldEFjdGl2ZURlc2NlbmRhbnRJZCEobm9kZS5lbGVtZW50IGFzIFQpO1xuXHRcdFx0fSlcblx0XHR9LFxuXHRcdGZpbHRlcjogb3B0aW9ucy5maWx0ZXIgJiYge1xuXHRcdFx0ZmlsdGVyKGUsIHBhcmVudFZpc2liaWxpdHkpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuZmlsdGVyIS5maWx0ZXIoZS5lbGVtZW50IGFzIFQsIHBhcmVudFZpc2liaWxpdHkpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0a2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjogb3B0aW9ucy5rZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyICYmIHtcblx0XHRcdC4uLm9wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcixcblx0XHRcdGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKGUpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciEuZ2V0S2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWwoZS5lbGVtZW50IGFzIFQpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c29ydGVyOiB1bmRlZmluZWQsXG5cdFx0ZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrOiB0eXBlb2Ygb3B0aW9ucy5leHBhbmRPbmx5T25Ud2lzdGllQ2xpY2sgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogKFxuXHRcdFx0dHlwZW9mIG9wdGlvbnMuZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrICE9PSAnZnVuY3Rpb24nID8gb3B0aW9ucy5leHBhbmRPbmx5T25Ud2lzdGllQ2xpY2sgOiAoXG5cdFx0XHRcdGUgPT4gKG9wdGlvbnMuZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrIGFzICgoZTogVCkgPT4gYm9vbGVhbikpKGUuZWxlbWVudCBhcyBUKVxuXHRcdFx0KVxuXHRcdCksXG5cdFx0ZGVmYXVsdEZpbmRWaXNpYmlsaXR5OiBlID0+IHtcblx0XHRcdGlmIChlLmhhc0NoaWxkcmVuICYmIGUuc3RhbGUpIHtcblx0XHRcdFx0cmV0dXJuIFRyZWVWaXNpYmlsaXR5LlZpc2libGU7XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zLmRlZmF1bHRGaW5kVmlzaWJpbGl0eSA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuZGVmYXVsdEZpbmRWaXNpYmlsaXR5O1xuXHRcdFx0fSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucy5kZWZhdWx0RmluZFZpc2liaWxpdHkgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdHJldHVybiBUcmVlVmlzaWJpbGl0eS5SZWN1cnNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIChvcHRpb25zLmRlZmF1bHRGaW5kVmlzaWJpbGl0eSBhcyAoKGU6IFQpID0+IFRyZWVWaXNpYmlsaXR5KSkoZS5lbGVtZW50IGFzIFQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQXN5bmNEYXRhVHJlZU9wdGlvbnNVcGRhdGUgZXh0ZW5kcyBJQWJzdHJhY3RUcmVlT3B0aW9uc1VwZGF0ZSB7IH1cbmV4cG9ydCBpbnRlcmZhY2UgSUFzeW5jRGF0YVRyZWVVcGRhdGVDaGlsZHJlbk9wdGlvbnM8VD4gZXh0ZW5kcyBJT2JqZWN0VHJlZVNldENoaWxkcmVuT3B0aW9uczxUPiB7IH1cblxuZXhwb3J0IGludGVyZmFjZSBJQXN5bmNEYXRhVHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGEgPSB2b2lkPiBleHRlbmRzIElBc3luY0RhdGFUcmVlT3B0aW9uc1VwZGF0ZSwgUGljazxJQWJzdHJhY3RUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4sIEV4Y2x1ZGU8a2V5b2YgSUFic3RyYWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+LCAnY29sbGFwc2VCeURlZmF1bHQnPj4ge1xuXHRyZWFkb25seSBjb2xsYXBzZUJ5RGVmYXVsdD86IHsgKGU6IFQpOiBib29sZWFuIH07XG5cdHJlYWRvbmx5IGlkZW50aXR5UHJvdmlkZXI/OiBJSWRlbnRpdHlQcm92aWRlcjxUPjtcblx0cmVhZG9ubHkgc29ydGVyPzogSVRyZWVTb3J0ZXI8VD47XG5cdHJlYWRvbmx5IGF1dG9FeHBhbmRTaW5nbGVDaGlsZHJlbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGZpbmRQcm92aWRlcj86IElBc3luY0ZpbmRQcm92aWRlcjxUPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZSB7XG5cdHJlYWRvbmx5IGZvY3VzPzogc3RyaW5nW107XG5cdHJlYWRvbmx5IHNlbGVjdGlvbj86IHN0cmluZ1tdO1xuXHRyZWFkb25seSBleHBhbmRlZD86IHN0cmluZ1tdO1xuXHRyZWFkb25seSBzY3JvbGxUb3A/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZUNvbnRleHQ8VElucHV0LCBUPiB7XG5cdHJlYWRvbmx5IHZpZXdTdGF0ZTogSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGU7XG5cdHJlYWRvbmx5IHNlbGVjdGlvbjogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD5bXTtcblx0cmVhZG9ubHkgZm9jdXM6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+W107XG59XG5cbmZ1bmN0aW9uIGRmczxUSW5wdXQsIFQ+KG5vZGU6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBmbjogKG5vZGU6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+KSA9PiB2b2lkKTogdm9pZCB7XG5cdGZuKG5vZGUpO1xuXHRub2RlLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gZGZzKGNoaWxkLCBmbikpO1xufVxuXG5leHBvcnQgY2xhc3MgQXN5bmNEYXRhVHJlZTxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhID0gdm9pZD4gaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IHRyZWU6IE9iamVjdFRyZWU8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRGaWx0ZXJEYXRhPjtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IHJvb3Q6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IG5vZGVzID0gbmV3IE1hcDxudWxsIHwgVCwgSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgc29ydGVyPzogSVRyZWVTb3J0ZXI8VD47XG5cdHByaXZhdGUgcmVhZG9ubHkgZmluZENvbnRyb2xsZXI/OiBBc3luY0ZpbmRDb250cm9sbGVyPFRJbnB1dCwgVCwgVEZpbHRlckRhdGE+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGdldERlZmF1bHRDb2xsYXBzZVN0YXRlOiB7IChlOiBUKTogdW5kZWZpbmVkIHwgT2JqZWN0VHJlZUVsZW1lbnRDb2xsYXBzZVN0YXRlLlByZXNlcnZlT3JDb2xsYXBzZWQgfCBPYmplY3RUcmVlRWxlbWVudENvbGxhcHNlU3RhdGUuUHJlc2VydmVPckV4cGFuZGVkIH07XG5cblx0cHJpdmF0ZSByZWFkb25seSBzdWJUcmVlUmVmcmVzaFByb21pc2VzID0gbmV3IE1hcDxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgUHJvbWlzZTx2b2lkPj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSByZWZyZXNoUHJvbWlzZXMgPSBuZXcgTWFwPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBDYW5jZWxhYmxlUHJvbWlzZTxJdGVyYWJsZTxUPj4+KCk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IGlkZW50aXR5UHJvdmlkZXI/OiBJSWRlbnRpdHlQcm92aWRlcjxUPjtcblx0cHJpdmF0ZSByZWFkb25seSBhdXRvRXhwYW5kU2luZ2xlQ2hpbGRyZW46IGJvb2xlYW47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW5kZXIgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTm9kZVNsb3dTdGF0ZSA9IG5ldyBFbWl0dGVyPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+PigpO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBub2RlTWFwcGVyOiBBc3luY0RhdGFUcmVlTm9kZU1hcHBlcjxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPiA9IG5ldyBXZWFrTWFwcGVyKG5vZGUgPT4gbmV3IEFzeW5jRGF0YVRyZWVOb2RlV3JhcHBlcihub2RlKSk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGdldCBvbkRpZFNjcm9sbCgpOiBFdmVudDxTY3JvbGxFdmVudD4geyByZXR1cm4gdGhpcy50cmVlLm9uRGlkU2Nyb2xsOyB9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlRm9jdXMoKTogRXZlbnQ8SVRyZWVFdmVudDxUPj4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMudHJlZS5vbkRpZENoYW5nZUZvY3VzLCBhc1RyZWVFdmVudCk7IH1cblx0Z2V0IG9uRGlkQ2hhbmdlU2VsZWN0aW9uKCk6IEV2ZW50PElUcmVlRXZlbnQ8VD4+IHsgcmV0dXJuIEV2ZW50Lm1hcCh0aGlzLnRyZWUub25EaWRDaGFuZ2VTZWxlY3Rpb24sIGFzVHJlZUV2ZW50KTsgfVxuXG5cdGdldCBvbktleURvd24oKTogRXZlbnQ8S2V5Ym9hcmRFdmVudD4geyByZXR1cm4gdGhpcy50cmVlLm9uS2V5RG93bjsgfVxuXHRnZXQgb25Nb3VzZUNsaWNrKCk6IEV2ZW50PElUcmVlTW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMudHJlZS5vbk1vdXNlQ2xpY2ssIGFzVHJlZU1vdXNlRXZlbnQpOyB9XG5cdGdldCBvbk1vdXNlRGJsQ2xpY2soKTogRXZlbnQ8SVRyZWVNb3VzZUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5tYXAodGhpcy50cmVlLm9uTW91c2VEYmxDbGljaywgYXNUcmVlTW91c2VFdmVudCk7IH1cblx0Z2V0IG9uQ29udGV4dE1lbnUoKTogRXZlbnQ8SVRyZWVDb250ZXh0TWVudUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5tYXAodGhpcy50cmVlLm9uQ29udGV4dE1lbnUsIGFzVHJlZUNvbnRleHRNZW51RXZlbnQpOyB9XG5cdGdldCBvblRhcCgpOiBFdmVudDxJVHJlZU1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIEV2ZW50Lm1hcCh0aGlzLnRyZWUub25UYXAsIGFzVHJlZU1vdXNlRXZlbnQpOyB9XG5cdGdldCBvblBvaW50ZXIoKTogRXZlbnQ8SVRyZWVNb3VzZUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5tYXAodGhpcy50cmVlLm9uUG9pbnRlciwgYXNUcmVlTW91c2VFdmVudCk7IH1cblx0Z2V0IG9uRGlkRm9jdXMoKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy50cmVlLm9uRGlkRm9jdXM7IH1cblx0Z2V0IG9uRGlkQmx1cigpOiBFdmVudDx2b2lkPiB7IHJldHVybiB0aGlzLnRyZWUub25EaWRCbHVyOyB9XG5cblx0LyoqXG5cdCAqIFRvIGJlIHVzZWQgaW50ZXJuYWxseSBvbmx5IVxuXHQgKiBAZGVwcmVjYXRlZFxuXHQgKi9cblx0Z2V0IG9uRGlkQ2hhbmdlTW9kZWwoKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy50cmVlLm9uRGlkQ2hhbmdlTW9kZWw7IH1cblx0Z2V0IG9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZSgpOiBFdmVudDxJQ29sbGFwc2VTdGF0ZUNoYW5nZUV2ZW50PElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHwgbnVsbCwgVEZpbHRlckRhdGE+PiB7IHJldHVybiB0aGlzLnRyZWUub25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlOyB9XG5cblx0Z2V0IG9uRGlkVXBkYXRlT3B0aW9ucygpOiBFdmVudDxJQXN5bmNEYXRhVHJlZU9wdGlvbnNVcGRhdGU+IHsgcmV0dXJuIHRoaXMudHJlZS5vbkRpZFVwZGF0ZU9wdGlvbnM7IH1cblxuXHRwcml2YXRlIGZvY3VzTmF2aWdhdGlvbkZpbHRlcjogKChub2RlOiBJVHJlZU5vZGU8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4gfCBudWxsLCBURmlsdGVyRGF0YT4pID0+IGJvb2xlYW4pIHwgdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRmluZE9wZW5TdGF0ZTogRXZlbnQ8Ym9vbGVhbj47XG5cdGdldCBvbkRpZENoYW5nZVN0aWNreVNjcm9sbEZvY3VzZWQoKTogRXZlbnQ8Ym9vbGVhbj4geyByZXR1cm4gdGhpcy50cmVlLm9uRGlkQ2hhbmdlU3RpY2t5U2Nyb2xsRm9jdXNlZDsgfVxuXG5cdGdldCBmaW5kTW9kZSgpOiBUcmVlRmluZE1vZGUgeyByZXR1cm4gdGhpcy5maW5kQ29udHJvbGxlciA/IHRoaXMuZmluZENvbnRyb2xsZXIubW9kZSA6IHRoaXMudHJlZS5maW5kTW9kZTsgfVxuXHRzZXQgZmluZE1vZGUobW9kZTogVHJlZUZpbmRNb2RlKSB7IHRoaXMuZmluZENvbnRyb2xsZXIgPyB0aGlzLmZpbmRDb250cm9sbGVyLm1vZGUgPSBtb2RlIDogdGhpcy50cmVlLmZpbmRNb2RlID0gbW9kZTsgfVxuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbmRNb2RlOiBFdmVudDxUcmVlRmluZE1vZGU+O1xuXG5cdGdldCBmaW5kTWF0Y2hUeXBlKCk6IFRyZWVGaW5kTWF0Y2hUeXBlIHsgcmV0dXJuIHRoaXMuZmluZENvbnRyb2xsZXIgPyB0aGlzLmZpbmRDb250cm9sbGVyLm1hdGNoVHlwZSA6IHRoaXMudHJlZS5maW5kTWF0Y2hUeXBlOyB9XG5cdHNldCBmaW5kTWF0Y2hUeXBlKG1hdGNoVHlwZTogVHJlZUZpbmRNYXRjaFR5cGUpIHsgdGhpcy5maW5kQ29udHJvbGxlciA/IHRoaXMuZmluZENvbnRyb2xsZXIubWF0Y2hUeXBlID0gbWF0Y2hUeXBlIDogdGhpcy50cmVlLmZpbmRNYXRjaFR5cGUgPSBtYXRjaFR5cGU7IH1cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGaW5kTWF0Y2hUeXBlOiBFdmVudDxUcmVlRmluZE1hdGNoVHlwZT47XG5cblx0Z2V0IGV4cGFuZE9ubHlPblR3aXN0aWVDbGljaygpOiBib29sZWFuIHwgKChlOiBUKSA9PiBib29sZWFuKSB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLnRyZWUuZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHJldHVybiB0aGlzLnRyZWUuZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZuID0gdGhpcy50cmVlLmV4cGFuZE9ubHlPblR3aXN0aWVDbGljaztcblx0XHRyZXR1cm4gZWxlbWVudCA9PiBmbih0aGlzLm5vZGVzLmdldCgoZWxlbWVudCA9PT0gdGhpcy5yb290LmVsZW1lbnQgPyBudWxsIDogZWxlbWVudCkgYXMgVCkgfHwgbnVsbCk7XG5cdH1cblxuXHRnZXQgb25EaWREaXNwb3NlKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIHRoaXMudHJlZS5vbkRpZERpc3Bvc2U7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgdXNlcjogc3RyaW5nLFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0ZGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPFQ+LFxuXHRcdHJlbmRlcmVyczogSVRyZWVSZW5kZXJlcjxULCBURmlsdGVyRGF0YSwgYW55PltdLFxuXHRcdHByaXZhdGUgZGF0YVNvdXJjZTogSUFzeW5jRGF0YVNvdXJjZTxUSW5wdXQsIFQ+LFxuXHRcdG9wdGlvbnM6IElBc3luY0RhdGFUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4gPSB7fVxuXHQpIHtcblx0XHR0aGlzLmlkZW50aXR5UHJvdmlkZXIgPSBvcHRpb25zLmlkZW50aXR5UHJvdmlkZXI7XG5cdFx0dGhpcy5hdXRvRXhwYW5kU2luZ2xlQ2hpbGRyZW4gPSB0eXBlb2Ygb3B0aW9ucy5hdXRvRXhwYW5kU2luZ2xlQ2hpbGRyZW4gPT09ICd1bmRlZmluZWQnID8gZmFsc2UgOiBvcHRpb25zLmF1dG9FeHBhbmRTaW5nbGVDaGlsZHJlbjtcblx0XHR0aGlzLnNvcnRlciA9IG9wdGlvbnMuc29ydGVyO1xuXHRcdHRoaXMuZ2V0RGVmYXVsdENvbGxhcHNlU3RhdGUgPSBlID0+IG9wdGlvbnMuY29sbGFwc2VCeURlZmF1bHQgPyAob3B0aW9ucy5jb2xsYXBzZUJ5RGVmYXVsdChlKSA/IE9iamVjdFRyZWVFbGVtZW50Q29sbGFwc2VTdGF0ZS5QcmVzZXJ2ZU9yQ29sbGFwc2VkIDogT2JqZWN0VHJlZUVsZW1lbnRDb2xsYXBzZVN0YXRlLlByZXNlcnZlT3JFeHBhbmRlZCkgOiB1bmRlZmluZWQ7XG5cblx0XHRsZXQgYXN5bmNGaW5kRW5hYmxlZCA9IGZhbHNlO1xuXHRcdGxldCBmaW5kRmlsdGVyOiBBc3luY0ZpbmRGaWx0ZXI8VD4gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKG9wdGlvbnMuZmluZFByb3ZpZGVyICYmIChvcHRpb25zLmZpbmRXaWRnZXRFbmFibGVkID8/IHRydWUpICYmIG9wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciAmJiBvcHRpb25zLmNvbnRleHRWaWV3UHJvdmlkZXIpIHtcblx0XHRcdGFzeW5jRmluZEVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0ZmluZEZpbHRlciA9IG5ldyBBc3luY0ZpbmRGaWx0ZXI8VD4ob3B0aW9ucy5maW5kUHJvdmlkZXIsIG9wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciwgb3B0aW9ucy5maWx0ZXIgYXMgSVRyZWVGaWx0ZXI8VCwgRnV6enlTY29yZT4pO1xuXHRcdH1cblxuXHRcdHRoaXMudHJlZSA9IHRoaXMuY3JlYXRlVHJlZSh1c2VyLCBjb250YWluZXIsIGRlbGVnYXRlLCByZW5kZXJlcnMsIHsgLi4ub3B0aW9ucywgZmluZFdpZGdldEVuYWJsZWQ6ICFhc3luY0ZpbmRFbmFibGVkLCBmaWx0ZXI6IGZpbmRGaWx0ZXIgYXMgSVRyZWVGaWx0ZXI8VCwgVEZpbHRlckRhdGE+ID8/IG9wdGlvbnMuZmlsdGVyIH0pO1xuXG5cdFx0dGhpcy5yb290ID0gY3JlYXRlQXN5bmNEYXRhVHJlZU5vZGUoe1xuXHRcdFx0ZWxlbWVudDogdW5kZWZpbmVkISxcblx0XHRcdHBhcmVudDogbnVsbCxcblx0XHRcdGhhc0NoaWxkcmVuOiB0cnVlLFxuXHRcdFx0ZGVmYXVsdENvbGxhcHNlU3RhdGU6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMuaWRlbnRpdHlQcm92aWRlcikge1xuXHRcdFx0dGhpcy5yb290ID0ge1xuXHRcdFx0XHQuLi50aGlzLnJvb3QsXG5cdFx0XHRcdGlkOiBudWxsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRoaXMubm9kZXMuc2V0KG51bGwsIHRoaXMucm9vdCk7XG5cblx0XHR0aGlzLnRyZWUub25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKHRoaXMuX29uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cblx0XHRpZiAoYXN5bmNGaW5kRW5hYmxlZCkge1xuXHRcdFx0Y29uc3QgZmluZE9wdGlvbnM6IElGaW5kQ29udHJvbGxlck9wdGlvbnMgPSB7XG5cdFx0XHRcdHN0eWxlczogb3B0aW9ucy5maW5kV2lkZ2V0U3R5bGVzLFxuXHRcdFx0XHRzaG93Tm90Rm91bmRNZXNzYWdlOiBvcHRpb25zLnNob3dOb3RGb3VuZE1lc3NhZ2UsXG5cdFx0XHRcdGRlZmF1bHRGaW5kTWF0Y2hUeXBlOiBvcHRpb25zLmRlZmF1bHRGaW5kTWF0Y2hUeXBlLFxuXHRcdFx0XHRkZWZhdWx0RmluZE1vZGU6IG9wdGlvbnMuZGVmYXVsdEZpbmRNb2RlLFxuXHRcdFx0fTtcblx0XHRcdHRoaXMuZmluZENvbnRyb2xsZXIgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgQXN5bmNGaW5kQ29udHJvbGxlcih0aGlzLnRyZWUsIG9wdGlvbnMuZmluZFByb3ZpZGVyISwgZmluZEZpbHRlciEsIHRoaXMudHJlZS5vcHRpb25zLmNvbnRleHRWaWV3UHJvdmlkZXIhLCBmaW5kT3B0aW9ucykpO1xuXG5cdFx0XHR0aGlzLmZvY3VzTmF2aWdhdGlvbkZpbHRlciA9IG5vZGUgPT4gdGhpcy5maW5kQ29udHJvbGxlciEuc2hvdWxkRm9jdXNXaGVuTmF2aWdhdGluZyhub2RlKTtcblx0XHRcdHRoaXMub25EaWRDaGFuZ2VGaW5kT3BlblN0YXRlID0gdGhpcy5maW5kQ29udHJvbGxlciEub25EaWRDaGFuZ2VPcGVuU3RhdGU7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRmluZE1vZGUgPSB0aGlzLmZpbmRDb250cm9sbGVyIS5vbkRpZENoYW5nZU1vZGU7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRmluZE1hdGNoVHlwZSA9IHRoaXMuZmluZENvbnRyb2xsZXIhLm9uRGlkQ2hhbmdlTWF0Y2hUeXBlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRmluZE9wZW5TdGF0ZSA9IHRoaXMudHJlZS5vbkRpZENoYW5nZUZpbmRPcGVuU3RhdGU7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRmluZE1vZGUgPSB0aGlzLnRyZWUub25EaWRDaGFuZ2VGaW5kTW9kZTtcblx0XHRcdHRoaXMub25EaWRDaGFuZ2VGaW5kTWF0Y2hUeXBlID0gdGhpcy50cmVlLm9uRGlkQ2hhbmdlRmluZE1hdGNoVHlwZTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlVHJlZShcblx0XHR1c2VyOiBzdHJpbmcsXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRkZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VD4sXG5cdFx0cmVuZGVyZXJzOiBJVHJlZVJlbmRlcmVyPFQsIFRGaWx0ZXJEYXRhLCBhbnk+W10sXG5cdFx0b3B0aW9uczogSUFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPlxuXHQpOiBPYmplY3RUcmVlPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBURmlsdGVyRGF0YT4ge1xuXHRcdGNvbnN0IG9iamVjdFRyZWVEZWxlZ2F0ZSA9IG5ldyBDb21wb3NlZFRyZWVEZWxlZ2F0ZTxUSW5wdXQgfCBULCBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPj4oZGVsZWdhdGUpO1xuXHRcdGNvbnN0IG9iamVjdFRyZWVSZW5kZXJlcnMgPSByZW5kZXJlcnMubWFwKHIgPT4gbmV3IEFzeW5jRGF0YVRyZWVSZW5kZXJlcihyLCB0aGlzLm5vZGVNYXBwZXIsIHRoaXMuX29uRGlkQ2hhbmdlTm9kZVNsb3dTdGF0ZS5ldmVudCkpO1xuXHRcdGNvbnN0IG9iamVjdFRyZWVPcHRpb25zID0gYXNPYmplY3RUcmVlT3B0aW9uczxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPihvcHRpb25zKSB8fCB7fTtcblxuXHRcdHJldHVybiBuZXcgT2JqZWN0VHJlZSh1c2VyLCBjb250YWluZXIsIG9iamVjdFRyZWVEZWxlZ2F0ZSwgb2JqZWN0VHJlZVJlbmRlcmVycywgb2JqZWN0VHJlZU9wdGlvbnMpO1xuXHR9XG5cblx0dXBkYXRlT3B0aW9ucyhvcHRpb25zVXBkYXRlOiBJQXN5bmNEYXRhVHJlZU9wdGlvbnNVcGRhdGUgPSB7fSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmZpbmRDb250cm9sbGVyKSB7XG5cdFx0XHRpZiAob3B0aW9uc1VwZGF0ZS5kZWZhdWx0RmluZE1vZGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLmZpbmRDb250cm9sbGVyLm1vZGUgPSBvcHRpb25zVXBkYXRlLmRlZmF1bHRGaW5kTW9kZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG9wdGlvbnNVcGRhdGUuZGVmYXVsdEZpbmRNYXRjaFR5cGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLmZpbmRDb250cm9sbGVyLm1hdGNoVHlwZSA9IG9wdGlvbnNVcGRhdGUuZGVmYXVsdEZpbmRNYXRjaFR5cGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy50cmVlLnVwZGF0ZU9wdGlvbnMob3B0aW9uc1VwZGF0ZSk7XG5cdH1cblxuXHRnZXQgb3B0aW9ucygpOiBJQXN5bmNEYXRhVHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLm9wdGlvbnMgYXMgSUFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPjtcblx0fVxuXG5cdC8vIFdpZGdldFxuXG5cdGdldEhUTUxFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLmdldEhUTUxFbGVtZW50KCk7XG5cdH1cblxuXHRnZXQgY29udGVudEhlaWdodCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnRyZWUuY29udGVudEhlaWdodDtcblx0fVxuXG5cdGdldCBjb250ZW50V2lkdGgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLmNvbnRlbnRXaWR0aDtcblx0fVxuXG5cdGdldCBvbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKTogRXZlbnQ8bnVtYmVyPiB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQ7XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2VDb250ZW50V2lkdGgoKTogRXZlbnQ8bnVtYmVyPiB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5vbkRpZENoYW5nZUNvbnRlbnRXaWR0aDtcblx0fVxuXG5cdGdldCBzY3JvbGxUb3AoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLnNjcm9sbFRvcDtcblx0fVxuXG5cdHNldCBzY3JvbGxUb3Aoc2Nyb2xsVG9wOiBudW1iZXIpIHtcblx0XHR0aGlzLnRyZWUuc2Nyb2xsVG9wID0gc2Nyb2xsVG9wO1xuXHR9XG5cblx0Z2V0IHNjcm9sbExlZnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLnNjcm9sbExlZnQ7XG5cdH1cblxuXHRzZXQgc2Nyb2xsTGVmdChzY3JvbGxMZWZ0OiBudW1iZXIpIHtcblx0XHR0aGlzLnRyZWUuc2Nyb2xsTGVmdCA9IHNjcm9sbExlZnQ7XG5cdH1cblxuXHRnZXQgc2Nyb2xsSGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5zY3JvbGxIZWlnaHQ7XG5cdH1cblxuXHRnZXQgcmVuZGVySGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5yZW5kZXJIZWlnaHQ7XG5cdH1cblxuXHRnZXQgbGFzdFZpc2libGVFbGVtZW50KCk6IFQge1xuXHRcdHJldHVybiB0aGlzLnRyZWUubGFzdFZpc2libGVFbGVtZW50IS5lbGVtZW50IGFzIFQ7XG5cdH1cblxuXHRnZXQgYXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5hcmlhTGFiZWw7XG5cdH1cblxuXHRzZXQgYXJpYUxhYmVsKHZhbHVlOiBzdHJpbmcpIHtcblx0XHR0aGlzLnRyZWUuYXJpYUxhYmVsID0gdmFsdWU7XG5cdH1cblxuXHRkb21Gb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUuZG9tRm9jdXMoKTtcblx0fVxuXG5cdGlzRE9NRm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLmlzRE9NRm9jdXNlZCgpO1xuXHR9XG5cblx0bmF2aWdhdGUoc3RhcnQ/OiBUKSB7XG5cdFx0bGV0IHN0YXJ0Tm9kZTtcblx0XHRpZiAoc3RhcnQpIHtcblx0XHRcdHN0YXJ0Tm9kZSA9IHRoaXMuZ2V0RGF0YU5vZGUoc3RhcnQpO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IEFzeW5jRGF0YVRyZWVOYXZpZ2F0b3IodGhpcy50cmVlLm5hdmlnYXRlKHN0YXJ0Tm9kZSkpO1xuXHR9XG5cblx0bGF5b3V0KGhlaWdodD86IG51bWJlciwgd2lkdGg/OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0c3R5bGUoc3R5bGVzOiBJTGlzdFN0eWxlcyk6IHZvaWQge1xuXHRcdHRoaXMudHJlZS5zdHlsZShzdHlsZXMpO1xuXHR9XG5cblx0Ly8gTW9kZWxcblxuXHRnZXRJbnB1dCgpOiBUSW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnJvb3QuZWxlbWVudCBhcyBUSW5wdXQ7XG5cdH1cblxuXHRhc3luYyBzZXRJbnB1dChpbnB1dDogVElucHV0LCB2aWV3U3RhdGU/OiBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMucmVmcmVzaFByb21pc2VzLmZvckVhY2gocHJvbWlzZSA9PiBwcm9taXNlLmNhbmNlbCgpKTtcblx0XHR0aGlzLnJlZnJlc2hQcm9taXNlcy5jbGVhcigpO1xuXG5cdFx0dGhpcy5yb290LmVsZW1lbnQgPSBpbnB1dCE7XG5cblx0XHRjb25zdCB2aWV3U3RhdGVDb250ZXh0OiBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZUNvbnRleHQ8VElucHV0LCBUPiB8IHVuZGVmaW5lZCA9IHZpZXdTdGF0ZSAmJiB7IHZpZXdTdGF0ZSwgZm9jdXM6IFtdLCBzZWxlY3Rpb246IFtdIH07XG5cblx0XHRhd2FpdCB0aGlzLl91cGRhdGVDaGlsZHJlbihpbnB1dCwgdHJ1ZSwgZmFsc2UsIHZpZXdTdGF0ZUNvbnRleHQpO1xuXG5cdFx0aWYgKHZpZXdTdGF0ZUNvbnRleHQpIHtcblx0XHRcdHRoaXMudHJlZS5zZXRGb2N1cyh2aWV3U3RhdGVDb250ZXh0LmZvY3VzKTtcblx0XHRcdHRoaXMudHJlZS5zZXRTZWxlY3Rpb24odmlld1N0YXRlQ29udGV4dC5zZWxlY3Rpb24pO1xuXHRcdH1cblxuXHRcdGlmICh2aWV3U3RhdGUgJiYgdHlwZW9mIHZpZXdTdGF0ZS5zY3JvbGxUb3AgPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLnNjcm9sbFRvcCA9IHZpZXdTdGF0ZS5zY3JvbGxUb3A7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdXBkYXRlQ2hpbGRyZW4oZWxlbWVudDogVElucHV0IHwgVCA9IHRoaXMucm9vdC5lbGVtZW50LCByZWN1cnNpdmUgPSB0cnVlLCByZXJlbmRlciA9IGZhbHNlLCBvcHRpb25zPzogSUFzeW5jRGF0YVRyZWVVcGRhdGVDaGlsZHJlbk9wdGlvbnM8VD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl91cGRhdGVDaGlsZHJlbihlbGVtZW50LCByZWN1cnNpdmUsIHJlcmVuZGVyLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdXBkYXRlQ2hpbGRyZW4oZWxlbWVudDogVElucHV0IHwgVCA9IHRoaXMucm9vdC5lbGVtZW50LCByZWN1cnNpdmUgPSB0cnVlLCByZXJlbmRlciA9IGZhbHNlLCB2aWV3U3RhdGVDb250ZXh0PzogSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGVDb250ZXh0PFRJbnB1dCwgVD4sIG9wdGlvbnM/OiBJQXN5bmNEYXRhVHJlZVVwZGF0ZUNoaWxkcmVuT3B0aW9uczxUPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5yb290LmVsZW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHJlZUVycm9yKHRoaXMudXNlciwgJ1RyZWUgaW5wdXQgbm90IHNldCcpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnJvb3QucmVmcmVzaFByb21pc2UpIHtcblx0XHRcdGF3YWl0IHRoaXMucm9vdC5yZWZyZXNoUHJvbWlzZTtcblx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZSh0aGlzLl9vbkRpZFJlbmRlci5ldmVudCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuZ2V0RGF0YU5vZGUoZWxlbWVudCk7XG5cdFx0YXdhaXQgdGhpcy5yZWZyZXNoQW5kUmVuZGVyTm9kZShub2RlLCByZWN1cnNpdmUsIHZpZXdTdGF0ZUNvbnRleHQsIG9wdGlvbnMpO1xuXG5cdFx0aWYgKHJlcmVuZGVyKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLnRyZWUucmVyZW5kZXIobm9kZSk7XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0Ly8gbWlzc2luZyBub2RlcyBhcmUgZmluZSwgdGhpcyBjb3VsZCd2ZSByZXN1bHRlZCBmcm9tXG5cdFx0XHRcdC8vIHBhcmFsbGVsIHJlZnJlc2ggY2FsbHMsIHJlbW92aW5nIGBub2RlYCBhbHRvZ2V0aGVyXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmVzb3J0KGVsZW1lbnQ6IFRJbnB1dCB8IFQgPSB0aGlzLnJvb3QuZWxlbWVudCwgcmVjdXJzaXZlID0gdHJ1ZSk6IHZvaWQge1xuXHRcdHRoaXMudHJlZS5yZXNvcnQodGhpcy5nZXREYXRhTm9kZShlbGVtZW50KSwgcmVjdXJzaXZlKTtcblx0fVxuXG5cdGhhc05vZGUoZWxlbWVudDogVElucHV0IHwgVCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBlbGVtZW50ID09PSB0aGlzLnJvb3QuZWxlbWVudCB8fCB0aGlzLm5vZGVzLmhhcyhlbGVtZW50IGFzIFQpO1xuXHR9XG5cblx0Ly8gVmlld1xuXG5cdHJlcmVuZGVyKGVsZW1lbnQ/OiBUKTogdm9pZCB7XG5cdFx0aWYgKGVsZW1lbnQgPT09IHVuZGVmaW5lZCB8fCBlbGVtZW50ID09PSB0aGlzLnJvb3QuZWxlbWVudCkge1xuXHRcdFx0dGhpcy50cmVlLnJlcmVuZGVyKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuZ2V0RGF0YU5vZGUoZWxlbWVudCk7XG5cdFx0dGhpcy50cmVlLnJlcmVuZGVyKG5vZGUpO1xuXHR9XG5cblx0dXBkYXRlRWxlbWVudEhlaWdodChlbGVtZW50OiBULCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLmdldERhdGFOb2RlKGVsZW1lbnQpO1xuXHRcdHRoaXMudHJlZS51cGRhdGVFbGVtZW50SGVpZ2h0KG5vZGUsIGhlaWdodCk7XG5cdH1cblxuXHR1cGRhdGVXaWR0aChlbGVtZW50OiBUKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuZ2V0RGF0YU5vZGUoZWxlbWVudCk7XG5cdFx0dGhpcy50cmVlLnVwZGF0ZVdpZHRoKG5vZGUpO1xuXHR9XG5cblx0Ly8gVHJlZVxuXG5cdGdldE5vZGUoZWxlbWVudDogVElucHV0IHwgVCA9IHRoaXMucm9vdC5lbGVtZW50KTogSVRyZWVOb2RlPFRJbnB1dCB8IFQsIFRGaWx0ZXJEYXRhPiB7XG5cdFx0Y29uc3QgZGF0YU5vZGUgPSB0aGlzLmdldERhdGFOb2RlKGVsZW1lbnQpO1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLnRyZWUuZ2V0Tm9kZShkYXRhTm9kZSA9PT0gdGhpcy5yb290ID8gbnVsbCA6IGRhdGFOb2RlKTtcblx0XHRyZXR1cm4gdGhpcy5ub2RlTWFwcGVyLm1hcChub2RlKTtcblx0fVxuXG5cdGNvbGxhcHNlKGVsZW1lbnQ6IFQsIHJlY3Vyc2l2ZTogYm9vbGVhbiA9IGZhbHNlKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuZ2V0RGF0YU5vZGUoZWxlbWVudCk7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5jb2xsYXBzZShub2RlID09PSB0aGlzLnJvb3QgPyBudWxsIDogbm9kZSwgcmVjdXJzaXZlKTtcblx0fVxuXG5cdGFzeW5jIGV4cGFuZChlbGVtZW50OiBULCByZWN1cnNpdmU6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5yb290LmVsZW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHJlZUVycm9yKHRoaXMudXNlciwgJ1RyZWUgaW5wdXQgbm90IHNldCcpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnJvb3QucmVmcmVzaFByb21pc2UpIHtcblx0XHRcdGF3YWl0IHRoaXMucm9vdC5yZWZyZXNoUHJvbWlzZTtcblx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZSh0aGlzLl9vbkRpZFJlbmRlci5ldmVudCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuZ2V0RGF0YU5vZGUoZWxlbWVudCk7XG5cblx0XHRpZiAodGhpcy50cmVlLmhhc0VsZW1lbnQobm9kZSkgJiYgIXRoaXMudHJlZS5pc0NvbGxhcHNpYmxlKG5vZGUpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUucmVmcmVzaFByb21pc2UpIHtcblx0XHRcdGF3YWl0IHRoaXMucm9vdC5yZWZyZXNoUHJvbWlzZTtcblx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZSh0aGlzLl9vbkRpZFJlbmRlci5ldmVudCk7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUgIT09IHRoaXMucm9vdCAmJiAhbm9kZS5yZWZyZXNoUHJvbWlzZSAmJiAhdGhpcy50cmVlLmlzQ29sbGFwc2VkKG5vZGUpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy50cmVlLmV4cGFuZChub2RlID09PSB0aGlzLnJvb3QgPyBudWxsIDogbm9kZSwgcmVjdXJzaXZlKTtcblxuXHRcdGlmIChub2RlLnJlZnJlc2hQcm9taXNlKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJvb3QucmVmcmVzaFByb21pc2U7XG5cdFx0XHRhd2FpdCBFdmVudC50b1Byb21pc2UodGhpcy5fb25EaWRSZW5kZXIuZXZlbnQpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHR0b2dnbGVDb2xsYXBzZWQoZWxlbWVudDogVCwgcmVjdXJzaXZlOiBib29sZWFuID0gZmFsc2UpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLnRvZ2dsZUNvbGxhcHNlZCh0aGlzLmdldERhdGFOb2RlKGVsZW1lbnQpLCByZWN1cnNpdmUpO1xuXHR9XG5cblx0ZXhwYW5kQWxsKCk6IHZvaWQge1xuXHRcdHRoaXMudHJlZS5leHBhbmRBbGwoKTtcblx0fVxuXG5cdGFzeW5jIGV4cGFuZFRvKGVsZW1lbnQ6IFQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuZGF0YVNvdXJjZS5nZXRQYXJlbnQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2FuXFwndCBleHBhbmQgdG8gZWxlbWVudCB3aXRob3V0IGdldFBhcmVudCBtZXRob2QnKTtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50czogVFtdID0gW107XG5cdFx0d2hpbGUgKCF0aGlzLmhhc05vZGUoZWxlbWVudCkpIHtcblx0XHRcdGVsZW1lbnQgPSB0aGlzLmRhdGFTb3VyY2UuZ2V0UGFyZW50KGVsZW1lbnQpIGFzIFQ7XG5cblx0XHRcdGlmIChlbGVtZW50ICE9PSB0aGlzLnJvb3QuZWxlbWVudCkge1xuXHRcdFx0XHRlbGVtZW50cy5wdXNoKGVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBJdGVyYWJsZS5yZXZlcnNlKGVsZW1lbnRzKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5leHBhbmQoZWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0dGhpcy50cmVlLmV4cGFuZFRvKHRoaXMuZ2V0RGF0YU5vZGUoZWxlbWVudCkpO1xuXHR9XG5cblx0Y29sbGFwc2VBbGwoKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlLmNvbGxhcHNlQWxsKCk7XG5cdH1cblxuXHRpc0NvbGxhcHNpYmxlKGVsZW1lbnQ6IFQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy50cmVlLmlzQ29sbGFwc2libGUodGhpcy5nZXREYXRhTm9kZShlbGVtZW50KSk7XG5cdH1cblxuXHRpc0NvbGxhcHNlZChlbGVtZW50OiBUSW5wdXQgfCBUKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5pc0NvbGxhcHNlZCh0aGlzLmdldERhdGFOb2RlKGVsZW1lbnQpKTtcblx0fVxuXG5cdHRyaWdnZXJUeXBlTmF2aWdhdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUudHJpZ2dlclR5cGVOYXZpZ2F0aW9uKCk7XG5cdH1cblxuXHRvcGVuRmluZCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5maW5kQ29udHJvbGxlcikge1xuXHRcdFx0dGhpcy5maW5kQ29udHJvbGxlci5vcGVuKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudHJlZS5vcGVuRmluZCgpO1xuXHRcdH1cblx0fVxuXG5cdGNsb3NlRmluZCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5maW5kQ29udHJvbGxlcikge1xuXHRcdFx0dGhpcy5maW5kQ29udHJvbGxlci5jbG9zZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRyZWUuY2xvc2VGaW5kKCk7XG5cdFx0fVxuXHR9XG5cblx0cmVmaWx0ZXIoKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlLnJlZmlsdGVyKCk7XG5cdH1cblxuXHRzZXRBbmNob3IoZWxlbWVudDogVCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMudHJlZS5zZXRBbmNob3IodHlwZW9mIGVsZW1lbnQgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogdGhpcy5nZXREYXRhTm9kZShlbGVtZW50KSk7XG5cdH1cblxuXHRnZXRBbmNob3IoKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMudHJlZS5nZXRBbmNob3IoKTtcblx0XHRyZXR1cm4gbm9kZT8uZWxlbWVudCBhcyBUO1xuXHR9XG5cblx0c2V0U2VsZWN0aW9uKGVsZW1lbnRzOiBUW10sIGJyb3dzZXJFdmVudD86IFVJRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBub2RlcyA9IGVsZW1lbnRzLm1hcChlID0+IHRoaXMuZ2V0RGF0YU5vZGUoZSkpO1xuXHRcdHRoaXMudHJlZS5zZXRTZWxlY3Rpb24obm9kZXMsIGJyb3dzZXJFdmVudCk7XG5cdH1cblxuXHRnZXRTZWxlY3Rpb24oKTogVFtdIHtcblx0XHRjb25zdCBub2RlcyA9IHRoaXMudHJlZS5nZXRTZWxlY3Rpb24oKTtcblx0XHRyZXR1cm4gbm9kZXMubWFwKG4gPT4gbiEuZWxlbWVudCBhcyBUKTtcblx0fVxuXG5cdHNldEZvY3VzKGVsZW1lbnRzOiBUW10sIGJyb3dzZXJFdmVudD86IFVJRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBub2RlcyA9IGVsZW1lbnRzLm1hcChlID0+IHRoaXMuZ2V0RGF0YU5vZGUoZSkpO1xuXHRcdHRoaXMudHJlZS5zZXRGb2N1cyhub2RlcywgYnJvd3NlckV2ZW50KTtcblx0fVxuXG5cdGZvY3VzTmV4dChuID0gMSwgbG9vcCA9IGZhbHNlLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy50cmVlLmZvY3VzTmV4dChuLCBsb29wLCBicm93c2VyRXZlbnQsIHRoaXMuZm9jdXNOYXZpZ2F0aW9uRmlsdGVyKTtcblx0fVxuXG5cdGZvY3VzUHJldmlvdXMobiA9IDEsIGxvb3AgPSBmYWxzZSwgYnJvd3NlckV2ZW50PzogVUlFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMudHJlZS5mb2N1c1ByZXZpb3VzKG4sIGxvb3AsIGJyb3dzZXJFdmVudCwgdGhpcy5mb2N1c05hdmlnYXRpb25GaWx0ZXIpO1xuXHR9XG5cblx0Zm9jdXNOZXh0UGFnZShicm93c2VyRXZlbnQ/OiBVSUV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5mb2N1c05leHRQYWdlKGJyb3dzZXJFdmVudCwgdGhpcy5mb2N1c05hdmlnYXRpb25GaWx0ZXIpO1xuXHR9XG5cblx0Zm9jdXNQcmV2aW91c1BhZ2UoYnJvd3NlckV2ZW50PzogVUlFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLnRyZWUuZm9jdXNQcmV2aW91c1BhZ2UoYnJvd3NlckV2ZW50LCB0aGlzLmZvY3VzTmF2aWdhdGlvbkZpbHRlcik7XG5cdH1cblxuXHRmb2N1c0xhc3QoYnJvd3NlckV2ZW50PzogVUlFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMudHJlZS5mb2N1c0xhc3QoYnJvd3NlckV2ZW50LCB0aGlzLmZvY3VzTmF2aWdhdGlvbkZpbHRlcik7XG5cdH1cblxuXHRmb2N1c0ZpcnN0KGJyb3dzZXJFdmVudD86IFVJRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUuZm9jdXNGaXJzdChicm93c2VyRXZlbnQsIHRoaXMuZm9jdXNOYXZpZ2F0aW9uRmlsdGVyKTtcblx0fVxuXG5cdGdldEZvY3VzKCk6IFRbXSB7XG5cdFx0Y29uc3Qgbm9kZXMgPSB0aGlzLnRyZWUuZ2V0Rm9jdXMoKTtcblx0XHRyZXR1cm4gbm9kZXMubWFwKG4gPT4gbiEuZWxlbWVudCBhcyBUKTtcblx0fVxuXG5cdGdldFN0aWNreVNjcm9sbEZvY3VzKCk6IFRbXSB7XG5cdFx0Y29uc3Qgbm9kZXMgPSB0aGlzLnRyZWUuZ2V0U3RpY2t5U2Nyb2xsRm9jdXMoKTtcblx0XHRyZXR1cm4gbm9kZXMubWFwKG4gPT4gbiEuZWxlbWVudCBhcyBUKTtcblx0fVxuXG5cdGdldEZvY3VzZWRQYXJ0KCk6IEFic3RyYWN0VHJlZVBhcnQge1xuXHRcdHJldHVybiB0aGlzLnRyZWUuZ2V0Rm9jdXNlZFBhcnQoKTtcblx0fVxuXG5cdHJldmVhbChlbGVtZW50OiBULCByZWxhdGl2ZVRvcD86IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMudHJlZS5yZXZlYWwodGhpcy5nZXREYXRhTm9kZShlbGVtZW50KSwgcmVsYXRpdmVUb3ApO1xuXHR9XG5cblx0Z2V0UmVsYXRpdmVUb3AoZWxlbWVudDogVCk6IG51bWJlciB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLnRyZWUuZ2V0UmVsYXRpdmVUb3AodGhpcy5nZXREYXRhTm9kZShlbGVtZW50KSk7XG5cdH1cblxuXHQvLyBUcmVlIG5hdmlnYXRpb25cblxuXHRnZXRQYXJlbnRFbGVtZW50KGVsZW1lbnQ6IFQpOiBUSW5wdXQgfCBUIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy50cmVlLmdldFBhcmVudEVsZW1lbnQodGhpcy5nZXREYXRhTm9kZShlbGVtZW50KSk7XG5cdFx0cmV0dXJuIChub2RlICYmIG5vZGUuZWxlbWVudCkhO1xuXHR9XG5cblx0Z2V0Rmlyc3RFbGVtZW50Q2hpbGQoZWxlbWVudDogVElucHV0IHwgVCA9IHRoaXMucm9vdC5lbGVtZW50KTogVElucHV0IHwgVCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZGF0YU5vZGUgPSB0aGlzLmdldERhdGFOb2RlKGVsZW1lbnQpO1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLnRyZWUuZ2V0Rmlyc3RFbGVtZW50Q2hpbGQoZGF0YU5vZGUgPT09IHRoaXMucm9vdCA/IG51bGwgOiBkYXRhTm9kZSk7XG5cdFx0cmV0dXJuIChub2RlICYmIG5vZGUuZWxlbWVudCkhO1xuXHR9XG5cblx0Ly8gSW1wbGVtZW50YXRpb25cblxuXHRwcm90ZWN0ZWQgZ2V0RGF0YU5vZGUoZWxlbWVudDogVElucHV0IHwgVCk6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHtcblx0XHRjb25zdCBub2RlOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiB8IHVuZGVmaW5lZCA9IHRoaXMubm9kZXMuZ2V0KChlbGVtZW50ID09PSB0aGlzLnJvb3QuZWxlbWVudCA/IG51bGwgOiBlbGVtZW50KSBhcyBUKTtcblxuXHRcdGlmICghbm9kZSkge1xuXHRcdFx0Y29uc3Qgbm9kZUlkZW50aXR5ID0gdGhpcy5pZGVudGl0eVByb3ZpZGVyPy5nZXRJZChlbGVtZW50IGFzIFQpLnRvU3RyaW5nKCk7XG5cdFx0XHR0aHJvdyBuZXcgVHJlZUVycm9yKHRoaXMudXNlciwgYERhdGEgdHJlZSBub2RlIG5vdCBmb3VuZCR7bm9kZUlkZW50aXR5ID8gYDogJHtub2RlSWRlbnRpdHl9YCA6ICcnfWApO1xuXHRcdH1cblxuXHRcdHJldHVybiBub2RlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWZyZXNoQW5kUmVuZGVyTm9kZShub2RlOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgcmVjdXJzaXZlOiBib29sZWFuLCB2aWV3U3RhdGVDb250ZXh0PzogSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGVDb250ZXh0PFRJbnB1dCwgVD4sIG9wdGlvbnM/OiBJQXN5bmNEYXRhVHJlZVVwZGF0ZUNoaWxkcmVuT3B0aW9uczxUPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmRpc3Bvc2FibGVzLmlzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjsgLy8gdHJlZSBkaXNwb3NlZCBkdXJpbmcgcmVmcmVzaCwgYWdhaW4gKCMyMjgyMTEpXG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMucmVmcmVzaE5vZGUobm9kZSwgcmVjdXJzaXZlLCB2aWV3U3RhdGVDb250ZXh0KTtcblx0XHRpZiAodGhpcy5kaXNwb3NhYmxlcy5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47IC8vIHRyZWUgZGlzcG9zZWQgZHVyaW5nIHJlZnJlc2ggKCMxOTkyNjQpXG5cdFx0fVxuXHRcdHRoaXMucmVuZGVyKG5vZGUsIHZpZXdTdGF0ZUNvbnRleHQsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWZyZXNoTm9kZShub2RlOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgcmVjdXJzaXZlOiBib29sZWFuLCB2aWV3U3RhdGVDb250ZXh0PzogSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGVDb250ZXh0PFRJbnB1dCwgVD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgcmVzdWx0OiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5zdWJUcmVlUmVmcmVzaFByb21pc2VzLmZvckVhY2goKHJlZnJlc2hQcm9taXNlLCByZWZyZXNoTm9kZSkgPT4ge1xuXHRcdFx0aWYgKCFyZXN1bHQgJiYgaW50ZXJzZWN0cyhyZWZyZXNoTm9kZSwgbm9kZSkpIHtcblx0XHRcdFx0cmVzdWx0ID0gcmVmcmVzaFByb21pc2UudGhlbigoKSA9PiB0aGlzLnJlZnJlc2hOb2RlKG5vZGUsIHJlY3Vyc2l2ZSwgdmlld1N0YXRlQ29udGV4dCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRpZiAobm9kZSAhPT0gdGhpcy5yb290KSB7XG5cdFx0XHRjb25zdCB0cmVlTm9kZSA9IHRoaXMudHJlZS5nZXROb2RlKG5vZGUpO1xuXG5cdFx0XHRpZiAodHJlZU5vZGUuY29sbGFwc2VkKSB7XG5cdFx0XHRcdG5vZGUuaGFzQ2hpbGRyZW4gPSAhIXRoaXMuZGF0YVNvdXJjZS5oYXNDaGlsZHJlbihub2RlLmVsZW1lbnQpO1xuXHRcdFx0XHRub2RlLnN0YWxlID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5zZXRDaGlsZHJlbihub2RlLCBbXSwgcmVjdXJzaXZlLCB2aWV3U3RhdGVDb250ZXh0KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRvUmVmcmVzaFN1YlRyZWUobm9kZSwgcmVjdXJzaXZlLCB2aWV3U3RhdGVDb250ZXh0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9SZWZyZXNoU3ViVHJlZShub2RlOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgcmVjdXJzaXZlOiBib29sZWFuLCB2aWV3U3RhdGVDb250ZXh0PzogSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGVDb250ZXh0PFRJbnB1dCwgVD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgZG9uZTogKCkgPT4gdm9pZDtcblx0XHRub2RlLnJlZnJlc2hQcm9taXNlID0gbmV3IFByb21pc2UoYyA9PiBkb25lID0gYyk7XG5cdFx0dGhpcy5zdWJUcmVlUmVmcmVzaFByb21pc2VzLnNldChub2RlLCBub2RlLnJlZnJlc2hQcm9taXNlKTtcblxuXHRcdG5vZGUucmVmcmVzaFByb21pc2UuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRub2RlLnJlZnJlc2hQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5zdWJUcmVlUmVmcmVzaFByb21pc2VzLmRlbGV0ZShub2RlKTtcblx0XHR9KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjaGlsZHJlblRvUmVmcmVzaCA9IGF3YWl0IHRoaXMuZG9SZWZyZXNoTm9kZShub2RlLCByZWN1cnNpdmUsIHZpZXdTdGF0ZUNvbnRleHQpO1xuXHRcdFx0bm9kZS5zdGFsZSA9IGZhbHNlO1xuXG5cdFx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKGNoaWxkcmVuVG9SZWZyZXNoLm1hcChjaGlsZCA9PiB0aGlzLmRvUmVmcmVzaFN1YlRyZWUoY2hpbGQsIHJlY3Vyc2l2ZSwgdmlld1N0YXRlQ29udGV4dCkpKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0ZG9uZSEoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVmcmVzaE5vZGUobm9kZTogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIHJlY3Vyc2l2ZTogYm9vbGVhbiwgdmlld1N0YXRlQ29udGV4dD86IElBc3luY0RhdGFUcmVlVmlld1N0YXRlQ29udGV4dDxUSW5wdXQsIFQ+KTogUHJvbWlzZTxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPltdPiB7XG5cdFx0bm9kZS5oYXNDaGlsZHJlbiA9ICEhdGhpcy5kYXRhU291cmNlLmhhc0NoaWxkcmVuKG5vZGUuZWxlbWVudCk7XG5cblx0XHRsZXQgY2hpbGRyZW5Qcm9taXNlOiBQcm9taXNlPEl0ZXJhYmxlPFQ+PjtcblxuXHRcdGlmICghbm9kZS5oYXNDaGlsZHJlbikge1xuXHRcdFx0Y2hpbGRyZW5Qcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKEl0ZXJhYmxlLmVtcHR5KCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBjaGlsZHJlbiA9IHRoaXMuZG9HZXRDaGlsZHJlbihub2RlKTtcblx0XHRcdGlmIChpc0l0ZXJhYmxlKGNoaWxkcmVuKSkge1xuXHRcdFx0XHRjaGlsZHJlblByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoY2hpbGRyZW4pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3Qgc2xvd1RpbWVvdXQgPSB0aW1lb3V0KDgwMCk7XG5cblx0XHRcdFx0c2xvd1RpbWVvdXQudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0bm9kZS5zbG93ID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU5vZGVTbG93U3RhdGUuZmlyZShub2RlKTtcblx0XHRcdFx0fSwgXyA9PiBudWxsKTtcblxuXHRcdFx0XHRjaGlsZHJlblByb21pc2UgPSBjaGlsZHJlbi5maW5hbGx5KCgpID0+IHNsb3dUaW1lb3V0LmNhbmNlbCgpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY2hpbGRyZW4gPSBhd2FpdCBjaGlsZHJlblByb21pc2U7XG5cdFx0XHRyZXR1cm4gdGhpcy5zZXRDaGlsZHJlbihub2RlLCBjaGlsZHJlbiwgcmVjdXJzaXZlLCB2aWV3U3RhdGVDb250ZXh0KTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGlmIChub2RlICE9PSB0aGlzLnJvb3QgJiYgdGhpcy50cmVlLmhhc0VsZW1lbnQobm9kZSkpIHtcblx0XHRcdFx0dGhpcy50cmVlLmNvbGxhcHNlKG5vZGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNDYW5jZWxsYXRpb25FcnJvcihlcnIpKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0dGhyb3cgZXJyO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRpZiAobm9kZS5zbG93KSB7XG5cdFx0XHRcdG5vZGUuc2xvdyA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU5vZGVTbG93U3RhdGUuZmlyZShub2RlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvR2V0Q2hpbGRyZW4obm9kZTogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4pOiBQcm9taXNlPEl0ZXJhYmxlPFQ+PiB8IEl0ZXJhYmxlPFQ+IHtcblx0XHRsZXQgcmVzdWx0ID0gdGhpcy5yZWZyZXNoUHJvbWlzZXMuZ2V0KG5vZGUpO1xuXG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdFx0Y29uc3QgY2hpbGRyZW4gPSB0aGlzLmRhdGFTb3VyY2UuZ2V0Q2hpbGRyZW4obm9kZS5lbGVtZW50KTtcblx0XHRpZiAoaXNJdGVyYWJsZShjaGlsZHJlbikpIHtcblx0XHRcdHJldHVybiB0aGlzLnByb2Nlc3NDaGlsZHJlbihjaGlsZHJlbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdCA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jICgpID0+IHRoaXMucHJvY2Vzc0NoaWxkcmVuKGF3YWl0IGNoaWxkcmVuKSk7XG5cdFx0XHR0aGlzLnJlZnJlc2hQcm9taXNlcy5zZXQobm9kZSwgcmVzdWx0KTtcblx0XHRcdHJldHVybiByZXN1bHQuZmluYWxseSgoKSA9PiB7IHRoaXMucmVmcmVzaFByb21pc2VzLmRlbGV0ZShub2RlKTsgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKHsgbm9kZSwgZGVlcCB9OiBJQ29sbGFwc2VTdGF0ZUNoYW5nZUV2ZW50PElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+IHwgbnVsbCwgYW55Pik6IHZvaWQge1xuXHRcdGlmIChub2RlLmVsZW1lbnQgPT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIW5vZGUuY29sbGFwc2VkICYmIG5vZGUuZWxlbWVudC5zdGFsZSkge1xuXHRcdFx0aWYgKGRlZXApIHtcblx0XHRcdFx0dGhpcy5jb2xsYXBzZShub2RlLmVsZW1lbnQuZWxlbWVudCBhcyBUKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucmVmcmVzaEFuZFJlbmRlck5vZGUobm9kZS5lbGVtZW50LCBmYWxzZSlcblx0XHRcdFx0XHQuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2V0Q2hpbGRyZW4obm9kZTogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIGNoaWxkcmVuRWxlbWVudHNJdGVyYWJsZTogSXRlcmFibGU8VD4sIHJlY3Vyc2l2ZTogYm9vbGVhbiwgdmlld1N0YXRlQ29udGV4dD86IElBc3luY0RhdGFUcmVlVmlld1N0YXRlQ29udGV4dDxUSW5wdXQsIFQ+KTogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD5bXSB7XG5cdFx0Y29uc3QgY2hpbGRyZW5FbGVtZW50cyA9IFsuLi5jaGlsZHJlbkVsZW1lbnRzSXRlcmFibGVdO1xuXG5cdFx0Ly8gcGVyZjogaWYgdGhlIG5vZGUgd2FzIGFuZCBzdGlsbCBpcyBhIGxlYWYsIGF2b2lkIGFsbCB0aGlzIGhhc3NsZVxuXHRcdGlmIChub2RlLmNoaWxkcmVuLmxlbmd0aCA9PT0gMCAmJiBjaGlsZHJlbkVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vZGVzVG9Gb3JnZXQgPSBuZXcgTWFwPFQsIElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+PigpO1xuXHRcdGNvbnN0IGNoaWxkcmVuVHJlZU5vZGVzQnlJZCA9IG5ldyBNYXA8c3RyaW5nLCB7IG5vZGU6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+OyBjb2xsYXBzZWQ6IGJvb2xlYW4gfT4oKTtcblxuXHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuXHRcdFx0bm9kZXNUb0ZvcmdldC5zZXQoY2hpbGQuZWxlbWVudCBhcyBULCBjaGlsZCk7XG5cblx0XHRcdGlmICh0aGlzLmlkZW50aXR5UHJvdmlkZXIpIHtcblx0XHRcdFx0Y2hpbGRyZW5UcmVlTm9kZXNCeUlkLnNldChjaGlsZC5pZCEsIHsgbm9kZTogY2hpbGQsIGNvbGxhcHNlZDogdGhpcy50cmVlLmhhc0VsZW1lbnQoY2hpbGQpICYmIHRoaXMudHJlZS5pc0NvbGxhcHNlZChjaGlsZCkgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2hpbGRyZW5Ub1JlZnJlc2g6IElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+W10gPSBbXTtcblxuXHRcdGNvbnN0IGNoaWxkcmVuID0gY2hpbGRyZW5FbGVtZW50cy5tYXA8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4+KGVsZW1lbnQgPT4ge1xuXHRcdFx0Y29uc3QgaGFzQ2hpbGRyZW4gPSAhIXRoaXMuZGF0YVNvdXJjZS5oYXNDaGlsZHJlbihlbGVtZW50KTtcblxuXHRcdFx0aWYgKCF0aGlzLmlkZW50aXR5UHJvdmlkZXIpIHtcblx0XHRcdFx0Y29uc3QgYXN5bmNEYXRhVHJlZU5vZGUgPSBjcmVhdGVBc3luY0RhdGFUcmVlTm9kZSh7IGVsZW1lbnQsIHBhcmVudDogbm9kZSwgaGFzQ2hpbGRyZW4sIGRlZmF1bHRDb2xsYXBzZVN0YXRlOiB0aGlzLmdldERlZmF1bHRDb2xsYXBzZVN0YXRlKGVsZW1lbnQpIH0pO1xuXG5cdFx0XHRcdGlmIChoYXNDaGlsZHJlbiAmJiBhc3luY0RhdGFUcmVlTm9kZS5kZWZhdWx0Q29sbGFwc2VTdGF0ZSA9PT0gT2JqZWN0VHJlZUVsZW1lbnRDb2xsYXBzZVN0YXRlLlByZXNlcnZlT3JFeHBhbmRlZCkge1xuXHRcdFx0XHRcdGNoaWxkcmVuVG9SZWZyZXNoLnB1c2goYXN5bmNEYXRhVHJlZU5vZGUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGFzeW5jRGF0YVRyZWVOb2RlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpZCA9IHRoaXMuaWRlbnRpdHlQcm92aWRlci5nZXRJZChlbGVtZW50KS50b1N0cmluZygpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gY2hpbGRyZW5UcmVlTm9kZXNCeUlkLmdldChpZCk7XG5cblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0Y29uc3QgYXN5bmNEYXRhVHJlZU5vZGUgPSByZXN1bHQubm9kZTtcblxuXHRcdFx0XHRub2Rlc1RvRm9yZ2V0LmRlbGV0ZShhc3luY0RhdGFUcmVlTm9kZS5lbGVtZW50IGFzIFQpO1xuXHRcdFx0XHR0aGlzLm5vZGVzLmRlbGV0ZShhc3luY0RhdGFUcmVlTm9kZS5lbGVtZW50IGFzIFQpO1xuXHRcdFx0XHR0aGlzLm5vZGVzLnNldChlbGVtZW50LCBhc3luY0RhdGFUcmVlTm9kZSk7XG5cblx0XHRcdFx0YXN5bmNEYXRhVHJlZU5vZGUuZWxlbWVudCA9IGVsZW1lbnQ7XG5cdFx0XHRcdGFzeW5jRGF0YVRyZWVOb2RlLmhhc0NoaWxkcmVuID0gaGFzQ2hpbGRyZW47XG5cblx0XHRcdFx0aWYgKHJlY3Vyc2l2ZSkge1xuXHRcdFx0XHRcdGlmIChyZXN1bHQuY29sbGFwc2VkKSB7XG5cdFx0XHRcdFx0XHRhc3luY0RhdGFUcmVlTm9kZS5jaGlsZHJlbi5mb3JFYWNoKG5vZGUgPT4gZGZzKG5vZGUsIG5vZGUgPT4gdGhpcy5ub2Rlcy5kZWxldGUobm9kZS5lbGVtZW50IGFzIFQpKSk7XG5cdFx0XHRcdFx0XHRhc3luY0RhdGFUcmVlTm9kZS5jaGlsZHJlbi5zcGxpY2UoMCwgYXN5bmNEYXRhVHJlZU5vZGUuY2hpbGRyZW4ubGVuZ3RoKTtcblx0XHRcdFx0XHRcdGFzeW5jRGF0YVRyZWVOb2RlLnN0YWxlID0gdHJ1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y2hpbGRyZW5Ub1JlZnJlc2gucHVzaChhc3luY0RhdGFUcmVlTm9kZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKGhhc0NoaWxkcmVuICYmICFyZXN1bHQuY29sbGFwc2VkKSB7XG5cdFx0XHRcdFx0Y2hpbGRyZW5Ub1JlZnJlc2gucHVzaChhc3luY0RhdGFUcmVlTm9kZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gYXN5bmNEYXRhVHJlZU5vZGU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNoaWxkQXN5bmNEYXRhVHJlZU5vZGUgPSBjcmVhdGVBc3luY0RhdGFUcmVlTm9kZSh7IGVsZW1lbnQsIHBhcmVudDogbm9kZSwgaWQsIGhhc0NoaWxkcmVuLCBkZWZhdWx0Q29sbGFwc2VTdGF0ZTogdGhpcy5nZXREZWZhdWx0Q29sbGFwc2VTdGF0ZShlbGVtZW50KSB9KTtcblxuXHRcdFx0aWYgKHZpZXdTdGF0ZUNvbnRleHQgJiYgdmlld1N0YXRlQ29udGV4dC52aWV3U3RhdGUuZm9jdXMgJiYgdmlld1N0YXRlQ29udGV4dC52aWV3U3RhdGUuZm9jdXMuaW5kZXhPZihpZCkgPiAtMSkge1xuXHRcdFx0XHR2aWV3U3RhdGVDb250ZXh0LmZvY3VzLnB1c2goY2hpbGRBc3luY0RhdGFUcmVlTm9kZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2aWV3U3RhdGVDb250ZXh0ICYmIHZpZXdTdGF0ZUNvbnRleHQudmlld1N0YXRlLnNlbGVjdGlvbiAmJiB2aWV3U3RhdGVDb250ZXh0LnZpZXdTdGF0ZS5zZWxlY3Rpb24uaW5kZXhPZihpZCkgPiAtMSkge1xuXHRcdFx0XHR2aWV3U3RhdGVDb250ZXh0LnNlbGVjdGlvbi5wdXNoKGNoaWxkQXN5bmNEYXRhVHJlZU5vZGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodmlld1N0YXRlQ29udGV4dCAmJiB2aWV3U3RhdGVDb250ZXh0LnZpZXdTdGF0ZS5leHBhbmRlZCAmJiB2aWV3U3RhdGVDb250ZXh0LnZpZXdTdGF0ZS5leHBhbmRlZC5pbmRleE9mKGlkKSA+IC0xKSB7XG5cdFx0XHRcdGNoaWxkcmVuVG9SZWZyZXNoLnB1c2goY2hpbGRBc3luY0RhdGFUcmVlTm9kZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGhhc0NoaWxkcmVuICYmIGNoaWxkQXN5bmNEYXRhVHJlZU5vZGUuZGVmYXVsdENvbGxhcHNlU3RhdGUgPT09IE9iamVjdFRyZWVFbGVtZW50Q29sbGFwc2VTdGF0ZS5QcmVzZXJ2ZU9yRXhwYW5kZWQpIHtcblx0XHRcdFx0Y2hpbGRyZW5Ub1JlZnJlc2gucHVzaChjaGlsZEFzeW5jRGF0YVRyZWVOb2RlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNoaWxkQXN5bmNEYXRhVHJlZU5vZGU7XG5cdFx0fSk7XG5cblx0XHRmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXNUb0ZvcmdldC52YWx1ZXMoKSkge1xuXHRcdFx0ZGZzKG5vZGUsIG5vZGUgPT4gdGhpcy5ub2Rlcy5kZWxldGUobm9kZS5lbGVtZW50IGFzIFQpKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG5cdFx0XHR0aGlzLm5vZGVzLnNldChjaGlsZC5lbGVtZW50IGFzIFQsIGNoaWxkKTtcblx0XHR9XG5cblx0XHRzcGxpY2Uobm9kZS5jaGlsZHJlbiwgMCwgbm9kZS5jaGlsZHJlbi5sZW5ndGgsIGNoaWxkcmVuKTtcblxuXHRcdC8vIFRPRE9Aam9hbyB0aGlzIGRvZXNuJ3QgdGFrZSBmaWx0ZXIgaW50byBhY2NvdW50XG5cdFx0aWYgKG5vZGUgIT09IHRoaXMucm9vdCAmJiB0aGlzLmF1dG9FeHBhbmRTaW5nbGVDaGlsZHJlbiAmJiBjaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgY2hpbGRyZW5Ub1JlZnJlc2gubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRjaGlsZHJlblswXS5mb3JjZUV4cGFuZGVkID0gdHJ1ZTtcblx0XHRcdGNoaWxkcmVuVG9SZWZyZXNoLnB1c2goY2hpbGRyZW5bMF0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBjaGlsZHJlblRvUmVmcmVzaDtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXIobm9kZTogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIHZpZXdTdGF0ZUNvbnRleHQ/OiBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZUNvbnRleHQ8VElucHV0LCBUPiwgb3B0aW9ucz86IElBc3luY0RhdGFUcmVlVXBkYXRlQ2hpbGRyZW5PcHRpb25zPFQ+KTogdm9pZCB7XG5cdFx0Y29uc3QgY2hpbGRyZW4gPSBub2RlLmNoaWxkcmVuLm1hcChub2RlID0+IHRoaXMuYXNUcmVlRWxlbWVudChub2RlLCB2aWV3U3RhdGVDb250ZXh0KSk7XG5cdFx0Y29uc3Qgb2JqZWN0VHJlZU9wdGlvbnM6IElPYmplY3RUcmVlU2V0Q2hpbGRyZW5PcHRpb25zPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+PiB8IHVuZGVmaW5lZCA9IG9wdGlvbnMgJiYge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdGRpZmZJZGVudGl0eVByb3ZpZGVyOiBvcHRpb25zLmRpZmZJZGVudGl0eVByb3ZpZGVyICYmIHtcblx0XHRcdFx0Z2V0SWQobm9kZTogSUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4pOiB7IHRvU3RyaW5nKCk6IHN0cmluZyB9IHtcblx0XHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5kaWZmSWRlbnRpdHlQcm92aWRlciEuZ2V0SWQobm9kZS5lbGVtZW50IGFzIFQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMudHJlZS5zZXRDaGlsZHJlbihub2RlID09PSB0aGlzLnJvb3QgPyBudWxsIDogbm9kZSwgY2hpbGRyZW4sIG9iamVjdFRyZWVPcHRpb25zKTtcblxuXHRcdGlmIChub2RlICE9PSB0aGlzLnJvb3QpIHtcblx0XHRcdHRoaXMudHJlZS5zZXRDb2xsYXBzaWJsZShub2RlLCBub2RlLmhhc0NoaWxkcmVuKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZFJlbmRlci5maXJlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXNUcmVlRWxlbWVudChub2RlOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgdmlld1N0YXRlQ29udGV4dD86IElBc3luY0RhdGFUcmVlVmlld1N0YXRlQ29udGV4dDxUSW5wdXQsIFQ+KTogSU9iamVjdFRyZWVFbGVtZW50PElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+PiB7XG5cdFx0aWYgKG5vZGUuc3RhbGUpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGVsZW1lbnQ6IG5vZGUsXG5cdFx0XHRcdGNvbGxhcHNpYmxlOiBub2RlLmhhc0NoaWxkcmVuLFxuXHRcdFx0XHRjb2xsYXBzZWQ6IHRydWVcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0bGV0IGNvbGxhcHNlZDogYm9vbGVhbiB8IE9iamVjdFRyZWVFbGVtZW50Q29sbGFwc2VTdGF0ZS5QcmVzZXJ2ZU9yQ29sbGFwc2VkIHwgT2JqZWN0VHJlZUVsZW1lbnRDb2xsYXBzZVN0YXRlLlByZXNlcnZlT3JFeHBhbmRlZCB8IHVuZGVmaW5lZDtcblxuXHRcdGlmICh2aWV3U3RhdGVDb250ZXh0ICYmIHZpZXdTdGF0ZUNvbnRleHQudmlld1N0YXRlLmV4cGFuZGVkICYmIG5vZGUuaWQgJiYgdmlld1N0YXRlQ29udGV4dC52aWV3U3RhdGUuZXhwYW5kZWQuaW5kZXhPZihub2RlLmlkKSA+IC0xKSB7XG5cdFx0XHRjb2xsYXBzZWQgPSBmYWxzZTtcblx0XHR9IGVsc2UgaWYgKG5vZGUuZm9yY2VFeHBhbmRlZCkge1xuXHRcdFx0Y29sbGFwc2VkID0gZmFsc2U7XG5cdFx0XHRub2RlLmZvcmNlRXhwYW5kZWQgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29sbGFwc2VkID0gbm9kZS5kZWZhdWx0Q29sbGFwc2VTdGF0ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWxlbWVudDogbm9kZSxcblx0XHRcdGNoaWxkcmVuOiBub2RlLmhhc0NoaWxkcmVuID8gSXRlcmFibGUubWFwKG5vZGUuY2hpbGRyZW4sIGNoaWxkID0+IHRoaXMuYXNUcmVlRWxlbWVudChjaGlsZCwgdmlld1N0YXRlQ29udGV4dCkpIDogW10sXG5cdFx0XHRjb2xsYXBzaWJsZTogbm9kZS5oYXNDaGlsZHJlbixcblx0XHRcdGNvbGxhcHNlZFxuXHRcdH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgcHJvY2Vzc0NoaWxkcmVuKGNoaWxkcmVuOiBJdGVyYWJsZTxUPik6IEl0ZXJhYmxlPFQ+IHtcblx0XHRpZiAodGhpcy5zb3J0ZXIpIHtcblx0XHRcdGNoaWxkcmVuID0gWy4uLmNoaWxkcmVuXS5zb3J0KHRoaXMuc29ydGVyLmNvbXBhcmUuYmluZCh0aGlzLnNvcnRlcikpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjaGlsZHJlbjtcblx0fVxuXG5cdC8vIHZpZXcgc3RhdGVcblxuXHRnZXRWaWV3U3RhdGUoKTogSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGUge1xuXHRcdGlmICghdGhpcy5pZGVudGl0eVByb3ZpZGVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHJlZUVycm9yKHRoaXMudXNlciwgJ0NhblxcJ3QgZ2V0IHRyZWUgdmlldyBzdGF0ZSB3aXRob3V0IGFuIGlkZW50aXR5IHByb3ZpZGVyJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ2V0SWQgPSAoZWxlbWVudDogVCkgPT4gdGhpcy5pZGVudGl0eVByb3ZpZGVyIS5nZXRJZChlbGVtZW50KS50b1N0cmluZygpO1xuXHRcdGNvbnN0IGZvY3VzID0gdGhpcy5nZXRGb2N1cygpLm1hcChnZXRJZCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5nZXRTZWxlY3Rpb24oKS5tYXAoZ2V0SWQpO1xuXG5cdFx0Y29uc3QgZXhwYW5kZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgcm9vdCA9IHRoaXMudHJlZS5nZXROb2RlKCk7XG5cdFx0Y29uc3Qgc3RhY2sgPSBbcm9vdF07XG5cblx0XHR3aGlsZSAoc3RhY2subGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3Qgbm9kZSA9IHN0YWNrLnBvcCgpITtcblxuXHRcdFx0aWYgKG5vZGUgIT09IHJvb3QgJiYgbm9kZS5jb2xsYXBzaWJsZSAmJiAhbm9kZS5jb2xsYXBzZWQpIHtcblx0XHRcdFx0ZXhwYW5kZWQucHVzaChnZXRJZChub2RlLmVsZW1lbnQhLmVsZW1lbnQgYXMgVCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpbnNlcnRJbnRvKHN0YWNrLCBzdGFjay5sZW5ndGgsIG5vZGUuY2hpbGRyZW4pO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGZvY3VzLCBzZWxlY3Rpb24sIGV4cGFuZGVkLCBzY3JvbGxUb3A6IHRoaXMuc2Nyb2xsVG9wIH07XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMudHJlZS5kaXNwb3NlKCk7XG5cdH1cbn1cblxudHlwZSBDb21wcmVzc2libGVBc3luY0RhdGFUcmVlTm9kZU1hcHBlcjxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPiA9IFdlYWtNYXBwZXI8SVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4+LCBURmlsdGVyRGF0YT4sIElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFRJbnB1dCB8IFQ+LCBURmlsdGVyRGF0YT4+O1xuXG5jbGFzcyBDb21wcmVzc2libGVBc3luY0RhdGFUcmVlTm9kZVdyYXBwZXI8VElucHV0LCBULCBURmlsdGVyRGF0YT4gaW1wbGVtZW50cyBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxUSW5wdXQgfCBUPiwgVEZpbHRlckRhdGE+IHtcblxuXHRnZXQgZWxlbWVudCgpOiBJQ29tcHJlc3NlZFRyZWVOb2RlPFRJbnB1dCB8IFQ+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWxlbWVudHM6IHRoaXMubm9kZS5lbGVtZW50LmVsZW1lbnRzLm1hcChlID0+IGUuZWxlbWVudCksXG5cdFx0XHRpbmNvbXByZXNzaWJsZTogdGhpcy5ub2RlLmVsZW1lbnQuaW5jb21wcmVzc2libGVcblx0XHR9O1xuXHR9XG5cblx0Z2V0IGNoaWxkcmVuKCk6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFRJbnB1dCB8IFQ+LCBURmlsdGVyRGF0YT5bXSB7IHJldHVybiB0aGlzLm5vZGUuY2hpbGRyZW4ubWFwKG5vZGUgPT4gbmV3IENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVOb2RlV3JhcHBlcihub2RlKSk7IH1cblx0Z2V0IGRlcHRoKCk6IG51bWJlciB7IHJldHVybiB0aGlzLm5vZGUuZGVwdGg7IH1cblx0Z2V0IHZpc2libGVDaGlsZHJlbkNvdW50KCk6IG51bWJlciB7IHJldHVybiB0aGlzLm5vZGUudmlzaWJsZUNoaWxkcmVuQ291bnQ7IH1cblx0Z2V0IHZpc2libGVDaGlsZEluZGV4KCk6IG51bWJlciB7IHJldHVybiB0aGlzLm5vZGUudmlzaWJsZUNoaWxkSW5kZXg7IH1cblx0Z2V0IGNvbGxhcHNpYmxlKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5ub2RlLmNvbGxhcHNpYmxlOyB9XG5cdGdldCBjb2xsYXBzZWQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLm5vZGUuY29sbGFwc2VkOyB9XG5cdGdldCB2aXNpYmxlKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5ub2RlLnZpc2libGU7IH1cblx0Z2V0IGZpbHRlckRhdGEoKTogVEZpbHRlckRhdGEgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5ub2RlLmZpbHRlckRhdGE7IH1cblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+PiwgVEZpbHRlckRhdGE+KSB7IH1cbn1cblxuY2xhc3MgQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZVJlbmRlcmVyPFRJbnB1dCwgVCwgVEZpbHRlckRhdGEsIFRUZW1wbGF0ZURhdGE+IGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgVEZpbHRlckRhdGEsIElEYXRhVHJlZUxpc3RUZW1wbGF0ZURhdGE8VFRlbXBsYXRlRGF0YT4+IHtcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmc7XG5cdHByaXZhdGUgcmVuZGVyZWROb2RlcyA9IG5ldyBNYXA8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIElEYXRhVHJlZUxpc3RUZW1wbGF0ZURhdGE8VFRlbXBsYXRlRGF0YT4+KCk7XG5cdHByaXZhdGUgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVuZGVyZXI6IElDb21wcmVzc2libGVUcmVlUmVuZGVyZXI8VCwgVEZpbHRlckRhdGEsIFRUZW1wbGF0ZURhdGE+LFxuXHRcdHByb3RlY3RlZCBub2RlTWFwcGVyOiBBc3luY0RhdGFUcmVlTm9kZU1hcHBlcjxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPixcblx0XHRwcml2YXRlIGNvbXByZXNzaWJsZU5vZGVNYXBwZXJQcm92aWRlcjogKCkgPT4gQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZU5vZGVNYXBwZXI8VElucHV0LCBULCBURmlsdGVyRGF0YT4sXG5cdFx0cmVhZG9ubHkgb25EaWRDaGFuZ2VUd2lzdGllU3RhdGU6IEV2ZW50PElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+PlxuXHQpIHtcblx0XHR0aGlzLnRlbXBsYXRlSWQgPSByZW5kZXJlci50ZW1wbGF0ZUlkO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElEYXRhVHJlZUxpc3RUZW1wbGF0ZURhdGE8VFRlbXBsYXRlRGF0YT4ge1xuXHRcdGNvbnN0IHRlbXBsYXRlRGF0YSA9IHRoaXMucmVuZGVyZXIucmVuZGVyVGVtcGxhdGUoY29udGFpbmVyKTtcblx0XHRyZXR1cm4geyB0ZW1wbGF0ZURhdGEgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBURmlsdGVyRGF0YT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSURhdGFUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPiwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlcmVyLnJlbmRlckVsZW1lbnQodGhpcy5ub2RlTWFwcGVyLm1hcChub2RlKSBhcyBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+LCBpbmRleCwgdGVtcGxhdGVEYXRhLnRlbXBsYXRlRGF0YSwgaGVpZ2h0KTtcblx0fVxuXG5cdHJlbmRlckNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPj4sIFRGaWx0ZXJEYXRhPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRGF0YVRyZWVMaXN0VGVtcGxhdGVEYXRhPFRUZW1wbGF0ZURhdGE+LCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyQ29tcHJlc3NlZEVsZW1lbnRzKHRoaXMuY29tcHJlc3NpYmxlTm9kZU1hcHBlclByb3ZpZGVyKCkubWFwKG5vZGUpIGFzIElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+LCBURmlsdGVyRGF0YT4sIGluZGV4LCB0ZW1wbGF0ZURhdGEudGVtcGxhdGVEYXRhLCBoZWlnaHQpO1xuXHR9XG5cblx0cmVuZGVyVHdpc3RpZShlbGVtZW50OiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgdHdpc3RpZUVsZW1lbnQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKGVsZW1lbnQuc2xvdykge1xuXHRcdFx0dHdpc3RpZUVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLnRyZWVJdGVtTG9hZGluZykpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHR3aXN0aWVFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi50cmVlSXRlbUxvYWRpbmcpKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRGaWx0ZXJEYXRhPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRGF0YVRyZWVMaXN0VGVtcGxhdGVEYXRhPFRUZW1wbGF0ZURhdGE+LCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyZXIuZGlzcG9zZUVsZW1lbnQ/Lih0aGlzLm5vZGVNYXBwZXIubWFwKG5vZGUpIGFzIElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIGluZGV4LCB0ZW1wbGF0ZURhdGEudGVtcGxhdGVEYXRhLCBoZWlnaHQpO1xuXHR9XG5cblx0ZGlzcG9zZUNvbXByZXNzZWRFbGVtZW50cyhub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPj4sIFRGaWx0ZXJEYXRhPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRGF0YVRyZWVMaXN0VGVtcGxhdGVEYXRhPFRUZW1wbGF0ZURhdGE+LCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyZXIuZGlzcG9zZUNvbXByZXNzZWRFbGVtZW50cz8uKHRoaXMuY29tcHJlc3NpYmxlTm9kZU1hcHBlclByb3ZpZGVyKCkubWFwKG5vZGUpIGFzIElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+LCBURmlsdGVyRGF0YT4sIGluZGV4LCB0ZW1wbGF0ZURhdGEudGVtcGxhdGVEYXRhLCBoZWlnaHQpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSURhdGFUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPik6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyZXIuZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlcmVkTm9kZXMuY2xlYXIoKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzID0gZGlzcG9zZSh0aGlzLmRpc3Bvc2FibGVzKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUcmVlQ29tcHJlc3Npb25EZWxlZ2F0ZTxUPiB7XG5cdGlzSW5jb21wcmVzc2libGUoZWxlbWVudDogVCk6IGJvb2xlYW47XG59XG5cbmZ1bmN0aW9uIGFzQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU9wdGlvbnM8VElucHV0LCBULCBURmlsdGVyRGF0YT4ob3B0aW9ucz86IElDb21wcmVzc2libGVBc3luY0RhdGFUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4pOiBJQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU9wdGlvbnM8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IG9iamVjdFRyZWVPcHRpb25zID0gb3B0aW9ucyAmJiBhc09iamVjdFRyZWVPcHRpb25zKG9wdGlvbnMpO1xuXG5cdHJldHVybiBvYmplY3RUcmVlT3B0aW9ucyAmJiB7XG5cdFx0Li4ub2JqZWN0VHJlZU9wdGlvbnMsXG5cdFx0a2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjogb2JqZWN0VHJlZU9wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciAmJiB7XG5cdFx0XHQuLi5vYmplY3RUcmVlT3B0aW9ucy5rZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyLFxuXHRcdFx0Z2V0Q29tcHJlc3NlZE5vZGVLZXlib2FyZE5hdmlnYXRpb25MYWJlbChlbHMpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciEuZ2V0Q29tcHJlc3NlZE5vZGVLZXlib2FyZE5hdmlnYXRpb25MYWJlbChlbHMubWFwKGUgPT4gZS5lbGVtZW50IGFzIFQpKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhID0gdm9pZD4gZXh0ZW5kcyBJQXN5bmNEYXRhVHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IHtcblx0cmVhZG9ubHkgY29tcHJlc3Npb25FbmFibGVkPzogYm9vbGVhbjtcblx0cmVhZG9ubHkga2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcj86IElDb21wcmVzc2libGVLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyPFQ+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wcmVzc2libGVBc3luY0RhdGFUcmVlT3B0aW9uc1VwZGF0ZSBleHRlbmRzIElBc3luY0RhdGFUcmVlT3B0aW9uc1VwZGF0ZSB7XG5cdHJlYWRvbmx5IGNvbXByZXNzaW9uRW5hYmxlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPFRJbnB1dCwgVCwgVEZpbHRlckRhdGEgPSB2b2lkPiBleHRlbmRzIEFzeW5jRGF0YVRyZWU8VElucHV0LCBULCBURmlsdGVyRGF0YT4ge1xuXG5cdHByb3RlY3RlZCBkZWNsYXJlIHJlYWRvbmx5IHRyZWU6IENvbXByZXNzaWJsZU9iamVjdFRyZWU8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4sIFRGaWx0ZXJEYXRhPjtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IGNvbXByZXNzaWJsZU5vZGVNYXBwZXI6IENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVOb2RlTWFwcGVyPFRJbnB1dCwgVCwgVEZpbHRlckRhdGE+ID0gbmV3IFdlYWtNYXBwZXIobm9kZSA9PiBuZXcgQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZU5vZGVXcmFwcGVyKG5vZGUpKTtcblx0cHJpdmF0ZSBmaWx0ZXI/OiBJVHJlZUZpbHRlcjxULCBURmlsdGVyRGF0YT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0dXNlcjogc3RyaW5nLFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0dmlydHVhbERlbGVnYXRlOiBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxUPixcblx0XHRwcml2YXRlIGNvbXByZXNzaW9uRGVsZWdhdGU6IElUcmVlQ29tcHJlc3Npb25EZWxlZ2F0ZTxUPixcblx0XHRyZW5kZXJlcnM6IElDb21wcmVzc2libGVUcmVlUmVuZGVyZXI8VCwgVEZpbHRlckRhdGEsIGFueT5bXSxcblx0XHRkYXRhU291cmNlOiBJQXN5bmNEYXRhU291cmNlPFRJbnB1dCwgVD4sXG5cdFx0b3B0aW9uczogSUNvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiA9IHt9XG5cdCkge1xuXHRcdHN1cGVyKHVzZXIsIGNvbnRhaW5lciwgdmlydHVhbERlbGVnYXRlLCByZW5kZXJlcnMsIGRhdGFTb3VyY2UsIG9wdGlvbnMpO1xuXHRcdHRoaXMuZmlsdGVyID0gb3B0aW9ucy5maWx0ZXI7XG5cdH1cblxuXHRnZXRDb21wcmVzc2VkVHJlZU5vZGUoZTogVCB8IFRJbnB1dCkge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLmdldERhdGFOb2RlKGUpO1xuXHRcdHJldHVybiB0aGlzLnRyZWUuZ2V0Q29tcHJlc3NlZFRyZWVOb2RlKG5vZGUpLmVsZW1lbnQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlVHJlZShcblx0XHR1c2VyOiBzdHJpbmcsXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRkZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VD4sXG5cdFx0cmVuZGVyZXJzOiBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyPFQsIFRGaWx0ZXJEYXRhLCBhbnk+W10sXG5cdFx0b3B0aW9uczogSUNvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPlxuXHQpOiBPYmplY3RUcmVlPElBc3luY0RhdGFUcmVlTm9kZTxUSW5wdXQsIFQ+LCBURmlsdGVyRGF0YT4ge1xuXHRcdGNvbnN0IG9iamVjdFRyZWVEZWxlZ2F0ZSA9IG5ldyBDb21wb3NlZFRyZWVEZWxlZ2F0ZTxUSW5wdXQgfCBULCBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPj4oZGVsZWdhdGUpO1xuXHRcdGNvbnN0IG9iamVjdFRyZWVSZW5kZXJlcnMgPSByZW5kZXJlcnMubWFwKHIgPT4gbmV3IENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVSZW5kZXJlcihyLCB0aGlzLm5vZGVNYXBwZXIsICgpID0+IHRoaXMuY29tcHJlc3NpYmxlTm9kZU1hcHBlciwgdGhpcy5fb25EaWRDaGFuZ2VOb2RlU2xvd1N0YXRlLmV2ZW50KSk7XG5cdFx0Y29uc3Qgb2JqZWN0VHJlZU9wdGlvbnMgPSBhc0NvbXByZXNzaWJsZU9iamVjdFRyZWVPcHRpb25zPFRJbnB1dCwgVCwgVEZpbHRlckRhdGE+KG9wdGlvbnMpIHx8IHt9O1xuXG5cdFx0cmV0dXJuIG5ldyBDb21wcmVzc2libGVPYmplY3RUcmVlKHVzZXIsIGNvbnRhaW5lciwgb2JqZWN0VHJlZURlbGVnYXRlLCBvYmplY3RUcmVlUmVuZGVyZXJzLCBvYmplY3RUcmVlT3B0aW9ucyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXNUcmVlRWxlbWVudChub2RlOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgdmlld1N0YXRlQ29udGV4dD86IElBc3luY0RhdGFUcmVlVmlld1N0YXRlQ29udGV4dDxUSW5wdXQsIFQ+KTogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPj4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpbmNvbXByZXNzaWJsZTogdGhpcy5jb21wcmVzc2lvbkRlbGVnYXRlLmlzSW5jb21wcmVzc2libGUobm9kZS5lbGVtZW50IGFzIFQpLFxuXHRcdFx0Li4uc3VwZXIuYXNUcmVlRWxlbWVudChub2RlLCB2aWV3U3RhdGVDb250ZXh0KVxuXHRcdH07XG5cdH1cblxuXHRvdmVycmlkZSBnZXRWaWV3U3RhdGUoKTogSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGUge1xuXHRcdGlmICghdGhpcy5pZGVudGl0eVByb3ZpZGVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHJlZUVycm9yKHRoaXMudXNlciwgJ0NhblxcJ3QgZ2V0IHRyZWUgdmlldyBzdGF0ZSB3aXRob3V0IGFuIGlkZW50aXR5IHByb3ZpZGVyJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ2V0SWQgPSAoZWxlbWVudDogVCkgPT4gdGhpcy5pZGVudGl0eVByb3ZpZGVyIS5nZXRJZChlbGVtZW50KS50b1N0cmluZygpO1xuXHRcdGNvbnN0IGZvY3VzID0gdGhpcy5nZXRGb2N1cygpLm1hcChnZXRJZCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5nZXRTZWxlY3Rpb24oKS5tYXAoZ2V0SWQpO1xuXG5cdFx0Y29uc3QgZXhwYW5kZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgcm9vdCA9IHRoaXMudHJlZS5nZXRDb21wcmVzc2VkVHJlZU5vZGUoKTtcblx0XHRjb25zdCBzdGFjayA9IFtyb290XTtcblxuXHRcdHdoaWxlIChzdGFjay5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBub2RlID0gc3RhY2sucG9wKCkhO1xuXG5cdFx0XHRpZiAobm9kZSAhPT0gcm9vdCAmJiBub2RlLmNvbGxhcHNpYmxlICYmICFub2RlLmNvbGxhcHNlZCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGFzeW5jTm9kZSBvZiBub2RlLmVsZW1lbnQhLmVsZW1lbnRzKSB7XG5cdFx0XHRcdFx0ZXhwYW5kZWQucHVzaChnZXRJZChhc3luY05vZGUuZWxlbWVudCBhcyBUKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0c3RhY2sucHVzaCguLi5ub2RlLmNoaWxkcmVuKTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBmb2N1cywgc2VsZWN0aW9uLCBleHBhbmRlZCwgc2Nyb2xsVG9wOiB0aGlzLnNjcm9sbFRvcCB9O1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlcihub2RlOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPiwgdmlld1N0YXRlQ29udGV4dD86IElBc3luY0RhdGFUcmVlVmlld1N0YXRlQ29udGV4dDxUSW5wdXQsIFQ+LCBvcHRpb25zPzogSUFzeW5jRGF0YVRyZWVVcGRhdGVDaGlsZHJlbk9wdGlvbnM8VD4pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaWRlbnRpdHlQcm92aWRlcikge1xuXHRcdFx0cmV0dXJuIHN1cGVyLnJlbmRlcihub2RlLCB2aWV3U3RhdGVDb250ZXh0KTtcblx0XHR9XG5cblx0XHQvLyBQcmVzZXJ2ZSB0cmFpdHMgYWNyb3NzIGNvbXByZXNzaW9ucy4gSGFja3kgYnV0IGRvZXMgdGhlIHRyaWNrLlxuXHRcdC8vIFRoaXMgaXMgaGFyZCB0byBmaXggcHJvcGVybHkgc2luY2UgaXQgcmVxdWlyZXMgcmV3cml0aW5nIHRoZSB0cmFpdHNcblx0XHQvLyBhY3Jvc3MgdHJlZXMgYW5kIGxpc3RzLiBMZXQncyBqdXN0IGtlZXAgaXQgdGhpcyB3YXkgZm9yIG5vdy5cblx0XHRjb25zdCBnZXRJZCA9IChlbGVtZW50OiBUKSA9PiB0aGlzLmlkZW50aXR5UHJvdmlkZXIhLmdldElkKGVsZW1lbnQpLnRvU3RyaW5nKCk7XG5cdFx0Y29uc3QgZ2V0VW5jb21wcmVzc2VkSWRzID0gKG5vZGVzOiBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPltdKTogU2V0PHN0cmluZz4gPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuXHRcdFx0XHRjb25zdCBjb21wcmVzc2VkTm9kZSA9IHRoaXMudHJlZS5nZXRDb21wcmVzc2VkVHJlZU5vZGUobm9kZSA9PT0gdGhpcy5yb290ID8gbnVsbCA6IG5vZGUpO1xuXG5cdFx0XHRcdGlmICghY29tcHJlc3NlZE5vZGUuZWxlbWVudCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yIChjb25zdCBub2RlIG9mIGNvbXByZXNzZWROb2RlLmVsZW1lbnQuZWxlbWVudHMpIHtcblx0XHRcdFx0XHRyZXN1bHQuYWRkKGdldElkKG5vZGUuZWxlbWVudCBhcyBUKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9O1xuXG5cdFx0Y29uc3Qgb2xkU2VsZWN0aW9uID0gZ2V0VW5jb21wcmVzc2VkSWRzKHRoaXMudHJlZS5nZXRTZWxlY3Rpb24oKSBhcyBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPltdKTtcblx0XHRjb25zdCBvbGRGb2N1cyA9IGdldFVuY29tcHJlc3NlZElkcyh0aGlzLnRyZWUuZ2V0Rm9jdXMoKSBhcyBJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPltdKTtcblxuXHRcdHN1cGVyLnJlbmRlcihub2RlLCB2aWV3U3RhdGVDb250ZXh0LCBvcHRpb25zKTtcblxuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0bGV0IGRpZENoYW5nZVNlbGVjdGlvbiA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmdldEZvY3VzKCk7XG5cdFx0bGV0IGRpZENoYW5nZUZvY3VzID0gZmFsc2U7XG5cblx0XHRjb25zdCB2aXNpdCA9IChub2RlOiBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxJQXN5bmNEYXRhVHJlZU5vZGU8VElucHV0LCBUPj4gfCBudWxsLCBURmlsdGVyRGF0YT4pID0+IHtcblx0XHRcdGNvbnN0IGNvbXByZXNzZWROb2RlID0gbm9kZS5lbGVtZW50O1xuXG5cdFx0XHRpZiAoY29tcHJlc3NlZE5vZGUpIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb21wcmVzc2VkTm9kZS5lbGVtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGlkID0gZ2V0SWQoY29tcHJlc3NlZE5vZGUuZWxlbWVudHNbaV0uZWxlbWVudCBhcyBUKTtcblx0XHRcdFx0XHRjb25zdCBlbGVtZW50ID0gY29tcHJlc3NlZE5vZGUuZWxlbWVudHNbY29tcHJlc3NlZE5vZGUuZWxlbWVudHMubGVuZ3RoIC0gMV0uZWxlbWVudCBhcyBUO1xuXG5cdFx0XHRcdFx0Ly8gZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy84NTkzOFxuXHRcdFx0XHRcdGlmIChvbGRTZWxlY3Rpb24uaGFzKGlkKSAmJiBzZWxlY3Rpb24uaW5kZXhPZihlbGVtZW50KSA9PT0gLTEpIHtcblx0XHRcdFx0XHRcdHNlbGVjdGlvbi5wdXNoKGVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0ZGlkQ2hhbmdlU2VsZWN0aW9uID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAob2xkRm9jdXMuaGFzKGlkKSAmJiBmb2N1cy5pbmRleE9mKGVsZW1lbnQpID09PSAtMSkge1xuXHRcdFx0XHRcdFx0Zm9jdXMucHVzaChlbGVtZW50KTtcblx0XHRcdFx0XHRcdGRpZENoYW5nZUZvY3VzID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0bm9kZS5jaGlsZHJlbi5mb3JFYWNoKHZpc2l0KTtcblx0XHR9O1xuXG5cdFx0dmlzaXQodGhpcy50cmVlLmdldENvbXByZXNzZWRUcmVlTm9kZShub2RlID09PSB0aGlzLnJvb3QgPyBudWxsIDogbm9kZSkpO1xuXG5cdFx0aWYgKGRpZENoYW5nZVNlbGVjdGlvbikge1xuXHRcdFx0dGhpcy5zZXRTZWxlY3Rpb24oc2VsZWN0aW9uKTtcblx0XHR9XG5cblx0XHRpZiAoZGlkQ2hhbmdlRm9jdXMpIHtcblx0XHRcdHRoaXMuc2V0Rm9jdXMoZm9jdXMpO1xuXHRcdH1cblx0fVxuXG5cdC8vIEZvciBjb21wcmVzc2VkIGFzeW5jIGRhdGEgdHJlZXMsIGBUcmVlVmlzaWJpbGl0eS5SZWN1cnNlYCBkb2Vzbid0IGN1cnJlbnRseSB3b3JrXG5cdC8vIGFuZCB3ZSBoYXZlIHRvIGZpbHRlciBldmVyeXRoaW5nIGJlZm9yZWhhbmRcblx0Ly8gUmVsYXRlZCB0byAjODUxOTMgYW5kICM4NTgzNVxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcHJvY2Vzc0NoaWxkcmVuKGNoaWxkcmVuOiBJdGVyYWJsZTxUPik6IEl0ZXJhYmxlPFQ+IHtcblx0XHRpZiAodGhpcy5maWx0ZXIpIHtcblx0XHRcdGNoaWxkcmVuID0gSXRlcmFibGUuZmlsdGVyKGNoaWxkcmVuLCBlID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5maWx0ZXIhLmZpbHRlcihlLCBUcmVlVmlzaWJpbGl0eS5WaXNpYmxlKTtcblx0XHRcdFx0Y29uc3QgdmlzaWJpbGl0eSA9IGdldFZpc2liaWxpdHkocmVzdWx0KTtcblxuXHRcdFx0XHRpZiAodmlzaWJpbGl0eSA9PT0gVHJlZVZpc2liaWxpdHkuUmVjdXJzZSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignUmVjdXJzaXZlIHRyZWUgdmlzaWJpbGl0eSBub3Qgc3VwcG9ydGVkIGluIGFzeW5jIGRhdGEgY29tcHJlc3NlZCB0cmVlcycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHZpc2liaWxpdHkgPT09IFRyZWVWaXNpYmlsaXR5LlZpc2libGU7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VwZXIucHJvY2Vzc0NoaWxkcmVuKGNoaWxkcmVuKTtcblx0fVxuXG5cdG92ZXJyaWRlIG5hdmlnYXRlKHN0YXJ0PzogVCk6IEFzeW5jRGF0YVRyZWVOYXZpZ2F0b3I8VElucHV0LCBUPiB7XG5cdFx0Ly8gQXNzdW1wdGlvbnMgYXJlIG1hZGUgYWJvdXQgaG93IHRyZWUgbmF2aWdhdGlvbiB3b3JrcyBpbiBjb21wcmVzc2VkIHRyZWVzXG5cdFx0Ly8gVGhlc2UgYXNzdW1wdGlvbnMgbWF5IGJlIHdyb25nIGFuZCB3ZSBzaG91bGQgcmV2aXNpdCB0aGlzIHdoZW4gbmVlZGVkXG5cblx0XHQvLyBFeGFtcGxlOlx0W2EsIGIvYmEsIGJhLnR4dF1cblx0XHQvLyAtIHByZXZpb3VzKGJhKSA9PiBhXG5cdFx0Ly8gLSBwcmV2aW91cyhiKSA9PiBhXG5cdFx0Ly8gLSBuZXh0KGEpID0+IGJhXG5cdFx0Ly8gLSBuZXh0KGIpID0+IGJhXG5cdFx0Ly8gLSBuZXh0KGJhKSA9PiBiYS50eHRcblx0XHRyZXR1cm4gc3VwZXIubmF2aWdhdGUoc3RhcnQpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldFZpc2liaWxpdHk8VEZpbHRlckRhdGE+KGZpbHRlclJlc3VsdDogVHJlZUZpbHRlclJlc3VsdDxURmlsdGVyRGF0YT4pOiBUcmVlVmlzaWJpbGl0eSB7XG5cdGlmICh0eXBlb2YgZmlsdGVyUmVzdWx0ID09PSAnYm9vbGVhbicpIHtcblx0XHRyZXR1cm4gZmlsdGVyUmVzdWx0ID8gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSA6IFRyZWVWaXNpYmlsaXR5LkhpZGRlbjtcblx0fSBlbHNlIGlmIChpc0ZpbHRlclJlc3VsdChmaWx0ZXJSZXN1bHQpKSB7XG5cdFx0cmV0dXJuIGdldFZpc2libGVTdGF0ZShmaWx0ZXJSZXN1bHQudmlzaWJpbGl0eSk7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGdldFZpc2libGVTdGF0ZShmaWx0ZXJSZXN1bHQpO1xuXHR9XG59XG5cbmNsYXNzIEFzeW5jRGF0YVRyZWVOYXZpZ2F0b3I8VElucHV0LCBUPiBpbXBsZW1lbnRzIElUcmVlTmF2aWdhdG9yPFQ+IHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIG5hdmlnYXRvcjogSVRyZWVOYXZpZ2F0b3I8SUFzeW5jRGF0YVRyZWVOb2RlPFRJbnB1dCwgVD4gfCBudWxsPikgeyB9XG5cblx0Y3VycmVudCgpOiBUIHwgbnVsbCB7XG5cdFx0Y29uc3QgY3VycmVudCA9IHRoaXMubmF2aWdhdG9yLmN1cnJlbnQoKTtcblx0XHRpZiAoY3VycmVudCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGN1cnJlbnQuZWxlbWVudCBhcyBUO1xuXHR9XG5cblx0cHJldmlvdXMoKTogVCB8IG51bGwge1xuXHRcdHRoaXMubmF2aWdhdG9yLnByZXZpb3VzKCk7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudCgpO1xuXHR9XG5cblx0Zmlyc3QoKTogVCB8IG51bGwge1xuXHRcdHRoaXMubmF2aWdhdG9yLmZpcnN0KCk7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudCgpO1xuXHR9XG5cblx0bGFzdCgpOiBUIHwgbnVsbCB7XG5cdFx0dGhpcy5uYXZpZ2F0b3IubGFzdCgpO1xuXHRcdHJldHVybiB0aGlzLmN1cnJlbnQoKTtcblx0fVxuXG5cdG5leHQoKTogVCB8IG51bGwge1xuXHRcdHRoaXMubmF2aWdhdG9yLm5leHQoKTtcblx0XHRyZXR1cm4gdGhpcy5jdXJyZW50KCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU9BLFNBQVMsK0JBQXFEO0FBRTlELFNBQVMsc0JBQXNCLGNBQXNJLFlBQVksc0JBQTBFO0FBRTNQLFNBQVMsaUJBQWlCLHNCQUFzQjtBQUNoRCxTQUFTLHdCQUFvTCxrQkFBa0I7QUFDL00sU0FBb04sZ0NBQWdDLFdBQTZCLGdCQUFnQixrQkFBa0I7QUFDblQsU0FBNEIseUJBQXlCLFVBQVUsa0JBQWtCLGVBQWU7QUFDaEcsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMscUJBQXFCLHlCQUF5QjtBQUN2RCxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGdCQUFn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
