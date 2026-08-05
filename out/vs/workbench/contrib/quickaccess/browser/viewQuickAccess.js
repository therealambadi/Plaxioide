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
import { localize, localize2 } from "../../../../nls.js";
import { IQuickInputService, ItemActivation } from "../../../../platform/quickinput/common/quickInput.js";
import { PickerQuickAccessProvider } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { ITerminalGroupService, ITerminalService } from "../../terminal/browser/terminal.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { matchesFuzzy } from "../../../../base/common/filters.js";
import { fuzzyContains } from "../../../../base/common/strings.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Action2 } from "../../../../platform/actions/common/actions.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { IDebugService, REPL_VIEW_ID } from "../../debug/common/debug.js";
let ViewQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(viewDescriptorService, viewsService, outputService, terminalService, terminalGroupService, debugService, paneCompositeService, contextKeyService) {
    super(ViewQuickAccessProvider.PREFIX, {
      noResultsPick: {
        label: localize("noViewResults", "No matching views"),
        containerLabel: ""
      }
    });
    this.viewDescriptorService = viewDescriptorService;
    this.viewsService = viewsService;
    this.outputService = outputService;
    this.terminalService = terminalService;
    this.terminalGroupService = terminalGroupService;
    this.debugService = debugService;
    this.paneCompositeService = paneCompositeService;
    this.contextKeyService = contextKeyService;
  }
  _getPicks(filter) {
    const filteredViewEntries = this.doGetViewPickItems().filter((entry) => {
      if (!filter) {
        return true;
      }
      entry.highlights = { label: matchesFuzzy(filter, entry.label, true) ?? void 0 };
      return entry.highlights.label || fuzzyContains(entry.containerLabel, filter);
    });
    const mapEntryToContainer = /* @__PURE__ */ new Map();
    for (const entry of filteredViewEntries) {
      if (!mapEntryToContainer.has(entry.label)) {
        mapEntryToContainer.set(entry.label, entry.containerLabel);
      }
    }
    const filteredViewEntriesWithSeparators = [];
    let lastContainer = void 0;
    for (const entry of filteredViewEntries) {
      if (lastContainer !== entry.containerLabel) {
        lastContainer = entry.containerLabel;
        let separatorLabel;
        if (mapEntryToContainer.has(lastContainer)) {
          separatorLabel = `${mapEntryToContainer.get(lastContainer)} / ${lastContainer}`;
        } else {
          separatorLabel = lastContainer;
        }
        filteredViewEntriesWithSeparators.push({ type: "separator", label: separatorLabel });
      }
      filteredViewEntriesWithSeparators.push(entry);
    }
    return filteredViewEntriesWithSeparators;
  }
  doGetViewPickItems() {
    const viewEntries = [];
    const getViewEntriesForPaneComposite = (paneComposite, viewContainer) => {
      const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
      const result = [];
      for (const view of viewContainerModel.allViewDescriptors) {
        if (this.contextKeyService.contextMatchesRules(view.when)) {
          result.push({
            label: view.name.value,
            containerLabel: viewContainerModel.title,
            accept: () => this.viewsService.openView(view.id, true)
          });
        }
      }
      return result;
    };
    const addPaneComposites = (location, containerLabel) => {
      const paneComposites = this.paneCompositeService.getPaneComposites(location);
      const visiblePaneCompositeIds = this.paneCompositeService.getVisiblePaneCompositeIds(location);
      paneComposites.sort((a, b) => {
        let aIndex = visiblePaneCompositeIds.findIndex((id) => a.id === id);
        let bIndex = visiblePaneCompositeIds.findIndex((id) => b.id === id);
        if (aIndex < 0) {
          aIndex = paneComposites.indexOf(a) + visiblePaneCompositeIds.length;
        }
        if (bIndex < 0) {
          bIndex = paneComposites.indexOf(b) + visiblePaneCompositeIds.length;
        }
        return aIndex - bIndex;
      });
      for (const paneComposite of paneComposites) {
        if (this.includeViewContainer(paneComposite)) {
          const viewContainer = this.viewDescriptorService.getViewContainerById(paneComposite.id);
          if (viewContainer) {
            viewEntries.push({
              label: this.viewDescriptorService.getViewContainerModel(viewContainer).title,
              containerLabel,
              accept: () => this.paneCompositeService.openPaneComposite(paneComposite.id, location, true)
            });
          }
        }
      }
    };
    addPaneComposites(ViewContainerLocation.Sidebar, localize("views", "Side Bar"));
    addPaneComposites(ViewContainerLocation.Panel, localize("panels", "Panel"));
    addPaneComposites(ViewContainerLocation.AuxiliaryBar, localize("Void side bar", "Void Side Bar"));
    const addPaneCompositeViews = (location) => {
      const paneComposites = this.paneCompositeService.getPaneComposites(location);
      for (const paneComposite of paneComposites) {
        const viewContainer = this.viewDescriptorService.getViewContainerById(paneComposite.id);
        if (viewContainer) {
          viewEntries.push(...getViewEntriesForPaneComposite(paneComposite, viewContainer));
        }
      }
    };
    addPaneCompositeViews(ViewContainerLocation.Sidebar);
    addPaneCompositeViews(ViewContainerLocation.Panel);
    addPaneCompositeViews(ViewContainerLocation.AuxiliaryBar);
    this.terminalGroupService.groups.forEach((group, groupIndex) => {
      group.terminalInstances.forEach((terminal, terminalIndex) => {
        const label = localize("terminalTitle", "{0}: {1}", `${groupIndex + 1}.${terminalIndex + 1}`, terminal.title);
        viewEntries.push({
          label,
          containerLabel: localize("terminals", "Terminal"),
          accept: async () => {
            await this.terminalGroupService.showPanel(true);
            this.terminalService.setActiveInstance(terminal);
          }
        });
      });
    });
    this.debugService.getModel().getSessions(true).filter((s) => s.hasSeparateRepl()).forEach((session, _) => {
      const label = session.name;
      viewEntries.push({
        label,
        containerLabel: localize("debugConsoles", "Debug Console"),
        accept: async () => {
          await this.debugService.focusStackFrame(void 0, void 0, session, { explicit: true });
          if (!this.viewsService.isViewVisible(REPL_VIEW_ID)) {
            await this.viewsService.openView(REPL_VIEW_ID, true);
          }
        }
      });
    });
    const channels = this.outputService.getChannelDescriptors();
    for (const channel of channels) {
      viewEntries.push({
        label: channel.label,
        containerLabel: localize("channels", "Output"),
        accept: () => this.outputService.showChannel(channel.id)
      });
    }
    return viewEntries;
  }
  includeViewContainer(container) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(container.id);
    if (viewContainer?.hideIfEmpty) {
      return this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.length > 0;
    }
    return true;
  }
};
ViewQuickAccessProvider.PREFIX = "view ";
ViewQuickAccessProvider = __decorateClass([
  __decorateParam(0, IViewDescriptorService),
  __decorateParam(1, IViewsService),
  __decorateParam(2, IOutputService),
  __decorateParam(3, ITerminalService),
  __decorateParam(4, ITerminalGroupService),
  __decorateParam(5, IDebugService),
  __decorateParam(6, IPaneCompositePartService),
  __decorateParam(7, IContextKeyService)
], ViewQuickAccessProvider);
const _OpenViewPickerAction = class _OpenViewPickerAction extends Action2 {
  constructor() {
    super({
      id: _OpenViewPickerAction.ID,
      title: localize2("openView", "Open View"),
      category: Categories.View,
      f1: true
    });
  }
  async run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(ViewQuickAccessProvider.PREFIX);
  }
};
_OpenViewPickerAction.ID = "workbench.action.openView";
let OpenViewPickerAction = _OpenViewPickerAction;
const _QuickAccessViewPickerAction = class _QuickAccessViewPickerAction extends Action2 {
  constructor() {
    super({
      id: _QuickAccessViewPickerAction.ID,
      title: localize2("quickOpenView", "Quick Open View"),
      category: Categories.View,
      f1: false,
      // hide quick pickers from command palette to not confuse with the other entry that shows a input field
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: void 0,
        ..._QuickAccessViewPickerAction.KEYBINDING
      }
    });
  }
  async run(accessor) {
    const keybindingService = accessor.get(IKeybindingService);
    const quickInputService = accessor.get(IQuickInputService);
    const keys = keybindingService.lookupKeybindings(_QuickAccessViewPickerAction.ID);
    quickInputService.quickAccess.show(ViewQuickAccessProvider.PREFIX, { quickNavigateConfiguration: { keybindings: keys }, itemActivation: ItemActivation.FIRST });
  }
};
_QuickAccessViewPickerAction.ID = "workbench.action.quickOpenView";
_QuickAccessViewPickerAction.KEYBINDING = {
  primary: KeyMod.CtrlCmd | KeyCode.KeyQ,
  mac: { primary: KeyMod.WinCtrl | KeyCode.KeyQ },
  linux: { primary: 0 }
};
let QuickAccessViewPickerAction = _QuickAccessViewPickerAction;
export {
  OpenViewPickerAction,
  QuickAccessViewPickerAction,
  ViewQuickAccessProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9xdWlja2FjY2Vzcy9icm93c2VyL3ZpZXdRdWlja0FjY2Vzcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVF1aWNrUGlja1NlcGFyYXRvciwgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJdGVtQWN0aXZhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVBpY2tlclF1aWNrQWNjZXNzSXRlbSwgUGlja2VyUXVpY2tBY2Nlc3NQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci9waWNrZXJRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBWaWV3Q29udGFpbmVyLCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU91dHB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9vdXRwdXQvY29tbW9uL291dHB1dC5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxHcm91cFNlcnZpY2UsIElUZXJtaW5hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgUGFuZUNvbXBvc2l0ZURlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhbmVjb21wb3NpdGUuanMnO1xuaW1wb3J0IHsgbWF0Y2hlc0Z1enp5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBmdXp6eUNvbnRhaW5zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IEFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleU1vZCwgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElEZWJ1Z1NlcnZpY2UsIFJFUExfVklFV19JRCB9IGZyb20gJy4uLy4uL2RlYnVnL2NvbW1vbi9kZWJ1Zy5qcyc7XG5cbmludGVyZmFjZSBJVmlld1F1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtIHtcblx0Y29udGFpbmVyTGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFZpZXdRdWlja0FjY2Vzc1Byb3ZpZGVyIGV4dGVuZHMgUGlja2VyUXVpY2tBY2Nlc3NQcm92aWRlcjxJVmlld1F1aWNrUGlja0l0ZW0+IHtcblxuXHRzdGF0aWMgUFJFRklYID0gJ3ZpZXcgJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRASU91dHB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvdXRwdXRTZXJ2aWNlOiBJT3V0cHV0U2VydmljZSxcblx0XHRASVRlcm1pbmFsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0XHRASVRlcm1pbmFsR3JvdXBTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVybWluYWxHcm91cFNlcnZpY2U6IElUZXJtaW5hbEdyb3VwU2VydmljZSxcblx0XHRASURlYnVnU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRASVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhbmVDb21wb3NpdGVTZXJ2aWNlOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFZpZXdRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCwge1xuXHRcdFx0bm9SZXN1bHRzUGljazoge1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ25vVmlld1Jlc3VsdHMnLCBcIk5vIG1hdGNoaW5nIHZpZXdzXCIpLFxuXHRcdFx0XHRjb250YWluZXJMYWJlbDogJydcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0UGlja3MoZmlsdGVyOiBzdHJpbmcpOiBBcnJheTxJVmlld1F1aWNrUGlja0l0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yPiB7XG5cdFx0Y29uc3QgZmlsdGVyZWRWaWV3RW50cmllcyA9IHRoaXMuZG9HZXRWaWV3UGlja0l0ZW1zKCkuZmlsdGVyKGVudHJ5ID0+IHtcblx0XHRcdGlmICghZmlsdGVyKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBNYXRjaCBmdXp6eSBvbiBsYWJlbFxuXHRcdFx0ZW50cnkuaGlnaGxpZ2h0cyA9IHsgbGFiZWw6IG1hdGNoZXNGdXp6eShmaWx0ZXIsIGVudHJ5LmxhYmVsLCB0cnVlKSA/PyB1bmRlZmluZWQgfTtcblxuXHRcdFx0Ly8gUmV0dXJuIGlmIHdlIGhhdmUgYSBtYXRjaCBvbiBsYWJlbCBvciBjb250YWluZXJcblx0XHRcdHJldHVybiBlbnRyeS5oaWdobGlnaHRzLmxhYmVsIHx8IGZ1enp5Q29udGFpbnMoZW50cnkuY29udGFpbmVyTGFiZWwsIGZpbHRlcik7XG5cdFx0fSk7XG5cblx0XHQvLyBNYXAgZW50cmllcyB0byBjb250YWluZXIgbGFiZWxzXG5cdFx0Y29uc3QgbWFwRW50cnlUb0NvbnRhaW5lciA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBmaWx0ZXJlZFZpZXdFbnRyaWVzKSB7XG5cdFx0XHRpZiAoIW1hcEVudHJ5VG9Db250YWluZXIuaGFzKGVudHJ5LmxhYmVsKSkge1xuXHRcdFx0XHRtYXBFbnRyeVRvQ29udGFpbmVyLnNldChlbnRyeS5sYWJlbCwgZW50cnkuY29udGFpbmVyTGFiZWwpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFkZCBzZXBhcmF0b3JzIGZvciBjb250YWluZXJzXG5cdFx0Y29uc3QgZmlsdGVyZWRWaWV3RW50cmllc1dpdGhTZXBhcmF0b3JzOiBBcnJheTxJVmlld1F1aWNrUGlja0l0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yPiA9IFtdO1xuXHRcdGxldCBsYXN0Q29udGFpbmVyOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBmaWx0ZXJlZFZpZXdFbnRyaWVzKSB7XG5cdFx0XHRpZiAobGFzdENvbnRhaW5lciAhPT0gZW50cnkuY29udGFpbmVyTGFiZWwpIHtcblx0XHRcdFx0bGFzdENvbnRhaW5lciA9IGVudHJ5LmNvbnRhaW5lckxhYmVsO1xuXG5cdFx0XHRcdC8vIFdoZW4gdGhlIGVudHJ5IGNvbnRhaW5lciBoYXMgYSBwYXJlbnQgY29udGFpbmVyLCBzZXQgY29udGFpbmVyXG5cdFx0XHRcdC8vIGxhYmVsIGFzIFBhcmVudCAvIENoaWxkLiBGb3IgZXhhbXBsZSwgYFZpZXdzIC8gRXhwbG9yZXJgLlxuXHRcdFx0XHRsZXQgc2VwYXJhdG9yTGFiZWw6IHN0cmluZztcblx0XHRcdFx0aWYgKG1hcEVudHJ5VG9Db250YWluZXIuaGFzKGxhc3RDb250YWluZXIpKSB7XG5cdFx0XHRcdFx0c2VwYXJhdG9yTGFiZWwgPSBgJHttYXBFbnRyeVRvQ29udGFpbmVyLmdldChsYXN0Q29udGFpbmVyKX0gLyAke2xhc3RDb250YWluZXJ9YDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZXBhcmF0b3JMYWJlbCA9IGxhc3RDb250YWluZXI7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmaWx0ZXJlZFZpZXdFbnRyaWVzV2l0aFNlcGFyYXRvcnMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogc2VwYXJhdG9yTGFiZWwgfSk7XG5cblx0XHRcdH1cblxuXHRcdFx0ZmlsdGVyZWRWaWV3RW50cmllc1dpdGhTZXBhcmF0b3JzLnB1c2goZW50cnkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBmaWx0ZXJlZFZpZXdFbnRyaWVzV2l0aFNlcGFyYXRvcnM7XG5cdH1cblxuXHRwcml2YXRlIGRvR2V0Vmlld1BpY2tJdGVtcygpOiBBcnJheTxJVmlld1F1aWNrUGlja0l0ZW0+IHtcblx0XHRjb25zdCB2aWV3RW50cmllczogQXJyYXk8SVZpZXdRdWlja1BpY2tJdGVtPiA9IFtdO1xuXG5cdFx0Y29uc3QgZ2V0Vmlld0VudHJpZXNGb3JQYW5lQ29tcG9zaXRlID0gKHBhbmVDb21wb3NpdGU6IFBhbmVDb21wb3NpdGVEZXNjcmlwdG9yLCB2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyKTogSVZpZXdRdWlja1BpY2tJdGVtW10gPT4ge1xuXHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lck1vZGVsID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpO1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBJVmlld1F1aWNrUGlja0l0ZW1bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCB2aWV3IG9mIHZpZXdDb250YWluZXJNb2RlbC5hbGxWaWV3RGVzY3JpcHRvcnMpIHtcblx0XHRcdFx0aWYgKHRoaXMuY29udGV4dEtleVNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyh2aWV3LndoZW4pKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHRcdFx0bGFiZWw6IHZpZXcubmFtZS52YWx1ZSxcblx0XHRcdFx0XHRcdGNvbnRhaW5lckxhYmVsOiB2aWV3Q29udGFpbmVyTW9kZWwudGl0bGUsXG5cdFx0XHRcdFx0XHRhY2NlcHQ6ICgpID0+IHRoaXMudmlld3NTZXJ2aWNlLm9wZW5WaWV3KHZpZXcuaWQsIHRydWUpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9O1xuXG5cdFx0Y29uc3QgYWRkUGFuZUNvbXBvc2l0ZXMgPSAobG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiwgY29udGFpbmVyTGFiZWw6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgcGFuZUNvbXBvc2l0ZXMgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldFBhbmVDb21wb3NpdGVzKGxvY2F0aW9uKTtcblx0XHRcdGNvbnN0IHZpc2libGVQYW5lQ29tcG9zaXRlSWRzID0gdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5nZXRWaXNpYmxlUGFuZUNvbXBvc2l0ZUlkcyhsb2NhdGlvbik7XG5cblx0XHRcdHBhbmVDb21wb3NpdGVzLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdFx0bGV0IGFJbmRleCA9IHZpc2libGVQYW5lQ29tcG9zaXRlSWRzLmZpbmRJbmRleChpZCA9PiBhLmlkID09PSBpZCk7XG5cdFx0XHRcdGxldCBiSW5kZXggPSB2aXNpYmxlUGFuZUNvbXBvc2l0ZUlkcy5maW5kSW5kZXgoaWQgPT4gYi5pZCA9PT0gaWQpO1xuXG5cdFx0XHRcdGlmIChhSW5kZXggPCAwKSB7XG5cdFx0XHRcdFx0YUluZGV4ID0gcGFuZUNvbXBvc2l0ZXMuaW5kZXhPZihhKSArIHZpc2libGVQYW5lQ29tcG9zaXRlSWRzLmxlbmd0aDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChiSW5kZXggPCAwKSB7XG5cdFx0XHRcdFx0YkluZGV4ID0gcGFuZUNvbXBvc2l0ZXMuaW5kZXhPZihiKSArIHZpc2libGVQYW5lQ29tcG9zaXRlSWRzLmxlbmd0aDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBhSW5kZXggLSBiSW5kZXg7XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yIChjb25zdCBwYW5lQ29tcG9zaXRlIG9mIHBhbmVDb21wb3NpdGVzKSB7XG5cdFx0XHRcdGlmICh0aGlzLmluY2x1ZGVWaWV3Q29udGFpbmVyKHBhbmVDb21wb3NpdGUpKSB7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKHBhbmVDb21wb3NpdGUuaWQpO1xuXHRcdFx0XHRcdGlmICh2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHRcdFx0XHR2aWV3RW50cmllcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3Q29udGFpbmVyKS50aXRsZSxcblx0XHRcdFx0XHRcdFx0Y29udGFpbmVyTGFiZWwsXG5cdFx0XHRcdFx0XHRcdGFjY2VwdDogKCkgPT4gdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZShwYW5lQ29tcG9zaXRlLmlkLCBsb2NhdGlvbiwgdHJ1ZSlcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBWaWV3bGV0cyAvIFBhbmVsc1xuXHRcdGFkZFBhbmVDb21wb3NpdGVzKFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLCBsb2NhbGl6ZSgndmlld3MnLCBcIlNpZGUgQmFyXCIpKTtcblx0XHRhZGRQYW5lQ29tcG9zaXRlcyhWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsIGxvY2FsaXplKCdwYW5lbHMnLCBcIlBhbmVsXCIpKTtcblx0XHRhZGRQYW5lQ29tcG9zaXRlcyhWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyLCBsb2NhbGl6ZSgnVm9pZCBzaWRlIGJhcicsIFwiVm9pZCBTaWRlIEJhclwiKSk7XG5cblx0XHRjb25zdCBhZGRQYW5lQ29tcG9zaXRlVmlld3MgPSAobG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbikgPT4ge1xuXHRcdFx0Y29uc3QgcGFuZUNvbXBvc2l0ZXMgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldFBhbmVDb21wb3NpdGVzKGxvY2F0aW9uKTtcblx0XHRcdGZvciAoY29uc3QgcGFuZUNvbXBvc2l0ZSBvZiBwYW5lQ29tcG9zaXRlcykge1xuXHRcdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQocGFuZUNvbXBvc2l0ZS5pZCk7XG5cdFx0XHRcdGlmICh2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHRcdFx0dmlld0VudHJpZXMucHVzaCguLi5nZXRWaWV3RW50cmllc0ZvclBhbmVDb21wb3NpdGUocGFuZUNvbXBvc2l0ZSwgdmlld0NvbnRhaW5lcikpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIFNpZGUgQmFyIC8gUGFuZWwgVmlld3Ncblx0XHRhZGRQYW5lQ29tcG9zaXRlVmlld3MoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGFkZFBhbmVDb21wb3NpdGVWaWV3cyhWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXHRcdGFkZFBhbmVDb21wb3NpdGVWaWV3cyhWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKTtcblxuXHRcdC8vIFRlcm1pbmFsc1xuXHRcdHRoaXMudGVybWluYWxHcm91cFNlcnZpY2UuZ3JvdXBzLmZvckVhY2goKGdyb3VwLCBncm91cEluZGV4KSA9PiB7XG5cdFx0XHRncm91cC50ZXJtaW5hbEluc3RhbmNlcy5mb3JFYWNoKCh0ZXJtaW5hbCwgdGVybWluYWxJbmRleCkgPT4ge1xuXHRcdFx0XHRjb25zdCBsYWJlbCA9IGxvY2FsaXplKCd0ZXJtaW5hbFRpdGxlJywgXCJ7MH06IHsxfVwiLCBgJHtncm91cEluZGV4ICsgMX0uJHt0ZXJtaW5hbEluZGV4ICsgMX1gLCB0ZXJtaW5hbC50aXRsZSk7XG5cdFx0XHRcdHZpZXdFbnRyaWVzLnB1c2goe1xuXHRcdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRcdGNvbnRhaW5lckxhYmVsOiBsb2NhbGl6ZSgndGVybWluYWxzJywgXCJUZXJtaW5hbFwiKSxcblx0XHRcdFx0XHRhY2NlcHQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudGVybWluYWxHcm91cFNlcnZpY2Uuc2hvd1BhbmVsKHRydWUpO1xuXHRcdFx0XHRcdFx0dGhpcy50ZXJtaW5hbFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UodGVybWluYWwpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdC8vIERlYnVnIENvbnNvbGVzXG5cdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9ucyh0cnVlKS5maWx0ZXIocyA9PiBzLmhhc1NlcGFyYXRlUmVwbCgpKS5mb3JFYWNoKChzZXNzaW9uLCBfKSA9PiB7XG5cdFx0XHRjb25zdCBsYWJlbCA9IHNlc3Npb24ubmFtZTtcblx0XHRcdHZpZXdFbnRyaWVzLnB1c2goe1xuXHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0Y29udGFpbmVyTGFiZWw6IGxvY2FsaXplKCdkZWJ1Z0NvbnNvbGVzJywgXCJEZWJ1ZyBDb25zb2xlXCIpLFxuXHRcdFx0XHRhY2NlcHQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS5mb2N1c1N0YWNrRnJhbWUodW5kZWZpbmVkLCB1bmRlZmluZWQsIHNlc3Npb24sIHsgZXhwbGljaXQ6IHRydWUgfSk7XG5cblx0XHRcdFx0XHRpZiAoIXRoaXMudmlld3NTZXJ2aWNlLmlzVmlld1Zpc2libGUoUkVQTF9WSUVXX0lEKSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy52aWV3c1NlcnZpY2Uub3BlblZpZXcoUkVQTF9WSUVXX0lELCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0fSk7XG5cblx0XHQvLyBPdXRwdXQgQ2hhbm5lbHNcblx0XHRjb25zdCBjaGFubmVscyA9IHRoaXMub3V0cHV0U2VydmljZS5nZXRDaGFubmVsRGVzY3JpcHRvcnMoKTtcblx0XHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgY2hhbm5lbHMpIHtcblx0XHRcdHZpZXdFbnRyaWVzLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogY2hhbm5lbC5sYWJlbCxcblx0XHRcdFx0Y29udGFpbmVyTGFiZWw6IGxvY2FsaXplKCdjaGFubmVscycsIFwiT3V0cHV0XCIpLFxuXHRcdFx0XHRhY2NlcHQ6ICgpID0+IHRoaXMub3V0cHV0U2VydmljZS5zaG93Q2hhbm5lbChjaGFubmVsLmlkKVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZpZXdFbnRyaWVzO1xuXHR9XG5cblx0cHJpdmF0ZSBpbmNsdWRlVmlld0NvbnRhaW5lcihjb250YWluZXI6IFBhbmVDb21wb3NpdGVEZXNjcmlwdG9yKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKGNvbnRhaW5lci5pZCk7XG5cdFx0aWYgKHZpZXdDb250YWluZXI/LmhpZGVJZkVtcHR5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGggPiAwO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG5cblxuLy8jcmVnaW9uIEFjdGlvbnNcblxuZXhwb3J0IGNsYXNzIE9wZW5WaWV3UGlja2VyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24ub3BlblZpZXcnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBPcGVuVmlld1BpY2tlckFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ29wZW5WaWV3JywgJ09wZW4gVmlldycpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKS5xdWlja0FjY2Vzcy5zaG93KFZpZXdRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFF1aWNrQWNjZXNzVmlld1BpY2tlckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLnF1aWNrT3BlblZpZXcnO1xuXHRzdGF0aWMgcmVhZG9ubHkgS0VZQklORElORyA9IHtcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5USxcblx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleVEgfSxcblx0XHRsaW51eDogeyBwcmltYXJ5OiAwIH1cblx0fTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogUXVpY2tBY2Nlc3NWaWV3UGlja2VyQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncXVpY2tPcGVuVmlldycsICdRdWljayBPcGVuIFZpZXcnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogZmFsc2UsIC8vIGhpZGUgcXVpY2sgcGlja2VycyBmcm9tIGNvbW1hbmQgcGFsZXR0ZSB0byBub3QgY29uZnVzZSB3aXRoIHRoZSBvdGhlciBlbnRyeSB0aGF0IHNob3dzIGEgaW5wdXQgZmllbGRcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IHVuZGVmaW5lZCxcblx0XHRcdFx0Li4uUXVpY2tBY2Nlc3NWaWV3UGlja2VyQWN0aW9uLktFWUJJTkRJTkdcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGtleWJpbmRpbmdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElLZXliaW5kaW5nU2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGtleXMgPSBrZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5ncyhRdWlja0FjY2Vzc1ZpZXdQaWNrZXJBY3Rpb24uSUQpO1xuXG5cdFx0cXVpY2tJbnB1dFNlcnZpY2UucXVpY2tBY2Nlc3Muc2hvdyhWaWV3UXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVgsIHsgcXVpY2tOYXZpZ2F0ZUNvbmZpZ3VyYXRpb246IHsga2V5YmluZGluZ3M6IGtleXMgfSwgaXRlbUFjdGl2YXRp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
