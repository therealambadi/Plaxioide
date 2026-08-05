import { localize } from "../../../nls.js";
import { basename } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { NoTreeViewError } from "../../common/views.js";
import { asPromise } from "../../../base/common/async.js";
import * as extHostTypes from "./extHostTypes.js";
import { isUndefinedOrNull, isString } from "../../../base/common/types.js";
import { equals, coalesce } from "../../../base/common/arrays.js";
import { MarkdownString, ViewBadge, DataTransfer } from "./extHostTypeConverters.js";
import { isMarkdownString } from "../../../base/common/htmlContent.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { TreeViewsDnDService } from "../../../editor/common/services/treeViewsDnd.js";
import { checkProposedApiEnabled } from "../../services/extensions/common/extensions.js";
function toTreeItemLabel(label, extension) {
  if (isString(label)) {
    return { label };
  }
  if (label && typeof label === "object" && typeof label.label === "string") {
    let highlights = void 0;
    if (Array.isArray(label.highlights)) {
      highlights = label.highlights.filter((highlight) => highlight.length === 2 && typeof highlight[0] === "number" && typeof highlight[1] === "number");
      highlights = highlights.length ? highlights : void 0;
    }
    return { label: label.label, highlights };
  }
  return void 0;
}
class ExtHostTreeViews extends Disposable {
  constructor(_proxy, commands, logService) {
    super();
    this._proxy = _proxy;
    this.commands = commands;
    this.logService = logService;
    this.treeViews = /* @__PURE__ */ new Map();
    this.treeDragAndDropService = new TreeViewsDnDService();
    function isTreeViewConvertableItem(arg) {
      return arg && arg.$treeViewId && (arg.$treeItemHandle || arg.$selectedTreeItems || arg.$focusedTreeItem);
    }
    commands.registerArgumentProcessor({
      processArgument: (arg) => {
        if (isTreeViewConvertableItem(arg)) {
          return this.convertArgument(arg);
        } else if (Array.isArray(arg) && arg.length > 0) {
          return arg.map((item) => {
            if (isTreeViewConvertableItem(item)) {
              return this.convertArgument(item);
            }
            return item;
          });
        }
        return arg;
      }
    });
  }
  registerTreeDataProvider(id, treeDataProvider, extension) {
    const treeView = this.createTreeView(id, { treeDataProvider }, extension);
    return { dispose: () => treeView.dispose() };
  }
  createTreeView(viewId, options, extension) {
    if (!options || !options.treeDataProvider) {
      throw new Error("Options with treeDataProvider is mandatory");
    }
    const dropMimeTypes = options.dragAndDropController?.dropMimeTypes ?? [];
    const dragMimeTypes = options.dragAndDropController?.dragMimeTypes ?? [];
    const hasHandleDrag = !!options.dragAndDropController?.handleDrag;
    const hasHandleDrop = !!options.dragAndDropController?.handleDrop;
    const treeView = this.createExtHostTreeView(viewId, options, extension);
    const proxyOptions = { showCollapseAll: !!options.showCollapseAll, canSelectMany: !!options.canSelectMany, dropMimeTypes, dragMimeTypes, hasHandleDrag, hasHandleDrop, manuallyManageCheckboxes: !!options.manageCheckboxStateManually };
    const registerPromise = this._proxy.$registerTreeViewDataProvider(viewId, proxyOptions);
    const view = {
      get onDidCollapseElement() {
        return treeView.onDidCollapseElement;
      },
      get onDidExpandElement() {
        return treeView.onDidExpandElement;
      },
      get selection() {
        return treeView.selectedElements;
      },
      get onDidChangeSelection() {
        return treeView.onDidChangeSelection;
      },
      get activeItem() {
        checkProposedApiEnabled(extension, "treeViewActiveItem");
        return treeView.focusedElement;
      },
      get onDidChangeActiveItem() {
        checkProposedApiEnabled(extension, "treeViewActiveItem");
        return treeView.onDidChangeActiveItem;
      },
      get visible() {
        return treeView.visible;
      },
      get onDidChangeVisibility() {
        return treeView.onDidChangeVisibility;
      },
      get onDidChangeCheckboxState() {
        return treeView.onDidChangeCheckboxState;
      },
      get message() {
        return treeView.message;
      },
      set message(message) {
        if (isMarkdownString(message)) {
          checkProposedApiEnabled(extension, "treeViewMarkdownMessage");
        }
        treeView.message = message;
      },
      get title() {
        return treeView.title;
      },
      set title(title) {
        treeView.title = title;
      },
      get description() {
        return treeView.description;
      },
      set description(description) {
        treeView.description = description;
      },
      get badge() {
        return treeView.badge;
      },
      set badge(badge) {
        if (badge !== void 0 && extHostTypes.ViewBadge.isViewBadge(badge)) {
          treeView.badge = {
            value: Math.floor(Math.abs(badge.value)),
            tooltip: badge.tooltip
          };
        } else if (badge === void 0) {
          treeView.badge = void 0;
        }
      },
      reveal: (element, options2) => {
        return treeView.reveal(element, options2);
      },
      dispose: async () => {
        await registerPromise;
        this.treeViews.delete(viewId);
        treeView.dispose();
      }
    };
    this._register(view);
    return view;
  }
  async $getChildren(treeViewId, treeItemHandles) {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      return Promise.reject(new NoTreeViewError(treeViewId));
    }
    if (!treeItemHandles) {
      const children = await treeView.getChildren();
      return children ? [[0, ...children]] : void 0;
    }
    const result = [];
    for (let i = 0; i < treeItemHandles.length; i++) {
      const treeItemHandle = treeItemHandles[i];
      const children = await treeView.getChildren(treeItemHandle);
      if (children) {
        result.push([i, ...children]);
      }
    }
    return result;
  }
  async $handleDrop(destinationViewId, requestId, treeDataTransferDTO, targetItemHandle, token, operationUuid, sourceViewId, sourceTreeItemHandles) {
    const treeView = this.treeViews.get(destinationViewId);
    if (!treeView) {
      return Promise.reject(new NoTreeViewError(destinationViewId));
    }
    const treeDataTransfer = DataTransfer.toDataTransfer(treeDataTransferDTO, async (dataItemIndex) => {
      return (await this._proxy.$resolveDropFileData(destinationViewId, requestId, dataItemIndex)).buffer;
    });
    if (sourceViewId === destinationViewId && sourceTreeItemHandles) {
      await this.addAdditionalTransferItems(treeDataTransfer, treeView, sourceTreeItemHandles, token, operationUuid);
    }
    return treeView.onDrop(treeDataTransfer, targetItemHandle, token);
  }
  async addAdditionalTransferItems(treeDataTransfer, treeView, sourceTreeItemHandles, token, operationUuid) {
    const existingTransferOperation = this.treeDragAndDropService.removeDragOperationTransfer(operationUuid);
    if (existingTransferOperation) {
      (await existingTransferOperation)?.forEach((value, key) => {
        if (value) {
          treeDataTransfer.set(key, value);
        }
      });
    } else if (operationUuid && treeView.handleDrag) {
      const willDropPromise = treeView.handleDrag(sourceTreeItemHandles, treeDataTransfer, token);
      this.treeDragAndDropService.addDragOperationTransfer(operationUuid, willDropPromise);
      await willDropPromise;
    }
    return treeDataTransfer;
  }
  async $handleDrag(sourceViewId, sourceTreeItemHandles, operationUuid, token) {
    const treeView = this.treeViews.get(sourceViewId);
    if (!treeView) {
      return Promise.reject(new NoTreeViewError(sourceViewId));
    }
    const treeDataTransfer = await this.addAdditionalTransferItems(new extHostTypes.DataTransfer(), treeView, sourceTreeItemHandles, token, operationUuid);
    if (!treeDataTransfer || token.isCancellationRequested) {
      return;
    }
    return DataTransfer.from(treeDataTransfer);
  }
  async $hasResolve(treeViewId) {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new NoTreeViewError(treeViewId);
    }
    return treeView.hasResolve;
  }
  $resolve(treeViewId, treeItemHandle, token) {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new NoTreeViewError(treeViewId);
    }
    return treeView.resolveTreeItem(treeItemHandle, token);
  }
  $setExpanded(treeViewId, treeItemHandle, expanded) {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new NoTreeViewError(treeViewId);
    }
    treeView.setExpanded(treeItemHandle, expanded);
  }
  $setSelectionAndFocus(treeViewId, selectedHandles, focusedHandle) {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new NoTreeViewError(treeViewId);
    }
    treeView.setSelectionAndFocus(selectedHandles, focusedHandle);
  }
  $setVisible(treeViewId, isVisible) {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      if (!isVisible) {
        return;
      }
      throw new NoTreeViewError(treeViewId);
    }
    treeView.setVisible(isVisible);
  }
  $changeCheckboxState(treeViewId, checkboxUpdate) {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new NoTreeViewError(treeViewId);
    }
    treeView.setCheckboxState(checkboxUpdate);
  }
  createExtHostTreeView(id, options, extension) {
    const treeView = this._register(new ExtHostTreeView(id, options, this._proxy, this.commands.converter, this.logService, extension));
    this.treeViews.set(id, treeView);
    return treeView;
  }
  convertArgument(arg) {
    const treeView = this.treeViews.get(arg.$treeViewId);
    if (treeView && "$treeItemHandle" in arg) {
      return treeView.getExtensionElement(arg.$treeItemHandle);
    }
    if (treeView && "$focusedTreeItem" in arg && arg.$focusedTreeItem) {
      return treeView.focusedElement;
    }
    return null;
  }
}
const _ExtHostTreeView = class _ExtHostTreeView extends Disposable {
  constructor(viewId, options, proxy, commands, logService, extension) {
    super();
    this.viewId = viewId;
    this.proxy = proxy;
    this.commands = commands;
    this.logService = logService;
    this.extension = extension;
    this.roots = void 0;
    this.elements = /* @__PURE__ */ new Map();
    this.nodes = /* @__PURE__ */ new Map();
    this._visible = false;
    this._selectedHandles = [];
    this._focusedHandle = void 0;
    this._onDidExpandElement = this._register(new Emitter());
    this.onDidExpandElement = this._onDidExpandElement.event;
    this._onDidCollapseElement = this._register(new Emitter());
    this.onDidCollapseElement = this._onDidCollapseElement.event;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._onDidChangeActiveItem = this._register(new Emitter());
    this.onDidChangeActiveItem = this._onDidChangeActiveItem.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onDidChangeCheckboxState = this._register(new Emitter());
    this.onDidChangeCheckboxState = this._onDidChangeCheckboxState.event;
    this._onDidChangeData = this._register(new Emitter());
    this.refreshPromise = Promise.resolve();
    this.refreshQueue = Promise.resolve();
    this._message = "";
    this._title = "";
    this._refreshCancellationSource = new CancellationTokenSource();
    if (extension.contributes && extension.contributes.views) {
      for (const location in extension.contributes.views) {
        for (const view of extension.contributes.views[location]) {
          if (view.id === viewId) {
            this._title = view.name;
          }
        }
      }
    }
    this.dataProvider = options.treeDataProvider;
    this.dndController = options.dragAndDropController;
    if (this.dataProvider.onDidChangeTreeData) {
      this._register(this.dataProvider.onDidChangeTreeData((elementOrElements) => {
        if (Array.isArray(elementOrElements) && elementOrElements.length === 0) {
          return;
        }
        this._onDidChangeData.fire({ message: false, element: elementOrElements });
      }));
    }
    let refreshingPromise;
    let promiseCallback;
    const onDidChangeData = Event.debounce(this._onDidChangeData.event, (result, current) => {
      if (!result) {
        result = { message: false, elements: [] };
      }
      if (current.element !== false) {
        if (!refreshingPromise) {
          refreshingPromise = new Promise((c) => promiseCallback = c);
          this.refreshPromise = this.refreshPromise.then(() => refreshingPromise);
        }
        if (Array.isArray(current.element)) {
          result.elements.push(...current.element);
        } else {
          result.elements.push(current.element);
        }
      }
      if (current.message) {
        result.message = true;
      }
      return result;
    }, 200, true);
    this._register(onDidChangeData(({ message, elements }) => {
      if (elements.length) {
        this.refreshQueue = this.refreshQueue.then(() => {
          const _promiseCallback = promiseCallback;
          refreshingPromise = null;
          return this.refresh(elements).then(() => _promiseCallback());
        });
      }
      if (message) {
        this.proxy.$setMessage(this.viewId, MarkdownString.fromStrict(this._message) ?? "");
      }
    }));
  }
  get visible() {
    return this._visible;
  }
  get selectedElements() {
    return this._selectedHandles.map((handle) => this.getExtensionElement(handle)).filter((element) => !isUndefinedOrNull(element));
  }
  get focusedElement() {
    return this._focusedHandle ? this.getExtensionElement(this._focusedHandle) : void 0;
  }
  async getChildren(parentHandle) {
    const parentElement = parentHandle ? this.getExtensionElement(parentHandle) : void 0;
    if (parentHandle && !parentElement) {
      this.logService.error(`No tree item with id '${parentHandle}' found.`);
      return Promise.resolve([]);
    }
    let childrenNodes = this.getChildrenNodes(parentHandle);
    if (!childrenNodes) {
      childrenNodes = await this.fetchChildrenNodes(parentElement);
    }
    return childrenNodes ? childrenNodes.map((n) => n.item) : void 0;
  }
  getExtensionElement(treeItemHandle) {
    return this.elements.get(treeItemHandle);
  }
  reveal(element, options) {
    options = options ? options : { select: true, focus: false };
    const select = isUndefinedOrNull(options.select) ? true : options.select;
    const focus = isUndefinedOrNull(options.focus) ? false : options.focus;
    const expand = isUndefinedOrNull(options.expand) ? false : options.expand;
    if (typeof this.dataProvider.getParent !== "function") {
      return Promise.reject(new Error(`Required registered TreeDataProvider to implement 'getParent' method to access 'reveal' method`));
    }
    if (element) {
      return this.refreshPromise.then(() => this.resolveUnknownParentChain(element)).then((parentChain) => this.resolveTreeNode(element, parentChain[parentChain.length - 1]).then((treeNode) => this.proxy.$reveal(this.viewId, { item: treeNode.item, parentChain: parentChain.map((p) => p.item) }, { select, focus, expand })), (error) => this.logService.error(error));
    } else {
      return this.proxy.$reveal(this.viewId, void 0, { select, focus, expand });
    }
  }
  get message() {
    return this._message;
  }
  set message(message) {
    this._message = message;
    this._onDidChangeData.fire({ message: true, element: false });
  }
  get title() {
    return this._title;
  }
  set title(title) {
    this._title = title;
    this.proxy.$setTitle(this.viewId, title, this._description);
  }
  get description() {
    return this._description;
  }
  set description(description) {
    this._description = description;
    this.proxy.$setTitle(this.viewId, this._title, description);
  }
  get badge() {
    return this._badge;
  }
  set badge(badge) {
    if (this._badge?.value === badge?.value && this._badge?.tooltip === badge?.tooltip) {
      return;
    }
    this._badge = ViewBadge.from(badge);
    this.proxy.$setBadge(this.viewId, badge);
  }
  setExpanded(treeItemHandle, expanded) {
    const element = this.getExtensionElement(treeItemHandle);
    if (element) {
      if (expanded) {
        this._onDidExpandElement.fire(Object.freeze({ element }));
      } else {
        this._onDidCollapseElement.fire(Object.freeze({ element }));
      }
    }
  }
  setSelectionAndFocus(selectedHandles, focusedHandle) {
    const changedSelection = !equals(this._selectedHandles, selectedHandles);
    this._selectedHandles = selectedHandles;
    const changedFocus = this._focusedHandle !== focusedHandle;
    this._focusedHandle = focusedHandle;
    if (changedSelection) {
      this._onDidChangeSelection.fire(Object.freeze({ selection: this.selectedElements }));
    }
    if (changedFocus) {
      this._onDidChangeActiveItem.fire(Object.freeze({ activeItem: this.focusedElement }));
    }
  }
  setVisible(visible) {
    if (visible !== this._visible) {
      this._visible = visible;
      this._onDidChangeVisibility.fire(Object.freeze({ visible: this._visible }));
    }
  }
  async setCheckboxState(checkboxUpdates) {
    const items = (await Promise.all(checkboxUpdates.map(async (checkboxUpdate) => {
      const extensionItem = this.getExtensionElement(checkboxUpdate.treeItemHandle);
      if (extensionItem) {
        return {
          extensionItem,
          treeItem: await this.dataProvider.getTreeItem(extensionItem),
          newState: checkboxUpdate.newState ? extHostTypes.TreeItemCheckboxState.Checked : extHostTypes.TreeItemCheckboxState.Unchecked
        };
      }
      return Promise.resolve(void 0);
    }))).filter((item) => item !== void 0);
    items.forEach((item) => {
      item.treeItem.checkboxState = item.newState ? extHostTypes.TreeItemCheckboxState.Checked : extHostTypes.TreeItemCheckboxState.Unchecked;
    });
    this._onDidChangeCheckboxState.fire({ items: items.map((item) => [item.extensionItem, item.newState]) });
  }
  async handleDrag(sourceTreeItemHandles, treeDataTransfer, token) {
    const extensionTreeItems = [];
    for (const sourceHandle of sourceTreeItemHandles) {
      const extensionItem = this.getExtensionElement(sourceHandle);
      if (extensionItem) {
        extensionTreeItems.push(extensionItem);
      }
    }
    if (!this.dndController?.handleDrag || extensionTreeItems.length === 0) {
      return;
    }
    await this.dndController.handleDrag(extensionTreeItems, treeDataTransfer, token);
    return treeDataTransfer;
  }
  get hasHandleDrag() {
    return !!this.dndController?.handleDrag;
  }
  async onDrop(treeDataTransfer, targetHandleOrNode, token) {
    const target = targetHandleOrNode ? this.getExtensionElement(targetHandleOrNode) : void 0;
    if (!target && targetHandleOrNode || !this.dndController?.handleDrop) {
      return;
    }
    return asPromise(() => this.dndController?.handleDrop ? this.dndController.handleDrop(target, treeDataTransfer, token) : void 0);
  }
  get hasResolve() {
    return !!this.dataProvider.resolveTreeItem;
  }
  async resolveTreeItem(treeItemHandle, token) {
    if (!this.dataProvider.resolveTreeItem) {
      return;
    }
    const element = this.elements.get(treeItemHandle);
    if (element) {
      const node = this.nodes.get(element);
      if (node) {
        const resolve = await this.dataProvider.resolveTreeItem(node.extensionItem, element, token) ?? node.extensionItem;
        this.validateTreeItem(resolve);
        node.item.tooltip = this.getTooltip(resolve.tooltip);
        node.item.command = this.getCommand(node.disposableStore, resolve.command);
        return node.item;
      }
    }
    return;
  }
  resolveUnknownParentChain(element) {
    return this.resolveParent(element).then((parent) => {
      if (!parent) {
        return Promise.resolve([]);
      }
      return this.resolveUnknownParentChain(parent).then((result) => this.resolveTreeNode(parent, result[result.length - 1]).then((parentNode) => {
        result.push(parentNode);
        return result;
      }));
    });
  }
  resolveParent(element) {
    const node = this.nodes.get(element);
    if (node) {
      return Promise.resolve(node.parent ? this.elements.get(node.parent.item.handle) : void 0);
    }
    return asPromise(() => this.dataProvider.getParent(element));
  }
  resolveTreeNode(element, parent) {
    const node = this.nodes.get(element);
    if (node) {
      return Promise.resolve(node);
    }
    return asPromise(() => this.dataProvider.getTreeItem(element)).then((extTreeItem) => this.createHandle(element, extTreeItem, parent, true)).then((handle) => this.getChildren(parent ? parent.item.handle : void 0).then(() => {
      const cachedElement = this.getExtensionElement(handle);
      if (cachedElement) {
        const node2 = this.nodes.get(cachedElement);
        if (node2) {
          return Promise.resolve(node2);
        }
      }
      throw new Error(`Cannot resolve tree item for element ${handle} from extension ${this.extension.identifier.value}`);
    }));
  }
  getChildrenNodes(parentNodeOrHandle) {
    if (parentNodeOrHandle) {
      let parentNode;
      if (typeof parentNodeOrHandle === "string") {
        const parentElement = this.getExtensionElement(parentNodeOrHandle);
        parentNode = parentElement ? this.nodes.get(parentElement) : void 0;
      } else {
        parentNode = parentNodeOrHandle;
      }
      return parentNode ? parentNode.children || void 0 : void 0;
    }
    return this.roots;
  }
  async fetchChildrenNodes(parentElement) {
    this.clearChildren(parentElement);
    const cts = new CancellationTokenSource(this._refreshCancellationSource.token);
    try {
      const parentNode = parentElement ? this.nodes.get(parentElement) : void 0;
      const elements = await this.dataProvider.getChildren(parentElement);
      if (cts.token.isCancellationRequested) {
        return void 0;
      }
      const coalescedElements = coalesce(elements || []);
      const treeItems = await Promise.all(coalesce(coalescedElements).map((element) => {
        return this.dataProvider.getTreeItem(element);
      }));
      if (cts.token.isCancellationRequested) {
        return void 0;
      }
      const items = treeItems.map((item, index) => item ? this.createAndRegisterTreeNode(coalescedElements[index], item, parentNode) : null);
      return coalesce(items);
    } finally {
      cts.dispose();
    }
  }
  refresh(elements) {
    const hasRoot = elements.some((element) => !element);
    if (hasRoot) {
      this._refreshCancellationSource.dispose(true);
      this._refreshCancellationSource = new CancellationTokenSource();
      this.clearAll();
      return this.proxy.$refresh(this.viewId);
    } else {
      const handlesToRefresh = this.getHandlesToRefresh(elements);
      if (handlesToRefresh.length) {
        return this.refreshHandles(handlesToRefresh);
      }
    }
    return Promise.resolve(void 0);
  }
  getHandlesToRefresh(elements) {
    const elementsToUpdate = /* @__PURE__ */ new Set();
    const elementNodes = elements.map((element) => this.nodes.get(element));
    for (const elementNode of elementNodes) {
      if (elementNode && !elementsToUpdate.has(elementNode.item.handle)) {
        let currentNode = elementNode;
        while (currentNode && currentNode.parent && elementNodes.findIndex((node) => currentNode && currentNode.parent && node && node.item.handle === currentNode.parent.item.handle) === -1) {
          const parentElement = this.elements.get(currentNode.parent.item.handle);
          currentNode = parentElement ? this.nodes.get(parentElement) : void 0;
        }
        if (currentNode && !currentNode.parent) {
          elementsToUpdate.add(elementNode.item.handle);
        }
      }
    }
    const handlesToUpdate = [];
    elementsToUpdate.forEach((handle) => {
      const element = this.elements.get(handle);
      if (element) {
        const node = this.nodes.get(element);
        if (node && (!node.parent || !elementsToUpdate.has(node.parent.item.handle))) {
          handlesToUpdate.push(handle);
        }
      }
    });
    return handlesToUpdate;
  }
  refreshHandles(itemHandles) {
    const itemsToRefresh = {};
    return Promise.all(itemHandles.map((treeItemHandle) => this.refreshNode(treeItemHandle).then((node) => {
      if (node) {
        itemsToRefresh[treeItemHandle] = node.item;
      }
    }))).then(() => Object.keys(itemsToRefresh).length ? this.proxy.$refresh(this.viewId, itemsToRefresh) : void 0);
  }
  refreshNode(treeItemHandle) {
    const extElement = this.getExtensionElement(treeItemHandle);
    if (extElement) {
      const existing = this.nodes.get(extElement);
      if (existing) {
        this.clearChildren(extElement);
        return asPromise(() => this.dataProvider.getTreeItem(extElement)).then((extTreeItem) => {
          if (extTreeItem) {
            const newNode = this.createTreeNode(extElement, extTreeItem, existing.parent);
            this.updateNodeCache(extElement, newNode, existing, existing.parent);
            existing.dispose();
            return newNode;
          }
          return null;
        });
      }
    }
    return Promise.resolve(null);
  }
  createAndRegisterTreeNode(element, extTreeItem, parentNode) {
    const node = this.createTreeNode(element, extTreeItem, parentNode);
    if (extTreeItem.id && this.elements.has(node.item.handle)) {
      throw new Error(localize("treeView.duplicateElement", "Element with id {0} is already registered", extTreeItem.id));
    }
    this.addNodeToCache(element, node);
    this.addNodeToParentCache(node, parentNode);
    return node;
  }
  getTooltip(tooltip) {
    if (extHostTypes.MarkdownString.isMarkdownString(tooltip)) {
      return MarkdownString.from(tooltip);
    }
    return tooltip;
  }
  getCommand(disposable, command) {
    return command ? { ...this.commands.toInternal(command, disposable), originalId: command.command } : void 0;
  }
  getCheckbox(extensionTreeItem) {
    if (extensionTreeItem.checkboxState === void 0) {
      return void 0;
    }
    let checkboxState;
    let tooltip = void 0;
    let accessibilityInformation = void 0;
    if (typeof extensionTreeItem.checkboxState === "number") {
      checkboxState = extensionTreeItem.checkboxState;
    } else {
      checkboxState = extensionTreeItem.checkboxState.state;
      tooltip = extensionTreeItem.checkboxState.tooltip;
      accessibilityInformation = extensionTreeItem.checkboxState.accessibilityInformation;
    }
    return { isChecked: checkboxState === extHostTypes.TreeItemCheckboxState.Checked, tooltip, accessibilityInformation };
  }
  validateTreeItem(extensionTreeItem) {
    if (!extHostTypes.TreeItem.isTreeItem(extensionTreeItem, this.extension)) {
      throw new Error(`Extension ${this.extension.identifier.value} has provided an invalid tree item.`);
    }
  }
  createTreeNode(element, extensionTreeItem, parent) {
    this.validateTreeItem(extensionTreeItem);
    const disposableStore = this._register(new DisposableStore());
    const handle = this.createHandle(element, extensionTreeItem, parent);
    const icon = this.getLightIconPath(extensionTreeItem);
    const item = {
      handle,
      parentHandle: parent ? parent.item.handle : void 0,
      label: toTreeItemLabel(extensionTreeItem.label, this.extension),
      description: extensionTreeItem.description,
      resourceUri: extensionTreeItem.resourceUri,
      tooltip: this.getTooltip(extensionTreeItem.tooltip),
      command: this.getCommand(disposableStore, extensionTreeItem.command),
      contextValue: extensionTreeItem.contextValue,
      icon,
      iconDark: this.getDarkIconPath(extensionTreeItem) || icon,
      themeIcon: this.getThemeIcon(extensionTreeItem),
      collapsibleState: isUndefinedOrNull(extensionTreeItem.collapsibleState) ? extHostTypes.TreeItemCollapsibleState.None : extensionTreeItem.collapsibleState,
      accessibilityInformation: extensionTreeItem.accessibilityInformation,
      checkbox: this.getCheckbox(extensionTreeItem)
    };
    return {
      item,
      extensionItem: extensionTreeItem,
      parent,
      children: void 0,
      disposableStore,
      dispose() {
        disposableStore.dispose();
      }
    };
  }
  getThemeIcon(extensionTreeItem) {
    return extensionTreeItem.iconPath instanceof extHostTypes.ThemeIcon ? extensionTreeItem.iconPath : void 0;
  }
  createHandle(element, { id, label, resourceUri }, parent, returnFirst) {
    if (id) {
      return `${_ExtHostTreeView.ID_HANDLE_PREFIX}/${id}`;
    }
    const treeItemLabel = toTreeItemLabel(label, this.extension);
    const prefix = parent ? parent.item.handle : _ExtHostTreeView.LABEL_HANDLE_PREFIX;
    let elementId = treeItemLabel ? treeItemLabel.label : resourceUri ? basename(resourceUri) : "";
    elementId = elementId.indexOf("/") !== -1 ? elementId.replace("/", "//") : elementId;
    const existingHandle = this.nodes.has(element) ? this.nodes.get(element).item.handle : void 0;
    const childrenNodes = this.getChildrenNodes(parent) || [];
    let handle;
    let counter = 0;
    do {
      handle = `${prefix}/${counter}:${elementId}`;
      if (returnFirst || !this.elements.has(handle) || existingHandle === handle) {
        break;
      }
      counter++;
    } while (counter <= childrenNodes.length);
    return handle;
  }
  getLightIconPath(extensionTreeItem) {
    if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof extHostTypes.ThemeIcon)) {
      if (typeof extensionTreeItem.iconPath === "string" || URI.isUri(extensionTreeItem.iconPath)) {
        return this.getIconPath(extensionTreeItem.iconPath);
      }
      return this.getIconPath(extensionTreeItem.iconPath.light);
    }
    return void 0;
  }
  getDarkIconPath(extensionTreeItem) {
    if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof extHostTypes.ThemeIcon) && extensionTreeItem.iconPath.dark) {
      return this.getIconPath(extensionTreeItem.iconPath.dark);
    }
    return void 0;
  }
  getIconPath(iconPath) {
    if (URI.isUri(iconPath)) {
      return iconPath;
    }
    return URI.file(iconPath);
  }
  addNodeToCache(element, node) {
    this.elements.set(node.item.handle, element);
    this.nodes.set(element, node);
  }
  updateNodeCache(element, newNode, existing, parentNode) {
    this.elements.delete(newNode.item.handle);
    this.nodes.delete(element);
    if (newNode.item.handle !== existing.item.handle) {
      this.elements.delete(existing.item.handle);
    }
    this.addNodeToCache(element, newNode);
    const childrenNodes = this.getChildrenNodes(parentNode) || [];
    const childNode = childrenNodes.filter((c) => c.item.handle === existing.item.handle)[0];
    if (childNode) {
      childrenNodes.splice(childrenNodes.indexOf(childNode), 1, newNode);
    }
  }
  addNodeToParentCache(node, parentNode) {
    if (parentNode) {
      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push(node);
    } else {
      if (!this.roots) {
        this.roots = [];
      }
      this.roots.push(node);
    }
  }
  clearChildren(parentElement) {
    if (parentElement) {
      const node = this.nodes.get(parentElement);
      if (node) {
        if (node.children) {
          for (const child of node.children) {
            const childElement = this.elements.get(child.item.handle);
            if (childElement) {
              this.clear(childElement);
            }
          }
        }
        node.children = void 0;
      }
    } else {
      this.clearAll();
    }
  }
  clear(element) {
    const node = this.nodes.get(element);
    if (node) {
      if (node.children) {
        for (const child of node.children) {
          const childElement = this.elements.get(child.item.handle);
          if (childElement) {
            this.clear(childElement);
          }
        }
      }
      this.nodes.delete(element);
      this.elements.delete(node.item.handle);
      node.dispose();
    }
  }
  clearAll() {
    this.roots = void 0;
    this.elements.clear();
    this.nodes.forEach((node) => node.dispose());
    this.nodes.clear();
  }
  dispose() {
    super.dispose();
    this._refreshCancellationSource.dispose();
    this.clearAll();
    this.proxy.$disposeTree(this.viewId);
  }
};
_ExtHostTreeView.LABEL_HANDLE_PREFIX = "0";
_ExtHostTreeView.ID_HANDLE_PREFIX = "1";
let ExtHostTreeView = _ExtHostTreeView;
export {
  ExtHostTreeViews
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VHJlZVZpZXdzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQ2hlY2tib3hVcGRhdGUsIERhdGFUcmFuc2ZlckRUTywgRXh0SG9zdFRyZWVWaWV3c1NoYXBlLCBNYWluVGhyZWFkVHJlZVZpZXdzU2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSVRyZWVJdGVtLCBUcmVlVmlld0l0ZW1IYW5kbGVBcmcsIElUcmVlSXRlbUxhYmVsLCBJUmV2ZWFsT3B0aW9ucywgVHJlZUNvbW1hbmQsIFRyZWVWaWV3UGFuZUhhbmRsZUFyZywgSVRyZWVJdGVtQ2hlY2tib3hTdGF0ZSwgTm9UcmVlVmlld0Vycm9yIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb21tYW5kcywgQ29tbWFuZHNDb252ZXJ0ZXIgfSBmcm9tICcuL2V4dEhvc3RDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBhc1Byb21pc2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgKiBhcyBleHRIb3N0VHlwZXMgZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0IHsgaXNVbmRlZmluZWRPck51bGwsIGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgZXF1YWxzLCBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcsIFZpZXdCYWRnZSwgRGF0YVRyYW5zZmVyIH0gZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nLCBpc01hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElUcmVlVmlld3NEbkRTZXJ2aWNlLCBUcmVlVmlld3NEbkRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90cmVlVmlld3NEbmQuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgY2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcblxudHlwZSBUcmVlSXRlbUhhbmRsZSA9IHN0cmluZztcblxuZnVuY3Rpb24gdG9UcmVlSXRlbUxhYmVsKGxhYmVsOiBhbnksIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogSVRyZWVJdGVtTGFiZWwgfCB1bmRlZmluZWQge1xuXHRpZiAoaXNTdHJpbmcobGFiZWwpKSB7XG5cdFx0cmV0dXJuIHsgbGFiZWwgfTtcblx0fVxuXG5cdGlmIChsYWJlbFxuXHRcdCYmIHR5cGVvZiBsYWJlbCA9PT0gJ29iamVjdCdcblx0XHQmJiB0eXBlb2YgbGFiZWwubGFiZWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0bGV0IGhpZ2hsaWdodHM6IFtudW1iZXIsIG51bWJlcl1bXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShsYWJlbC5oaWdobGlnaHRzKSkge1xuXHRcdFx0aGlnaGxpZ2h0cyA9ICg8W251bWJlciwgbnVtYmVyXVtdPmxhYmVsLmhpZ2hsaWdodHMpLmZpbHRlcigoaGlnaGxpZ2h0ID0+IGhpZ2hsaWdodC5sZW5ndGggPT09IDIgJiYgdHlwZW9mIGhpZ2hsaWdodFswXSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGhpZ2hsaWdodFsxXSA9PT0gJ251bWJlcicpKTtcblx0XHRcdGhpZ2hsaWdodHMgPSBoaWdobGlnaHRzLmxlbmd0aCA/IGhpZ2hsaWdodHMgOiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB7IGxhYmVsOiBsYWJlbC5sYWJlbCwgaGlnaGxpZ2h0cyB9O1xuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuXG5leHBvcnQgY2xhc3MgRXh0SG9zdFRyZWVWaWV3cyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBFeHRIb3N0VHJlZVZpZXdzU2hhcGUge1xuXG5cdHByaXZhdGUgdHJlZVZpZXdzOiBNYXA8c3RyaW5nLCBFeHRIb3N0VHJlZVZpZXc8YW55Pj4gPSBuZXcgTWFwPHN0cmluZywgRXh0SG9zdFRyZWVWaWV3PGFueT4+KCk7XG5cdHByaXZhdGUgdHJlZURyYWdBbmREcm9wU2VydmljZTogSVRyZWVWaWV3c0RuRFNlcnZpY2U8dnNjb2RlLkRhdGFUcmFuc2Zlcj4gPSBuZXcgVHJlZVZpZXdzRG5EU2VydmljZTx2c2NvZGUuRGF0YVRyYW5zZmVyPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX3Byb3h5OiBNYWluVGhyZWFkVHJlZVZpZXdzU2hhcGUsXG5cdFx0cHJpdmF0ZSBjb21tYW5kczogRXh0SG9zdENvbW1hbmRzLFxuXHRcdHByaXZhdGUgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRmdW5jdGlvbiBpc1RyZWVWaWV3Q29udmVydGFibGVJdGVtKGFyZzogYW55KTogYm9vbGVhbiB7XG5cdFx0XHRyZXR1cm4gYXJnICYmIGFyZy4kdHJlZVZpZXdJZCAmJiAoYXJnLiR0cmVlSXRlbUhhbmRsZSB8fCBhcmcuJHNlbGVjdGVkVHJlZUl0ZW1zIHx8IGFyZy4kZm9jdXNlZFRyZWVJdGVtKTtcblx0XHR9XG5cdFx0Y29tbWFuZHMucmVnaXN0ZXJBcmd1bWVudFByb2Nlc3Nvcih7XG5cdFx0XHRwcm9jZXNzQXJndW1lbnQ6IGFyZyA9PiB7XG5cdFx0XHRcdGlmIChpc1RyZWVWaWV3Q29udmVydGFibGVJdGVtKGFyZykpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5jb252ZXJ0QXJndW1lbnQoYXJnKTtcblx0XHRcdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFyZykgJiYgKGFyZy5sZW5ndGggPiAwKSkge1xuXHRcdFx0XHRcdHJldHVybiBhcmcubWFwKGl0ZW0gPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGlzVHJlZVZpZXdDb252ZXJ0YWJsZUl0ZW0oaXRlbSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuY29udmVydEFyZ3VtZW50KGl0ZW0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGFyZztcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJlZ2lzdGVyVHJlZURhdGFQcm92aWRlcjxUPihpZDogc3RyaW5nLCB0cmVlRGF0YVByb3ZpZGVyOiB2c2NvZGUuVHJlZURhdGFQcm92aWRlcjxUPiwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLmNyZWF0ZVRyZWVWaWV3KGlkLCB7IHRyZWVEYXRhUHJvdmlkZXIgfSwgZXh0ZW5zaW9uKTtcblx0XHRyZXR1cm4geyBkaXNwb3NlOiAoKSA9PiB0cmVlVmlldy5kaXNwb3NlKCkgfTtcblx0fVxuXG5cdGNyZWF0ZVRyZWVWaWV3PFQ+KHZpZXdJZDogc3RyaW5nLCBvcHRpb25zOiB2c2NvZGUuVHJlZVZpZXdPcHRpb25zPFQ+LCBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbik6IHZzY29kZS5UcmVlVmlldzxUPiB7XG5cdFx0aWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLnRyZWVEYXRhUHJvdmlkZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignT3B0aW9ucyB3aXRoIHRyZWVEYXRhUHJvdmlkZXIgaXMgbWFuZGF0b3J5Jyk7XG5cdFx0fVxuXHRcdGNvbnN0IGRyb3BNaW1lVHlwZXMgPSBvcHRpb25zLmRyYWdBbmREcm9wQ29udHJvbGxlcj8uZHJvcE1pbWVUeXBlcyA/PyBbXTtcblx0XHRjb25zdCBkcmFnTWltZVR5cGVzID0gb3B0aW9ucy5kcmFnQW5kRHJvcENvbnRyb2xsZXI/LmRyYWdNaW1lVHlwZXMgPz8gW107XG5cdFx0Y29uc3QgaGFzSGFuZGxlRHJhZyA9ICEhb3B0aW9ucy5kcmFnQW5kRHJvcENvbnRyb2xsZXI/LmhhbmRsZURyYWc7XG5cdFx0Y29uc3QgaGFzSGFuZGxlRHJvcCA9ICEhb3B0aW9ucy5kcmFnQW5kRHJvcENvbnRyb2xsZXI/LmhhbmRsZURyb3A7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLmNyZWF0ZUV4dEhvc3RUcmVlVmlldyh2aWV3SWQsIG9wdGlvbnMsIGV4dGVuc2lvbik7XG5cdFx0Y29uc3QgcHJveHlPcHRpb25zID0geyBzaG93Q29sbGFwc2VBbGw6ICEhb3B0aW9ucy5zaG93Q29sbGFwc2VBbGwsIGNhblNlbGVjdE1hbnk6ICEhb3B0aW9ucy5jYW5TZWxlY3RNYW55LCBkcm9wTWltZVR5cGVzLCBkcmFnTWltZVR5cGVzLCBoYXNIYW5kbGVEcmFnLCBoYXNIYW5kbGVEcm9wLCBtYW51YWxseU1hbmFnZUNoZWNrYm94ZXM6ICEhb3B0aW9ucy5tYW5hZ2VDaGVja2JveFN0YXRlTWFudWFsbHkgfTtcblx0XHRjb25zdCByZWdpc3RlclByb21pc2UgPSB0aGlzLl9wcm94eS4kcmVnaXN0ZXJUcmVlVmlld0RhdGFQcm92aWRlcih2aWV3SWQsIHByb3h5T3B0aW9ucyk7XG5cdFx0Y29uc3QgdmlldyA9IHtcblx0XHRcdGdldCBvbkRpZENvbGxhcHNlRWxlbWVudCgpIHsgcmV0dXJuIHRyZWVWaWV3Lm9uRGlkQ29sbGFwc2VFbGVtZW50OyB9LFxuXHRcdFx0Z2V0IG9uRGlkRXhwYW5kRWxlbWVudCgpIHsgcmV0dXJuIHRyZWVWaWV3Lm9uRGlkRXhwYW5kRWxlbWVudDsgfSxcblx0XHRcdGdldCBzZWxlY3Rpb24oKSB7IHJldHVybiB0cmVlVmlldy5zZWxlY3RlZEVsZW1lbnRzOyB9LFxuXHRcdFx0Z2V0IG9uRGlkQ2hhbmdlU2VsZWN0aW9uKCkgeyByZXR1cm4gdHJlZVZpZXcub25EaWRDaGFuZ2VTZWxlY3Rpb247IH0sXG5cdFx0XHRnZXQgYWN0aXZlSXRlbSgpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndHJlZVZpZXdBY3RpdmVJdGVtJyk7XG5cdFx0XHRcdHJldHVybiB0cmVlVmlldy5mb2N1c2VkRWxlbWVudDtcblx0XHRcdH0sXG5cdFx0XHRnZXQgb25EaWRDaGFuZ2VBY3RpdmVJdGVtKCkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0cmVlVmlld0FjdGl2ZUl0ZW0nKTtcblx0XHRcdFx0cmV0dXJuIHRyZWVWaWV3Lm9uRGlkQ2hhbmdlQWN0aXZlSXRlbTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgdmlzaWJsZSgpIHsgcmV0dXJuIHRyZWVWaWV3LnZpc2libGU7IH0sXG5cdFx0XHRnZXQgb25EaWRDaGFuZ2VWaXNpYmlsaXR5KCkgeyByZXR1cm4gdHJlZVZpZXcub25EaWRDaGFuZ2VWaXNpYmlsaXR5OyB9LFxuXHRcdFx0Z2V0IG9uRGlkQ2hhbmdlQ2hlY2tib3hTdGF0ZSgpIHtcblx0XHRcdFx0cmV0dXJuIHRyZWVWaWV3Lm9uRGlkQ2hhbmdlQ2hlY2tib3hTdGF0ZTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgbWVzc2FnZSgpIHsgcmV0dXJuIHRyZWVWaWV3Lm1lc3NhZ2U7IH0sXG5cdFx0XHRzZXQgbWVzc2FnZShtZXNzYWdlOiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmcpIHtcblx0XHRcdFx0aWYgKGlzTWFya2Rvd25TdHJpbmcobWVzc2FnZSkpIHtcblx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0cmVlVmlld01hcmtkb3duTWVzc2FnZScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRyZWVWaWV3Lm1lc3NhZ2UgPSBtZXNzYWdlO1xuXHRcdFx0fSxcblx0XHRcdGdldCB0aXRsZSgpIHsgcmV0dXJuIHRyZWVWaWV3LnRpdGxlOyB9LFxuXHRcdFx0c2V0IHRpdGxlKHRpdGxlOiBzdHJpbmcpIHtcblx0XHRcdFx0dHJlZVZpZXcudGl0bGUgPSB0aXRsZTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgZGVzY3JpcHRpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0cmVlVmlldy5kZXNjcmlwdGlvbjtcblx0XHRcdH0sXG5cdFx0XHRzZXQgZGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0cmVlVmlldy5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuXHRcdFx0fSxcblx0XHRcdGdldCBiYWRnZSgpIHtcblx0XHRcdFx0cmV0dXJuIHRyZWVWaWV3LmJhZGdlO1xuXHRcdFx0fSxcblx0XHRcdHNldCBiYWRnZShiYWRnZTogdnNjb2RlLlZpZXdCYWRnZSB8IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpZiAoKGJhZGdlICE9PSB1bmRlZmluZWQpICYmIGV4dEhvc3RUeXBlcy5WaWV3QmFkZ2UuaXNWaWV3QmFkZ2UoYmFkZ2UpKSB7XG5cdFx0XHRcdFx0dHJlZVZpZXcuYmFkZ2UgPSB7XG5cdFx0XHRcdFx0XHR2YWx1ZTogTWF0aC5mbG9vcihNYXRoLmFicyhiYWRnZS52YWx1ZSkpLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogYmFkZ2UudG9vbHRpcFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZWxzZSBpZiAoYmFkZ2UgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRyZWVWaWV3LmJhZGdlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0cmV2ZWFsOiAoZWxlbWVudDogVCwgb3B0aW9ucz86IElSZXZlYWxPcHRpb25zKTogUHJvbWlzZTx2b2lkPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0cmVlVmlldy5yZXZlYWwoZWxlbWVudCwgb3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZTogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHQvLyBXYWl0IGZvciB0aGUgcmVnaXN0cmF0aW9uIHByb21pc2UgdG8gZmluaXNoIGJlZm9yZSBkb2luZyB0aGUgZGlzcG9zZS5cblx0XHRcdFx0YXdhaXQgcmVnaXN0ZXJQcm9taXNlO1xuXHRcdFx0XHR0aGlzLnRyZWVWaWV3cy5kZWxldGUodmlld0lkKTtcblx0XHRcdFx0dHJlZVZpZXcuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5fcmVnaXN0ZXIodmlldyk7XG5cdFx0cmV0dXJuIHZpZXcgYXMgdnNjb2RlLlRyZWVWaWV3PFQ+O1xuXHR9XG5cblx0YXN5bmMgJGdldENoaWxkcmVuKHRyZWVWaWV3SWQ6IHN0cmluZywgdHJlZUl0ZW1IYW5kbGVzPzogc3RyaW5nW10pOiBQcm9taXNlPChudW1iZXIgfCBJVHJlZUl0ZW0pW11bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHRyZWVWaWV3ID0gdGhpcy50cmVlVmlld3MuZ2V0KHRyZWVWaWV3SWQpO1xuXHRcdGlmICghdHJlZVZpZXcpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgTm9UcmVlVmlld0Vycm9yKHRyZWVWaWV3SWQpKTtcblx0XHR9XG5cdFx0aWYgKCF0cmVlSXRlbUhhbmRsZXMpIHtcblx0XHRcdGNvbnN0IGNoaWxkcmVuID0gYXdhaXQgdHJlZVZpZXcuZ2V0Q2hpbGRyZW4oKTtcblx0XHRcdHJldHVybiBjaGlsZHJlbiA/IFtbMCwgLi4uY2hpbGRyZW5dXSA6IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Ly8gS2VlcCBvcmRlciBvZiB0cmVlSXRlbUhhbmRsZXMgaW4gY2FzZSBleHRlbnNpb24gdHJlZXMgYWxyZWFkeSBkZXBlbmQgb24gdGhpc1xuXHRcdGNvbnN0IHJlc3VsdCA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdHJlZUl0ZW1IYW5kbGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCB0cmVlSXRlbUhhbmRsZSA9IHRyZWVJdGVtSGFuZGxlc1tpXTtcblx0XHRcdGNvbnN0IGNoaWxkcmVuID0gYXdhaXQgdHJlZVZpZXcuZ2V0Q2hpbGRyZW4odHJlZUl0ZW1IYW5kbGUpO1xuXHRcdFx0aWYgKGNoaWxkcmVuKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKFtpLCAuLi5jaGlsZHJlbl0pO1xuXHRcdFx0fVxuXG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRhc3luYyAkaGFuZGxlRHJvcChkZXN0aW5hdGlvblZpZXdJZDogc3RyaW5nLCByZXF1ZXN0SWQ6IG51bWJlciwgdHJlZURhdGFUcmFuc2ZlckRUTzogRGF0YVRyYW5zZmVyRFRPLCB0YXJnZXRJdGVtSGFuZGxlOiBzdHJpbmcgfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbixcblx0XHRvcGVyYXRpb25VdWlkPzogc3RyaW5nLCBzb3VyY2VWaWV3SWQ/OiBzdHJpbmcsIHNvdXJjZVRyZWVJdGVtSGFuZGxlcz86IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLnRyZWVWaWV3cy5nZXQoZGVzdGluYXRpb25WaWV3SWQpO1xuXHRcdGlmICghdHJlZVZpZXcpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgTm9UcmVlVmlld0Vycm9yKGRlc3RpbmF0aW9uVmlld0lkKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdHJlZURhdGFUcmFuc2ZlciA9IERhdGFUcmFuc2Zlci50b0RhdGFUcmFuc2Zlcih0cmVlRGF0YVRyYW5zZmVyRFRPLCBhc3luYyBkYXRhSXRlbUluZGV4ID0+IHtcblx0XHRcdHJldHVybiAoYXdhaXQgdGhpcy5fcHJveHkuJHJlc29sdmVEcm9wRmlsZURhdGEoZGVzdGluYXRpb25WaWV3SWQsIHJlcXVlc3RJZCwgZGF0YUl0ZW1JbmRleCkpLmJ1ZmZlcjtcblx0XHR9KTtcblx0XHRpZiAoKHNvdXJjZVZpZXdJZCA9PT0gZGVzdGluYXRpb25WaWV3SWQpICYmIHNvdXJjZVRyZWVJdGVtSGFuZGxlcykge1xuXHRcdFx0YXdhaXQgdGhpcy5hZGRBZGRpdGlvbmFsVHJhbnNmZXJJdGVtcyh0cmVlRGF0YVRyYW5zZmVyLCB0cmVlVmlldywgc291cmNlVHJlZUl0ZW1IYW5kbGVzLCB0b2tlbiwgb3BlcmF0aW9uVXVpZCk7XG5cdFx0fVxuXHRcdHJldHVybiB0cmVlVmlldy5vbkRyb3AodHJlZURhdGFUcmFuc2ZlciwgdGFyZ2V0SXRlbUhhbmRsZSwgdG9rZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhZGRBZGRpdGlvbmFsVHJhbnNmZXJJdGVtcyh0cmVlRGF0YVRyYW5zZmVyOiB2c2NvZGUuRGF0YVRyYW5zZmVyLCB0cmVlVmlldzogRXh0SG9zdFRyZWVWaWV3PGFueT4sXG5cdFx0c291cmNlVHJlZUl0ZW1IYW5kbGVzOiBzdHJpbmdbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBvcGVyYXRpb25VdWlkPzogc3RyaW5nKTogUHJvbWlzZTx2c2NvZGUuRGF0YVRyYW5zZmVyIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmdUcmFuc2Zlck9wZXJhdGlvbiA9IHRoaXMudHJlZURyYWdBbmREcm9wU2VydmljZS5yZW1vdmVEcmFnT3BlcmF0aW9uVHJhbnNmZXIob3BlcmF0aW9uVXVpZCk7XG5cdFx0aWYgKGV4aXN0aW5nVHJhbnNmZXJPcGVyYXRpb24pIHtcblx0XHRcdChhd2FpdCBleGlzdGluZ1RyYW5zZmVyT3BlcmF0aW9uKT8uZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuXHRcdFx0XHRpZiAodmFsdWUpIHtcblx0XHRcdFx0XHR0cmVlRGF0YVRyYW5zZmVyLnNldChrZXksIHZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIGlmIChvcGVyYXRpb25VdWlkICYmIHRyZWVWaWV3LmhhbmRsZURyYWcpIHtcblx0XHRcdGNvbnN0IHdpbGxEcm9wUHJvbWlzZSA9IHRyZWVWaWV3LmhhbmRsZURyYWcoc291cmNlVHJlZUl0ZW1IYW5kbGVzLCB0cmVlRGF0YVRyYW5zZmVyLCB0b2tlbik7XG5cdFx0XHR0aGlzLnRyZWVEcmFnQW5kRHJvcFNlcnZpY2UuYWRkRHJhZ09wZXJhdGlvblRyYW5zZmVyKG9wZXJhdGlvblV1aWQsIHdpbGxEcm9wUHJvbWlzZSk7XG5cdFx0XHRhd2FpdCB3aWxsRHJvcFByb21pc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cmVlRGF0YVRyYW5zZmVyO1xuXHR9XG5cblx0YXN5bmMgJGhhbmRsZURyYWcoc291cmNlVmlld0lkOiBzdHJpbmcsIHNvdXJjZVRyZWVJdGVtSGFuZGxlczogc3RyaW5nW10sIG9wZXJhdGlvblV1aWQ6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxEYXRhVHJhbnNmZXJEVE8gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB0cmVlVmlldyA9IHRoaXMudHJlZVZpZXdzLmdldChzb3VyY2VWaWV3SWQpO1xuXHRcdGlmICghdHJlZVZpZXcpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgTm9UcmVlVmlld0Vycm9yKHNvdXJjZVZpZXdJZCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyZWVEYXRhVHJhbnNmZXIgPSBhd2FpdCB0aGlzLmFkZEFkZGl0aW9uYWxUcmFuc2Zlckl0ZW1zKG5ldyBleHRIb3N0VHlwZXMuRGF0YVRyYW5zZmVyKCksIHRyZWVWaWV3LCBzb3VyY2VUcmVlSXRlbUhhbmRsZXMsIHRva2VuLCBvcGVyYXRpb25VdWlkKTtcblx0XHRpZiAoIXRyZWVEYXRhVHJhbnNmZXIgfHwgdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gRGF0YVRyYW5zZmVyLmZyb20odHJlZURhdGFUcmFuc2Zlcik7XG5cdH1cblxuXHRhc3luYyAkaGFzUmVzb2x2ZSh0cmVlVmlld0lkOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCB0cmVlVmlldyA9IHRoaXMudHJlZVZpZXdzLmdldCh0cmVlVmlld0lkKTtcblx0XHRpZiAoIXRyZWVWaWV3KSB7XG5cdFx0XHR0aHJvdyBuZXcgTm9UcmVlVmlld0Vycm9yKHRyZWVWaWV3SWQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJlZVZpZXcuaGFzUmVzb2x2ZTtcblx0fVxuXG5cdCRyZXNvbHZlKHRyZWVWaWV3SWQ6IHN0cmluZywgdHJlZUl0ZW1IYW5kbGU6IHN0cmluZywgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVRyZWVJdGVtIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLnRyZWVWaWV3cy5nZXQodHJlZVZpZXdJZCk7XG5cdFx0aWYgKCF0cmVlVmlldykge1xuXHRcdFx0dGhyb3cgbmV3IE5vVHJlZVZpZXdFcnJvcih0cmVlVmlld0lkKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRyZWVWaWV3LnJlc29sdmVUcmVlSXRlbSh0cmVlSXRlbUhhbmRsZSwgdG9rZW4pO1xuXHR9XG5cblx0JHNldEV4cGFuZGVkKHRyZWVWaWV3SWQ6IHN0cmluZywgdHJlZUl0ZW1IYW5kbGU6IHN0cmluZywgZXhwYW5kZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCB0cmVlVmlldyA9IHRoaXMudHJlZVZpZXdzLmdldCh0cmVlVmlld0lkKTtcblx0XHRpZiAoIXRyZWVWaWV3KSB7XG5cdFx0XHR0aHJvdyBuZXcgTm9UcmVlVmlld0Vycm9yKHRyZWVWaWV3SWQpO1xuXHRcdH1cblx0XHR0cmVlVmlldy5zZXRFeHBhbmRlZCh0cmVlSXRlbUhhbmRsZSwgZXhwYW5kZWQpO1xuXHR9XG5cblx0JHNldFNlbGVjdGlvbkFuZEZvY3VzKHRyZWVWaWV3SWQ6IHN0cmluZywgc2VsZWN0ZWRIYW5kbGVzOiBzdHJpbmdbXSwgZm9jdXNlZEhhbmRsZTogc3RyaW5nKSB7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLnRyZWVWaWV3cy5nZXQodHJlZVZpZXdJZCk7XG5cdFx0aWYgKCF0cmVlVmlldykge1xuXHRcdFx0dGhyb3cgbmV3IE5vVHJlZVZpZXdFcnJvcih0cmVlVmlld0lkKTtcblx0XHR9XG5cdFx0dHJlZVZpZXcuc2V0U2VsZWN0aW9uQW5kRm9jdXMoc2VsZWN0ZWRIYW5kbGVzLCBmb2N1c2VkSGFuZGxlKTtcblx0fVxuXG5cdCRzZXRWaXNpYmxlKHRyZWVWaWV3SWQ6IHN0cmluZywgaXNWaXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgdHJlZVZpZXcgPSB0aGlzLnRyZWVWaWV3cy5nZXQodHJlZVZpZXdJZCk7XG5cdFx0aWYgKCF0cmVlVmlldykge1xuXHRcdFx0aWYgKCFpc1Zpc2libGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IE5vVHJlZVZpZXdFcnJvcih0cmVlVmlld0lkKTtcblx0XHR9XG5cdFx0dHJlZVZpZXcuc2V0VmlzaWJsZShpc1Zpc2libGUpO1xuXHR9XG5cblx0JGNoYW5nZUNoZWNrYm94U3RhdGUodHJlZVZpZXdJZDogc3RyaW5nLCBjaGVja2JveFVwZGF0ZTogQ2hlY2tib3hVcGRhdGVbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHRyZWVWaWV3ID0gdGhpcy50cmVlVmlld3MuZ2V0KHRyZWVWaWV3SWQpO1xuXHRcdGlmICghdHJlZVZpZXcpIHtcblx0XHRcdHRocm93IG5ldyBOb1RyZWVWaWV3RXJyb3IodHJlZVZpZXdJZCk7XG5cdFx0fVxuXHRcdHRyZWVWaWV3LnNldENoZWNrYm94U3RhdGUoY2hlY2tib3hVcGRhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVFeHRIb3N0VHJlZVZpZXc8VD4oaWQ6IHN0cmluZywgb3B0aW9uczogdnNjb2RlLlRyZWVWaWV3T3B0aW9uczxUPiwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBFeHRIb3N0VHJlZVZpZXc8VD4ge1xuXHRcdGNvbnN0IHRyZWVWaWV3ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEV4dEhvc3RUcmVlVmlldzxUPihpZCwgb3B0aW9ucywgdGhpcy5fcHJveHksIHRoaXMuY29tbWFuZHMuY29udmVydGVyLCB0aGlzLmxvZ1NlcnZpY2UsIGV4dGVuc2lvbikpO1xuXHRcdHRoaXMudHJlZVZpZXdzLnNldChpZCwgdHJlZVZpZXcpO1xuXHRcdHJldHVybiB0cmVlVmlldztcblx0fVxuXG5cdHByaXZhdGUgY29udmVydEFyZ3VtZW50KGFyZzogVHJlZVZpZXdJdGVtSGFuZGxlQXJnIHwgVHJlZVZpZXdQYW5lSGFuZGxlQXJnKTogYW55IHtcblx0XHRjb25zdCB0cmVlVmlldyA9IHRoaXMudHJlZVZpZXdzLmdldChhcmcuJHRyZWVWaWV3SWQpO1xuXHRcdGlmICh0cmVlVmlldyAmJiAnJHRyZWVJdGVtSGFuZGxlJyBpbiBhcmcpIHtcblx0XHRcdHJldHVybiB0cmVlVmlldy5nZXRFeHRlbnNpb25FbGVtZW50KGFyZy4kdHJlZUl0ZW1IYW5kbGUpO1xuXHRcdH1cblx0XHRpZiAodHJlZVZpZXcgJiYgJyRmb2N1c2VkVHJlZUl0ZW0nIGluIGFyZyAmJiBhcmcuJGZvY3VzZWRUcmVlSXRlbSkge1xuXHRcdFx0cmV0dXJuIHRyZWVWaWV3LmZvY3VzZWRFbGVtZW50O1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG50eXBlIFJvb3QgPSBudWxsIHwgdW5kZWZpbmVkIHwgdm9pZDtcbnR5cGUgVHJlZURhdGE8VD4gPSB7IG1lc3NhZ2U6IGJvb2xlYW47IGVsZW1lbnQ6IFQgfCBUW10gfCBSb290IHwgZmFsc2UgfTtcblxuaW50ZXJmYWNlIFRyZWVOb2RlIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRpdGVtOiBJVHJlZUl0ZW07XG5cdGV4dGVuc2lvbkl0ZW06IHZzY29kZS5UcmVlSXRlbTtcblx0cGFyZW50OiBUcmVlTm9kZSB8IFJvb3Q7XG5cdGNoaWxkcmVuPzogVHJlZU5vZGVbXTtcblx0ZGlzcG9zYWJsZVN0b3JlOiBEaXNwb3NhYmxlU3RvcmU7XG59XG5cbmNsYXNzIEV4dEhvc3RUcmVlVmlldzxUPiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IExBQkVMX0hBTkRMRV9QUkVGSVggPSAnMCc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IElEX0hBTkRMRV9QUkVGSVggPSAnMSc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkYXRhUHJvdmlkZXI6IHZzY29kZS5UcmVlRGF0YVByb3ZpZGVyPFQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGRuZENvbnRyb2xsZXI6IHZzY29kZS5UcmVlRHJhZ0FuZERyb3BDb250cm9sbGVyPFQ+IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcm9vdHM6IFRyZWVOb2RlW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZWxlbWVudHM6IE1hcDxUcmVlSXRlbUhhbmRsZSwgVD4gPSBuZXcgTWFwPFRyZWVJdGVtSGFuZGxlLCBUPigpO1xuXHRwcml2YXRlIG5vZGVzOiBNYXA8VCwgVHJlZU5vZGU+ID0gbmV3IE1hcDxULCBUcmVlTm9kZT4oKTtcblxuXHRwcml2YXRlIF92aXNpYmxlOiBib29sZWFuID0gZmFsc2U7XG5cdGdldCB2aXNpYmxlKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fdmlzaWJsZTsgfVxuXG5cdHByaXZhdGUgX3NlbGVjdGVkSGFuZGxlczogVHJlZUl0ZW1IYW5kbGVbXSA9IFtdO1xuXHRnZXQgc2VsZWN0ZWRFbGVtZW50cygpOiBUW10geyByZXR1cm4gPFRbXT50aGlzLl9zZWxlY3RlZEhhbmRsZXMubWFwKGhhbmRsZSA9PiB0aGlzLmdldEV4dGVuc2lvbkVsZW1lbnQoaGFuZGxlKSkuZmlsdGVyKGVsZW1lbnQgPT4gIWlzVW5kZWZpbmVkT3JOdWxsKGVsZW1lbnQpKTsgfVxuXG5cdHByaXZhdGUgX2ZvY3VzZWRIYW5kbGU6IFRyZWVJdGVtSGFuZGxlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRnZXQgZm9jdXNlZEVsZW1lbnQoKTogVCB8IHVuZGVmaW5lZCB7IHJldHVybiA8VCB8IHVuZGVmaW5lZD4odGhpcy5fZm9jdXNlZEhhbmRsZSA/IHRoaXMuZ2V0RXh0ZW5zaW9uRWxlbWVudCh0aGlzLl9mb2N1c2VkSGFuZGxlKSA6IHVuZGVmaW5lZCk7IH1cblxuXHRwcml2YXRlIF9vbkRpZEV4cGFuZEVsZW1lbnQ6IEVtaXR0ZXI8dnNjb2RlLlRyZWVWaWV3RXhwYW5zaW9uRXZlbnQ8VD4+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dnNjb2RlLlRyZWVWaWV3RXhwYW5zaW9uRXZlbnQ8VD4+KCkpO1xuXHRyZWFkb25seSBvbkRpZEV4cGFuZEVsZW1lbnQ6IEV2ZW50PHZzY29kZS5UcmVlVmlld0V4cGFuc2lvbkV2ZW50PFQ+PiA9IHRoaXMuX29uRGlkRXhwYW5kRWxlbWVudC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENvbGxhcHNlRWxlbWVudDogRW1pdHRlcjx2c2NvZGUuVHJlZVZpZXdFeHBhbnNpb25FdmVudDxUPj4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2c2NvZGUuVHJlZVZpZXdFeHBhbnNpb25FdmVudDxUPj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ29sbGFwc2VFbGVtZW50OiBFdmVudDx2c2NvZGUuVHJlZVZpZXdFeHBhbnNpb25FdmVudDxUPj4gPSB0aGlzLl9vbkRpZENvbGxhcHNlRWxlbWVudC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVNlbGVjdGlvbjogRW1pdHRlcjx2c2NvZGUuVHJlZVZpZXdTZWxlY3Rpb25DaGFuZ2VFdmVudDxUPj4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2c2NvZGUuVHJlZVZpZXdTZWxlY3Rpb25DaGFuZ2VFdmVudDxUPj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2VsZWN0aW9uOiBFdmVudDx2c2NvZGUuVHJlZVZpZXdTZWxlY3Rpb25DaGFuZ2VFdmVudDxUPj4gPSB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUFjdGl2ZUl0ZW06IEVtaXR0ZXI8dnNjb2RlLlRyZWVWaWV3QWN0aXZlSXRlbUNoYW5nZUV2ZW50PFQ+PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZzY29kZS5UcmVlVmlld0FjdGl2ZUl0ZW1DaGFuZ2VFdmVudDxUPj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQWN0aXZlSXRlbTogRXZlbnQ8dnNjb2RlLlRyZWVWaWV3QWN0aXZlSXRlbUNoYW5nZUV2ZW50PFQ+PiA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlSXRlbS5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVZpc2liaWxpdHk6IEVtaXR0ZXI8dnNjb2RlLlRyZWVWaWV3VmlzaWJpbGl0eUNoYW5nZUV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZzY29kZS5UcmVlVmlld1Zpc2liaWxpdHlDaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eTogRXZlbnQ8dnNjb2RlLlRyZWVWaWV3VmlzaWJpbGl0eUNoYW5nZUV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUNoZWNrYm94U3RhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2c2NvZGUuVHJlZUNoZWNrYm94Q2hhbmdlRXZlbnQ8VD4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNoZWNrYm94U3RhdGU6IEV2ZW50PHZzY29kZS5UcmVlQ2hlY2tib3hDaGFuZ2VFdmVudDxUPj4gPSB0aGlzLl9vbkRpZENoYW5nZUNoZWNrYm94U3RhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VEYXRhOiBFbWl0dGVyPFRyZWVEYXRhPFQ+PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFRyZWVEYXRhPFQ+PigpKTtcblxuXHRwcml2YXRlIHJlZnJlc2hQcm9taXNlOiBQcm9taXNlPHZvaWQ+ID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdHByaXZhdGUgcmVmcmVzaFF1ZXVlOiBQcm9taXNlPHZvaWQ+ID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSB2aWV3SWQ6IHN0cmluZywgb3B0aW9uczogdnNjb2RlLlRyZWVWaWV3T3B0aW9uczxUPixcblx0XHRwcml2YXRlIHByb3h5OiBNYWluVGhyZWFkVHJlZVZpZXdzU2hhcGUsXG5cdFx0cHJpdmF0ZSBjb21tYW5kczogQ29tbWFuZHNDb252ZXJ0ZXIsXG5cdFx0cHJpdmF0ZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRwcml2YXRlIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0aWYgKGV4dGVuc2lvbi5jb250cmlidXRlcyAmJiBleHRlbnNpb24uY29udHJpYnV0ZXMudmlld3MpIHtcblx0XHRcdGZvciAoY29uc3QgbG9jYXRpb24gaW4gZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXdzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdmlldyBvZiBleHRlbnNpb24uY29udHJpYnV0ZXMudmlld3NbbG9jYXRpb25dKSB7XG5cdFx0XHRcdFx0aWYgKHZpZXcuaWQgPT09IHZpZXdJZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fdGl0bGUgPSB2aWV3Lm5hbWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuZGF0YVByb3ZpZGVyID0gb3B0aW9ucy50cmVlRGF0YVByb3ZpZGVyO1xuXHRcdHRoaXMuZG5kQ29udHJvbGxlciA9IG9wdGlvbnMuZHJhZ0FuZERyb3BDb250cm9sbGVyO1xuXHRcdGlmICh0aGlzLmRhdGFQcm92aWRlci5vbkRpZENoYW5nZVRyZWVEYXRhKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRhdGFQcm92aWRlci5vbkRpZENoYW5nZVRyZWVEYXRhKGVsZW1lbnRPckVsZW1lbnRzID0+IHtcblx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoZWxlbWVudE9yRWxlbWVudHMpICYmIGVsZW1lbnRPckVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZURhdGEuZmlyZSh7IG1lc3NhZ2U6IGZhbHNlLCBlbGVtZW50OiBlbGVtZW50T3JFbGVtZW50cyB9KTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRsZXQgcmVmcmVzaGluZ1Byb21pc2U6IFByb21pc2U8dm9pZD4gfCBudWxsO1xuXHRcdGxldCBwcm9taXNlQ2FsbGJhY2s6ICgpID0+IHZvaWQ7XG5cdFx0Y29uc3Qgb25EaWRDaGFuZ2VEYXRhID0gRXZlbnQuZGVib3VuY2U8VHJlZURhdGE8VD4sIHsgbWVzc2FnZTogYm9vbGVhbjsgZWxlbWVudHM6IChUIHwgUm9vdClbXSB9Pih0aGlzLl9vbkRpZENoYW5nZURhdGEuZXZlbnQsIChyZXN1bHQsIGN1cnJlbnQpID0+IHtcblx0XHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRcdHJlc3VsdCA9IHsgbWVzc2FnZTogZmFsc2UsIGVsZW1lbnRzOiBbXSB9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKGN1cnJlbnQuZWxlbWVudCAhPT0gZmFsc2UpIHtcblx0XHRcdFx0aWYgKCFyZWZyZXNoaW5nUHJvbWlzZSkge1xuXHRcdFx0XHRcdC8vIE5ldyByZWZyZXNoIGhhcyBzdGFydGVkXG5cdFx0XHRcdFx0cmVmcmVzaGluZ1Byb21pc2UgPSBuZXcgUHJvbWlzZShjID0+IHByb21pc2VDYWxsYmFjayA9IGMpO1xuXHRcdFx0XHRcdHRoaXMucmVmcmVzaFByb21pc2UgPSB0aGlzLnJlZnJlc2hQcm9taXNlLnRoZW4oKCkgPT4gcmVmcmVzaGluZ1Byb21pc2UhKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheShjdXJyZW50LmVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0cmVzdWx0LmVsZW1lbnRzLnB1c2goLi4uY3VycmVudC5lbGVtZW50KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQuZWxlbWVudHMucHVzaChjdXJyZW50LmVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoY3VycmVudC5tZXNzYWdlKSB7XG5cdFx0XHRcdHJlc3VsdC5tZXNzYWdlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSwgMjAwLCB0cnVlKTtcblx0XHR0aGlzLl9yZWdpc3RlcihvbkRpZENoYW5nZURhdGEoKHsgbWVzc2FnZSwgZWxlbWVudHMgfSkgPT4ge1xuXHRcdFx0aWYgKGVsZW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLnJlZnJlc2hRdWV1ZSA9IHRoaXMucmVmcmVzaFF1ZXVlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IF9wcm9taXNlQ2FsbGJhY2sgPSBwcm9taXNlQ2FsbGJhY2s7XG5cdFx0XHRcdFx0cmVmcmVzaGluZ1Byb21pc2UgPSBudWxsO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnJlZnJlc2goZWxlbWVudHMpLnRoZW4oKCkgPT4gX3Byb21pc2VDYWxsYmFjaygpKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAobWVzc2FnZSkge1xuXHRcdFx0XHR0aGlzLnByb3h5LiRzZXRNZXNzYWdlKHRoaXMudmlld0lkLCBNYXJrZG93blN0cmluZy5mcm9tU3RyaWN0KHRoaXMuX21lc3NhZ2UpID8/ICcnKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRhc3luYyBnZXRDaGlsZHJlbihwYXJlbnRIYW5kbGU6IFRyZWVJdGVtSGFuZGxlIHwgUm9vdCk6IFByb21pc2U8SVRyZWVJdGVtW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBwYXJlbnRFbGVtZW50ID0gcGFyZW50SGFuZGxlID8gdGhpcy5nZXRFeHRlbnNpb25FbGVtZW50KHBhcmVudEhhbmRsZSkgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKHBhcmVudEhhbmRsZSAmJiAhcGFyZW50RWxlbWVudCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBObyB0cmVlIGl0ZW0gd2l0aCBpZCBcXCcke3BhcmVudEhhbmRsZX1cXCcgZm91bmQuYCk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtdKTtcblx0XHR9XG5cblx0XHRsZXQgY2hpbGRyZW5Ob2RlczogVHJlZU5vZGVbXSB8IHVuZGVmaW5lZCA9IHRoaXMuZ2V0Q2hpbGRyZW5Ob2RlcyhwYXJlbnRIYW5kbGUpOyAvLyBHZXQgaXQgZnJvbSBjYWNoZVxuXG5cdFx0aWYgKCFjaGlsZHJlbk5vZGVzKSB7XG5cdFx0XHRjaGlsZHJlbk5vZGVzID0gYXdhaXQgdGhpcy5mZXRjaENoaWxkcmVuTm9kZXMocGFyZW50RWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNoaWxkcmVuTm9kZXMgPyBjaGlsZHJlbk5vZGVzLm1hcChuID0+IG4uaXRlbSkgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXRFeHRlbnNpb25FbGVtZW50KHRyZWVJdGVtSGFuZGxlOiBUcmVlSXRlbUhhbmRsZSk6IFQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmVsZW1lbnRzLmdldCh0cmVlSXRlbUhhbmRsZSk7XG5cdH1cblxuXHRyZXZlYWwoZWxlbWVudDogVCB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IElSZXZlYWxPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgPyBvcHRpb25zIDogeyBzZWxlY3Q6IHRydWUsIGZvY3VzOiBmYWxzZSB9O1xuXHRcdGNvbnN0IHNlbGVjdCA9IGlzVW5kZWZpbmVkT3JOdWxsKG9wdGlvbnMuc2VsZWN0KSA/IHRydWUgOiBvcHRpb25zLnNlbGVjdDtcblx0XHRjb25zdCBmb2N1cyA9IGlzVW5kZWZpbmVkT3JOdWxsKG9wdGlvbnMuZm9jdXMpID8gZmFsc2UgOiBvcHRpb25zLmZvY3VzO1xuXHRcdGNvbnN0IGV4cGFuZCA9IGlzVW5kZWZpbmVkT3JOdWxsKG9wdGlvbnMuZXhwYW5kKSA/IGZhbHNlIDogb3B0aW9ucy5leHBhbmQ7XG5cblx0XHRpZiAodHlwZW9mIHRoaXMuZGF0YVByb3ZpZGVyLmdldFBhcmVudCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihgUmVxdWlyZWQgcmVnaXN0ZXJlZCBUcmVlRGF0YVByb3ZpZGVyIHRvIGltcGxlbWVudCAnZ2V0UGFyZW50JyBtZXRob2QgdG8gYWNjZXNzICdyZXZlYWwnIG1ldGhvZGApKTtcblx0XHR9XG5cblx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVmcmVzaFByb21pc2Vcblx0XHRcdFx0LnRoZW4oKCkgPT4gdGhpcy5yZXNvbHZlVW5rbm93blBhcmVudENoYWluKGVsZW1lbnQpKVxuXHRcdFx0XHQudGhlbihwYXJlbnRDaGFpbiA9PiB0aGlzLnJlc29sdmVUcmVlTm9kZShlbGVtZW50LCBwYXJlbnRDaGFpbltwYXJlbnRDaGFpbi5sZW5ndGggLSAxXSlcblx0XHRcdFx0XHQudGhlbih0cmVlTm9kZSA9PiB0aGlzLnByb3h5LiRyZXZlYWwodGhpcy52aWV3SWQsIHsgaXRlbTogdHJlZU5vZGUuaXRlbSwgcGFyZW50Q2hhaW46IHBhcmVudENoYWluLm1hcChwID0+IHAuaXRlbSkgfSwgeyBzZWxlY3QsIGZvY3VzLCBleHBhbmQgfSkpLCBlcnJvciA9PiB0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMucHJveHkuJHJldmVhbCh0aGlzLnZpZXdJZCwgdW5kZWZpbmVkLCB7IHNlbGVjdCwgZm9jdXMsIGV4cGFuZCB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9tZXNzYWdlOiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmcgPSAnJztcblx0Z2V0IG1lc3NhZ2UoKTogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVzc2FnZTtcblx0fVxuXG5cdHNldCBtZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyB8IHZzY29kZS5NYXJrZG93blN0cmluZykge1xuXHRcdHRoaXMuX21lc3NhZ2UgPSBtZXNzYWdlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRGF0YS5maXJlKHsgbWVzc2FnZTogdHJ1ZSwgZWxlbWVudDogZmFsc2UgfSk7XG5cdH1cblxuXHRwcml2YXRlIF90aXRsZTogc3RyaW5nID0gJyc7XG5cdGdldCB0aXRsZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl90aXRsZTtcblx0fVxuXG5cdHNldCB0aXRsZSh0aXRsZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fdGl0bGUgPSB0aXRsZTtcblx0XHR0aGlzLnByb3h5LiRzZXRUaXRsZSh0aGlzLnZpZXdJZCwgdGl0bGUsIHRoaXMuX2Rlc2NyaXB0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGdldCBkZXNjcmlwdGlvbigpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9kZXNjcmlwdGlvbjtcblx0fVxuXG5cdHNldCBkZXNjcmlwdGlvbihkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcblx0XHR0aGlzLnByb3h5LiRzZXRUaXRsZSh0aGlzLnZpZXdJZCwgdGhpcy5fdGl0bGUsIGRlc2NyaXB0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgX2JhZGdlOiB2c2NvZGUuVmlld0JhZGdlIHwgdW5kZWZpbmVkO1xuXHRnZXQgYmFkZ2UoKTogdnNjb2RlLlZpZXdCYWRnZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2JhZGdlO1xuXHR9XG5cblx0c2V0IGJhZGdlKGJhZGdlOiB2c2NvZGUuVmlld0JhZGdlIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRoaXMuX2JhZGdlPy52YWx1ZSA9PT0gYmFkZ2U/LnZhbHVlICYmXG5cdFx0XHR0aGlzLl9iYWRnZT8udG9vbHRpcCA9PT0gYmFkZ2U/LnRvb2x0aXApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9iYWRnZSA9IFZpZXdCYWRnZS5mcm9tKGJhZGdlKTtcblx0XHR0aGlzLnByb3h5LiRzZXRCYWRnZSh0aGlzLnZpZXdJZCwgYmFkZ2UpO1xuXHR9XG5cblx0c2V0RXhwYW5kZWQodHJlZUl0ZW1IYW5kbGU6IFRyZWVJdGVtSGFuZGxlLCBleHBhbmRlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldEV4dGVuc2lvbkVsZW1lbnQodHJlZUl0ZW1IYW5kbGUpO1xuXHRcdGlmIChlbGVtZW50KSB7XG5cdFx0XHRpZiAoZXhwYW5kZWQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRFeHBhbmRFbGVtZW50LmZpcmUoT2JqZWN0LmZyZWV6ZSh7IGVsZW1lbnQgfSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDb2xsYXBzZUVsZW1lbnQuZmlyZShPYmplY3QuZnJlZXplKHsgZWxlbWVudCB9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0c2V0U2VsZWN0aW9uQW5kRm9jdXMoc2VsZWN0ZWRIYW5kbGVzOiBUcmVlSXRlbUhhbmRsZVtdLCBmb2N1c2VkSGFuZGxlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBjaGFuZ2VkU2VsZWN0aW9uID0gIWVxdWFscyh0aGlzLl9zZWxlY3RlZEhhbmRsZXMsIHNlbGVjdGVkSGFuZGxlcyk7XG5cdFx0dGhpcy5fc2VsZWN0ZWRIYW5kbGVzID0gc2VsZWN0ZWRIYW5kbGVzO1xuXG5cdFx0Y29uc3QgY2hhbmdlZEZvY3VzID0gdGhpcy5fZm9jdXNlZEhhbmRsZSAhPT0gZm9jdXNlZEhhbmRsZTtcblx0XHR0aGlzLl9mb2N1c2VkSGFuZGxlID0gZm9jdXNlZEhhbmRsZTtcblxuXHRcdGlmIChjaGFuZ2VkU2VsZWN0aW9uKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5maXJlKE9iamVjdC5mcmVlemUoeyBzZWxlY3Rpb246IHRoaXMuc2VsZWN0ZWRFbGVtZW50cyB9KSk7XG5cdFx0fVxuXG5cdFx0aWYgKGNoYW5nZWRGb2N1cykge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVJdGVtLmZpcmUoT2JqZWN0LmZyZWV6ZSh7IGFjdGl2ZUl0ZW06IHRoaXMuZm9jdXNlZEVsZW1lbnQgfSkpO1xuXHRcdH1cblx0fVxuXG5cdHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh2aXNpYmxlICE9PSB0aGlzLl92aXNpYmxlKSB7XG5cdFx0XHR0aGlzLl92aXNpYmxlID0gdmlzaWJsZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5maXJlKE9iamVjdC5mcmVlemUoeyB2aXNpYmxlOiB0aGlzLl92aXNpYmxlIH0pKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzZXRDaGVja2JveFN0YXRlKGNoZWNrYm94VXBkYXRlczogQ2hlY2tib3hVcGRhdGVbXSkge1xuXHRcdHR5cGUgQ2hlY2tib3hVcGRhdGVXaXRoSXRlbSA9IHsgZXh0ZW5zaW9uSXRlbTogTm9uTnVsbGFibGU8VD47IHRyZWVJdGVtOiB2c2NvZGUuVHJlZUl0ZW07IG5ld1N0YXRlOiBleHRIb3N0VHlwZXMuVHJlZUl0ZW1DaGVja2JveFN0YXRlIH07XG5cdFx0Y29uc3QgaXRlbXMgPSAoYXdhaXQgUHJvbWlzZS5hbGwoY2hlY2tib3hVcGRhdGVzLm1hcChhc3luYyBjaGVja2JveFVwZGF0ZSA9PiB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25JdGVtID0gdGhpcy5nZXRFeHRlbnNpb25FbGVtZW50KGNoZWNrYm94VXBkYXRlLnRyZWVJdGVtSGFuZGxlKTtcblx0XHRcdGlmIChleHRlbnNpb25JdGVtKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uSXRlbTogZXh0ZW5zaW9uSXRlbSxcblx0XHRcdFx0XHR0cmVlSXRlbTogYXdhaXQgdGhpcy5kYXRhUHJvdmlkZXIuZ2V0VHJlZUl0ZW0oZXh0ZW5zaW9uSXRlbSksXG5cdFx0XHRcdFx0bmV3U3RhdGU6IGNoZWNrYm94VXBkYXRlLm5ld1N0YXRlID8gZXh0SG9zdFR5cGVzLlRyZWVJdGVtQ2hlY2tib3hTdGF0ZS5DaGVja2VkIDogZXh0SG9zdFR5cGVzLlRyZWVJdGVtQ2hlY2tib3hTdGF0ZS5VbmNoZWNrZWRcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9KSkpLmZpbHRlcjxDaGVja2JveFVwZGF0ZVdpdGhJdGVtPigoaXRlbSk6IGl0ZW0gaXMgQ2hlY2tib3hVcGRhdGVXaXRoSXRlbSA9PiBpdGVtICE9PSB1bmRlZmluZWQpO1xuXG5cdFx0aXRlbXMuZm9yRWFjaChpdGVtID0+IHtcblx0XHRcdGl0ZW0udHJlZUl0ZW0uY2hlY2tib3hTdGF0ZSA9IGl0ZW0ubmV3U3RhdGUgPyBleHRIb3N0VHlwZXMuVHJlZUl0ZW1DaGVja2JveFN0YXRlLkNoZWNrZWQgOiBleHRIb3N0VHlwZXMuVHJlZUl0ZW1DaGVja2JveFN0YXRlLlVuY2hlY2tlZDtcblx0XHR9KTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ2hlY2tib3hTdGF0ZS5maXJlKHsgaXRlbXM6IGl0ZW1zLm1hcChpdGVtID0+IFtpdGVtLmV4dGVuc2lvbkl0ZW0sIGl0ZW0ubmV3U3RhdGVdKSB9KTtcblx0fVxuXG5cdGFzeW5jIGhhbmRsZURyYWcoc291cmNlVHJlZUl0ZW1IYW5kbGVzOiBUcmVlSXRlbUhhbmRsZVtdLCB0cmVlRGF0YVRyYW5zZmVyOiB2c2NvZGUuRGF0YVRyYW5zZmVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5EYXRhVHJhbnNmZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBleHRlbnNpb25UcmVlSXRlbXM6IFRbXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgc291cmNlSGFuZGxlIG9mIHNvdXJjZVRyZWVJdGVtSGFuZGxlcykge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uSXRlbSA9IHRoaXMuZ2V0RXh0ZW5zaW9uRWxlbWVudChzb3VyY2VIYW5kbGUpO1xuXHRcdFx0aWYgKGV4dGVuc2lvbkl0ZW0pIHtcblx0XHRcdFx0ZXh0ZW5zaW9uVHJlZUl0ZW1zLnB1c2goZXh0ZW5zaW9uSXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmRuZENvbnRyb2xsZXI/LmhhbmRsZURyYWcgfHwgKGV4dGVuc2lvblRyZWVJdGVtcy5sZW5ndGggPT09IDApKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuZG5kQ29udHJvbGxlci5oYW5kbGVEcmFnKGV4dGVuc2lvblRyZWVJdGVtcywgdHJlZURhdGFUcmFuc2ZlciwgdG9rZW4pO1xuXHRcdHJldHVybiB0cmVlRGF0YVRyYW5zZmVyO1xuXHR9XG5cblx0Z2V0IGhhc0hhbmRsZURyYWcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5kbmRDb250cm9sbGVyPy5oYW5kbGVEcmFnO1xuXHR9XG5cblx0YXN5bmMgb25Ecm9wKHRyZWVEYXRhVHJhbnNmZXI6IHZzY29kZS5EYXRhVHJhbnNmZXIsIHRhcmdldEhhbmRsZU9yTm9kZTogVHJlZUl0ZW1IYW5kbGUgfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRhcmdldCA9IHRhcmdldEhhbmRsZU9yTm9kZSA/IHRoaXMuZ2V0RXh0ZW5zaW9uRWxlbWVudCh0YXJnZXRIYW5kbGVPck5vZGUpIDogdW5kZWZpbmVkO1xuXHRcdGlmICgoIXRhcmdldCAmJiB0YXJnZXRIYW5kbGVPck5vZGUpIHx8ICF0aGlzLmRuZENvbnRyb2xsZXI/LmhhbmRsZURyb3ApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIGFzUHJvbWlzZSgoKSA9PiB0aGlzLmRuZENvbnRyb2xsZXI/LmhhbmRsZURyb3Bcblx0XHRcdD8gdGhpcy5kbmRDb250cm9sbGVyLmhhbmRsZURyb3AodGFyZ2V0LCB0cmVlRGF0YVRyYW5zZmVyLCB0b2tlbilcblx0XHRcdDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdGdldCBoYXNSZXNvbHZlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuZGF0YVByb3ZpZGVyLnJlc29sdmVUcmVlSXRlbTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVUcmVlSXRlbSh0cmVlSXRlbUhhbmRsZTogc3RyaW5nLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJVHJlZUl0ZW0gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuZGF0YVByb3ZpZGVyLnJlc29sdmVUcmVlSXRlbSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50cy5nZXQodHJlZUl0ZW1IYW5kbGUpO1xuXHRcdGlmIChlbGVtZW50KSB7XG5cdFx0XHRjb25zdCBub2RlID0gdGhpcy5ub2Rlcy5nZXQoZWxlbWVudCk7XG5cdFx0XHRpZiAobm9kZSkge1xuXHRcdFx0XHRjb25zdCByZXNvbHZlID0gYXdhaXQgdGhpcy5kYXRhUHJvdmlkZXIucmVzb2x2ZVRyZWVJdGVtKG5vZGUuZXh0ZW5zaW9uSXRlbSwgZWxlbWVudCwgdG9rZW4pID8/IG5vZGUuZXh0ZW5zaW9uSXRlbTtcblx0XHRcdFx0dGhpcy52YWxpZGF0ZVRyZWVJdGVtKHJlc29sdmUpO1xuXHRcdFx0XHQvLyBSZXNvbHZhYmxlIGVsZW1lbnRzLiBDdXJyZW50bHkgb25seSB0b29sdGlwIGFuZCBjb21tYW5kLlxuXHRcdFx0XHRub2RlLml0ZW0udG9vbHRpcCA9IHRoaXMuZ2V0VG9vbHRpcChyZXNvbHZlLnRvb2x0aXApO1xuXHRcdFx0XHRub2RlLml0ZW0uY29tbWFuZCA9IHRoaXMuZ2V0Q29tbWFuZChub2RlLmRpc3Bvc2FibGVTdG9yZSwgcmVzb2x2ZS5jb21tYW5kKTtcblx0XHRcdFx0cmV0dXJuIG5vZGUuaXRlbTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlVW5rbm93blBhcmVudENoYWluKGVsZW1lbnQ6IFQpOiBQcm9taXNlPFRyZWVOb2RlW10+IHtcblx0XHRyZXR1cm4gdGhpcy5yZXNvbHZlUGFyZW50KGVsZW1lbnQpXG5cdFx0XHQudGhlbigocGFyZW50KSA9PiB7XG5cdFx0XHRcdGlmICghcGFyZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZVVua25vd25QYXJlbnRDaGFpbihwYXJlbnQpXG5cdFx0XHRcdFx0LnRoZW4ocmVzdWx0ID0+IHRoaXMucmVzb2x2ZVRyZWVOb2RlKHBhcmVudCwgcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXSlcblx0XHRcdFx0XHRcdC50aGVuKHBhcmVudE5vZGUgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXN1bHQucHVzaChwYXJlbnROb2RlKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlUGFyZW50KGVsZW1lbnQ6IFQpOiBQcm9taXNlPFQgfCBSb290PiB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMubm9kZXMuZ2V0KGVsZW1lbnQpO1xuXHRcdGlmIChub2RlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5vZGUucGFyZW50ID8gdGhpcy5lbGVtZW50cy5nZXQobm9kZS5wYXJlbnQuaXRlbS5oYW5kbGUpIDogdW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFzUHJvbWlzZSgoKSA9PiB0aGlzLmRhdGFQcm92aWRlci5nZXRQYXJlbnQhKGVsZW1lbnQpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZVRyZWVOb2RlKGVsZW1lbnQ6IFQsIHBhcmVudD86IFRyZWVOb2RlKTogUHJvbWlzZTxUcmVlTm9kZT4ge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLm5vZGVzLmdldChlbGVtZW50KTtcblx0XHRpZiAobm9kZSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShub2RlKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFzUHJvbWlzZSgoKSA9PiB0aGlzLmRhdGFQcm92aWRlci5nZXRUcmVlSXRlbShlbGVtZW50KSlcblx0XHRcdC50aGVuKGV4dFRyZWVJdGVtID0+IHRoaXMuY3JlYXRlSGFuZGxlKGVsZW1lbnQsIGV4dFRyZWVJdGVtLCBwYXJlbnQsIHRydWUpKVxuXHRcdFx0LnRoZW4oaGFuZGxlID0+IHRoaXMuZ2V0Q2hpbGRyZW4ocGFyZW50ID8gcGFyZW50Lml0ZW0uaGFuZGxlIDogdW5kZWZpbmVkKVxuXHRcdFx0XHQudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY2FjaGVkRWxlbWVudCA9IHRoaXMuZ2V0RXh0ZW5zaW9uRWxlbWVudChoYW5kbGUpO1xuXHRcdFx0XHRcdGlmIChjYWNoZWRFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBub2RlID0gdGhpcy5ub2Rlcy5nZXQoY2FjaGVkRWxlbWVudCk7XG5cdFx0XHRcdFx0XHRpZiAobm9kZSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5vZGUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCByZXNvbHZlIHRyZWUgaXRlbSBmb3IgZWxlbWVudCAke2hhbmRsZX0gZnJvbSBleHRlbnNpb24gJHt0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfWApO1xuXHRcdFx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldENoaWxkcmVuTm9kZXMocGFyZW50Tm9kZU9ySGFuZGxlOiBUcmVlTm9kZSB8IFRyZWVJdGVtSGFuZGxlIHwgUm9vdCk6IFRyZWVOb2RlW10gfCB1bmRlZmluZWQge1xuXHRcdGlmIChwYXJlbnROb2RlT3JIYW5kbGUpIHtcblx0XHRcdGxldCBwYXJlbnROb2RlOiBUcmVlTm9kZSB8IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0eXBlb2YgcGFyZW50Tm9kZU9ySGFuZGxlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRjb25zdCBwYXJlbnRFbGVtZW50ID0gdGhpcy5nZXRFeHRlbnNpb25FbGVtZW50KHBhcmVudE5vZGVPckhhbmRsZSk7XG5cdFx0XHRcdHBhcmVudE5vZGUgPSBwYXJlbnRFbGVtZW50ID8gdGhpcy5ub2Rlcy5nZXQocGFyZW50RWxlbWVudCkgOiB1bmRlZmluZWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwYXJlbnROb2RlID0gcGFyZW50Tm9kZU9ySGFuZGxlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHBhcmVudE5vZGUgPyBwYXJlbnROb2RlLmNoaWxkcmVuIHx8IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMucm9vdHM7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGZldGNoQ2hpbGRyZW5Ob2RlcyhwYXJlbnRFbGVtZW50PzogVCk6IFByb21pc2U8VHJlZU5vZGVbXSB8IHVuZGVmaW5lZD4ge1xuXHRcdC8vIGNsZWFyIGNoaWxkcmVuIGNhY2hlXG5cdFx0dGhpcy5jbGVhckNoaWxkcmVuKHBhcmVudEVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKHRoaXMuX3JlZnJlc2hDYW5jZWxsYXRpb25Tb3VyY2UudG9rZW4pO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHBhcmVudE5vZGUgPSBwYXJlbnRFbGVtZW50ID8gdGhpcy5ub2Rlcy5nZXQocGFyZW50RWxlbWVudCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBlbGVtZW50cyA9IGF3YWl0IHRoaXMuZGF0YVByb3ZpZGVyLmdldENoaWxkcmVuKHBhcmVudEVsZW1lbnQpO1xuXHRcdFx0aWYgKGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb2FsZXNjZWRFbGVtZW50cyA9IGNvYWxlc2NlKGVsZW1lbnRzIHx8IFtdKTtcblx0XHRcdGNvbnN0IHRyZWVJdGVtcyA9IGF3YWl0IFByb21pc2UuYWxsKGNvYWxlc2NlKGNvYWxlc2NlZEVsZW1lbnRzKS5tYXAoZWxlbWVudCA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmRhdGFQcm92aWRlci5nZXRUcmVlSXRlbShlbGVtZW50KTtcblx0XHRcdH0pKTtcblx0XHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gY3JlYXRlQW5kUmVnaXN0ZXJUcmVlTm9kZXMgYWRkcyB0aGUgbm9kZXMgdG8gYSBjYWNoZS4gVGhpcyBtdXN0IGJlIGRvbmUgc3luYyBzbyB0aGF0IHRoZXkgZ2V0IGFkZGVkIGluIHRoZSBjb3JyZWN0IG9yZGVyLlxuXHRcdFx0Y29uc3QgaXRlbXMgPSB0cmVlSXRlbXMubWFwKChpdGVtLCBpbmRleCkgPT4gaXRlbSA/IHRoaXMuY3JlYXRlQW5kUmVnaXN0ZXJUcmVlTm9kZShjb2FsZXNjZWRFbGVtZW50c1tpbmRleF0sIGl0ZW0sIHBhcmVudE5vZGUpIDogbnVsbCk7XG5cblx0XHRcdHJldHVybiBjb2FsZXNjZShpdGVtcyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGN0cy5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVmcmVzaENhbmNlbGxhdGlvblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXG5cdHByaXZhdGUgcmVmcmVzaChlbGVtZW50czogKFQgfCBSb290KVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaGFzUm9vdCA9IGVsZW1lbnRzLnNvbWUoZWxlbWVudCA9PiAhZWxlbWVudCk7XG5cdFx0aWYgKGhhc1Jvb3QpIHtcblx0XHRcdC8vIENhbmNlbCBhbnkgcGVuZGluZyBjaGlsZHJlbiBmZXRjaGVzXG5cdFx0XHR0aGlzLl9yZWZyZXNoQ2FuY2VsbGF0aW9uU291cmNlLmRpc3Bvc2UodHJ1ZSk7XG5cdFx0XHR0aGlzLl9yZWZyZXNoQ2FuY2VsbGF0aW9uU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHRcdHRoaXMuY2xlYXJBbGwoKTsgLy8gY2xlYXIgY2FjaGVcblx0XHRcdHJldHVybiB0aGlzLnByb3h5LiRyZWZyZXNoKHRoaXMudmlld0lkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgaGFuZGxlc1RvUmVmcmVzaCA9IHRoaXMuZ2V0SGFuZGxlc1RvUmVmcmVzaCg8VFtdPmVsZW1lbnRzKTtcblx0XHRcdGlmIChoYW5kbGVzVG9SZWZyZXNoLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5yZWZyZXNoSGFuZGxlcyhoYW5kbGVzVG9SZWZyZXNoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRIYW5kbGVzVG9SZWZyZXNoKGVsZW1lbnRzOiBUW10pOiBUcmVlSXRlbUhhbmRsZVtdIHtcblx0XHRjb25zdCBlbGVtZW50c1RvVXBkYXRlID0gbmV3IFNldDxUcmVlSXRlbUhhbmRsZT4oKTtcblx0XHRjb25zdCBlbGVtZW50Tm9kZXMgPSBlbGVtZW50cy5tYXAoZWxlbWVudCA9PiB0aGlzLm5vZGVzLmdldChlbGVtZW50KSk7XG5cdFx0Zm9yIChjb25zdCBlbGVtZW50Tm9kZSBvZiBlbGVtZW50Tm9kZXMpIHtcblx0XHRcdGlmIChlbGVtZW50Tm9kZSAmJiAhZWxlbWVudHNUb1VwZGF0ZS5oYXMoZWxlbWVudE5vZGUuaXRlbS5oYW5kbGUpKSB7XG5cdFx0XHRcdC8vIGNoZWNrIGlmIGFuIGFuY2VzdG9yIG9mIGV4dEVsZW1lbnQgaXMgYWxyZWFkeSBpbiB0aGUgZWxlbWVudHMgbGlzdFxuXHRcdFx0XHRsZXQgY3VycmVudE5vZGU6IFRyZWVOb2RlIHwgdW5kZWZpbmVkID0gZWxlbWVudE5vZGU7XG5cdFx0XHRcdHdoaWxlIChjdXJyZW50Tm9kZSAmJiBjdXJyZW50Tm9kZS5wYXJlbnQgJiYgZWxlbWVudE5vZGVzLmZpbmRJbmRleChub2RlID0+IGN1cnJlbnROb2RlICYmIGN1cnJlbnROb2RlLnBhcmVudCAmJiBub2RlICYmIG5vZGUuaXRlbS5oYW5kbGUgPT09IGN1cnJlbnROb2RlLnBhcmVudC5pdGVtLmhhbmRsZSkgPT09IC0xKSB7XG5cdFx0XHRcdFx0Y29uc3QgcGFyZW50RWxlbWVudDogVCB8IHVuZGVmaW5lZCA9IHRoaXMuZWxlbWVudHMuZ2V0KGN1cnJlbnROb2RlLnBhcmVudC5pdGVtLmhhbmRsZSk7XG5cdFx0XHRcdFx0Y3VycmVudE5vZGUgPSBwYXJlbnRFbGVtZW50ID8gdGhpcy5ub2Rlcy5nZXQocGFyZW50RWxlbWVudCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGN1cnJlbnROb2RlICYmICFjdXJyZW50Tm9kZS5wYXJlbnQpIHtcblx0XHRcdFx0XHRlbGVtZW50c1RvVXBkYXRlLmFkZChlbGVtZW50Tm9kZS5pdGVtLmhhbmRsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBoYW5kbGVzVG9VcGRhdGU6IFRyZWVJdGVtSGFuZGxlW10gPSBbXTtcblx0XHQvLyBUYWtlIG9ubHkgdG9wIGxldmVsIGVsZW1lbnRzXG5cdFx0ZWxlbWVudHNUb1VwZGF0ZS5mb3JFYWNoKChoYW5kbGUpID0+IHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSB0aGlzLmVsZW1lbnRzLmdldChoYW5kbGUpO1xuXHRcdFx0aWYgKGVsZW1lbnQpIHtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHRoaXMubm9kZXMuZ2V0KGVsZW1lbnQpO1xuXHRcdFx0XHRpZiAobm9kZSAmJiAoIW5vZGUucGFyZW50IHx8ICFlbGVtZW50c1RvVXBkYXRlLmhhcyhub2RlLnBhcmVudC5pdGVtLmhhbmRsZSkpKSB7XG5cdFx0XHRcdFx0aGFuZGxlc1RvVXBkYXRlLnB1c2goaGFuZGxlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGhhbmRsZXNUb1VwZGF0ZTtcblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaEhhbmRsZXMoaXRlbUhhbmRsZXM6IFRyZWVJdGVtSGFuZGxlW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpdGVtc1RvUmVmcmVzaDogeyBbdHJlZUl0ZW1IYW5kbGU6IHN0cmluZ106IElUcmVlSXRlbSB9ID0ge307XG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKGl0ZW1IYW5kbGVzLm1hcCh0cmVlSXRlbUhhbmRsZSA9PlxuXHRcdFx0dGhpcy5yZWZyZXNoTm9kZSh0cmVlSXRlbUhhbmRsZSlcblx0XHRcdFx0LnRoZW4obm9kZSA9PiB7XG5cdFx0XHRcdFx0aWYgKG5vZGUpIHtcblx0XHRcdFx0XHRcdGl0ZW1zVG9SZWZyZXNoW3RyZWVJdGVtSGFuZGxlXSA9IG5vZGUuaXRlbTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKSlcblx0XHRcdC50aGVuKCgpID0+IE9iamVjdC5rZXlzKGl0ZW1zVG9SZWZyZXNoKS5sZW5ndGggPyB0aGlzLnByb3h5LiRyZWZyZXNoKHRoaXMudmlld0lkLCBpdGVtc1RvUmVmcmVzaCkgOiB1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWZyZXNoTm9kZSh0cmVlSXRlbUhhbmRsZTogVHJlZUl0ZW1IYW5kbGUpOiBQcm9taXNlPFRyZWVOb2RlIHwgbnVsbD4ge1xuXHRcdGNvbnN0IGV4dEVsZW1lbnQgPSB0aGlzLmdldEV4dGVuc2lvbkVsZW1lbnQodHJlZUl0ZW1IYW5kbGUpO1xuXHRcdGlmIChleHRFbGVtZW50KSB7XG5cdFx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMubm9kZXMuZ2V0KGV4dEVsZW1lbnQpO1xuXHRcdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJDaGlsZHJlbihleHRFbGVtZW50KTsgLy8gY2xlYXIgY2hpbGRyZW4gY2FjaGVcblx0XHRcdFx0cmV0dXJuIGFzUHJvbWlzZSgoKSA9PiB0aGlzLmRhdGFQcm92aWRlci5nZXRUcmVlSXRlbShleHRFbGVtZW50KSlcblx0XHRcdFx0XHQudGhlbihleHRUcmVlSXRlbSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZXh0VHJlZUl0ZW0pIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbmV3Tm9kZSA9IHRoaXMuY3JlYXRlVHJlZU5vZGUoZXh0RWxlbWVudCwgZXh0VHJlZUl0ZW0sIGV4aXN0aW5nLnBhcmVudCk7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlTm9kZUNhY2hlKGV4dEVsZW1lbnQsIG5ld05vZGUsIGV4aXN0aW5nLCBleGlzdGluZy5wYXJlbnQpO1xuXHRcdFx0XHRcdFx0XHRleGlzdGluZy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBuZXdOb2RlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUFuZFJlZ2lzdGVyVHJlZU5vZGUoZWxlbWVudDogVCwgZXh0VHJlZUl0ZW06IHZzY29kZS5UcmVlSXRlbSwgcGFyZW50Tm9kZTogVHJlZU5vZGUgfCBSb290KTogVHJlZU5vZGUge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLmNyZWF0ZVRyZWVOb2RlKGVsZW1lbnQsIGV4dFRyZWVJdGVtLCBwYXJlbnROb2RlKTtcblx0XHRpZiAoZXh0VHJlZUl0ZW0uaWQgJiYgdGhpcy5lbGVtZW50cy5oYXMobm9kZS5pdGVtLmhhbmRsZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgndHJlZVZpZXcuZHVwbGljYXRlRWxlbWVudCcsICdFbGVtZW50IHdpdGggaWQgezB9IGlzIGFscmVhZHkgcmVnaXN0ZXJlZCcsIGV4dFRyZWVJdGVtLmlkKSk7XG5cdFx0fVxuXHRcdHRoaXMuYWRkTm9kZVRvQ2FjaGUoZWxlbWVudCwgbm9kZSk7XG5cdFx0dGhpcy5hZGROb2RlVG9QYXJlbnRDYWNoZShub2RlLCBwYXJlbnROb2RlKTtcblx0XHRyZXR1cm4gbm9kZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VG9vbHRpcCh0b29sdGlwPzogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nKTogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoZXh0SG9zdFR5cGVzLk1hcmtkb3duU3RyaW5nLmlzTWFya2Rvd25TdHJpbmcodG9vbHRpcCkpIHtcblx0XHRcdHJldHVybiBNYXJrZG93blN0cmluZy5mcm9tKHRvb2x0aXApO1xuXHRcdH1cblx0XHRyZXR1cm4gdG9vbHRpcDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29tbWFuZChkaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmUsIGNvbW1hbmQ/OiB2c2NvZGUuQ29tbWFuZCk6IFRyZWVDb21tYW5kIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gY29tbWFuZCA/IHsgLi4udGhpcy5jb21tYW5kcy50b0ludGVybmFsKGNvbW1hbmQsIGRpc3Bvc2FibGUpLCBvcmlnaW5hbElkOiBjb21tYW5kLmNvbW1hbmQgfSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q2hlY2tib3goZXh0ZW5zaW9uVHJlZUl0ZW06IHZzY29kZS5UcmVlSXRlbSk6IElUcmVlSXRlbUNoZWNrYm94U3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdGlmIChleHRlbnNpb25UcmVlSXRlbS5jaGVja2JveFN0YXRlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGxldCBjaGVja2JveFN0YXRlOiBleHRIb3N0VHlwZXMuVHJlZUl0ZW1DaGVja2JveFN0YXRlO1xuXHRcdGxldCB0b29sdGlwOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbjogSUFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIGV4dGVuc2lvblRyZWVJdGVtLmNoZWNrYm94U3RhdGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRjaGVja2JveFN0YXRlID0gZXh0ZW5zaW9uVHJlZUl0ZW0uY2hlY2tib3hTdGF0ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2hlY2tib3hTdGF0ZSA9IGV4dGVuc2lvblRyZWVJdGVtLmNoZWNrYm94U3RhdGUuc3RhdGU7XG5cdFx0XHR0b29sdGlwID0gZXh0ZW5zaW9uVHJlZUl0ZW0uY2hlY2tib3hTdGF0ZS50b29sdGlwO1xuXHRcdFx0YWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uID0gZXh0ZW5zaW9uVHJlZUl0ZW0uY2hlY2tib3hTdGF0ZS5hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb247XG5cdFx0fVxuXHRcdHJldHVybiB7IGlzQ2hlY2tlZDogY2hlY2tib3hTdGF0ZSA9PT0gZXh0SG9zdFR5cGVzLlRyZWVJdGVtQ2hlY2tib3hTdGF0ZS5DaGVja2VkLCB0b29sdGlwLCBhY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb24gfTtcblx0fVxuXG5cdHByaXZhdGUgdmFsaWRhdGVUcmVlSXRlbShleHRlbnNpb25UcmVlSXRlbTogdnNjb2RlLlRyZWVJdGVtKSB7XG5cdFx0aWYgKCFleHRIb3N0VHlwZXMuVHJlZUl0ZW0uaXNUcmVlSXRlbShleHRlbnNpb25UcmVlSXRlbSwgdGhpcy5leHRlbnNpb24pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEV4dGVuc2lvbiAke3RoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWV9IGhhcyBwcm92aWRlZCBhbiBpbnZhbGlkIHRyZWUgaXRlbS5gKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRyZWVOb2RlKGVsZW1lbnQ6IFQsIGV4dGVuc2lvblRyZWVJdGVtOiB2c2NvZGUuVHJlZUl0ZW0sIHBhcmVudDogVHJlZU5vZGUgfCBSb290KTogVHJlZU5vZGUge1xuXHRcdHRoaXMudmFsaWRhdGVUcmVlSXRlbShleHRlbnNpb25UcmVlSXRlbSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLmNyZWF0ZUhhbmRsZShlbGVtZW50LCBleHRlbnNpb25UcmVlSXRlbSwgcGFyZW50KTtcblx0XHRjb25zdCBpY29uID0gdGhpcy5nZXRMaWdodEljb25QYXRoKGV4dGVuc2lvblRyZWVJdGVtKTtcblx0XHRjb25zdCBpdGVtOiBJVHJlZUl0ZW0gPSB7XG5cdFx0XHRoYW5kbGUsXG5cdFx0XHRwYXJlbnRIYW5kbGU6IHBhcmVudCA/IHBhcmVudC5pdGVtLmhhbmRsZSA6IHVuZGVmaW5lZCxcblx0XHRcdGxhYmVsOiB0b1RyZWVJdGVtTGFiZWwoZXh0ZW5zaW9uVHJlZUl0ZW0ubGFiZWwsIHRoaXMuZXh0ZW5zaW9uKSxcblx0XHRcdGRlc2NyaXB0aW9uOiBleHRlbnNpb25UcmVlSXRlbS5kZXNjcmlwdGlvbixcblx0XHRcdHJlc291cmNlVXJpOiBleHRlbnNpb25UcmVlSXRlbS5yZXNvdXJjZVVyaSxcblx0XHRcdHRvb2x0aXA6IHRoaXMuZ2V0VG9vbHRpcChleHRlbnNpb25UcmVlSXRlbS50b29sdGlwKSxcblx0XHRcdGNvbW1hbmQ6IHRoaXMuZ2V0Q29tbWFuZChkaXNwb3NhYmxlU3RvcmUsIGV4dGVuc2lvblRyZWVJdGVtLmNvbW1hbmQpLFxuXHRcdFx0Y29udGV4dFZhbHVlOiBleHRlbnNpb25UcmVlSXRlbS5jb250ZXh0VmFsdWUsXG5cdFx0XHRpY29uLFxuXHRcdFx0aWNvbkRhcms6IHRoaXMuZ2V0RGFya0ljb25QYXRoKGV4dGVuc2lvblRyZWVJdGVtKSB8fCBpY29uLFxuXHRcdFx0dGhlbWVJY29uOiB0aGlzLmdldFRoZW1lSWNvbihleHRlbnNpb25UcmVlSXRlbSksXG5cdFx0XHRjb2xsYXBzaWJsZVN0YXRlOiBpc1VuZGVmaW5lZE9yTnVsbChleHRlbnNpb25UcmVlSXRlbS5jb2xsYXBzaWJsZVN0YXRlKSA/IGV4dEhvc3RUeXBlcy5UcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUuTm9uZSA6IGV4dGVuc2lvblRyZWVJdGVtLmNvbGxhcHNpYmxlU3RhdGUsXG5cdFx0XHRhY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb246IGV4dGVuc2lvblRyZWVJdGVtLmFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbixcblx0XHRcdGNoZWNrYm94OiB0aGlzLmdldENoZWNrYm94KGV4dGVuc2lvblRyZWVJdGVtKSxcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGl0ZW0sXG5cdFx0XHRleHRlbnNpb25JdGVtOiBleHRlbnNpb25UcmVlSXRlbSxcblx0XHRcdHBhcmVudCxcblx0XHRcdGNoaWxkcmVuOiB1bmRlZmluZWQsXG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUsXG5cdFx0XHRkaXNwb3NlKCk6IHZvaWQgeyBkaXNwb3NhYmxlU3RvcmUuZGlzcG9zZSgpOyB9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VGhlbWVJY29uKGV4dGVuc2lvblRyZWVJdGVtOiB2c2NvZGUuVHJlZUl0ZW0pOiBleHRIb3N0VHlwZXMuVGhlbWVJY29uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gZXh0ZW5zaW9uVHJlZUl0ZW0uaWNvblBhdGggaW5zdGFuY2VvZiBleHRIb3N0VHlwZXMuVGhlbWVJY29uID8gZXh0ZW5zaW9uVHJlZUl0ZW0uaWNvblBhdGggOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUhhbmRsZShlbGVtZW50OiBULCB7IGlkLCBsYWJlbCwgcmVzb3VyY2VVcmkgfTogdnNjb2RlLlRyZWVJdGVtLCBwYXJlbnQ6IFRyZWVOb2RlIHwgUm9vdCwgcmV0dXJuRmlyc3Q/OiBib29sZWFuKTogVHJlZUl0ZW1IYW5kbGUge1xuXHRcdGlmIChpZCkge1xuXHRcdFx0cmV0dXJuIGAke0V4dEhvc3RUcmVlVmlldy5JRF9IQU5ETEVfUFJFRklYfS8ke2lkfWA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdHJlZUl0ZW1MYWJlbCA9IHRvVHJlZUl0ZW1MYWJlbChsYWJlbCwgdGhpcy5leHRlbnNpb24pO1xuXHRcdGNvbnN0IHByZWZpeDogc3RyaW5nID0gcGFyZW50ID8gcGFyZW50Lml0ZW0uaGFuZGxlIDogRXh0SG9zdFRyZWVWaWV3LkxBQkVMX0hBTkRMRV9QUkVGSVg7XG5cdFx0bGV0IGVsZW1lbnRJZCA9IHRyZWVJdGVtTGFiZWwgPyB0cmVlSXRlbUxhYmVsLmxhYmVsIDogcmVzb3VyY2VVcmkgPyBiYXNlbmFtZShyZXNvdXJjZVVyaSkgOiAnJztcblx0XHRlbGVtZW50SWQgPSBlbGVtZW50SWQuaW5kZXhPZignLycpICE9PSAtMSA/IGVsZW1lbnRJZC5yZXBsYWNlKCcvJywgJy8vJykgOiBlbGVtZW50SWQ7XG5cdFx0Y29uc3QgZXhpc3RpbmdIYW5kbGUgPSB0aGlzLm5vZGVzLmhhcyhlbGVtZW50KSA/IHRoaXMubm9kZXMuZ2V0KGVsZW1lbnQpIS5pdGVtLmhhbmRsZSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBjaGlsZHJlbk5vZGVzID0gKHRoaXMuZ2V0Q2hpbGRyZW5Ob2RlcyhwYXJlbnQpIHx8IFtdKTtcblxuXHRcdGxldCBoYW5kbGU6IFRyZWVJdGVtSGFuZGxlO1xuXHRcdGxldCBjb3VudGVyID0gMDtcblx0XHRkbyB7XG5cdFx0XHRoYW5kbGUgPSBgJHtwcmVmaXh9LyR7Y291bnRlcn06JHtlbGVtZW50SWR9YDtcblx0XHRcdGlmIChyZXR1cm5GaXJzdCB8fCAhdGhpcy5lbGVtZW50cy5oYXMoaGFuZGxlKSB8fCBleGlzdGluZ0hhbmRsZSA9PT0gaGFuZGxlKSB7XG5cdFx0XHRcdC8vIFJldHVybiBmaXJzdCBpZiBhc2tlZCBmb3Igb3Jcblx0XHRcdFx0Ly8gUmV0dXJuIGlmIGhhbmRsZSBkb2VzIG5vdCBleGlzdCBvclxuXHRcdFx0XHQvLyBSZXR1cm4gaWYgaGFuZGxlIGlzIGJlaW5nIHJldXNlZFxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNvdW50ZXIrKztcblx0XHR9IHdoaWxlIChjb3VudGVyIDw9IGNoaWxkcmVuTm9kZXMubGVuZ3RoKTtcblxuXHRcdHJldHVybiBoYW5kbGU7XG5cdH1cblxuXHRwcml2YXRlIGdldExpZ2h0SWNvblBhdGgoZXh0ZW5zaW9uVHJlZUl0ZW06IHZzY29kZS5UcmVlSXRlbSk6IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGV4dGVuc2lvblRyZWVJdGVtLmljb25QYXRoICYmICEoZXh0ZW5zaW9uVHJlZUl0ZW0uaWNvblBhdGggaW5zdGFuY2VvZiBleHRIb3N0VHlwZXMuVGhlbWVJY29uKSkge1xuXHRcdFx0aWYgKHR5cGVvZiBleHRlbnNpb25UcmVlSXRlbS5pY29uUGF0aCA9PT0gJ3N0cmluZydcblx0XHRcdFx0fHwgVVJJLmlzVXJpKGV4dGVuc2lvblRyZWVJdGVtLmljb25QYXRoKSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRJY29uUGF0aChleHRlbnNpb25UcmVlSXRlbS5pY29uUGF0aCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRJY29uUGF0aCgoPHsgbGlnaHQ6IHN0cmluZyB8IFVSSTsgZGFyazogc3RyaW5nIHwgVVJJIH0+ZXh0ZW5zaW9uVHJlZUl0ZW0uaWNvblBhdGgpLmxpZ2h0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGFya0ljb25QYXRoKGV4dGVuc2lvblRyZWVJdGVtOiB2c2NvZGUuVHJlZUl0ZW0pOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdGlmIChleHRlbnNpb25UcmVlSXRlbS5pY29uUGF0aCAmJiAhKGV4dGVuc2lvblRyZWVJdGVtLmljb25QYXRoIGluc3RhbmNlb2YgZXh0SG9zdFR5cGVzLlRoZW1lSWNvbikgJiYgKDx7IGxpZ2h0OiBzdHJpbmcgfCBVUkk7IGRhcms6IHN0cmluZyB8IFVSSSB9PmV4dGVuc2lvblRyZWVJdGVtLmljb25QYXRoKS5kYXJrKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRJY29uUGF0aCgoPHsgbGlnaHQ6IHN0cmluZyB8IFVSSTsgZGFyazogc3RyaW5nIHwgVVJJIH0+ZXh0ZW5zaW9uVHJlZUl0ZW0uaWNvblBhdGgpLmRhcmspO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRJY29uUGF0aChpY29uUGF0aDogc3RyaW5nIHwgVVJJKTogVVJJIHtcblx0XHRpZiAoVVJJLmlzVXJpKGljb25QYXRoKSkge1xuXHRcdFx0cmV0dXJuIGljb25QYXRoO1xuXHRcdH1cblx0XHRyZXR1cm4gVVJJLmZpbGUoaWNvblBhdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGROb2RlVG9DYWNoZShlbGVtZW50OiBULCBub2RlOiBUcmVlTm9kZSk6IHZvaWQge1xuXHRcdHRoaXMuZWxlbWVudHMuc2V0KG5vZGUuaXRlbS5oYW5kbGUsIGVsZW1lbnQpO1xuXHRcdHRoaXMubm9kZXMuc2V0KGVsZW1lbnQsIG5vZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVOb2RlQ2FjaGUoZWxlbWVudDogVCwgbmV3Tm9kZTogVHJlZU5vZGUsIGV4aXN0aW5nOiBUcmVlTm9kZSwgcGFyZW50Tm9kZTogVHJlZU5vZGUgfCBSb290KTogdm9pZCB7XG5cdFx0Ly8gUmVtb3ZlIGZyb20gdGhlIGNhY2hlXG5cdFx0dGhpcy5lbGVtZW50cy5kZWxldGUobmV3Tm9kZS5pdGVtLmhhbmRsZSk7XG5cdFx0dGhpcy5ub2Rlcy5kZWxldGUoZWxlbWVudCk7XG5cdFx0aWYgKG5ld05vZGUuaXRlbS5oYW5kbGUgIT09IGV4aXN0aW5nLml0ZW0uaGFuZGxlKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnRzLmRlbGV0ZShleGlzdGluZy5pdGVtLmhhbmRsZSk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIHRoZSBuZXcgbm9kZSB0byB0aGUgY2FjaGVcblx0XHR0aGlzLmFkZE5vZGVUb0NhY2hlKGVsZW1lbnQsIG5ld05vZGUpO1xuXG5cdFx0Ly8gUmVwbGFjZSB0aGUgbm9kZSBpbiBwYXJlbnQncyBjaGlsZHJlbiBub2Rlc1xuXHRcdGNvbnN0IGNoaWxkcmVuTm9kZXMgPSAodGhpcy5nZXRDaGlsZHJlbk5vZGVzKHBhcmVudE5vZGUpIHx8IFtdKTtcblx0XHRjb25zdCBjaGlsZE5vZGUgPSBjaGlsZHJlbk5vZGVzLmZpbHRlcihjID0+IGMuaXRlbS5oYW5kbGUgPT09IGV4aXN0aW5nLml0ZW0uaGFuZGxlKVswXTtcblx0XHRpZiAoY2hpbGROb2RlKSB7XG5cdFx0XHRjaGlsZHJlbk5vZGVzLnNwbGljZShjaGlsZHJlbk5vZGVzLmluZGV4T2YoY2hpbGROb2RlKSwgMSwgbmV3Tm9kZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhZGROb2RlVG9QYXJlbnRDYWNoZShub2RlOiBUcmVlTm9kZSwgcGFyZW50Tm9kZTogVHJlZU5vZGUgfCBSb290KTogdm9pZCB7XG5cdFx0aWYgKHBhcmVudE5vZGUpIHtcblx0XHRcdGlmICghcGFyZW50Tm9kZS5jaGlsZHJlbikge1xuXHRcdFx0XHRwYXJlbnROb2RlLmNoaWxkcmVuID0gW107XG5cdFx0XHR9XG5cdFx0XHRwYXJlbnROb2RlLmNoaWxkcmVuLnB1c2gobm9kZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghdGhpcy5yb290cykge1xuXHRcdFx0XHR0aGlzLnJvb3RzID0gW107XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJvb3RzLnB1c2gobm9kZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckNoaWxkcmVuKHBhcmVudEVsZW1lbnQ/OiBUKTogdm9pZCB7XG5cdFx0aWYgKHBhcmVudEVsZW1lbnQpIHtcblx0XHRcdGNvbnN0IG5vZGUgPSB0aGlzLm5vZGVzLmdldChwYXJlbnRFbGVtZW50KTtcblx0XHRcdGlmIChub2RlKSB7XG5cdFx0XHRcdGlmIChub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjaGlsZEVsZW1lbnQgPSB0aGlzLmVsZW1lbnRzLmdldChjaGlsZC5pdGVtLmhhbmRsZSk7XG5cdFx0XHRcdFx0XHRpZiAoY2hpbGRFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuY2xlYXIoY2hpbGRFbGVtZW50KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0bm9kZS5jaGlsZHJlbiA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jbGVhckFsbCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2xlYXIoZWxlbWVudDogVCk6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLm5vZGVzLmdldChlbGVtZW50KTtcblx0XHRpZiAobm9kZSkge1xuXHRcdFx0aWYgKG5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hpbGRFbGVtZW50ID0gdGhpcy5lbGVtZW50cy5nZXQoY2hpbGQuaXRlbS5oYW5kbGUpO1xuXHRcdFx0XHRcdGlmIChjaGlsZEVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdHRoaXMuY2xlYXIoY2hpbGRFbGVtZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMubm9kZXMuZGVsZXRlKGVsZW1lbnQpO1xuXHRcdFx0dGhpcy5lbGVtZW50cy5kZWxldGUobm9kZS5pdGVtLmhhbmRsZSk7XG5cdFx0XHRub2RlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyQWxsKCk6IHZvaWQge1xuXHRcdHRoaXMucm9vdHMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5lbGVtZW50cy5jbGVhcigpO1xuXHRcdHRoaXMubm9kZXMuZm9yRWFjaChub2RlID0+IG5vZGUuZGlzcG9zZSgpKTtcblx0XHR0aGlzLm5vZGVzLmNsZWFyKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9yZWZyZXNoQ2FuY2VsbGF0aW9uU291cmNlLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuY2xlYXJBbGwoKTtcblx0XHR0aGlzLnByb3h5LiRkaXNwb3NlVHJlZSh0aGlzLnZpZXdJZCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsV0FBVztBQUNwQixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVksdUJBQW9DO0FBRXpELFNBQXVJLHVCQUF1QjtBQUU5SixTQUFTLGlCQUFpQjtBQUMxQixZQUFZLGtCQUFrQjtBQUM5QixTQUFTLG1CQUFtQixnQkFBZ0I7QUFDNUMsU0FBUyxRQUFRLGdCQUFnQjtBQUdqQyxTQUFTLGdCQUFnQixXQUFXLG9CQUFvQjtBQUN4RCxTQUEwQix3QkFBd0I7QUFDbEQsU0FBNEIsK0JBQStCO0FBQzNELFNBQStCLDJCQUEyQjtBQUUxRCxTQUFTLCtCQUErQjtBQUl4QyxTQUFTLGdCQUFnQixPQUFZLFdBQThEO0FBQ2xHLE1BQUksU0FBUyxLQUFLLEdBQUc7QUFD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QSxJQUNsRTtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHFCQUFxQixNQUFnQixZQUFtQztBQUMvRSxRQUFJLFlBQVk7QUFDZixVQUFJLENBQUMsV0FBVyxVQUFVO0FBQ3pCLG1CQUFXLFdBQVcsQ0FBQztBQUFBLE1BQ3hCO0FBQ0EsaUJBQVcsU0FBUyxLQUFLLElBQUk7QUFBQSxJQUM5QixPQUFPO0FBQ04sVUFBSSxDQUFDLEtBQUssT0FBTztBQUNoQixhQUFLLFFBQVEsQ0FBQztBQUFBLE1BQ2Y7QUFDQSxXQUFLLE1BQU0sS0FBSyxJQUFJO0FBQUEsSUFDckI7QUFBQSxFQUNEO0FBQUEsRUFFUSxjQUFjLGVBQXlCO0FBQzlDLFFBQUksZUFBZTtBQUNsQixZQUFNLE9BQU8sS0FBSyxNQUFNLElBQUksYUFBYTtBQUN6QyxVQUFJLE1BQU07QUFDVCxZQUFJLEtBQUssVUFBVTtBQUNsQixxQkFBVyxTQUFTLEtBQUssVUFBVTtBQUNsQyxrQkFBTSxlQUFlLEtBQUssU0FBUyxJQUFJLE1BQU0sS0FBSyxNQUFNO0FBQ3hELGdCQUFJLGNBQWM7QUFDakIsbUJBQUssTUFBTSxZQUFZO0FBQUEsWUFDeEI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUNBLGFBQUssV0FBVztBQUFBLE1BQ2pCO0FBQUEsSUFDRCxPQUFPO0FBQ04sV0FBSyxTQUFTO0FBQUEsSUFDZjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLE1BQU0sU0FBa0I7QUFDL0IsVUFBTSxPQUFPLEtBQUssTUFBTSxJQUFJLE9BQU87QUFDbkMsUUFBSSxNQUFNO0FBQ1QsVUFBSSxLQUFLLFVBQVU7QUFDbEIsbUJBQVcsU0FBUyxLQUFLLFVBQVU7QUFDbEMsZ0JBQU0sZUFBZSxLQUFLLFNBQVMsSUFBSSxNQUFNLEtBQUssTUFBTTtBQUN4RCxjQUFJLGNBQWM7QUFDakIsaUJBQUssTUFBTSxZQUFZO0FBQUEsVUFDeEI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUNBLFdBQUssTUFBTSxPQUFPLE9BQU87QUFDekIsV0FBSyxTQUFTLE9BQU8sS0FBSyxLQUFLLE1BQU07QUFDckMsV0FBSyxRQUFRO0FBQUEsSUFDZDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLFdBQWlCO0FBQ3hCLFNBQUssUUFBUTtBQUNiLFNBQUssU0FBUyxNQUFNO0FBQ3BCLFNBQUssTUFBTSxRQUFRLFVBQVEsS0FBSyxRQUFRLENBQUM7QUFDekMsU0FBSyxNQUFNLE1BQU07QUFBQSxFQUNsQjtBQUFBLEVBRVMsVUFBVTtBQUNsQixVQUFNLFFBQVE7QUFDZCxTQUFLLDJCQUEyQixRQUFRO0FBRXhDLFNBQUssU0FBUztBQUNkLFNBQUssTUFBTSxhQUFhLEtBQUssTUFBTTtBQUFBLEVBQ3BDO0FBQ0Q7QUF2ckJNLGlCQUVtQixzQkFBc0I7QUFGekMsaUJBR21CLG1CQUFtQjtBQUg1QyxJQUFNLGtCQUFOOyIsCiAgIm5hbWVzIjogWyJvcHRpb25zIiwgIm5vZGUiXQp9Cg==
