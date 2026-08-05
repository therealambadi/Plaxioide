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
import "./markersFileDecorations.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { localize, localize2 } from "../../../../nls.js";
import { Marker, RelatedInformation, ResourceMarkers } from "./markersModel.js";
import { MarkersView } from "./markersView.js";
import { MenuId, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { MarkersViewMode, Markers, MarkersContextKeys } from "../common/markers.js";
import Messages from "./messages.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
import { IMarkerService } from "../../../../platform/markers/common/markers.js";
import { Extensions as ViewContainerExtensions, ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { getVisbileViewContextKey, FocusedViewContext } from "../../../common/contextkeys.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { ViewAction } from "../../../browser/parts/views/viewPane.js";
import { IActivityService, NumberBadge } from "../../../services/activity/common/activity.js";
import { viewFilterSubmenu } from "../../../browser/parts/views/viewFilter.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { problemsConfigurationNodeBase } from "../../../common/configuration.js";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: Markers.MARKER_OPEN_ACTION_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(MarkersContextKeys.MarkerFocusContextKey),
  primary: KeyCode.Enter,
  mac: {
    primary: KeyCode.Enter,
    secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow]
  },
  handler: (accessor, args) => {
    const markersView = accessor.get(IViewsService).getActiveViewWithId(Markers.MARKERS_VIEW_ID);
    markersView.openFileAtElement(markersView.getFocusElement(), false, false, true);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: Markers.MARKER_OPEN_SIDE_ACTION_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  when: ContextKeyExpr.and(MarkersContextKeys.MarkerFocusContextKey),
  primary: KeyMod.CtrlCmd | KeyCode.Enter,
  mac: {
    primary: KeyMod.WinCtrl | KeyCode.Enter
  },
  handler: (accessor, args) => {
    const markersView = accessor.get(IViewsService).getActiveViewWithId(Markers.MARKERS_VIEW_ID);
    markersView.openFileAtElement(markersView.getFocusElement(), false, true, true);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: Markers.MARKER_SHOW_PANEL_ID,
  weight: KeybindingWeight.WorkbenchContrib,
  when: void 0,
  primary: void 0,
  handler: async (accessor, args) => {
    await accessor.get(IViewsService).openView(Markers.MARKERS_VIEW_ID);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: Markers.MARKER_SHOW_QUICK_FIX,
  weight: KeybindingWeight.WorkbenchContrib,
  when: MarkersContextKeys.MarkerFocusContextKey,
  primary: KeyMod.CtrlCmd | KeyCode.Period,
  handler: (accessor, args) => {
    const markersView = accessor.get(IViewsService).getActiveViewWithId(Markers.MARKERS_VIEW_ID);
    const focusedElement = markersView.getFocusElement();
    if (focusedElement instanceof Marker) {
      markersView.showQuickFixes(focusedElement);
    }
  }
});
Registry.as(Extensions.Configuration).registerConfiguration({
  ...problemsConfigurationNodeBase,
  "properties": {
    "problems.autoReveal": {
      "description": Messages.PROBLEMS_PANEL_CONFIGURATION_AUTO_REVEAL,
      "type": "boolean",
      "default": true
    },
    "problems.defaultViewMode": {
      "description": Messages.PROBLEMS_PANEL_CONFIGURATION_VIEW_MODE,
      "type": "string",
      "default": "tree",
      "enum": ["table", "tree"]
    },
    "problems.showCurrentInStatus": {
      "description": Messages.PROBLEMS_PANEL_CONFIGURATION_SHOW_CURRENT_STATUS,
      "type": "boolean",
      "default": false
    },
    "problems.sortOrder": {
      "description": Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER,
      "type": "string",
      "default": "severity",
      "enum": ["severity", "position"],
      "enumDescriptions": [
        Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER_SEVERITY,
        Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER_POSITION
      ]
    }
  }
});
const markersViewIcon = registerIcon("markers-view-icon", Codicon.warning, localize("markersViewIcon", "View icon of the markers view."));
const VIEW_CONTAINER = Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
  id: Markers.MARKERS_CONTAINER_ID,
  title: Messages.MARKERS_PANEL_TITLE_PROBLEMS,
  icon: markersViewIcon,
  hideIfEmpty: true,
  order: 0,
  ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [Markers.MARKERS_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
  storageId: Markers.MARKERS_VIEW_STORAGE_ID
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });
Registry.as(ViewContainerExtensions.ViewsRegistry).registerViews([{
  id: Markers.MARKERS_VIEW_ID,
  containerIcon: markersViewIcon,
  name: Messages.MARKERS_PANEL_TITLE_PROBLEMS,
  canToggleVisibility: true,
  canMoveView: true,
  ctorDescriptor: new SyncDescriptor(MarkersView),
  openCommandActionDescriptor: {
    id: "workbench.actions.view.problems",
    mnemonicTitle: localize({ key: "miMarker", comment: ["&& denotes a mnemonic"] }, "&&Problems"),
    keybindings: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyM },
    order: 0
  }
}], VIEW_CONTAINER);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: `workbench.actions.table.${Markers.MARKERS_VIEW_ID}.viewAsTree`,
      title: localize("viewAsTree", "View as Tree"),
      metadata: {
        description: localize2("viewAsTreeDescription", "Show the problems view as a tree.")
      },
      menu: {
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Table)),
        group: "navigation",
        order: 3
      },
      icon: Codicon.listTree,
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, view) {
    view.setViewMode(MarkersViewMode.Tree);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: `workbench.actions.table.${Markers.MARKERS_VIEW_ID}.viewAsTable`,
      title: localize("viewAsTable", "View as Table"),
      metadata: {
        description: localize2("viewAsTableDescription", "Show the problems view as a table.")
      },
      menu: {
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Tree)),
        group: "navigation",
        order: 3
      },
      icon: Codicon.listFlat,
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, view) {
    view.setViewMode(MarkersViewMode.Table);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleErrors`,
      title: localize("show errors", "Show Errors"),
      metadata: {
        description: localize2("toggleErrorsDescription", "Show or hide errors in the problems view.")
      },
      category: localize("problems", "Problems"),
      toggled: MarkersContextKeys.ShowErrorsFilterContextKey,
      menu: {
        id: viewFilterSubmenu,
        group: "1_filter",
        when: ContextKeyExpr.equals("view", Markers.MARKERS_VIEW_ID),
        order: 1
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, view) {
    view.filters.showErrors = !view.filters.showErrors;
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleWarnings`,
      title: localize("show warnings", "Show Warnings"),
      metadata: {
        description: localize2("toggleWarningsDescription", "Show or hide warnings in the problems view.")
      },
      category: localize("problems", "Problems"),
      toggled: MarkersContextKeys.ShowWarningsFilterContextKey,
      menu: {
        id: viewFilterSubmenu,
        group: "1_filter",
        when: ContextKeyExpr.equals("view", Markers.MARKERS_VIEW_ID),
        order: 2
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, view) {
    view.filters.showWarnings = !view.filters.showWarnings;
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleInfos`,
      title: localize("show infos", "Show Infos"),
      category: localize("problems", "Problems"),
      toggled: MarkersContextKeys.ShowInfoFilterContextKey,
      metadata: {
        description: localize2("toggleInfosDescription", "Show or hide infos in the problems view.")
      },
      menu: {
        id: viewFilterSubmenu,
        group: "1_filter",
        when: ContextKeyExpr.equals("view", Markers.MARKERS_VIEW_ID),
        order: 3
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, view) {
    view.filters.showInfos = !view.filters.showInfos;
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleActiveFile`,
      title: localize("show active file", "Show Active File Only"),
      metadata: {
        description: localize2("toggleActiveFileDescription", "Show or hide problems (errors, warnings, info) only from the active file in the problems view.")
      },
      category: localize("problems", "Problems"),
      toggled: MarkersContextKeys.ShowActiveFileFilterContextKey,
      menu: {
        id: viewFilterSubmenu,
        group: "2_filter",
        when: ContextKeyExpr.equals("view", Markers.MARKERS_VIEW_ID),
        order: 1
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, view) {
    view.filters.activeFile = !view.filters.activeFile;
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleExcludedFiles`,
      title: localize("show excluded files", "Show Excluded Files"),
      metadata: {
        description: localize2("toggleExcludedFilesDescription", "Show or hide excluded files in the problems view.")
      },
      category: localize("problems", "Problems"),
      toggled: MarkersContextKeys.ShowExcludedFilesFilterContextKey.negate(),
      menu: {
        id: viewFilterSubmenu,
        group: "2_filter",
        when: ContextKeyExpr.equals("view", Markers.MARKERS_VIEW_ID),
        order: 2
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, view) {
    view.filters.excludedFiles = !view.filters.excludedFiles;
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.problems.focus",
      title: Messages.MARKERS_PANEL_SHOW_LABEL,
      category: Categories.View,
      f1: true
    });
  }
  async run(accessor) {
    accessor.get(IViewsService).openView(Markers.MARKERS_VIEW_ID, true);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    const when = ContextKeyExpr.and(FocusedViewContext.isEqualTo(Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersTreeVisibilityContextKey, MarkersContextKeys.RelatedInformationFocusContextKey.toNegated());
    super({
      id: Markers.MARKER_COPY_ACTION_ID,
      title: localize2("copyMarker", "Copy"),
      menu: {
        id: MenuId.ProblemsPanelContext,
        when,
        group: "navigation"
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyC,
        when
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, markersView) {
    const clipboardService = serviceAccessor.get(IClipboardService);
    const selection = markersView.getFocusedSelectedElements() || markersView.getAllResourceMarkers();
    const markers = [];
    const addMarker = (marker) => {
      if (!markers.includes(marker)) {
        markers.push(marker);
      }
    };
    for (const selected of selection) {
      if (selected instanceof ResourceMarkers) {
        selected.markers.forEach(addMarker);
      } else if (selected instanceof Marker) {
        addMarker(selected);
      }
    }
    if (markers.length) {
      await clipboardService.writeText(`[${markers}]`);
    }
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: Markers.MARKER_COPY_MESSAGE_ACTION_ID,
      title: localize2("copyMessage", "Copy Message"),
      menu: {
        id: MenuId.ProblemsPanelContext,
        when: MarkersContextKeys.MarkerFocusContextKey,
        group: "navigation"
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, markersView) {
    const clipboardService = serviceAccessor.get(IClipboardService);
    const element = markersView.getFocusElement();
    if (element instanceof Marker) {
      await clipboardService.writeText(element.marker.message);
    }
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: Markers.RELATED_INFORMATION_COPY_MESSAGE_ACTION_ID,
      title: localize2("copyMessage", "Copy Message"),
      menu: {
        id: MenuId.ProblemsPanelContext,
        when: MarkersContextKeys.RelatedInformationFocusContextKey,
        group: "navigation"
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, markersView) {
    const clipboardService = serviceAccessor.get(IClipboardService);
    const element = markersView.getFocusElement();
    if (element instanceof RelatedInformation) {
      await clipboardService.writeText(element.raw.message);
    }
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: Markers.FOCUS_PROBLEMS_FROM_FILTER,
      title: localize("focusProblemsList", "Focus problems view"),
      keybinding: {
        when: MarkersContextKeys.MarkerViewFilterFocusContextKey,
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.DownArrow
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, markersView) {
    markersView.focus();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: Markers.MARKERS_VIEW_FOCUS_FILTER,
      title: localize("focusProblemsFilter", "Focus problems filter"),
      keybinding: {
        when: FocusedViewContext.isEqualTo(Markers.MARKERS_VIEW_ID),
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyF
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, markersView) {
    markersView.focusFilter();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: Markers.MARKERS_VIEW_SHOW_MULTILINE_MESSAGE,
      title: localize2("show multiline", "Show message in multiple lines"),
      category: localize("problems", "Problems"),
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.has(getVisbileViewContextKey(Markers.MARKERS_VIEW_ID))
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, markersView) {
    markersView.setMultiline(true);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: Markers.MARKERS_VIEW_SHOW_SINGLELINE_MESSAGE,
      title: localize2("show singleline", "Show message in single line"),
      category: localize("problems", "Problems"),
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.has(getVisbileViewContextKey(Markers.MARKERS_VIEW_ID))
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, markersView) {
    markersView.setMultiline(false);
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: Markers.MARKERS_VIEW_CLEAR_FILTER_TEXT,
      title: localize("clearFiltersText", "Clear filters text"),
      category: localize("problems", "Problems"),
      keybinding: {
        when: MarkersContextKeys.MarkerViewFilterFocusContextKey,
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyCode.Escape
      },
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, markersView) {
    markersView.clearFilterText();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: `workbench.actions.treeView.${Markers.MARKERS_VIEW_ID}.collapseAll`,
      title: localize("collapseAll", "Collapse All"),
      menu: {
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("view", Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Tree)),
        group: "navigation",
        order: 2
      },
      icon: Codicon.collapseAll,
      viewId: Markers.MARKERS_VIEW_ID
    });
  }
  async runInView(serviceAccessor, view) {
    return view.collapseAll();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: Markers.TOGGLE_MARKERS_VIEW_ACTION_ID,
      title: Messages.MARKERS_PANEL_TOGGLE_LABEL
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    if (viewsService.isViewVisible(Markers.MARKERS_VIEW_ID)) {
      viewsService.closeView(Markers.MARKERS_VIEW_ID);
    } else {
      viewsService.openView(Markers.MARKERS_VIEW_ID, true);
    }
  }
});
let MarkersStatusBarContributions = class extends Disposable {
  constructor(markerService, statusbarService, configurationService) {
    super();
    this.markerService = markerService;
    this.statusbarService = statusbarService;
    this.configurationService = configurationService;
    this.markersStatusItem = this._register(this.statusbarService.addEntry(
      this.getMarkersItem(),
      "status.problems",
      StatusbarAlignment.LEFT,
      50
      /* Medium Priority */
    ));
    const addStatusBarEntry = () => {
      this.markersStatusItemOff = this.statusbarService.addEntry(this.getMarkersItemTurnedOff(), "status.problemsVisibility", StatusbarAlignment.LEFT, 49);
    };
    let config = this.configurationService.getValue("problems.visibility");
    if (!config) {
      addStatusBarEntry();
    }
    this._register(this.markerService.onMarkerChanged(() => {
      this.markersStatusItem.update(this.getMarkersItem());
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("problems.visibility")) {
        this.markersStatusItem.update(this.getMarkersItem());
        config = this.configurationService.getValue("problems.visibility");
        if (!config && !this.markersStatusItemOff) {
          addStatusBarEntry();
        } else if (config && this.markersStatusItemOff) {
          this.markersStatusItemOff.dispose();
          this.markersStatusItemOff = void 0;
        }
      }
    }));
  }
  getMarkersItem() {
    const markersStatistics = this.markerService.getStatistics();
    const tooltip = this.getMarkersTooltip(markersStatistics);
    return {
      name: localize("status.problems", "Problems"),
      text: this.getMarkersText(markersStatistics),
      ariaLabel: tooltip,
      tooltip,
      command: "workbench.actions.view.toggleProblems"
    };
  }
  getMarkersItemTurnedOff() {
    this.statusbarService.updateEntryVisibility("status.problemsVisibility", true);
    const openSettingsCommand = "workbench.action.openSettings";
    const configureSettingsLabel = "@id:problems.visibility";
    const tooltip = localize("status.problemsVisibilityOff", "Problems are turned off. Click to open settings.");
    return {
      name: localize("status.problemsVisibility", "Problems Visibility"),
      text: "$(whole-word)",
      ariaLabel: tooltip,
      tooltip,
      kind: "warning",
      command: { title: openSettingsCommand, arguments: [configureSettingsLabel], id: openSettingsCommand }
    };
  }
  getMarkersTooltip(stats) {
    const errorTitle = (n) => localize("totalErrors", "Errors: {0}", n);
    const warningTitle = (n) => localize("totalWarnings", "Warnings: {0}", n);
    const infoTitle = (n) => localize("totalInfos", "Infos: {0}", n);
    const titles = [];
    if (stats.errors > 0) {
      titles.push(errorTitle(stats.errors));
    }
    if (stats.warnings > 0) {
      titles.push(warningTitle(stats.warnings));
    }
    if (stats.infos > 0) {
      titles.push(infoTitle(stats.infos));
    }
    if (titles.length === 0) {
      return localize("noProblems", "No Problems");
    }
    return titles.join(", ");
  }
  getMarkersText(stats) {
    const problemsText = [];
    problemsText.push("$(error) " + this.packNumber(stats.errors));
    problemsText.push("$(warning) " + this.packNumber(stats.warnings));
    if (stats.infos > 0) {
      problemsText.push("$(info) " + this.packNumber(stats.infos));
    }
    return problemsText.join(" ");
  }
  packNumber(n) {
    const manyProblems = localize("manyProblems", "10K+");
    return n > 9999 ? manyProblems : n > 999 ? n.toString().charAt(0) + "K" : n.toString();
  }
};
MarkersStatusBarContributions = __decorateClass([
  __decorateParam(0, IMarkerService),
  __decorateParam(1, IStatusbarService),
  __decorateParam(2, IConfigurationService)
], MarkersStatusBarContributions);
workbenchRegistry.registerWorkbenchContribution(MarkersStatusBarContributions, LifecyclePhase.Restored);
let ActivityUpdater = class extends Disposable {
  constructor(activityService, markerService) {
    super();
    this.activityService = activityService;
    this.markerService = markerService;
    this.activity = this._register(new MutableDisposable());
    this._register(this.markerService.onMarkerChanged(() => this.updateBadge()));
    this.updateBadge();
  }
  updateBadge() {
    const { errors, warnings, infos } = this.markerService.getStatistics();
    const total = errors + warnings + infos;
    if (total > 0) {
      const message = localize("totalProblems", "Total {0} Problems", total);
      this.activity.value = this.activityService.showViewActivity(Markers.MARKERS_VIEW_ID, { badge: new NumberBadge(total, () => message) });
    } else {
      this.activity.value = void 0;
    }
  }
};
ActivityUpdater = __decorateClass([
  __decorateParam(0, IActivityService),
  __decorateParam(1, IMarkerService)
], ActivityUpdater);
workbenchRegistry.registerWorkbenchContribution(ActivityUpdater, LifecyclePhase.Restored);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZXJzL2Jyb3dzZXIvbWFya2Vycy5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWFya2Vyc0ZpbGVEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWFya2VyLCBSZWxhdGVkSW5mb3JtYXRpb24sIFJlc291cmNlTWFya2VycyB9IGZyb20gJy4vbWFya2Vyc01vZGVsLmpzJztcbmltcG9ydCB7IE1hcmtlcnNWaWV3IH0gZnJvbSAnLi9tYXJrZXJzVmlldy5qcyc7XG5pbXBvcnQgeyBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiwgQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgTWFya2Vyc1ZpZXdNb2RlLCBNYXJrZXJzLCBNYXJrZXJzQ29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgTWVzc2FnZXMgZnJvbSAnLi9tZXNzYWdlcy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTWFya2Vyc1ZpZXcgfSBmcm9tICcuL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVN0YXR1c2JhckVudHJ5QWNjZXNzb3IsIElTdGF0dXNiYXJTZXJ2aWNlLCBTdGF0dXNiYXJBbGlnbm1lbnQsIElTdGF0dXNiYXJFbnRyeSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3N0YXR1c2Jhci9icm93c2VyL3N0YXR1c2Jhci5qcyc7XG5pbXBvcnQgeyBJTWFya2VyU2VydmljZSwgTWFya2VyU3RhdGlzdGljcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRhaW5lciwgSVZpZXdDb250YWluZXJzUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgVmlld0NvbnRhaW5lckV4dGVuc2lvbnMsIFZpZXdDb250YWluZXJMb2NhdGlvbiwgSVZpZXdzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0VmlzYmlsZVZpZXdDb250ZXh0S2V5LCBGb2N1c2VkVmlld0NvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lQ29udGFpbmVyLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgVmlld0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSwgTnVtYmVyQmFkZ2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hY3Rpdml0eS9jb21tb24vYWN0aXZpdHkuanMnO1xuaW1wb3J0IHsgdmlld0ZpbHRlclN1Ym1lbnUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdGaWx0ZXIuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBwcm9ibGVtc0NvbmZpZ3VyYXRpb25Ob2RlQmFzZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBNYXJrZXJzLk1BUktFUl9PUEVOX0FDVElPTl9JRCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChNYXJrZXJzQ29udGV4dEtleXMuTWFya2VyRm9jdXNDb250ZXh0S2V5KSxcblx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0bWFjOiB7XG5cdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93XVxuXHR9LFxuXHRoYW5kbGVyOiAoYWNjZXNzb3IsIGFyZ3M6IGFueSkgPT4ge1xuXHRcdGNvbnN0IG1hcmtlcnNWaWV3ID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpLmdldEFjdGl2ZVZpZXdXaXRoSWQ8TWFya2Vyc1ZpZXc+KE1hcmtlcnMuTUFSS0VSU19WSUVXX0lEKSE7XG5cdFx0bWFya2Vyc1ZpZXcub3BlbkZpbGVBdEVsZW1lbnQobWFya2Vyc1ZpZXcuZ2V0Rm9jdXNFbGVtZW50KCksIGZhbHNlLCBmYWxzZSwgdHJ1ZSk7XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IE1hcmtlcnMuTUFSS0VSX09QRU5fU0lERV9BQ1RJT05fSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoTWFya2Vyc0NvbnRleHRLZXlzLk1hcmtlckZvY3VzQ29udGV4dEtleSksXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FbnRlcixcblx0bWFjOiB7XG5cdFx0cHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLkVudGVyXG5cdH0sXG5cdGhhbmRsZXI6IChhY2Nlc3NvciwgYXJnczogYW55KSA9PiB7XG5cdFx0Y29uc3QgbWFya2Vyc1ZpZXcgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkuZ2V0QWN0aXZlVmlld1dpdGhJZDxNYXJrZXJzVmlldz4oTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpITtcblx0XHRtYXJrZXJzVmlldy5vcGVuRmlsZUF0RWxlbWVudChtYXJrZXJzVmlldy5nZXRGb2N1c0VsZW1lbnQoKSwgZmFsc2UsIHRydWUsIHRydWUpO1xuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBNYXJrZXJzLk1BUktFUl9TSE9XX1BBTkVMX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0d2hlbjogdW5kZWZpbmVkLFxuXHRwcmltYXJ5OiB1bmRlZmluZWQsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgYXJnczogYW55KSA9PiB7XG5cdFx0YXdhaXQgYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpLm9wZW5WaWV3KE1hcmtlcnMuTUFSS0VSU19WSUVXX0lEKTtcblx0fVxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogTWFya2Vycy5NQVJLRVJfU0hPV19RVUlDS19GSVgsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHR3aGVuOiBNYXJrZXJzQ29udGV4dEtleXMuTWFya2VyRm9jdXNDb250ZXh0S2V5LFxuXHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuUGVyaW9kLFxuXHRoYW5kbGVyOiAoYWNjZXNzb3IsIGFyZ3M6IGFueSkgPT4ge1xuXHRcdGNvbnN0IG1hcmtlcnNWaWV3ID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpLmdldEFjdGl2ZVZpZXdXaXRoSWQ8TWFya2Vyc1ZpZXc+KE1hcmtlcnMuTUFSS0VSU19WSUVXX0lEKSE7XG5cdFx0Y29uc3QgZm9jdXNlZEVsZW1lbnQgPSBtYXJrZXJzVmlldy5nZXRGb2N1c0VsZW1lbnQoKTtcblx0XHRpZiAoZm9jdXNlZEVsZW1lbnQgaW5zdGFuY2VvZiBNYXJrZXIpIHtcblx0XHRcdG1hcmtlcnNWaWV3LnNob3dRdWlja0ZpeGVzKGZvY3VzZWRFbGVtZW50KTtcblx0XHR9XG5cdH1cbn0pO1xuXG4vLyBjb25maWd1cmF0aW9uXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdC4uLnByb2JsZW1zQ29uZmlndXJhdGlvbk5vZGVCYXNlLFxuXHQncHJvcGVydGllcyc6IHtcblx0XHQncHJvYmxlbXMuYXV0b1JldmVhbCc6IHtcblx0XHRcdCdkZXNjcmlwdGlvbic6IE1lc3NhZ2VzLlBST0JMRU1TX1BBTkVMX0NPTkZJR1VSQVRJT05fQVVUT19SRVZFQUwsXG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZWZhdWx0JzogdHJ1ZVxuXHRcdH0sXG5cdFx0J3Byb2JsZW1zLmRlZmF1bHRWaWV3TW9kZSc6IHtcblx0XHRcdCdkZXNjcmlwdGlvbic6IE1lc3NhZ2VzLlBST0JMRU1TX1BBTkVMX0NPTkZJR1VSQVRJT05fVklFV19NT0RFLFxuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdCdkZWZhdWx0JzogJ3RyZWUnLFxuXHRcdFx0J2VudW0nOiBbJ3RhYmxlJywgJ3RyZWUnXSxcblx0XHR9LFxuXHRcdCdwcm9ibGVtcy5zaG93Q3VycmVudEluU3RhdHVzJzoge1xuXHRcdFx0J2Rlc2NyaXB0aW9uJzogTWVzc2FnZXMuUFJPQkxFTVNfUEFORUxfQ09ORklHVVJBVElPTl9TSE9XX0NVUlJFTlRfU1RBVFVTLFxuXHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHQnZGVmYXVsdCc6IGZhbHNlXG5cdFx0fSxcblx0XHQncHJvYmxlbXMuc29ydE9yZGVyJzoge1xuXHRcdFx0J2Rlc2NyaXB0aW9uJzogTWVzc2FnZXMuUFJPQkxFTVNfUEFORUxfQ09ORklHVVJBVElPTl9DT01QQVJFX09SREVSLFxuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdCdkZWZhdWx0JzogJ3NldmVyaXR5Jyxcblx0XHRcdCdlbnVtJzogWydzZXZlcml0eScsICdwb3NpdGlvbiddLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdE1lc3NhZ2VzLlBST0JMRU1TX1BBTkVMX0NPTkZJR1VSQVRJT05fQ09NUEFSRV9PUkRFUl9TRVZFUklUWSxcblx0XHRcdFx0TWVzc2FnZXMuUFJPQkxFTVNfUEFORUxfQ09ORklHVVJBVElPTl9DT01QQVJFX09SREVSX1BPU0lUSU9OLFxuXHRcdFx0XSxcblx0XHR9LFxuXHR9XG59KTtcblxuY29uc3QgbWFya2Vyc1ZpZXdJY29uID0gcmVnaXN0ZXJJY29uKCdtYXJrZXJzLXZpZXctaWNvbicsIENvZGljb24ud2FybmluZywgbG9jYWxpemUoJ21hcmtlcnNWaWV3SWNvbicsICdWaWV3IGljb24gb2YgdGhlIG1hcmtlcnMgdmlldy4nKSk7XG5cbi8vIG1hcmtlcnMgdmlldyBjb250YWluZXJcbmNvbnN0IFZJRVdfQ09OVEFJTkVSOiBWaWV3Q29udGFpbmVyID0gUmVnaXN0cnkuYXM8SVZpZXdDb250YWluZXJzUmVnaXN0cnk+KFZpZXdDb250YWluZXJFeHRlbnNpb25zLlZpZXdDb250YWluZXJzUmVnaXN0cnkpLnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7XG5cdGlkOiBNYXJrZXJzLk1BUktFUlNfQ09OVEFJTkVSX0lELFxuXHR0aXRsZTogTWVzc2FnZXMuTUFSS0VSU19QQU5FTF9USVRMRV9QUk9CTEVNUyxcblx0aWNvbjogbWFya2Vyc1ZpZXdJY29uLFxuXHRoaWRlSWZFbXB0eTogdHJ1ZSxcblx0b3JkZXI6IDAsXG5cdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoVmlld1BhbmVDb250YWluZXIsIFtNYXJrZXJzLk1BUktFUlNfQ09OVEFJTkVSX0lELCB7IG1lcmdlVmlld1dpdGhDb250YWluZXJXaGVuU2luZ2xlVmlldzogdHJ1ZSB9XSksXG5cdHN0b3JhZ2VJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfU1RPUkFHRV9JRCxcbn0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCwgeyBkb05vdFJlZ2lzdGVyT3BlbkNvbW1hbmQ6IHRydWUgfSk7XG5cblJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdzKFt7XG5cdGlkOiBNYXJrZXJzLk1BUktFUlNfVklFV19JRCxcblx0Y29udGFpbmVySWNvbjogbWFya2Vyc1ZpZXdJY29uLFxuXHRuYW1lOiBNZXNzYWdlcy5NQVJLRVJTX1BBTkVMX1RJVExFX1BST0JMRU1TLFxuXHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlLFxuXHRjYW5Nb3ZlVmlldzogdHJ1ZSxcblx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihNYXJrZXJzVmlldyksXG5cdG9wZW5Db21tYW5kQWN0aW9uRGVzY3JpcHRvcjoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbnMudmlldy5wcm9ibGVtcycsXG5cdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaU1hcmtlcicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlByb2JsZW1zXCIpLFxuXHRcdGtleWJpbmRpbmdzOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlNIH0sXG5cdFx0b3JkZXI6IDAsXG5cdH1cbn1dLCBWSUVXX0NPTlRBSU5FUik7XG5cbi8vIHdvcmtiZW5jaFxuY29uc3Qgd29ya2JlbmNoUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLldvcmtiZW5jaCk7XG5cbi8vIGFjdGlvbnNcbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248SU1hcmtlcnNWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMudGFibGUuJHtNYXJrZXJzLk1BUktFUlNfVklFV19JRH0udmlld0FzVHJlZWAsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3ZpZXdBc1RyZWUnLCBcIlZpZXcgYXMgVHJlZVwiKSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ3ZpZXdBc1RyZWVEZXNjcmlwdGlvbicsIFwiU2hvdyB0aGUgcHJvYmxlbXMgdmlldyBhcyBhIHRyZWUuXCIpXG5cdFx0XHR9LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE1hcmtlcnMuTUFSS0VSU19WSUVXX0lEKSwgTWFya2Vyc0NvbnRleHRLZXlzLk1hcmtlcnNWaWV3TW9kZUNvbnRleHRLZXkuaXNFcXVhbFRvKE1hcmtlcnNWaWV3TW9kZS5UYWJsZSkpLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogM1xuXHRcdFx0fSxcblx0XHRcdGljb246IENvZGljb24ubGlzdFRyZWUsXG5cdFx0XHR2aWV3SWQ6IE1hcmtlcnMuTUFSS0VSU19WSUVXX0lEXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5JblZpZXcoc2VydmljZUFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3OiBJTWFya2Vyc1ZpZXcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR2aWV3LnNldFZpZXdNb2RlKE1hcmtlcnNWaWV3TW9kZS5UcmVlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248SU1hcmtlcnNWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMudGFibGUuJHtNYXJrZXJzLk1BUktFUlNfVklFV19JRH0udmlld0FzVGFibGVgLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCd2aWV3QXNUYWJsZScsIFwiVmlldyBhcyBUYWJsZVwiKSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ3ZpZXdBc1RhYmxlRGVzY3JpcHRpb24nLCBcIlNob3cgdGhlIHByb2JsZW1zIHZpZXcgYXMgYSB0YWJsZS5cIilcblx0XHRcdH0sXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpLCBNYXJrZXJzQ29udGV4dEtleXMuTWFya2Vyc1ZpZXdNb2RlQ29udGV4dEtleS5pc0VxdWFsVG8oTWFya2Vyc1ZpZXdNb2RlLlRyZWUpKSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdH0sXG5cdFx0XHRpY29uOiBDb2RpY29uLmxpc3RGbGF0LFxuXHRcdFx0dmlld0lkOiBNYXJrZXJzLk1BUktFUlNfVklFV19JRFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5WaWV3KHNlcnZpY2VBY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogSU1hcmtlcnNWaWV3KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dmlldy5zZXRWaWV3TW9kZShNYXJrZXJzVmlld01vZGUuVGFibGUpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9ucy4ke01hcmtlcnMuTUFSS0VSU19WSUVXX0lEfS50b2dnbGVFcnJvcnNgLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzaG93IGVycm9ycycsIFwiU2hvdyBFcnJvcnNcIiksXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUyKCd0b2dnbGVFcnJvcnNEZXNjcmlwdGlvbicsIFwiU2hvdyBvciBoaWRlIGVycm9ycyBpbiB0aGUgcHJvYmxlbXMgdmlldy5cIilcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogbG9jYWxpemUoJ3Byb2JsZW1zJywgXCJQcm9ibGVtc1wiKSxcblx0XHRcdHRvZ2dsZWQ6IE1hcmtlcnNDb250ZXh0S2V5cy5TaG93RXJyb3JzRmlsdGVyQ29udGV4dEtleSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IHZpZXdGaWx0ZXJTdWJtZW51LFxuXHRcdFx0XHRncm91cDogJzFfZmlsdGVyJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElNYXJrZXJzVmlldyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcuZmlsdGVycy5zaG93RXJyb3JzID0gIXZpZXcuZmlsdGVycy5zaG93RXJyb3JzO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9ucy4ke01hcmtlcnMuTUFSS0VSU19WSUVXX0lEfS50b2dnbGVXYXJuaW5nc2AsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3Nob3cgd2FybmluZ3MnLCBcIlNob3cgV2FybmluZ3NcIiksXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUyKCd0b2dnbGVXYXJuaW5nc0Rlc2NyaXB0aW9uJywgXCJTaG93IG9yIGhpZGUgd2FybmluZ3MgaW4gdGhlIHByb2JsZW1zIHZpZXcuXCIpXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IGxvY2FsaXplKCdwcm9ibGVtcycsIFwiUHJvYmxlbXNcIiksXG5cdFx0XHR0b2dnbGVkOiBNYXJrZXJzQ29udGV4dEtleXMuU2hvd1dhcm5pbmdzRmlsdGVyQ29udGV4dEtleSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IHZpZXdGaWx0ZXJTdWJtZW51LFxuXHRcdFx0XHRncm91cDogJzFfZmlsdGVyJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElNYXJrZXJzVmlldyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcuZmlsdGVycy5zaG93V2FybmluZ3MgPSAhdmlldy5maWx0ZXJzLnNob3dXYXJuaW5ncztcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248SU1hcmtlcnNWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMuJHtNYXJrZXJzLk1BUktFUlNfVklFV19JRH0udG9nZ2xlSW5mb3NgLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzaG93IGluZm9zJywgXCJTaG93IEluZm9zXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IGxvY2FsaXplKCdwcm9ibGVtcycsIFwiUHJvYmxlbXNcIiksXG5cdFx0XHR0b2dnbGVkOiBNYXJrZXJzQ29udGV4dEtleXMuU2hvd0luZm9GaWx0ZXJDb250ZXh0S2V5LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplMigndG9nZ2xlSW5mb3NEZXNjcmlwdGlvbicsIFwiU2hvdyBvciBoaWRlIGluZm9zIGluIHRoZSBwcm9ibGVtcyB2aWV3LlwiKVxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IHZpZXdGaWx0ZXJTdWJtZW51LFxuXHRcdFx0XHRncm91cDogJzFfZmlsdGVyJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpLFxuXHRcdFx0XHRvcmRlcjogM1xuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElNYXJrZXJzVmlldyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcuZmlsdGVycy5zaG93SW5mb3MgPSAhdmlldy5maWx0ZXJzLnNob3dJbmZvcztcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248SU1hcmtlcnNWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMuJHtNYXJrZXJzLk1BUktFUlNfVklFV19JRH0udG9nZ2xlQWN0aXZlRmlsZWAsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3Nob3cgYWN0aXZlIGZpbGUnLCBcIlNob3cgQWN0aXZlIEZpbGUgT25seVwiKSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ3RvZ2dsZUFjdGl2ZUZpbGVEZXNjcmlwdGlvbicsIFwiU2hvdyBvciBoaWRlIHByb2JsZW1zIChlcnJvcnMsIHdhcm5pbmdzLCBpbmZvKSBvbmx5IGZyb20gdGhlIGFjdGl2ZSBmaWxlIGluIHRoZSBwcm9ibGVtcyB2aWV3LlwiKVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBsb2NhbGl6ZSgncHJvYmxlbXMnLCBcIlByb2JsZW1zXCIpLFxuXHRcdFx0dG9nZ2xlZDogTWFya2Vyc0NvbnRleHRLZXlzLlNob3dBY3RpdmVGaWxlRmlsdGVyQ29udGV4dEtleSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IHZpZXdGaWx0ZXJTdWJtZW51LFxuXHRcdFx0XHRncm91cDogJzJfZmlsdGVyJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElNYXJrZXJzVmlldyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcuZmlsdGVycy5hY3RpdmVGaWxlID0gIXZpZXcuZmlsdGVycy5hY3RpdmVGaWxlO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9ucy4ke01hcmtlcnMuTUFSS0VSU19WSUVXX0lEfS50b2dnbGVFeGNsdWRlZEZpbGVzYCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2hvdyBleGNsdWRlZCBmaWxlcycsIFwiU2hvdyBFeGNsdWRlZCBGaWxlc1wiKSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ3RvZ2dsZUV4Y2x1ZGVkRmlsZXNEZXNjcmlwdGlvbicsIFwiU2hvdyBvciBoaWRlIGV4Y2x1ZGVkIGZpbGVzIGluIHRoZSBwcm9ibGVtcyB2aWV3LlwiKVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBsb2NhbGl6ZSgncHJvYmxlbXMnLCBcIlByb2JsZW1zXCIpLFxuXHRcdFx0dG9nZ2xlZDogTWFya2Vyc0NvbnRleHRLZXlzLlNob3dFeGNsdWRlZEZpbGVzRmlsdGVyQ29udGV4dEtleS5uZWdhdGUoKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IHZpZXdGaWx0ZXJTdWJtZW51LFxuXHRcdFx0XHRncm91cDogJzJfZmlsdGVyJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElNYXJrZXJzVmlldyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcuZmlsdGVycy5leGNsdWRlZEZpbGVzID0gIXZpZXcuZmlsdGVycy5leGNsdWRlZEZpbGVzO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5wcm9ibGVtcy5mb2N1cycsXG5cdFx0XHR0aXRsZTogTWVzc2FnZXMuTUFSS0VSU19QQU5FTF9TSE9XX0xBQkVMLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKS5vcGVuVmlldyhNYXJrZXJzLk1BUktFUlNfVklFV19JRCwgdHJ1ZSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBWaWV3QWN0aW9uPElNYXJrZXJzVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCB3aGVuID0gQ29udGV4dEtleUV4cHIuYW5kKEZvY3VzZWRWaWV3Q29udGV4dC5pc0VxdWFsVG8oTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpLCBNYXJrZXJzQ29udGV4dEtleXMuTWFya2Vyc1RyZWVWaXNpYmlsaXR5Q29udGV4dEtleSwgTWFya2Vyc0NvbnRleHRLZXlzLlJlbGF0ZWRJbmZvcm1hdGlvbkZvY3VzQ29udGV4dEtleS50b05lZ2F0ZWQoKSk7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hcmtlcnMuTUFSS0VSX0NPUFlfQUNUSU9OX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY29weU1hcmtlcicsICdDb3B5JyksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuUHJvYmxlbXNQYW5lbENvbnRleHQsXG5cdFx0XHRcdHdoZW4sXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbidcblx0XHRcdH0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Qyxcblx0XHRcdFx0d2hlblxuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW5JblZpZXcoc2VydmljZUFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBtYXJrZXJzVmlldzogSU1hcmtlcnNWaWV3KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IHNlcnZpY2VBY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IG1hcmtlcnNWaWV3LmdldEZvY3VzZWRTZWxlY3RlZEVsZW1lbnRzKCkgfHwgbWFya2Vyc1ZpZXcuZ2V0QWxsUmVzb3VyY2VNYXJrZXJzKCk7XG5cdFx0Y29uc3QgbWFya2VyczogTWFya2VyW10gPSBbXTtcblx0XHRjb25zdCBhZGRNYXJrZXIgPSAobWFya2VyOiBNYXJrZXIpID0+IHtcblx0XHRcdGlmICghbWFya2Vycy5pbmNsdWRlcyhtYXJrZXIpKSB7XG5cdFx0XHRcdG1hcmtlcnMucHVzaChtYXJrZXIpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Zm9yIChjb25zdCBzZWxlY3RlZCBvZiBzZWxlY3Rpb24pIHtcblx0XHRcdGlmIChzZWxlY3RlZCBpbnN0YW5jZW9mIFJlc291cmNlTWFya2Vycykge1xuXHRcdFx0XHRzZWxlY3RlZC5tYXJrZXJzLmZvckVhY2goYWRkTWFya2VyKTtcblx0XHRcdH0gZWxzZSBpZiAoc2VsZWN0ZWQgaW5zdGFuY2VvZiBNYXJrZXIpIHtcblx0XHRcdFx0YWRkTWFya2VyKHNlbGVjdGVkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKG1hcmtlcnMubGVuZ3RoKSB7XG5cdFx0XHRhd2FpdCBjbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dChgWyR7bWFya2Vyc31dYCk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hcmtlcnMuTUFSS0VSX0NPUFlfTUVTU0FHRV9BQ1RJT05fSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjb3B5TWVzc2FnZScsICdDb3B5IE1lc3NhZ2UnKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Qcm9ibGVtc1BhbmVsQ29udGV4dCxcblx0XHRcdFx0d2hlbjogTWFya2Vyc0NvbnRleHRLZXlzLk1hcmtlckZvY3VzQ29udGV4dEtleSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJ1xuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW5JblZpZXcoc2VydmljZUFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBtYXJrZXJzVmlldzogSU1hcmtlcnNWaWV3KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IHNlcnZpY2VBY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBtYXJrZXJzVmlldy5nZXRGb2N1c0VsZW1lbnQoKTtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIE1hcmtlcikge1xuXHRcdFx0YXdhaXQgY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoZWxlbWVudC5tYXJrZXIubWVzc2FnZSk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hcmtlcnMuUkVMQVRFRF9JTkZPUk1BVElPTl9DT1BZX01FU1NBR0VfQUNUSU9OX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY29weU1lc3NhZ2UnLCAnQ29weSBNZXNzYWdlJyksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuUHJvYmxlbXNQYW5lbENvbnRleHQsXG5cdFx0XHRcdHdoZW46IE1hcmtlcnNDb250ZXh0S2V5cy5SZWxhdGVkSW5mb3JtYXRpb25Gb2N1c0NvbnRleHRLZXksXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbidcblx0XHRcdH0sXG5cdFx0XHR2aWV3SWQ6IE1hcmtlcnMuTUFSS0VSU19WSUVXX0lEXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuSW5WaWV3KHNlcnZpY2VBY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgbWFya2Vyc1ZpZXc6IElNYXJrZXJzVmlldyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBzZXJ2aWNlQWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRjb25zdCBlbGVtZW50ID0gbWFya2Vyc1ZpZXcuZ2V0Rm9jdXNFbGVtZW50KCk7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZWxhdGVkSW5mb3JtYXRpb24pIHtcblx0XHRcdGF3YWl0IGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KGVsZW1lbnQucmF3Lm1lc3NhZ2UpO1xuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248SU1hcmtlcnNWaWV3PiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBNYXJrZXJzLkZPQ1VTX1BST0JMRU1TX0ZST01fRklMVEVSLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdmb2N1c1Byb2JsZW1zTGlzdCcsIFwiRm9jdXMgcHJvYmxlbXMgdmlld1wiKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogTWFya2Vyc0NvbnRleHRLZXlzLk1hcmtlclZpZXdGaWx0ZXJGb2N1c0NvbnRleHRLZXksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93XG5cdFx0XHR9LFxuXHRcdFx0dmlld0lkOiBNYXJrZXJzLk1BUktFUlNfVklFV19JRFxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG1hcmtlcnNWaWV3OiBJTWFya2Vyc1ZpZXcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRtYXJrZXJzVmlldy5mb2N1cygpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hcmtlcnMuTUFSS0VSU19WSUVXX0ZPQ1VTX0ZJTFRFUixcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZm9jdXNQcm9ibGVtc0ZpbHRlcicsIFwiRm9jdXMgcHJvYmxlbXMgZmlsdGVyXCIpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBGb2N1c2VkVmlld0NvbnRleHQuaXNFcXVhbFRvKE1hcmtlcnMuTUFSS0VSU19WSUVXX0lEKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlGXG5cdFx0XHR9LFxuXHRcdFx0dmlld0lkOiBNYXJrZXJzLk1BUktFUlNfVklFV19JRFxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG1hcmtlcnNWaWV3OiBJTWFya2Vyc1ZpZXcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRtYXJrZXJzVmlldy5mb2N1c0ZpbHRlcigpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hcmtlcnMuTUFSS0VSU19WSUVXX1NIT1dfTVVMVElMSU5FX01FU1NBR0UsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93IG11bHRpbGluZScsIFwiU2hvdyBtZXNzYWdlIGluIG11bHRpcGxlIGxpbmVzXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IGxvY2FsaXplKCdwcm9ibGVtcycsIFwiUHJvYmxlbXNcIiksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmhhcyhnZXRWaXNiaWxlVmlld0NvbnRleHRLZXkoTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpKVxuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW5JblZpZXcoc2VydmljZUFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBtYXJrZXJzVmlldzogSU1hcmtlcnNWaWV3KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bWFya2Vyc1ZpZXcuc2V0TXVsdGlsaW5lKHRydWUpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hcmtlcnMuTUFSS0VSU19WSUVXX1NIT1dfU0lOR0xFTElORV9NRVNTQUdFLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvdyBzaW5nbGVsaW5lJywgXCJTaG93IG1lc3NhZ2UgaW4gc2luZ2xlIGxpbmVcIiksXG5cdFx0XHRjYXRlZ29yeTogbG9jYWxpemUoJ3Byb2JsZW1zJywgXCJQcm9ibGVtc1wiKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuaGFzKGdldFZpc2JpbGVWaWV3Q29udGV4dEtleShNYXJrZXJzLk1BUktFUlNfVklFV19JRCkpXG5cdFx0XHR9LFxuXHRcdFx0dmlld0lkOiBNYXJrZXJzLk1BUktFUlNfVklFV19JRFxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG1hcmtlcnNWaWV3OiBJTWFya2Vyc1ZpZXcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRtYXJrZXJzVmlldy5zZXRNdWx0aWxpbmUoZmFsc2UpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxJTWFya2Vyc1ZpZXc+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hcmtlcnMuTUFSS0VSU19WSUVXX0NMRUFSX0ZJTFRFUl9URVhULFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjbGVhckZpbHRlcnNUZXh0JywgXCJDbGVhciBmaWx0ZXJzIHRleHRcIiksXG5cdFx0XHRjYXRlZ29yeTogbG9jYWxpemUoJ3Byb2JsZW1zJywgXCJQcm9ibGVtc1wiKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogTWFya2Vyc0NvbnRleHRLZXlzLk1hcmtlclZpZXdGaWx0ZXJGb2N1c0NvbnRleHRLZXksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZVxuXHRcdFx0fSxcblx0XHRcdHZpZXdJZDogTWFya2Vycy5NQVJLRVJTX1ZJRVdfSURcblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW5JblZpZXcoc2VydmljZUFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBtYXJrZXJzVmlldzogSU1hcmtlcnNWaWV3KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bWFya2Vyc1ZpZXcuY2xlYXJGaWx0ZXJUZXh0KCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBWaWV3QWN0aW9uPElNYXJrZXJzVmlldz4ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb25zLnRyZWVWaWV3LiR7TWFya2Vycy5NQVJLRVJTX1ZJRVdfSUR9LmNvbGxhcHNlQWxsYCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY29sbGFwc2VBbGwnLCBcIkNvbGxhcHNlIEFsbFwiKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBNYXJrZXJzLk1BUktFUlNfVklFV19JRCksIE1hcmtlcnNDb250ZXh0S2V5cy5NYXJrZXJzVmlld01vZGVDb250ZXh0S2V5LmlzRXF1YWxUbyhNYXJrZXJzVmlld01vZGUuVHJlZSkpLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMixcblx0XHRcdH0sXG5cdFx0XHRpY29uOiBDb2RpY29uLmNvbGxhcHNlQWxsLFxuXHRcdFx0dmlld0lkOiBNYXJrZXJzLk1BUktFUlNfVklFV19JRFxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IElNYXJrZXJzVmlldyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB2aWV3LmNvbGxhcHNlQWxsKCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hcmtlcnMuVE9HR0xFX01BUktFUlNfVklFV19BQ1RJT05fSUQsXG5cdFx0XHR0aXRsZTogTWVzc2FnZXMuTUFSS0VSU19QQU5FTF9UT0dHTEVfTEFCRUwsXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRcdGlmICh2aWV3c1NlcnZpY2UuaXNWaWV3VmlzaWJsZShNYXJrZXJzLk1BUktFUlNfVklFV19JRCkpIHtcblx0XHRcdHZpZXdzU2VydmljZS5jbG9zZVZpZXcoTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2aWV3c1NlcnZpY2Uub3BlblZpZXcoTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQsIHRydWUpO1xuXHRcdH1cblx0fVxufSk7XG5cbmNsYXNzIE1hcmtlcnNTdGF0dXNCYXJDb250cmlidXRpb25zIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgbWFya2Vyc1N0YXR1c0l0ZW06IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yO1xuXHRwcml2YXRlIG1hcmtlcnNTdGF0dXNJdGVtT2ZmOiBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1hcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtYXJrZXJTZXJ2aWNlOiBJTWFya2VyU2VydmljZSxcblx0XHRASVN0YXR1c2JhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdGF0dXNiYXJTZXJ2aWNlOiBJU3RhdHVzYmFyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMubWFya2Vyc1N0YXR1c0l0ZW0gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLnN0YXR1c2JhclNlcnZpY2UuYWRkRW50cnkodGhpcy5nZXRNYXJrZXJzSXRlbSgpLCAnc3RhdHVzLnByb2JsZW1zJywgU3RhdHVzYmFyQWxpZ25tZW50LkxFRlQsIDUwIC8qIE1lZGl1bSBQcmlvcml0eSAqLykpO1xuXG5cdFx0Y29uc3QgYWRkU3RhdHVzQmFyRW50cnkgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLm1hcmtlcnNTdGF0dXNJdGVtT2ZmID0gdGhpcy5zdGF0dXNiYXJTZXJ2aWNlLmFkZEVudHJ5KHRoaXMuZ2V0TWFya2Vyc0l0ZW1UdXJuZWRPZmYoKSwgJ3N0YXR1cy5wcm9ibGVtc1Zpc2liaWxpdHknLCBTdGF0dXNiYXJBbGlnbm1lbnQuTEVGVCwgNDkpO1xuXHRcdH07XG5cblx0XHQvLyBBZGQgdGhlIHN0YXR1cyBiYXIgZW50cnkgaWYgdGhlIHByb2JsZW1zIGlzIG5vdCB2aXNpYmxlXG5cdFx0bGV0IGNvbmZpZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3Byb2JsZW1zLnZpc2liaWxpdHknKTtcblx0XHRpZiAoIWNvbmZpZykge1xuXHRcdFx0YWRkU3RhdHVzQmFyRW50cnkoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1hcmtlclNlcnZpY2Uub25NYXJrZXJDaGFuZ2VkKCgpID0+IHtcblx0XHRcdHRoaXMubWFya2Vyc1N0YXR1c0l0ZW0udXBkYXRlKHRoaXMuZ2V0TWFya2Vyc0l0ZW0oKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbigncHJvYmxlbXMudmlzaWJpbGl0eScpKSB7XG5cdFx0XHRcdHRoaXMubWFya2Vyc1N0YXR1c0l0ZW0udXBkYXRlKHRoaXMuZ2V0TWFya2Vyc0l0ZW0oKSk7XG5cblx0XHRcdFx0Ly8gVXBkYXRlIGJhc2VkIG9uIHdoYXQgc2V0dGluZyB3YXMgY2hhbmdlZCB0by5cblx0XHRcdFx0Y29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgncHJvYmxlbXMudmlzaWJpbGl0eScpO1xuXHRcdFx0XHRpZiAoIWNvbmZpZyAmJiAhdGhpcy5tYXJrZXJzU3RhdHVzSXRlbU9mZikge1xuXHRcdFx0XHRcdGFkZFN0YXR1c0JhckVudHJ5KCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY29uZmlnICYmIHRoaXMubWFya2Vyc1N0YXR1c0l0ZW1PZmYpIHtcblx0XHRcdFx0XHR0aGlzLm1hcmtlcnNTdGF0dXNJdGVtT2ZmLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0aGlzLm1hcmtlcnNTdGF0dXNJdGVtT2ZmID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRNYXJrZXJzSXRlbSgpOiBJU3RhdHVzYmFyRW50cnkge1xuXHRcdGNvbnN0IG1hcmtlcnNTdGF0aXN0aWNzID0gdGhpcy5tYXJrZXJTZXJ2aWNlLmdldFN0YXRpc3RpY3MoKTtcblx0XHRjb25zdCB0b29sdGlwID0gdGhpcy5nZXRNYXJrZXJzVG9vbHRpcChtYXJrZXJzU3RhdGlzdGljcyk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IGxvY2FsaXplKCdzdGF0dXMucHJvYmxlbXMnLCBcIlByb2JsZW1zXCIpLFxuXHRcdFx0dGV4dDogdGhpcy5nZXRNYXJrZXJzVGV4dChtYXJrZXJzU3RhdGlzdGljcyksXG5cdFx0XHRhcmlhTGFiZWw6IHRvb2x0aXAsXG5cdFx0XHR0b29sdGlwLFxuXHRcdFx0Y29tbWFuZDogJ3dvcmtiZW5jaC5hY3Rpb25zLnZpZXcudG9nZ2xlUHJvYmxlbXMnXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TWFya2Vyc0l0ZW1UdXJuZWRPZmYoKTogSVN0YXR1c2JhckVudHJ5IHtcblx0XHQvLyBVcGRhdGUgdG8gdHJ1ZSwgY29uZmlnIGNoZWNrZWQgYmVmb3JlIGBnZXRNYXJrZXJzSXRlbVR1cm5lZE9mZmAgaXMgY2FsbGVkLlxuXHRcdHRoaXMuc3RhdHVzYmFyU2VydmljZS51cGRhdGVFbnRyeVZpc2liaWxpdHkoJ3N0YXR1cy5wcm9ibGVtc1Zpc2liaWxpdHknLCB0cnVlKTtcblx0XHRjb25zdCBvcGVuU2V0dGluZ3NDb21tYW5kID0gJ3dvcmtiZW5jaC5hY3Rpb24ub3BlblNldHRpbmdzJztcblx0XHRjb25zdCBjb25maWd1cmVTZXR0aW5nc0xhYmVsID0gJ0BpZDpwcm9ibGVtcy52aXNpYmlsaXR5Jztcblx0XHRjb25zdCB0b29sdGlwID0gbG9jYWxpemUoJ3N0YXR1cy5wcm9ibGVtc1Zpc2liaWxpdHlPZmYnLCBcIlByb2JsZW1zIGFyZSB0dXJuZWQgb2ZmLiBDbGljayB0byBvcGVuIHNldHRpbmdzLlwiKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogbG9jYWxpemUoJ3N0YXR1cy5wcm9ibGVtc1Zpc2liaWxpdHknLCBcIlByb2JsZW1zIFZpc2liaWxpdHlcIiksXG5cdFx0XHR0ZXh0OiAnJCh3aG9sZS13b3JkKScsXG5cdFx0XHRhcmlhTGFiZWw6IHRvb2x0aXAsXG5cdFx0XHR0b29sdGlwLFxuXHRcdFx0a2luZDogJ3dhcm5pbmcnLFxuXHRcdFx0Y29tbWFuZDogeyB0aXRsZTogb3BlblNldHRpbmdzQ29tbWFuZCwgYXJndW1lbnRzOiBbY29uZmlndXJlU2V0dGluZ3NMYWJlbF0sIGlkOiBvcGVuU2V0dGluZ3NDb21tYW5kIH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRNYXJrZXJzVG9vbHRpcChzdGF0czogTWFya2VyU3RhdGlzdGljcyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgZXJyb3JUaXRsZSA9IChuOiBudW1iZXIpID0+IGxvY2FsaXplKCd0b3RhbEVycm9ycycsIFwiRXJyb3JzOiB7MH1cIiwgbik7XG5cdFx0Y29uc3Qgd2FybmluZ1RpdGxlID0gKG46IG51bWJlcikgPT4gbG9jYWxpemUoJ3RvdGFsV2FybmluZ3MnLCBcIldhcm5pbmdzOiB7MH1cIiwgbik7XG5cdFx0Y29uc3QgaW5mb1RpdGxlID0gKG46IG51bWJlcikgPT4gbG9jYWxpemUoJ3RvdGFsSW5mb3MnLCBcIkluZm9zOiB7MH1cIiwgbik7XG5cblx0XHRjb25zdCB0aXRsZXM6IHN0cmluZ1tdID0gW107XG5cblx0XHRpZiAoc3RhdHMuZXJyb3JzID4gMCkge1xuXHRcdFx0dGl0bGVzLnB1c2goZXJyb3JUaXRsZShzdGF0cy5lcnJvcnMpKTtcblx0XHR9XG5cblx0XHRpZiAoc3RhdHMud2FybmluZ3MgPiAwKSB7XG5cdFx0XHR0aXRsZXMucHVzaCh3YXJuaW5nVGl0bGUoc3RhdHMud2FybmluZ3MpKTtcblx0XHR9XG5cblx0XHRpZiAoc3RhdHMuaW5mb3MgPiAwKSB7XG5cdFx0XHR0aXRsZXMucHVzaChpbmZvVGl0bGUoc3RhdHMuaW5mb3MpKTtcblx0XHR9XG5cblx0XHRpZiAodGl0bGVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdub1Byb2JsZW1zJywgXCJObyBQcm9ibGVtc1wiKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGl0bGVzLmpvaW4oJywgJyk7XG5cdH1cblxuXHRwcml2YXRlIGdldE1hcmtlcnNUZXh0KHN0YXRzOiBNYXJrZXJTdGF0aXN0aWNzKTogc3RyaW5nIHtcblx0XHRjb25zdCBwcm9ibGVtc1RleHQ6IHN0cmluZ1tdID0gW107XG5cblx0XHQvLyBFcnJvcnNcblx0XHRwcm9ibGVtc1RleHQucHVzaCgnJChlcnJvcikgJyArIHRoaXMucGFja051bWJlcihzdGF0cy5lcnJvcnMpKTtcblxuXHRcdC8vIFdhcm5pbmdzXG5cdFx0cHJvYmxlbXNUZXh0LnB1c2goJyQod2FybmluZykgJyArIHRoaXMucGFja051bWJlcihzdGF0cy53YXJuaW5ncykpO1xuXG5cdFx0Ly8gSW5mbyAob25seSBpZiBhbnkpXG5cdFx0aWYgKHN0YXRzLmluZm9zID4gMCkge1xuXHRcdFx0cHJvYmxlbXNUZXh0LnB1c2goJyQoaW5mbykgJyArIHRoaXMucGFja051bWJlcihzdGF0cy5pbmZvcykpO1xuXHRcdH1cblxuXHRcdHJldHVybiBwcm9ibGVtc1RleHQuam9pbignICcpO1xuXHR9XG5cblx0cHJpdmF0ZSBwYWNrTnVtYmVyKG46IG51bWJlcik6IHN0cmluZyB7XG5cdFx0Y29uc3QgbWFueVByb2JsZW1zID0gbG9jYWxpemUoJ21hbnlQcm9ibGVtcycsIFwiMTBLK1wiKTtcblx0XHRyZXR1cm4gbiA+IDk5OTkgPyBtYW55UHJvYmxlbXMgOiBuID4gOTk5ID8gbi50b1N0cmluZygpLmNoYXJBdCgwKSArICdLJyA6IG4udG9TdHJpbmcoKTtcblx0fVxufVxuXG53b3JrYmVuY2hSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihNYXJrZXJzU3RhdHVzQmFyQ29udHJpYnV0aW9ucywgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG5jbGFzcyBBY3Rpdml0eVVwZGF0ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT4oKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1hcmtlclNlcnZpY2Uub25NYXJrZXJDaGFuZ2VkKCgpID0+IHRoaXMudXBkYXRlQmFkZ2UoKSkpO1xuXHRcdHRoaXMudXBkYXRlQmFkZ2UoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQmFkZ2UoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBlcnJvcnMsIHdhcm5pbmdzLCBpbmZvcyB9ID0gdGhpcy5tYXJrZXJTZXJ2aWNlLmdldFN0YXRpc3RpY3MoKTtcblx0XHRjb25zdCB0b3RhbCA9IGVycm9ycyArIHdhcm5pbmdzICsgaW5mb3M7XG5cdFx0aWYgKHRvdGFsID4gMCkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGxvY2FsaXplKCd0b3RhbFByb2JsZW1zJywgJ1RvdGFsIHswfSBQcm9ibGVtcycsIHRvdGFsKTtcblx0XHRcdHRoaXMuYWN0aXZpdHkudmFsdWUgPSB0aGlzLmFjdGl2aXR5U2VydmljZS5zaG93Vmlld0FjdGl2aXR5KE1hcmtlcnMuTUFSS0VSU19WSUVXX0lELCB7IGJhZGdlOiBuZXcgTnVtYmVyQmFkZ2UodG90YWwsICgpID0+IG1lc3NhZ2UpIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFjdGl2aXR5LnZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuXG53b3JrYmVuY2hSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihBY3Rpdml0eVVwZGF0ZXIsIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0JBQTBDO0FBQ25ELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMscUJBQXFCLHdCQUF3QjtBQUN0RCxTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsUUFBUSxvQkFBb0IsdUJBQXVCO0FBQzVELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsUUFBUSxpQkFBaUIsZUFBZTtBQUNqRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGlCQUFpQixTQUFTLDBCQUEwQjtBQUM3RCxPQUFPLGNBQWM7QUFDckIsU0FBMEMsY0FBYywyQkFBbUQ7QUFFM0csU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxZQUF5Qix5QkFBeUI7QUFDM0QsU0FBa0MsbUJBQW1CLDBCQUEyQztBQUNoRyxTQUFTLHNCQUF3QztB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
