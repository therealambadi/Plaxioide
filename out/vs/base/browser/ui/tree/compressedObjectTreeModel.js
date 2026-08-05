import { getVisibleState, isFilterResult } from "./indexTreeModel.js";
import { ObjectTreeModel } from "./objectTreeModel.js";
import { TreeError, WeakMapper } from "./tree.js";
import { equals } from "../../../common/arrays.js";
import { Event } from "../../../common/event.js";
import { Iterable } from "../../../common/iterator.js";
function noCompress(element) {
  const elements = [element.element];
  const incompressible = element.incompressible || false;
  return {
    element: { elements, incompressible },
    children: Iterable.map(Iterable.from(element.children), noCompress),
    collapsible: element.collapsible,
    collapsed: element.collapsed
  };
}
function compress(element) {
  const elements = [element.element];
  const incompressible = element.incompressible || false;
  let childrenIterator;
  let children;
  while (true) {
    [children, childrenIterator] = Iterable.consume(Iterable.from(element.children), 2);
    if (children.length !== 1) {
      break;
    }
    if (children[0].incompressible) {
      break;
    }
    element = children[0];
    elements.push(element.element);
  }
  return {
    element: { elements, incompressible },
    children: Iterable.map(Iterable.concat(children, childrenIterator), compress),
    collapsible: element.collapsible,
    collapsed: element.collapsed
  };
}
function _decompress(element, index = 0) {
  let children;
  if (index < element.element.elements.length - 1) {
    children = [_decompress(element, index + 1)];
  } else {
    children = Iterable.map(Iterable.from(element.children), (el) => _decompress(el, 0));
  }
  if (index === 0 && element.element.incompressible) {
    return {
      element: element.element.elements[index],
      children,
      incompressible: true,
      collapsible: element.collapsible,
      collapsed: element.collapsed
    };
  }
  return {
    element: element.element.elements[index],
    children,
    collapsible: element.collapsible,
    collapsed: element.collapsed
  };
}
function decompress(element) {
  return _decompress(element, 0);
}
function splice(treeElement, element, children) {
  if (treeElement.element === element) {
    return { ...treeElement, children };
  }
  return { ...treeElement, children: Iterable.map(Iterable.from(treeElement.children), (e) => splice(e, element, children)) };
}
const wrapIdentityProvider = (base) => ({
  getId(node) {
    return node.elements.map((e) => base.getId(e).toString()).join("\0");
  }
});
class CompressedObjectTreeModel {
  constructor(user, options = {}) {
    this.user = user;
    this.rootRef = null;
    this.nodes = /* @__PURE__ */ new Map();
    this.model = new ObjectTreeModel(user, options);
    this.enabled = typeof options.compressionEnabled === "undefined" ? true : options.compressionEnabled;
    this.identityProvider = options.identityProvider;
  }
  get onDidSpliceRenderedNodes() {
    return this.model.onDidSpliceRenderedNodes;
  }
  get onDidSpliceModel() {
    return this.model.onDidSpliceModel;
  }
  get onDidChangeCollapseState() {
    return this.model.onDidChangeCollapseState;
  }
  get onDidChangeRenderNodeCount() {
    return this.model.onDidChangeRenderNodeCount;
  }
  get size() {
    return this.nodes.size;
  }
  setChildren(element, children = Iterable.empty(), options) {
    const diffIdentityProvider = options.diffIdentityProvider && wrapIdentityProvider(options.diffIdentityProvider);
    if (element === null) {
      const compressedChildren = Iterable.map(children, this.enabled ? compress : noCompress);
      this._setChildren(null, compressedChildren, { diffIdentityProvider, diffDepth: Infinity });
      return;
    }
    const compressedNode = this.nodes.get(element);
    if (!compressedNode) {
      throw new TreeError(this.user, "Unknown compressed tree node");
    }
    const node = this.model.getNode(compressedNode);
    const compressedParentNode = this.model.getParentNodeLocation(compressedNode);
    const parent = this.model.getNode(compressedParentNode);
    const decompressedElement = decompress(node);
    const splicedElement = splice(decompressedElement, element, children);
    const recompressedElement = (this.enabled ? compress : noCompress)(splicedElement);
    const elementComparator = options.diffIdentityProvider ? (a, b) => options.diffIdentityProvider.getId(a) === options.diffIdentityProvider.getId(b) : void 0;
    if (equals(recompressedElement.element.elements, node.element.elements, elementComparator)) {
      this._setChildren(compressedNode, recompressedElement.children || Iterable.empty(), { diffIdentityProvider, diffDepth: 1 });
      return;
    }
    const parentChildren = parent.children.map((child) => child === node ? recompressedElement : child);
    this._setChildren(parent.element, parentChildren, {
      diffIdentityProvider,
      diffDepth: node.depth - parent.depth
    });
  }
  isCompressionEnabled() {
    return this.enabled;
  }
  setCompressionEnabled(enabled) {
    if (enabled === this.enabled) {
      return;
    }
    this.enabled = enabled;
    const root = this.model.getNode();
    const rootChildren = root.children;
    const decompressedRootChildren = Iterable.map(rootChildren, decompress);
    const recompressedRootChildren = Iterable.map(decompressedRootChildren, enabled ? compress : noCompress);
    this._setChildren(null, recompressedRootChildren, {
      diffIdentityProvider: this.identityProvider,
      diffDepth: Infinity
    });
  }
  _setChildren(node, children, options) {
    const insertedElements = /* @__PURE__ */ new Set();
    const onDidCreateNode = (node2) => {
      for (const element of node2.element.elements) {
        insertedElements.add(element);
        this.nodes.set(element, node2.element);
      }
    };
    const onDidDeleteNode = (node2) => {
      for (const element of node2.element.elements) {
        if (!insertedElements.has(element)) {
          this.nodes.delete(element);
        }
      }
    };
    this.model.setChildren(node, children, { ...options, onDidCreateNode, onDidDeleteNode });
  }
  has(element) {
    return this.nodes.has(element);
  }
  getListIndex(location) {
    const node = this.getCompressedNode(location);
    return this.model.getListIndex(node);
  }
  getListRenderCount(location) {
    const node = this.getCompressedNode(location);
    return this.model.getListRenderCount(node);
  }
  getNode(location) {
    if (typeof location === "undefined") {
      return this.model.getNode();
    }
    const node = this.getCompressedNode(location);
    return this.model.getNode(node);
  }
  // TODO: review this
  getNodeLocation(node) {
    const compressedNode = this.model.getNodeLocation(node);
    if (compressedNode === null) {
      return null;
    }
    return compressedNode.elements[compressedNode.elements.length - 1];
  }
  // TODO: review this
  getParentNodeLocation(location) {
    const compressedNode = this.getCompressedNode(location);
    const parentNode = this.model.getParentNodeLocation(compressedNode);
    if (parentNode === null) {
      return null;
    }
    return parentNode.elements[parentNode.elements.length - 1];
  }
  getFirstElementChild(location) {
    const compressedNode = this.getCompressedNode(location);
    return this.model.getFirstElementChild(compressedNode);
  }
  getLastElementAncestor(location) {
    const compressedNode = typeof location === "undefined" ? void 0 : this.getCompressedNode(location);
    return this.model.getLastElementAncestor(compressedNode);
  }
  isCollapsible(location) {
    const compressedNode = this.getCompressedNode(location);
    return this.model.isCollapsible(compressedNode);
  }
  setCollapsible(location, collapsible) {
    const compressedNode = this.getCompressedNode(location);
    return this.model.setCollapsible(compressedNode, collapsible);
  }
  isCollapsed(location) {
    const compressedNode = this.getCompressedNode(location);
    return this.model.isCollapsed(compressedNode);
  }
  setCollapsed(location, collapsed, recursive) {
    const compressedNode = this.getCompressedNode(location);
    return this.model.setCollapsed(compressedNode, collapsed, recursive);
  }
  expandTo(location) {
    const compressedNode = this.getCompressedNode(location);
    this.model.expandTo(compressedNode);
  }
  rerender(location) {
    const compressedNode = this.getCompressedNode(location);
    this.model.rerender(compressedNode);
  }
  refilter() {
    this.model.refilter();
  }
  resort(location = null, recursive = true) {
    const compressedNode = this.getCompressedNode(location);
    this.model.resort(compressedNode, recursive);
  }
  getCompressedNode(element) {
    if (element === null) {
      return null;
    }
    const node = this.nodes.get(element);
    if (!node) {
      throw new TreeError(this.user, `Tree element not found: ${element}`);
    }
    return node;
  }
}
const DefaultElementMapper = (elements) => elements[elements.length - 1];
class CompressedTreeNodeWrapper {
  constructor(unwrapper, node) {
    this.unwrapper = unwrapper;
    this.node = node;
  }
  get element() {
    return this.node.element === null ? null : this.unwrapper(this.node.element);
  }
  get children() {
    return this.node.children.map((node) => new CompressedTreeNodeWrapper(this.unwrapper, node));
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
function mapOptions(compressedNodeUnwrapper, options) {
  return {
    ...options,
    identityProvider: options.identityProvider && {
      getId(node) {
        return options.identityProvider.getId(compressedNodeUnwrapper(node));
      }
    },
    sorter: options.sorter && {
      compare(node, otherNode) {
        return options.sorter.compare(node.elements[0], otherNode.elements[0]);
      }
    },
    filter: options.filter && {
      filter(node, parentVisibility) {
        const elements = node.elements;
        for (let i = 0; i < elements.length - 1; i++) {
          const result = options.filter.filter(elements[i], parentVisibility);
          parentVisibility = getVisibleState(isFilterResult(result) ? result.visibility : result);
        }
        return options.filter.filter(elements[elements.length - 1], parentVisibility);
      }
    }
  };
}
class CompressibleObjectTreeModel {
  constructor(user, options = {}) {
    this.rootRef = null;
    this.elementMapper = options.elementMapper || DefaultElementMapper;
    const compressedNodeUnwrapper = (node) => this.elementMapper(node.elements);
    this.nodeMapper = new WeakMapper((node) => new CompressedTreeNodeWrapper(compressedNodeUnwrapper, node));
    this.model = new CompressedObjectTreeModel(user, mapOptions(compressedNodeUnwrapper, options));
  }
  get onDidSpliceModel() {
    return Event.map(this.model.onDidSpliceModel, ({ insertedNodes, deletedNodes }) => ({
      insertedNodes: insertedNodes.map((node) => this.nodeMapper.map(node)),
      deletedNodes: deletedNodes.map((node) => this.nodeMapper.map(node))
    }));
  }
  get onDidSpliceRenderedNodes() {
    return Event.map(this.model.onDidSpliceRenderedNodes, ({ start, deleteCount, elements }) => ({
      start,
      deleteCount,
      elements: elements.map((node) => this.nodeMapper.map(node))
    }));
  }
  get onDidChangeCollapseState() {
    return Event.map(this.model.onDidChangeCollapseState, ({ node, deep }) => ({
      node: this.nodeMapper.map(node),
      deep
    }));
  }
  get onDidChangeRenderNodeCount() {
    return Event.map(this.model.onDidChangeRenderNodeCount, (node) => this.nodeMapper.map(node));
  }
  setChildren(element, children = Iterable.empty(), options = {}) {
    this.model.setChildren(element, children, options);
  }
  isCompressionEnabled() {
    return this.model.isCompressionEnabled();
  }
  setCompressionEnabled(enabled) {
    this.model.setCompressionEnabled(enabled);
  }
  has(location) {
    return this.model.has(location);
  }
  getListIndex(location) {
    return this.model.getListIndex(location);
  }
  getListRenderCount(location) {
    return this.model.getListRenderCount(location);
  }
  getNode(location) {
    return this.nodeMapper.map(this.model.getNode(location));
  }
  getNodeLocation(node) {
    return node.element;
  }
  getParentNodeLocation(location) {
    return this.model.getParentNodeLocation(location);
  }
  getFirstElementChild(location) {
    const result = this.model.getFirstElementChild(location);
    if (result === null || typeof result === "undefined") {
      return result;
    }
    return this.elementMapper(result.elements);
  }
  getLastElementAncestor(location) {
    const result = this.model.getLastElementAncestor(location);
    if (result === null || typeof result === "undefined") {
      return result;
    }
    return this.elementMapper(result.elements);
  }
  isCollapsible(location) {
    return this.model.isCollapsible(location);
  }
  setCollapsible(location, collapsed) {
    return this.model.setCollapsible(location, collapsed);
  }
  isCollapsed(location) {
    return this.model.isCollapsed(location);
  }
  setCollapsed(location, collapsed, recursive) {
    return this.model.setCollapsed(location, collapsed, recursive);
  }
  expandTo(location) {
    return this.model.expandTo(location);
  }
  rerender(location) {
    return this.model.rerender(location);
  }
  refilter() {
    return this.model.refilter();
  }
  resort(element = null, recursive = true) {
    return this.model.resort(element, recursive);
  }
  getCompressedTreeNode(location = null) {
    return this.model.getNode(location);
  }
}
export {
  CompressedObjectTreeModel,
  CompressibleObjectTreeModel,
  DefaultElementMapper,
  compress,
  decompress
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9jb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUlkZW50aXR5UHJvdmlkZXIgfSBmcm9tICcuLi9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgZ2V0VmlzaWJsZVN0YXRlLCBJSW5kZXhUcmVlTW9kZWxTcGxpY2VPcHRpb25zLCBpc0ZpbHRlclJlc3VsdCB9IGZyb20gJy4vaW5kZXhUcmVlTW9kZWwuanMnO1xuaW1wb3J0IHsgSU9iamVjdFRyZWVNb2RlbCwgSU9iamVjdFRyZWVNb2RlbE9wdGlvbnMsIElPYmplY3RUcmVlTW9kZWxTZXRDaGlsZHJlbk9wdGlvbnMsIE9iamVjdFRyZWVNb2RlbCB9IGZyb20gJy4vb2JqZWN0VHJlZU1vZGVsLmpzJztcbmltcG9ydCB7IElDb2xsYXBzZVN0YXRlQ2hhbmdlRXZlbnQsIElPYmplY3RUcmVlRWxlbWVudCwgSVRyZWVMaXN0U3BsaWNlRGF0YSwgSVRyZWVNb2RlbCwgSVRyZWVNb2RlbFNwbGljZUV2ZW50LCBJVHJlZU5vZGUsIFRyZWVFcnJvciwgVHJlZUZpbHRlclJlc3VsdCwgVHJlZVZpc2liaWxpdHksIFdlYWtNYXBwZXIgfSBmcm9tICcuL3RyZWUuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5cbi8vIEV4cG9ydGVkIG9ubHkgZm9yIHRlc3QgcmVhc29ucywgZG8gbm90IHVzZSBkaXJlY3RseVxuZXhwb3J0IGludGVyZmFjZSBJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFQ+IGV4dGVuZHMgSU9iamVjdFRyZWVFbGVtZW50PFQ+IHtcblx0cmVhZG9ubHkgY2hpbGRyZW4/OiBJdGVyYWJsZTxJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFQ+Pjtcblx0cmVhZG9ubHkgaW5jb21wcmVzc2libGU/OiBib29sZWFuO1xufVxuXG4vLyBFeHBvcnRlZCBvbmx5IGZvciB0ZXN0IHJlYXNvbnMsIGRvIG5vdCB1c2UgZGlyZWN0bHlcbmV4cG9ydCBpbnRlcmZhY2UgSUNvbXByZXNzZWRUcmVlTm9kZTxUPiB7XG5cdHJlYWRvbmx5IGVsZW1lbnRzOiBUW107XG5cdHJlYWRvbmx5IGluY29tcHJlc3NpYmxlOiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiBub0NvbXByZXNzPFQ+KGVsZW1lbnQ6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VD4pOiBJQ29tcHJlc3NlZFRyZWVFbGVtZW50PElDb21wcmVzc2VkVHJlZU5vZGU8VD4+IHtcblx0Y29uc3QgZWxlbWVudHMgPSBbZWxlbWVudC5lbGVtZW50XTtcblx0Y29uc3QgaW5jb21wcmVzc2libGUgPSBlbGVtZW50LmluY29tcHJlc3NpYmxlIHx8IGZhbHNlO1xuXG5cdHJldHVybiB7XG5cdFx0ZWxlbWVudDogeyBlbGVtZW50cywgaW5jb21wcmVzc2libGUgfSxcblx0XHRjaGlsZHJlbjogSXRlcmFibGUubWFwKEl0ZXJhYmxlLmZyb20oZWxlbWVudC5jaGlsZHJlbiksIG5vQ29tcHJlc3MpLFxuXHRcdGNvbGxhcHNpYmxlOiBlbGVtZW50LmNvbGxhcHNpYmxlLFxuXHRcdGNvbGxhcHNlZDogZWxlbWVudC5jb2xsYXBzZWRcblx0fTtcbn1cblxuLy8gRXhwb3J0ZWQgb25seSBmb3IgdGVzdCByZWFzb25zLCBkbyBub3QgdXNlIGRpcmVjdGx5XG5leHBvcnQgZnVuY3Rpb24gY29tcHJlc3M8VD4oZWxlbWVudDogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxUPik6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8SUNvbXByZXNzZWRUcmVlTm9kZTxUPj4ge1xuXHRjb25zdCBlbGVtZW50cyA9IFtlbGVtZW50LmVsZW1lbnRdO1xuXHRjb25zdCBpbmNvbXByZXNzaWJsZSA9IGVsZW1lbnQuaW5jb21wcmVzc2libGUgfHwgZmFsc2U7XG5cblx0bGV0IGNoaWxkcmVuSXRlcmF0b3I6IEl0ZXJhYmxlPElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VD4+O1xuXHRsZXQgY2hpbGRyZW46IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VD5bXTtcblxuXHR3aGlsZSAodHJ1ZSkge1xuXHRcdFtjaGlsZHJlbiwgY2hpbGRyZW5JdGVyYXRvcl0gPSBJdGVyYWJsZS5jb25zdW1lKEl0ZXJhYmxlLmZyb20oZWxlbWVudC5jaGlsZHJlbiksIDIpO1xuXG5cdFx0aWYgKGNoaWxkcmVuLmxlbmd0aCAhPT0gMSkge1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aWYgKGNoaWxkcmVuWzBdLmluY29tcHJlc3NpYmxlKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRlbGVtZW50ID0gY2hpbGRyZW5bMF07XG5cdFx0ZWxlbWVudHMucHVzaChlbGVtZW50LmVsZW1lbnQpO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRlbGVtZW50OiB7IGVsZW1lbnRzLCBpbmNvbXByZXNzaWJsZSB9LFxuXHRcdGNoaWxkcmVuOiBJdGVyYWJsZS5tYXAoSXRlcmFibGUuY29uY2F0KGNoaWxkcmVuLCBjaGlsZHJlbkl0ZXJhdG9yKSwgY29tcHJlc3MpLFxuXHRcdGNvbGxhcHNpYmxlOiBlbGVtZW50LmNvbGxhcHNpYmxlLFxuXHRcdGNvbGxhcHNlZDogZWxlbWVudC5jb2xsYXBzZWRcblx0fTtcbn1cblxuZnVuY3Rpb24gX2RlY29tcHJlc3M8VD4oZWxlbWVudDogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+PiwgaW5kZXggPSAwKTogSUNvbXByZXNzZWRUcmVlRWxlbWVudDxUPiB7XG5cdGxldCBjaGlsZHJlbjogSXRlcmFibGU8SUNvbXByZXNzZWRUcmVlRWxlbWVudDxUPj47XG5cblx0aWYgKGluZGV4IDwgZWxlbWVudC5lbGVtZW50LmVsZW1lbnRzLmxlbmd0aCAtIDEpIHtcblx0XHRjaGlsZHJlbiA9IFtfZGVjb21wcmVzcyhlbGVtZW50LCBpbmRleCArIDEpXTtcblx0fSBlbHNlIHtcblx0XHRjaGlsZHJlbiA9IEl0ZXJhYmxlLm1hcChJdGVyYWJsZS5mcm9tKGVsZW1lbnQuY2hpbGRyZW4pLCBlbCA9PiBfZGVjb21wcmVzcyhlbCwgMCkpO1xuXHR9XG5cblx0aWYgKGluZGV4ID09PSAwICYmIGVsZW1lbnQuZWxlbWVudC5pbmNvbXByZXNzaWJsZSkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRlbGVtZW50OiBlbGVtZW50LmVsZW1lbnQuZWxlbWVudHNbaW5kZXhdLFxuXHRcdFx0Y2hpbGRyZW4sXG5cdFx0XHRpbmNvbXByZXNzaWJsZTogdHJ1ZSxcblx0XHRcdGNvbGxhcHNpYmxlOiBlbGVtZW50LmNvbGxhcHNpYmxlLFxuXHRcdFx0Y29sbGFwc2VkOiBlbGVtZW50LmNvbGxhcHNlZFxuXHRcdH07XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGVsZW1lbnQ6IGVsZW1lbnQuZWxlbWVudC5lbGVtZW50c1tpbmRleF0sXG5cdFx0Y2hpbGRyZW4sXG5cdFx0Y29sbGFwc2libGU6IGVsZW1lbnQuY29sbGFwc2libGUsXG5cdFx0Y29sbGFwc2VkOiBlbGVtZW50LmNvbGxhcHNlZFxuXHR9O1xufVxuXG4vLyBFeHBvcnRlZCBvbmx5IGZvciB0ZXN0IHJlYXNvbnMsIGRvIG5vdCB1c2UgZGlyZWN0bHlcbmV4cG9ydCBmdW5jdGlvbiBkZWNvbXByZXNzPFQ+KGVsZW1lbnQ6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8SUNvbXByZXNzZWRUcmVlTm9kZTxUPj4pOiBJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFQ+IHtcblx0cmV0dXJuIF9kZWNvbXByZXNzKGVsZW1lbnQsIDApO1xufVxuXG5mdW5jdGlvbiBzcGxpY2U8VD4odHJlZUVsZW1lbnQ6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VD4sIGVsZW1lbnQ6IFQsIGNoaWxkcmVuOiBJdGVyYWJsZTxJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFQ+Pik6IElDb21wcmVzc2VkVHJlZUVsZW1lbnQ8VD4ge1xuXHRpZiAodHJlZUVsZW1lbnQuZWxlbWVudCA9PT0gZWxlbWVudCkge1xuXHRcdHJldHVybiB7IC4uLnRyZWVFbGVtZW50LCBjaGlsZHJlbiB9O1xuXHR9XG5cblx0cmV0dXJuIHsgLi4udHJlZUVsZW1lbnQsIGNoaWxkcmVuOiBJdGVyYWJsZS5tYXAoSXRlcmFibGUuZnJvbSh0cmVlRWxlbWVudC5jaGlsZHJlbiksIGUgPT4gc3BsaWNlKGUsIGVsZW1lbnQsIGNoaWxkcmVuKSkgfTtcbn1cblxuaW50ZXJmYWNlIElDb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsT3B0aW9uczxULCBURmlsdGVyRGF0YT4gZXh0ZW5kcyBJT2JqZWN0VHJlZU1vZGVsT3B0aW9uczxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+LCBURmlsdGVyRGF0YT4ge1xuXHRyZWFkb25seSBjb21wcmVzc2lvbkVuYWJsZWQ/OiBib29sZWFuO1xufVxuXG5jb25zdCB3cmFwSWRlbnRpdHlQcm92aWRlciA9IDxUPihiYXNlOiBJSWRlbnRpdHlQcm92aWRlcjxUPik6IElJZGVudGl0eVByb3ZpZGVyPElDb21wcmVzc2VkVHJlZU5vZGU8VD4+ID0+ICh7XG5cdGdldElkKG5vZGUpIHtcblx0XHRyZXR1cm4gbm9kZS5lbGVtZW50cy5tYXAoZSA9PiBiYXNlLmdldElkKGUpLnRvU3RyaW5nKCkpLmpvaW4oJ1xcMCcpO1xuXHR9XG59KTtcblxuLy8gRXhwb3J0ZWQgb25seSBmb3IgdGVzdCByZWFzb25zLCBkbyBub3QgdXNlIGRpcmVjdGx5XG5leHBvcnQgY2xhc3MgQ29tcHJlc3NlZE9iamVjdFRyZWVNb2RlbDxUIGV4dGVuZHMgTm9uTnVsbGFibGU8YW55PiwgVEZpbHRlckRhdGEgZXh0ZW5kcyBOb25OdWxsYWJsZTxhbnk+ID0gdm9pZD4gaW1wbGVtZW50cyBJVHJlZU1vZGVsPElDb21wcmVzc2VkVHJlZU5vZGU8VD4gfCBudWxsLCBURmlsdGVyRGF0YSwgVCB8IG51bGw+IHtcblxuXHRyZWFkb25seSByb290UmVmID0gbnVsbDtcblxuXHRnZXQgb25EaWRTcGxpY2VSZW5kZXJlZE5vZGVzKCk6IEV2ZW50PElUcmVlTGlzdFNwbGljZURhdGE8SUNvbXByZXNzZWRUcmVlTm9kZTxUPiB8IG51bGwsIFRGaWx0ZXJEYXRhPj4geyByZXR1cm4gdGhpcy5tb2RlbC5vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXM7IH1cblx0Z2V0IG9uRGlkU3BsaWNlTW9kZWwoKTogRXZlbnQ8SVRyZWVNb2RlbFNwbGljZUV2ZW50PElDb21wcmVzc2VkVHJlZU5vZGU8VD4gfCBudWxsLCBURmlsdGVyRGF0YT4+IHsgcmV0dXJuIHRoaXMubW9kZWwub25EaWRTcGxpY2VNb2RlbDsgfVxuXHRnZXQgb25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKCk6IEV2ZW50PElDb2xsYXBzZVN0YXRlQ2hhbmdlRXZlbnQ8SUNvbXByZXNzZWRUcmVlTm9kZTxUPiwgVEZpbHRlckRhdGE+PiB7IHJldHVybiB0aGlzLm1vZGVsLm9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZTsgfVxuXHRnZXQgb25EaWRDaGFuZ2VSZW5kZXJOb2RlQ291bnQoKTogRXZlbnQ8SVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8VD4sIFRGaWx0ZXJEYXRhPj4geyByZXR1cm4gdGhpcy5tb2RlbC5vbkRpZENoYW5nZVJlbmRlck5vZGVDb3VudDsgfVxuXG5cdHByaXZhdGUgbW9kZWw6IE9iamVjdFRyZWVNb2RlbDxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+LCBURmlsdGVyRGF0YT47XG5cdHByaXZhdGUgbm9kZXMgPSBuZXcgTWFwPFQgfCBudWxsLCBJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+PigpO1xuXHRwcml2YXRlIGVuYWJsZWQ6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgaWRlbnRpdHlQcm92aWRlcj86IElJZGVudGl0eVByb3ZpZGVyPElDb21wcmVzc2VkVHJlZU5vZGU8VD4+O1xuXG5cdGdldCBzaXplKCk6IG51bWJlciB7IHJldHVybiB0aGlzLm5vZGVzLnNpemU7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHVzZXI6IHN0cmluZyxcblx0XHRvcHRpb25zOiBJQ29tcHJlc3NlZE9iamVjdFRyZWVNb2RlbE9wdGlvbnM8VCwgVEZpbHRlckRhdGE+ID0ge31cblx0KSB7XG5cdFx0dGhpcy5tb2RlbCA9IG5ldyBPYmplY3RUcmVlTW9kZWwodXNlciwgb3B0aW9ucyk7XG5cdFx0dGhpcy5lbmFibGVkID0gdHlwZW9mIG9wdGlvbnMuY29tcHJlc3Npb25FbmFibGVkID09PSAndW5kZWZpbmVkJyA/IHRydWUgOiBvcHRpb25zLmNvbXByZXNzaW9uRW5hYmxlZDtcblx0XHR0aGlzLmlkZW50aXR5UHJvdmlkZXIgPSBvcHRpb25zLmlkZW50aXR5UHJvdmlkZXI7XG5cdH1cblxuXHRzZXRDaGlsZHJlbihcblx0XHRlbGVtZW50OiBUIHwgbnVsbCxcblx0XHRjaGlsZHJlbjogSXRlcmFibGU8SUNvbXByZXNzZWRUcmVlRWxlbWVudDxUPj4gPSBJdGVyYWJsZS5lbXB0eSgpLFxuXHRcdG9wdGlvbnM6IElPYmplY3RUcmVlTW9kZWxTZXRDaGlsZHJlbk9wdGlvbnM8VCwgVEZpbHRlckRhdGE+LFxuXHQpOiB2b2lkIHtcblx0XHQvLyBEaWZmcyBtdXN0IGJlIGRlZXAsIHNpbmNlIHRoZSBjb21wcmVzc2lvbiBjYW4gYWZmZWN0IG5lc3RlZCBlbGVtZW50cy5cblx0XHQvLyBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL3B1bGwvMTE0MjM3I2lzc3VlY29tbWVudC03NTk0MjUwMzRcblxuXHRcdGNvbnN0IGRpZmZJZGVudGl0eVByb3ZpZGVyID0gb3B0aW9ucy5kaWZmSWRlbnRpdHlQcm92aWRlciAmJiB3cmFwSWRlbnRpdHlQcm92aWRlcihvcHRpb25zLmRpZmZJZGVudGl0eVByb3ZpZGVyKTtcblx0XHRpZiAoZWxlbWVudCA9PT0gbnVsbCkge1xuXHRcdFx0Y29uc3QgY29tcHJlc3NlZENoaWxkcmVuID0gSXRlcmFibGUubWFwKGNoaWxkcmVuLCB0aGlzLmVuYWJsZWQgPyBjb21wcmVzcyA6IG5vQ29tcHJlc3MpO1xuXHRcdFx0dGhpcy5fc2V0Q2hpbGRyZW4obnVsbCwgY29tcHJlc3NlZENoaWxkcmVuLCB7IGRpZmZJZGVudGl0eVByb3ZpZGVyLCBkaWZmRGVwdGg6IEluZmluaXR5IH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbXByZXNzZWROb2RlID0gdGhpcy5ub2Rlcy5nZXQoZWxlbWVudCk7XG5cblx0XHRpZiAoIWNvbXByZXNzZWROb2RlKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHJlZUVycm9yKHRoaXMudXNlciwgJ1Vua25vd24gY29tcHJlc3NlZCB0cmVlIG5vZGUnKTtcblx0XHR9XG5cblx0XHRjb25zdCBub2RlID0gdGhpcy5tb2RlbC5nZXROb2RlKGNvbXByZXNzZWROb2RlKSBhcyBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxUPiwgVEZpbHRlckRhdGE+O1xuXHRcdGNvbnN0IGNvbXByZXNzZWRQYXJlbnROb2RlID0gdGhpcy5tb2RlbC5nZXRQYXJlbnROb2RlTG9jYXRpb24oY29tcHJlc3NlZE5vZGUpO1xuXHRcdGNvbnN0IHBhcmVudCA9IHRoaXMubW9kZWwuZ2V0Tm9kZShjb21wcmVzc2VkUGFyZW50Tm9kZSkgYXMgSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8VD4sIFRGaWx0ZXJEYXRhPjtcblxuXHRcdGNvbnN0IGRlY29tcHJlc3NlZEVsZW1lbnQgPSBkZWNvbXByZXNzKG5vZGUpO1xuXHRcdGNvbnN0IHNwbGljZWRFbGVtZW50ID0gc3BsaWNlKGRlY29tcHJlc3NlZEVsZW1lbnQsIGVsZW1lbnQsIGNoaWxkcmVuKTtcblx0XHRjb25zdCByZWNvbXByZXNzZWRFbGVtZW50ID0gKHRoaXMuZW5hYmxlZCA/IGNvbXByZXNzIDogbm9Db21wcmVzcykoc3BsaWNlZEVsZW1lbnQpO1xuXG5cdFx0Ly8gSWYgdGhlIHJlY29tcHJlc3NlZCBub2RlIGlzIGlkZW50aWNhbCB0byB0aGUgb3JpZ2luYWwsIGp1c3Qgc2V0IGl0cyBjaGlsZHJlbi5cblx0XHQvLyBTYXZlcyB3b3JrIGFuZCBjaHVybiBkaWZmaW5nIHRoZSBwYXJlbnQgZWxlbWVudC5cblx0XHRjb25zdCBlbGVtZW50Q29tcGFyYXRvciA9IG9wdGlvbnMuZGlmZklkZW50aXR5UHJvdmlkZXJcblx0XHRcdD8gKChhOiBULCBiOiBUKSA9PiBvcHRpb25zLmRpZmZJZGVudGl0eVByb3ZpZGVyIS5nZXRJZChhKSA9PT0gb3B0aW9ucy5kaWZmSWRlbnRpdHlQcm92aWRlciEuZ2V0SWQoYikpXG5cdFx0XHQ6IHVuZGVmaW5lZDtcblx0XHRpZiAoZXF1YWxzKHJlY29tcHJlc3NlZEVsZW1lbnQuZWxlbWVudC5lbGVtZW50cywgbm9kZS5lbGVtZW50LmVsZW1lbnRzLCBlbGVtZW50Q29tcGFyYXRvcikpIHtcblx0XHRcdHRoaXMuX3NldENoaWxkcmVuKGNvbXByZXNzZWROb2RlLCByZWNvbXByZXNzZWRFbGVtZW50LmNoaWxkcmVuIHx8IEl0ZXJhYmxlLmVtcHR5KCksIHsgZGlmZklkZW50aXR5UHJvdmlkZXIsIGRpZmZEZXB0aDogMSB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYXJlbnRDaGlsZHJlbiA9IHBhcmVudC5jaGlsZHJlblxuXHRcdFx0Lm1hcChjaGlsZCA9PiBjaGlsZCA9PT0gbm9kZSA/IHJlY29tcHJlc3NlZEVsZW1lbnQgOiBjaGlsZCk7XG5cblx0XHR0aGlzLl9zZXRDaGlsZHJlbihwYXJlbnQuZWxlbWVudCwgcGFyZW50Q2hpbGRyZW4sIHtcblx0XHRcdGRpZmZJZGVudGl0eVByb3ZpZGVyLFxuXHRcdFx0ZGlmZkRlcHRoOiBub2RlLmRlcHRoIC0gcGFyZW50LmRlcHRoLFxuXHRcdH0pO1xuXHR9XG5cblx0aXNDb21wcmVzc2lvbkVuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZW5hYmxlZDtcblx0fVxuXG5cdHNldENvbXByZXNzaW9uRW5hYmxlZChlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKGVuYWJsZWQgPT09IHRoaXMuZW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZW5hYmxlZCA9IGVuYWJsZWQ7XG5cblx0XHRjb25zdCByb290ID0gdGhpcy5tb2RlbC5nZXROb2RlKCk7XG5cdFx0Y29uc3Qgcm9vdENoaWxkcmVuID0gcm9vdC5jaGlsZHJlbiBhcyBJVHJlZU5vZGU8SUNvbXByZXNzZWRUcmVlTm9kZTxUPj5bXTtcblx0XHRjb25zdCBkZWNvbXByZXNzZWRSb290Q2hpbGRyZW4gPSBJdGVyYWJsZS5tYXAocm9vdENoaWxkcmVuLCBkZWNvbXByZXNzKTtcblx0XHRjb25zdCByZWNvbXByZXNzZWRSb290Q2hpbGRyZW4gPSBJdGVyYWJsZS5tYXAoZGVjb21wcmVzc2VkUm9vdENoaWxkcmVuLCBlbmFibGVkID8gY29tcHJlc3MgOiBub0NvbXByZXNzKTtcblxuXHRcdC8vIGl0IHNob3VsZCBiZSBzYWZlIHRvIGFsd2F5cyB1c2UgZGVlcCBkaWZmIG1vZGUgaGVyZSBpZiBhbiBpZGVudGl0eVxuXHRcdC8vIHByb3ZpZGVyIGlzIGF2YWlsYWJsZSwgc2luY2Ugd2Uga25vdyB0aGUgcmF3IG5vZGVzIGFyZSB1bmNoYW5nZWQuXG5cdFx0dGhpcy5fc2V0Q2hpbGRyZW4obnVsbCwgcmVjb21wcmVzc2VkUm9vdENoaWxkcmVuLCB7XG5cdFx0XHRkaWZmSWRlbnRpdHlQcm92aWRlcjogdGhpcy5pZGVudGl0eVByb3ZpZGVyLFxuXHRcdFx0ZGlmZkRlcHRoOiBJbmZpbml0eSxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3NldENoaWxkcmVuKFxuXHRcdG5vZGU6IElDb21wcmVzc2VkVHJlZU5vZGU8VD4gfCBudWxsLFxuXHRcdGNoaWxkcmVuOiBJdGVyYWJsZTxJT2JqZWN0VHJlZUVsZW1lbnQ8SUNvbXByZXNzZWRUcmVlTm9kZTxUPj4+LFxuXHRcdG9wdGlvbnM6IElJbmRleFRyZWVNb2RlbFNwbGljZU9wdGlvbnM8SUNvbXByZXNzZWRUcmVlTm9kZTxUPiwgVEZpbHRlckRhdGE+LFxuXHQpOiB2b2lkIHtcblx0XHRjb25zdCBpbnNlcnRlZEVsZW1lbnRzID0gbmV3IFNldDxUIHwgbnVsbD4oKTtcblx0XHRjb25zdCBvbkRpZENyZWF0ZU5vZGUgPSAobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8VD4sIFRGaWx0ZXJEYXRhPikgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIG5vZGUuZWxlbWVudC5lbGVtZW50cykge1xuXHRcdFx0XHRpbnNlcnRlZEVsZW1lbnRzLmFkZChlbGVtZW50KTtcblx0XHRcdFx0dGhpcy5ub2Rlcy5zZXQoZWxlbWVudCwgbm9kZS5lbGVtZW50KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3Qgb25EaWREZWxldGVOb2RlID0gKG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+LCBURmlsdGVyRGF0YT4pID0+IHtcblx0XHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBub2RlLmVsZW1lbnQuZWxlbWVudHMpIHtcblx0XHRcdFx0aWYgKCFpbnNlcnRlZEVsZW1lbnRzLmhhcyhlbGVtZW50KSkge1xuXHRcdFx0XHRcdHRoaXMubm9kZXMuZGVsZXRlKGVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMubW9kZWwuc2V0Q2hpbGRyZW4obm9kZSwgY2hpbGRyZW4sIHsgLi4ub3B0aW9ucywgb25EaWRDcmVhdGVOb2RlLCBvbkRpZERlbGV0ZU5vZGUgfSk7XG5cdH1cblxuXHRoYXMoZWxlbWVudDogVCB8IG51bGwpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5ub2Rlcy5oYXMoZWxlbWVudCk7XG5cdH1cblxuXHRnZXRMaXN0SW5kZXgobG9jYXRpb246IFQgfCBudWxsKTogbnVtYmVyIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy5nZXRDb21wcmVzc2VkTm9kZShsb2NhdGlvbik7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0TGlzdEluZGV4KG5vZGUpO1xuXHR9XG5cblx0Z2V0TGlzdFJlbmRlckNvdW50KGxvY2F0aW9uOiBUIHwgbnVsbCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMuZ2V0Q29tcHJlc3NlZE5vZGUobG9jYXRpb24pO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldExpc3RSZW5kZXJDb3VudChub2RlKTtcblx0fVxuXG5cdGdldE5vZGUobG9jYXRpb24/OiBUIHwgbnVsbCB8IHVuZGVmaW5lZCk6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+IHwgbnVsbCwgVEZpbHRlckRhdGE+IHtcblx0XHRpZiAodHlwZW9mIGxvY2F0aW9uID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0Tm9kZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLmdldENvbXByZXNzZWROb2RlKGxvY2F0aW9uKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXROb2RlKG5vZGUpO1xuXHR9XG5cblx0Ly8gVE9ETzogcmV2aWV3IHRoaXNcblx0Z2V0Tm9kZUxvY2F0aW9uKG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+LCBURmlsdGVyRGF0YT4pOiBUIHwgbnVsbCB7XG5cdFx0Y29uc3QgY29tcHJlc3NlZE5vZGUgPSB0aGlzLm1vZGVsLmdldE5vZGVMb2NhdGlvbihub2RlKTtcblxuXHRcdGlmIChjb21wcmVzc2VkTm9kZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbXByZXNzZWROb2RlLmVsZW1lbnRzW2NvbXByZXNzZWROb2RlLmVsZW1lbnRzLmxlbmd0aCAtIDFdO1xuXHR9XG5cblx0Ly8gVE9ETzogcmV2aWV3IHRoaXNcblx0Z2V0UGFyZW50Tm9kZUxvY2F0aW9uKGxvY2F0aW9uOiBUIHwgbnVsbCk6IFQgfCBudWxsIHtcblx0XHRjb25zdCBjb21wcmVzc2VkTm9kZSA9IHRoaXMuZ2V0Q29tcHJlc3NlZE5vZGUobG9jYXRpb24pO1xuXHRcdGNvbnN0IHBhcmVudE5vZGUgPSB0aGlzLm1vZGVsLmdldFBhcmVudE5vZGVMb2NhdGlvbihjb21wcmVzc2VkTm9kZSk7XG5cblx0XHRpZiAocGFyZW50Tm9kZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBhcmVudE5vZGUuZWxlbWVudHNbcGFyZW50Tm9kZS5lbGVtZW50cy5sZW5ndGggLSAxXTtcblx0fVxuXG5cdGdldEZpcnN0RWxlbWVudENoaWxkKGxvY2F0aW9uOiBUIHwgbnVsbCk6IElDb21wcmVzc2VkVHJlZU5vZGU8VD4gfCBudWxsIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBjb21wcmVzc2VkTm9kZSA9IHRoaXMuZ2V0Q29tcHJlc3NlZE5vZGUobG9jYXRpb24pO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldEZpcnN0RWxlbWVudENoaWxkKGNvbXByZXNzZWROb2RlKTtcblx0fVxuXG5cdGdldExhc3RFbGVtZW50QW5jZXN0b3IobG9jYXRpb24/OiBUIHwgbnVsbCB8IHVuZGVmaW5lZCk6IElDb21wcmVzc2VkVHJlZU5vZGU8VD4gfCBudWxsIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBjb21wcmVzc2VkTm9kZSA9IHR5cGVvZiBsb2NhdGlvbiA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiB0aGlzLmdldENvbXByZXNzZWROb2RlKGxvY2F0aW9uKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRMYXN0RWxlbWVudEFuY2VzdG9yKGNvbXByZXNzZWROb2RlKTtcblx0fVxuXG5cdGlzQ29sbGFwc2libGUobG9jYXRpb246IFQgfCBudWxsKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgY29tcHJlc3NlZE5vZGUgPSB0aGlzLmdldENvbXByZXNzZWROb2RlKGxvY2F0aW9uKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5pc0NvbGxhcHNpYmxlKGNvbXByZXNzZWROb2RlKTtcblx0fVxuXG5cdHNldENvbGxhcHNpYmxlKGxvY2F0aW9uOiBUIHwgbnVsbCwgY29sbGFwc2libGU/OiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgY29tcHJlc3NlZE5vZGUgPSB0aGlzLmdldENvbXByZXNzZWROb2RlKGxvY2F0aW9uKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5zZXRDb2xsYXBzaWJsZShjb21wcmVzc2VkTm9kZSwgY29sbGFwc2libGUpO1xuXHR9XG5cblx0aXNDb2xsYXBzZWQobG9jYXRpb246IFQgfCBudWxsKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgY29tcHJlc3NlZE5vZGUgPSB0aGlzLmdldENvbXByZXNzZWROb2RlKGxvY2F0aW9uKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5pc0NvbGxhcHNlZChjb21wcmVzc2VkTm9kZSk7XG5cdH1cblxuXHRzZXRDb2xsYXBzZWQobG9jYXRpb246IFQgfCBudWxsLCBjb2xsYXBzZWQ/OiBib29sZWFuIHwgdW5kZWZpbmVkLCByZWN1cnNpdmU/OiBib29sZWFuIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgY29tcHJlc3NlZE5vZGUgPSB0aGlzLmdldENvbXByZXNzZWROb2RlKGxvY2F0aW9uKTtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5zZXRDb2xsYXBzZWQoY29tcHJlc3NlZE5vZGUsIGNvbGxhcHNlZCwgcmVjdXJzaXZlKTtcblx0fVxuXG5cdGV4cGFuZFRvKGxvY2F0aW9uOiBUIHwgbnVsbCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXByZXNzZWROb2RlID0gdGhpcy5nZXRDb21wcmVzc2VkTm9kZShsb2NhdGlvbik7XG5cdFx0dGhpcy5tb2RlbC5leHBhbmRUbyhjb21wcmVzc2VkTm9kZSk7XG5cdH1cblxuXHRyZXJlbmRlcihsb2NhdGlvbjogVCB8IG51bGwpOiB2b2lkIHtcblx0XHRjb25zdCBjb21wcmVzc2VkTm9kZSA9IHRoaXMuZ2V0Q29tcHJlc3NlZE5vZGUobG9jYXRpb24pO1xuXHRcdHRoaXMubW9kZWwucmVyZW5kZXIoY29tcHJlc3NlZE5vZGUpO1xuXHR9XG5cblx0cmVmaWx0ZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC5yZWZpbHRlcigpO1xuXHR9XG5cblx0cmVzb3J0KGxvY2F0aW9uOiBUIHwgbnVsbCA9IG51bGwsIHJlY3Vyc2l2ZSA9IHRydWUpOiB2b2lkIHtcblx0XHRjb25zdCBjb21wcmVzc2VkTm9kZSA9IHRoaXMuZ2V0Q29tcHJlc3NlZE5vZGUobG9jYXRpb24pO1xuXHRcdHRoaXMubW9kZWwucmVzb3J0KGNvbXByZXNzZWROb2RlLCByZWN1cnNpdmUpO1xuXHR9XG5cblx0Z2V0Q29tcHJlc3NlZE5vZGUoZWxlbWVudDogVCB8IG51bGwpOiBJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+IHwgbnVsbCB7XG5cdFx0aWYgKGVsZW1lbnQgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLm5vZGVzLmdldChlbGVtZW50KTtcblxuXHRcdGlmICghbm9kZSkge1xuXHRcdFx0dGhyb3cgbmV3IFRyZWVFcnJvcih0aGlzLnVzZXIsIGBUcmVlIGVsZW1lbnQgbm90IGZvdW5kOiAke2VsZW1lbnR9YCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5vZGU7XG5cdH1cbn1cblxuLy8gQ29tcHJlc3NpYmxlIE9iamVjdCBUcmVlXG5cbmV4cG9ydCB0eXBlIEVsZW1lbnRNYXBwZXI8VD4gPSAoZWxlbWVudHM6IFRbXSkgPT4gVDtcbmV4cG9ydCBjb25zdCBEZWZhdWx0RWxlbWVudE1hcHBlcjogRWxlbWVudE1hcHBlcjxhbnk+ID0gZWxlbWVudHMgPT4gZWxlbWVudHNbZWxlbWVudHMubGVuZ3RoIC0gMV07XG5cbmV4cG9ydCB0eXBlIENvbXByZXNzZWROb2RlVW53cmFwcGVyPFQ+ID0gKG5vZGU6IElDb21wcmVzc2VkVHJlZU5vZGU8VD4pID0+IFQ7XG50eXBlIENvbXByZXNzZWROb2RlV2Vha01hcHBlcjxULCBURmlsdGVyRGF0YT4gPSBXZWFrTWFwcGVyPElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+IHwgbnVsbCwgVEZpbHRlckRhdGE+LCBJVHJlZU5vZGU8VCB8IG51bGwsIFRGaWx0ZXJEYXRhPj47XG5cbmNsYXNzIENvbXByZXNzZWRUcmVlTm9kZVdyYXBwZXI8VCwgVEZpbHRlckRhdGE+IGltcGxlbWVudHMgSVRyZWVOb2RlPFQgfCBudWxsLCBURmlsdGVyRGF0YT4ge1xuXG5cdGdldCBlbGVtZW50KCk6IFQgfCBudWxsIHsgcmV0dXJuIHRoaXMubm9kZS5lbGVtZW50ID09PSBudWxsID8gbnVsbCA6IHRoaXMudW53cmFwcGVyKHRoaXMubm9kZS5lbGVtZW50KTsgfVxuXHRnZXQgY2hpbGRyZW4oKTogSVRyZWVOb2RlPFQgfCBudWxsLCBURmlsdGVyRGF0YT5bXSB7IHJldHVybiB0aGlzLm5vZGUuY2hpbGRyZW4ubWFwKG5vZGUgPT4gbmV3IENvbXByZXNzZWRUcmVlTm9kZVdyYXBwZXIodGhpcy51bndyYXBwZXIsIG5vZGUpKTsgfVxuXHRnZXQgZGVwdGgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMubm9kZS5kZXB0aDsgfVxuXHRnZXQgdmlzaWJsZUNoaWxkcmVuQ291bnQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMubm9kZS52aXNpYmxlQ2hpbGRyZW5Db3VudDsgfVxuXHRnZXQgdmlzaWJsZUNoaWxkSW5kZXgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMubm9kZS52aXNpYmxlQ2hpbGRJbmRleDsgfVxuXHRnZXQgY29sbGFwc2libGUoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLm5vZGUuY29sbGFwc2libGU7IH1cblx0Z2V0IGNvbGxhcHNlZCgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMubm9kZS5jb2xsYXBzZWQ7IH1cblx0Z2V0IHZpc2libGUoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLm5vZGUudmlzaWJsZTsgfVxuXHRnZXQgZmlsdGVyRGF0YSgpOiBURmlsdGVyRGF0YSB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLm5vZGUuZmlsdGVyRGF0YTsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgdW53cmFwcGVyOiBDb21wcmVzc2VkTm9kZVVud3JhcHBlcjxUPixcblx0XHRwcml2YXRlIG5vZGU6IElUcmVlTm9kZTxJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+IHwgbnVsbCwgVEZpbHRlckRhdGE+XG5cdCkgeyB9XG59XG5cbmZ1bmN0aW9uIG1hcE9wdGlvbnM8VCwgVEZpbHRlckRhdGE+KGNvbXByZXNzZWROb2RlVW53cmFwcGVyOiBDb21wcmVzc2VkTm9kZVVud3JhcHBlcjxUPiwgb3B0aW9uczogSUNvbXByZXNzaWJsZU9iamVjdFRyZWVNb2RlbE9wdGlvbnM8VCwgVEZpbHRlckRhdGE+KTogSUNvbXByZXNzZWRPYmplY3RUcmVlTW9kZWxPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiB7XG5cdHJldHVybiB7XG5cdFx0Li4ub3B0aW9ucyxcblx0XHRpZGVudGl0eVByb3ZpZGVyOiBvcHRpb25zLmlkZW50aXR5UHJvdmlkZXIgJiYge1xuXHRcdFx0Z2V0SWQobm9kZTogSUNvbXByZXNzZWRUcmVlTm9kZTxUPik6IHsgdG9TdHJpbmcoKTogc3RyaW5nIH0ge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5pZGVudGl0eVByb3ZpZGVyIS5nZXRJZChjb21wcmVzc2VkTm9kZVVud3JhcHBlcihub2RlKSk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRzb3J0ZXI6IG9wdGlvbnMuc29ydGVyICYmIHtcblx0XHRcdGNvbXBhcmUobm9kZTogSUNvbXByZXNzZWRUcmVlTm9kZTxUPiwgb3RoZXJOb2RlOiBJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+KTogbnVtYmVyIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuc29ydGVyIS5jb21wYXJlKG5vZGUuZWxlbWVudHNbMF0sIG90aGVyTm9kZS5lbGVtZW50c1swXSk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRmaWx0ZXI6IG9wdGlvbnMuZmlsdGVyICYmIHtcblx0XHRcdGZpbHRlcihub2RlOiBJQ29tcHJlc3NlZFRyZWVOb2RlPFQ+LCBwYXJlbnRWaXNpYmlsaXR5OiBUcmVlVmlzaWJpbGl0eSk6IFRyZWVGaWx0ZXJSZXN1bHQ8VEZpbHRlckRhdGE+IHtcblx0XHRcdFx0Y29uc3QgZWxlbWVudHMgPSBub2RlLmVsZW1lbnRzO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGVsZW1lbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IG9wdGlvbnMuZmlsdGVyIS5maWx0ZXIoZWxlbWVudHNbaV0sIHBhcmVudFZpc2liaWxpdHkpO1xuXHRcdFx0XHRcdHBhcmVudFZpc2liaWxpdHkgPSBnZXRWaXNpYmxlU3RhdGUoaXNGaWx0ZXJSZXN1bHQocmVzdWx0KSA/IHJlc3VsdC52aXNpYmlsaXR5IDogcmVzdWx0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5maWx0ZXIhLmZpbHRlcihlbGVtZW50c1tlbGVtZW50cy5sZW5ndGggLSAxXSwgcGFyZW50VmlzaWJpbGl0eSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wcmVzc2libGVPYmplY3RUcmVlTW9kZWxPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiBleHRlbmRzIElPYmplY3RUcmVlTW9kZWxPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiB7XG5cdHJlYWRvbmx5IGNvbXByZXNzaW9uRW5hYmxlZD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGVsZW1lbnRNYXBwZXI/OiBFbGVtZW50TWFwcGVyPFQ+O1xufVxuXG5leHBvcnQgY2xhc3MgQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU1vZGVsPFQgZXh0ZW5kcyBOb25OdWxsYWJsZTxhbnk+LCBURmlsdGVyRGF0YSBleHRlbmRzIE5vbk51bGxhYmxlPGFueT4gPSB2b2lkPiBpbXBsZW1lbnRzIElPYmplY3RUcmVlTW9kZWw8VCwgVEZpbHRlckRhdGE+IHtcblxuXHRyZWFkb25seSByb290UmVmID0gbnVsbDtcblxuXHRnZXQgb25EaWRTcGxpY2VNb2RlbCgpOiBFdmVudDxJVHJlZU1vZGVsU3BsaWNlRXZlbnQ8VCB8IG51bGwsIFRGaWx0ZXJEYXRhPj4ge1xuXHRcdHJldHVybiBFdmVudC5tYXAodGhpcy5tb2RlbC5vbkRpZFNwbGljZU1vZGVsLCAoeyBpbnNlcnRlZE5vZGVzLCBkZWxldGVkTm9kZXMgfSkgPT4gKHtcblx0XHRcdGluc2VydGVkTm9kZXM6IGluc2VydGVkTm9kZXMubWFwKG5vZGUgPT4gdGhpcy5ub2RlTWFwcGVyLm1hcChub2RlKSksXG5cdFx0XHRkZWxldGVkTm9kZXM6IGRlbGV0ZWROb2Rlcy5tYXAobm9kZSA9PiB0aGlzLm5vZGVNYXBwZXIubWFwKG5vZGUpKSxcblx0XHR9KSk7XG5cdH1cblxuXHRnZXQgb25EaWRTcGxpY2VSZW5kZXJlZE5vZGVzKCk6IEV2ZW50PElUcmVlTGlzdFNwbGljZURhdGE8VCB8IG51bGwsIFRGaWx0ZXJEYXRhPj4ge1xuXHRcdHJldHVybiBFdmVudC5tYXAodGhpcy5tb2RlbC5vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXMsICh7IHN0YXJ0LCBkZWxldGVDb3VudCwgZWxlbWVudHMgfSkgPT4gKHtcblx0XHRcdHN0YXJ0LFxuXHRcdFx0ZGVsZXRlQ291bnQsXG5cdFx0XHRlbGVtZW50czogZWxlbWVudHMubWFwKG5vZGUgPT4gdGhpcy5ub2RlTWFwcGVyLm1hcChub2RlKSlcblx0XHR9KSk7XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKCk6IEV2ZW50PElDb2xsYXBzZVN0YXRlQ2hhbmdlRXZlbnQ8VCB8IG51bGwsIFRGaWx0ZXJEYXRhPj4ge1xuXHRcdHJldHVybiBFdmVudC5tYXAodGhpcy5tb2RlbC5vbkRpZENoYW5nZUNvbGxhcHNlU3RhdGUsICh7IG5vZGUsIGRlZXAgfSkgPT4gKHtcblx0XHRcdG5vZGU6IHRoaXMubm9kZU1hcHBlci5tYXAobm9kZSksXG5cdFx0XHRkZWVwXG5cdFx0fSkpO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50KCk6IEV2ZW50PElUcmVlTm9kZTxUIHwgbnVsbCwgVEZpbHRlckRhdGE+PiB7XG5cdFx0cmV0dXJuIEV2ZW50Lm1hcCh0aGlzLm1vZGVsLm9uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50LCBub2RlID0+IHRoaXMubm9kZU1hcHBlci5tYXAobm9kZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBlbGVtZW50TWFwcGVyOiBFbGVtZW50TWFwcGVyPFQ+O1xuXHRwcml2YXRlIG5vZGVNYXBwZXI6IENvbXByZXNzZWROb2RlV2Vha01hcHBlcjxULCBURmlsdGVyRGF0YT47XG5cdHByaXZhdGUgbW9kZWw6IENvbXByZXNzZWRPYmplY3RUcmVlTW9kZWw8VCwgVEZpbHRlckRhdGE+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHVzZXI6IHN0cmluZyxcblx0XHRvcHRpb25zOiBJQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU1vZGVsT3B0aW9uczxULCBURmlsdGVyRGF0YT4gPSB7fVxuXHQpIHtcblx0XHR0aGlzLmVsZW1lbnRNYXBwZXIgPSBvcHRpb25zLmVsZW1lbnRNYXBwZXIgfHwgRGVmYXVsdEVsZW1lbnRNYXBwZXI7XG5cdFx0Y29uc3QgY29tcHJlc3NlZE5vZGVVbndyYXBwZXI6IENvbXByZXNzZWROb2RlVW53cmFwcGVyPFQ+ID0gbm9kZSA9PiB0aGlzLmVsZW1lbnRNYXBwZXIobm9kZS5lbGVtZW50cyk7XG5cdFx0dGhpcy5ub2RlTWFwcGVyID0gbmV3IFdlYWtNYXBwZXIobm9kZSA9PiBuZXcgQ29tcHJlc3NlZFRyZWVOb2RlV3JhcHBlcihjb21wcmVzc2VkTm9kZVVud3JhcHBlciwgbm9kZSkpO1xuXG5cdFx0dGhpcy5tb2RlbCA9IG5ldyBDb21wcmVzc2VkT2JqZWN0VHJlZU1vZGVsKHVzZXIsIG1hcE9wdGlvbnMoY29tcHJlc3NlZE5vZGVVbndyYXBwZXIsIG9wdGlvbnMpKTtcblx0fVxuXG5cdHNldENoaWxkcmVuKFxuXHRcdGVsZW1lbnQ6IFQgfCBudWxsLFxuXHRcdGNoaWxkcmVuOiBJdGVyYWJsZTxJQ29tcHJlc3NlZFRyZWVFbGVtZW50PFQ+PiA9IEl0ZXJhYmxlLmVtcHR5KCksXG5cdFx0b3B0aW9uczogSU9iamVjdFRyZWVNb2RlbFNldENoaWxkcmVuT3B0aW9uczxULCBURmlsdGVyRGF0YT4gPSB7fSxcblx0KTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC5zZXRDaGlsZHJlbihlbGVtZW50LCBjaGlsZHJlbiwgb3B0aW9ucyk7XG5cdH1cblxuXHRpc0NvbXByZXNzaW9uRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5pc0NvbXByZXNzaW9uRW5hYmxlZCgpO1xuXHR9XG5cblx0c2V0Q29tcHJlc3Npb25FbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLnNldENvbXByZXNzaW9uRW5hYmxlZChlbmFibGVkKTtcblx0fVxuXG5cdGhhcyhsb2NhdGlvbjogVCB8IG51bGwpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5oYXMobG9jYXRpb24pO1xuXHR9XG5cblx0Z2V0TGlzdEluZGV4KGxvY2F0aW9uOiBUIHwgbnVsbCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0TGlzdEluZGV4KGxvY2F0aW9uKTtcblx0fVxuXG5cdGdldExpc3RSZW5kZXJDb3VudChsb2NhdGlvbjogVCB8IG51bGwpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldExpc3RSZW5kZXJDb3VudChsb2NhdGlvbik7XG5cdH1cblxuXHRnZXROb2RlKGxvY2F0aW9uPzogVCB8IG51bGwgfCB1bmRlZmluZWQpOiBJVHJlZU5vZGU8VCB8IG51bGwsIGFueT4ge1xuXHRcdHJldHVybiB0aGlzLm5vZGVNYXBwZXIubWFwKHRoaXMubW9kZWwuZ2V0Tm9kZShsb2NhdGlvbikpO1xuXHR9XG5cblx0Z2V0Tm9kZUxvY2F0aW9uKG5vZGU6IElUcmVlTm9kZTxUIHwgbnVsbCwgYW55Pik6IFQgfCBudWxsIHtcblx0XHRyZXR1cm4gbm9kZS5lbGVtZW50O1xuXHR9XG5cblx0Z2V0UGFyZW50Tm9kZUxvY2F0aW9uKGxvY2F0aW9uOiBUIHwgbnVsbCk6IFQgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRQYXJlbnROb2RlTG9jYXRpb24obG9jYXRpb24pO1xuXHR9XG5cblx0Z2V0Rmlyc3RFbGVtZW50Q2hpbGQobG9jYXRpb246IFQgfCBudWxsKTogVCB8IG51bGwgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMubW9kZWwuZ2V0Rmlyc3RFbGVtZW50Q2hpbGQobG9jYXRpb24pO1xuXG5cdFx0aWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5lbGVtZW50TWFwcGVyKHJlc3VsdC5lbGVtZW50cyk7XG5cdH1cblxuXHRnZXRMYXN0RWxlbWVudEFuY2VzdG9yKGxvY2F0aW9uPzogVCB8IG51bGwgfCB1bmRlZmluZWQpOiBUIHwgbnVsbCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5tb2RlbC5nZXRMYXN0RWxlbWVudEFuY2VzdG9yKGxvY2F0aW9uKTtcblxuXHRcdGlmIChyZXN1bHQgPT09IG51bGwgfHwgdHlwZW9mIHJlc3VsdCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZWxlbWVudE1hcHBlcihyZXN1bHQuZWxlbWVudHMpO1xuXHR9XG5cblx0aXNDb2xsYXBzaWJsZShsb2NhdGlvbjogVCB8IG51bGwpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5pc0NvbGxhcHNpYmxlKGxvY2F0aW9uKTtcblx0fVxuXG5cdHNldENvbGxhcHNpYmxlKGxvY2F0aW9uOiBUIHwgbnVsbCwgY29sbGFwc2VkPzogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLnNldENvbGxhcHNpYmxlKGxvY2F0aW9uLCBjb2xsYXBzZWQpO1xuXHR9XG5cblx0aXNDb2xsYXBzZWQobG9jYXRpb246IFQgfCBudWxsKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuaXNDb2xsYXBzZWQobG9jYXRpb24pO1xuXHR9XG5cblx0c2V0Q29sbGFwc2VkKGxvY2F0aW9uOiBUIHwgbnVsbCwgY29sbGFwc2VkPzogYm9vbGVhbiB8IHVuZGVmaW5lZCwgcmVjdXJzaXZlPzogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLnNldENvbGxhcHNlZChsb2NhdGlvbiwgY29sbGFwc2VkLCByZWN1cnNpdmUpO1xuXHR9XG5cblx0ZXhwYW5kVG8obG9jYXRpb246IFQgfCBudWxsKTogdm9pZCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZXhwYW5kVG8obG9jYXRpb24pO1xuXHR9XG5cblx0cmVyZW5kZXIobG9jYXRpb246IFQgfCBudWxsKTogdm9pZCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwucmVyZW5kZXIobG9jYXRpb24pO1xuXHR9XG5cblx0cmVmaWx0ZXIoKTogdm9pZCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwucmVmaWx0ZXIoKTtcblx0fVxuXG5cdHJlc29ydChlbGVtZW50OiBUIHwgbnVsbCA9IG51bGwsIHJlY3Vyc2l2ZSA9IHRydWUpOiB2b2lkIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5yZXNvcnQoZWxlbWVudCwgcmVjdXJzaXZlKTtcblx0fVxuXG5cdGdldENvbXByZXNzZWRUcmVlTm9kZShsb2NhdGlvbjogVCB8IG51bGwgPSBudWxsKTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8VD4gfCBudWxsLCBURmlsdGVyRGF0YT4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldE5vZGUobG9jYXRpb24pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLGlCQUErQyxzQkFBc0I7QUFDOUUsU0FBd0YsdUJBQXVCO0FBQy9HLFNBQTJILFdBQTZDLGtCQUFrQjtBQUMxTCxTQUFTLGNBQWM7QUFDdkIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZ0JBQWdCO0FBY3pCLFNBQVMsV0FBYyxTQUFvRjtBQUMxRyxRQUFNLFdBQVcsQ0FBQyxRQUFRLE9BQU87QUFDakMsUUFBTSxpQkFBaUIsUUFBUSxrQkFBa0I7QUFFakQsU0FBTztBQUFBLElBQ04sU0FBUyxFQUFFLFVBQVUsZUFBZTtBQUFBLElBQ3BDLFVBQVUsU0FBUyxJQUFJLFNBQVMsS0FBSyxRQUFRLFFBQVEsR0FBRyxVQUFVO0FBQUEsSUFDbEUsYUFBYSxRQUFRO0FBQUEsSUFDckIsV0FBVyxRQUFRO0FBQUEsRUFDcEI7QUFDRDtBQUdPLFNBQVMsU0FBWSxTQUFvRjtBQUMvRyxRQUFNLFdBQVcsQ0FBQyxRQUFRLE9B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
