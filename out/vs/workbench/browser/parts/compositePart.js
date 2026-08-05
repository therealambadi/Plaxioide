import "./media/compositepart.css";
import { localize } from "../../../nls.js";
import { defaultGenerator } from "../../../base/common/idGenerator.js";
import { dispose, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { Emitter } from "../../../base/common/event.js";
import { isCancellationError } from "../../../base/common/errors.js";
import { ActionsOrientation, prepareActions } from "../../../base/browser/ui/actionbar/actionbar.js";
import { ProgressBar } from "../../../base/browser/ui/progressbar/progressbar.js";
import { Part } from "../part.js";
import { StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { ServiceCollection } from "../../../platform/instantiation/common/serviceCollection.js";
import { IEditorProgressService } from "../../../platform/progress/common/progress.js";
import { Dimension, append, $, hide, show } from "../../../base/browser/dom.js";
import { AnchorAlignment } from "../../../base/browser/ui/contextview/contextview.js";
import { assertIsDefined } from "../../../base/common/types.js";
import { createActionViewItem } from "../../../platform/actions/browser/menuEntryActionViewItem.js";
import { AbstractProgressScope, ScopedProgressIndicator } from "../../services/progress/browser/progressIndicator.js";
import { WorkbenchToolBar } from "../../../platform/actions/browser/toolbar.js";
import { defaultProgressBarStyles } from "../../../platform/theme/browser/defaultStyles.js";
import { createInstantHoverDelegate, getDefaultHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegateFactory.js";
class CompositePart extends Part {
  constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, registry, activeCompositeSettingsKey, defaultCompositeId, nameForTelemetry, compositeCSSClass, titleForegroundColor, titleBorderColor, id, options) {
    super(id, options, themeService, storageService, layoutService);
    this.notificationService = notificationService;
    this.storageService = storageService;
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.hoverService = hoverService;
    this.instantiationService = instantiationService;
    this.registry = registry;
    this.activeCompositeSettingsKey = activeCompositeSettingsKey;
    this.defaultCompositeId = defaultCompositeId;
    this.nameForTelemetry = nameForTelemetry;
    this.compositeCSSClass = compositeCSSClass;
    this.titleForegroundColor = titleForegroundColor;
    this.titleBorderColor = titleBorderColor;
    this.onDidCompositeOpen = this._register(new Emitter());
    this.onDidCompositeClose = this._register(new Emitter());
    this.mapCompositeToCompositeContainer = /* @__PURE__ */ new Map();
    this.mapActionsBindingToComposite = /* @__PURE__ */ new Map();
    this.instantiatedCompositeItems = /* @__PURE__ */ new Map();
    this.actionsListener = this._register(new MutableDisposable());
    this.lastActiveCompositeId = storageService.get(activeCompositeSettingsKey, StorageScope.WORKSPACE, this.defaultCompositeId);
    this.toolbarHoverDelegate = this._register(createInstantHoverDelegate());
  }
  openComposite(id, focus) {
    if (this.activeComposite?.getId() === id) {
      if (focus) {
        this.activeComposite.focus();
      }
      return this.activeComposite;
    }
    if (!this.element) {
      return;
    }
    return this.doOpenComposite(id, focus);
  }
  doOpenComposite(id, focus = false) {
    const currentCompositeOpenToken = defaultGenerator.nextId();
    this.currentCompositeOpenToken = currentCompositeOpenToken;
    if (this.activeComposite) {
      this.hideActiveComposite();
    }
    this.updateTitle(id);
    const composite = this.createComposite(id, true);
    if (this.currentCompositeOpenToken !== currentCompositeOpenToken || this.activeComposite && this.activeComposite.getId() !== composite.getId()) {
      return void 0;
    }
    if (this.activeComposite?.getId() === composite.getId()) {
      if (focus) {
        composite.focus();
      }
      this.onDidCompositeOpen.fire({ composite, focus });
      return composite;
    }
    this.showComposite(composite);
    if (focus) {
      composite.focus();
    }
    if (composite) {
      this.onDidCompositeOpen.fire({ composite, focus });
    }
    return composite;
  }
  createComposite(id, isActive) {
    const compositeItem = this.instantiatedCompositeItems.get(id);
    if (compositeItem) {
      return compositeItem.composite;
    }
    const compositeDescriptor = this.registry.getComposite(id);
    if (compositeDescriptor) {
      const that = this;
      const compositeProgressIndicator = new ScopedProgressIndicator(assertIsDefined(this.progressBar), new class extends AbstractProgressScope {
        constructor() {
          super(compositeDescriptor.id, !!isActive);
          this._register(that.onDidCompositeOpen.event((e) => this.onScopeOpened(e.composite.getId())));
          this._register(that.onDidCompositeClose.event((e) => this.onScopeClosed(e.getId())));
        }
      }());
      const compositeInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection(
        [IEditorProgressService, compositeProgressIndicator]
        // provide the editor progress service for any editors instantiated within the composite
      )));
      const composite = compositeDescriptor.instantiate(compositeInstantiationService);
      const disposable = new DisposableStore();
      this.instantiatedCompositeItems.set(id, { composite, disposable, progress: compositeProgressIndicator });
      disposable.add(composite.onTitleAreaUpdate(() => this.onTitleAreaUpdate(composite.getId()), this));
      disposable.add(compositeInstantiationService);
      return composite;
    }
    throw new Error(`Unable to find composite with id ${id}`);
  }
  showComposite(composite) {
    this.activeComposite = composite;
    const id = this.activeComposite.getId();
    if (id !== this.defaultCompositeId) {
      this.storageService.store(this.activeCompositeSettingsKey, id, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(this.activeCompositeSettingsKey, StorageScope.WORKSPACE);
    }
    this.lastActiveCompositeId = this.activeComposite.getId();
    let compositeContainer = this.mapCompositeToCompositeContainer.get(composite.getId());
    if (!compositeContainer) {
      compositeContainer = $(".composite");
      compositeContainer.classList.add(...this.compositeCSSClass.split(" "));
      compositeContainer.id = composite.getId();
      composite.create(compositeContainer);
      composite.updateStyles();
      this.mapCompositeToCompositeContainer.set(composite.getId(), compositeContainer);
    }
    if (!this.activeComposite || composite.getId() !== this.activeComposite.getId()) {
      return void 0;
    }
    const contentArea = this.getContentArea();
    contentArea?.appendChild(compositeContainer);
    show(compositeContainer);
    const toolBar = assertIsDefined(this.toolBar);
    toolBar.actionRunner = composite.getActionRunner();
    const descriptor = this.registry.getComposite(composite.getId());
    if (descriptor && descriptor.name !== composite.getTitle()) {
      this.updateTitle(composite.getId(), composite.getTitle());
    }
    let actionsBinding = this.mapActionsBindingToComposite.get(composite.getId());
    if (!actionsBinding) {
      actionsBinding = this.collectCompositeActions(composite);
      this.mapActionsBindingToComposite.set(composite.getId(), actionsBinding);
    }
    actionsBinding();
    this.actionsListener.value = toolBar.actionRunner.onDidRun((e) => {
      if (e.error && !isCancellationError(e.error)) {
        this.notificationService.error(e.error);
      }
    });
    composite.setVisible(true);
    if (!this.activeComposite || composite.getId() !== this.activeComposite.getId()) {
      return;
    }
    if (this.contentAreaSize) {
      composite.layout(this.contentAreaSize);
    }
    if (this.boundarySashes) {
      composite.setBoundarySashes(this.boundarySashes);
    }
  }
  onTitleAreaUpdate(compositeId) {
    const composite = this.instantiatedCompositeItems.get(compositeId);
    if (composite) {
      this.updateTitle(compositeId, composite.composite.getTitle());
    }
    if (this.activeComposite?.getId() === compositeId) {
      const actionsBinding = this.collectCompositeActions(this.activeComposite);
      this.mapActionsBindingToComposite.set(this.activeComposite.getId(), actionsBinding);
      actionsBinding();
    } else {
      this.mapActionsBindingToComposite.delete(compositeId);
    }
  }
  updateTitle(compositeId, compositeTitle) {
    const compositeDescriptor = this.registry.getComposite(compositeId);
    if (!compositeDescriptor || !this.titleLabel) {
      return;
    }
    if (!compositeTitle) {
      compositeTitle = compositeDescriptor.name;
    }
    const keybinding = this.keybindingService.lookupKeybinding(compositeId);
    this.titleLabel.updateTitle(compositeId, compositeTitle, keybinding?.getLabel() ?? void 0);
    const toolBar = assertIsDefined(this.toolBar);
    toolBar.setAriaLabel(localize("ariaCompositeToolbarLabel", "{0} actions", compositeTitle));
  }
  collectCompositeActions(composite) {
    const menuIds = composite?.getMenuIds();
    const primaryActions = composite?.getActions().slice(0) || [];
    const secondaryActions = composite?.getSecondaryActions().slice(0) || [];
    const toolBar = assertIsDefined(this.toolBar);
    toolBar.context = this.actionsContextProvider();
    return () => toolBar.setActions(prepareActions(primaryActions), prepareActions(secondaryActions), menuIds);
  }
  getActiveComposite() {
    return this.activeComposite;
  }
  getLastActiveCompositeId() {
    return this.lastActiveCompositeId;
  }
  hideActiveComposite() {
    if (!this.activeComposite) {
      return void 0;
    }
    const composite = this.activeComposite;
    this.activeComposite = void 0;
    const compositeContainer = this.mapCompositeToCompositeContainer.get(composite.getId());
    composite.setVisible(false);
    if (compositeContainer) {
      compositeContainer.remove();
      hide(compositeContainer);
    }
    this.progressBar?.stop().hide();
    if (this.toolBar) {
      this.collectCompositeActions()();
    }
    this.onDidCompositeClose.fire(composite);
    return composite;
  }
  createTitleArea(parent) {
    const titleArea = append(parent, $(".composite"));
    titleArea.classList.add("title");
    this.titleLabel = this.createTitleLabel(titleArea);
    const titleActionsContainer = append(titleArea, $(".title-actions"));
    this.toolBar = this._register(this.instantiationService.createInstance(WorkbenchToolBar, titleActionsContainer, {
      actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
      orientation: ActionsOrientation.HORIZONTAL,
      getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id),
      anchorAlignmentProvider: () => this.getTitleAreaDropDownAnchorAlignment(),
      toggleMenuTitle: localize("viewsAndMoreActions", "Views and More Actions..."),
      telemetrySource: this.nameForTelemetry,
      hoverDelegate: this.toolbarHoverDelegate
    }));
    this.collectCompositeActions()();
    return titleArea;
  }
  createTitleLabel(parent) {
    const titleContainer = append(parent, $(".title-label"));
    const titleLabel = append(titleContainer, $("h2"));
    this.titleLabelElement = titleLabel;
    const hover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), titleLabel, ""));
    const $this = this;
    return {
      updateTitle: (id, title, keybinding) => {
        if (!this.activeComposite || this.activeComposite.getId() === id) {
          titleLabel.innerText = title;
          hover.update(keybinding ? localize("titleTooltip", "{0} ({1})", title, keybinding) : title);
        }
      },
      updateStyles: () => {
        titleLabel.style.color = $this.titleForegroundColor ? $this.getColor($this.titleForegroundColor) || "" : "";
        const borderColor = $this.titleBorderColor ? $this.getColor($this.titleBorderColor) : void 0;
        parent.style.borderBottom = borderColor ? `1px solid ${borderColor}` : "";
      }
    };
  }
  createHeaderArea() {
    return $(".composite");
  }
  createFooterArea() {
    return $(".composite");
  }
  updateStyles() {
    super.updateStyles();
    const titleLabel = assertIsDefined(this.titleLabel);
    titleLabel.updateStyles();
  }
  actionViewItemProvider(action, options) {
    if (this.activeComposite) {
      return this.activeComposite.getActionViewItem(action, options);
    }
    return createActionViewItem(this.instantiationService, action, options);
  }
  actionsContextProvider() {
    if (this.activeComposite) {
      return this.activeComposite.getActionsContext();
    }
    return null;
  }
  createContentArea(parent) {
    const contentContainer = append(parent, $(".content"));
    this.progressBar = this._register(new ProgressBar(contentContainer, defaultProgressBarStyles));
    this.progressBar.hide();
    return contentContainer;
  }
  getProgressIndicator(id) {
    const compositeItem = this.instantiatedCompositeItems.get(id);
    return compositeItem ? compositeItem.progress : void 0;
  }
  getTitleAreaDropDownAnchorAlignment() {
    return AnchorAlignment.RIGHT;
  }
  layout(width, height, top, left) {
    super.layout(width, height, top, left);
    this.contentAreaSize = Dimension.lift(super.layoutContents(width, height).contentSize);
    this.activeComposite?.layout(this.contentAreaSize);
  }
  setBoundarySashes(sashes) {
    this.boundarySashes = sashes;
    this.activeComposite?.setBoundarySashes(sashes);
  }
  removeComposite(compositeId) {
    if (this.activeComposite?.getId() === compositeId) {
      return false;
    }
    this.mapCompositeToCompositeContainer.delete(compositeId);
    this.mapActionsBindingToComposite.delete(compositeId);
    const compositeItem = this.instantiatedCompositeItems.get(compositeId);
    if (compositeItem) {
      compositeItem.composite.dispose();
      dispose(compositeItem.disposable);
      this.instantiatedCompositeItems.delete(compositeId);
    }
    return true;
  }
  dispose() {
    this.mapCompositeToCompositeContainer.clear();
    this.mapActionsBindingToComposite.clear();
    this.instantiatedCompositeItems.forEach((compositeItem) => {
      compositeItem.composite.dispose();
      dispose(compositeItem.disposable);
    });
    this.instantiatedCompositeItems.clear();
    super.dispose();
  }
}
export {
  CompositePart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9jb21wb3NpdGVQYXJ0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL2NvbXBvc2l0ZXBhcnQuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGRlZmF1bHRHZW5lcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9pZEdlbmVyYXRvci5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgQWN0aW9uc09yaWVudGF0aW9uLCBJQWN0aW9uVmlld0l0ZW0sIHByZXBhcmVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgUHJvZ3Jlc3NCYXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvcHJvZ3Jlc3NiYXIvcHJvZ3Jlc3NiYXIuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgUGFydCwgSVBhcnRPcHRpb25zIH0gZnJvbSAnLi4vcGFydC5qcyc7XG5pbXBvcnQgeyBDb21wb3NpdGUsIENvbXBvc2l0ZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElDb21wb3NpdGUgfSBmcm9tICcuLi8uLi9jb21tb24vY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc0luZGljYXRvciwgSUVkaXRvclByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgRGltZW5zaW9uLCBhcHBlbmQsICQsIGhpZGUsIHNob3cgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFuY2hvckFsaWdubWVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFByb2dyZXNzU2NvcGUsIFNjb3BlZFByb2dyZXNzSW5kaWNhdG9yIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvcHJvZ3Jlc3MvYnJvd3Nlci9wcm9ncmVzc0luZGljYXRvci5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgZGVmYXVsdFByb2dyZXNzQmFyU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IElCb3VuZGFyeVNhc2hlcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zYXNoL3Nhc2guanMnO1xuaW1wb3J0IHsgSUJhc2VBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB7IGNyZWF0ZUluc3RhbnRIb3ZlckRlbGVnYXRlLCBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgdHlwZSB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJQ29tcG9zaXRlVGl0bGVMYWJlbCB7XG5cblx0LyoqXG5cdCAqIEFza3MgdG8gdXBkYXRlIHRoZSB0aXRsZSBmb3IgdGhlIGNvbXBvc2l0ZSB3aXRoIHRoZSBnaXZlbiBJRC5cblx0ICovXG5cdHVwZGF0ZVRpdGxlKGlkOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGtleWJpbmRpbmc/OiBzdHJpbmcpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2hlbiB0aGVtaW5nIGluZm9ybWF0aW9uIGNoYW5nZXMuXG5cdCAqL1xuXHR1cGRhdGVTdHlsZXMoKTogdm9pZDtcbn1cblxuaW50ZXJmYWNlIENvbXBvc2l0ZUl0ZW0ge1xuXHRyZWFkb25seSBjb21wb3NpdGU6IENvbXBvc2l0ZTtcblx0cmVhZG9ubHkgZGlzcG9zYWJsZTogSURpc3Bvc2FibGU7XG5cdHJlYWRvbmx5IHByb2dyZXNzOiBJUHJvZ3Jlc3NJbmRpY2F0b3I7XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBDb21wb3NpdGVQYXJ0PFQgZXh0ZW5kcyBDb21wb3NpdGU+IGV4dGVuZHMgUGFydCB7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IG9uRGlkQ29tcG9zaXRlT3BlbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgY29tcG9zaXRlOiBJQ29tcG9zaXRlOyBmb2N1czogYm9vbGVhbiB9PigpKTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IG9uRGlkQ29tcG9zaXRlQ2xvc2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ29tcG9zaXRlPigpKTtcblxuXHRwcm90ZWN0ZWQgdG9vbEJhcjogV29ya2JlbmNoVG9vbEJhciB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIHRpdGxlTGFiZWxFbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvb2xiYXJIb3ZlckRlbGVnYXRlOiBJSG92ZXJEZWxlZ2F0ZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1hcENvbXBvc2l0ZVRvQ29tcG9zaXRlQ29udGFpbmVyID0gbmV3IE1hcDxzdHJpbmcsIEhUTUxFbGVtZW50PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1hcEFjdGlvbnNCaW5kaW5nVG9Db21wb3NpdGUgPSBuZXcgTWFwPHN0cmluZywgKCkgPT4gdm9pZD4oKTtcblx0cHJpdmF0ZSBhY3RpdmVDb21wb3NpdGU6IENvbXBvc2l0ZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBsYXN0QWN0aXZlQ29tcG9zaXRlSWQ6IHN0cmluZztcblx0cHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0ZWRDb21wb3NpdGVJdGVtcyA9IG5ldyBNYXA8c3RyaW5nLCBDb21wb3NpdGVJdGVtPigpO1xuXHRwcm90ZWN0ZWQgdGl0bGVMYWJlbDogSUNvbXBvc2l0ZVRpdGxlTGFiZWwgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcHJvZ3Jlc3NCYXI6IFByb2dyZXNzQmFyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbnRlbnRBcmVhU2l6ZTogRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGlvbnNMaXN0ZW5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSBjdXJyZW50Q29tcG9zaXRlT3BlblRva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYm91bmRhcnlTYXNoZXM6IElCb3VuZGFyeVNhc2hlcyB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0bGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0dGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSByZWdpc3RyeTogQ29tcG9zaXRlUmVnaXN0cnk8VD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmVDb21wb3NpdGVTZXR0aW5nc0tleTogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGVmYXVsdENvbXBvc2l0ZUlkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBuYW1lRm9yVGVsZW1ldHJ5OiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb21wb3NpdGVDU1NDbGFzczogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGl0bGVGb3JlZ3JvdW5kQ29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRpdGxlQm9yZGVyQ29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRpZDogc3RyaW5nLFxuXHRcdG9wdGlvbnM6IElQYXJ0T3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcihpZCwgb3B0aW9ucywgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgbGF5b3V0U2VydmljZSk7XG5cblx0XHR0aGlzLmxhc3RBY3RpdmVDb21wb3NpdGVJZCA9IHN0b3JhZ2VTZXJ2aWNlLmdldChhY3RpdmVDb21wb3NpdGVTZXR0aW5nc0tleSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgdGhpcy5kZWZhdWx0Q29tcG9zaXRlSWQpO1xuXHRcdHRoaXMudG9vbGJhckhvdmVyRGVsZWdhdGUgPSB0aGlzLl9yZWdpc3RlcihjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSgpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvcGVuQ29tcG9zaXRlKGlkOiBzdHJpbmcsIGZvY3VzPzogYm9vbGVhbik6IENvbXBvc2l0ZSB8IHVuZGVmaW5lZCB7XG5cblx0XHQvLyBDaGVjayBpZiBjb21wb3NpdGUgYWxyZWFkeSB2aXNpYmxlIGFuZCBqdXN0IGZvY3VzIGluIHRoYXQgY2FzZVxuXHRcdGlmICh0aGlzLmFjdGl2ZUNvbXBvc2l0ZT8uZ2V0SWQoKSA9PT0gaWQpIHtcblx0XHRcdGlmIChmb2N1cykge1xuXHRcdFx0XHR0aGlzLmFjdGl2ZUNvbXBvc2l0ZS5mb2N1cygpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBGdWxsZmlsbCBwcm9taXNlIHdpdGggY29tcG9zaXRlIHRoYXQgaXMgYmVpbmcgb3BlbmVkXG5cdFx0XHRyZXR1cm4gdGhpcy5hY3RpdmVDb21wb3NpdGU7XG5cdFx0fVxuXG5cdFx0Ly8gV2UgY2Fubm90IG9wZW4gdGhlIGNvbXBvc2l0ZSBpZiB3ZSBoYXZlIG5vdCBiZWVuIGNyZWF0ZWQgeWV0XG5cdFx0aWYgKCF0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBPcGVuXG5cdFx0cmV0dXJuIHRoaXMuZG9PcGVuQ29tcG9zaXRlKGlkLCBmb2N1cyk7XG5cdH1cblxuXHRwcml2YXRlIGRvT3BlbkNvbXBvc2l0ZShpZDogc3RyaW5nLCBmb2N1czogYm9vbGVhbiA9IGZhbHNlKTogQ29tcG9zaXRlIHwgdW5kZWZpbmVkIHtcblxuXHRcdC8vIFVzZSBhIGdlbmVyYXRlZCB0b2tlbiB0byBhdm9pZCByYWNlIGNvbmRpdGlvbnMgZnJvbSBsb25nIHJ1bm5pbmcgcHJvbWlzZXNcblx0XHRjb25zdCBjdXJyZW50Q29tcG9zaXRlT3BlblRva2VuID0gZGVmYXVsdEdlbmVyYXRvci5uZXh0SWQoKTtcblx0XHR0aGlzLmN1cnJlbnRDb21wb3NpdGVPcGVuVG9rZW4gPSBjdXJyZW50Q29tcG9zaXRlT3BlblRva2VuO1xuXG5cdFx0Ly8gSGlkZSBjdXJyZW50XG5cdFx0aWYgKHRoaXMuYWN0aXZlQ29tcG9zaXRlKSB7XG5cdFx0XHR0aGlzLmhpZGVBY3RpdmVDb21wb3NpdGUoKTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgVGl0bGVcblx0XHR0aGlzLnVwZGF0ZVRpdGxlKGlkKTtcblxuXHRcdC8vIENyZWF0ZSBjb21wb3NpdGVcblx0XHRjb25zdCBjb21wb3NpdGUgPSB0aGlzLmNyZWF0ZUNvbXBvc2l0ZShpZCwgdHJ1ZSk7XG5cblx0XHQvLyBDaGVjayBpZiBhbm90aGVyIGNvbXBvc2l0ZSBvcGVuZWQgbWVhbndoaWxlIGFuZCByZXR1cm4gaW4gdGhhdCBjYXNlXG5cdFx0aWYgKCh0aGlzLmN1cnJlbnRDb21wb3NpdGVPcGVuVG9rZW4gIT09IGN1cnJlbnRDb21wb3NpdGVPcGVuVG9rZW4pIHx8ICh0aGlzLmFjdGl2ZUNvbXBvc2l0ZSAmJiB0aGlzLmFjdGl2ZUNvbXBvc2l0ZS5nZXRJZCgpICE9PSBjb21wb3NpdGUuZ2V0SWQoKSkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgaWYgY29tcG9zaXRlIGFscmVhZHkgdmlzaWJsZSBhbmQganVzdCBmb2N1cyBpbiB0aGF0IGNhc2Vcblx0XHRpZiAodGhpcy5hY3RpdmVDb21wb3NpdGU/LmdldElkKCkgPT09IGNvbXBvc2l0ZS5nZXRJZCgpKSB7XG5cdFx0XHRpZiAoZm9jdXMpIHtcblx0XHRcdFx0Y29tcG9zaXRlLmZvY3VzKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMub25EaWRDb21wb3NpdGVPcGVuLmZpcmUoeyBjb21wb3NpdGUsIGZvY3VzIH0pO1xuXHRcdFx0cmV0dXJuIGNvbXBvc2l0ZTtcblx0XHR9XG5cblx0XHQvLyBTaG93IENvbXBvc2l0ZSBhbmQgRm9jdXNcblx0XHR0aGlzLnNob3dDb21wb3NpdGUoY29tcG9zaXRlKTtcblx0XHRpZiAoZm9jdXMpIHtcblx0XHRcdGNvbXBvc2l0ZS5mb2N1cygpO1xuXHRcdH1cblxuXHRcdC8vIFJldHVybiB3aXRoIHRoZSBjb21wb3NpdGUgdGhhdCBpcyBiZWluZyBvcGVuZWRcblx0XHRpZiAoY29tcG9zaXRlKSB7XG5cdFx0XHR0aGlzLm9uRGlkQ29tcG9zaXRlT3Blbi5maXJlKHsgY29tcG9zaXRlLCBmb2N1cyB9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY29tcG9zaXRlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUNvbXBvc2l0ZShpZDogc3RyaW5nLCBpc0FjdGl2ZT86IGJvb2xlYW4pOiBDb21wb3NpdGUge1xuXG5cdFx0Ly8gQ2hlY2sgaWYgY29tcG9zaXRlIGlzIGFscmVhZHkgY3JlYXRlZFxuXHRcdGNvbnN0IGNvbXBvc2l0ZUl0ZW0gPSB0aGlzLmluc3RhbnRpYXRlZENvbXBvc2l0ZUl0ZW1zLmdldChpZCk7XG5cdFx0aWYgKGNvbXBvc2l0ZUl0ZW0pIHtcblx0XHRcdHJldHVybiBjb21wb3NpdGVJdGVtLmNvbXBvc2l0ZTtcblx0XHR9XG5cblx0XHQvLyBJbnN0YW50aWF0ZSBjb21wb3NpdGUgZnJvbSByZWdpc3RyeSBvdGhlcndpc2Vcblx0XHRjb25zdCBjb21wb3NpdGVEZXNjcmlwdG9yID0gdGhpcy5yZWdpc3RyeS5nZXRDb21wb3NpdGUoaWQpO1xuXHRcdGlmIChjb21wb3NpdGVEZXNjcmlwdG9yKSB7XG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdGNvbnN0IGNvbXBvc2l0ZVByb2dyZXNzSW5kaWNhdG9yID0gbmV3IFNjb3BlZFByb2dyZXNzSW5kaWNhdG9yKGFzc2VydElzRGVmaW5lZCh0aGlzLnByb2dyZXNzQmFyKSwgbmV3IGNsYXNzIGV4dGVuZHMgQWJzdHJhY3RQcm9ncmVzc1Njb3BlIHtcblx0XHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdFx0c3VwZXIoY29tcG9zaXRlRGVzY3JpcHRvciEuaWQsICEhaXNBY3RpdmUpO1xuXHRcdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoYXQub25EaWRDb21wb3NpdGVPcGVuLmV2ZW50KGUgPT4gdGhpcy5vblNjb3BlT3BlbmVkKGUuY29tcG9zaXRlLmdldElkKCkpKSk7XG5cdFx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhhdC5vbkRpZENvbXBvc2l0ZUNsb3NlLmV2ZW50KGUgPT4gdGhpcy5vblNjb3BlQ2xvc2VkKGUuZ2V0SWQoKSkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSgpKTtcblx0XHRcdGNvbnN0IGNvbXBvc2l0ZUluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRcdFtJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLCBjb21wb3NpdGVQcm9ncmVzc0luZGljYXRvcl0gLy8gcHJvdmlkZSB0aGUgZWRpdG9yIHByb2dyZXNzIHNlcnZpY2UgZm9yIGFueSBlZGl0b3JzIGluc3RhbnRpYXRlZCB3aXRoaW4gdGhlIGNvbXBvc2l0ZVxuXHRcdFx0KSkpO1xuXG5cdFx0XHRjb25zdCBjb21wb3NpdGUgPSBjb21wb3NpdGVEZXNjcmlwdG9yLmluc3RhbnRpYXRlKGNvbXBvc2l0ZUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdC8vIFJlbWVtYmVyIGFzIEluc3RhbnRpYXRlZFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0ZWRDb21wb3NpdGVJdGVtcy5zZXQoaWQsIHsgY29tcG9zaXRlLCBkaXNwb3NhYmxlLCBwcm9ncmVzczogY29tcG9zaXRlUHJvZ3Jlc3NJbmRpY2F0b3IgfSk7XG5cblx0XHRcdC8vIFJlZ2lzdGVyIHRvIHRpdGxlIGFyZWEgdXBkYXRlIGV2ZW50cyBmcm9tIHRoZSBjb21wb3NpdGVcblx0XHRcdGRpc3Bvc2FibGUuYWRkKGNvbXBvc2l0ZS5vblRpdGxlQXJlYVVwZGF0ZSgoKSA9PiB0aGlzLm9uVGl0bGVBcmVhVXBkYXRlKGNvbXBvc2l0ZS5nZXRJZCgpKSwgdGhpcykpO1xuXHRcdFx0ZGlzcG9zYWJsZS5hZGQoY29tcG9zaXRlSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRyZXR1cm4gY29tcG9zaXRlO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGZpbmQgY29tcG9zaXRlIHdpdGggaWQgJHtpZH1gKTtcblx0fVxuXG5cdHByb3RlY3RlZCBzaG93Q29tcG9zaXRlKGNvbXBvc2l0ZTogQ29tcG9zaXRlKTogdm9pZCB7XG5cblx0XHQvLyBSZW1lbWJlciBDb21wb3NpdGVcblx0XHR0aGlzLmFjdGl2ZUNvbXBvc2l0ZSA9IGNvbXBvc2l0ZTtcblxuXHRcdC8vIFN0b3JlIGluIHByZWZlcmVuY2VzXG5cdFx0Y29uc3QgaWQgPSB0aGlzLmFjdGl2ZUNvbXBvc2l0ZS5nZXRJZCgpO1xuXHRcdGlmIChpZCAhPT0gdGhpcy5kZWZhdWx0Q29tcG9zaXRlSWQpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUodGhpcy5hY3RpdmVDb21wb3NpdGVTZXR0aW5nc0tleSwgaWQsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKHRoaXMuYWN0aXZlQ29tcG9zaXRlU2V0dGluZ3NLZXksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdH1cblxuXHRcdC8vIFJlbWVtYmVyXG5cdFx0dGhpcy5sYXN0QWN0aXZlQ29tcG9zaXRlSWQgPSB0aGlzLmFjdGl2ZUNvbXBvc2l0ZS5nZXRJZCgpO1xuXG5cdFx0Ly8gQ29tcG9zaXRlcyBjcmVhdGVkIGZvciB0aGUgZmlyc3QgdGltZVxuXHRcdGxldCBjb21wb3NpdGVDb250YWluZXIgPSB0aGlzLm1hcENvbXBvc2l0ZVRvQ29tcG9zaXRlQ29udGFpbmVyLmdldChjb21wb3NpdGUuZ2V0SWQoKSk7XG5cdFx0aWYgKCFjb21wb3NpdGVDb250YWluZXIpIHtcblxuXHRcdFx0Ly8gQnVpbGQgQ29udGFpbmVyIG9mZi1ET01cblx0XHRcdGNvbXBvc2l0ZUNvbnRhaW5lciA9ICQoJy5jb21wb3NpdGUnKTtcblx0XHRcdGNvbXBvc2l0ZUNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKC4uLnRoaXMuY29tcG9zaXRlQ1NTQ2xhc3Muc3BsaXQoJyAnKSk7XG5cdFx0XHRjb21wb3NpdGVDb250YWluZXIuaWQgPSBjb21wb3NpdGUuZ2V0SWQoKTtcblxuXHRcdFx0Y29tcG9zaXRlLmNyZWF0ZShjb21wb3NpdGVDb250YWluZXIpO1xuXHRcdFx0Y29tcG9zaXRlLnVwZGF0ZVN0eWxlcygpO1xuXG5cdFx0XHQvLyBSZW1lbWJlciBjb21wb3NpdGUgY29udGFpbmVyXG5cdFx0XHR0aGlzLm1hcENvbXBvc2l0ZVRvQ29tcG9zaXRlQ29udGFpbmVyLnNldChjb21wb3NpdGUuZ2V0SWQoKSwgY29tcG9zaXRlQ29udGFpbmVyKTtcblx0XHR9XG5cblx0XHQvLyBGaWxsIENvbnRlbnQgYW5kIEFjdGlvbnNcblx0XHQvLyBNYWtlIHN1cmUgdGhhdCB0aGUgdXNlciBtZWFud2hpbGUgZGlkIG5vdCBvcGVuIGFub3RoZXIgY29tcG9zaXRlIG9yIGNsb3NlZCB0aGUgcGFydCBjb250YWluaW5nIHRoZSBjb21wb3NpdGVcblx0XHRpZiAoIXRoaXMuYWN0aXZlQ29tcG9zaXRlIHx8IGNvbXBvc2l0ZS5nZXRJZCgpICE9PSB0aGlzLmFjdGl2ZUNvbXBvc2l0ZS5nZXRJZCgpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIFRha2UgQ29tcG9zaXRlIG9uLURPTSBhbmQgc2hvd1xuXHRcdGNvbnN0IGNvbnRlbnRBcmVhID0gdGhpcy5nZXRDb250ZW50QXJlYSgpO1xuXHRcdGNvbnRlbnRBcmVhPy5hcHBlbmRDaGlsZChjb21wb3NpdGVDb250YWluZXIpO1xuXHRcdHNob3coY29tcG9zaXRlQ29udGFpbmVyKTtcblxuXHRcdC8vIFNldHVwIGFjdGlvbiBydW5uZXJcblx0XHRjb25zdCB0b29sQmFyID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMudG9vbEJhcik7XG5cdFx0dG9vbEJhci5hY3Rpb25SdW5uZXIgPSBjb21wb3NpdGUuZ2V0QWN0aW9uUnVubmVyKCk7XG5cblx0XHQvLyBVcGRhdGUgdGl0bGUgd2l0aCBjb21wb3NpdGUgdGl0bGUgaWYgaXQgZGlmZmVycyBmcm9tIGRlc2NyaXB0b3Jcblx0XHRjb25zdCBkZXNjcmlwdG9yID0gdGhpcy5yZWdpc3RyeS5nZXRDb21wb3NpdGUoY29tcG9zaXRlLmdldElkKCkpO1xuXHRcdGlmIChkZXNjcmlwdG9yICYmIGRlc2NyaXB0b3IubmFtZSAhPT0gY29tcG9zaXRlLmdldFRpdGxlKCkpIHtcblx0XHRcdHRoaXMudXBkYXRlVGl0bGUoY29tcG9zaXRlLmdldElkKCksIGNvbXBvc2l0ZS5nZXRUaXRsZSgpKTtcblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgQ29tcG9zaXRlIEFjdGlvbnNcblx0XHRsZXQgYWN0aW9uc0JpbmRpbmcgPSB0aGlzLm1hcEFjdGlvbnNCaW5kaW5nVG9Db21wb3NpdGUuZ2V0KGNvbXBvc2l0ZS5nZXRJZCgpKTtcblx0XHRpZiAoIWFjdGlvbnNCaW5kaW5nKSB7XG5cdFx0XHRhY3Rpb25zQmluZGluZyA9IHRoaXMuY29sbGVjdENvbXBvc2l0ZUFjdGlvbnMoY29tcG9zaXRlKTtcblx0XHRcdHRoaXMubWFwQWN0aW9uc0JpbmRpbmdUb0NvbXBvc2l0ZS5zZXQoY29tcG9zaXRlLmdldElkKCksIGFjdGlvbnNCaW5kaW5nKTtcblx0XHR9XG5cdFx0YWN0aW9uc0JpbmRpbmcoKTtcblxuXHRcdC8vIEFjdGlvbiBSdW4gSGFuZGxpbmdcblx0XHR0aGlzLmFjdGlvbnNMaXN0ZW5lci52YWx1ZSA9IHRvb2xCYXIuYWN0aW9uUnVubmVyLm9uRGlkUnVuKGUgPT4ge1xuXG5cdFx0XHQvLyBDaGVjayBmb3IgRXJyb3Jcblx0XHRcdGlmIChlLmVycm9yICYmICFpc0NhbmNlbGxhdGlvbkVycm9yKGUuZXJyb3IpKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlLmVycm9yKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIEluZGljYXRlIHRvIGNvbXBvc2l0ZSB0aGF0IGl0IGlzIG5vdyB2aXNpYmxlXG5cdFx0Y29tcG9zaXRlLnNldFZpc2libGUodHJ1ZSk7XG5cblx0XHQvLyBNYWtlIHN1cmUgdGhhdCB0aGUgdXNlciBtZWFud2hpbGUgZGlkIG5vdCBvcGVuIGFub3RoZXIgY29tcG9zaXRlIG9yIGNsb3NlZCB0aGUgcGFydCBjb250YWluaW5nIHRoZSBjb21wb3NpdGVcblx0XHRpZiAoIXRoaXMuYWN0aXZlQ29tcG9zaXRlIHx8IGNvbXBvc2l0ZS5nZXRJZCgpICE9PSB0aGlzLmFjdGl2ZUNvbXBvc2l0ZS5nZXRJZCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gTWFrZSBzdXJlIHRoZSBjb21wb3NpdGUgaXMgbGF5ZWQgb3V0XG5cdFx0aWYgKHRoaXMuY29udGVudEFyZWFTaXplKSB7XG5cdFx0XHRjb21wb3NpdGUubGF5b3V0KHRoaXMuY29udGVudEFyZWFTaXplKTtcblx0XHR9XG5cblx0XHQvLyBNYWtlIHN1cmUgYm91bmRhcnkgc2FzaGVzIGFyZSBwcm9wYWdhdGVkXG5cdFx0aWYgKHRoaXMuYm91bmRhcnlTYXNoZXMpIHtcblx0XHRcdGNvbXBvc2l0ZS5zZXRCb3VuZGFyeVNhc2hlcyh0aGlzLmJvdW5kYXJ5U2FzaGVzKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb25UaXRsZUFyZWFVcGRhdGUoY29tcG9zaXRlSWQ6IHN0cmluZyk6IHZvaWQge1xuXG5cdFx0Ly8gVGl0bGVcblx0XHRjb25zdCBjb21wb3NpdGUgPSB0aGlzLmluc3RhbnRpYXRlZENvbXBvc2l0ZUl0ZW1zLmdldChjb21wb3NpdGVJZCk7XG5cdFx0aWYgKGNvbXBvc2l0ZSkge1xuXHRcdFx0dGhpcy51cGRhdGVUaXRsZShjb21wb3NpdGVJZCwgY29tcG9zaXRlLmNvbXBvc2l0ZS5nZXRUaXRsZSgpKTtcblx0XHR9XG5cblx0XHQvLyBBY3RpdmUgQ29tcG9zaXRlXG5cdFx0aWYgKHRoaXMuYWN0aXZlQ29tcG9zaXRlPy5nZXRJZCgpID09PSBjb21wb3NpdGVJZCkge1xuXHRcdFx0Ly8gQWN0aW9uc1xuXHRcdFx0Y29uc3QgYWN0aW9uc0JpbmRpbmcgPSB0aGlzLmNvbGxlY3RDb21wb3NpdGVBY3Rpb25zKHRoaXMuYWN0aXZlQ29tcG9zaXRlKTtcblx0XHRcdHRoaXMubWFwQWN0aW9uc0JpbmRpbmdUb0NvbXBvc2l0ZS5zZXQodGhpcy5hY3RpdmVDb21wb3NpdGUuZ2V0SWQoKSwgYWN0aW9uc0JpbmRpbmcpO1xuXHRcdFx0YWN0aW9uc0JpbmRpbmcoKTtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UgaW52YWxpZGF0ZSBhY3Rpb25zIGJpbmRpbmcgZm9yIG5leHQgdGltZSB3aGVuIHRoZSBjb21wb3NpdGUgYmVjb21lcyB2aXNpYmxlXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLm1hcEFjdGlvbnNCaW5kaW5nVG9Db21wb3NpdGUuZGVsZXRlKGNvbXBvc2l0ZUlkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRpdGxlKGNvbXBvc2l0ZUlkOiBzdHJpbmcsIGNvbXBvc2l0ZVRpdGxlPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgY29tcG9zaXRlRGVzY3JpcHRvciA9IHRoaXMucmVnaXN0cnkuZ2V0Q29tcG9zaXRlKGNvbXBvc2l0ZUlkKTtcblx0XHRpZiAoIWNvbXBvc2l0ZURlc2NyaXB0b3IgfHwgIXRoaXMudGl0bGVMYWJlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghY29tcG9zaXRlVGl0bGUpIHtcblx0XHRcdGNvbXBvc2l0ZVRpdGxlID0gY29tcG9zaXRlRGVzY3JpcHRvci5uYW1lO1xuXHRcdH1cblxuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoY29tcG9zaXRlSWQpO1xuXG5cdFx0dGhpcy50aXRsZUxhYmVsLnVwZGF0ZVRpdGxlKGNvbXBvc2l0ZUlkLCBjb21wb3NpdGVUaXRsZSwga2V5YmluZGluZz8uZ2V0TGFiZWwoKSA/PyB1bmRlZmluZWQpO1xuXG5cdFx0Y29uc3QgdG9vbEJhciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLnRvb2xCYXIpO1xuXHRcdHRvb2xCYXIuc2V0QXJpYUxhYmVsKGxvY2FsaXplKCdhcmlhQ29tcG9zaXRlVG9vbGJhckxhYmVsJywgXCJ7MH0gYWN0aW9uc1wiLCBjb21wb3NpdGVUaXRsZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjb2xsZWN0Q29tcG9zaXRlQWN0aW9ucyhjb21wb3NpdGU/OiBDb21wb3NpdGUpOiAoKSA9PiB2b2lkIHtcblxuXHRcdC8vIEZyb20gQ29tcG9zaXRlXG5cdFx0Y29uc3QgbWVudUlkcyA9IGNvbXBvc2l0ZT8uZ2V0TWVudUlkcygpO1xuXHRcdGNvbnN0IHByaW1hcnlBY3Rpb25zOiBJQWN0aW9uW10gPSBjb21wb3NpdGU/LmdldEFjdGlvbnMoKS5zbGljZSgwKSB8fCBbXTtcblx0XHRjb25zdCBzZWNvbmRhcnlBY3Rpb25zOiBJQWN0aW9uW10gPSBjb21wb3NpdGU/LmdldFNlY29uZGFyeUFjdGlvbnMoKS5zbGljZSgwKSB8fCBbXTtcblxuXHRcdC8vIFVwZGF0ZSBjb250ZXh0XG5cdFx0Y29uc3QgdG9vbEJhciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLnRvb2xCYXIpO1xuXHRcdHRvb2xCYXIuY29udGV4dCA9IHRoaXMuYWN0aW9uc0NvbnRleHRQcm92aWRlcigpO1xuXG5cdFx0Ly8gUmV0dXJuIGZuIHRvIHNldCBpbnRvIHRvb2xiYXJcblx0XHRyZXR1cm4gKCkgPT4gdG9vbEJhci5zZXRBY3Rpb25zKHByZXBhcmVBY3Rpb25zKHByaW1hcnlBY3Rpb25zKSwgcHJlcGFyZUFjdGlvbnMoc2Vjb25kYXJ5QWN0aW9ucyksIG1lbnVJZHMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEFjdGl2ZUNvbXBvc2l0ZSgpOiBJQ29tcG9zaXRlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5hY3RpdmVDb21wb3NpdGU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0TGFzdEFjdGl2ZUNvbXBvc2l0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMubGFzdEFjdGl2ZUNvbXBvc2l0ZUlkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGhpZGVBY3RpdmVDb21wb3NpdGUoKTogQ29tcG9zaXRlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuYWN0aXZlQ29tcG9zaXRlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBOb3RoaW5nIHRvIGRvXG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tcG9zaXRlID0gdGhpcy5hY3RpdmVDb21wb3NpdGU7XG5cdFx0dGhpcy5hY3RpdmVDb21wb3NpdGUgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBjb21wb3NpdGVDb250YWluZXIgPSB0aGlzLm1hcENvbXBvc2l0ZVRvQ29tcG9zaXRlQ29udGFpbmVyLmdldChjb21wb3NpdGUuZ2V0SWQoKSk7XG5cblx0XHQvLyBJbmRpY2F0ZSB0byBDb21wb3NpdGVcblx0XHRjb21wb3NpdGUuc2V0VmlzaWJsZShmYWxzZSk7XG5cblx0XHQvLyBUYWtlIENvbnRhaW5lciBPZmYtRE9NIGFuZCBoaWRlXG5cdFx0aWYgKGNvbXBvc2l0ZUNvbnRhaW5lcikge1xuXHRcdFx0Y29tcG9zaXRlQ29udGFpbmVyLnJlbW92ZSgpO1xuXHRcdFx0aGlkZShjb21wb3NpdGVDb250YWluZXIpO1xuXHRcdH1cblxuXHRcdC8vIENsZWFyIGFueSBydW5uaW5nIFByb2dyZXNzXG5cdFx0dGhpcy5wcm9ncmVzc0Jhcj8uc3RvcCgpLmhpZGUoKTtcblxuXHRcdC8vIEVtcHR5IEFjdGlvbnNcblx0XHRpZiAodGhpcy50b29sQmFyKSB7XG5cdFx0XHR0aGlzLmNvbGxlY3RDb21wb3NpdGVBY3Rpb25zKCkoKTtcblx0XHR9XG5cdFx0dGhpcy5vbkRpZENvbXBvc2l0ZUNsb3NlLmZpcmUoY29tcG9zaXRlKTtcblxuXHRcdHJldHVybiBjb21wb3NpdGU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlVGl0bGVBcmVhKHBhcmVudDogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XG5cblx0XHQvLyBUaXRsZSBBcmVhIENvbnRhaW5lclxuXHRcdGNvbnN0IHRpdGxlQXJlYSA9IGFwcGVuZChwYXJlbnQsICQoJy5jb21wb3NpdGUnKSk7XG5cdFx0dGl0bGVBcmVhLmNsYXNzTGlzdC5hZGQoJ3RpdGxlJyk7XG5cblx0XHQvLyBMZWZ0IFRpdGxlIExhYmVsXG5cdFx0dGhpcy50aXRsZUxhYmVsID0gdGhpcy5jcmVhdGVUaXRsZUxhYmVsKHRpdGxlQXJlYSk7XG5cblx0XHQvLyBSaWdodCBBY3Rpb25zIENvbnRhaW5lclxuXHRcdGNvbnN0IHRpdGxlQWN0aW9uc0NvbnRhaW5lciA9IGFwcGVuZCh0aXRsZUFyZWEsICQoJy50aXRsZS1hY3Rpb25zJykpO1xuXG5cdFx0Ly8gVG9vbGJhclxuXHRcdHRoaXMudG9vbEJhciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoVG9vbEJhciwgdGl0bGVBY3Rpb25zQ29udGFpbmVyLCB7XG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB0aGlzLmFjdGlvblZpZXdJdGVtUHJvdmlkZXIoYWN0aW9uLCBvcHRpb25zKSxcblx0XHRcdG9yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcblx0XHRcdGdldEtleUJpbmRpbmc6IGFjdGlvbiA9PiB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKSxcblx0XHRcdGFuY2hvckFsaWdubWVudFByb3ZpZGVyOiAoKSA9PiB0aGlzLmdldFRpdGxlQXJlYURyb3BEb3duQW5jaG9yQWxpZ25tZW50KCksXG5cdFx0XHR0b2dnbGVNZW51VGl0bGU6IGxvY2FsaXplKCd2aWV3c0FuZE1vcmVBY3Rpb25zJywgXCJWaWV3cyBhbmQgTW9yZSBBY3Rpb25zLi4uXCIpLFxuXHRcdFx0dGVsZW1ldHJ5U291cmNlOiB0aGlzLm5hbWVGb3JUZWxlbWV0cnksXG5cdFx0XHRob3ZlckRlbGVnYXRlOiB0aGlzLnRvb2xiYXJIb3ZlckRlbGVnYXRlXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5jb2xsZWN0Q29tcG9zaXRlQWN0aW9ucygpKCk7XG5cblx0XHRyZXR1cm4gdGl0bGVBcmVhO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZVRpdGxlTGFiZWwocGFyZW50OiBIVE1MRWxlbWVudCk6IElDb21wb3NpdGVUaXRsZUxhYmVsIHtcblx0XHRjb25zdCB0aXRsZUNvbnRhaW5lciA9IGFwcGVuZChwYXJlbnQsICQoJy50aXRsZS1sYWJlbCcpKTtcblx0XHRjb25zdCB0aXRsZUxhYmVsID0gYXBwZW5kKHRpdGxlQ29udGFpbmVyLCAkKCdoMicpKTtcblx0XHR0aGlzLnRpdGxlTGFiZWxFbGVtZW50ID0gdGl0bGVMYWJlbDtcblx0XHRjb25zdCBob3ZlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0aXRsZUxhYmVsLCAnJykpO1xuXG5cdFx0Y29uc3QgJHRoaXMgPSB0aGlzO1xuXHRcdHJldHVybiB7XG5cdFx0XHR1cGRhdGVUaXRsZTogKGlkLCB0aXRsZSwga2V5YmluZGluZykgPT4ge1xuXHRcdFx0XHQvLyBUaGUgdGl0bGUgbGFiZWwgaXMgc2hhcmVkIGZvciBhbGwgY29tcG9zaXRlcyBpbiB0aGUgYmFzZSBDb21wb3NpdGVQYXJ0XG5cdFx0XHRcdGlmICghdGhpcy5hY3RpdmVDb21wb3NpdGUgfHwgdGhpcy5hY3RpdmVDb21wb3NpdGUuZ2V0SWQoKSA9PT0gaWQpIHtcblx0XHRcdFx0XHR0aXRsZUxhYmVsLmlubmVyVGV4dCA9IHRpdGxlO1xuXHRcdFx0XHRcdGhvdmVyLnVwZGF0ZShrZXliaW5kaW5nID8gbG9jYWxpemUoJ3RpdGxlVG9vbHRpcCcsIFwiezB9ICh7MX0pXCIsIHRpdGxlLCBrZXliaW5kaW5nKSA6IHRpdGxlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0dXBkYXRlU3R5bGVzOiAoKSA9PiB7XG5cdFx0XHRcdHRpdGxlTGFiZWwuc3R5bGUuY29sb3IgPSAkdGhpcy50aXRsZUZvcmVncm91bmRDb2xvciA/ICR0aGlzLmdldENvbG9yKCR0aGlzLnRpdGxlRm9yZWdyb3VuZENvbG9yKSB8fCAnJyA6ICcnO1xuXHRcdFx0XHRjb25zdCBib3JkZXJDb2xvciA9ICR0aGlzLnRpdGxlQm9yZGVyQ29sb3IgPyAkdGhpcy5nZXRDb2xvcigkdGhpcy50aXRsZUJvcmRlckNvbG9yKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0cGFyZW50LnN0eWxlLmJvcmRlckJvdHRvbSA9IGJvcmRlckNvbG9yID8gYDFweCBzb2xpZCAke2JvcmRlckNvbG9yfWAgOiAnJztcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUhlYWRlckFyZWEoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiAkKCcuY29tcG9zaXRlJyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlRm9vdGVyQXJlYSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuICQoJy5jb21wb3NpdGUnKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZVN0eWxlcygpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVTdHlsZXMoKTtcblxuXHRcdC8vIEZvcndhcmQgdG8gdGl0bGUgbGFiZWxcblx0XHRjb25zdCB0aXRsZUxhYmVsID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMudGl0bGVMYWJlbCk7XG5cdFx0dGl0bGVMYWJlbC51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyKGFjdGlvbjogSUFjdGlvbiwgb3B0aW9uczogSUJhc2VBY3Rpb25WaWV3SXRlbU9wdGlvbnMpOiBJQWN0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQge1xuXG5cdFx0Ly8gQ2hlY2sgQWN0aXZlIENvbXBvc2l0ZVxuXHRcdGlmICh0aGlzLmFjdGl2ZUNvbXBvc2l0ZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuYWN0aXZlQ29tcG9zaXRlLmdldEFjdGlvblZpZXdJdGVtKGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNyZWF0ZUFjdGlvblZpZXdJdGVtKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIGFjdGlvbiwgb3B0aW9ucyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWN0aW9uc0NvbnRleHRQcm92aWRlcigpOiB1bmtub3duIHtcblxuXHRcdC8vIENoZWNrIEFjdGl2ZSBDb21wb3NpdGVcblx0XHRpZiAodGhpcy5hY3RpdmVDb21wb3NpdGUpIHtcblx0XHRcdHJldHVybiB0aGlzLmFjdGl2ZUNvbXBvc2l0ZS5nZXRBY3Rpb25zQ29udGV4dCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGNyZWF0ZUNvbnRlbnRBcmVhKHBhcmVudDogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgY29udGVudENvbnRhaW5lciA9IGFwcGVuZChwYXJlbnQsICQoJy5jb250ZW50JykpO1xuXG5cdFx0dGhpcy5wcm9ncmVzc0JhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQcm9ncmVzc0Jhcihjb250ZW50Q29udGFpbmVyLCBkZWZhdWx0UHJvZ3Jlc3NCYXJTdHlsZXMpKTtcblx0XHR0aGlzLnByb2dyZXNzQmFyLmhpZGUoKTtcblxuXHRcdHJldHVybiBjb250ZW50Q29udGFpbmVyO1xuXHR9XG5cblx0Z2V0UHJvZ3Jlc3NJbmRpY2F0b3IoaWQ6IHN0cmluZyk6IElQcm9ncmVzc0luZGljYXRvciB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgY29tcG9zaXRlSXRlbSA9IHRoaXMuaW5zdGFudGlhdGVkQ29tcG9zaXRlSXRlbXMuZ2V0KGlkKTtcblxuXHRcdHJldHVybiBjb21wb3NpdGVJdGVtID8gY29tcG9zaXRlSXRlbS5wcm9ncmVzcyA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRUaXRsZUFyZWFEcm9wRG93bkFuY2hvckFsaWdubWVudCgpOiBBbmNob3JBbGlnbm1lbnQge1xuXHRcdHJldHVybiBBbmNob3JBbGlnbm1lbnQuUklHSFQ7XG5cdH1cblxuXHRvdmVycmlkZSBsYXlvdXQod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHRvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXQod2lkdGgsIGhlaWdodCwgdG9wLCBsZWZ0KTtcblxuXHRcdC8vIExheW91dCBjb250ZW50c1xuXHRcdHRoaXMuY29udGVudEFyZWFTaXplID0gRGltZW5zaW9uLmxpZnQoc3VwZXIubGF5b3V0Q29udGVudHMod2lkdGgsIGhlaWdodCkuY29udGVudFNpemUpO1xuXG5cdFx0Ly8gTGF5b3V0IGNvbXBvc2l0ZVxuXHRcdHRoaXMuYWN0aXZlQ29tcG9zaXRlPy5sYXlvdXQodGhpcy5jb250ZW50QXJlYVNpemUpO1xuXHR9XG5cblx0c2V0Qm91bmRhcnlTYXNoZXM/KHNhc2hlczogSUJvdW5kYXJ5U2FzaGVzKTogdm9pZCB7XG5cdFx0dGhpcy5ib3VuZGFyeVNhc2hlcyA9IHNhc2hlcztcblx0XHR0aGlzLmFjdGl2ZUNvbXBvc2l0ZT8uc2V0Qm91bmRhcnlTYXNoZXMoc2FzaGVzKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW1vdmVDb21wb3NpdGUoY29tcG9zaXRlSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmFjdGl2ZUNvbXBvc2l0ZT8uZ2V0SWQoKSA9PT0gY29tcG9zaXRlSWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gZG8gbm90IHJlbW92ZSBhY3RpdmUgY29tcG9zaXRlXG5cdFx0fVxuXG5cdFx0dGhpcy5tYXBDb21wb3NpdGVUb0NvbXBvc2l0ZUNvbnRhaW5lci5kZWxldGUoY29tcG9zaXRlSWQpO1xuXHRcdHRoaXMubWFwQWN0aW9uc0JpbmRpbmdUb0NvbXBvc2l0ZS5kZWxldGUoY29tcG9zaXRlSWQpO1xuXHRcdGNvbnN0IGNvbXBvc2l0ZUl0ZW0gPSB0aGlzLmluc3RhbnRpYXRlZENvbXBvc2l0ZUl0ZW1zLmdldChjb21wb3NpdGVJZCk7XG5cdFx0aWYgKGNvbXBvc2l0ZUl0ZW0pIHtcblx0XHRcdGNvbXBvc2l0ZUl0ZW0uY29tcG9zaXRlLmRpc3Bvc2UoKTtcblx0XHRcdGRpc3Bvc2UoY29tcG9zaXRlSXRlbS5kaXNwb3NhYmxlKTtcblx0XHRcdHRoaXMuaW5zdGFudGlhdGVkQ29tcG9zaXRlSXRlbXMuZGVsZXRlKGNvbXBvc2l0ZUlkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5tYXBDb21wb3NpdGVUb0NvbXBvc2l0ZUNvbnRhaW5lci5jbGVhcigpO1xuXHRcdHRoaXMubWFwQWN0aW9uc0JpbmRpbmdUb0NvbXBvc2l0ZS5jbGVhcigpO1xuXG5cdFx0dGhpcy5pbnN0YW50aWF0ZWRDb21wb3NpdGVJdGVtcy5mb3JFYWNoKGNvbXBvc2l0ZUl0ZW0gPT4ge1xuXHRcdFx0Y29tcG9zaXRlSXRlbS5jb21wb3NpdGUuZGlzcG9zZSgpO1xuXHRcdFx0ZGlzcG9zZShjb21wb3NpdGVJdGVtLmRpc3Bvc2FibGUpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5pbnN0YW50aWF0ZWRDb21wb3NpdGVJdGVtcy5jbGVhcigpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPO0FBQ1AsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3QkFBd0I7QUFDakMsU0FBc0IsU0FBUyxpQkFBaUIseUJBQTBCO0FBQzFFLFNBQVMsZUFBZTtBQUN4QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9CQUFxQyxzQkFBc0I7QUFDcEUsU0FBUyxtQkFBbUI7QUFFNUIsU0FBUyxZQUEwQjtBQUluQyxTQUEwQixjQUFjLHFCQUFxQjtBQUc3RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUE2Qiw4QkFBOEI7QUFJM0QsU0FBUyxXQUFXLFFBQVEsR0FBRyxNQUFNLFlBQVk7QUFDakQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw0QkFBNEI7QUFDckMs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
