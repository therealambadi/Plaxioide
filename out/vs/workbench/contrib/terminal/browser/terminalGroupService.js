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
import { timeout } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { TerminalGroup } from "./terminalGroup.js";
import { getInstanceFromResource } from "./terminalUri.js";
import { TERMINAL_VIEW_ID } from "../common/terminal.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { asArray } from "../../../../base/common/arrays.js";
let TerminalGroupService = class extends Disposable {
  constructor(_contextKeyService, _instantiationService, _viewsService, _viewDescriptorService, _quickInputService) {
    super();
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._viewsService = _viewsService;
    this._viewDescriptorService = _viewDescriptorService;
    this._quickInputService = _quickInputService;
    this.groups = [];
    this.activeGroupIndex = -1;
    this.lastAccessedMenu = "inline-tab";
    this._isQuickInputOpened = false;
    this._onDidChangeActiveGroup = this._register(new Emitter());
    this.onDidChangeActiveGroup = this._onDidChangeActiveGroup.event;
    this._onDidDisposeGroup = this._register(new Emitter());
    this.onDidDisposeGroup = this._onDidDisposeGroup.event;
    this._onDidChangeGroups = this._register(new Emitter());
    this.onDidChangeGroups = this._onDidChangeGroups.event;
    this._onDidShow = this._register(new Emitter());
    this.onDidShow = this._onDidShow.event;
    this._onDidDisposeInstance = this._register(new Emitter());
    this.onDidDisposeInstance = this._onDidDisposeInstance.event;
    this._onDidFocusInstance = this._register(new Emitter());
    this.onDidFocusInstance = this._onDidFocusInstance.event;
    this._onDidChangeActiveInstance = this._register(new Emitter());
    this.onDidChangeActiveInstance = this._onDidChangeActiveInstance.event;
    this._onDidChangeInstances = this._register(new Emitter());
    this.onDidChangeInstances = this._onDidChangeInstances.event;
    this._onDidChangeInstanceCapability = this._register(new Emitter());
    this.onDidChangeInstanceCapability = this._onDidChangeInstanceCapability.event;
    this._onDidChangePanelOrientation = this._register(new Emitter());
    this.onDidChangePanelOrientation = this._onDidChangePanelOrientation.event;
    this._getValidTerminalGroups = (sources) => {
      return new Set(
        sources.map((source) => this.getGroupForInstance(source)).filter((group) => group !== void 0)
      );
    };
    this._terminalGroupCountContextKey = TerminalContextKeys.groupCount.bindTo(this._contextKeyService);
    this._register(this.onDidDisposeGroup((group) => this._removeGroup(group)));
    this._register(this.onDidChangeGroups(() => this._terminalGroupCountContextKey.set(this.groups.length)));
    this._register(Event.any(this.onDidChangeActiveGroup, this.onDidChangeInstances)(() => this.updateVisibility()));
    this._register(this._quickInputService.onShow(() => this._isQuickInputOpened = true));
    this._register(this._quickInputService.onHide(() => this._isQuickInputOpened = false));
  }
  get instances() {
    return this.groups.reduce((p, c) => p.concat(c.terminalInstances), []);
  }
  hidePanel() {
    const panel = this._viewDescriptorService.getViewContainerByViewId(TERMINAL_VIEW_ID);
    if (panel && this._viewDescriptorService.getViewContainerModel(panel).visibleViewDescriptors.length === 1) {
      this._viewsService.closeView(TERMINAL_VIEW_ID);
      TerminalContextKeys.tabsMouse.bindTo(this._contextKeyService).set(false);
    }
  }
  get activeGroup() {
    if (this.activeGroupIndex < 0 || this.activeGroupIndex >= this.groups.length) {
      return void 0;
    }
    return this.groups[this.activeGroupIndex];
  }
  set activeGroup(value) {
    if (value === void 0) {
      return;
    }
    const index = this.groups.findIndex((e) => e === value);
    this.setActiveGroupByIndex(index);
  }
  get activeInstance() {
    return this.activeGroup?.activeInstance;
  }
  setActiveInstance(instance) {
    this.setActiveInstanceByIndex(this._getIndexFromId(instance.instanceId));
  }
  _getIndexFromId(terminalId) {
    const terminalIndex = this.instances.findIndex((e) => e.instanceId === terminalId);
    if (terminalIndex === -1) {
      throw new Error(`Terminal with ID ${terminalId} does not exist (has it already been disposed?)`);
    }
    return terminalIndex;
  }
  setContainer(container) {
    this._container = container;
    this.groups.forEach((group) => group.attachToElement(container));
  }
  async focusTabs() {
    if (this.instances.length === 0) {
      return;
    }
    await this.showPanel(true);
    const pane = this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
    pane?.terminalTabbedView?.focusTabs();
  }
  async focusHover() {
    if (this.instances.length === 0) {
      return;
    }
    const pane = this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
    pane?.terminalTabbedView?.focusHover();
  }
  async focusInstance(_) {
    return this.showPanel(true);
  }
  async focusActiveInstance() {
    return this.showPanel(true);
  }
  createGroup(slcOrInstance) {
    const group = this._instantiationService.createInstance(TerminalGroup, this._container, slcOrInstance);
    this.groups.push(group);
    group.addDisposable(Event.forward(group.onPanelOrientationChanged, this._onDidChangePanelOrientation));
    group.addDisposable(Event.forward(group.onDidDisposeInstance, this._onDidDisposeInstance));
    group.addDisposable(Event.forward(group.onDidFocusInstance, this._onDidFocusInstance));
    group.addDisposable(Event.forward(group.onDidChangeInstanceCapability, this._onDidChangeInstanceCapability));
    group.addDisposable(Event.forward(group.onInstancesChanged, this._onDidChangeInstances));
    group.addDisposable(Event.forward(group.onDisposed, this._onDidDisposeGroup));
    group.addDisposable(group.onDidChangeActiveInstance((e) => {
      if (group === this.activeGroup) {
        this._onDidChangeActiveInstance.fire(e);
      }
    }));
    if (group.terminalInstances.length > 0) {
      this._onDidChangeInstances.fire();
    }
    if (this.instances.length === 1) {
      this.setActiveInstanceByIndex(0);
    }
    this._onDidChangeGroups.fire();
    return group;
  }
  async showPanel(focus) {
    const pane = this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID) ?? await this._viewsService.openView(TERMINAL_VIEW_ID, focus);
    pane?.setExpanded(true);
    if (focus) {
      await timeout(0);
      const instance = this.activeInstance;
      if (instance) {
        if (pane && !pane.isVisible()) {
          await this._viewsService.openView(TERMINAL_VIEW_ID, focus);
        }
        await instance.focusWhenReady(true);
      }
    }
    this._onDidShow.fire();
  }
  getInstanceFromResource(resource) {
    return getInstanceFromResource(this.instances, resource);
  }
  _removeGroup(group) {
    const activeGroup = this.activeGroup;
    const wasActiveGroup = group === activeGroup;
    const index = this.groups.indexOf(group);
    if (index !== -1) {
      this.groups.splice(index, 1);
      this._onDidChangeGroups.fire();
    }
    if (wasActiveGroup) {
      if (this.groups.length > 0 && !this._isQuickInputOpened) {
        const newIndex = index < this.groups.length ? index : this.groups.length - 1;
        this.setActiveGroupByIndex(newIndex, true);
        this.activeInstance?.focus(true);
      }
    } else {
      if (this.activeGroupIndex > index) {
        this.setActiveGroupByIndex(this.activeGroupIndex - 1);
      }
    }
    if (this.activeGroupIndex >= this.groups.length) {
      this.setActiveGroupByIndex(this.groups.length - 1);
    }
    this._onDidChangeInstances.fire();
    this._onDidChangeGroups.fire();
    if (wasActiveGroup) {
      this._onDidChangeActiveGroup.fire(this.activeGroup);
      this._onDidChangeActiveInstance.fire(this.activeInstance);
    }
  }
  /**
   * @param force Whether to force the group change, this should be used when the previous active
   * group has been removed.
   */
  setActiveGroupByIndex(index, force) {
    if (index === -1 && this.groups.length === 0) {
      if (this.activeGroupIndex !== -1) {
        this.activeGroupIndex = -1;
        this._onDidChangeActiveGroup.fire(this.activeGroup);
        this._onDidChangeActiveInstance.fire(this.activeInstance);
      }
      return;
    }
    if (index < 0 || index >= this.groups.length) {
      return;
    }
    const oldActiveGroup = this.activeGroup;
    this.activeGroupIndex = index;
    if (force || oldActiveGroup !== this.activeGroup) {
      this._onDidChangeActiveGroup.fire(this.activeGroup);
      this._onDidChangeActiveInstance.fire(this.activeInstance);
    }
  }
  _getInstanceLocation(index) {
    let currentGroupIndex = 0;
    while (index >= 0 && currentGroupIndex < this.groups.length) {
      const group = this.groups[currentGroupIndex];
      const count = group.terminalInstances.length;
      if (index < count) {
        return {
          group,
          groupIndex: currentGroupIndex,
          instance: group.terminalInstances[index],
          instanceIndex: index
        };
      }
      index -= count;
      currentGroupIndex++;
    }
    return void 0;
  }
  setActiveInstanceByIndex(index) {
    const activeInstance = this.activeInstance;
    const instanceLocation = this._getInstanceLocation(index);
    const newActiveInstance = instanceLocation?.group.terminalInstances[instanceLocation.instanceIndex];
    if (!instanceLocation || activeInstance === newActiveInstance) {
      return;
    }
    const activeInstanceIndex = instanceLocation.instanceIndex;
    this.activeGroupIndex = instanceLocation.groupIndex;
    this._onDidChangeActiveGroup.fire(this.activeGroup);
    instanceLocation.group.setActiveInstanceByIndex(activeInstanceIndex, true);
  }
  setActiveGroupToNext() {
    if (this.groups.length <= 1) {
      return;
    }
    let newIndex = this.activeGroupIndex + 1;
    if (newIndex >= this.groups.length) {
      newIndex = 0;
    }
    this.setActiveGroupByIndex(newIndex);
  }
  setActiveGroupToPrevious() {
    if (this.groups.length <= 1) {
      return;
    }
    let newIndex = this.activeGroupIndex - 1;
    if (newIndex < 0) {
      newIndex = this.groups.length - 1;
    }
    this.setActiveGroupByIndex(newIndex);
  }
  moveGroup(source, target) {
    source = asArray(source);
    const sourceGroups = this._getValidTerminalGroups(source);
    const targetGroup = this.getGroupForInstance(target);
    if (!targetGroup || sourceGroups.size === 0) {
      return;
    }
    if (sourceGroups.size === 1 && sourceGroups.has(targetGroup)) {
      const targetIndex = targetGroup.terminalInstances.indexOf(target);
      const sortedSources = source.sort((a, b) => {
        return targetGroup.terminalInstances.indexOf(a) - targetGroup.terminalInstances.indexOf(b);
      });
      const firstTargetIndex = targetGroup.terminalInstances.indexOf(sortedSources[0]);
      const position2 = firstTargetIndex < targetIndex ? "after" : "before";
      targetGroup.moveInstance(sortedSources, targetIndex, position2);
      this._onDidChangeInstances.fire();
      return;
    }
    const targetGroupIndex = this.groups.indexOf(targetGroup);
    const sortedSourceGroups = Array.from(sourceGroups).sort((a, b) => {
      return this.groups.indexOf(a) - this.groups.indexOf(b);
    });
    const firstSourceGroupIndex = this.groups.indexOf(sortedSourceGroups[0]);
    const position = firstSourceGroupIndex < targetGroupIndex ? "after" : "before";
    const insertIndex = position === "after" ? targetGroupIndex + 1 : targetGroupIndex;
    this.groups.splice(insertIndex, 0, ...sortedSourceGroups);
    for (const sourceGroup of sortedSourceGroups) {
      const originSourceGroupIndex = position === "after" ? this.groups.indexOf(sourceGroup) : this.groups.lastIndexOf(sourceGroup);
      this.groups.splice(originSourceGroupIndex, 1);
    }
    this._onDidChangeInstances.fire();
  }
  moveGroupToEnd(source) {
    source = asArray(source);
    const sourceGroups = this._getValidTerminalGroups(source);
    if (sourceGroups.size === 0) {
      return;
    }
    const lastInstanceIndex = this.groups.length - 1;
    const sortedSourceGroups = Array.from(sourceGroups).sort((a, b) => {
      return this.groups.indexOf(a) - this.groups.indexOf(b);
    });
    this.groups.splice(lastInstanceIndex + 1, 0, ...sortedSourceGroups);
    for (const sourceGroup of sortedSourceGroups) {
      const sourceGroupIndex = this.groups.indexOf(sourceGroup);
      this.groups.splice(sourceGroupIndex, 1);
    }
    this._onDidChangeInstances.fire();
  }
  moveInstance(source, target, side) {
    const sourceGroup = this.getGroupForInstance(source);
    const targetGroup = this.getGroupForInstance(target);
    if (!sourceGroup || !targetGroup) {
      return;
    }
    if (sourceGroup !== targetGroup) {
      sourceGroup.removeInstance(source);
      targetGroup.addInstance(source);
    }
    const index = targetGroup.terminalInstances.indexOf(target) + (side === "after" ? 1 : 0);
    targetGroup.moveInstance(source, index, side);
  }
  unsplitInstance(instance) {
    const oldGroup = this.getGroupForInstance(instance);
    if (!oldGroup || oldGroup.terminalInstances.length < 2) {
      return;
    }
    oldGroup.removeInstance(instance);
    this.createGroup(instance);
  }
  joinInstances(instances) {
    const group = this.getGroupForInstance(instances[0]);
    if (group) {
      let differentGroups = true;
      for (let i = 1; i < group.terminalInstances.length; i++) {
        if (group.terminalInstances.includes(instances[i])) {
          differentGroups = false;
          break;
        }
      }
      if (!differentGroups && group.terminalInstances.length === instances.length) {
        return;
      }
    }
    let candidateInstance = void 0;
    let candidateGroup = void 0;
    for (const instance of instances) {
      const group2 = this.getGroupForInstance(instance);
      if (group2?.terminalInstances.length === 1) {
        candidateInstance = instance;
        candidateGroup = group2;
        break;
      }
    }
    if (!candidateGroup) {
      candidateGroup = this.createGroup();
    }
    const wasActiveGroup = this.activeGroup === candidateGroup;
    for (const instance of instances) {
      if (instance === candidateInstance) {
        continue;
      }
      const oldGroup = this.getGroupForInstance(instance);
      if (!oldGroup) {
        continue;
      }
      oldGroup.removeInstance(instance);
      candidateGroup.addInstance(instance);
    }
    this.setActiveInstance(instances[0]);
    this._onDidChangeInstances.fire();
    if (!wasActiveGroup) {
      this._onDidChangeActiveGroup.fire(this.activeGroup);
    }
  }
  instanceIsSplit(instance) {
    const group = this.getGroupForInstance(instance);
    if (!group) {
      return false;
    }
    return group.terminalInstances.length > 1;
  }
  getGroupForInstance(instance) {
    return this.groups.find((group) => group.terminalInstances.includes(instance));
  }
  getGroupLabels() {
    return this.groups.filter((group) => group.terminalInstances.length > 0).map((group, index) => {
      return `${index + 1}: ${group.title ? group.title : ""}`;
    });
  }
  /**
   * Visibility should be updated in the following cases:
   * 1. Toggle `TERMINAL_VIEW_ID` visibility
   * 2. Change active group
   * 3. Change instances in active group
   */
  updateVisibility() {
    const visible = this._viewsService.isViewVisible(TERMINAL_VIEW_ID);
    this.groups.forEach((g, i) => g.setVisible(visible && i === this.activeGroupIndex));
  }
};
TerminalGroupService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IViewsService),
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, IQuickInputService)
], TerminalGroupService);
export {
  TerminalGroupService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgT3JpZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2FzaC9zYXNoLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVNoZWxsTGF1bmNoQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsR3JvdXAsIElUZXJtaW5hbEdyb3VwU2VydmljZSwgSVRlcm1pbmFsSW5zdGFuY2UgfSBmcm9tICcuL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgVGVybWluYWxHcm91cCB9IGZyb20gJy4vdGVybWluYWxHcm91cC5qcyc7XG5pbXBvcnQgeyBnZXRJbnN0YW5jZUZyb21SZXNvdXJjZSB9IGZyb20gJy4vdGVybWluYWxVcmkuanMnO1xuaW1wb3J0IHsgVGVybWluYWxWaWV3UGFuZSB9IGZyb20gJy4vdGVybWluYWxWaWV3LmpzJztcbmltcG9ydCB7IFRFUk1JTkFMX1ZJRVdfSUQgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbENvbnRleHRLZXkuanMnO1xuaW1wb3J0IHsgYXNBcnJheSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbEdyb3VwU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGVybWluYWxHcm91cFNlcnZpY2Uge1xuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRncm91cHM6IElUZXJtaW5hbEdyb3VwW10gPSBbXTtcblx0YWN0aXZlR3JvdXBJbmRleDogbnVtYmVyID0gLTE7XG5cdGdldCBpbnN0YW5jZXMoKTogSVRlcm1pbmFsSW5zdGFuY2VbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ3JvdXBzLnJlZHVjZSgocCwgYykgPT4gcC5jb25jYXQoYy50ZXJtaW5hbEluc3RhbmNlcyksIFtdIGFzIElUZXJtaW5hbEluc3RhbmNlW10pO1xuXHR9XG5cblx0bGFzdEFjY2Vzc2VkTWVudTogJ2lubGluZS10YWInIHwgJ3RhYi1saXN0JyA9ICdpbmxpbmUtdGFiJztcblxuXHRwcml2YXRlIF90ZXJtaW5hbEdyb3VwQ291bnRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxudW1iZXI+O1xuXG5cdHByaXZhdGUgX2NvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfaXNRdWlja0lucHV0T3BlbmVkOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVHcm91cCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbEdyb3VwIHwgdW5kZWZpbmVkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVHcm91cCA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlR3JvdXAuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZUdyb3VwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRlcm1pbmFsR3JvdXA+KCkpO1xuXHRyZWFkb25seSBvbkRpZERpc3Bvc2VHcm91cCA9IHRoaXMuX29uRGlkRGlzcG9zZUdyb3VwLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUdyb3VwcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUdyb3VwcyA9IHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBzLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNob3cgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRTaG93ID0gdGhpcy5fb25EaWRTaG93LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZUluc3RhbmNlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRlcm1pbmFsSW5zdGFuY2U+KCkpO1xuXHRyZWFkb25seSBvbkRpZERpc3Bvc2VJbnN0YW5jZSA9IHRoaXMuX29uRGlkRGlzcG9zZUluc3RhbmNlLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzSW5zdGFuY2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXNJbnN0YW5jZSA9IHRoaXMuX29uRGlkRm9jdXNJbnN0YW5jZS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZSA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlSW5zdGFuY2VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlSW5zdGFuY2VzID0gdGhpcy5fb25EaWRDaGFuZ2VJbnN0YW5jZXMuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlSW5zdGFuY2VDYXBhYmlsaXR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRlcm1pbmFsSW5zdGFuY2U+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUluc3RhbmNlQ2FwYWJpbGl0eSA9IHRoaXMuX29uRGlkQ2hhbmdlSW5zdGFuY2VDYXBhYmlsaXR5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUGFuZWxPcmllbnRhdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPE9yaWVudGF0aW9uPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VQYW5lbE9yaWVudGF0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VQYW5lbE9yaWVudGF0aW9uLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdmlld3NTZXJ2aWNlOiBJVmlld3NTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3F1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBDb3VudENvbnRleHRLZXkgPSBUZXJtaW5hbENvbnRleHRLZXlzLmdyb3VwQ291bnQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWREaXNwb3NlR3JvdXAoZ3JvdXAgPT4gdGhpcy5fcmVtb3ZlR3JvdXAoZ3JvdXApKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZUdyb3VwcygoKSA9PiB0aGlzLl90ZXJtaW5hbEdyb3VwQ291bnRDb250ZXh0S2V5LnNldCh0aGlzLmdyb3Vwcy5sZW5ndGgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KHRoaXMub25EaWRDaGFuZ2VBY3RpdmVHcm91cCwgdGhpcy5vbkRpZENoYW5nZUluc3RhbmNlcykoKCkgPT4gdGhpcy51cGRhdGVWaXNpYmlsaXR5KCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9xdWlja0lucHV0U2VydmljZS5vblNob3coKCkgPT4gdGhpcy5faXNRdWlja0lucHV0T3BlbmVkID0gdHJ1ZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLm9uSGlkZSgoKSA9PiB0aGlzLl9pc1F1aWNrSW5wdXRPcGVuZWQgPSBmYWxzZSkpO1xuXHR9XG5cblx0aGlkZVBhbmVsKCk6IHZvaWQge1xuXHRcdC8vIEhpZGUgdGhlIHBhbmVsIGlmIHRoZSB0ZXJtaW5hbCBpcyBpbiB0aGUgcGFuZWwgYW5kIGl0IGhhcyBubyBzaWJsaW5nIHZpZXdzXG5cdFx0Y29uc3QgcGFuZWwgPSB0aGlzLl92aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKFRFUk1JTkFMX1ZJRVdfSUQpO1xuXHRcdGlmIChwYW5lbCAmJiB0aGlzLl92aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHBhbmVsKS52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0dGhpcy5fdmlld3NTZXJ2aWNlLmNsb3NlVmlldyhURVJNSU5BTF9WSUVXX0lEKTtcblx0XHRcdFRlcm1pbmFsQ29udGV4dEtleXMudGFic01vdXNlLmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSkuc2V0KGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgYWN0aXZlR3JvdXAoKTogSVRlcm1pbmFsR3JvdXAgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLmFjdGl2ZUdyb3VwSW5kZXggPCAwIHx8IHRoaXMuYWN0aXZlR3JvdXBJbmRleCA+PSB0aGlzLmdyb3Vwcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmdyb3Vwc1t0aGlzLmFjdGl2ZUdyb3VwSW5kZXhdO1xuXHR9XG5cdHNldCBhY3RpdmVHcm91cCh2YWx1ZTogSVRlcm1pbmFsR3JvdXAgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Ly8gU2V0dGluZyB0byB1bmRlZmluZWQgaXMgbm90IHBvc3NpYmxlLCB0aGlzIGNhbiBvbmx5IGJlIGRvbmUgd2hlbiByZW1vdmluZyB0aGUgbGFzdCBncm91cFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpbmRleCA9IHRoaXMuZ3JvdXBzLmZpbmRJbmRleChlID0+IGUgPT09IHZhbHVlKTtcblx0XHR0aGlzLnNldEFjdGl2ZUdyb3VwQnlJbmRleChpbmRleCk7XG5cdH1cblxuXHRnZXQgYWN0aXZlSW5zdGFuY2UoKTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmFjdGl2ZUdyb3VwPy5hY3RpdmVJbnN0YW5jZTtcblx0fVxuXG5cdHNldEFjdGl2ZUluc3RhbmNlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdHRoaXMuc2V0QWN0aXZlSW5zdGFuY2VCeUluZGV4KHRoaXMuX2dldEluZGV4RnJvbUlkKGluc3RhbmNlLmluc3RhbmNlSWQpKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEluZGV4RnJvbUlkKHRlcm1pbmFsSWQ6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgdGVybWluYWxJbmRleCA9IHRoaXMuaW5zdGFuY2VzLmZpbmRJbmRleChlID0+IGUuaW5zdGFuY2VJZCA9PT0gdGVybWluYWxJZCk7XG5cdFx0aWYgKHRlcm1pbmFsSW5kZXggPT09IC0xKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRlcm1pbmFsIHdpdGggSUQgJHt0ZXJtaW5hbElkfSBkb2VzIG5vdCBleGlzdCAoaGFzIGl0IGFscmVhZHkgYmVlbiBkaXNwb3NlZD8pYCk7XG5cdFx0fVxuXHRcdHJldHVybiB0ZXJtaW5hbEluZGV4O1xuXHR9XG5cblx0c2V0Q29udGFpbmVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHR0aGlzLl9jb250YWluZXIgPSBjb250YWluZXI7XG5cdFx0dGhpcy5ncm91cHMuZm9yRWFjaChncm91cCA9PiBncm91cC5hdHRhY2hUb0VsZW1lbnQoY29udGFpbmVyKSk7XG5cdH1cblxuXHRhc3luYyBmb2N1c1RhYnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuaW5zdGFuY2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLnNob3dQYW5lbCh0cnVlKTtcblx0XHRjb25zdCBwYW5lID0gdGhpcy5fdmlld3NTZXJ2aWNlLmdldEFjdGl2ZVZpZXdXaXRoSWQ8VGVybWluYWxWaWV3UGFuZT4oVEVSTUlOQUxfVklFV19JRCk7XG5cdFx0cGFuZT8udGVybWluYWxUYWJiZWRWaWV3Py5mb2N1c1RhYnMoKTtcblx0fVxuXG5cdGFzeW5jIGZvY3VzSG92ZXIoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuaW5zdGFuY2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBhbmUgPSB0aGlzLl92aWV3c1NlcnZpY2UuZ2V0QWN0aXZlVmlld1dpdGhJZDxUZXJtaW5hbFZpZXdQYW5lPihURVJNSU5BTF9WSUVXX0lEKTtcblx0XHRwYW5lPy50ZXJtaW5hbFRhYmJlZFZpZXc/LmZvY3VzSG92ZXIoKTtcblx0fVxuXG5cdGFzeW5jIGZvY3VzSW5zdGFuY2UoXzogSVRlcm1pbmFsSW5zdGFuY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5zaG93UGFuZWwodHJ1ZSk7XG5cdH1cblxuXHRhc3luYyBmb2N1c0FjdGl2ZUluc3RhbmNlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLnNob3dQYW5lbCh0cnVlKTtcblx0fVxuXG5cdGNyZWF0ZUdyb3VwKHNsY09ySW5zdGFuY2U/OiBJU2hlbGxMYXVuY2hDb25maWcgfCBJVGVybWluYWxJbnN0YW5jZSk6IElUZXJtaW5hbEdyb3VwIHtcblx0XHRjb25zdCBncm91cCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsR3JvdXAsIHRoaXMuX2NvbnRhaW5lciwgc2xjT3JJbnN0YW5jZSk7XG5cdFx0dGhpcy5ncm91cHMucHVzaChncm91cCk7XG5cdFx0Z3JvdXAuYWRkRGlzcG9zYWJsZShFdmVudC5mb3J3YXJkKGdyb3VwLm9uUGFuZWxPcmllbnRhdGlvbkNoYW5nZWQsIHRoaXMuX29uRGlkQ2hhbmdlUGFuZWxPcmllbnRhdGlvbikpO1xuXHRcdGdyb3VwLmFkZERpc3Bvc2FibGUoRXZlbnQuZm9yd2FyZChncm91cC5vbkRpZERpc3Bvc2VJbnN0YW5jZSwgdGhpcy5fb25EaWREaXNwb3NlSW5zdGFuY2UpKTtcblx0XHRncm91cC5hZGREaXNwb3NhYmxlKEV2ZW50LmZvcndhcmQoZ3JvdXAub25EaWRGb2N1c0luc3RhbmNlLCB0aGlzLl9vbkRpZEZvY3VzSW5zdGFuY2UpKTtcblx0XHRncm91cC5hZGREaXNwb3NhYmxlKEV2ZW50LmZvcndhcmQoZ3JvdXAub25EaWRDaGFuZ2VJbnN0YW5jZUNhcGFiaWxpdHksIHRoaXMuX29uRGlkQ2hhbmdlSW5zdGFuY2VDYXBhYmlsaXR5KSk7XG5cdFx0Z3JvdXAuYWRkRGlzcG9zYWJsZShFdmVudC5mb3J3YXJkKGdyb3VwLm9uSW5zdGFuY2VzQ2hhbmdlZCwgdGhpcy5fb25EaWRDaGFuZ2VJbnN0YW5jZXMpKTtcblx0XHRncm91cC5hZGREaXNwb3NhYmxlKEV2ZW50LmZvcndhcmQoZ3JvdXAub25EaXNwb3NlZCwgdGhpcy5fb25EaWREaXNwb3NlR3JvdXApKTtcblx0XHRncm91cC5hZGREaXNwb3NhYmxlKGdyb3VwLm9uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UoZSA9PiB7XG5cdFx0XHRpZiAoZ3JvdXAgPT09IHRoaXMuYWN0aXZlR3JvdXApIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZS5maXJlKGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRpZiAoZ3JvdXAudGVybWluYWxJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VJbnN0YW5jZXMuZmlyZSgpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5pbnN0YW5jZXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHQvLyBJdCdzIHRoZSBmaXJzdCBpbnN0YW5jZSBzbyBpdCBzaG91bGQgYmUgbWFkZSBhY3RpdmUgYXV0b21hdGljYWxseSwgdGhpcyBtdXN0IGZpcmVcblx0XHRcdC8vIGFmdGVyIG9uSW5zdGFuY2VzQ2hhbmdlZCBzbyBjb25zdW1lcnMgY2FuIHJlYWN0IHRvIHRoZSBpbnN0YW5jZSBiZWluZyBhZGRlZCBmaXJzdFxuXHRcdFx0dGhpcy5zZXRBY3RpdmVJbnN0YW5jZUJ5SW5kZXgoMCk7XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBzLmZpcmUoKTtcblx0XHRyZXR1cm4gZ3JvdXA7XG5cdH1cblxuXHRhc3luYyBzaG93UGFuZWwoZm9jdXM/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcGFuZSA9IHRoaXMuX3ZpZXdzU2VydmljZS5nZXRBY3RpdmVWaWV3V2l0aElkKFRFUk1JTkFMX1ZJRVdfSUQpXG5cdFx0XHQ/PyBhd2FpdCB0aGlzLl92aWV3c1NlcnZpY2Uub3BlblZpZXcoVEVSTUlOQUxfVklFV19JRCwgZm9jdXMpO1xuXHRcdHBhbmU/LnNldEV4cGFuZGVkKHRydWUpO1xuXG5cdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHQvLyBEbyB0aGUgZm9jdXMgY2FsbCBhc3luY2hyb25vdXNseSBhcyBnb2luZyB0aHJvdWdoIHRoZVxuXHRcdFx0Ly8gY29tbWFuZCBwYWxldHRlIHdpbGwgZm9yY2UgZWRpdG9yIGZvY3VzXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLmFjdGl2ZUluc3RhbmNlO1xuXHRcdFx0aWYgKGluc3RhbmNlKSB7XG5cdFx0XHRcdC8vIEhBQ0s6IEVuc3VyZSB0aGUgcGFuZWwgaXMgc3RpbGwgdmlzaWJsZSBhdCB0aGlzIHBvaW50IGFzIHRoZXJlIG1heSBoYXZlIGJlZW5cblx0XHRcdFx0Ly8gYSByZXF1ZXN0IHNpbmNlIGl0IHdhcyBvcGVuZWQgdG8gc2hvdyBhIGRpZmZlcmVudCBwYW5lbFxuXHRcdFx0XHRpZiAocGFuZSAmJiAhcGFuZS5pc1Zpc2libGUoKSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX3ZpZXdzU2VydmljZS5vcGVuVmlldyhURVJNSU5BTF9WSUVXX0lELCBmb2N1cyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgaW5zdGFuY2UuZm9jdXNXaGVuUmVhZHkodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkU2hvdy5maXJlKCk7XG5cdH1cblxuXHRnZXRJbnN0YW5jZUZyb21SZXNvdXJjZShyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkKTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBnZXRJbnN0YW5jZUZyb21SZXNvdXJjZSh0aGlzLmluc3RhbmNlcywgcmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlR3JvdXAoZ3JvdXA6IElUZXJtaW5hbEdyb3VwKSB7XG5cdFx0Ly8gR2V0IHRoZSBpbmRleCBvZiB0aGUgZ3JvdXAgYW5kIHJlbW92ZSBpdCBmcm9tIHRoZSBsaXN0XG5cdFx0Y29uc3QgYWN0aXZlR3JvdXAgPSB0aGlzLmFjdGl2ZUdyb3VwO1xuXHRcdGNvbnN0IHdhc0FjdGl2ZUdyb3VwID0gZ3JvdXAgPT09IGFjdGl2ZUdyb3VwO1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5ncm91cHMuaW5kZXhPZihncm91cCk7XG5cdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0dGhpcy5ncm91cHMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBzLmZpcmUoKTtcblx0XHR9XG5cblx0XHRpZiAod2FzQWN0aXZlR3JvdXApIHtcblx0XHRcdC8vIEFkanVzdCBmb2N1cyBpZiB0aGUgZ3JvdXAgd2FzIGFjdGl2ZVxuXHRcdFx0aWYgKHRoaXMuZ3JvdXBzLmxlbmd0aCA+IDAgJiYgIXRoaXMuX2lzUXVpY2tJbnB1dE9wZW5lZCkge1xuXHRcdFx0XHRjb25zdCBuZXdJbmRleCA9IGluZGV4IDwgdGhpcy5ncm91cHMubGVuZ3RoID8gaW5kZXggOiB0aGlzLmdyb3Vwcy5sZW5ndGggLSAxO1xuXHRcdFx0XHR0aGlzLnNldEFjdGl2ZUdyb3VwQnlJbmRleChuZXdJbmRleCwgdHJ1ZSk7XG5cdFx0XHRcdHRoaXMuYWN0aXZlSW5zdGFuY2U/LmZvY3VzKHRydWUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBBZGp1c3QgdGhlIGFjdGl2ZSBncm91cCBpZiB0aGUgcmVtb3ZlZCBncm91cCB3YXMgYWJvdmUgdGhlIGFjdGl2ZSBncm91cFxuXHRcdFx0aWYgKHRoaXMuYWN0aXZlR3JvdXBJbmRleCA+IGluZGV4KSB7XG5cdFx0XHRcdHRoaXMuc2V0QWN0aXZlR3JvdXBCeUluZGV4KHRoaXMuYWN0aXZlR3JvdXBJbmRleCAtIDEpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBFbnN1cmUgdGhlIGFjdGl2ZSBncm91cCBpcyBzdGlsbCB2YWxpZCwgdGhpcyBzaG91bGQgc2V0IHRoZSBhY3RpdmVHcm91cEluZGV4IHRvIC0xIGlmXG5cdFx0Ly8gdGhlcmUgYXJlIG5vIGdyb3Vwc1xuXHRcdGlmICh0aGlzLmFjdGl2ZUdyb3VwSW5kZXggPj0gdGhpcy5ncm91cHMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnNldEFjdGl2ZUdyb3VwQnlJbmRleCh0aGlzLmdyb3Vwcy5sZW5ndGggLSAxKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZUluc3RhbmNlcy5maXJlKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VHcm91cHMuZmlyZSgpO1xuXHRcdGlmICh3YXNBY3RpdmVHcm91cCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVHcm91cC5maXJlKHRoaXMuYWN0aXZlR3JvdXApO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZS5maXJlKHRoaXMuYWN0aXZlSW5zdGFuY2UpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0gZm9yY2UgV2hldGhlciB0byBmb3JjZSB0aGUgZ3JvdXAgY2hhbmdlLCB0aGlzIHNob3VsZCBiZSB1c2VkIHdoZW4gdGhlIHByZXZpb3VzIGFjdGl2ZVxuXHQgKiBncm91cCBoYXMgYmVlbiByZW1vdmVkLlxuXHQgKi9cblx0c2V0QWN0aXZlR3JvdXBCeUluZGV4KGluZGV4OiBudW1iZXIsIGZvcmNlPzogYm9vbGVhbikge1xuXHRcdC8vIFVuc2V0IGFjdGl2ZSBncm91cCB3aGVuIHRoZSBsYXN0IGdyb3VwIGlzIHJlbW92ZWRcblx0XHRpZiAoaW5kZXggPT09IC0xICYmIHRoaXMuZ3JvdXBzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0aWYgKHRoaXMuYWN0aXZlR3JvdXBJbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0dGhpcy5hY3RpdmVHcm91cEluZGV4ID0gLTE7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlR3JvdXAuZmlyZSh0aGlzLmFjdGl2ZUdyb3VwKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZS5maXJlKHRoaXMuYWN0aXZlSW5zdGFuY2UpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEVuc3VyZSBpbmRleCBpcyB2YWxpZFxuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5ncm91cHMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRmlyZSBncm91cC9pbnN0YW5jZSBjaGFuZ2UgaWYgbmVlZGVkXG5cdFx0Y29uc3Qgb2xkQWN0aXZlR3JvdXAgPSB0aGlzLmFjdGl2ZUdyb3VwO1xuXHRcdHRoaXMuYWN0aXZlR3JvdXBJbmRleCA9IGluZGV4O1xuXHRcdGlmIChmb3JjZSB8fCBvbGRBY3RpdmVHcm91cCAhPT0gdGhpcy5hY3RpdmVHcm91cCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVHcm91cC5maXJlKHRoaXMuYWN0aXZlR3JvdXApO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZS5maXJlKHRoaXMuYWN0aXZlSW5zdGFuY2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldEluc3RhbmNlTG9jYXRpb24oaW5kZXg6IG51bWJlcik6IElJbnN0YW5jZUxvY2F0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgY3VycmVudEdyb3VwSW5kZXggPSAwO1xuXHRcdHdoaWxlIChpbmRleCA+PSAwICYmIGN1cnJlbnRHcm91cEluZGV4IDwgdGhpcy5ncm91cHMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuZ3JvdXBzW2N1cnJlbnRHcm91cEluZGV4XTtcblx0XHRcdGNvbnN0IGNvdW50ID0gZ3JvdXAudGVybWluYWxJbnN0YW5jZXMubGVuZ3RoO1xuXHRcdFx0aWYgKGluZGV4IDwgY291bnQpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRncm91cCxcblx0XHRcdFx0XHRncm91cEluZGV4OiBjdXJyZW50R3JvdXBJbmRleCxcblx0XHRcdFx0XHRpbnN0YW5jZTogZ3JvdXAudGVybWluYWxJbnN0YW5jZXNbaW5kZXhdLFxuXHRcdFx0XHRcdGluc3RhbmNlSW5kZXg6IGluZGV4XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRpbmRleCAtPSBjb3VudDtcblx0XHRcdGN1cnJlbnRHcm91cEluZGV4Kys7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRzZXRBY3RpdmVJbnN0YW5jZUJ5SW5kZXgoaW5kZXg6IG51bWJlcikge1xuXHRcdGNvbnN0IGFjdGl2ZUluc3RhbmNlID0gdGhpcy5hY3RpdmVJbnN0YW5jZTtcblx0XHRjb25zdCBpbnN0YW5jZUxvY2F0aW9uID0gdGhpcy5fZ2V0SW5zdGFuY2VMb2NhdGlvbihpbmRleCk7XG5cdFx0Y29uc3QgbmV3QWN0aXZlSW5zdGFuY2UgPSBpbnN0YW5jZUxvY2F0aW9uPy5ncm91cC50ZXJtaW5hbEluc3RhbmNlc1tpbnN0YW5jZUxvY2F0aW9uLmluc3RhbmNlSW5kZXhdO1xuXHRcdGlmICghaW5zdGFuY2VMb2NhdGlvbiB8fCBhY3RpdmVJbnN0YW5jZSA9PT0gbmV3QWN0aXZlSW5zdGFuY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVJbnN0YW5jZUluZGV4ID0gaW5zdGFuY2VMb2NhdGlvbi5pbnN0YW5jZUluZGV4O1xuXG5cdFx0dGhpcy5hY3RpdmVHcm91cEluZGV4ID0gaW5zdGFuY2VMb2NhdGlvbi5ncm91cEluZGV4O1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlR3JvdXAuZmlyZSh0aGlzLmFjdGl2ZUdyb3VwKTtcblx0XHRpbnN0YW5jZUxvY2F0aW9uLmdyb3VwLnNldEFjdGl2ZUluc3RhbmNlQnlJbmRleChhY3RpdmVJbnN0YW5jZUluZGV4LCB0cnVlKTtcblx0fVxuXG5cdHNldEFjdGl2ZUdyb3VwVG9OZXh0KCkge1xuXHRcdGlmICh0aGlzLmdyb3Vwcy5sZW5ndGggPD0gMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsZXQgbmV3SW5kZXggPSB0aGlzLmFjdGl2ZUdyb3VwSW5kZXggKyAxO1xuXHRcdGlmIChuZXdJbmRleCA+PSB0aGlzLmdyb3Vwcy5sZW5ndGgpIHtcblx0XHRcdG5ld0luZGV4ID0gMDtcblx0XHR9XG5cdFx0dGhpcy5zZXRBY3RpdmVHcm91cEJ5SW5kZXgobmV3SW5kZXgpO1xuXHR9XG5cblx0c2V0QWN0aXZlR3JvdXBUb1ByZXZpb3VzKCkge1xuXHRcdGlmICh0aGlzLmdyb3Vwcy5sZW5ndGggPD0gMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsZXQgbmV3SW5kZXggPSB0aGlzLmFjdGl2ZUdyb3VwSW5kZXggLSAxO1xuXHRcdGlmIChuZXdJbmRleCA8IDApIHtcblx0XHRcdG5ld0luZGV4ID0gdGhpcy5ncm91cHMubGVuZ3RoIC0gMTtcblx0XHR9XG5cdFx0dGhpcy5zZXRBY3RpdmVHcm91cEJ5SW5kZXgobmV3SW5kZXgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VmFsaWRUZXJtaW5hbEdyb3VwcyA9IChzb3VyY2VzOiBJVGVybWluYWxJbnN0YW5jZVtdKTogU2V0PElUZXJtaW5hbEdyb3VwPiA9PiB7XG5cdFx0cmV0dXJuIG5ldyBTZXQoXG5cdFx0XHRzb3VyY2VzXG5cdFx0XHRcdC5tYXAoc291cmNlID0+IHRoaXMuZ2V0R3JvdXBGb3JJbnN0YW5jZShzb3VyY2UpKVxuXHRcdFx0XHQuZmlsdGVyKChncm91cCkgPT4gZ3JvdXAgIT09IHVuZGVmaW5lZClcblx0XHQpO1xuXHR9O1xuXG5cdG1vdmVHcm91cChzb3VyY2U6IElUZXJtaW5hbEluc3RhbmNlIHwgSVRlcm1pbmFsSW5zdGFuY2VbXSwgdGFyZ2V0OiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdHNvdXJjZSA9IGFzQXJyYXkoc291cmNlKTtcblx0XHRjb25zdCBzb3VyY2VHcm91cHMgPSB0aGlzLl9nZXRWYWxpZFRlcm1pbmFsR3JvdXBzKHNvdXJjZSk7XG5cdFx0Y29uc3QgdGFyZ2V0R3JvdXAgPSB0aGlzLmdldEdyb3VwRm9ySW5zdGFuY2UodGFyZ2V0KTtcblx0XHRpZiAoIXRhcmdldEdyb3VwIHx8IHNvdXJjZUdyb3Vwcy5zaXplID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gVGhlIGdyb3VwcyBhcmUgdGhlIHNhbWUsIHJlYXJyYW5nZSB3aXRoaW4gdGhlIGdyb3VwXG5cdFx0aWYgKHNvdXJjZUdyb3Vwcy5zaXplID09PSAxICYmIHNvdXJjZUdyb3Vwcy5oYXModGFyZ2V0R3JvdXApKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRJbmRleCA9IHRhcmdldEdyb3VwLnRlcm1pbmFsSW5zdGFuY2VzLmluZGV4T2YodGFyZ2V0KTtcblx0XHRcdGNvbnN0IHNvcnRlZFNvdXJjZXMgPSBzb3VyY2Uuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGFyZ2V0R3JvdXAudGVybWluYWxJbnN0YW5jZXMuaW5kZXhPZihhKSAtIHRhcmdldEdyb3VwLnRlcm1pbmFsSW5zdGFuY2VzLmluZGV4T2YoYik7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGZpcnN0VGFyZ2V0SW5kZXggPSB0YXJnZXRHcm91cC50ZXJtaW5hbEluc3RhbmNlcy5pbmRleE9mKHNvcnRlZFNvdXJjZXNbMF0pO1xuXHRcdFx0Y29uc3QgcG9zaXRpb246ICdiZWZvcmUnIHwgJ2FmdGVyJyA9IGZpcnN0VGFyZ2V0SW5kZXggPCB0YXJnZXRJbmRleCA/ICdhZnRlcicgOiAnYmVmb3JlJztcblx0XHRcdHRhcmdldEdyb3VwLm1vdmVJbnN0YW5jZShzb3J0ZWRTb3VyY2VzLCB0YXJnZXRJbmRleCwgcG9zaXRpb24pO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VJbnN0YW5jZXMuZmlyZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFRoZSBncm91cHMgZGlmZmVyLCByZWFycmFuZ2UgZ3JvdXBzXG5cdFx0Y29uc3QgdGFyZ2V0R3JvdXBJbmRleCA9IHRoaXMuZ3JvdXBzLmluZGV4T2YodGFyZ2V0R3JvdXApO1xuXHRcdGNvbnN0IHNvcnRlZFNvdXJjZUdyb3VwcyA9IEFycmF5LmZyb20oc291cmNlR3JvdXBzKS5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ncm91cHMuaW5kZXhPZihhKSAtIHRoaXMuZ3JvdXBzLmluZGV4T2YoYik7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZmlyc3RTb3VyY2VHcm91cEluZGV4ID0gdGhpcy5ncm91cHMuaW5kZXhPZihzb3J0ZWRTb3VyY2VHcm91cHNbMF0pO1xuXHRcdGNvbnN0IHBvc2l0aW9uOiAnYmVmb3JlJyB8ICdhZnRlcicgPSBmaXJzdFNvdXJjZUdyb3VwSW5kZXggPCB0YXJnZXRHcm91cEluZGV4ID8gJ2FmdGVyJyA6ICdiZWZvcmUnO1xuXHRcdGNvbnN0IGluc2VydEluZGV4ID0gcG9zaXRpb24gPT09ICdhZnRlcicgPyB0YXJnZXRHcm91cEluZGV4ICsgMSA6IHRhcmdldEdyb3VwSW5kZXg7XG5cdFx0dGhpcy5ncm91cHMuc3BsaWNlKGluc2VydEluZGV4LCAwLCAuLi5zb3J0ZWRTb3VyY2VHcm91cHMpO1xuXHRcdGZvciAoY29uc3Qgc291cmNlR3JvdXAgb2Ygc29ydGVkU291cmNlR3JvdXBzKSB7XG5cdFx0XHRjb25zdCBvcmlnaW5Tb3VyY2VHcm91cEluZGV4ID0gcG9zaXRpb24gPT09ICdhZnRlcicgPyB0aGlzLmdyb3Vwcy5pbmRleE9mKHNvdXJjZUdyb3VwKSA6IHRoaXMuZ3JvdXBzLmxhc3RJbmRleE9mKHNvdXJjZUdyb3VwKTtcblx0XHRcdHRoaXMuZ3JvdXBzLnNwbGljZShvcmlnaW5Tb3VyY2VHcm91cEluZGV4LCAxKTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VJbnN0YW5jZXMuZmlyZSgpO1xuXHR9XG5cblx0bW92ZUdyb3VwVG9FbmQoc291cmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IElUZXJtaW5hbEluc3RhbmNlW10pOiB2b2lkIHtcblx0XHRzb3VyY2UgPSBhc0FycmF5KHNvdXJjZSk7XG5cdFx0Y29uc3Qgc291cmNlR3JvdXBzID0gdGhpcy5fZ2V0VmFsaWRUZXJtaW5hbEdyb3Vwcyhzb3VyY2UpO1xuXHRcdGlmIChzb3VyY2VHcm91cHMuc2l6ZSA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBsYXN0SW5zdGFuY2VJbmRleCA9IHRoaXMuZ3JvdXBzLmxlbmd0aCAtIDE7XG5cdFx0Y29uc3Qgc29ydGVkU291cmNlR3JvdXBzID0gQXJyYXkuZnJvbShzb3VyY2VHcm91cHMpLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdHJldHVybiB0aGlzLmdyb3Vwcy5pbmRleE9mKGEpIC0gdGhpcy5ncm91cHMuaW5kZXhPZihiKTtcblx0XHR9KTtcblx0XHR0aGlzLmdyb3Vwcy5zcGxpY2UobGFzdEluc3RhbmNlSW5kZXggKyAxLCAwLCAuLi5zb3J0ZWRTb3VyY2VHcm91cHMpO1xuXHRcdGZvciAoY29uc3Qgc291cmNlR3JvdXAgb2Ygc29ydGVkU291cmNlR3JvdXBzKSB7XG5cdFx0XHRjb25zdCBzb3VyY2VHcm91cEluZGV4ID0gdGhpcy5ncm91cHMuaW5kZXhPZihzb3VyY2VHcm91cCk7XG5cdFx0XHR0aGlzLmdyb3Vwcy5zcGxpY2Uoc291cmNlR3JvdXBJbmRleCwgMSk7XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlSW5zdGFuY2VzLmZpcmUoKTtcblx0fVxuXG5cdG1vdmVJbnN0YW5jZShzb3VyY2U6IElUZXJtaW5hbEluc3RhbmNlLCB0YXJnZXQ6IElUZXJtaW5hbEluc3RhbmNlLCBzaWRlOiAnYmVmb3JlJyB8ICdhZnRlcicpIHtcblx0XHRjb25zdCBzb3VyY2VHcm91cCA9IHRoaXMuZ2V0R3JvdXBGb3JJbnN0YW5jZShzb3VyY2UpO1xuXHRcdGNvbnN0IHRhcmdldEdyb3VwID0gdGhpcy5nZXRHcm91cEZvckluc3RhbmNlKHRhcmdldCk7XG5cdFx0aWYgKCFzb3VyY2VHcm91cCB8fCAhdGFyZ2V0R3JvdXApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBNb3ZlIGZyb20gdGhlIHNvdXJjZSBncm91cCB0byB0aGUgdGFyZ2V0IGdyb3VwXG5cdFx0aWYgKHNvdXJjZUdyb3VwICE9PSB0YXJnZXRHcm91cCkge1xuXHRcdFx0Ly8gTW92ZSBncm91cHNcblx0XHRcdHNvdXJjZUdyb3VwLnJlbW92ZUluc3RhbmNlKHNvdXJjZSk7XG5cdFx0XHR0YXJnZXRHcm91cC5hZGRJbnN0YW5jZShzb3VyY2UpO1xuXHRcdH1cblxuXHRcdC8vIFJlYXJyYW5nZSB3aXRoaW4gdGhlIHRhcmdldCBncm91cFxuXHRcdGNvbnN0IGluZGV4ID0gdGFyZ2V0R3JvdXAudGVybWluYWxJbnN0YW5jZXMuaW5kZXhPZih0YXJnZXQpICsgKHNpZGUgPT09ICdhZnRlcicgPyAxIDogMCk7XG5cdFx0dGFyZ2V0R3JvdXAubW92ZUluc3RhbmNlKHNvdXJjZSwgaW5kZXgsIHNpZGUpO1xuXHR9XG5cblx0dW5zcGxpdEluc3RhbmNlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdGNvbnN0IG9sZEdyb3VwID0gdGhpcy5nZXRHcm91cEZvckluc3RhbmNlKGluc3RhbmNlKTtcblx0XHRpZiAoIW9sZEdyb3VwIHx8IG9sZEdyb3VwLnRlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aCA8IDIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRvbGRHcm91cC5yZW1vdmVJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0dGhpcy5jcmVhdGVHcm91cChpbnN0YW5jZSk7XG5cdH1cblxuXHRqb2luSW5zdGFuY2VzKGluc3RhbmNlczogSVRlcm1pbmFsSW5zdGFuY2VbXSkge1xuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5nZXRHcm91cEZvckluc3RhbmNlKGluc3RhbmNlc1swXSk7XG5cdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHRsZXQgZGlmZmVyZW50R3JvdXBzID0gdHJ1ZTtcblx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgZ3JvdXAudGVybWluYWxJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGdyb3VwLnRlcm1pbmFsSW5zdGFuY2VzLmluY2x1ZGVzKGluc3RhbmNlc1tpXSkpIHtcblx0XHRcdFx0XHRkaWZmZXJlbnRHcm91cHMgPSBmYWxzZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFkaWZmZXJlbnRHcm91cHMgJiYgZ3JvdXAudGVybWluYWxJbnN0YW5jZXMubGVuZ3RoID09PSBpbnN0YW5jZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gRmluZCB0aGUgZ3JvdXAgb2YgdGhlIGZpcnN0IGluc3RhbmNlIHRoYXQgaXMgdGhlIG9ubHkgaW5zdGFuY2UgaW4gdGhlIGdyb3VwLCBpZiBvbmUgZXhpc3RzXG5cdFx0bGV0IGNhbmRpZGF0ZUluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgY2FuZGlkYXRlR3JvdXA6IElUZXJtaW5hbEdyb3VwIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuZ2V0R3JvdXBGb3JJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0XHRpZiAoZ3JvdXA/LnRlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRjYW5kaWRhdGVJbnN0YW5jZSA9IGluc3RhbmNlO1xuXHRcdFx0XHRjYW5kaWRhdGVHcm91cCA9IGdyb3VwO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDcmVhdGUgYSBuZXcgZ3JvdXAgaWYgbmVlZGVkXG5cdFx0aWYgKCFjYW5kaWRhdGVHcm91cCkge1xuXHRcdFx0Y2FuZGlkYXRlR3JvdXAgPSB0aGlzLmNyZWF0ZUdyb3VwKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2FzQWN0aXZlR3JvdXAgPSB0aGlzLmFjdGl2ZUdyb3VwID09PSBjYW5kaWRhdGVHcm91cDtcblxuXHRcdC8vIFVuc3BsaXQgYWxsIG90aGVyIGluc3RhbmNlcyBhbmQgYWRkIHRoZW0gdG8gdGhlIG5ldyBncm91cFxuXHRcdGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgaW5zdGFuY2VzKSB7XG5cdFx0XHRpZiAoaW5zdGFuY2UgPT09IGNhbmRpZGF0ZUluc3RhbmNlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBvbGRHcm91cCA9IHRoaXMuZ2V0R3JvdXBGb3JJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0XHRpZiAoIW9sZEdyb3VwKSB7XG5cdFx0XHRcdC8vIFNvbWV0aGluZyB3ZW50IHdyb25nLCBkb24ndCBqb2luIHRoaXMgb25lXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0b2xkR3JvdXAucmVtb3ZlSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdFx0Y2FuZGlkYXRlR3JvdXAuYWRkSW5zdGFuY2UoaW5zdGFuY2UpO1xuXHRcdH1cblxuXHRcdC8vIFNldCB0aGUgYWN0aXZlIHRlcm1pbmFsXG5cdFx0dGhpcy5zZXRBY3RpdmVJbnN0YW5jZShpbnN0YW5jZXNbMF0pO1xuXG5cdFx0Ly8gRmlyZSBldmVudHNcblx0XHR0aGlzLl9vbkRpZENoYW5nZUluc3RhbmNlcy5maXJlKCk7XG5cdFx0aWYgKCF3YXNBY3RpdmVHcm91cCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVHcm91cC5maXJlKHRoaXMuYWN0aXZlR3JvdXApO1xuXHRcdH1cblx0fVxuXG5cdGluc3RhbmNlSXNTcGxpdChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiBib29sZWFuIHtcblx0XHRjb25zdCBncm91cCA9IHRoaXMuZ2V0R3JvdXBGb3JJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0aWYgKCFncm91cCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gZ3JvdXAudGVybWluYWxJbnN0YW5jZXMubGVuZ3RoID4gMTtcblx0fVxuXG5cdGdldEdyb3VwRm9ySW5zdGFuY2UoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogSVRlcm1pbmFsR3JvdXAgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdyb3Vwcy5maW5kKGdyb3VwID0+IGdyb3VwLnRlcm1pbmFsSW5zdGFuY2VzLmluY2x1ZGVzKGluc3RhbmNlKSk7XG5cdH1cblxuXHRnZXRHcm91cExhYmVscygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ3JvdXBzLmZpbHRlcihncm91cCA9PiBncm91cC50ZXJtaW5hbEluc3RhbmNlcy5sZW5ndGggPiAwKS5tYXAoKGdyb3VwLCBpbmRleCkgPT4ge1xuXHRcdFx0cmV0dXJuIGAke2luZGV4ICsgMX06ICR7Z3JvdXAudGl0bGUgPyBncm91cC50aXRsZSA6ICcnfWA7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogVmlzaWJpbGl0eSBzaG91bGQgYmUgdXBkYXRlZCBpbiB0aGUgZm9sbG93aW5nIGNhc2VzOlxuXHQgKiAxLiBUb2dnbGUgYFRFUk1JTkFMX1ZJRVdfSURgIHZpc2liaWxpdHlcblx0ICogMi4gQ2hhbmdlIGFjdGl2ZSBncm91cFxuXHQgKiAzLiBDaGFuZ2UgaW5zdGFuY2VzIGluIGFjdGl2ZSBncm91cFxuXHQgKi9cblx0dXBkYXRlVmlzaWJpbGl0eSgpIHtcblx0XHRjb25zdCB2aXNpYmxlID0gdGhpcy5fdmlld3NTZXJ2aWNlLmlzVmlld1Zpc2libGUoVEVSTUlOQUxfVklFV19JRCk7XG5cdFx0dGhpcy5ncm91cHMuZm9yRWFjaCgoZywgaSkgPT4gZy5zZXRWaXNpYmxlKHZpc2libGUgJiYgaSA9PT0gdGhpcy5hY3RpdmVHcm91cEluZGV4KSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElJbnN0YW5jZUxvY2F0aW9uIHtcblx0Z3JvdXA6IElUZXJtaW5hbEdyb3VwO1xuXHRncm91cEluZGV4OiBudW1iZXI7XG5cdGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZTtcblx0aW5zdGFuY2VJbmRleDogbnVtYmVyO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxrQkFBa0I7QUFFM0IsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsK0JBQStCO0FBRXhDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZUFBZTtBQUVqQixJQUFNLHVCQUFOLGNBQW1DLFdBQTRDO0FBQUEsRUF3Q3JGLFlBQzZCLG9CQUNZLHVCQUNSLGVBQ1Msd0JBQ0osb0JBQ3BDO0FBQ0QsVUFBTTtBQU5zQjtBQUNZO0FBQ1I7QUFDUztBQUNKO0FBMUN0QyxrQkFBMkIsQ0FBQztBQUM1Qiw0QkFBMkI7QUFLM0IsNEJBQThDO0FBTTlDLFNBQVEsc0JBQStCO0FBRXZDLFNBQWlCLDBCQUEwQixLQUFLLFVBQVUsSUFBSSxRQUFvQyxDQUFDO0FBQ25HLFNBQVMseUJBQXlCLEtBQUssd0JBQXdCO0FBQy9ELFNBQWlCLHFCQUFxQixLQUFLLFVBQVUsSUFBSSxRQUF3QixDQUFDO0FBQ2xGLFNBQVMsb0JBQW9CLEtBQUssbUJBQW1CO0FBQ3JELFNBQWlCLHFCQUFxQixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDeEUsU0FBUyxvQkFBb0IsS0FBSyxtQkFBbUI7QUFDckQsU0FBaUIsYUFBYSxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDaEUsU0FBUyxZQUFZLEtBQUssV0FBVztB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L0MsVUFBSUEsUUFBTyxrQkFBa0IsV0FBVyxHQUFHO0FBQzFDLDRCQUFvQjtBQUNwQix5QkFBaUJBO0FBQ2pCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxRQUFJLENBQUMsZ0JBQWdCO0FBQ3BCLHVCQUFpQixLQUFLLFlBQVk7QUFBQSxJQUNuQztBQUVBLFVBQU0saUJBQWlCLEtBQUssZ0JBQWdCO0FBRzVDLGVBQVcsWUFBWSxXQUFXO0FBQ2pDLFVBQUksYUFBYSxtQkFBbUI7QUFDbkM7QUFBQSxNQUNEO0FBRUEsWUFBTSxXQUFXLEtBQUssb0JBQW9CLFFBQVE7QUFDbEQsVUFBSSxDQUFDLFVBQVU7QUFFZDtBQUFBLE1BQ0Q7QUFDQSxlQUFTLGVBQWUsUUFBUTtBQUNoQyxxQkFBZSxZQUFZLFFBQVE7QUFBQSxJQUNwQztBQUdBLFNBQUssa0JBQWtCLFVBQVUsQ0FBQyxDQUFDO0FBR25DLFNBQUssc0JBQXNCLEtBQUs7QUFDaEMsUUFBSSxDQUFDLGdCQUFnQjtBQUNwQixXQUFLLHdCQUF3QixLQUFLLEtBQUssV0FBVztBQUFBLElBQ25EO0FBQUEsRUFDRDtBQUFBLEVBRUEsZ0JBQWdCLFVBQXNDO0FBQ3JELFVBQU0sUUFBUSxLQUFLLG9CQUFvQixRQUFRO0FBQy9DLFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLE1BQU0sa0JBQWtCLFNBQVM7QUFBQSxFQUN6QztBQUFBLEVBRUEsb0JBQW9CLFVBQXlEO0FBQzVFLFdBQU8sS0FBSyxPQUFPLEtBQUssV0FBUyxNQUFNLGtCQUFrQixTQUFTLFFBQVEsQ0FBQztBQUFBLEVBQzVFO0FBQUEsRUFFQSxpQkFBMkI7QUFDMUIsV0FBTyxLQUFLLE9BQU8sT0FBTyxXQUFTLE1BQU0sa0JBQWtCLFNBQVMsQ0FBQyxFQUFFLElBQUksQ0FBQyxPQUFPLFVBQVU7QUFDNUYsYUFBTyxHQUFHLFFBQVEsQ0FBQyxLQUFLLE1BQU0sUUFBUSxNQUFNLFFBQVEsRUFBRTtBQUFBLElBQ3ZELENBQUM7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFRQSxtQkFBbUI7QUFDbEIsVUFBTSxVQUFVLEtBQUssY0FBYyxjQUFjLGdCQUFnQjtBQUNqRSxTQUFLLE9BQU8sUUFBUSxDQUFDLEdBQUcsTUFBTSxFQUFFLFdBQVcsV0FBVyxNQUFNLEtBQUssZ0JBQWdCLENBQUM7QUFBQSxFQUNuRjtBQUNEO0FBamVhLHVCQUFOO0FBQUEsRUF5Q0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0E3Q1U7IiwKICAibmFtZXMiOiBbInBvc2l0aW9uIiwgImdyb3VwIl0KfQo=
