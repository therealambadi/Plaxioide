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
import * as dom from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { Delayer } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { localize } from "../../../../nls.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ContextScopedSuggestEnabledInputWithHistory } from "../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js";
import { testingFilterIcon } from "./icons.js";
import { StoredValue } from "../common/storedValue.js";
import { ITestExplorerFilterState, TestFilterTerm } from "../common/testExplorerFilterState.js";
import { ITestService } from "../common/testService.js";
import { denamespaceTestTag } from "../common/testTypes.js";
const testFilterDescriptions = {
  [TestFilterTerm.Failed]: localize("testing.filters.showOnlyFailed", "Show Only Failed Tests"),
  [TestFilterTerm.Executed]: localize("testing.filters.showOnlyExecuted", "Show Only Executed Tests"),
  [TestFilterTerm.CurrentDoc]: localize("testing.filters.currentFile", "Show in Active File Only"),
  [TestFilterTerm.OpenedFiles]: localize("testing.filters.openedFiles", "Show in Opened Files Only"),
  [TestFilterTerm.Hidden]: localize("testing.filters.showExcludedTests", "Show Hidden Tests")
};
let TestingExplorerFilter = class extends BaseActionViewItem {
  constructor(action, options, state, instantiationService, testService) {
    super(null, action, options);
    this.state = state;
    this.instantiationService = instantiationService;
    this.testService = testService;
    this.focusEmitter = this._register(new Emitter());
    this.onDidFocus = this.focusEmitter.event;
    this.history = this._register(this.instantiationService.createInstance(StoredValue, {
      key: "testing.filterHistory2",
      scope: StorageScope.WORKSPACE,
      target: StorageTarget.MACHINE
    }));
    this.filtersAction = new Action("markersFiltersAction", localize("testing.filters.menu", "More Filters..."), "testing-filter-button " + ThemeIcon.asClassName(testingFilterIcon));
    this.updateFilterActiveState();
    this._register(testService.excluded.onTestExclusionsChanged(this.updateFilterActiveState, this));
  }
  /**
   * @override
   */
  render(container) {
    container.classList.add("testing-filter-action-item");
    const updateDelayer = this._register(new Delayer(400));
    const wrapper = this.wrapper = dom.$(".testing-filter-wrapper");
    container.appendChild(wrapper);
    let history = this.history.get({ lastValue: "", values: [] });
    if (history instanceof Array) {
      history = { lastValue: "", values: history };
    }
    if (history.lastValue) {
      this.state.setText(history.lastValue);
    }
    const input = this.input = this._register(this.instantiationService.createInstance(ContextScopedSuggestEnabledInputWithHistory, {
      id: "testing.explorer.filter",
      ariaLabel: localize("testExplorerFilterLabel", "Filter text for tests in the explorer"),
      parent: wrapper,
      suggestionProvider: {
        triggerCharacters: ["@"],
        provideResults: () => [
          ...Object.entries(testFilterDescriptions).map(([label, detail]) => ({ label, detail })),
          ...Iterable.map(this.testService.collection.tags.values(), (tag) => {
            const { ctrlId, tagId } = denamespaceTestTag(tag.id);
            const insertText = `@${ctrlId}:${tagId}`;
            return {
              label: `@${ctrlId}:${tagId}`,
              detail: this.testService.collection.getNodeById(ctrlId)?.item.label,
              insertText: tagId.includes(" ") ? `@${ctrlId}:"${tagId.replace(/(["\\])/g, "\\$1")}"` : insertText
            };
          })
        ].filter((r) => !this.state.text.value.includes(r.label))
      },
      resourceHandle: "testing:filter",
      suggestOptions: {
        value: this.state.text.value,
        placeholderText: localize("testExplorerFilter", "Filter (e.g. text, !exclude, @tag)")
      },
      history: history.values
    }));
    this._register(this.state.text.onDidChange((newValue) => {
      if (input.getValue() !== newValue) {
        input.setValue(newValue);
      }
    }));
    this._register(this.state.onDidRequestInputFocus(() => {
      input.focus();
    }));
    this._register(input.onDidFocus(() => {
      this.focusEmitter.fire();
    }));
    this._register(input.onInputDidChange(() => updateDelayer.trigger(() => {
      input.addToHistory();
      this.state.setText(input.getValue());
    })));
    const actionbar = this._register(new ActionBar(container, {
      actionViewItemProvider: (action, options) => {
        if (action.id === this.filtersAction.id) {
          return this.instantiationService.createInstance(FiltersDropdownMenuActionViewItem, action, options, this.state, this.actionRunner);
        }
        return void 0;
      }
    }));
    actionbar.push(this.filtersAction, { icon: true, label: false });
    this.layout(this.wrapper.clientWidth);
  }
  layout(width) {
    this.input.layout(new dom.Dimension(
      width - /* horizontal padding */
      24 - /* editor padding */
      8 - /* filter button padding */
      22,
      20
      // line height from suggestEnabledInput.ts
    ));
  }
  /**
   * Focuses the filter input.
   */
  focus() {
    this.input.focus();
  }
  /**
   * Persists changes to the input history.
   */
  saveState() {
    this.history.store({ lastValue: this.input.getValue(), values: this.input.getHistory() });
  }
  /**
   * @override
   */
  dispose() {
    this.saveState();
    super.dispose();
  }
  /**
   * Updates the 'checked' state of the filter submenu.
   */
  updateFilterActiveState() {
    this.filtersAction.checked = this.testService.excluded.hasAny;
  }
};
TestingExplorerFilter = __decorateClass([
  __decorateParam(2, ITestExplorerFilterState),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITestService)
], TestingExplorerFilter);
let FiltersDropdownMenuActionViewItem = class extends DropdownMenuActionViewItem {
  constructor(action, options, filters, actionRunner, contextMenuService, testService) {
    super(
      action,
      { getActions: () => this.getActions() },
      contextMenuService,
      {
        actionRunner,
        classNames: action.class,
        anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
        menuAsChild: true
      }
    );
    this.filters = filters;
    this.testService = testService;
  }
  render(container) {
    super.render(container);
    this.updateChecked();
  }
  getActions() {
    return [
      ...[TestFilterTerm.Failed, TestFilterTerm.Executed, TestFilterTerm.CurrentDoc, TestFilterTerm.OpenedFiles].map((term) => ({
        checked: this.filters.isFilteringFor(term),
        class: void 0,
        enabled: true,
        id: term,
        label: testFilterDescriptions[term],
        run: () => this.filters.toggleFilteringFor(term),
        tooltip: "",
        dispose: () => null
      })),
      new Separator(),
      {
        checked: this.filters.fuzzy.value,
        class: void 0,
        enabled: true,
        id: "fuzzy",
        label: localize("testing.filters.fuzzyMatch", "Fuzzy Match"),
        run: () => this.filters.fuzzy.value = !this.filters.fuzzy.value,
        tooltip: ""
      },
      new Separator(),
      {
        checked: this.filters.isFilteringFor(TestFilterTerm.Hidden),
        class: void 0,
        enabled: this.testService.excluded.hasAny,
        id: "showExcluded",
        label: localize("testing.filters.showExcludedTests", "Show Hidden Tests"),
        run: () => this.filters.toggleFilteringFor(TestFilterTerm.Hidden),
        tooltip: ""
      },
      {
        class: void 0,
        enabled: this.testService.excluded.hasAny,
        id: "removeExcluded",
        label: localize("testing.filters.removeTestExclusions", "Unhide All Tests"),
        run: async () => this.testService.excluded.clear(),
        tooltip: ""
      }
    ];
  }
  updateChecked() {
    this.element.classList.toggle("checked", this._action.checked);
  }
};
FiltersDropdownMenuActionViewItem = __decorateClass([
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, ITestService)
], FiltersDropdownMenuActionViewItem);
export {
  TestingExplorerFilter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdGluZ0V4cGxvcmVyRmlsdGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblZpZXdJdGVtLCBJQWN0aW9uVmlld0l0ZW1PcHRpb25zLCBJQmFzZUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IEFuY2hvckFsaWdubWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9kcm9wZG93bi9kcm9wZG93bkFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiwgSUFjdGlvblJ1bm5lciwgU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0U2NvcGVkU3VnZ2VzdEVuYWJsZWRJbnB1dFdpdGhIaXN0b3J5LCBTdWdnZXN0RW5hYmxlZElucHV0V2l0aEhpc3RvcnksIFN1Z2dlc3RSZXN1bHRzUHJvdmlkZXIgfSBmcm9tICcuLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvc3VnZ2VzdEVuYWJsZWRJbnB1dC9zdWdnZXN0RW5hYmxlZElucHV0LmpzJztcbmltcG9ydCB7IHRlc3RpbmdGaWx0ZXJJY29uIH0gZnJvbSAnLi9pY29ucy5qcyc7XG5pbXBvcnQgeyBTdG9yZWRWYWx1ZSB9IGZyb20gJy4uL2NvbW1vbi9zdG9yZWRWYWx1ZS5qcyc7XG5pbXBvcnQgeyBJVGVzdEV4cGxvcmVyRmlsdGVyU3RhdGUsIFRlc3RGaWx0ZXJUZXJtIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RFeHBsb3JlckZpbHRlclN0YXRlLmpzJztcbmltcG9ydCB7IElUZXN0U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi90ZXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBkZW5hbWVzcGFjZVRlc3RUYWcgfSBmcm9tICcuLi9jb21tb24vdGVzdFR5cGVzLmpzJztcblxuY29uc3QgdGVzdEZpbHRlckRlc2NyaXB0aW9uczogeyBbSyBpbiBUZXN0RmlsdGVyVGVybV06IHN0cmluZyB9ID0ge1xuXHRbVGVzdEZpbHRlclRlcm0uRmFpbGVkXTogbG9jYWxpemUoJ3Rlc3RpbmcuZmlsdGVycy5zaG93T25seUZhaWxlZCcsIFwiU2hvdyBPbmx5IEZhaWxlZCBUZXN0c1wiKSxcblx0W1Rlc3RGaWx0ZXJUZXJtLkV4ZWN1dGVkXTogbG9jYWxpemUoJ3Rlc3RpbmcuZmlsdGVycy5zaG93T25seUV4ZWN1dGVkJywgXCJTaG93IE9ubHkgRXhlY3V0ZWQgVGVzdHNcIiksXG5cdFtUZXN0RmlsdGVyVGVybS5DdXJyZW50RG9jXTogbG9jYWxpemUoJ3Rlc3RpbmcuZmlsdGVycy5jdXJyZW50RmlsZScsIFwiU2hvdyBpbiBBY3RpdmUgRmlsZSBPbmx5XCIpLFxuXHRbVGVzdEZpbHRlclRlcm0uT3BlbmVkRmlsZXNdOiBsb2NhbGl6ZSgndGVzdGluZy5maWx0ZXJzLm9wZW5lZEZpbGVzJywgXCJTaG93IGluIE9wZW5lZCBGaWxlcyBPbmx5XCIpLFxuXHRbVGVzdEZpbHRlclRlcm0uSGlkZGVuXTogbG9jYWxpemUoJ3Rlc3RpbmcuZmlsdGVycy5zaG93RXhjbHVkZWRUZXN0cycsIFwiU2hvdyBIaWRkZW4gVGVzdHNcIiksXG59O1xuXG5leHBvcnQgY2xhc3MgVGVzdGluZ0V4cGxvcmVyRmlsdGVyIGV4dGVuZHMgQmFzZUFjdGlvblZpZXdJdGVtIHtcblx0cHJpdmF0ZSBpbnB1dCE6IFN1Z2dlc3RFbmFibGVkSW5wdXRXaXRoSGlzdG9yeTtcblx0cHJpdmF0ZSB3cmFwcGVyITogSFRNTERpdkVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZm9jdXNFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZEZvY3VzID0gdGhpcy5mb2N1c0VtaXR0ZXIuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgaGlzdG9yeTogU3RvcmVkVmFsdWU8eyB2YWx1ZXM6IHN0cmluZ1tdOyBsYXN0VmFsdWU6IHN0cmluZyB9IHwgc3RyaW5nW10+ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTdG9yZWRWYWx1ZSwge1xuXHRcdGtleTogJ3Rlc3RpbmcuZmlsdGVySGlzdG9yeTInLFxuXHRcdHNjb3BlOiBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLFxuXHRcdHRhcmdldDogU3RvcmFnZVRhcmdldC5NQUNISU5FXG5cdH0pKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGZpbHRlcnNBY3Rpb24gPSBuZXcgQWN0aW9uKCdtYXJrZXJzRmlsdGVyc0FjdGlvbicsIGxvY2FsaXplKCd0ZXN0aW5nLmZpbHRlcnMubWVudScsIFwiTW9yZSBGaWx0ZXJzLi4uXCIpLCAndGVzdGluZy1maWx0ZXItYnV0dG9uICcgKyBUaGVtZUljb24uYXNDbGFzc05hbWUodGVzdGluZ0ZpbHRlckljb24pKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRhY3Rpb246IElBY3Rpb24sXG5cdFx0b3B0aW9uczogSUJhc2VBY3Rpb25WaWV3SXRlbU9wdGlvbnMsXG5cdFx0QElUZXN0RXhwbG9yZXJGaWx0ZXJTdGF0ZSBwcml2YXRlIHJlYWRvbmx5IHN0YXRlOiBJVGVzdEV4cGxvcmVyRmlsdGVyU3RhdGUsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlc3RTZXJ2aWNlOiBJVGVzdFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKG51bGwsIGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0dGhpcy51cGRhdGVGaWx0ZXJBY3RpdmVTdGF0ZSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRlc3RTZXJ2aWNlLmV4Y2x1ZGVkLm9uVGVzdEV4Y2x1c2lvbnNDaGFuZ2VkKHRoaXMudXBkYXRlRmlsdGVyQWN0aXZlU3RhdGUsIHRoaXMpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAb3ZlcnJpZGVcblx0ICovXG5cdHB1YmxpYyBvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCd0ZXN0aW5nLWZpbHRlci1hY3Rpb24taXRlbScpO1xuXG5cdFx0Y29uc3QgdXBkYXRlRGVsYXllciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEZWxheWVyPHZvaWQ+KDQwMCkpO1xuXHRcdGNvbnN0IHdyYXBwZXIgPSB0aGlzLndyYXBwZXIgPSBkb20uJCgnLnRlc3RpbmctZmlsdGVyLXdyYXBwZXInKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQod3JhcHBlcik7XG5cblx0XHRsZXQgaGlzdG9yeSA9IHRoaXMuaGlzdG9yeS5nZXQoeyBsYXN0VmFsdWU6ICcnLCB2YWx1ZXM6IFtdIH0pO1xuXHRcdGlmIChoaXN0b3J5IGluc3RhbmNlb2YgQXJyYXkpIHtcblx0XHRcdGhpc3RvcnkgPSB7IGxhc3RWYWx1ZTogJycsIHZhbHVlczogaGlzdG9yeSB9O1xuXHRcdH1cblx0XHRpZiAoaGlzdG9yeS5sYXN0VmFsdWUpIHtcblx0XHRcdHRoaXMuc3RhdGUuc2V0VGV4dChoaXN0b3J5Lmxhc3RWYWx1ZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXQgPSB0aGlzLmlucHV0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb250ZXh0U2NvcGVkU3VnZ2VzdEVuYWJsZWRJbnB1dFdpdGhIaXN0b3J5LCB7XG5cdFx0XHRpZDogJ3Rlc3RpbmcuZXhwbG9yZXIuZmlsdGVyJyxcblx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ3Rlc3RFeHBsb3JlckZpbHRlckxhYmVsJywgXCJGaWx0ZXIgdGV4dCBmb3IgdGVzdHMgaW4gdGhlIGV4cGxvcmVyXCIpLFxuXHRcdFx0cGFyZW50OiB3cmFwcGVyLFxuXHRcdFx0c3VnZ2VzdGlvblByb3ZpZGVyOiB7XG5cdFx0XHRcdHRyaWdnZXJDaGFyYWN0ZXJzOiBbJ0AnXSxcblx0XHRcdFx0cHJvdmlkZVJlc3VsdHM6ICgpID0+IFtcblx0XHRcdFx0XHQuLi5PYmplY3QuZW50cmllcyh0ZXN0RmlsdGVyRGVzY3JpcHRpb25zKS5tYXAoKFtsYWJlbCwgZGV0YWlsXSkgPT4gKHsgbGFiZWwsIGRldGFpbCB9KSksXG5cdFx0XHRcdFx0Li4uSXRlcmFibGUubWFwKHRoaXMudGVzdFNlcnZpY2UuY29sbGVjdGlvbi50YWdzLnZhbHVlcygpLCB0YWcgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgeyBjdHJsSWQsIHRhZ0lkIH0gPSBkZW5hbWVzcGFjZVRlc3RUYWcodGFnLmlkKTtcblx0XHRcdFx0XHRcdGNvbnN0IGluc2VydFRleHQgPSBgQCR7Y3RybElkfToke3RhZ0lkfWA7XG5cdFx0XHRcdFx0XHRyZXR1cm4gKHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGBAJHtjdHJsSWR9OiR7dGFnSWR9YCxcblx0XHRcdFx0XHRcdFx0ZGV0YWlsOiB0aGlzLnRlc3RTZXJ2aWNlLmNvbGxlY3Rpb24uZ2V0Tm9kZUJ5SWQoY3RybElkKT8uaXRlbS5sYWJlbCxcblx0XHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogdGFnSWQuaW5jbHVkZXMoJyAnKSA/IGBAJHtjdHJsSWR9OlwiJHt0YWdJZC5yZXBsYWNlKC8oW1wiXFxcXF0pL2csICdcXFxcJDEnKX1cImAgOiBpbnNlcnRUZXh0LFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSksXG5cdFx0XHRcdF0uZmlsdGVyKHIgPT4gIXRoaXMuc3RhdGUudGV4dC52YWx1ZS5pbmNsdWRlcyhyLmxhYmVsKSksXG5cdFx0XHR9IHNhdGlzZmllcyBTdWdnZXN0UmVzdWx0c1Byb3ZpZGVyLFxuXHRcdFx0cmVzb3VyY2VIYW5kbGU6ICd0ZXN0aW5nOmZpbHRlcicsXG5cdFx0XHRzdWdnZXN0T3B0aW9uczoge1xuXHRcdFx0XHR2YWx1ZTogdGhpcy5zdGF0ZS50ZXh0LnZhbHVlLFxuXHRcdFx0XHRwbGFjZWhvbGRlclRleHQ6IGxvY2FsaXplKCd0ZXN0RXhwbG9yZXJGaWx0ZXInLCBcIkZpbHRlciAoZS5nLiB0ZXh0LCAhZXhjbHVkZSwgQHRhZylcIiksXG5cdFx0XHR9LFxuXHRcdFx0aGlzdG9yeTogaGlzdG9yeS52YWx1ZXNcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0YXRlLnRleHQub25EaWRDaGFuZ2UobmV3VmFsdWUgPT4ge1xuXHRcdFx0aWYgKGlucHV0LmdldFZhbHVlKCkgIT09IG5ld1ZhbHVlKSB7XG5cdFx0XHRcdGlucHV0LnNldFZhbHVlKG5ld1ZhbHVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0YXRlLm9uRGlkUmVxdWVzdElucHV0Rm9jdXMoKCkgPT4ge1xuXHRcdFx0aW5wdXQuZm9jdXMoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihpbnB1dC5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdHRoaXMuZm9jdXNFbWl0dGVyLmZpcmUoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihpbnB1dC5vbklucHV0RGlkQ2hhbmdlKCgpID0+IHVwZGF0ZURlbGF5ZXIudHJpZ2dlcigoKSA9PiB7XG5cdFx0XHRpbnB1dC5hZGRUb0hpc3RvcnkoKTtcblx0XHRcdHRoaXMuc3RhdGUuc2V0VGV4dChpbnB1dC5nZXRWYWx1ZSgpKTtcblx0XHR9KSkpO1xuXG5cdFx0Y29uc3QgYWN0aW9uYmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcihjb250YWluZXIsIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gdGhpcy5maWx0ZXJzQWN0aW9uLmlkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsdGVyc0Ryb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIG9wdGlvbnMsIHRoaXMuc3RhdGUsIHRoaXMuYWN0aW9uUnVubmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHR9KSk7XG5cdFx0YWN0aW9uYmFyLnB1c2godGhpcy5maWx0ZXJzQWN0aW9uLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblxuXHRcdHRoaXMubGF5b3V0KHRoaXMud3JhcHBlci5jbGllbnRXaWR0aCk7XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0KHdpZHRoOiBudW1iZXIpIHtcblx0XHR0aGlzLmlucHV0LmxheW91dChuZXcgZG9tLkRpbWVuc2lvbihcblx0XHRcdHdpZHRoIC0gLyogaG9yaXpvbnRhbCBwYWRkaW5nICovIDI0IC0gLyogZWRpdG9yIHBhZGRpbmcgKi8gOCAtIC8qIGZpbHRlciBidXR0b24gcGFkZGluZyAqLyAyMixcblx0XHRcdDIwLCAvLyBsaW5lIGhlaWdodCBmcm9tIHN1Z2dlc3RFbmFibGVkSW5wdXQudHNcblx0XHQpKTtcblx0fVxuXG5cblx0LyoqXG5cdCAqIEZvY3VzZXMgdGhlIGZpbHRlciBpbnB1dC5cblx0ICovXG5cdHB1YmxpYyBvdmVycmlkZSBmb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLmlucHV0LmZvY3VzKCk7XG5cdH1cblxuXHQvKipcblx0ICogUGVyc2lzdHMgY2hhbmdlcyB0byB0aGUgaW5wdXQgaGlzdG9yeS5cblx0ICovXG5cdHB1YmxpYyBzYXZlU3RhdGUoKSB7XG5cdFx0dGhpcy5oaXN0b3J5LnN0b3JlKHsgbGFzdFZhbHVlOiB0aGlzLmlucHV0LmdldFZhbHVlKCksIHZhbHVlczogdGhpcy5pbnB1dC5nZXRIaXN0b3J5KCkgfSk7XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLnNhdmVTdGF0ZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBVcGRhdGVzIHRoZSAnY2hlY2tlZCcgc3RhdGUgb2YgdGhlIGZpbHRlciBzdWJtZW51LlxuXHQgKi9cblx0cHJpdmF0ZSB1cGRhdGVGaWx0ZXJBY3RpdmVTdGF0ZSgpIHtcblx0XHR0aGlzLmZpbHRlcnNBY3Rpb24uY2hlY2tlZCA9IHRoaXMudGVzdFNlcnZpY2UuZXhjbHVkZWQuaGFzQW55O1xuXHR9XG59XG5cblxuY2xhc3MgRmlsdGVyc0Ryb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtIGV4dGVuZHMgRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW0ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFjdGlvbjogSUFjdGlvbixcblx0XHRvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZmlsdGVyczogSVRlc3RFeHBsb3JlckZpbHRlclN0YXRlLFxuXHRcdGFjdGlvblJ1bm5lcjogSUFjdGlvblJ1bm5lcixcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElUZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlc3RTZXJ2aWNlOiBJVGVzdFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGFjdGlvbixcblx0XHRcdHsgZ2V0QWN0aW9uczogKCkgPT4gdGhpcy5nZXRBY3Rpb25zKCkgfSxcblx0XHRcdGNvbnRleHRNZW51U2VydmljZSxcblx0XHRcdHtcblx0XHRcdFx0YWN0aW9uUnVubmVyLFxuXHRcdFx0XHRjbGFzc05hbWVzOiBhY3Rpb24uY2xhc3MsXG5cdFx0XHRcdGFuY2hvckFsaWdubWVudFByb3ZpZGVyOiAoKSA9PiBBbmNob3JBbGlnbm1lbnQuUklHSFQsXG5cdFx0XHRcdG1lbnVBc0NoaWxkOiB0cnVlXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0dGhpcy51cGRhdGVDaGVja2VkKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldEFjdGlvbnMoKTogSUFjdGlvbltdIHtcblx0XHRyZXR1cm4gW1xuXHRcdFx0Li4uW1Rlc3RGaWx0ZXJUZXJtLkZhaWxlZCwgVGVzdEZpbHRlclRlcm0uRXhlY3V0ZWQsIFRlc3RGaWx0ZXJUZXJtLkN1cnJlbnREb2MsIFRlc3RGaWx0ZXJUZXJtLk9wZW5lZEZpbGVzXS5tYXAodGVybSA9PiAoe1xuXHRcdFx0XHRjaGVja2VkOiB0aGlzLmZpbHRlcnMuaXNGaWx0ZXJpbmdGb3IodGVybSksXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdGlkOiB0ZXJtLFxuXHRcdFx0XHRsYWJlbDogdGVzdEZpbHRlckRlc2NyaXB0aW9uc1t0ZXJtXSxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmZpbHRlcnMudG9nZ2xlRmlsdGVyaW5nRm9yKHRlcm0pLFxuXHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0ZGlzcG9zZTogKCkgPT4gbnVsbFxuXHRcdFx0fSkpLFxuXHRcdFx0bmV3IFNlcGFyYXRvcigpLFxuXHRcdFx0e1xuXHRcdFx0XHRjaGVja2VkOiB0aGlzLmZpbHRlcnMuZnV6enkudmFsdWUsXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdGlkOiAnZnV6enknLFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3Rlc3RpbmcuZmlsdGVycy5mdXp6eU1hdGNoJywgXCJGdXp6eSBNYXRjaFwiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmZpbHRlcnMuZnV6enkudmFsdWUgPSAhdGhpcy5maWx0ZXJzLmZ1enp5LnZhbHVlLFxuXHRcdFx0XHR0b29sdGlwOiAnJ1xuXHRcdFx0fSxcblx0XHRcdG5ldyBTZXBhcmF0b3IoKSxcblx0XHRcdHtcblx0XHRcdFx0Y2hlY2tlZDogdGhpcy5maWx0ZXJzLmlzRmlsdGVyaW5nRm9yKFRlc3RGaWx0ZXJUZXJtLkhpZGRlbiksXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdGVuYWJsZWQ6IHRoaXMudGVzdFNlcnZpY2UuZXhjbHVkZWQuaGFzQW55LFxuXHRcdFx0XHRpZDogJ3Nob3dFeGNsdWRlZCcsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndGVzdGluZy5maWx0ZXJzLnNob3dFeGNsdWRlZFRlc3RzJywgXCJTaG93IEhpZGRlbiBUZXN0c1wiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmZpbHRlcnMudG9nZ2xlRmlsdGVyaW5nRm9yKFRlc3RGaWx0ZXJUZXJtLkhpZGRlbiksXG5cdFx0XHRcdHRvb2x0aXA6ICcnXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRlbmFibGVkOiB0aGlzLnRlc3RTZXJ2aWNlLmV4Y2x1ZGVkLmhhc0FueSxcblx0XHRcdFx0aWQ6ICdyZW1vdmVFeGNsdWRlZCcsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndGVzdGluZy5maWx0ZXJzLnJlbW92ZVRlc3RFeGNsdXNpb25zJywgXCJVbmhpZGUgQWxsIFRlc3RzXCIpLFxuXHRcdFx0XHRydW46IGFzeW5jICgpID0+IHRoaXMudGVzdFNlcnZpY2UuZXhjbHVkZWQuY2xlYXIoKSxcblx0XHRcdFx0dG9vbHRpcDogJydcblx0XHRcdH1cblx0XHRdO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUNoZWNrZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5lbGVtZW50IS5jbGFzc0xpc3QudG9nZ2xlKCdjaGVja2VkJywgdGhpcy5fYWN0aW9uLmNoZWNrZWQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLDBCQUE4RTtBQUN2RixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLFFBQWdDLGlCQUFpQjtBQUMxRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsY0FBYyxxQkFBcUI7QUFDNUMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxtREFBMkc7QUFDcEgsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywwQkFBMEIsc0JBQXNCO0FBQ3pELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMEJBQTBCO0FBRW5DLE1BQU0seUJBQTREO0FBQUEsRUFDakUsQ0FBQyxlQUFlLE1BQU0sR0FBRyxTQUFTLGtDQUFrQyx3QkFBd0I7QUFBQSxFQUM1RixDQUFDLGVBQWUsUUFBUSxHQUFHLFNBQVMsb0NBQW9DLDBCQUEwQjtBQUFBLEVBQ2xHLENB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
