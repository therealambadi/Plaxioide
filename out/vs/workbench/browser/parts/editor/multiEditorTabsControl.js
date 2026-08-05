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
import "./media/multieditortabscontrol.css";
import { isLinux, isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { shorten } from "../../../../base/common/labels.js";
import { EditorResourceAccessor, Verbosity, SideBySideEditor, DEFAULT_EDITOR_ASSOCIATION, EditorInputCapabilities, preventEditorClose, EditorCloseMethod, EditorsOrder } from "../../../common/editor.js";
import { computeEditorAriaLabel } from "../../editor.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { EventType as TouchEventType, Gesture } from "../../../../base/browser/touch.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { ResourceLabels, DEFAULT_LABELS_CONTAINER } from "../../labels.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { EditorCommandsContextActionRunner, EditorTabsControl } from "./editorTabsControl.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { dispose, DisposableStore, combinedDisposable, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { getOrSet } from "../../../../base/common/map.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { TAB_INACTIVE_BACKGROUND, TAB_ACTIVE_BACKGROUND, TAB_BORDER, EDITOR_DRAG_AND_DROP_BACKGROUND, TAB_UNFOCUSED_ACTIVE_BACKGROUND, TAB_UNFOCUSED_ACTIVE_BORDER, TAB_ACTIVE_BORDER, TAB_HOVER_BACKGROUND, TAB_HOVER_BORDER, TAB_UNFOCUSED_HOVER_BACKGROUND, TAB_UNFOCUSED_HOVER_BORDER, EDITOR_GROUP_HEADER_TABS_BACKGROUND, WORKBENCH_BACKGROUND, TAB_ACTIVE_BORDER_TOP, TAB_UNFOCUSED_ACTIVE_BORDER_TOP, TAB_ACTIVE_MODIFIED_BORDER, TAB_INACTIVE_MODIFIED_BORDER, TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER, TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER, TAB_UNFOCUSED_INACTIVE_BACKGROUND, TAB_HOVER_FOREGROUND, TAB_UNFOCUSED_HOVER_FOREGROUND, EDITOR_GROUP_HEADER_TABS_BORDER, TAB_LAST_PINNED_BORDER, TAB_SELECTED_BORDER_TOP } from "../../../common/theme.js";
import { activeContrastBorder, contrastBorder, editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { ResourcesDropHandler, DraggedEditorIdentifier, DraggedEditorGroupIdentifier, extractTreeDropData, isWindowDraggedOver } from "../../dnd.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { MergeGroupMode } from "../../../services/editor/common/editorGroupsService.js";
import { addDisposableListener, EventType, EventHelper, Dimension, scheduleAtNextAnimationFrame, findParentWithClass, clearNode, DragAndDropObserver, isMouseEvent, getWindow, $ } from "../../../../base/browser/dom.js";
import { localize } from "../../../../nls.js";
import { prepareMoveCopyEditors } from "./editor.js";
import { CloseEditorTabAction, UnpinEditorAction } from "./editorActions.js";
import { assertAllDefined, assertIsDefined } from "../../../../base/common/types.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { basenameOrAuthority } from "../../../../base/common/resources.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { win32, posix } from "../../../../base/common/path.js";
import { coalesce, insert } from "../../../../base/common/arrays.js";
import { isHighContrast } from "../../../../platform/theme/common/theme.js";
import { isSafari } from "../../../../base/browser/browser.js";
import { equals } from "../../../../base/common/objects.js";
import { EditorActivation } from "../../../../platform/editor/common/editor.js";
import { UNLOCK_GROUP_COMMAND_ID } from "./editorCommands.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { ITreeViewsDnDService } from "../../../../editor/common/services/treeViewsDndService.js";
import { DraggedTreeItemsIdentifier } from "../../../../editor/common/services/treeViewsDnd.js";
import { IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { StickyEditorGroupModel, UnstickyEditorGroupModel } from "../../../common/editor/filteredEditorGroupModel.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { applyDragImage } from "../../../../base/browser/ui/dnd/dnd.js";
let MultiEditorTabsControl = class extends EditorTabsControl {
  constructor(parent, editorPartsView, groupsView, groupView, tabsModel, contextMenuService, instantiationService, contextKeyService, keybindingService, notificationService, quickInputService, themeService, editorService, pathService, treeViewsDragAndDropService, editorResolverService, hostService) {
    super(parent, editorPartsView, groupsView, groupView, tabsModel, contextMenuService, instantiationService, contextKeyService, keybindingService, notificationService, quickInputService, themeService, editorResolverService, hostService);
    this.editorService = editorService;
    this.pathService = pathService;
    this.treeViewsDragAndDropService = treeViewsDragAndDropService;
    this.closeEditorAction = this._register(this.instantiationService.createInstance(CloseEditorTabAction, CloseEditorTabAction.ID, CloseEditorTabAction.LABEL));
    this.unpinEditorAction = this._register(this.instantiationService.createInstance(UnpinEditorAction, UnpinEditorAction.ID, UnpinEditorAction.LABEL));
    this.tabResourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
    this.tabLabels = [];
    this.tabActionBars = [];
    this.tabDisposables = [];
    this.dimensions = {
      container: Dimension.None,
      available: Dimension.None
    };
    this.layoutScheduler = this._register(new MutableDisposable());
    this.path = isWindows ? win32 : posix;
    this.lastMouseWheelEventTime = 0;
    this.isMouseOverTabs = false;
    this.updateEditorLabelScheduler = this._register(new RunOnceScheduler(() => this.doUpdateEditorLabels(), 0));
    (async () => this.path = await this.pathService.path)();
    this._register(this.tabResourceLabels.onDidChangeDecorations(() => this.doHandleDecorationsChange()));
  }
  create(parent) {
    super.create(parent);
    this.titleContainer = parent;
    this.tabsAndActionsContainer = $(".tabs-and-actions-container");
    this.titleContainer.appendChild(this.tabsAndActionsContainer);
    this.tabsContainer = $(".tabs-container", {
      role: "tablist",
      draggable: true
    });
    this._register(Gesture.addTarget(this.tabsContainer));
    this.tabSizingFixedDisposables = this._register(new DisposableStore());
    this.updateTabSizing(false);
    this.tabsScrollbar = this.createTabsScrollbar(this.tabsContainer);
    this.tabsAndActionsContainer.appendChild(this.tabsScrollbar.getDomNode());
    this.registerTabsContainerListeners(this.tabsContainer, this.tabsScrollbar);
    this.createEditorActionsToolBar(this.tabsAndActionsContainer, ["editor-actions"]);
    this.updateTabsControlVisibility();
    return this.tabsAndActionsContainer;
  }
  createTabsScrollbar(scrollable) {
    const tabsScrollbar = this._register(new ScrollableElement(scrollable, {
      horizontal: ScrollbarVisibility.Auto,
      horizontalScrollbarSize: this.getTabsScrollbarSizing(),
      vertical: ScrollbarVisibility.Hidden,
      scrollYToX: true,
      useShadows: false
    }));
    this._register(tabsScrollbar.onScroll((e) => {
      if (e.scrollLeftChanged) {
        scrollable.scrollLeft = e.scrollLeft;
      }
    }));
    return tabsScrollbar;
  }
  updateTabsScrollbarSizing() {
    this.tabsScrollbar?.updateOptions({
      horizontalScrollbarSize: this.getTabsScrollbarSizing()
    });
  }
  updateTabSizing(fromEvent) {
    const [tabsContainer, tabSizingFixedDisposables] = assertAllDefined(this.tabsContainer, this.tabSizingFixedDisposables);
    tabSizingFixedDisposables.clear();
    const options = this.groupsView.partOptions;
    if (options.tabSizing === "fixed") {
      tabsContainer.style.setProperty("--tab-sizing-fixed-min-width", `${options.tabSizingFixedMinWidth}px`);
      tabsContainer.style.setProperty("--tab-sizing-fixed-max-width", `${options.tabSizingFixedMaxWidth}px`);
      tabSizingFixedDisposables.add(addDisposableListener(tabsContainer, EventType.MOUSE_ENTER, () => {
        this.isMouseOverTabs = true;
      }));
      tabSizingFixedDisposables.add(addDisposableListener(tabsContainer, EventType.MOUSE_LEAVE, () => {
        this.isMouseOverTabs = false;
        this.updateTabsFixedWidth(false);
      }));
    } else if (fromEvent) {
      tabsContainer.style.removeProperty("--tab-sizing-fixed-min-width");
      tabsContainer.style.removeProperty("--tab-sizing-fixed-max-width");
      this.updateTabsFixedWidth(false);
    }
  }
  updateTabsFixedWidth(fixed) {
    this.forEachTab((editor, tabIndex, tabContainer) => {
      if (fixed) {
        const { width } = tabContainer.getBoundingClientRect();
        tabContainer.style.setProperty("--tab-sizing-current-width", `${width}px`);
      } else {
        tabContainer.style.removeProperty("--tab-sizing-current-width");
      }
    });
  }
  getTabsScrollbarSizing() {
    if (this.groupsView.partOptions.titleScrollbarSizing !== "large") {
      return MultiEditorTabsControl.SCROLLBAR_SIZES.default;
    }
    return MultiEditorTabsControl.SCROLLBAR_SIZES.large;
  }
  registerTabsContainerListeners(tabsContainer, tabsScrollbar) {
    this._register(addDisposableListener(tabsContainer, EventType.SCROLL, () => {
      if (tabsContainer.classList.contains("scroll")) {
        tabsScrollbar.setScrollPosition({
          scrollLeft: tabsContainer.scrollLeft
          // during DND the container gets scrolled so we need to update the custom scrollbar
        });
      }
    }));
    for (const eventType of [TouchEventType.Tap, EventType.DBLCLICK]) {
      this._register(addDisposableListener(tabsContainer, eventType, (e) => {
        if (eventType === EventType.DBLCLICK) {
          if (e.target !== tabsContainer) {
            return;
          }
        } else {
          if (e.tapCount !== 2) {
            return;
          }
          if (e.initialTarget !== tabsContainer) {
            return;
          }
        }
        EventHelper.stop(e);
        this.editorService.openEditor({
          resource: void 0,
          options: {
            pinned: true,
            index: this.groupView.count,
            // always at the end
            override: DEFAULT_EDITOR_ASSOCIATION.id
          }
        }, this.groupView.id);
      }));
    }
    this._register(addDisposableListener(tabsContainer, EventType.MOUSE_DOWN, (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    }));
    if (isLinux) {
      this._register(addDisposableListener(tabsContainer, EventType.MOUSE_UP, (e) => {
        if (e.button === 1) {
          e.preventDefault();
        }
      }));
    }
    let lastDragEvent = void 0;
    let isNewWindowOperation = false;
    this._register(new DragAndDropObserver(tabsContainer, {
      onDragStart: (e) => {
        isNewWindowOperation = this.onGroupDragStart(e, tabsContainer);
      },
      onDrag: (e) => {
        lastDragEvent = e;
      },
      onDragEnter: (e) => {
        tabsContainer.classList.add("scroll");
        if (e.target !== tabsContainer) {
          return;
        }
        if (!this.isSupportedDropTransfer(e)) {
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "none";
          }
          return;
        }
        if (!this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
          }
        }
        this.updateDropFeedback(tabsContainer, true, e);
      },
      onDragLeave: (e) => {
        this.updateDropFeedback(tabsContainer, false, e);
        tabsContainer.classList.remove("scroll");
      },
      onDragEnd: (e) => {
        this.updateDropFeedback(tabsContainer, false, e);
        tabsContainer.classList.remove("scroll");
        this.onGroupDragEnd(e, lastDragEvent, tabsContainer, isNewWindowOperation);
      },
      onDrop: (e) => {
        this.updateDropFeedback(tabsContainer, false, e);
        tabsContainer.classList.remove("scroll");
        if (e.target === tabsContainer) {
          const isGroupTransfer = this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype);
          this.onDrop(e, isGroupTransfer ? this.groupView.count : this.tabsModel.count, tabsContainer);
        }
      }
    }));
    this._register(addDisposableListener(tabsContainer, EventType.MOUSE_WHEEL, (e) => {
      const activeEditor = this.groupView.activeEditor;
      if (!activeEditor || this.groupView.count < 2) {
        return;
      }
      if (this.groupsView.partOptions.scrollToSwitchTabs === true) {
        if (e.shiftKey) {
          return;
        }
      } else {
        if (!e.shiftKey) {
          return;
        }
      }
      const now = Date.now();
      if (now - this.lastMouseWheelEventTime < MultiEditorTabsControl.MOUSE_WHEEL_EVENT_THRESHOLD - 2 * (Math.abs(e.deltaX) + Math.abs(e.deltaY))) {
        return;
      }
      this.lastMouseWheelEventTime = now;
      let tabSwitchDirection;
      if (e.deltaX + e.deltaY < -MultiEditorTabsControl.MOUSE_WHEEL_DISTANCE_THRESHOLD) {
        tabSwitchDirection = -1;
      } else if (e.deltaX + e.deltaY > MultiEditorTabsControl.MOUSE_WHEEL_DISTANCE_THRESHOLD) {
        tabSwitchDirection = 1;
      } else {
        return;
      }
      const nextEditor = this.groupView.getEditorByIndex(this.groupView.getIndexOfEditor(activeEditor) + tabSwitchDirection);
      if (!nextEditor) {
        return;
      }
      this.groupView.openEditor(nextEditor);
      EventHelper.stop(e, true);
    }));
    const showContextMenu = (e) => {
      EventHelper.stop(e);
      let anchor = tabsContainer;
      if (isMouseEvent(e)) {
        anchor = new StandardMouseEvent(getWindow(this.parent), e);
      }
      this.contextMenuService.showContextMenu({
        getAnchor: () => anchor,
        menuId: MenuId.EditorTabsBarContext,
        contextKeyService: this.contextKeyService,
        menuActionOptions: { shouldForwardArgs: true },
        getActionsContext: () => ({ groupId: this.groupView.id }),
        getKeyBinding: (action) => this.getKeybinding(action),
        onHide: () => this.groupView.focus()
      });
    };
    this._register(addDisposableListener(tabsContainer, TouchEventType.Contextmenu, (e) => showContextMenu(e)));
    this._register(addDisposableListener(tabsContainer, EventType.CONTEXT_MENU, (e) => showContextMenu(e)));
  }
  doHandleDecorationsChange() {
    this.layout(this.dimensions);
  }
  updateEditorActionsToolbar() {
    super.updateEditorActionsToolbar();
    this.layout(this.dimensions);
  }
  openEditor(editor, options) {
    const changed = this.handleOpenedEditors();
    if (options?.focusTabControl) {
      this.withTab(editor, (editor2, tabIndex, tabContainer) => tabContainer.focus());
    }
    return changed;
  }
  openEditors(editors) {
    return this.handleOpenedEditors();
  }
  handleOpenedEditors() {
    this.updateTabsControlVisibility();
    const [tabsContainer, tabsScrollbar] = assertAllDefined(this.tabsContainer, this.tabsScrollbar);
    for (let i = tabsContainer.children.length; i < this.tabsModel.count; i++) {
      tabsContainer.appendChild(this.createTab(i, tabsContainer, tabsScrollbar));
    }
    const activeEditorChanged = this.didActiveEditorChange();
    const oldTabLabels = this.tabLabels;
    this.computeTabLabels();
    let didChange = false;
    if (activeEditorChanged || // active editor changed
    oldTabLabels.length !== this.tabLabels.length || // number of tabs changed
    oldTabLabels.some((label, index) => !this.equalsEditorInputLabel(label, this.tabLabels.at(index)))) {
      this.redraw({ forceRevealActiveTab: true });
      didChange = true;
    } else {
      this.layout(this.dimensions, { forceRevealActiveTab: true });
    }
    return didChange;
  }
  didActiveEditorChange() {
    if (!this.activeTabLabel?.editor && this.tabsModel.activeEditor || // active editor changed from null => editor
    this.activeTabLabel?.editor && !this.tabsModel.activeEditor || // active editor changed from editor => null
    (!this.activeTabLabel?.editor || !this.tabsModel.isActive(this.activeTabLabel.editor))) {
      return true;
    }
    return false;
  }
  equalsEditorInputLabel(labelA, labelB) {
    if (labelA === labelB) {
      return true;
    }
    if (!labelA || !labelB) {
      return false;
    }
    return labelA.name === labelB.name && labelA.description === labelB.description && labelA.forceDescription === labelB.forceDescription && labelA.title === labelB.title && labelA.ariaLabel === labelB.ariaLabel;
  }
  beforeCloseEditor(editor) {
    if (this.isMouseOverTabs && this.groupsView.partOptions.tabSizing === "fixed") {
      const closingLastTab = this.tabsModel.isLast(editor);
      this.updateTabsFixedWidth(!closingLastTab);
    }
  }
  closeEditor(editor) {
    this.handleClosedEditors();
  }
  closeEditors(editors) {
    this.handleClosedEditors();
  }
  handleClosedEditors() {
    if (this.tabsModel.count) {
      const tabsContainer = assertIsDefined(this.tabsContainer);
      while (tabsContainer.children.length > this.tabsModel.count) {
        tabsContainer.lastChild?.remove();
        dispose(this.tabDisposables.pop());
      }
      this.computeTabLabels();
      this.redraw({ forceRevealActiveTab: true });
    } else {
      if (this.tabsContainer) {
        clearNode(this.tabsContainer);
      }
      this.tabDisposables = dispose(this.tabDisposables);
      this.tabResourceLabels.clear();
      this.tabLabels = [];
      this.activeTabLabel = void 0;
      this.tabActionBars = [];
      this.clearEditorActionsToolbar();
      this.updateTabsControlVisibility();
    }
  }
  moveEditor(editor, fromTabIndex, targeTabIndex) {
    const editorLabel = this.tabLabels[fromTabIndex];
    this.tabLabels.splice(fromTabIndex, 1);
    this.tabLabels.splice(targeTabIndex, 0, editorLabel);
    this.forEachTab(
      (editor2, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => {
        this.redrawTab(editor2, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar);
      },
      Math.min(fromTabIndex, targeTabIndex),
      // from: smallest of fromTabIndex/targeTabIndex
      Math.max(fromTabIndex, targeTabIndex)
      //   to: largest of fromTabIndex/targeTabIndex
    );
    this.layout(this.dimensions, { forceRevealActiveTab: true });
  }
  pinEditor(editor) {
    this.withTab(editor, (editor2, tabIndex, tabContainer, tabLabelWidget, tabLabel) => this.redrawTabLabel(editor2, tabIndex, tabContainer, tabLabelWidget, tabLabel));
  }
  stickEditor(editor) {
    this.doHandleStickyEditorChange(editor);
  }
  unstickEditor(editor) {
    this.doHandleStickyEditorChange(editor);
  }
  doHandleStickyEditorChange(editor) {
    this.withTab(editor, (editor2, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => this.redrawTab(editor2, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar));
    this.forEachTab((editor2, tabIndex, tabContainer, tabLabelWidget, tabLabel) => {
      this.redrawTabBorders(tabIndex, tabContainer);
    });
    this.layout(this.dimensions, { forceRevealActiveTab: true });
  }
  setActive(isGroupActive) {
    this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => {
      this.redrawTabSelectedActiveAndDirty(isGroupActive, editor, tabContainer, tabActionBar);
    });
    this.updateEditorActionsToolbar();
    this.layout(this.dimensions, { forceRevealActiveTab: true });
  }
  updateEditorSelections() {
    this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => {
      this.redrawTabSelectedActiveAndDirty(this.groupsView.activeGroup === this.groupView, editor, tabContainer, tabActionBar);
    });
  }
  updateEditorLabel(editor) {
    this.updateEditorLabelScheduler.schedule();
  }
  doUpdateEditorLabels() {
    this.computeTabLabels();
    this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel) => {
      this.redrawTabLabel(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel);
    });
    this.layout(this.dimensions);
  }
  updateEditorDirty(editor) {
    this.withTab(editor, (editor2, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => this.redrawTabSelectedActiveAndDirty(this.groupsView.activeGroup === this.groupView, editor2, tabContainer, tabActionBar));
  }
  updateOptions(oldOptions, newOptions) {
    super.updateOptions(oldOptions, newOptions);
    if (oldOptions.labelFormat !== newOptions.labelFormat) {
      this.computeTabLabels();
    }
    if (oldOptions.titleScrollbarSizing !== newOptions.titleScrollbarSizing) {
      this.updateTabsScrollbarSizing();
    }
    if (oldOptions.alwaysShowEditorActions !== newOptions.alwaysShowEditorActions) {
      this.updateEditorActionsToolbar();
    }
    if (oldOptions.tabSizingFixedMinWidth !== newOptions.tabSizingFixedMinWidth || oldOptions.tabSizingFixedMaxWidth !== newOptions.tabSizingFixedMaxWidth || oldOptions.tabSizing !== newOptions.tabSizing) {
      this.updateTabSizing(true);
    }
    if (oldOptions.labelFormat !== newOptions.labelFormat || oldOptions.tabActionLocation !== newOptions.tabActionLocation || oldOptions.tabActionCloseVisibility !== newOptions.tabActionCloseVisibility || oldOptions.tabActionUnpinVisibility !== newOptions.tabActionUnpinVisibility || oldOptions.tabSizing !== newOptions.tabSizing || oldOptions.pinnedTabSizing !== newOptions.pinnedTabSizing || oldOptions.showIcons !== newOptions.showIcons || oldOptions.hasIcons !== newOptions.hasIcons || oldOptions.highlightModifiedTabs !== newOptions.highlightModifiedTabs || oldOptions.wrapTabs !== newOptions.wrapTabs || !equals(oldOptions.decorations, newOptions.decorations)) {
      this.redraw();
    }
  }
  updateStyles() {
    this.redraw();
  }
  forEachTab(fn, fromTabIndex, toTabIndex) {
    this.tabsModel.getEditors(EditorsOrder.SEQUENTIAL).forEach((editor, tabIndex) => {
      if (typeof fromTabIndex === "number" && fromTabIndex > tabIndex) {
        return;
      }
      if (typeof toTabIndex === "number" && toTabIndex < tabIndex) {
        return;
      }
      this.doWithTab(tabIndex, editor, fn);
    });
  }
  withTab(editor, fn) {
    this.doWithTab(this.tabsModel.indexOf(editor), editor, fn);
  }
  doWithTab(tabIndex, editor, fn) {
    const tabsContainer = assertIsDefined(this.tabsContainer);
    const tabContainer = tabsContainer.children[tabIndex];
    const tabResourceLabel = this.tabResourceLabels.get(tabIndex);
    const tabLabel = this.tabLabels[tabIndex];
    const tabActionBar = this.tabActionBars[tabIndex];
    if (tabContainer && tabResourceLabel && tabLabel) {
      fn(editor, tabIndex, tabContainer, tabResourceLabel, tabLabel, tabActionBar);
    }
  }
  createTab(tabIndex, tabsContainer, tabsScrollbar) {
    const tabContainer = $(".tab", {
      draggable: true,
      role: "tab"
    });
    this._register(Gesture.addTarget(tabContainer));
    const tabBorderTopContainer = $(".tab-border-top-container");
    tabContainer.appendChild(tabBorderTopContainer);
    const editorLabel = this.tabResourceLabels.create(tabContainer, { hoverTargetOverride: tabContainer });
    const tabActionsContainer = $(".tab-actions");
    tabContainer.appendChild(tabActionsContainer);
    const that = this;
    const tabActionRunner = new EditorCommandsContextActionRunner({
      groupId: this.groupView.id,
      get editorIndex() {
        return that.toEditorIndex(tabIndex);
      }
    });
    const tabActionBar = new ActionBar(tabActionsContainer, { ariaLabel: localize("ariaLabelTabActions", "Tab actions"), actionRunner: tabActionRunner });
    const tabActionListener = tabActionBar.onWillRun((e) => {
      if (e.action.id === this.closeEditorAction.id) {
        this.blockRevealActiveTabOnce();
      }
    });
    const tabActionBarDisposable = combinedDisposable(tabActionRunner, tabActionBar, tabActionListener, toDisposable(insert(this.tabActionBars, tabActionBar)));
    const tabShadowHider = $(".tab-fade-hider");
    tabContainer.appendChild(tabShadowHider);
    const tabBorderBottomContainer = $(".tab-border-bottom-container");
    tabContainer.appendChild(tabBorderBottomContainer);
    const eventsDisposable = this.registerTabListeners(tabContainer, tabIndex, tabsContainer, tabsScrollbar);
    this.tabDisposables.push(combinedDisposable(eventsDisposable, tabActionBarDisposable, tabActionRunner, editorLabel));
    return tabContainer;
  }
  toEditorIndex(tabIndex) {
    const editor = assertIsDefined(this.tabsModel.getEditorByIndex(tabIndex));
    return this.groupView.getIndexOfEditor(editor);
  }
  registerTabListeners(tab, tabIndex, tabsContainer, tabsScrollbar) {
    const disposables = new DisposableStore();
    const handleClickOrTouch = async (e, preserveFocus) => {
      tab.blur();
      if (isMouseEvent(e) && (e.button !== 0 || isMacintosh && e.ctrlKey)) {
        if (e.button === 1) {
          e.preventDefault();
        }
        return;
      }
      if (this.originatesFromTabActionBar(e)) {
        return;
      }
      const editor = this.tabsModel.getEditorByIndex(tabIndex);
      if (editor) {
        if (e.shiftKey) {
          let anchor;
          if (this.lastSingleSelectSelectedEditor && this.tabsModel.isSelected(this.lastSingleSelectSelectedEditor)) {
            anchor = this.lastSingleSelectSelectedEditor;
          } else {
            const activeEditor = assertIsDefined(this.groupView.activeEditor);
            this.lastSingleSelectSelectedEditor = activeEditor;
            anchor = activeEditor;
          }
          await this.selectEditorsBetween(editor, anchor);
        } else if (e.ctrlKey && !isMacintosh || e.metaKey && isMacintosh) {
          if (this.tabsModel.isSelected(editor)) {
            await this.unselectEditor(editor);
          } else {
            await this.selectEditor(editor);
            this.lastSingleSelectSelectedEditor = editor;
          }
        } else {
          const inactiveSelection = this.tabsModel.isSelected(editor) ? this.groupView.selectedEditors.filter((e2) => !e2.matches(editor)) : [];
          await this.groupView.openEditor(editor, { preserveFocus, activation: EditorActivation.ACTIVATE }, { inactiveSelection, focusTabControl: true });
        }
      }
    };
    const showContextMenu = (e) => {
      EventHelper.stop(e);
      const editor = this.tabsModel.getEditorByIndex(tabIndex);
      if (editor) {
        this.onTabContextMenu(editor, e, tab);
      }
    };
    disposables.add(addDisposableListener(tab, EventType.MOUSE_DOWN, (e) => handleClickOrTouch(e, false)));
    disposables.add(addDisposableListener(tab, TouchEventType.Tap, (e) => handleClickOrTouch(e, true)));
    disposables.add(addDisposableListener(tab, TouchEventType.Change, (e) => {
      tabsScrollbar.setScrollPosition({ scrollLeft: tabsScrollbar.getScrollPosition().scrollLeft - e.translationX });
    }));
    disposables.add(addDisposableListener(tab, EventType.MOUSE_UP, async (e) => {
      EventHelper.stop(e);
      tab.blur();
      if (isMouseEvent(e) && (e.button !== 0 || isMacintosh && e.ctrlKey)) {
        return;
      }
      if (this.originatesFromTabActionBar(e)) {
        return;
      }
      const isCtrlCmd = e.ctrlKey && !isMacintosh || e.metaKey && isMacintosh;
      if (!isCtrlCmd && !e.shiftKey && this.groupView.selectedEditors.length > 1) {
        await this.unselectAllEditors();
      }
    }));
    disposables.add(addDisposableListener(tab, EventType.AUXCLICK, (e) => {
      if (e.button === 1) {
        EventHelper.stop(
          e,
          true
          /* for https://github.com/microsoft/vscode/issues/56715 */
        );
        const editor = this.tabsModel.getEditorByIndex(tabIndex);
        if (editor) {
          if (preventEditorClose(this.tabsModel, editor, EditorCloseMethod.MOUSE, this.groupsView.partOptions)) {
            return;
          }
          this.blockRevealActiveTabOnce();
          this.closeEditorAction.run({ groupId: this.groupView.id, editorIndex: this.groupView.getIndexOfEditor(editor) });
        }
      }
    }));
    disposables.add(addDisposableListener(tab, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.shiftKey && event.keyCode === KeyCode.F10) {
        showContextMenu(e);
      }
    }));
    disposables.add(addDisposableListener(tab, TouchEventType.Contextmenu, (e) => {
      showContextMenu(e);
    }));
    disposables.add(addDisposableListener(tab, EventType.KEY_UP, (e) => {
      const event = new StandardKeyboardEvent(e);
      let handled = false;
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        handled = true;
        const editor = this.tabsModel.getEditorByIndex(tabIndex);
        if (editor) {
          this.groupView.openEditor(editor);
        }
      } else if ([KeyCode.LeftArrow, KeyCode.RightArrow, KeyCode.UpArrow, KeyCode.DownArrow, KeyCode.Home, KeyCode.End].some((kb) => event.equals(kb))) {
        let editorIndex = this.toEditorIndex(tabIndex);
        if (event.equals(KeyCode.LeftArrow) || event.equals(KeyCode.UpArrow)) {
          editorIndex = editorIndex - 1;
        } else if (event.equals(KeyCode.RightArrow) || event.equals(KeyCode.DownArrow)) {
          editorIndex = editorIndex + 1;
        } else if (event.equals(KeyCode.Home)) {
          editorIndex = 0;
        } else {
          editorIndex = this.groupView.count - 1;
        }
        const target = this.groupView.getEditorByIndex(editorIndex);
        if (target) {
          handled = true;
          this.groupView.openEditor(target, { preserveFocus: true }, { focusTabControl: true });
        }
      }
      if (handled) {
        EventHelper.stop(e, true);
      }
      tabsScrollbar.setScrollPosition({
        scrollLeft: tabsContainer.scrollLeft
      });
    }));
    for (const eventType of [TouchEventType.Tap, EventType.DBLCLICK]) {
      disposables.add(addDisposableListener(tab, eventType, (e) => {
        if (eventType === EventType.DBLCLICK) {
          EventHelper.stop(e);
        } else if (e.tapCount !== 2) {
          return;
        }
        const editor = this.tabsModel.getEditorByIndex(tabIndex);
        if (editor && this.tabsModel.isPinned(editor)) {
          switch (this.groupsView.partOptions.doubleClickTabToToggleEditorGroupSizes) {
            case "maximize":
              this.groupsView.toggleMaximizeGroup(this.groupView);
              break;
            case "expand":
              this.groupsView.toggleExpandGroup(this.groupView);
              break;
            case "off":
              break;
          }
        } else {
          this.groupView.pinEditor(editor);
        }
      }));
    }
    disposables.add(addDisposableListener(
      tab,
      EventType.CONTEXT_MENU,
      (e) => {
        EventHelper.stop(e, true);
        const editor = this.tabsModel.getEditorByIndex(tabIndex);
        if (editor) {
          this.onTabContextMenu(editor, e, tab);
        }
      },
      true
      /* use capture to fix https://github.com/microsoft/vscode/issues/19145 */
    ));
    let lastDragEvent = void 0;
    let isNewWindowOperation = false;
    disposables.add(new DragAndDropObserver(tab, {
      onDragStart: (e) => {
        const editor = this.tabsModel.getEditorByIndex(tabIndex);
        if (!editor) {
          return;
        }
        isNewWindowOperation = this.isNewWindowOperation(e);
        const selectedEditors = this.groupView.selectedEditors;
        this.editorTransfer.setData(selectedEditors.map((e2) => new DraggedEditorIdentifier({ editor: e2, groupId: this.groupView.id })), DraggedEditorIdentifier.prototype);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "copyMove";
          if (selectedEditors.length > 1) {
            const label = `${editor.getName()} + ${selectedEditors.length - 1}`;
            applyDragImage(e, tab, label);
          } else {
            e.dataTransfer.setDragImage(tab, 0, 0);
          }
        }
        this.doFillResourceDataTransfers(selectedEditors, e, isNewWindowOperation);
        scheduleAtNextAnimationFrame(getWindow(this.parent), () => this.updateDropFeedback(tab, false, e, tabIndex));
      },
      onDrag: (e) => {
        lastDragEvent = e;
      },
      onDragEnter: (e) => {
        if (!this.isSupportedDropTransfer(e)) {
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "none";
          }
          return;
        }
        if (!this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
          }
        }
        this.updateDropFeedback(tab, true, e, tabIndex);
      },
      onDragOver: (e, dragDuration) => {
        if (dragDuration >= MultiEditorTabsControl.DRAG_OVER_OPEN_TAB_THRESHOLD) {
          const draggedOverTab = this.tabsModel.getEditorByIndex(tabIndex);
          if (draggedOverTab && this.tabsModel.activeEditor !== draggedOverTab) {
            this.groupView.openEditor(draggedOverTab, { preserveFocus: true });
          }
        }
        this.updateDropFeedback(tab, true, e, tabIndex);
      },
      onDragEnd: async (e) => {
        this.updateDropFeedback(tab, false, e, tabIndex);
        const draggedEditors = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
        this.editorTransfer.clearData(DraggedEditorIdentifier.prototype);
        if (!isNewWindowOperation || isWindowDraggedOver() || !draggedEditors || draggedEditors.length === 0) {
          return;
        }
        const auxiliaryEditorPart = await this.maybeCreateAuxiliaryEditorPartAt(e, tab);
        if (!auxiliaryEditorPart) {
          return;
        }
        const targetGroup = auxiliaryEditorPart.activeGroup;
        const editorsWithOptions = prepareMoveCopyEditors(this.groupView, draggedEditors.map((editor) => editor.identifier.editor));
        if (this.isMoveOperation(lastDragEvent ?? e, targetGroup.id, draggedEditors[0].identifier.editor)) {
          this.groupView.moveEditors(editorsWithOptions, targetGroup);
        } else {
          this.groupView.copyEditors(editorsWithOptions, targetGroup);
        }
        targetGroup.focus();
      },
      onDrop: (e) => {
        this.updateDropFeedback(tab, false, e, tabIndex);
        let targetIndex = tabIndex;
        if (this.getTabDragOverLocation(e, tab) === "right") {
          targetIndex++;
        }
        this.onDrop(e, targetIndex, tabsContainer);
      }
    }));
    return disposables;
  }
  isSupportedDropTransfer(e) {
    if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
      const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const group = data[0];
        if (group.identifier === this.groupView.id) {
          return false;
        }
      }
      return true;
    }
    if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
      return true;
    }
    if (e.dataTransfer && e.dataTransfer.types.length > 0) {
      return true;
    }
    return false;
  }
  updateDropFeedback(element, isDND, e, tabIndex) {
    const isTab = typeof tabIndex === "number";
    let dropTarget;
    if (isDND) {
      if (isTab) {
        dropTarget = this.computeDropTarget(e, tabIndex, element);
      } else {
        dropTarget = { leftElement: element.lastElementChild, rightElement: void 0 };
      }
    } else {
      dropTarget = void 0;
    }
    this.updateDropTarget(dropTarget);
  }
  updateDropTarget(newTarget) {
    const oldTargets = this.dropTarget;
    if (oldTargets === newTarget || oldTargets && newTarget && oldTargets.leftElement === newTarget.leftElement && oldTargets.rightElement === newTarget.rightElement) {
      return;
    }
    const dropClassLeft = "drop-target-left";
    const dropClassRight = "drop-target-right";
    if (oldTargets) {
      oldTargets.leftElement?.classList.remove(dropClassLeft);
      oldTargets.rightElement?.classList.remove(dropClassRight);
    }
    if (newTarget) {
      newTarget.leftElement?.classList.add(dropClassLeft);
      newTarget.rightElement?.classList.add(dropClassRight);
    }
    this.dropTarget = newTarget;
  }
  getTabDragOverLocation(e, tab) {
    const rect = tab.getBoundingClientRect();
    const offsetXRelativeToParent = e.clientX - rect.left;
    return offsetXRelativeToParent <= rect.width / 2 ? "left" : "right";
  }
  computeDropTarget(e, tabIndex, targetTab) {
    const isLeftSideOfTab = this.getTabDragOverLocation(e, targetTab) === "left";
    const isLastTab = tabIndex === this.tabsModel.count - 1;
    const isFirstTab = tabIndex === 0;
    if (isLeftSideOfTab && isFirstTab) {
      return { leftElement: void 0, rightElement: targetTab };
    }
    if (!isLeftSideOfTab && isLastTab) {
      return { leftElement: targetTab, rightElement: void 0 };
    }
    const tabBefore = isLeftSideOfTab ? targetTab.previousElementSibling : targetTab;
    const tabAfter = isLeftSideOfTab ? targetTab : targetTab.nextElementSibling;
    return { leftElement: tabBefore, rightElement: tabAfter };
  }
  async selectEditor(editor) {
    if (this.groupView.isActive(editor)) {
      return;
    }
    await this.groupView.setSelection(editor, this.groupView.selectedEditors);
  }
  async selectEditorsBetween(target, anchor) {
    const editorIndex = this.groupView.getIndexOfEditor(target);
    if (editorIndex === -1) {
      throw new BugIndicatingError();
    }
    const anchorEditorIndex = this.groupView.getIndexOfEditor(anchor);
    if (anchorEditorIndex === -1) {
      throw new BugIndicatingError();
    }
    let selection = this.groupView.selectedEditors;
    let currentEditorIndex = anchorEditorIndex;
    while (currentEditorIndex >= 0 && currentEditorIndex <= this.groupView.count - 1) {
      currentEditorIndex = anchorEditorIndex < editorIndex ? currentEditorIndex - 1 : currentEditorIndex + 1;
      const currentEditor = this.groupView.getEditorByIndex(currentEditorIndex);
      if (!currentEditor) {
        break;
      }
      if (!this.groupView.isSelected(currentEditor)) {
        break;
      }
      selection = selection.filter((editor) => !editor.matches(currentEditor));
    }
    const fromEditorIndex = anchorEditorIndex < editorIndex ? anchorEditorIndex : editorIndex;
    const toEditorIndex = anchorEditorIndex < editorIndex ? editorIndex : anchorEditorIndex;
    const editorsToSelect = this.groupView.getEditors(EditorsOrder.SEQUENTIAL).slice(fromEditorIndex, toEditorIndex + 1);
    for (const editor of editorsToSelect) {
      if (!this.groupView.isSelected(editor)) {
        selection.push(editor);
      }
    }
    const inactiveSelectedEditors = selection.filter((editor) => !editor.matches(target));
    await this.groupView.setSelection(target, inactiveSelectedEditors);
  }
  async unselectEditor(editor) {
    const isUnselectingActiveEditor = this.groupView.isActive(editor);
    if (isUnselectingActiveEditor && this.groupView.selectedEditors.length === 1) {
      return;
    }
    let newActiveEditor = assertIsDefined(this.groupView.activeEditor);
    if (isUnselectingActiveEditor) {
      const recentEditors = this.groupView.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
      for (let i = 1; i < recentEditors.length; i++) {
        const recentEditor = recentEditors[i];
        if (this.groupView.isSelected(recentEditor)) {
          newActiveEditor = recentEditor;
          break;
        }
      }
    }
    const inactiveSelectedEditors = this.groupView.selectedEditors.filter((e) => !e.matches(editor) && !e.matches(newActiveEditor));
    await this.groupView.setSelection(newActiveEditor, inactiveSelectedEditors);
  }
  async unselectAllEditors() {
    if (this.groupView.selectedEditors.length > 1) {
      const activeEditor = assertIsDefined(this.groupView.activeEditor);
      await this.groupView.setSelection(activeEditor, []);
    }
  }
  computeTabLabels() {
    const { labelFormat } = this.groupsView.partOptions;
    const { verbosity, shortenDuplicates } = this.getLabelConfigFlags(labelFormat);
    const labels = [];
    let activeEditorTabIndex = -1;
    this.tabsModel.getEditors(EditorsOrder.SEQUENTIAL).forEach((editor, tabIndex) => {
      labels.push({
        editor,
        name: editor.getName(),
        description: editor.getDescription(verbosity),
        forceDescription: editor.hasCapability(EditorInputCapabilities.ForceDescription),
        title: editor.getTitle(Verbosity.LONG),
        ariaLabel: computeEditorAriaLabel(editor, tabIndex, this.groupView, this.editorPartsView.count)
      });
      if (editor === this.tabsModel.activeEditor) {
        activeEditorTabIndex = tabIndex;
      }
    });
    if (shortenDuplicates) {
      this.shortenTabLabels(labels);
    }
    this.tabLabels = labels;
    this.activeTabLabel = labels[activeEditorTabIndex];
  }
  shortenTabLabels(labels) {
    const mapNameToDuplicates = /* @__PURE__ */ new Map();
    for (const label of labels) {
      if (typeof label.description === "string") {
        getOrSet(mapNameToDuplicates, label.name, []).push(label);
      } else {
        label.description = "";
      }
    }
    for (const [, duplicateLabels] of mapNameToDuplicates) {
      if (duplicateLabels.length === 1 && !duplicateLabels[0].forceDescription) {
        duplicateLabels[0].description = "";
        continue;
      }
      const mapDescriptionToDuplicates = /* @__PURE__ */ new Map();
      for (const duplicateLabel of duplicateLabels) {
        getOrSet(mapDescriptionToDuplicates, duplicateLabel.description, []).push(duplicateLabel);
      }
      let useLongDescriptions = false;
      for (const [, duplicateLabels2] of mapDescriptionToDuplicates) {
        if (!useLongDescriptions && duplicateLabels2.length > 1) {
          const [first, ...rest] = duplicateLabels2.map(({ editor }) => editor.getDescription(Verbosity.LONG));
          useLongDescriptions = rest.some((description) => description !== first);
        }
      }
      if (useLongDescriptions) {
        mapDescriptionToDuplicates.clear();
        for (const duplicateLabel of duplicateLabels) {
          duplicateLabel.description = duplicateLabel.editor.getDescription(Verbosity.LONG);
          getOrSet(mapDescriptionToDuplicates, duplicateLabel.description, []).push(duplicateLabel);
        }
      }
      const descriptions = [];
      for (const [description] of mapDescriptionToDuplicates) {
        descriptions.push(description);
      }
      if (descriptions.length === 1) {
        for (const label of mapDescriptionToDuplicates.get(descriptions[0]) || []) {
          if (!label.forceDescription) {
            label.description = "";
          }
        }
        continue;
      }
      const shortenedDescriptions = shorten(descriptions, this.path.sep);
      descriptions.forEach((description, tabIndex) => {
        for (const label of mapDescriptionToDuplicates.get(description) || []) {
          label.description = shortenedDescriptions[tabIndex];
        }
      });
    }
  }
  getLabelConfigFlags(value) {
    switch (value) {
      case "short":
        return { verbosity: Verbosity.SHORT, shortenDuplicates: false };
      case "medium":
        return { verbosity: Verbosity.MEDIUM, shortenDuplicates: false };
      case "long":
        return { verbosity: Verbosity.LONG, shortenDuplicates: false };
      default:
        return { verbosity: Verbosity.MEDIUM, shortenDuplicates: true };
    }
  }
  redraw(options) {
    if (this.tabsAndActionsContainer) {
      let tabsContainerBorderColor = this.getColor(EDITOR_GROUP_HEADER_TABS_BORDER);
      if (!tabsContainerBorderColor && isHighContrast(this.theme.type)) {
        tabsContainerBorderColor = this.getColor(TAB_BORDER) || this.getColor(contrastBorder);
      }
      if (tabsContainerBorderColor) {
        this.tabsAndActionsContainer.classList.add("tabs-border-bottom");
        this.tabsAndActionsContainer.style.setProperty("--tabs-border-bottom-color", tabsContainerBorderColor.toString());
      } else {
        this.tabsAndActionsContainer.classList.remove("tabs-border-bottom");
        this.tabsAndActionsContainer.style.removeProperty("--tabs-border-bottom-color");
      }
    }
    this.forEachTab((editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) => {
      this.redrawTab(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar);
    });
    this.updateEditorActionsToolbar();
    this.layout(this.dimensions, options);
  }
  redrawTab(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel, tabActionBar) {
    const isTabSticky = this.tabsModel.isSticky(tabIndex);
    const options = this.groupsView.partOptions;
    this.redrawTabLabel(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel);
    const hasUnpinAction = isTabSticky && options.tabActionUnpinVisibility;
    const hasCloseAction = !hasUnpinAction && options.tabActionCloseVisibility;
    const hasAction = hasUnpinAction || hasCloseAction;
    let tabAction;
    if (hasAction) {
      tabAction = hasUnpinAction ? this.unpinEditorAction : this.closeEditorAction;
    } else {
      tabAction = isTabSticky ? this.unpinEditorAction : this.closeEditorAction;
    }
    if (!tabActionBar.hasAction(tabAction)) {
      if (!tabActionBar.isEmpty()) {
        tabActionBar.clear();
      }
      tabActionBar.push(tabAction, { icon: true, label: false, keybinding: this.getKeybindingLabel(tabAction) });
    }
    tabContainer.classList.toggle(`pinned-action-off`, isTabSticky && !hasUnpinAction);
    tabContainer.classList.toggle(`close-action-off`, !hasUnpinAction && !hasCloseAction);
    for (const option of ["left", "right"]) {
      tabContainer.classList.toggle(`tab-actions-${option}`, hasAction && options.tabActionLocation === option);
    }
    const tabSizing = isTabSticky && options.pinnedTabSizing === "shrink" ? "shrink" : options.tabSizing;
    for (const option of ["fit", "shrink", "fixed"]) {
      tabContainer.classList.toggle(`sizing-${option}`, tabSizing === option);
    }
    tabContainer.classList.toggle("has-icon", options.showIcons && options.hasIcons);
    tabContainer.classList.toggle("sticky", isTabSticky);
    for (const option of ["normal", "compact", "shrink"]) {
      tabContainer.classList.toggle(`sticky-${option}`, isTabSticky && options.pinnedTabSizing === option);
    }
    if (!options.wrapTabs && isTabSticky && options.pinnedTabSizing !== "normal") {
      let stickyTabWidth = 0;
      switch (options.pinnedTabSizing) {
        case "compact":
          stickyTabWidth = MultiEditorTabsControl.TAB_WIDTH.compact;
          break;
        case "shrink":
          stickyTabWidth = MultiEditorTabsControl.TAB_WIDTH.shrink;
          break;
      }
      tabContainer.style.left = `${tabIndex * stickyTabWidth}px`;
    } else {
      tabContainer.style.left = "auto";
    }
    this.redrawTabBorders(tabIndex, tabContainer);
    this.redrawTabSelectedActiveAndDirty(this.groupsView.activeGroup === this.groupView, editor, tabContainer, tabActionBar);
  }
  redrawTabLabel(editor, tabIndex, tabContainer, tabLabelWidget, tabLabel) {
    const options = this.groupsView.partOptions;
    let name;
    let forceLabel = false;
    let fileDecorationBadges = Boolean(options.decorations?.badges);
    const fileDecorationColors = Boolean(options.decorations?.colors);
    let description;
    if (options.pinnedTabSizing === "compact" && this.tabsModel.isSticky(tabIndex)) {
      const isShowingIcons = options.showIcons && options.hasIcons;
      name = isShowingIcons ? "" : tabLabel.name?.charAt(0).toUpperCase();
      description = "";
      forceLabel = true;
      fileDecorationBadges = false;
    } else {
      name = tabLabel.name;
      description = tabLabel.description || "";
    }
    if (tabLabel.ariaLabel) {
      tabContainer.setAttribute("aria-label", tabLabel.ariaLabel);
      tabContainer.setAttribute("aria-description", "");
    }
    tabLabelWidget.setResource(
      { name, description, resource: EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.BOTH }) },
      {
        title: this.getHoverTitle(editor),
        extraClasses: coalesce(["tab-label", fileDecorationBadges ? "tab-label-has-badge" : void 0].concat(editor.getLabelExtraClasses())),
        italic: !this.tabsModel.isPinned(editor),
        forceLabel,
        fileDecorations: {
          colors: fileDecorationColors,
          badges: fileDecorationBadges
        },
        icon: editor.getIcon(),
        hideIcon: options.showIcons === false
      }
    );
    const resource = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (resource) {
      tabContainer.setAttribute("data-resource-name", basenameOrAuthority(resource));
    } else {
      tabContainer.removeAttribute("data-resource-name");
    }
  }
  redrawTabSelectedActiveAndDirty(isGroupActive, editor, tabContainer, tabActionBar) {
    const isTabActive = this.tabsModel.isActive(editor);
    const hasModifiedBorderTop = this.doRedrawTabDirty(isGroupActive, isTabActive, editor, tabContainer);
    this.doRedrawTabActive(isGroupActive, !hasModifiedBorderTop, editor, tabContainer, tabActionBar);
  }
  doRedrawTabActive(isGroupActive, allowBorderTop, editor, tabContainer, tabActionBar) {
    const isActive = this.tabsModel.isActive(editor);
    const isSelected = this.tabsModel.isSelected(editor);
    tabContainer.classList.toggle("active", isActive);
    tabContainer.classList.toggle("selected", isSelected);
    tabContainer.setAttribute("aria-selected", isActive ? "true" : "false");
    tabContainer.tabIndex = isActive ? 0 : -1;
    tabActionBar.setFocusable(isActive);
    if (isActive) {
      const activeTabBorderColorBottom = this.getColor(isGroupActive ? TAB_ACTIVE_BORDER : TAB_UNFOCUSED_ACTIVE_BORDER);
      tabContainer.classList.toggle("tab-border-bottom", !!activeTabBorderColorBottom);
      tabContainer.style.setProperty("--tab-border-bottom-color", activeTabBorderColorBottom ?? "");
    }
    let tabBorderColorTop = null;
    if (allowBorderTop) {
      if (isActive) {
        tabBorderColorTop = this.getColor(isGroupActive ? TAB_ACTIVE_BORDER_TOP : TAB_UNFOCUSED_ACTIVE_BORDER_TOP);
      }
      if (tabBorderColorTop === null && isSelected) {
        tabBorderColorTop = this.getColor(TAB_SELECTED_BORDER_TOP);
      }
    }
    tabContainer.classList.toggle("tab-border-top", !!tabBorderColorTop);
    tabContainer.style.setProperty("--tab-border-top-color", tabBorderColorTop ?? "");
  }
  doRedrawTabDirty(isGroupActive, isTabActive, editor, tabContainer) {
    let hasModifiedBorderColor = false;
    if (editor.isDirty() && !editor.isSaving()) {
      tabContainer.classList.add("dirty");
      if (this.groupsView.partOptions.highlightModifiedTabs) {
        let modifiedBorderColor;
        if (isGroupActive && isTabActive) {
          modifiedBorderColor = this.getColor(TAB_ACTIVE_MODIFIED_BORDER);
        } else if (isGroupActive && !isTabActive) {
          modifiedBorderColor = this.getColor(TAB_INACTIVE_MODIFIED_BORDER);
        } else if (!isGroupActive && isTabActive) {
          modifiedBorderColor = this.getColor(TAB_UNFOCUSED_ACTIVE_MODIFIED_BORDER);
        } else {
          modifiedBorderColor = this.getColor(TAB_UNFOCUSED_INACTIVE_MODIFIED_BORDER);
        }
        if (modifiedBorderColor) {
          hasModifiedBorderColor = true;
          tabContainer.classList.add("dirty-border-top");
          tabContainer.style.setProperty("--tab-dirty-border-top-color", modifiedBorderColor);
        }
      } else {
        tabContainer.classList.remove("dirty-border-top");
        tabContainer.style.removeProperty("--tab-dirty-border-top-color");
      }
    } else {
      tabContainer.classList.remove("dirty", "dirty-border-top");
      tabContainer.style.removeProperty("--tab-dirty-border-top-color");
    }
    return hasModifiedBorderColor;
  }
  redrawTabBorders(tabIndex, tabContainer) {
    const isTabSticky = this.tabsModel.isSticky(tabIndex);
    const isTabLastSticky = isTabSticky && this.tabsModel.stickyCount === tabIndex + 1;
    const showLastStickyTabBorderColor = this.tabsModel.stickyCount !== this.tabsModel.count;
    const borderRightColor = (isTabLastSticky && showLastStickyTabBorderColor ? this.getColor(TAB_LAST_PINNED_BORDER) : void 0) || this.getColor(TAB_BORDER) || this.getColor(contrastBorder);
    tabContainer.style.borderRight = borderRightColor ? `1px solid ${borderRightColor}` : "";
    tabContainer.style.outlineColor = this.getColor(activeContrastBorder) || "";
  }
  prepareEditorActions(editorActions) {
    const isGroupActive = this.groupsView.activeGroup === this.groupView;
    if (isGroupActive) {
      return editorActions;
    } else {
      return {
        primary: this.groupsView.partOptions.alwaysShowEditorActions ? editorActions.primary : editorActions.primary.filter((action) => action.id === UNLOCK_GROUP_COMMAND_ID),
        secondary: editorActions.secondary
      };
    }
  }
  getHeight() {
    if (this.dimensions.used) {
      return this.dimensions.used.height;
    } else {
      return this.computeHeight();
    }
  }
  computeHeight() {
    let height;
    if (!this.visible) {
      height = 0;
    } else if (this.groupsView.partOptions.wrapTabs && this.tabsAndActionsContainer?.classList.contains("wrapping")) {
      height = this.tabsAndActionsContainer.offsetHeight;
    } else {
      height = this.tabHeight;
    }
    return height;
  }
  layout(dimensions, options) {
    Object.assign(this.dimensions, dimensions);
    if (this.visible) {
      if (!this.layoutScheduler.value) {
        const disposable = scheduleAtNextAnimationFrame(getWindow(this.parent), () => {
          this.doLayout(
            this.dimensions,
            this.layoutScheduler.value?.options
            /* ensure to pick up latest options */
          );
          this.layoutScheduler.clear();
        });
        this.layoutScheduler.value = { options, dispose: () => disposable.dispose() };
      }
      if (options?.forceRevealActiveTab) {
        this.layoutScheduler.value.options = {
          ...this.layoutScheduler.value.options,
          forceRevealActiveTab: true
        };
      }
    }
    if (!this.dimensions.used) {
      this.dimensions.used = new Dimension(dimensions.container.width, this.computeHeight());
    }
    return this.dimensions.used;
  }
  doLayout(dimensions, options) {
    if (dimensions.container !== Dimension.None && dimensions.available !== Dimension.None) {
      this.doLayoutTabs(dimensions, options);
    }
    const oldDimension = this.dimensions.used;
    const newDimension = this.dimensions.used = new Dimension(dimensions.container.width, this.computeHeight());
    if (oldDimension && oldDimension.height !== newDimension.height) {
      this.groupView.relayout();
    }
  }
  doLayoutTabs(dimensions, options) {
    const tabsWrapMultiLine = this.doLayoutTabsWrapping(dimensions);
    if (!tabsWrapMultiLine) {
      this.doLayoutTabsNonWrapping(options);
    }
  }
  doLayoutTabsWrapping(dimensions) {
    const [tabsAndActionsContainer, tabsContainer, editorToolbarContainer, tabsScrollbar] = assertAllDefined(this.tabsAndActionsContainer, this.tabsContainer, this.editorActionsToolbarContainer, this.tabsScrollbar);
    const didTabsWrapMultiLine = tabsAndActionsContainer.classList.contains("wrapping");
    let tabsWrapMultiLine = didTabsWrapMultiLine;
    function updateTabsWrapping(enabled) {
      tabsWrapMultiLine = enabled;
      tabsAndActionsContainer.classList.toggle("wrapping", tabsWrapMultiLine);
      tabsContainer.style.setProperty("--last-tab-margin-right", tabsWrapMultiLine ? `${editorToolbarContainer.offsetWidth}px` : "0");
      for (const tab of tabsContainer.children) {
        tab.classList.remove("last-in-row");
      }
    }
    if (this.groupsView.partOptions.wrapTabs) {
      const visibleTabsWidth = tabsContainer.offsetWidth;
      const allTabsWidth = tabsContainer.scrollWidth;
      const lastTabFitsWrapped = () => {
        const lastTab = this.getLastTab();
        if (!lastTab) {
          return true;
        }
        const lastTabOverlapWithToolbarWidth = lastTab.offsetWidth + editorToolbarContainer.offsetWidth - dimensions.available.width;
        if (lastTabOverlapWithToolbarWidth > 1) {
          return false;
        }
        return true;
      };
      if (tabsWrapMultiLine || allTabsWidth > visibleTabsWidth && lastTabFitsWrapped()) {
        updateTabsWrapping(true);
      }
      if (tabsWrapMultiLine) {
        if (tabsContainer.offsetHeight > dimensions.available.height || // if height exceeds available height
        allTabsWidth === visibleTabsWidth && tabsContainer.offsetHeight === this.tabHeight || // if wrapping is not needed anymore
        !lastTabFitsWrapped()) {
          updateTabsWrapping(false);
        }
      }
    } else if (didTabsWrapMultiLine) {
      updateTabsWrapping(false);
    }
    if (tabsWrapMultiLine && !didTabsWrapMultiLine) {
      const visibleTabsWidth = tabsContainer.offsetWidth;
      tabsScrollbar.setScrollDimensions({
        width: visibleTabsWidth,
        scrollWidth: visibleTabsWidth
      });
    }
    if (tabsWrapMultiLine) {
      const tabs = /* @__PURE__ */ new Map();
      let currentTabsPosY = void 0;
      let lastTab = void 0;
      for (const child of tabsContainer.children) {
        const tab = child;
        const tabPosY = tab.offsetTop;
        if (tabPosY !== currentTabsPosY) {
          currentTabsPosY = tabPosY;
          if (lastTab) {
            tabs.set(lastTab, true);
          }
        }
        lastTab = tab;
        tabs.set(tab, false);
      }
      if (lastTab) {
        tabs.set(lastTab, true);
      }
      for (const [tab, lastInRow] of tabs) {
        tab.classList.toggle("last-in-row", lastInRow);
      }
    }
    return tabsWrapMultiLine;
  }
  doLayoutTabsNonWrapping(options) {
    const [tabsContainer, tabsScrollbar] = assertAllDefined(this.tabsContainer, this.tabsScrollbar);
    const visibleTabsWidth = tabsContainer.offsetWidth;
    const allTabsWidth = tabsContainer.scrollWidth;
    let stickyTabsWidth = 0;
    if (this.tabsModel.stickyCount > 0) {
      let stickyTabWidth = 0;
      switch (this.groupsView.partOptions.pinnedTabSizing) {
        case "compact":
          stickyTabWidth = MultiEditorTabsControl.TAB_WIDTH.compact;
          break;
        case "shrink":
          stickyTabWidth = MultiEditorTabsControl.TAB_WIDTH.shrink;
          break;
      }
      stickyTabsWidth = this.tabsModel.stickyCount * stickyTabWidth;
    }
    const activeTabAndIndex = this.tabsModel.activeEditor ? this.getTabAndIndex(this.tabsModel.activeEditor) : void 0;
    const [activeTab, activeTabIndex] = activeTabAndIndex ?? [void 0, void 0];
    let activeTabPositionStatic = this.groupsView.partOptions.pinnedTabSizing !== "normal" && typeof activeTabIndex === "number" && this.tabsModel.isSticky(activeTabIndex);
    let availableTabsContainerWidth = visibleTabsWidth - stickyTabsWidth;
    if (this.tabsModel.stickyCount > 0 && availableTabsContainerWidth < MultiEditorTabsControl.TAB_WIDTH.fit) {
      tabsContainer.classList.add("disable-sticky-tabs");
      availableTabsContainerWidth = visibleTabsWidth;
      stickyTabsWidth = 0;
      activeTabPositionStatic = false;
    } else {
      tabsContainer.classList.remove("disable-sticky-tabs");
    }
    let activeTabPosX;
    let activeTabWidth;
    if (!this.blockRevealActiveTab && activeTab) {
      activeTabPosX = activeTab.offsetLeft;
      activeTabWidth = activeTab.offsetWidth;
    }
    const { width: oldVisibleTabsWidth, scrollWidth: oldAllTabsWidth } = tabsScrollbar.getScrollDimensions();
    tabsScrollbar.setScrollDimensions({
      width: visibleTabsWidth,
      scrollWidth: allTabsWidth
    });
    const dimensionsChanged = oldVisibleTabsWidth !== visibleTabsWidth || oldAllTabsWidth !== allTabsWidth;
    if (this.blockRevealActiveTab || // explicitly disabled
    typeof activeTabPosX !== "number" || // invalid dimension
    typeof activeTabWidth !== "number" || // invalid dimension
    activeTabPositionStatic || // static tab (sticky)
    !dimensionsChanged && !options?.forceRevealActiveTab) {
      this.blockRevealActiveTab = false;
      return;
    }
    const tabsContainerScrollPosX = tabsScrollbar.getScrollPosition().scrollLeft;
    const activeTabFits = activeTabWidth <= availableTabsContainerWidth;
    const adjustedActiveTabPosX = activeTabPosX - stickyTabsWidth;
    if (activeTabFits && tabsContainerScrollPosX + availableTabsContainerWidth < adjustedActiveTabPosX + activeTabWidth) {
      tabsScrollbar.setScrollPosition({
        scrollLeft: tabsContainerScrollPosX + (adjustedActiveTabPosX + activeTabWidth - (tabsContainerScrollPosX + availableTabsContainerWidth))
      });
    } else if (tabsContainerScrollPosX > adjustedActiveTabPosX || !activeTabFits) {
      tabsScrollbar.setScrollPosition({
        scrollLeft: adjustedActiveTabPosX
      });
    }
  }
  updateTabsControlVisibility() {
    const tabsAndActionsContainer = assertIsDefined(this.tabsAndActionsContainer);
    tabsAndActionsContainer.classList.toggle("empty", !this.visible);
    if (!this.visible && this.dimensions) {
      this.dimensions.used = void 0;
    }
  }
  get visible() {
    return this.tabsModel.count > 0;
  }
  getTabAndIndex(editor) {
    const tabIndex = this.tabsModel.indexOf(editor);
    const tab = this.getTabAtIndex(tabIndex);
    if (tab) {
      return [tab, tabIndex];
    }
    return void 0;
  }
  getTabAtIndex(tabIndex) {
    if (tabIndex >= 0) {
      const tabsContainer = assertIsDefined(this.tabsContainer);
      return tabsContainer.children[tabIndex];
    }
    return void 0;
  }
  getLastTab() {
    return this.getTabAtIndex(this.tabsModel.count - 1);
  }
  blockRevealActiveTabOnce() {
    this.blockRevealActiveTab = true;
  }
  originatesFromTabActionBar(e) {
    let element;
    if (isMouseEvent(e)) {
      element = e.target || e.srcElement;
    } else {
      element = e.initialTarget;
    }
    return !!findParentWithClass(element, "action-item", "tab");
  }
  async onDrop(e, targetTabIndex, tabsContainer) {
    EventHelper.stop(e, true);
    this.updateDropFeedback(tabsContainer, false, e, targetTabIndex);
    tabsContainer.classList.remove("scroll");
    let targetEditorIndex = this.tabsModel instanceof UnstickyEditorGroupModel ? targetTabIndex + this.groupView.stickyCount : targetTabIndex;
    const options = {
      sticky: this.tabsModel instanceof StickyEditorGroupModel && this.tabsModel.stickyCount === targetEditorIndex,
      index: targetEditorIndex
    };
    if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
      const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const sourceGroup = this.editorPartsView.getGroup(data[0].identifier);
        if (sourceGroup) {
          const mergeGroupOptions = { index: targetEditorIndex };
          if (!this.isMoveOperation(e, sourceGroup.id)) {
            mergeGroupOptions.mode = MergeGroupMode.COPY_EDITORS;
          }
          this.groupsView.mergeGroup(sourceGroup, this.groupView, mergeGroupOptions);
        }
        this.groupView.focus();
        this.groupTransfer.clearData(DraggedEditorGroupIdentifier.prototype);
      }
    } else if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
      const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const sourceGroup = this.editorPartsView.getGroup(data[0].identifier.groupId);
        if (sourceGroup) {
          for (const de of data) {
            const editor = de.identifier.editor;
            if (sourceGroup.id !== de.identifier.groupId) {
              continue;
            }
            const sourceEditorIndex = sourceGroup.getIndexOfEditor(editor);
            if (sourceGroup === this.groupView && sourceEditorIndex < targetEditorIndex) {
              targetEditorIndex--;
            }
            if (this.isMoveOperation(e, de.identifier.groupId, editor)) {
              sourceGroup.moveEditor(editor, this.groupView, { ...options, index: targetEditorIndex });
            } else {
              sourceGroup.copyEditor(editor, this.groupView, { ...options, index: targetEditorIndex });
            }
            targetEditorIndex++;
          }
        }
      }
      this.groupView.focus();
      this.editorTransfer.clearData(DraggedEditorIdentifier.prototype);
    } else if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
      const data = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const editors = [];
        for (const id of data) {
          const dataTransferItem = await this.treeViewsDragAndDropService.removeDragOperationTransfer(id.identifier);
          if (dataTransferItem) {
            const treeDropData = await extractTreeDropData(dataTransferItem);
            editors.push(...treeDropData.map((editor) => ({ ...editor, options: { ...editor.options, pinned: true, index: targetEditorIndex } })));
          }
        }
        this.editorService.openEditors(editors, this.groupView, { validateTrust: true });
      }
      this.treeItemsTransfer.clearData(DraggedTreeItemsIdentifier.prototype);
    } else {
      const dropHandler = this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: false });
      dropHandler.handleDrop(e, getWindow(this.parent), () => this.groupView, () => this.groupView.focus(), options);
    }
  }
  dispose() {
    super.dispose();
    this.tabDisposables = dispose(this.tabDisposables);
  }
};
MultiEditorTabsControl.SCROLLBAR_SIZES = {
  default: 3,
  large: 10
};
MultiEditorTabsControl.TAB_WIDTH = {
  compact: 38,
  shrink: 80,
  fit: 120
};
MultiEditorTabsControl.DRAG_OVER_OPEN_TAB_THRESHOLD = 1500;
MultiEditorTabsControl.MOUSE_WHEEL_EVENT_THRESHOLD = 150;
MultiEditorTabsControl.MOUSE_WHEEL_DISTANCE_THRESHOLD = 1.5;
MultiEditorTabsControl = __decorateClass([
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IQuickInputService),
  __decorateParam(11, IThemeService),
  __decorateParam(12, IEditorService),
  __decorateParam(13, IPathService),
  __decorateParam(14, ITreeViewsDnDService),
  __decorateParam(15, IEditorResolverService),
  __decorateParam(16, IHostService)
], MultiEditorTabsControl);
registerThemingParticipant((theme, collector) => {
  const borderColor = theme.getColor(TAB_BORDER);
  if (borderColor) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title > .tabs-and-actions-container.wrapping .tabs-container > .tab {
				border-bottom: 1px solid ${borderColor};
			}
		`);
  }
  const activeContrastBorderColor = theme.getColor(activeContrastBorder);
  if (activeContrastBorderColor) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab.active,
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab.active:hover  {
				outline: 1px solid;
				outline-offset: -5px;
			}

			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.selected:not(.active):not(:hover)  {
				outline: 1px dotted;
				outline-offset: -5px;
			}

			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab.active:focus {
				outline-style: dashed;
			}

			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.active {
				outline: 1px dotted;
				outline-offset: -5px;
			}

			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:hover  {
				outline: 1px dashed;
				outline-offset: -5px;
			}

			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.active > .tab-actions .action-label,
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.active:hover > .tab-actions .action-label,
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.dirty > .tab-actions .action-label,
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab.sticky > .tab-actions .action-label,
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:hover > .tab-actions .action-label {
				opacity: 1 !important;
			}
		`);
  }
  const contrastBorderColor = theme.getColor(contrastBorder);
  if (contrastBorderColor) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title .editor-actions {
				outline: 1px solid ${contrastBorderColor}
			}
		`);
  }
  const tabHoverBackground = theme.getColor(TAB_HOVER_BACKGROUND);
  if (tabHoverBackground) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab:not(.selected):hover {
				background-color: ${tabHoverBackground} !important;
			}
		`);
  }
  const tabUnfocusedHoverBackground = theme.getColor(TAB_UNFOCUSED_HOVER_BACKGROUND);
  if (tabUnfocusedHoverBackground) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:not(.selected):hover  {
				background-color: ${tabUnfocusedHoverBackground} !important;
			}
		`);
  }
  const tabHoverForeground = theme.getColor(TAB_HOVER_FOREGROUND);
  if (tabHoverForeground) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab:not(.selected):hover  {
				color: ${tabHoverForeground} !important;
			}
		`);
  }
  const tabUnfocusedHoverForeground = theme.getColor(TAB_UNFOCUSED_HOVER_FOREGROUND);
  if (tabUnfocusedHoverForeground) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:not(.selected):hover  {
				color: ${tabUnfocusedHoverForeground} !important;
			}
		`);
  }
  const tabHoverBorder = theme.getColor(TAB_HOVER_BORDER);
  if (tabHoverBorder) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container.active > .title .tabs-container > .tab:hover > .tab-border-bottom-container {
				display: block;
				position: absolute;
				left: 0;
				pointer-events: none;
				width: 100%;
				z-index: 10;
				bottom: 0;
				height: 1px;
				background-color: ${tabHoverBorder};
			}
		`);
  }
  const tabUnfocusedHoverBorder = theme.getColor(TAB_UNFOCUSED_HOVER_BORDER);
  if (tabUnfocusedHoverBorder) {
    collector.addRule(`
			.monaco-workbench .part.editor > .content .editor-group-container > .title .tabs-container > .tab:hover > .tab-border-bottom-container  {
				display: block;
				position: absolute;
				left: 0;
				pointer-events: none;
				width: 100%;
				z-index: 10;
				bottom: 0;
				height: 1px;
				background-color: ${tabUnfocusedHoverBorder};
			}
		`);
  }
  if (!isHighContrast(theme.type) && !isSafari && !activeContrastBorderColor) {
    const workbenchBackground = WORKBENCH_BACKGROUND(theme);
    const editorBackgroundColor = theme.getColor(editorBackground);
    const editorGroupHeaderTabsBackground = theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
    const editorDragAndDropBackground = theme.getColor(EDITOR_DRAG_AND_DROP_BACKGROUND);
    let adjustedTabBackground;
    if (editorGroupHeaderTabsBackground && editorBackgroundColor) {
      adjustedTabBackground = editorGroupHeaderTabsBackground.flatten(editorBackgroundColor, editorBackgroundColor, workbenchBackground);
    }
    let adjustedTabDragBackground;
    if (editorGroupHeaderTabsBackground && editorBackgroundColor && editorDragAndDropBackground && editorBackgroundColor) {
      adjustedTabDragBackground = editorGroupHeaderTabsBackground.flatten(editorBackgroundColor, editorDragAndDropBackground, editorBackgroundColor, workbenchBackground);
    }
    const makeTabHoverBackgroundRule = (color, colorDrag, hasFocus = false) => `
			.monaco-workbench .part.editor > .content:not(.dragged-over) .editor-group-container${hasFocus ? ".active" : ""} > .title .tabs-container > .tab.sizing-shrink:not(.dragged):not(.sticky-compact):hover > .tab-label > .monaco-icon-label-container::after,
			.monaco-workbench .part.editor > .content:not(.dragged-over) .editor-group-container${hasFocus ? ".active" : ""} > .title .tabs-container > .tab.sizing-fixed:not(.dragged):not(.sticky-compact):hover > .tab-label > .monaco-icon-label-container::after {
				background: linear-gradient(to left, ${color}, transparent) !important;
			}

			.monaco-workbench .part.editor > .content.dragged-over .editor-group-container${hasFocus ? ".active" : ""} > .title .tabs-container > .tab.sizing-shrink:not(.dragged):not(.sticky-compact):hover > .tab-label > .monaco-icon-label-container::after,
			.monaco-workbench .part.editor > .content.dragged-over .editor-group-container${hasFocus ? ".active" : ""} > .title .tabs-container > .tab.sizing-fixed:not(.dragged):not(.sticky-compact):hover > .tab-label > .monaco-icon-label-container::after {
				background: linear-gradient(to left, ${colorDrag}, transparent) !important;
			}
		`;
    if (tabHoverBackground && adjustedTabBackground && adjustedTabDragBackground) {
      const adjustedColor = tabHoverBackground.flatten(adjustedTabBackground);
      const adjustedColorDrag = tabHoverBackground.flatten(adjustedTabDragBackground);
      collector.addRule(makeTabHoverBackgroundRule(adjustedColor, adjustedColorDrag, true));
    }
    if (tabUnfocusedHoverBackground && adjustedTabBackground && adjustedTabDragBackground) {
      const adjustedColor = tabUnfocusedHoverBackground.flatten(adjustedTabBackground);
      const adjustedColorDrag = tabUnfocusedHoverBackground.flatten(adjustedTabDragBackground);
      collector.addRule(makeTabHoverBackgroundRule(adjustedColor, adjustedColorDrag));
    }
    if (editorDragAndDropBackground && adjustedTabDragBackground) {
      const adjustedColorDrag = editorDragAndDropBackground.flatten(adjustedTabDragBackground);
      collector.addRule(`
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container.active > .title .tabs-container > .tab.sizing-shrink.dragged-over:not(.active):not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container:not(.active) > .title .tabs-container > .tab.sizing-shrink.dragged-over:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container.active > .title .tabs-container > .tab.sizing-fixed.dragged-over:not(.active):not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container:not(.active) > .title .tabs-container > .tab.sizing-fixed.dragged-over:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after {
					background: linear-gradient(to left, ${adjustedColorDrag}, transparent) !important;
				}
		`);
    }
    const makeTabBackgroundRule = (color, colorDrag, focused, active) => `
				.monaco-workbench .part.editor > .content:not(.dragged-over) .editor-group-container${focused ? ".active" : ":not(.active)"} > .title .tabs-container > .tab.sizing-shrink${active ? ".active" : ""}:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content:not(.dragged-over) .editor-group-container${focused ? ".active" : ":not(.active)"} > .title .tabs-container > .tab.sizing-fixed${active ? ".active" : ""}:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after {
					background: linear-gradient(to left, ${color}, transparent);
				}

				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container${focused ? ".active" : ":not(.active)"} > .title .tabs-container > .tab.sizing-shrink${active ? ".active" : ""}:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after,
				.monaco-workbench .part.editor > .content.dragged-over .editor-group-container${focused ? ".active" : ":not(.active)"} > .title .tabs-container > .tab.sizing-fixed${active ? ".active" : ""}:not(.dragged):not(.sticky-compact) > .tab-label > .monaco-icon-label-container::after {
					background: linear-gradient(to left, ${colorDrag}, transparent);
				}
		`;
    const tabActiveBackground = theme.getColor(TAB_ACTIVE_BACKGROUND);
    if (tabActiveBackground && adjustedTabBackground && adjustedTabDragBackground) {
      const adjustedColor = tabActiveBackground.flatten(adjustedTabBackground);
      const adjustedColorDrag = tabActiveBackground.flatten(adjustedTabDragBackground);
      collector.addRule(makeTabBackgroundRule(adjustedColor, adjustedColorDrag, true, true));
    }
    const tabUnfocusedActiveBackground = theme.getColor(TAB_UNFOCUSED_ACTIVE_BACKGROUND);
    if (tabUnfocusedActiveBackground && adjustedTabBackground && adjustedTabDragBackground) {
      const adjustedColor = tabUnfocusedActiveBackground.flatten(adjustedTabBackground);
      const adjustedColorDrag = tabUnfocusedActiveBackground.flatten(adjustedTabDragBackground);
      collector.addRule(makeTabBackgroundRule(adjustedColor, adjustedColorDrag, false, true));
    }
    const tabInactiveBackground = theme.getColor(TAB_INACTIVE_BACKGROUND);
    if (tabInactiveBackground && adjustedTabBackground && adjustedTabDragBackground) {
      const adjustedColor = tabInactiveBackground.flatten(adjustedTabBackground);
      const adjustedColorDrag = tabInactiveBackground.flatten(adjustedTabDragBackground);
      collector.addRule(makeTabBackgroundRule(adjustedColor, adjustedColorDrag, true, false));
    }
    const tabUnfocusedInactiveBackground = theme.getColor(TAB_UNFOCUSED_INACTIVE_BACKGROUND);
    if (tabUnfocusedInactiveBackground && adjustedTabBackground && adjustedTabDragBackground) {
      const adjustedColor = tabUnfocusedInactiveBackground.flatten(adjustedTabBackground);
      const adjustedColorDrag = tabUnfocusedInactiveBackground.flatten(adjustedTabDragBackground);
      collector.addRule(makeTabBackgroundRule(adjustedColor, adjustedColorDrag, false, false));
    }
  }
});
export {
  MultiEditorTabsControl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvbXVsdGlFZGl0b3JUYWJzQ29udHJvbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9tdWx0aWVkaXRvcnRhYnNjb250cm9sLmNzcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgc2hvcnRlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBWZXJib3NpdHksIElFZGl0b3JQYXJ0T3B0aW9ucywgU2lkZUJ5U2lkZUVkaXRvciwgREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04sIEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLCBJVW50eXBlZEVkaXRvcklucHV0LCBwcmV2ZW50RWRpdG9yQ2xvc2UsIEVkaXRvckNsb3NlTWV0aG9kLCBFZGl0b3JzT3JkZXIsIElUb29sYmFyQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IGNvbXB1dGVFZGl0b3JBcmlhTGFiZWwgfSBmcm9tICcuLi8uLi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgRXZlbnRUeXBlIGFzIFRvdWNoRXZlbnRUeXBlLCBHZXN0dXJlRXZlbnQsIEdlc3R1cmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdG91Y2guanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IFJlc291cmNlTGFiZWxzLCBJUmVzb3VyY2VMYWJlbCwgREVGQVVMVF9MQUJFTFNfQ09OVEFJTkVSIH0gZnJvbSAnLi4vLi4vbGFiZWxzLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29tbWFuZHNDb250ZXh0QWN0aW9uUnVubmVyLCBFZGl0b3JUYWJzQ29udHJvbCB9IGZyb20gJy4vZWRpdG9yVGFic0NvbnRyb2wuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSwgRGlzcG9zYWJsZVN0b3JlLCBjb21iaW5lZERpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50LmpzJztcbmltcG9ydCB7IFNjcm9sbGJhclZpc2liaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcbmltcG9ydCB7IGdldE9yU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIHJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUQUJfSU5BQ1RJVkVfQkFDS0dST1VORCwgVEFCX0FDVElWRV9CQUNLR1JPVU5ELCBUQUJfQk9SREVSLCBFRElUT1JfRFJBR19BTkRfRFJPUF9CQUNLR1JPVU5ELCBUQUJfVU5GT0NVU0VEX0FDVElWRV9CQUNLR1JPVU5ELCBUQUJfVU5GT0NVU0VEX0FDVElWRV9CT1JERVIsIFRBQl9BQ1RJVkVfQk9SREVSLCBUQUJfSE9WRVJfQkFDS0dST1VORCwgVEFCX0hPVkVSX0JPUkRFUiwgVEFCX1VORk9DVVNFRF9IT1ZFUl9CQUNLR1JPVU5ELCBUQUJfVU5GT0NVU0VEX0hPVkVSX0JPUkRFUiwgRURJVE9SX0dST1VQX0hFQURFUl9UQUJTX0JBQ0tHUk9VTkQsIFdPUktCRU5DSF9CQUNLR1JPVU5ELCBUQUJfQUNUSVZFX0JPUkRFUl9UT1AsIFRBQl9VTkZPQ1VTRURfQUNUSVZFX0JPUkRFUl9UT1AsIFRBQl9BQ1RJVkVfTU9ESUZJRURfQk9SREVSLCBUQUJfSU5BQ1RJVkVfTU9ESUZJRURfQk9SREVSLCBUQUJfVU5GT0NVU0VEX0FDVElWRV9NT0RJRklFRF9CT1JERVIsIFRBQl9VTkZPQ1VTRURfSU5BQ1RJVkVfTU9ESUZJRURfQk9SREVSLCBUQUJfVU5GT0NVU0VEX0lOQUNUSVZFX0JBQ0tHUk9VTkQsIFRBQl9IT1ZFUl9GT1JFR1JPVU5ELCBUQUJfVU5GT0NVU0VEX0hPVkVSX0ZPUkVHUk9VTkQsIEVESVRPUl9HUk9VUF9IRUFERVJfVEFCU19CT1JERVIsIFRBQl9MQVNUX1BJTk5FRF9CT1JERVIsIFRBQl9TRUxFQ1RFRF9CT1JERVJfVE9QIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyLCBjb250cmFzdEJvcmRlciwgZWRpdG9yQmFja2dyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlc291cmNlc0Ryb3BIYW5kbGVyLCBEcmFnZ2VkRWRpdG9ySWRlbnRpZmllciwgRHJhZ2dlZEVkaXRvckdyb3VwSWRlbnRpZmllciwgZXh0cmFjdFRyZWVEcm9wRGF0YSwgaXNXaW5kb3dEcmFnZ2VkT3ZlciB9IGZyb20gJy4uLy4uL2RuZC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgTWVyZ2VHcm91cE1vZGUsIElNZXJnZUdyb3VwT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIEV2ZW50VHlwZSwgRXZlbnRIZWxwZXIsIERpbWVuc2lvbiwgc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZSwgZmluZFBhcmVudFdpdGhDbGFzcywgY2xlYXJOb2RlLCBEcmFnQW5kRHJvcE9ic2VydmVyLCBpc01vdXNlRXZlbnQsIGdldFdpbmRvdywgJCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1ZpZXcsIEVkaXRvclNlcnZpY2VJbXBsLCBJRWRpdG9yR3JvdXBWaWV3LCBJSW50ZXJuYWxFZGl0b3JPcGVuT3B0aW9ucywgSUVkaXRvclBhcnRzVmlldywgcHJlcGFyZU1vdmVDb3B5RWRpdG9ycyB9IGZyb20gJy4vZWRpdG9yLmpzJztcbmltcG9ydCB7IENsb3NlRWRpdG9yVGFiQWN0aW9uLCBVbnBpbkVkaXRvckFjdGlvbiB9IGZyb20gJy4vZWRpdG9yQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRBbGxEZWZpbmVkLCBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZU9yQXV0aG9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUGF0aCwgd2luMzIsIHBvc2l4IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSwgaW5zZXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGlzSGlnaENvbnRyYXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IGlzU2FmYXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3RpdmF0aW9uLCBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IFVOTE9DS19HUk9VUF9DT01NQU5EX0lEIH0gZnJvbSAnLi9lZGl0b3JDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBJVHJlZVZpZXdzRG5EU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdHJlZVZpZXdzRG5kU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEcmFnZ2VkVHJlZUl0ZW1zSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdHJlZVZpZXdzRG5kLmpzJztcbmltcG9ydCB7IElFZGl0b3JSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yVGl0bGVDb250cm9sRGltZW5zaW9ucyB9IGZyb20gJy4vZWRpdG9yVGl0bGVDb250cm9sLmpzJztcbmltcG9ydCB7IFN0aWNreUVkaXRvckdyb3VwTW9kZWwsIFVuc3RpY2t5RWRpdG9yR3JvdXBNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZmlsdGVyZWRFZGl0b3JHcm91cE1vZGVsLmpzJztcbmltcG9ydCB7IElSZWFkb25seUVkaXRvckdyb3VwTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvckdyb3VwTW9kZWwuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IGFwcGx5RHJhZ0ltYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2RuZC9kbmQuanMnO1xuXG5pbnRlcmZhY2UgSUVkaXRvcklucHV0TGFiZWwge1xuXHRyZWFkb25seSBlZGl0b3I6IEVkaXRvcklucHV0O1xuXG5cdHJlYWRvbmx5IG5hbWU/OiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRyZWFkb25seSBmb3JjZURlc2NyaXB0aW9uPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgdGl0bGU/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGFyaWFMYWJlbD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElNdWx0aUVkaXRvclRhYnNDb250cm9sTGF5b3V0T3B0aW9ucyB7XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdG8gZm9yY2UgcmV2ZWFsaW5nIHRoZSBhY3RpdmUgdGFiLCBldmVuIHdoZW5cblx0ICogdGhlIGRpbWVuc2lvbnMgaGF2ZSBub3QgY2hhbmdlZC4gVGhpcyBjYW4gYmUgdGhlIGNhc2Vcblx0ICogd2hlbiBhIHRhYiB3YXMgbWFkZSBhY3RpdmUgYW5kIG5lZWRzIHRvIGJlIHJldmVhbGVkLlxuXHQgKi9cblx0cmVhZG9ubHkgZm9yY2VSZXZlYWxBY3RpdmVUYWI/OiB0cnVlO1xufVxuXG5pbnRlcmZhY2UgSVNjaGVkdWxlZE11bHRpRWRpdG9yVGFic0NvbnRyb2xMYXlvdXQgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cblx0LyoqXG5cdCAqIEFzc29jaWF0ZWQgb3B0aW9ucyB3aXRoIHRoZSBsYXlvdXQgY2FsbC5cblx0ICovXG5cdG9wdGlvbnM/OiBJTXVsdGlFZGl0b3JUYWJzQ29udHJvbExheW91dE9wdGlvbnM7XG59XG5cbmV4cG9ydCBjbGFzcyBNdWx0aUVkaXRvclRhYnNDb250cm9sIGV4dGVuZHMgRWRpdG9yVGFic0NvbnRyb2wge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNDUk9MTEJBUl9TSVpFUyA9IHtcblx0XHRkZWZhdWx0OiAzIGFzIGNvbnN0LFxuXHRcdGxhcmdlOiAxMCBhcyBjb25zdFxuXHR9O1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFRBQl9XSURUSCA9IHtcblx0XHRjb21wYWN0OiAzOCBhcyBjb25zdCxcblx0XHRzaHJpbms6IDgwIGFzIGNvbnN0LFxuXHRcdGZpdDogMTIwIGFzIGNvbnN0XG5cdH07XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRFJBR19PVkVSX09QRU5fVEFCX1RIUkVTSE9MRCA9IDE1MDA7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTU9VU0VfV0hFRUxfRVZFTlRfVEhSRVNIT0xEID0gMTUwO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNT1VTRV9XSEVFTF9ESVNUQU5DRV9USFJFU0hPTEQgPSAxLjU7XG5cblx0cHJpdmF0ZSB0aXRsZUNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdGFic0FuZEFjdGlvbnNDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRhYnNDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRhYnNTY3JvbGxiYXI6IFNjcm9sbGFibGVFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRhYlNpemluZ0ZpeGVkRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNsb3NlRWRpdG9yQWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDbG9zZUVkaXRvclRhYkFjdGlvbiwgQ2xvc2VFZGl0b3JUYWJBY3Rpb24uSUQsIENsb3NlRWRpdG9yVGFiQWN0aW9uLkxBQkVMKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdW5waW5FZGl0b3JBY3Rpb24gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVucGluRWRpdG9yQWN0aW9uLCBVbnBpbkVkaXRvckFjdGlvbi5JRCwgVW5waW5FZGl0b3JBY3Rpb24uTEFCRUwpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHRhYlJlc291cmNlTGFiZWxzID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVscywgREVGQVVMVF9MQUJFTFNfQ09OVEFJTkVSKSk7XG5cdHByaXZhdGUgdGFiTGFiZWxzOiBJRWRpdG9ySW5wdXRMYWJlbFtdID0gW107XG5cdHByaXZhdGUgYWN0aXZlVGFiTGFiZWw6IElFZGl0b3JJbnB1dExhYmVsIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgdGFiQWN0aW9uQmFyczogQWN0aW9uQmFyW10gPSBbXTtcblx0cHJpdmF0ZSB0YWJEaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXG5cdHByaXZhdGUgZGltZW5zaW9uczogSUVkaXRvclRpdGxlQ29udHJvbERpbWVuc2lvbnMgJiB7IHVzZWQ/OiBEaW1lbnNpb24gfSA9IHtcblx0XHRjb250YWluZXI6IERpbWVuc2lvbi5Ob25lLFxuXHRcdGF2YWlsYWJsZTogRGltZW5zaW9uLk5vbmVcblx0fTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxheW91dFNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJU2NoZWR1bGVkTXVsdGlFZGl0b3JUYWJzQ29udHJvbExheW91dD4oKSk7XG5cdHByaXZhdGUgYmxvY2tSZXZlYWxBY3RpdmVUYWI6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBwYXRoOiBJUGF0aCA9IGlzV2luZG93cyA/IHdpbjMyIDogcG9zaXg7XG5cblx0cHJpdmF0ZSBsYXN0TW91c2VXaGVlbEV2ZW50VGltZSA9IDA7XG5cdHByaXZhdGUgaXNNb3VzZU92ZXJUYWJzID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cGFyZW50OiBIVE1MRWxlbWVudCxcblx0XHRlZGl0b3JQYXJ0c1ZpZXc6IElFZGl0b3JQYXJ0c1ZpZXcsXG5cdFx0Z3JvdXBzVmlldzogSUVkaXRvckdyb3Vwc1ZpZXcsXG5cdFx0Z3JvdXBWaWV3OiBJRWRpdG9yR3JvdXBWaWV3LFxuXHRcdHRhYnNNb2RlbDogSVJlYWRvbmx5RWRpdG9yR3JvdXBNb2RlbCxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogRWRpdG9yU2VydmljZUltcGwsXG5cdFx0QElQYXRoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElUcmVlVmlld3NEbkRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdHJlZVZpZXdzRHJhZ0FuZERyb3BTZXJ2aWNlOiBJVHJlZVZpZXdzRG5EU2VydmljZSxcblx0XHRASUVkaXRvclJlc29sdmVyU2VydmljZSBlZGl0b3JSZXNvbHZlclNlcnZpY2U6IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihwYXJlbnQsIGVkaXRvclBhcnRzVmlldywgZ3JvdXBzVmlldywgZ3JvdXBWaWV3LCB0YWJzTW9kZWwsIGNvbnRleHRNZW51U2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZSwgcXVpY2tJbnB1dFNlcnZpY2UsIHRoZW1lU2VydmljZSwgZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLCBob3N0U2VydmljZSk7XG5cblx0XHQvLyBSZXNvbHZlIHRoZSBjb3JyZWN0IHBhdGggbGlicmFyeSBmb3IgdGhlIE9TIHdlIGFyZSBvblxuXHRcdC8vIElmIHdlIGFyZSBjb25uZWN0ZWQgdG8gcmVtb3RlLCB0aGlzIGFjY291bnRzIGZvciB0aGVcblx0XHQvLyByZW1vdGUgT1MuXG5cdFx0KGFzeW5jICgpID0+IHRoaXMucGF0aCA9IGF3YWl0IHRoaXMucGF0aFNlcnZpY2UucGF0aCkoKTtcblxuXHRcdC8vIFJlYWN0IHRvIGRlY29yYXRpb25zIGNoYW5naW5nIGZvciBvdXIgcmVzb3VyY2UgbGFiZWxzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50YWJSZXNvdXJjZUxhYmVscy5vbkRpZENoYW5nZURlY29yYXRpb25zKCgpID0+IHRoaXMuZG9IYW5kbGVEZWNvcmF0aW9uc0NoYW5nZSgpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlKHBhcmVudDogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XG5cdFx0c3VwZXIuY3JlYXRlKHBhcmVudCk7XG5cblx0XHR0aGlzLnRpdGxlQ29udGFpbmVyID0gcGFyZW50O1xuXG5cdFx0Ly8gVGFicyBhbmQgQWN0aW9ucyBDb250YWluZXIgKGFyZSBvbiBhIHNpbmdsZSByb3cgd2l0aCBmbGV4IHNpZGUtYnktc2lkZSlcblx0XHR0aGlzLnRhYnNBbmRBY3Rpb25zQ29udGFpbmVyID0gJCgnLnRhYnMtYW5kLWFjdGlvbnMtY29udGFpbmVyJyk7XG5cdFx0dGhpcy50aXRsZUNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnRhYnNBbmRBY3Rpb25zQ29udGFpbmVyKTtcblxuXHRcdC8vIFRhYnMgQ29udGFpbmVyXG5cdFx0dGhpcy50YWJzQ29udGFpbmVyID0gJCgnLnRhYnMtY29udGFpbmVyJywge1xuXHRcdFx0cm9sZTogJ3RhYmxpc3QnLFxuXHRcdFx0ZHJhZ2dhYmxlOiB0cnVlXG5cdFx0fSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoR2VzdHVyZS5hZGRUYXJnZXQodGhpcy50YWJzQ29udGFpbmVyKSk7XG5cblx0XHR0aGlzLnRhYlNpemluZ0ZpeGVkRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdHRoaXMudXBkYXRlVGFiU2l6aW5nKGZhbHNlKTtcblxuXHRcdC8vIFRhYnMgU2Nyb2xsYmFyXG5cdFx0dGhpcy50YWJzU2Nyb2xsYmFyID0gdGhpcy5jcmVhdGVUYWJzU2Nyb2xsYmFyKHRoaXMudGFic0NvbnRhaW5lcik7XG5cdFx0dGhpcy50YWJzQW5kQWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnRhYnNTY3JvbGxiYXIuZ2V0RG9tTm9kZSgpKTtcblxuXHRcdC8vIFRhYnMgQ29udGFpbmVyIGxpc3RlbmVyc1xuXHRcdHRoaXMucmVnaXN0ZXJUYWJzQ29udGFpbmVyTGlzdGVuZXJzKHRoaXMudGFic0NvbnRhaW5lciwgdGhpcy50YWJzU2Nyb2xsYmFyKTtcblxuXHRcdC8vIENyZWF0ZSBFZGl0b3IgVG9vbGJhclxuXHRcdHRoaXMuY3JlYXRlRWRpdG9yQWN0aW9uc1Rvb2xCYXIodGhpcy50YWJzQW5kQWN0aW9uc0NvbnRhaW5lciwgWydlZGl0b3ItYWN0aW9ucyddKTtcblxuXHRcdC8vIFNldCB0YWJzIGNvbnRyb2wgdmlzaWJpbGl0eVxuXHRcdHRoaXMudXBkYXRlVGFic0NvbnRyb2xWaXNpYmlsaXR5KCk7XG5cblx0XHRyZXR1cm4gdGhpcy50YWJzQW5kQWN0aW9uc0NvbnRhaW5lcjtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVGFic1Njcm9sbGJhcihzY3JvbGxhYmxlOiBIVE1MRWxlbWVudCk6IFNjcm9sbGFibGVFbGVtZW50IHtcblx0XHRjb25zdCB0YWJzU2Nyb2xsYmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNjcm9sbGFibGVFbGVtZW50KHNjcm9sbGFibGUsIHtcblx0XHRcdGhvcml6b250YWw6IFNjcm9sbGJhclZpc2liaWxpdHkuQXV0byxcblx0XHRcdGhvcml6b250YWxTY3JvbGxiYXJTaXplOiB0aGlzLmdldFRhYnNTY3JvbGxiYXJTaXppbmcoKSxcblx0XHRcdHZlcnRpY2FsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkhpZGRlbixcblx0XHRcdHNjcm9sbFlUb1g6IHRydWUsXG5cdFx0XHR1c2VTaGFkb3dzOiBmYWxzZVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRhYnNTY3JvbGxiYXIub25TY3JvbGwoZSA9PiB7XG5cdFx0XHRpZiAoZS5zY3JvbGxMZWZ0Q2hhbmdlZCkge1xuXHRcdFx0XHRzY3JvbGxhYmxlLnNjcm9sbExlZnQgPSBlLnNjcm9sbExlZnQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHRhYnNTY3JvbGxiYXI7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRhYnNTY3JvbGxiYXJTaXppbmcoKTogdm9pZCB7XG5cdFx0dGhpcy50YWJzU2Nyb2xsYmFyPy51cGRhdGVPcHRpb25zKHtcblx0XHRcdGhvcml6b250YWxTY3JvbGxiYXJTaXplOiB0aGlzLmdldFRhYnNTY3JvbGxiYXJTaXppbmcoKVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVUYWJTaXppbmcoZnJvbUV2ZW50OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgW3RhYnNDb250YWluZXIsIHRhYlNpemluZ0ZpeGVkRGlzcG9zYWJsZXNdID0gYXNzZXJ0QWxsRGVmaW5lZCh0aGlzLnRhYnNDb250YWluZXIsIHRoaXMudGFiU2l6aW5nRml4ZWREaXNwb3NhYmxlcyk7XG5cblx0XHR0YWJTaXppbmdGaXhlZERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zO1xuXHRcdGlmIChvcHRpb25zLnRhYlNpemluZyA9PT0gJ2ZpeGVkJykge1xuXHRcdFx0dGFic0NvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS10YWItc2l6aW5nLWZpeGVkLW1pbi13aWR0aCcsIGAke29wdGlvbnMudGFiU2l6aW5nRml4ZWRNaW5XaWR0aH1weGApO1xuXHRcdFx0dGFic0NvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS10YWItc2l6aW5nLWZpeGVkLW1heC13aWR0aCcsIGAke29wdGlvbnMudGFiU2l6aW5nRml4ZWRNYXhXaWR0aH1weGApO1xuXG5cdFx0XHQvLyBGb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQwMjkwIHdlIHdhbnQgdG9cblx0XHRcdC8vIHByZXNlcnZlIHRoZSBjdXJyZW50IHRhYiB3aWR0aHMgYXMgbG9uZyBhcyB0aGUgbW91c2UgaXMgb3ZlciB0aGVcblx0XHRcdC8vIHRhYnMgc28gdGhhdCB5b3UgY2FuIHF1aWNrbHkgY2xvc2UgdGhlbSB2aWEgbW91c2UgY2xpY2suIEZvciB0aGF0XG5cdFx0XHQvLyB3ZSB0cmFjayBtb3VzZSBtb3ZlbWVudHMgb3ZlciB0aGUgdGFicyBjb250YWluZXIuXG5cblx0XHRcdHRhYlNpemluZ0ZpeGVkRGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YWJzQ29udGFpbmVyLCBFdmVudFR5cGUuTU9VU0VfRU5URVIsICgpID0+IHtcblx0XHRcdFx0dGhpcy5pc01vdXNlT3ZlclRhYnMgPSB0cnVlO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGFiU2l6aW5nRml4ZWREaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhYnNDb250YWluZXIsIEV2ZW50VHlwZS5NT1VTRV9MRUFWRSwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmlzTW91c2VPdmVyVGFicyA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVRhYnNGaXhlZFdpZHRoKGZhbHNlKTtcblx0XHRcdH0pKTtcblx0XHR9IGVsc2UgaWYgKGZyb21FdmVudCkge1xuXHRcdFx0dGFic0NvbnRhaW5lci5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS10YWItc2l6aW5nLWZpeGVkLW1pbi13aWR0aCcpO1xuXHRcdFx0dGFic0NvbnRhaW5lci5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS10YWItc2l6aW5nLWZpeGVkLW1heC13aWR0aCcpO1xuXHRcdFx0dGhpcy51cGRhdGVUYWJzRml4ZWRXaWR0aChmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVUYWJzRml4ZWRXaWR0aChmaXhlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuZm9yRWFjaFRhYigoZWRpdG9yLCB0YWJJbmRleCwgdGFiQ29udGFpbmVyKSA9PiB7XG5cdFx0XHRpZiAoZml4ZWQpIHtcblx0XHRcdFx0Y29uc3QgeyB3aWR0aCB9ID0gdGFiQ29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHR0YWJDb250YWluZXIuc3R5bGUuc2V0UHJvcGVydHkoJy0tdGFiLXNpemluZy1jdXJyZW50LXdpZHRoJywgYCR7d2lkdGh9cHhgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRhYkNvbnRhaW5lci5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS10YWItc2l6aW5nLWN1cnJlbnQtd2lkdGgnKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VGFic1Njcm9sbGJhclNpemluZygpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnMudGl0bGVTY3JvbGxiYXJTaXppbmcgIT09ICdsYXJnZScpIHtcblx0XHRcdHJldHVybiBNdWx0aUVkaXRvclRhYnNDb250cm9sLlNDUk9MTEJBUl9TSVpFUy5kZWZhdWx0O1xuXHRcdH1cblxuXHRcdHJldHVybiBNdWx0aUVkaXRvclRhYnNDb250cm9sLlNDUk9MTEJBUl9TSVpFUy5sYXJnZTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJUYWJzQ29udGFpbmVyTGlzdGVuZXJzKHRhYnNDb250YWluZXI6IEhUTUxFbGVtZW50LCB0YWJzU2Nyb2xsYmFyOiBTY3JvbGxhYmxlRWxlbWVudCk6IHZvaWQge1xuXG5cdFx0Ly8gRm9yd2FyZCBzY3JvbGxpbmcgaW5zaWRlIHRoZSBjb250YWluZXIgdG8gb3VyIGN1c3RvbSBzY3JvbGxiYXJcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFic0NvbnRhaW5lciwgRXZlbnRUeXBlLlNDUk9MTCwgKCkgPT4ge1xuXHRcdFx0aWYgKHRhYnNDb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdzY3JvbGwnKSkge1xuXHRcdFx0XHR0YWJzU2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHtcblx0XHRcdFx0XHRzY3JvbGxMZWZ0OiB0YWJzQ29udGFpbmVyLnNjcm9sbExlZnQgLy8gZHVyaW5nIERORCB0aGUgY29udGFpbmVyIGdldHMgc2Nyb2xsZWQgc28gd2UgbmVlZCB0byB1cGRhdGUgdGhlIGN1c3RvbSBzY3JvbGxiYXJcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gTmV3IGZpbGUgd2hlbiBkb3VibGUtY2xpY2tpbmcgb24gdGFicyBjb250YWluZXIgKGJ1dCBub3QgdGFicylcblx0XHRmb3IgKGNvbnN0IGV2ZW50VHlwZSBvZiBbVG91Y2hFdmVudFR5cGUuVGFwLCBFdmVudFR5cGUuREJMQ0xJQ0tdKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFic0NvbnRhaW5lciwgZXZlbnRUeXBlLCAoZTogTW91c2VFdmVudCB8IEdlc3R1cmVFdmVudCkgPT4ge1xuXHRcdFx0XHRpZiAoZXZlbnRUeXBlID09PSBFdmVudFR5cGUuREJMQ0xJQ0spIHtcblx0XHRcdFx0XHRpZiAoZS50YXJnZXQgIT09IHRhYnNDb250YWluZXIpIHtcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gaWdub3JlIGlmIHRhcmdldCBpcyBub3QgdGFicyBjb250YWluZXJcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKCg8R2VzdHVyZUV2ZW50PmUpLnRhcENvdW50ICE9PSAyKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47IC8vIGlnbm9yZSBzaW5nbGUgdGFwc1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICgoPEdlc3R1cmVFdmVudD5lKS5pbml0aWFsVGFyZ2V0ICE9PSB0YWJzQ29udGFpbmVyKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47IC8vIGlnbm9yZSBpZiB0YXJnZXQgaXMgbm90IHRhYnMgY29udGFpbmVyXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlKTtcblxuXHRcdFx0XHR0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0cmVzb3VyY2U6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRwaW5uZWQ6IHRydWUsXG5cdFx0XHRcdFx0XHRpbmRleDogdGhpcy5ncm91cFZpZXcuY291bnQsIC8vIGFsd2F5cyBhdCB0aGUgZW5kXG5cdFx0XHRcdFx0XHRvdmVycmlkZTogREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIHRoaXMuZ3JvdXBWaWV3LmlkKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyBQcmV2ZW50IGF1dG8tc2Nyb2xsaW5nIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTY2OTApXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhYnNDb250YWluZXIsIEV2ZW50VHlwZS5NT1VTRV9ET1dOLCBlID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUHJldmVudCBhdXRvLXBhc3RpbmcgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMDE2OTYpXG5cdFx0aWYgKGlzTGludXgpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YWJzQ29udGFpbmVyLCBFdmVudFR5cGUuTU9VU0VfVVAsIGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5idXR0b24gPT09IDEpIHtcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyBEcmFnICYgRHJvcCBzdXBwb3J0XG5cdFx0bGV0IGxhc3REcmFnRXZlbnQ6IERyYWdFdmVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgaXNOZXdXaW5kb3dPcGVyYXRpb24gPSBmYWxzZTtcblx0XHR0aGlzLl9yZWdpc3RlcihuZXcgRHJhZ0FuZERyb3BPYnNlcnZlcih0YWJzQ29udGFpbmVyLCB7XG5cdFx0XHRvbkRyYWdTdGFydDogZSA9PiB7XG5cdFx0XHRcdGlzTmV3V2luZG93T3BlcmF0aW9uID0gdGhpcy5vbkdyb3VwRHJhZ1N0YXJ0KGUsIHRhYnNDb250YWluZXIpO1xuXHRcdFx0fSxcblxuXHRcdFx0b25EcmFnOiBlID0+IHtcblx0XHRcdFx0bGFzdERyYWdFdmVudCA9IGU7XG5cdFx0XHR9LFxuXG5cdFx0XHRvbkRyYWdFbnRlcjogZSA9PiB7XG5cblx0XHRcdFx0Ly8gQWx3YXlzIGVuYWJsZSBzdXBwb3J0IHRvIHNjcm9sbCB3aGlsZSBkcmFnZ2luZ1xuXHRcdFx0XHR0YWJzQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3Njcm9sbCcpO1xuXG5cdFx0XHRcdC8vIFJldHVybiBpZiB0aGUgdGFyZ2V0IGlzIG5vdCBvbiB0aGUgdGFicyBjb250YWluZXJcblx0XHRcdFx0aWYgKGUudGFyZ2V0ICE9PSB0YWJzQ29udGFpbmVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmV0dXJuIGlmIHRyYW5zZmVyIGlzIHVuc3VwcG9ydGVkXG5cdFx0XHRcdGlmICghdGhpcy5pc1N1cHBvcnRlZERyb3BUcmFuc2ZlcihlKSkge1xuXHRcdFx0XHRcdGlmIChlLmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0XHRcdFx0ZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdub25lJztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBVcGRhdGUgdGhlIGRyb3BFZmZlY3QgdG8gXCJjb3B5XCIgaWYgdGhlcmUgaXMgbm8gbG9jYWwgZGF0YSB0byBiZSBkcmFnZ2VkIGJlY2F1c2Vcblx0XHRcdFx0Ly8gaW4gdGhhdCBjYXNlIHdlIGNhbiBvbmx5IGNvcHkgdGhlIGRhdGEgaW50byBhbmQgbm90IG1vdmUgaXQgZnJvbSBpdHMgc291cmNlXG5cdFx0XHRcdGlmICghdGhpcy5lZGl0b3JUcmFuc2Zlci5oYXNEYXRhKERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLnByb3RvdHlwZSkpIHtcblx0XHRcdFx0XHRpZiAoZS5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdFx0XHRcdGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy51cGRhdGVEcm9wRmVlZGJhY2sodGFic0NvbnRhaW5lciwgdHJ1ZSwgZSk7XG5cdFx0XHR9LFxuXG5cdFx0XHRvbkRyYWdMZWF2ZTogZSA9PiB7XG5cdFx0XHRcdHRoaXMudXBkYXRlRHJvcEZlZWRiYWNrKHRhYnNDb250YWluZXIsIGZhbHNlLCBlKTtcblx0XHRcdFx0dGFic0NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdzY3JvbGwnKTtcblx0XHRcdH0sXG5cblx0XHRcdG9uRHJhZ0VuZDogZSA9PiB7XG5cdFx0XHRcdHRoaXMudXBkYXRlRHJvcEZlZWRiYWNrKHRhYnNDb250YWluZXIsIGZhbHNlLCBlKTtcblx0XHRcdFx0dGFic0NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdzY3JvbGwnKTtcblxuXHRcdFx0XHR0aGlzLm9uR3JvdXBEcmFnRW5kKGUsIGxhc3REcmFnRXZlbnQsIHRhYnNDb250YWluZXIsIGlzTmV3V2luZG93T3BlcmF0aW9uKTtcblx0XHRcdH0sXG5cblx0XHRcdG9uRHJvcDogZSA9PiB7XG5cdFx0XHRcdHRoaXMudXBkYXRlRHJvcEZlZWRiYWNrKHRhYnNDb250YWluZXIsIGZhbHNlLCBlKTtcblx0XHRcdFx0dGFic0NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdzY3JvbGwnKTtcblxuXHRcdFx0XHRpZiAoZS50YXJnZXQgPT09IHRhYnNDb250YWluZXIpIHtcblx0XHRcdFx0XHRjb25zdCBpc0dyb3VwVHJhbnNmZXIgPSB0aGlzLmdyb3VwVHJhbnNmZXIuaGFzRGF0YShEcmFnZ2VkRWRpdG9yR3JvdXBJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHRcdFx0dGhpcy5vbkRyb3AoZSwgaXNHcm91cFRyYW5zZmVyID8gdGhpcy5ncm91cFZpZXcuY291bnQgOiB0aGlzLnRhYnNNb2RlbC5jb3VudCwgdGFic0NvbnRhaW5lcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBNb3VzZS13aGVlbCBzdXBwb3J0IHRvIHN3aXRjaCB0byB0YWJzIG9wdGlvbmFsbHlcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFic0NvbnRhaW5lciwgRXZlbnRUeXBlLk1PVVNFX1dIRUVMLCAoZTogV2hlZWxFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gdGhpcy5ncm91cFZpZXcuYWN0aXZlRWRpdG9yO1xuXHRcdFx0aWYgKCFhY3RpdmVFZGl0b3IgfHwgdGhpcy5ncm91cFZpZXcuY291bnQgPCAyKSB7XG5cdFx0XHRcdHJldHVybjsgIC8vIG5lZWQgYXQgbGVhc3QgMiBvcGVuIGVkaXRvcnNcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2hpZnQta2V5IGVuYWJsZXMgb3IgZGlzYWJsZXMgdGhpcyBiZWhhdmlvdXIgZGVwZW5kaW5nIG9uIHRoZSBzZXR0aW5nXG5cdFx0XHRpZiAodGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLnNjcm9sbFRvU3dpdGNoVGFicyA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRpZiAoZS5zaGlmdEtleSkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gJ29uJzogb25seSBlbmFibGUgdGhpcyB3aGVuIFNoaWZ0LWtleSBpcyBub3QgcHJlc3NlZFxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoIWUuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vICdvZmYnOiBvbmx5IGVuYWJsZSB0aGlzIHdoZW4gU2hpZnQta2V5IGlzIHByZXNzZWRcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZ25vcmUgZXZlbnQgaWYgdGhlIGxhc3Qgb25lIGhhcHBlbmVkIHRvbyByZWNlbnRseSAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzk2NDA5KVxuXHRcdFx0Ly8gVGhlIHJlc3RyaWN0aW9uIGlzIHJlbGF4ZWQgYWNjb3JkaW5nIHRvIHRoZSBhYnNvbHV0ZSB2YWx1ZSBvZiBgZGVsdGFYYCBhbmQgYGRlbHRhWWBcblx0XHRcdC8vIHRvIHN1cHBvcnQgZGlzY3JldGUgKG1vdXNlIHdoZWVsKSBhbmQgY29udGlndW91cyBzY3JvbGxpbmcgKHRvdWNocGFkKSBlcXVhbGx5IHdlbGxcblx0XHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cdFx0XHRpZiAobm93IC0gdGhpcy5sYXN0TW91c2VXaGVlbEV2ZW50VGltZSA8IE11bHRpRWRpdG9yVGFic0NvbnRyb2wuTU9VU0VfV0hFRUxfRVZFTlRfVEhSRVNIT0xEIC0gMiAqIChNYXRoLmFicyhlLmRlbHRhWCkgKyBNYXRoLmFicyhlLmRlbHRhWSkpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5sYXN0TW91c2VXaGVlbEV2ZW50VGltZSA9IG5vdztcblxuXHRcdFx0Ly8gRmlndXJlIG91dCBzY3JvbGxpbmcgZGlyZWN0aW9uIGJ1dCBpZ25vcmUgaXQgaWYgdG9vIHN1YnRsZVxuXHRcdFx0bGV0IHRhYlN3aXRjaERpcmVjdGlvbjogbnVtYmVyO1xuXHRcdFx0aWYgKGUuZGVsdGFYICsgZS5kZWx0YVkgPCAtIE11bHRpRWRpdG9yVGFic0NvbnRyb2wuTU9VU0VfV0hFRUxfRElTVEFOQ0VfVEhSRVNIT0xEKSB7XG5cdFx0XHRcdHRhYlN3aXRjaERpcmVjdGlvbiA9IC0xO1xuXHRcdFx0fSBlbHNlIGlmIChlLmRlbHRhWCArIGUuZGVsdGFZID4gTXVsdGlFZGl0b3JUYWJzQ29udHJvbC5NT1VTRV9XSEVFTF9ESVNUQU5DRV9USFJFU0hPTEQpIHtcblx0XHRcdFx0dGFiU3dpdGNoRGlyZWN0aW9uID0gMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV4dEVkaXRvciA9IHRoaXMuZ3JvdXBWaWV3LmdldEVkaXRvckJ5SW5kZXgodGhpcy5ncm91cFZpZXcuZ2V0SW5kZXhPZkVkaXRvcihhY3RpdmVFZGl0b3IpICsgdGFiU3dpdGNoRGlyZWN0aW9uKTtcblx0XHRcdGlmICghbmV4dEVkaXRvcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIE9wZW4gaXRcblx0XHRcdHRoaXMuZ3JvdXBWaWV3Lm9wZW5FZGl0b3IobmV4dEVkaXRvcik7XG5cblx0XHRcdC8vIERpc2FibGUgbm9ybWFsIHNjcm9sbGluZywgb3BlbmluZyB0aGUgZWRpdG9yIHdpbGwgYWxyZWFkeSByZXZlYWwgaXQgcHJvcGVybHlcblx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gQ29udGV4dCBtZW51XG5cdFx0Y29uc3Qgc2hvd0NvbnRleHRNZW51ID0gKGU6IEV2ZW50KSA9PiB7XG5cdFx0XHRFdmVudEhlbHBlci5zdG9wKGUpO1xuXG5cdFx0XHQvLyBGaW5kIHRhcmdldCBhbmNob3Jcblx0XHRcdGxldCBhbmNob3I6IEhUTUxFbGVtZW50IHwgU3RhbmRhcmRNb3VzZUV2ZW50ID0gdGFic0NvbnRhaW5lcjtcblx0XHRcdGlmIChpc01vdXNlRXZlbnQoZSkpIHtcblx0XHRcdFx0YW5jaG9yID0gbmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3codGhpcy5wYXJlbnQpLCBlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2hvdyBpdFxuXHRcdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBhbmNob3IsXG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLkVkaXRvclRhYnNCYXJDb250ZXh0LFxuXHRcdFx0XHRjb250ZXh0S2V5U2VydmljZTogdGhpcy5jb250ZXh0S2V5U2VydmljZSxcblx0XHRcdFx0bWVudUFjdGlvbk9wdGlvbnM6IHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSxcblx0XHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+ICh7IGdyb3VwSWQ6IHRoaXMuZ3JvdXBWaWV3LmlkIH0pLFxuXHRcdFx0XHRnZXRLZXlCaW5kaW5nOiBhY3Rpb24gPT4gdGhpcy5nZXRLZXliaW5kaW5nKGFjdGlvbiksXG5cdFx0XHRcdG9uSGlkZTogKCkgPT4gdGhpcy5ncm91cFZpZXcuZm9jdXMoKVxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YWJzQ29udGFpbmVyLCBUb3VjaEV2ZW50VHlwZS5Db250ZXh0bWVudSwgZSA9PiBzaG93Q29udGV4dE1lbnUoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFic0NvbnRhaW5lciwgRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgZSA9PiBzaG93Q29udGV4dE1lbnUoZSkpKTtcblx0fVxuXG5cdHByaXZhdGUgZG9IYW5kbGVEZWNvcmF0aW9uc0NoYW5nZSgpOiB2b2lkIHtcblxuXHRcdC8vIEEgY2hhbmdlIHRvIGRlY29yYXRpb25zIHBvdGVudGlhbGx5IGhhcyBhbiBpbXBhY3Qgb24gdGhlIHNpemUgb2YgdGFic1xuXHRcdC8vIHNvIHdlIG5lZWQgdG8gdHJpZ2dlciBhIGxheW91dCBpbiB0aGF0IGNhc2UgdG8gYWRqdXN0IHRoaW5nc1xuXHRcdHRoaXMubGF5b3V0KHRoaXMuZGltZW5zaW9ucyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlRWRpdG9yQWN0aW9uc1Rvb2xiYXIoKTogdm9pZCB7XG5cdFx0c3VwZXIudXBkYXRlRWRpdG9yQWN0aW9uc1Rvb2xiYXIoKTtcblxuXHRcdC8vIENoYW5naW5nIHRoZSBhY3Rpb25zIGluIHRoZSB0b29sYmFyIGNhbiBoYXZlIGFuIGltcGFjdCBvbiB0aGUgc2l6ZSBvZiB0aGVcblx0XHQvLyB0YWIgY29udGFpbmVyLCBzbyB3ZSBuZWVkIHRvIGxheW91dCB0aGUgdGFicyB0byBtYWtlIHN1cmUgdGhlIGFjdGl2ZSBpcyB2aXNpYmxlXG5cdFx0dGhpcy5sYXlvdXQodGhpcy5kaW1lbnNpb25zKTtcblx0fVxuXG5cdG9wZW5FZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCwgb3B0aW9ucz86IElJbnRlcm5hbEVkaXRvck9wZW5PcHRpb25zKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgY2hhbmdlZCA9IHRoaXMuaGFuZGxlT3BlbmVkRWRpdG9ycygpO1xuXG5cdFx0Ly8gUmVzcGVjdCBvcHRpb24gdG8gZm9jdXMgdGFiIGNvbnRyb2wgaWYgcHJvdmlkZWRcblx0XHRpZiAob3B0aW9ucz8uZm9jdXNUYWJDb250cm9sKSB7XG5cdFx0XHR0aGlzLndpdGhUYWIoZWRpdG9yLCAoZWRpdG9yLCB0YWJJbmRleCwgdGFiQ29udGFpbmVyKSA9PiB0YWJDb250YWluZXIuZm9jdXMoKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNoYW5nZWQ7XG5cdH1cblxuXHRvcGVuRWRpdG9ycyhlZGl0b3JzOiBFZGl0b3JJbnB1dFtdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaGFuZGxlT3BlbmVkRWRpdG9ycygpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVPcGVuZWRFZGl0b3JzKCk6IGJvb2xlYW4ge1xuXG5cdFx0Ly8gU2V0IHRhYnMgY29udHJvbCB2aXNpYmlsaXR5XG5cdFx0dGhpcy51cGRhdGVUYWJzQ29udHJvbFZpc2liaWxpdHkoKTtcblxuXHRcdC8vIENyZWF0ZSB0YWJzIGFzIG5lZWRlZFxuXHRcdGNvbnN0IFt0YWJzQ29udGFpbmVyLCB0YWJzU2Nyb2xsYmFyXSA9IGFzc2VydEFsbERlZmluZWQodGhpcy50YWJzQ29udGFpbmVyLCB0aGlzLnRhYnNTY3JvbGxiYXIpO1xuXHRcdGZvciAobGV0IGkgPSB0YWJzQ29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IHRoaXMudGFic01vZGVsLmNvdW50OyBpKyspIHtcblx0XHRcdHRhYnNDb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5jcmVhdGVUYWIoaSwgdGFic0NvbnRhaW5lciwgdGFic1Njcm9sbGJhcikpO1xuXHRcdH1cblxuXHRcdC8vIE1ha2Ugc3VyZSB0byByZWNvbXB1dGUgdGFiIGxhYmVscyBhbmQgZGV0ZWN0XG5cdFx0Ly8gaWYgYSBsYWJlbCBjaGFuZ2Ugb2NjdXJyZWQgdGhhdCByZXF1aXJlcyBhXG5cdFx0Ly8gcmVkcmF3IG9mIHRhYnMuXG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JDaGFuZ2VkID0gdGhpcy5kaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKTtcblx0XHRjb25zdCBvbGRUYWJMYWJlbHMgPSB0aGlzLnRhYkxhYmVscztcblx0XHR0aGlzLmNvbXB1dGVUYWJMYWJlbHMoKTtcblxuXHRcdC8vIFJlZHJhdyBhbmQgdXBkYXRlIGluIHRoZXNlIGNhc2VzXG5cdFx0bGV0IGRpZENoYW5nZSA9IGZhbHNlO1xuXHRcdGlmIChcblx0XHRcdGFjdGl2ZUVkaXRvckNoYW5nZWQgfHxcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gYWN0aXZlIGVkaXRvciBjaGFuZ2VkXG5cdFx0XHRvbGRUYWJMYWJlbHMubGVuZ3RoICE9PSB0aGlzLnRhYkxhYmVscy5sZW5ndGggfHxcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIG51bWJlciBvZiB0YWJzIGNoYW5nZWRcblx0XHRcdG9sZFRhYkxhYmVscy5zb21lKChsYWJlbCwgaW5kZXgpID0+ICF0aGlzLmVxdWFsc0VkaXRvcklucHV0TGFiZWwobGFiZWwsIHRoaXMudGFiTGFiZWxzLmF0KGluZGV4KSkpIFx0Ly8gZWRpdG9yIGxhYmVscyBjaGFuZ2VkXG5cdFx0KSB7XG5cdFx0XHR0aGlzLnJlZHJhdyh7IGZvcmNlUmV2ZWFsQWN0aXZlVGFiOiB0cnVlIH0pO1xuXHRcdFx0ZGlkQ2hhbmdlID0gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2Ugb25seSBsYXlvdXQgZm9yIHJldmVhbGluZ1xuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5sYXlvdXQodGhpcy5kaW1lbnNpb25zLCB7IGZvcmNlUmV2ZWFsQWN0aXZlVGFiOiB0cnVlIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBkaWRDaGFuZ2U7XG5cdH1cblxuXHRwcml2YXRlIGRpZEFjdGl2ZUVkaXRvckNoYW5nZSgpOiBib29sZWFuIHtcblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5hY3RpdmVUYWJMYWJlbD8uZWRpdG9yICYmIHRoaXMudGFic01vZGVsLmFjdGl2ZUVkaXRvciB8fCBcdFx0XHRcdFx0XHRcdC8vIGFjdGl2ZSBlZGl0b3IgY2hhbmdlZCBmcm9tIG51bGwgPT4gZWRpdG9yXG5cdFx0XHR0aGlzLmFjdGl2ZVRhYkxhYmVsPy5lZGl0b3IgJiYgIXRoaXMudGFic01vZGVsLmFjdGl2ZUVkaXRvciB8fCBcdFx0XHRcdFx0XHRcdC8vIGFjdGl2ZSBlZGl0b3IgY2hhbmdlZCBmcm9tIGVkaXRvciA9PiBudWxsXG5cdFx0XHQoIXRoaXMuYWN0aXZlVGFiTGFiZWw/LmVkaXRvciB8fCAhdGhpcy50YWJzTW9kZWwuaXNBY3RpdmUodGhpcy5hY3RpdmVUYWJMYWJlbC5lZGl0b3IpKVx0Ly8gYWN0aXZlIGVkaXRvciBjaGFuZ2VkIGZyb20gZWRpdG9yQSA9PiBlZGl0b3JCXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGVxdWFsc0VkaXRvcklucHV0TGFiZWwobGFiZWxBOiBJRWRpdG9ySW5wdXRMYWJlbCB8IHVuZGVmaW5lZCwgbGFiZWxCOiBJRWRpdG9ySW5wdXRMYWJlbCB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGlmIChsYWJlbEEgPT09IGxhYmVsQikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKCFsYWJlbEEgfHwgIWxhYmVsQikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiBsYWJlbEEubmFtZSA9PT0gbGFiZWxCLm5hbWUgJiZcblx0XHRcdGxhYmVsQS5kZXNjcmlwdGlvbiA9PT0gbGFiZWxCLmRlc2NyaXB0aW9uICYmXG5cdFx0XHRsYWJlbEEuZm9yY2VEZXNjcmlwdGlvbiA9PT0gbGFiZWxCLmZvcmNlRGVzY3JpcHRpb24gJiZcblx0XHRcdGxhYmVsQS50aXRsZSA9PT0gbGFiZWxCLnRpdGxlICYmXG5cdFx0XHRsYWJlbEEuYXJpYUxhYmVsID09PSBsYWJlbEIuYXJpYUxhYmVsO1xuXHR9XG5cblx0YmVmb3JlQ2xvc2VFZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQge1xuXG5cdFx0Ly8gRml4IHRhYnMgd2lkdGggaWYgdGhlIG1vdXNlIGlzIG92ZXIgdGFicyBhbmQgYmVmb3JlIGNsb3Npbmdcblx0XHQvLyBhIHRhYiAoZXhjZXB0IHRoZSBsYXN0IHRhYikgd2hlbiB0YWIgc2l6aW5nIGlzICdmaXhlZCcuXG5cdFx0Ly8gVGhpcyBoZWxwcyBrZWVwaW5nIHRoZSBjbG9zZSBidXR0b24gc3RhYmxlIHVuZGVyXG5cdFx0Ly8gdGhlIG1vdXNlIGFuZCBhbGxvd3MgZm9yIHJhcGlkIGNsb3Npbmcgb2YgdGFicy5cblxuXHRcdGlmICh0aGlzLmlzTW91c2VPdmVyVGFicyAmJiB0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnMudGFiU2l6aW5nID09PSAnZml4ZWQnKSB7XG5cdFx0XHRjb25zdCBjbG9zaW5nTGFzdFRhYiA9IHRoaXMudGFic01vZGVsLmlzTGFzdChlZGl0b3IpO1xuXHRcdFx0dGhpcy51cGRhdGVUYWJzRml4ZWRXaWR0aCghY2xvc2luZ0xhc3RUYWIpO1xuXHRcdH1cblx0fVxuXG5cdGNsb3NlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkIHtcblx0XHR0aGlzLmhhbmRsZUNsb3NlZEVkaXRvcnMoKTtcblx0fVxuXG5cdGNsb3NlRWRpdG9ycyhlZGl0b3JzOiBFZGl0b3JJbnB1dFtdKTogdm9pZCB7XG5cdFx0dGhpcy5oYW5kbGVDbG9zZWRFZGl0b3JzKCk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUNsb3NlZEVkaXRvcnMoKTogdm9pZCB7XG5cblx0XHQvLyBUaGVyZSBhcmUgdGFicyB0byBzaG93XG5cdFx0aWYgKHRoaXMudGFic01vZGVsLmNvdW50KSB7XG5cblx0XHRcdC8vIFJlbW92ZSB0YWJzIHRoYXQgZ290IGNsb3NlZFxuXHRcdFx0Y29uc3QgdGFic0NvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLnRhYnNDb250YWluZXIpO1xuXHRcdFx0d2hpbGUgKHRhYnNDb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID4gdGhpcy50YWJzTW9kZWwuY291bnQpIHtcblxuXHRcdFx0XHQvLyBSZW1vdmUgb25lIHRhYiBmcm9tIGNvbnRhaW5lciAobXVzdCBiZSB0aGUgbGFzdCB0byBrZWVwIGluZGV4ZXMgaW4gb3JkZXIhKVxuXHRcdFx0XHR0YWJzQ29udGFpbmVyLmxhc3RDaGlsZD8ucmVtb3ZlKCk7XG5cblx0XHRcdFx0Ly8gUmVtb3ZlIGFzc29jaWF0ZWQgdGFiIGxhYmVsIGFuZCB3aWRnZXRcblx0XHRcdFx0ZGlzcG9zZSh0aGlzLnRhYkRpc3Bvc2FibGVzLnBvcCgpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQSByZW1vdmFsIG9mIGEgbGFiZWwgcmVxdWlyZXMgdG8gcmVjb21wdXRlIGFsbCBsYWJlbHNcblx0XHRcdHRoaXMuY29tcHV0ZVRhYkxhYmVscygpO1xuXG5cdFx0XHQvLyBSZWRyYXcgYWxsIHRhYnNcblx0XHRcdHRoaXMucmVkcmF3KHsgZm9yY2VSZXZlYWxBY3RpdmVUYWI6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gTm8gdGFicyB0byBzaG93XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAodGhpcy50YWJzQ29udGFpbmVyKSB7XG5cdFx0XHRcdGNsZWFyTm9kZSh0aGlzLnRhYnNDb250YWluZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnRhYkRpc3Bvc2FibGVzID0gZGlzcG9zZSh0aGlzLnRhYkRpc3Bvc2FibGVzKTtcblx0XHRcdHRoaXMudGFiUmVzb3VyY2VMYWJlbHMuY2xlYXIoKTtcblx0XHRcdHRoaXMudGFiTGFiZWxzID0gW107XG5cdFx0XHR0aGlzLmFjdGl2ZVRhYkxhYmVsID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy50YWJBY3Rpb25CYXJzID0gW107XG5cblx0XHRcdHRoaXMuY2xlYXJFZGl0b3JBY3Rpb25zVG9vbGJhcigpO1xuXHRcdFx0dGhpcy51cGRhdGVUYWJzQ29udHJvbFZpc2liaWxpdHkoKTtcblx0XHR9XG5cdH1cblxuXHRtb3ZlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIGZyb21UYWJJbmRleDogbnVtYmVyLCB0YXJnZVRhYkluZGV4OiBudW1iZXIpOiB2b2lkIHtcblxuXHRcdC8vIE1vdmUgdGhlIGVkaXRvciBsYWJlbFxuXHRcdGNvbnN0IGVkaXRvckxhYmVsID0gdGhpcy50YWJMYWJlbHNbZnJvbVRhYkluZGV4XTtcblx0XHR0aGlzLnRhYkxhYmVscy5zcGxpY2UoZnJvbVRhYkluZGV4LCAxKTtcblx0XHR0aGlzLnRhYkxhYmVscy5zcGxpY2UodGFyZ2VUYWJJbmRleCwgMCwgZWRpdG9yTGFiZWwpO1xuXG5cdFx0Ly8gUmVkcmF3IHRhYnMgaW4gdGhlIHJhbmdlIG9mIHRoZSBtb3ZlXG5cdFx0dGhpcy5mb3JFYWNoVGFiKChlZGl0b3IsIHRhYkluZGV4LCB0YWJDb250YWluZXIsIHRhYkxhYmVsV2lkZ2V0LCB0YWJMYWJlbCwgdGFiQWN0aW9uQmFyKSA9PiB7XG5cdFx0XHR0aGlzLnJlZHJhd1RhYihlZGl0b3IsIHRhYkluZGV4LCB0YWJDb250YWluZXIsIHRhYkxhYmVsV2lkZ2V0LCB0YWJMYWJlbCwgdGFiQWN0aW9uQmFyKTtcblx0XHR9LFxuXHRcdFx0TWF0aC5taW4oZnJvbVRhYkluZGV4LCB0YXJnZVRhYkluZGV4KSwgXHQvLyBmcm9tOiBzbWFsbGVzdCBvZiBmcm9tVGFiSW5kZXgvdGFyZ2VUYWJJbmRleFxuXHRcdFx0TWF0aC5tYXgoZnJvbVRhYkluZGV4LCB0YXJnZVRhYkluZGV4KVx0Ly8gICB0bzogbGFyZ2VzdCBvZiBmcm9tVGFiSW5kZXgvdGFyZ2VUYWJJbmRleFxuXHRcdCk7XG5cblx0XHQvLyBNb3ZpbmcgYW4gZWRpdG9yIHJlcXVpcmVzIGEgbGF5b3V0IHRvIGtlZXAgdGhlIGFjdGl2ZSBlZGl0b3IgdmlzaWJsZVxuXHRcdHRoaXMubGF5b3V0KHRoaXMuZGltZW5zaW9ucywgeyBmb3JjZVJldmVhbEFjdGl2ZVRhYjogdHJ1ZSB9KTtcblx0fVxuXG5cdHBpbkVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZCB7XG5cdFx0dGhpcy53aXRoVGFiKGVkaXRvciwgKGVkaXRvciwgdGFiSW5kZXgsIHRhYkNvbnRhaW5lciwgdGFiTGFiZWxXaWRnZXQsIHRhYkxhYmVsKSA9PiB0aGlzLnJlZHJhd1RhYkxhYmVsKGVkaXRvciwgdGFiSW5kZXgsIHRhYkNvbnRhaW5lciwgdGFiTGFiZWxXaWRnZXQsIHRhYkxhYmVsKSk7XG5cdH1cblxuXHRzdGlja0VkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZCB7XG5cdFx0dGhpcy5kb0hhbmRsZVN0aWNreUVkaXRvckNoYW5nZShlZGl0b3IpO1xuXHR9XG5cblx0dW5zdGlja0VkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZCB7XG5cdFx0dGhpcy5kb0hhbmRsZVN0aWNreUVkaXRvckNoYW5nZShlZGl0b3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0hhbmRsZVN0aWNreUVkaXRvckNoYW5nZShlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZCB7XG5cblx0XHQvLyBVcGRhdGUgdGFiXG5cdFx0dGhpcy53aXRoVGFiKGVkaXRvciwgKGVkaXRvciwgdGFiSW5kZXgsIHRhYkNvbnRhaW5lciwgdGFiTGFiZWxXaWRnZXQsIHRhYkxhYmVsLCB0YWJBY3Rpb25CYXIpID0+IHRoaXMucmVkcmF3VGFiKGVkaXRvciwgdGFiSW5kZXgsIHRhYkNvbnRhaW5lciwgdGFiTGFiZWxXaWRnZXQsIHRhYkxhYmVsLCB0YWJBY3Rpb25CYXIpKTtcblxuXHRcdC8vIFN0aWNreSBjaGFuZ2UgaGFzIGFuIGltcGFjdCBvbiBlYWNoIHRhYidzIGJvcmRlciBiZWNhdXNlXG5cdFx0Ly8gaXQgcG90ZW50aWFsbHkgbW92ZXMgdGhlIGJvcmRlciB0byB0aGUgbGFzdCBwaW5uZWQgdGFiXG5cdFx0dGhpcy5mb3JFYWNoVGFiKChlZGl0b3IsIHRhYkluZGV4LCB0YWJDb250YWluZXIsIHRhYkxhYmVsV2lkZ2V0LCB0YWJMYWJlbCkgPT4ge1xuXHRcdFx0dGhpcy5yZWRyYXdUYWJCb3JkZXJzKHRhYkluZGV4LCB0YWJDb250YWluZXIpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gQSBjaGFuZ2UgdG8gdGhlIHN0aWNreSBzdGF0ZSByZXF1aXJlcyBhIGxheW91dCB0byBrZWVwIHRoZSBhY3RpdmUgZWRpdG9yIHZpc2libGVcblx0XHR0aGlzLmxheW91dCh0aGlzLmRpbWVuc2lvbnMsIHsgZm9yY2VSZXZlYWxBY3RpdmVUYWI6IHRydWUgfSk7XG5cdH1cblxuXHRzZXRBY3RpdmUoaXNHcm91cEFjdGl2ZTogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Ly8gQWN0aXZpdHkgaGFzIGFuIGltcGFjdCBvbiBlYWNoIHRhYidzIGFjdGl2ZSBpbmRpY2F0aW9uXG5cdFx0dGhpcy5mb3JFYWNoVGFiKChlZGl0b3IsIHRhYkluZGV4LCB0YWJDb250YWluZXIsIHRhYkxhYmVsV2lkZ2V0LCB0YWJMYWJlbCwgdGFiQWN0aW9uQmFyKSA9PiB7XG5cdFx0XHR0aGlzLnJlZHJhd1RhYlNlbGVjdGVkQWN0aXZlQW5kRGlydHkoaXNHcm91cEFjdGl2ZSwgZWRpdG9yLCB0YWJDb250YWluZXIsIHRhYkFjdGlvbkJhcik7XG5cdFx0fSk7XG5cblx0XHQvLyBBY3Rpdml0eSBoYXMgYW4gaW1wYWN0IG9uIHRoZSB0b29sYmFyLCBzbyB3ZSBuZWVkIHRvIHVwZGF0ZSBhbmQgbGF5b3V0XG5cdFx0dGhpcy51cGRhdGVFZGl0b3JBY3Rpb25zVG9vbGJhcigpO1xuXHRcdHRoaXMubGF5b3V0KHRoaXMuZGltZW5zaW9ucywgeyBmb3JjZVJldmVhbEFjdGl2ZVRhYjogdHJ1ZSB9KTtcblx0fVxuXG5cdHVwZGF0ZUVkaXRvclNlbGVjdGlvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5mb3JFYWNoVGFiKChlZGl0b3IsIHRhYkluZGV4LCB0YWJDb250YWluZXIsIHRhYkxhYmVsV2lkZ2V0LCB0YWJMYWJlbCwgdGFiQWN0aW9uQmFyKSA9PiB7XG5cdFx0XHR0aGlzLnJlZHJhd1RhYlNlbGVjdGVkQWN0aXZlQW5kRGlydHkodGhpcy5ncm91cHNWaWV3LmFjdGl2ZUdyb3VwID09PSB0aGlzLmdyb3VwVmlldywgZWRpdG9yLCB0YWJDb250YWluZXIsIHRhYkFjdGlvbkJhcik7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUVkaXRvckxhYmVsU2NoZWR1bGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5kb1VwZGF0ZUVkaXRvckxhYmVscygpLCAwKSk7XG5cblx0dXBkYXRlRWRpdG9yTGFiZWwoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQge1xuXG5cdFx0Ly8gVXBkYXRlIGFsbCBsYWJlbHMgdG8gYWNjb3VudCBmb3IgY2hhbmdlcyB0byB0YWIgbGFiZWxzXG5cdFx0Ly8gU2luY2UgdGhpcyBtZXRob2QgbWF5IGJlIGNhbGxlZCBhIGxvdCBvZiB0aW1lcyBmcm9tXG5cdFx0Ly8gaW5kaXZpZHVhbCBlZGl0b3JzLCB3ZSBjb2xsZWN0IGFsbCB0aG9zZSByZXF1ZXN0cyBhbmRcblx0XHQvLyB0aGVuIHJ1biB0aGUgdXBkYXRlIG9uY2UgYmVjYXVzZSB3ZSBoYXZlIHRvIHVwZGF0ZVxuXHRcdC8vIGFsbCBvcGVuZWQgdGFicyBpbiB0aGUgZ3JvdXAgYXQgb25jZS5cblx0XHR0aGlzLnVwZGF0ZUVkaXRvckxhYmVsU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdH1cblxuXHRwcml2YXRlIGRvVXBkYXRlRWRpdG9yTGFiZWxzKCk6IHZvaWQge1xuXG5cdFx0Ly8gQSBjaGFuZ2UgdG8gYSBsYWJlbCByZXF1aXJlcyB0byByZWNvbXB1dGUgYWxsIGxhYmVsc1xuXHRcdHRoaXMuY29tcHV0ZVRhYkxhYmVscygpO1xuXG5cdFx0Ly8gQXMgc3VjaCB3ZSBuZWVkIHRvIHJlZHJhdyBlYWNoIGxhYmVsXG5cdFx0dGhpcy5mb3JFYWNoVGFiKChlZGl0b3IsIHRhYkluZGV4LCB0YWJDb250YWluZXIsIHRhYkxhYmVsV2lkZ2V0LCB0YWJMYWJlbCkgPT4ge1xuXHRcdFx0dGhpcy5yZWRyYXdUYWJMYWJlbChlZGl0b3IsIHRhYkluZGV4LCB0YWJDb250YWluZXIsIHRhYkxhYmVsV2lkZ2V0LCB0YWJMYWJlbCk7XG5cdFx0fSk7XG5cblx0XHQvLyBBIGNoYW5nZSB0byBhIGxhYmVsIHJlcXVpcmVzIGEgbGF5b3V0IHRvIGtlZXAgdGhlIGFjdGl2ZSBlZGl0b3IgdmlzaWJsZVxuXHRcdHRoaXMubGF5b3V0KHRoaXMuZGltZW5zaW9ucyk7XG5cdH1cblxuXHR1cGRhdGVFZGl0b3JEaXJ0eShlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZCB7XG5cdFx0dGhpcy53aXRoVGFiKGVkaXRvciwgKGVkaXRvciwgdGFiSW5kZXgsIHRhYkNvbnRhaW5lciwgdGFiTGFiZWxXaWRnZXQsIHRhYkxhYmVsLCB0YWJBY3Rpb25CYXIpID0+IHRoaXMucmVkcmF3VGFiU2VsZWN0ZWRBY3RpdmVBbmREaXJ0eSh0aGlzLmdyb3Vwc1ZpZXcuYWN0aXZlR3JvdXAgPT09IHRoaXMuZ3JvdXBWaWV3LCBlZGl0b3IsIHRhYkNvbnRhaW5lciwgdGFiQWN0aW9uQmFyKSk7XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVPcHRpb25zKG9sZE9wdGlvbnM6IElFZGl0b3JQYXJ0T3B0aW9ucywgbmV3T3B0aW9uczogSUVkaXRvclBhcnRPcHRpb25zKTogdm9pZCB7XG5cdFx0c3VwZXIudXBkYXRlT3B0aW9ucyhvbGRPcHRpb25zLCBuZXdPcHRpb25zKTtcblxuXHRcdC8vIEEgY2hhbmdlIHRvIGEgbGFiZWwgZm9ybWF0IG9wdGlvbnMgcmVxdWlyZXMgdG8gcmVjb21wdXRlIGFsbCBsYWJlbHNcblx0XHRpZiAob2xkT3B0aW9ucy5sYWJlbEZvcm1hdCAhPT0gbmV3T3B0aW9ucy5sYWJlbEZvcm1hdCkge1xuXHRcdFx0dGhpcy5jb21wdXRlVGFiTGFiZWxzKCk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHRhYnMgc2Nyb2xsYmFyIHNpemluZ1xuXHRcdGlmIChvbGRPcHRpb25zLnRpdGxlU2Nyb2xsYmFyU2l6aW5nICE9PSBuZXdPcHRpb25zLnRpdGxlU2Nyb2xsYmFyU2l6aW5nKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRhYnNTY3JvbGxiYXJTaXppbmcoKTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgZWRpdG9yIGFjdGlvbnNcblx0XHRpZiAob2xkT3B0aW9ucy5hbHdheXNTaG93RWRpdG9yQWN0aW9ucyAhPT0gbmV3T3B0aW9ucy5hbHdheXNTaG93RWRpdG9yQWN0aW9ucykge1xuXHRcdFx0dGhpcy51cGRhdGVFZGl0b3JBY3Rpb25zVG9vbGJhcigpO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSB0YWJzIHNpemluZ1xuXHRcdGlmIChcblx0XHRcdG9sZE9wdGlvbnMudGFiU2l6aW5nRml4ZWRNaW5XaWR0aCAhPT0gbmV3T3B0aW9ucy50YWJTaXppbmdGaXhlZE1pbldpZHRoIHx8XG5cdFx0XHRvbGRPcHRpb25zLnRhYlNpemluZ0ZpeGVkTWF4V2lkdGggIT09IG5ld09wdGlvbnMudGFiU2l6aW5nRml4ZWRNYXhXaWR0aCB8fFxuXHRcdFx0b2xkT3B0aW9ucy50YWJTaXppbmcgIT09IG5ld09wdGlvbnMudGFiU2l6aW5nXG5cdFx0KSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRhYlNpemluZyh0cnVlKTtcblx0XHR9XG5cblx0XHQvLyBSZWRyYXcgdGFicyB3aGVuIG90aGVyIG9wdGlvbnMgY2hhbmdlXG5cdFx0aWYgKFxuXHRcdFx0b2xkT3B0aW9ucy5sYWJlbEZvcm1hdCAhPT0gbmV3T3B0aW9ucy5sYWJlbEZvcm1hdCB8fFxuXHRcdFx0b2xkT3B0aW9ucy50YWJBY3Rpb25Mb2NhdGlvbiAhPT0gbmV3T3B0aW9ucy50YWJBY3Rpb25Mb2NhdGlvbiB8fFxuXHRcdFx0b2xkT3B0aW9ucy50YWJBY3Rpb25DbG9zZVZpc2liaWxpdHkgIT09IG5ld09wdGlvbnMudGFiQWN0aW9uQ2xvc2VWaXNpYmlsaXR5IHx8XG5cdFx0XHRvbGRPcHRpb25zLnRhYkFjdGlvblVucGluVmlzaWJpbGl0eSAhPT0gbmV3T3B0aW9ucy50YWJBY3Rpb25VbnBpblZpc2liaWxpdHkgfHxcblx0XHRcdG9sZE9wdGlvbnMudGFiU2l6aW5nICE9PSBuZXdPcHRpb25zLnRhYlNpemluZyB8fFxuXHRcdFx0b2xkT3B0aW9ucy5waW5uZWRUYWJTaXppbmcgIT09IG5ld09wdGlvbnMucGlubmVkVGFiU2l6aW5nIHx8XG5cdFx0XHRvbGRPcHRpb25zLnNob3dJY29ucyAhPT0gbmV3T3B0aW9ucy5zaG93SWNvbnMgfHxcblx0XHRcdG9sZE9wdGlvbnMuaGFzSWNvbnMgIT09IG5ld09wdGlvbnMuaGFzSWNvbnMgfHxcblx0XHRcdG9sZE9wdGlvbnMuaGlnaGxpZ2h0TW9kaWZpZWRUYWJzICE9PSBuZXdPcHRpb25zLmhpZ2hsaWdodE1vZGlmaWVkVGFicyB8fFxuXHRcdFx0b2xkT3B0aW9ucy53cmFwVGFicyAhPT0gbmV3T3B0aW9ucy53cmFwVGFicyB8fFxuXHRcdFx0IWVxdWFscyhvbGRPcHRpb25zLmRlY29yYXRpb25zLCBuZXdPcHRpb25zLmRlY29yYXRpb25zKVxuXHRcdCkge1xuXHRcdFx0dGhpcy5yZWRyYXcoKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVTdHlsZXMoKTogdm9pZCB7XG5cdFx0dGhpcy5yZWRyYXcoKTtcblx0fVxuXG5cdHByaXZhdGUgZm9yRWFjaFRhYihmbjogKGVkaXRvcjogRWRpdG9ySW5wdXQsIHRhYkluZGV4OiBudW1iZXIsIHRhYkNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHRhYkxhYmVsV2lkZ2V0OiBJUmVzb3VyY2VMYWJlbCwgdGFiTGFiZWw6IElFZGl0b3JJbnB1dExhYmVsLCB0YWJBY3Rpb25CYXI6IEFjdGlvbkJhcikgPT4gdm9pZCwgZnJvbVRhYkluZGV4PzogbnVtYmVyLCB0b1RhYkluZGV4PzogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy50YWJzTW9kZWwuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkuZm9yRWFjaCgoZWRpdG9yOiBFZGl0b3JJbnB1dCwgdGFiSW5kZXg6IG51bWJlcikgPT4ge1xuXHRcdFx0aWYgKHR5cGVvZiBmcm9tVGFiSW5kZXggPT09ICdudW1iZXInICYmIGZyb21UYWJJbmRleCA+IHRhYkluZGV4KSB7XG5cdFx0XHRcdHJldHVybjsgLy8gZG8gbm90aGluZyBpZiB3ZSBhcmUgbm90IHlldCBhdCBgZnJvbUluZGV4YFxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHlwZW9mIHRvVGFiSW5kZXggPT09ICdudW1iZXInICYmIHRvVGFiSW5kZXggPCB0YWJJbmRleCkge1xuXHRcdFx0XHRyZXR1cm47IC8vIGRvIG5vdGhpbmcgaWYgd2UgYXJlIGJleW9uZCBgdG9JbmRleGBcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5kb1dpdGhUYWIodGFiSW5kZXgsIGVkaXRvciwgZm4pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB3aXRoVGFiKGVkaXRvcjogRWRpdG9ySW5wdXQsIGZuOiAoZWRpdG9yOiBFZGl0b3JJbnB1dCwgdGFiSW5kZXg6IG51bWJlciwgdGFiQ29udGFpbmVyOiBIVE1MRWxlbWVudCwgdGFiTGFiZWxXaWRnZXQ6IElSZXNvdXJjZUxhYmVsLCB0YWJMYWJlbDogSUVkaXRvcklucHV0TGFiZWwsIHRhYkFjdGlvbkJhcjogQWN0aW9uQmFyKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0dGhpcy5kb1dpdGhUYWIodGhpcy50YWJzTW9kZWwuaW5kZXhPZihlZGl0b3IpLCBlZGl0b3IsIGZuKTtcblx0fVxuXG5cdHByaXZhdGUgZG9XaXRoVGFiKHRhYkluZGV4OiBudW1iZXIsIGVkaXRvcjogRWRpdG9ySW5wdXQsIGZuOiAoZWRpdG9yOiBFZGl0b3JJbnB1dCwgdGFiSW5kZXg6IG51bWJlciwgdGFiQ29udGFpbmVyOiBIVE1MRWxlbWVudCwgdGFiTGFiZWxXaWRnZXQ6IElSZXNvdXJjZUxhYmVsLCB0YWJMYWJlbDogSUVkaXRvcklucHV0TGFiZWwsIHRhYkFjdGlvbkJhcjogQWN0aW9uQmFyKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3QgdGFic0NvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLnRhYnNDb250YWluZXIpO1xuXHRcdGNvbnN0IHRhYkNvbnRhaW5lciA9IHRhYnNDb250YWluZXIuY2hpbGRyZW5bdGFiSW5kZXhdIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IHRhYlJlc291cmNlTGFiZWwgPSB0aGlzLnRhYlJlc291cmNlTGFiZWxzLmdldCh0YWJJbmRleCk7XG5cdFx0Y29uc3QgdGFiTGFiZWwgPSB0aGlzLnRhYkxhYmVsc1t0YWJJbmRleF07XG5cdFx0Y29uc3QgdGFiQWN0aW9uQmFyID0gdGhpcy50YWJBY3Rpb25CYXJzW3RhYkluZGV4XTtcblx0XHRpZiAodGFiQ29udGFpbmVyICYmIHRhYlJlc291cmNlTGFiZWwgJiYgdGFiTGFiZWwpIHtcblx0XHRcdGZuKGVkaXRvciwgdGFiSW5kZXgsIHRhYkNvbnRhaW5lciwgdGFiUmVzb3VyY2VMYWJlbCwgdGFiTGFiZWwsIHRhYkFjdGlvbkJhcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUYWIodGFiSW5kZXg6IG51bWJlciwgdGFic0NvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHRhYnNTY3JvbGxiYXI6IFNjcm9sbGFibGVFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXG5cdFx0Ly8gVGFiIENvbnRhaW5lclxuXHRcdGNvbnN0IHRhYkNvbnRhaW5lciA9ICQoJy50YWInLCB7XG5cdFx0XHRkcmFnZ2FibGU6IHRydWUsXG5cdFx0XHRyb2xlOiAndGFiJ1xuXHRcdH0pO1xuXG5cdFx0Ly8gR2VzdHVyZSBTdXBwb3J0XG5cdFx0dGhpcy5fcmVnaXN0ZXIoR2VzdHVyZS5hZGRUYXJnZXQodGFiQ29udGFpbmVyKSk7XG5cblx0XHQvLyBUYWIgQm9yZGVyIFRvcFxuXHRcdGNvbnN0IHRhYkJvcmRlclRvcENvbnRhaW5lciA9ICQoJy50YWItYm9yZGVyLXRvcC1jb250YWluZXInKTtcblx0XHR0YWJDb250YWluZXIuYXBwZW5kQ2hpbGQodGFiQm9yZGVyVG9wQ29udGFpbmVyKTtcblxuXHRcdC8vIFRhYiBFZGl0b3IgTGFiZWxcblx0XHRjb25zdCBlZGl0b3JMYWJlbCA9IHRoaXMudGFiUmVzb3VyY2VMYWJlbHMuY3JlYXRlKHRhYkNvbnRhaW5lciwgeyBob3ZlclRhcmdldE92ZXJyaWRlOiB0YWJDb250YWluZXIgfSk7XG5cblx0XHQvLyBUYWIgQWN0aW9uc1xuXHRcdGNvbnN0IHRhYkFjdGlvbnNDb250YWluZXIgPSAkKCcudGFiLWFjdGlvbnMnKTtcblx0XHR0YWJDb250YWluZXIuYXBwZW5kQ2hpbGQodGFiQWN0aW9uc0NvbnRhaW5lcik7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCB0YWJBY3Rpb25SdW5uZXIgPSBuZXcgRWRpdG9yQ29tbWFuZHNDb250ZXh0QWN0aW9uUnVubmVyKHtcblx0XHRcdGdyb3VwSWQ6IHRoaXMuZ3JvdXBWaWV3LmlkLFxuXHRcdFx0Z2V0IGVkaXRvckluZGV4KCkgeyByZXR1cm4gdGhhdC50b0VkaXRvckluZGV4KHRhYkluZGV4KTsgfVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGFiQWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcih0YWJBY3Rpb25zQ29udGFpbmVyLCB7IGFyaWFMYWJlbDogbG9jYWxpemUoJ2FyaWFMYWJlbFRhYkFjdGlvbnMnLCBcIlRhYiBhY3Rpb25zXCIpLCBhY3Rpb25SdW5uZXI6IHRhYkFjdGlvblJ1bm5lciB9KTtcblx0XHRjb25zdCB0YWJBY3Rpb25MaXN0ZW5lciA9IHRhYkFjdGlvbkJhci5vbldpbGxSdW4oZSA9PiB7XG5cdFx0XHRpZiAoZS5hY3Rpb24uaWQgPT09IHRoaXMuY2xvc2VFZGl0b3JBY3Rpb24uaWQpIHtcblx0XHRcdFx0dGhpcy5ibG9ja1JldmVhbEFjdGl2ZVRhYk9uY2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHRhYkFjdGlvbkJhckRpc3Bvc2FibGUgPSBjb21iaW5lZERpc3Bvc2FibGUodGFiQWN0aW9uUnVubmVyLCB0YWJBY3Rpb25CYXIsIHRhYkFjdGlvbkxpc3RlbmVyLCB0b0Rpc3Bvc2FibGUoaW5zZXJ0KHRoaXMudGFiQWN0aW9uQmFycywgdGFiQWN0aW9uQmFyKSkpO1xuXG5cdFx0Ly8gVGFiIEZhZGUgSGlkZXJcblx0XHQvLyBIaWRlcyB0aGUgdGFiIGZhZGUgdG8gdGhlIHJpZ2h0IHdoZW4gdGFiIGFjdGlvbiBsZWZ0IGFuZCBzaXppbmcgc2hyaW5rL2ZpeGVkLCA6OmFmdGVyLCA6OmJlZm9yZSBhcmUgYWxyZWFkeSB1c2VkXG5cdFx0Y29uc3QgdGFiU2hhZG93SGlkZXIgPSAkKCcudGFiLWZhZGUtaGlkZXInKTtcblx0XHR0YWJDb250YWluZXIuYXBwZW5kQ2hpbGQodGFiU2hhZG93SGlkZXIpO1xuXG5cdFx0Ly8gVGFiIEJvcmRlciBCb3R0b21cblx0XHRjb25zdCB0YWJCb3JkZXJCb3R0b21Db250YWluZXIgPSAkKCcudGFiLWJvcmRlci1ib3R0b20tY29udGFpbmVyJyk7XG5cdFx0dGFiQ29udGFpbmVyLmFwcGVuZENoaWxkKHRhYkJvcmRlckJvdHRvbUNvbnRhaW5lcik7XG5cblx0XHQvLyBFdmVudGluZ1xuXHRcdGNvbnN0IGV2ZW50c0Rpc3Bvc2FibGUgPSB0aGlzLnJlZ2lzdGVyVGFiTGlzdGVuZXJzKHRhYkNvbnRhaW5lciwgdGFiSW5kZXgsIHRhYnNDb250YWluZXIsIHRhYnNTY3JvbGxiYXIpO1xuXG5cdFx0dGhpcy50YWJEaXNwb3NhYmxlcy5wdXNoKGNvbWJpbmVkRGlzcG9zYWJsZShldmVudHNEaXNwb3NhYmxlLCB0YWJBY3Rpb25CYXJEaXNwb3NhYmxlLCB0YWJBY3Rpb25SdW5uZXIsIGVkaXRvckxhYmVsKSk7XG5cblx0XHRyZXR1cm4gdGFiQ29udGFpbmVyO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0VkaXRvckluZGV4KHRhYkluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXG5cdFx0Ly8gR2l2ZW4gYSBgdGFiSW5kZXhgIHRoYXQgaXMgcmVsYXRpdmUgdG8gdGhlIHRhYnMgbW9kZWxcblx0XHQvLyByZXR1cm5zIHRoZSBgZWRpdG9ySW5kZXhgIHJlbGF0aXZlIHRvIHRoZSBlbnRpcmUgZ3JvdXBcblxuXHRcdGNvbnN0IGVkaXRvciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLnRhYnNNb2RlbC5nZXRFZGl0b3JCeUluZGV4KHRhYkluZGV4KSk7XG5cblx0XHRyZXR1cm4gdGhpcy5ncm91cFZpZXcuZ2V0SW5kZXhPZkVkaXRvcihlZGl0b3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBsYXN0U2luZ2xlU2VsZWN0U2VsZWN0ZWRFZGl0b3I6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlZ2lzdGVyVGFiTGlzdGVuZXJzKHRhYjogSFRNTEVsZW1lbnQsIHRhYkluZGV4OiBudW1iZXIsIHRhYnNDb250YWluZXI6IEhUTUxFbGVtZW50LCB0YWJzU2Nyb2xsYmFyOiBTY3JvbGxhYmxlRWxlbWVudCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IGhhbmRsZUNsaWNrT3JUb3VjaCA9IGFzeW5jIChlOiBNb3VzZUV2ZW50IHwgR2VzdHVyZUV2ZW50LCBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiA9PiB7XG5cdFx0XHR0YWIuYmx1cigpOyAvLyBwcmV2ZW50IGZsaWNrZXIgb2YgZm9jdXMgb3V0bGluZSBvbiB0YWIgdW50aWwgZWRpdG9yIGdvdCBmb2N1c1xuXG5cdFx0XHRpZiAoaXNNb3VzZUV2ZW50KGUpICYmIChlLmJ1dHRvbiAhPT0gMCAvKiBtaWRkbGUvcmlnaHQgbW91c2UgYnV0dG9uICovIHx8IChpc01hY2ludG9zaCAmJiBlLmN0cmxLZXkgLyogbWFjT1MgY29udGV4dCBtZW51ICovKSkpIHtcblx0XHRcdFx0aWYgKGUuYnV0dG9uID09PSAxKSB7XG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyByZXF1aXJlZCB0byBwcmV2ZW50IGF1dG8tc2Nyb2xsaW5nIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTY2OTApXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLm9yaWdpbmF0ZXNGcm9tVGFiQWN0aW9uQmFyKGUpKSB7XG5cdFx0XHRcdHJldHVybjsgLy8gbm90IHdoZW4gY2xpY2tpbmcgb24gYWN0aW9uc1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBPcGVuIHRhYnMgZWRpdG9yXG5cdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLnRhYnNNb2RlbC5nZXRFZGl0b3JCeUluZGV4KHRhYkluZGV4KTtcblx0XHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdFx0aWYgKGUuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHRsZXQgYW5jaG9yOiBFZGl0b3JJbnB1dDtcblx0XHRcdFx0XHRpZiAodGhpcy5sYXN0U2luZ2xlU2VsZWN0U2VsZWN0ZWRFZGl0b3IgJiYgdGhpcy50YWJzTW9kZWwuaXNTZWxlY3RlZCh0aGlzLmxhc3RTaW5nbGVTZWxlY3RTZWxlY3RlZEVkaXRvcikpIHtcblx0XHRcdFx0XHRcdC8vIFRoZSBsYXN0IHNlbGVjdGVkIGVkaXRvciBpcyB0aGUgYW5jaG9yXG5cdFx0XHRcdFx0XHRhbmNob3IgPSB0aGlzLmxhc3RTaW5nbGVTZWxlY3RTZWxlY3RlZEVkaXRvcjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gVGhlIGFjdGl2ZSBlZGl0b3IgaXMgdGhlIGFuY2hvclxuXHRcdFx0XHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuZ3JvdXBWaWV3LmFjdGl2ZUVkaXRvcik7XG5cdFx0XHRcdFx0XHR0aGlzLmxhc3RTaW5nbGVTZWxlY3RTZWxlY3RlZEVkaXRvciA9IGFjdGl2ZUVkaXRvcjtcblx0XHRcdFx0XHRcdGFuY2hvciA9IGFjdGl2ZUVkaXRvcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5zZWxlY3RFZGl0b3JzQmV0d2VlbihlZGl0b3IsIGFuY2hvcik7XG5cdFx0XHRcdH0gZWxzZSBpZiAoKGUuY3RybEtleSAmJiAhaXNNYWNpbnRvc2gpIHx8IChlLm1ldGFLZXkgJiYgaXNNYWNpbnRvc2gpKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMudGFic01vZGVsLmlzU2VsZWN0ZWQoZWRpdG9yKSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy51bnNlbGVjdEVkaXRvcihlZGl0b3IpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnNlbGVjdEVkaXRvcihlZGl0b3IpO1xuXHRcdFx0XHRcdFx0dGhpcy5sYXN0U2luZ2xlU2VsZWN0U2VsZWN0ZWRFZGl0b3IgPSBlZGl0b3I7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIEV2ZW4gaWYgZm9jdXMgaXMgcHJlc2VydmVkIG1ha2Ugc3VyZSB0byBhY3RpdmF0ZSB0aGUgZ3JvdXAuXG5cdFx0XHRcdFx0Ly8gSWYgYSBuZXcgYWN0aXZlIGVkaXRvciBpcyBzZWxlY3RlZCwga2VlcCB0aGUgY3VycmVudCBzZWxlY3Rpb24gb24ga2V5XG5cdFx0XHRcdFx0Ly8gZG93biBzdWNoIHRoYXQgZHJhZyBhbmQgZHJvcCBjYW4gb3BlcmF0ZSBvdmVyIHRoZSBzZWxlY3Rpb24uIFRoZSBzZWxlY3Rpb25cblx0XHRcdFx0XHQvLyBpcyByZW1vdmVkIG9uIGtleSB1cCBpbiB0aGlzIGNhc2UuXG5cdFx0XHRcdFx0Y29uc3QgaW5hY3RpdmVTZWxlY3Rpb24gPSB0aGlzLnRhYnNNb2RlbC5pc1NlbGVjdGVkKGVkaXRvcikgPyB0aGlzLmdyb3VwVmlldy5zZWxlY3RlZEVkaXRvcnMuZmlsdGVyKGUgPT4gIWUubWF0Y2hlcyhlZGl0b3IpKSA6IFtdO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZ3JvdXBWaWV3Lm9wZW5FZGl0b3IoZWRpdG9yLCB7IHByZXNlcnZlRm9jdXMsIGFjdGl2YXRpb246IEVkaXRvckFjdGl2YXRpb24uQUNUSVZBVEUgfSwgeyBpbmFjdGl2ZVNlbGVjdGlvbiwgZm9jdXNUYWJDb250cm9sOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHNob3dDb250ZXh0TWVudSA9IChlOiBFdmVudCkgPT4ge1xuXHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlKTtcblxuXHRcdFx0Y29uc3QgZWRpdG9yID0gdGhpcy50YWJzTW9kZWwuZ2V0RWRpdG9yQnlJbmRleCh0YWJJbmRleCk7XG5cdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMub25UYWJDb250ZXh0TWVudShlZGl0b3IsIGUsIHRhYik7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIE9wZW4gb24gQ2xpY2sgLyBUb3VjaFxuXHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFiLCBFdmVudFR5cGUuTU9VU0VfRE9XTiwgZSA9PiBoYW5kbGVDbGlja09yVG91Y2goZSwgZmFsc2UpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YWIsIFRvdWNoRXZlbnRUeXBlLlRhcCwgKGU6IEdlc3R1cmVFdmVudCkgPT4gaGFuZGxlQ2xpY2tPclRvdWNoKGUsIHRydWUpKSk7IC8vIFByZXNlcnZlIGZvY3VzIG9uIHRvdWNoICMxMjU0NzBcblxuXHRcdC8vIFRvdWNoIFNjcm9sbCBTdXBwb3J0XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YWIsIFRvdWNoRXZlbnRUeXBlLkNoYW5nZSwgKGU6IEdlc3R1cmVFdmVudCkgPT4ge1xuXHRcdFx0dGFic1Njcm9sbGJhci5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbExlZnQ6IHRhYnNTY3JvbGxiYXIuZ2V0U2Nyb2xsUG9zaXRpb24oKS5zY3JvbGxMZWZ0IC0gZS50cmFuc2xhdGlvblggfSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gVXBkYXRlIHNlbGVjdGlvbiAmIHByZXZlbnQgZmxpY2tlciBvZiBmb2N1cyBvdXRsaW5lIG9uIHRhYiB1bnRpbCBlZGl0b3IgZ290IGZvY3VzXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YWIsIEV2ZW50VHlwZS5NT1VTRV9VUCwgYXN5bmMgZSA9PiB7XG5cdFx0XHRFdmVudEhlbHBlci5zdG9wKGUpO1xuXG5cdFx0XHR0YWIuYmx1cigpO1xuXG5cdFx0XHRpZiAoaXNNb3VzZUV2ZW50KGUpICYmIChlLmJ1dHRvbiAhPT0gMCAvKiBtaWRkbGUvcmlnaHQgbW91c2UgYnV0dG9uICovIHx8IChpc01hY2ludG9zaCAmJiBlLmN0cmxLZXkgLyogbWFjT1MgY29udGV4dCBtZW51ICovKSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5vcmlnaW5hdGVzRnJvbVRhYkFjdGlvbkJhcihlKSkge1xuXHRcdFx0XHRyZXR1cm47IC8vIG5vdCB3aGVuIGNsaWNraW5nIG9uIGFjdGlvbnNcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaXNDdHJsQ21kID0gKGUuY3RybEtleSAmJiAhaXNNYWNpbnRvc2gpIHx8IChlLm1ldGFLZXkgJiYgaXNNYWNpbnRvc2gpO1xuXHRcdFx0aWYgKCFpc0N0cmxDbWQgJiYgIWUuc2hpZnRLZXkgJiYgdGhpcy5ncm91cFZpZXcuc2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51bnNlbGVjdEFsbEVkaXRvcnMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBDbG9zZSBvbiBtb3VzZSBtaWRkbGUgY2xpY2tcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhYiwgRXZlbnRUeXBlLkFVWENMSUNLLCBlID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbiA9PT0gMSAvKiBNaWRkbGUgQnV0dG9uKi8pIHtcblx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlIC8qIGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNTY3MTUgKi8pO1xuXG5cdFx0XHRcdGNvbnN0IGVkaXRvciA9IHRoaXMudGFic01vZGVsLmdldEVkaXRvckJ5SW5kZXgodGFiSW5kZXgpO1xuXHRcdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdFx0aWYgKHByZXZlbnRFZGl0b3JDbG9zZSh0aGlzLnRhYnNNb2RlbCwgZWRpdG9yLCBFZGl0b3JDbG9zZU1ldGhvZC5NT1VTRSwgdGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuYmxvY2tSZXZlYWxBY3RpdmVUYWJPbmNlKCk7XG5cdFx0XHRcdFx0dGhpcy5jbG9zZUVkaXRvckFjdGlvbi5ydW4oeyBncm91cElkOiB0aGlzLmdyb3VwVmlldy5pZCwgZWRpdG9ySW5kZXg6IHRoaXMuZ3JvdXBWaWV3LmdldEluZGV4T2ZFZGl0b3IoZWRpdG9yKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIENvbnRleHQgbWVudSBvbiBTaGlmdCtGMTBcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhYiwgRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGlmIChldmVudC5zaGlmdEtleSAmJiBldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkYxMCkge1xuXHRcdFx0XHRzaG93Q29udGV4dE1lbnUoZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gQ29udGV4dCBtZW51IG9uIHRvdWNoIGNvbnRleHQgbWVudSBnZXN0dXJlXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YWIsIFRvdWNoRXZlbnRUeXBlLkNvbnRleHRtZW51LCAoZTogR2VzdHVyZUV2ZW50KSA9PiB7XG5cdFx0XHRzaG93Q29udGV4dE1lbnUoZSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gS2V5Ym9hcmQgYWNjZXNzaWJpbGl0eVxuXHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFiLCBFdmVudFR5cGUuS0VZX1VQLCBlID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGxldCBoYW5kbGVkID0gZmFsc2U7XG5cblx0XHRcdC8vIFJ1biBhY3Rpb24gb24gRW50ZXIvU3BhY2Vcblx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5FbnRlcikgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuU3BhY2UpKSB7XG5cdFx0XHRcdGhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLnRhYnNNb2RlbC5nZXRFZGl0b3JCeUluZGV4KHRhYkluZGV4KTtcblx0XHRcdFx0aWYgKGVkaXRvcikge1xuXHRcdFx0XHRcdHRoaXMuZ3JvdXBWaWV3Lm9wZW5FZGl0b3IoZWRpdG9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBOYXZpZ2F0ZSBpbiBlZGl0b3JzXG5cdFx0XHRlbHNlIGlmIChbS2V5Q29kZS5MZWZ0QXJyb3csIEtleUNvZGUuUmlnaHRBcnJvdywgS2V5Q29kZS5VcEFycm93LCBLZXlDb2RlLkRvd25BcnJvdywgS2V5Q29kZS5Ib21lLCBLZXlDb2RlLkVuZF0uc29tZShrYiA9PiBldmVudC5lcXVhbHMoa2IpKSkge1xuXHRcdFx0XHRsZXQgZWRpdG9ySW5kZXggPSB0aGlzLnRvRWRpdG9ySW5kZXgodGFiSW5kZXgpO1xuXHRcdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuTGVmdEFycm93KSB8fCBldmVudC5lcXVhbHMoS2V5Q29kZS5VcEFycm93KSkge1xuXHRcdFx0XHRcdGVkaXRvckluZGV4ID0gZWRpdG9ySW5kZXggLSAxO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLlJpZ2h0QXJyb3cpIHx8IGV2ZW50LmVxdWFscyhLZXlDb2RlLkRvd25BcnJvdykpIHtcblx0XHRcdFx0XHRlZGl0b3JJbmRleCA9IGVkaXRvckluZGV4ICsgMTtcblx0XHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Ib21lKSkge1xuXHRcdFx0XHRcdGVkaXRvckluZGV4ID0gMDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlZGl0b3JJbmRleCA9IHRoaXMuZ3JvdXBWaWV3LmNvdW50IC0gMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHRhcmdldCA9IHRoaXMuZ3JvdXBWaWV3LmdldEVkaXRvckJ5SW5kZXgoZWRpdG9ySW5kZXgpO1xuXHRcdFx0XHRpZiAodGFyZ2V0KSB7XG5cdFx0XHRcdFx0aGFuZGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5ncm91cFZpZXcub3BlbkVkaXRvcih0YXJnZXQsIHsgcHJlc2VydmVGb2N1czogdHJ1ZSB9LCB7IGZvY3VzVGFiQ29udHJvbDogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaGFuZGxlZCkge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBtb3ZpbmcgaW4gdGhlIHRhYnMgY29udGFpbmVyIGNhbiBoYXZlIGFuIGltcGFjdCBvbiBzY3JvbGxpbmcgcG9zaXRpb24sIHNvIHdlIG5lZWQgdG8gdXBkYXRlIHRoZSBjdXN0b20gc2Nyb2xsYmFyXG5cdFx0XHR0YWJzU2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHtcblx0XHRcdFx0c2Nyb2xsTGVmdDogdGFic0NvbnRhaW5lci5zY3JvbGxMZWZ0XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHQvLyBEb3VibGUgY2xpY2s6IGVpdGhlciBwaW4gb3IgdG9nZ2xlIG1heGltaXplZFxuXHRcdGZvciAoY29uc3QgZXZlbnRUeXBlIG9mIFtUb3VjaEV2ZW50VHlwZS5UYXAsIEV2ZW50VHlwZS5EQkxDTElDS10pIHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFiLCBldmVudFR5cGUsIChlOiBNb3VzZUV2ZW50IHwgR2VzdHVyZUV2ZW50KSA9PiB7XG5cdFx0XHRcdGlmIChldmVudFR5cGUgPT09IEV2ZW50VHlwZS5EQkxDTElDSykge1xuXHRcdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoKDxHZXN0dXJlRXZlbnQ+ZSkudGFwQ291bnQgIT09IDIpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGlnbm9yZSBzaW5nbGUgdGFwc1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gdGhpcy50YWJzTW9kZWwuZ2V0RWRpdG9yQnlJbmRleCh0YWJJbmRleCk7XG5cdFx0XHRcdGlmIChlZGl0b3IgJiYgdGhpcy50YWJzTW9kZWwuaXNQaW5uZWQoZWRpdG9yKSkge1xuXHRcdFx0XHRcdHN3aXRjaCAodGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLmRvdWJsZUNsaWNrVGFiVG9Ub2dnbGVFZGl0b3JHcm91cFNpemVzKSB7XG5cdFx0XHRcdFx0XHRjYXNlICdtYXhpbWl6ZSc6XG5cdFx0XHRcdFx0XHRcdHRoaXMuZ3JvdXBzVmlldy50b2dnbGVNYXhpbWl6ZUdyb3VwKHRoaXMuZ3JvdXBWaWV3KTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRjYXNlICdleHBhbmQnOlxuXHRcdFx0XHRcdFx0XHR0aGlzLmdyb3Vwc1ZpZXcudG9nZ2xlRXhwYW5kR3JvdXAodGhpcy5ncm91cFZpZXcpO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdGNhc2UgJ29mZic6XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuZ3JvdXBWaWV3LnBpbkVkaXRvcihlZGl0b3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0Ly8gQ29udGV4dCBtZW51XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0YWIsIEV2ZW50VHlwZS5DT05URVhUX01FTlUsIGUgPT4ge1xuXHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdFx0Y29uc3QgZWRpdG9yID0gdGhpcy50YWJzTW9kZWwuZ2V0RWRpdG9yQnlJbmRleCh0YWJJbmRleCk7XG5cdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMub25UYWJDb250ZXh0TWVudShlZGl0b3IsIGUsIHRhYik7XG5cdFx0XHR9XG5cdFx0fSwgdHJ1ZSAvKiB1c2UgY2FwdHVyZSB0byBmaXggaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE5MTQ1ICovKSk7XG5cblx0XHQvLyBEcmFnICYgRHJvcCBzdXBwb3J0XG5cdFx0bGV0IGxhc3REcmFnRXZlbnQ6IERyYWdFdmVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgaXNOZXdXaW5kb3dPcGVyYXRpb24gPSBmYWxzZTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobmV3IERyYWdBbmREcm9wT2JzZXJ2ZXIodGFiLCB7XG5cdFx0XHRvbkRyYWdTdGFydDogZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvciA9IHRoaXMudGFic01vZGVsLmdldEVkaXRvckJ5SW5kZXgodGFiSW5kZXgpO1xuXHRcdFx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlzTmV3V2luZG93T3BlcmF0aW9uID0gdGhpcy5pc05ld1dpbmRvd09wZXJhdGlvbihlKTtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRFZGl0b3JzID0gdGhpcy5ncm91cFZpZXcuc2VsZWN0ZWRFZGl0b3JzO1xuXHRcdFx0XHR0aGlzLmVkaXRvclRyYW5zZmVyLnNldERhdGEoc2VsZWN0ZWRFZGl0b3JzLm1hcChlID0+IG5ldyBEcmFnZ2VkRWRpdG9ySWRlbnRpZmllcih7IGVkaXRvcjogZSwgZ3JvdXBJZDogdGhpcy5ncm91cFZpZXcuaWQgfSkpLCBEcmFnZ2VkRWRpdG9ySWRlbnRpZmllci5wcm90b3R5cGUpO1xuXG5cdFx0XHRcdGlmIChlLmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0XHRcdGUuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSAnY29weU1vdmUnO1xuXHRcdFx0XHRcdGlmIChzZWxlY3RlZEVkaXRvcnMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSBgJHtlZGl0b3IuZ2V0TmFtZSgpfSArICR7c2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCAtIDF9YDtcblx0XHRcdFx0XHRcdGFwcGx5RHJhZ0ltYWdlKGUsIHRhYiwgbGFiZWwpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlLmRhdGFUcmFuc2Zlci5zZXREcmFnSW1hZ2UodGFiLCAwLCAwKTsgLy8gdG9wIGxlZnQgY29ybmVyIG9mIGRyYWdnZWQgdGFiIHNldCB0byBjdXJzb3IgcG9zaXRpb24gdG8gbWFrZSByb29tIGZvciBkcm9wLWJvcmRlciBmZWVkYmFja1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEFwcGx5IHNvbWUgZGF0YXRyYW5zZmVyIHR5cGVzIHRvIGFsbG93IGZvciBkcmFnZ2luZyB0aGUgZWxlbWVudCBvdXRzaWRlIG9mIHRoZSBhcHBsaWNhdGlvblxuXHRcdFx0XHR0aGlzLmRvRmlsbFJlc291cmNlRGF0YVRyYW5zZmVycyhzZWxlY3RlZEVkaXRvcnMsIGUsIGlzTmV3V2luZG93T3BlcmF0aW9uKTtcblxuXHRcdFx0XHRzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKGdldFdpbmRvdyh0aGlzLnBhcmVudCksICgpID0+IHRoaXMudXBkYXRlRHJvcEZlZWRiYWNrKHRhYiwgZmFsc2UsIGUsIHRhYkluZGV4KSk7XG5cdFx0XHR9LFxuXG5cdFx0XHRvbkRyYWc6IGUgPT4ge1xuXHRcdFx0XHRsYXN0RHJhZ0V2ZW50ID0gZTtcblx0XHRcdH0sXG5cblx0XHRcdG9uRHJhZ0VudGVyOiBlID0+IHtcblxuXHRcdFx0XHQvLyBSZXR1cm4gaWYgdHJhbnNmZXIgaXMgdW5zdXBwb3J0ZWRcblx0XHRcdFx0aWYgKCF0aGlzLmlzU3VwcG9ydGVkRHJvcFRyYW5zZmVyKGUpKSB7XG5cdFx0XHRcdFx0aWYgKGUuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRcdFx0XHRlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ25vbmUnO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFVwZGF0ZSB0aGUgZHJvcEVmZmVjdCB0byBcImNvcHlcIiBpZiB0aGVyZSBpcyBubyBsb2NhbCBkYXRhIHRvIGJlIGRyYWdnZWQgYmVjYXVzZVxuXHRcdFx0XHQvLyBpbiB0aGF0IGNhc2Ugd2UgY2FuIG9ubHkgY29weSB0aGUgZGF0YSBpbnRvIGFuZCBub3QgbW92ZSBpdCBmcm9tIGl0cyBzb3VyY2Vcblx0XHRcdFx0aWYgKCF0aGlzLmVkaXRvclRyYW5zZmVyLmhhc0RhdGEoRHJhZ2dlZEVkaXRvcklkZW50aWZpZXIucHJvdG90eXBlKSkge1xuXHRcdFx0XHRcdGlmIChlLmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0XHRcdFx0ZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdjb3B5Jztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnVwZGF0ZURyb3BGZWVkYmFjayh0YWIsIHRydWUsIGUsIHRhYkluZGV4KTtcblx0XHRcdH0sXG5cblx0XHRcdG9uRHJhZ092ZXI6IChlLCBkcmFnRHVyYXRpb24pID0+IHtcblx0XHRcdFx0aWYgKGRyYWdEdXJhdGlvbiA+PSBNdWx0aUVkaXRvclRhYnNDb250cm9sLkRSQUdfT1ZFUl9PUEVOX1RBQl9USFJFU0hPTEQpIHtcblx0XHRcdFx0XHRjb25zdCBkcmFnZ2VkT3ZlclRhYiA9IHRoaXMudGFic01vZGVsLmdldEVkaXRvckJ5SW5kZXgodGFiSW5kZXgpO1xuXHRcdFx0XHRcdGlmIChkcmFnZ2VkT3ZlclRhYiAmJiB0aGlzLnRhYnNNb2RlbC5hY3RpdmVFZGl0b3IgIT09IGRyYWdnZWRPdmVyVGFiKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmdyb3VwVmlldy5vcGVuRWRpdG9yKGRyYWdnZWRPdmVyVGFiLCB7IHByZXNlcnZlRm9jdXM6IHRydWUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy51cGRhdGVEcm9wRmVlZGJhY2sodGFiLCB0cnVlLCBlLCB0YWJJbmRleCk7XG5cdFx0XHR9LFxuXG5cdFx0XHRvbkRyYWdFbmQ6IGFzeW5jIGUgPT4ge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZURyb3BGZWVkYmFjayh0YWIsIGZhbHNlLCBlLCB0YWJJbmRleCk7XG5cdFx0XHRcdGNvbnN0IGRyYWdnZWRFZGl0b3JzID0gdGhpcy5lZGl0b3JUcmFuc2Zlci5nZXREYXRhKERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHRcdHRoaXMuZWRpdG9yVHJhbnNmZXIuY2xlYXJEYXRhKERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdCFpc05ld1dpbmRvd09wZXJhdGlvbiB8fFxuXHRcdFx0XHRcdGlzV2luZG93RHJhZ2dlZE92ZXIoKSB8fFxuXHRcdFx0XHRcdCFkcmFnZ2VkRWRpdG9ycyB8fFxuXHRcdFx0XHRcdGRyYWdnZWRFZGl0b3JzLmxlbmd0aCA9PT0gMFxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGRyYWcgdG8gb3BlbiBpbiBuZXcgd2luZG93IGlzIGRpc2FibGVkXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBhdXhpbGlhcnlFZGl0b3JQYXJ0ID0gYXdhaXQgdGhpcy5tYXliZUNyZWF0ZUF1eGlsaWFyeUVkaXRvclBhcnRBdChlLCB0YWIpO1xuXHRcdFx0XHRpZiAoIWF1eGlsaWFyeUVkaXRvclBhcnQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB0YXJnZXRHcm91cCA9IGF1eGlsaWFyeUVkaXRvclBhcnQuYWN0aXZlR3JvdXA7XG5cdFx0XHRcdGNvbnN0IGVkaXRvcnNXaXRoT3B0aW9ucyA9IHByZXBhcmVNb3ZlQ29weUVkaXRvcnModGhpcy5ncm91cFZpZXcsIGRyYWdnZWRFZGl0b3JzLm1hcChlZGl0b3IgPT4gZWRpdG9yLmlkZW50aWZpZXIuZWRpdG9yKSk7XG5cdFx0XHRcdGlmICh0aGlzLmlzTW92ZU9wZXJhdGlvbihsYXN0RHJhZ0V2ZW50ID8/IGUsIHRhcmdldEdyb3VwLmlkLCBkcmFnZ2VkRWRpdG9yc1swXS5pZGVudGlmaWVyLmVkaXRvcikpIHtcblx0XHRcdFx0XHR0aGlzLmdyb3VwVmlldy5tb3ZlRWRpdG9ycyhlZGl0b3JzV2l0aE9wdGlvbnMsIHRhcmdldEdyb3VwKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmdyb3VwVmlldy5jb3B5RWRpdG9ycyhlZGl0b3JzV2l0aE9wdGlvbnMsIHRhcmdldEdyb3VwKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRhcmdldEdyb3VwLmZvY3VzKCk7XG5cdFx0XHR9LFxuXG5cdFx0XHRvbkRyb3A6IGUgPT4ge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZURyb3BGZWVkYmFjayh0YWIsIGZhbHNlLCBlLCB0YWJJbmRleCk7XG5cblx0XHRcdFx0Ly8gY29tcHV0ZSB0aGUgdGFyZ2V0IGluZGV4XG5cdFx0XHRcdGxldCB0YXJnZXRJbmRleCA9IHRhYkluZGV4O1xuXHRcdFx0XHRpZiAodGhpcy5nZXRUYWJEcmFnT3ZlckxvY2F0aW9uKGUsIHRhYikgPT09ICdyaWdodCcpIHtcblx0XHRcdFx0XHR0YXJnZXRJbmRleCsrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5vbkRyb3AoZSwgdGFyZ2V0SW5kZXgsIHRhYnNDb250YWluZXIpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgaXNTdXBwb3J0ZWREcm9wVHJhbnNmZXIoZTogRHJhZ0V2ZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuZ3JvdXBUcmFuc2Zlci5oYXNEYXRhKERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXIucHJvdG90eXBlKSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMuZ3JvdXBUcmFuc2Zlci5nZXREYXRhKERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXIucHJvdG90eXBlKTtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGRhdGEpICYmIGRhdGEubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBncm91cCA9IGRhdGFbMF07XG5cdFx0XHRcdGlmIChncm91cC5pZGVudGlmaWVyID09PSB0aGlzLmdyb3VwVmlldy5pZCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTsgLy8gZ3JvdXBzIGNhbm5vdCBiZSBkcm9wcGVkIG9uIGdyb3VwIGl0IG9yaWdpbmF0ZXMgZnJvbVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmVkaXRvclRyYW5zZmVyLmhhc0RhdGEoRHJhZ2dlZEVkaXRvcklkZW50aWZpZXIucHJvdG90eXBlKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIChsb2NhbCkgZWRpdG9ycyBjYW4gYWx3YXlzIGJlIGRyb3BwZWRcblx0XHR9XG5cblx0XHRpZiAoZS5kYXRhVHJhbnNmZXIgJiYgZS5kYXRhVHJhbnNmZXIudHlwZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIG9wdGltaXN0aWNhbGx5IGFsbG93IGV4dGVybmFsIGRhdGEgKC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjU3ODkpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVEcm9wRmVlZGJhY2soZWxlbWVudDogSFRNTEVsZW1lbnQsIGlzRE5EOiBib29sZWFuLCBlOiBEcmFnRXZlbnQsIHRhYkluZGV4PzogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgaXNUYWIgPSAodHlwZW9mIHRhYkluZGV4ID09PSAnbnVtYmVyJyk7XG5cblx0XHRsZXQgZHJvcFRhcmdldDtcblx0XHRpZiAoaXNETkQpIHtcblx0XHRcdGlmIChpc1RhYikge1xuXHRcdFx0XHRkcm9wVGFyZ2V0ID0gdGhpcy5jb21wdXRlRHJvcFRhcmdldChlLCB0YWJJbmRleCwgZWxlbWVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkcm9wVGFyZ2V0ID0geyBsZWZ0RWxlbWVudDogZWxlbWVudC5sYXN0RWxlbWVudENoaWxkIGFzIEhUTUxFbGVtZW50LCByaWdodEVsZW1lbnQ6IHVuZGVmaW5lZCB9O1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRkcm9wVGFyZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlRHJvcFRhcmdldChkcm9wVGFyZ2V0KTtcblx0fVxuXG5cdHByaXZhdGUgZHJvcFRhcmdldDogeyBsZWZ0RWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7IHJpZ2h0RWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB1cGRhdGVEcm9wVGFyZ2V0KG5ld1RhcmdldDogeyBsZWZ0RWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7IHJpZ2h0RWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IG9sZFRhcmdldHMgPSB0aGlzLmRyb3BUYXJnZXQ7XG5cdFx0aWYgKG9sZFRhcmdldHMgPT09IG5ld1RhcmdldCB8fCBvbGRUYXJnZXRzICYmIG5ld1RhcmdldCAmJiBvbGRUYXJnZXRzLmxlZnRFbGVtZW50ID09PSBuZXdUYXJnZXQubGVmdEVsZW1lbnQgJiYgb2xkVGFyZ2V0cy5yaWdodEVsZW1lbnQgPT09IG5ld1RhcmdldC5yaWdodEVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkcm9wQ2xhc3NMZWZ0ID0gJ2Ryb3AtdGFyZ2V0LWxlZnQnO1xuXHRcdGNvbnN0IGRyb3BDbGFzc1JpZ2h0ID0gJ2Ryb3AtdGFyZ2V0LXJpZ2h0JztcblxuXHRcdGlmIChvbGRUYXJnZXRzKSB7XG5cdFx0XHRvbGRUYXJnZXRzLmxlZnRFbGVtZW50Py5jbGFzc0xpc3QucmVtb3ZlKGRyb3BDbGFzc0xlZnQpO1xuXHRcdFx0b2xkVGFyZ2V0cy5yaWdodEVsZW1lbnQ/LmNsYXNzTGlzdC5yZW1vdmUoZHJvcENsYXNzUmlnaHQpO1xuXHRcdH1cblxuXHRcdGlmIChuZXdUYXJnZXQpIHtcblx0XHRcdG5ld1RhcmdldC5sZWZ0RWxlbWVudD8uY2xhc3NMaXN0LmFkZChkcm9wQ2xhc3NMZWZ0KTtcblx0XHRcdG5ld1RhcmdldC5yaWdodEVsZW1lbnQ/LmNsYXNzTGlzdC5hZGQoZHJvcENsYXNzUmlnaHQpO1xuXHRcdH1cblxuXHRcdHRoaXMuZHJvcFRhcmdldCA9IG5ld1RhcmdldDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VGFiRHJhZ092ZXJMb2NhdGlvbihlOiBEcmFnRXZlbnQsIHRhYjogSFRNTEVsZW1lbnQpOiAnbGVmdCcgfCAncmlnaHQnIHtcblx0XHRjb25zdCByZWN0ID0gdGFiLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGNvbnN0IG9mZnNldFhSZWxhdGl2ZVRvUGFyZW50ID0gZS5jbGllbnRYIC0gcmVjdC5sZWZ0O1xuXG5cdFx0cmV0dXJuIG9mZnNldFhSZWxhdGl2ZVRvUGFyZW50IDw9IHJlY3Qud2lkdGggLyAyID8gJ2xlZnQnIDogJ3JpZ2h0Jztcblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZURyb3BUYXJnZXQoZTogRHJhZ0V2ZW50LCB0YWJJbmRleDogbnVtYmVyLCB0YXJnZXRUYWI6IEhUTUxFbGVtZW50KTogeyBsZWZ0RWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7IHJpZ2h0RWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaXNMZWZ0U2lkZU9mVGFiID0gdGhpcy5nZXRUYWJEcmFnT3ZlckxvY2F0aW9uKGUsIHRhcmdldFRhYikgPT09ICdsZWZ0Jztcblx0XHRjb25zdCBpc0xhc3RUYWIgPSB0YWJJbmRleCA9PT0gdGhpcy50YWJzTW9kZWwuY291bnQgLSAxO1xuXHRcdGNvbnN0IGlzRmlyc3RUYWIgPSB0YWJJbmRleCA9PT0gMDtcblxuXHRcdC8vIEJlZm9yZSBmaXJzdCB0YWJcblx0XHRpZiAoaXNMZWZ0U2lkZU9mVGFiICYmIGlzRmlyc3RUYWIpIHtcblx0XHRcdHJldHVybiB7IGxlZnRFbGVtZW50OiB1bmRlZmluZWQsIHJpZ2h0RWxlbWVudDogdGFyZ2V0VGFiIH07XG5cdFx0fVxuXG5cdFx0Ly8gQWZ0ZXIgbGFzdCB0YWJcblx0XHRpZiAoIWlzTGVmdFNpZGVPZlRhYiAmJiBpc0xhc3RUYWIpIHtcblx0XHRcdHJldHVybiB7IGxlZnRFbGVtZW50OiB0YXJnZXRUYWIsIHJpZ2h0RWxlbWVudDogdW5kZWZpbmVkIH07XG5cdFx0fVxuXG5cdFx0Ly8gQmV0d2VlbiB0d28gdGFic1xuXHRcdGNvbnN0IHRhYkJlZm9yZSA9IGlzTGVmdFNpZGVPZlRhYiA/IHRhcmdldFRhYi5wcmV2aW91c0VsZW1lbnRTaWJsaW5nIDogdGFyZ2V0VGFiO1xuXHRcdGNvbnN0IHRhYkFmdGVyID0gaXNMZWZ0U2lkZU9mVGFiID8gdGFyZ2V0VGFiIDogdGFyZ2V0VGFiLm5leHRFbGVtZW50U2libGluZztcblxuXHRcdHJldHVybiB7IGxlZnRFbGVtZW50OiB0YWJCZWZvcmUgYXMgSFRNTEVsZW1lbnQsIHJpZ2h0RWxlbWVudDogdGFiQWZ0ZXIgYXMgSFRNTEVsZW1lbnQgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2VsZWN0RWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5ncm91cFZpZXcuaXNBY3RpdmUoZWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuZ3JvdXBWaWV3LnNldFNlbGVjdGlvbihlZGl0b3IsIHRoaXMuZ3JvdXBWaWV3LnNlbGVjdGVkRWRpdG9ycyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNlbGVjdEVkaXRvcnNCZXR3ZWVuKHRhcmdldDogRWRpdG9ySW5wdXQsIGFuY2hvcjogRWRpdG9ySW5wdXQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JJbmRleCA9IHRoaXMuZ3JvdXBWaWV3LmdldEluZGV4T2ZFZGl0b3IodGFyZ2V0KTtcblx0XHRpZiAoZWRpdG9ySW5kZXggPT09IC0xKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYW5jaG9yRWRpdG9ySW5kZXggPSB0aGlzLmdyb3VwVmlldy5nZXRJbmRleE9mRWRpdG9yKGFuY2hvcik7XG5cdFx0aWYgKGFuY2hvckVkaXRvckluZGV4ID09PSAtMSkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpO1xuXHRcdH1cblxuXHRcdGxldCBzZWxlY3Rpb24gPSB0aGlzLmdyb3VwVmlldy5zZWxlY3RlZEVkaXRvcnM7XG5cblx0XHQvLyBVbnNlbGVjdCBlZGl0b3JzIG9uIG90aGVyIHNpZGUgb2YgYW5jaG9yIGluIHJlbGF0aW9uIHRvIHRoZSB0YXJnZXRcblx0XHRsZXQgY3VycmVudEVkaXRvckluZGV4ID0gYW5jaG9yRWRpdG9ySW5kZXg7XG5cdFx0d2hpbGUgKGN1cnJlbnRFZGl0b3JJbmRleCA+PSAwICYmIGN1cnJlbnRFZGl0b3JJbmRleCA8PSB0aGlzLmdyb3VwVmlldy5jb3VudCAtIDEpIHtcblx0XHRcdGN1cnJlbnRFZGl0b3JJbmRleCA9IGFuY2hvckVkaXRvckluZGV4IDwgZWRpdG9ySW5kZXggPyBjdXJyZW50RWRpdG9ySW5kZXggLSAxIDogY3VycmVudEVkaXRvckluZGV4ICsgMTtcblxuXHRcdFx0Y29uc3QgY3VycmVudEVkaXRvciA9IHRoaXMuZ3JvdXBWaWV3LmdldEVkaXRvckJ5SW5kZXgoY3VycmVudEVkaXRvckluZGV4KTtcblx0XHRcdGlmICghY3VycmVudEVkaXRvcikge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLmdyb3VwVmlldy5pc1NlbGVjdGVkKGN1cnJlbnRFZGl0b3IpKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRzZWxlY3Rpb24gPSBzZWxlY3Rpb24uZmlsdGVyKGVkaXRvciA9PiAhZWRpdG9yLm1hdGNoZXMoY3VycmVudEVkaXRvcikpO1xuXHRcdH1cblxuXHRcdC8vIFNlbGVjdCBlZGl0b3JzIGJldHdlZW4gYW5jaG9yIGFuZCB0YXJnZXRcblx0XHRjb25zdCBmcm9tRWRpdG9ySW5kZXggPSBhbmNob3JFZGl0b3JJbmRleCA8IGVkaXRvckluZGV4ID8gYW5jaG9yRWRpdG9ySW5kZXggOiBlZGl0b3JJbmRleDtcblx0XHRjb25zdCB0b0VkaXRvckluZGV4ID0gYW5jaG9yRWRpdG9ySW5kZXggPCBlZGl0b3JJbmRleCA/IGVkaXRvckluZGV4IDogYW5jaG9yRWRpdG9ySW5kZXg7XG5cblx0XHRjb25zdCBlZGl0b3JzVG9TZWxlY3QgPSB0aGlzLmdyb3VwVmlldy5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5zbGljZShmcm9tRWRpdG9ySW5kZXgsIHRvRWRpdG9ySW5kZXggKyAxKTtcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBlZGl0b3JzVG9TZWxlY3QpIHtcblx0XHRcdGlmICghdGhpcy5ncm91cFZpZXcuaXNTZWxlY3RlZChlZGl0b3IpKSB7XG5cdFx0XHRcdHNlbGVjdGlvbi5wdXNoKGVkaXRvcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5hY3RpdmVTZWxlY3RlZEVkaXRvcnMgPSBzZWxlY3Rpb24uZmlsdGVyKGVkaXRvciA9PiAhZWRpdG9yLm1hdGNoZXModGFyZ2V0KSk7XG5cdFx0YXdhaXQgdGhpcy5ncm91cFZpZXcuc2V0U2VsZWN0aW9uKHRhcmdldCwgaW5hY3RpdmVTZWxlY3RlZEVkaXRvcnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1bnNlbGVjdEVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaXNVbnNlbGVjdGluZ0FjdGl2ZUVkaXRvciA9IHRoaXMuZ3JvdXBWaWV3LmlzQWN0aXZlKGVkaXRvcik7XG5cblx0XHQvLyBJZiB0aGVyZSBpcyBvbmx5IG9uZSBlZGl0b3Igc2VsZWN0ZWQsIGRvIG5vdCB1bnNlbGVjdCBpdFxuXHRcdGlmIChpc1Vuc2VsZWN0aW5nQWN0aXZlRWRpdG9yICYmIHRoaXMuZ3JvdXBWaWV3LnNlbGVjdGVkRWRpdG9ycy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgbmV3QWN0aXZlRWRpdG9yID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuZ3JvdXBWaWV3LmFjdGl2ZUVkaXRvcik7XG5cblx0XHQvLyBJZiBhY3RpdmUgZWRpdG9yIGlzIGJpbmcgdW5zZWxlY3RlZCB0aGVuIGZpbmQgdGhlIG1vc3QgcmVjZW50bHkgb3BlbmVkIHNlbGVjdGVkIGVkaXRvclxuXHRcdC8vIHRoYXQgaXMgbm90IHRoZSBlZGl0b3IgYmVpbmcgdW5zZWxlY3RlZFxuXHRcdGlmIChpc1Vuc2VsZWN0aW5nQWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRjb25zdCByZWNlbnRFZGl0b3JzID0gdGhpcy5ncm91cFZpZXcuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCByZWNlbnRFZGl0b3JzLmxlbmd0aDsgaSsrKSB7IC8vIEZpcnN0IG9uZSBpcyB0aGUgYWN0aXZlIGVkaXRvclxuXHRcdFx0XHRjb25zdCByZWNlbnRFZGl0b3IgPSByZWNlbnRFZGl0b3JzW2ldO1xuXHRcdFx0XHRpZiAodGhpcy5ncm91cFZpZXcuaXNTZWxlY3RlZChyZWNlbnRFZGl0b3IpKSB7XG5cdFx0XHRcdFx0bmV3QWN0aXZlRWRpdG9yID0gcmVjZW50RWRpdG9yO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5hY3RpdmVTZWxlY3RlZEVkaXRvcnMgPSB0aGlzLmdyb3VwVmlldy5zZWxlY3RlZEVkaXRvcnMuZmlsdGVyKGUgPT4gIWUubWF0Y2hlcyhlZGl0b3IpICYmICFlLm1hdGNoZXMobmV3QWN0aXZlRWRpdG9yKSk7XG5cdFx0YXdhaXQgdGhpcy5ncm91cFZpZXcuc2V0U2VsZWN0aW9uKG5ld0FjdGl2ZUVkaXRvciwgaW5hY3RpdmVTZWxlY3RlZEVkaXRvcnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1bnNlbGVjdEFsbEVkaXRvcnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuZ3JvdXBWaWV3LnNlbGVjdGVkRWRpdG9ycy5sZW5ndGggPiAxKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5ncm91cFZpZXcuYWN0aXZlRWRpdG9yKTtcblx0XHRcdGF3YWl0IHRoaXMuZ3JvdXBWaWV3LnNldFNlbGVjdGlvbihhY3RpdmVFZGl0b3IsIFtdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVUYWJMYWJlbHMoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBsYWJlbEZvcm1hdCB9ID0gdGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zO1xuXHRcdGNvbnN0IHsgdmVyYm9zaXR5LCBzaG9ydGVuRHVwbGljYXRlcyB9ID0gdGhpcy5nZXRMYWJlbENvbmZpZ0ZsYWdzKGxhYmVsRm9ybWF0KTtcblxuXHRcdC8vIEJ1aWxkIGxhYmVscyBhbmQgZGVzY3JpcHRpb25zIGZvciBlYWNoIGVkaXRvclxuXHRcdGNvbnN0IGxhYmVsczogSUVkaXRvcklucHV0TGFiZWxbXSA9IFtdO1xuXHRcdGxldCBhY3RpdmVFZGl0b3JUYWJJbmRleCA9IC0xO1xuXHRcdHRoaXMudGFic01vZGVsLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpLmZvckVhY2goKGVkaXRvcjogRWRpdG9ySW5wdXQsIHRhYkluZGV4OiBudW1iZXIpID0+IHtcblx0XHRcdGxhYmVscy5wdXNoKHtcblx0XHRcdFx0ZWRpdG9yLFxuXHRcdFx0XHRuYW1lOiBlZGl0b3IuZ2V0TmFtZSgpLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogZWRpdG9yLmdldERlc2NyaXB0aW9uKHZlcmJvc2l0eSksXG5cdFx0XHRcdGZvcmNlRGVzY3JpcHRpb246IGVkaXRvci5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLkZvcmNlRGVzY3JpcHRpb24pLFxuXHRcdFx0XHR0aXRsZTogZWRpdG9yLmdldFRpdGxlKFZlcmJvc2l0eS5MT05HKSxcblx0XHRcdFx0YXJpYUxhYmVsOiBjb21wdXRlRWRpdG9yQXJpYUxhYmVsKGVkaXRvciwgdGFiSW5kZXgsIHRoaXMuZ3JvdXBWaWV3LCB0aGlzLmVkaXRvclBhcnRzVmlldy5jb3VudClcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoZWRpdG9yID09PSB0aGlzLnRhYnNNb2RlbC5hY3RpdmVFZGl0b3IpIHtcblx0XHRcdFx0YWN0aXZlRWRpdG9yVGFiSW5kZXggPSB0YWJJbmRleDtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIFNob3J0ZW4gbGFiZWxzIGFzIG5lZWRlZFxuXHRcdGlmIChzaG9ydGVuRHVwbGljYXRlcykge1xuXHRcdFx0dGhpcy5zaG9ydGVuVGFiTGFiZWxzKGxhYmVscyk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtZW1iZXIgZm9yIGZhc3QgbG9va3VwXG5cdFx0dGhpcy50YWJMYWJlbHMgPSBsYWJlbHM7XG5cdFx0dGhpcy5hY3RpdmVUYWJMYWJlbCA9IGxhYmVsc1thY3RpdmVFZGl0b3JUYWJJbmRleF07XG5cdH1cblxuXHRwcml2YXRlIHNob3J0ZW5UYWJMYWJlbHMobGFiZWxzOiBJRWRpdG9ySW5wdXRMYWJlbFtdKTogdm9pZCB7XG5cblx0XHQvLyBHYXRoZXIgZHVwbGljYXRlIHRpdGxlcywgd2hpbGUgZmlsdGVyaW5nIG91dCBpbnZhbGlkIGRlc2NyaXB0aW9uc1xuXHRcdGNvbnN0IG1hcE5hbWVUb0R1cGxpY2F0ZXMgPSBuZXcgTWFwPHN0cmluZywgSUVkaXRvcklucHV0TGFiZWxbXT4oKTtcblx0XHRmb3IgKGNvbnN0IGxhYmVsIG9mIGxhYmVscykge1xuXHRcdFx0aWYgKHR5cGVvZiBsYWJlbC5kZXNjcmlwdGlvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Z2V0T3JTZXQobWFwTmFtZVRvRHVwbGljYXRlcywgbGFiZWwubmFtZSwgW10pLnB1c2gobGFiZWwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGFiZWwuZGVzY3JpcHRpb24gPSAnJztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJZGVudGlmeSBkdXBsaWNhdGUgbmFtZXMgYW5kIHNob3J0ZW4gZGVzY3JpcHRpb25zXG5cdFx0Zm9yIChjb25zdCBbLCBkdXBsaWNhdGVMYWJlbHNdIG9mIG1hcE5hbWVUb0R1cGxpY2F0ZXMpIHtcblxuXHRcdFx0Ly8gUmVtb3ZlIGRlc2NyaXB0aW9uIGlmIHRoZSB0aXRsZSBpc24ndCBkdXBsaWNhdGVkXG5cdFx0XHQvLyBhbmQgd2UgaGF2ZSBubyBpbmRpY2F0aW9uIHRvIGVuZm9yY2UgZGVzY3JpcHRpb25cblx0XHRcdGlmIChkdXBsaWNhdGVMYWJlbHMubGVuZ3RoID09PSAxICYmICFkdXBsaWNhdGVMYWJlbHNbMF0uZm9yY2VEZXNjcmlwdGlvbikge1xuXHRcdFx0XHRkdXBsaWNhdGVMYWJlbHNbMF0uZGVzY3JpcHRpb24gPSAnJztcblxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWRlbnRpZnkgZHVwbGljYXRlIGRlc2NyaXB0aW9uc1xuXHRcdFx0Y29uc3QgbWFwRGVzY3JpcHRpb25Ub0R1cGxpY2F0ZXMgPSBuZXcgTWFwPHN0cmluZywgSUVkaXRvcklucHV0TGFiZWxbXT4oKTtcblx0XHRcdGZvciAoY29uc3QgZHVwbGljYXRlTGFiZWwgb2YgZHVwbGljYXRlTGFiZWxzKSB7XG5cdFx0XHRcdGdldE9yU2V0KG1hcERlc2NyaXB0aW9uVG9EdXBsaWNhdGVzLCBkdXBsaWNhdGVMYWJlbC5kZXNjcmlwdGlvbiwgW10pLnB1c2goZHVwbGljYXRlTGFiZWwpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBGb3IgZWRpdG9ycyB3aXRoIGR1cGxpY2F0ZSBkZXNjcmlwdGlvbnMsIGNoZWNrIHdoZXRoZXIgYW55IGxvbmcgZGVzY3JpcHRpb25zIGRpZmZlclxuXHRcdFx0bGV0IHVzZUxvbmdEZXNjcmlwdGlvbnMgPSBmYWxzZTtcblx0XHRcdGZvciAoY29uc3QgWywgZHVwbGljYXRlTGFiZWxzXSBvZiBtYXBEZXNjcmlwdGlvblRvRHVwbGljYXRlcykge1xuXHRcdFx0XHRpZiAoIXVzZUxvbmdEZXNjcmlwdGlvbnMgJiYgZHVwbGljYXRlTGFiZWxzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0XHRjb25zdCBbZmlyc3QsIC4uLnJlc3RdID0gZHVwbGljYXRlTGFiZWxzLm1hcCgoeyBlZGl0b3IgfSkgPT4gZWRpdG9yLmdldERlc2NyaXB0aW9uKFZlcmJvc2l0eS5MT05HKSk7XG5cdFx0XHRcdFx0dXNlTG9uZ0Rlc2NyaXB0aW9ucyA9IHJlc3Quc29tZShkZXNjcmlwdGlvbiA9PiBkZXNjcmlwdGlvbiAhPT0gZmlyc3QpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHNvLCByZXBsYWNlIGFsbCBkZXNjcmlwdGlvbnMgd2l0aCBsb25nIGRlc2NyaXB0aW9uc1xuXHRcdFx0aWYgKHVzZUxvbmdEZXNjcmlwdGlvbnMpIHtcblx0XHRcdFx0bWFwRGVzY3JpcHRpb25Ub0R1cGxpY2F0ZXMuY2xlYXIoKTtcblx0XHRcdFx0Zm9yIChjb25zdCBkdXBsaWNhdGVMYWJlbCBvZiBkdXBsaWNhdGVMYWJlbHMpIHtcblx0XHRcdFx0XHRkdXBsaWNhdGVMYWJlbC5kZXNjcmlwdGlvbiA9IGR1cGxpY2F0ZUxhYmVsLmVkaXRvci5nZXREZXNjcmlwdGlvbihWZXJib3NpdHkuTE9ORyk7XG5cdFx0XHRcdFx0Z2V0T3JTZXQobWFwRGVzY3JpcHRpb25Ub0R1cGxpY2F0ZXMsIGR1cGxpY2F0ZUxhYmVsLmRlc2NyaXB0aW9uLCBbXSkucHVzaChkdXBsaWNhdGVMYWJlbCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gT2J0YWluIGZpbmFsIHNldCBvZiBkZXNjcmlwdGlvbnNcblx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgW2Rlc2NyaXB0aW9uXSBvZiBtYXBEZXNjcmlwdGlvblRvRHVwbGljYXRlcykge1xuXHRcdFx0XHRkZXNjcmlwdGlvbnMucHVzaChkZXNjcmlwdGlvbik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlbW92ZSBkZXNjcmlwdGlvbiBpZiBhbGwgZGVzY3JpcHRpb25zIGFyZSBpZGVudGljYWwgdW5sZXNzIGZvcmNlZFxuXHRcdFx0aWYgKGRlc2NyaXB0aW9ucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBsYWJlbCBvZiBtYXBEZXNjcmlwdGlvblRvRHVwbGljYXRlcy5nZXQoZGVzY3JpcHRpb25zWzBdKSB8fCBbXSkge1xuXHRcdFx0XHRcdGlmICghbGFiZWwuZm9yY2VEZXNjcmlwdGlvbikge1xuXHRcdFx0XHRcdFx0bGFiZWwuZGVzY3JpcHRpb24gPSAnJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2hvcnRlbiBkZXNjcmlwdGlvbnNcblx0XHRcdGNvbnN0IHNob3J0ZW5lZERlc2NyaXB0aW9ucyA9IHNob3J0ZW4oZGVzY3JpcHRpb25zLCB0aGlzLnBhdGguc2VwKTtcblx0XHRcdGRlc2NyaXB0aW9ucy5mb3JFYWNoKChkZXNjcmlwdGlvbiwgdGFiSW5kZXgpID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCBsYWJlbCBvZiBtYXBEZXNjcmlwdGlvblRvRHVwbGljYXRlcy5nZXQoZGVzY3JpcHRpb24pIHx8IFtdKSB7XG5cdFx0XHRcdFx0bGFiZWwuZGVzY3JpcHRpb24gPSBzaG9ydGVuZWREZXNjcmlwdGlvbnNbdGFiSW5kZXhdO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldExhYmVsQ29uZmlnRmxhZ3ModmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHN3aXRjaCAodmFsdWUpIHtcblx0XHRcdGNhc2UgJ3Nob3J0Jzpcblx0XHRcdFx0cmV0dXJuIHsgdmVyYm9zaXR5OiBWZXJib3NpdHkuU0hPUlQsIHNob3J0ZW5EdXBsaWNhdGVzOiBmYWxzZSB9O1xuXHRcdFx0Y2FzZSAnbWVkaXVtJzpcblx0XHRcdFx0cmV0dXJuIHsgdmVyYm9zaXR5OiBWZXJib3NpdHkuTUVESVVNLCBzaG9ydGVuRHVwbGljYXRlczogZmFsc2UgfTtcblx0XHRcdGNhc2UgJ2xvbmcnOlxuXHRcdFx0XHRyZXR1cm4geyB2ZXJib3NpdHk6IFZlcmJvc2l0eS5MT05HLCBzaG9ydGVuRHVwbGljYXRlczogZmFsc2UgfTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB7IHZlcmJvc2l0eTogVmVyYm9zaXR5Lk1FRElVTSwgc2hvcnRlbkR1cGxpY2F0ZXM6IHRydWUgfTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZHJhdyhvcHRpb25zPzogSU11bHRpRWRpdG9yVGFic0NvbnRyb2xMYXlvdXRPcHRpb25zKTogdm9pZCB7XG5cblx0XHQvLyBCb3JkZXIgYmVsb3cgdGFicyBpZiBhbnkgd2l0aCBleHBsaWNpdCBoaWdoIGNvbnRyYXN0IHN1cHBvcnRcblx0XHRpZiAodGhpcy50YWJzQW5kQWN0aW9uc0NvbnRhaW5lcikge1xuXHRcdFx0bGV0IHRhYnNDb250YWluZXJCb3JkZXJDb2xvciA9IHRoaXMuZ2V0Q29sb3IoRURJVE9SX0dST1VQX0hFQURFUl9UQUJTX0JPUkRFUik7XG5cdFx0XHRpZiAoIXRhYnNDb250YWluZXJCb3JkZXJDb2xvciAmJiBpc0hpZ2hDb250cmFzdCh0aGlzLnRoZW1lLnR5cGUpKSB7XG5cdFx0XHRcdHRhYnNDb250YWluZXJCb3JkZXJDb2xvciA9IHRoaXMuZ2V0Q29sb3IoVEFCX0JPUkRFUikgfHwgdGhpcy5nZXRDb2xvcihjb250cmFzdEJvcmRlcik7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0YWJzQ29udGFpbmVyQm9yZGVyQ29sb3IpIHtcblx0XHRcdFx0dGhpcy50YWJzQW5kQWN0aW9uc0NvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCd0YWJzLWJvcmRlci1ib3R0b20nKTtcblx0XHRcdFx0dGhpcy50YWJzQW5kQWN0aW9uc0NvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS10YWJzLWJvcmRlci1ib3R0b20tY29sb3InLCB0YWJzQ29udGFpbmVyQm9yZGVyQ29sb3IudG9TdHJpbmcoKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRhYnNBbmRBY3Rpb25zQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3RhYnMtYm9yZGVyLWJvdHRvbScpO1xuXHRcdFx0XHR0aGlzLnRhYnNBbmRBY3Rpb25zQ29udGFpbmVyLnN0eWxlLnJlbW92ZVByb3BlcnR5KCctLXRhYnMtYm9yZGVyLWJvdHRvbS1jb2xvcicpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZvciBlYWNoIHRhYlxuXHRcdHRoaXMuZm9yRWFjaFRhYigoZWRpdG9yLCB0YWJJbmRleCwgdGFiQ29udGFpbmVyLCB0YWJMYWJlbFdpZGdldCwgdGFiTGFiZWwsIHRhYkFjdGlvbkJhcikgPT4ge1xuXHRcdFx0dGhpcy5yZWRyYXdUYWIoZWRpdG9yLCB0YWJJbmRleCwgdGFiQ29udGFpbmVyLCB0YWJMYWJlbFdpZGdldCwgdGFiTGFiZWwsIHRhYkFjdGlvbkJhcik7XG5cdFx0fSk7XG5cblx0XHQvLyBVcGRhdGUgRWRpdG9yIEFjdGlvbnMgVG9vbGJhclxuXHRcdHRoaXMudXBkYXRlRWRpdG9yQWN0aW9uc1Rvb2xiYXIoKTtcblxuXHRcdC8vIEVuc3VyZSB0aGUgYWN0aXZlIHRhYiBpcyBhbHdheXMgcmV2ZWFsZWRcblx0XHR0aGlzLmxheW91dCh0aGlzLmRpbWVuc2lvbnMsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWRyYXdUYWIoZWRpdG9yOiBFZGl0b3JJbnB1dCwgdGFiSW5kZXg6IG51bWJlciwgdGFiQ29udGFpbmVyOiBIVE1MRWxlbWVudCwgdGFiTGFiZWxXaWRnZXQ6IElSZXNvdXJjZUxhYmVsLCB0YWJMYWJlbDogSUVkaXRvcklucHV0TGFiZWwsIHRhYkFjdGlvbkJhcjogQWN0aW9uQmFyKTogdm9pZCB7XG5cdFx0Y29uc3QgaXNUYWJTdGlja3kgPSB0aGlzLnRhYnNNb2RlbC5pc1N0aWNreSh0YWJJbmRleCk7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuZ3JvdXBzVmlldy5wYXJ0T3B0aW9ucztcblxuXHRcdC8vIExhYmVsXG5cdFx0dGhpcy5yZWRyYXdUYWJMYWJlbChlZGl0b3IsIHRhYkluZGV4LCB0YWJDb250YWluZXIsIHRhYkxhYmVsV2lkZ2V0LCB0YWJMYWJlbCk7XG5cblx0XHQvLyBBY3Rpb25cblx0XHRjb25zdCBoYXNVbnBpbkFjdGlvbiA9IGlzVGFiU3RpY2t5ICYmIG9wdGlvbnMudGFiQWN0aW9uVW5waW5WaXNpYmlsaXR5O1xuXHRcdGNvbnN0IGhhc0Nsb3NlQWN0aW9uID0gIWhhc1VucGluQWN0aW9uICYmIG9wdGlvbnMudGFiQWN0aW9uQ2xvc2VWaXNpYmlsaXR5O1xuXHRcdGNvbnN0IGhhc0FjdGlvbiA9IGhhc1VucGluQWN0aW9uIHx8IGhhc0Nsb3NlQWN0aW9uO1xuXG5cdFx0bGV0IHRhYkFjdGlvbjtcblx0XHRpZiAoaGFzQWN0aW9uKSB7XG5cdFx0XHR0YWJBY3Rpb24gPSBoYXNVbnBpbkFjdGlvbiA/IHRoaXMudW5waW5FZGl0b3JBY3Rpb24gOiB0aGlzLmNsb3NlRWRpdG9yQWN0aW9uO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBFdmVuIGlmIHRoZSBhY3Rpb24gaXMgbm90IHZpc2libGUsIGFkZCBpdCBhcyBpdCBjb250YWlucyB0aGUgZGlydHkgaW5kaWNhdG9yXG5cdFx0XHR0YWJBY3Rpb24gPSBpc1RhYlN0aWNreSA/IHRoaXMudW5waW5FZGl0b3JBY3Rpb24gOiB0aGlzLmNsb3NlRWRpdG9yQWN0aW9uO1xuXHRcdH1cblxuXHRcdGlmICghdGFiQWN0aW9uQmFyLmhhc0FjdGlvbih0YWJBY3Rpb24pKSB7XG5cdFx0XHRpZiAoIXRhYkFjdGlvbkJhci5pc0VtcHR5KCkpIHtcblx0XHRcdFx0dGFiQWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRhYkFjdGlvbkJhci5wdXNoKHRhYkFjdGlvbiwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UsIGtleWJpbmRpbmc6IHRoaXMuZ2V0S2V5YmluZGluZ0xhYmVsKHRhYkFjdGlvbikgfSk7XG5cdFx0fVxuXG5cdFx0dGFiQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoYHBpbm5lZC1hY3Rpb24tb2ZmYCwgaXNUYWJTdGlja3kgJiYgIWhhc1VucGluQWN0aW9uKTtcblx0XHR0YWJDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZShgY2xvc2UtYWN0aW9uLW9mZmAsICFoYXNVbnBpbkFjdGlvbiAmJiAhaGFzQ2xvc2VBY3Rpb24pO1xuXG5cdFx0Zm9yIChjb25zdCBvcHRpb24gb2YgWydsZWZ0JywgJ3JpZ2h0J10pIHtcblx0XHRcdHRhYkNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKGB0YWItYWN0aW9ucy0ke29wdGlvbn1gLCBoYXNBY3Rpb24gJiYgb3B0aW9ucy50YWJBY3Rpb25Mb2NhdGlvbiA9PT0gb3B0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCB0YWJTaXppbmcgPSBpc1RhYlN0aWNreSAmJiBvcHRpb25zLnBpbm5lZFRhYlNpemluZyA9PT0gJ3NocmluaycgPyAnc2hyaW5rJyAvKiB0cmVhdCBzdGlja3kgc2hyaW5rIHRhYnMgYXMgdGFiU2l6aW5nOiAnc2hyaW5rJyAqLyA6IG9wdGlvbnMudGFiU2l6aW5nO1xuXHRcdGZvciAoY29uc3Qgb3B0aW9uIG9mIFsnZml0JywgJ3NocmluaycsICdmaXhlZCddKSB7XG5cdFx0XHR0YWJDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZShgc2l6aW5nLSR7b3B0aW9ufWAsIHRhYlNpemluZyA9PT0gb3B0aW9uKTtcblx0XHR9XG5cblx0XHR0YWJDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaGFzLWljb24nLCBvcHRpb25zLnNob3dJY29ucyAmJiBvcHRpb25zLmhhc0ljb25zKTtcblxuXHRcdHRhYkNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdzdGlja3knLCBpc1RhYlN0aWNreSk7XG5cdFx0Zm9yIChjb25zdCBvcHRpb24gb2YgWydub3JtYWwnLCAnY29tcGFjdCcsICdzaHJpbmsnXSkge1xuXHRcdFx0dGFiQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoYHN0aWNreS0ke29wdGlvbn1gLCBpc1RhYlN0aWNreSAmJiBvcHRpb25zLnBpbm5lZFRhYlNpemluZyA9PT0gb3B0aW9uKTtcblx0XHR9XG5cblx0XHQvLyBJZiBub3Qgd3JhcHBpbmcgdGFicywgc3RpY2t5IGNvbXBhY3Qvc2hyaW5rIHRhYnMgbmVlZCBhIHBvc2l0aW9uIHRvIHJlbWFpbiBhdCB0aGVpciBsb2NhdGlvblxuXHRcdC8vIHdoZW4gc2Nyb2xsaW5nIHRvIHN0YXkgaW4gdmlldyAocmVxdWlyZW1lbnQgZm9yIHBvc2l0aW9uOiBzdGlja3kpXG5cdFx0aWYgKCFvcHRpb25zLndyYXBUYWJzICYmIGlzVGFiU3RpY2t5ICYmIG9wdGlvbnMucGlubmVkVGFiU2l6aW5nICE9PSAnbm9ybWFsJykge1xuXHRcdFx0bGV0IHN0aWNreVRhYldpZHRoID0gMDtcblx0XHRcdHN3aXRjaCAob3B0aW9ucy5waW5uZWRUYWJTaXppbmcpIHtcblx0XHRcdFx0Y2FzZSAnY29tcGFjdCc6XG5cdFx0XHRcdFx0c3RpY2t5VGFiV2lkdGggPSBNdWx0aUVkaXRvclRhYnNDb250cm9sLlRBQl9XSURUSC5jb21wYWN0O1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdzaHJpbmsnOlxuXHRcdFx0XHRcdHN0aWNreVRhYldpZHRoID0gTXVsdGlFZGl0b3JUYWJzQ29udHJvbC5UQUJfV0lEVEguc2hyaW5rO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHR0YWJDb250YWluZXIuc3R5bGUubGVmdCA9IGAke3RhYkluZGV4ICogc3RpY2t5VGFiV2lkdGh9cHhgO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0YWJDb250YWluZXIuc3R5bGUubGVmdCA9ICdhdXRvJztcblx0XHR9XG5cblx0XHQvLyBCb3JkZXJzIC8gb3V0bGluZVxuXHRcdHRoaXMucmVkcmF3VGFiQm9yZGVycyh0YWJJbmRleCwgdGFiQ29udGFpbmVyKTtcblxuXHRcdC8vIFNlbGVjdGlvbiAvIGFjdGl2ZSAvIGRpcnR5IHN0YXRlXG5cdFx0dGhpcy5yZWRyYXdUYWJTZWxlY3RlZEFjdGl2ZUFuZERpcnR5KHRoaXMuZ3JvdXBzVmlldy5hY3RpdmVHcm91cCA9PT0gdGhpcy5ncm91cFZpZXcsIGVkaXRvciwgdGFiQ29udGFpbmVyLCB0YWJBY3Rpb25CYXIpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWRyYXdUYWJMYWJlbChlZGl0b3I6IEVkaXRvcklucHV0LCB0YWJJbmRleDogbnVtYmVyLCB0YWJDb250YWluZXI6IEhUTUxFbGVtZW50LCB0YWJMYWJlbFdpZGdldDogSVJlc291cmNlTGFiZWwsIHRhYkxhYmVsOiBJRWRpdG9ySW5wdXRMYWJlbCk6IHZvaWQge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSB0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnM7XG5cblx0XHQvLyBVbmxlc3MgdGFicyBhcmUgc3RpY2t5IGNvbXBhY3QsIHNob3cgdGhlIGZ1bGwgbGFiZWwgYW5kIGRlc2NyaXB0aW9uXG5cdFx0Ly8gU3RpY2t5IGNvbXBhY3QgdGFicyB3aWxsIG9ubHkgc2hvdyBhbiBpY29uIGlmIGljb25zIGFyZSBlbmFibGVkXG5cdFx0Ly8gb3IgdGhlaXIgZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBuYW1lIG90aGVyd2lzZVxuXHRcdGxldCBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGZvcmNlTGFiZWwgPSBmYWxzZTtcblx0XHRsZXQgZmlsZURlY29yYXRpb25CYWRnZXMgPSBCb29sZWFuKG9wdGlvbnMuZGVjb3JhdGlvbnM/LmJhZGdlcyk7XG5cdFx0Y29uc3QgZmlsZURlY29yYXRpb25Db2xvcnMgPSBCb29sZWFuKG9wdGlvbnMuZGVjb3JhdGlvbnM/LmNvbG9ycyk7XG5cdFx0bGV0IGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdFx0aWYgKG9wdGlvbnMucGlubmVkVGFiU2l6aW5nID09PSAnY29tcGFjdCcgJiYgdGhpcy50YWJzTW9kZWwuaXNTdGlja3kodGFiSW5kZXgpKSB7XG5cdFx0XHRjb25zdCBpc1Nob3dpbmdJY29ucyA9IG9wdGlvbnMuc2hvd0ljb25zICYmIG9wdGlvbnMuaGFzSWNvbnM7XG5cdFx0XHRuYW1lID0gaXNTaG93aW5nSWNvbnMgPyAnJyA6IHRhYkxhYmVsLm5hbWU/LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpO1xuXHRcdFx0ZGVzY3JpcHRpb24gPSAnJztcblx0XHRcdGZvcmNlTGFiZWwgPSB0cnVlO1xuXHRcdFx0ZmlsZURlY29yYXRpb25CYWRnZXMgPSBmYWxzZTsgLy8gbm90IGVub3VnaCBzcGFjZSB3aGVuIHN0aWNreSB0YWJzIGFyZSBjb21wYWN0XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5hbWUgPSB0YWJMYWJlbC5uYW1lO1xuXHRcdFx0ZGVzY3JpcHRpb24gPSB0YWJMYWJlbC5kZXNjcmlwdGlvbiB8fCAnJztcblx0XHR9XG5cblx0XHRpZiAodGFiTGFiZWwuYXJpYUxhYmVsKSB7XG5cdFx0XHR0YWJDb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGFiTGFiZWwuYXJpYUxhYmVsKTtcblx0XHRcdC8vIFNldCBhcmlhLWRlc2NyaXB0aW9uIHRvIGVtcHR5IHN0cmluZyBzbyB0aGF0IHNjcmVlbiByZWFkZXJzIHdvdWxkIG5vdCByZWFkIHRoZSB0aXRsZSBhcyB3ZWxsXG5cdFx0XHQvLyBNb3JlIGRldGFpbHMgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzk1Mzc4XG5cdFx0XHR0YWJDb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWRlc2NyaXB0aW9uJywgJycpO1xuXHRcdH1cblxuXHRcdC8vIExhYmVsXG5cdFx0dGFiTGFiZWxXaWRnZXQuc2V0UmVzb3VyY2UoXG5cdFx0XHR7IG5hbWUsIGRlc2NyaXB0aW9uLCByZXNvdXJjZTogRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQk9USCB9KSB9LFxuXHRcdFx0e1xuXHRcdFx0XHR0aXRsZTogdGhpcy5nZXRIb3ZlclRpdGxlKGVkaXRvciksXG5cdFx0XHRcdGV4dHJhQ2xhc3NlczogY29hbGVzY2UoWyd0YWItbGFiZWwnLCBmaWxlRGVjb3JhdGlvbkJhZGdlcyA/ICd0YWItbGFiZWwtaGFzLWJhZGdlJyA6IHVuZGVmaW5lZF0uY29uY2F0KGVkaXRvci5nZXRMYWJlbEV4dHJhQ2xhc3NlcygpKSksXG5cdFx0XHRcdGl0YWxpYzogIXRoaXMudGFic01vZGVsLmlzUGlubmVkKGVkaXRvciksXG5cdFx0XHRcdGZvcmNlTGFiZWwsXG5cdFx0XHRcdGZpbGVEZWNvcmF0aW9uczoge1xuXHRcdFx0XHRcdGNvbG9yczogZmlsZURlY29yYXRpb25Db2xvcnMsXG5cdFx0XHRcdFx0YmFkZ2VzOiBmaWxlRGVjb3JhdGlvbkJhZGdlc1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRpY29uOiBlZGl0b3IuZ2V0SWNvbigpLFxuXHRcdFx0XHRoaWRlSWNvbjogb3B0aW9ucy5zaG93SWNvbnMgPT09IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHQvLyBUZXN0cyBoZWxwZXJcblx0XHRjb25zdCByZXNvdXJjZSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkoZWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0aWYgKHJlc291cmNlKSB7XG5cdFx0XHR0YWJDb250YWluZXIuc2V0QXR0cmlidXRlKCdkYXRhLXJlc291cmNlLW5hbWUnLCBiYXNlbmFtZU9yQXV0aG9yaXR5KHJlc291cmNlKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhYkNvbnRhaW5lci5yZW1vdmVBdHRyaWJ1dGUoJ2RhdGEtcmVzb3VyY2UtbmFtZScpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVkcmF3VGFiU2VsZWN0ZWRBY3RpdmVBbmREaXJ0eShpc0dyb3VwQWN0aXZlOiBib29sZWFuLCBlZGl0b3I6IEVkaXRvcklucHV0LCB0YWJDb250YWluZXI6IEhUTUxFbGVtZW50LCB0YWJBY3Rpb25CYXI6IEFjdGlvbkJhcik6IHZvaWQge1xuXHRcdGNvbnN0IGlzVGFiQWN0aXZlID0gdGhpcy50YWJzTW9kZWwuaXNBY3RpdmUoZWRpdG9yKTtcblx0XHRjb25zdCBoYXNNb2RpZmllZEJvcmRlclRvcCA9IHRoaXMuZG9SZWRyYXdUYWJEaXJ0eShpc0dyb3VwQWN0aXZlLCBpc1RhYkFjdGl2ZSwgZWRpdG9yLCB0YWJDb250YWluZXIpO1xuXG5cdFx0dGhpcy5kb1JlZHJhd1RhYkFjdGl2ZShpc0dyb3VwQWN0aXZlLCAhaGFzTW9kaWZpZWRCb3JkZXJUb3AsIGVkaXRvciwgdGFiQ29udGFpbmVyLCB0YWJBY3Rpb25CYXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1JlZHJhd1RhYkFjdGl2ZShpc0dyb3VwQWN0aXZlOiBib29sZWFuLCBhbGxvd0JvcmRlclRvcDogYm9vbGVhbiwgZWRpdG9yOiBFZGl0b3JJbnB1dCwgdGFiQ29udGFpbmVyOiBIVE1MRWxlbWVudCwgdGFiQWN0aW9uQmFyOiBBY3Rpb25CYXIpOiB2b2lkIHtcblx0XHRjb25zdCBpc0FjdGl2ZSA9IHRoaXMudGFic01vZGVsLmlzQWN0aXZlKGVkaXRvcik7XG5cdFx0Y29uc3QgaXNTZWxlY3RlZCA9IHRoaXMudGFic01vZGVsLmlzU2VsZWN0ZWQoZWRpdG9yKTtcblxuXHRcdHRhYkNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdhY3RpdmUnLCBpc0FjdGl2ZSk7XG5cdFx0dGFiQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3NlbGVjdGVkJywgaXNTZWxlY3RlZCk7XG5cdFx0dGFiQ29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsIGlzQWN0aXZlID8gJ3RydWUnIDogJ2ZhbHNlJyk7XG5cdFx0dGFiQ29udGFpbmVyLnRhYkluZGV4ID0gaXNBY3RpdmUgPyAwIDogLTE7IC8vIE9ubHkgYWN0aXZlIHRhYiBjYW4gYmUgZm9jdXNlZCBpbnRvXG5cdFx0dGFiQWN0aW9uQmFyLnNldEZvY3VzYWJsZShpc0FjdGl2ZSk7XG5cblx0XHQvLyBTZXQgYm9yZGVyIEJPVFRPTSBpZiB0aGVtZSBkZWZpbmVkIGNvbG9yXG5cdFx0aWYgKGlzQWN0aXZlKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVUYWJCb3JkZXJDb2xvckJvdHRvbSA9IHRoaXMuZ2V0Q29sb3IoaXNHcm91cEFjdGl2ZSA/IFRBQl9BQ1RJVkVfQk9SREVSIDogVEFCX1VORk9DVVNFRF9BQ1RJVkVfQk9SREVSKTtcblx0XHRcdHRhYkNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCd0YWItYm9yZGVyLWJvdHRvbScsICEhYWN0aXZlVGFiQm9yZGVyQ29sb3JCb3R0b20pO1xuXHRcdFx0dGFiQ29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KCctLXRhYi1ib3JkZXItYm90dG9tLWNvbG9yJywgYWN0aXZlVGFiQm9yZGVyQ29sb3JCb3R0b20gPz8gJycpO1xuXHRcdH1cblxuXHRcdC8vIFNldCBib3JkZXIgVE9QIGlmIHRoZW1lIGRlZmluZWQgY29sb3Jcblx0XHRsZXQgdGFiQm9yZGVyQ29sb3JUb3A6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRcdGlmIChhbGxvd0JvcmRlclRvcCkge1xuXHRcdFx0aWYgKGlzQWN0aXZlKSB7XG5cdFx0XHRcdHRhYkJvcmRlckNvbG9yVG9wID0gdGhpcy5nZXRDb2xvcihpc0dyb3VwQWN0aXZlID8gVEFCX0FDVElWRV9CT1JERVJfVE9QIDogVEFCX1VORk9DVVNFRF9BQ1RJVkVfQk9SREVSX1RPUCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0YWJCb3JkZXJDb2xvclRvcCA9PT0gbnVsbCAmJiBpc1NlbGVjdGVkKSB7XG5cdFx0XHRcdHRhYkJvcmRlckNvbG9yVG9wID0gdGhpcy5nZXRDb2xvcihUQUJfU0VMRUNURURfQk9SREVSX1RPUCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGFiQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3RhYi1ib3JkZXItdG9wJywgISF0YWJCb3JkZXJDb2xvclRvcCk7XG5cdFx0dGFiQ29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KCctLXRhYi1ib3JkZXItdG9wLWNvbG9yJywgdGFiQm9yZGVyQ29sb3JUb3AgPz8gJycpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1JlZHJhd1RhYkRpcnR5KGlzR3JvdXBBY3RpdmU6IGJvb2xlYW4sIGlzVGFiQWN0aXZlOiBib29sZWFuLCBlZGl0b3I6IEVkaXRvcklucHV0LCB0YWJDb250YWluZXI6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0bGV0IGhhc01vZGlmaWVkQm9yZGVyQ29sb3IgPSBmYWxzZTtcblxuXHRcdC8vIFRhYjogZGlydHkgKHVubGVzcyBzYXZpbmcpXG5cdFx0aWYgKGVkaXRvci5pc0RpcnR5KCkgJiYgIWVkaXRvci5pc1NhdmluZygpKSB7XG5cdFx0XHR0YWJDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZGlydHknKTtcblxuXHRcdFx0Ly8gSGlnaGxpZ2h0IG1vZGlmaWVkIHRhYnMgd2l0aCBhIGJvcmRlciBpZiBjb25maWd1cmVkXG5cdFx0XHRpZiAodGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLmhpZ2hsaWdodE1vZGlmaWVkVGFicykge1xuXHRcdFx0XHRsZXQgbW9kaWZpZWRCb3JkZXJDb2xvcjogc3RyaW5nIHwgbnVsbDtcblx0XHRcdFx0aWYgKGlzR3JvdXBBY3RpdmUgJiYgaXNUYWJBY3RpdmUpIHtcblx0XHRcdFx0XHRtb2RpZmllZEJvcmRlckNvbG9yID0gdGhpcy5nZXRDb2xvcihUQUJfQUNUSVZFX01PRElGSUVEX0JPUkRFUik7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaXNHcm91cEFjdGl2ZSAmJiAhaXNUYWJBY3RpdmUpIHtcblx0XHRcdFx0XHRtb2RpZmllZEJvcmRlckNvbG9yID0gdGhpcy5nZXRDb2xvcihUQUJfSU5BQ1RJVkVfTU9ESUZJRURfQk9SREVSKTtcblx0XHRcdFx0fSBlbHNlIGlmICghaXNHcm91cEFjdGl2ZSAmJiBpc1RhYkFjdGl2ZSkge1xuXHRcdFx0XHRcdG1vZGlmaWVkQm9yZGVyQ29sb3IgPSB0aGlzLmdldENvbG9yKFRBQl9VTkZPQ1VTRURfQUNUSVZFX01PRElGSUVEX0JPUkRFUik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bW9kaWZpZWRCb3JkZXJDb2xvciA9IHRoaXMuZ2V0Q29sb3IoVEFCX1VORk9DVVNFRF9JTkFDVElWRV9NT0RJRklFRF9CT1JERVIpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG1vZGlmaWVkQm9yZGVyQ29sb3IpIHtcblx0XHRcdFx0XHRoYXNNb2RpZmllZEJvcmRlckNvbG9yID0gdHJ1ZTtcblxuXHRcdFx0XHRcdHRhYkNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdkaXJ0eS1ib3JkZXItdG9wJyk7XG5cdFx0XHRcdFx0dGFiQ29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KCctLXRhYi1kaXJ0eS1ib3JkZXItdG9wLWNvbG9yJywgbW9kaWZpZWRCb3JkZXJDb2xvcik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRhYkNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdkaXJ0eS1ib3JkZXItdG9wJyk7XG5cdFx0XHRcdHRhYkNvbnRhaW5lci5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS10YWItZGlydHktYm9yZGVyLXRvcC1jb2xvcicpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFRhYjogbm90IGRpcnR5XG5cdFx0ZWxzZSB7XG5cdFx0XHR0YWJDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnZGlydHknLCAnZGlydHktYm9yZGVyLXRvcCcpO1xuXHRcdFx0dGFiQ29udGFpbmVyLnN0eWxlLnJlbW92ZVByb3BlcnR5KCctLXRhYi1kaXJ0eS1ib3JkZXItdG9wLWNvbG9yJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGhhc01vZGlmaWVkQm9yZGVyQ29sb3I7XG5cdH1cblxuXHRwcml2YXRlIHJlZHJhd1RhYkJvcmRlcnModGFiSW5kZXg6IG51bWJlciwgdGFiQ29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGlzVGFiU3RpY2t5ID0gdGhpcy50YWJzTW9kZWwuaXNTdGlja3kodGFiSW5kZXgpO1xuXHRcdGNvbnN0IGlzVGFiTGFzdFN0aWNreSA9IGlzVGFiU3RpY2t5ICYmIHRoaXMudGFic01vZGVsLnN0aWNreUNvdW50ID09PSB0YWJJbmRleCArIDE7XG5cdFx0Y29uc3Qgc2hvd0xhc3RTdGlja3lUYWJCb3JkZXJDb2xvciA9IHRoaXMudGFic01vZGVsLnN0aWNreUNvdW50ICE9PSB0aGlzLnRhYnNNb2RlbC5jb3VudDtcblxuXHRcdC8vIEJvcmRlcnMgLyBPdXRsaW5lXG5cdFx0Y29uc3QgYm9yZGVyUmlnaHRDb2xvciA9ICgoaXNUYWJMYXN0U3RpY2t5ICYmIHNob3dMYXN0U3RpY2t5VGFiQm9yZGVyQ29sb3IgPyB0aGlzLmdldENvbG9yKFRBQl9MQVNUX1BJTk5FRF9CT1JERVIpIDogdW5kZWZpbmVkKSB8fCB0aGlzLmdldENvbG9yKFRBQl9CT1JERVIpIHx8IHRoaXMuZ2V0Q29sb3IoY29udHJhc3RCb3JkZXIpKTtcblx0XHR0YWJDb250YWluZXIuc3R5bGUuYm9yZGVyUmlnaHQgPSBib3JkZXJSaWdodENvbG9yID8gYDFweCBzb2xpZCAke2JvcmRlclJpZ2h0Q29sb3J9YCA6ICcnO1xuXHRcdHRhYkNvbnRhaW5lci5zdHlsZS5vdXRsaW5lQ29sb3IgPSB0aGlzLmdldENvbG9yKGFjdGl2ZUNvbnRyYXN0Qm9yZGVyKSB8fCAnJztcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBwcmVwYXJlRWRpdG9yQWN0aW9ucyhlZGl0b3JBY3Rpb25zOiBJVG9vbGJhckFjdGlvbnMpOiBJVG9vbGJhckFjdGlvbnMge1xuXHRcdGNvbnN0IGlzR3JvdXBBY3RpdmUgPSB0aGlzLmdyb3Vwc1ZpZXcuYWN0aXZlR3JvdXAgPT09IHRoaXMuZ3JvdXBWaWV3O1xuXG5cdFx0Ly8gQWN0aXZlOiBhbGxvdyBhbGwgYWN0aW9uc1xuXHRcdGlmIChpc0dyb3VwQWN0aXZlKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yQWN0aW9ucztcblx0XHR9XG5cblx0XHQvLyBJbmFjdGl2ZTogb25seSBzaG93IFwiVW5sb2NrXCIgYW5kIHNlY29uZGFyeSBhY3Rpb25zXG5cdFx0ZWxzZSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRwcmltYXJ5OiB0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnMuYWx3YXlzU2hvd0VkaXRvckFjdGlvbnMgPyBlZGl0b3JBY3Rpb25zLnByaW1hcnkgOiBlZGl0b3JBY3Rpb25zLnByaW1hcnkuZmlsdGVyKGFjdGlvbiA9PiBhY3Rpb24uaWQgPT09IFVOTE9DS19HUk9VUF9DT01NQU5EX0lEKSxcblx0XHRcdFx0c2Vjb25kYXJ5OiBlZGl0b3JBY3Rpb25zLnNlY29uZGFyeVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRnZXRIZWlnaHQoKTogbnVtYmVyIHtcblxuXHRcdC8vIFJldHVybiBxdWlja2x5IGlmIG91ciB1c2VkIGRpbWVuc2lvbnMgYXJlIGtub3duXG5cdFx0aWYgKHRoaXMuZGltZW5zaW9ucy51c2VkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kaW1lbnNpb25zLnVzZWQuaGVpZ2h0O1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSBjb21wdXRlIHZpYSBicm93c2VyIEFQSXNcblx0XHRlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLmNvbXB1dGVIZWlnaHQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRsZXQgaGVpZ2h0OiBudW1iZXI7XG5cblx0XHRpZiAoIXRoaXMudmlzaWJsZSkge1xuXHRcdFx0aGVpZ2h0ID0gMDtcblx0XHR9IGVsc2UgaWYgKHRoaXMuZ3JvdXBzVmlldy5wYXJ0T3B0aW9ucy53cmFwVGFicyAmJiB0aGlzLnRhYnNBbmRBY3Rpb25zQ29udGFpbmVyPy5jbGFzc0xpc3QuY29udGFpbnMoJ3dyYXBwaW5nJykpIHtcblx0XHRcdC8vIFdyYXA6IHdlIG5lZWQgdG8gYXNrIGBvZmZzZXRIZWlnaHRgIHRvIGdldFxuXHRcdFx0Ly8gdGhlIHJlYWwgaGVpZ2h0IG9mIHRoZSB0aXRsZSBhcmVhIHdpdGggd3JhcHBpbmcuXG5cdFx0XHRoZWlnaHQgPSB0aGlzLnRhYnNBbmRBY3Rpb25zQ29udGFpbmVyLm9mZnNldEhlaWdodDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGVpZ2h0ID0gdGhpcy50YWJIZWlnaHQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGhlaWdodDtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb25zOiBJRWRpdG9yVGl0bGVDb250cm9sRGltZW5zaW9ucywgb3B0aW9ucz86IElNdWx0aUVkaXRvclRhYnNDb250cm9sTGF5b3V0T3B0aW9ucyk6IERpbWVuc2lvbiB7XG5cblx0XHQvLyBSZW1lbWJlciBkaW1lbnNpb25zIHRoYXQgd2UgZ2V0XG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLmRpbWVuc2lvbnMsIGRpbWVuc2lvbnMpO1xuXG5cdFx0aWYgKHRoaXMudmlzaWJsZSkge1xuXHRcdFx0aWYgKCF0aGlzLmxheW91dFNjaGVkdWxlci52YWx1ZSkge1xuXG5cdFx0XHRcdC8vIFRoZSBsYXlvdXQgb2YgdGFicyBjYW4gYmUgYW4gZXhwZW5zaXZlIG9wZXJhdGlvbiBiZWNhdXNlIHdlIGFjY2VzcyBET00gcHJvcGVydGllc1xuXHRcdFx0XHQvLyB0aGF0IGNhbiByZXN1bHQgaW4gdGhlIGJyb3dzZXIgZG9pbmcgYSBmdWxsIHBhZ2UgbGF5b3V0IHRvIHZhbGlkYXRlIHRoZW0uIFRvIGJ1ZmZlclxuXHRcdFx0XHQvLyB0aGlzIGEgbGl0dGxlIGJpdCB3ZSB0cnkgYXQgbGVhc3QgdG8gc2NoZWR1bGUgdGhpcyB3b3JrIG9uIHRoZSBuZXh0IGFuaW1hdGlvbiBmcmFtZVxuXHRcdFx0XHQvLyB3aGVuIHdlIGhhdmUgcmVzdG9yZWQgb3Igd2hlbiBpZGxlIG90aGVyd2lzZS5cblxuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShnZXRXaW5kb3codGhpcy5wYXJlbnQpLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5kb0xheW91dCh0aGlzLmRpbWVuc2lvbnMsIHRoaXMubGF5b3V0U2NoZWR1bGVyLnZhbHVlPy5vcHRpb25zIC8qIGVuc3VyZSB0byBwaWNrIHVwIGxhdGVzdCBvcHRpb25zICovKTtcblxuXHRcdFx0XHRcdHRoaXMubGF5b3V0U2NoZWR1bGVyLmNsZWFyKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLmxheW91dFNjaGVkdWxlci52YWx1ZSA9IHsgb3B0aW9ucywgZGlzcG9zZTogKCkgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkgfTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTWFrZSBzdXJlIHRvIGtlZXAgb3B0aW9ucyB1cGRhdGVkXG5cdFx0XHRpZiAob3B0aW9ucz8uZm9yY2VSZXZlYWxBY3RpdmVUYWIpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXRTY2hlZHVsZXIudmFsdWUub3B0aW9ucyA9IHtcblx0XHRcdFx0XHQuLi50aGlzLmxheW91dFNjaGVkdWxlci52YWx1ZS5vcHRpb25zLFxuXHRcdFx0XHRcdGZvcmNlUmV2ZWFsQWN0aXZlVGFiOiB0cnVlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRmlyc3QgdGltZSBsYXlvdXQ6IGNvbXB1dGUgdGhlIGRpbWVuc2lvbnMgYW5kIHN0b3JlIGl0XG5cdFx0aWYgKCF0aGlzLmRpbWVuc2lvbnMudXNlZCkge1xuXHRcdFx0dGhpcy5kaW1lbnNpb25zLnVzZWQgPSBuZXcgRGltZW5zaW9uKGRpbWVuc2lvbnMuY29udGFpbmVyLndpZHRoLCB0aGlzLmNvbXB1dGVIZWlnaHQoKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZGltZW5zaW9ucy51c2VkO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0xheW91dChkaW1lbnNpb25zOiBJRWRpdG9yVGl0bGVDb250cm9sRGltZW5zaW9ucywgb3B0aW9ucz86IElNdWx0aUVkaXRvclRhYnNDb250cm9sTGF5b3V0T3B0aW9ucyk6IHZvaWQge1xuXG5cdFx0Ly8gTGF5b3V0IHRhYnNcblx0XHRpZiAoZGltZW5zaW9ucy5jb250YWluZXIgIT09IERpbWVuc2lvbi5Ob25lICYmIGRpbWVuc2lvbnMuYXZhaWxhYmxlICE9PSBEaW1lbnNpb24uTm9uZSkge1xuXHRcdFx0dGhpcy5kb0xheW91dFRhYnMoZGltZW5zaW9ucywgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtZW1iZXIgdGhlIGRpbWVuc2lvbnMgdXNlZCBpbiB0aGUgY29udHJvbCBzbyB0aGF0IHdlIGNhblxuXHRcdC8vIHJldHVybiBpdCBmYXN0IGZyb20gdGhlIGBsYXlvdXRgIGNhbGwgd2l0aG91dCBoYXZpbmcgdG9cblx0XHQvLyBjb21wdXRlIGl0IG92ZXIgYW5kIG92ZXIgYWdhaW5cblx0XHRjb25zdCBvbGREaW1lbnNpb24gPSB0aGlzLmRpbWVuc2lvbnMudXNlZDtcblx0XHRjb25zdCBuZXdEaW1lbnNpb24gPSB0aGlzLmRpbWVuc2lvbnMudXNlZCA9IG5ldyBEaW1lbnNpb24oZGltZW5zaW9ucy5jb250YWluZXIud2lkdGgsIHRoaXMuY29tcHV0ZUhlaWdodCgpKTtcblxuXHRcdC8vIEluIGNhc2UgdGhlIGhlaWdodCBvZiB0aGUgdGl0bGUgY29udHJvbCBjaGFuZ2VkIGZyb20gYmVmb3JlXG5cdFx0Ly8gKGN1cnJlbnRseSBvbmx5IHBvc3NpYmxlIGlmIHdyYXBwaW5nIGNoYW5nZWQgb24vb2ZmKSwgd2UgbmVlZFxuXHRcdC8vIHRvIHNpZ25hbCB0aGlzIHRvIHRoZSBvdXRzaWRlIHZpYSBhIGByZWxheW91dGAgY2FsbCBzbyB0aGF0XG5cdFx0Ly8gZS5nLiB0aGUgZWRpdG9yIGNvbnRyb2wgY2FuIGJlIGFkanVzdGVkIGFjY29yZGluZ2x5LlxuXHRcdGlmIChvbGREaW1lbnNpb24gJiYgb2xkRGltZW5zaW9uLmhlaWdodCAhPT0gbmV3RGltZW5zaW9uLmhlaWdodCkge1xuXHRcdFx0dGhpcy5ncm91cFZpZXcucmVsYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvTGF5b3V0VGFicyhkaW1lbnNpb25zOiBJRWRpdG9yVGl0bGVDb250cm9sRGltZW5zaW9ucywgb3B0aW9ucz86IElNdWx0aUVkaXRvclRhYnNDb250cm9sTGF5b3V0T3B0aW9ucyk6IHZvaWQge1xuXG5cdFx0Ly8gQWx3YXlzIGZpcnN0IGxheW91dCB0YWJzIHdpdGggd3JhcHBpbmcgc3VwcG9ydCBldmVuIGlmIHdyYXBwaW5nXG5cdFx0Ly8gaXMgZGlzYWJsZWQuIFRoZSByZXN1bHQgaW5kaWNhdGVzIGlmIHRhYnMgd3JhcCBhbmQgaWYgbm90LCB3ZVxuXHRcdC8vIG5lZWQgdG8gcHJvY2VlZCB3aXRoIHRoZSBsYXlvdXQgd2l0aG91dCB3cmFwcGluZyBiZWNhdXNlIGV2ZW5cblx0XHQvLyBpZiB3cmFwcGluZyBpcyBlbmFibGVkIGluIHNldHRpbmdzLCB0aGVyZSBhcmUgY2FzZXMgd2hlcmVcblx0XHQvLyB3cmFwcGluZyBpcyBkaXNhYmxlZCAoZS5nLiBkdWUgdG8gc3BhY2UgY29uc3RyYWludHMpXG5cdFx0Y29uc3QgdGFic1dyYXBNdWx0aUxpbmUgPSB0aGlzLmRvTGF5b3V0VGFic1dyYXBwaW5nKGRpbWVuc2lvbnMpO1xuXHRcdGlmICghdGFic1dyYXBNdWx0aUxpbmUpIHtcblx0XHRcdHRoaXMuZG9MYXlvdXRUYWJzTm9uV3JhcHBpbmcob3B0aW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb0xheW91dFRhYnNXcmFwcGluZyhkaW1lbnNpb25zOiBJRWRpdG9yVGl0bGVDb250cm9sRGltZW5zaW9ucyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IFt0YWJzQW5kQWN0aW9uc0NvbnRhaW5lciwgdGFic0NvbnRhaW5lciwgZWRpdG9yVG9vbGJhckNvbnRhaW5lciwgdGFic1Njcm9sbGJhcl0gPSBhc3NlcnRBbGxEZWZpbmVkKHRoaXMudGFic0FuZEFjdGlvbnNDb250YWluZXIsIHRoaXMudGFic0NvbnRhaW5lciwgdGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhckNvbnRhaW5lciwgdGhpcy50YWJzU2Nyb2xsYmFyKTtcblxuXHRcdC8vIEhhbmRsZSB3cmFwcGluZyB0YWJzIGFjY29yZGluZyB0byBzZXR0aW5nOlxuXHRcdC8vIC0gZW5hYmxlZDogb25seSBhZGQgY2xhc3MgaWYgdGFicyB3cmFwIGFuZCBkb24ndCBleGNlZWQgYXZhaWxhYmxlIGRpbWVuc2lvbnNcblx0XHQvLyAtIGRpc2FibGVkOiByZW1vdmUgY2xhc3MgYW5kIG1hcmdpbi1yaWdodCB2YXJpYWJsZVxuXG5cdFx0Y29uc3QgZGlkVGFic1dyYXBNdWx0aUxpbmUgPSB0YWJzQW5kQWN0aW9uc0NvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ3dyYXBwaW5nJyk7XG5cdFx0bGV0IHRhYnNXcmFwTXVsdGlMaW5lID0gZGlkVGFic1dyYXBNdWx0aUxpbmU7XG5cblx0XHRmdW5jdGlvbiB1cGRhdGVUYWJzV3JhcHBpbmcoZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdFx0dGFic1dyYXBNdWx0aUxpbmUgPSBlbmFibGVkO1xuXG5cdFx0XHQvLyBUb2dnbGUgdGhlIGB3cmFwcGVkYCBjbGFzcyB0byBlbmFibGUgd3JhcHBpbmdcblx0XHRcdHRhYnNBbmRBY3Rpb25zQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3dyYXBwaW5nJywgdGFic1dyYXBNdWx0aUxpbmUpO1xuXG5cdFx0XHQvLyBVcGRhdGUgYGxhc3QtdGFiLW1hcmdpbi1yaWdodGAgQ1NTIHZhcmlhYmxlIHRvIGFjY291bnQgZm9yIHRoZSBhYnNvbHV0ZVxuXHRcdFx0Ly8gcG9zaXRpb25lZCBlZGl0b3IgYWN0aW9ucyBjb250YWluZXIgd2hlbiB0YWJzIHdyYXAuIFRoZSBtYXJnaW4gbmVlZHMgdG9cblx0XHRcdC8vIGJlIHRoZSB3aWR0aCBvZiB0aGUgZWRpdG9yIGFjdGlvbnMgY29udGFpbmVyIHRvIGF2b2lkIHNjcmVlbiBjaGVlc2UuXG5cdFx0XHR0YWJzQ29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KCctLWxhc3QtdGFiLW1hcmdpbi1yaWdodCcsIHRhYnNXcmFwTXVsdGlMaW5lID8gYCR7ZWRpdG9yVG9vbGJhckNvbnRhaW5lci5vZmZzZXRXaWR0aH1weGAgOiAnMCcpO1xuXG5cdFx0XHQvLyBSZW1vdmUgb2xkIGNzcyBjbGFzc2VzIHRoYXQgYXJlIG5vdCBuZWVkZWQgYW55bW9yZVxuXHRcdFx0Zm9yIChjb25zdCB0YWIgb2YgdGFic0NvbnRhaW5lci5jaGlsZHJlbikge1xuXHRcdFx0XHR0YWIuY2xhc3NMaXN0LnJlbW92ZSgnbGFzdC1pbi1yb3cnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTZXR0aW5nIGVuYWJsZWQ6IHNlbGVjdGl2ZWx5IGVuYWJsZSB3cmFwcGluZyBpZiBwb3NzaWJsZVxuXHRcdGlmICh0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnMud3JhcFRhYnMpIHtcblx0XHRcdGNvbnN0IHZpc2libGVUYWJzV2lkdGggPSB0YWJzQ29udGFpbmVyLm9mZnNldFdpZHRoO1xuXHRcdFx0Y29uc3QgYWxsVGFic1dpZHRoID0gdGFic0NvbnRhaW5lci5zY3JvbGxXaWR0aDtcblx0XHRcdGNvbnN0IGxhc3RUYWJGaXRzV3JhcHBlZCA9ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbGFzdFRhYiA9IHRoaXMuZ2V0TGFzdFRhYigpO1xuXHRcdFx0XHRpZiAoIWxhc3RUYWIpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gbm8gdGFiIGFsd2F5cyBmaXRzXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBsYXN0VGFiT3ZlcmxhcFdpdGhUb29sYmFyV2lkdGggPSBsYXN0VGFiLm9mZnNldFdpZHRoICsgZWRpdG9yVG9vbGJhckNvbnRhaW5lci5vZmZzZXRXaWR0aCAtIGRpbWVuc2lvbnMuYXZhaWxhYmxlLndpZHRoO1xuXHRcdFx0XHRpZiAobGFzdFRhYk92ZXJsYXBXaXRoVG9vbGJhcldpZHRoID4gMSkge1xuXHRcdFx0XHRcdC8vIEFsbG93IGZvciBzbGlnaHQgcm91bmRpbmcgZXJyb3JzIHJlbGF0ZWQgdG8gem9vbWluZyBoZXJlXG5cdFx0XHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExNjM4NVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fTtcblxuXHRcdFx0Ly8gSWYgdGFicyB3cmFwIG9yIHNob3VsZCBzdGFydCB0byB3cmFwICh3aGVuIHdpZHRoIGV4Y2VlZHMgdmlzaWJsZSB3aWR0aClcblx0XHRcdC8vIHdlIG11c3QgdHJpZ2dlciBgdXBkYXRlV3JhcHBpbmdgIHRvIHNldCB0aGUgYGxhc3QtdGFiLW1hcmdpbi1yaWdodGBcblx0XHRcdC8vIGFjY29yZGluZ2x5IGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYWN0aW9ucy4gVGhlIG1hcmdpbiBpcyBpbXBvcnRhbnQgdG9cblx0XHRcdC8vIHByb3Blcmx5IHBvc2l0aW9uIHRoZSBsYXN0IHRhYiBhcGFydCBmcm9tIHRoZSBhY3Rpb25zXG5cdFx0XHQvL1xuXHRcdFx0Ly8gV2UgYWxyZWFkeSBjaGVjayBoZXJlIGlmIHRoZSBsYXN0IHRhYiB3b3VsZCBmaXQgd2hlbiB3cmFwcGVkIGdpdmVuIHRoZVxuXHRcdFx0Ly8gZWRpdG9yIHRvb2xiYXIgd2lsbCBhbHNvIHNob3cgcmlnaHQgbmV4dCB0byBpdC4gVGhpcyBlbnN1cmVzIHdlIGFyZSBub3Rcblx0XHRcdC8vIGVuYWJsaW5nIHdyYXBwaW5nIG9ubHkgdG8gZGlzYWJsZSBpdCBhZ2FpbiBpbiB0aGUgY29kZSBiZWxvdyAodGhpcyBmaXhlc1xuXHRcdFx0Ly8gZmxpY2tlcmluZyBpc3N1ZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE1MDUwKVxuXHRcdFx0aWYgKHRhYnNXcmFwTXVsdGlMaW5lIHx8IChhbGxUYWJzV2lkdGggPiB2aXNpYmxlVGFic1dpZHRoICYmIGxhc3RUYWJGaXRzV3JhcHBlZCgpKSkge1xuXHRcdFx0XHR1cGRhdGVUYWJzV3JhcHBpbmcodHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRhYnMgd3JhcCBtdWx0aWxpbmU6IHJlbW92ZSB3cmFwcGluZyB1bmRlciBjZXJ0YWluIHNpemUgY29uc3RyYWludCBjb25kaXRpb25zXG5cdFx0XHRpZiAodGFic1dyYXBNdWx0aUxpbmUpIHtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdCh0YWJzQ29udGFpbmVyLm9mZnNldEhlaWdodCA+IGRpbWVuc2lvbnMuYXZhaWxhYmxlLmhlaWdodCkgfHxcdFx0XHRcdFx0XHRcdC8vIGlmIGhlaWdodCBleGNlZWRzIGF2YWlsYWJsZSBoZWlnaHRcblx0XHRcdFx0XHQoYWxsVGFic1dpZHRoID09PSB2aXNpYmxlVGFic1dpZHRoICYmIHRhYnNDb250YWluZXIub2Zmc2V0SGVpZ2h0ID09PSB0aGlzLnRhYkhlaWdodCkgfHxcdC8vIGlmIHdyYXBwaW5nIGlzIG5vdCBuZWVkZWQgYW55bW9yZVxuXHRcdFx0XHRcdCghbGFzdFRhYkZpdHNXcmFwcGVkKCkpXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGlmIGxhc3QgdGFiIGRvZXMgbm90IGZpdCBhbnltb3JlXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHVwZGF0ZVRhYnNXcmFwcGluZyhmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTZXR0aW5nIGRpc2FibGVkOiByZW1vdmUgQ1NTIHRyYWNlcyBvbmx5IGlmIHRhYnMgZGlkIHdyYXBcblx0XHRlbHNlIGlmIChkaWRUYWJzV3JhcE11bHRpTGluZSkge1xuXHRcdFx0dXBkYXRlVGFic1dyYXBwaW5nKGZhbHNlKTtcblx0XHR9XG5cblx0XHQvLyBJZiB3ZSB0cmFuc2l0aW9uZWQgZnJvbSBub24td3JhcHBpbmcgdG8gd3JhcHBpbmcsIHdlIG5lZWRcblx0XHQvLyB0byB1cGRhdGUgdGhlIHNjcm9sbGJhciB0byBoYXZlIGFuIGVxdWFsIGB3aWR0aGAgYW5kXG5cdFx0Ly8gYHNjcm9sbFdpZHRoYC4gT3RoZXJ3aXNlIGEgc2Nyb2xsYmFyIHdvdWxkIGFwcGVhciB3aGljaCBpc1xuXHRcdC8vIG5ldmVyIGRlc2lyZWQgd2hlbiB3cmFwcGluZy5cblx0XHRpZiAodGFic1dyYXBNdWx0aUxpbmUgJiYgIWRpZFRhYnNXcmFwTXVsdGlMaW5lKSB7XG5cdFx0XHRjb25zdCB2aXNpYmxlVGFic1dpZHRoID0gdGFic0NvbnRhaW5lci5vZmZzZXRXaWR0aDtcblx0XHRcdHRhYnNTY3JvbGxiYXIuc2V0U2Nyb2xsRGltZW5zaW9ucyh7XG5cdFx0XHRcdHdpZHRoOiB2aXNpYmxlVGFic1dpZHRoLFxuXHRcdFx0XHRzY3JvbGxXaWR0aDogdmlzaWJsZVRhYnNXaWR0aFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHRoZSBgbGFzdC1pbi1yb3dgIGNsYXNzIG9uIHRhYnMgd2hlbiB3cmFwcGluZ1xuXHRcdC8vIGlzIGVuYWJsZWQgKGl0IGRvZXNuJ3QgZG8gYW55IGhhcm0gb3RoZXJ3aXNlKS4gVGhpc1xuXHRcdC8vIGNsYXNzIGNvbnRyb2xzIGFkZGl0aW9uYWwgcHJvcGVydGllcyBvZiB0YWIgd2hlbiBpdCBpc1xuXHRcdC8vIHRoZSBsYXN0IHRhYiBpbiBhIHJvd1xuXHRcdGlmICh0YWJzV3JhcE11bHRpTGluZSkge1xuXG5cdFx0XHQvLyBVc2luZyBhIG1hcCBoZXJlIHRvIGNoYW5nZSBjbGFzc2VzIGFmdGVyIHRoZSBmb3IgbG9vcCBpc1xuXHRcdFx0Ly8gY3J1Y2lhbCBmb3IgcGVyZm9ybWFuY2UgYmVjYXVzZSBjaGFuZ2luZyB0aGUgY2xhc3Mgb24gYVxuXHRcdFx0Ly8gdGFiIGNhbiByZXN1bHQgaW4gbGF5b3V0cyBvZiB0aGUgcmVuZGVyaW5nIGVuZ2luZS5cblx0XHRcdGNvbnN0IHRhYnMgPSBuZXcgTWFwPEhUTUxFbGVtZW50LCBib29sZWFuIC8qIGxhc3QgaW4gcm93ICovPigpO1xuXG5cdFx0XHRsZXQgY3VycmVudFRhYnNQb3NZOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgbGFzdFRhYjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIHRhYnNDb250YWluZXIuY2hpbGRyZW4pIHtcblx0XHRcdFx0Y29uc3QgdGFiID0gY2hpbGQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHRcdGNvbnN0IHRhYlBvc1kgPSB0YWIub2Zmc2V0VG9wO1xuXG5cdFx0XHRcdC8vIE1hcmtzIGEgbmV3IG9yIHRoZSBmaXJzdCByb3cgb2YgdGFic1xuXHRcdFx0XHRpZiAodGFiUG9zWSAhPT0gY3VycmVudFRhYnNQb3NZKSB7XG5cdFx0XHRcdFx0Y3VycmVudFRhYnNQb3NZID0gdGFiUG9zWTtcblx0XHRcdFx0XHRpZiAobGFzdFRhYikge1xuXHRcdFx0XHRcdFx0dGFicy5zZXQobGFzdFRhYiwgdHJ1ZSk7IC8vIHByZXZpb3VzIHRhYiBtdXN0IGJlIGxhc3QgaW4gcm93IHRoZW5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBBbHdheXMgcmVtZW1iZXIgbGFzdCB0YWIgYW5kIGVuc3VyZSB0aGVcblx0XHRcdFx0Ly8gbGFzdC1pbi1yb3cgY2xhc3MgaXMgbm90IHByZXNlbnQgdW50aWxcblx0XHRcdFx0Ly8gd2Uga25vdyB0aGUgdGFiIGlzIGxhc3Rcblx0XHRcdFx0bGFzdFRhYiA9IHRhYjtcblx0XHRcdFx0dGFicy5zZXQodGFiLCBmYWxzZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIExhc3QgdGFiIG92ZXJhbGx5IGlzIGFsd2F5cyBsYXN0LWluLXJvd1xuXHRcdFx0aWYgKGxhc3RUYWIpIHtcblx0XHRcdFx0dGFicy5zZXQobGFzdFRhYiwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgW3RhYiwgbGFzdEluUm93XSBvZiB0YWJzKSB7XG5cdFx0XHRcdHRhYi5jbGFzc0xpc3QudG9nZ2xlKCdsYXN0LWluLXJvdycsIGxhc3RJblJvdyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRhYnNXcmFwTXVsdGlMaW5lO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0xheW91dFRhYnNOb25XcmFwcGluZyhvcHRpb25zPzogSU11bHRpRWRpdG9yVGFic0NvbnRyb2xMYXlvdXRPcHRpb25zKTogdm9pZCB7XG5cdFx0Y29uc3QgW3RhYnNDb250YWluZXIsIHRhYnNTY3JvbGxiYXJdID0gYXNzZXJ0QWxsRGVmaW5lZCh0aGlzLnRhYnNDb250YWluZXIsIHRoaXMudGFic1Njcm9sbGJhcik7XG5cblx0XHQvL1xuXHRcdC8vIFN5bm9wc2lzXG5cdFx0Ly8gLSBhbGxUYWJzV2lkdGg6ICAgXHRcdFx0c3VtIG9mIGFsbCB0YWIgd2lkdGhzXG5cdFx0Ly8gLSBzdGlja3lUYWJzV2lkdGg6XHRcdFx0c3VtIG9mIGFsbCBzdGlja3kgdGFiIHdpZHRocyAodW5sZXNzIGBwaW5uZWRUYWJTaXppbmc6IG5vcm1hbGApXG5cdFx0Ly8gLSB2aXNpYmxlQ29udGFpbmVyV2lkdGg6IFx0c2l6ZSBvZiB0YWIgY29udGFpbmVyXG5cdFx0Ly8gLSBhdmFpbGFibGVDb250YWluZXJXaWR0aDogXHRzaXplIG9mIHRhYiBjb250YWluZXIgbWludXMgc2l6ZSBvZiBzdGlja3kgdGFic1xuXHRcdC8vXG5cdFx0Ly8gWy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBBbGwgdGFicyB3aWR0aCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1dXG5cdFx0Ly8gWy0tLS0tLS0tLS0tLS0tLS0tLS0gVmlzaWJsZSBjb250YWluZXIgd2lkdGggLS0tLS0tLS0tLS0tLS0tLS0tLV1cblx0XHQvLyAgICAgICAgICAgICAgICAgICAgICAgICBbLS0tLS0tIEF2YWlsYWJsZSBjb250YWluZXIgd2lkdGggLS0tLS0tXVxuXHRcdC8vIFsgU3RpY2t5IEEgXVsgU3RpY2t5IEIgXVsgVGFiIEMgXVsgVGFiIEQgXVsgVGFiIEUgXVsgVGFiIEYgXVsgVGFiIEcgXVsgVGFiIEggXVsgVGFiIEkgXVxuXHRcdC8vICAgICAgICAgICAgICAgICBBY3RpdmUgVGFiIFdpZHRoIFstLS0tLS0tXVxuXHRcdC8vIFstLS0tLS0tIEFjdGl2ZSBUYWIgUG9zIFggLS0tLS0tLV1cblx0XHQvLyBbLS0gU3RpY2t5IFRhYnMgV2lkdGggLS1dXG5cdFx0Ly9cblxuXHRcdGNvbnN0IHZpc2libGVUYWJzV2lkdGggPSB0YWJzQ29udGFpbmVyLm9mZnNldFdpZHRoO1xuXHRcdGNvbnN0IGFsbFRhYnNXaWR0aCA9IHRhYnNDb250YWluZXIuc2Nyb2xsV2lkdGg7XG5cblx0XHQvLyBDb21wdXRlIHdpZHRoIG9mIHN0aWNreSB0YWJzIGRlcGVuZGluZyBvbiBwaW5uZWQgdGFiIHNpemluZ1xuXHRcdC8vIC0gY29tcGFjdDogc3RpY2t5LXRhYnMgKiBUQUJfU0laRVMuY29tcGFjdFxuXHRcdC8vIC0gIHNocmluazogc3RpY2t5LXRhYnMgKiBUQUJfU0laRVMuc2hyaW5rXG5cdFx0Ly8gLSAgbm9ybWFsOiAwIChzdGlja3kgdGFicyBpbmhlcml0IGxvb2sgYW5kIGZlZWwgZnJvbSBub24tc3RpY2t5IHRhYnMpXG5cdFx0bGV0IHN0aWNreVRhYnNXaWR0aCA9IDA7XG5cdFx0aWYgKHRoaXMudGFic01vZGVsLnN0aWNreUNvdW50ID4gMCkge1xuXHRcdFx0bGV0IHN0aWNreVRhYldpZHRoID0gMDtcblx0XHRcdHN3aXRjaCAodGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLnBpbm5lZFRhYlNpemluZykge1xuXHRcdFx0XHRjYXNlICdjb21wYWN0Jzpcblx0XHRcdFx0XHRzdGlja3lUYWJXaWR0aCA9IE11bHRpRWRpdG9yVGFic0NvbnRyb2wuVEFCX1dJRFRILmNvbXBhY3Q7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3Nocmluayc6XG5cdFx0XHRcdFx0c3RpY2t5VGFiV2lkdGggPSBNdWx0aUVkaXRvclRhYnNDb250cm9sLlRBQl9XSURUSC5zaHJpbms7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdHN0aWNreVRhYnNXaWR0aCA9IHRoaXMudGFic01vZGVsLnN0aWNreUNvdW50ICogc3RpY2t5VGFiV2lkdGg7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlVGFiQW5kSW5kZXggPSB0aGlzLnRhYnNNb2RlbC5hY3RpdmVFZGl0b3IgPyB0aGlzLmdldFRhYkFuZEluZGV4KHRoaXMudGFic01vZGVsLmFjdGl2ZUVkaXRvcikgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgW2FjdGl2ZVRhYiwgYWN0aXZlVGFiSW5kZXhdID0gYWN0aXZlVGFiQW5kSW5kZXggPz8gW3VuZGVmaW5lZCwgdW5kZWZpbmVkXTtcblxuXHRcdC8vIEZpZ3VyZSBvdXQgaWYgYWN0aXZlIHRhYiBpcyBwb3NpdGlvbmVkIHN0YXRpYyB3aGljaCBoYXMgYW5cblx0XHQvLyBpbXBhY3Qgb24gd2hldGhlciB0byByZXZlYWwgdGhlIHRhYiBvciBub3QgbGF0ZXJcblx0XHRsZXQgYWN0aXZlVGFiUG9zaXRpb25TdGF0aWMgPSB0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnMucGlubmVkVGFiU2l6aW5nICE9PSAnbm9ybWFsJyAmJiB0eXBlb2YgYWN0aXZlVGFiSW5kZXggPT09ICdudW1iZXInICYmIHRoaXMudGFic01vZGVsLmlzU3RpY2t5KGFjdGl2ZVRhYkluZGV4KTtcblxuXHRcdC8vIFNwZWNpYWwgY2FzZTogd2UgaGF2ZSBzdGlja3kgdGFicyBidXQgdGhlIGF2YWlsYWJsZSBzcGFjZSBmb3Igc2hvd2luZyB0YWJzXG5cdFx0Ly8gaXMgbGl0dGxlIGVub3VnaCB0aGF0IHdlIG5lZWQgdG8gZGlzYWJsZSBzdGlja3kgdGFicyBzdGlja3kgcG9zaXRpb25pbmdcblx0XHQvLyBzbyB0aGF0IHRhYnMgY2FuIGJlIHNjcm9sbGVkIGF0IG5hdHVyYWxseS5cblx0XHRsZXQgYXZhaWxhYmxlVGFic0NvbnRhaW5lcldpZHRoID0gdmlzaWJsZVRhYnNXaWR0aCAtIHN0aWNreVRhYnNXaWR0aDtcblx0XHRpZiAodGhpcy50YWJzTW9kZWwuc3RpY2t5Q291bnQgPiAwICYmIGF2YWlsYWJsZVRhYnNDb250YWluZXJXaWR0aCA8IE11bHRpRWRpdG9yVGFic0NvbnRyb2wuVEFCX1dJRFRILmZpdCkge1xuXHRcdFx0dGFic0NvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdkaXNhYmxlLXN0aWNreS10YWJzJyk7XG5cblx0XHRcdGF2YWlsYWJsZVRhYnNDb250YWluZXJXaWR0aCA9IHZpc2libGVUYWJzV2lkdGg7XG5cdFx0XHRzdGlja3lUYWJzV2lkdGggPSAwO1xuXHRcdFx0YWN0aXZlVGFiUG9zaXRpb25TdGF0aWMgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFic0NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdkaXNhYmxlLXN0aWNreS10YWJzJyk7XG5cdFx0fVxuXG5cdFx0bGV0IGFjdGl2ZVRhYlBvc1g6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRsZXQgYWN0aXZlVGFiV2lkdGg6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRcdGlmICghdGhpcy5ibG9ja1JldmVhbEFjdGl2ZVRhYiAmJiBhY3RpdmVUYWIpIHtcblx0XHRcdGFjdGl2ZVRhYlBvc1ggPSBhY3RpdmVUYWIub2Zmc2V0TGVmdDtcblx0XHRcdGFjdGl2ZVRhYldpZHRoID0gYWN0aXZlVGFiLm9mZnNldFdpZHRoO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBzY3JvbGxiYXJcblx0XHRjb25zdCB7IHdpZHRoOiBvbGRWaXNpYmxlVGFic1dpZHRoLCBzY3JvbGxXaWR0aDogb2xkQWxsVGFic1dpZHRoIH0gPSB0YWJzU2Nyb2xsYmFyLmdldFNjcm9sbERpbWVuc2lvbnMoKTtcblx0XHR0YWJzU2Nyb2xsYmFyLnNldFNjcm9sbERpbWVuc2lvbnMoe1xuXHRcdFx0d2lkdGg6IHZpc2libGVUYWJzV2lkdGgsXG5cdFx0XHRzY3JvbGxXaWR0aDogYWxsVGFic1dpZHRoXG5cdFx0fSk7XG5cdFx0Y29uc3QgZGltZW5zaW9uc0NoYW5nZWQgPSBvbGRWaXNpYmxlVGFic1dpZHRoICE9PSB2aXNpYmxlVGFic1dpZHRoIHx8IG9sZEFsbFRhYnNXaWR0aCAhPT0gYWxsVGFic1dpZHRoO1xuXG5cdFx0Ly8gUmV2ZWFsaW5nIHRoZSBhY3RpdmUgdGFiIGlzIHNraXBwZWQgdW5kZXIgc29tZSBjb25kaXRpb25zOlxuXHRcdGlmIChcblx0XHRcdHRoaXMuYmxvY2tSZXZlYWxBY3RpdmVUYWIgfHxcdFx0XHRcdFx0XHRcdC8vIGV4cGxpY2l0bHkgZGlzYWJsZWRcblx0XHRcdHR5cGVvZiBhY3RpdmVUYWJQb3NYICE9PSAnbnVtYmVyJyB8fFx0XHRcdFx0XHQvLyBpbnZhbGlkIGRpbWVuc2lvblxuXHRcdFx0dHlwZW9mIGFjdGl2ZVRhYldpZHRoICE9PSAnbnVtYmVyJyB8fFx0XHRcdFx0XHQvLyBpbnZhbGlkIGRpbWVuc2lvblxuXHRcdFx0YWN0aXZlVGFiUG9zaXRpb25TdGF0aWMgfHxcdFx0XHRcdFx0XHRcdFx0Ly8gc3RhdGljIHRhYiAoc3RpY2t5KVxuXHRcdFx0KCFkaW1lbnNpb25zQ2hhbmdlZCAmJiAhb3B0aW9ucz8uZm9yY2VSZXZlYWxBY3RpdmVUYWIpIFx0Ly8gZGltZW5zaW9ucyBkaWQgbm90IGNoYW5nZSBhbmQgd2UgaGF2ZSBsb3cgbGF5b3V0IHByaW9yaXR5IChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTMzNjMxKVxuXHRcdCkge1xuXHRcdFx0dGhpcy5ibG9ja1JldmVhbEFjdGl2ZVRhYiA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJldmVhbCB0aGUgYWN0aXZlIG9uZVxuXHRcdGNvbnN0IHRhYnNDb250YWluZXJTY3JvbGxQb3NYID0gdGFic1Njcm9sbGJhci5nZXRTY3JvbGxQb3NpdGlvbigpLnNjcm9sbExlZnQ7XG5cdFx0Y29uc3QgYWN0aXZlVGFiRml0cyA9IGFjdGl2ZVRhYldpZHRoIDw9IGF2YWlsYWJsZVRhYnNDb250YWluZXJXaWR0aDtcblx0XHRjb25zdCBhZGp1c3RlZEFjdGl2ZVRhYlBvc1ggPSBhY3RpdmVUYWJQb3NYIC0gc3RpY2t5VGFic1dpZHRoO1xuXG5cdFx0Ly9cblx0XHQvLyBTeW5vcHNpc1xuXHRcdC8vIC0gYWRqdXN0ZWRBY3RpdmVUYWJQb3NYOiB0aGUgYWRqdXN0ZWQgdGFiUG9zWCB0YWtlcyB0aGUgd2lkdGggb2Ygc3RpY2t5IHRhYnMgaW50byBhY2NvdW50XG5cdFx0Ly8gICBjb25jZXB0dWFsbHkgdGhlIHNjcm9sbGluZyBvbmx5IGJlZ2lucyBhZnRlciBzdGlja3kgdGFicyBzbyBpbiBvcmRlciB0byByZXZlYWwgYSB0YWIgZnVsbHlcblx0XHQvLyAgIHRoZSBhY3R1YWwgcG9zaXRpb24gbmVlZHMgdG8gYmUgYWRqdXN0ZWQgZm9yIHN0aWNreSB0YWJzLlxuXHRcdC8vXG5cdFx0Ly8gVGFiIGlzIG92ZXJmbG93aW5nIHRvIHRoZSByaWdodDogU2Nyb2xsIG1pbmltYWxseSB1bnRpbCB0aGUgZWxlbWVudCBpcyBmdWxseSB2aXNpYmxlIHRvIHRoZSByaWdodFxuXHRcdC8vIE5vdGU6IG9ubHkgdHJ5IHRvIGRvIHRoaXMgaWYgd2UgYWN0dWFsbHkgaGF2ZSBlbm91Z2ggd2lkdGggdG8gZ2l2ZSB0byBzaG93IHRoZSB0YWIgZnVsbHkhXG5cdFx0Ly9cblx0XHQvLyBFeGFtcGxlOiBUYWIgRyBzaG91bGQgYmUgbWFkZSBhY3RpdmUgYW5kIG5lZWRzIHRvIGJlIGZ1bGx5IHJldmVhbGVkIGFzIHN1Y2guXG5cdFx0Ly9cblx0XHQvLyBbLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gQWxsIHRhYnMgd2lkdGggLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1dXG5cdFx0Ly8gWy0tLS0tLS0tLS0tLS0tLS0tLS0tIFZpc2libGUgY29udGFpbmVyIHdpZHRoIC0tLS0tLS0tLS0tLS0tLS0tLS0tXVxuXHRcdC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgWy0tLS0tIEF2YWlsYWJsZSBjb250YWluZXIgd2lkdGggLS0tLS0tLV1cblx0XHQvLyAgICAgWyBTdGlja3kgQSBdWyBTdGlja3kgQiBdWyBUYWIgQyBdWyBUYWIgRCBdWyBUYWIgRSBdWyBUYWIgRiBdWyBUYWIgRyBdWyBUYWIgSCBdWyBUYWIgSSBdXG5cdFx0Ly8gICAgICAgICAgICAgICAgICAgICBBY3RpdmUgVGFiIFdpZHRoIFstLS0tLS0tXVxuXHRcdC8vICAgICBbLS0tLS0tLSBBY3RpdmUgVGFiIFBvcyBYIC0tLS0tLS1dXG5cdFx0Ly8gICAgICAgICAgICAgICAgICAgICAgICAgICAgIFstLS0tLS0tLSBBZGp1c3RlZCBUYWIgUG9zIFggLS0tLS0tLV1cblx0XHQvLyAgICAgWy0tIFN0aWNreSBUYWJzIFdpZHRoIC0tXVxuXHRcdC8vXG5cdFx0Ly9cblx0XHRpZiAoYWN0aXZlVGFiRml0cyAmJiB0YWJzQ29udGFpbmVyU2Nyb2xsUG9zWCArIGF2YWlsYWJsZVRhYnNDb250YWluZXJXaWR0aCA8IGFkanVzdGVkQWN0aXZlVGFiUG9zWCArIGFjdGl2ZVRhYldpZHRoKSB7XG5cdFx0XHR0YWJzU2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHtcblx0XHRcdFx0c2Nyb2xsTGVmdDogdGFic0NvbnRhaW5lclNjcm9sbFBvc1ggKyAoKGFkanVzdGVkQWN0aXZlVGFiUG9zWCArIGFjdGl2ZVRhYldpZHRoKSAvKiByaWdodCBjb3JuZXIgb2YgdGFiICovIC0gKHRhYnNDb250YWluZXJTY3JvbGxQb3NYICsgYXZhaWxhYmxlVGFic0NvbnRhaW5lcldpZHRoKSAvKiByaWdodCBjb3JuZXIgb2YgdmlldyBwb3J0ICovKVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly9cblx0XHQvLyBUYWIgaXMgb3ZlcmxmbG93aW5nIHRvIHRoZSBsZWZ0IG9yIGRvZXMgbm90IGZpdDogU2Nyb2xsIGl0IGludG8gdmlldyB0byB0aGUgbGVmdFxuXHRcdC8vXG5cdFx0Ly8gRXhhbXBsZTogVGFiIEMgc2hvdWxkIGJlIG1hZGUgYWN0aXZlIGFuZCBuZWVkcyB0byBiZSBmdWxseSByZXZlYWxlZCBhcyBzdWNoLlxuXHRcdC8vXG5cdFx0Ly8gWy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIEFsbCB0YWJzIHdpZHRoIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1dXG5cdFx0Ly8gICAgIFstLS0tLS0tLS0tLS0tLS0tLS0gVmlzaWJsZSBjb250YWluZXIgd2lkdGggLS0tLS0tLS0tLS0tLS0tLS0tXVxuXHRcdC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgWy0tLS0tIEF2YWlsYWJsZSBjb250YWluZXIgd2lkdGggLS0tLS0tLV1cblx0XHQvLyBbIFN0aWNreSBBIF1bIFN0aWNreSBCIF1bIFRhYiBDIF1bIFRhYiBEIF1bIFRhYiBFIF1bIFRhYiBGIF1bIFRhYiBHIF1bIFRhYiBIIF1bIFRhYiBJIF1cblx0XHQvLyAgICAgICAgICAgICAgICAgQWN0aXZlIFRhYiBXaWR0aCBbLS0tLS0tLV1cblx0XHQvLyBbLS0tLS0tLSBBY3RpdmUgVGFiIFBvcyBYIC0tLS0tLS1dXG5cdFx0Ly8gICAgICBBZGp1c3RlZCBUYWIgUG9zIFggW11cblx0XHQvLyBbLS0gU3RpY2t5IFRhYnMgV2lkdGggLS1dXG5cdFx0Ly9cblx0XHQvL1xuXHRcdGVsc2UgaWYgKHRhYnNDb250YWluZXJTY3JvbGxQb3NYID4gYWRqdXN0ZWRBY3RpdmVUYWJQb3NYIHx8ICFhY3RpdmVUYWJGaXRzKSB7XG5cdFx0XHR0YWJzU2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHtcblx0XHRcdFx0c2Nyb2xsTGVmdDogYWRqdXN0ZWRBY3RpdmVUYWJQb3NYXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRhYnNDb250cm9sVmlzaWJpbGl0eSgpOiB2b2lkIHtcblx0XHRjb25zdCB0YWJzQW5kQWN0aW9uc0NvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLnRhYnNBbmRBY3Rpb25zQ29udGFpbmVyKTtcblx0XHR0YWJzQW5kQWN0aW9uc0NvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdlbXB0eScsICF0aGlzLnZpc2libGUpO1xuXG5cdFx0Ly8gUmVzZXQgZGltZW5zaW9ucyBpZiBoaWRkZW5cblx0XHRpZiAoIXRoaXMudmlzaWJsZSAmJiB0aGlzLmRpbWVuc2lvbnMpIHtcblx0XHRcdHRoaXMuZGltZW5zaW9ucy51c2VkID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0IHZpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudGFic01vZGVsLmNvdW50ID4gMDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VGFiQW5kSW5kZXgoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IFtIVE1MRWxlbWVudCwgbnVtYmVyIC8qIGluZGV4ICovXSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgdGFiSW5kZXggPSB0aGlzLnRhYnNNb2RlbC5pbmRleE9mKGVkaXRvcik7XG5cdFx0Y29uc3QgdGFiID0gdGhpcy5nZXRUYWJBdEluZGV4KHRhYkluZGV4KTtcblx0XHRpZiAodGFiKSB7XG5cdFx0XHRyZXR1cm4gW3RhYiwgdGFiSW5kZXhdO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldFRhYkF0SW5kZXgodGFiSW5kZXg6IG51bWJlcik6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGFiSW5kZXggPj0gMCkge1xuXHRcdFx0Y29uc3QgdGFic0NvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLnRhYnNDb250YWluZXIpO1xuXG5cdFx0XHRyZXR1cm4gdGFic0NvbnRhaW5lci5jaGlsZHJlblt0YWJJbmRleF0gYXMgSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TGFzdFRhYigpOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0VGFiQXRJbmRleCh0aGlzLnRhYnNNb2RlbC5jb3VudCAtIDEpO1xuXHR9XG5cblx0cHJpdmF0ZSBibG9ja1JldmVhbEFjdGl2ZVRhYk9uY2UoKTogdm9pZCB7XG5cblx0XHQvLyBXaGVuIGNsb3NpbmcgdGFicyB0aHJvdWdoIHRoZSB0YWIgY2xvc2UgYnV0dG9uIG9yIGdlc3R1cmUsIHRoZSB1c2VyXG5cdFx0Ly8gbWlnaHQgd2FudCB0byByYXBpZGx5IGNsb3NlIHRhYnMgaW4gc2VxdWVuY2UgYW5kIGFzIHN1Y2ggcmV2ZWFsaW5nXG5cdFx0Ly8gdGhlIGFjdGl2ZSB0YWIgYWZ0ZXIgZWFjaCBjbG9zZSB3b3VsZCBiZSBhbm5veWluZy4gQXMgc3VjaCB3ZSBibG9ja1xuXHRcdC8vIHRoZSBhdXRvbWF0ZWQgcmV2ZWFsaW5nIG9mIHRoZSBhY3RpdmUgdGFiIG9uY2UgYWZ0ZXIgdGhlIGNsb3NlIGlzXG5cdFx0Ly8gdHJpZ2dlcmVkLlxuXHRcdHRoaXMuYmxvY2tSZXZlYWxBY3RpdmVUYWIgPSB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBvcmlnaW5hdGVzRnJvbVRhYkFjdGlvbkJhcihlOiBNb3VzZUV2ZW50IHwgR2VzdHVyZUV2ZW50KTogYm9vbGVhbiB7XG5cdFx0bGV0IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRcdGlmIChpc01vdXNlRXZlbnQoZSkpIHtcblx0XHRcdGVsZW1lbnQgPSAoZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50KSBhcyBIVE1MRWxlbWVudDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZWxlbWVudCA9IChlIGFzIEdlc3R1cmVFdmVudCkuaW5pdGlhbFRhcmdldCBhcyBIVE1MRWxlbWVudDtcblx0XHR9XG5cblx0XHRyZXR1cm4gISFmaW5kUGFyZW50V2l0aENsYXNzKGVsZW1lbnQsICdhY3Rpb24taXRlbScsICd0YWInKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25Ecm9wKGU6IERyYWdFdmVudCwgdGFyZ2V0VGFiSW5kZXg6IG51bWJlciwgdGFic0NvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXG5cdFx0dGhpcy51cGRhdGVEcm9wRmVlZGJhY2sodGFic0NvbnRhaW5lciwgZmFsc2UsIGUsIHRhcmdldFRhYkluZGV4KTtcblx0XHR0YWJzQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3Njcm9sbCcpO1xuXG5cdFx0bGV0IHRhcmdldEVkaXRvckluZGV4ID0gdGhpcy50YWJzTW9kZWwgaW5zdGFuY2VvZiBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwgPyB0YXJnZXRUYWJJbmRleCArIHRoaXMuZ3JvdXBWaWV3LnN0aWNreUNvdW50IDogdGFyZ2V0VGFiSW5kZXg7XG5cdFx0Y29uc3Qgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRzdGlja3k6IHRoaXMudGFic01vZGVsIGluc3RhbmNlb2YgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbCAmJiB0aGlzLnRhYnNNb2RlbC5zdGlja3lDb3VudCA9PT0gdGFyZ2V0RWRpdG9ySW5kZXgsXG5cdFx0XHRpbmRleDogdGFyZ2V0RWRpdG9ySW5kZXhcblx0XHR9O1xuXG5cdFx0Ly8gQ2hlY2sgZm9yIGdyb3VwIHRyYW5zZmVyXG5cdFx0aWYgKHRoaXMuZ3JvdXBUcmFuc2Zlci5oYXNEYXRhKERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXIucHJvdG90eXBlKSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMuZ3JvdXBUcmFuc2Zlci5nZXREYXRhKERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXIucHJvdG90eXBlKTtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGRhdGEpICYmIGRhdGEubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBzb3VyY2VHcm91cCA9IHRoaXMuZWRpdG9yUGFydHNWaWV3LmdldEdyb3VwKGRhdGFbMF0uaWRlbnRpZmllcik7XG5cdFx0XHRcdGlmIChzb3VyY2VHcm91cCkge1xuXHRcdFx0XHRcdGNvbnN0IG1lcmdlR3JvdXBPcHRpb25zOiBJTWVyZ2VHcm91cE9wdGlvbnMgPSB7IGluZGV4OiB0YXJnZXRFZGl0b3JJbmRleCB9O1xuXHRcdFx0XHRcdGlmICghdGhpcy5pc01vdmVPcGVyYXRpb24oZSwgc291cmNlR3JvdXAuaWQpKSB7XG5cdFx0XHRcdFx0XHRtZXJnZUdyb3VwT3B0aW9ucy5tb2RlID0gTWVyZ2VHcm91cE1vZGUuQ09QWV9FRElUT1JTO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuZ3JvdXBzVmlldy5tZXJnZUdyb3VwKHNvdXJjZUdyb3VwLCB0aGlzLmdyb3VwVmlldywgbWVyZ2VHcm91cE9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5ncm91cFZpZXcuZm9jdXMoKTtcblx0XHRcdFx0dGhpcy5ncm91cFRyYW5zZmVyLmNsZWFyRGF0YShEcmFnZ2VkRWRpdG9yR3JvdXBJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgZm9yIGVkaXRvciB0cmFuc2ZlclxuXHRcdGVsc2UgaWYgKHRoaXMuZWRpdG9yVHJhbnNmZXIuaGFzRGF0YShEcmFnZ2VkRWRpdG9ySWRlbnRpZmllci5wcm90b3R5cGUpKSB7XG5cdFx0XHRjb25zdCBkYXRhID0gdGhpcy5lZGl0b3JUcmFuc2Zlci5nZXREYXRhKERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSAmJiBkYXRhLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3Qgc291cmNlR3JvdXAgPSB0aGlzLmVkaXRvclBhcnRzVmlldy5nZXRHcm91cChkYXRhWzBdLmlkZW50aWZpZXIuZ3JvdXBJZCk7XG5cdFx0XHRcdGlmIChzb3VyY2VHcm91cCkge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgZGUgb2YgZGF0YSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZWRpdG9yID0gZGUuaWRlbnRpZmllci5lZGl0b3I7XG5cblx0XHRcdFx0XHRcdC8vIE9ubHkgYWxsb3cgbW92aW5nL2NvcHlpbmcgZnJvbSBhIHNpbmdsZSBncm91cCBzb3VyY2Vcblx0XHRcdFx0XHRcdGlmIChzb3VyY2VHcm91cC5pZCAhPT0gZGUuaWRlbnRpZmllci5ncm91cElkKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBLZWVwIHRoZSBzYW1lIG9yZGVyIHdoZW4gbW92aW5nIC8gY29weWluZyBlZGl0b3JzIHdpdGhpbiB0aGUgc2FtZSBncm91cFxuXHRcdFx0XHRcdFx0Y29uc3Qgc291cmNlRWRpdG9ySW5kZXggPSBzb3VyY2VHcm91cC5nZXRJbmRleE9mRWRpdG9yKGVkaXRvcik7XG5cdFx0XHRcdFx0XHRpZiAoc291cmNlR3JvdXAgPT09IHRoaXMuZ3JvdXBWaWV3ICYmIHNvdXJjZUVkaXRvckluZGV4IDwgdGFyZ2V0RWRpdG9ySW5kZXgpIHtcblx0XHRcdFx0XHRcdFx0dGFyZ2V0RWRpdG9ySW5kZXgtLTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuaXNNb3ZlT3BlcmF0aW9uKGUsIGRlLmlkZW50aWZpZXIuZ3JvdXBJZCwgZWRpdG9yKSkge1xuXHRcdFx0XHRcdFx0XHRzb3VyY2VHcm91cC5tb3ZlRWRpdG9yKGVkaXRvciwgdGhpcy5ncm91cFZpZXcsIHsgLi4ub3B0aW9ucywgaW5kZXg6IHRhcmdldEVkaXRvckluZGV4IH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0c291cmNlR3JvdXAuY29weUVkaXRvcihlZGl0b3IsIHRoaXMuZ3JvdXBWaWV3LCB7IC4uLm9wdGlvbnMsIGluZGV4OiB0YXJnZXRFZGl0b3JJbmRleCB9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dGFyZ2V0RWRpdG9ySW5kZXgrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5ncm91cFZpZXcuZm9jdXMoKTtcblx0XHRcdHRoaXMuZWRpdG9yVHJhbnNmZXIuY2xlYXJEYXRhKERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgZm9yIHRyZWUgaXRlbXNcblx0XHRlbHNlIGlmICh0aGlzLnRyZWVJdGVtc1RyYW5zZmVyLmhhc0RhdGEoRHJhZ2dlZFRyZWVJdGVtc0lkZW50aWZpZXIucHJvdG90eXBlKSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMudHJlZUl0ZW1zVHJhbnNmZXIuZ2V0RGF0YShEcmFnZ2VkVHJlZUl0ZW1zSWRlbnRpZmllci5wcm90b3R5cGUpO1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoZGF0YSkgJiYgZGF0YS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvcnM6IElVbnR5cGVkRWRpdG9ySW5wdXRbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGRhdGEpIHtcblx0XHRcdFx0XHRjb25zdCBkYXRhVHJhbnNmZXJJdGVtID0gYXdhaXQgdGhpcy50cmVlVmlld3NEcmFnQW5kRHJvcFNlcnZpY2UucmVtb3ZlRHJhZ09wZXJhdGlvblRyYW5zZmVyKGlkLmlkZW50aWZpZXIpO1xuXHRcdFx0XHRcdGlmIChkYXRhVHJhbnNmZXJJdGVtKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB0cmVlRHJvcERhdGEgPSBhd2FpdCBleHRyYWN0VHJlZURyb3BEYXRhKGRhdGFUcmFuc2Zlckl0ZW0pO1xuXHRcdFx0XHRcdFx0ZWRpdG9ycy5wdXNoKC4uLnRyZWVEcm9wRGF0YS5tYXAoZWRpdG9yID0+ICh7IC4uLmVkaXRvciwgb3B0aW9uczogeyAuLi5lZGl0b3Iub3B0aW9ucywgcGlubmVkOiB0cnVlLCBpbmRleDogdGFyZ2V0RWRpdG9ySW5kZXggfSB9KSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9ycyhlZGl0b3JzLCB0aGlzLmdyb3VwVmlldywgeyB2YWxpZGF0ZVRydXN0OiB0cnVlIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnRyZWVJdGVtc1RyYW5zZmVyLmNsZWFyRGF0YShEcmFnZ2VkVHJlZUl0ZW1zSWRlbnRpZmllci5wcm90b3R5cGUpO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGZvciBVUkkgdHJhbnNmZXJcblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IGRyb3BIYW5kbGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZXNEcm9wSGFuZGxlciwgeyBhbGxvd1dvcmtzcGFjZU9wZW46IGZhbHNlIH0pO1xuXHRcdFx0ZHJvcEhhbmRsZXIuaGFuZGxlRHJvcChlLCBnZXRXaW5kb3codGhpcy5wYXJlbnQpLCAoKSA9PiB0aGlzLmdyb3VwVmlldywgKCkgPT4gdGhpcy5ncm91cFZpZXcuZm9jdXMoKSwgb3B0aW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLnRhYkRpc3Bvc2FibGVzID0gZGlzcG9zZSh0aGlzLnRhYkRpc3Bvc2FibGVzKTtcblx0fVxufVxuXG5yZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCgodGhlbWUsIGNvbGxlY3RvcikgPT4ge1xuXG5cdC8vIEFkZCBib3R0b20gYm9yZGVyIHRvIHRhYnMgd2hlbiB3cmFwcGluZ1xuXHRjb25zdCBib3JkZXJDb2xvciA9IHRoZW1lLmdldENvbG9yKFRBQl9CT1JERVIpO1xuXHRpZiAoYm9yZGVyQ29sb3IpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudCAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lciA+IC50aXRsZSA+IC50YWJzLWFuZC1hY3Rpb25zLWNvbnRhaW5lci53cmFwcGluZyAudGFicy1jb250YWluZXIgPiAudGFiIHtcblx0XHRcdFx0Ym9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICR7Ym9yZGVyQ29sb3J9O1xuXHRcdFx0fVxuXHRcdGApO1xuXHR9XG5cblx0Ly8gU3R5bGluZyB3aXRoIE91dGxpbmUgY29sb3IgKGUuZy4gaGlnaCBjb250cmFzdCB0aGVtZSlcblx0Y29uc3QgYWN0aXZlQ29udHJhc3RCb3JkZXJDb2xvciA9IHRoZW1lLmdldENvbG9yKGFjdGl2ZUNvbnRyYXN0Qm9yZGVyKTtcblx0aWYgKGFjdGl2ZUNvbnRyYXN0Qm9yZGVyQ29sb3IpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudCAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lci5hY3RpdmUgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5hY3RpdmUsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudCAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lci5hY3RpdmUgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5hY3RpdmU6aG92ZXIgIHtcblx0XHRcdFx0b3V0bGluZTogMXB4IHNvbGlkO1xuXHRcdFx0XHRvdXRsaW5lLW9mZnNldDogLTVweDtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5zZWxlY3RlZDpub3QoLmFjdGl2ZSk6bm90KDpob3ZlcikgIHtcblx0XHRcdFx0b3V0bGluZTogMXB4IGRvdHRlZDtcblx0XHRcdFx0b3V0bGluZS1vZmZzZXQ6IC01cHg7XG5cdFx0XHR9XG5cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5wYXJ0LmVkaXRvciA+IC5jb250ZW50IC5lZGl0b3ItZ3JvdXAtY29udGFpbmVyLmFjdGl2ZSA+IC50aXRsZSAudGFicy1jb250YWluZXIgPiAudGFiLmFjdGl2ZTpmb2N1cyB7XG5cdFx0XHRcdG91dGxpbmUtc3R5bGU6IGRhc2hlZDtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5hY3RpdmUge1xuXHRcdFx0XHRvdXRsaW5lOiAxcHggZG90dGVkO1xuXHRcdFx0XHRvdXRsaW5lLW9mZnNldDogLTVweDtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYjpob3ZlciAge1xuXHRcdFx0XHRvdXRsaW5lOiAxcHggZGFzaGVkO1xuXHRcdFx0XHRvdXRsaW5lLW9mZnNldDogLTVweDtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5hY3RpdmUgPiAudGFiLWFjdGlvbnMgLmFjdGlvbi1sYWJlbCxcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5wYXJ0LmVkaXRvciA+IC5jb250ZW50IC5lZGl0b3ItZ3JvdXAtY29udGFpbmVyID4gLnRpdGxlIC50YWJzLWNvbnRhaW5lciA+IC50YWIuYWN0aXZlOmhvdmVyID4gLnRhYi1hY3Rpb25zIC5hY3Rpb24tbGFiZWwsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudCAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lciA+IC50aXRsZSAudGFicy1jb250YWluZXIgPiAudGFiLmRpcnR5ID4gLnRhYi1hY3Rpb25zIC5hY3Rpb24tbGFiZWwsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudCAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lciA+IC50aXRsZSAudGFicy1jb250YWluZXIgPiAudGFiLnN0aWNreSA+IC50YWItYWN0aW9ucyAuYWN0aW9uLWxhYmVsLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYjpob3ZlciA+IC50YWItYWN0aW9ucyAuYWN0aW9uLWxhYmVsIHtcblx0XHRcdFx0b3BhY2l0eTogMSAhaW1wb3J0YW50O1xuXHRcdFx0fVxuXHRcdGApO1xuXHR9XG5cblx0Ly8gSGlnaCBDb250cmFzdCBCb3JkZXIgQ29sb3IgZm9yIEVkaXRvciBBY3Rpb25zXG5cdGNvbnN0IGNvbnRyYXN0Qm9yZGVyQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihjb250cmFzdEJvcmRlcik7XG5cdGlmIChjb250cmFzdEJvcmRlckNvbG9yKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIgPiAudGl0bGUgLmVkaXRvci1hY3Rpb25zIHtcblx0XHRcdFx0b3V0bGluZTogMXB4IHNvbGlkICR7Y29udHJhc3RCb3JkZXJDb2xvcn1cblx0XHRcdH1cblx0XHRgKTtcblx0fVxuXG5cdC8vIEhvdmVyIEJhY2tncm91bmRcblx0Y29uc3QgdGFiSG92ZXJCYWNrZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoVEFCX0hPVkVSX0JBQ0tHUk9VTkQpO1xuXHRpZiAodGFiSG92ZXJCYWNrZ3JvdW5kKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIuYWN0aXZlID4gLnRpdGxlIC50YWJzLWNvbnRhaW5lciA+IC50YWI6bm90KC5zZWxlY3RlZCk6aG92ZXIge1xuXHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiAke3RhYkhvdmVyQmFja2dyb3VuZH0gIWltcG9ydGFudDtcblx0XHRcdH1cblx0XHRgKTtcblx0fVxuXG5cdGNvbnN0IHRhYlVuZm9jdXNlZEhvdmVyQmFja2dyb3VuZCA9IHRoZW1lLmdldENvbG9yKFRBQl9VTkZPQ1VTRURfSE9WRVJfQkFDS0dST1VORCk7XG5cdGlmICh0YWJVbmZvY3VzZWRIb3ZlckJhY2tncm91bmQpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudCAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lciA+IC50aXRsZSAudGFicy1jb250YWluZXIgPiAudGFiOm5vdCguc2VsZWN0ZWQpOmhvdmVyICB7XG5cdFx0XHRcdGJhY2tncm91bmQtY29sb3I6ICR7dGFiVW5mb2N1c2VkSG92ZXJCYWNrZ3JvdW5kfSAhaW1wb3J0YW50O1xuXHRcdFx0fVxuXHRcdGApO1xuXHR9XG5cblx0Ly8gSG92ZXIgRm9yZWdyb3VuZFxuXHRjb25zdCB0YWJIb3ZlckZvcmVncm91bmQgPSB0aGVtZS5nZXRDb2xvcihUQUJfSE9WRVJfRk9SRUdST1VORCk7XG5cdGlmICh0YWJIb3ZlckZvcmVncm91bmQpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudCAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lci5hY3RpdmUgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYjpub3QoLnNlbGVjdGVkKTpob3ZlciAge1xuXHRcdFx0XHRjb2xvcjogJHt0YWJIb3ZlckZvcmVncm91bmR9ICFpbXBvcnRhbnQ7XG5cdFx0XHR9XG5cdFx0YCk7XG5cdH1cblxuXHRjb25zdCB0YWJVbmZvY3VzZWRIb3ZlckZvcmVncm91bmQgPSB0aGVtZS5nZXRDb2xvcihUQUJfVU5GT0NVU0VEX0hPVkVSX0ZPUkVHUk9VTkQpO1xuXHRpZiAodGFiVW5mb2N1c2VkSG92ZXJGb3JlZ3JvdW5kKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYjpub3QoLnNlbGVjdGVkKTpob3ZlciAge1xuXHRcdFx0XHRjb2xvcjogJHt0YWJVbmZvY3VzZWRIb3ZlckZvcmVncm91bmR9ICFpbXBvcnRhbnQ7XG5cdFx0XHR9XG5cdFx0YCk7XG5cdH1cblxuXHQvLyBIb3ZlciBCb3JkZXJcblx0Ly9cblx0Ly8gVW5mb3J0dW5hdGVseSB3ZSBuZWVkIHRvIGNvcHkgYSBsb3Qgb2YgQ1NTIG92ZXIgZnJvbSB0aGVcblx0Ly8gbXVsdGlFZGl0b3JUYWJzQ29udHJvbC5jc3MgYmVjYXVzZSB3ZSB3YW50IHRvIHJldXNlIHRoZSBzYW1lXG5cdC8vIHN0eWxlcyB3ZSBhbHJlYWR5IGhhdmUgZm9yIHRoZSBub3JtYWwgYm90dG9tLWJvcmRlci5cblx0Y29uc3QgdGFiSG92ZXJCb3JkZXIgPSB0aGVtZS5nZXRDb2xvcihUQUJfSE9WRVJfQk9SREVSKTtcblx0aWYgKHRhYkhvdmVyQm9yZGVyKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIuYWN0aXZlID4gLnRpdGxlIC50YWJzLWNvbnRhaW5lciA+IC50YWI6aG92ZXIgPiAudGFiLWJvcmRlci1ib3R0b20tY29udGFpbmVyIHtcblx0XHRcdFx0ZGlzcGxheTogYmxvY2s7XG5cdFx0XHRcdHBvc2l0aW9uOiBhYnNvbHV0ZTtcblx0XHRcdFx0bGVmdDogMDtcblx0XHRcdFx0cG9pbnRlci1ldmVudHM6IG5vbmU7XG5cdFx0XHRcdHdpZHRoOiAxMDAlO1xuXHRcdFx0XHR6LWluZGV4OiAxMDtcblx0XHRcdFx0Ym90dG9tOiAwO1xuXHRcdFx0XHRoZWlnaHQ6IDFweDtcblx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogJHt0YWJIb3ZlckJvcmRlcn07XG5cdFx0XHR9XG5cdFx0YCk7XG5cdH1cblxuXHRjb25zdCB0YWJVbmZvY3VzZWRIb3ZlckJvcmRlciA9IHRoZW1lLmdldENvbG9yKFRBQl9VTkZPQ1VTRURfSE9WRVJfQk9SREVSKTtcblx0aWYgKHRhYlVuZm9jdXNlZEhvdmVyQm9yZGVyKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQgLmVkaXRvci1ncm91cC1jb250YWluZXIgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYjpob3ZlciA+IC50YWItYm9yZGVyLWJvdHRvbS1jb250YWluZXIgIHtcblx0XHRcdFx0ZGlzcGxheTogYmxvY2s7XG5cdFx0XHRcdHBvc2l0aW9uOiBhYnNvbHV0ZTtcblx0XHRcdFx0bGVmdDogMDtcblx0XHRcdFx0cG9pbnRlci1ldmVudHM6IG5vbmU7XG5cdFx0XHRcdHdpZHRoOiAxMDAlO1xuXHRcdFx0XHR6LWluZGV4OiAxMDtcblx0XHRcdFx0Ym90dG9tOiAwO1xuXHRcdFx0XHRoZWlnaHQ6IDFweDtcblx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogJHt0YWJVbmZvY3VzZWRIb3ZlckJvcmRlcn07XG5cdFx0XHR9XG5cdFx0YCk7XG5cdH1cblxuXHQvLyBGYWRlIG91dCBzdHlsZXMgdmlhIGxpbmVhciBncmFkaWVudCAod2hlbiB0YWJzIGFyZSBzZXQgdG8gc2hyaW5rIG9yIGZpeGVkKVxuXHQvLyBCdXQgbm90IHdoZW46XG5cdC8vIC0gaW4gaGlnaCBjb250cmFzdCB0aGVtZVxuXHQvLyAtIGlmIHdlIGhhdmUgYSBjb250cmFzdCBib3JkZXIgKHdoaWNoIGRyYXdzIGFuIG91dGxpbmUgLSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTA5MTE3KVxuXHQvLyAtIG9uIFNhZmFyaSAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwODk5Nilcblx0aWYgKCFpc0hpZ2hDb250cmFzdCh0aGVtZS50eXBlKSAmJiAhaXNTYWZhcmkgJiYgIWFjdGl2ZUNvbnRyYXN0Qm9yZGVyQ29sb3IpIHtcblx0XHRjb25zdCB3b3JrYmVuY2hCYWNrZ3JvdW5kID0gV09SS0JFTkNIX0JBQ0tHUk9VTkQodGhlbWUpO1xuXHRcdGNvbnN0IGVkaXRvckJhY2tncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGVkaXRvckJhY2tncm91bmQpO1xuXHRcdGNvbnN0IGVkaXRvckdyb3VwSGVhZGVyVGFic0JhY2tncm91bmQgPSB0aGVtZS5nZXRDb2xvcihFRElUT1JfR1JPVVBfSEVBREVSX1RBQlNfQkFDS0dST1VORCk7XG5cdFx0Y29uc3QgZWRpdG9yRHJhZ0FuZERyb3BCYWNrZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoRURJVE9SX0RSQUdfQU5EX0RST1BfQkFDS0dST1VORCk7XG5cblx0XHRsZXQgYWRqdXN0ZWRUYWJCYWNrZ3JvdW5kOiBDb2xvciB8IHVuZGVmaW5lZDtcblx0XHRpZiAoZWRpdG9yR3JvdXBIZWFkZXJUYWJzQmFja2dyb3VuZCAmJiBlZGl0b3JCYWNrZ3JvdW5kQ29sb3IpIHtcblx0XHRcdGFkanVzdGVkVGFiQmFja2dyb3VuZCA9IGVkaXRvckdyb3VwSGVhZGVyVGFic0JhY2tncm91bmQuZmxhdHRlbihlZGl0b3JCYWNrZ3JvdW5kQ29sb3IsIGVkaXRvckJhY2tncm91bmRDb2xvciwgd29ya2JlbmNoQmFja2dyb3VuZCk7XG5cdFx0fVxuXG5cdFx0bGV0IGFkanVzdGVkVGFiRHJhZ0JhY2tncm91bmQ6IENvbG9yIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChlZGl0b3JHcm91cEhlYWRlclRhYnNCYWNrZ3JvdW5kICYmIGVkaXRvckJhY2tncm91bmRDb2xvciAmJiBlZGl0b3JEcmFnQW5kRHJvcEJhY2tncm91bmQgJiYgZWRpdG9yQmFja2dyb3VuZENvbG9yKSB7XG5cdFx0XHRhZGp1c3RlZFRhYkRyYWdCYWNrZ3JvdW5kID0gZWRpdG9yR3JvdXBIZWFkZXJUYWJzQmFja2dyb3VuZC5mbGF0dGVuKGVkaXRvckJhY2tncm91bmRDb2xvciwgZWRpdG9yRHJhZ0FuZERyb3BCYWNrZ3JvdW5kLCBlZGl0b3JCYWNrZ3JvdW5kQ29sb3IsIHdvcmtiZW5jaEJhY2tncm91bmQpO1xuXHRcdH1cblxuXHRcdC8vIEFkanVzdCBncmFkaWVudCBmb3IgZm9jdXNlZCBhbmQgdW5mb2N1c2VkIGhvdmVyIGJhY2tncm91bmRcblx0XHRjb25zdCBtYWtlVGFiSG92ZXJCYWNrZ3JvdW5kUnVsZSA9IChjb2xvcjogQ29sb3IsIGNvbG9yRHJhZzogQ29sb3IsIGhhc0ZvY3VzID0gZmFsc2UpID0+IGBcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5wYXJ0LmVkaXRvciA+IC5jb250ZW50Om5vdCguZHJhZ2dlZC1vdmVyKSAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lciR7aGFzRm9jdXMgPyAnLmFjdGl2ZScgOiAnJ30gPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5zaXppbmctc2hyaW5rOm5vdCguZHJhZ2dlZCk6bm90KC5zdGlja3ktY29tcGFjdCk6aG92ZXIgPiAudGFiLWxhYmVsID4gLm1vbmFjby1pY29uLWxhYmVsLWNvbnRhaW5lcjo6YWZ0ZXIsXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudDpub3QoLmRyYWdnZWQtb3ZlcikgLmVkaXRvci1ncm91cC1jb250YWluZXIke2hhc0ZvY3VzID8gJy5hY3RpdmUnIDogJyd9ID4gLnRpdGxlIC50YWJzLWNvbnRhaW5lciA+IC50YWIuc2l6aW5nLWZpeGVkOm5vdCguZHJhZ2dlZCk6bm90KC5zdGlja3ktY29tcGFjdCk6aG92ZXIgPiAudGFiLWxhYmVsID4gLm1vbmFjby1pY29uLWxhYmVsLWNvbnRhaW5lcjo6YWZ0ZXIge1xuXHRcdFx0XHRiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQodG8gbGVmdCwgJHtjb2xvcn0sIHRyYW5zcGFyZW50KSAhaW1wb3J0YW50O1xuXHRcdFx0fVxuXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudC5kcmFnZ2VkLW92ZXIgLmVkaXRvci1ncm91cC1jb250YWluZXIke2hhc0ZvY3VzID8gJy5hY3RpdmUnIDogJyd9ID4gLnRpdGxlIC50YWJzLWNvbnRhaW5lciA+IC50YWIuc2l6aW5nLXNocmluazpub3QoLmRyYWdnZWQpOm5vdCguc3RpY2t5LWNvbXBhY3QpOmhvdmVyID4gLnRhYi1sYWJlbCA+IC5tb25hY28taWNvbi1sYWJlbC1jb250YWluZXI6OmFmdGVyLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQuZHJhZ2dlZC1vdmVyIC5lZGl0b3ItZ3JvdXAtY29udGFpbmVyJHtoYXNGb2N1cyA/ICcuYWN0aXZlJyA6ICcnfSA+IC50aXRsZSAudGFicy1jb250YWluZXIgPiAudGFiLnNpemluZy1maXhlZDpub3QoLmRyYWdnZWQpOm5vdCguc3RpY2t5LWNvbXBhY3QpOmhvdmVyID4gLnRhYi1sYWJlbCA+IC5tb25hY28taWNvbi1sYWJlbC1jb250YWluZXI6OmFmdGVyIHtcblx0XHRcdFx0YmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KHRvIGxlZnQsICR7Y29sb3JEcmFnfSwgdHJhbnNwYXJlbnQpICFpbXBvcnRhbnQ7XG5cdFx0XHR9XG5cdFx0YDtcblxuXHRcdC8vIEFkanVzdCBncmFkaWVudCBmb3IgKGZvY3VzZWQpIGhvdmVyIGJhY2tncm91bmRcblx0XHRpZiAodGFiSG92ZXJCYWNrZ3JvdW5kICYmIGFkanVzdGVkVGFiQmFja2dyb3VuZCAmJiBhZGp1c3RlZFRhYkRyYWdCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb25zdCBhZGp1c3RlZENvbG9yID0gdGFiSG92ZXJCYWNrZ3JvdW5kLmZsYXR0ZW4oYWRqdXN0ZWRUYWJCYWNrZ3JvdW5kKTtcblx0XHRcdGNvbnN0IGFkanVzdGVkQ29sb3JEcmFnID0gdGFiSG92ZXJCYWNrZ3JvdW5kLmZsYXR0ZW4oYWRqdXN0ZWRUYWJEcmFnQmFja2dyb3VuZCk7XG5cdFx0XHRjb2xsZWN0b3IuYWRkUnVsZShtYWtlVGFiSG92ZXJCYWNrZ3JvdW5kUnVsZShhZGp1c3RlZENvbG9yLCBhZGp1c3RlZENvbG9yRHJhZywgdHJ1ZSkpO1xuXHRcdH1cblxuXHRcdC8vIEFkanVzdCBncmFkaWVudCBmb3IgdW5mb2N1c2VkIGhvdmVyIGJhY2tncm91bmRcblx0XHRpZiAodGFiVW5mb2N1c2VkSG92ZXJCYWNrZ3JvdW5kICYmIGFkanVzdGVkVGFiQmFja2dyb3VuZCAmJiBhZGp1c3RlZFRhYkRyYWdCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb25zdCBhZGp1c3RlZENvbG9yID0gdGFiVW5mb2N1c2VkSG92ZXJCYWNrZ3JvdW5kLmZsYXR0ZW4oYWRqdXN0ZWRUYWJCYWNrZ3JvdW5kKTtcblx0XHRcdGNvbnN0IGFkanVzdGVkQ29sb3JEcmFnID0gdGFiVW5mb2N1c2VkSG92ZXJCYWNrZ3JvdW5kLmZsYXR0ZW4oYWRqdXN0ZWRUYWJEcmFnQmFja2dyb3VuZCk7XG5cdFx0XHRjb2xsZWN0b3IuYWRkUnVsZShtYWtlVGFiSG92ZXJCYWNrZ3JvdW5kUnVsZShhZGp1c3RlZENvbG9yLCBhZGp1c3RlZENvbG9yRHJhZykpO1xuXHRcdH1cblxuXHRcdC8vIEFkanVzdCBncmFkaWVudCBmb3IgZHJhZyBhbmQgZHJvcCBiYWNrZ3JvdW5kXG5cdFx0aWYgKGVkaXRvckRyYWdBbmREcm9wQmFja2dyb3VuZCAmJiBhZGp1c3RlZFRhYkRyYWdCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb25zdCBhZGp1c3RlZENvbG9yRHJhZyA9IGVkaXRvckRyYWdBbmREcm9wQmFja2dyb3VuZC5mbGF0dGVuKGFkanVzdGVkVGFiRHJhZ0JhY2tncm91bmQpO1xuXHRcdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudC5kcmFnZ2VkLW92ZXIgLmVkaXRvci1ncm91cC1jb250YWluZXIuYWN0aXZlID4gLnRpdGxlIC50YWJzLWNvbnRhaW5lciA+IC50YWIuc2l6aW5nLXNocmluay5kcmFnZ2VkLW92ZXI6bm90KC5hY3RpdmUpOm5vdCguZHJhZ2dlZCk6bm90KC5zdGlja3ktY29tcGFjdCkgPiAudGFiLWxhYmVsID4gLm1vbmFjby1pY29uLWxhYmVsLWNvbnRhaW5lcjo6YWZ0ZXIsXG5cdFx0XHRcdC5tb25hY28td29ya2JlbmNoIC5wYXJ0LmVkaXRvciA+IC5jb250ZW50LmRyYWdnZWQtb3ZlciAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lcjpub3QoLmFjdGl2ZSkgPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5zaXppbmctc2hyaW5rLmRyYWdnZWQtb3Zlcjpub3QoLmRyYWdnZWQpOm5vdCguc3RpY2t5LWNvbXBhY3QpID4gLnRhYi1sYWJlbCA+IC5tb25hY28taWNvbi1sYWJlbC1jb250YWluZXI6OmFmdGVyLFxuXHRcdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudC5kcmFnZ2VkLW92ZXIgLmVkaXRvci1ncm91cC1jb250YWluZXIuYWN0aXZlID4gLnRpdGxlIC50YWJzLWNvbnRhaW5lciA+IC50YWIuc2l6aW5nLWZpeGVkLmRyYWdnZWQtb3Zlcjpub3QoLmFjdGl2ZSk6bm90KC5kcmFnZ2VkKTpub3QoLnN0aWNreS1jb21wYWN0KSA+IC50YWItbGFiZWwgPiAubW9uYWNvLWljb24tbGFiZWwtY29udGFpbmVyOjphZnRlcixcblx0XHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQuZHJhZ2dlZC1vdmVyIC5lZGl0b3ItZ3JvdXAtY29udGFpbmVyOm5vdCguYWN0aXZlKSA+IC50aXRsZSAudGFicy1jb250YWluZXIgPiAudGFiLnNpemluZy1maXhlZC5kcmFnZ2VkLW92ZXI6bm90KC5kcmFnZ2VkKTpub3QoLnN0aWNreS1jb21wYWN0KSA+IC50YWItbGFiZWwgPiAubW9uYWNvLWljb24tbGFiZWwtY29udGFpbmVyOjphZnRlciB7XG5cdFx0XHRcdFx0YmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KHRvIGxlZnQsICR7YWRqdXN0ZWRDb2xvckRyYWd9LCB0cmFuc3BhcmVudCkgIWltcG9ydGFudDtcblx0XHRcdFx0fVxuXHRcdGApO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1ha2VUYWJCYWNrZ3JvdW5kUnVsZSA9IChjb2xvcjogQ29sb3IsIGNvbG9yRHJhZzogQ29sb3IsIGZvY3VzZWQ6IGJvb2xlYW4sIGFjdGl2ZTogYm9vbGVhbikgPT4gYFxuXHRcdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAucGFydC5lZGl0b3IgPiAuY29udGVudDpub3QoLmRyYWdnZWQtb3ZlcikgLmVkaXRvci1ncm91cC1jb250YWluZXIke2ZvY3VzZWQgPyAnLmFjdGl2ZScgOiAnOm5vdCguYWN0aXZlKSd9ID4gLnRpdGxlIC50YWJzLWNvbnRhaW5lciA+IC50YWIuc2l6aW5nLXNocmluayR7YWN0aXZlID8gJy5hY3RpdmUnIDogJyd9Om5vdCguZHJhZ2dlZCk6bm90KC5zdGlja3ktY29tcGFjdCkgPiAudGFiLWxhYmVsID4gLm1vbmFjby1pY29uLWxhYmVsLWNvbnRhaW5lcjo6YWZ0ZXIsXG5cdFx0XHRcdC5tb25hY28td29ya2JlbmNoIC5wYXJ0LmVkaXRvciA+IC5jb250ZW50Om5vdCguZHJhZ2dlZC1vdmVyKSAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lciR7Zm9jdXNlZCA/ICcuYWN0aXZlJyA6ICc6bm90KC5hY3RpdmUpJ30gPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5zaXppbmctZml4ZWQke2FjdGl2ZSA/ICcuYWN0aXZlJyA6ICcnfTpub3QoLmRyYWdnZWQpOm5vdCguc3RpY2t5LWNvbXBhY3QpID4gLnRhYi1sYWJlbCA+IC5tb25hY28taWNvbi1sYWJlbC1jb250YWluZXI6OmFmdGVyIHtcblx0XHRcdFx0XHRiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQodG8gbGVmdCwgJHtjb2xvcn0sIHRyYW5zcGFyZW50KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC5tb25hY28td29ya2JlbmNoIC5wYXJ0LmVkaXRvciA+IC5jb250ZW50LmRyYWdnZWQtb3ZlciAuZWRpdG9yLWdyb3VwLWNvbnRhaW5lciR7Zm9jdXNlZCA/ICcuYWN0aXZlJyA6ICc6bm90KC5hY3RpdmUpJ30gPiAudGl0bGUgLnRhYnMtY29udGFpbmVyID4gLnRhYi5zaXppbmctc2hyaW5rJHthY3RpdmUgPyAnLmFjdGl2ZScgOiAnJ306bm90KC5kcmFnZ2VkKTpub3QoLnN0aWNreS1jb21wYWN0KSA+IC50YWItbGFiZWwgPiAubW9uYWNvLWljb24tbGFiZWwtY29udGFpbmVyOjphZnRlcixcblx0XHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuZWRpdG9yID4gLmNvbnRlbnQuZHJhZ2dlZC1vdmVyIC5lZGl0b3ItZ3JvdXAtY29udGFpbmVyJHtmb2N1c2VkID8gJy5hY3RpdmUnIDogJzpub3QoLmFjdGl2ZSknfSA+IC50aXRsZSAudGFicy1jb250YWluZXIgPiAudGFiLnNpemluZy1maXhlZCR7YWN0aXZlID8gJy5hY3RpdmUnIDogJyd9Om5vdCguZHJhZ2dlZCk6bm90KC5zdGlja3ktY29tcGFjdCkgPiAudGFiLWxhYmVsID4gLm1vbmFjby1pY29uLWxhYmVsLWNvbnRhaW5lcjo6YWZ0ZXIge1xuXHRcdFx0XHRcdGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCh0byBsZWZ0LCAke2NvbG9yRHJhZ30sIHRyYW5zcGFyZW50KTtcblx0XHRcdFx0fVxuXHRcdGA7XG5cblx0XHQvLyBBZGp1c3QgZ3JhZGllbnQgZm9yIGZvY3VzZWQgYWN0aXZlIHRhYiBiYWNrZ3JvdW5kXG5cdFx0Y29uc3QgdGFiQWN0aXZlQmFja2dyb3VuZCA9IHRoZW1lLmdldENvbG9yKFRBQl9BQ1RJVkVfQkFDS0dST1VORCk7XG5cdFx0aWYgKHRhYkFjdGl2ZUJhY2tncm91bmQgJiYgYWRqdXN0ZWRUYWJCYWNrZ3JvdW5kICYmIGFkanVzdGVkVGFiRHJhZ0JhY2tncm91bmQpIHtcblx0XHRcdGNvbnN0IGFkanVzdGVkQ29sb3IgPSB0YWJBY3RpdmVCYWNrZ3JvdW5kLmZsYXR0ZW4oYWRqdXN0ZWRUYWJCYWNrZ3JvdW5kKTtcblx0XHRcdGNvbnN0IGFkanVzdGVkQ29sb3JEcmFnID0gdGFiQWN0aXZlQmFja2dyb3VuZC5mbGF0dGVuKGFkanVzdGVkVGFiRHJhZ0JhY2tncm91bmQpO1xuXHRcdFx0Y29sbGVjdG9yLmFkZFJ1bGUobWFrZVRhYkJhY2tncm91bmRSdWxlKGFkanVzdGVkQ29sb3IsIGFkanVzdGVkQ29sb3JEcmFnLCB0cnVlLCB0cnVlKSk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRqdXN0IGdyYWRpZW50IGZvciB1bmZvY3VzZWQgYWN0aXZlIHRhYiBiYWNrZ3JvdW5kXG5cdFx0Y29uc3QgdGFiVW5mb2N1c2VkQWN0aXZlQmFja2dyb3VuZCA9IHRoZW1lLmdldENvbG9yKFRBQl9VTkZPQ1VTRURfQUNUSVZFX0JBQ0tHUk9VTkQpO1xuXHRcdGlmICh0YWJVbmZvY3VzZWRBY3RpdmVCYWNrZ3JvdW5kICYmIGFkanVzdGVkVGFiQmFja2dyb3VuZCAmJiBhZGp1c3RlZFRhYkRyYWdCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb25zdCBhZGp1c3RlZENvbG9yID0gdGFiVW5mb2N1c2VkQWN0aXZlQmFja2dyb3VuZC5mbGF0dGVuKGFkanVzdGVkVGFiQmFja2dyb3VuZCk7XG5cdFx0XHRjb25zdCBhZGp1c3RlZENvbG9yRHJhZyA9IHRhYlVuZm9jdXNlZEFjdGl2ZUJhY2tncm91bmQuZmxhdHRlbihhZGp1c3RlZFRhYkRyYWdCYWNrZ3JvdW5kKTtcblx0XHRcdGNvbGxlY3Rvci5hZGRSdWxlKG1ha2VUYWJCYWNrZ3JvdW5kUnVsZShhZGp1c3RlZENvbG9yLCBhZGp1c3RlZENvbG9yRHJhZywgZmFsc2UsIHRydWUpKTtcblx0XHR9XG5cblx0XHQvLyBBZGp1c3QgZ3JhZGllbnQgZm9yIGZvY3VzZWQgaW5hY3RpdmUgdGFiIGJhY2tncm91bmRcblx0XHRjb25zdCB0YWJJbmFjdGl2ZUJhY2tncm91bmQgPSB0aGVtZS5nZXRDb2xvcihUQUJfSU5BQ1RJVkVfQkFDS0dST1VORCk7XG5cdFx0aWYgKHRhYkluYWN0aXZlQmFja2dyb3VuZCAmJiBhZGp1c3RlZFRhYkJhY2tncm91bmQgJiYgYWRqdXN0ZWRUYWJEcmFnQmFja2dyb3VuZCkge1xuXHRcdFx0Y29uc3QgYWRqdXN0ZWRDb2xvciA9IHRhYkluYWN0aXZlQmFja2dyb3VuZC5mbGF0dGVuKGFkanVzdGVkVGFiQmFja2dyb3VuZCk7XG5cdFx0XHRjb25zdCBhZGp1c3RlZENvbG9yRHJhZyA9IHRhYkluYWN0aXZlQmFja2dyb3VuZC5mbGF0dGVuKGFkanVzdGVkVGFiRHJhZ0JhY2tncm91bmQpO1xuXHRcdFx0Y29sbGVjdG9yLmFkZFJ1bGUobWFrZVRhYkJhY2tncm91bmRSdWxlKGFkanVzdGVkQ29sb3IsIGFkanVzdGVkQ29sb3JEcmFnLCB0cnVlLCBmYWxzZSkpO1xuXHRcdH1cblxuXHRcdC8vIEFkanVzdCBncmFkaWVudCBmb3IgdW5mb2N1c2VkIGluYWN0aXZlIHRhYiBiYWNrZ3JvdW5kXG5cdFx0Y29uc3QgdGFiVW5mb2N1c2VkSW5hY3RpdmVCYWNrZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoVEFCX1VORk9DVVNFRF9JTkFDVElWRV9CQUNLR1JPVU5EKTtcblx0XHRpZiAodGFiVW5mb2N1c2VkSW5hY3RpdmVCYWNrZ3JvdW5kICYmIGFkanVzdGVkVGFiQmFja2dyb3VuZCAmJiBhZGp1c3RlZFRhYkRyYWdCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb25zdCBhZGp1c3RlZENvbG9yID0gdGFiVW5mb2N1c2VkSW5hY3RpdmVCYWNrZ3JvdW5kLmZsYXR0ZW4oYWRqdXN0ZWRUYWJCYWNrZ3JvdW5kKTtcblx0XHRcdGNvbnN0IGFkanVzdGVkQ29sb3JEcmFnID0gdGFiVW5mb2N1c2VkSW5hY3RpdmVCYWNrZ3JvdW5kLmZsYXR0ZW4oYWRqdXN0ZWRUYWJEcmFnQmFja2dyb3VuZCk7XG5cdFx0XHRjb2xsZWN0b3IuYWRkUnVsZShtYWtlVGFiQmFja2dyb3VuZFJ1bGUoYWRqdXN0ZWRDb2xvciwgYWRqdXN0ZWRDb2xvckRyYWcsIGZhbHNlLCBmYWxzZSkpO1xuXHRcdH1cblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLFNBQVMsYUFBYSxpQkFBaUI7QUFDaEQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsd0JBQXdCLFdBQStCLGtCQUFrQiw0QkFBNEIseUJBQThDLG9CQUFvQixtQkFBbUIsb0JBQXFDO0FBRXhPLFNBQVMsOEJBQThCO0FB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TUFBTSxTQUFTLHVCQUF1QjtBQUNwRSxRQUFJLHlCQUF5Qix5QkFBeUIsMkJBQTJCO0FBQ2hGLFlBQU0sZ0JBQWdCLHNCQUFzQixRQUFRLHFCQUFxQjtBQUN6RSxZQUFNLG9CQUFvQixzQkFBc0IsUUFBUSx5QkFBeUI7QUFDakYsZ0JBQVUsUUFBUSxzQkFBc0IsZUFBZSxtQkFBbUIsTUFBTSxLQUFLLENBQUM7QUFBQSxJQUN2RjtBQUdBLFVBQU0saUNBQWlDLE1BQU0sU0FBUyxpQ0FBaUM7QUFDdkYsUUFBSSxrQ0FBa0MseUJBQXlCLDJCQUEyQjtBQUN6RixZQUFNLGdCQUFnQiwrQkFBK0IsUUFBUSxxQkFBcUI7QUFDbEYsWUFBTSxvQkFBb0IsK0JBQStCLFFBQVEseUJBQXlCO0FBQzFGLGdCQUFVLFFBQVEsc0JBQXNCLGVBQWUsbUJBQW1CLE9BQU8sS0FBSyxDQUFDO0FBQUEsSUFDeEY7QUFBQSxFQUNEO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFsiZWRpdG9yIiwgImUiLCAiZHVwbGljYXRlTGFiZWxzIl0KfQo=
