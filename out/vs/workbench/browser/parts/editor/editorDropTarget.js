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
import "./media/editordroptarget.css";
import { DataTransfers } from "../../../../base/browser/dnd.js";
import { $, addDisposableListener, DragAndDropObserver, EventHelper, EventType, getWindow, isAncestor } from "../../../../base/browser/dom.js";
import { renderFormattedText } from "../../../../base/browser/formattedTextRenderer.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { isMacintosh, isWeb } from "../../../../base/common/platform.js";
import { assertAllDefined, assertIsDefined } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { activeContrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { isTemporaryWorkspace, IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { CodeDataTransfers, containsDragType, Extensions as DragAndDropExtensions, LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";
import { DraggedEditorGroupIdentifier, DraggedEditorIdentifier, extractTreeDropData, ResourcesDropHandler } from "../../dnd.js";
import { prepareMoveCopyEditors } from "./editor.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND, EDITOR_DROP_INTO_PROMPT_BACKGROUND, EDITOR_DROP_INTO_PROMPT_BORDER, EDITOR_DROP_INTO_PROMPT_FOREGROUND } from "../../../common/theme.js";
import { GroupDirection, IEditorGroupsService, MergeGroupMode } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ITreeViewsDnDService } from "../../../../editor/common/services/treeViewsDndService.js";
import { DraggedTreeItemsIdentifier } from "../../../../editor/common/services/treeViewsDnd.js";
function isDropIntoEditorEnabledGlobally(configurationService) {
  return configurationService.getValue("editor.dropIntoEditor.enabled");
}
function isDragIntoEditorEvent(e) {
  return e.shiftKey;
}
let DropOverlay = class extends Themable {
  constructor(groupView, themeService, configurationService, instantiationService, editorService, editorGroupService, treeViewsDragAndDropService, contextService) {
    super(themeService);
    this.groupView = groupView;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.treeViewsDragAndDropService = treeViewsDragAndDropService;
    this.contextService = contextService;
    this.editorTransfer = LocalSelectionTransfer.getInstance();
    this.groupTransfer = LocalSelectionTransfer.getInstance();
    this.treeItemsTransfer = LocalSelectionTransfer.getInstance();
    this.cleanupOverlayScheduler = this._register(new RunOnceScheduler(() => this.dispose(), 300));
    this.enableDropIntoEditor = isDropIntoEditorEnabledGlobally(this.configurationService) && this.isDropIntoActiveEditorEnabled();
    this.create();
  }
  get disposed() {
    return !!this._disposed;
  }
  create() {
    const overlayOffsetHeight = this.getOverlayOffsetHeight();
    const container = this.container = $("div", { id: DropOverlay.OVERLAY_ID });
    container.style.top = `${overlayOffsetHeight}px`;
    this.groupView.element.appendChild(container);
    this.groupView.element.classList.add("dragged-over");
    this._register(toDisposable(() => {
      container.remove();
      this.groupView.element.classList.remove("dragged-over");
    }));
    this.overlay = $(".editor-group-overlay-indicator");
    container.appendChild(this.overlay);
    if (this.enableDropIntoEditor) {
      this.dropIntoPromptElement = renderFormattedText(localize("dropIntoEditorPrompt", "Hold __{0}__ to drop into editor", isMacintosh ? "\u21E7" : "Shift"), {});
      this.dropIntoPromptElement.classList.add("editor-group-overlay-drop-into-prompt");
      this.overlay.appendChild(this.dropIntoPromptElement);
    }
    this.registerListeners(container);
    this.updateStyles();
  }
  updateStyles() {
    const overlay = assertIsDefined(this.overlay);
    overlay.style.backgroundColor = this.getColor(EDITOR_DRAG_AND_DROP_BACKGROUND) || "";
    const activeContrastBorderColor = this.getColor(activeContrastBorder);
    overlay.style.outlineColor = activeContrastBorderColor || "";
    overlay.style.outlineOffset = activeContrastBorderColor ? "-2px" : "";
    overlay.style.outlineStyle = activeContrastBorderColor ? "dashed" : "";
    overlay.style.outlineWidth = activeContrastBorderColor ? "2px" : "";
    if (this.dropIntoPromptElement) {
      this.dropIntoPromptElement.style.backgroundColor = this.getColor(EDITOR_DROP_INTO_PROMPT_BACKGROUND) ?? "";
      this.dropIntoPromptElement.style.color = this.getColor(EDITOR_DROP_INTO_PROMPT_FOREGROUND) ?? "";
      const borderColor = this.getColor(EDITOR_DROP_INTO_PROMPT_BORDER);
      if (borderColor) {
        this.dropIntoPromptElement.style.borderWidth = "1px";
        this.dropIntoPromptElement.style.borderStyle = "solid";
        this.dropIntoPromptElement.style.borderColor = borderColor;
      } else {
        this.dropIntoPromptElement.style.borderWidth = "0";
      }
    }
  }
  registerListeners(container) {
    this._register(new DragAndDropObserver(container, {
      onDragOver: (e) => {
        if (this.enableDropIntoEditor && isDragIntoEditorEvent(e)) {
          this.dispose();
          return;
        }
        const isDraggingGroup = this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype);
        const isDraggingEditor = this.editorTransfer.hasData(DraggedEditorIdentifier.prototype);
        if (!isDraggingEditor && !isDraggingGroup && e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
        let isCopy = true;
        if (isDraggingGroup) {
          isCopy = this.isCopyOperation(e);
        } else if (isDraggingEditor) {
          const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
          if (Array.isArray(data) && data.length > 0) {
            isCopy = this.isCopyOperation(e, data[0].identifier);
          }
        }
        if (!isCopy) {
          const sourceGroupView = this.findSourceGroupView();
          if (sourceGroupView === this.groupView) {
            if (isDraggingGroup || isDraggingEditor && sourceGroupView.count < 2) {
              this.hideOverlay();
              return;
            }
          }
        }
        let splitOnDragAndDrop = !!this.editorGroupService.partOptions.splitOnDragAndDrop;
        if (this.isToggleSplitOperation(e)) {
          splitOnDragAndDrop = !splitOnDragAndDrop;
        }
        this.positionOverlay(e.offsetX, e.offsetY, isDraggingGroup, splitOnDragAndDrop);
        if (this.cleanupOverlayScheduler.isScheduled()) {
          this.cleanupOverlayScheduler.cancel();
        }
      },
      onDragLeave: (e) => this.dispose(),
      onDragEnd: (e) => this.dispose(),
      onDrop: (e) => {
        EventHelper.stop(e, true);
        this.dispose();
        if (this.currentDropOperation) {
          this.handleDrop(e, this.currentDropOperation.splitDirection);
        }
      }
    }));
    this._register(addDisposableListener(container, EventType.MOUSE_OVER, () => {
      if (!this.cleanupOverlayScheduler.isScheduled()) {
        this.cleanupOverlayScheduler.schedule();
      }
    }));
  }
  isDropIntoActiveEditorEnabled() {
    return !!this.groupView.activeEditor?.hasCapability(EditorInputCapabilities.CanDropIntoEditor);
  }
  findSourceGroupView() {
    if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
      const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        return this.editorGroupService.getGroup(data[0].identifier);
      }
    } else if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
      const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        return this.editorGroupService.getGroup(data[0].identifier.groupId);
      }
    }
    return void 0;
  }
  async handleDrop(event, splitDirection) {
    const ensureTargetGroup = () => {
      let targetGroup;
      if (typeof splitDirection === "number") {
        targetGroup = this.editorGroupService.addGroup(this.groupView, splitDirection);
      } else {
        targetGroup = this.groupView;
      }
      return targetGroup;
    };
    if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
      const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const sourceGroup = this.editorGroupService.getGroup(data[0].identifier);
        if (sourceGroup) {
          if (typeof splitDirection !== "number" && sourceGroup === this.groupView) {
            return;
          }
          let targetGroup;
          if (typeof splitDirection === "number") {
            if (this.isCopyOperation(event)) {
              targetGroup = this.editorGroupService.copyGroup(sourceGroup, this.groupView, splitDirection);
            } else {
              targetGroup = this.editorGroupService.moveGroup(sourceGroup, this.groupView, splitDirection);
            }
          } else {
            let mergeGroupOptions = void 0;
            if (this.isCopyOperation(event)) {
              mergeGroupOptions = { mode: MergeGroupMode.COPY_EDITORS };
            }
            this.editorGroupService.mergeGroup(sourceGroup, this.groupView, mergeGroupOptions);
          }
          if (targetGroup) {
            this.editorGroupService.activateGroup(targetGroup);
          }
        }
        this.groupTransfer.clearData(DraggedEditorGroupIdentifier.prototype);
      }
    } else if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
      const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const draggedEditors = data;
        const firstDraggedEditor = data[0].identifier;
        const sourceGroup = this.editorGroupService.getGroup(firstDraggedEditor.groupId);
        if (sourceGroup) {
          const copyEditor = this.isCopyOperation(event, firstDraggedEditor);
          let targetGroup = void 0;
          if (this.editorGroupService.partOptions.closeEmptyGroups && sourceGroup.count === 1 && typeof splitDirection === "number" && !copyEditor) {
            targetGroup = this.editorGroupService.moveGroup(sourceGroup, this.groupView, splitDirection);
          } else {
            targetGroup = ensureTargetGroup();
            if (sourceGroup === targetGroup) {
              return;
            }
            const editorsWithOptions = prepareMoveCopyEditors(this.groupView, draggedEditors.map((editor) => editor.identifier.editor));
            if (!copyEditor) {
              sourceGroup.moveEditors(editorsWithOptions, targetGroup);
            } else {
              sourceGroup.copyEditors(editorsWithOptions, targetGroup);
            }
          }
          targetGroup.focus();
        }
        this.editorTransfer.clearData(DraggedEditorIdentifier.prototype);
      }
    } else if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
      const data = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype);
      if (Array.isArray(data) && data.length > 0) {
        const editors = [];
        for (const id of data) {
          const dataTransferItem = await this.treeViewsDragAndDropService.removeDragOperationTransfer(id.identifier);
          if (dataTransferItem) {
            const treeDropData = await extractTreeDropData(dataTransferItem);
            editors.push(...treeDropData.map((editor) => ({ ...editor, options: { ...editor.options, pinned: true } })));
          }
        }
        if (editors.length) {
          this.editorService.openEditors(editors, ensureTargetGroup(), { validateTrust: true });
        }
      }
      this.treeItemsTransfer.clearData(DraggedTreeItemsIdentifier.prototype);
    } else {
      const dropHandler = this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: !isWeb || isTemporaryWorkspace(this.contextService.getWorkspace()) });
      dropHandler.handleDrop(event, getWindow(this.groupView.element), () => ensureTargetGroup(), (targetGroup) => targetGroup?.focus());
    }
  }
  isCopyOperation(e, draggedEditor) {
    if (draggedEditor?.editor.hasCapability(EditorInputCapabilities.Singleton)) {
      return false;
    }
    return e.ctrlKey && !isMacintosh || e.altKey && isMacintosh;
  }
  isToggleSplitOperation(e) {
    return e.altKey && !isMacintosh || e.shiftKey && isMacintosh;
  }
  positionOverlay(mousePosX, mousePosY, isDraggingGroup, enableSplitting) {
    const preferSplitVertically = this.editorGroupService.partOptions.openSideBySideDirection === "right";
    const editorControlWidth = this.groupView.element.clientWidth;
    const editorControlHeight = this.groupView.element.clientHeight - this.getOverlayOffsetHeight();
    let edgeWidthThresholdFactor;
    let edgeHeightThresholdFactor;
    if (enableSplitting) {
      if (isDraggingGroup) {
        edgeWidthThresholdFactor = preferSplitVertically ? 0.3 : 0.1;
      } else {
        edgeWidthThresholdFactor = 0.1;
      }
      if (isDraggingGroup) {
        edgeHeightThresholdFactor = preferSplitVertically ? 0.1 : 0.3;
      } else {
        edgeHeightThresholdFactor = 0.1;
      }
    } else {
      edgeWidthThresholdFactor = 0;
      edgeHeightThresholdFactor = 0;
    }
    const edgeWidthThreshold = editorControlWidth * edgeWidthThresholdFactor;
    const edgeHeightThreshold = editorControlHeight * edgeHeightThresholdFactor;
    const splitWidthThreshold = editorControlWidth / 3;
    const splitHeightThreshold = editorControlHeight / 3;
    let splitDirection;
    if (mousePosX > edgeWidthThreshold && mousePosX < editorControlWidth - edgeWidthThreshold && mousePosY > edgeHeightThreshold && mousePosY < editorControlHeight - edgeHeightThreshold) {
      splitDirection = void 0;
    } else {
      if (preferSplitVertically) {
        if (mousePosX < splitWidthThreshold) {
          splitDirection = GroupDirection.LEFT;
        } else if (mousePosX > splitWidthThreshold * 2) {
          splitDirection = GroupDirection.RIGHT;
        } else if (mousePosY < editorControlHeight / 2) {
          splitDirection = GroupDirection.UP;
        } else {
          splitDirection = GroupDirection.DOWN;
        }
      } else {
        if (mousePosY < splitHeightThreshold) {
          splitDirection = GroupDirection.UP;
        } else if (mousePosY > splitHeightThreshold * 2) {
          splitDirection = GroupDirection.DOWN;
        } else if (mousePosX < editorControlWidth / 2) {
          splitDirection = GroupDirection.LEFT;
        } else {
          splitDirection = GroupDirection.RIGHT;
        }
      }
    }
    switch (splitDirection) {
      case GroupDirection.UP:
        this.doPositionOverlay({ top: "0", left: "0", width: "100%", height: "50%" });
        this.toggleDropIntoPrompt(false);
        break;
      case GroupDirection.DOWN:
        this.doPositionOverlay({ top: "50%", left: "0", width: "100%", height: "50%" });
        this.toggleDropIntoPrompt(false);
        break;
      case GroupDirection.LEFT:
        this.doPositionOverlay({ top: "0", left: "0", width: "50%", height: "100%" });
        this.toggleDropIntoPrompt(false);
        break;
      case GroupDirection.RIGHT:
        this.doPositionOverlay({ top: "0", left: "50%", width: "50%", height: "100%" });
        this.toggleDropIntoPrompt(false);
        break;
      default:
        this.doPositionOverlay({ top: "0", left: "0", width: "100%", height: "100%" });
        this.toggleDropIntoPrompt(true);
    }
    const overlay = assertIsDefined(this.overlay);
    overlay.style.opacity = "1";
    setTimeout(() => overlay.classList.add("overlay-move-transition"), 0);
    this.currentDropOperation = { splitDirection };
  }
  doPositionOverlay(options) {
    const [container, overlay] = assertAllDefined(this.container, this.overlay);
    const offsetHeight = this.getOverlayOffsetHeight();
    if (offsetHeight) {
      container.style.height = `calc(100% - ${offsetHeight}px)`;
    } else {
      container.style.height = "100%";
    }
    overlay.style.top = options.top;
    overlay.style.left = options.left;
    overlay.style.width = options.width;
    overlay.style.height = options.height;
  }
  getOverlayOffsetHeight() {
    if (!this.groupView.isEmpty && this.editorGroupService.partOptions.showTabs === "multiple") {
      return this.groupView.titleHeight.offset;
    }
    return 0;
  }
  hideOverlay() {
    const overlay = assertIsDefined(this.overlay);
    this.doPositionOverlay({ top: "0", left: "0", width: "100%", height: "100%" });
    overlay.style.opacity = "0";
    overlay.classList.remove("overlay-move-transition");
    this.currentDropOperation = void 0;
  }
  toggleDropIntoPrompt(showing) {
    if (!this.dropIntoPromptElement) {
      return;
    }
    this.dropIntoPromptElement.style.opacity = showing ? "1" : "0";
  }
  contains(element) {
    return element === this.container || element === this.overlay;
  }
  dispose() {
    super.dispose();
    this._disposed = true;
  }
};
DropOverlay.OVERLAY_ID = "monaco-workbench-editor-drop-overlay";
DropOverlay = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IEditorGroupsService),
  __decorateParam(6, ITreeViewsDnDService),
  __decorateParam(7, IWorkspaceContextService)
], DropOverlay);
let EditorDropTarget = class extends Themable {
  constructor(container, delegate, editorGroupService, themeService, configurationService, instantiationService) {
    super(themeService);
    this.container = container;
    this.delegate = delegate;
    this.editorGroupService = editorGroupService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.counter = 0;
    this.editorTransfer = LocalSelectionTransfer.getInstance();
    this.groupTransfer = LocalSelectionTransfer.getInstance();
    this.registerListeners();
  }
  get overlay() {
    if (this._overlay && !this._overlay.disposed) {
      return this._overlay;
    }
    return void 0;
  }
  registerListeners() {
    this._register(addDisposableListener(this.container, EventType.DRAG_ENTER, (e) => this.onDragEnter(e)));
    this._register(addDisposableListener(this.container, EventType.DRAG_LEAVE, () => this.onDragLeave()));
    for (const target of [this.container, getWindow(this.container)]) {
      this._register(addDisposableListener(target, EventType.DRAG_END, () => this.onDragEnd()));
    }
  }
  onDragEnter(event) {
    if (isDropIntoEditorEnabledGlobally(this.configurationService) && isDragIntoEditorEvent(event)) {
      return;
    }
    this.counter++;
    if (!this.editorTransfer.hasData(DraggedEditorIdentifier.prototype) && !this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype) && event.dataTransfer) {
      const dndContributions = Registry.as(DragAndDropExtensions.DragAndDropContribution).getAll();
      const dndContributionKeys = Array.from(dndContributions).map((e) => e.dataFormatKey);
      if (!containsDragType(event, DataTransfers.FILES, CodeDataTransfers.FILES, DataTransfers.RESOURCES, CodeDataTransfers.EDITORS, ...dndContributionKeys)) {
        event.dataTransfer.dropEffect = "none";
        return;
      }
    }
    this.updateContainer(true);
    const target = event.target;
    if (target) {
      if (this.overlay && !this.overlay.contains(target)) {
        this.disposeOverlay();
      }
      if (!this.overlay) {
        const targetGroupView = this.findTargetGroupView(target);
        if (targetGroupView) {
          this._overlay = this.instantiationService.createInstance(DropOverlay, targetGroupView);
        }
      }
    }
  }
  onDragLeave() {
    this.counter--;
    if (this.counter === 0) {
      this.updateContainer(false);
    }
  }
  onDragEnd() {
    this.counter = 0;
    this.updateContainer(false);
    this.disposeOverlay();
  }
  findTargetGroupView(child) {
    const groups = this.editorGroupService.groups;
    return groups.find((groupView) => isAncestor(child, groupView.element) || this.delegate.containsGroup?.(groupView));
  }
  updateContainer(isDraggedOver) {
    this.container.classList.toggle("dragged-over", isDraggedOver);
  }
  dispose() {
    super.dispose();
    this.disposeOverlay();
  }
  disposeOverlay() {
    if (this.overlay) {
      this.overlay.dispose();
      this._overlay = void 0;
    }
  }
};
EditorDropTarget = __decorateClass([
  __decorateParam(2, IEditorGroupsService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService)
], EditorDropTarget);
export {
  EditorDropTarget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yRHJvcFRhcmdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9lZGl0b3Jkcm9wdGFyZ2V0LmNzcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyAkLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIERyYWdBbmREcm9wT2JzZXJ2ZXIsIEV2ZW50SGVscGVyLCBFdmVudFR5cGUsIGdldFdpbmRvdywgaXNBbmNlc3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgcmVuZGVyRm9ybWF0dGVkVGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mb3JtYXR0ZWRUZXh0UmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCwgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRBbGxEZWZpbmVkLCBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgYWN0aXZlQ29udHJhc3RCb3JkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlLCBUaGVtYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNUZW1wb3JhcnlXb3Jrc3BhY2UsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IENvZGVEYXRhVHJhbnNmZXJzLCBjb250YWluc0RyYWdUeXBlLCBFeHRlbnNpb25zIGFzIERyYWdBbmREcm9wRXh0ZW5zaW9ucywgSURyYWdBbmREcm9wQ29udHJpYnV0aW9uUmVnaXN0cnksIExvY2FsU2VsZWN0aW9uVHJhbnNmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgRHJhZ2dlZEVkaXRvckdyb3VwSWRlbnRpZmllciwgRHJhZ2dlZEVkaXRvcklkZW50aWZpZXIsIGV4dHJhY3RUcmVlRHJvcERhdGEsIFJlc291cmNlc0Ryb3BIYW5kbGVyIH0gZnJvbSAnLi4vLi4vZG5kLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cFZpZXcsIHByZXBhcmVNb3ZlQ29weUVkaXRvcnMgfSBmcm9tICcuL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgSUVkaXRvcklkZW50aWZpZXIsIElVbnR5cGVkRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVESVRPUl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQsIEVESVRPUl9EUk9QX0lOVE9fUFJPTVBUX0JBQ0tHUk9VTkQsIEVESVRPUl9EUk9QX0lOVE9fUFJPTVBUX0JPUkRFUiwgRURJVE9SX0RST1BfSU5UT19QUk9NUFRfRk9SRUdST1VORCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBHcm91cERpcmVjdGlvbiwgSUVkaXRvckRyb3BUYXJnZXREZWxlZ2F0ZSwgSUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBzU2VydmljZSwgSU1lcmdlR3JvdXBPcHRpb25zLCBNZXJnZUdyb3VwTW9kZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVHJlZVZpZXdzRG5EU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdHJlZVZpZXdzRG5kU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEcmFnZ2VkVHJlZUl0ZW1zSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdHJlZVZpZXdzRG5kLmpzJztcblxuaW50ZXJmYWNlIElEcm9wT3BlcmF0aW9uIHtcblx0c3BsaXREaXJlY3Rpb24/OiBHcm91cERpcmVjdGlvbjtcbn1cblxuZnVuY3Rpb24gaXNEcm9wSW50b0VkaXRvckVuYWJsZWRHbG9iYWxseShjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdHJldHVybiBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZWRpdG9yLmRyb3BJbnRvRWRpdG9yLmVuYWJsZWQnKTtcbn1cblxuZnVuY3Rpb24gaXNEcmFnSW50b0VkaXRvckV2ZW50KGU6IERyYWdFdmVudCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gZS5zaGlmdEtleTtcbn1cblxuY2xhc3MgRHJvcE92ZXJsYXkgZXh0ZW5kcyBUaGVtYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgT1ZFUkxBWV9JRCA9ICdtb25hY28td29ya2JlbmNoLWVkaXRvci1kcm9wLW92ZXJsYXknO1xuXG5cdHByaXZhdGUgY29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBvdmVybGF5OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBkcm9wSW50b1Byb21wdEVsZW1lbnQ/OiBIVE1MU3BhbkVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBjdXJyZW50RHJvcE9wZXJhdGlvbjogSURyb3BPcGVyYXRpb24gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfZGlzcG9zZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdGdldCBkaXNwb3NlZCgpOiBib29sZWFuIHsgcmV0dXJuICEhdGhpcy5fZGlzcG9zZWQ7IH1cblxuXHRwcml2YXRlIGNsZWFudXBPdmVybGF5U2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yVHJhbnNmZXIgPSBMb2NhbFNlbGVjdGlvblRyYW5zZmVyLmdldEluc3RhbmNlPERyYWdnZWRFZGl0b3JJZGVudGlmaWVyPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGdyb3VwVHJhbnNmZXIgPSBMb2NhbFNlbGVjdGlvblRyYW5zZmVyLmdldEluc3RhbmNlPERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXI+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdHJlZUl0ZW1zVHJhbnNmZXIgPSBMb2NhbFNlbGVjdGlvblRyYW5zZmVyLmdldEluc3RhbmNlPERyYWdnZWRUcmVlSXRlbXNJZGVudGlmaWVyPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZW5hYmxlRHJvcEludG9FZGl0b3I6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBncm91cFZpZXc6IElFZGl0b3JHcm91cFZpZXcsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElUcmVlVmlld3NEbkRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdHJlZVZpZXdzRHJhZ0FuZERyb3BTZXJ2aWNlOiBJVHJlZVZpZXdzRG5EU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcih0aGVtZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5jbGVhbnVwT3ZlcmxheVNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuZGlzcG9zZSgpLCAzMDApKTtcblxuXHRcdHRoaXMuZW5hYmxlRHJvcEludG9FZGl0b3IgPSBpc0Ryb3BJbnRvRWRpdG9yRW5hYmxlZEdsb2JhbGx5KHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpICYmIHRoaXMuaXNEcm9wSW50b0FjdGl2ZUVkaXRvckVuYWJsZWQoKTtcblxuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCBvdmVybGF5T2Zmc2V0SGVpZ2h0ID0gdGhpcy5nZXRPdmVybGF5T2Zmc2V0SGVpZ2h0KCk7XG5cblx0XHQvLyBDb250YWluZXJcblx0XHRjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lciA9ICQoJ2RpdicsIHsgaWQ6IERyb3BPdmVybGF5Lk9WRVJMQVlfSUQgfSk7XG5cdFx0Y29udGFpbmVyLnN0eWxlLnRvcCA9IGAke292ZXJsYXlPZmZzZXRIZWlnaHR9cHhgO1xuXG5cdFx0Ly8gUGFyZW50XG5cdFx0dGhpcy5ncm91cFZpZXcuZWxlbWVudC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuXHRcdHRoaXMuZ3JvdXBWaWV3LmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZHJhZ2dlZC1vdmVyJyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGNvbnRhaW5lci5yZW1vdmUoKTtcblx0XHRcdHRoaXMuZ3JvdXBWaWV3LmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dlZC1vdmVyJyk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gT3ZlcmxheVxuXHRcdHRoaXMub3ZlcmxheSA9ICQoJy5lZGl0b3ItZ3JvdXAtb3ZlcmxheS1pbmRpY2F0b3InKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5vdmVybGF5KTtcblxuXHRcdGlmICh0aGlzLmVuYWJsZURyb3BJbnRvRWRpdG9yKSB7XG5cdFx0XHR0aGlzLmRyb3BJbnRvUHJvbXB0RWxlbWVudCA9IHJlbmRlckZvcm1hdHRlZFRleHQobG9jYWxpemUoJ2Ryb3BJbnRvRWRpdG9yUHJvbXB0JywgXCJIb2xkIF9fezB9X18gdG8gZHJvcCBpbnRvIGVkaXRvclwiLCBpc01hY2ludG9zaCA/ICdcdTIxRTcnIDogJ1NoaWZ0JyksIHt9KTtcblx0XHRcdHRoaXMuZHJvcEludG9Qcm9tcHRFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2VkaXRvci1ncm91cC1vdmVybGF5LWRyb3AtaW50by1wcm9tcHQnKTtcblx0XHRcdHRoaXMub3ZlcmxheS5hcHBlbmRDaGlsZCh0aGlzLmRyb3BJbnRvUHJvbXB0RWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0Ly8gT3ZlcmxheSBFdmVudCBIYW5kbGluZ1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoY29udGFpbmVyKTtcblxuXHRcdC8vIFN0eWxlc1xuXHRcdHRoaXMudXBkYXRlU3R5bGVzKCk7XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVTdHlsZXMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3ZlcmxheSA9IGFzc2VydElzRGVmaW5lZCh0aGlzLm92ZXJsYXkpO1xuXG5cdFx0Ly8gT3ZlcmxheSBkcm9wIGJhY2tncm91bmRcblx0XHRvdmVybGF5LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHRoaXMuZ2V0Q29sb3IoRURJVE9SX0RSQUdfQU5EX0RST1BfQkFDS0dST1VORCkgfHwgJyc7XG5cblx0XHQvLyBPdmVybGF5IGNvbnRyYXN0IGJvcmRlciAoaWYgYW55KVxuXHRcdGNvbnN0IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyQ29sb3IgPSB0aGlzLmdldENvbG9yKGFjdGl2ZUNvbnRyYXN0Qm9yZGVyKTtcblx0XHRvdmVybGF5LnN0eWxlLm91dGxpbmVDb2xvciA9IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyQ29sb3IgfHwgJyc7XG5cdFx0b3ZlcmxheS5zdHlsZS5vdXRsaW5lT2Zmc2V0ID0gYWN0aXZlQ29udHJhc3RCb3JkZXJDb2xvciA/ICctMnB4JyA6ICcnO1xuXHRcdG92ZXJsYXkuc3R5bGUub3V0bGluZVN0eWxlID0gYWN0aXZlQ29udHJhc3RCb3JkZXJDb2xvciA/ICdkYXNoZWQnIDogJyc7XG5cdFx0b3ZlcmxheS5zdHlsZS5vdXRsaW5lV2lkdGggPSBhY3RpdmVDb250cmFzdEJvcmRlckNvbG9yID8gJzJweCcgOiAnJztcblxuXHRcdGlmICh0aGlzLmRyb3BJbnRvUHJvbXB0RWxlbWVudCkge1xuXHRcdFx0dGhpcy5kcm9wSW50b1Byb21wdEVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdGhpcy5nZXRDb2xvcihFRElUT1JfRFJPUF9JTlRPX1BST01QVF9CQUNLR1JPVU5EKSA/PyAnJztcblx0XHRcdHRoaXMuZHJvcEludG9Qcm9tcHRFbGVtZW50LnN0eWxlLmNvbG9yID0gdGhpcy5nZXRDb2xvcihFRElUT1JfRFJPUF9JTlRPX1BST01QVF9GT1JFR1JPVU5EKSA/PyAnJztcblxuXHRcdFx0Y29uc3QgYm9yZGVyQ29sb3IgPSB0aGlzLmdldENvbG9yKEVESVRPUl9EUk9QX0lOVE9fUFJPTVBUX0JPUkRFUik7XG5cdFx0XHRpZiAoYm9yZGVyQ29sb3IpIHtcblx0XHRcdFx0dGhpcy5kcm9wSW50b1Byb21wdEVsZW1lbnQuc3R5bGUuYm9yZGVyV2lkdGggPSAnMXB4Jztcblx0XHRcdFx0dGhpcy5kcm9wSW50b1Byb21wdEVsZW1lbnQuc3R5bGUuYm9yZGVyU3R5bGUgPSAnc29saWQnO1xuXHRcdFx0XHR0aGlzLmRyb3BJbnRvUHJvbXB0RWxlbWVudC5zdHlsZS5ib3JkZXJDb2xvciA9IGJvcmRlckNvbG9yO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5kcm9wSW50b1Byb21wdEVsZW1lbnQuc3R5bGUuYm9yZGVyV2lkdGggPSAnMCc7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycyhjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobmV3IERyYWdBbmREcm9wT2JzZXJ2ZXIoY29udGFpbmVyLCB7XG5cdFx0XHRvbkRyYWdPdmVyOiBlID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuZW5hYmxlRHJvcEludG9FZGl0b3IgJiYgaXNEcmFnSW50b0VkaXRvckV2ZW50KGUpKSB7XG5cdFx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaXNEcmFnZ2luZ0dyb3VwID0gdGhpcy5ncm91cFRyYW5zZmVyLmhhc0RhdGEoRHJhZ2dlZEVkaXRvckdyb3VwSWRlbnRpZmllci5wcm90b3R5cGUpO1xuXHRcdFx0XHRjb25zdCBpc0RyYWdnaW5nRWRpdG9yID0gdGhpcy5lZGl0b3JUcmFuc2Zlci5oYXNEYXRhKERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cblx0XHRcdFx0Ly8gVXBkYXRlIHRoZSBkcm9wRWZmZWN0IHRvIFwiY29weVwiIGlmIHRoZXJlIGlzIG5vIGxvY2FsIGRhdGEgdG8gYmUgZHJhZ2dlZCBiZWNhdXNlXG5cdFx0XHRcdC8vIGluIHRoYXQgY2FzZSB3ZSBjYW4gb25seSBjb3B5IHRoZSBkYXRhIGludG8gYW5kIG5vdCBtb3ZlIGl0IGZyb20gaXRzIHNvdXJjZVxuXHRcdFx0XHRpZiAoIWlzRHJhZ2dpbmdFZGl0b3IgJiYgIWlzRHJhZ2dpbmdHcm91cCAmJiBlLmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0XHRcdGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGaW5kIG91dCBpZiBvcGVyYXRpb24gaXMgdmFsaWRcblx0XHRcdFx0bGV0IGlzQ29weSA9IHRydWU7XG5cdFx0XHRcdGlmIChpc0RyYWdnaW5nR3JvdXApIHtcblx0XHRcdFx0XHRpc0NvcHkgPSB0aGlzLmlzQ29weU9wZXJhdGlvbihlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChpc0RyYWdnaW5nRWRpdG9yKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMuZWRpdG9yVHJhbnNmZXIuZ2V0RGF0YShEcmFnZ2VkRWRpdG9ySWRlbnRpZmllci5wcm90b3R5cGUpO1xuXHRcdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KGRhdGEpICYmIGRhdGEubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0aXNDb3B5ID0gdGhpcy5pc0NvcHlPcGVyYXRpb24oZSwgZGF0YVswXS5pZGVudGlmaWVyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWlzQ29weSkge1xuXHRcdFx0XHRcdGNvbnN0IHNvdXJjZUdyb3VwVmlldyA9IHRoaXMuZmluZFNvdXJjZUdyb3VwVmlldygpO1xuXHRcdFx0XHRcdGlmIChzb3VyY2VHcm91cFZpZXcgPT09IHRoaXMuZ3JvdXBWaWV3KSB7XG5cdFx0XHRcdFx0XHRpZiAoaXNEcmFnZ2luZ0dyb3VwIHx8IChpc0RyYWdnaW5nRWRpdG9yICYmIHNvdXJjZUdyb3VwVmlldy5jb3VudCA8IDIpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuaGlkZU92ZXJsYXkoKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuOyAvLyBkbyBub3QgYWxsb3cgdG8gZHJvcCBncm91cC9lZGl0b3Igb24gaXRzZWxmIGlmIHRoaXMgcmVzdWx0cyBpbiBhbiBlbXB0eSBncm91cFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFBvc2l0aW9uIG92ZXJsYXkgYW5kIGNvbmRpdGlvbmFsbHkgZW5hYmxlIG9yIGRpc2FibGVcblx0XHRcdFx0Ly8gZWRpdG9yIGdyb3VwIHNwbGl0dGluZyBzdXBwb3J0IGJhc2VkIG9uIHNldHRpbmcgYW5kXG5cdFx0XHRcdC8vIGtleW1vZGlmaWVycyB1c2VkLlxuXHRcdFx0XHRsZXQgc3BsaXRPbkRyYWdBbmREcm9wID0gISF0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0T3B0aW9ucy5zcGxpdE9uRHJhZ0FuZERyb3A7XG5cdFx0XHRcdGlmICh0aGlzLmlzVG9nZ2xlU3BsaXRPcGVyYXRpb24oZSkpIHtcblx0XHRcdFx0XHRzcGxpdE9uRHJhZ0FuZERyb3AgPSAhc3BsaXRPbkRyYWdBbmREcm9wO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucG9zaXRpb25PdmVybGF5KGUub2Zmc2V0WCwgZS5vZmZzZXRZLCBpc0RyYWdnaW5nR3JvdXAsIHNwbGl0T25EcmFnQW5kRHJvcCk7XG5cblx0XHRcdFx0Ly8gTWFrZSBzdXJlIHRvIHN0b3AgYW55IHJ1bm5pbmcgY2xlYW51cCBzY2hlZHVsZXIgdG8gcmVtb3ZlIHRoZSBvdmVybGF5XG5cdFx0XHRcdGlmICh0aGlzLmNsZWFudXBPdmVybGF5U2NoZWR1bGVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0XHR0aGlzLmNsZWFudXBPdmVybGF5U2NoZWR1bGVyLmNhbmNlbCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRvbkRyYWdMZWF2ZTogZSA9PiB0aGlzLmRpc3Bvc2UoKSxcblx0XHRcdG9uRHJhZ0VuZDogZSA9PiB0aGlzLmRpc3Bvc2UoKSxcblxuXHRcdFx0b25Ecm9wOiBlID0+IHtcblx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdFx0XHQvLyBEaXNwb3NlIG92ZXJsYXlcblx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cblx0XHRcdFx0Ly8gSGFuZGxlIGRyb3AgaWYgd2UgaGF2ZSBhIHZhbGlkIG9wZXJhdGlvblxuXHRcdFx0XHRpZiAodGhpcy5jdXJyZW50RHJvcE9wZXJhdGlvbikge1xuXHRcdFx0XHRcdHRoaXMuaGFuZGxlRHJvcChlLCB0aGlzLmN1cnJlbnREcm9wT3BlcmF0aW9uLnNwbGl0RGlyZWN0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihjb250YWluZXIsIEV2ZW50VHlwZS5NT1VTRV9PVkVSLCAoKSA9PiB7XG5cdFx0XHQvLyBVbmRlciBzb21lIGNpcmN1bXN0YW5jZXMgd2UgaGF2ZSBzZWVuIHJlcG9ydHMgd2hlcmUgdGhlIGRyb3Agb3ZlcmxheSBpcyBub3QgYmVpbmdcblx0XHRcdC8vIGNsZWFuZWQgdXAgYW5kIGFzIHN1Y2ggdGhlIGVkaXRvciBhcmVhIHJlbWFpbnMgdW5kZXIgdGhlIG92ZXJsYXkgc28gdGhhdCB5b3UgY2Fubm90XG5cdFx0XHQvLyB0eXBlIGludG8gdGhlIGVkaXRvciBhbnltb3JlLiBUaGlzIHNlZW1zIHJlbGF0ZWQgdG8gdXNpbmcgVk1zIGFuZCBETkQgdmlhIGhvc3QgYW5kXG5cdFx0XHQvLyBndWVzdCBPUywgdGhvdWdoIHNvbWUgdXNlcnMgYWxzbyBzYXcgaXQgd2l0aG91dCBWTXMuXG5cdFx0XHQvLyBUbyBwcm90ZWN0IGFnYWluc3QgdGhpcyBpc3N1ZSB3ZSBhbHdheXMgZGVzdHJveSB0aGUgb3ZlcmxheSBhcyBzb29uIGFzIHdlIGRldGVjdCBhXG5cdFx0XHQvLyBtb3VzZSBldmVudCBvdmVyIGl0LiBUaGUgZGVsYXkgaXMgdXNlZCB0byBndWFyYW50ZWUgd2UgYXJlIG5vdCBpbnRlcmZlcmluZyB3aXRoIHRoZVxuXHRcdFx0Ly8gYWN0dWFsIERST1AgZXZlbnQgdGhhdCBjYW4gYWxzbyB0cmlnZ2VyIGEgbW91c2Ugb3ZlciBldmVudC5cblx0XHRcdGlmICghdGhpcy5jbGVhbnVwT3ZlcmxheVNjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdHRoaXMuY2xlYW51cE92ZXJsYXlTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGlzRHJvcEludG9BY3RpdmVFZGl0b3JFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuZ3JvdXBWaWV3LmFjdGl2ZUVkaXRvcj8uaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5DYW5Ecm9wSW50b0VkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRTb3VyY2VHcm91cFZpZXcoKTogSUVkaXRvckdyb3VwIHwgdW5kZWZpbmVkIHtcblxuXHRcdC8vIENoZWNrIGZvciBncm91cCB0cmFuc2ZlclxuXHRcdGlmICh0aGlzLmdyb3VwVHJhbnNmZXIuaGFzRGF0YShEcmFnZ2VkRWRpdG9yR3JvdXBJZGVudGlmaWVyLnByb3RvdHlwZSkpIHtcblx0XHRcdGNvbnN0IGRhdGEgPSB0aGlzLmdyb3VwVHJhbnNmZXIuZ2V0RGF0YShEcmFnZ2VkRWRpdG9yR3JvdXBJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSAmJiBkYXRhLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdldEdyb3VwKGRhdGFbMF0uaWRlbnRpZmllcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgZm9yIGVkaXRvciB0cmFuc2ZlclxuXHRcdGVsc2UgaWYgKHRoaXMuZWRpdG9yVHJhbnNmZXIuaGFzRGF0YShEcmFnZ2VkRWRpdG9ySWRlbnRpZmllci5wcm90b3R5cGUpKSB7XG5cdFx0XHRjb25zdCBkYXRhID0gdGhpcy5lZGl0b3JUcmFuc2Zlci5nZXREYXRhKERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSAmJiBkYXRhLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdldEdyb3VwKGRhdGFbMF0uaWRlbnRpZmllci5ncm91cElkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVEcm9wKGV2ZW50OiBEcmFnRXZlbnQsIHNwbGl0RGlyZWN0aW9uPzogR3JvdXBEaXJlY3Rpb24pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIERldGVybWluZSB0YXJnZXQgZ3JvdXBcblx0XHRjb25zdCBlbnN1cmVUYXJnZXRHcm91cCA9ICgpID0+IHtcblx0XHRcdGxldCB0YXJnZXRHcm91cDogSUVkaXRvckdyb3VwO1xuXHRcdFx0aWYgKHR5cGVvZiBzcGxpdERpcmVjdGlvbiA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0dGFyZ2V0R3JvdXAgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hZGRHcm91cCh0aGlzLmdyb3VwVmlldywgc3BsaXREaXJlY3Rpb24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGFyZ2V0R3JvdXAgPSB0aGlzLmdyb3VwVmlldztcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRhcmdldEdyb3VwO1xuXHRcdH07XG5cblx0XHQvLyBDaGVjayBmb3IgZ3JvdXAgdHJhbnNmZXJcblx0XHRpZiAodGhpcy5ncm91cFRyYW5zZmVyLmhhc0RhdGEoRHJhZ2dlZEVkaXRvckdyb3VwSWRlbnRpZmllci5wcm90b3R5cGUpKSB7XG5cdFx0XHRjb25zdCBkYXRhID0gdGhpcy5ncm91cFRyYW5zZmVyLmdldERhdGEoRHJhZ2dlZEVkaXRvckdyb3VwSWRlbnRpZmllci5wcm90b3R5cGUpO1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoZGF0YSkgJiYgZGF0YS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IHNvdXJjZUdyb3VwID0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuZ2V0R3JvdXAoZGF0YVswXS5pZGVudGlmaWVyKTtcblx0XHRcdFx0aWYgKHNvdXJjZUdyb3VwKSB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBzcGxpdERpcmVjdGlvbiAhPT0gJ251bWJlcicgJiYgc291cmNlR3JvdXAgPT09IHRoaXMuZ3JvdXBWaWV3KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gU3BsaXQgdG8gbmV3IGdyb3VwXG5cdFx0XHRcdFx0bGV0IHRhcmdldEdyb3VwOiBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBzcGxpdERpcmVjdGlvbiA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmlzQ29weU9wZXJhdGlvbihldmVudCkpIHtcblx0XHRcdFx0XHRcdFx0dGFyZ2V0R3JvdXAgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5jb3B5R3JvdXAoc291cmNlR3JvdXAsIHRoaXMuZ3JvdXBWaWV3LCBzcGxpdERpcmVjdGlvbik7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0YXJnZXRHcm91cCA9IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1vdmVHcm91cChzb3VyY2VHcm91cCwgdGhpcy5ncm91cFZpZXcsIHNwbGl0RGlyZWN0aW9uKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBNZXJnZSBpbnRvIGV4aXN0aW5nIGdyb3VwXG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRsZXQgbWVyZ2VHcm91cE9wdGlvbnM6IElNZXJnZUdyb3VwT3B0aW9ucyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmlzQ29weU9wZXJhdGlvbihldmVudCkpIHtcblx0XHRcdFx0XHRcdFx0bWVyZ2VHcm91cE9wdGlvbnMgPSB7IG1vZGU6IE1lcmdlR3JvdXBNb2RlLkNPUFlfRURJVE9SUyB9O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tZXJnZUdyb3VwKHNvdXJjZUdyb3VwLCB0aGlzLmdyb3VwVmlldywgbWVyZ2VHcm91cE9wdGlvbnMpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh0YXJnZXRHcm91cCkge1xuXHRcdFx0XHRcdFx0dGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZhdGVHcm91cCh0YXJnZXRHcm91cCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5ncm91cFRyYW5zZmVyLmNsZWFyRGF0YShEcmFnZ2VkRWRpdG9yR3JvdXBJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgZm9yIGVkaXRvciB0cmFuc2ZlclxuXHRcdGVsc2UgaWYgKHRoaXMuZWRpdG9yVHJhbnNmZXIuaGFzRGF0YShEcmFnZ2VkRWRpdG9ySWRlbnRpZmllci5wcm90b3R5cGUpKSB7XG5cdFx0XHRjb25zdCBkYXRhID0gdGhpcy5lZGl0b3JUcmFuc2Zlci5nZXREYXRhKERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLnByb3RvdHlwZSk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSAmJiBkYXRhLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Y29uc3QgZHJhZ2dlZEVkaXRvcnMgPSBkYXRhO1xuXHRcdFx0XHRjb25zdCBmaXJzdERyYWdnZWRFZGl0b3IgPSBkYXRhWzBdLmlkZW50aWZpZXI7XG5cblx0XHRcdFx0Y29uc3Qgc291cmNlR3JvdXAgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5nZXRHcm91cChmaXJzdERyYWdnZWRFZGl0b3IuZ3JvdXBJZCk7XG5cdFx0XHRcdGlmIChzb3VyY2VHcm91cCkge1xuXHRcdFx0XHRcdGNvbnN0IGNvcHlFZGl0b3IgPSB0aGlzLmlzQ29weU9wZXJhdGlvbihldmVudCwgZmlyc3REcmFnZ2VkRWRpdG9yKTtcblx0XHRcdFx0XHRsZXQgdGFyZ2V0R3JvdXA6IElFZGl0b3JHcm91cCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRcdC8vIE9wdGltaXphdGlvbjogaWYgd2UgbW92ZSB0aGUgbGFzdCBlZGl0b3Igb2YgYW4gZWRpdG9yIGdyb3VwXG5cdFx0XHRcdFx0Ly8gYW5kIHdlIGFyZSBjb25maWd1cmVkIHRvIGNsb3NlIGVtcHR5IGVkaXRvciBncm91cHMsIHdlIGNhblxuXHRcdFx0XHRcdC8vIHJhdGhlciBtb3ZlIHRoZSBlbnRpcmUgZWRpdG9yIGdyb3VwIGFjY29yZGluZyB0byB0aGUgZGlyZWN0aW9uXG5cdFx0XHRcdFx0aWYgKHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLnBhcnRPcHRpb25zLmNsb3NlRW1wdHlHcm91cHMgJiYgc291cmNlR3JvdXAuY291bnQgPT09IDEgJiYgdHlwZW9mIHNwbGl0RGlyZWN0aW9uID09PSAnbnVtYmVyJyAmJiAhY29weUVkaXRvcikge1xuXHRcdFx0XHRcdFx0dGFyZ2V0R3JvdXAgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tb3ZlR3JvdXAoc291cmNlR3JvdXAsIHRoaXMuZ3JvdXBWaWV3LCBzcGxpdERpcmVjdGlvbik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gSW4gYW55IG90aGVyIGNhc2UgZG8gYSBub3JtYWwgbW92ZS9jb3B5IG9wZXJhdGlvblxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0dGFyZ2V0R3JvdXAgPSBlbnN1cmVUYXJnZXRHcm91cCgpO1xuXHRcdFx0XHRcdFx0aWYgKHNvdXJjZUdyb3VwID09PSB0YXJnZXRHcm91cCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRvcnNXaXRoT3B0aW9ucyA9IHByZXBhcmVNb3ZlQ29weUVkaXRvcnModGhpcy5ncm91cFZpZXcsIGRyYWdnZWRFZGl0b3JzLm1hcChlZGl0b3IgPT4gZWRpdG9yLmlkZW50aWZpZXIuZWRpdG9yKSk7XG5cdFx0XHRcdFx0XHRpZiAoIWNvcHlFZGl0b3IpIHtcblx0XHRcdFx0XHRcdFx0c291cmNlR3JvdXAubW92ZUVkaXRvcnMoZWRpdG9yc1dpdGhPcHRpb25zLCB0YXJnZXRHcm91cCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRzb3VyY2VHcm91cC5jb3B5RWRpdG9ycyhlZGl0b3JzV2l0aE9wdGlvbnMsIHRhcmdldEdyb3VwKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBFbnN1cmUgdGFyZ2V0IGhhcyBmb2N1c1xuXHRcdFx0XHRcdHRhcmdldEdyb3VwLmZvY3VzKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmVkaXRvclRyYW5zZmVyLmNsZWFyRGF0YShEcmFnZ2VkRWRpdG9ySWRlbnRpZmllci5wcm90b3R5cGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENoZWNrIGZvciB0cmVlIGl0ZW1zXG5cdFx0ZWxzZSBpZiAodGhpcy50cmVlSXRlbXNUcmFuc2Zlci5oYXNEYXRhKERyYWdnZWRUcmVlSXRlbXNJZGVudGlmaWVyLnByb3RvdHlwZSkpIHtcblx0XHRcdGNvbnN0IGRhdGEgPSB0aGlzLnRyZWVJdGVtc1RyYW5zZmVyLmdldERhdGEoRHJhZ2dlZFRyZWVJdGVtc0lkZW50aWZpZXIucHJvdG90eXBlKTtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGRhdGEpICYmIGRhdGEubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JzOiBJVW50eXBlZEVkaXRvcklucHV0W10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBpZCBvZiBkYXRhKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YVRyYW5zZmVySXRlbSA9IGF3YWl0IHRoaXMudHJlZVZpZXdzRHJhZ0FuZERyb3BTZXJ2aWNlLnJlbW92ZURyYWdPcGVyYXRpb25UcmFuc2ZlcihpZC5pZGVudGlmaWVyKTtcblx0XHRcdFx0XHRpZiAoZGF0YVRyYW5zZmVySXRlbSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgdHJlZURyb3BEYXRhID0gYXdhaXQgZXh0cmFjdFRyZWVEcm9wRGF0YShkYXRhVHJhbnNmZXJJdGVtKTtcblx0XHRcdFx0XHRcdGVkaXRvcnMucHVzaCguLi50cmVlRHJvcERhdGEubWFwKGVkaXRvciA9PiAoeyAuLi5lZGl0b3IsIG9wdGlvbnM6IHsgLi4uZWRpdG9yLm9wdGlvbnMsIHBpbm5lZDogdHJ1ZSB9IH0pKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlZGl0b3JzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9ycyhlZGl0b3JzLCBlbnN1cmVUYXJnZXRHcm91cCgpLCB7IHZhbGlkYXRlVHJ1c3Q6IHRydWUgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy50cmVlSXRlbXNUcmFuc2Zlci5jbGVhckRhdGEoRHJhZ2dlZFRyZWVJdGVtc0lkZW50aWZpZXIucHJvdG90eXBlKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBmb3IgVVJJIHRyYW5zZmVyXG5cdFx0ZWxzZSB7XG5cdFx0XHRjb25zdCBkcm9wSGFuZGxlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VzRHJvcEhhbmRsZXIsIHsgYWxsb3dXb3Jrc3BhY2VPcGVuOiAhaXNXZWIgfHwgaXNUZW1wb3JhcnlXb3Jrc3BhY2UodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKSkgfSk7XG5cdFx0XHRkcm9wSGFuZGxlci5oYW5kbGVEcm9wKGV2ZW50LCBnZXRXaW5kb3codGhpcy5ncm91cFZpZXcuZWxlbWVudCksICgpID0+IGVuc3VyZVRhcmdldEdyb3VwKCksIHRhcmdldEdyb3VwID0+IHRhcmdldEdyb3VwPy5mb2N1cygpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGlzQ29weU9wZXJhdGlvbihlOiBEcmFnRXZlbnQsIGRyYWdnZWRFZGl0b3I/OiBJRWRpdG9ySWRlbnRpZmllcik6IGJvb2xlYW4ge1xuXHRcdGlmIChkcmFnZ2VkRWRpdG9yPy5lZGl0b3IuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5TaW5nbGV0b24pKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIFNpbmdsZXRvbiBlZGl0b3JzIGNhbm5vdCBiZSBzcGxpdFxuXHRcdH1cblxuXHRcdHJldHVybiAoZS5jdHJsS2V5ICYmICFpc01hY2ludG9zaCkgfHwgKGUuYWx0S2V5ICYmIGlzTWFjaW50b3NoKTtcblx0fVxuXG5cdHByaXZhdGUgaXNUb2dnbGVTcGxpdE9wZXJhdGlvbihlOiBEcmFnRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKGUuYWx0S2V5ICYmICFpc01hY2ludG9zaCkgfHwgKGUuc2hpZnRLZXkgJiYgaXNNYWNpbnRvc2gpO1xuXHR9XG5cblx0cHJpdmF0ZSBwb3NpdGlvbk92ZXJsYXkobW91c2VQb3NYOiBudW1iZXIsIG1vdXNlUG9zWTogbnVtYmVyLCBpc0RyYWdnaW5nR3JvdXA6IGJvb2xlYW4sIGVuYWJsZVNwbGl0dGluZzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IHByZWZlclNwbGl0VmVydGljYWxseSA9IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLnBhcnRPcHRpb25zLm9wZW5TaWRlQnlTaWRlRGlyZWN0aW9uID09PSAncmlnaHQnO1xuXG5cdFx0Y29uc3QgZWRpdG9yQ29udHJvbFdpZHRoID0gdGhpcy5ncm91cFZpZXcuZWxlbWVudC5jbGllbnRXaWR0aDtcblx0XHRjb25zdCBlZGl0b3JDb250cm9sSGVpZ2h0ID0gdGhpcy5ncm91cFZpZXcuZWxlbWVudC5jbGllbnRIZWlnaHQgLSB0aGlzLmdldE92ZXJsYXlPZmZzZXRIZWlnaHQoKTtcblxuXHRcdGxldCBlZGdlV2lkdGhUaHJlc2hvbGRGYWN0b3I6IG51bWJlcjtcblx0XHRsZXQgZWRnZUhlaWdodFRocmVzaG9sZEZhY3RvcjogbnVtYmVyO1xuXHRcdGlmIChlbmFibGVTcGxpdHRpbmcpIHtcblx0XHRcdGlmIChpc0RyYWdnaW5nR3JvdXApIHtcblx0XHRcdFx0ZWRnZVdpZHRoVGhyZXNob2xkRmFjdG9yID0gcHJlZmVyU3BsaXRWZXJ0aWNhbGx5ID8gMC4zIDogMC4xOyAvLyBnaXZlIGxhcmdlciB0aHJlc2hvbGQgd2hlbiBkcmFnZ2luZyBncm91cCBkZXBlbmRpbmcgb24gcHJlZmVycmVkIHNwbGl0IGRpcmVjdGlvblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWRnZVdpZHRoVGhyZXNob2xkRmFjdG9yID0gMC4xOyAvLyAxMCUgdGhyZXNob2xkIHRvIHNwbGl0IGlmIGRyYWdnaW5nIGVkaXRvcnNcblx0XHRcdH1cblxuXHRcdFx0aWYgKGlzRHJhZ2dpbmdHcm91cCkge1xuXHRcdFx0XHRlZGdlSGVpZ2h0VGhyZXNob2xkRmFjdG9yID0gcHJlZmVyU3BsaXRWZXJ0aWNhbGx5ID8gMC4xIDogMC4zOyAvLyBnaXZlIGxhcmdlciB0aHJlc2hvbGQgd2hlbiBkcmFnZ2luZyBncm91cCBkZXBlbmRpbmcgb24gcHJlZmVycmVkIHNwbGl0IGRpcmVjdGlvblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWRnZUhlaWdodFRocmVzaG9sZEZhY3RvciA9IDAuMTsgLy8gMTAlIHRocmVzaG9sZCB0byBzcGxpdCBpZiBkcmFnZ2luZyBlZGl0b3JzXG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVkZ2VXaWR0aFRocmVzaG9sZEZhY3RvciA9IDA7XG5cdFx0XHRlZGdlSGVpZ2h0VGhyZXNob2xkRmFjdG9yID0gMDtcblx0XHR9XG5cblx0XHRjb25zdCBlZGdlV2lkdGhUaHJlc2hvbGQgPSBlZGl0b3JDb250cm9sV2lkdGggKiBlZGdlV2lkdGhUaHJlc2hvbGRGYWN0b3I7XG5cdFx0Y29uc3QgZWRnZUhlaWdodFRocmVzaG9sZCA9IGVkaXRvckNvbnRyb2xIZWlnaHQgKiBlZGdlSGVpZ2h0VGhyZXNob2xkRmFjdG9yO1xuXG5cdFx0Y29uc3Qgc3BsaXRXaWR0aFRocmVzaG9sZCA9IGVkaXRvckNvbnRyb2xXaWR0aCAvIDM7XHRcdC8vIG9mZmVyIHRvIHNwbGl0IGxlZnQvcmlnaHQgYXQgMzMlXG5cdFx0Y29uc3Qgc3BsaXRIZWlnaHRUaHJlc2hvbGQgPSBlZGl0b3JDb250cm9sSGVpZ2h0IC8gMztcdC8vIG9mZmVyIHRvIHNwbGl0IHVwL2Rvd24gYXQgMzMlXG5cblx0XHQvLyBObyBzcGxpdCBpZiBtb3VzZSBpcyBhYm92ZSBjZXJ0YWluIHRocmVzaG9sZCBpbiB0aGUgY2VudGVyIG9mIHRoZSB2aWV3XG5cdFx0bGV0IHNwbGl0RGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRpZiAoXG5cdFx0XHRtb3VzZVBvc1ggPiBlZGdlV2lkdGhUaHJlc2hvbGQgJiYgbW91c2VQb3NYIDwgZWRpdG9yQ29udHJvbFdpZHRoIC0gZWRnZVdpZHRoVGhyZXNob2xkICYmXG5cdFx0XHRtb3VzZVBvc1kgPiBlZGdlSGVpZ2h0VGhyZXNob2xkICYmIG1vdXNlUG9zWSA8IGVkaXRvckNvbnRyb2xIZWlnaHQgLSBlZGdlSGVpZ2h0VGhyZXNob2xkXG5cdFx0KSB7XG5cdFx0XHRzcGxpdERpcmVjdGlvbiA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBPZmZlciB0byBzcGxpdCBvdGhlcndpc2Vcblx0XHRlbHNlIHtcblxuXHRcdFx0Ly8gVXNlciBwcmVmZXJzIHRvIHNwbGl0IHZlcnRpY2FsbHk6IG9mZmVyIGEgbGFyZ2VyIGhpdHpvbmVcblx0XHRcdC8vIGZvciB0aGlzIGRpcmVjdGlvbiBsaWtlIHNvOlxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRcdFx0Ly8gfFx0XHR8XHRcdFNQTElUIFVQXHRcdHxcdFx0XHR8XG5cdFx0XHQvLyB8IFNQTElUIFx0fC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFx0U1BMSVRcdHxcblx0XHRcdC8vIHxcdFx0fFx0XHQgIE1FUkdFXHRcdFx0fFx0XHRcdHxcblx0XHRcdC8vIHwgTEVGVFx0fC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFx0UklHSFRcdHxcblx0XHRcdC8vIHxcdFx0fFx0XHRTUExJVCBET1dOXHRcdHxcdFx0XHR8XG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdFx0XHRpZiAocHJlZmVyU3BsaXRWZXJ0aWNhbGx5KSB7XG5cdFx0XHRcdGlmIChtb3VzZVBvc1ggPCBzcGxpdFdpZHRoVGhyZXNob2xkKSB7XG5cdFx0XHRcdFx0c3BsaXREaXJlY3Rpb24gPSBHcm91cERpcmVjdGlvbi5MRUZUO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG1vdXNlUG9zWCA+IHNwbGl0V2lkdGhUaHJlc2hvbGQgKiAyKSB7XG5cdFx0XHRcdFx0c3BsaXREaXJlY3Rpb24gPSBHcm91cERpcmVjdGlvbi5SSUdIVDtcblx0XHRcdFx0fSBlbHNlIGlmIChtb3VzZVBvc1kgPCBlZGl0b3JDb250cm9sSGVpZ2h0IC8gMikge1xuXHRcdFx0XHRcdHNwbGl0RGlyZWN0aW9uID0gR3JvdXBEaXJlY3Rpb24uVVA7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c3BsaXREaXJlY3Rpb24gPSBHcm91cERpcmVjdGlvbi5ET1dOO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFVzZXIgcHJlZmVycyB0byBzcGxpdCBob3Jpem9udGFsbHk6IG9mZmVyIGEgbGFyZ2VyIGhpdHpvbmVcblx0XHRcdC8vIGZvciB0aGlzIGRpcmVjdGlvbiBsaWtlIHNvOlxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRcdFx0Ly8gfFx0XHRcdFx0U1BMSVQgVVBcdFx0XHRcdFx0fFxuXHRcdFx0Ly8gfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuXHRcdFx0Ly8gfCAgU1BMSVQgTEVGVCAgfFx0ICAgTUVSR0VcdHwgIFNQTElUIFJJR0hUICB8XG5cdFx0XHQvLyB8LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18XG5cdFx0XHQvLyB8XHRcdFx0XHRTUExJVCBET1dOXHRcdFx0XHRcdHxcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZiAobW91c2VQb3NZIDwgc3BsaXRIZWlnaHRUaHJlc2hvbGQpIHtcblx0XHRcdFx0XHRzcGxpdERpcmVjdGlvbiA9IEdyb3VwRGlyZWN0aW9uLlVQO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG1vdXNlUG9zWSA+IHNwbGl0SGVpZ2h0VGhyZXNob2xkICogMikge1xuXHRcdFx0XHRcdHNwbGl0RGlyZWN0aW9uID0gR3JvdXBEaXJlY3Rpb24uRE9XTjtcblx0XHRcdFx0fSBlbHNlIGlmIChtb3VzZVBvc1ggPCBlZGl0b3JDb250cm9sV2lkdGggLyAyKSB7XG5cdFx0XHRcdFx0c3BsaXREaXJlY3Rpb24gPSBHcm91cERpcmVjdGlvbi5MRUZUO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNwbGl0RGlyZWN0aW9uID0gR3JvdXBEaXJlY3Rpb24uUklHSFQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBEcmF3IG92ZXJsYXkgYmFzZWQgb24gc3BsaXQgZGlyZWN0aW9uXG5cdFx0c3dpdGNoIChzcGxpdERpcmVjdGlvbikge1xuXHRcdFx0Y2FzZSBHcm91cERpcmVjdGlvbi5VUDpcblx0XHRcdFx0dGhpcy5kb1Bvc2l0aW9uT3ZlcmxheSh7IHRvcDogJzAnLCBsZWZ0OiAnMCcsIHdpZHRoOiAnMTAwJScsIGhlaWdodDogJzUwJScgfSk7XG5cdFx0XHRcdHRoaXMudG9nZ2xlRHJvcEludG9Qcm9tcHQoZmFsc2UpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgR3JvdXBEaXJlY3Rpb24uRE9XTjpcblx0XHRcdFx0dGhpcy5kb1Bvc2l0aW9uT3ZlcmxheSh7IHRvcDogJzUwJScsIGxlZnQ6ICcwJywgd2lkdGg6ICcxMDAlJywgaGVpZ2h0OiAnNTAlJyB9KTtcblx0XHRcdFx0dGhpcy50b2dnbGVEcm9wSW50b1Byb21wdChmYWxzZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBHcm91cERpcmVjdGlvbi5MRUZUOlxuXHRcdFx0XHR0aGlzLmRvUG9zaXRpb25PdmVybGF5KHsgdG9wOiAnMCcsIGxlZnQ6ICcwJywgd2lkdGg6ICc1MCUnLCBoZWlnaHQ6ICcxMDAlJyB9KTtcblx0XHRcdFx0dGhpcy50b2dnbGVEcm9wSW50b1Byb21wdChmYWxzZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBHcm91cERpcmVjdGlvbi5SSUdIVDpcblx0XHRcdFx0dGhpcy5kb1Bvc2l0aW9uT3ZlcmxheSh7IHRvcDogJzAnLCBsZWZ0OiAnNTAlJywgd2lkdGg6ICc1MCUnLCBoZWlnaHQ6ICcxMDAlJyB9KTtcblx0XHRcdFx0dGhpcy50b2dnbGVEcm9wSW50b1Byb21wdChmYWxzZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhpcy5kb1Bvc2l0aW9uT3ZlcmxheSh7IHRvcDogJzAnLCBsZWZ0OiAnMCcsIHdpZHRoOiAnMTAwJScsIGhlaWdodDogJzEwMCUnIH0pO1xuXHRcdFx0XHR0aGlzLnRvZ2dsZURyb3BJbnRvUHJvbXB0KHRydWUpO1xuXHRcdH1cblxuXHRcdC8vIE1ha2Ugc3VyZSB0aGUgb3ZlcmxheSBpcyB2aXNpYmxlIG5vd1xuXHRcdGNvbnN0IG92ZXJsYXkgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5vdmVybGF5KTtcblx0XHRvdmVybGF5LnN0eWxlLm9wYWNpdHkgPSAnMSc7XG5cblx0XHQvLyBFbmFibGUgdHJhbnNpdGlvbiBhZnRlciBhIHRpbWVvdXQgdG8gcHJldmVudCBpbml0aWFsIGFuaW1hdGlvblxuXHRcdHNldFRpbWVvdXQoKCkgPT4gb3ZlcmxheS5jbGFzc0xpc3QuYWRkKCdvdmVybGF5LW1vdmUtdHJhbnNpdGlvbicpLCAwKTtcblxuXHRcdC8vIFJlbWVtYmVyIGFzIGN1cnJlbnQgc3BsaXQgZGlyZWN0aW9uXG5cdFx0dGhpcy5jdXJyZW50RHJvcE9wZXJhdGlvbiA9IHsgc3BsaXREaXJlY3Rpb24gfTtcblx0fVxuXG5cdHByaXZhdGUgZG9Qb3NpdGlvbk92ZXJsYXkob3B0aW9uczogeyB0b3A6IHN0cmluZzsgbGVmdDogc3RyaW5nOyB3aWR0aDogc3RyaW5nOyBoZWlnaHQ6IHN0cmluZyB9KTogdm9pZCB7XG5cdFx0Y29uc3QgW2NvbnRhaW5lciwgb3ZlcmxheV0gPSBhc3NlcnRBbGxEZWZpbmVkKHRoaXMuY29udGFpbmVyLCB0aGlzLm92ZXJsYXkpO1xuXG5cdFx0Ly8gQ29udGFpbmVyXG5cdFx0Y29uc3Qgb2Zmc2V0SGVpZ2h0ID0gdGhpcy5nZXRPdmVybGF5T2Zmc2V0SGVpZ2h0KCk7XG5cdFx0aWYgKG9mZnNldEhlaWdodCkge1xuXHRcdFx0Y29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGBjYWxjKDEwMCUgLSAke29mZnNldEhlaWdodH1weClgO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuXHRcdH1cblxuXHRcdC8vIE92ZXJsYXlcblx0XHRvdmVybGF5LnN0eWxlLnRvcCA9IG9wdGlvbnMudG9wO1xuXHRcdG92ZXJsYXkuc3R5bGUubGVmdCA9IG9wdGlvbnMubGVmdDtcblx0XHRvdmVybGF5LnN0eWxlLndpZHRoID0gb3B0aW9ucy53aWR0aDtcblx0XHRvdmVybGF5LnN0eWxlLmhlaWdodCA9IG9wdGlvbnMuaGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPdmVybGF5T2Zmc2V0SGVpZ2h0KCk6IG51bWJlciB7XG5cblx0XHQvLyBXaXRoIHRhYnMgYW5kIG9wZW5lZCBlZGl0b3JzOiB1c2UgdGhlIGFyZWEgYmVsb3cgdGFicyBhcyBkcm9wIHRhcmdldFxuXHRcdGlmICghdGhpcy5ncm91cFZpZXcuaXNFbXB0eSAmJiB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0T3B0aW9ucy5zaG93VGFicyA9PT0gJ211bHRpcGxlJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ3JvdXBWaWV3LnRpdGxlSGVpZ2h0Lm9mZnNldDtcblx0XHR9XG5cblx0XHQvLyBXaXRob3V0IHRhYnMgb3IgZW1wdHkgZ3JvdXA6IHVzZSBlbnRpcmUgZWRpdG9yIGFyZWEgYXMgZHJvcCB0YXJnZXRcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdHByaXZhdGUgaGlkZU92ZXJsYXkoKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3ZlcmxheSA9IGFzc2VydElzRGVmaW5lZCh0aGlzLm92ZXJsYXkpO1xuXG5cdFx0Ly8gUmVzZXQgb3ZlcmxheVxuXHRcdHRoaXMuZG9Qb3NpdGlvbk92ZXJsYXkoeyB0b3A6ICcwJywgbGVmdDogJzAnLCB3aWR0aDogJzEwMCUnLCBoZWlnaHQ6ICcxMDAlJyB9KTtcblx0XHRvdmVybGF5LnN0eWxlLm9wYWNpdHkgPSAnMCc7XG5cdFx0b3ZlcmxheS5jbGFzc0xpc3QucmVtb3ZlKCdvdmVybGF5LW1vdmUtdHJhbnNpdGlvbicpO1xuXG5cdFx0Ly8gUmVzZXQgY3VycmVudCBvcGVyYXRpb25cblx0XHR0aGlzLmN1cnJlbnREcm9wT3BlcmF0aW9uID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSB0b2dnbGVEcm9wSW50b1Byb21wdChzaG93aW5nOiBib29sZWFuKSB7XG5cdFx0aWYgKCF0aGlzLmRyb3BJbnRvUHJvbXB0RWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmRyb3BJbnRvUHJvbXB0RWxlbWVudC5zdHlsZS5vcGFjaXR5ID0gc2hvd2luZyA/ICcxJyA6ICcwJztcblx0fVxuXG5cdGNvbnRhaW5zKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGVsZW1lbnQgPT09IHRoaXMuY29udGFpbmVyIHx8IGVsZW1lbnQgPT09IHRoaXMub3ZlcmxheTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5fZGlzcG9zZWQgPSB0cnVlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFZGl0b3JEcm9wVGFyZ2V0IGV4dGVuZHMgVGhlbWFibGUge1xuXG5cdHByaXZhdGUgX292ZXJsYXk/OiBEcm9wT3ZlcmxheTtcblxuXHRwcml2YXRlIGNvdW50ZXIgPSAwO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yVHJhbnNmZXIgPSBMb2NhbFNlbGVjdGlvblRyYW5zZmVyLmdldEluc3RhbmNlPERyYWdnZWRFZGl0b3JJZGVudGlmaWVyPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGdyb3VwVHJhbnNmZXIgPSBMb2NhbFNlbGVjdGlvblRyYW5zZmVyLmdldEluc3RhbmNlPERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXI+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGVsZWdhdGU6IElFZGl0b3JEcm9wVGFyZ2V0RGVsZWdhdGUsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIodGhlbWVTZXJ2aWNlKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IG92ZXJsYXkoKTogRHJvcE92ZXJsYXkgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9vdmVybGF5ICYmICF0aGlzLl9vdmVybGF5LmRpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fb3ZlcmxheTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5EUkFHX0VOVEVSLCBlID0+IHRoaXMub25EcmFnRW50ZXIoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5EUkFHX0xFQVZFLCAoKSA9PiB0aGlzLm9uRHJhZ0xlYXZlKCkpKTtcblx0XHRmb3IgKGNvbnN0IHRhcmdldCBvZiBbdGhpcy5jb250YWluZXIsIGdldFdpbmRvdyh0aGlzLmNvbnRhaW5lcildKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGFyZ2V0LCBFdmVudFR5cGUuRFJBR19FTkQsICgpID0+IHRoaXMub25EcmFnRW5kKCkpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRHJhZ0VudGVyKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoaXNEcm9wSW50b0VkaXRvckVuYWJsZWRHbG9iYWxseSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSAmJiBpc0RyYWdJbnRvRWRpdG9yRXZlbnQoZXZlbnQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jb3VudGVyKys7XG5cblx0XHQvLyBWYWxpZGF0ZSB0cmFuc2ZlclxuXHRcdGlmIChcblx0XHRcdCF0aGlzLmVkaXRvclRyYW5zZmVyLmhhc0RhdGEoRHJhZ2dlZEVkaXRvcklkZW50aWZpZXIucHJvdG90eXBlKSAmJlxuXHRcdFx0IXRoaXMuZ3JvdXBUcmFuc2Zlci5oYXNEYXRhKERyYWdnZWRFZGl0b3JHcm91cElkZW50aWZpZXIucHJvdG90eXBlKSAmJlxuXHRcdFx0ZXZlbnQuZGF0YVRyYW5zZmVyXG5cdFx0KSB7XG5cdFx0XHRjb25zdCBkbmRDb250cmlidXRpb25zID0gUmVnaXN0cnkuYXM8SURyYWdBbmREcm9wQ29udHJpYnV0aW9uUmVnaXN0cnk+KERyYWdBbmREcm9wRXh0ZW5zaW9ucy5EcmFnQW5kRHJvcENvbnRyaWJ1dGlvbikuZ2V0QWxsKCk7XG5cdFx0XHRjb25zdCBkbmRDb250cmlidXRpb25LZXlzID0gQXJyYXkuZnJvbShkbmRDb250cmlidXRpb25zKS5tYXAoZSA9PiBlLmRhdGFGb3JtYXRLZXkpO1xuXHRcdFx0aWYgKCFjb250YWluc0RyYWdUeXBlKGV2ZW50LCBEYXRhVHJhbnNmZXJzLkZJTEVTLCBDb2RlRGF0YVRyYW5zZmVycy5GSUxFUywgRGF0YVRyYW5zZmVycy5SRVNPVVJDRVMsIENvZGVEYXRhVHJhbnNmZXJzLkVESVRPUlMsIC4uLmRuZENvbnRyaWJ1dGlvbktleXMpKSB7IC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjU3ODlcblx0XHRcdFx0ZXZlbnQuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnbm9uZSc7XG5cdFx0XHRcdHJldHVybjsgLy8gdW5zdXBwb3J0ZWQgdHJhbnNmZXJcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTaWduYWwgRE5EIHN0YXJ0XG5cdFx0dGhpcy51cGRhdGVDb250YWluZXIodHJ1ZSk7XG5cblx0XHRjb25zdCB0YXJnZXQgPSBldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0aWYgKHRhcmdldCkge1xuXG5cdFx0XHQvLyBTb21laG93IHdlIG1hbmFnZWQgdG8gbW92ZSB0aGUgbW91c2UgcXVpY2tseSBvdXQgb2YgdGhlIGN1cnJlbnQgb3ZlcmxheSwgc28gZGVzdHJveSBpdFxuXHRcdFx0aWYgKHRoaXMub3ZlcmxheSAmJiAhdGhpcy5vdmVybGF5LmNvbnRhaW5zKHRhcmdldCkpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlT3ZlcmxheSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDcmVhdGUgb3ZlcmxheSBvdmVyIHRhcmdldFxuXHRcdFx0aWYgKCF0aGlzLm92ZXJsYXkpIHtcblx0XHRcdFx0Y29uc3QgdGFyZ2V0R3JvdXBWaWV3ID0gdGhpcy5maW5kVGFyZ2V0R3JvdXBWaWV3KHRhcmdldCk7XG5cdFx0XHRcdGlmICh0YXJnZXRHcm91cFZpZXcpIHtcblx0XHRcdFx0XHR0aGlzLl9vdmVybGF5ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEcm9wT3ZlcmxheSwgdGFyZ2V0R3JvdXBWaWV3KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EcmFnTGVhdmUoKTogdm9pZCB7XG5cdFx0dGhpcy5jb3VudGVyLS07XG5cblx0XHRpZiAodGhpcy5jb3VudGVyID09PSAwKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUNvbnRhaW5lcihmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRyYWdFbmQoKTogdm9pZCB7XG5cdFx0dGhpcy5jb3VudGVyID0gMDtcblxuXHRcdHRoaXMudXBkYXRlQ29udGFpbmVyKGZhbHNlKTtcblx0XHR0aGlzLmRpc3Bvc2VPdmVybGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRUYXJnZXRHcm91cFZpZXcoY2hpbGQ6IEhUTUxFbGVtZW50KTogSUVkaXRvckdyb3VwVmlldyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZ3JvdXBzID0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuZ3JvdXBzIGFzIElFZGl0b3JHcm91cFZpZXdbXTtcblxuXHRcdHJldHVybiBncm91cHMuZmluZChncm91cFZpZXcgPT4gaXNBbmNlc3RvcihjaGlsZCwgZ3JvdXBWaWV3LmVsZW1lbnQpIHx8IHRoaXMuZGVsZWdhdGUuY29udGFpbnNHcm91cD8uKGdyb3VwVmlldykpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb250YWluZXIoaXNEcmFnZ2VkT3ZlcjogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2RyYWdnZWQtb3ZlcicsIGlzRHJhZ2dlZE92ZXIpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLmRpc3Bvc2VPdmVybGF5KCk7XG5cdH1cblxuXHRwcml2YXRlIGRpc3Bvc2VPdmVybGF5KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLm92ZXJsYXkpIHtcblx0XHRcdHRoaXMub3ZlcmxheS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9vdmVybGF5ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxHQUFHLHVCQUF1QixxQkFBcUIsYUFBYSxXQUFXLFdBQVcsa0JBQWtCO0FBQzdHLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsYUFBYSxhQUFhO0FBQ25DLFNBQVMsa0JBQWtCLHVCQUF1QjtBQUNsRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGVBQWUsZ0JBQWdCO0FBQ3hDLFNBQVMsc0JBQXNCLGdDQUFnQztBQUMvRCxTQUFTLG1CQUFtQixrQkFBa0IsY0FBYyx1QkFB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
