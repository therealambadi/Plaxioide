import { $, append, clearNode, h, hasParentWithClass, isActiveElement, isKeyboardEvent, addDisposableListener, isEditableElement } from "../../dom.js";
import { createStyleSheet } from "../../domStylesheets.js";
import { asCssValueWithDefault } from "../../cssValue.js";
import { DomEmitter } from "../../event.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { ActionBar } from "../actionbar/actionbar.js";
import { FindInput } from "../findinput/findInput.js";
import { MessageType, unthemedInboxStyles } from "../inputbox/inputBox.js";
import { ElementsDragAndDropData } from "../list/listView.js";
import { isActionItem, isButton, isMonacoCustomToggle, isMonacoEditor, isStickyScrollContainer, isStickyScrollElement, List, MouseController } from "../list/listWidget.js";
import { Toggle, unthemedToggleStyles } from "../toggle/toggle.js";
import { getVisibleState, isFilterResult } from "./indexTreeModel.js";
import { TreeDragOverBubble, TreeError, TreeMouseEventTarget, TreeVisibility } from "./tree.js";
import { Action } from "../../../common/actions.js";
import { distinct, equals, insertInto, range } from "../../../common/arrays.js";
import { Delayer, disposableTimeout, timeout } from "../../../common/async.js";
import { Codicon } from "../../../common/codicons.js";
import { ThemeIcon } from "../../../common/themables.js";
import { SetMap } from "../../../common/map.js";
import { Emitter, Event, EventBufferer, Relay } from "../../../common/event.js";
import { fuzzyScore, FuzzyScore } from "../../../common/filters.js";
import { KeyCode } from "../../../common/keyCodes.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../common/lifecycle.js";
import { clamp } from "../../../common/numbers.js";
import "./media/tree.css";
import { localize } from "../../../../nls.js";
import { createInstantHoverDelegate } from "../hover/hoverDelegateFactory.js";
import { autorun, constObservable } from "../../../common/observable.js";
import { alert } from "../aria/aria.js";
class TreeElementsDragAndDropData extends ElementsDragAndDropData {
  constructor(data) {
    super(data.elements.map((node) => node.element));
    this.data = data;
  }
  set context(context) {
    this.data.context = context;
  }
  get context() {
    return this.data.context;
  }
}
function asTreeDragAndDropData(data) {
  if (data instanceof ElementsDragAndDropData) {
    return new TreeElementsDragAndDropData(data);
  }
  return data;
}
class TreeNodeListDragAndDrop {
  constructor(modelProvider, dnd) {
    this.modelProvider = modelProvider;
    this.dnd = dnd;
    this.autoExpandDisposable = Disposable.None;
    this.disposables = new DisposableStore();
  }
  getDragURI(node) {
    return this.dnd.getDragURI(node.element);
  }
  getDragLabel(nodes, originalEvent) {
    if (this.dnd.getDragLabel) {
      return this.dnd.getDragLabel(nodes.map((node) => node.element), originalEvent);
    }
    return void 0;
  }
  onDragStart(data, originalEvent) {
    this.dnd.onDragStart?.(asTreeDragAndDropData(data), originalEvent);
  }
  onDragOver(data, targetNode, targetIndex, targetSector, originalEvent, raw = true) {
    const result = this.dnd.onDragOver(asTreeDragAndDropData(data), targetNode && targetNode.element, targetIndex, targetSector, originalEvent);
    const didChangeAutoExpandNode = this.autoExpandNode !== targetNode;
    if (didChangeAutoExpandNode) {
      this.autoExpandDisposable.dispose();
      this.autoExpandNode = targetNode;
    }
    if (typeof targetNode === "undefined") {
      return result;
    }
    if (didChangeAutoExpandNode && typeof result !== "boolean" && result.autoExpand) {
      this.autoExpandDisposable = disposableTimeout(() => {
        const model2 = this.modelProvider();
        const ref2 = model2.getNodeLocation(targetNode);
        if (model2.isCollapsed(ref2)) {
          model2.setCollapsed(ref2, false);
        }
        this.autoExpandNode = void 0;
      }, 500, this.disposables);
    }
    if (typeof result === "boolean" || !result.accept || typeof result.bubble === "undefined" || result.feedback) {
      if (!raw) {
        const accept = typeof result === "boolean" ? result : result.accept;
        const effect = typeof result === "boolean" ? void 0 : result.effect;
        return { accept, effect, feedback: [targetIndex] };
      }
      return result;
    }
    if (result.bubble === TreeDragOverBubble.Up) {
      const model2 = this.modelProvider();
      const ref2 = model2.getNodeLocation(targetNode);
      const parentRef = model2.getParentNodeLocation(ref2);
      const parentNode = model2.getNode(parentRef);
      const parentIndex = parentRef && model2.getListIndex(parentRef);
      return this.onDragOver(data, parentNode, parentIndex, targetSector, originalEvent, false);
    }
    const model = this.modelProvider();
    const ref = model.getNodeLocation(targetNode);
    const start = model.getListIndex(ref);
    const length = model.getListRenderCount(ref);
    return { ...result, feedback: range(start, start + length) };
  }
  drop(data, targetNode, targetIndex, targetSector, originalEvent) {
    this.autoExpandDisposable.dispose();
    this.autoExpandNode = void 0;
    this.dnd.drop(asTreeDragAndDropData(data), targetNode && targetNode.element, targetIndex, targetSector, originalEvent);
  }
  onDragEnd(originalEvent) {
    this.dnd.onDragEnd?.(originalEvent);
  }
  dispose() {
    this.disposables.dispose();
    this.dnd.dispose();
  }
}
function asListOptions(modelProvider, disposableStore, options) {
  return options && {
    ...options,
    identityProvider: options.identityProvider && {
      getId(el) {
        return options.identityProvider.getId(el.element);
      }
    },
    dnd: options.dnd && disposableStore.add(new TreeNodeListDragAndDrop(modelProvider, options.dnd)),
    multipleSelectionController: options.multipleSelectionController && {
      isSelectionSingleChangeEvent(e) {
        return options.multipleSelectionController.isSelectionSingleChangeEvent({ ...e, element: e.element });
      },
      isSelectionRangeChangeEvent(e) {
        return options.multipleSelectionController.isSelectionRangeChangeEvent({ ...e, element: e.element });
      }
    },
    accessibilityProvider: options.accessibilityProvider && {
      ...options.accessibilityProvider,
      getSetSize(node) {
        const model = modelProvider();
        const ref = model.getNodeLocation(node);
        const parentRef = model.getParentNodeLocation(ref);
        const parentNode = model.getNode(parentRef);
        return parentNode.visibleChildrenCount;
      },
      getPosInSet(node) {
        return node.visibleChildIndex + 1;
      },
      isChecked: options.accessibilityProvider && options.accessibilityProvider.isChecked ? (node) => {
        return options.accessibilityProvider.isChecked(node.element);
      } : void 0,
      getRole: options.accessibilityProvider && options.accessibilityProvider.getRole ? (node) => {
        return options.accessibilityProvider.getRole(node.element);
      } : () => "treeitem",
      getAriaLabel(e) {
        return options.accessibilityProvider.getAriaLabel(e.element);
      },
      getWidgetAriaLabel() {
        return options.accessibilityProvider.getWidgetAriaLabel();
      },
      getWidgetRole: options.accessibilityProvider && options.accessibilityProvider.getWidgetRole ? () => options.accessibilityProvider.getWidgetRole() : () => "tree",
      getAriaLevel: options.accessibilityProvider && options.accessibilityProvider.getAriaLevel ? (node) => options.accessibilityProvider.getAriaLevel(node.element) : (node) => {
        return node.depth;
      },
      getActiveDescendantId: options.accessibilityProvider.getActiveDescendantId && ((node) => {
        return options.accessibilityProvider.getActiveDescendantId(node.element);
      })
    },
    keyboardNavigationLabelProvider: options.keyboardNavigationLabelProvider && {
      ...options.keyboardNavigationLabelProvider,
      getKeyboardNavigationLabel(node) {
        return options.keyboardNavigationLabelProvider.getKeyboardNavigationLabel(node.element);
      }
    }
  };
}
class ComposedTreeDelegate {
  constructor(delegate) {
    this.delegate = delegate;
  }
  getHeight(element) {
    return this.delegate.getHeight(element.element);
  }
  getTemplateId(element) {
    return this.delegate.getTemplateId(element.element);
  }
  hasDynamicHeight(element) {
    return !!this.delegate.hasDynamicHeight && this.delegate.hasDynamicHeight(element.element);
  }
  setDynamicHeight(element, height) {
    this.delegate.setDynamicHeight?.(element.element, height);
  }
}
class AbstractTreeViewState {
  static lift(state) {
    return state instanceof AbstractTreeViewState ? state : new AbstractTreeViewState(state);
  }
  static empty(scrollTop = 0) {
    return new AbstractTreeViewState({
      focus: [],
      selection: [],
      expanded: /* @__PURE__ */ Object.create(null),
      scrollTop
    });
  }
  constructor(state) {
    this.focus = new Set(state.focus);
    this.selection = new Set(state.selection);
    if (state.expanded instanceof Array) {
      this.expanded = /* @__PURE__ */ Object.create(null);
      for (const id of state.expanded) {
        this.expanded[id] = 1;
      }
    } else {
      this.expanded = state.expanded;
    }
    this.expanded = state.expanded;
    this.scrollTop = state.scrollTop;
  }
  toJSON() {
    return {
      focus: Array.from(this.focus),
      selection: Array.from(this.selection),
      expanded: this.expanded,
      scrollTop: this.scrollTop
    };
  }
}
var RenderIndentGuides = /* @__PURE__ */ ((RenderIndentGuides2) => {
  RenderIndentGuides2["None"] = "none";
  RenderIndentGuides2["OnHover"] = "onHover";
  RenderIndentGuides2["Always"] = "always";
  return RenderIndentGuides2;
})(RenderIndentGuides || {});
class EventCollection {
  constructor(onDidChange, _elements = []) {
    this._elements = _elements;
    this.disposables = new DisposableStore();
    this.onDidChange = Event.forEach(onDidChange, (elements) => this._elements = elements, this.disposables);
  }
  get elements() {
    return this._elements;
  }
  dispose() {
    this.disposables.dispose();
  }
}
const _TreeRenderer = class _TreeRenderer {
  constructor(renderer, model, onDidChangeCollapseState, activeNodes, renderedIndentGuides, options = {}) {
    this.renderer = renderer;
    this.model = model;
    this.activeNodes = activeNodes;
    this.renderedIndentGuides = renderedIndentGuides;
    this.renderedElements = /* @__PURE__ */ new Map();
    this.renderedNodes = /* @__PURE__ */ new Map();
    this.indent = _TreeRenderer.DefaultIndent;
    this.hideTwistiesOfChildlessElements = false;
    this.shouldRenderIndentGuides = false;
    this.activeIndentNodes = /* @__PURE__ */ new Set();
    this.indentGuidesDisposable = Disposable.None;
    this.disposables = new DisposableStore();
    this.templateId = renderer.templateId;
    this.updateOptions(options);
    Event.map(onDidChangeCollapseState, (e) => e.node)(this.onDidChangeNodeTwistieState, this, this.disposables);
    renderer.onDidChangeTwistieState?.(this.onDidChangeTwistieState, this, this.disposables);
  }
  updateOptions(options = {}) {
    if (typeof options.indent !== "undefined") {
      const indent = clamp(options.indent, 0, 40);
      if (indent !== this.indent) {
        this.indent = indent;
        for (const [node, templateData] of this.renderedNodes) {
          this.renderTreeElement(node, templateData);
        }
      }
    }
    if (typeof options.renderIndentGuides !== "undefined") {
      const shouldRenderIndentGuides = options.renderIndentGuides !== "none" /* None */;
      if (shouldRenderIndentGuides !== this.shouldRenderIndentGuides) {
        this.shouldRenderIndentGuides = shouldRenderIndentGuides;
        for (const [node, templateData] of this.renderedNodes) {
          this._renderIndentGuides(node, templateData);
        }
        this.indentGuidesDisposable.dispose();
        if (shouldRenderIndentGuides) {
          const disposables = new DisposableStore();
          this.activeNodes.onDidChange(this._onDidChangeActiveNodes, this, disposables);
          this.indentGuidesDisposable = disposables;
          this._onDidChangeActiveNodes(this.activeNodes.elements);
        }
      }
    }
    if (typeof options.hideTwistiesOfChildlessElements !== "undefined") {
      this.hideTwistiesOfChildlessElements = options.hideTwistiesOfChildlessElements;
    }
  }
  renderTemplate(container) {
    const el = append(container, $(".monaco-tl-row"));
    const indent = append(el, $(".monaco-tl-indent"));
    const twistie = append(el, $(".monaco-tl-twistie"));
    const contents = append(el, $(".monaco-tl-contents"));
    const templateData = this.renderer.renderTemplate(contents);
    return { container, indent, twistie, indentGuidesDisposable: Disposable.None, templateData };
  }
  renderElement(node, index, templateData, height) {
    this.renderedNodes.set(node, templateData);
    this.renderedElements.set(node.element, node);
    this.renderTreeElement(node, templateData);
    this.renderer.renderElement(node, index, templateData.templateData, height);
  }
  disposeElement(node, index, templateData, height) {
    templateData.indentGuidesDisposable.dispose();
    this.renderer.disposeElement?.(node, index, templateData.templateData, height);
    if (typeof height === "number") {
      this.renderedNodes.delete(node);
      this.renderedElements.delete(node.element);
    }
  }
  disposeTemplate(templateData) {
    this.renderer.disposeTemplate(templateData.templateData);
  }
  onDidChangeTwistieState(element) {
    const node = this.renderedElements.get(element);
    if (!node) {
      return;
    }
    this.onDidChangeNodeTwistieState(node);
  }
  onDidChangeNodeTwistieState(node) {
    const templateData = this.renderedNodes.get(node);
    if (!templateData) {
      return;
    }
    this._onDidChangeActiveNodes(this.activeNodes.elements);
    this.renderTreeElement(node, templateData);
  }
  renderTreeElement(node, templateData) {
    const indent = _TreeRenderer.DefaultIndent + (node.depth - 1) * this.indent;
    templateData.twistie.style.paddingLeft = `${indent}px`;
    templateData.indent.style.width = `${indent + this.indent - 16}px`;
    if (node.collapsible) {
      templateData.container.setAttribute("aria-expanded", String(!node.collapsed));
    } else {
      templateData.container.removeAttribute("aria-expanded");
    }
    templateData.twistie.classList.remove(...ThemeIcon.asClassNameArray(Codicon.treeItemExpanded));
    let twistieRendered = false;
    if (this.renderer.renderTwistie) {
      twistieRendered = this.renderer.renderTwistie(node.element, templateData.twistie);
    }
    if (node.collapsible && (!this.hideTwistiesOfChildlessElements || node.visibleChildrenCount > 0)) {
      if (!twistieRendered) {
        templateData.twistie.classList.add(...ThemeIcon.asClassNameArray(Codicon.treeItemExpanded));
      }
      templateData.twistie.classList.add("collapsible");
      templateData.twistie.classList.toggle("collapsed", node.collapsed);
    } else {
      templateData.twistie.classList.remove("collapsible", "collapsed");
    }
    this._renderIndentGuides(node, templateData);
  }
  _renderIndentGuides(node, templateData) {
    clearNode(templateData.indent);
    templateData.indentGuidesDisposable.dispose();
    if (!this.shouldRenderIndentGuides) {
      return;
    }
    const disposableStore = new DisposableStore();
    while (true) {
      const ref = this.model.getNodeLocation(node);
      const parentRef = this.model.getParentNodeLocation(ref);
      if (!parentRef) {
        break;
      }
      const parent = this.model.getNode(parentRef);
      const guide = $(".indent-guide", { style: `width: ${this.indent}px` });
      if (this.activeIndentNodes.has(parent)) {
        guide.classList.add("active");
      }
      if (templateData.indent.childElementCount === 0) {
        templateData.indent.appendChild(guide);
      } else {
        templateData.indent.insertBefore(guide, templateData.indent.firstElementChild);
      }
      this.renderedIndentGuides.add(parent, guide);
      disposableStore.add(toDisposable(() => this.renderedIndentGuides.delete(parent, guide)));
      node = parent;
    }
    templateData.indentGuidesDisposable = disposableStore;
  }
  _onDidChangeActiveNodes(nodes) {
    if (!this.shouldRenderIndentGuides) {
      return;
    }
    const set = /* @__PURE__ */ new Set();
    nodes.forEach((node) => {
      const ref = this.model.getNodeLocation(node);
      try {
        const parentRef = this.model.getParentNodeLocation(ref);
        if (node.collapsible && node.children.length > 0 && !node.collapsed) {
          set.add(node);
        } else if (parentRef) {
          set.add(this.model.getNode(parentRef));
        }
      } catch {
      }
    });
    this.activeIndentNodes.forEach((node) => {
      if (!set.has(node)) {
        this.renderedIndentGuides.forEach(node, (line) => line.classList.remove("active"));
      }
    });
    set.forEach((node) => {
      if (!this.activeIndentNodes.has(node)) {
        this.renderedIndentGuides.forEach(node, (line) => line.classList.add("active"));
      }
    });
    this.activeIndentNodes = set;
  }
  dispose() {
    this.renderedNodes.clear();
    this.renderedElements.clear();
    this.indentGuidesDisposable.dispose();
    dispose(this.disposables);
  }
};
_TreeRenderer.DefaultIndent = 8;
let TreeRenderer = _TreeRenderer;
function contiguousFuzzyScore(patternLower, wordLower) {
  const index = wordLower.toLowerCase().indexOf(patternLower);
  let score;
  if (index > -1) {
    score = [Number.MAX_SAFE_INTEGER, 0];
    for (let i = patternLower.length; i > 0; i--) {
      score.push(index + i - 1);
    }
  }
  return score;
}
class FindFilter {
  constructor(_keyboardNavigationLabelProvider, _filter, _defaultFindVisibility) {
    this._keyboardNavigationLabelProvider = _keyboardNavigationLabelProvider;
    this._filter = _filter;
    this._defaultFindVisibility = _defaultFindVisibility;
    this._totalCount = 0;
    this._matchCount = 0;
    this._findMatchType = 0 /* Fuzzy */;
    this._findMode = 0 /* Highlight */;
    this._pattern = "";
    this._lowercasePattern = "";
    this.disposables = new DisposableStore();
  }
  get totalCount() {
    return this._totalCount;
  }
  get matchCount() {
    return this._matchCount;
  }
  set findMatchType(type) {
    this._findMatchType = type;
  }
  get findMatchType() {
    return this._findMatchType;
  }
  set findMode(mode) {
    this._findMode = mode;
  }
  get findMode() {
    return this._findMode;
  }
  set pattern(pattern) {
    this._pattern = pattern;
    this._lowercasePattern = pattern.toLowerCase();
  }
  filter(element, parentVisibility) {
    let visibility = TreeVisibility.Visible;
    if (this._filter) {
      const result = this._filter.filter(element, parentVisibility);
      if (typeof result === "boolean") {
        visibility = result ? TreeVisibility.Visible : TreeVisibility.Hidden;
      } else if (isFilterResult(result)) {
        visibility = getVisibleState(result.visibility);
      } else {
        visibility = result;
      }
      if (visibility === TreeVisibility.Hidden) {
        return false;
      }
    }
    this._totalCount++;
    if (!this._pattern) {
      this._matchCount++;
      return { data: FuzzyScore.Default, visibility };
    }
    const label = this._keyboardNavigationLabelProvider.getKeyboardNavigationLabel(element);
    const labels = Array.isArray(label) ? label : [label];
    for (const l of labels) {
      const labelStr = l && l.toString();
      if (typeof labelStr === "undefined") {
        return { data: FuzzyScore.Default, visibility };
      }
      let score;
      if (this._findMatchType === 1 /* Contiguous */) {
        score = contiguousFuzzyScore(this._lowercasePattern, labelStr.toLowerCase());
      } else {
        score = fuzzyScore(this._pattern, this._lowercasePattern, 0, labelStr, labelStr.toLowerCase(), 0, { firstMatchCanBeWeak: true, boostFullMatch: true });
      }
      if (score) {
        this._matchCount++;
        return labels.length === 1 ? { data: score, visibility } : { data: { label: labelStr, score }, visibility };
      }
    }
    if (this._findMode === 1 /* Filter */) {
      if (typeof this._defaultFindVisibility === "number") {
        return this._defaultFindVisibility;
      } else if (this._defaultFindVisibility) {
        return this._defaultFindVisibility(element);
      } else {
        return TreeVisibility.Recurse;
      }
    } else {
      return { data: FuzzyScore.Default, visibility };
    }
  }
  reset() {
    this._totalCount = 0;
    this._matchCount = 0;
  }
  dispose() {
    dispose(this.disposables);
  }
}
class TreeFindToggle extends Toggle {
  constructor(contribution, opts, hoverDelegate) {
    super({
      icon: contribution.icon,
      title: contribution.title,
      isChecked: contribution.isChecked,
      inputActiveOptionBorder: opts.inputActiveOptionBorder,
      inputActiveOptionForeground: opts.inputActiveOptionForeground,
      inputActiveOptionBackground: opts.inputActiveOptionBackground,
      hoverDelegate
    });
    this.id = contribution.id;
  }
}
class FindToggles {
  constructor(startStates) {
    this.stateMap = new Map(startStates.map((state) => [state.id, { ...state }]));
  }
  states() {
    return Array.from(this.stateMap.values());
  }
  get(id) {
    const state = this.stateMap.get(id);
    if (state === void 0) {
      throw new Error(`No state found for toggle id ${id}`);
    }
    return state.isChecked;
  }
  set(id, value) {
    const state = this.stateMap.get(id);
    if (state === void 0) {
      throw new Error(`No state found for toggle id ${id}`);
    }
    if (state.isChecked === value) {
      return false;
    }
    state.isChecked = value;
    return true;
  }
}
const unthemedFindWidgetStyles = {
  inputBoxStyles: unthemedInboxStyles,
  toggleStyles: unthemedToggleStyles,
  listFilterWidgetBackground: void 0,
  listFilterWidgetNoMatchesOutline: void 0,
  listFilterWidgetOutline: void 0,
  listFilterWidgetShadow: void 0
};
var TreeFindMode = /* @__PURE__ */ ((TreeFindMode2) => {
  TreeFindMode2[TreeFindMode2["Highlight"] = 0] = "Highlight";
  TreeFindMode2[TreeFindMode2["Filter"] = 1] = "Filter";
  return TreeFindMode2;
})(TreeFindMode || {});
var TreeFindMatchType = /* @__PURE__ */ ((TreeFindMatchType2) => {
  TreeFindMatchType2[TreeFindMatchType2["Fuzzy"] = 0] = "Fuzzy";
  TreeFindMatchType2[TreeFindMatchType2["Contiguous"] = 1] = "Contiguous";
  return TreeFindMatchType2;
})(TreeFindMatchType || {});
class FindWidget extends Disposable {
  constructor(container, tree, contextViewProvider, placeholder, toggleContributions = [], options) {
    super();
    this.tree = tree;
    this.elements = h(".monaco-tree-type-filter", [
      h(".monaco-tree-type-filter-input@findInput"),
      h(".monaco-tree-type-filter-actionbar@actionbar")
    ]);
    this.toggles = [];
    this._onDidDisable = new Emitter();
    this.onDidDisable = this._onDidDisable.event;
    container.appendChild(this.elements.root);
    this._register(toDisposable(() => this.elements.root.remove()));
    const styles = options?.styles ?? unthemedFindWidgetStyles;
    if (styles.listFilterWidgetBackground) {
      this.elements.root.style.backgroundColor = styles.listFilterWidgetBackground;
    }
    if (styles.listFilterWidgetShadow) {
      this.elements.root.style.boxShadow = `0 0 8px 2px ${styles.listFilterWidgetShadow}`;
    }
    const toggleHoverDelegate = this._register(createInstantHoverDelegate());
    this.toggles = toggleContributions.map((contribution) => this._register(new TreeFindToggle(contribution, styles.toggleStyles, toggleHoverDelegate)));
    this.onDidToggleChange = Event.any(...this.toggles.map((toggle) => Event.map(toggle.onChange, () => ({ id: toggle.id, isChecked: toggle.checked }))));
    const history = options?.history || [];
    this.findInput = this._register(new FindInput(this.elements.findInput, contextViewProvider, {
      label: localize("type to search", "Type to search"),
      placeholder,
      additionalToggles: this.toggles,
      showCommonFindToggles: false,
      inputBoxStyles: styles.inputBoxStyles,
      toggleStyles: styles.toggleStyles,
      history: new Set(history)
    }));
    this.actionbar = this._register(new ActionBar(this.elements.actionbar));
    const emitter = this._register(new DomEmitter(this.findInput.inputBox.inputElement, "keydown"));
    const onKeyDown = Event.chain(emitter.event, ($2) => $2.map((e) => new StandardKeyboardEvent(e)));
    this._register(onKeyDown((e) => {
      if (e.equals(KeyCode.Enter)) {
        e.preventDefault();
        e.stopPropagation();
        this.findInput.inputBox.addToHistory();
        this.tree.domFocus();
        return;
      }
      if (e.equals(KeyCode.DownArrow)) {
        e.preventDefault();
        e.stopPropagation();
        if (this.findInput.inputBox.isAtLastInHistory() || this.findInput.inputBox.isNowhereInHistory()) {
          this.findInput.inputBox.addToHistory();
          this.tree.domFocus();
        } else {
          this.findInput.inputBox.showNextValue();
        }
        return;
      }
      if (e.equals(KeyCode.UpArrow)) {
        e.preventDefault();
        e.stopPropagation();
        this.findInput.inputBox.showPreviousValue();
        return;
      }
    }));
    const closeAction = this._register(new Action("close", localize("close", "Close"), "codicon codicon-close", true, () => this.dispose()));
    this.actionbar.push(closeAction, { icon: true, label: false });
    this.onDidChangeValue = this.findInput.onDidChange;
  }
  get value() {
    return this.findInput.inputBox.value;
  }
  set value(value) {
    this.findInput.inputBox.value = value;
  }
  setToggleState(id, checked) {
    const toggle = this.toggles.find((toggle2) => toggle2.id === id);
    if (toggle) {
      toggle.checked = checked;
    }
  }
  setPlaceHolder(placeHolder) {
    this.findInput.inputBox.setPlaceHolder(placeHolder);
  }
  getHistory() {
    return this.findInput.inputBox.getHistory();
  }
  focus() {
    this.findInput.focus();
  }
  select() {
    this.findInput.select();
    this.findInput.inputBox.addToHistory(true);
  }
  showMessage(message) {
    this.findInput.showMessage(message);
  }
  clearMessage() {
    this.findInput.clearMessage();
  }
  async dispose() {
    this._onDidDisable.fire();
    this.elements.root.classList.add("disabled");
    await timeout(300);
    super.dispose();
  }
}
var DefaultTreeToggles = /* @__PURE__ */ ((DefaultTreeToggles2) => {
  DefaultTreeToggles2["Mode"] = "mode";
  DefaultTreeToggles2["MatchType"] = "matchType";
  return DefaultTreeToggles2;
})(DefaultTreeToggles || {});
class AbstractFindController {
  constructor(tree, filter, contextViewProvider, options = {}) {
    this.tree = tree;
    this.filter = filter;
    this.contextViewProvider = contextViewProvider;
    this.options = options;
    this._pattern = "";
    this.previousPattern = "";
    this._onDidChangePattern = new Emitter();
    this.onDidChangePattern = this._onDidChangePattern.event;
    this._onDidChangeOpenState = new Emitter();
    this.onDidChangeOpenState = this._onDidChangeOpenState.event;
    this.enabledDisposables = new DisposableStore();
    this.disposables = new DisposableStore();
    this.toggles = new FindToggles(options.toggles ?? []);
    this._placeholder = options.placeholder ?? localize("type to search", "Type to search");
  }
  get pattern() {
    return this._pattern;
  }
  get placeholder() {
    return this._placeholder;
  }
  set placeholder(value) {
    this._placeholder = value;
    this.widget?.setPlaceHolder(value);
  }
  isOpened() {
    return !!this.widget;
  }
  open() {
    if (this.widget) {
      this.widget.focus();
      this.widget.select();
      return;
    }
    this.tree.updateOptions({ paddingTop: 30 });
    this.widget = new FindWidget(this.tree.getHTMLElement(), this.tree, this.contextViewProvider, this.placeholder, this.toggles.states(), { ...this.options, history: this._history });
    this.enabledDisposables.add(this.widget);
    this.widget.onDidChangeValue(this.onDidChangeValue, this, this.enabledDisposables);
    this.widget.onDidDisable(this.close, this, this.enabledDisposables);
    this.widget.onDidToggleChange(this.onDidToggleChange, this, this.enabledDisposables);
    this.widget.focus();
    this.widget.value = this.previousPattern;
    this.widget.select();
    this._onDidChangeOpenState.fire(true);
  }
  close() {
    if (!this.widget) {
      return;
    }
    this.tree.updateOptions({ paddingTop: 0 });
    this._history = this.widget.getHistory();
    this.widget = void 0;
    this.enabledDisposables.clear();
    this.previousPattern = this.pattern;
    this.onDidChangeValue("");
    this.tree.domFocus();
    this._onDidChangeOpenState.fire(false);
  }
  onDidChangeValue(pattern) {
    this._pattern = pattern;
    this._onDidChangePattern.fire(pattern);
    this.filter.pattern = pattern;
    this.applyPattern(pattern);
  }
  onDidToggleChange(e) {
    this.toggles.set(e.id, e.isChecked);
  }
  updateToggleState(id, checked) {
    this.toggles.set(id, checked);
    this.widget?.setToggleState(id, checked);
  }
  renderMessage(showNotFound, warningMessage) {
    if (showNotFound) {
      if (this.tree.options.showNotFoundMessage ?? true) {
        this.widget?.showMessage({ type: MessageType.WARNING, content: warningMessage ?? localize("not found", "No results found.") });
      } else {
        this.widget?.showMessage({ type: MessageType.WARNING });
      }
    } else {
      this.widget?.clearMessage();
    }
  }
  alertResults(results) {
    if (!results) {
      alert(localize("replFindNoResults", "No results"));
    } else {
      alert(localize("foundResults", "{0} results", results));
    }
  }
  dispose() {
    this._history = void 0;
    this._onDidChangePattern.dispose();
    this.enabledDisposables.dispose();
    this.disposables.dispose();
  }
}
class FindController extends AbstractFindController {
  constructor(tree, filter, contextViewProvider, options = {}) {
    const defaultFindMode = options.defaultFindMode ?? 0 /* Highlight */;
    const defaultFindMatchType = options.defaultFindMatchType ?? 0 /* Fuzzy */;
    const toggleContributions = [{
      id: "mode" /* Mode */,
      icon: Codicon.listFilter,
      title: localize("filter", "Filter"),
      isChecked: defaultFindMode === 1 /* Filter */
    }, {
      id: "matchType" /* MatchType */,
      icon: Codicon.searchFuzzy,
      title: localize("fuzzySearch", "Fuzzy Match"),
      isChecked: defaultFindMatchType === 0 /* Fuzzy */
    }];
    filter.findMatchType = defaultFindMatchType;
    filter.findMode = defaultFindMode;
    super(tree, filter, contextViewProvider, { ...options, toggles: toggleContributions });
    this.filter = filter;
    this._onDidChangeMode = new Emitter();
    this.onDidChangeMode = this._onDidChangeMode.event;
    this._onDidChangeMatchType = new Emitter();
    this.onDidChangeMatchType = this._onDidChangeMatchType.event;
    this.disposables.add(this.tree.onDidChangeModel(() => {
      if (!this.isOpened()) {
        return;
      }
      if (this.pattern.length !== 0) {
        this.tree.refilter();
      }
      this.render();
    }));
    this.disposables.add(this.tree.onWillRefilter(() => this.filter.reset()));
  }
  get mode() {
    return this.toggles.get("mode" /* Mode */) ? 1 /* Filter */ : 0 /* Highlight */;
  }
  set mode(mode) {
    if (mode === this.mode) {
      return;
    }
    const isFilterMode = mode === 1 /* Filter */;
    this.updateToggleState("mode" /* Mode */, isFilterMode);
    this.placeholder = isFilterMode ? localize("type to filter", "Type to filter") : localize("type to search", "Type to search");
    this.filter.findMode = mode;
    this.tree.refilter();
    this.render();
    this._onDidChangeMode.fire(mode);
  }
  get matchType() {
    return this.toggles.get("matchType" /* MatchType */) ? 0 /* Fuzzy */ : 1 /* Contiguous */;
  }
  set matchType(matchType) {
    if (matchType === this.matchType) {
      return;
    }
    this.updateToggleState("matchType" /* MatchType */, matchType === 0 /* Fuzzy */);
    this.filter.findMatchType = matchType;
    this.tree.refilter();
    this.render();
    this._onDidChangeMatchType.fire(matchType);
  }
  updateOptions(optionsUpdate = {}) {
    if (optionsUpdate.defaultFindMode !== void 0) {
      this.mode = optionsUpdate.defaultFindMode;
    }
    if (optionsUpdate.defaultFindMatchType !== void 0) {
      this.matchType = optionsUpdate.defaultFindMatchType;
    }
  }
  applyPattern(pattern) {
    this.tree.refilter();
    if (pattern) {
      this.tree.focusNext(0, true, void 0, (node) => !FuzzyScore.isDefault(node.filterData));
    }
    const focus = this.tree.getFocus();
    if (focus.length > 0) {
      const element = focus[0];
      if (this.tree.getRelativeTop(element) === null) {
        this.tree.reveal(element, 0.5);
      }
    }
    this.render();
  }
  shouldAllowFocus(node) {
    if (!this.isOpened() || !this.pattern) {
      return true;
    }
    if (this.filter.totalCount > 0 && this.filter.matchCount <= 1) {
      return true;
    }
    return !FuzzyScore.isDefault(node.filterData);
  }
  onDidToggleChange(e) {
    if (e.id === "mode" /* Mode */) {
      this.mode = e.isChecked ? 1 /* Filter */ : 0 /* Highlight */;
    } else if (e.id === "matchType" /* MatchType */) {
      this.matchType = e.isChecked ? 0 /* Fuzzy */ : 1 /* Contiguous */;
    }
  }
  render() {
    const noMatches = this.filter.matchCount === 0 && this.filter.totalCount > 0;
    const showNotFound = noMatches && this.pattern.length > 0;
    this.renderMessage(showNotFound);
    if (this.pattern.length) {
      this.alertResults(this.filter.matchCount);
    }
  }
}
function stickyScrollNodeStateEquals(node1, node2) {
  return node1.position === node2.position && stickyScrollNodeEquals(node1, node2);
}
function stickyScrollNodeEquals(node1, node2) {
  return node1.node.element === node2.node.element && node1.startIndex === node2.startIndex && node1.height === node2.height && node1.endIndex === node2.endIndex;
}
class StickyScrollState {
  constructor(stickyNodes = []) {
    this.stickyNodes = stickyNodes;
  }
  get count() {
    return this.stickyNodes.length;
  }
  equal(state) {
    return equals(this.stickyNodes, state.stickyNodes, stickyScrollNodeStateEquals);
  }
  contains(element) {
    return this.stickyNodes.some((node) => node.node.element === element.element);
  }
  lastNodePartiallyVisible() {
    if (this.count === 0) {
      return false;
    }
    const lastStickyNode = this.stickyNodes[this.count - 1];
    if (this.count === 1) {
      return lastStickyNode.position !== 0;
    }
    const secondLastStickyNode = this.stickyNodes[this.count - 2];
    return secondLastStickyNode.position + secondLastStickyNode.height !== lastStickyNode.position;
  }
  animationStateChanged(previousState) {
    if (!equals(this.stickyNodes, previousState.stickyNodes, stickyScrollNodeEquals)) {
      return false;
    }
    if (this.count === 0) {
      return false;
    }
    const lastStickyNode = this.stickyNodes[this.count - 1];
    const previousLastStickyNode = previousState.stickyNodes[previousState.count - 1];
    return lastStickyNode.position !== previousLastStickyNode.position;
  }
}
class DefaultStickyScrollDelegate {
  constrainStickyScrollNodes(stickyNodes, stickyScrollMaxItemCount, maxWidgetHeight) {
    for (let i = 0; i < stickyNodes.length; i++) {
      const stickyNode = stickyNodes[i];
      const stickyNodeBottom = stickyNode.position + stickyNode.height;
      if (stickyNodeBottom > maxWidgetHeight || i >= stickyScrollMaxItemCount) {
        return stickyNodes.slice(0, i);
      }
    }
    return stickyNodes;
  }
}
class StickyScrollController extends Disposable {
  constructor(tree, model, view, renderers, treeDelegate, options = {}) {
    super();
    this.tree = tree;
    this.model = model;
    this.view = view;
    this.treeDelegate = treeDelegate;
    this.maxWidgetViewRatio = 0.4;
    const stickyScrollOptions = this.validateStickySettings(options);
    this.stickyScrollMaxItemCount = stickyScrollOptions.stickyScrollMaxItemCount;
    this.stickyScrollDelegate = options.stickyScrollDelegate ?? new DefaultStickyScrollDelegate();
    this.paddingTop = options.paddingTop ?? 0;
    this._widget = this._register(new StickyScrollWidget(view.getScrollableElement(), view, tree, renderers, treeDelegate, options.accessibilityProvider));
    this.onDidChangeHasFocus = this._widget.onDidChangeHasFocus;
    this.onContextMenu = this._widget.onContextMenu;
    this._register(view.onDidScroll(() => this.update()));
    this._register(view.onDidChangeContentHeight(() => this.update()));
    this._register(tree.onDidChangeCollapseState(() => this.update()));
    this._register(model.onDidSpliceRenderedNodes((e) => {
      const state = this._widget.state;
      if (!state) {
        return;
      }
      const hasRemovedStickyNode = e.deleteCount > 0 && state.stickyNodes.some((stickyNode) => !this.model.has(this.model.getNodeLocation(stickyNode.node)));
      if (hasRemovedStickyNode) {
        this.update();
        return;
      }
      const shouldRerenderStickyNodes = state.stickyNodes.some((stickyNode) => {
        const listIndex = this.model.getListIndex(this.model.getNodeLocation(stickyNode.node));
        return listIndex >= e.start && listIndex < e.start + e.deleteCount && state.contains(stickyNode.node);
      });
      if (shouldRerenderStickyNodes) {
        this._widget.rerender();
      }
    }));
    this.update();
  }
  get height() {
    return this._widget.height;
  }
  get count() {
    return this._widget.count;
  }
  getNode(node) {
    return this._widget.getNode(node);
  }
  getNodeAtHeight(height) {
    let index;
    if (height === 0) {
      index = this.view.firstVisibleIndex;
    } else {
      index = this.view.indexAt(height + this.view.scrollTop);
    }
    if (index < 0 || index >= this.view.length) {
      return void 0;
    }
    return this.view.element(index);
  }
  update() {
    const firstVisibleNode = this.getNodeAtHeight(this.paddingTop);
    if (!firstVisibleNode || this.tree.scrollTop <= this.paddingTop) {
      this._widget.setState(void 0);
      return;
    }
    const stickyState = this.findStickyState(firstVisibleNode);
    this._widget.setState(stickyState);
  }
  findStickyState(firstVisibleNode) {
    const stickyNodes = [];
    let firstVisibleNodeUnderWidget = firstVisibleNode;
    let stickyNodesHeight = 0;
    let nextStickyNode = this.getNextStickyNode(firstVisibleNodeUnderWidget, void 0, stickyNodesHeight);
    while (nextStickyNode) {
      stickyNodes.push(nextStickyNode);
      stickyNodesHeight += nextStickyNode.height;
      if (stickyNodes.length <= this.stickyScrollMaxItemCount) {
        firstVisibleNodeUnderWidget = this.getNextVisibleNode(nextStickyNode);
        if (!firstVisibleNodeUnderWidget) {
          break;
        }
      }
      nextStickyNode = this.getNextStickyNode(firstVisibleNodeUnderWidget, nextStickyNode.node, stickyNodesHeight);
    }
    const contrainedStickyNodes = this.constrainStickyNodes(stickyNodes);
    return contrainedStickyNodes.length ? new StickyScrollState(contrainedStickyNodes) : void 0;
  }
  getNextVisibleNode(previousStickyNode) {
    return this.getNodeAtHeight(previousStickyNode.position + previousStickyNode.height);
  }
  getNextStickyNode(firstVisibleNodeUnderWidget, previousStickyNode, stickyNodesHeight) {
    const nextStickyNode = this.getAncestorUnderPrevious(firstVisibleNodeUnderWidget, previousStickyNode);
    if (!nextStickyNode) {
      return void 0;
    }
    if (nextStickyNode === firstVisibleNodeUnderWidget) {
      if (!this.nodeIsUncollapsedParent(firstVisibleNodeUnderWidget)) {
        return void 0;
      }
      if (this.nodeTopAlignsWithStickyNodesBottom(firstVisibleNodeUnderWidget, stickyNodesHeight)) {
        return void 0;
      }
    }
    return this.createStickyScrollNode(nextStickyNode, stickyNodesHeight);
  }
  nodeTopAlignsWithStickyNodesBottom(node, stickyNodesHeight) {
    const nodeIndex = this.getNodeIndex(node);
    const elementTop = this.view.getElementTop(nodeIndex);
    const stickyPosition = stickyNodesHeight;
    return this.view.scrollTop === elementTop - stickyPosition;
  }
  createStickyScrollNode(node, currentStickyNodesHeight) {
    const height = this.treeDelegate.getHeight(node);
    const { startIndex, endIndex } = this.getNodeRange(node);
    const position = this.calculateStickyNodePosition(endIndex, currentStickyNodesHeight, height);
    return { node, position, height, startIndex, endIndex };
  }
  getAncestorUnderPrevious(node, previousAncestor = void 0) {
    let currentAncestor = node;
    let parentOfcurrentAncestor = this.getParentNode(currentAncestor);
    while (parentOfcurrentAncestor) {
      if (parentOfcurrentAncestor === previousAncestor) {
        return currentAncestor;
      }
      currentAncestor = parentOfcurrentAncestor;
      parentOfcurrentAncestor = this.getParentNode(currentAncestor);
    }
    if (previousAncestor === void 0) {
      return currentAncestor;
    }
    return void 0;
  }
  calculateStickyNodePosition(lastDescendantIndex, stickyRowPositionTop, stickyNodeHeight) {
    let lastChildRelativeTop = this.view.getRelativeTop(lastDescendantIndex);
    if (lastChildRelativeTop === null && this.view.firstVisibleIndex === lastDescendantIndex && lastDescendantIndex + 1 < this.view.length) {
      const nodeHeight = this.treeDelegate.getHeight(this.view.element(lastDescendantIndex));
      const nextNodeRelativeTop = this.view.getRelativeTop(lastDescendantIndex + 1);
      lastChildRelativeTop = nextNodeRelativeTop ? nextNodeRelativeTop - nodeHeight / this.view.renderHeight : null;
    }
    if (lastChildRelativeTop === null) {
      return stickyRowPositionTop;
    }
    const lastChildNode = this.view.element(lastDescendantIndex);
    const lastChildHeight = this.treeDelegate.getHeight(lastChildNode);
    const topOfLastChild = lastChildRelativeTop * this.view.renderHeight;
    const bottomOfLastChild = topOfLastChild + lastChildHeight;
    if (stickyRowPositionTop + stickyNodeHeight > bottomOfLastChild && stickyRowPositionTop <= bottomOfLastChild) {
      return bottomOfLastChild - stickyNodeHeight;
    }
    return stickyRowPositionTop;
  }
  constrainStickyNodes(stickyNodes) {
    if (stickyNodes.length === 0) {
      return [];
    }
    const maximumStickyWidgetHeight = this.view.renderHeight * this.maxWidgetViewRatio;
    const lastStickyNode = stickyNodes[stickyNodes.length - 1];
    if (stickyNodes.length <= this.stickyScrollMaxItemCount && lastStickyNode.position + lastStickyNode.height <= maximumStickyWidgetHeight) {
      return stickyNodes;
    }
    const constrainedStickyNodes = this.stickyScrollDelegate.constrainStickyScrollNodes(stickyNodes, this.stickyScrollMaxItemCount, maximumStickyWidgetHeight);
    if (!constrainedStickyNodes.length) {
      return [];
    }
    const lastConstrainedStickyNode = constrainedStickyNodes[constrainedStickyNodes.length - 1];
    if (constrainedStickyNodes.length > this.stickyScrollMaxItemCount || lastConstrainedStickyNode.position + lastConstrainedStickyNode.height > maximumStickyWidgetHeight) {
      throw new Error("stickyScrollDelegate violates constraints");
    }
    return constrainedStickyNodes;
  }
  getParentNode(node) {
    const nodeLocation = this.model.getNodeLocation(node);
    const parentLocation = this.model.getParentNodeLocation(nodeLocation);
    return parentLocation ? this.model.getNode(parentLocation) : void 0;
  }
  nodeIsUncollapsedParent(node) {
    const nodeLocation = this.model.getNodeLocation(node);
    return this.model.getListRenderCount(nodeLocation) > 1;
  }
  getNodeIndex(node) {
    const nodeLocation = this.model.getNodeLocation(node);
    const nodeIndex = this.model.getListIndex(nodeLocation);
    return nodeIndex;
  }
  getNodeRange(node) {
    const nodeLocation = this.model.getNodeLocation(node);
    const startIndex = this.model.getListIndex(nodeLocation);
    if (startIndex < 0) {
      throw new Error("Node not found in tree");
    }
    const renderCount = this.model.getListRenderCount(nodeLocation);
    const endIndex = startIndex + renderCount - 1;
    return { startIndex, endIndex };
  }
  nodePositionTopBelowWidget(node) {
    const ancestors = [];
    let currentAncestor = this.getParentNode(node);
    while (currentAncestor) {
      ancestors.push(currentAncestor);
      currentAncestor = this.getParentNode(currentAncestor);
    }
    let widgetHeight = 0;
    for (let i = 0; i < ancestors.length && i < this.stickyScrollMaxItemCount; i++) {
      widgetHeight += this.treeDelegate.getHeight(ancestors[i]);
    }
    return widgetHeight;
  }
  getFocus() {
    return this._widget.getFocus();
  }
  domFocus() {
    this._widget.domFocus();
  }
  // Whether sticky scroll was the last focused part in the tree or not
  focusedLast() {
    return this._widget.focusedLast();
  }
  updateOptions(optionsUpdate = {}) {
    if (optionsUpdate.paddingTop !== void 0) {
      this.paddingTop = optionsUpdate.paddingTop;
    }
    if (optionsUpdate.stickyScrollMaxItemCount !== void 0) {
      const validatedOptions = this.validateStickySettings(optionsUpdate);
      if (this.stickyScrollMaxItemCount !== validatedOptions.stickyScrollMaxItemCount) {
        this.stickyScrollMaxItemCount = validatedOptions.stickyScrollMaxItemCount;
        this.update();
      }
    }
  }
  validateStickySettings(options) {
    let stickyScrollMaxItemCount = 7;
    if (typeof options.stickyScrollMaxItemCount === "number") {
      stickyScrollMaxItemCount = Math.max(options.stickyScrollMaxItemCount, 1);
    }
    return { stickyScrollMaxItemCount };
  }
}
class StickyScrollWidget {
  constructor(container, view, tree, treeRenderers, treeDelegate, accessibilityProvider) {
    this.view = view;
    this.tree = tree;
    this.treeRenderers = treeRenderers;
    this.treeDelegate = treeDelegate;
    this.accessibilityProvider = accessibilityProvider;
    this._previousElements = [];
    this._previousStateDisposables = new DisposableStore();
    this._rootDomNode = $(".monaco-tree-sticky-container.empty");
    container.appendChild(this._rootDomNode);
    const shadow = $(".monaco-tree-sticky-container-shadow");
    this._rootDomNode.appendChild(shadow);
    this.stickyScrollFocus = new StickyScrollFocus(this._rootDomNode, view);
    this.onDidChangeHasFocus = this.stickyScrollFocus.onDidChangeHasFocus;
    this.onContextMenu = this.stickyScrollFocus.onContextMenu;
  }
  get state() {
    return this._previousState;
  }
  get height() {
    if (!this._previousState) {
      return 0;
    }
    const lastElement = this._previousState.stickyNodes[this._previousState.count - 1];
    return lastElement.position + lastElement.height;
  }
  get count() {
    return this._previousState?.count ?? 0;
  }
  getNode(node) {
    return this._previousState?.stickyNodes.find((stickyNode) => stickyNode.node === node);
  }
  setState(state) {
    const wasVisible = !!this._previousState && this._previousState.count > 0;
    const isVisible = !!state && state.count > 0;
    if (!wasVisible && !isVisible || wasVisible && isVisible && this._previousState.equal(state)) {
      return;
    }
    if (wasVisible !== isVisible) {
      this.setVisible(isVisible);
    }
    if (!isVisible) {
      this._previousState = void 0;
      this._previousElements = [];
      this._previousStateDisposables.clear();
      return;
    }
    const lastStickyNode = state.stickyNodes[state.count - 1];
    if (this._previousState && state.animationStateChanged(this._previousState)) {
      this._previousElements[this._previousState.count - 1].style.top = `${lastStickyNode.position}px`;
    } else {
      this.renderState(state);
    }
    this._previousState = state;
    this._rootDomNode.style.height = `${lastStickyNode.position + lastStickyNode.height}px`;
  }
  renderState(state) {
    this._previousStateDisposables.clear();
    const elements = Array(state.count);
    for (let stickyIndex = state.count - 1; stickyIndex >= 0; stickyIndex--) {
      const stickyNode = state.stickyNodes[stickyIndex];
      const { element, disposable } = this.createElement(stickyNode, stickyIndex, state.count);
      elements[stickyIndex] = element;
      this._rootDomNode.appendChild(element);
      this._previousStateDisposables.add(disposable);
    }
    this.stickyScrollFocus.updateElements(elements, state);
    this._previousElements = elements;
  }
  rerender() {
    if (this._previousState) {
      this.renderState(this._previousState);
    }
  }
  createElement(stickyNode, stickyIndex, stickyNodesTotal) {
    const nodeIndex = stickyNode.startIndex;
    const stickyElement = document.createElement("div");
    stickyElement.style.top = `${stickyNode.position}px`;
    if (this.tree.options.setRowHeight !== false) {
      stickyElement.style.height = `${stickyNode.height}px`;
    }
    if (this.tree.options.setRowLineHeight !== false) {
      stickyElement.style.lineHeight = `${stickyNode.height}px`;
    }
    stickyElement.classList.add("monaco-tree-sticky-row");
    stickyElement.classList.add("monaco-list-row");
    stickyElement.setAttribute("data-index", `${nodeIndex}`);
    stickyElement.setAttribute("data-parity", nodeIndex % 2 === 0 ? "even" : "odd");
    stickyElement.setAttribute("id", this.view.getElementID(nodeIndex));
    const accessibilityDisposable = this.setAccessibilityAttributes(stickyElement, stickyNode.node.element, stickyIndex, stickyNodesTotal);
    const nodeTemplateId = this.treeDelegate.getTemplateId(stickyNode.node);
    const renderer = this.treeRenderers.find((renderer2) => renderer2.templateId === nodeTemplateId);
    if (!renderer) {
      throw new Error(`No renderer found for template id ${nodeTemplateId}`);
    }
    let nodeCopy = stickyNode.node;
    if (nodeCopy === this.tree.getNode(this.tree.getNodeLocation(stickyNode.node))) {
      nodeCopy = new Proxy(stickyNode.node, {});
    }
    const templateData = renderer.renderTemplate(stickyElement);
    renderer.renderElement(nodeCopy, stickyNode.startIndex, templateData, stickyNode.height);
    const disposable = toDisposable(() => {
      accessibilityDisposable.dispose();
      renderer.disposeElement(nodeCopy, stickyNode.startIndex, templateData, stickyNode.height);
      renderer.disposeTemplate(templateData);
      stickyElement.remove();
    });
    return { element: stickyElement, disposable };
  }
  setAccessibilityAttributes(container, element, stickyIndex, stickyNodesTotal) {
    if (!this.accessibilityProvider) {
      return Disposable.None;
    }
    if (this.accessibilityProvider.getSetSize) {
      container.setAttribute("aria-setsize", String(this.accessibilityProvider.getSetSize(element, stickyIndex, stickyNodesTotal)));
    }
    if (this.accessibilityProvider.getPosInSet) {
      container.setAttribute("aria-posinset", String(this.accessibilityProvider.getPosInSet(element, stickyIndex)));
    }
    if (this.accessibilityProvider.getRole) {
      container.setAttribute("role", this.accessibilityProvider.getRole(element) ?? "treeitem");
    }
    const ariaLabel = this.accessibilityProvider.getAriaLabel(element);
    const observable = ariaLabel && typeof ariaLabel !== "string" ? ariaLabel : constObservable(ariaLabel);
    const result = autorun((reader) => {
      const value = reader.readObservable(observable);
      if (value) {
        container.setAttribute("aria-label", value);
      } else {
        container.removeAttribute("aria-label");
      }
    });
    if (typeof ariaLabel === "string") {
    } else if (ariaLabel) {
      container.setAttribute("aria-label", ariaLabel.get());
    }
    const ariaLevel = this.accessibilityProvider.getAriaLevel && this.accessibilityProvider.getAriaLevel(element);
    if (typeof ariaLevel === "number") {
      container.setAttribute("aria-level", `${ariaLevel}`);
    }
    container.setAttribute("aria-selected", String(false));
    return result;
  }
  setVisible(visible) {
    this._rootDomNode.classList.toggle("empty", !visible);
    if (!visible) {
      this.stickyScrollFocus.updateElements([], void 0);
    }
  }
  getFocus() {
    return this.stickyScrollFocus.getFocus();
  }
  domFocus() {
    this.stickyScrollFocus.domFocus();
  }
  focusedLast() {
    return this.stickyScrollFocus.focusedLast();
  }
  dispose() {
    this.stickyScrollFocus.dispose();
    this._previousStateDisposables.dispose();
    this._rootDomNode.remove();
  }
}
class StickyScrollFocus extends Disposable {
  constructor(container, view) {
    super();
    this.container = container;
    this.view = view;
    this.focusedIndex = -1;
    this.elements = [];
    this._onDidChangeHasFocus = new Emitter();
    this.onDidChangeHasFocus = this._onDidChangeHasFocus.event;
    this._onContextMenu = new Emitter();
    this.onContextMenu = this._onContextMenu.event;
    this._domHasFocus = false;
    this._register(addDisposableListener(this.container, "focus", () => this.onFocus()));
    this._register(addDisposableListener(this.container, "blur", () => this.onBlur()));
    this._register(this.view.onDidFocus(() => this.toggleStickyScrollFocused(false)));
    this._register(this.view.onKeyDown((e) => this.onKeyDown(e)));
    this._register(this.view.onMouseDown((e) => this.onMouseDown(e)));
    this._register(this.view.onContextMenu((e) => this.handleContextMenu(e)));
  }
  get domHasFocus() {
    return this._domHasFocus;
  }
  set domHasFocus(hasFocus) {
    if (hasFocus !== this._domHasFocus) {
      this._onDidChangeHasFocus.fire(hasFocus);
      this._domHasFocus = hasFocus;
    }
  }
  handleContextMenu(e) {
    const target = e.browserEvent.target;
    if (!isStickyScrollContainer(target) && !isStickyScrollElement(target)) {
      if (this.focusedLast()) {
        this.view.domFocus();
      }
      return;
    }
    if (!isKeyboardEvent(e.browserEvent)) {
      if (!this.state) {
        throw new Error("Context menu should not be triggered when state is undefined");
      }
      const stickyIndex = this.state.stickyNodes.findIndex((stickyNode2) => stickyNode2.node.element === e.element?.element);
      if (stickyIndex === -1) {
        throw new Error("Context menu should not be triggered when element is not in sticky scroll widget");
      }
      this.container.focus();
      this.setFocus(stickyIndex);
      return;
    }
    if (!this.state || this.focusedIndex < 0) {
      throw new Error("Context menu key should not be triggered when focus is not in sticky scroll widget");
    }
    const stickyNode = this.state.stickyNodes[this.focusedIndex];
    const element = stickyNode.node.element;
    const anchor = this.elements[this.focusedIndex];
    this._onContextMenu.fire({ element, anchor, browserEvent: e.browserEvent, isStickyScroll: true });
  }
  onKeyDown(e) {
    if (this.domHasFocus && this.state) {
      if (e.key === "ArrowUp") {
        this.setFocusedElement(Math.max(0, this.focusedIndex - 1));
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        if (this.focusedIndex >= this.state.count - 1) {
          const nodeIndexToFocus = this.state.stickyNodes[this.state.count - 1].startIndex + 1;
          this.view.domFocus();
          this.view.setFocus([nodeIndexToFocus]);
          this.scrollNodeUnderWidget(nodeIndexToFocus, this.state);
        } else {
          this.setFocusedElement(this.focusedIndex + 1);
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }
  onMouseDown(e) {
    const target = e.browserEvent.target;
    if (!isStickyScrollContainer(target) && !isStickyScrollElement(target)) {
      return;
    }
    e.browserEvent.preventDefault();
    e.browserEvent.stopPropagation();
  }
  updateElements(elements, state) {
    if (state && state.count === 0) {
      throw new Error("Sticky scroll state must be undefined when there are no sticky nodes");
    }
    if (state && state.count !== elements.length) {
      throw new Error("Sticky scroll focus received illigel state");
    }
    const previousIndex = this.focusedIndex;
    this.removeFocus();
    this.elements = elements;
    this.state = state;
    if (state) {
      const newFocusedIndex = clamp(previousIndex, 0, state.count - 1);
      this.setFocus(newFocusedIndex);
    } else {
      if (this.domHasFocus) {
        this.view.domFocus();
      }
    }
    this.container.tabIndex = state ? 0 : -1;
  }
  setFocusedElement(stickyIndex) {
    const state = this.state;
    if (!state) {
      throw new Error("Cannot set focus when state is undefined");
    }
    this.setFocus(stickyIndex);
    if (stickyIndex < state.count - 1) {
      return;
    }
    if (state.lastNodePartiallyVisible()) {
      const lastStickyNode = state.stickyNodes[stickyIndex];
      this.scrollNodeUnderWidget(lastStickyNode.endIndex + 1, state);
    }
  }
  scrollNodeUnderWidget(nodeIndex, state) {
    const lastStickyNode = state.stickyNodes[state.count - 1];
    const secondLastStickyNode = state.count > 1 ? state.stickyNodes[state.count - 2] : void 0;
    const elementScrollTop = this.view.getElementTop(nodeIndex);
    const elementTargetViewTop = secondLastStickyNode ? secondLastStickyNode.position + secondLastStickyNode.height + lastStickyNode.height : lastStickyNode.height;
    this.view.scrollTop = elementScrollTop - elementTargetViewTop;
  }
  getFocus() {
    if (!this.state || this.focusedIndex === -1) {
      return void 0;
    }
    return this.state.stickyNodes[this.focusedIndex].node.element;
  }
  domFocus() {
    if (!this.state) {
      throw new Error("Cannot focus when state is undefined");
    }
    this.container.focus();
  }
  focusedLast() {
    if (!this.state) {
      return false;
    }
    return this.view.getHTMLElement().classList.contains("sticky-scroll-focused");
  }
  removeFocus() {
    if (this.focusedIndex === -1) {
      return;
    }
    this.toggleElementFocus(this.elements[this.focusedIndex], false);
    this.focusedIndex = -1;
  }
  setFocus(newFocusIndex) {
    if (0 > newFocusIndex) {
      throw new Error("addFocus() can not remove focus");
    }
    if (!this.state && newFocusIndex >= 0) {
      throw new Error("Cannot set focus index when state is undefined");
    }
    if (this.state && newFocusIndex >= this.state.count) {
      throw new Error("Cannot set focus index to an index that does not exist");
    }
    const oldIndex = this.focusedIndex;
    if (oldIndex >= 0) {
      this.toggleElementFocus(this.elements[oldIndex], false);
    }
    if (newFocusIndex >= 0) {
      this.toggleElementFocus(this.elements[newFocusIndex], true);
    }
    this.focusedIndex = newFocusIndex;
  }
  toggleElementFocus(element, focused) {
    this.toggleElementActiveFocus(element, focused && this.domHasFocus);
    this.toggleElementPassiveFocus(element, focused);
  }
  toggleCurrentElementActiveFocus(focused) {
    if (this.focusedIndex === -1) {
      return;
    }
    this.toggleElementActiveFocus(this.elements[this.focusedIndex], focused);
  }
  toggleElementActiveFocus(element, focused) {
    element.classList.toggle("focused", focused);
  }
  toggleElementPassiveFocus(element, focused) {
    element.classList.toggle("passive-focused", focused);
  }
  toggleStickyScrollFocused(focused) {
    this.view.getHTMLElement().classList.toggle("sticky-scroll-focused", focused);
  }
  onFocus() {
    if (!this.state || this.elements.length === 0) {
      throw new Error("Cannot focus when state is undefined or elements are empty");
    }
    this.domHasFocus = true;
    this.toggleStickyScrollFocused(true);
    this.toggleCurrentElementActiveFocus(true);
    if (this.focusedIndex === -1) {
      this.setFocus(0);
    }
  }
  onBlur() {
    this.domHasFocus = false;
    this.toggleCurrentElementActiveFocus(false);
  }
  dispose() {
    this.toggleStickyScrollFocused(false);
    this._onDidChangeHasFocus.fire(false);
    super.dispose();
  }
}
function asTreeMouseEvent(event) {
  let target = TreeMouseEventTarget.Unknown;
  if (hasParentWithClass(event.browserEvent.target, "monaco-tl-twistie", "monaco-tl-row")) {
    target = TreeMouseEventTarget.Twistie;
  } else if (hasParentWithClass(event.browserEvent.target, "monaco-tl-contents", "monaco-tl-row")) {
    target = TreeMouseEventTarget.Element;
  } else if (hasParentWithClass(event.browserEvent.target, "monaco-tree-type-filter", "monaco-list")) {
    target = TreeMouseEventTarget.Filter;
  }
  return {
    browserEvent: event.browserEvent,
    element: event.element ? event.element.element : null,
    target
  };
}
function asTreeContextMenuEvent(event) {
  const isStickyScroll = isStickyScrollContainer(event.browserEvent.target);
  return {
    element: event.element ? event.element.element : null,
    browserEvent: event.browserEvent,
    anchor: event.anchor,
    isStickyScroll
  };
}
function dfs(node, fn) {
  fn(node);
  node.children.forEach((child) => dfs(child, fn));
}
class Trait {
  constructor(getFirstViewElementWithTrait, identityProvider) {
    this.getFirstViewElementWithTrait = getFirstViewElementWithTrait;
    this.identityProvider = identityProvider;
    this.nodes = [];
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
  }
  get nodeSet() {
    if (!this._nodeSet) {
      this._nodeSet = this.createNodeSet();
    }
    return this._nodeSet;
  }
  set(nodes, browserEvent) {
    if (!browserEvent?.__forceEvent && equals(this.nodes, nodes)) {
      return;
    }
    this._set(nodes, false, browserEvent);
  }
  _set(nodes, silent, browserEvent) {
    this.nodes = [...nodes];
    this.elements = void 0;
    this._nodeSet = void 0;
    if (!silent) {
      const that = this;
      this._onDidChange.fire({ get elements() {
        return that.get();
      }, browserEvent });
    }
  }
  get() {
    if (!this.elements) {
      this.elements = this.nodes.map((node) => node.element);
    }
    return [...this.elements];
  }
  getNodes() {
    return this.nodes;
  }
  has(node) {
    return this.nodeSet.has(node);
  }
  onDidModelSplice({ insertedNodes, deletedNodes }) {
    if (!this.identityProvider) {
      const set = this.createNodeSet();
      const visit = (node) => set.delete(node);
      deletedNodes.forEach((node) => dfs(node, visit));
      this.set([...set.values()]);
      return;
    }
    const deletedNodesIdSet = /* @__PURE__ */ new Set();
    const deletedNodesVisitor = (node) => deletedNodesIdSet.add(this.identityProvider.getId(node.element).toString());
    deletedNodes.forEach((node) => dfs(node, deletedNodesVisitor));
    const insertedNodesMap = /* @__PURE__ */ new Map();
    const insertedNodesVisitor = (node) => insertedNodesMap.set(this.identityProvider.getId(node.element).toString(), node);
    insertedNodes.forEach((node) => dfs(node, insertedNodesVisitor));
    const nodes = [];
    for (const node of this.nodes) {
      const id = this.identityProvider.getId(node.element).toString();
      const wasDeleted = deletedNodesIdSet.has(id);
      if (!wasDeleted) {
        nodes.push(node);
      } else {
        const insertedNode = insertedNodesMap.get(id);
        if (insertedNode && insertedNode.visible) {
          nodes.push(insertedNode);
        }
      }
    }
    if (this.nodes.length > 0 && nodes.length === 0) {
      const node = this.getFirstViewElementWithTrait();
      if (node) {
        nodes.push(node);
      }
    }
    this._set(nodes, true);
  }
  createNodeSet() {
    const set = /* @__PURE__ */ new Set();
    for (const node of this.nodes) {
      set.add(node);
    }
    return set;
  }
}
class TreeNodeListMouseController extends MouseController {
  constructor(list, tree, stickyScrollProvider) {
    super(list);
    this.tree = tree;
    this.stickyScrollProvider = stickyScrollProvider;
  }
  onViewPointer(e) {
    if (isButton(e.browserEvent.target) || isEditableElement(e.browserEvent.target) || isMonacoEditor(e.browserEvent.target)) {
      return;
    }
    if (e.browserEvent.isHandledByList) {
      return;
    }
    const node = e.element;
    if (!node) {
      return super.onViewPointer(e);
    }
    if (this.isSelectionRangeChangeEvent(e) || this.isSelectionSingleChangeEvent(e)) {
      return super.onViewPointer(e);
    }
    const target = e.browserEvent.target;
    const onTwistie = target.classList.contains("monaco-tl-twistie") || target.classList.contains("monaco-icon-label") && target.classList.contains("folder-icon") && e.browserEvent.offsetX < 16;
    const isStickyElement = isStickyScrollElement(e.browserEvent.target);
    let expandOnlyOnTwistieClick = false;
    if (isStickyElement) {
      expandOnlyOnTwistieClick = true;
    } else if (typeof this.tree.expandOnlyOnTwistieClick === "function") {
      expandOnlyOnTwistieClick = this.tree.expandOnlyOnTwistieClick(node.element);
    } else {
      expandOnlyOnTwistieClick = !!this.tree.expandOnlyOnTwistieClick;
    }
    if (!isStickyElement) {
      if (expandOnlyOnTwistieClick && !onTwistie && e.browserEvent.detail !== 2) {
        return super.onViewPointer(e);
      }
      if (!this.tree.expandOnDoubleClick && e.browserEvent.detail === 2) {
        return super.onViewPointer(e);
      }
    } else {
      this.handleStickyScrollMouseEvent(e, node);
    }
    if (node.collapsible && (!isStickyElement || onTwistie)) {
      const location = this.tree.getNodeLocation(node);
      const recursive = e.browserEvent.altKey;
      this.tree.setFocus([location]);
      this.tree.toggleCollapsed(location, recursive);
      if (onTwistie) {
        e.browserEvent.isHandledByList = true;
        return;
      }
    }
    if (!isStickyElement) {
      super.onViewPointer(e);
    }
  }
  handleStickyScrollMouseEvent(e, node) {
    if (isMonacoCustomToggle(e.browserEvent.target) || isActionItem(e.browserEvent.target)) {
      return;
    }
    const stickyScrollController = this.stickyScrollProvider();
    if (!stickyScrollController) {
      throw new Error("Sticky scroll controller not found");
    }
    const nodeIndex = this.list.indexOf(node);
    const elementScrollTop = this.list.getElementTop(nodeIndex);
    const elementTargetViewTop = stickyScrollController.nodePositionTopBelowWidget(node);
    this.tree.scrollTop = elementScrollTop - elementTargetViewTop;
    this.list.domFocus();
    this.list.setFocus([nodeIndex]);
    this.list.setSelection([nodeIndex]);
  }
  onDoubleClick(e) {
    const onTwistie = e.browserEvent.target.classList.contains("monaco-tl-twistie");
    if (onTwistie || !this.tree.expandOnDoubleClick) {
      return;
    }
    if (e.browserEvent.isHandledByList) {
      return;
    }
    super.onDoubleClick(e);
  }
  // to make sure dom focus is not stolen (for example with context menu)
  onMouseDown(e) {
    const target = e.browserEvent.target;
    if (!isStickyScrollContainer(target) && !isStickyScrollElement(target)) {
      super.onMouseDown(e);
      return;
    }
  }
  onContextMenu(e) {
    const target = e.browserEvent.target;
    if (!isStickyScrollContainer(target) && !isStickyScrollElement(target)) {
      super.onContextMenu(e);
      return;
    }
  }
}
class TreeNodeList extends List {
  constructor(user, container, virtualDelegate, renderers, focusTrait, selectionTrait, anchorTrait, options) {
    super(user, container, virtualDelegate, renderers, options);
    this.focusTrait = focusTrait;
    this.selectionTrait = selectionTrait;
    this.anchorTrait = anchorTrait;
  }
  createMouseController(options) {
    return new TreeNodeListMouseController(this, options.tree, options.stickyScrollProvider);
  }
  splice(start, deleteCount, elements = []) {
    super.splice(start, deleteCount, elements);
    if (elements.length === 0) {
      return;
    }
    const additionalFocus = [];
    const additionalSelection = [];
    let anchor;
    elements.forEach((node, index) => {
      if (this.focusTrait.has(node)) {
        additionalFocus.push(start + index);
      }
      if (this.selectionTrait.has(node)) {
        additionalSelection.push(start + index);
      }
      if (this.anchorTrait.has(node)) {
        anchor = start + index;
      }
    });
    if (additionalFocus.length > 0) {
      super.setFocus(distinct([...super.getFocus(), ...additionalFocus]));
    }
    if (additionalSelection.length > 0) {
      super.setSelection(distinct([...super.getSelection(), ...additionalSelection]));
    }
    if (typeof anchor === "number") {
      super.setAnchor(anchor);
    }
  }
  setFocus(indexes, browserEvent, fromAPI = false) {
    super.setFocus(indexes, browserEvent);
    if (!fromAPI) {
      this.focusTrait.set(indexes.map((i) => this.element(i)), browserEvent);
    }
  }
  setSelection(indexes, browserEvent, fromAPI = false) {
    super.setSelection(indexes, browserEvent);
    if (!fromAPI) {
      this.selectionTrait.set(indexes.map((i) => this.element(i)), browserEvent);
    }
  }
  setAnchor(index, fromAPI = false) {
    super.setAnchor(index);
    if (!fromAPI) {
      if (typeof index === "undefined") {
        this.anchorTrait.set([]);
      } else {
        this.anchorTrait.set([this.element(index)]);
      }
    }
  }
}
var AbstractTreePart = /* @__PURE__ */ ((AbstractTreePart2) => {
  AbstractTreePart2[AbstractTreePart2["Tree"] = 0] = "Tree";
  AbstractTreePart2[AbstractTreePart2["StickyScroll"] = 1] = "StickyScroll";
  return AbstractTreePart2;
})(AbstractTreePart || {});
class AbstractTree {
  constructor(_user, container, delegate, renderers, _options = {}) {
    this._user = _user;
    this._options = _options;
    this.eventBufferer = new EventBufferer();
    this.onDidChangeFindOpenState = Event.None;
    this.onDidChangeStickyScrollFocused = Event.None;
    this.disposables = new DisposableStore();
    this.onDidSwapModel = this.disposables.add(new Emitter());
    this.onDidChangeModelRelay = this.disposables.add(new Relay());
    this.onDidSpliceModelRelay = this.disposables.add(new Relay());
    this.onDidChangeCollapseStateRelay = this.disposables.add(new Relay());
    this.onDidChangeRenderNodeCountRelay = this.disposables.add(new Relay());
    this.onDidChangeActiveNodesRelay = this.disposables.add(new Relay());
    this._onWillRefilter = new Emitter();
    this.onWillRefilter = this._onWillRefilter.event;
    this._onDidUpdateOptions = new Emitter();
    this.onDidUpdateOptions = this._onDidUpdateOptions.event;
    this.modelDisposables = new DisposableStore();
    if (_options.keyboardNavigationLabelProvider && (_options.findWidgetEnabled ?? true)) {
      this.findFilter = new FindFilter(_options.keyboardNavigationLabelProvider, _options.filter, _options.defaultFindVisibility);
      _options = { ..._options, filter: this.findFilter };
      this.disposables.add(this.findFilter);
    }
    this.model = this.createModel(_user, _options);
    this.treeDelegate = new ComposedTreeDelegate(delegate);
    const activeNodes = this.disposables.add(new EventCollection(this.onDidChangeActiveNodesRelay.event));
    const renderedIndentGuides = new SetMap();
    this.renderers = renderers.map((r) => new TreeRenderer(r, this.model, this.onDidChangeCollapseStateRelay.event, activeNodes, renderedIndentGuides, _options));
    for (const r of this.renderers) {
      this.disposables.add(r);
    }
    this.focus = new Trait(() => this.view.getFocusedElements()[0], _options.identityProvider);
    this.selection = new Trait(() => this.view.getSelectedElements()[0], _options.identityProvider);
    this.anchor = new Trait(() => this.view.getAnchorElement(), _options.identityProvider);
    this.view = new TreeNodeList(_user, container, this.treeDelegate, this.renderers, this.focus, this.selection, this.anchor, { ...asListOptions(() => this.model, this.disposables, _options), tree: this, stickyScrollProvider: () => this.stickyScrollController });
    this.setupModel(this.model);
    if (_options.keyboardSupport !== false) {
      const onKeyDown = Event.chain(
        this.view.onKeyDown,
        ($2) => $2.filter((e) => !isEditableElement(e.target)).map((e) => new StandardKeyboardEvent(e))
      );
      Event.chain(onKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.LeftArrow))(this.onLeftArrow, this, this.disposables);
      Event.chain(onKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.RightArrow))(this.onRightArrow, this, this.disposables);
      Event.chain(onKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.Space))(this.onSpace, this, this.disposables);
    }
    if ((_options.findWidgetEnabled ?? true) && _options.keyboardNavigationLabelProvider && _options.contextViewProvider) {
      const findOptions = {
        styles: _options.findWidgetStyles,
        defaultFindMode: _options.defaultFindMode,
        defaultFindMatchType: _options.defaultFindMatchType,
        showNotFoundMessage: _options.showNotFoundMessage
      };
      this.findController = this.disposables.add(new FindController(this, this.findFilter, _options.contextViewProvider, findOptions));
      this.focusNavigationFilter = (node) => this.findController.shouldAllowFocus(node);
      this.onDidChangeFindOpenState = this.findController.onDidChangeOpenState;
      this.onDidChangeFindMode = this.findController.onDidChangeMode;
      this.onDidChangeFindMatchType = this.findController.onDidChangeMatchType;
    } else {
      this.onDidChangeFindMode = Event.None;
      this.onDidChangeFindMatchType = Event.None;
    }
    if (_options.enableStickyScroll) {
      this.stickyScrollController = new StickyScrollController(this, this.model, this.view, this.renderers, this.treeDelegate, _options);
      this.onDidChangeStickyScrollFocused = this.stickyScrollController.onDidChangeHasFocus;
    }
    this.styleElement = createStyleSheet(this.view.getHTMLElement());
    this.getHTMLElement().classList.toggle("always", this._options.renderIndentGuides === "always" /* Always */);
  }
  get onDidScroll() {
    return this.view.onDidScroll;
  }
  get onDidChangeFocus() {
    return this.eventBufferer.wrapEvent(this.focus.onDidChange);
  }
  get onDidChangeSelection() {
    return this.eventBufferer.wrapEvent(this.selection.onDidChange);
  }
  get onMouseClick() {
    return Event.map(this.view.onMouseClick, asTreeMouseEvent);
  }
  get onMouseDblClick() {
    return Event.filter(Event.map(this.view.onMouseDblClick, asTreeMouseEvent), (e) => e.target !== TreeMouseEventTarget.Filter);
  }
  get onMouseOver() {
    return Event.map(this.view.onMouseOver, asTreeMouseEvent);
  }
  get onMouseOut() {
    return Event.map(this.view.onMouseOut, asTreeMouseEvent);
  }
  get onContextMenu() {
    return Event.any(Event.filter(Event.map(this.view.onContextMenu, asTreeContextMenuEvent), (e) => !e.isStickyScroll), this.stickyScrollController?.onContextMenu ?? Event.None);
  }
  get onTap() {
    return Event.map(this.view.onTap, asTreeMouseEvent);
  }
  get onPointer() {
    return Event.map(this.view.onPointer, asTreeMouseEvent);
  }
  get onKeyDown() {
    return this.view.onKeyDown;
  }
  get onKeyUp() {
    return this.view.onKeyUp;
  }
  get onKeyPress() {
    return this.view.onKeyPress;
  }
  get onDidFocus() {
    return this.view.onDidFocus;
  }
  get onDidBlur() {
    return this.view.onDidBlur;
  }
  get onDidChangeModel() {
    return Event.any(this.onDidChangeModelRelay.event, this.onDidSwapModel.event);
  }
  get onDidChangeCollapseState() {
    return this.onDidChangeCollapseStateRelay.event;
  }
  get onDidChangeRenderNodeCount() {
    return this.onDidChangeRenderNodeCountRelay.event;
  }
  get findMode() {
    return this.findController?.mode ?? 0 /* Highlight */;
  }
  set findMode(findMode) {
    if (this.findController) {
      this.findController.mode = findMode;
    }
  }
  get findMatchType() {
    return this.findController?.matchType ?? 0 /* Fuzzy */;
  }
  set findMatchType(findFuzzy) {
    if (this.findController) {
      this.findController.matchType = findFuzzy;
    }
  }
  get onDidChangeFindPattern() {
    return this.findController ? this.findController.onDidChangePattern : Event.None;
  }
  get expandOnDoubleClick() {
    return typeof this._options.expandOnDoubleClick === "undefined" ? true : this._options.expandOnDoubleClick;
  }
  get expandOnlyOnTwistieClick() {
    return typeof this._options.expandOnlyOnTwistieClick === "undefined" ? true : this._options.expandOnlyOnTwistieClick;
  }
  get onDidDispose() {
    return this.view.onDidDispose;
  }
  updateOptions(optionsUpdate = {}) {
    this._options = { ...this._options, ...optionsUpdate };
    for (const renderer of this.renderers) {
      renderer.updateOptions(optionsUpdate);
    }
    this.view.updateOptions(this._options);
    this.findController?.updateOptions(optionsUpdate);
    this.updateStickyScroll(optionsUpdate);
    this._onDidUpdateOptions.fire(this._options);
    this.getHTMLElement().classList.toggle("always", this._options.renderIndentGuides === "always" /* Always */);
  }
  get options() {
    return this._options;
  }
  updateStickyScroll(optionsUpdate) {
    if (!this.stickyScrollController && this._options.enableStickyScroll) {
      this.stickyScrollController = new StickyScrollController(this, this.model, this.view, this.renderers, this.treeDelegate, this._options);
      this.onDidChangeStickyScrollFocused = this.stickyScrollController.onDidChangeHasFocus;
    } else if (this.stickyScrollController && !this._options.enableStickyScroll) {
      this.onDidChangeStickyScrollFocused = Event.None;
      this.stickyScrollController.dispose();
      this.stickyScrollController = void 0;
    }
    this.stickyScrollController?.updateOptions(optionsUpdate);
  }
  updateWidth(element) {
    const index = this.model.getListIndex(element);
    if (index === -1) {
      return;
    }
    this.view.updateWidth(index);
  }
  // Widget
  getHTMLElement() {
    return this.view.getHTMLElement();
  }
  get contentHeight() {
    return this.view.contentHeight;
  }
  get contentWidth() {
    return this.view.contentWidth;
  }
  get onDidChangeContentHeight() {
    return this.view.onDidChangeContentHeight;
  }
  get onDidChangeContentWidth() {
    return this.view.onDidChangeContentWidth;
  }
  get scrollTop() {
    return this.view.scrollTop;
  }
  set scrollTop(scrollTop) {
    this.view.scrollTop = scrollTop;
  }
  get scrollLeft() {
    return this.view.scrollLeft;
  }
  set scrollLeft(scrollLeft) {
    this.view.scrollLeft = scrollLeft;
  }
  get scrollHeight() {
    return this.view.scrollHeight;
  }
  get renderHeight() {
    return this.view.renderHeight;
  }
  get firstVisibleElement() {
    let index = this.view.firstVisibleIndex;
    if (this.stickyScrollController) {
      index += this.stickyScrollController.count;
    }
    if (index < 0 || index >= this.view.length) {
      return void 0;
    }
    const node = this.view.element(index);
    return node.element;
  }
  get lastVisibleElement() {
    const index = this.view.lastVisibleIndex;
    const node = this.view.element(index);
    return node.element;
  }
  get ariaLabel() {
    return this.view.ariaLabel;
  }
  set ariaLabel(value) {
    this.view.ariaLabel = value;
  }
  get selectionSize() {
    return this.selection.getNodes().length;
  }
  domFocus() {
    if (this.stickyScrollController?.focusedLast()) {
      this.stickyScrollController.domFocus();
    } else {
      this.view.domFocus();
    }
  }
  isDOMFocused() {
    return isActiveElement(this.getHTMLElement());
  }
  layout(height, width) {
    this.view.layout(height, width);
  }
  style(styles) {
    const suffix = `.${this.view.domId}`;
    const content = [];
    if (styles.treeIndentGuidesStroke) {
      content.push(`.monaco-list${suffix}:hover .monaco-tl-indent > .indent-guide, .monaco-list${suffix}.always .monaco-tl-indent > .indent-guide  { border-color: ${styles.treeInactiveIndentGuidesStroke}; }`);
      content.push(`.monaco-list${suffix} .monaco-tl-indent > .indent-guide.active { border-color: ${styles.treeIndentGuidesStroke}; }`);
    }
    const stickyScrollBackground = styles.treeStickyScrollBackground ?? styles.listBackground;
    if (stickyScrollBackground) {
      content.push(`.monaco-list${suffix} .monaco-scrollable-element .monaco-tree-sticky-container { background-color: ${stickyScrollBackground}; }`);
      content.push(`.monaco-list${suffix} .monaco-scrollable-element .monaco-tree-sticky-container .monaco-tree-sticky-row { background-color: ${stickyScrollBackground}; }`);
    }
    if (styles.treeStickyScrollBorder) {
      content.push(`.monaco-list${suffix} .monaco-scrollable-element .monaco-tree-sticky-container { border-bottom: 1px solid ${styles.treeStickyScrollBorder}; }`);
    }
    if (styles.treeStickyScrollShadow) {
      content.push(`.monaco-list${suffix} .monaco-scrollable-element .monaco-tree-sticky-container .monaco-tree-sticky-container-shadow { box-shadow: ${styles.treeStickyScrollShadow} 0 6px 6px -6px inset; height: 3px; }`);
    }
    if (styles.listFocusForeground) {
      content.push(`.monaco-list${suffix}.sticky-scroll-focused .monaco-scrollable-element .monaco-tree-sticky-container:focus .monaco-list-row.focused { color: ${styles.listFocusForeground}; }`);
      content.push(`.monaco-list${suffix}:not(.sticky-scroll-focused) .monaco-scrollable-element .monaco-tree-sticky-container .monaco-list-row.focused { color: inherit; }`);
    }
    const focusAndSelectionOutline = asCssValueWithDefault(styles.listFocusAndSelectionOutline, asCssValueWithDefault(styles.listSelectionOutline, styles.listFocusOutline ?? ""));
    if (focusAndSelectionOutline) {
      content.push(`.monaco-list${suffix}.sticky-scroll-focused .monaco-scrollable-element .monaco-tree-sticky-container:focus .monaco-list-row.focused.selected { outline: 1px solid ${focusAndSelectionOutline}; outline-offset: -1px;}`);
      content.push(`.monaco-list${suffix}:not(.sticky-scroll-focused) .monaco-scrollable-element .monaco-tree-sticky-container .monaco-list-row.focused.selected { outline: inherit;}`);
    }
    if (styles.listFocusOutline) {
      content.push(`.monaco-list${suffix}.sticky-scroll-focused .monaco-scrollable-element .monaco-tree-sticky-container:focus .monaco-list-row.focused { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }`);
      content.push(`.monaco-list${suffix}:not(.sticky-scroll-focused) .monaco-scrollable-element .monaco-tree-sticky-container .monaco-list-row.focused { outline: inherit; }`);
      content.push(`.monaco-workbench.context-menu-visible .monaco-list${suffix}.last-focused.sticky-scroll-focused .monaco-scrollable-element .monaco-tree-sticky-container .monaco-list-row.passive-focused { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }`);
      content.push(`.monaco-workbench.context-menu-visible .monaco-list${suffix}.last-focused.sticky-scroll-focused .monaco-list-rows .monaco-list-row.focused { outline: inherit; }`);
      content.push(`.monaco-workbench.context-menu-visible .monaco-list${suffix}.last-focused:not(.sticky-scroll-focused) .monaco-tree-sticky-container .monaco-list-rows .monaco-list-row.focused { outline: inherit; }`);
    }
    this.styleElement.textContent = content.join("\n");
    this.view.style(styles);
  }
  // Tree navigation
  getParentElement(location) {
    const parentRef = this.model.getParentNodeLocation(location);
    const parentNode = this.model.getNode(parentRef);
    return parentNode.element;
  }
  getFirstElementChild(location) {
    return this.model.getFirstElementChild(location);
  }
  // Tree
  getNode(location) {
    return this.model.getNode(location);
  }
  getNodeLocation(node) {
    return this.model.getNodeLocation(node);
  }
  collapse(location, recursive = false) {
    return this.model.setCollapsed(location, true, recursive);
  }
  expand(location, recursive = false) {
    return this.model.setCollapsed(location, false, recursive);
  }
  toggleCollapsed(location, recursive = false) {
    return this.model.setCollapsed(location, void 0, recursive);
  }
  expandAll() {
    this.model.setCollapsed(this.model.rootRef, false, true);
  }
  collapseAll() {
    this.model.setCollapsed(this.model.rootRef, true, true);
  }
  isCollapsible(location) {
    return this.model.isCollapsible(location);
  }
  setCollapsible(location, collapsible) {
    return this.model.setCollapsible(location, collapsible);
  }
  isCollapsed(location) {
    return this.model.isCollapsed(location);
  }
  expandTo(location) {
    this.model.expandTo(location);
  }
  triggerTypeNavigation() {
    this.view.triggerTypeNavigation();
  }
  openFind() {
    this.findController?.open();
  }
  closeFind() {
    this.findController?.close();
  }
  refilter() {
    this._onWillRefilter.fire(void 0);
    this.model.refilter();
  }
  setAnchor(element) {
    if (typeof element === "undefined") {
      return this.view.setAnchor(void 0);
    }
    this.eventBufferer.bufferEvents(() => {
      const node = this.model.getNode(element);
      this.anchor.set([node]);
      const index = this.model.getListIndex(element);
      if (index > -1) {
        this.view.setAnchor(index, true);
      }
    });
  }
  getAnchor() {
    return this.anchor.get().at(0);
  }
  setSelection(elements, browserEvent) {
    this.eventBufferer.bufferEvents(() => {
      const nodes = elements.map((e) => this.model.getNode(e));
      this.selection.set(nodes, browserEvent);
      const indexes = elements.map((e) => this.model.getListIndex(e)).filter((i) => i > -1);
      this.view.setSelection(indexes, browserEvent, true);
    });
  }
  getSelection() {
    return this.selection.get();
  }
  setFocus(elements, browserEvent) {
    this.eventBufferer.bufferEvents(() => {
      const nodes = elements.map((e) => this.model.getNode(e));
      this.focus.set(nodes, browserEvent);
      const indexes = elements.map((e) => this.model.getListIndex(e)).filter((i) => i > -1);
      this.view.setFocus(indexes, browserEvent, true);
    });
  }
  focusNext(n = 1, loop = false, browserEvent, filter = isKeyboardEvent(browserEvent) && browserEvent.altKey ? void 0 : this.focusNavigationFilter) {
    this.view.focusNext(n, loop, browserEvent, filter);
  }
  focusPrevious(n = 1, loop = false, browserEvent, filter = isKeyboardEvent(browserEvent) && browserEvent.altKey ? void 0 : this.focusNavigationFilter) {
    this.view.focusPrevious(n, loop, browserEvent, filter);
  }
  focusNextPage(browserEvent, filter = isKeyboardEvent(browserEvent) && browserEvent.altKey ? void 0 : this.focusNavigationFilter) {
    return this.view.focusNextPage(browserEvent, filter);
  }
  focusPreviousPage(browserEvent, filter = isKeyboardEvent(browserEvent) && browserEvent.altKey ? void 0 : this.focusNavigationFilter) {
    return this.view.focusPreviousPage(browserEvent, filter, () => this.stickyScrollController?.height ?? 0);
  }
  focusLast(browserEvent, filter = isKeyboardEvent(browserEvent) && browserEvent.altKey ? void 0 : this.focusNavigationFilter) {
    this.view.focusLast(browserEvent, filter);
  }
  focusFirst(browserEvent, filter = isKeyboardEvent(browserEvent) && browserEvent.altKey ? void 0 : this.focusNavigationFilter) {
    this.view.focusFirst(browserEvent, filter);
  }
  getFocus() {
    return this.focus.get();
  }
  getStickyScrollFocus() {
    const focus = this.stickyScrollController?.getFocus();
    return focus !== void 0 ? [focus] : [];
  }
  getFocusedPart() {
    return this.stickyScrollController?.focusedLast() ? 1 /* StickyScroll */ : 0 /* Tree */;
  }
  reveal(location, relativeTop) {
    this.model.expandTo(location);
    const index = this.model.getListIndex(location);
    if (index === -1) {
      return;
    }
    if (!this.stickyScrollController) {
      this.view.reveal(index, relativeTop);
    } else {
      const paddingTop = this.stickyScrollController.nodePositionTopBelowWidget(this.getNode(location));
      this.view.reveal(index, relativeTop, paddingTop);
    }
  }
  /**
   * Returns the relative position of an element rendered in the list.
   * Returns `null` if the element isn't *entirely* in the visible viewport.
   */
  getRelativeTop(location) {
    const index = this.model.getListIndex(location);
    if (index === -1) {
      return null;
    }
    const stickyScrollNode = this.stickyScrollController?.getNode(this.getNode(location));
    return this.view.getRelativeTop(index, stickyScrollNode?.position ?? this.stickyScrollController?.height);
  }
  getViewState(identityProvider = this.options.identityProvider) {
    if (!identityProvider) {
      throw new TreeError(this._user, "Can't get tree view state without an identity provider");
    }
    const getId = (element) => identityProvider.getId(element).toString();
    const state = AbstractTreeViewState.empty(this.scrollTop);
    for (const focus of this.getFocus()) {
      state.focus.add(getId(focus));
    }
    for (const selection of this.getSelection()) {
      state.selection.add(getId(selection));
    }
    const root = this.model.getNode();
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node !== root && node.collapsible) {
        state.expanded[getId(node.element)] = node.collapsed ? 0 : 1;
      }
      insertInto(stack, stack.length, node.children);
    }
    return state;
  }
  // List
  onLeftArrow(e) {
    e.preventDefault();
    e.stopPropagation();
    const nodes = this.view.getFocusedElements();
    if (nodes.length === 0) {
      return;
    }
    const node = nodes[0];
    const location = this.model.getNodeLocation(node);
    const didChange = this.model.setCollapsed(location, true);
    if (!didChange) {
      const parentLocation = this.model.getParentNodeLocation(location);
      if (!parentLocation) {
        return;
      }
      const parentListIndex = this.model.getListIndex(parentLocation);
      this.view.reveal(parentListIndex);
      this.view.setFocus([parentListIndex]);
    }
  }
  onRightArrow(e) {
    e.preventDefault();
    e.stopPropagation();
    const nodes = this.view.getFocusedElements();
    if (nodes.length === 0) {
      return;
    }
    const node = nodes[0];
    const location = this.model.getNodeLocation(node);
    const didChange = this.model.setCollapsed(location, false);
    if (!didChange) {
      if (!node.children.some((child) => child.visible)) {
        return;
      }
      const [focusedIndex] = this.view.getFocus();
      const firstChildIndex = focusedIndex + 1;
      this.view.reveal(firstChildIndex);
      this.view.setFocus([firstChildIndex]);
    }
  }
  onSpace(e) {
    e.preventDefault();
    e.stopPropagation();
    const nodes = this.view.getFocusedElements();
    if (nodes.length === 0) {
      return;
    }
    const node = nodes[0];
    const location = this.model.getNodeLocation(node);
    const recursive = e.browserEvent.altKey;
    this.model.setCollapsed(location, void 0, recursive);
  }
  setupModel(model) {
    this.modelDisposables.clear();
    this.modelDisposables.add(model.onDidSpliceRenderedNodes(({ start, deleteCount, elements }) => this.view.splice(start, deleteCount, elements)));
    const onDidModelSplice = Event.forEach(model.onDidSpliceModel, (e) => {
      this.eventBufferer.bufferEvents(() => {
        this.focus.onDidModelSplice(e);
        this.selection.onDidModelSplice(e);
      });
    }, this.modelDisposables);
    onDidModelSplice(() => null, null, this.modelDisposables);
    const activeNodesEmitter = this.modelDisposables.add(new Emitter());
    const activeNodesDebounce = this.modelDisposables.add(new Delayer(0));
    this.modelDisposables.add(Event.any(onDidModelSplice, this.focus.onDidChange, this.selection.onDidChange)(() => {
      activeNodesDebounce.trigger(() => {
        const set = /* @__PURE__ */ new Set();
        for (const node of this.focus.getNodes()) {
          set.add(node);
        }
        for (const node of this.selection.getNodes()) {
          set.add(node);
        }
        activeNodesEmitter.fire([...set.values()]);
      });
    }));
    this.onDidChangeActiveNodesRelay.input = activeNodesEmitter.event;
    this.onDidChangeModelRelay.input = Event.signal(model.onDidSpliceModel);
    this.onDidChangeCollapseStateRelay.input = model.onDidChangeCollapseState;
    this.onDidChangeRenderNodeCountRelay.input = model.onDidChangeRenderNodeCount;
    this.onDidSpliceModelRelay.input = model.onDidSpliceModel;
  }
  navigate(start) {
    return new TreeNavigator(this.view, this.model, start);
  }
  dispose() {
    dispose(this.disposables);
    this.stickyScrollController?.dispose();
    this.view.dispose();
    this.modelDisposables.dispose();
  }
}
class TreeNavigator {
  constructor(view, model, start) {
    this.view = view;
    this.model = model;
    if (start) {
      this.index = this.model.getListIndex(start);
    } else {
      this.index = -1;
    }
  }
  current() {
    if (this.index < 0 || this.index >= this.view.length) {
      return null;
    }
    return this.view.element(this.index).element;
  }
  previous() {
    this.index--;
    return this.current();
  }
  next() {
    this.index++;
    return this.current();
  }
  first() {
    this.index = 0;
    return this.current();
  }
  last() {
    this.index = this.view.length - 1;
    return this.current();
  }
}
export {
  AbstractFindController,
  AbstractTree,
  AbstractTreePart,
  AbstractTreeViewState,
  ComposedTreeDelegate,
  FindController,
  FindFilter,
  FindToggles,
  RenderIndentGuides,
  TreeFindMatchType,
  TreeFindMode,
  TreeRenderer,
  contiguousFuzzyScore
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hYnN0cmFjdFRyZWUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJRHJhZ0FuZERyb3BEYXRhIH0gZnJvbSAnLi4vLi4vZG5kLmpzJztcbmltcG9ydCB7ICQsIGFwcGVuZCwgY2xlYXJOb2RlLCBoLCBoYXNQYXJlbnRXaXRoQ2xhc3MsIGlzQWN0aXZlRWxlbWVudCwgaXNLZXlib2FyZEV2ZW50LCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGlzRWRpdGFibGVFbGVtZW50IH0gZnJvbSAnLi4vLi4vZG9tLmpzJztcbmltcG9ydCB7IGNyZWF0ZVN0eWxlU2hlZXQgfSBmcm9tICcuLi8uLi9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhbHVlV2l0aERlZmF1bHQgfSBmcm9tICcuLi8uLi9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyBEb21FbWl0dGVyIH0gZnJvbSAnLi4vLi4vZXZlbnQuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4va2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IElDb250ZXh0Vmlld1Byb3ZpZGVyIH0gZnJvbSAnLi4vY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgRmluZElucHV0IH0gZnJvbSAnLi4vZmluZGlucHV0L2ZpbmRJbnB1dC5qcyc7XG5pbXBvcnQgeyBJSW5wdXRCb3hTdHlsZXMsIElNZXNzYWdlLCBNZXNzYWdlVHlwZSwgdW50aGVtZWRJbmJveFN0eWxlcyB9IGZyb20gJy4uL2lucHV0Ym94L2lucHV0Qm94LmpzJztcbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyLCBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciwgSUxpc3RDb250ZXh0TWVudUV2ZW50LCBJTGlzdERyYWdBbmREcm9wLCBJTGlzdERyYWdPdmVyUmVhY3Rpb24sIElMaXN0TW91c2VFdmVudCwgSUxpc3RSZW5kZXJlciwgSUxpc3RUb3VjaEV2ZW50LCBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSB9IGZyb20gJy4uL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YSwgTGlzdFZpZXdUYXJnZXRTZWN0b3IgfSBmcm9tICcuLi9saXN0L2xpc3RWaWV3LmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyLCBJTGlzdE9wdGlvbnMsIElMaXN0U3R5bGVzLCBpc0FjdGlvbkl0ZW0sIGlzQnV0dG9uLCBpc01vbmFjb0N1c3RvbVRvZ2dsZSwgaXNNb25hY29FZGl0b3IsIGlzU3RpY2t5U2Nyb2xsQ29udGFpbmVyLCBpc1N0aWNreVNjcm9sbEVsZW1lbnQsIExpc3QsIE1vdXNlQ29udHJvbGxlciwgVHlwZU5hdmlnYXRpb25Nb2RlIH0gZnJvbSAnLi4vbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IElUb2dnbGVTdHlsZXMsIFRvZ2dsZSwgdW50aGVtZWRUb2dnbGVTdHlsZXMgfSBmcm9tICcuLi90b2dnbGUvdG9nZ2xlLmpzJztcbmltcG9ydCB7IGdldFZpc2libGVTdGF0ZSwgaXNGaWx0ZXJSZXN1bHQgfSBmcm9tICcuL2luZGV4VHJlZU1vZGVsLmpzJztcbmltcG9ydCB7IElDb2xsYXBzZVN0YXRlQ2hhbmdlRXZlbnQsIElUcmVlQ29udGV4dE1lbnVFdmVudCwgSVRyZWVEcmFnQW5kRHJvcCwgSVRyZWVFdmVudCwgSVRyZWVGaWx0ZXIsIElUcmVlTW9kZWwsIElUcmVlTW9kZWxTcGxpY2VFdmVudCwgSVRyZWVNb3VzZUV2ZW50LCBJVHJlZU5hdmlnYXRvciwgSVRyZWVOb2RlLCBJVHJlZVJlbmRlcmVyLCBUcmVlRHJhZ092ZXJCdWJibGUsIFRyZWVFcnJvciwgVHJlZUZpbHRlclJlc3VsdCwgVHJlZU1vdXNlRXZlbnRUYXJnZXQsIFRyZWVWaXNpYmlsaXR5IH0gZnJvbSAnLi90cmVlLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGRpc3RpbmN0LCBlcXVhbHMsIGluc2VydEludG8sIHJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEZWxheWVyLCBkaXNwb3NhYmxlVGltZW91dCwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgU2V0TWFwIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCwgRXZlbnRCdWZmZXJlciwgUmVsYXkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgZnV6enlTY29yZSwgRnV6enlTY29yZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IFNjcm9sbEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Njcm9sbGFibGUuanMnO1xuaW1wb3J0ICcuL21lZGlhL3RyZWUuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIGNvbnN0T2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGFsZXJ0IH0gZnJvbSAnLi4vYXJpYS9hcmlhLmpzJztcblxuY2xhc3MgVHJlZUVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhPFQsIFRGaWx0ZXJEYXRhLCBUQ29udGV4dD4gZXh0ZW5kcyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YTxULCBUQ29udGV4dD4ge1xuXG5cdG92ZXJyaWRlIHNldCBjb250ZXh0KGNvbnRleHQ6IFRDb250ZXh0IHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5kYXRhLmNvbnRleHQgPSBjb250ZXh0O1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IGNvbnRleHQoKTogVENvbnRleHQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmRhdGEuY29udGV4dDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgZGF0YTogRWxlbWVudHNEcmFnQW5kRHJvcERhdGE8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiwgVENvbnRleHQ+KSB7XG5cdFx0c3VwZXIoZGF0YS5lbGVtZW50cy5tYXAobm9kZSA9PiBub2RlLmVsZW1lbnQpKTtcblx0fVxufVxuXG5mdW5jdGlvbiBhc1RyZWVEcmFnQW5kRHJvcERhdGE8VCwgVEZpbHRlckRhdGE+KGRhdGE6IElEcmFnQW5kRHJvcERhdGEpOiBJRHJhZ0FuZERyb3BEYXRhIHtcblx0aWYgKGRhdGEgaW5zdGFuY2VvZiBFbGVtZW50c0RyYWdBbmREcm9wRGF0YSkge1xuXHRcdHJldHVybiBuZXcgVHJlZUVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhKGRhdGEpO1xuXHR9XG5cblx0cmV0dXJuIGRhdGE7XG59XG5cbmNsYXNzIFRyZWVOb2RlTGlzdERyYWdBbmREcm9wPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPiBpbXBsZW1lbnRzIElMaXN0RHJhZ0FuZERyb3A8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4ge1xuXG5cdHByaXZhdGUgYXV0b0V4cGFuZE5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYXV0b0V4cGFuZERpc3Bvc2FibGU6IElEaXNwb3NhYmxlID0gRGlzcG9zYWJsZS5Ob25lO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgbW9kZWxQcm92aWRlcjogKCkgPT4gSVRyZWVNb2RlbDxULCBURmlsdGVyRGF0YSwgVFJlZj4sIHByaXZhdGUgZG5kOiBJVHJlZURyYWdBbmREcm9wPFQ+KSB7IH1cblxuXHRnZXREcmFnVVJJKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pOiBzdHJpbmcgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5kbmQuZ2V0RHJhZ1VSSShub2RlLmVsZW1lbnQpO1xuXHR9XG5cblx0Z2V0RHJhZ0xhYmVsKG5vZGVzOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+W10sIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuZG5kLmdldERyYWdMYWJlbCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG5kLmdldERyYWdMYWJlbChub2Rlcy5tYXAobm9kZSA9PiBub2RlLmVsZW1lbnQpLCBvcmlnaW5hbEV2ZW50KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0b25EcmFnU3RhcnQoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5kbmQub25EcmFnU3RhcnQ/Lihhc1RyZWVEcmFnQW5kRHJvcERhdGEoZGF0YSksIG9yaWdpbmFsRXZlbnQpO1xuXHR9XG5cblx0b25EcmFnT3ZlcihkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCB0YXJnZXROb2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+IHwgdW5kZWZpbmVkLCB0YXJnZXRJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQsIHJhdyA9IHRydWUpOiBib29sZWFuIHwgSUxpc3REcmFnT3ZlclJlYWN0aW9uIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmRuZC5vbkRyYWdPdmVyKGFzVHJlZURyYWdBbmREcm9wRGF0YShkYXRhKSwgdGFyZ2V0Tm9kZSAmJiB0YXJnZXROb2RlLmVsZW1lbnQsIHRhcmdldEluZGV4LCB0YXJnZXRTZWN0b3IsIG9yaWdpbmFsRXZlbnQpO1xuXHRcdGNvbnN0IGRpZENoYW5nZUF1dG9FeHBhbmROb2RlID0gdGhpcy5hdXRvRXhwYW5kTm9kZSAhPT0gdGFyZ2V0Tm9kZTtcblxuXHRcdGlmIChkaWRDaGFuZ2VBdXRvRXhwYW5kTm9kZSkge1xuXHRcdFx0dGhpcy5hdXRvRXhwYW5kRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmF1dG9FeHBhbmROb2RlID0gdGFyZ2V0Tm9kZTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHRhcmdldE5vZGUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdGlmIChkaWRDaGFuZ2VBdXRvRXhwYW5kTm9kZSAmJiB0eXBlb2YgcmVzdWx0ICE9PSAnYm9vbGVhbicgJiYgcmVzdWx0LmF1dG9FeHBhbmQpIHtcblx0XHRcdHRoaXMuYXV0b0V4cGFuZERpc3Bvc2FibGUgPSBkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbFByb3ZpZGVyKCk7XG5cdFx0XHRcdGNvbnN0IHJlZiA9IG1vZGVsLmdldE5vZGVMb2NhdGlvbih0YXJnZXROb2RlKTtcblxuXHRcdFx0XHRpZiAobW9kZWwuaXNDb2xsYXBzZWQocmVmKSkge1xuXHRcdFx0XHRcdG1vZGVsLnNldENvbGxhcHNlZChyZWYsIGZhbHNlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuYXV0b0V4cGFuZE5vZGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9LCA1MDAsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicgfHwgIXJlc3VsdC5hY2NlcHQgfHwgdHlwZW9mIHJlc3VsdC5idWJibGUgPT09ICd1bmRlZmluZWQnIHx8IHJlc3VsdC5mZWVkYmFjaykge1xuXHRcdFx0aWYgKCFyYXcpIHtcblx0XHRcdFx0Y29uc3QgYWNjZXB0ID0gdHlwZW9mIHJlc3VsdCA9PT0gJ2Jvb2xlYW4nID8gcmVzdWx0IDogcmVzdWx0LmFjY2VwdDtcblx0XHRcdFx0Y29uc3QgZWZmZWN0ID0gdHlwZW9mIHJlc3VsdCA9PT0gJ2Jvb2xlYW4nID8gdW5kZWZpbmVkIDogcmVzdWx0LmVmZmVjdDtcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0LCBlZmZlY3QsIGZlZWRiYWNrOiBbdGFyZ2V0SW5kZXghXSB9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdGlmIChyZXN1bHQuYnViYmxlID09PSBUcmVlRHJhZ092ZXJCdWJibGUuVXApIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbFByb3ZpZGVyKCk7XG5cdFx0XHRjb25zdCByZWYgPSBtb2RlbC5nZXROb2RlTG9jYXRpb24odGFyZ2V0Tm9kZSk7XG5cdFx0XHRjb25zdCBwYXJlbnRSZWYgPSBtb2RlbC5nZXRQYXJlbnROb2RlTG9jYXRpb24ocmVmKTtcblx0XHRcdGNvbnN0IHBhcmVudE5vZGUgPSBtb2RlbC5nZXROb2RlKHBhcmVudFJlZik7XG5cdFx0XHRjb25zdCBwYXJlbnRJbmRleCA9IHBhcmVudFJlZiAmJiBtb2RlbC5nZXRMaXN0SW5kZXgocGFyZW50UmVmKTtcblxuXHRcdFx0cmV0dXJuIHRoaXMub25EcmFnT3ZlcihkYXRhLCBwYXJlbnROb2RlLCBwYXJlbnRJbmRleCwgdGFyZ2V0U2VjdG9yLCBvcmlnaW5hbEV2ZW50LCBmYWxzZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsUHJvdmlkZXIoKTtcblx0XHRjb25zdCByZWYgPSBtb2RlbC5nZXROb2RlTG9jYXRpb24odGFyZ2V0Tm9kZSk7XG5cdFx0Y29uc3Qgc3RhcnQgPSBtb2RlbC5nZXRMaXN0SW5kZXgocmVmKTtcblx0XHRjb25zdCBsZW5ndGggPSBtb2RlbC5nZXRMaXN0UmVuZGVyQ291bnQocmVmKTtcblxuXHRcdHJldHVybiB7IC4uLnJlc3VsdCwgZmVlZGJhY2s6IHJhbmdlKHN0YXJ0LCBzdGFydCArIGxlbmd0aCkgfTtcblx0fVxuXG5cdGRyb3AoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0Tm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZCwgdGFyZ2V0SW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCwgdGFyZ2V0U2VjdG9yOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5hdXRvRXhwYW5kRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5hdXRvRXhwYW5kTm9kZSA9IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuZG5kLmRyb3AoYXNUcmVlRHJhZ0FuZERyb3BEYXRhKGRhdGEpLCB0YXJnZXROb2RlICYmIHRhcmdldE5vZGUuZWxlbWVudCwgdGFyZ2V0SW5kZXgsIHRhcmdldFNlY3Rvciwgb3JpZ2luYWxFdmVudCk7XG5cdH1cblxuXHRvbkRyYWdFbmQob3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5kbmQub25EcmFnRW5kPy4ob3JpZ2luYWxFdmVudCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZG5kLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBhc0xpc3RPcHRpb25zPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPihtb2RlbFByb3ZpZGVyOiAoKSA9PiBJVHJlZU1vZGVsPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPiwgZGlzcG9zYWJsZVN0b3JlOiBEaXNwb3NhYmxlU3RvcmUsIG9wdGlvbnM/OiBJQWJzdHJhY3RUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4pOiBJTGlzdE9wdGlvbnM8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4gfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gb3B0aW9ucyAmJiB7XG5cdFx0Li4ub3B0aW9ucyxcblx0XHRpZGVudGl0eVByb3ZpZGVyOiBvcHRpb25zLmlkZW50aXR5UHJvdmlkZXIgJiYge1xuXHRcdFx0Z2V0SWQoZWwpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuaWRlbnRpdHlQcm92aWRlciEuZ2V0SWQoZWwuZWxlbWVudCk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRkbmQ6IG9wdGlvbnMuZG5kICYmIGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFRyZWVOb2RlTGlzdERyYWdBbmREcm9wKG1vZGVsUHJvdmlkZXIsIG9wdGlvbnMuZG5kKSksXG5cdFx0bXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyOiBvcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlciAmJiB7XG5cdFx0XHRpc1NlbGVjdGlvblNpbmdsZUNoYW5nZUV2ZW50KGUpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyIS5pc1NlbGVjdGlvblNpbmdsZUNoYW5nZUV2ZW50KHsgLi4uZSwgZWxlbWVudDogZS5lbGVtZW50IH0gYXMgYW55KTtcblx0XHRcdH0sXG5cdFx0XHRpc1NlbGVjdGlvblJhbmdlQ2hhbmdlRXZlbnQoZSkge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5tdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXIhLmlzU2VsZWN0aW9uUmFuZ2VDaGFuZ2VFdmVudCh7IC4uLmUsIGVsZW1lbnQ6IGUuZWxlbWVudCB9IGFzIGFueSk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IG9wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyICYmIHtcblx0XHRcdC4uLm9wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyLFxuXHRcdFx0Z2V0U2V0U2l6ZShub2RlKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gbW9kZWxQcm92aWRlcigpO1xuXHRcdFx0XHRjb25zdCByZWYgPSBtb2RlbC5nZXROb2RlTG9jYXRpb24obm9kZSk7XG5cdFx0XHRcdGNvbnN0IHBhcmVudFJlZiA9IG1vZGVsLmdldFBhcmVudE5vZGVMb2NhdGlvbihyZWYpO1xuXHRcdFx0XHRjb25zdCBwYXJlbnROb2RlID0gbW9kZWwuZ2V0Tm9kZShwYXJlbnRSZWYpO1xuXG5cdFx0XHRcdHJldHVybiBwYXJlbnROb2RlLnZpc2libGVDaGlsZHJlbkNvdW50O1xuXHRcdFx0fSxcblx0XHRcdGdldFBvc0luU2V0KG5vZGUpIHtcblx0XHRcdFx0cmV0dXJuIG5vZGUudmlzaWJsZUNoaWxkSW5kZXggKyAxO1xuXHRcdFx0fSxcblx0XHRcdGlzQ2hlY2tlZDogb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIgJiYgb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuaXNDaGVja2VkID8gKG5vZGUpID0+IHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyIS5pc0NoZWNrZWQhKG5vZGUuZWxlbWVudCk7XG5cdFx0XHR9IDogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0Um9sZTogb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIgJiYgb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0Um9sZSA/IChub2RlKSA9PiB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlciEuZ2V0Um9sZSEobm9kZS5lbGVtZW50KTtcblx0XHRcdH0gOiAoKSA9PiAndHJlZWl0ZW0nLFxuXHRcdFx0Z2V0QXJpYUxhYmVsKGUpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyIS5nZXRBcmlhTGFiZWwoZS5lbGVtZW50KTtcblx0XHRcdH0sXG5cdFx0XHRnZXRXaWRnZXRBcmlhTGFiZWwoKSB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlciEuZ2V0V2lkZ2V0QXJpYUxhYmVsKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0V2lkZ2V0Um9sZTogb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIgJiYgb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0V2lkZ2V0Um9sZSA/ICgpID0+IG9wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyIS5nZXRXaWRnZXRSb2xlISgpIDogKCkgPT4gJ3RyZWUnLFxuXHRcdFx0Z2V0QXJpYUxldmVsOiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlciAmJiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRBcmlhTGV2ZWwgPyAobm9kZSkgPT4gb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIhLmdldEFyaWFMZXZlbCEobm9kZS5lbGVtZW50KSA6IChub2RlKSA9PiB7XG5cdFx0XHRcdHJldHVybiBub2RlLmRlcHRoO1xuXHRcdFx0fSxcblx0XHRcdGdldEFjdGl2ZURlc2NlbmRhbnRJZDogb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0QWN0aXZlRGVzY2VuZGFudElkICYmIChub2RlID0+IHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyIS5nZXRBY3RpdmVEZXNjZW5kYW50SWQhKG5vZGUuZWxlbWVudCk7XG5cdFx0XHR9KVxuXHRcdH0sXG5cdFx0a2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjogb3B0aW9ucy5rZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyICYmIHtcblx0XHRcdC4uLm9wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcixcblx0XHRcdGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKG5vZGUpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciEuZ2V0S2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWwobm9kZS5lbGVtZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wb3NlZFRyZWVEZWxlZ2F0ZTxULCBOIGV4dGVuZHMgeyBlbGVtZW50OiBUIH0+IGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8Tj4ge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgZGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPFQ+KSB7IH1cblxuXHRnZXRIZWlnaHQoZWxlbWVudDogTik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuZGVsZWdhdGUuZ2V0SGVpZ2h0KGVsZW1lbnQuZWxlbWVudCk7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IE4pOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmRlbGVnYXRlLmdldFRlbXBsYXRlSWQoZWxlbWVudC5lbGVtZW50KTtcblx0fVxuXG5cdGhhc0R5bmFtaWNIZWlnaHQoZWxlbWVudDogTik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuZGVsZWdhdGUuaGFzRHluYW1pY0hlaWdodCAmJiB0aGlzLmRlbGVnYXRlLmhhc0R5bmFtaWNIZWlnaHQoZWxlbWVudC5lbGVtZW50KTtcblx0fVxuXG5cdHNldER5bmFtaWNIZWlnaHQoZWxlbWVudDogTiwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLmRlbGVnYXRlLnNldER5bmFtaWNIZWlnaHQ/LihlbGVtZW50LmVsZW1lbnQsIGhlaWdodCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElUcmVlTGlzdFRlbXBsYXRlRGF0YTxUPiB7XG5cdHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGluZGVudDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHR3aXN0aWU6IEhUTUxFbGVtZW50O1xuXHRpbmRlbnRHdWlkZXNEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblx0cmVhZG9ubHkgdGVtcGxhdGVEYXRhOiBUO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBYnN0cmFjdFRyZWVWaWV3U3RhdGUge1xuXHRyZWFkb25seSBmb2N1czogSXRlcmFibGU8c3RyaW5nPjtcblx0cmVhZG9ubHkgc2VsZWN0aW9uOiBJdGVyYWJsZTxzdHJpbmc+O1xuXHRyZWFkb25seSBleHBhbmRlZDogeyBbaWQ6IHN0cmluZ106IDEgfCAwIH07XG5cdHJlYWRvbmx5IHNjcm9sbFRvcDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgQWJzdHJhY3RUcmVlVmlld1N0YXRlIGltcGxlbWVudHMgSUFic3RyYWN0VHJlZVZpZXdTdGF0ZSB7XG5cdHB1YmxpYyByZWFkb25seSBmb2N1czogU2V0PHN0cmluZz47XG5cdHB1YmxpYyByZWFkb25seSBzZWxlY3Rpb246IFNldDxzdHJpbmc+O1xuXHRwdWJsaWMgcmVhZG9ubHkgZXhwYW5kZWQ6IHsgW2lkOiBzdHJpbmddOiAxIHwgMCB9O1xuXHRwdWJsaWMgc2Nyb2xsVG9wOiBudW1iZXI7XG5cblx0cHVibGljIHN0YXRpYyBsaWZ0KHN0YXRlOiBJQWJzdHJhY3RUcmVlVmlld1N0YXRlKSB7XG5cdFx0cmV0dXJuIHN0YXRlIGluc3RhbmNlb2YgQWJzdHJhY3RUcmVlVmlld1N0YXRlID8gc3RhdGUgOiBuZXcgQWJzdHJhY3RUcmVlVmlld1N0YXRlKHN0YXRlKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZW1wdHkoc2Nyb2xsVG9wID0gMCkge1xuXHRcdHJldHVybiBuZXcgQWJzdHJhY3RUcmVlVmlld1N0YXRlKHtcblx0XHRcdGZvY3VzOiBbXSxcblx0XHRcdHNlbGVjdGlvbjogW10sXG5cdFx0XHRleHBhbmRlZDogT2JqZWN0LmNyZWF0ZShudWxsKSxcblx0XHRcdHNjcm9sbFRvcCxcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBjb25zdHJ1Y3RvcihzdGF0ZTogSUFic3RyYWN0VHJlZVZpZXdTdGF0ZSkge1xuXHRcdHRoaXMuZm9jdXMgPSBuZXcgU2V0KHN0YXRlLmZvY3VzKTtcblx0XHR0aGlzLnNlbGVjdGlvbiA9IG5ldyBTZXQoc3RhdGUuc2VsZWN0aW9uKTtcblx0XHRpZiAoc3RhdGUuZXhwYW5kZWQgaW5zdGFuY2VvZiBBcnJheSkgeyAvLyBvbGQgZm9ybWF0XG5cdFx0XHR0aGlzLmV4cGFuZGVkID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdGZvciAoY29uc3QgaWQgb2Ygc3RhdGUuZXhwYW5kZWQgYXMgc3RyaW5nW10pIHtcblx0XHRcdFx0dGhpcy5leHBhbmRlZFtpZF0gPSAxO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmV4cGFuZGVkID0gc3RhdGUuZXhwYW5kZWQ7XG5cdFx0fVxuXHRcdHRoaXMuZXhwYW5kZWQgPSBzdGF0ZS5leHBhbmRlZDtcblx0XHR0aGlzLnNjcm9sbFRvcCA9IHN0YXRlLnNjcm9sbFRvcDtcblx0fVxuXG5cdHB1YmxpYyB0b0pTT04oKTogSUFic3RyYWN0VHJlZVZpZXdTdGF0ZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGZvY3VzOiBBcnJheS5mcm9tKHRoaXMuZm9jdXMpLFxuXHRcdFx0c2VsZWN0aW9uOiBBcnJheS5mcm9tKHRoaXMuc2VsZWN0aW9uKSxcblx0XHRcdGV4cGFuZGVkOiB0aGlzLmV4cGFuZGVkLFxuXHRcdFx0c2Nyb2xsVG9wOiB0aGlzLnNjcm9sbFRvcCxcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBlbnVtIFJlbmRlckluZGVudEd1aWRlcyB7XG5cdE5vbmUgPSAnbm9uZScsXG5cdE9uSG92ZXIgPSAnb25Ib3ZlcicsXG5cdEFsd2F5cyA9ICdhbHdheXMnXG59XG5cbmludGVyZmFjZSBJVHJlZVJlbmRlcmVyT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGluZGVudD86IG51bWJlcjtcblx0cmVhZG9ubHkgcmVuZGVySW5kZW50R3VpZGVzPzogUmVuZGVySW5kZW50R3VpZGVzO1xuXHQvLyBUT0RPQGpvYW8gcmVwbGFjZSB0aGlzIHdpdGggY29sbGFwc2libGU6IGJvb2xlYW4gfCAnb25kZW1hbmQnXG5cdHJlYWRvbmx5IGhpZGVUd2lzdGllc09mQ2hpbGRsZXNzRWxlbWVudHM/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgQ29sbGVjdGlvbjxUPiB7XG5cdHJlYWRvbmx5IGVsZW1lbnRzOiBUW107XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDxUW10+O1xufVxuXG5jbGFzcyBFdmVudENvbGxlY3Rpb248VD4gaW1wbGVtZW50cyBDb2xsZWN0aW9uPFQ+LCBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PFRbXT47XG5cblx0Z2V0IGVsZW1lbnRzKCk6IFRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2VsZW1lbnRzO1xuXHR9XG5cblx0Y29uc3RydWN0b3Iob25EaWRDaGFuZ2U6IEV2ZW50PFRbXT4sIHByaXZhdGUgX2VsZW1lbnRzOiBUW10gPSBbXSkge1xuXHRcdHRoaXMub25EaWRDaGFuZ2UgPSBFdmVudC5mb3JFYWNoKG9uRGlkQ2hhbmdlLCBlbGVtZW50cyA9PiB0aGlzLl9lbGVtZW50cyA9IGVsZW1lbnRzLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyZWVSZW5kZXJlcjxULCBURmlsdGVyRGF0YSwgVFJlZiwgVFRlbXBsYXRlRGF0YT4gaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIElUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPj4ge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERlZmF1bHRJbmRlbnQgPSA4O1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZztcblx0cHJpdmF0ZSByZW5kZXJlZEVsZW1lbnRzID0gbmV3IE1hcDxULCBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+PigpO1xuXHRwcml2YXRlIHJlbmRlcmVkTm9kZXMgPSBuZXcgTWFwPElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIElUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPj4oKTtcblx0cHJpdmF0ZSBpbmRlbnQ6IG51bWJlciA9IFRyZWVSZW5kZXJlci5EZWZhdWx0SW5kZW50O1xuXHRwcml2YXRlIGhpZGVUd2lzdGllc09mQ2hpbGRsZXNzRWxlbWVudHM6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIHNob3VsZFJlbmRlckluZGVudEd1aWRlczogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIGFjdGl2ZUluZGVudE5vZGVzID0gbmV3IFNldDxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+PigpO1xuXHRwcml2YXRlIGluZGVudEd1aWRlc0Rpc3Bvc2FibGU6IElEaXNwb3NhYmxlID0gRGlzcG9zYWJsZS5Ob25lO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSByZW5kZXJlcjogSVRyZWVSZW5kZXJlcjxULCBURmlsdGVyRGF0YSwgVFRlbXBsYXRlRGF0YT4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtb2RlbDogSVRyZWVNb2RlbDxULCBURmlsdGVyRGF0YSwgVFJlZj4sXG5cdFx0b25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlOiBFdmVudDxJQ29sbGFwc2VTdGF0ZUNoYW5nZUV2ZW50PFQsIFRGaWx0ZXJEYXRhPj4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmVOb2RlczogQ29sbGVjdGlvbjxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+Pixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlbmRlcmVkSW5kZW50R3VpZGVzOiBTZXRNYXA8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiwgSFRNTERpdkVsZW1lbnQ+LFxuXHRcdG9wdGlvbnM6IElUcmVlUmVuZGVyZXJPcHRpb25zID0ge31cblx0KSB7XG5cdFx0dGhpcy50ZW1wbGF0ZUlkID0gcmVuZGVyZXIudGVtcGxhdGVJZDtcblx0XHR0aGlzLnVwZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHRFdmVudC5tYXAob25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlLCBlID0+IGUubm9kZSkodGhpcy5vbkRpZENoYW5nZU5vZGVUd2lzdGllU3RhdGUsIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdHJlbmRlcmVyLm9uRGlkQ2hhbmdlVHdpc3RpZVN0YXRlPy4odGhpcy5vbkRpZENoYW5nZVR3aXN0aWVTdGF0ZSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdH1cblxuXHR1cGRhdGVPcHRpb25zKG9wdGlvbnM6IElUcmVlUmVuZGVyZXJPcHRpb25zID0ge30pOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIG9wdGlvbnMuaW5kZW50ICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y29uc3QgaW5kZW50ID0gY2xhbXAob3B0aW9ucy5pbmRlbnQsIDAsIDQwKTtcblxuXHRcdFx0aWYgKGluZGVudCAhPT0gdGhpcy5pbmRlbnQpIHtcblx0XHRcdFx0dGhpcy5pbmRlbnQgPSBpbmRlbnQ7XG5cblx0XHRcdFx0Zm9yIChjb25zdCBbbm9kZSwgdGVtcGxhdGVEYXRhXSBvZiB0aGlzLnJlbmRlcmVkTm9kZXMpIHtcblx0XHRcdFx0XHR0aGlzLnJlbmRlclRyZWVFbGVtZW50KG5vZGUsIHRlbXBsYXRlRGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIG9wdGlvbnMucmVuZGVySW5kZW50R3VpZGVzICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y29uc3Qgc2hvdWxkUmVuZGVySW5kZW50R3VpZGVzID0gb3B0aW9ucy5yZW5kZXJJbmRlbnRHdWlkZXMgIT09IFJlbmRlckluZGVudEd1aWRlcy5Ob25lO1xuXG5cdFx0XHRpZiAoc2hvdWxkUmVuZGVySW5kZW50R3VpZGVzICE9PSB0aGlzLnNob3VsZFJlbmRlckluZGVudEd1aWRlcykge1xuXHRcdFx0XHR0aGlzLnNob3VsZFJlbmRlckluZGVudEd1aWRlcyA9IHNob3VsZFJlbmRlckluZGVudEd1aWRlcztcblxuXHRcdFx0XHRmb3IgKGNvbnN0IFtub2RlLCB0ZW1wbGF0ZURhdGFdIG9mIHRoaXMucmVuZGVyZWROb2Rlcykge1xuXHRcdFx0XHRcdHRoaXMuX3JlbmRlckluZGVudEd1aWRlcyhub2RlLCB0ZW1wbGF0ZURhdGEpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5pbmRlbnRHdWlkZXNEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblxuXHRcdFx0XHRpZiAoc2hvdWxkUmVuZGVySW5kZW50R3VpZGVzKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRcdFx0dGhpcy5hY3RpdmVOb2Rlcy5vbkRpZENoYW5nZSh0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZU5vZGVzLCB0aGlzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0dGhpcy5pbmRlbnRHdWlkZXNEaXNwb3NhYmxlID0gZGlzcG9zYWJsZXM7XG5cblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZU5vZGVzKHRoaXMuYWN0aXZlTm9kZXMuZWxlbWVudHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zLmhpZGVUd2lzdGllc09mQ2hpbGRsZXNzRWxlbWVudHMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aGlzLmhpZGVUd2lzdGllc09mQ2hpbGRsZXNzRWxlbWVudHMgPSBvcHRpb25zLmhpZGVUd2lzdGllc09mQ2hpbGRsZXNzRWxlbWVudHM7XG5cdFx0fVxuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPiB7XG5cdFx0Y29uc3QgZWwgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcubW9uYWNvLXRsLXJvdycpKTtcblx0XHRjb25zdCBpbmRlbnQgPSBhcHBlbmQoZWwsICQoJy5tb25hY28tdGwtaW5kZW50JykpO1xuXHRcdGNvbnN0IHR3aXN0aWUgPSBhcHBlbmQoZWwsICQoJy5tb25hY28tdGwtdHdpc3RpZScpKTtcblx0XHRjb25zdCBjb250ZW50cyA9IGFwcGVuZChlbCwgJCgnLm1vbmFjby10bC1jb250ZW50cycpKTtcblx0XHRjb25zdCB0ZW1wbGF0ZURhdGEgPSB0aGlzLnJlbmRlcmVyLnJlbmRlclRlbXBsYXRlKGNvbnRlbnRzKTtcblxuXHRcdHJldHVybiB7IGNvbnRhaW5lciwgaW5kZW50LCB0d2lzdGllLCBpbmRlbnRHdWlkZXNEaXNwb3NhYmxlOiBEaXNwb3NhYmxlLk5vbmUsIHRlbXBsYXRlRGF0YSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPiwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlcmVkTm9kZXMuc2V0KG5vZGUsIHRlbXBsYXRlRGF0YSk7XG5cdFx0dGhpcy5yZW5kZXJlZEVsZW1lbnRzLnNldChub2RlLmVsZW1lbnQsIG5vZGUpO1xuXHRcdHRoaXMucmVuZGVyVHJlZUVsZW1lbnQobm9kZSwgdGVtcGxhdGVEYXRhKTtcblx0XHR0aGlzLnJlbmRlcmVyLnJlbmRlckVsZW1lbnQobm9kZSwgaW5kZXgsIHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURhdGEsIGhlaWdodCk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPiwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuaW5kZW50R3VpZGVzRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLnJlbmRlcmVyLmRpc3Bvc2VFbGVtZW50Py4obm9kZSwgaW5kZXgsIHRlbXBsYXRlRGF0YS50ZW1wbGF0ZURhdGEsIGhlaWdodCk7XG5cblx0XHRpZiAodHlwZW9mIGhlaWdodCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHRoaXMucmVuZGVyZWROb2Rlcy5kZWxldGUobm9kZSk7XG5cdFx0XHR0aGlzLnJlbmRlcmVkRWxlbWVudHMuZGVsZXRlKG5vZGUuZWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVRyZWVMaXN0VGVtcGxhdGVEYXRhPFRUZW1wbGF0ZURhdGE+KTogdm9pZCB7XG5cdFx0dGhpcy5yZW5kZXJlci5kaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhLnRlbXBsYXRlRGF0YSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlVHdpc3RpZVN0YXRlKGVsZW1lbnQ6IFQpOiB2b2lkIHtcblx0XHRjb25zdCBub2RlID0gdGhpcy5yZW5kZXJlZEVsZW1lbnRzLmdldChlbGVtZW50KTtcblxuXHRcdGlmICghbm9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMub25EaWRDaGFuZ2VOb2RlVHdpc3RpZVN0YXRlKG5vZGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZU5vZGVUd2lzdGllU3RhdGUobm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPik6IHZvaWQge1xuXHRcdGNvbnN0IHRlbXBsYXRlRGF0YSA9IHRoaXMucmVuZGVyZWROb2Rlcy5nZXQobm9kZSk7XG5cblx0XHRpZiAoIXRlbXBsYXRlRGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlTm9kZXModGhpcy5hY3RpdmVOb2Rlcy5lbGVtZW50cyk7XG5cdFx0dGhpcy5yZW5kZXJUcmVlRWxlbWVudChub2RlLCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJUcmVlRWxlbWVudChub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+LCB0ZW1wbGF0ZURhdGE6IElUcmVlTGlzdFRlbXBsYXRlRGF0YTxUVGVtcGxhdGVEYXRhPikge1xuXHRcdGNvbnN0IGluZGVudCA9IFRyZWVSZW5kZXJlci5EZWZhdWx0SW5kZW50ICsgKG5vZGUuZGVwdGggLSAxKSAqIHRoaXMuaW5kZW50O1xuXHRcdHRlbXBsYXRlRGF0YS50d2lzdGllLnN0eWxlLnBhZGRpbmdMZWZ0ID0gYCR7aW5kZW50fXB4YDtcblx0XHR0ZW1wbGF0ZURhdGEuaW5kZW50LnN0eWxlLndpZHRoID0gYCR7aW5kZW50ICsgdGhpcy5pbmRlbnQgLSAxNn1weGA7XG5cblx0XHRpZiAobm9kZS5jb2xsYXBzaWJsZSkge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBTdHJpbmcoIW5vZGUuY29sbGFwc2VkKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5jb250YWluZXIucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyk7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLnR3aXN0aWUuY2xhc3NMaXN0LnJlbW92ZSguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLnRyZWVJdGVtRXhwYW5kZWQpKTtcblxuXHRcdGxldCB0d2lzdGllUmVuZGVyZWQgPSBmYWxzZTtcblxuXHRcdGlmICh0aGlzLnJlbmRlcmVyLnJlbmRlclR3aXN0aWUpIHtcblx0XHRcdHR3aXN0aWVSZW5kZXJlZCA9IHRoaXMucmVuZGVyZXIucmVuZGVyVHdpc3RpZShub2RlLmVsZW1lbnQsIHRlbXBsYXRlRGF0YS50d2lzdGllKTtcblx0XHR9XG5cblx0XHRpZiAobm9kZS5jb2xsYXBzaWJsZSAmJiAoIXRoaXMuaGlkZVR3aXN0aWVzT2ZDaGlsZGxlc3NFbGVtZW50cyB8fCBub2RlLnZpc2libGVDaGlsZHJlbkNvdW50ID4gMCkpIHtcblx0XHRcdGlmICghdHdpc3RpZVJlbmRlcmVkKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS50d2lzdGllLmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi50cmVlSXRlbUV4cGFuZGVkKSk7XG5cdFx0XHR9XG5cblx0XHRcdHRlbXBsYXRlRGF0YS50d2lzdGllLmNsYXNzTGlzdC5hZGQoJ2NvbGxhcHNpYmxlJyk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEudHdpc3RpZS5jbGFzc0xpc3QudG9nZ2xlKCdjb2xsYXBzZWQnLCBub2RlLmNvbGxhcHNlZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS50d2lzdGllLmNsYXNzTGlzdC5yZW1vdmUoJ2NvbGxhcHNpYmxlJywgJ2NvbGxhcHNlZCcpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlbmRlckluZGVudEd1aWRlcyhub2RlLCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVySW5kZW50R3VpZGVzKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIHRlbXBsYXRlRGF0YTogSVRyZWVMaXN0VGVtcGxhdGVEYXRhPFRUZW1wbGF0ZURhdGE+KTogdm9pZCB7XG5cdFx0Y2xlYXJOb2RlKHRlbXBsYXRlRGF0YS5pbmRlbnQpO1xuXHRcdHRlbXBsYXRlRGF0YS5pbmRlbnRHdWlkZXNEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblxuXHRcdGlmICghdGhpcy5zaG91bGRSZW5kZXJJbmRlbnRHdWlkZXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0Y29uc3QgcmVmID0gdGhpcy5tb2RlbC5nZXROb2RlTG9jYXRpb24obm9kZSk7XG5cdFx0XHRjb25zdCBwYXJlbnRSZWYgPSB0aGlzLm1vZGVsLmdldFBhcmVudE5vZGVMb2NhdGlvbihyZWYpO1xuXG5cdFx0XHRpZiAoIXBhcmVudFJlZikge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcGFyZW50ID0gdGhpcy5tb2RlbC5nZXROb2RlKHBhcmVudFJlZik7XG5cdFx0XHRjb25zdCBndWlkZSA9ICQ8SFRNTERpdkVsZW1lbnQ+KCcuaW5kZW50LWd1aWRlJywgeyBzdHlsZTogYHdpZHRoOiAke3RoaXMuaW5kZW50fXB4YCB9KTtcblxuXHRcdFx0aWYgKHRoaXMuYWN0aXZlSW5kZW50Tm9kZXMuaGFzKHBhcmVudCkpIHtcblx0XHRcdFx0Z3VpZGUuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0ZW1wbGF0ZURhdGEuaW5kZW50LmNoaWxkRWxlbWVudENvdW50ID09PSAwKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5pbmRlbnQuYXBwZW5kQ2hpbGQoZ3VpZGUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmluZGVudC5pbnNlcnRCZWZvcmUoZ3VpZGUsIHRlbXBsYXRlRGF0YS5pbmRlbnQuZmlyc3RFbGVtZW50Q2hpbGQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnJlbmRlcmVkSW5kZW50R3VpZGVzLmFkZChwYXJlbnQsIGd1aWRlKTtcblx0XHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMucmVuZGVyZWRJbmRlbnRHdWlkZXMuZGVsZXRlKHBhcmVudCwgZ3VpZGUpKSk7XG5cblx0XHRcdG5vZGUgPSBwYXJlbnQ7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLmluZGVudEd1aWRlc0Rpc3Bvc2FibGUgPSBkaXNwb3NhYmxlU3RvcmU7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUFjdGl2ZU5vZGVzKG5vZGVzOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+W10pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuc2hvdWxkUmVuZGVySW5kZW50R3VpZGVzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2V0ID0gbmV3IFNldDxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+PigpO1xuXG5cdFx0bm9kZXMuZm9yRWFjaChub2RlID0+IHtcblx0XHRcdGNvbnN0IHJlZiA9IHRoaXMubW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKG5vZGUpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcGFyZW50UmVmID0gdGhpcy5tb2RlbC5nZXRQYXJlbnROb2RlTG9jYXRpb24ocmVmKTtcblxuXHRcdFx0XHRpZiAobm9kZS5jb2xsYXBzaWJsZSAmJiBub2RlLmNoaWxkcmVuLmxlbmd0aCA+IDAgJiYgIW5vZGUuY29sbGFwc2VkKSB7XG5cdFx0XHRcdFx0c2V0LmFkZChub2RlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChwYXJlbnRSZWYpIHtcblx0XHRcdFx0XHRzZXQuYWRkKHRoaXMubW9kZWwuZ2V0Tm9kZShwYXJlbnRSZWYpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIG5vb3Bcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuYWN0aXZlSW5kZW50Tm9kZXMuZm9yRWFjaChub2RlID0+IHtcblx0XHRcdGlmICghc2V0Lmhhcyhub2RlKSkge1xuXHRcdFx0XHR0aGlzLnJlbmRlcmVkSW5kZW50R3VpZGVzLmZvckVhY2gobm9kZSwgbGluZSA9PiBsaW5lLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHNldC5mb3JFYWNoKG5vZGUgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLmFjdGl2ZUluZGVudE5vZGVzLmhhcyhub2RlKSkge1xuXHRcdFx0XHR0aGlzLnJlbmRlcmVkSW5kZW50R3VpZGVzLmZvckVhY2gobm9kZSwgbGluZSA9PiBsaW5lLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuYWN0aXZlSW5kZW50Tm9kZXMgPSBzZXQ7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyZWROb2Rlcy5jbGVhcigpO1xuXHRcdHRoaXMucmVuZGVyZWRFbGVtZW50cy5jbGVhcigpO1xuXHRcdHRoaXMuaW5kZW50R3VpZGVzRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0ZGlzcG9zZSh0aGlzLmRpc3Bvc2FibGVzKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29udGlndW91c0Z1enp5U2NvcmUocGF0dGVybkxvd2VyOiBzdHJpbmcsIHdvcmRMb3dlcjogc3RyaW5nKTogRnV6enlTY29yZSB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGluZGV4ID0gd29yZExvd2VyLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihwYXR0ZXJuTG93ZXIpO1xuXHRsZXQgc2NvcmU6IEZ1enp5U2NvcmUgfCB1bmRlZmluZWQ7XG5cdGlmIChpbmRleCA+IC0xKSB7XG5cdFx0c2NvcmUgPSBbTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIDBdO1xuXHRcdGZvciAobGV0IGkgPSBwYXR0ZXJuTG93ZXIubGVuZ3RoOyBpID4gMDsgaS0tKSB7XG5cdFx0XHRzY29yZS5wdXNoKGluZGV4ICsgaSAtIDEpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gc2NvcmU7XG59XG5cbmV4cG9ydCB0eXBlIExhYmVsRnV6enlTY29yZSA9IHsgbGFiZWw6IHN0cmluZzsgc2NvcmU6IEZ1enp5U2NvcmUgfTtcblxuZXhwb3J0IGludGVyZmFjZSBJRmluZEZpbHRlcjxUPiBleHRlbmRzIElUcmVlRmlsdGVyPFQsIEZ1enp5U2NvcmUgfCBMYWJlbEZ1enp5U2NvcmU+IHtcblx0ZmlsdGVyKGVsZW1lbnQ6IFQsIHBhcmVudFZpc2liaWxpdHk6IFRyZWVWaXNpYmlsaXR5KTogVHJlZUZpbHRlclJlc3VsdDxGdXp6eVNjb3JlIHwgTGFiZWxGdXp6eVNjb3JlPjtcblx0cGF0dGVybjogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRmluZEZpbHRlcjxUPiBpbXBsZW1lbnRzIElGaW5kRmlsdGVyPFQ+LCBJRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX3RvdGFsQ291bnQgPSAwO1xuXHRnZXQgdG90YWxDb3VudCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5fdG90YWxDb3VudDsgfVxuXHRwcml2YXRlIF9tYXRjaENvdW50ID0gMDtcblx0Z2V0IG1hdGNoQ291bnQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX21hdGNoQ291bnQ7IH1cblxuXHRwcml2YXRlIF9maW5kTWF0Y2hUeXBlOiBUcmVlRmluZE1hdGNoVHlwZSA9IFRyZWVGaW5kTWF0Y2hUeXBlLkZ1enp5O1xuXHRzZXQgZmluZE1hdGNoVHlwZSh0eXBlOiBUcmVlRmluZE1hdGNoVHlwZSkgeyB0aGlzLl9maW5kTWF0Y2hUeXBlID0gdHlwZTsgfVxuXHRnZXQgZmluZE1hdGNoVHlwZSgpOiBUcmVlRmluZE1hdGNoVHlwZSB7IHJldHVybiB0aGlzLl9maW5kTWF0Y2hUeXBlOyB9XG5cblx0cHJpdmF0ZSBfZmluZE1vZGU6IFRyZWVGaW5kTW9kZSA9IFRyZWVGaW5kTW9kZS5IaWdobGlnaHQ7XG5cdHNldCBmaW5kTW9kZShtb2RlOiBUcmVlRmluZE1vZGUpIHsgdGhpcy5fZmluZE1vZGUgPSBtb2RlOyB9XG5cdGdldCBmaW5kTW9kZSgpOiBUcmVlRmluZE1vZGUgeyByZXR1cm4gdGhpcy5fZmluZE1vZGU7IH1cblxuXHRwcml2YXRlIF9wYXR0ZXJuOiBzdHJpbmcgPSAnJztcblx0cHJpdmF0ZSBfbG93ZXJjYXNlUGF0dGVybjogc3RyaW5nID0gJyc7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0c2V0IHBhdHRlcm4ocGF0dGVybjogc3RyaW5nKSB7XG5cdFx0dGhpcy5fcGF0dGVybiA9IHBhdHRlcm47XG5cdFx0dGhpcy5fbG93ZXJjYXNlUGF0dGVybiA9IHBhdHRlcm4udG9Mb3dlckNhc2UoKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2tleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IElLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyPFQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2ZpbHRlcj86IElUcmVlRmlsdGVyPFQsIEZ1enp5U2NvcmU+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RlZmF1bHRGaW5kVmlzaWJpbGl0eT86IFRyZWVWaXNpYmlsaXR5IHwgKChub2RlOiBUKSA9PiBUcmVlVmlzaWJpbGl0eSksXG5cdCkgeyB9XG5cblx0ZmlsdGVyKGVsZW1lbnQ6IFQsIHBhcmVudFZpc2liaWxpdHk6IFRyZWVWaXNpYmlsaXR5KTogVHJlZUZpbHRlclJlc3VsdDxGdXp6eVNjb3JlIHwgTGFiZWxGdXp6eVNjb3JlPiB7XG5cdFx0bGV0IHZpc2liaWxpdHkgPSBUcmVlVmlzaWJpbGl0eS5WaXNpYmxlO1xuXG5cdFx0aWYgKHRoaXMuX2ZpbHRlcikge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fZmlsdGVyLmZpbHRlcihlbGVtZW50LCBwYXJlbnRWaXNpYmlsaXR5KTtcblxuXHRcdFx0aWYgKHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHR2aXNpYmlsaXR5ID0gcmVzdWx0ID8gVHJlZVZpc2liaWxpdHkuVmlzaWJsZSA6IFRyZWVWaXNpYmlsaXR5LkhpZGRlbjtcblx0XHRcdH0gZWxzZSBpZiAoaXNGaWx0ZXJSZXN1bHQocmVzdWx0KSkge1xuXHRcdFx0XHR2aXNpYmlsaXR5ID0gZ2V0VmlzaWJsZVN0YXRlKHJlc3VsdC52aXNpYmlsaXR5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZpc2liaWxpdHkgPSByZXN1bHQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2aXNpYmlsaXR5ID09PSBUcmVlVmlzaWJpbGl0eS5IaWRkZW4pIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3RvdGFsQ291bnQrKztcblxuXHRcdGlmICghdGhpcy5fcGF0dGVybikge1xuXHRcdFx0dGhpcy5fbWF0Y2hDb3VudCsrO1xuXHRcdFx0cmV0dXJuIHsgZGF0YTogRnV6enlTY29yZS5EZWZhdWx0LCB2aXNpYmlsaXR5IH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLl9rZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyLmdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKGVsZW1lbnQpO1xuXHRcdGNvbnN0IGxhYmVscyA9IEFycmF5LmlzQXJyYXkobGFiZWwpID8gbGFiZWwgOiBbbGFiZWxdO1xuXG5cdFx0Zm9yIChjb25zdCBsIG9mIGxhYmVscykge1xuXHRcdFx0Y29uc3QgbGFiZWxTdHI6IHN0cmluZyA9IGwgJiYgbC50b1N0cmluZygpO1xuXHRcdFx0aWYgKHR5cGVvZiBsYWJlbFN0ciA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0cmV0dXJuIHsgZGF0YTogRnV6enlTY29yZS5EZWZhdWx0LCB2aXNpYmlsaXR5IH07XG5cdFx0XHR9XG5cblx0XHRcdGxldCBzY29yZTogRnV6enlTY29yZSB8IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0aGlzLl9maW5kTWF0Y2hUeXBlID09PSBUcmVlRmluZE1hdGNoVHlwZS5Db250aWd1b3VzKSB7XG5cdFx0XHRcdHNjb3JlID0gY29udGlndW91c0Z1enp5U2NvcmUodGhpcy5fbG93ZXJjYXNlUGF0dGVybiwgbGFiZWxTdHIudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzY29yZSA9IGZ1enp5U2NvcmUodGhpcy5fcGF0dGVybiwgdGhpcy5fbG93ZXJjYXNlUGF0dGVybiwgMCwgbGFiZWxTdHIsIGxhYmVsU3RyLnRvTG93ZXJDYXNlKCksIDAsIHsgZmlyc3RNYXRjaENhbkJlV2VhazogdHJ1ZSwgYm9vc3RGdWxsTWF0Y2g6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2NvcmUpIHtcblx0XHRcdFx0dGhpcy5fbWF0Y2hDb3VudCsrO1xuXHRcdFx0XHRyZXR1cm4gbGFiZWxzLmxlbmd0aCA9PT0gMSA/XG5cdFx0XHRcdFx0eyBkYXRhOiBzY29yZSwgdmlzaWJpbGl0eSB9IDpcblx0XHRcdFx0XHR7IGRhdGE6IHsgbGFiZWw6IGxhYmVsU3RyLCBzY29yZTogc2NvcmUgfSwgdmlzaWJpbGl0eSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9maW5kTW9kZSA9PT0gVHJlZUZpbmRNb2RlLkZpbHRlcikge1xuXHRcdFx0aWYgKHR5cGVvZiB0aGlzLl9kZWZhdWx0RmluZFZpc2liaWxpdHkgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9kZWZhdWx0RmluZFZpc2liaWxpdHk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX2RlZmF1bHRGaW5kVmlzaWJpbGl0eSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZGVmYXVsdEZpbmRWaXNpYmlsaXR5KGVsZW1lbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2U7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB7IGRhdGE6IEZ1enp5U2NvcmUuRGVmYXVsdCwgdmlzaWJpbGl0eSB9O1xuXHRcdH1cblx0fVxuXG5cdHJlc2V0KCk6IHZvaWQge1xuXHRcdHRoaXMuX3RvdGFsQ291bnQgPSAwO1xuXHRcdHRoaXMuX21hdGNoQ291bnQgPSAwO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMuZGlzcG9zYWJsZXMpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRyZWVGaW5kVG9nZ2xlQ29udHJpYnV0aW9uIHtcblx0aWQ6IHN0cmluZztcblx0dGl0bGU6IHN0cmluZztcblx0aWNvbjogVGhlbWVJY29uO1xuXHRpc0NoZWNrZWQ6IGJvb2xlYW47XG59XG5cbmNsYXNzIFRyZWVGaW5kVG9nZ2xlIGV4dGVuZHMgVG9nZ2xlIHtcblxuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRyaWJ1dGlvbjogSVRyZWVGaW5kVG9nZ2xlQ29udHJpYnV0aW9uLCBvcHRzOiBJVG9nZ2xlU3R5bGVzLCBob3ZlckRlbGVnYXRlPzogSUhvdmVyRGVsZWdhdGUpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpY29uOiBjb250cmlidXRpb24uaWNvbixcblx0XHRcdHRpdGxlOiBjb250cmlidXRpb24udGl0bGUsXG5cdFx0XHRpc0NoZWNrZWQ6IGNvbnRyaWJ1dGlvbi5pc0NoZWNrZWQsXG5cdFx0XHRpbnB1dEFjdGl2ZU9wdGlvbkJvcmRlcjogb3B0cy5pbnB1dEFjdGl2ZU9wdGlvbkJvcmRlcixcblx0XHRcdGlucHV0QWN0aXZlT3B0aW9uRm9yZWdyb3VuZDogb3B0cy5pbnB1dEFjdGl2ZU9wdGlvbkZvcmVncm91bmQsXG5cdFx0XHRpbnB1dEFjdGl2ZU9wdGlvbkJhY2tncm91bmQ6IG9wdHMuaW5wdXRBY3RpdmVPcHRpb25CYWNrZ3JvdW5kLFxuXHRcdFx0aG92ZXJEZWxlZ2F0ZSxcblx0XHR9KTtcblxuXHRcdHRoaXMuaWQgPSBjb250cmlidXRpb24uaWQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbmRUb2dnbGVzIHtcblx0cHJpdmF0ZSBzdGF0ZU1hcDogTWFwPHN0cmluZywgSVRyZWVGaW5kVG9nZ2xlQ29udHJpYnV0aW9uPjtcblxuXHRjb25zdHJ1Y3RvcihzdGFydFN0YXRlczogSVRyZWVGaW5kVG9nZ2xlQ29udHJpYnV0aW9uW10pIHtcblx0XHR0aGlzLnN0YXRlTWFwID0gbmV3IE1hcChzdGFydFN0YXRlcy5tYXAoc3RhdGUgPT4gW3N0YXRlLmlkLCB7IC4uLnN0YXRlIH1dKSk7XG5cdH1cblxuXHRzdGF0ZXMoKTogSVRyZWVGaW5kVG9nZ2xlQ29udHJpYnV0aW9uW10ge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMuc3RhdGVNYXAudmFsdWVzKCkpO1xuXHR9XG5cblx0Z2V0KGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVNYXAuZ2V0KGlkKTtcblx0XHRpZiAoc3RhdGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyBzdGF0ZSBmb3VuZCBmb3IgdG9nZ2xlIGlkICR7aWR9YCk7XG5cdFx0fVxuXHRcdHJldHVybiBzdGF0ZS5pc0NoZWNrZWQ7XG5cdH1cblxuXHRzZXQoaWQ6IHN0cmluZywgdmFsdWU6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGVNYXAuZ2V0KGlkKTtcblx0XHRpZiAoc3RhdGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyBzdGF0ZSBmb3VuZCBmb3IgdG9nZ2xlIGlkICR7aWR9YCk7XG5cdFx0fVxuXHRcdGlmIChzdGF0ZS5pc0NoZWNrZWQgPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHN0YXRlLmlzQ2hlY2tlZCA9IHZhbHVlO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRyZWVGaW5kVG9nZ2xlQ2hhbmdlRXZlbnQge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSBpc0NoZWNrZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbmRXaWRnZXRTdHlsZXMge1xuXHRsaXN0RmlsdGVyV2lkZ2V0QmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsaXN0RmlsdGVyV2lkZ2V0T3V0bGluZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsaXN0RmlsdGVyV2lkZ2V0Tm9NYXRjaGVzT3V0bGluZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsaXN0RmlsdGVyV2lkZ2V0U2hhZG93OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHRvZ2dsZVN0eWxlczogSVRvZ2dsZVN0eWxlcztcblx0cmVhZG9ubHkgaW5wdXRCb3hTdHlsZXM6IElJbnB1dEJveFN0eWxlcztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmluZFdpZGdldE9wdGlvbnMge1xuXHRyZWFkb25seSBoaXN0b3J5Pzogc3RyaW5nW107XG5cdHJlYWRvbmx5IHN0eWxlcz86IElGaW5kV2lkZ2V0U3R5bGVzO1xufVxuXG5jb25zdCB1bnRoZW1lZEZpbmRXaWRnZXRTdHlsZXM6IElGaW5kV2lkZ2V0U3R5bGVzID0ge1xuXHRpbnB1dEJveFN0eWxlczogdW50aGVtZWRJbmJveFN0eWxlcyxcblx0dG9nZ2xlU3R5bGVzOiB1bnRoZW1lZFRvZ2dsZVN0eWxlcyxcblx0bGlzdEZpbHRlcldpZGdldEJhY2tncm91bmQ6IHVuZGVmaW5lZCxcblx0bGlzdEZpbHRlcldpZGdldE5vTWF0Y2hlc091dGxpbmU6IHVuZGVmaW5lZCxcblx0bGlzdEZpbHRlcldpZGdldE91dGxpbmU6IHVuZGVmaW5lZCxcblx0bGlzdEZpbHRlcldpZGdldFNoYWRvdzogdW5kZWZpbmVkXG59O1xuXG5leHBvcnQgZW51bSBUcmVlRmluZE1vZGUge1xuXHRIaWdobGlnaHQsXG5cdEZpbHRlclxufVxuXG5leHBvcnQgZW51bSBUcmVlRmluZE1hdGNoVHlwZSB7XG5cdEZ1enp5LFxuXHRDb250aWd1b3VzXG59XG5cbmNsYXNzIEZpbmRXaWRnZXQ8VCwgVEZpbHRlckRhdGE+IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBlbGVtZW50cyA9IGgoJy5tb25hY28tdHJlZS10eXBlLWZpbHRlcicsIFtcblx0XHRoKCcubW9uYWNvLXRyZWUtdHlwZS1maWx0ZXItaW5wdXRAZmluZElucHV0JyksXG5cdFx0aCgnLm1vbmFjby10cmVlLXR5cGUtZmlsdGVyLWFjdGlvbmJhckBhY3Rpb25iYXInKSxcblx0XSk7XG5cblx0Z2V0IHZhbHVlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuZmluZElucHV0LmlucHV0Qm94LnZhbHVlO1xuXHR9XG5cblx0c2V0IHZhbHVlKHZhbHVlOiBzdHJpbmcpIHtcblx0XHR0aGlzLmZpbmRJbnB1dC5pbnB1dEJveC52YWx1ZSA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBmaW5kSW5wdXQ6IEZpbmRJbnB1dDtcblx0cHJpdmF0ZSByZWFkb25seSBhY3Rpb25iYXI6IEFjdGlvbkJhcjtcblx0cHJpdmF0ZSByZWFkb25seSB0b2dnbGVzOiBUcmVlRmluZFRvZ2dsZVtdID0gW107XG5cblx0cmVhZG9ubHkgX29uRGlkRGlzYWJsZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkRGlzYWJsZSA9IHRoaXMuX29uRGlkRGlzYWJsZS5ldmVudDtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWYWx1ZTogRXZlbnQ8c3RyaW5nPjtcblx0cmVhZG9ubHkgb25EaWRUb2dnbGVDaGFuZ2U6IEV2ZW50PElUcmVlRmluZFRvZ2dsZUNoYW5nZUV2ZW50PjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgdHJlZTogQWJzdHJhY3RUcmVlPFQsIFRGaWx0ZXJEYXRhLCBhbnk+LFxuXHRcdGNvbnRleHRWaWV3UHJvdmlkZXI6IElDb250ZXh0Vmlld1Byb3ZpZGVyLFxuXHRcdHBsYWNlaG9sZGVyOiBzdHJpbmcsXG5cdFx0dG9nZ2xlQ29udHJpYnV0aW9uczogSVRyZWVGaW5kVG9nZ2xlQ29udHJpYnV0aW9uW10gPSBbXSxcblx0XHRvcHRpb25zPzogSUZpbmRXaWRnZXRPcHRpb25zXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50cy5yb290KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5lbGVtZW50cy5yb290LnJlbW92ZSgpKSk7XG5cblx0XHRjb25zdCBzdHlsZXMgPSBvcHRpb25zPy5zdHlsZXMgPz8gdW50aGVtZWRGaW5kV2lkZ2V0U3R5bGVzO1xuXG5cdFx0aWYgKHN0eWxlcy5saXN0RmlsdGVyV2lkZ2V0QmFja2dyb3VuZCkge1xuXHRcdFx0dGhpcy5lbGVtZW50cy5yb290LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHN0eWxlcy5saXN0RmlsdGVyV2lkZ2V0QmFja2dyb3VuZDtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RGaWx0ZXJXaWRnZXRTaGFkb3cpIHtcblx0XHRcdHRoaXMuZWxlbWVudHMucm9vdC5zdHlsZS5ib3hTaGFkb3cgPSBgMCAwIDhweCAycHggJHtzdHlsZXMubGlzdEZpbHRlcldpZGdldFNoYWRvd31gO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvZ2dsZUhvdmVyRGVsZWdhdGUgPSB0aGlzLl9yZWdpc3RlcihjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSgpKTtcblx0XHR0aGlzLnRvZ2dsZXMgPSB0b2dnbGVDb250cmlidXRpb25zLm1hcChjb250cmlidXRpb24gPT4gdGhpcy5fcmVnaXN0ZXIobmV3IFRyZWVGaW5kVG9nZ2xlKGNvbnRyaWJ1dGlvbiwgc3R5bGVzLnRvZ2dsZVN0eWxlcywgdG9nZ2xlSG92ZXJEZWxlZ2F0ZSkpKTtcblx0XHR0aGlzLm9uRGlkVG9nZ2xlQ2hhbmdlID0gRXZlbnQuYW55KC4uLnRoaXMudG9nZ2xlcy5tYXAodG9nZ2xlID0+IEV2ZW50Lm1hcCh0b2dnbGUub25DaGFuZ2UsICgpID0+ICh7IGlkOiB0b2dnbGUuaWQsIGlzQ2hlY2tlZDogdG9nZ2xlLmNoZWNrZWQgfSkpKSk7XG5cblx0XHRjb25zdCBoaXN0b3J5ID0gb3B0aW9ucz8uaGlzdG9yeSB8fCBbXTtcblx0XHR0aGlzLmZpbmRJbnB1dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBGaW5kSW5wdXQodGhpcy5lbGVtZW50cy5maW5kSW5wdXQsIGNvbnRleHRWaWV3UHJvdmlkZXIsIHtcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndHlwZSB0byBzZWFyY2gnLCBcIlR5cGUgdG8gc2VhcmNoXCIpLFxuXHRcdFx0cGxhY2Vob2xkZXIsXG5cdFx0XHRhZGRpdGlvbmFsVG9nZ2xlczogdGhpcy50b2dnbGVzLFxuXHRcdFx0c2hvd0NvbW1vbkZpbmRUb2dnbGVzOiBmYWxzZSxcblx0XHRcdGlucHV0Qm94U3R5bGVzOiBzdHlsZXMuaW5wdXRCb3hTdHlsZXMsXG5cdFx0XHR0b2dnbGVTdHlsZXM6IHN0eWxlcy50b2dnbGVTdHlsZXMsXG5cdFx0XHRoaXN0b3J5OiBuZXcgU2V0KGhpc3RvcnkpXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5hY3Rpb25iYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKHRoaXMuZWxlbWVudHMuYWN0aW9uYmFyKSk7XG5cblx0XHRjb25zdCBlbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5maW5kSW5wdXQuaW5wdXRCb3guaW5wdXRFbGVtZW50LCAna2V5ZG93bicpKTtcblx0XHRjb25zdCBvbktleURvd24gPSBFdmVudC5jaGFpbihlbWl0dGVyLmV2ZW50LCAkID0+ICQubWFwKGUgPT4gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIob25LZXlEb3duKChlKSA9PiB7XG5cdFx0XHQvLyBVc2luZyBlcXVhbHMoKSBzbyB3ZSByZXNlcnZlIG1vZGlmaWVkIGtleXMgZm9yIGZ1dHVyZSB1c2Vcblx0XHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0XHQvLyBUaGlzIGlzIHRoZSBvbmx5IGtleWJvYXJkIHdheSB0byByZXR1cm4gdG8gdGhlIHRyZWUgZnJvbSBhIGhpc3RvcnkgaXRlbSB0aGF0IGlzbid0IHRoZSBsYXN0IG9uZVxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdHRoaXMuZmluZElucHV0LmlucHV0Qm94LmFkZFRvSGlzdG9yeSgpO1xuXHRcdFx0XHR0aGlzLnRyZWUuZG9tRm9jdXMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuZXF1YWxzKEtleUNvZGUuRG93bkFycm93KSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdGlmICh0aGlzLmZpbmRJbnB1dC5pbnB1dEJveC5pc0F0TGFzdEluSGlzdG9yeSgpIHx8IHRoaXMuZmluZElucHV0LmlucHV0Qm94LmlzTm93aGVyZUluSGlzdG9yeSgpKSB7XG5cdFx0XHRcdFx0Ly8gUmV0YWluIG9yaWdpbmFsIHByZS1oaXN0b3J5IERvd25BcnJvdyBiZWhhdmlvclxuXHRcdFx0XHRcdHRoaXMuZmluZElucHV0LmlucHV0Qm94LmFkZFRvSGlzdG9yeSgpO1xuXHRcdFx0XHRcdHRoaXMudHJlZS5kb21Gb2N1cygpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIERvd253YXJkIHRocm91Z2ggaGlzdG9yeVxuXHRcdFx0XHRcdHRoaXMuZmluZElucHV0LmlucHV0Qm94LnNob3dOZXh0VmFsdWUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5VcEFycm93KSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdC8vIFVwd2FyZCB0aHJvdWdoIGhpc3Rvcnlcblx0XHRcdFx0dGhpcy5maW5kSW5wdXQuaW5wdXRCb3guc2hvd1ByZXZpb3VzVmFsdWUoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGNsb3NlQWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbignY2xvc2UnLCBsb2NhbGl6ZSgnY2xvc2UnLCBcIkNsb3NlXCIpLCAnY29kaWNvbiBjb2RpY29uLWNsb3NlJywgdHJ1ZSwgKCkgPT4gdGhpcy5kaXNwb3NlKCkpKTtcblx0XHR0aGlzLmFjdGlvbmJhci5wdXNoKGNsb3NlQWN0aW9uLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblxuXHRcdHRoaXMub25EaWRDaGFuZ2VWYWx1ZSA9IHRoaXMuZmluZElucHV0Lm9uRGlkQ2hhbmdlO1xuXHR9XG5cblx0c2V0VG9nZ2xlU3RhdGUoaWQ6IHN0cmluZywgY2hlY2tlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IHRvZ2dsZSA9IHRoaXMudG9nZ2xlcy5maW5kKHRvZ2dsZSA9PiB0b2dnbGUuaWQgPT09IGlkKTtcblx0XHRpZiAodG9nZ2xlKSB7XG5cdFx0XHR0b2dnbGUuY2hlY2tlZCA9IGNoZWNrZWQ7XG5cdFx0fVxuXHR9XG5cblx0c2V0UGxhY2VIb2xkZXIocGxhY2VIb2xkZXI6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuZmluZElucHV0LmlucHV0Qm94LnNldFBsYWNlSG9sZGVyKHBsYWNlSG9sZGVyKTtcblx0fVxuXG5cdGdldEhpc3RvcnkoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLmZpbmRJbnB1dC5pbnB1dEJveC5nZXRIaXN0b3J5KCk7XG5cdH1cblxuXHRmb2N1cygpIHtcblx0XHR0aGlzLmZpbmRJbnB1dC5mb2N1cygpO1xuXHR9XG5cblx0c2VsZWN0KCkge1xuXHRcdHRoaXMuZmluZElucHV0LnNlbGVjdCgpO1xuXG5cdFx0Ly8gUmVwb3NpdGlvbiB0byBsYXN0IGluIGhpc3Rvcnlcblx0XHR0aGlzLmZpbmRJbnB1dC5pbnB1dEJveC5hZGRUb0hpc3RvcnkodHJ1ZSk7XG5cdH1cblxuXHRzaG93TWVzc2FnZShtZXNzYWdlOiBJTWVzc2FnZSk6IHZvaWQge1xuXHRcdHRoaXMuZmluZElucHV0LnNob3dNZXNzYWdlKG1lc3NhZ2UpO1xuXHR9XG5cblx0Y2xlYXJNZXNzYWdlKCk6IHZvaWQge1xuXHRcdHRoaXMuZmluZElucHV0LmNsZWFyTWVzc2FnZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgZGlzcG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9vbkRpZERpc2FibGUuZmlyZSgpO1xuXHRcdHRoaXMuZWxlbWVudHMucm9vdC5jbGFzc0xpc3QuYWRkKCdkaXNhYmxlZCcpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMzAwKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZW51bSBEZWZhdWx0VHJlZVRvZ2dsZXMge1xuXHRNb2RlID0gJ21vZGUnLFxuXHRNYXRjaFR5cGUgPSAnbWF0Y2hUeXBlJyxcbn1cblxuaW50ZXJmYWNlIElBYnN0cmFjdEZpbmRDb250cm9sbGVyT3B0aW9ucyBleHRlbmRzIElGaW5kV2lkZ2V0T3B0aW9ucyB7XG5cdHBsYWNlaG9sZGVyPzogc3RyaW5nO1xuXHR0b2dnbGVzPzogSVRyZWVGaW5kVG9nZ2xlQ29udHJpYnV0aW9uW107XG5cdHNob3dOb3RGb3VuZE1lc3NhZ2U/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaW5kQ29udHJvbGxlck9wdGlvbnMgZXh0ZW5kcyBJQWJzdHJhY3RGaW5kQ29udHJvbGxlck9wdGlvbnMge1xuXHRkZWZhdWx0RmluZE1vZGU/OiBUcmVlRmluZE1vZGU7XG5cdGRlZmF1bHRGaW5kTWF0Y2hUeXBlPzogVHJlZUZpbmRNYXRjaFR5cGU7XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdEZpbmRDb250cm9sbGVyPFQsIFRGaWx0ZXJEYXRhPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9oaXN0b3J5OiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9wYXR0ZXJuID0gJyc7XG5cdGdldCBwYXR0ZXJuKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl9wYXR0ZXJuOyB9XG5cdHByaXZhdGUgcHJldmlvdXNQYXR0ZXJuID0gJyc7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IHRvZ2dsZXM6IEZpbmRUb2dnbGVzO1xuXG5cdHByaXZhdGUgX3BsYWNlaG9sZGVyOiBzdHJpbmc7XG5cdHByb3RlY3RlZCBnZXQgcGxhY2Vob2xkZXIoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuX3BsYWNlaG9sZGVyOyB9XG5cdHByb3RlY3RlZCBzZXQgcGxhY2Vob2xkZXIodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMuX3BsYWNlaG9sZGVyID0gdmFsdWU7XG5cdFx0dGhpcy53aWRnZXQ/LnNldFBsYWNlSG9sZGVyKHZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgd2lkZ2V0OiBGaW5kV2lkZ2V0PFQsIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVBhdHRlcm4gPSBuZXcgRW1pdHRlcjxzdHJpbmc+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUGF0dGVybiA9IHRoaXMuX29uRGlkQ2hhbmdlUGF0dGVybi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU9wZW5TdGF0ZSA9IG5ldyBFbWl0dGVyPGJvb2xlYW4+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlT3BlblN0YXRlID0gdGhpcy5fb25EaWRDaGFuZ2VPcGVuU3RhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBlbmFibGVkRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByb3RlY3RlZCByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgdHJlZTogQWJzdHJhY3RUcmVlPFQsIFRGaWx0ZXJEYXRhLCBhbnk+LFxuXHRcdHByb3RlY3RlZCBmaWx0ZXI6IElGaW5kRmlsdGVyPFQ+LFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBjb250ZXh0Vmlld1Byb3ZpZGVyOiBJQ29udGV4dFZpZXdQcm92aWRlcixcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgb3B0aW9uczogSUFic3RyYWN0RmluZENvbnRyb2xsZXJPcHRpb25zID0ge31cblx0KSB7XG5cdFx0dGhpcy50b2dnbGVzID0gbmV3IEZpbmRUb2dnbGVzKG9wdGlvbnMudG9nZ2xlcyA/PyBbXSk7XG5cdFx0dGhpcy5fcGxhY2Vob2xkZXIgPSBvcHRpb25zLnBsYWNlaG9sZGVyID8/IGxvY2FsaXplKCd0eXBlIHRvIHNlYXJjaCcsIFwiVHlwZSB0byBzZWFyY2hcIik7XG5cdH1cblxuXHRpc09wZW5lZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLndpZGdldDtcblx0fVxuXG5cdG9wZW4oKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMud2lkZ2V0KSB7XG5cdFx0XHR0aGlzLndpZGdldC5mb2N1cygpO1xuXHRcdFx0dGhpcy53aWRnZXQuc2VsZWN0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy50cmVlLnVwZGF0ZU9wdGlvbnMoeyBwYWRkaW5nVG9wOiAzMCB9KTtcblxuXHRcdHRoaXMud2lkZ2V0ID0gbmV3IEZpbmRXaWRnZXQodGhpcy50cmVlLmdldEhUTUxFbGVtZW50KCksIHRoaXMudHJlZSwgdGhpcy5jb250ZXh0Vmlld1Byb3ZpZGVyLCB0aGlzLnBsYWNlaG9sZGVyLCB0aGlzLnRvZ2dsZXMuc3RhdGVzKCksIHsgLi4udGhpcy5vcHRpb25zLCBoaXN0b3J5OiB0aGlzLl9oaXN0b3J5IH0pO1xuXHRcdHRoaXMuZW5hYmxlZERpc3Bvc2FibGVzLmFkZCh0aGlzLndpZGdldCk7XG5cblx0XHR0aGlzLndpZGdldC5vbkRpZENoYW5nZVZhbHVlKHRoaXMub25EaWRDaGFuZ2VWYWx1ZSwgdGhpcywgdGhpcy5lbmFibGVkRGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMud2lkZ2V0Lm9uRGlkRGlzYWJsZSh0aGlzLmNsb3NlLCB0aGlzLCB0aGlzLmVuYWJsZWREaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy53aWRnZXQub25EaWRUb2dnbGVDaGFuZ2UodGhpcy5vbkRpZFRvZ2dsZUNoYW5nZSwgdGhpcywgdGhpcy5lbmFibGVkRGlzcG9zYWJsZXMpO1xuXG5cdFx0dGhpcy53aWRnZXQuZm9jdXMoKTtcblxuXHRcdHRoaXMud2lkZ2V0LnZhbHVlID0gdGhpcy5wcmV2aW91c1BhdHRlcm47XG5cdFx0dGhpcy53aWRnZXQuc2VsZWN0KCk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZU9wZW5TdGF0ZS5maXJlKHRydWUpO1xuXHR9XG5cblx0Y2xvc2UoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLndpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudHJlZS51cGRhdGVPcHRpb25zKHsgcGFkZGluZ1RvcDogMCB9KTtcblxuXHRcdHRoaXMuX2hpc3RvcnkgPSB0aGlzLndpZGdldC5nZXRIaXN0b3J5KCk7XG5cdFx0dGhpcy53aWRnZXQgPSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLmVuYWJsZWREaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0dGhpcy5wcmV2aW91c1BhdHRlcm4gPSB0aGlzLnBhdHRlcm47XG5cdFx0dGhpcy5vbkRpZENoYW5nZVZhbHVlKCcnKTtcblx0XHR0aGlzLnRyZWUuZG9tRm9jdXMoKTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlT3BlblN0YXRlLmZpcmUoZmFsc2UpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRGlkQ2hhbmdlVmFsdWUocGF0dGVybjogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fcGF0dGVybiA9IHBhdHRlcm47XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VQYXR0ZXJuLmZpcmUocGF0dGVybik7XG5cblx0XHR0aGlzLmZpbHRlci5wYXR0ZXJuID0gcGF0dGVybjtcblx0XHR0aGlzLmFwcGx5UGF0dGVybihwYXR0ZXJuKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBhcHBseVBhdHRlcm4ocGF0dGVybjogc3RyaW5nKTogdm9pZDtcblxuXHRwcm90ZWN0ZWQgb25EaWRUb2dnbGVDaGFuZ2UoZTogSVRyZWVGaW5kVG9nZ2xlQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLnRvZ2dsZXMuc2V0KGUuaWQsIGUuaXNDaGVja2VkKTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGVUb2dnbGVTdGF0ZShpZDogc3RyaW5nLCBjaGVja2VkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy50b2dnbGVzLnNldChpZCwgY2hlY2tlZCk7XG5cdFx0dGhpcy53aWRnZXQ/LnNldFRvZ2dsZVN0YXRlKGlkLCBjaGVja2VkKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJNZXNzYWdlKHNob3dOb3RGb3VuZDogYm9vbGVhbiwgd2FybmluZ01lc3NhZ2U/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoc2hvd05vdEZvdW5kKSB7XG5cdFx0XHRpZiAodGhpcy50cmVlLm9wdGlvbnMuc2hvd05vdEZvdW5kTWVzc2FnZSA/PyB0cnVlKSB7XG5cdFx0XHRcdHRoaXMud2lkZ2V0Py5zaG93TWVzc2FnZSh7IHR5cGU6IE1lc3NhZ2VUeXBlLldBUk5JTkcsIGNvbnRlbnQ6IHdhcm5pbmdNZXNzYWdlID8/IGxvY2FsaXplKCdub3QgZm91bmQnLCBcIk5vIHJlc3VsdHMgZm91bmQuXCIpIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy53aWRnZXQ/LnNob3dNZXNzYWdlKHsgdHlwZTogTWVzc2FnZVR5cGUuV0FSTklORyB9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy53aWRnZXQ/LmNsZWFyTWVzc2FnZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhbGVydFJlc3VsdHMocmVzdWx0czogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKCFyZXN1bHRzKSB7XG5cdFx0XHRhbGVydChsb2NhbGl6ZSgncmVwbEZpbmROb1Jlc3VsdHMnLCBcIk5vIHJlc3VsdHNcIikpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhbGVydChsb2NhbGl6ZSgnZm91bmRSZXN1bHRzJywgXCJ7MH0gcmVzdWx0c1wiLCByZXN1bHRzKSk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9oaXN0b3J5ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUGF0dGVybi5kaXNwb3NlKCk7XG5cdFx0dGhpcy5lbmFibGVkRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBGaW5kQ29udHJvbGxlcjxULCBURmlsdGVyRGF0YT4gZXh0ZW5kcyBBYnN0cmFjdEZpbmRDb250cm9sbGVyPFQsIFRGaWx0ZXJEYXRhPiB7XG5cblx0Z2V0IG1vZGUoKTogVHJlZUZpbmRNb2RlIHsgcmV0dXJuIHRoaXMudG9nZ2xlcy5nZXQoRGVmYXVsdFRyZWVUb2dnbGVzLk1vZGUpID8gVHJlZUZpbmRNb2RlLkZpbHRlciA6IFRyZWVGaW5kTW9kZS5IaWdobGlnaHQ7IH1cblx0c2V0IG1vZGUobW9kZTogVHJlZUZpbmRNb2RlKSB7XG5cdFx0aWYgKG1vZGUgPT09IHRoaXMubW9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzRmlsdGVyTW9kZSA9IG1vZGUgPT09IFRyZWVGaW5kTW9kZS5GaWx0ZXI7XG5cdFx0dGhpcy51cGRhdGVUb2dnbGVTdGF0ZShEZWZhdWx0VHJlZVRvZ2dsZXMuTW9kZSwgaXNGaWx0ZXJNb2RlKTtcblx0XHR0aGlzLnBsYWNlaG9sZGVyID0gaXNGaWx0ZXJNb2RlID8gbG9jYWxpemUoJ3R5cGUgdG8gZmlsdGVyJywgXCJUeXBlIHRvIGZpbHRlclwiKSA6IGxvY2FsaXplKCd0eXBlIHRvIHNlYXJjaCcsIFwiVHlwZSB0byBzZWFyY2hcIik7XG5cblx0XHR0aGlzLmZpbHRlci5maW5kTW9kZSA9IG1vZGU7XG5cdFx0dGhpcy50cmVlLnJlZmlsdGVyKCk7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZU1vZGUuZmlyZShtb2RlKTtcblx0fVxuXG5cdGdldCBtYXRjaFR5cGUoKTogVHJlZUZpbmRNYXRjaFR5cGUgeyByZXR1cm4gdGhpcy50b2dnbGVzLmdldChEZWZhdWx0VHJlZVRvZ2dsZXMuTWF0Y2hUeXBlKSA/IFRyZWVGaW5kTWF0Y2hUeXBlLkZ1enp5IDogVHJlZUZpbmRNYXRjaFR5cGUuQ29udGlndW91czsgfVxuXHRzZXQgbWF0Y2hUeXBlKG1hdGNoVHlwZTogVHJlZUZpbmRNYXRjaFR5cGUpIHtcblx0XHRpZiAobWF0Y2hUeXBlID09PSB0aGlzLm1hdGNoVHlwZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlVG9nZ2xlU3RhdGUoRGVmYXVsdFRyZWVUb2dnbGVzLk1hdGNoVHlwZSwgbWF0Y2hUeXBlID09PSBUcmVlRmluZE1hdGNoVHlwZS5GdXp6eSk7XG5cblx0XHR0aGlzLmZpbHRlci5maW5kTWF0Y2hUeXBlID0gbWF0Y2hUeXBlO1xuXHRcdHRoaXMudHJlZS5yZWZpbHRlcigpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VNYXRjaFR5cGUuZmlyZShtYXRjaFR5cGUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VNb2RlID0gbmV3IEVtaXR0ZXI8VHJlZUZpbmRNb2RlPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZU1vZGUgPSB0aGlzLl9vbkRpZENoYW5nZU1vZGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VNYXRjaFR5cGUgPSBuZXcgRW1pdHRlcjxUcmVlRmluZE1hdGNoVHlwZT4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VNYXRjaFR5cGUgPSB0aGlzLl9vbkRpZENoYW5nZU1hdGNoVHlwZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR0cmVlOiBBYnN0cmFjdFRyZWU8VCwgVEZpbHRlckRhdGEsIGFueT4sXG5cdFx0cHJvdGVjdGVkIG92ZXJyaWRlIGZpbHRlcjogRmluZEZpbHRlcjxUPixcblx0XHRjb250ZXh0Vmlld1Byb3ZpZGVyOiBJQ29udGV4dFZpZXdQcm92aWRlcixcblx0XHRvcHRpb25zOiBJRmluZENvbnRyb2xsZXJPcHRpb25zID0ge31cblx0KSB7XG5cdFx0Y29uc3QgZGVmYXVsdEZpbmRNb2RlID0gb3B0aW9ucy5kZWZhdWx0RmluZE1vZGUgPz8gVHJlZUZpbmRNb2RlLkhpZ2hsaWdodDtcblx0XHRjb25zdCBkZWZhdWx0RmluZE1hdGNoVHlwZSA9IG9wdGlvbnMuZGVmYXVsdEZpbmRNYXRjaFR5cGUgPz8gVHJlZUZpbmRNYXRjaFR5cGUuRnV6enk7XG5cblx0XHRjb25zdCB0b2dnbGVDb250cmlidXRpb25zOiBJVHJlZUZpbmRUb2dnbGVDb250cmlidXRpb25bXSA9IFt7XG5cdFx0XHRpZDogRGVmYXVsdFRyZWVUb2dnbGVzLk1vZGUsXG5cdFx0XHRpY29uOiBDb2RpY29uLmxpc3RGaWx0ZXIsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2ZpbHRlcicsIFwiRmlsdGVyXCIpLFxuXHRcdFx0aXNDaGVja2VkOiBkZWZhdWx0RmluZE1vZGUgPT09IFRyZWVGaW5kTW9kZS5GaWx0ZXIsXG5cdFx0fSwge1xuXHRcdFx0aWQ6IERlZmF1bHRUcmVlVG9nZ2xlcy5NYXRjaFR5cGUsXG5cdFx0XHRpY29uOiBDb2RpY29uLnNlYXJjaEZ1enp5LFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdmdXp6eVNlYXJjaCcsIFwiRnV6enkgTWF0Y2hcIiksXG5cdFx0XHRpc0NoZWNrZWQ6IGRlZmF1bHRGaW5kTWF0Y2hUeXBlID09PSBUcmVlRmluZE1hdGNoVHlwZS5GdXp6eSxcblx0XHR9XTtcblxuXHRcdGZpbHRlci5maW5kTWF0Y2hUeXBlID0gZGVmYXVsdEZpbmRNYXRjaFR5cGU7XG5cdFx0ZmlsdGVyLmZpbmRNb2RlID0gZGVmYXVsdEZpbmRNb2RlO1xuXG5cdFx0c3VwZXIodHJlZSwgZmlsdGVyLCBjb250ZXh0Vmlld1Byb3ZpZGVyLCB7IC4uLm9wdGlvbnMsIHRvZ2dsZXM6IHRvZ2dsZUNvbnRyaWJ1dGlvbnMgfSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLnRyZWUub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuaXNPcGVuZWQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnBhdHRlcm4ubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdHRoaXMudHJlZS5yZWZpbHRlcigpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMudHJlZS5vbldpbGxSZWZpbHRlcigoKSA9PiB0aGlzLmZpbHRlci5yZXNldCgpKSk7XG5cdH1cblxuXHR1cGRhdGVPcHRpb25zKG9wdGlvbnNVcGRhdGU6IElBYnN0cmFjdFRyZWVPcHRpb25zVXBkYXRlID0ge30pOiB2b2lkIHtcblx0XHRpZiAob3B0aW9uc1VwZGF0ZS5kZWZhdWx0RmluZE1vZGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5tb2RlID0gb3B0aW9uc1VwZGF0ZS5kZWZhdWx0RmluZE1vZGU7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnNVcGRhdGUuZGVmYXVsdEZpbmRNYXRjaFR5cGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5tYXRjaFR5cGUgPSBvcHRpb25zVXBkYXRlLmRlZmF1bHRGaW5kTWF0Y2hUeXBlO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhcHBseVBhdHRlcm4ocGF0dGVybjogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlLnJlZmlsdGVyKCk7XG5cblx0XHRpZiAocGF0dGVybikge1xuXHRcdFx0dGhpcy50cmVlLmZvY3VzTmV4dCgwLCB0cnVlLCB1bmRlZmluZWQsIChub2RlKSA9PiAhRnV6enlTY29yZS5pc0RlZmF1bHQobm9kZS5maWx0ZXJEYXRhIGFzIGFueSBhcyBGdXp6eVNjb3JlKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLnRyZWUuZ2V0Rm9jdXMoKTtcblxuXHRcdGlmIChmb2N1cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gZm9jdXNbMF07XG5cblx0XHRcdGlmICh0aGlzLnRyZWUuZ2V0UmVsYXRpdmVUb3AoZWxlbWVudCkgPT09IG51bGwpIHtcblx0XHRcdFx0dGhpcy50cmVlLnJldmVhbChlbGVtZW50LCAwLjUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHRzaG91bGRBbGxvd0ZvY3VzKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuaXNPcGVuZWQoKSB8fCAhdGhpcy5wYXR0ZXJuKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5maWx0ZXIudG90YWxDb3VudCA+IDAgJiYgdGhpcy5maWx0ZXIubWF0Y2hDb3VudCA8PSAxKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gIUZ1enp5U2NvcmUuaXNEZWZhdWx0KG5vZGUuZmlsdGVyRGF0YSBhcyBhbnkgYXMgRnV6enlTY29yZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgb25EaWRUb2dnbGVDaGFuZ2UoZTogSVRyZWVGaW5kVG9nZ2xlQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoZS5pZCA9PT0gRGVmYXVsdFRyZWVUb2dnbGVzLk1vZGUpIHtcblx0XHRcdHRoaXMubW9kZSA9IGUuaXNDaGVja2VkID8gVHJlZUZpbmRNb2RlLkZpbHRlciA6IFRyZWVGaW5kTW9kZS5IaWdobGlnaHQ7XG5cdFx0fSBlbHNlIGlmIChlLmlkID09PSBEZWZhdWx0VHJlZVRvZ2dsZXMuTWF0Y2hUeXBlKSB7XG5cdFx0XHR0aGlzLm1hdGNoVHlwZSA9IGUuaXNDaGVja2VkID8gVHJlZUZpbmRNYXRjaFR5cGUuRnV6enkgOiBUcmVlRmluZE1hdGNoVHlwZS5Db250aWd1b3VzO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXIoKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9NYXRjaGVzID0gdGhpcy5maWx0ZXIubWF0Y2hDb3VudCA9PT0gMCAmJiB0aGlzLmZpbHRlci50b3RhbENvdW50ID4gMDtcblx0XHRjb25zdCBzaG93Tm90Rm91bmQgPSBub01hdGNoZXMgJiYgdGhpcy5wYXR0ZXJuLmxlbmd0aCA+IDA7XG5cblx0XHR0aGlzLnJlbmRlck1lc3NhZ2Uoc2hvd05vdEZvdW5kKTtcblxuXHRcdGlmICh0aGlzLnBhdHRlcm4ubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmFsZXJ0UmVzdWx0cyh0aGlzLmZpbHRlci5tYXRjaENvdW50KTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBTdGlja3lTY3JvbGxOb2RlPFQsIFRGaWx0ZXJEYXRhPiB7XG5cdHJlYWRvbmx5IG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT47XG5cdHJlYWRvbmx5IHN0YXJ0SW5kZXg6IG51bWJlcjtcblx0cmVhZG9ubHkgZW5kSW5kZXg6IG51bWJlcjtcblx0cmVhZG9ubHkgaGVpZ2h0OiBudW1iZXI7XG5cdHJlYWRvbmx5IHBvc2l0aW9uOiBudW1iZXI7XG59XG5cbmZ1bmN0aW9uIHN0aWNreVNjcm9sbE5vZGVTdGF0ZUVxdWFsczxULCBURmlsdGVyRGF0YT4obm9kZTE6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+LCBub2RlMjogU3RpY2t5U2Nyb2xsTm9kZTxULCBURmlsdGVyRGF0YT4pIHtcblx0cmV0dXJuIG5vZGUxLnBvc2l0aW9uID09PSBub2RlMi5wb3NpdGlvbiAmJiBzdGlja3lTY3JvbGxOb2RlRXF1YWxzKG5vZGUxLCBub2RlMik7XG59XG5cbmZ1bmN0aW9uIHN0aWNreVNjcm9sbE5vZGVFcXVhbHM8VCwgVEZpbHRlckRhdGE+KG5vZGUxOiBTdGlja3lTY3JvbGxOb2RlPFQsIFRGaWx0ZXJEYXRhPiwgbm9kZTI6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+KSB7XG5cdHJldHVybiBub2RlMS5ub2RlLmVsZW1lbnQgPT09IG5vZGUyLm5vZGUuZWxlbWVudCAmJlxuXHRcdG5vZGUxLnN0YXJ0SW5kZXggPT09IG5vZGUyLnN0YXJ0SW5kZXggJiZcblx0XHRub2RlMS5oZWlnaHQgPT09IG5vZGUyLmhlaWdodCAmJlxuXHRcdG5vZGUxLmVuZEluZGV4ID09PSBub2RlMi5lbmRJbmRleDtcbn1cblxuY2xhc3MgU3RpY2t5U2Nyb2xsU3RhdGU8VCwgVEZpbHRlckRhdGEsIFRSZWY+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBzdGlja3lOb2RlczogU3RpY2t5U2Nyb2xsTm9kZTxULCBURmlsdGVyRGF0YT5bXSA9IFtdXG5cdCkgeyB9XG5cblx0Z2V0IGNvdW50KCk6IG51bWJlciB7IHJldHVybiB0aGlzLnN0aWNreU5vZGVzLmxlbmd0aDsgfVxuXG5cdGVxdWFsKHN0YXRlOiBTdGlja3lTY3JvbGxTdGF0ZTxULCBURmlsdGVyRGF0YSwgVFJlZj4pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZXF1YWxzKHRoaXMuc3RpY2t5Tm9kZXMsIHN0YXRlLnN0aWNreU5vZGVzLCBzdGlja3lTY3JvbGxOb2RlU3RhdGVFcXVhbHMpO1xuXHR9XG5cblx0Y29udGFpbnMoZWxlbWVudDogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0aWNreU5vZGVzLnNvbWUobm9kZSA9PiBub2RlLm5vZGUuZWxlbWVudCA9PT0gZWxlbWVudC5lbGVtZW50KTtcblx0fVxuXG5cdGxhc3ROb2RlUGFydGlhbGx5VmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5jb3VudCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhc3RTdGlja3lOb2RlID0gdGhpcy5zdGlja3lOb2Rlc1t0aGlzLmNvdW50IC0gMV07XG5cdFx0aWYgKHRoaXMuY291bnQgPT09IDEpIHtcblx0XHRcdHJldHVybiBsYXN0U3RpY2t5Tm9kZS5wb3NpdGlvbiAhPT0gMDtcblx0XHR9XG5cblx0XHRjb25zdCBzZWNvbmRMYXN0U3RpY2t5Tm9kZSA9IHRoaXMuc3RpY2t5Tm9kZXNbdGhpcy5jb3VudCAtIDJdO1xuXHRcdHJldHVybiBzZWNvbmRMYXN0U3RpY2t5Tm9kZS5wb3NpdGlvbiArIHNlY29uZExhc3RTdGlja3lOb2RlLmhlaWdodCAhPT0gbGFzdFN0aWNreU5vZGUucG9zaXRpb247XG5cdH1cblxuXHRhbmltYXRpb25TdGF0ZUNoYW5nZWQocHJldmlvdXNTdGF0ZTogU3RpY2t5U2Nyb2xsU3RhdGU8VCwgVEZpbHRlckRhdGEsIFRSZWY+KTogYm9vbGVhbiB7XG5cdFx0aWYgKCFlcXVhbHModGhpcy5zdGlja3lOb2RlcywgcHJldmlvdXNTdGF0ZS5zdGlja3lOb2Rlcywgc3RpY2t5U2Nyb2xsTm9kZUVxdWFscykpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jb3VudCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhc3RTdGlja3lOb2RlID0gdGhpcy5zdGlja3lOb2Rlc1t0aGlzLmNvdW50IC0gMV07XG5cdFx0Y29uc3QgcHJldmlvdXNMYXN0U3RpY2t5Tm9kZSA9IHByZXZpb3VzU3RhdGUuc3RpY2t5Tm9kZXNbcHJldmlvdXNTdGF0ZS5jb3VudCAtIDFdO1xuXG5cdFx0cmV0dXJuIGxhc3RTdGlja3lOb2RlLnBvc2l0aW9uICE9PSBwcmV2aW91c0xhc3RTdGlja3lOb2RlLnBvc2l0aW9uO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0aWNreVNjcm9sbERlbGVnYXRlPFQsIFRGaWx0ZXJEYXRhPiB7XG5cdGNvbnN0cmFpblN0aWNreVNjcm9sbE5vZGVzKHN0aWNreU5vZGVzOiBTdGlja3lTY3JvbGxOb2RlPFQsIFRGaWx0ZXJEYXRhPltdLCBzdGlja3lTY3JvbGxNYXhJdGVtQ291bnQ6IG51bWJlciwgbWF4V2lkZ2V0SGVpZ2h0OiBudW1iZXIpOiBTdGlja3lTY3JvbGxOb2RlPFQsIFRGaWx0ZXJEYXRhPltdO1xufVxuXG5jbGFzcyBEZWZhdWx0U3RpY2t5U2Nyb2xsRGVsZWdhdGU8VCwgVEZpbHRlckRhdGE+IGltcGxlbWVudHMgSVN0aWNreVNjcm9sbERlbGVnYXRlPFQsIFRGaWx0ZXJEYXRhPiB7XG5cblx0Y29uc3RyYWluU3RpY2t5U2Nyb2xsTm9kZXMoc3RpY2t5Tm9kZXM6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+W10sIHN0aWNreVNjcm9sbE1heEl0ZW1Db3VudDogbnVtYmVyLCBtYXhXaWRnZXRIZWlnaHQ6IG51bWJlcik6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+W10ge1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzdGlja3lOb2Rlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3Qgc3RpY2t5Tm9kZSA9IHN0aWNreU5vZGVzW2ldO1xuXHRcdFx0Y29uc3Qgc3RpY2t5Tm9kZUJvdHRvbSA9IHN0aWNreU5vZGUucG9zaXRpb24gKyBzdGlja3lOb2RlLmhlaWdodDtcblx0XHRcdGlmIChzdGlja3lOb2RlQm90dG9tID4gbWF4V2lkZ2V0SGVpZ2h0IHx8IGkgPj0gc3RpY2t5U2Nyb2xsTWF4SXRlbUNvdW50KSB7XG5cdFx0XHRcdHJldHVybiBzdGlja3lOb2Rlcy5zbGljZSgwLCBpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RpY2t5Tm9kZXM7XG5cdH1cbn1cblxuY2xhc3MgU3RpY2t5U2Nyb2xsQ29udHJvbGxlcjxULCBURmlsdGVyRGF0YSwgVFJlZj4gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUhhc0ZvY3VzOiBFdmVudDxib29sZWFuPjtcblx0cmVhZG9ubHkgb25Db250ZXh0TWVudTogRXZlbnQ8SVRyZWVDb250ZXh0TWVudUV2ZW50PFQ+PjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN0aWNreVNjcm9sbERlbGVnYXRlOiBJU3RpY2t5U2Nyb2xsRGVsZWdhdGU8VCwgVEZpbHRlckRhdGE+O1xuXG5cdHByaXZhdGUgc3RpY2t5U2Nyb2xsTWF4SXRlbUNvdW50OiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWF4V2lkZ2V0Vmlld1JhdGlvID0gMC40O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3dpZGdldDogU3RpY2t5U2Nyb2xsV2lkZ2V0PFQsIFRGaWx0ZXJEYXRhLCBUUmVmPjtcblxuXHRwcml2YXRlIHBhZGRpbmdUb3A6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRyZWU6IEFic3RyYWN0VHJlZTxULCBURmlsdGVyRGF0YSwgVFJlZj4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtb2RlbDogSVRyZWVNb2RlbDxULCBURmlsdGVyRGF0YSwgVFJlZj4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2aWV3OiBMaXN0PElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4+LFxuXHRcdHJlbmRlcmVyczogVHJlZVJlbmRlcmVyPFQsIFRGaWx0ZXJEYXRhLCBUUmVmLCBhbnk+W10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0cmVlRGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4+LFxuXHRcdG9wdGlvbnM6IElBYnN0cmFjdFRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiA9IHt9LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5U2Nyb2xsT3B0aW9ucyA9IHRoaXMudmFsaWRhdGVTdGlja3lTZXR0aW5ncyhvcHRpb25zKTtcblx0XHR0aGlzLnN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCA9IHN0aWNreVNjcm9sbE9wdGlvbnMuc3RpY2t5U2Nyb2xsTWF4SXRlbUNvdW50O1xuXG5cdFx0dGhpcy5zdGlja3lTY3JvbGxEZWxlZ2F0ZSA9IG9wdGlvbnMuc3RpY2t5U2Nyb2xsRGVsZWdhdGUgPz8gbmV3IERlZmF1bHRTdGlja3lTY3JvbGxEZWxlZ2F0ZSgpO1xuXHRcdHRoaXMucGFkZGluZ1RvcCA9IG9wdGlvbnMucGFkZGluZ1RvcCA/PyAwO1xuXG5cdFx0dGhpcy5fd2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IFN0aWNreVNjcm9sbFdpZGdldCh2aWV3LmdldFNjcm9sbGFibGVFbGVtZW50KCksIHZpZXcsIHRyZWUsIHJlbmRlcmVycywgdHJlZURlbGVnYXRlLCBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlcikpO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VIYXNGb2N1cyA9IHRoaXMuX3dpZGdldC5vbkRpZENoYW5nZUhhc0ZvY3VzO1xuXHRcdHRoaXMub25Db250ZXh0TWVudSA9IHRoaXMuX3dpZGdldC5vbkNvbnRleHRNZW51O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodmlldy5vbkRpZFNjcm9sbCgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodmlldy5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKCkgPT4gdGhpcy51cGRhdGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRyZWUub25EaWRDaGFuZ2VDb2xsYXBzZVN0YXRlKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihtb2RlbC5vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXMoKGUpID0+IHtcblx0XHRcdGNvbnN0IHN0YXRlID0gdGhpcy5fd2lkZ2V0LnN0YXRlO1xuXHRcdFx0aWYgKCFzdGF0ZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIGEgc3RpY2t5IG5vZGUgaXMgcmVtb3ZlZCwgcmVjb21wdXRlIHRoZSBzdGF0ZVxuXHRcdFx0Y29uc3QgaGFzUmVtb3ZlZFN0aWNreU5vZGUgPSBlLmRlbGV0ZUNvdW50ID4gMCAmJiBzdGF0ZS5zdGlja3lOb2Rlcy5zb21lKHN0aWNreU5vZGUgPT4gIXRoaXMubW9kZWwuaGFzKHRoaXMubW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKHN0aWNreU5vZGUubm9kZSkpKTtcblx0XHRcdGlmIChoYXNSZW1vdmVkU3RpY2t5Tm9kZSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIGEgc3RpY2t5IG5vZGUgaXMgdXBkYXRlZCwgcmVyZW5kZXIgdGhlIHdpZGdldFxuXHRcdFx0Y29uc3Qgc2hvdWxkUmVyZW5kZXJTdGlja3lOb2RlcyA9IHN0YXRlLnN0aWNreU5vZGVzLnNvbWUoc3RpY2t5Tm9kZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxpc3RJbmRleCA9IHRoaXMubW9kZWwuZ2V0TGlzdEluZGV4KHRoaXMubW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKHN0aWNreU5vZGUubm9kZSkpO1xuXHRcdFx0XHRyZXR1cm4gbGlzdEluZGV4ID49IGUuc3RhcnQgJiYgbGlzdEluZGV4IDwgZS5zdGFydCArIGUuZGVsZXRlQ291bnQgJiYgc3RhdGUuY29udGFpbnMoc3RpY2t5Tm9kZS5ub2RlKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoc2hvdWxkUmVyZW5kZXJTdGlja3lOb2Rlcykge1xuXHRcdFx0XHR0aGlzLl93aWRnZXQucmVyZW5kZXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IGhlaWdodCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl93aWRnZXQuaGVpZ2h0O1xuXHR9XG5cblx0Z2V0IGNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZGdldC5jb3VudDtcblx0fVxuXG5cdGdldE5vZGUobm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPik6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fd2lkZ2V0LmdldE5vZGUobm9kZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldE5vZGVBdEhlaWdodChoZWlnaHQ6IG51bWJlcik6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4gfCB1bmRlZmluZWQge1xuXHRcdGxldCBpbmRleDtcblx0XHRpZiAoaGVpZ2h0ID09PSAwKSB7XG5cdFx0XHRpbmRleCA9IHRoaXMudmlldy5maXJzdFZpc2libGVJbmRleDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aW5kZXggPSB0aGlzLnZpZXcuaW5kZXhBdChoZWlnaHQgKyB0aGlzLnZpZXcuc2Nyb2xsVG9wKTtcblx0XHR9XG5cblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMudmlldy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMudmlldy5lbGVtZW50KGluZGV4KTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlKCkge1xuXHRcdGNvbnN0IGZpcnN0VmlzaWJsZU5vZGUgPSB0aGlzLmdldE5vZGVBdEhlaWdodCh0aGlzLnBhZGRpbmdUb3ApO1xuXG5cdFx0Ly8gRG9uJ3QgcmVuZGVyIGFueXRoaW5nIGlmIHRoZXJlIGFyZSBubyBlbGVtZW50c1xuXHRcdGlmICghZmlyc3RWaXNpYmxlTm9kZSB8fCB0aGlzLnRyZWUuc2Nyb2xsVG9wIDw9IHRoaXMucGFkZGluZ1RvcCkge1xuXHRcdFx0dGhpcy5fd2lkZ2V0LnNldFN0YXRlKHVuZGVmaW5lZCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RpY2t5U3RhdGUgPSB0aGlzLmZpbmRTdGlja3lTdGF0ZShmaXJzdFZpc2libGVOb2RlKTtcblx0XHR0aGlzLl93aWRnZXQuc2V0U3RhdGUoc3RpY2t5U3RhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kU3RpY2t5U3RhdGUoZmlyc3RWaXNpYmxlTm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPik6IFN0aWNreVNjcm9sbFN0YXRlPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgc3RpY2t5Tm9kZXM6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+W10gPSBbXTtcblx0XHRsZXQgZmlyc3RWaXNpYmxlTm9kZVVuZGVyV2lkZ2V0OiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+IHwgdW5kZWZpbmVkID0gZmlyc3RWaXNpYmxlTm9kZTtcblx0XHRsZXQgc3RpY2t5Tm9kZXNIZWlnaHQgPSAwO1xuXG5cdFx0bGV0IG5leHRTdGlja3lOb2RlID0gdGhpcy5nZXROZXh0U3RpY2t5Tm9kZShmaXJzdFZpc2libGVOb2RlVW5kZXJXaWRnZXQsIHVuZGVmaW5lZCwgc3RpY2t5Tm9kZXNIZWlnaHQpO1xuXHRcdHdoaWxlIChuZXh0U3RpY2t5Tm9kZSkge1xuXG5cdFx0XHRzdGlja3lOb2Rlcy5wdXNoKG5leHRTdGlja3lOb2RlKTtcblx0XHRcdHN0aWNreU5vZGVzSGVpZ2h0ICs9IG5leHRTdGlja3lOb2RlLmhlaWdodDtcblxuXHRcdFx0aWYgKHN0aWNreU5vZGVzLmxlbmd0aCA8PSB0aGlzLnN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCkge1xuXHRcdFx0XHRmaXJzdFZpc2libGVOb2RlVW5kZXJXaWRnZXQgPSB0aGlzLmdldE5leHRWaXNpYmxlTm9kZShuZXh0U3RpY2t5Tm9kZSk7XG5cdFx0XHRcdGlmICghZmlyc3RWaXNpYmxlTm9kZVVuZGVyV2lkZ2V0KSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0bmV4dFN0aWNreU5vZGUgPSB0aGlzLmdldE5leHRTdGlja3lOb2RlKGZpcnN0VmlzaWJsZU5vZGVVbmRlcldpZGdldCwgbmV4dFN0aWNreU5vZGUubm9kZSwgc3RpY2t5Tm9kZXNIZWlnaHQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyYWluZWRTdGlja3lOb2RlcyA9IHRoaXMuY29uc3RyYWluU3RpY2t5Tm9kZXMoc3RpY2t5Tm9kZXMpO1xuXHRcdHJldHVybiBjb250cmFpbmVkU3RpY2t5Tm9kZXMubGVuZ3RoID8gbmV3IFN0aWNreVNjcm9sbFN0YXRlKGNvbnRyYWluZWRTdGlja3lOb2RlcykgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldE5leHRWaXNpYmxlTm9kZShwcmV2aW91c1N0aWNreU5vZGU6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+KTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Tm9kZUF0SGVpZ2h0KHByZXZpb3VzU3RpY2t5Tm9kZS5wb3NpdGlvbiArIHByZXZpb3VzU3RpY2t5Tm9kZS5oZWlnaHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXROZXh0U3RpY2t5Tm9kZShmaXJzdFZpc2libGVOb2RlVW5kZXJXaWRnZXQ6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIHByZXZpb3VzU3RpY2t5Tm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZCwgc3RpY2t5Tm9kZXNIZWlnaHQ6IG51bWJlcik6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBuZXh0U3RpY2t5Tm9kZSA9IHRoaXMuZ2V0QW5jZXN0b3JVbmRlclByZXZpb3VzKGZpcnN0VmlzaWJsZU5vZGVVbmRlcldpZGdldCwgcHJldmlvdXNTdGlja3lOb2RlKTtcblx0XHRpZiAoIW5leHRTdGlja3lOb2RlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmIChuZXh0U3RpY2t5Tm9kZSA9PT0gZmlyc3RWaXNpYmxlTm9kZVVuZGVyV2lkZ2V0KSB7XG5cdFx0XHRpZiAoIXRoaXMubm9kZUlzVW5jb2xsYXBzZWRQYXJlbnQoZmlyc3RWaXNpYmxlTm9kZVVuZGVyV2lkZ2V0KSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5ub2RlVG9wQWxpZ25zV2l0aFN0aWNreU5vZGVzQm90dG9tKGZpcnN0VmlzaWJsZU5vZGVVbmRlcldpZGdldCwgc3RpY2t5Tm9kZXNIZWlnaHQpKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuY3JlYXRlU3RpY2t5U2Nyb2xsTm9kZShuZXh0U3RpY2t5Tm9kZSwgc3RpY2t5Tm9kZXNIZWlnaHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBub2RlVG9wQWxpZ25zV2l0aFN0aWNreU5vZGVzQm90dG9tKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIHN0aWNreU5vZGVzSGVpZ2h0OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRjb25zdCBub2RlSW5kZXggPSB0aGlzLmdldE5vZGVJbmRleChub2RlKTtcblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy52aWV3LmdldEVsZW1lbnRUb3Aobm9kZUluZGV4KTtcblx0XHRjb25zdCBzdGlja3lQb3NpdGlvbiA9IHN0aWNreU5vZGVzSGVpZ2h0O1xuXHRcdHJldHVybiB0aGlzLnZpZXcuc2Nyb2xsVG9wID09PSBlbGVtZW50VG9wIC0gc3RpY2t5UG9zaXRpb247XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVN0aWNreVNjcm9sbE5vZGUobm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiwgY3VycmVudFN0aWNreU5vZGVzSGVpZ2h0OiBudW1iZXIpOiBTdGlja3lTY3JvbGxOb2RlPFQsIFRGaWx0ZXJEYXRhPiB7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gdGhpcy50cmVlRGVsZWdhdGUuZ2V0SGVpZ2h0KG5vZGUpO1xuXHRcdGNvbnN0IHsgc3RhcnRJbmRleCwgZW5kSW5kZXggfSA9IHRoaXMuZ2V0Tm9kZVJhbmdlKG5vZGUpO1xuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLmNhbGN1bGF0ZVN0aWNreU5vZGVQb3NpdGlvbihlbmRJbmRleCwgY3VycmVudFN0aWNreU5vZGVzSGVpZ2h0LCBoZWlnaHQpO1xuXG5cdFx0cmV0dXJuIHsgbm9kZSwgcG9zaXRpb24sIGhlaWdodCwgc3RhcnRJbmRleCwgZW5kSW5kZXggfTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QW5jZXN0b3JVbmRlclByZXZpb3VzKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4sIHByZXZpb3VzQW5jZXN0b3I6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQpOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+IHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgY3VycmVudEFuY2VzdG9yOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+ID0gbm9kZTtcblx0XHRsZXQgcGFyZW50T2ZjdXJyZW50QW5jZXN0b3I6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4gfCB1bmRlZmluZWQgPSB0aGlzLmdldFBhcmVudE5vZGUoY3VycmVudEFuY2VzdG9yKTtcblxuXHRcdHdoaWxlIChwYXJlbnRPZmN1cnJlbnRBbmNlc3Rvcikge1xuXHRcdFx0aWYgKHBhcmVudE9mY3VycmVudEFuY2VzdG9yID09PSBwcmV2aW91c0FuY2VzdG9yKSB7XG5cdFx0XHRcdHJldHVybiBjdXJyZW50QW5jZXN0b3I7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50QW5jZXN0b3IgPSBwYXJlbnRPZmN1cnJlbnRBbmNlc3Rvcjtcblx0XHRcdHBhcmVudE9mY3VycmVudEFuY2VzdG9yID0gdGhpcy5nZXRQYXJlbnROb2RlKGN1cnJlbnRBbmNlc3Rvcik7XG5cdFx0fVxuXG5cdFx0aWYgKHByZXZpb3VzQW5jZXN0b3IgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGN1cnJlbnRBbmNlc3Rvcjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBjYWxjdWxhdGVTdGlja3lOb2RlUG9zaXRpb24obGFzdERlc2NlbmRhbnRJbmRleDogbnVtYmVyLCBzdGlja3lSb3dQb3NpdGlvblRvcDogbnVtYmVyLCBzdGlja3lOb2RlSGVpZ2h0OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGxldCBsYXN0Q2hpbGRSZWxhdGl2ZVRvcCA9IHRoaXMudmlldy5nZXRSZWxhdGl2ZVRvcChsYXN0RGVzY2VuZGFudEluZGV4KTtcblxuXHRcdC8vIElmIHRoZSBsYXN0IGRlc2NlbmRhbnQgaXMgb25seSBwYXJ0aWFsbHkgdmlzaWJsZSBhdCB0aGUgdG9wIG9mIHRoZSB2aWV3LCBnZXRSZWxhdGl2ZVRvcCgpIHJldHVybnMgbnVsbFxuXHRcdC8vIEluIHRoYXQgY2FzZSwgdXRpbGl6ZSB0aGUgbmV4dCBub2RlJ3MgcmVsYXRpdmUgdG9wIHRvIGNhbGN1bGF0ZSB0aGUgc3RpY2t5IG5vZGUncyBwb3NpdGlvblxuXHRcdGlmIChsYXN0Q2hpbGRSZWxhdGl2ZVRvcCA9PT0gbnVsbCAmJiB0aGlzLnZpZXcuZmlyc3RWaXNpYmxlSW5kZXggPT09IGxhc3REZXNjZW5kYW50SW5kZXggJiYgbGFzdERlc2NlbmRhbnRJbmRleCArIDEgPCB0aGlzLnZpZXcubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBub2RlSGVpZ2h0ID0gdGhpcy50cmVlRGVsZWdhdGUuZ2V0SGVpZ2h0KHRoaXMudmlldy5lbGVtZW50KGxhc3REZXNjZW5kYW50SW5kZXgpKTtcblx0XHRcdGNvbnN0IG5leHROb2RlUmVsYXRpdmVUb3AgPSB0aGlzLnZpZXcuZ2V0UmVsYXRpdmVUb3AobGFzdERlc2NlbmRhbnRJbmRleCArIDEpO1xuXHRcdFx0bGFzdENoaWxkUmVsYXRpdmVUb3AgPSBuZXh0Tm9kZVJlbGF0aXZlVG9wID8gbmV4dE5vZGVSZWxhdGl2ZVRvcCAtIG5vZGVIZWlnaHQgLyB0aGlzLnZpZXcucmVuZGVySGVpZ2h0IDogbnVsbDtcblx0XHR9XG5cblx0XHRpZiAobGFzdENoaWxkUmVsYXRpdmVUb3AgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBzdGlja3lSb3dQb3NpdGlvblRvcDtcblx0XHR9XG5cblx0XHRjb25zdCBsYXN0Q2hpbGROb2RlID0gdGhpcy52aWV3LmVsZW1lbnQobGFzdERlc2NlbmRhbnRJbmRleCk7XG5cdFx0Y29uc3QgbGFzdENoaWxkSGVpZ2h0ID0gdGhpcy50cmVlRGVsZWdhdGUuZ2V0SGVpZ2h0KGxhc3RDaGlsZE5vZGUpO1xuXHRcdGNvbnN0IHRvcE9mTGFzdENoaWxkID0gbGFzdENoaWxkUmVsYXRpdmVUb3AgKiB0aGlzLnZpZXcucmVuZGVySGVpZ2h0O1xuXHRcdGNvbnN0IGJvdHRvbU9mTGFzdENoaWxkID0gdG9wT2ZMYXN0Q2hpbGQgKyBsYXN0Q2hpbGRIZWlnaHQ7XG5cblx0XHRpZiAoc3RpY2t5Um93UG9zaXRpb25Ub3AgKyBzdGlja3lOb2RlSGVpZ2h0ID4gYm90dG9tT2ZMYXN0Q2hpbGQgJiYgc3RpY2t5Um93UG9zaXRpb25Ub3AgPD0gYm90dG9tT2ZMYXN0Q2hpbGQpIHtcblx0XHRcdHJldHVybiBib3R0b21PZkxhc3RDaGlsZCAtIHN0aWNreU5vZGVIZWlnaHQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0aWNreVJvd1Bvc2l0aW9uVG9wO1xuXHR9XG5cblx0cHJpdmF0ZSBjb25zdHJhaW5TdGlja3lOb2RlcyhzdGlja3lOb2RlczogU3RpY2t5U2Nyb2xsTm9kZTxULCBURmlsdGVyRGF0YT5bXSk6IFN0aWNreVNjcm9sbE5vZGU8VCwgVEZpbHRlckRhdGE+W10ge1xuXHRcdGlmIChzdGlja3lOb2Rlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBpZiBzdGlja3kgbm9kZXMgbmVlZCB0byBiZSBjb25zdHJhaW5lZFxuXHRcdGNvbnN0IG1heGltdW1TdGlja3lXaWRnZXRIZWlnaHQgPSB0aGlzLnZpZXcucmVuZGVySGVpZ2h0ICogdGhpcy5tYXhXaWRnZXRWaWV3UmF0aW87XG5cdFx0Y29uc3QgbGFzdFN0aWNreU5vZGUgPSBzdGlja3lOb2Rlc1tzdGlja3lOb2Rlcy5sZW5ndGggLSAxXTtcblx0XHRpZiAoc3RpY2t5Tm9kZXMubGVuZ3RoIDw9IHRoaXMuc3RpY2t5U2Nyb2xsTWF4SXRlbUNvdW50ICYmIGxhc3RTdGlja3lOb2RlLnBvc2l0aW9uICsgbGFzdFN0aWNreU5vZGUuaGVpZ2h0IDw9IG1heGltdW1TdGlja3lXaWRnZXRIZWlnaHQpIHtcblx0XHRcdHJldHVybiBzdGlja3lOb2Rlcztcblx0XHR9XG5cblx0XHQvLyBjb25zdHJhaW4gc3RpY2t5IG5vZGVzXG5cdFx0Y29uc3QgY29uc3RyYWluZWRTdGlja3lOb2RlcyA9IHRoaXMuc3RpY2t5U2Nyb2xsRGVsZWdhdGUuY29uc3RyYWluU3RpY2t5U2Nyb2xsTm9kZXMoc3RpY2t5Tm9kZXMsIHRoaXMuc3RpY2t5U2Nyb2xsTWF4SXRlbUNvdW50LCBtYXhpbXVtU3RpY2t5V2lkZ2V0SGVpZ2h0KTtcblxuXHRcdGlmICghY29uc3RyYWluZWRTdGlja3lOb2Rlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHQvLyBWYWxpZGF0ZSBjb25zdHJhaW50c1xuXHRcdGNvbnN0IGxhc3RDb25zdHJhaW5lZFN0aWNreU5vZGUgPSBjb25zdHJhaW5lZFN0aWNreU5vZGVzW2NvbnN0cmFpbmVkU3RpY2t5Tm9kZXMubGVuZ3RoIC0gMV07XG5cdFx0aWYgKGNvbnN0cmFpbmVkU3RpY2t5Tm9kZXMubGVuZ3RoID4gdGhpcy5zdGlja3lTY3JvbGxNYXhJdGVtQ291bnQgfHwgbGFzdENvbnN0cmFpbmVkU3RpY2t5Tm9kZS5wb3NpdGlvbiArIGxhc3RDb25zdHJhaW5lZFN0aWNreU5vZGUuaGVpZ2h0ID4gbWF4aW11bVN0aWNreVdpZGdldEhlaWdodCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdzdGlja3lTY3JvbGxEZWxlZ2F0ZSB2aW9sYXRlcyBjb25zdHJhaW50cycpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb25zdHJhaW5lZFN0aWNreU5vZGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQYXJlbnROb2RlKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBub2RlTG9jYXRpb24gPSB0aGlzLm1vZGVsLmdldE5vZGVMb2NhdGlvbihub2RlKTtcblx0XHRjb25zdCBwYXJlbnRMb2NhdGlvbiA9IHRoaXMubW9kZWwuZ2V0UGFyZW50Tm9kZUxvY2F0aW9uKG5vZGVMb2NhdGlvbik7XG5cdFx0cmV0dXJuIHBhcmVudExvY2F0aW9uID8gdGhpcy5tb2RlbC5nZXROb2RlKHBhcmVudExvY2F0aW9uKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgbm9kZUlzVW5jb2xsYXBzZWRQYXJlbnQobm9kZTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG5vZGVMb2NhdGlvbiA9IHRoaXMubW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKG5vZGUpO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldExpc3RSZW5kZXJDb3VudChub2RlTG9jYXRpb24pID4gMTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Tm9kZUluZGV4KG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pOiBudW1iZXIge1xuXHRcdGNvbnN0IG5vZGVMb2NhdGlvbiA9IHRoaXMubW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKG5vZGUpO1xuXHRcdGNvbnN0IG5vZGVJbmRleCA9IHRoaXMubW9kZWwuZ2V0TGlzdEluZGV4KG5vZGVMb2NhdGlvbik7XG5cdFx0cmV0dXJuIG5vZGVJbmRleDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Tm9kZVJhbmdlKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pOiB7IHN0YXJ0SW5kZXg6IG51bWJlcjsgZW5kSW5kZXg6IG51bWJlciB9IHtcblx0XHRjb25zdCBub2RlTG9jYXRpb24gPSB0aGlzLm1vZGVsLmdldE5vZGVMb2NhdGlvbihub2RlKTtcblx0XHRjb25zdCBzdGFydEluZGV4ID0gdGhpcy5tb2RlbC5nZXRMaXN0SW5kZXgobm9kZUxvY2F0aW9uKTtcblxuXHRcdGlmIChzdGFydEluZGV4IDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb2RlIG5vdCBmb3VuZCBpbiB0cmVlJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVuZGVyQ291bnQgPSB0aGlzLm1vZGVsLmdldExpc3RSZW5kZXJDb3VudChub2RlTG9jYXRpb24pO1xuXHRcdGNvbnN0IGVuZEluZGV4ID0gc3RhcnRJbmRleCArIHJlbmRlckNvdW50IC0gMTtcblxuXHRcdHJldHVybiB7IHN0YXJ0SW5kZXgsIGVuZEluZGV4IH07XG5cdH1cblxuXHRub2RlUG9zaXRpb25Ub3BCZWxvd1dpZGdldChub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KTogbnVtYmVyIHtcblx0XHRjb25zdCBhbmNlc3RvcnMgPSBbXTtcblx0XHRsZXQgY3VycmVudEFuY2VzdG9yID0gdGhpcy5nZXRQYXJlbnROb2RlKG5vZGUpO1xuXHRcdHdoaWxlIChjdXJyZW50QW5jZXN0b3IpIHtcblx0XHRcdGFuY2VzdG9ycy5wdXNoKGN1cnJlbnRBbmNlc3Rvcik7XG5cdFx0XHRjdXJyZW50QW5jZXN0b3IgPSB0aGlzLmdldFBhcmVudE5vZGUoY3VycmVudEFuY2VzdG9yKTtcblx0XHR9XG5cblx0XHRsZXQgd2lkZ2V0SGVpZ2h0ID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGFuY2VzdG9ycy5sZW5ndGggJiYgaSA8IHRoaXMuc3RpY2t5U2Nyb2xsTWF4SXRlbUNvdW50OyBpKyspIHtcblx0XHRcdHdpZGdldEhlaWdodCArPSB0aGlzLnRyZWVEZWxlZ2F0ZS5nZXRIZWlnaHQoYW5jZXN0b3JzW2ldKTtcblx0XHR9XG5cdFx0cmV0dXJuIHdpZGdldEhlaWdodDtcblx0fVxuXG5cdGdldEZvY3VzKCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl93aWRnZXQuZ2V0Rm9jdXMoKTtcblx0fVxuXG5cdGRvbUZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3dpZGdldC5kb21Gb2N1cygpO1xuXHR9XG5cblx0Ly8gV2hldGhlciBzdGlja3kgc2Nyb2xsIHdhcyB0aGUgbGFzdCBmb2N1c2VkIHBhcnQgaW4gdGhlIHRyZWUgb3Igbm90XG5cdGZvY3VzZWRMYXN0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl93aWRnZXQuZm9jdXNlZExhc3QoKTtcblx0fVxuXG5cdHVwZGF0ZU9wdGlvbnMob3B0aW9uc1VwZGF0ZTogSUFic3RyYWN0VHJlZU9wdGlvbnNVcGRhdGUgPSB7fSk6IHZvaWQge1xuXHRcdGlmIChvcHRpb25zVXBkYXRlLnBhZGRpbmdUb3AgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5wYWRkaW5nVG9wID0gb3B0aW9uc1VwZGF0ZS5wYWRkaW5nVG9wO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zVXBkYXRlLnN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCB2YWxpZGF0ZWRPcHRpb25zID0gdGhpcy52YWxpZGF0ZVN0aWNreVNldHRpbmdzKG9wdGlvbnNVcGRhdGUpO1xuXHRcdFx0aWYgKHRoaXMuc3RpY2t5U2Nyb2xsTWF4SXRlbUNvdW50ICE9PSB2YWxpZGF0ZWRPcHRpb25zLnN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCkge1xuXHRcdFx0XHR0aGlzLnN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCA9IHZhbGlkYXRlZE9wdGlvbnMuc3RpY2t5U2Nyb2xsTWF4SXRlbUNvdW50O1xuXHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHZhbGlkYXRlU3RpY2t5U2V0dGluZ3Mob3B0aW9uczogSUFic3RyYWN0VHJlZU9wdGlvbnNVcGRhdGUpOiB7IHN0aWNreVNjcm9sbE1heEl0ZW1Db3VudDogbnVtYmVyIH0ge1xuXHRcdGxldCBzdGlja3lTY3JvbGxNYXhJdGVtQ291bnQgPSA3O1xuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucy5zdGlja3lTY3JvbGxNYXhJdGVtQ291bnQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRzdGlja3lTY3JvbGxNYXhJdGVtQ291bnQgPSBNYXRoLm1heChvcHRpb25zLnN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCwgMSk7XG5cdFx0fVxuXHRcdHJldHVybiB7IHN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCB9O1xuXHR9XG59XG5cbmNsYXNzIFN0aWNreVNjcm9sbFdpZGdldDxULCBURmlsdGVyRGF0YSwgVFJlZj4gaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcm9vdERvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9wcmV2aW91c1N0YXRlOiBTdGlja3lTY3JvbGxTdGF0ZTxULCBURmlsdGVyRGF0YSwgVFJlZj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3ByZXZpb3VzRWxlbWVudHM6IEhUTUxFbGVtZW50W10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJldmlvdXNTdGF0ZURpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGdldCBzdGF0ZSgpOiBTdGlja3lTY3JvbGxTdGF0ZTxULCBURmlsdGVyRGF0YSwgVFJlZj4gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fcHJldmlvdXNTdGF0ZTsgfVxuXG5cdHByaXZhdGUgc3RpY2t5U2Nyb2xsRm9jdXM6IFN0aWNreVNjcm9sbEZvY3VzPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VIYXNGb2N1czogRXZlbnQ8Ym9vbGVhbj47XG5cdHJlYWRvbmx5IG9uQ29udGV4dE1lbnU6IEV2ZW50PElUcmVlQ29udGV4dE1lbnVFdmVudDxUPj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHZpZXc6IExpc3Q8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0cmVlOiBBYnN0cmFjdFRyZWU8VCwgVEZpbHRlckRhdGEsIFRSZWY+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdHJlZVJlbmRlcmVyczogVHJlZVJlbmRlcmVyPFQsIFRGaWx0ZXJEYXRhLCBUUmVmLCBhbnk+W10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0cmVlRGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlcjxUPiB8IHVuZGVmaW5lZCxcblx0KSB7XG5cblx0XHR0aGlzLl9yb290RG9tTm9kZSA9ICQoJy5tb25hY28tdHJlZS1zdGlja3ktY29udGFpbmVyLmVtcHR5Jyk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3REb21Ob2RlKTtcblxuXHRcdGNvbnN0IHNoYWRvdyA9ICQoJy5tb25hY28tdHJlZS1zdGlja3ktY29udGFpbmVyLXNoYWRvdycpO1xuXHRcdHRoaXMuX3Jvb3REb21Ob2RlLmFwcGVuZENoaWxkKHNoYWRvdyk7XG5cblx0XHR0aGlzLnN0aWNreVNjcm9sbEZvY3VzID0gbmV3IFN0aWNreVNjcm9sbEZvY3VzKHRoaXMuX3Jvb3REb21Ob2RlLCB2aWV3KTtcblx0XHR0aGlzLm9uRGlkQ2hhbmdlSGFzRm9jdXMgPSB0aGlzLnN0aWNreVNjcm9sbEZvY3VzLm9uRGlkQ2hhbmdlSGFzRm9jdXM7XG5cdFx0dGhpcy5vbkNvbnRleHRNZW51ID0gdGhpcy5zdGlja3lTY3JvbGxGb2N1cy5vbkNvbnRleHRNZW51O1xuXHR9XG5cblx0Z2V0IGhlaWdodCgpOiBudW1iZXIge1xuXHRcdGlmICghdGhpcy5fcHJldmlvdXNTdGF0ZSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdGNvbnN0IGxhc3RFbGVtZW50ID0gdGhpcy5fcHJldmlvdXNTdGF0ZS5zdGlja3lOb2Rlc1t0aGlzLl9wcmV2aW91c1N0YXRlLmNvdW50IC0gMV07XG5cdFx0cmV0dXJuIGxhc3RFbGVtZW50LnBvc2l0aW9uICsgbGFzdEVsZW1lbnQuaGVpZ2h0O1xuXHR9XG5cblx0Z2V0IGNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3ByZXZpb3VzU3RhdGU/LmNvdW50ID8/IDA7XG5cdH1cblxuXHRnZXROb2RlKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pOiBTdGlja3lTY3JvbGxOb2RlPFQsIFRGaWx0ZXJEYXRhPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3ByZXZpb3VzU3RhdGU/LnN0aWNreU5vZGVzLmZpbmQoc3RpY2t5Tm9kZSA9PiBzdGlja3lOb2RlLm5vZGUgPT09IG5vZGUpO1xuXHR9XG5cblx0c2V0U3RhdGUoc3RhdGU6IFN0aWNreVNjcm9sbFN0YXRlPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXG5cdFx0Y29uc3Qgd2FzVmlzaWJsZSA9ICEhdGhpcy5fcHJldmlvdXNTdGF0ZSAmJiB0aGlzLl9wcmV2aW91c1N0YXRlLmNvdW50ID4gMDtcblx0XHRjb25zdCBpc1Zpc2libGUgPSAhIXN0YXRlICYmIHN0YXRlLmNvdW50ID4gMDtcblxuXHRcdC8vIElmIHN0YXRlIGhhcyBub3QgY2hhbmdlZCwgZG8gbm90aGluZ1xuXHRcdGlmICgoIXdhc1Zpc2libGUgJiYgIWlzVmlzaWJsZSkgfHwgKHdhc1Zpc2libGUgJiYgaXNWaXNpYmxlICYmIHRoaXMuX3ByZXZpb3VzU3RhdGUhLmVxdWFsKHN0YXRlKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgdmlzaWJpbGl0eSBvZiB0aGUgd2lkZ2V0IGlmIGNoYW5nZWRcblx0XHRpZiAod2FzVmlzaWJsZSAhPT0gaXNWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLnNldFZpc2libGUoaXNWaXNpYmxlKTtcblx0XHR9XG5cblx0XHRpZiAoIWlzVmlzaWJsZSkge1xuXHRcdFx0dGhpcy5fcHJldmlvdXNTdGF0ZSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3ByZXZpb3VzRWxlbWVudHMgPSBbXTtcblx0XHRcdHRoaXMuX3ByZXZpb3VzU3RhdGVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhc3RTdGlja3lOb2RlID0gc3RhdGUuc3RpY2t5Tm9kZXNbc3RhdGUuY291bnQgLSAxXTtcblxuXHRcdC8vIElmIHRoZSBuZXcgc3RhdGUgaXMgb25seSBhIGNoYW5nZSBpbiB0aGUgbGFzdCBub2RlJ3MgcG9zaXRpb24sIHVwZGF0ZSB0aGUgcG9zaXRpb24gb2YgdGhlIGxhc3QgZWxlbWVudFxuXHRcdGlmICh0aGlzLl9wcmV2aW91c1N0YXRlICYmIHN0YXRlLmFuaW1hdGlvblN0YXRlQ2hhbmdlZCh0aGlzLl9wcmV2aW91c1N0YXRlKSkge1xuXHRcdFx0dGhpcy5fcHJldmlvdXNFbGVtZW50c1t0aGlzLl9wcmV2aW91c1N0YXRlLmNvdW50IC0gMV0uc3R5bGUudG9wID0gYCR7bGFzdFN0aWNreU5vZGUucG9zaXRpb259cHhgO1xuXHRcdH1cblx0XHQvLyBjcmVhdGUgbmV3IGRvbSBlbGVtZW50c1xuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5yZW5kZXJTdGF0ZShzdGF0ZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHJldmlvdXNTdGF0ZSA9IHN0YXRlO1xuXG5cdFx0Ly8gU2V0IHRoZSBoZWlnaHQgb2YgdGhlIHdpZGdldCB0byB0aGUgYm90dG9tIG9mIHRoZSBsYXN0IHN0aWNreSBub2RlXG5cdFx0dGhpcy5fcm9vdERvbU5vZGUuc3R5bGUuaGVpZ2h0ID0gYCR7bGFzdFN0aWNreU5vZGUucG9zaXRpb24gKyBsYXN0U3RpY2t5Tm9kZS5oZWlnaHR9cHhgO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJTdGF0ZShzdGF0ZTogU3RpY2t5U2Nyb2xsU3RhdGU8VCwgVEZpbHRlckRhdGEsIFRSZWY+KTogdm9pZCB7XG5cdFx0dGhpcy5fcHJldmlvdXNTdGF0ZURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRjb25zdCBlbGVtZW50cyA9IEFycmF5KHN0YXRlLmNvdW50KTtcblx0XHRmb3IgKGxldCBzdGlja3lJbmRleCA9IHN0YXRlLmNvdW50IC0gMTsgc3RpY2t5SW5kZXggPj0gMDsgc3RpY2t5SW5kZXgtLSkge1xuXHRcdFx0Y29uc3Qgc3RpY2t5Tm9kZSA9IHN0YXRlLnN0aWNreU5vZGVzW3N0aWNreUluZGV4XTtcblxuXHRcdFx0Y29uc3QgeyBlbGVtZW50LCBkaXNwb3NhYmxlIH0gPSB0aGlzLmNyZWF0ZUVsZW1lbnQoc3RpY2t5Tm9kZSwgc3RpY2t5SW5kZXgsIHN0YXRlLmNvdW50KTtcblx0XHRcdGVsZW1lbnRzW3N0aWNreUluZGV4XSA9IGVsZW1lbnQ7XG5cblx0XHRcdHRoaXMuX3Jvb3REb21Ob2RlLmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuXHRcdFx0dGhpcy5fcHJldmlvdXNTdGF0ZURpc3Bvc2FibGVzLmFkZChkaXNwb3NhYmxlKTtcblx0XHR9XG5cblx0XHR0aGlzLnN0aWNreVNjcm9sbEZvY3VzLnVwZGF0ZUVsZW1lbnRzKGVsZW1lbnRzLCBzdGF0ZSk7XG5cblx0XHR0aGlzLl9wcmV2aW91c0VsZW1lbnRzID0gZWxlbWVudHM7XG5cdH1cblxuXHRyZXJlbmRlcigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcHJldmlvdXNTdGF0ZSkge1xuXHRcdFx0dGhpcy5yZW5kZXJTdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUVsZW1lbnQoc3RpY2t5Tm9kZTogU3RpY2t5U2Nyb2xsTm9kZTxULCBURmlsdGVyRGF0YT4sIHN0aWNreUluZGV4OiBudW1iZXIsIHN0aWNreU5vZGVzVG90YWw6IG51bWJlcik6IHsgZWxlbWVudDogSFRNTEVsZW1lbnQ7IGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlIH0ge1xuXG5cdFx0Y29uc3Qgbm9kZUluZGV4ID0gc3RpY2t5Tm9kZS5zdGFydEluZGV4O1xuXG5cdFx0Ly8gU3RpY2t5IGVsZW1lbnQgY29udGFpbmVyXG5cdFx0Y29uc3Qgc3RpY2t5RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHN0aWNreUVsZW1lbnQuc3R5bGUudG9wID0gYCR7c3RpY2t5Tm9kZS5wb3NpdGlvbn1weGA7XG5cblx0XHRpZiAodGhpcy50cmVlLm9wdGlvbnMuc2V0Um93SGVpZ2h0ICE9PSBmYWxzZSkge1xuXHRcdFx0c3RpY2t5RWxlbWVudC5zdHlsZS5oZWlnaHQgPSBgJHtzdGlja3lOb2RlLmhlaWdodH1weGA7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudHJlZS5vcHRpb25zLnNldFJvd0xpbmVIZWlnaHQgIT09IGZhbHNlKSB7XG5cdFx0XHRzdGlja3lFbGVtZW50LnN0eWxlLmxpbmVIZWlnaHQgPSBgJHtzdGlja3lOb2RlLmhlaWdodH1weGA7XG5cdFx0fVxuXG5cdFx0c3RpY2t5RWxlbWVudC5jbGFzc0xpc3QuYWRkKCdtb25hY28tdHJlZS1zdGlja3ktcm93Jyk7XG5cdFx0c3RpY2t5RWxlbWVudC5jbGFzc0xpc3QuYWRkKCdtb25hY28tbGlzdC1yb3cnKTtcblxuXHRcdHN0aWNreUVsZW1lbnQuc2V0QXR0cmlidXRlKCdkYXRhLWluZGV4JywgYCR7bm9kZUluZGV4fWApO1xuXHRcdHN0aWNreUVsZW1lbnQuc2V0QXR0cmlidXRlKCdkYXRhLXBhcml0eScsIG5vZGVJbmRleCAlIDIgPT09IDAgPyAnZXZlbicgOiAnb2RkJyk7XG5cdFx0c3RpY2t5RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2lkJywgdGhpcy52aWV3LmdldEVsZW1lbnRJRChub2RlSW5kZXgpKTtcblx0XHRjb25zdCBhY2Nlc3NpYmlsaXR5RGlzcG9zYWJsZSA9IHRoaXMuc2V0QWNjZXNzaWJpbGl0eUF0dHJpYnV0ZXMoc3RpY2t5RWxlbWVudCwgc3RpY2t5Tm9kZS5ub2RlLmVsZW1lbnQsIHN0aWNreUluZGV4LCBzdGlja3lOb2Rlc1RvdGFsKTtcblxuXHRcdC8vIEdldCB0aGUgcmVuZGVyZXIgZm9yIHRoZSBub2RlXG5cdFx0Y29uc3Qgbm9kZVRlbXBsYXRlSWQgPSB0aGlzLnRyZWVEZWxlZ2F0ZS5nZXRUZW1wbGF0ZUlkKHN0aWNreU5vZGUubm9kZSk7XG5cdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLnRyZWVSZW5kZXJlcnMuZmluZCgocmVuZGVyZXIpID0+IHJlbmRlcmVyLnRlbXBsYXRlSWQgPT09IG5vZGVUZW1wbGF0ZUlkKTtcblx0XHRpZiAoIXJlbmRlcmVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vIHJlbmRlcmVyIGZvdW5kIGZvciB0ZW1wbGF0ZSBpZCAke25vZGVUZW1wbGF0ZUlkfWApO1xuXHRcdH1cblxuXHRcdC8vIFRvIG1ha2Ugc3VyZSB3ZSBkbyBub3QgaW5mbHVlbmNlIHRoZSBvcmlnaW5hbCBub2RlLCB3ZSBjcmVhdGUgYSBjb3B5IG9mIHRoZSBub2RlXG5cdFx0Ly8gV2UgbmVlZCB0byBjaGVjayBpZiBpdCBpcyBhbHJlYWR5IGEgdW5pcXVlIGluc3RhbmNlIG9mIHRoZSBub2RlIGJ5IHRoZSBkZWxlZ2F0ZVxuXHRcdGxldCBub2RlQ29weSA9IHN0aWNreU5vZGUubm9kZTtcblx0XHRpZiAobm9kZUNvcHkgPT09IHRoaXMudHJlZS5nZXROb2RlKHRoaXMudHJlZS5nZXROb2RlTG9jYXRpb24oc3RpY2t5Tm9kZS5ub2RlKSkpIHtcblx0XHRcdG5vZGVDb3B5ID0gbmV3IFByb3h5KHN0aWNreU5vZGUubm9kZSwge30pO1xuXHRcdH1cblxuXHRcdC8vIFJlbmRlciB0aGUgZWxlbWVudFxuXHRcdGNvbnN0IHRlbXBsYXRlRGF0YSA9IHJlbmRlcmVyLnJlbmRlclRlbXBsYXRlKHN0aWNreUVsZW1lbnQpO1xuXHRcdHJlbmRlcmVyLnJlbmRlckVsZW1lbnQobm9kZUNvcHksIHN0aWNreU5vZGUuc3RhcnRJbmRleCwgdGVtcGxhdGVEYXRhLCBzdGlja3lOb2RlLmhlaWdodCk7XG5cblx0XHQvLyBSZW1vdmUgdGhlIGVsZW1lbnQgZnJvbSB0aGUgRE9NIHdoZW4gc3RhdGUgaXMgZGlzcG9zZWRcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGFjY2Vzc2liaWxpdHlEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHJlbmRlcmVyLmRpc3Bvc2VFbGVtZW50KG5vZGVDb3B5LCBzdGlja3lOb2RlLnN0YXJ0SW5kZXgsIHRlbXBsYXRlRGF0YSwgc3RpY2t5Tm9kZS5oZWlnaHQpO1xuXHRcdFx0cmVuZGVyZXIuZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YSk7XG5cdFx0XHRzdGlja3lFbGVtZW50LnJlbW92ZSgpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHsgZWxlbWVudDogc3RpY2t5RWxlbWVudCwgZGlzcG9zYWJsZSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRBY2Nlc3NpYmlsaXR5QXR0cmlidXRlcyhjb250YWluZXI6IEhUTUxFbGVtZW50LCBlbGVtZW50OiBULCBzdGlja3lJbmRleDogbnVtYmVyLCBzdGlja3lOb2Rlc1RvdGFsOiBudW1iZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKCF0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlcikge1xuXHRcdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0U2V0U2l6ZSkge1xuXHRcdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1zZXRzaXplJywgU3RyaW5nKHRoaXMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyLmdldFNldFNpemUoZWxlbWVudCwgc3RpY2t5SW5kZXgsIHN0aWNreU5vZGVzVG90YWwpKSk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRQb3NJblNldCkge1xuXHRcdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1wb3NpbnNldCcsIFN0cmluZyh0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRQb3NJblNldChlbGVtZW50LCBzdGlja3lJbmRleCkpKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyLmdldFJvbGUpIHtcblx0XHRcdGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCB0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRSb2xlKGVsZW1lbnQpID8/ICd0cmVlaXRlbScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFyaWFMYWJlbCA9IHRoaXMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyLmdldEFyaWFMYWJlbChlbGVtZW50KTtcblx0XHRjb25zdCBvYnNlcnZhYmxlID0gKGFyaWFMYWJlbCAmJiB0eXBlb2YgYXJpYUxhYmVsICE9PSAnc3RyaW5nJykgPyBhcmlhTGFiZWwgOiBjb25zdE9ic2VydmFibGUoYXJpYUxhYmVsKTtcblx0XHRjb25zdCByZXN1bHQgPSBhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRlci5yZWFkT2JzZXJ2YWJsZShvYnNlcnZhYmxlKTtcblxuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCB2YWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250YWluZXIucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWxhYmVsJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAodHlwZW9mIGFyaWFMYWJlbCA9PT0gJ3N0cmluZycpIHtcblx0XHR9IGVsc2UgaWYgKGFyaWFMYWJlbCkge1xuXHRcdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGFyaWFMYWJlbC5nZXQoKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXJpYUxldmVsID0gdGhpcy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0QXJpYUxldmVsICYmIHRoaXMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyLmdldEFyaWFMZXZlbChlbGVtZW50KTtcblx0XHRpZiAodHlwZW9mIGFyaWFMZXZlbCA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGV2ZWwnLCBgJHthcmlhTGV2ZWx9YCk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RpY2t5IFNjcm9sbCBlbGVtZW50cyBjYW4gbm90IGJlIHNlbGVjdGVkXG5cdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsIFN0cmluZyhmYWxzZSkpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fcm9vdERvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnZW1wdHknLCAhdmlzaWJsZSk7XG5cblx0XHRpZiAoIXZpc2libGUpIHtcblx0XHRcdHRoaXMuc3RpY2t5U2Nyb2xsRm9jdXMudXBkYXRlRWxlbWVudHMoW10sIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0Rm9jdXMoKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuc3RpY2t5U2Nyb2xsRm9jdXMuZ2V0Rm9jdXMoKTtcblx0fVxuXG5cdGRvbUZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuc3RpY2t5U2Nyb2xsRm9jdXMuZG9tRm9jdXMoKTtcblx0fVxuXG5cdGZvY3VzZWRMYXN0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0aWNreVNjcm9sbEZvY3VzLmZvY3VzZWRMYXN0KCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuc3RpY2t5U2Nyb2xsRm9jdXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3ByZXZpb3VzU3RhdGVEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcm9vdERvbU5vZGUucmVtb3ZlKCk7XG5cdH1cbn1cblxuY2xhc3MgU3RpY2t5U2Nyb2xsRm9jdXM8VCwgVEZpbHRlckRhdGEsIFRSZWY+IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBmb2N1c2VkSW5kZXg6IG51bWJlciA9IC0xO1xuXHRwcml2YXRlIGVsZW1lbnRzOiBIVE1MRWxlbWVudFtdID0gW107XG5cdHByaXZhdGUgc3RhdGU6IFN0aWNreVNjcm9sbFN0YXRlPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUhhc0ZvY3VzID0gbmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VIYXNGb2N1cyA9IHRoaXMuX29uRGlkQ2hhbmdlSGFzRm9jdXMuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25Db250ZXh0TWVudSA9IG5ldyBFbWl0dGVyPElUcmVlQ29udGV4dE1lbnVFdmVudDxUPj4oKTtcblx0cmVhZG9ubHkgb25Db250ZXh0TWVudTogRXZlbnQ8SVRyZWVDb250ZXh0TWVudUV2ZW50PFQ+PiA9IHRoaXMuX29uQ29udGV4dE1lbnUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfZG9tSGFzRm9jdXM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBnZXQgZG9tSGFzRm9jdXMoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9kb21IYXNGb2N1czsgfVxuXHRwcml2YXRlIHNldCBkb21IYXNGb2N1cyhoYXNGb2N1czogYm9vbGVhbikge1xuXHRcdGlmIChoYXNGb2N1cyAhPT0gdGhpcy5fZG9tSGFzRm9jdXMpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlSGFzRm9jdXMuZmlyZShoYXNGb2N1cyk7XG5cdFx0XHR0aGlzLl9kb21IYXNGb2N1cyA9IGhhc0ZvY3VzO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHZpZXc6IExpc3Q8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj5cblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciwgJ2ZvY3VzJywgKCkgPT4gdGhpcy5vbkZvY3VzKCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsICdibHVyJywgKCkgPT4gdGhpcy5vbkJsdXIoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlldy5vbkRpZEZvY3VzKCgpID0+IHRoaXMudG9nZ2xlU3RpY2t5U2Nyb2xsRm9jdXNlZChmYWxzZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXcub25LZXlEb3duKChlKSA9PiB0aGlzLm9uS2V5RG93bihlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlldy5vbk1vdXNlRG93bigoZSkgPT4gdGhpcy5vbk1vdXNlRG93bihlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlldy5vbkNvbnRleHRNZW51KChlKSA9PiB0aGlzLmhhbmRsZUNvbnRleHRNZW51KGUpKSk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUNvbnRleHRNZW51KGU6IElMaXN0Q29udGV4dE1lbnVFdmVudDxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+Pik6IHZvaWQge1xuXHRcdGNvbnN0IHRhcmdldCA9IGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudDtcblx0XHRpZiAoIWlzU3RpY2t5U2Nyb2xsQ29udGFpbmVyKHRhcmdldCkgJiYgIWlzU3RpY2t5U2Nyb2xsRWxlbWVudCh0YXJnZXQpKSB7XG5cdFx0XHRpZiAodGhpcy5mb2N1c2VkTGFzdCgpKSB7XG5cdFx0XHRcdHRoaXMudmlldy5kb21Gb2N1cygpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFRoZSBsaXN0IGhhbmRsZXMgdGhlIGNvbnRleHQgbWVudSB0cmlnZ2VyZWQgYnkgYSBtb3VzZSBldmVudFxuXHRcdC8vIEluIHRoYXQgY2FzZSBvbmx5IHNldCB0aGUgZm9jdXMgb2YgdGhlIGVsZW1lbnQgY2xpY2tlZCBhbmQgbGVhdmUgdGhlIHJlc3QgdG8gdGhlIGxpc3QgdG8gaGFuZGxlXG5cdFx0aWYgKCFpc0tleWJvYXJkRXZlbnQoZS5icm93c2VyRXZlbnQpKSB7XG5cdFx0XHRpZiAoIXRoaXMuc3RhdGUpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDb250ZXh0IG1lbnUgc2hvdWxkIG5vdCBiZSB0cmlnZ2VyZWQgd2hlbiBzdGF0ZSBpcyB1bmRlZmluZWQnKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RpY2t5SW5kZXggPSB0aGlzLnN0YXRlLnN0aWNreU5vZGVzLmZpbmRJbmRleChzdGlja3lOb2RlID0+IHN0aWNreU5vZGUubm9kZS5lbGVtZW50ID09PSBlLmVsZW1lbnQ/LmVsZW1lbnQpO1xuXG5cdFx0XHRpZiAoc3RpY2t5SW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignQ29udGV4dCBtZW51IHNob3VsZCBub3QgYmUgdHJpZ2dlcmVkIHdoZW4gZWxlbWVudCBpcyBub3QgaW4gc3RpY2t5IHNjcm9sbCB3aWRnZXQnKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuY29udGFpbmVyLmZvY3VzKCk7XG5cdFx0XHR0aGlzLnNldEZvY3VzKHN0aWNreUluZGV4KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuc3RhdGUgfHwgdGhpcy5mb2N1c2VkSW5kZXggPCAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvbnRleHQgbWVudSBrZXkgc2hvdWxkIG5vdCBiZSB0cmlnZ2VyZWQgd2hlbiBmb2N1cyBpcyBub3QgaW4gc3RpY2t5IHNjcm9sbCB3aWRnZXQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGlja3lOb2RlID0gdGhpcy5zdGF0ZS5zdGlja3lOb2Rlc1t0aGlzLmZvY3VzZWRJbmRleF07XG5cdFx0Y29uc3QgZWxlbWVudCA9IHN0aWNreU5vZGUubm9kZS5lbGVtZW50O1xuXHRcdGNvbnN0IGFuY2hvciA9IHRoaXMuZWxlbWVudHNbdGhpcy5mb2N1c2VkSW5kZXhdO1xuXHRcdHRoaXMuX29uQ29udGV4dE1lbnUuZmlyZSh7IGVsZW1lbnQsIGFuY2hvciwgYnJvd3NlckV2ZW50OiBlLmJyb3dzZXJFdmVudCwgaXNTdGlja3lTY3JvbGw6IHRydWUgfSk7XG5cdH1cblxuXHRwcml2YXRlIG9uS2V5RG93bihlOiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0Ly8gU3RpY2t5IFNjcm9sbCBOYXZpZ2F0aW9uXG5cdFx0aWYgKHRoaXMuZG9tSGFzRm9jdXMgJiYgdGhpcy5zdGF0ZSkge1xuXHRcdFx0Ly8gTW92ZSB1cFxuXHRcdFx0aWYgKGUua2V5ID09PSAnQXJyb3dVcCcpIHtcblx0XHRcdFx0dGhpcy5zZXRGb2N1c2VkRWxlbWVudChNYXRoLm1heCgwLCB0aGlzLmZvY3VzZWRJbmRleCAtIDEpKTtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gTW92ZSBkb3duLCBpZiBsYXN0IHN0aWNreSBub2RlIGlzIGZvY3VzZWQsIG1vdmUgZm9jdXMgaW50byBmaXJzdCBjaGlsZCBvZiBsYXN0IHN0aWNreSBub2RlXG5cdFx0XHRlbHNlIGlmIChlLmtleSA9PT0gJ0Fycm93RG93bicgfHwgZS5rZXkgPT09ICdBcnJvd1JpZ2h0Jykge1xuXHRcdFx0XHRpZiAodGhpcy5mb2N1c2VkSW5kZXggPj0gdGhpcy5zdGF0ZS5jb3VudCAtIDEpIHtcblx0XHRcdFx0XHRjb25zdCBub2RlSW5kZXhUb0ZvY3VzID0gdGhpcy5zdGF0ZS5zdGlja3lOb2Rlc1t0aGlzLnN0YXRlLmNvdW50IC0gMV0uc3RhcnRJbmRleCArIDE7XG5cdFx0XHRcdFx0dGhpcy52aWV3LmRvbUZvY3VzKCk7XG5cdFx0XHRcdFx0dGhpcy52aWV3LnNldEZvY3VzKFtub2RlSW5kZXhUb0ZvY3VzXSk7XG5cdFx0XHRcdFx0dGhpcy5zY3JvbGxOb2RlVW5kZXJXaWRnZXQobm9kZUluZGV4VG9Gb2N1cywgdGhpcy5zdGF0ZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRGb2N1c2VkRWxlbWVudCh0aGlzLmZvY3VzZWRJbmRleCArIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uTW91c2VEb3duKGU6IElMaXN0TW91c2VFdmVudDxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+Pik6IHZvaWQge1xuXHRcdGNvbnN0IHRhcmdldCA9IGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudDtcblx0XHRpZiAoIWlzU3RpY2t5U2Nyb2xsQ29udGFpbmVyKHRhcmdldCkgJiYgIWlzU3RpY2t5U2Nyb2xsRWxlbWVudCh0YXJnZXQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZS5icm93c2VyRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRlLmJyb3dzZXJFdmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0fVxuXG5cdHVwZGF0ZUVsZW1lbnRzKGVsZW1lbnRzOiBIVE1MRWxlbWVudFtdLCBzdGF0ZTogU3RpY2t5U2Nyb2xsU3RhdGU8VCwgVEZpbHRlckRhdGEsIFRSZWY+IHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKHN0YXRlICYmIHN0YXRlLmNvdW50ID09PSAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1N0aWNreSBzY3JvbGwgc3RhdGUgbXVzdCBiZSB1bmRlZmluZWQgd2hlbiB0aGVyZSBhcmUgbm8gc3RpY2t5IG5vZGVzJyk7XG5cdFx0fVxuXHRcdGlmIChzdGF0ZSAmJiBzdGF0ZS5jb3VudCAhPT0gZWxlbWVudHMubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1N0aWNreSBzY3JvbGwgZm9jdXMgcmVjZWl2ZWQgaWxsaWdlbCBzdGF0ZScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZpb3VzSW5kZXggPSB0aGlzLmZvY3VzZWRJbmRleDtcblx0XHR0aGlzLnJlbW92ZUZvY3VzKCk7XG5cblx0XHR0aGlzLmVsZW1lbnRzID0gZWxlbWVudHM7XG5cdFx0dGhpcy5zdGF0ZSA9IHN0YXRlO1xuXG5cdFx0aWYgKHN0YXRlKSB7XG5cdFx0XHRjb25zdCBuZXdGb2N1c2VkSW5kZXggPSBjbGFtcChwcmV2aW91c0luZGV4LCAwLCBzdGF0ZS5jb3VudCAtIDEpO1xuXHRcdFx0dGhpcy5zZXRGb2N1cyhuZXdGb2N1c2VkSW5kZXgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodGhpcy5kb21IYXNGb2N1cykge1xuXHRcdFx0XHR0aGlzLnZpZXcuZG9tRm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBtdXN0IGNvbWUgbGFzdCBhcyBpdCBjYWxscyBibHVyKClcblx0XHR0aGlzLmNvbnRhaW5lci50YWJJbmRleCA9IHN0YXRlID8gMCA6IC0xO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRGb2N1c2VkRWxlbWVudChzdGlja3lJbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Ly8gZG9lc24ndCBpbXBseSB0aGF0IHRoZSB3aWRnZXQgaGFzIChvciB3aWxsIGhhdmUpIGZvY3VzXG5cblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuc3RhdGU7XG5cdFx0aWYgKCFzdGF0ZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3Qgc2V0IGZvY3VzIHdoZW4gc3RhdGUgaXMgdW5kZWZpbmVkJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRGb2N1cyhzdGlja3lJbmRleCk7XG5cblx0XHRpZiAoc3RpY2t5SW5kZXggPCBzdGF0ZS5jb3VudCAtIDEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBJZiB0aGUgbGFzdCBzdGlja3kgbm9kZSBpcyBub3QgZnVsbHkgdmlzaWJsZSwgc2Nyb2xsIGl0IGludG8gdmlld1xuXHRcdGlmIChzdGF0ZS5sYXN0Tm9kZVBhcnRpYWxseVZpc2libGUoKSkge1xuXHRcdFx0Y29uc3QgbGFzdFN0aWNreU5vZGUgPSBzdGF0ZS5zdGlja3lOb2Rlc1tzdGlja3lJbmRleF07XG5cdFx0XHR0aGlzLnNjcm9sbE5vZGVVbmRlcldpZGdldChsYXN0U3RpY2t5Tm9kZS5lbmRJbmRleCArIDEsIHN0YXRlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNjcm9sbE5vZGVVbmRlcldpZGdldChub2RlSW5kZXg6IG51bWJlciwgc3RhdGU6IFN0aWNreVNjcm9sbFN0YXRlPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPikge1xuXHRcdGNvbnN0IGxhc3RTdGlja3lOb2RlID0gc3RhdGUuc3RpY2t5Tm9kZXNbc3RhdGUuY291bnQgLSAxXTtcblx0XHRjb25zdCBzZWNvbmRMYXN0U3RpY2t5Tm9kZSA9IHN0YXRlLmNvdW50ID4gMSA/IHN0YXRlLnN0aWNreU5vZGVzW3N0YXRlLmNvdW50IC0gMl0gOiB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBlbGVtZW50U2Nyb2xsVG9wID0gdGhpcy52aWV3LmdldEVsZW1lbnRUb3Aobm9kZUluZGV4KTtcblx0XHRjb25zdCBlbGVtZW50VGFyZ2V0Vmlld1RvcCA9IHNlY29uZExhc3RTdGlja3lOb2RlID8gc2Vjb25kTGFzdFN0aWNreU5vZGUucG9zaXRpb24gKyBzZWNvbmRMYXN0U3RpY2t5Tm9kZS5oZWlnaHQgKyBsYXN0U3RpY2t5Tm9kZS5oZWlnaHQgOiBsYXN0U3RpY2t5Tm9kZS5oZWlnaHQ7XG5cdFx0dGhpcy52aWV3LnNjcm9sbFRvcCA9IGVsZW1lbnRTY3JvbGxUb3AgLSBlbGVtZW50VGFyZ2V0Vmlld1RvcDtcblx0fVxuXG5cdGdldEZvY3VzKCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5zdGF0ZSB8fCB0aGlzLmZvY3VzZWRJbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnN0YXRlLnN0aWNreU5vZGVzW3RoaXMuZm9jdXNlZEluZGV4XS5ub2RlLmVsZW1lbnQ7XG5cdH1cblxuXHRkb21Gb2N1cygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuc3RhdGUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZvY3VzIHdoZW4gc3RhdGUgaXMgdW5kZWZpbmVkJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jb250YWluZXIuZm9jdXMoKTtcblx0fVxuXG5cdGZvY3VzZWRMYXN0KCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5zdGF0ZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy52aWV3LmdldEhUTUxFbGVtZW50KCkuY2xhc3NMaXN0LmNvbnRhaW5zKCdzdGlja3ktc2Nyb2xsLWZvY3VzZWQnKTtcblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlRm9jdXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZm9jdXNlZEluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnRvZ2dsZUVsZW1lbnRGb2N1cyh0aGlzLmVsZW1lbnRzW3RoaXMuZm9jdXNlZEluZGV4XSwgZmFsc2UpO1xuXHRcdHRoaXMuZm9jdXNlZEluZGV4ID0gLTE7XG5cdH1cblxuXHRwcml2YXRlIHNldEZvY3VzKG5ld0ZvY3VzSW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICgwID4gbmV3Rm9jdXNJbmRleCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdhZGRGb2N1cygpIGNhbiBub3QgcmVtb3ZlIGZvY3VzJyk7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5zdGF0ZSAmJiBuZXdGb2N1c0luZGV4ID49IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHNldCBmb2N1cyBpbmRleCB3aGVuIHN0YXRlIGlzIHVuZGVmaW5lZCcpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5zdGF0ZSAmJiBuZXdGb2N1c0luZGV4ID49IHRoaXMuc3RhdGUuY291bnQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHNldCBmb2N1cyBpbmRleCB0byBhbiBpbmRleCB0aGF0IGRvZXMgbm90IGV4aXN0Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb2xkSW5kZXggPSB0aGlzLmZvY3VzZWRJbmRleDtcblx0XHRpZiAob2xkSW5kZXggPj0gMCkge1xuXHRcdFx0dGhpcy50b2dnbGVFbGVtZW50Rm9jdXModGhpcy5lbGVtZW50c1tvbGRJbmRleF0sIGZhbHNlKTtcblx0XHR9XG5cdFx0aWYgKG5ld0ZvY3VzSW5kZXggPj0gMCkge1xuXHRcdFx0dGhpcy50b2dnbGVFbGVtZW50Rm9jdXModGhpcy5lbGVtZW50c1tuZXdGb2N1c0luZGV4XSwgdHJ1ZSk7XG5cdFx0fVxuXHRcdHRoaXMuZm9jdXNlZEluZGV4ID0gbmV3Rm9jdXNJbmRleDtcblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlRWxlbWVudEZvY3VzKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBmb2N1c2VkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy50b2dnbGVFbGVtZW50QWN0aXZlRm9jdXMoZWxlbWVudCwgZm9jdXNlZCAmJiB0aGlzLmRvbUhhc0ZvY3VzKTtcblx0XHR0aGlzLnRvZ2dsZUVsZW1lbnRQYXNzaXZlRm9jdXMoZWxlbWVudCwgZm9jdXNlZCk7XG5cdH1cblxuXHRwcml2YXRlIHRvZ2dsZUN1cnJlbnRFbGVtZW50QWN0aXZlRm9jdXMoZm9jdXNlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmZvY3VzZWRJbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy50b2dnbGVFbGVtZW50QWN0aXZlRm9jdXModGhpcy5lbGVtZW50c1t0aGlzLmZvY3VzZWRJbmRleF0sIGZvY3VzZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSB0b2dnbGVFbGVtZW50QWN0aXZlRm9jdXMoZWxlbWVudDogSFRNTEVsZW1lbnQsIGZvY3VzZWQ6IGJvb2xlYW4pIHtcblx0XHQvLyBhY3RpdmUgZm9jdXMgaXMgc2V0IHdoZW4gc3RpY2t5IHNjcm9sbCBoYXMgZm9jdXNcblx0XHRlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2ZvY3VzZWQnLCBmb2N1c2VkKTtcblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlRWxlbWVudFBhc3NpdmVGb2N1cyhlbGVtZW50OiBIVE1MRWxlbWVudCwgZm9jdXNlZDogYm9vbGVhbikge1xuXHRcdC8vIHBhc3NpdmUgZm9jdXMgYWxsb3dzIHRvIHNob3cgZm9jdXMgd2hlbiBzdGlja3kgc2Nyb2xsIGRvZXMgbm90IGhhdmUgZm9jdXNcblx0XHQvLyBmb3IgZXhhbXBsZSB3aGVuIHRoZSBjb250ZXh0IG1lbnUgaGFzIGZvY3VzXG5cdFx0ZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdwYXNzaXZlLWZvY3VzZWQnLCBmb2N1c2VkKTtcblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlU3RpY2t5U2Nyb2xsRm9jdXNlZChmb2N1c2VkOiBib29sZWFuKSB7XG5cdFx0Ly8gV2VhdGhlciB0aGUgbGFzdCBmb2N1cyBpbiB0aGUgdmlldyB3YXMgc3RpY2t5IHNjcm9sbCBhbmQgbm90IHRoZSBsaXN0XG5cdFx0Ly8gSXMgb25seSByZW1vdmVkIHdoZW4gdGhlIGZvY3VzIGlzIGJhY2sgaW4gdGhlIHRyZWUgYW4gbm8gbG9uZ2VyIGluIHN0aWNreSBzY3JvbGxcblx0XHR0aGlzLnZpZXcuZ2V0SFRNTEVsZW1lbnQoKS5jbGFzc0xpc3QudG9nZ2xlKCdzdGlja3ktc2Nyb2xsLWZvY3VzZWQnLCBmb2N1c2VkKTtcblx0fVxuXG5cdHByaXZhdGUgb25Gb2N1cygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuc3RhdGUgfHwgdGhpcy5lbGVtZW50cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZvY3VzIHdoZW4gc3RhdGUgaXMgdW5kZWZpbmVkIG9yIGVsZW1lbnRzIGFyZSBlbXB0eScpO1xuXHRcdH1cblx0XHR0aGlzLmRvbUhhc0ZvY3VzID0gdHJ1ZTtcblx0XHR0aGlzLnRvZ2dsZVN0aWNreVNjcm9sbEZvY3VzZWQodHJ1ZSk7XG5cdFx0dGhpcy50b2dnbGVDdXJyZW50RWxlbWVudEFjdGl2ZUZvY3VzKHRydWUpO1xuXHRcdGlmICh0aGlzLmZvY3VzZWRJbmRleCA9PT0gLTEpIHtcblx0XHRcdHRoaXMuc2V0Rm9jdXMoMCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkJsdXIoKTogdm9pZCB7XG5cdFx0dGhpcy5kb21IYXNGb2N1cyA9IGZhbHNlO1xuXHRcdHRoaXMudG9nZ2xlQ3VycmVudEVsZW1lbnRBY3RpdmVGb2N1cyhmYWxzZSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMudG9nZ2xlU3RpY2t5U2Nyb2xsRm9jdXNlZChmYWxzZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VIYXNGb2N1cy5maXJlKGZhbHNlKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gYXNUcmVlTW91c2VFdmVudDxUPihldmVudDogSUxpc3RNb3VzZUV2ZW50PElUcmVlTm9kZTxULCBhbnk+Pik6IElUcmVlTW91c2VFdmVudDxUPiB7XG5cdGxldCB0YXJnZXQ6IFRyZWVNb3VzZUV2ZW50VGFyZ2V0ID0gVHJlZU1vdXNlRXZlbnRUYXJnZXQuVW5rbm93bjtcblxuXHRpZiAoaGFzUGFyZW50V2l0aENsYXNzKGV2ZW50LmJyb3dzZXJFdmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQsICdtb25hY28tdGwtdHdpc3RpZScsICdtb25hY28tdGwtcm93JykpIHtcblx0XHR0YXJnZXQgPSBUcmVlTW91c2VFdmVudFRhcmdldC5Ud2lzdGllO1xuXHR9IGVsc2UgaWYgKGhhc1BhcmVudFdpdGhDbGFzcyhldmVudC5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50LCAnbW9uYWNvLXRsLWNvbnRlbnRzJywgJ21vbmFjby10bC1yb3cnKSkge1xuXHRcdHRhcmdldCA9IFRyZWVNb3VzZUV2ZW50VGFyZ2V0LkVsZW1lbnQ7XG5cdH0gZWxzZSBpZiAoaGFzUGFyZW50V2l0aENsYXNzKGV2ZW50LmJyb3dzZXJFdmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQsICdtb25hY28tdHJlZS10eXBlLWZpbHRlcicsICdtb25hY28tbGlzdCcpKSB7XG5cdFx0dGFyZ2V0ID0gVHJlZU1vdXNlRXZlbnRUYXJnZXQuRmlsdGVyO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRicm93c2VyRXZlbnQ6IGV2ZW50LmJyb3dzZXJFdmVudCxcblx0XHRlbGVtZW50OiBldmVudC5lbGVtZW50ID8gZXZlbnQuZWxlbWVudC5lbGVtZW50IDogbnVsbCxcblx0XHR0YXJnZXRcblx0fTtcbn1cblxuZnVuY3Rpb24gYXNUcmVlQ29udGV4dE1lbnVFdmVudDxUPihldmVudDogSUxpc3RDb250ZXh0TWVudUV2ZW50PElUcmVlTm9kZTxULCBhbnk+Pik6IElUcmVlQ29udGV4dE1lbnVFdmVudDxUPiB7XG5cdGNvbnN0IGlzU3RpY2t5U2Nyb2xsID0gaXNTdGlja3lTY3JvbGxDb250YWluZXIoZXZlbnQuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCk7XG5cblx0cmV0dXJuIHtcblx0XHRlbGVtZW50OiBldmVudC5lbGVtZW50ID8gZXZlbnQuZWxlbWVudC5lbGVtZW50IDogbnVsbCxcblx0XHRicm93c2VyRXZlbnQ6IGV2ZW50LmJyb3dzZXJFdmVudCxcblx0XHRhbmNob3I6IGV2ZW50LmFuY2hvcixcblx0XHRpc1N0aWNreVNjcm9sbFxuXHR9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBYnN0cmFjdFRyZWVPcHRpb25zVXBkYXRlIGV4dGVuZHMgSVRyZWVSZW5kZXJlck9wdGlvbnMge1xuXHRyZWFkb25seSBtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ/OiBib29sZWFuO1xuXHRyZWFkb25seSB0eXBlTmF2aWdhdGlvbkVuYWJsZWQ/OiBib29sZWFuO1xuXHRyZWFkb25seSB0eXBlTmF2aWdhdGlvbk1vZGU/OiBUeXBlTmF2aWdhdGlvbk1vZGU7XG5cdHJlYWRvbmx5IGRlZmF1bHRGaW5kTW9kZT86IFRyZWVGaW5kTW9kZTtcblx0cmVhZG9ubHkgZGVmYXVsdEZpbmRNYXRjaFR5cGU/OiBUcmVlRmluZE1hdGNoVHlwZTtcblx0cmVhZG9ubHkgc2hvd05vdEZvdW5kTWVzc2FnZT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNtb290aFNjcm9sbGluZz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGhvcml6b250YWxTY3JvbGxpbmc/OiBib29sZWFuO1xuXHRyZWFkb25seSBzY3JvbGxCeVBhZ2U/OiBib29sZWFuO1xuXHRyZWFkb25seSBtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHk/OiBudW1iZXI7XG5cdHJlYWRvbmx5IGZhc3RTY3JvbGxTZW5zaXRpdml0eT86IG51bWJlcjtcblx0cmVhZG9ubHkgZXhwYW5kT25Eb3VibGVDbGljaz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGV4cGFuZE9ubHlPblR3aXN0aWVDbGljaz86IGJvb2xlYW4gfCAoKGU6IGFueSkgPT4gYm9vbGVhbik7IC8vIGUgaXMgVFxuXHRyZWFkb25seSBlbmFibGVTdGlja3lTY3JvbGw/OiBib29sZWFuO1xuXHRyZWFkb25seSBzdGlja3lTY3JvbGxNYXhJdGVtQ291bnQ/OiBudW1iZXI7XG5cdHJlYWRvbmx5IHBhZGRpbmdUb3A/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFic3RyYWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGEgPSB2b2lkPiBleHRlbmRzIElBYnN0cmFjdFRyZWVPcHRpb25zVXBkYXRlLCBJTGlzdE9wdGlvbnM8VD4ge1xuXHRyZWFkb25seSBjb250ZXh0Vmlld1Byb3ZpZGVyPzogSUNvbnRleHRWaWV3UHJvdmlkZXI7XG5cdHJlYWRvbmx5IGNvbGxhcHNlQnlEZWZhdWx0PzogYm9vbGVhbjsgLy8gZGVmYXVsdHMgdG8gZmFsc2Vcblx0cmVhZG9ubHkgYWxsb3dOb25Db2xsYXBzaWJsZVBhcmVudHM/OiBib29sZWFuOyAvLyBkZWZhdWx0cyB0byBmYWxzZVxuXHRyZWFkb25seSBmaWx0ZXI/OiBJVHJlZUZpbHRlcjxULCBURmlsdGVyRGF0YT47XG5cdHJlYWRvbmx5IGRuZD86IElUcmVlRHJhZ0FuZERyb3A8VD47XG5cdHJlYWRvbmx5IHBhZGRpbmdCb3R0b20/OiBudW1iZXI7XG5cdHJlYWRvbmx5IGZpbmRXaWRnZXRFbmFibGVkPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZmluZFdpZGdldFN0eWxlcz86IElGaW5kV2lkZ2V0U3R5bGVzO1xuXHRyZWFkb25seSBkZWZhdWx0RmluZFZpc2liaWxpdHk/OiBUcmVlVmlzaWJpbGl0eSB8ICgoZTogVCkgPT4gVHJlZVZpc2liaWxpdHkpO1xuXHRyZWFkb25seSBzdGlja3lTY3JvbGxEZWxlZ2F0ZT86IElTdGlja3lTY3JvbGxEZWxlZ2F0ZTxhbnksIFRGaWx0ZXJEYXRhPjtcbn1cblxuZnVuY3Rpb24gZGZzPFQsIFRGaWx0ZXJEYXRhPihub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+LCBmbjogKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pID0+IHZvaWQpOiB2b2lkIHtcblx0Zm4obm9kZSk7XG5cdG5vZGUuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiBkZnMoY2hpbGQsIGZuKSk7XG59XG5cbi8qKlxuICogVGhlIHRyYWl0IGNvbmNlcHQgbmVlZHMgdG8gZXhpc3QgYXQgdGhlIHRyZWUgbGV2ZWwsIGJlY2F1c2UgY29sbGFwc2VkXG4gKiB0cmVlIG5vZGVzIHdpbGwgbm90IGJlIGtub3duIGJ5IHRoZSBsaXN0LlxuICovXG5jbGFzcyBUcmFpdDxUPiB7XG5cblx0cHJpdmF0ZSBub2RlczogSVRyZWVOb2RlPFQsIGFueT5bXSA9IFtdO1xuXHRwcml2YXRlIGVsZW1lbnRzOiBUW10gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjxJVHJlZUV2ZW50PFQ+PigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX25vZGVTZXQ6IFNldDxJVHJlZU5vZGU8VCwgYW55Pj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IG5vZGVTZXQoKTogU2V0PElUcmVlTm9kZTxULCBhbnk+PiB7XG5cdFx0aWYgKCF0aGlzLl9ub2RlU2V0KSB7XG5cdFx0XHR0aGlzLl9ub2RlU2V0ID0gdGhpcy5jcmVhdGVOb2RlU2V0KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX25vZGVTZXQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGdldEZpcnN0Vmlld0VsZW1lbnRXaXRoVHJhaXQ6ICgpID0+IElUcmVlTm9kZTxULCBhbnk+IHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgaWRlbnRpdHlQcm92aWRlcj86IElJZGVudGl0eVByb3ZpZGVyPFQ+XG5cdCkgeyB9XG5cblx0c2V0KG5vZGVzOiBJVHJlZU5vZGU8VCwgYW55PltdLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCEoYnJvd3NlckV2ZW50IGFzIGFueSk/Ll9fZm9yY2VFdmVudCAmJiBlcXVhbHModGhpcy5ub2Rlcywgbm9kZXMpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2V0KG5vZGVzLCBmYWxzZSwgYnJvd3NlckV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgX3NldChub2RlczogSVRyZWVOb2RlPFQsIGFueT5bXSwgc2lsZW50OiBib29sZWFuLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5ub2RlcyA9IFsuLi5ub2Rlc107XG5cdFx0dGhpcy5lbGVtZW50cyA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9ub2RlU2V0ID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKCFzaWxlbnQpIHtcblx0XHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGdldCBlbGVtZW50cygpIHsgcmV0dXJuIHRoYXQuZ2V0KCk7IH0sIGJyb3dzZXJFdmVudCB9KTtcblx0XHR9XG5cdH1cblxuXHRnZXQoKTogVFtdIHtcblx0XHRpZiAoIXRoaXMuZWxlbWVudHMpIHtcblx0XHRcdHRoaXMuZWxlbWVudHMgPSB0aGlzLm5vZGVzLm1hcChub2RlID0+IG5vZGUuZWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFsuLi50aGlzLmVsZW1lbnRzXTtcblx0fVxuXG5cdGdldE5vZGVzKCk6IHJlYWRvbmx5IElUcmVlTm9kZTxULCBhbnk+W10ge1xuXHRcdHJldHVybiB0aGlzLm5vZGVzO1xuXHR9XG5cblx0aGFzKG5vZGU6IElUcmVlTm9kZTxULCBhbnk+KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubm9kZVNldC5oYXMobm9kZSk7XG5cdH1cblxuXHRvbkRpZE1vZGVsU3BsaWNlKHsgaW5zZXJ0ZWROb2RlcywgZGVsZXRlZE5vZGVzIH06IElUcmVlTW9kZWxTcGxpY2VFdmVudDxULCBhbnk+KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlkZW50aXR5UHJvdmlkZXIpIHtcblx0XHRcdGNvbnN0IHNldCA9IHRoaXMuY3JlYXRlTm9kZVNldCgpO1xuXHRcdFx0Y29uc3QgdmlzaXQgPSAobm9kZTogSVRyZWVOb2RlPFQsIGFueT4pID0+IHNldC5kZWxldGUobm9kZSk7XG5cdFx0XHRkZWxldGVkTm9kZXMuZm9yRWFjaChub2RlID0+IGRmcyhub2RlLCB2aXNpdCkpO1xuXHRcdFx0dGhpcy5zZXQoWy4uLnNldC52YWx1ZXMoKV0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlbGV0ZWROb2Rlc0lkU2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Y29uc3QgZGVsZXRlZE5vZGVzVmlzaXRvciA9IChub2RlOiBJVHJlZU5vZGU8VCwgYW55PikgPT4gZGVsZXRlZE5vZGVzSWRTZXQuYWRkKHRoaXMuaWRlbnRpdHlQcm92aWRlciEuZ2V0SWQobm9kZS5lbGVtZW50KS50b1N0cmluZygpKTtcblx0XHRkZWxldGVkTm9kZXMuZm9yRWFjaChub2RlID0+IGRmcyhub2RlLCBkZWxldGVkTm9kZXNWaXNpdG9yKSk7XG5cblx0XHRjb25zdCBpbnNlcnRlZE5vZGVzTWFwID0gbmV3IE1hcDxzdHJpbmcsIElUcmVlTm9kZTxULCBhbnk+PigpO1xuXHRcdGNvbnN0IGluc2VydGVkTm9kZXNWaXNpdG9yID0gKG5vZGU6IElUcmVlTm9kZTxULCBhbnk+KSA9PiBpbnNlcnRlZE5vZGVzTWFwLnNldCh0aGlzLmlkZW50aXR5UHJvdmlkZXIhLmdldElkKG5vZGUuZWxlbWVudCkudG9TdHJpbmcoKSwgbm9kZSk7XG5cdFx0aW5zZXJ0ZWROb2Rlcy5mb3JFYWNoKG5vZGUgPT4gZGZzKG5vZGUsIGluc2VydGVkTm9kZXNWaXNpdG9yKSk7XG5cblx0XHRjb25zdCBub2RlczogSVRyZWVOb2RlPFQsIGFueT5bXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHRoaXMubm9kZXMpIHtcblx0XHRcdGNvbnN0IGlkID0gdGhpcy5pZGVudGl0eVByb3ZpZGVyLmdldElkKG5vZGUuZWxlbWVudCkudG9TdHJpbmcoKTtcblx0XHRcdGNvbnN0IHdhc0RlbGV0ZWQgPSBkZWxldGVkTm9kZXNJZFNldC5oYXMoaWQpO1xuXG5cdFx0XHRpZiAoIXdhc0RlbGV0ZWQpIHtcblx0XHRcdFx0bm9kZXMucHVzaChub2RlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGluc2VydGVkTm9kZSA9IGluc2VydGVkTm9kZXNNYXAuZ2V0KGlkKTtcblxuXHRcdFx0XHRpZiAoaW5zZXJ0ZWROb2RlICYmIGluc2VydGVkTm9kZS52aXNpYmxlKSB7XG5cdFx0XHRcdFx0bm9kZXMucHVzaChpbnNlcnRlZE5vZGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMubm9kZXMubGVuZ3RoID4gMCAmJiBub2Rlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdGNvbnN0IG5vZGUgPSB0aGlzLmdldEZpcnN0Vmlld0VsZW1lbnRXaXRoVHJhaXQoKTtcblxuXHRcdFx0aWYgKG5vZGUpIHtcblx0XHRcdFx0bm9kZXMucHVzaChub2RlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9zZXQobm9kZXMsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVOb2RlU2V0KCk6IFNldDxJVHJlZU5vZGU8VCwgYW55Pj4ge1xuXHRcdGNvbnN0IHNldCA9IG5ldyBTZXQ8SVRyZWVOb2RlPFQsIGFueT4+KCk7XG5cblx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgdGhpcy5ub2Rlcykge1xuXHRcdFx0c2V0LmFkZChub2RlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc2V0O1xuXHR9XG59XG5cbmNsYXNzIFRyZWVOb2RlTGlzdE1vdXNlQ29udHJvbGxlcjxULCBURmlsdGVyRGF0YSwgVFJlZj4gZXh0ZW5kcyBNb3VzZUNvbnRyb2xsZXI8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGxpc3Q6IFRyZWVOb2RlTGlzdDxULCBURmlsdGVyRGF0YSwgVFJlZj4sXG5cdFx0cHJpdmF0ZSB0cmVlOiBBYnN0cmFjdFRyZWU8VCwgVEZpbHRlckRhdGEsIFRSZWY+LFxuXHRcdHByaXZhdGUgc3RpY2t5U2Nyb2xsUHJvdmlkZXI6ICgpID0+IFN0aWNreVNjcm9sbENvbnRyb2xsZXI8VCwgVEZpbHRlckRhdGEsIFRSZWY+IHwgdW5kZWZpbmVkXG5cdCkge1xuXHRcdHN1cGVyKGxpc3QpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIG9uVmlld1BvaW50ZXIoZTogSUxpc3RNb3VzZUV2ZW50PElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4+KTogdm9pZCB7XG5cdFx0aWYgKGlzQnV0dG9uKGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkgfHxcblx0XHRcdGlzRWRpdGFibGVFbGVtZW50KGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkgfHxcblx0XHRcdGlzTW9uYWNvRWRpdG9yKGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZS5icm93c2VyRXZlbnQuaXNIYW5kbGVkQnlMaXN0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9kZSA9IGUuZWxlbWVudDtcblxuXHRcdGlmICghbm9kZSkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLm9uVmlld1BvaW50ZXIoZSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNTZWxlY3Rpb25SYW5nZUNoYW5nZUV2ZW50KGUpIHx8IHRoaXMuaXNTZWxlY3Rpb25TaW5nbGVDaGFuZ2VFdmVudChlKSkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLm9uVmlld1BvaW50ZXIoZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFyZ2V0ID0gZS5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IG9uVHdpc3RpZSA9IHRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ21vbmFjby10bC10d2lzdGllJylcblx0XHRcdHx8ICh0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCdtb25hY28taWNvbi1sYWJlbCcpICYmIHRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ2ZvbGRlci1pY29uJykgJiYgZS5icm93c2VyRXZlbnQub2Zmc2V0WCA8IDE2KTtcblx0XHRjb25zdCBpc1N0aWNreUVsZW1lbnQgPSBpc1N0aWNreVNjcm9sbEVsZW1lbnQoZS5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KTtcblxuXHRcdGxldCBleHBhbmRPbmx5T25Ud2lzdGllQ2xpY2sgPSBmYWxzZTtcblxuXHRcdGlmIChpc1N0aWNreUVsZW1lbnQpIHtcblx0XHRcdGV4cGFuZE9ubHlPblR3aXN0aWVDbGljayA9IHRydWU7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiB0aGlzLnRyZWUuZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRleHBhbmRPbmx5T25Ud2lzdGllQ2xpY2sgPSB0aGlzLnRyZWUuZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrKG5vZGUuZWxlbWVudCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGV4cGFuZE9ubHlPblR3aXN0aWVDbGljayA9ICEhdGhpcy50cmVlLmV4cGFuZE9ubHlPblR3aXN0aWVDbGljaztcblx0XHR9XG5cblx0XHRpZiAoIWlzU3RpY2t5RWxlbWVudCkge1xuXHRcdFx0aWYgKGV4cGFuZE9ubHlPblR3aXN0aWVDbGljayAmJiAhb25Ud2lzdGllICYmIGUuYnJvd3NlckV2ZW50LmRldGFpbCAhPT0gMikge1xuXHRcdFx0XHRyZXR1cm4gc3VwZXIub25WaWV3UG9pbnRlcihlKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLnRyZWUuZXhwYW5kT25Eb3VibGVDbGljayAmJiBlLmJyb3dzZXJFdmVudC5kZXRhaWwgPT09IDIpIHtcblx0XHRcdFx0cmV0dXJuIHN1cGVyLm9uVmlld1BvaW50ZXIoZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaGFuZGxlU3RpY2t5U2Nyb2xsTW91c2VFdmVudChlLCBub2RlKTtcblx0XHR9XG5cblx0XHRpZiAobm9kZS5jb2xsYXBzaWJsZSAmJiAoIWlzU3RpY2t5RWxlbWVudCB8fCBvblR3aXN0aWUpKSB7XG5cdFx0XHRjb25zdCBsb2NhdGlvbiA9IHRoaXMudHJlZS5nZXROb2RlTG9jYXRpb24obm9kZSk7XG5cdFx0XHRjb25zdCByZWN1cnNpdmUgPSBlLmJyb3dzZXJFdmVudC5hbHRLZXk7XG5cdFx0XHR0aGlzLnRyZWUuc2V0Rm9jdXMoW2xvY2F0aW9uXSk7XG5cdFx0XHR0aGlzLnRyZWUudG9nZ2xlQ29sbGFwc2VkKGxvY2F0aW9uLCByZWN1cnNpdmUpO1xuXG5cdFx0XHRpZiAob25Ud2lzdGllKSB7XG5cdFx0XHRcdC8vIERvIG5vdCBzZXQgdGhpcyBiZWZvcmUgY2FsbGluZyBhIGhhbmRsZXIgb24gdGhlIHN1cGVyIGNsYXNzLCBiZWNhdXNlIGl0IHdpbGwgcmVqZWN0IGl0IGFzIGhhbmRsZWRcblx0XHRcdFx0ZS5icm93c2VyRXZlbnQuaXNIYW5kbGVkQnlMaXN0ID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghaXNTdGlja3lFbGVtZW50KSB7XG5cdFx0XHRzdXBlci5vblZpZXdQb2ludGVyKGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlU3RpY2t5U2Nyb2xsTW91c2VFdmVudChlOiBJTGlzdE1vdXNlRXZlbnQ8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4sIG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pOiB2b2lkIHtcblx0XHRpZiAoaXNNb25hY29DdXN0b21Ub2dnbGUoZS5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSB8fCBpc0FjdGlvbkl0ZW0oZS5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0aWNreVNjcm9sbENvbnRyb2xsZXIgPSB0aGlzLnN0aWNreVNjcm9sbFByb3ZpZGVyKCk7XG5cdFx0aWYgKCFzdGlja3lTY3JvbGxDb250cm9sbGVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1N0aWNreSBzY3JvbGwgY29udHJvbGxlciBub3QgZm91bmQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBub2RlSW5kZXggPSB0aGlzLmxpc3QuaW5kZXhPZihub2RlKTtcblx0XHRjb25zdCBlbGVtZW50U2Nyb2xsVG9wID0gdGhpcy5saXN0LmdldEVsZW1lbnRUb3Aobm9kZUluZGV4KTtcblx0XHRjb25zdCBlbGVtZW50VGFyZ2V0Vmlld1RvcCA9IHN0aWNreVNjcm9sbENvbnRyb2xsZXIubm9kZVBvc2l0aW9uVG9wQmVsb3dXaWRnZXQobm9kZSk7XG5cdFx0dGhpcy50cmVlLnNjcm9sbFRvcCA9IGVsZW1lbnRTY3JvbGxUb3AgLSBlbGVtZW50VGFyZ2V0Vmlld1RvcDtcblx0XHR0aGlzLmxpc3QuZG9tRm9jdXMoKTtcblx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW25vZGVJbmRleF0pO1xuXHRcdHRoaXMubGlzdC5zZXRTZWxlY3Rpb24oW25vZGVJbmRleF0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIG9uRG91YmxlQ2xpY2soZTogSUxpc3RNb3VzZUV2ZW50PElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4+KTogdm9pZCB7XG5cdFx0Y29uc3Qgb25Ud2lzdGllID0gKGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkuY2xhc3NMaXN0LmNvbnRhaW5zKCdtb25hY28tdGwtdHdpc3RpZScpO1xuXG5cdFx0aWYgKG9uVHdpc3RpZSB8fCAhdGhpcy50cmVlLmV4cGFuZE9uRG91YmxlQ2xpY2spIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZS5icm93c2VyRXZlbnQuaXNIYW5kbGVkQnlMaXN0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3VwZXIub25Eb3VibGVDbGljayhlKTtcblx0fVxuXG5cdC8vIHRvIG1ha2Ugc3VyZSBkb20gZm9jdXMgaXMgbm90IHN0b2xlbiAoZm9yIGV4YW1wbGUgd2l0aCBjb250ZXh0IG1lbnUpXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbk1vdXNlRG93bihlOiBJTGlzdE1vdXNlRXZlbnQ8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4gfCBJTGlzdFRvdWNoRXZlbnQ8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4pOiB2b2lkIHtcblx0XHRjb25zdCB0YXJnZXQgPSBlLmJyb3dzZXJFdmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0aWYgKCFpc1N0aWNreVNjcm9sbENvbnRhaW5lcih0YXJnZXQpICYmICFpc1N0aWNreVNjcm9sbEVsZW1lbnQodGFyZ2V0KSkge1xuXHRcdFx0c3VwZXIub25Nb3VzZURvd24oZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIG9uQ29udGV4dE1lbnUoZTogSUxpc3RDb250ZXh0TWVudUV2ZW50PElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4+KTogdm9pZCB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZS5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuXHRcdGlmICghaXNTdGlja3lTY3JvbGxDb250YWluZXIodGFyZ2V0KSAmJiAhaXNTdGlja3lTY3JvbGxFbGVtZW50KHRhcmdldCkpIHtcblx0XHRcdHN1cGVyLm9uQ29udGV4dE1lbnUoZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG59XG5cbmludGVyZmFjZSBJVHJlZU5vZGVMaXN0T3B0aW9uczxULCBURmlsdGVyRGF0YSwgVFJlZj4gZXh0ZW5kcyBJTGlzdE9wdGlvbnM8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4ge1xuXHRyZWFkb25seSB0cmVlOiBBYnN0cmFjdFRyZWU8VCwgVEZpbHRlckRhdGEsIFRSZWY+O1xuXHRyZWFkb25seSBzdGlja3lTY3JvbGxQcm92aWRlcjogKCkgPT4gU3RpY2t5U2Nyb2xsQ29udHJvbGxlcjxULCBURmlsdGVyRGF0YSwgVFJlZj4gfCB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogV2UgdXNlIHRoaXMgTGlzdCBzdWJjbGFzcyB0byByZXN0b3JlIHNlbGVjdGlvbiBhbmQgZm9jdXMgYXMgbm9kZXNcbiAqIGdldCByZW5kZXJlZCBpbiB0aGUgbGlzdCwgcG9zc2libHkgZHVlIHRvIGEgbm9kZSBleHBhbmQoKSBjYWxsLlxuICovXG5jbGFzcyBUcmVlTm9kZUxpc3Q8VCwgVEZpbHRlckRhdGEsIFRSZWY+IGV4dGVuZHMgTGlzdDxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+PiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0dXNlcjogc3RyaW5nLFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0dmlydHVhbERlbGVnYXRlOiBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+Pixcblx0XHRyZW5kZXJlcnM6IElMaXN0UmVuZGVyZXI8YW55IC8qIFRPRE9Aam9hbyAqLywgYW55PltdLFxuXHRcdHByaXZhdGUgZm9jdXNUcmFpdDogVHJhaXQ8VD4sXG5cdFx0cHJpdmF0ZSBzZWxlY3Rpb25UcmFpdDogVHJhaXQ8VD4sXG5cdFx0cHJpdmF0ZSBhbmNob3JUcmFpdDogVHJhaXQ8VD4sXG5cdFx0b3B0aW9uczogSVRyZWVOb2RlTGlzdE9wdGlvbnM8VCwgVEZpbHRlckRhdGEsIFRSZWY+XG5cdCkge1xuXHRcdHN1cGVyKHVzZXIsIGNvbnRhaW5lciwgdmlydHVhbERlbGVnYXRlLCByZW5kZXJlcnMsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGNyZWF0ZU1vdXNlQ29udHJvbGxlcihvcHRpb25zOiBJVHJlZU5vZGVMaXN0T3B0aW9uczxULCBURmlsdGVyRGF0YSwgVFJlZj4pOiBNb3VzZUNvbnRyb2xsZXI8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4ge1xuXHRcdHJldHVybiBuZXcgVHJlZU5vZGVMaXN0TW91c2VDb250cm9sbGVyKHRoaXMsIG9wdGlvbnMudHJlZSwgb3B0aW9ucy5zdGlja3lTY3JvbGxQcm92aWRlcik7XG5cdH1cblxuXHRvdmVycmlkZSBzcGxpY2Uoc3RhcnQ6IG51bWJlciwgZGVsZXRlQ291bnQ6IG51bWJlciwgZWxlbWVudHM6IHJlYWRvbmx5IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT5bXSA9IFtdKTogdm9pZCB7XG5cdFx0c3VwZXIuc3BsaWNlKHN0YXJ0LCBkZWxldGVDb3VudCwgZWxlbWVudHMpO1xuXG5cdFx0aWYgKGVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFkZGl0aW9uYWxGb2N1czogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCBhZGRpdGlvbmFsU2VsZWN0aW9uOiBudW1iZXJbXSA9IFtdO1xuXHRcdGxldCBhbmNob3I6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRcdGVsZW1lbnRzLmZvckVhY2goKG5vZGUsIGluZGV4KSA9PiB7XG5cdFx0XHRpZiAodGhpcy5mb2N1c1RyYWl0Lmhhcyhub2RlKSkge1xuXHRcdFx0XHRhZGRpdGlvbmFsRm9jdXMucHVzaChzdGFydCArIGluZGV4KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuc2VsZWN0aW9uVHJhaXQuaGFzKG5vZGUpKSB7XG5cdFx0XHRcdGFkZGl0aW9uYWxTZWxlY3Rpb24ucHVzaChzdGFydCArIGluZGV4KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuYW5jaG9yVHJhaXQuaGFzKG5vZGUpKSB7XG5cdFx0XHRcdGFuY2hvciA9IHN0YXJ0ICsgaW5kZXg7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAoYWRkaXRpb25hbEZvY3VzLmxlbmd0aCA+IDApIHtcblx0XHRcdHN1cGVyLnNldEZvY3VzKGRpc3RpbmN0KFsuLi5zdXBlci5nZXRGb2N1cygpLCAuLi5hZGRpdGlvbmFsRm9jdXNdKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGFkZGl0aW9uYWxTZWxlY3Rpb24ubGVuZ3RoID4gMCkge1xuXHRcdFx0c3VwZXIuc2V0U2VsZWN0aW9uKGRpc3RpbmN0KFsuLi5zdXBlci5nZXRTZWxlY3Rpb24oKSwgLi4uYWRkaXRpb25hbFNlbGVjdGlvbl0pKTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGFuY2hvciA9PT0gJ251bWJlcicpIHtcblx0XHRcdHN1cGVyLnNldEFuY2hvcihhbmNob3IpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIHNldEZvY3VzKGluZGV4ZXM6IG51bWJlcltdLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50LCBmcm9tQVBJID0gZmFsc2UpOiB2b2lkIHtcblx0XHRzdXBlci5zZXRGb2N1cyhpbmRleGVzLCBicm93c2VyRXZlbnQpO1xuXG5cdFx0aWYgKCFmcm9tQVBJKSB7XG5cdFx0XHR0aGlzLmZvY3VzVHJhaXQuc2V0KGluZGV4ZXMubWFwKGkgPT4gdGhpcy5lbGVtZW50KGkpKSwgYnJvd3NlckV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBzZXRTZWxlY3Rpb24oaW5kZXhlczogbnVtYmVyW10sIGJyb3dzZXJFdmVudD86IFVJRXZlbnQsIGZyb21BUEkgPSBmYWxzZSk6IHZvaWQge1xuXHRcdHN1cGVyLnNldFNlbGVjdGlvbihpbmRleGVzLCBicm93c2VyRXZlbnQpO1xuXG5cdFx0aWYgKCFmcm9tQVBJKSB7XG5cdFx0XHR0aGlzLnNlbGVjdGlvblRyYWl0LnNldChpbmRleGVzLm1hcChpID0+IHRoaXMuZWxlbWVudChpKSksIGJyb3dzZXJFdmVudCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgc2V0QW5jaG9yKGluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQsIGZyb21BUEkgPSBmYWxzZSk6IHZvaWQge1xuXHRcdHN1cGVyLnNldEFuY2hvcihpbmRleCk7XG5cblx0XHRpZiAoIWZyb21BUEkpIHtcblx0XHRcdGlmICh0eXBlb2YgaW5kZXggPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdHRoaXMuYW5jaG9yVHJhaXQuc2V0KFtdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuYW5jaG9yVHJhaXQuc2V0KFt0aGlzLmVsZW1lbnQoaW5kZXgpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEFic3RyYWN0VHJlZVBhcnQge1xuXHRUcmVlLFxuXHRTdGlja3lTY3JvbGwsXG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFRyZWU8VCwgVEZpbHRlckRhdGEsIFRSZWY+IGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByb3RlY3RlZCB2aWV3OiBUcmVlTm9kZUxpc3Q8VCwgVEZpbHRlckRhdGEsIFRSZWY+O1xuXHRwcml2YXRlIHJlbmRlcmVyczogVHJlZVJlbmRlcmVyPFQsIFRGaWx0ZXJEYXRhLCBUUmVmLCBhbnk+W107XG5cdHByb3RlY3RlZCBtb2RlbDogSVRyZWVNb2RlbDxULCBURmlsdGVyRGF0YSwgVFJlZj47XG5cdHByaXZhdGUgdHJlZURlbGVnYXRlOiBDb21wb3NlZFRyZWVEZWxlZ2F0ZTxULCBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+Pjtcblx0cHJpdmF0ZSBmb2N1czogVHJhaXQ8VD47XG5cdHByaXZhdGUgc2VsZWN0aW9uOiBUcmFpdDxUPjtcblx0cHJpdmF0ZSBhbmNob3I6IFRyYWl0PFQ+O1xuXHRwcml2YXRlIGV2ZW50QnVmZmVyZXIgPSBuZXcgRXZlbnRCdWZmZXJlcigpO1xuXHRwcml2YXRlIGZpbmRDb250cm9sbGVyPzogRmluZENvbnRyb2xsZXI8VCwgVEZpbHRlckRhdGE+O1xuXHRwcml2YXRlIGZpbmRGaWx0ZXI/OiBGaW5kRmlsdGVyPFQ+O1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbmRPcGVuU3RhdGU6IEV2ZW50PGJvb2xlYW4+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRDaGFuZ2VTdGlja3lTY3JvbGxGb2N1c2VkOiBFdmVudDxib29sZWFuPiA9IEV2ZW50Lk5vbmU7XG5cdHByaXZhdGUgZm9jdXNOYXZpZ2F0aW9uRmlsdGVyOiAoKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pID0+IGJvb2xlYW4pIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHN0aWNreVNjcm9sbENvbnRyb2xsZXI/OiBTdGlja3lTY3JvbGxDb250cm9sbGVyPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPjtcblx0cHJpdmF0ZSBzdHlsZUVsZW1lbnQ6IEhUTUxTdHlsZUVsZW1lbnQ7XG5cdHByb3RlY3RlZCByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRnZXQgb25EaWRTY3JvbGwoKTogRXZlbnQ8U2Nyb2xsRXZlbnQ+IHsgcmV0dXJuIHRoaXMudmlldy5vbkRpZFNjcm9sbDsgfVxuXG5cdGdldCBvbkRpZENoYW5nZUZvY3VzKCk6IEV2ZW50PElUcmVlRXZlbnQ8VD4+IHsgcmV0dXJuIHRoaXMuZXZlbnRCdWZmZXJlci53cmFwRXZlbnQodGhpcy5mb2N1cy5vbkRpZENoYW5nZSk7IH1cblx0Z2V0IG9uRGlkQ2hhbmdlU2VsZWN0aW9uKCk6IEV2ZW50PElUcmVlRXZlbnQ8VD4+IHsgcmV0dXJuIHRoaXMuZXZlbnRCdWZmZXJlci53cmFwRXZlbnQodGhpcy5zZWxlY3Rpb24ub25EaWRDaGFuZ2UpOyB9XG5cblx0Z2V0IG9uTW91c2VDbGljaygpOiBFdmVudDxJVHJlZU1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIEV2ZW50Lm1hcCh0aGlzLnZpZXcub25Nb3VzZUNsaWNrLCBhc1RyZWVNb3VzZUV2ZW50KTsgfVxuXHRnZXQgb25Nb3VzZURibENsaWNrKCk6IEV2ZW50PElUcmVlTW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQuZmlsdGVyKEV2ZW50Lm1hcCh0aGlzLnZpZXcub25Nb3VzZURibENsaWNrLCBhc1RyZWVNb3VzZUV2ZW50KSwgZSA9PiBlLnRhcmdldCAhPT0gVHJlZU1vdXNlRXZlbnRUYXJnZXQuRmlsdGVyKTsgfVxuXHRnZXQgb25Nb3VzZU92ZXIoKTogRXZlbnQ8SVRyZWVNb3VzZUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5tYXAodGhpcy52aWV3Lm9uTW91c2VPdmVyLCBhc1RyZWVNb3VzZUV2ZW50KTsgfVxuXHRnZXQgb25Nb3VzZU91dCgpOiBFdmVudDxJVHJlZU1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIEV2ZW50Lm1hcCh0aGlzLnZpZXcub25Nb3VzZU91dCwgYXNUcmVlTW91c2VFdmVudCk7IH1cblx0Z2V0IG9uQ29udGV4dE1lbnUoKTogRXZlbnQ8SVRyZWVDb250ZXh0TWVudUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5hbnkoRXZlbnQuZmlsdGVyKEV2ZW50Lm1hcCh0aGlzLnZpZXcub25Db250ZXh0TWVudSwgYXNUcmVlQ29udGV4dE1lbnVFdmVudCksIGUgPT4gIWUuaXNTdGlja3lTY3JvbGwpLCB0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXI/Lm9uQ29udGV4dE1lbnUgPz8gRXZlbnQuTm9uZSk7IH1cblx0Z2V0IG9uVGFwKCk6IEV2ZW50PElUcmVlTW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMudmlldy5vblRhcCwgYXNUcmVlTW91c2VFdmVudCk7IH1cblx0Z2V0IG9uUG9pbnRlcigpOiBFdmVudDxJVHJlZU1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIEV2ZW50Lm1hcCh0aGlzLnZpZXcub25Qb2ludGVyLCBhc1RyZWVNb3VzZUV2ZW50KTsgfVxuXG5cdGdldCBvbktleURvd24oKTogRXZlbnQ8S2V5Ym9hcmRFdmVudD4geyByZXR1cm4gdGhpcy52aWV3Lm9uS2V5RG93bjsgfVxuXHRnZXQgb25LZXlVcCgpOiBFdmVudDxLZXlib2FyZEV2ZW50PiB7IHJldHVybiB0aGlzLnZpZXcub25LZXlVcDsgfVxuXHRnZXQgb25LZXlQcmVzcygpOiBFdmVudDxLZXlib2FyZEV2ZW50PiB7IHJldHVybiB0aGlzLnZpZXcub25LZXlQcmVzczsgfVxuXG5cdGdldCBvbkRpZEZvY3VzKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIHRoaXMudmlldy5vbkRpZEZvY3VzOyB9XG5cdGdldCBvbkRpZEJsdXIoKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy52aWV3Lm9uRGlkQmx1cjsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRTd2FwTW9kZWwgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZENoYW5nZU1vZGVsUmVsYXkgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgUmVsYXk8dm9pZD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRTcGxpY2VNb2RlbFJlbGF5ID0gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IFJlbGF5PElUcmVlTW9kZWxTcGxpY2VFdmVudDxULCBURmlsdGVyRGF0YT4+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZVJlbGF5ID0gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IFJlbGF5PElDb2xsYXBzZVN0YXRlQ2hhbmdlRXZlbnQ8VCwgVEZpbHRlckRhdGE+PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZENoYW5nZVJlbmRlck5vZGVDb3VudFJlbGF5ID0gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IFJlbGF5PElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkQ2hhbmdlQWN0aXZlTm9kZXNSZWxheSA9IHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBSZWxheTxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+W10+KCkpO1xuXG5cdGdldCBvbkRpZENoYW5nZU1vZGVsKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIEV2ZW50LmFueSh0aGlzLm9uRGlkQ2hhbmdlTW9kZWxSZWxheS5ldmVudCwgdGhpcy5vbkRpZFN3YXBNb2RlbC5ldmVudCk7IH1cblx0Z2V0IG9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZSgpOiBFdmVudDxJQ29sbGFwc2VTdGF0ZUNoYW5nZUV2ZW50PFQsIFRGaWx0ZXJEYXRhPj4geyByZXR1cm4gdGhpcy5vbkRpZENoYW5nZUNvbGxhcHNlU3RhdGVSZWxheS5ldmVudDsgfVxuXHRnZXQgb25EaWRDaGFuZ2VSZW5kZXJOb2RlQ291bnQoKTogRXZlbnQ8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPj4geyByZXR1cm4gdGhpcy5vbkRpZENoYW5nZVJlbmRlck5vZGVDb3VudFJlbGF5LmV2ZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsUmVmaWx0ZXIgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbldpbGxSZWZpbHRlcjogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbldpbGxSZWZpbHRlci5ldmVudDtcblxuXHRnZXQgZmluZE1vZGUoKTogVHJlZUZpbmRNb2RlIHsgcmV0dXJuIHRoaXMuZmluZENvbnRyb2xsZXI/Lm1vZGUgPz8gVHJlZUZpbmRNb2RlLkhpZ2hsaWdodDsgfVxuXHRzZXQgZmluZE1vZGUoZmluZE1vZGU6IFRyZWVGaW5kTW9kZSkgeyBpZiAodGhpcy5maW5kQ29udHJvbGxlcikgeyB0aGlzLmZpbmRDb250cm9sbGVyLm1vZGUgPSBmaW5kTW9kZTsgfSB9XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRmluZE1vZGU6IEV2ZW50PFRyZWVGaW5kTW9kZT47XG5cblx0Z2V0IGZpbmRNYXRjaFR5cGUoKTogVHJlZUZpbmRNYXRjaFR5cGUgeyByZXR1cm4gdGhpcy5maW5kQ29udHJvbGxlcj8ubWF0Y2hUeXBlID8/IFRyZWVGaW5kTWF0Y2hUeXBlLkZ1enp5OyB9XG5cdHNldCBmaW5kTWF0Y2hUeXBlKGZpbmRGdXp6eTogVHJlZUZpbmRNYXRjaFR5cGUpIHsgaWYgKHRoaXMuZmluZENvbnRyb2xsZXIpIHsgdGhpcy5maW5kQ29udHJvbGxlci5tYXRjaFR5cGUgPSBmaW5kRnV6enk7IH0gfVxuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbmRNYXRjaFR5cGU6IEV2ZW50PFRyZWVGaW5kTWF0Y2hUeXBlPjtcblxuXHRnZXQgb25EaWRDaGFuZ2VGaW5kUGF0dGVybigpOiBFdmVudDxzdHJpbmc+IHsgcmV0dXJuIHRoaXMuZmluZENvbnRyb2xsZXIgPyB0aGlzLmZpbmRDb250cm9sbGVyLm9uRGlkQ2hhbmdlUGF0dGVybiA6IEV2ZW50Lk5vbmU7IH1cblxuXHRnZXQgZXhwYW5kT25Eb3VibGVDbGljaygpOiBib29sZWFuIHsgcmV0dXJuIHR5cGVvZiB0aGlzLl9vcHRpb25zLmV4cGFuZE9uRG91YmxlQ2xpY2sgPT09ICd1bmRlZmluZWQnID8gdHJ1ZSA6IHRoaXMuX29wdGlvbnMuZXhwYW5kT25Eb3VibGVDbGljazsgfVxuXHRnZXQgZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrKCk6IGJvb2xlYW4gfCAoKGU6IFQpID0+IGJvb2xlYW4pIHsgcmV0dXJuIHR5cGVvZiB0aGlzLl9vcHRpb25zLmV4cGFuZE9ubHlPblR3aXN0aWVDbGljayA9PT0gJ3VuZGVmaW5lZCcgPyB0cnVlIDogdGhpcy5fb3B0aW9ucy5leHBhbmRPbmx5T25Ud2lzdGllQ2xpY2s7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFVwZGF0ZU9wdGlvbnMgPSBuZXcgRW1pdHRlcjxJQWJzdHJhY3RUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4+KCk7XG5cdHJlYWRvbmx5IG9uRGlkVXBkYXRlT3B0aW9uczogRXZlbnQ8SUFic3RyYWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+PiA9IHRoaXMuX29uRGlkVXBkYXRlT3B0aW9ucy5ldmVudDtcblxuXHRnZXQgb25EaWREaXNwb3NlKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIHRoaXMudmlldy5vbkRpZERpc3Bvc2U7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF91c2VyOiBzdHJpbmcsXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRkZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VD4sXG5cdFx0cmVuZGVyZXJzOiBJVHJlZVJlbmRlcmVyPFQsIFRGaWx0ZXJEYXRhLCBhbnk+W10sXG5cdFx0cHJpdmF0ZSBfb3B0aW9uczogSUFic3RyYWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+ID0ge31cblx0KSB7XG5cdFx0aWYgKF9vcHRpb25zLmtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIgJiYgKF9vcHRpb25zLmZpbmRXaWRnZXRFbmFibGVkID8/IHRydWUpKSB7XG5cdFx0XHR0aGlzLmZpbmRGaWx0ZXIgPSBuZXcgRmluZEZpbHRlcihfb3B0aW9ucy5rZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyLCBfb3B0aW9ucy5maWx0ZXIgYXMgSVRyZWVGaWx0ZXI8VCwgRnV6enlTY29yZT4sIF9vcHRpb25zLmRlZmF1bHRGaW5kVmlzaWJpbGl0eSk7XG5cdFx0XHRfb3B0aW9ucyA9IHsgLi4uX29wdGlvbnMsIGZpbHRlcjogdGhpcy5maW5kRmlsdGVyIGFzIElUcmVlRmlsdGVyPFQsIFRGaWx0ZXJEYXRhPiB9OyAvLyBUT0RPIG5lZWQgdHlwZXNjcmlwdCBoZWxwIGhlcmVcblx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuZmluZEZpbHRlcik7XG5cdFx0fVxuXG5cdFx0dGhpcy5tb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwoX3VzZXIsIF9vcHRpb25zKTtcblx0XHR0aGlzLnRyZWVEZWxlZ2F0ZSA9IG5ldyBDb21wb3NlZFRyZWVEZWxlZ2F0ZTxULCBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+PihkZWxlZ2F0ZSk7XG5cblx0XHRjb25zdCBhY3RpdmVOb2RlcyA9IHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBFdmVudENvbGxlY3Rpb24odGhpcy5vbkRpZENoYW5nZUFjdGl2ZU5vZGVzUmVsYXkuZXZlbnQpKTtcblx0XHRjb25zdCByZW5kZXJlZEluZGVudEd1aWRlcyA9IG5ldyBTZXRNYXA8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPiwgSFRNTERpdkVsZW1lbnQ+KCk7XG5cdFx0dGhpcy5yZW5kZXJlcnMgPSByZW5kZXJlcnMubWFwKHIgPT4gbmV3IFRyZWVSZW5kZXJlcjxULCBURmlsdGVyRGF0YSwgVFJlZiwgYW55PihyLCB0aGlzLm1vZGVsLCB0aGlzLm9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZVJlbGF5LmV2ZW50LCBhY3RpdmVOb2RlcywgcmVuZGVyZWRJbmRlbnRHdWlkZXMsIF9vcHRpb25zKSk7XG5cdFx0Zm9yIChjb25zdCByIG9mIHRoaXMucmVuZGVyZXJzKSB7XG5cdFx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChyKTtcblx0XHR9XG5cblx0XHR0aGlzLmZvY3VzID0gbmV3IFRyYWl0KCgpID0+IHRoaXMudmlldy5nZXRGb2N1c2VkRWxlbWVudHMoKVswXSwgX29wdGlvbnMuaWRlbnRpdHlQcm92aWRlcik7XG5cdFx0dGhpcy5zZWxlY3Rpb24gPSBuZXcgVHJhaXQoKCkgPT4gdGhpcy52aWV3LmdldFNlbGVjdGVkRWxlbWVudHMoKVswXSwgX29wdGlvbnMuaWRlbnRpdHlQcm92aWRlcik7XG5cdFx0dGhpcy5hbmNob3IgPSBuZXcgVHJhaXQoKCkgPT4gdGhpcy52aWV3LmdldEFuY2hvckVsZW1lbnQoKSwgX29wdGlvbnMuaWRlbnRpdHlQcm92aWRlcik7XG5cdFx0dGhpcy52aWV3ID0gbmV3IFRyZWVOb2RlTGlzdChfdXNlciwgY29udGFpbmVyLCB0aGlzLnRyZWVEZWxlZ2F0ZSwgdGhpcy5yZW5kZXJlcnMsIHRoaXMuZm9jdXMsIHRoaXMuc2VsZWN0aW9uLCB0aGlzLmFuY2hvciwgeyAuLi5hc0xpc3RPcHRpb25zKCgpID0+IHRoaXMubW9kZWwsIHRoaXMuZGlzcG9zYWJsZXMsIF9vcHRpb25zKSwgdHJlZTogdGhpcywgc3RpY2t5U2Nyb2xsUHJvdmlkZXI6ICgpID0+IHRoaXMuc3RpY2t5U2Nyb2xsQ29udHJvbGxlciB9KTtcblxuXHRcdHRoaXMuc2V0dXBNb2RlbCh0aGlzLm1vZGVsKTsgLy8gbW9kZWwgbmVlZHMgdG8gYmUgc2V0dXAgYWZ0ZXIgdGhlIHRyYWl0cyBoYXZlIGJlZW4gY3JlYXRlZFxuXG5cdFx0aWYgKF9vcHRpb25zLmtleWJvYXJkU3VwcG9ydCAhPT0gZmFsc2UpIHtcblx0XHRcdGNvbnN0IG9uS2V5RG93biA9IEV2ZW50LmNoYWluKHRoaXMudmlldy5vbktleURvd24sICQgPT5cblx0XHRcdFx0JC5maWx0ZXIoZSA9PiAhaXNFZGl0YWJsZUVsZW1lbnQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpKVxuXHRcdFx0XHRcdC5tYXAoZSA9PiBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpKVxuXHRcdFx0KTtcblxuXHRcdFx0RXZlbnQuY2hhaW4ob25LZXlEb3duLCAkID0+ICQuZmlsdGVyKGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLkxlZnRBcnJvdykpKHRoaXMub25MZWZ0QXJyb3csIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdFx0RXZlbnQuY2hhaW4ob25LZXlEb3duLCAkID0+ICQuZmlsdGVyKGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLlJpZ2h0QXJyb3cpKSh0aGlzLm9uUmlnaHRBcnJvdywgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0XHRFdmVudC5jaGFpbihvbktleURvd24sICQgPT4gJC5maWx0ZXIoZSA9PiBlLmtleUNvZGUgPT09IEtleUNvZGUuU3BhY2UpKSh0aGlzLm9uU3BhY2UsIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdH1cblxuXHRcdGlmICgoX29wdGlvbnMuZmluZFdpZGdldEVuYWJsZWQgPz8gdHJ1ZSkgJiYgX29wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciAmJiBfb3B0aW9ucy5jb250ZXh0Vmlld1Byb3ZpZGVyKSB7XG5cdFx0XHRjb25zdCBmaW5kT3B0aW9uczogSUZpbmRDb250cm9sbGVyT3B0aW9ucyA9IHtcblx0XHRcdFx0c3R5bGVzOiBfb3B0aW9ucy5maW5kV2lkZ2V0U3R5bGVzLFxuXHRcdFx0XHRkZWZhdWx0RmluZE1vZGU6IF9vcHRpb25zLmRlZmF1bHRGaW5kTW9kZSxcblx0XHRcdFx0ZGVmYXVsdEZpbmRNYXRjaFR5cGU6IF9vcHRpb25zLmRlZmF1bHRGaW5kTWF0Y2hUeXBlLFxuXHRcdFx0XHRzaG93Tm90Rm91bmRNZXNzYWdlOiBfb3B0aW9ucy5zaG93Tm90Rm91bmRNZXNzYWdlLFxuXHRcdFx0fTtcblx0XHRcdHRoaXMuZmluZENvbnRyb2xsZXIgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRmluZENvbnRyb2xsZXIodGhpcywgdGhpcy5maW5kRmlsdGVyISwgX29wdGlvbnMuY29udGV4dFZpZXdQcm92aWRlciwgZmluZE9wdGlvbnMpKTtcblx0XHRcdHRoaXMuZm9jdXNOYXZpZ2F0aW9uRmlsdGVyID0gbm9kZSA9PiB0aGlzLmZpbmRDb250cm9sbGVyIS5zaG91bGRBbGxvd0ZvY3VzKG5vZGUpO1xuXHRcdFx0dGhpcy5vbkRpZENoYW5nZUZpbmRPcGVuU3RhdGUgPSB0aGlzLmZpbmRDb250cm9sbGVyLm9uRGlkQ2hhbmdlT3BlblN0YXRlO1xuXHRcdFx0dGhpcy5vbkRpZENoYW5nZUZpbmRNb2RlID0gdGhpcy5maW5kQ29udHJvbGxlci5vbkRpZENoYW5nZU1vZGU7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRmluZE1hdGNoVHlwZSA9IHRoaXMuZmluZENvbnRyb2xsZXIub25EaWRDaGFuZ2VNYXRjaFR5cGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMub25EaWRDaGFuZ2VGaW5kTW9kZSA9IEV2ZW50Lk5vbmU7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRmluZE1hdGNoVHlwZSA9IEV2ZW50Lk5vbmU7XG5cdFx0fVxuXG5cdFx0aWYgKF9vcHRpb25zLmVuYWJsZVN0aWNreVNjcm9sbCkge1xuXHRcdFx0dGhpcy5zdGlja3lTY3JvbGxDb250cm9sbGVyID0gbmV3IFN0aWNreVNjcm9sbENvbnRyb2xsZXIodGhpcywgdGhpcy5tb2RlbCwgdGhpcy52aWV3LCB0aGlzLnJlbmRlcmVycywgdGhpcy50cmVlRGVsZWdhdGUsIF9vcHRpb25zKTtcblx0XHRcdHRoaXMub25EaWRDaGFuZ2VTdGlja3lTY3JvbGxGb2N1c2VkID0gdGhpcy5zdGlja3lTY3JvbGxDb250cm9sbGVyLm9uRGlkQ2hhbmdlSGFzRm9jdXM7XG5cdFx0fVxuXG5cdFx0dGhpcy5zdHlsZUVsZW1lbnQgPSBjcmVhdGVTdHlsZVNoZWV0KHRoaXMudmlldy5nZXRIVE1MRWxlbWVudCgpKTtcblx0XHR0aGlzLmdldEhUTUxFbGVtZW50KCkuY2xhc3NMaXN0LnRvZ2dsZSgnYWx3YXlzJywgdGhpcy5fb3B0aW9ucy5yZW5kZXJJbmRlbnRHdWlkZXMgPT09IFJlbmRlckluZGVudEd1aWRlcy5BbHdheXMpO1xuXHR9XG5cblx0dXBkYXRlT3B0aW9ucyhvcHRpb25zVXBkYXRlOiBJQWJzdHJhY3RUcmVlT3B0aW9uc1VwZGF0ZSA9IHt9KTogdm9pZCB7XG5cdFx0dGhpcy5fb3B0aW9ucyA9IHsgLi4udGhpcy5fb3B0aW9ucywgLi4ub3B0aW9uc1VwZGF0ZSB9O1xuXG5cdFx0Zm9yIChjb25zdCByZW5kZXJlciBvZiB0aGlzLnJlbmRlcmVycykge1xuXHRcdFx0cmVuZGVyZXIudXBkYXRlT3B0aW9ucyhvcHRpb25zVXBkYXRlKTtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXcudXBkYXRlT3B0aW9ucyh0aGlzLl9vcHRpb25zKTtcblx0XHR0aGlzLmZpbmRDb250cm9sbGVyPy51cGRhdGVPcHRpb25zKG9wdGlvbnNVcGRhdGUpO1xuXHRcdHRoaXMudXBkYXRlU3RpY2t5U2Nyb2xsKG9wdGlvbnNVcGRhdGUpO1xuXG5cdFx0dGhpcy5fb25EaWRVcGRhdGVPcHRpb25zLmZpcmUodGhpcy5fb3B0aW9ucyk7XG5cblx0XHR0aGlzLmdldEhUTUxFbGVtZW50KCkuY2xhc3NMaXN0LnRvZ2dsZSgnYWx3YXlzJywgdGhpcy5fb3B0aW9ucy5yZW5kZXJJbmRlbnRHdWlkZXMgPT09IFJlbmRlckluZGVudEd1aWRlcy5BbHdheXMpO1xuXHR9XG5cblx0Z2V0IG9wdGlvbnMoKTogSUFic3RyYWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IHtcblx0XHRyZXR1cm4gdGhpcy5fb3B0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU3RpY2t5U2Nyb2xsKG9wdGlvbnNVcGRhdGU6IElBYnN0cmFjdFRyZWVPcHRpb25zVXBkYXRlKSB7XG5cdFx0aWYgKCF0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXIgJiYgdGhpcy5fb3B0aW9ucy5lbmFibGVTdGlja3lTY3JvbGwpIHtcblx0XHRcdHRoaXMuc3RpY2t5U2Nyb2xsQ29udHJvbGxlciA9IG5ldyBTdGlja3lTY3JvbGxDb250cm9sbGVyKHRoaXMsIHRoaXMubW9kZWwsIHRoaXMudmlldywgdGhpcy5yZW5kZXJlcnMsIHRoaXMudHJlZURlbGVnYXRlLCB0aGlzLl9vcHRpb25zKTtcblx0XHRcdHRoaXMub25EaWRDaGFuZ2VTdGlja3lTY3JvbGxGb2N1c2VkID0gdGhpcy5zdGlja3lTY3JvbGxDb250cm9sbGVyLm9uRGlkQ2hhbmdlSGFzRm9jdXM7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXIgJiYgIXRoaXMuX29wdGlvbnMuZW5hYmxlU3RpY2t5U2Nyb2xsKSB7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlU3RpY2t5U2Nyb2xsRm9jdXNlZCA9IEV2ZW50Lk5vbmU7XG5cdFx0XHR0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5zdGlja3lTY3JvbGxDb250cm9sbGVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXI/LnVwZGF0ZU9wdGlvbnMob3B0aW9uc1VwZGF0ZSk7XG5cdH1cblxuXHR1cGRhdGVXaWR0aChlbGVtZW50OiBUUmVmKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLm1vZGVsLmdldExpc3RJbmRleChlbGVtZW50KTtcblxuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXcudXBkYXRlV2lkdGgoaW5kZXgpO1xuXHR9XG5cblx0Ly8gV2lkZ2V0XG5cblx0Z2V0SFRNTEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuZ2V0SFRNTEVsZW1lbnQoKTtcblx0fVxuXG5cdGdldCBjb250ZW50SGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudmlldy5jb250ZW50SGVpZ2h0O1xuXHR9XG5cblx0Z2V0IGNvbnRlbnRXaWR0aCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuY29udGVudFdpZHRoO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCgpOiBFdmVudDxudW1iZXI+IHtcblx0XHRyZXR1cm4gdGhpcy52aWV3Lm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodDtcblx0fVxuXG5cdGdldCBvbkRpZENoYW5nZUNvbnRlbnRXaWR0aCgpOiBFdmVudDxudW1iZXI+IHtcblx0XHRyZXR1cm4gdGhpcy52aWV3Lm9uRGlkQ2hhbmdlQ29udGVudFdpZHRoO1xuXHR9XG5cblx0Z2V0IHNjcm9sbFRvcCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuc2Nyb2xsVG9wO1xuXHR9XG5cblx0c2V0IHNjcm9sbFRvcChzY3JvbGxUb3A6IG51bWJlcikge1xuXHRcdHRoaXMudmlldy5zY3JvbGxUb3AgPSBzY3JvbGxUb3A7XG5cdH1cblxuXHRnZXQgc2Nyb2xsTGVmdCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuc2Nyb2xsTGVmdDtcblx0fVxuXG5cdHNldCBzY3JvbGxMZWZ0KHNjcm9sbExlZnQ6IG51bWJlcikge1xuXHRcdHRoaXMudmlldy5zY3JvbGxMZWZ0ID0gc2Nyb2xsTGVmdDtcblx0fVxuXG5cdGdldCBzY3JvbGxIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LnNjcm9sbEhlaWdodDtcblx0fVxuXG5cdGdldCByZW5kZXJIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LnJlbmRlckhlaWdodDtcblx0fVxuXG5cdGdldCBmaXJzdFZpc2libGVFbGVtZW50KCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGxldCBpbmRleCA9IHRoaXMudmlldy5maXJzdFZpc2libGVJbmRleDtcblxuXHRcdGlmICh0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXIpIHtcblx0XHRcdGluZGV4ICs9IHRoaXMuc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5jb3VudDtcblx0XHR9XG5cblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMudmlldy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9kZSA9IHRoaXMudmlldy5lbGVtZW50KGluZGV4KTtcblx0XHRyZXR1cm4gbm9kZS5lbGVtZW50O1xuXHR9XG5cblx0Z2V0IGxhc3RWaXNpYmxlRWxlbWVudCgpOiBUIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMudmlldy5sYXN0VmlzaWJsZUluZGV4O1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLnZpZXcuZWxlbWVudChpbmRleCk7XG5cdFx0cmV0dXJuIG5vZGUuZWxlbWVudDtcblx0fVxuXG5cdGdldCBhcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmFyaWFMYWJlbDtcblx0fVxuXG5cdHNldCBhcmlhTGFiZWwodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMudmlldy5hcmlhTGFiZWwgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBzZWxlY3Rpb25TaXplKCkge1xuXHRcdHJldHVybiB0aGlzLnNlbGVjdGlvbi5nZXROb2RlcygpLmxlbmd0aDtcblx0fVxuXG5cdGRvbUZvY3VzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXI/LmZvY3VzZWRMYXN0KCkpIHtcblx0XHRcdHRoaXMuc3RpY2t5U2Nyb2xsQ29udHJvbGxlci5kb21Gb2N1cygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnZpZXcuZG9tRm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRpc0RPTUZvY3VzZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlzQWN0aXZlRWxlbWVudCh0aGlzLmdldEhUTUxFbGVtZW50KCkpO1xuXHR9XG5cblx0bGF5b3V0KGhlaWdodD86IG51bWJlciwgd2lkdGg/OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXcubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0c3R5bGUoc3R5bGVzOiBJTGlzdFN0eWxlcyk6IHZvaWQge1xuXHRcdGNvbnN0IHN1ZmZpeCA9IGAuJHt0aGlzLnZpZXcuZG9tSWR9YDtcblx0XHRjb25zdCBjb250ZW50OiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0aWYgKHN0eWxlcy50cmVlSW5kZW50R3VpZGVzU3Ryb2tlKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpob3ZlciAubW9uYWNvLXRsLWluZGVudCA+IC5pbmRlbnQtZ3VpZGUsIC5tb25hY28tbGlzdCR7c3VmZml4fS5hbHdheXMgLm1vbmFjby10bC1pbmRlbnQgPiAuaW5kZW50LWd1aWRlICB7IGJvcmRlci1jb2xvcjogJHtzdHlsZXMudHJlZUluYWN0aXZlSW5kZW50R3VpZGVzU3Ryb2tlfTsgfWApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby10bC1pbmRlbnQgPiAuaW5kZW50LWd1aWRlLmFjdGl2ZSB7IGJvcmRlci1jb2xvcjogJHtzdHlsZXMudHJlZUluZGVudEd1aWRlc1N0cm9rZX07IH1gKTtcblx0XHR9XG5cblx0XHQvLyBTdGlja3kgU2Nyb2xsIEJhY2tncm91bmRcblx0XHRjb25zdCBzdGlja3lTY3JvbGxCYWNrZ3JvdW5kID0gc3R5bGVzLnRyZWVTdGlja3lTY3JvbGxCYWNrZ3JvdW5kID8/IHN0eWxlcy5saXN0QmFja2dyb3VuZDtcblx0XHRpZiAoc3RpY2t5U2Nyb2xsQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgLm1vbmFjby10cmVlLXN0aWNreS1jb250YWluZXIgeyBiYWNrZ3JvdW5kLWNvbG9yOiAke3N0aWNreVNjcm9sbEJhY2tncm91bmR9OyB9YCk7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fSAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCAubW9uYWNvLXRyZWUtc3RpY2t5LWNvbnRhaW5lciAubW9uYWNvLXRyZWUtc3RpY2t5LXJvdyB7IGJhY2tncm91bmQtY29sb3I6ICR7c3RpY2t5U2Nyb2xsQmFja2dyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHQvLyBTdGlja3kgU2Nyb2xsIEJvcmRlclxuXHRcdGlmIChzdHlsZXMudHJlZVN0aWNreVNjcm9sbEJvcmRlcikge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgLm1vbmFjby10cmVlLXN0aWNreS1jb250YWluZXIgeyBib3JkZXItYm90dG9tOiAxcHggc29saWQgJHtzdHlsZXMudHJlZVN0aWNreVNjcm9sbEJvcmRlcn07IH1gKTtcblx0XHR9XG5cblx0XHQvLyBTdGlja3kgU2Nyb2xsIFNoYWRvd1xuXHRcdGlmIChzdHlsZXMudHJlZVN0aWNreVNjcm9sbFNoYWRvdykge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgLm1vbmFjby10cmVlLXN0aWNreS1jb250YWluZXIgLm1vbmFjby10cmVlLXN0aWNreS1jb250YWluZXItc2hhZG93IHsgYm94LXNoYWRvdzogJHtzdHlsZXMudHJlZVN0aWNreVNjcm9sbFNoYWRvd30gMCA2cHggNnB4IC02cHggaW5zZXQ7IGhlaWdodDogM3B4OyB9YCk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RpY2t5IFNjcm9sbCBGb2N1c1xuXHRcdGlmIChzdHlsZXMubGlzdEZvY3VzRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0uc3RpY2t5LXNjcm9sbC1mb2N1c2VkIC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50IC5tb25hY28tdHJlZS1zdGlja3ktY29udGFpbmVyOmZvY3VzIC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCB7IGNvbG9yOiAke3N0eWxlcy5saXN0Rm9jdXNGb3JlZ3JvdW5kfTsgfWApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH06bm90KC5zdGlja3ktc2Nyb2xsLWZvY3VzZWQpIC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50IC5tb25hY28tdHJlZS1zdGlja3ktY29udGFpbmVyIC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCB7IGNvbG9yOiBpbmhlcml0OyB9YCk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RpY2t5IFNjcm9sbCBGb2N1cyBPdXRsaW5lc1xuXHRcdGNvbnN0IGZvY3VzQW5kU2VsZWN0aW9uT3V0bGluZSA9IGFzQ3NzVmFsdWVXaXRoRGVmYXVsdChzdHlsZXMubGlzdEZvY3VzQW5kU2VsZWN0aW9uT3V0bGluZSwgYXNDc3NWYWx1ZVdpdGhEZWZhdWx0KHN0eWxlcy5saXN0U2VsZWN0aW9uT3V0bGluZSwgc3R5bGVzLmxpc3RGb2N1c091dGxpbmUgPz8gJycpKTtcblx0XHRpZiAoZm9jdXNBbmRTZWxlY3Rpb25PdXRsaW5lKSB7IC8vIGRlZmF1bHQ6IGxpc3RGb2N1c091dGxpbmVcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9LnN0aWNreS1zY3JvbGwtZm9jdXNlZCAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCAubW9uYWNvLXRyZWUtc3RpY2t5LWNvbnRhaW5lcjpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQuc2VsZWN0ZWQgeyBvdXRsaW5lOiAxcHggc29saWQgJHtmb2N1c0FuZFNlbGVjdGlvbk91dGxpbmV9OyBvdXRsaW5lLW9mZnNldDogLTFweDt9YCk7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpub3QoLnN0aWNreS1zY3JvbGwtZm9jdXNlZCkgLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgLm1vbmFjby10cmVlLXN0aWNreS1jb250YWluZXIgLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkLnNlbGVjdGVkIHsgb3V0bGluZTogaW5oZXJpdDt9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0Rm9jdXNPdXRsaW5lKSB7IC8vIGRlZmF1bHQ6IHNldFxuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0uc3RpY2t5LXNjcm9sbC1mb2N1c2VkIC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50IC5tb25hY28tdHJlZS1zdGlja3ktY29udGFpbmVyOmZvY3VzIC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCB7IG91dGxpbmU6IDFweCBzb2xpZCAke3N0eWxlcy5saXN0Rm9jdXNPdXRsaW5lfTsgb3V0bGluZS1vZmZzZXQ6IC0xcHg7IH1gKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9Om5vdCguc3RpY2t5LXNjcm9sbC1mb2N1c2VkKSAubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCAubW9uYWNvLXRyZWUtc3RpY2t5LWNvbnRhaW5lciAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBvdXRsaW5lOiBpbmhlcml0OyB9YCk7XG5cblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby13b3JrYmVuY2guY29udGV4dC1tZW51LXZpc2libGUgLm1vbmFjby1saXN0JHtzdWZmaXh9Lmxhc3QtZm9jdXNlZC5zdGlja3ktc2Nyb2xsLWZvY3VzZWQgLm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgLm1vbmFjby10cmVlLXN0aWNreS1jb250YWluZXIgLm1vbmFjby1saXN0LXJvdy5wYXNzaXZlLWZvY3VzZWQgeyBvdXRsaW5lOiAxcHggc29saWQgJHtzdHlsZXMubGlzdEZvY3VzT3V0bGluZX07IG91dGxpbmUtb2Zmc2V0OiAtMXB4OyB9YCk7XG5cblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby13b3JrYmVuY2guY29udGV4dC1tZW51LXZpc2libGUgLm1vbmFjby1saXN0JHtzdWZmaXh9Lmxhc3QtZm9jdXNlZC5zdGlja3ktc2Nyb2xsLWZvY3VzZWQgLm1vbmFjby1saXN0LXJvd3MgLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIHsgb3V0bGluZTogaW5oZXJpdDsgfWApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXdvcmtiZW5jaC5jb250ZXh0LW1lbnUtdmlzaWJsZSAubW9uYWNvLWxpc3Qke3N1ZmZpeH0ubGFzdC1mb2N1c2VkOm5vdCguc3RpY2t5LXNjcm9sbC1mb2N1c2VkKSAubW9uYWNvLXRyZWUtc3RpY2t5LWNvbnRhaW5lciAubW9uYWNvLWxpc3Qtcm93cyAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBvdXRsaW5lOiBpbmhlcml0OyB9YCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSBjb250ZW50LmpvaW4oJ1xcbicpO1xuXG5cdFx0dGhpcy52aWV3LnN0eWxlKHN0eWxlcyk7XG5cdH1cblxuXHQvLyBUcmVlIG5hdmlnYXRpb25cblxuXHRnZXRQYXJlbnRFbGVtZW50KGxvY2F0aW9uOiBUUmVmKTogVCB7XG5cdFx0Y29uc3QgcGFyZW50UmVmID0gdGhpcy5tb2RlbC5nZXRQYXJlbnROb2RlTG9jYXRpb24obG9jYXRpb24pO1xuXHRcdGNvbnN0IHBhcmVudE5vZGUgPSB0aGlzLm1vZGVsLmdldE5vZGUocGFyZW50UmVmKTtcblx0XHRyZXR1cm4gcGFyZW50Tm9kZS5lbGVtZW50O1xuXHR9XG5cblx0Z2V0Rmlyc3RFbGVtZW50Q2hpbGQobG9jYXRpb246IFRSZWYpOiBUIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXRGaXJzdEVsZW1lbnRDaGlsZChsb2NhdGlvbik7XG5cdH1cblxuXHQvLyBUcmVlXG5cblx0Z2V0Tm9kZShsb2NhdGlvbj86IFRSZWYpOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+IHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5nZXROb2RlKGxvY2F0aW9uKTtcblx0fVxuXG5cdGdldE5vZGVMb2NhdGlvbihub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KTogVFJlZiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuZ2V0Tm9kZUxvY2F0aW9uKG5vZGUpO1xuXHR9XG5cblx0Y29sbGFwc2UobG9jYXRpb246IFRSZWYsIHJlY3Vyc2l2ZTogYm9vbGVhbiA9IGZhbHNlKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuc2V0Q29sbGFwc2VkKGxvY2F0aW9uLCB0cnVlLCByZWN1cnNpdmUpO1xuXHR9XG5cblx0ZXhwYW5kKGxvY2F0aW9uOiBUUmVmLCByZWN1cnNpdmU6IGJvb2xlYW4gPSBmYWxzZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLnNldENvbGxhcHNlZChsb2NhdGlvbiwgZmFsc2UsIHJlY3Vyc2l2ZSk7XG5cdH1cblxuXHR0b2dnbGVDb2xsYXBzZWQobG9jYXRpb246IFRSZWYsIHJlY3Vyc2l2ZTogYm9vbGVhbiA9IGZhbHNlKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuc2V0Q29sbGFwc2VkKGxvY2F0aW9uLCB1bmRlZmluZWQsIHJlY3Vyc2l2ZSk7XG5cdH1cblxuXHRleHBhbmRBbGwoKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC5zZXRDb2xsYXBzZWQodGhpcy5tb2RlbC5yb290UmVmLCBmYWxzZSwgdHJ1ZSk7XG5cdH1cblxuXHRjb2xsYXBzZUFsbCgpOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLnNldENvbGxhcHNlZCh0aGlzLm1vZGVsLnJvb3RSZWYsIHRydWUsIHRydWUpO1xuXHR9XG5cblx0aXNDb2xsYXBzaWJsZShsb2NhdGlvbjogVFJlZik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmlzQ29sbGFwc2libGUobG9jYXRpb24pO1xuXHR9XG5cblx0c2V0Q29sbGFwc2libGUobG9jYXRpb246IFRSZWYsIGNvbGxhcHNpYmxlPzogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLnNldENvbGxhcHNpYmxlKGxvY2F0aW9uLCBjb2xsYXBzaWJsZSk7XG5cdH1cblxuXHRpc0NvbGxhcHNlZChsb2NhdGlvbjogVFJlZik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmlzQ29sbGFwc2VkKGxvY2F0aW9uKTtcblx0fVxuXG5cdGV4cGFuZFRvKGxvY2F0aW9uOiBUUmVmKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC5leHBhbmRUbyhsb2NhdGlvbik7XG5cdH1cblxuXHR0cmlnZ2VyVHlwZU5hdmlnYXRpb24oKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3LnRyaWdnZXJUeXBlTmF2aWdhdGlvbigpO1xuXHR9XG5cblx0b3BlbkZpbmQoKTogdm9pZCB7XG5cdFx0dGhpcy5maW5kQ29udHJvbGxlcj8ub3BlbigpO1xuXHR9XG5cblx0Y2xvc2VGaW5kKCk6IHZvaWQge1xuXHRcdHRoaXMuZmluZENvbnRyb2xsZXI/LmNsb3NlKCk7XG5cdH1cblxuXHRyZWZpbHRlcigpOiB2b2lkIHtcblx0XHR0aGlzLl9vbldpbGxSZWZpbHRlci5maXJlKHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5tb2RlbC5yZWZpbHRlcigpO1xuXHR9XG5cblx0c2V0QW5jaG9yKGVsZW1lbnQ6IFRSZWYgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIGVsZW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy52aWV3LnNldEFuY2hvcih1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdHRoaXMuZXZlbnRCdWZmZXJlci5idWZmZXJFdmVudHMoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgbm9kZSA9IHRoaXMubW9kZWwuZ2V0Tm9kZShlbGVtZW50KTtcblx0XHRcdHRoaXMuYW5jaG9yLnNldChbbm9kZV0pO1xuXG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMubW9kZWwuZ2V0TGlzdEluZGV4KGVsZW1lbnQpO1xuXG5cdFx0XHRpZiAoaW5kZXggPiAtMSkge1xuXHRcdFx0XHR0aGlzLnZpZXcuc2V0QW5jaG9yKGluZGV4LCB0cnVlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGdldEFuY2hvcigpOiBUIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5hbmNob3IuZ2V0KCkuYXQoMCk7XG5cdH1cblxuXHRzZXRTZWxlY3Rpb24oZWxlbWVudHM6IFRSZWZbXSwgYnJvd3NlckV2ZW50PzogVUlFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuZXZlbnRCdWZmZXJlci5idWZmZXJFdmVudHMoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgbm9kZXMgPSBlbGVtZW50cy5tYXAoZSA9PiB0aGlzLm1vZGVsLmdldE5vZGUoZSkpO1xuXHRcdFx0dGhpcy5zZWxlY3Rpb24uc2V0KG5vZGVzLCBicm93c2VyRXZlbnQpO1xuXG5cdFx0XHRjb25zdCBpbmRleGVzID0gZWxlbWVudHMubWFwKGUgPT4gdGhpcy5tb2RlbC5nZXRMaXN0SW5kZXgoZSkpLmZpbHRlcihpID0+IGkgPiAtMSk7XG5cdFx0XHR0aGlzLnZpZXcuc2V0U2VsZWN0aW9uKGluZGV4ZXMsIGJyb3dzZXJFdmVudCwgdHJ1ZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXRTZWxlY3Rpb24oKTogVFtdIHtcblx0XHRyZXR1cm4gdGhpcy5zZWxlY3Rpb24uZ2V0KCk7XG5cdH1cblxuXHRzZXRGb2N1cyhlbGVtZW50czogVFJlZltdLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5ldmVudEJ1ZmZlcmVyLmJ1ZmZlckV2ZW50cygoKSA9PiB7XG5cdFx0XHRjb25zdCBub2RlcyA9IGVsZW1lbnRzLm1hcChlID0+IHRoaXMubW9kZWwuZ2V0Tm9kZShlKSk7XG5cdFx0XHR0aGlzLmZvY3VzLnNldChub2RlcywgYnJvd3NlckV2ZW50KTtcblxuXHRcdFx0Y29uc3QgaW5kZXhlcyA9IGVsZW1lbnRzLm1hcChlID0+IHRoaXMubW9kZWwuZ2V0TGlzdEluZGV4KGUpKS5maWx0ZXIoaSA9PiBpID4gLTEpO1xuXHRcdFx0dGhpcy52aWV3LnNldEZvY3VzKGluZGV4ZXMsIGJyb3dzZXJFdmVudCwgdHJ1ZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRmb2N1c05leHQobiA9IDEsIGxvb3AgPSBmYWxzZSwgYnJvd3NlckV2ZW50PzogVUlFdmVudCwgZmlsdGVyOiAoKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pID0+IGJvb2xlYW4pIHwgdW5kZWZpbmVkID0gKGlzS2V5Ym9hcmRFdmVudChicm93c2VyRXZlbnQpICYmIGJyb3dzZXJFdmVudC5hbHRLZXkpID8gdW5kZWZpbmVkIDogdGhpcy5mb2N1c05hdmlnYXRpb25GaWx0ZXIpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXcuZm9jdXNOZXh0KG4sIGxvb3AsIGJyb3dzZXJFdmVudCwgZmlsdGVyKTtcblx0fVxuXG5cdGZvY3VzUHJldmlvdXMobiA9IDEsIGxvb3AgPSBmYWxzZSwgYnJvd3NlckV2ZW50PzogVUlFdmVudCwgZmlsdGVyOiAoKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pID0+IGJvb2xlYW4pIHwgdW5kZWZpbmVkID0gKGlzS2V5Ym9hcmRFdmVudChicm93c2VyRXZlbnQpICYmIGJyb3dzZXJFdmVudC5hbHRLZXkpID8gdW5kZWZpbmVkIDogdGhpcy5mb2N1c05hdmlnYXRpb25GaWx0ZXIpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXcuZm9jdXNQcmV2aW91cyhuLCBsb29wLCBicm93c2VyRXZlbnQsIGZpbHRlcik7XG5cdH1cblxuXHRmb2N1c05leHRQYWdlKGJyb3dzZXJFdmVudD86IFVJRXZlbnQsIGZpbHRlcjogKChub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KSA9PiBib29sZWFuKSB8IHVuZGVmaW5lZCA9IChpc0tleWJvYXJkRXZlbnQoYnJvd3NlckV2ZW50KSAmJiBicm93c2VyRXZlbnQuYWx0S2V5KSA/IHVuZGVmaW5lZCA6IHRoaXMuZm9jdXNOYXZpZ2F0aW9uRmlsdGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMudmlldy5mb2N1c05leHRQYWdlKGJyb3dzZXJFdmVudCwgZmlsdGVyKTtcblx0fVxuXG5cdGZvY3VzUHJldmlvdXNQYWdlKGJyb3dzZXJFdmVudD86IFVJRXZlbnQsIGZpbHRlcjogKChub2RlOiBJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+KSA9PiBib29sZWFuKSB8IHVuZGVmaW5lZCA9IChpc0tleWJvYXJkRXZlbnQoYnJvd3NlckV2ZW50KSAmJiBicm93c2VyRXZlbnQuYWx0S2V5KSA/IHVuZGVmaW5lZCA6IHRoaXMuZm9jdXNOYXZpZ2F0aW9uRmlsdGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMudmlldy5mb2N1c1ByZXZpb3VzUGFnZShicm93c2VyRXZlbnQsIGZpbHRlciwgKCkgPT4gdGhpcy5zdGlja3lTY3JvbGxDb250cm9sbGVyPy5oZWlnaHQgPz8gMCk7XG5cdH1cblxuXHRmb2N1c0xhc3QoYnJvd3NlckV2ZW50PzogVUlFdmVudCwgZmlsdGVyOiAoKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pID0+IGJvb2xlYW4pIHwgdW5kZWZpbmVkID0gKGlzS2V5Ym9hcmRFdmVudChicm93c2VyRXZlbnQpICYmIGJyb3dzZXJFdmVudC5hbHRLZXkpID8gdW5kZWZpbmVkIDogdGhpcy5mb2N1c05hdmlnYXRpb25GaWx0ZXIpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXcuZm9jdXNMYXN0KGJyb3dzZXJFdmVudCwgZmlsdGVyKTtcblx0fVxuXG5cdGZvY3VzRmlyc3QoYnJvd3NlckV2ZW50PzogVUlFdmVudCwgZmlsdGVyOiAoKG5vZGU6IElUcmVlTm9kZTxULCBURmlsdGVyRGF0YT4pID0+IGJvb2xlYW4pIHwgdW5kZWZpbmVkID0gKGlzS2V5Ym9hcmRFdmVudChicm93c2VyRXZlbnQpICYmIGJyb3dzZXJFdmVudC5hbHRLZXkpID8gdW5kZWZpbmVkIDogdGhpcy5mb2N1c05hdmlnYXRpb25GaWx0ZXIpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXcuZm9jdXNGaXJzdChicm93c2VyRXZlbnQsIGZpbHRlcik7XG5cdH1cblxuXHRnZXRGb2N1cygpOiBUW10ge1xuXHRcdHJldHVybiB0aGlzLmZvY3VzLmdldCgpO1xuXHR9XG5cblx0Z2V0U3RpY2t5U2Nyb2xsRm9jdXMoKTogVFtdIHtcblx0XHRjb25zdCBmb2N1cyA9IHRoaXMuc3RpY2t5U2Nyb2xsQ29udHJvbGxlcj8uZ2V0Rm9jdXMoKTtcblx0XHRyZXR1cm4gZm9jdXMgIT09IHVuZGVmaW5lZCA/IFtmb2N1c10gOiBbXTtcblx0fVxuXG5cdGdldEZvY3VzZWRQYXJ0KCk6IEFic3RyYWN0VHJlZVBhcnQge1xuXHRcdHJldHVybiB0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXI/LmZvY3VzZWRMYXN0KCkgPyBBYnN0cmFjdFRyZWVQYXJ0LlN0aWNreVNjcm9sbCA6IEFic3RyYWN0VHJlZVBhcnQuVHJlZTtcblx0fVxuXG5cdHJldmVhbChsb2NhdGlvbjogVFJlZiwgcmVsYXRpdmVUb3A/OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLmV4cGFuZFRvKGxvY2F0aW9uKTtcblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5tb2RlbC5nZXRMaXN0SW5kZXgobG9jYXRpb24pO1xuXG5cdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5zdGlja3lTY3JvbGxDb250cm9sbGVyKSB7XG5cdFx0XHR0aGlzLnZpZXcucmV2ZWFsKGluZGV4LCByZWxhdGl2ZVRvcCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHBhZGRpbmdUb3AgPSB0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXIubm9kZVBvc2l0aW9uVG9wQmVsb3dXaWRnZXQodGhpcy5nZXROb2RlKGxvY2F0aW9uKSk7XG5cdFx0XHR0aGlzLnZpZXcucmV2ZWFsKGluZGV4LCByZWxhdGl2ZVRvcCwgcGFkZGluZ1RvcCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHJlbGF0aXZlIHBvc2l0aW9uIG9mIGFuIGVsZW1lbnQgcmVuZGVyZWQgaW4gdGhlIGxpc3QuXG5cdCAqIFJldHVybnMgYG51bGxgIGlmIHRoZSBlbGVtZW50IGlzbid0ICplbnRpcmVseSogaW4gdGhlIHZpc2libGUgdmlld3BvcnQuXG5cdCAqL1xuXHRnZXRSZWxhdGl2ZVRvcChsb2NhdGlvbjogVFJlZik6IG51bWJlciB8IG51bGwge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5tb2RlbC5nZXRMaXN0SW5kZXgobG9jYXRpb24pO1xuXG5cdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RpY2t5U2Nyb2xsTm9kZSA9IHRoaXMuc3RpY2t5U2Nyb2xsQ29udHJvbGxlcj8uZ2V0Tm9kZSh0aGlzLmdldE5vZGUobG9jYXRpb24pKTtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmdldFJlbGF0aXZlVG9wKGluZGV4LCBzdGlja3lTY3JvbGxOb2RlPy5wb3NpdGlvbiA/PyB0aGlzLnN0aWNreVNjcm9sbENvbnRyb2xsZXI/LmhlaWdodCk7XG5cdH1cblxuXHRnZXRWaWV3U3RhdGUoaWRlbnRpdHlQcm92aWRlciA9IHRoaXMub3B0aW9ucy5pZGVudGl0eVByb3ZpZGVyKTogQWJzdHJhY3RUcmVlVmlld1N0YXRlIHtcblx0XHRpZiAoIWlkZW50aXR5UHJvdmlkZXIpIHtcblx0XHRcdHRocm93IG5ldyBUcmVlRXJyb3IodGhpcy5fdXNlciwgJ0NhblxcJ3QgZ2V0IHRyZWUgdmlldyBzdGF0ZSB3aXRob3V0IGFuIGlkZW50aXR5IHByb3ZpZGVyJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ2V0SWQgPSAoZWxlbWVudDogVCB8IG51bGwpID0+IGlkZW50aXR5UHJvdmlkZXIuZ2V0SWQoZWxlbWVudCEpLnRvU3RyaW5nKCk7XG5cdFx0Y29uc3Qgc3RhdGUgPSBBYnN0cmFjdFRyZWVWaWV3U3RhdGUuZW1wdHkodGhpcy5zY3JvbGxUb3ApO1xuXHRcdGZvciAoY29uc3QgZm9jdXMgb2YgdGhpcy5nZXRGb2N1cygpKSB7XG5cdFx0XHRzdGF0ZS5mb2N1cy5hZGQoZ2V0SWQoZm9jdXMpKTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2YgdGhpcy5nZXRTZWxlY3Rpb24oKSkge1xuXHRcdFx0c3RhdGUuc2VsZWN0aW9uLmFkZChnZXRJZChzZWxlY3Rpb24pKTtcblx0XHR9XG5cblx0XHRjb25zdCByb290ID0gdGhpcy5tb2RlbC5nZXROb2RlKCk7XG5cdFx0Y29uc3Qgc3RhY2sgPSBbcm9vdF07XG5cblx0XHR3aGlsZSAoc3RhY2subGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3Qgbm9kZSA9IHN0YWNrLnBvcCgpITtcblxuXHRcdFx0aWYgKG5vZGUgIT09IHJvb3QgJiYgbm9kZS5jb2xsYXBzaWJsZSkge1xuXHRcdFx0XHRzdGF0ZS5leHBhbmRlZFtnZXRJZChub2RlLmVsZW1lbnQpXSA9IG5vZGUuY29sbGFwc2VkID8gMCA6IDE7XG5cdFx0XHR9XG5cblx0XHRcdGluc2VydEludG8oc3RhY2ssIHN0YWNrLmxlbmd0aCwgbm9kZS5jaGlsZHJlbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0YXRlO1xuXHR9XG5cblx0Ly8gTGlzdFxuXG5cdHByaXZhdGUgb25MZWZ0QXJyb3coZTogU3RhbmRhcmRLZXlib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRjb25zdCBub2RlcyA9IHRoaXMudmlldy5nZXRGb2N1c2VkRWxlbWVudHMoKTtcblxuXHRcdGlmIChub2Rlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBub2RlID0gbm9kZXNbMF07XG5cdFx0Y29uc3QgbG9jYXRpb24gPSB0aGlzLm1vZGVsLmdldE5vZGVMb2NhdGlvbihub2RlKTtcblx0XHRjb25zdCBkaWRDaGFuZ2UgPSB0aGlzLm1vZGVsLnNldENvbGxhcHNlZChsb2NhdGlvbiwgdHJ1ZSk7XG5cblx0XHRpZiAoIWRpZENoYW5nZSkge1xuXHRcdFx0Y29uc3QgcGFyZW50TG9jYXRpb24gPSB0aGlzLm1vZGVsLmdldFBhcmVudE5vZGVMb2NhdGlvbihsb2NhdGlvbik7XG5cblx0XHRcdGlmICghcGFyZW50TG9jYXRpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwYXJlbnRMaXN0SW5kZXggPSB0aGlzLm1vZGVsLmdldExpc3RJbmRleChwYXJlbnRMb2NhdGlvbik7XG5cblx0XHRcdHRoaXMudmlldy5yZXZlYWwocGFyZW50TGlzdEluZGV4KTtcblx0XHRcdHRoaXMudmlldy5zZXRGb2N1cyhbcGFyZW50TGlzdEluZGV4XSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblJpZ2h0QXJyb3coZTogU3RhbmRhcmRLZXlib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRjb25zdCBub2RlcyA9IHRoaXMudmlldy5nZXRGb2N1c2VkRWxlbWVudHMoKTtcblxuXHRcdGlmIChub2Rlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBub2RlID0gbm9kZXNbMF07XG5cdFx0Y29uc3QgbG9jYXRpb24gPSB0aGlzLm1vZGVsLmdldE5vZGVMb2NhdGlvbihub2RlKTtcblx0XHRjb25zdCBkaWRDaGFuZ2UgPSB0aGlzLm1vZGVsLnNldENvbGxhcHNlZChsb2NhdGlvbiwgZmFsc2UpO1xuXG5cdFx0aWYgKCFkaWRDaGFuZ2UpIHtcblx0XHRcdGlmICghbm9kZS5jaGlsZHJlbi5zb21lKGNoaWxkID0+IGNoaWxkLnZpc2libGUpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgW2ZvY3VzZWRJbmRleF0gPSB0aGlzLnZpZXcuZ2V0Rm9jdXMoKTtcblx0XHRcdGNvbnN0IGZpcnN0Q2hpbGRJbmRleCA9IGZvY3VzZWRJbmRleCArIDE7XG5cblx0XHRcdHRoaXMudmlldy5yZXZlYWwoZmlyc3RDaGlsZEluZGV4KTtcblx0XHRcdHRoaXMudmlldy5zZXRGb2N1cyhbZmlyc3RDaGlsZEluZGV4XSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblNwYWNlKGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0Y29uc3Qgbm9kZXMgPSB0aGlzLnZpZXcuZ2V0Rm9jdXNlZEVsZW1lbnRzKCk7XG5cblx0XHRpZiAobm9kZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm9kZSA9IG5vZGVzWzBdO1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gdGhpcy5tb2RlbC5nZXROb2RlTG9jYXRpb24obm9kZSk7XG5cdFx0Y29uc3QgcmVjdXJzaXZlID0gZS5icm93c2VyRXZlbnQuYWx0S2V5O1xuXG5cdFx0dGhpcy5tb2RlbC5zZXRDb2xsYXBzZWQobG9jYXRpb24sIHVuZGVmaW5lZCwgcmVjdXJzaXZlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBjcmVhdGVNb2RlbCh1c2VyOiBzdHJpbmcsIG9wdGlvbnM6IElBYnN0cmFjdFRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPik6IElUcmVlTW9kZWw8VCwgVEZpbHRlckRhdGEsIFRSZWY+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbW9kZWxEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBzZXR1cE1vZGVsKG1vZGVsOiBJVHJlZU1vZGVsPFQsIFRGaWx0ZXJEYXRhLCBUUmVmPikge1xuXHRcdHRoaXMubW9kZWxEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0dGhpcy5tb2RlbERpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZFNwbGljZVJlbmRlcmVkTm9kZXMoKHsgc3RhcnQsIGRlbGV0ZUNvdW50LCBlbGVtZW50cyB9KSA9PiB0aGlzLnZpZXcuc3BsaWNlKHN0YXJ0LCBkZWxldGVDb3VudCwgZWxlbWVudHMpKSk7XG5cblx0XHRjb25zdCBvbkRpZE1vZGVsU3BsaWNlID0gRXZlbnQuZm9yRWFjaChtb2RlbC5vbkRpZFNwbGljZU1vZGVsLCBlID0+IHtcblx0XHRcdHRoaXMuZXZlbnRCdWZmZXJlci5idWZmZXJFdmVudHMoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmZvY3VzLm9uRGlkTW9kZWxTcGxpY2UoZSk7XG5cdFx0XHRcdHRoaXMuc2VsZWN0aW9uLm9uRGlkTW9kZWxTcGxpY2UoZSk7XG5cdFx0XHR9KTtcblx0XHR9LCB0aGlzLm1vZGVsRGlzcG9zYWJsZXMpO1xuXG5cdFx0Ly8gTWFrZSBzdXJlIHRoZSBgZm9yRWFjaGAgYWx3YXlzIHJ1bnNcblx0XHRvbkRpZE1vZGVsU3BsaWNlKCgpID0+IG51bGwsIG51bGwsIHRoaXMubW9kZWxEaXNwb3NhYmxlcyk7XG5cblx0XHQvLyBBY3RpdmUgbm9kZXMgY2FuIGNoYW5nZSB3aGVuIHRoZSBtb2RlbCBjaGFuZ2VzIG9yIHdoZW4gZm9jdXMgb3Igc2VsZWN0aW9uIGNoYW5nZS5cblx0XHQvLyBXZSBkZWJvdW5jZSBpdCB3aXRoIDAgZGVsYXkgc2luY2UgdGhlc2UgZXZlbnRzIG1heSBmaXJlIGluIHRoZSBzYW1lIHN0YWNrIGFuZCB3ZSBvbmx5XG5cdFx0Ly8gd2FudCB0byBydW4gdGhpcyBvbmNlLiBJdCBhbHNvIGRvZXNuJ3QgbWF0dGVyIGlmIGl0IHJ1bnMgb24gdGhlIG5leHQgdGljayBzaW5jZSBpdCdzIG9ubHlcblx0XHQvLyBhIG5pY2UgdG8gaGF2ZSBVSSBmZWF0dXJlLlxuXHRcdGNvbnN0IGFjdGl2ZU5vZGVzRW1pdHRlciA9IHRoaXMubW9kZWxEaXNwb3NhYmxlcy5hZGQobmV3IEVtaXR0ZXI8SVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPltdPigpKTtcblx0XHRjb25zdCBhY3RpdmVOb2Rlc0RlYm91bmNlID0gdGhpcy5tb2RlbERpc3Bvc2FibGVzLmFkZChuZXcgRGVsYXllcigwKSk7XG5cdFx0dGhpcy5tb2RlbERpc3Bvc2FibGVzLmFkZChFdmVudC5hbnk8YW55PihvbkRpZE1vZGVsU3BsaWNlLCB0aGlzLmZvY3VzLm9uRGlkQ2hhbmdlLCB0aGlzLnNlbGVjdGlvbi5vbkRpZENoYW5nZSkoKCkgPT4ge1xuXHRcdFx0YWN0aXZlTm9kZXNEZWJvdW5jZS50cmlnZ2VyKCgpID0+IHtcblx0XHRcdFx0Y29uc3Qgc2V0ID0gbmV3IFNldDxJVHJlZU5vZGU8VCwgVEZpbHRlckRhdGE+PigpO1xuXG5cdFx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiB0aGlzLmZvY3VzLmdldE5vZGVzKCkpIHtcblx0XHRcdFx0XHRzZXQuYWRkKG5vZGUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yIChjb25zdCBub2RlIG9mIHRoaXMuc2VsZWN0aW9uLmdldE5vZGVzKCkpIHtcblx0XHRcdFx0XHRzZXQuYWRkKG5vZGUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YWN0aXZlTm9kZXNFbWl0dGVyLmZpcmUoWy4uLnNldC52YWx1ZXMoKV0pO1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5vbkRpZENoYW5nZUFjdGl2ZU5vZGVzUmVsYXkuaW5wdXQgPSBhY3RpdmVOb2Rlc0VtaXR0ZXIuZXZlbnQ7XG5cdFx0dGhpcy5vbkRpZENoYW5nZU1vZGVsUmVsYXkuaW5wdXQgPSBFdmVudC5zaWduYWwobW9kZWwub25EaWRTcGxpY2VNb2RlbCk7XG5cdFx0dGhpcy5vbkRpZENoYW5nZUNvbGxhcHNlU3RhdGVSZWxheS5pbnB1dCA9IG1vZGVsLm9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZTtcblx0XHR0aGlzLm9uRGlkQ2hhbmdlUmVuZGVyTm9kZUNvdW50UmVsYXkuaW5wdXQgPSBtb2RlbC5vbkRpZENoYW5nZVJlbmRlck5vZGVDb3VudDtcblx0XHR0aGlzLm9uRGlkU3BsaWNlTW9kZWxSZWxheS5pbnB1dCA9IG1vZGVsLm9uRGlkU3BsaWNlTW9kZWw7XG5cdH1cblxuXHRuYXZpZ2F0ZShzdGFydD86IFRSZWYpOiBJVHJlZU5hdmlnYXRvcjxUPiB7XG5cdFx0cmV0dXJuIG5ldyBUcmVlTmF2aWdhdG9yKHRoaXMudmlldywgdGhpcy5tb2RlbCwgc3RhcnQpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMuc3RpY2t5U2Nyb2xsQ29udHJvbGxlcj8uZGlzcG9zZSgpO1xuXHRcdHRoaXMudmlldy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5tb2RlbERpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSVRyZWVOYXZpZ2F0b3JWaWV3PFQgZXh0ZW5kcyBOb25OdWxsYWJsZTxhbnk+LCBURmlsdGVyRGF0YT4ge1xuXHRyZWFkb25seSBsZW5ndGg6IG51bWJlcjtcblx0ZWxlbWVudChpbmRleDogbnVtYmVyKTogSVRyZWVOb2RlPFQsIFRGaWx0ZXJEYXRhPjtcbn1cblxuY2xhc3MgVHJlZU5hdmlnYXRvcjxUIGV4dGVuZHMgTm9uTnVsbGFibGU8YW55PiwgVEZpbHRlckRhdGEsIFRSZWY+IGltcGxlbWVudHMgSVRyZWVOYXZpZ2F0b3I8VD4ge1xuXG5cdHByaXZhdGUgaW5kZXg6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHZpZXc6IElUcmVlTmF2aWdhdG9yVmlldzxULCBURmlsdGVyRGF0YT4sIHByaXZhdGUgbW9kZWw6IElUcmVlTW9kZWw8VCwgVEZpbHRlckRhdGEsIFRSZWY+LCBzdGFydD86IFRSZWYpIHtcblx0XHRpZiAoc3RhcnQpIHtcblx0XHRcdHRoaXMuaW5kZXggPSB0aGlzLm1vZGVsLmdldExpc3RJbmRleChzdGFydCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaW5kZXggPSAtMTtcblx0XHR9XG5cdH1cblxuXHRjdXJyZW50KCk6IFQgfCBudWxsIHtcblx0XHRpZiAodGhpcy5pbmRleCA8IDAgfHwgdGhpcy5pbmRleCA+PSB0aGlzLnZpZXcubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy52aWV3LmVsZW1lbnQodGhpcy5pbmRleCkuZWxlbWVudDtcblx0fVxuXG5cdHByZXZpb3VzKCk6IFQgfCBudWxsIHtcblx0XHR0aGlzLmluZGV4LS07XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudCgpO1xuXHR9XG5cblx0bmV4dCgpOiBUIHwgbnVsbCB7XG5cdFx0dGhpcy5pbmRleCsrO1xuXHRcdHJldHVybiB0aGlzLmN1cnJlbnQoKTtcblx0fVxuXG5cdGZpcnN0KCk6IFQgfCBudWxsIHtcblx0XHR0aGlzLmluZGV4ID0gMDtcblx0XHRyZXR1cm4gdGhpcy5jdXJyZW50KCk7XG5cdH1cblxuXHRsYXN0KCk6IFQgfCBudWxsIHtcblx0XHR0aGlzLmluZGV4ID0gdGhpcy52aWV3Lmxlbmd0aCAtIDE7XG5cdFx0cmV0dXJuIHRoaXMuY3VycmVudCgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLEdBQUcsUUFBUSxXQUFXLEdBQUcsb0JBQW9CLGlCQUFpQixpQkFBaUIsdUJBQXVCLHlCQUF5QjtBQUN4SSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGlCQUFpQjtBQUUxQixTQUFTLGlCQUFpQjtBQUMxQixTQUFvQyxhQUFhLDJCQUEyQjtBQUU1RSxTQUFTLCtCQUFxRDtBQUM5RCxTQUFnRSxjQUFjLFVBQVUsc0JBQXNCLGdCQUFnQix5QkFBeUIsdUJBQXVCLE1BQU0sdUJBQTJDO0FBQy9OLFNBQXdCLFFBQVEsNEJBQTRCO0FBQzVELFNBQVMsaUJBQWlCLHNCQUFzQjtBQUNoRCxTQUFvTSxvQkFBb0IsV0FBNkIsc0JBQXNCLHNCQUFzQjtBQUNqUyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxVQUFVLFFBQVEsWUFBWSxhQUFhO0FBQ3BELFNB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QUksSUFBK0I7QUFFL0MsbUJBQVcsUUFBUSxLQUFLLE1BQU0sU0FBUyxHQUFHO0FBQ3pDLGNBQUksSUFBSSxJQUFJO0FBQUEsUUFDYjtBQUVBLG1CQUFXLFFBQVEsS0FBSyxVQUFVLFNBQVMsR0FBRztBQUM3QyxjQUFJLElBQUksSUFBSTtBQUFBLFFBQ2I7QUFFQSwyQkFBbUIsS0FBSyxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQztBQUFBLE1BQzFDLENBQUM7QUFBQSxJQUNGLENBQUMsQ0FBQztBQUVGLFNBQUssNEJBQTRCLFFBQVEsbUJBQW1CO0FBQzVELFNBQUssc0JBQXNCLFFBQVEsTUFBTSxPQUFPLE1BQU0sZ0JBQWdCO0FBQ3RFLFNBQUssOEJBQThCLFFBQVEsTUFBTTtBQUNqRCxTQUFLLGdDQUFnQyxRQUFRLE1BQU07QUFDbkQsU0FBSyxzQkFBc0IsUUFBUSxNQUFNO0FBQUEsRUFDMUM7QUFBQSxFQUVBLFNBQVMsT0FBaUM7QUFDekMsV0FBTyxJQUFJLGNBQWMsS0FBSyxNQUFNLEtBQUssT0FBTyxLQUFLO0FBQUEsRUFDdEQ7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsWUFBUSxLQUFLLFdBQVc7QUFDeEIsU0FBSyx3QkFBd0IsUUFBUTtBQUNyQyxTQUFLLEtBQUssUUFBUTtBQUNsQixTQUFLLGlCQUFpQixRQUFRO0FBQUEsRUFDL0I7QUFDRDtBQU9BLE1BQU0sY0FBMEY7QUFBQSxFQUkvRixZQUFvQixNQUFrRCxPQUF5QyxPQUFjO0FBQXpHO0FBQWtEO0FBQ3JFLFFBQUksT0FBTztBQUNWLFdBQUssUUFBUSxLQUFLLE1BQU0sYUFBYSxLQUFLO0FBQUEsSUFDM0MsT0FBTztBQUNOLFdBQUssUUFBUTtBQUFBLElBQ2Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxVQUFvQjtBQUNuQixRQUFJLEtBQUssUUFBUSxLQUFLLEtBQUssU0FBUyxLQUFLLEtBQUssUUFBUTtBQUNyRCxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sS0FBSyxLQUFLLFFBQVEsS0FBSyxLQUFLLEVBQUU7QUFBQSxFQUN0QztBQUFBLEVBRUEsV0FBcUI7QUFDcEIsU0FBSztBQUNMLFdBQU8sS0FBSyxRQUFRO0FBQUEsRUFDckI7QUFBQSxFQUVBLE9BQWlCO0FBQ2hCLFNBQUs7QUFDTCxXQUFPLEtBQUssUUFBUTtBQUFBLEVBQ3JCO0FBQUEsRUFFQSxRQUFrQjtBQUNqQixTQUFLLFFBQVE7QUFDYixXQUFPLEtBQUssUUFBUTtBQUFBLEVBQ3JCO0FBQUEsRUFFQSxPQUFpQjtBQUNoQixTQUFLLFFBQVEsS0FBSyxLQUFLLFNBQVM7QUFDaEMsV0FBTyxLQUFLLFFBQVE7QUFBQSxFQUNyQjtBQUNEOyIsCiAgIm5hbWVzIjogWyJtb2RlbCIsICJyZWYiLCAiUmVuZGVySW5kZW50R3VpZGVzIiwgIlRyZWVGaW5kTW9kZSIsICJUcmVlRmluZE1hdGNoVHlwZSIsICIkIiwgInRvZ2dsZSIsICJEZWZhdWx0VHJlZVRvZ2dsZXMiLCAicmVuZGVyZXIiLCAic3RpY2t5Tm9kZSIsICJBYnN0cmFjdFRyZWVQYXJ0Il0KfQo=
