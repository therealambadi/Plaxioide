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
import "./media/markers.css";
import * as dom from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Separator } from "../../../../base/common/actions.js";
import { groupBy } from "../../../../base/common/arrays.js";
import { Event, Relay } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { deepClone } from "../../../../base/common/objects.js";
import { isDefined } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { fillInMarkersDragData } from "../../../../platform/dnd/browser/dnd.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ResultKind } from "../../../../platform/keybinding/common/keybindingResolver.js";
import { IListService, WorkbenchObjectTree } from "../../../../platform/list/browser/listService.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IOpenerService, withSelection } from "../../../../platform/opener/common/opener.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { RangeHighlightDecorations } from "../../../browser/codeeditor.js";
import { ResourceListDnDHandler } from "../../../browser/dnd.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { FilterViewPane } from "../../../browser/parts/views/viewPane.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { Memento } from "../../../common/memento.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { Markers, MarkersContextKeys, MarkersViewMode } from "../common/markers.js";
import { FilterOptions } from "./markersFilterOptions.js";
import { compareMarkersByUri, Marker, MarkersModel, MarkerTableItem, RelatedInformation, ResourceMarkers } from "./markersModel.js";
import { MarkersTable } from "./markersTable.js";
import { Filter, MarkerRenderer, MarkersViewModel, MarkersWidgetAccessibilityProvider, RelatedInformationRenderer, ResourceMarkersRenderer, VirtualDelegate } from "./markersTreeViewer.js";
import { MarkersFilters } from "./markersViewActions.js";
import Messages from "./messages.js";
function createResourceMarkersIterator(resourceMarkers) {
  return Iterable.map(resourceMarkers.markers, (m) => {
    const relatedInformationIt = Iterable.from(m.relatedInformation);
    const children = Iterable.map(relatedInformationIt, (r) => ({ element: r }));
    return { element: m, children };
  });
}
let MarkersView = class extends FilterViewPane {
  constructor(options, instantiationService, viewDescriptorService, editorService, configurationService, markerService, contextKeyService, workspaceContextService, contextMenuService, uriIdentityService, keybindingService, storageService, openerService, themeService, hoverService) {
    const memento = new Memento(Markers.MARKERS_VIEW_STORAGE_ID, storageService);
    const panelState = memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    super({
      ...options,
      filterOptions: {
        ariaLabel: Messages.MARKERS_PANEL_FILTER_ARIA_LABEL,
        placeholder: Messages.MARKERS_PANEL_FILTER_PLACEHOLDER,
        focusContextKey: MarkersContextKeys.MarkerViewFilterFocusContextKey.key,
        text: panelState["filter"] || "",
        history: panelState["filterHistory"] || []
      }
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.editorService = editorService;
    this.markerService = markerService;
    this.workspaceContextService = workspaceContextService;
    this.uriIdentityService = uriIdentityService;
    this.lastSelectedRelativeTop = 0;
    this.currentActiveResource = null;
    this.onVisibleDisposables = this._register(new DisposableStore());
    this.widgetDisposables = this._register(new DisposableStore());
    this.currentHeight = 0;
    this.currentWidth = 0;
    this.cachedFilterStats = void 0;
    this.currentResourceGotAddedToMarkersData = false;
    this.onDidChangeVisibility = this.onDidChangeBodyVisibility;
    this.memento = memento;
    this.panelState = panelState;
    this.markersModel = this._register(instantiationService.createInstance(MarkersModel));
    this.markersViewModel = this._register(instantiationService.createInstance(MarkersViewModel, this.panelState["multiline"], this.panelState["viewMode"] ?? this.getDefaultViewMode()));
    this._register(this.onDidChangeVisibility((visible) => this.onDidChangeMarkersViewVisibility(visible)));
    this._register(this.markersViewModel.onDidChangeViewMode((_) => this.onDidChangeViewMode()));
    this.widgetAccessibilityProvider = instantiationService.createInstance(MarkersWidgetAccessibilityProvider);
    this.widgetIdentityProvider = { getId(element) {
      return element.id;
    } };
    this.setCurrentActiveEditor();
    this.filter = new Filter(FilterOptions.EMPTY(uriIdentityService));
    this.rangeHighlightDecorations = this._register(this.instantiationService.createInstance(RangeHighlightDecorations));
    this.filters = this._register(new MarkersFilters({
      filterHistory: this.panelState["filterHistory"] || [],
      showErrors: this.panelState["showErrors"] !== false,
      showWarnings: this.panelState["showWarnings"] !== false,
      showInfos: this.panelState["showInfos"] !== false,
      excludedFiles: !!this.panelState["useFilesExclude"],
      activeFile: !!this.panelState["activeFile"]
    }, this.contextKeyService));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (this.filters.excludedFiles && e.affectsConfiguration("files.exclude")) {
        this.updateFilter();
      }
    }));
  }
  render() {
    super.render();
    this._register(registerNavigableContainer({
      name: "markersView",
      focusNotifiers: [this, this.filterWidget],
      focusNextWidget: () => {
        if (this.filterWidget.hasFocus()) {
          this.focus();
        }
      },
      focusPreviousWidget: () => {
        if (!this.filterWidget.hasFocus()) {
          this.focusFilter();
        }
      }
    }));
  }
  renderBody(parent) {
    super.renderBody(parent);
    parent.classList.add("markers-panel");
    this._register(dom.addDisposableListener(parent, "keydown", (e) => {
      const event = new StandardKeyboardEvent(e);
      if (!this.keybindingService.mightProducePrintableCharacter(event)) {
        return;
      }
      const result = this.keybindingService.softDispatch(event, event.target);
      if (result.kind === ResultKind.MoreChordsNeeded || result.kind === ResultKind.KbFound) {
        return;
      }
      this.focusFilter();
    }));
    const panelContainer = dom.append(parent, dom.$(".markers-panel-container"));
    this.createArialLabelElement(panelContainer);
    this.createMessageBox(panelContainer);
    this.widgetContainer = dom.append(panelContainer, dom.$(".widget-container"));
    this.createWidget(this.widgetContainer);
    this.updateFilter();
    this.renderContent();
  }
  getTitle() {
    return Messages.MARKERS_PANEL_TITLE_PROBLEMS.value;
  }
  layoutBodyContent(height = this.currentHeight, width = this.currentWidth) {
    if (this.messageBoxContainer) {
      this.messageBoxContainer.style.height = `${height}px`;
    }
    this.widget.layout(height, width);
    this.currentHeight = height;
    this.currentWidth = width;
  }
  focus() {
    super.focus();
    if (dom.isActiveElement(this.widget.getHTMLElement())) {
      return;
    }
    if (this.hasNoProblems()) {
      this.messageBoxContainer.focus();
    } else {
      this.widget.domFocus();
      this.widget.setMarkerSelection();
    }
  }
  focusFilter() {
    this.filterWidget.focus();
  }
  updateBadge(total, filtered) {
    this.filterWidget.updateBadge(total === filtered || total === 0 ? void 0 : localize("showing filtered problems", "Showing {0} of {1}", filtered, total));
  }
  checkMoreFilters() {
    this.filterWidget.checkMoreFilters(!this.filters.showErrors || !this.filters.showWarnings || !this.filters.showInfos || this.filters.excludedFiles || this.filters.activeFile);
  }
  clearFilterText() {
    this.filterWidget.setFilterText("");
  }
  showQuickFixes(marker) {
    const viewModel = this.markersViewModel.getViewModel(marker);
    if (viewModel) {
      viewModel.quickFixAction.run();
    }
  }
  openFileAtElement(element, preserveFocus, sideByside, pinned) {
    const { resource, selection } = element instanceof Marker ? { resource: element.resource, selection: element.range } : element instanceof RelatedInformation ? { resource: element.raw.resource, selection: element.raw } : "marker" in element ? { resource: element.marker.resource, selection: element.marker.range } : { resource: null, selection: null };
    if (resource && selection) {
      this.editorService.openEditor({
        resource,
        options: {
          selection,
          preserveFocus,
          pinned,
          revealIfVisible: true
        }
      }, sideByside ? SIDE_GROUP : ACTIVE_GROUP).then((editor) => {
        if (editor && preserveFocus) {
          this.rangeHighlightDecorations.highlightRange({ resource, range: selection }, editor.getControl());
        } else {
          this.rangeHighlightDecorations.removeHighlightRange();
        }
      });
      return true;
    } else {
      this.rangeHighlightDecorations.removeHighlightRange();
    }
    return false;
  }
  refreshPanel(markerOrChange) {
    if (this.isVisible()) {
      const hasSelection = this.widget.getSelection().length > 0;
      if (markerOrChange) {
        if (markerOrChange instanceof Marker) {
          this.widget.updateMarker(markerOrChange);
        } else {
          if (markerOrChange.added.size || markerOrChange.removed.size) {
            this.resetWidget();
          } else {
            this.widget.update([...markerOrChange.updated]);
          }
        }
      } else {
        this.resetWidget();
      }
      if (hasSelection) {
        this.widget.setMarkerSelection();
      }
      this.cachedFilterStats = void 0;
      const { total, filtered } = this.getFilterStats();
      this.toggleVisibility(total === 0 || filtered === 0);
      this.renderMessage();
      this.updateBadge(total, filtered);
      this.checkMoreFilters();
    }
  }
  onDidChangeViewState(marker) {
    this.refreshPanel(marker);
  }
  resetWidget() {
    this.widget.reset(this.getResourceMarkers());
  }
  updateFilter() {
    this.filter.options = new FilterOptions(this.filterWidget.getFilterText(), this.getFilesExcludeExpressions(), this.filters.showWarnings, this.filters.showErrors, this.filters.showInfos, this.uriIdentityService);
    this.widget.filterMarkers(this.getResourceMarkers(), this.filter.options);
    this.cachedFilterStats = void 0;
    const { total, filtered } = this.getFilterStats();
    this.toggleVisibility(total === 0 || filtered === 0);
    this.renderMessage();
    this.updateBadge(total, filtered);
    this.checkMoreFilters();
  }
  getDefaultViewMode() {
    switch (this.configurationService.getValue("problems.defaultViewMode")) {
      case "table":
        return MarkersViewMode.Table;
      case "tree":
        return MarkersViewMode.Tree;
      default:
        return MarkersViewMode.Tree;
    }
  }
  getFilesExcludeExpressions() {
    if (!this.filters.excludedFiles) {
      return [];
    }
    const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
    return workspaceFolders.length ? workspaceFolders.map((workspaceFolder) => ({ root: workspaceFolder.uri, expression: this.getFilesExclude(workspaceFolder.uri) })) : this.getFilesExclude();
  }
  getFilesExclude(resource) {
    return deepClone(this.configurationService.getValue("files.exclude", { resource })) || {};
  }
  getResourceMarkers() {
    if (!this.filters.activeFile) {
      return this.markersModel.resourceMarkers;
    }
    let resourceMarkers = [];
    if (this.currentActiveResource) {
      const activeResourceMarkers = this.markersModel.getResourceMarkers(this.currentActiveResource);
      if (activeResourceMarkers) {
        resourceMarkers = [activeResourceMarkers];
      }
    }
    return resourceMarkers;
  }
  createMessageBox(parent) {
    this.messageBoxContainer = dom.append(parent, dom.$(".message-box-container"));
    this.messageBoxContainer.setAttribute("aria-labelledby", "markers-panel-arialabel");
  }
  createArialLabelElement(parent) {
    this.ariaLabelElement = dom.append(parent, dom.$(""));
    this.ariaLabelElement.setAttribute("id", "markers-panel-arialabel");
  }
  createWidget(parent) {
    this.widget = this.markersViewModel.viewMode === MarkersViewMode.Table ? this.createTable(parent) : this.createTree(parent);
    this.widgetDisposables.add(this.widget);
    const markerFocusContextKey = MarkersContextKeys.MarkerFocusContextKey.bindTo(this.widget.contextKeyService);
    const relatedInformationFocusContextKey = MarkersContextKeys.RelatedInformationFocusContextKey.bindTo(this.widget.contextKeyService);
    this.widgetDisposables.add(this.widget.onDidChangeFocus((focus) => {
      markerFocusContextKey.set(focus.elements.some((e) => e instanceof Marker));
      relatedInformationFocusContextKey.set(focus.elements.some((e) => e instanceof RelatedInformation));
    }));
    this.widgetDisposables.add(Event.debounce(this.widget.onDidOpen, (last, event) => event, 75, true)((options) => {
      this.openFileAtElement(options.element, !!options.editorOptions.preserveFocus, options.sideBySide, !!options.editorOptions.pinned);
    }));
    this.widgetDisposables.add(Event.any(this.widget.onDidChangeSelection, this.widget.onDidChangeFocus)(() => {
      const elements = [...this.widget.getSelection(), ...this.widget.getFocus()];
      for (const element of elements) {
        if (element instanceof Marker) {
          const viewModel = this.markersViewModel.getViewModel(element);
          viewModel?.showLightBulb();
        }
      }
    }));
    this.widgetDisposables.add(this.widget.onContextMenu(this.onContextMenu, this));
    this.widgetDisposables.add(this.widget.onDidChangeSelection(this.onSelected, this));
  }
  createTable(parent) {
    const table = this.instantiationService.createInstance(
      MarkersTable,
      dom.append(parent, dom.$(".markers-table-container")),
      this.markersViewModel,
      this.getResourceMarkers(),
      this.filter.options,
      {
        accessibilityProvider: this.widgetAccessibilityProvider,
        dnd: this.instantiationService.createInstance(ResourceListDnDHandler, (element) => {
          if (element instanceof MarkerTableItem) {
            return withSelection(element.resource, element.range);
          }
          return null;
        }),
        horizontalScrolling: false,
        identityProvider: this.widgetIdentityProvider,
        multipleSelectionSupport: true,
        selectionNavigation: true
      }
    );
    return table;
  }
  createTree(parent) {
    const onDidChangeRenderNodeCount = new Relay();
    const treeLabels = this.instantiationService.createInstance(ResourceLabels, this);
    const virtualDelegate = new VirtualDelegate(this.markersViewModel);
    const renderers = [
      this.instantiationService.createInstance(ResourceMarkersRenderer, treeLabels, onDidChangeRenderNodeCount.event),
      this.instantiationService.createInstance(MarkerRenderer, this.markersViewModel),
      this.instantiationService.createInstance(RelatedInformationRenderer)
    ];
    const tree = this.instantiationService.createInstance(
      MarkersTree,
      "MarkersView",
      dom.append(parent, dom.$(".tree-container.show-file-icons")),
      virtualDelegate,
      renderers,
      {
        filter: this.filter,
        accessibilityProvider: this.widgetAccessibilityProvider,
        identityProvider: this.widgetIdentityProvider,
        dnd: this.instantiationService.createInstance(MarkersListDnDHandler),
        expandOnlyOnTwistieClick: (e) => e instanceof Marker && e.relatedInformation.length > 0,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles,
        selectionNavigation: true,
        multipleSelectionSupport: true
      }
    );
    onDidChangeRenderNodeCount.input = tree.onDidChangeRenderNodeCount;
    return tree;
  }
  collapseAll() {
    this.widget.collapseMarkers();
  }
  setMultiline(multiline) {
    this.markersViewModel.multiline = multiline;
  }
  setViewMode(viewMode) {
    this.markersViewModel.viewMode = viewMode;
  }
  onDidChangeMarkersViewVisibility(visible) {
    this.onVisibleDisposables.clear();
    if (visible) {
      for (const disposable of this.reInitialize()) {
        this.onVisibleDisposables.add(disposable);
      }
      this.refreshPanel();
    }
  }
  reInitialize() {
    const disposables = [];
    const readMarkers = (resource) => this.markerService.read({ resource, severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info });
    this.markersModel.setResourceMarkers(groupBy(readMarkers(), compareMarkersByUri).map((group) => [group[0].resource, group]));
    disposables.push(Event.debounce(this.markerService.onMarkerChanged, (resourcesMap, resources) => {
      resourcesMap = resourcesMap || new ResourceMap();
      resources.forEach((resource) => resourcesMap.set(resource, resource));
      return resourcesMap;
    }, 64)((resourcesMap) => {
      this.markersModel.setResourceMarkers([...resourcesMap.values()].map((resource) => [resource, readMarkers(resource)]));
    }));
    disposables.push(Event.any(this.markersModel.onDidChange, this.editorService.onDidActiveEditorChange)((changes) => {
      if (changes) {
        this.onDidChangeModel(changes);
      } else {
        this.onActiveEditorChanged();
      }
    }));
    disposables.push(toDisposable(() => this.markersModel.reset()));
    this.markersModel.resourceMarkers.forEach((resourceMarker) => resourceMarker.markers.forEach((marker) => this.markersViewModel.add(marker)));
    disposables.push(this.markersViewModel.onDidChange((marker) => this.onDidChangeViewState(marker)));
    disposables.push(toDisposable(() => this.markersModel.resourceMarkers.forEach((resourceMarker) => this.markersViewModel.remove(resourceMarker.resource))));
    disposables.push(this.filters.onDidChange((event) => {
      if (event.activeFile) {
        this.refreshPanel();
      } else if (event.excludedFiles || event.showWarnings || event.showErrors || event.showInfos) {
        this.updateFilter();
      }
    }));
    disposables.push(this.filterWidget.onDidChangeFilterText((e) => this.updateFilter()));
    disposables.push(toDisposable(() => {
      this.cachedFilterStats = void 0;
    }));
    disposables.push(toDisposable(() => this.rangeHighlightDecorations.removeHighlightRange()));
    return disposables;
  }
  onDidChangeModel(change) {
    const resourceMarkers = [...change.added, ...change.removed, ...change.updated];
    const resources = [];
    for (const { resource } of resourceMarkers) {
      this.markersViewModel.remove(resource);
      const resourceMarkers2 = this.markersModel.getResourceMarkers(resource);
      if (resourceMarkers2) {
        for (const marker of resourceMarkers2.markers) {
          this.markersViewModel.add(marker);
        }
      }
      resources.push(resource);
    }
    this.currentResourceGotAddedToMarkersData = this.currentResourceGotAddedToMarkersData || this.isCurrentResourceGotAddedToMarkersData(resources);
    this.refreshPanel(change);
    this.updateRangeHighlights();
    if (this.currentResourceGotAddedToMarkersData) {
      this.autoReveal();
      this.currentResourceGotAddedToMarkersData = false;
    }
  }
  onDidChangeViewMode() {
    if (this.widgetContainer && this.widget) {
      this.widgetContainer.textContent = "";
      this.widgetDisposables.clear();
    }
    const selection = /* @__PURE__ */ new Set();
    for (const marker of this.widget.getSelection()) {
      if (marker instanceof ResourceMarkers) {
        marker.markers.forEach((m) => selection.add(m));
      } else if (marker instanceof Marker || marker instanceof MarkerTableItem) {
        selection.add(marker);
      }
    }
    const focus = /* @__PURE__ */ new Set();
    for (const marker of this.widget.getFocus()) {
      if (marker instanceof Marker || marker instanceof MarkerTableItem) {
        focus.add(marker);
      }
    }
    this.createWidget(this.widgetContainer);
    this.refreshPanel();
    if (selection.size > 0) {
      this.widget.setMarkerSelection(Array.from(selection), Array.from(focus));
      this.widget.domFocus();
    }
  }
  isCurrentResourceGotAddedToMarkersData(changedResources) {
    const currentlyActiveResource = this.currentActiveResource;
    if (!currentlyActiveResource) {
      return false;
    }
    const resourceForCurrentActiveResource = this.getResourceForCurrentActiveResource();
    if (resourceForCurrentActiveResource) {
      return false;
    }
    return changedResources.some((r) => r.toString() === currentlyActiveResource.toString());
  }
  onActiveEditorChanged() {
    this.setCurrentActiveEditor();
    if (this.filters.activeFile) {
      this.refreshPanel();
    }
    this.autoReveal();
  }
  setCurrentActiveEditor() {
    const activeEditor = this.editorService.activeEditor;
    this.currentActiveResource = activeEditor ? EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY }) ?? null : null;
  }
  onSelected() {
    const selection = this.widget.getSelection();
    if (selection && selection.length > 0) {
      this.lastSelectedRelativeTop = this.widget.getRelativeTop(selection[0]) || 0;
    }
  }
  hasNoProblems() {
    const { total, filtered } = this.getFilterStats();
    return total === 0 || filtered === 0;
  }
  renderContent() {
    this.cachedFilterStats = void 0;
    this.resetWidget();
    this.toggleVisibility(this.hasNoProblems());
    this.renderMessage();
  }
  renderMessage() {
    if (!this.messageBoxContainer || !this.ariaLabelElement) {
      return;
    }
    dom.clearNode(this.messageBoxContainer);
    const { total, filtered } = this.getFilterStats();
    if (filtered === 0) {
      this.messageBoxContainer.style.display = "block";
      this.messageBoxContainer.setAttribute("tabIndex", "0");
      if (this.filters.activeFile) {
        this.renderFilterMessageForActiveFile(this.messageBoxContainer);
      } else {
        if (total > 0) {
          this.renderFilteredByFilterMessage(this.messageBoxContainer);
        } else {
          this.renderNoProblemsMessage(this.messageBoxContainer);
        }
      }
    } else {
      this.messageBoxContainer.style.display = "none";
      if (filtered === total) {
        this.setAriaLabel(localize("No problems filtered", "Showing {0} problems", total));
      } else {
        this.setAriaLabel(localize("problems filtered", "Showing {0} of {1} problems", filtered, total));
      }
      this.messageBoxContainer.removeAttribute("tabIndex");
    }
  }
  renderFilterMessageForActiveFile(container) {
    if (this.currentActiveResource && this.markersModel.getResourceMarkers(this.currentActiveResource)) {
      this.renderFilteredByFilterMessage(container);
    } else {
      this.renderNoProblemsMessageForActiveFile(container);
    }
  }
  renderFilteredByFilterMessage(container) {
    const span1 = dom.append(container, dom.$("span"));
    span1.textContent = Messages.MARKERS_PANEL_NO_PROBLEMS_FILTERS;
    const link = dom.append(container, dom.$("a.messageAction"));
    link.textContent = localize("clearFilter", "Clear Filters");
    link.setAttribute("tabIndex", "0");
    const span2 = dom.append(container, dom.$("span"));
    span2.textContent = ".";
    dom.addStandardDisposableListener(link, dom.EventType.CLICK, () => this.clearFilters());
    dom.addStandardDisposableListener(link, dom.EventType.KEY_DOWN, (e) => {
      if (e.equals(KeyCode.Enter) || e.equals(KeyCode.Space)) {
        this.clearFilters();
        e.stopPropagation();
      }
    });
    this.setAriaLabel(Messages.MARKERS_PANEL_NO_PROBLEMS_FILTERS);
  }
  renderNoProblemsMessageForActiveFile(container) {
    const span = dom.append(container, dom.$("span"));
    span.textContent = Messages.MARKERS_PANEL_NO_PROBLEMS_ACTIVE_FILE_BUILT;
    this.setAriaLabel(Messages.MARKERS_PANEL_NO_PROBLEMS_ACTIVE_FILE_BUILT);
  }
  renderNoProblemsMessage(container) {
    const span = dom.append(container, dom.$("span"));
    span.textContent = Messages.MARKERS_PANEL_NO_PROBLEMS_BUILT;
    this.setAriaLabel(Messages.MARKERS_PANEL_NO_PROBLEMS_BUILT);
  }
  setAriaLabel(label) {
    this.widget.setAriaLabel(label);
    this.ariaLabelElement.setAttribute("aria-label", label);
  }
  clearFilters() {
    this.filterWidget.setFilterText("");
    this.filters.excludedFiles = false;
    this.filters.showErrors = true;
    this.filters.showWarnings = true;
    this.filters.showInfos = true;
  }
  autoReveal(focus = false) {
    if (this.filters.activeFile) {
      return;
    }
    const autoReveal = this.configurationService.getValue("problems.autoReveal");
    if (typeof autoReveal === "boolean" && autoReveal) {
      const currentActiveResource = this.getResourceForCurrentActiveResource();
      this.widget.revealMarkers(currentActiveResource, focus, this.lastSelectedRelativeTop);
    }
  }
  getResourceForCurrentActiveResource() {
    return this.currentActiveResource ? this.markersModel.getResourceMarkers(this.currentActiveResource) : null;
  }
  updateRangeHighlights() {
    this.rangeHighlightDecorations.removeHighlightRange();
    if (dom.isActiveElement(this.widget.getHTMLElement())) {
      this.highlightCurrentSelectedMarkerRange();
    }
  }
  highlightCurrentSelectedMarkerRange() {
    const selections = this.widget.getSelection() ?? [];
    if (selections.length !== 1) {
      return;
    }
    const selection = selections[0];
    if (!(selection instanceof Marker)) {
      return;
    }
    this.rangeHighlightDecorations.highlightRange(selection);
  }
  onContextMenu(e) {
    const element = e.element;
    if (!element) {
      return;
    }
    e.browserEvent.preventDefault();
    e.browserEvent.stopPropagation();
    this.contextMenuService.showContextMenu({
      getAnchor: () => e.anchor,
      menuId: MenuId.ProblemsPanelContext,
      contextKeyService: this.widget.contextKeyService,
      getActions: () => this.getMenuActions(element),
      getActionViewItem: (action) => {
        const keybinding = this.keybindingService.lookupKeybinding(action.id);
        if (keybinding) {
          return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
        }
        return void 0;
      },
      onHide: (wasCancelled) => {
        if (wasCancelled) {
          this.widget.domFocus();
        }
      }
    });
  }
  getMenuActions(element) {
    const result = [];
    if (element instanceof Marker) {
      const viewModel = this.markersViewModel.getViewModel(element);
      if (viewModel) {
        const quickFixActions = viewModel.quickFixAction.quickFixes;
        if (quickFixActions.length) {
          result.push(...quickFixActions);
          result.push(new Separator());
        }
      }
    }
    return result;
  }
  getFocusElement() {
    return this.widget.getFocus()[0] ?? void 0;
  }
  getFocusedSelectedElements() {
    const focus = this.getFocusElement();
    if (!focus) {
      return null;
    }
    const selection = this.widget.getSelection();
    if (selection.includes(focus)) {
      const result = [];
      for (const selected of selection) {
        if (selected) {
          result.push(selected);
        }
      }
      return result;
    } else {
      return [focus];
    }
  }
  getAllResourceMarkers() {
    return this.markersModel.resourceMarkers;
  }
  getFilterStats() {
    if (!this.cachedFilterStats) {
      this.cachedFilterStats = {
        total: this.markersModel.total,
        filtered: this.widget?.getVisibleItemCount() ?? 0
      };
    }
    return this.cachedFilterStats;
  }
  toggleVisibility(hide) {
    this.widget.toggleVisibility(hide);
    this.layoutBodyContent();
  }
  saveState() {
    this.panelState["filter"] = this.filterWidget.getFilterText();
    this.panelState["filterHistory"] = this.filters.filterHistory;
    this.panelState["showErrors"] = this.filters.showErrors;
    this.panelState["showWarnings"] = this.filters.showWarnings;
    this.panelState["showInfos"] = this.filters.showInfos;
    this.panelState["useFilesExclude"] = this.filters.excludedFiles;
    this.panelState["activeFile"] = this.filters.activeFile;
    this.panelState["multiline"] = this.markersViewModel.multiline;
    this.panelState["viewMode"] = this.markersViewModel.viewMode;
    this.memento.saveMemento();
    super.saveState();
  }
  dispose() {
    super.dispose();
  }
};
MarkersView = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IMarkerService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IUriIdentityService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, IStorageService),
  __decorateParam(12, IOpenerService),
  __decorateParam(13, IThemeService),
  __decorateParam(14, IHoverService)
], MarkersView);
let MarkersTree = class extends WorkbenchObjectTree {
  constructor(user, container, delegate, renderers, options, instantiationService, contextKeyService, listService, themeService, configurationService) {
    super(user, container, delegate, renderers, options, instantiationService, contextKeyService, listService, configurationService);
    this.container = container;
    this.visibilityContextKey = MarkersContextKeys.MarkersTreeVisibilityContextKey.bindTo(contextKeyService);
  }
  collapseMarkers() {
    this.collapseAll();
    this.setSelection([]);
    this.setFocus([]);
    this.getHTMLElement().focus();
    this.focusFirst();
  }
  filterMarkers() {
    this.refilter();
  }
  getVisibleItemCount() {
    let filtered = 0;
    const root = this.getNode();
    for (const resourceMarkerNode of root.children) {
      for (const markerNode of resourceMarkerNode.children) {
        if (resourceMarkerNode.visible && markerNode.visible) {
          filtered++;
        }
      }
    }
    return filtered;
  }
  isVisible() {
    return !this.container.classList.contains("hidden");
  }
  toggleVisibility(hide) {
    this.visibilityContextKey.set(!hide);
    this.container.classList.toggle("hidden", hide);
  }
  reset(resourceMarkers) {
    this.setChildren(null, Iterable.map(resourceMarkers, (m) => ({ element: m, children: createResourceMarkersIterator(m) })));
  }
  revealMarkers(activeResource, focus, lastSelectedRelativeTop) {
    if (activeResource) {
      if (this.hasElement(activeResource)) {
        if (!this.isCollapsed(activeResource) && this.hasSelectedMarkerFor(activeResource)) {
          this.reveal(this.getSelection()[0], lastSelectedRelativeTop);
          if (focus) {
            this.setFocus(this.getSelection());
          }
        } else {
          this.expand(activeResource);
          this.reveal(activeResource, 0);
          if (focus) {
            this.setFocus([activeResource]);
            this.setSelection([activeResource]);
          }
        }
      }
    } else if (focus) {
      this.setSelection([]);
      this.focusFirst();
    }
  }
  setAriaLabel(label) {
    this.ariaLabel = label;
  }
  setMarkerSelection(selection, focus) {
    if (this.isVisible()) {
      if (selection && selection.length > 0) {
        this.setSelection(selection.map((m) => this.findMarkerNode(m)));
        if (focus && focus.length > 0) {
          this.setFocus(focus.map((f) => this.findMarkerNode(f)));
        } else {
          this.setFocus([this.findMarkerNode(selection[0])]);
        }
        this.reveal(this.findMarkerNode(selection[0]));
      } else if (this.getSelection().length === 0) {
        const firstVisibleElement = this.firstVisibleElement;
        const marker = firstVisibleElement ? firstVisibleElement instanceof ResourceMarkers ? firstVisibleElement.markers[0] : firstVisibleElement instanceof Marker ? firstVisibleElement : void 0 : void 0;
        if (marker) {
          this.setSelection([marker]);
          this.setFocus([marker]);
          this.reveal(marker);
        }
      }
    }
  }
  update(resourceMarkers) {
    for (const resourceMarker of resourceMarkers) {
      if (this.hasElement(resourceMarker)) {
        this.setChildren(resourceMarker, createResourceMarkersIterator(resourceMarker));
        this.rerender(resourceMarker);
      }
    }
  }
  updateMarker(marker) {
    this.rerender(marker);
  }
  findMarkerNode(marker) {
    for (const resourceNode of this.getNode().children) {
      for (const markerNode of resourceNode.children) {
        if (markerNode.element instanceof Marker && markerNode.element.marker === marker.marker) {
          return markerNode.element;
        }
      }
    }
    return null;
  }
  hasSelectedMarkerFor(resource) {
    const selectedElement = this.getSelection();
    if (selectedElement && selectedElement.length > 0) {
      if (selectedElement[0] instanceof Marker) {
        if (resource.has(selectedElement[0].marker.resource)) {
          return true;
        }
      }
    }
    return false;
  }
  dispose() {
    super.dispose();
  }
  layout(height, width) {
    this.container.style.height = `${height}px`;
    super.layout(height, width);
  }
};
MarkersTree = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IListService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IConfigurationService)
], MarkersTree);
let MarkersListDnDHandler = class extends ResourceListDnDHandler {
  constructor(instantiationService) {
    super((element) => {
      if (element instanceof MarkerTableItem) {
        return withSelection(element.resource, element.range);
      } else if (element instanceof ResourceMarkers) {
        return element.resource;
      } else if (element instanceof Marker) {
        return withSelection(element.resource, element.range);
      } else if (element instanceof RelatedInformation) {
        return withSelection(element.raw.resource, element.raw);
      }
      return null;
    }, instantiationService);
  }
  onWillDragElements(elements, originalEvent) {
    const data = elements.map((e) => {
      if (e instanceof RelatedInformation || e instanceof Marker) {
        return e.marker;
      }
      if (e instanceof ResourceMarkers) {
        return { uri: e.resource };
      }
      return void 0;
    }).filter(isDefined);
    if (!data.length) {
      return;
    }
    fillInMarkersDragData(data, originalEvent);
  }
};
MarkersListDnDHandler = __decorateClass([
  __decorateParam(0, IInstantiationService)
], MarkersListDnDHandler);
export {
  MarkersView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZXJzL2Jyb3dzZXIvbWFya2Vyc1ZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvbWFya2Vycy5jc3MnO1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmRFdmVudCwgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBJSWRlbnRpdHlQcm92aWRlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElUYWJsZUNvbnRleHRNZW51RXZlbnQsIElUYWJsZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RhYmxlL3RhYmxlLmpzJztcbmltcG9ydCB7IElUcmVlQ29udGV4dE1lbnVFdmVudCwgSVRyZWVFbGVtZW50LCBJVHJlZUV2ZW50LCBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IElBY3Rpb24sIFNlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgZ3JvdXBCeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgUmVsYXkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJRXhwcmVzc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGRlZXBDbG9uZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgaXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgZmlsbEluTWFya2Vyc0RyYWdEYXRhLCBNYXJrZXJUcmFuc2ZlckRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFJlc3VsdEtpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlLCBJT3BlbkV2ZW50LCBJV29ya2JlbmNoT2JqZWN0VHJlZU9wdGlvbnMsIFdvcmtiZW5jaE9iamVjdFRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1hcmtlclNlcnZpY2UsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSwgd2l0aFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyTmF2aWdhYmxlQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9hY3Rpb25zL3dpZGdldE5hdmlnYXRpb25Db21tYW5kcy5qcyc7XG5pbXBvcnQgeyBSYW5nZUhpZ2hsaWdodERlY29yYXRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9jb2RlZWRpdG9yLmpzJztcbmltcG9ydCB7IFJlc291cmNlTGlzdERuREhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxhYmVscyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IEZpbHRlclZpZXdQYW5lLCBJVmlld1BhbmVPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBNZW1lbnRvLCBNZW1lbnRvT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21lbWVudG8uanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBBQ1RJVkVfR1JPVVAsIElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1hcmtlcnMsIE1hcmtlcnNDb250ZXh0S2V5cywgTWFya2Vyc1ZpZXdNb2RlIH0gZnJvbSAnLi4vY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSU1hcmtlcnNWaWV3IH0gZnJvbSAnLi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IEZpbHRlck9wdGlvbnMgfSBmcm9tICcuL21hcmtlcnNGaWx0ZXJPcHRpb25zLmpzJztcbmltcG9ydCB7IGNvbXBhcmVNYXJrZXJzQnlVcmksIE1hcmtlciwgTWFya2VyQ2hhbmdlc0V2ZW50LCBNYXJrZXJFbGVtZW50LCBNYXJrZXJzTW9kZWwsIE1hcmtlclRhYmxlSXRlbSwgUmVsYXRlZEluZm9ybWF0aW9uLCBSZXNvdXJjZU1hcmtlcnMgfSBmcm9tICcuL21hcmtlcnNNb2RlbC5qcyc7XG5pbXBvcnQgeyBNYXJrZXJzVGFibGUgfSBmcm9tICcuL21hcmtlcnNUYWJsZS5qcyc7XG5pbXBvcnQgeyBGaWx0ZXIsIEZpbHRlckRhdGEsIE1hcmtlclJlbmRlcmVyLCBNYXJrZXJzVmlld01vZGVsLCBNYXJrZXJzV2lkZ2V0QWNjZXNzaWJpbGl0eVByb3ZpZGVyLCBSZWxhdGVkSW5mb3JtYXRpb25SZW5kZXJlciwgUmVzb3VyY2VNYXJrZXJzUmVuZGVyZXIsIFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4vbWFya2Vyc1RyZWVWaWV3ZXIuanMnO1xuaW1wb3J0IHsgSU1hcmtlcnNGaWx0ZXJzQ2hhbmdlRXZlbnQsIE1hcmtlcnNGaWx0ZXJzIH0gZnJvbSAnLi9tYXJrZXJzVmlld0FjdGlvbnMuanMnO1xuaW1wb3J0IE1lc3NhZ2VzIGZyb20gJy4vbWVzc2FnZXMuanMnO1xuXG5mdW5jdGlvbiBjcmVhdGVSZXNvdXJjZU1hcmtlcnNJdGVyYXRvcihyZXNvdXJjZU1hcmtlcnM6IFJlc291cmNlTWFya2Vycyk6IEl0ZXJhYmxlPElUcmVlRWxlbWVudDxNYXJrZXJFbGVtZW50Pj4ge1xuXHRyZXR1cm4gSXRlcmFibGUubWFwKHJlc291cmNlTWFya2Vycy5tYXJrZXJzLCBtID0+IHtcblx0XHRjb25zdCByZWxhdGVkSW5mb3JtYXRpb25JdCA9IEl0ZXJhYmxlLmZyb20obS5yZWxhdGVkSW5mb3JtYXRpb24pO1xuXHRcdGNvbnN0IGNoaWxkcmVuID0gSXRlcmFibGUubWFwKHJlbGF0ZWRJbmZvcm1hdGlvbkl0LCByID0+ICh7IGVsZW1lbnQ6IHIgfSkpO1xuXG5cdFx0cmV0dXJuIHsgZWxlbWVudDogbSwgY2hpbGRyZW4gfTtcblx0fSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb2JsZW1zV2lkZ2V0IHtcblx0Z2V0IGNvbnRleHRLZXlTZXJ2aWNlKCk6IElDb250ZXh0S2V5U2VydmljZTtcblxuXHRnZXQgb25Db250ZXh0TWVudSgpOiBFdmVudDxJVHJlZUNvbnRleHRNZW51RXZlbnQ8TWFya2VyRWxlbWVudCB8IG51bGw+PiB8IEV2ZW50PElUYWJsZUNvbnRleHRNZW51RXZlbnQ8TWFya2VyVGFibGVJdGVtPj47XG5cdGdldCBvbkRpZENoYW5nZUZvY3VzKCk6IEV2ZW50PElUcmVlRXZlbnQ8TWFya2VyRWxlbWVudCB8IG51bGw+PiB8IEV2ZW50PElUYWJsZUV2ZW50PE1hcmtlclRhYmxlSXRlbT4+O1xuXHRnZXQgb25EaWRDaGFuZ2VTZWxlY3Rpb24oKTogRXZlbnQ8SVRyZWVFdmVudDxNYXJrZXJFbGVtZW50IHwgbnVsbD4+IHwgRXZlbnQ8SVRhYmxlRXZlbnQ8TWFya2VyVGFibGVJdGVtPj47XG5cdGdldCBvbkRpZE9wZW4oKTogRXZlbnQ8SU9wZW5FdmVudDxNYXJrZXJFbGVtZW50IHwgTWFya2VyVGFibGVJdGVtIHwgdW5kZWZpbmVkPj47XG5cblx0Y29sbGFwc2VNYXJrZXJzKCk6IHZvaWQ7XG5cdGRpc3Bvc2UoKTogdm9pZDtcblx0ZG9tRm9jdXMoKTogdm9pZDtcblx0ZmlsdGVyTWFya2VycyhyZXNvdXJjZU1hcmtlcnM6IFJlc291cmNlTWFya2Vyc1tdLCBmaWx0ZXJPcHRpb25zOiBGaWx0ZXJPcHRpb25zKTogdm9pZDtcblx0Z2V0Rm9jdXMoKTogKE1hcmtlckVsZW1lbnQgfCBNYXJrZXJUYWJsZUl0ZW0gfCBudWxsKVtdO1xuXHRnZXRIVE1MRWxlbWVudCgpOiBIVE1MRWxlbWVudDtcblx0Z2V0UmVsYXRpdmVUb3AobG9jYXRpb246IE1hcmtlckVsZW1lbnQgfCBNYXJrZXJUYWJsZUl0ZW0gfCBudWxsKTogbnVtYmVyIHwgbnVsbDtcblx0Z2V0U2VsZWN0aW9uKCk6IChNYXJrZXJFbGVtZW50IHwgTWFya2VyVGFibGVJdGVtIHwgbnVsbClbXTtcblx0Z2V0VmlzaWJsZUl0ZW1Db3VudCgpOiBudW1iZXI7XG5cdGxheW91dChoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQ7XG5cdHJlc2V0KHJlc291cmNlTWFya2VyczogUmVzb3VyY2VNYXJrZXJzW10pOiB2b2lkO1xuXHRyZXZlYWxNYXJrZXJzKGFjdGl2ZVJlc291cmNlOiBSZXNvdXJjZU1hcmtlcnMgfCBudWxsLCBmb2N1czogYm9vbGVhbiwgbGFzdFNlbGVjdGVkUmVsYXRpdmVUb3A6IG51bWJlcik6IHZvaWQ7XG5cdHNldEFyaWFMYWJlbChsYWJlbDogc3RyaW5nKTogdm9pZDtcblx0c2V0TWFya2VyU2VsZWN0aW9uKHNlbGVjdGlvbj86IE1hcmtlcltdLCBmb2N1cz86IE1hcmtlcltdKTogdm9pZDtcblx0dG9nZ2xlVmlzaWJpbGl0eShoaWRlOiBib29sZWFuKTogdm9pZDtcblx0dXBkYXRlKHJlc291cmNlTWFya2VyczogUmVzb3VyY2VNYXJrZXJzW10pOiB2b2lkO1xuXHR1cGRhdGVNYXJrZXIobWFya2VyOiBNYXJrZXIpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgTWFya2Vyc1ZpZXcgZXh0ZW5kcyBGaWx0ZXJWaWV3UGFuZSBpbXBsZW1lbnRzIElNYXJrZXJzVmlldyB7XG5cblx0cHJpdmF0ZSBsYXN0U2VsZWN0ZWRSZWxhdGl2ZVRvcDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBjdXJyZW50QWN0aXZlUmVzb3VyY2U6IFVSSSB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmFuZ2VIaWdobGlnaHREZWNvcmF0aW9uczogUmFuZ2VIaWdobGlnaHREZWNvcmF0aW9ucztcblx0cHJpdmF0ZSByZWFkb25seSBtYXJrZXJzTW9kZWw6IE1hcmtlcnNNb2RlbDtcblx0cHJpdmF0ZSByZWFkb25seSBmaWx0ZXI6IEZpbHRlcjtcblx0cHJpdmF0ZSByZWFkb25seSBvblZpc2libGVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0cHJpdmF0ZSB3aWRnZXQhOiBJUHJvYmxlbXNXaWRnZXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgd2lkZ2V0RGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHdpZGdldENvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHdpZGdldElkZW50aXR5UHJvdmlkZXI6IElJZGVudGl0eVByb3ZpZGVyPE1hcmtlckVsZW1lbnQgfCBNYXJrZXJUYWJsZUl0ZW0+O1xuXHRwcml2YXRlIHdpZGdldEFjY2Vzc2liaWxpdHlQcm92aWRlcjogTWFya2Vyc1dpZGdldEFjY2Vzc2liaWxpdHlQcm92aWRlcjtcblx0cHJpdmF0ZSBtZXNzYWdlQm94Q29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBhcmlhTGFiZWxFbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZmlsdGVyczogTWFya2Vyc0ZpbHRlcnM7XG5cblx0cHJpdmF0ZSBjdXJyZW50SGVpZ2h0ID0gMDtcblx0cHJpdmF0ZSBjdXJyZW50V2lkdGggPSAwO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1lbWVudG86IE1lbWVudG87XG5cdHByaXZhdGUgcmVhZG9ubHkgcGFuZWxTdGF0ZTogTWVtZW50b09iamVjdDtcblxuXHRwcml2YXRlIGNhY2hlZEZpbHRlclN0YXRzOiB7IHRvdGFsOiBudW1iZXI7IGZpbHRlcmVkOiBudW1iZXIgfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGN1cnJlbnRSZXNvdXJjZUdvdEFkZGVkVG9NYXJrZXJzRGF0YTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1hcmtlcnNWaWV3TW9kZWw6IE1hcmtlcnNWaWV3TW9kZWw7XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gdGhpcy5vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3UGFuZU9wdGlvbnMsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBtZW1lbnRvID0gbmV3IE1lbWVudG8oTWFya2Vycy5NQVJLRVJTX1ZJRVdfU1RPUkFHRV9JRCwgc3RvcmFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU3RhdGUgPSBtZW1lbnRvLmdldE1lbWVudG8oU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRzdXBlcih7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0ZmlsdGVyT3B0aW9uczoge1xuXHRcdFx0XHRhcmlhTGFiZWw6IE1lc3NhZ2VzLk1BUktFUlNfUEFORUxfRklMVEVSX0FSSUFfTEFCRUwsXG5cdFx0XHRcdHBsYWNlaG9sZGVyOiBNZXNzYWdlcy5NQVJLRVJTX1BBTkVMX0ZJTFRFUl9QTEFDRUhPTERFUixcblx0XHRcdFx0Zm9jdXNDb250ZXh0S2V5OiBNYXJrZXJzQ29udGV4dEtleXMuTWFya2VyVmlld0ZpbHRlckZvY3VzQ29udGV4dEtleS5rZXksXG5cdFx0XHRcdHRleHQ6IHBhbmVsU3RhdGVbJ2ZpbHRlciddIHx8ICcnLFxuXHRcdFx0XHRoaXN0b3J5OiBwYW5lbFN0YXRlWydmaWx0ZXJIaXN0b3J5J10gfHwgW11cblx0XHRcdH1cblx0XHR9LCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIHRoZW1lU2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblx0XHR0aGlzLm1lbWVudG8gPSBtZW1lbnRvO1xuXHRcdHRoaXMucGFuZWxTdGF0ZSA9IHBhbmVsU3RhdGU7XG5cblx0XHR0aGlzLm1hcmtlcnNNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtlcnNNb2RlbCkpO1xuXHRcdHRoaXMubWFya2Vyc1ZpZXdNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtlcnNWaWV3TW9kZWwsIHRoaXMucGFuZWxTdGF0ZVsnbXVsdGlsaW5lJ10sIHRoaXMucGFuZWxTdGF0ZVsndmlld01vZGUnXSA/PyB0aGlzLmdldERlZmF1bHRWaWV3TW9kZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZVZpc2liaWxpdHkodmlzaWJsZSA9PiB0aGlzLm9uRGlkQ2hhbmdlTWFya2Vyc1ZpZXdWaXNpYmlsaXR5KHZpc2libGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tYXJrZXJzVmlld01vZGVsLm9uRGlkQ2hhbmdlVmlld01vZGUoXyA9PiB0aGlzLm9uRGlkQ2hhbmdlVmlld01vZGUoKSkpO1xuXG5cdFx0dGhpcy53aWRnZXRBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZXJzV2lkZ2V0QWNjZXNzaWJpbGl0eVByb3ZpZGVyKTtcblx0XHR0aGlzLndpZGdldElkZW50aXR5UHJvdmlkZXIgPSB7IGdldElkKGVsZW1lbnQ6IE1hcmtlckVsZW1lbnQgfCBNYXJrZXJUYWJsZUl0ZW0pIHsgcmV0dXJuIGVsZW1lbnQuaWQ7IH0gfTtcblxuXHRcdHRoaXMuc2V0Q3VycmVudEFjdGl2ZUVkaXRvcigpO1xuXG5cdFx0dGhpcy5maWx0ZXIgPSBuZXcgRmlsdGVyKEZpbHRlck9wdGlvbnMuRU1QVFkodXJpSWRlbnRpdHlTZXJ2aWNlKSk7XG5cdFx0dGhpcy5yYW5nZUhpZ2hsaWdodERlY29yYXRpb25zID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSYW5nZUhpZ2hsaWdodERlY29yYXRpb25zKSk7XG5cblx0XHR0aGlzLmZpbHRlcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgTWFya2Vyc0ZpbHRlcnMoe1xuXHRcdFx0ZmlsdGVySGlzdG9yeTogdGhpcy5wYW5lbFN0YXRlWydmaWx0ZXJIaXN0b3J5J10gfHwgW10sXG5cdFx0XHRzaG93RXJyb3JzOiB0aGlzLnBhbmVsU3RhdGVbJ3Nob3dFcnJvcnMnXSAhPT0gZmFsc2UsXG5cdFx0XHRzaG93V2FybmluZ3M6IHRoaXMucGFuZWxTdGF0ZVsnc2hvd1dhcm5pbmdzJ10gIT09IGZhbHNlLFxuXHRcdFx0c2hvd0luZm9zOiB0aGlzLnBhbmVsU3RhdGVbJ3Nob3dJbmZvcyddICE9PSBmYWxzZSxcblx0XHRcdGV4Y2x1ZGVkRmlsZXM6ICEhdGhpcy5wYW5lbFN0YXRlWyd1c2VGaWxlc0V4Y2x1ZGUnXSxcblx0XHRcdGFjdGl2ZUZpbGU6ICEhdGhpcy5wYW5lbFN0YXRlWydhY3RpdmVGaWxlJ10sXG5cdFx0fSwgdGhpcy5jb250ZXh0S2V5U2VydmljZSkpO1xuXG5cdFx0Ly8gVXBkYXRlIGZpbHRlciwgd2hlbmV2ZXIgdGhlIFwiZmlsZXMuZXhjbHVkZVwiIHNldHRpbmcgaXMgY2hhbmdlZFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKHRoaXMuZmlsdGVycy5leGNsdWRlZEZpbGVzICYmIGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2ZpbGVzLmV4Y2x1ZGUnKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUZpbHRlcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcigpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3Rlck5hdmlnYWJsZUNvbnRhaW5lcih7XG5cdFx0XHRuYW1lOiAnbWFya2Vyc1ZpZXcnLFxuXHRcdFx0Zm9jdXNOb3RpZmllcnM6IFt0aGlzLCB0aGlzLmZpbHRlcldpZGdldF0sXG5cdFx0XHRmb2N1c05leHRXaWRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuZmlsdGVyV2lkZ2V0Lmhhc0ZvY3VzKCkpIHtcblx0XHRcdFx0XHR0aGlzLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmb2N1c1ByZXZpb3VzV2lkZ2V0OiAoKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5maWx0ZXJXaWRnZXQuaGFzRm9jdXMoKSkge1xuXHRcdFx0XHRcdHRoaXMuZm9jdXNGaWx0ZXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KHBhcmVudCk7XG5cblx0XHRwYXJlbnQuY2xhc3NMaXN0LmFkZCgnbWFya2Vycy1wYW5lbCcpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIocGFyZW50LCAna2V5ZG93bicsIGUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKCF0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLm1pZ2h0UHJvZHVjZVByaW50YWJsZUNoYXJhY3RlcihldmVudCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5zb2Z0RGlzcGF0Y2goZXZlbnQsIGV2ZW50LnRhcmdldCk7XG5cdFx0XHRpZiAocmVzdWx0LmtpbmQgPT09IFJlc3VsdEtpbmQuTW9yZUNob3Jkc05lZWRlZCB8fCByZXN1bHQua2luZCA9PT0gUmVzdWx0S2luZC5LYkZvdW5kKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuZm9jdXNGaWx0ZXIoKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBwYW5lbENvbnRhaW5lciA9IGRvbS5hcHBlbmQocGFyZW50LCBkb20uJCgnLm1hcmtlcnMtcGFuZWwtY29udGFpbmVyJykpO1xuXG5cdFx0dGhpcy5jcmVhdGVBcmlhbExhYmVsRWxlbWVudChwYW5lbENvbnRhaW5lcik7XG5cblx0XHR0aGlzLmNyZWF0ZU1lc3NhZ2VCb3gocGFuZWxDb250YWluZXIpO1xuXG5cdFx0dGhpcy53aWRnZXRDb250YWluZXIgPSBkb20uYXBwZW5kKHBhbmVsQ29udGFpbmVyLCBkb20uJCgnLndpZGdldC1jb250YWluZXInKSk7XG5cdFx0dGhpcy5jcmVhdGVXaWRnZXQodGhpcy53aWRnZXRDb250YWluZXIpO1xuXG5cdFx0dGhpcy51cGRhdGVGaWx0ZXIoKTtcblx0XHR0aGlzLnJlbmRlckNvbnRlbnQoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUaXRsZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBNZXNzYWdlcy5NQVJLRVJTX1BBTkVMX1RJVExFX1BST0JMRU1TLnZhbHVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGxheW91dEJvZHlDb250ZW50KGhlaWdodDogbnVtYmVyID0gdGhpcy5jdXJyZW50SGVpZ2h0LCB3aWR0aDogbnVtYmVyID0gdGhpcy5jdXJyZW50V2lkdGgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5tZXNzYWdlQm94Q29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLm1lc3NhZ2VCb3hDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHR9XG5cdFx0dGhpcy53aWRnZXQubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXG5cdFx0dGhpcy5jdXJyZW50SGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdHRoaXMuY3VycmVudFdpZHRoID0gd2lkdGg7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblx0XHRpZiAoZG9tLmlzQWN0aXZlRWxlbWVudCh0aGlzLndpZGdldC5nZXRIVE1MRWxlbWVudCgpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmhhc05vUHJvYmxlbXMoKSkge1xuXHRcdFx0dGhpcy5tZXNzYWdlQm94Q29udGFpbmVyIS5mb2N1cygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLndpZGdldC5kb21Gb2N1cygpO1xuXHRcdFx0dGhpcy53aWRnZXQuc2V0TWFya2VyU2VsZWN0aW9uKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGZvY3VzRmlsdGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuZmlsdGVyV2lkZ2V0LmZvY3VzKCk7XG5cdH1cblxuXHRwdWJsaWMgdXBkYXRlQmFkZ2UodG90YWw6IG51bWJlciwgZmlsdGVyZWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuZmlsdGVyV2lkZ2V0LnVwZGF0ZUJhZGdlKHRvdGFsID09PSBmaWx0ZXJlZCB8fCB0b3RhbCA9PT0gMCA/IHVuZGVmaW5lZCA6IGxvY2FsaXplKCdzaG93aW5nIGZpbHRlcmVkIHByb2JsZW1zJywgXCJTaG93aW5nIHswfSBvZiB7MX1cIiwgZmlsdGVyZWQsIHRvdGFsKSk7XG5cdH1cblxuXHRwdWJsaWMgY2hlY2tNb3JlRmlsdGVycygpOiB2b2lkIHtcblx0XHR0aGlzLmZpbHRlcldpZGdldC5jaGVja01vcmVGaWx0ZXJzKCF0aGlzLmZpbHRlcnMuc2hvd0Vycm9ycyB8fCAhdGhpcy5maWx0ZXJzLnNob3dXYXJuaW5ncyB8fCAhdGhpcy5maWx0ZXJzLnNob3dJbmZvcyB8fCB0aGlzLmZpbHRlcnMuZXhjbHVkZWRGaWxlcyB8fCB0aGlzLmZpbHRlcnMuYWN0aXZlRmlsZSk7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJGaWx0ZXJUZXh0KCk6IHZvaWQge1xuXHRcdHRoaXMuZmlsdGVyV2lkZ2V0LnNldEZpbHRlclRleHQoJycpO1xuXHR9XG5cblx0cHVibGljIHNob3dRdWlja0ZpeGVzKG1hcmtlcjogTWFya2VyKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5tYXJrZXJzVmlld01vZGVsLmdldFZpZXdNb2RlbChtYXJrZXIpO1xuXHRcdGlmICh2aWV3TW9kZWwpIHtcblx0XHRcdHZpZXdNb2RlbC5xdWlja0ZpeEFjdGlvbi5ydW4oKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3BlbkZpbGVBdEVsZW1lbnQoZWxlbWVudDogYW55LCBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuLCBzaWRlQnlzaWRlOiBib29sZWFuLCBwaW5uZWQ6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRjb25zdCB7IHJlc291cmNlLCBzZWxlY3Rpb24gfSA9IGVsZW1lbnQgaW5zdGFuY2VvZiBNYXJrZXIgPyB7IHJlc291cmNlOiBlbGVtZW50LnJlc291cmNlLCBzZWxlY3Rpb246IGVsZW1lbnQucmFuZ2UgfSA6XG5cdFx0XHRlbGVtZW50IGluc3RhbmNlb2YgUmVsYXRlZEluZm9ybWF0aW9uID8geyByZXNvdXJjZTogZWxlbWVudC5yYXcucmVzb3VyY2UsIHNlbGVjdGlvbjogZWxlbWVudC5yYXcgfSA6XG5cdFx0XHRcdCdtYXJrZXInIGluIGVsZW1lbnQgPyB7IHJlc291cmNlOiBlbGVtZW50Lm1hcmtlci5yZXNvdXJjZSwgc2VsZWN0aW9uOiBlbGVtZW50Lm1hcmtlci5yYW5nZSB9IDpcblx0XHRcdFx0XHR7IHJlc291cmNlOiBudWxsLCBzZWxlY3Rpb246IG51bGwgfTtcblx0XHRpZiAocmVzb3VyY2UgJiYgc2VsZWN0aW9uKSB7XG5cdFx0XHR0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0c2VsZWN0aW9uLFxuXHRcdFx0XHRcdHByZXNlcnZlRm9jdXMsXG5cdFx0XHRcdFx0cGlubmVkLFxuXHRcdFx0XHRcdHJldmVhbElmVmlzaWJsZTogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0fSwgc2lkZUJ5c2lkZSA/IFNJREVfR1JPVVAgOiBBQ1RJVkVfR1JPVVApLnRoZW4oZWRpdG9yID0+IHtcblx0XHRcdFx0aWYgKGVkaXRvciAmJiBwcmVzZXJ2ZUZvY3VzKSB7XG5cdFx0XHRcdFx0dGhpcy5yYW5nZUhpZ2hsaWdodERlY29yYXRpb25zLmhpZ2hsaWdodFJhbmdlKHsgcmVzb3VyY2UsIHJhbmdlOiBzZWxlY3Rpb24gfSwgPElDb2RlRWRpdG9yPmVkaXRvci5nZXRDb250cm9sKCkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMucmFuZ2VIaWdobGlnaHREZWNvcmF0aW9ucy5yZW1vdmVIaWdobGlnaHRSYW5nZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJhbmdlSGlnaGxpZ2h0RGVjb3JhdGlvbnMucmVtb3ZlSGlnaGxpZ2h0UmFuZ2UoKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSByZWZyZXNoUGFuZWwobWFya2VyT3JDaGFuZ2U/OiBNYXJrZXIgfCBNYXJrZXJDaGFuZ2VzRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0Y29uc3QgaGFzU2VsZWN0aW9uID0gdGhpcy53aWRnZXQuZ2V0U2VsZWN0aW9uKCkubGVuZ3RoID4gMDtcblxuXHRcdFx0aWYgKG1hcmtlck9yQ2hhbmdlKSB7XG5cdFx0XHRcdGlmIChtYXJrZXJPckNoYW5nZSBpbnN0YW5jZW9mIE1hcmtlcikge1xuXHRcdFx0XHRcdHRoaXMud2lkZ2V0LnVwZGF0ZU1hcmtlcihtYXJrZXJPckNoYW5nZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKG1hcmtlck9yQ2hhbmdlLmFkZGVkLnNpemUgfHwgbWFya2VyT3JDaGFuZ2UucmVtb3ZlZC5zaXplKSB7XG5cdFx0XHRcdFx0XHQvLyBSZXNldCBjb21wbGV0ZSB3aWRnZXRcblx0XHRcdFx0XHRcdHRoaXMucmVzZXRXaWRnZXQoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gVXBkYXRlIHJlc291cmNlXG5cdFx0XHRcdFx0XHR0aGlzLndpZGdldC51cGRhdGUoWy4uLm1hcmtlck9yQ2hhbmdlLnVwZGF0ZWRdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFJlc2V0IGNvbXBsZXRlIHdpZGdldFxuXHRcdFx0XHR0aGlzLnJlc2V0V2lkZ2V0KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChoYXNTZWxlY3Rpb24pIHtcblx0XHRcdFx0dGhpcy53aWRnZXQuc2V0TWFya2VyU2VsZWN0aW9uKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY2FjaGVkRmlsdGVyU3RhdHMgPSB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCB7IHRvdGFsLCBmaWx0ZXJlZCB9ID0gdGhpcy5nZXRGaWx0ZXJTdGF0cygpO1xuXHRcdFx0dGhpcy50b2dnbGVWaXNpYmlsaXR5KHRvdGFsID09PSAwIHx8IGZpbHRlcmVkID09PSAwKTtcblx0XHRcdHRoaXMucmVuZGVyTWVzc2FnZSgpO1xuXG5cdFx0XHR0aGlzLnVwZGF0ZUJhZGdlKHRvdGFsLCBmaWx0ZXJlZCk7XG5cdFx0XHR0aGlzLmNoZWNrTW9yZUZpbHRlcnMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlVmlld1N0YXRlKG1hcmtlcj86IE1hcmtlcik6IHZvaWQge1xuXHRcdHRoaXMucmVmcmVzaFBhbmVsKG1hcmtlcik7XG5cdH1cblxuXHRwcml2YXRlIHJlc2V0V2lkZ2V0KCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0LnJlc2V0KHRoaXMuZ2V0UmVzb3VyY2VNYXJrZXJzKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVGaWx0ZXIoKSB7XG5cdFx0dGhpcy5maWx0ZXIub3B0aW9ucyA9IG5ldyBGaWx0ZXJPcHRpb25zKHRoaXMuZmlsdGVyV2lkZ2V0LmdldEZpbHRlclRleHQoKSwgdGhpcy5nZXRGaWxlc0V4Y2x1ZGVFeHByZXNzaW9ucygpLCB0aGlzLmZpbHRlcnMuc2hvd1dhcm5pbmdzLCB0aGlzLmZpbHRlcnMuc2hvd0Vycm9ycywgdGhpcy5maWx0ZXJzLnNob3dJbmZvcywgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UpO1xuXHRcdHRoaXMud2lkZ2V0LmZpbHRlck1hcmtlcnModGhpcy5nZXRSZXNvdXJjZU1hcmtlcnMoKSwgdGhpcy5maWx0ZXIub3B0aW9ucyk7XG5cblx0XHR0aGlzLmNhY2hlZEZpbHRlclN0YXRzID0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHsgdG90YWwsIGZpbHRlcmVkIH0gPSB0aGlzLmdldEZpbHRlclN0YXRzKCk7XG5cdFx0dGhpcy50b2dnbGVWaXNpYmlsaXR5KHRvdGFsID09PSAwIHx8IGZpbHRlcmVkID09PSAwKTtcblx0XHR0aGlzLnJlbmRlck1lc3NhZ2UoKTtcblxuXHRcdHRoaXMudXBkYXRlQmFkZ2UodG90YWwsIGZpbHRlcmVkKTtcblx0XHR0aGlzLmNoZWNrTW9yZUZpbHRlcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGVmYXVsdFZpZXdNb2RlKCk6IE1hcmtlcnNWaWV3TW9kZSB7XG5cdFx0c3dpdGNoICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oJ3Byb2JsZW1zLmRlZmF1bHRWaWV3TW9kZScpKSB7XG5cdFx0XHRjYXNlICd0YWJsZSc6XG5cdFx0XHRcdHJldHVybiBNYXJrZXJzVmlld01vZGUuVGFibGU7XG5cdFx0XHRjYXNlICd0cmVlJzpcblx0XHRcdFx0cmV0dXJuIE1hcmtlcnNWaWV3TW9kZS5UcmVlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIE1hcmtlcnNWaWV3TW9kZS5UcmVlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0RmlsZXNFeGNsdWRlRXhwcmVzc2lvbnMoKTogeyByb290OiBVUkk7IGV4cHJlc3Npb246IElFeHByZXNzaW9uIH1bXSB8IElFeHByZXNzaW9uIHtcblx0XHRpZiAoIXRoaXMuZmlsdGVycy5leGNsdWRlZEZpbGVzKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVycyA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRyZXR1cm4gd29ya3NwYWNlRm9sZGVycy5sZW5ndGhcblx0XHRcdD8gd29ya3NwYWNlRm9sZGVycy5tYXAod29ya3NwYWNlRm9sZGVyID0+ICh7IHJvb3Q6IHdvcmtzcGFjZUZvbGRlci51cmksIGV4cHJlc3Npb246IHRoaXMuZ2V0RmlsZXNFeGNsdWRlKHdvcmtzcGFjZUZvbGRlci51cmkpIH0pKVxuXHRcdFx0OiB0aGlzLmdldEZpbGVzRXhjbHVkZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRGaWxlc0V4Y2x1ZGUocmVzb3VyY2U/OiBVUkkpOiBJRXhwcmVzc2lvbiB7XG5cdFx0cmV0dXJuIGRlZXBDbG9uZSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdmaWxlcy5leGNsdWRlJywgeyByZXNvdXJjZSB9KSkgfHwge307XG5cdH1cblxuXHRwcml2YXRlIGdldFJlc291cmNlTWFya2VycygpOiBSZXNvdXJjZU1hcmtlcnNbXSB7XG5cdFx0aWYgKCF0aGlzLmZpbHRlcnMuYWN0aXZlRmlsZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMubWFya2Vyc01vZGVsLnJlc291cmNlTWFya2Vycztcblx0XHR9XG5cblx0XHRsZXQgcmVzb3VyY2VNYXJrZXJzOiBSZXNvdXJjZU1hcmtlcnNbXSA9IFtdO1xuXHRcdGlmICh0aGlzLmN1cnJlbnRBY3RpdmVSZXNvdXJjZSkge1xuXHRcdFx0Y29uc3QgYWN0aXZlUmVzb3VyY2VNYXJrZXJzID0gdGhpcy5tYXJrZXJzTW9kZWwuZ2V0UmVzb3VyY2VNYXJrZXJzKHRoaXMuY3VycmVudEFjdGl2ZVJlc291cmNlKTtcblx0XHRcdGlmIChhY3RpdmVSZXNvdXJjZU1hcmtlcnMpIHtcblx0XHRcdFx0cmVzb3VyY2VNYXJrZXJzID0gW2FjdGl2ZVJlc291cmNlTWFya2Vyc107XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc291cmNlTWFya2Vycztcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlTWVzc2FnZUJveChwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5tZXNzYWdlQm94Q29udGFpbmVyID0gZG9tLmFwcGVuZChwYXJlbnQsIGRvbS4kKCcubWVzc2FnZS1ib3gtY29udGFpbmVyJykpO1xuXHRcdHRoaXMubWVzc2FnZUJveENvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWxsZWRieScsICdtYXJrZXJzLXBhbmVsLWFyaWFsYWJlbCcpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVBcmlhbExhYmVsRWxlbWVudChwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5hcmlhTGFiZWxFbGVtZW50ID0gZG9tLmFwcGVuZChwYXJlbnQsIGRvbS4kKCcnKSk7XG5cdFx0dGhpcy5hcmlhTGFiZWxFbGVtZW50LnNldEF0dHJpYnV0ZSgnaWQnLCAnbWFya2Vycy1wYW5lbC1hcmlhbGFiZWwnKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlV2lkZ2V0KHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLndpZGdldCA9IHRoaXMubWFya2Vyc1ZpZXdNb2RlbC52aWV3TW9kZSA9PT0gTWFya2Vyc1ZpZXdNb2RlLlRhYmxlID8gdGhpcy5jcmVhdGVUYWJsZShwYXJlbnQpIDogdGhpcy5jcmVhdGVUcmVlKHBhcmVudCk7XG5cdFx0dGhpcy53aWRnZXREaXNwb3NhYmxlcy5hZGQodGhpcy53aWRnZXQpO1xuXG5cdFx0Y29uc3QgbWFya2VyRm9jdXNDb250ZXh0S2V5ID0gTWFya2Vyc0NvbnRleHRLZXlzLk1hcmtlckZvY3VzQ29udGV4dEtleS5iaW5kVG8odGhpcy53aWRnZXQuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IHJlbGF0ZWRJbmZvcm1hdGlvbkZvY3VzQ29udGV4dEtleSA9IE1hcmtlcnNDb250ZXh0S2V5cy5SZWxhdGVkSW5mb3JtYXRpb25Gb2N1c0NvbnRleHRLZXkuYmluZFRvKHRoaXMud2lkZ2V0LmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLndpZGdldERpc3Bvc2FibGVzLmFkZCh0aGlzLndpZGdldC5vbkRpZENoYW5nZUZvY3VzKGZvY3VzID0+IHtcblx0XHRcdG1hcmtlckZvY3VzQ29udGV4dEtleS5zZXQoZm9jdXMuZWxlbWVudHMuc29tZShlID0+IGUgaW5zdGFuY2VvZiBNYXJrZXIpKTtcblx0XHRcdHJlbGF0ZWRJbmZvcm1hdGlvbkZvY3VzQ29udGV4dEtleS5zZXQoZm9jdXMuZWxlbWVudHMuc29tZShlID0+IGUgaW5zdGFuY2VvZiBSZWxhdGVkSW5mb3JtYXRpb24pKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLndpZGdldERpc3Bvc2FibGVzLmFkZChFdmVudC5kZWJvdW5jZSh0aGlzLndpZGdldC5vbkRpZE9wZW4sIChsYXN0LCBldmVudCkgPT4gZXZlbnQsIDc1LCB0cnVlKShvcHRpb25zID0+IHtcblx0XHRcdHRoaXMub3BlbkZpbGVBdEVsZW1lbnQob3B0aW9ucy5lbGVtZW50LCAhIW9wdGlvbnMuZWRpdG9yT3B0aW9ucy5wcmVzZXJ2ZUZvY3VzLCBvcHRpb25zLnNpZGVCeVNpZGUsICEhb3B0aW9ucy5lZGl0b3JPcHRpb25zLnBpbm5lZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy53aWRnZXREaXNwb3NhYmxlcy5hZGQoRXZlbnQuYW55PGFueT4odGhpcy53aWRnZXQub25EaWRDaGFuZ2VTZWxlY3Rpb24sIHRoaXMud2lkZ2V0Lm9uRGlkQ2hhbmdlRm9jdXMpKCgpID0+IHtcblx0XHRcdGNvbnN0IGVsZW1lbnRzID0gWy4uLnRoaXMud2lkZ2V0LmdldFNlbGVjdGlvbigpLCAuLi50aGlzLndpZGdldC5nZXRGb2N1cygpXTtcblx0XHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIE1hcmtlcikge1xuXHRcdFx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMubWFya2Vyc1ZpZXdNb2RlbC5nZXRWaWV3TW9kZWwoZWxlbWVudCk7XG5cdFx0XHRcdFx0dmlld01vZGVsPy5zaG93TGlnaHRCdWxiKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLndpZGdldERpc3Bvc2FibGVzLmFkZCh0aGlzLndpZGdldC5vbkNvbnRleHRNZW51KHRoaXMub25Db250ZXh0TWVudSwgdGhpcykpO1xuXHRcdHRoaXMud2lkZ2V0RGlzcG9zYWJsZXMuYWRkKHRoaXMud2lkZ2V0Lm9uRGlkQ2hhbmdlU2VsZWN0aW9uKHRoaXMub25TZWxlY3RlZCwgdGhpcykpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUYWJsZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSVByb2JsZW1zV2lkZ2V0IHtcblx0XHRjb25zdCB0YWJsZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya2Vyc1RhYmxlLFxuXHRcdFx0ZG9tLmFwcGVuZChwYXJlbnQsIGRvbS4kKCcubWFya2Vycy10YWJsZS1jb250YWluZXInKSksXG5cdFx0XHR0aGlzLm1hcmtlcnNWaWV3TW9kZWwsXG5cdFx0XHR0aGlzLmdldFJlc291cmNlTWFya2VycygpLFxuXHRcdFx0dGhpcy5maWx0ZXIub3B0aW9ucyxcblx0XHRcdHtcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB0aGlzLndpZGdldEFjY2Vzc2liaWxpdHlQcm92aWRlcixcblx0XHRcdFx0ZG5kOiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlTGlzdERuREhhbmRsZXIsIChlbGVtZW50KSA9PiB7XG5cdFx0XHRcdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBNYXJrZXJUYWJsZUl0ZW0pIHtcblx0XHRcdFx0XHRcdHJldHVybiB3aXRoU2VsZWN0aW9uKGVsZW1lbnQucmVzb3VyY2UsIGVsZW1lbnQucmFuZ2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fSksXG5cdFx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiB0aGlzLndpZGdldElkZW50aXR5UHJvdmlkZXIsXG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogdHJ1ZSxcblx0XHRcdFx0c2VsZWN0aW9uTmF2aWdhdGlvbjogdHJ1ZVxuXHRcdFx0fSxcblx0XHQpO1xuXG5cdFx0cmV0dXJuIHRhYmxlO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUcmVlKHBhcmVudDogSFRNTEVsZW1lbnQpOiBJUHJvYmxlbXNXaWRnZXQge1xuXHRcdGNvbnN0IG9uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50ID0gbmV3IFJlbGF5PElUcmVlTm9kZTxhbnksIGFueT4+KCk7XG5cblx0XHRjb25zdCB0cmVlTGFiZWxzID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVscywgdGhpcyk7XG5cblx0XHRjb25zdCB2aXJ0dWFsRGVsZWdhdGUgPSBuZXcgVmlydHVhbERlbGVnYXRlKHRoaXMubWFya2Vyc1ZpZXdNb2RlbCk7XG5cdFx0Y29uc3QgcmVuZGVyZXJzID0gW1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZU1hcmtlcnNSZW5kZXJlciwgdHJlZUxhYmVscywgb25EaWRDaGFuZ2VSZW5kZXJOb2RlQ291bnQuZXZlbnQpLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZXJSZW5kZXJlciwgdGhpcy5tYXJrZXJzVmlld01vZGVsKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVsYXRlZEluZm9ybWF0aW9uUmVuZGVyZXIpXG5cdFx0XTtcblxuXHRcdGNvbnN0IHRyZWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtlcnNUcmVlLFxuXHRcdFx0J01hcmtlcnNWaWV3Jyxcblx0XHRcdGRvbS5hcHBlbmQocGFyZW50LCBkb20uJCgnLnRyZWUtY29udGFpbmVyLnNob3ctZmlsZS1pY29ucycpKSxcblx0XHRcdHZpcnR1YWxEZWxlZ2F0ZSxcblx0XHRcdHJlbmRlcmVycyxcblx0XHRcdHtcblx0XHRcdFx0ZmlsdGVyOiB0aGlzLmZpbHRlcixcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB0aGlzLndpZGdldEFjY2Vzc2liaWxpdHlQcm92aWRlcixcblx0XHRcdFx0aWRlbnRpdHlQcm92aWRlcjogdGhpcy53aWRnZXRJZGVudGl0eVByb3ZpZGVyLFxuXHRcdFx0XHRkbmQ6IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya2Vyc0xpc3REbkRIYW5kbGVyKSxcblx0XHRcdFx0ZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrOiAoZTogTWFya2VyRWxlbWVudCkgPT4gZSBpbnN0YW5jZW9mIE1hcmtlciAmJiBlLnJlbGF0ZWRJbmZvcm1hdGlvbi5sZW5ndGggPiAwLFxuXHRcdFx0XHRvdmVycmlkZVN0eWxlczogdGhpcy5nZXRMb2NhdGlvbkJhc2VkQ29sb3JzKCkubGlzdE92ZXJyaWRlU3R5bGVzLFxuXHRcdFx0XHRzZWxlY3Rpb25OYXZpZ2F0aW9uOiB0cnVlLFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IHRydWUsXG5cdFx0XHR9LFxuXHRcdCk7XG5cblx0XHRvbkRpZENoYW5nZVJlbmRlck5vZGVDb3VudC5pbnB1dCA9IHRyZWUub25EaWRDaGFuZ2VSZW5kZXJOb2RlQ291bnQ7XG5cblx0XHRyZXR1cm4gdHJlZTtcblx0fVxuXG5cdGNvbGxhcHNlQWxsKCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0LmNvbGxhcHNlTWFya2VycygpO1xuXHR9XG5cblx0c2V0TXVsdGlsaW5lKG11bHRpbGluZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMubWFya2Vyc1ZpZXdNb2RlbC5tdWx0aWxpbmUgPSBtdWx0aWxpbmU7XG5cdH1cblxuXHRzZXRWaWV3TW9kZSh2aWV3TW9kZTogTWFya2Vyc1ZpZXdNb2RlKTogdm9pZCB7XG5cdFx0dGhpcy5tYXJrZXJzVmlld01vZGVsLnZpZXdNb2RlID0gdmlld01vZGU7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlTWFya2Vyc1ZpZXdWaXNpYmlsaXR5KHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLm9uVmlzaWJsZURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdGZvciAoY29uc3QgZGlzcG9zYWJsZSBvZiB0aGlzLnJlSW5pdGlhbGl6ZSgpKSB7XG5cdFx0XHRcdHRoaXMub25WaXNpYmxlRGlzcG9zYWJsZXMuYWRkKGRpc3Bvc2FibGUpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5yZWZyZXNoUGFuZWwoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlSW5pdGlhbGl6ZSgpOiBJRGlzcG9zYWJsZVtdIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IFtdO1xuXG5cdFx0Ly8gTWFya2VycyBNb2RlbFxuXHRcdGNvbnN0IHJlYWRNYXJrZXJzID0gKHJlc291cmNlPzogVVJJKSA9PiB0aGlzLm1hcmtlclNlcnZpY2UucmVhZCh7IHJlc291cmNlLCBzZXZlcml0aWVzOiBNYXJrZXJTZXZlcml0eS5FcnJvciB8IE1hcmtlclNldmVyaXR5Lldhcm5pbmcgfCBNYXJrZXJTZXZlcml0eS5JbmZvIH0pO1xuXHRcdHRoaXMubWFya2Vyc01vZGVsLnNldFJlc291cmNlTWFya2Vycyhncm91cEJ5KHJlYWRNYXJrZXJzKCksIGNvbXBhcmVNYXJrZXJzQnlVcmkpLm1hcChncm91cCA9PiBbZ3JvdXBbMF0ucmVzb3VyY2UsIGdyb3VwXSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goRXZlbnQuZGVib3VuY2U8cmVhZG9ubHkgVVJJW10sIFJlc291cmNlTWFwPFVSST4+KHRoaXMubWFya2VyU2VydmljZS5vbk1hcmtlckNoYW5nZWQsIChyZXNvdXJjZXNNYXAsIHJlc291cmNlcykgPT4ge1xuXHRcdFx0cmVzb3VyY2VzTWFwID0gcmVzb3VyY2VzTWFwIHx8IG5ldyBSZXNvdXJjZU1hcDxVUkk+KCk7XG5cdFx0XHRyZXNvdXJjZXMuZm9yRWFjaChyZXNvdXJjZSA9PiByZXNvdXJjZXNNYXAuc2V0KHJlc291cmNlLCByZXNvdXJjZSkpO1xuXHRcdFx0cmV0dXJuIHJlc291cmNlc01hcDtcblx0XHR9LCA2NCkocmVzb3VyY2VzTWFwID0+IHtcblx0XHRcdHRoaXMubWFya2Vyc01vZGVsLnNldFJlc291cmNlTWFya2VycyhbLi4ucmVzb3VyY2VzTWFwLnZhbHVlcygpXS5tYXAocmVzb3VyY2UgPT4gW3Jlc291cmNlLCByZWFkTWFya2VycyhyZXNvdXJjZSldKSk7XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goRXZlbnQuYW55PE1hcmtlckNoYW5nZXNFdmVudCB8IHZvaWQ+KHRoaXMubWFya2Vyc01vZGVsLm9uRGlkQ2hhbmdlLCB0aGlzLmVkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UpKGNoYW5nZXMgPT4ge1xuXHRcdFx0aWYgKGNoYW5nZXMpIHtcblx0XHRcdFx0dGhpcy5vbkRpZENoYW5nZU1vZGVsKGNoYW5nZXMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5vbkFjdGl2ZUVkaXRvckNoYW5nZWQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5tYXJrZXJzTW9kZWwucmVzZXQoKSkpO1xuXG5cdFx0Ly8gTWFya2VycyBWaWV3IE1vZGVsXG5cdFx0dGhpcy5tYXJrZXJzTW9kZWwucmVzb3VyY2VNYXJrZXJzLmZvckVhY2gocmVzb3VyY2VNYXJrZXIgPT4gcmVzb3VyY2VNYXJrZXIubWFya2Vycy5mb3JFYWNoKG1hcmtlciA9PiB0aGlzLm1hcmtlcnNWaWV3TW9kZWwuYWRkKG1hcmtlcikpKTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKHRoaXMubWFya2Vyc1ZpZXdNb2RlbC5vbkRpZENoYW5nZShtYXJrZXIgPT4gdGhpcy5vbkRpZENoYW5nZVZpZXdTdGF0ZShtYXJrZXIpKSk7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5tYXJrZXJzTW9kZWwucmVzb3VyY2VNYXJrZXJzLmZvckVhY2gocmVzb3VyY2VNYXJrZXIgPT4gdGhpcy5tYXJrZXJzVmlld01vZGVsLnJlbW92ZShyZXNvdXJjZU1hcmtlci5yZXNvdXJjZSkpKSk7XG5cblx0XHQvLyBNYXJrZXJzIEZpbHRlcnNcblx0XHRkaXNwb3NhYmxlcy5wdXNoKHRoaXMuZmlsdGVycy5vbkRpZENoYW5nZSgoZXZlbnQ6IElNYXJrZXJzRmlsdGVyc0NoYW5nZUV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZXZlbnQuYWN0aXZlRmlsZSkge1xuXHRcdFx0XHR0aGlzLnJlZnJlc2hQYW5lbCgpO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5leGNsdWRlZEZpbGVzIHx8IGV2ZW50LnNob3dXYXJuaW5ncyB8fCBldmVudC5zaG93RXJyb3JzIHx8IGV2ZW50LnNob3dJbmZvcykge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUZpbHRlcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKHRoaXMuZmlsdGVyV2lkZ2V0Lm9uRGlkQ2hhbmdlRmlsdGVyVGV4dChlID0+IHRoaXMudXBkYXRlRmlsdGVyKCkpKTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKHRvRGlzcG9zYWJsZSgoKSA9PiB7IHRoaXMuY2FjaGVkRmlsdGVyU3RhdHMgPSB1bmRlZmluZWQ7IH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2godG9EaXNwb3NhYmxlKCgpID0+IHRoaXMucmFuZ2VIaWdobGlnaHREZWNvcmF0aW9ucy5yZW1vdmVIaWdobGlnaHRSYW5nZSgpKSk7XG5cblx0XHRyZXR1cm4gZGlzcG9zYWJsZXM7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlTW9kZWwoY2hhbmdlOiBNYXJrZXJDaGFuZ2VzRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCByZXNvdXJjZU1hcmtlcnMgPSBbLi4uY2hhbmdlLmFkZGVkLCAuLi5jaGFuZ2UucmVtb3ZlZCwgLi4uY2hhbmdlLnVwZGF0ZWRdO1xuXHRcdGNvbnN0IHJlc291cmNlczogVVJJW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHsgcmVzb3VyY2UgfSBvZiByZXNvdXJjZU1hcmtlcnMpIHtcblx0XHRcdHRoaXMubWFya2Vyc1ZpZXdNb2RlbC5yZW1vdmUocmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VNYXJrZXJzID0gdGhpcy5tYXJrZXJzTW9kZWwuZ2V0UmVzb3VyY2VNYXJrZXJzKHJlc291cmNlKTtcblx0XHRcdGlmIChyZXNvdXJjZU1hcmtlcnMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBtYXJrZXIgb2YgcmVzb3VyY2VNYXJrZXJzLm1hcmtlcnMpIHtcblx0XHRcdFx0XHR0aGlzLm1hcmtlcnNWaWV3TW9kZWwuYWRkKG1hcmtlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJlc291cmNlcy5wdXNoKHJlc291cmNlKTtcblx0XHR9XG5cdFx0dGhpcy5jdXJyZW50UmVzb3VyY2VHb3RBZGRlZFRvTWFya2Vyc0RhdGEgPSB0aGlzLmN1cnJlbnRSZXNvdXJjZUdvdEFkZGVkVG9NYXJrZXJzRGF0YSB8fCB0aGlzLmlzQ3VycmVudFJlc291cmNlR290QWRkZWRUb01hcmtlcnNEYXRhKHJlc291cmNlcyk7XG5cdFx0dGhpcy5yZWZyZXNoUGFuZWwoY2hhbmdlKTtcblx0XHR0aGlzLnVwZGF0ZVJhbmdlSGlnaGxpZ2h0cygpO1xuXHRcdGlmICh0aGlzLmN1cnJlbnRSZXNvdXJjZUdvdEFkZGVkVG9NYXJrZXJzRGF0YSkge1xuXHRcdFx0dGhpcy5hdXRvUmV2ZWFsKCk7XG5cdFx0XHR0aGlzLmN1cnJlbnRSZXNvdXJjZUdvdEFkZGVkVG9NYXJrZXJzRGF0YSA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VWaWV3TW9kZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy53aWRnZXRDb250YWluZXIgJiYgdGhpcy53aWRnZXQpIHtcblx0XHRcdHRoaXMud2lkZ2V0Q29udGFpbmVyLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHR0aGlzLndpZGdldERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0fVxuXG5cdFx0Ly8gU2F2ZSBzZWxlY3Rpb25cblx0XHRjb25zdCBzZWxlY3Rpb24gPSBuZXcgU2V0PE1hcmtlcj4oKTtcblx0XHRmb3IgKGNvbnN0IG1hcmtlciBvZiB0aGlzLndpZGdldC5nZXRTZWxlY3Rpb24oKSkge1xuXHRcdFx0aWYgKG1hcmtlciBpbnN0YW5jZW9mIFJlc291cmNlTWFya2Vycykge1xuXHRcdFx0XHRtYXJrZXIubWFya2Vycy5mb3JFYWNoKG0gPT4gc2VsZWN0aW9uLmFkZChtKSk7XG5cdFx0XHR9IGVsc2UgaWYgKG1hcmtlciBpbnN0YW5jZW9mIE1hcmtlciB8fCBtYXJrZXIgaW5zdGFuY2VvZiBNYXJrZXJUYWJsZUl0ZW0pIHtcblx0XHRcdFx0c2VsZWN0aW9uLmFkZChtYXJrZXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNhdmUgZm9jdXNcblx0XHRjb25zdCBmb2N1cyA9IG5ldyBTZXQ8TWFya2VyPigpO1xuXHRcdGZvciAoY29uc3QgbWFya2VyIG9mIHRoaXMud2lkZ2V0LmdldEZvY3VzKCkpIHtcblx0XHRcdGlmIChtYXJrZXIgaW5zdGFuY2VvZiBNYXJrZXIgfHwgbWFya2VyIGluc3RhbmNlb2YgTWFya2VyVGFibGVJdGVtKSB7XG5cdFx0XHRcdGZvY3VzLmFkZChtYXJrZXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENyZWF0ZSBuZXcgd2lkZ2V0XG5cdFx0dGhpcy5jcmVhdGVXaWRnZXQodGhpcy53aWRnZXRDb250YWluZXIpO1xuXHRcdHRoaXMucmVmcmVzaFBhbmVsKCk7XG5cblx0XHQvLyBSZXN0b3JlIHNlbGVjdGlvblxuXHRcdGlmIChzZWxlY3Rpb24uc2l6ZSA+IDApIHtcblx0XHRcdHRoaXMud2lkZ2V0LnNldE1hcmtlclNlbGVjdGlvbihBcnJheS5mcm9tKHNlbGVjdGlvbiksIEFycmF5LmZyb20oZm9jdXMpKTtcblx0XHRcdHRoaXMud2lkZ2V0LmRvbUZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpc0N1cnJlbnRSZXNvdXJjZUdvdEFkZGVkVG9NYXJrZXJzRGF0YShjaGFuZ2VkUmVzb3VyY2VzOiBVUklbXSkge1xuXHRcdGNvbnN0IGN1cnJlbnRseUFjdGl2ZVJlc291cmNlID0gdGhpcy5jdXJyZW50QWN0aXZlUmVzb3VyY2U7XG5cdFx0aWYgKCFjdXJyZW50bHlBY3RpdmVSZXNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCByZXNvdXJjZUZvckN1cnJlbnRBY3RpdmVSZXNvdXJjZSA9IHRoaXMuZ2V0UmVzb3VyY2VGb3JDdXJyZW50QWN0aXZlUmVzb3VyY2UoKTtcblx0XHRpZiAocmVzb3VyY2VGb3JDdXJyZW50QWN0aXZlUmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGNoYW5nZWRSZXNvdXJjZXMuc29tZShyID0+IHIudG9TdHJpbmcoKSA9PT0gY3VycmVudGx5QWN0aXZlUmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uQWN0aXZlRWRpdG9yQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHR0aGlzLnNldEN1cnJlbnRBY3RpdmVFZGl0b3IoKTtcblx0XHRpZiAodGhpcy5maWx0ZXJzLmFjdGl2ZUZpbGUpIHtcblx0XHRcdHRoaXMucmVmcmVzaFBhbmVsKCk7XG5cdFx0fVxuXHRcdHRoaXMuYXV0b1JldmVhbCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRDdXJyZW50QWN0aXZlRWRpdG9yKCk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvciA9IHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdFx0dGhpcy5jdXJyZW50QWN0aXZlUmVzb3VyY2UgPSBhY3RpdmVFZGl0b3IgPyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pID8/IG51bGwgOiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBvblNlbGVjdGVkKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMud2lkZ2V0LmdldFNlbGVjdGlvbigpO1xuXHRcdGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMubGFzdFNlbGVjdGVkUmVsYXRpdmVUb3AgPSB0aGlzLndpZGdldC5nZXRSZWxhdGl2ZVRvcChzZWxlY3Rpb25bMF0pIHx8IDA7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYXNOb1Byb2JsZW1zKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHsgdG90YWwsIGZpbHRlcmVkIH0gPSB0aGlzLmdldEZpbHRlclN0YXRzKCk7XG5cdFx0cmV0dXJuIHRvdGFsID09PSAwIHx8IGZpbHRlcmVkID09PSAwO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDb250ZW50KCk6IHZvaWQge1xuXHRcdHRoaXMuY2FjaGVkRmlsdGVyU3RhdHMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5yZXNldFdpZGdldCgpO1xuXHRcdHRoaXMudG9nZ2xlVmlzaWJpbGl0eSh0aGlzLmhhc05vUHJvYmxlbXMoKSk7XG5cdFx0dGhpcy5yZW5kZXJNZXNzYWdlKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck1lc3NhZ2UoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm1lc3NhZ2VCb3hDb250YWluZXIgfHwgIXRoaXMuYXJpYUxhYmVsRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRkb20uY2xlYXJOb2RlKHRoaXMubWVzc2FnZUJveENvbnRhaW5lcik7XG5cdFx0Y29uc3QgeyB0b3RhbCwgZmlsdGVyZWQgfSA9IHRoaXMuZ2V0RmlsdGVyU3RhdHMoKTtcblxuXHRcdGlmIChmaWx0ZXJlZCA9PT0gMCkge1xuXHRcdFx0dGhpcy5tZXNzYWdlQm94Q29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0dGhpcy5tZXNzYWdlQm94Q29udGFpbmVyLnNldEF0dHJpYnV0ZSgndGFiSW5kZXgnLCAnMCcpO1xuXHRcdFx0aWYgKHRoaXMuZmlsdGVycy5hY3RpdmVGaWxlKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyRmlsdGVyTWVzc2FnZUZvckFjdGl2ZUZpbGUodGhpcy5tZXNzYWdlQm94Q29udGFpbmVyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0b3RhbCA+IDApIHtcblx0XHRcdFx0XHR0aGlzLnJlbmRlckZpbHRlcmVkQnlGaWx0ZXJNZXNzYWdlKHRoaXMubWVzc2FnZUJveENvbnRhaW5lcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJOb1Byb2JsZW1zTWVzc2FnZSh0aGlzLm1lc3NhZ2VCb3hDb250YWluZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubWVzc2FnZUJveENvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0aWYgKGZpbHRlcmVkID09PSB0b3RhbCkge1xuXHRcdFx0XHR0aGlzLnNldEFyaWFMYWJlbChsb2NhbGl6ZSgnTm8gcHJvYmxlbXMgZmlsdGVyZWQnLCBcIlNob3dpbmcgezB9IHByb2JsZW1zXCIsIHRvdGFsKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnNldEFyaWFMYWJlbChsb2NhbGl6ZSgncHJvYmxlbXMgZmlsdGVyZWQnLCBcIlNob3dpbmcgezB9IG9mIHsxfSBwcm9ibGVtc1wiLCBmaWx0ZXJlZCwgdG90YWwpKTtcblx0XHRcdH1cblx0XHRcdHRoaXMubWVzc2FnZUJveENvbnRhaW5lci5yZW1vdmVBdHRyaWJ1dGUoJ3RhYkluZGV4Jyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJGaWx0ZXJNZXNzYWdlRm9yQWN0aXZlRmlsZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY3VycmVudEFjdGl2ZVJlc291cmNlICYmIHRoaXMubWFya2Vyc01vZGVsLmdldFJlc291cmNlTWFya2Vycyh0aGlzLmN1cnJlbnRBY3RpdmVSZXNvdXJjZSkpIHtcblx0XHRcdHRoaXMucmVuZGVyRmlsdGVyZWRCeUZpbHRlck1lc3NhZ2UoY29udGFpbmVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yZW5kZXJOb1Byb2JsZW1zTWVzc2FnZUZvckFjdGl2ZUZpbGUoY29udGFpbmVyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckZpbHRlcmVkQnlGaWx0ZXJNZXNzYWdlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBzcGFuMSA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnc3BhbicpKTtcblx0XHRzcGFuMS50ZXh0Q29udGVudCA9IE1lc3NhZ2VzLk1BUktFUlNfUEFORUxfTk9fUFJPQkxFTVNfRklMVEVSUztcblx0XHRjb25zdCBsaW5rID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCdhLm1lc3NhZ2VBY3Rpb24nKSk7XG5cdFx0bGluay50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdjbGVhckZpbHRlcicsIFwiQ2xlYXIgRmlsdGVyc1wiKTtcblx0XHRsaW5rLnNldEF0dHJpYnV0ZSgndGFiSW5kZXgnLCAnMCcpO1xuXHRcdGNvbnN0IHNwYW4yID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCdzcGFuJykpO1xuXHRcdHNwYW4yLnRleHRDb250ZW50ID0gJy4nO1xuXHRcdGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihsaW5rLCBkb20uRXZlbnRUeXBlLkNMSUNLLCAoKSA9PiB0aGlzLmNsZWFyRmlsdGVycygpKTtcblx0XHRkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIobGluaywgZG9tLkV2ZW50VHlwZS5LRVlfRE9XTiwgKGU6IElLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5FbnRlcikgfHwgZS5lcXVhbHMoS2V5Q29kZS5TcGFjZSkpIHtcblx0XHRcdFx0dGhpcy5jbGVhckZpbHRlcnMoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLnNldEFyaWFMYWJlbChNZXNzYWdlcy5NQVJLRVJTX1BBTkVMX05PX1BST0JMRU1TX0ZJTFRFUlMpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJOb1Byb2JsZW1zTWVzc2FnZUZvckFjdGl2ZUZpbGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IHNwYW4gPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgZG9tLiQoJ3NwYW4nKSk7XG5cdFx0c3Bhbi50ZXh0Q29udGVudCA9IE1lc3NhZ2VzLk1BUktFUlNfUEFORUxfTk9fUFJPQkxFTVNfQUNUSVZFX0ZJTEVfQlVJTFQ7XG5cdFx0dGhpcy5zZXRBcmlhTGFiZWwoTWVzc2FnZXMuTUFSS0VSU19QQU5FTF9OT19QUk9CTEVNU19BQ1RJVkVfRklMRV9CVUlMVCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck5vUHJvYmxlbXNNZXNzYWdlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBzcGFuID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCdzcGFuJykpO1xuXHRcdHNwYW4udGV4dENvbnRlbnQgPSBNZXNzYWdlcy5NQVJLRVJTX1BBTkVMX05PX1BST0JMRU1TX0JVSUxUO1xuXHRcdHRoaXMuc2V0QXJpYUxhYmVsKE1lc3NhZ2VzLk1BUktFUlNfUEFORUxfTk9fUFJPQkxFTVNfQlVJTFQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRBcmlhTGFiZWwobGFiZWw6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0LnNldEFyaWFMYWJlbChsYWJlbCk7XG5cdFx0dGhpcy5hcmlhTGFiZWxFbGVtZW50IS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBsYWJlbCk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRmlsdGVycygpOiB2b2lkIHtcblx0XHR0aGlzLmZpbHRlcldpZGdldC5zZXRGaWx0ZXJUZXh0KCcnKTtcblx0XHR0aGlzLmZpbHRlcnMuZXhjbHVkZWRGaWxlcyA9IGZhbHNlO1xuXHRcdHRoaXMuZmlsdGVycy5zaG93RXJyb3JzID0gdHJ1ZTtcblx0XHR0aGlzLmZpbHRlcnMuc2hvd1dhcm5pbmdzID0gdHJ1ZTtcblx0XHR0aGlzLmZpbHRlcnMuc2hvd0luZm9zID0gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXV0b1JldmVhbChmb2N1czogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0Ly8gTm8gbmVlZCB0byBhdXRvIHJldmVhbCBpZiBhY3RpdmUgZmlsZSBmaWx0ZXIgaXMgb25cblx0XHRpZiAodGhpcy5maWx0ZXJzLmFjdGl2ZUZpbGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgYXV0b1JldmVhbCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3Byb2JsZW1zLmF1dG9SZXZlYWwnKTtcblx0XHRpZiAodHlwZW9mIGF1dG9SZXZlYWwgPT09ICdib29sZWFuJyAmJiBhdXRvUmV2ZWFsKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50QWN0aXZlUmVzb3VyY2UgPSB0aGlzLmdldFJlc291cmNlRm9yQ3VycmVudEFjdGl2ZVJlc291cmNlKCk7XG5cdFx0XHR0aGlzLndpZGdldC5yZXZlYWxNYXJrZXJzKGN1cnJlbnRBY3RpdmVSZXNvdXJjZSwgZm9jdXMsIHRoaXMubGFzdFNlbGVjdGVkUmVsYXRpdmVUb3ApO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0UmVzb3VyY2VGb3JDdXJyZW50QWN0aXZlUmVzb3VyY2UoKTogUmVzb3VyY2VNYXJrZXJzIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudEFjdGl2ZVJlc291cmNlID8gdGhpcy5tYXJrZXJzTW9kZWwuZ2V0UmVzb3VyY2VNYXJrZXJzKHRoaXMuY3VycmVudEFjdGl2ZVJlc291cmNlKSA6IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVJhbmdlSGlnaGxpZ2h0cygpIHtcblx0XHR0aGlzLnJhbmdlSGlnaGxpZ2h0RGVjb3JhdGlvbnMucmVtb3ZlSGlnaGxpZ2h0UmFuZ2UoKTtcblx0XHRpZiAoZG9tLmlzQWN0aXZlRWxlbWVudCh0aGlzLndpZGdldC5nZXRIVE1MRWxlbWVudCgpKSkge1xuXHRcdFx0dGhpcy5oaWdobGlnaHRDdXJyZW50U2VsZWN0ZWRNYXJrZXJSYW5nZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGlnaGxpZ2h0Q3VycmVudFNlbGVjdGVkTWFya2VyUmFuZ2UoKSB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHRoaXMud2lkZ2V0LmdldFNlbGVjdGlvbigpID8/IFtdO1xuXG5cdFx0aWYgKHNlbGVjdGlvbnMubGVuZ3RoICE9PSAxKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gc2VsZWN0aW9uc1swXTtcblxuXHRcdGlmICghKHNlbGVjdGlvbiBpbnN0YW5jZW9mIE1hcmtlcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnJhbmdlSGlnaGxpZ2h0RGVjb3JhdGlvbnMuaGlnaGxpZ2h0UmFuZ2Uoc2VsZWN0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgb25Db250ZXh0TWVudShlOiBJVHJlZUNvbnRleHRNZW51RXZlbnQ8TWFya2VyRWxlbWVudCB8IG51bGw+IHwgSVRhYmxlQ29udGV4dE1lbnVFdmVudDxNYXJrZXJUYWJsZUl0ZW0+KTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGUuZWxlbWVudDtcblx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRlLmJyb3dzZXJFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGUuYnJvd3NlckV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZS5hbmNob3IsXG5cdFx0XHRtZW51SWQ6IE1lbnVJZC5Qcm9ibGVtc1BhbmVsQ29udGV4dCxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiB0aGlzLndpZGdldC5jb250ZXh0S2V5U2VydmljZSxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHRoaXMuZ2V0TWVudUFjdGlvbnMoZWxlbWVudCksXG5cdFx0XHRnZXRBY3Rpb25WaWV3SXRlbTogKGFjdGlvbikgPT4ge1xuXHRcdFx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5pZCk7XG5cdFx0XHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBBY3Rpb25WaWV3SXRlbShhY3Rpb24sIGFjdGlvbiwgeyBsYWJlbDogdHJ1ZSwga2V5YmluZGluZzoga2V5YmluZGluZy5nZXRMYWJlbCgpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXHRcdFx0b25IaWRlOiAod2FzQ2FuY2VsbGVkPzogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHRpZiAod2FzQ2FuY2VsbGVkKSB7XG5cdFx0XHRcdFx0dGhpcy53aWRnZXQuZG9tRm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRNZW51QWN0aW9ucyhlbGVtZW50OiBNYXJrZXJFbGVtZW50IHwgbnVsbCk6IElBY3Rpb25bXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJQWN0aW9uW10gPSBbXTtcblxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgTWFya2VyKSB7XG5cdFx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLm1hcmtlcnNWaWV3TW9kZWwuZ2V0Vmlld01vZGVsKGVsZW1lbnQpO1xuXHRcdFx0aWYgKHZpZXdNb2RlbCkge1xuXHRcdFx0XHRjb25zdCBxdWlja0ZpeEFjdGlvbnMgPSB2aWV3TW9kZWwucXVpY2tGaXhBY3Rpb24ucXVpY2tGaXhlcztcblx0XHRcdFx0aWYgKHF1aWNrRml4QWN0aW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCguLi5xdWlja0ZpeEFjdGlvbnMpO1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGdldEZvY3VzRWxlbWVudCgpOiBNYXJrZXJFbGVtZW50IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy53aWRnZXQuZ2V0Rm9jdXMoKVswXSA/PyB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Rm9jdXNlZFNlbGVjdGVkRWxlbWVudHMoKTogTWFya2VyRWxlbWVudFtdIHwgbnVsbCB7XG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmdldEZvY3VzRWxlbWVudCgpO1xuXHRcdGlmICghZm9jdXMpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLndpZGdldC5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAoc2VsZWN0aW9uLmluY2x1ZGVzKGZvY3VzKSkge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBNYXJrZXJFbGVtZW50W10gPSBbXTtcblx0XHRcdGZvciAoY29uc3Qgc2VsZWN0ZWQgb2Ygc2VsZWN0aW9uKSB7XG5cdFx0XHRcdGlmIChzZWxlY3RlZCkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKHNlbGVjdGVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIFtmb2N1c107XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldEFsbFJlc291cmNlTWFya2VycygpOiBSZXNvdXJjZU1hcmtlcnNbXSB7XG5cdFx0cmV0dXJuIHRoaXMubWFya2Vyc01vZGVsLnJlc291cmNlTWFya2Vycztcblx0fVxuXG5cdGdldEZpbHRlclN0YXRzKCk6IHsgdG90YWw6IG51bWJlcjsgZmlsdGVyZWQ6IG51bWJlciB9IHtcblx0XHRpZiAoIXRoaXMuY2FjaGVkRmlsdGVyU3RhdHMpIHtcblx0XHRcdHRoaXMuY2FjaGVkRmlsdGVyU3RhdHMgPSB7XG5cdFx0XHRcdHRvdGFsOiB0aGlzLm1hcmtlcnNNb2RlbC50b3RhbCxcblx0XHRcdFx0ZmlsdGVyZWQ6IHRoaXMud2lkZ2V0Py5nZXRWaXNpYmxlSXRlbUNvdW50KCkgPz8gMFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5jYWNoZWRGaWx0ZXJTdGF0cztcblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlVmlzaWJpbGl0eShoaWRlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy53aWRnZXQudG9nZ2xlVmlzaWJpbGl0eShoaWRlKTtcblx0XHR0aGlzLmxheW91dEJvZHlDb250ZW50KCk7XG5cdH1cblxuXHRvdmVycmlkZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5wYW5lbFN0YXRlWydmaWx0ZXInXSA9IHRoaXMuZmlsdGVyV2lkZ2V0LmdldEZpbHRlclRleHQoKTtcblx0XHR0aGlzLnBhbmVsU3RhdGVbJ2ZpbHRlckhpc3RvcnknXSA9IHRoaXMuZmlsdGVycy5maWx0ZXJIaXN0b3J5O1xuXHRcdHRoaXMucGFuZWxTdGF0ZVsnc2hvd0Vycm9ycyddID0gdGhpcy5maWx0ZXJzLnNob3dFcnJvcnM7XG5cdFx0dGhpcy5wYW5lbFN0YXRlWydzaG93V2FybmluZ3MnXSA9IHRoaXMuZmlsdGVycy5zaG93V2FybmluZ3M7XG5cdFx0dGhpcy5wYW5lbFN0YXRlWydzaG93SW5mb3MnXSA9IHRoaXMuZmlsdGVycy5zaG93SW5mb3M7XG5cdFx0dGhpcy5wYW5lbFN0YXRlWyd1c2VGaWxlc0V4Y2x1ZGUnXSA9IHRoaXMuZmlsdGVycy5leGNsdWRlZEZpbGVzO1xuXHRcdHRoaXMucGFuZWxTdGF0ZVsnYWN0aXZlRmlsZSddID0gdGhpcy5maWx0ZXJzLmFjdGl2ZUZpbGU7XG5cdFx0dGhpcy5wYW5lbFN0YXRlWydtdWx0aWxpbmUnXSA9IHRoaXMubWFya2Vyc1ZpZXdNb2RlbC5tdWx0aWxpbmU7XG5cdFx0dGhpcy5wYW5lbFN0YXRlWyd2aWV3TW9kZSddID0gdGhpcy5tYXJrZXJzVmlld01vZGVsLnZpZXdNb2RlO1xuXG5cdFx0dGhpcy5tZW1lbnRvLnNhdmVNZW1lbnRvKCk7XG5cdFx0c3VwZXIuc2F2ZVN0YXRlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG59XG5cbmNsYXNzIE1hcmtlcnNUcmVlIGV4dGVuZHMgV29ya2JlbmNoT2JqZWN0VHJlZTxNYXJrZXJFbGVtZW50LCBGaWx0ZXJEYXRhPiBpbXBsZW1lbnRzIElQcm9ibGVtc1dpZGdldCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSB2aXNpYmlsaXR5Q29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0dXNlcjogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRkZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8TWFya2VyRWxlbWVudD4sXG5cdFx0cmVuZGVyZXJzOiBJVHJlZVJlbmRlcmVyPE1hcmtlckVsZW1lbnQsIEZpbHRlckRhdGEsIGFueT5bXSxcblx0XHRvcHRpb25zOiBJV29ya2JlbmNoT2JqZWN0VHJlZU9wdGlvbnM8TWFya2VyRWxlbWVudCwgRmlsdGVyRGF0YT4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUxpc3RTZXJ2aWNlIGxpc3RTZXJ2aWNlOiBJTGlzdFNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIodXNlciwgY29udGFpbmVyLCBkZWxlZ2F0ZSwgcmVuZGVyZXJzLCBvcHRpb25zLCBpbnN0YW50aWF0aW9uU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIGxpc3RTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy52aXNpYmlsaXR5Q29udGV4dEtleSA9IE1hcmtlcnNDb250ZXh0S2V5cy5NYXJrZXJzVHJlZVZpc2liaWxpdHlDb250ZXh0S2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRjb2xsYXBzZU1hcmtlcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5jb2xsYXBzZUFsbCgpO1xuXHRcdHRoaXMuc2V0U2VsZWN0aW9uKFtdKTtcblx0XHR0aGlzLnNldEZvY3VzKFtdKTtcblx0XHR0aGlzLmdldEhUTUxFbGVtZW50KCkuZm9jdXMoKTtcblx0XHR0aGlzLmZvY3VzRmlyc3QoKTtcblx0fVxuXG5cdGZpbHRlck1hcmtlcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5yZWZpbHRlcigpO1xuXHR9XG5cblx0Z2V0VmlzaWJsZUl0ZW1Db3VudCgpOiBudW1iZXIge1xuXHRcdGxldCBmaWx0ZXJlZCA9IDA7XG5cdFx0Y29uc3Qgcm9vdCA9IHRoaXMuZ2V0Tm9kZSgpO1xuXG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZU1hcmtlck5vZGUgb2Ygcm9vdC5jaGlsZHJlbikge1xuXHRcdFx0Zm9yIChjb25zdCBtYXJrZXJOb2RlIG9mIHJlc291cmNlTWFya2VyTm9kZS5jaGlsZHJlbikge1xuXHRcdFx0XHRpZiAocmVzb3VyY2VNYXJrZXJOb2RlLnZpc2libGUgJiYgbWFya2VyTm9kZS52aXNpYmxlKSB7XG5cdFx0XHRcdFx0ZmlsdGVyZWQrKztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmaWx0ZXJlZDtcblx0fVxuXG5cdGlzVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucygnaGlkZGVuJyk7XG5cdH1cblxuXHR0b2dnbGVWaXNpYmlsaXR5KGhpZGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnZpc2liaWxpdHlDb250ZXh0S2V5LnNldCghaGlkZSk7XG5cdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgaGlkZSk7XG5cdH1cblxuXHRyZXNldChyZXNvdXJjZU1hcmtlcnM6IFJlc291cmNlTWFya2Vyc1tdKTogdm9pZCB7XG5cdFx0dGhpcy5zZXRDaGlsZHJlbihudWxsLCBJdGVyYWJsZS5tYXAocmVzb3VyY2VNYXJrZXJzLCBtID0+ICh7IGVsZW1lbnQ6IG0sIGNoaWxkcmVuOiBjcmVhdGVSZXNvdXJjZU1hcmtlcnNJdGVyYXRvcihtKSB9KSkpO1xuXHR9XG5cblx0cmV2ZWFsTWFya2VycyhhY3RpdmVSZXNvdXJjZTogUmVzb3VyY2VNYXJrZXJzIHwgbnVsbCwgZm9jdXM6IGJvb2xlYW4sIGxhc3RTZWxlY3RlZFJlbGF0aXZlVG9wOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoYWN0aXZlUmVzb3VyY2UpIHtcblx0XHRcdGlmICh0aGlzLmhhc0VsZW1lbnQoYWN0aXZlUmVzb3VyY2UpKSB7XG5cdFx0XHRcdGlmICghdGhpcy5pc0NvbGxhcHNlZChhY3RpdmVSZXNvdXJjZSkgJiYgdGhpcy5oYXNTZWxlY3RlZE1hcmtlckZvcihhY3RpdmVSZXNvdXJjZSkpIHtcblx0XHRcdFx0XHR0aGlzLnJldmVhbCh0aGlzLmdldFNlbGVjdGlvbigpWzBdLCBsYXN0U2VsZWN0ZWRSZWxhdGl2ZVRvcCk7XG5cdFx0XHRcdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNldEZvY3VzKHRoaXMuZ2V0U2VsZWN0aW9uKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmV4cGFuZChhY3RpdmVSZXNvdXJjZSk7XG5cdFx0XHRcdFx0dGhpcy5yZXZlYWwoYWN0aXZlUmVzb3VyY2UsIDApO1xuXG5cdFx0XHRcdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNldEZvY3VzKFthY3RpdmVSZXNvdXJjZV0pO1xuXHRcdFx0XHRcdFx0dGhpcy5zZXRTZWxlY3Rpb24oW2FjdGl2ZVJlc291cmNlXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChmb2N1cykge1xuXHRcdFx0dGhpcy5zZXRTZWxlY3Rpb24oW10pO1xuXHRcdFx0dGhpcy5mb2N1c0ZpcnN0KCk7XG5cdFx0fVxuXHR9XG5cblx0c2V0QXJpYUxhYmVsKGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmFyaWFMYWJlbCA9IGxhYmVsO1xuXHR9XG5cblx0c2V0TWFya2VyU2VsZWN0aW9uKHNlbGVjdGlvbj86IE1hcmtlcltdLCBmb2N1cz86IE1hcmtlcltdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy5zZXRTZWxlY3Rpb24oc2VsZWN0aW9uLm1hcChtID0+IHRoaXMuZmluZE1hcmtlck5vZGUobSkpKTtcblxuXHRcdFx0XHRpZiAoZm9jdXMgJiYgZm9jdXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHRoaXMuc2V0Rm9jdXMoZm9jdXMubWFwKGYgPT4gdGhpcy5maW5kTWFya2VyTm9kZShmKSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuc2V0Rm9jdXMoW3RoaXMuZmluZE1hcmtlck5vZGUoc2VsZWN0aW9uWzBdKV0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5yZXZlYWwodGhpcy5maW5kTWFya2VyTm9kZShzZWxlY3Rpb25bMF0pKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5nZXRTZWxlY3Rpb24oKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Y29uc3QgZmlyc3RWaXNpYmxlRWxlbWVudCA9IHRoaXMuZmlyc3RWaXNpYmxlRWxlbWVudDtcblx0XHRcdFx0Y29uc3QgbWFya2VyID0gZmlyc3RWaXNpYmxlRWxlbWVudCA/XG5cdFx0XHRcdFx0Zmlyc3RWaXNpYmxlRWxlbWVudCBpbnN0YW5jZW9mIFJlc291cmNlTWFya2VycyA/IGZpcnN0VmlzaWJsZUVsZW1lbnQubWFya2Vyc1swXSA6XG5cdFx0XHRcdFx0XHRmaXJzdFZpc2libGVFbGVtZW50IGluc3RhbmNlb2YgTWFya2VyID8gZmlyc3RWaXNpYmxlRWxlbWVudCA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGlmIChtYXJrZXIpIHtcblx0XHRcdFx0XHR0aGlzLnNldFNlbGVjdGlvbihbbWFya2VyXSk7XG5cdFx0XHRcdFx0dGhpcy5zZXRGb2N1cyhbbWFya2VyXSk7XG5cdFx0XHRcdFx0dGhpcy5yZXZlYWwobWFya2VyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZShyZXNvdXJjZU1hcmtlcnM6IFJlc291cmNlTWFya2Vyc1tdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZU1hcmtlciBvZiByZXNvdXJjZU1hcmtlcnMpIHtcblx0XHRcdGlmICh0aGlzLmhhc0VsZW1lbnQocmVzb3VyY2VNYXJrZXIpKSB7XG5cdFx0XHRcdHRoaXMuc2V0Q2hpbGRyZW4ocmVzb3VyY2VNYXJrZXIsIGNyZWF0ZVJlc291cmNlTWFya2Vyc0l0ZXJhdG9yKHJlc291cmNlTWFya2VyKSk7XG5cdFx0XHRcdHRoaXMucmVyZW5kZXIocmVzb3VyY2VNYXJrZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZU1hcmtlcihtYXJrZXI6IE1hcmtlcik6IHZvaWQge1xuXHRcdHRoaXMucmVyZW5kZXIobWFya2VyKTtcblx0fVxuXG5cdHByaXZhdGUgZmluZE1hcmtlck5vZGUobWFya2VyOiBNYXJrZXIpIHtcblx0XHRmb3IgKGNvbnN0IHJlc291cmNlTm9kZSBvZiB0aGlzLmdldE5vZGUoKS5jaGlsZHJlbikge1xuXHRcdFx0Zm9yIChjb25zdCBtYXJrZXJOb2RlIG9mIHJlc291cmNlTm9kZS5jaGlsZHJlbikge1xuXHRcdFx0XHRpZiAobWFya2VyTm9kZS5lbGVtZW50IGluc3RhbmNlb2YgTWFya2VyICYmIG1hcmtlck5vZGUuZWxlbWVudC5tYXJrZXIgPT09IG1hcmtlci5tYXJrZXIpIHtcblx0XHRcdFx0XHRyZXR1cm4gbWFya2VyTm9kZS5lbGVtZW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGhhc1NlbGVjdGVkTWFya2VyRm9yKHJlc291cmNlOiBSZXNvdXJjZU1hcmtlcnMpOiBib29sZWFuIHtcblx0XHRjb25zdCBzZWxlY3RlZEVsZW1lbnQgPSB0aGlzLmdldFNlbGVjdGlvbigpO1xuXHRcdGlmIChzZWxlY3RlZEVsZW1lbnQgJiYgc2VsZWN0ZWRFbGVtZW50Lmxlbmd0aCA+IDApIHtcblx0XHRcdGlmIChzZWxlY3RlZEVsZW1lbnRbMF0gaW5zdGFuY2VvZiBNYXJrZXIpIHtcblx0XHRcdFx0aWYgKHJlc291cmNlLmhhcygoPE1hcmtlcj5zZWxlY3RlZEVsZW1lbnRbMF0pLm1hcmtlci5yZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgbGF5b3V0KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5jb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHRzdXBlci5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdH1cbn1cblxuY2xhc3MgTWFya2Vyc0xpc3REbkRIYW5kbGVyIGV4dGVuZHMgUmVzb3VyY2VMaXN0RG5ESGFuZGxlcjxNYXJrZXJFbGVtZW50IHwgTWFya2VyVGFibGVJdGVtPiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihlbGVtZW50ID0+IHtcblx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgTWFya2VyVGFibGVJdGVtKSB7XG5cdFx0XHRcdHJldHVybiB3aXRoU2VsZWN0aW9uKGVsZW1lbnQucmVzb3VyY2UsIGVsZW1lbnQucmFuZ2UpO1xuXHRcdFx0fSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgUmVzb3VyY2VNYXJrZXJzKSB7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50LnJlc291cmNlO1xuXHRcdFx0fSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgTWFya2VyKSB7XG5cdFx0XHRcdHJldHVybiB3aXRoU2VsZWN0aW9uKGVsZW1lbnQucmVzb3VyY2UsIGVsZW1lbnQucmFuZ2UpO1xuXHRcdFx0fSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgUmVsYXRlZEluZm9ybWF0aW9uKSB7XG5cdFx0XHRcdHJldHVybiB3aXRoU2VsZWN0aW9uKGVsZW1lbnQucmF3LnJlc291cmNlLCBlbGVtZW50LnJhdyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9LCBpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgb25XaWxsRHJhZ0VsZW1lbnRzKGVsZW1lbnRzOiAoTWFya2VyRWxlbWVudCB8IE1hcmtlclRhYmxlSXRlbSlbXSwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KSB7XG5cdFx0Y29uc3QgZGF0YSA9IGVsZW1lbnRzLm1hcCgoZSk6IE1hcmtlclRyYW5zZmVyRGF0YSB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRpZiAoZSBpbnN0YW5jZW9mIFJlbGF0ZWRJbmZvcm1hdGlvbiB8fCBlIGluc3RhbmNlb2YgTWFya2VyKSB7XG5cdFx0XHRcdHJldHVybiBlLm1hcmtlcjtcblx0XHRcdH1cblx0XHRcdGlmIChlIGluc3RhbmNlb2YgUmVzb3VyY2VNYXJrZXJzKSB7XG5cdFx0XHRcdHJldHVybiB7IHVyaTogZS5yZXNvdXJjZSB9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9KS5maWx0ZXIoaXNEZWZpbmVkKTtcblxuXHRcdGlmICghZGF0YS5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmaWxsSW5NYXJrZXJzRHJhZ0RhdGEoZGF0YSwgb3JpZ2luYWxFdmVudCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUVQLFlBQVksU0FBUztB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
