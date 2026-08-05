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
import { localize } from "../../../../nls.js";
import * as DOM from "../../../../base/browser/dom.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchTable } from "../../../../platform/list/browser/listService.js";
import { HighlightedLabel } from "../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { compareMarkersByUri, Marker, MarkerTableItem } from "./markersModel.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { SeverityIcon } from "../../../../base/browser/ui/severityIcon/severityIcon.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { FilterOptions } from "./markersFilterOptions.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { QuickFixAction, QuickFixActionViewItem } from "./markersViewActions.js";
import { DomEmitter } from "../../../../base/browser/event.js";
import Messages from "./messages.js";
import { isUndefinedOrNull } from "../../../../base/common/types.js";
import { Range } from "../../../../editor/common/core/range.js";
import { unsupportedSchemas } from "../../../../platform/markers/common/markerService.js";
import Severity from "../../../../base/common/severity.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const $ = DOM.$;
let MarkerSeverityColumnRenderer = class {
  constructor(markersViewModel, instantiationService) {
    this.markersViewModel = markersViewModel;
    this.instantiationService = instantiationService;
    this.templateId = MarkerSeverityColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const severityColumn = DOM.append(container, $(".severity"));
    const icon = DOM.append(severityColumn, $(""));
    const actionBarColumn = DOM.append(container, $(".actions"));
    const actionBar = new ActionBar(actionBarColumn, {
      actionViewItemProvider: (action, options) => action.id === QuickFixAction.ID ? this.instantiationService.createInstance(QuickFixActionViewItem, action, options) : void 0
    });
    return { actionBar, icon };
  }
  renderElement(element, index, templateData, height) {
    const toggleQuickFix = (enabled) => {
      if (!isUndefinedOrNull(enabled)) {
        const container = DOM.findParentWithClass(templateData.icon, "monaco-table-td");
        container.classList.toggle("quickFix", enabled);
      }
    };
    templateData.icon.title = MarkerSeverity.toString(element.marker.severity);
    templateData.icon.className = `marker-icon ${Severity.toString(MarkerSeverity.toSeverity(element.marker.severity))} codicon ${SeverityIcon.className(MarkerSeverity.toSeverity(element.marker.severity))}`;
    templateData.actionBar.clear();
    const viewModel = this.markersViewModel.getViewModel(element);
    if (viewModel) {
      const quickFixAction = viewModel.quickFixAction;
      templateData.actionBar.push([quickFixAction], { icon: true, label: false });
      toggleQuickFix(viewModel.quickFixAction.enabled);
      quickFixAction.onDidChange(({ enabled }) => toggleQuickFix(enabled));
      quickFixAction.onShowQuickFixes(() => {
        const quickFixActionViewItem = templateData.actionBar.viewItems[0];
        if (quickFixActionViewItem) {
          quickFixActionViewItem.showQuickFixes();
        }
      });
    }
  }
  disposeTemplate(templateData) {
  }
};
MarkerSeverityColumnRenderer.TEMPLATE_ID = "severity";
MarkerSeverityColumnRenderer = __decorateClass([
  __decorateParam(1, IInstantiationService)
], MarkerSeverityColumnRenderer);
let MarkerCodeColumnRenderer = class {
  constructor(hoverService, openerService) {
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.templateId = MarkerCodeColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const templateDisposable = new DisposableStore();
    const codeColumn = DOM.append(container, $(".code"));
    const sourceLabel = templateDisposable.add(new HighlightedLabel(codeColumn));
    sourceLabel.element.classList.add("source-label");
    const codeLabel = templateDisposable.add(new HighlightedLabel(codeColumn));
    codeLabel.element.classList.add("code-label");
    const codeLink = templateDisposable.add(new Link(codeColumn, { href: "", label: "" }, {}, this.hoverService, this.openerService));
    return { codeColumn, sourceLabel, codeLabel, codeLink, templateDisposable };
  }
  renderElement(element, index, templateData, height) {
    templateData.codeColumn.classList.remove("code-label");
    templateData.codeColumn.classList.remove("code-link");
    if (element.marker.source && element.marker.code) {
      if (typeof element.marker.code === "string") {
        templateData.codeColumn.classList.add("code-label");
        templateData.codeColumn.title = `${element.marker.source} (${element.marker.code})`;
        templateData.sourceLabel.set(element.marker.source, element.sourceMatches);
        templateData.codeLabel.set(element.marker.code, element.codeMatches);
      } else {
        templateData.codeColumn.classList.add("code-link");
        templateData.codeColumn.title = `${element.marker.source} (${element.marker.code.value})`;
        templateData.sourceLabel.set(element.marker.source, element.sourceMatches);
        const codeLinkLabel = templateData.templateDisposable.add(new HighlightedLabel($(".code-link-label")));
        codeLinkLabel.set(element.marker.code.value, element.codeMatches);
        templateData.codeLink.link = {
          href: element.marker.code.target.toString(true),
          title: element.marker.code.target.toString(true),
          label: codeLinkLabel.element
        };
      }
    } else {
      templateData.codeColumn.title = "";
      templateData.sourceLabel.set("-");
    }
  }
  disposeTemplate(templateData) {
    templateData.templateDisposable.dispose();
  }
};
MarkerCodeColumnRenderer.TEMPLATE_ID = "code";
MarkerCodeColumnRenderer = __decorateClass([
  __decorateParam(0, IHoverService),
  __decorateParam(1, IOpenerService)
], MarkerCodeColumnRenderer);
const _MarkerMessageColumnRenderer = class _MarkerMessageColumnRenderer {
  constructor() {
    this.templateId = _MarkerMessageColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const columnElement = DOM.append(container, $(".message"));
    const highlightedLabel = new HighlightedLabel(columnElement);
    return { columnElement, highlightedLabel };
  }
  renderElement(element, index, templateData, height) {
    templateData.columnElement.title = element.marker.message;
    templateData.highlightedLabel.set(element.marker.message, element.messageMatches);
  }
  disposeTemplate(templateData) {
    templateData.highlightedLabel.dispose();
  }
};
_MarkerMessageColumnRenderer.TEMPLATE_ID = "message";
let MarkerMessageColumnRenderer = _MarkerMessageColumnRenderer;
let MarkerFileColumnRenderer = class {
  constructor(labelService) {
    this.labelService = labelService;
    this.templateId = MarkerFileColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const columnElement = DOM.append(container, $(".file"));
    const fileLabel = new HighlightedLabel(columnElement);
    fileLabel.element.classList.add("file-label");
    const positionLabel = new HighlightedLabel(columnElement);
    positionLabel.element.classList.add("file-position");
    return { columnElement, fileLabel, positionLabel };
  }
  renderElement(element, index, templateData, height) {
    const positionLabel = Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(element.marker.startLineNumber, element.marker.startColumn);
    templateData.columnElement.title = `${this.labelService.getUriLabel(element.marker.resource, { relative: false })} ${positionLabel}`;
    templateData.fileLabel.set(this.labelService.getUriLabel(element.marker.resource, { relative: true }), element.fileMatches);
    templateData.positionLabel.set(positionLabel, void 0);
  }
  disposeTemplate(templateData) {
    templateData.fileLabel.dispose();
    templateData.positionLabel.dispose();
  }
};
MarkerFileColumnRenderer.TEMPLATE_ID = "file";
MarkerFileColumnRenderer = __decorateClass([
  __decorateParam(0, ILabelService)
], MarkerFileColumnRenderer);
const _MarkerSourceColumnRenderer = class _MarkerSourceColumnRenderer {
  constructor() {
    this.templateId = _MarkerSourceColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const columnElement = DOM.append(container, $(".source"));
    const highlightedLabel = new HighlightedLabel(columnElement);
    return { columnElement, highlightedLabel };
  }
  renderElement(element, index, templateData, height) {
    templateData.columnElement.title = element.marker.source ?? "";
    templateData.highlightedLabel.set(element.marker.source ?? "", element.sourceMatches);
  }
  disposeTemplate(templateData) {
    templateData.highlightedLabel.dispose();
  }
};
_MarkerSourceColumnRenderer.TEMPLATE_ID = "source";
let MarkerSourceColumnRenderer = _MarkerSourceColumnRenderer;
const _MarkersTableVirtualDelegate = class _MarkersTableVirtualDelegate {
  constructor() {
    this.headerRowHeight = _MarkersTableVirtualDelegate.HEADER_ROW_HEIGHT;
  }
  getHeight(item) {
    return _MarkersTableVirtualDelegate.ROW_HEIGHT;
  }
};
_MarkersTableVirtualDelegate.HEADER_ROW_HEIGHT = 24;
_MarkersTableVirtualDelegate.ROW_HEIGHT = 24;
let MarkersTableVirtualDelegate = _MarkersTableVirtualDelegate;
let MarkersTable = class extends Disposable {
  constructor(container, markersViewModel, resourceMarkers, filterOptions, options, instantiationService, labelService) {
    super();
    this.container = container;
    this.markersViewModel = markersViewModel;
    this.resourceMarkers = resourceMarkers;
    this.filterOptions = filterOptions;
    this.instantiationService = instantiationService;
    this.labelService = labelService;
    this._itemCount = 0;
    this.table = this.instantiationService.createInstance(
      WorkbenchTable,
      "Markers",
      this.container,
      new MarkersTableVirtualDelegate(),
      [
        {
          label: "",
          tooltip: "",
          weight: 0,
          minimumWidth: 36,
          maximumWidth: 36,
          templateId: MarkerSeverityColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("codeColumnLabel", "Code"),
          tooltip: "",
          weight: 1,
          minimumWidth: 100,
          maximumWidth: 300,
          templateId: MarkerCodeColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("messageColumnLabel", "Message"),
          tooltip: "",
          weight: 4,
          templateId: MarkerMessageColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("fileColumnLabel", "File"),
          tooltip: "",
          weight: 2,
          templateId: MarkerFileColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("sourceColumnLabel", "Source"),
          tooltip: "",
          weight: 1,
          minimumWidth: 100,
          maximumWidth: 300,
          templateId: MarkerSourceColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        }
      ],
      [
        this.instantiationService.createInstance(MarkerSeverityColumnRenderer, this.markersViewModel),
        this.instantiationService.createInstance(MarkerCodeColumnRenderer),
        this.instantiationService.createInstance(MarkerMessageColumnRenderer),
        this.instantiationService.createInstance(MarkerFileColumnRenderer),
        this.instantiationService.createInstance(MarkerSourceColumnRenderer)
      ],
      options
    );
    const list = this.table.domNode.querySelector(".monaco-list-rows");
    const onRowHover = Event.chain(
      this._register(new DomEmitter(list, "mouseover")).event,
      ($2) => $2.map((e) => DOM.findParentWithClass(e.target, "monaco-list-row", "monaco-list-rows")).filter((e) => !!e).map((e) => parseInt(e.getAttribute("data-index")))
    );
    const onListLeave = Event.map(this._register(new DomEmitter(list, "mouseleave")).event, () => -1);
    const onRowHoverOrLeave = Event.latch(Event.any(onRowHover, onListLeave));
    const onRowPermanentHover = Event.debounce(onRowHoverOrLeave, (_, e) => e, 500);
    this._register(onRowPermanentHover((e) => {
      if (e !== -1 && this.table.row(e)) {
        this.markersViewModel.onMarkerMouseHover(this.table.row(e));
      }
    }));
  }
  get contextKeyService() {
    return this.table.contextKeyService;
  }
  get onContextMenu() {
    return this.table.onContextMenu;
  }
  get onDidOpen() {
    return this.table.onDidOpen;
  }
  get onDidChangeFocus() {
    return this.table.onDidChangeFocus;
  }
  get onDidChangeSelection() {
    return this.table.onDidChangeSelection;
  }
  collapseMarkers() {
  }
  domFocus() {
    this.table.domFocus();
  }
  filterMarkers(resourceMarkers, filterOptions) {
    this.filterOptions = filterOptions;
    this.reset(resourceMarkers);
  }
  getFocus() {
    const focus = this.table.getFocus();
    return focus.length > 0 ? [...focus.map((f) => this.table.row(f))] : [];
  }
  getHTMLElement() {
    return this.table.getHTMLElement();
  }
  getRelativeTop(marker) {
    return marker ? this.table.getRelativeTop(this.table.indexOf(marker)) : null;
  }
  getSelection() {
    const selection = this.table.getSelection();
    return selection.length > 0 ? [...selection.map((i) => this.table.row(i))] : [];
  }
  getVisibleItemCount() {
    return this._itemCount;
  }
  isVisible() {
    return !this.container.classList.contains("hidden");
  }
  layout(height, width) {
    this.container.style.height = `${height}px`;
    this.table.layout(height, width);
  }
  reset(resourceMarkers) {
    this.resourceMarkers = resourceMarkers;
    const items = [];
    for (const resourceMarker of this.resourceMarkers) {
      for (const marker of resourceMarker.markers) {
        if (unsupportedSchemas.has(marker.resource.scheme)) {
          continue;
        }
        if (this.filterOptions.excludesMatcher.matches(marker.resource)) {
          continue;
        }
        if (this.filterOptions.includesMatcher.matches(marker.resource)) {
          items.push(new MarkerTableItem(marker));
          continue;
        }
        const matchesSeverity = this.filterOptions.showErrors && MarkerSeverity.Error === marker.marker.severity || this.filterOptions.showWarnings && MarkerSeverity.Warning === marker.marker.severity || this.filterOptions.showInfos && MarkerSeverity.Info === marker.marker.severity;
        if (!matchesSeverity) {
          continue;
        }
        if (this.filterOptions.textFilter.text) {
          const sourceMatches = marker.marker.source ? FilterOptions._filter(this.filterOptions.textFilter.text, marker.marker.source) ?? void 0 : void 0;
          const codeMatches = marker.marker.code ? FilterOptions._filter(this.filterOptions.textFilter.text, typeof marker.marker.code === "string" ? marker.marker.code : marker.marker.code.value) ?? void 0 : void 0;
          const messageMatches = FilterOptions._messageFilter(this.filterOptions.textFilter.text, marker.marker.message) ?? void 0;
          const fileMatches = FilterOptions._messageFilter(this.filterOptions.textFilter.text, this.labelService.getUriLabel(marker.resource, { relative: true })) ?? void 0;
          const matched = sourceMatches || codeMatches || messageMatches || fileMatches;
          if (matched && !this.filterOptions.textFilter.negate || !matched && this.filterOptions.textFilter.negate) {
            items.push(new MarkerTableItem(marker, sourceMatches, codeMatches, messageMatches, fileMatches));
          }
          continue;
        }
        items.push(new MarkerTableItem(marker));
      }
    }
    this._itemCount = items.length;
    this.table.splice(0, Number.POSITIVE_INFINITY, items.sort((a, b) => {
      let result = MarkerSeverity.compare(a.marker.severity, b.marker.severity);
      if (result === 0) {
        result = compareMarkersByUri(a.marker, b.marker);
      }
      if (result === 0) {
        result = Range.compareRangesUsingStarts(a.marker, b.marker);
      }
      return result;
    }));
  }
  revealMarkers(activeResource, focus, lastSelectedRelativeTop) {
    if (activeResource) {
      const activeResourceIndex = this.resourceMarkers.indexOf(activeResource);
      if (activeResourceIndex !== -1) {
        if (this.hasSelectedMarkerFor(activeResource)) {
          const tableSelection = this.table.getSelection();
          this.table.reveal(tableSelection[0], lastSelectedRelativeTop);
          if (focus) {
            this.table.setFocus(tableSelection);
          }
        } else {
          this.table.reveal(activeResourceIndex, 0);
          if (focus) {
            this.table.setFocus([activeResourceIndex]);
            this.table.setSelection([activeResourceIndex]);
          }
        }
      }
    } else if (focus) {
      this.table.setSelection([]);
      this.table.focusFirst();
    }
  }
  setAriaLabel(label) {
    this.table.domNode.ariaLabel = label;
  }
  setMarkerSelection(selection, focus) {
    if (this.isVisible()) {
      if (selection && selection.length > 0) {
        this.table.setSelection(selection.map((m) => this.findMarkerIndex(m)));
        if (focus && focus.length > 0) {
          this.table.setFocus(focus.map((f) => this.findMarkerIndex(f)));
        } else {
          this.table.setFocus([this.findMarkerIndex(selection[0])]);
        }
        this.table.reveal(this.findMarkerIndex(selection[0]));
      } else if (this.getSelection().length === 0 && this.getVisibleItemCount() > 0) {
        this.table.setSelection([0]);
        this.table.setFocus([0]);
        this.table.reveal(0);
      }
    }
  }
  toggleVisibility(hide) {
    this.container.classList.toggle("hidden", hide);
  }
  update(resourceMarkers) {
    for (const resourceMarker of resourceMarkers) {
      const index = this.resourceMarkers.indexOf(resourceMarker);
      this.resourceMarkers.splice(index, 1, resourceMarker);
    }
    this.reset(this.resourceMarkers);
  }
  updateMarker(marker) {
    this.table.rerender();
  }
  findMarkerIndex(marker) {
    for (let index = 0; index < this.table.length; index++) {
      if (this.table.row(index).marker === marker.marker) {
        return index;
      }
    }
    return -1;
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
};
MarkersTable = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILabelService)
], MarkersTable);
export {
  MarkersTable
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZXJzL2Jyb3dzZXIvbWFya2Vyc1RhYmxlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJVGFibGVDb250ZXh0TWVudUV2ZW50LCBJVGFibGVFdmVudCwgSVRhYmxlUmVuZGVyZXIsIElUYWJsZVZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90YWJsZS90YWJsZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbkV2ZW50LCBJV29ya2JlbmNoVGFibGVPcHRpb25zLCBXb3JrYmVuY2hUYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBIaWdobGlnaHRlZExhYmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hpZ2hsaWdodGVkbGFiZWwvaGlnaGxpZ2h0ZWRMYWJlbC5qcyc7XG5pbXBvcnQgeyBjb21wYXJlTWFya2Vyc0J5VXJpLCBNYXJrZXIsIE1hcmtlclRhYmxlSXRlbSwgUmVzb3VyY2VNYXJrZXJzIH0gZnJvbSAnLi9tYXJrZXJzTW9kZWwuanMnO1xuaW1wb3J0IHsgTWFya2VyU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IFNldmVyaXR5SWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zZXZlcml0eUljb24vc2V2ZXJpdHlJY29uLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgRmlsdGVyT3B0aW9ucyB9IGZyb20gJy4vbWFya2Vyc0ZpbHRlck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGluayB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9icm93c2VyL2xpbmsuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBNYXJrZXJzVmlld01vZGVsIH0gZnJvbSAnLi9tYXJrZXJzVHJlZVZpZXdlci5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBRdWlja0ZpeEFjdGlvbiwgUXVpY2tGaXhBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4vbWFya2Vyc1ZpZXdBY3Rpb25zLmpzJztcbmltcG9ydCB7IERvbUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZXZlbnQuanMnO1xuaW1wb3J0IE1lc3NhZ2VzIGZyb20gJy4vbWVzc2FnZXMuanMnO1xuaW1wb3J0IHsgaXNVbmRlZmluZWRPck51bGwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJUHJvYmxlbXNXaWRnZXQgfSBmcm9tICcuL21hcmtlcnNWaWV3LmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgdW5zdXBwb3J0ZWRTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuXG5jb25zdCAkID0gRE9NLiQ7XG5cbmludGVyZmFjZSBJTWFya2VySWNvbkNvbHVtblRlbXBsYXRlRGF0YSB7XG5cdHJlYWRvbmx5IGljb246IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBhY3Rpb25CYXI6IEFjdGlvbkJhcjtcbn1cblxuaW50ZXJmYWNlIElNYXJrZXJDb2RlQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0cmVhZG9ubHkgY29kZUNvbHVtbjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHNvdXJjZUxhYmVsOiBIaWdobGlnaHRlZExhYmVsO1xuXHRyZWFkb25seSBjb2RlTGFiZWw6IEhpZ2hsaWdodGVkTGFiZWw7XG5cdHJlYWRvbmx5IGNvZGVMaW5rOiBMaW5rO1xuXHRyZWFkb25seSB0ZW1wbGF0ZURpc3Bvc2FibGU6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuaW50ZXJmYWNlIElNYXJrZXJGaWxlQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0cmVhZG9ubHkgY29sdW1uRWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGZpbGVMYWJlbDogSGlnaGxpZ2h0ZWRMYWJlbDtcblx0cmVhZG9ubHkgcG9zaXRpb25MYWJlbDogSGlnaGxpZ2h0ZWRMYWJlbDtcbn1cblxuXG5pbnRlcmZhY2UgSU1hcmtlckhpZ2hsaWdodGVkTGFiZWxDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRyZWFkb25seSBjb2x1bW5FbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgaGlnaGxpZ2h0ZWRMYWJlbDogSGlnaGxpZ2h0ZWRMYWJlbDtcbn1cblxuY2xhc3MgTWFya2VyU2V2ZXJpdHlDb2x1bW5SZW5kZXJlciBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPE1hcmtlclRhYmxlSXRlbSwgSU1hcmtlckljb25Db2x1bW5UZW1wbGF0ZURhdGE+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAnc2V2ZXJpdHknO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IE1hcmtlclNldmVyaXR5Q29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtYXJrZXJzVmlld01vZGVsOiBNYXJrZXJzVmlld01vZGVsLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElNYXJrZXJJY29uQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBzZXZlcml0eUNvbHVtbiA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuc2V2ZXJpdHknKSk7XG5cdFx0Y29uc3QgaWNvbiA9IERPTS5hcHBlbmQoc2V2ZXJpdHlDb2x1bW4sICQoJycpKTtcblxuXHRcdGNvbnN0IGFjdGlvbkJhckNvbHVtbiA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuYWN0aW9ucycpKTtcblx0XHRjb25zdCBhY3Rpb25CYXIgPSBuZXcgQWN0aW9uQmFyKGFjdGlvbkJhckNvbHVtbiwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbjogSUFjdGlvbiwgb3B0aW9ucykgPT4gYWN0aW9uLmlkID09PSBRdWlja0ZpeEFjdGlvbi5JRCA/IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUXVpY2tGaXhBY3Rpb25WaWV3SXRlbSwgPFF1aWNrRml4QWN0aW9uPmFjdGlvbiwgb3B0aW9ucykgOiB1bmRlZmluZWRcblx0XHR9KTtcblxuXHRcdHJldHVybiB7IGFjdGlvbkJhciwgaWNvbiB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBNYXJrZXJUYWJsZUl0ZW0sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSU1hcmtlckljb25Db2x1bW5UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgdG9nZ2xlUXVpY2tGaXggPSAoZW5hYmxlZD86IGJvb2xlYW4pID0+IHtcblx0XHRcdGlmICghaXNVbmRlZmluZWRPck51bGwoZW5hYmxlZCkpIHtcblx0XHRcdFx0Y29uc3QgY29udGFpbmVyID0gRE9NLmZpbmRQYXJlbnRXaXRoQ2xhc3ModGVtcGxhdGVEYXRhLmljb24sICdtb25hY28tdGFibGUtdGQnKSE7XG5cdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdxdWlja0ZpeCcsIGVuYWJsZWQpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0ZW1wbGF0ZURhdGEuaWNvbi50aXRsZSA9IE1hcmtlclNldmVyaXR5LnRvU3RyaW5nKGVsZW1lbnQubWFya2VyLnNldmVyaXR5KTtcblx0XHR0ZW1wbGF0ZURhdGEuaWNvbi5jbGFzc05hbWUgPSBgbWFya2VyLWljb24gJHtTZXZlcml0eS50b1N0cmluZyhNYXJrZXJTZXZlcml0eS50b1NldmVyaXR5KGVsZW1lbnQubWFya2VyLnNldmVyaXR5KSl9IGNvZGljb24gJHtTZXZlcml0eUljb24uY2xhc3NOYW1lKE1hcmtlclNldmVyaXR5LnRvU2V2ZXJpdHkoZWxlbWVudC5tYXJrZXIuc2V2ZXJpdHkpKX1gO1xuXG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5jbGVhcigpO1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMubWFya2Vyc1ZpZXdNb2RlbC5nZXRWaWV3TW9kZWwoZWxlbWVudCk7XG5cdFx0aWYgKHZpZXdNb2RlbCkge1xuXHRcdFx0Y29uc3QgcXVpY2tGaXhBY3Rpb24gPSB2aWV3TW9kZWwucXVpY2tGaXhBY3Rpb247XG5cdFx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLnB1c2goW3F1aWNrRml4QWN0aW9uXSwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0XHR0b2dnbGVRdWlja0ZpeCh2aWV3TW9kZWwucXVpY2tGaXhBY3Rpb24uZW5hYmxlZCk7XG5cblx0XHRcdHF1aWNrRml4QWN0aW9uLm9uRGlkQ2hhbmdlKCh7IGVuYWJsZWQgfSkgPT4gdG9nZ2xlUXVpY2tGaXgoZW5hYmxlZCkpO1xuXHRcdFx0cXVpY2tGaXhBY3Rpb24ub25TaG93UXVpY2tGaXhlcygoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHF1aWNrRml4QWN0aW9uVmlld0l0ZW0gPSA8UXVpY2tGaXhBY3Rpb25WaWV3SXRlbT50ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLnZpZXdJdGVtc1swXTtcblx0XHRcdFx0aWYgKHF1aWNrRml4QWN0aW9uVmlld0l0ZW0pIHtcblx0XHRcdFx0XHRxdWlja0ZpeEFjdGlvblZpZXdJdGVtLnNob3dRdWlja0ZpeGVzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElNYXJrZXJJY29uQ29sdW1uVGVtcGxhdGVEYXRhKTogdm9pZCB7IH1cbn1cblxuY2xhc3MgTWFya2VyQ29kZUNvbHVtblJlbmRlcmVyIGltcGxlbWVudHMgSVRhYmxlUmVuZGVyZXI8TWFya2VyVGFibGVJdGVtLCBJTWFya2VyQ29kZUNvbHVtblRlbXBsYXRlRGF0YT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAnY29kZSc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gTWFya2VyQ29kZUNvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElNYXJrZXJDb2RlQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCB0ZW1wbGF0ZURpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY29kZUNvbHVtbiA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuY29kZScpKTtcblxuXHRcdGNvbnN0IHNvdXJjZUxhYmVsID0gdGVtcGxhdGVEaXNwb3NhYmxlLmFkZChuZXcgSGlnaGxpZ2h0ZWRMYWJlbChjb2RlQ29sdW1uKSk7XG5cdFx0c291cmNlTGFiZWwuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzb3VyY2UtbGFiZWwnKTtcblxuXHRcdGNvbnN0IGNvZGVMYWJlbCA9IHRlbXBsYXRlRGlzcG9zYWJsZS5hZGQobmV3IEhpZ2hsaWdodGVkTGFiZWwoY29kZUNvbHVtbikpO1xuXHRcdGNvZGVMYWJlbC5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NvZGUtbGFiZWwnKTtcblxuXHRcdGNvbnN0IGNvZGVMaW5rID0gdGVtcGxhdGVEaXNwb3NhYmxlLmFkZChuZXcgTGluayhjb2RlQ29sdW1uLCB7IGhyZWY6ICcnLCBsYWJlbDogJycgfSwge30sIHRoaXMuaG92ZXJTZXJ2aWNlLCB0aGlzLm9wZW5lclNlcnZpY2UpKTtcblxuXHRcdHJldHVybiB7IGNvZGVDb2x1bW4sIHNvdXJjZUxhYmVsLCBjb2RlTGFiZWwsIGNvZGVMaW5rLCB0ZW1wbGF0ZURpc3Bvc2FibGUgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogTWFya2VyVGFibGVJdGVtLCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElNYXJrZXJDb2RlQ29sdW1uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5jb2RlQ29sdW1uLmNsYXNzTGlzdC5yZW1vdmUoJ2NvZGUtbGFiZWwnKTtcblx0XHR0ZW1wbGF0ZURhdGEuY29kZUNvbHVtbi5jbGFzc0xpc3QucmVtb3ZlKCdjb2RlLWxpbmsnKTtcblxuXHRcdGlmIChlbGVtZW50Lm1hcmtlci5zb3VyY2UgJiYgZWxlbWVudC5tYXJrZXIuY29kZSkge1xuXHRcdFx0aWYgKHR5cGVvZiBlbGVtZW50Lm1hcmtlci5jb2RlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuY29kZUNvbHVtbi5jbGFzc0xpc3QuYWRkKCdjb2RlLWxhYmVsJyk7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5jb2RlQ29sdW1uLnRpdGxlID0gYCR7ZWxlbWVudC5tYXJrZXIuc291cmNlfSAoJHtlbGVtZW50Lm1hcmtlci5jb2RlfSlgO1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuc291cmNlTGFiZWwuc2V0KGVsZW1lbnQubWFya2VyLnNvdXJjZSwgZWxlbWVudC5zb3VyY2VNYXRjaGVzKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmNvZGVMYWJlbC5zZXQoZWxlbWVudC5tYXJrZXIuY29kZSwgZWxlbWVudC5jb2RlTWF0Y2hlcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuY29kZUNvbHVtbi5jbGFzc0xpc3QuYWRkKCdjb2RlLWxpbmsnKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmNvZGVDb2x1bW4udGl0bGUgPSBgJHtlbGVtZW50Lm1hcmtlci5zb3VyY2V9ICgke2VsZW1lbnQubWFya2VyLmNvZGUudmFsdWV9KWA7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5zb3VyY2VMYWJlbC5zZXQoZWxlbWVudC5tYXJrZXIuc291cmNlLCBlbGVtZW50LnNvdXJjZU1hdGNoZXMpO1xuXG5cdFx0XHRcdGNvbnN0IGNvZGVMaW5rTGFiZWwgPSB0ZW1wbGF0ZURhdGEudGVtcGxhdGVEaXNwb3NhYmxlLmFkZChuZXcgSGlnaGxpZ2h0ZWRMYWJlbCgkKCcuY29kZS1saW5rLWxhYmVsJykpKTtcblx0XHRcdFx0Y29kZUxpbmtMYWJlbC5zZXQoZWxlbWVudC5tYXJrZXIuY29kZS52YWx1ZSwgZWxlbWVudC5jb2RlTWF0Y2hlcyk7XG5cblx0XHRcdFx0dGVtcGxhdGVEYXRhLmNvZGVMaW5rLmxpbmsgPSB7XG5cdFx0XHRcdFx0aHJlZjogZWxlbWVudC5tYXJrZXIuY29kZS50YXJnZXQudG9TdHJpbmcodHJ1ZSksXG5cdFx0XHRcdFx0dGl0bGU6IGVsZW1lbnQubWFya2VyLmNvZGUudGFyZ2V0LnRvU3RyaW5nKHRydWUpLFxuXHRcdFx0XHRcdGxhYmVsOiBjb2RlTGlua0xhYmVsLmVsZW1lbnQsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5jb2RlQ29sdW1uLnRpdGxlID0gJyc7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuc291cmNlTGFiZWwuc2V0KCctJyk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSU1hcmtlckNvZGVDb2x1bW5UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEudGVtcGxhdGVEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBNYXJrZXJNZXNzYWdlQ29sdW1uUmVuZGVyZXIgaW1wbGVtZW50cyBJVGFibGVSZW5kZXJlcjxNYXJrZXJUYWJsZUl0ZW0sIElNYXJrZXJIaWdobGlnaHRlZExhYmVsQ29sdW1uVGVtcGxhdGVEYXRhPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ21lc3NhZ2UnO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IE1hcmtlck1lc3NhZ2VDb2x1bW5SZW5kZXJlci5URU1QTEFURV9JRDtcblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSU1hcmtlckhpZ2hsaWdodGVkTGFiZWxDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGNvbHVtbkVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLm1lc3NhZ2UnKSk7XG5cdFx0Y29uc3QgaGlnaGxpZ2h0ZWRMYWJlbCA9IG5ldyBIaWdobGlnaHRlZExhYmVsKGNvbHVtbkVsZW1lbnQpO1xuXG5cdFx0cmV0dXJuIHsgY29sdW1uRWxlbWVudCwgaGlnaGxpZ2h0ZWRMYWJlbCB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBNYXJrZXJUYWJsZUl0ZW0sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSU1hcmtlckhpZ2hsaWdodGVkTGFiZWxDb2x1bW5UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmNvbHVtbkVsZW1lbnQudGl0bGUgPSBlbGVtZW50Lm1hcmtlci5tZXNzYWdlO1xuXHRcdHRlbXBsYXRlRGF0YS5oaWdobGlnaHRlZExhYmVsLnNldChlbGVtZW50Lm1hcmtlci5tZXNzYWdlLCBlbGVtZW50Lm1lc3NhZ2VNYXRjaGVzKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElNYXJrZXJIaWdobGlnaHRlZExhYmVsQ29sdW1uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmhpZ2hsaWdodGVkTGFiZWwuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIE1hcmtlckZpbGVDb2x1bW5SZW5kZXJlciBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPE1hcmtlclRhYmxlSXRlbSwgSU1hcmtlckZpbGVDb2x1bW5UZW1wbGF0ZURhdGE+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAnZmlsZSc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gTWFya2VyRmlsZUNvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElNYXJrZXJGaWxlQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBjb2x1bW5FbGVtZW50ID0gRE9NLmFwcGVuZChjb250YWluZXIsICQoJy5maWxlJykpO1xuXHRcdGNvbnN0IGZpbGVMYWJlbCA9IG5ldyBIaWdobGlnaHRlZExhYmVsKGNvbHVtbkVsZW1lbnQpO1xuXHRcdGZpbGVMYWJlbC5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2ZpbGUtbGFiZWwnKTtcblx0XHRjb25zdCBwb3NpdGlvbkxhYmVsID0gbmV3IEhpZ2hsaWdodGVkTGFiZWwoY29sdW1uRWxlbWVudCk7XG5cdFx0cG9zaXRpb25MYWJlbC5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2ZpbGUtcG9zaXRpb24nKTtcblxuXHRcdHJldHVybiB7IGNvbHVtbkVsZW1lbnQsIGZpbGVMYWJlbCwgcG9zaXRpb25MYWJlbCB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBNYXJrZXJUYWJsZUl0ZW0sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSU1hcmtlckZpbGVDb2x1bW5UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgcG9zaXRpb25MYWJlbCA9IE1lc3NhZ2VzLk1BUktFUlNfUEFORUxfQVRfTElORV9DT0xfTlVNQkVSKGVsZW1lbnQubWFya2VyLnN0YXJ0TGluZU51bWJlciwgZWxlbWVudC5tYXJrZXIuc3RhcnRDb2x1bW4pO1xuXG5cdFx0dGVtcGxhdGVEYXRhLmNvbHVtbkVsZW1lbnQudGl0bGUgPSBgJHt0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChlbGVtZW50Lm1hcmtlci5yZXNvdXJjZSwgeyByZWxhdGl2ZTogZmFsc2UgfSl9ICR7cG9zaXRpb25MYWJlbH1gO1xuXHRcdHRlbXBsYXRlRGF0YS5maWxlTGFiZWwuc2V0KHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGVsZW1lbnQubWFya2VyLnJlc291cmNlLCB7IHJlbGF0aXZlOiB0cnVlIH0pLCBlbGVtZW50LmZpbGVNYXRjaGVzKTtcblx0XHR0ZW1wbGF0ZURhdGEucG9zaXRpb25MYWJlbC5zZXQocG9zaXRpb25MYWJlbCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElNYXJrZXJGaWxlQ29sdW1uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmZpbGVMYWJlbC5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLnBvc2l0aW9uTGFiZWwuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIE1hcmtlclNvdXJjZUNvbHVtblJlbmRlcmVyIGltcGxlbWVudHMgSVRhYmxlUmVuZGVyZXI8TWFya2VyVGFibGVJdGVtLCBJTWFya2VySGlnaGxpZ2h0ZWRMYWJlbENvbHVtblRlbXBsYXRlRGF0YT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdzb3VyY2UnO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IE1hcmtlclNvdXJjZUNvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJTWFya2VySGlnaGxpZ2h0ZWRMYWJlbENvbHVtblRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgY29sdW1uRWxlbWVudCA9IERPTS5hcHBlbmQoY29udGFpbmVyLCAkKCcuc291cmNlJykpO1xuXHRcdGNvbnN0IGhpZ2hsaWdodGVkTGFiZWwgPSBuZXcgSGlnaGxpZ2h0ZWRMYWJlbChjb2x1bW5FbGVtZW50KTtcblx0XHRyZXR1cm4geyBjb2x1bW5FbGVtZW50LCBoaWdobGlnaHRlZExhYmVsIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IE1hcmtlclRhYmxlSXRlbSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJTWFya2VySGlnaGxpZ2h0ZWRMYWJlbENvbHVtblRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuY29sdW1uRWxlbWVudC50aXRsZSA9IGVsZW1lbnQubWFya2VyLnNvdXJjZSA/PyAnJztcblx0XHR0ZW1wbGF0ZURhdGEuaGlnaGxpZ2h0ZWRMYWJlbC5zZXQoZWxlbWVudC5tYXJrZXIuc291cmNlID8/ICcnLCBlbGVtZW50LnNvdXJjZU1hdGNoZXMpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSU1hcmtlckhpZ2hsaWdodGVkTGFiZWxDb2x1bW5UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuaGlnaGxpZ2h0ZWRMYWJlbC5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgTWFya2Vyc1RhYmxlVmlydHVhbERlbGVnYXRlIGltcGxlbWVudHMgSVRhYmxlVmlydHVhbERlbGVnYXRlPGFueT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSEVBREVSX1JPV19IRUlHSFQgPSAyNDtcblx0c3RhdGljIHJlYWRvbmx5IFJPV19IRUlHSFQgPSAyNDtcblx0cmVhZG9ubHkgaGVhZGVyUm93SGVpZ2h0ID0gTWFya2Vyc1RhYmxlVmlydHVhbERlbGVnYXRlLkhFQURFUl9ST1dfSEVJR0hUO1xuXG5cdGdldEhlaWdodChpdGVtOiBhbnkpIHtcblx0XHRyZXR1cm4gTWFya2Vyc1RhYmxlVmlydHVhbERlbGVnYXRlLlJPV19IRUlHSFQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1hcmtlcnNUYWJsZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJUHJvYmxlbXNXaWRnZXQge1xuXG5cdHByaXZhdGUgX2l0ZW1Db3VudDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSB0YWJsZTogV29ya2JlbmNoVGFibGU8TWFya2VyVGFibGVJdGVtPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtYXJrZXJzVmlld01vZGVsOiBNYXJrZXJzVmlld01vZGVsLFxuXHRcdHByaXZhdGUgcmVzb3VyY2VNYXJrZXJzOiBSZXNvdXJjZU1hcmtlcnNbXSxcblx0XHRwcml2YXRlIGZpbHRlck9wdGlvbnM6IEZpbHRlck9wdGlvbnMsXG5cdFx0b3B0aW9uczogSVdvcmtiZW5jaFRhYmxlT3B0aW9uczxNYXJrZXJUYWJsZUl0ZW0+LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy50YWJsZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoVGFibGUsXG5cdFx0XHQnTWFya2VycycsXG5cdFx0XHR0aGlzLmNvbnRhaW5lcixcblx0XHRcdG5ldyBNYXJrZXJzVGFibGVWaXJ0dWFsRGVsZWdhdGUoKSxcblx0XHRcdFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0XHR3ZWlnaHQ6IDAsXG5cdFx0XHRcdFx0bWluaW11bVdpZHRoOiAzNixcblx0XHRcdFx0XHRtYXhpbXVtV2lkdGg6IDM2LFxuXHRcdFx0XHRcdHRlbXBsYXRlSWQ6IE1hcmtlclNldmVyaXR5Q29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IE1hcmtlcik6IE1hcmtlciB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY29kZUNvbHVtbkxhYmVsJywgXCJDb2RlXCIpLFxuXHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdHdlaWdodDogMSxcblx0XHRcdFx0XHRtaW5pbXVtV2lkdGg6IDEwMCxcblx0XHRcdFx0XHRtYXhpbXVtV2lkdGg6IDMwMCxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBNYXJrZXJDb2RlQ29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IE1hcmtlcik6IE1hcmtlciB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbWVzc2FnZUNvbHVtbkxhYmVsJywgXCJNZXNzYWdlXCIpLFxuXHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdHdlaWdodDogNCxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBNYXJrZXJNZXNzYWdlQ29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IE1hcmtlcik6IE1hcmtlciB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZmlsZUNvbHVtbkxhYmVsJywgXCJGaWxlXCIpLFxuXHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdHdlaWdodDogMixcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBNYXJrZXJGaWxlQ29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IE1hcmtlcik6IE1hcmtlciB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc291cmNlQ29sdW1uTGFiZWwnLCBcIlNvdXJjZVwiKSxcblx0XHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0XHR3ZWlnaHQ6IDEsXG5cdFx0XHRcdFx0bWluaW11bVdpZHRoOiAxMDAsXG5cdFx0XHRcdFx0bWF4aW11bVdpZHRoOiAzMDAsXG5cdFx0XHRcdFx0dGVtcGxhdGVJZDogTWFya2VyU291cmNlQ29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IE1hcmtlcik6IE1hcmtlciB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZXJTZXZlcml0eUNvbHVtblJlbmRlcmVyLCB0aGlzLm1hcmtlcnNWaWV3TW9kZWwpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtlckNvZGVDb2x1bW5SZW5kZXJlciksXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya2VyTWVzc2FnZUNvbHVtblJlbmRlcmVyKSxcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZXJGaWxlQ29sdW1uUmVuZGVyZXIpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hcmtlclNvdXJjZUNvbHVtblJlbmRlcmVyKSxcblx0XHRcdF0sXG5cdFx0XHRvcHRpb25zXG5cdFx0KSBhcyBXb3JrYmVuY2hUYWJsZTxNYXJrZXJUYWJsZUl0ZW0+O1xuXG5cdFx0Y29uc3QgbGlzdCA9IHRoaXMudGFibGUuZG9tTm9kZS5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLWxpc3Qtcm93cycpISBhcyBIVE1MRWxlbWVudDtcblxuXHRcdC8vIG1vdXNlb3Zlci9tb3VzZWxlYXZlIGV2ZW50IGhhbmRsZXJzXG5cdFx0Y29uc3Qgb25Sb3dIb3ZlciA9IEV2ZW50LmNoYWluKHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKGxpc3QsICdtb3VzZW92ZXInKSkuZXZlbnQsICQgPT5cblx0XHRcdCQubWFwKGUgPT4gRE9NLmZpbmRQYXJlbnRXaXRoQ2xhc3MoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQsICdtb25hY28tbGlzdC1yb3cnLCAnbW9uYWNvLWxpc3Qtcm93cycpKVxuXHRcdFx0XHQuZmlsdGVyPEhUTUxFbGVtZW50PigoKGU6IEhUTUxFbGVtZW50IHwgbnVsbCkgPT4gISFlKSBhcyBhbnkpXG5cdFx0XHRcdC5tYXAoZSA9PiBwYXJzZUludChlLmdldEF0dHJpYnV0ZSgnZGF0YS1pbmRleCcpISkpXG5cdFx0KTtcblxuXHRcdGNvbnN0IG9uTGlzdExlYXZlID0gRXZlbnQubWFwKHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKGxpc3QsICdtb3VzZWxlYXZlJykpLmV2ZW50LCAoKSA9PiAtMSk7XG5cblx0XHRjb25zdCBvblJvd0hvdmVyT3JMZWF2ZSA9IEV2ZW50LmxhdGNoKEV2ZW50LmFueShvblJvd0hvdmVyLCBvbkxpc3RMZWF2ZSkpO1xuXHRcdGNvbnN0IG9uUm93UGVybWFuZW50SG92ZXIgPSBFdmVudC5kZWJvdW5jZShvblJvd0hvdmVyT3JMZWF2ZSwgKF8sIGUpID0+IGUsIDUwMCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihvblJvd1Blcm1hbmVudEhvdmVyKGUgPT4ge1xuXHRcdFx0aWYgKGUgIT09IC0xICYmIHRoaXMudGFibGUucm93KGUpKSB7XG5cdFx0XHRcdHRoaXMubWFya2Vyc1ZpZXdNb2RlbC5vbk1hcmtlck1vdXNlSG92ZXIodGhpcy50YWJsZS5yb3coZSkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGdldCBjb250ZXh0S2V5U2VydmljZSgpOiBJQ29udGV4dEtleVNlcnZpY2Uge1xuXHRcdHJldHVybiB0aGlzLnRhYmxlLmNvbnRleHRLZXlTZXJ2aWNlO1xuXHR9XG5cblx0Z2V0IG9uQ29udGV4dE1lbnUoKTogRXZlbnQ8SVRhYmxlQ29udGV4dE1lbnVFdmVudDxNYXJrZXJUYWJsZUl0ZW0+PiB7XG5cdFx0cmV0dXJuIHRoaXMudGFibGUub25Db250ZXh0TWVudTtcblx0fVxuXG5cdGdldCBvbkRpZE9wZW4oKTogRXZlbnQ8SU9wZW5FdmVudDxNYXJrZXJUYWJsZUl0ZW0gfCB1bmRlZmluZWQ+PiB7XG5cdFx0cmV0dXJuIHRoaXMudGFibGUub25EaWRPcGVuO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlRm9jdXMoKTogRXZlbnQ8SVRhYmxlRXZlbnQ8TWFya2VyVGFibGVJdGVtPj4ge1xuXHRcdHJldHVybiB0aGlzLnRhYmxlLm9uRGlkQ2hhbmdlRm9jdXM7XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2VTZWxlY3Rpb24oKTogRXZlbnQ8SVRhYmxlRXZlbnQ8TWFya2VyVGFibGVJdGVtPj4ge1xuXHRcdHJldHVybiB0aGlzLnRhYmxlLm9uRGlkQ2hhbmdlU2VsZWN0aW9uO1xuXHR9XG5cblx0Y29sbGFwc2VNYXJrZXJzKCk6IHZvaWQgeyB9XG5cblx0ZG9tRm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy50YWJsZS5kb21Gb2N1cygpO1xuXHR9XG5cblx0ZmlsdGVyTWFya2VycyhyZXNvdXJjZU1hcmtlcnM6IFJlc291cmNlTWFya2Vyc1tdLCBmaWx0ZXJPcHRpb25zOiBGaWx0ZXJPcHRpb25zKTogdm9pZCB7XG5cdFx0dGhpcy5maWx0ZXJPcHRpb25zID0gZmlsdGVyT3B0aW9ucztcblx0XHR0aGlzLnJlc2V0KHJlc291cmNlTWFya2Vycyk7XG5cdH1cblxuXHRnZXRGb2N1cygpOiAoTWFya2VyVGFibGVJdGVtIHwgbnVsbClbXSB7XG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLnRhYmxlLmdldEZvY3VzKCk7XG5cdFx0cmV0dXJuIGZvY3VzLmxlbmd0aCA+IDAgPyBbLi4uZm9jdXMubWFwKGYgPT4gdGhpcy50YWJsZS5yb3coZikpXSA6IFtdO1xuXHR9XG5cblx0Z2V0SFRNTEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLnRhYmxlLmdldEhUTUxFbGVtZW50KCk7XG5cdH1cblxuXHRnZXRSZWxhdGl2ZVRvcChtYXJrZXI6IE1hcmtlclRhYmxlSXRlbSB8IG51bGwpOiBudW1iZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gbWFya2VyID8gdGhpcy50YWJsZS5nZXRSZWxhdGl2ZVRvcCh0aGlzLnRhYmxlLmluZGV4T2YobWFya2VyKSkgOiBudWxsO1xuXHR9XG5cblx0Z2V0U2VsZWN0aW9uKCk6IChNYXJrZXJUYWJsZUl0ZW0gfCBudWxsKVtdIHtcblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLnRhYmxlLmdldFNlbGVjdGlvbigpO1xuXHRcdHJldHVybiBzZWxlY3Rpb24ubGVuZ3RoID4gMCA/IFsuLi5zZWxlY3Rpb24ubWFwKGkgPT4gdGhpcy50YWJsZS5yb3coaSkpXSA6IFtdO1xuXHR9XG5cblx0Z2V0VmlzaWJsZUl0ZW1Db3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtQ291bnQ7XG5cdH1cblxuXHRpc1Zpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ2hpZGRlbicpO1xuXHR9XG5cblx0bGF5b3V0KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5jb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHR0aGlzLnRhYmxlLmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0fVxuXG5cdHJlc2V0KHJlc291cmNlTWFya2VyczogUmVzb3VyY2VNYXJrZXJzW10pOiB2b2lkIHtcblx0XHR0aGlzLnJlc291cmNlTWFya2VycyA9IHJlc291cmNlTWFya2VycztcblxuXHRcdGNvbnN0IGl0ZW1zOiBNYXJrZXJUYWJsZUl0ZW1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcmVzb3VyY2VNYXJrZXIgb2YgdGhpcy5yZXNvdXJjZU1hcmtlcnMpIHtcblx0XHRcdGZvciAoY29uc3QgbWFya2VyIG9mIHJlc291cmNlTWFya2VyLm1hcmtlcnMpIHtcblx0XHRcdFx0aWYgKHVuc3VwcG9ydGVkU2NoZW1hcy5oYXMobWFya2VyLnJlc291cmNlLnNjaGVtZSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEV4Y2x1ZGUgcGF0dGVyblxuXHRcdFx0XHRpZiAodGhpcy5maWx0ZXJPcHRpb25zLmV4Y2x1ZGVzTWF0Y2hlci5tYXRjaGVzKG1hcmtlci5yZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEluY2x1ZGUgcGF0dGVyblxuXHRcdFx0XHRpZiAodGhpcy5maWx0ZXJPcHRpb25zLmluY2x1ZGVzTWF0Y2hlci5tYXRjaGVzKG1hcmtlci5yZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRpdGVtcy5wdXNoKG5ldyBNYXJrZXJUYWJsZUl0ZW0obWFya2VyKSk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTZXZlcml0eSBmaWx0ZXJcblx0XHRcdFx0Y29uc3QgbWF0Y2hlc1NldmVyaXR5ID0gdGhpcy5maWx0ZXJPcHRpb25zLnNob3dFcnJvcnMgJiYgTWFya2VyU2V2ZXJpdHkuRXJyb3IgPT09IG1hcmtlci5tYXJrZXIuc2V2ZXJpdHkgfHxcblx0XHRcdFx0XHR0aGlzLmZpbHRlck9wdGlvbnMuc2hvd1dhcm5pbmdzICYmIE1hcmtlclNldmVyaXR5Lldhcm5pbmcgPT09IG1hcmtlci5tYXJrZXIuc2V2ZXJpdHkgfHxcblx0XHRcdFx0XHR0aGlzLmZpbHRlck9wdGlvbnMuc2hvd0luZm9zICYmIE1hcmtlclNldmVyaXR5LkluZm8gPT09IG1hcmtlci5tYXJrZXIuc2V2ZXJpdHk7XG5cblx0XHRcdFx0aWYgKCFtYXRjaGVzU2V2ZXJpdHkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRleHQgZmlsdGVyXG5cdFx0XHRcdGlmICh0aGlzLmZpbHRlck9wdGlvbnMudGV4dEZpbHRlci50ZXh0KSB7XG5cdFx0XHRcdFx0Y29uc3Qgc291cmNlTWF0Y2hlcyA9IG1hcmtlci5tYXJrZXIuc291cmNlID8gRmlsdGVyT3B0aW9ucy5fZmlsdGVyKHRoaXMuZmlsdGVyT3B0aW9ucy50ZXh0RmlsdGVyLnRleHQsIG1hcmtlci5tYXJrZXIuc291cmNlKSA/PyB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Y29uc3QgY29kZU1hdGNoZXMgPSBtYXJrZXIubWFya2VyLmNvZGUgPyBGaWx0ZXJPcHRpb25zLl9maWx0ZXIodGhpcy5maWx0ZXJPcHRpb25zLnRleHRGaWx0ZXIudGV4dCwgdHlwZW9mIG1hcmtlci5tYXJrZXIuY29kZSA9PT0gJ3N0cmluZycgPyBtYXJrZXIubWFya2VyLmNvZGUgOiBtYXJrZXIubWFya2VyLmNvZGUudmFsdWUpID8/IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlTWF0Y2hlcyA9IEZpbHRlck9wdGlvbnMuX21lc3NhZ2VGaWx0ZXIodGhpcy5maWx0ZXJPcHRpb25zLnRleHRGaWx0ZXIudGV4dCwgbWFya2VyLm1hcmtlci5tZXNzYWdlKSA/PyB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Y29uc3QgZmlsZU1hdGNoZXMgPSBGaWx0ZXJPcHRpb25zLl9tZXNzYWdlRmlsdGVyKHRoaXMuZmlsdGVyT3B0aW9ucy50ZXh0RmlsdGVyLnRleHQsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKG1hcmtlci5yZXNvdXJjZSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSkgPz8gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0Y29uc3QgbWF0Y2hlZCA9IHNvdXJjZU1hdGNoZXMgfHwgY29kZU1hdGNoZXMgfHwgbWVzc2FnZU1hdGNoZXMgfHwgZmlsZU1hdGNoZXM7XG5cdFx0XHRcdFx0aWYgKChtYXRjaGVkICYmICF0aGlzLmZpbHRlck9wdGlvbnMudGV4dEZpbHRlci5uZWdhdGUpIHx8ICghbWF0Y2hlZCAmJiB0aGlzLmZpbHRlck9wdGlvbnMudGV4dEZpbHRlci5uZWdhdGUpKSB7XG5cdFx0XHRcdFx0XHRpdGVtcy5wdXNoKG5ldyBNYXJrZXJUYWJsZUl0ZW0obWFya2VyLCBzb3VyY2VNYXRjaGVzLCBjb2RlTWF0Y2hlcywgbWVzc2FnZU1hdGNoZXMsIGZpbGVNYXRjaGVzKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpdGVtcy5wdXNoKG5ldyBNYXJrZXJUYWJsZUl0ZW0obWFya2VyKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2l0ZW1Db3VudCA9IGl0ZW1zLmxlbmd0aDtcblx0XHR0aGlzLnRhYmxlLnNwbGljZSgwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGxldCByZXN1bHQgPSBNYXJrZXJTZXZlcml0eS5jb21wYXJlKGEubWFya2VyLnNldmVyaXR5LCBiLm1hcmtlci5zZXZlcml0eSk7XG5cblx0XHRcdGlmIChyZXN1bHQgPT09IDApIHtcblx0XHRcdFx0cmVzdWx0ID0gY29tcGFyZU1hcmtlcnNCeVVyaShhLm1hcmtlciwgYi5tYXJrZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzdWx0ID09PSAwKSB7XG5cdFx0XHRcdHJlc3VsdCA9IFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyhhLm1hcmtlciwgYi5tYXJrZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0pKTtcblx0fVxuXG5cdHJldmVhbE1hcmtlcnMoYWN0aXZlUmVzb3VyY2U6IFJlc291cmNlTWFya2VycyB8IG51bGwsIGZvY3VzOiBib29sZWFuLCBsYXN0U2VsZWN0ZWRSZWxhdGl2ZVRvcDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKGFjdGl2ZVJlc291cmNlKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVSZXNvdXJjZUluZGV4ID0gdGhpcy5yZXNvdXJjZU1hcmtlcnMuaW5kZXhPZihhY3RpdmVSZXNvdXJjZSk7XG5cblx0XHRcdGlmIChhY3RpdmVSZXNvdXJjZUluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRpZiAodGhpcy5oYXNTZWxlY3RlZE1hcmtlckZvcihhY3RpdmVSZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRjb25zdCB0YWJsZVNlbGVjdGlvbiA9IHRoaXMudGFibGUuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRcdFx0dGhpcy50YWJsZS5yZXZlYWwodGFibGVTZWxlY3Rpb25bMF0sIGxhc3RTZWxlY3RlZFJlbGF0aXZlVG9wKTtcblxuXHRcdFx0XHRcdGlmIChmb2N1cykge1xuXHRcdFx0XHRcdFx0dGhpcy50YWJsZS5zZXRGb2N1cyh0YWJsZVNlbGVjdGlvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMudGFibGUucmV2ZWFsKGFjdGl2ZVJlc291cmNlSW5kZXgsIDApO1xuXG5cdFx0XHRcdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnRhYmxlLnNldEZvY3VzKFthY3RpdmVSZXNvdXJjZUluZGV4XSk7XG5cdFx0XHRcdFx0XHR0aGlzLnRhYmxlLnNldFNlbGVjdGlvbihbYWN0aXZlUmVzb3VyY2VJbmRleF0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoZm9jdXMpIHtcblx0XHRcdHRoaXMudGFibGUuc2V0U2VsZWN0aW9uKFtdKTtcblx0XHRcdHRoaXMudGFibGUuZm9jdXNGaXJzdCgpO1xuXHRcdH1cblx0fVxuXG5cdHNldEFyaWFMYWJlbChsYWJlbDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy50YWJsZS5kb21Ob2RlLmFyaWFMYWJlbCA9IGxhYmVsO1xuXHR9XG5cblx0c2V0TWFya2VyU2VsZWN0aW9uKHNlbGVjdGlvbj86IE1hcmtlcltdLCBmb2N1cz86IE1hcmtlcltdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy50YWJsZS5zZXRTZWxlY3Rpb24oc2VsZWN0aW9uLm1hcChtID0+IHRoaXMuZmluZE1hcmtlckluZGV4KG0pKSk7XG5cblx0XHRcdFx0aWYgKGZvY3VzICYmIGZvY3VzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHR0aGlzLnRhYmxlLnNldEZvY3VzKGZvY3VzLm1hcChmID0+IHRoaXMuZmluZE1hcmtlckluZGV4KGYpKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy50YWJsZS5zZXRGb2N1cyhbdGhpcy5maW5kTWFya2VySW5kZXgoc2VsZWN0aW9uWzBdKV0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy50YWJsZS5yZXZlYWwodGhpcy5maW5kTWFya2VySW5kZXgoc2VsZWN0aW9uWzBdKSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuZ2V0U2VsZWN0aW9uKCkubGVuZ3RoID09PSAwICYmIHRoaXMuZ2V0VmlzaWJsZUl0ZW1Db3VudCgpID4gMCkge1xuXHRcdFx0XHR0aGlzLnRhYmxlLnNldFNlbGVjdGlvbihbMF0pO1xuXHRcdFx0XHR0aGlzLnRhYmxlLnNldEZvY3VzKFswXSk7XG5cdFx0XHRcdHRoaXMudGFibGUucmV2ZWFsKDApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHRvZ2dsZVZpc2liaWxpdHkoaGlkZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsIGhpZGUpO1xuXHR9XG5cblx0dXBkYXRlKHJlc291cmNlTWFya2VyczogUmVzb3VyY2VNYXJrZXJzW10pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHJlc291cmNlTWFya2VyIG9mIHJlc291cmNlTWFya2Vycykge1xuXHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLnJlc291cmNlTWFya2Vycy5pbmRleE9mKHJlc291cmNlTWFya2VyKTtcblx0XHRcdHRoaXMucmVzb3VyY2VNYXJrZXJzLnNwbGljZShpbmRleCwgMSwgcmVzb3VyY2VNYXJrZXIpO1xuXHRcdH1cblx0XHR0aGlzLnJlc2V0KHRoaXMucmVzb3VyY2VNYXJrZXJzKTtcblx0fVxuXG5cdHVwZGF0ZU1hcmtlcihtYXJrZXI6IE1hcmtlcik6IHZvaWQge1xuXHRcdHRoaXMudGFibGUucmVyZW5kZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgZmluZE1hcmtlckluZGV4KG1hcmtlcjogTWFya2VyKTogbnVtYmVyIHtcblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy50YWJsZS5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGlmICh0aGlzLnRhYmxlLnJvdyhpbmRleCkubWFya2VyID09PSBtYXJrZXIubWFya2VyKSB7XG5cdFx0XHRcdHJldHVybiBpbmRleDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gLTE7XG5cdH1cblxuXHRwcml2YXRlIGhhc1NlbGVjdGVkTWFya2VyRm9yKHJlc291cmNlOiBSZXNvdXJjZU1hcmtlcnMpOiBib29sZWFuIHtcblx0XHRjb25zdCBzZWxlY3RlZEVsZW1lbnQgPSB0aGlzLmdldFNlbGVjdGlvbigpO1xuXHRcdGlmIChzZWxlY3RlZEVsZW1lbnQgJiYgc2VsZWN0ZWRFbGVtZW50Lmxlbmd0aCA+IDApIHtcblx0XHRcdGlmIChzZWxlY3RlZEVsZW1lbnRbMF0gaW5zdGFuY2VvZiBNYXJrZXIpIHtcblx0XHRcdFx0aWYgKHJlc291cmNlLmhhcygoPE1hcmtlcj5zZWxlY3RlZEVsZW1lbnRbMF0pLm1hcmtlci5yZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixZQUFZLFNBQVM7QUFDckIsU0FBUyxhQUFhO0FBRXRCLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBNkMsc0JBQXNCO0FBQ25FLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUJBQXFCLFFBQVEsdUJBQXdDO0FBQzlFLFNBQVMs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
