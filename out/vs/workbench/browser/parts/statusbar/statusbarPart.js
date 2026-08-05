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
import "./media/statusbarpart.css";
import { localize } from "../../../../nls.js";
import { Disposable, DisposableStore, disposeIfDisposable, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { MultiWindowParts, Part } from "../../part.js";
import { EventType as TouchEventType, Gesture } from "../../../../base/browser/touch.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { StatusbarAlignment, IStatusbarService, isStatusbarEntryLocation, isStatusbarEntryPriority } from "../../../services/statusbar/browser/statusbar.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { Separator, toAction } from "../../../../base/common/actions.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { STATUS_BAR_BACKGROUND, STATUS_BAR_FOREGROUND, STATUS_BAR_NO_FOLDER_BACKGROUND, STATUS_BAR_ITEM_HOVER_BACKGROUND, STATUS_BAR_BORDER, STATUS_BAR_NO_FOLDER_FOREGROUND, STATUS_BAR_NO_FOLDER_BORDER, STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND, STATUS_BAR_ITEM_FOCUS_BORDER, STATUS_BAR_FOCUS_BORDER } from "../../../common/theme.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { contrastBorder, activeContrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { EventHelper, addDisposableListener, EventType, clearNode, getWindow, isHTMLElement, $ } from "../../../../base/browser/dom.js";
import { createStyleSheet } from "../../../../base/browser/domStylesheets.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { Parts, IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { equals } from "../../../../base/common/arrays.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { ToggleStatusbarVisibilityAction } from "../../actions/layoutActions.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { isHighContrast } from "../../../../platform/theme/common/theme.js";
import { hash } from "../../../../base/common/hash.js";
import { WorkbenchHoverDelegate } from "../../../../platform/hover/browser/hover.js";
import { HideStatusbarEntryAction, ManageExtensionAction, ToggleStatusbarEntryVisibilityAction } from "./statusbarActions.js";
import { StatusbarViewModel } from "./statusbarModel.js";
import { StatusbarEntryItem } from "./statusbarItem.js";
import { StatusBarFocused } from "../../../common/contextkeys.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { isManagedHoverTooltipHTMLElement, isManagedHoverTooltipMarkdownString } from "../../../../base/browser/ui/hover/hover.js";
let StatusbarPart = class extends Part {
  constructor(id, instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService) {
    super(id, { hasTitle: false }, themeService, storageService, layoutService);
    this.instantiationService = instantiationService;
    this.contextService = contextService;
    this.contextMenuService = contextMenuService;
    this.contextKeyService = contextKeyService;
    //#region IView
    this.minimumWidth = 0;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = StatusbarPart.HEIGHT;
    this.maximumHeight = StatusbarPart.HEIGHT;
    this.pendingEntries = [];
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this.onDidOverrideEntry = this._register(new Emitter());
    this.entryOverrides = /* @__PURE__ */ new Map();
    this.compactEntriesDisposable = this._register(new MutableDisposable());
    this.styleOverrides = /* @__PURE__ */ new Set();
    this.viewModel = this._register(new StatusbarViewModel(storageService));
    this.onDidChangeEntryVisibility = this.viewModel.onDidChangeEntryVisibility;
    this.hoverDelegate = this._register(this.instantiationService.createInstance(WorkbenchHoverDelegate, "element", {
      instantHover: true,
      dynamicDelay(content) {
        if (typeof content === "function" || isHTMLElement(content) || isManagedHoverTooltipMarkdownString(content) && typeof content.markdown === "function" || isManagedHoverTooltipHTMLElement(content)) {
          return 500;
        }
        return void 0;
      }
    }, (_, focus) => ({
      persistence: {
        hideOnKeyDown: true,
        sticky: focus
      }
    })));
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.onDidChangeEntryVisibility(() => this.updateCompactEntries()));
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.updateStyles()));
  }
  overrideEntry(id, override) {
    this.entryOverrides.set(id, override);
    this.onDidOverrideEntry.fire(id);
    return toDisposable(() => {
      const currentOverride = this.entryOverrides.get(id);
      if (currentOverride === override) {
        this.entryOverrides.delete(id);
        this.onDidOverrideEntry.fire(id);
      }
    });
  }
  withEntryOverride(entry, id) {
    const override = this.entryOverrides.get(id);
    if (override) {
      entry = { ...entry, ...override };
    }
    return entry;
  }
  addEntry(entry, id, alignment, priorityOrLocation = 0) {
    let priority;
    if (isStatusbarEntryPriority(priorityOrLocation)) {
      priority = priorityOrLocation;
    } else {
      priority = {
        primary: priorityOrLocation,
        secondary: hash(id)
        // derive from identifier to accomplish uniqueness
      };
    }
    if (!this.element) {
      return this.doAddPendingEntry(entry, id, alignment, priority);
    }
    return this.doAddEntry(entry, id, alignment, priority);
  }
  doAddPendingEntry(entry, id, alignment, priority) {
    const pendingEntry = { entry, id, alignment, priority };
    this.pendingEntries.push(pendingEntry);
    const accessor = {
      update: (entry2) => {
        if (pendingEntry.accessor) {
          pendingEntry.accessor.update(entry2);
        } else {
          pendingEntry.entry = entry2;
        }
      },
      dispose: () => {
        if (pendingEntry.accessor) {
          pendingEntry.accessor.dispose();
        } else {
          this.pendingEntries = this.pendingEntries.filter((entry2) => entry2 !== pendingEntry);
        }
      }
    };
    return accessor;
  }
  doAddEntry(entry, id, alignment, priority) {
    const disposables = new DisposableStore();
    const itemContainer = this.doCreateStatusItem(id, alignment);
    const item = disposables.add(this.instantiationService.createInstance(StatusbarEntryItem, itemContainer, this.withEntryOverride(entry, id), this.hoverDelegate));
    const viewModelEntry = new class {
      constructor() {
        this.id = id;
        this.extensionId = entry.extensionId;
        this.alignment = alignment;
        this.priority = priority;
        this.container = itemContainer;
        this.labelContainer = item.labelContainer;
      }
      get name() {
        return item.name;
      }
      get hasCommand() {
        return item.hasCommand;
      }
    }();
    const { needsFullRefresh } = this.doAddOrRemoveModelEntry(viewModelEntry, true);
    if (needsFullRefresh) {
      this.appendStatusbarEntries();
    } else {
      this.appendStatusbarEntry(viewModelEntry);
    }
    let lastEntry = entry;
    const accessor = {
      update: (entry2) => {
        lastEntry = entry2;
        item.update(this.withEntryOverride(entry2, id));
      },
      dispose: () => {
        const { needsFullRefresh: needsFullRefresh2 } = this.doAddOrRemoveModelEntry(viewModelEntry, false);
        if (needsFullRefresh2) {
          this.appendStatusbarEntries();
        } else {
          itemContainer.remove();
          this.updateCompactEntries();
        }
        disposables.dispose();
      }
    };
    disposables.add(this.onDidOverrideEntry.event((overrideEntryId) => {
      if (overrideEntryId === id) {
        accessor.update(lastEntry);
      }
    }));
    return accessor;
  }
  doCreateStatusItem(id, alignment, ...extraClasses) {
    const itemContainer = $(".statusbar-item", { id });
    if (extraClasses) {
      itemContainer.classList.add(...extraClasses);
    }
    if (alignment === StatusbarAlignment.RIGHT) {
      itemContainer.classList.add("right");
    } else {
      itemContainer.classList.add("left");
    }
    return itemContainer;
  }
  doAddOrRemoveModelEntry(entry, add) {
    const entriesBefore = this.viewModel.entries;
    if (add) {
      this.viewModel.add(entry);
    } else {
      this.viewModel.remove(entry);
    }
    const entriesAfter = this.viewModel.entries;
    if (add) {
      entriesBefore.splice(entriesAfter.indexOf(entry), 0, entry);
    } else {
      entriesBefore.splice(entriesBefore.indexOf(entry), 1);
    }
    const needsFullRefresh = !equals(entriesBefore, entriesAfter);
    return { needsFullRefresh };
  }
  isEntryVisible(id) {
    return !this.viewModel.isHidden(id);
  }
  updateEntryVisibility(id, visible) {
    if (visible) {
      this.viewModel.show(id);
    } else {
      this.viewModel.hide(id);
    }
  }
  focusNextEntry() {
    this.viewModel.focusNextEntry();
  }
  focusPreviousEntry() {
    this.viewModel.focusPreviousEntry();
  }
  isEntryFocused() {
    return this.viewModel.isEntryFocused();
  }
  focus(preserveEntryFocus = true) {
    this.getContainer()?.focus();
    const lastFocusedEntry = this.viewModel.lastFocusedEntry;
    if (preserveEntryFocus && lastFocusedEntry) {
      setTimeout(() => lastFocusedEntry.labelContainer.focus(), 0);
    }
  }
  createContentArea(parent) {
    this.element = parent;
    const scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.element));
    StatusBarFocused.bindTo(scopedContextKeyService).set(true);
    this.leftItemsContainer = $(".left-items.items-container");
    this.element.appendChild(this.leftItemsContainer);
    this.element.tabIndex = 0;
    this.rightItemsContainer = $(".right-items.items-container");
    this.element.appendChild(this.rightItemsContainer);
    this._register(addDisposableListener(parent, EventType.CONTEXT_MENU, (e) => this.showContextMenu(e)));
    this._register(Gesture.addTarget(parent));
    this._register(addDisposableListener(parent, TouchEventType.Contextmenu, (e) => this.showContextMenu(e)));
    this.createInitialStatusbarEntries();
    return this.element;
  }
  createInitialStatusbarEntries() {
    this.appendStatusbarEntries();
    while (this.pendingEntries.length) {
      const pending = this.pendingEntries.shift();
      if (pending) {
        pending.accessor = this.addEntry(pending.entry, pending.id, pending.alignment, pending.priority.primary);
      }
    }
  }
  appendStatusbarEntries() {
    const leftItemsContainer = assertIsDefined(this.leftItemsContainer);
    const rightItemsContainer = assertIsDefined(this.rightItemsContainer);
    clearNode(leftItemsContainer);
    clearNode(rightItemsContainer);
    for (const entry of [
      ...this.viewModel.getEntries(StatusbarAlignment.LEFT),
      ...this.viewModel.getEntries(StatusbarAlignment.RIGHT).reverse()
      // reversing due to flex: row-reverse
    ]) {
      const target = entry.alignment === StatusbarAlignment.LEFT ? leftItemsContainer : rightItemsContainer;
      target.appendChild(entry.container);
    }
    this.updateCompactEntries();
  }
  appendStatusbarEntry(entry) {
    const entries = this.viewModel.getEntries(entry.alignment);
    if (entry.alignment === StatusbarAlignment.RIGHT) {
      entries.reverse();
    }
    const target = assertIsDefined(entry.alignment === StatusbarAlignment.LEFT ? this.leftItemsContainer : this.rightItemsContainer);
    const index = entries.indexOf(entry);
    if (index + 1 === entries.length) {
      target.appendChild(entry.container);
    } else {
      target.insertBefore(entry.container, entries[index + 1].container);
    }
    this.updateCompactEntries();
  }
  updateCompactEntries() {
    const entries = this.viewModel.entries;
    const mapIdToVisibleEntry = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      if (!this.viewModel.isHidden(entry.id)) {
        mapIdToVisibleEntry.set(entry.id, entry);
      }
      entry.container.classList.remove("compact-left", "compact-right");
    }
    const compactEntryGroups = /* @__PURE__ */ new Map();
    for (const entry of mapIdToVisibleEntry.values()) {
      if (isStatusbarEntryLocation(entry.priority.primary) && // entry references another entry as location
      entry.priority.primary.compact) {
        const locationId = entry.priority.primary.location.id;
        const location = mapIdToVisibleEntry.get(locationId);
        if (!location) {
          continue;
        }
        let compactEntryGroup = compactEntryGroups.get(locationId);
        if (!compactEntryGroup) {
          for (const group of compactEntryGroups.values()) {
            if (group.has(locationId)) {
              compactEntryGroup = group;
              break;
            }
          }
          if (!compactEntryGroup) {
            compactEntryGroup = /* @__PURE__ */ new Map();
            compactEntryGroups.set(locationId, compactEntryGroup);
          }
        }
        compactEntryGroup.set(entry.id, entry);
        compactEntryGroup.set(location.id, location);
        if (entry.priority.primary.alignment === StatusbarAlignment.LEFT) {
          location.container.classList.add("compact-left");
          entry.container.classList.add("compact-right");
        } else {
          location.container.classList.add("compact-right");
          entry.container.classList.add("compact-left");
        }
      }
    }
    const statusBarItemHoverBackground = this.getColor(STATUS_BAR_ITEM_HOVER_BACKGROUND);
    const statusBarItemCompactHoverBackground = this.getColor(STATUS_BAR_ITEM_COMPACT_HOVER_BACKGROUND);
    this.compactEntriesDisposable.value = new DisposableStore();
    if (statusBarItemHoverBackground && statusBarItemCompactHoverBackground && !isHighContrast(this.theme.type)) {
      for (const [, compactEntryGroup] of compactEntryGroups) {
        for (const compactEntry of compactEntryGroup.values()) {
          if (!compactEntry.hasCommand) {
            continue;
          }
          this.compactEntriesDisposable.value.add(addDisposableListener(compactEntry.labelContainer, EventType.MOUSE_OVER, () => {
            compactEntryGroup.forEach((compactEntry2) => compactEntry2.labelContainer.style.backgroundColor = statusBarItemHoverBackground);
            compactEntry.labelContainer.style.backgroundColor = statusBarItemCompactHoverBackground;
          }));
          this.compactEntriesDisposable.value.add(addDisposableListener(compactEntry.labelContainer, EventType.MOUSE_OUT, () => {
            compactEntryGroup.forEach((compactEntry2) => compactEntry2.labelContainer.style.backgroundColor = "");
          }));
        }
      }
    }
  }
  showContextMenu(e) {
    EventHelper.stop(e, true);
    const event = new StandardMouseEvent(getWindow(this.element), e);
    let actions = void 0;
    this.contextMenuService.showContextMenu({
      getAnchor: () => event,
      getActions: () => {
        actions = this.getContextMenuActions(event);
        return actions;
      },
      onHide: () => {
        if (actions) {
          disposeIfDisposable(actions);
        }
      }
    });
  }
  getContextMenuActions(event) {
    const actions = [];
    actions.push(toAction({ id: ToggleStatusbarVisibilityAction.ID, label: localize("hideStatusBar", "Hide Status Bar"), run: () => this.instantiationService.invokeFunction((accessor) => new ToggleStatusbarVisibilityAction().run(accessor)) }));
    actions.push(new Separator());
    const handledEntries = /* @__PURE__ */ new Set();
    for (const entry of this.viewModel.entries) {
      if (!handledEntries.has(entry.id)) {
        actions.push(new ToggleStatusbarEntryVisibilityAction(entry.id, entry.name, this.viewModel));
        handledEntries.add(entry.id);
      }
    }
    let statusEntryUnderMouse = void 0;
    for (let element = event.target; element; element = element.parentElement) {
      const entry = this.viewModel.findEntry(element);
      if (entry) {
        statusEntryUnderMouse = entry;
        break;
      }
    }
    if (statusEntryUnderMouse) {
      actions.push(new Separator());
      if (statusEntryUnderMouse.extensionId) {
        actions.push(this.instantiationService.createInstance(ManageExtensionAction, statusEntryUnderMouse.extensionId));
      }
      actions.push(new HideStatusbarEntryAction(statusEntryUnderMouse.id, statusEntryUnderMouse.name, this.viewModel));
    }
    return actions;
  }
  updateStyles() {
    super.updateStyles();
    const container = assertIsDefined(this.getContainer());
    const styleOverride = [...this.styleOverrides].sort((a, b) => a.priority - b.priority)[0];
    const backgroundColor = this.getColor(styleOverride?.background ?? (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY ? STATUS_BAR_BACKGROUND : STATUS_BAR_NO_FOLDER_BACKGROUND)) || "";
    container.style.backgroundColor = backgroundColor;
    const foregroundColor = this.getColor(styleOverride?.foreground ?? (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY ? STATUS_BAR_FOREGROUND : STATUS_BAR_NO_FOLDER_FOREGROUND)) || "";
    container.style.color = foregroundColor;
    const itemBorderColor = this.getColor(STATUS_BAR_ITEM_FOCUS_BORDER);
    const borderColor = this.getColor(styleOverride?.border ?? (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY ? STATUS_BAR_BORDER : STATUS_BAR_NO_FOLDER_BORDER)) || this.getColor(contrastBorder);
    if (borderColor) {
      container.classList.add("status-border-top");
      container.style.setProperty("--status-border-top-color", borderColor);
    } else {
      container.classList.remove("status-border-top");
      container.style.removeProperty("--status-border-top-color");
    }
    const statusBarFocusColor = this.getColor(STATUS_BAR_FOCUS_BORDER);
    if (!this.styleElement) {
      this.styleElement = createStyleSheet(container);
    }
    this.styleElement.textContent = `

				/* Status bar focus outline */
				.monaco-workbench .part.statusbar:focus {
					outline-color: ${statusBarFocusColor};
				}

				/* Status bar item focus outline */
				.monaco-workbench .part.statusbar > .items-container > .statusbar-item a:focus-visible {
					outline: 1px solid ${this.getColor(activeContrastBorder) ?? itemBorderColor};
					outline-offset: ${borderColor ? "-2px" : "-1px"};
				}

				/* Notification Beak */
				.monaco-workbench .part.statusbar > .items-container > .statusbar-item.has-beak > .status-bar-item-beak-container:before {
					border-bottom-color: ${backgroundColor};
				}
			`;
  }
  layout(width, height, top, left) {
    super.layout(width, height, top, left);
    super.layoutContents(width, height);
  }
  overrideStyle(style) {
    this.styleOverrides.add(style);
    this.updateStyles();
    return toDisposable(() => {
      this.styleOverrides.delete(style);
      this.updateStyles();
    });
  }
  toJSON() {
    return {
      type: Parts.STATUSBAR_PART
    };
  }
  dispose() {
    this._onWillDispose.fire();
    super.dispose();
  }
};
StatusbarPart.HEIGHT = 22;
StatusbarPart = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkbenchLayoutService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IContextKeyService)
], StatusbarPart);
let MainStatusbarPart = class extends StatusbarPart {
  constructor(instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService) {
    super(Parts.STATUSBAR_PART, instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService);
  }
};
MainStatusbarPart = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IThemeService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IWorkbenchLayoutService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IContextKeyService)
], MainStatusbarPart);
let AuxiliaryStatusbarPart = class extends StatusbarPart {
  constructor(container, instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService) {
    const id = AuxiliaryStatusbarPart.COUNTER++;
    super(`workbench.parts.auxiliaryStatus.${id}`, instantiationService, themeService, contextService, storageService, layoutService, contextMenuService, contextKeyService);
    this.container = container;
    this.height = StatusbarPart.HEIGHT;
  }
};
AuxiliaryStatusbarPart.COUNTER = 1;
AuxiliaryStatusbarPart = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IWorkbenchLayoutService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IContextKeyService)
], AuxiliaryStatusbarPart);
let StatusbarService = class extends MultiWindowParts {
  constructor(instantiationService, storageService, themeService) {
    super("workbench.statusBarService", themeService, storageService);
    this.instantiationService = instantiationService;
    this._onDidCreateAuxiliaryStatusbarPart = this._register(new Emitter());
    this.onDidCreateAuxiliaryStatusbarPart = this._onDidCreateAuxiliaryStatusbarPart.event;
    this.mainPart = this._register(this.instantiationService.createInstance(MainStatusbarPart));
    this._register(this.registerPart(this.mainPart));
    this.onDidChangeEntryVisibility = this.mainPart.onDidChangeEntryVisibility;
  }
  //#region Auxiliary Statusbar Parts
  createAuxiliaryStatusbarPart(container) {
    const statusbarPartContainer = $("footer.part.statusbar", {
      "role": "status",
      "aria-live": "off",
      "tabIndex": "0"
    });
    statusbarPartContainer.style.position = "relative";
    container.appendChild(statusbarPartContainer);
    const statusbarPart = this.instantiationService.createInstance(AuxiliaryStatusbarPart, statusbarPartContainer);
    const disposable = this.registerPart(statusbarPart);
    statusbarPart.create(statusbarPartContainer);
    Event.once(statusbarPart.onWillDispose)(() => disposable.dispose());
    this._onDidCreateAuxiliaryStatusbarPart.fire(statusbarPart);
    return statusbarPart;
  }
  createScoped(statusbarEntryContainer, disposables) {
    return disposables.add(this.instantiationService.createInstance(ScopedStatusbarService, statusbarEntryContainer));
  }
  addEntry(entry, id, alignment, priorityOrLocation = 0) {
    if (entry.showInAllWindows) {
      return this.doAddEntryToAllWindows(entry, id, alignment, priorityOrLocation);
    }
    return this.mainPart.addEntry(entry, id, alignment, priorityOrLocation);
  }
  doAddEntryToAllWindows(originalEntry, id, alignment, priorityOrLocation = 0) {
    const entryDisposables = new DisposableStore();
    const accessors = /* @__PURE__ */ new Set();
    let entry = originalEntry;
    function addEntry(part) {
      const partDisposables = new DisposableStore();
      partDisposables.add(part.onWillDispose(() => partDisposables.dispose()));
      const accessor = partDisposables.add(part.addEntry(entry, id, alignment, priorityOrLocation));
      accessors.add(accessor);
      partDisposables.add(toDisposable(() => accessors.delete(accessor)));
      entryDisposables.add(partDisposables);
      partDisposables.add(toDisposable(() => entryDisposables.delete(partDisposables)));
    }
    for (const part of this.parts) {
      addEntry(part);
    }
    entryDisposables.add(this.onDidCreateAuxiliaryStatusbarPart((part) => addEntry(part)));
    return {
      update: (updatedEntry) => {
        entry = updatedEntry;
        for (const update of accessors) {
          update.update(updatedEntry);
        }
      },
      dispose: () => entryDisposables.dispose()
    };
  }
  isEntryVisible(id) {
    return this.mainPart.isEntryVisible(id);
  }
  updateEntryVisibility(id, visible) {
    for (const part of this.parts) {
      part.updateEntryVisibility(id, visible);
    }
  }
  overrideEntry(id, override) {
    const disposables = new DisposableStore();
    for (const part of this.parts) {
      disposables.add(part.overrideEntry(id, override));
    }
    return disposables;
  }
  focus(preserveEntryFocus) {
    this.activePart.focus(preserveEntryFocus);
  }
  focusNextEntry() {
    this.activePart.focusNextEntry();
  }
  focusPreviousEntry() {
    this.activePart.focusPreviousEntry();
  }
  isEntryFocused() {
    return this.activePart.isEntryFocused();
  }
  overrideStyle(style) {
    const disposables = new DisposableStore();
    for (const part of this.parts) {
      disposables.add(part.overrideStyle(style));
    }
    return disposables;
  }
  //#endregion
};
StatusbarService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IThemeService)
], StatusbarService);
let ScopedStatusbarService = class extends Disposable {
  constructor(statusbarEntryContainer, statusbarService) {
    super();
    this.statusbarEntryContainer = statusbarEntryContainer;
    this.statusbarService = statusbarService;
    this.onDidChangeEntryVisibility = this.statusbarEntryContainer.onDidChangeEntryVisibility;
  }
  createAuxiliaryStatusbarPart(container) {
    return this.statusbarService.createAuxiliaryStatusbarPart(container);
  }
  createScoped(statusbarEntryContainer, disposables) {
    return this.statusbarService.createScoped(statusbarEntryContainer, disposables);
  }
  getPart() {
    return this.statusbarEntryContainer;
  }
  addEntry(entry, id, alignment, priorityOrLocation = 0) {
    return this.statusbarEntryContainer.addEntry(entry, id, alignment, priorityOrLocation);
  }
  isEntryVisible(id) {
    return this.statusbarEntryContainer.isEntryVisible(id);
  }
  updateEntryVisibility(id, visible) {
    this.statusbarEntryContainer.updateEntryVisibility(id, visible);
  }
  overrideEntry(id, override) {
    return this.statusbarEntryContainer.overrideEntry(id, override);
  }
  focus(preserveEntryFocus) {
    this.statusbarEntryContainer.focus(preserveEntryFocus);
  }
  focusNextEntry() {
    this.statusbarEntryContainer.focusNextEntry();
  }
  focusPreviousEntry() {
    this.statusbarEntryContainer.focusPreviousEntry();
  }
  isEntryFocused() {
    return this.statusbarEntryContainer.isEntryFocused();
  }
  overrideStyle(style) {
    return this.statusbarEntryContainer.overrideStyle(style);
  }
};
ScopedStatusbarService = __decorateClass([
  __decorateParam(1, IStatusbarService)
], ScopedStatusbarService);
registerSingleton(IStatusbarService, StatusbarService, InstantiationType.Eager);
export {
  AuxiliaryStatusbarPart,
  MainStatusbarPart,
  ScopedStatusbarService,
  StatusbarService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9zdGF0dXNiYXIvc3RhdHVzYmFyUGFydC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9zdGF0dXNiYXJwYXJ0LmNzcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2VJZkRpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE11bHRpV2luZG93UGFydHMsIFBhcnQgfSBmcm9tICcuLi8uLi9wYXJ0LmpzJztcbmltcG9ydCB7IEV2ZW50VHlwZSBhcyBUb3VjaEV2ZW50VHlwZSwgR2VzdHVyZSwgR2VzdHVyZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3RvdWNoLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU3RhdHVzYmFyQWxpZ25tZW50LCBJU3RhdHVzYmFyU2VydmljZSwgSVN0YXR1c2JhckVudHJ5LCBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciwgSVN0YXR1c2JhclN0eWxlT3ZlcnJpZGUsIGlzU3RhdHVzYmFyRW50cnlMb2NhdGlvbiwgSVN0YXR1c2JhckVudHJ5TG9jYXRpb24sIGlzU3RhdHVzYmFyRW50cnlQcmlvcml0eSwgSVN0YXR1c2JhckVudHJ5UHJpb3JpdHkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiwgU2VwYXJhdG9yLCB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU1RBVFVTX0JBUl9CQUNLR1JPVU5ELCBTVEFUVVNfQkFSX0ZPUkVHUk9VTkQsIFNUQVRVU19CQVJfTk9fRk9MREVSX0JBQ0tHUk9VTkQsIFNUQVRVU19CQVJfSVRFTV9IT1ZFUl9CQUNLR1JPVU5ELCBTVEFUVVNfQkFSX0JPUkRFUiwgU1RBVFVTX0JBUl9OT19GT0xERVJfRk9SRUdST1VORCwgU1RBVFVTX0JBUl9OT19GT0xERVJfQk9SREVSLCBTVEFUVVNfQkFSX0lURU1fQ09NUEFDVF9IT1ZFUl9CQUNLR1JPVU5ELCBTVEFUVVNfQkFSX0lURU1fRk9DVVNfQk9SREVSLCBTVEFUVVNfQkFSX0ZPQ1VTX0JPUkRFUiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgY29udHJhc3RCb3JkZXIsIGFjdGl2ZUNvbnRyYXN0Qm9yZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRXZlbnRIZWxwZXIsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgRXZlbnRUeXBlLCBjbGVhck5vZGUsIGdldFdpbmRvdywgaXNIVE1MRWxlbWVudCwgJCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgY3JlYXRlU3R5bGVTaGVldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IFBhcnRzLCBJV29ya2JlbmNoTGF5b3V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgVG9nZ2xlU3RhdHVzYmFyVmlzaWJpbGl0eUFjdGlvbiB9IGZyb20gJy4uLy4uL2FjdGlvbnMvbGF5b3V0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGlzSGlnaENvbnRyYXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IEhpZGVTdGF0dXNiYXJFbnRyeUFjdGlvbiwgTWFuYWdlRXh0ZW5zaW9uQWN0aW9uLCBUb2dnbGVTdGF0dXNiYXJFbnRyeVZpc2liaWxpdHlBY3Rpb24gfSBmcm9tICcuL3N0YXR1c2JhckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVN0YXR1c2JhclZpZXdNb2RlbEVudHJ5LCBTdGF0dXNiYXJWaWV3TW9kZWwgfSBmcm9tICcuL3N0YXR1c2Jhck1vZGVsLmpzJztcbmltcG9ydCB7IFN0YXR1c2JhckVudHJ5SXRlbSB9IGZyb20gJy4vc3RhdHVzYmFySXRlbS5qcyc7XG5pbXBvcnQgeyBTdGF0dXNCYXJGb2N1c2VkIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSVZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZ3JpZC9ncmlkLmpzJztcbmltcG9ydCB7IGlzTWFuYWdlZEhvdmVyVG9vbHRpcEhUTUxFbGVtZW50LCBpc01hbmFnZWRIb3ZlclRvb2x0aXBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3Zlci5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0YXR1c2JhckVudHJ5Q29udGFpbmVyIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCB0aGF0IGlzIHRyaWdnZXJlZCB3aGVuIGFuIGVudHJ5J3MgdmlzaWJpbGl0eSBpcyBjaGFuZ2VkLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VFbnRyeVZpc2liaWxpdHk6IEV2ZW50PHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbiB9PjtcblxuXHQvKipcblx0ICogQWRkcyBhbiBlbnRyeSB0byB0aGUgc3RhdHVzYmFyIHdpdGggdGhlIGdpdmVuIGFsaWdubWVudCBhbmQgcHJpb3JpdHkuIFVzZSB0aGUgcmV0dXJuZWQgYWNjZXNzb3Jcblx0ICogdG8gdXBkYXRlIG9yIHJlbW92ZSB0aGUgc3RhdHVzYmFyIGVudHJ5LlxuXHQgKlxuXHQgKiBAcGFyYW0gaWQgaWRlbnRpZmllciBvZiB0aGUgZW50cnkgaXMgbmVlZGVkIHRvIGFsbG93IHVzZXJzIHRvIGhpZGUgZW50cmllcyB2aWEgc2V0dGluZ3Ncblx0ICogQHBhcmFtIGFsaWdubWVudCBlaXRoZXIgTEVGVCBvciBSSUdIVCBzaWRlIGluIHRoZSBzdGF0dXMgYmFyXG5cdCAqIEBwYXJhbSBwcmlvcml0eSBpdGVtcyBnZXQgYXJyYW5nZWQgZnJvbSBoaWdoZXN0IHByaW9yaXR5IHRvIGxvd2VzdCBwcmlvcml0eSBmcm9tIGxlZnQgdG8gcmlnaHRcblx0ICogaW4gdGhlaXIgcmVzcGVjdGl2ZSBhbGlnbm1lbnQgc2xvdFxuXHQgKi9cblx0YWRkRW50cnkoZW50cnk6IElTdGF0dXNiYXJFbnRyeSwgaWQ6IHN0cmluZywgYWxpZ25tZW50OiBTdGF0dXNiYXJBbGlnbm1lbnQsIHByaW9yaXR5PzogbnVtYmVyIHwgSVN0YXR1c2JhckVudHJ5UHJpb3JpdHkpOiBJU3RhdHVzYmFyRW50cnlBY2Nlc3Nvcjtcblx0YWRkRW50cnkoZW50cnk6IElTdGF0dXNiYXJFbnRyeSwgaWQ6IHN0cmluZywgYWxpZ25tZW50OiBTdGF0dXNiYXJBbGlnbm1lbnQsIHByaW9yaXR5PzogbnVtYmVyIHwgSVN0YXR1c2JhckVudHJ5UHJpb3JpdHkgfCBJU3RhdHVzYmFyRW50cnlMb2NhdGlvbik6IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yO1xuXG5cdC8qKlxuXHQgKiBBZGRzIGFuIGVudHJ5IHRvIHRoZSBzdGF0dXNiYXIgd2l0aCB0aGUgZ2l2ZW4gYWxpZ25tZW50IHJlbGF0aXZlIHRvIGFub3RoZXIgZW50cnkuIFVzZSB0aGUgcmV0dXJuZWRcblx0ICogYWNjZXNzb3IgdG8gdXBkYXRlIG9yIHJlbW92ZSB0aGUgc3RhdHVzYmFyIGVudHJ5LlxuXHQgKlxuXHQgKiBAcGFyYW0gaWQgaWRlbnRpZmllciBvZiB0aGUgZW50cnkgaXMgbmVlZGVkIHRvIGFsbG93IHVzZXJzIHRvIGhpZGUgZW50cmllcyB2aWEgc2V0dGluZ3Ncblx0ICogQHBhcmFtIGFsaWdubWVudCBlaXRoZXIgTEVGVCBvciBSSUdIVCBzaWRlIGluIHRoZSBzdGF0dXMgYmFyXG5cdCAqIEBwYXJhbSBsb2NhdGlvbiBhIHJlZmVyZW5jZSB0byBhbm90aGVyIGVudHJ5IHRvIHBvc2l0aW9uIHJlbGF0aXZlIHRvXG5cdCAqL1xuXHRhZGRFbnRyeShlbnRyeTogSVN0YXR1c2JhckVudHJ5LCBpZDogc3RyaW5nLCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudCwgbG9jYXRpb24/OiBJU3RhdHVzYmFyRW50cnlMb2NhdGlvbik6IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm4gaWYgYW4gZW50cnkgaXMgdmlzaWJsZSBvciBub3QuXG5cdCAqL1xuXHRpc0VudHJ5VmlzaWJsZShpZDogc3RyaW5nKTogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQWxsb3dzIHRvIHVwZGF0ZSBhbiBlbnRyeSdzIHZpc2liaWxpdHkgd2l0aCB0aGUgcHJvdmlkZWQgSUQuXG5cdCAqL1xuXHR1cGRhdGVFbnRyeVZpc2liaWxpdHkoaWQ6IHN0cmluZywgdmlzaWJsZTogYm9vbGVhbik6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEFsbG93cyB0byBvdmVycmlkZSB0aGUgYXBwZWFyYW5jZSBvZiBhbiBlbnRyeSB3aXRoIHRoZSBwcm92aWRlZCBJRC5cblx0ICovXG5cdG92ZXJyaWRlRW50cnkoaWQ6IHN0cmluZywgb3ZlcnJpZGU6IFBhcnRpYWw8SVN0YXR1c2JhckVudHJ5Pik6IElEaXNwb3NhYmxlO1xuXG5cdC8qKlxuXHQgKiBGb2N1c2VkIHRoZSBzdGF0dXMgYmFyLiBJZiBvbmUgb2YgdGhlIHN0YXR1cyBiYXIgZW50cmllcyB3YXMgZm9jdXNlZCwgZm9jdXNlcyBpdCBkaXJlY3RseS5cblx0ICovXG5cdGZvY3VzKHByZXNlcnZlRW50cnlGb2N1cz86IGJvb2xlYW4pOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBGb2N1c2VzIHRoZSBuZXh0IHN0YXR1cyBiYXIgZW50cnkuIElmIG5vbmUgZm9jdXNlZCwgZm9jdXNlcyB0aGUgZmlyc3QuXG5cdCAqL1xuXHRmb2N1c05leHRFbnRyeSgpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBGb2N1c2VzIHRoZSBwcmV2aW91cyBzdGF0dXMgYmFyIGVudHJ5LiBJZiBub25lIGZvY3VzZWQsIGZvY3VzZXMgdGhlIGxhc3QuXG5cdCAqL1xuXHRmb2N1c1ByZXZpb3VzRW50cnkoKTogdm9pZDtcblxuXHQvKipcblx0ICpcdFJldHVybnMgdHJ1ZSBpZiBhIHN0YXR1cyBiYXIgZW50cnkgaXMgZm9jdXNlZC5cblx0ICovXG5cdGlzRW50cnlGb2N1c2VkKCk6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFRlbXBvcmFyaWx5IG92ZXJyaWRlIHN0YXR1c2JhciBzdHlsZS5cblx0ICovXG5cdG92ZXJyaWRlU3R5bGUoc3R5bGU6IElTdGF0dXNiYXJTdHlsZU92ZXJyaWRlKTogSURpc3Bvc2FibGU7XG59XG5cbmludGVyZmFjZSBJUGVuZGluZ1N0YXR1c2JhckVudHJ5IHtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgYWxpZ25tZW50OiBTdGF0dXNiYXJBbGlnbm1lbnQ7XG5cdHJlYWRvbmx5IHByaW9yaXR5OiBJU3RhdHVzYmFyRW50cnlQcmlvcml0eTtcblxuXHRlbnRyeTogSVN0YXR1c2JhckVudHJ5O1xuXHRhY2Nlc3Nvcj86IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yO1xufVxuXG5jbGFzcyBTdGF0dXNiYXJQYXJ0IGV4dGVuZHMgUGFydCBpbXBsZW1lbnRzIElTdGF0dXNiYXJFbnRyeUNvbnRhaW5lciB7XG5cblx0c3RhdGljIHJlYWRvbmx5IEhFSUdIVCA9IDIyO1xuXG5cdC8vI3JlZ2lvbiBJVmlld1xuXG5cdHJlYWRvbmx5IG1pbmltdW1XaWR0aDogbnVtYmVyID0gMDtcblx0cmVhZG9ubHkgbWF4aW11bVdpZHRoOiBudW1iZXIgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cdHJlYWRvbmx5IG1pbmltdW1IZWlnaHQ6IG51bWJlciA9IFN0YXR1c2JhclBhcnQuSEVJR0hUO1xuXHRyZWFkb25seSBtYXhpbXVtSGVpZ2h0OiBudW1iZXIgPSBTdGF0dXNiYXJQYXJ0LkhFSUdIVDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIHN0eWxlRWxlbWVudDogSFRNTFN0eWxlRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHBlbmRpbmdFbnRyaWVzOiBJUGVuZGluZ1N0YXR1c2JhckVudHJ5W10gPSBbXTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdNb2RlbDogU3RhdHVzYmFyVmlld01vZGVsO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRW50cnlWaXNpYmlsaXR5OiBFdmVudDx7IGlkOiBzdHJpbmc7IHZpc2libGU6IGJvb2xlYW4gfT47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxEaXNwb3NlID0gdGhpcy5fb25XaWxsRGlzcG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkT3ZlcnJpZGVFbnRyeSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZW50cnlPdmVycmlkZXMgPSBuZXcgTWFwPHN0cmluZywgUGFydGlhbDxJU3RhdHVzYmFyRW50cnk+PigpO1xuXG5cdHByaXZhdGUgbGVmdEl0ZW1zQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByaWdodEl0ZW1zQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGhvdmVyRGVsZWdhdGU6IFdvcmtiZW5jaEhvdmVyRGVsZWdhdGU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb21wYWN0RW50cmllc0Rpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8RGlzcG9zYWJsZVN0b3JlPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBzdHlsZU92ZXJyaWRlcyA9IG5ldyBTZXQ8SVN0YXR1c2JhclN0eWxlT3ZlcnJpZGU+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aWQ6IHN0cmluZyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoaWQsIHsgaGFzVGl0bGU6IGZhbHNlIH0sIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIGxheW91dFNlcnZpY2UpO1xuXG5cdFx0dGhpcy52aWV3TW9kZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgU3RhdHVzYmFyVmlld01vZGVsKHN0b3JhZ2VTZXJ2aWNlKSk7XG5cdFx0dGhpcy5vbkRpZENoYW5nZUVudHJ5VmlzaWJpbGl0eSA9IHRoaXMudmlld01vZGVsLm9uRGlkQ2hhbmdlRW50cnlWaXNpYmlsaXR5O1xuXG5cdFx0dGhpcy5ob3ZlckRlbGVnYXRlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hIb3ZlckRlbGVnYXRlLCAnZWxlbWVudCcsIHtcblx0XHRcdGluc3RhbnRIb3ZlcjogdHJ1ZSxcblx0XHRcdGR5bmFtaWNEZWxheShjb250ZW50KSB7XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHR0eXBlb2YgY29udGVudCA9PT0gJ2Z1bmN0aW9uJyB8fFxuXHRcdFx0XHRcdGlzSFRNTEVsZW1lbnQoY29udGVudCkgfHxcblx0XHRcdFx0XHQoaXNNYW5hZ2VkSG92ZXJUb29sdGlwTWFya2Rvd25TdHJpbmcoY29udGVudCkgJiYgdHlwZW9mIGNvbnRlbnQubWFya2Rvd24gPT09ICdmdW5jdGlvbicpIHx8XG5cdFx0XHRcdFx0aXNNYW5hZ2VkSG92ZXJUb29sdGlwSFRNTEVsZW1lbnQoY29udGVudClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0Ly8gb3ZlcnJpZGUgdGhlIGRlbGF5IGZvciBjb250ZW50IHRoYXQgaXMgcmljaCAoZS5nLiBodG1sIG9yIGxvbmcgcnVubmluZylcblx0XHRcdFx0XHQvLyBzbyB0aGF0IGl0IGFwcGVhcnMgbW9yZSBpbnN0YW50bHkuIHRoZXNlIGhvdmVycyBjYXJyeSBtb3JlIGltcG9ydGFudFxuXHRcdFx0XHRcdC8vIGluZm9ybWF0aW9uIGFuZCBzaG91bGQgbm90IGJlIGRlbGF5ZWQgYnkgcHJlZmVyZW5jZS5cblx0XHRcdFx0XHRyZXR1cm4gNTAwO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9LCAoXywgZm9jdXM/OiBib29sZWFuKSA9PiAoXG5cdFx0XHR7XG5cdFx0XHRcdHBlcnNpc3RlbmNlOiB7XG5cdFx0XHRcdFx0aGlkZU9uS2V5RG93bjogdHJ1ZSxcblx0XHRcdFx0XHRzdGlja3k6IGZvY3VzXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpKSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gRW50cnkgdmlzaWJpbGl0eSBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZUVudHJ5VmlzaWJpbGl0eSgoKSA9PiB0aGlzLnVwZGF0ZUNvbXBhY3RFbnRyaWVzKCkpKTtcblxuXHRcdC8vIFdvcmtiZW5jaCBzdGF0ZSBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtiZW5jaFN0YXRlKCgpID0+IHRoaXMudXBkYXRlU3R5bGVzKCkpKTtcblx0fVxuXG5cdG92ZXJyaWRlRW50cnkoaWQ6IHN0cmluZywgb3ZlcnJpZGU6IFBhcnRpYWw8SVN0YXR1c2JhckVudHJ5Pik6IElEaXNwb3NhYmxlIHtcblx0XHR0aGlzLmVudHJ5T3ZlcnJpZGVzLnNldChpZCwgb3ZlcnJpZGUpO1xuXHRcdHRoaXMub25EaWRPdmVycmlkZUVudHJ5LmZpcmUoaWQpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRjb25zdCBjdXJyZW50T3ZlcnJpZGUgPSB0aGlzLmVudHJ5T3ZlcnJpZGVzLmdldChpZCk7XG5cdFx0XHRpZiAoY3VycmVudE92ZXJyaWRlID09PSBvdmVycmlkZSkge1xuXHRcdFx0XHR0aGlzLmVudHJ5T3ZlcnJpZGVzLmRlbGV0ZShpZCk7XG5cdFx0XHRcdHRoaXMub25EaWRPdmVycmlkZUVudHJ5LmZpcmUoaWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB3aXRoRW50cnlPdmVycmlkZShlbnRyeTogSVN0YXR1c2JhckVudHJ5LCBpZDogc3RyaW5nKTogSVN0YXR1c2JhckVudHJ5IHtcblx0XHRjb25zdCBvdmVycmlkZSA9IHRoaXMuZW50cnlPdmVycmlkZXMuZ2V0KGlkKTtcblx0XHRpZiAob3ZlcnJpZGUpIHtcblx0XHRcdGVudHJ5ID0geyAuLi5lbnRyeSwgLi4ub3ZlcnJpZGUgfTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZW50cnk7XG5cdH1cblxuXHRhZGRFbnRyeShlbnRyeTogSVN0YXR1c2JhckVudHJ5LCBpZDogc3RyaW5nLCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudCwgcHJpb3JpdHlPckxvY2F0aW9uOiBudW1iZXIgfCBJU3RhdHVzYmFyRW50cnlMb2NhdGlvbiB8IElTdGF0dXNiYXJFbnRyeVByaW9yaXR5ID0gMCk6IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yIHtcblx0XHRsZXQgcHJpb3JpdHk6IElTdGF0dXNiYXJFbnRyeVByaW9yaXR5O1xuXHRcdGlmIChpc1N0YXR1c2JhckVudHJ5UHJpb3JpdHkocHJpb3JpdHlPckxvY2F0aW9uKSkge1xuXHRcdFx0cHJpb3JpdHkgPSBwcmlvcml0eU9yTG9jYXRpb247XG5cdFx0fSBlbHNlIHtcblx0XHRcdHByaW9yaXR5ID0ge1xuXHRcdFx0XHRwcmltYXJ5OiBwcmlvcml0eU9yTG9jYXRpb24sXG5cdFx0XHRcdHNlY29uZGFyeTogaGFzaChpZCkgLy8gZGVyaXZlIGZyb20gaWRlbnRpZmllciB0byBhY2NvbXBsaXNoIHVuaXF1ZW5lc3Ncblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gQXMgbG9uZyBhcyB3ZSBoYXZlIG5vdCBiZWVuIGNyZWF0ZWQgaW50byBhIGNvbnRhaW5lciB5ZXQsIHJlY29yZCBhbGwgZW50cmllc1xuXHRcdC8vIHRoYXQgYXJlIHBlbmRpbmcgc28gdGhhdCB0aGV5IGNhbiBnZXQgY3JlYXRlZCBhdCBhIGxhdGVyIHBvaW50XG5cdFx0aWYgKCF0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHJldHVybiB0aGlzLmRvQWRkUGVuZGluZ0VudHJ5KGVudHJ5LCBpZCwgYWxpZ25tZW50LCBwcmlvcml0eSk7XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlIGFkZCB0byB2aWV3XG5cdFx0cmV0dXJuIHRoaXMuZG9BZGRFbnRyeShlbnRyeSwgaWQsIGFsaWdubWVudCwgcHJpb3JpdHkpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0FkZFBlbmRpbmdFbnRyeShlbnRyeTogSVN0YXR1c2JhckVudHJ5LCBpZDogc3RyaW5nLCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudCwgcHJpb3JpdHk6IElTdGF0dXNiYXJFbnRyeVByaW9yaXR5KTogSVN0YXR1c2JhckVudHJ5QWNjZXNzb3Ige1xuXHRcdGNvbnN0IHBlbmRpbmdFbnRyeTogSVBlbmRpbmdTdGF0dXNiYXJFbnRyeSA9IHsgZW50cnksIGlkLCBhbGlnbm1lbnQsIHByaW9yaXR5IH07XG5cdFx0dGhpcy5wZW5kaW5nRW50cmllcy5wdXNoKHBlbmRpbmdFbnRyeSk7XG5cblx0XHRjb25zdCBhY2Nlc3NvcjogSVN0YXR1c2JhckVudHJ5QWNjZXNzb3IgPSB7XG5cdFx0XHR1cGRhdGU6IChlbnRyeTogSVN0YXR1c2JhckVudHJ5KSA9PiB7XG5cdFx0XHRcdGlmIChwZW5kaW5nRW50cnkuYWNjZXNzb3IpIHtcblx0XHRcdFx0XHRwZW5kaW5nRW50cnkuYWNjZXNzb3IudXBkYXRlKGVudHJ5KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwZW5kaW5nRW50cnkuZW50cnkgPSBlbnRyeTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRpZiAocGVuZGluZ0VudHJ5LmFjY2Vzc29yKSB7XG5cdFx0XHRcdFx0cGVuZGluZ0VudHJ5LmFjY2Vzc29yLmRpc3Bvc2UoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnBlbmRpbmdFbnRyaWVzID0gdGhpcy5wZW5kaW5nRW50cmllcy5maWx0ZXIoZW50cnkgPT4gZW50cnkgIT09IHBlbmRpbmdFbnRyeSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGFjY2Vzc29yO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0FkZEVudHJ5KGVudHJ5OiBJU3RhdHVzYmFyRW50cnksIGlkOiBzdHJpbmcsIGFsaWdubWVudDogU3RhdHVzYmFyQWxpZ25tZW50LCBwcmlvcml0eTogSVN0YXR1c2JhckVudHJ5UHJpb3JpdHkpOiBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHQvLyBWaWV3IG1vZGVsIGl0ZW1cblx0XHRjb25zdCBpdGVtQ29udGFpbmVyID0gdGhpcy5kb0NyZWF0ZVN0YXR1c0l0ZW0oaWQsIGFsaWdubWVudCk7XG5cdFx0Y29uc3QgaXRlbSA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN0YXR1c2JhckVudHJ5SXRlbSwgaXRlbUNvbnRhaW5lciwgdGhpcy53aXRoRW50cnlPdmVycmlkZShlbnRyeSwgaWQpLCB0aGlzLmhvdmVyRGVsZWdhdGUpKTtcblxuXHRcdC8vIFZpZXcgbW9kZWwgZW50cnlcblx0XHRjb25zdCB2aWV3TW9kZWxFbnRyeTogSVN0YXR1c2JhclZpZXdNb2RlbEVudHJ5ID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSVN0YXR1c2JhclZpZXdNb2RlbEVudHJ5IHtcblx0XHRcdHJlYWRvbmx5IGlkID0gaWQ7XG5cdFx0XHRyZWFkb25seSBleHRlbnNpb25JZCA9IGVudHJ5LmV4dGVuc2lvbklkO1xuXHRcdFx0cmVhZG9ubHkgYWxpZ25tZW50ID0gYWxpZ25tZW50O1xuXHRcdFx0cmVhZG9ubHkgcHJpb3JpdHkgPSBwcmlvcml0eTtcblx0XHRcdHJlYWRvbmx5IGNvbnRhaW5lciA9IGl0ZW1Db250YWluZXI7XG5cdFx0XHRyZWFkb25seSBsYWJlbENvbnRhaW5lciA9IGl0ZW0ubGFiZWxDb250YWluZXI7XG5cblx0XHRcdGdldCBuYW1lKCkgeyByZXR1cm4gaXRlbS5uYW1lOyB9XG5cdFx0XHRnZXQgaGFzQ29tbWFuZCgpIHsgcmV0dXJuIGl0ZW0uaGFzQ29tbWFuZDsgfVxuXHRcdH07XG5cblx0XHQvLyBBZGQgdG8gdmlldyBtb2RlbFxuXHRcdGNvbnN0IHsgbmVlZHNGdWxsUmVmcmVzaCB9ID0gdGhpcy5kb0FkZE9yUmVtb3ZlTW9kZWxFbnRyeSh2aWV3TW9kZWxFbnRyeSwgdHJ1ZSk7XG5cdFx0aWYgKG5lZWRzRnVsbFJlZnJlc2gpIHtcblx0XHRcdHRoaXMuYXBwZW5kU3RhdHVzYmFyRW50cmllcygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFwcGVuZFN0YXR1c2JhckVudHJ5KHZpZXdNb2RlbEVudHJ5KTtcblx0XHR9XG5cblx0XHRsZXQgbGFzdEVudHJ5ID0gZW50cnk7XG5cdFx0Y29uc3QgYWNjZXNzb3I6IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yID0ge1xuXHRcdFx0dXBkYXRlOiBlbnRyeSA9PiB7XG5cdFx0XHRcdGxhc3RFbnRyeSA9IGVudHJ5O1xuXHRcdFx0XHRpdGVtLnVwZGF0ZSh0aGlzLndpdGhFbnRyeU92ZXJyaWRlKGVudHJ5LCBpZCkpO1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgeyBuZWVkc0Z1bGxSZWZyZXNoIH0gPSB0aGlzLmRvQWRkT3JSZW1vdmVNb2RlbEVudHJ5KHZpZXdNb2RlbEVudHJ5LCBmYWxzZSk7XG5cdFx0XHRcdGlmIChuZWVkc0Z1bGxSZWZyZXNoKSB7XG5cdFx0XHRcdFx0dGhpcy5hcHBlbmRTdGF0dXNiYXJFbnRyaWVzKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aXRlbUNvbnRhaW5lci5yZW1vdmUoKTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUNvbXBhY3RFbnRyaWVzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBSZWFjdCB0byBvdmVycmlkZXNcblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5vbkRpZE92ZXJyaWRlRW50cnkuZXZlbnQob3ZlcnJpZGVFbnRyeUlkID0+IHtcblx0XHRcdGlmIChvdmVycmlkZUVudHJ5SWQgPT09IGlkKSB7XG5cdFx0XHRcdGFjY2Vzc29yLnVwZGF0ZShsYXN0RW50cnkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBhY2Nlc3Nvcjtcblx0fVxuXG5cdHByaXZhdGUgZG9DcmVhdGVTdGF0dXNJdGVtKGlkOiBzdHJpbmcsIGFsaWdubWVudDogU3RhdHVzYmFyQWxpZ25tZW50LCAuLi5leHRyYUNsYXNzZXM6IHN0cmluZ1tdKTogSFRNTEVsZW1lbnQge1xuXHRcdGNvbnN0IGl0ZW1Db250YWluZXIgPSAkKCcuc3RhdHVzYmFyLWl0ZW0nLCB7IGlkIH0pO1xuXG5cdFx0aWYgKGV4dHJhQ2xhc3Nlcykge1xuXHRcdFx0aXRlbUNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKC4uLmV4dHJhQ2xhc3Nlcyk7XG5cdFx0fVxuXG5cdFx0aWYgKGFsaWdubWVudCA9PT0gU3RhdHVzYmFyQWxpZ25tZW50LlJJR0hUKSB7XG5cdFx0XHRpdGVtQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3JpZ2h0Jyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGl0ZW1Db250YWluZXIuY2xhc3NMaXN0LmFkZCgnbGVmdCcpO1xuXHRcdH1cblxuXHRcdHJldHVybiBpdGVtQ29udGFpbmVyO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0FkZE9yUmVtb3ZlTW9kZWxFbnRyeShlbnRyeTogSVN0YXR1c2JhclZpZXdNb2RlbEVudHJ5LCBhZGQ6IGJvb2xlYW4pIHtcblxuXHRcdC8vIFVwZGF0ZSBtb2RlbCBidXQgcmVtZW1iZXIgcHJldmlvdXMgZW50cmllc1xuXHRcdGNvbnN0IGVudHJpZXNCZWZvcmUgPSB0aGlzLnZpZXdNb2RlbC5lbnRyaWVzO1xuXHRcdGlmIChhZGQpIHtcblx0XHRcdHRoaXMudmlld01vZGVsLmFkZChlbnRyeSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudmlld01vZGVsLnJlbW92ZShlbnRyeSk7XG5cdFx0fVxuXHRcdGNvbnN0IGVudHJpZXNBZnRlciA9IHRoaXMudmlld01vZGVsLmVudHJpZXM7XG5cblx0XHQvLyBBcHBseSBvcGVyYXRpb24gb250byB0aGUgZW50cmllcyBmcm9tIGJlZm9yZVxuXHRcdGlmIChhZGQpIHtcblx0XHRcdGVudHJpZXNCZWZvcmUuc3BsaWNlKGVudHJpZXNBZnRlci5pbmRleE9mKGVudHJ5KSwgMCwgZW50cnkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRlbnRyaWVzQmVmb3JlLnNwbGljZShlbnRyaWVzQmVmb3JlLmluZGV4T2YoZW50cnkpLCAxKTtcblx0XHR9XG5cblx0XHQvLyBGaWd1cmUgb3V0IGlmIGEgZnVsbCByZWZyZXNoIGlzIG5lZWRlZCBieSBjb21wYXJpbmcgYXJyYXlzXG5cdFx0Y29uc3QgbmVlZHNGdWxsUmVmcmVzaCA9ICFlcXVhbHMoZW50cmllc0JlZm9yZSwgZW50cmllc0FmdGVyKTtcblxuXHRcdHJldHVybiB7IG5lZWRzRnVsbFJlZnJlc2ggfTtcblx0fVxuXG5cdGlzRW50cnlWaXNpYmxlKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMudmlld01vZGVsLmlzSGlkZGVuKGlkKTtcblx0fVxuXG5cdHVwZGF0ZUVudHJ5VmlzaWJpbGl0eShpZDogc3RyaW5nLCB2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdHRoaXMudmlld01vZGVsLnNob3coaWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnZpZXdNb2RlbC5oaWRlKGlkKTtcblx0XHR9XG5cdH1cblxuXHRmb2N1c05leHRFbnRyeSgpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXdNb2RlbC5mb2N1c05leHRFbnRyeSgpO1xuXHR9XG5cblx0Zm9jdXNQcmV2aW91c0VudHJ5KCk6IHZvaWQge1xuXHRcdHRoaXMudmlld01vZGVsLmZvY3VzUHJldmlvdXNFbnRyeSgpO1xuXHR9XG5cblx0aXNFbnRyeUZvY3VzZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsLmlzRW50cnlGb2N1c2VkKCk7XG5cdH1cblxuXHRmb2N1cyhwcmVzZXJ2ZUVudHJ5Rm9jdXMgPSB0cnVlKTogdm9pZCB7XG5cdFx0dGhpcy5nZXRDb250YWluZXIoKT8uZm9jdXMoKTtcblx0XHRjb25zdCBsYXN0Rm9jdXNlZEVudHJ5ID0gdGhpcy52aWV3TW9kZWwubGFzdEZvY3VzZWRFbnRyeTtcblx0XHRpZiAocHJlc2VydmVFbnRyeUZvY3VzICYmIGxhc3RGb2N1c2VkRW50cnkpIHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4gbGFzdEZvY3VzZWRFbnRyeS5sYWJlbENvbnRhaW5lci5mb2N1cygpLCAwKTsgLy8gTmVlZCBhIHRpbWVvdXQsIGZvciBzb21lIHJlYXNvbiB3aXRob3V0IGl0IHRoZSBpbm5lciBsYWJlbCBjb250YWluZXIgd2lsbCBub3QgZ2V0IGZvY3VzZWRcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlQ29udGVudEFyZWEocGFyZW50OiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcblx0XHR0aGlzLmVsZW1lbnQgPSBwYXJlbnQ7XG5cblx0XHQvLyBUcmFjayBmb2N1cyB3aXRoaW4gY29udGFpbmVyXG5cdFx0Y29uc3Qgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLmVsZW1lbnQpKTtcblx0XHRTdGF0dXNCYXJGb2N1c2VkLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpO1xuXG5cdFx0Ly8gTGVmdCBpdGVtcyBjb250YWluZXJcblx0XHR0aGlzLmxlZnRJdGVtc0NvbnRhaW5lciA9ICQoJy5sZWZ0LWl0ZW1zLml0ZW1zLWNvbnRhaW5lcicpO1xuXHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLmxlZnRJdGVtc0NvbnRhaW5lcik7XG5cdFx0dGhpcy5lbGVtZW50LnRhYkluZGV4ID0gMDtcblxuXHRcdC8vIFJpZ2h0IGl0ZW1zIGNvbnRhaW5lclxuXHRcdHRoaXMucmlnaHRJdGVtc0NvbnRhaW5lciA9ICQoJy5yaWdodC1pdGVtcy5pdGVtcy1jb250YWluZXInKTtcblx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5yaWdodEl0ZW1zQ29udGFpbmVyKTtcblxuXHRcdC8vIENvbnRleHQgbWVudSBzdXBwb3J0XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHBhcmVudCwgRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgZSA9PiB0aGlzLnNob3dDb250ZXh0TWVudShlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEdlc3R1cmUuYWRkVGFyZ2V0KHBhcmVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihwYXJlbnQsIFRvdWNoRXZlbnRUeXBlLkNvbnRleHRtZW51LCBlID0+IHRoaXMuc2hvd0NvbnRleHRNZW51KGUpKSk7XG5cblx0XHQvLyBJbml0aWFsIHN0YXR1cyBiYXIgZW50cmllc1xuXHRcdHRoaXMuY3JlYXRlSW5pdGlhbFN0YXR1c2JhckVudHJpZXMoKTtcblxuXHRcdHJldHVybiB0aGlzLmVsZW1lbnQ7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUluaXRpYWxTdGF0dXNiYXJFbnRyaWVzKCk6IHZvaWQge1xuXG5cdFx0Ly8gQWRkIGl0ZW1zIGluIG9yZGVyIGFjY29yZGluZyB0byBhbGlnbm1lbnRcblx0XHR0aGlzLmFwcGVuZFN0YXR1c2JhckVudHJpZXMoKTtcblxuXHRcdC8vIEZpbGwgaW4gcGVuZGluZyBlbnRyaWVzIGlmIGFueVxuXHRcdHdoaWxlICh0aGlzLnBlbmRpbmdFbnRyaWVzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgcGVuZGluZyA9IHRoaXMucGVuZGluZ0VudHJpZXMuc2hpZnQoKTtcblx0XHRcdGlmIChwZW5kaW5nKSB7XG5cdFx0XHRcdHBlbmRpbmcuYWNjZXNzb3IgPSB0aGlzLmFkZEVudHJ5KHBlbmRpbmcuZW50cnksIHBlbmRpbmcuaWQsIHBlbmRpbmcuYWxpZ25tZW50LCBwZW5kaW5nLnByaW9yaXR5LnByaW1hcnkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXBwZW5kU3RhdHVzYmFyRW50cmllcygpOiB2b2lkIHtcblx0XHRjb25zdCBsZWZ0SXRlbXNDb250YWluZXIgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5sZWZ0SXRlbXNDb250YWluZXIpO1xuXHRcdGNvbnN0IHJpZ2h0SXRlbXNDb250YWluZXIgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5yaWdodEl0ZW1zQ29udGFpbmVyKTtcblxuXHRcdC8vIENsZWFyIGNvbnRhaW5lcnNcblx0XHRjbGVhck5vZGUobGVmdEl0ZW1zQ29udGFpbmVyKTtcblx0XHRjbGVhck5vZGUocmlnaHRJdGVtc0NvbnRhaW5lcik7XG5cblx0XHQvLyBBcHBlbmQgYWxsXG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBbXG5cdFx0XHQuLi50aGlzLnZpZXdNb2RlbC5nZXRFbnRyaWVzKFN0YXR1c2JhckFsaWdubWVudC5MRUZUKSxcblx0XHRcdC4uLnRoaXMudmlld01vZGVsLmdldEVudHJpZXMoU3RhdHVzYmFyQWxpZ25tZW50LlJJR0hUKS5yZXZlcnNlKCkgLy8gcmV2ZXJzaW5nIGR1ZSB0byBmbGV4OiByb3ctcmV2ZXJzZVxuXHRcdF0pIHtcblx0XHRcdGNvbnN0IHRhcmdldCA9IGVudHJ5LmFsaWdubWVudCA9PT0gU3RhdHVzYmFyQWxpZ25tZW50LkxFRlQgPyBsZWZ0SXRlbXNDb250YWluZXIgOiByaWdodEl0ZW1zQ29udGFpbmVyO1xuXG5cdFx0XHR0YXJnZXQuYXBwZW5kQ2hpbGQoZW50cnkuY29udGFpbmVyKTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgY29tcGFjdCBlbnRyaWVzXG5cdFx0dGhpcy51cGRhdGVDb21wYWN0RW50cmllcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBlbmRTdGF0dXNiYXJFbnRyeShlbnRyeTogSVN0YXR1c2JhclZpZXdNb2RlbEVudHJ5KTogdm9pZCB7XG5cdFx0Y29uc3QgZW50cmllcyA9IHRoaXMudmlld01vZGVsLmdldEVudHJpZXMoZW50cnkuYWxpZ25tZW50KTtcblxuXHRcdGlmIChlbnRyeS5hbGlnbm1lbnQgPT09IFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCkge1xuXHRcdFx0ZW50cmllcy5yZXZlcnNlKCk7IC8vIHJldmVyc2luZyBkdWUgdG8gZmxleDogcm93LXJldmVyc2Vcblx0XHR9XG5cblx0XHRjb25zdCB0YXJnZXQgPSBhc3NlcnRJc0RlZmluZWQoZW50cnkuYWxpZ25tZW50ID09PSBTdGF0dXNiYXJBbGlnbm1lbnQuTEVGVCA/IHRoaXMubGVmdEl0ZW1zQ29udGFpbmVyIDogdGhpcy5yaWdodEl0ZW1zQ29udGFpbmVyKTtcblxuXHRcdGNvbnN0IGluZGV4ID0gZW50cmllcy5pbmRleE9mKGVudHJ5KTtcblx0XHRpZiAoaW5kZXggKyAxID09PSBlbnRyaWVzLmxlbmd0aCkge1xuXHRcdFx0dGFyZ2V0LmFwcGVuZENoaWxkKGVudHJ5LmNvbnRhaW5lcik7IC8vIGFwcGVuZCBhdCB0aGUgZW5kIGlmIGxhc3Rcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFyZ2V0Lmluc2VydEJlZm9yZShlbnRyeS5jb250YWluZXIsIGVudHJpZXNbaW5kZXggKyAxXS5jb250YWluZXIpOyAvLyBpbnNlcnQgYmVmb3JlIG5leHQgZWxlbWVudCBvdGhlcndpc2Vcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgY29tcGFjdCBlbnRyaWVzXG5cdFx0dGhpcy51cGRhdGVDb21wYWN0RW50cmllcygpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb21wYWN0RW50cmllcygpOiB2b2lkIHtcblx0XHRjb25zdCBlbnRyaWVzID0gdGhpcy52aWV3TW9kZWwuZW50cmllcztcblxuXHRcdC8vIEZpbmQgdmlzaWJsZSBlbnRyaWVzIGFuZCBjbGVhciBjb21wYWN0IHJlbGF0ZWQgQ1NTIGNsYXNzZXMgaWYgYW55XG5cdFx0Y29uc3QgbWFwSWRUb1Zpc2libGVFbnRyeSA9IG5ldyBNYXA8c3RyaW5nLCBJU3RhdHVzYmFyVmlld01vZGVsRW50cnk+KCk7XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG5cdFx0XHRpZiAoIXRoaXMudmlld01vZGVsLmlzSGlkZGVuKGVudHJ5LmlkKSkge1xuXHRcdFx0XHRtYXBJZFRvVmlzaWJsZUVudHJ5LnNldChlbnRyeS5pZCwgZW50cnkpO1xuXHRcdFx0fVxuXG5cdFx0XHRlbnRyeS5jb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnY29tcGFjdC1sZWZ0JywgJ2NvbXBhY3QtcmlnaHQnKTtcblx0XHR9XG5cblx0XHQvLyBGaWd1cmUgb3V0IGdyb3VwcyBvZiBlbnRyaWVzIHdpdGggYGNvbXBhY3RgIGFsaWdubWVudFxuXHRcdGNvbnN0IGNvbXBhY3RFbnRyeUdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCBNYXA8c3RyaW5nLCBJU3RhdHVzYmFyVmlld01vZGVsRW50cnk+PigpO1xuXHRcdGZvciAoY29uc3QgZW50cnkgb2YgbWFwSWRUb1Zpc2libGVFbnRyeS52YWx1ZXMoKSkge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHRpc1N0YXR1c2JhckVudHJ5TG9jYXRpb24oZW50cnkucHJpb3JpdHkucHJpbWFyeSkgJiYgLy8gZW50cnkgcmVmZXJlbmNlcyBhbm90aGVyIGVudHJ5IGFzIGxvY2F0aW9uXG5cdFx0XHRcdGVudHJ5LnByaW9yaXR5LnByaW1hcnkuY29tcGFjdFx0XHRcdFx0XHRcdC8vIGVudHJ5IHdhbnRzIHRvIGJlIGNvbXBhY3Rcblx0XHRcdCkge1xuXHRcdFx0XHRjb25zdCBsb2NhdGlvbklkID0gZW50cnkucHJpb3JpdHkucHJpbWFyeS5sb2NhdGlvbi5pZDtcblx0XHRcdFx0Y29uc3QgbG9jYXRpb24gPSBtYXBJZFRvVmlzaWJsZUVudHJ5LmdldChsb2NhdGlvbklkKTtcblx0XHRcdFx0aWYgKCFsb2NhdGlvbikge1xuXHRcdFx0XHRcdGNvbnRpbnVlOyAvLyBza2lwIGlmIGxvY2F0aW9uIGRvZXMgbm90IGV4aXN0XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBCdWlsZCBhIG1hcCBvZiBlbnRyaWVzIHRoYXQgYXJlIGNvbXBhY3QgYW1vbmcgZWFjaCBvdGhlclxuXHRcdFx0XHRsZXQgY29tcGFjdEVudHJ5R3JvdXAgPSBjb21wYWN0RW50cnlHcm91cHMuZ2V0KGxvY2F0aW9uSWQpO1xuXHRcdFx0XHRpZiAoIWNvbXBhY3RFbnRyeUdyb3VwKSB7XG5cblx0XHRcdFx0XHQvLyBJdCBpcyBwb3NzaWJsZSB0aGF0IHRoaXMgZW50cnkgcmVmZXJlbmNlcyBhbm90aGVyIGVudHJ5XG5cdFx0XHRcdFx0Ly8gdGhhdCBpdHNlbGYgcmVmZXJlbmNlcyBhbiBlbnRyeS4gSW4gdGhhdCBjYXNlLCB3ZSB3YW50XG5cdFx0XHRcdFx0Ly8gdG8gYWRkIGl0IHRvIHRoZSBlbnRyaWVzIG9mIHRoZSByZWZlcmVuY2VkIGVudHJ5LlxuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiBjb21wYWN0RW50cnlHcm91cHMudmFsdWVzKCkpIHtcblx0XHRcdFx0XHRcdGlmIChncm91cC5oYXMobG9jYXRpb25JZCkpIHtcblx0XHRcdFx0XHRcdFx0Y29tcGFjdEVudHJ5R3JvdXAgPSBncm91cDtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKCFjb21wYWN0RW50cnlHcm91cCkge1xuXHRcdFx0XHRcdFx0Y29tcGFjdEVudHJ5R3JvdXAgPSBuZXcgTWFwPHN0cmluZywgSVN0YXR1c2JhclZpZXdNb2RlbEVudHJ5PigpO1xuXHRcdFx0XHRcdFx0Y29tcGFjdEVudHJ5R3JvdXBzLnNldChsb2NhdGlvbklkLCBjb21wYWN0RW50cnlHcm91cCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbXBhY3RFbnRyeUdyb3VwLnNldChlbnRyeS5pZCwgZW50cnkpO1xuXHRcdFx0XHRjb21wYWN0RW50cnlHcm91cC5zZXQobG9jYXRpb24uaWQsIGxvY2F0aW9uKTtcblxuXHRcdFx0XHQvLyBBZGp1c3QgQ1NTIGNsYXNzZXMgdG8gbW92ZSBjb21wYWN0IGl0ZW1zIGNsb3NlciB0b2dldGhlclxuXHRcdFx0XHRpZiAoZW50cnkucHJpb3JpdHkucHJpbWFyeS5hbGlnbm1lbnQgPT09IFN0YXR1c2JhckFsaWdubWVudC5MRUZUKSB7XG5cdFx0XHRcdFx0bG9jYXRpb24uY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2NvbXBhY3QtbGVmdCcpO1xuXHRcdFx0XHRcdGVudHJ5LmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdjb21wYWN0LXJpZ2h0Jyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bG9jYXRpb24uY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2NvbXBhY3QtcmlnaHQnKTtcblx0XHRcdFx0XHRlbnRyeS5jb250YWluZXIuY2xhc3NMaXN0LmFkZCgnY29tcGFjdC1sZWZ0Jyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJbnN0YWxsIG1vdXNlIGxpc3RlbmVycyB0byB1cGRhdGUgaG92ZXIgZmVlZGJhY2sgZm9yXG5cdFx0Ly8gYWxsIGNvbXBhY3QgZW50cmllcyB0aGF0IGJlbG9uZyB0byBlYWNoIG90aGVyXG5cdFx0Y29uc3Qgc3RhdHVzQmFySXRlbUhvdmVyQmFja2dyb3VuZCA9IHRoaXMuZ2V0Q29sb3IoU1RBVFVTX0JBUl9JVEVNX0hPVkVSX0JBQ0tHUk9VTkQpO1xuXHRcdGNvbnN0IHN0YXR1c0Jhckl0ZW1Db21wYWN0SG92ZXJCYWNrZ3JvdW5kID0gdGhpcy5nZXRDb2xvcihTVEFUVVNfQkFSX0lURU1fQ09NUEFDVF9IT1ZFUl9CQUNLR1JPVU5EKTtcblx0XHR0aGlzLmNvbXBhY3RFbnRyaWVzRGlzcG9zYWJsZS52YWx1ZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpZiAoc3RhdHVzQmFySXRlbUhvdmVyQmFja2dyb3VuZCAmJiBzdGF0dXNCYXJJdGVtQ29tcGFjdEhvdmVyQmFja2dyb3VuZCAmJiAhaXNIaWdoQ29udHJhc3QodGhpcy50aGVtZS50eXBlKSkge1xuXHRcdFx0Zm9yIChjb25zdCBbLCBjb21wYWN0RW50cnlHcm91cF0gb2YgY29tcGFjdEVudHJ5R3JvdXBzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgY29tcGFjdEVudHJ5IG9mIGNvbXBhY3RFbnRyeUdyb3VwLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0aWYgKCFjb21wYWN0RW50cnkuaGFzQ29tbWFuZCkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7IC8vIG9ubHkgc2hvdyBob3ZlciBmZWVkYmFjayB3aGVuIHdlIGhhdmUgYSBjb21tYW5kXG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5jb21wYWN0RW50cmllc0Rpc3Bvc2FibGUudmFsdWUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihjb21wYWN0RW50cnkubGFiZWxDb250YWluZXIsIEV2ZW50VHlwZS5NT1VTRV9PVkVSLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb21wYWN0RW50cnlHcm91cC5mb3JFYWNoKGNvbXBhY3RFbnRyeSA9PiBjb21wYWN0RW50cnkubGFiZWxDb250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gc3RhdHVzQmFySXRlbUhvdmVyQmFja2dyb3VuZCk7XG5cdFx0XHRcdFx0XHRjb21wYWN0RW50cnkubGFiZWxDb250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gc3RhdHVzQmFySXRlbUNvbXBhY3RIb3ZlckJhY2tncm91bmQ7XG5cdFx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdFx0dGhpcy5jb21wYWN0RW50cmllc0Rpc3Bvc2FibGUudmFsdWUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihjb21wYWN0RW50cnkubGFiZWxDb250YWluZXIsIEV2ZW50VHlwZS5NT1VTRV9PVVQsICgpID0+IHtcblx0XHRcdFx0XHRcdGNvbXBhY3RFbnRyeUdyb3VwLmZvckVhY2goY29tcGFjdEVudHJ5ID0+IGNvbXBhY3RFbnRyeS5sYWJlbENvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJyk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzaG93Q29udGV4dE1lbnUoZTogTW91c2VFdmVudCB8IEdlc3R1cmVFdmVudCk6IHZvaWQge1xuXHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KHRoaXMuZWxlbWVudCksIGUpO1xuXG5cdFx0bGV0IGFjdGlvbnM6IElBY3Rpb25bXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBldmVudCxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0YWN0aW9ucyA9IHRoaXMuZ2V0Q29udGV4dE1lbnVBY3Rpb25zKGV2ZW50KTtcblxuXHRcdFx0XHRyZXR1cm4gYWN0aW9ucztcblx0XHRcdH0sXG5cdFx0XHRvbkhpZGU6ICgpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbnMpIHtcblx0XHRcdFx0XHRkaXNwb3NlSWZEaXNwb3NhYmxlKGFjdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbnRleHRNZW51QWN0aW9ucyhldmVudDogU3RhbmRhcmRNb3VzZUV2ZW50KTogSUFjdGlvbltdIHtcblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblxuXHRcdC8vIFByb3ZpZGUgYW4gYWN0aW9uIHRvIGhpZGUgdGhlIHN0YXR1cyBiYXIgYXQgbGFzdFxuXHRcdGFjdGlvbnMucHVzaCh0b0FjdGlvbih7IGlkOiBUb2dnbGVTdGF0dXNiYXJWaXNpYmlsaXR5QWN0aW9uLklELCBsYWJlbDogbG9jYWxpemUoJ2hpZGVTdGF0dXNCYXInLCBcIkhpZGUgU3RhdHVzIEJhclwiKSwgcnVuOiAoKSA9PiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IG5ldyBUb2dnbGVTdGF0dXNiYXJWaXNpYmlsaXR5QWN0aW9uKCkucnVuKGFjY2Vzc29yKSkgfSkpO1xuXHRcdGFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXG5cdFx0Ly8gU2hvdyBhbiBlbnRyeSBwZXIga25vd24gc3RhdHVzIGVudHJ5XG5cdFx0Ly8gTm90ZTogZXZlbiB0aG91Z2ggZW50cmllcyBoYXZlIGFuIGlkZW50aWZpZXIsIHRoZXJlIGNhbiBiZSBtdWx0aXBsZSBlbnRyaWVzXG5cdFx0Ly8gaGF2aW5nIHRoZSBzYW1lIGlkZW50aWZpZXIgKGUuZy4gZnJvbSBleHRlbnNpb25zKS4gU28gd2UgbWFrZSBzdXJlIHRvIG9ubHlcblx0XHQvLyBzaG93IGEgc2luZ2xlIGVudHJ5IHBlciBpZGVudGlmaWVyIHdlIGhhbmRsZWQuXG5cdFx0Y29uc3QgaGFuZGxlZEVudHJpZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMudmlld01vZGVsLmVudHJpZXMpIHtcblx0XHRcdGlmICghaGFuZGxlZEVudHJpZXMuaGFzKGVudHJ5LmlkKSkge1xuXHRcdFx0XHRhY3Rpb25zLnB1c2gobmV3IFRvZ2dsZVN0YXR1c2JhckVudHJ5VmlzaWJpbGl0eUFjdGlvbihlbnRyeS5pZCwgZW50cnkubmFtZSwgdGhpcy52aWV3TW9kZWwpKTtcblx0XHRcdFx0aGFuZGxlZEVudHJpZXMuYWRkKGVudHJ5LmlkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBGaWd1cmUgb3V0IGlmIG1vdXNlIGlzIG92ZXIgYW4gZW50cnlcblx0XHRsZXQgc3RhdHVzRW50cnlVbmRlck1vdXNlOiBJU3RhdHVzYmFyVmlld01vZGVsRW50cnkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Zm9yIChsZXQgZWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsID0gZXZlbnQudGFyZ2V0OyBlbGVtZW50OyBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnRFbGVtZW50KSB7XG5cdFx0XHRjb25zdCBlbnRyeSA9IHRoaXMudmlld01vZGVsLmZpbmRFbnRyeShlbGVtZW50KTtcblx0XHRcdGlmIChlbnRyeSkge1xuXHRcdFx0XHRzdGF0dXNFbnRyeVVuZGVyTW91c2UgPSBlbnRyeTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXR1c0VudHJ5VW5kZXJNb3VzZSkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHRpZiAoc3RhdHVzRW50cnlVbmRlck1vdXNlLmV4dGVuc2lvbklkKSB7XG5cdFx0XHRcdGFjdGlvbnMucHVzaCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hbmFnZUV4dGVuc2lvbkFjdGlvbiwgc3RhdHVzRW50cnlVbmRlck1vdXNlLmV4dGVuc2lvbklkKSk7XG5cdFx0XHR9XG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IEhpZGVTdGF0dXNiYXJFbnRyeUFjdGlvbihzdGF0dXNFbnRyeVVuZGVyTW91c2UuaWQsIHN0YXR1c0VudHJ5VW5kZXJNb3VzZS5uYW1lLCB0aGlzLnZpZXdNb2RlbCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhY3Rpb25zO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlU3R5bGVzKCk6IHZvaWQge1xuXHRcdHN1cGVyLnVwZGF0ZVN0eWxlcygpO1xuXG5cdFx0Y29uc3QgY29udGFpbmVyID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuZ2V0Q29udGFpbmVyKCkpO1xuXHRcdGNvbnN0IHN0eWxlT3ZlcnJpZGU6IElTdGF0dXNiYXJTdHlsZU92ZXJyaWRlIHwgdW5kZWZpbmVkID0gWy4uLnRoaXMuc3R5bGVPdmVycmlkZXNdLnNvcnQoKGEsIGIpID0+IGEucHJpb3JpdHkgLSBiLnByaW9yaXR5KVswXTtcblxuXHRcdC8vIEJhY2tncm91bmQgLyBmb3JlZ3JvdW5kIGNvbG9yc1xuXHRcdGNvbnN0IGJhY2tncm91bmRDb2xvciA9IHRoaXMuZ2V0Q29sb3Ioc3R5bGVPdmVycmlkZT8uYmFja2dyb3VuZCA/PyAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSA/IFNUQVRVU19CQVJfQkFDS0dST1VORCA6IFNUQVRVU19CQVJfTk9fRk9MREVSX0JBQ0tHUk9VTkQpKSB8fCAnJztcblx0XHRjb250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYmFja2dyb3VuZENvbG9yO1xuXHRcdGNvbnN0IGZvcmVncm91bmRDb2xvciA9IHRoaXMuZ2V0Q29sb3Ioc3R5bGVPdmVycmlkZT8uZm9yZWdyb3VuZCA/PyAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSA/IFNUQVRVU19CQVJfRk9SRUdST1VORCA6IFNUQVRVU19CQVJfTk9fRk9MREVSX0ZPUkVHUk9VTkQpKSB8fCAnJztcblx0XHRjb250YWluZXIuc3R5bGUuY29sb3IgPSBmb3JlZ3JvdW5kQ29sb3I7XG5cdFx0Y29uc3QgaXRlbUJvcmRlckNvbG9yID0gdGhpcy5nZXRDb2xvcihTVEFUVVNfQkFSX0lURU1fRk9DVVNfQk9SREVSKTtcblxuXHRcdC8vIEJvcmRlciBjb2xvclxuXHRcdGNvbnN0IGJvcmRlckNvbG9yID0gdGhpcy5nZXRDb2xvcihzdHlsZU92ZXJyaWRlPy5ib3JkZXIgPz8gKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSAhPT0gV29ya2JlbmNoU3RhdGUuRU1QVFkgPyBTVEFUVVNfQkFSX0JPUkRFUiA6IFNUQVRVU19CQVJfTk9fRk9MREVSX0JPUkRFUikpIHx8IHRoaXMuZ2V0Q29sb3IoY29udHJhc3RCb3JkZXIpO1xuXHRcdGlmIChib3JkZXJDb2xvcikge1xuXHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3N0YXR1cy1ib3JkZXItdG9wJyk7XG5cdFx0XHRjb250YWluZXIuc3R5bGUuc2V0UHJvcGVydHkoJy0tc3RhdHVzLWJvcmRlci10b3AtY29sb3InLCBib3JkZXJDb2xvcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdzdGF0dXMtYm9yZGVyLXRvcCcpO1xuXHRcdFx0Y29udGFpbmVyLnN0eWxlLnJlbW92ZVByb3BlcnR5KCctLXN0YXR1cy1ib3JkZXItdG9wLWNvbG9yJyk7XG5cdFx0fVxuXG5cdFx0Ly8gQ29sb3JzIGFuZCBmb2N1cyBvdXRsaW5lcyB2aWEgZHluYW1pYyBzdHlsZXNoZWV0XG5cblx0XHRjb25zdCBzdGF0dXNCYXJGb2N1c0NvbG9yID0gdGhpcy5nZXRDb2xvcihTVEFUVVNfQkFSX0ZPQ1VTX0JPUkRFUik7XG5cblx0XHRpZiAoIXRoaXMuc3R5bGVFbGVtZW50KSB7XG5cdFx0XHR0aGlzLnN0eWxlRWxlbWVudCA9IGNyZWF0ZVN0eWxlU2hlZXQoY29udGFpbmVyKTtcblx0XHR9XG5cblx0XHR0aGlzLnN0eWxlRWxlbWVudC50ZXh0Q29udGVudCA9IGBcblxuXHRcdFx0XHQvKiBTdGF0dXMgYmFyIGZvY3VzIG91dGxpbmUgKi9cblx0XHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuc3RhdHVzYmFyOmZvY3VzIHtcblx0XHRcdFx0XHRvdXRsaW5lLWNvbG9yOiAke3N0YXR1c0JhckZvY3VzQ29sb3J9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0LyogU3RhdHVzIGJhciBpdGVtIGZvY3VzIG91dGxpbmUgKi9cblx0XHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuc3RhdHVzYmFyID4gLml0ZW1zLWNvbnRhaW5lciA+IC5zdGF0dXNiYXItaXRlbSBhOmZvY3VzLXZpc2libGUge1xuXHRcdFx0XHRcdG91dGxpbmU6IDFweCBzb2xpZCAke3RoaXMuZ2V0Q29sb3IoYWN0aXZlQ29udHJhc3RCb3JkZXIpID8/IGl0ZW1Cb3JkZXJDb2xvcn07XG5cdFx0XHRcdFx0b3V0bGluZS1vZmZzZXQ6ICR7Ym9yZGVyQ29sb3IgPyAnLTJweCcgOiAnLTFweCd9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0LyogTm90aWZpY2F0aW9uIEJlYWsgKi9cblx0XHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLnBhcnQuc3RhdHVzYmFyID4gLml0ZW1zLWNvbnRhaW5lciA+IC5zdGF0dXNiYXItaXRlbS5oYXMtYmVhayA+IC5zdGF0dXMtYmFyLWl0ZW0tYmVhay1jb250YWluZXI6YmVmb3JlIHtcblx0XHRcdFx0XHRib3JkZXItYm90dG9tLWNvbG9yOiAke2JhY2tncm91bmRDb2xvcn07XG5cdFx0XHRcdH1cblx0XHRcdGA7XG5cdH1cblxuXHRvdmVycmlkZSBsYXlvdXQod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHRvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXQod2lkdGgsIGhlaWdodCwgdG9wLCBsZWZ0KTtcblx0XHRzdXBlci5sYXlvdXRDb250ZW50cyh3aWR0aCwgaGVpZ2h0KTtcblx0fVxuXG5cdG92ZXJyaWRlU3R5bGUoc3R5bGU6IElTdGF0dXNiYXJTdHlsZU92ZXJyaWRlKTogSURpc3Bvc2FibGUge1xuXHRcdHRoaXMuc3R5bGVPdmVycmlkZXMuYWRkKHN0eWxlKTtcblx0XHR0aGlzLnVwZGF0ZVN0eWxlcygpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnN0eWxlT3ZlcnJpZGVzLmRlbGV0ZShzdHlsZSk7XG5cdFx0XHR0aGlzLnVwZGF0ZVN0eWxlcygpO1xuXHRcdH0pO1xuXHR9XG5cblx0dG9KU09OKCk6IG9iamVjdCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6IFBhcnRzLlNUQVRVU0JBUl9QQVJUXG5cdFx0fTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fb25XaWxsRGlzcG9zZS5maXJlKCk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1haW5TdGF0dXNiYXJQYXJ0IGV4dGVuZHMgU3RhdHVzYmFyUGFydCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihQYXJ0cy5TVEFUVVNCQVJfUEFSVCwgaW5zdGFudGlhdGlvblNlcnZpY2UsIHRoZW1lU2VydmljZSwgY29udGV4dFNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBdXhpbGlhcnlTdGF0dXNiYXJQYXJ0IGV4dGVuZHMgSVN0YXR1c2JhckVudHJ5Q29udGFpbmVyLCBJVmlldyB7XG5cdHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGhlaWdodDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgQXV4aWxpYXJ5U3RhdHVzYmFyUGFydCBleHRlbmRzIFN0YXR1c2JhclBhcnQgaW1wbGVtZW50cyBJQXV4aWxpYXJ5U3RhdHVzYmFyUGFydCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgQ09VTlRFUiA9IDE7XG5cblx0cmVhZG9ubHkgaGVpZ2h0ID0gU3RhdHVzYmFyUGFydC5IRUlHSFQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdCkge1xuXHRcdGNvbnN0IGlkID0gQXV4aWxpYXJ5U3RhdHVzYmFyUGFydC5DT1VOVEVSKys7XG5cdFx0c3VwZXIoYHdvcmtiZW5jaC5wYXJ0cy5hdXhpbGlhcnlTdGF0dXMuJHtpZH1gLCBpbnN0YW50aWF0aW9uU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBjb250ZXh0U2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIGxheW91dFNlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTdGF0dXNiYXJTZXJ2aWNlIGV4dGVuZHMgTXVsdGlXaW5kb3dQYXJ0czxTdGF0dXNiYXJQYXJ0PiBpbXBsZW1lbnRzIElTdGF0dXNiYXJTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBtYWluUGFydDogTWFpblN0YXR1c2JhclBhcnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDcmVhdGVBdXhpbGlhcnlTdGF0dXNiYXJQYXJ0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8QXV4aWxpYXJ5U3RhdHVzYmFyUGFydD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRDcmVhdGVBdXhpbGlhcnlTdGF0dXNiYXJQYXJ0ID0gdGhpcy5fb25EaWRDcmVhdGVBdXhpbGlhcnlTdGF0dXNiYXJQYXJ0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoJ3dvcmtiZW5jaC5zdGF0dXNCYXJTZXJ2aWNlJywgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cblx0XHR0aGlzLm1haW5QYXJ0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYWluU3RhdHVzYmFyUGFydCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVnaXN0ZXJQYXJ0KHRoaXMubWFpblBhcnQpKTtcblxuXHRcdHRoaXMub25EaWRDaGFuZ2VFbnRyeVZpc2liaWxpdHkgPSB0aGlzLm1haW5QYXJ0Lm9uRGlkQ2hhbmdlRW50cnlWaXNpYmlsaXR5O1xuXHR9XG5cblx0Ly8jcmVnaW9uIEF1eGlsaWFyeSBTdGF0dXNiYXIgUGFydHNcblxuXHRjcmVhdGVBdXhpbGlhcnlTdGF0dXNiYXJQYXJ0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJQXV4aWxpYXJ5U3RhdHVzYmFyUGFydCB7XG5cblx0XHQvLyBDb250YWluZXJcblx0XHRjb25zdCBzdGF0dXNiYXJQYXJ0Q29udGFpbmVyID0gJCgnZm9vdGVyLnBhcnQuc3RhdHVzYmFyJywge1xuXHRcdFx0J3JvbGUnOiAnc3RhdHVzJyxcblx0XHRcdCdhcmlhLWxpdmUnOiAnb2ZmJyxcblx0XHRcdCd0YWJJbmRleCc6ICcwJ1xuXHRcdH0pO1xuXHRcdHN0YXR1c2JhclBhcnRDb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChzdGF0dXNiYXJQYXJ0Q29udGFpbmVyKTtcblxuXHRcdC8vIFN0YXR1c2JhciBQYXJ0XG5cdFx0Y29uc3Qgc3RhdHVzYmFyUGFydCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQXV4aWxpYXJ5U3RhdHVzYmFyUGFydCwgc3RhdHVzYmFyUGFydENvbnRhaW5lcik7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXMucmVnaXN0ZXJQYXJ0KHN0YXR1c2JhclBhcnQpO1xuXG5cdFx0c3RhdHVzYmFyUGFydC5jcmVhdGUoc3RhdHVzYmFyUGFydENvbnRhaW5lcik7XG5cblx0XHRFdmVudC5vbmNlKHN0YXR1c2JhclBhcnQub25XaWxsRGlzcG9zZSkoKCkgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkpO1xuXG5cdFx0Ly8gRW1pdCBpbnRlcm5hbCBldmVudFxuXHRcdHRoaXMuX29uRGlkQ3JlYXRlQXV4aWxpYXJ5U3RhdHVzYmFyUGFydC5maXJlKHN0YXR1c2JhclBhcnQpO1xuXG5cdFx0cmV0dXJuIHN0YXR1c2JhclBhcnQ7XG5cdH1cblxuXHRjcmVhdGVTY29wZWQoc3RhdHVzYmFyRW50cnlDb250YWluZXI6IElTdGF0dXNiYXJFbnRyeUNvbnRhaW5lciwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IElTdGF0dXNiYXJTZXJ2aWNlIHtcblx0XHRyZXR1cm4gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2NvcGVkU3RhdHVzYmFyU2VydmljZSwgc3RhdHVzYmFyRW50cnlDb250YWluZXIpKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBTZXJ2aWNlIEltcGxlbWVudGF0aW9uXG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VFbnRyeVZpc2liaWxpdHk6IEV2ZW50PHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbiB9PjtcblxuXHRhZGRFbnRyeShlbnRyeTogSVN0YXR1c2JhckVudHJ5LCBpZDogc3RyaW5nLCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudCwgcHJpb3JpdHlPckxvY2F0aW9uOiBudW1iZXIgfCBJU3RhdHVzYmFyRW50cnlMb2NhdGlvbiB8IElTdGF0dXNiYXJFbnRyeVByaW9yaXR5ID0gMCk6IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yIHtcblx0XHRpZiAoZW50cnkuc2hvd0luQWxsV2luZG93cykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9BZGRFbnRyeVRvQWxsV2luZG93cyhlbnRyeSwgaWQsIGFsaWdubWVudCwgcHJpb3JpdHlPckxvY2F0aW9uKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5tYWluUGFydC5hZGRFbnRyeShlbnRyeSwgaWQsIGFsaWdubWVudCwgcHJpb3JpdHlPckxvY2F0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgZG9BZGRFbnRyeVRvQWxsV2luZG93cyhvcmlnaW5hbEVudHJ5OiBJU3RhdHVzYmFyRW50cnksIGlkOiBzdHJpbmcsIGFsaWdubWVudDogU3RhdHVzYmFyQWxpZ25tZW50LCBwcmlvcml0eU9yTG9jYXRpb246IG51bWJlciB8IElTdGF0dXNiYXJFbnRyeUxvY2F0aW9uIHwgSVN0YXR1c2JhckVudHJ5UHJpb3JpdHkgPSAwKTogSVN0YXR1c2JhckVudHJ5QWNjZXNzb3Ige1xuXHRcdGNvbnN0IGVudHJ5RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBhY2Nlc3NvcnMgPSBuZXcgU2V0PElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yPigpO1xuXG5cdFx0bGV0IGVudHJ5ID0gb3JpZ2luYWxFbnRyeTtcblx0XHRmdW5jdGlvbiBhZGRFbnRyeShwYXJ0OiBTdGF0dXNiYXJQYXJ0IHwgQXV4aWxpYXJ5U3RhdHVzYmFyUGFydCk6IHZvaWQge1xuXHRcdFx0Y29uc3QgcGFydERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0cGFydERpc3Bvc2FibGVzLmFkZChwYXJ0Lm9uV2lsbERpc3Bvc2UoKCkgPT4gcGFydERpc3Bvc2FibGVzLmRpc3Bvc2UoKSkpO1xuXG5cdFx0XHRjb25zdCBhY2Nlc3NvciA9IHBhcnREaXNwb3NhYmxlcy5hZGQocGFydC5hZGRFbnRyeShlbnRyeSwgaWQsIGFsaWdubWVudCwgcHJpb3JpdHlPckxvY2F0aW9uKSk7XG5cdFx0XHRhY2Nlc3NvcnMuYWRkKGFjY2Vzc29yKTtcblx0XHRcdHBhcnREaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGFjY2Vzc29ycy5kZWxldGUoYWNjZXNzb3IpKSk7XG5cblx0XHRcdGVudHJ5RGlzcG9zYWJsZXMuYWRkKHBhcnREaXNwb3NhYmxlcyk7XG5cdFx0XHRwYXJ0RGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBlbnRyeURpc3Bvc2FibGVzLmRlbGV0ZShwYXJ0RGlzcG9zYWJsZXMpKSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHRoaXMucGFydHMpIHtcblx0XHRcdGFkZEVudHJ5KHBhcnQpO1xuXHRcdH1cblxuXHRcdGVudHJ5RGlzcG9zYWJsZXMuYWRkKHRoaXMub25EaWRDcmVhdGVBdXhpbGlhcnlTdGF0dXNiYXJQYXJ0KHBhcnQgPT4gYWRkRW50cnkocGFydCkpKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHR1cGRhdGU6ICh1cGRhdGVkRW50cnk6IElTdGF0dXNiYXJFbnRyeSkgPT4ge1xuXHRcdFx0XHRlbnRyeSA9IHVwZGF0ZWRFbnRyeTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IHVwZGF0ZSBvZiBhY2Nlc3NvcnMpIHtcblx0XHRcdFx0XHR1cGRhdGUudXBkYXRlKHVwZGF0ZWRFbnRyeSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiBlbnRyeURpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuXHRcdH07XG5cdH1cblxuXHRpc0VudHJ5VmlzaWJsZShpZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubWFpblBhcnQuaXNFbnRyeVZpc2libGUoaWQpO1xuXHR9XG5cblx0dXBkYXRlRW50cnlWaXNpYmlsaXR5KGlkOiBzdHJpbmcsIHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHBhcnQgb2YgdGhpcy5wYXJ0cykge1xuXHRcdFx0cGFydC51cGRhdGVFbnRyeVZpc2liaWxpdHkoaWQsIHZpc2libGUpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlRW50cnkoaWQ6IHN0cmluZywgb3ZlcnJpZGU6IFBhcnRpYWw8SVN0YXR1c2JhckVudHJ5Pik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGZvciAoY29uc3QgcGFydCBvZiB0aGlzLnBhcnRzKSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocGFydC5vdmVycmlkZUVudHJ5KGlkLCBvdmVycmlkZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdGZvY3VzKHByZXNlcnZlRW50cnlGb2N1cz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmFjdGl2ZVBhcnQuZm9jdXMocHJlc2VydmVFbnRyeUZvY3VzKTtcblx0fVxuXG5cdGZvY3VzTmV4dEVudHJ5KCk6IHZvaWQge1xuXHRcdHRoaXMuYWN0aXZlUGFydC5mb2N1c05leHRFbnRyeSgpO1xuXHR9XG5cblx0Zm9jdXNQcmV2aW91c0VudHJ5KCk6IHZvaWQge1xuXHRcdHRoaXMuYWN0aXZlUGFydC5mb2N1c1ByZXZpb3VzRW50cnkoKTtcblx0fVxuXG5cdGlzRW50cnlGb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmFjdGl2ZVBhcnQuaXNFbnRyeUZvY3VzZWQoKTtcblx0fVxuXG5cdG92ZXJyaWRlU3R5bGUoc3R5bGU6IElTdGF0dXNiYXJTdHlsZU92ZXJyaWRlKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHRoaXMucGFydHMpIHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChwYXJ0Lm92ZXJyaWRlU3R5bGUoc3R5bGUpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZGlzcG9zYWJsZXM7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cblxuZXhwb3J0IGNsYXNzIFNjb3BlZFN0YXR1c2JhclNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVN0YXR1c2JhclNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc3RhdHVzYmFyRW50cnlDb250YWluZXI6IElTdGF0dXNiYXJFbnRyeUNvbnRhaW5lcixcblx0XHRASVN0YXR1c2JhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdGF0dXNiYXJTZXJ2aWNlOiBJU3RhdHVzYmFyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5vbkRpZENoYW5nZUVudHJ5VmlzaWJpbGl0eSA9IHRoaXMuc3RhdHVzYmFyRW50cnlDb250YWluZXIub25EaWRDaGFuZ2VFbnRyeVZpc2liaWxpdHk7XG5cdH1cblxuXHRjcmVhdGVBdXhpbGlhcnlTdGF0dXNiYXJQYXJ0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJQXV4aWxpYXJ5U3RhdHVzYmFyUGFydCB7XG5cdFx0cmV0dXJuIHRoaXMuc3RhdHVzYmFyU2VydmljZS5jcmVhdGVBdXhpbGlhcnlTdGF0dXNiYXJQYXJ0KGNvbnRhaW5lcik7XG5cdH1cblxuXHRjcmVhdGVTY29wZWQoc3RhdHVzYmFyRW50cnlDb250YWluZXI6IElTdGF0dXNiYXJFbnRyeUNvbnRhaW5lciwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IElTdGF0dXNiYXJTZXJ2aWNlIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0dXNiYXJTZXJ2aWNlLmNyZWF0ZVNjb3BlZChzdGF0dXNiYXJFbnRyeUNvbnRhaW5lciwgZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0Z2V0UGFydCgpOiBJU3RhdHVzYmFyRW50cnlDb250YWluZXIge1xuXHRcdHJldHVybiB0aGlzLnN0YXR1c2JhckVudHJ5Q29udGFpbmVyO1xuXHR9XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VFbnRyeVZpc2liaWxpdHk6IEV2ZW50PHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbiB9PjtcblxuXHRhZGRFbnRyeShlbnRyeTogSVN0YXR1c2JhckVudHJ5LCBpZDogc3RyaW5nLCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudCwgcHJpb3JpdHlPckxvY2F0aW9uOiBudW1iZXIgfCBJU3RhdHVzYmFyRW50cnlMb2NhdGlvbiB8IElTdGF0dXNiYXJFbnRyeVByaW9yaXR5ID0gMCk6IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0dXNiYXJFbnRyeUNvbnRhaW5lci5hZGRFbnRyeShlbnRyeSwgaWQsIGFsaWdubWVudCwgcHJpb3JpdHlPckxvY2F0aW9uKTtcblx0fVxuXG5cdGlzRW50cnlWaXNpYmxlKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0dXNiYXJFbnRyeUNvbnRhaW5lci5pc0VudHJ5VmlzaWJsZShpZCk7XG5cdH1cblxuXHR1cGRhdGVFbnRyeVZpc2liaWxpdHkoaWQ6IHN0cmluZywgdmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuc3RhdHVzYmFyRW50cnlDb250YWluZXIudXBkYXRlRW50cnlWaXNpYmlsaXR5KGlkLCB2aXNpYmxlKTtcblx0fVxuXG5cdG92ZXJyaWRlRW50cnkoaWQ6IHN0cmluZywgb3ZlcnJpZGU6IFBhcnRpYWw8SVN0YXR1c2JhckVudHJ5Pik6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0dXNiYXJFbnRyeUNvbnRhaW5lci5vdmVycmlkZUVudHJ5KGlkLCBvdmVycmlkZSk7XG5cdH1cblxuXHRmb2N1cyhwcmVzZXJ2ZUVudHJ5Rm9jdXM/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5zdGF0dXNiYXJFbnRyeUNvbnRhaW5lci5mb2N1cyhwcmVzZXJ2ZUVudHJ5Rm9jdXMpO1xuXHR9XG5cblx0Zm9jdXNOZXh0RW50cnkoKTogdm9pZCB7XG5cdFx0dGhpcy5zdGF0dXNiYXJFbnRyeUNvbnRhaW5lci5mb2N1c05leHRFbnRyeSgpO1xuXHR9XG5cblx0Zm9jdXNQcmV2aW91c0VudHJ5KCk6IHZvaWQge1xuXHRcdHRoaXMuc3RhdHVzYmFyRW50cnlDb250YWluZXIuZm9jdXNQcmV2aW91c0VudHJ5KCk7XG5cdH1cblxuXHRpc0VudHJ5Rm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0dXNiYXJFbnRyeUNvbnRhaW5lci5pc0VudHJ5Rm9jdXNlZCgpO1xuXHR9XG5cblx0b3ZlcnJpZGVTdHlsZShzdHlsZTogSVN0YXR1c2JhclN0eWxlT3ZlcnJpZGUpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIHRoaXMuc3RhdHVzYmFyRW50cnlDb250YWluZXIub3ZlcnJpZGVTdHlsZShzdHlsZSk7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVN0YXR1c2JhclNlcnZpY2UsIFN0YXR1c2JhclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2Vy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
