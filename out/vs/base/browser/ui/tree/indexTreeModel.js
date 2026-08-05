import { TreeError, TreeVisibility } from "./tree.js";
import { splice, tail } from "../../../common/arrays.js";
import { Delayer } from "../../../common/async.js";
import { MicrotaskDelay } from "../../../common/symbols.js";
import { LcsDiff } from "../../../common/diff/diff.js";
import { Emitter, EventBufferer } from "../../../common/event.js";
import { Iterable } from "../../../common/iterator.js";
function isFilterResult(obj) {
  return typeof obj === "object" && "visibility" in obj && "data" in obj;
}
function getVisibleState(visibility) {
  switch (visibility) {
    case true:
      return TreeVisibility.Visible;
    case false:
      return TreeVisibility.Hidden;
    default:
      return visibility;
  }
}
function isCollapsibleStateUpdate(update) {
  return typeof update.collapsible === "boolean";
}
class IndexTreeModel {
  constructor(user, rootElement, options = {}) {
    this.user = user;
    this.rootRef = [];
    this.eventBufferer = new EventBufferer();
    this._onDidSpliceModel = new Emitter();
    this.onDidSpliceModel = this._onDidSpliceModel.event;
    this._onDidSpliceRenderedNodes = new Emitter();
    this.onDidSpliceRenderedNodes = this._onDidSpliceRenderedNodes.event;
    this._onDidChangeCollapseState = new Emitter();
    this.onDidChangeCollapseState = this.eventBufferer.wrapEvent(this._onDidChangeCollapseState.event);
    this._onDidChangeRenderNodeCount = new Emitter();
    this.onDidChangeRenderNodeCount = this.eventBufferer.wrapEvent(this._onDidChangeRenderNodeCount.event);
    this.refilterDelayer = new Delayer(MicrotaskDelay);
    this.collapseByDefault = typeof options.collapseByDefault === "undefined" ? false : options.collapseByDefault;
    this.allowNonCollapsibleParents = options.allowNonCollapsibleParents ?? false;
    this.filter = options.filter;
    this.autoExpandSingleChildren = typeof options.autoExpandSingleChildren === "undefined" ? false : options.autoExpandSingleChildren;
    this.root = {
      parent: void 0,
      element: rootElement,
      children: [],
      depth: 0,
      visibleChildrenCount: 0,
      visibleChildIndex: -1,
      collapsible: false,
      collapsed: false,
      renderNodeCount: 0,
      visibility: TreeVisibility.Visible,
      visible: true,
      filterData: void 0
    };
  }
  splice(location, deleteCount, toInsert = Iterable.empty(), options = {}) {
    if (location.length === 0) {
      throw new TreeError(this.user, "Invalid tree location");
    }
    if (options.diffIdentityProvider) {
      this.spliceSmart(options.diffIdentityProvider, location, deleteCount, toInsert, options);
    } else {
      this.spliceSimple(location, deleteCount, toInsert, options);
    }
  }
  spliceSmart(identity, location, deleteCount, toInsertIterable = Iterable.empty(), options, recurseLevels = options.diffDepth ?? 0) {
    const { parentNode } = this.getParentNodeWithListIndex(location);
    if (!parentNode.lastDiffIds) {
      return this.spliceSimple(location, deleteCount, toInsertIterable, options);
    }
    const toInsert = [...toInsertIterable];
    const index = location[location.length - 1];
    const diff = new LcsDiff(
      { getElements: () => parentNode.lastDiffIds },
      {
        getElements: () => [
          ...parentNode.children.slice(0, index),
          ...toInsert,
          ...parentNode.children.slice(index + deleteCount)
        ].map((e) => identity.getId(e.element).toString())
      }
    ).ComputeDiff(false);
    if (diff.quitEarly) {
      parentNode.lastDiffIds = void 0;
      return this.spliceSimple(location, deleteCount, toInsert, options);
    }
    const locationPrefix = location.slice(0, -1);
    const recurseSplice = (fromOriginal, fromModified, count) => {
      if (recurseLevels > 0) {
        for (let i = 0; i < count; i++) {
          fromOriginal--;
          fromModified--;
          this.spliceSmart(
            identity,
            [...locationPrefix, fromOriginal, 0],
            Number.MAX_SAFE_INTEGER,
            toInsert[fromModified].children,
            options,
            recurseLevels - 1
          );
        }
      }
    };
    let lastStartO = Math.min(parentNode.children.length, index + deleteCount);
    let lastStartM = toInsert.length;
    for (const change of diff.changes.sort((a, b) => b.originalStart - a.originalStart)) {
      recurseSplice(lastStartO, lastStartM, lastStartO - (change.originalStart + change.originalLength));
      lastStartO = change.originalStart;
      lastStartM = change.modifiedStart - index;
      this.spliceSimple(
        [...locationPrefix, lastStartO],
        change.originalLength,
        Iterable.slice(toInsert, lastStartM, lastStartM + change.modifiedLength),
        options
      );
    }
    recurseSplice(lastStartO, lastStartM, lastStartO);
  }
  spliceSimple(location, deleteCount, toInsert = Iterable.empty(), { onDidCreateNode, onDidDeleteNode, diffIdentityProvider }) {
    const { parentNode, listIndex, revealed, visible } = this.getParentNodeWithListIndex(location);
    const treeListElementsToInsert = [];
    const nodesToInsertIterator = Iterable.map(toInsert, (el) => this.createTreeNode(el, parentNode, parentNode.visible ? TreeVisibility.Visible : TreeVisibility.Hidden, revealed, treeListElementsToInsert, onDidCreateNode));
    const lastIndex = location[location.length - 1];
    let visibleChildStartIndex = 0;
    for (let i = lastIndex; i >= 0 && i < parentNode.children.length; i--) {
      const child = parentNode.children[i];
      if (child.visible) {
        visibleChildStartIndex = child.visibleChildIndex;
        break;
      }
    }
    const nodesToInsert = [];
    let insertedVisibleChildrenCount = 0;
    let renderNodeCount = 0;
    for (const child of nodesToInsertIterator) {
      nodesToInsert.push(child);
      renderNodeCount += child.renderNodeCount;
      if (child.visible) {
        child.visibleChildIndex = visibleChildStartIndex + insertedVisibleChildrenCount++;
      }
    }
    const deletedNodes = splice(parentNode.children, lastIndex, deleteCount, nodesToInsert);
    if (!diffIdentityProvider) {
      parentNode.lastDiffIds = void 0;
    } else if (parentNode.lastDiffIds) {
      splice(parentNode.lastDiffIds, lastIndex, deleteCount, nodesToInsert.map((n) => diffIdentityProvider.getId(n.element).toString()));
    } else {
      parentNode.lastDiffIds = parentNode.children.map((n) => diffIdentityProvider.getId(n.element).toString());
    }
    let deletedVisibleChildrenCount = 0;
    for (const child of deletedNodes) {
      if (child.visible) {
        deletedVisibleChildrenCount++;
      }
    }
    if (deletedVisibleChildrenCount !== 0) {
      for (let i = lastIndex + nodesToInsert.length; i < parentNode.children.length; i++) {
        const child = parentNode.children[i];
        if (child.visible) {
          child.visibleChildIndex -= deletedVisibleChildrenCount;
        }
      }
    }
    parentNode.visibleChildrenCount += insertedVisibleChildrenCount - deletedVisibleChildrenCount;
    if (deletedNodes.length > 0 && onDidDeleteNode) {
      const visit = (node2) => {
        onDidDeleteNode(node2);
        node2.children.forEach(visit);
      };
      deletedNodes.forEach(visit);
    }
    if (revealed && visible) {
      const visibleDeleteCount = deletedNodes.reduce((r, node2) => r + (node2.visible ? node2.renderNodeCount : 0), 0);
      this._updateAncestorsRenderNodeCount(parentNode, renderNodeCount - visibleDeleteCount);
      this._onDidSpliceRenderedNodes.fire({ start: listIndex, deleteCount: visibleDeleteCount, elements: treeListElementsToInsert });
    }
    this._onDidSpliceModel.fire({ insertedNodes: nodesToInsert, deletedNodes });
    let node = parentNode;
    while (node) {
      if (node.visibility === TreeVisibility.Recurse) {
        this.refilterDelayer.trigger(() => this.refilter());
        break;
      }
      node = node.parent;
    }
  }
  rerender(location) {
    if (location.length === 0) {
      throw new TreeError(this.user, "Invalid tree location");
    }
    const { node, listIndex, revealed } = this.getTreeNodeWithListIndex(location);
    if (node.visible && revealed) {
      this._onDidSpliceRenderedNodes.fire({ start: listIndex, deleteCount: 1, elements: [node] });
    }
  }
  has(location) {
    return this.hasTreeNode(location);
  }
  getListIndex(location) {
    const { listIndex, visible, revealed } = this.getTreeNodeWithListIndex(location);
    return visible && revealed ? listIndex : -1;
  }
  getListRenderCount(location) {
    return this.getTreeNode(location).renderNodeCount;
  }
  isCollapsible(location) {
    return this.getTreeNode(location).collapsible;
  }
  setCollapsible(location, collapsible) {
    const node = this.getTreeNode(location);
    if (typeof collapsible === "undefined") {
      collapsible = !node.collapsible;
    }
    const update = { collapsible };
    return this.eventBufferer.bufferEvents(() => this._setCollapseState(location, update));
  }
  isCollapsed(location) {
    return this.getTreeNode(location).collapsed;
  }
  setCollapsed(location, collapsed, recursive) {
    const node = this.getTreeNode(location);
    if (typeof collapsed === "undefined") {
      collapsed = !node.collapsed;
    }
    const update = { collapsed, recursive: recursive || false };
    return this.eventBufferer.bufferEvents(() => this._setCollapseState(location, update));
  }
  _setCollapseState(location, update) {
    const { node, listIndex, revealed } = this.getTreeNodeWithListIndex(location);
    const result = this._setListNodeCollapseState(node, listIndex, revealed, update);
    if (node !== this.root && this.autoExpandSingleChildren && result && !isCollapsibleStateUpdate(update) && node.collapsible && !node.collapsed && !update.recursive) {
      let onlyVisibleChildIndex = -1;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.visible) {
          if (onlyVisibleChildIndex > -1) {
            onlyVisibleChildIndex = -1;
            break;
          } else {
            onlyVisibleChildIndex = i;
          }
        }
      }
      if (onlyVisibleChildIndex > -1) {
        this._setCollapseState([...location, onlyVisibleChildIndex], update);
      }
    }
    return result;
  }
  _setListNodeCollapseState(node, listIndex, revealed, update) {
    const result = this._setNodeCollapseState(node, update, false);
    if (!revealed || !node.visible || !result) {
      return result;
    }
    const previousRenderNodeCount = node.renderNodeCount;
    const toInsert = this.updateNodeAfterCollapseChange(node);
    const deleteCount = previousRenderNodeCount - (listIndex === -1 ? 0 : 1);
    this._onDidSpliceRenderedNodes.fire({ start: listIndex + 1, deleteCount, elements: toInsert.slice(1) });
    return result;
  }
  _setNodeCollapseState(node, update, deep) {
    let result;
    if (node === this.root) {
      result = false;
    } else {
      if (isCollapsibleStateUpdate(update)) {
        result = node.collapsible !== update.collapsible;
        node.collapsible = update.collapsible;
      } else if (!node.collapsible) {
        result = false;
      } else {
        result = node.collapsed !== update.collapsed;
        node.collapsed = update.collapsed;
      }
      if (result) {
        this._onDidChangeCollapseState.fire({ node, deep });
      }
    }
    if (!isCollapsibleStateUpdate(update) && update.recursive) {
      for (const child of node.children) {
        result = this._setNodeCollapseState(child, update, true) || result;
      }
    }
    return result;
  }
  expandTo(location) {
    this.eventBufferer.bufferEvents(() => {
      let node = this.getTreeNode(location);
      while (node.parent) {
        node = node.parent;
        location = location.slice(0, location.length - 1);
        if (node.collapsed) {
          this._setCollapseState(location, { collapsed: false, recursive: false });
        }
      }
    });
  }
  refilter() {
    const previousRenderNodeCount = this.root.renderNodeCount;
    const toInsert = this.updateNodeAfterFilterChange(this.root);
    this._onDidSpliceRenderedNodes.fire({ start: 0, deleteCount: previousRenderNodeCount, elements: toInsert });
    this.refilterDelayer.cancel();
  }
  createTreeNode(treeElement, parent, parentVisibility, revealed, treeListElements, onDidCreateNode) {
    const node = {
      parent,
      element: treeElement.element,
      children: [],
      depth: parent.depth + 1,
      visibleChildrenCount: 0,
      visibleChildIndex: -1,
      collapsible: typeof treeElement.collapsible === "boolean" ? treeElement.collapsible : typeof treeElement.collapsed !== "undefined",
      collapsed: typeof treeElement.collapsed === "undefined" ? this.collapseByDefault : treeElement.collapsed,
      renderNodeCount: 1,
      visibility: TreeVisibility.Visible,
      visible: true,
      filterData: void 0
    };
    const visibility = this._filterNode(node, parentVisibility);
    node.visibility = visibility;
    if (revealed) {
      treeListElements.push(node);
    }
    const childElements = treeElement.children || Iterable.empty();
    const childRevealed = revealed && visibility !== TreeVisibility.Hidden && !node.collapsed;
    let visibleChildrenCount = 0;
    let renderNodeCount = 1;
    for (const el of childElements) {
      const child = this.createTreeNode(el, node, visibility, childRevealed, treeListElements, onDidCreateNode);
      node.children.push(child);
      renderNodeCount += child.renderNodeCount;
      if (child.visible) {
        child.visibleChildIndex = visibleChildrenCount++;
      }
    }
    if (!this.allowNonCollapsibleParents) {
      node.collapsible = node.collapsible || node.children.length > 0;
    }
    node.visibleChildrenCount = visibleChildrenCount;
    node.visible = visibility === TreeVisibility.Recurse ? visibleChildrenCount > 0 : visibility === TreeVisibility.Visible;
    if (!node.visible) {
      node.renderNodeCount = 0;
      if (revealed) {
        treeListElements.pop();
      }
    } else if (!node.collapsed) {
      node.renderNodeCount = renderNodeCount;
    }
    onDidCreateNode?.(node);
    return node;
  }
  updateNodeAfterCollapseChange(node) {
    const previousRenderNodeCount = node.renderNodeCount;
    const result = [];
    this._updateNodeAfterCollapseChange(node, result);
    this._updateAncestorsRenderNodeCount(node.parent, result.length - previousRenderNodeCount);
    return result;
  }
  _updateNodeAfterCollapseChange(node, result) {
    if (node.visible === false) {
      return 0;
    }
    result.push(node);
    node.renderNodeCount = 1;
    if (!node.collapsed) {
      for (const child of node.children) {
        node.renderNodeCount += this._updateNodeAfterCollapseChange(child, result);
      }
    }
    this._onDidChangeRenderNodeCount.fire(node);
    return node.renderNodeCount;
  }
  updateNodeAfterFilterChange(node) {
    const previousRenderNodeCount = node.renderNodeCount;
    const result = [];
    this._updateNodeAfterFilterChange(node, node.visible ? TreeVisibility.Visible : TreeVisibility.Hidden, result);
    this._updateAncestorsRenderNodeCount(node.parent, result.length - previousRenderNodeCount);
    return result;
  }
  _updateNodeAfterFilterChange(node, parentVisibility, result, revealed = true) {
    let visibility;
    if (node !== this.root) {
      visibility = this._filterNode(node, parentVisibility);
      if (visibility === TreeVisibility.Hidden) {
        node.visible = false;
        node.renderNodeCount = 0;
        return false;
      }
      if (revealed) {
        result.push(node);
      }
    }
    const resultStartLength = result.length;
    node.renderNodeCount = node === this.root ? 0 : 1;
    let hasVisibleDescendants = false;
    if (!node.collapsed || visibility !== TreeVisibility.Hidden) {
      let visibleChildIndex = 0;
      for (const child of node.children) {
        hasVisibleDescendants = this._updateNodeAfterFilterChange(child, visibility, result, revealed && !node.collapsed) || hasVisibleDescendants;
        if (child.visible) {
          child.visibleChildIndex = visibleChildIndex++;
        }
      }
      node.visibleChildrenCount = visibleChildIndex;
    } else {
      node.visibleChildrenCount = 0;
    }
    if (node !== this.root) {
      node.visible = visibility === TreeVisibility.Recurse ? hasVisibleDescendants : visibility === TreeVisibility.Visible;
      node.visibility = visibility;
    }
    if (!node.visible) {
      node.renderNodeCount = 0;
      if (revealed) {
        result.pop();
      }
    } else if (!node.collapsed) {
      node.renderNodeCount += result.length - resultStartLength;
    }
    this._onDidChangeRenderNodeCount.fire(node);
    return node.visible;
  }
  _updateAncestorsRenderNodeCount(node, diff) {
    if (diff === 0) {
      return;
    }
    while (node) {
      node.renderNodeCount += diff;
      this._onDidChangeRenderNodeCount.fire(node);
      node = node.parent;
    }
  }
  _filterNode(node, parentVisibility) {
    const result = this.filter ? this.filter.filter(node.element, parentVisibility) : TreeVisibility.Visible;
    if (typeof result === "boolean") {
      node.filterData = void 0;
      return result ? TreeVisibility.Visible : TreeVisibility.Hidden;
    } else if (isFilterResult(result)) {
      node.filterData = result.data;
      return getVisibleState(result.visibility);
    } else {
      node.filterData = void 0;
      return getVisibleState(result);
    }
  }
  // cheap
  hasTreeNode(location, node = this.root) {
    if (!location || location.length === 0) {
      return true;
    }
    const [index, ...rest] = location;
    if (index < 0 || index > node.children.length) {
      return false;
    }
    return this.hasTreeNode(rest, node.children[index]);
  }
  // cheap
  getTreeNode(location, node = this.root) {
    if (!location || location.length === 0) {
      return node;
    }
    const [index, ...rest] = location;
    if (index < 0 || index > node.children.length) {
      throw new TreeError(this.user, "Invalid tree location");
    }
    return this.getTreeNode(rest, node.children[index]);
  }
  // expensive
  getTreeNodeWithListIndex(location) {
    if (location.length === 0) {
      return { node: this.root, listIndex: -1, revealed: true, visible: false };
    }
    const { parentNode, listIndex, revealed, visible } = this.getParentNodeWithListIndex(location);
    const index = location[location.length - 1];
    if (index < 0 || index > parentNode.children.length) {
      throw new TreeError(this.user, "Invalid tree location");
    }
    const node = parentNode.children[index];
    return { node, listIndex, revealed, visible: visible && node.visible };
  }
  getParentNodeWithListIndex(location, node = this.root, listIndex = 0, revealed = true, visible = true) {
    const [index, ...rest] = location;
    if (index < 0 || index > node.children.length) {
      throw new TreeError(this.user, "Invalid tree location");
    }
    for (let i = 0; i < index; i++) {
      listIndex += node.children[i].renderNodeCount;
    }
    revealed = revealed && !node.collapsed;
    visible = visible && node.visible;
    if (rest.length === 0) {
      return { parentNode: node, listIndex, revealed, visible };
    }
    return this.getParentNodeWithListIndex(rest, node.children[index], listIndex + 1, revealed, visible);
  }
  getNode(location = []) {
    return this.getTreeNode(location);
  }
  // TODO@joao perf!
  getNodeLocation(node) {
    const location = [];
    let indexTreeNode = node;
    while (indexTreeNode.parent) {
      location.push(indexTreeNode.parent.children.indexOf(indexTreeNode));
      indexTreeNode = indexTreeNode.parent;
    }
    return location.reverse();
  }
  getParentNodeLocation(location) {
    if (location.length === 0) {
      return void 0;
    } else if (location.length === 1) {
      return [];
    } else {
      return tail(location)[0];
    }
  }
  getFirstElementChild(location) {
    const node = this.getTreeNode(location);
    if (node.children.length === 0) {
      return void 0;
    }
    return node.children[0].element;
  }
  getLastElementAncestor(location = []) {
    const node = this.getTreeNode(location);
    if (node.children.length === 0) {
      return void 0;
    }
    return this._getLastElementAncestor(node);
  }
  _getLastElementAncestor(node) {
    if (node.children.length === 0) {
      return node.element;
    }
    return this._getLastElementAncestor(node.children[node.children.length - 1]);
  }
}
export {
  IndexTreeModel,
  getVisibleState,
  isFilterResult
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9pbmRleFRyZWVNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElDb2xsYXBzZVN0YXRlQ2hhbmdlRXZlbnQsIElUcmVlRWxlbWVudCwgSVRyZWVGaWx0ZXIsIElUcmVlRmlsdGVyRGF0YVJlc3VsdCwgSVRyZWVMaXN0U3BsaWNlRGF0YSwgSVRyZWVNb2RlbCwgSVRyZWVNb2RlbFNwbGljZUV2ZW50LCBJVHJlZU5vZGUsIFRyZWVFcnJvciwgVHJlZVZpc2liaWxpdHkgfSBmcm9tICcuL3RyZWUuanMnO1xuaW1wb3J0IHsgc3BsaWNlLCB0YWlsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IE1pY3JvdGFza0RlbGF5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3N5bWJvbHMuanMnO1xuaW1wb3J0IHsgTGNzRGlmZiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9kaWZmL2RpZmYuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQsIEV2ZW50QnVmZmVyZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vaXRlcmF0b3IuanMnO1xuXG4vLyBFeHBvcnRlZCBmb3IgdGVzdHNcbmV4cG9ydCBpbnRlcmZhY2UgSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGEgPSB2b2lkPiBleHRlbmRzIElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4ge1xuXHRyZWFkb25seSBwYXJlbnQ6IElJbmRleFRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgY2hpbGRyZW46IElJbmRleFRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdO1xuXHR2aXNpYmxlQ2hpbGRyZW5Db3VudDogbnVtYmVyO1xuXHR2aXNpYmxlQ2hpbGRJbmRleDogbnVtYmVyO1xuXHRjb2xsYXBzaWJsZTogYm9vbGVhbjtcblx0Y29sbGFwc2VkOiBib29sZWFuO1xuXHRyZW5kZXJOb2RlQ291bnQ6IG51bWJlcjtcblx0dmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHk7XG5cdHZpc2libGU6IGJvb2xlYW47XG5cdGZpbHRlckRhdGE6IFRGaWx0ZXJEYXRhIHwgdW5kZWZpbmVkO1xuXHRsYXN0RGlmZklkcz86IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNGaWx0ZXJSZXN1bHQ8VD4ob2JqOiBhbnkpOiBvYmogaXMgSVRyZWVGaWx0ZXJEYXRhUmVzdWx0PFQ+IHtcblx0cmV0dXJuIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmICd2aXNpYmlsaXR5JyBpbiBvYmogJiYgJ2RhdGEnIGluIG9iajtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFZpc2libGVTdGF0ZSh2aXNpYmlsaXR5OiBib29sZWFuIHwgVHJlZVZpc2liaWxpdHkpOiBUcmVlVmlzaWJpbGl0eSB7XG5cdHN3aXRjaCAodmlzaWJpbGl0eSkge1xuXHRcdGNhc2UgdHJ1ZTogcmV0dXJuIFRyZWVWaXNpYmlsaXR5LlZpc2libGU7XG5cdFx0Y2FzZSBmYWxzZTogcmV0dXJuIFRyZWVWaXNpYmlsaXR5LkhpZGRlbjtcblx0XHRkZWZhdWx0OiByZXR1cm4gdmlzaWJpbGl0eTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElJbmRleFRyZWVNb2RlbE9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IHtcblx0cmVhZG9ubHkgY29sbGFwc2VCeURlZmF1bHQ/OiBib29sZWFuOyAvLyBkZWZhdWx0cyB0byBmYWxzZVxuXHRyZWFkb25seSBhbGxvd05vbkNvbGxhcHNpYmxlUGFyZW50cz86IGJvb2xlYW47IC8vIGRlZmF1bHRzIHRvIGZhbHNlXG5cdHJlYWRvbmx5IGZpbHRlcj86IElUcmVlRmlsdGVyPFQsIFRGaWx0ZXJEYXRhPjtcblx0cmVhZG9ubHkgYXV0b0V4cGFuZFNpbmdsZUNoaWxkcmVuPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSW5kZXhUcmVlTW9kZWxTcGxpY2VPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiB7XG5cdC8qKlxuXHQgKiBJZiBzZXQsIGNoaWxkIHVwZGF0ZXMgd2lsbCByZWN1cnNlIHRoZSBnaXZlbiBudW1iZXIgb2YgbGV2ZWxzIGV2ZW4gaWZcblx0ICogaXRlbXMgaW4gdGhlIHNwbGljZSBvcGVyYXRpb24gYXJlIHVuY2hhbmdlZC4gYEluZmluaXR5YCBpcyBhIHZhbGlkIHZhbHVlLlxuXHQgKi9cblx0cmVhZG9ubHkgZGlmZkRlcHRoPzogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBJZGVudGl0eSBwcm92aWRlciB1c2VkIHRvIG9wdGltaXplIHNwbGljZSgpIGNhbGxzIGluIHRoZSBJbmRleFRyZWUuIElmXG5cdCAqIHRoaXMgaXMgbm90IHByZXNlbnQsIG9wdGltaXplZCBzcGxpY2luZyBpcyBub3QgZW5hYmxlZC5cblx0ICpcblx0ICogV2FybmluZzogaWYgdGhpcyBpcyBwcmVzZW50LCBjYWxscyB0byBgc2V0Q2hpbGRyZW4oKWAgd2lsbCBub3QgcmVwbGFjZVxuXHQgKiBvciB1cGRhdGUgbm9kZXMgaWYgdGhlaXIgaWRlbnRpdHkgaXMgdGhlIHNhbWUsIGV2ZW4gaWYgdGhlIGVsZW1lbnRzIGFyZVxuXHQgKiBkaWZmZXJlbnQuIEZvciB0aGlzLCB5b3Ugc2hvdWxkIGNhbGwgYHJlcmVuZGVyKClgLlxuXHQgKi9cblx0cmVhZG9ubHkgZGlmZklkZW50aXR5UHJvdmlkZXI/OiBJSWRlbnRpdHlQcm92aWRlcjxUPjtcblxuXHQvKipcblx0ICogQ2FsbGJhY2sgZm9yIHdoZW4gYSBub2RlIGlzIGNyZWF0ZWQuXG5cdCAqL1xuXHRvbkRpZENyZWF0ZU5vZGU/OiAobm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPikgPT4gdm9pZDtcblxuXHQvKipcblx0ICogQ2FsbGJhY2sgZm9yIHdoZW4gYSBub2RlIGlzIGRlbGV0ZWQuXG5cdCAqL1xuXHRvbkRpZERlbGV0ZU5vZGU/OiAobm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPikgPT4gdm9pZDtcbn1cblxuaW50ZXJmYWNlIENvbGxhcHNpYmxlU3RhdGVVcGRhdGUge1xuXHRyZWFkb25seSBjb2xsYXBzaWJsZTogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIENvbGxhcHNlZFN0YXRlVXBkYXRlIHtcblx0cmVhZG9ubHkgY29sbGFwc2VkOiBib29sZWFuO1xuXHRyZWFkb25seSByZWN1cnNpdmU6IGJvb2xlYW47XG59XG5cbnR5cGUgQ29sbGFwc2VTdGF0ZVVwZGF0ZSA9IENvbGxhcHNpYmxlU3RhdGVVcGRhdGUgfCBDb2xsYXBzZWRTdGF0ZVVwZGF0ZTtcblxuZnVuY3Rpb24gaXNDb2xsYXBzaWJsZVN0YXRlVXBkYXRlKHVwZGF0ZTogQ29sbGFwc2VTdGF0ZVVwZGF0ZSk6IHVwZGF0ZSBpcyBDb2xsYXBzaWJsZVN0YXRlVXBkYXRlIHtcblx0cmV0dXJuIHR5cGVvZiAodXBkYXRlIGFzIGFueSkuY29sbGFwc2libGUgPT09ICdib29sZWFuJztcbn1cblxuZXhwb3J0IGNsYXNzIEluZGV4VHJlZU1vZGVsPFQgZXh0ZW5kcyBFeGNsdWRlPGFueSwgdW5kZWZpbmVkPiwgVEZpbHRlckRhdGEgPSB2b2lkPiBpbXBsZW1lbnRzIElUcmVlTW9kZWw8VCwgVEZpbHRlckRhdGEsIG51bWJlcltdPiB7XG5cblx0cmVhZG9ubHkgcm9vdFJlZiA9IFtdO1xuXG5cdHByaXZhdGUgcm9vdDogSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+O1xuXHRwcml2YXRlIGV2ZW50QnVmZmVyZXIgPSBuZXcgRXZlbnRCdWZmZXJlcigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU3BsaWNlTW9kZWwgPSBuZXcgRW1pdHRlcjxJVHJlZU1vZGVsU3BsaWNlRXZlbnQ8VCwgVEZpbHRlckRhdGE+PigpO1xuXHRyZWFkb25seSBvbkRpZFNwbGljZU1vZGVsID0gdGhpcy5fb25EaWRTcGxpY2VNb2RlbC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXMgPSBuZXcgRW1pdHRlcjxJVHJlZUxpc3RTcGxpY2VEYXRhPFQsIFRGaWx0ZXJEYXRhPj4oKTtcblx0cmVhZG9ubHkgb25EaWRTcGxpY2VSZW5kZXJlZE5vZGVzID0gdGhpcy5fb25EaWRTcGxpY2VSZW5kZXJlZE5vZGVzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZSA9IG5ldyBFbWl0dGVyPElDb2xsYXBzZVN0YXRlQ2hhbmdlRXZlbnQ8VCwgVEZpbHRlckRhdGE+PigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbGxhcHNlU3RhdGU6IEV2ZW50PElDb2xsYXBzZVN0YXRlQ2hhbmdlRXZlbnQ8VCwgVEZpbHRlckRhdGE+PiA9IHRoaXMuZXZlbnRCdWZmZXJlci53cmFwRXZlbnQodGhpcy5fb25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlLmV2ZW50KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVJlbmRlck5vZGVDb3VudCA9IG5ldyBFbWl0dGVyPElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50OiBFdmVudDxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+PiA9IHRoaXMuZXZlbnRCdWZmZXJlci53cmFwRXZlbnQodGhpcy5fb25EaWRDaGFuZ2VSZW5kZXJOb2RlQ291bnQuZXZlbnQpO1xuXG5cdHByaXZhdGUgY29sbGFwc2VCeURlZmF1bHQ6IGJvb2xlYW47XG5cdHByaXZhdGUgYWxsb3dOb25Db2xsYXBzaWJsZVBhcmVudHM6IGJvb2xlYW47XG5cdHByaXZhdGUgZmlsdGVyPzogSVRyZWVGaWx0ZXI8VCwgVEZpbHRlckRhdGE+O1xuXHRwcml2YXRlIGF1dG9FeHBhbmRTaW5nbGVDaGlsZHJlbjogYm9vbGVhbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlZmlsdGVyRGVsYXllciA9IG5ldyBEZWxheWVyKE1pY3JvdGFza0RlbGF5KTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHVzZXI6IHN0cmluZyxcblx0XHRyb290RWxlbWVudDogVCxcblx0XHRvcHRpb25zOiBJSW5kZXhUcmVlTW9kZWxPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiA9IHt9XG5cdCkge1xuXHRcdHRoaXMuY29sbGFwc2VCeURlZmF1bHQgPSB0eXBlb2Ygb3B0aW9ucy5jb2xsYXBzZUJ5RGVmYXVsdCA9PT0gJ3VuZGVmaW5lZCcgPyBmYWxzZSA6IG9wdGlvbnMuY29sbGFwc2VCeURlZmF1bHQ7XG5cdFx0dGhpcy5hbGxvd05vbkNvbGxhcHNpYmxlUGFyZW50cyA9IG9wdGlvbnMuYWxsb3dOb25Db2xsYXBzaWJsZVBhcmVudHMgPz8gZmFsc2U7XG5cdFx0dGhpcy5maWx0ZXIgPSBvcHRpb25zLmZpbHRlcjtcblx0XHR0aGlzLmF1dG9FeHBhbmRTaW5nbGVDaGlsZHJlbiA9IHR5cGVvZiBvcHRpb25zLmF1dG9FeHBhbmRTaW5nbGVDaGlsZHJlbiA9PT0gJ3VuZGVmaW5lZCcgPyBmYWxzZSA6IG9wdGlvbnMuYXV0b0V4cGFuZFNpbmdsZUNoaWxkcmVuO1xuXG5cdFx0dGhpcy5yb290ID0ge1xuXHRcdFx0cGFyZW50OiB1bmRlZmluZWQsXG5cdFx0XHRlbGVtZW50OiByb290RWxlbWVudCxcblx0XHRcdGNoaWxkcmVuOiBbXSxcblx0XHRcdGRlcHRoOiAwLFxuXHRcdFx0dmlzaWJsZUNoaWxkcmVuQ291bnQ6IDAsXG5cdFx0XHR2aXNpYmxlQ2hpbGRJbmRleDogLTEsXG5cdFx0XHRjb2xsYXBzaWJsZTogZmFsc2UsXG5cdFx0XHRjb2xsYXBzZWQ6IGZhbHNlLFxuXHRcdFx0cmVuZGVyTm9kZUNvdW50OiAwLFxuXHRcdFx0dmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHkuVmlzaWJsZSxcblx0XHRcdHZpc2libGU6IHRydWUsXG5cdFx0XHRmaWx0ZXJEYXRhOiB1bmRlZmluZWRcblx0XHR9O1xuXHR9XG5cblx0c3BsaWNlKFxuXHRcdGxvY2F0aW9uOiBudW1iZXJbXSxcblx0XHRkZWxldGVDb3VudDogbnVtYmVyLFxuXHRcdHRvSW5zZXJ0OiBJdGVyYWJsZTxJVHJlZUVsZW1lbnQ8VD4+ID0gSXRlcmFibGUuZW1wdHkoKSxcblx0XHRvcHRpb25zOiBJSW5kZXhUcmVlTW9kZWxTcGxpY2VPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiA9IHt9LFxuXHQpOiB2b2lkIHtcblx0XHRpZiAobG9jYXRpb24ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHJlZUVycm9yKHRoaXMudXNlciwgJ0ludmFsaWQgdHJlZSBsb2NhdGlvbicpO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLmRpZmZJZGVudGl0eVByb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLnNwbGljZVNtYXJ0KG9wdGlvbnMuZGlmZklkZW50aXR5UHJvdmlkZXIsIGxvY2F0aW9uLCBkZWxldGVDb3VudCwgdG9JbnNlcnQsIG9wdGlvbnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNwbGljZVNpbXBsZShsb2NhdGlvbiwgZGVsZXRlQ291bnQsIHRvSW5zZXJ0LCBvcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNwbGljZVNtYXJ0KFxuXHRcdGlkZW50aXR5OiBJSWRlbnRpdHlQcm92aWRlcjxUPixcblx0XHRsb2NhdGlvbjogbnVtYmVyW10sXG5cdFx0ZGVsZXRlQ291bnQ6IG51bWJlcixcblx0XHR0b0luc2VydEl0ZXJhYmxlOiBJdGVyYWJsZTxJVHJlZUVsZW1lbnQ8VD4+ID0gSXRlcmFibGUuZW1wdHkoKSxcblx0XHRvcHRpb25zOiBJSW5kZXhUcmVlTW9kZWxTcGxpY2VPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPixcblx0XHRyZWN1cnNlTGV2ZWxzID0gb3B0aW9ucy5kaWZmRGVwdGggPz8gMCxcblx0KSB7XG5cdFx0Y29uc3QgeyBwYXJlbnROb2RlIH0gPSB0aGlzLmdldFBhcmVudE5vZGVXaXRoTGlzdEluZGV4KGxvY2F0aW9uKTtcblx0XHRpZiAoIXBhcmVudE5vZGUubGFzdERpZmZJZHMpIHtcblx0XHRcdHJldHVybiB0aGlzLnNwbGljZVNpbXBsZShsb2NhdGlvbiwgZGVsZXRlQ291bnQsIHRvSW5zZXJ0SXRlcmFibGUsIG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvSW5zZXJ0ID0gWy4uLnRvSW5zZXJ0SXRlcmFibGVdO1xuXHRcdGNvbnN0IGluZGV4ID0gbG9jYXRpb25bbG9jYXRpb24ubGVuZ3RoIC0gMV07XG5cdFx0Y29uc3QgZGlmZiA9IG5ldyBMY3NEaWZmKFxuXHRcdFx0eyBnZXRFbGVtZW50czogKCkgPT4gcGFyZW50Tm9kZS5sYXN0RGlmZklkcyEgfSxcblx0XHRcdHtcblx0XHRcdFx0Z2V0RWxlbWVudHM6ICgpID0+IFtcblx0XHRcdFx0XHQuLi5wYXJlbnROb2RlLmNoaWxkcmVuLnNsaWNlKDAsIGluZGV4KSxcblx0XHRcdFx0XHQuLi50b0luc2VydCxcblx0XHRcdFx0XHQuLi5wYXJlbnROb2RlLmNoaWxkcmVuLnNsaWNlKGluZGV4ICsgZGVsZXRlQ291bnQpLFxuXHRcdFx0XHRdLm1hcChlID0+IGlkZW50aXR5LmdldElkKGUuZWxlbWVudCkudG9TdHJpbmcoKSlcblx0XHRcdH0sXG5cdFx0KS5Db21wdXRlRGlmZihmYWxzZSk7XG5cblx0XHQvLyBpZiB3ZSB3ZXJlIGdpdmVuIGEgJ2Jlc3QgZWZmb3J0JyBkaWZmLCB1c2UgZGVmYXVsdCBiZWhhdmlvclxuXHRcdGlmIChkaWZmLnF1aXRFYXJseSkge1xuXHRcdFx0cGFyZW50Tm9kZS5sYXN0RGlmZklkcyA9IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybiB0aGlzLnNwbGljZVNpbXBsZShsb2NhdGlvbiwgZGVsZXRlQ291bnQsIHRvSW5zZXJ0LCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRjb25zdCBsb2NhdGlvblByZWZpeCA9IGxvY2F0aW9uLnNsaWNlKDAsIC0xKTtcblx0XHRjb25zdCByZWN1cnNlU3BsaWNlID0gKGZyb21PcmlnaW5hbDogbnVtYmVyLCBmcm9tTW9kaWZpZWQ6IG51bWJlciwgY291bnQ6IG51bWJlcikgPT4ge1xuXHRcdFx0aWYgKHJlY3Vyc2VMZXZlbHMgPiAwKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuXHRcdFx0XHRcdGZyb21PcmlnaW5hbC0tO1xuXHRcdFx0XHRcdGZyb21Nb2RpZmllZC0tO1xuXHRcdFx0XHRcdHRoaXMuc3BsaWNlU21hcnQoXG5cdFx0XHRcdFx0XHRpZGVudGl0eSxcblx0XHRcdFx0XHRcdFsuLi5sb2NhdGlvblByZWZpeCwgZnJvbU9yaWdpbmFsLCAwXSxcblx0XHRcdFx0XHRcdE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLFxuXHRcdFx0XHRcdFx0dG9JbnNlcnRbZnJvbU1vZGlmaWVkXS5jaGlsZHJlbixcblx0XHRcdFx0XHRcdG9wdGlvbnMsXG5cdFx0XHRcdFx0XHRyZWN1cnNlTGV2ZWxzIC0gMSxcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGxldCBsYXN0U3RhcnRPID0gTWF0aC5taW4ocGFyZW50Tm9kZS5jaGlsZHJlbi5sZW5ndGgsIGluZGV4ICsgZGVsZXRlQ291bnQpO1xuXHRcdGxldCBsYXN0U3RhcnRNID0gdG9JbnNlcnQubGVuZ3RoO1xuXHRcdGZvciAoY29uc3QgY2hhbmdlIG9mIGRpZmYuY2hhbmdlcy5zb3J0KChhLCBiKSA9PiBiLm9yaWdpbmFsU3RhcnQgLSBhLm9yaWdpbmFsU3RhcnQpKSB7XG5cdFx0XHRyZWN1cnNlU3BsaWNlKGxhc3RTdGFydE8sIGxhc3RTdGFydE0sIGxhc3RTdGFydE8gLSAoY2hhbmdlLm9yaWdpbmFsU3RhcnQgKyBjaGFuZ2Uub3JpZ2luYWxMZW5ndGgpKTtcblx0XHRcdGxhc3RTdGFydE8gPSBjaGFuZ2Uub3JpZ2luYWxTdGFydDtcblx0XHRcdGxhc3RTdGFydE0gPSBjaGFuZ2UubW9kaWZpZWRTdGFydCAtIGluZGV4O1xuXG5cdFx0XHR0aGlzLnNwbGljZVNpbXBsZShcblx0XHRcdFx0Wy4uLmxvY2F0aW9uUHJlZml4LCBsYXN0U3RhcnRPXSxcblx0XHRcdFx0Y2hhbmdlLm9yaWdpbmFsTGVuZ3RoLFxuXHRcdFx0XHRJdGVyYWJsZS5zbGljZSh0b0luc2VydCwgbGFzdFN0YXJ0TSwgbGFzdFN0YXJ0TSArIGNoYW5nZS5tb2RpZmllZExlbmd0aCksXG5cdFx0XHRcdG9wdGlvbnMsXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8vIGF0IHRoaXMgcG9pbnQsIHN0YXJ0TyA9PT0gc3RhcnRNID09PSBjb3VudCBzaW5jZSBhbnkgcmVtYWluaW5nIHByZWZpeCBzaG91bGQgbWF0Y2hcblx0XHRyZWN1cnNlU3BsaWNlKGxhc3RTdGFydE8sIGxhc3RTdGFydE0sIGxhc3RTdGFydE8pO1xuXHR9XG5cblx0cHJpdmF0ZSBzcGxpY2VTaW1wbGUoXG5cdFx0bG9jYXRpb246IG51bWJlcltdLFxuXHRcdGRlbGV0ZUNvdW50OiBudW1iZXIsXG5cdFx0dG9JbnNlcnQ6IEl0ZXJhYmxlPElUcmVlRWxlbWVudDxUPj4gPSBJdGVyYWJsZS5lbXB0eSgpLFxuXHRcdHsgb25EaWRDcmVhdGVOb2RlLCBvbkRpZERlbGV0ZU5vZGUsIGRpZmZJZGVudGl0eVByb3ZpZGVyIH06IElJbmRleFRyZWVNb2RlbFNwbGljZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+LFxuXHQpIHtcblx0XHRjb25zdCB7IHBhcmVudE5vZGUsIGxpc3RJbmRleCwgcmV2ZWFsZWQsIHZpc2libGUgfSA9IHRoaXMuZ2V0UGFyZW50Tm9kZVdpdGhMaXN0SW5kZXgobG9jYXRpb24pO1xuXHRcdGNvbnN0IHRyZWVMaXN0RWxlbWVudHNUb0luc2VydDogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdID0gW107XG5cdFx0Y29uc3Qgbm9kZXNUb0luc2VydEl0ZXJhdG9yID0gSXRlcmFibGUubWFwKHRvSW5zZXJ0LCBlbCA9PiB0aGlzLmNyZWF0ZVRyZWVOb2RlKGVsLCBwYXJlbnROb2RlLCBwYXJlbnROb2RlLnZpc2libGUgPyBUcmVlVmlzaWJpbGl0eS5WaXNpYmxlIDogVHJlZVZpc2liaWxpdHkuSGlkZGVuLCByZXZlYWxlZCwgdHJlZUxpc3RFbGVtZW50c1RvSW5zZXJ0LCBvbkRpZENyZWF0ZU5vZGUpKTtcblxuXHRcdGNvbnN0IGxhc3RJbmRleCA9IGxvY2F0aW9uW2xvY2F0aW9uLmxlbmd0aCAtIDFdO1xuXG5cdFx0Ly8gZmlndXJlIG91dCB3aGF0J3MgdGhlIHZpc2libGUgY2hpbGQgc3RhcnQgaW5kZXggcmlnaHQgYmVmb3JlIHRoZVxuXHRcdC8vIHNwbGljZSBwb2ludFxuXHRcdGxldCB2aXNpYmxlQ2hpbGRTdGFydEluZGV4ID0gMDtcblxuXHRcdGZvciAobGV0IGkgPSBsYXN0SW5kZXg7IGkgPj0gMCAmJiBpIDwgcGFyZW50Tm9kZS5jaGlsZHJlbi5sZW5ndGg7IGktLSkge1xuXHRcdFx0Y29uc3QgY2hpbGQgPSBwYXJlbnROb2RlLmNoaWxkcmVuW2ldO1xuXG5cdFx0XHRpZiAoY2hpbGQudmlzaWJsZSkge1xuXHRcdFx0XHR2aXNpYmxlQ2hpbGRTdGFydEluZGV4ID0gY2hpbGQudmlzaWJsZUNoaWxkSW5kZXg7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG5vZGVzVG9JbnNlcnQ6IElJbmRleFRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdID0gW107XG5cdFx0bGV0IGluc2VydGVkVmlzaWJsZUNoaWxkcmVuQ291bnQgPSAwO1xuXHRcdGxldCByZW5kZXJOb2RlQ291bnQgPSAwO1xuXG5cdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBub2Rlc1RvSW5zZXJ0SXRlcmF0b3IpIHtcblx0XHRcdG5vZGVzVG9JbnNlcnQucHVzaChjaGlsZCk7XG5cdFx0XHRyZW5kZXJOb2RlQ291bnQgKz0gY2hpbGQucmVuZGVyTm9kZUNvdW50O1xuXG5cdFx0XHRpZiAoY2hpbGQudmlzaWJsZSkge1xuXHRcdFx0XHRjaGlsZC52aXNpYmxlQ2hpbGRJbmRleCA9IHZpc2libGVDaGlsZFN0YXJ0SW5kZXggKyBpbnNlcnRlZFZpc2libGVDaGlsZHJlbkNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVsZXRlZE5vZGVzID0gc3BsaWNlKHBhcmVudE5vZGUuY2hpbGRyZW4sIGxhc3RJbmRleCwgZGVsZXRlQ291bnQsIG5vZGVzVG9JbnNlcnQpO1xuXG5cdFx0aWYgKCFkaWZmSWRlbnRpdHlQcm92aWRlcikge1xuXHRcdFx0cGFyZW50Tm9kZS5sYXN0RGlmZklkcyA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKHBhcmVudE5vZGUubGFzdERpZmZJZHMpIHtcblx0XHRcdHNwbGljZShwYXJlbnROb2RlLmxhc3REaWZmSWRzLCBsYXN0SW5kZXgsIGRlbGV0ZUNvdW50LCBub2Rlc1RvSW5zZXJ0Lm1hcChuID0+IGRpZmZJZGVudGl0eVByb3ZpZGVyLmdldElkKG4uZWxlbWVudCkudG9TdHJpbmcoKSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwYXJlbnROb2RlLmxhc3REaWZmSWRzID0gcGFyZW50Tm9kZS5jaGlsZHJlbi5tYXAobiA9PiBkaWZmSWRlbnRpdHlQcm92aWRlci5nZXRJZChuLmVsZW1lbnQpLnRvU3RyaW5nKCkpO1xuXHRcdH1cblxuXHRcdC8vIGZpZ3VyZSBvdXQgd2hhdCBpcyB0aGUgY291bnQgb2YgZGVsZXRlZCB2aXNpYmxlIGNoaWxkcmVuXG5cdFx0bGV0IGRlbGV0ZWRWaXNpYmxlQ2hpbGRyZW5Db3VudCA9IDA7XG5cblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGRlbGV0ZWROb2Rlcykge1xuXHRcdFx0aWYgKGNoaWxkLnZpc2libGUpIHtcblx0XHRcdFx0ZGVsZXRlZFZpc2libGVDaGlsZHJlbkNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gYW5kIGFkanVzdCBmb3IgYWxsIHZpc2libGUgY2hpbGRyZW4gYWZ0ZXIgdGhlIHNwbGljZSBwb2ludFxuXHRcdGlmIChkZWxldGVkVmlzaWJsZUNoaWxkcmVuQ291bnQgIT09IDApIHtcblx0XHRcdGZvciAobGV0IGkgPSBsYXN0SW5kZXggKyBub2Rlc1RvSW5zZXJ0Lmxlbmd0aDsgaSA8IHBhcmVudE5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgY2hpbGQgPSBwYXJlbnROb2RlLmNoaWxkcmVuW2ldO1xuXG5cdFx0XHRcdGlmIChjaGlsZC52aXNpYmxlKSB7XG5cdFx0XHRcdFx0Y2hpbGQudmlzaWJsZUNoaWxkSW5kZXggLT0gZGVsZXRlZFZpc2libGVDaGlsZHJlbkNvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gdXBkYXRlIHBhcmVudCdzIHZpc2libGUgY2hpbGRyZW4gY291bnRcblx0XHRwYXJlbnROb2RlLnZpc2libGVDaGlsZHJlbkNvdW50ICs9IGluc2VydGVkVmlzaWJsZUNoaWxkcmVuQ291bnQgLSBkZWxldGVkVmlzaWJsZUNoaWxkcmVuQ291bnQ7XG5cblx0XHRpZiAoZGVsZXRlZE5vZGVzLmxlbmd0aCA+IDAgJiYgb25EaWREZWxldGVOb2RlKSB7XG5cdFx0XHRjb25zdCB2aXNpdCA9IChub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KSA9PiB7XG5cdFx0XHRcdG9uRGlkRGVsZXRlTm9kZShub2RlKTtcblx0XHRcdFx0bm9kZS5jaGlsZHJlbi5mb3JFYWNoKHZpc2l0KTtcblx0XHRcdH07XG5cblx0XHRcdGRlbGV0ZWROb2Rlcy5mb3JFYWNoKHZpc2l0KTtcblx0XHR9XG5cblx0XHRpZiAocmV2ZWFsZWQgJiYgdmlzaWJsZSkge1xuXHRcdFx0Y29uc3QgdmlzaWJsZURlbGV0ZUNvdW50ID0gZGVsZXRlZE5vZGVzLnJlZHVjZSgociwgbm9kZSkgPT4gciArIChub2RlLnZpc2libGUgPyBub2RlLnJlbmRlck5vZGVDb3VudCA6IDApLCAwKTtcblxuXHRcdFx0dGhpcy5fdXBkYXRlQW5jZXN0b3JzUmVuZGVyTm9kZUNvdW50KHBhcmVudE5vZGUsIHJlbmRlck5vZGVDb3VudCAtIHZpc2libGVEZWxldGVDb3VudCk7XG5cdFx0XHR0aGlzLl9vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXMuZmlyZSh7IHN0YXJ0OiBsaXN0SW5kZXgsIGRlbGV0ZUNvdW50OiB2aXNpYmxlRGVsZXRlQ291bnQsIGVsZW1lbnRzOiB0cmVlTGlzdEVsZW1lbnRzVG9JbnNlcnQgfSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRTcGxpY2VNb2RlbC5maXJlKHsgaW5zZXJ0ZWROb2Rlczogbm9kZXNUb0luc2VydCwgZGVsZXRlZE5vZGVzIH0pO1xuXG5cdFx0bGV0IG5vZGU6IElJbmRleFRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZCA9IHBhcmVudE5vZGU7XG5cblx0XHR3aGlsZSAobm9kZSkge1xuXHRcdFx0aWYgKG5vZGUudmlzaWJpbGl0eSA9PT0gVHJlZVZpc2liaWxpdHkuUmVjdXJzZSkge1xuXHRcdFx0XHQvLyBkZWxheWVkIHRvIGF2b2lkIGV4Y2Vzc2l2ZSByZWZpbHRlcmluZywgc2VlICMxMzU5NDFcblx0XHRcdFx0dGhpcy5yZWZpbHRlckRlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLnJlZmlsdGVyKCkpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0bm9kZSA9IG5vZGUucGFyZW50O1xuXHRcdH1cblx0fVxuXG5cdHJlcmVuZGVyKGxvY2F0aW9uOiBudW1iZXJbXSk6IHZvaWQge1xuXHRcdGlmIChsb2NhdGlvbi5sZW5ndGggPT09IDApIHtcblx0XHRcdHRocm93IG5ldyBUcmVlRXJyb3IodGhpcy51c2VyLCAnSW52YWxpZCB0cmVlIGxvY2F0aW9uJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBub2RlLCBsaXN0SW5kZXgsIHJldmVhbGVkIH0gPSB0aGlzLmdldFRyZWVOb2RlV2l0aExpc3RJbmRleChsb2NhdGlvbik7XG5cblx0XHRpZiAobm9kZS52aXNpYmxlICYmIHJldmVhbGVkKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXMuZmlyZSh7IHN0YXJ0OiBsaXN0SW5kZXgsIGRlbGV0ZUNvdW50OiAxLCBlbGVtZW50czogW25vZGVdIH0pO1xuXHRcdH1cblx0fVxuXG5cdGhhcyhsb2NhdGlvbjogbnVtYmVyW10pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5oYXNUcmVlTm9kZShsb2NhdGlvbik7XG5cdH1cblxuXHRnZXRMaXN0SW5kZXgobG9jYXRpb246IG51bWJlcltdKTogbnVtYmVyIHtcblx0XHRjb25zdCB7IGxpc3RJbmRleCwgdmlzaWJsZSwgcmV2ZWFsZWQgfSA9IHRoaXMuZ2V0VHJlZU5vZGVXaXRoTGlzdEluZGV4KGxvY2F0aW9uKTtcblx0XHRyZXR1cm4gdmlzaWJsZSAmJiByZXZlYWxlZCA/IGxpc3RJbmRleCA6IC0xO1xuXHR9XG5cblx0Z2V0TGlzdFJlbmRlckNvdW50KGxvY2F0aW9uOiBudW1iZXJbXSk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0VHJlZU5vZGUobG9jYXRpb24pLnJlbmRlck5vZGVDb3VudDtcblx0fVxuXG5cdGlzQ29sbGFwc2libGUobG9jYXRpb246IG51bWJlcltdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0VHJlZU5vZGUobG9jYXRpb24pLmNvbGxhcHNpYmxlO1xuXHR9XG5cblx0c2V0Q29sbGFwc2libGUobG9jYXRpb246IG51bWJlcltdLCBjb2xsYXBzaWJsZT86IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy5nZXRUcmVlTm9kZShsb2NhdGlvbik7XG5cblx0XHRpZiAodHlwZW9mIGNvbGxhcHNpYmxlID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y29sbGFwc2libGUgPSAhbm9kZS5jb2xsYXBzaWJsZTtcblx0XHR9XG5cblx0XHRjb25zdCB1cGRhdGU6IENvbGxhcHNpYmxlU3RhdGVVcGRhdGUgPSB7IGNvbGxhcHNpYmxlIH07XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRCdWZmZXJlci5idWZmZXJFdmVudHMoKCkgPT4gdGhpcy5fc2V0Q29sbGFwc2VTdGF0ZShsb2NhdGlvbiwgdXBkYXRlKSk7XG5cdH1cblxuXHRpc0NvbGxhcHNlZChsb2NhdGlvbjogbnVtYmVyW10pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRUcmVlTm9kZShsb2NhdGlvbikuY29sbGFwc2VkO1xuXHR9XG5cblx0c2V0Q29sbGFwc2VkKGxvY2F0aW9uOiBudW1iZXJbXSwgY29sbGFwc2VkPzogYm9vbGVhbiwgcmVjdXJzaXZlPzogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLmdldFRyZWVOb2RlKGxvY2F0aW9uKTtcblxuXHRcdGlmICh0eXBlb2YgY29sbGFwc2VkID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y29sbGFwc2VkID0gIW5vZGUuY29sbGFwc2VkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVwZGF0ZTogQ29sbGFwc2VkU3RhdGVVcGRhdGUgPSB7IGNvbGxhcHNlZCwgcmVjdXJzaXZlOiByZWN1cnNpdmUgfHwgZmFsc2UgfTtcblx0XHRyZXR1cm4gdGhpcy5ldmVudEJ1ZmZlcmVyLmJ1ZmZlckV2ZW50cygoKSA9PiB0aGlzLl9zZXRDb2xsYXBzZVN0YXRlKGxvY2F0aW9uLCB1cGRhdGUpKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldENvbGxhcHNlU3RhdGUobG9jYXRpb246IG51bWJlcltdLCB1cGRhdGU6IENvbGxhcHNlU3RhdGVVcGRhdGUpOiBib29sZWFuIHtcblx0XHRjb25zdCB7IG5vZGUsIGxpc3RJbmRleCwgcmV2ZWFsZWQgfSA9IHRoaXMuZ2V0VHJlZU5vZGVXaXRoTGlzdEluZGV4KGxvY2F0aW9uKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX3NldExpc3ROb2RlQ29sbGFwc2VTdGF0ZShub2RlLCBsaXN0SW5kZXgsIHJldmVhbGVkLCB1cGRhdGUpO1xuXG5cdFx0aWYgKG5vZGUgIT09IHRoaXMucm9vdCAmJiB0aGlzLmF1dG9FeHBhbmRTaW5nbGVDaGlsZHJlbiAmJiByZXN1bHQgJiYgIWlzQ29sbGFwc2libGVTdGF0ZVVwZGF0ZSh1cGRhdGUpICYmIG5vZGUuY29sbGFwc2libGUgJiYgIW5vZGUuY29sbGFwc2VkICYmICF1cGRhdGUucmVjdXJzaXZlKSB7XG5cdFx0XHRsZXQgb25seVZpc2libGVDaGlsZEluZGV4ID0gLTE7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBjaGlsZCA9IG5vZGUuY2hpbGRyZW5baV07XG5cblx0XHRcdFx0aWYgKGNoaWxkLnZpc2libGUpIHtcblx0XHRcdFx0XHRpZiAob25seVZpc2libGVDaGlsZEluZGV4ID4gLTEpIHtcblx0XHRcdFx0XHRcdG9ubHlWaXNpYmxlQ2hpbGRJbmRleCA9IC0xO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG9ubHlWaXNpYmxlQ2hpbGRJbmRleCA9IGk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvbmx5VmlzaWJsZUNoaWxkSW5kZXggPiAtMSkge1xuXHRcdFx0XHR0aGlzLl9zZXRDb2xsYXBzZVN0YXRlKFsuLi5sb2NhdGlvbiwgb25seVZpc2libGVDaGlsZEluZGV4XSwgdXBkYXRlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0TGlzdE5vZGVDb2xsYXBzZVN0YXRlKG5vZGU6IElJbmRleFRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiwgbGlzdEluZGV4OiBudW1iZXIsIHJldmVhbGVkOiBib29sZWFuLCB1cGRhdGU6IENvbGxhcHNlU3RhdGVVcGRhdGUpOiBib29sZWFuIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9zZXROb2RlQ29sbGFwc2VTdGF0ZShub2RlLCB1cGRhdGUsIGZhbHNlKTtcblxuXHRcdGlmICghcmV2ZWFsZWQgfHwgIW5vZGUudmlzaWJsZSB8fCAhcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZpb3VzUmVuZGVyTm9kZUNvdW50ID0gbm9kZS5yZW5kZXJOb2RlQ291bnQ7XG5cdFx0Y29uc3QgdG9JbnNlcnQgPSB0aGlzLnVwZGF0ZU5vZGVBZnRlckNvbGxhcHNlQ2hhbmdlKG5vZGUpO1xuXHRcdGNvbnN0IGRlbGV0ZUNvdW50ID0gcHJldmlvdXNSZW5kZXJOb2RlQ291bnQgLSAobGlzdEluZGV4ID09PSAtMSA/IDAgOiAxKTtcblx0XHR0aGlzLl9vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXMuZmlyZSh7IHN0YXJ0OiBsaXN0SW5kZXggKyAxLCBkZWxldGVDb3VudDogZGVsZXRlQ291bnQsIGVsZW1lbnRzOiB0b0luc2VydC5zbGljZSgxKSB9KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF9zZXROb2RlQ29sbGFwc2VTdGF0ZShub2RlOiBJSW5kZXhUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIHVwZGF0ZTogQ29sbGFwc2VTdGF0ZVVwZGF0ZSwgZGVlcDogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGxldCByZXN1bHQ6IGJvb2xlYW47XG5cblx0XHRpZiAobm9kZSA9PT0gdGhpcy5yb290KSB7XG5cdFx0XHRyZXN1bHQgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGlzQ29sbGFwc2libGVTdGF0ZVVwZGF0ZSh1cGRhdGUpKSB7XG5cdFx0XHRcdHJlc3VsdCA9IG5vZGUuY29sbGFwc2libGUgIT09IHVwZGF0ZS5jb2xsYXBzaWJsZTtcblx0XHRcdFx0bm9kZS5jb2xsYXBzaWJsZSA9IHVwZGF0ZS5jb2xsYXBzaWJsZTtcblx0XHRcdH0gZWxzZSBpZiAoIW5vZGUuY29sbGFwc2libGUpIHtcblx0XHRcdFx0cmVzdWx0ID0gZmFsc2U7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQgPSBub2RlLmNvbGxhcHNlZCAhPT0gdXBkYXRlLmNvbGxhcHNlZDtcblx0XHRcdFx0bm9kZS5jb2xsYXBzZWQgPSB1cGRhdGUuY29sbGFwc2VkO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZS5maXJlKHsgbm9kZSwgZGVlcCB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWlzQ29sbGFwc2libGVTdGF0ZVVwZGF0ZSh1cGRhdGUpICYmIHVwZGF0ZS5yZWN1cnNpdmUpIHtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuXHRcdFx0XHRyZXN1bHQgPSB0aGlzLl9zZXROb2RlQ29sbGFwc2VTdGF0ZShjaGlsZCwgdXBkYXRlLCB0cnVlKSB8fCByZXN1bHQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cGFuZFRvKGxvY2F0aW9uOiBudW1iZXJbXSk6IHZvaWQge1xuXHRcdHRoaXMuZXZlbnRCdWZmZXJlci5idWZmZXJFdmVudHMoKCkgPT4ge1xuXHRcdFx0bGV0IG5vZGUgPSB0aGlzLmdldFRyZWVOb2RlKGxvY2F0aW9uKTtcblxuXHRcdFx0d2hpbGUgKG5vZGUucGFyZW50KSB7XG5cdFx0XHRcdG5vZGUgPSBub2RlLnBhcmVudDtcblx0XHRcdFx0bG9jYXRpb24gPSBsb2NhdGlvbi5zbGljZSgwLCBsb2NhdGlvbi5sZW5ndGggLSAxKTtcblxuXHRcdFx0XHRpZiAobm9kZS5jb2xsYXBzZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9zZXRDb2xsYXBzZVN0YXRlKGxvY2F0aW9uLCB7IGNvbGxhcHNlZDogZmFsc2UsIHJlY3Vyc2l2ZTogZmFsc2UgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJlZmlsdGVyKCk6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZpb3VzUmVuZGVyTm9kZUNvdW50ID0gdGhpcy5yb290LnJlbmRlck5vZGVDb3VudDtcblx0XHRjb25zdCB0b0luc2VydCA9IHRoaXMudXBkYXRlTm9kZUFmdGVyRmlsdGVyQ2hhbmdlKHRoaXMucm9vdCk7XG5cdFx0dGhpcy5fb25EaWRTcGxpY2VSZW5kZXJlZE5vZGVzLmZpcmUoeyBzdGFydDogMCwgZGVsZXRlQ291bnQ6IHByZXZpb3VzUmVuZGVyTm9kZUNvdW50LCBlbGVtZW50czogdG9JbnNlcnQgfSk7XG5cdFx0dGhpcy5yZWZpbHRlckRlbGF5ZXIuY2FuY2VsKCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRyZWVOb2RlKFxuXHRcdHRyZWVFbGVtZW50OiBJVHJlZUVsZW1lbnQ8VD4sXG5cdFx0cGFyZW50OiBJSW5kZXhUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sXG5cdFx0cGFyZW50VmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHksXG5cdFx0cmV2ZWFsZWQ6IGJvb2xlYW4sXG5cdFx0dHJlZUxpc3RFbGVtZW50czogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdLFxuXHRcdG9uRGlkQ3JlYXRlTm9kZT86IChub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KSA9PiB2b2lkXG5cdCk6IElJbmRleFRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiB7XG5cdFx0Y29uc3Qgbm9kZTogSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+ID0ge1xuXHRcdFx0cGFyZW50LFxuXHRcdFx0ZWxlbWVudDogdHJlZUVsZW1lbnQuZWxlbWVudCxcblx0XHRcdGNoaWxkcmVuOiBbXSxcblx0XHRcdGRlcHRoOiBwYXJlbnQuZGVwdGggKyAxLFxuXHRcdFx0dmlzaWJsZUNoaWxkcmVuQ291bnQ6IDAsXG5cdFx0XHR2aXNpYmxlQ2hpbGRJbmRleDogLTEsXG5cdFx0XHRjb2xsYXBzaWJsZTogdHlwZW9mIHRyZWVFbGVtZW50LmNvbGxhcHNpYmxlID09PSAnYm9vbGVhbicgPyB0cmVlRWxlbWVudC5jb2xsYXBzaWJsZSA6ICh0eXBlb2YgdHJlZUVsZW1lbnQuY29sbGFwc2VkICE9PSAndW5kZWZpbmVkJyksXG5cdFx0XHRjb2xsYXBzZWQ6IHR5cGVvZiB0cmVlRWxlbWVudC5jb2xsYXBzZWQgPT09ICd1bmRlZmluZWQnID8gdGhpcy5jb2xsYXBzZUJ5RGVmYXVsdCA6IHRyZWVFbGVtZW50LmNvbGxhcHNlZCxcblx0XHRcdHJlbmRlck5vZGVDb3VudDogMSxcblx0XHRcdHZpc2liaWxpdHk6IFRyZWVWaXNpYmlsaXR5LlZpc2libGUsXG5cdFx0XHR2aXNpYmxlOiB0cnVlLFxuXHRcdFx0ZmlsdGVyRGF0YTogdW5kZWZpbmVkXG5cdFx0fTtcblxuXHRcdGNvbnN0IHZpc2liaWxpdHkgPSB0aGlzLl9maWx0ZXJOb2RlKG5vZGUsIHBhcmVudFZpc2liaWxpdHkpO1xuXHRcdG5vZGUudmlzaWJpbGl0eSA9IHZpc2liaWxpdHk7XG5cblx0XHRpZiAocmV2ZWFsZWQpIHtcblx0XHRcdHRyZWVMaXN0RWxlbWVudHMucHVzaChub2RlKTtcblx0XHR9XG5cblx0XHRjb25zdCBjaGlsZEVsZW1lbnRzID0gdHJlZUVsZW1lbnQuY2hpbGRyZW4gfHwgSXRlcmFibGUuZW1wdHkoKTtcblx0XHRjb25zdCBjaGlsZFJldmVhbGVkID0gcmV2ZWFsZWQgJiYgdmlzaWJpbGl0eSAhPT0gVHJlZVZpc2liaWxpdHkuSGlkZGVuICYmICFub2RlLmNvbGxhcHNlZDtcblxuXHRcdGxldCB2aXNpYmxlQ2hpbGRyZW5Db3VudCA9IDA7XG5cdFx0bGV0IHJlbmRlck5vZGVDb3VudCA9IDE7XG5cblx0XHRmb3IgKGNvbnN0IGVsIG9mIGNoaWxkRWxlbWVudHMpIHtcblx0XHRcdGNvbnN0IGNoaWxkID0gdGhpcy5jcmVhdGVUcmVlTm9kZShlbCwgbm9kZSwgdmlzaWJpbGl0eSwgY2hpbGRSZXZlYWxlZCwgdHJlZUxpc3RFbGVtZW50cywgb25EaWRDcmVhdGVOb2RlKTtcblx0XHRcdG5vZGUuY2hpbGRyZW4ucHVzaChjaGlsZCk7XG5cdFx0XHRyZW5kZXJOb2RlQ291bnQgKz0gY2hpbGQucmVuZGVyTm9kZUNvdW50O1xuXG5cdFx0XHRpZiAoY2hpbGQudmlzaWJsZSkge1xuXHRcdFx0XHRjaGlsZC52aXNpYmxlQ2hpbGRJbmRleCA9IHZpc2libGVDaGlsZHJlbkNvdW50Kys7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmFsbG93Tm9uQ29sbGFwc2libGVQYXJlbnRzKSB7XG5cdFx0XHRub2RlLmNvbGxhcHNpYmxlID0gbm9kZS5jb2xsYXBzaWJsZSB8fCBub2RlLmNoaWxkcmVuLmxlbmd0aCA+IDA7XG5cdFx0fVxuXG5cdFx0bm9kZS52aXNpYmxlQ2hpbGRyZW5Db3VudCA9IHZpc2libGVDaGlsZHJlbkNvdW50O1xuXHRcdG5vZGUudmlzaWJsZSA9IHZpc2liaWxpdHkgPT09IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2UgPyB2aXNpYmxlQ2hpbGRyZW5Db3VudCA+IDAgOiAodmlzaWJpbGl0eSA9PT0gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSk7XG5cblx0XHRpZiAoIW5vZGUudmlzaWJsZSkge1xuXHRcdFx0bm9kZS5yZW5kZXJOb2RlQ291bnQgPSAwO1xuXG5cdFx0XHRpZiAocmV2ZWFsZWQpIHtcblx0XHRcdFx0dHJlZUxpc3RFbGVtZW50cy5wb3AoKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKCFub2RlLmNvbGxhcHNlZCkge1xuXHRcdFx0bm9kZS5yZW5kZXJOb2RlQ291bnQgPSByZW5kZXJOb2RlQ291bnQ7XG5cdFx0fVxuXG5cdFx0b25EaWRDcmVhdGVOb2RlPy4obm9kZSk7XG5cblx0XHRyZXR1cm4gbm9kZTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlTm9kZUFmdGVyQ29sbGFwc2VDaGFuZ2Uobm9kZTogSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdIHtcblx0XHRjb25zdCBwcmV2aW91c1JlbmRlck5vZGVDb3VudCA9IG5vZGUucmVuZGVyTm9kZUNvdW50O1xuXHRcdGNvbnN0IHJlc3VsdDogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdID0gW107XG5cblx0XHR0aGlzLl91cGRhdGVOb2RlQWZ0ZXJDb2xsYXBzZUNoYW5nZShub2RlLCByZXN1bHQpO1xuXHRcdHRoaXMuX3VwZGF0ZUFuY2VzdG9yc1JlbmRlck5vZGVDb3VudChub2RlLnBhcmVudCwgcmVzdWx0Lmxlbmd0aCAtIHByZXZpb3VzUmVuZGVyTm9kZUNvdW50KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVOb2RlQWZ0ZXJDb2xsYXBzZUNoYW5nZShub2RlOiBJSW5kZXhUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIHJlc3VsdDogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdKTogbnVtYmVyIHtcblx0XHRpZiAobm9kZS52aXNpYmxlID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0cmVzdWx0LnB1c2gobm9kZSk7XG5cdFx0bm9kZS5yZW5kZXJOb2RlQ291bnQgPSAxO1xuXG5cdFx0aWYgKCFub2RlLmNvbGxhcHNlZCkge1xuXHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRcdG5vZGUucmVuZGVyTm9kZUNvdW50ICs9IHRoaXMuX3VwZGF0ZU5vZGVBZnRlckNvbGxhcHNlQ2hhbmdlKGNoaWxkLCByZXN1bHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50LmZpcmUobm9kZSk7XG5cdFx0cmV0dXJuIG5vZGUucmVuZGVyTm9kZUNvdW50O1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVOb2RlQWZ0ZXJGaWx0ZXJDaGFuZ2Uobm9kZTogSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdIHtcblx0XHRjb25zdCBwcmV2aW91c1JlbmRlck5vZGVDb3VudCA9IG5vZGUucmVuZGVyTm9kZUNvdW50O1xuXHRcdGNvbnN0IHJlc3VsdDogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdID0gW107XG5cblx0XHR0aGlzLl91cGRhdGVOb2RlQWZ0ZXJGaWx0ZXJDaGFuZ2Uobm9kZSwgbm9kZS52aXNpYmxlID8gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSA6IFRyZWVWaXNpYmlsaXR5LkhpZGRlbiwgcmVzdWx0KTtcblx0XHR0aGlzLl91cGRhdGVBbmNlc3RvcnNSZW5kZXJOb2RlQ291bnQobm9kZS5wYXJlbnQsIHJlc3VsdC5sZW5ndGggLSBwcmV2aW91c1JlbmRlck5vZGVDb3VudCk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlTm9kZUFmdGVyRmlsdGVyQ2hhbmdlKG5vZGU6IElJbmRleFRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiwgcGFyZW50VmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHksIHJlc3VsdDogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdLCByZXZlYWxlZCA9IHRydWUpOiBib29sZWFuIHtcblx0XHRsZXQgdmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHk7XG5cblx0XHRpZiAobm9kZSAhPT0gdGhpcy5yb290KSB7XG5cdFx0XHR2aXNpYmlsaXR5ID0gdGhpcy5fZmlsdGVyTm9kZShub2RlLCBwYXJlbnRWaXNpYmlsaXR5KTtcblxuXHRcdFx0aWYgKHZpc2liaWxpdHkgPT09IFRyZWVWaXNpYmlsaXR5LkhpZGRlbikge1xuXHRcdFx0XHRub2RlLnZpc2libGUgPSBmYWxzZTtcblx0XHRcdFx0bm9kZS5yZW5kZXJOb2RlQ291bnQgPSAwO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZXZlYWxlZCkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChub2RlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHRTdGFydExlbmd0aCA9IHJlc3VsdC5sZW5ndGg7XG5cdFx0bm9kZS5yZW5kZXJOb2RlQ291bnQgPSBub2RlID09PSB0aGlzLnJvb3QgPyAwIDogMTtcblxuXHRcdGxldCBoYXNWaXNpYmxlRGVzY2VuZGFudHMgPSBmYWxzZTtcblx0XHRpZiAoIW5vZGUuY29sbGFwc2VkIHx8IHZpc2liaWxpdHkhICE9PSBUcmVlVmlzaWJpbGl0eS5IaWRkZW4pIHtcblx0XHRcdGxldCB2aXNpYmxlQ2hpbGRJbmRleCA9IDA7XG5cblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuXHRcdFx0XHRoYXNWaXNpYmxlRGVzY2VuZGFudHMgPSB0aGlzLl91cGRhdGVOb2RlQWZ0ZXJGaWx0ZXJDaGFuZ2UoY2hpbGQsIHZpc2liaWxpdHkhLCByZXN1bHQsIHJldmVhbGVkICYmICFub2RlLmNvbGxhcHNlZCkgfHwgaGFzVmlzaWJsZURlc2NlbmRhbnRzO1xuXG5cdFx0XHRcdGlmIChjaGlsZC52aXNpYmxlKSB7XG5cdFx0XHRcdFx0Y2hpbGQudmlzaWJsZUNoaWxkSW5kZXggPSB2aXNpYmxlQ2hpbGRJbmRleCsrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdG5vZGUudmlzaWJsZUNoaWxkcmVuQ291bnQgPSB2aXNpYmxlQ2hpbGRJbmRleDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bm9kZS52aXNpYmxlQ2hpbGRyZW5Db3VudCA9IDA7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUgIT09IHRoaXMucm9vdCkge1xuXHRcdFx0bm9kZS52aXNpYmxlID0gdmlzaWJpbGl0eSEgPT09IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2UgPyBoYXNWaXNpYmxlRGVzY2VuZGFudHMgOiAodmlzaWJpbGl0eSEgPT09IFRyZWVWaXNpYmlsaXR5LlZpc2libGUpO1xuXHRcdFx0bm9kZS52aXNpYmlsaXR5ID0gdmlzaWJpbGl0eSE7XG5cdFx0fVxuXG5cdFx0aWYgKCFub2RlLnZpc2libGUpIHtcblx0XHRcdG5vZGUucmVuZGVyTm9kZUNvdW50ID0gMDtcblxuXHRcdFx0aWYgKHJldmVhbGVkKSB7XG5cdFx0XHRcdHJlc3VsdC5wb3AoKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKCFub2RlLmNvbGxhcHNlZCkge1xuXHRcdFx0bm9kZS5yZW5kZXJOb2RlQ291bnQgKz0gcmVzdWx0Lmxlbmd0aCAtIHJlc3VsdFN0YXJ0TGVuZ3RoO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50LmZpcmUobm9kZSk7XG5cdFx0cmV0dXJuIG5vZGUudmlzaWJsZTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUFuY2VzdG9yc1JlbmRlck5vZGVDb3VudChub2RlOiBJSW5kZXhUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4gfCB1bmRlZmluZWQsIGRpZmY6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmIChkaWZmID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2hpbGUgKG5vZGUpIHtcblx0XHRcdG5vZGUucmVuZGVyTm9kZUNvdW50ICs9IGRpZmY7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVJlbmRlck5vZGVDb3VudC5maXJlKG5vZGUpO1xuXHRcdFx0bm9kZSA9IG5vZGUucGFyZW50O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2ZpbHRlck5vZGUobm9kZTogSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+LCBwYXJlbnRWaXNpYmlsaXR5OiBUcmVlVmlzaWJpbGl0eSk6IFRyZWVWaXNpYmlsaXR5IHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmZpbHRlciA/IHRoaXMuZmlsdGVyLmZpbHRlcihub2RlLmVsZW1lbnQsIHBhcmVudFZpc2liaWxpdHkpIDogVHJlZVZpc2liaWxpdHkuVmlzaWJsZTtcblxuXHRcdGlmICh0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicpIHtcblx0XHRcdG5vZGUuZmlsdGVyRGF0YSA9IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybiByZXN1bHQgPyBUcmVlVmlzaWJpbGl0eS5WaXNpYmxlIDogVHJlZVZpc2liaWxpdHkuSGlkZGVuO1xuXHRcdH0gZWxzZSBpZiAoaXNGaWx0ZXJSZXN1bHQ8VEZpbHRlckRhdGE+KHJlc3VsdCkpIHtcblx0XHRcdG5vZGUuZmlsdGVyRGF0YSA9IHJlc3VsdC5kYXRhO1xuXHRcdFx0cmV0dXJuIGdldFZpc2libGVTdGF0ZShyZXN1bHQudmlzaWJpbGl0eSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5vZGUuZmlsdGVyRGF0YSA9IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybiBnZXRWaXNpYmxlU3RhdGUocmVzdWx0KTtcblx0XHR9XG5cdH1cblxuXHQvLyBjaGVhcFxuXHRwcml2YXRlIGhhc1RyZWVOb2RlKGxvY2F0aW9uOiBudW1iZXJbXSwgbm9kZTogSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+ID0gdGhpcy5yb290KTogYm9vbGVhbiB7XG5cdFx0aWYgKCFsb2NhdGlvbiB8fCBsb2NhdGlvbi5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IFtpbmRleCwgLi4ucmVzdF0gPSBsb2NhdGlvbjtcblxuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPiBub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmhhc1RyZWVOb2RlKHJlc3QsIG5vZGUuY2hpbGRyZW5baW5kZXhdKTtcblx0fVxuXG5cdC8vIGNoZWFwXG5cdHByaXZhdGUgZ2V0VHJlZU5vZGUobG9jYXRpb246IG51bWJlcltdLCBub2RlOiBJSW5kZXhUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4gPSB0aGlzLnJvb3QpOiBJSW5kZXhUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4ge1xuXHRcdGlmICghbG9jYXRpb24gfHwgbG9jYXRpb24ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbm9kZTtcblx0XHR9XG5cblx0XHRjb25zdCBbaW5kZXgsIC4uLnJlc3RdID0gbG9jYXRpb247XG5cblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID4gbm9kZS5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBUcmVlRXJyb3IodGhpcy51c2VyLCAnSW52YWxpZCB0cmVlIGxvY2F0aW9uJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZ2V0VHJlZU5vZGUocmVzdCwgbm9kZS5jaGlsZHJlbltpbmRleF0pO1xuXHR9XG5cblx0Ly8gZXhwZW5zaXZlXG5cdHByaXZhdGUgZ2V0VHJlZU5vZGVXaXRoTGlzdEluZGV4KGxvY2F0aW9uOiBudW1iZXJbXSk6IHsgbm9kZTogSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+OyBsaXN0SW5kZXg6IG51bWJlcjsgcmV2ZWFsZWQ6IGJvb2xlYW47IHZpc2libGU6IGJvb2xlYW4gfSB7XG5cdFx0aWYgKGxvY2F0aW9uLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHsgbm9kZTogdGhpcy5yb290LCBsaXN0SW5kZXg6IC0xLCByZXZlYWxlZDogdHJ1ZSwgdmlzaWJsZTogZmFsc2UgfTtcblx0XHR9XG5cblx0XHRjb25zdCB7IHBhcmVudE5vZGUsIGxpc3RJbmRleCwgcmV2ZWFsZWQsIHZpc2libGUgfSA9IHRoaXMuZ2V0UGFyZW50Tm9kZVdpdGhMaXN0SW5kZXgobG9jYXRpb24pO1xuXHRcdGNvbnN0IGluZGV4ID0gbG9jYXRpb25bbG9jYXRpb24ubGVuZ3RoIC0gMV07XG5cblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID4gcGFyZW50Tm9kZS5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBUcmVlRXJyb3IodGhpcy51c2VyLCAnSW52YWxpZCB0cmVlIGxvY2F0aW9uJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9kZSA9IHBhcmVudE5vZGUuY2hpbGRyZW5baW5kZXhdO1xuXG5cdFx0cmV0dXJuIHsgbm9kZSwgbGlzdEluZGV4LCByZXZlYWxlZCwgdmlzaWJsZTogdmlzaWJsZSAmJiBub2RlLnZpc2libGUgfTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UGFyZW50Tm9kZVdpdGhMaXN0SW5kZXgobG9jYXRpb246IG51bWJlcltdLCBub2RlOiBJSW5kZXhUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4gPSB0aGlzLnJvb3QsIGxpc3RJbmRleDogbnVtYmVyID0gMCwgcmV2ZWFsZWQgPSB0cnVlLCB2aXNpYmxlID0gdHJ1ZSk6IHsgcGFyZW50Tm9kZTogSUluZGV4VHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+OyBsaXN0SW5kZXg6IG51bWJlcjsgcmV2ZWFsZWQ6IGJvb2xlYW47IHZpc2libGU6IGJvb2xlYW4gfSB7XG5cdFx0Y29uc3QgW2luZGV4LCAuLi5yZXN0XSA9IGxvY2F0aW9uO1xuXG5cdFx0aWYgKGluZGV4IDwgMCB8fCBpbmRleCA+IG5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHJlZUVycm9yKHRoaXMudXNlciwgJ0ludmFsaWQgdHJlZSBsb2NhdGlvbicpO1xuXHRcdH1cblxuXHRcdC8vIFRPRE9Aam9hbyBwZXJmIVxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgaW5kZXg7IGkrKykge1xuXHRcdFx0bGlzdEluZGV4ICs9IG5vZGUuY2hpbGRyZW5baV0ucmVuZGVyTm9kZUNvdW50O1xuXHRcdH1cblxuXHRcdHJldmVhbGVkID0gcmV2ZWFsZWQgJiYgIW5vZGUuY29sbGFwc2VkO1xuXHRcdHZpc2libGUgPSB2aXNpYmxlICYmIG5vZGUudmlzaWJsZTtcblxuXHRcdGlmIChyZXN0Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHsgcGFyZW50Tm9kZTogbm9kZSwgbGlzdEluZGV4LCByZXZlYWxlZCwgdmlzaWJsZSB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmdldFBhcmVudE5vZGVXaXRoTGlzdEluZGV4KHJlc3QsIG5vZGUuY2hpbGRyZW5baW5kZXhdLCBsaXN0SW5kZXggKyAxLCByZXZlYWxlZCwgdmlzaWJsZSk7XG5cdH1cblxuXHRnZXROb2RlKGxvY2F0aW9uOiBudW1iZXJbXSA9IFtdKTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0VHJlZU5vZGUobG9jYXRpb24pO1xuXHR9XG5cblx0Ly8gVE9ET0Bqb2FvIHBlcmYhXG5cdGdldE5vZGVMb2NhdGlvbihub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KTogbnVtYmVyW10ge1xuXHRcdGNvbnN0IGxvY2F0aW9uOiBudW1iZXJbXSA9IFtdO1xuXHRcdGxldCBpbmRleFRyZWVOb2RlID0gbm9kZSBhcyBJSW5kZXhUcmVlTm9kZTxULCBURmlsdGVyRGF0YT47IC8vIHR5cGluZyB3b2VzXG5cblx0XHR3aGlsZSAoaW5kZXhUcmVlTm9kZS5wYXJlbnQpIHtcblx0XHRcdGxvY2F0aW9uLnB1c2goaW5kZXhUcmVlTm9kZS5wYXJlbnQuY2hpbGRyZW4uaW5kZXhPZihpbmRleFRyZWVOb2RlKSk7XG5cdFx0XHRpbmRleFRyZWVOb2RlID0gaW5kZXhUcmVlTm9kZS5wYXJlbnQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxvY2F0aW9uLnJldmVyc2UoKTtcblx0fVxuXG5cdGdldFBhcmVudE5vZGVMb2NhdGlvbihsb2NhdGlvbjogbnVtYmVyW10pOiBudW1iZXJbXSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGxvY2F0aW9uLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKGxvY2F0aW9uLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGFpbChsb2NhdGlvbilbMF07XG5cdFx0fVxuXHR9XG5cblx0Z2V0Rmlyc3RFbGVtZW50Q2hpbGQobG9jYXRpb246IG51bWJlcltdKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuZ2V0VHJlZU5vZGUobG9jYXRpb24pO1xuXG5cdFx0aWYgKG5vZGUuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBub2RlLmNoaWxkcmVuWzBdLmVsZW1lbnQ7XG5cdH1cblxuXHRnZXRMYXN0RWxlbWVudEFuY2VzdG9yKGxvY2F0aW9uOiBudW1iZXJbXSA9IFtdKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuZ2V0VHJlZU5vZGUobG9jYXRpb24pO1xuXG5cdFx0aWYgKG5vZGUuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9nZXRMYXN0RWxlbWVudEFuY2VzdG9yKG5vZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TGFzdEVsZW1lbnRBbmNlc3Rvcihub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KTogVCB7XG5cdFx0aWYgKG5vZGUuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbm9kZS5lbGVtZW50O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9nZXRMYXN0RWxlbWVudEFuY2VzdG9yKG5vZGUuY2hpbGRyZW5bbm9kZS5jaGlsZHJlbi5sZW5ndGggLSAxXSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQXlKLFdBQVcsc0JBQXNCO0FBQzFMLFNBQVMsUUFBUSxZQUFZO0FBQzdCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxTQUFnQixxQkFBcUI7QUFDOUMsU0FBUyxnQkFBZ0I7QUFpQmxCLFNBQVMsZUFBa0IsS0FBMkM7QUFDNUUsU0FBTyxPQUFPLFFBQVEsWUFBWSxnQkFBZ0IsT0FBTyxVQUFVO0FBQ3BFO0FBRU8sU0FBUyxnQkFBZ0IsWUFBc0Q7QUFDckYsVUFBUSxZQUFZO0FBQUEsSUFDbkIsS0FBSztBQUFNLGFBQU8sZUFBZTtBQUFBLElBQ2pDLEtBQUs7QUFBTyxhQUFPLGVBQWU7QUFBQSxJQUNsQztBQUFTLGFBQU87QUFBQSxFQUNqQjtBQUNEO0FBZ0RBLFNBQVMseUJBQXlCLFFBQStEO0FBQ2hHLFNBQU8sT0FBUSxPQUFlLGdCQUFnQjtBQUMvQztBQUVPLE1BQU0sZUFBc0g7QUFBQSxFQTBCbEksWUFDUyxNQUNSLGFBQ0EsVUFBa0QsQ0FBQyxHQUNsRDtBQUhPO0FBekJULFNBQVMsVUFBVSxDQUFDO0FBR3BCLFNBQVEsZ0JBQWdCLElBQUksY0FBYztBQUUxQyxTQUFpQixvQkFBb0IsSUFBSSxRQUErQztBQUN4RixTQUFTLG1CQUFtQixLQUFLLGtCQUFrQjtBQUVuRCxTQUFpQiw0QkFBNEIsSUFBSSxRQUE2QztBQUM5RixTQUFTLDJCQUEyQixLQUFLLDBCQUEwQjtBQUVuRSxTQUFpQiw0QkFBNEIsSUFBSSxRQUFtRDtBQUNwRyxTQUFTLDJCQUE2RSxLQUFLLGNBQWMsVUFBVSxLQUFLLDBCQUEwQixLQUFLO0FBRXZKLFNBQWlCLDhCQUE4QixJQUFJLFFBQW1DO0FBQ3RGLFNBQVMsNkJBQStELEtBQUssY0FBYyxVQUFVLEtBQUssNEJBQTRCLEtB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
