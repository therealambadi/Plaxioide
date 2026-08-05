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
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { Part } from "../../part.js";
import { Dimension, $, EventHelper, addDisposableGenericMouseDownListener, getWindow, isAncestorOfActiveElement, getActiveElement, isHTMLElement } from "../../../../base/browser/dom.js";
import { Event, Emitter, Relay, PauseableEmitter } from "../../../../base/common/event.js";
import { contrastBorder, editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { GroupDirection, GroupsArrangement, GroupOrientation, MergeGroupMode, GroupsOrder, GroupLocation } from "../../../services/editor/common/editorGroupsService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { orthogonal, LayoutPriority, Direction, SerializableGrid, Sizing, Orientation, isGridBranchNode, createSerializedGrid } from "../../../../base/browser/ui/grid/grid.js";
import { GroupModelChangeKind } from "../../../common/editor.js";
import { EDITOR_GROUP_BORDER, EDITOR_PANE_BACKGROUND } from "../../../common/theme.js";
import { distinct, coalesce } from "../../../../base/common/arrays.js";
import { getEditorPartOptions, impactsEditorPartOptions } from "./editor.js";
import { EditorGroupView } from "./editorGroupView.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { dispose, toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { isSerializedEditorGroupModel } from "../../../common/editor/editorGroupModel.js";
import { EditorDropTarget } from "./editorDropTarget.js";
import { Color } from "../../../../base/common/color.js";
import { CenteredViewLayout } from "../../../../base/browser/ui/centered/centeredViewLayout.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Parts, IWorkbenchLayoutService, Position } from "../../../services/layout/browser/layoutService.js";
import { assertIsDefined, assertType } from "../../../../base/common/types.js";
import { CompositeDragAndDropObserver } from "../../dnd.js";
import { DeferredPromise, Promises } from "../../../../base/common/async.js";
import { findGroup } from "../../../services/editor/common/editorGroupFinder.js";
import { SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { EditorPartMaximizedEditorGroupContext, EditorPartMultipleEditorGroupsContext, IsAuxiliaryEditorPartContext } from "../../../common/contextkeys.js";
import { mainWindow } from "../../../../base/browser/window.js";
class GridWidgetView {
  constructor() {
    this.element = $(".grid-view-container");
    this._onDidChange = new Relay();
    this.onDidChange = this._onDidChange.event;
  }
  get minimumWidth() {
    return this.gridWidget ? this.gridWidget.minimumWidth : 0;
  }
  get maximumWidth() {
    return this.gridWidget ? this.gridWidget.maximumWidth : Number.POSITIVE_INFINITY;
  }
  get minimumHeight() {
    return this.gridWidget ? this.gridWidget.minimumHeight : 0;
  }
  get maximumHeight() {
    return this.gridWidget ? this.gridWidget.maximumHeight : Number.POSITIVE_INFINITY;
  }
  get gridWidget() {
    return this._gridWidget;
  }
  set gridWidget(grid) {
    this.element.innerText = "";
    if (grid) {
      this.element.appendChild(grid.element);
      this._onDidChange.input = grid.onDidChange;
    } else {
      this._onDidChange.input = Event.None;
    }
    this._gridWidget = grid;
  }
  layout(width, height, top, left) {
    this.gridWidget?.layout(width, height, top, left);
  }
  dispose() {
    this._onDidChange.dispose();
  }
}
let EditorPart = class extends Part {
  constructor(editorPartsView, id, groupsLabel, windowId, instantiationService, themeService, configurationService, storageService, layoutService, hostService, contextKeyService) {
    super(id, { hasTitle: false }, themeService, storageService, layoutService);
    this.editorPartsView = editorPartsView;
    this.groupsLabel = groupsLabel;
    this.windowId = windowId;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.hostService = hostService;
    this.contextKeyService = contextKeyService;
    //#region Events
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidLayout = this._register(new Emitter());
    this.onDidLayout = this._onDidLayout.event;
    this._onDidChangeActiveGroup = this._register(new Emitter());
    this.onDidChangeActiveGroup = this._onDidChangeActiveGroup.event;
    this._onDidChangeGroupIndex = this._register(new Emitter());
    this.onDidChangeGroupIndex = this._onDidChangeGroupIndex.event;
    this._onDidChangeGroupLabel = this._register(new Emitter());
    this.onDidChangeGroupLabel = this._onDidChangeGroupLabel.event;
    this._onDidChangeGroupLocked = this._register(new Emitter());
    this.onDidChangeGroupLocked = this._onDidChangeGroupLocked.event;
    this._onDidChangeGroupMaximized = this._register(new Emitter());
    this.onDidChangeGroupMaximized = this._onDidChangeGroupMaximized.event;
    this._onDidActivateGroup = this._register(new Emitter());
    this.onDidActivateGroup = this._onDidActivateGroup.event;
    this._onDidAddGroup = this._register(new PauseableEmitter());
    this.onDidAddGroup = this._onDidAddGroup.event;
    this._onDidRemoveGroup = this._register(new PauseableEmitter());
    this.onDidRemoveGroup = this._onDidRemoveGroup.event;
    this._onDidMoveGroup = this._register(new Emitter());
    this.onDidMoveGroup = this._onDidMoveGroup.event;
    this.onDidSetGridWidget = this._register(new Emitter());
    this._onDidChangeSizeConstraints = this._register(new Relay());
    this.onDidChangeSizeConstraints = Event.any(this.onDidSetGridWidget.event, this._onDidChangeSizeConstraints.event);
    this._onDidScroll = this._register(new Relay());
    this.onDidScroll = Event.any(this.onDidSetGridWidget.event, this._onDidScroll.event);
    this._onDidChangeEditorPartOptions = this._register(new Emitter());
    this.onDidChangeEditorPartOptions = this._onDidChangeEditorPartOptions.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    //#endregion
    this.workspaceMemento = this.getMemento(StorageScope.WORKSPACE, StorageTarget.USER);
    this.profileMemento = this.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    this.groupViews = /* @__PURE__ */ new Map();
    this.mostRecentActiveGroups = [];
    this.gridWidgetDisposables = this._register(new DisposableStore());
    this.gridWidgetView = this._register(new GridWidgetView());
    this.enforcedPartOptions = [];
    this.top = 0;
    this.left = 0;
    this.sideGroup = {
      openEditor: (editor, options) => {
        const [group] = this.scopedInstantiationService.invokeFunction((accessor) => findGroup(accessor, { editor, options }, SIDE_GROUP));
        return group.openEditor(editor, options);
      }
    };
    this._isReady = false;
    this.whenReadyPromise = new DeferredPromise();
    this.whenReady = this.whenReadyPromise.p;
    this.whenRestoredPromise = new DeferredPromise();
    this.whenRestored = this.whenRestoredPromise.p;
    this._willRestoreState = false;
    this.priority = LayoutPriority.High;
    this._partOptions = getEditorPartOptions(this.configurationService, this.themeService);
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
    this._register(this.themeService.onDidFileIconThemeChange(() => this.handleChangedPartOptions()));
    this._register(this.onDidChangeMementoValue(StorageScope.WORKSPACE, this._store)((e) => this.onDidChangeMementoState(e)));
  }
  onConfigurationUpdated(event) {
    if (impactsEditorPartOptions(event)) {
      this.handleChangedPartOptions();
    }
  }
  handleChangedPartOptions() {
    const oldPartOptions = this._partOptions;
    const newPartOptions = getEditorPartOptions(this.configurationService, this.themeService);
    for (const enforcedPartOptions of this.enforcedPartOptions) {
      Object.assign(newPartOptions, enforcedPartOptions);
    }
    this._partOptions = newPartOptions;
    this._onDidChangeEditorPartOptions.fire({ oldPartOptions, newPartOptions });
  }
  get partOptions() {
    return this._partOptions;
  }
  enforcePartOptions(options) {
    this.enforcedPartOptions.push(options);
    this.handleChangedPartOptions();
    return toDisposable(() => {
      this.enforcedPartOptions.splice(this.enforcedPartOptions.indexOf(options), 1);
      this.handleChangedPartOptions();
    });
  }
  get contentDimension() {
    return this._contentDimension;
  }
  get activeGroup() {
    return this._activeGroup;
  }
  get groups() {
    return Array.from(this.groupViews.values());
  }
  get count() {
    return this.groupViews.size;
  }
  get orientation() {
    return this.gridWidget && this.gridWidget.orientation === Orientation.VERTICAL ? GroupOrientation.VERTICAL : GroupOrientation.HORIZONTAL;
  }
  get isReady() {
    return this._isReady;
  }
  get hasRestorableState() {
    return !!this.workspaceMemento[EditorPart.EDITOR_PART_UI_STATE_STORAGE_KEY];
  }
  get willRestoreState() {
    return this._willRestoreState;
  }
  getGroups(order = GroupsOrder.CREATION_TIME) {
    switch (order) {
      case GroupsOrder.CREATION_TIME:
        return this.groups;
      case GroupsOrder.MOST_RECENTLY_ACTIVE: {
        const mostRecentActive = coalesce(this.mostRecentActiveGroups.map((groupId) => this.getGroup(groupId)));
        return distinct([...mostRecentActive, ...this.groups]);
      }
      case GroupsOrder.GRID_APPEARANCE: {
        const views = [];
        if (this.gridWidget) {
          this.fillGridNodes(views, this.gridWidget.getViews());
        }
        return views;
      }
    }
  }
  fillGridNodes(target, node) {
    if (isGridBranchNode(node)) {
      node.children.forEach((child) => this.fillGridNodes(target, child));
    } else {
      target.push(node.view);
    }
  }
  hasGroup(identifier) {
    return this.groupViews.has(identifier);
  }
  getGroup(identifier) {
    return this.groupViews.get(identifier);
  }
  findGroup(scope, source = this.activeGroup, wrap) {
    if (typeof scope.direction === "number") {
      return this.doFindGroupByDirection(scope.direction, source, wrap);
    }
    if (typeof scope.location === "number") {
      return this.doFindGroupByLocation(scope.location, source, wrap);
    }
    throw new Error("invalid arguments");
  }
  doFindGroupByDirection(direction, source, wrap) {
    const sourceGroupView = this.assertGroupView(source);
    const neighbours = this.gridWidget.getNeighborViews(sourceGroupView, this.toGridViewDirection(direction), wrap);
    neighbours.sort((n1, n2) => this.mostRecentActiveGroups.indexOf(n1.id) - this.mostRecentActiveGroups.indexOf(n2.id));
    return neighbours[0];
  }
  doFindGroupByLocation(location, source, wrap) {
    const sourceGroupView = this.assertGroupView(source);
    const groups = this.getGroups(GroupsOrder.GRID_APPEARANCE);
    const index = groups.indexOf(sourceGroupView);
    switch (location) {
      case GroupLocation.FIRST:
        return groups[0];
      case GroupLocation.LAST:
        return groups[groups.length - 1];
      case GroupLocation.NEXT: {
        let nextGroup = groups[index + 1];
        if (!nextGroup && wrap) {
          nextGroup = this.doFindGroupByLocation(GroupLocation.FIRST, source);
        }
        return nextGroup;
      }
      case GroupLocation.PREVIOUS: {
        let previousGroup = groups[index - 1];
        if (!previousGroup && wrap) {
          previousGroup = this.doFindGroupByLocation(GroupLocation.LAST, source);
        }
        return previousGroup;
      }
    }
  }
  activateGroup(group, preserveWindowOrder) {
    const groupView = this.assertGroupView(group);
    this.doSetGroupActive(groupView);
    if (!preserveWindowOrder) {
      this.hostService.moveTop(getWindow(this.element));
    }
    return groupView;
  }
  restoreGroup(group) {
    const groupView = this.assertGroupView(group);
    this.doRestoreGroup(groupView);
    return groupView;
  }
  getSize(group) {
    const groupView = this.assertGroupView(group);
    return this.gridWidget.getViewSize(groupView);
  }
  setSize(group, size) {
    const groupView = this.assertGroupView(group);
    this.gridWidget.resizeView(groupView, size);
  }
  arrangeGroups(arrangement, target = this.activeGroup) {
    if (this.count < 2) {
      return;
    }
    if (!this.gridWidget) {
      return;
    }
    const groupView = this.assertGroupView(target);
    switch (arrangement) {
      case GroupsArrangement.EVEN:
        this.gridWidget.distributeViewSizes();
        break;
      case GroupsArrangement.MAXIMIZE:
        if (this.groups.length < 2) {
          return;
        }
        this.gridWidget.maximizeView(groupView);
        groupView.focus();
        break;
      case GroupsArrangement.EXPAND:
        this.gridWidget.expandView(groupView);
        break;
    }
  }
  toggleMaximizeGroup(target = this.activeGroup) {
    if (this.hasMaximizedGroup()) {
      this.unmaximizeGroup();
    } else {
      this.arrangeGroups(GroupsArrangement.MAXIMIZE, target);
    }
  }
  toggleExpandGroup(target = this.activeGroup) {
    if (this.isGroupExpanded(this.activeGroup)) {
      this.arrangeGroups(GroupsArrangement.EVEN);
    } else {
      this.arrangeGroups(GroupsArrangement.EXPAND, target);
    }
  }
  unmaximizeGroup() {
    this.gridWidget.exitMaximizedView();
    this._activeGroup.focus();
  }
  hasMaximizedGroup() {
    return this.gridWidget.hasMaximizedView();
  }
  isGroupMaximized(targetGroup) {
    return this.gridWidget.isViewMaximized(targetGroup);
  }
  isGroupExpanded(targetGroup) {
    return this.gridWidget.isViewExpanded(targetGroup);
  }
  setGroupOrientation(orientation) {
    if (!this.gridWidget) {
      return;
    }
    const newOrientation = orientation === GroupOrientation.HORIZONTAL ? Orientation.HORIZONTAL : Orientation.VERTICAL;
    if (this.gridWidget.orientation !== newOrientation) {
      this.gridWidget.orientation = newOrientation;
    }
  }
  applyLayout(layout) {
    const restoreFocus = this.shouldRestoreFocus(this.container);
    let layoutGroupsCount = 0;
    function countGroups(groups) {
      for (const group of groups) {
        if (Array.isArray(group.groups)) {
          countGroups(group.groups);
        } else {
          layoutGroupsCount++;
        }
      }
    }
    countGroups(layout.groups);
    let currentGroupViews = this.getGroups(GroupsOrder.GRID_APPEARANCE);
    if (layoutGroupsCount < currentGroupViews.length) {
      const lastGroupInLayout = currentGroupViews[layoutGroupsCount - 1];
      currentGroupViews.forEach((group, index) => {
        if (index >= layoutGroupsCount) {
          this.mergeGroup(group, lastGroupInLayout);
        }
      });
      currentGroupViews = this.getGroups(GroupsOrder.GRID_APPEARANCE);
    }
    const activeGroup = this.activeGroup;
    const gridDescriptor = createSerializedGrid({
      orientation: this.toGridViewOrientation(
        layout.orientation,
        this.isTwoDimensionalGrid() ? this.gridWidget.orientation : (
          // preserve original orientation for 2-dimensional grids
          orthogonal(this.gridWidget.orientation)
        )
        // otherwise flip (fix https://github.com/microsoft/vscode/issues/52975)
      ),
      groups: layout.groups
    });
    this.doApplyGridState(gridDescriptor, activeGroup.id, currentGroupViews);
    if (restoreFocus) {
      this._activeGroup.focus();
    }
  }
  getLayout() {
    const serializedGrid = this.gridWidget.serialize();
    const orientation = serializedGrid.orientation === Orientation.HORIZONTAL ? GroupOrientation.HORIZONTAL : GroupOrientation.VERTICAL;
    const root = this.serializedNodeToGroupLayoutArgument(serializedGrid.root);
    return {
      orientation,
      groups: root.groups
    };
  }
  serializedNodeToGroupLayoutArgument(serializedNode) {
    if (serializedNode.type === "branch") {
      return {
        size: serializedNode.size,
        groups: serializedNode.data.map((node) => this.serializedNodeToGroupLayoutArgument(node))
      };
    }
    return { size: serializedNode.size };
  }
  shouldRestoreFocus(target) {
    if (!target) {
      return false;
    }
    const activeElement = getActiveElement();
    if (activeElement === target.ownerDocument.body) {
      return true;
    }
    return isAncestorOfActiveElement(target);
  }
  isTwoDimensionalGrid() {
    const views = this.gridWidget.getViews();
    if (isGridBranchNode(views)) {
      return views.children.some((child) => isGridBranchNode(child));
    }
    return false;
  }
  addGroup(location, direction, groupToCopy) {
    const locationView = this.assertGroupView(location);
    let newGroupView;
    if (locationView.groupsView === this) {
      const restoreFocus = this.shouldRestoreFocus(locationView.element);
      const shouldExpand = this.groupViews.size > 1 && this.isGroupExpanded(locationView);
      newGroupView = this.doCreateGroupView(groupToCopy);
      this.gridWidget.addView(
        newGroupView,
        this.getSplitSizingStyle(),
        locationView,
        this.toGridViewDirection(direction)
      );
      this.updateContainer();
      this._onDidAddGroup.fire(newGroupView);
      this.notifyGroupIndexChange();
      if (shouldExpand) {
        this.arrangeGroups(GroupsArrangement.EXPAND, newGroupView);
      }
      if (restoreFocus) {
        locationView.focus();
      }
    } else {
      newGroupView = locationView.groupsView.addGroup(locationView, direction, groupToCopy);
    }
    return newGroupView;
  }
  getSplitSizingStyle() {
    switch (this._partOptions.splitSizing) {
      case "distribute":
        return Sizing.Distribute;
      case "split":
        return Sizing.Split;
      default:
        return Sizing.Auto;
    }
  }
  doCreateGroupView(from, options) {
    let groupView;
    if (from instanceof EditorGroupView) {
      groupView = EditorGroupView.createCopy(from, this.editorPartsView, this, this.groupsLabel, this.count, this.scopedInstantiationService, options);
    } else if (isSerializedEditorGroupModel(from)) {
      groupView = EditorGroupView.createFromSerialized(from, this.editorPartsView, this, this.groupsLabel, this.count, this.scopedInstantiationService, options);
    } else {
      groupView = EditorGroupView.createNew(this.editorPartsView, this, this.groupsLabel, this.count, this.scopedInstantiationService, options);
    }
    this.groupViews.set(groupView.id, groupView);
    const groupDisposables = new DisposableStore();
    groupDisposables.add(groupView.onDidFocus(() => {
      this.doSetGroupActive(groupView);
      this._onDidFocus.fire();
    }));
    groupDisposables.add(groupView.onDidModelChange((e) => {
      switch (e.kind) {
        case GroupModelChangeKind.GROUP_LOCKED:
          this._onDidChangeGroupLocked.fire(groupView);
          break;
        case GroupModelChangeKind.GROUP_INDEX:
          this._onDidChangeGroupIndex.fire(groupView);
          break;
        case GroupModelChangeKind.GROUP_LABEL:
          this._onDidChangeGroupLabel.fire(groupView);
          break;
      }
    }));
    groupDisposables.add(groupView.onDidActiveEditorChange(() => {
      this.updateContainer();
    }));
    Event.once(groupView.onWillDispose)(() => {
      dispose(groupDisposables);
      this.groupViews.delete(groupView.id);
      this.doUpdateMostRecentActive(groupView);
    });
    return groupView;
  }
  doSetGroupActive(group) {
    if (this._activeGroup !== group) {
      const previousActiveGroup = this._activeGroup;
      this._activeGroup = group;
      this.doUpdateMostRecentActive(group, true);
      if (previousActiveGroup && !previousActiveGroup.disposed) {
        previousActiveGroup.setActive(false);
      }
      group.setActive(true);
      this.doRestoreGroup(group);
      this._onDidChangeActiveGroup.fire(group);
    }
    this._onDidActivateGroup.fire(group);
  }
  doRestoreGroup(group) {
    if (!this.gridWidget) {
      return;
    }
    try {
      if (this.hasMaximizedGroup() && !this.isGroupMaximized(group)) {
        this.unmaximizeGroup();
      }
      const viewSize = this.gridWidget.getViewSize(group);
      if (viewSize.width === group.minimumWidth || viewSize.height === group.minimumHeight) {
        this.arrangeGroups(GroupsArrangement.EXPAND, group);
      }
    } catch (error) {
    }
  }
  doUpdateMostRecentActive(group, makeMostRecentlyActive) {
    const index = this.mostRecentActiveGroups.indexOf(group.id);
    if (index !== -1) {
      this.mostRecentActiveGroups.splice(index, 1);
    }
    if (makeMostRecentlyActive) {
      this.mostRecentActiveGroups.unshift(group.id);
    }
  }
  toGridViewDirection(direction) {
    switch (direction) {
      case GroupDirection.UP:
        return Direction.Up;
      case GroupDirection.DOWN:
        return Direction.Down;
      case GroupDirection.LEFT:
        return Direction.Left;
      case GroupDirection.RIGHT:
        return Direction.Right;
    }
  }
  toGridViewOrientation(orientation, fallback) {
    if (typeof orientation === "number") {
      return orientation === GroupOrientation.HORIZONTAL ? Orientation.HORIZONTAL : Orientation.VERTICAL;
    }
    return fallback;
  }
  removeGroup(group, preserveFocus) {
    const groupView = this.assertGroupView(group);
    if (this.count === 1) {
      return;
    }
    if (groupView.isEmpty) {
      this.doRemoveEmptyGroup(groupView, preserveFocus);
    } else {
      this.doRemoveGroupWithEditors(groupView);
    }
  }
  doRemoveGroupWithEditors(groupView) {
    const mostRecentlyActiveGroups = this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
    let lastActiveGroup;
    if (this._activeGroup === groupView) {
      lastActiveGroup = mostRecentlyActiveGroups[1];
    } else {
      lastActiveGroup = mostRecentlyActiveGroups[0];
    }
    this.mergeGroup(groupView, lastActiveGroup);
  }
  doRemoveEmptyGroup(groupView, preserveFocus) {
    const restoreFocus = !preserveFocus && this.shouldRestoreFocus(this.container);
    if (this._activeGroup === groupView) {
      const mostRecentlyActiveGroups = this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
      const nextActiveGroup = mostRecentlyActiveGroups[1];
      this.doSetGroupActive(nextActiveGroup);
    }
    this.gridWidget.removeView(groupView, this.getSplitSizingStyle());
    groupView.dispose();
    if (restoreFocus) {
      this._activeGroup.focus();
    }
    this.notifyGroupIndexChange();
    this.updateContainer();
    this._onDidRemoveGroup.fire(groupView);
  }
  moveGroup(group, location, direction) {
    const sourceView = this.assertGroupView(group);
    const targetView = this.assertGroupView(location);
    if (sourceView.id === targetView.id) {
      throw new Error("Cannot move group into its own");
    }
    const restoreFocus = this.shouldRestoreFocus(sourceView.element);
    let movedView;
    if (sourceView.groupsView === targetView.groupsView) {
      this.gridWidget.moveView(sourceView, this.getSplitSizingStyle(), targetView, this.toGridViewDirection(direction));
      movedView = sourceView;
    } else {
      movedView = targetView.groupsView.addGroup(targetView, direction, sourceView);
      sourceView.closeAllEditors();
      this.removeGroup(sourceView, restoreFocus);
    }
    if (restoreFocus) {
      movedView.focus();
    }
    this._onDidMoveGroup.fire(movedView);
    this.notifyGroupIndexChange();
    return movedView;
  }
  copyGroup(group, location, direction) {
    const groupView = this.assertGroupView(group);
    const locationView = this.assertGroupView(location);
    const restoreFocus = this.shouldRestoreFocus(groupView.element);
    const copiedGroupView = this.addGroup(locationView, direction, groupView);
    if (restoreFocus) {
      copiedGroupView.focus();
    }
    return copiedGroupView;
  }
  mergeGroup(group, target, options) {
    const sourceView = this.assertGroupView(group);
    const targetView = this.assertGroupView(target);
    const editors = [];
    let index = options && typeof options.index === "number" ? options.index : targetView.count;
    for (const editor of sourceView.editors) {
      const inactive = !sourceView.isActive(editor) || this._activeGroup !== sourceView;
      let actualIndex;
      if (targetView.contains(editor) && // Do not configure an `index` for editors that are sticky in
      // the target, otherwise there is a chance of losing that state
      // when the editor is moved.
      // See https://github.com/microsoft/vscode/issues/239549
      (targetView.isSticky(editor) || // Do not configure an `index` when we are explicitly instructed
      options?.preserveExistingIndex)) {
      } else {
        actualIndex = index;
        index++;
      }
      editors.push({
        editor,
        options: {
          index: actualIndex,
          inactive,
          preserveFocus: inactive
        }
      });
    }
    let result = true;
    if (options?.mode === MergeGroupMode.COPY_EDITORS) {
      sourceView.copyEditors(editors, targetView);
    } else {
      result = sourceView.moveEditors(editors, targetView);
    }
    if (sourceView.isEmpty && !sourceView.disposed) {
      this.removeGroup(sourceView, true);
    }
    return result;
  }
  mergeAllGroups(target, options) {
    const targetView = this.assertGroupView(target);
    let result = true;
    for (const group of this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
      if (group === targetView) {
        continue;
      }
      const merged = this.mergeGroup(group, targetView, options);
      if (!merged) {
        result = false;
      }
    }
    return result;
  }
  assertGroupView(group) {
    let groupView;
    if (typeof group === "number") {
      groupView = this.editorPartsView.getGroup(group);
    } else {
      groupView = group;
    }
    if (!groupView) {
      throw new Error("Invalid editor group provided!");
    }
    return groupView;
  }
  createEditorDropTarget(container, delegate) {
    assertType(isHTMLElement(container));
    return this.scopedInstantiationService.createInstance(EditorDropTarget, container, delegate);
  }
  //#region Part
  // TODO @sbatten @joao find something better to prevent editor taking over #79897
  get minimumWidth() {
    return Math.min(this.centeredLayoutWidget.minimumWidth, this.layoutService.getMaximumEditorDimensions(this.layoutService.getContainer(getWindow(this.container))).width);
  }
  get maximumWidth() {
    return this.centeredLayoutWidget.maximumWidth;
  }
  get minimumHeight() {
    return Math.min(this.centeredLayoutWidget.minimumHeight, this.layoutService.getMaximumEditorDimensions(this.layoutService.getContainer(getWindow(this.container))).height);
  }
  get maximumHeight() {
    return this.centeredLayoutWidget.maximumHeight;
  }
  get snap() {
    return this.layoutService.getPanelAlignment() === "center";
  }
  get onDidChange() {
    return Event.any(this.centeredLayoutWidget.onDidChange, this.onDidSetGridWidget.event);
  }
  get gridSeparatorBorder() {
    return this.theme.getColor(EDITOR_GROUP_BORDER) || this.theme.getColor(contrastBorder) || Color.transparent;
  }
  updateStyles() {
    const container = assertIsDefined(this.container);
    container.style.backgroundColor = this.getColor(editorBackground) || "";
    const separatorBorderStyle = { separatorBorder: this.gridSeparatorBorder, background: this.theme.getColor(EDITOR_PANE_BACKGROUND) || Color.transparent };
    this.gridWidget.style(separatorBorderStyle);
    this.centeredLayoutWidget.styles(separatorBorderStyle);
  }
  createContentArea(parent, options) {
    this.element = parent;
    this.container = $(".content");
    if (this.windowId !== mainWindow.vscodeWindowId) {
      this.container.classList.add("auxiliary");
    }
    parent.appendChild(this.container);
    const scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.container));
    this.scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, scopedContextKeyService]
    )));
    this._willRestoreState = !options || options.restorePreviousState;
    this.doCreateGridControl();
    this.centeredLayoutWidget = this._register(new CenteredViewLayout(this.container, this.gridWidgetView, this.profileMemento[EditorPart.EDITOR_PART_CENTERED_VIEW_STORAGE_KEY], this._partOptions.centeredLayoutFixedWidth));
    this._register(this.onDidChangeEditorPartOptions((e) => this.centeredLayoutWidget.setFixedWidth(e.newPartOptions.centeredLayoutFixedWidth ?? false)));
    this.setupDragAndDropSupport(parent, this.container);
    this.handleContextKeys(scopedContextKeyService);
    this.whenReadyPromise.complete();
    this._isReady = true;
    Promises.settled(this.groups.map((group) => group.whenRestored)).finally(() => {
      this.whenRestoredPromise.complete();
    });
    return this.container;
  }
  handleContextKeys(contextKeyService) {
    const isAuxiliaryEditorPartContext = IsAuxiliaryEditorPartContext.bindTo(contextKeyService);
    isAuxiliaryEditorPartContext.set(this.windowId !== mainWindow.vscodeWindowId);
    const multipleEditorGroupsContext = EditorPartMultipleEditorGroupsContext.bindTo(contextKeyService);
    const maximizedEditorGroupContext = EditorPartMaximizedEditorGroupContext.bindTo(contextKeyService);
    const updateContextKeys = () => {
      const groupCount = this.count;
      if (groupCount > 1) {
        multipleEditorGroupsContext.set(true);
      } else {
        multipleEditorGroupsContext.reset();
      }
      if (this.hasMaximizedGroup()) {
        maximizedEditorGroupContext.set(true);
      } else {
        maximizedEditorGroupContext.reset();
      }
    };
    updateContextKeys();
    this._register(this.onDidAddGroup(() => updateContextKeys()));
    this._register(this.onDidRemoveGroup(() => updateContextKeys()));
    this._register(this.onDidChangeGroupMaximized(() => updateContextKeys()));
  }
  setupDragAndDropSupport(parent, container) {
    this._register(this.createEditorDropTarget(container, /* @__PURE__ */ Object.create(null)));
    const overlay = $(".drop-block-overlay");
    parent.appendChild(overlay);
    this._register(addDisposableGenericMouseDownListener(overlay, () => overlay.classList.remove("visible")));
    this._register(CompositeDragAndDropObserver.INSTANCE.registerTarget(this.element, {
      onDragStart: (e) => overlay.classList.add("visible"),
      onDragEnd: (e) => overlay.classList.remove("visible")
    }));
    let horizontalOpenerTimeout;
    let verticalOpenerTimeout;
    let lastOpenHorizontalPosition;
    let lastOpenVerticalPosition;
    const openPartAtPosition = (position) => {
      if (!this.layoutService.isVisible(Parts.PANEL_PART) && position === this.layoutService.getPanelPosition()) {
        this.layoutService.setPartHidden(false, Parts.PANEL_PART);
      } else if (!this.layoutService.isVisible(Parts.AUXILIARYBAR_PART) && position === (this.layoutService.getSideBarPosition() === Position.RIGHT ? Position.LEFT : Position.RIGHT)) {
        this.layoutService.setPartHidden(false, Parts.AUXILIARYBAR_PART);
      }
    };
    const clearAllTimeouts = () => {
      if (horizontalOpenerTimeout) {
        clearTimeout(horizontalOpenerTimeout);
        horizontalOpenerTimeout = void 0;
      }
      if (verticalOpenerTimeout) {
        clearTimeout(verticalOpenerTimeout);
        verticalOpenerTimeout = void 0;
      }
    };
    this._register(CompositeDragAndDropObserver.INSTANCE.registerTarget(overlay, {
      onDragOver: (e) => {
        EventHelper.stop(e.eventData, true);
        if (e.eventData.dataTransfer) {
          e.eventData.dataTransfer.dropEffect = "none";
        }
        const boundingRect = overlay.getBoundingClientRect();
        let openHorizontalPosition = void 0;
        let openVerticalPosition = void 0;
        const proximity = 100;
        if (e.eventData.clientX < boundingRect.left + proximity) {
          openHorizontalPosition = Position.LEFT;
        }
        if (e.eventData.clientX > boundingRect.right - proximity) {
          openHorizontalPosition = Position.RIGHT;
        }
        if (e.eventData.clientY > boundingRect.bottom - proximity) {
          openVerticalPosition = Position.BOTTOM;
        }
        if (e.eventData.clientY < boundingRect.top + proximity) {
          openVerticalPosition = Position.TOP;
        }
        if (horizontalOpenerTimeout && openHorizontalPosition !== lastOpenHorizontalPosition) {
          clearTimeout(horizontalOpenerTimeout);
          horizontalOpenerTimeout = void 0;
        }
        if (verticalOpenerTimeout && openVerticalPosition !== lastOpenVerticalPosition) {
          clearTimeout(verticalOpenerTimeout);
          verticalOpenerTimeout = void 0;
        }
        if (!horizontalOpenerTimeout && openHorizontalPosition !== void 0) {
          lastOpenHorizontalPosition = openHorizontalPosition;
          horizontalOpenerTimeout = setTimeout(() => openPartAtPosition(openHorizontalPosition), 200);
        }
        if (!verticalOpenerTimeout && openVerticalPosition !== void 0) {
          lastOpenVerticalPosition = openVerticalPosition;
          verticalOpenerTimeout = setTimeout(() => openPartAtPosition(openVerticalPosition), 200);
        }
      },
      onDragLeave: () => clearAllTimeouts(),
      onDragEnd: () => clearAllTimeouts(),
      onDrop: () => clearAllTimeouts()
    }));
  }
  centerLayout(active) {
    this.centeredLayoutWidget.activate(active);
  }
  isLayoutCentered() {
    if (this.centeredLayoutWidget) {
      return this.centeredLayoutWidget.isActive();
    }
    return false;
  }
  doCreateGridControl() {
    let restoreError = false;
    if (this._willRestoreState) {
      restoreError = !this.doCreateGridControlWithPreviousState();
    }
    if (!this.gridWidget || restoreError) {
      const initialGroup = this.doCreateGroupView();
      this.doSetGridWidget(new SerializableGrid(initialGroup));
      this.doSetGroupActive(initialGroup);
    }
    this.updateContainer();
    this.notifyGroupIndexChange();
  }
  doCreateGridControlWithPreviousState() {
    const state = this.loadState();
    if (state?.serializedGrid) {
      try {
        this.mostRecentActiveGroups = state.mostRecentActiveGroups;
        this.doCreateGridControlWithState(state.serializedGrid, state.activeGroup);
      } catch (error) {
        onUnexpectedError(new Error(`Error restoring editor grid widget: ${error} (with state: ${JSON.stringify(state)})`));
        this.disposeGroups();
        return false;
      }
    }
    return true;
  }
  doCreateGridControlWithState(serializedGrid, activeGroupId, editorGroupViewsToReuse, options) {
    let reuseGroupViews;
    if (editorGroupViewsToReuse) {
      reuseGroupViews = editorGroupViewsToReuse.slice(0);
    } else {
      reuseGroupViews = [];
    }
    const groupViews = [];
    const gridWidget = SerializableGrid.deserialize(serializedGrid, {
      fromJSON: (serializedEditorGroup) => {
        let groupView;
        if (reuseGroupViews.length > 0) {
          groupView = reuseGroupViews.shift();
        } else {
          groupView = this.doCreateGroupView(serializedEditorGroup, options);
        }
        groupViews.push(groupView);
        if (groupView.id === activeGroupId) {
          this.doSetGroupActive(groupView);
        }
        return groupView;
      }
    }, { styles: { separatorBorder: this.gridSeparatorBorder } });
    if (!this._activeGroup) {
      this.doSetGroupActive(groupViews[0]);
    }
    if (this.mostRecentActiveGroups.some((groupId) => !this.getGroup(groupId))) {
      this.mostRecentActiveGroups = groupViews.map((group) => group.id);
    }
    this.doSetGridWidget(gridWidget);
  }
  doSetGridWidget(gridWidget) {
    let boundarySashes = {};
    if (this.gridWidget) {
      boundarySashes = this.gridWidget.boundarySashes;
      this.gridWidget.dispose();
    }
    this.gridWidget = gridWidget;
    this.gridWidget.boundarySashes = boundarySashes;
    this.gridWidgetView.gridWidget = gridWidget;
    this._onDidChangeSizeConstraints.input = gridWidget.onDidChange;
    this._onDidScroll.input = gridWidget.onDidScroll;
    this.gridWidgetDisposables.clear();
    this.gridWidgetDisposables.add(gridWidget.onDidChangeViewMaximized((maximized) => this._onDidChangeGroupMaximized.fire(maximized)));
    this.onDidSetGridWidget.fire(void 0);
  }
  updateContainer() {
    const container = assertIsDefined(this.container);
    container.classList.toggle("empty", this.isEmpty);
  }
  notifyGroupIndexChange() {
    this.getGroups(GroupsOrder.GRID_APPEARANCE).forEach((group, index) => group.notifyIndexChanged(index));
  }
  notifyGroupsLabelChange(newLabel) {
    for (const group of this.groups) {
      group.notifyLabelChanged(newLabel);
    }
  }
  get isEmpty() {
    return this.count === 1 && this._activeGroup.isEmpty;
  }
  setBoundarySashes(sashes) {
    this.gridWidget.boundarySashes = sashes;
    this.centeredLayoutWidget.boundarySashes = sashes;
  }
  layout(width, height, top, left) {
    this.top = top;
    this.left = left;
    const contentAreaSize = super.layoutContents(width, height).contentSize;
    this.doLayout(Dimension.lift(contentAreaSize), top, left);
  }
  doLayout(dimension, top = this.top, left = this.left) {
    this._contentDimension = dimension;
    this.centeredLayoutWidget.layout(this._contentDimension.width, this._contentDimension.height, top, left);
    this._onDidLayout.fire(dimension);
  }
  saveState() {
    if (this.gridWidget) {
      if (this.isEmpty) {
        delete this.workspaceMemento[EditorPart.EDITOR_PART_UI_STATE_STORAGE_KEY];
      } else {
        this.workspaceMemento[EditorPart.EDITOR_PART_UI_STATE_STORAGE_KEY] = this.createState();
      }
    }
    if (this.centeredLayoutWidget) {
      const centeredLayoutState = this.centeredLayoutWidget.state;
      if (this.centeredLayoutWidget.isDefault(centeredLayoutState)) {
        delete this.profileMemento[EditorPart.EDITOR_PART_CENTERED_VIEW_STORAGE_KEY];
      } else {
        this.profileMemento[EditorPart.EDITOR_PART_CENTERED_VIEW_STORAGE_KEY] = centeredLayoutState;
      }
    }
    super.saveState();
  }
  loadState() {
    return this.workspaceMemento[EditorPart.EDITOR_PART_UI_STATE_STORAGE_KEY];
  }
  createState() {
    return {
      serializedGrid: this.gridWidget.serialize(),
      activeGroup: this._activeGroup.id,
      mostRecentActiveGroups: this.mostRecentActiveGroups
    };
  }
  applyState(state, options) {
    if (state === "empty") {
      return this.doApplyEmptyState();
    } else {
      return this.doApplyState(state, options);
    }
  }
  async doApplyState(state, options) {
    const groups = await this.doPrepareApplyState();
    this._onDidAddGroup.pause();
    this._onDidRemoveGroup.pause();
    this.disposeGroups();
    this.mostRecentActiveGroups = state.mostRecentActiveGroups;
    try {
      this.doApplyGridState(state.serializedGrid, state.activeGroup, void 0, options);
    } finally {
      this._onDidRemoveGroup.resume();
      this._onDidAddGroup.resume();
    }
    await this.activeGroup.openEditors(
      groups.flatMap((group) => group.editors).filter((editor) => this.editorPartsView.groups.every((groupView) => !groupView.contains(editor))).map((editor) => ({
        editor,
        options: { pinned: true, preserveFocus: true, inactive: true }
      }))
    );
  }
  async doApplyEmptyState() {
    await this.doPrepareApplyState();
    this.mergeAllGroups(this.activeGroup);
  }
  async doPrepareApplyState() {
    const groups = this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);
    for (const group of groups) {
      await group.closeAllEditors({ excludeConfirming: true });
    }
    return groups;
  }
  doApplyGridState(gridState, activeGroupId, editorGroupViewsToReuse, options) {
    this.doCreateGridControlWithState(gridState, activeGroupId, editorGroupViewsToReuse, options);
    this.doLayout(this._contentDimension);
    this.updateContainer();
    for (const groupView of this.getGroups(GroupsOrder.GRID_APPEARANCE)) {
      if (!editorGroupViewsToReuse?.includes(groupView)) {
        this._onDidAddGroup.fire(groupView);
      }
    }
    this.notifyGroupIndexChange();
  }
  onDidChangeMementoState(e) {
    if (e.external && e.scope === StorageScope.WORKSPACE) {
      this.reloadMemento(e.scope);
      const state = this.loadState();
      if (state) {
        this.applyState(state);
      }
    }
  }
  toJSON() {
    return {
      type: Parts.EDITOR_PART
    };
  }
  disposeGroups() {
    for (const group of this.groups) {
      group.dispose();
      this._onDidRemoveGroup.fire(group);
    }
    this.groupViews.clear();
    this.mostRecentActiveGroups = [];
  }
  dispose() {
    this._onWillDispose.fire();
    this.disposeGroups();
    this.gridWidget?.dispose();
    super.dispose();
  }
  //#endregion
};
EditorPart.EDITOR_PART_UI_STATE_STORAGE_KEY = "editorpart.state";
EditorPart.EDITOR_PART_CENTERED_VIEW_STORAGE_KEY = "editorpart.centeredview";
EditorPart = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IWorkbenchLayoutService),
  __decorateParam(9, IHostService),
  __decorateParam(10, IContextKeyService)
], EditorPart);
let MainEditorPart = class extends EditorPart {
  constructor(editorPartsView, instantiationService, themeService, configurationService, storageService, layoutService, hostService, contextKeyService) {
    super(editorPartsView, Parts.EDITOR_PART, "", mainWindow.vscodeWindowId, instantiationService, themeService, configurationService, storageService, layoutService, hostService, contextKeyService);
  }
};
MainEditorPart = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkbenchLayoutService),
  __decorateParam(6, IHostService),
  __decorateParam(7, IContextKeyService)
], MainEditorPart);
export {
  EditorPart,
  MainEditorPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFydC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFBhcnQgfSBmcm9tICcuLi8uLi9wYXJ0LmpzJztcbmltcG9ydCB7IERpbWVuc2lvbiwgJCwgRXZlbnRIZWxwZXIsIGFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VEb3duTGlzdGVuZXIsIGdldFdpbmRvdywgaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudCwgZ2V0QWN0aXZlRWxlbWVudCwgaXNIVE1MRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIsIFJlbGF5LCBQYXVzZWFibGVFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgY29udHJhc3RCb3JkZXIsIGVkaXRvckJhY2tncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBHcm91cERpcmVjdGlvbiwgR3JvdXBzQXJyYW5nZW1lbnQsIEdyb3VwT3JpZW50YXRpb24sIElNZXJnZUdyb3VwT3B0aW9ucywgTWVyZ2VHcm91cE1vZGUsIEdyb3Vwc09yZGVyLCBHcm91cExvY2F0aW9uLCBJRmluZEdyb3VwU2NvcGUsIEVkaXRvckdyb3VwTGF5b3V0LCBHcm91cExheW91dEFyZ3VtZW50LCBJRWRpdG9yU2lkZUdyb3VwLCBJRWRpdG9yRHJvcFRhcmdldERlbGVnYXRlLCBJRWRpdG9yUGFydCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElWaWV3LCBvcnRob2dvbmFsLCBMYXlvdXRQcmlvcml0eSwgSVZpZXdTaXplLCBEaXJlY3Rpb24sIFNlcmlhbGl6YWJsZUdyaWQsIFNpemluZywgSVNlcmlhbGl6ZWRHcmlkLCBJU2VyaWFsaXplZE5vZGUsIE9yaWVudGF0aW9uLCBHcmlkQnJhbmNoTm9kZSwgaXNHcmlkQnJhbmNoTm9kZSwgR3JpZE5vZGUsIGNyZWF0ZVNlcmlhbGl6ZWRHcmlkLCBHcmlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2dyaWQvZ3JpZC5qcyc7XG5pbXBvcnQgeyBHcm91cElkZW50aWZpZXIsIEVkaXRvcklucHV0V2l0aE9wdGlvbnMsIElFZGl0b3JQYXJ0T3B0aW9ucywgSUVkaXRvclBhcnRPcHRpb25zQ2hhbmdlRXZlbnQsIEdyb3VwTW9kZWxDaGFuZ2VLaW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFRElUT1JfR1JPVVBfQk9SREVSLCBFRElUT1JfUEFORV9CQUNLR1JPVU5EIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IGRpc3RpbmN0LCBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBWaWV3LCBnZXRFZGl0b3JQYXJ0T3B0aW9ucywgaW1wYWN0c0VkaXRvclBhcnRPcHRpb25zLCBJRWRpdG9yUGFydENyZWF0aW9uT3B0aW9ucywgSUVkaXRvclBhcnRzVmlldywgSUVkaXRvckdyb3Vwc1ZpZXcsIElFZGl0b3JHcm91cFZpZXdPcHRpb25zIH0gZnJvbSAnLi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9yR3JvdXBWaWV3IH0gZnJvbSAnLi9lZGl0b3JHcm91cFZpZXcuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSwgdG9EaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBJU3RvcmFnZVZhbHVlQ2hhbmdlRXZlbnQsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVNlcmlhbGl6ZWRFZGl0b3JHcm91cE1vZGVsLCBpc1NlcmlhbGl6ZWRFZGl0b3JHcm91cE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JHcm91cE1vZGVsLmpzJztcbmltcG9ydCB7IEVkaXRvckRyb3BUYXJnZXQgfSBmcm9tICcuL2VkaXRvckRyb3BUYXJnZXQuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBDZW50ZXJlZFZpZXdMYXlvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY2VudGVyZWQvY2VudGVyZWRWaWV3TGF5b3V0LmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IFBhcnRzLCBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERlZXBQYXJ0aWFsLCBhc3NlcnRJc0RlZmluZWQsIGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBDb21wb3NpdGVEcmFnQW5kRHJvcE9ic2VydmVyIH0gZnJvbSAnLi4vLi4vZG5kLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgUHJvbWlzZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBmaW5kR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3VwRmluZGVyLmpzJztcbmltcG9ydCB7IFNJREVfR1JPVVAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUJvdW5kYXJ5U2FzaGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Nhc2gvc2FzaC5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFydE1heGltaXplZEVkaXRvckdyb3VwQ29udGV4dCwgRWRpdG9yUGFydE11bHRpcGxlRWRpdG9yR3JvdXBzQ29udGV4dCwgSXNBdXhpbGlhcnlFZGl0b3JQYXJ0Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVkaXRvclBhcnRVSVN0YXRlIHtcblx0cmVhZG9ubHkgc2VyaWFsaXplZEdyaWQ6IElTZXJpYWxpemVkR3JpZDtcblx0cmVhZG9ubHkgYWN0aXZlR3JvdXA6IEdyb3VwSWRlbnRpZmllcjtcblx0cmVhZG9ubHkgbW9zdFJlY2VudEFjdGl2ZUdyb3VwczogR3JvdXBJZGVudGlmaWVyW107XG59XG5cbmNsYXNzIEdyaWRXaWRnZXRWaWV3PFQgZXh0ZW5kcyBJVmlldz4gaW1wbGVtZW50cyBJVmlldyB7XG5cblx0cmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQgPSAkKCcuZ3JpZC12aWV3LWNvbnRhaW5lcicpO1xuXG5cdGdldCBtaW5pbXVtV2lkdGgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZ3JpZFdpZGdldCA/IHRoaXMuZ3JpZFdpZGdldC5taW5pbXVtV2lkdGggOiAwOyB9XG5cdGdldCBtYXhpbXVtV2lkdGgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZ3JpZFdpZGdldCA/IHRoaXMuZ3JpZFdpZGdldC5tYXhpbXVtV2lkdGggOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7IH1cblx0Z2V0IG1pbmltdW1IZWlnaHQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZ3JpZFdpZGdldCA/IHRoaXMuZ3JpZFdpZGdldC5taW5pbXVtSGVpZ2h0IDogMDsgfVxuXHRnZXQgbWF4aW11bUhlaWdodCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5ncmlkV2lkZ2V0ID8gdGhpcy5ncmlkV2lkZ2V0Lm1heGltdW1IZWlnaHQgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7IH1cblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZSA9IG5ldyBSZWxheTx7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0gfCB1bmRlZmluZWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfZ3JpZFdpZGdldDogR3JpZDxUPiB8IHVuZGVmaW5lZDtcblxuXHRnZXQgZ3JpZFdpZGdldCgpOiBHcmlkPFQ+IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fZ3JpZFdpZGdldDtcblx0fVxuXG5cdHNldCBncmlkV2lkZ2V0KGdyaWQ6IEdyaWQ8VD4gfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLmVsZW1lbnQuaW5uZXJUZXh0ID0gJyc7XG5cblx0XHRpZiAoZ3JpZCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKGdyaWQuZWxlbWVudCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5pbnB1dCA9IGdyaWQub25EaWRDaGFuZ2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmlucHV0ID0gRXZlbnQuTm9uZTtcblx0XHR9XG5cblx0XHR0aGlzLl9ncmlkV2lkZ2V0ID0gZ3JpZDtcblx0fVxuXG5cdGxheW91dCh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgdG9wOiBudW1iZXIsIGxlZnQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuZ3JpZFdpZGdldD8ubGF5b3V0KHdpZHRoLCBoZWlnaHQsIHRvcCwgbGVmdCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRWRpdG9yUGFydCBleHRlbmRzIFBhcnQgaW1wbGVtZW50cyBJRWRpdG9yUGFydCwgSUVkaXRvckdyb3Vwc1ZpZXcge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEVESVRPUl9QQVJUX1VJX1NUQVRFX1NUT1JBR0VfS0VZID0gJ2VkaXRvcnBhcnQuc3RhdGUnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBFRElUT1JfUEFSVF9DRU5URVJFRF9WSUVXX1NUT1JBR0VfS0VZID0gJ2VkaXRvcnBhcnQuY2VudGVyZWR2aWV3JztcblxuXHQvLyNyZWdpb24gRXZlbnRzXG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRGb2N1cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEZvY3VzID0gdGhpcy5fb25EaWRGb2N1cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZExheW91dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPERpbWVuc2lvbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTGF5b3V0ID0gdGhpcy5fb25EaWRMYXlvdXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVHcm91cCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JHcm91cFZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFjdGl2ZUdyb3VwID0gdGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVHcm91cC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUdyb3VwSW5kZXggPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRWRpdG9yR3JvdXBWaWV3PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VHcm91cEluZGV4ID0gdGhpcy5fb25EaWRDaGFuZ2VHcm91cEluZGV4LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlR3JvdXBMYWJlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JHcm91cFZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUdyb3VwTGFiZWwgPSB0aGlzLl9vbkRpZENoYW5nZUdyb3VwTGFiZWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VHcm91cExvY2tlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JHcm91cFZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUdyb3VwTG9ja2VkID0gdGhpcy5fb25EaWRDaGFuZ2VHcm91cExvY2tlZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUdyb3VwTWF4aW1pemVkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlR3JvdXBNYXhpbWl6ZWQgPSB0aGlzLl9vbkRpZENoYW5nZUdyb3VwTWF4aW1pemVkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWN0aXZhdGVHcm91cCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JHcm91cFZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZEFjdGl2YXRlR3JvdXAgPSB0aGlzLl9vbkRpZEFjdGl2YXRlR3JvdXAuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBZGRHcm91cCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQYXVzZWFibGVFbWl0dGVyPElFZGl0b3JHcm91cFZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZEFkZEdyb3VwID0gdGhpcy5fb25EaWRBZGRHcm91cC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlbW92ZUdyb3VwID0gdGhpcy5fcmVnaXN0ZXIobmV3IFBhdXNlYWJsZUVtaXR0ZXI8SUVkaXRvckdyb3VwVmlldz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVtb3ZlR3JvdXAgPSB0aGlzLl9vbkRpZFJlbW92ZUdyb3VwLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkTW92ZUdyb3VwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvckdyb3VwVmlldz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTW92ZUdyb3VwID0gdGhpcy5fb25EaWRNb3ZlR3JvdXAuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZFNldEdyaWRXaWRnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0gfCB1bmRlZmluZWQ+KCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJlbGF5PHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB8IHVuZGVmaW5lZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzID0gRXZlbnQuYW55KHRoaXMub25EaWRTZXRHcmlkV2lkZ2V0LmV2ZW50LCB0aGlzLl9vbkRpZENoYW5nZVNpemVDb25zdHJhaW50cy5ldmVudCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTY3JvbGwgPSB0aGlzLl9yZWdpc3RlcihuZXcgUmVsYXk8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2Nyb2xsID0gRXZlbnQuYW55KHRoaXMub25EaWRTZXRHcmlkV2lkZ2V0LmV2ZW50LCB0aGlzLl9vbkRpZFNjcm9sbC5ldmVudCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VFZGl0b3JQYXJ0T3B0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JQYXJ0T3B0aW9uc0NoYW5nZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VFZGl0b3JQYXJ0T3B0aW9ucyA9IHRoaXMuX29uRGlkQ2hhbmdlRWRpdG9yUGFydE9wdGlvbnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxEaXNwb3NlID0gdGhpcy5fb25XaWxsRGlzcG9zZS5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZU1lbWVudG8gPSB0aGlzLmdldE1lbWVudG8oU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0cHJpdmF0ZSByZWFkb25seSBwcm9maWxlTWVtZW50byA9IHRoaXMuZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGdyb3VwVmlld3MgPSBuZXcgTWFwPEdyb3VwSWRlbnRpZmllciwgSUVkaXRvckdyb3VwVmlldz4oKTtcblx0cHJpdmF0ZSBtb3N0UmVjZW50QWN0aXZlR3JvdXBzOiBHcm91cElkZW50aWZpZXJbXSA9IFtdO1xuXG5cdHByb3RlY3RlZCBjb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UhOiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cblx0cHJpdmF0ZSBjZW50ZXJlZExheW91dFdpZGdldCE6IENlbnRlcmVkVmlld0xheW91dDtcblxuXHRwcml2YXRlIGdyaWRXaWRnZXQhOiBTZXJpYWxpemFibGVHcmlkPElFZGl0b3JHcm91cFZpZXc+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGdyaWRXaWRnZXREaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZ3JpZFdpZGdldFZpZXcgPSB0aGlzLl9yZWdpc3RlcihuZXcgR3JpZFdpZGdldFZpZXc8SUVkaXRvckdyb3VwVmlldz4oKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGVkaXRvclBhcnRzVmlldzogSUVkaXRvclBhcnRzVmlldyxcblx0XHRpZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZ3JvdXBzTGFiZWw6IHN0cmluZyxcblx0XHRyZWFkb25seSB3aW5kb3dJZDogbnVtYmVyLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGlkLCB7IGhhc1RpdGxlOiBmYWxzZSB9LCB0aGVtZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3BhcnRPcHRpb25zID0gZ2V0RWRpdG9yUGFydE9wdGlvbnModGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy50aGVtZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHRoaXMub25Db25maWd1cmF0aW9uVXBkYXRlZChlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudGhlbWVTZXJ2aWNlLm9uRGlkRmlsZUljb25UaGVtZUNoYW5nZSgoKSA9PiB0aGlzLmhhbmRsZUNoYW5nZWRQYXJ0T3B0aW9ucygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZU1lbWVudG9WYWx1ZShTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCB0aGlzLl9zdG9yZSkoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlTWVtZW50b1N0YXRlKGUpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uQ29uZmlndXJhdGlvblVwZGF0ZWQoZXZlbnQ6IElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoaW1wYWN0c0VkaXRvclBhcnRPcHRpb25zKGV2ZW50KSkge1xuXHRcdFx0dGhpcy5oYW5kbGVDaGFuZ2VkUGFydE9wdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUNoYW5nZWRQYXJ0T3B0aW9ucygpOiB2b2lkIHtcblx0XHRjb25zdCBvbGRQYXJ0T3B0aW9ucyA9IHRoaXMuX3BhcnRPcHRpb25zO1xuXHRcdGNvbnN0IG5ld1BhcnRPcHRpb25zID0gZ2V0RWRpdG9yUGFydE9wdGlvbnModGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy50aGVtZVNlcnZpY2UpO1xuXG5cdFx0Zm9yIChjb25zdCBlbmZvcmNlZFBhcnRPcHRpb25zIG9mIHRoaXMuZW5mb3JjZWRQYXJ0T3B0aW9ucykge1xuXHRcdFx0T2JqZWN0LmFzc2lnbihuZXdQYXJ0T3B0aW9ucywgZW5mb3JjZWRQYXJ0T3B0aW9ucyk7IC8vIGNoZWNrIGZvciBvdmVycmlkZXNcblx0XHR9XG5cblx0XHR0aGlzLl9wYXJ0T3B0aW9ucyA9IG5ld1BhcnRPcHRpb25zO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFZGl0b3JQYXJ0T3B0aW9ucy5maXJlKHsgb2xkUGFydE9wdGlvbnMsIG5ld1BhcnRPcHRpb25zIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBlbmZvcmNlZFBhcnRPcHRpb25zOiBEZWVwUGFydGlhbDxJRWRpdG9yUGFydE9wdGlvbnM+W10gPSBbXTtcblxuXHRwcml2YXRlIF9wYXJ0T3B0aW9uczogSUVkaXRvclBhcnRPcHRpb25zO1xuXHRnZXQgcGFydE9wdGlvbnMoKTogSUVkaXRvclBhcnRPcHRpb25zIHsgcmV0dXJuIHRoaXMuX3BhcnRPcHRpb25zOyB9XG5cblx0ZW5mb3JjZVBhcnRPcHRpb25zKG9wdGlvbnM6IERlZXBQYXJ0aWFsPElFZGl0b3JQYXJ0T3B0aW9ucz4pOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5lbmZvcmNlZFBhcnRPcHRpb25zLnB1c2gob3B0aW9ucyk7XG5cdFx0dGhpcy5oYW5kbGVDaGFuZ2VkUGFydE9wdGlvbnMoKTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5lbmZvcmNlZFBhcnRPcHRpb25zLnNwbGljZSh0aGlzLmVuZm9yY2VkUGFydE9wdGlvbnMuaW5kZXhPZihvcHRpb25zKSwgMSk7XG5cdFx0XHR0aGlzLmhhbmRsZUNoYW5nZWRQYXJ0T3B0aW9ucygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB0b3AgPSAwO1xuXHRwcml2YXRlIGxlZnQgPSAwO1xuXHRwcml2YXRlIF9jb250ZW50RGltZW5zaW9uITogRGltZW5zaW9uO1xuXHRnZXQgY29udGVudERpbWVuc2lvbigpOiBEaW1lbnNpb24geyByZXR1cm4gdGhpcy5fY29udGVudERpbWVuc2lvbjsgfVxuXG5cdHByaXZhdGUgX2FjdGl2ZUdyb3VwITogSUVkaXRvckdyb3VwVmlldztcblx0Z2V0IGFjdGl2ZUdyb3VwKCk6IElFZGl0b3JHcm91cFZpZXcge1xuXHRcdHJldHVybiB0aGlzLl9hY3RpdmVHcm91cDtcblx0fVxuXG5cdHJlYWRvbmx5IHNpZGVHcm91cDogSUVkaXRvclNpZGVHcm91cCA9IHtcblx0XHRvcGVuRWRpdG9yOiAoZWRpdG9yLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRjb25zdCBbZ3JvdXBdID0gdGhpcy5zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBmaW5kR3JvdXAoYWNjZXNzb3IsIHsgZWRpdG9yLCBvcHRpb25zIH0sIFNJREVfR1JPVVApKTtcblxuXHRcdFx0cmV0dXJuIGdyb3VwLm9wZW5FZGl0b3IoZWRpdG9yLCBvcHRpb25zKTtcblx0XHR9XG5cdH07XG5cblx0Z2V0IGdyb3VwcygpOiBJRWRpdG9yR3JvdXBWaWV3W10ge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMuZ3JvdXBWaWV3cy52YWx1ZXMoKSk7XG5cdH1cblxuXHRnZXQgY291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5ncm91cFZpZXdzLnNpemU7XG5cdH1cblxuXHRnZXQgb3JpZW50YXRpb24oKTogR3JvdXBPcmllbnRhdGlvbiB7XG5cdFx0cmV0dXJuICh0aGlzLmdyaWRXaWRnZXQgJiYgdGhpcy5ncmlkV2lkZ2V0Lm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5WRVJUSUNBTCkgPyBHcm91cE9yaWVudGF0aW9uLlZFUlRJQ0FMIDogR3JvdXBPcmllbnRhdGlvbi5IT1JJWk9OVEFMO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNSZWFkeSA9IGZhbHNlO1xuXHRnZXQgaXNSZWFkeSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2lzUmVhZHk7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHdoZW5SZWFkeVByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IHdoZW5SZWFkeSA9IHRoaXMud2hlblJlYWR5UHJvbWlzZS5wO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgd2hlblJlc3RvcmVkUHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0cmVhZG9ubHkgd2hlblJlc3RvcmVkID0gdGhpcy53aGVuUmVzdG9yZWRQcm9taXNlLnA7XG5cblx0Z2V0IGhhc1Jlc3RvcmFibGVTdGF0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLndvcmtzcGFjZU1lbWVudG9bRWRpdG9yUGFydC5FRElUT1JfUEFSVF9VSV9TVEFURV9TVE9SQUdFX0tFWV07XG5cdH1cblxuXHRwcml2YXRlIF93aWxsUmVzdG9yZVN0YXRlID0gZmFsc2U7XG5cdGdldCB3aWxsUmVzdG9yZVN0YXRlKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fd2lsbFJlc3RvcmVTdGF0ZTsgfVxuXG5cdGdldEdyb3VwcyhvcmRlciA9IEdyb3Vwc09yZGVyLkNSRUFUSU9OX1RJTUUpOiBJRWRpdG9yR3JvdXBWaWV3W10ge1xuXHRcdHN3aXRjaCAob3JkZXIpIHtcblx0XHRcdGNhc2UgR3JvdXBzT3JkZXIuQ1JFQVRJT05fVElNRTpcblx0XHRcdFx0cmV0dXJuIHRoaXMuZ3JvdXBzO1xuXG5cdFx0XHRjYXNlIEdyb3Vwc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFOiB7XG5cdFx0XHRcdGNvbnN0IG1vc3RSZWNlbnRBY3RpdmUgPSBjb2FsZXNjZSh0aGlzLm1vc3RSZWNlbnRBY3RpdmVHcm91cHMubWFwKGdyb3VwSWQgPT4gdGhpcy5nZXRHcm91cChncm91cElkKSkpO1xuXG5cdFx0XHRcdC8vIHRoZXJlIGNhbiBiZSBncm91cHMgdGhhdCBnb3QgbmV2ZXIgYWN0aXZlLCBldmVuIHRob3VnaCB0aGV5IGV4aXN0LiBpbiB0aGlzIGNhc2Vcblx0XHRcdFx0Ly8gbWFrZSBzdXJlIHRvIGp1c3QgYXBwZW5kIHRoZW0gYXQgdGhlIGVuZCBzbyB0aGF0IGFsbCBncm91cHMgYXJlIHJldHVybmVkIHByb3Blcmx5XG5cdFx0XHRcdHJldHVybiBkaXN0aW5jdChbLi4ubW9zdFJlY2VudEFjdGl2ZSwgLi4udGhpcy5ncm91cHNdKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgR3JvdXBzT3JkZXIuR1JJRF9BUFBFQVJBTkNFOiB7XG5cdFx0XHRcdGNvbnN0IHZpZXdzOiBJRWRpdG9yR3JvdXBWaWV3W10gPSBbXTtcblx0XHRcdFx0aWYgKHRoaXMuZ3JpZFdpZGdldCkge1xuXHRcdFx0XHRcdHRoaXMuZmlsbEdyaWROb2Rlcyh2aWV3cywgdGhpcy5ncmlkV2lkZ2V0LmdldFZpZXdzKCkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHZpZXdzO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZmlsbEdyaWROb2Rlcyh0YXJnZXQ6IElFZGl0b3JHcm91cFZpZXdbXSwgbm9kZTogR3JpZEJyYW5jaE5vZGU8SUVkaXRvckdyb3VwVmlldz4gfCBHcmlkTm9kZTxJRWRpdG9yR3JvdXBWaWV3Pik6IHZvaWQge1xuXHRcdGlmIChpc0dyaWRCcmFuY2hOb2RlKG5vZGUpKSB7XG5cdFx0XHRub2RlLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gdGhpcy5maWxsR3JpZE5vZGVzKHRhcmdldCwgY2hpbGQpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFyZ2V0LnB1c2gobm9kZS52aWV3KTtcblx0XHR9XG5cdH1cblxuXHRoYXNHcm91cChpZGVudGlmaWVyOiBHcm91cElkZW50aWZpZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5ncm91cFZpZXdzLmhhcyhpZGVudGlmaWVyKTtcblx0fVxuXG5cdGdldEdyb3VwKGlkZW50aWZpZXI6IEdyb3VwSWRlbnRpZmllcik6IElFZGl0b3JHcm91cFZpZXcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdyb3VwVmlld3MuZ2V0KGlkZW50aWZpZXIpO1xuXHR9XG5cblx0ZmluZEdyb3VwKHNjb3BlOiBJRmluZEdyb3VwU2NvcGUsIHNvdXJjZTogSUVkaXRvckdyb3VwVmlldyB8IEdyb3VwSWRlbnRpZmllciA9IHRoaXMuYWN0aXZlR3JvdXAsIHdyYXA/OiBib29sZWFuKTogSUVkaXRvckdyb3VwVmlldyB8IHVuZGVmaW5lZCB7XG5cblx0XHQvLyBieSBkaXJlY3Rpb25cblx0XHRpZiAodHlwZW9mIHNjb3BlLmRpcmVjdGlvbiA9PT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiB0aGlzLmRvRmluZEdyb3VwQnlEaXJlY3Rpb24oc2NvcGUuZGlyZWN0aW9uLCBzb3VyY2UsIHdyYXApO1xuXHRcdH1cblxuXHRcdC8vIGJ5IGxvY2F0aW9uXG5cdFx0aWYgKHR5cGVvZiBzY29wZS5sb2NhdGlvbiA9PT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiB0aGlzLmRvRmluZEdyb3VwQnlMb2NhdGlvbihzY29wZS5sb2NhdGlvbiwgc291cmNlLCB3cmFwKTtcblx0XHR9XG5cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgYXJndW1lbnRzJyk7XG5cdH1cblxuXHRwcml2YXRlIGRvRmluZEdyb3VwQnlEaXJlY3Rpb24oZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbiwgc291cmNlOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyLCB3cmFwPzogYm9vbGVhbik6IElFZGl0b3JHcm91cFZpZXcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHNvdXJjZUdyb3VwVmlldyA9IHRoaXMuYXNzZXJ0R3JvdXBWaWV3KHNvdXJjZSk7XG5cblx0XHQvLyBGaW5kIG5laWdoYm91cnMgYW5kIHNvcnQgYnkgb3VyIE1SVSBsaXN0XG5cdFx0Y29uc3QgbmVpZ2hib3VycyA9IHRoaXMuZ3JpZFdpZGdldC5nZXROZWlnaGJvclZpZXdzKHNvdXJjZUdyb3VwVmlldywgdGhpcy50b0dyaWRWaWV3RGlyZWN0aW9uKGRpcmVjdGlvbiksIHdyYXApO1xuXHRcdG5laWdoYm91cnMuc29ydCgoKG4xLCBuMikgPT4gdGhpcy5tb3N0UmVjZW50QWN0aXZlR3JvdXBzLmluZGV4T2YobjEuaWQpIC0gdGhpcy5tb3N0UmVjZW50QWN0aXZlR3JvdXBzLmluZGV4T2YobjIuaWQpKSk7XG5cblx0XHRyZXR1cm4gbmVpZ2hib3Vyc1swXTtcblx0fVxuXG5cdHByaXZhdGUgZG9GaW5kR3JvdXBCeUxvY2F0aW9uKGxvY2F0aW9uOiBHcm91cExvY2F0aW9uLCBzb3VyY2U6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIHdyYXA/OiBib29sZWFuKTogSUVkaXRvckdyb3VwVmlldyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgc291cmNlR3JvdXBWaWV3ID0gdGhpcy5hc3NlcnRHcm91cFZpZXcoc291cmNlKTtcblx0XHRjb25zdCBncm91cHMgPSB0aGlzLmdldEdyb3VwcyhHcm91cHNPcmRlci5HUklEX0FQUEVBUkFOQ0UpO1xuXHRcdGNvbnN0IGluZGV4ID0gZ3JvdXBzLmluZGV4T2Yoc291cmNlR3JvdXBWaWV3KTtcblxuXHRcdHN3aXRjaCAobG9jYXRpb24pIHtcblx0XHRcdGNhc2UgR3JvdXBMb2NhdGlvbi5GSVJTVDpcblx0XHRcdFx0cmV0dXJuIGdyb3Vwc1swXTtcblx0XHRcdGNhc2UgR3JvdXBMb2NhdGlvbi5MQVNUOlxuXHRcdFx0XHRyZXR1cm4gZ3JvdXBzW2dyb3Vwcy5sZW5ndGggLSAxXTtcblx0XHRcdGNhc2UgR3JvdXBMb2NhdGlvbi5ORVhUOiB7XG5cdFx0XHRcdGxldCBuZXh0R3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCB1bmRlZmluZWQgPSBncm91cHNbaW5kZXggKyAxXTtcblx0XHRcdFx0aWYgKCFuZXh0R3JvdXAgJiYgd3JhcCkge1xuXHRcdFx0XHRcdG5leHRHcm91cCA9IHRoaXMuZG9GaW5kR3JvdXBCeUxvY2F0aW9uKEdyb3VwTG9jYXRpb24uRklSU1QsIHNvdXJjZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbmV4dEdyb3VwO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBHcm91cExvY2F0aW9uLlBSRVZJT1VTOiB7XG5cdFx0XHRcdGxldCBwcmV2aW91c0dyb3VwOiBJRWRpdG9yR3JvdXBWaWV3IHwgdW5kZWZpbmVkID0gZ3JvdXBzW2luZGV4IC0gMV07XG5cdFx0XHRcdGlmICghcHJldmlvdXNHcm91cCAmJiB3cmFwKSB7XG5cdFx0XHRcdFx0cHJldmlvdXNHcm91cCA9IHRoaXMuZG9GaW5kR3JvdXBCeUxvY2F0aW9uKEdyb3VwTG9jYXRpb24uTEFTVCwgc291cmNlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBwcmV2aW91c0dyb3VwO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFjdGl2YXRlR3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIHByZXNlcnZlV2luZG93T3JkZXI/OiBib29sZWFuKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0Y29uc3QgZ3JvdXBWaWV3ID0gdGhpcy5hc3NlcnRHcm91cFZpZXcoZ3JvdXApO1xuXHRcdHRoaXMuZG9TZXRHcm91cEFjdGl2ZShncm91cFZpZXcpO1xuXG5cdFx0Ly8gRW5zdXJlIHdpbmRvdyBvbiB0b3AgdW5sZXNzIGRpc2FibGVkXG5cdFx0aWYgKCFwcmVzZXJ2ZVdpbmRvd09yZGVyKSB7XG5cdFx0XHR0aGlzLmhvc3RTZXJ2aWNlLm1vdmVUb3AoZ2V0V2luZG93KHRoaXMuZWxlbWVudCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBncm91cFZpZXc7XG5cdH1cblxuXHRyZXN0b3JlR3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIpOiBJRWRpdG9yR3JvdXBWaWV3IHtcblx0XHRjb25zdCBncm91cFZpZXcgPSB0aGlzLmFzc2VydEdyb3VwVmlldyhncm91cCk7XG5cdFx0dGhpcy5kb1Jlc3RvcmVHcm91cChncm91cFZpZXcpO1xuXG5cdFx0cmV0dXJuIGdyb3VwVmlldztcblx0fVxuXG5cdGdldFNpemUoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIpOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0ge1xuXHRcdGNvbnN0IGdyb3VwVmlldyA9IHRoaXMuYXNzZXJ0R3JvdXBWaWV3KGdyb3VwKTtcblxuXHRcdHJldHVybiB0aGlzLmdyaWRXaWRnZXQuZ2V0Vmlld1NpemUoZ3JvdXBWaWV3KTtcblx0fVxuXG5cdHNldFNpemUoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIHNpemU6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSk6IHZvaWQge1xuXHRcdGNvbnN0IGdyb3VwVmlldyA9IHRoaXMuYXNzZXJ0R3JvdXBWaWV3KGdyb3VwKTtcblxuXHRcdHRoaXMuZ3JpZFdpZGdldC5yZXNpemVWaWV3KGdyb3VwVmlldywgc2l6ZSk7XG5cdH1cblxuXHRhcnJhbmdlR3JvdXBzKGFycmFuZ2VtZW50OiBHcm91cHNBcnJhbmdlbWVudCwgdGFyZ2V0OiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyID0gdGhpcy5hY3RpdmVHcm91cCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNvdW50IDwgMikge1xuXHRcdFx0cmV0dXJuOyAvLyByZXF1aXJlIGF0IGxlYXN0IDIgZ3JvdXBzIHRvIHNob3dcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZ3JpZFdpZGdldCkge1xuXHRcdFx0cmV0dXJuOyAvLyB3ZSBoYXZlIG5vdCBiZWVuIGNyZWF0ZWQgeWV0XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ3JvdXBWaWV3ID0gdGhpcy5hc3NlcnRHcm91cFZpZXcodGFyZ2V0KTtcblxuXHRcdHN3aXRjaCAoYXJyYW5nZW1lbnQpIHtcblx0XHRcdGNhc2UgR3JvdXBzQXJyYW5nZW1lbnQuRVZFTjpcblx0XHRcdFx0dGhpcy5ncmlkV2lkZ2V0LmRpc3RyaWJ1dGVWaWV3U2l6ZXMoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEdyb3Vwc0FycmFuZ2VtZW50Lk1BWElNSVpFOlxuXHRcdFx0XHRpZiAodGhpcy5ncm91cHMubGVuZ3RoIDwgMikge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gbmVlZCBhdCBsZWFzdCAyIGdyb3VwcyB0byBiZSBtYXhpbWl6ZWRcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmdyaWRXaWRnZXQubWF4aW1pemVWaWV3KGdyb3VwVmlldyk7XG5cdFx0XHRcdGdyb3VwVmlldy5mb2N1cygpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgR3JvdXBzQXJyYW5nZW1lbnQuRVhQQU5EOlxuXHRcdFx0XHR0aGlzLmdyaWRXaWRnZXQuZXhwYW5kVmlldyhncm91cFZpZXcpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHR0b2dnbGVNYXhpbWl6ZUdyb3VwKHRhcmdldDogSUVkaXRvckdyb3VwVmlldyB8IEdyb3VwSWRlbnRpZmllciA9IHRoaXMuYWN0aXZlR3JvdXApOiB2b2lkIHtcblx0XHRpZiAodGhpcy5oYXNNYXhpbWl6ZWRHcm91cCgpKSB7XG5cdFx0XHR0aGlzLnVubWF4aW1pemVHcm91cCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFycmFuZ2VHcm91cHMoR3JvdXBzQXJyYW5nZW1lbnQuTUFYSU1JWkUsIHRhcmdldCk7XG5cdFx0fVxuXHR9XG5cblx0dG9nZ2xlRXhwYW5kR3JvdXAodGFyZ2V0OiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyID0gdGhpcy5hY3RpdmVHcm91cCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzR3JvdXBFeHBhbmRlZCh0aGlzLmFjdGl2ZUdyb3VwKSkge1xuXHRcdFx0dGhpcy5hcnJhbmdlR3JvdXBzKEdyb3Vwc0FycmFuZ2VtZW50LkVWRU4pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFycmFuZ2VHcm91cHMoR3JvdXBzQXJyYW5nZW1lbnQuRVhQQU5ELCB0YXJnZXQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdW5tYXhpbWl6ZUdyb3VwKCk6IHZvaWQge1xuXHRcdHRoaXMuZ3JpZFdpZGdldC5leGl0TWF4aW1pemVkVmlldygpO1xuXHRcdHRoaXMuX2FjdGl2ZUdyb3VwLmZvY3VzKCk7IC8vIFdoZW4gbWFraW5nIHZpZXdzIHZpc2libGUgdGhlIGZvY3VzIGNhbiBiZSBhZmZlY3RlZCwgc28gcmVzdG9yZSBpdFxuXHR9XG5cblx0aGFzTWF4aW1pemVkR3JvdXAoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZ3JpZFdpZGdldC5oYXNNYXhpbWl6ZWRWaWV3KCk7XG5cdH1cblxuXHRwcml2YXRlIGlzR3JvdXBNYXhpbWl6ZWQodGFyZ2V0R3JvdXA6IElFZGl0b3JHcm91cFZpZXcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5ncmlkV2lkZ2V0LmlzVmlld01heGltaXplZCh0YXJnZXRHcm91cCk7XG5cdH1cblxuXHRpc0dyb3VwRXhwYW5kZWQodGFyZ2V0R3JvdXA6IElFZGl0b3JHcm91cFZpZXcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5ncmlkV2lkZ2V0LmlzVmlld0V4cGFuZGVkKHRhcmdldEdyb3VwKTtcblx0fVxuXG5cdHNldEdyb3VwT3JpZW50YXRpb24ob3JpZW50YXRpb246IEdyb3VwT3JpZW50YXRpb24pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZ3JpZFdpZGdldCkge1xuXHRcdFx0cmV0dXJuOyAvLyB3ZSBoYXZlIG5vdCBiZWVuIGNyZWF0ZWQgeWV0XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3T3JpZW50YXRpb24gPSAob3JpZW50YXRpb24gPT09IEdyb3VwT3JpZW50YXRpb24uSE9SSVpPTlRBTCkgPyBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIDogT3JpZW50YXRpb24uVkVSVElDQUw7XG5cdFx0aWYgKHRoaXMuZ3JpZFdpZGdldC5vcmllbnRhdGlvbiAhPT0gbmV3T3JpZW50YXRpb24pIHtcblx0XHRcdHRoaXMuZ3JpZFdpZGdldC5vcmllbnRhdGlvbiA9IG5ld09yaWVudGF0aW9uO1xuXHRcdH1cblx0fVxuXG5cdGFwcGx5TGF5b3V0KGxheW91dDogRWRpdG9yR3JvdXBMYXlvdXQpOiB2b2lkIHtcblx0XHRjb25zdCByZXN0b3JlRm9jdXMgPSB0aGlzLnNob3VsZFJlc3RvcmVGb2N1cyh0aGlzLmNvbnRhaW5lcik7XG5cblx0XHQvLyBEZXRlcm1pbmUgaG93IG1hbnkgZ3JvdXBzIHdlIG5lZWQgb3ZlcmFsbFxuXHRcdGxldCBsYXlvdXRHcm91cHNDb3VudCA9IDA7XG5cdFx0ZnVuY3Rpb24gY291bnRHcm91cHMoZ3JvdXBzOiBHcm91cExheW91dEFyZ3VtZW50W10pOiB2b2lkIHtcblx0XHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgZ3JvdXBzKSB7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KGdyb3VwLmdyb3VwcykpIHtcblx0XHRcdFx0XHRjb3VudEdyb3Vwcyhncm91cC5ncm91cHMpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxheW91dEdyb3Vwc0NvdW50Kys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y291bnRHcm91cHMobGF5b3V0Lmdyb3Vwcyk7XG5cblx0XHQvLyBJZiB3ZSBjdXJyZW50bHkgaGF2ZSB0b28gbWFueSBncm91cHMsIG1lcmdlIHRoZW0gaW50byB0aGUgbGFzdCBvbmVcblx0XHRsZXQgY3VycmVudEdyb3VwVmlld3MgPSB0aGlzLmdldEdyb3VwcyhHcm91cHNPcmRlci5HUklEX0FQUEVBUkFOQ0UpO1xuXHRcdGlmIChsYXlvdXRHcm91cHNDb3VudCA8IGN1cnJlbnRHcm91cFZpZXdzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgbGFzdEdyb3VwSW5MYXlvdXQgPSBjdXJyZW50R3JvdXBWaWV3c1tsYXlvdXRHcm91cHNDb3VudCAtIDFdO1xuXHRcdFx0Y3VycmVudEdyb3VwVmlld3MuZm9yRWFjaCgoZ3JvdXAsIGluZGV4KSA9PiB7XG5cdFx0XHRcdGlmIChpbmRleCA+PSBsYXlvdXRHcm91cHNDb3VudCkge1xuXHRcdFx0XHRcdHRoaXMubWVyZ2VHcm91cChncm91cCwgbGFzdEdyb3VwSW5MYXlvdXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y3VycmVudEdyb3VwVmlld3MgPSB0aGlzLmdldEdyb3VwcyhHcm91cHNPcmRlci5HUklEX0FQUEVBUkFOQ0UpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZUdyb3VwID0gdGhpcy5hY3RpdmVHcm91cDtcblxuXHRcdC8vIFByZXBhcmUgZ3JpZCBkZXNjcmlwdG9yIHRvIGNyZWF0ZSBuZXcgZ3JpZCBmcm9tXG5cdFx0Y29uc3QgZ3JpZERlc2NyaXB0b3IgPSBjcmVhdGVTZXJpYWxpemVkR3JpZCh7XG5cdFx0XHRvcmllbnRhdGlvbjogdGhpcy50b0dyaWRWaWV3T3JpZW50YXRpb24oXG5cdFx0XHRcdGxheW91dC5vcmllbnRhdGlvbixcblx0XHRcdFx0dGhpcy5pc1R3b0RpbWVuc2lvbmFsR3JpZCgpID9cblx0XHRcdFx0XHR0aGlzLmdyaWRXaWRnZXQub3JpZW50YXRpb24gOlx0XHRcdC8vIHByZXNlcnZlIG9yaWdpbmFsIG9yaWVudGF0aW9uIGZvciAyLWRpbWVuc2lvbmFsIGdyaWRzXG5cdFx0XHRcdFx0b3J0aG9nb25hbCh0aGlzLmdyaWRXaWRnZXQub3JpZW50YXRpb24pIC8vIG90aGVyd2lzZSBmbGlwIChmaXggaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzUyOTc1KVxuXHRcdFx0KSxcblx0XHRcdGdyb3VwczogbGF5b3V0Lmdyb3Vwc1xuXHRcdH0pO1xuXG5cdFx0Ly8gUmVjcmVhdGUgZ3JpZHdpZGdldCB3aXRoIGRlc2NyaXB0b3Jcblx0XHR0aGlzLmRvQXBwbHlHcmlkU3RhdGUoZ3JpZERlc2NyaXB0b3IsIGFjdGl2ZUdyb3VwLmlkLCBjdXJyZW50R3JvdXBWaWV3cyk7XG5cblx0XHQvLyBSZXN0b3JlIGZvY3VzIGFzIG5lZWRlZFxuXHRcdGlmIChyZXN0b3JlRm9jdXMpIHtcblx0XHRcdHRoaXMuX2FjdGl2ZUdyb3VwLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0TGF5b3V0KCk6IEVkaXRvckdyb3VwTGF5b3V0IHtcblxuXHRcdC8vIEV4YW1wbGUgcmV0dXJuIHZhbHVlOlxuXHRcdC8vIHsgb3JpZW50YXRpb246IDAsIGdyb3VwczogWyB7IGdyb3VwczogWyB7IHNpemU6IDAuNCB9LCB7IHNpemU6IDAuNiB9IF0sIHNpemU6IDAuNSB9LCB7IGdyb3VwczogWyB7fSwge30gXSwgc2l6ZTogMC41IH0gXSB9XG5cblx0XHRjb25zdCBzZXJpYWxpemVkR3JpZCA9IHRoaXMuZ3JpZFdpZGdldC5zZXJpYWxpemUoKTtcblx0XHRjb25zdCBvcmllbnRhdGlvbiA9IHNlcmlhbGl6ZWRHcmlkLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5IT1JJWk9OVEFMID8gR3JvdXBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIDogR3JvdXBPcmllbnRhdGlvbi5WRVJUSUNBTDtcblx0XHRjb25zdCByb290ID0gdGhpcy5zZXJpYWxpemVkTm9kZVRvR3JvdXBMYXlvdXRBcmd1bWVudChzZXJpYWxpemVkR3JpZC5yb290KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvcmllbnRhdGlvbixcblx0XHRcdGdyb3Vwczogcm9vdC5ncm91cHMgYXMgR3JvdXBMYXlvdXRBcmd1bWVudFtdXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgc2VyaWFsaXplZE5vZGVUb0dyb3VwTGF5b3V0QXJndW1lbnQoc2VyaWFsaXplZE5vZGU6IElTZXJpYWxpemVkTm9kZSk6IEdyb3VwTGF5b3V0QXJndW1lbnQge1xuXHRcdGlmIChzZXJpYWxpemVkTm9kZS50eXBlID09PSAnYnJhbmNoJykge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c2l6ZTogc2VyaWFsaXplZE5vZGUuc2l6ZSxcblx0XHRcdFx0Z3JvdXBzOiBzZXJpYWxpemVkTm9kZS5kYXRhLm1hcChub2RlID0+IHRoaXMuc2VyaWFsaXplZE5vZGVUb0dyb3VwTGF5b3V0QXJndW1lbnQobm9kZSkpXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7IHNpemU6IHNlcmlhbGl6ZWROb2RlLnNpemUgfTtcblx0fVxuXG5cdHByb3RlY3RlZCBzaG91bGRSZXN0b3JlRm9jdXModGFyZ2V0OiBFbGVtZW50IHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0YXJnZXQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdGlmIChhY3RpdmVFbGVtZW50ID09PSB0YXJnZXQub3duZXJEb2N1bWVudC5ib2R5KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gYWx3YXlzIHJlc3RvcmUgZm9jdXMgaWYgbm90aGluZyBpcyBmb2N1c2VkIGN1cnJlbnRseVxuXHRcdH1cblxuXHRcdC8vIG90aGVyd2lzZSBjaGVjayBmb3IgdGhlIGFjdGl2ZSBlbGVtZW50IGJlaW5nIGFuIGFuY2VzdG9yIG9mIHRoZSB0YXJnZXRcblx0XHRyZXR1cm4gaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudCh0YXJnZXQpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1R3b0RpbWVuc2lvbmFsR3JpZCgpOiBib29sZWFuIHtcblx0XHRjb25zdCB2aWV3cyA9IHRoaXMuZ3JpZFdpZGdldC5nZXRWaWV3cygpO1xuXHRcdGlmIChpc0dyaWRCcmFuY2hOb2RlKHZpZXdzKSkge1xuXHRcdFx0Ly8gdGhlIGdyaWQgaXMgMi1kaW1lbnNpb25hbCBpZiBhbnkgY2hpbGRyZW5cblx0XHRcdC8vIG9mIHRoZSBncmlkIGlzIGEgYnJhbmNoIG5vZGVcblx0XHRcdHJldHVybiB2aWV3cy5jaGlsZHJlbi5zb21lKGNoaWxkID0+IGlzR3JpZEJyYW5jaE5vZGUoY2hpbGQpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRhZGRHcm91cChsb2NhdGlvbjogSUVkaXRvckdyb3VwVmlldyB8IEdyb3VwSWRlbnRpZmllciwgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbiwgZ3JvdXBUb0NvcHk/OiBJRWRpdG9yR3JvdXBWaWV3KTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0Y29uc3QgbG9jYXRpb25WaWV3ID0gdGhpcy5hc3NlcnRHcm91cFZpZXcobG9jYXRpb24pO1xuXG5cdFx0bGV0IG5ld0dyb3VwVmlldzogSUVkaXRvckdyb3VwVmlldztcblxuXHRcdC8vIFNhbWUgZ3JvdXBzIHZpZXc6IGFkZCB0byBncmlkIHdpZGdldCBkaXJlY3RseVxuXHRcdGlmIChsb2NhdGlvblZpZXcuZ3JvdXBzVmlldyA9PT0gdGhpcykge1xuXHRcdFx0Y29uc3QgcmVzdG9yZUZvY3VzID0gdGhpcy5zaG91bGRSZXN0b3JlRm9jdXMobG9jYXRpb25WaWV3LmVsZW1lbnQpO1xuXG5cdFx0XHRjb25zdCBzaG91bGRFeHBhbmQgPSB0aGlzLmdyb3VwVmlld3Muc2l6ZSA+IDEgJiYgdGhpcy5pc0dyb3VwRXhwYW5kZWQobG9jYXRpb25WaWV3KTtcblx0XHRcdG5ld0dyb3VwVmlldyA9IHRoaXMuZG9DcmVhdGVHcm91cFZpZXcoZ3JvdXBUb0NvcHkpO1xuXG5cdFx0XHQvLyBBZGQgdG8gZ3JpZCB3aWRnZXRcblx0XHRcdHRoaXMuZ3JpZFdpZGdldC5hZGRWaWV3KFxuXHRcdFx0XHRuZXdHcm91cFZpZXcsXG5cdFx0XHRcdHRoaXMuZ2V0U3BsaXRTaXppbmdTdHlsZSgpLFxuXHRcdFx0XHRsb2NhdGlvblZpZXcsXG5cdFx0XHRcdHRoaXMudG9HcmlkVmlld0RpcmVjdGlvbihkaXJlY3Rpb24pLFxuXHRcdFx0KTtcblxuXHRcdFx0Ly8gVXBkYXRlIGNvbnRhaW5lclxuXHRcdFx0dGhpcy51cGRhdGVDb250YWluZXIoKTtcblxuXHRcdFx0Ly8gRXZlbnRcblx0XHRcdHRoaXMuX29uRGlkQWRkR3JvdXAuZmlyZShuZXdHcm91cFZpZXcpO1xuXG5cdFx0XHQvLyBOb3RpZnkgZ3JvdXAgaW5kZXggY2hhbmdlIGdpdmVuIGEgbmV3IGdyb3VwIHdhcyBhZGRlZFxuXHRcdFx0dGhpcy5ub3RpZnlHcm91cEluZGV4Q2hhbmdlKCk7XG5cblx0XHRcdC8vIEV4cGFuZCBuZXcgZ3JvdXAsIGlmIHRoZSByZWZlcmVuY2UgdmlldyB3YXMgcHJldmlvdXNseSBleHBhbmRlZFxuXHRcdFx0aWYgKHNob3VsZEV4cGFuZCkge1xuXHRcdFx0XHR0aGlzLmFycmFuZ2VHcm91cHMoR3JvdXBzQXJyYW5nZW1lbnQuRVhQQU5ELCBuZXdHcm91cFZpZXcpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXN0b3JlIGZvY3VzIGlmIHdlIGhhZCBpdCBwcmV2aW91c2x5IGFmdGVyIGNvbXBsZXRpbmcgdGhlIGdyaWRcblx0XHRcdC8vIG9wZXJhdGlvbi4gVGhhdCBvcGVyYXRpb24gbWlnaHQgY2F1c2UgcmVwYXJlbnRpbmcgb2YgZ3JpZCB2aWV3c1xuXHRcdFx0Ly8gd2hpY2ggbW92ZXMgZm9jdXMgdG8gdGhlIDxib2R5PiBlbGVtZW50IG90aGVyd2lzZS5cblx0XHRcdGlmIChyZXN0b3JlRm9jdXMpIHtcblx0XHRcdFx0bG9jYXRpb25WaWV3LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRGlmZmVyZW50IGdyb3VwIHZpZXc6IGFkZCB0byBncmlkIHdpZGdldCBvZiB0aGF0IGdyb3VwXG5cdFx0ZWxzZSB7XG5cdFx0XHRuZXdHcm91cFZpZXcgPSBsb2NhdGlvblZpZXcuZ3JvdXBzVmlldy5hZGRHcm91cChsb2NhdGlvblZpZXcsIGRpcmVjdGlvbiwgZ3JvdXBUb0NvcHkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXdHcm91cFZpZXc7XG5cdH1cblxuXHRwcml2YXRlIGdldFNwbGl0U2l6aW5nU3R5bGUoKTogU2l6aW5nIHtcblx0XHRzd2l0Y2ggKHRoaXMuX3BhcnRPcHRpb25zLnNwbGl0U2l6aW5nKSB7XG5cdFx0XHRjYXNlICdkaXN0cmlidXRlJzpcblx0XHRcdFx0cmV0dXJuIFNpemluZy5EaXN0cmlidXRlO1xuXHRcdFx0Y2FzZSAnc3BsaXQnOlxuXHRcdFx0XHRyZXR1cm4gU2l6aW5nLlNwbGl0O1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIFNpemluZy5BdXRvO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9DcmVhdGVHcm91cFZpZXcoZnJvbT86IElFZGl0b3JHcm91cFZpZXcgfCBJU2VyaWFsaXplZEVkaXRvckdyb3VwTW9kZWwgfCBudWxsLCBvcHRpb25zPzogSUVkaXRvckdyb3VwVmlld09wdGlvbnMpOiBJRWRpdG9yR3JvdXBWaWV3IHtcblxuXHRcdC8vIENyZWF0ZSBncm91cCB2aWV3XG5cdFx0bGV0IGdyb3VwVmlldzogSUVkaXRvckdyb3VwVmlldztcblx0XHRpZiAoZnJvbSBpbnN0YW5jZW9mIEVkaXRvckdyb3VwVmlldykge1xuXHRcdFx0Z3JvdXBWaWV3ID0gRWRpdG9yR3JvdXBWaWV3LmNyZWF0ZUNvcHkoZnJvbSwgdGhpcy5lZGl0b3JQYXJ0c1ZpZXcsIHRoaXMsIHRoaXMuZ3JvdXBzTGFiZWwsIHRoaXMuY291bnQsIHRoaXMuc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UsIG9wdGlvbnMpO1xuXHRcdH0gZWxzZSBpZiAoaXNTZXJpYWxpemVkRWRpdG9yR3JvdXBNb2RlbChmcm9tKSkge1xuXHRcdFx0Z3JvdXBWaWV3ID0gRWRpdG9yR3JvdXBWaWV3LmNyZWF0ZUZyb21TZXJpYWxpemVkKGZyb20sIHRoaXMuZWRpdG9yUGFydHNWaWV3LCB0aGlzLCB0aGlzLmdyb3Vwc0xhYmVsLCB0aGlzLmNvdW50LCB0aGlzLnNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcHRpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Z3JvdXBWaWV3ID0gRWRpdG9yR3JvdXBWaWV3LmNyZWF0ZU5ldyh0aGlzLmVkaXRvclBhcnRzVmlldywgdGhpcywgdGhpcy5ncm91cHNMYWJlbCwgdGhpcy5jb3VudCwgdGhpcy5zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gS2VlcCBpbiBtYXBcblx0XHR0aGlzLmdyb3VwVmlld3Muc2V0KGdyb3VwVmlldy5pZCwgZ3JvdXBWaWV3KTtcblxuXHRcdC8vIFRyYWNrIGZvY3VzXG5cdFx0Y29uc3QgZ3JvdXBEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRncm91cERpc3Bvc2FibGVzLmFkZChncm91cFZpZXcub25EaWRGb2N1cygoKSA9PiB7XG5cdFx0XHR0aGlzLmRvU2V0R3JvdXBBY3RpdmUoZ3JvdXBWaWV3KTtcblxuXHRcdFx0dGhpcy5fb25EaWRGb2N1cy5maXJlKCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gVHJhY2sgZ3JvdXAgY2hhbmdlc1xuXHRcdGdyb3VwRGlzcG9zYWJsZXMuYWRkKGdyb3VwVmlldy5vbkRpZE1vZGVsQ2hhbmdlKGUgPT4ge1xuXHRcdFx0c3dpdGNoIChlLmtpbmQpIHtcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5HUk9VUF9MT0NLRUQ6XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VHcm91cExvY2tlZC5maXJlKGdyb3VwVmlldyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfSU5ERVg6XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VHcm91cEluZGV4LmZpcmUoZ3JvdXBWaWV3KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5HUk9VUF9MQUJFTDpcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUdyb3VwTGFiZWwuZmlyZShncm91cFZpZXcpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIFRyYWNrIGFjdGl2ZSBlZGl0b3IgY2hhbmdlIGFmdGVyIGl0IG9jY3VycmVkXG5cdFx0Z3JvdXBEaXNwb3NhYmxlcy5hZGQoZ3JvdXBWaWV3Lm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlQ29udGFpbmVyKCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gVHJhY2sgZGlzcG9zZVxuXHRcdEV2ZW50Lm9uY2UoZ3JvdXBWaWV3Lm9uV2lsbERpc3Bvc2UpKCgpID0+IHtcblx0XHRcdGRpc3Bvc2UoZ3JvdXBEaXNwb3NhYmxlcyk7XG5cdFx0XHR0aGlzLmdyb3VwVmlld3MuZGVsZXRlKGdyb3VwVmlldy5pZCk7XG5cdFx0XHR0aGlzLmRvVXBkYXRlTW9zdFJlY2VudEFjdGl2ZShncm91cFZpZXcpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGdyb3VwVmlldztcblx0fVxuXG5cdHByaXZhdGUgZG9TZXRHcm91cEFjdGl2ZShncm91cDogSUVkaXRvckdyb3VwVmlldyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9hY3RpdmVHcm91cCAhPT0gZ3JvdXApIHtcblx0XHRcdGNvbnN0IHByZXZpb3VzQWN0aXZlR3JvdXAgPSB0aGlzLl9hY3RpdmVHcm91cDtcblx0XHRcdHRoaXMuX2FjdGl2ZUdyb3VwID0gZ3JvdXA7XG5cblx0XHRcdC8vIFVwZGF0ZSBsaXN0IG9mIG1vc3QgcmVjZW50bHkgYWN0aXZlIGdyb3Vwc1xuXHRcdFx0dGhpcy5kb1VwZGF0ZU1vc3RSZWNlbnRBY3RpdmUoZ3JvdXAsIHRydWUpO1xuXG5cdFx0XHQvLyBNYXJrIHByZXZpb3VzIG9uZSBhcyBpbmFjdGl2ZVxuXHRcdFx0aWYgKHByZXZpb3VzQWN0aXZlR3JvdXAgJiYgIXByZXZpb3VzQWN0aXZlR3JvdXAuZGlzcG9zZWQpIHtcblx0XHRcdFx0cHJldmlvdXNBY3RpdmVHcm91cC5zZXRBY3RpdmUoZmFsc2UpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBNYXJrIGdyb3VwIGFzIG5ldyBhY3RpdmVcblx0XHRcdGdyb3VwLnNldEFjdGl2ZSh0cnVlKTtcblxuXHRcdFx0Ly8gRXhwYW5kIHRoZSBncm91cCBpZiBpdCBpcyBjdXJyZW50bHkgbWluaW1pemVkXG5cdFx0XHR0aGlzLmRvUmVzdG9yZUdyb3VwKGdyb3VwKTtcblxuXHRcdFx0Ly8gRXZlbnRcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlR3JvdXAuZmlyZShncm91cCk7XG5cdFx0fVxuXG5cdFx0Ly8gQWx3YXlzIGZpcmUgdGhlIGV2ZW50IHRoYXQgYSBncm91cCBoYXMgYmVlbiBhY3RpdmF0ZWRcblx0XHQvLyBldmVuIGlmIGl0cyB0aGUgc2FtZSBncm91cCB0aGF0IGlzIGFscmVhZHkgYWN0aXZlIHRvXG5cdFx0Ly8gc2lnbmFsIHRoZSBpbnRlbnQgZXZlbiB3aGVuIG5vdGhpbmcgaGFzIGNoYW5nZWQuXG5cdFx0dGhpcy5fb25EaWRBY3RpdmF0ZUdyb3VwLmZpcmUoZ3JvdXApO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1Jlc3RvcmVHcm91cChncm91cDogSUVkaXRvckdyb3VwVmlldyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5ncmlkV2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47IC8vIG1ldGhvZCBpcyBjYWxsZWQgYXMgcGFydCBvZiBzdGF0ZSByZXN0b3JlIHZlcnkgZWFybHlcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0aWYgKHRoaXMuaGFzTWF4aW1pemVkR3JvdXAoKSAmJiAhdGhpcy5pc0dyb3VwTWF4aW1pemVkKGdyb3VwKSkge1xuXHRcdFx0XHR0aGlzLnVubWF4aW1pemVHcm91cCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB2aWV3U2l6ZSA9IHRoaXMuZ3JpZFdpZGdldC5nZXRWaWV3U2l6ZShncm91cCk7XG5cdFx0XHRpZiAodmlld1NpemUud2lkdGggPT09IGdyb3VwLm1pbmltdW1XaWR0aCB8fCB2aWV3U2l6ZS5oZWlnaHQgPT09IGdyb3VwLm1pbmltdW1IZWlnaHQpIHtcblx0XHRcdFx0dGhpcy5hcnJhbmdlR3JvdXBzKEdyb3Vwc0FycmFuZ2VtZW50LkVYUEFORCwgZ3JvdXApO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBpZ25vcmU6IG1ldGhvZCBtaWdodCBiZSBjYWxsZWQgdG9vIGVhcmx5IGJlZm9yZSB2aWV3IGlzIGtub3duIHRvIGdyaWRcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvVXBkYXRlTW9zdFJlY2VudEFjdGl2ZShncm91cDogSUVkaXRvckdyb3VwVmlldywgbWFrZU1vc3RSZWNlbnRseUFjdGl2ZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMubW9zdFJlY2VudEFjdGl2ZUdyb3Vwcy5pbmRleE9mKGdyb3VwLmlkKTtcblxuXHRcdC8vIFJlbW92ZSBmcm9tIE1SVSBsaXN0XG5cdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0dGhpcy5tb3N0UmVjZW50QWN0aXZlR3JvdXBzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIHRvIGZyb250IGFzIG5lZWRlZFxuXHRcdGlmIChtYWtlTW9zdFJlY2VudGx5QWN0aXZlKSB7XG5cdFx0XHR0aGlzLm1vc3RSZWNlbnRBY3RpdmVHcm91cHMudW5zaGlmdChncm91cC5pZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0b0dyaWRWaWV3RGlyZWN0aW9uKGRpcmVjdGlvbjogR3JvdXBEaXJlY3Rpb24pOiBEaXJlY3Rpb24ge1xuXHRcdHN3aXRjaCAoZGlyZWN0aW9uKSB7XG5cdFx0XHRjYXNlIEdyb3VwRGlyZWN0aW9uLlVQOiByZXR1cm4gRGlyZWN0aW9uLlVwO1xuXHRcdFx0Y2FzZSBHcm91cERpcmVjdGlvbi5ET1dOOiByZXR1cm4gRGlyZWN0aW9uLkRvd247XG5cdFx0XHRjYXNlIEdyb3VwRGlyZWN0aW9uLkxFRlQ6IHJldHVybiBEaXJlY3Rpb24uTGVmdDtcblx0XHRcdGNhc2UgR3JvdXBEaXJlY3Rpb24uUklHSFQ6IHJldHVybiBEaXJlY3Rpb24uUmlnaHQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0b0dyaWRWaWV3T3JpZW50YXRpb24ob3JpZW50YXRpb246IEdyb3VwT3JpZW50YXRpb24sIGZhbGxiYWNrOiBPcmllbnRhdGlvbik6IE9yaWVudGF0aW9uIHtcblx0XHRpZiAodHlwZW9mIG9yaWVudGF0aW9uID09PSAnbnVtYmVyJykge1xuXHRcdFx0cmV0dXJuIG9yaWVudGF0aW9uID09PSBHcm91cE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIDogT3JpZW50YXRpb24uVkVSVElDQUw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbGxiYWNrO1xuXHR9XG5cblx0cmVtb3ZlR3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIHByZXNlcnZlRm9jdXM/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgZ3JvdXBWaWV3ID0gdGhpcy5hc3NlcnRHcm91cFZpZXcoZ3JvdXApO1xuXHRcdGlmICh0aGlzLmNvdW50ID09PSAxKSB7XG5cdFx0XHRyZXR1cm47IC8vIENhbm5vdCByZW1vdmUgdGhlIGxhc3Qgcm9vdCBncm91cFxuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBlbXB0eSBncm91cFxuXHRcdGlmIChncm91cFZpZXcuaXNFbXB0eSkge1xuXHRcdFx0dGhpcy5kb1JlbW92ZUVtcHR5R3JvdXAoZ3JvdXBWaWV3LCBwcmVzZXJ2ZUZvY3VzKTtcblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgZ3JvdXAgd2l0aCBlZGl0b3JzXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmRvUmVtb3ZlR3JvdXBXaXRoRWRpdG9ycyhncm91cFZpZXcpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9SZW1vdmVHcm91cFdpdGhFZGl0b3JzKGdyb3VwVmlldzogSUVkaXRvckdyb3VwVmlldyk6IHZvaWQge1xuXHRcdGNvbnN0IG1vc3RSZWNlbnRseUFjdGl2ZUdyb3VwcyA9IHRoaXMuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKTtcblxuXHRcdGxldCBsYXN0QWN0aXZlR3JvdXA6IElFZGl0b3JHcm91cFZpZXc7XG5cdFx0aWYgKHRoaXMuX2FjdGl2ZUdyb3VwID09PSBncm91cFZpZXcpIHtcblx0XHRcdGxhc3RBY3RpdmVHcm91cCA9IG1vc3RSZWNlbnRseUFjdGl2ZUdyb3Vwc1sxXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGFzdEFjdGl2ZUdyb3VwID0gbW9zdFJlY2VudGx5QWN0aXZlR3JvdXBzWzBdO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92aW5nIGEgZ3JvdXAgd2l0aCBlZGl0b3JzIHNob3VsZCBtZXJnZSB0aGVzZSBlZGl0b3JzIGludG8gdGhlXG5cdFx0Ly8gbGFzdCBhY3RpdmUgZ3JvdXAgYW5kIHRoZW4gcmVtb3ZlIHRoaXMgZ3JvdXAuXG5cdFx0dGhpcy5tZXJnZUdyb3VwKGdyb3VwVmlldywgbGFzdEFjdGl2ZUdyb3VwKTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZW1vdmVFbXB0eUdyb3VwKGdyb3VwVmlldzogSUVkaXRvckdyb3VwVmlldywgcHJlc2VydmVGb2N1cz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCByZXN0b3JlRm9jdXMgPSAhcHJlc2VydmVGb2N1cyAmJiB0aGlzLnNob3VsZFJlc3RvcmVGb2N1cyh0aGlzLmNvbnRhaW5lcik7XG5cblx0XHQvLyBBY3RpdmF0ZSBuZXh0IGdyb3VwIGlmIHRoZSByZW1vdmVkIG9uZSB3YXMgYWN0aXZlXG5cdFx0aWYgKHRoaXMuX2FjdGl2ZUdyb3VwID09PSBncm91cFZpZXcpIHtcblx0XHRcdGNvbnN0IG1vc3RSZWNlbnRseUFjdGl2ZUdyb3VwcyA9IHRoaXMuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKTtcblx0XHRcdGNvbnN0IG5leHRBY3RpdmVHcm91cCA9IG1vc3RSZWNlbnRseUFjdGl2ZUdyb3Vwc1sxXTsgLy8gWzBdIHdpbGwgYmUgdGhlIGN1cnJlbnQgZ3JvdXAgd2UgYXJlIGFib3V0IHRvIGRpc3Bvc2Vcblx0XHRcdHRoaXMuZG9TZXRHcm91cEFjdGl2ZShuZXh0QWN0aXZlR3JvdXApO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBmcm9tIGdyaWQgd2lkZ2V0ICYgZGlzcG9zZVxuXHRcdHRoaXMuZ3JpZFdpZGdldC5yZW1vdmVWaWV3KGdyb3VwVmlldywgdGhpcy5nZXRTcGxpdFNpemluZ1N0eWxlKCkpO1xuXHRcdGdyb3VwVmlldy5kaXNwb3NlKCk7XG5cblx0XHQvLyBSZXN0b3JlIGZvY3VzIGlmIHdlIGhhZCBpdCBwcmV2aW91c2x5IGFmdGVyIGNvbXBsZXRpbmcgdGhlIGdyaWRcblx0XHQvLyBvcGVyYXRpb24uIFRoYXQgb3BlcmF0aW9uIG1pZ2h0IGNhdXNlIHJlcGFyZW50aW5nIG9mIGdyaWQgdmlld3Ncblx0XHQvLyB3aGljaCBtb3ZlcyBmb2N1cyB0byB0aGUgPGJvZHk+IGVsZW1lbnQgb3RoZXJ3aXNlLlxuXHRcdGlmIChyZXN0b3JlRm9jdXMpIHtcblx0XHRcdHRoaXMuX2FjdGl2ZUdyb3VwLmZvY3VzKCk7XG5cdFx0fVxuXG5cdFx0Ly8gTm90aWZ5IGdyb3VwIGluZGV4IGNoYW5nZSBnaXZlbiBhIGdyb3VwIHdhcyByZW1vdmVkXG5cdFx0dGhpcy5ub3RpZnlHcm91cEluZGV4Q2hhbmdlKCk7XG5cblx0XHQvLyBVcGRhdGUgY29udGFpbmVyXG5cdFx0dGhpcy51cGRhdGVDb250YWluZXIoKTtcblxuXHRcdC8vIEV2ZW50XG5cdFx0dGhpcy5fb25EaWRSZW1vdmVHcm91cC5maXJlKGdyb3VwVmlldyk7XG5cdH1cblxuXHRtb3ZlR3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIGxvY2F0aW9uOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyLCBkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0Y29uc3Qgc291cmNlVmlldyA9IHRoaXMuYXNzZXJ0R3JvdXBWaWV3KGdyb3VwKTtcblx0XHRjb25zdCB0YXJnZXRWaWV3ID0gdGhpcy5hc3NlcnRHcm91cFZpZXcobG9jYXRpb24pO1xuXG5cdFx0aWYgKHNvdXJjZVZpZXcuaWQgPT09IHRhcmdldFZpZXcuaWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IG1vdmUgZ3JvdXAgaW50byBpdHMgb3duJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdG9yZUZvY3VzID0gdGhpcy5zaG91bGRSZXN0b3JlRm9jdXMoc291cmNlVmlldy5lbGVtZW50KTtcblx0XHRsZXQgbW92ZWRWaWV3OiBJRWRpdG9yR3JvdXBWaWV3O1xuXG5cdFx0Ly8gU2FtZSBncm91cHMgdmlldzogbW92ZSB2aWEgZ3JpZCB3aWRnZXQgQVBJXG5cdFx0aWYgKHNvdXJjZVZpZXcuZ3JvdXBzVmlldyA9PT0gdGFyZ2V0Vmlldy5ncm91cHNWaWV3KSB7XG5cdFx0XHR0aGlzLmdyaWRXaWRnZXQubW92ZVZpZXcoc291cmNlVmlldywgdGhpcy5nZXRTcGxpdFNpemluZ1N0eWxlKCksIHRhcmdldFZpZXcsIHRoaXMudG9HcmlkVmlld0RpcmVjdGlvbihkaXJlY3Rpb24pKTtcblx0XHRcdG1vdmVkVmlldyA9IHNvdXJjZVZpZXc7XG5cdFx0fVxuXG5cdFx0Ly8gRGlmZmVyZW50IGdyb3VwcyB2aWV3OiBtb3ZlIHZpYSBncm91cHMgdmlldyBBUElcblx0XHRlbHNlIHtcblx0XHRcdG1vdmVkVmlldyA9IHRhcmdldFZpZXcuZ3JvdXBzVmlldy5hZGRHcm91cCh0YXJnZXRWaWV3LCBkaXJlY3Rpb24sIHNvdXJjZVZpZXcpO1xuXHRcdFx0c291cmNlVmlldy5jbG9zZUFsbEVkaXRvcnMoKTtcblx0XHRcdHRoaXMucmVtb3ZlR3JvdXAoc291cmNlVmlldywgcmVzdG9yZUZvY3VzKTtcblx0XHR9XG5cblx0XHQvLyBSZXN0b3JlIGZvY3VzIGlmIHdlIGhhZCBpdCBwcmV2aW91c2x5IGFmdGVyIGNvbXBsZXRpbmcgdGhlIGdyaWRcblx0XHQvLyBvcGVyYXRpb24uIFRoYXQgb3BlcmF0aW9uIG1pZ2h0IGNhdXNlIHJlcGFyZW50aW5nIG9mIGdyaWQgdmlld3Ncblx0XHQvLyB3aGljaCBtb3ZlcyBmb2N1cyB0byB0aGUgPGJvZHk+IGVsZW1lbnQgb3RoZXJ3aXNlLlxuXHRcdGlmIChyZXN0b3JlRm9jdXMpIHtcblx0XHRcdG1vdmVkVmlldy5mb2N1cygpO1xuXHRcdH1cblxuXHRcdC8vIEV2ZW50XG5cdFx0dGhpcy5fb25EaWRNb3ZlR3JvdXAuZmlyZShtb3ZlZFZpZXcpO1xuXG5cdFx0Ly8gTm90aWZ5IGdyb3VwIGluZGV4IGNoYW5nZSBnaXZlbiBhIGdyb3VwIHdhcyBtb3ZlZFxuXHRcdHRoaXMubm90aWZ5R3JvdXBJbmRleENoYW5nZSgpO1xuXG5cdFx0cmV0dXJuIG1vdmVkVmlldztcblx0fVxuXG5cdGNvcHlHcm91cChncm91cDogSUVkaXRvckdyb3VwVmlldyB8IEdyb3VwSWRlbnRpZmllciwgbG9jYXRpb246IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIGRpcmVjdGlvbjogR3JvdXBEaXJlY3Rpb24pOiBJRWRpdG9yR3JvdXBWaWV3IHtcblx0XHRjb25zdCBncm91cFZpZXcgPSB0aGlzLmFzc2VydEdyb3VwVmlldyhncm91cCk7XG5cdFx0Y29uc3QgbG9jYXRpb25WaWV3ID0gdGhpcy5hc3NlcnRHcm91cFZpZXcobG9jYXRpb24pO1xuXG5cdFx0Y29uc3QgcmVzdG9yZUZvY3VzID0gdGhpcy5zaG91bGRSZXN0b3JlRm9jdXMoZ3JvdXBWaWV3LmVsZW1lbnQpO1xuXG5cdFx0Ly8gQ29weSB0aGUgZ3JvdXAgdmlld1xuXHRcdGNvbnN0IGNvcGllZEdyb3VwVmlldyA9IHRoaXMuYWRkR3JvdXAobG9jYXRpb25WaWV3LCBkaXJlY3Rpb24sIGdyb3VwVmlldyk7XG5cblx0XHQvLyBSZXN0b3JlIGZvY3VzIGlmIHdlIGhhZCBpdFxuXHRcdGlmIChyZXN0b3JlRm9jdXMpIHtcblx0XHRcdGNvcGllZEdyb3VwVmlldy5mb2N1cygpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb3BpZWRHcm91cFZpZXc7XG5cdH1cblxuXHRtZXJnZUdyb3VwKGdyb3VwOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyLCB0YXJnZXQ6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJTWVyZ2VHcm91cE9wdGlvbnMpOiBib29sZWFuIHtcblx0XHRjb25zdCBzb3VyY2VWaWV3ID0gdGhpcy5hc3NlcnRHcm91cFZpZXcoZ3JvdXApO1xuXHRcdGNvbnN0IHRhcmdldFZpZXcgPSB0aGlzLmFzc2VydEdyb3VwVmlldyh0YXJnZXQpO1xuXG5cdFx0Ly8gQ29sbGVjdCBlZGl0b3JzIHRvIG1vdmUvY29weVxuXHRcdGNvbnN0IGVkaXRvcnM6IEVkaXRvcklucHV0V2l0aE9wdGlvbnNbXSA9IFtdO1xuXHRcdGxldCBpbmRleCA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLmluZGV4ID09PSAnbnVtYmVyJykgPyBvcHRpb25zLmluZGV4IDogdGFyZ2V0Vmlldy5jb3VudDtcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBzb3VyY2VWaWV3LmVkaXRvcnMpIHtcblx0XHRcdGNvbnN0IGluYWN0aXZlID0gIXNvdXJjZVZpZXcuaXNBY3RpdmUoZWRpdG9yKSB8fCB0aGlzLl9hY3RpdmVHcm91cCAhPT0gc291cmNlVmlldztcblxuXHRcdFx0bGV0IGFjdHVhbEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGFyZ2V0Vmlldy5jb250YWlucyhlZGl0b3IpICYmXG5cdFx0XHRcdChcblx0XHRcdFx0XHQvLyBEbyBub3QgY29uZmlndXJlIGFuIGBpbmRleGAgZm9yIGVkaXRvcnMgdGhhdCBhcmUgc3RpY2t5IGluXG5cdFx0XHRcdFx0Ly8gdGhlIHRhcmdldCwgb3RoZXJ3aXNlIHRoZXJlIGlzIGEgY2hhbmNlIG9mIGxvc2luZyB0aGF0IHN0YXRlXG5cdFx0XHRcdFx0Ly8gd2hlbiB0aGUgZWRpdG9yIGlzIG1vdmVkLlxuXHRcdFx0XHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjM5NTQ5XG5cdFx0XHRcdFx0dGFyZ2V0Vmlldy5pc1N0aWNreShlZGl0b3IpIHx8XG5cdFx0XHRcdFx0Ly8gRG8gbm90IGNvbmZpZ3VyZSBhbiBgaW5kZXhgIHdoZW4gd2UgYXJlIGV4cGxpY2l0bHkgaW5zdHJ1Y3RlZFxuXHRcdFx0XHRcdG9wdGlvbnM/LnByZXNlcnZlRXhpc3RpbmdJbmRleFxuXHRcdFx0XHQpXG5cdFx0XHQpIHtcblx0XHRcdFx0Ly8gbGVhdmUgYGluZGV4YCBhcyBgdW5kZWZpbmVkYFxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YWN0dWFsSW5kZXggPSBpbmRleDtcblx0XHRcdFx0aW5kZXgrKztcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9ycy5wdXNoKHtcblx0XHRcdFx0ZWRpdG9yLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0aW5kZXg6IGFjdHVhbEluZGV4LFxuXHRcdFx0XHRcdGluYWN0aXZlLFxuXHRcdFx0XHRcdHByZXNlcnZlRm9jdXM6IGluYWN0aXZlXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIE1vdmUvQ29weSBlZGl0b3JzIG92ZXIgaW50byB0YXJnZXRcblx0XHRsZXQgcmVzdWx0ID0gdHJ1ZTtcblx0XHRpZiAob3B0aW9ucz8ubW9kZSA9PT0gTWVyZ2VHcm91cE1vZGUuQ09QWV9FRElUT1JTKSB7XG5cdFx0XHRzb3VyY2VWaWV3LmNvcHlFZGl0b3JzKGVkaXRvcnMsIHRhcmdldFZpZXcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQgPSBzb3VyY2VWaWV3Lm1vdmVFZGl0b3JzKGVkaXRvcnMsIHRhcmdldFZpZXcpO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBzb3VyY2UgaWYgdGhlIHZpZXcgaXMgbm93IGVtcHR5IGFuZCBub3QgYWxyZWFkeSByZW1vdmVkXG5cdFx0aWYgKHNvdXJjZVZpZXcuaXNFbXB0eSAmJiAhc291cmNlVmlldy5kaXNwb3NlZCAvKiBjb3VsZCBoYXZlIGJlZW4gZGlzcG9zZWQgYWxyZWFkeSB2aWEgd29ya2JlbmNoLmVkaXRvci5jbG9zZUVtcHR5R3JvdXBzIHNldHRpbmcgKi8pIHtcblx0XHRcdHRoaXMucmVtb3ZlR3JvdXAoc291cmNlVmlldywgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdG1lcmdlQWxsR3JvdXBzKHRhcmdldDogSUVkaXRvckdyb3VwVmlldyB8IEdyb3VwSWRlbnRpZmllciwgb3B0aW9ucz86IElNZXJnZUdyb3VwT3B0aW9ucyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHRhcmdldFZpZXcgPSB0aGlzLmFzc2VydEdyb3VwVmlldyh0YXJnZXQpO1xuXG5cdFx0bGV0IHJlc3VsdCA9IHRydWU7XG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmdldEdyb3VwcyhHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkpIHtcblx0XHRcdGlmIChncm91cCA9PT0gdGFyZ2V0Vmlldykge1xuXHRcdFx0XHRjb250aW51ZTsgLy8ga2VlcCB0YXJnZXRcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbWVyZ2VkID0gdGhpcy5tZXJnZUdyb3VwKGdyb3VwLCB0YXJnZXRWaWV3LCBvcHRpb25zKTtcblx0XHRcdGlmICghbWVyZ2VkKSB7XG5cdFx0XHRcdHJlc3VsdCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXNzZXJ0R3JvdXBWaWV3KGdyb3VwOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0bGV0IGdyb3VwVmlldzogSUVkaXRvckdyb3VwVmlldyB8IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIGdyb3VwID09PSAnbnVtYmVyJykge1xuXHRcdFx0Z3JvdXBWaWV3ID0gdGhpcy5lZGl0b3JQYXJ0c1ZpZXcuZ2V0R3JvdXAoZ3JvdXApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRncm91cFZpZXcgPSBncm91cDtcblx0XHR9XG5cblx0XHRpZiAoIWdyb3VwVmlldykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGVkaXRvciBncm91cCBwcm92aWRlZCEnKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZ3JvdXBWaWV3O1xuXHR9XG5cblx0Y3JlYXRlRWRpdG9yRHJvcFRhcmdldChjb250YWluZXI6IHVua25vd24sIGRlbGVnYXRlOiBJRWRpdG9yRHJvcFRhcmdldERlbGVnYXRlKTogSURpc3Bvc2FibGUge1xuXHRcdGFzc2VydFR5cGUoaXNIVE1MRWxlbWVudChjb250YWluZXIpKTtcblxuXHRcdHJldHVybiB0aGlzLnNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvckRyb3BUYXJnZXQsIGNvbnRhaW5lciwgZGVsZWdhdGUpO1xuXHR9XG5cblx0Ly8jcmVnaW9uIFBhcnRcblxuXHQvLyBUT0RPIEBzYmF0dGVuIEBqb2FvIGZpbmQgc29tZXRoaW5nIGJldHRlciB0byBwcmV2ZW50IGVkaXRvciB0YWtpbmcgb3ZlciAjNzk4OTdcblx0Z2V0IG1pbmltdW1XaWR0aCgpOiBudW1iZXIgeyByZXR1cm4gTWF0aC5taW4odGhpcy5jZW50ZXJlZExheW91dFdpZGdldC5taW5pbXVtV2lkdGgsIHRoaXMubGF5b3V0U2VydmljZS5nZXRNYXhpbXVtRWRpdG9yRGltZW5zaW9ucyh0aGlzLmxheW91dFNlcnZpY2UuZ2V0Q29udGFpbmVyKGdldFdpbmRvdyh0aGlzLmNvbnRhaW5lcikpKS53aWR0aCk7IH1cblx0Z2V0IG1heGltdW1XaWR0aCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5jZW50ZXJlZExheW91dFdpZGdldC5tYXhpbXVtV2lkdGg7IH1cblx0Z2V0IG1pbmltdW1IZWlnaHQoKTogbnVtYmVyIHsgcmV0dXJuIE1hdGgubWluKHRoaXMuY2VudGVyZWRMYXlvdXRXaWRnZXQubWluaW11bUhlaWdodCwgdGhpcy5sYXlvdXRTZXJ2aWNlLmdldE1heGltdW1FZGl0b3JEaW1lbnNpb25zKHRoaXMubGF5b3V0U2VydmljZS5nZXRDb250YWluZXIoZ2V0V2luZG93KHRoaXMuY29udGFpbmVyKSkpLmhlaWdodCk7IH1cblx0Z2V0IG1heGltdW1IZWlnaHQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuY2VudGVyZWRMYXlvdXRXaWRnZXQubWF4aW11bUhlaWdodDsgfVxuXG5cdGdldCBzbmFwKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5sYXlvdXRTZXJ2aWNlLmdldFBhbmVsQWxpZ25tZW50KCkgPT09ICdjZW50ZXInOyB9XG5cblx0b3ZlcnJpZGUgZ2V0IG9uRGlkQ2hhbmdlKCk6IEV2ZW50PElWaWV3U2l6ZSB8IHVuZGVmaW5lZD4geyByZXR1cm4gRXZlbnQuYW55KHRoaXMuY2VudGVyZWRMYXlvdXRXaWRnZXQub25EaWRDaGFuZ2UsIHRoaXMub25EaWRTZXRHcmlkV2lkZ2V0LmV2ZW50KTsgfVxuXHRyZWFkb25seSBwcmlvcml0eTogTGF5b3V0UHJpb3JpdHkgPSBMYXlvdXRQcmlvcml0eS5IaWdoO1xuXG5cdHByaXZhdGUgZ2V0IGdyaWRTZXBhcmF0b3JCb3JkZXIoKTogQ29sb3Ige1xuXHRcdHJldHVybiB0aGlzLnRoZW1lLmdldENvbG9yKEVESVRPUl9HUk9VUF9CT1JERVIpIHx8IHRoaXMudGhlbWUuZ2V0Q29sb3IoY29udHJhc3RCb3JkZXIpIHx8IENvbG9yLnRyYW5zcGFyZW50O1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlU3R5bGVzKCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmNvbnRhaW5lcik7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHRoaXMuZ2V0Q29sb3IoZWRpdG9yQmFja2dyb3VuZCkgfHwgJyc7XG5cblx0XHRjb25zdCBzZXBhcmF0b3JCb3JkZXJTdHlsZSA9IHsgc2VwYXJhdG9yQm9yZGVyOiB0aGlzLmdyaWRTZXBhcmF0b3JCb3JkZXIsIGJhY2tncm91bmQ6IHRoaXMudGhlbWUuZ2V0Q29sb3IoRURJVE9SX1BBTkVfQkFDS0dST1VORCkgfHwgQ29sb3IudHJhbnNwYXJlbnQgfTtcblx0XHR0aGlzLmdyaWRXaWRnZXQuc3R5bGUoc2VwYXJhdG9yQm9yZGVyU3R5bGUpO1xuXHRcdHRoaXMuY2VudGVyZWRMYXlvdXRXaWRnZXQuc3R5bGVzKHNlcGFyYXRvckJvcmRlclN0eWxlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVDb250ZW50QXJlYShwYXJlbnQ6IEhUTUxFbGVtZW50LCBvcHRpb25zPzogSUVkaXRvclBhcnRDcmVhdGlvbk9wdGlvbnMpOiBIVE1MRWxlbWVudCB7XG5cblx0XHQvLyBDb250YWluZXJcblx0XHR0aGlzLmVsZW1lbnQgPSBwYXJlbnQ7XG5cdFx0dGhpcy5jb250YWluZXIgPSAkKCcuY29udGVudCcpO1xuXHRcdGlmICh0aGlzLndpbmRvd0lkICE9PSBtYWluV2luZG93LnZzY29kZVdpbmRvd0lkKSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdhdXhpbGlhcnknKTtcblx0XHR9XG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKHRoaXMuY29udGFpbmVyKTtcblxuXHRcdC8vIFNjb3BlZCBpbnN0YW50aWF0aW9uIHNlcnZpY2Vcblx0XHRjb25zdCBzY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuY29udGFpbmVyKSk7XG5cdFx0dGhpcy5zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lDb250ZXh0S2V5U2VydmljZSwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2VdXG5cdFx0KSkpO1xuXG5cdFx0Ly8gR3JpZCBjb250cm9sXG5cdFx0dGhpcy5fd2lsbFJlc3RvcmVTdGF0ZSA9ICFvcHRpb25zIHx8IG9wdGlvbnMucmVzdG9yZVByZXZpb3VzU3RhdGU7XG5cdFx0dGhpcy5kb0NyZWF0ZUdyaWRDb250cm9sKCk7XG5cblx0XHQvLyBDZW50ZXJlZCBsYXlvdXQgd2lkZ2V0XG5cdFx0dGhpcy5jZW50ZXJlZExheW91dFdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDZW50ZXJlZFZpZXdMYXlvdXQodGhpcy5jb250YWluZXIsIHRoaXMuZ3JpZFdpZGdldFZpZXcsIHRoaXMucHJvZmlsZU1lbWVudG9bRWRpdG9yUGFydC5FRElUT1JfUEFSVF9DRU5URVJFRF9WSUVXX1NUT1JBR0VfS0VZXSwgdGhpcy5fcGFydE9wdGlvbnMuY2VudGVyZWRMYXlvdXRGaXhlZFdpZHRoKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZUVkaXRvclBhcnRPcHRpb25zKGUgPT4gdGhpcy5jZW50ZXJlZExheW91dFdpZGdldC5zZXRGaXhlZFdpZHRoKGUubmV3UGFydE9wdGlvbnMuY2VudGVyZWRMYXlvdXRGaXhlZFdpZHRoID8/IGZhbHNlKSkpO1xuXG5cdFx0Ly8gRHJhZyAmIERyb3Agc3VwcG9ydFxuXHRcdHRoaXMuc2V0dXBEcmFnQW5kRHJvcFN1cHBvcnQocGFyZW50LCB0aGlzLmNvbnRhaW5lcik7XG5cblx0XHQvLyBDb250ZXh0IGtleXNcblx0XHR0aGlzLmhhbmRsZUNvbnRleHRLZXlzKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdC8vIFNpZ25hbCByZWFkeVxuXHRcdHRoaXMud2hlblJlYWR5UHJvbWlzZS5jb21wbGV0ZSgpO1xuXHRcdHRoaXMuX2lzUmVhZHkgPSB0cnVlO1xuXG5cdFx0Ly8gU2lnbmFsIHJlc3RvcmVkXG5cdFx0UHJvbWlzZXMuc2V0dGxlZCh0aGlzLmdyb3Vwcy5tYXAoZ3JvdXAgPT4gZ3JvdXAud2hlblJlc3RvcmVkKSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHR0aGlzLndoZW5SZXN0b3JlZFByb21pc2UuY29tcGxldGUoKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB0aGlzLmNvbnRhaW5lcjtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQ29udGV4dEtleXMoY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSk6IHZvaWQge1xuXHRcdGNvbnN0IGlzQXV4aWxpYXJ5RWRpdG9yUGFydENvbnRleHQgPSBJc0F1eGlsaWFyeUVkaXRvclBhcnRDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0aXNBdXhpbGlhcnlFZGl0b3JQYXJ0Q29udGV4dC5zZXQodGhpcy53aW5kb3dJZCAhPT0gbWFpbldpbmRvdy52c2NvZGVXaW5kb3dJZCk7XG5cblx0XHRjb25zdCBtdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHQgPSBFZGl0b3JQYXJ0TXVsdGlwbGVFZGl0b3JHcm91cHNDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgbWF4aW1pemVkRWRpdG9yR3JvdXBDb250ZXh0ID0gRWRpdG9yUGFydE1heGltaXplZEVkaXRvckdyb3VwQ29udGV4dC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgdXBkYXRlQ29udGV4dEtleXMgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBncm91cENvdW50ID0gdGhpcy5jb3VudDtcblx0XHRcdGlmIChncm91cENvdW50ID4gMSkge1xuXHRcdFx0XHRtdWx0aXBsZUVkaXRvckdyb3Vwc0NvbnRleHQuc2V0KHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bXVsdGlwbGVFZGl0b3JHcm91cHNDb250ZXh0LnJlc2V0KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmhhc01heGltaXplZEdyb3VwKCkpIHtcblx0XHRcdFx0bWF4aW1pemVkRWRpdG9yR3JvdXBDb250ZXh0LnNldCh0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1heGltaXplZEVkaXRvckdyb3VwQ29udGV4dC5yZXNldCgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR1cGRhdGVDb250ZXh0S2V5cygpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZEFkZEdyb3VwKCgpID0+IHVwZGF0ZUNvbnRleHRLZXlzKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkUmVtb3ZlR3JvdXAoKCkgPT4gdXBkYXRlQ29udGV4dEtleXMoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VHcm91cE1heGltaXplZCgoKSA9PiB1cGRhdGVDb250ZXh0S2V5cygpKSk7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwRHJhZ0FuZERyb3BTdXBwb3J0KHBhcmVudDogSFRNTEVsZW1lbnQsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblxuXHRcdC8vIEVkaXRvciBkcm9wIHRhcmdldFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3JlYXRlRWRpdG9yRHJvcFRhcmdldChjb250YWluZXIsIE9iamVjdC5jcmVhdGUobnVsbCkpKTtcblxuXHRcdC8vIE5vIGRyb3AgaW4gdGhlIGVkaXRvclxuXHRcdGNvbnN0IG92ZXJsYXkgPSAkKCcuZHJvcC1ibG9jay1vdmVybGF5Jyk7XG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKG92ZXJsYXkpO1xuXG5cdFx0Ly8gSGlkZSB0aGUgYmxvY2sgaWYgYSBtb3VzZSBkb3duIGV2ZW50IG9jY3VycyAjOTkwNjVcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlR2VuZXJpY01vdXNlRG93bkxpc3RlbmVyKG92ZXJsYXksICgpID0+IG92ZXJsYXkuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihDb21wb3NpdGVEcmFnQW5kRHJvcE9ic2VydmVyLklOU1RBTkNFLnJlZ2lzdGVyVGFyZ2V0KHRoaXMuZWxlbWVudCwge1xuXHRcdFx0b25EcmFnU3RhcnQ6IGUgPT4gb3ZlcmxheS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyksXG5cdFx0XHRvbkRyYWdFbmQ6IGUgPT4gb3ZlcmxheS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJylcblx0XHR9KSk7XG5cblx0XHRsZXQgaG9yaXpvbnRhbE9wZW5lclRpbWVvdXQ6IGFueTtcblx0XHRsZXQgdmVydGljYWxPcGVuZXJUaW1lb3V0OiBhbnk7XG5cdFx0bGV0IGxhc3RPcGVuSG9yaXpvbnRhbFBvc2l0aW9uOiBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgbGFzdE9wZW5WZXJ0aWNhbFBvc2l0aW9uOiBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBvcGVuUGFydEF0UG9zaXRpb24gPSAocG9zaXRpb246IFBvc2l0aW9uKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMubGF5b3V0U2VydmljZS5pc1Zpc2libGUoUGFydHMuUEFORUxfUEFSVCkgJiYgcG9zaXRpb24gPT09IHRoaXMubGF5b3V0U2VydmljZS5nZXRQYW5lbFBvc2l0aW9uKCkpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4oZmFsc2UsIFBhcnRzLlBBTkVMX1BBUlQpO1xuXHRcdFx0fSBlbHNlIGlmICghdGhpcy5sYXlvdXRTZXJ2aWNlLmlzVmlzaWJsZShQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCkgJiYgcG9zaXRpb24gPT09ICh0aGlzLmxheW91dFNlcnZpY2UuZ2V0U2lkZUJhclBvc2l0aW9uKCkgPT09IFBvc2l0aW9uLlJJR0hUID8gUG9zaXRpb24uTEVGVCA6IFBvc2l0aW9uLlJJR0hUKSkge1xuXHRcdFx0XHR0aGlzLmxheW91dFNlcnZpY2Uuc2V0UGFydEhpZGRlbihmYWxzZSwgUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBjbGVhckFsbFRpbWVvdXRzID0gKCkgPT4ge1xuXHRcdFx0aWYgKGhvcml6b250YWxPcGVuZXJUaW1lb3V0KSB7XG5cdFx0XHRcdGNsZWFyVGltZW91dChob3Jpem9udGFsT3BlbmVyVGltZW91dCk7XG5cdFx0XHRcdGhvcml6b250YWxPcGVuZXJUaW1lb3V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodmVydGljYWxPcGVuZXJUaW1lb3V0KSB7XG5cdFx0XHRcdGNsZWFyVGltZW91dCh2ZXJ0aWNhbE9wZW5lclRpbWVvdXQpO1xuXHRcdFx0XHR2ZXJ0aWNhbE9wZW5lclRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIuSU5TVEFOQ0UucmVnaXN0ZXJUYXJnZXQob3ZlcmxheSwge1xuXHRcdFx0b25EcmFnT3ZlcjogZSA9PiB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZS5ldmVudERhdGEsIHRydWUpO1xuXHRcdFx0XHRpZiAoZS5ldmVudERhdGEuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRcdFx0ZS5ldmVudERhdGEuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnbm9uZSc7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBib3VuZGluZ1JlY3QgPSBvdmVybGF5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG5cdFx0XHRcdGxldCBvcGVuSG9yaXpvbnRhbFBvc2l0aW9uOiBQb3NpdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0bGV0IG9wZW5WZXJ0aWNhbFBvc2l0aW9uOiBQb3NpdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0Y29uc3QgcHJveGltaXR5ID0gMTAwO1xuXHRcdFx0XHRpZiAoZS5ldmVudERhdGEuY2xpZW50WCA8IGJvdW5kaW5nUmVjdC5sZWZ0ICsgcHJveGltaXR5KSB7XG5cdFx0XHRcdFx0b3Blbkhvcml6b250YWxQb3NpdGlvbiA9IFBvc2l0aW9uLkxFRlQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZS5ldmVudERhdGEuY2xpZW50WCA+IGJvdW5kaW5nUmVjdC5yaWdodCAtIHByb3hpbWl0eSkge1xuXHRcdFx0XHRcdG9wZW5Ib3Jpem9udGFsUG9zaXRpb24gPSBQb3NpdGlvbi5SSUdIVDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlLmV2ZW50RGF0YS5jbGllbnRZID4gYm91bmRpbmdSZWN0LmJvdHRvbSAtIHByb3hpbWl0eSkge1xuXHRcdFx0XHRcdG9wZW5WZXJ0aWNhbFBvc2l0aW9uID0gUG9zaXRpb24uQk9UVE9NO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGUuZXZlbnREYXRhLmNsaWVudFkgPCBib3VuZGluZ1JlY3QudG9wICsgcHJveGltaXR5KSB7XG5cdFx0XHRcdFx0b3BlblZlcnRpY2FsUG9zaXRpb24gPSBQb3NpdGlvbi5UT1A7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaG9yaXpvbnRhbE9wZW5lclRpbWVvdXQgJiYgb3Blbkhvcml6b250YWxQb3NpdGlvbiAhPT0gbGFzdE9wZW5Ib3Jpem9udGFsUG9zaXRpb24pIHtcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQoaG9yaXpvbnRhbE9wZW5lclRpbWVvdXQpO1xuXHRcdFx0XHRcdGhvcml6b250YWxPcGVuZXJUaW1lb3V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHZlcnRpY2FsT3BlbmVyVGltZW91dCAmJiBvcGVuVmVydGljYWxQb3NpdGlvbiAhPT0gbGFzdE9wZW5WZXJ0aWNhbFBvc2l0aW9uKSB7XG5cdFx0XHRcdFx0Y2xlYXJUaW1lb3V0KHZlcnRpY2FsT3BlbmVyVGltZW91dCk7XG5cdFx0XHRcdFx0dmVydGljYWxPcGVuZXJUaW1lb3V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFob3Jpem9udGFsT3BlbmVyVGltZW91dCAmJiBvcGVuSG9yaXpvbnRhbFBvc2l0aW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRsYXN0T3Blbkhvcml6b250YWxQb3NpdGlvbiA9IG9wZW5Ib3Jpem9udGFsUG9zaXRpb247XG5cdFx0XHRcdFx0aG9yaXpvbnRhbE9wZW5lclRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IG9wZW5QYXJ0QXRQb3NpdGlvbihvcGVuSG9yaXpvbnRhbFBvc2l0aW9uKSwgMjAwKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghdmVydGljYWxPcGVuZXJUaW1lb3V0ICYmIG9wZW5WZXJ0aWNhbFBvc2l0aW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRsYXN0T3BlblZlcnRpY2FsUG9zaXRpb24gPSBvcGVuVmVydGljYWxQb3NpdGlvbjtcblx0XHRcdFx0XHR2ZXJ0aWNhbE9wZW5lclRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IG9wZW5QYXJ0QXRQb3NpdGlvbihvcGVuVmVydGljYWxQb3NpdGlvbiksIDIwMCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkRyYWdMZWF2ZTogKCkgPT4gY2xlYXJBbGxUaW1lb3V0cygpLFxuXHRcdFx0b25EcmFnRW5kOiAoKSA9PiBjbGVhckFsbFRpbWVvdXRzKCksXG5cdFx0XHRvbkRyb3A6ICgpID0+IGNsZWFyQWxsVGltZW91dHMoKVxuXHRcdH0pKTtcblx0fVxuXG5cdGNlbnRlckxheW91dChhY3RpdmU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmNlbnRlcmVkTGF5b3V0V2lkZ2V0LmFjdGl2YXRlKGFjdGl2ZSk7XG5cdH1cblxuXHRpc0xheW91dENlbnRlcmVkKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmNlbnRlcmVkTGF5b3V0V2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jZW50ZXJlZExheW91dFdpZGdldC5pc0FjdGl2ZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZG9DcmVhdGVHcmlkQ29udHJvbCgpOiB2b2lkIHtcblxuXHRcdC8vIEdyaWQgV2lkZ2V0ICh3aXRoIHByZXZpb3VzIFVJIHN0YXRlKVxuXHRcdGxldCByZXN0b3JlRXJyb3IgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5fd2lsbFJlc3RvcmVTdGF0ZSkge1xuXHRcdFx0cmVzdG9yZUVycm9yID0gIXRoaXMuZG9DcmVhdGVHcmlkQ29udHJvbFdpdGhQcmV2aW91c1N0YXRlKCk7XG5cdFx0fVxuXG5cdFx0Ly8gR3JpZCBXaWRnZXQgKG5vIHByZXZpb3VzIFVJIHN0YXRlIG9yIGZhaWxlZCB0byByZXN0b3JlKVxuXHRcdGlmICghdGhpcy5ncmlkV2lkZ2V0IHx8IHJlc3RvcmVFcnJvcikge1xuXHRcdFx0Y29uc3QgaW5pdGlhbEdyb3VwID0gdGhpcy5kb0NyZWF0ZUdyb3VwVmlldygpO1xuXHRcdFx0dGhpcy5kb1NldEdyaWRXaWRnZXQobmV3IFNlcmlhbGl6YWJsZUdyaWQoaW5pdGlhbEdyb3VwKSk7XG5cblx0XHRcdC8vIEVuc3VyZSBhIGdyb3VwIGlzIGFjdGl2ZVxuXHRcdFx0dGhpcy5kb1NldEdyb3VwQWN0aXZlKGluaXRpYWxHcm91cCk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIGNvbnRhaW5lclxuXHRcdHRoaXMudXBkYXRlQ29udGFpbmVyKCk7XG5cblx0XHQvLyBOb3RpZnkgZ3JvdXAgaW5kZXggY2hhbmdlIHdlIGNyZWF0ZWQgdGhlIGVudGlyZSBncmlkXG5cdFx0dGhpcy5ub3RpZnlHcm91cEluZGV4Q2hhbmdlKCk7XG5cdH1cblxuXHRwcml2YXRlIGRvQ3JlYXRlR3JpZENvbnRyb2xXaXRoUHJldmlvdXNTdGF0ZSgpOiBib29sZWFuIHtcblx0XHRjb25zdCBzdGF0ZTogSUVkaXRvclBhcnRVSVN0YXRlIHwgdW5kZWZpbmVkID0gdGhpcy5sb2FkU3RhdGUoKTtcblx0XHRpZiAoc3RhdGU/LnNlcmlhbGl6ZWRHcmlkKSB7XG5cdFx0XHR0cnkge1xuXG5cdFx0XHRcdC8vIE1SVVxuXHRcdFx0XHR0aGlzLm1vc3RSZWNlbnRBY3RpdmVHcm91cHMgPSBzdGF0ZS5tb3N0UmVjZW50QWN0aXZlR3JvdXBzO1xuXG5cdFx0XHRcdC8vIEdyaWQgV2lkZ2V0XG5cdFx0XHRcdHRoaXMuZG9DcmVhdGVHcmlkQ29udHJvbFdpdGhTdGF0ZShzdGF0ZS5zZXJpYWxpemVkR3JpZCwgc3RhdGUuYWN0aXZlR3JvdXApO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0XHQvLyBMb2cgZXJyb3Jcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IobmV3IEVycm9yKGBFcnJvciByZXN0b3JpbmcgZWRpdG9yIGdyaWQgd2lkZ2V0OiAke2Vycm9yfSAod2l0aCBzdGF0ZTogJHtKU09OLnN0cmluZ2lmeShzdGF0ZSl9KWApKTtcblxuXHRcdFx0XHQvLyBDbGVhciBhbnkgc3RhdGUgd2UgaGF2ZSBmcm9tIHRoZSBmYWlsaW5nIHJlc3RvcmVcblx0XHRcdFx0dGhpcy5kaXNwb3NlR3JvdXBzKCk7XG5cblx0XHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBmYWlsdXJlXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7IC8vIHN1Y2Nlc3Ncblx0fVxuXG5cdHByaXZhdGUgZG9DcmVhdGVHcmlkQ29udHJvbFdpdGhTdGF0ZShzZXJpYWxpemVkR3JpZDogSVNlcmlhbGl6ZWRHcmlkLCBhY3RpdmVHcm91cElkOiBHcm91cElkZW50aWZpZXIsIGVkaXRvckdyb3VwVmlld3NUb1JldXNlPzogSUVkaXRvckdyb3VwVmlld1tdLCBvcHRpb25zPzogSUVkaXRvckdyb3VwVmlld09wdGlvbnMpOiB2b2lkIHtcblxuXHRcdC8vIERldGVybWluZSBncm91cCB2aWV3cyB0byByZXVzZSBpZiBhbnlcblx0XHRsZXQgcmV1c2VHcm91cFZpZXdzOiBJRWRpdG9yR3JvdXBWaWV3W107XG5cdFx0aWYgKGVkaXRvckdyb3VwVmlld3NUb1JldXNlKSB7XG5cdFx0XHRyZXVzZUdyb3VwVmlld3MgPSBlZGl0b3JHcm91cFZpZXdzVG9SZXVzZS5zbGljZSgwKTsgLy8gZG8gbm90IG1vZGlmeSBvcmlnaW5hbCBhcnJheVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXVzZUdyb3VwVmlld3MgPSBbXTtcblx0XHR9XG5cblx0XHQvLyBDcmVhdGUgbmV3XG5cdFx0Y29uc3QgZ3JvdXBWaWV3czogSUVkaXRvckdyb3VwVmlld1tdID0gW107XG5cdFx0Y29uc3QgZ3JpZFdpZGdldCA9IFNlcmlhbGl6YWJsZUdyaWQuZGVzZXJpYWxpemUoc2VyaWFsaXplZEdyaWQsIHtcblx0XHRcdGZyb21KU09OOiAoc2VyaWFsaXplZEVkaXRvckdyb3VwOiBJU2VyaWFsaXplZEVkaXRvckdyb3VwTW9kZWwgfCBudWxsKSA9PiB7XG5cdFx0XHRcdGxldCBncm91cFZpZXc6IElFZGl0b3JHcm91cFZpZXc7XG5cdFx0XHRcdGlmIChyZXVzZUdyb3VwVmlld3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGdyb3VwVmlldyA9IHJldXNlR3JvdXBWaWV3cy5zaGlmdCgpITtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRncm91cFZpZXcgPSB0aGlzLmRvQ3JlYXRlR3JvdXBWaWV3KHNlcmlhbGl6ZWRFZGl0b3JHcm91cCwgb3B0aW9ucyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRncm91cFZpZXdzLnB1c2goZ3JvdXBWaWV3KTtcblxuXHRcdFx0XHRpZiAoZ3JvdXBWaWV3LmlkID09PSBhY3RpdmVHcm91cElkKSB7XG5cdFx0XHRcdFx0dGhpcy5kb1NldEdyb3VwQWN0aXZlKGdyb3VwVmlldyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZ3JvdXBWaWV3O1xuXHRcdFx0fVxuXHRcdH0sIHsgc3R5bGVzOiB7IHNlcGFyYXRvckJvcmRlcjogdGhpcy5ncmlkU2VwYXJhdG9yQm9yZGVyIH0gfSk7XG5cblx0XHQvLyBJZiB0aGUgYWN0aXZlIGdyb3VwIHdhcyBub3QgZm91bmQgd2hlbiByZXN0b3JpbmcgdGhlIGdyaWRcblx0XHQvLyBtYWtlIHN1cmUgdG8gbWFrZSBhdCBsZWFzdCBvbmUgZ3JvdXAgYWN0aXZlLiBXZSBhbHdheXMgbmVlZFxuXHRcdC8vIGFuIGFjdGl2ZSBncm91cC5cblx0XHRpZiAoIXRoaXMuX2FjdGl2ZUdyb3VwKSB7XG5cdFx0XHR0aGlzLmRvU2V0R3JvdXBBY3RpdmUoZ3JvdXBWaWV3c1swXSk7XG5cdFx0fVxuXG5cdFx0Ly8gVmFsaWRhdGUgTVJVIGdyb3VwIHZpZXdzIG1hdGNoZXMgZ3JpZCB3aWRnZXQgc3RhdGVcblx0XHRpZiAodGhpcy5tb3N0UmVjZW50QWN0aXZlR3JvdXBzLnNvbWUoZ3JvdXBJZCA9PiAhdGhpcy5nZXRHcm91cChncm91cElkKSkpIHtcblx0XHRcdHRoaXMubW9zdFJlY2VudEFjdGl2ZUdyb3VwcyA9IGdyb3VwVmlld3MubWFwKGdyb3VwID0+IGdyb3VwLmlkKTtcblx0XHR9XG5cblx0XHQvLyBTZXQgaXRcblx0XHR0aGlzLmRvU2V0R3JpZFdpZGdldChncmlkV2lkZ2V0KTtcblx0fVxuXG5cdHByaXZhdGUgZG9TZXRHcmlkV2lkZ2V0KGdyaWRXaWRnZXQ6IFNlcmlhbGl6YWJsZUdyaWQ8SUVkaXRvckdyb3VwVmlldz4pOiB2b2lkIHtcblx0XHRsZXQgYm91bmRhcnlTYXNoZXM6IElCb3VuZGFyeVNhc2hlcyA9IHt9O1xuXG5cdFx0aWYgKHRoaXMuZ3JpZFdpZGdldCkge1xuXHRcdFx0Ym91bmRhcnlTYXNoZXMgPSB0aGlzLmdyaWRXaWRnZXQuYm91bmRhcnlTYXNoZXM7XG5cdFx0XHR0aGlzLmdyaWRXaWRnZXQuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuZ3JpZFdpZGdldCA9IGdyaWRXaWRnZXQ7XG5cdFx0dGhpcy5ncmlkV2lkZ2V0LmJvdW5kYXJ5U2FzaGVzID0gYm91bmRhcnlTYXNoZXM7XG5cdFx0dGhpcy5ncmlkV2lkZ2V0Vmlldy5ncmlkV2lkZ2V0ID0gZ3JpZFdpZGdldDtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU2l6ZUNvbnN0cmFpbnRzLmlucHV0ID0gZ3JpZFdpZGdldC5vbkRpZENoYW5nZTtcblx0XHR0aGlzLl9vbkRpZFNjcm9sbC5pbnB1dCA9IGdyaWRXaWRnZXQub25EaWRTY3JvbGw7XG5cdFx0dGhpcy5ncmlkV2lkZ2V0RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0aGlzLmdyaWRXaWRnZXREaXNwb3NhYmxlcy5hZGQoZ3JpZFdpZGdldC5vbkRpZENoYW5nZVZpZXdNYXhpbWl6ZWQobWF4aW1pemVkID0+IHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBNYXhpbWl6ZWQuZmlyZShtYXhpbWl6ZWQpKSk7XG5cblx0XHR0aGlzLm9uRGlkU2V0R3JpZFdpZGdldC5maXJlKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbnRhaW5lcigpOiB2b2lkIHtcblx0XHRjb25zdCBjb250YWluZXIgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5jb250YWluZXIpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdlbXB0eScsIHRoaXMuaXNFbXB0eSk7XG5cdH1cblxuXHRwcml2YXRlIG5vdGlmeUdyb3VwSW5kZXhDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5nZXRHcm91cHMoR3JvdXBzT3JkZXIuR1JJRF9BUFBFQVJBTkNFKS5mb3JFYWNoKChncm91cCwgaW5kZXgpID0+IGdyb3VwLm5vdGlmeUluZGV4Q2hhbmdlZChpbmRleCkpO1xuXHR9XG5cblx0bm90aWZ5R3JvdXBzTGFiZWxDaGFuZ2UobmV3TGFiZWw6IHN0cmluZykge1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5ncm91cHMpIHtcblx0XHRcdGdyb3VwLm5vdGlmeUxhYmVsQ2hhbmdlZChuZXdMYWJlbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXQgaXNFbXB0eSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5jb3VudCA9PT0gMSAmJiB0aGlzLl9hY3RpdmVHcm91cC5pc0VtcHR5O1xuXHR9XG5cblx0c2V0Qm91bmRhcnlTYXNoZXMoc2FzaGVzOiBJQm91bmRhcnlTYXNoZXMpOiB2b2lkIHtcblx0XHR0aGlzLmdyaWRXaWRnZXQuYm91bmRhcnlTYXNoZXMgPSBzYXNoZXM7XG5cdFx0dGhpcy5jZW50ZXJlZExheW91dFdpZGdldC5ib3VuZGFyeVNhc2hlcyA9IHNhc2hlcztcblx0fVxuXG5cdG92ZXJyaWRlIGxheW91dCh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgdG9wOiBudW1iZXIsIGxlZnQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMudG9wID0gdG9wO1xuXHRcdHRoaXMubGVmdCA9IGxlZnQ7XG5cblx0XHQvLyBMYXlvdXQgY29udGVudHNcblx0XHRjb25zdCBjb250ZW50QXJlYVNpemUgPSBzdXBlci5sYXlvdXRDb250ZW50cyh3aWR0aCwgaGVpZ2h0KS5jb250ZW50U2l6ZTtcblxuXHRcdC8vIExheW91dCBlZGl0b3IgY29udGFpbmVyXG5cdFx0dGhpcy5kb0xheW91dChEaW1lbnNpb24ubGlmdChjb250ZW50QXJlYVNpemUpLCB0b3AsIGxlZnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0xheW91dChkaW1lbnNpb246IERpbWVuc2lvbiwgdG9wID0gdGhpcy50b3AsIGxlZnQgPSB0aGlzLmxlZnQpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZW50RGltZW5zaW9uID0gZGltZW5zaW9uO1xuXG5cdFx0Ly8gTGF5b3V0IEdyaWRcblx0XHR0aGlzLmNlbnRlcmVkTGF5b3V0V2lkZ2V0LmxheW91dCh0aGlzLl9jb250ZW50RGltZW5zaW9uLndpZHRoLCB0aGlzLl9jb250ZW50RGltZW5zaW9uLmhlaWdodCwgdG9wLCBsZWZ0KTtcblxuXHRcdC8vIEV2ZW50XG5cdFx0dGhpcy5fb25EaWRMYXlvdXQuZmlyZShkaW1lbnNpb24pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNhdmVTdGF0ZSgpOiB2b2lkIHtcblxuXHRcdC8vIFBlcnNpc3QgZ3JpZCBVSSBzdGF0ZVxuXHRcdGlmICh0aGlzLmdyaWRXaWRnZXQpIHtcblx0XHRcdGlmICh0aGlzLmlzRW1wdHkpIHtcblx0XHRcdFx0ZGVsZXRlIHRoaXMud29ya3NwYWNlTWVtZW50b1tFZGl0b3JQYXJ0LkVESVRPUl9QQVJUX1VJX1NUQVRFX1NUT1JBR0VfS0VZXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMud29ya3NwYWNlTWVtZW50b1tFZGl0b3JQYXJ0LkVESVRPUl9QQVJUX1VJX1NUQVRFX1NUT1JBR0VfS0VZXSA9IHRoaXMuY3JlYXRlU3RhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBQZXJzaXN0IGNlbnRlcmVkIHZpZXcgc3RhdGVcblx0XHRpZiAodGhpcy5jZW50ZXJlZExheW91dFdpZGdldCkge1xuXHRcdFx0Y29uc3QgY2VudGVyZWRMYXlvdXRTdGF0ZSA9IHRoaXMuY2VudGVyZWRMYXlvdXRXaWRnZXQuc3RhdGU7XG5cdFx0XHRpZiAodGhpcy5jZW50ZXJlZExheW91dFdpZGdldC5pc0RlZmF1bHQoY2VudGVyZWRMYXlvdXRTdGF0ZSkpIHtcblx0XHRcdFx0ZGVsZXRlIHRoaXMucHJvZmlsZU1lbWVudG9bRWRpdG9yUGFydC5FRElUT1JfUEFSVF9DRU5URVJFRF9WSUVXX1NUT1JBR0VfS0VZXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucHJvZmlsZU1lbWVudG9bRWRpdG9yUGFydC5FRElUT1JfUEFSVF9DRU5URVJFRF9WSUVXX1NUT1JBR0VfS0VZXSA9IGNlbnRlcmVkTGF5b3V0U3RhdGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c3VwZXIuc2F2ZVN0YXRlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgbG9hZFN0YXRlKCk6IElFZGl0b3JQYXJ0VUlTdGF0ZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlTWVtZW50b1tFZGl0b3JQYXJ0LkVESVRPUl9QQVJUX1VJX1NUQVRFX1NUT1JBR0VfS0VZXTtcblx0fVxuXG5cdGNyZWF0ZVN0YXRlKCk6IElFZGl0b3JQYXJ0VUlTdGF0ZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlcmlhbGl6ZWRHcmlkOiB0aGlzLmdyaWRXaWRnZXQuc2VyaWFsaXplKCksXG5cdFx0XHRhY3RpdmVHcm91cDogdGhpcy5fYWN0aXZlR3JvdXAuaWQsXG5cdFx0XHRtb3N0UmVjZW50QWN0aXZlR3JvdXBzOiB0aGlzLm1vc3RSZWNlbnRBY3RpdmVHcm91cHNcblx0XHR9O1xuXHR9XG5cblx0YXBwbHlTdGF0ZShzdGF0ZTogSUVkaXRvclBhcnRVSVN0YXRlIHwgJ2VtcHR5Jywgb3B0aW9ucz86IElFZGl0b3JHcm91cFZpZXdPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHN0YXRlID09PSAnZW1wdHknKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb0FwcGx5RW1wdHlTdGF0ZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb0FwcGx5U3RhdGUoc3RhdGUsIG9wdGlvbnMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9BcHBseVN0YXRlKHN0YXRlOiBJRWRpdG9yUGFydFVJU3RhdGUsIG9wdGlvbnM/OiBJRWRpdG9yR3JvdXBWaWV3T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGdyb3VwcyA9IGF3YWl0IHRoaXMuZG9QcmVwYXJlQXBwbHlTdGF0ZSgpO1xuXG5cdFx0Ly8gUGF1c2UgYWRkL3JlbW92ZSBldmVudHMgZm9yIGdyb3VwcyBkdXJpbmcgdGhlIGR1cmF0aW9uIG9mIGFwcGx5aW5nIHRoZSBzdGF0ZVxuXHRcdC8vIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhbiBkbyB0aGlzIHRyYW5zaXRpb24gYXRvbWljYWxseSB3aXRoIHRoZSBuZXcgc3RhdGVcblx0XHQvLyBiZWluZyByZWFkeSB3aGVuIHRoZSBldmVudHMgYXJlIGZpcmVkLiBUaGlzIGlzIGltcG9ydGFudCBiZWNhdXNlIHVzdWFsbHkgdGhlcmVcblx0XHQvLyBpcyBuZXZlciB0aGUgc3RhdGUgd2hlcmUgbm8gZ3JvdXBzIGFyZSBwcmVzZW50LCBidXQgZm9yIHRoaXMgdHJhbnNpdGlvbiB3ZVxuXHRcdC8vIG5lZWQgdG8gdGVtcG9yYXJpbHkgZGlzcG9zZSBhbGwgZ3JvdXBzIHRvIHJlc3RvcmUgdGhlIG5ldyBzZXQuXG5cblx0XHR0aGlzLl9vbkRpZEFkZEdyb3VwLnBhdXNlKCk7XG5cdFx0dGhpcy5fb25EaWRSZW1vdmVHcm91cC5wYXVzZSgpO1xuXG5cdFx0dGhpcy5kaXNwb3NlR3JvdXBzKCk7XG5cblx0XHQvLyBNUlVcblx0XHR0aGlzLm1vc3RSZWNlbnRBY3RpdmVHcm91cHMgPSBzdGF0ZS5tb3N0UmVjZW50QWN0aXZlR3JvdXBzO1xuXG5cdFx0Ly8gR3JpZCBXaWRnZXRcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5kb0FwcGx5R3JpZFN0YXRlKHN0YXRlLnNlcmlhbGl6ZWRHcmlkLCBzdGF0ZS5hY3RpdmVHcm91cCwgdW5kZWZpbmVkLCBvcHRpb25zKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Ly8gSXQgaXMgdmVyeSBpbXBvcnRhbnQgdG8ga2VlcCB0aGlzIG9yZGVyOiBmaXJzdCByZXN1bWUgdGhlIGV2ZW50cyBmb3Jcblx0XHRcdC8vIHJlbW92ZWQgZ3JvdXBzIGFuZCB0aGVuIGZvciBhZGRlZCBncm91cHMuIE1hbnkgbGlzdGVuZXJzIG1heSBzdG9yZVxuXHRcdFx0Ly8gZ3JvdXBzIGluIHNldHMgYnkgdGhlaXIgaWRlbnRpZmllciBhbmQgZ3JvdXBzIGNhbiBoYXZlIHRoZSBzYW1lXG5cdFx0XHQvLyBpZGVudGlmaWVyIGJlZm9yZSBhbmQgYWZ0ZXIuXG5cdFx0XHR0aGlzLl9vbkRpZFJlbW92ZUdyb3VwLnJlc3VtZSgpO1xuXHRcdFx0dGhpcy5fb25EaWRBZGRHcm91cC5yZXN1bWUoKTtcblx0XHR9XG5cblx0XHQvLyBSZXN0b3JlIGVkaXRvcnMgdGhhdCB3ZXJlIG5vdCBjbG9zZWQgYmVmb3JlIGFuZCBhcmUgbm93IG9wZW5lZCBub3dcblx0XHRhd2FpdCB0aGlzLmFjdGl2ZUdyb3VwLm9wZW5FZGl0b3JzKFxuXHRcdFx0Z3JvdXBzXG5cdFx0XHRcdC5mbGF0TWFwKGdyb3VwID0+IGdyb3VwLmVkaXRvcnMpXG5cdFx0XHRcdC5maWx0ZXIoZWRpdG9yID0+IHRoaXMuZWRpdG9yUGFydHNWaWV3Lmdyb3Vwcy5ldmVyeShncm91cFZpZXcgPT4gIWdyb3VwVmlldy5jb250YWlucyhlZGl0b3IpKSlcblx0XHRcdFx0Lm1hcChlZGl0b3IgPT4gKHtcblx0XHRcdFx0XHRlZGl0b3IsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlLCBpbmFjdGl2ZTogdHJ1ZSB9XG5cdFx0XHRcdH0pKVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvQXBwbHlFbXB0eVN0YXRlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuZG9QcmVwYXJlQXBwbHlTdGF0ZSgpO1xuXG5cdFx0dGhpcy5tZXJnZUFsbEdyb3Vwcyh0aGlzLmFjdGl2ZUdyb3VwKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9QcmVwYXJlQXBwbHlTdGF0ZSgpOiBQcm9taXNlPElFZGl0b3JHcm91cFZpZXdbXT4ge1xuXG5cdFx0Ly8gQmVmb3JlIGRpc3Bvc2luZyBncm91cHMsIHRyeSB0byBjbG9zZSBhcyBtYW55IGVkaXRvcnMgYXNcblx0XHQvLyBwb3NzaWJsZSwgYnV0IHNraXAgb3ZlciB0aG9zZSB0aGF0IHdvdWxkIHRyaWdnZXIgYSBkaWFsb2dcblx0XHQvLyAoZm9yIGV4YW1wbGUgd2hlbiBiZWluZyBkaXJ0eSkuIFRoaXMgaXMgdG8gYmUgYWJsZSB0byBsYXRlclxuXHRcdC8vIHJlc3RvcmUgdGhlc2UgZWRpdG9ycyBhZnRlciBzdGF0ZSBoYXMgYmVlbiBhcHBsaWVkLlxuXG5cdFx0Y29uc3QgZ3JvdXBzID0gdGhpcy5nZXRHcm91cHMoR3JvdXBzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpO1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgZ3JvdXBzKSB7XG5cdFx0XHRhd2FpdCBncm91cC5jbG9zZUFsbEVkaXRvcnMoeyBleGNsdWRlQ29uZmlybWluZzogdHJ1ZSB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZ3JvdXBzO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0FwcGx5R3JpZFN0YXRlKGdyaWRTdGF0ZTogSVNlcmlhbGl6ZWRHcmlkLCBhY3RpdmVHcm91cElkOiBHcm91cElkZW50aWZpZXIsIGVkaXRvckdyb3VwVmlld3NUb1JldXNlPzogSUVkaXRvckdyb3VwVmlld1tdLCBvcHRpb25zPzogSUVkaXRvckdyb3VwVmlld09wdGlvbnMpOiB2b2lkIHtcblxuXHRcdC8vIFJlY3JlYXRlIGdyaWQgd2lkZ2V0IGZyb20gc3RhdGVcblx0XHR0aGlzLmRvQ3JlYXRlR3JpZENvbnRyb2xXaXRoU3RhdGUoZ3JpZFN0YXRlLCBhY3RpdmVHcm91cElkLCBlZGl0b3JHcm91cFZpZXdzVG9SZXVzZSwgb3B0aW9ucyk7XG5cblx0XHQvLyBMYXlvdXRcblx0XHR0aGlzLmRvTGF5b3V0KHRoaXMuX2NvbnRlbnREaW1lbnNpb24pO1xuXG5cdFx0Ly8gVXBkYXRlIGNvbnRhaW5lclxuXHRcdHRoaXMudXBkYXRlQ29udGFpbmVyKCk7XG5cblx0XHQvLyBFdmVudHMgZm9yIGdyb3VwcyB0aGF0IGdvdCBhZGRlZFxuXHRcdGZvciAoY29uc3QgZ3JvdXBWaWV3IG9mIHRoaXMuZ2V0R3JvdXBzKEdyb3Vwc09yZGVyLkdSSURfQVBQRUFSQU5DRSkpIHtcblx0XHRcdGlmICghZWRpdG9yR3JvdXBWaWV3c1RvUmV1c2U/LmluY2x1ZGVzKGdyb3VwVmlldykpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRBZGRHcm91cC5maXJlKGdyb3VwVmlldyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTm90aWZ5IGdyb3VwIGluZGV4IGNoYW5nZSBnaXZlbiBsYXlvdXQgaGFzIGNoYW5nZWRcblx0XHR0aGlzLm5vdGlmeUdyb3VwSW5kZXhDaGFuZ2UoKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VNZW1lbnRvU3RhdGUoZTogSVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUuZXh0ZXJuYWwgJiYgZS5zY29wZSA9PT0gU3RvcmFnZVNjb3BlLldPUktTUEFDRSkge1xuXHRcdFx0dGhpcy5yZWxvYWRNZW1lbnRvKGUuc2NvcGUpO1xuXG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMubG9hZFN0YXRlKCk7XG5cdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0dGhpcy5hcHBseVN0YXRlKHN0YXRlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR0b0pTT04oKTogb2JqZWN0IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dHlwZTogUGFydHMuRURJVE9SX1BBUlRcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBkaXNwb3NlR3JvdXBzKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgdGhpcy5ncm91cHMpIHtcblx0XHRcdGdyb3VwLmRpc3Bvc2UoKTtcblxuXHRcdFx0dGhpcy5fb25EaWRSZW1vdmVHcm91cC5maXJlKGdyb3VwKTtcblx0XHR9XG5cblx0XHR0aGlzLmdyb3VwVmlld3MuY2xlYXIoKTtcblx0XHR0aGlzLm1vc3RSZWNlbnRBY3RpdmVHcm91cHMgPSBbXTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cblx0XHQvLyBFdmVudFxuXHRcdHRoaXMuX29uV2lsbERpc3Bvc2UuZmlyZSgpO1xuXG5cdFx0Ly8gRm9yd2FyZCB0byBhbGwgZ3JvdXBzXG5cdFx0dGhpcy5kaXNwb3NlR3JvdXBzKCk7XG5cblx0XHQvLyBHcmlkIHdpZGdldFxuXHRcdHRoaXMuZ3JpZFdpZGdldD8uZGlzcG9zZSgpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG59XG5cbmV4cG9ydCBjbGFzcyBNYWluRWRpdG9yUGFydCBleHRlbmRzIEVkaXRvclBhcnQge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvclBhcnRzVmlldzogSUVkaXRvclBhcnRzVmlldyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoZWRpdG9yUGFydHNWaWV3LCBQYXJ0cy5FRElUT1JfUEFSVCwgJycsIG1haW5XaW5kb3cudnNjb2RlV2luZG93SWQsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgbGF5b3V0U2VydmljZSwgaG9zdFNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFlBQVk7QUFDckIsU0FBUyxXQUFXLEdBQUcsYUFBYSx1Q0FBdUMsV0FBVywyQkFBMkIsa0JBQWtCLHFCQUFxQjtBQUN4SixTQUFTLE9BQU8sU0FBUyxPQUFPLHdCQUF3QjtBQUN4RCxTQUFTLGdCQUFnQix3QkFBd0I7QUFDakQsU0FBUyxnQkFBZ0IsbUJBQW1CLGtCQUFzQyxnQkFBZ0IsYUFBYSxxQkFBd0k7QUFDdlAsU0FBUyw2QkFBNkI7QUFDdEMsU0FBZ0IsWUFBWSxnQkFBMkIsV0FBVyxrQkFBa0Is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
