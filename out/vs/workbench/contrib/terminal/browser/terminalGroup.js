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
import { TERMINAL_VIEW_ID } from "../common/terminal.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { SplitView, Orientation, Sizing } from "../../../../base/browser/ui/splitview/splitview.js";
import { isHorizontal, IWorkbenchLayoutService, Position } from "../../../services/layout/browser/layoutService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Direction, ITerminalInstanceService, ITerminalConfigurationService } from "./terminal.js";
import { ViewContainerLocation, IViewDescriptorService } from "../../../common/views.js";
import { TerminalLocation } from "../../../../platform/terminal/common/terminal.js";
import { TerminalStatus } from "./terminalStatusList.js";
import { getWindow } from "../../../../base/browser/dom.js";
import { getPartByLocation } from "../../../services/views/browser/viewsService.js";
import { asArray } from "../../../../base/common/arrays.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["SplitPaneMinSize"] = 80] = "SplitPaneMinSize";
  Constants2[Constants2["ResizePartCellCount"] = 4] = "ResizePartCellCount";
  return Constants2;
})(Constants || {});
class SplitPaneContainer extends Disposable {
  constructor(_container, orientation) {
    super();
    this._container = _container;
    this.orientation = orientation;
    this._splitViewDisposables = this._register(new DisposableStore());
    this._children = [];
    this._terminalToPane = /* @__PURE__ */ new Map();
    this._onDidChange = Event.None;
    this._width = this._container.offsetWidth;
    this._height = this._container.offsetHeight;
    this._createSplitView();
    this._splitView.layout(this.orientation === Orientation.HORIZONTAL ? this._width : this._height);
  }
  get onDidChange() {
    return this._onDidChange;
  }
  _createSplitView() {
    this._splitViewDisposables.clear();
    this._splitView = new SplitView(this._container, { orientation: this.orientation });
    this._splitViewDisposables.add(this._splitView);
    this._splitViewDisposables.add(this._splitView.onDidSashReset(() => this._splitView.distributeViewSizes()));
  }
  split(instance, index) {
    this._addChild(instance, index);
  }
  resizePane(index, direction, amount) {
    if (this._children.length <= 1) {
      return;
    }
    const sizes = [];
    for (let i = 0; i < this._splitView.length; i++) {
      sizes.push(this._splitView.getViewSize(i));
    }
    const isSizingEndPane = index !== this._children.length - 1;
    const indexToChange = isSizingEndPane ? index + 1 : index - 1;
    if (isSizingEndPane && direction === Direction.Left) {
      amount *= -1;
    } else if (!isSizingEndPane && direction === Direction.Right) {
      amount *= -1;
    } else if (isSizingEndPane && direction === Direction.Up) {
      amount *= -1;
    } else if (!isSizingEndPane && direction === Direction.Down) {
      amount *= -1;
    }
    if (sizes[index] + amount < 80 /* SplitPaneMinSize */) {
      amount = 80 /* SplitPaneMinSize */ - sizes[index];
    } else if (sizes[indexToChange] - amount < 80 /* SplitPaneMinSize */) {
      amount = sizes[indexToChange] - 80 /* SplitPaneMinSize */;
    }
    sizes[index] += amount;
    sizes[indexToChange] -= amount;
    for (let i = 0; i < this._splitView.length - 1; i++) {
      this._splitView.resizeView(i, sizes[i]);
    }
  }
  resizePanes(relativeSizes) {
    if (this._children.length <= 1) {
      return;
    }
    relativeSizes[relativeSizes.length - 1] += 1 - relativeSizes.reduce((totalValue, currentValue) => totalValue + currentValue, 0);
    let totalSize = 0;
    for (let i = 0; i < this._splitView.length; i++) {
      totalSize += this._splitView.getViewSize(i);
    }
    for (let i = 0; i < this._splitView.length; i++) {
      this._splitView.resizeView(i, totalSize * relativeSizes[i]);
    }
  }
  getPaneSize(instance) {
    const paneForInstance = this._terminalToPane.get(instance);
    if (!paneForInstance) {
      return 0;
    }
    const index = this._children.indexOf(paneForInstance);
    return this._splitView.getViewSize(index);
  }
  _addChild(instance, index) {
    const child = new SplitPane(instance, this.orientation === Orientation.HORIZONTAL ? this._height : this._width);
    child.orientation = this.orientation;
    if (typeof index === "number") {
      this._children.splice(index, 0, child);
    } else {
      this._children.push(child);
    }
    this._terminalToPane.set(instance, this._children[this._children.indexOf(child)]);
    this._withDisabledLayout(() => this._splitView.addView(child, Sizing.Distribute, index));
    this.layout(this._width, this._height);
    this._onDidChange = Event.any(...this._children.map((c) => c.onDidChange));
  }
  remove(instance) {
    let index = null;
    for (let i = 0; i < this._children.length; i++) {
      if (this._children[i].instance === instance) {
        index = i;
      }
    }
    if (index !== null) {
      this._children.splice(index, 1);
      this._terminalToPane.delete(instance);
      this._splitView.removeView(index, Sizing.Distribute);
      instance.detachFromElement();
    }
  }
  layout(width, height) {
    this._width = width;
    this._height = height;
    if (this.orientation === Orientation.HORIZONTAL) {
      this._children.forEach((c) => c.orthogonalLayout(height));
      this._splitView.layout(width);
    } else {
      this._children.forEach((c) => c.orthogonalLayout(width));
      this._splitView.layout(height);
    }
  }
  setOrientation(orientation) {
    if (this.orientation === orientation) {
      return;
    }
    this.orientation = orientation;
    while (this._container.children.length > 0) {
      this._container.children[0].remove();
    }
    this._createSplitView();
    this._withDisabledLayout(() => {
      this._children.forEach((child) => {
        child.orientation = orientation;
        this._splitView.addView(child, 1);
      });
    });
  }
  _withDisabledLayout(innerFunction) {
    this._children.forEach((c) => c.instance.disableLayout = true);
    innerFunction();
    this._children.forEach((c) => c.instance.disableLayout = false);
  }
}
class SplitPane {
  constructor(instance, orthogonalSize) {
    this.instance = instance;
    this.orthogonalSize = orthogonalSize;
    this.minimumSize = 80 /* SplitPaneMinSize */;
    this.maximumSize = Number.MAX_VALUE;
    this._onDidChange = Event.None;
    this.element = document.createElement("div");
    this.element.className = "terminal-split-pane";
    this.instance.attachToElement(this.element);
  }
  get onDidChange() {
    return this._onDidChange;
  }
  layout(size) {
    if (!size || !this.orthogonalSize) {
      return;
    }
    if (this.orientation === Orientation.VERTICAL) {
      this.instance.layout({ width: this.orthogonalSize, height: size });
    } else {
      this.instance.layout({ width: size, height: this.orthogonalSize });
    }
  }
  orthogonalLayout(size) {
    this.orthogonalSize = size;
  }
}
let TerminalGroup = class extends Disposable {
  constructor(_container, shellLaunchConfigOrInstance, _terminalConfigurationService, _terminalInstanceService, _layoutService, _viewDescriptorService, _instantiationService) {
    super();
    this._container = _container;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalInstanceService = _terminalInstanceService;
    this._layoutService = _layoutService;
    this._viewDescriptorService = _viewDescriptorService;
    this._instantiationService = _instantiationService;
    this._terminalInstances = [];
    this._panelPosition = Position.BOTTOM;
    this._terminalLocation = ViewContainerLocation.Panel;
    this._instanceDisposables = /* @__PURE__ */ new Map();
    this._activeInstanceIndex = -1;
    this._visible = false;
    this._onDidDisposeInstance = this._register(new Emitter());
    this.onDidDisposeInstance = this._onDidDisposeInstance.event;
    this._onDidFocusInstance = this._register(new Emitter());
    this.onDidFocusInstance = this._onDidFocusInstance.event;
    this._onDidChangeInstanceCapability = this._register(new Emitter());
    this.onDidChangeInstanceCapability = this._onDidChangeInstanceCapability.event;
    this._onDisposed = this._register(new Emitter());
    this.onDisposed = this._onDisposed.event;
    this._onInstancesChanged = this._register(new Emitter());
    this.onInstancesChanged = this._onInstancesChanged.event;
    this._onDidChangeActiveInstance = this._register(new Emitter());
    this.onDidChangeActiveInstance = this._onDidChangeActiveInstance.event;
    this._onPanelOrientationChanged = this._register(new Emitter());
    this.onPanelOrientationChanged = this._onPanelOrientationChanged.event;
    if (shellLaunchConfigOrInstance) {
      this.addInstance(shellLaunchConfigOrInstance);
    }
    if (this._container) {
      this.attachToElement(this._container);
    }
    this._onPanelOrientationChanged.fire(this._terminalLocation === ViewContainerLocation.Panel && isHorizontal(this._panelPosition) ? Orientation.HORIZONTAL : Orientation.VERTICAL);
    this._register(toDisposable(() => {
      if (this._container && this._groupElement) {
        this._groupElement.remove();
        this._groupElement = void 0;
      }
    }));
  }
  get terminalInstances() {
    return this._terminalInstances;
  }
  addInstance(shellLaunchConfigOrInstance, parentTerminalId) {
    let instance;
    const parentIndex = parentTerminalId ? this._terminalInstances.findIndex((t) => t.instanceId === parentTerminalId) : this._activeInstanceIndex;
    if ("instanceId" in shellLaunchConfigOrInstance) {
      instance = shellLaunchConfigOrInstance;
    } else {
      instance = this._terminalInstanceService.createInstance(shellLaunchConfigOrInstance, TerminalLocation.Panel);
    }
    if (this._terminalInstances.length === 0) {
      this._terminalInstances.push(instance);
      this._activeInstanceIndex = 0;
    } else {
      this._terminalInstances.splice(parentIndex + 1, 0, instance);
    }
    this._initInstanceListeners(instance);
    if (this._splitPaneContainer) {
      this._splitPaneContainer.split(instance, parentIndex + 1);
    }
    this._onInstancesChanged.fire();
  }
  dispose() {
    this._terminalInstances = [];
    this._onInstancesChanged.fire();
    this._splitPaneContainer?.dispose();
    super.dispose();
  }
  get activeInstance() {
    if (this._terminalInstances.length === 0) {
      return void 0;
    }
    return this._terminalInstances[this._activeInstanceIndex];
  }
  getLayoutInfo(isActive) {
    const instances = this.terminalInstances.filter((instance) => typeof instance.persistentProcessId === "number" && instance.shouldPersist);
    const totalSize = instances.map((t) => this._splitPaneContainer?.getPaneSize(t) || 0).reduce((total, size) => total += size, 0);
    return {
      isActive,
      activePersistentProcessId: this.activeInstance ? this.activeInstance.persistentProcessId : void 0,
      terminals: instances.map((t) => {
        return {
          relativeSize: totalSize > 0 ? this._splitPaneContainer.getPaneSize(t) / totalSize : 0,
          terminal: t.persistentProcessId || 0
        };
      })
    };
  }
  _initInstanceListeners(instance) {
    this._instanceDisposables.set(instance.instanceId, [
      instance.onDisposed((instance2) => {
        this._onDidDisposeInstance.fire(instance2);
        this._handleOnDidDisposeInstance(instance2);
      }),
      instance.onDidFocus((instance2) => {
        this._setActiveInstance(instance2);
        this._onDidFocusInstance.fire(instance2);
      }),
      instance.capabilities.onDidAddCapabilityType(() => this._onDidChangeInstanceCapability.fire(instance)),
      instance.capabilities.onDidRemoveCapabilityType(() => this._onDidChangeInstanceCapability.fire(instance))
    ]);
  }
  _handleOnDidDisposeInstance(instance) {
    this._removeInstance(instance);
  }
  removeInstance(instance) {
    this._removeInstance(instance);
  }
  _removeInstance(instance) {
    const index = this._terminalInstances.indexOf(instance);
    if (index === -1) {
      return;
    }
    const wasActiveInstance = instance === this.activeInstance;
    this._terminalInstances.splice(index, 1);
    if (wasActiveInstance && this._terminalInstances.length > 0) {
      const newIndex = index < this._terminalInstances.length ? index : this._terminalInstances.length - 1;
      this.setActiveInstanceByIndex(newIndex);
      this.activeInstance?.focus(true);
    } else if (index < this._activeInstanceIndex) {
      this._activeInstanceIndex--;
    }
    this._splitPaneContainer?.remove(instance);
    if (this._terminalInstances.length === 0) {
      this._onDisposed.fire(this);
      this.dispose();
    } else {
      this._onInstancesChanged.fire();
    }
    const disposables = this._instanceDisposables.get(instance.instanceId);
    if (disposables) {
      dispose(disposables);
      this._instanceDisposables.delete(instance.instanceId);
    }
  }
  moveInstance(instances, index, position) {
    instances = asArray(instances);
    const hasInvalidInstance = instances.some((instance) => !this.terminalInstances.includes(instance));
    if (hasInvalidInstance) {
      return;
    }
    const insertIndex = position === "before" ? index : index + 1;
    this._terminalInstances.splice(insertIndex, 0, ...instances);
    for (const item of instances) {
      const originSourceGroupIndex = position === "after" ? this._terminalInstances.indexOf(item) : this._terminalInstances.lastIndexOf(item);
      this._terminalInstances.splice(originSourceGroupIndex, 1);
    }
    if (this._splitPaneContainer) {
      for (let i = 0; i < instances.length; i++) {
        const item = instances[i];
        this._splitPaneContainer.remove(item);
        this._splitPaneContainer.split(item, index + (position === "before" ? i : 0));
      }
    }
    this._onInstancesChanged.fire();
  }
  _setActiveInstance(instance) {
    this.setActiveInstanceByIndex(this._getIndexFromId(instance.instanceId));
  }
  _getIndexFromId(terminalId) {
    let terminalIndex = -1;
    this.terminalInstances.forEach((terminalInstance, i) => {
      if (terminalInstance.instanceId === terminalId) {
        terminalIndex = i;
      }
    });
    if (terminalIndex === -1) {
      throw new Error(`Terminal with ID ${terminalId} does not exist (has it already been disposed?)`);
    }
    return terminalIndex;
  }
  setActiveInstanceByIndex(index, force) {
    if (index < 0 || index >= this._terminalInstances.length) {
      return;
    }
    const oldActiveInstance = this.activeInstance;
    this._activeInstanceIndex = index;
    if (oldActiveInstance !== this.activeInstance || force) {
      this._onInstancesChanged.fire();
      this._onDidChangeActiveInstance.fire(this.activeInstance);
    }
  }
  attachToElement(element) {
    this._container = element;
    if (!this._groupElement) {
      this._groupElement = document.createElement("div");
      this._groupElement.classList.add("terminal-group");
    }
    this._container.appendChild(this._groupElement);
    if (!this._splitPaneContainer) {
      this._panelPosition = this._layoutService.getPanelPosition();
      this._terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
      const orientation = this._terminalLocation === ViewContainerLocation.Panel && isHorizontal(this._panelPosition) ? Orientation.HORIZONTAL : Orientation.VERTICAL;
      this._splitPaneContainer = this._instantiationService.createInstance(SplitPaneContainer, this._groupElement, orientation);
      this.terminalInstances.forEach((instance) => this._splitPaneContainer.split(instance, this._activeInstanceIndex + 1));
    }
  }
  get title() {
    if (this._terminalInstances.length === 0) {
      return "";
    }
    let title = this.terminalInstances[0].title + this._getBellTitle(this.terminalInstances[0]);
    if (this.terminalInstances[0].description) {
      title += ` (${this.terminalInstances[0].description})`;
    }
    for (let i = 1; i < this.terminalInstances.length; i++) {
      const instance = this.terminalInstances[i];
      if (instance.title) {
        title += `, ${instance.title + this._getBellTitle(instance)}`;
        if (instance.description) {
          title += ` (${instance.description})`;
        }
      }
    }
    return title;
  }
  _getBellTitle(instance) {
    if (this._terminalConfigurationService.config.enableBell && instance.statusList.statuses.some((e) => e.id === TerminalStatus.Bell)) {
      return "*";
    }
    return "";
  }
  setVisible(visible) {
    this._visible = visible;
    if (this._groupElement) {
      this._groupElement.style.display = visible ? "" : "none";
    }
    this.terminalInstances.forEach((i) => i.setVisible(visible));
  }
  split(shellLaunchConfig) {
    const instance = this._terminalInstanceService.createInstance(shellLaunchConfig, TerminalLocation.Panel);
    this.addInstance(instance, shellLaunchConfig.parentTerminalId);
    this._setActiveInstance(instance);
    return instance;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
  layout(width, height) {
    if (this._splitPaneContainer) {
      const newPanelPosition = this._layoutService.getPanelPosition();
      const newTerminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
      const terminalPositionChanged = newPanelPosition !== this._panelPosition || newTerminalLocation !== this._terminalLocation;
      if (terminalPositionChanged) {
        const newOrientation = newTerminalLocation === ViewContainerLocation.Panel && isHorizontal(newPanelPosition) ? Orientation.HORIZONTAL : Orientation.VERTICAL;
        this._splitPaneContainer.setOrientation(newOrientation);
        this._panelPosition = newPanelPosition;
        this._terminalLocation = newTerminalLocation;
        this._onPanelOrientationChanged.fire(this._splitPaneContainer.orientation);
      }
      this._splitPaneContainer.layout(width, height);
      if (this._initialRelativeSizes && this._visible) {
        this.resizePanes(this._initialRelativeSizes);
        this._initialRelativeSizes = void 0;
      }
    }
  }
  focusPreviousPane() {
    const newIndex = this._activeInstanceIndex === 0 ? this._terminalInstances.length - 1 : this._activeInstanceIndex - 1;
    this.setActiveInstanceByIndex(newIndex);
  }
  focusNextPane() {
    const newIndex = this._activeInstanceIndex === this._terminalInstances.length - 1 ? 0 : this._activeInstanceIndex + 1;
    this.setActiveInstanceByIndex(newIndex);
  }
  _getPosition() {
    switch (this._terminalLocation) {
      case ViewContainerLocation.Panel:
        return this._panelPosition;
      case ViewContainerLocation.Sidebar:
        return this._layoutService.getSideBarPosition();
      case ViewContainerLocation.AuxiliaryBar:
        return this._layoutService.getSideBarPosition() === Position.LEFT ? Position.RIGHT : Position.LEFT;
    }
  }
  _getOrientation() {
    return isHorizontal(this._getPosition()) ? Orientation.HORIZONTAL : Orientation.VERTICAL;
  }
  resizePane(direction) {
    if (!this._splitPaneContainer) {
      return;
    }
    const isHorizontalResize = direction === Direction.Left || direction === Direction.Right;
    const groupOrientation = this._getOrientation();
    const shouldResizePart = isHorizontalResize && groupOrientation === Orientation.VERTICAL || !isHorizontalResize && groupOrientation === Orientation.HORIZONTAL;
    const font = this._terminalConfigurationService.getFont(getWindow(this._groupElement));
    const charSize = isHorizontalResize ? font.charWidth : font.charHeight;
    if (charSize) {
      let resizeAmount = charSize * 4 /* ResizePartCellCount */;
      if (shouldResizePart) {
        const position = this._getPosition();
        const shouldShrink = position === Position.LEFT && direction === Direction.Left || position === Position.RIGHT && direction === Direction.Right || position === Position.BOTTOM && direction === Direction.Down || position === Position.TOP && direction === Direction.Up;
        if (shouldShrink) {
          resizeAmount *= -1;
        }
        this._layoutService.resizePart(getPartByLocation(this._terminalLocation), resizeAmount, resizeAmount);
      } else {
        this._splitPaneContainer.resizePane(this._activeInstanceIndex, direction, resizeAmount);
      }
    }
  }
  resizePanes(relativeSizes) {
    if (!this._splitPaneContainer) {
      this._initialRelativeSizes = relativeSizes;
      return;
    }
    this._splitPaneContainer.resizePanes(relativeSizes);
  }
};
TerminalGroup = __decorateClass([
  __decorateParam(2, ITerminalConfigurationService),
  __decorateParam(3, ITerminalInstanceService),
  __decorateParam(4, IWorkbenchLayoutService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService)
], TerminalGroup);
export {
  TerminalGroup
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsR3JvdXAudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBURVJNSU5BTF9WSUVXX0lEIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNwbGl0VmlldywgT3JpZW50YXRpb24sIElWaWV3LCBTaXppbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc3BsaXR2aWV3L3NwbGl0dmlldy5qcyc7XG5pbXBvcnQgeyBpc0hvcml6b250YWwsIElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxJbnN0YW5jZSwgRGlyZWN0aW9uLCBJVGVybWluYWxHcm91cCwgSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLCBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRhaW5lckxvY2F0aW9uLCBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElTaGVsbExhdW5jaENvbmZpZywgSVRlcm1pbmFsVGFiTGF5b3V0SW5mb0J5SWQsIFRlcm1pbmFsTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxTdGF0dXMgfSBmcm9tICcuL3Rlcm1pbmFsU3RhdHVzTGlzdC5qcyc7XG5pbXBvcnQgeyBnZXRXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGdldFBhcnRCeUxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvYnJvd3Nlci92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgYXNBcnJheSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5cbmNvbnN0IGVudW0gQ29uc3RhbnRzIHtcblx0LyoqXG5cdCAqIFRoZSBtaW5pbXVtIHNpemUgaW4gcGl4ZWxzIG9mIGEgc3BsaXQgcGFuZS5cblx0ICovXG5cdFNwbGl0UGFuZU1pblNpemUgPSA4MCxcblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2YgY2VsbHMgdGhlIHRlcm1pbmFsIGdldHMgYWRkZWQgb3IgcmVtb3ZlZCB3aGVuIGFza2VkIHRvIGluY3JlYXNlIG9yIGRlY3JlYXNlXG5cdCAqIHRoZSB2aWV3IHNpemUuXG5cdCAqL1xuXHRSZXNpemVQYXJ0Q2VsbENvdW50ID0gNFxufVxuXG5jbGFzcyBTcGxpdFBhbmVDb250YWluZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfaGVpZ2h0OiBudW1iZXI7XG5cdHByaXZhdGUgX3dpZHRoOiBudW1iZXI7XG5cdHByaXZhdGUgX3NwbGl0VmlldyE6IFNwbGl0Vmlldztcblx0cHJpdmF0ZSByZWFkb25seSBfc3BsaXRWaWV3RGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIF9jaGlsZHJlbjogU3BsaXRQYW5lW10gPSBbXTtcblx0cHJpdmF0ZSBfdGVybWluYWxUb1BhbmU6IE1hcDxJVGVybWluYWxJbnN0YW5jZSwgU3BsaXRQYW5lPiA9IG5ldyBNYXAoKTtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZTogRXZlbnQ8bnVtYmVyIHwgdW5kZWZpbmVkPiA9IEV2ZW50Lk5vbmU7XG5cdGdldCBvbkRpZENoYW5nZSgpOiBFdmVudDxudW1iZXIgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwdWJsaWMgb3JpZW50YXRpb246IE9yaWVudGF0aW9uLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3dpZHRoID0gdGhpcy5fY29udGFpbmVyLm9mZnNldFdpZHRoO1xuXHRcdHRoaXMuX2hlaWdodCA9IHRoaXMuX2NvbnRhaW5lci5vZmZzZXRIZWlnaHQ7XG5cdFx0dGhpcy5fY3JlYXRlU3BsaXRWaWV3KCk7XG5cdFx0dGhpcy5fc3BsaXRWaWV3LmxheW91dCh0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5IT1JJWk9OVEFMID8gdGhpcy5fd2lkdGggOiB0aGlzLl9oZWlnaHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlU3BsaXRWaWV3KCk6IHZvaWQge1xuXHRcdHRoaXMuX3NwbGl0Vmlld0Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fc3BsaXRWaWV3ID0gbmV3IFNwbGl0Vmlldyh0aGlzLl9jb250YWluZXIsIHsgb3JpZW50YXRpb246IHRoaXMub3JpZW50YXRpb24gfSk7XG5cdFx0dGhpcy5fc3BsaXRWaWV3RGlzcG9zYWJsZXMuYWRkKHRoaXMuX3NwbGl0Vmlldyk7XG5cdFx0dGhpcy5fc3BsaXRWaWV3RGlzcG9zYWJsZXMuYWRkKHRoaXMuX3NwbGl0Vmlldy5vbkRpZFNhc2hSZXNldCgoKSA9PiB0aGlzLl9zcGxpdFZpZXcuZGlzdHJpYnV0ZVZpZXdTaXplcygpKSk7XG5cdH1cblxuXHRzcGxpdChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UsIGluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9hZGRDaGlsZChpbnN0YW5jZSwgaW5kZXgpO1xuXHR9XG5cblx0cmVzaXplUGFuZShpbmRleDogbnVtYmVyLCBkaXJlY3Rpb246IERpcmVjdGlvbiwgYW1vdW50OiBudW1iZXIpOiB2b2lkIHtcblx0XHQvLyBPbmx5IHJlc2l6ZSB3aGVuIHRoZXJlIGlzIG1vcmUgdGhhbiBvbmUgcGFuZVxuXHRcdGlmICh0aGlzLl9jaGlsZHJlbi5sZW5ndGggPD0gMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEdldCBzaXplc1xuXHRcdGNvbnN0IHNpemVzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fc3BsaXRWaWV3Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRzaXplcy5wdXNoKHRoaXMuX3NwbGl0Vmlldy5nZXRWaWV3U2l6ZShpKSk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIHNpemUgZnJvbSByaWdodCBwYW5lLCB1bmxlc3MgaW5kZXggaXMgdGhlIGxhc3QgcGFuZSBpbiB3aGljaCBjYXNlIHVzZSBsZWZ0IHBhbmVcblx0XHRjb25zdCBpc1NpemluZ0VuZFBhbmUgPSBpbmRleCAhPT0gdGhpcy5fY2hpbGRyZW4ubGVuZ3RoIC0gMTtcblx0XHRjb25zdCBpbmRleFRvQ2hhbmdlID0gaXNTaXppbmdFbmRQYW5lID8gaW5kZXggKyAxIDogaW5kZXggLSAxO1xuXHRcdGlmIChpc1NpemluZ0VuZFBhbmUgJiYgZGlyZWN0aW9uID09PSBEaXJlY3Rpb24uTGVmdCkge1xuXHRcdFx0YW1vdW50ICo9IC0xO1xuXHRcdH0gZWxzZSBpZiAoIWlzU2l6aW5nRW5kUGFuZSAmJiBkaXJlY3Rpb24gPT09IERpcmVjdGlvbi5SaWdodCkge1xuXHRcdFx0YW1vdW50ICo9IC0xO1xuXHRcdH0gZWxzZSBpZiAoaXNTaXppbmdFbmRQYW5lICYmIGRpcmVjdGlvbiA9PT0gRGlyZWN0aW9uLlVwKSB7XG5cdFx0XHRhbW91bnQgKj0gLTE7XG5cdFx0fSBlbHNlIGlmICghaXNTaXppbmdFbmRQYW5lICYmIGRpcmVjdGlvbiA9PT0gRGlyZWN0aW9uLkRvd24pIHtcblx0XHRcdGFtb3VudCAqPSAtMTtcblx0XHR9XG5cblx0XHQvLyBFbnN1cmUgdGhlIHNpemUgaXMgbm90IHJlZHVjZWQgYmV5b25kIHRoZSBtaW5pbXVtLCBvdGhlcndpc2Ugd2VpcmQgdGhpbmdzIGNhbiBoYXBwZW5cblx0XHRpZiAoc2l6ZXNbaW5kZXhdICsgYW1vdW50IDwgQ29uc3RhbnRzLlNwbGl0UGFuZU1pblNpemUpIHtcblx0XHRcdGFtb3VudCA9IENvbnN0YW50cy5TcGxpdFBhbmVNaW5TaXplIC0gc2l6ZXNbaW5kZXhdO1xuXHRcdH0gZWxzZSBpZiAoc2l6ZXNbaW5kZXhUb0NoYW5nZV0gLSBhbW91bnQgPCBDb25zdGFudHMuU3BsaXRQYW5lTWluU2l6ZSkge1xuXHRcdFx0YW1vdW50ID0gc2l6ZXNbaW5kZXhUb0NoYW5nZV0gLSBDb25zdGFudHMuU3BsaXRQYW5lTWluU2l6ZTtcblx0XHR9XG5cblx0XHQvLyBBcHBseSB0aGUgc2l6ZSBjaGFuZ2Vcblx0XHRzaXplc1tpbmRleF0gKz0gYW1vdW50O1xuXHRcdHNpemVzW2luZGV4VG9DaGFuZ2VdIC09IGFtb3VudDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3NwbGl0Vmlldy5sZW5ndGggLSAxOyBpKyspIHtcblx0XHRcdHRoaXMuX3NwbGl0Vmlldy5yZXNpemVWaWV3KGksIHNpemVzW2ldKTtcblx0XHR9XG5cdH1cblxuXHRyZXNpemVQYW5lcyhyZWxhdGl2ZVNpemVzOiBudW1iZXJbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9jaGlsZHJlbi5sZW5ndGggPD0gMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIGFzc2lnbiBhbnkgZXh0cmEgc2l6ZSB0byBsYXN0IHRlcm1pbmFsXG5cdFx0cmVsYXRpdmVTaXplc1tyZWxhdGl2ZVNpemVzLmxlbmd0aCAtIDFdICs9IDEgLSByZWxhdGl2ZVNpemVzLnJlZHVjZSgodG90YWxWYWx1ZSwgY3VycmVudFZhbHVlKSA9PiB0b3RhbFZhbHVlICsgY3VycmVudFZhbHVlLCAwKTtcblx0XHRsZXQgdG90YWxTaXplID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3NwbGl0Vmlldy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dG90YWxTaXplICs9IHRoaXMuX3NwbGl0Vmlldy5nZXRWaWV3U2l6ZShpKTtcblx0XHR9XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9zcGxpdFZpZXcubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRoaXMuX3NwbGl0Vmlldy5yZXNpemVWaWV3KGksIHRvdGFsU2l6ZSAqIHJlbGF0aXZlU2l6ZXNbaV0pO1xuXHRcdH1cblx0fVxuXG5cdGdldFBhbmVTaXplKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IG51bWJlciB7XG5cdFx0Y29uc3QgcGFuZUZvckluc3RhbmNlID0gdGhpcy5fdGVybWluYWxUb1BhbmUuZ2V0KGluc3RhbmNlKTtcblx0XHRpZiAoIXBhbmVGb3JJbnN0YW5jZSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9jaGlsZHJlbi5pbmRleE9mKHBhbmVGb3JJbnN0YW5jZSk7XG5cdFx0cmV0dXJuIHRoaXMuX3NwbGl0Vmlldy5nZXRWaWV3U2l6ZShpbmRleCk7XG5cdH1cblxuXHRwcml2YXRlIF9hZGRDaGlsZChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UsIGluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBjaGlsZCA9IG5ldyBTcGxpdFBhbmUoaW5zdGFuY2UsIHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyB0aGlzLl9oZWlnaHQgOiB0aGlzLl93aWR0aCk7XG5cdFx0Y2hpbGQub3JpZW50YXRpb24gPSB0aGlzLm9yaWVudGF0aW9uO1xuXHRcdGlmICh0eXBlb2YgaW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLl9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDAsIGNoaWxkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY2hpbGRyZW4ucHVzaChjaGlsZCk7XG5cdFx0fVxuXHRcdHRoaXMuX3Rlcm1pbmFsVG9QYW5lLnNldChpbnN0YW5jZSwgdGhpcy5fY2hpbGRyZW5bdGhpcy5fY2hpbGRyZW4uaW5kZXhPZihjaGlsZCldKTtcblxuXHRcdHRoaXMuX3dpdGhEaXNhYmxlZExheW91dCgoKSA9PiB0aGlzLl9zcGxpdFZpZXcuYWRkVmlldyhjaGlsZCwgU2l6aW5nLkRpc3RyaWJ1dGUsIGluZGV4KSk7XG5cdFx0dGhpcy5sYXlvdXQodGhpcy5fd2lkdGgsIHRoaXMuX2hlaWdodCk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZSA9IEV2ZW50LmFueSguLi50aGlzLl9jaGlsZHJlbi5tYXAoYyA9PiBjLm9uRGlkQ2hhbmdlKSk7XG5cdH1cblxuXHRyZW1vdmUoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogdm9pZCB7XG5cdFx0bGV0IGluZGV4OiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAodGhpcy5fY2hpbGRyZW5baV0uaW5zdGFuY2UgPT09IGluc3RhbmNlKSB7XG5cdFx0XHRcdGluZGV4ID0gaTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGluZGV4ICE9PSBudWxsKSB7XG5cdFx0XHR0aGlzLl9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0dGhpcy5fdGVybWluYWxUb1BhbmUuZGVsZXRlKGluc3RhbmNlKTtcblx0XHRcdHRoaXMuX3NwbGl0Vmlldy5yZW1vdmVWaWV3KGluZGV4LCBTaXppbmcuRGlzdHJpYnV0ZSk7XG5cdFx0XHRpbnN0YW5jZS5kZXRhY2hGcm9tRWxlbWVudCgpO1xuXHRcdH1cblx0fVxuXG5cdGxheW91dCh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3dpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdGlmICh0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5IT1JJWk9OVEFMKSB7XG5cdFx0XHR0aGlzLl9jaGlsZHJlbi5mb3JFYWNoKGMgPT4gYy5vcnRob2dvbmFsTGF5b3V0KGhlaWdodCkpO1xuXHRcdFx0dGhpcy5fc3BsaXRWaWV3LmxheW91dCh3aWR0aCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2NoaWxkcmVuLmZvckVhY2goYyA9PiBjLm9ydGhvZ29uYWxMYXlvdXQod2lkdGgpKTtcblx0XHRcdHRoaXMuX3NwbGl0Vmlldy5sYXlvdXQoaGVpZ2h0KTtcblx0XHR9XG5cdH1cblxuXHRzZXRPcmllbnRhdGlvbihvcmllbnRhdGlvbjogT3JpZW50YXRpb24pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5vcmllbnRhdGlvbiA9PT0gb3JpZW50YXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5vcmllbnRhdGlvbiA9IG9yaWVudGF0aW9uO1xuXG5cdFx0Ly8gUmVtb3ZlIG9sZCBzcGxpdCB2aWV3XG5cdFx0d2hpbGUgKHRoaXMuX2NvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9jb250YWluZXIuY2hpbGRyZW5bMF0ucmVtb3ZlKCk7XG5cdFx0fVxuXG5cdFx0Ly8gQ3JlYXRlIG5ldyBzcGxpdCB2aWV3IHdpdGggdXBkYXRlZCBvcmllbnRhdGlvblxuXHRcdHRoaXMuX2NyZWF0ZVNwbGl0VmlldygpO1xuXHRcdHRoaXMuX3dpdGhEaXNhYmxlZExheW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcblx0XHRcdFx0Y2hpbGQub3JpZW50YXRpb24gPSBvcmllbnRhdGlvbjtcblx0XHRcdFx0dGhpcy5fc3BsaXRWaWV3LmFkZFZpZXcoY2hpbGQsIDEpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF93aXRoRGlzYWJsZWRMYXlvdXQoaW5uZXJGdW5jdGlvbjogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdC8vIFdoZW5ldmVyIG1hbmlwdWxhdGluZyB2aWV3cyB0aGF0IGFyZSBnb2luZyB0byBiZSBjaGFuZ2VkIGltbWVkaWF0ZWx5LCBkaXNhYmxpbmdcblx0XHQvLyBsYXlvdXQvcmVzaXplIGV2ZW50cyBpbiB0aGUgdGVybWluYWwgcHJldmVudCBiYWQgZGltZW5zaW9ucyBnb2luZyB0byB0aGUgcHR5LlxuXHRcdHRoaXMuX2NoaWxkcmVuLmZvckVhY2goYyA9PiBjLmluc3RhbmNlLmRpc2FibGVMYXlvdXQgPSB0cnVlKTtcblx0XHRpbm5lckZ1bmN0aW9uKCk7XG5cdFx0dGhpcy5fY2hpbGRyZW4uZm9yRWFjaChjID0+IGMuaW5zdGFuY2UuZGlzYWJsZUxheW91dCA9IGZhbHNlKTtcblx0fVxufVxuXG5jbGFzcyBTcGxpdFBhbmUgaW1wbGVtZW50cyBJVmlldyB7XG5cdG1pbmltdW1TaXplOiBudW1iZXIgPSBDb25zdGFudHMuU3BsaXRQYW5lTWluU2l6ZTtcblx0bWF4aW11bVNpemU6IG51bWJlciA9IE51bWJlci5NQVhfVkFMVUU7XG5cblx0b3JpZW50YXRpb246IE9yaWVudGF0aW9uIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlOiBFdmVudDxudW1iZXIgfCB1bmRlZmluZWQ+ID0gRXZlbnQuTm9uZTtcblx0Z2V0IG9uRGlkQ2hhbmdlKCk6IEV2ZW50PG51bWJlciB8IHVuZGVmaW5lZD4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2U7IH1cblxuXHRyZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UsXG5cdFx0cHVibGljIG9ydGhvZ29uYWxTaXplOiBudW1iZXJcblx0KSB7XG5cdFx0dGhpcy5lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTmFtZSA9ICd0ZXJtaW5hbC1zcGxpdC1wYW5lJztcblx0XHR0aGlzLmluc3RhbmNlLmF0dGFjaFRvRWxlbWVudCh0aGlzLmVsZW1lbnQpO1xuXHR9XG5cblx0bGF5b3V0KHNpemU6IG51bWJlcik6IHZvaWQge1xuXHRcdC8vIE9ubHkgbGF5b3V0IHdoZW4gYm90aCBzaXplcyBhcmUga25vd25cblx0XHRpZiAoIXNpemUgfHwgIXRoaXMub3J0aG9nb25hbFNpemUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwpIHtcblx0XHRcdHRoaXMuaW5zdGFuY2UubGF5b3V0KHsgd2lkdGg6IHRoaXMub3J0aG9nb25hbFNpemUsIGhlaWdodDogc2l6ZSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5pbnN0YW5jZS5sYXlvdXQoeyB3aWR0aDogc2l6ZSwgaGVpZ2h0OiB0aGlzLm9ydGhvZ29uYWxTaXplIH0pO1xuXHRcdH1cblx0fVxuXG5cdG9ydGhvZ29uYWxMYXlvdXQoc2l6ZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5vcnRob2dvbmFsU2l6ZSA9IHNpemU7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsR3JvdXAgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlcm1pbmFsR3JvdXAge1xuXHRwcml2YXRlIF90ZXJtaW5hbEluc3RhbmNlczogSVRlcm1pbmFsSW5zdGFuY2VbXSA9IFtdO1xuXHRwcml2YXRlIF9zcGxpdFBhbmVDb250YWluZXI6IFNwbGl0UGFuZUNvbnRhaW5lciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZ3JvdXBFbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcGFuZWxQb3NpdGlvbjogUG9zaXRpb24gPSBQb3NpdGlvbi5CT1RUT007XG5cdHByaXZhdGUgX3Rlcm1pbmFsTG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiA9IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbDtcblx0cHJpdmF0ZSBfaW5zdGFuY2VEaXNwb3NhYmxlczogTWFwPG51bWJlciwgSURpc3Bvc2FibGVbXT4gPSBuZXcgTWFwKCk7XG5cblx0cHJpdmF0ZSBfYWN0aXZlSW5zdGFuY2VJbmRleDogbnVtYmVyID0gLTE7XG5cblx0Z2V0IHRlcm1pbmFsSW5zdGFuY2VzKCk6IElUZXJtaW5hbEluc3RhbmNlW10geyByZXR1cm4gdGhpcy5fdGVybWluYWxJbnN0YW5jZXM7IH1cblxuXHRwcml2YXRlIF9pbml0aWFsUmVsYXRpdmVTaXplczogbnVtYmVyW10gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Zpc2libGU6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZERpc3Bvc2VJbnN0YW5jZTogRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRGlzcG9zZUluc3RhbmNlID0gdGhpcy5fb25EaWREaXNwb3NlSW5zdGFuY2UuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRm9jdXNJbnN0YW5jZTogRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXNJbnN0YW5jZSA9IHRoaXMuX29uRGlkRm9jdXNJbnN0YW5jZS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VJbnN0YW5jZUNhcGFiaWxpdHk6IEVtaXR0ZXI8SVRlcm1pbmFsSW5zdGFuY2U+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRlcm1pbmFsSW5zdGFuY2U+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUluc3RhbmNlQ2FwYWJpbGl0eSA9IHRoaXMuX29uRGlkQ2hhbmdlSW5zdGFuY2VDYXBhYmlsaXR5LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpc3Bvc2VkOiBFbWl0dGVyPElUZXJtaW5hbEdyb3VwPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbEdyb3VwPigpKTtcblx0cmVhZG9ubHkgb25EaXNwb3NlZCA9IHRoaXMuX29uRGlzcG9zZWQuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uSW5zdGFuY2VzQ2hhbmdlZDogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkluc3RhbmNlc0NoYW5nZWQgPSB0aGlzLl9vbkluc3RhbmNlc0NoYW5nZWQuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UgPSB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUluc3RhbmNlLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblBhbmVsT3JpZW50YXRpb25DaGFuZ2VkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8T3JpZW50YXRpb24+KCkpO1xuXHRyZWFkb25seSBvblBhbmVsT3JpZW50YXRpb25DaGFuZ2VkID0gdGhpcy5fb25QYW5lbE9yaWVudGF0aW9uQ2hhbmdlZC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9jb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkLFxuXHRcdHNoZWxsTGF1bmNoQ29uZmlnT3JJbnN0YW5jZTogSVNoZWxsTGF1bmNoQ29uZmlnIHwgSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQsXG5cdFx0QElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxJbnN0YW5jZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxJbnN0YW5jZVNlcnZpY2U6IElUZXJtaW5hbEluc3RhbmNlU2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGlmIChzaGVsbExhdW5jaENvbmZpZ09ySW5zdGFuY2UpIHtcblx0XHRcdHRoaXMuYWRkSW5zdGFuY2Uoc2hlbGxMYXVuY2hDb25maWdPckluc3RhbmNlKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5hdHRhY2hUb0VsZW1lbnQodGhpcy5fY29udGFpbmVyKTtcblx0XHR9XG5cdFx0dGhpcy5fb25QYW5lbE9yaWVudGF0aW9uQ2hhbmdlZC5maXJlKHRoaXMuX3Rlcm1pbmFsTG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCAmJiBpc0hvcml6b250YWwodGhpcy5fcGFuZWxQb3NpdGlvbikgPyBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIDogT3JpZW50YXRpb24uVkVSVElDQUwpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fY29udGFpbmVyICYmIHRoaXMuX2dyb3VwRWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLl9ncm91cEVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMuX2dyb3VwRWxlbWVudCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRhZGRJbnN0YW5jZShzaGVsbExhdW5jaENvbmZpZ09ySW5zdGFuY2U6IElTaGVsbExhdW5jaENvbmZpZyB8IElUZXJtaW5hbEluc3RhbmNlLCBwYXJlbnRUZXJtaW5hbElkPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0bGV0IGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZTtcblx0XHQvLyBpZiBhIHBhcmVudCB0ZXJtaW5hbCBpcyBwcm92aWRlZCwgZmluZCBpdFxuXHRcdC8vIG90aGVyd2lzZSwgcGFyZW50IGlzIHRoZSBhY3RpdmUgdGVybWluYWxcblx0XHRjb25zdCBwYXJlbnRJbmRleCA9IHBhcmVudFRlcm1pbmFsSWQgPyB0aGlzLl90ZXJtaW5hbEluc3RhbmNlcy5maW5kSW5kZXgodCA9PiB0Lmluc3RhbmNlSWQgPT09IHBhcmVudFRlcm1pbmFsSWQpIDogdGhpcy5fYWN0aXZlSW5zdGFuY2VJbmRleDtcblx0XHRpZiAoJ2luc3RhbmNlSWQnIGluIHNoZWxsTGF1bmNoQ29uZmlnT3JJbnN0YW5jZSkge1xuXHRcdFx0aW5zdGFuY2UgPSBzaGVsbExhdW5jaENvbmZpZ09ySW5zdGFuY2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGluc3RhbmNlID0gdGhpcy5fdGVybWluYWxJbnN0YW5jZVNlcnZpY2UuY3JlYXRlSW5zdGFuY2Uoc2hlbGxMYXVuY2hDb25maWdPckluc3RhbmNlLCBUZXJtaW5hbExvY2F0aW9uLlBhbmVsKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fdGVybWluYWxJbnN0YW5jZXMucHVzaChpbnN0YW5jZSk7XG5cdFx0XHR0aGlzLl9hY3RpdmVJbnN0YW5jZUluZGV4ID0gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fdGVybWluYWxJbnN0YW5jZXMuc3BsaWNlKHBhcmVudEluZGV4ICsgMSwgMCwgaW5zdGFuY2UpO1xuXHRcdH1cblx0XHR0aGlzLl9pbml0SW5zdGFuY2VMaXN0ZW5lcnMoaW5zdGFuY2UpO1xuXG5cdFx0aWYgKHRoaXMuX3NwbGl0UGFuZUNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fc3BsaXRQYW5lQ29udGFpbmVyLnNwbGl0KGluc3RhbmNlLCBwYXJlbnRJbmRleCArIDEpO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uSW5zdGFuY2VzQ2hhbmdlZC5maXJlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VzID0gW107XG5cdFx0dGhpcy5fb25JbnN0YW5jZXNDaGFuZ2VkLmZpcmUoKTtcblx0XHR0aGlzLl9zcGxpdFBhbmVDb250YWluZXI/LmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXQgYWN0aXZlSW5zdGFuY2UoKTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl90ZXJtaW5hbEluc3RhbmNlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90ZXJtaW5hbEluc3RhbmNlc1t0aGlzLl9hY3RpdmVJbnN0YW5jZUluZGV4XTtcblx0fVxuXG5cdGdldExheW91dEluZm8oaXNBY3RpdmU6IGJvb2xlYW4pOiBJVGVybWluYWxUYWJMYXlvdXRJbmZvQnlJZCB7XG5cdFx0Y29uc3QgaW5zdGFuY2VzID0gdGhpcy50ZXJtaW5hbEluc3RhbmNlcy5maWx0ZXIoaW5zdGFuY2UgPT4gdHlwZW9mIGluc3RhbmNlLnBlcnNpc3RlbnRQcm9jZXNzSWQgPT09ICdudW1iZXInICYmIGluc3RhbmNlLnNob3VsZFBlcnNpc3QpO1xuXHRcdGNvbnN0IHRvdGFsU2l6ZSA9IGluc3RhbmNlcy5tYXAodCA9PiB0aGlzLl9zcGxpdFBhbmVDb250YWluZXI/LmdldFBhbmVTaXplKHQpIHx8IDApLnJlZHVjZSgodG90YWwsIHNpemUpID0+IHRvdGFsICs9IHNpemUsIDApO1xuXHRcdHJldHVybiB7XG5cdFx0XHRpc0FjdGl2ZTogaXNBY3RpdmUsXG5cdFx0XHRhY3RpdmVQZXJzaXN0ZW50UHJvY2Vzc0lkOiB0aGlzLmFjdGl2ZUluc3RhbmNlID8gdGhpcy5hY3RpdmVJbnN0YW5jZS5wZXJzaXN0ZW50UHJvY2Vzc0lkIDogdW5kZWZpbmVkLFxuXHRcdFx0dGVybWluYWxzOiBpbnN0YW5jZXMubWFwKHQgPT4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHJlbGF0aXZlU2l6ZTogdG90YWxTaXplID4gMCA/IHRoaXMuX3NwbGl0UGFuZUNvbnRhaW5lciEuZ2V0UGFuZVNpemUodCkgLyB0b3RhbFNpemUgOiAwLFxuXHRcdFx0XHRcdHRlcm1pbmFsOiB0LnBlcnNpc3RlbnRQcm9jZXNzSWQgfHwgMFxuXHRcdFx0XHR9O1xuXHRcdFx0fSlcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfaW5pdEluc3RhbmNlTGlzdGVuZXJzKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdHRoaXMuX2luc3RhbmNlRGlzcG9zYWJsZXMuc2V0KGluc3RhbmNlLmluc3RhbmNlSWQsIFtcblx0XHRcdGluc3RhbmNlLm9uRGlzcG9zZWQoaW5zdGFuY2UgPT4ge1xuXHRcdFx0XHR0aGlzLl9vbkRpZERpc3Bvc2VJbnN0YW5jZS5maXJlKGluc3RhbmNlKTtcblx0XHRcdFx0dGhpcy5faGFuZGxlT25EaWREaXNwb3NlSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdFx0fSksXG5cdFx0XHRpbnN0YW5jZS5vbkRpZEZvY3VzKGluc3RhbmNlID0+IHtcblx0XHRcdFx0dGhpcy5fc2V0QWN0aXZlSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZEZvY3VzSW5zdGFuY2UuZmlyZShpbnN0YW5jZSk7XG5cdFx0XHR9KSxcblx0XHRcdGluc3RhbmNlLmNhcGFiaWxpdGllcy5vbkRpZEFkZENhcGFiaWxpdHlUeXBlKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlSW5zdGFuY2VDYXBhYmlsaXR5LmZpcmUoaW5zdGFuY2UpKSxcblx0XHRcdGluc3RhbmNlLmNhcGFiaWxpdGllcy5vbkRpZFJlbW92ZUNhcGFiaWxpdHlUeXBlKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlSW5zdGFuY2VDYXBhYmlsaXR5LmZpcmUoaW5zdGFuY2UpKSxcblx0XHRdKTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZU9uRGlkRGlzcG9zZUluc3RhbmNlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdHRoaXMuX3JlbW92ZUluc3RhbmNlKGluc3RhbmNlKTtcblx0fVxuXG5cdHJlbW92ZUluc3RhbmNlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdHRoaXMuX3JlbW92ZUluc3RhbmNlKGluc3RhbmNlKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbW92ZUluc3RhbmNlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fdGVybWluYWxJbnN0YW5jZXMuaW5kZXhPZihpbnN0YW5jZSk7XG5cdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdhc0FjdGl2ZUluc3RhbmNlID0gaW5zdGFuY2UgPT09IHRoaXMuYWN0aXZlSW5zdGFuY2U7XG5cdFx0dGhpcy5fdGVybWluYWxJbnN0YW5jZXMuc3BsaWNlKGluZGV4LCAxKTtcblxuXHRcdC8vIEFkanVzdCBmb2N1cyBpZiB0aGUgaW5zdGFuY2Ugd2FzIGFjdGl2ZVxuXHRcdGlmICh3YXNBY3RpdmVJbnN0YW5jZSAmJiB0aGlzLl90ZXJtaW5hbEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBuZXdJbmRleCA9IGluZGV4IDwgdGhpcy5fdGVybWluYWxJbnN0YW5jZXMubGVuZ3RoID8gaW5kZXggOiB0aGlzLl90ZXJtaW5hbEluc3RhbmNlcy5sZW5ndGggLSAxO1xuXHRcdFx0dGhpcy5zZXRBY3RpdmVJbnN0YW5jZUJ5SW5kZXgobmV3SW5kZXgpO1xuXHRcdFx0Ly8gVE9ETzogT25seSBmb2N1cyB0aGUgbmV3IGluc3RhbmNlIGlmIHRoZSBncm91cCBoYWQgZm9jdXM/XG5cdFx0XHR0aGlzLmFjdGl2ZUluc3RhbmNlPy5mb2N1cyh0cnVlKTtcblx0XHR9IGVsc2UgaWYgKGluZGV4IDwgdGhpcy5fYWN0aXZlSW5zdGFuY2VJbmRleCkge1xuXHRcdFx0Ly8gQWRqdXN0IGFjdGl2ZSBpbnN0YW5jZSBpbmRleCBpZiBuZWVkZWRcblx0XHRcdHRoaXMuX2FjdGl2ZUluc3RhbmNlSW5kZXgtLTtcblx0XHR9XG5cblx0XHR0aGlzLl9zcGxpdFBhbmVDb250YWluZXI/LnJlbW92ZShpbnN0YW5jZSk7XG5cblx0XHQvLyBGaXJlIGV2ZW50cyBhbmQgZGlzcG9zZSBncm91cCBpZiBpdCB3YXMgdGhlIGxhc3QgaW5zdGFuY2Vcblx0XHRpZiAodGhpcy5fdGVybWluYWxJbnN0YW5jZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLl9vbkRpc3Bvc2VkLmZpcmUodGhpcyk7XG5cdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fb25JbnN0YW5jZXNDaGFuZ2VkLmZpcmUoKTtcblx0XHR9XG5cblx0XHQvLyBEaXNwb3NlIGluc3RhbmNlIGV2ZW50IGxpc3RlbmVyc1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5faW5zdGFuY2VEaXNwb3NhYmxlcy5nZXQoaW5zdGFuY2UuaW5zdGFuY2VJZCk7XG5cdFx0aWYgKGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGVzKTtcblx0XHRcdHRoaXMuX2luc3RhbmNlRGlzcG9zYWJsZXMuZGVsZXRlKGluc3RhbmNlLmluc3RhbmNlSWQpO1xuXHRcdH1cblx0fVxuXG5cdG1vdmVJbnN0YW5jZShpbnN0YW5jZXM6IElUZXJtaW5hbEluc3RhbmNlIHwgSVRlcm1pbmFsSW5zdGFuY2VbXSwgaW5kZXg6IG51bWJlciwgcG9zaXRpb246ICdiZWZvcmUnIHwgJ2FmdGVyJyk6IHZvaWQge1xuXHRcdGluc3RhbmNlcyA9IGFzQXJyYXkoaW5zdGFuY2VzKTtcblx0XHRjb25zdCBoYXNJbnZhbGlkSW5zdGFuY2UgPSBpbnN0YW5jZXMuc29tZShpbnN0YW5jZSA9PiAhdGhpcy50ZXJtaW5hbEluc3RhbmNlcy5pbmNsdWRlcyhpbnN0YW5jZSkpO1xuXHRcdGlmIChoYXNJbnZhbGlkSW5zdGFuY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaW5zZXJ0SW5kZXggPSBwb3NpdGlvbiA9PT0gJ2JlZm9yZScgPyBpbmRleCA6IGluZGV4ICsgMTtcblx0XHR0aGlzLl90ZXJtaW5hbEluc3RhbmNlcy5zcGxpY2UoaW5zZXJ0SW5kZXgsIDAsIC4uLmluc3RhbmNlcyk7XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGluc3RhbmNlcykge1xuXHRcdFx0Y29uc3Qgb3JpZ2luU291cmNlR3JvdXBJbmRleCA9IHBvc2l0aW9uID09PSAnYWZ0ZXInID8gdGhpcy5fdGVybWluYWxJbnN0YW5jZXMuaW5kZXhPZihpdGVtKSA6IHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VzLmxhc3RJbmRleE9mKGl0ZW0pO1xuXHRcdFx0dGhpcy5fdGVybWluYWxJbnN0YW5jZXMuc3BsaWNlKG9yaWdpblNvdXJjZUdyb3VwSW5kZXgsIDEpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fc3BsaXRQYW5lQ29udGFpbmVyKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gaW5zdGFuY2VzW2ldO1xuXHRcdFx0XHR0aGlzLl9zcGxpdFBhbmVDb250YWluZXIucmVtb3ZlKGl0ZW0pO1xuXHRcdFx0XHR0aGlzLl9zcGxpdFBhbmVDb250YWluZXIuc3BsaXQoaXRlbSwgaW5kZXggKyAocG9zaXRpb24gPT09ICdiZWZvcmUnID8gaSA6IDApKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fb25JbnN0YW5jZXNDaGFuZ2VkLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldEFjdGl2ZUluc3RhbmNlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdHRoaXMuc2V0QWN0aXZlSW5zdGFuY2VCeUluZGV4KHRoaXMuX2dldEluZGV4RnJvbUlkKGluc3RhbmNlLmluc3RhbmNlSWQpKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEluZGV4RnJvbUlkKHRlcm1pbmFsSWQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0bGV0IHRlcm1pbmFsSW5kZXggPSAtMTtcblx0XHR0aGlzLnRlcm1pbmFsSW5zdGFuY2VzLmZvckVhY2goKHRlcm1pbmFsSW5zdGFuY2UsIGkpID0+IHtcblx0XHRcdGlmICh0ZXJtaW5hbEluc3RhbmNlLmluc3RhbmNlSWQgPT09IHRlcm1pbmFsSWQpIHtcblx0XHRcdFx0dGVybWluYWxJbmRleCA9IGk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aWYgKHRlcm1pbmFsSW5kZXggPT09IC0xKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRlcm1pbmFsIHdpdGggSUQgJHt0ZXJtaW5hbElkfSBkb2VzIG5vdCBleGlzdCAoaGFzIGl0IGFscmVhZHkgYmVlbiBkaXNwb3NlZD8pYCk7XG5cdFx0fVxuXHRcdHJldHVybiB0ZXJtaW5hbEluZGV4O1xuXHR9XG5cblx0c2V0QWN0aXZlSW5zdGFuY2VCeUluZGV4KGluZGV4OiBudW1iZXIsIGZvcmNlPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdC8vIENoZWNrIGZvciBpbnZhbGlkIHZhbHVlXG5cdFx0aWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLl90ZXJtaW5hbEluc3RhbmNlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvbGRBY3RpdmVJbnN0YW5jZSA9IHRoaXMuYWN0aXZlSW5zdGFuY2U7XG5cdFx0dGhpcy5fYWN0aXZlSW5zdGFuY2VJbmRleCA9IGluZGV4O1xuXHRcdGlmIChvbGRBY3RpdmVJbnN0YW5jZSAhPT0gdGhpcy5hY3RpdmVJbnN0YW5jZSB8fCBmb3JjZSkge1xuXHRcdFx0dGhpcy5fb25JbnN0YW5jZXNDaGFuZ2VkLmZpcmUoKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UuZmlyZSh0aGlzLmFjdGl2ZUluc3RhbmNlKTtcblx0XHR9XG5cdH1cblxuXHRhdHRhY2hUb0VsZW1lbnQoZWxlbWVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250YWluZXIgPSBlbGVtZW50O1xuXG5cdFx0Ly8gSWYgd2UgYWxyZWFkeSBoYXZlIGEgZ3JvdXAgZWxlbWVudCwgd2UgY2FuIHJlcGFyZW50IGl0XG5cdFx0aWYgKCF0aGlzLl9ncm91cEVsZW1lbnQpIHtcblx0XHRcdHRoaXMuX2dyb3VwRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0dGhpcy5fZ3JvdXBFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3Rlcm1pbmFsLWdyb3VwJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2dyb3VwRWxlbWVudCk7XG5cdFx0aWYgKCF0aGlzLl9zcGxpdFBhbmVDb250YWluZXIpIHtcblx0XHRcdHRoaXMuX3BhbmVsUG9zaXRpb24gPSB0aGlzLl9sYXlvdXRTZXJ2aWNlLmdldFBhbmVsUG9zaXRpb24oKTtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsTG9jYXRpb24gPSB0aGlzLl92aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0xvY2F0aW9uQnlJZChURVJNSU5BTF9WSUVXX0lEKSE7XG5cdFx0XHRjb25zdCBvcmllbnRhdGlvbiA9IHRoaXMuX3Rlcm1pbmFsTG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCAmJiBpc0hvcml6b250YWwodGhpcy5fcGFuZWxQb3NpdGlvbikgPyBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIDogT3JpZW50YXRpb24uVkVSVElDQUw7XG5cdFx0XHR0aGlzLl9zcGxpdFBhbmVDb250YWluZXIgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTcGxpdFBhbmVDb250YWluZXIsIHRoaXMuX2dyb3VwRWxlbWVudCwgb3JpZW50YXRpb24pO1xuXHRcdFx0dGhpcy50ZXJtaW5hbEluc3RhbmNlcy5mb3JFYWNoKGluc3RhbmNlID0+IHRoaXMuX3NwbGl0UGFuZUNvbnRhaW5lciEuc3BsaXQoaW5zdGFuY2UsIHRoaXMuX2FjdGl2ZUluc3RhbmNlSW5kZXggKyAxKSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHRpdGxlKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gTm9ybWFsbHkgY29uc3VtZXJzIHNob3VsZCBub3QgY2FsbCBpbnRvIHRpdGxlIGF0IGFsbCBhZnRlciB0aGUgZ3JvdXAgaXMgZGlzcG9zZWQgYnV0XG5cdFx0XHQvLyB0aGlzIGlzIHJlcXVpcmVkIHdoZW4gdGhlIGdyb3VwIGlzIHVzZWQgYXMgcGFydCBvZiBhIHRyZWUuXG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdGxldCB0aXRsZSA9IHRoaXMudGVybWluYWxJbnN0YW5jZXNbMF0udGl0bGUgKyB0aGlzLl9nZXRCZWxsVGl0bGUodGhpcy50ZXJtaW5hbEluc3RhbmNlc1swXSk7XG5cdFx0aWYgKHRoaXMudGVybWluYWxJbnN0YW5jZXNbMF0uZGVzY3JpcHRpb24pIHtcblx0XHRcdHRpdGxlICs9IGAgKCR7dGhpcy50ZXJtaW5hbEluc3RhbmNlc1swXS5kZXNjcmlwdGlvbn0pYDtcblx0XHR9XG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCB0aGlzLnRlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMudGVybWluYWxJbnN0YW5jZXNbaV07XG5cdFx0XHRpZiAoaW5zdGFuY2UudGl0bGUpIHtcblx0XHRcdFx0dGl0bGUgKz0gYCwgJHtpbnN0YW5jZS50aXRsZSArIHRoaXMuX2dldEJlbGxUaXRsZShpbnN0YW5jZSl9YDtcblx0XHRcdFx0aWYgKGluc3RhbmNlLmRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0dGl0bGUgKz0gYCAoJHtpbnN0YW5jZS5kZXNjcmlwdGlvbn0pYDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGl0bGU7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRCZWxsVGl0bGUoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKSB7XG5cdFx0aWYgKHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLmVuYWJsZUJlbGwgJiYgaW5zdGFuY2Uuc3RhdHVzTGlzdC5zdGF0dXNlcy5zb21lKGUgPT4gZS5pZCA9PT0gVGVybWluYWxTdGF0dXMuQmVsbCkpIHtcblx0XHRcdHJldHVybiAnKic7XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3Zpc2libGUgPSB2aXNpYmxlO1xuXHRcdGlmICh0aGlzLl9ncm91cEVsZW1lbnQpIHtcblx0XHRcdHRoaXMuX2dyb3VwRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gdmlzaWJsZSA/ICcnIDogJ25vbmUnO1xuXHRcdH1cblx0XHR0aGlzLnRlcm1pbmFsSW5zdGFuY2VzLmZvckVhY2goaSA9PiBpLnNldFZpc2libGUodmlzaWJsZSkpO1xuXHR9XG5cblx0c3BsaXQoc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyk6IElUZXJtaW5hbEluc3RhbmNlIHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKHNoZWxsTGF1bmNoQ29uZmlnLCBUZXJtaW5hbExvY2F0aW9uLlBhbmVsKTtcblx0XHR0aGlzLmFkZEluc3RhbmNlKGluc3RhbmNlLCBzaGVsbExhdW5jaENvbmZpZy5wYXJlbnRUZXJtaW5hbElkKTtcblx0XHR0aGlzLl9zZXRBY3RpdmVJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0cmV0dXJuIGluc3RhbmNlO1xuXHR9XG5cblx0YWRkRGlzcG9zYWJsZShkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRpc3Bvc2FibGUpO1xuXHR9XG5cblx0bGF5b3V0KHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3NwbGl0UGFuZUNvbnRhaW5lcikge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIHBhbmVsIHBvc2l0aW9uIGNoYW5nZWQgYW5kIHJvdGF0ZSBwYW5lcyBpZiBzb1xuXHRcdFx0Y29uc3QgbmV3UGFuZWxQb3NpdGlvbiA9IHRoaXMuX2xheW91dFNlcnZpY2UuZ2V0UGFuZWxQb3NpdGlvbigpO1xuXHRcdFx0Y29uc3QgbmV3VGVybWluYWxMb2NhdGlvbiA9IHRoaXMuX3ZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3TG9jYXRpb25CeUlkKFRFUk1JTkFMX1ZJRVdfSUQpITtcblx0XHRcdGNvbnN0IHRlcm1pbmFsUG9zaXRpb25DaGFuZ2VkID0gbmV3UGFuZWxQb3NpdGlvbiAhPT0gdGhpcy5fcGFuZWxQb3NpdGlvbiB8fCBuZXdUZXJtaW5hbExvY2F0aW9uICE9PSB0aGlzLl90ZXJtaW5hbExvY2F0aW9uO1xuXHRcdFx0aWYgKHRlcm1pbmFsUG9zaXRpb25DaGFuZ2VkKSB7XG5cdFx0XHRcdGNvbnN0IG5ld09yaWVudGF0aW9uID0gbmV3VGVybWluYWxMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsICYmIGlzSG9yaXpvbnRhbChuZXdQYW5lbFBvc2l0aW9uKSA/IE9yaWVudGF0aW9uLkhPUklaT05UQUwgOiBPcmllbnRhdGlvbi5WRVJUSUNBTDtcblx0XHRcdFx0dGhpcy5fc3BsaXRQYW5lQ29udGFpbmVyLnNldE9yaWVudGF0aW9uKG5ld09yaWVudGF0aW9uKTtcblx0XHRcdFx0dGhpcy5fcGFuZWxQb3NpdGlvbiA9IG5ld1BhbmVsUG9zaXRpb247XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsTG9jYXRpb24gPSBuZXdUZXJtaW5hbExvY2F0aW9uO1xuXHRcdFx0XHR0aGlzLl9vblBhbmVsT3JpZW50YXRpb25DaGFuZ2VkLmZpcmUodGhpcy5fc3BsaXRQYW5lQ29udGFpbmVyLm9yaWVudGF0aW9uKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3NwbGl0UGFuZUNvbnRhaW5lci5sYXlvdXQod2lkdGgsIGhlaWdodCk7XG5cdFx0XHRpZiAodGhpcy5faW5pdGlhbFJlbGF0aXZlU2l6ZXMgJiYgdGhpcy5fdmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLnJlc2l6ZVBhbmVzKHRoaXMuX2luaXRpYWxSZWxhdGl2ZVNpemVzKTtcblx0XHRcdFx0dGhpcy5faW5pdGlhbFJlbGF0aXZlU2l6ZXMgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Zm9jdXNQcmV2aW91c1BhbmUoKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3SW5kZXggPSB0aGlzLl9hY3RpdmVJbnN0YW5jZUluZGV4ID09PSAwID8gdGhpcy5fdGVybWluYWxJbnN0YW5jZXMubGVuZ3RoIC0gMSA6IHRoaXMuX2FjdGl2ZUluc3RhbmNlSW5kZXggLSAxO1xuXHRcdHRoaXMuc2V0QWN0aXZlSW5zdGFuY2VCeUluZGV4KG5ld0luZGV4KTtcblx0fVxuXG5cdGZvY3VzTmV4dFBhbmUoKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3SW5kZXggPSB0aGlzLl9hY3RpdmVJbnN0YW5jZUluZGV4ID09PSB0aGlzLl90ZXJtaW5hbEluc3RhbmNlcy5sZW5ndGggLSAxID8gMCA6IHRoaXMuX2FjdGl2ZUluc3RhbmNlSW5kZXggKyAxO1xuXHRcdHRoaXMuc2V0QWN0aXZlSW5zdGFuY2VCeUluZGV4KG5ld0luZGV4KTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFBvc2l0aW9uKCk6IFBvc2l0aW9uIHtcblx0XHRzd2l0Y2ggKHRoaXMuX3Rlcm1pbmFsTG9jYXRpb24pIHtcblx0XHRcdGNhc2UgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcGFuZWxQb3NpdGlvbjtcblx0XHRcdGNhc2UgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXI6XG5cdFx0XHRcdHJldHVybiB0aGlzLl9sYXlvdXRTZXJ2aWNlLmdldFNpZGVCYXJQb3NpdGlvbigpO1xuXHRcdFx0Y2FzZSBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0U2VydmljZS5nZXRTaWRlQmFyUG9zaXRpb24oKSA9PT0gUG9zaXRpb24uTEVGVCA/IFBvc2l0aW9uLlJJR0hUIDogUG9zaXRpb24uTEVGVDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRPcmllbnRhdGlvbigpOiBPcmllbnRhdGlvbiB7XG5cdFx0cmV0dXJuIGlzSG9yaXpvbnRhbCh0aGlzLl9nZXRQb3NpdGlvbigpKSA/IE9yaWVudGF0aW9uLkhPUklaT05UQUwgOiBPcmllbnRhdGlvbi5WRVJUSUNBTDtcblx0fVxuXG5cdHJlc2l6ZVBhbmUoZGlyZWN0aW9uOiBEaXJlY3Rpb24pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3NwbGl0UGFuZUNvbnRhaW5lcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzSG9yaXpvbnRhbFJlc2l6ZSA9IChkaXJlY3Rpb24gPT09IERpcmVjdGlvbi5MZWZ0IHx8IGRpcmVjdGlvbiA9PT0gRGlyZWN0aW9uLlJpZ2h0KTtcblxuXHRcdGNvbnN0IGdyb3VwT3JpZW50YXRpb24gPSB0aGlzLl9nZXRPcmllbnRhdGlvbigpO1xuXG5cdFx0Y29uc3Qgc2hvdWxkUmVzaXplUGFydCA9XG5cdFx0XHQoaXNIb3Jpem9udGFsUmVzaXplICYmIGdyb3VwT3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMKSB8fFxuXHRcdFx0KCFpc0hvcml6b250YWxSZXNpemUgJiYgZ3JvdXBPcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uSE9SSVpPTlRBTCk7XG5cblx0XHRjb25zdCBmb250ID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5nZXRGb250KGdldFdpbmRvdyh0aGlzLl9ncm91cEVsZW1lbnQpKTtcblx0XHQvLyBUT0RPOiBTdXBwb3J0IGxldHRlciBzcGFjaW5nIGFuZCBsaW5lIGhlaWdodFxuXHRcdGNvbnN0IGNoYXJTaXplID0gKGlzSG9yaXpvbnRhbFJlc2l6ZSA/IGZvbnQuY2hhcldpZHRoIDogZm9udC5jaGFySGVpZ2h0KTtcblxuXHRcdGlmIChjaGFyU2l6ZSkge1xuXHRcdFx0bGV0IHJlc2l6ZUFtb3VudCA9IGNoYXJTaXplICogQ29uc3RhbnRzLlJlc2l6ZVBhcnRDZWxsQ291bnQ7XG5cblx0XHRcdGlmIChzaG91bGRSZXNpemVQYXJ0KSB7XG5cblx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLl9nZXRQb3NpdGlvbigpO1xuXHRcdFx0XHRjb25zdCBzaG91bGRTaHJpbmsgPVxuXHRcdFx0XHRcdChwb3NpdGlvbiA9PT0gUG9zaXRpb24uTEVGVCAmJiBkaXJlY3Rpb24gPT09IERpcmVjdGlvbi5MZWZ0KSB8fFxuXHRcdFx0XHRcdChwb3NpdGlvbiA9PT0gUG9zaXRpb24uUklHSFQgJiYgZGlyZWN0aW9uID09PSBEaXJlY3Rpb24uUmlnaHQpIHx8XG5cdFx0XHRcdFx0KHBvc2l0aW9uID09PSBQb3NpdGlvbi5CT1RUT00gJiYgZGlyZWN0aW9uID09PSBEaXJlY3Rpb24uRG93bikgfHxcblx0XHRcdFx0XHQocG9zaXRpb24gPT09IFBvc2l0aW9uLlRPUCAmJiBkaXJlY3Rpb24gPT09IERpcmVjdGlvbi5VcCk7XG5cblx0XHRcdFx0aWYgKHNob3VsZFNocmluaykge1xuXHRcdFx0XHRcdHJlc2l6ZUFtb3VudCAqPSAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2xheW91dFNlcnZpY2UucmVzaXplUGFydChnZXRQYXJ0QnlMb2NhdGlvbih0aGlzLl90ZXJtaW5hbExvY2F0aW9uKSwgcmVzaXplQW1vdW50LCByZXNpemVBbW91bnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fc3BsaXRQYW5lQ29udGFpbmVyLnJlc2l6ZVBhbmUodGhpcy5fYWN0aXZlSW5zdGFuY2VJbmRleCwgZGlyZWN0aW9uLCByZXNpemVBbW91bnQpO1xuXHRcdFx0fVxuXG5cdFx0fVxuXHR9XG5cblx0cmVzaXplUGFuZXMocmVsYXRpdmVTaXplczogbnVtYmVyW10pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3NwbGl0UGFuZUNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5faW5pdGlhbFJlbGF0aXZlU2l6ZXMgPSByZWxhdGl2ZVNpemVzO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3NwbGl0UGFuZUNvbnRhaW5lci5yZXNpemVQYW5lcyhyZWxhdGl2ZVNpemVzKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLE9BQU8sZUFBZTtBQUMvQixTQUFzQixZQUFZLGlCQUFpQixTQUFTLG9CQUFvQjtBQUNoRixTQUFTLFdBQVcsYUFBb0IsY0FBYztBQUN0RCxTQUFTLGNBQWMseUJBQXlCLGdCQUFnQjtBQUNoRSxTQUFTLDZCQUE2QjtBQUN0QyxTQUE0QixXQUEyQiwwQkFBMEIscUNBQXFDO0FBQ3RILFNBQVMsdUJBQXVCLDhCQUE4QjtBQUM5RCxTQUF5RCx3QkFBd0I7QUFDakYsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBRXhCLElBQVcsWUFBWCxrQkFBV0EsZUFBWDtBQUlDLEVBQUFBLHNCQUFBLHNCQUFtQixNQUFuQjtBQUtBLEVBQUFBLHNCQUFBLHlCQUFzQixLQUF0QjtBQVRVLFNBQUFBO0FBQUEsR0FBQTtBQVlYLE1BQU0sMkJBQTJCLFdBQVc7QUFBQSxFQVczQyxZQUNTLFlBQ0QsYUFDTjtBQUNELFVBQU07QUFIRTtBQUNEO0FBVFIsU0FBaUIsd0JBQXdCLEtBQUssVUFBVSxJQUFJLGdCQUFnQixDQUFDO0FBQzdFLFNBQVEsWUFBeUIsQ0FB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LEtBQUssdUJBQXVCO0FBQ3BILFNBQUsseUJBQXlCLFFBQVE7QUFBQSxFQUN2QztBQUFBLEVBRVEsZUFBeUI7QUFDaEMsWUFBUSxLQUFLLG1CQUFtQjtBQUFBLE1BQy9CLEtBQUssc0JBQXNCO0FBQzFCLGVBQU8sS0FBSztBQUFBLE1BQ2IsS0FBSyxzQkFBc0I7QUFDMUIsZUFBTyxLQUFLLGVBQWUsbUJBQW1CO0FBQUEsTUFDL0MsS0FBSyxzQkFBc0I7QUFDMUIsZUFBTyxLQUFLLGVBQWUsbUJBQW1CLE1BQU0sU0FBUyxPQUFPLFNBQVMsUUFBUSxTQUFTO0FBQUEsSUFDaEc7QUFBQSxFQUNEO0FBQUEsRUFFUSxrQkFBK0I7QUFDdEMsV0FBTyxhQUFhLEtBQUssYUFBYSxDQUFDLElBQUksWUFBWSxhQUFhLFlBQVk7QUFBQSxFQUNqRjtBQUFBLEVBRUEsV0FBVyxXQUE0QjtBQUN0QyxRQUFJLENBQUMsS0FBSyxxQkFBcUI7QUFDOUI7QUFBQSxJQUNEO0FBRUEsVUFBTSxxQkFBc0IsY0FBYyxVQUFVLFFBQVEsY0FBYyxVQUFVO0FBRXBGLFVBQU0sbUJBQW1CLEtBQUssZ0JBQWdCO0FBRTlDLFVBQU0sbUJBQ0osc0JBQXNCLHFCQUFxQixZQUFZLFlBQ3ZELENBQUMsc0JBQXNCLHFCQUFxQixZQUFZO0FBRTFELFVBQU0sT0FBTyxLQUFLLDhCQUE4QixRQUFRLFVBQVUsS0FBSyxhQUFhLENBQUM7QUFFckYsVUFBTSxXQUFZLHFCQUFxQixLQUFLLFlBQVksS0FBSztBQUU3RCxRQUFJLFVBQVU7QUFDYixVQUFJLGVBQWUsV0FBVztBQUU5QixVQUFJLGtCQUFrQjtBQUVyQixjQUFNLFdBQVcsS0FBSyxhQUFhO0FBQ25DLGNBQU0sZUFDSixhQUFhLFNBQVMsUUFBUSxjQUFjLFVBQVUsUUFDdEQsYUFBYSxTQUFTLFNBQVMsY0FBYyxVQUFVLFNBQ3ZELGFBQWEsU0FBUyxVQUFVLGNBQWMsVUFBVSxRQUN4RCxhQUFhLFNBQVMsT0FBTyxjQUFjLFVBQVU7QUFFdkQsWUFBSSxjQUFjO0FBQ2pCLDBCQUFnQjtBQUFBLFFBQ2pCO0FBRUEsYUFBSyxlQUFlLFdBQVcsa0JBQWtCLEtBQUssaUJBQWlCLEdBQUcsY0FBYyxZQUFZO0FBQUEsTUFDckcsT0FBTztBQUNOLGFBQUssb0JBQW9CLFdBQVcsS0FBSyxzQkFBc0IsV0FBVyxZQUFZO0FBQUEsTUFDdkY7QUFBQSxJQUVEO0FBQUEsRUFDRDtBQUFBLEVBRUEsWUFBWSxlQUErQjtBQUMxQyxRQUFJLENBQUMsS0FBSyxxQkFBcUI7QUFDOUIsV0FBSyx3QkFBd0I7QUFDN0I7QUFBQSxJQUNEO0FBRUEsU0FBSyxvQkFBb0IsWUFBWSxhQUFhO0FBQUEsRUFDbkQ7QUFDRDtBQWpZYSxnQkFBTjtBQUFBLEVBaUNKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBckNVOyIsCiAgIm5hbWVzIjogWyJDb25zdGFudHMiLCAiaW5zdGFuY2UiXQp9Cg==
