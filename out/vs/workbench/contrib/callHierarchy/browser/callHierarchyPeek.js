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
import "./media/callHierarchy.css";
import * as peekView from "../../../../editor/contrib/peekView/browser/peekView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { CallHierarchyDirection } from "../common/callHierarchy.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import * as callHTree from "./callHierarchyTree.js";
import { localize } from "../../../../nls.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { Range } from "../../../../editor/common/core/range.js";
import { SplitView, Orientation, Sizing } from "../../../../base/browser/ui/splitview/splitview.js";
import { Dimension, isKeyboardEvent } from "../../../../base/browser/dom.js";
import { Event } from "../../../../base/common/event.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { TrackedRangeStickiness, OverviewRulerLane } from "../../../../editor/common/model.js";
import { themeColorFromId, IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Color } from "../../../../base/common/color.js";
import { TreeMouseEventTarget } from "../../../../base/browser/ui/tree/tree.js";
import { MenuId, IMenuService } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
var State = /* @__PURE__ */ ((State2) => {
  State2["Loading"] = "loading";
  State2["Message"] = "message";
  State2["Data"] = "data";
  return State2;
})(State || {});
class LayoutInfo {
  constructor(ratio, height) {
    this.ratio = ratio;
    this.height = height;
  }
  static store(info, storageService) {
    storageService.store("callHierarchyPeekLayout", JSON.stringify(info), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  static retrieve(storageService) {
    const value = storageService.get("callHierarchyPeekLayout", StorageScope.PROFILE, "{}");
    const defaultInfo = { ratio: 0.7, height: 17 };
    try {
      return { ...defaultInfo, ...JSON.parse(value) };
    } catch {
      return defaultInfo;
    }
  }
}
class CallHierarchyTree extends WorkbenchAsyncDataTree {
}
let CallHierarchyTreePeekWidget = class extends peekView.PeekViewWidget {
  constructor(editor, _where, _direction, themeService, _peekViewService, _editorService, _textModelService, _storageService, _menuService, _contextKeyService, _instantiationService) {
    super(editor, { showFrame: true, showArrow: true, isResizeable: true, isAccessible: true }, _instantiationService);
    this._where = _where;
    this._direction = _direction;
    this._peekViewService = _peekViewService;
    this._editorService = _editorService;
    this._textModelService = _textModelService;
    this._storageService = _storageService;
    this._menuService = _menuService;
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._treeViewStates = /* @__PURE__ */ new Map();
    this._previewDisposable = new DisposableStore();
    this.create();
    this._peekViewService.addExclusiveWidget(editor, this);
    this._applyTheme(themeService.getColorTheme());
    this._disposables.add(themeService.onDidColorThemeChange(this._applyTheme, this));
    this._disposables.add(this._previewDisposable);
  }
  dispose() {
    LayoutInfo.store(this._layoutInfo, this._storageService);
    this._splitView.dispose();
    this._tree.dispose();
    this._editor.dispose();
    super.dispose();
  }
  get direction() {
    return this._direction;
  }
  _applyTheme(theme) {
    const borderColor = theme.getColor(peekView.peekViewBorder) || Color.transparent;
    this.style({
      arrowColor: borderColor,
      frameColor: borderColor,
      headerBackgroundColor: theme.getColor(peekView.peekViewTitleBackground) || Color.transparent,
      primaryHeadingColor: theme.getColor(peekView.peekViewTitleForeground),
      secondaryHeadingColor: theme.getColor(peekView.peekViewTitleInfoForeground)
    });
  }
  _fillHead(container) {
    super._fillHead(container, true);
    const menu = this._menuService.createMenu(CallHierarchyTreePeekWidget.TitleMenu, this._contextKeyService);
    const updateToolbar = () => {
      const actions = getFlatActionBarActions(menu.getActions());
      this._actionbarWidget.clear();
      this._actionbarWidget.push(actions, { label: false, icon: true });
    };
    this._disposables.add(menu);
    this._disposables.add(menu.onDidChange(updateToolbar));
    updateToolbar();
  }
  _fillBody(parent) {
    this._layoutInfo = LayoutInfo.retrieve(this._storageService);
    this._dim = new Dimension(0, 0);
    this._parent = parent;
    parent.classList.add("call-hierarchy");
    const message = document.createElement("div");
    message.classList.add("message");
    parent.appendChild(message);
    this._message = message;
    this._message.tabIndex = 0;
    const container = document.createElement("div");
    container.classList.add("results");
    parent.appendChild(container);
    this._splitView = new SplitView(container, { orientation: Orientation.HORIZONTAL });
    const editorContainer = document.createElement("div");
    editorContainer.classList.add("editor");
    container.appendChild(editorContainer);
    const editorOptions = {
      scrollBeyondLastLine: false,
      scrollbar: {
        verticalScrollbarSize: 14,
        horizontal: "auto",
        useShadows: true,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        alwaysConsumeMouseWheel: false
      },
      overviewRulerLanes: 2,
      fixedOverflowWidgets: true,
      minimap: {
        enabled: false
      }
    };
    this._editor = this._instantiationService.createInstance(
      EmbeddedCodeEditorWidget,
      editorContainer,
      editorOptions,
      {},
      this.editor
    );
    const treeContainer = document.createElement("div");
    treeContainer.classList.add("tree");
    container.appendChild(treeContainer);
    const options = {
      sorter: new callHTree.Sorter(),
      accessibilityProvider: new callHTree.AccessibilityProvider(() => this._direction),
      identityProvider: new callHTree.IdentityProvider(() => this._direction),
      expandOnlyOnTwistieClick: true,
      overrideStyles: {
        listBackground: peekView.peekViewResultsBackground
      }
    };
    this._tree = this._instantiationService.createInstance(
      CallHierarchyTree,
      "CallHierarchyPeek",
      treeContainer,
      new callHTree.VirtualDelegate(),
      [this._instantiationService.createInstance(callHTree.CallRenderer)],
      this._instantiationService.createInstance(callHTree.DataSource, () => this._direction),
      options
    );
    this._splitView.addView({
      onDidChange: Event.None,
      element: editorContainer,
      minimumSize: 200,
      maximumSize: Number.MAX_VALUE,
      layout: (width) => {
        if (this._dim.height) {
          this._editor.layout({ height: this._dim.height, width });
        }
      }
    }, Sizing.Distribute);
    this._splitView.addView({
      onDidChange: Event.None,
      element: treeContainer,
      minimumSize: 100,
      maximumSize: Number.MAX_VALUE,
      layout: (width) => {
        if (this._dim.height) {
          this._tree.layout(this._dim.height, width);
        }
      }
    }, Sizing.Distribute);
    this._disposables.add(this._splitView.onDidSashChange(() => {
      if (this._dim.width) {
        this._layoutInfo.ratio = this._splitView.getViewSize(0) / this._dim.width;
      }
    }));
    this._disposables.add(this._tree.onDidChangeFocus(this._updatePreview, this));
    this._disposables.add(this._editor.onMouseDown((e) => {
      const { event, target } = e;
      if (event.detail !== 2) {
        return;
      }
      const [focus] = this._tree.getFocus();
      if (!focus) {
        return;
      }
      this.dispose();
      this._editorService.openEditor({
        resource: focus.item.uri,
        options: { selection: target.range }
      });
    }));
    this._disposables.add(this._tree.onMouseDblClick((e) => {
      if (e.target === TreeMouseEventTarget.Twistie) {
        return;
      }
      if (e.element) {
        this.dispose();
        this._editorService.openEditor({
          resource: e.element.item.uri,
          options: { selection: e.element.item.selectionRange, pinned: true }
        });
      }
    }));
    this._disposables.add(this._tree.onDidChangeSelection((e) => {
      const [element] = e.elements;
      if (element && isKeyboardEvent(e.browserEvent)) {
        this.dispose();
        this._editorService.openEditor({
          resource: element.item.uri,
          options: { selection: element.item.selectionRange, pinned: true }
        });
      }
    }));
  }
  async _updatePreview() {
    const [element] = this._tree.getFocus();
    if (!element) {
      return;
    }
    this._previewDisposable.clear();
    const options = {
      description: "call-hierarchy-decoration",
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      className: "call-decoration",
      overviewRuler: {
        color: themeColorFromId(peekView.peekViewEditorMatchHighlight),
        position: OverviewRulerLane.Center
      }
    };
    let previewUri;
    if (this._direction === CallHierarchyDirection.CallsFrom) {
      previewUri = element.parent ? element.parent.item.uri : element.model.root.uri;
    } else {
      previewUri = element.item.uri;
    }
    const value = await this._textModelService.createModelReference(previewUri);
    this._editor.setModel(value.object.textEditorModel);
    const decorations = [];
    let fullRange;
    let locations = element.locations;
    if (!locations) {
      locations = [{ uri: element.item.uri, range: element.item.selectionRange }];
    }
    for (const loc of locations) {
      if (loc.uri.toString() === previewUri.toString()) {
        decorations.push({ range: loc.range, options });
        fullRange = !fullRange ? loc.range : Range.plusRange(loc.range, fullRange);
      }
    }
    if (fullRange) {
      this._editor.revealRangeInCenter(fullRange, ScrollType.Immediate);
      const decorationsCollection = this._editor.createDecorationsCollection(decorations);
      this._previewDisposable.add(toDisposable(() => decorationsCollection.clear()));
    }
    this._previewDisposable.add(value);
    const title = this._direction === CallHierarchyDirection.CallsFrom ? localize("callFrom", "Calls from '{0}'", element.model.root.name) : localize("callsTo", "Callers of '{0}'", element.model.root.name);
    this.setTitle(title);
  }
  showLoading() {
    this._parent.dataset["state"] = "loading" /* Loading */;
    this.setTitle(localize("title.loading", "Loading..."));
    this._show();
  }
  showMessage(message) {
    this._parent.dataset["state"] = "message" /* Message */;
    this.setTitle("");
    this.setMetaTitle("");
    this._message.innerText = message;
    this._show();
    this._message.focus();
  }
  async showModel(model) {
    this._show();
    const viewState = this._treeViewStates.get(this._direction);
    await this._tree.setInput(model, viewState);
    const root = this._tree.getNode(model).children[0];
    await this._tree.expand(root.element);
    if (root.children.length === 0) {
      this.showMessage(this._direction === CallHierarchyDirection.CallsFrom ? localize("empt.callsFrom", "No calls from '{0}'", model.root.name) : localize("empt.callsTo", "No callers of '{0}'", model.root.name));
    } else {
      this._parent.dataset["state"] = "data" /* Data */;
      if (!viewState || this._tree.getFocus().length === 0) {
        this._tree.setFocus([root.children[0].element]);
      }
      this._tree.domFocus();
      this._updatePreview();
    }
  }
  getModel() {
    return this._tree.getInput();
  }
  getFocused() {
    return this._tree.getFocus()[0];
  }
  async updateDirection(newDirection) {
    const model = this._tree.getInput();
    if (model && newDirection !== this._direction) {
      this._treeViewStates.set(this._direction, this._tree.getViewState());
      this._direction = newDirection;
      await this.showModel(model);
    }
  }
  _show() {
    if (!this._isShowing) {
      this.editor.revealLineInCenterIfOutsideViewport(this._where.lineNumber, ScrollType.Smooth);
      super.show(Range.fromPositions(this._where), this._layoutInfo.height);
    }
  }
  _onWidth(width) {
    if (this._dim) {
      this._doLayoutBody(this._dim.height, width);
    }
  }
  _doLayoutBody(height, width) {
    if (this._dim.height !== height || this._dim.width !== width) {
      super._doLayoutBody(height, width);
      this._dim = new Dimension(width, height);
      this._layoutInfo.height = this._viewZone ? this._viewZone.heightInLines : this._layoutInfo.height;
      this._splitView.layout(width);
      this._splitView.resizeView(0, width * this._layoutInfo.ratio);
    }
  }
};
CallHierarchyTreePeekWidget.TitleMenu = new MenuId("callhierarchy/title");
CallHierarchyTreePeekWidget = __decorateClass([
  __decorateParam(3, IThemeService),
  __decorateParam(4, peekView.IPeekViewService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IInstantiationService)
], CallHierarchyTreePeekWidget);
export {
  CallHierarchyTreePeekWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jYWxsSGllcmFyY2h5L2Jyb3dzZXIvY2FsbEhpZXJhcmNoeVBlZWsudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvY2FsbEhpZXJhcmNoeS5jc3MnO1xuaW1wb3J0ICogYXMgcGVla1ZpZXcgZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvcGVla1ZpZXcvYnJvd3Nlci9wZWVrVmlldy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBDYWxsSGllcmFyY2h5RGlyZWN0aW9uLCBDYWxsSGllcmFyY2h5TW9kZWwgfSBmcm9tICcuLi9jb21tb24vY2FsbEhpZXJhcmNoeS5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hBc3luY0RhdGFUcmVlLCBJV29ya2JlbmNoQXN5bmNEYXRhVHJlZU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRnV6enlTY29yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0ICogYXMgY2FsbEhUcmVlIGZyb20gJy4vY2FsbEhpZXJhcmNoeVRyZWUuanMnO1xuaW1wb3J0IHsgSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hc3luY0RhdGFUcmVlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFNjcm9sbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNwbGl0VmlldywgT3JpZW50YXRpb24sIFNpemluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zcGxpdHZpZXcvc3BsaXR2aWV3LmpzJztcbmltcG9ydCB7IERpbWVuc2lvbiwgaXNLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2VtYmVkZGVkQ29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyB0b0Rpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBUcmFja2VkUmFuZ2VTdGlja2luZXNzLCBJTW9kZWxEZWx0YURlY29yYXRpb24sIElNb2RlbERlY29yYXRpb25PcHRpb25zLCBPdmVydmlld1J1bGVyTGFuZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgdGhlbWVDb2xvckZyb21JZCwgSVRoZW1lU2VydmljZSwgSUNvbG9yVGhlbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBUcmVlTW91c2VFdmVudFRhcmdldCwgSVRyZWVOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgTWVudUlkLCBJTWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuXG5jb25zdCBlbnVtIFN0YXRlIHtcblx0TG9hZGluZyA9ICdsb2FkaW5nJyxcblx0TWVzc2FnZSA9ICdtZXNzYWdlJyxcblx0RGF0YSA9ICdkYXRhJ1xufVxuXG5jbGFzcyBMYXlvdXRJbmZvIHtcblxuXHRzdGF0aWMgc3RvcmUoaW5mbzogTGF5b3V0SW5mbywgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSk6IHZvaWQge1xuXHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKCdjYWxsSGllcmFyY2h5UGVla0xheW91dCcsIEpTT04uc3RyaW5naWZ5KGluZm8pLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0fVxuXG5cdHN0YXRpYyByZXRyaWV2ZShzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlKTogTGF5b3V0SW5mbyB7XG5cdFx0Y29uc3QgdmFsdWUgPSBzdG9yYWdlU2VydmljZS5nZXQoJ2NhbGxIaWVyYXJjaHlQZWVrTGF5b3V0JywgU3RvcmFnZVNjb3BlLlBST0ZJTEUsICd7fScpO1xuXHRcdGNvbnN0IGRlZmF1bHRJbmZvOiBMYXlvdXRJbmZvID0geyByYXRpbzogMC43LCBoZWlnaHQ6IDE3IH07XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiB7IC4uLmRlZmF1bHRJbmZvLCAuLi5KU09OLnBhcnNlKHZhbHVlKSB9O1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIGRlZmF1bHRJbmZvO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByYXRpbzogbnVtYmVyLFxuXHRcdHB1YmxpYyBoZWlnaHQ6IG51bWJlclxuXHQpIHsgfVxufVxuXG5jbGFzcyBDYWxsSGllcmFyY2h5VHJlZSBleHRlbmRzIFdvcmtiZW5jaEFzeW5jRGF0YVRyZWU8Q2FsbEhpZXJhcmNoeU1vZGVsLCBjYWxsSFRyZWUuQ2FsbCwgRnV6enlTY29yZT4geyB9XG5cbmV4cG9ydCBjbGFzcyBDYWxsSGllcmFyY2h5VHJlZVBlZWtXaWRnZXQgZXh0ZW5kcyBwZWVrVmlldy5QZWVrVmlld1dpZGdldCB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFRpdGxlTWVudSA9IG5ldyBNZW51SWQoJ2NhbGxoaWVyYXJjaHkvdGl0bGUnKTtcblxuXHRwcml2YXRlIF9wYXJlbnQhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfbWVzc2FnZSE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9zcGxpdFZpZXchOiBTcGxpdFZpZXc7XG5cdHByaXZhdGUgX3RyZWUhOiBDYWxsSGllcmFyY2h5VHJlZTtcblx0cHJpdmF0ZSBfdHJlZVZpZXdTdGF0ZXMgPSBuZXcgTWFwPENhbGxIaWVyYXJjaHlEaXJlY3Rpb24sIElBc3luY0RhdGFUcmVlVmlld1N0YXRlPigpO1xuXHRwcml2YXRlIF9lZGl0b3IhOiBFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQ7XG5cdHByaXZhdGUgX2RpbSE6IERpbWVuc2lvbjtcblx0cHJpdmF0ZSBfbGF5b3V0SW5mbyE6IExheW91dEluZm87XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJldmlld0Rpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF93aGVyZTogSVBvc2l0aW9uLFxuXHRcdHByaXZhdGUgX2RpcmVjdGlvbjogQ2FsbEhpZXJhcmNoeURpcmVjdGlvbixcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QHBlZWtWaWV3LklQZWVrVmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcGVla1ZpZXdTZXJ2aWNlOiBwZWVrVmlldy5JUGVla1ZpZXdTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihlZGl0b3IsIHsgc2hvd0ZyYW1lOiB0cnVlLCBzaG93QXJyb3c6IHRydWUsIGlzUmVzaXplYWJsZTogdHJ1ZSwgaXNBY2Nlc3NpYmxlOiB0cnVlIH0sIF9pbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0XHR0aGlzLl9wZWVrVmlld1NlcnZpY2UuYWRkRXhjbHVzaXZlV2lkZ2V0KGVkaXRvciwgdGhpcyk7XG5cdFx0dGhpcy5fYXBwbHlUaGVtZSh0aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSh0aGlzLl9hcHBseVRoZW1lLCB0aGlzKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3ByZXZpZXdEaXNwb3NhYmxlKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0TGF5b3V0SW5mby5zdG9yZSh0aGlzLl9sYXlvdXRJbmZvLCB0aGlzLl9zdG9yYWdlU2VydmljZSk7XG5cdFx0dGhpcy5fc3BsaXRWaWV3LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl90cmVlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9lZGl0b3IuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGdldCBkaXJlY3Rpb24oKTogQ2FsbEhpZXJhcmNoeURpcmVjdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2RpcmVjdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgX2FwcGx5VGhlbWUodGhlbWU6IElDb2xvclRoZW1lKSB7XG5cdFx0Y29uc3QgYm9yZGVyQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihwZWVrVmlldy5wZWVrVmlld0JvcmRlcikgfHwgQ29sb3IudHJhbnNwYXJlbnQ7XG5cdFx0dGhpcy5zdHlsZSh7XG5cdFx0XHRhcnJvd0NvbG9yOiBib3JkZXJDb2xvcixcblx0XHRcdGZyYW1lQ29sb3I6IGJvcmRlckNvbG9yLFxuXHRcdFx0aGVhZGVyQmFja2dyb3VuZENvbG9yOiB0aGVtZS5nZXRDb2xvcihwZWVrVmlldy5wZWVrVmlld1RpdGxlQmFja2dyb3VuZCkgfHwgQ29sb3IudHJhbnNwYXJlbnQsXG5cdFx0XHRwcmltYXJ5SGVhZGluZ0NvbG9yOiB0aGVtZS5nZXRDb2xvcihwZWVrVmlldy5wZWVrVmlld1RpdGxlRm9yZWdyb3VuZCksXG5cdFx0XHRzZWNvbmRhcnlIZWFkaW5nQ29sb3I6IHRoZW1lLmdldENvbG9yKHBlZWtWaWV3LnBlZWtWaWV3VGl0bGVJbmZvRm9yZWdyb3VuZClcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfZmlsbEhlYWQoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLl9maWxsSGVhZChjb250YWluZXIsIHRydWUpO1xuXG5cdFx0Y29uc3QgbWVudSA9IHRoaXMuX21lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoQ2FsbEhpZXJhcmNoeVRyZWVQZWVrV2lkZ2V0LlRpdGxlTWVudSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IHVwZGF0ZVRvb2xiYXIgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBhY3Rpb25zID0gZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnMobWVudS5nZXRBY3Rpb25zKCkpO1xuXHRcdFx0dGhpcy5fYWN0aW9uYmFyV2lkZ2V0IS5jbGVhcigpO1xuXHRcdFx0dGhpcy5fYWN0aW9uYmFyV2lkZ2V0IS5wdXNoKGFjdGlvbnMsIHsgbGFiZWw6IGZhbHNlLCBpY29uOiB0cnVlIH0pO1xuXHRcdH07XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKG1lbnUpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChtZW51Lm9uRGlkQ2hhbmdlKHVwZGF0ZVRvb2xiYXIpKTtcblx0XHR1cGRhdGVUb29sYmFyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2ZpbGxCb2R5KHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblxuXHRcdHRoaXMuX2xheW91dEluZm8gPSBMYXlvdXRJbmZvLnJldHJpZXZlKHRoaXMuX3N0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0aGlzLl9kaW0gPSBuZXcgRGltZW5zaW9uKDAsIDApO1xuXG5cdFx0dGhpcy5fcGFyZW50ID0gcGFyZW50O1xuXHRcdHBhcmVudC5jbGFzc0xpc3QuYWRkKCdjYWxsLWhpZXJhcmNoeScpO1xuXG5cdFx0Y29uc3QgbWVzc2FnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdG1lc3NhZ2UuY2xhc3NMaXN0LmFkZCgnbWVzc2FnZScpO1xuXHRcdHBhcmVudC5hcHBlbmRDaGlsZChtZXNzYWdlKTtcblx0XHR0aGlzLl9tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLl9tZXNzYWdlLnRhYkluZGV4ID0gMDtcblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdyZXN1bHRzJyk7XG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLl9zcGxpdFZpZXcgPSBuZXcgU3BsaXRWaWV3KGNvbnRhaW5lciwgeyBvcmllbnRhdGlvbjogT3JpZW50YXRpb24uSE9SSVpPTlRBTCB9KTtcblxuXHRcdC8vIGVkaXRvciBzdHVmZlxuXHRcdGNvbnN0IGVkaXRvckNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGVkaXRvckNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdlZGl0b3InKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZWRpdG9yQ29udGFpbmVyKTtcblx0XHRjb25zdCBlZGl0b3JPcHRpb25zOiBJRWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdHNjcm9sbEJleW9uZExhc3RMaW5lOiBmYWxzZSxcblx0XHRcdHNjcm9sbGJhcjoge1xuXHRcdFx0XHR2ZXJ0aWNhbFNjcm9sbGJhclNpemU6IDE0LFxuXHRcdFx0XHRob3Jpem9udGFsOiAnYXV0bycsXG5cdFx0XHRcdHVzZVNoYWRvd3M6IHRydWUsXG5cdFx0XHRcdHZlcnRpY2FsSGFzQXJyb3dzOiBmYWxzZSxcblx0XHRcdFx0aG9yaXpvbnRhbEhhc0Fycm93czogZmFsc2UsXG5cdFx0XHRcdGFsd2F5c0NvbnN1bWVNb3VzZVdoZWVsOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdG92ZXJ2aWV3UnVsZXJMYW5lczogMixcblx0XHRcdGZpeGVkT3ZlcmZsb3dXaWRnZXRzOiB0cnVlLFxuXHRcdFx0bWluaW1hcDoge1xuXHRcdFx0XHRlbmFibGVkOiBmYWxzZVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5fZWRpdG9yID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQsXG5cdFx0XHRlZGl0b3JDb250YWluZXIsXG5cdFx0XHRlZGl0b3JPcHRpb25zLFxuXHRcdFx0e30sXG5cdFx0XHR0aGlzLmVkaXRvclxuXHRcdCk7XG5cblx0XHQvLyB0cmVlIHN0dWZmXG5cdFx0Y29uc3QgdHJlZUNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRyZWVDb250YWluZXIuY2xhc3NMaXN0LmFkZCgndHJlZScpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0cmVlQ29udGFpbmVyKTtcblx0XHRjb25zdCBvcHRpb25zOiBJV29ya2JlbmNoQXN5bmNEYXRhVHJlZU9wdGlvbnM8Y2FsbEhUcmVlLkNhbGwsIEZ1enp5U2NvcmU+ID0ge1xuXHRcdFx0c29ydGVyOiBuZXcgY2FsbEhUcmVlLlNvcnRlcigpLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBuZXcgY2FsbEhUcmVlLkFjY2Vzc2liaWxpdHlQcm92aWRlcigoKSA9PiB0aGlzLl9kaXJlY3Rpb24pLFxuXHRcdFx0aWRlbnRpdHlQcm92aWRlcjogbmV3IGNhbGxIVHJlZS5JZGVudGl0eVByb3ZpZGVyKCgpID0+IHRoaXMuX2RpcmVjdGlvbiksXG5cdFx0XHRleHBhbmRPbmx5T25Ud2lzdGllQ2xpY2s6IHRydWUsXG5cdFx0XHRvdmVycmlkZVN0eWxlczoge1xuXHRcdFx0XHRsaXN0QmFja2dyb3VuZDogcGVla1ZpZXcucGVla1ZpZXdSZXN1bHRzQmFja2dyb3VuZFxuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5fdHJlZSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Q2FsbEhpZXJhcmNoeVRyZWUsXG5cdFx0XHQnQ2FsbEhpZXJhcmNoeVBlZWsnLFxuXHRcdFx0dHJlZUNvbnRhaW5lcixcblx0XHRcdG5ldyBjYWxsSFRyZWUuVmlydHVhbERlbGVnYXRlKCksXG5cdFx0XHRbdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoY2FsbEhUcmVlLkNhbGxSZW5kZXJlcildLFxuXHRcdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoY2FsbEhUcmVlLkRhdGFTb3VyY2UsICgpID0+IHRoaXMuX2RpcmVjdGlvbiksXG5cdFx0XHRvcHRpb25zXG5cdFx0KTtcblxuXHRcdC8vIHNwbGl0IHN0dWZmXG5cdFx0dGhpcy5fc3BsaXRWaWV3LmFkZFZpZXcoe1xuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRlbGVtZW50OiBlZGl0b3JDb250YWluZXIsXG5cdFx0XHRtaW5pbXVtU2l6ZTogMjAwLFxuXHRcdFx0bWF4aW11bVNpemU6IE51bWJlci5NQVhfVkFMVUUsXG5cdFx0XHRsYXlvdXQ6ICh3aWR0aCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fZGltLmhlaWdodCkge1xuXHRcdFx0XHRcdHRoaXMuX2VkaXRvci5sYXlvdXQoeyBoZWlnaHQ6IHRoaXMuX2RpbS5oZWlnaHQsIHdpZHRoIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXG5cdFx0dGhpcy5fc3BsaXRWaWV3LmFkZFZpZXcoe1xuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRlbGVtZW50OiB0cmVlQ29udGFpbmVyLFxuXHRcdFx0bWluaW11bVNpemU6IDEwMCxcblx0XHRcdG1heGltdW1TaXplOiBOdW1iZXIuTUFYX1ZBTFVFLFxuXHRcdFx0bGF5b3V0OiAod2lkdGgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2RpbS5oZWlnaHQpIHtcblx0XHRcdFx0XHR0aGlzLl90cmVlLmxheW91dCh0aGlzLl9kaW0uaGVpZ2h0LCB3aWR0aCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fc3BsaXRWaWV3Lm9uRGlkU2FzaENoYW5nZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZGltLndpZHRoKSB7XG5cdFx0XHRcdHRoaXMuX2xheW91dEluZm8ucmF0aW8gPSB0aGlzLl9zcGxpdFZpZXcuZ2V0Vmlld1NpemUoMCkgLyB0aGlzLl9kaW0ud2lkdGg7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gdXBkYXRlIGVkaXRvclxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl90cmVlLm9uRGlkQ2hhbmdlRm9jdXModGhpcy5fdXBkYXRlUHJldmlldywgdGhpcykpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2VkaXRvci5vbk1vdXNlRG93bihlID0+IHtcblx0XHRcdGNvbnN0IHsgZXZlbnQsIHRhcmdldCB9ID0gZTtcblx0XHRcdGlmIChldmVudC5kZXRhaWwgIT09IDIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgW2ZvY3VzXSA9IHRoaXMuX3RyZWUuZ2V0Rm9jdXMoKTtcblx0XHRcdGlmICghZm9jdXMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZTogZm9jdXMuaXRlbS51cmksXG5cdFx0XHRcdG9wdGlvbnM6IHsgc2VsZWN0aW9uOiB0YXJnZXQucmFuZ2UhIH1cblx0XHRcdH0pO1xuXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3RyZWUub25Nb3VzZURibENsaWNrKGUgPT4ge1xuXHRcdFx0aWYgKGUudGFyZ2V0ID09PSBUcmVlTW91c2VFdmVudFRhcmdldC5Ud2lzdGllKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuZWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5fZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0XHRyZXNvdXJjZTogZS5lbGVtZW50Lml0ZW0udXJpLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHsgc2VsZWN0aW9uOiBlLmVsZW1lbnQuaXRlbS5zZWxlY3Rpb25SYW5nZSwgcGlubmVkOiB0cnVlIH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3RyZWUub25EaWRDaGFuZ2VTZWxlY3Rpb24oZSA9PiB7XG5cdFx0XHRjb25zdCBbZWxlbWVudF0gPSBlLmVsZW1lbnRzO1xuXHRcdFx0Ly8gZG9uJ3QgY2xvc2Ugb24gY2xpY2tcblx0XHRcdGlmIChlbGVtZW50ICYmIGlzS2V5Ym9hcmRFdmVudChlLmJyb3dzZXJFdmVudCkpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0cmVzb3VyY2U6IGVsZW1lbnQuaXRlbS51cmksXG5cdFx0XHRcdFx0b3B0aW9uczogeyBzZWxlY3Rpb246IGVsZW1lbnQuaXRlbS5zZWxlY3Rpb25SYW5nZSwgcGlubmVkOiB0cnVlIH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdXBkYXRlUHJldmlldygpIHtcblx0XHRjb25zdCBbZWxlbWVudF0gPSB0aGlzLl90cmVlLmdldEZvY3VzKCk7XG5cdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHJldmlld0Rpc3Bvc2FibGUuY2xlYXIoKTtcblxuXHRcdC8vIHVwZGF0ZTogZWRpdG9yIGFuZCBlZGl0b3IgaGlnaGxpZ2h0c1xuXHRcdGNvbnN0IG9wdGlvbnM6IElNb2RlbERlY29yYXRpb25PcHRpb25zID0ge1xuXHRcdFx0ZGVzY3JpcHRpb246ICdjYWxsLWhpZXJhcmNoeS1kZWNvcmF0aW9uJyxcblx0XHRcdHN0aWNraW5lc3M6IFRyYWNrZWRSYW5nZVN0aWNraW5lc3MuTmV2ZXJHcm93c1doZW5UeXBpbmdBdEVkZ2VzLFxuXHRcdFx0Y2xhc3NOYW1lOiAnY2FsbC1kZWNvcmF0aW9uJyxcblx0XHRcdG92ZXJ2aWV3UnVsZXI6IHtcblx0XHRcdFx0Y29sb3I6IHRoZW1lQ29sb3JGcm9tSWQocGVla1ZpZXcucGVla1ZpZXdFZGl0b3JNYXRjaEhpZ2hsaWdodCksXG5cdFx0XHRcdHBvc2l0aW9uOiBPdmVydmlld1J1bGVyTGFuZS5DZW50ZXJcblx0XHRcdH0sXG5cdFx0fTtcblxuXHRcdGxldCBwcmV2aWV3VXJpOiBVUkk7XG5cdFx0aWYgKHRoaXMuX2RpcmVjdGlvbiA9PT0gQ2FsbEhpZXJhcmNoeURpcmVjdGlvbi5DYWxsc0Zyb20pIHtcblx0XHRcdC8vIG91dGdvaW5nIGNhbGxzOiBzaG93IGNhbGxlciBhbmQgaGlnaGxpZ2h0IGZvY3VzZWQgY2FsbHNcblx0XHRcdHByZXZpZXdVcmkgPSBlbGVtZW50LnBhcmVudCA/IGVsZW1lbnQucGFyZW50Lml0ZW0udXJpIDogZWxlbWVudC5tb2RlbC5yb290LnVyaTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBpbmNvbWluZyBjYWxsczogc2hvdyBjYWxsZXIgYW5kIGhpZ2hsaWdodCBmb2N1c2VkIGNhbGxzXG5cdFx0XHRwcmV2aWV3VXJpID0gZWxlbWVudC5pdGVtLnVyaTtcblx0XHR9XG5cblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UocHJldmlld1VyaSk7XG5cdFx0dGhpcy5fZWRpdG9yLnNldE1vZGVsKHZhbHVlLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwpO1xuXG5cdFx0Ly8gc2V0IGRlY29yYXRpb25zIGZvciBjYWxsZXIgcmFuZ2VzIChpZiBpbiB0aGUgc2FtZSBmaWxlKVxuXHRcdGNvbnN0IGRlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IFtdO1xuXHRcdGxldCBmdWxsUmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgbG9jYXRpb25zID0gZWxlbWVudC5sb2NhdGlvbnM7XG5cdFx0aWYgKCFsb2NhdGlvbnMpIHtcblx0XHRcdGxvY2F0aW9ucyA9IFt7IHVyaTogZWxlbWVudC5pdGVtLnVyaSwgcmFuZ2U6IGVsZW1lbnQuaXRlbS5zZWxlY3Rpb25SYW5nZSB9XTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBsb2Mgb2YgbG9jYXRpb25zKSB7XG5cdFx0XHRpZiAobG9jLnVyaS50b1N0cmluZygpID09PSBwcmV2aWV3VXJpLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0ZGVjb3JhdGlvbnMucHVzaCh7IHJhbmdlOiBsb2MucmFuZ2UsIG9wdGlvbnMgfSk7XG5cdFx0XHRcdGZ1bGxSYW5nZSA9ICFmdWxsUmFuZ2UgPyBsb2MucmFuZ2UgOiBSYW5nZS5wbHVzUmFuZ2UobG9jLnJhbmdlLCBmdWxsUmFuZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoZnVsbFJhbmdlKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3IucmV2ZWFsUmFuZ2VJbkNlbnRlcihmdWxsUmFuZ2UsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25zQ29sbGVjdGlvbiA9IHRoaXMuX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oZGVjb3JhdGlvbnMpO1xuXHRcdFx0dGhpcy5fcHJldmlld0Rpc3Bvc2FibGUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBkZWNvcmF0aW9uc0NvbGxlY3Rpb24uY2xlYXIoKSkpO1xuXHRcdH1cblx0XHR0aGlzLl9wcmV2aWV3RGlzcG9zYWJsZS5hZGQodmFsdWUpO1xuXG5cdFx0Ly8gdXBkYXRlOiB0aXRsZVxuXHRcdGNvbnN0IHRpdGxlID0gdGhpcy5fZGlyZWN0aW9uID09PSBDYWxsSGllcmFyY2h5RGlyZWN0aW9uLkNhbGxzRnJvbVxuXHRcdFx0PyBsb2NhbGl6ZSgnY2FsbEZyb20nLCBcIkNhbGxzIGZyb20gJ3swfSdcIiwgZWxlbWVudC5tb2RlbC5yb290Lm5hbWUpXG5cdFx0XHQ6IGxvY2FsaXplKCdjYWxsc1RvJywgXCJDYWxsZXJzIG9mICd7MH0nXCIsIGVsZW1lbnQubW9kZWwucm9vdC5uYW1lKTtcblx0XHR0aGlzLnNldFRpdGxlKHRpdGxlKTtcblx0fVxuXG5cdHNob3dMb2FkaW5nKCk6IHZvaWQge1xuXHRcdHRoaXMuX3BhcmVudC5kYXRhc2V0WydzdGF0ZSddID0gU3RhdGUuTG9hZGluZztcblx0XHR0aGlzLnNldFRpdGxlKGxvY2FsaXplKCd0aXRsZS5sb2FkaW5nJywgXCJMb2FkaW5nLi4uXCIpKTtcblx0XHR0aGlzLl9zaG93KCk7XG5cdH1cblxuXHRzaG93TWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9wYXJlbnQuZGF0YXNldFsnc3RhdGUnXSA9IFN0YXRlLk1lc3NhZ2U7XG5cdFx0dGhpcy5zZXRUaXRsZSgnJyk7XG5cdFx0dGhpcy5zZXRNZXRhVGl0bGUoJycpO1xuXHRcdHRoaXMuX21lc3NhZ2UuaW5uZXJUZXh0ID0gbWVzc2FnZTtcblx0XHR0aGlzLl9zaG93KCk7XG5cdFx0dGhpcy5fbWVzc2FnZS5mb2N1cygpO1xuXHR9XG5cblx0YXN5bmMgc2hvd01vZGVsKG1vZGVsOiBDYWxsSGllcmFyY2h5TW9kZWwpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdHRoaXMuX3Nob3coKTtcblx0XHRjb25zdCB2aWV3U3RhdGUgPSB0aGlzLl90cmVlVmlld1N0YXRlcy5nZXQodGhpcy5fZGlyZWN0aW9uKTtcblxuXHRcdGF3YWl0IHRoaXMuX3RyZWUuc2V0SW5wdXQobW9kZWwsIHZpZXdTdGF0ZSk7XG5cblx0XHRjb25zdCByb290ID0gPElUcmVlTm9kZTxjYWxsSFRyZWUuQ2FsbCwgRnV6enlTY29yZT4+dGhpcy5fdHJlZS5nZXROb2RlKG1vZGVsKS5jaGlsZHJlblswXTtcblx0XHRhd2FpdCB0aGlzLl90cmVlLmV4cGFuZChyb290LmVsZW1lbnQpO1xuXG5cdFx0aWYgKHJvb3QuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQvL1xuXHRcdFx0dGhpcy5zaG93TWVzc2FnZSh0aGlzLl9kaXJlY3Rpb24gPT09IENhbGxIaWVyYXJjaHlEaXJlY3Rpb24uQ2FsbHNGcm9tXG5cdFx0XHRcdD8gbG9jYWxpemUoJ2VtcHQuY2FsbHNGcm9tJywgXCJObyBjYWxscyBmcm9tICd7MH0nXCIsIG1vZGVsLnJvb3QubmFtZSlcblx0XHRcdFx0OiBsb2NhbGl6ZSgnZW1wdC5jYWxsc1RvJywgXCJObyBjYWxsZXJzIG9mICd7MH0nXCIsIG1vZGVsLnJvb3QubmFtZSkpO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3BhcmVudC5kYXRhc2V0WydzdGF0ZSddID0gU3RhdGUuRGF0YTtcblx0XHRcdGlmICghdmlld1N0YXRlIHx8IHRoaXMuX3RyZWUuZ2V0Rm9jdXMoKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dGhpcy5fdHJlZS5zZXRGb2N1cyhbcm9vdC5jaGlsZHJlblswXS5lbGVtZW50XSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl90cmVlLmRvbUZvY3VzKCk7XG5cdFx0XHR0aGlzLl91cGRhdGVQcmV2aWV3KCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0TW9kZWwoKTogQ2FsbEhpZXJhcmNoeU1vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fdHJlZS5nZXRJbnB1dCgpO1xuXHR9XG5cblx0Z2V0Rm9jdXNlZCgpOiBjYWxsSFRyZWUuQ2FsbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3RyZWUuZ2V0Rm9jdXMoKVswXTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZURpcmVjdGlvbihuZXdEaXJlY3Rpb246IENhbGxIaWVyYXJjaHlEaXJlY3Rpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX3RyZWUuZ2V0SW5wdXQoKTtcblx0XHRpZiAobW9kZWwgJiYgbmV3RGlyZWN0aW9uICE9PSB0aGlzLl9kaXJlY3Rpb24pIHtcblx0XHRcdHRoaXMuX3RyZWVWaWV3U3RhdGVzLnNldCh0aGlzLl9kaXJlY3Rpb24sIHRoaXMuX3RyZWUuZ2V0Vmlld1N0YXRlKCkpO1xuXHRcdFx0dGhpcy5fZGlyZWN0aW9uID0gbmV3RGlyZWN0aW9uO1xuXHRcdFx0YXdhaXQgdGhpcy5zaG93TW9kZWwobW9kZWwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Nob3coKSB7XG5cdFx0aWYgKCF0aGlzLl9pc1Nob3dpbmcpIHtcblx0XHRcdHRoaXMuZWRpdG9yLnJldmVhbExpbmVJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KHRoaXMuX3doZXJlLmxpbmVOdW1iZXIsIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHRcdHN1cGVyLnNob3coUmFuZ2UuZnJvbVBvc2l0aW9ucyh0aGlzLl93aGVyZSksIHRoaXMuX2xheW91dEluZm8uaGVpZ2h0KTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX29uV2lkdGgod2lkdGg6IG51bWJlcikge1xuXHRcdGlmICh0aGlzLl9kaW0pIHtcblx0XHRcdHRoaXMuX2RvTGF5b3V0Qm9keSh0aGlzLl9kaW0uaGVpZ2h0LCB3aWR0aCk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9kb0xheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZGltLmhlaWdodCAhPT0gaGVpZ2h0IHx8IHRoaXMuX2RpbS53aWR0aCAhPT0gd2lkdGgpIHtcblx0XHRcdHN1cGVyLl9kb0xheW91dEJvZHkoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0XHR0aGlzLl9kaW0gPSBuZXcgRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdFx0dGhpcy5fbGF5b3V0SW5mby5oZWlnaHQgPSB0aGlzLl92aWV3Wm9uZSA/IHRoaXMuX3ZpZXdab25lLmhlaWdodEluTGluZXMgOiB0aGlzLl9sYXlvdXRJbmZvLmhlaWdodDtcblx0XHRcdHRoaXMuX3NwbGl0Vmlldy5sYXlvdXQod2lkdGgpO1xuXHRcdFx0dGhpcy5fc3BsaXRWaWV3LnJlc2l6ZVZpZXcoMCwgd2lkdGggKiB0aGlzLl9sYXlvdXRJbmZvLnJhdGlvKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFlBQVksY0FBYztBQUUxQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDhCQUFrRDtBQUMzRCxTQUFTLDhCQUE4RDtBQUV2RSxZQUFZLGVBQWU7QUFFM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBaUIsYUFBYTtBQUM5QixTQUFTLFdBQVcsYUFBYSxjQUFjO0FBQy9DLFNBQVMsV0FBVyx1QkFBdUI7QUFDM0MsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsY0FBYyx1QkFBdUI7QUFDOUMsU0FBUyx3QkFBd0UseUJBQXlCO0FBQzFHLFNBQVMsa0JBQWtCLHFCQUFrQztBQUU3RCxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLGFBQWE7QUFDdEIsU0FBUyw0QkFBdUM7QUFFaEQsU0FBUyxRQUFRLG9CQUFvQjtBQUNyQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtCQUErQjtBQUV4QyxJQUFXLFFBQVgsa0JBQVdBLFdBQVg7QUFDQyxFQUFBQSxPQUFBLGFBQVU7QUFD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
