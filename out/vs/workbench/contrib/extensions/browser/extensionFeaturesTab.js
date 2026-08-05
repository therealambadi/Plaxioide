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
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { $, append, clearNode } from "../../../../base/browser/dom.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { Orientation, Sizing, SplitView } from "../../../../base/browser/ui/splitview/splitview.js";
import { Extensions, IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { localize } from "../../../../nls.js";
import { WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { getExtensionId } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { defaultButtonStyles, defaultKeybindingLabelStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { renderMarkdown } from "../../../../base/browser/markdownRenderer.js";
import { getErrorMessage, onUnexpectedError } from "../../../../base/common/errors.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { PANEL_SECTION_BORDER } from "../../../common/theme.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import Severity from "../../../../base/common/severity.js";
import { errorIcon, infoIcon, warningIcon } from "./extensionsIcons.js";
import { SeverityIcon } from "../../../../base/browser/ui/severityIcon/severityIcon.js";
import { KeybindingLabel } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { OS } from "../../../../base/common/platform.js";
import { MarkdownString, isMarkdownString } from "../../../../base/common/htmlContent.js";
import { Color } from "../../../../base/common/color.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ResolvedKeybinding } from "../../../../base/common/keybindings.js";
import { asCssVariable } from "../../../../platform/theme/common/colorUtils.js";
import { foreground, chartAxis, chartGuide, chartLine } from "../../../../platform/theme/common/colorRegistry.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let RuntimeStatusMarkdownRenderer = class extends Disposable {
  constructor(extensionService, openerService, hoverService, extensionFeaturesManagementService) {
    super();
    this.extensionService = extensionService;
    this.openerService = openerService;
    this.hoverService = hoverService;
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    this.type = "element";
  }
  shouldRender(manifest) {
    const extensionId = new ExtensionIdentifier(getExtensionId(manifest.publisher, manifest.name));
    if (!this.extensionService.extensions.some((e) => ExtensionIdentifier.equals(e.identifier, extensionId))) {
      return false;
    }
    return !!manifest.main || !!manifest.browser;
  }
  render(manifest) {
    const disposables = new DisposableStore();
    const extensionId = new ExtensionIdentifier(getExtensionId(manifest.publisher, manifest.name));
    const emitter = disposables.add(new Emitter());
    disposables.add(this.extensionService.onDidChangeExtensionsStatus((e) => {
      if (e.some((extension) => ExtensionIdentifier.equals(extension, extensionId))) {
        emitter.fire(this.createElement(manifest, disposables));
      }
    }));
    disposables.add(this.extensionFeaturesManagementService.onDidChangeAccessData((e) => emitter.fire(this.createElement(manifest, disposables))));
    return {
      onDidChange: emitter.event,
      data: this.createElement(manifest, disposables),
      dispose: () => disposables.dispose()
    };
  }
  createElement(manifest, disposables) {
    const container = $(".runtime-status");
    const extensionId = new ExtensionIdentifier(getExtensionId(manifest.publisher, manifest.name));
    const status = this.extensionService.getExtensionsStatus()[extensionId.value];
    if (this.extensionService.extensions.some((extension) => ExtensionIdentifier.equals(extension.identifier, extensionId))) {
      const data = new MarkdownString();
      data.appendMarkdown(`### ${localize("activation", "Activation")}

`);
      if (status.activationTimes) {
        if (status.activationTimes.activationReason.startup) {
          data.appendMarkdown(`Activated on Startup: \`${status.activationTimes.activateCallTime}ms\``);
        } else {
          data.appendMarkdown(`Activated by \`${status.activationTimes.activationReason.activationEvent}\` event: \`${status.activationTimes.activateCallTime}ms\``);
        }
      } else {
        data.appendMarkdown("Not yet activated");
      }
      this.renderMarkdown(data, container, disposables);
    }
    const features = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeatures();
    for (const feature of features) {
      const accessData = this.extensionFeaturesManagementService.getAccessData(extensionId, feature.id);
      if (accessData) {
        this.renderMarkdown(new MarkdownString(`
 ### ${localize("label", "{0} Usage", feature.label)}

`), container, disposables);
        if (accessData.accessTimes.length) {
          const description = append(
            container,
            $(
              ".feature-chart-description",
              void 0,
              localize("chartDescription", "There were {0} {1} requests from this extension in the last 30 days.", accessData?.accessTimes.length, feature.accessDataLabel ?? feature.label)
            )
          );
          description.style.marginBottom = "8px";
          this.renderRequestsChart(container, accessData.accessTimes, disposables);
        }
        const status2 = accessData?.current?.status;
        if (status2) {
          const data = new MarkdownString();
          if (status2?.severity === Severity.Error) {
            data.appendMarkdown(`$(${errorIcon.id}) ${status2.message}

`);
          }
          if (status2?.severity === Severity.Warning) {
            data.appendMarkdown(`$(${warningIcon.id}) ${status2.message}

`);
          }
          if (data.value) {
            this.renderMarkdown(data, container, disposables);
          }
        }
      }
    }
    if (status.runtimeErrors.length || status.messages.length) {
      const data = new MarkdownString();
      if (status.runtimeErrors.length) {
        data.appendMarkdown(`
 ### ${localize("uncaught errors", "Uncaught Errors ({0})", status.runtimeErrors.length)}
`);
        for (const error of status.runtimeErrors) {
          data.appendMarkdown(`$(${Codicon.error.id})&nbsp;${getErrorMessage(error)}

`);
        }
      }
      if (status.messages.length) {
        data.appendMarkdown(`
 ### ${localize("messaages", "Messages ({0})", status.messages.length)}
`);
        for (const message of status.messages) {
          data.appendMarkdown(`$(${(message.type === Severity.Error ? Codicon.error : message.type === Severity.Warning ? Codicon.warning : Codicon.info).id})&nbsp;${message.message}

`);
        }
      }
      if (data.value) {
        this.renderMarkdown(data, container, disposables);
      }
    }
    return container;
  }
  renderMarkdown(markdown, container, disposables) {
    const { element, dispose } = renderMarkdown(
      {
        value: markdown.value,
        isTrusted: markdown.isTrusted,
        supportThemeIcons: true
      },
      {
        actionHandler: {
          callback: (content) => this.openerService.open(content, { allowCommands: !!markdown.isTrusted }).catch(onUnexpectedError),
          disposables
        }
      }
    );
    disposables.add(toDisposable(dispose));
    append(container, element);
  }
  renderRequestsChart(container, accessTimes, disposables) {
    const width = 450;
    const height = 250;
    const margin = { top: 0, right: 4, bottom: 20, left: 4 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const chartContainer = append(container, $(".feature-chart-container"));
    chartContainer.style.position = "relative";
    const tooltip = append(chartContainer, $(".feature-chart-tooltip"));
    tooltip.style.position = "absolute";
    tooltip.style.width = "0px";
    tooltip.style.height = "0px";
    let maxCount = 100;
    const map = /* @__PURE__ */ new Map();
    for (const accessTime of accessTimes) {
      const day = `${accessTime.getDate()} ${accessTime.toLocaleString("default", { month: "short" })}`;
      map.set(day, (map.get(day) ?? 0) + 1);
      maxCount = Math.max(maxCount, map.get(day));
    }
    const now = /* @__PURE__ */ new Date();
    const points = [];
    for (let i = 0; i <= 30; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - (30 - i));
      const dateString = `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`;
      const count = map.get(dateString) ?? 0;
      const x = i / 30 * innerWidth;
      const y = innerHeight - count / maxCount * innerHeight;
      points.push({ x, y, date: dateString, count });
    }
    const chart = append(chartContainer, $(".feature-chart"));
    const svg = append(chart, $.SVG("svg"));
    svg.setAttribute("width", `${width}px`);
    svg.setAttribute("height", `${height}px`);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const g = $.SVG("g");
    g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
    svg.appendChild(g);
    const xAxisLine = $.SVG("line");
    xAxisLine.setAttribute("x1", "0");
    xAxisLine.setAttribute("y1", `${innerHeight}`);
    xAxisLine.setAttribute("x2", `${innerWidth}`);
    xAxisLine.setAttribute("y2", `${innerHeight}`);
    xAxisLine.setAttribute("stroke", asCssVariable(chartAxis));
    xAxisLine.setAttribute("stroke-width", "1px");
    g.appendChild(xAxisLine);
    for (let i = 1; i <= 30; i += 7) {
      const date = new Date(now);
      date.setDate(now.getDate() - (30 - i));
      const dateString = `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`;
      const x = i / 30 * innerWidth;
      const tick = $.SVG("line");
      tick.setAttribute("x1", `${x}`);
      tick.setAttribute("y1", `${innerHeight}`);
      tick.setAttribute("x2", `${x}`);
      tick.setAttribute("y2", `${innerHeight + 10}`);
      tick.setAttribute("stroke", asCssVariable(chartAxis));
      tick.setAttribute("stroke-width", "1px");
      g.appendChild(tick);
      const ruler = $.SVG("line");
      ruler.setAttribute("x1", `${x}`);
      ruler.setAttribute("y1", `0`);
      ruler.setAttribute("x2", `${x}`);
      ruler.setAttribute("y2", `${innerHeight}`);
      ruler.setAttribute("stroke", asCssVariable(chartGuide));
      ruler.setAttribute("stroke-width", "1px");
      g.appendChild(ruler);
      const xAxisDate = $.SVG("text");
      xAxisDate.setAttribute("x", `${x}`);
      xAxisDate.setAttribute("y", `${height}`);
      xAxisDate.setAttribute("text-anchor", "middle");
      xAxisDate.setAttribute("fill", asCssVariable(foreground));
      xAxisDate.setAttribute("font-size", "10px");
      xAxisDate.textContent = dateString;
      g.appendChild(xAxisDate);
    }
    const line = $.SVG("polyline");
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", asCssVariable(chartLine));
    line.setAttribute("stroke-width", `2px`);
    line.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
    g.appendChild(line);
    const highlightCircle = $.SVG("circle");
    highlightCircle.setAttribute("r", `4px`);
    highlightCircle.style.display = "none";
    g.appendChild(highlightCircle);
    const hoverDisposable = disposables.add(new MutableDisposable());
    const mouseMoveListener = (event) => {
      const rect = svg.getBoundingClientRect();
      const mouseX = event.clientX - rect.left - margin.left;
      let closestPoint;
      let minDistance = Infinity;
      points.forEach((point) => {
        const distance = Math.abs(point.x - mouseX);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
        }
      });
      if (closestPoint) {
        highlightCircle.setAttribute("cx", `${closestPoint.x}`);
        highlightCircle.setAttribute("cy", `${closestPoint.y}`);
        highlightCircle.style.display = "block";
        tooltip.style.left = `${closestPoint.x + 24}px`;
        tooltip.style.top = `${closestPoint.y + 14}px`;
        hoverDisposable.value = this.hoverService.showInstantHover({
          content: new MarkdownString(`${closestPoint.date}: ${closestPoint.count} requests`),
          target: tooltip,
          appearance: {
            showPointer: true,
            skipFadeInAnimation: true
          }
        });
      } else {
        hoverDisposable.value = void 0;
      }
    };
    svg.addEventListener("mousemove", mouseMoveListener);
    disposables.add(toDisposable(() => svg.removeEventListener("mousemove", mouseMoveListener)));
    const mouseLeaveListener = () => {
      highlightCircle.style.display = "none";
      hoverDisposable.value = void 0;
    };
    svg.addEventListener("mouseleave", mouseLeaveListener);
    disposables.add(toDisposable(() => svg.removeEventListener("mouseleave", mouseLeaveListener)));
  }
};
RuntimeStatusMarkdownRenderer.ID = "runtimeStatus";
RuntimeStatusMarkdownRenderer = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IOpenerService),
  __decorateParam(2, IHoverService),
  __decorateParam(3, IExtensionFeaturesManagementService)
], RuntimeStatusMarkdownRenderer);
const runtimeStatusFeature = {
  id: RuntimeStatusMarkdownRenderer.ID,
  label: localize("runtime", "Runtime Status"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(RuntimeStatusMarkdownRenderer)
};
let ExtensionFeaturesTab = class extends Themable {
  constructor(manifest, feature, themeService, instantiationService) {
    super(themeService);
    this.manifest = manifest;
    this.feature = feature;
    this.instantiationService = instantiationService;
    this.featureView = this._register(new MutableDisposable());
    this.layoutParticipants = [];
    this.extensionId = new ExtensionIdentifier(getExtensionId(manifest.publisher, manifest.name));
    this.domNode = $("div.subcontent.feature-contributions");
    this.create();
  }
  layout(height, width) {
    this.layoutParticipants.forEach((participant) => participant.layout(height, width));
  }
  create() {
    const features = this.getFeatures();
    if (features.length === 0) {
      append($(".no-features"), this.domNode).textContent = localize("noFeatures", "No features contributed.");
      return;
    }
    const splitView = this._register(new SplitView(this.domNode, {
      orientation: Orientation.HORIZONTAL,
      proportionalLayout: true
    }));
    this.layoutParticipants.push({
      layout: (height, width) => {
        splitView.el.style.height = `${height - 14}px`;
        splitView.layout(width);
      }
    });
    const featuresListContainer = $(".features-list-container");
    const list = this._register(this.createFeaturesList(featuresListContainer));
    list.splice(0, list.length, features);
    const featureViewContainer = $(".feature-view-container");
    this._register(list.onDidChangeSelection((e) => {
      const feature = e.elements[0];
      if (feature) {
        this.showFeatureView(feature, featureViewContainer);
      }
    }));
    const index = this.feature ? features.findIndex((f) => f.id === this.feature) : 0;
    list.setSelection([index === -1 ? 0 : index]);
    splitView.addView({
      onDidChange: Event.None,
      element: featuresListContainer,
      minimumSize: 100,
      maximumSize: Number.POSITIVE_INFINITY,
      layout: (width, _, height) => {
        featuresListContainer.style.width = `${width}px`;
        list.layout(height, width);
      }
    }, 200, void 0, true);
    splitView.addView({
      onDidChange: Event.None,
      element: featureViewContainer,
      minimumSize: 500,
      maximumSize: Number.POSITIVE_INFINITY,
      layout: (width, _, height) => {
        featureViewContainer.style.width = `${width}px`;
        this.featureViewDimension = { height, width };
        this.layoutFeatureView();
      }
    }, Sizing.Distribute, void 0, true);
    splitView.style({
      separatorBorder: this.theme.getColor(PANEL_SECTION_BORDER)
    });
  }
  createFeaturesList(container) {
    const renderer = this.instantiationService.createInstance(ExtensionFeatureItemRenderer, this.extensionId);
    const delegate = new ExtensionFeatureItemDelegate();
    const list = this.instantiationService.createInstance(WorkbenchList, "ExtensionFeaturesList", append(container, $(".features-list-wrapper")), delegate, [renderer], {
      multipleSelectionSupport: false,
      setRowLineHeight: false,
      horizontalScrolling: false,
      accessibilityProvider: {
        getAriaLabel(extensionFeature) {
          return extensionFeature?.label ?? "";
        },
        getWidgetAriaLabel() {
          return localize("extension features list", "Extension Features");
        }
      },
      openOnSingleClick: true
    });
    return list;
  }
  layoutFeatureView() {
    this.featureView.value?.layout(this.featureViewDimension?.height, this.featureViewDimension?.width);
  }
  showFeatureView(feature, container) {
    if (this.featureView.value?.feature.id === feature.id) {
      return;
    }
    clearNode(container);
    this.featureView.value = this.instantiationService.createInstance(ExtensionFeatureView, this.extensionId, this.manifest, feature);
    container.appendChild(this.featureView.value.domNode);
    this.layoutFeatureView();
  }
  getFeatures() {
    const features = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeatures().filter((feature) => {
      const renderer2 = this.getRenderer(feature);
      const shouldRender = renderer2?.shouldRender(this.manifest);
      renderer2?.dispose();
      return shouldRender;
    }).sort((a, b) => a.label.localeCompare(b.label));
    const renderer = this.getRenderer(runtimeStatusFeature);
    if (renderer?.shouldRender(this.manifest)) {
      features.splice(0, 0, runtimeStatusFeature);
    }
    renderer?.dispose();
    return features;
  }
  getRenderer(feature) {
    return feature.renderer ? this.instantiationService.createInstance(feature.renderer) : void 0;
  }
};
ExtensionFeaturesTab = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IInstantiationService)
], ExtensionFeaturesTab);
class ExtensionFeatureItemDelegate {
  getHeight() {
    return 22;
  }
  getTemplateId() {
    return "extensionFeatureDescriptor";
  }
}
let ExtensionFeatureItemRenderer = class {
  constructor(extensionId, extensionFeaturesManagementService) {
    this.extensionId = extensionId;
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    this.templateId = "extensionFeatureDescriptor";
  }
  renderTemplate(container) {
    container.classList.add("extension-feature-list-item");
    const label = append(container, $(".extension-feature-label"));
    const disabledElement = append(container, $(".extension-feature-disabled-label"));
    disabledElement.textContent = localize("revoked", "No Access");
    const statusElement = append(container, $(".extension-feature-status"));
    return { label, disabledElement, statusElement, disposables: new DisposableStore() };
  }
  renderElement(element, index, templateData) {
    templateData.disposables.clear();
    templateData.label.textContent = element.label;
    templateData.disabledElement.style.display = element.id === runtimeStatusFeature.id || this.extensionFeaturesManagementService.isEnabled(this.extensionId, element.id) ? "none" : "inherit";
    templateData.disposables.add(this.extensionFeaturesManagementService.onDidChangeEnablement(({ extension, featureId, enabled }) => {
      if (ExtensionIdentifier.equals(extension, this.extensionId) && featureId === element.id) {
        templateData.disabledElement.style.display = enabled ? "none" : "inherit";
      }
    }));
    const statusElementClassName = templateData.statusElement.className;
    const updateStatus = () => {
      const accessData = this.extensionFeaturesManagementService.getAccessData(this.extensionId, element.id);
      if (accessData?.current?.status) {
        templateData.statusElement.style.display = "inherit";
        templateData.statusElement.className = `${statusElementClassName} ${SeverityIcon.className(accessData.current.status.severity)}`;
      } else {
        templateData.statusElement.style.display = "none";
      }
    };
    updateStatus();
    templateData.disposables.add(this.extensionFeaturesManagementService.onDidChangeAccessData(({ extension, featureId }) => {
      if (ExtensionIdentifier.equals(extension, this.extensionId) && featureId === element.id) {
        updateStatus();
      }
    }));
  }
  disposeElement(element, index, templateData, height) {
    templateData.disposables.dispose();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
ExtensionFeatureItemRenderer = __decorateClass([
  __decorateParam(1, IExtensionFeaturesManagementService)
], ExtensionFeatureItemRenderer);
let ExtensionFeatureView = class extends Disposable {
  constructor(extensionId, manifest, feature, openerService, instantiationService, extensionFeaturesManagementService, dialogService) {
    super();
    this.extensionId = extensionId;
    this.manifest = manifest;
    this.feature = feature;
    this.openerService = openerService;
    this.instantiationService = instantiationService;
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    this.dialogService = dialogService;
    this.layoutParticipants = [];
    this.domNode = $(".extension-feature-content");
    this.create(this.domNode);
  }
  create(content) {
    const header = append(content, $(".feature-header"));
    const title = append(header, $(".feature-title"));
    title.textContent = this.feature.label;
    if (this.feature.access.canToggle) {
      const actionsContainer = append(header, $(".feature-actions"));
      const button = new Button(actionsContainer, defaultButtonStyles);
      this.updateButtonLabel(button);
      this._register(this.extensionFeaturesManagementService.onDidChangeEnablement(({ extension, featureId }) => {
        if (ExtensionIdentifier.equals(extension, this.extensionId) && featureId === this.feature.id) {
          this.updateButtonLabel(button);
        }
      }));
      this._register(button.onDidClick(async () => {
        const enabled = this.extensionFeaturesManagementService.isEnabled(this.extensionId, this.feature.id);
        const confirmationResult = await this.dialogService.confirm({
          title: localize("accessExtensionFeature", "Enable '{0}' Feature", this.feature.label),
          message: enabled ? localize("disableAccessExtensionFeatureMessage", "Would you like to revoke '{0}' extension to access '{1}' feature?", this.manifest.displayName ?? this.extensionId.value, this.feature.label) : localize("enableAccessExtensionFeatureMessage", "Would you like to allow '{0}' extension to access '{1}' feature?", this.manifest.displayName ?? this.extensionId.value, this.feature.label),
          custom: true,
          primaryButton: enabled ? localize("revoke", "Revoke Access") : localize("grant", "Allow Access"),
          cancelButton: localize("cancel", "Cancel")
        });
        if (confirmationResult.confirmed) {
          this.extensionFeaturesManagementService.setEnablement(this.extensionId, this.feature.id, !enabled);
        }
      }));
    }
    const body = append(content, $(".feature-body"));
    const bodyContent = $(".feature-body-content");
    const scrollableContent = this._register(new DomScrollableElement(bodyContent, {}));
    append(body, scrollableContent.getDomNode());
    this.layoutParticipants.push({ layout: () => scrollableContent.scanDomNode() });
    scrollableContent.scanDomNode();
    if (this.feature.description) {
      const description = append(bodyContent, $(".feature-description"));
      description.textContent = this.feature.description;
    }
    const accessData = this.extensionFeaturesManagementService.getAccessData(this.extensionId, this.feature.id);
    if (accessData?.current?.status) {
      append(bodyContent, $(
        ".feature-status",
        void 0,
        $(`span${ThemeIcon.asCSSSelector(accessData.current.status.severity === Severity.Error ? errorIcon : accessData.current.status.severity === Severity.Warning ? warningIcon : infoIcon)}`, void 0),
        $("span", void 0, accessData.current.status.message)
      ));
    }
    const featureContentElement = append(bodyContent, $(".feature-content"));
    if (this.feature.renderer) {
      const renderer = this.instantiationService.createInstance(this.feature.renderer);
      if (renderer.type === "table") {
        this.renderTableData(featureContentElement, renderer);
      } else if (renderer.type === "markdown") {
        this.renderMarkdownData(featureContentElement, renderer);
      } else if (renderer.type === "markdown+table") {
        this.renderMarkdownAndTableData(featureContentElement, renderer);
      } else if (renderer.type === "element") {
        this.renderElementData(featureContentElement, renderer);
      }
    }
  }
  updateButtonLabel(button) {
    button.label = this.extensionFeaturesManagementService.isEnabled(this.extensionId, this.feature.id) ? localize("revoke", "Revoke Access") : localize("enable", "Allow Access");
  }
  renderTableData(container, renderer) {
    const tableData = this._register(renderer.render(this.manifest));
    const tableDisposable = this._register(new MutableDisposable());
    if (tableData.onDidChange) {
      this._register(tableData.onDidChange((data) => {
        clearNode(container);
        tableDisposable.value = this.renderTable(data, container);
      }));
    }
    tableDisposable.value = this.renderTable(tableData.data, container);
  }
  renderTable(tableData, container) {
    const disposables = new DisposableStore();
    append(
      container,
      $(
        "table",
        void 0,
        $(
          "tr",
          void 0,
          ...tableData.headers.map((header) => $("th", void 0, header))
        ),
        ...tableData.rows.map((row) => {
          return $(
            "tr",
            void 0,
            ...row.map((rowData) => {
              if (typeof rowData === "string") {
                return $("td", void 0, $("p", void 0, rowData));
              }
              const data = Array.isArray(rowData) ? rowData : [rowData];
              return $("td", void 0, ...data.map((item) => {
                const result = [];
                if (isMarkdownString(rowData)) {
                  const element = $("", void 0);
                  this.renderMarkdown(rowData, element);
                  result.push(element);
                } else if (item instanceof ResolvedKeybinding) {
                  const element = $("");
                  const kbl = disposables.add(new KeybindingLabel(element, OS, defaultKeybindingLabelStyles));
                  kbl.set(item);
                  result.push(element);
                } else if (item instanceof Color) {
                  result.push($("span", { class: "colorBox", style: "background-color: " + Color.Format.CSS.format(item) }, ""));
                  result.push($("code", void 0, Color.Format.CSS.formatHex(item)));
                }
                return result;
              }).flat());
            })
          );
        })
      )
    );
    return disposables;
  }
  renderMarkdownAndTableData(container, renderer) {
    const markdownAndTableData = this._register(renderer.render(this.manifest));
    if (markdownAndTableData.onDidChange) {
      this._register(markdownAndTableData.onDidChange((data) => {
        clearNode(container);
        this.renderMarkdownAndTable(data, container);
      }));
    }
    this.renderMarkdownAndTable(markdownAndTableData.data, container);
  }
  renderMarkdownData(container, renderer) {
    container.classList.add("markdown");
    const markdownData = this._register(renderer.render(this.manifest));
    if (markdownData.onDidChange) {
      this._register(markdownData.onDidChange((data) => {
        clearNode(container);
        this.renderMarkdown(data, container);
      }));
    }
    this.renderMarkdown(markdownData.data, container);
  }
  renderMarkdown(markdown, container) {
    const { element, dispose } = renderMarkdown(
      {
        value: markdown.value,
        isTrusted: markdown.isTrusted,
        supportThemeIcons: true
      },
      {
        actionHandler: {
          callback: (content) => this.openerService.open(content, { allowCommands: !!markdown.isTrusted }).catch(onUnexpectedError),
          disposables: this._store
        }
      }
    );
    this._register(toDisposable(dispose));
    append(container, element);
  }
  renderMarkdownAndTable(data, container) {
    for (const markdownOrTable of data) {
      if (isMarkdownString(markdownOrTable)) {
        const element = $("", void 0);
        this.renderMarkdown(markdownOrTable, element);
        append(container, element);
      } else {
        const tableElement = append(container, $("table"));
        this.renderTable(markdownOrTable, tableElement);
      }
    }
  }
  renderElementData(container, renderer) {
    const elementData = renderer.render(this.manifest);
    if (elementData.onDidChange) {
      this._register(elementData.onDidChange((data) => {
        clearNode(container);
        container.appendChild(data);
      }));
    }
    container.appendChild(elementData.data);
  }
  layout(height, width) {
    this.layoutParticipants.forEach((p) => p.layout(height, width));
  }
};
ExtensionFeatureView = __decorateClass([
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IExtensionFeaturesManagementService),
  __decorateParam(6, IDialogService)
], ExtensionFeatureView);
export {
  ExtensionFeaturesTab
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uRmVhdHVyZXNUYWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7ICQsIGFwcGVuZCwgY2xlYXJOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25NYW5pZmVzdCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgT3JpZW50YXRpb24sIFNpemluZywgU3BsaXRWaWV3IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NwbGl0dmlldy9zcGxpdHZpZXcuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkZlYXR1cmVEZXNjcmlwdG9yLCBFeHRlbnNpb25zLCBJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSwgSUV4dGVuc2lvbkZlYXR1cmVSZW5kZXJlciwgSUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UsIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciwgSUV4dGVuc2lvbkZlYXR1cmVNYXJrZG93blJlbmRlcmVyLCBJVGFibGVEYXRhLCBJUmVuZGVyZWREYXRhLCBJRXh0ZW5zaW9uRmVhdHVyZU1hcmtkb3duQW5kVGFibGVSZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbkZlYXR1cmVzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRFeHRlbnNpb25JZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IElMaXN0UmVuZGVyZXIsIElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0QnV0dG9uU3R5bGVzLCBkZWZhdWx0S2V5YmluZGluZ0xhYmVsU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IHJlbmRlck1hcmtkb3duIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgZ2V0RXJyb3JNZXNzYWdlLCBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IFBBTkVMX1NFQ1RJT05fQk9SREVSIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIFRoZW1hYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEb21TY3JvbGxhYmxlRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zY3JvbGxiYXIvc2Nyb2xsYWJsZUVsZW1lbnQuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgZXJyb3JJY29uLCBpbmZvSWNvbiwgd2FybmluZ0ljb24gfSBmcm9tICcuL2V4dGVuc2lvbnNJY29ucy5qcyc7XG5pbXBvcnQgeyBTZXZlcml0eUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2V2ZXJpdHlJY29uL3NldmVyaXR5SWNvbi5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkva2V5YmluZGluZ0xhYmVsL2tleWJpbmRpbmdMYWJlbC5qcyc7XG5pbXBvcnQgeyBPUyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZywgTWFya2Rvd25TdHJpbmcsIGlzTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBSZXNvbHZlZEtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yVXRpbHMuanMnO1xuaW1wb3J0IHsgZm9yZWdyb3VuZCwgY2hhcnRBeGlzLCBjaGFydEd1aWRlLCBjaGFydExpbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmludGVyZmFjZSBJRXh0ZW5zaW9uRmVhdHVyZUVsZW1lbnRSZW5kZXJlciBleHRlbmRzIElFeHRlbnNpb25GZWF0dXJlUmVuZGVyZXIge1xuXHR0eXBlOiAnZWxlbWVudCc7XG5cdHJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogSVJlbmRlcmVkRGF0YTxIVE1MRWxlbWVudD47XG59XG5cbmNsYXNzIFJ1bnRpbWVTdGF0dXNNYXJrZG93blJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRlbnNpb25GZWF0dXJlRWxlbWVudFJlbmRlcmVyIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAncnVudGltZVN0YXR1cyc7XG5cdHJlYWRvbmx5IHR5cGUgPSAnZWxlbWVudCc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRzaG91bGRSZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbklkID0gbmV3IEV4dGVuc2lvbklkZW50aWZpZXIoZ2V0RXh0ZW5zaW9uSWQobWFuaWZlc3QucHVibGlzaGVyLCBtYW5pZmVzdC5uYW1lKSk7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5zb21lKGUgPT4gRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoZS5pZGVudGlmaWVyLCBleHRlbnNpb25JZCkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiAhIW1hbmlmZXN0Lm1haW4gfHwgISFtYW5pZmVzdC5icm93c2VyO1xuXHR9XG5cblx0cmVuZGVyKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBJUmVuZGVyZWREYXRhPEhUTUxFbGVtZW50PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uSWQgPSBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllcihnZXRFeHRlbnNpb25JZChtYW5pZmVzdC5wdWJsaXNoZXIsIG1hbmlmZXN0Lm5hbWUpKTtcblx0XHRjb25zdCBlbWl0dGVyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBFbWl0dGVyPEhUTUxFbGVtZW50PigpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9uc1N0YXR1cyhlID0+IHtcblx0XHRcdGlmIChlLnNvbWUoZXh0ZW5zaW9uID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGV4dGVuc2lvbiwgZXh0ZW5zaW9uSWQpKSkge1xuXHRcdFx0XHRlbWl0dGVyLmZpcmUodGhpcy5jcmVhdGVFbGVtZW50KG1hbmlmZXN0LCBkaXNwb3NhYmxlcykpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5leHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlQWNjZXNzRGF0YShlID0+IGVtaXR0ZXIuZmlyZSh0aGlzLmNyZWF0ZUVsZW1lbnQobWFuaWZlc3QsIGRpc3Bvc2FibGVzKSkpKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0b25EaWRDaGFuZ2U6IGVtaXR0ZXIuZXZlbnQsXG5cdFx0XHRkYXRhOiB0aGlzLmNyZWF0ZUVsZW1lbnQobWFuaWZlc3QsIGRpc3Bvc2FibGVzKSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUVsZW1lbnQobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBjb250YWluZXIgPSAkKCcucnVudGltZS1zdGF0dXMnKTtcblx0XHRjb25zdCBleHRlbnNpb25JZCA9IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKGdldEV4dGVuc2lvbklkKG1hbmlmZXN0LnB1Ymxpc2hlciwgbWFuaWZlc3QubmFtZSkpO1xuXHRcdGNvbnN0IHN0YXR1cyA9IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5nZXRFeHRlbnNpb25zU3RhdHVzKClbZXh0ZW5zaW9uSWQudmFsdWVdO1xuXHRcdGlmICh0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5zb21lKGV4dGVuc2lvbiA9PiBFeHRlbnNpb25JZGVudGlmaWVyLmVxdWFscyhleHRlbnNpb24uaWRlbnRpZmllciwgZXh0ZW5zaW9uSWQpKSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IG5ldyBNYXJrZG93blN0cmluZygpO1xuXHRcdFx0ZGF0YS5hcHBlbmRNYXJrZG93bihgIyMjICR7bG9jYWxpemUoJ2FjdGl2YXRpb24nLCBcIkFjdGl2YXRpb25cIil9XFxuXFxuYCk7XG5cdFx0XHRpZiAoc3RhdHVzLmFjdGl2YXRpb25UaW1lcykge1xuXHRcdFx0XHRpZiAoc3RhdHVzLmFjdGl2YXRpb25UaW1lcy5hY3RpdmF0aW9uUmVhc29uLnN0YXJ0dXApIHtcblx0XHRcdFx0XHRkYXRhLmFwcGVuZE1hcmtkb3duKGBBY3RpdmF0ZWQgb24gU3RhcnR1cDogXFxgJHtzdGF0dXMuYWN0aXZhdGlvblRpbWVzLmFjdGl2YXRlQ2FsbFRpbWV9bXNcXGBgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkYXRhLmFwcGVuZE1hcmtkb3duKGBBY3RpdmF0ZWQgYnkgXFxgJHtzdGF0dXMuYWN0aXZhdGlvblRpbWVzLmFjdGl2YXRpb25SZWFzb24uYWN0aXZhdGlvbkV2ZW50fVxcYCBldmVudDogXFxgJHtzdGF0dXMuYWN0aXZhdGlvblRpbWVzLmFjdGl2YXRlQ2FsbFRpbWV9bXNcXGBgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGF0YS5hcHBlbmRNYXJrZG93bignTm90IHlldCBhY3RpdmF0ZWQnKTtcblx0XHRcdH1cblx0XHRcdHRoaXMucmVuZGVyTWFya2Rvd24oZGF0YSwgY29udGFpbmVyLCBkaXNwb3NhYmxlcyk7XG5cdFx0fVxuXHRcdGNvbnN0IGZlYXR1cmVzID0gUmVnaXN0cnkuYXM8SUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnk+KEV4dGVuc2lvbnMuRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSkuZ2V0RXh0ZW5zaW9uRmVhdHVyZXMoKTtcblx0XHRmb3IgKGNvbnN0IGZlYXR1cmUgb2YgZmVhdHVyZXMpIHtcblx0XHRcdGNvbnN0IGFjY2Vzc0RhdGEgPSB0aGlzLmV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UuZ2V0QWNjZXNzRGF0YShleHRlbnNpb25JZCwgZmVhdHVyZS5pZCk7XG5cdFx0XHRpZiAoYWNjZXNzRGF0YSkge1xuXHRcdFx0XHR0aGlzLnJlbmRlck1hcmtkb3duKG5ldyBNYXJrZG93blN0cmluZyhgXFxuICMjIyAke2xvY2FsaXplKCdsYWJlbCcsIFwiezB9IFVzYWdlXCIsIGZlYXR1cmUubGFiZWwpfVxcblxcbmApLCBjb250YWluZXIsIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0aWYgKGFjY2Vzc0RhdGEuYWNjZXNzVGltZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVzY3JpcHRpb24gPSBhcHBlbmQoY29udGFpbmVyLFxuXHRcdFx0XHRcdFx0JCgnLmZlYXR1cmUtY2hhcnQtZGVzY3JpcHRpb24nLFxuXHRcdFx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdjaGFydERlc2NyaXB0aW9uJywgXCJUaGVyZSB3ZXJlIHswfSB7MX0gcmVxdWVzdHMgZnJvbSB0aGlzIGV4dGVuc2lvbiBpbiB0aGUgbGFzdCAzMCBkYXlzLlwiLCBhY2Nlc3NEYXRhPy5hY2Nlc3NUaW1lcy5sZW5ndGgsIGZlYXR1cmUuYWNjZXNzRGF0YUxhYmVsID8/IGZlYXR1cmUubGFiZWwpKSk7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb24uc3R5bGUubWFyZ2luQm90dG9tID0gJzhweCc7XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJSZXF1ZXN0c0NoYXJ0KGNvbnRhaW5lciwgYWNjZXNzRGF0YS5hY2Nlc3NUaW1lcywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHN0YXR1cyA9IGFjY2Vzc0RhdGE/LmN1cnJlbnQ/LnN0YXR1cztcblx0XHRcdFx0aWYgKHN0YXR1cykge1xuXHRcdFx0XHRcdGNvbnN0IGRhdGEgPSBuZXcgTWFya2Rvd25TdHJpbmcoKTtcblx0XHRcdFx0XHRpZiAoc3RhdHVzPy5zZXZlcml0eSA9PT0gU2V2ZXJpdHkuRXJyb3IpIHtcblx0XHRcdFx0XHRcdGRhdGEuYXBwZW5kTWFya2Rvd24oYCQoJHtlcnJvckljb24uaWR9KSAke3N0YXR1cy5tZXNzYWdlfVxcblxcbmApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc3RhdHVzPy5zZXZlcml0eSA9PT0gU2V2ZXJpdHkuV2FybmluZykge1xuXHRcdFx0XHRcdFx0ZGF0YS5hcHBlbmRNYXJrZG93bihgJCgke3dhcm5pbmdJY29uLmlkfSkgJHtzdGF0dXMubWVzc2FnZX1cXG5cXG5gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGRhdGEudmFsdWUpIHtcblx0XHRcdFx0XHRcdHRoaXMucmVuZGVyTWFya2Rvd24oZGF0YSwgY29udGFpbmVyLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChzdGF0dXMucnVudGltZUVycm9ycy5sZW5ndGggfHwgc3RhdHVzLm1lc3NhZ2VzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IG5ldyBNYXJrZG93blN0cmluZygpO1xuXHRcdFx0aWYgKHN0YXR1cy5ydW50aW1lRXJyb3JzLmxlbmd0aCkge1xuXHRcdFx0XHRkYXRhLmFwcGVuZE1hcmtkb3duKGBcXG4gIyMjICR7bG9jYWxpemUoJ3VuY2F1Z2h0IGVycm9ycycsIFwiVW5jYXVnaHQgRXJyb3JzICh7MH0pXCIsIHN0YXR1cy5ydW50aW1lRXJyb3JzLmxlbmd0aCl9XFxuYCk7XG5cdFx0XHRcdGZvciAoY29uc3QgZXJyb3Igb2Ygc3RhdHVzLnJ1bnRpbWVFcnJvcnMpIHtcblx0XHRcdFx0XHRkYXRhLmFwcGVuZE1hcmtkb3duKGAkKCR7Q29kaWNvbi5lcnJvci5pZH0pJm5ic3A7JHtnZXRFcnJvck1lc3NhZ2UoZXJyb3IpfVxcblxcbmApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoc3RhdHVzLm1lc3NhZ2VzLmxlbmd0aCkge1xuXHRcdFx0XHRkYXRhLmFwcGVuZE1hcmtkb3duKGBcXG4gIyMjICR7bG9jYWxpemUoJ21lc3NhYWdlcycsIFwiTWVzc2FnZXMgKHswfSlcIiwgc3RhdHVzLm1lc3NhZ2VzLmxlbmd0aCl9XFxuYCk7XG5cdFx0XHRcdGZvciAoY29uc3QgbWVzc2FnZSBvZiBzdGF0dXMubWVzc2FnZXMpIHtcblx0XHRcdFx0XHRkYXRhLmFwcGVuZE1hcmtkb3duKGAkKCR7KG1lc3NhZ2UudHlwZSA9PT0gU2V2ZXJpdHkuRXJyb3IgPyBDb2RpY29uLmVycm9yIDogbWVzc2FnZS50eXBlID09PSBTZXZlcml0eS5XYXJuaW5nID8gQ29kaWNvbi53YXJuaW5nIDogQ29kaWNvbi5pbmZvKS5pZH0pJm5ic3A7JHttZXNzYWdlLm1lc3NhZ2V9XFxuXFxuYCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChkYXRhLnZhbHVlKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyTWFya2Rvd24oZGF0YSwgY29udGFpbmVyLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBjb250YWluZXI7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck1hcmtkb3duKG1hcmtkb3duOiBJTWFya2Rvd25TdHJpbmcsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblx0XHRjb25zdCB7IGVsZW1lbnQsIGRpc3Bvc2UgfSA9IHJlbmRlck1hcmtkb3duKFxuXHRcdFx0e1xuXHRcdFx0XHR2YWx1ZTogbWFya2Rvd24udmFsdWUsXG5cdFx0XHRcdGlzVHJ1c3RlZDogbWFya2Rvd24uaXNUcnVzdGVkLFxuXHRcdFx0XHRzdXBwb3J0VGhlbWVJY29uczogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0YWN0aW9uSGFuZGxlcjoge1xuXHRcdFx0XHRcdGNhbGxiYWNrOiAoY29udGVudCkgPT4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oY29udGVudCwgeyBhbGxvd0NvbW1hbmRzOiAhIW1hcmtkb3duLmlzVHJ1c3RlZCB9KS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvciksXG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXNcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoZGlzcG9zZSkpO1xuXHRcdGFwcGVuZChjb250YWluZXIsIGVsZW1lbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSZXF1ZXN0c0NoYXJ0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGFjY2Vzc1RpbWVzOiBEYXRlW10sIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblx0XHRjb25zdCB3aWR0aCA9IDQ1MDtcblx0XHRjb25zdCBoZWlnaHQgPSAyNTA7XG5cdFx0Y29uc3QgbWFyZ2luID0geyB0b3A6IDAsIHJpZ2h0OiA0LCBib3R0b206IDIwLCBsZWZ0OiA0IH07XG5cdFx0Y29uc3QgaW5uZXJXaWR0aCA9IHdpZHRoIC0gbWFyZ2luLmxlZnQgLSBtYXJnaW4ucmlnaHQ7XG5cdFx0Y29uc3QgaW5uZXJIZWlnaHQgPSBoZWlnaHQgLSBtYXJnaW4udG9wIC0gbWFyZ2luLmJvdHRvbTtcblxuXHRcdGNvbnN0IGNoYXJ0Q29udGFpbmVyID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLmZlYXR1cmUtY2hhcnQtY29udGFpbmVyJykpO1xuXHRcdGNoYXJ0Q29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcblxuXHRcdGNvbnN0IHRvb2x0aXAgPSBhcHBlbmQoY2hhcnRDb250YWluZXIsICQoJy5mZWF0dXJlLWNoYXJ0LXRvb2x0aXAnKSk7XG5cdFx0dG9vbHRpcC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dG9vbHRpcC5zdHlsZS53aWR0aCA9ICcwcHgnO1xuXHRcdHRvb2x0aXAuc3R5bGUuaGVpZ2h0ID0gJzBweCc7XG5cblx0XHRsZXQgbWF4Q291bnQgPSAxMDA7XG5cdFx0Y29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRmb3IgKGNvbnN0IGFjY2Vzc1RpbWUgb2YgYWNjZXNzVGltZXMpIHtcblx0XHRcdGNvbnN0IGRheSA9IGAke2FjY2Vzc1RpbWUuZ2V0RGF0ZSgpfSAke2FjY2Vzc1RpbWUudG9Mb2NhbGVTdHJpbmcoJ2RlZmF1bHQnLCB7IG1vbnRoOiAnc2hvcnQnIH0pfWA7XG5cdFx0XHRtYXAuc2V0KGRheSwgKG1hcC5nZXQoZGF5KSA/PyAwKSArIDEpO1xuXHRcdFx0bWF4Q291bnQgPSBNYXRoLm1heChtYXhDb3VudCwgbWFwLmdldChkYXkpISk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblx0XHR0eXBlIFBvaW50ID0geyB4OiBudW1iZXI7IHk6IG51bWJlcjsgZGF0ZTogc3RyaW5nOyBjb3VudDogbnVtYmVyIH07XG5cdFx0Y29uc3QgcG9pbnRzOiBQb2ludFtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPD0gMzA7IGkrKykge1xuXHRcdFx0Y29uc3QgZGF0ZSA9IG5ldyBEYXRlKG5vdyk7XG5cdFx0XHRkYXRlLnNldERhdGUobm93LmdldERhdGUoKSAtICgzMCAtIGkpKTtcblx0XHRcdGNvbnN0IGRhdGVTdHJpbmcgPSBgJHtkYXRlLmdldERhdGUoKX0gJHtkYXRlLnRvTG9jYWxlU3RyaW5nKCdkZWZhdWx0JywgeyBtb250aDogJ3Nob3J0JyB9KX1gO1xuXHRcdFx0Y29uc3QgY291bnQgPSBtYXAuZ2V0KGRhdGVTdHJpbmcpID8/IDA7XG5cdFx0XHRjb25zdCB4ID0gKGkgLyAzMCkgKiBpbm5lcldpZHRoO1xuXHRcdFx0Y29uc3QgeSA9IGlubmVySGVpZ2h0IC0gKGNvdW50IC8gbWF4Q291bnQpICogaW5uZXJIZWlnaHQ7XG5cdFx0XHRwb2ludHMucHVzaCh7IHgsIHksIGRhdGU6IGRhdGVTdHJpbmcsIGNvdW50IH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNoYXJ0ID0gYXBwZW5kKGNoYXJ0Q29udGFpbmVyLCAkKCcuZmVhdHVyZS1jaGFydCcpKTtcblx0XHRjb25zdCBzdmcgPSBhcHBlbmQoY2hhcnQsICQuU1ZHKCdzdmcnKSk7XG5cdFx0c3ZnLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCBgJHt3aWR0aH1weGApO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIGAke2hlaWdodH1weGApO1xuXHRcdHN2Zy5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCBgMCAwICR7d2lkdGh9ICR7aGVpZ2h0fWApO1xuXG5cdFx0Y29uc3QgZyA9ICQuU1ZHKCdnJyk7XG5cdFx0Zy5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsIGB0cmFuc2xhdGUoJHttYXJnaW4ubGVmdH0sJHttYXJnaW4udG9wfSlgKTtcblx0XHRzdmcuYXBwZW5kQ2hpbGQoZyk7XG5cblx0XHRjb25zdCB4QXhpc0xpbmUgPSAkLlNWRygnbGluZScpO1xuXHRcdHhBeGlzTGluZS5zZXRBdHRyaWJ1dGUoJ3gxJywgJzAnKTtcblx0XHR4QXhpc0xpbmUuc2V0QXR0cmlidXRlKCd5MScsIGAke2lubmVySGVpZ2h0fWApO1xuXHRcdHhBeGlzTGluZS5zZXRBdHRyaWJ1dGUoJ3gyJywgYCR7aW5uZXJXaWR0aH1gKTtcblx0XHR4QXhpc0xpbmUuc2V0QXR0cmlidXRlKCd5MicsIGAke2lubmVySGVpZ2h0fWApO1xuXHRcdHhBeGlzTGluZS5zZXRBdHRyaWJ1dGUoJ3N0cm9rZScsIGFzQ3NzVmFyaWFibGUoY2hhcnRBeGlzKSk7XG5cdFx0eEF4aXNMaW5lLnNldEF0dHJpYnV0ZSgnc3Ryb2tlLXdpZHRoJywgJzFweCcpO1xuXHRcdGcuYXBwZW5kQ2hpbGQoeEF4aXNMaW5lKTtcblxuXHRcdGZvciAobGV0IGkgPSAxOyBpIDw9IDMwOyBpICs9IDcpIHtcblx0XHRcdGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShub3cpO1xuXHRcdFx0ZGF0ZS5zZXREYXRlKG5vdy5nZXREYXRlKCkgLSAoMzAgLSBpKSk7XG5cdFx0XHRjb25zdCBkYXRlU3RyaW5nID0gYCR7ZGF0ZS5nZXREYXRlKCl9ICR7ZGF0ZS50b0xvY2FsZVN0cmluZygnZGVmYXVsdCcsIHsgbW9udGg6ICdzaG9ydCcgfSl9YDtcblx0XHRcdGNvbnN0IHggPSAoaSAvIDMwKSAqIGlubmVyV2lkdGg7XG5cblx0XHRcdC8vIEFkZCB2ZXJ0aWNhbCBsaW5lXG5cdFx0XHRjb25zdCB0aWNrID0gJC5TVkcoJ2xpbmUnKTtcblx0XHRcdHRpY2suc2V0QXR0cmlidXRlKCd4MScsIGAke3h9YCk7XG5cdFx0XHR0aWNrLnNldEF0dHJpYnV0ZSgneTEnLCBgJHtpbm5lckhlaWdodH1gKTtcblx0XHRcdHRpY2suc2V0QXR0cmlidXRlKCd4MicsIGAke3h9YCk7XG5cdFx0XHR0aWNrLnNldEF0dHJpYnV0ZSgneTInLCBgJHtpbm5lckhlaWdodCArIDEwfWApO1xuXHRcdFx0dGljay5zZXRBdHRyaWJ1dGUoJ3N0cm9rZScsIGFzQ3NzVmFyaWFibGUoY2hhcnRBeGlzKSk7XG5cdFx0XHR0aWNrLnNldEF0dHJpYnV0ZSgnc3Ryb2tlLXdpZHRoJywgJzFweCcpO1xuXHRcdFx0Zy5hcHBlbmRDaGlsZCh0aWNrKTtcblxuXHRcdFx0Y29uc3QgcnVsZXIgPSAkLlNWRygnbGluZScpO1xuXHRcdFx0cnVsZXIuc2V0QXR0cmlidXRlKCd4MScsIGAke3h9YCk7XG5cdFx0XHRydWxlci5zZXRBdHRyaWJ1dGUoJ3kxJywgYDBgKTtcblx0XHRcdHJ1bGVyLnNldEF0dHJpYnV0ZSgneDInLCBgJHt4fWApO1xuXHRcdFx0cnVsZXIuc2V0QXR0cmlidXRlKCd5MicsIGAke2lubmVySGVpZ2h0fWApO1xuXHRcdFx0cnVsZXIuc2V0QXR0cmlidXRlKCdzdHJva2UnLCBhc0Nzc1ZhcmlhYmxlKGNoYXJ0R3VpZGUpKTtcblx0XHRcdHJ1bGVyLnNldEF0dHJpYnV0ZSgnc3Ryb2tlLXdpZHRoJywgJzFweCcpO1xuXHRcdFx0Zy5hcHBlbmRDaGlsZChydWxlcik7XG5cblx0XHRcdGNvbnN0IHhBeGlzRGF0ZSA9ICQuU1ZHKCd0ZXh0Jyk7XG5cdFx0XHR4QXhpc0RhdGUuc2V0QXR0cmlidXRlKCd4JywgYCR7eH1gKTtcblx0XHRcdHhBeGlzRGF0ZS5zZXRBdHRyaWJ1dGUoJ3knLCBgJHtoZWlnaHR9YCk7IC8vIEFkanVzdGVkIHkgcG9zaXRpb24gdG8gYmUgd2l0aGluIHRoZSBTVkcgdmlldyBwb3J0XG5cdFx0XHR4QXhpc0RhdGUuc2V0QXR0cmlidXRlKCd0ZXh0LWFuY2hvcicsICdtaWRkbGUnKTtcblx0XHRcdHhBeGlzRGF0ZS5zZXRBdHRyaWJ1dGUoJ2ZpbGwnLCBhc0Nzc1ZhcmlhYmxlKGZvcmVncm91bmQpKTtcblx0XHRcdHhBeGlzRGF0ZS5zZXRBdHRyaWJ1dGUoJ2ZvbnQtc2l6ZScsICcxMHB4Jyk7XG5cdFx0XHR4QXhpc0RhdGUudGV4dENvbnRlbnQgPSBkYXRlU3RyaW5nO1xuXHRcdFx0Zy5hcHBlbmRDaGlsZCh4QXhpc0RhdGUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmUgPSAkLlNWRygncG9seWxpbmUnKTtcblx0XHRsaW5lLnNldEF0dHJpYnV0ZSgnZmlsbCcsICdub25lJyk7XG5cdFx0bGluZS5zZXRBdHRyaWJ1dGUoJ3N0cm9rZScsIGFzQ3NzVmFyaWFibGUoY2hhcnRMaW5lKSk7XG5cdFx0bGluZS5zZXRBdHRyaWJ1dGUoJ3N0cm9rZS13aWR0aCcsIGAycHhgKTtcblx0XHRsaW5lLnNldEF0dHJpYnV0ZSgncG9pbnRzJywgcG9pbnRzLm1hcChwID0+IGAke3AueH0sJHtwLnl9YCkuam9pbignICcpKTtcblx0XHRnLmFwcGVuZENoaWxkKGxpbmUpO1xuXG5cdFx0Y29uc3QgaGlnaGxpZ2h0Q2lyY2xlID0gJC5TVkcoJ2NpcmNsZScpO1xuXHRcdGhpZ2hsaWdodENpcmNsZS5zZXRBdHRyaWJ1dGUoJ3InLCBgNHB4YCk7XG5cdFx0aGlnaGxpZ2h0Q2lyY2xlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0Zy5hcHBlbmRDaGlsZChoaWdobGlnaHRDaXJjbGUpO1xuXG5cdFx0Y29uc3QgaG92ZXJEaXNwb3NhYmxlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT4oKSk7XG5cdFx0Y29uc3QgbW91c2VNb3ZlTGlzdGVuZXIgPSAoZXZlbnQ6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHtcblx0XHRcdGNvbnN0IHJlY3QgPSBzdmcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRjb25zdCBtb3VzZVggPSBldmVudC5jbGllbnRYIC0gcmVjdC5sZWZ0IC0gbWFyZ2luLmxlZnQ7XG5cblx0XHRcdGxldCBjbG9zZXN0UG9pbnQ6IFBvaW50IHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IG1pbkRpc3RhbmNlID0gSW5maW5pdHk7XG5cblx0XHRcdHBvaW50cy5mb3JFYWNoKHBvaW50ID0+IHtcblx0XHRcdFx0Y29uc3QgZGlzdGFuY2UgPSBNYXRoLmFicyhwb2ludC54IC0gbW91c2VYKTtcblx0XHRcdFx0aWYgKGRpc3RhbmNlIDwgbWluRGlzdGFuY2UpIHtcblx0XHRcdFx0XHRtaW5EaXN0YW5jZSA9IGRpc3RhbmNlO1xuXHRcdFx0XHRcdGNsb3Nlc3RQb2ludCA9IHBvaW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKGNsb3Nlc3RQb2ludCkge1xuXHRcdFx0XHRoaWdobGlnaHRDaXJjbGUuc2V0QXR0cmlidXRlKCdjeCcsIGAke2Nsb3Nlc3RQb2ludC54fWApO1xuXHRcdFx0XHRoaWdobGlnaHRDaXJjbGUuc2V0QXR0cmlidXRlKCdjeScsIGAke2Nsb3Nlc3RQb2ludC55fWApO1xuXHRcdFx0XHRoaWdobGlnaHRDaXJjbGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHRcdHRvb2x0aXAuc3R5bGUubGVmdCA9IGAke2Nsb3Nlc3RQb2ludC54ICsgMjR9cHhgO1xuXHRcdFx0XHR0b29sdGlwLnN0eWxlLnRvcCA9IGAke2Nsb3Nlc3RQb2ludC55ICsgMTR9cHhgO1xuXHRcdFx0XHRob3ZlckRpc3Bvc2FibGUudmFsdWUgPSB0aGlzLmhvdmVyU2VydmljZS5zaG93SW5zdGFudEhvdmVyKHtcblx0XHRcdFx0XHRjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcoYCR7Y2xvc2VzdFBvaW50LmRhdGV9OiAke2Nsb3Nlc3RQb2ludC5jb3VudH0gcmVxdWVzdHNgKSxcblx0XHRcdFx0XHR0YXJnZXQ6IHRvb2x0aXAsXG5cdFx0XHRcdFx0YXBwZWFyYW5jZToge1xuXHRcdFx0XHRcdFx0c2hvd1BvaW50ZXI6IHRydWUsXG5cdFx0XHRcdFx0XHRza2lwRmFkZUluQW5pbWF0aW9uOiB0cnVlLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRob3ZlckRpc3Bvc2FibGUudmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRzdmcuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgbW91c2VNb3ZlTGlzdGVuZXIpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gc3ZnLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG1vdXNlTW92ZUxpc3RlbmVyKSkpO1xuXG5cdFx0Y29uc3QgbW91c2VMZWF2ZUxpc3RlbmVyID0gKCkgPT4ge1xuXHRcdFx0aGlnaGxpZ2h0Q2lyY2xlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRob3ZlckRpc3Bvc2FibGUudmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0fTtcblx0XHRzdmcuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIG1vdXNlTGVhdmVMaXN0ZW5lcik7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBzdmcucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIG1vdXNlTGVhdmVMaXN0ZW5lcikpKTtcblx0fVxufVxuXG5cbmludGVyZmFjZSBJTGF5b3V0UGFydGljaXBhbnQge1xuXHRsYXlvdXQoaGVpZ2h0PzogbnVtYmVyLCB3aWR0aD86IG51bWJlcik6IHZvaWQ7XG59XG5cbmNvbnN0IHJ1bnRpbWVTdGF0dXNGZWF0dXJlID0ge1xuXHRpZDogUnVudGltZVN0YXR1c01hcmtkb3duUmVuZGVyZXIuSUQsXG5cdGxhYmVsOiBsb2NhbGl6ZSgncnVudGltZScsIFwiUnVudGltZSBTdGF0dXNcIiksXG5cdGFjY2Vzczoge1xuXHRcdGNhblRvZ2dsZTogZmFsc2Vcblx0fSxcblx0cmVuZGVyZXI6IG5ldyBTeW5jRGVzY3JpcHRvcihSdW50aW1lU3RhdHVzTWFya2Rvd25SZW5kZXJlciksXG59O1xuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uRmVhdHVyZXNUYWIgZXh0ZW5kcyBUaGVtYWJsZSB7XG5cblx0cmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBmZWF0dXJlVmlldyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxFeHRlbnNpb25GZWF0dXJlVmlldz4oKSk7XG5cdHByaXZhdGUgZmVhdHVyZVZpZXdEaW1lbnNpb24/OiB7IGhlaWdodD86IG51bWJlcjsgd2lkdGg/OiBudW1iZXIgfTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxheW91dFBhcnRpY2lwYW50czogSUxheW91dFBhcnRpY2lwYW50W10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmZWF0dXJlOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKHRoZW1lU2VydmljZSk7XG5cblx0XHR0aGlzLmV4dGVuc2lvbklkID0gbmV3IEV4dGVuc2lvbklkZW50aWZpZXIoZ2V0RXh0ZW5zaW9uSWQobWFuaWZlc3QucHVibGlzaGVyLCBtYW5pZmVzdC5uYW1lKSk7XG5cdFx0dGhpcy5kb21Ob2RlID0gJCgnZGl2LnN1YmNvbnRlbnQuZmVhdHVyZS1jb250cmlidXRpb25zJyk7XG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fVxuXG5cdGxheW91dChoZWlnaHQ/OiBudW1iZXIsIHdpZHRoPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5sYXlvdXRQYXJ0aWNpcGFudHMuZm9yRWFjaChwYXJ0aWNpcGFudCA9PiBwYXJ0aWNpcGFudC5sYXlvdXQoaGVpZ2h0LCB3aWR0aCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgZmVhdHVyZXMgPSB0aGlzLmdldEZlYXR1cmVzKCk7XG5cdFx0aWYgKGZlYXR1cmVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0YXBwZW5kKCQoJy5uby1mZWF0dXJlcycpLCB0aGlzLmRvbU5vZGUpLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ25vRmVhdHVyZXMnLCBcIk5vIGZlYXR1cmVzIGNvbnRyaWJ1dGVkLlwiKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzcGxpdFZpZXcgPSB0aGlzLl9yZWdpc3RlcihuZXcgU3BsaXRWaWV3PG51bWJlcj4odGhpcy5kb21Ob2RlLCB7XG5cdFx0XHRvcmllbnRhdGlvbjogT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcblx0XHRcdHByb3BvcnRpb25hbExheW91dDogdHJ1ZVxuXHRcdH0pKTtcblx0XHR0aGlzLmxheW91dFBhcnRpY2lwYW50cy5wdXNoKHtcblx0XHRcdGxheW91dDogKGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdHNwbGl0Vmlldy5lbC5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHQgLSAxNH1weGA7XG5cdFx0XHRcdHNwbGl0Vmlldy5sYXlvdXQod2lkdGgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZmVhdHVyZXNMaXN0Q29udGFpbmVyID0gJCgnLmZlYXR1cmVzLWxpc3QtY29udGFpbmVyJyk7XG5cdFx0Y29uc3QgbGlzdCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3JlYXRlRmVhdHVyZXNMaXN0KGZlYXR1cmVzTGlzdENvbnRhaW5lcikpO1xuXHRcdGxpc3Quc3BsaWNlKDAsIGxpc3QubGVuZ3RoLCBmZWF0dXJlcyk7XG5cblx0XHRjb25zdCBmZWF0dXJlVmlld0NvbnRhaW5lciA9ICQoJy5mZWF0dXJlLXZpZXctY29udGFpbmVyJyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobGlzdC5vbkRpZENoYW5nZVNlbGVjdGlvbihlID0+IHtcblx0XHRcdGNvbnN0IGZlYXR1cmUgPSBlLmVsZW1lbnRzWzBdO1xuXHRcdFx0aWYgKGZlYXR1cmUpIHtcblx0XHRcdFx0dGhpcy5zaG93RmVhdHVyZVZpZXcoZmVhdHVyZSwgZmVhdHVyZVZpZXdDb250YWluZXIpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5mZWF0dXJlID8gZmVhdHVyZXMuZmluZEluZGV4KGYgPT4gZi5pZCA9PT0gdGhpcy5mZWF0dXJlKSA6IDA7XG5cdFx0bGlzdC5zZXRTZWxlY3Rpb24oW2luZGV4ID09PSAtMSA/IDAgOiBpbmRleF0pO1xuXG5cdFx0c3BsaXRWaWV3LmFkZFZpZXcoe1xuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRlbGVtZW50OiBmZWF0dXJlc0xpc3RDb250YWluZXIsXG5cdFx0XHRtaW5pbXVtU2l6ZTogMTAwLFxuXHRcdFx0bWF4aW11bVNpemU6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcblx0XHRcdGxheW91dDogKHdpZHRoLCBfLCBoZWlnaHQpID0+IHtcblx0XHRcdFx0ZmVhdHVyZXNMaXN0Q29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXHRcdFx0XHRsaXN0LmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0XHRcdH1cblx0XHR9LCAyMDAsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHRzcGxpdFZpZXcuYWRkVmlldyh7XG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdGVsZW1lbnQ6IGZlYXR1cmVWaWV3Q29udGFpbmVyLFxuXHRcdFx0bWluaW11bVNpemU6IDUwMCxcblx0XHRcdG1heGltdW1TaXplOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG5cdFx0XHRsYXlvdXQ6ICh3aWR0aCwgXywgaGVpZ2h0KSA9PiB7XG5cdFx0XHRcdGZlYXR1cmVWaWV3Q29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXHRcdFx0XHR0aGlzLmZlYXR1cmVWaWV3RGltZW5zaW9uID0geyBoZWlnaHQsIHdpZHRoIH07XG5cdFx0XHRcdHRoaXMubGF5b3V0RmVhdHVyZVZpZXcoKTtcblx0XHRcdH1cblx0XHR9LCBTaXppbmcuRGlzdHJpYnV0ZSwgdW5kZWZpbmVkLCB0cnVlKTtcblxuXHRcdHNwbGl0Vmlldy5zdHlsZSh7XG5cdFx0XHRzZXBhcmF0b3JCb3JkZXI6IHRoaXMudGhlbWUuZ2V0Q29sb3IoUEFORUxfU0VDVElPTl9CT1JERVIpIVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVGZWF0dXJlc0xpc3QoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IFdvcmtiZW5jaExpc3Q8SUV4dGVuc2lvbkZlYXR1cmVEZXNjcmlwdG9yPiB7XG5cdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbkZlYXR1cmVJdGVtUmVuZGVyZXIsIHRoaXMuZXh0ZW5zaW9uSWQpO1xuXHRcdGNvbnN0IGRlbGVnYXRlID0gbmV3IEV4dGVuc2lvbkZlYXR1cmVJdGVtRGVsZWdhdGUoKTtcblx0XHRjb25zdCBsaXN0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hMaXN0LCAnRXh0ZW5zaW9uRmVhdHVyZXNMaXN0JywgYXBwZW5kKGNvbnRhaW5lciwgJCgnLmZlYXR1cmVzLWxpc3Qtd3JhcHBlcicpKSwgZGVsZWdhdGUsIFtyZW5kZXJlcl0sIHtcblx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRzZXRSb3dMaW5lSGVpZ2h0OiBmYWxzZSxcblx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdGdldEFyaWFMYWJlbChleHRlbnNpb25GZWF0dXJlOiBJRXh0ZW5zaW9uRmVhdHVyZURlc2NyaXB0b3IgfCBudWxsKTogc3RyaW5nIHtcblx0XHRcdFx0XHRyZXR1cm4gZXh0ZW5zaW9uRmVhdHVyZT8ubGFiZWwgPz8gJyc7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnZXh0ZW5zaW9uIGZlYXR1cmVzIGxpc3QnLCBcIkV4dGVuc2lvbiBGZWF0dXJlc1wiKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9wZW5PblNpbmdsZUNsaWNrOiB0cnVlXG5cdFx0fSkgYXMgV29ya2JlbmNoTGlzdDxJRXh0ZW5zaW9uRmVhdHVyZURlc2NyaXB0b3I+O1xuXHRcdHJldHVybiBsaXN0O1xuXHR9XG5cblx0cHJpdmF0ZSBsYXlvdXRGZWF0dXJlVmlldygpOiB2b2lkIHtcblx0XHR0aGlzLmZlYXR1cmVWaWV3LnZhbHVlPy5sYXlvdXQodGhpcy5mZWF0dXJlVmlld0RpbWVuc2lvbj8uaGVpZ2h0LCB0aGlzLmZlYXR1cmVWaWV3RGltZW5zaW9uPy53aWR0aCk7XG5cdH1cblxuXHRwcml2YXRlIHNob3dGZWF0dXJlVmlldyhmZWF0dXJlOiBJRXh0ZW5zaW9uRmVhdHVyZURlc2NyaXB0b3IsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5mZWF0dXJlVmlldy52YWx1ZT8uZmVhdHVyZS5pZCA9PT0gZmVhdHVyZS5pZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjbGVhck5vZGUoY29udGFpbmVyKTtcblx0XHR0aGlzLmZlYXR1cmVWaWV3LnZhbHVlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25GZWF0dXJlVmlldywgdGhpcy5leHRlbnNpb25JZCwgdGhpcy5tYW5pZmVzdCwgZmVhdHVyZSk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuZmVhdHVyZVZpZXcudmFsdWUuZG9tTm9kZSk7XG5cdFx0dGhpcy5sYXlvdXRGZWF0dXJlVmlldygpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRGZWF0dXJlcygpOiBJRXh0ZW5zaW9uRmVhdHVyZURlc2NyaXB0b3JbXSB7XG5cdFx0Y29uc3QgZmVhdHVyZXMgPSBSZWdpc3RyeS5hczxJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5FeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5KVxuXHRcdFx0LmdldEV4dGVuc2lvbkZlYXR1cmVzKCkuZmlsdGVyKGZlYXR1cmUgPT4ge1xuXHRcdFx0XHRjb25zdCByZW5kZXJlciA9IHRoaXMuZ2V0UmVuZGVyZXIoZmVhdHVyZSk7XG5cdFx0XHRcdGNvbnN0IHNob3VsZFJlbmRlciA9IHJlbmRlcmVyPy5zaG91bGRSZW5kZXIodGhpcy5tYW5pZmVzdCk7XG5cdFx0XHRcdHJlbmRlcmVyPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHJldHVybiBzaG91bGRSZW5kZXI7XG5cdFx0XHR9KS5zb3J0KChhLCBiKSA9PiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCkpO1xuXG5cdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLmdldFJlbmRlcmVyKHJ1bnRpbWVTdGF0dXNGZWF0dXJlKTtcblx0XHRpZiAocmVuZGVyZXI/LnNob3VsZFJlbmRlcih0aGlzLm1hbmlmZXN0KSkge1xuXHRcdFx0ZmVhdHVyZXMuc3BsaWNlKDAsIDAsIHJ1bnRpbWVTdGF0dXNGZWF0dXJlKTtcblx0XHR9XG5cdFx0cmVuZGVyZXI/LmRpc3Bvc2UoKTtcblx0XHRyZXR1cm4gZmVhdHVyZXM7XG5cdH1cblxuXHRwcml2YXRlIGdldFJlbmRlcmVyKGZlYXR1cmU6IElFeHRlbnNpb25GZWF0dXJlRGVzY3JpcHRvcik6IElFeHRlbnNpb25GZWF0dXJlUmVuZGVyZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBmZWF0dXJlLnJlbmRlcmVyID8gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShmZWF0dXJlLnJlbmRlcmVyKSA6IHVuZGVmaW5lZDtcblx0fVxuXG59XG5cbmludGVyZmFjZSBJRXh0ZW5zaW9uRmVhdHVyZUl0ZW1UZW1wbGF0ZURhdGEge1xuXHRyZWFkb25seSBsYWJlbDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGRpc2FibGVkRWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHN0YXR1c0VsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5jbGFzcyBFeHRlbnNpb25GZWF0dXJlSXRlbURlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8SUV4dGVuc2lvbkZlYXR1cmVEZXNjcmlwdG9yPiB7XG5cdGdldEhlaWdodCgpIHsgcmV0dXJuIDIyOyB9XG5cdGdldFRlbXBsYXRlSWQoKSB7IHJldHVybiAnZXh0ZW5zaW9uRmVhdHVyZURlc2NyaXB0b3InOyB9XG59XG5cbmNsYXNzIEV4dGVuc2lvbkZlYXR1cmVJdGVtUmVuZGVyZXIgaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPElFeHRlbnNpb25GZWF0dXJlRGVzY3JpcHRvciwgSUV4dGVuc2lvbkZlYXR1cmVJdGVtVGVtcGxhdGVEYXRhPiB7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9ICdleHRlbnNpb25GZWF0dXJlRGVzY3JpcHRvcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcixcblx0XHRASUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZVxuXHQpIHsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRXh0ZW5zaW9uRmVhdHVyZUl0ZW1UZW1wbGF0ZURhdGEge1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdleHRlbnNpb24tZmVhdHVyZS1saXN0LWl0ZW0nKTtcblx0XHRjb25zdCBsYWJlbCA9IGFwcGVuZChjb250YWluZXIsICQoJy5leHRlbnNpb24tZmVhdHVyZS1sYWJlbCcpKTtcblx0XHRjb25zdCBkaXNhYmxlZEVsZW1lbnQgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcuZXh0ZW5zaW9uLWZlYXR1cmUtZGlzYWJsZWQtbGFiZWwnKSk7XG5cdFx0ZGlzYWJsZWRFbGVtZW50LnRleHRDb250ZW50ID0gbG9jYWxpemUoJ3Jldm9rZWQnLCBcIk5vIEFjY2Vzc1wiKTtcblx0XHRjb25zdCBzdGF0dXNFbGVtZW50ID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLmV4dGVuc2lvbi1mZWF0dXJlLXN0YXR1cycpKTtcblx0XHRyZXR1cm4geyBsYWJlbCwgZGlzYWJsZWRFbGVtZW50LCBzdGF0dXNFbGVtZW50LCBkaXNwb3NhYmxlczogbmV3IERpc3Bvc2FibGVTdG9yZSgpIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IElFeHRlbnNpb25GZWF0dXJlRGVzY3JpcHRvciwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRXh0ZW5zaW9uRmVhdHVyZUl0ZW1UZW1wbGF0ZURhdGEpIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwudGV4dENvbnRlbnQgPSBlbGVtZW50LmxhYmVsO1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNhYmxlZEVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IGVsZW1lbnQuaWQgPT09IHJ1bnRpbWVTdGF0dXNGZWF0dXJlLmlkIHx8IHRoaXMuZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZS5pc0VuYWJsZWQodGhpcy5leHRlbnNpb25JZCwgZWxlbWVudC5pZCkgPyAnbm9uZScgOiAnaW5oZXJpdCc7XG5cblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuYWRkKHRoaXMuZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZUVuYWJsZW1lbnQoKHsgZXh0ZW5zaW9uLCBmZWF0dXJlSWQsIGVuYWJsZWQgfSkgPT4ge1xuXHRcdFx0aWYgKEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGV4dGVuc2lvbiwgdGhpcy5leHRlbnNpb25JZCkgJiYgZmVhdHVyZUlkID09PSBlbGVtZW50LmlkKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5kaXNhYmxlZEVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IGVuYWJsZWQgPyAnbm9uZScgOiAnaW5oZXJpdCc7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgc3RhdHVzRWxlbWVudENsYXNzTmFtZSA9IHRlbXBsYXRlRGF0YS5zdGF0dXNFbGVtZW50LmNsYXNzTmFtZTtcblx0XHRjb25zdCB1cGRhdGVTdGF0dXMgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBhY2Nlc3NEYXRhID0gdGhpcy5leHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLmdldEFjY2Vzc0RhdGEodGhpcy5leHRlbnNpb25JZCwgZWxlbWVudC5pZCk7XG5cdFx0XHRpZiAoYWNjZXNzRGF0YT8uY3VycmVudD8uc3RhdHVzKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5zdGF0dXNFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnaW5oZXJpdCc7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5zdGF0dXNFbGVtZW50LmNsYXNzTmFtZSA9IGAke3N0YXR1c0VsZW1lbnRDbGFzc05hbWV9ICR7U2V2ZXJpdHlJY29uLmNsYXNzTmFtZShhY2Nlc3NEYXRhLmN1cnJlbnQuc3RhdHVzLnNldmVyaXR5KX1gO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLnN0YXR1c0VsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdH1cblx0XHR9O1xuXHRcdHVwZGF0ZVN0YXR1cygpO1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5hZGQodGhpcy5leHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlQWNjZXNzRGF0YSgoeyBleHRlbnNpb24sIGZlYXR1cmVJZCB9KSA9PiB7XG5cdFx0XHRpZiAoRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoZXh0ZW5zaW9uLCB0aGlzLmV4dGVuc2lvbklkKSAmJiBmZWF0dXJlSWQgPT09IGVsZW1lbnQuaWQpIHtcblx0XHRcdFx0dXBkYXRlU3RhdHVzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoZWxlbWVudDogSUV4dGVuc2lvbkZlYXR1cmVEZXNjcmlwdG9yLCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElFeHRlbnNpb25GZWF0dXJlSXRlbVRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSUV4dGVuc2lvbkZlYXR1cmVJdGVtVGVtcGxhdGVEYXRhKSB7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG59XG5cbmNsYXNzIEV4dGVuc2lvbkZlYXR1cmVWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0UGFydGljaXBhbnRzOiBJTGF5b3V0UGFydGljaXBhbnRbXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0LFxuXHRcdHJlYWRvbmx5IGZlYXR1cmU6IElFeHRlbnNpb25GZWF0dXJlRGVzY3JpcHRvcixcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuZG9tTm9kZSA9ICQoJy5leHRlbnNpb24tZmVhdHVyZS1jb250ZW50Jyk7XG5cdFx0dGhpcy5jcmVhdGUodGhpcy5kb21Ob2RlKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlKGNvbnRlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgaGVhZGVyID0gYXBwZW5kKGNvbnRlbnQsICQoJy5mZWF0dXJlLWhlYWRlcicpKTtcblx0XHRjb25zdCB0aXRsZSA9IGFwcGVuZChoZWFkZXIsICQoJy5mZWF0dXJlLXRpdGxlJykpO1xuXHRcdHRpdGxlLnRleHRDb250ZW50ID0gdGhpcy5mZWF0dXJlLmxhYmVsO1xuXG5cdFx0aWYgKHRoaXMuZmVhdHVyZS5hY2Nlc3MuY2FuVG9nZ2xlKSB7XG5cdFx0XHRjb25zdCBhY3Rpb25zQ29udGFpbmVyID0gYXBwZW5kKGhlYWRlciwgJCgnLmZlYXR1cmUtYWN0aW9ucycpKTtcblx0XHRcdGNvbnN0IGJ1dHRvbiA9IG5ldyBCdXR0b24oYWN0aW9uc0NvbnRhaW5lciwgZGVmYXVsdEJ1dHRvblN0eWxlcyk7XG5cdFx0XHR0aGlzLnVwZGF0ZUJ1dHRvbkxhYmVsKGJ1dHRvbik7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VFbmFibGVtZW50KCh7IGV4dGVuc2lvbiwgZmVhdHVyZUlkIH0pID0+IHtcblx0XHRcdFx0aWYgKEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGV4dGVuc2lvbiwgdGhpcy5leHRlbnNpb25JZCkgJiYgZmVhdHVyZUlkID09PSB0aGlzLmZlYXR1cmUuaWQpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUJ1dHRvbkxhYmVsKGJ1dHRvbik7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGJ1dHRvbi5vbkRpZENsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgZW5hYmxlZCA9IHRoaXMuZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZS5pc0VuYWJsZWQodGhpcy5leHRlbnNpb25JZCwgdGhpcy5mZWF0dXJlLmlkKTtcblx0XHRcdFx0Y29uc3QgY29uZmlybWF0aW9uUmVzdWx0ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnYWNjZXNzRXh0ZW5zaW9uRmVhdHVyZScsIFwiRW5hYmxlICd7MH0nIEZlYXR1cmVcIiwgdGhpcy5mZWF0dXJlLmxhYmVsKSxcblx0XHRcdFx0XHRtZXNzYWdlOiBlbmFibGVkXG5cdFx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkaXNhYmxlQWNjZXNzRXh0ZW5zaW9uRmVhdHVyZU1lc3NhZ2UnLCBcIldvdWxkIHlvdSBsaWtlIHRvIHJldm9rZSAnezB9JyBleHRlbnNpb24gdG8gYWNjZXNzICd7MX0nIGZlYXR1cmU/XCIsIHRoaXMubWFuaWZlc3QuZGlzcGxheU5hbWUgPz8gdGhpcy5leHRlbnNpb25JZC52YWx1ZSwgdGhpcy5mZWF0dXJlLmxhYmVsKVxuXHRcdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZW5hYmxlQWNjZXNzRXh0ZW5zaW9uRmVhdHVyZU1lc3NhZ2UnLCBcIldvdWxkIHlvdSBsaWtlIHRvIGFsbG93ICd7MH0nIGV4dGVuc2lvbiB0byBhY2Nlc3MgJ3sxfScgZmVhdHVyZT9cIiwgdGhpcy5tYW5pZmVzdC5kaXNwbGF5TmFtZSA/PyB0aGlzLmV4dGVuc2lvbklkLnZhbHVlLCB0aGlzLmZlYXR1cmUubGFiZWwpLFxuXHRcdFx0XHRcdGN1c3RvbTogdHJ1ZSxcblx0XHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBlbmFibGVkID8gbG9jYWxpemUoJ3Jldm9rZScsIFwiUmV2b2tlIEFjY2Vzc1wiKSA6IGxvY2FsaXplKCdncmFudCcsIFwiQWxsb3cgQWNjZXNzXCIpLFxuXHRcdFx0XHRcdGNhbmNlbEJ1dHRvbjogbG9jYWxpemUoJ2NhbmNlbCcsIFwiQ2FuY2VsXCIpLFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKGNvbmZpcm1hdGlvblJlc3VsdC5jb25maXJtZWQpIHtcblx0XHRcdFx0XHR0aGlzLmV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2Uuc2V0RW5hYmxlbWVudCh0aGlzLmV4dGVuc2lvbklkLCB0aGlzLmZlYXR1cmUuaWQsICFlbmFibGVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJvZHkgPSBhcHBlbmQoY29udGVudCwgJCgnLmZlYXR1cmUtYm9keScpKTtcblxuXHRcdGNvbnN0IGJvZHlDb250ZW50ID0gJCgnLmZlYXR1cmUtYm9keS1jb250ZW50Jyk7XG5cdFx0Y29uc3Qgc2Nyb2xsYWJsZUNvbnRlbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQoYm9keUNvbnRlbnQsIHt9KSk7XG5cdFx0YXBwZW5kKGJvZHksIHNjcm9sbGFibGVDb250ZW50LmdldERvbU5vZGUoKSk7XG5cdFx0dGhpcy5sYXlvdXRQYXJ0aWNpcGFudHMucHVzaCh7IGxheW91dDogKCkgPT4gc2Nyb2xsYWJsZUNvbnRlbnQuc2NhbkRvbU5vZGUoKSB9KTtcblx0XHRzY3JvbGxhYmxlQ29udGVudC5zY2FuRG9tTm9kZSgpO1xuXG5cdFx0aWYgKHRoaXMuZmVhdHVyZS5kZXNjcmlwdGlvbikge1xuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb24gPSBhcHBlbmQoYm9keUNvbnRlbnQsICQoJy5mZWF0dXJlLWRlc2NyaXB0aW9uJykpO1xuXHRcdFx0ZGVzY3JpcHRpb24udGV4dENvbnRlbnQgPSB0aGlzLmZlYXR1cmUuZGVzY3JpcHRpb247XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWNjZXNzRGF0YSA9IHRoaXMuZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZS5nZXRBY2Nlc3NEYXRhKHRoaXMuZXh0ZW5zaW9uSWQsIHRoaXMuZmVhdHVyZS5pZCk7XG5cdFx0aWYgKGFjY2Vzc0RhdGE/LmN1cnJlbnQ/LnN0YXR1cykge1xuXHRcdFx0YXBwZW5kKGJvZHlDb250ZW50LCAkKCcuZmVhdHVyZS1zdGF0dXMnLCB1bmRlZmluZWQsXG5cdFx0XHRcdCQoYHNwYW4ke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGFjY2Vzc0RhdGEuY3VycmVudC5zdGF0dXMuc2V2ZXJpdHkgPT09IFNldmVyaXR5LkVycm9yID8gZXJyb3JJY29uIDogYWNjZXNzRGF0YS5jdXJyZW50LnN0YXR1cy5zZXZlcml0eSA9PT0gU2V2ZXJpdHkuV2FybmluZyA/IHdhcm5pbmdJY29uIDogaW5mb0ljb24pfWAsIHVuZGVmaW5lZCksXG5cdFx0XHRcdCQoJ3NwYW4nLCB1bmRlZmluZWQsIGFjY2Vzc0RhdGEuY3VycmVudC5zdGF0dXMubWVzc2FnZSkpKTtcblx0XHR9XG5cblx0XHRjb25zdCBmZWF0dXJlQ29udGVudEVsZW1lbnQgPSBhcHBlbmQoYm9keUNvbnRlbnQsICQoJy5mZWF0dXJlLWNvbnRlbnQnKSk7XG5cdFx0aWYgKHRoaXMuZmVhdHVyZS5yZW5kZXJlcikge1xuXHRcdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlPElFeHRlbnNpb25GZWF0dXJlUmVuZGVyZXI+KHRoaXMuZmVhdHVyZS5yZW5kZXJlcik7XG5cdFx0XHRpZiAocmVuZGVyZXIudHlwZSA9PT0gJ3RhYmxlJykge1xuXHRcdFx0XHR0aGlzLnJlbmRlclRhYmxlRGF0YShmZWF0dXJlQ29udGVudEVsZW1lbnQsIDxJRXh0ZW5zaW9uRmVhdHVyZVRhYmxlUmVuZGVyZXI+cmVuZGVyZXIpO1xuXHRcdFx0fSBlbHNlIGlmIChyZW5kZXJlci50eXBlID09PSAnbWFya2Rvd24nKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyTWFya2Rvd25EYXRhKGZlYXR1cmVDb250ZW50RWxlbWVudCwgPElFeHRlbnNpb25GZWF0dXJlTWFya2Rvd25SZW5kZXJlcj5yZW5kZXJlcik7XG5cdFx0XHR9IGVsc2UgaWYgKHJlbmRlcmVyLnR5cGUgPT09ICdtYXJrZG93bit0YWJsZScpIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJNYXJrZG93bkFuZFRhYmxlRGF0YShmZWF0dXJlQ29udGVudEVsZW1lbnQsIDxJRXh0ZW5zaW9uRmVhdHVyZU1hcmtkb3duQW5kVGFibGVSZW5kZXJlcj5yZW5kZXJlcik7XG5cdFx0XHR9IGVsc2UgaWYgKHJlbmRlcmVyLnR5cGUgPT09ICdlbGVtZW50Jykge1xuXHRcdFx0XHR0aGlzLnJlbmRlckVsZW1lbnREYXRhKGZlYXR1cmVDb250ZW50RWxlbWVudCwgPElFeHRlbnNpb25GZWF0dXJlRWxlbWVudFJlbmRlcmVyPnJlbmRlcmVyKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUJ1dHRvbkxhYmVsKGJ1dHRvbjogQnV0dG9uKTogdm9pZCB7XG5cdFx0YnV0dG9uLmxhYmVsID0gdGhpcy5leHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCh0aGlzLmV4dGVuc2lvbklkLCB0aGlzLmZlYXR1cmUuaWQpID8gbG9jYWxpemUoJ3Jldm9rZScsIFwiUmV2b2tlIEFjY2Vzc1wiKSA6IGxvY2FsaXplKCdlbmFibGUnLCBcIkFsbG93IEFjY2Vzc1wiKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVGFibGVEYXRhKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHJlbmRlcmVyOiBJRXh0ZW5zaW9uRmVhdHVyZVRhYmxlUmVuZGVyZXIpOiB2b2lkIHtcblx0XHRjb25zdCB0YWJsZURhdGEgPSB0aGlzLl9yZWdpc3RlcihyZW5kZXJlci5yZW5kZXIodGhpcy5tYW5pZmVzdCkpO1xuXHRcdGNvbnN0IHRhYmxlRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0XHRpZiAodGFibGVEYXRhLm9uRGlkQ2hhbmdlKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0YWJsZURhdGEub25EaWRDaGFuZ2UoZGF0YSA9PiB7XG5cdFx0XHRcdGNsZWFyTm9kZShjb250YWluZXIpO1xuXHRcdFx0XHR0YWJsZURpc3Bvc2FibGUudmFsdWUgPSB0aGlzLnJlbmRlclRhYmxlKGRhdGEsIGNvbnRhaW5lcik7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdHRhYmxlRGlzcG9zYWJsZS52YWx1ZSA9IHRoaXMucmVuZGVyVGFibGUodGFibGVEYXRhLmRhdGEsIGNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRhYmxlKHRhYmxlRGF0YTogSVRhYmxlRGF0YSwgY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRhcHBlbmQoY29udGFpbmVyLFxuXHRcdFx0JCgndGFibGUnLCB1bmRlZmluZWQsXG5cdFx0XHRcdCQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdC4uLnRhYmxlRGF0YS5oZWFkZXJzLm1hcChoZWFkZXIgPT4gJCgndGgnLCB1bmRlZmluZWQsIGhlYWRlcikpXG5cdFx0XHRcdCksXG5cdFx0XHRcdC4uLnRhYmxlRGF0YS5yb3dzXG5cdFx0XHRcdFx0Lm1hcChyb3cgPT4ge1xuXHRcdFx0XHRcdFx0cmV0dXJuICQoJ3RyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHQuLi5yb3cubWFwKHJvd0RhdGEgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGlmICh0eXBlb2Ygcm93RGF0YSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiAkKCd0ZCcsIHVuZGVmaW5lZCwgJCgncCcsIHVuZGVmaW5lZCwgcm93RGF0YSkpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBkYXRhID0gQXJyYXkuaXNBcnJheShyb3dEYXRhKSA/IHJvd0RhdGEgOiBbcm93RGF0YV07XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuICQoJ3RkJywgdW5kZWZpbmVkLCAuLi5kYXRhLm1hcChpdGVtID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdDogTm9kZVtdID0gW107XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoaXNNYXJrZG93blN0cmluZyhyb3dEYXRhKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBlbGVtZW50ID0gJCgnJywgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5yZW5kZXJNYXJrZG93bihyb3dEYXRhLCBlbGVtZW50KTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmVzdWx0LnB1c2goZWxlbWVudCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiBSZXNvbHZlZEtleWJpbmRpbmcpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgZWxlbWVudCA9ICQoJycpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBrYmwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEtleWJpbmRpbmdMYWJlbChlbGVtZW50LCBPUywgZGVmYXVsdEtleWJpbmRpbmdMYWJlbFN0eWxlcykpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRrYmwuc2V0KGl0ZW0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXN1bHQucHVzaChlbGVtZW50KTtcblx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXRlbSBpbnN0YW5jZW9mIENvbG9yKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKCQoJ3NwYW4nLCB7IGNsYXNzOiAnY29sb3JCb3gnLCBzdHlsZTogJ2JhY2tncm91bmQtY29sb3I6ICcgKyBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdChpdGVtKSB9LCAnJykpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXN1bHQucHVzaCgkKCdjb2RlJywgdW5kZWZpbmVkLCBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdEhleChpdGVtKSkpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHRcdFx0XHR9KS5mbGF0KCkpO1xuXHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KSkpO1xuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyTWFya2Rvd25BbmRUYWJsZURhdGEoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgcmVuZGVyZXI6IElFeHRlbnNpb25GZWF0dXJlTWFya2Rvd25BbmRUYWJsZVJlbmRlcmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgbWFya2Rvd25BbmRUYWJsZURhdGEgPSB0aGlzLl9yZWdpc3RlcihyZW5kZXJlci5yZW5kZXIodGhpcy5tYW5pZmVzdCkpO1xuXHRcdGlmIChtYXJrZG93bkFuZFRhYmxlRGF0YS5vbkRpZENoYW5nZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIobWFya2Rvd25BbmRUYWJsZURhdGEub25EaWRDaGFuZ2UoZGF0YSA9PiB7XG5cdFx0XHRcdGNsZWFyTm9kZShjb250YWluZXIpO1xuXHRcdFx0XHR0aGlzLnJlbmRlck1hcmtkb3duQW5kVGFibGUoZGF0YSwgY29udGFpbmVyKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0dGhpcy5yZW5kZXJNYXJrZG93bkFuZFRhYmxlKG1hcmtkb3duQW5kVGFibGVEYXRhLmRhdGEsIGNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck1hcmtkb3duRGF0YShjb250YWluZXI6IEhUTUxFbGVtZW50LCByZW5kZXJlcjogSUV4dGVuc2lvbkZlYXR1cmVNYXJrZG93blJlbmRlcmVyKTogdm9pZCB7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21hcmtkb3duJyk7XG5cdFx0Y29uc3QgbWFya2Rvd25EYXRhID0gdGhpcy5fcmVnaXN0ZXIocmVuZGVyZXIucmVuZGVyKHRoaXMubWFuaWZlc3QpKTtcblx0XHRpZiAobWFya2Rvd25EYXRhLm9uRGlkQ2hhbmdlKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihtYXJrZG93bkRhdGEub25EaWRDaGFuZ2UoZGF0YSA9PiB7XG5cdFx0XHRcdGNsZWFyTm9kZShjb250YWluZXIpO1xuXHRcdFx0XHR0aGlzLnJlbmRlck1hcmtkb3duKGRhdGEsIGNvbnRhaW5lcik7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdHRoaXMucmVuZGVyTWFya2Rvd24obWFya2Rvd25EYXRhLmRhdGEsIGNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck1hcmtkb3duKG1hcmtkb3duOiBJTWFya2Rvd25TdHJpbmcsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCB7IGVsZW1lbnQsIGRpc3Bvc2UgfSA9IHJlbmRlck1hcmtkb3duKFxuXHRcdFx0e1xuXHRcdFx0XHR2YWx1ZTogbWFya2Rvd24udmFsdWUsXG5cdFx0XHRcdGlzVHJ1c3RlZDogbWFya2Rvd24uaXNUcnVzdGVkLFxuXHRcdFx0XHRzdXBwb3J0VGhlbWVJY29uczogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0YWN0aW9uSGFuZGxlcjoge1xuXHRcdFx0XHRcdGNhbGxiYWNrOiAoY29udGVudCkgPT4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oY29udGVudCwgeyBhbGxvd0NvbW1hbmRzOiAhIW1hcmtkb3duLmlzVHJ1c3RlZCB9KS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvciksXG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXM6IHRoaXMuX3N0b3JlXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoZGlzcG9zZSkpO1xuXHRcdGFwcGVuZChjb250YWluZXIsIGVsZW1lbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJNYXJrZG93bkFuZFRhYmxlKGRhdGE6IEFycmF5PElNYXJrZG93blN0cmluZyB8IElUYWJsZURhdGE+LCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBtYXJrZG93bk9yVGFibGUgb2YgZGF0YSkge1xuXHRcdFx0aWYgKGlzTWFya2Rvd25TdHJpbmcobWFya2Rvd25PclRhYmxlKSkge1xuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gJCgnJywgdW5kZWZpbmVkKTtcblx0XHRcdFx0dGhpcy5yZW5kZXJNYXJrZG93bihtYXJrZG93bk9yVGFibGUsIGVsZW1lbnQpO1xuXHRcdFx0XHRhcHBlbmQoY29udGFpbmVyLCBlbGVtZW50KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHRhYmxlRWxlbWVudCA9IGFwcGVuZChjb250YWluZXIsICQoJ3RhYmxlJykpO1xuXHRcdFx0XHR0aGlzLnJlbmRlclRhYmxlKG1hcmtkb3duT3JUYWJsZSwgdGFibGVFbGVtZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckVsZW1lbnREYXRhKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHJlbmRlcmVyOiBJRXh0ZW5zaW9uRmVhdHVyZUVsZW1lbnRSZW5kZXJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGVsZW1lbnREYXRhID0gcmVuZGVyZXIucmVuZGVyKHRoaXMubWFuaWZlc3QpO1xuXHRcdGlmIChlbGVtZW50RGF0YS5vbkRpZENoYW5nZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZWxlbWVudERhdGEub25EaWRDaGFuZ2UoZGF0YSA9PiB7XG5cdFx0XHRcdGNsZWFyTm9kZShjb250YWluZXIpO1xuXHRcdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZGF0YSk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChlbGVtZW50RGF0YS5kYXRhKTtcblx0fVxuXG5cdGxheW91dChoZWlnaHQ/OiBudW1iZXIsIHdpZHRoPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5sYXlvdXRQYXJ0aWNpcGFudHMuZm9yRWFjaChwID0+IHAubGF5b3V0KGhlaWdodCwgd2lkdGgpKTtcblx0fVxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsWUFBWSxpQkFBOEIsbUJBQW1CLG9CQUFvQjtBQUMxRixTQUFTLEdBQUcsUUFBUSxpQkFBaUI7QUFDckMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUywyQkFBK0M7QUFDeEQsU0FBUyxhQUFhLFFBQVEsaUJBQWlCO0FBQy9DLFNBQXNDLFlBQW1FLDJDQUFvTDtBQUM3UixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQjtBQUN6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
