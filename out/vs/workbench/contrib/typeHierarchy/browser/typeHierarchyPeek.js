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
import "./media/typeHierarchy.css";
import { Dimension, isKeyboardEvent } from "../../../../base/browser/dom.js";
import { Orientation, Sizing, SplitView } from "../../../../base/browser/ui/splitview/splitview.js";
import { TreeMouseEventTarget } from "../../../../base/browser/ui/tree/tree.js";
import { Color } from "../../../../base/common/color.js";
import { Event } from "../../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { TrackedRangeStickiness, OverviewRulerLane } from "../../../../editor/common/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import * as peekView from "../../../../editor/contrib/peekView/browser/peekView.js";
import { localize } from "../../../../nls.js";
import { getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IThemeService, themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import * as typeHTree from "./typeHierarchyTree.js";
import { TypeHierarchyDirection } from "../common/typeHierarchy.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
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
    storageService.store("typeHierarchyPeekLayout", JSON.stringify(info), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  static retrieve(storageService) {
    const value = storageService.get("typeHierarchyPeekLayout", StorageScope.PROFILE, "{}");
    const defaultInfo = { ratio: 0.7, height: 17 };
    try {
      return { ...defaultInfo, ...JSON.parse(value) };
    } catch {
      return defaultInfo;
    }
  }
}
class TypeHierarchyTree extends WorkbenchAsyncDataTree {
}
let TypeHierarchyTreePeekWidget = class extends peekView.PeekViewWidget {
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
    const menu = this._menuService.createMenu(TypeHierarchyTreePeekWidget.TitleMenu, this._contextKeyService);
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
    parent.classList.add("type-hierarchy");
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
      sorter: new typeHTree.Sorter(),
      accessibilityProvider: new typeHTree.AccessibilityProvider(() => this._direction),
      identityProvider: new typeHTree.IdentityProvider(() => this._direction),
      expandOnlyOnTwistieClick: true,
      overrideStyles: {
        listBackground: peekView.peekViewResultsBackground
      }
    };
    this._tree = this._instantiationService.createInstance(
      TypeHierarchyTree,
      "TypeHierarchyPeek",
      treeContainer,
      new typeHTree.VirtualDelegate(),
      [this._instantiationService.createInstance(typeHTree.TypeRenderer)],
      this._instantiationService.createInstance(typeHTree.DataSource, () => this._direction),
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
      description: "type-hierarchy-decoration",
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      className: "type-decoration",
      overviewRuler: {
        color: themeColorFromId(peekView.peekViewEditorMatchHighlight),
        position: OverviewRulerLane.Center
      }
    };
    let previewUri;
    if (this._direction === TypeHierarchyDirection.Supertypes) {
      previewUri = element.parent ? element.parent.item.uri : element.model.root.uri;
    } else {
      previewUri = element.item.uri;
    }
    const value = await this._textModelService.createModelReference(previewUri);
    this._editor.setModel(value.object.textEditorModel);
    const decorations = [];
    let fullRange;
    const loc = { uri: element.item.uri, range: element.item.selectionRange };
    if (loc.uri.toString() === previewUri.toString()) {
      decorations.push({ range: loc.range, options });
      fullRange = !fullRange ? loc.range : Range.plusRange(loc.range, fullRange);
    }
    if (fullRange) {
      this._editor.revealRangeInCenter(fullRange, ScrollType.Immediate);
      const decorationsCollection = this._editor.createDecorationsCollection(decorations);
      this._previewDisposable.add(toDisposable(() => decorationsCollection.clear()));
    }
    this._previewDisposable.add(value);
    const title = this._direction === TypeHierarchyDirection.Supertypes ? localize("supertypes", "Supertypes of '{0}'", element.model.root.name) : localize("subtypes", "Subtypes of '{0}'", element.model.root.name);
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
      this.showMessage(this._direction === TypeHierarchyDirection.Supertypes ? localize("empt.supertypes", "No supertypes of '{0}'", model.root.name) : localize("empt.subtypes", "No subtypes of '{0}'", model.root.name));
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
TypeHierarchyTreePeekWidget.TitleMenu = new MenuId("typehierarchy/title");
TypeHierarchyTreePeekWidget = __decorateClass([
  __decorateParam(3, IThemeService),
  __decorateParam(4, peekView.IPeekViewService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IInstantiationService)
], TypeHierarchyTreePeekWidget);
export {
  TypeHierarchyTreePeekWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90eXBlSGllcmFyY2h5L2Jyb3dzZXIvdHlwZUhpZXJhcmNoeVBlZWsudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvdHlwZUhpZXJhcmNoeS5jc3MnO1xuaW1wb3J0IHsgRGltZW5zaW9uLCBpc0tleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IE9yaWVudGF0aW9uLCBTaXppbmcsIFNwbGl0VmlldyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zcGxpdHZpZXcvc3BsaXR2aWV3LmpzJztcbmltcG9ydCB7IElBc3luY0RhdGFUcmVlVmlld1N0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvYXN5bmNEYXRhVHJlZS5qcyc7XG5pbXBvcnQgeyBJVHJlZU5vZGUsIFRyZWVNb3VzZUV2ZW50VGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRnV6enlTY29yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9lbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNjcm9sbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgVHJhY2tlZFJhbmdlU3RpY2tpbmVzcywgSU1vZGVsRGVsdGFEZWNvcmF0aW9uLCBPdmVydmlld1J1bGVyTGFuZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgKiBhcyBwZWVrVmlldyBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9wZWVrVmlldy9icm93c2VyL3BlZWtWaWV3LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEFzeW5jRGF0YVRyZWVPcHRpb25zLCBXb3JrYmVuY2hBc3luY0RhdGFUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJQ29sb3JUaGVtZSwgSVRoZW1lU2VydmljZSwgdGhlbWVDb2xvckZyb21JZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0ICogYXMgdHlwZUhUcmVlIGZyb20gJy4vdHlwZUhpZXJhcmNoeVRyZWUuanMnO1xuaW1wb3J0IHsgVHlwZUhpZXJhcmNoeURpcmVjdGlvbiwgVHlwZUhpZXJhcmNoeU1vZGVsIH0gZnJvbSAnLi4vY29tbW9uL3R5cGVIaWVyYXJjaHkuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuXG4vLyBUb2RvOiBjb3BpZWQgZnJvbSBjYWxsIGhpZXJhcmNoeSwgdG8gZXh0cmFjdFxuY29uc3QgZW51bSBTdGF0ZSB7XG5cdExvYWRpbmcgPSAnbG9hZGluZycsXG5cdE1lc3NhZ2UgPSAnbWVzc2FnZScsXG5cdERhdGEgPSAnZGF0YSdcbn1cblxuY2xhc3MgTGF5b3V0SW5mbyB7XG5cblx0c3RhdGljIHN0b3JlKGluZm86IExheW91dEluZm8sIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpOiB2b2lkIHtcblx0XHRzdG9yYWdlU2VydmljZS5zdG9yZSgndHlwZUhpZXJhcmNoeVBlZWtMYXlvdXQnLCBKU09OLnN0cmluZ2lmeShpbmZvKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRzdGF0aWMgcmV0cmlldmUoc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSk6IExheW91dEluZm8ge1xuXHRcdGNvbnN0IHZhbHVlID0gc3RvcmFnZVNlcnZpY2UuZ2V0KCd0eXBlSGllcmFyY2h5UGVla0xheW91dCcsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAne30nKTtcblx0XHRjb25zdCBkZWZhdWx0SW5mbzogTGF5b3V0SW5mbyA9IHsgcmF0aW86IDAuNywgaGVpZ2h0OiAxNyB9O1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4geyAuLi5kZWZhdWx0SW5mbywgLi4uSlNPTi5wYXJzZSh2YWx1ZSkgfTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiBkZWZhdWx0SW5mbztcblx0XHR9XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmF0aW86IG51bWJlcixcblx0XHRwdWJsaWMgaGVpZ2h0OiBudW1iZXJcblx0KSB7IH1cbn1cblxuY2xhc3MgVHlwZUhpZXJhcmNoeVRyZWUgZXh0ZW5kcyBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPFR5cGVIaWVyYXJjaHlNb2RlbCwgdHlwZUhUcmVlLlR5cGUsIEZ1enp5U2NvcmU+IHsgfVxuXG5leHBvcnQgY2xhc3MgVHlwZUhpZXJhcmNoeVRyZWVQZWVrV2lkZ2V0IGV4dGVuZHMgcGVla1ZpZXcuUGVla1ZpZXdXaWRnZXQge1xuXG5cdHN0YXRpYyByZWFkb25seSBUaXRsZU1lbnUgPSBuZXcgTWVudUlkKCd0eXBlaGllcmFyY2h5L3RpdGxlJyk7XG5cblx0cHJpdmF0ZSBfcGFyZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX21lc3NhZ2UhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfc3BsaXRWaWV3ITogU3BsaXRWaWV3O1xuXHRwcml2YXRlIF90cmVlITogVHlwZUhpZXJhcmNoeVRyZWU7XG5cdHByaXZhdGUgX3RyZWVWaWV3U3RhdGVzID0gbmV3IE1hcDxUeXBlSGllcmFyY2h5RGlyZWN0aW9uLCBJQXN5bmNEYXRhVHJlZVZpZXdTdGF0ZT4oKTtcblx0cHJpdmF0ZSBfZWRpdG9yITogRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0O1xuXHRwcml2YXRlIF9kaW0hOiBEaW1lbnNpb247XG5cdHByaXZhdGUgX2xheW91dEluZm8hOiBMYXlvdXRJbmZvO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3ByZXZpZXdEaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfd2hlcmU6IElQb3NpdGlvbixcblx0XHRwcml2YXRlIF9kaXJlY3Rpb246IFR5cGVIaWVyYXJjaHlEaXJlY3Rpb24sXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBwZWVrVmlldy5JUGVla1ZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3BlZWtWaWV3U2VydmljZTogcGVla1ZpZXcuSVBlZWtWaWV3U2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoZWRpdG9yLCB7IHNob3dGcmFtZTogdHJ1ZSwgc2hvd0Fycm93OiB0cnVlLCBpc1Jlc2l6ZWFibGU6IHRydWUsIGlzQWNjZXNzaWJsZTogdHJ1ZSB9LCBfaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdFx0dGhpcy5fcGVla1ZpZXdTZXJ2aWNlLmFkZEV4Y2x1c2l2ZVdpZGdldChlZGl0b3IsIHRoaXMpO1xuXHRcdHRoaXMuX2FwcGx5VGhlbWUodGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UodGhpcy5fYXBwbHlUaGVtZSwgdGhpcykpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9wcmV2aWV3RGlzcG9zYWJsZSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdExheW91dEluZm8uc3RvcmUodGhpcy5fbGF5b3V0SW5mbywgdGhpcy5fc3RvcmFnZVNlcnZpY2UpO1xuXHRcdHRoaXMuX3NwbGl0Vmlldy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fdHJlZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXQgZGlyZWN0aW9uKCk6IFR5cGVIaWVyYXJjaHlEaXJlY3Rpb24ge1xuXHRcdHJldHVybiB0aGlzLl9kaXJlY3Rpb247XG5cdH1cblxuXHRwcml2YXRlIF9hcHBseVRoZW1lKHRoZW1lOiBJQ29sb3JUaGVtZSkge1xuXHRcdGNvbnN0IGJvcmRlckNvbG9yID0gdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXcucGVla1ZpZXdCb3JkZXIpIHx8IENvbG9yLnRyYW5zcGFyZW50O1xuXHRcdHRoaXMuc3R5bGUoe1xuXHRcdFx0YXJyb3dDb2xvcjogYm9yZGVyQ29sb3IsXG5cdFx0XHRmcmFtZUNvbG9yOiBib3JkZXJDb2xvcixcblx0XHRcdGhlYWRlckJhY2tncm91bmRDb2xvcjogdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXcucGVla1ZpZXdUaXRsZUJhY2tncm91bmQpIHx8IENvbG9yLnRyYW5zcGFyZW50LFxuXHRcdFx0cHJpbWFyeUhlYWRpbmdDb2xvcjogdGhlbWUuZ2V0Q29sb3IocGVla1ZpZXcucGVla1ZpZXdUaXRsZUZvcmVncm91bmQpLFxuXHRcdFx0c2Vjb25kYXJ5SGVhZGluZ0NvbG9yOiB0aGVtZS5nZXRDb2xvcihwZWVrVmlldy5wZWVrVmlld1RpdGxlSW5mb0ZvcmVncm91bmQpXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX2ZpbGxIZWFkKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5fZmlsbEhlYWQoY29udGFpbmVyLCB0cnVlKTtcblxuXHRcdGNvbnN0IG1lbnUgPSB0aGlzLl9tZW51U2VydmljZS5jcmVhdGVNZW51KFR5cGVIaWVyYXJjaHlUcmVlUGVla1dpZGdldC5UaXRsZU1lbnUsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCB1cGRhdGVUb29sYmFyID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zKG1lbnUuZ2V0QWN0aW9ucygpKTtcblx0XHRcdHRoaXMuX2FjdGlvbmJhcldpZGdldCEuY2xlYXIoKTtcblx0XHRcdHRoaXMuX2FjdGlvbmJhcldpZGdldCEucHVzaChhY3Rpb25zLCB7IGxhYmVsOiBmYWxzZSwgaWNvbjogdHJ1ZSB9KTtcblx0XHR9O1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChtZW51KTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQobWVudS5vbkRpZENoYW5nZSh1cGRhdGVUb29sYmFyKSk7XG5cdFx0dXBkYXRlVG9vbGJhcigpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9maWxsQm9keShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cblx0XHR0aGlzLl9sYXlvdXRJbmZvID0gTGF5b3V0SW5mby5yZXRyaWV2ZSh0aGlzLl9zdG9yYWdlU2VydmljZSk7XG5cdFx0dGhpcy5fZGltID0gbmV3IERpbWVuc2lvbigwLCAwKTtcblxuXHRcdHRoaXMuX3BhcmVudCA9IHBhcmVudDtcblx0XHRwYXJlbnQuY2xhc3NMaXN0LmFkZCgndHlwZS1oaWVyYXJjaHknKTtcblxuXHRcdGNvbnN0IG1lc3NhZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRtZXNzYWdlLmNsYXNzTGlzdC5hZGQoJ21lc3NhZ2UnKTtcblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQobWVzc2FnZSk7XG5cdFx0dGhpcy5fbWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0dGhpcy5fbWVzc2FnZS50YWJJbmRleCA9IDA7XG5cblx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgncmVzdWx0cycpO1xuXHRcdHBhcmVudC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuXG5cdFx0dGhpcy5fc3BsaXRWaWV3ID0gbmV3IFNwbGl0Vmlldyhjb250YWluZXIsIHsgb3JpZW50YXRpb246IE9yaWVudGF0aW9uLkhPUklaT05UQUwgfSk7XG5cblx0XHQvLyBlZGl0b3Igc3R1ZmZcblx0XHRjb25zdCBlZGl0b3JDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRlZGl0b3JDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZWRpdG9yJyk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGVkaXRvckNvbnRhaW5lcik7XG5cdFx0Y29uc3QgZWRpdG9yT3B0aW9uczogSUVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRzY3JvbGxCZXlvbmRMYXN0TGluZTogZmFsc2UsXG5cdFx0XHRzY3JvbGxiYXI6IHtcblx0XHRcdFx0dmVydGljYWxTY3JvbGxiYXJTaXplOiAxNCxcblx0XHRcdFx0aG9yaXpvbnRhbDogJ2F1dG8nLFxuXHRcdFx0XHR1c2VTaGFkb3dzOiB0cnVlLFxuXHRcdFx0XHR2ZXJ0aWNhbEhhc0Fycm93czogZmFsc2UsXG5cdFx0XHRcdGhvcml6b250YWxIYXNBcnJvd3M6IGZhbHNlLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2Vcblx0XHRcdH0sXG5cdFx0XHRvdmVydmlld1J1bGVyTGFuZXM6IDIsXG5cdFx0XHRmaXhlZE92ZXJmbG93V2lkZ2V0czogdHJ1ZSxcblx0XHRcdG1pbmltYXA6IHtcblx0XHRcdFx0ZW5hYmxlZDogZmFsc2Vcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMuX2VkaXRvciA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0RW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LFxuXHRcdFx0ZWRpdG9yQ29udGFpbmVyLFxuXHRcdFx0ZWRpdG9yT3B0aW9ucyxcblx0XHRcdHt9LFxuXHRcdFx0dGhpcy5lZGl0b3Jcblx0XHQpO1xuXG5cdFx0Ly8gdHJlZSBzdHVmZlxuXHRcdGNvbnN0IHRyZWVDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0cmVlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3RyZWUnKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodHJlZUNvbnRhaW5lcik7XG5cdFx0Y29uc3Qgb3B0aW9uczogSVdvcmtiZW5jaEFzeW5jRGF0YVRyZWVPcHRpb25zPHR5cGVIVHJlZS5UeXBlLCBGdXp6eVNjb3JlPiA9IHtcblx0XHRcdHNvcnRlcjogbmV3IHR5cGVIVHJlZS5Tb3J0ZXIoKSxcblx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IHR5cGVIVHJlZS5BY2Nlc3NpYmlsaXR5UHJvdmlkZXIoKCkgPT4gdGhpcy5fZGlyZWN0aW9uKSxcblx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IG5ldyB0eXBlSFRyZWUuSWRlbnRpdHlQcm92aWRlcigoKSA9PiB0aGlzLl9kaXJlY3Rpb24pLFxuXHRcdFx0ZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrOiB0cnVlLFxuXHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHtcblx0XHRcdFx0bGlzdEJhY2tncm91bmQ6IHBlZWtWaWV3LnBlZWtWaWV3UmVzdWx0c0JhY2tncm91bmRcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMuX3RyZWUgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFR5cGVIaWVyYXJjaHlUcmVlLFxuXHRcdFx0J1R5cGVIaWVyYXJjaHlQZWVrJyxcblx0XHRcdHRyZWVDb250YWluZXIsXG5cdFx0XHRuZXcgdHlwZUhUcmVlLlZpcnR1YWxEZWxlZ2F0ZSgpLFxuXHRcdFx0W3RoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKHR5cGVIVHJlZS5UeXBlUmVuZGVyZXIpXSxcblx0XHRcdHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKHR5cGVIVHJlZS5EYXRhU291cmNlLCAoKSA9PiB0aGlzLl9kaXJlY3Rpb24pLFxuXHRcdFx0b3B0aW9uc1xuXHRcdCk7XG5cblx0XHQvLyBzcGxpdCBzdHVmZlxuXHRcdHRoaXMuX3NwbGl0Vmlldy5hZGRWaWV3KHtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0ZWxlbWVudDogZWRpdG9yQ29udGFpbmVyLFxuXHRcdFx0bWluaW11bVNpemU6IDIwMCxcblx0XHRcdG1heGltdW1TaXplOiBOdW1iZXIuTUFYX1ZBTFVFLFxuXHRcdFx0bGF5b3V0OiAod2lkdGgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2RpbS5oZWlnaHQpIHtcblx0XHRcdFx0XHR0aGlzLl9lZGl0b3IubGF5b3V0KHsgaGVpZ2h0OiB0aGlzLl9kaW0uaGVpZ2h0LCB3aWR0aCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sIFNpemluZy5EaXN0cmlidXRlKTtcblxuXHRcdHRoaXMuX3NwbGl0Vmlldy5hZGRWaWV3KHtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0ZWxlbWVudDogdHJlZUNvbnRhaW5lcixcblx0XHRcdG1pbmltdW1TaXplOiAxMDAsXG5cdFx0XHRtYXhpbXVtU2l6ZTogTnVtYmVyLk1BWF9WQUxVRSxcblx0XHRcdGxheW91dDogKHdpZHRoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLl9kaW0uaGVpZ2h0KSB7XG5cdFx0XHRcdFx0dGhpcy5fdHJlZS5sYXlvdXQodGhpcy5fZGltLmhlaWdodCwgd2lkdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgU2l6aW5nLkRpc3RyaWJ1dGUpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3NwbGl0Vmlldy5vbkRpZFNhc2hDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2RpbS53aWR0aCkge1xuXHRcdFx0XHR0aGlzLl9sYXlvdXRJbmZvLnJhdGlvID0gdGhpcy5fc3BsaXRWaWV3LmdldFZpZXdTaXplKDApIC8gdGhpcy5fZGltLndpZHRoO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIHVwZGF0ZSBlZGl0b3Jcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fdHJlZS5vbkRpZENoYW5nZUZvY3VzKHRoaXMuX3VwZGF0ZVByZXZpZXcsIHRoaXMpKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9lZGl0b3Iub25Nb3VzZURvd24oZSA9PiB7XG5cdFx0XHRjb25zdCB7IGV2ZW50LCB0YXJnZXQgfSA9IGU7XG5cdFx0XHRpZiAoZXZlbnQuZGV0YWlsICE9PSAyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IFtmb2N1c10gPSB0aGlzLl90cmVlLmdldEZvY3VzKCk7XG5cdFx0XHRpZiAoIWZvY3VzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0cmVzb3VyY2U6IGZvY3VzLml0ZW0udXJpLFxuXHRcdFx0XHRvcHRpb25zOiB7IHNlbGVjdGlvbjogdGFyZ2V0LnJhbmdlISB9XG5cdFx0XHR9KTtcblxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl90cmVlLm9uTW91c2VEYmxDbGljayhlID0+IHtcblx0XHRcdGlmIChlLnRhcmdldCA9PT0gVHJlZU1vdXNlRXZlbnRUYXJnZXQuVHdpc3RpZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLmVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0cmVzb3VyY2U6IGUuZWxlbWVudC5pdGVtLnVyaSxcblx0XHRcdFx0XHRvcHRpb25zOiB7IHNlbGVjdGlvbjogZS5lbGVtZW50Lml0ZW0uc2VsZWN0aW9uUmFuZ2UsIHBpbm5lZDogdHJ1ZSB9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl90cmVlLm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGUgPT4ge1xuXHRcdFx0Y29uc3QgW2VsZW1lbnRdID0gZS5lbGVtZW50cztcblx0XHRcdC8vIGRvbid0IGNsb3NlIG9uIGNsaWNrXG5cdFx0XHRpZiAoZWxlbWVudCAmJiBpc0tleWJvYXJkRXZlbnQoZS5icm93c2VyRXZlbnQpKSB7XG5cdFx0XHRcdHRoaXMuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdHJlc291cmNlOiBlbGVtZW50Lml0ZW0udXJpLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHsgc2VsZWN0aW9uOiBlbGVtZW50Lml0ZW0uc2VsZWN0aW9uUmFuZ2UsIHBpbm5lZDogdHJ1ZSB9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3VwZGF0ZVByZXZpZXcoKSB7XG5cdFx0Y29uc3QgW2VsZW1lbnRdID0gdGhpcy5fdHJlZS5nZXRGb2N1cygpO1xuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3ByZXZpZXdEaXNwb3NhYmxlLmNsZWFyKCk7XG5cblx0XHQvLyB1cGRhdGU6IGVkaXRvciBhbmQgZWRpdG9yIGhpZ2hsaWdodHNcblx0XHRjb25zdCBvcHRpb25zOiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyA9IHtcblx0XHRcdGRlc2NyaXB0aW9uOiAndHlwZS1oaWVyYXJjaHktZGVjb3JhdGlvbicsXG5cdFx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHRcdGNsYXNzTmFtZTogJ3R5cGUtZGVjb3JhdGlvbicsXG5cdFx0XHRvdmVydmlld1J1bGVyOiB7XG5cdFx0XHRcdGNvbG9yOiB0aGVtZUNvbG9yRnJvbUlkKHBlZWtWaWV3LnBlZWtWaWV3RWRpdG9yTWF0Y2hIaWdobGlnaHQpLFxuXHRcdFx0XHRwb3NpdGlvbjogT3ZlcnZpZXdSdWxlckxhbmUuQ2VudGVyXG5cdFx0XHR9LFxuXHRcdH07XG5cblx0XHRsZXQgcHJldmlld1VyaTogVVJJO1xuXHRcdGlmICh0aGlzLl9kaXJlY3Rpb24gPT09IFR5cGVIaWVyYXJjaHlEaXJlY3Rpb24uU3VwZXJ0eXBlcykge1xuXHRcdFx0Ly8gc3VwZXJ0eXBlczogc2hvdyBzdXBlciB0eXBlcyBhbmQgaGlnaGxpZ2h0IGZvY3VzZWQgdHlwZVxuXHRcdFx0cHJldmlld1VyaSA9IGVsZW1lbnQucGFyZW50ID8gZWxlbWVudC5wYXJlbnQuaXRlbS51cmkgOiBlbGVtZW50Lm1vZGVsLnJvb3QudXJpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBzdWJ0eXBlczogc2hvdyBzdWIgdHlwZXMgYW5kIGhpZ2hsaWdodCBmb2N1c2VkIHR5cGVcblx0XHRcdHByZXZpZXdVcmkgPSBlbGVtZW50Lml0ZW0udXJpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShwcmV2aWV3VXJpKTtcblx0XHR0aGlzLl9lZGl0b3Iuc2V0TW9kZWwodmFsdWUub2JqZWN0LnRleHRFZGl0b3JNb2RlbCk7XG5cblx0XHQvLyBzZXQgZGVjb3JhdGlvbnMgZm9yIHR5cGUgcmFuZ2VzXG5cdFx0Y29uc3QgZGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cdFx0bGV0IGZ1bGxSYW5nZTogSVJhbmdlIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGxvYyA9IHsgdXJpOiBlbGVtZW50Lml0ZW0udXJpLCByYW5nZTogZWxlbWVudC5pdGVtLnNlbGVjdGlvblJhbmdlIH07XG5cdFx0aWYgKGxvYy51cmkudG9TdHJpbmcoKSA9PT0gcHJldmlld1VyaS50b1N0cmluZygpKSB7XG5cdFx0XHRkZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2U6IGxvYy5yYW5nZSwgb3B0aW9ucyB9KTtcblx0XHRcdGZ1bGxSYW5nZSA9ICFmdWxsUmFuZ2UgPyBsb2MucmFuZ2UgOiBSYW5nZS5wbHVzUmFuZ2UobG9jLnJhbmdlLCBmdWxsUmFuZ2UpO1xuXHRcdH1cblx0XHRpZiAoZnVsbFJhbmdlKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3IucmV2ZWFsUmFuZ2VJbkNlbnRlcihmdWxsUmFuZ2UsIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25zQ29sbGVjdGlvbiA9IHRoaXMuX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oZGVjb3JhdGlvbnMpO1xuXHRcdFx0dGhpcy5fcHJldmlld0Rpc3Bvc2FibGUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBkZWNvcmF0aW9uc0NvbGxlY3Rpb24uY2xlYXIoKSkpO1xuXHRcdH1cblx0XHR0aGlzLl9wcmV2aWV3RGlzcG9zYWJsZS5hZGQodmFsdWUpO1xuXG5cdFx0Ly8gdXBkYXRlOiB0aXRsZVxuXHRcdGNvbnN0IHRpdGxlID0gdGhpcy5fZGlyZWN0aW9uID09PSBUeXBlSGllcmFyY2h5RGlyZWN0aW9uLlN1cGVydHlwZXNcblx0XHRcdD8gbG9jYWxpemUoJ3N1cGVydHlwZXMnLCBcIlN1cGVydHlwZXMgb2YgJ3swfSdcIiwgZWxlbWVudC5tb2RlbC5yb290Lm5hbWUpXG5cdFx0XHQ6IGxvY2FsaXplKCdzdWJ0eXBlcycsIFwiU3VidHlwZXMgb2YgJ3swfSdcIiwgZWxlbWVudC5tb2RlbC5yb290Lm5hbWUpO1xuXHRcdHRoaXMuc2V0VGl0bGUodGl0bGUpO1xuXHR9XG5cblx0c2hvd0xvYWRpbmcoKTogdm9pZCB7XG5cdFx0dGhpcy5fcGFyZW50LmRhdGFzZXRbJ3N0YXRlJ10gPSBTdGF0ZS5Mb2FkaW5nO1xuXHRcdHRoaXMuc2V0VGl0bGUobG9jYWxpemUoJ3RpdGxlLmxvYWRpbmcnLCBcIkxvYWRpbmcuLi5cIikpO1xuXHRcdHRoaXMuX3Nob3coKTtcblx0fVxuXG5cdHNob3dNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3BhcmVudC5kYXRhc2V0WydzdGF0ZSddID0gU3RhdGUuTWVzc2FnZTtcblx0XHR0aGlzLnNldFRpdGxlKCcnKTtcblx0XHR0aGlzLnNldE1ldGFUaXRsZSgnJyk7XG5cdFx0dGhpcy5fbWVzc2FnZS5pbm5lclRleHQgPSBtZXNzYWdlO1xuXHRcdHRoaXMuX3Nob3coKTtcblx0XHR0aGlzLl9tZXNzYWdlLmZvY3VzKCk7XG5cdH1cblxuXHRhc3luYyBzaG93TW9kZWwobW9kZWw6IFR5cGVIaWVyYXJjaHlNb2RlbCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0dGhpcy5fc2hvdygpO1xuXHRcdGNvbnN0IHZpZXdTdGF0ZSA9IHRoaXMuX3RyZWVWaWV3U3RhdGVzLmdldCh0aGlzLl9kaXJlY3Rpb24pO1xuXG5cdFx0YXdhaXQgdGhpcy5fdHJlZS5zZXRJbnB1dChtb2RlbCwgdmlld1N0YXRlKTtcblxuXHRcdGNvbnN0IHJvb3QgPSA8SVRyZWVOb2RlPHR5cGVIVHJlZS5UeXBlLCBGdXp6eVNjb3JlPj50aGlzLl90cmVlLmdldE5vZGUobW9kZWwpLmNoaWxkcmVuWzBdO1xuXHRcdGF3YWl0IHRoaXMuX3RyZWUuZXhwYW5kKHJvb3QuZWxlbWVudCk7XG5cblx0XHRpZiAocm9vdC5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMuc2hvd01lc3NhZ2UodGhpcy5fZGlyZWN0aW9uID09PSBUeXBlSGllcmFyY2h5RGlyZWN0aW9uLlN1cGVydHlwZXNcblx0XHRcdFx0PyBsb2NhbGl6ZSgnZW1wdC5zdXBlcnR5cGVzJywgXCJObyBzdXBlcnR5cGVzIG9mICd7MH0nXCIsIG1vZGVsLnJvb3QubmFtZSlcblx0XHRcdFx0OiBsb2NhbGl6ZSgnZW1wdC5zdWJ0eXBlcycsIFwiTm8gc3VidHlwZXMgb2YgJ3swfSdcIiwgbW9kZWwucm9vdC5uYW1lKSk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcGFyZW50LmRhdGFzZXRbJ3N0YXRlJ10gPSBTdGF0ZS5EYXRhO1xuXHRcdFx0aWYgKCF2aWV3U3RhdGUgfHwgdGhpcy5fdHJlZS5nZXRGb2N1cygpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLl90cmVlLnNldEZvY3VzKFtyb290LmNoaWxkcmVuWzBdLmVsZW1lbnRdKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3RyZWUuZG9tRm9jdXMoKTtcblx0XHRcdHRoaXMuX3VwZGF0ZVByZXZpZXcoKTtcblx0XHR9XG5cdH1cblxuXHRnZXRNb2RlbCgpOiBUeXBlSGllcmFyY2h5TW9kZWwgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl90cmVlLmdldElucHV0KCk7XG5cdH1cblxuXHRnZXRGb2N1c2VkKCk6IHR5cGVIVHJlZS5UeXBlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fdHJlZS5nZXRGb2N1cygpWzBdO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlRGlyZWN0aW9uKG5ld0RpcmVjdGlvbjogVHlwZUhpZXJhcmNoeURpcmVjdGlvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fdHJlZS5nZXRJbnB1dCgpO1xuXHRcdGlmIChtb2RlbCAmJiBuZXdEaXJlY3Rpb24gIT09IHRoaXMuX2RpcmVjdGlvbikge1xuXHRcdFx0dGhpcy5fdHJlZVZpZXdTdGF0ZXMuc2V0KHRoaXMuX2RpcmVjdGlvbiwgdGhpcy5fdHJlZS5nZXRWaWV3U3RhdGUoKSk7XG5cdFx0XHR0aGlzLl9kaXJlY3Rpb24gPSBuZXdEaXJlY3Rpb247XG5cdFx0XHRhd2FpdCB0aGlzLnNob3dNb2RlbChtb2RlbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2hvdygpIHtcblx0XHRpZiAoIXRoaXMuX2lzU2hvd2luZykge1xuXHRcdFx0dGhpcy5lZGl0b3IucmV2ZWFsTGluZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQodGhpcy5fd2hlcmUubGluZU51bWJlciwgU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHRcdFx0c3VwZXIuc2hvdyhSYW5nZS5mcm9tUG9zaXRpb25zKHRoaXMuX3doZXJlKSwgdGhpcy5fbGF5b3V0SW5mby5oZWlnaHQpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfb25XaWR0aCh3aWR0aDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMuX2RpbSkge1xuXHRcdFx0dGhpcy5fZG9MYXlvdXRCb2R5KHRoaXMuX2RpbS5oZWlnaHQsIHdpZHRoKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX2RvTGF5b3V0Qm9keShoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kaW0uaGVpZ2h0ICE9PSBoZWlnaHQgfHwgdGhpcy5fZGltLndpZHRoICE9PSB3aWR0aCkge1xuXHRcdFx0c3VwZXIuX2RvTGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHRcdHRoaXMuX2RpbSA9IG5ldyBEaW1lbnNpb24od2lkdGgsIGhlaWdodCk7XG5cdFx0XHR0aGlzLl9sYXlvdXRJbmZvLmhlaWdodCA9IHRoaXMuX3ZpZXdab25lID8gdGhpcy5fdmlld1pvbmUuaGVpZ2h0SW5MaW5lcyA6IHRoaXMuX2xheW91dEluZm8uaGVpZ2h0O1xuXHRcdFx0dGhpcy5fc3BsaXRWaWV3LmxheW91dCh3aWR0aCk7XG5cdFx0XHR0aGlzLl9zcGxpdFZpZXcucmVzaXplVmlldygwLCB3aWR0aCAqIHRoaXMuX2xheW91dEluZm8ucmF0aW8pO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxXQUFXLHVCQUF1QjtBQUMzQyxTQUFTLGFBQWEsUUFBUSxpQkFBaUI7QUFFL0MsU0FBb0IsNEJBQTRCO0FBQ2hELFNBQVMsYUFBYTtBQUN0QixTQUFTLGFBQWE7QUFFdEIsU0FBUyxpQkFBaUIsb0JBQW9CO0FBRzlDLFNBQVMsZ0NBQWdDO0FBR3pDLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBa0Msd0JBQStDLHlCQUF5QjtBQUMxRyxTQUFTLHlCQUF5QjtBQUNsQyxZQUFZLGNBQWM7QUFDMUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxjQUFjLGNBQWM7QUFDckMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBeUMsOEJBQThCO0FBQ3ZFLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQXNCLGVBQWUsd0JBQXdCO0FBQzdELFlBQVksZUFBZTtBQUMzQixTQUFTLDhCQUFrRDtBQUMzRCxTQUFTLHNCQUFzQjtBQUcvQixJQUFXLFFBQVgsa0JBQVdBLFdBQVg7QUFDQyxFQUFBQSxPQUFBLGFBQVU7QUFDVixFQUFBQSxPQUFBLGFBQVU7QUFDVixFQUFBQSxPQUFBLFVBQU87QUFIRyxTQUFBQTtBQUFBLEdBQUE7QUFNWCxNQUFNLFdBQVc7QUFBQSxFQWdCaEIsWUFDUSxPQUNB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
