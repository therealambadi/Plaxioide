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
import { LayoutPriority, Orientation, Sizing, SplitView } from "../../../../base/browser/ui/splitview/splitview.js";
import { Disposable, DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITerminalConfigurationService, ITerminalGroupService, ITerminalService, TerminalConnectionState } from "./terminal.js";
import { TerminalTabsListSizes, TerminalTabList } from "./terminalTabsList.js";
import * as dom from "../../../../base/browser/dom.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { TerminalSettingId } from "../../../../platform/terminal/common/terminal.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { localize } from "../../../../nls.js";
import { openContextMenu } from "./terminalContextMenu.js";
import { TerminalStorageKeys } from "../common/terminalStorageKeys.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { getInstanceHoverInfo } from "./terminalTooltip.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const $ = dom.$;
var CssClass = /* @__PURE__ */ ((CssClass2) => {
  CssClass2["ViewIsVertical"] = "terminal-side-view";
  return CssClass2;
})(CssClass || {});
var WidthConstants = /* @__PURE__ */ ((WidthConstants2) => {
  WidthConstants2[WidthConstants2["StatusIcon"] = 30] = "StatusIcon";
  WidthConstants2[WidthConstants2["SplitAnnotation"] = 30] = "SplitAnnotation";
  return WidthConstants2;
})(WidthConstants || {});
let TerminalTabbedView = class extends Disposable {
  constructor(parentElement, _terminalService, _terminalConfigurationService, _terminalGroupService, _instantiationService, _contextMenuService, _configurationService, menuService, _storageService, contextKeyService, _hoverService) {
    super();
    this._terminalService = _terminalService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalGroupService = _terminalGroupService;
    this._instantiationService = _instantiationService;
    this._contextMenuService = _contextMenuService;
    this._configurationService = _configurationService;
    this._storageService = _storageService;
    this._hoverService = _hoverService;
    this._cancelContextMenu = false;
    this._tabContainer = $(".tabs-container");
    const tabListContainer = $(".tabs-list-container");
    this._tabListElement = $(".tabs-list");
    tabListContainer.appendChild(this._tabListElement);
    this._tabContainer.appendChild(tabListContainer);
    this._instanceMenu = this._register(menuService.createMenu(MenuId.TerminalInstanceContext, contextKeyService));
    this._tabsListMenu = this._register(menuService.createMenu(MenuId.TerminalTabContext, contextKeyService));
    this._tabsListEmptyMenu = this._register(menuService.createMenu(MenuId.TerminalTabEmptyAreaContext, contextKeyService));
    this._tabList = this._register(this._instantiationService.createInstance(TerminalTabList, this._tabListElement, this._register(new DisposableStore())));
    const terminalOuterContainer = $(".terminal-outer-container");
    this._terminalContainer = $(".terminal-groups-container");
    terminalOuterContainer.appendChild(this._terminalContainer);
    this._terminalService.setContainers(parentElement, this._terminalContainer);
    this._terminalIsTabsNarrowContextKey = TerminalContextKeys.tabsNarrow.bindTo(contextKeyService);
    this._terminalTabsFocusContextKey = TerminalContextKeys.tabsFocus.bindTo(contextKeyService);
    this._terminalTabsMouseContextKey = TerminalContextKeys.tabsMouse.bindTo(contextKeyService);
    this._tabTreeIndex = this._terminalConfigurationService.config.tabs.location === "left" ? 0 : 1;
    this._terminalContainerIndex = this._terminalConfigurationService.config.tabs.location === "left" ? 1 : 0;
    this._register(_configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.TabsEnabled) || e.affectsConfiguration(TerminalSettingId.TabsHideCondition)) {
        this._refreshShowTabs();
      } else if (e.affectsConfiguration(TerminalSettingId.TabsLocation)) {
        this._tabTreeIndex = this._terminalConfigurationService.config.tabs.location === "left" ? 0 : 1;
        this._terminalContainerIndex = this._terminalConfigurationService.config.tabs.location === "left" ? 1 : 0;
        if (this._shouldShowTabs()) {
          this._splitView.swapViews(0, 1);
          this._removeSashListener();
          this._addSashListener();
          this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
        }
      }
    }));
    this._register(this._terminalGroupService.onDidChangeInstances(() => this._refreshShowTabs()));
    this._register(this._terminalGroupService.onDidChangeGroups(() => this._refreshShowTabs()));
    this._attachEventListeners(parentElement, this._terminalContainer);
    this._register(this._terminalGroupService.onDidChangePanelOrientation((orientation) => {
      this._panelOrientation = orientation;
      if (this._panelOrientation === Orientation.VERTICAL) {
        this._terminalContainer.classList.add("terminal-side-view" /* ViewIsVertical */);
      } else {
        this._terminalContainer.classList.remove("terminal-side-view" /* ViewIsVertical */);
      }
    }));
    this._splitView = new SplitView(parentElement, { orientation: Orientation.HORIZONTAL, proportionalLayout: false });
    this._setupSplitView(terminalOuterContainer);
  }
  _shouldShowTabs() {
    const enabled = this._terminalConfigurationService.config.tabs.enabled;
    const hide = this._terminalConfigurationService.config.tabs.hideCondition;
    if (!enabled) {
      return false;
    }
    if (hide === "never") {
      return true;
    }
    if (hide === "singleTerminal" && this._terminalGroupService.instances.length > 1) {
      return true;
    }
    if (hide === "singleGroup" && this._terminalGroupService.groups.length > 1) {
      return true;
    }
    return false;
  }
  _refreshShowTabs() {
    if (this._shouldShowTabs()) {
      if (this._splitView.length === 1) {
        this._addTabTree();
        this._addSashListener();
        this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
        this.rerenderTabs();
      }
    } else {
      if (this._splitView.length === 2 && !this._terminalTabsMouseContextKey.get()) {
        this._splitView.removeView(this._tabTreeIndex);
        this._plusButton?.remove();
        this._removeSashListener();
      }
    }
  }
  _getLastListWidth() {
    const widthKey = this._panelOrientation === Orientation.VERTICAL ? TerminalStorageKeys.TabsListWidthVertical : TerminalStorageKeys.TabsListWidthHorizontal;
    const storedValue = this._storageService.get(widthKey, StorageScope.PROFILE);
    if (!storedValue || !parseInt(storedValue)) {
      return this._panelOrientation === Orientation.VERTICAL ? TerminalTabsListSizes.NarrowViewWidth : TerminalTabsListSizes.DefaultWidth;
    }
    return parseInt(storedValue);
  }
  _handleOnDidSashReset() {
    let idealWidth = TerminalTabsListSizes.WideViewMinimumWidth;
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;
    const ctx = offscreenCanvas.getContext("2d");
    if (ctx) {
      const style = dom.getWindow(this._tabListElement).getComputedStyle(this._tabListElement);
      ctx.font = `${style.fontStyle} ${style.fontSize} ${style.fontFamily}`;
      const maxInstanceWidth = this._terminalGroupService.instances.reduce((p, c) => {
        return Math.max(p, ctx.measureText(c.title + (c.description || "")).width + this._getAdditionalWidth(c));
      }, 0);
      idealWidth = Math.ceil(Math.max(maxInstanceWidth, TerminalTabsListSizes.WideViewMinimumWidth));
    }
    const currentWidth = Math.ceil(this._splitView.getViewSize(this._tabTreeIndex));
    if (currentWidth === idealWidth) {
      idealWidth = TerminalTabsListSizes.NarrowViewWidth;
    }
    this._splitView.resizeView(this._tabTreeIndex, idealWidth);
    this._updateListWidth(idealWidth);
  }
  _getAdditionalWidth(instance) {
    const additionalWidth = 40;
    const statusIconWidth = instance.statusList.statuses.length > 0 ? 30 /* StatusIcon */ : 0;
    const splitAnnotationWidth = (this._terminalGroupService.getGroupForInstance(instance)?.terminalInstances.length || 0) > 1 ? 30 /* SplitAnnotation */ : 0;
    return additionalWidth + splitAnnotationWidth + statusIconWidth;
  }
  _handleOnDidSashChange() {
    const listWidth = this._splitView.getViewSize(this._tabTreeIndex);
    if (!this._width || listWidth <= 0) {
      return;
    }
    this._updateListWidth(listWidth);
  }
  _updateListWidth(width) {
    if (width < TerminalTabsListSizes.MidpointViewWidth && width >= TerminalTabsListSizes.NarrowViewWidth) {
      width = TerminalTabsListSizes.NarrowViewWidth;
      this._splitView.resizeView(this._tabTreeIndex, width);
    } else if (width >= TerminalTabsListSizes.MidpointViewWidth && width < TerminalTabsListSizes.WideViewMinimumWidth) {
      width = TerminalTabsListSizes.WideViewMinimumWidth;
      this._splitView.resizeView(this._tabTreeIndex, width);
    }
    this.rerenderTabs();
    const widthKey = this._panelOrientation === Orientation.VERTICAL ? TerminalStorageKeys.TabsListWidthVertical : TerminalStorageKeys.TabsListWidthHorizontal;
    this._storageService.store(widthKey, width, StorageScope.PROFILE, StorageTarget.USER);
  }
  _setupSplitView(terminalOuterContainer) {
    this._register(this._splitView.onDidSashReset(() => this._handleOnDidSashReset()));
    this._register(this._splitView.onDidSashChange(() => this._handleOnDidSashChange()));
    if (this._shouldShowTabs()) {
      this._addTabTree();
    }
    this._splitView.addView({
      element: terminalOuterContainer,
      layout: (width) => this._terminalGroupService.groups.forEach((tab) => tab.layout(width, this._height || 0)),
      minimumSize: 120,
      maximumSize: Number.POSITIVE_INFINITY,
      onDidChange: () => Disposable.None,
      priority: LayoutPriority.High
    }, Sizing.Distribute, this._terminalContainerIndex);
    if (this._shouldShowTabs()) {
      this._addSashListener();
    }
  }
  _addTabTree() {
    this._splitView.addView({
      element: this._tabContainer,
      layout: (width) => this._tabList.layout(this._height || 0, width),
      minimumSize: TerminalTabsListSizes.NarrowViewWidth,
      maximumSize: TerminalTabsListSizes.MaximumWidth,
      onDidChange: () => Disposable.None,
      priority: LayoutPriority.Low
    }, Sizing.Distribute, this._tabTreeIndex);
    this.rerenderTabs();
  }
  rerenderTabs() {
    this._updateHasText();
    this._tabList.refresh();
  }
  _addSashListener() {
    let interval;
    this._sashDisposables = [
      this._splitView.sashes[0].onDidStart((e) => {
        interval = dom.disposableWindowInterval(dom.getWindow(this._splitView.el), () => {
          this.rerenderTabs();
        }, 100);
      }),
      this._splitView.sashes[0].onDidEnd((e) => {
        interval.dispose();
      })
    ];
  }
  _removeSashListener() {
    if (this._sashDisposables) {
      dispose(this._sashDisposables);
      this._sashDisposables = void 0;
    }
  }
  _updateHasText() {
    const hasText = this._tabListElement.clientWidth > TerminalTabsListSizes.MidpointViewWidth;
    this._tabContainer.classList.toggle("has-text", hasText);
    this._terminalIsTabsNarrowContextKey.set(!hasText);
  }
  layout(width, height) {
    this._height = height;
    this._width = width;
    this._splitView.layout(width);
    if (this._shouldShowTabs()) {
      this._splitView.resizeView(this._tabTreeIndex, this._getLastListWidth());
    }
    this._updateHasText();
  }
  _attachEventListeners(parentDomElement, terminalContainer) {
    this._register(dom.addDisposableListener(this._tabContainer, "mouseleave", async (event) => {
      this._terminalTabsMouseContextKey.set(false);
      this._refreshShowTabs();
      event.stopPropagation();
    }));
    this._register(dom.addDisposableListener(this._tabContainer, "mouseenter", async (event) => {
      this._terminalTabsMouseContextKey.set(true);
      event.stopPropagation();
    }));
    this._register(dom.addDisposableListener(terminalContainer, "mousedown", async (event) => {
      const terminal = this._terminalGroupService.activeInstance;
      if (this._terminalGroupService.instances.length > 0 && terminal) {
        const result = await terminal.handleMouseEvent(event, this._instanceMenu);
        if (typeof result === "object" && result.cancelContextMenu) {
          this._cancelContextMenu = true;
        }
      }
    }));
    this._register(dom.addDisposableListener(terminalContainer, "contextmenu", (event) => {
      const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
      if (rightClickBehavior === "nothing" && !event.shiftKey) {
        this._cancelContextMenu = true;
      }
      terminalContainer.focus();
      if (!this._cancelContextMenu) {
        openContextMenu(dom.getWindow(terminalContainer), event, this._terminalGroupService.activeInstance, this._instanceMenu, this._contextMenuService);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      this._cancelContextMenu = false;
    }));
    this._register(dom.addDisposableListener(this._tabContainer, "contextmenu", (event) => {
      const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
      if (rightClickBehavior === "nothing" && !event.shiftKey) {
        this._cancelContextMenu = true;
      }
      if (!this._cancelContextMenu) {
        const emptyList = this._tabList.getFocus().length === 0;
        if (!emptyList) {
          this._terminalGroupService.lastAccessedMenu = "tab-list";
        }
        const selectedInstances = this._tabList.getSelectedElements();
        const focusedInstance = this._tabList.getFocusedElements()?.[0];
        if (focusedInstance) {
          selectedInstances.splice(selectedInstances.findIndex((e) => e.instanceId === focusedInstance.instanceId), 1);
          selectedInstances.unshift(focusedInstance);
        }
        openContextMenu(dom.getWindow(this._tabContainer), event, selectedInstances, emptyList ? this._tabsListEmptyMenu : this._tabsListMenu, this._contextMenuService, emptyList ? this._getTabActions() : void 0);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      this._cancelContextMenu = false;
    }));
    this._register(dom.addDisposableListener(terminalContainer.ownerDocument, "keydown", (event) => {
      terminalContainer.classList.toggle("alt-active", !!event.altKey);
    }));
    this._register(dom.addDisposableListener(terminalContainer.ownerDocument, "keyup", (event) => {
      terminalContainer.classList.toggle("alt-active", !!event.altKey);
    }));
    this._register(dom.addDisposableListener(parentDomElement, "keyup", (event) => {
      if (event.keyCode === 27) {
        event.stopPropagation();
      }
    }));
    this._register(dom.addDisposableListener(this._tabContainer, dom.EventType.FOCUS_IN, () => {
      this._terminalTabsFocusContextKey.set(true);
    }));
    this._register(dom.addDisposableListener(this._tabContainer, dom.EventType.FOCUS_OUT, () => {
      this._terminalTabsFocusContextKey.set(false);
    }));
  }
  _getTabActions() {
    return [
      new Separator(),
      this._configurationService.inspect(TerminalSettingId.TabsLocation).userValue === "left" ? new Action("moveRight", localize("moveTabsRight", "Move Tabs Right"), void 0, void 0, async () => {
        this._configurationService.updateValue(TerminalSettingId.TabsLocation, "right");
      }) : new Action("moveLeft", localize("moveTabsLeft", "Move Tabs Left"), void 0, void 0, async () => {
        this._configurationService.updateValue(TerminalSettingId.TabsLocation, "left");
      }),
      new Action("hideTabs", localize("hideTabs", "Hide Tabs"), void 0, void 0, async () => {
        this._configurationService.updateValue(TerminalSettingId.TabsEnabled, false);
      })
    ];
  }
  setEditable(isEditing) {
    if (!isEditing) {
      this._tabList.domFocus();
    }
    this._tabList.refresh(false);
  }
  focusTabs() {
    if (!this._shouldShowTabs()) {
      return;
    }
    this._terminalTabsFocusContextKey.set(true);
    const selected = this._tabList.getSelection();
    this._tabList.domFocus();
    if (selected) {
      this._tabList.setFocus(selected);
    }
  }
  focus() {
    if (this._terminalService.connectionState === TerminalConnectionState.Connected) {
      this._focus();
      return;
    }
    const previousActiveElement = this._tabListElement.ownerDocument.activeElement;
    if (previousActiveElement) {
      this._register(this._terminalService.onDidChangeConnectionState(() => {
        if (dom.isActiveElement(previousActiveElement)) {
          this._focus();
        }
      }));
    }
  }
  focusHover() {
    if (this._shouldShowTabs()) {
      this._tabList.focusHover();
      return;
    }
    const instance = this._terminalGroupService.activeInstance;
    if (!instance) {
      return;
    }
    this._hoverService.showInstantHover({
      ...getInstanceHoverInfo(instance, this._storageService),
      target: this._terminalContainer,
      trapFocus: true
    }, true);
  }
  _focus() {
    this._terminalGroupService.activeInstance?.focusWhenReady();
  }
};
TerminalTabbedView = __decorateClass([
  __decorateParam(1, ITerminalService),
  __decorateParam(2, ITerminalConfigurationService),
  __decorateParam(3, ITerminalGroupService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IHoverService)
], TerminalTabbedView);
export {
  TerminalTabbedView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsVGFiYmVkVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IExheW91dFByaW9yaXR5LCBPcmllbnRhdGlvbiwgU2l6aW5nLCBTcGxpdFZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc3BsaXR2aWV3L3NwbGl0dmlldy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSwgSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLCBJVGVybWluYWxJbnN0YW5jZSwgSVRlcm1pbmFsU2VydmljZSwgVGVybWluYWxDb25uZWN0aW9uU3RhdGUgfSBmcm9tICcuL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsVGFic0xpc3RTaXplcywgVGVybWluYWxUYWJMaXN0IH0gZnJvbSAnLi90ZXJtaW5hbFRhYnNMaXN0LmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiwgU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTWVudSwgSU1lbnVTZXJ2aWNlLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IFRlcm1pbmFsU2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBvcGVuQ29udGV4dE1lbnUgfSBmcm9tICcuL3Rlcm1pbmFsQ29udGV4dE1lbnUuanMnO1xuaW1wb3J0IHsgVGVybWluYWxTdG9yYWdlS2V5cyB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFN0b3JhZ2VLZXlzLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxDb250ZXh0S2V5LmpzJztcbmltcG9ydCB7IGdldEluc3RhbmNlSG92ZXJJbmZvIH0gZnJvbSAnLi90ZXJtaW5hbFRvb2x0aXAuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmNvbnN0IGVudW0gQ3NzQ2xhc3Mge1xuXHRWaWV3SXNWZXJ0aWNhbCA9ICd0ZXJtaW5hbC1zaWRlLXZpZXcnLFxufVxuXG5jb25zdCBlbnVtIFdpZHRoQ29uc3RhbnRzIHtcblx0U3RhdHVzSWNvbiA9IDMwLFxuXHRTcGxpdEFubm90YXRpb24gPSAzMFxufVxuXG5leHBvcnQgY2xhc3MgVGVybWluYWxUYWJiZWRWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfc3BsaXRWaWV3OiBTcGxpdFZpZXc7XG5cblx0cHJpdmF0ZSBfdGVybWluYWxDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF90YWJMaXN0RWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX3RhYkNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBfdGFiTGlzdDogVGVybWluYWxUYWJMaXN0O1xuXHRwcml2YXRlIF9zYXNoRGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfcGx1c0J1dHRvbjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfdGFiVHJlZUluZGV4OiBudW1iZXI7XG5cdHByaXZhdGUgX3Rlcm1pbmFsQ29udGFpbmVySW5kZXg6IG51bWJlcjtcblxuXHRwcml2YXRlIF9oZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfd2lkdGg6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9jYW5jZWxDb250ZXh0TWVudTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9pbnN0YW5jZU1lbnU6IElNZW51O1xuXHRwcml2YXRlIF90YWJzTGlzdE1lbnU6IElNZW51O1xuXHRwcml2YXRlIF90YWJzTGlzdEVtcHR5TWVudTogSU1lbnU7XG5cblx0cHJpdmF0ZSBfdGVybWluYWxJc1RhYnNOYXJyb3dDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfdGVybWluYWxUYWJzRm9jdXNDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfdGVybWluYWxUYWJzTW91c2VDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIF9wYW5lbE9yaWVudGF0aW9uOiBPcmllbnRhdGlvbiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwYXJlbnRFbGVtZW50OiBIVE1MRWxlbWVudCxcblx0XHRASVRlcm1pbmFsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFNlcnZpY2U6IElUZXJtaW5hbFNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxHcm91cFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxHcm91cFNlcnZpY2U6IElUZXJtaW5hbEdyb3VwU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl90YWJDb250YWluZXIgPSAkKCcudGFicy1jb250YWluZXInKTtcblx0XHRjb25zdCB0YWJMaXN0Q29udGFpbmVyID0gJCgnLnRhYnMtbGlzdC1jb250YWluZXInKTtcblx0XHR0aGlzLl90YWJMaXN0RWxlbWVudCA9ICQoJy50YWJzLWxpc3QnKTtcblx0XHR0YWJMaXN0Q29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3RhYkxpc3RFbGVtZW50KTtcblx0XHR0aGlzLl90YWJDb250YWluZXIuYXBwZW5kQ2hpbGQodGFiTGlzdENvbnRhaW5lcik7XG5cblx0XHR0aGlzLl9pbnN0YW5jZU1lbnUgPSB0aGlzLl9yZWdpc3RlcihtZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5UZXJtaW5hbEluc3RhbmNlQ29udGV4dCwgY29udGV4dEtleVNlcnZpY2UpKTtcblx0XHR0aGlzLl90YWJzTGlzdE1lbnUgPSB0aGlzLl9yZWdpc3RlcihtZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5UZXJtaW5hbFRhYkNvbnRleHQsIGNvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fdGFic0xpc3RFbXB0eU1lbnUgPSB0aGlzLl9yZWdpc3RlcihtZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5UZXJtaW5hbFRhYkVtcHR5QXJlYUNvbnRleHQsIGNvbnRleHRLZXlTZXJ2aWNlKSk7XG5cblx0XHR0aGlzLl90YWJMaXN0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxUYWJMaXN0LCB0aGlzLl90YWJMaXN0RWxlbWVudCwgdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKSkpO1xuXG5cdFx0Y29uc3QgdGVybWluYWxPdXRlckNvbnRhaW5lciA9ICQoJy50ZXJtaW5hbC1vdXRlci1jb250YWluZXInKTtcblx0XHR0aGlzLl90ZXJtaW5hbENvbnRhaW5lciA9ICQoJy50ZXJtaW5hbC1ncm91cHMtY29udGFpbmVyJyk7XG5cdFx0dGVybWluYWxPdXRlckNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl90ZXJtaW5hbENvbnRhaW5lcik7XG5cblx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uuc2V0Q29udGFpbmVycyhwYXJlbnRFbGVtZW50LCB0aGlzLl90ZXJtaW5hbENvbnRhaW5lcik7XG5cblx0XHR0aGlzLl90ZXJtaW5hbElzVGFic05hcnJvd0NvbnRleHRLZXkgPSBUZXJtaW5hbENvbnRleHRLZXlzLnRhYnNOYXJyb3cuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl90ZXJtaW5hbFRhYnNGb2N1c0NvbnRleHRLZXkgPSBUZXJtaW5hbENvbnRleHRLZXlzLnRhYnNGb2N1cy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3Rlcm1pbmFsVGFic01vdXNlQ29udGV4dEtleSA9IFRlcm1pbmFsQ29udGV4dEtleXMudGFic01vdXNlLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl90YWJUcmVlSW5kZXggPSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy50YWJzLmxvY2F0aW9uID09PSAnbGVmdCcgPyAwIDogMTtcblx0XHR0aGlzLl90ZXJtaW5hbENvbnRhaW5lckluZGV4ID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcudGFicy5sb2NhdGlvbiA9PT0gJ2xlZnQnID8gMSA6IDA7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihfY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuVGFic0VuYWJsZWQpIHx8XG5cdFx0XHRcdGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuVGFic0hpZGVDb25kaXRpb24pKSB7XG5cdFx0XHRcdHRoaXMuX3JlZnJlc2hTaG93VGFicygpO1xuXHRcdFx0fSBlbHNlIGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsU2V0dGluZ0lkLlRhYnNMb2NhdGlvbikpIHtcblx0XHRcdFx0dGhpcy5fdGFiVHJlZUluZGV4ID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcudGFicy5sb2NhdGlvbiA9PT0gJ2xlZnQnID8gMCA6IDE7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsQ29udGFpbmVySW5kZXggPSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy50YWJzLmxvY2F0aW9uID09PSAnbGVmdCcgPyAxIDogMDtcblx0XHRcdFx0aWYgKHRoaXMuX3Nob3VsZFNob3dUYWJzKCkpIHtcblx0XHRcdFx0XHR0aGlzLl9zcGxpdFZpZXcuc3dhcFZpZXdzKDAsIDEpO1xuXHRcdFx0XHRcdHRoaXMuX3JlbW92ZVNhc2hMaXN0ZW5lcigpO1xuXHRcdFx0XHRcdHRoaXMuX2FkZFNhc2hMaXN0ZW5lcigpO1xuXHRcdFx0XHRcdHRoaXMuX3NwbGl0Vmlldy5yZXNpemVWaWV3KHRoaXMuX3RhYlRyZWVJbmRleCwgdGhpcy5fZ2V0TGFzdExpc3RXaWR0aCgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5vbkRpZENoYW5nZUluc3RhbmNlcygoKSA9PiB0aGlzLl9yZWZyZXNoU2hvd1RhYnMoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLm9uRGlkQ2hhbmdlR3JvdXBzKCgpID0+IHRoaXMuX3JlZnJlc2hTaG93VGFicygpKSk7XG5cblx0XHR0aGlzLl9hdHRhY2hFdmVudExpc3RlbmVycyhwYXJlbnRFbGVtZW50LCB0aGlzLl90ZXJtaW5hbENvbnRhaW5lcik7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5vbkRpZENoYW5nZVBhbmVsT3JpZW50YXRpb24oKG9yaWVudGF0aW9uKSA9PiB7XG5cdFx0XHR0aGlzLl9wYW5lbE9yaWVudGF0aW9uID0gb3JpZW50YXRpb247XG5cdFx0XHRpZiAodGhpcy5fcGFuZWxPcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwpIHtcblx0XHRcdFx0dGhpcy5fdGVybWluYWxDb250YWluZXIuY2xhc3NMaXN0LmFkZChDc3NDbGFzcy5WaWV3SXNWZXJ0aWNhbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl90ZXJtaW5hbENvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKENzc0NsYXNzLlZpZXdJc1ZlcnRpY2FsKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9zcGxpdFZpZXcgPSBuZXcgU3BsaXRWaWV3KHBhcmVudEVsZW1lbnQsIHsgb3JpZW50YXRpb246IE9yaWVudGF0aW9uLkhPUklaT05UQUwsIHByb3BvcnRpb25hbExheW91dDogZmFsc2UgfSk7XG5cdFx0dGhpcy5fc2V0dXBTcGxpdFZpZXcodGVybWluYWxPdXRlckNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIF9zaG91bGRTaG93VGFicygpOiBib29sZWFuIHtcblx0XHRjb25zdCBlbmFibGVkID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcudGFicy5lbmFibGVkO1xuXHRcdGNvbnN0IGhpZGUgPSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy50YWJzLmhpZGVDb25kaXRpb247XG5cdFx0aWYgKCFlbmFibGVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGhpZGUgPT09ICduZXZlcicpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChoaWRlID09PSAnc2luZ2xlVGVybWluYWwnICYmIHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmluc3RhbmNlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoaGlkZSA9PT0gJ3NpbmdsZUdyb3VwJyAmJiB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5ncm91cHMubGVuZ3RoID4gMSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVmcmVzaFNob3dUYWJzKCkge1xuXHRcdGlmICh0aGlzLl9zaG91bGRTaG93VGFicygpKSB7XG5cdFx0XHRpZiAodGhpcy5fc3BsaXRWaWV3Lmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHR0aGlzLl9hZGRUYWJUcmVlKCk7XG5cdFx0XHRcdHRoaXMuX2FkZFNhc2hMaXN0ZW5lcigpO1xuXHRcdFx0XHR0aGlzLl9zcGxpdFZpZXcucmVzaXplVmlldyh0aGlzLl90YWJUcmVlSW5kZXgsIHRoaXMuX2dldExhc3RMaXN0V2lkdGgoKSk7XG5cdFx0XHRcdHRoaXMucmVyZW5kZXJUYWJzKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLl9zcGxpdFZpZXcubGVuZ3RoID09PSAyICYmICF0aGlzLl90ZXJtaW5hbFRhYnNNb3VzZUNvbnRleHRLZXkuZ2V0KCkpIHtcblx0XHRcdFx0dGhpcy5fc3BsaXRWaWV3LnJlbW92ZVZpZXcodGhpcy5fdGFiVHJlZUluZGV4KTtcblx0XHRcdFx0dGhpcy5fcGx1c0J1dHRvbj8ucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMuX3JlbW92ZVNhc2hMaXN0ZW5lcigpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldExhc3RMaXN0V2lkdGgoKTogbnVtYmVyIHtcblx0XHRjb25zdCB3aWR0aEtleSA9IHRoaXMuX3BhbmVsT3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gVGVybWluYWxTdG9yYWdlS2V5cy5UYWJzTGlzdFdpZHRoVmVydGljYWwgOiBUZXJtaW5hbFN0b3JhZ2VLZXlzLlRhYnNMaXN0V2lkdGhIb3Jpem9udGFsO1xuXHRcdGNvbnN0IHN0b3JlZFZhbHVlID0gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KHdpZHRoS2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSk7XG5cblx0XHRpZiAoIXN0b3JlZFZhbHVlIHx8ICFwYXJzZUludChzdG9yZWRWYWx1ZSkpIHtcblx0XHRcdC8vIHdlIHdhbnQgdG8gdXNlIHRoZSBtaW4gd2lkdGggYnkgZGVmYXVsdCBmb3IgdGhlIHZlcnRpY2FsIG9yaWVudGF0aW9uIGJjXG5cdFx0XHQvLyB0aGVyZSBpcyBzdWNoIGEgbGltaXRlZCB3aWR0aCBmb3IgdGhlIHRlcm1pbmFsIHBhbmVsIHRvIGJlZ2luIHcgdGhlcmUuXG5cdFx0XHRyZXR1cm4gdGhpcy5fcGFuZWxPcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwgPyBUZXJtaW5hbFRhYnNMaXN0U2l6ZXMuTmFycm93Vmlld1dpZHRoIDogVGVybWluYWxUYWJzTGlzdFNpemVzLkRlZmF1bHRXaWR0aDtcblx0XHR9XG5cdFx0cmV0dXJuIHBhcnNlSW50KHN0b3JlZFZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZU9uRGlkU2FzaFJlc2V0KCk6IHZvaWQge1xuXHRcdC8vIENhbGN1bGF0ZSBpZGVhbCBzaXplIG9mIGxpc3QgdG8gZGlzcGxheSBhbGwgdGV4dCBiYXNlZCBvbiBpdHMgY29udGVudHNcblx0XHRsZXQgaWRlYWxXaWR0aCA9IFRlcm1pbmFsVGFic0xpc3RTaXplcy5XaWRlVmlld01pbmltdW1XaWR0aDtcblx0XHRjb25zdCBvZmZzY3JlZW5DYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcblx0XHRvZmZzY3JlZW5DYW52YXMud2lkdGggPSAxO1xuXHRcdG9mZnNjcmVlbkNhbnZhcy5oZWlnaHQgPSAxO1xuXHRcdGNvbnN0IGN0eCA9IG9mZnNjcmVlbkNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXHRcdGlmIChjdHgpIHtcblx0XHRcdGNvbnN0IHN0eWxlID0gZG9tLmdldFdpbmRvdyh0aGlzLl90YWJMaXN0RWxlbWVudCkuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLl90YWJMaXN0RWxlbWVudCk7XG5cdFx0XHRjdHguZm9udCA9IGAke3N0eWxlLmZvbnRTdHlsZX0gJHtzdHlsZS5mb250U2l6ZX0gJHtzdHlsZS5mb250RmFtaWx5fWA7XG5cdFx0XHRjb25zdCBtYXhJbnN0YW5jZVdpZHRoID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaW5zdGFuY2VzLnJlZHVjZSgocCwgYykgPT4ge1xuXHRcdFx0XHRyZXR1cm4gTWF0aC5tYXgocCwgY3R4Lm1lYXN1cmVUZXh0KGMudGl0bGUgKyAoYy5kZXNjcmlwdGlvbiB8fCAnJykpLndpZHRoICsgdGhpcy5fZ2V0QWRkaXRpb25hbFdpZHRoKGMpKTtcblx0XHRcdH0sIDApO1xuXHRcdFx0aWRlYWxXaWR0aCA9IE1hdGguY2VpbChNYXRoLm1heChtYXhJbnN0YW5jZVdpZHRoLCBUZXJtaW5hbFRhYnNMaXN0U2l6ZXMuV2lkZVZpZXdNaW5pbXVtV2lkdGgpKTtcblx0XHR9XG5cdFx0Ly8gSWYgdGhlIHNpemUgaXMgYWxyZWFkeSBpZGVhbCwgdG9nZ2xlIHRvIGNvbGxhcHNlZFxuXHRcdGNvbnN0IGN1cnJlbnRXaWR0aCA9IE1hdGguY2VpbCh0aGlzLl9zcGxpdFZpZXcuZ2V0Vmlld1NpemUodGhpcy5fdGFiVHJlZUluZGV4KSk7XG5cdFx0aWYgKGN1cnJlbnRXaWR0aCA9PT0gaWRlYWxXaWR0aCkge1xuXHRcdFx0aWRlYWxXaWR0aCA9IFRlcm1pbmFsVGFic0xpc3RTaXplcy5OYXJyb3dWaWV3V2lkdGg7XG5cdFx0fVxuXHRcdHRoaXMuX3NwbGl0Vmlldy5yZXNpemVWaWV3KHRoaXMuX3RhYlRyZWVJbmRleCwgaWRlYWxXaWR0aCk7XG5cdFx0dGhpcy5fdXBkYXRlTGlzdFdpZHRoKGlkZWFsV2lkdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0QWRkaXRpb25hbFdpZHRoKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IG51bWJlciB7XG5cdFx0Ly8gU2l6ZSB0byBpbmNsdWRlIHBhZGRpbmcsIGljb24sIHN0YXR1cyBpY29uIChpZiBhbnkpLCBzcGxpdCBhbm5vdGF0aW9uIChpZiBhbnkpLCArIGEgbGl0dGxlIG1vcmVcblx0XHRjb25zdCBhZGRpdGlvbmFsV2lkdGggPSA0MDtcblx0XHRjb25zdCBzdGF0dXNJY29uV2lkdGggPSBpbnN0YW5jZS5zdGF0dXNMaXN0LnN0YXR1c2VzLmxlbmd0aCA+IDAgPyBXaWR0aENvbnN0YW50cy5TdGF0dXNJY29uIDogMDtcblx0XHRjb25zdCBzcGxpdEFubm90YXRpb25XaWR0aCA9ICh0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5nZXRHcm91cEZvckluc3RhbmNlKGluc3RhbmNlKT8udGVybWluYWxJbnN0YW5jZXMubGVuZ3RoIHx8IDApID4gMSA/IFdpZHRoQ29uc3RhbnRzLlNwbGl0QW5ub3RhdGlvbiA6IDA7XG5cdFx0cmV0dXJuIGFkZGl0aW9uYWxXaWR0aCArIHNwbGl0QW5ub3RhdGlvbldpZHRoICsgc3RhdHVzSWNvbldpZHRoO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlT25EaWRTYXNoQ2hhbmdlKCk6IHZvaWQge1xuXHRcdGNvbnN0IGxpc3RXaWR0aCA9IHRoaXMuX3NwbGl0Vmlldy5nZXRWaWV3U2l6ZSh0aGlzLl90YWJUcmVlSW5kZXgpO1xuXHRcdGlmICghdGhpcy5fd2lkdGggfHwgbGlzdFdpZHRoIDw9IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fdXBkYXRlTGlzdFdpZHRoKGxpc3RXaWR0aCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVMaXN0V2lkdGgod2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh3aWR0aCA8IFRlcm1pbmFsVGFic0xpc3RTaXplcy5NaWRwb2ludFZpZXdXaWR0aCAmJiB3aWR0aCA+PSBUZXJtaW5hbFRhYnNMaXN0U2l6ZXMuTmFycm93Vmlld1dpZHRoKSB7XG5cdFx0XHR3aWR0aCA9IFRlcm1pbmFsVGFic0xpc3RTaXplcy5OYXJyb3dWaWV3V2lkdGg7XG5cdFx0XHR0aGlzLl9zcGxpdFZpZXcucmVzaXplVmlldyh0aGlzLl90YWJUcmVlSW5kZXgsIHdpZHRoKTtcblx0XHR9IGVsc2UgaWYgKHdpZHRoID49IFRlcm1pbmFsVGFic0xpc3RTaXplcy5NaWRwb2ludFZpZXdXaWR0aCAmJiB3aWR0aCA8IFRlcm1pbmFsVGFic0xpc3RTaXplcy5XaWRlVmlld01pbmltdW1XaWR0aCkge1xuXHRcdFx0d2lkdGggPSBUZXJtaW5hbFRhYnNMaXN0U2l6ZXMuV2lkZVZpZXdNaW5pbXVtV2lkdGg7XG5cdFx0XHR0aGlzLl9zcGxpdFZpZXcucmVzaXplVmlldyh0aGlzLl90YWJUcmVlSW5kZXgsIHdpZHRoKTtcblx0XHR9XG5cdFx0dGhpcy5yZXJlbmRlclRhYnMoKTtcblx0XHRjb25zdCB3aWR0aEtleSA9IHRoaXMuX3BhbmVsT3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gVGVybWluYWxTdG9yYWdlS2V5cy5UYWJzTGlzdFdpZHRoVmVydGljYWwgOiBUZXJtaW5hbFN0b3JhZ2VLZXlzLlRhYnNMaXN0V2lkdGhIb3Jpem9udGFsO1xuXHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKHdpZHRoS2V5LCB3aWR0aCwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdH1cblxuXHRwcml2YXRlIF9zZXR1cFNwbGl0Vmlldyh0ZXJtaW5hbE91dGVyQ29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3NwbGl0Vmlldy5vbkRpZFNhc2hSZXNldCgoKSA9PiB0aGlzLl9oYW5kbGVPbkRpZFNhc2hSZXNldCgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fc3BsaXRWaWV3Lm9uRGlkU2FzaENoYW5nZSgoKSA9PiB0aGlzLl9oYW5kbGVPbkRpZFNhc2hDaGFuZ2UoKSkpO1xuXG5cdFx0aWYgKHRoaXMuX3Nob3VsZFNob3dUYWJzKCkpIHtcblx0XHRcdHRoaXMuX2FkZFRhYlRyZWUoKTtcblx0XHR9XG5cdFx0dGhpcy5fc3BsaXRWaWV3LmFkZFZpZXcoe1xuXHRcdFx0ZWxlbWVudDogdGVybWluYWxPdXRlckNvbnRhaW5lcixcblx0XHRcdGxheW91dDogd2lkdGggPT4gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuZ3JvdXBzLmZvckVhY2godGFiID0+IHRhYi5sYXlvdXQod2lkdGgsIHRoaXMuX2hlaWdodCB8fCAwKSksXG5cdFx0XHRtaW5pbXVtU2l6ZTogMTIwLFxuXHRcdFx0bWF4aW11bVNpemU6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcblx0XHRcdG9uRGlkQ2hhbmdlOiAoKSA9PiBEaXNwb3NhYmxlLk5vbmUsXG5cdFx0XHRwcmlvcml0eTogTGF5b3V0UHJpb3JpdHkuSGlnaFxuXHRcdH0sIFNpemluZy5EaXN0cmlidXRlLCB0aGlzLl90ZXJtaW5hbENvbnRhaW5lckluZGV4KTtcblxuXHRcdGlmICh0aGlzLl9zaG91bGRTaG93VGFicygpKSB7XG5cdFx0XHR0aGlzLl9hZGRTYXNoTGlzdGVuZXIoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9hZGRUYWJUcmVlKCkge1xuXHRcdHRoaXMuX3NwbGl0Vmlldy5hZGRWaWV3KHtcblx0XHRcdGVsZW1lbnQ6IHRoaXMuX3RhYkNvbnRhaW5lcixcblx0XHRcdGxheW91dDogd2lkdGggPT4gdGhpcy5fdGFiTGlzdC5sYXlvdXQodGhpcy5faGVpZ2h0IHx8IDAsIHdpZHRoKSxcblx0XHRcdG1pbmltdW1TaXplOiBUZXJtaW5hbFRhYnNMaXN0U2l6ZXMuTmFycm93Vmlld1dpZHRoLFxuXHRcdFx0bWF4aW11bVNpemU6IFRlcm1pbmFsVGFic0xpc3RTaXplcy5NYXhpbXVtV2lkdGgsXG5cdFx0XHRvbkRpZENoYW5nZTogKCkgPT4gRGlzcG9zYWJsZS5Ob25lLFxuXHRcdFx0cHJpb3JpdHk6IExheW91dFByaW9yaXR5Lkxvd1xuXHRcdH0sIFNpemluZy5EaXN0cmlidXRlLCB0aGlzLl90YWJUcmVlSW5kZXgpO1xuXHRcdHRoaXMucmVyZW5kZXJUYWJzKCk7XG5cdH1cblxuXHRyZXJlbmRlclRhYnMoKSB7XG5cdFx0dGhpcy5fdXBkYXRlSGFzVGV4dCgpO1xuXHRcdHRoaXMuX3RhYkxpc3QucmVmcmVzaCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWRkU2FzaExpc3RlbmVyKCkge1xuXHRcdGxldCBpbnRlcnZhbDogSURpc3Bvc2FibGU7XG5cdFx0dGhpcy5fc2FzaERpc3Bvc2FibGVzID0gW1xuXHRcdFx0dGhpcy5fc3BsaXRWaWV3LnNhc2hlc1swXS5vbkRpZFN0YXJ0KGUgPT4ge1xuXHRcdFx0XHRpbnRlcnZhbCA9IGRvbS5kaXNwb3NhYmxlV2luZG93SW50ZXJ2YWwoZG9tLmdldFdpbmRvdyh0aGlzLl9zcGxpdFZpZXcuZWwpLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5yZXJlbmRlclRhYnMoKTtcblx0XHRcdFx0fSwgMTAwKTtcblx0XHRcdH0pLFxuXHRcdFx0dGhpcy5fc3BsaXRWaWV3LnNhc2hlc1swXS5vbkRpZEVuZChlID0+IHtcblx0XHRcdFx0aW50ZXJ2YWwuZGlzcG9zZSgpO1xuXHRcdFx0fSlcblx0XHRdO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlU2FzaExpc3RlbmVyKCkge1xuXHRcdGlmICh0aGlzLl9zYXNoRGlzcG9zYWJsZXMpIHtcblx0XHRcdGRpc3Bvc2UodGhpcy5fc2FzaERpc3Bvc2FibGVzKTtcblx0XHRcdHRoaXMuX3Nhc2hEaXNwb3NhYmxlcyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVIYXNUZXh0KCkge1xuXHRcdGNvbnN0IGhhc1RleHQgPSB0aGlzLl90YWJMaXN0RWxlbWVudC5jbGllbnRXaWR0aCA+IFRlcm1pbmFsVGFic0xpc3RTaXplcy5NaWRwb2ludFZpZXdXaWR0aDtcblx0XHR0aGlzLl90YWJDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaGFzLXRleHQnLCBoYXNUZXh0KTtcblx0XHR0aGlzLl90ZXJtaW5hbElzVGFic05hcnJvd0NvbnRleHRLZXkuc2V0KCFoYXNUZXh0KTtcblx0fVxuXG5cdGxheW91dCh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2hlaWdodCA9IGhlaWdodDtcblx0XHR0aGlzLl93aWR0aCA9IHdpZHRoO1xuXHRcdHRoaXMuX3NwbGl0Vmlldy5sYXlvdXQod2lkdGgpO1xuXHRcdGlmICh0aGlzLl9zaG91bGRTaG93VGFicygpKSB7XG5cdFx0XHR0aGlzLl9zcGxpdFZpZXcucmVzaXplVmlldyh0aGlzLl90YWJUcmVlSW5kZXgsIHRoaXMuX2dldExhc3RMaXN0V2lkdGgoKSk7XG5cdFx0fVxuXHRcdHRoaXMuX3VwZGF0ZUhhc1RleHQoKTtcblx0fVxuXG5cdHByaXZhdGUgX2F0dGFjaEV2ZW50TGlzdGVuZXJzKHBhcmVudERvbUVsZW1lbnQ6IEhUTUxFbGVtZW50LCB0ZXJtaW5hbENvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX3RhYkNvbnRhaW5lciwgJ21vdXNlbGVhdmUnLCBhc3luYyAoZXZlbnQ6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsVGFic01vdXNlQ29udGV4dEtleS5zZXQoZmFsc2UpO1xuXHRcdFx0dGhpcy5fcmVmcmVzaFNob3dUYWJzKCk7XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl90YWJDb250YWluZXIsICdtb3VzZWVudGVyJywgYXN5bmMgKGV2ZW50OiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFRhYnNNb3VzZUNvbnRleHRLZXkuc2V0KHRydWUpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGVybWluYWxDb250YWluZXIsICdtb3VzZWRvd24nLCBhc3luYyAoZXZlbnQ6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuYWN0aXZlSW5zdGFuY2U7XG5cdFx0XHRpZiAodGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaW5zdGFuY2VzLmxlbmd0aCA+IDAgJiYgdGVybWluYWwpIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVybWluYWwuaGFuZGxlTW91c2VFdmVudChldmVudCwgdGhpcy5faW5zdGFuY2VNZW51KTtcblx0XHRcdFx0aWYgKHR5cGVvZiByZXN1bHQgPT09ICdvYmplY3QnICYmIHJlc3VsdC5jYW5jZWxDb250ZXh0TWVudSkge1xuXHRcdFx0XHRcdHRoaXMuX2NhbmNlbENvbnRleHRNZW51ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRlcm1pbmFsQ29udGFpbmVyLCAnY29udGV4dG1lbnUnLCAoZXZlbnQ6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IHJpZ2h0Q2xpY2tCZWhhdmlvciA9IHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLnJpZ2h0Q2xpY2tCZWhhdmlvcjtcblx0XHRcdGlmIChyaWdodENsaWNrQmVoYXZpb3IgPT09ICdub3RoaW5nJyAmJiAhZXZlbnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0dGhpcy5fY2FuY2VsQ29udGV4dE1lbnUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0dGVybWluYWxDb250YWluZXIuZm9jdXMoKTtcblx0XHRcdGlmICghdGhpcy5fY2FuY2VsQ29udGV4dE1lbnUpIHtcblx0XHRcdFx0b3BlbkNvbnRleHRNZW51KGRvbS5nZXRXaW5kb3codGVybWluYWxDb250YWluZXIpLCBldmVudCwgdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuYWN0aXZlSW5zdGFuY2UsIHRoaXMuX2luc3RhbmNlTWVudSwgdGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlKTtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuX2NhbmNlbENvbnRleHRNZW51ID0gZmFsc2U7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fdGFiQ29udGFpbmVyLCAnY29udGV4dG1lbnUnLCAoZXZlbnQ6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IHJpZ2h0Q2xpY2tCZWhhdmlvciA9IHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLnJpZ2h0Q2xpY2tCZWhhdmlvcjtcblx0XHRcdGlmIChyaWdodENsaWNrQmVoYXZpb3IgPT09ICdub3RoaW5nJyAmJiAhZXZlbnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0dGhpcy5fY2FuY2VsQ29udGV4dE1lbnUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLl9jYW5jZWxDb250ZXh0TWVudSkge1xuXHRcdFx0XHRjb25zdCBlbXB0eUxpc3QgPSB0aGlzLl90YWJMaXN0LmdldEZvY3VzKCkubGVuZ3RoID09PSAwO1xuXHRcdFx0XHRpZiAoIWVtcHR5TGlzdCkge1xuXHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmxhc3RBY2Nlc3NlZE1lbnUgPSAndGFiLWxpc3QnO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUHV0IHRoZSBmb2N1c2VkIGl0ZW0gZmlyc3QgYXMgaXQncyB1c2VkIGFzIHRoZSBmaXJzdCBwb3NpdGlvbmFsIGFyZ3VtZW50XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGVkSW5zdGFuY2VzID0gdGhpcy5fdGFiTGlzdC5nZXRTZWxlY3RlZEVsZW1lbnRzKCk7XG5cdFx0XHRcdGNvbnN0IGZvY3VzZWRJbnN0YW5jZSA9IHRoaXMuX3RhYkxpc3QuZ2V0Rm9jdXNlZEVsZW1lbnRzKCk/LlswXTtcblx0XHRcdFx0aWYgKGZvY3VzZWRJbnN0YW5jZSkge1xuXHRcdFx0XHRcdHNlbGVjdGVkSW5zdGFuY2VzLnNwbGljZShzZWxlY3RlZEluc3RhbmNlcy5maW5kSW5kZXgoZSA9PiBlLmluc3RhbmNlSWQgPT09IGZvY3VzZWRJbnN0YW5jZS5pbnN0YW5jZUlkKSwgMSk7XG5cdFx0XHRcdFx0c2VsZWN0ZWRJbnN0YW5jZXMudW5zaGlmdChmb2N1c2VkSW5zdGFuY2UpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b3BlbkNvbnRleHRNZW51KGRvbS5nZXRXaW5kb3codGhpcy5fdGFiQ29udGFpbmVyKSwgZXZlbnQsIHNlbGVjdGVkSW5zdGFuY2VzLCBlbXB0eUxpc3QgPyB0aGlzLl90YWJzTGlzdEVtcHR5TWVudSA6IHRoaXMuX3RhYnNMaXN0TWVudSwgdGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLCBlbXB0eUxpc3QgPyB0aGlzLl9nZXRUYWJBY3Rpb25zKCkgOiB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0dGhpcy5fY2FuY2VsQ29udGV4dE1lbnUgPSBmYWxzZTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0ZXJtaW5hbENvbnRhaW5lci5vd25lckRvY3VtZW50LCAna2V5ZG93bicsIChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0dGVybWluYWxDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnYWx0LWFjdGl2ZScsICEhZXZlbnQuYWx0S2V5KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0ZXJtaW5hbENvbnRhaW5lci5vd25lckRvY3VtZW50LCAna2V5dXAnLCAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdHRlcm1pbmFsQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2FsdC1hY3RpdmUnLCAhIWV2ZW50LmFsdEtleSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIocGFyZW50RG9tRWxlbWVudCwgJ2tleXVwJywgKGV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZXZlbnQua2V5Q29kZSA9PT0gMjcpIHtcblx0XHRcdFx0Ly8gS2VlcCB0ZXJtaW5hbCBvcGVuIG9uIGVzY2FwZVxuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl90YWJDb250YWluZXIsIGRvbS5FdmVudFR5cGUuRk9DVVNfSU4sICgpID0+IHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsVGFic0ZvY3VzQ29udGV4dEtleS5zZXQodHJ1ZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fdGFiQ29udGFpbmVyLCBkb20uRXZlbnRUeXBlLkZPQ1VTX09VVCwgKCkgPT4ge1xuXHRcdFx0dGhpcy5fdGVybWluYWxUYWJzRm9jdXNDb250ZXh0S2V5LnNldChmYWxzZSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VGFiQWN0aW9ucygpOiBJQWN0aW9uW10ge1xuXHRcdHJldHVybiBbXG5cdFx0XHRuZXcgU2VwYXJhdG9yKCksXG5cdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KFRlcm1pbmFsU2V0dGluZ0lkLlRhYnNMb2NhdGlvbikudXNlclZhbHVlID09PSAnbGVmdCcgP1xuXHRcdFx0XHRuZXcgQWN0aW9uKCdtb3ZlUmlnaHQnLCBsb2NhbGl6ZSgnbW92ZVRhYnNSaWdodCcsIFwiTW92ZSBUYWJzIFJpZ2h0XCIpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLlRhYnNMb2NhdGlvbiwgJ3JpZ2h0Jyk7XG5cdFx0XHRcdH0pIDpcblx0XHRcdFx0bmV3IEFjdGlvbignbW92ZUxlZnQnLCBsb2NhbGl6ZSgnbW92ZVRhYnNMZWZ0JywgXCJNb3ZlIFRhYnMgTGVmdFwiKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShUZXJtaW5hbFNldHRpbmdJZC5UYWJzTG9jYXRpb24sICdsZWZ0Jyk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0bmV3IEFjdGlvbignaGlkZVRhYnMnLCBsb2NhbGl6ZSgnaGlkZVRhYnMnLCBcIkhpZGUgVGFic1wiKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoVGVybWluYWxTZXR0aW5nSWQuVGFic0VuYWJsZWQsIGZhbHNlKTtcblx0XHRcdH0pXG5cdFx0XTtcblx0fVxuXG5cdHNldEVkaXRhYmxlKGlzRWRpdGluZzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghaXNFZGl0aW5nKSB7XG5cdFx0XHR0aGlzLl90YWJMaXN0LmRvbUZvY3VzKCk7XG5cdFx0fVxuXHRcdHRoaXMuX3RhYkxpc3QucmVmcmVzaChmYWxzZSk7XG5cdH1cblxuXHRmb2N1c1RhYnMoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9zaG91bGRTaG93VGFicygpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3Rlcm1pbmFsVGFic0ZvY3VzQ29udGV4dEtleS5zZXQodHJ1ZSk7XG5cdFx0Y29uc3Qgc2VsZWN0ZWQgPSB0aGlzLl90YWJMaXN0LmdldFNlbGVjdGlvbigpO1xuXHRcdHRoaXMuX3RhYkxpc3QuZG9tRm9jdXMoKTtcblx0XHRpZiAoc2VsZWN0ZWQpIHtcblx0XHRcdHRoaXMuX3RhYkxpc3Quc2V0Rm9jdXMoc2VsZWN0ZWQpO1xuXHRcdH1cblx0fVxuXG5cdGZvY3VzKCkge1xuXHRcdGlmICh0aGlzLl90ZXJtaW5hbFNlcnZpY2UuY29ubmVjdGlvblN0YXRlID09PSBUZXJtaW5hbENvbm5lY3Rpb25TdGF0ZS5Db25uZWN0ZWQpIHtcblx0XHRcdHRoaXMuX2ZvY3VzKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIHRlcm1pbmFsIGlzIHdhaXRpbmcgdG8gcmVjb25uZWN0IHRvIHJlbW90ZSB0ZXJtaW5hbHMsIHRoZW4gdGhlcmUgaXMgbm8gVGVybWluYWxJbnN0YW5jZSB5ZXQgdGhhdCBjYW5cblx0XHQvLyBiZSBmb2N1c2VkLiBTbyB3YWl0IGZvciBjb25uZWN0aW9uIHRvIGZpbmlzaCwgdGhlbiBmb2N1cy5cblx0XHRjb25zdCBwcmV2aW91c0FjdGl2ZUVsZW1lbnQgPSB0aGlzLl90YWJMaXN0RWxlbWVudC5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0aWYgKHByZXZpb3VzQWN0aXZlRWxlbWVudCkge1xuXHRcdFx0Ly8gVE9ETzogSW1wcm92ZSBsaWZlY3ljbGUgbWFuYWdlbWVudCB0aGlzIGV2ZW50IHNob3VsZCBiZSBkaXNwb3NlZCBhZnRlciBmaXJzdCBmaXJlXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbFNlcnZpY2Uub25EaWRDaGFuZ2VDb25uZWN0aW9uU3RhdGUoKCkgPT4ge1xuXHRcdFx0XHQvLyBPbmx5IGZvY3VzIHRoZSB0ZXJtaW5hbCBpZiB0aGUgYWN0aXZlRWxlbWVudCBoYXMgbm90IGNoYW5nZWQgc2luY2UgZm9jdXMoKSB3YXMgY2FsbGVkXG5cdFx0XHRcdC8vIFRPRE86IEhhY2tcblx0XHRcdFx0aWYgKGRvbS5pc0FjdGl2ZUVsZW1lbnQocHJldmlvdXNBY3RpdmVFbGVtZW50KSkge1xuXHRcdFx0XHRcdHRoaXMuX2ZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRmb2N1c0hvdmVyKCkge1xuXHRcdGlmICh0aGlzLl9zaG91bGRTaG93VGFicygpKSB7XG5cdFx0XHR0aGlzLl90YWJMaXN0LmZvY3VzSG92ZXIoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRpZiAoIWluc3RhbmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2hvdmVyU2VydmljZS5zaG93SW5zdGFudEhvdmVyKHtcblx0XHRcdC4uLmdldEluc3RhbmNlSG92ZXJJbmZvKGluc3RhbmNlLCB0aGlzLl9zdG9yYWdlU2VydmljZSksXG5cdFx0XHR0YXJnZXQ6IHRoaXMuX3Rlcm1pbmFsQ29udGFpbmVyLFxuXHRcdFx0dHJhcEZvY3VzOiB0cnVlXG5cdFx0fSwgdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF9mb2N1cygpIHtcblx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5hY3RpdmVJbnN0YW5jZT8uZm9jdXNXaGVuUmVhZHkoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQixhQUFhLFFBQVEsaUJBQWlCO0FBQy9ELFNBQVMsWUFBWSxpQkFBaUIsZUFBNEI7QUFDbEUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywrQkFBK0IsdUJBQTBDLGtCQUFrQiwrQkFBK0I7QUFDbkksU0FBUyx1QkFBdUIsdUJBQXVCO0FBQ3ZELFlBQVksU0FBUztBQUNyQixTQUFTLFFBQWlCLGlCQUFpQjtBQUMzQyxTQUFnQixjQUFjLGNBQWM7QUFDNUMsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUJBQXFCO0FBRTlCLE1BQU0sSUFBSSxJQUFJO0FBRWQsSUFB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
