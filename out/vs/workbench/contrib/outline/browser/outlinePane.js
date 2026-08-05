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
import "./outlinePane.css";
import * as dom from "../../../../base/browser/dom.js";
import { ProgressBar } from "../../../../base/browser/ui/progressbar/progressbar.js";
import { TimeoutTimer, timeout } from "../../../../base/common/async.js";
import { toDisposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../base/common/map.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { WorkbenchDataTree } from "../../../../platform/list/browser/listService.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { basename } from "../../../../base/common/resources.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { OutlineViewState } from "./outlineViewState.js";
import { IOutlineService, OutlineTarget } from "../../../services/outline/browser/outline.js";
import { EditorResourceAccessor } from "../../../common/editor.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Event } from "../../../../base/common/event.js";
import { AbstractTreeViewState, TreeFindMode } from "../../../../base/browser/ui/tree/abstractTree.js";
import { ctxAllCollapsed, ctxFilterOnType, ctxFocused, ctxFollowsCursor, ctxSortMode, OutlineSortOrder } from "./outline.js";
import { defaultProgressBarStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
class OutlineTreeSorter {
  constructor(_comparator, order) {
    this._comparator = _comparator;
    this.order = order;
  }
  compare(a, b) {
    if (this.order === OutlineSortOrder.ByKind) {
      return this._comparator.compareByType(a, b);
    } else if (this.order === OutlineSortOrder.ByName) {
      return this._comparator.compareByName(a, b);
    } else {
      return this._comparator.compareByPosition(a, b);
    }
  }
}
let OutlinePane = class extends ViewPane {
  constructor(options, _outlineService, _instantiationService, viewDescriptorService, _storageService, _editorService, configurationService, keybindingService, contextKeyService, contextMenuService, openerService, themeService, hoverService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, _instantiationService, openerService, themeService, hoverService);
    this._outlineService = _outlineService;
    this._instantiationService = _instantiationService;
    this._storageService = _storageService;
    this._editorService = _editorService;
    this._disposables = new DisposableStore();
    this._editorControlDisposables = new DisposableStore();
    this._editorPaneDisposables = new DisposableStore();
    this._outlineViewState = new OutlineViewState();
    this._editorListener = new MutableDisposable();
    this._treeStates = new LRUCache(10);
    this._editorControlChangePromise = Promise.resolve();
    this._outlineViewState.restore(this._storageService);
    this._disposables.add(this._outlineViewState);
    contextKeyService.bufferChangeEvents(() => {
      this._ctxFollowsCursor = ctxFollowsCursor.bindTo(contextKeyService);
      this._ctxFilterOnType = ctxFilterOnType.bindTo(contextKeyService);
      this._ctxSortMode = ctxSortMode.bindTo(contextKeyService);
      this._ctxAllCollapsed = ctxAllCollapsed.bindTo(contextKeyService);
    });
    const updateContext = () => {
      this._ctxFollowsCursor.set(this._outlineViewState.followCursor);
      this._ctxFilterOnType.set(this._outlineViewState.filterOnType);
      this._ctxSortMode.set(this._outlineViewState.sortBy);
    };
    updateContext();
    this._disposables.add(this._outlineViewState.onDidChange(updateContext));
  }
  dispose() {
    this._disposables.dispose();
    this._editorPaneDisposables.dispose();
    this._editorControlDisposables.dispose();
    this._editorListener.dispose();
    super.dispose();
  }
  focus() {
    this._editorControlChangePromise.then(() => {
      super.focus();
      this._tree?.domFocus();
    });
  }
  renderBody(container) {
    super.renderBody(container);
    this._domNode = container;
    container.classList.add("outline-pane");
    const progressContainer = dom.$(".outline-progress");
    this._message = dom.$(".outline-message");
    this._progressBar = new ProgressBar(progressContainer, defaultProgressBarStyles);
    this._treeContainer = dom.$(".outline-tree");
    dom.append(container, progressContainer, this._message, this._treeContainer);
    this._disposables.add(this.onDidChangeBodyVisibility((visible) => {
      if (!visible) {
        this._editorListener.clear();
        this._editorPaneDisposables.clear();
        this._editorControlDisposables.clear();
      } else if (!this._editorListener.value) {
        const event = Event.any(this._editorService.onDidActiveEditorChange, this._outlineService.onDidChange);
        this._editorListener.value = event(() => this._handleEditorChanged(this._editorService.activeEditorPane));
        this._handleEditorChanged(this._editorService.activeEditorPane);
      }
    }));
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this._tree?.layout(height, width);
    this._treeDimensions = new dom.Dimension(width, height);
  }
  collapseAll() {
    this._tree?.collapseAll();
  }
  expandAll() {
    this._tree?.expandAll();
  }
  get outlineViewState() {
    return this._outlineViewState;
  }
  _showMessage(message) {
    this._domNode.classList.add("message");
    this._progressBar.stop().hide();
    this._message.innerText = message;
  }
  _captureViewState(uri) {
    if (this._tree) {
      const oldOutline = this._tree.getInput();
      if (!uri) {
        uri = oldOutline?.uri;
      }
      if (oldOutline && uri) {
        this._treeStates.set(`${oldOutline.outlineKind}/${uri}`, this._tree.getViewState());
        return true;
      }
    }
    return false;
  }
  _handleEditorChanged(pane) {
    this._editorPaneDisposables.clear();
    if (pane) {
      this._editorPaneDisposables.add(pane.onDidChangeControl(() => {
        this._editorControlChangePromise = this._handleEditorControlChanged(pane);
      }));
    }
    this._editorControlChangePromise = this._handleEditorControlChanged(pane);
  }
  async _handleEditorControlChanged(pane) {
    const resource = EditorResourceAccessor.getOriginalUri(pane?.input);
    const didCapture = this._captureViewState();
    this._editorControlDisposables.clear();
    if (!pane || !this._outlineService.canCreateOutline(pane) || !resource) {
      return this._showMessage(localize("no-editor", "The active editor cannot provide outline information."));
    }
    let loadingMessage;
    if (!didCapture) {
      loadingMessage = new TimeoutTimer(() => {
        this._showMessage(localize("loading", "Loading document symbols for '{0}'...", basename(resource)));
      }, 100);
    }
    this._progressBar.infinite().show(500);
    const cts = new CancellationTokenSource();
    this._editorControlDisposables.add(toDisposable(() => cts.dispose(true)));
    const newOutline = await this._outlineService.createOutline(pane, OutlineTarget.OutlinePane, cts.token);
    loadingMessage?.dispose();
    if (!newOutline) {
      return;
    }
    if (cts.token.isCancellationRequested) {
      newOutline?.dispose();
      return;
    }
    this._editorControlDisposables.add(newOutline);
    this._progressBar.stop().hide();
    const sorter = new OutlineTreeSorter(newOutline.config.comparator, this._outlineViewState.sortBy);
    const tree = this._instantiationService.createInstance(
      WorkbenchDataTree,
      "OutlinePane",
      this._treeContainer,
      newOutline.config.delegate,
      newOutline.config.renderers,
      newOutline.config.treeDataSource,
      {
        ...newOutline.config.options,
        sorter,
        expandOnDoubleClick: false,
        expandOnlyOnTwistieClick: true,
        multipleSelectionSupport: false,
        hideTwistiesOfChildlessElements: true,
        defaultFindMode: this._outlineViewState.filterOnType ? TreeFindMode.Filter : TreeFindMode.Highlight,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    ctxFocused.bindTo(tree.contextKeyService);
    const updateTree = () => {
      if (newOutline.isEmpty) {
        this._showMessage(localize("no-symbols", "No symbols found in document '{0}'", basename(resource)));
        this._captureViewState(resource);
        tree.setInput(void 0);
      } else if (!tree.getInput()) {
        this._domNode.classList.remove("message");
        const state = this._treeStates.get(`${newOutline.outlineKind}/${newOutline.uri}`);
        tree.setInput(newOutline, state && AbstractTreeViewState.lift(state));
      } else {
        this._domNode.classList.remove("message");
        tree.updateChildren();
      }
    };
    updateTree();
    this._editorControlDisposables.add(newOutline.onDidChange(updateTree));
    tree.findMode = this._outlineViewState.filterOnType ? TreeFindMode.Filter : TreeFindMode.Highlight;
    this._editorControlDisposables.add(this.viewDescriptorService.onDidChangeLocation(({ views }) => {
      if (views.some((v) => v.id === this.id)) {
        tree.updateOptions({ overrideStyles: this.getLocationBasedColors().listOverrideStyles });
      }
    }));
    this._editorControlDisposables.add(tree.onDidChangeFindMode((mode) => this._outlineViewState.filterOnType = mode === TreeFindMode.Filter));
    let idPool = 0;
    this._editorControlDisposables.add(tree.onDidOpen(async (e) => {
      const myId = ++idPool;
      const isDoubleClick = e.browserEvent?.type === "dblclick";
      if (!isDoubleClick) {
        await timeout(150);
        if (myId !== idPool) {
          return;
        }
      }
      await newOutline.reveal(e.element, e.editorOptions, e.sideBySide, isDoubleClick);
    }));
    const revealActiveElement = () => {
      if (!this._outlineViewState.followCursor || !newOutline.activeElement) {
        return;
      }
      let item = newOutline.activeElement;
      while (item) {
        const top = tree.getRelativeTop(item);
        if (top === null) {
          tree.reveal(item, 0.5);
        }
        if (tree.getRelativeTop(item) !== null) {
          tree.setFocus([item]);
          tree.setSelection([item]);
          break;
        }
        item = tree.getParentElement(item);
      }
    };
    revealActiveElement();
    this._editorControlDisposables.add(newOutline.onDidChange(revealActiveElement));
    this._editorControlDisposables.add(this._outlineViewState.onDidChange((e) => {
      this._outlineViewState.persist(this._storageService);
      if (e.filterOnType) {
        tree.findMode = this._outlineViewState.filterOnType ? TreeFindMode.Filter : TreeFindMode.Highlight;
      }
      if (e.followCursor) {
        revealActiveElement();
      }
      if (e.sortBy) {
        sorter.order = this._outlineViewState.sortBy;
        tree.resort();
      }
    }));
    let viewState;
    this._editorControlDisposables.add(tree.onDidChangeFindPattern((pattern) => {
      if (tree.findMode === TreeFindMode.Highlight) {
        return;
      }
      if (!viewState && pattern) {
        viewState = tree.getViewState();
        tree.expandAll();
      } else if (!pattern && viewState) {
        tree.setInput(tree.getInput(), viewState);
        viewState = void 0;
      }
    }));
    const updateAllCollapsedCtx = () => {
      this._ctxAllCollapsed.set(tree.getNode(null).children.every((node) => !node.collapsible || node.collapsed));
    };
    this._editorControlDisposables.add(tree.onDidChangeCollapseState(updateAllCollapsedCtx));
    this._editorControlDisposables.add(tree.onDidChangeModel(updateAllCollapsedCtx));
    updateAllCollapsedCtx();
    tree.layout(this._treeDimensions?.height, this._treeDimensions?.width);
    this._tree = tree;
    this._editorControlDisposables.add(toDisposable(() => {
      tree.dispose();
      this._tree = void 0;
    }));
  }
};
OutlinePane.Id = "outline";
OutlinePane = __decorateClass([
  __decorateParam(1, IOutlineService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IContextMenuService),
  __decorateParam(10, IOpenerService),
  __decorateParam(11, IThemeService),
  __decorateParam(12, IHoverService)
], OutlinePane);
export {
  OutlinePane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9vdXRsaW5lL2Jyb3dzZXIvb3V0bGluZVBhbmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vb3V0bGluZVBhbmUuY3NzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFByb2dyZXNzQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Byb2dyZXNzYmFyL3Byb2dyZXNzYmFyLmpzJztcbmltcG9ydCB7IFRpbWVvdXRUaW1lciwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTFJVQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVZpZXdsZXRWaWV3T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld3NWaWV3bGV0LmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBPdXRsaW5lVmlld1N0YXRlIH0gZnJvbSAnLi9vdXRsaW5lVmlld1N0YXRlLmpzJztcbmltcG9ydCB7IElPdXRsaW5lLCBJT3V0bGluZUNvbXBhcmF0b3IsIElPdXRsaW5lU2VydmljZSwgT3V0bGluZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL291dGxpbmUvYnJvd3Nlci9vdXRsaW5lLmpzJztcbmltcG9ydCB7IEVkaXRvclJlc291cmNlQWNjZXNzb3IsIElFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElUcmVlU29ydGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFRyZWVWaWV3U3RhdGUsIElBYnN0cmFjdFRyZWVWaWV3U3RhdGUsIFRyZWVGaW5kTW9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2Fic3RyYWN0VHJlZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgY3R4QWxsQ29sbGFwc2VkLCBjdHhGaWx0ZXJPblR5cGUsIGN0eEZvY3VzZWQsIGN0eEZvbGxvd3NDdXJzb3IsIGN0eFNvcnRNb2RlLCBJT3V0bGluZVBhbmUsIE91dGxpbmVTb3J0T3JkZXIgfSBmcm9tICcuL291dGxpbmUuanMnO1xuaW1wb3J0IHsgZGVmYXVsdFByb2dyZXNzQmFyU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcblxuY2xhc3MgT3V0bGluZVRyZWVTb3J0ZXI8RT4gaW1wbGVtZW50cyBJVHJlZVNvcnRlcjxFPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfY29tcGFyYXRvcjogSU91dGxpbmVDb21wYXJhdG9yPEU+LFxuXHRcdHB1YmxpYyBvcmRlcjogT3V0bGluZVNvcnRPcmRlclxuXHQpIHsgfVxuXG5cdGNvbXBhcmUoYTogRSwgYjogRSk6IG51bWJlciB7XG5cdFx0aWYgKHRoaXMub3JkZXIgPT09IE91dGxpbmVTb3J0T3JkZXIuQnlLaW5kKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY29tcGFyYXRvci5jb21wYXJlQnlUeXBlKGEsIGIpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5vcmRlciA9PT0gT3V0bGluZVNvcnRPcmRlci5CeU5hbWUpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jb21wYXJhdG9yLmNvbXBhcmVCeU5hbWUoYSwgYik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9jb21wYXJhdG9yLmNvbXBhcmVCeVBvc2l0aW9uKGEsIGIpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgT3V0bGluZVBhbmUgZXh0ZW5kcyBWaWV3UGFuZSBpbXBsZW1lbnRzIElPdXRsaW5lUGFuZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElkID0gJ291dGxpbmUnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yUGFuZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vdXRsaW5lVmlld1N0YXRlID0gbmV3IE91dGxpbmVWaWV3U3RhdGUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JMaXN0ZW5lciA9IG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpO1xuXG5cdHByaXZhdGUgX2RvbU5vZGUhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfbWVzc2FnZSE6IEhUTUxEaXZFbGVtZW50O1xuXHRwcml2YXRlIF9wcm9ncmVzc0JhciE6IFByb2dyZXNzQmFyO1xuXHRwcml2YXRlIF90cmVlQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX3RyZWU/OiBXb3JrYmVuY2hEYXRhVHJlZTxJT3V0bGluZTxhbnk+IHwgdW5kZWZpbmVkLCBhbnksIEZ1enp5U2NvcmU+O1xuXHRwcml2YXRlIF90cmVlRGltZW5zaW9ucz86IGRvbS5EaW1lbnNpb247XG5cdHByaXZhdGUgX3RyZWVTdGF0ZXMgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBJQWJzdHJhY3RUcmVlVmlld1N0YXRlPigxMCk7XG5cblx0cHJpdmF0ZSBfY3R4Rm9sbG93c0N1cnNvciE6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF9jdHhGaWx0ZXJPblR5cGUhOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfY3R4U29ydE1vZGUhOiBJQ29udGV4dEtleTxPdXRsaW5lU29ydE9yZGVyPjtcblx0cHJpdmF0ZSBfY3R4QWxsQ29sbGFwc2VkITogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdsZXRWaWV3T3B0aW9ucyxcblx0XHRASU91dGxpbmVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX291dGxpbmVTZXJ2aWNlOiBJT3V0bGluZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIF9pbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHRcdHRoaXMuX291dGxpbmVWaWV3U3RhdGUucmVzdG9yZSh0aGlzLl9zdG9yYWdlU2VydmljZSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX291dGxpbmVWaWV3U3RhdGUpO1xuXG5cdFx0Y29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdHRoaXMuX2N0eEZvbGxvd3NDdXJzb3IgPSBjdHhGb2xsb3dzQ3Vyc29yLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHR0aGlzLl9jdHhGaWx0ZXJPblR5cGUgPSBjdHhGaWx0ZXJPblR5cGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdHRoaXMuX2N0eFNvcnRNb2RlID0gY3R4U29ydE1vZGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdHRoaXMuX2N0eEFsbENvbGxhcHNlZCA9IGN0eEFsbENvbGxhcHNlZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXBkYXRlQ29udGV4dCA9ICgpID0+IHtcblx0XHRcdHRoaXMuX2N0eEZvbGxvd3NDdXJzb3Iuc2V0KHRoaXMuX291dGxpbmVWaWV3U3RhdGUuZm9sbG93Q3Vyc29yKTtcblx0XHRcdHRoaXMuX2N0eEZpbHRlck9uVHlwZS5zZXQodGhpcy5fb3V0bGluZVZpZXdTdGF0ZS5maWx0ZXJPblR5cGUpO1xuXHRcdFx0dGhpcy5fY3R4U29ydE1vZGUuc2V0KHRoaXMuX291dGxpbmVWaWV3U3RhdGUuc29ydEJ5KTtcblx0XHR9O1xuXHRcdHVwZGF0ZUNvbnRleHQoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fb3V0bGluZVZpZXdTdGF0ZS5vbkRpZENoYW5nZSh1cGRhdGVDb250ZXh0KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9lZGl0b3JQYW5lRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZWRpdG9yTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xDaGFuZ2VQcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0c3VwZXIuZm9jdXMoKTtcblx0XHRcdHRoaXMuX3RyZWU/LmRvbUZvY3VzKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXG5cdFx0dGhpcy5fZG9tTm9kZSA9IGNvbnRhaW5lcjtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnb3V0bGluZS1wYW5lJyk7XG5cblx0XHRjb25zdCBwcm9ncmVzc0NvbnRhaW5lciA9IGRvbS4kKCcub3V0bGluZS1wcm9ncmVzcycpO1xuXHRcdHRoaXMuX21lc3NhZ2UgPSBkb20uJCgnLm91dGxpbmUtbWVzc2FnZScpO1xuXG5cdFx0dGhpcy5fcHJvZ3Jlc3NCYXIgPSBuZXcgUHJvZ3Jlc3NCYXIocHJvZ3Jlc3NDb250YWluZXIsIGRlZmF1bHRQcm9ncmVzc0JhclN0eWxlcyk7XG5cblx0XHR0aGlzLl90cmVlQ29udGFpbmVyID0gZG9tLiQoJy5vdXRsaW5lLXRyZWUnKTtcblx0XHRkb20uYXBwZW5kKGNvbnRhaW5lciwgcHJvZ3Jlc3NDb250YWluZXIsIHRoaXMuX21lc3NhZ2UsIHRoaXMuX3RyZWVDb250YWluZXIpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eSh2aXNpYmxlID0+IHtcblx0XHRcdGlmICghdmlzaWJsZSkge1xuXHRcdFx0XHQvLyBzdG9wIGV2ZXJ5dGhpbmcgd2hlbiBub3QgdmlzaWJsZVxuXHRcdFx0XHR0aGlzLl9lZGl0b3JMaXN0ZW5lci5jbGVhcigpO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JQYW5lRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy5fZWRpdG9yQ29udHJvbERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRcdH0gZWxzZSBpZiAoIXRoaXMuX2VkaXRvckxpc3RlbmVyLnZhbHVlKSB7XG5cdFx0XHRcdGNvbnN0IGV2ZW50ID0gRXZlbnQuYW55KHRoaXMuX2VkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UsIHRoaXMuX291dGxpbmVTZXJ2aWNlLm9uRGlkQ2hhbmdlKTtcblx0XHRcdFx0dGhpcy5fZWRpdG9yTGlzdGVuZXIudmFsdWUgPSBldmVudCgoKSA9PiB0aGlzLl9oYW5kbGVFZGl0b3JDaGFuZ2VkKHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSkpO1xuXHRcdFx0XHR0aGlzLl9oYW5kbGVFZGl0b3JDaGFuZ2VkKHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMuX3RyZWU/LmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLl90cmVlRGltZW5zaW9ucyA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHR9XG5cblx0Y29sbGFwc2VBbGwoKTogdm9pZCB7XG5cdFx0dGhpcy5fdHJlZT8uY29sbGFwc2VBbGwoKTtcblx0fVxuXG5cdGV4cGFuZEFsbCgpOiB2b2lkIHtcblx0XHR0aGlzLl90cmVlPy5leHBhbmRBbGwoKTtcblx0fVxuXG5cdGdldCBvdXRsaW5lVmlld1N0YXRlKCkge1xuXHRcdHJldHVybiB0aGlzLl9vdXRsaW5lVmlld1N0YXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd01lc3NhZ2UobWVzc2FnZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdtZXNzYWdlJyk7XG5cdFx0dGhpcy5fcHJvZ3Jlc3NCYXIuc3RvcCgpLmhpZGUoKTtcblx0XHR0aGlzLl9tZXNzYWdlLmlubmVyVGV4dCA9IG1lc3NhZ2U7XG5cdH1cblxuXHRwcml2YXRlIF9jYXB0dXJlVmlld1N0YXRlKHVyaT86IFVSSSk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl90cmVlKSB7XG5cdFx0XHRjb25zdCBvbGRPdXRsaW5lID0gdGhpcy5fdHJlZS5nZXRJbnB1dCgpO1xuXHRcdFx0aWYgKCF1cmkpIHtcblx0XHRcdFx0dXJpID0gb2xkT3V0bGluZT8udXJpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9sZE91dGxpbmUgJiYgdXJpKSB7XG5cdFx0XHRcdHRoaXMuX3RyZWVTdGF0ZXMuc2V0KGAke29sZE91dGxpbmUub3V0bGluZUtpbmR9LyR7dXJpfWAsIHRoaXMuX3RyZWUuZ2V0Vmlld1N0YXRlKCkpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfZWRpdG9yQ29udHJvbENoYW5nZVByb21pc2U6IFByb21pc2U8dm9pZD4gPSBQcm9taXNlLnJlc29sdmUoKTtcblx0cHJpdmF0ZSBfaGFuZGxlRWRpdG9yQ2hhbmdlZChwYW5lOiBJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRvclBhbmVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0aWYgKHBhbmUpIHtcblx0XHRcdC8vIHJlYWN0IHRvIGNvbnRyb2wgY2hhbmdlcyBmcm9tIHdpdGhpbiBwYW5lIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTM0MDA4KVxuXHRcdFx0dGhpcy5fZWRpdG9yUGFuZURpc3Bvc2FibGVzLmFkZChwYW5lLm9uRGlkQ2hhbmdlQ29udHJvbCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvckNvbnRyb2xDaGFuZ2VQcm9taXNlID0gdGhpcy5faGFuZGxlRWRpdG9yQ29udHJvbENoYW5nZWQocGFuZSk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdG9yQ29udHJvbENoYW5nZVByb21pc2UgPSB0aGlzLl9oYW5kbGVFZGl0b3JDb250cm9sQ2hhbmdlZChwYW5lKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2hhbmRsZUVkaXRvckNvbnRyb2xDaGFuZ2VkKHBhbmU6IElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBwZXJzaXN0IHN0YXRlXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKHBhbmU/LmlucHV0KTtcblx0XHRjb25zdCBkaWRDYXB0dXJlID0gdGhpcy5fY2FwdHVyZVZpZXdTdGF0ZSgpO1xuXG5cdFx0dGhpcy5fZWRpdG9yQ29udHJvbERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRpZiAoIXBhbmUgfHwgIXRoaXMuX291dGxpbmVTZXJ2aWNlLmNhbkNyZWF0ZU91dGxpbmUocGFuZSkgfHwgIXJlc291cmNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2hvd01lc3NhZ2UobG9jYWxpemUoJ25vLWVkaXRvcicsIFwiVGhlIGFjdGl2ZSBlZGl0b3IgY2Fubm90IHByb3ZpZGUgb3V0bGluZSBpbmZvcm1hdGlvbi5cIikpO1xuXHRcdH1cblxuXHRcdGxldCBsb2FkaW5nTWVzc2FnZTogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCFkaWRDYXB0dXJlKSB7XG5cdFx0XHRsb2FkaW5nTWVzc2FnZSA9IG5ldyBUaW1lb3V0VGltZXIoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9zaG93TWVzc2FnZShsb2NhbGl6ZSgnbG9hZGluZycsIFwiTG9hZGluZyBkb2N1bWVudCBzeW1ib2xzIGZvciAnezB9Jy4uLlwiLCBiYXNlbmFtZShyZXNvdXJjZSkpKTtcblx0XHRcdH0sIDEwMCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHJvZ3Jlc3NCYXIuaW5maW5pdGUoKS5zaG93KDUwMCk7XG5cblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHR0aGlzLl9lZGl0b3JDb250cm9sRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjdHMuZGlzcG9zZSh0cnVlKSkpO1xuXG5cdFx0Y29uc3QgbmV3T3V0bGluZSA9IGF3YWl0IHRoaXMuX291dGxpbmVTZXJ2aWNlLmNyZWF0ZU91dGxpbmUocGFuZSwgT3V0bGluZVRhcmdldC5PdXRsaW5lUGFuZSwgY3RzLnRva2VuKTtcblx0XHRsb2FkaW5nTWVzc2FnZT8uZGlzcG9zZSgpO1xuXG5cdFx0aWYgKCFuZXdPdXRsaW5lKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0bmV3T3V0bGluZT8uZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcy5hZGQobmV3T3V0bGluZSk7XG5cdFx0dGhpcy5fcHJvZ3Jlc3NCYXIuc3RvcCgpLmhpZGUoKTtcblxuXHRcdGNvbnN0IHNvcnRlciA9IG5ldyBPdXRsaW5lVHJlZVNvcnRlcihuZXdPdXRsaW5lLmNvbmZpZy5jb21wYXJhdG9yLCB0aGlzLl9vdXRsaW5lVmlld1N0YXRlLnNvcnRCeSk7XG5cblx0XHRjb25zdCB0cmVlID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRXb3JrYmVuY2hEYXRhVHJlZTxJT3V0bGluZTxhbnk+IHwgdW5kZWZpbmVkLCBhbnksIEZ1enp5U2NvcmU+LFxuXHRcdFx0J091dGxpbmVQYW5lJyxcblx0XHRcdHRoaXMuX3RyZWVDb250YWluZXIsXG5cdFx0XHRuZXdPdXRsaW5lLmNvbmZpZy5kZWxlZ2F0ZSxcblx0XHRcdG5ld091dGxpbmUuY29uZmlnLnJlbmRlcmVycyxcblx0XHRcdG5ld091dGxpbmUuY29uZmlnLnRyZWVEYXRhU291cmNlLFxuXHRcdFx0e1xuXHRcdFx0XHQuLi5uZXdPdXRsaW5lLmNvbmZpZy5vcHRpb25zLFxuXHRcdFx0XHRzb3J0ZXIsXG5cdFx0XHRcdGV4cGFuZE9uRG91YmxlQ2xpY2s6IGZhbHNlLFxuXHRcdFx0XHRleHBhbmRPbmx5T25Ud2lzdGllQ2xpY2s6IHRydWUsXG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdGhpZGVUd2lzdGllc09mQ2hpbGRsZXNzRWxlbWVudHM6IHRydWUsXG5cdFx0XHRcdGRlZmF1bHRGaW5kTW9kZTogdGhpcy5fb3V0bGluZVZpZXdTdGF0ZS5maWx0ZXJPblR5cGUgPyBUcmVlRmluZE1vZGUuRmlsdGVyIDogVHJlZUZpbmRNb2RlLkhpZ2hsaWdodCxcblx0XHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHRoaXMuZ2V0TG9jYXRpb25CYXNlZENvbG9ycygpLmxpc3RPdmVycmlkZVN0eWxlc1xuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRjdHhGb2N1c2VkLmJpbmRUbyh0cmVlLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdC8vIHVwZGF0ZSB0cmVlLCBsaXN0ZW4gdG8gY2hhbmdlc1xuXHRcdGNvbnN0IHVwZGF0ZVRyZWUgPSAoKSA9PiB7XG5cdFx0XHRpZiAobmV3T3V0bGluZS5pc0VtcHR5KSB7XG5cdFx0XHRcdC8vIG5vIG1vcmUgZWxlbWVudHNcblx0XHRcdFx0dGhpcy5fc2hvd01lc3NhZ2UobG9jYWxpemUoJ25vLXN5bWJvbHMnLCBcIk5vIHN5bWJvbHMgZm91bmQgaW4gZG9jdW1lbnQgJ3swfSdcIiwgYmFzZW5hbWUocmVzb3VyY2UpKSk7XG5cdFx0XHRcdHRoaXMuX2NhcHR1cmVWaWV3U3RhdGUocmVzb3VyY2UpO1xuXHRcdFx0XHR0cmVlLnNldElucHV0KHVuZGVmaW5lZCk7XG5cblx0XHRcdH0gZWxzZSBpZiAoIXRyZWUuZ2V0SW5wdXQoKSkge1xuXHRcdFx0XHQvLyBmaXJzdDogaW5pdCB0cmVlXG5cdFx0XHRcdHRoaXMuX2RvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnbWVzc2FnZScpO1xuXHRcdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3RyZWVTdGF0ZXMuZ2V0KGAke25ld091dGxpbmUub3V0bGluZUtpbmR9LyR7bmV3T3V0bGluZS51cml9YCk7XG5cdFx0XHRcdHRyZWUuc2V0SW5wdXQobmV3T3V0bGluZSwgc3RhdGUgJiYgQWJzdHJhY3RUcmVlVmlld1N0YXRlLmxpZnQoc3RhdGUpKTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gdXBkYXRlOiByZWZyZXNoIHRyZWVcblx0XHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKCdtZXNzYWdlJyk7XG5cdFx0XHRcdHRyZWUudXBkYXRlQ2hpbGRyZW4oKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHVwZGF0ZVRyZWUoKTtcblx0XHR0aGlzLl9lZGl0b3JDb250cm9sRGlzcG9zYWJsZXMuYWRkKG5ld091dGxpbmUub25EaWRDaGFuZ2UodXBkYXRlVHJlZSkpO1xuXHRcdHRyZWUuZmluZE1vZGUgPSB0aGlzLl9vdXRsaW5lVmlld1N0YXRlLmZpbHRlck9uVHlwZSA/IFRyZWVGaW5kTW9kZS5GaWx0ZXIgOiBUcmVlRmluZE1vZGUuSGlnaGxpZ2h0O1xuXG5cdFx0Ly8gZmVhdHVyZTogYXBwbHkgcGFuZWwgYmFja2dyb3VuZCB0byB0cmVlXG5cdFx0dGhpcy5fZWRpdG9yQ29udHJvbERpc3Bvc2FibGVzLmFkZCh0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5vbkRpZENoYW5nZUxvY2F0aW9uKCh7IHZpZXdzIH0pID0+IHtcblx0XHRcdGlmICh2aWV3cy5zb21lKHYgPT4gdi5pZCA9PT0gdGhpcy5pZCkpIHtcblx0XHRcdFx0dHJlZS51cGRhdGVPcHRpb25zKHsgb3ZlcnJpZGVTdHlsZXM6IHRoaXMuZ2V0TG9jYXRpb25CYXNlZENvbG9ycygpLmxpc3RPdmVycmlkZVN0eWxlcyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBmZWF0dXJlOiBmaWx0ZXIgb24gdHlwZSAtIGtlZXAgdHJlZSBhbmQgbWVudSBpbiBzeW5jXG5cdFx0dGhpcy5fZWRpdG9yQ29udHJvbERpc3Bvc2FibGVzLmFkZCh0cmVlLm9uRGlkQ2hhbmdlRmluZE1vZGUobW9kZSA9PiB0aGlzLl9vdXRsaW5lVmlld1N0YXRlLmZpbHRlck9uVHlwZSA9IG1vZGUgPT09IFRyZWVGaW5kTW9kZS5GaWx0ZXIpKTtcblxuXHRcdC8vIGZlYXR1cmU6IHJldmVhbCBvdXRsaW5lIHNlbGVjdGlvbiBpbiBlZGl0b3Jcblx0XHQvLyBvbiBjaGFuZ2UgLT4gcmV2ZWFsL3NlbGVjdCBkZWZpbmluZyByYW5nZVxuXHRcdGxldCBpZFBvb2wgPSAwO1xuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcy5hZGQodHJlZS5vbkRpZE9wZW4oYXN5bmMgZSA9PiB7XG5cdFx0XHRjb25zdCBteUlkID0gKytpZFBvb2w7XG5cdFx0XHRjb25zdCBpc0RvdWJsZUNsaWNrID0gZS5icm93c2VyRXZlbnQ/LnR5cGUgPT09ICdkYmxjbGljayc7XG5cdFx0XHRpZiAoIWlzRG91YmxlQ2xpY2spIHtcblx0XHRcdFx0Ly8gd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwNjQyNFxuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDE1MCk7XG5cdFx0XHRcdGlmIChteUlkICE9PSBpZFBvb2wpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGF3YWl0IG5ld091dGxpbmUucmV2ZWFsKGUuZWxlbWVudCwgZS5lZGl0b3JPcHRpb25zLCBlLnNpZGVCeVNpZGUsIGlzRG91YmxlQ2xpY2spO1xuXHRcdH0pKTtcblx0XHQvLyBmZWF0dXJlOiByZXZlYWwgZWRpdG9yIHNlbGVjdGlvbiBpbiBvdXRsaW5lXG5cdFx0Y29uc3QgcmV2ZWFsQWN0aXZlRWxlbWVudCA9ICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5fb3V0bGluZVZpZXdTdGF0ZS5mb2xsb3dDdXJzb3IgfHwgIW5ld091dGxpbmUuYWN0aXZlRWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsZXQgaXRlbSA9IG5ld091dGxpbmUuYWN0aXZlRWxlbWVudDtcblx0XHRcdHdoaWxlIChpdGVtKSB7XG5cdFx0XHRcdGNvbnN0IHRvcCA9IHRyZWUuZ2V0UmVsYXRpdmVUb3AoaXRlbSk7XG5cdFx0XHRcdGlmICh0b3AgPT09IG51bGwpIHtcblx0XHRcdFx0XHQvLyBub3QgdmlzaWJsZSAtPiByZXZlYWxcblx0XHRcdFx0XHR0cmVlLnJldmVhbChpdGVtLCAwLjUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0cmVlLmdldFJlbGF0aXZlVG9wKGl0ZW0pICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0dHJlZS5zZXRGb2N1cyhbaXRlbV0pO1xuXHRcdFx0XHRcdHRyZWUuc2V0U2VsZWN0aW9uKFtpdGVtXSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gU1RJTEwgbm90IHZpc2libGUgLT4gdHJ5IHBhcmVudFxuXHRcdFx0XHRpdGVtID0gdHJlZS5nZXRQYXJlbnRFbGVtZW50KGl0ZW0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cmV2ZWFsQWN0aXZlRWxlbWVudCgpO1xuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcy5hZGQobmV3T3V0bGluZS5vbkRpZENoYW5nZShyZXZlYWxBY3RpdmVFbGVtZW50KSk7XG5cblx0XHQvLyBmZWF0dXJlOiB1cGRhdGUgdmlldyB3aGVuIHVzZXIgc3RhdGUgY2hhbmdlc1xuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcy5hZGQodGhpcy5fb3V0bGluZVZpZXdTdGF0ZS5vbkRpZENoYW5nZSgoZTogeyBmb2xsb3dDdXJzb3I/OiBib29sZWFuOyBzb3J0Qnk/OiBib29sZWFuOyBmaWx0ZXJPblR5cGU/OiBib29sZWFuIH0pID0+IHtcblx0XHRcdHRoaXMuX291dGxpbmVWaWV3U3RhdGUucGVyc2lzdCh0aGlzLl9zdG9yYWdlU2VydmljZSk7XG5cdFx0XHRpZiAoZS5maWx0ZXJPblR5cGUpIHtcblx0XHRcdFx0dHJlZS5maW5kTW9kZSA9IHRoaXMuX291dGxpbmVWaWV3U3RhdGUuZmlsdGVyT25UeXBlID8gVHJlZUZpbmRNb2RlLkZpbHRlciA6IFRyZWVGaW5kTW9kZS5IaWdobGlnaHQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5mb2xsb3dDdXJzb3IpIHtcblx0XHRcdFx0cmV2ZWFsQWN0aXZlRWxlbWVudCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuc29ydEJ5KSB7XG5cdFx0XHRcdHNvcnRlci5vcmRlciA9IHRoaXMuX291dGxpbmVWaWV3U3RhdGUuc29ydEJ5O1xuXHRcdFx0XHR0cmVlLnJlc29ydCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIGZlYXR1cmU6IGV4cGFuZCBhbGwgbm9kZXMgd2hlbiBmaWx0ZXJpbmcgKG5vdCB3aGVuIGZpbmRpbmcpXG5cdFx0bGV0IHZpZXdTdGF0ZTogQWJzdHJhY3RUcmVlVmlld1N0YXRlIHwgdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcy5hZGQodHJlZS5vbkRpZENoYW5nZUZpbmRQYXR0ZXJuKHBhdHRlcm4gPT4ge1xuXHRcdFx0aWYgKHRyZWUuZmluZE1vZGUgPT09IFRyZWVGaW5kTW9kZS5IaWdobGlnaHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF2aWV3U3RhdGUgJiYgcGF0dGVybikge1xuXHRcdFx0XHR2aWV3U3RhdGUgPSB0cmVlLmdldFZpZXdTdGF0ZSgpO1xuXHRcdFx0XHR0cmVlLmV4cGFuZEFsbCgpO1xuXHRcdFx0fSBlbHNlIGlmICghcGF0dGVybiAmJiB2aWV3U3RhdGUpIHtcblx0XHRcdFx0dHJlZS5zZXRJbnB1dCh0cmVlLmdldElucHV0KCkhLCB2aWV3U3RhdGUpO1xuXHRcdFx0XHR2aWV3U3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gZmVhdHVyZTogdXBkYXRlIGFsbC1jb2xsYXBzZWQgY29udGV4dCBrZXlcblx0XHRjb25zdCB1cGRhdGVBbGxDb2xsYXBzZWRDdHggPSAoKSA9PiB7XG5cdFx0XHR0aGlzLl9jdHhBbGxDb2xsYXBzZWQuc2V0KHRyZWUuZ2V0Tm9kZShudWxsKS5jaGlsZHJlbi5ldmVyeShub2RlID0+ICFub2RlLmNvbGxhcHNpYmxlIHx8IG5vZGUuY29sbGFwc2VkKSk7XG5cdFx0fTtcblx0XHR0aGlzLl9lZGl0b3JDb250cm9sRGlzcG9zYWJsZXMuYWRkKHRyZWUub25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKHVwZGF0ZUFsbENvbGxhcHNlZEN0eCkpO1xuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcy5hZGQodHJlZS5vbkRpZENoYW5nZU1vZGVsKHVwZGF0ZUFsbENvbGxhcHNlZEN0eCkpO1xuXHRcdHVwZGF0ZUFsbENvbGxhcHNlZEN0eCgpO1xuXG5cdFx0Ly8gbGFzdDogc2V0IHRyZWUgcHJvcGVydHkgYW5kIHdpcmUgaXQgdXAgdG8gb25lIG9mIG91ciBjb250ZXh0IGtleXNcblx0XHR0cmVlLmxheW91dCh0aGlzLl90cmVlRGltZW5zaW9ucz8uaGVpZ2h0LCB0aGlzLl90cmVlRGltZW5zaW9ucz8ud2lkdGgpO1xuXHRcdHRoaXMuX3RyZWUgPSB0cmVlO1xuXHRcdHRoaXMuX2VkaXRvckNvbnRyb2xEaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRyZWUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fdHJlZSA9IHVuZGVmaW5lZDtcblx0XHR9KSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFlBQVksU0FBUztBQUNyQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGNBQWMsZUFBZTtBQUN0QyxTQUFzQixjQUFjLGlCQUFpQix5QkFBeUI7QUFDOUUsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQXVDLGlCQUFpQixxQkFBcUI7QUFDN0Us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
