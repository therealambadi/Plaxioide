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
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { HighlightedLabel } from "../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { CachedListVirtualDelegate } from "../../../../base/browser/ui/list/list.js";
import { createMatches } from "../../../../base/common/filters.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { basename } from "../../../../base/common/path.js";
import severity from "../../../../base/common/severity.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IDebugService } from "../common/debug.js";
import { Variable } from "../common/debugModel.js";
import { RawObjectReplElement, ReplEvaluationInput, ReplEvaluationResult, ReplGroup, ReplOutputElement, ReplVariableElement } from "../common/replModel.js";
import { AbstractExpressionsRenderer } from "./baseDebugView.js";
import { debugConsoleEvaluationInput } from "./debugIcons.js";
const $ = dom.$;
const _ReplEvaluationInputsRenderer = class _ReplEvaluationInputsRenderer {
  get templateId() {
    return _ReplEvaluationInputsRenderer.ID;
  }
  renderTemplate(container) {
    dom.append(container, $("span.arrow" + ThemeIcon.asCSSSelector(debugConsoleEvaluationInput)));
    const input = dom.append(container, $(".expression"));
    const label = new HighlightedLabel(input);
    return { label };
  }
  renderElement(element, index, templateData) {
    const evaluation = element.element;
    templateData.label.set(evaluation.value, createMatches(element.filterData));
  }
  disposeTemplate(templateData) {
    templateData.label.dispose();
  }
};
_ReplEvaluationInputsRenderer.ID = "replEvaluationInput";
let ReplEvaluationInputsRenderer = _ReplEvaluationInputsRenderer;
let ReplGroupRenderer = class {
  constructor(expressionRenderer, instaService) {
    this.expressionRenderer = expressionRenderer;
    this.instaService = instaService;
  }
  get templateId() {
    return ReplGroupRenderer.ID;
  }
  renderTemplate(container) {
    container.classList.add("group");
    const expression = dom.append(container, $(".output.expression.value-and-source"));
    const label = dom.append(expression, $("span.label"));
    const source = this.instaService.createInstance(SourceWidget, expression);
    return { label, source };
  }
  renderElement(element, _index, templateData) {
    templateData.elementDisposable?.dispose();
    const replGroup = element.element;
    dom.clearNode(templateData.label);
    templateData.elementDisposable = this.expressionRenderer.renderValue(templateData.label, replGroup.name, { wasANSI: true, session: element.element.session });
    templateData.source.setSource(replGroup.sourceData);
  }
  disposeTemplate(templateData) {
    templateData.elementDisposable?.dispose();
    templateData.source.dispose();
  }
};
ReplGroupRenderer.ID = "replGroup";
ReplGroupRenderer = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ReplGroupRenderer);
const _ReplEvaluationResultsRenderer = class _ReplEvaluationResultsRenderer {
  constructor(expressionRenderer) {
    this.expressionRenderer = expressionRenderer;
  }
  get templateId() {
    return _ReplEvaluationResultsRenderer.ID;
  }
  renderTemplate(container) {
    const output = dom.append(container, $(".evaluation-result.expression"));
    const value = dom.append(output, $("span.value"));
    return { value, elementStore: new DisposableStore() };
  }
  renderElement(element, index, templateData) {
    templateData.elementStore.clear();
    const expression = element.element;
    templateData.elementStore.add(this.expressionRenderer.renderValue(templateData.value, expression, {
      colorize: true,
      hover: false,
      session: element.element.getSession()
    }));
  }
  disposeTemplate(templateData) {
    templateData.elementStore.dispose();
  }
};
_ReplEvaluationResultsRenderer.ID = "replEvaluationResult";
let ReplEvaluationResultsRenderer = _ReplEvaluationResultsRenderer;
let ReplOutputElementRenderer = class {
  constructor(expressionRenderer, instaService) {
    this.expressionRenderer = expressionRenderer;
    this.instaService = instaService;
  }
  get templateId() {
    return ReplOutputElementRenderer.ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    container.classList.add("output");
    const expression = dom.append(container, $(".output.expression.value-and-source"));
    data.container = container;
    data.countContainer = dom.append(expression, $(".count-badge-wrapper"));
    data.count = new CountBadge(data.countContainer, {}, defaultCountBadgeStyles);
    data.value = dom.append(expression, $("span.value.label"));
    data.source = this.instaService.createInstance(SourceWidget, expression);
    data.elementDisposable = new DisposableStore();
    return data;
  }
  renderElement({ element }, index, templateData) {
    templateData.elementDisposable.clear();
    this.setElementCount(element, templateData);
    templateData.elementDisposable.add(element.onDidChangeCount(() => this.setElementCount(element, templateData)));
    dom.clearNode(templateData.value);
    templateData.value.className = "value";
    const locationReference = element.expression?.valueLocationReference;
    templateData.elementDisposable.add(this.expressionRenderer.renderValue(templateData.value, element.value, {
      wasANSI: true,
      session: element.session,
      locationReference,
      hover: false
    }));
    templateData.value.classList.add(element.severity === severity.Warning ? "warn" : element.severity === severity.Error ? "error" : element.severity === severity.Ignore ? "ignore" : "info");
    templateData.source.setSource(element.sourceData);
    templateData.getReplElementSource = () => element.sourceData;
  }
  setElementCount(element, templateData) {
    if (element.count >= 2) {
      templateData.count.setCount(element.count);
      templateData.countContainer.hidden = false;
    } else {
      templateData.countContainer.hidden = true;
    }
  }
  disposeTemplate(templateData) {
    templateData.source.dispose();
    templateData.elementDisposable.dispose();
    templateData.count.dispose();
  }
  disposeElement(_element, _index, templateData) {
    templateData.elementDisposable.clear();
  }
};
ReplOutputElementRenderer.ID = "outputReplElement";
ReplOutputElementRenderer = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ReplOutputElementRenderer);
let ReplVariablesRenderer = class extends AbstractExpressionsRenderer {
  constructor(expressionRenderer, debugService, contextViewService, hoverService) {
    super(debugService, contextViewService, hoverService);
    this.expressionRenderer = expressionRenderer;
  }
  get templateId() {
    return ReplVariablesRenderer.ID;
  }
  renderElement(node, _index, data) {
    const element = node.element;
    data.elementDisposable.clear();
    super.renderExpressionElement(element instanceof ReplVariableElement ? element.expression : element, node, data);
  }
  renderExpression(expression, data, highlights) {
    const isReplVariable = expression instanceof ReplVariableElement;
    if (isReplVariable || !expression.name) {
      data.label.set("");
      const value = isReplVariable ? expression.expression : expression;
      data.elementDisposable.add(this.expressionRenderer.renderValue(data.value, value, { colorize: true, hover: false, session: expression.getSession() }));
      data.expression.classList.remove("nested-variable");
    } else {
      data.elementDisposable.add(this.expressionRenderer.renderVariable(data, expression, { showChanged: true, highlights }));
      data.expression.classList.toggle("nested-variable", isNestedVariable(expression));
    }
  }
  getInputBoxOptions(expression) {
    return void 0;
  }
};
ReplVariablesRenderer.ID = "replVariable";
ReplVariablesRenderer = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IHoverService)
], ReplVariablesRenderer);
const _ReplRawObjectsRenderer = class _ReplRawObjectsRenderer {
  constructor(expressionRenderer) {
    this.expressionRenderer = expressionRenderer;
  }
  get templateId() {
    return _ReplRawObjectsRenderer.ID;
  }
  renderTemplate(container) {
    container.classList.add("output");
    const expression = dom.append(container, $(".output.expression"));
    const name = dom.append(expression, $("span.name"));
    const label = new HighlightedLabel(name);
    const value = dom.append(expression, $("span.value"));
    return { container, expression, name, label, value, elementStore: new DisposableStore() };
  }
  renderElement(node, index, templateData) {
    templateData.elementStore.clear();
    const element = node.element;
    templateData.label.set(element.name ? `${element.name}:` : "", createMatches(node.filterData));
    if (element.name) {
      templateData.name.textContent = `${element.name}:`;
    } else {
      templateData.name.textContent = "";
    }
    templateData.elementStore.add(this.expressionRenderer.renderValue(templateData.value, element.value, {
      hover: false,
      session: node.element.getSession()
    }));
  }
  disposeTemplate(templateData) {
    templateData.elementStore.dispose();
    templateData.label.dispose();
  }
};
_ReplRawObjectsRenderer.ID = "rawObject";
let ReplRawObjectsRenderer = _ReplRawObjectsRenderer;
function isNestedVariable(element) {
  return element instanceof Variable && (element.parent instanceof ReplEvaluationResult || element.parent instanceof Variable);
}
class ReplDelegate extends CachedListVirtualDelegate {
  constructor(configurationService, replOptions) {
    super();
    this.configurationService = configurationService;
    this.replOptions = replOptions;
  }
  getHeight(element) {
    const config = this.configurationService.getValue("debug");
    if (!config.console.wordWrap) {
      return this.estimateHeight(element, true);
    }
    return super.getHeight(element);
  }
  /**
   * With wordWrap enabled, this is an estimate. With wordWrap disabled, this is the real height that the list will use.
   */
  estimateHeight(element, ignoreValueLength = false) {
    const lineHeight = this.replOptions.replConfiguration.lineHeight;
    const countNumberOfLines = (str) => str.match(/\n/g)?.length ?? 0;
    const hasValue = (e) => typeof e.value === "string";
    if (hasValue(element) && !isNestedVariable(element)) {
      const value = element.value;
      const valueRows = countNumberOfLines(value) + (ignoreValueLength ? 0 : Math.floor(value.length / 70)) + (element instanceof ReplOutputElement ? 0 : 1);
      return Math.max(valueRows, 1) * lineHeight;
    }
    return lineHeight;
  }
  getTemplateId(element) {
    if (element instanceof Variable || element instanceof ReplVariableElement) {
      return ReplVariablesRenderer.ID;
    }
    if (element instanceof ReplEvaluationResult) {
      return ReplEvaluationResultsRenderer.ID;
    }
    if (element instanceof ReplEvaluationInput) {
      return ReplEvaluationInputsRenderer.ID;
    }
    if (element instanceof ReplOutputElement) {
      return ReplOutputElementRenderer.ID;
    }
    if (element instanceof ReplGroup) {
      return ReplGroupRenderer.ID;
    }
    return ReplRawObjectsRenderer.ID;
  }
  hasDynamicHeight(element) {
    if (isNestedVariable(element)) {
      return false;
    }
    return element.toString().length > 0;
  }
}
function isDebugSession(obj) {
  return typeof obj.getReplElements === "function";
}
class ReplDataSource {
  hasChildren(element) {
    if (isDebugSession(element)) {
      return true;
    }
    return !!element.hasChildren;
  }
  getChildren(element) {
    if (isDebugSession(element)) {
      return Promise.resolve(element.getReplElements());
    }
    return Promise.resolve(element.getChildren());
  }
}
class ReplAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize("debugConsole", "Debug Console");
  }
  getAriaLabel(element) {
    if (element instanceof Variable) {
      return localize("replVariableAriaLabel", "Variable {0}, value {1}", element.name, element.value);
    }
    if (element instanceof ReplOutputElement || element instanceof ReplEvaluationInput || element instanceof ReplEvaluationResult) {
      return element.value + (element instanceof ReplOutputElement && element.count > 1 ? localize(
        { key: "occurred", comment: ["Front will the value of the debug console element. Placeholder will be replaced by a number which represents occurrance count."] },
        ", occurred {0} times",
        element.count
      ) : "");
    }
    if (element instanceof RawObjectReplElement) {
      return localize("replRawObjectAriaLabel", "Debug console variable {0}, value {1}", element.name, element.value);
    }
    if (element instanceof ReplGroup) {
      return localize("replGroup", "Debug console group {0}", element.name);
    }
    return "";
  }
}
let SourceWidget = class extends Disposable {
  constructor(container, editorService, hoverService, labelService) {
    super();
    this.hoverService = hoverService;
    this.labelService = labelService;
    this.el = dom.append(container, $(".source"));
    this._register(dom.addDisposableListener(this.el, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.source) {
        this.source.source.openInEditor(editorService, {
          startLineNumber: this.source.lineNumber,
          startColumn: this.source.column,
          endLineNumber: this.source.lineNumber,
          endColumn: this.source.column
        });
      }
    }));
  }
  setSource(source) {
    this.source = source;
    this.el.textContent = source ? `${basename(source.source.name)}:${source.lineNumber}` : "";
    this.hover ??= this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.el, ""));
    this.hover.update(source ? `${this.labelService.getUriLabel(source.source.uri)}:${source.lineNumber}` : "");
  }
};
SourceWidget = __decorateClass([
  __decorateParam(1, IEditorService),
  __decorateParam(2, IHoverService),
  __decorateParam(3, ILabelService)
], SourceWidget);
export {
  ReplAccessibilityProvider,
  ReplDataSource,
  ReplDelegate,
  ReplEvaluationInputsRenderer,
  ReplEvaluationResultsRenderer,
  ReplGroupRenderer,
  ReplOutputElementRenderer,
  ReplRawObjectsRenderer,
  ReplVariablesRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL3JlcGxWaWV3ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBDb3VudEJhZGdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvdW50QmFkZ2UvY291bnRCYWRnZS5qcyc7XG5pbXBvcnQgeyBIaWdobGlnaHRlZExhYmVsLCBJSGlnaGxpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hpZ2hsaWdodGVkbGFiZWwvaGlnaGxpZ2h0ZWRMYWJlbC5qcyc7XG5pbXBvcnQgeyBJTWFuYWdlZEhvdmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IENhY2hlZExpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBJQXN5bmNEYXRhU291cmNlLCBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IGNyZWF0ZU1hdGNoZXMsIEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCBzZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgZGVmYXVsdENvdW50QmFkZ2VTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSURlYnVnQ29uZmlndXJhdGlvbiwgSURlYnVnU2VydmljZSwgSURlYnVnU2Vzc2lvbiwgSUV4cHJlc3Npb24sIElFeHByZXNzaW9uQ29udGFpbmVyLCBJTmVzdGluZ1JlcGxFbGVtZW50LCBJUmVwbEVsZW1lbnQsIElSZXBsRWxlbWVudFNvdXJjZSwgSVJlcGxPcHRpb25zIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IFZhcmlhYmxlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnTW9kZWwuanMnO1xuaW1wb3J0IHsgUmF3T2JqZWN0UmVwbEVsZW1lbnQsIFJlcGxFdmFsdWF0aW9uSW5wdXQsIFJlcGxFdmFsdWF0aW9uUmVzdWx0LCBSZXBsR3JvdXAsIFJlcGxPdXRwdXRFbGVtZW50LCBSZXBsVmFyaWFibGVFbGVtZW50IH0gZnJvbSAnLi4vY29tbW9uL3JlcGxNb2RlbC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEV4cHJlc3Npb25zUmVuZGVyZXIsIElFeHByZXNzaW9uVGVtcGxhdGVEYXRhLCBJSW5wdXRCb3hPcHRpb25zIH0gZnJvbSAnLi9iYXNlRGVidWdWaWV3LmpzJztcbmltcG9ydCB7IERlYnVnRXhwcmVzc2lvblJlbmRlcmVyIH0gZnJvbSAnLi9kZWJ1Z0V4cHJlc3Npb25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBkZWJ1Z0NvbnNvbGVFdmFsdWF0aW9uSW5wdXQgfSBmcm9tICcuL2RlYnVnSWNvbnMuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmludGVyZmFjZSBJUmVwbEV2YWx1YXRpb25JbnB1dFRlbXBsYXRlRGF0YSB7XG5cdGxhYmVsOiBIaWdobGlnaHRlZExhYmVsO1xufVxuXG5pbnRlcmZhY2UgSVJlcGxHcm91cFRlbXBsYXRlRGF0YSB7XG5cdGxhYmVsOiBIVE1MRWxlbWVudDtcblx0c291cmNlOiBTb3VyY2VXaWRnZXQ7XG5cdGVsZW1lbnREaXNwb3NhYmxlPzogSURpc3Bvc2FibGU7XG59XG5cbmludGVyZmFjZSBJUmVwbEV2YWx1YXRpb25SZXN1bHRUZW1wbGF0ZURhdGEge1xuXHR2YWx1ZTogSFRNTEVsZW1lbnQ7XG5cdGVsZW1lbnRTdG9yZTogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5pbnRlcmZhY2UgSU91dHB1dFJlcGxFbGVtZW50VGVtcGxhdGVEYXRhIHtcblx0Y29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0Y291bnQ6IENvdW50QmFkZ2U7XG5cdGNvdW50Q29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0dmFsdWU6IEhUTUxFbGVtZW50O1xuXHRzb3VyY2U6IFNvdXJjZVdpZGdldDtcblx0Z2V0UmVwbEVsZW1lbnRTb3VyY2UoKTogSVJlcGxFbGVtZW50U291cmNlIHwgdW5kZWZpbmVkO1xuXHRlbGVtZW50RGlzcG9zYWJsZTogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5pbnRlcmZhY2UgSVJhd09iamVjdFJlcGxUZW1wbGF0ZURhdGEge1xuXHRjb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRleHByZXNzaW9uOiBIVE1MRWxlbWVudDtcblx0bmFtZTogSFRNTEVsZW1lbnQ7XG5cdHZhbHVlOiBIVE1MRWxlbWVudDtcblx0bGFiZWw6IEhpZ2hsaWdodGVkTGFiZWw7XG5cdGVsZW1lbnRTdG9yZTogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5leHBvcnQgY2xhc3MgUmVwbEV2YWx1YXRpb25JbnB1dHNSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8UmVwbEV2YWx1YXRpb25JbnB1dCwgRnV6enlTY29yZSwgSVJlcGxFdmFsdWF0aW9uSW5wdXRUZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3JlcGxFdmFsdWF0aW9uSW5wdXQnO1xuXG5cdGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFJlcGxFdmFsdWF0aW9uSW5wdXRzUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVJlcGxFdmFsdWF0aW9uSW5wdXRUZW1wbGF0ZURhdGEge1xuXHRcdGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCdzcGFuLmFycm93JyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGRlYnVnQ29uc29sZUV2YWx1YXRpb25JbnB1dCkpKTtcblx0XHRjb25zdCBpbnB1dCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcuZXhwcmVzc2lvbicpKTtcblx0XHRjb25zdCBsYWJlbCA9IG5ldyBIaWdobGlnaHRlZExhYmVsKGlucHV0KTtcblx0XHRyZXR1cm4geyBsYWJlbCB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8UmVwbEV2YWx1YXRpb25JbnB1dCwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVJlcGxFdmFsdWF0aW9uSW5wdXRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBldmFsdWF0aW9uID0gZWxlbWVudC5lbGVtZW50O1xuXHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXQoZXZhbHVhdGlvbi52YWx1ZSwgY3JlYXRlTWF0Y2hlcyhlbGVtZW50LmZpbHRlckRhdGEpKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElSZXBsRXZhbHVhdGlvbklucHV0VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVwbEdyb3VwUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFJlcGxHcm91cCwgRnV6enlTY29yZSwgSVJlcGxHcm91cFRlbXBsYXRlRGF0YT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAncmVwbEdyb3VwJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4cHJlc3Npb25SZW5kZXJlcjogRGVidWdFeHByZXNzaW9uUmVuZGVyZXIsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFJlcGxHcm91cFJlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElSZXBsR3JvdXBUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdncm91cCcpO1xuXHRcdGNvbnN0IGV4cHJlc3Npb24gPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLm91dHB1dC5leHByZXNzaW9uLnZhbHVlLWFuZC1zb3VyY2UnKSk7XG5cdFx0Y29uc3QgbGFiZWwgPSBkb20uYXBwZW5kKGV4cHJlc3Npb24sICQoJ3NwYW4ubGFiZWwnKSk7XG5cdFx0Y29uc3Qgc291cmNlID0gdGhpcy5pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlV2lkZ2V0LCBleHByZXNzaW9uKTtcblx0XHRyZXR1cm4geyBsYWJlbCwgc291cmNlIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxSZXBsR3JvdXAsIEZ1enp5U2NvcmU+LCBfaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJUmVwbEdyb3VwVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGU/LmRpc3Bvc2UoKTtcblx0XHRjb25zdCByZXBsR3JvdXAgPSBlbGVtZW50LmVsZW1lbnQ7XG5cdFx0ZG9tLmNsZWFyTm9kZSh0ZW1wbGF0ZURhdGEubGFiZWwpO1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZSA9IHRoaXMuZXhwcmVzc2lvblJlbmRlcmVyLnJlbmRlclZhbHVlKHRlbXBsYXRlRGF0YS5sYWJlbCwgcmVwbEdyb3VwLm5hbWUsIHsgd2FzQU5TSTogdHJ1ZSwgc2Vzc2lvbjogZWxlbWVudC5lbGVtZW50LnNlc3Npb24gfSk7XG5cdFx0dGVtcGxhdGVEYXRhLnNvdXJjZS5zZXRTb3VyY2UocmVwbEdyb3VwLnNvdXJjZURhdGEpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVJlcGxHcm91cFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZT8uZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5zb3VyY2UuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZXBsRXZhbHVhdGlvblJlc3VsdHNSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8UmVwbEV2YWx1YXRpb25SZXN1bHQgfCBWYXJpYWJsZSwgRnV6enlTY29yZSwgSVJlcGxFdmFsdWF0aW9uUmVzdWx0VGVtcGxhdGVEYXRhPiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdyZXBsRXZhbHVhdGlvblJlc3VsdCc7XG5cblx0Z2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gUmVwbEV2YWx1YXRpb25SZXN1bHRzUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4cHJlc3Npb25SZW5kZXJlcjogRGVidWdFeHByZXNzaW9uUmVuZGVyZXIsXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElSZXBsRXZhbHVhdGlvblJlc3VsdFRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3Qgb3V0cHV0ID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5ldmFsdWF0aW9uLXJlc3VsdC5leHByZXNzaW9uJykpO1xuXHRcdGNvbnN0IHZhbHVlID0gZG9tLmFwcGVuZChvdXRwdXQsICQoJ3NwYW4udmFsdWUnKSk7XG5cblx0XHRyZXR1cm4geyB2YWx1ZSwgZWxlbWVudFN0b3JlOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCkgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPFJlcGxFdmFsdWF0aW9uUmVzdWx0IHwgVmFyaWFibGUsIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElSZXBsRXZhbHVhdGlvblJlc3VsdFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50U3RvcmUuY2xlYXIoKTtcblx0XHRjb25zdCBleHByZXNzaW9uID0gZWxlbWVudC5lbGVtZW50O1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50U3RvcmUuYWRkKHRoaXMuZXhwcmVzc2lvblJlbmRlcmVyLnJlbmRlclZhbHVlKHRlbXBsYXRlRGF0YS52YWx1ZSwgZXhwcmVzc2lvbiwge1xuXHRcdFx0Y29sb3JpemU6IHRydWUsXG5cdFx0XHRob3ZlcjogZmFsc2UsXG5cdFx0XHRzZXNzaW9uOiBlbGVtZW50LmVsZW1lbnQuZ2V0U2Vzc2lvbigpLFxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElSZXBsRXZhbHVhdGlvblJlc3VsdFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50U3RvcmUuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZXBsT3V0cHV0RWxlbWVudFJlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxSZXBsT3V0cHV0RWxlbWVudCwgRnV6enlTY29yZSwgSU91dHB1dFJlcGxFbGVtZW50VGVtcGxhdGVEYXRhPiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdvdXRwdXRSZXBsRWxlbWVudCc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHByZXNzaW9uUmVuZGVyZXI6IERlYnVnRXhwcmVzc2lvblJlbmRlcmVyLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7IH1cblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBSZXBsT3V0cHV0RWxlbWVudFJlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElPdXRwdXRSZXBsRWxlbWVudFRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGF0YTogSU91dHB1dFJlcGxFbGVtZW50VGVtcGxhdGVEYXRhID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnb3V0cHV0Jyk7XG5cdFx0Y29uc3QgZXhwcmVzc2lvbiA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcub3V0cHV0LmV4cHJlc3Npb24udmFsdWUtYW5kLXNvdXJjZScpKTtcblxuXHRcdGRhdGEuY29udGFpbmVyID0gY29udGFpbmVyO1xuXHRcdGRhdGEuY291bnRDb250YWluZXIgPSBkb20uYXBwZW5kKGV4cHJlc3Npb24sICQoJy5jb3VudC1iYWRnZS13cmFwcGVyJykpO1xuXHRcdGRhdGEuY291bnQgPSBuZXcgQ291bnRCYWRnZShkYXRhLmNvdW50Q29udGFpbmVyLCB7fSwgZGVmYXVsdENvdW50QmFkZ2VTdHlsZXMpO1xuXHRcdGRhdGEudmFsdWUgPSBkb20uYXBwZW5kKGV4cHJlc3Npb24sICQoJ3NwYW4udmFsdWUubGFiZWwnKSk7XG5cdFx0ZGF0YS5zb3VyY2UgPSB0aGlzLmluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VXaWRnZXQsIGV4cHJlc3Npb24pO1xuXHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoeyBlbGVtZW50IH06IElUcmVlTm9kZTxSZXBsT3V0cHV0RWxlbWVudCwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSU91dHB1dFJlcGxFbGVtZW50VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0dGhpcy5zZXRFbGVtZW50Q291bnQoZWxlbWVudCwgdGVtcGxhdGVEYXRhKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGUuYWRkKGVsZW1lbnQub25EaWRDaGFuZ2VDb3VudCgoKSA9PiB0aGlzLnNldEVsZW1lbnRDb3VudChlbGVtZW50LCB0ZW1wbGF0ZURhdGEpKSk7XG5cdFx0Ly8gdmFsdWVcblx0XHRkb20uY2xlYXJOb2RlKHRlbXBsYXRlRGF0YS52YWx1ZSk7XG5cdFx0Ly8gUmVzZXQgY2xhc3NlcyB0byBjbGVhciBhbnNpIGRlY29yYXRpb25zIHNpbmNlIHRlbXBsYXRlcyBhcmUgcmV1c2VkXG5cdFx0dGVtcGxhdGVEYXRhLnZhbHVlLmNsYXNzTmFtZSA9ICd2YWx1ZSc7XG5cblx0XHRjb25zdCBsb2NhdGlvblJlZmVyZW5jZSA9IGVsZW1lbnQuZXhwcmVzc2lvbj8udmFsdWVMb2NhdGlvblJlZmVyZW5jZTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGUuYWRkKHRoaXMuZXhwcmVzc2lvblJlbmRlcmVyLnJlbmRlclZhbHVlKHRlbXBsYXRlRGF0YS52YWx1ZSwgZWxlbWVudC52YWx1ZSwge1xuXHRcdFx0d2FzQU5TSTogdHJ1ZSxcblx0XHRcdHNlc3Npb246IGVsZW1lbnQuc2Vzc2lvbixcblx0XHRcdGxvY2F0aW9uUmVmZXJlbmNlLFxuXHRcdFx0aG92ZXI6IGZhbHNlLFxuXHRcdH0pKTtcblxuXHRcdHRlbXBsYXRlRGF0YS52YWx1ZS5jbGFzc0xpc3QuYWRkKChlbGVtZW50LnNldmVyaXR5ID09PSBzZXZlcml0eS5XYXJuaW5nKSA/ICd3YXJuJyA6IChlbGVtZW50LnNldmVyaXR5ID09PSBzZXZlcml0eS5FcnJvcikgPyAnZXJyb3InIDogKGVsZW1lbnQuc2V2ZXJpdHkgPT09IHNldmVyaXR5Lklnbm9yZSkgPyAnaWdub3JlJyA6ICdpbmZvJyk7XG5cdFx0dGVtcGxhdGVEYXRhLnNvdXJjZS5zZXRTb3VyY2UoZWxlbWVudC5zb3VyY2VEYXRhKTtcblx0XHR0ZW1wbGF0ZURhdGEuZ2V0UmVwbEVsZW1lbnRTb3VyY2UgPSAoKSA9PiBlbGVtZW50LnNvdXJjZURhdGE7XG5cdH1cblxuXHRwcml2YXRlIHNldEVsZW1lbnRDb3VudChlbGVtZW50OiBSZXBsT3V0cHV0RWxlbWVudCwgdGVtcGxhdGVEYXRhOiBJT3V0cHV0UmVwbEVsZW1lbnRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRpZiAoZWxlbWVudC5jb3VudCA+PSAyKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuY291bnQuc2V0Q291bnQoZWxlbWVudC5jb3VudCk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuY291bnRDb250YWluZXIuaGlkZGVuID0gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5jb3VudENvbnRhaW5lci5oaWRkZW4gPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElPdXRwdXRSZXBsRWxlbWVudFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5zb3VyY2UuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLmNvdW50LmRpc3Bvc2UoKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KF9lbGVtZW50OiBJVHJlZU5vZGU8UmVwbE91dHB1dEVsZW1lbnQsIEZ1enp5U2NvcmU+LCBfaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJT3V0cHV0UmVwbEVsZW1lbnRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGUuY2xlYXIoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVwbFZhcmlhYmxlc1JlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RFeHByZXNzaW9uc1JlbmRlcmVyPElFeHByZXNzaW9uIHwgUmVwbFZhcmlhYmxlRWxlbWVudD4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdyZXBsVmFyaWFibGUnO1xuXG5cdGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFJlcGxWYXJpYWJsZXNSZW5kZXJlci5JRDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXhwcmVzc2lvblJlbmRlcmVyOiBEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlcixcblx0XHRASURlYnVnU2VydmljZSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoZGVidWdTZXJ2aWNlLCBjb250ZXh0Vmlld1NlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8SUV4cHJlc3Npb24gfCBSZXBsVmFyaWFibGVFbGVtZW50LCBGdXp6eVNjb3JlPiwgX2luZGV4OiBudW1iZXIsIGRhdGE6IElFeHByZXNzaW9uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IG5vZGUuZWxlbWVudDtcblx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0c3VwZXIucmVuZGVyRXhwcmVzc2lvbkVsZW1lbnQoZWxlbWVudCBpbnN0YW5jZW9mIFJlcGxWYXJpYWJsZUVsZW1lbnQgPyBlbGVtZW50LmV4cHJlc3Npb24gOiBlbGVtZW50LCBub2RlLCBkYXRhKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJFeHByZXNzaW9uKGV4cHJlc3Npb246IElFeHByZXNzaW9uIHwgUmVwbFZhcmlhYmxlRWxlbWVudCwgZGF0YTogSUV4cHJlc3Npb25UZW1wbGF0ZURhdGEsIGhpZ2hsaWdodHM6IElIaWdobGlnaHRbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGlzUmVwbFZhcmlhYmxlID0gZXhwcmVzc2lvbiBpbnN0YW5jZW9mIFJlcGxWYXJpYWJsZUVsZW1lbnQ7XG5cdFx0aWYgKGlzUmVwbFZhcmlhYmxlIHx8ICFleHByZXNzaW9uLm5hbWUpIHtcblx0XHRcdGRhdGEubGFiZWwuc2V0KCcnKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gaXNSZXBsVmFyaWFibGUgPyBleHByZXNzaW9uLmV4cHJlc3Npb24gOiBleHByZXNzaW9uO1xuXHRcdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZS5hZGQodGhpcy5leHByZXNzaW9uUmVuZGVyZXIucmVuZGVyVmFsdWUoZGF0YS52YWx1ZSwgdmFsdWUsIHsgY29sb3JpemU6IHRydWUsIGhvdmVyOiBmYWxzZSwgc2Vzc2lvbjogZXhwcmVzc2lvbi5nZXRTZXNzaW9uKCkgfSkpO1xuXHRcdFx0ZGF0YS5leHByZXNzaW9uLmNsYXNzTGlzdC5yZW1vdmUoJ25lc3RlZC12YXJpYWJsZScpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlLmFkZCh0aGlzLmV4cHJlc3Npb25SZW5kZXJlci5yZW5kZXJWYXJpYWJsZShkYXRhLCBleHByZXNzaW9uIGFzIFZhcmlhYmxlLCB7IHNob3dDaGFuZ2VkOiB0cnVlLCBoaWdobGlnaHRzIH0pKTtcblx0XHRcdGRhdGEuZXhwcmVzc2lvbi5jbGFzc0xpc3QudG9nZ2xlKCduZXN0ZWQtdmFyaWFibGUnLCBpc05lc3RlZFZhcmlhYmxlKGV4cHJlc3Npb24pKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0SW5wdXRCb3hPcHRpb25zKGV4cHJlc3Npb246IElFeHByZXNzaW9uKTogSUlucHV0Qm94T3B0aW9ucyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVwbFJhd09iamVjdHNSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8UmF3T2JqZWN0UmVwbEVsZW1lbnQsIEZ1enp5U2NvcmUsIElSYXdPYmplY3RSZXBsVGVtcGxhdGVEYXRhPiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdyYXdPYmplY3QnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXhwcmVzc2lvblJlbmRlcmVyOiBEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlcixcblx0KSB7IH1cblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBSZXBsUmF3T2JqZWN0c1JlbmRlcmVyLklEO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElSYXdPYmplY3RSZXBsVGVtcGxhdGVEYXRhIHtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnb3V0cHV0Jyk7XG5cblx0XHRjb25zdCBleHByZXNzaW9uID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5vdXRwdXQuZXhwcmVzc2lvbicpKTtcblx0XHRjb25zdCBuYW1lID0gZG9tLmFwcGVuZChleHByZXNzaW9uLCAkKCdzcGFuLm5hbWUnKSk7XG5cdFx0Y29uc3QgbGFiZWwgPSBuZXcgSGlnaGxpZ2h0ZWRMYWJlbChuYW1lKTtcblx0XHRjb25zdCB2YWx1ZSA9IGRvbS5hcHBlbmQoZXhwcmVzc2lvbiwgJCgnc3Bhbi52YWx1ZScpKTtcblxuXHRcdHJldHVybiB7IGNvbnRhaW5lciwgZXhwcmVzc2lvbiwgbmFtZSwgbGFiZWwsIHZhbHVlLCBlbGVtZW50U3RvcmU6IG5ldyBEaXNwb3NhYmxlU3RvcmUoKSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8UmF3T2JqZWN0UmVwbEVsZW1lbnQsIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElSYXdPYmplY3RSZXBsVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnRTdG9yZS5jbGVhcigpO1xuXG5cdFx0Ly8ga2V5XG5cdFx0Y29uc3QgZWxlbWVudCA9IG5vZGUuZWxlbWVudDtcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0KGVsZW1lbnQubmFtZSA/IGAke2VsZW1lbnQubmFtZX06YCA6ICcnLCBjcmVhdGVNYXRjaGVzKG5vZGUuZmlsdGVyRGF0YSkpO1xuXHRcdGlmIChlbGVtZW50Lm5hbWUpIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5uYW1lLnRleHRDb250ZW50ID0gYCR7ZWxlbWVudC5uYW1lfTpgO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEubmFtZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcdH1cblxuXHRcdC8vIHZhbHVlXG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnRTdG9yZS5hZGQodGhpcy5leHByZXNzaW9uUmVuZGVyZXIucmVuZGVyVmFsdWUodGVtcGxhdGVEYXRhLnZhbHVlLCBlbGVtZW50LnZhbHVlLCB7XG5cdFx0XHRob3ZlcjogZmFsc2UsXG5cdFx0XHRzZXNzaW9uOiBub2RlLmVsZW1lbnQuZ2V0U2Vzc2lvbigpLFxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElSYXdPYmplY3RSZXBsVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnRTdG9yZS5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBpc05lc3RlZFZhcmlhYmxlKGVsZW1lbnQ6IElSZXBsRWxlbWVudCkge1xuXHRyZXR1cm4gZWxlbWVudCBpbnN0YW5jZW9mIFZhcmlhYmxlICYmIChlbGVtZW50LnBhcmVudCBpbnN0YW5jZW9mIFJlcGxFdmFsdWF0aW9uUmVzdWx0IHx8IGVsZW1lbnQucGFyZW50IGluc3RhbmNlb2YgVmFyaWFibGUpO1xufVxuXG5leHBvcnQgY2xhc3MgUmVwbERlbGVnYXRlIGV4dGVuZHMgQ2FjaGVkTGlzdFZpcnR1YWxEZWxlZ2F0ZTxJUmVwbEVsZW1lbnQ+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSByZXBsT3B0aW9uczogSVJlcGxPcHRpb25zXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRIZWlnaHQoZWxlbWVudDogSVJlcGxFbGVtZW50KTogbnVtYmVyIHtcblx0XHRjb25zdCBjb25maWcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpO1xuXG5cdFx0aWYgKCFjb25maWcuY29uc29sZS53b3JkV3JhcCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZXN0aW1hdGVIZWlnaHQoZWxlbWVudCwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1cGVyLmdldEhlaWdodChlbGVtZW50KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBXaXRoIHdvcmRXcmFwIGVuYWJsZWQsIHRoaXMgaXMgYW4gZXN0aW1hdGUuIFdpdGggd29yZFdyYXAgZGlzYWJsZWQsIHRoaXMgaXMgdGhlIHJlYWwgaGVpZ2h0IHRoYXQgdGhlIGxpc3Qgd2lsbCB1c2UuXG5cdCAqL1xuXHRwcm90ZWN0ZWQgZXN0aW1hdGVIZWlnaHQoZWxlbWVudDogSVJlcGxFbGVtZW50LCBpZ25vcmVWYWx1ZUxlbmd0aCA9IGZhbHNlKTogbnVtYmVyIHtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5yZXBsT3B0aW9ucy5yZXBsQ29uZmlndXJhdGlvbi5saW5lSGVpZ2h0O1xuXHRcdGNvbnN0IGNvdW50TnVtYmVyT2ZMaW5lcyA9IChzdHI6IHN0cmluZykgPT4gc3RyLm1hdGNoKC9cXG4vZyk/Lmxlbmd0aCA/PyAwO1xuXHRcdGNvbnN0IGhhc1ZhbHVlID0gKGU6IGFueSk6IGUgaXMgeyB2YWx1ZTogc3RyaW5nIH0gPT4gdHlwZW9mIGUudmFsdWUgPT09ICdzdHJpbmcnO1xuXG5cdFx0aWYgKGhhc1ZhbHVlKGVsZW1lbnQpICYmICFpc05lc3RlZFZhcmlhYmxlKGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGVsZW1lbnQudmFsdWU7XG5cdFx0XHRjb25zdCB2YWx1ZVJvd3MgPSBjb3VudE51bWJlck9mTGluZXModmFsdWUpXG5cdFx0XHRcdCsgKGlnbm9yZVZhbHVlTGVuZ3RoID8gMCA6IE1hdGguZmxvb3IodmFsdWUubGVuZ3RoIC8gNzApKSAvLyBNYWtlIGFuIGVzdGltYXRlIGZvciB3cmFwcGluZ1xuXHRcdFx0XHQrIChlbGVtZW50IGluc3RhbmNlb2YgUmVwbE91dHB1dEVsZW1lbnQgPyAwIDogMSk7IC8vIEEgU2ltcGxlUmVwbEVsZW1lbnQgZW5kcyBpbiBcXG4gaWYgaXQncyBhIGNvbXBsZXRlIGxpbmVcblxuXHRcdFx0cmV0dXJuIE1hdGgubWF4KHZhbHVlUm93cywgMSkgKiBsaW5lSGVpZ2h0O1xuXHRcdH1cblxuXHRcdHJldHVybiBsaW5lSGVpZ2h0O1xuXHR9XG5cblx0Z2V0VGVtcGxhdGVJZChlbGVtZW50OiBJUmVwbEVsZW1lbnQpOiBzdHJpbmcge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVmFyaWFibGUgfHwgZWxlbWVudCBpbnN0YW5jZW9mIFJlcGxWYXJpYWJsZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBSZXBsVmFyaWFibGVzUmVuZGVyZXIuSUQ7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgUmVwbEV2YWx1YXRpb25SZXN1bHQpIHtcblx0XHRcdHJldHVybiBSZXBsRXZhbHVhdGlvblJlc3VsdHNSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZXBsRXZhbHVhdGlvbklucHV0KSB7XG5cdFx0XHRyZXR1cm4gUmVwbEV2YWx1YXRpb25JbnB1dHNSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZXBsT3V0cHV0RWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIFJlcGxPdXRwdXRFbGVtZW50UmVuZGVyZXIuSUQ7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgUmVwbEdyb3VwKSB7XG5cdFx0XHRyZXR1cm4gUmVwbEdyb3VwUmVuZGVyZXIuSUQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFJlcGxSYXdPYmplY3RzUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRoYXNEeW5hbWljSGVpZ2h0KGVsZW1lbnQ6IElSZXBsRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdGlmIChpc05lc3RlZFZhcmlhYmxlKGVsZW1lbnQpKSB7XG5cdFx0XHQvLyBOZXN0ZWQgdmFyaWFibGVzIHNob3VsZCBhbHdheXMgYmUgaW4gb25lIGxpbmUgIzExMTg0M1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHQvLyBFbXB0eSBlbGVtZW50cyBzaG91bGQgbm90IGhhdmUgZHluYW1pYyBoZWlnaHQgc2luY2UgdGhleSB3aWxsIGJlIGludmlzaWJsZVxuXHRcdHJldHVybiBlbGVtZW50LnRvU3RyaW5nKCkubGVuZ3RoID4gMDtcblx0fVxufVxuXG5mdW5jdGlvbiBpc0RlYnVnU2Vzc2lvbihvYmo6IGFueSk6IG9iaiBpcyBJRGVidWdTZXNzaW9uIHtcblx0cmV0dXJuIHR5cGVvZiBvYmouZ2V0UmVwbEVsZW1lbnRzID09PSAnZnVuY3Rpb24nO1xufVxuXG5leHBvcnQgY2xhc3MgUmVwbERhdGFTb3VyY2UgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPElEZWJ1Z1Nlc3Npb24sIElSZXBsRWxlbWVudD4ge1xuXG5cdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IElSZXBsRWxlbWVudCB8IElEZWJ1Z1Nlc3Npb24pOiBib29sZWFuIHtcblx0XHRpZiAoaXNEZWJ1Z1Nlc3Npb24oZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiAhISg8SUV4cHJlc3Npb25Db250YWluZXIgfCBJTmVzdGluZ1JlcGxFbGVtZW50PmVsZW1lbnQpLmhhc0NoaWxkcmVuO1xuXHR9XG5cblx0Z2V0Q2hpbGRyZW4oZWxlbWVudDogSVJlcGxFbGVtZW50IHwgSURlYnVnU2Vzc2lvbik6IFByb21pc2U8SVJlcGxFbGVtZW50W10+IHtcblx0XHRpZiAoaXNEZWJ1Z1Nlc3Npb24oZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZWxlbWVudC5nZXRSZXBsRWxlbWVudHMoKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgoPElFeHByZXNzaW9uIHwgSU5lc3RpbmdSZXBsRWxlbWVudD5lbGVtZW50KS5nZXRDaGlsZHJlbigpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVwbEFjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPElSZXBsRWxlbWVudD4ge1xuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnZGVidWdDb25zb2xlJywgXCJEZWJ1ZyBDb25zb2xlXCIpO1xuXHR9XG5cblx0Z2V0QXJpYUxhYmVsKGVsZW1lbnQ6IElSZXBsRWxlbWVudCk6IHN0cmluZyB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBWYXJpYWJsZSkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdyZXBsVmFyaWFibGVBcmlhTGFiZWwnLCBcIlZhcmlhYmxlIHswfSwgdmFsdWUgezF9XCIsIGVsZW1lbnQubmFtZSwgZWxlbWVudC52YWx1ZSk7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgUmVwbE91dHB1dEVsZW1lbnQgfHwgZWxlbWVudCBpbnN0YW5jZW9mIFJlcGxFdmFsdWF0aW9uSW5wdXQgfHwgZWxlbWVudCBpbnN0YW5jZW9mIFJlcGxFdmFsdWF0aW9uUmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC52YWx1ZSArIChlbGVtZW50IGluc3RhbmNlb2YgUmVwbE91dHB1dEVsZW1lbnQgJiYgZWxlbWVudC5jb3VudCA+IDEgPyBsb2NhbGl6ZSh7IGtleTogJ29jY3VycmVkJywgY29tbWVudDogWydGcm9udCB3aWxsIHRoZSB2YWx1ZSBvZiB0aGUgZGVidWcgY29uc29sZSBlbGVtZW50LiBQbGFjZWhvbGRlciB3aWxsIGJlIHJlcGxhY2VkIGJ5IGEgbnVtYmVyIHdoaWNoIHJlcHJlc2VudHMgb2NjdXJyYW5jZSBjb3VudC4nXSB9LFxuXHRcdFx0XHRcIiwgb2NjdXJyZWQgezB9IHRpbWVzXCIsIGVsZW1lbnQuY291bnQpIDogJycpO1xuXHRcdH1cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFJhd09iamVjdFJlcGxFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3JlcGxSYXdPYmplY3RBcmlhTGFiZWwnLCBcIkRlYnVnIGNvbnNvbGUgdmFyaWFibGUgezB9LCB2YWx1ZSB7MX1cIiwgZWxlbWVudC5uYW1lLCBlbGVtZW50LnZhbHVlKTtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZXBsR3JvdXApIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgncmVwbEdyb3VwJywgXCJEZWJ1ZyBjb25zb2xlIGdyb3VwIHswfVwiLCBlbGVtZW50Lm5hbWUpO1xuXHRcdH1cblxuXHRcdHJldHVybiAnJztcblx0fVxufVxuXG5jbGFzcyBTb3VyY2VXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBlbDogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgc291cmNlPzogSVJlcGxFbGVtZW50U291cmNlO1xuXHRwcml2YXRlIGhvdmVyPzogSU1hbmFnZWRIb3ZlcjtcblxuXHRjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmVsID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5zb3VyY2UnKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsLCAnY2xpY2snLCBlID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRpZiAodGhpcy5zb3VyY2UpIHtcblx0XHRcdFx0dGhpcy5zb3VyY2Uuc291cmNlLm9wZW5JbkVkaXRvcihlZGl0b3JTZXJ2aWNlLCB7XG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiB0aGlzLnNvdXJjZS5saW5lTnVtYmVyLFxuXHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiB0aGlzLnNvdXJjZS5jb2x1bW4sXG5cdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogdGhpcy5zb3VyY2UubGluZU51bWJlcixcblx0XHRcdFx0XHRlbmRDb2x1bW46IHRoaXMuc291cmNlLmNvbHVtblxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0fVxuXG5cdHB1YmxpYyBzZXRTb3VyY2Uoc291cmNlPzogSVJlcGxFbGVtZW50U291cmNlKSB7XG5cdFx0dGhpcy5zb3VyY2UgPSBzb3VyY2U7XG5cdFx0dGhpcy5lbC50ZXh0Q29udGVudCA9IHNvdXJjZSA/IGAke2Jhc2VuYW1lKHNvdXJjZS5zb3VyY2UubmFtZSl9OiR7c291cmNlLmxpbmVOdW1iZXJ9YCA6ICcnO1xuXG5cdFx0dGhpcy5ob3ZlciA/Pz0gdGhpcy5fcmVnaXN0ZXIodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIHRoaXMuZWwsICcnKSk7XG5cdFx0dGhpcy5ob3Zlci51cGRhdGUoc291cmNlID8gYCR7dGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoc291cmNlLnNvdXJjZS51cmkpfToke3NvdXJjZS5saW5lTnVtYmVyfWAgOiAnJyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsd0JBQW9DO0FBRTdDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsaUNBQWlDO0FBRzFDLFNBQVMscUJBQWlDO0FBQzFDLFNBQVMsWUFBWSx1QkFBb0M7QUFDekQsU0FBUyxnQkFBZ0I7QUFDekIsT0FB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
