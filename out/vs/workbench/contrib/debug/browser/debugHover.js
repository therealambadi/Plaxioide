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
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import * as lifecycle from "../../../../base/common/lifecycle.js";
import { clamp } from "../../../../base/common/numbers.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { ContentWidgetPositionPreference } from "../../../../editor/browser/editorBrowser.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ModelDecorationOptions } from "../../../../editor/common/model/textModel.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import * as nls from "../../../../nls.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { asCssVariable, editorHoverBackground, editorHoverBorder, editorHoverForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IDebugService } from "../common/debug.js";
import { Expression, Variable, VisualizedExpression } from "../common/debugModel.js";
import { getEvaluatableExpressionAtPosition } from "../common/debugUtils.js";
import { AbstractExpressionDataSource } from "./baseDebugView.js";
import { DebugExpressionRenderer } from "./debugExpressionRenderer.js";
import { VariablesRenderer, VisualizedVariableRenderer, openContextMenuForVariableTreeElement } from "./variablesView.js";
const $ = dom.$;
var ShowDebugHoverResult = /* @__PURE__ */ ((ShowDebugHoverResult2) => {
  ShowDebugHoverResult2[ShowDebugHoverResult2["NOT_CHANGED"] = 0] = "NOT_CHANGED";
  ShowDebugHoverResult2[ShowDebugHoverResult2["NOT_AVAILABLE"] = 1] = "NOT_AVAILABLE";
  ShowDebugHoverResult2[ShowDebugHoverResult2["CANCELLED"] = 2] = "CANCELLED";
  return ShowDebugHoverResult2;
})(ShowDebugHoverResult || {});
async function doFindExpression(container, namesToFind) {
  if (!container) {
    return null;
  }
  const children = await container.getChildren();
  const filtered = children.filter((v) => namesToFind[0] === v.name);
  if (filtered.length !== 1) {
    return null;
  }
  if (namesToFind.length === 1) {
    return filtered[0];
  } else {
    return doFindExpression(filtered[0], namesToFind.slice(1));
  }
}
async function findExpressionInStackFrame(stackFrame, namesToFind) {
  const scopes = await stackFrame.getScopes();
  const nonExpensive = scopes.filter((s) => !s.expensive);
  const expressions = coalesce(await Promise.all(nonExpensive.map((scope) => doFindExpression(scope, namesToFind))));
  return expressions.length > 0 && expressions.every((e) => e.value === expressions[0].value) ? expressions[0] : void 0;
}
let DebugHoverWidget = class {
  constructor(editor, debugService, instantiationService, menuService, contextKeyService, contextMenuService) {
    this.editor = editor;
    this.debugService = debugService;
    this.instantiationService = instantiationService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.contextMenuService = contextMenuService;
    // editor.IContentWidget.allowEditorOverflow
    this.allowEditorOverflow = true;
    this.isUpdatingTree = false;
    this.highlightDecorations = this.editor.createDecorationsCollection();
    this.toDispose = [];
    this.showAtPosition = null;
    this.positionPreference = [ContentWidgetPositionPreference.ABOVE, ContentWidgetPositionPreference.BELOW];
    this.debugHoverComputer = this.instantiationService.createInstance(DebugHoverComputer, this.editor);
    this.expressionRenderer = this.instantiationService.createInstance(DebugExpressionRenderer);
  }
  get isShowingComplexValue() {
    return this.complexValueContainer?.hidden === false;
  }
  create() {
    this.domNode = $(".debug-hover-widget");
    this.complexValueContainer = dom.append(this.domNode, $(".complex-value"));
    this.complexValueTitle = dom.append(this.complexValueContainer, $(".title"));
    this.treeContainer = dom.append(this.complexValueContainer, $(".debug-hover-tree"));
    this.treeContainer.setAttribute("role", "tree");
    const tip = dom.append(this.complexValueContainer, $(".tip"));
    tip.textContent = nls.localize({ key: "quickTip", comment: ['"switch to editor language hover" means to show the programming language hover widget instead of the debug hover'] }, "Hold {0} key to switch to editor language hover", isMacintosh ? "Option" : "Alt");
    const dataSource = this.instantiationService.createInstance(DebugHoverDataSource);
    this.tree = this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "DebugHover",
      this.treeContainer,
      new DebugHoverDelegate(),
      [
        this.instantiationService.createInstance(VariablesRenderer, this.expressionRenderer),
        this.instantiationService.createInstance(VisualizedVariableRenderer, this.expressionRenderer)
      ],
      dataSource,
      {
        accessibilityProvider: new DebugHoverAccessibilityProvider(),
        mouseSupport: false,
        horizontalScrolling: true,
        useShadows: false,
        keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (e) => e.name },
        overrideStyles: {
          listBackground: editorHoverBackground
        }
      }
    );
    this.toDispose.push(VisualizedVariableRenderer.rendererOnVisualizationRange(this.debugService.getViewModel(), this.tree));
    this.valueContainer = $(".value");
    this.valueContainer.tabIndex = 0;
    this.valueContainer.setAttribute("role", "tooltip");
    this.scrollbar = new DomScrollableElement(this.valueContainer, { horizontal: ScrollbarVisibility.Hidden });
    this.domNode.appendChild(this.scrollbar.getDomNode());
    this.toDispose.push(this.scrollbar);
    this.editor.applyFontInfo(this.domNode);
    this.domNode.style.backgroundColor = asCssVariable(editorHoverBackground);
    this.domNode.style.border = `1px solid ${asCssVariable(editorHoverBorder)}`;
    this.domNode.style.color = asCssVariable(editorHoverForeground);
    this.toDispose.push(this.tree.onContextMenu(async (e) => await this.onContextMenu(e)));
    this.toDispose.push(this.tree.onDidChangeContentHeight(() => {
      if (!this.isUpdatingTree) {
        this.layoutTreeAndContainer();
      }
    }));
    this.toDispose.push(this.tree.onDidChangeContentWidth(() => {
      if (!this.isUpdatingTree) {
        this.layoutTreeAndContainer();
      }
    }));
    this.registerListeners();
    this.editor.addContentWidget(this);
  }
  async onContextMenu(e) {
    const variable = e.element;
    if (!(variable instanceof Variable) || !variable.value) {
      return;
    }
    return openContextMenuForVariableTreeElement(this.contextKeyService, this.menuService, this.contextMenuService, MenuId.DebugHoverContext, e);
  }
  registerListeners() {
    this.toDispose.push(dom.addStandardDisposableListener(this.domNode, "keydown", (e) => {
      if (e.equals(KeyCode.Escape)) {
        this.hide();
      }
    }));
    this.toDispose.push(this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.fontInfo)) {
        this.editor.applyFontInfo(this.domNode);
      }
    }));
    this.toDispose.push(this.debugService.getViewModel().onDidEvaluateLazyExpression(async (e) => {
      if (e instanceof Variable && this.tree.hasNode(e)) {
        await this.tree.updateChildren(e, false, true);
        await this.tree.expand(e);
      }
    }));
  }
  isHovered() {
    return !!this.domNode?.matches(":hover");
  }
  isVisible() {
    return !!this._isVisible;
  }
  willBeVisible() {
    return !!this.showCancellationSource;
  }
  getId() {
    return DebugHoverWidget.ID;
  }
  getDomNode() {
    return this.domNode;
  }
  /**
   * Gets whether the given coordinates are in the safe triangle formed from
   * the position at which the hover was initiated.
   */
  isInSafeTriangle(x, y) {
    return this._isVisible && !!this.safeTriangle?.contains(x, y);
  }
  async showAt(position, focus, mouseEvent) {
    this.showCancellationSource?.dispose(true);
    const cancellationSource = this.showCancellationSource = new CancellationTokenSource();
    const session = this.debugService.getViewModel().focusedSession;
    if (!session || !this.editor.hasModel()) {
      this.hide();
      return 1 /* NOT_AVAILABLE */;
    }
    const result = await this.debugHoverComputer.compute(position, cancellationSource.token);
    if (cancellationSource.token.isCancellationRequested) {
      this.hide();
      return 2 /* CANCELLED */;
    }
    if (!result.range) {
      this.hide();
      return 1 /* NOT_AVAILABLE */;
    }
    if (this.isVisible() && !result.rangeChanged) {
      return 0 /* NOT_CHANGED */;
    }
    const expression = await this.debugHoverComputer.evaluate(session);
    if (cancellationSource.token.isCancellationRequested) {
      this.hide();
      return 2 /* CANCELLED */;
    }
    if (!expression || expression instanceof Expression && !expression.available) {
      this.hide();
      return 1 /* NOT_AVAILABLE */;
    }
    this.highlightDecorations.set([{
      range: result.range,
      options: DebugHoverWidget._HOVER_HIGHLIGHT_DECORATION_OPTIONS
    }]);
    return this.doShow(session, result.range.getStartPosition(), expression, focus, mouseEvent);
  }
  async doShow(session, position, expression, focus, mouseEvent) {
    if (!this.domNode) {
      this.create();
    }
    this.showAtPosition = position;
    const store = new lifecycle.DisposableStore();
    this._isVisible = { store };
    if (!expression.hasChildren) {
      this.complexValueContainer.hidden = true;
      this.valueContainer.hidden = false;
      store.add(this.expressionRenderer.renderValue(this.valueContainer, expression, {
        showChanged: false,
        colorize: true,
        hover: false,
        session
      }));
      this.valueContainer.title = "";
      this.editor.layoutContentWidget(this);
      this.safeTriangle = mouseEvent && new dom.SafeTriangle(mouseEvent.posx, mouseEvent.posy, this.domNode);
      this.scrollbar.scanDomNode();
      if (focus) {
        this.editor.render();
        this.valueContainer.focus();
      }
      return void 0;
    }
    this.valueContainer.hidden = true;
    this.expressionToRender = expression;
    store.add(this.expressionRenderer.renderValue(this.complexValueTitle, expression, { hover: false, session }));
    this.editor.layoutContentWidget(this);
    this.safeTriangle = mouseEvent && new dom.SafeTriangle(mouseEvent.posx, mouseEvent.posy, this.domNode);
    this.tree.scrollTop = 0;
    this.tree.scrollLeft = 0;
    this.complexValueContainer.hidden = false;
    if (focus) {
      this.editor.render();
      this.tree.domFocus();
    }
  }
  layoutTreeAndContainer() {
    this.layoutTree();
    this.editor.layoutContentWidget(this);
  }
  layoutTree() {
    const scrollBarHeight = 10;
    let maxHeightToAvoidCursorOverlay = Infinity;
    if (this.showAtPosition) {
      const editorTop = this.editor.getDomNode()?.offsetTop || 0;
      const containerTop = this.treeContainer.offsetTop + editorTop;
      const hoveredCharTop = this.editor.getTopForLineNumber(this.showAtPosition.lineNumber, true) - this.editor.getScrollTop();
      if (containerTop < hoveredCharTop) {
        maxHeightToAvoidCursorOverlay = hoveredCharTop + editorTop - 22;
      }
    }
    const treeHeight = Math.min(Math.max(266, this.editor.getLayoutInfo().height * 0.55), this.tree.contentHeight + scrollBarHeight, maxHeightToAvoidCursorOverlay);
    const realTreeWidth = this.tree.contentWidth;
    const treeWidth = clamp(realTreeWidth, 400, 550);
    this.tree.layout(treeHeight, treeWidth);
    this.treeContainer.style.height = `${treeHeight}px`;
    this.scrollbar.scanDomNode();
  }
  beforeRender() {
    if (this.expressionToRender) {
      const expression = this.expressionToRender;
      this.expressionToRender = void 0;
      this.isUpdatingTree = true;
      this.tree.setInput(expression).finally(() => {
        this.isUpdatingTree = false;
      });
    }
    return null;
  }
  afterRender(positionPreference) {
    if (positionPreference) {
      this.positionPreference = [positionPreference];
    }
  }
  hide() {
    if (this.showCancellationSource) {
      this.showCancellationSource.dispose(true);
      this.showCancellationSource = void 0;
    }
    if (!this._isVisible) {
      return;
    }
    if (dom.isAncestorOfActiveElement(this.domNode)) {
      this.editor.focus();
    }
    this._isVisible.store.dispose();
    this._isVisible = void 0;
    this.highlightDecorations.clear();
    this.editor.layoutContentWidget(this);
    this.positionPreference = [ContentWidgetPositionPreference.ABOVE, ContentWidgetPositionPreference.BELOW];
  }
  getPosition() {
    return this._isVisible ? {
      position: this.showAtPosition,
      preference: this.positionPreference
    } : null;
  }
  dispose() {
    this.toDispose = lifecycle.dispose(this.toDispose);
  }
};
DebugHoverWidget.ID = "debug.hoverWidget";
DebugHoverWidget._HOVER_HIGHLIGHT_DECORATION_OPTIONS = ModelDecorationOptions.register({
  description: "bdebug-hover-highlight",
  className: "hoverHighlight"
});
DebugHoverWidget = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMenuService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IContextMenuService)
], DebugHoverWidget);
class DebugHoverAccessibilityProvider {
  getWidgetAriaLabel() {
    return nls.localize("treeAriaLabel", "Debug Hover");
  }
  getAriaLabel(element) {
    return nls.localize({ key: "variableAriaLabel", comment: ["Do not translate placeholders. Placeholders are name and value of a variable."] }, "{0}, value {1}, variables, debug", element.name, element.value);
  }
}
class DebugHoverDataSource extends AbstractExpressionDataSource {
  hasChildren(element) {
    return element.hasChildren;
  }
  doGetChildren(element) {
    return element.getChildren();
  }
}
class DebugHoverDelegate {
  getHeight(element) {
    return 18;
  }
  getTemplateId(element) {
    if (element instanceof VisualizedExpression) {
      return VisualizedVariableRenderer.ID;
    }
    return VariablesRenderer.ID;
  }
}
let DebugHoverComputer = class {
  constructor(editor, debugService, languageFeaturesService, logService) {
    this.editor = editor;
    this.debugService = debugService;
    this.languageFeaturesService = languageFeaturesService;
    this.logService = logService;
  }
  async compute(position, token) {
    const session = this.debugService.getViewModel().focusedSession;
    if (!session || !this.editor.hasModel()) {
      return { rangeChanged: false };
    }
    const model = this.editor.getModel();
    const result = await getEvaluatableExpressionAtPosition(this.languageFeaturesService, model, position, token);
    if (!result) {
      return { rangeChanged: false };
    }
    const { range, matchingExpression } = result;
    const rangeChanged = !this._current?.range.equalsRange(range);
    this._current = { expression: matchingExpression, range: Range.lift(range) };
    return { rangeChanged, range: this._current.range };
  }
  async evaluate(session) {
    if (!this._current) {
      this.logService.error("No expression to evaluate");
      return;
    }
    const textModel = this.editor.getModel();
    const debugSource = textModel && session.getSourceForUri(textModel?.uri);
    if (session.capabilities.supportsEvaluateForHovers) {
      const expression = new Expression(this._current.expression);
      await expression.evaluate(session, this.debugService.getViewModel().focusedStackFrame, "hover", void 0, debugSource ? {
        line: this._current.range.startLineNumber,
        column: this._current.range.startColumn,
        source: debugSource.raw
      } : void 0);
      return expression;
    } else {
      const focusedStackFrame = this.debugService.getViewModel().focusedStackFrame;
      if (focusedStackFrame) {
        return await findExpressionInStackFrame(
          focusedStackFrame,
          coalesce(this._current.expression.split(".").map((word) => word.trim()))
        );
      }
    }
    return void 0;
  }
};
DebugHoverComputer = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, ILanguageFeaturesService),
  __decorateParam(3, ILogService)
], DebugHoverComputer);
export {
  DebugHoverWidget,
  ShowDebugHoverResult,
  findExpressionInStackFrame
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnSG92ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IElNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBEb21TY3JvbGxhYmxlRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zY3JvbGxiYXIvc2Nyb2xsYWJsZUVsZW1lbnQuanMnO1xuaW1wb3J0IHsgQXN5bmNEYXRhVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2FzeW5jRGF0YVRyZWUuanMnO1xuaW1wb3J0IHsgSVRyZWVDb250ZXh0TWVudUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCAqIGFzIGxpZmVjeWNsZSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgU2Nyb2xsYmFyVmlzaWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Njcm9sbGFibGUuanMnO1xuaW1wb3J0IHsgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSwgSUNvZGVFZGl0b3IsIElDb250ZW50V2lkZ2V0LCBJQ29udGVudFdpZGdldFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uQ2hhbmdlZEV2ZW50LCBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElEaW1lbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvZGltZW5zaW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hBc3luY0RhdGFUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZSwgZWRpdG9ySG92ZXJCYWNrZ3JvdW5kLCBlZGl0b3JIb3ZlckJvcmRlciwgZWRpdG9ySG92ZXJGb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSURlYnVnU2VydmljZSwgSURlYnVnU2Vzc2lvbiwgSUV4cHJlc3Npb24sIElFeHByZXNzaW9uQ29udGFpbmVyLCBJU3RhY2tGcmFtZSB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBFeHByZXNzaW9uLCBWYXJpYWJsZSwgVmlzdWFsaXplZEV4cHJlc3Npb24gfSBmcm9tICcuLi9jb21tb24vZGVidWdNb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXRFdmFsdWF0YWJsZUV4cHJlc3Npb25BdFBvc2l0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnVXRpbHMuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RFeHByZXNzaW9uRGF0YVNvdXJjZSB9IGZyb20gJy4vYmFzZURlYnVnVmlldy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlciB9IGZyb20gJy4vZGVidWdFeHByZXNzaW9uUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgVmFyaWFibGVzUmVuZGVyZXIsIFZpc3VhbGl6ZWRWYXJpYWJsZVJlbmRlcmVyLCBvcGVuQ29udGV4dE1lbnVGb3JWYXJpYWJsZVRyZWVFbGVtZW50IH0gZnJvbSAnLi92YXJpYWJsZXNWaWV3LmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5leHBvcnQgY29uc3QgZW51bSBTaG93RGVidWdIb3ZlclJlc3VsdCB7XG5cdE5PVF9DSEFOR0VELFxuXHROT1RfQVZBSUxBQkxFLFxuXHRDQU5DRUxMRUQsXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRvRmluZEV4cHJlc3Npb24oY29udGFpbmVyOiBJRXhwcmVzc2lvbkNvbnRhaW5lciwgbmFtZXNUb0ZpbmQ6IHN0cmluZ1tdKTogUHJvbWlzZTxJRXhwcmVzc2lvbiB8IG51bGw+IHtcblx0aWYgKCFjb250YWluZXIpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IGNoaWxkcmVuID0gYXdhaXQgY29udGFpbmVyLmdldENoaWxkcmVuKCk7XG5cdC8vIGxvb2sgZm9yIG91ciB2YXJpYWJsZSBpbiB0aGUgbGlzdC4gRmlyc3QgZmluZCB0aGUgcGFyZW50cyBvZiB0aGUgaG92ZXJlZCB2YXJpYWJsZSBpZiB0aGVyZSBhcmUgYW55LlxuXHRjb25zdCBmaWx0ZXJlZCA9IGNoaWxkcmVuLmZpbHRlcih2ID0+IG5hbWVzVG9GaW5kWzBdID09PSB2Lm5hbWUpO1xuXHRpZiAoZmlsdGVyZWQubGVuZ3RoICE9PSAxKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRpZiAobmFtZXNUb0ZpbmQubGVuZ3RoID09PSAxKSB7XG5cdFx0cmV0dXJuIGZpbHRlcmVkWzBdO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBkb0ZpbmRFeHByZXNzaW9uKGZpbHRlcmVkWzBdLCBuYW1lc1RvRmluZC5zbGljZSgxKSk7XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRFeHByZXNzaW9uSW5TdGFja0ZyYW1lKHN0YWNrRnJhbWU6IElTdGFja0ZyYW1lLCBuYW1lc1RvRmluZDogc3RyaW5nW10pOiBQcm9taXNlPElFeHByZXNzaW9uIHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0IHNjb3BlcyA9IGF3YWl0IHN0YWNrRnJhbWUuZ2V0U2NvcGVzKCk7XG5cdGNvbnN0IG5vbkV4cGVuc2l2ZSA9IHNjb3Blcy5maWx0ZXIocyA9PiAhcy5leHBlbnNpdmUpO1xuXHRjb25zdCBleHByZXNzaW9ucyA9IGNvYWxlc2NlKGF3YWl0IFByb21pc2UuYWxsKG5vbkV4cGVuc2l2ZS5tYXAoc2NvcGUgPT4gZG9GaW5kRXhwcmVzc2lvbihzY29wZSwgbmFtZXNUb0ZpbmQpKSkpO1xuXG5cdC8vIG9ubHkgc2hvdyBpZiBhbGwgZXhwcmVzc2lvbnMgZm91bmQgaGF2ZSB0aGUgc2FtZSB2YWx1ZVxuXHRyZXR1cm4gZXhwcmVzc2lvbnMubGVuZ3RoID4gMCAmJiBleHByZXNzaW9ucy5ldmVyeShlID0+IGUudmFsdWUgPT09IGV4cHJlc3Npb25zWzBdLnZhbHVlKSA/IGV4cHJlc3Npb25zWzBdIDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY2xhc3MgRGVidWdIb3ZlcldpZGdldCBpbXBsZW1lbnRzIElDb250ZW50V2lkZ2V0IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZGVidWcuaG92ZXJXaWRnZXQnO1xuXHQvLyBlZGl0b3IuSUNvbnRlbnRXaWRnZXQuYWxsb3dFZGl0b3JPdmVyZmxvd1xuXHRyZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93ID0gdHJ1ZTtcblxuXHQvLyB0b2RvQGNvbm5vcjQzMTI6IG1vdmUgbW9yZSBwcm9wZXJ0aWVzIHRoYXQgYXJlIG9ubHkgdmFsaWQgd2hpbGUgYSBob3ZlclxuXHQvLyBpcyBoYXBwZW5pbmcgaW50byBgX2lzVmlzaWJsZWBcblx0cHJpdmF0ZSBfaXNWaXNpYmxlPzoge1xuXHRcdHN0b3JlOiBsaWZlY3ljbGUuRGlzcG9zYWJsZVN0b3JlO1xuXHR9O1xuXHRwcml2YXRlIHNhZmVUcmlhbmdsZT86IGRvbS5TYWZlVHJpYW5nbGU7XG5cdHByaXZhdGUgc2hvd0NhbmNlbGxhdGlvblNvdXJjZT86IENhbmNlbGxhdGlvblRva2VuU291cmNlO1xuXHRwcml2YXRlIGRvbU5vZGUhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0cmVlITogQXN5bmNEYXRhVHJlZTxJRXhwcmVzc2lvbiwgSUV4cHJlc3Npb24sIGFueT47XG5cdHByaXZhdGUgc2hvd0F0UG9zaXRpb246IFBvc2l0aW9uIHwgbnVsbDtcblx0cHJpdmF0ZSBwb3NpdGlvblByZWZlcmVuY2U6IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2VbXTtcblx0cHJpdmF0ZSByZWFkb25seSBoaWdobGlnaHREZWNvcmF0aW9uczogSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbjtcblx0cHJpdmF0ZSBjb21wbGV4VmFsdWVDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBjb21wbGV4VmFsdWVUaXRsZSE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHZhbHVlQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgdHJlZUNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRvRGlzcG9zZTogbGlmZWN5Y2xlLklEaXNwb3NhYmxlW107XG5cdHByaXZhdGUgc2Nyb2xsYmFyITogRG9tU2Nyb2xsYWJsZUVsZW1lbnQ7XG5cdHByaXZhdGUgZGVidWdIb3ZlckNvbXB1dGVyOiBEZWJ1Z0hvdmVyQ29tcHV0ZXI7XG5cdHByaXZhdGUgZXhwcmVzc2lvblJlbmRlcmVyOiBEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlcjtcblxuXHRwcml2YXRlIGV4cHJlc3Npb25Ub1JlbmRlcjogSUV4cHJlc3Npb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgaXNVcGRhdGluZ1RyZWUgPSBmYWxzZTtcblxuXHRwdWJsaWMgZ2V0IGlzU2hvd2luZ0NvbXBsZXhWYWx1ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5jb21wbGV4VmFsdWVDb250YWluZXI/LmhpZGRlbiA9PT0gZmFsc2U7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuaGlnaGxpZ2h0RGVjb3JhdGlvbnMgPSB0aGlzLmVkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0XHR0aGlzLnRvRGlzcG9zZSA9IFtdO1xuXG5cdFx0dGhpcy5zaG93QXRQb3NpdGlvbiA9IG51bGw7XG5cdFx0dGhpcy5wb3NpdGlvblByZWZlcmVuY2UgPSBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5BQk9WRSwgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5CRUxPV107XG5cdFx0dGhpcy5kZWJ1Z0hvdmVyQ29tcHV0ZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlYnVnSG92ZXJDb21wdXRlciwgdGhpcy5lZGl0b3IpO1xuXHRcdHRoaXMuZXhwcmVzc2lvblJlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWJ1Z0V4cHJlc3Npb25SZW5kZXJlcik7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRvbU5vZGUgPSAkKCcuZGVidWctaG92ZXItd2lkZ2V0Jyk7XG5cdFx0dGhpcy5jb21wbGV4VmFsdWVDb250YWluZXIgPSBkb20uYXBwZW5kKHRoaXMuZG9tTm9kZSwgJCgnLmNvbXBsZXgtdmFsdWUnKSk7XG5cdFx0dGhpcy5jb21wbGV4VmFsdWVUaXRsZSA9IGRvbS5hcHBlbmQodGhpcy5jb21wbGV4VmFsdWVDb250YWluZXIsICQoJy50aXRsZScpKTtcblx0XHR0aGlzLnRyZWVDb250YWluZXIgPSBkb20uYXBwZW5kKHRoaXMuY29tcGxleFZhbHVlQ29udGFpbmVyLCAkKCcuZGVidWctaG92ZXItdHJlZScpKTtcblx0XHR0aGlzLnRyZWVDb250YWluZXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3RyZWUnKTtcblx0XHRjb25zdCB0aXAgPSBkb20uYXBwZW5kKHRoaXMuY29tcGxleFZhbHVlQ29udGFpbmVyLCAkKCcudGlwJykpO1xuXHRcdHRpcC50ZXh0Q29udGVudCA9IG5scy5sb2NhbGl6ZSh7IGtleTogJ3F1aWNrVGlwJywgY29tbWVudDogWydcInN3aXRjaCB0byBlZGl0b3IgbGFuZ3VhZ2UgaG92ZXJcIiBtZWFucyB0byBzaG93IHRoZSBwcm9ncmFtbWluZyBsYW5ndWFnZSBob3ZlciB3aWRnZXQgaW5zdGVhZCBvZiB0aGUgZGVidWcgaG92ZXInXSB9LCAnSG9sZCB7MH0ga2V5IHRvIHN3aXRjaCB0byBlZGl0b3IgbGFuZ3VhZ2UgaG92ZXInLCBpc01hY2ludG9zaCA/ICdPcHRpb24nIDogJ0FsdCcpO1xuXHRcdGNvbnN0IGRhdGFTb3VyY2UgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlYnVnSG92ZXJEYXRhU291cmNlKTtcblx0XHR0aGlzLnRyZWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaEFzeW5jRGF0YVRyZWU8SUV4cHJlc3Npb24sIElFeHByZXNzaW9uLCBhbnk+LCAnRGVidWdIb3ZlcicsIHRoaXMudHJlZUNvbnRhaW5lciwgbmV3IERlYnVnSG92ZXJEZWxlZ2F0ZSgpLCBbXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZhcmlhYmxlc1JlbmRlcmVyLCB0aGlzLmV4cHJlc3Npb25SZW5kZXJlciksXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZpc3VhbGl6ZWRWYXJpYWJsZVJlbmRlcmVyLCB0aGlzLmV4cHJlc3Npb25SZW5kZXJlciksXG5cdFx0XSxcblx0XHRcdGRhdGFTb3VyY2UsIHtcblx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IERlYnVnSG92ZXJBY2Nlc3NpYmlsaXR5UHJvdmlkZXIoKSxcblx0XHRcdG1vdXNlU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nOiB0cnVlLFxuXHRcdFx0dXNlU2hhZG93czogZmFsc2UsXG5cdFx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiB7IGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsOiAoZTogSUV4cHJlc3Npb24pID0+IGUubmFtZSB9LFxuXHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHtcblx0XHRcdFx0bGlzdEJhY2tncm91bmQ6IGVkaXRvckhvdmVyQmFja2dyb3VuZFxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChWaXN1YWxpemVkVmFyaWFibGVSZW5kZXJlci5yZW5kZXJlck9uVmlzdWFsaXphdGlvblJhbmdlKHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLCB0aGlzLnRyZWUpKTtcblxuXHRcdHRoaXMudmFsdWVDb250YWluZXIgPSAkKCcudmFsdWUnKTtcblx0XHR0aGlzLnZhbHVlQ29udGFpbmVyLnRhYkluZGV4ID0gMDtcblx0XHR0aGlzLnZhbHVlQ29udGFpbmVyLnNldEF0dHJpYnV0ZSgncm9sZScsICd0b29sdGlwJyk7XG5cdFx0dGhpcy5zY3JvbGxiYXIgPSBuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQodGhpcy52YWx1ZUNvbnRhaW5lciwgeyBob3Jpem9udGFsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkhpZGRlbiB9KTtcblx0XHR0aGlzLmRvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5zY3JvbGxiYXIuZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuc2Nyb2xsYmFyKTtcblxuXHRcdHRoaXMuZWRpdG9yLmFwcGx5Rm9udEluZm8odGhpcy5kb21Ob2RlKTtcblx0XHR0aGlzLmRvbU5vZGUuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYXNDc3NWYXJpYWJsZShlZGl0b3JIb3ZlckJhY2tncm91bmQpO1xuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5ib3JkZXIgPSBgMXB4IHNvbGlkICR7YXNDc3NWYXJpYWJsZShlZGl0b3JIb3ZlckJvcmRlcil9YDtcblx0XHR0aGlzLmRvbU5vZGUuc3R5bGUuY29sb3IgPSBhc0Nzc1ZhcmlhYmxlKGVkaXRvckhvdmVyRm9yZWdyb3VuZCk7XG5cblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMudHJlZS5vbkNvbnRleHRNZW51KGFzeW5jIGUgPT4gYXdhaXQgdGhpcy5vbkNvbnRleHRNZW51KGUpKSk7XG5cblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMudHJlZS5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLmlzVXBkYXRpbmdUcmVlKSB7XG5cdFx0XHRcdC8vIERvbid0IGRvIGEgbGF5b3V0IGluIHRoZSBtaWRkbGUgb2YgdGhlIGFzeW5jIHNldElucHV0XG5cdFx0XHRcdHRoaXMubGF5b3V0VHJlZUFuZENvbnRhaW5lcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMudHJlZS5vbkRpZENoYW5nZUNvbnRlbnRXaWR0aCgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuaXNVcGRhdGluZ1RyZWUpIHtcblx0XHRcdFx0Ly8gRG9uJ3QgZG8gYSBsYXlvdXQgaW4gdGhlIG1pZGRsZSBvZiB0aGUgYXN5bmMgc2V0SW5wdXRcblx0XHRcdFx0dGhpcy5sYXlvdXRUcmVlQW5kQ29udGFpbmVyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHRcdHRoaXMuZWRpdG9yLmFkZENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uQ29udGV4dE1lbnUoZTogSVRyZWVDb250ZXh0TWVudUV2ZW50PElFeHByZXNzaW9uPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZhcmlhYmxlID0gZS5lbGVtZW50O1xuXHRcdGlmICghKHZhcmlhYmxlIGluc3RhbmNlb2YgVmFyaWFibGUpIHx8ICF2YXJpYWJsZS52YWx1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiBvcGVuQ29udGV4dE1lbnVGb3JWYXJpYWJsZVRyZWVFbGVtZW50KHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHRoaXMubWVudVNlcnZpY2UsIHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLCBNZW51SWQuRGVidWdIb3ZlckNvbnRleHQsIGUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUsICdrZXlkb3duJywgKGU6IElLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHRcdHRoaXMuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZTogQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24uZm9udEluZm8pKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yLmFwcGx5Rm9udEluZm8odGhpcy5kb21Ob2RlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLm9uRGlkRXZhbHVhdGVMYXp5RXhwcmVzc2lvbihhc3luYyBlID0+IHtcblx0XHRcdGlmIChlIGluc3RhbmNlb2YgVmFyaWFibGUgJiYgdGhpcy50cmVlLmhhc05vZGUoZSkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy50cmVlLnVwZGF0ZUNoaWxkcmVuKGUsIGZhbHNlLCB0cnVlKTtcblx0XHRcdFx0YXdhaXQgdGhpcy50cmVlLmV4cGFuZChlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRpc0hvdmVyZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5kb21Ob2RlPy5tYXRjaGVzKCc6aG92ZXInKTtcblx0fVxuXG5cdGlzVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLl9pc1Zpc2libGU7XG5cdH1cblxuXHR3aWxsQmVWaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuc2hvd0NhbmNlbGxhdGlvblNvdXJjZTtcblx0fVxuXG5cdGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIERlYnVnSG92ZXJXaWRnZXQuSUQ7XG5cdH1cblxuXHRnZXREb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5kb21Ob2RlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgd2hldGhlciB0aGUgZ2l2ZW4gY29vcmRpbmF0ZXMgYXJlIGluIHRoZSBzYWZlIHRyaWFuZ2xlIGZvcm1lZCBmcm9tXG5cdCAqIHRoZSBwb3NpdGlvbiBhdCB3aGljaCB0aGUgaG92ZXIgd2FzIGluaXRpYXRlZC5cblx0ICovXG5cdGlzSW5TYWZlVHJpYW5nbGUoeDogbnVtYmVyLCB5OiBudW1iZXIpIHtcblx0XHRyZXR1cm4gdGhpcy5faXNWaXNpYmxlICYmICEhdGhpcy5zYWZlVHJpYW5nbGU/LmNvbnRhaW5zKHgsIHkpO1xuXHR9XG5cblx0YXN5bmMgc2hvd0F0KHBvc2l0aW9uOiBQb3NpdGlvbiwgZm9jdXM6IGJvb2xlYW4sIG1vdXNlRXZlbnQ/OiBJTW91c2VFdmVudCk6IFByb21pc2U8dm9pZCB8IFNob3dEZWJ1Z0hvdmVyUmVzdWx0PiB7XG5cdFx0dGhpcy5zaG93Q2FuY2VsbGF0aW9uU291cmNlPy5kaXNwb3NlKHRydWUpO1xuXHRcdGNvbnN0IGNhbmNlbGxhdGlvblNvdXJjZSA9IHRoaXMuc2hvd0NhbmNlbGxhdGlvblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblxuXHRcdGlmICghc2Vzc2lvbiB8fCAhdGhpcy5lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHRyZXR1cm4gU2hvd0RlYnVnSG92ZXJSZXN1bHQuTk9UX0FWQUlMQUJMRTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmRlYnVnSG92ZXJDb21wdXRlci5jb21wdXRlKHBvc2l0aW9uLCBjYW5jZWxsYXRpb25Tb3VyY2UudG9rZW4pO1xuXHRcdGlmIChjYW5jZWxsYXRpb25Tb3VyY2UudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHRoaXMuaGlkZSgpO1xuXHRcdFx0cmV0dXJuIFNob3dEZWJ1Z0hvdmVyUmVzdWx0LkNBTkNFTExFRDtcblx0XHR9XG5cblx0XHRpZiAoIXJlc3VsdC5yYW5nZSkge1xuXHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHRyZXR1cm4gU2hvd0RlYnVnSG92ZXJSZXN1bHQuTk9UX0FWQUlMQUJMRTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSAmJiAhcmVzdWx0LnJhbmdlQ2hhbmdlZCkge1xuXHRcdFx0cmV0dXJuIFNob3dEZWJ1Z0hvdmVyUmVzdWx0Lk5PVF9DSEFOR0VEO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4cHJlc3Npb24gPSBhd2FpdCB0aGlzLmRlYnVnSG92ZXJDb21wdXRlci5ldmFsdWF0ZShzZXNzaW9uKTtcblx0XHRpZiAoY2FuY2VsbGF0aW9uU291cmNlLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblx0XHRcdHJldHVybiBTaG93RGVidWdIb3ZlclJlc3VsdC5DQU5DRUxMRUQ7XG5cdFx0fVxuXG5cdFx0aWYgKCFleHByZXNzaW9uIHx8IChleHByZXNzaW9uIGluc3RhbmNlb2YgRXhwcmVzc2lvbiAmJiAhZXhwcmVzc2lvbi5hdmFpbGFibGUpKSB7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblx0XHRcdHJldHVybiBTaG93RGVidWdIb3ZlclJlc3VsdC5OT1RfQVZBSUxBQkxFO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlnaGxpZ2h0RGVjb3JhdGlvbnMuc2V0KFt7XG5cdFx0XHRyYW5nZTogcmVzdWx0LnJhbmdlLFxuXHRcdFx0b3B0aW9uczogRGVidWdIb3ZlcldpZGdldC5fSE9WRVJfSElHSExJR0hUX0RFQ09SQVRJT05fT1BUSU9OU1xuXHRcdH1dKTtcblxuXHRcdHJldHVybiB0aGlzLmRvU2hvdyhzZXNzaW9uLCByZXN1bHQucmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpLCBleHByZXNzaW9uLCBmb2N1cywgbW91c2VFdmVudCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfSE9WRVJfSElHSExJR0hUX0RFQ09SQVRJT05fT1BUSU9OUyA9IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMucmVnaXN0ZXIoe1xuXHRcdGRlc2NyaXB0aW9uOiAnYmRlYnVnLWhvdmVyLWhpZ2hsaWdodCcsXG5cdFx0Y2xhc3NOYW1lOiAnaG92ZXJIaWdobGlnaHQnXG5cdH0pO1xuXG5cdHByaXZhdGUgYXN5bmMgZG9TaG93KHNlc3Npb246IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQsIHBvc2l0aW9uOiBQb3NpdGlvbiwgZXhwcmVzc2lvbjogSUV4cHJlc3Npb24sIGZvY3VzOiBib29sZWFuLCBtb3VzZUV2ZW50OiBJTW91c2VFdmVudCB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5kb21Ob2RlKSB7XG5cdFx0XHR0aGlzLmNyZWF0ZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuc2hvd0F0UG9zaXRpb24gPSBwb3NpdGlvbjtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBsaWZlY3ljbGUuRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5faXNWaXNpYmxlID0geyBzdG9yZSB9O1xuXG5cdFx0aWYgKCFleHByZXNzaW9uLmhhc0NoaWxkcmVuKSB7XG5cdFx0XHR0aGlzLmNvbXBsZXhWYWx1ZUNvbnRhaW5lci5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0dGhpcy52YWx1ZUNvbnRhaW5lci5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdHN0b3JlLmFkZCh0aGlzLmV4cHJlc3Npb25SZW5kZXJlci5yZW5kZXJWYWx1ZSh0aGlzLnZhbHVlQ29udGFpbmVyLCBleHByZXNzaW9uLCB7XG5cdFx0XHRcdHNob3dDaGFuZ2VkOiBmYWxzZSxcblx0XHRcdFx0Y29sb3JpemU6IHRydWUsXG5cdFx0XHRcdGhvdmVyOiBmYWxzZSxcblx0XHRcdFx0c2Vzc2lvbixcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMudmFsdWVDb250YWluZXIudGl0bGUgPSAnJztcblx0XHRcdHRoaXMuZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0XHR0aGlzLnNhZmVUcmlhbmdsZSA9IG1vdXNlRXZlbnQgJiYgbmV3IGRvbS5TYWZlVHJpYW5nbGUobW91c2VFdmVudC5wb3N4LCBtb3VzZUV2ZW50LnBvc3ksIHRoaXMuZG9tTm9kZSk7XG5cdFx0XHR0aGlzLnNjcm9sbGJhci5zY2FuRG9tTm9kZSgpO1xuXHRcdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yLnJlbmRlcigpO1xuXHRcdFx0XHR0aGlzLnZhbHVlQ29udGFpbmVyLmZvY3VzKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy52YWx1ZUNvbnRhaW5lci5oaWRkZW4gPSB0cnVlO1xuXG5cdFx0dGhpcy5leHByZXNzaW9uVG9SZW5kZXIgPSBleHByZXNzaW9uO1xuXHRcdHN0b3JlLmFkZCh0aGlzLmV4cHJlc3Npb25SZW5kZXJlci5yZW5kZXJWYWx1ZSh0aGlzLmNvbXBsZXhWYWx1ZVRpdGxlLCBleHByZXNzaW9uLCB7IGhvdmVyOiBmYWxzZSwgc2Vzc2lvbiB9KSk7XG5cdFx0dGhpcy5lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblx0XHR0aGlzLnNhZmVUcmlhbmdsZSA9IG1vdXNlRXZlbnQgJiYgbmV3IGRvbS5TYWZlVHJpYW5nbGUobW91c2VFdmVudC5wb3N4LCBtb3VzZUV2ZW50LnBvc3ksIHRoaXMuZG9tTm9kZSk7XG5cdFx0dGhpcy50cmVlLnNjcm9sbFRvcCA9IDA7XG5cdFx0dGhpcy50cmVlLnNjcm9sbExlZnQgPSAwO1xuXHRcdHRoaXMuY29tcGxleFZhbHVlQ29udGFpbmVyLmhpZGRlbiA9IGZhbHNlO1xuXG5cdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHR0aGlzLmVkaXRvci5yZW5kZXIoKTtcblx0XHRcdHRoaXMudHJlZS5kb21Gb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0VHJlZUFuZENvbnRhaW5lcigpOiB2b2lkIHtcblx0XHR0aGlzLmxheW91dFRyZWUoKTtcblx0XHR0aGlzLmVkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBsYXlvdXRUcmVlKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNjcm9sbEJhckhlaWdodCA9IDEwO1xuXHRcdGxldCBtYXhIZWlnaHRUb0F2b2lkQ3Vyc29yT3ZlcmxheSA9IEluZmluaXR5O1xuXHRcdGlmICh0aGlzLnNob3dBdFBvc2l0aW9uKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JUb3AgPSB0aGlzLmVkaXRvci5nZXREb21Ob2RlKCk/Lm9mZnNldFRvcCB8fCAwO1xuXHRcdFx0Y29uc3QgY29udGFpbmVyVG9wID0gdGhpcy50cmVlQ29udGFpbmVyLm9mZnNldFRvcCArIGVkaXRvclRvcDtcblx0XHRcdGNvbnN0IGhvdmVyZWRDaGFyVG9wID0gdGhpcy5lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcih0aGlzLnNob3dBdFBvc2l0aW9uLmxpbmVOdW1iZXIsIHRydWUpIC0gdGhpcy5lZGl0b3IuZ2V0U2Nyb2xsVG9wKCk7XG5cdFx0XHRpZiAoY29udGFpbmVyVG9wIDwgaG92ZXJlZENoYXJUb3ApIHtcblx0XHRcdFx0bWF4SGVpZ2h0VG9Bdm9pZEN1cnNvck92ZXJsYXkgPSBob3ZlcmVkQ2hhclRvcCArIGVkaXRvclRvcCAtIDIyOyAvLyAyMiBpcyBtb25hY28gdG9wIHBhZGRpbmcgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi9hMWRmMmQ3MzE5MzgyZDQyZjY2YWQ3ZjQxMWFmMDFlNGNjNDljODBhL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3UGFydHMvY29udGVudFdpZGdldHMvY29udGVudFdpZGdldHMudHMjTDM2NFxuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCB0cmVlSGVpZ2h0ID0gTWF0aC5taW4oTWF0aC5tYXgoMjY2LCB0aGlzLmVkaXRvci5nZXRMYXlvdXRJbmZvKCkuaGVpZ2h0ICogMC41NSksIHRoaXMudHJlZS5jb250ZW50SGVpZ2h0ICsgc2Nyb2xsQmFySGVpZ2h0LCBtYXhIZWlnaHRUb0F2b2lkQ3Vyc29yT3ZlcmxheSk7XG5cblx0XHRjb25zdCByZWFsVHJlZVdpZHRoID0gdGhpcy50cmVlLmNvbnRlbnRXaWR0aDtcblx0XHRjb25zdCB0cmVlV2lkdGggPSBjbGFtcChyZWFsVHJlZVdpZHRoLCA0MDAsIDU1MCk7XG5cdFx0dGhpcy50cmVlLmxheW91dCh0cmVlSGVpZ2h0LCB0cmVlV2lkdGgpO1xuXHRcdHRoaXMudHJlZUNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0cmVlSGVpZ2h0fXB4YDtcblx0XHR0aGlzLnNjcm9sbGJhci5zY2FuRG9tTm9kZSgpO1xuXHR9XG5cblx0YmVmb3JlUmVuZGVyKCk6IElEaW1lbnNpb24gfCBudWxsIHtcblx0XHQvLyBiZWZvcmVSZW5kZXIgd2lsbCBiZSBjYWxsZWQgZWFjaCB0aW1lIHRoZSBob3ZlciBzaXplIGNoYW5nZXMsIGFuZCB0aGUgY29udGVudCB3aWRnZXQgaXMgbGF5ZWQgb3V0IGFnYWluLlxuXHRcdGlmICh0aGlzLmV4cHJlc3Npb25Ub1JlbmRlcikge1xuXHRcdFx0Y29uc3QgZXhwcmVzc2lvbiA9IHRoaXMuZXhwcmVzc2lvblRvUmVuZGVyO1xuXHRcdFx0dGhpcy5leHByZXNzaW9uVG9SZW5kZXIgPSB1bmRlZmluZWQ7XG5cblx0XHRcdC8vIERvIHRoaXMgaW4gYmVmb3JlUmVuZGVyIG9uY2UgdGhlIGNvbnRlbnQgd2lkZ2V0IGlzIG5vIGxvbmdlciBkaXNwbGF5PW5vbmUgc28gdGhhdCBpdHMgZWxlbWVudHMnIHNpemVzIHdpbGwgYmUgbWVhc3VyZWQgY29ycmVjdGx5LlxuXHRcdFx0dGhpcy5pc1VwZGF0aW5nVHJlZSA9IHRydWU7XG5cdFx0XHR0aGlzLnRyZWUuc2V0SW5wdXQoZXhwcmVzc2lvbikuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuaXNVcGRhdGluZ1RyZWUgPSBmYWxzZTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0YWZ0ZXJSZW5kZXIocG9zaXRpb25QcmVmZXJlbmNlOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlIHwgbnVsbCkge1xuXHRcdGlmIChwb3NpdGlvblByZWZlcmVuY2UpIHtcblx0XHRcdC8vIFJlbWVtYmVyIHdoZXJlIHRoZSBlZGl0b3IgcGxhY2VkIHlvdSB0byBrZWVwIHBvc2l0aW9uIHN0YWJsZSAjMTA5MjI2XG5cdFx0XHR0aGlzLnBvc2l0aW9uUHJlZmVyZW5jZSA9IFtwb3NpdGlvblByZWZlcmVuY2VdO1xuXHRcdH1cblx0fVxuXG5cblx0aGlkZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zaG93Q2FuY2VsbGF0aW9uU291cmNlKSB7XG5cdFx0XHR0aGlzLnNob3dDYW5jZWxsYXRpb25Tb3VyY2UuZGlzcG9zZSh0cnVlKTtcblx0XHRcdHRoaXMuc2hvd0NhbmNlbGxhdGlvblNvdXJjZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChkb20uaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudCh0aGlzLmRvbU5vZGUpKSB7XG5cdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdH1cblx0XHR0aGlzLl9pc1Zpc2libGUuc3RvcmUuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2lzVmlzaWJsZSA9IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuaGlnaGxpZ2h0RGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHR0aGlzLmVkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHRcdHRoaXMucG9zaXRpb25QcmVmZXJlbmNlID0gW0NvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQUJPVkUsIENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQkVMT1ddO1xuXHR9XG5cblx0Z2V0UG9zaXRpb24oKTogSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9pc1Zpc2libGUgPyB7XG5cdFx0XHRwb3NpdGlvbjogdGhpcy5zaG93QXRQb3NpdGlvbixcblx0XHRcdHByZWZlcmVuY2U6IHRoaXMucG9zaXRpb25QcmVmZXJlbmNlXG5cdFx0fSA6IG51bGw7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMudG9EaXNwb3NlID0gbGlmZWN5Y2xlLmRpc3Bvc2UodGhpcy50b0Rpc3Bvc2UpO1xuXHR9XG59XG5cbmNsYXNzIERlYnVnSG92ZXJBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgaW1wbGVtZW50cyBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlcjxJRXhwcmVzc2lvbj4ge1xuXG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBubHMubG9jYWxpemUoJ3RyZWVBcmlhTGFiZWwnLCBcIkRlYnVnIEhvdmVyXCIpO1xuXHR9XG5cblx0Z2V0QXJpYUxhYmVsKGVsZW1lbnQ6IElFeHByZXNzaW9uKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKHsga2V5OiAndmFyaWFibGVBcmlhTGFiZWwnLCBjb21tZW50OiBbJ0RvIG5vdCB0cmFuc2xhdGUgcGxhY2Vob2xkZXJzLiBQbGFjZWhvbGRlcnMgYXJlIG5hbWUgYW5kIHZhbHVlIG9mIGEgdmFyaWFibGUuJ10gfSwgXCJ7MH0sIHZhbHVlIHsxfSwgdmFyaWFibGVzLCBkZWJ1Z1wiLCBlbGVtZW50Lm5hbWUsIGVsZW1lbnQudmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIERlYnVnSG92ZXJEYXRhU291cmNlIGV4dGVuZHMgQWJzdHJhY3RFeHByZXNzaW9uRGF0YVNvdXJjZTxJRXhwcmVzc2lvbiwgSUV4cHJlc3Npb24+IHtcblxuXHRwdWJsaWMgb3ZlcnJpZGUgaGFzQ2hpbGRyZW4oZWxlbWVudDogSUV4cHJlc3Npb24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZWxlbWVudC5oYXNDaGlsZHJlbjtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBkb0dldENoaWxkcmVuKGVsZW1lbnQ6IElFeHByZXNzaW9uKTogUHJvbWlzZTxJRXhwcmVzc2lvbltdPiB7XG5cdFx0cmV0dXJuIGVsZW1lbnQuZ2V0Q2hpbGRyZW4oKTtcblx0fVxufVxuXG5jbGFzcyBEZWJ1Z0hvdmVyRGVsZWdhdGUgaW1wbGVtZW50cyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxJRXhwcmVzc2lvbj4ge1xuXHRnZXRIZWlnaHQoZWxlbWVudDogSUV4cHJlc3Npb24pOiBudW1iZXIge1xuXHRcdHJldHVybiAxODtcblx0fVxuXG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogSUV4cHJlc3Npb24pOiBzdHJpbmcge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgVmlzdWFsaXplZEV4cHJlc3Npb24pIHtcblx0XHRcdHJldHVybiBWaXN1YWxpemVkVmFyaWFibGVSZW5kZXJlci5JRDtcblx0XHR9XG5cdFx0cmV0dXJuIFZhcmlhYmxlc1JlbmRlcmVyLklEO1xuXHR9XG59XG5cbmludGVyZmFjZSBJRGVidWdIb3ZlckNvbXB1dGVSZXN1bHQge1xuXHRyYW5nZUNoYW5nZWQ6IGJvb2xlYW47XG5cdHJhbmdlPzogUmFuZ2U7XG59XG5cbmNsYXNzIERlYnVnSG92ZXJDb21wdXRlciB7XG5cdHByaXZhdGUgX2N1cnJlbnQ/OiB7XG5cdFx0cmFuZ2U6IFJhbmdlO1xuXHRcdGV4cHJlc3Npb246IHN0cmluZztcblx0fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0cHVibGljIGFzeW5jIGNvbXB1dGUocG9zaXRpb246IFBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElEZWJ1Z0hvdmVyQ29tcHV0ZVJlc3VsdD4ge1xuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRpZiAoIXNlc3Npb24gfHwgIXRoaXMuZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybiB7IHJhbmdlQ2hhbmdlZDogZmFsc2UgfTtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0RXZhbHVhdGFibGVFeHByZXNzaW9uQXRQb3NpdGlvbih0aGlzLmxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBtb2RlbCwgcG9zaXRpb24sIHRva2VuKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIHsgcmFuZ2VDaGFuZ2VkOiBmYWxzZSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgcmFuZ2UsIG1hdGNoaW5nRXhwcmVzc2lvbiB9ID0gcmVzdWx0O1xuXHRcdGNvbnN0IHJhbmdlQ2hhbmdlZCA9ICF0aGlzLl9jdXJyZW50Py5yYW5nZS5lcXVhbHNSYW5nZShyYW5nZSk7XG5cdFx0dGhpcy5fY3VycmVudCA9IHsgZXhwcmVzc2lvbjogbWF0Y2hpbmdFeHByZXNzaW9uLCByYW5nZTogUmFuZ2UubGlmdChyYW5nZSkgfTtcblx0XHRyZXR1cm4geyByYW5nZUNoYW5nZWQsIHJhbmdlOiB0aGlzLl9jdXJyZW50LnJhbmdlIH07XG5cdH1cblxuXHRhc3luYyBldmFsdWF0ZShzZXNzaW9uOiBJRGVidWdTZXNzaW9uKTogUHJvbWlzZTxJRXhwcmVzc2lvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5fY3VycmVudCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdObyBleHByZXNzaW9uIHRvIGV2YWx1YXRlJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRjb25zdCBkZWJ1Z1NvdXJjZSA9IHRleHRNb2RlbCAmJiBzZXNzaW9uLmdldFNvdXJjZUZvclVyaSh0ZXh0TW9kZWw/LnVyaSk7XG5cblx0XHRpZiAoc2Vzc2lvbi5jYXBhYmlsaXRpZXMuc3VwcG9ydHNFdmFsdWF0ZUZvckhvdmVycykge1xuXHRcdFx0Y29uc3QgZXhwcmVzc2lvbiA9IG5ldyBFeHByZXNzaW9uKHRoaXMuX2N1cnJlbnQuZXhwcmVzc2lvbik7XG5cdFx0XHRhd2FpdCBleHByZXNzaW9uLmV2YWx1YXRlKHNlc3Npb24sIHRoaXMuZGVidWdTZXJ2aWNlLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRTdGFja0ZyYW1lLCAnaG92ZXInLCB1bmRlZmluZWQsIGRlYnVnU291cmNlID8ge1xuXHRcdFx0XHRsaW5lOiB0aGlzLl9jdXJyZW50LnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0Y29sdW1uOiB0aGlzLl9jdXJyZW50LnJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdFx0XHRzb3VyY2U6IGRlYnVnU291cmNlLnJhdyxcblx0XHRcdH0gOiB1bmRlZmluZWQpO1xuXHRcdFx0cmV0dXJuIGV4cHJlc3Npb247XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGZvY3VzZWRTdGFja0ZyYW1lID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0Vmlld01vZGVsKCkuZm9jdXNlZFN0YWNrRnJhbWU7XG5cdFx0XHRpZiAoZm9jdXNlZFN0YWNrRnJhbWUpIHtcblx0XHRcdFx0cmV0dXJuIGF3YWl0IGZpbmRFeHByZXNzaW9uSW5TdGFja0ZyYW1lKFxuXHRcdFx0XHRcdGZvY3VzZWRTdGFja0ZyYW1lLFxuXHRcdFx0XHRcdGNvYWxlc2NlKHRoaXMuX2N1cnJlbnQuZXhwcmVzc2lvbi5zcGxpdCgnLicpLm1hcCh3b3JkID0+IHdvcmQudHJpbSgpKSlcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1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
