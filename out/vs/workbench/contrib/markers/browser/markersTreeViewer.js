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
import * as paths from "../../../../base/common/path.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { HighlightedLabel } from "../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { ResourceMarkers, Marker, RelatedInformation, MarkerTableItem } from "./markersModel.js";
import Messages from "./messages.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { dispose, Disposable, toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { QuickFixAction, QuickFixActionViewItem } from "./markersViewActions.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { basename, isEqual } from "../../../../base/common/resources.js";
import { TreeVisibility } from "../../../../base/browser/ui/tree/tree.js";
import { FilterOptions } from "./markersFilterOptions.js";
import { Emitter } from "../../../../base/common/event.js";
import { isUndefinedOrNull } from "../../../../base/common/types.js";
import { Action, toAction } from "../../../../base/common/actions.js";
import { localize } from "../../../../nls.js";
import { createCancelablePromise, Delayer } from "../../../../base/common/async.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { Range } from "../../../../editor/common/core/range.js";
import { applyCodeAction, ApplyCodeActionReason, getCodeActions } from "../../../../editor/contrib/codeAction/browser/codeAction.js";
import { CodeActionKind, CodeActionTriggerSource } from "../../../../editor/contrib/codeAction/common/types.js";
import { IEditorService, ACTIVE_GROUP } from "../../../services/editor/common/editorService.js";
import { SeverityIcon } from "../../../../base/browser/ui/severityIcon/severityIcon.js";
import { CodeActionTriggerType } from "../../../../editor/common/languages.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { MarkersContextKeys, MarkersViewMode } from "../common/markers.js";
import { unsupportedSchemas } from "../../../../platform/markers/common/markerService.js";
import { defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import Severity from "../../../../base/common/severity.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let MarkersWidgetAccessibilityProvider = class {
  constructor(labelService) {
    this.labelService = labelService;
  }
  getWidgetAriaLabel() {
    return localize("problemsView", "Problems View");
  }
  getAriaLabel(element) {
    if (element instanceof ResourceMarkers) {
      const path = this.labelService.getUriLabel(element.resource, { relative: true }) || element.resource.fsPath;
      return Messages.MARKERS_TREE_ARIA_LABEL_RESOURCE(element.markers.length, element.name, paths.dirname(path));
    }
    if (element instanceof Marker || element instanceof MarkerTableItem) {
      return Messages.MARKERS_TREE_ARIA_LABEL_MARKER(element);
    }
    if (element instanceof RelatedInformation) {
      return Messages.MARKERS_TREE_ARIA_LABEL_RELATED_INFORMATION(element.raw);
    }
    return null;
  }
};
MarkersWidgetAccessibilityProvider = __decorateClass([
  __decorateParam(0, ILabelService)
], MarkersWidgetAccessibilityProvider);
var TemplateId = /* @__PURE__ */ ((TemplateId2) => {
  TemplateId2["ResourceMarkers"] = "rm";
  TemplateId2["Marker"] = "m";
  TemplateId2["RelatedInformation"] = "ri";
  return TemplateId2;
})(TemplateId || {});
const _VirtualDelegate = class _VirtualDelegate {
  constructor(markersViewState) {
    this.markersViewState = markersViewState;
  }
  getHeight(element) {
    if (element instanceof Marker) {
      const viewModel = this.markersViewState.getViewModel(element);
      const noOfLines = !viewModel || viewModel.multiline ? element.lines.length : 1;
      return noOfLines * _VirtualDelegate.LINE_HEIGHT;
    }
    return _VirtualDelegate.LINE_HEIGHT;
  }
  getTemplateId(element) {
    if (element instanceof ResourceMarkers) {
      return "rm" /* ResourceMarkers */;
    } else if (element instanceof Marker) {
      return "m" /* Marker */;
    } else {
      return "ri" /* RelatedInformation */;
    }
  }
};
_VirtualDelegate.LINE_HEIGHT = 22;
let VirtualDelegate = _VirtualDelegate;
var FilterDataType = /* @__PURE__ */ ((FilterDataType2) => {
  FilterDataType2[FilterDataType2["ResourceMarkers"] = 0] = "ResourceMarkers";
  FilterDataType2[FilterDataType2["Marker"] = 1] = "Marker";
  FilterDataType2[FilterDataType2["RelatedInformation"] = 2] = "RelatedInformation";
  return FilterDataType2;
})(FilterDataType || {});
class ResourceMarkersRenderer {
  constructor(labels, onDidChangeRenderNodeCount) {
    this.labels = labels;
    this.renderedNodes = /* @__PURE__ */ new Map();
    this.disposables = new DisposableStore();
    this.templateId = "rm" /* ResourceMarkers */;
    onDidChangeRenderNodeCount(this.onDidChangeRenderNodeCount, this, this.disposables);
  }
  renderTemplate(container) {
    const resourceLabelContainer = dom.append(container, dom.$(".resource-label-container"));
    const resourceLabel = this.labels.create(resourceLabelContainer, { supportHighlights: true });
    const badgeWrapper = dom.append(container, dom.$(".count-badge-wrapper"));
    const count = new CountBadge(badgeWrapper, {}, defaultCountBadgeStyles);
    return { count, resourceLabel };
  }
  renderElement(node, _, templateData) {
    const resourceMarkers = node.element;
    const uriMatches = node.filterData && node.filterData.uriMatches || [];
    templateData.resourceLabel.setFile(resourceMarkers.resource, { matches: uriMatches });
    this.updateCount(node, templateData);
    const nodeRenders = this.renderedNodes.get(resourceMarkers) ?? [];
    this.renderedNodes.set(resourceMarkers, [...nodeRenders, templateData]);
  }
  disposeElement(node, index, templateData) {
    const nodeRenders = this.renderedNodes.get(node.element) ?? [];
    const nodeRenderIndex = nodeRenders.findIndex((nodeRender) => templateData === nodeRender);
    if (nodeRenderIndex < 0) {
      throw new Error("Disposing unknown resource marker");
    }
    if (nodeRenders.length === 1) {
      this.renderedNodes.delete(node.element);
    } else {
      nodeRenders.splice(nodeRenderIndex, 1);
    }
  }
  disposeTemplate(templateData) {
    templateData.resourceLabel.dispose();
    templateData.count.dispose();
  }
  onDidChangeRenderNodeCount(node) {
    const nodeRenders = this.renderedNodes.get(node.element);
    if (!nodeRenders) {
      return;
    }
    nodeRenders.forEach((nodeRender) => this.updateCount(node, nodeRender));
  }
  updateCount(node, templateData) {
    templateData.count.setCount(node.children.reduce((r, n) => r + (n.visible ? 1 : 0), 0));
  }
  dispose() {
    this.disposables.dispose();
  }
}
class FileResourceMarkersRenderer extends ResourceMarkersRenderer {
}
let MarkerRenderer = class {
  constructor(markersViewState, hoverService, instantiationService, openerService) {
    this.markersViewState = markersViewState;
    this.hoverService = hoverService;
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.templateId = "m" /* Marker */;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.markerWidget = new MarkerWidget(container, this.markersViewState, this.hoverService, this.openerService, this.instantiationService);
    return data;
  }
  renderElement(node, _, templateData) {
    templateData.markerWidget.render(node.element, node.filterData);
  }
  disposeTemplate(templateData) {
    templateData.markerWidget.dispose();
  }
};
MarkerRenderer = __decorateClass([
  __decorateParam(1, IHoverService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IOpenerService)
], MarkerRenderer);
const expandedIcon = registerIcon("markers-view-multi-line-expanded", Codicon.chevronUp, localize("expandedIcon", "Icon indicating that multiple lines are shown in the markers view."));
const collapsedIcon = registerIcon("markers-view-multi-line-collapsed", Codicon.chevronDown, localize("collapsedIcon", "Icon indicating that multiple lines are collapsed in the markers view."));
const toggleMultilineAction = "problems.action.toggleMultiline";
class ToggleMultilineActionViewItem extends ActionViewItem {
  render(container) {
    super.render(container);
    this.updateExpandedAttribute();
  }
  updateClass() {
    super.updateClass();
    this.updateExpandedAttribute();
  }
  updateExpandedAttribute() {
    this.element?.setAttribute("aria-expanded", `${this._action.class === ThemeIcon.asClassName(expandedIcon)}`);
  }
}
class MarkerWidget extends Disposable {
  constructor(parent, markersViewModel, _hoverService, _openerService, _instantiationService) {
    super();
    this.parent = parent;
    this.markersViewModel = markersViewModel;
    this._hoverService = _hoverService;
    this._openerService = _openerService;
    this.disposables = this._register(new DisposableStore());
    this.actionBar = this._register(new ActionBar(dom.append(parent, dom.$(".actions")), {
      actionViewItemProvider: (action, options) => action.id === QuickFixAction.ID ? _instantiationService.createInstance(QuickFixActionViewItem, action, options) : void 0
    }));
    this.iconContainer = dom.append(parent, dom.$(""));
    this.icon = dom.append(this.iconContainer, dom.$(""));
    this.messageAndDetailsContainer = dom.append(parent, dom.$(".marker-message-details-container"));
    this.messageAndDetailsContainerHover = this._register(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.messageAndDetailsContainer, ""));
  }
  render(element, filterData) {
    this.actionBar.clear();
    this.disposables.clear();
    dom.clearNode(this.messageAndDetailsContainer);
    this.iconContainer.className = `marker-icon ${Severity.toString(MarkerSeverity.toSeverity(element.marker.severity))}`;
    this.icon.className = `codicon ${SeverityIcon.className(MarkerSeverity.toSeverity(element.marker.severity))}`;
    this.renderQuickfixActionbar(element);
    this.renderMessageAndDetails(element, filterData);
    this.disposables.add(dom.addDisposableListener(this.parent, dom.EventType.MOUSE_OVER, () => this.markersViewModel.onMarkerMouseHover(element)));
    this.disposables.add(dom.addDisposableListener(this.parent, dom.EventType.MOUSE_LEAVE, () => this.markersViewModel.onMarkerMouseLeave(element)));
  }
  renderQuickfixActionbar(marker) {
    const viewModel = this.markersViewModel.getViewModel(marker);
    if (viewModel) {
      const quickFixAction = viewModel.quickFixAction;
      this.actionBar.push([quickFixAction], { icon: true, label: false });
      this.iconContainer.classList.toggle("quickFix", quickFixAction.enabled);
      quickFixAction.onDidChange(({ enabled }) => {
        if (!isUndefinedOrNull(enabled)) {
          this.iconContainer.classList.toggle("quickFix", enabled);
        }
      }, this, this.disposables);
      quickFixAction.onShowQuickFixes(() => {
        const quickFixActionViewItem = this.actionBar.viewItems[0];
        if (quickFixActionViewItem) {
          quickFixActionViewItem.showQuickFixes();
        }
      }, this, this.disposables);
    }
  }
  renderMultilineActionbar(marker, parent) {
    const multilineActionbar = this.disposables.add(new ActionBar(dom.append(parent, dom.$(".multiline-actions")), {
      actionViewItemProvider: (action2, options) => {
        if (action2.id === toggleMultilineAction) {
          return new ToggleMultilineActionViewItem(void 0, action2, { ...options, icon: true });
        }
        return void 0;
      }
    }));
    this.disposables.add(multilineActionbar);
    const viewModel = this.markersViewModel.getViewModel(marker);
    const multiline = viewModel && viewModel.multiline;
    const action = this.disposables.add(new Action(toggleMultilineAction));
    action.enabled = !!viewModel && marker.lines.length > 1;
    action.tooltip = multiline ? localize("single line", "Show message in single line") : localize("multi line", "Show message in multiple lines");
    action.class = ThemeIcon.asClassName(multiline ? expandedIcon : collapsedIcon);
    action.run = () => {
      if (viewModel) {
        viewModel.multiline = !viewModel.multiline;
      }
      return Promise.resolve();
    };
    multilineActionbar.push([action], { icon: true, label: false });
  }
  renderMessageAndDetails(element, filterData) {
    const { marker, lines } = element;
    const viewState = this.markersViewModel.getViewModel(element);
    const multiline = !viewState || viewState.multiline;
    const lineMatches = filterData && filterData.lineMatches || [];
    this.messageAndDetailsContainerHover.update(element.marker.message);
    const lineElements = [];
    for (let index = 0; index < (multiline ? lines.length : 1); index++) {
      const lineElement = dom.append(this.messageAndDetailsContainer, dom.$(".marker-message-line"));
      const messageElement = dom.append(lineElement, dom.$(".marker-message"));
      const highlightedLabel = this.disposables.add(new HighlightedLabel(messageElement));
      highlightedLabel.set(lines[index].length > 1e3 ? `${lines[index].substring(0, 1e3)}...` : lines[index], lineMatches[index]);
      if (lines[index] === "") {
        lineElement.style.height = `${VirtualDelegate.LINE_HEIGHT}px`;
      }
      lineElements.push(lineElement);
    }
    this.renderDetails(marker, filterData, lineElements[0]);
    this.renderMultilineActionbar(element, lineElements[0]);
  }
  renderDetails(marker, filterData, parent) {
    parent.classList.add("details-container");
    if (marker.source || marker.code) {
      const source = this.disposables.add(new HighlightedLabel(dom.append(parent, dom.$(".marker-source"))));
      const sourceMatches = filterData && filterData.sourceMatches || [];
      source.set(marker.source, sourceMatches);
      if (marker.code) {
        if (typeof marker.code === "string") {
          const code = this.disposables.add(new HighlightedLabel(dom.append(parent, dom.$(".marker-code"))));
          const codeMatches = filterData && filterData.codeMatches || [];
          code.set(marker.code, codeMatches);
        } else {
          const container = dom.$(".marker-code");
          const code = this.disposables.add(new HighlightedLabel(container));
          const link = marker.code.target.toString(true);
          this.disposables.add(new Link(parent, { href: link, label: container, title: link }, void 0, this._hoverService, this._openerService));
          const codeMatches = filterData && filterData.codeMatches || [];
          code.set(marker.code.value, codeMatches);
        }
      }
    }
    const lnCol = dom.append(parent, dom.$("span.marker-line"));
    lnCol.textContent = Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(marker.startLineNumber, marker.startColumn);
  }
}
let RelatedInformationRenderer = class {
  constructor(labelService) {
    this.labelService = labelService;
    this.templateId = "ri" /* RelatedInformation */;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    dom.append(container, dom.$(".actions"));
    dom.append(container, dom.$(".icon"));
    data.resourceLabel = new HighlightedLabel(dom.append(container, dom.$(".related-info-resource")));
    data.lnCol = dom.append(container, dom.$("span.marker-line"));
    const separator = dom.append(container, dom.$("span.related-info-resource-separator"));
    separator.textContent = ":";
    separator.style.paddingRight = "4px";
    data.description = new HighlightedLabel(dom.append(container, dom.$(".marker-description")));
    return data;
  }
  renderElement(node, _, templateData) {
    const relatedInformation = node.element.raw;
    const uriMatches = node.filterData && node.filterData.uriMatches || [];
    const messageMatches = node.filterData && node.filterData.messageMatches || [];
    const resourceLabelTitle = this.labelService.getUriLabel(relatedInformation.resource, { relative: true });
    templateData.resourceLabel.set(basename(relatedInformation.resource), uriMatches, resourceLabelTitle);
    templateData.lnCol.textContent = Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(relatedInformation.startLineNumber, relatedInformation.startColumn);
    templateData.description.set(relatedInformation.message, messageMatches, relatedInformation.message);
  }
  disposeTemplate(templateData) {
    templateData.resourceLabel.dispose();
    templateData.description.dispose();
  }
};
RelatedInformationRenderer = __decorateClass([
  __decorateParam(0, ILabelService)
], RelatedInformationRenderer);
class Filter {
  constructor(options) {
    this.options = options;
  }
  filter(element, parentVisibility) {
    if (element instanceof ResourceMarkers) {
      return this.filterResourceMarkers(element);
    } else if (element instanceof Marker) {
      return this.filterMarker(element, parentVisibility);
    } else {
      return this.filterRelatedInformation(element, parentVisibility);
    }
  }
  filterResourceMarkers(resourceMarkers) {
    if (unsupportedSchemas.has(resourceMarkers.resource.scheme)) {
      return false;
    }
    if (this.options.excludesMatcher.matches(resourceMarkers.resource)) {
      return false;
    }
    if (this.options.includesMatcher.matches(resourceMarkers.resource)) {
      return true;
    }
    if (this.options.textFilter.text && !this.options.textFilter.negate) {
      const uriMatches = FilterOptions._filter(this.options.textFilter.text, basename(resourceMarkers.resource));
      if (uriMatches) {
        return { visibility: true, data: { type: 0 /* ResourceMarkers */, uriMatches: uriMatches || [] } };
      }
    }
    return TreeVisibility.Recurse;
  }
  filterMarker(marker, parentVisibility) {
    const matchesSeverity = this.options.showErrors && MarkerSeverity.Error === marker.marker.severity || this.options.showWarnings && MarkerSeverity.Warning === marker.marker.severity || this.options.showInfos && MarkerSeverity.Info === marker.marker.severity;
    if (!matchesSeverity) {
      return false;
    }
    if (!this.options.textFilter.text) {
      return true;
    }
    const lineMatches = [];
    for (const line of marker.lines) {
      const lineMatch = FilterOptions._messageFilter(this.options.textFilter.text, line);
      lineMatches.push(lineMatch || []);
    }
    const sourceMatches = marker.marker.source ? FilterOptions._filter(this.options.textFilter.text, marker.marker.source) : void 0;
    const codeMatches = marker.marker.code ? FilterOptions._filter(this.options.textFilter.text, typeof marker.marker.code === "string" ? marker.marker.code : marker.marker.code.value) : void 0;
    const matched = sourceMatches || codeMatches || lineMatches.some((lineMatch) => lineMatch.length > 0);
    if (matched && !this.options.textFilter.negate) {
      return { visibility: true, data: { type: 1 /* Marker */, lineMatches, sourceMatches: sourceMatches || [], codeMatches: codeMatches || [] } };
    }
    if (matched && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return false;
    }
    if (!matched && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return true;
    }
    return parentVisibility;
  }
  filterRelatedInformation(relatedInformation, parentVisibility) {
    if (!this.options.textFilter.text) {
      return true;
    }
    const uriMatches = FilterOptions._filter(this.options.textFilter.text, basename(relatedInformation.raw.resource));
    const messageMatches = FilterOptions._messageFilter(this.options.textFilter.text, paths.basename(relatedInformation.raw.message));
    const matched = uriMatches || messageMatches;
    if (matched && !this.options.textFilter.negate) {
      return { visibility: true, data: { type: 2 /* RelatedInformation */, uriMatches: uriMatches || [], messageMatches: messageMatches || [] } };
    }
    if (matched && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return false;
    }
    if (!matched && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return true;
    }
    return parentVisibility;
  }
}
let MarkerViewModel = class extends Disposable {
  constructor(marker, modelService, instantiationService, editorService, languageFeaturesService) {
    super();
    this.marker = marker;
    this.modelService = modelService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.languageFeaturesService = languageFeaturesService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.modelPromise = null;
    this.codeActionsPromise = null;
    this._multiline = true;
    this._quickFixAction = null;
    this._register(toDisposable(() => {
      if (this.modelPromise) {
        this.modelPromise.cancel();
      }
      if (this.codeActionsPromise) {
        this.codeActionsPromise.cancel();
      }
    }));
  }
  get multiline() {
    return this._multiline;
  }
  set multiline(value) {
    if (this._multiline !== value) {
      this._multiline = value;
      this._onDidChange.fire();
    }
  }
  get quickFixAction() {
    if (!this._quickFixAction) {
      this._quickFixAction = this._register(this.instantiationService.createInstance(QuickFixAction, this.marker));
    }
    return this._quickFixAction;
  }
  showLightBulb() {
    this.setQuickFixes(true);
  }
  async setQuickFixes(waitForModel) {
    const codeActions = await this.getCodeActions(waitForModel);
    this.quickFixAction.quickFixes = codeActions ? this.toActions(codeActions) : [];
    this.quickFixAction.autoFixable(!!codeActions && codeActions.hasAutoFix);
  }
  getCodeActions(waitForModel) {
    if (this.codeActionsPromise !== null) {
      return this.codeActionsPromise;
    }
    return this.getModel(waitForModel).then((model) => {
      if (model) {
        if (!this.codeActionsPromise) {
          this.codeActionsPromise = createCancelablePromise((cancellationToken) => {
            return getCodeActions(this.languageFeaturesService.codeActionProvider, model, new Range(this.marker.range.startLineNumber, this.marker.range.startColumn, this.marker.range.endLineNumber, this.marker.range.endColumn), {
              type: CodeActionTriggerType.Invoke,
              triggerAction: CodeActionTriggerSource.ProblemsView,
              filter: { include: CodeActionKind.QuickFix }
            }, Progress.None, cancellationToken).then((actions) => {
              return this._register(actions);
            });
          });
        }
        return this.codeActionsPromise;
      }
      return null;
    });
  }
  toActions(codeActions) {
    return codeActions.validActions.map((item) => toAction({
      id: item.action.command ? item.action.command.id : item.action.title,
      label: item.action.title,
      run: async () => {
        await this.openFileAtMarker(this.marker);
        return await this.instantiationService.invokeFunction(applyCodeAction, item, ApplyCodeActionReason.FromProblemsView);
      }
    }));
  }
  openFileAtMarker(element) {
    const { resource, selection } = { resource: element.resource, selection: element.range };
    return this.editorService.openEditor({
      resource,
      options: {
        selection,
        preserveFocus: true,
        pinned: false,
        revealIfVisible: true
      }
    }, ACTIVE_GROUP).then(() => void 0);
  }
  getModel(waitForModel) {
    const model = this.modelService.getModel(this.marker.resource);
    if (model) {
      return Promise.resolve(model);
    }
    if (waitForModel) {
      if (!this.modelPromise) {
        this.modelPromise = createCancelablePromise((cancellationToken) => {
          return new Promise((c) => {
            this._register(this.modelService.onModelAdded((model2) => {
              if (isEqual(model2.uri, this.marker.resource)) {
                c(model2);
              }
            }));
          });
        });
      }
      return this.modelPromise;
    }
    return Promise.resolve(null);
  }
};
MarkerViewModel = __decorateClass([
  __decorateParam(1, IModelService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, ILanguageFeaturesService)
], MarkerViewModel);
let MarkersViewModel = class extends Disposable {
  constructor(multiline = true, viewMode = MarkersViewMode.Tree, contextKeyService, instantiationService) {
    super();
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onDidChangeViewMode = this._register(new Emitter());
    this.onDidChangeViewMode = this._onDidChangeViewMode.event;
    this.markersViewStates = /* @__PURE__ */ new Map();
    this.markersPerResource = /* @__PURE__ */ new Map();
    this.bulkUpdate = false;
    this.hoveredMarker = null;
    this.hoverDelayer = new Delayer(300);
    this._multiline = true;
    this._viewMode = MarkersViewMode.Tree;
    this._multiline = multiline;
    this._viewMode = viewMode;
    this.viewModeContextKey = MarkersContextKeys.MarkersViewModeContextKey.bindTo(this.contextKeyService);
    this.viewModeContextKey.set(viewMode);
  }
  add(marker) {
    if (!this.markersViewStates.has(marker.id)) {
      const viewModel = this.instantiationService.createInstance(MarkerViewModel, marker);
      const disposables = [viewModel];
      viewModel.multiline = this.multiline;
      viewModel.onDidChange(() => {
        if (!this.bulkUpdate) {
          this._onDidChange.fire(marker);
        }
      }, this, disposables);
      this.markersViewStates.set(marker.id, { viewModel, disposables });
      const markers = this.markersPerResource.get(marker.resource.toString()) || [];
      markers.push(marker);
      this.markersPerResource.set(marker.resource.toString(), markers);
    }
  }
  remove(resource) {
    const markers = this.markersPerResource.get(resource.toString()) || [];
    for (const marker of markers) {
      const value = this.markersViewStates.get(marker.id);
      if (value) {
        dispose(value.disposables);
      }
      this.markersViewStates.delete(marker.id);
      if (this.hoveredMarker === marker) {
        this.hoveredMarker = null;
      }
    }
    this.markersPerResource.delete(resource.toString());
  }
  getViewModel(marker) {
    const value = this.markersViewStates.get(marker.id);
    return value ? value.viewModel : null;
  }
  onMarkerMouseHover(marker) {
    this.hoveredMarker = marker;
    this.hoverDelayer.trigger(() => {
      if (this.hoveredMarker) {
        const model = this.getViewModel(this.hoveredMarker);
        if (model) {
          model.showLightBulb();
        }
      }
    });
  }
  onMarkerMouseLeave(marker) {
    if (this.hoveredMarker === marker) {
      this.hoveredMarker = null;
    }
  }
  get multiline() {
    return this._multiline;
  }
  set multiline(value) {
    let changed = false;
    if (this._multiline !== value) {
      this._multiline = value;
      changed = true;
    }
    this.bulkUpdate = true;
    this.markersViewStates.forEach(({ viewModel }) => {
      if (viewModel.multiline !== value) {
        viewModel.multiline = value;
        changed = true;
      }
    });
    this.bulkUpdate = false;
    if (changed) {
      this._onDidChange.fire(void 0);
    }
  }
  get viewMode() {
    return this._viewMode;
  }
  set viewMode(value) {
    if (this._viewMode === value) {
      return;
    }
    this._viewMode = value;
    this._onDidChangeViewMode.fire(value);
    this.viewModeContextKey.set(value);
  }
  dispose() {
    this.markersViewStates.forEach(({ disposables }) => dispose(disposables));
    this.markersViewStates.clear();
    this.markersPerResource.clear();
    super.dispose();
  }
};
MarkersViewModel = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IInstantiationService)
], MarkersViewModel);
export {
  FileResourceMarkersRenderer,
  Filter,
  MarkerRenderer,
  MarkerViewModel,
  MarkersViewModel,
  MarkersWidgetAccessibilityProvider,
  RelatedInformationRenderer,
  ResourceMarkersRenderer,
  VirtualDelegate
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZXJzL2Jyb3dzZXIvbWFya2Vyc1RyZWVWaWV3ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBwYXRocyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IENvdW50QmFkZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY291bnRCYWRnZS9jb3VudEJhZGdlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTGFiZWxzLCBJUmVzb3VyY2VMYWJlbCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IEhpZ2hsaWdodGVkTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaGlnaGxpZ2h0ZWRsYWJlbC9oaWdobGlnaHRlZExhYmVsLmpzJztcbmltcG9ydCB7IElNYXJrZXIsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcmtlcnMsIE1hcmtlciwgUmVsYXRlZEluZm9ybWF0aW9uLCBNYXJrZXJFbGVtZW50LCBNYXJrZXJUYWJsZUl0ZW0gfSBmcm9tICcuL21hcmtlcnNNb2RlbC5qcyc7XG5pbXBvcnQgTWVzc2FnZXMgZnJvbSAnLi9tZXNzYWdlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSwgRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgUXVpY2tGaXhBY3Rpb24sIFF1aWNrRml4QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuL21hcmtlcnNWaWV3QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJVHJlZUZpbHRlciwgVHJlZVZpc2liaWxpdHksIFRyZWVGaWx0ZXJSZXN1bHQsIElUcmVlUmVuZGVyZXIsIElUcmVlTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgRmlsdGVyT3B0aW9ucyB9IGZyb20gJy4vbWFya2Vyc0ZpbHRlck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSU1hdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBpc1VuZGVmaW5lZE9yTnVsbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIHRvQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxhYmxlUHJvbWlzZSwgY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UsIERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBhcHBseUNvZGVBY3Rpb24sIEFwcGx5Q29kZUFjdGlvblJlYXNvbiwgZ2V0Q29kZUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2Jyb3dzZXIvY29kZUFjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RlQWN0aW9uS2luZCwgQ29kZUFjdGlvblNldCwgQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSwgQUNUSVZFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNldmVyaXR5SWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zZXZlcml0eUljb24vc2V2ZXJpdHlJY29uLmpzJztcbmltcG9ydCB7IENvZGVBY3Rpb25UcmlnZ2VyVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBMaW5rIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2Jyb3dzZXIvbGluay5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgTWFya2Vyc0NvbnRleHRLZXlzLCBNYXJrZXJzVmlld01vZGUgfSBmcm9tICcuLi9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyB1bnN1cHBvcnRlZFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGRlZmF1bHRDb3VudEJhZGdlU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgdHlwZSB7IElNYW5hZ2VkSG92ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuXG5pbnRlcmZhY2UgSVJlc291cmNlTWFya2Vyc1RlbXBsYXRlRGF0YSB7XG5cdHJlYWRvbmx5IHJlc291cmNlTGFiZWw6IElSZXNvdXJjZUxhYmVsO1xuXHRyZWFkb25seSBjb3VudDogQ291bnRCYWRnZTtcbn1cblxuaW50ZXJmYWNlIElNYXJrZXJUZW1wbGF0ZURhdGEge1xuXHRtYXJrZXJXaWRnZXQ6IE1hcmtlcldpZGdldDtcbn1cblxuaW50ZXJmYWNlIElSZWxhdGVkSW5mb3JtYXRpb25UZW1wbGF0ZURhdGEge1xuXHRyZXNvdXJjZUxhYmVsOiBIaWdobGlnaHRlZExhYmVsO1xuXHRsbkNvbDogSFRNTEVsZW1lbnQ7XG5cdGRlc2NyaXB0aW9uOiBIaWdobGlnaHRlZExhYmVsO1xufVxuXG5leHBvcnQgY2xhc3MgTWFya2Vyc1dpZGdldEFjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPE1hcmtlckVsZW1lbnQgfCBNYXJrZXJUYWJsZUl0ZW0+IHtcblxuXHRjb25zdHJ1Y3RvcihASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSkgeyB9XG5cblx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdwcm9ibGVtc1ZpZXcnLCBcIlByb2JsZW1zIFZpZXdcIik7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QXJpYUxhYmVsKGVsZW1lbnQ6IE1hcmtlckVsZW1lbnQgfCBNYXJrZXJUYWJsZUl0ZW0pOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFJlc291cmNlTWFya2Vycykge1xuXHRcdFx0Y29uc3QgcGF0aCA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGVsZW1lbnQucmVzb3VyY2UsIHsgcmVsYXRpdmU6IHRydWUgfSkgfHwgZWxlbWVudC5yZXNvdXJjZS5mc1BhdGg7XG5cdFx0XHRyZXR1cm4gTWVzc2FnZXMuTUFSS0VSU19UUkVFX0FSSUFfTEFCRUxfUkVTT1VSQ0UoZWxlbWVudC5tYXJrZXJzLmxlbmd0aCwgZWxlbWVudC5uYW1lLCBwYXRocy5kaXJuYW1lKHBhdGgpKTtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBNYXJrZXIgfHwgZWxlbWVudCBpbnN0YW5jZW9mIE1hcmtlclRhYmxlSXRlbSkge1xuXHRcdFx0cmV0dXJuIE1lc3NhZ2VzLk1BUktFUlNfVFJFRV9BUklBX0xBQkVMX01BUktFUihlbGVtZW50KTtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZWxhdGVkSW5mb3JtYXRpb24pIHtcblx0XHRcdHJldHVybiBNZXNzYWdlcy5NQVJLRVJTX1RSRUVfQVJJQV9MQUJFTF9SRUxBVEVEX0lORk9STUFUSU9OKGVsZW1lbnQucmF3KTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuY29uc3QgZW51bSBUZW1wbGF0ZUlkIHtcblx0UmVzb3VyY2VNYXJrZXJzID0gJ3JtJyxcblx0TWFya2VyID0gJ20nLFxuXHRSZWxhdGVkSW5mb3JtYXRpb24gPSAncmknXG59XG5cbmV4cG9ydCBjbGFzcyBWaXJ0dWFsRGVsZWdhdGUgaW1wbGVtZW50cyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxNYXJrZXJFbGVtZW50PiB7XG5cblx0c3RhdGljIExJTkVfSEVJR0hUOiBudW1iZXIgPSAyMjtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IG1hcmtlcnNWaWV3U3RhdGU6IE1hcmtlcnNWaWV3TW9kZWwpIHsgfVxuXG5cdGdldEhlaWdodChlbGVtZW50OiBNYXJrZXJFbGVtZW50KTogbnVtYmVyIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIE1hcmtlcikge1xuXHRcdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5tYXJrZXJzVmlld1N0YXRlLmdldFZpZXdNb2RlbChlbGVtZW50KTtcblx0XHRcdGNvbnN0IG5vT2ZMaW5lcyA9ICF2aWV3TW9kZWwgfHwgdmlld01vZGVsLm11bHRpbGluZSA/IGVsZW1lbnQubGluZXMubGVuZ3RoIDogMTtcblx0XHRcdHJldHVybiBub09mTGluZXMgKiBWaXJ0dWFsRGVsZWdhdGUuTElORV9IRUlHSFQ7XG5cdFx0fVxuXHRcdHJldHVybiBWaXJ0dWFsRGVsZWdhdGUuTElORV9IRUlHSFQ7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IE1hcmtlckVsZW1lbnQpOiBzdHJpbmcge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgUmVzb3VyY2VNYXJrZXJzKSB7XG5cdFx0XHRyZXR1cm4gVGVtcGxhdGVJZC5SZXNvdXJjZU1hcmtlcnM7XG5cdFx0fSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgTWFya2VyKSB7XG5cdFx0XHRyZXR1cm4gVGVtcGxhdGVJZC5NYXJrZXI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBUZW1wbGF0ZUlkLlJlbGF0ZWRJbmZvcm1hdGlvbjtcblx0XHR9XG5cdH1cbn1cblxuY29uc3QgZW51bSBGaWx0ZXJEYXRhVHlwZSB7XG5cdFJlc291cmNlTWFya2Vycyxcblx0TWFya2VyLFxuXHRSZWxhdGVkSW5mb3JtYXRpb25cbn1cblxuaW50ZXJmYWNlIFJlc291cmNlTWFya2Vyc0ZpbHRlckRhdGEge1xuXHR0eXBlOiBGaWx0ZXJEYXRhVHlwZS5SZXNvdXJjZU1hcmtlcnM7XG5cdHVyaU1hdGNoZXM6IElNYXRjaFtdO1xufVxuXG5pbnRlcmZhY2UgTWFya2VyRmlsdGVyRGF0YSB7XG5cdHR5cGU6IEZpbHRlckRhdGFUeXBlLk1hcmtlcjtcblx0bGluZU1hdGNoZXM6IElNYXRjaFtdW107XG5cdHNvdXJjZU1hdGNoZXM6IElNYXRjaFtdO1xuXHRjb2RlTWF0Y2hlczogSU1hdGNoW107XG59XG5cbmludGVyZmFjZSBSZWxhdGVkSW5mb3JtYXRpb25GaWx0ZXJEYXRhIHtcblx0dHlwZTogRmlsdGVyRGF0YVR5cGUuUmVsYXRlZEluZm9ybWF0aW9uO1xuXHR1cmlNYXRjaGVzOiBJTWF0Y2hbXTtcblx0bWVzc2FnZU1hdGNoZXM6IElNYXRjaFtdO1xufVxuXG5leHBvcnQgdHlwZSBGaWx0ZXJEYXRhID0gUmVzb3VyY2VNYXJrZXJzRmlsdGVyRGF0YSB8IE1hcmtlckZpbHRlckRhdGEgfCBSZWxhdGVkSW5mb3JtYXRpb25GaWx0ZXJEYXRhO1xuXG5leHBvcnQgY2xhc3MgUmVzb3VyY2VNYXJrZXJzUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFJlc291cmNlTWFya2VycywgUmVzb3VyY2VNYXJrZXJzRmlsdGVyRGF0YSwgSVJlc291cmNlTWFya2Vyc1RlbXBsYXRlRGF0YT4ge1xuXG5cdHByaXZhdGUgcmVuZGVyZWROb2RlcyA9IG5ldyBNYXA8UmVzb3VyY2VNYXJrZXJzLCBJUmVzb3VyY2VNYXJrZXJzVGVtcGxhdGVEYXRhW10+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBsYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdG9uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50OiBFdmVudDxJVHJlZU5vZGU8UmVzb3VyY2VNYXJrZXJzLCBSZXNvdXJjZU1hcmtlcnNGaWx0ZXJEYXRhPj4sXG5cdCkge1xuXHRcdG9uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50KHRoaXMub25EaWRDaGFuZ2VSZW5kZXJOb2RlQ291bnQsIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0dGVtcGxhdGVJZCA9IFRlbXBsYXRlSWQuUmVzb3VyY2VNYXJrZXJzO1xuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJUmVzb3VyY2VNYXJrZXJzVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCByZXNvdXJjZUxhYmVsQ29udGFpbmVyID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcucmVzb3VyY2UtbGFiZWwtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IHJlc291cmNlTGFiZWwgPSB0aGlzLmxhYmVscy5jcmVhdGUocmVzb3VyY2VMYWJlbENvbnRhaW5lciwgeyBzdXBwb3J0SGlnaGxpZ2h0czogdHJ1ZSB9KTtcblxuXHRcdGNvbnN0IGJhZGdlV3JhcHBlciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLmNvdW50LWJhZGdlLXdyYXBwZXInKSk7XG5cdFx0Y29uc3QgY291bnQgPSBuZXcgQ291bnRCYWRnZShiYWRnZVdyYXBwZXIsIHt9LCBkZWZhdWx0Q291bnRCYWRnZVN0eWxlcyk7XG5cblx0XHRyZXR1cm4geyBjb3VudCwgcmVzb3VyY2VMYWJlbCB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8UmVzb3VyY2VNYXJrZXJzLCBSZXNvdXJjZU1hcmtlcnNGaWx0ZXJEYXRhPiwgXzogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElSZXNvdXJjZU1hcmtlcnNUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCByZXNvdXJjZU1hcmtlcnMgPSBub2RlLmVsZW1lbnQ7XG5cdFx0Y29uc3QgdXJpTWF0Y2hlcyA9IG5vZGUuZmlsdGVyRGF0YSAmJiBub2RlLmZpbHRlckRhdGEudXJpTWF0Y2hlcyB8fCBbXTtcblxuXHRcdHRlbXBsYXRlRGF0YS5yZXNvdXJjZUxhYmVsLnNldEZpbGUocmVzb3VyY2VNYXJrZXJzLnJlc291cmNlLCB7IG1hdGNoZXM6IHVyaU1hdGNoZXMgfSk7XG5cblx0XHR0aGlzLnVwZGF0ZUNvdW50KG5vZGUsIHRlbXBsYXRlRGF0YSk7XG5cdFx0Y29uc3Qgbm9kZVJlbmRlcnMgPSB0aGlzLnJlbmRlcmVkTm9kZXMuZ2V0KHJlc291cmNlTWFya2VycykgPz8gW107XG5cdFx0dGhpcy5yZW5kZXJlZE5vZGVzLnNldChyZXNvdXJjZU1hcmtlcnMsIFsuLi5ub2RlUmVuZGVycywgdGVtcGxhdGVEYXRhXSk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChub2RlOiBJVHJlZU5vZGU8UmVzb3VyY2VNYXJrZXJzLCBSZXNvdXJjZU1hcmtlcnNGaWx0ZXJEYXRhPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJUmVzb3VyY2VNYXJrZXJzVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZVJlbmRlcnMgPSB0aGlzLnJlbmRlcmVkTm9kZXMuZ2V0KG5vZGUuZWxlbWVudCkgPz8gW107XG5cdFx0Y29uc3Qgbm9kZVJlbmRlckluZGV4ID0gbm9kZVJlbmRlcnMuZmluZEluZGV4KG5vZGVSZW5kZXIgPT4gdGVtcGxhdGVEYXRhID09PSBub2RlUmVuZGVyKTtcblxuXHRcdGlmIChub2RlUmVuZGVySW5kZXggPCAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Rpc3Bvc2luZyB1bmtub3duIHJlc291cmNlIG1hcmtlcicpO1xuXHRcdH1cblxuXHRcdGlmIChub2RlUmVuZGVycy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHRoaXMucmVuZGVyZWROb2Rlcy5kZWxldGUobm9kZS5lbGVtZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bm9kZVJlbmRlcnMuc3BsaWNlKG5vZGVSZW5kZXJJbmRleCwgMSk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVJlc291cmNlTWFya2Vyc1RlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5yZXNvdXJjZUxhYmVsLmRpc3Bvc2UoKTtcblx0XHR0ZW1wbGF0ZURhdGEuY291bnQuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZVJlbmRlck5vZGVDb3VudChub2RlOiBJVHJlZU5vZGU8UmVzb3VyY2VNYXJrZXJzLCBSZXNvdXJjZU1hcmtlcnNGaWx0ZXJEYXRhPik6IHZvaWQge1xuXHRcdGNvbnN0IG5vZGVSZW5kZXJzID0gdGhpcy5yZW5kZXJlZE5vZGVzLmdldChub2RlLmVsZW1lbnQpO1xuXG5cdFx0aWYgKCFub2RlUmVuZGVycykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG5vZGVSZW5kZXJzLmZvckVhY2gobm9kZVJlbmRlciA9PiB0aGlzLnVwZGF0ZUNvdW50KG5vZGUsIG5vZGVSZW5kZXIpKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ291bnQobm9kZTogSVRyZWVOb2RlPFJlc291cmNlTWFya2VycywgUmVzb3VyY2VNYXJrZXJzRmlsdGVyRGF0YT4sIHRlbXBsYXRlRGF0YTogSVJlc291cmNlTWFya2Vyc1RlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5jb3VudC5zZXRDb3VudChub2RlLmNoaWxkcmVuLnJlZHVjZSgociwgbikgPT4gciArIChuLnZpc2libGUgPyAxIDogMCksIDApKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVSZXNvdXJjZU1hcmtlcnNSZW5kZXJlciBleHRlbmRzIFJlc291cmNlTWFya2Vyc1JlbmRlcmVyIHtcbn1cblxuZXhwb3J0IGNsYXNzIE1hcmtlclJlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxNYXJrZXIsIE1hcmtlckZpbHRlckRhdGEsIElNYXJrZXJUZW1wbGF0ZURhdGE+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1hcmtlcnNWaWV3U3RhdGU6IE1hcmtlcnNWaWV3TW9kZWwsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJvdGVjdGVkIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcm90ZWN0ZWQgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdCkgeyB9XG5cblx0dGVtcGxhdGVJZCA9IFRlbXBsYXRlSWQuTWFya2VyO1xuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJTWFya2VyVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBkYXRhOiBJTWFya2VyVGVtcGxhdGVEYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRkYXRhLm1hcmtlcldpZGdldCA9IG5ldyBNYXJrZXJXaWRnZXQoY29udGFpbmVyLCB0aGlzLm1hcmtlcnNWaWV3U3RhdGUsIHRoaXMuaG92ZXJTZXJ2aWNlLCB0aGlzLm9wZW5lclNlcnZpY2UsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8TWFya2VyLCBNYXJrZXJGaWx0ZXJEYXRhPiwgXzogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElNYXJrZXJUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEubWFya2VyV2lkZ2V0LnJlbmRlcihub2RlLmVsZW1lbnQsIG5vZGUuZmlsdGVyRGF0YSk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJTWFya2VyVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLm1hcmtlcldpZGdldC5kaXNwb3NlKCk7XG5cdH1cblxufVxuXG5jb25zdCBleHBhbmRlZEljb24gPSByZWdpc3Rlckljb24oJ21hcmtlcnMtdmlldy1tdWx0aS1saW5lLWV4cGFuZGVkJywgQ29kaWNvbi5jaGV2cm9uVXAsIGxvY2FsaXplKCdleHBhbmRlZEljb24nLCAnSWNvbiBpbmRpY2F0aW5nIHRoYXQgbXVsdGlwbGUgbGluZXMgYXJlIHNob3duIGluIHRoZSBtYXJrZXJzIHZpZXcuJykpO1xuY29uc3QgY29sbGFwc2VkSWNvbiA9IHJlZ2lzdGVySWNvbignbWFya2Vycy12aWV3LW11bHRpLWxpbmUtY29sbGFwc2VkJywgQ29kaWNvbi5jaGV2cm9uRG93biwgbG9jYWxpemUoJ2NvbGxhcHNlZEljb24nLCAnSWNvbiBpbmRpY2F0aW5nIHRoYXQgbXVsdGlwbGUgbGluZXMgYXJlIGNvbGxhcHNlZCBpbiB0aGUgbWFya2VycyB2aWV3LicpKTtcblxuY29uc3QgdG9nZ2xlTXVsdGlsaW5lQWN0aW9uID0gJ3Byb2JsZW1zLmFjdGlvbi50b2dnbGVNdWx0aWxpbmUnO1xuXG5jbGFzcyBUb2dnbGVNdWx0aWxpbmVBY3Rpb25WaWV3SXRlbSBleHRlbmRzIEFjdGlvblZpZXdJdGVtIHtcblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXHRcdHRoaXMudXBkYXRlRXhwYW5kZWRBdHRyaWJ1dGUoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVDbGFzcygpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVDbGFzcygpO1xuXHRcdHRoaXMudXBkYXRlRXhwYW5kZWRBdHRyaWJ1dGUoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRXhwYW5kZWRBdHRyaWJ1dGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbGVtZW50Py5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBgJHt0aGlzLl9hY3Rpb24uY2xhc3MgPT09IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShleHBhbmRlZEljb24pfWApO1xuXHR9XG5cbn1cblxuY2xhc3MgTWFya2VyV2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBhY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0cHJpdmF0ZSByZWFkb25seSBpY29uOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBpY29uQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBtZXNzYWdlQW5kRGV0YWlsc0NvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWVzc2FnZUFuZERldGFpbHNDb250YWluZXJIb3ZlcjogSU1hbmFnZWRIb3Zlcjtcblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBwYXJlbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbWFya2Vyc1ZpZXdNb2RlbDogTWFya2Vyc1ZpZXdNb2RlbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9ob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0X2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmFjdGlvbkJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25CYXIoZG9tLmFwcGVuZChwYXJlbnQsIGRvbS4kKCcuYWN0aW9ucycpKSwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbjogSUFjdGlvbiwgb3B0aW9ucykgPT4gYWN0aW9uLmlkID09PSBRdWlja0ZpeEFjdGlvbi5JRCA/IF9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWlja0ZpeEFjdGlvblZpZXdJdGVtLCA8UXVpY2tGaXhBY3Rpb24+YWN0aW9uLCBvcHRpb25zKSA6IHVuZGVmaW5lZFxuXHRcdH0pKTtcblxuXHRcdC8vIHdyYXAgdGhlIGljb24gaW4gYSBjb250YWluZXIgdGhhdCBnZXQgdGhlIGljb24gY29sb3IgYXMgZm9yZWdyb3VuZCBjb2xvci4gVGhhdCB3YXksIGlmIHRoZVxuXHRcdC8vIGxpc3QgdmlldyBkb2VzIG5vdCBoYXZlIGEgc3BlY2lmaWMgY29sb3IgZm9yIHRoZSBpY29uICg9dGhlIGNvbG9yIHZhcmlhYmxlIGlzIGludmFsaWQpIGl0XG5cdFx0Ly8gZmFsbHMgYmFjayB0byB0aGUgZm9yZWdyb3VuZCBjb2xvciBvZiBjb250YWluZXIgKGluaGVyaXQpXG5cdFx0dGhpcy5pY29uQ29udGFpbmVyID0gZG9tLmFwcGVuZChwYXJlbnQsIGRvbS4kKCcnKSk7XG5cdFx0dGhpcy5pY29uID0gZG9tLmFwcGVuZCh0aGlzLmljb25Db250YWluZXIsIGRvbS4kKCcnKSk7XG5cdFx0dGhpcy5tZXNzYWdlQW5kRGV0YWlsc0NvbnRhaW5lciA9IGRvbS5hcHBlbmQocGFyZW50LCBkb20uJCgnLm1hcmtlci1tZXNzYWdlLWRldGFpbHMtY29udGFpbmVyJykpO1xuXHRcdHRoaXMubWVzc2FnZUFuZERldGFpbHNDb250YWluZXJIb3ZlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2hvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5tZXNzYWdlQW5kRGV0YWlsc0NvbnRhaW5lciwgJycpKTtcblx0fVxuXG5cdHJlbmRlcihlbGVtZW50OiBNYXJrZXIsIGZpbHRlckRhdGE6IE1hcmtlckZpbHRlckRhdGEgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLmFjdGlvbkJhci5jbGVhcigpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRkb20uY2xlYXJOb2RlKHRoaXMubWVzc2FnZUFuZERldGFpbHNDb250YWluZXIpO1xuXG5cdFx0dGhpcy5pY29uQ29udGFpbmVyLmNsYXNzTmFtZSA9IGBtYXJrZXItaWNvbiAke1NldmVyaXR5LnRvU3RyaW5nKE1hcmtlclNldmVyaXR5LnRvU2V2ZXJpdHkoZWxlbWVudC5tYXJrZXIuc2V2ZXJpdHkpKX1gO1xuXHRcdHRoaXMuaWNvbi5jbGFzc05hbWUgPSBgY29kaWNvbiAke1NldmVyaXR5SWNvbi5jbGFzc05hbWUoTWFya2VyU2V2ZXJpdHkudG9TZXZlcml0eShlbGVtZW50Lm1hcmtlci5zZXZlcml0eSkpfWA7XG5cdFx0dGhpcy5yZW5kZXJRdWlja2ZpeEFjdGlvbmJhcihlbGVtZW50KTtcblxuXHRcdHRoaXMucmVuZGVyTWVzc2FnZUFuZERldGFpbHMoZWxlbWVudCwgZmlsdGVyRGF0YSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnBhcmVudCwgZG9tLkV2ZW50VHlwZS5NT1VTRV9PVkVSLCAoKSA9PiB0aGlzLm1hcmtlcnNWaWV3TW9kZWwub25NYXJrZXJNb3VzZUhvdmVyKGVsZW1lbnQpKSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnBhcmVudCwgZG9tLkV2ZW50VHlwZS5NT1VTRV9MRUFWRSwgKCkgPT4gdGhpcy5tYXJrZXJzVmlld01vZGVsLm9uTWFya2VyTW91c2VMZWF2ZShlbGVtZW50KSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJRdWlja2ZpeEFjdGlvbmJhcihtYXJrZXI6IE1hcmtlcik6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMubWFya2Vyc1ZpZXdNb2RlbC5nZXRWaWV3TW9kZWwobWFya2VyKTtcblx0XHRpZiAodmlld01vZGVsKSB7XG5cdFx0XHRjb25zdCBxdWlja0ZpeEFjdGlvbiA9IHZpZXdNb2RlbC5xdWlja0ZpeEFjdGlvbjtcblx0XHRcdHRoaXMuYWN0aW9uQmFyLnB1c2goW3F1aWNrRml4QWN0aW9uXSwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0XHR0aGlzLmljb25Db250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgncXVpY2tGaXgnLCBxdWlja0ZpeEFjdGlvbi5lbmFibGVkKTtcblx0XHRcdHF1aWNrRml4QWN0aW9uLm9uRGlkQ2hhbmdlKCh7IGVuYWJsZWQgfSkgPT4ge1xuXHRcdFx0XHRpZiAoIWlzVW5kZWZpbmVkT3JOdWxsKGVuYWJsZWQpKSB7XG5cdFx0XHRcdFx0dGhpcy5pY29uQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3F1aWNrRml4JywgZW5hYmxlZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdFx0cXVpY2tGaXhBY3Rpb24ub25TaG93UXVpY2tGaXhlcygoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHF1aWNrRml4QWN0aW9uVmlld0l0ZW0gPSA8UXVpY2tGaXhBY3Rpb25WaWV3SXRlbT50aGlzLmFjdGlvbkJhci52aWV3SXRlbXNbMF07XG5cdFx0XHRcdGlmIChxdWlja0ZpeEFjdGlvblZpZXdJdGVtKSB7XG5cdFx0XHRcdFx0cXVpY2tGaXhBY3Rpb25WaWV3SXRlbS5zaG93UXVpY2tGaXhlcygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck11bHRpbGluZUFjdGlvbmJhcihtYXJrZXI6IE1hcmtlciwgcGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IG11bHRpbGluZUFjdGlvbmJhciA9IHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBBY3Rpb25CYXIoZG9tLmFwcGVuZChwYXJlbnQsIGRvbS4kKCcubXVsdGlsaW5lLWFjdGlvbnMnKSksIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gdG9nZ2xlTXVsdGlsaW5lQWN0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBUb2dnbGVNdWx0aWxpbmVBY3Rpb25WaWV3SXRlbSh1bmRlZmluZWQsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBpY29uOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKG11bHRpbGluZUFjdGlvbmJhcik7XG5cblx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLm1hcmtlcnNWaWV3TW9kZWwuZ2V0Vmlld01vZGVsKG1hcmtlcik7XG5cdFx0Y29uc3QgbXVsdGlsaW5lID0gdmlld01vZGVsICYmIHZpZXdNb2RlbC5tdWx0aWxpbmU7XG5cdFx0Y29uc3QgYWN0aW9uID0gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IEFjdGlvbih0b2dnbGVNdWx0aWxpbmVBY3Rpb24pKTtcblx0XHRhY3Rpb24uZW5hYmxlZCA9ICEhdmlld01vZGVsICYmIG1hcmtlci5saW5lcy5sZW5ndGggPiAxO1xuXHRcdGFjdGlvbi50b29sdGlwID0gbXVsdGlsaW5lID8gbG9jYWxpemUoJ3NpbmdsZSBsaW5lJywgXCJTaG93IG1lc3NhZ2UgaW4gc2luZ2xlIGxpbmVcIikgOiBsb2NhbGl6ZSgnbXVsdGkgbGluZScsIFwiU2hvdyBtZXNzYWdlIGluIG11bHRpcGxlIGxpbmVzXCIpO1xuXHRcdGFjdGlvbi5jbGFzcyA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShtdWx0aWxpbmUgPyBleHBhbmRlZEljb24gOiBjb2xsYXBzZWRJY29uKTtcblx0XHRhY3Rpb24ucnVuID0gKCkgPT4geyBpZiAodmlld01vZGVsKSB7IHZpZXdNb2RlbC5tdWx0aWxpbmUgPSAhdmlld01vZGVsLm11bHRpbGluZTsgfSByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7IH07XG5cdFx0bXVsdGlsaW5lQWN0aW9uYmFyLnB1c2goW2FjdGlvbl0sIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJNZXNzYWdlQW5kRGV0YWlscyhlbGVtZW50OiBNYXJrZXIsIGZpbHRlckRhdGE6IE1hcmtlckZpbHRlckRhdGEgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCB7IG1hcmtlciwgbGluZXMgfSA9IGVsZW1lbnQ7XG5cdFx0Y29uc3Qgdmlld1N0YXRlID0gdGhpcy5tYXJrZXJzVmlld01vZGVsLmdldFZpZXdNb2RlbChlbGVtZW50KTtcblx0XHRjb25zdCBtdWx0aWxpbmUgPSAhdmlld1N0YXRlIHx8IHZpZXdTdGF0ZS5tdWx0aWxpbmU7XG5cdFx0Y29uc3QgbGluZU1hdGNoZXMgPSBmaWx0ZXJEYXRhICYmIGZpbHRlckRhdGEubGluZU1hdGNoZXMgfHwgW107XG5cdFx0dGhpcy5tZXNzYWdlQW5kRGV0YWlsc0NvbnRhaW5lckhvdmVyLnVwZGF0ZShlbGVtZW50Lm1hcmtlci5tZXNzYWdlKTtcblxuXHRcdGNvbnN0IGxpbmVFbGVtZW50czogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCAobXVsdGlsaW5lID8gbGluZXMubGVuZ3RoIDogMSk7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGxpbmVFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLm1lc3NhZ2VBbmREZXRhaWxzQ29udGFpbmVyLCBkb20uJCgnLm1hcmtlci1tZXNzYWdlLWxpbmUnKSk7XG5cdFx0XHRjb25zdCBtZXNzYWdlRWxlbWVudCA9IGRvbS5hcHBlbmQobGluZUVsZW1lbnQsIGRvbS4kKCcubWFya2VyLW1lc3NhZ2UnKSk7XG5cdFx0XHRjb25zdCBoaWdobGlnaHRlZExhYmVsID0gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IEhpZ2hsaWdodGVkTGFiZWwobWVzc2FnZUVsZW1lbnQpKTtcblx0XHRcdGhpZ2hsaWdodGVkTGFiZWwuc2V0KGxpbmVzW2luZGV4XS5sZW5ndGggPiAxMDAwID8gYCR7bGluZXNbaW5kZXhdLnN1YnN0cmluZygwLCAxMDAwKX0uLi5gIDogbGluZXNbaW5kZXhdLCBsaW5lTWF0Y2hlc1tpbmRleF0pO1xuXHRcdFx0aWYgKGxpbmVzW2luZGV4XSA9PT0gJycpIHtcblx0XHRcdFx0bGluZUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gYCR7VmlydHVhbERlbGVnYXRlLkxJTkVfSEVJR0hUfXB4YDtcblx0XHRcdH1cblx0XHRcdGxpbmVFbGVtZW50cy5wdXNoKGxpbmVFbGVtZW50KTtcblx0XHR9XG5cdFx0dGhpcy5yZW5kZXJEZXRhaWxzKG1hcmtlciwgZmlsdGVyRGF0YSwgbGluZUVsZW1lbnRzWzBdKTtcblx0XHR0aGlzLnJlbmRlck11bHRpbGluZUFjdGlvbmJhcihlbGVtZW50LCBsaW5lRWxlbWVudHNbMF0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJEZXRhaWxzKG1hcmtlcjogSU1hcmtlciwgZmlsdGVyRGF0YTogTWFya2VyRmlsdGVyRGF0YSB8IHVuZGVmaW5lZCwgcGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHBhcmVudC5jbGFzc0xpc3QuYWRkKCdkZXRhaWxzLWNvbnRhaW5lcicpO1xuXG5cdFx0aWYgKG1hcmtlci5zb3VyY2UgfHwgbWFya2VyLmNvZGUpIHtcblx0XHRcdGNvbnN0IHNvdXJjZSA9IHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBIaWdobGlnaHRlZExhYmVsKGRvbS5hcHBlbmQocGFyZW50LCBkb20uJCgnLm1hcmtlci1zb3VyY2UnKSkpKTtcblx0XHRcdGNvbnN0IHNvdXJjZU1hdGNoZXMgPSBmaWx0ZXJEYXRhICYmIGZpbHRlckRhdGEuc291cmNlTWF0Y2hlcyB8fCBbXTtcblx0XHRcdHNvdXJjZS5zZXQobWFya2VyLnNvdXJjZSwgc291cmNlTWF0Y2hlcyk7XG5cblx0XHRcdGlmIChtYXJrZXIuY29kZSkge1xuXHRcdFx0XHRpZiAodHlwZW9mIG1hcmtlci5jb2RlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNvbnN0IGNvZGUgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgSGlnaGxpZ2h0ZWRMYWJlbChkb20uYXBwZW5kKHBhcmVudCwgZG9tLiQoJy5tYXJrZXItY29kZScpKSkpO1xuXHRcdFx0XHRcdGNvbnN0IGNvZGVNYXRjaGVzID0gZmlsdGVyRGF0YSAmJiBmaWx0ZXJEYXRhLmNvZGVNYXRjaGVzIHx8IFtdO1xuXHRcdFx0XHRcdGNvZGUuc2V0KG1hcmtlci5jb2RlLCBjb2RlTWF0Y2hlcyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgY29udGFpbmVyID0gZG9tLiQoJy5tYXJrZXItY29kZScpO1xuXHRcdFx0XHRcdGNvbnN0IGNvZGUgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgSGlnaGxpZ2h0ZWRMYWJlbChjb250YWluZXIpKTtcblx0XHRcdFx0XHRjb25zdCBsaW5rID0gbWFya2VyLmNvZGUudGFyZ2V0LnRvU3RyaW5nKHRydWUpO1xuXHRcdFx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBMaW5rKHBhcmVudCwgeyBocmVmOiBsaW5rLCBsYWJlbDogY29udGFpbmVyLCB0aXRsZTogbGluayB9LCB1bmRlZmluZWQsIHRoaXMuX2hvdmVyU2VydmljZSwgdGhpcy5fb3BlbmVyU2VydmljZSkpO1xuXHRcdFx0XHRcdGNvbnN0IGNvZGVNYXRjaGVzID0gZmlsdGVyRGF0YSAmJiBmaWx0ZXJEYXRhLmNvZGVNYXRjaGVzIHx8IFtdO1xuXHRcdFx0XHRcdGNvZGUuc2V0KG1hcmtlci5jb2RlLnZhbHVlLCBjb2RlTWF0Y2hlcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBsbkNvbCA9IGRvbS5hcHBlbmQocGFyZW50LCBkb20uJCgnc3Bhbi5tYXJrZXItbGluZScpKTtcblx0XHRsbkNvbC50ZXh0Q29udGVudCA9IE1lc3NhZ2VzLk1BUktFUlNfUEFORUxfQVRfTElORV9DT0xfTlVNQkVSKG1hcmtlci5zdGFydExpbmVOdW1iZXIsIG1hcmtlci5zdGFydENvbHVtbik7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVsYXRlZEluZm9ybWF0aW9uUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFJlbGF0ZWRJbmZvcm1hdGlvbiwgUmVsYXRlZEluZm9ybWF0aW9uRmlsdGVyRGF0YSwgSVJlbGF0ZWRJbmZvcm1hdGlvblRlbXBsYXRlRGF0YT4ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlXG5cdCkgeyB9XG5cblx0dGVtcGxhdGVJZCA9IFRlbXBsYXRlSWQuUmVsYXRlZEluZm9ybWF0aW9uO1xuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJUmVsYXRlZEluZm9ybWF0aW9uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBkYXRhOiBJUmVsYXRlZEluZm9ybWF0aW9uVGVtcGxhdGVEYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRcdGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLmFjdGlvbnMnKSk7XG5cdFx0ZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcuaWNvbicpKTtcblxuXHRcdGRhdGEucmVzb3VyY2VMYWJlbCA9IG5ldyBIaWdobGlnaHRlZExhYmVsKGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLnJlbGF0ZWQtaW5mby1yZXNvdXJjZScpKSk7XG5cdFx0ZGF0YS5sbkNvbCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnc3Bhbi5tYXJrZXItbGluZScpKTtcblxuXHRcdGNvbnN0IHNlcGFyYXRvciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnc3Bhbi5yZWxhdGVkLWluZm8tcmVzb3VyY2Utc2VwYXJhdG9yJykpO1xuXHRcdHNlcGFyYXRvci50ZXh0Q29udGVudCA9ICc6Jztcblx0XHRzZXBhcmF0b3Iuc3R5bGUucGFkZGluZ1JpZ2h0ID0gJzRweCc7XG5cblx0XHRkYXRhLmRlc2NyaXB0aW9uID0gbmV3IEhpZ2hsaWdodGVkTGFiZWwoZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcubWFya2VyLWRlc2NyaXB0aW9uJykpKTtcblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPFJlbGF0ZWRJbmZvcm1hdGlvbiwgUmVsYXRlZEluZm9ybWF0aW9uRmlsdGVyRGF0YT4sIF86IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJUmVsYXRlZEluZm9ybWF0aW9uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVsYXRlZEluZm9ybWF0aW9uID0gbm9kZS5lbGVtZW50LnJhdztcblx0XHRjb25zdCB1cmlNYXRjaGVzID0gbm9kZS5maWx0ZXJEYXRhICYmIG5vZGUuZmlsdGVyRGF0YS51cmlNYXRjaGVzIHx8IFtdO1xuXHRcdGNvbnN0IG1lc3NhZ2VNYXRjaGVzID0gbm9kZS5maWx0ZXJEYXRhICYmIG5vZGUuZmlsdGVyRGF0YS5tZXNzYWdlTWF0Y2hlcyB8fCBbXTtcblxuXHRcdGNvbnN0IHJlc291cmNlTGFiZWxUaXRsZSA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHJlbGF0ZWRJbmZvcm1hdGlvbi5yZXNvdXJjZSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHR0ZW1wbGF0ZURhdGEucmVzb3VyY2VMYWJlbC5zZXQoYmFzZW5hbWUocmVsYXRlZEluZm9ybWF0aW9uLnJlc291cmNlKSwgdXJpTWF0Y2hlcywgcmVzb3VyY2VMYWJlbFRpdGxlKTtcblx0XHR0ZW1wbGF0ZURhdGEubG5Db2wudGV4dENvbnRlbnQgPSBNZXNzYWdlcy5NQVJLRVJTX1BBTkVMX0FUX0xJTkVfQ09MX05VTUJFUihyZWxhdGVkSW5mb3JtYXRpb24uc3RhcnRMaW5lTnVtYmVyLCByZWxhdGVkSW5mb3JtYXRpb24uc3RhcnRDb2x1bW4pO1xuXHRcdHRlbXBsYXRlRGF0YS5kZXNjcmlwdGlvbi5zZXQocmVsYXRlZEluZm9ybWF0aW9uLm1lc3NhZ2UsIG1lc3NhZ2VNYXRjaGVzLCByZWxhdGVkSW5mb3JtYXRpb24ubWVzc2FnZSk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJUmVsYXRlZEluZm9ybWF0aW9uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnJlc291cmNlTGFiZWwuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5kZXNjcmlwdGlvbi5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbHRlciBpbXBsZW1lbnRzIElUcmVlRmlsdGVyPE1hcmtlckVsZW1lbnQsIEZpbHRlckRhdGE+IHtcblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgb3B0aW9uczogRmlsdGVyT3B0aW9ucykgeyB9XG5cblx0ZmlsdGVyKGVsZW1lbnQ6IE1hcmtlckVsZW1lbnQsIHBhcmVudFZpc2liaWxpdHk6IFRyZWVWaXNpYmlsaXR5KTogVHJlZUZpbHRlclJlc3VsdDxGaWx0ZXJEYXRhPiB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZXNvdXJjZU1hcmtlcnMpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbHRlclJlc291cmNlTWFya2VycyhlbGVtZW50KTtcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBNYXJrZXIpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbHRlck1hcmtlcihlbGVtZW50LCBwYXJlbnRWaXNpYmlsaXR5KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmlsdGVyUmVsYXRlZEluZm9ybWF0aW9uKGVsZW1lbnQsIHBhcmVudFZpc2liaWxpdHkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZmlsdGVyUmVzb3VyY2VNYXJrZXJzKHJlc291cmNlTWFya2VyczogUmVzb3VyY2VNYXJrZXJzKTogVHJlZUZpbHRlclJlc3VsdDxGaWx0ZXJEYXRhPiB7XG5cdFx0aWYgKHVuc3VwcG9ydGVkU2NoZW1hcy5oYXMocmVzb3VyY2VNYXJrZXJzLnJlc291cmNlLnNjaGVtZSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBGaWx0ZXIgcmVzb3VyY2UgYnkgcGF0dGVybiBmaXJzdCAoZ2xvYnMpXG5cdFx0Ly8gRXhjbHVkZXMgcGF0dGVyblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuZXhjbHVkZXNNYXRjaGVyLm1hdGNoZXMocmVzb3VyY2VNYXJrZXJzLnJlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIEluY2x1ZGVzIHBhdHRlcm5cblx0XHRpZiAodGhpcy5vcHRpb25zLmluY2x1ZGVzTWF0Y2hlci5tYXRjaGVzKHJlc291cmNlTWFya2Vycy5yZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIEZpdGVyIGJ5IHRleHQuIERvIG5vdCBhcHBseSBuZWdhdGVkIGZpbHRlcnMgb24gcmVzb3VyY2VzIGluc3RlYWQgdXNlIGV4Y2x1ZGUgcGF0dGVybnNcblx0XHRpZiAodGhpcy5vcHRpb25zLnRleHRGaWx0ZXIudGV4dCAmJiAhdGhpcy5vcHRpb25zLnRleHRGaWx0ZXIubmVnYXRlKSB7XG5cdFx0XHRjb25zdCB1cmlNYXRjaGVzID0gRmlsdGVyT3B0aW9ucy5fZmlsdGVyKHRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLnRleHQsIGJhc2VuYW1lKHJlc291cmNlTWFya2Vycy5yZXNvdXJjZSkpO1xuXHRcdFx0aWYgKHVyaU1hdGNoZXMpIHtcblx0XHRcdFx0cmV0dXJuIHsgdmlzaWJpbGl0eTogdHJ1ZSwgZGF0YTogeyB0eXBlOiBGaWx0ZXJEYXRhVHlwZS5SZXNvdXJjZU1hcmtlcnMsIHVyaU1hdGNoZXM6IHVyaU1hdGNoZXMgfHwgW10gfSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBUcmVlVmlzaWJpbGl0eS5SZWN1cnNlO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXJNYXJrZXIobWFya2VyOiBNYXJrZXIsIHBhcmVudFZpc2liaWxpdHk6IFRyZWVWaXNpYmlsaXR5KTogVHJlZUZpbHRlclJlc3VsdDxGaWx0ZXJEYXRhPiB7XG5cblx0XHRjb25zdCBtYXRjaGVzU2V2ZXJpdHkgPSB0aGlzLm9wdGlvbnMuc2hvd0Vycm9ycyAmJiBNYXJrZXJTZXZlcml0eS5FcnJvciA9PT0gbWFya2VyLm1hcmtlci5zZXZlcml0eSB8fFxuXHRcdFx0dGhpcy5vcHRpb25zLnNob3dXYXJuaW5ncyAmJiBNYXJrZXJTZXZlcml0eS5XYXJuaW5nID09PSBtYXJrZXIubWFya2VyLnNldmVyaXR5IHx8XG5cdFx0XHR0aGlzLm9wdGlvbnMuc2hvd0luZm9zICYmIE1hcmtlclNldmVyaXR5LkluZm8gPT09IG1hcmtlci5tYXJrZXIuc2V2ZXJpdHk7XG5cblx0XHRpZiAoIW1hdGNoZXNTZXZlcml0eSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5vcHRpb25zLnRleHRGaWx0ZXIudGV4dCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZU1hdGNoZXM6IElNYXRjaFtdW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGxpbmUgb2YgbWFya2VyLmxpbmVzKSB7XG5cdFx0XHRjb25zdCBsaW5lTWF0Y2ggPSBGaWx0ZXJPcHRpb25zLl9tZXNzYWdlRmlsdGVyKHRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLnRleHQsIGxpbmUpO1xuXHRcdFx0bGluZU1hdGNoZXMucHVzaChsaW5lTWF0Y2ggfHwgW10pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNvdXJjZU1hdGNoZXMgPSBtYXJrZXIubWFya2VyLnNvdXJjZSA/IEZpbHRlck9wdGlvbnMuX2ZpbHRlcih0aGlzLm9wdGlvbnMudGV4dEZpbHRlci50ZXh0LCBtYXJrZXIubWFya2VyLnNvdXJjZSkgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgY29kZU1hdGNoZXMgPSBtYXJrZXIubWFya2VyLmNvZGUgPyBGaWx0ZXJPcHRpb25zLl9maWx0ZXIodGhpcy5vcHRpb25zLnRleHRGaWx0ZXIudGV4dCwgdHlwZW9mIG1hcmtlci5tYXJrZXIuY29kZSA9PT0gJ3N0cmluZycgPyBtYXJrZXIubWFya2VyLmNvZGUgOiBtYXJrZXIubWFya2VyLmNvZGUudmFsdWUpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1hdGNoZWQgPSBzb3VyY2VNYXRjaGVzIHx8IGNvZGVNYXRjaGVzIHx8IGxpbmVNYXRjaGVzLnNvbWUobGluZU1hdGNoID0+IGxpbmVNYXRjaC5sZW5ndGggPiAwKTtcblxuXHRcdC8vIE1hdGNoZWQgYW5kIG5vdCBuZWdhdGVkXG5cdFx0aWYgKG1hdGNoZWQgJiYgIXRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLm5lZ2F0ZSkge1xuXHRcdFx0cmV0dXJuIHsgdmlzaWJpbGl0eTogdHJ1ZSwgZGF0YTogeyB0eXBlOiBGaWx0ZXJEYXRhVHlwZS5NYXJrZXIsIGxpbmVNYXRjaGVzLCBzb3VyY2VNYXRjaGVzOiBzb3VyY2VNYXRjaGVzIHx8IFtdLCBjb2RlTWF0Y2hlczogY29kZU1hdGNoZXMgfHwgW10gfSB9O1xuXHRcdH1cblxuXHRcdC8vIE1hdGNoZWQgYW5kIG5lZ2F0ZWQgLSBleGNsdWRlIGl0IG9ubHkgaWYgcGFyZW50IHZpc2liaWxpdHkgaXMgbm90IHNldFxuXHRcdGlmIChtYXRjaGVkICYmIHRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLm5lZ2F0ZSAmJiBwYXJlbnRWaXNpYmlsaXR5ID09PSBUcmVlVmlzaWJpbGl0eS5SZWN1cnNlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gTm90IG1hdGNoZWQgYW5kIG5lZ2F0ZWQgLSBpbmNsdWRlIGl0IG9ubHkgaWYgcGFyZW50IHZpc2liaWxpdHkgaXMgbm90IHNldFxuXHRcdGlmICghbWF0Y2hlZCAmJiB0aGlzLm9wdGlvbnMudGV4dEZpbHRlci5uZWdhdGUgJiYgcGFyZW50VmlzaWJpbGl0eSA9PT0gVHJlZVZpc2liaWxpdHkuUmVjdXJzZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBhcmVudFZpc2liaWxpdHk7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlclJlbGF0ZWRJbmZvcm1hdGlvbihyZWxhdGVkSW5mb3JtYXRpb246IFJlbGF0ZWRJbmZvcm1hdGlvbiwgcGFyZW50VmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHkpOiBUcmVlRmlsdGVyUmVzdWx0PEZpbHRlckRhdGE+IHtcblx0XHRpZiAoIXRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLnRleHQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVyaU1hdGNoZXMgPSBGaWx0ZXJPcHRpb25zLl9maWx0ZXIodGhpcy5vcHRpb25zLnRleHRGaWx0ZXIudGV4dCwgYmFzZW5hbWUocmVsYXRlZEluZm9ybWF0aW9uLnJhdy5yZXNvdXJjZSkpO1xuXHRcdGNvbnN0IG1lc3NhZ2VNYXRjaGVzID0gRmlsdGVyT3B0aW9ucy5fbWVzc2FnZUZpbHRlcih0aGlzLm9wdGlvbnMudGV4dEZpbHRlci50ZXh0LCBwYXRocy5iYXNlbmFtZShyZWxhdGVkSW5mb3JtYXRpb24ucmF3Lm1lc3NhZ2UpKTtcblx0XHRjb25zdCBtYXRjaGVkID0gdXJpTWF0Y2hlcyB8fCBtZXNzYWdlTWF0Y2hlcztcblxuXHRcdC8vIE1hdGNoZWQgYW5kIG5vdCBuZWdhdGVkXG5cdFx0aWYgKG1hdGNoZWQgJiYgIXRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLm5lZ2F0ZSkge1xuXHRcdFx0cmV0dXJuIHsgdmlzaWJpbGl0eTogdHJ1ZSwgZGF0YTogeyB0eXBlOiBGaWx0ZXJEYXRhVHlwZS5SZWxhdGVkSW5mb3JtYXRpb24sIHVyaU1hdGNoZXM6IHVyaU1hdGNoZXMgfHwgW10sIG1lc3NhZ2VNYXRjaGVzOiBtZXNzYWdlTWF0Y2hlcyB8fCBbXSB9IH07XG5cdFx0fVxuXG5cdFx0Ly8gTWF0Y2hlZCBhbmQgbmVnYXRlZCAtIGV4Y2x1ZGUgaXQgb25seSBpZiBwYXJlbnQgdmlzaWJpbGl0eSBpcyBub3Qgc2V0XG5cdFx0aWYgKG1hdGNoZWQgJiYgdGhpcy5vcHRpb25zLnRleHRGaWx0ZXIubmVnYXRlICYmIHBhcmVudFZpc2liaWxpdHkgPT09IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBOb3QgbWF0Y2hlZCBhbmQgbmVnYXRlZCAtIGluY2x1ZGUgaXQgb25seSBpZiBwYXJlbnQgdmlzaWJpbGl0eSBpcyBub3Qgc2V0XG5cdFx0aWYgKCFtYXRjaGVkICYmIHRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLm5lZ2F0ZSAmJiBwYXJlbnRWaXNpYmlsaXR5ID09PSBUcmVlVmlzaWJpbGl0eS5SZWN1cnNlKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGFyZW50VmlzaWJpbGl0eTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWFya2VyVmlld01vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2U6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBtb2RlbFByb21pc2U6IENhbmNlbGFibGVQcm9taXNlPElUZXh0TW9kZWw+IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgY29kZUFjdGlvbnNQcm9taXNlOiBDYW5jZWxhYmxlUHJvbWlzZTxDb2RlQWN0aW9uU2V0PiB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbWFya2VyOiBNYXJrZXIsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLm1vZGVsUHJvbWlzZSkge1xuXHRcdFx0XHR0aGlzLm1vZGVsUHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmNvZGVBY3Rpb25zUHJvbWlzZSkge1xuXHRcdFx0XHR0aGlzLmNvZGVBY3Rpb25zUHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9tdWx0aWxpbmU6IGJvb2xlYW4gPSB0cnVlO1xuXHRnZXQgbXVsdGlsaW5lKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9tdWx0aWxpbmU7XG5cdH1cblxuXHRzZXQgbXVsdGlsaW5lKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuX211bHRpbGluZSAhPT0gdmFsdWUpIHtcblx0XHRcdHRoaXMuX211bHRpbGluZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3F1aWNrRml4QWN0aW9uOiBRdWlja0ZpeEFjdGlvbiB8IG51bGwgPSBudWxsO1xuXHRnZXQgcXVpY2tGaXhBY3Rpb24oKTogUXVpY2tGaXhBY3Rpb24ge1xuXHRcdGlmICghdGhpcy5fcXVpY2tGaXhBY3Rpb24pIHtcblx0XHRcdHRoaXMuX3F1aWNrRml4QWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWlja0ZpeEFjdGlvbiwgdGhpcy5tYXJrZXIpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3F1aWNrRml4QWN0aW9uO1xuXHR9XG5cblx0c2hvd0xpZ2h0QnVsYigpOiB2b2lkIHtcblx0XHR0aGlzLnNldFF1aWNrRml4ZXModHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNldFF1aWNrRml4ZXMod2FpdEZvck1vZGVsOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29kZUFjdGlvbnMgPSBhd2FpdCB0aGlzLmdldENvZGVBY3Rpb25zKHdhaXRGb3JNb2RlbCk7XG5cdFx0dGhpcy5xdWlja0ZpeEFjdGlvbi5xdWlja0ZpeGVzID0gY29kZUFjdGlvbnMgPyB0aGlzLnRvQWN0aW9ucyhjb2RlQWN0aW9ucykgOiBbXTtcblx0XHR0aGlzLnF1aWNrRml4QWN0aW9uLmF1dG9GaXhhYmxlKCEhY29kZUFjdGlvbnMgJiYgY29kZUFjdGlvbnMuaGFzQXV0b0ZpeCk7XG5cdH1cblxuXHRwcml2YXRlIGdldENvZGVBY3Rpb25zKHdhaXRGb3JNb2RlbDogYm9vbGVhbik6IFByb21pc2U8Q29kZUFjdGlvblNldCB8IG51bGw+IHtcblx0XHRpZiAodGhpcy5jb2RlQWN0aW9uc1Byb21pc2UgIT09IG51bGwpIHtcblx0XHRcdHJldHVybiB0aGlzLmNvZGVBY3Rpb25zUHJvbWlzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZ2V0TW9kZWwod2FpdEZvck1vZGVsKVxuXHRcdFx0LnRoZW48Q29kZUFjdGlvblNldCB8IG51bGw+KG1vZGVsID0+IHtcblx0XHRcdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLmNvZGVBY3Rpb25zUHJvbWlzZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5jb2RlQWN0aW9uc1Byb21pc2UgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShjYW5jZWxsYXRpb25Ub2tlbiA9PiB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBnZXRDb2RlQWN0aW9ucyh0aGlzLmxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvZGVBY3Rpb25Qcm92aWRlciwgbW9kZWwsIG5ldyBSYW5nZSh0aGlzLm1hcmtlci5yYW5nZS5zdGFydExpbmVOdW1iZXIsIHRoaXMubWFya2VyLnJhbmdlLnN0YXJ0Q29sdW1uLCB0aGlzLm1hcmtlci5yYW5nZS5lbmRMaW5lTnVtYmVyLCB0aGlzLm1hcmtlci5yYW5nZS5lbmRDb2x1bW4pLCB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogQ29kZUFjdGlvblRyaWdnZXJUeXBlLkludm9rZSwgdHJpZ2dlckFjdGlvbjogQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UuUHJvYmxlbXNWaWV3LCBmaWx0ZXI6IHsgaW5jbHVkZTogQ29kZUFjdGlvbktpbmQuUXVpY2tGaXggfVxuXHRcdFx0XHRcdFx0XHR9LCBQcm9ncmVzcy5Ob25lLCBjYW5jZWxsYXRpb25Ub2tlbikudGhlbihhY3Rpb25zID0+IHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcmVnaXN0ZXIoYWN0aW9ucyk7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNvZGVBY3Rpb25zUHJvbWlzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0FjdGlvbnMoY29kZUFjdGlvbnM6IENvZGVBY3Rpb25TZXQpOiBJQWN0aW9uW10ge1xuXHRcdHJldHVybiBjb2RlQWN0aW9ucy52YWxpZEFjdGlvbnMubWFwKGl0ZW0gPT4gdG9BY3Rpb24oe1xuXHRcdFx0aWQ6IGl0ZW0uYWN0aW9uLmNvbW1hbmQgPyBpdGVtLmFjdGlvbi5jb21tYW5kLmlkIDogaXRlbS5hY3Rpb24udGl0bGUsXG5cdFx0XHRsYWJlbDogaXRlbS5hY3Rpb24udGl0bGUsXG5cdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5vcGVuRmlsZUF0TWFya2VyKHRoaXMubWFya2VyKTtcblx0XHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYXBwbHlDb2RlQWN0aW9uLCBpdGVtLCBBcHBseUNvZGVBY3Rpb25SZWFzb24uRnJvbVByb2JsZW1zVmlldyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuRmlsZUF0TWFya2VyKGVsZW1lbnQ6IE1hcmtlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHsgcmVzb3VyY2UsIHNlbGVjdGlvbiB9ID0geyByZXNvdXJjZTogZWxlbWVudC5yZXNvdXJjZSwgc2VsZWN0aW9uOiBlbGVtZW50LnJhbmdlIH07XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRzZWxlY3Rpb24sXG5cdFx0XHRcdHByZXNlcnZlRm9jdXM6IHRydWUsXG5cdFx0XHRcdHBpbm5lZDogZmFsc2UsXG5cdFx0XHRcdHJldmVhbElmVmlzaWJsZTogdHJ1ZVxuXHRcdFx0fSxcblx0XHR9LCBBQ1RJVkVfR1JPVVApLnRoZW4oKCkgPT4gdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TW9kZWwod2FpdEZvck1vZGVsOiBib29sZWFuKTogUHJvbWlzZTxJVGV4dE1vZGVsIHwgbnVsbD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbFNlcnZpY2UuZ2V0TW9kZWwodGhpcy5tYXJrZXIucmVzb3VyY2UpO1xuXHRcdGlmIChtb2RlbCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShtb2RlbCk7XG5cdFx0fVxuXHRcdGlmICh3YWl0Rm9yTW9kZWwpIHtcblx0XHRcdGlmICghdGhpcy5tb2RlbFByb21pc2UpIHtcblx0XHRcdFx0dGhpcy5tb2RlbFByb21pc2UgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShjYW5jZWxsYXRpb25Ub2tlbiA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKChjKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsU2VydmljZS5vbk1vZGVsQWRkZWQobW9kZWwgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoaXNFcXVhbChtb2RlbC51cmksIHRoaXMubWFya2VyLnJlc291cmNlKSkge1xuXHRcdFx0XHRcdFx0XHRcdGMobW9kZWwpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMubW9kZWxQcm9taXNlO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIE1hcmtlcnNWaWV3TW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZTogRW1pdHRlcjxNYXJrZXIgfCB1bmRlZmluZWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8TWFya2VyIHwgdW5kZWZpbmVkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PE1hcmtlciB8IHVuZGVmaW5lZD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpZXdNb2RlOiBFbWl0dGVyPE1hcmtlcnNWaWV3TW9kZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxNYXJrZXJzVmlld01vZGU+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVZpZXdNb2RlOiBFdmVudDxNYXJrZXJzVmlld01vZGU+ID0gdGhpcy5fb25EaWRDaGFuZ2VWaWV3TW9kZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1hcmtlcnNWaWV3U3RhdGVzOiBNYXA8c3RyaW5nLCB7IHZpZXdNb2RlbDogTWFya2VyVmlld01vZGVsOyBkaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSB9PiA9IG5ldyBNYXA8c3RyaW5nLCB7IHZpZXdNb2RlbDogTWFya2VyVmlld01vZGVsOyBkaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSB9PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1hcmtlcnNQZXJSZXNvdXJjZTogTWFwPHN0cmluZywgTWFya2VyW10+ID0gbmV3IE1hcDxzdHJpbmcsIE1hcmtlcltdPigpO1xuXG5cdHByaXZhdGUgYnVsa1VwZGF0ZTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHByaXZhdGUgaG92ZXJlZE1hcmtlcjogTWFya2VyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgaG92ZXJEZWxheWVyOiBEZWxheWVyPHZvaWQ+ID0gbmV3IERlbGF5ZXI8dm9pZD4oMzAwKTtcblx0cHJpdmF0ZSB2aWV3TW9kZUNvbnRleHRLZXk6IElDb250ZXh0S2V5PE1hcmtlcnNWaWV3TW9kZT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bXVsdGlsaW5lOiBib29sZWFuID0gdHJ1ZSxcblx0XHR2aWV3TW9kZTogTWFya2Vyc1ZpZXdNb2RlID0gTWFya2Vyc1ZpZXdNb2RlLlRyZWUsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9tdWx0aWxpbmUgPSBtdWx0aWxpbmU7XG5cdFx0dGhpcy5fdmlld01vZGUgPSB2aWV3TW9kZTtcblxuXHRcdHRoaXMudmlld01vZGVDb250ZXh0S2V5ID0gTWFya2Vyc0NvbnRleHRLZXlzLk1hcmtlcnNWaWV3TW9kZUNvbnRleHRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudmlld01vZGVDb250ZXh0S2V5LnNldCh2aWV3TW9kZSk7XG5cdH1cblxuXHRhZGQobWFya2VyOiBNYXJrZXIpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubWFya2Vyc1ZpZXdTdGF0ZXMuaGFzKG1hcmtlci5pZCkpIHtcblx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya2VyVmlld01vZGVsLCBtYXJrZXIpO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbdmlld01vZGVsXTtcblx0XHRcdHZpZXdNb2RlbC5tdWx0aWxpbmUgPSB0aGlzLm11bHRpbGluZTtcblx0XHRcdHZpZXdNb2RlbC5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5idWxrVXBkYXRlKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShtYXJrZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR0aGlzLm1hcmtlcnNWaWV3U3RhdGVzLnNldChtYXJrZXIuaWQsIHsgdmlld01vZGVsLCBkaXNwb3NhYmxlcyB9KTtcblxuXHRcdFx0Y29uc3QgbWFya2VycyA9IHRoaXMubWFya2Vyc1BlclJlc291cmNlLmdldChtYXJrZXIucmVzb3VyY2UudG9TdHJpbmcoKSkgfHwgW107XG5cdFx0XHRtYXJrZXJzLnB1c2gobWFya2VyKTtcblx0XHRcdHRoaXMubWFya2Vyc1BlclJlc291cmNlLnNldChtYXJrZXIucmVzb3VyY2UudG9TdHJpbmcoKSwgbWFya2Vycyk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlKHJlc291cmNlOiBVUkkpOiB2b2lkIHtcblx0XHRjb25zdCBtYXJrZXJzID0gdGhpcy5tYXJrZXJzUGVyUmVzb3VyY2UuZ2V0KHJlc291cmNlLnRvU3RyaW5nKCkpIHx8IFtdO1xuXHRcdGZvciAoY29uc3QgbWFya2VyIG9mIG1hcmtlcnMpIHtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5tYXJrZXJzVmlld1N0YXRlcy5nZXQobWFya2VyLmlkKTtcblx0XHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0XHRkaXNwb3NlKHZhbHVlLmRpc3Bvc2FibGVzKTtcblx0XHRcdH1cblx0XHRcdHRoaXMubWFya2Vyc1ZpZXdTdGF0ZXMuZGVsZXRlKG1hcmtlci5pZCk7XG5cdFx0XHRpZiAodGhpcy5ob3ZlcmVkTWFya2VyID09PSBtYXJrZXIpIHtcblx0XHRcdFx0dGhpcy5ob3ZlcmVkTWFya2VyID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5tYXJrZXJzUGVyUmVzb3VyY2UuZGVsZXRlKHJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHR9XG5cblx0Z2V0Vmlld01vZGVsKG1hcmtlcjogTWFya2VyKTogTWFya2VyVmlld01vZGVsIHwgbnVsbCB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLm1hcmtlcnNWaWV3U3RhdGVzLmdldChtYXJrZXIuaWQpO1xuXHRcdHJldHVybiB2YWx1ZSA/IHZhbHVlLnZpZXdNb2RlbCA6IG51bGw7XG5cdH1cblxuXHRvbk1hcmtlck1vdXNlSG92ZXIobWFya2VyOiBNYXJrZXIpOiB2b2lkIHtcblx0XHR0aGlzLmhvdmVyZWRNYXJrZXIgPSBtYXJrZXI7XG5cdFx0dGhpcy5ob3ZlckRlbGF5ZXIudHJpZ2dlcigoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5ob3ZlcmVkTWFya2VyKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5nZXRWaWV3TW9kZWwodGhpcy5ob3ZlcmVkTWFya2VyKTtcblx0XHRcdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRcdFx0bW9kZWwuc2hvd0xpZ2h0QnVsYigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvbk1hcmtlck1vdXNlTGVhdmUobWFya2VyOiBNYXJrZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5ob3ZlcmVkTWFya2VyID09PSBtYXJrZXIpIHtcblx0XHRcdHRoaXMuaG92ZXJlZE1hcmtlciA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfbXVsdGlsaW5lOiBib29sZWFuID0gdHJ1ZTtcblx0Z2V0IG11bHRpbGluZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fbXVsdGlsaW5lO1xuXHR9XG5cblx0c2V0IG11bHRpbGluZSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdGxldCBjaGFuZ2VkID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuX211bHRpbGluZSAhPT0gdmFsdWUpIHtcblx0XHRcdHRoaXMuX211bHRpbGluZSA9IHZhbHVlO1xuXHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0fVxuXHRcdHRoaXMuYnVsa1VwZGF0ZSA9IHRydWU7XG5cdFx0dGhpcy5tYXJrZXJzVmlld1N0YXRlcy5mb3JFYWNoKCh7IHZpZXdNb2RlbCB9KSA9PiB7XG5cdFx0XHRpZiAodmlld01vZGVsLm11bHRpbGluZSAhPT0gdmFsdWUpIHtcblx0XHRcdFx0dmlld01vZGVsLm11bHRpbGluZSA9IHZhbHVlO1xuXHRcdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLmJ1bGtVcGRhdGUgPSBmYWxzZTtcblx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3ZpZXdNb2RlOiBNYXJrZXJzVmlld01vZGUgPSBNYXJrZXJzVmlld01vZGUuVHJlZTtcblx0Z2V0IHZpZXdNb2RlKCk6IE1hcmtlcnNWaWV3TW9kZSB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZpZXdNb2RlO1xuXHR9XG5cblx0c2V0IHZpZXdNb2RlKHZhbHVlOiBNYXJrZXJzVmlld01vZGUpIHtcblx0XHRpZiAodGhpcy5fdmlld01vZGUgPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fdmlld01vZGUgPSB2YWx1ZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVZpZXdNb2RlLmZpcmUodmFsdWUpO1xuXHRcdHRoaXMudmlld01vZGVDb250ZXh0S2V5LnNldCh2YWx1ZSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMubWFya2Vyc1ZpZXdTdGF0ZXMuZm9yRWFjaCgoeyBkaXNwb3NhYmxlcyB9KSA9PiBkaXNwb3NlKGRpc3Bvc2FibGVzKSk7XG5cdFx0dGhpcy5tYXJrZXJzVmlld1N0YXRlcy5jbGVhcigpO1xuXHRcdHRoaXMubWFya2Vyc1BlclJlc291cmNlLmNsZWFyKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksV0FBVztBQUN2QixTQUFTLGtCQUFrQjtBQUUzQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFrQixzQkFBc0I7QUFDeEMsU0FBUyxpQkFBaUIsUUFBUSxvQkFBbUMsdUJBQXVCO0FBQzVGLE9BQU8sY0FBYztBQUNyQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFzQixTQUFTLFlBQVksY0FBYyx1QkFBdUI7QUFDaEYsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQkFBZ0IsOEJBQThCO0FBQ3ZELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsVUFBVSxlQUFlO0FBRWxDLFNBQXNCLHNCQUFrRTtBQUN4RixTQUFTLHFCQUFxQjtBQUU5QixTQUFnQixlQUFlO0FBRS9CLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsUUFBaUIsZ0JBQWdCO0FBQzFDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQTRCLHlCQUF5QixlQUFlO0FBQ3BFLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQix1QkFBdUIsc0JBQXNCO0FBQ3ZFLFNBQVMsZ0JBQStCLCtCQUErQjtBQUV2RSxTQUFTLGdCQUFnQixvQkFBb0I7QUFDN0MsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsb0JB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
