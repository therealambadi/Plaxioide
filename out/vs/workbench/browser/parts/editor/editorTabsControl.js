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
import "./media/editortabscontrol.css";
import { localize } from "../../../../nls.js";
import { DataTransfers } from "../../../../base/browser/dnd.js";
import { $, getActiveWindow, getWindow, isMouseEvent } from "../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { ActionsOrientation, prepareActions } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { DraggedEditorGroupIdentifier, fillEditorsDragData, isWindowDraggedOver } from "../../dnd.js";
import { EditorPane } from "./editorPane.js";
import { EditorResourceAccessor, SideBySideEditor, EditorsOrder, EditorInputCapabilities, Verbosity } from "../../../common/editor.js";
import { ResourceContextKey, ActiveEditorPinnedContext, ActiveEditorStickyContext, ActiveEditorGroupLockedContext, ActiveEditorCanSplitInGroupContext, SideBySideEditorActiveContext, ActiveEditorFirstInGroupContext, ActiveEditorAvailableEditorIdsContext, applyAvailableEditorIds, ActiveEditorLastInGroupContext } from "../../../common/contextkeys.js";
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { isFirefox } from "../../../../base/browser/browser.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";
import { IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { EDITOR_CORE_NAVIGATION_COMMANDS } from "./editorCommands.js";
import { MergeGroupMode } from "../../../services/editor/common/editorGroupsService.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { applyDragImage } from "../../../../base/browser/ui/dnd/dnd.js";
class EditorCommandsContextActionRunner extends ActionRunner {
  constructor(context) {
    super();
    this.context = context;
  }
  run(action, context) {
    let mergedContext = this.context;
    if (context?.preserveFocus) {
      mergedContext = {
        ...this.context,
        preserveFocus: true
      };
    }
    return super.run(action, mergedContext);
  }
}
let EditorTabsControl = class extends Themable {
  constructor(parent, editorPartsView, groupsView, groupView, tabsModel, contextMenuService, instantiationService, contextKeyService, keybindingService, notificationService, quickInputService, themeService, editorResolverService, hostService) {
    super(themeService);
    this.parent = parent;
    this.editorPartsView = editorPartsView;
    this.groupsView = groupsView;
    this.groupView = groupView;
    this.tabsModel = tabsModel;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.keybindingService = keybindingService;
    this.notificationService = notificationService;
    this.quickInputService = quickInputService;
    this.editorResolverService = editorResolverService;
    this.hostService = hostService;
    this.editorTransfer = LocalSelectionTransfer.getInstance();
    this.groupTransfer = LocalSelectionTransfer.getInstance();
    this.treeItemsTransfer = LocalSelectionTransfer.getInstance();
    this.editorActionsToolbarDisposables = this._register(new DisposableStore());
    this.editorActionsDisposables = this._register(new DisposableStore());
    this.renderDropdownAsChildElement = false;
    const container = this.create(parent);
    this.contextMenuContextKeyService = this._register(this.contextKeyService.createScoped(container));
    const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, this.contextMenuContextKeyService]
    )));
    this.resourceContext = this._register(scopedInstantiationService.createInstance(ResourceContextKey));
    this.editorPinnedContext = ActiveEditorPinnedContext.bindTo(this.contextMenuContextKeyService);
    this.editorIsFirstContext = ActiveEditorFirstInGroupContext.bindTo(this.contextMenuContextKeyService);
    this.editorIsLastContext = ActiveEditorLastInGroupContext.bindTo(this.contextMenuContextKeyService);
    this.editorStickyContext = ActiveEditorStickyContext.bindTo(this.contextMenuContextKeyService);
    this.editorAvailableEditorIds = ActiveEditorAvailableEditorIdsContext.bindTo(this.contextMenuContextKeyService);
    this.editorCanSplitInGroupContext = ActiveEditorCanSplitInGroupContext.bindTo(this.contextMenuContextKeyService);
    this.sideBySideEditorContext = SideBySideEditorActiveContext.bindTo(this.contextMenuContextKeyService);
    this.groupLockedContext = ActiveEditorGroupLockedContext.bindTo(this.contextMenuContextKeyService);
  }
  create(parent) {
    this.updateTabHeight();
    return parent;
  }
  get editorActionsEnabled() {
    return this.groupsView.partOptions.editorActionsLocation === "default" && this.groupsView.partOptions.showTabs !== "none";
  }
  createEditorActionsToolBar(parent, classes) {
    this.editorActionsToolbarContainer = $("div");
    this.editorActionsToolbarContainer.classList.add(...classes);
    parent.appendChild(this.editorActionsToolbarContainer);
    this.handleEditorActionToolBarVisibility(this.editorActionsToolbarContainer);
  }
  handleEditorActionToolBarVisibility(container) {
    const editorActionsEnabled = this.editorActionsEnabled;
    const editorActionsVisible = !!this.editorActionsToolbar;
    if (editorActionsEnabled && !editorActionsVisible) {
      this.doCreateEditorActionsToolBar(container);
    } else if (!editorActionsEnabled && editorActionsVisible) {
      this.editorActionsToolbar?.getElement().remove();
      this.editorActionsToolbar = void 0;
      this.editorActionsToolbarDisposables.clear();
      this.editorActionsDisposables.clear();
    }
    container.classList.toggle("hidden", !editorActionsEnabled);
  }
  doCreateEditorActionsToolBar(container) {
    const context = { groupId: this.groupView.id };
    this.editorActionsToolbar = this.editorActionsToolbarDisposables.add(this.instantiationService.createInstance(WorkbenchToolBar, container, {
      actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
      orientation: ActionsOrientation.HORIZONTAL,
      ariaLabel: localize("ariaLabelEditorActions", "Editor actions"),
      getKeyBinding: (action) => this.getKeybinding(action),
      actionRunner: this.editorActionsToolbarDisposables.add(new EditorCommandsContextActionRunner(context)),
      anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
      renderDropdownAsChildElement: this.renderDropdownAsChildElement,
      telemetrySource: "editorPart",
      resetMenu: MenuId.EditorTitle,
      overflowBehavior: { maxItems: 9, exempted: EDITOR_CORE_NAVIGATION_COMMANDS },
      highlightToggledItems: true
    }));
    this.editorActionsToolbar.context = context;
    this.editorActionsToolbarDisposables.add(this.editorActionsToolbar.actionRunner.onDidRun((e) => {
      if (e.error && !isCancellationError(e.error)) {
        this.notificationService.error(e.error);
      }
    }));
  }
  actionViewItemProvider(action, options) {
    const activeEditorPane = this.groupView.activeEditorPane;
    if (activeEditorPane instanceof EditorPane) {
      const result = activeEditorPane.getActionViewItem(action, options);
      if (result) {
        return result;
      }
    }
    return createActionViewItem(this.instantiationService, action, { ...options, menuAsChild: this.renderDropdownAsChildElement });
  }
  updateEditorActionsToolbar() {
    if (!this.editorActionsEnabled) {
      return;
    }
    this.editorActionsDisposables.clear();
    const editorActions = this.groupView.createEditorActions(this.editorActionsDisposables);
    this.editorActionsDisposables.add(editorActions.onDidChange(() => this.updateEditorActionsToolbar()));
    const editorActionsToolbar = assertIsDefined(this.editorActionsToolbar);
    const { primary, secondary } = this.prepareEditorActions(editorActions.actions);
    editorActionsToolbar.setActions(prepareActions(primary), prepareActions(secondary));
  }
  getEditorPaneAwareContextKeyService() {
    return this.groupView.activeEditorPane?.scopedContextKeyService ?? this.contextKeyService;
  }
  clearEditorActionsToolbar() {
    if (!this.editorActionsEnabled) {
      return;
    }
    const editorActionsToolbar = assertIsDefined(this.editorActionsToolbar);
    editorActionsToolbar.setActions([], []);
  }
  onGroupDragStart(e, element) {
    if (e.target !== element) {
      return false;
    }
    const isNewWindowOperation = this.isNewWindowOperation(e);
    this.groupTransfer.setData([new DraggedEditorGroupIdentifier(this.groupView.id)], DraggedEditorGroupIdentifier.prototype);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "copyMove";
    }
    let hasDataTransfer = false;
    if (this.groupsView.partOptions.showTabs === "multiple") {
      hasDataTransfer = this.doFillResourceDataTransfers(this.groupView.getEditors(EditorsOrder.SEQUENTIAL), e, isNewWindowOperation);
    } else {
      if (this.groupView.activeEditor) {
        hasDataTransfer = this.doFillResourceDataTransfers([this.groupView.activeEditor], e, isNewWindowOperation);
      }
    }
    if (!hasDataTransfer && isFirefox) {
      e.dataTransfer?.setData(DataTransfers.TEXT, String(this.groupView.label));
    }
    if (this.groupView.activeEditor) {
      let label = this.groupView.activeEditor.getName();
      if (this.groupsView.partOptions.showTabs === "multiple" && this.groupView.count > 1) {
        label = localize("draggedEditorGroup", "{0} (+{1})", label, this.groupView.count - 1);
      }
      applyDragImage(e, element, label);
    }
    return isNewWindowOperation;
  }
  async onGroupDragEnd(e, previousDragEvent, element, isNewWindowOperation) {
    this.groupTransfer.clearData(DraggedEditorGroupIdentifier.prototype);
    if (e.target !== element || !isNewWindowOperation || isWindowDraggedOver()) {
      return;
    }
    const auxiliaryEditorPart = await this.maybeCreateAuxiliaryEditorPartAt(e, element);
    if (!auxiliaryEditorPart) {
      return;
    }
    const targetGroup = auxiliaryEditorPart.activeGroup;
    this.groupsView.mergeGroup(this.groupView, targetGroup.id, {
      mode: this.isMoveOperation(previousDragEvent ?? e, targetGroup.id) ? MergeGroupMode.MOVE_EDITORS : MergeGroupMode.COPY_EDITORS
    });
    targetGroup.focus();
  }
  async maybeCreateAuxiliaryEditorPartAt(e, offsetElement) {
    const { point, display } = await this.hostService.getCursorScreenPoint() ?? { point: { x: e.screenX, y: e.screenY } };
    const window = getActiveWindow();
    if (window.document.visibilityState === "visible" && window.document.hasFocus()) {
      if (point.x >= window.screenX && point.x <= window.screenX + window.outerWidth && point.y >= window.screenY && point.y <= window.screenY + window.outerHeight) {
        return;
      }
    }
    const offsetX = offsetElement.offsetWidth / 2;
    const offsetY = 30 + offsetElement.offsetHeight / 2;
    const bounds = {
      x: point.x - offsetX,
      y: point.y - offsetY
    };
    if (display) {
      if (bounds.x < display.x) {
        bounds.x = display.x;
      }
      if (bounds.y < display.y) {
        bounds.y = display.y;
      }
    }
    return this.editorPartsView.createAuxiliaryEditorPart({ bounds });
  }
  isNewWindowOperation(e) {
    if (this.groupsView.partOptions.dragToOpenWindow) {
      return !e.altKey;
    }
    return e.altKey;
  }
  isMoveOperation(e, sourceGroup, sourceEditor) {
    if (sourceEditor?.hasCapability(EditorInputCapabilities.Singleton)) {
      return true;
    }
    const isCopy = e.ctrlKey && !isMacintosh || e.altKey && isMacintosh;
    return !isCopy || sourceGroup === this.groupView.id;
  }
  doFillResourceDataTransfers(editors, e, disableStandardTransfer) {
    if (editors.length) {
      this.instantiationService.invokeFunction(fillEditorsDragData, editors.map((editor) => ({ editor, groupId: this.groupView.id })), e, { disableStandardTransfer });
      return true;
    }
    return false;
  }
  onTabContextMenu(editor, e, node) {
    this.resourceContext.set(EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY }));
    this.editorPinnedContext.set(this.tabsModel.isPinned(editor));
    this.editorIsFirstContext.set(this.tabsModel.isFirst(editor));
    this.editorIsLastContext.set(this.tabsModel.isLast(editor));
    this.editorStickyContext.set(this.tabsModel.isSticky(editor));
    this.groupLockedContext.set(this.tabsModel.isLocked);
    this.editorCanSplitInGroupContext.set(editor.hasCapability(EditorInputCapabilities.CanSplitInGroup));
    this.sideBySideEditorContext.set(editor.typeId === SideBySideEditorInput.ID);
    applyAvailableEditorIds(this.editorAvailableEditorIds, editor, this.editorResolverService);
    let anchor = node;
    if (isMouseEvent(e)) {
      anchor = new StandardMouseEvent(getWindow(node), e);
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => anchor,
      menuId: MenuId.EditorTitleContext,
      menuActionOptions: { shouldForwardArgs: true, arg: this.resourceContext.get() },
      contextKeyService: this.contextMenuContextKeyService,
      getActionsContext: () => ({ groupId: this.groupView.id, editorIndex: this.groupView.getIndexOfEditor(editor) }),
      getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id, this.contextMenuContextKeyService),
      onHide: () => this.groupsView.activeGroup.focus()
      // restore focus to active group
    });
  }
  getKeybinding(action) {
    return this.keybindingService.lookupKeybinding(action.id, this.getEditorPaneAwareContextKeyService());
  }
  getKeybindingLabel(action) {
    const keybinding = this.getKeybinding(action);
    return keybinding ? keybinding.getLabel() ?? void 0 : void 0;
  }
  get tabHeight() {
    return this.groupsView.partOptions.tabHeight !== "compact" ? EditorTabsControl.EDITOR_TAB_HEIGHT.normal : EditorTabsControl.EDITOR_TAB_HEIGHT.compact;
  }
  getHoverTitle(editor) {
    const title = editor.getTitle(Verbosity.LONG);
    if (!this.tabsModel.isPinned(editor)) {
      return {
        markdown: new MarkdownString("", { supportThemeIcons: true, isTrusted: true }).appendText(title).appendMarkdown(' (_preview_ [$(gear)](command:workbench.action.openSettings?%5B%22workbench.editor.enablePreview%22%5D "Configure Preview Mode"))'),
        markdownNotSupportedFallback: title + " (preview)"
      };
    }
    return title;
  }
  updateTabHeight() {
    this.parent.style.setProperty("--editor-group-tab-height", `${this.tabHeight}px`);
  }
  updateOptions(oldOptions, newOptions) {
    if (oldOptions.tabHeight !== newOptions.tabHeight) {
      this.updateTabHeight();
    }
    if (oldOptions.editorActionsLocation !== newOptions.editorActionsLocation || oldOptions.showTabs !== newOptions.showTabs) {
      if (this.editorActionsToolbarContainer) {
        this.handleEditorActionToolBarVisibility(this.editorActionsToolbarContainer);
        this.updateEditorActionsToolbar();
      }
    }
  }
};
EditorTabsControl.EDITOR_TAB_HEIGHT = {
  normal: 35,
  compact: 22
};
EditorTabsControl = __decorateClass([
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IQuickInputService),
  __decorateParam(11, IThemeService),
  __decorateParam(12, IEditorResolverService),
  __decorateParam(13, IHostService)
], EditorTabsControl);
export {
  EditorCommandsContextActionRunner,
  EditorTabsControl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yVGFic0NvbnRyb2wudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvZWRpdG9ydGFic2NvbnRyb2wuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IERhdGFUcmFuc2ZlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCB7ICQsIERpbWVuc2lvbiwgZ2V0QWN0aXZlV2luZG93LCBnZXRXaW5kb3csIGlzTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgQWN0aW9uc09yaWVudGF0aW9uLCBJQWN0aW9uVmlld0l0ZW0sIHByZXBhcmVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiwgQWN0aW9uUnVubmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBSZXNvbHZlZEtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGNyZWF0ZUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlLCBJQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlLCBUaGVtYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRHJhZ2dlZEVkaXRvckdyb3VwSWRlbnRpZmllciwgRHJhZ2dlZEVkaXRvcklkZW50aWZpZXIsIGZpbGxFZGl0b3JzRHJhZ0RhdGEsIGlzV2luZG93RHJhZ2dlZE92ZXIgfSBmcm9tICcuLi8uLi9kbmQuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4vZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzVmlldywgSUVkaXRvckdyb3VwVmlldywgSUVkaXRvclBhcnRzVmlldywgSUludGVybmFsRWRpdG9yT3Blbk9wdGlvbnMgfSBmcm9tICcuL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29tbWFuZHNDb250ZXh0LCBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBJRWRpdG9yUGFydE9wdGlvbnMsIFNpZGVCeVNpZGVFZGl0b3IsIEVkaXRvcnNPcmRlciwgRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMsIElUb29sYmFyQWN0aW9ucywgR3JvdXBJZGVudGlmaWVyLCBWZXJib3NpdHkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUNvbnRleHRLZXksIEFjdGl2ZUVkaXRvclBpbm5lZENvbnRleHQsIEFjdGl2ZUVkaXRvclN0aWNreUNvbnRleHQsIEFjdGl2ZUVkaXRvckdyb3VwTG9ja2VkQ29udGV4dCwgQWN0aXZlRWRpdG9yQ2FuU3BsaXRJbkdyb3VwQ29udGV4dCwgU2lkZUJ5U2lkZUVkaXRvckFjdGl2ZUNvbnRleHQsIEFjdGl2ZUVkaXRvckZpcnN0SW5Hcm91cENvbnRleHQsIEFjdGl2ZUVkaXRvckF2YWlsYWJsZUVkaXRvcklkc0NvbnRleHQsIGFwcGx5QXZhaWxhYmxlRWRpdG9ySWRzLCBBY3RpdmVFZGl0b3JMYXN0SW5Hcm91cENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgQW5jaG9yQWxpZ25tZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvbnRleHR2aWV3L2NvbnRleHR2aWV3LmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IGlzRmlyZWZveCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoVG9vbEJhciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci90b29sYmFyLmpzJztcbmltcG9ydCB7IExvY2FsU2VsZWN0aW9uVHJhbnNmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgRHJhZ2dlZFRyZWVJdGVtc0lkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RyZWVWaWV3c0RuZC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JSZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclRpdGxlQ29udHJvbERpbWVuc2lvbnMgfSBmcm9tICcuL2VkaXRvclRpdGxlQ29udHJvbC5qcyc7XG5pbXBvcnQgeyBJUmVhZG9ubHlFZGl0b3JHcm91cE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JHcm91cE1vZGVsLmpzJztcbmltcG9ydCB7IEVESVRPUl9DT1JFX05BVklHQVRJT05fQ09NTUFORFMgfSBmcm9tICcuL2VkaXRvckNvbW1hbmRzLmpzJztcbmltcG9ydCB7IElBdXhpbGlhcnlFZGl0b3JQYXJ0LCBNZXJnZUdyb3VwTW9kZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUJhc2VBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElNYW5hZ2VkSG92ZXJUb29sdGlwTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgYXBwbHlEcmFnSW1hZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZG5kL2RuZC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0b3JDb21tYW5kc0NvbnRleHRBY3Rpb25SdW5uZXIgZXh0ZW5kcyBBY3Rpb25SdW5uZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgY29udGV4dDogSUVkaXRvckNvbW1hbmRzQ29udGV4dFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjdGlvbjogSUFjdGlvbiwgY29udGV4dD86IHsgcHJlc2VydmVGb2N1cz86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gRXZlbiB0aG91Z2ggd2UgaGF2ZSBhIGZpeGVkIGNvbnRleHQgZm9yIGVkaXRvciBjb21tYW5kcyxcblx0XHQvLyBhbGxvdyB0byBwcmVzZXJ2ZSB0aGUgY29udGV4dCB0aGF0IGlzIGdpdmVuIHRvIHVzIGluIGNhc2Vcblx0XHQvLyBpdCBhcHBsaWVzLlxuXG5cdFx0bGV0IG1lcmdlZENvbnRleHQgPSB0aGlzLmNvbnRleHQ7XG5cdFx0aWYgKGNvbnRleHQ/LnByZXNlcnZlRm9jdXMpIHtcblx0XHRcdG1lcmdlZENvbnRleHQgPSB7XG5cdFx0XHRcdC4uLnRoaXMuY29udGV4dCxcblx0XHRcdFx0cHJlc2VydmVGb2N1czogdHJ1ZVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VwZXIucnVuKGFjdGlvbiwgbWVyZ2VkQ29udGV4dCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yVGFic0NvbnRyb2wgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cdHVwZGF0ZU9wdGlvbnMob2xkT3B0aW9uczogSUVkaXRvclBhcnRPcHRpb25zLCBuZXdPcHRpb25zOiBJRWRpdG9yUGFydE9wdGlvbnMpOiB2b2lkO1xuXHRvcGVuRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIG9wdGlvbnM/OiBJSW50ZXJuYWxFZGl0b3JPcGVuT3B0aW9ucyk6IGJvb2xlYW47XG5cdG9wZW5FZGl0b3JzKGVkaXRvcnM6IEVkaXRvcklucHV0W10pOiBib29sZWFuO1xuXHRiZWZvcmVDbG9zZUVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZDtcblx0Y2xvc2VFZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQ7XG5cdGNsb3NlRWRpdG9ycyhlZGl0b3JzOiBFZGl0b3JJbnB1dFtdKTogdm9pZDtcblx0bW92ZUVkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0LCBmcm9tSW5kZXg6IG51bWJlciwgdGFyZ2V0SW5kZXg6IG51bWJlciwgc3RpY2t5U3RhdGVDaGFuZ2U6IGJvb2xlYW4pOiB2b2lkO1xuXHRwaW5FZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQ7XG5cdHN0aWNrRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkO1xuXHR1bnN0aWNrRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkO1xuXHRzZXRBY3RpdmUoaXNBY3RpdmU6IGJvb2xlYW4pOiB2b2lkO1xuXHR1cGRhdGVFZGl0b3JTZWxlY3Rpb25zKCk6IHZvaWQ7XG5cdHVwZGF0ZUVkaXRvckxhYmVsKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkO1xuXHR1cGRhdGVFZGl0b3JEaXJ0eShlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZDtcblx0bGF5b3V0KGRpbWVuc2lvbnM6IElFZGl0b3JUaXRsZUNvbnRyb2xEaW1lbnNpb25zKTogRGltZW5zaW9uO1xuXHRnZXRIZWlnaHQoKTogbnVtYmVyO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRWRpdG9yVGFic0NvbnRyb2wgZXh0ZW5kcyBUaGVtYWJsZSBpbXBsZW1lbnRzIElFZGl0b3JUYWJzQ29udHJvbCB7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IGVkaXRvclRyYW5zZmVyID0gTG9jYWxTZWxlY3Rpb25UcmFuc2Zlci5nZXRJbnN0YW5jZTxEcmFnZ2VkRWRpdG9ySWRlbnRpZmllcj4oKTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IGdyb3VwVHJhbnNmZXIgPSBMb2NhbFNlbGVjdGlvblRyYW5zZmVyLmdldEluc3RhbmNlPERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXI+KCk7XG5cdHByb3RlY3RlZCByZWFkb25seSB0cmVlSXRlbXNUcmFuc2ZlciA9IExvY2FsU2VsZWN0aW9uVHJhbnNmZXIuZ2V0SW5zdGFuY2U8RHJhZ2dlZFRyZWVJdGVtc0lkZW50aWZpZXI+KCk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRURJVE9SX1RBQl9IRUlHSFQgPSB7XG5cdFx0bm9ybWFsOiAzNSBhcyBjb25zdCxcblx0XHRjb21wYWN0OiAyMiBhcyBjb25zdFxuXHR9O1xuXG5cdHByb3RlY3RlZCBlZGl0b3JBY3Rpb25zVG9vbGJhckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZWRpdG9yQWN0aW9uc1Rvb2xiYXI6IFdvcmtiZW5jaFRvb2xCYXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yQWN0aW9uc1Rvb2xiYXJEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yQWN0aW9uc0Rpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51Q29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcblx0cHJpdmF0ZSByZXNvdXJjZUNvbnRleHQ6IFJlc291cmNlQ29udGV4dEtleTtcblxuXHRwcml2YXRlIGVkaXRvclBpbm5lZENvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGVkaXRvcklzRmlyc3RDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBlZGl0b3JJc0xhc3RDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBlZGl0b3JTdGlja3lDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBlZGl0b3JBdmFpbGFibGVFZGl0b3JJZHM6IElDb250ZXh0S2V5PHN0cmluZz47XG5cblx0cHJpdmF0ZSBlZGl0b3JDYW5TcGxpdEluR3JvdXBDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBzaWRlQnlTaWRlRWRpdG9yQ29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBncm91cExvY2tlZENvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVuZGVyRHJvcGRvd25Bc0NoaWxkRWxlbWVudDogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgcGFyZW50OiBIVE1MRWxlbWVudCxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZWRpdG9yUGFydHNWaWV3OiBJRWRpdG9yUGFydHNWaWV3LFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBncm91cHNWaWV3OiBJRWRpdG9yR3JvdXBzVmlldyxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZ3JvdXBWaWV3OiBJRWRpdG9yR3JvdXBWaWV3LFxuXHRcdHByb3RlY3RlZCByZWFkb25seSB0YWJzTW9kZWw6IElSZWFkb25seUVkaXRvckdyb3VwTW9kZWwsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcm90ZWN0ZWQgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JSZXNvbHZlclNlcnZpY2U6IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHRoZW1lU2VydmljZSk7XG5cblx0XHR0aGlzLnJlbmRlckRyb3Bkb3duQXNDaGlsZEVsZW1lbnQgPSBmYWxzZTtcblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY3JlYXRlKHBhcmVudCk7XG5cblx0XHQvLyBDb250ZXh0IEtleXNcblx0XHR0aGlzLmNvbnRleHRNZW51Q29udGV4dEtleVNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChjb250YWluZXIpKTtcblx0XHRjb25zdCBzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lDb250ZXh0S2V5U2VydmljZSwgdGhpcy5jb250ZXh0TWVudUNvbnRleHRLZXlTZXJ2aWNlXSxcblx0XHQpKSk7XG5cblx0XHR0aGlzLnJlc291cmNlQ29udGV4dCA9IHRoaXMuX3JlZ2lzdGVyKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlQ29udGV4dEtleSkpO1xuXG5cdFx0dGhpcy5lZGl0b3JQaW5uZWRDb250ZXh0ID0gQWN0aXZlRWRpdG9yUGlubmVkQ29udGV4dC5iaW5kVG8odGhpcy5jb250ZXh0TWVudUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmVkaXRvcklzRmlyc3RDb250ZXh0ID0gQWN0aXZlRWRpdG9yRmlyc3RJbkdyb3VwQ29udGV4dC5iaW5kVG8odGhpcy5jb250ZXh0TWVudUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmVkaXRvcklzTGFzdENvbnRleHQgPSBBY3RpdmVFZGl0b3JMYXN0SW5Hcm91cENvbnRleHQuYmluZFRvKHRoaXMuY29udGV4dE1lbnVDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5lZGl0b3JTdGlja3lDb250ZXh0ID0gQWN0aXZlRWRpdG9yU3RpY2t5Q29udGV4dC5iaW5kVG8odGhpcy5jb250ZXh0TWVudUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmVkaXRvckF2YWlsYWJsZUVkaXRvcklkcyA9IEFjdGl2ZUVkaXRvckF2YWlsYWJsZUVkaXRvcklkc0NvbnRleHQuYmluZFRvKHRoaXMuY29udGV4dE1lbnVDb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLmVkaXRvckNhblNwbGl0SW5Hcm91cENvbnRleHQgPSBBY3RpdmVFZGl0b3JDYW5TcGxpdEluR3JvdXBDb250ZXh0LmJpbmRUbyh0aGlzLmNvbnRleHRNZW51Q29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc2lkZUJ5U2lkZUVkaXRvckNvbnRleHQgPSBTaWRlQnlTaWRlRWRpdG9yQWN0aXZlQ29udGV4dC5iaW5kVG8odGhpcy5jb250ZXh0TWVudUNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuZ3JvdXBMb2NrZWRDb250ZXh0ID0gQWN0aXZlRWRpdG9yR3JvdXBMb2NrZWRDb250ZXh0LmJpbmRUbyh0aGlzLmNvbnRleHRNZW51Q29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXHRcdHRoaXMudXBkYXRlVGFiSGVpZ2h0KCk7XG5cdFx0cmV0dXJuIHBhcmVudDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGVkaXRvckFjdGlvbnNFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnMuZWRpdG9yQWN0aW9uc0xvY2F0aW9uID09PSAnZGVmYXVsdCcgJiYgdGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLnNob3dUYWJzICE9PSAnbm9uZSc7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlRWRpdG9yQWN0aW9uc1Rvb2xCYXIocGFyZW50OiBIVE1MRWxlbWVudCwgY2xhc3Nlczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvckFjdGlvbnNUb29sYmFyQ29udGFpbmVyID0gJCgnZGl2Jyk7XG5cdFx0dGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhckNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKC4uLmNsYXNzZXMpO1xuXHRcdHBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLmVkaXRvckFjdGlvbnNUb29sYmFyQ29udGFpbmVyKTtcblxuXHRcdHRoaXMuaGFuZGxlRWRpdG9yQWN0aW9uVG9vbEJhclZpc2liaWxpdHkodGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhckNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUVkaXRvckFjdGlvblRvb2xCYXJWaXNpYmlsaXR5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JBY3Rpb25zRW5hYmxlZCA9IHRoaXMuZWRpdG9yQWN0aW9uc0VuYWJsZWQ7XG5cdFx0Y29uc3QgZWRpdG9yQWN0aW9uc1Zpc2libGUgPSAhIXRoaXMuZWRpdG9yQWN0aW9uc1Rvb2xiYXI7XG5cblx0XHQvLyBDcmVhdGUgdG9vbGJhciBpZiBpdCBpcyBlbmFibGVkIChhbmQgbm90IHlldCBjcmVhdGVkKVxuXHRcdGlmIChlZGl0b3JBY3Rpb25zRW5hYmxlZCAmJiAhZWRpdG9yQWN0aW9uc1Zpc2libGUpIHtcblx0XHRcdHRoaXMuZG9DcmVhdGVFZGl0b3JBY3Rpb25zVG9vbEJhcihjb250YWluZXIpO1xuXHRcdH1cblx0XHQvLyBSZW1vdmUgdG9vbGJhciBpZiBpdCBpcyBub3QgZW5hYmxlZCAoYW5kIGlzIHZpc2libGUpXG5cdFx0ZWxzZSBpZiAoIWVkaXRvckFjdGlvbnNFbmFibGVkICYmIGVkaXRvckFjdGlvbnNWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLmVkaXRvckFjdGlvbnNUb29sYmFyPy5nZXRFbGVtZW50KCkucmVtb3ZlKCk7XG5cdFx0XHR0aGlzLmVkaXRvckFjdGlvbnNUb29sYmFyID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhckRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLmVkaXRvckFjdGlvbnNEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdH1cblxuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAhZWRpdG9yQWN0aW9uc0VuYWJsZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0NyZWF0ZUVkaXRvckFjdGlvbnNUb29sQmFyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCBjb250ZXh0OiBJRWRpdG9yQ29tbWFuZHNDb250ZXh0ID0geyBncm91cElkOiB0aGlzLmdyb3VwVmlldy5pZCB9O1xuXG5cdFx0Ly8gVG9vbGJhciBXaWRnZXRcblx0XHR0aGlzLmVkaXRvckFjdGlvbnNUb29sYmFyID0gdGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhckRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaFRvb2xCYXIsIGNvbnRhaW5lciwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4gdGhpcy5hY3Rpb25WaWV3SXRlbVByb3ZpZGVyKGFjdGlvbiwgb3B0aW9ucyksXG5cdFx0XHRvcmllbnRhdGlvbjogQWN0aW9uc09yaWVudGF0aW9uLkhPUklaT05UQUwsXG5cdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdhcmlhTGFiZWxFZGl0b3JBY3Rpb25zJywgXCJFZGl0b3IgYWN0aW9uc1wiKSxcblx0XHRcdGdldEtleUJpbmRpbmc6IGFjdGlvbiA9PiB0aGlzLmdldEtleWJpbmRpbmcoYWN0aW9uKSxcblx0XHRcdGFjdGlvblJ1bm5lcjogdGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhckRpc3Bvc2FibGVzLmFkZChuZXcgRWRpdG9yQ29tbWFuZHNDb250ZXh0QWN0aW9uUnVubmVyKGNvbnRleHQpKSxcblx0XHRcdGFuY2hvckFsaWdubWVudFByb3ZpZGVyOiAoKSA9PiBBbmNob3JBbGlnbm1lbnQuUklHSFQsXG5cdFx0XHRyZW5kZXJEcm9wZG93bkFzQ2hpbGRFbGVtZW50OiB0aGlzLnJlbmRlckRyb3Bkb3duQXNDaGlsZEVsZW1lbnQsXG5cdFx0XHR0ZWxlbWV0cnlTb3VyY2U6ICdlZGl0b3JQYXJ0Jyxcblx0XHRcdHJlc2V0TWVudTogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0b3ZlcmZsb3dCZWhhdmlvcjogeyBtYXhJdGVtczogOSwgZXhlbXB0ZWQ6IEVESVRPUl9DT1JFX05BVklHQVRJT05fQ09NTUFORFMgfSxcblx0XHRcdGhpZ2hsaWdodFRvZ2dsZWRJdGVtczogdHJ1ZVxuXHRcdH0pKTtcblxuXHRcdC8vIENvbnRleHRcblx0XHR0aGlzLmVkaXRvckFjdGlvbnNUb29sYmFyLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdFx0Ly8gQWN0aW9uIFJ1biBIYW5kbGluZ1xuXHRcdHRoaXMuZWRpdG9yQWN0aW9uc1Rvb2xiYXJEaXNwb3NhYmxlcy5hZGQodGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhci5hY3Rpb25SdW5uZXIub25EaWRSdW4oZSA9PiB7XG5cblx0XHRcdC8vIE5vdGlmeSBmb3IgRXJyb3Jcblx0XHRcdGlmIChlLmVycm9yICYmICFpc0NhbmNlbGxhdGlvbkVycm9yKGUuZXJyb3IpKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlLmVycm9yKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFjdGlvblZpZXdJdGVtUHJvdmlkZXIoYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zOiBJQmFzZUFjdGlvblZpZXdJdGVtT3B0aW9ucyk6IElBY3Rpb25WaWV3SXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IHRoaXMuZ3JvdXBWaWV3LmFjdGl2ZUVkaXRvclBhbmU7XG5cblx0XHQvLyBDaGVjayBBY3RpdmUgRWRpdG9yXG5cdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBFZGl0b3JQYW5lKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhY3RpdmVFZGl0b3JQYW5lLmdldEFjdGlvblZpZXdJdGVtKGFjdGlvbiwgb3B0aW9ucyk7XG5cblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDaGVjayBleHRlbnNpb25zXG5cdFx0cmV0dXJuIGNyZWF0ZUFjdGlvblZpZXdJdGVtKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBtZW51QXNDaGlsZDogdGhpcy5yZW5kZXJEcm9wZG93bkFzQ2hpbGRFbGVtZW50IH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZUVkaXRvckFjdGlvbnNUb29sYmFyKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5lZGl0b3JBY3Rpb25zRW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZWRpdG9yQWN0aW9uc0Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRjb25zdCBlZGl0b3JBY3Rpb25zID0gdGhpcy5ncm91cFZpZXcuY3JlYXRlRWRpdG9yQWN0aW9ucyh0aGlzLmVkaXRvckFjdGlvbnNEaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy5lZGl0b3JBY3Rpb25zRGlzcG9zYWJsZXMuYWRkKGVkaXRvckFjdGlvbnMub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy51cGRhdGVFZGl0b3JBY3Rpb25zVG9vbGJhcigpKSk7XG5cblx0XHRjb25zdCBlZGl0b3JBY3Rpb25zVG9vbGJhciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmVkaXRvckFjdGlvbnNUb29sYmFyKTtcblx0XHRjb25zdCB7IHByaW1hcnksIHNlY29uZGFyeSB9ID0gdGhpcy5wcmVwYXJlRWRpdG9yQWN0aW9ucyhlZGl0b3JBY3Rpb25zLmFjdGlvbnMpO1xuXHRcdGVkaXRvckFjdGlvbnNUb29sYmFyLnNldEFjdGlvbnMocHJlcGFyZUFjdGlvbnMocHJpbWFyeSksIHByZXBhcmVBY3Rpb25zKHNlY29uZGFyeSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IHByZXBhcmVFZGl0b3JBY3Rpb25zKGVkaXRvckFjdGlvbnM6IElUb29sYmFyQWN0aW9ucyk6IElUb29sYmFyQWN0aW9ucztcblx0cHJpdmF0ZSBnZXRFZGl0b3JQYW5lQXdhcmVDb250ZXh0S2V5U2VydmljZSgpOiBJQ29udGV4dEtleVNlcnZpY2Uge1xuXHRcdHJldHVybiB0aGlzLmdyb3VwVmlldy5hY3RpdmVFZGl0b3JQYW5lPy5zY29wZWRDb250ZXh0S2V5U2VydmljZSA/PyB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNsZWFyRWRpdG9yQWN0aW9uc1Rvb2xiYXIoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvckFjdGlvbnNFbmFibGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdG9yQWN0aW9uc1Rvb2xiYXIgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhcik7XG5cdFx0ZWRpdG9yQWN0aW9uc1Rvb2xiYXIuc2V0QWN0aW9ucyhbXSwgW10pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uR3JvdXBEcmFnU3RhcnQoZTogRHJhZ0V2ZW50LCBlbGVtZW50OiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdGlmIChlLnRhcmdldCAhPT0gZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBvbmx5IGlmIG9yaWdpbmF0aW5nIGZyb20gdGFicyBjb250YWluZXJcblx0XHR9XG5cblx0XHRjb25zdCBpc05ld1dpbmRvd09wZXJhdGlvbiA9IHRoaXMuaXNOZXdXaW5kb3dPcGVyYXRpb24oZSk7XG5cblx0XHQvLyBTZXQgZWRpdG9yIGdyb3VwIGFzIHRyYW5zZmVyXG5cdFx0dGhpcy5ncm91cFRyYW5zZmVyLnNldERhdGEoW25ldyBEcmFnZ2VkRWRpdG9yR3JvdXBJZGVudGlmaWVyKHRoaXMuZ3JvdXBWaWV3LmlkKV0sIERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXIucHJvdG90eXBlKTtcblx0XHRpZiAoZS5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdGUuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSAnY29weU1vdmUnO1xuXHRcdH1cblxuXHRcdC8vIERyYWcgYWxsIHRhYnMgb2YgdGhlIGdyb3VwIGlmIHRhYnMgYXJlIGVuYWJsZWRcblx0XHRsZXQgaGFzRGF0YVRyYW5zZmVyID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuZ3JvdXBzVmlldy5wYXJ0T3B0aW9ucy5zaG93VGFicyA9PT0gJ211bHRpcGxlJykge1xuXHRcdFx0aGFzRGF0YVRyYW5zZmVyID0gdGhpcy5kb0ZpbGxSZXNvdXJjZURhdGFUcmFuc2ZlcnModGhpcy5ncm91cFZpZXcuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCksIGUsIGlzTmV3V2luZG93T3BlcmF0aW9uKTtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2Ugb25seSBkcmFnIHRoZSBhY3RpdmUgZWRpdG9yXG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAodGhpcy5ncm91cFZpZXcuYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdGhhc0RhdGFUcmFuc2ZlciA9IHRoaXMuZG9GaWxsUmVzb3VyY2VEYXRhVHJhbnNmZXJzKFt0aGlzLmdyb3VwVmlldy5hY3RpdmVFZGl0b3JdLCBlLCBpc05ld1dpbmRvd09wZXJhdGlvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRmlyZWZveDogcmVxdWlyZXMgdG8gc2V0IGEgdGV4dCBkYXRhIHRyYW5zZmVyIHRvIGdldCBnb2luZ1xuXHRcdGlmICghaGFzRGF0YVRyYW5zZmVyICYmIGlzRmlyZWZveCkge1xuXHRcdFx0ZS5kYXRhVHJhbnNmZXI/LnNldERhdGEoRGF0YVRyYW5zZmVycy5URVhULCBTdHJpbmcodGhpcy5ncm91cFZpZXcubGFiZWwpKTtcblx0XHR9XG5cblx0XHQvLyBEcmFnIEltYWdlXG5cdFx0aWYgKHRoaXMuZ3JvdXBWaWV3LmFjdGl2ZUVkaXRvcikge1xuXHRcdFx0bGV0IGxhYmVsID0gdGhpcy5ncm91cFZpZXcuYWN0aXZlRWRpdG9yLmdldE5hbWUoKTtcblx0XHRcdGlmICh0aGlzLmdyb3Vwc1ZpZXcucGFydE9wdGlvbnMuc2hvd1RhYnMgPT09ICdtdWx0aXBsZScgJiYgdGhpcy5ncm91cFZpZXcuY291bnQgPiAxKSB7XG5cdFx0XHRcdGxhYmVsID0gbG9jYWxpemUoJ2RyYWdnZWRFZGl0b3JHcm91cCcsIFwiezB9ICgrezF9KVwiLCBsYWJlbCwgdGhpcy5ncm91cFZpZXcuY291bnQgLSAxKTtcblx0XHRcdH1cblxuXHRcdFx0YXBwbHlEcmFnSW1hZ2UoZSwgZWxlbWVudCwgbGFiZWwpO1xuXHRcdH1cblxuXHRcdHJldHVybiBpc05ld1dpbmRvd09wZXJhdGlvbjtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBvbkdyb3VwRHJhZ0VuZChlOiBEcmFnRXZlbnQsIHByZXZpb3VzRHJhZ0V2ZW50OiBEcmFnRXZlbnQgfCB1bmRlZmluZWQsIGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBpc05ld1dpbmRvd09wZXJhdGlvbjogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuZ3JvdXBUcmFuc2Zlci5jbGVhckRhdGEoRHJhZ2dlZEVkaXRvckdyb3VwSWRlbnRpZmllci5wcm90b3R5cGUpO1xuXG5cdFx0aWYgKFxuXHRcdFx0ZS50YXJnZXQgIT09IGVsZW1lbnQgfHxcblx0XHRcdCFpc05ld1dpbmRvd09wZXJhdGlvbiB8fFxuXHRcdFx0aXNXaW5kb3dEcmFnZ2VkT3ZlcigpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47IC8vIGRyYWcgdG8gb3BlbiBpbiBuZXcgd2luZG93IGlzIGRpc2FibGVkXG5cdFx0fVxuXG5cdFx0Y29uc3QgYXV4aWxpYXJ5RWRpdG9yUGFydCA9IGF3YWl0IHRoaXMubWF5YmVDcmVhdGVBdXhpbGlhcnlFZGl0b3JQYXJ0QXQoZSwgZWxlbWVudCk7XG5cdFx0aWYgKCFhdXhpbGlhcnlFZGl0b3JQYXJ0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFyZ2V0R3JvdXAgPSBhdXhpbGlhcnlFZGl0b3JQYXJ0LmFjdGl2ZUdyb3VwO1xuXHRcdHRoaXMuZ3JvdXBzVmlldy5tZXJnZUdyb3VwKHRoaXMuZ3JvdXBWaWV3LCB0YXJnZXRHcm91cC5pZCwge1xuXHRcdFx0bW9kZTogdGhpcy5pc01vdmVPcGVyYXRpb24ocHJldmlvdXNEcmFnRXZlbnQgPz8gZSwgdGFyZ2V0R3JvdXAuaWQpID8gTWVyZ2VHcm91cE1vZGUuTU9WRV9FRElUT1JTIDogTWVyZ2VHcm91cE1vZGUuQ09QWV9FRElUT1JTXG5cdFx0fSk7XG5cblx0XHR0YXJnZXRHcm91cC5mb2N1cygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIG1heWJlQ3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydEF0KGU6IERyYWdFdmVudCwgb2Zmc2V0RWxlbWVudDogSFRNTEVsZW1lbnQpOiBQcm9taXNlPElBdXhpbGlhcnlFZGl0b3JQYXJ0IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgeyBwb2ludCwgZGlzcGxheSB9ID0gYXdhaXQgdGhpcy5ob3N0U2VydmljZS5nZXRDdXJzb3JTY3JlZW5Qb2ludCgpID8/IHsgcG9pbnQ6IHsgeDogZS5zY3JlZW5YLCB5OiBlLnNjcmVlblkgfSB9O1xuXHRcdGNvbnN0IHdpbmRvdyA9IGdldEFjdGl2ZVdpbmRvdygpO1xuXHRcdGlmICh3aW5kb3cuZG9jdW1lbnQudmlzaWJpbGl0eVN0YXRlID09PSAndmlzaWJsZScgJiYgd2luZG93LmRvY3VtZW50Lmhhc0ZvY3VzKCkpIHtcblx0XHRcdGlmIChwb2ludC54ID49IHdpbmRvdy5zY3JlZW5YICYmIHBvaW50LnggPD0gd2luZG93LnNjcmVlblggKyB3aW5kb3cub3V0ZXJXaWR0aCAmJiBwb2ludC55ID49IHdpbmRvdy5zY3JlZW5ZICYmIHBvaW50LnkgPD0gd2luZG93LnNjcmVlblkgKyB3aW5kb3cub3V0ZXJIZWlnaHQpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyByZWZ1c2UgdG8gY3JlYXRlIGFzIGxvbmcgYXMgdGhlIG1vdXNlIHdhcyByZWxlYXNlZCBvdmVyIGFjdGl2ZSBmb2N1c2VkIHdpbmRvdyB0byByZWR1Y2UgY2hhbmNlIG9mIG9wZW5pbmcgYnkgYWNjaWRlbnRcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBvZmZzZXRYID0gb2Zmc2V0RWxlbWVudC5vZmZzZXRXaWR0aCAvIDI7XG5cdFx0Y29uc3Qgb2Zmc2V0WSA9IDMwLyogdGFrZSB0aXRsZSBiYXIgaGVpZ2h0IGludG8gYWNjb3VudCAoYXBwcm94aW1hdGlvbikgKi8gKyBvZmZzZXRFbGVtZW50Lm9mZnNldEhlaWdodCAvIDI7XG5cblx0XHRjb25zdCBib3VuZHMgPSB7XG5cdFx0XHR4OiBwb2ludC54IC0gb2Zmc2V0WCxcblx0XHRcdHk6IHBvaW50LnkgLSBvZmZzZXRZXG5cdFx0fTtcblxuXHRcdGlmIChkaXNwbGF5KSB7XG5cdFx0XHRpZiAoYm91bmRzLnggPCBkaXNwbGF5LngpIHtcblx0XHRcdFx0Ym91bmRzLnggPSBkaXNwbGF5Lng7IC8vIHByZXZlbnQgb3ZlcmZsb3cgdG8gdGhlIGxlZnRcblx0XHRcdH1cblxuXHRcdFx0aWYgKGJvdW5kcy55IDwgZGlzcGxheS55KSB7XG5cdFx0XHRcdGJvdW5kcy55ID0gZGlzcGxheS55OyAvLyBwcmV2ZW50IG92ZXJmbG93IHRvIHRoZSB0b3Bcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JQYXJ0c1ZpZXcuY3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydCh7IGJvdW5kcyB9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBpc05ld1dpbmRvd09wZXJhdGlvbihlOiBEcmFnRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5ncm91cHNWaWV3LnBhcnRPcHRpb25zLmRyYWdUb09wZW5XaW5kb3cpIHtcblx0XHRcdHJldHVybiAhZS5hbHRLZXk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGUuYWx0S2V5O1xuXHR9XG5cblx0cHJvdGVjdGVkIGlzTW92ZU9wZXJhdGlvbihlOiBEcmFnRXZlbnQsIHNvdXJjZUdyb3VwOiBHcm91cElkZW50aWZpZXIsIHNvdXJjZUVkaXRvcj86IEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0aWYgKHNvdXJjZUVkaXRvcj8uaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5TaW5nbGV0b24pKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gU2luZ2xldG9uIGVkaXRvcnMgY2Fubm90IGJlIHNwbGl0XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNDb3B5ID0gKGUuY3RybEtleSAmJiAhaXNNYWNpbnRvc2gpIHx8IChlLmFsdEtleSAmJiBpc01hY2ludG9zaCk7XG5cblx0XHRyZXR1cm4gKCFpc0NvcHkgfHwgc291cmNlR3JvdXAgPT09IHRoaXMuZ3JvdXBWaWV3LmlkKTtcblx0fVxuXG5cdHByb3RlY3RlZCBkb0ZpbGxSZXNvdXJjZURhdGFUcmFuc2ZlcnMoZWRpdG9yczogcmVhZG9ubHkgRWRpdG9ySW5wdXRbXSwgZTogRHJhZ0V2ZW50LCBkaXNhYmxlU3RhbmRhcmRUcmFuc2ZlcjogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGlmIChlZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihmaWxsRWRpdG9yc0RyYWdEYXRhLCBlZGl0b3JzLm1hcChlZGl0b3IgPT4gKHsgZWRpdG9yLCBncm91cElkOiB0aGlzLmdyb3VwVmlldy5pZCB9KSksIGUsIHsgZGlzYWJsZVN0YW5kYXJkVHJhbnNmZXIgfSk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByb3RlY3RlZCBvblRhYkNvbnRleHRNZW51KGVkaXRvcjogRWRpdG9ySW5wdXQsIGU6IEV2ZW50LCBub2RlOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXG5cdFx0Ly8gVXBkYXRlIGNvbnRleHRzIGJhc2VkIG9uIGVkaXRvciBwaWNrZWQgYW5kIHJlbWVtYmVyIHByZXZpb3VzIHRvIHJlc3RvcmVcblx0XHR0aGlzLnJlc291cmNlQ29udGV4dC5zZXQoRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSB9KSk7XG5cdFx0dGhpcy5lZGl0b3JQaW5uZWRDb250ZXh0LnNldCh0aGlzLnRhYnNNb2RlbC5pc1Bpbm5lZChlZGl0b3IpKTtcblx0XHR0aGlzLmVkaXRvcklzRmlyc3RDb250ZXh0LnNldCh0aGlzLnRhYnNNb2RlbC5pc0ZpcnN0KGVkaXRvcikpO1xuXHRcdHRoaXMuZWRpdG9ySXNMYXN0Q29udGV4dC5zZXQodGhpcy50YWJzTW9kZWwuaXNMYXN0KGVkaXRvcikpO1xuXHRcdHRoaXMuZWRpdG9yU3RpY2t5Q29udGV4dC5zZXQodGhpcy50YWJzTW9kZWwuaXNTdGlja3koZWRpdG9yKSk7XG5cdFx0dGhpcy5ncm91cExvY2tlZENvbnRleHQuc2V0KHRoaXMudGFic01vZGVsLmlzTG9ja2VkKTtcblx0XHR0aGlzLmVkaXRvckNhblNwbGl0SW5Hcm91cENvbnRleHQuc2V0KGVkaXRvci5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLkNhblNwbGl0SW5Hcm91cCkpO1xuXHRcdHRoaXMuc2lkZUJ5U2lkZUVkaXRvckNvbnRleHQuc2V0KGVkaXRvci50eXBlSWQgPT09IFNpZGVCeVNpZGVFZGl0b3JJbnB1dC5JRCk7XG5cdFx0YXBwbHlBdmFpbGFibGVFZGl0b3JJZHModGhpcy5lZGl0b3JBdmFpbGFibGVFZGl0b3JJZHMsIGVkaXRvciwgdGhpcy5lZGl0b3JSZXNvbHZlclNlcnZpY2UpO1xuXG5cdFx0Ly8gRmluZCB0YXJnZXQgYW5jaG9yXG5cdFx0bGV0IGFuY2hvcjogSFRNTEVsZW1lbnQgfCBTdGFuZGFyZE1vdXNlRXZlbnQgPSBub2RlO1xuXHRcdGlmIChpc01vdXNlRXZlbnQoZSkpIHtcblx0XHRcdGFuY2hvciA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KG5vZGUpLCBlKTtcblx0XHR9XG5cblx0XHQvLyBTaG93IGl0XG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gYW5jaG9yLFxuXHRcdFx0bWVudUlkOiBNZW51SWQuRWRpdG9yVGl0bGVDb250ZXh0LFxuXHRcdFx0bWVudUFjdGlvbk9wdGlvbnM6IHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUsIGFyZzogdGhpcy5yZXNvdXJjZUNvbnRleHQuZ2V0KCkgfSxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiB0aGlzLmNvbnRleHRNZW51Q29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gKHsgZ3JvdXBJZDogdGhpcy5ncm91cFZpZXcuaWQsIGVkaXRvckluZGV4OiB0aGlzLmdyb3VwVmlldy5nZXRJbmRleE9mRWRpdG9yKGVkaXRvcikgfSksXG5cdFx0XHRnZXRLZXlCaW5kaW5nOiBhY3Rpb24gPT4gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5pZCwgdGhpcy5jb250ZXh0TWVudUNvbnRleHRLZXlTZXJ2aWNlKSxcblx0XHRcdG9uSGlkZTogKCkgPT4gdGhpcy5ncm91cHNWaWV3LmFjdGl2ZUdyb3VwLmZvY3VzKCkgLy8gcmVzdG9yZSBmb2N1cyB0byBhY3RpdmUgZ3JvdXBcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRLZXliaW5kaW5nKGFjdGlvbjogSUFjdGlvbik6IFJlc29sdmVkS2V5YmluZGluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uaWQsIHRoaXMuZ2V0RWRpdG9yUGFuZUF3YXJlQ29udGV4dEtleVNlcnZpY2UoKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0S2V5YmluZGluZ0xhYmVsKGFjdGlvbjogSUFjdGlvbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMuZ2V0S2V5YmluZGluZyhhY3Rpb24pO1xuXG5cdFx0cmV0dXJuIGtleWJpbmRpbmcgPyBrZXliaW5kaW5nLmdldExhYmVsKCkgPz8gdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldCB0YWJIZWlnaHQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ3JvdXBzVmlldy5wYXJ0T3B0aW9ucy50YWJIZWlnaHQgIT09ICdjb21wYWN0JyA/IEVkaXRvclRhYnNDb250cm9sLkVESVRPUl9UQUJfSEVJR0hULm5vcm1hbCA6IEVkaXRvclRhYnNDb250cm9sLkVESVRPUl9UQUJfSEVJR0hULmNvbXBhY3Q7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0SG92ZXJUaXRsZShlZGl0b3I6IEVkaXRvcklucHV0KTogc3RyaW5nIHwgSU1hbmFnZWRIb3ZlclRvb2x0aXBNYXJrZG93blN0cmluZyB7XG5cdFx0Y29uc3QgdGl0bGUgPSBlZGl0b3IuZ2V0VGl0bGUoVmVyYm9zaXR5LkxPTkcpO1xuXHRcdGlmICghdGhpcy50YWJzTW9kZWwuaXNQaW5uZWQoZWRpdG9yKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bWFya2Rvd246IG5ldyBNYXJrZG93blN0cmluZygnJywgeyBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSwgaXNUcnVzdGVkOiB0cnVlIH0pLlxuXHRcdFx0XHRcdGFwcGVuZFRleHQodGl0bGUpLlxuXHRcdFx0XHRcdGFwcGVuZE1hcmtkb3duKCcgKF9wcmV2aWV3XyBbJChnZWFyKV0oY29tbWFuZDp3b3JrYmVuY2guYWN0aW9uLm9wZW5TZXR0aW5ncz8lNUIlMjJ3b3JrYmVuY2guZWRpdG9yLmVuYWJsZVByZXZpZXclMjIlNUQgXCJDb25maWd1cmUgUHJldmlldyBNb2RlXCIpKScpLFxuXHRcdFx0XHRtYXJrZG93bk5vdFN1cHBvcnRlZEZhbGxiYWNrOiB0aXRsZSArICcgKHByZXZpZXcpJ1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIHRpdGxlO1xuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZVRhYkhlaWdodCgpOiB2b2lkIHtcblx0XHR0aGlzLnBhcmVudC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1lZGl0b3ItZ3JvdXAtdGFiLWhlaWdodCcsIGAke3RoaXMudGFiSGVpZ2h0fXB4YCk7XG5cdH1cblxuXHR1cGRhdGVPcHRpb25zKG9sZE9wdGlvbnM6IElFZGl0b3JQYXJ0T3B0aW9ucywgbmV3T3B0aW9uczogSUVkaXRvclBhcnRPcHRpb25zKTogdm9pZCB7XG5cblx0XHQvLyBVcGRhdGUgdGFiIGhlaWdodFxuXHRcdGlmIChvbGRPcHRpb25zLnRhYkhlaWdodCAhPT0gbmV3T3B0aW9ucy50YWJIZWlnaHQpIHtcblx0XHRcdHRoaXMudXBkYXRlVGFiSGVpZ2h0KCk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIEVkaXRvciBBY3Rpb25zIFRvb2xiYXJcblx0XHRpZiAoXG5cdFx0XHRvbGRPcHRpb25zLmVkaXRvckFjdGlvbnNMb2NhdGlvbiAhPT0gbmV3T3B0aW9ucy5lZGl0b3JBY3Rpb25zTG9jYXRpb24gfHxcblx0XHRcdG9sZE9wdGlvbnMuc2hvd1RhYnMgIT09IG5ld09wdGlvbnMuc2hvd1RhYnNcblx0XHQpIHtcblx0XHRcdGlmICh0aGlzLmVkaXRvckFjdGlvbnNUb29sYmFyQ29udGFpbmVyKSB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlRWRpdG9yQWN0aW9uVG9vbEJhclZpc2liaWxpdHkodGhpcy5lZGl0b3JBY3Rpb25zVG9vbGJhckNvbnRhaW5lcik7XG5cdFx0XHRcdHRoaXMudXBkYXRlRWRpdG9yQWN0aW9uc1Rvb2xiYXIoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhYnN0cmFjdCBvcGVuRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiBib29sZWFuO1xuXG5cdGFic3RyYWN0IG9wZW5FZGl0b3JzKGVkaXRvcnM6IEVkaXRvcklucHV0W10pOiBib29sZWFuO1xuXG5cdGFic3RyYWN0IGJlZm9yZUNsb3NlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkO1xuXG5cdGFic3RyYWN0IGNsb3NlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQpOiB2b2lkO1xuXG5cdGFic3RyYWN0IGNsb3NlRWRpdG9ycyhlZGl0b3JzOiBFZGl0b3JJbnB1dFtdKTogdm9pZDtcblxuXHRhYnN0cmFjdCBtb3ZlRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQsIGZyb21JbmRleDogbnVtYmVyLCB0YXJnZXRJbmRleDogbnVtYmVyKTogdm9pZDtcblxuXHRhYnN0cmFjdCBwaW5FZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQ7XG5cblx0YWJzdHJhY3Qgc3RpY2tFZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCk6IHZvaWQ7XG5cblx0YWJzdHJhY3QgdW5zdGlja0VkaXRvcihlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZDtcblxuXHRhYnN0cmFjdCBzZXRBY3RpdmUoaXNBY3RpdmU6IGJvb2xlYW4pOiB2b2lkO1xuXG5cdGFic3RyYWN0IHVwZGF0ZUVkaXRvclNlbGVjdGlvbnMoKTogdm9pZDtcblxuXHRhYnN0cmFjdCB1cGRhdGVFZGl0b3JMYWJlbChlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZDtcblxuXHRhYnN0cmFjdCB1cGRhdGVFZGl0b3JEaXJ0eShlZGl0b3I6IEVkaXRvcklucHV0KTogdm9pZDtcblxuXHRhYnN0cmFjdCBsYXlvdXQoZGltZW5zaW9uczogSUVkaXRvclRpdGxlQ29udHJvbERpbWVuc2lvbnMpOiBEaW1lbnNpb247XG5cblx0YWJzdHJhY3QgZ2V0SGVpZ2h0KCk6IG51bWJlcjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsR0FBYyxpQkFBaUIsV0FBVyxvQkFBb0I7QUFDdkUsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxvQkFBcUMsc0JBQXNCO0FBQ3BFLFNBQWtCLG9CQUFvQjtBQUV0QyxTQUFTLHVCQUFvQztBQUM3QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGNBQWM7QUFDdkIsU0FBUywwQkFBdUM7QUFDaEQsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw0QkFBNEI7QUFD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QUFZLE1BQU07QUFBQTtBQUFBLElBQ2pELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFVSxjQUFjLFFBQWlEO0FBQ3hFLFdBQU8sS0FBSyxrQkFBa0IsaUJBQWlCLE9BQU8sSUFBSSxLQUFLLG9DQUFvQyxDQUFDO0FBQUEsRUFDckc7QUFBQSxFQUVVLG1CQUFtQixRQUFxQztBQUNqRSxVQUFNLGFBQWEsS0FBSyxjQUFjLE1BQU07QUFFNUMsV0FBTyxhQUFhLFdBQVcsU0FBUyxLQUFLLFNBQVk7QUFBQSxFQUMxRDtBQUFBLEVBRUEsSUFBYyxZQUFZO0FBQ3pCLFdBQU8sS0FBSyxXQUFXLFlBQVksY0FBYyxZQUFZLGtCQUFrQixrQkFBa0IsU0FBUyxrQkFBa0Isa0JBQWtCO0FBQUEsRUFDL0k7QUFBQSxFQUVVLGNBQWMsUUFBa0U7QUFDekYsVUFBTSxRQUFRLE9BQU8sU0FBUyxVQUFVLElBQUk7QUFDNUMsUUFBSSxDQUFDLEtBQUssVUFBVSxTQUFTLE1BQU0sR0FBRztBQUNyQyxhQUFPO0FBQUEsUUFDTixVQUFVLElBQUksZUFBZSxJQUFJLEVBQUUsbUJBQW1CLE1BQU0sV0FBVyxLQUFLLENBQUMsRUFDNUUsV0FBVyxLQUFLLEVBQ2hCLGVBQWUsbUlBQW1JO0FBQUEsUUFDbkosOEJBQThCLFFBQVE7QUFBQSxNQUN2QztBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVUsa0JBQXdCO0FBQ2pDLFNBQUssT0FBTyxNQUFNLFlBQVksNkJBQTZCLEdBQUcsS0FBSyxTQUFTLElBQUk7QUFBQSxFQUNqRjtBQUFBLEVBRUEsY0FBYyxZQUFnQyxZQUFzQztBQUduRixRQUFJLFdBQVcsY0FBYyxXQUFXLFdBQVc7QUFDbEQsV0FBSyxnQkFBZ0I7QUFBQSxJQUN0QjtBQUdBLFFBQ0MsV0FBVywwQkFBMEIsV0FBVyx5QkFDaEQsV0FBVyxhQUFhLFdBQVcsVUFDbEM7QUFDRCxVQUFJLEtBQUssK0JBQStCO0FBQ3ZDLGFBQUssb0NBQW9DLEtBQUssNkJBQTZCO0FBQzNFLGFBQUssMkJBQTJCO0FBQUEsTUFDakM7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQStCRDtBQXRhc0Isa0JBTUcsb0JBQW9CO0FBQUEsRUFDM0MsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUNWO0FBVHFCLG9CQUFmO0FBQUEsRUFzQ0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBOUNtQjsiLAogICJuYW1lcyI6IFtdCn0K
