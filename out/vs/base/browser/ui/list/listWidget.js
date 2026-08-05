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
import { EventHelper, getActiveElement, getWindow, isActiveElement, isEditableElement, isHTMLElement, isMouseEvent } from "../../dom.js";
import { createStyleSheet } from "../../domStylesheets.js";
import { asCssValueWithDefault } from "../../cssValue.js";
import { DomEmitter } from "../../event.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { Gesture } from "../../touch.js";
import { alert } from "../aria/aria.js";
import { CombinedSpliceable } from "./splice.js";
import { binarySearch, range } from "../../../common/arrays.js";
import { timeout } from "../../../common/async.js";
import { Color } from "../../../common/color.js";
import { memoize } from "../../../common/decorators.js";
import { Emitter, Event, EventBufferer } from "../../../common/event.js";
import { matchesFuzzy2, matchesPrefix } from "../../../common/filters.js";
import { KeyCode } from "../../../common/keyCodes.js";
import { DisposableStore, dispose } from "../../../common/lifecycle.js";
import { clamp } from "../../../common/numbers.js";
import * as platform from "../../../common/platform.js";
import { isNumber } from "../../../common/types.js";
import "./list.css";
import { ListError } from "./list.js";
import { ListView } from "./listView.js";
import { StandardMouseEvent } from "../../mouseEvent.js";
import { autorun, constObservable } from "../../../common/observable.js";
class TraitRenderer {
  constructor(trait) {
    this.trait = trait;
    this.renderedElements = [];
  }
  get templateId() {
    return `template:${this.trait.name}`;
  }
  renderTemplate(container) {
    return container;
  }
  renderElement(element, index, templateData) {
    const renderedElementIndex = this.renderedElements.findIndex((el) => el.templateData === templateData);
    if (renderedElementIndex >= 0) {
      const rendered = this.renderedElements[renderedElementIndex];
      this.trait.unrender(templateData);
      rendered.index = index;
    } else {
      const rendered = { index, templateData };
      this.renderedElements.push(rendered);
    }
    this.trait.renderIndex(index, templateData);
  }
  splice(start, deleteCount, insertCount) {
    const rendered = [];
    for (const renderedElement of this.renderedElements) {
      if (renderedElement.index < start) {
        rendered.push(renderedElement);
      } else if (renderedElement.index >= start + deleteCount) {
        rendered.push({
          index: renderedElement.index + insertCount - deleteCount,
          templateData: renderedElement.templateData
        });
      }
    }
    this.renderedElements = rendered;
  }
  renderIndexes(indexes) {
    for (const { index, templateData } of this.renderedElements) {
      if (indexes.indexOf(index) > -1) {
        this.trait.renderIndex(index, templateData);
      }
    }
  }
  disposeTemplate(templateData) {
    const index = this.renderedElements.findIndex((el) => el.templateData === templateData);
    if (index < 0) {
      return;
    }
    this.renderedElements.splice(index, 1);
  }
}
class Trait {
  constructor(_trait) {
    this._trait = _trait;
    this.indexes = [];
    this.sortedIndexes = [];
    this._onChange = new Emitter();
    this.onChange = this._onChange.event;
  }
  get name() {
    return this._trait;
  }
  get renderer() {
    return new TraitRenderer(this);
  }
  splice(start, deleteCount, elements) {
    const diff = elements.length - deleteCount;
    const end = start + deleteCount;
    const sortedIndexes = [];
    let i = 0;
    while (i < this.sortedIndexes.length && this.sortedIndexes[i] < start) {
      sortedIndexes.push(this.sortedIndexes[i++]);
    }
    for (let j = 0; j < elements.length; j++) {
      if (elements[j]) {
        sortedIndexes.push(j + start);
      }
    }
    while (i < this.sortedIndexes.length && this.sortedIndexes[i] >= end) {
      sortedIndexes.push(this.sortedIndexes[i++] + diff);
    }
    this.renderer.splice(start, deleteCount, elements.length);
    this._set(sortedIndexes, sortedIndexes);
  }
  renderIndex(index, container) {
    container.classList.toggle(this._trait, this.contains(index));
  }
  unrender(container) {
    container.classList.remove(this._trait);
  }
  /**
   * Sets the indexes which should have this trait.
   *
   * @param indexes Indexes which should have this trait.
   * @return The old indexes which had this trait.
   */
  set(indexes, browserEvent) {
    return this._set(indexes, [...indexes].sort(numericSort), browserEvent);
  }
  _set(indexes, sortedIndexes, browserEvent) {
    const result = this.indexes;
    const sortedResult = this.sortedIndexes;
    this.indexes = indexes;
    this.sortedIndexes = sortedIndexes;
    const toRender = disjunction(sortedResult, indexes);
    this.renderer.renderIndexes(toRender);
    this._onChange.fire({ indexes, browserEvent });
    return result;
  }
  get() {
    return this.indexes;
  }
  contains(index) {
    return binarySearch(this.sortedIndexes, index, numericSort) >= 0;
  }
  dispose() {
    dispose(this._onChange);
  }
}
__decorateClass([
  memoize
], Trait.prototype, "renderer", 1);
class SelectionTrait extends Trait {
  constructor(setAriaSelected) {
    super("selected");
    this.setAriaSelected = setAriaSelected;
  }
  renderIndex(index, container) {
    super.renderIndex(index, container);
    if (this.setAriaSelected) {
      if (this.contains(index)) {
        container.setAttribute("aria-selected", "true");
      } else {
        container.setAttribute("aria-selected", "false");
      }
    }
  }
}
class TraitSpliceable {
  constructor(trait, view, identityProvider) {
    this.trait = trait;
    this.view = view;
    this.identityProvider = identityProvider;
  }
  splice(start, deleteCount, elements) {
    if (!this.identityProvider) {
      return this.trait.splice(start, deleteCount, new Array(elements.length).fill(false));
    }
    const pastElementsWithTrait = this.trait.get().map((i) => this.identityProvider.getId(this.view.element(i)).toString());
    if (pastElementsWithTrait.length === 0) {
      return this.trait.splice(start, deleteCount, new Array(elements.length).fill(false));
    }
    const pastElementsWithTraitSet = new Set(pastElementsWithTrait);
    const elementsWithTrait = elements.map((e) => pastElementsWithTraitSet.has(this.identityProvider.getId(e).toString()));
    this.trait.splice(start, deleteCount, elementsWithTrait);
  }
}
function isListElementDescendantOfClass(e, className) {
  if (e.classList.contains(className)) {
    return true;
  }
  if (e.classList.contains("monaco-list")) {
    return false;
  }
  if (!e.parentElement) {
    return false;
  }
  return isListElementDescendantOfClass(e.parentElement, className);
}
function isMonacoEditor(e) {
  return isListElementDescendantOfClass(e, "monaco-editor");
}
function isMonacoCustomToggle(e) {
  return isListElementDescendantOfClass(e, "monaco-custom-toggle");
}
function isActionItem(e) {
  return isListElementDescendantOfClass(e, "action-item");
}
function isMonacoTwistie(e) {
  return isListElementDescendantOfClass(e, "monaco-tl-twistie");
}
function isStickyScrollElement(e) {
  return isListElementDescendantOfClass(e, "monaco-tree-sticky-row");
}
function isStickyScrollContainer(e) {
  return e.classList.contains("monaco-tree-sticky-container");
}
function isButton(e) {
  if (e.tagName === "A" && e.classList.contains("monaco-button") || e.tagName === "DIV" && e.classList.contains("monaco-button-dropdown")) {
    return true;
  }
  if (e.classList.contains("monaco-list")) {
    return false;
  }
  if (!e.parentElement) {
    return false;
  }
  return isButton(e.parentElement);
}
class KeyboardController {
  constructor(list, view, options) {
    this.list = list;
    this.view = view;
    this.disposables = new DisposableStore();
    this.multipleSelectionDisposables = new DisposableStore();
    this.multipleSelectionSupport = options.multipleSelectionSupport;
    this.disposables.add(this.onKeyDown((e) => {
      switch (e.keyCode) {
        case KeyCode.Enter:
          return this.onEnter(e);
        case KeyCode.UpArrow:
          return this.onUpArrow(e);
        case KeyCode.DownArrow:
          return this.onDownArrow(e);
        case KeyCode.PageUp:
          return this.onPageUpArrow(e);
        case KeyCode.PageDown:
          return this.onPageDownArrow(e);
        case KeyCode.Escape:
          return this.onEscape(e);
        case KeyCode.KeyA:
          if (this.multipleSelectionSupport && (platform.isMacintosh ? e.metaKey : e.ctrlKey)) {
            this.onCtrlA(e);
          }
      }
    }));
  }
  get onKeyDown() {
    return Event.chain(
      this.disposables.add(new DomEmitter(this.view.domNode, "keydown")).event,
      ($) => $.filter((e) => !isEditableElement(e.target)).map((e) => new StandardKeyboardEvent(e))
    );
  }
  updateOptions(optionsUpdate) {
    if (optionsUpdate.multipleSelectionSupport !== void 0) {
      this.multipleSelectionSupport = optionsUpdate.multipleSelectionSupport;
    }
  }
  onEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    this.list.setSelection(this.list.getFocus(), e.browserEvent);
  }
  onUpArrow(e) {
    e.preventDefault();
    e.stopPropagation();
    this.list.focusPrevious(1, false, e.browserEvent);
    const el = this.list.getFocus()[0];
    this.list.setAnchor(el);
    this.list.reveal(el);
    this.view.domNode.focus();
  }
  onDownArrow(e) {
    e.preventDefault();
    e.stopPropagation();
    this.list.focusNext(1, false, e.browserEvent);
    const el = this.list.getFocus()[0];
    this.list.setAnchor(el);
    this.list.reveal(el);
    this.view.domNode.focus();
  }
  onPageUpArrow(e) {
    e.preventDefault();
    e.stopPropagation();
    this.list.focusPreviousPage(e.browserEvent);
    const el = this.list.getFocus()[0];
    this.list.setAnchor(el);
    this.list.reveal(el);
    this.view.domNode.focus();
  }
  onPageDownArrow(e) {
    e.preventDefault();
    e.stopPropagation();
    this.list.focusNextPage(e.browserEvent);
    const el = this.list.getFocus()[0];
    this.list.setAnchor(el);
    this.list.reveal(el);
    this.view.domNode.focus();
  }
  onCtrlA(e) {
    e.preventDefault();
    e.stopPropagation();
    this.list.setSelection(range(this.list.length), e.browserEvent);
    this.list.setAnchor(void 0);
    this.view.domNode.focus();
  }
  onEscape(e) {
    if (this.list.getSelection().length) {
      e.preventDefault();
      e.stopPropagation();
      this.list.setSelection([], e.browserEvent);
      this.list.setAnchor(void 0);
      this.view.domNode.focus();
    }
  }
  dispose() {
    this.disposables.dispose();
    this.multipleSelectionDisposables.dispose();
  }
}
__decorateClass([
  memoize
], KeyboardController.prototype, "onKeyDown", 1);
var TypeNavigationMode = /* @__PURE__ */ ((TypeNavigationMode2) => {
  TypeNavigationMode2[TypeNavigationMode2["Automatic"] = 0] = "Automatic";
  TypeNavigationMode2[TypeNavigationMode2["Trigger"] = 1] = "Trigger";
  return TypeNavigationMode2;
})(TypeNavigationMode || {});
var TypeNavigationControllerState = /* @__PURE__ */ ((TypeNavigationControllerState2) => {
  TypeNavigationControllerState2[TypeNavigationControllerState2["Idle"] = 0] = "Idle";
  TypeNavigationControllerState2[TypeNavigationControllerState2["Typing"] = 1] = "Typing";
  return TypeNavigationControllerState2;
})(TypeNavigationControllerState || {});
const DefaultKeyboardNavigationDelegate = new class {
  mightProducePrintableCharacter(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }
    return event.keyCode >= KeyCode.KeyA && event.keyCode <= KeyCode.KeyZ || event.keyCode >= KeyCode.Digit0 && event.keyCode <= KeyCode.Digit9 || event.keyCode >= KeyCode.Numpad0 && event.keyCode <= KeyCode.Numpad9 || event.keyCode >= KeyCode.Semicolon && event.keyCode <= KeyCode.Quote;
  }
}();
class TypeNavigationController {
  constructor(list, view, keyboardNavigationLabelProvider, keyboardNavigationEventFilter, delegate) {
    this.list = list;
    this.view = view;
    this.keyboardNavigationLabelProvider = keyboardNavigationLabelProvider;
    this.keyboardNavigationEventFilter = keyboardNavigationEventFilter;
    this.delegate = delegate;
    this.enabled = false;
    this.state = 0 /* Idle */;
    this.mode = 0 /* Automatic */;
    this.triggered = false;
    this.previouslyFocused = -1;
    this.enabledDisposables = new DisposableStore();
    this.disposables = new DisposableStore();
    this.updateOptions(list.options);
  }
  updateOptions(options) {
    if (options.typeNavigationEnabled ?? true) {
      this.enable();
    } else {
      this.disable();
    }
    this.mode = options.typeNavigationMode ?? 0 /* Automatic */;
  }
  trigger() {
    this.triggered = !this.triggered;
  }
  enable() {
    if (this.enabled) {
      return;
    }
    let typing = false;
    const onChar = Event.chain(
      this.enabledDisposables.add(new DomEmitter(this.view.domNode, "keydown")).event,
      ($) => $.filter((e) => !isEditableElement(e.target)).filter(() => this.mode === 0 /* Automatic */ || this.triggered).map((event) => new StandardKeyboardEvent(event)).filter((e) => typing || this.keyboardNavigationEventFilter(e)).filter((e) => this.delegate.mightProducePrintableCharacter(e)).forEach((e) => EventHelper.stop(e, true)).map((event) => event.browserEvent.key)
    );
    const onClear = Event.debounce(onChar, () => null, 800, void 0, void 0, void 0, this.enabledDisposables);
    const onInput = Event.reduce(Event.any(onChar, onClear), (r, i) => i === null ? null : (r || "") + i, void 0, this.enabledDisposables);
    onInput(this.onInput, this, this.enabledDisposables);
    onClear(this.onClear, this, this.enabledDisposables);
    onChar(() => typing = true, void 0, this.enabledDisposables);
    onClear(() => typing = false, void 0, this.enabledDisposables);
    this.enabled = true;
    this.triggered = false;
  }
  disable() {
    if (!this.enabled) {
      return;
    }
    this.enabledDisposables.clear();
    this.enabled = false;
    this.triggered = false;
  }
  onClear() {
    const focus = this.list.getFocus();
    if (focus.length > 0 && focus[0] === this.previouslyFocused) {
      const ariaLabel = this.list.options.accessibilityProvider?.getAriaLabel(this.list.element(focus[0]));
      if (typeof ariaLabel === "string") {
        alert(ariaLabel);
      } else if (ariaLabel) {
        alert(ariaLabel.get());
      }
    }
    this.previouslyFocused = -1;
  }
  onInput(word) {
    if (!word) {
      this.state = 0 /* Idle */;
      this.triggered = false;
      return;
    }
    const focus = this.list.getFocus();
    const start = focus.length > 0 ? focus[0] : 0;
    const delta = this.state === 0 /* Idle */ ? 1 : 0;
    this.state = 1 /* Typing */;
    for (let i = 0; i < this.list.length; i++) {
      const index = (start + i + delta) % this.list.length;
      const label = this.keyboardNavigationLabelProvider.getKeyboardNavigationLabel(this.view.element(index));
      const labelStr = label && label.toString();
      if (this.list.options.typeNavigationEnabled) {
        if (typeof labelStr !== "undefined") {
          if (matchesPrefix(word, labelStr)) {
            this.previouslyFocused = start;
            this.list.setFocus([index]);
            this.list.reveal(index);
            return;
          }
          const fuzzy = matchesFuzzy2(word, labelStr);
          if (fuzzy) {
            const fuzzyScore = fuzzy[0].end - fuzzy[0].start;
            if (fuzzyScore > 1 && fuzzy.length === 1) {
              this.previouslyFocused = start;
              this.list.setFocus([index]);
              this.list.reveal(index);
              return;
            }
          }
        }
      } else if (typeof labelStr === "undefined" || matchesPrefix(word, labelStr)) {
        this.previouslyFocused = start;
        this.list.setFocus([index]);
        this.list.reveal(index);
        return;
      }
    }
  }
  dispose() {
    this.disable();
    this.enabledDisposables.dispose();
    this.disposables.dispose();
  }
}
class DOMFocusController {
  constructor(list, view) {
    this.list = list;
    this.view = view;
    this.disposables = new DisposableStore();
    const onKeyDown = Event.chain(
      this.disposables.add(new DomEmitter(view.domNode, "keydown")).event,
      ($) => $.filter((e) => !isEditableElement(e.target)).map((e) => new StandardKeyboardEvent(e))
    );
    const onTab = Event.chain(onKeyDown, ($) => $.filter((e) => e.keyCode === KeyCode.Tab && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey));
    onTab(this.onTab, this, this.disposables);
  }
  onTab(e) {
    if (e.target !== this.view.domNode) {
      return;
    }
    const focus = this.list.getFocus();
    if (focus.length === 0) {
      return;
    }
    const focusedDomElement = this.view.domElement(focus[0]);
    if (!focusedDomElement) {
      return;
    }
    const tabIndexElement = focusedDomElement.querySelector("[tabIndex]");
    if (!tabIndexElement || !isHTMLElement(tabIndexElement) || tabIndexElement.tabIndex === -1) {
      return;
    }
    const style = getWindow(tabIndexElement).getComputedStyle(tabIndexElement);
    if (style.visibility === "hidden" || style.display === "none") {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    tabIndexElement.focus();
  }
  dispose() {
    this.disposables.dispose();
  }
}
function isSelectionSingleChangeEvent(event) {
  return platform.isMacintosh ? event.browserEvent.metaKey : event.browserEvent.ctrlKey;
}
function isSelectionRangeChangeEvent(event) {
  return event.browserEvent.shiftKey;
}
function isMouseRightClick(event) {
  return isMouseEvent(event) && event.button === 2;
}
const DefaultMultipleSelectionController = {
  isSelectionSingleChangeEvent,
  isSelectionRangeChangeEvent
};
class MouseController {
  constructor(list) {
    this.list = list;
    this.disposables = new DisposableStore();
    this._onPointer = new Emitter();
    this.onPointer = this._onPointer.event;
    if (list.options.multipleSelectionSupport !== false) {
      this.multipleSelectionController = this.list.options.multipleSelectionController || DefaultMultipleSelectionController;
    }
    this.mouseSupport = typeof list.options.mouseSupport === "undefined" || !!list.options.mouseSupport;
    if (this.mouseSupport) {
      list.onMouseDown(this.onMouseDown, this, this.disposables);
      list.onContextMenu(this.onContextMenu, this, this.disposables);
      list.onMouseDblClick(this.onDoubleClick, this, this.disposables);
      list.onTouchStart(this.onMouseDown, this, this.disposables);
      this.disposables.add(Gesture.addTarget(list.getHTMLElement()));
    }
    Event.any(list.onMouseClick, list.onMouseMiddleClick, list.onTap)(this.onViewPointer, this, this.disposables);
  }
  updateOptions(optionsUpdate) {
    if (optionsUpdate.multipleSelectionSupport !== void 0) {
      this.multipleSelectionController = void 0;
      if (optionsUpdate.multipleSelectionSupport) {
        this.multipleSelectionController = this.list.options.multipleSelectionController || DefaultMultipleSelectionController;
      }
    }
  }
  isSelectionSingleChangeEvent(event) {
    if (!this.multipleSelectionController) {
      return false;
    }
    return this.multipleSelectionController.isSelectionSingleChangeEvent(event);
  }
  isSelectionRangeChangeEvent(event) {
    if (!this.multipleSelectionController) {
      return false;
    }
    return this.multipleSelectionController.isSelectionRangeChangeEvent(event);
  }
  isSelectionChangeEvent(event) {
    return this.isSelectionSingleChangeEvent(event) || this.isSelectionRangeChangeEvent(event);
  }
  onMouseDown(e) {
    if (isMonacoEditor(e.browserEvent.target)) {
      return;
    }
    if (getActiveElement() !== e.browserEvent.target) {
      this.list.domFocus();
    }
  }
  onContextMenu(e) {
    if (isEditableElement(e.browserEvent.target) || isMonacoEditor(e.browserEvent.target)) {
      return;
    }
    const focus = typeof e.index === "undefined" ? [] : [e.index];
    this.list.setFocus(focus, e.browserEvent);
  }
  onViewPointer(e) {
    if (!this.mouseSupport) {
      return;
    }
    if (isEditableElement(e.browserEvent.target) || isMonacoEditor(e.browserEvent.target)) {
      return;
    }
    if (e.browserEvent.isHandledByList) {
      return;
    }
    e.browserEvent.isHandledByList = true;
    const focus = e.index;
    if (typeof focus === "undefined") {
      this.list.setFocus([], e.browserEvent);
      this.list.setSelection([], e.browserEvent);
      this.list.setAnchor(void 0);
      return;
    }
    if (this.isSelectionChangeEvent(e)) {
      return this.changeSelection(e);
    }
    this.list.setFocus([focus], e.browserEvent);
    this.list.setAnchor(focus);
    if (!isMouseRightClick(e.browserEvent)) {
      this.list.setSelection([focus], e.browserEvent);
    }
    this._onPointer.fire(e);
  }
  onDoubleClick(e) {
    if (isEditableElement(e.browserEvent.target) || isMonacoEditor(e.browserEvent.target)) {
      return;
    }
    if (this.isSelectionChangeEvent(e)) {
      return;
    }
    if (e.browserEvent.isHandledByList) {
      return;
    }
    e.browserEvent.isHandledByList = true;
    const focus = this.list.getFocus();
    this.list.setSelection(focus, e.browserEvent);
  }
  changeSelection(e) {
    const focus = e.index;
    let anchor = this.list.getAnchor();
    if (this.isSelectionRangeChangeEvent(e)) {
      if (typeof anchor === "undefined") {
        const currentFocus = this.list.getFocus()[0];
        anchor = currentFocus ?? focus;
        this.list.setAnchor(anchor);
      }
      const min = Math.min(anchor, focus);
      const max = Math.max(anchor, focus);
      const rangeSelection = range(min, max + 1);
      const selection = this.list.getSelection();
      const contiguousRange = getContiguousRangeContaining(disjunction(selection, [anchor]), anchor);
      if (contiguousRange.length === 0) {
        return;
      }
      const newSelection = disjunction(rangeSelection, relativeComplement(selection, contiguousRange));
      this.list.setSelection(newSelection, e.browserEvent);
      this.list.setFocus([focus], e.browserEvent);
    } else if (this.isSelectionSingleChangeEvent(e)) {
      const selection = this.list.getSelection();
      const newSelection = selection.filter((i) => i !== focus);
      this.list.setFocus([focus]);
      this.list.setAnchor(focus);
      if (selection.length === newSelection.length) {
        this.list.setSelection([...newSelection, focus], e.browserEvent);
      } else {
        this.list.setSelection(newSelection, e.browserEvent);
      }
    }
  }
  dispose() {
    this.disposables.dispose();
  }
}
class DefaultStyleController {
  constructor(styleElement, selectorSuffix) {
    this.styleElement = styleElement;
    this.selectorSuffix = selectorSuffix;
  }
  style(styles) {
    const suffix = this.selectorSuffix && `.${this.selectorSuffix}`;
    const content = [];
    if (styles.listBackground) {
      content.push(`.monaco-list${suffix} .monaco-list-rows { background: ${styles.listBackground}; }`);
    }
    if (styles.listFocusBackground) {
      content.push(`.monaco-list${suffix}:focus .monaco-list-row.focused { background-color: ${styles.listFocusBackground}; }`);
      content.push(`.monaco-list${suffix}:focus .monaco-list-row.focused:hover { background-color: ${styles.listFocusBackground}; }`);
    }
    if (styles.listFocusForeground) {
      content.push(`.monaco-list${suffix}:focus .monaco-list-row.focused { color: ${styles.listFocusForeground}; }`);
    }
    if (styles.listActiveSelectionBackground) {
      content.push(`.monaco-list${suffix}:focus .monaco-list-row.selected { background-color: ${styles.listActiveSelectionBackground}; }`);
      content.push(`.monaco-list${suffix}:focus .monaco-list-row.selected:hover { background-color: ${styles.listActiveSelectionBackground}; }`);
    }
    if (styles.listActiveSelectionForeground) {
      content.push(`.monaco-list${suffix}:focus .monaco-list-row.selected { color: ${styles.listActiveSelectionForeground}; }`);
    }
    if (styles.listActiveSelectionIconForeground) {
      content.push(`.monaco-list${suffix}:focus .monaco-list-row.selected .codicon { color: ${styles.listActiveSelectionIconForeground}; }`);
    }
    if (styles.listFocusAndSelectionBackground) {
      content.push(`
				.monaco-drag-image${suffix},
				.monaco-list${suffix}:focus .monaco-list-row.selected.focused { background-color: ${styles.listFocusAndSelectionBackground}; }
			`);
    }
    if (styles.listFocusAndSelectionForeground) {
      content.push(`
				.monaco-drag-image${suffix},
				.monaco-list${suffix}:focus .monaco-list-row.selected.focused { color: ${styles.listFocusAndSelectionForeground}; }
			`);
    }
    if (styles.listInactiveFocusForeground) {
      content.push(`.monaco-list${suffix} .monaco-list-row.focused { color:  ${styles.listInactiveFocusForeground}; }`);
      content.push(`.monaco-list${suffix} .monaco-list-row.focused:hover { color:  ${styles.listInactiveFocusForeground}; }`);
    }
    if (styles.listInactiveSelectionIconForeground) {
      content.push(`.monaco-list${suffix} .monaco-list-row.focused .codicon { color:  ${styles.listInactiveSelectionIconForeground}; }`);
    }
    if (styles.listInactiveFocusBackground) {
      content.push(`.monaco-list${suffix} .monaco-list-row.focused { background-color:  ${styles.listInactiveFocusBackground}; }`);
      content.push(`.monaco-list${suffix} .monaco-list-row.focused:hover { background-color:  ${styles.listInactiveFocusBackground}; }`);
    }
    if (styles.listInactiveSelectionBackground) {
      content.push(`.monaco-list${suffix} .monaco-list-row.selected { background-color:  ${styles.listInactiveSelectionBackground}; }`);
      content.push(`.monaco-list${suffix} .monaco-list-row.selected:hover { background-color:  ${styles.listInactiveSelectionBackground}; }`);
    }
    if (styles.listInactiveSelectionForeground) {
      content.push(`.monaco-list${suffix} .monaco-list-row.selected { color: ${styles.listInactiveSelectionForeground}; }`);
    }
    if (styles.listHoverBackground) {
      content.push(`.monaco-list${suffix}:not(.drop-target):not(.dragging) .monaco-list-row:hover:not(.selected):not(.focused) { background-color: ${styles.listHoverBackground}; }`);
    }
    if (styles.listHoverForeground) {
      content.push(`.monaco-list${suffix}:not(.drop-target):not(.dragging) .monaco-list-row:hover:not(.selected):not(.focused) { color:  ${styles.listHoverForeground}; }`);
    }
    const focusAndSelectionOutline = asCssValueWithDefault(styles.listFocusAndSelectionOutline, asCssValueWithDefault(styles.listSelectionOutline, styles.listFocusOutline ?? ""));
    if (focusAndSelectionOutline) {
      content.push(`.monaco-list${suffix}:focus .monaco-list-row.focused.selected { outline: 1px solid ${focusAndSelectionOutline}; outline-offset: -1px;}`);
    }
    if (styles.listFocusOutline) {
      content.push(`
				.monaco-drag-image${suffix},
				.monaco-list${suffix}:focus .monaco-list-row.focused,
				.monaco-workbench.context-menu-visible .monaco-list${suffix}.last-focused .monaco-list-row.focused { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }
			`);
    }
    const inactiveFocusAndSelectionOutline = asCssValueWithDefault(styles.listSelectionOutline, styles.listInactiveFocusOutline ?? "");
    if (inactiveFocusAndSelectionOutline) {
      content.push(`.monaco-list${suffix} .monaco-list-row.focused.selected { outline: 1px dotted ${inactiveFocusAndSelectionOutline}; outline-offset: -1px; }`);
    }
    if (styles.listSelectionOutline) {
      content.push(`.monaco-list${suffix} .monaco-list-row.selected { outline: 1px dotted ${styles.listSelectionOutline}; outline-offset: -1px; }`);
    }
    if (styles.listInactiveFocusOutline) {
      content.push(`.monaco-list${suffix} .monaco-list-row.focused { outline: 1px dotted ${styles.listInactiveFocusOutline}; outline-offset: -1px; }`);
    }
    if (styles.listHoverOutline) {
      content.push(`.monaco-list${suffix} .monaco-list-row:hover { outline: 1px dashed ${styles.listHoverOutline}; outline-offset: -1px; }`);
    }
    if (styles.listDropOverBackground) {
      content.push(`
				.monaco-list${suffix}.drop-target,
				.monaco-list${suffix} .monaco-list-rows.drop-target,
				.monaco-list${suffix} .monaco-list-row.drop-target { background-color: ${styles.listDropOverBackground} !important; color: inherit !important; }
			`);
    }
    if (styles.listDropBetweenBackground) {
      content.push(`
			.monaco-list${suffix} .monaco-list-rows.drop-target-before .monaco-list-row:first-child::before,
			.monaco-list${suffix} .monaco-list-row.drop-target-before::before {
				content: ""; position: absolute; top: 0px; left: 0px; width: 100%; height: 1px;
				background-color: ${styles.listDropBetweenBackground};
			}`);
      content.push(`
			.monaco-list${suffix} .monaco-list-rows.drop-target-after .monaco-list-row:last-child::after,
			.monaco-list${suffix} .monaco-list-row.drop-target-after::after {
				content: ""; position: absolute; bottom: 0px; left: 0px; width: 100%; height: 1px;
				background-color: ${styles.listDropBetweenBackground};
			}`);
    }
    if (styles.tableColumnsBorder) {
      content.push(`
				.monaco-table > .monaco-split-view2,
				.monaco-table > .monaco-split-view2 .monaco-sash.vertical::before,
				.monaco-workbench:not(.reduce-motion) .monaco-table:hover > .monaco-split-view2,
				.monaco-workbench:not(.reduce-motion) .monaco-table:hover > .monaco-split-view2 .monaco-sash.vertical::before {
					border-color: ${styles.tableColumnsBorder};
				}

				.monaco-workbench:not(.reduce-motion) .monaco-table > .monaco-split-view2,
				.monaco-workbench:not(.reduce-motion) .monaco-table > .monaco-split-view2 .monaco-sash.vertical::before {
					border-color: transparent;
				}
			`);
    }
    if (styles.tableOddRowsBackgroundColor) {
      content.push(`
				.monaco-table .monaco-list-row[data-parity=odd]:not(.focused):not(.selected):not(:hover) .monaco-table-tr,
				.monaco-table .monaco-list:not(:focus) .monaco-list-row[data-parity=odd].focused:not(.selected):not(:hover) .monaco-table-tr,
				.monaco-table .monaco-list:not(.focused) .monaco-list-row[data-parity=odd].focused:not(.selected):not(:hover) .monaco-table-tr {
					background-color: ${styles.tableOddRowsBackgroundColor};
				}
			`);
    }
    this.styleElement.textContent = content.join("\n");
  }
}
const unthemedListStyles = {
  listFocusBackground: "#7FB0D0",
  listActiveSelectionBackground: "#0E639C",
  listActiveSelectionForeground: "#FFFFFF",
  listActiveSelectionIconForeground: "#FFFFFF",
  listFocusAndSelectionOutline: "#90C2F9",
  listFocusAndSelectionBackground: "#094771",
  listFocusAndSelectionForeground: "#FFFFFF",
  listInactiveSelectionBackground: "#3F3F46",
  listInactiveSelectionIconForeground: "#FFFFFF",
  listHoverBackground: "#2A2D2E",
  listDropOverBackground: "#383B3D",
  listDropBetweenBackground: "#EEEEEE",
  treeIndentGuidesStroke: "#a9a9a9",
  treeInactiveIndentGuidesStroke: Color.fromHex("#a9a9a9").transparent(0.4).toString(),
  tableColumnsBorder: Color.fromHex("#cccccc").transparent(0.2).toString(),
  tableOddRowsBackgroundColor: Color.fromHex("#cccccc").transparent(0.04).toString(),
  listBackground: void 0,
  listFocusForeground: void 0,
  listInactiveSelectionForeground: void 0,
  listInactiveFocusForeground: void 0,
  listInactiveFocusBackground: void 0,
  listHoverForeground: void 0,
  listFocusOutline: void 0,
  listInactiveFocusOutline: void 0,
  listSelectionOutline: void 0,
  listHoverOutline: void 0,
  treeStickyScrollBackground: void 0,
  treeStickyScrollBorder: void 0,
  treeStickyScrollShadow: void 0
};
const DefaultOptions = {
  keyboardSupport: true,
  mouseSupport: true,
  multipleSelectionSupport: true,
  dnd: {
    getDragURI() {
      return null;
    },
    onDragStart() {
    },
    onDragOver() {
      return false;
    },
    drop() {
    },
    dispose() {
    }
  }
};
function getContiguousRangeContaining(range2, value) {
  const index = range2.indexOf(value);
  if (index === -1) {
    return [];
  }
  const result = [];
  let i = index - 1;
  while (i >= 0 && range2[i] === value - (index - i)) {
    result.push(range2[i--]);
  }
  result.reverse();
  i = index;
  while (i < range2.length && range2[i] === value + (i - index)) {
    result.push(range2[i++]);
  }
  return result;
}
function disjunction(one, other) {
  const result = [];
  let i = 0, j = 0;
  while (i < one.length || j < other.length) {
    if (i >= one.length) {
      result.push(other[j++]);
    } else if (j >= other.length) {
      result.push(one[i++]);
    } else if (one[i] === other[j]) {
      result.push(one[i]);
      i++;
      j++;
      continue;
    } else if (one[i] < other[j]) {
      result.push(one[i++]);
    } else {
      result.push(other[j++]);
    }
  }
  return result;
}
function relativeComplement(one, other) {
  const result = [];
  let i = 0, j = 0;
  while (i < one.length || j < other.length) {
    if (i >= one.length) {
      result.push(other[j++]);
    } else if (j >= other.length) {
      result.push(one[i++]);
    } else if (one[i] === other[j]) {
      i++;
      j++;
      continue;
    } else if (one[i] < other[j]) {
      result.push(one[i++]);
    } else {
      j++;
    }
  }
  return result;
}
const numericSort = (a, b) => a - b;
class PipelineRenderer {
  constructor(_templateId, renderers) {
    this._templateId = _templateId;
    this.renderers = renderers;
  }
  get templateId() {
    return this._templateId;
  }
  renderTemplate(container) {
    return this.renderers.map((r) => r.renderTemplate(container));
  }
  renderElement(element, index, templateData, height) {
    let i = 0;
    for (const renderer of this.renderers) {
      renderer.renderElement(element, index, templateData[i++], height);
    }
  }
  disposeElement(element, index, templateData, height) {
    let i = 0;
    for (const renderer of this.renderers) {
      renderer.disposeElement?.(element, index, templateData[i], height);
      i += 1;
    }
  }
  disposeTemplate(templateData) {
    let i = 0;
    for (const renderer of this.renderers) {
      renderer.disposeTemplate(templateData[i++]);
    }
  }
}
class AccessibiltyRenderer {
  constructor(accessibilityProvider) {
    this.accessibilityProvider = accessibilityProvider;
    this.templateId = "a18n";
  }
  renderTemplate(container) {
    return { container, disposables: new DisposableStore() };
  }
  renderElement(element, index, data) {
    const ariaLabel = this.accessibilityProvider.getAriaLabel(element);
    const observable = ariaLabel && typeof ariaLabel !== "string" ? ariaLabel : constObservable(ariaLabel);
    data.disposables.add(autorun((reader) => {
      this.setAriaLabel(reader.readObservable(observable), data.container);
    }));
    const ariaLevel = this.accessibilityProvider.getAriaLevel && this.accessibilityProvider.getAriaLevel(element);
    if (typeof ariaLevel === "number") {
      data.container.setAttribute("aria-level", `${ariaLevel}`);
    } else {
      data.container.removeAttribute("aria-level");
    }
  }
  setAriaLabel(ariaLabel, element) {
    if (ariaLabel) {
      element.setAttribute("aria-label", ariaLabel);
    } else {
      element.removeAttribute("aria-label");
    }
  }
  disposeElement(element, index, templateData, height) {
    templateData.disposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
}
class ListViewDragAndDrop {
  constructor(list, dnd) {
    this.list = list;
    this.dnd = dnd;
  }
  getDragElements(element) {
    const selection = this.list.getSelectedElements();
    const elements = selection.indexOf(element) > -1 ? selection : [element];
    return elements;
  }
  getDragURI(element) {
    return this.dnd.getDragURI(element);
  }
  getDragLabel(elements, originalEvent) {
    if (this.dnd.getDragLabel) {
      return this.dnd.getDragLabel(elements, originalEvent);
    }
    return void 0;
  }
  onDragStart(data, originalEvent) {
    this.dnd.onDragStart?.(data, originalEvent);
  }
  onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
    return this.dnd.onDragOver(data, targetElement, targetIndex, targetSector, originalEvent);
  }
  onDragLeave(data, targetElement, targetIndex, originalEvent) {
    this.dnd.onDragLeave?.(data, targetElement, targetIndex, originalEvent);
  }
  onDragEnd(originalEvent) {
    this.dnd.onDragEnd?.(originalEvent);
  }
  drop(data, targetElement, targetIndex, targetSector, originalEvent) {
    this.dnd.drop(data, targetElement, targetIndex, targetSector, originalEvent);
  }
  dispose() {
    this.dnd.dispose();
  }
}
class List {
  constructor(user, container, virtualDelegate, renderers, _options = DefaultOptions) {
    this.user = user;
    this._options = _options;
    this.focus = new Trait("focused");
    this.anchor = new Trait("anchor");
    this.eventBufferer = new EventBufferer();
    this._ariaLabel = "";
    this.disposables = new DisposableStore();
    this._onDidDispose = new Emitter();
    this.onDidDispose = this._onDidDispose.event;
    const role = this._options.accessibilityProvider && this._options.accessibilityProvider.getWidgetRole ? this._options.accessibilityProvider?.getWidgetRole() : "list";
    this.selection = new SelectionTrait(role !== "listbox");
    const baseRenderers = [this.focus.renderer, this.selection.renderer];
    this.accessibilityProvider = _options.accessibilityProvider;
    if (this.accessibilityProvider) {
      baseRenderers.push(new AccessibiltyRenderer(this.accessibilityProvider));
      this.accessibilityProvider.onDidChangeActiveDescendant?.(this.onDidChangeActiveDescendant, this, this.disposables);
    }
    renderers = renderers.map((r) => new PipelineRenderer(r.templateId, [...baseRenderers, r]));
    const viewOptions = {
      ..._options,
      dnd: _options.dnd && new ListViewDragAndDrop(this, _options.dnd)
    };
    this.view = this.createListView(container, virtualDelegate, renderers, viewOptions);
    this.view.domNode.setAttribute("role", role);
    if (_options.styleController) {
      this.styleController = _options.styleController(this.view.domId);
    } else {
      const styleElement = createStyleSheet(this.view.domNode);
      this.styleController = new DefaultStyleController(styleElement, this.view.domId);
    }
    this.spliceable = new CombinedSpliceable([
      new TraitSpliceable(this.focus, this.view, _options.identityProvider),
      new TraitSpliceable(this.selection, this.view, _options.identityProvider),
      new TraitSpliceable(this.anchor, this.view, _options.identityProvider),
      this.view
    ]);
    this.disposables.add(this.focus);
    this.disposables.add(this.selection);
    this.disposables.add(this.anchor);
    this.disposables.add(this.view);
    this.disposables.add(this._onDidDispose);
    this.disposables.add(new DOMFocusController(this, this.view));
    if (typeof _options.keyboardSupport !== "boolean" || _options.keyboardSupport) {
      this.keyboardController = new KeyboardController(this, this.view, _options);
      this.disposables.add(this.keyboardController);
    }
    if (_options.keyboardNavigationLabelProvider) {
      const delegate = _options.keyboardNavigationDelegate || DefaultKeyboardNavigationDelegate;
      this.typeNavigationController = new TypeNavigationController(this, this.view, _options.keyboardNavigationLabelProvider, _options.keyboardNavigationEventFilter ?? (() => true), delegate);
      this.disposables.add(this.typeNavigationController);
    }
    this.mouseController = this.createMouseController(_options);
    this.disposables.add(this.mouseController);
    this.onDidChangeFocus(this._onFocusChange, this, this.disposables);
    this.onDidChangeSelection(this._onSelectionChange, this, this.disposables);
    if (this.accessibilityProvider) {
      this.ariaLabel = this.accessibilityProvider.getWidgetAriaLabel();
    }
    if (this._options.multipleSelectionSupport !== false) {
      this.view.domNode.setAttribute("aria-multiselectable", "true");
    }
  }
  get onDidChangeFocus() {
    return Event.map(this.eventBufferer.wrapEvent(this.focus.onChange), (e) => this.toListEvent(e), this.disposables);
  }
  get onDidChangeSelection() {
    return Event.map(this.eventBufferer.wrapEvent(this.selection.onChange), (e) => this.toListEvent(e), this.disposables);
  }
  get domId() {
    return this.view.domId;
  }
  get onDidScroll() {
    return this.view.onDidScroll;
  }
  get onMouseClick() {
    return this.view.onMouseClick;
  }
  get onMouseDblClick() {
    return this.view.onMouseDblClick;
  }
  get onMouseMiddleClick() {
    return this.view.onMouseMiddleClick;
  }
  get onPointer() {
    return this.mouseController.onPointer;
  }
  get onMouseUp() {
    return this.view.onMouseUp;
  }
  get onMouseDown() {
    return this.view.onMouseDown;
  }
  get onMouseOver() {
    return this.view.onMouseOver;
  }
  get onMouseMove() {
    return this.view.onMouseMove;
  }
  get onMouseOut() {
    return this.view.onMouseOut;
  }
  get onTouchStart() {
    return this.view.onTouchStart;
  }
  get onTap() {
    return this.view.onTap;
  }
  get onContextMenu() {
    let didJustPressContextMenuKey = false;
    const fromKeyDown = Event.chain(this.disposables.add(new DomEmitter(this.view.domNode, "keydown")).event, ($) => $.map((e) => new StandardKeyboardEvent(e)).filter((e) => didJustPressContextMenuKey = e.keyCode === KeyCode.ContextMenu || e.shiftKey && e.keyCode === KeyCode.F10).map((e) => EventHelper.stop(e, true)).filter(() => false));
    const fromKeyUp = Event.chain(this.disposables.add(new DomEmitter(this.view.domNode, "keyup")).event, ($) => $.forEach(() => didJustPressContextMenuKey = false).map((e) => new StandardKeyboardEvent(e)).filter((e) => e.keyCode === KeyCode.ContextMenu || e.shiftKey && e.keyCode === KeyCode.F10).map((e) => EventHelper.stop(e, true)).map(({ browserEvent }) => {
      const focus = this.getFocus();
      const index = focus.length ? focus[0] : void 0;
      const element = typeof index !== "undefined" ? this.view.element(index) : void 0;
      const anchor = typeof index !== "undefined" ? this.view.domElement(index) : this.view.domNode;
      return { index, element, anchor, browserEvent };
    }));
    const fromMouse = Event.chain(
      this.view.onContextMenu,
      ($) => $.filter((_) => !didJustPressContextMenuKey).map(({ element, index, browserEvent }) => ({ element, index, anchor: new StandardMouseEvent(getWindow(this.view.domNode), browserEvent), browserEvent }))
    );
    return Event.any(fromKeyDown, fromKeyUp, fromMouse);
  }
  get onKeyDown() {
    return this.disposables.add(new DomEmitter(this.view.domNode, "keydown")).event;
  }
  get onKeyUp() {
    return this.disposables.add(new DomEmitter(this.view.domNode, "keyup")).event;
  }
  get onKeyPress() {
    return this.disposables.add(new DomEmitter(this.view.domNode, "keypress")).event;
  }
  get onDidFocus() {
    return Event.signal(this.disposables.add(new DomEmitter(this.view.domNode, "focus", true)).event);
  }
  get onDidBlur() {
    return Event.signal(this.disposables.add(new DomEmitter(this.view.domNode, "blur", true)).event);
  }
  createListView(container, virtualDelegate, renderers, viewOptions) {
    return new ListView(container, virtualDelegate, renderers, viewOptions);
  }
  createMouseController(options) {
    return new MouseController(this);
  }
  updateOptions(optionsUpdate = {}) {
    this._options = { ...this._options, ...optionsUpdate };
    this.typeNavigationController?.updateOptions(this._options);
    if (this._options.multipleSelectionController !== void 0) {
      if (this._options.multipleSelectionSupport) {
        this.view.domNode.setAttribute("aria-multiselectable", "true");
      } else {
        this.view.domNode.removeAttribute("aria-multiselectable");
      }
    }
    this.mouseController.updateOptions(optionsUpdate);
    this.keyboardController?.updateOptions(optionsUpdate);
    this.view.updateOptions(optionsUpdate);
  }
  get options() {
    return this._options;
  }
  splice(start, deleteCount, elements = []) {
    if (start < 0 || start > this.view.length) {
      throw new ListError(this.user, `Invalid start index: ${start}`);
    }
    if (deleteCount < 0) {
      throw new ListError(this.user, `Invalid delete count: ${deleteCount}`);
    }
    if (deleteCount === 0 && elements.length === 0) {
      return;
    }
    this.eventBufferer.bufferEvents(() => this.spliceable.splice(start, deleteCount, elements));
  }
  updateWidth(index) {
    this.view.updateWidth(index);
  }
  updateElementHeight(index, size) {
    this.view.updateElementHeight(index, size, null);
  }
  rerender() {
    this.view.rerender();
  }
  element(index) {
    return this.view.element(index);
  }
  indexOf(element) {
    return this.view.indexOf(element);
  }
  indexAt(position) {
    return this.view.indexAt(position);
  }
  get length() {
    return this.view.length;
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
    return this.view.getScrollTop();
  }
  set scrollTop(scrollTop) {
    this.view.setScrollTop(scrollTop);
  }
  get scrollLeft() {
    return this.view.getScrollLeft();
  }
  set scrollLeft(scrollLeft) {
    this.view.setScrollLeft(scrollLeft);
  }
  get scrollHeight() {
    return this.view.scrollHeight;
  }
  get renderHeight() {
    return this.view.renderHeight;
  }
  get firstVisibleIndex() {
    return this.view.firstVisibleIndex;
  }
  get firstMostlyVisibleIndex() {
    return this.view.firstMostlyVisibleIndex;
  }
  get lastVisibleIndex() {
    return this.view.lastVisibleIndex;
  }
  get ariaLabel() {
    return this._ariaLabel;
  }
  set ariaLabel(value) {
    this._ariaLabel = value;
    this.view.domNode.setAttribute("aria-label", value);
  }
  domFocus() {
    this.view.domNode.focus({ preventScroll: true });
  }
  layout(height, width) {
    this.view.layout(height, width);
  }
  triggerTypeNavigation() {
    this.typeNavigationController?.trigger();
  }
  setSelection(indexes, browserEvent) {
    for (const index of indexes) {
      if (index < 0 || index >= this.length) {
        throw new ListError(this.user, `Invalid index ${index}`);
      }
    }
    this.selection.set(indexes, browserEvent);
  }
  getSelection() {
    return this.selection.get();
  }
  getSelectedElements() {
    return this.getSelection().map((i) => this.view.element(i));
  }
  setAnchor(index) {
    if (typeof index === "undefined") {
      this.anchor.set([]);
      return;
    }
    if (index < 0 || index >= this.length) {
      throw new ListError(this.user, `Invalid index ${index}`);
    }
    this.anchor.set([index]);
  }
  getAnchor() {
    return this.anchor.get().at(0);
  }
  getAnchorElement() {
    const anchor = this.getAnchor();
    return typeof anchor === "undefined" ? void 0 : this.element(anchor);
  }
  setFocus(indexes, browserEvent) {
    for (const index of indexes) {
      if (index < 0 || index >= this.length) {
        throw new ListError(this.user, `Invalid index ${index}`);
      }
    }
    this.focus.set(indexes, browserEvent);
  }
  focusNext(n = 1, loop = false, browserEvent, filter) {
    if (this.length === 0) {
      return;
    }
    const focus = this.focus.get();
    const index = this.findNextIndex(focus.length > 0 ? focus[0] + n : 0, loop, filter);
    if (index > -1) {
      this.setFocus([index], browserEvent);
    }
  }
  focusPrevious(n = 1, loop = false, browserEvent, filter) {
    if (this.length === 0) {
      return;
    }
    const focus = this.focus.get();
    const index = this.findPreviousIndex(focus.length > 0 ? focus[0] - n : 0, loop, filter);
    if (index > -1) {
      this.setFocus([index], browserEvent);
    }
  }
  async focusNextPage(browserEvent, filter) {
    let lastPageIndex = this.view.indexAt(this.view.getScrollTop() + this.view.renderHeight);
    lastPageIndex = lastPageIndex === 0 ? 0 : lastPageIndex - 1;
    const currentlyFocusedElementIndex = this.getFocus()[0];
    if (currentlyFocusedElementIndex !== lastPageIndex && (currentlyFocusedElementIndex === void 0 || lastPageIndex > currentlyFocusedElementIndex)) {
      const lastGoodPageIndex = this.findPreviousIndex(lastPageIndex, false, filter);
      if (lastGoodPageIndex > -1 && currentlyFocusedElementIndex !== lastGoodPageIndex) {
        this.setFocus([lastGoodPageIndex], browserEvent);
      } else {
        this.setFocus([lastPageIndex], browserEvent);
      }
    } else {
      const previousScrollTop = this.view.getScrollTop();
      let nextpageScrollTop = previousScrollTop + this.view.renderHeight;
      if (lastPageIndex > currentlyFocusedElementIndex) {
        nextpageScrollTop -= this.view.elementHeight(lastPageIndex);
      }
      this.view.setScrollTop(nextpageScrollTop);
      if (this.view.getScrollTop() !== previousScrollTop) {
        this.setFocus([]);
        await timeout(0);
        await this.focusNextPage(browserEvent, filter);
      }
    }
  }
  async focusPreviousPage(browserEvent, filter, getPaddingTop = () => 0) {
    let firstPageIndex;
    const paddingTop = getPaddingTop();
    const scrollTop = this.view.getScrollTop() + paddingTop;
    if (scrollTop === 0) {
      firstPageIndex = this.view.indexAt(scrollTop);
    } else {
      firstPageIndex = this.view.indexAfter(scrollTop - 1);
    }
    const currentlyFocusedElementIndex = this.getFocus()[0];
    if (currentlyFocusedElementIndex !== firstPageIndex && (currentlyFocusedElementIndex === void 0 || currentlyFocusedElementIndex >= firstPageIndex)) {
      const firstGoodPageIndex = this.findNextIndex(firstPageIndex, false, filter);
      if (firstGoodPageIndex > -1 && currentlyFocusedElementIndex !== firstGoodPageIndex) {
        this.setFocus([firstGoodPageIndex], browserEvent);
      } else {
        this.setFocus([firstPageIndex], browserEvent);
      }
    } else {
      const previousScrollTop = scrollTop;
      this.view.setScrollTop(scrollTop - this.view.renderHeight - paddingTop);
      if (this.view.getScrollTop() + getPaddingTop() !== previousScrollTop) {
        this.setFocus([]);
        await timeout(0);
        await this.focusPreviousPage(browserEvent, filter, getPaddingTop);
      }
    }
  }
  focusLast(browserEvent, filter) {
    if (this.length === 0) {
      return;
    }
    const index = this.findPreviousIndex(this.length - 1, false, filter);
    if (index > -1) {
      this.setFocus([index], browserEvent);
    }
  }
  focusFirst(browserEvent, filter) {
    this.focusNth(0, browserEvent, filter);
  }
  focusNth(n, browserEvent, filter) {
    if (this.length === 0) {
      return;
    }
    const index = this.findNextIndex(n, false, filter);
    if (index > -1) {
      this.setFocus([index], browserEvent);
    }
  }
  findNextIndex(index, loop = false, filter) {
    for (let i = 0; i < this.length; i++) {
      if (index >= this.length && !loop) {
        return -1;
      }
      index = index % this.length;
      if (!filter || filter(this.element(index))) {
        return index;
      }
      index++;
    }
    return -1;
  }
  findPreviousIndex(index, loop = false, filter) {
    for (let i = 0; i < this.length; i++) {
      if (index < 0 && !loop) {
        return -1;
      }
      index = (this.length + index % this.length) % this.length;
      if (!filter || filter(this.element(index))) {
        return index;
      }
      index--;
    }
    return -1;
  }
  getFocus() {
    return this.focus.get();
  }
  getFocusedElements() {
    return this.getFocus().map((i) => this.view.element(i));
  }
  reveal(index, relativeTop, paddingTop = 0) {
    if (index < 0 || index >= this.length) {
      throw new ListError(this.user, `Invalid index ${index}`);
    }
    const scrollTop = this.view.getScrollTop();
    const elementTop = this.view.elementTop(index);
    const elementHeight = this.view.elementHeight(index);
    if (isNumber(relativeTop)) {
      const m = elementHeight - this.view.renderHeight + paddingTop;
      this.view.setScrollTop(m * clamp(relativeTop, 0, 1) + elementTop - paddingTop);
    } else {
      const viewItemBottom = elementTop + elementHeight;
      const scrollBottom = scrollTop + this.view.renderHeight;
      if (elementTop < scrollTop + paddingTop && viewItemBottom >= scrollBottom) {
      } else if (elementTop < scrollTop + paddingTop || viewItemBottom >= scrollBottom && elementHeight >= this.view.renderHeight) {
        this.view.setScrollTop(elementTop - paddingTop);
      } else if (viewItemBottom >= scrollBottom) {
        this.view.setScrollTop(viewItemBottom - this.view.renderHeight);
      }
    }
  }
  /**
   * Returns the relative position of an element rendered in the list.
   * Returns `null` if the element isn't *entirely* in the visible viewport.
   */
  getRelativeTop(index, paddingTop = 0) {
    if (index < 0 || index >= this.length) {
      throw new ListError(this.user, `Invalid index ${index}`);
    }
    const scrollTop = this.view.getScrollTop();
    const elementTop = this.view.elementTop(index);
    const elementHeight = this.view.elementHeight(index);
    if (elementTop < scrollTop + paddingTop || elementTop + elementHeight > scrollTop + this.view.renderHeight) {
      return null;
    }
    const m = elementHeight - this.view.renderHeight + paddingTop;
    return Math.abs((scrollTop + paddingTop - elementTop) / m);
  }
  isDOMFocused() {
    return isActiveElement(this.view.domNode);
  }
  getHTMLElement() {
    return this.view.domNode;
  }
  getScrollableElement() {
    return this.view.scrollableElementDomNode;
  }
  getElementID(index) {
    return this.view.getElementDomId(index);
  }
  getElementTop(index) {
    return this.view.elementTop(index);
  }
  style(styles) {
    this.styleController.style(styles);
  }
  toListEvent({ indexes, browserEvent }) {
    return { indexes, elements: indexes.map((i) => this.view.element(i)), browserEvent };
  }
  _onFocusChange() {
    const focus = this.focus.get();
    this.view.domNode.classList.toggle("element-focused", focus.length > 0);
    this.onDidChangeActiveDescendant();
  }
  onDidChangeActiveDescendant() {
    const focus = this.focus.get();
    if (focus.length > 0) {
      let id;
      if (this.accessibilityProvider?.getActiveDescendantId) {
        id = this.accessibilityProvider.getActiveDescendantId(this.view.element(focus[0]));
      }
      this.view.domNode.setAttribute("aria-activedescendant", id || this.view.getElementDomId(focus[0]));
    } else {
      this.view.domNode.removeAttribute("aria-activedescendant");
    }
  }
  _onSelectionChange() {
    const selection = this.selection.get();
    this.view.domNode.classList.toggle("selection-none", selection.length === 0);
    this.view.domNode.classList.toggle("selection-single", selection.length === 1);
    this.view.domNode.classList.toggle("selection-multiple", selection.length > 1);
  }
  dispose() {
    this._onDidDispose.fire();
    this.disposables.dispose();
    this._onDidDispose.dispose();
  }
}
__decorateClass([
  memoize
], List.prototype, "onDidChangeFocus", 1);
__decorateClass([
  memoize
], List.prototype, "onDidChangeSelection", 1);
__decorateClass([
  memoize
], List.prototype, "onContextMenu", 1);
__decorateClass([
  memoize
], List.prototype, "onKeyDown", 1);
__decorateClass([
  memoize
], List.prototype, "onKeyUp", 1);
__decorateClass([
  memoize
], List.prototype, "onKeyPress", 1);
__decorateClass([
  memoize
], List.prototype, "onDidFocus", 1);
__decorateClass([
  memoize
], List.prototype, "onDidBlur", 1);
export {
  DefaultKeyboardNavigationDelegate,
  DefaultStyleController,
  List,
  MouseController,
  TypeNavigationMode,
  isActionItem,
  isButton,
  isMonacoCustomToggle,
  isMonacoEditor,
  isMonacoTwistie,
  isSelectionRangeChangeEvent,
  isSelectionSingleChangeEvent,
  isStickyScrollContainer,
  isStickyScrollElement,
  unthemedListStyles
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSURyYWdBbmREcm9wRGF0YSB9IGZyb20gJy4uLy4uL2RuZC5qcyc7XG5pbXBvcnQgeyBEaW1lbnNpb24sIEV2ZW50SGVscGVyLCBnZXRBY3RpdmVFbGVtZW50LCBnZXRXaW5kb3csIGlzQWN0aXZlRWxlbWVudCwgaXNFZGl0YWJsZUVsZW1lbnQsIGlzSFRNTEVsZW1lbnQsIGlzTW91c2VFdmVudCB9IGZyb20gJy4uLy4uL2RvbS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTdHlsZVNoZWV0IH0gZnJvbSAnLi4vLi4vZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgYXNDc3NWYWx1ZVdpdGhEZWZhdWx0IH0gZnJvbSAnLi4vLi4vY3NzVmFsdWUuanMnO1xuaW1wb3J0IHsgRG9tRW1pdHRlciB9IGZyb20gJy4uLy4uL2V2ZW50LmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50LCBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEdlc3R1cmUgfSBmcm9tICcuLi8uLi90b3VjaC5qcyc7XG5pbXBvcnQgeyBhbGVydCwgQXJpYVJvbGUgfSBmcm9tICcuLi9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgQ29tYmluZWRTcGxpY2VhYmxlIH0gZnJvbSAnLi9zcGxpY2UuanMnO1xuaW1wb3J0IHsgU2Nyb2xsYWJsZUVsZW1lbnRDaGFuZ2VPcHRpb25zIH0gZnJvbSAnLi4vc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50T3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBiaW5hcnlTZWFyY2gsIHJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCwgRXZlbnRCdWZmZXJlciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBtYXRjaGVzRnV6enkyLCBtYXRjaGVzUHJlZml4IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTY3JvbGxiYXJWaXNpYmlsaXR5LCBTY3JvbGxFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcbmltcG9ydCB7IElTcGxpY2VhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcXVlbmNlLmpzJztcbmltcG9ydCB7IGlzTnVtYmVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAnLi9saXN0LmNzcyc7XG5pbXBvcnQgeyBJSWRlbnRpdHlQcm92aWRlciwgSUtleWJvYXJkTmF2aWdhdGlvbkRlbGVnYXRlLCBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciwgSUxpc3RDb250ZXh0TWVudUV2ZW50LCBJTGlzdERyYWdBbmREcm9wLCBJTGlzdERyYWdPdmVyUmVhY3Rpb24sIElMaXN0RXZlbnQsIElMaXN0R2VzdHVyZUV2ZW50LCBJTGlzdE1vdXNlRXZlbnQsIElMaXN0UmVuZGVyZXIsIElMaXN0VG91Y2hFdmVudCwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUsIExpc3RFcnJvciB9IGZyb20gJy4vbGlzdC5qcyc7XG5pbXBvcnQgeyBJTGlzdFZpZXcsIElMaXN0Vmlld0FjY2Vzc2liaWxpdHlQcm92aWRlciwgSUxpc3RWaWV3RHJhZ0FuZERyb3AsIElMaXN0Vmlld09wdGlvbnMsIElMaXN0Vmlld09wdGlvbnNVcGRhdGUsIExpc3RWaWV3VGFyZ2V0U2VjdG9yLCBMaXN0VmlldyB9IGZyb20gJy4vbGlzdFZpZXcuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBjb25zdE9ic2VydmFibGUsIElPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL29ic2VydmFibGUuanMnO1xuXG5pbnRlcmZhY2UgSVRyYWl0Q2hhbmdlRXZlbnQge1xuXHRpbmRleGVzOiBudW1iZXJbXTtcblx0YnJvd3NlckV2ZW50PzogVUlFdmVudDtcbn1cblxudHlwZSBJVHJhaXRUZW1wbGF0ZURhdGEgPSBIVE1MRWxlbWVudDtcblxudHlwZSBJQWNjZXNzaWJpbGl0eVRlbXBsYXRlRGF0YSA9IHtcblx0Y29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0ZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn07XG5cbmludGVyZmFjZSBJUmVuZGVyZWRDb250YWluZXIge1xuXHR0ZW1wbGF0ZURhdGE6IElUcmFpdFRlbXBsYXRlRGF0YTtcblx0aW5kZXg6IG51bWJlcjtcbn1cblxuY2xhc3MgVHJhaXRSZW5kZXJlcjxUPiBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8VCwgSVRyYWl0VGVtcGxhdGVEYXRhPiB7XG5cdHByaXZhdGUgcmVuZGVyZWRFbGVtZW50czogSVJlbmRlcmVkQ29udGFpbmVyW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHRyYWl0OiBUcmFpdDxUPikgeyB9XG5cblx0Z2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYHRlbXBsYXRlOiR7dGhpcy50cmFpdC5uYW1lfWA7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVRyYWl0VGVtcGxhdGVEYXRhIHtcblx0XHRyZXR1cm4gY29udGFpbmVyO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBULCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElUcmFpdFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlbmRlcmVkRWxlbWVudEluZGV4ID0gdGhpcy5yZW5kZXJlZEVsZW1lbnRzLmZpbmRJbmRleChlbCA9PiBlbC50ZW1wbGF0ZURhdGEgPT09IHRlbXBsYXRlRGF0YSk7XG5cblx0XHRpZiAocmVuZGVyZWRFbGVtZW50SW5kZXggPj0gMCkge1xuXHRcdFx0Y29uc3QgcmVuZGVyZWQgPSB0aGlzLnJlbmRlcmVkRWxlbWVudHNbcmVuZGVyZWRFbGVtZW50SW5kZXhdO1xuXHRcdFx0dGhpcy50cmFpdC51bnJlbmRlcih0ZW1wbGF0ZURhdGEpO1xuXHRcdFx0cmVuZGVyZWQuaW5kZXggPSBpbmRleDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgcmVuZGVyZWQgPSB7IGluZGV4LCB0ZW1wbGF0ZURhdGEgfTtcblx0XHRcdHRoaXMucmVuZGVyZWRFbGVtZW50cy5wdXNoKHJlbmRlcmVkKTtcblx0XHR9XG5cblx0XHR0aGlzLnRyYWl0LnJlbmRlckluZGV4KGluZGV4LCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0c3BsaWNlKHN0YXJ0OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIGluc2VydENvdW50OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCByZW5kZXJlZDogSVJlbmRlcmVkQ29udGFpbmVyW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgcmVuZGVyZWRFbGVtZW50IG9mIHRoaXMucmVuZGVyZWRFbGVtZW50cykge1xuXG5cdFx0XHRpZiAocmVuZGVyZWRFbGVtZW50LmluZGV4IDwgc3RhcnQpIHtcblx0XHRcdFx0cmVuZGVyZWQucHVzaChyZW5kZXJlZEVsZW1lbnQpO1xuXHRcdFx0fSBlbHNlIGlmIChyZW5kZXJlZEVsZW1lbnQuaW5kZXggPj0gc3RhcnQgKyBkZWxldGVDb3VudCkge1xuXHRcdFx0XHRyZW5kZXJlZC5wdXNoKHtcblx0XHRcdFx0XHRpbmRleDogcmVuZGVyZWRFbGVtZW50LmluZGV4ICsgaW5zZXJ0Q291bnQgLSBkZWxldGVDb3VudCxcblx0XHRcdFx0XHR0ZW1wbGF0ZURhdGE6IHJlbmRlcmVkRWxlbWVudC50ZW1wbGF0ZURhdGFcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJlZEVsZW1lbnRzID0gcmVuZGVyZWQ7XG5cdH1cblxuXHRyZW5kZXJJbmRleGVzKGluZGV4ZXM6IG51bWJlcltdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCB7IGluZGV4LCB0ZW1wbGF0ZURhdGEgfSBvZiB0aGlzLnJlbmRlcmVkRWxlbWVudHMpIHtcblx0XHRcdGlmIChpbmRleGVzLmluZGV4T2YoaW5kZXgpID4gLTEpIHtcblx0XHRcdFx0dGhpcy50cmFpdC5yZW5kZXJJbmRleChpbmRleCwgdGVtcGxhdGVEYXRhKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJVHJhaXRUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMucmVuZGVyZWRFbGVtZW50cy5maW5kSW5kZXgoZWwgPT4gZWwudGVtcGxhdGVEYXRhID09PSB0ZW1wbGF0ZURhdGEpO1xuXG5cdFx0aWYgKGluZGV4IDwgMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZWRFbGVtZW50cy5zcGxpY2UoaW5kZXgsIDEpO1xuXHR9XG59XG5cbmNsYXNzIFRyYWl0PFQ+IGltcGxlbWVudHMgSVNwbGljZWFibGU8Ym9vbGVhbj4sIElEaXNwb3NhYmxlIHtcblxuXHRwcm90ZWN0ZWQgaW5kZXhlczogbnVtYmVyW10gPSBbXTtcblx0cHJvdGVjdGVkIHNvcnRlZEluZGV4ZXM6IG51bWJlcltdID0gW107XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25DaGFuZ2UgPSBuZXcgRW1pdHRlcjxJVHJhaXRDaGFuZ2VFdmVudD4oKTtcblx0cmVhZG9ubHkgb25DaGFuZ2U6IEV2ZW50PElUcmFpdENoYW5nZUV2ZW50PiA9IHRoaXMuX29uQ2hhbmdlLmV2ZW50O1xuXG5cdGdldCBuYW1lKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLl90cmFpdDsgfVxuXG5cdEBtZW1vaXplXG5cdGdldCByZW5kZXJlcigpOiBUcmFpdFJlbmRlcmVyPFQ+IHtcblx0XHRyZXR1cm4gbmV3IFRyYWl0UmVuZGVyZXI8VD4odGhpcyk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIF90cmFpdDogc3RyaW5nKSB7IH1cblxuXHRzcGxpY2Uoc3RhcnQ6IG51bWJlciwgZGVsZXRlQ291bnQ6IG51bWJlciwgZWxlbWVudHM6IGJvb2xlYW5bXSk6IHZvaWQge1xuXHRcdGNvbnN0IGRpZmYgPSBlbGVtZW50cy5sZW5ndGggLSBkZWxldGVDb3VudDtcblx0XHRjb25zdCBlbmQgPSBzdGFydCArIGRlbGV0ZUNvdW50O1xuXHRcdGNvbnN0IHNvcnRlZEluZGV4ZXM6IG51bWJlcltdID0gW107XG5cdFx0bGV0IGkgPSAwO1xuXG5cdFx0d2hpbGUgKGkgPCB0aGlzLnNvcnRlZEluZGV4ZXMubGVuZ3RoICYmIHRoaXMuc29ydGVkSW5kZXhlc1tpXSA8IHN0YXJ0KSB7XG5cdFx0XHRzb3J0ZWRJbmRleGVzLnB1c2godGhpcy5zb3J0ZWRJbmRleGVzW2krK10pO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGogPSAwOyBqIDwgZWxlbWVudHMubGVuZ3RoOyBqKyspIHtcblx0XHRcdGlmIChlbGVtZW50c1tqXSkge1xuXHRcdFx0XHRzb3J0ZWRJbmRleGVzLnB1c2goaiArIHN0YXJ0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR3aGlsZSAoaSA8IHRoaXMuc29ydGVkSW5kZXhlcy5sZW5ndGggJiYgdGhpcy5zb3J0ZWRJbmRleGVzW2ldID49IGVuZCkge1xuXHRcdFx0c29ydGVkSW5kZXhlcy5wdXNoKHRoaXMuc29ydGVkSW5kZXhlc1tpKytdICsgZGlmZik7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJlci5zcGxpY2Uoc3RhcnQsIGRlbGV0ZUNvdW50LCBlbGVtZW50cy5sZW5ndGgpO1xuXHRcdHRoaXMuX3NldChzb3J0ZWRJbmRleGVzLCBzb3J0ZWRJbmRleGVzKTtcblx0fVxuXG5cdHJlbmRlckluZGV4KGluZGV4OiBudW1iZXIsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSh0aGlzLl90cmFpdCwgdGhpcy5jb250YWlucyhpbmRleCkpO1xuXHR9XG5cblx0dW5yZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKHRoaXMuX3RyYWl0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBpbmRleGVzIHdoaWNoIHNob3VsZCBoYXZlIHRoaXMgdHJhaXQuXG5cdCAqXG5cdCAqIEBwYXJhbSBpbmRleGVzIEluZGV4ZXMgd2hpY2ggc2hvdWxkIGhhdmUgdGhpcyB0cmFpdC5cblx0ICogQHJldHVybiBUaGUgb2xkIGluZGV4ZXMgd2hpY2ggaGFkIHRoaXMgdHJhaXQuXG5cdCAqL1xuXHRzZXQoaW5kZXhlczogbnVtYmVyW10sIGJyb3dzZXJFdmVudD86IFVJRXZlbnQpOiBudW1iZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NldChpbmRleGVzLCBbLi4uaW5kZXhlc10uc29ydChudW1lcmljU29ydCksIGJyb3dzZXJFdmVudCk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXQoaW5kZXhlczogbnVtYmVyW10sIHNvcnRlZEluZGV4ZXM6IG51bWJlcltdLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50KTogbnVtYmVyW10ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuaW5kZXhlcztcblx0XHRjb25zdCBzb3J0ZWRSZXN1bHQgPSB0aGlzLnNvcnRlZEluZGV4ZXM7XG5cblx0XHR0aGlzLmluZGV4ZXMgPSBpbmRleGVzO1xuXHRcdHRoaXMuc29ydGVkSW5kZXhlcyA9IHNvcnRlZEluZGV4ZXM7XG5cblx0XHRjb25zdCB0b1JlbmRlciA9IGRpc2p1bmN0aW9uKHNvcnRlZFJlc3VsdCwgaW5kZXhlcyk7XG5cdFx0dGhpcy5yZW5kZXJlci5yZW5kZXJJbmRleGVzKHRvUmVuZGVyKTtcblxuXHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoeyBpbmRleGVzLCBicm93c2VyRXZlbnQgfSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGdldCgpOiBudW1iZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5kZXhlcztcblx0fVxuXG5cdGNvbnRhaW5zKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gYmluYXJ5U2VhcmNoKHRoaXMuc29ydGVkSW5kZXhlcywgaW5kZXgsIG51bWVyaWNTb3J0KSA+PSAwO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHRkaXNwb3NlKHRoaXMuX29uQ2hhbmdlKTtcblx0fVxufVxuXG5jbGFzcyBTZWxlY3Rpb25UcmFpdDxUPiBleHRlbmRzIFRyYWl0PFQ+IHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHNldEFyaWFTZWxlY3RlZDogYm9vbGVhbikge1xuXHRcdHN1cGVyKCdzZWxlY3RlZCcpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVySW5kZXgoaW5kZXg6IG51bWJlciwgY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlckluZGV4KGluZGV4LCBjb250YWluZXIpO1xuXG5cdFx0aWYgKHRoaXMuc2V0QXJpYVNlbGVjdGVkKSB7XG5cdFx0XHRpZiAodGhpcy5jb250YWlucyhpbmRleCkpIHtcblx0XHRcdFx0Y29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogVGhlIFRyYWl0U3BsaWNlYWJsZSBpcyB1c2VkIGFzIGEgdXRpbCBjbGFzcyB0byBiZSBhYmxlXG4gKiB0byBwcmVzZXJ2ZSB0cmFpdHMgYWNyb3NzIHNwbGljZSBjYWxscywgZ2l2ZW4gYW4gaWRlbnRpdHlcbiAqIHByb3ZpZGVyLlxuICovXG5jbGFzcyBUcmFpdFNwbGljZWFibGU8VD4gaW1wbGVtZW50cyBJU3BsaWNlYWJsZTxUPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSB0cmFpdDogVHJhaXQ8VD4sXG5cdFx0cHJpdmF0ZSB2aWV3OiBJTGlzdFZpZXc8VD4sXG5cdFx0cHJpdmF0ZSBpZGVudGl0eVByb3ZpZGVyPzogSUlkZW50aXR5UHJvdmlkZXI8VD5cblx0KSB7IH1cblxuXHRzcGxpY2Uoc3RhcnQ6IG51bWJlciwgZGVsZXRlQ291bnQ6IG51bWJlciwgZWxlbWVudHM6IFRbXSk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pZGVudGl0eVByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50cmFpdC5zcGxpY2Uoc3RhcnQsIGRlbGV0ZUNvdW50LCBuZXcgQXJyYXkoZWxlbWVudHMubGVuZ3RoKS5maWxsKGZhbHNlKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGFzdEVsZW1lbnRzV2l0aFRyYWl0ID0gdGhpcy50cmFpdC5nZXQoKS5tYXAoaSA9PiB0aGlzLmlkZW50aXR5UHJvdmlkZXIhLmdldElkKHRoaXMudmlldy5lbGVtZW50KGkpKS50b1N0cmluZygpKTtcblx0XHRpZiAocGFzdEVsZW1lbnRzV2l0aFRyYWl0Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudHJhaXQuc3BsaWNlKHN0YXJ0LCBkZWxldGVDb3VudCwgbmV3IEFycmF5KGVsZW1lbnRzLmxlbmd0aCkuZmlsbChmYWxzZSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBhc3RFbGVtZW50c1dpdGhUcmFpdFNldCA9IG5ldyBTZXQocGFzdEVsZW1lbnRzV2l0aFRyYWl0KTtcblx0XHRjb25zdCBlbGVtZW50c1dpdGhUcmFpdCA9IGVsZW1lbnRzLm1hcChlID0+IHBhc3RFbGVtZW50c1dpdGhUcmFpdFNldC5oYXModGhpcy5pZGVudGl0eVByb3ZpZGVyIS5nZXRJZChlKS50b1N0cmluZygpKSk7XG5cdFx0dGhpcy50cmFpdC5zcGxpY2Uoc3RhcnQsIGRlbGV0ZUNvdW50LCBlbGVtZW50c1dpdGhUcmFpdCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gaXNMaXN0RWxlbWVudERlc2NlbmRhbnRPZkNsYXNzKGU6IEhUTUxFbGVtZW50LCBjbGFzc05hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRpZiAoZS5jbGFzc0xpc3QuY29udGFpbnMoY2xhc3NOYW1lKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0aWYgKGUuY2xhc3NMaXN0LmNvbnRhaW5zKCdtb25hY28tbGlzdCcpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKCFlLnBhcmVudEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRyZXR1cm4gaXNMaXN0RWxlbWVudERlc2NlbmRhbnRPZkNsYXNzKGUucGFyZW50RWxlbWVudCwgY2xhc3NOYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTW9uYWNvRWRpdG9yKGU6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdHJldHVybiBpc0xpc3RFbGVtZW50RGVzY2VuZGFudE9mQ2xhc3MoZSwgJ21vbmFjby1lZGl0b3InKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTW9uYWNvQ3VzdG9tVG9nZ2xlKGU6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdHJldHVybiBpc0xpc3RFbGVtZW50RGVzY2VuZGFudE9mQ2xhc3MoZSwgJ21vbmFjby1jdXN0b20tdG9nZ2xlJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FjdGlvbkl0ZW0oZTogSFRNTEVsZW1lbnQpOiBib29sZWFuIHtcblx0cmV0dXJuIGlzTGlzdEVsZW1lbnREZXNjZW5kYW50T2ZDbGFzcyhlLCAnYWN0aW9uLWl0ZW0nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTW9uYWNvVHdpc3RpZShlOiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gaXNMaXN0RWxlbWVudERlc2NlbmRhbnRPZkNsYXNzKGUsICdtb25hY28tdGwtdHdpc3RpZScpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTdGlja3lTY3JvbGxFbGVtZW50KGU6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdHJldHVybiBpc0xpc3RFbGVtZW50RGVzY2VuZGFudE9mQ2xhc3MoZSwgJ21vbmFjby10cmVlLXN0aWNreS1yb3cnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU3RpY2t5U2Nyb2xsQ29udGFpbmVyKGU6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdHJldHVybiBlLmNsYXNzTGlzdC5jb250YWlucygnbW9uYWNvLXRyZWUtc3RpY2t5LWNvbnRhaW5lcicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNCdXR0b24oZTogSFRNTEVsZW1lbnQpOiBib29sZWFuIHtcblx0aWYgKChlLnRhZ05hbWUgPT09ICdBJyAmJiBlLmNsYXNzTGlzdC5jb250YWlucygnbW9uYWNvLWJ1dHRvbicpKSB8fFxuXHRcdChlLnRhZ05hbWUgPT09ICdESVYnICYmIGUuY2xhc3NMaXN0LmNvbnRhaW5zKCdtb25hY28tYnV0dG9uLWRyb3Bkb3duJykpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRpZiAoZS5jbGFzc0xpc3QuY29udGFpbnMoJ21vbmFjby1saXN0JykpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoIWUucGFyZW50RWxlbWVudCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHJldHVybiBpc0J1dHRvbihlLnBhcmVudEVsZW1lbnQpO1xufVxuXG5jbGFzcyBLZXlib2FyZENvbnRyb2xsZXI8VD4gaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBtdWx0aXBsZVNlbGVjdGlvbkRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblxuXHRAbWVtb2l6ZVxuXHRwcml2YXRlIGdldCBvbktleURvd24oKTogRXZlbnQ8U3RhbmRhcmRLZXlib2FyZEV2ZW50PiB7XG5cdFx0cmV0dXJuIEV2ZW50LmNoYWluKFxuXHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy52aWV3LmRvbU5vZGUsICdrZXlkb3duJykpLmV2ZW50LCAkID0+XG5cdFx0XHQkLmZpbHRlcihlID0+ICFpc0VkaXRhYmxlRWxlbWVudChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpXG5cdFx0XHRcdC5tYXAoZSA9PiBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpKVxuXHRcdCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGxpc3Q6IExpc3Q8VD4sXG5cdFx0cHJpdmF0ZSB2aWV3OiBJTGlzdFZpZXc8VD4sXG5cdFx0b3B0aW9uczogSUxpc3RPcHRpb25zPFQ+XG5cdCkge1xuXHRcdHRoaXMubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0ID0gb3B0aW9ucy5tdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5vbktleURvd24oZSA9PiB7XG5cdFx0XHRzd2l0Y2ggKGUua2V5Q29kZSkge1xuXHRcdFx0XHRjYXNlIEtleUNvZGUuRW50ZXI6XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMub25FbnRlcihlKTtcblx0XHRcdFx0Y2FzZSBLZXlDb2RlLlVwQXJyb3c6XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMub25VcEFycm93KGUpO1xuXHRcdFx0XHRjYXNlIEtleUNvZGUuRG93bkFycm93OlxuXHRcdFx0XHRcdHJldHVybiB0aGlzLm9uRG93bkFycm93KGUpO1xuXHRcdFx0XHRjYXNlIEtleUNvZGUuUGFnZVVwOlxuXHRcdFx0XHRcdHJldHVybiB0aGlzLm9uUGFnZVVwQXJyb3coZSk7XG5cdFx0XHRcdGNhc2UgS2V5Q29kZS5QYWdlRG93bjpcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5vblBhZ2VEb3duQXJyb3coZSk7XG5cdFx0XHRcdGNhc2UgS2V5Q29kZS5Fc2NhcGU6XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMub25Fc2NhcGUoZSk7XG5cdFx0XHRcdGNhc2UgS2V5Q29kZS5LZXlBOlxuXHRcdFx0XHRcdGlmICh0aGlzLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCAmJiAocGxhdGZvcm0uaXNNYWNpbnRvc2ggPyBlLm1ldGFLZXkgOiBlLmN0cmxLZXkpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9uQ3RybEEoZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHVwZGF0ZU9wdGlvbnMob3B0aW9uc1VwZGF0ZTogSUxpc3RPcHRpb25zVXBkYXRlKTogdm9pZCB7XG5cdFx0aWYgKG9wdGlvbnNVcGRhdGUubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0ID0gb3B0aW9uc1VwZGF0ZS5tdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkVudGVyKGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHRoaXMubGlzdC5zZXRTZWxlY3Rpb24odGhpcy5saXN0LmdldEZvY3VzKCksIGUuYnJvd3NlckV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgb25VcEFycm93KGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHRoaXMubGlzdC5mb2N1c1ByZXZpb3VzKDEsIGZhbHNlLCBlLmJyb3dzZXJFdmVudCk7XG5cdFx0Y29uc3QgZWwgPSB0aGlzLmxpc3QuZ2V0Rm9jdXMoKVswXTtcblx0XHR0aGlzLmxpc3Quc2V0QW5jaG9yKGVsKTtcblx0XHR0aGlzLmxpc3QucmV2ZWFsKGVsKTtcblx0XHR0aGlzLnZpZXcuZG9tTm9kZS5mb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRvd25BcnJvdyhlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR0aGlzLmxpc3QuZm9jdXNOZXh0KDEsIGZhbHNlLCBlLmJyb3dzZXJFdmVudCk7XG5cdFx0Y29uc3QgZWwgPSB0aGlzLmxpc3QuZ2V0Rm9jdXMoKVswXTtcblx0XHR0aGlzLmxpc3Quc2V0QW5jaG9yKGVsKTtcblx0XHR0aGlzLmxpc3QucmV2ZWFsKGVsKTtcblx0XHR0aGlzLnZpZXcuZG9tTm9kZS5mb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblBhZ2VVcEFycm93KGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHRoaXMubGlzdC5mb2N1c1ByZXZpb3VzUGFnZShlLmJyb3dzZXJFdmVudCk7XG5cdFx0Y29uc3QgZWwgPSB0aGlzLmxpc3QuZ2V0Rm9jdXMoKVswXTtcblx0XHR0aGlzLmxpc3Quc2V0QW5jaG9yKGVsKTtcblx0XHR0aGlzLmxpc3QucmV2ZWFsKGVsKTtcblx0XHR0aGlzLnZpZXcuZG9tTm9kZS5mb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblBhZ2VEb3duQXJyb3coZTogU3RhbmRhcmRLZXlib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0dGhpcy5saXN0LmZvY3VzTmV4dFBhZ2UoZS5icm93c2VyRXZlbnQpO1xuXHRcdGNvbnN0IGVsID0gdGhpcy5saXN0LmdldEZvY3VzKClbMF07XG5cdFx0dGhpcy5saXN0LnNldEFuY2hvcihlbCk7XG5cdFx0dGhpcy5saXN0LnJldmVhbChlbCk7XG5cdFx0dGhpcy52aWV3LmRvbU5vZGUuZm9jdXMoKTtcblx0fVxuXG5cdHByaXZhdGUgb25DdHJsQShlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR0aGlzLmxpc3Quc2V0U2VsZWN0aW9uKHJhbmdlKHRoaXMubGlzdC5sZW5ndGgpLCBlLmJyb3dzZXJFdmVudCk7XG5cdFx0dGhpcy5saXN0LnNldEFuY2hvcih1bmRlZmluZWQpO1xuXHRcdHRoaXMudmlldy5kb21Ob2RlLmZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRXNjYXBlKGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmxpc3QuZ2V0U2VsZWN0aW9uKCkubGVuZ3RoKSB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0dGhpcy5saXN0LnNldFNlbGVjdGlvbihbXSwgZS5icm93c2VyRXZlbnQpO1xuXHRcdFx0dGhpcy5saXN0LnNldEFuY2hvcih1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy52aWV3LmRvbU5vZGUuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMubXVsdGlwbGVTZWxlY3Rpb25EaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gVHlwZU5hdmlnYXRpb25Nb2RlIHtcblx0QXV0b21hdGljLFxuXHRUcmlnZ2VyXG59XG5cbmVudW0gVHlwZU5hdmlnYXRpb25Db250cm9sbGVyU3RhdGUge1xuXHRJZGxlLFxuXHRUeXBpbmdcbn1cblxuZXhwb3J0IGNvbnN0IERlZmF1bHRLZXlib2FyZE5hdmlnYXRpb25EZWxlZ2F0ZSA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElLZXlib2FyZE5hdmlnYXRpb25EZWxlZ2F0ZSB7XG5cdG1pZ2h0UHJvZHVjZVByaW50YWJsZUNoYXJhY3RlcihldmVudDogSUtleWJvYXJkRXZlbnQpOiBib29sZWFuIHtcblx0XHRpZiAoZXZlbnQuY3RybEtleSB8fCBldmVudC5tZXRhS2V5IHx8IGV2ZW50LmFsdEtleSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiAoZXZlbnQua2V5Q29kZSA+PSBLZXlDb2RlLktleUEgJiYgZXZlbnQua2V5Q29kZSA8PSBLZXlDb2RlLktleVopXG5cdFx0XHR8fCAoZXZlbnQua2V5Q29kZSA+PSBLZXlDb2RlLkRpZ2l0MCAmJiBldmVudC5rZXlDb2RlIDw9IEtleUNvZGUuRGlnaXQ5KVxuXHRcdFx0fHwgKGV2ZW50LmtleUNvZGUgPj0gS2V5Q29kZS5OdW1wYWQwICYmIGV2ZW50LmtleUNvZGUgPD0gS2V5Q29kZS5OdW1wYWQ5KVxuXHRcdFx0fHwgKGV2ZW50LmtleUNvZGUgPj0gS2V5Q29kZS5TZW1pY29sb24gJiYgZXZlbnQua2V5Q29kZSA8PSBLZXlDb2RlLlF1b3RlKTtcblx0fVxufTtcblxuY2xhc3MgVHlwZU5hdmlnYXRpb25Db250cm9sbGVyPFQ+IGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgZW5hYmxlZCA9IGZhbHNlO1xuXHRwcml2YXRlIHN0YXRlOiBUeXBlTmF2aWdhdGlvbkNvbnRyb2xsZXJTdGF0ZSA9IFR5cGVOYXZpZ2F0aW9uQ29udHJvbGxlclN0YXRlLklkbGU7XG5cblx0cHJpdmF0ZSBtb2RlID0gVHlwZU5hdmlnYXRpb25Nb2RlLkF1dG9tYXRpYztcblx0cHJpdmF0ZSB0cmlnZ2VyZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBwcmV2aW91c2x5Rm9jdXNlZCA9IC0xO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZW5hYmxlZERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgbGlzdDogTGlzdDxUPixcblx0XHRwcml2YXRlIHZpZXc6IElMaXN0VmlldzxUPixcblx0XHRwcml2YXRlIGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IElLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyPFQ+LFxuXHRcdHByaXZhdGUga2V5Ym9hcmROYXZpZ2F0aW9uRXZlbnRGaWx0ZXI6IElLZXlib2FyZE5hdmlnYXRpb25FdmVudEZpbHRlcixcblx0XHRwcml2YXRlIGRlbGVnYXRlOiBJS2V5Ym9hcmROYXZpZ2F0aW9uRGVsZWdhdGVcblx0KSB7XG5cdFx0dGhpcy51cGRhdGVPcHRpb25zKGxpc3Qub3B0aW9ucyk7XG5cdH1cblxuXHR1cGRhdGVPcHRpb25zKG9wdGlvbnM6IElMaXN0T3B0aW9uczxUPik6IHZvaWQge1xuXHRcdGlmIChvcHRpb25zLnR5cGVOYXZpZ2F0aW9uRW5hYmxlZCA/PyB0cnVlKSB7XG5cdFx0XHR0aGlzLmVuYWJsZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRpc2FibGUoKTtcblx0XHR9XG5cblx0XHR0aGlzLm1vZGUgPSBvcHRpb25zLnR5cGVOYXZpZ2F0aW9uTW9kZSA/PyBUeXBlTmF2aWdhdGlvbk1vZGUuQXV0b21hdGljO1xuXHR9XG5cblx0dHJpZ2dlcigpOiB2b2lkIHtcblx0XHR0aGlzLnRyaWdnZXJlZCA9ICF0aGlzLnRyaWdnZXJlZDtcblx0fVxuXG5cdHByaXZhdGUgZW5hYmxlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVuYWJsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgdHlwaW5nID0gZmFsc2U7XG5cblx0XHRjb25zdCBvbkNoYXIgPSBFdmVudC5jaGFpbih0aGlzLmVuYWJsZWREaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy52aWV3LmRvbU5vZGUsICdrZXlkb3duJykpLmV2ZW50LCAkID0+XG5cdFx0XHQkLmZpbHRlcihlID0+ICFpc0VkaXRhYmxlRWxlbWVudChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpXG5cdFx0XHRcdC5maWx0ZXIoKCkgPT4gdGhpcy5tb2RlID09PSBUeXBlTmF2aWdhdGlvbk1vZGUuQXV0b21hdGljIHx8IHRoaXMudHJpZ2dlcmVkKVxuXHRcdFx0XHQubWFwKGV2ZW50ID0+IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZXZlbnQpKVxuXHRcdFx0XHQuZmlsdGVyKGUgPT4gdHlwaW5nIHx8IHRoaXMua2V5Ym9hcmROYXZpZ2F0aW9uRXZlbnRGaWx0ZXIoZSkpXG5cdFx0XHRcdC5maWx0ZXIoZSA9PiB0aGlzLmRlbGVnYXRlLm1pZ2h0UHJvZHVjZVByaW50YWJsZUNoYXJhY3RlcihlKSlcblx0XHRcdFx0LmZvckVhY2goZSA9PiBFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpKVxuXHRcdFx0XHQubWFwKGV2ZW50ID0+IGV2ZW50LmJyb3dzZXJFdmVudC5rZXkpXG5cdFx0KTtcblxuXHRcdGNvbnN0IG9uQ2xlYXIgPSBFdmVudC5kZWJvdW5jZTxzdHJpbmcsIG51bGw+KG9uQ2hhciwgKCkgPT4gbnVsbCwgODAwLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0aGlzLmVuYWJsZWREaXNwb3NhYmxlcyk7XG5cdFx0Y29uc3Qgb25JbnB1dCA9IEV2ZW50LnJlZHVjZTxzdHJpbmcgfCBudWxsLCBzdHJpbmcgfCBudWxsPihFdmVudC5hbnkob25DaGFyLCBvbkNsZWFyKSwgKHIsIGkpID0+IGkgPT09IG51bGwgPyBudWxsIDogKChyIHx8ICcnKSArIGkpLCB1bmRlZmluZWQsIHRoaXMuZW5hYmxlZERpc3Bvc2FibGVzKTtcblxuXHRcdG9uSW5wdXQodGhpcy5vbklucHV0LCB0aGlzLCB0aGlzLmVuYWJsZWREaXNwb3NhYmxlcyk7XG5cdFx0b25DbGVhcih0aGlzLm9uQ2xlYXIsIHRoaXMsIHRoaXMuZW5hYmxlZERpc3Bvc2FibGVzKTtcblxuXHRcdG9uQ2hhcigoKSA9PiB0eXBpbmcgPSB0cnVlLCB1bmRlZmluZWQsIHRoaXMuZW5hYmxlZERpc3Bvc2FibGVzKTtcblx0XHRvbkNsZWFyKCgpID0+IHR5cGluZyA9IGZhbHNlLCB1bmRlZmluZWQsIHRoaXMuZW5hYmxlZERpc3Bvc2FibGVzKTtcblxuXHRcdHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cdFx0dGhpcy50cmlnZ2VyZWQgPSBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZGlzYWJsZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZW5hYmxlZERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0dGhpcy50cmlnZ2VyZWQgPSBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgb25DbGVhcigpOiB2b2lkIHtcblx0XHRjb25zdCBmb2N1cyA9IHRoaXMubGlzdC5nZXRGb2N1cygpO1xuXHRcdGlmIChmb2N1cy5sZW5ndGggPiAwICYmIGZvY3VzWzBdID09PSB0aGlzLnByZXZpb3VzbHlGb2N1c2VkKSB7XG5cdFx0XHQvLyBMaXN0OiByZS1hbm5vdW5jZSBlbGVtZW50IG9uIHR5cGluZyBlbmQgc2luY2UgdHlwZWQga2V5cyB3aWxsIGludGVycnVwdCBhcmlhIGxhYmVsIG9mIGZvY3VzZWQgZWxlbWVudFxuXHRcdFx0Ly8gRG8gbm90IGFubm91bmNlIGlmIHRoZXJlIHdhcyBhIGZvY3VzIGNoYW5nZSBhdCB0aGUgZW5kIHRvIHByZXZlbnQgZHVwbGljYXRpb24gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzk1OTYxXG5cdFx0XHRjb25zdCBhcmlhTGFiZWwgPSB0aGlzLmxpc3Qub3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXI/LmdldEFyaWFMYWJlbCh0aGlzLmxpc3QuZWxlbWVudChmb2N1c1swXSkpO1xuXG5cdFx0XHRpZiAodHlwZW9mIGFyaWFMYWJlbCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0YWxlcnQoYXJpYUxhYmVsKTtcblx0XHRcdH0gZWxzZSBpZiAoYXJpYUxhYmVsKSB7XG5cdFx0XHRcdGFsZXJ0KGFyaWFMYWJlbC5nZXQoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMucHJldmlvdXNseUZvY3VzZWQgPSAtMTtcblx0fVxuXG5cdHByaXZhdGUgb25JbnB1dCh3b3JkOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG5cdFx0aWYgKCF3b3JkKSB7XG5cdFx0XHR0aGlzLnN0YXRlID0gVHlwZU5hdmlnYXRpb25Db250cm9sbGVyU3RhdGUuSWRsZTtcblx0XHRcdHRoaXMudHJpZ2dlcmVkID0gZmFsc2U7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmxpc3QuZ2V0Rm9jdXMoKTtcblx0XHRjb25zdCBzdGFydCA9IGZvY3VzLmxlbmd0aCA+IDAgPyBmb2N1c1swXSA6IDA7XG5cdFx0Y29uc3QgZGVsdGEgPSB0aGlzLnN0YXRlID09PSBUeXBlTmF2aWdhdGlvbkNvbnRyb2xsZXJTdGF0ZS5JZGxlID8gMSA6IDA7XG5cdFx0dGhpcy5zdGF0ZSA9IFR5cGVOYXZpZ2F0aW9uQ29udHJvbGxlclN0YXRlLlR5cGluZztcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5saXN0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IChzdGFydCArIGkgKyBkZWx0YSkgJSB0aGlzLmxpc3QubGVuZ3RoO1xuXHRcdFx0Y29uc3QgbGFiZWwgPSB0aGlzLmtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIuZ2V0S2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWwodGhpcy52aWV3LmVsZW1lbnQoaW5kZXgpKTtcblx0XHRcdGNvbnN0IGxhYmVsU3RyID0gbGFiZWwgJiYgbGFiZWwudG9TdHJpbmcoKTtcblxuXHRcdFx0aWYgKHRoaXMubGlzdC5vcHRpb25zLnR5cGVOYXZpZ2F0aW9uRW5hYmxlZCkge1xuXHRcdFx0XHRpZiAodHlwZW9mIGxhYmVsU3RyICE9PSAndW5kZWZpbmVkJykge1xuXG5cdFx0XHRcdFx0Ly8gSWYgcHJlZml4IGlzIGZvdW5kLCBmb2N1cyBhbmQgcmV0dXJuIGVhcmx5XG5cdFx0XHRcdFx0aWYgKG1hdGNoZXNQcmVmaXgod29yZCwgbGFiZWxTdHIpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnByZXZpb3VzbHlGb2N1c2VkID0gc3RhcnQ7XG5cdFx0XHRcdFx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHRcdFx0XHR0aGlzLmxpc3QucmV2ZWFsKGluZGV4KTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBmdXp6eSA9IG1hdGNoZXNGdXp6eTIod29yZCwgbGFiZWxTdHIpO1xuXG5cdFx0XHRcdFx0aWYgKGZ1enp5KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBmdXp6eVNjb3JlID0gZnV6enlbMF0uZW5kIC0gZnV6enlbMF0uc3RhcnQ7XG5cdFx0XHRcdFx0XHQvLyBlbnN1cmVzIHRoYXQgd2hlbiBmdXp6eSBtYXRjaGluZywgZG9lc24ndCBjbGFzaCB3aXRoIHByZWZpeCBtYXRjaGluZyAoMSBpbnB1dCB2cyAxKyBzaG91bGQgYmUgcHJlZml4IGFuZCBmdXp6eSByZXNwZWNpdHZlbHkpLiBBbHNvIG1ha2VzIHN1cmUgdGhhdCBleGFjdCBtYXRjaGVzIGFyZSBwcmlvcml0aXplZC5cblx0XHRcdFx0XHRcdGlmIChmdXp6eVNjb3JlID4gMSAmJiBmdXp6eS5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wcmV2aW91c2x5Rm9jdXNlZCA9IHN0YXJ0O1xuXHRcdFx0XHRcdFx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMubGlzdC5yZXZlYWwoaW5kZXgpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBsYWJlbFN0ciA9PT0gJ3VuZGVmaW5lZCcgfHwgbWF0Y2hlc1ByZWZpeCh3b3JkLCBsYWJlbFN0cikpIHtcblx0XHRcdFx0dGhpcy5wcmV2aW91c2x5Rm9jdXNlZCA9IHN0YXJ0O1xuXHRcdFx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW2luZGV4XSk7XG5cdFx0XHRcdHRoaXMubGlzdC5yZXZlYWwoaW5kZXgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLmRpc2FibGUoKTtcblx0XHR0aGlzLmVuYWJsZWREaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgRE9NRm9jdXNDb250cm9sbGVyPFQ+IGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBsaXN0OiBMaXN0PFQ+LFxuXHRcdHByaXZhdGUgdmlldzogSUxpc3RWaWV3PFQ+XG5cdCkge1xuXHRcdGNvbnN0IG9uS2V5RG93biA9IEV2ZW50LmNoYWluKHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHZpZXcuZG9tTm9kZSwgJ2tleWRvd24nKSkuZXZlbnQsICQgPT4gJFxuXHRcdFx0LmZpbHRlcihlID0+ICFpc0VkaXRhYmxlRWxlbWVudChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpXG5cdFx0XHQubWFwKGUgPT4gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKSlcblx0XHQpO1xuXG5cdFx0Y29uc3Qgb25UYWIgPSBFdmVudC5jaGFpbihvbktleURvd24sICQgPT4gJC5maWx0ZXIoZSA9PiBlLmtleUNvZGUgPT09IEtleUNvZGUuVGFiICYmICFlLmN0cmxLZXkgJiYgIWUubWV0YUtleSAmJiAhZS5zaGlmdEtleSAmJiAhZS5hbHRLZXkpKTtcblxuXHRcdG9uVGFiKHRoaXMub25UYWIsIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblRhYihlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoZS50YXJnZXQgIT09IHRoaXMudmlldy5kb21Ob2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmxpc3QuZ2V0Rm9jdXMoKTtcblxuXHRcdGlmIChmb2N1cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmb2N1c2VkRG9tRWxlbWVudCA9IHRoaXMudmlldy5kb21FbGVtZW50KGZvY3VzWzBdKTtcblxuXHRcdGlmICghZm9jdXNlZERvbUVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0YWJJbmRleEVsZW1lbnQgPSBmb2N1c2VkRG9tRWxlbWVudC5xdWVyeVNlbGVjdG9yKCdbdGFiSW5kZXhdJyk7XG5cblx0XHRpZiAoIXRhYkluZGV4RWxlbWVudCB8fCAhKGlzSFRNTEVsZW1lbnQodGFiSW5kZXhFbGVtZW50KSkgfHwgdGFiSW5kZXhFbGVtZW50LnRhYkluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0eWxlID0gZ2V0V2luZG93KHRhYkluZGV4RWxlbWVudCkuZ2V0Q29tcHV0ZWRTdHlsZSh0YWJJbmRleEVsZW1lbnQpO1xuXHRcdGlmIChzdHlsZS52aXNpYmlsaXR5ID09PSAnaGlkZGVuJyB8fCBzdHlsZS5kaXNwbGF5ID09PSAnbm9uZScpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR0YWJJbmRleEVsZW1lbnQuZm9jdXMoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQoZXZlbnQ6IElMaXN0TW91c2VFdmVudDxhbnk+IHwgSUxpc3RUb3VjaEV2ZW50PGFueT4pOiBib29sZWFuIHtcblx0cmV0dXJuIHBsYXRmb3JtLmlzTWFjaW50b3NoID8gZXZlbnQuYnJvd3NlckV2ZW50Lm1ldGFLZXkgOiBldmVudC5icm93c2VyRXZlbnQuY3RybEtleTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2VsZWN0aW9uUmFuZ2VDaGFuZ2VFdmVudChldmVudDogSUxpc3RNb3VzZUV2ZW50PGFueT4gfCBJTGlzdFRvdWNoRXZlbnQ8YW55Pik6IGJvb2xlYW4ge1xuXHRyZXR1cm4gZXZlbnQuYnJvd3NlckV2ZW50LnNoaWZ0S2V5O1xufVxuXG5mdW5jdGlvbiBpc01vdXNlUmlnaHRDbGljayhldmVudDogVUlFdmVudCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gaXNNb3VzZUV2ZW50KGV2ZW50KSAmJiBldmVudC5idXR0b24gPT09IDI7XG59XG5cbmNvbnN0IERlZmF1bHRNdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXIgPSB7XG5cdGlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQsXG5cdGlzU2VsZWN0aW9uUmFuZ2VDaGFuZ2VFdmVudFxufTtcblxuZXhwb3J0IGNsYXNzIE1vdXNlQ29udHJvbGxlcjxUPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIG11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlcjogSU11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlcjxUPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBtb3VzZVN1cHBvcnQ6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSBfb25Qb2ludGVyID0gbmV3IEVtaXR0ZXI8SUxpc3RNb3VzZUV2ZW50PFQ+PigpO1xuXHRyZWFkb25seSBvblBvaW50ZXI6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4gPSB0aGlzLl9vblBvaW50ZXIuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocHJvdGVjdGVkIGxpc3Q6IExpc3Q8VD4pIHtcblx0XHRpZiAobGlzdC5vcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCAhPT0gZmFsc2UpIHtcblx0XHRcdHRoaXMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyID0gdGhpcy5saXN0Lm9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyIHx8IERlZmF1bHRNdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXI7XG5cdFx0fVxuXG5cdFx0dGhpcy5tb3VzZVN1cHBvcnQgPSB0eXBlb2YgbGlzdC5vcHRpb25zLm1vdXNlU3VwcG9ydCA9PT0gJ3VuZGVmaW5lZCcgfHwgISFsaXN0Lm9wdGlvbnMubW91c2VTdXBwb3J0O1xuXG5cdFx0aWYgKHRoaXMubW91c2VTdXBwb3J0KSB7XG5cdFx0XHRsaXN0Lm9uTW91c2VEb3duKHRoaXMub25Nb3VzZURvd24sIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdFx0bGlzdC5vbkNvbnRleHRNZW51KHRoaXMub25Db250ZXh0TWVudSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0XHRsaXN0Lm9uTW91c2VEYmxDbGljayh0aGlzLm9uRG91YmxlQ2xpY2ssIHRoaXMsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdFx0bGlzdC5vblRvdWNoU3RhcnQodGhpcy5vbk1vdXNlRG93biwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChHZXN0dXJlLmFkZFRhcmdldChsaXN0LmdldEhUTUxFbGVtZW50KCkpKTtcblx0XHR9XG5cblx0XHRFdmVudC5hbnk8SUxpc3RNb3VzZUV2ZW50PGFueT4gfCBJTGlzdEdlc3R1cmVFdmVudDxhbnk+PihsaXN0Lm9uTW91c2VDbGljaywgbGlzdC5vbk1vdXNlTWlkZGxlQ2xpY2ssIGxpc3Qub25UYXApKHRoaXMub25WaWV3UG9pbnRlciwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdH1cblxuXHR1cGRhdGVPcHRpb25zKG9wdGlvbnNVcGRhdGU6IElMaXN0T3B0aW9uc1VwZGF0ZSk6IHZvaWQge1xuXHRcdGlmIChvcHRpb25zVXBkYXRlLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLm11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlciA9IHVuZGVmaW5lZDtcblxuXHRcdFx0aWYgKG9wdGlvbnNVcGRhdGUubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0KSB7XG5cdFx0XHRcdHRoaXMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyID0gdGhpcy5saXN0Lm9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyIHx8IERlZmF1bHRNdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXI7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQoZXZlbnQ6IElMaXN0TW91c2VFdmVudDxhbnk+IHwgSUxpc3RUb3VjaEV2ZW50PGFueT4pOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyLmlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGlzU2VsZWN0aW9uUmFuZ2VDaGFuZ2VFdmVudChldmVudDogSUxpc3RNb3VzZUV2ZW50PGFueT4gfCBJTGlzdFRvdWNoRXZlbnQ8YW55Pik6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5tdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5tdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXIuaXNTZWxlY3Rpb25SYW5nZUNoYW5nZUV2ZW50KGV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgaXNTZWxlY3Rpb25DaGFuZ2VFdmVudChldmVudDogSUxpc3RNb3VzZUV2ZW50PGFueT4gfCBJTGlzdFRvdWNoRXZlbnQ8YW55Pik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQoZXZlbnQpIHx8IHRoaXMuaXNTZWxlY3Rpb25SYW5nZUNoYW5nZUV2ZW50KGV2ZW50KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvbk1vdXNlRG93bihlOiBJTGlzdE1vdXNlRXZlbnQ8VD4gfCBJTGlzdFRvdWNoRXZlbnQ8VD4pOiB2b2lkIHtcblx0XHRpZiAoaXNNb25hY29FZGl0b3IoZS5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChnZXRBY3RpdmVFbGVtZW50KCkgIT09IGUuYnJvd3NlckV2ZW50LnRhcmdldCkge1xuXHRcdFx0dGhpcy5saXN0LmRvbUZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG9uQ29udGV4dE1lbnUoZTogSUxpc3RDb250ZXh0TWVudUV2ZW50PFQ+KTogdm9pZCB7XG5cdFx0aWYgKGlzRWRpdGFibGVFbGVtZW50KGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkgfHwgaXNNb25hY29FZGl0b3IoZS5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvY3VzID0gdHlwZW9mIGUuaW5kZXggPT09ICd1bmRlZmluZWQnID8gW10gOiBbZS5pbmRleF07XG5cdFx0dGhpcy5saXN0LnNldEZvY3VzKGZvY3VzLCBlLmJyb3dzZXJFdmVudCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb25WaWV3UG9pbnRlcihlOiBJTGlzdE1vdXNlRXZlbnQ8VD4pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubW91c2VTdXBwb3J0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGlzRWRpdGFibGVFbGVtZW50KGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkgfHwgaXNNb25hY29FZGl0b3IoZS5icm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlLmJyb3dzZXJFdmVudC5pc0hhbmRsZWRCeUxpc3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRlLmJyb3dzZXJFdmVudC5pc0hhbmRsZWRCeUxpc3QgPSB0cnVlO1xuXHRcdGNvbnN0IGZvY3VzID0gZS5pbmRleDtcblxuXHRcdGlmICh0eXBlb2YgZm9jdXMgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW10sIGUuYnJvd3NlckV2ZW50KTtcblx0XHRcdHRoaXMubGlzdC5zZXRTZWxlY3Rpb24oW10sIGUuYnJvd3NlckV2ZW50KTtcblx0XHRcdHRoaXMubGlzdC5zZXRBbmNob3IodW5kZWZpbmVkKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pc1NlbGVjdGlvbkNoYW5nZUV2ZW50KGUpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jaGFuZ2VTZWxlY3Rpb24oZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5saXN0LnNldEZvY3VzKFtmb2N1c10sIGUuYnJvd3NlckV2ZW50KTtcblx0XHR0aGlzLmxpc3Quc2V0QW5jaG9yKGZvY3VzKTtcblxuXHRcdGlmICghaXNNb3VzZVJpZ2h0Q2xpY2soZS5icm93c2VyRXZlbnQpKSB7XG5cdFx0XHR0aGlzLmxpc3Quc2V0U2VsZWN0aW9uKFtmb2N1c10sIGUuYnJvd3NlckV2ZW50KTtcblx0XHR9XG5cblx0XHR0aGlzLl9vblBvaW50ZXIuZmlyZShlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvbkRvdWJsZUNsaWNrKGU6IElMaXN0TW91c2VFdmVudDxUPik6IHZvaWQge1xuXHRcdGlmIChpc0VkaXRhYmxlRWxlbWVudChlLmJyb3dzZXJFdmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQpIHx8IGlzTW9uYWNvRWRpdG9yKGUuYnJvd3NlckV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pc1NlbGVjdGlvbkNoYW5nZUV2ZW50KGUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGUuYnJvd3NlckV2ZW50LmlzSGFuZGxlZEJ5TGlzdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGUuYnJvd3NlckV2ZW50LmlzSGFuZGxlZEJ5TGlzdCA9IHRydWU7XG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmxpc3QuZ2V0Rm9jdXMoKTtcblx0XHR0aGlzLmxpc3Quc2V0U2VsZWN0aW9uKGZvY3VzLCBlLmJyb3dzZXJFdmVudCk7XG5cdH1cblxuXHRwcml2YXRlIGNoYW5nZVNlbGVjdGlvbihlOiBJTGlzdE1vdXNlRXZlbnQ8VD4gfCBJTGlzdFRvdWNoRXZlbnQ8VD4pOiB2b2lkIHtcblx0XHRjb25zdCBmb2N1cyA9IGUuaW5kZXghO1xuXHRcdGxldCBhbmNob3IgPSB0aGlzLmxpc3QuZ2V0QW5jaG9yKCk7XG5cblx0XHRpZiAodGhpcy5pc1NlbGVjdGlvblJhbmdlQ2hhbmdlRXZlbnQoZSkpIHtcblx0XHRcdGlmICh0eXBlb2YgYW5jaG9yID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRjb25zdCBjdXJyZW50Rm9jdXMgPSB0aGlzLmxpc3QuZ2V0Rm9jdXMoKVswXTtcblx0XHRcdFx0YW5jaG9yID0gY3VycmVudEZvY3VzID8/IGZvY3VzO1xuXHRcdFx0XHR0aGlzLmxpc3Quc2V0QW5jaG9yKGFuY2hvcik7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1pbiA9IE1hdGgubWluKGFuY2hvciwgZm9jdXMpO1xuXHRcdFx0Y29uc3QgbWF4ID0gTWF0aC5tYXgoYW5jaG9yLCBmb2N1cyk7XG5cdFx0XHRjb25zdCByYW5nZVNlbGVjdGlvbiA9IHJhbmdlKG1pbiwgbWF4ICsgMSk7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLmxpc3QuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRjb25zdCBjb250aWd1b3VzUmFuZ2UgPSBnZXRDb250aWd1b3VzUmFuZ2VDb250YWluaW5nKGRpc2p1bmN0aW9uKHNlbGVjdGlvbiwgW2FuY2hvcl0pLCBhbmNob3IpO1xuXG5cdFx0XHRpZiAoY29udGlndW91c1JhbmdlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5ld1NlbGVjdGlvbiA9IGRpc2p1bmN0aW9uKHJhbmdlU2VsZWN0aW9uLCByZWxhdGl2ZUNvbXBsZW1lbnQoc2VsZWN0aW9uLCBjb250aWd1b3VzUmFuZ2UpKTtcblx0XHRcdHRoaXMubGlzdC5zZXRTZWxlY3Rpb24obmV3U2VsZWN0aW9uLCBlLmJyb3dzZXJFdmVudCk7XG5cdFx0XHR0aGlzLmxpc3Quc2V0Rm9jdXMoW2ZvY3VzXSwgZS5icm93c2VyRXZlbnQpO1xuXG5cdFx0fSBlbHNlIGlmICh0aGlzLmlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQoZSkpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMubGlzdC5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdGNvbnN0IG5ld1NlbGVjdGlvbiA9IHNlbGVjdGlvbi5maWx0ZXIoaSA9PiBpICE9PSBmb2N1cyk7XG5cblx0XHRcdHRoaXMubGlzdC5zZXRGb2N1cyhbZm9jdXNdKTtcblx0XHRcdHRoaXMubGlzdC5zZXRBbmNob3IoZm9jdXMpO1xuXG5cdFx0XHRpZiAoc2VsZWN0aW9uLmxlbmd0aCA9PT0gbmV3U2VsZWN0aW9uLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmxpc3Quc2V0U2VsZWN0aW9uKFsuLi5uZXdTZWxlY3Rpb24sIGZvY3VzXSwgZS5icm93c2VyRXZlbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5saXN0LnNldFNlbGVjdGlvbihuZXdTZWxlY3Rpb24sIGUuYnJvd3NlckV2ZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlcjxUPiB7XG5cdGlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQoZXZlbnQ6IElMaXN0TW91c2VFdmVudDxUPiB8IElMaXN0VG91Y2hFdmVudDxUPik6IGJvb2xlYW47XG5cdGlzU2VsZWN0aW9uUmFuZ2VDaGFuZ2VFdmVudChldmVudDogSUxpc3RNb3VzZUV2ZW50PFQ+IHwgSUxpc3RUb3VjaEV2ZW50PFQ+KTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3R5bGVDb250cm9sbGVyIHtcblx0c3R5bGUoc3R5bGVzOiBJTGlzdFN0eWxlcyk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VD4gZXh0ZW5kcyBJTGlzdFZpZXdBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VD4ge1xuXHRnZXRBcmlhTGFiZWwoZWxlbWVudDogVCk6IHN0cmluZyB8IElPYnNlcnZhYmxlPHN0cmluZz4gfCBudWxsO1xuXHRnZXRXaWRnZXRBcmlhTGFiZWwoKTogc3RyaW5nO1xuXHRnZXRXaWRnZXRSb2xlPygpOiBBcmlhUm9sZTtcblx0Z2V0QXJpYUxldmVsPyhlbGVtZW50OiBUKTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRvbkRpZENoYW5nZUFjdGl2ZURlc2NlbmRhbnQ/OiBFdmVudDx2b2lkPjtcblx0Z2V0QWN0aXZlRGVzY2VuZGFudElkPyhlbGVtZW50OiBUKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdFN0eWxlQ29udHJvbGxlciBpbXBsZW1lbnRzIElTdHlsZUNvbnRyb2xsZXIge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgc3R5bGVFbGVtZW50OiBIVE1MU3R5bGVFbGVtZW50LCBwcml2YXRlIHNlbGVjdG9yU3VmZml4OiBzdHJpbmcpIHsgfVxuXG5cdHN0eWxlKHN0eWxlczogSUxpc3RTdHlsZXMpOiB2b2lkIHtcblx0XHRjb25zdCBzdWZmaXggPSB0aGlzLnNlbGVjdG9yU3VmZml4ICYmIGAuJHt0aGlzLnNlbGVjdG9yU3VmZml4fWA7XG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nW10gPSBbXTtcblxuXHRcdGlmIChzdHlsZXMubGlzdEJhY2tncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9IC5tb25hY28tbGlzdC1yb3dzIHsgYmFja2dyb3VuZDogJHtzdHlsZXMubGlzdEJhY2tncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0Rm9jdXNCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBiYWNrZ3JvdW5kLWNvbG9yOiAke3N0eWxlcy5saXN0Rm9jdXNCYWNrZ3JvdW5kfTsgfWApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEZvY3VzQmFja2dyb3VuZH07IH1gKTsgLy8gb3ZlcndyaXRlIDpob3ZlciBzdHlsZSBpbiB0aGlzIGNhc2UhXG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0Rm9jdXNGb3JlZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBjb2xvcjogJHtzdHlsZXMubGlzdEZvY3VzRm9yZWdyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RBY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LnNlbGVjdGVkIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmR9OyB9YCk7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LnNlbGVjdGVkOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmR9OyB9YCk7IC8vIG92ZXJ3cml0ZSA6aG92ZXIgc3R5bGUgaW4gdGhpcyBjYXNlIVxuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9OmZvY3VzIC5tb25hY28tbGlzdC1yb3cuc2VsZWN0ZWQgeyBjb2xvcjogJHtzdHlsZXMubGlzdEFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0QWN0aXZlU2VsZWN0aW9uSWNvbkZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9OmZvY3VzIC5tb25hY28tbGlzdC1yb3cuc2VsZWN0ZWQgLmNvZGljb24geyBjb2xvcjogJHtzdHlsZXMubGlzdEFjdGl2ZVNlbGVjdGlvbkljb25Gb3JlZ3JvdW5kfTsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEZvY3VzQW5kU2VsZWN0aW9uQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGBcblx0XHRcdFx0Lm1vbmFjby1kcmFnLWltYWdlJHtzdWZmaXh9LFxuXHRcdFx0XHQubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZC5mb2N1c2VkIHsgYmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMubGlzdEZvY3VzQW5kU2VsZWN0aW9uQmFja2dyb3VuZH07IH1cblx0XHRcdGApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEZvY3VzQW5kU2VsZWN0aW9uRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGBcblx0XHRcdFx0Lm1vbmFjby1kcmFnLWltYWdlJHtzdWZmaXh9LFxuXHRcdFx0XHQubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZC5mb2N1c2VkIHsgY29sb3I6ICR7c3R5bGVzLmxpc3RGb2N1c0FuZFNlbGVjdGlvbkZvcmVncm91bmR9OyB9XG5cdFx0XHRgKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIHsgY29sb3I6ICAke3N0eWxlcy5saXN0SW5hY3RpdmVGb2N1c0ZvcmVncm91bmR9OyB9YCk7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fSAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQ6aG92ZXIgeyBjb2xvcjogICR7c3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzRm9yZWdyb3VuZH07IH1gKTsgLy8gb3ZlcndyaXRlIDpob3ZlciBzdHlsZSBpbiB0aGlzIGNhc2UhXG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0SW5hY3RpdmVTZWxlY3Rpb25JY29uRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIC5jb2RpY29uIHsgY29sb3I6ICAke3N0eWxlcy5saXN0SW5hY3RpdmVTZWxlY3Rpb25JY29uRm9yZWdyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIHsgYmFja2dyb3VuZC1jb2xvcjogICR7c3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzQmFja2dyb3VuZH07IH1gKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9IC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICAke3N0eWxlcy5saXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmR9OyB9YCk7IC8vIG92ZXJ3cml0ZSA6aG92ZXIgc3R5bGUgaW4gdGhpcyBjYXNlIVxuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZCB7IGJhY2tncm91bmQtY29sb3I6ICAke3N0eWxlcy5saXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kfTsgfWApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1saXN0LXJvdy5zZWxlY3RlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICAke3N0eWxlcy5saXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kfTsgfWApOyAvLyBvdmVyd3JpdGUgOmhvdmVyIHN0eWxlIGluIHRoaXMgY2FzZSFcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RJbmFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9IC5tb25hY28tbGlzdC1yb3cuc2VsZWN0ZWQgeyBjb2xvcjogJHtzdHlsZXMubGlzdEluYWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RIb3ZlckJhY2tncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9Om5vdCguZHJvcC10YXJnZXQpOm5vdCguZHJhZ2dpbmcpIC5tb25hY28tbGlzdC1yb3c6aG92ZXI6bm90KC5zZWxlY3RlZCk6bm90KC5mb2N1c2VkKSB7IGJhY2tncm91bmQtY29sb3I6ICR7c3R5bGVzLmxpc3RIb3ZlckJhY2tncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0SG92ZXJGb3JlZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpub3QoLmRyb3AtdGFyZ2V0KTpub3QoLmRyYWdnaW5nKSAubW9uYWNvLWxpc3Qtcm93OmhvdmVyOm5vdCguc2VsZWN0ZWQpOm5vdCguZm9jdXNlZCkgeyBjb2xvcjogICR7c3R5bGVzLmxpc3RIb3ZlckZvcmVncm91bmR9OyB9YCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT3V0bGluZXNcblx0XHQgKi9cblx0XHRjb25zdCBmb2N1c0FuZFNlbGVjdGlvbk91dGxpbmUgPSBhc0Nzc1ZhbHVlV2l0aERlZmF1bHQoc3R5bGVzLmxpc3RGb2N1c0FuZFNlbGVjdGlvbk91dGxpbmUsIGFzQ3NzVmFsdWVXaXRoRGVmYXVsdChzdHlsZXMubGlzdFNlbGVjdGlvbk91dGxpbmUsIHN0eWxlcy5saXN0Rm9jdXNPdXRsaW5lID8/ICcnKSk7XG5cdFx0aWYgKGZvY3VzQW5kU2VsZWN0aW9uT3V0bGluZSkgeyAvLyBkZWZhdWx0OiBsaXN0Rm9jdXNPdXRsaW5lXG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fTpmb2N1cyAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQuc2VsZWN0ZWQgeyBvdXRsaW5lOiAxcHggc29saWQgJHtmb2N1c0FuZFNlbGVjdGlvbk91dGxpbmV9OyBvdXRsaW5lLW9mZnNldDogLTFweDt9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0Rm9jdXNPdXRsaW5lKSB7IC8vIGRlZmF1bHQ6IHNldFxuXHRcdFx0Y29udGVudC5wdXNoKGBcblx0XHRcdFx0Lm1vbmFjby1kcmFnLWltYWdlJHtzdWZmaXh9LFxuXHRcdFx0XHQubW9uYWNvLWxpc3Qke3N1ZmZpeH06Zm9jdXMgLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkLFxuXHRcdFx0XHQubW9uYWNvLXdvcmtiZW5jaC5jb250ZXh0LW1lbnUtdmlzaWJsZSAubW9uYWNvLWxpc3Qke3N1ZmZpeH0ubGFzdC1mb2N1c2VkIC5tb25hY28tbGlzdC1yb3cuZm9jdXNlZCB7IG91dGxpbmU6IDFweCBzb2xpZCAke3N0eWxlcy5saXN0Rm9jdXNPdXRsaW5lfTsgb3V0bGluZS1vZmZzZXQ6IC0xcHg7IH1cblx0XHRcdGApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluYWN0aXZlRm9jdXNBbmRTZWxlY3Rpb25PdXRsaW5lID0gYXNDc3NWYWx1ZVdpdGhEZWZhdWx0KHN0eWxlcy5saXN0U2VsZWN0aW9uT3V0bGluZSwgc3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzT3V0bGluZSA/PyAnJyk7XG5cdFx0aWYgKGluYWN0aXZlRm9jdXNBbmRTZWxlY3Rpb25PdXRsaW5lKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fSAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQuc2VsZWN0ZWQgeyBvdXRsaW5lOiAxcHggZG90dGVkICR7aW5hY3RpdmVGb2N1c0FuZFNlbGVjdGlvbk91dGxpbmV9OyBvdXRsaW5lLW9mZnNldDogLTFweDsgfWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMubGlzdFNlbGVjdGlvbk91dGxpbmUpIHsgLy8gZGVmYXVsdDogYWN0aXZlQ29udHJhc3RCb3JkZXJcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1saXN0JHtzdWZmaXh9IC5tb25hY28tbGlzdC1yb3cuc2VsZWN0ZWQgeyBvdXRsaW5lOiAxcHggZG90dGVkICR7c3R5bGVzLmxpc3RTZWxlY3Rpb25PdXRsaW5lfTsgb3V0bGluZS1vZmZzZXQ6IC0xcHg7IH1gKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzT3V0bGluZSkgeyAvLyBkZWZhdWx0OiBudWxsXG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tbGlzdCR7c3VmZml4fSAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBvdXRsaW5lOiAxcHggZG90dGVkICR7c3R5bGVzLmxpc3RJbmFjdGl2ZUZvY3VzT3V0bGluZX07IG91dGxpbmUtb2Zmc2V0OiAtMXB4OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0SG92ZXJPdXRsaW5lKSB7ICAvLyBkZWZhdWx0OiBhY3RpdmVDb250cmFzdEJvcmRlclxuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1saXN0LXJvdzpob3ZlciB7IG91dGxpbmU6IDFweCBkYXNoZWQgJHtzdHlsZXMubGlzdEhvdmVyT3V0bGluZX07IG91dGxpbmUtb2Zmc2V0OiAtMXB4OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlcy5saXN0RHJvcE92ZXJCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYFxuXHRcdFx0XHQubW9uYWNvLWxpc3Qke3N1ZmZpeH0uZHJvcC10YXJnZXQsXG5cdFx0XHRcdC5tb25hY28tbGlzdCR7c3VmZml4fSAubW9uYWNvLWxpc3Qtcm93cy5kcm9wLXRhcmdldCxcblx0XHRcdFx0Lm1vbmFjby1saXN0JHtzdWZmaXh9IC5tb25hY28tbGlzdC1yb3cuZHJvcC10YXJnZXQgeyBiYWNrZ3JvdW5kLWNvbG9yOiAke3N0eWxlcy5saXN0RHJvcE92ZXJCYWNrZ3JvdW5kfSAhaW1wb3J0YW50OyBjb2xvcjogaW5oZXJpdCAhaW1wb3J0YW50OyB9XG5cdFx0XHRgKTtcblx0XHR9XG5cblx0XHRpZiAoc3R5bGVzLmxpc3REcm9wQmV0d2VlbkJhY2tncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgXG5cdFx0XHQubW9uYWNvLWxpc3Qke3N1ZmZpeH0gLm1vbmFjby1saXN0LXJvd3MuZHJvcC10YXJnZXQtYmVmb3JlIC5tb25hY28tbGlzdC1yb3c6Zmlyc3QtY2hpbGQ6OmJlZm9yZSxcblx0XHRcdC5tb25hY28tbGlzdCR7c3VmZml4fSAubW9uYWNvLWxpc3Qtcm93LmRyb3AtdGFyZ2V0LWJlZm9yZTo6YmVmb3JlIHtcblx0XHRcdFx0Y29udGVudDogXCJcIjsgcG9zaXRpb246IGFic29sdXRlOyB0b3A6IDBweDsgbGVmdDogMHB4OyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxcHg7XG5cdFx0XHRcdGJhY2tncm91bmQtY29sb3I6ICR7c3R5bGVzLmxpc3REcm9wQmV0d2VlbkJhY2tncm91bmR9O1xuXHRcdFx0fWApO1xuXHRcdFx0Y29udGVudC5wdXNoKGBcblx0XHRcdC5tb25hY28tbGlzdCR7c3VmZml4fSAubW9uYWNvLWxpc3Qtcm93cy5kcm9wLXRhcmdldC1hZnRlciAubW9uYWNvLWxpc3Qtcm93Omxhc3QtY2hpbGQ6OmFmdGVyLFxuXHRcdFx0Lm1vbmFjby1saXN0JHtzdWZmaXh9IC5tb25hY28tbGlzdC1yb3cuZHJvcC10YXJnZXQtYWZ0ZXI6OmFmdGVyIHtcblx0XHRcdFx0Y29udGVudDogXCJcIjsgcG9zaXRpb246IGFic29sdXRlOyBib3R0b206IDBweDsgbGVmdDogMHB4OyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxcHg7XG5cdFx0XHRcdGJhY2tncm91bmQtY29sb3I6ICR7c3R5bGVzLmxpc3REcm9wQmV0d2VlbkJhY2tncm91bmR9O1xuXHRcdFx0fWApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMudGFibGVDb2x1bW5zQm9yZGVyKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYFxuXHRcdFx0XHQubW9uYWNvLXRhYmxlID4gLm1vbmFjby1zcGxpdC12aWV3Mixcblx0XHRcdFx0Lm1vbmFjby10YWJsZSA+IC5tb25hY28tc3BsaXQtdmlldzIgLm1vbmFjby1zYXNoLnZlcnRpY2FsOjpiZWZvcmUsXG5cdFx0XHRcdC5tb25hY28td29ya2JlbmNoOm5vdCgucmVkdWNlLW1vdGlvbikgLm1vbmFjby10YWJsZTpob3ZlciA+IC5tb25hY28tc3BsaXQtdmlldzIsXG5cdFx0XHRcdC5tb25hY28td29ya2JlbmNoOm5vdCgucmVkdWNlLW1vdGlvbikgLm1vbmFjby10YWJsZTpob3ZlciA+IC5tb25hY28tc3BsaXQtdmlldzIgLm1vbmFjby1zYXNoLnZlcnRpY2FsOjpiZWZvcmUge1xuXHRcdFx0XHRcdGJvcmRlci1jb2xvcjogJHtzdHlsZXMudGFibGVDb2x1bW5zQm9yZGVyfTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC5tb25hY28td29ya2JlbmNoOm5vdCgucmVkdWNlLW1vdGlvbikgLm1vbmFjby10YWJsZSA+IC5tb25hY28tc3BsaXQtdmlldzIsXG5cdFx0XHRcdC5tb25hY28td29ya2JlbmNoOm5vdCgucmVkdWNlLW1vdGlvbikgLm1vbmFjby10YWJsZSA+IC5tb25hY28tc3BsaXQtdmlldzIgLm1vbmFjby1zYXNoLnZlcnRpY2FsOjpiZWZvcmUge1xuXHRcdFx0XHRcdGJvcmRlci1jb2xvcjogdHJhbnNwYXJlbnQ7XG5cdFx0XHRcdH1cblx0XHRcdGApO1xuXHRcdH1cblxuXHRcdGlmIChzdHlsZXMudGFibGVPZGRSb3dzQmFja2dyb3VuZENvbG9yKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYFxuXHRcdFx0XHQubW9uYWNvLXRhYmxlIC5tb25hY28tbGlzdC1yb3dbZGF0YS1wYXJpdHk9b2RkXTpub3QoLmZvY3VzZWQpOm5vdCguc2VsZWN0ZWQpOm5vdCg6aG92ZXIpIC5tb25hY28tdGFibGUtdHIsXG5cdFx0XHRcdC5tb25hY28tdGFibGUgLm1vbmFjby1saXN0Om5vdCg6Zm9jdXMpIC5tb25hY28tbGlzdC1yb3dbZGF0YS1wYXJpdHk9b2RkXS5mb2N1c2VkOm5vdCguc2VsZWN0ZWQpOm5vdCg6aG92ZXIpIC5tb25hY28tdGFibGUtdHIsXG5cdFx0XHRcdC5tb25hY28tdGFibGUgLm1vbmFjby1saXN0Om5vdCguZm9jdXNlZCkgLm1vbmFjby1saXN0LXJvd1tkYXRhLXBhcml0eT1vZGRdLmZvY3VzZWQ6bm90KC5zZWxlY3RlZCk6bm90KDpob3ZlcikgLm1vbmFjby10YWJsZS10ciB7XG5cdFx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogJHtzdHlsZXMudGFibGVPZGRSb3dzQmFja2dyb3VuZENvbG9yfTtcblx0XHRcdFx0fVxuXHRcdFx0YCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSBjb250ZW50LmpvaW4oJ1xcbicpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUtleWJvYXJkTmF2aWdhdGlvbkV2ZW50RmlsdGVyIHtcblx0KGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxpc3RPcHRpb25zVXBkYXRlIGV4dGVuZHMgSUxpc3RWaWV3T3B0aW9uc1VwZGF0ZSB7XG5cdHJlYWRvbmx5IHR5cGVOYXZpZ2F0aW9uRW5hYmxlZD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHR5cGVOYXZpZ2F0aW9uTW9kZT86IFR5cGVOYXZpZ2F0aW9uTW9kZTtcblx0cmVhZG9ubHkgbXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTGlzdE9wdGlvbnM8VD4gZXh0ZW5kcyBJTGlzdE9wdGlvbnNVcGRhdGUge1xuXHRyZWFkb25seSBpZGVudGl0eVByb3ZpZGVyPzogSUlkZW50aXR5UHJvdmlkZXI8VD47XG5cdHJlYWRvbmx5IGRuZD86IElMaXN0RHJhZ0FuZERyb3A8VD47XG5cdHJlYWRvbmx5IGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI/OiBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjxUPjtcblx0cmVhZG9ubHkga2V5Ym9hcmROYXZpZ2F0aW9uRGVsZWdhdGU/OiBJS2V5Ym9hcmROYXZpZ2F0aW9uRGVsZWdhdGU7XG5cdHJlYWRvbmx5IGtleWJvYXJkU3VwcG9ydD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IG11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlcj86IElNdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXI8VD47XG5cdHJlYWRvbmx5IHN0eWxlQ29udHJvbGxlcj86IChzdWZmaXg6IHN0cmluZykgPT4gSVN0eWxlQ29udHJvbGxlcjtcblx0cmVhZG9ubHkgYWNjZXNzaWJpbGl0eVByb3ZpZGVyPzogSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VD47XG5cdHJlYWRvbmx5IGtleWJvYXJkTmF2aWdhdGlvbkV2ZW50RmlsdGVyPzogSUtleWJvYXJkTmF2aWdhdGlvbkV2ZW50RmlsdGVyO1xuXG5cdC8vIGxpc3QgdmlldyBvcHRpb25zXG5cdHJlYWRvbmx5IHVzZVNoYWRvd3M/OiBib29sZWFuO1xuXHRyZWFkb25seSB2ZXJ0aWNhbFNjcm9sbE1vZGU/OiBTY3JvbGxiYXJWaXNpYmlsaXR5O1xuXHRyZWFkb25seSBzZXRSb3dMaW5lSGVpZ2h0PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgc2V0Um93SGVpZ2h0PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgc3VwcG9ydER5bmFtaWNIZWlnaHRzPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgbW91c2VTdXBwb3J0PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgdXNlclNlbGVjdGlvbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGhvcml6b250YWxTY3JvbGxpbmc/OiBib29sZWFuO1xuXHRyZWFkb25seSBzY3JvbGxCeVBhZ2U/OiBib29sZWFuO1xuXHRyZWFkb25seSB0cmFuc2Zvcm1PcHRpbWl6YXRpb24/OiBib29sZWFuO1xuXHRyZWFkb25seSBzbW9vdGhTY3JvbGxpbmc/OiBib29sZWFuO1xuXHRyZWFkb25seSBzY3JvbGxhYmxlRWxlbWVudENoYW5nZU9wdGlvbnM/OiBTY3JvbGxhYmxlRWxlbWVudENoYW5nZU9wdGlvbnM7XG5cdHJlYWRvbmx5IGFsd2F5c0NvbnN1bWVNb3VzZVdoZWVsPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgaW5pdGlhbFNpemU/OiBEaW1lbnNpb247XG5cdHJlYWRvbmx5IHBhZGRpbmdUb3A/OiBudW1iZXI7XG5cdHJlYWRvbmx5IHBhZGRpbmdCb3R0b20/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxpc3RTdHlsZXMge1xuXHRsaXN0QmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsaXN0Rm9jdXNCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxpc3RGb2N1c0ZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEFjdGl2ZVNlbGVjdGlvbkljb25Gb3JlZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxpc3RGb2N1c0FuZFNlbGVjdGlvbk91dGxpbmU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEZvY3VzQW5kU2VsZWN0aW9uQmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsaXN0Rm9jdXNBbmRTZWxlY3Rpb25Gb3JlZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEluYWN0aXZlU2VsZWN0aW9uSWNvbkZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEluYWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsaXN0SW5hY3RpdmVGb2N1c0ZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEluYWN0aXZlRm9jdXNCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxpc3RIb3ZlckJhY2tncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEhvdmVyRm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsaXN0RHJvcE92ZXJCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxpc3REcm9wQmV0d2VlbkJhY2tncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEZvY3VzT3V0bGluZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsaXN0SW5hY3RpdmVGb2N1c091dGxpbmU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdFNlbGVjdGlvbk91dGxpbmU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0bGlzdEhvdmVyT3V0bGluZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR0cmVlSW5kZW50R3VpZGVzU3Ryb2tlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHRyZWVJbmFjdGl2ZUluZGVudEd1aWRlc1N0cm9rZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR0cmVlU3RpY2t5U2Nyb2xsQmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR0cmVlU3RpY2t5U2Nyb2xsQm9yZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHRyZWVTdGlja3lTY3JvbGxTaGFkb3c6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0dGFibGVDb2x1bW5zQm9yZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHRhYmxlT2RkUm93c0JhY2tncm91bmRDb2xvcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgY29uc3QgdW50aGVtZWRMaXN0U3R5bGVzOiBJTGlzdFN0eWxlcyA9IHtcblx0bGlzdEZvY3VzQmFja2dyb3VuZDogJyM3RkIwRDAnLFxuXHRsaXN0QWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZDogJyMwRTYzOUMnLFxuXHRsaXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZDogJyNGRkZGRkYnLFxuXHRsaXN0QWN0aXZlU2VsZWN0aW9uSWNvbkZvcmVncm91bmQ6ICcjRkZGRkZGJyxcblx0bGlzdEZvY3VzQW5kU2VsZWN0aW9uT3V0bGluZTogJyM5MEMyRjknLFxuXHRsaXN0Rm9jdXNBbmRTZWxlY3Rpb25CYWNrZ3JvdW5kOiAnIzA5NDc3MScsXG5cdGxpc3RGb2N1c0FuZFNlbGVjdGlvbkZvcmVncm91bmQ6ICcjRkZGRkZGJyxcblx0bGlzdEluYWN0aXZlU2VsZWN0aW9uQmFja2dyb3VuZDogJyMzRjNGNDYnLFxuXHRsaXN0SW5hY3RpdmVTZWxlY3Rpb25JY29uRm9yZWdyb3VuZDogJyNGRkZGRkYnLFxuXHRsaXN0SG92ZXJCYWNrZ3JvdW5kOiAnIzJBMkQyRScsXG5cdGxpc3REcm9wT3ZlckJhY2tncm91bmQ6ICcjMzgzQjNEJyxcblx0bGlzdERyb3BCZXR3ZWVuQmFja2dyb3VuZDogJyNFRUVFRUUnLFxuXHR0cmVlSW5kZW50R3VpZGVzU3Ryb2tlOiAnI2E5YTlhOScsXG5cdHRyZWVJbmFjdGl2ZUluZGVudEd1aWRlc1N0cm9rZTogQ29sb3IuZnJvbUhleCgnI2E5YTlhOScpLnRyYW5zcGFyZW50KDAuNCkudG9TdHJpbmcoKSxcblx0dGFibGVDb2x1bW5zQm9yZGVyOiBDb2xvci5mcm9tSGV4KCcjY2NjY2NjJykudHJhbnNwYXJlbnQoMC4yKS50b1N0cmluZygpLFxuXHR0YWJsZU9kZFJvd3NCYWNrZ3JvdW5kQ29sb3I6IENvbG9yLmZyb21IZXgoJyNjY2NjY2MnKS50cmFuc3BhcmVudCgwLjA0KS50b1N0cmluZygpLFxuXHRsaXN0QmFja2dyb3VuZDogdW5kZWZpbmVkLFxuXHRsaXN0Rm9jdXNGb3JlZ3JvdW5kOiB1bmRlZmluZWQsXG5cdGxpc3RJbmFjdGl2ZVNlbGVjdGlvbkZvcmVncm91bmQ6IHVuZGVmaW5lZCxcblx0bGlzdEluYWN0aXZlRm9jdXNGb3JlZ3JvdW5kOiB1bmRlZmluZWQsXG5cdGxpc3RJbmFjdGl2ZUZvY3VzQmFja2dyb3VuZDogdW5kZWZpbmVkLFxuXHRsaXN0SG92ZXJGb3JlZ3JvdW5kOiB1bmRlZmluZWQsXG5cdGxpc3RGb2N1c091dGxpbmU6IHVuZGVmaW5lZCxcblx0bGlzdEluYWN0aXZlRm9jdXNPdXRsaW5lOiB1bmRlZmluZWQsXG5cdGxpc3RTZWxlY3Rpb25PdXRsaW5lOiB1bmRlZmluZWQsXG5cdGxpc3RIb3Zlck91dGxpbmU6IHVuZGVmaW5lZCxcblx0dHJlZVN0aWNreVNjcm9sbEJhY2tncm91bmQ6IHVuZGVmaW5lZCxcblx0dHJlZVN0aWNreVNjcm9sbEJvcmRlcjogdW5kZWZpbmVkLFxuXHR0cmVlU3RpY2t5U2Nyb2xsU2hhZG93OiB1bmRlZmluZWRcbn07XG5cbmNvbnN0IERlZmF1bHRPcHRpb25zOiBJTGlzdE9wdGlvbnM8YW55PiA9IHtcblx0a2V5Ym9hcmRTdXBwb3J0OiB0cnVlLFxuXHRtb3VzZVN1cHBvcnQ6IHRydWUsXG5cdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogdHJ1ZSxcblx0ZG5kOiB7XG5cdFx0Z2V0RHJhZ1VSSSgpIHsgcmV0dXJuIG51bGw7IH0sXG5cdFx0b25EcmFnU3RhcnQoKTogdm9pZCB7IH0sXG5cdFx0b25EcmFnT3ZlcigpIHsgcmV0dXJuIGZhbHNlOyB9LFxuXHRcdGRyb3AoKSB7IH0sXG5cdFx0ZGlzcG9zZSgpIHsgfVxuXHR9XG59O1xuXG4vLyBUT0RPQEpvYW86IG1vdmUgdGhlc2UgdXRpbHMgaW50byBhIFNvcnRlZEFycmF5IGNsYXNzXG5cbmZ1bmN0aW9uIGdldENvbnRpZ3VvdXNSYW5nZUNvbnRhaW5pbmcocmFuZ2U6IG51bWJlcltdLCB2YWx1ZTogbnVtYmVyKTogbnVtYmVyW10ge1xuXHRjb25zdCBpbmRleCA9IHJhbmdlLmluZGV4T2YodmFsdWUpO1xuXG5cdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdGxldCBpID0gaW5kZXggLSAxO1xuXHR3aGlsZSAoaSA+PSAwICYmIHJhbmdlW2ldID09PSB2YWx1ZSAtIChpbmRleCAtIGkpKSB7XG5cdFx0cmVzdWx0LnB1c2gocmFuZ2VbaS0tXSk7XG5cdH1cblxuXHRyZXN1bHQucmV2ZXJzZSgpO1xuXHRpID0gaW5kZXg7XG5cdHdoaWxlIChpIDwgcmFuZ2UubGVuZ3RoICYmIHJhbmdlW2ldID09PSB2YWx1ZSArIChpIC0gaW5kZXgpKSB7XG5cdFx0cmVzdWx0LnB1c2gocmFuZ2VbaSsrXSk7XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEdpdmVuIHR3byBzb3J0ZWQgY29sbGVjdGlvbnMgb2YgbnVtYmVycywgcmV0dXJucyB0aGUgaW50ZXJzZWN0aW9uXG4gKiBiZXR3ZWVuIHRoZW0gKE9SKS5cbiAqL1xuZnVuY3Rpb24gZGlzanVuY3Rpb24ob25lOiBudW1iZXJbXSwgb3RoZXI6IG51bWJlcltdKTogbnVtYmVyW10ge1xuXHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdGxldCBpID0gMCwgaiA9IDA7XG5cblx0d2hpbGUgKGkgPCBvbmUubGVuZ3RoIHx8IGogPCBvdGhlci5sZW5ndGgpIHtcblx0XHRpZiAoaSA+PSBvbmUubGVuZ3RoKSB7XG5cdFx0XHRyZXN1bHQucHVzaChvdGhlcltqKytdKTtcblx0XHR9IGVsc2UgaWYgKGogPj0gb3RoZXIubGVuZ3RoKSB7XG5cdFx0XHRyZXN1bHQucHVzaChvbmVbaSsrXSk7XG5cdFx0fSBlbHNlIGlmIChvbmVbaV0gPT09IG90aGVyW2pdKSB7XG5cdFx0XHRyZXN1bHQucHVzaChvbmVbaV0pO1xuXHRcdFx0aSsrO1xuXHRcdFx0aisrO1xuXHRcdFx0Y29udGludWU7XG5cdFx0fSBlbHNlIGlmIChvbmVbaV0gPCBvdGhlcltqXSkge1xuXHRcdFx0cmVzdWx0LnB1c2gob25lW2krK10pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQucHVzaChvdGhlcltqKytdKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEdpdmVuIHR3byBzb3J0ZWQgY29sbGVjdGlvbnMgb2YgbnVtYmVycywgcmV0dXJucyB0aGUgcmVsYXRpdmVcbiAqIGNvbXBsZW1lbnQgYmV0d2VlbiB0aGVtIChYT1IpLlxuICovXG5mdW5jdGlvbiByZWxhdGl2ZUNvbXBsZW1lbnQob25lOiBudW1iZXJbXSwgb3RoZXI6IG51bWJlcltdKTogbnVtYmVyW10ge1xuXHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdGxldCBpID0gMCwgaiA9IDA7XG5cblx0d2hpbGUgKGkgPCBvbmUubGVuZ3RoIHx8IGogPCBvdGhlci5sZW5ndGgpIHtcblx0XHRpZiAoaSA+PSBvbmUubGVuZ3RoKSB7XG5cdFx0XHRyZXN1bHQucHVzaChvdGhlcltqKytdKTtcblx0XHR9IGVsc2UgaWYgKGogPj0gb3RoZXIubGVuZ3RoKSB7XG5cdFx0XHRyZXN1bHQucHVzaChvbmVbaSsrXSk7XG5cdFx0fSBlbHNlIGlmIChvbmVbaV0gPT09IG90aGVyW2pdKSB7XG5cdFx0XHRpKys7XG5cdFx0XHRqKys7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9IGVsc2UgaWYgKG9uZVtpXSA8IG90aGVyW2pdKSB7XG5cdFx0XHRyZXN1bHQucHVzaChvbmVbaSsrXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGorKztcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5jb25zdCBudW1lcmljU29ydCA9IChhOiBudW1iZXIsIGI6IG51bWJlcikgPT4gYSAtIGI7XG5cbmNsYXNzIFBpcGVsaW5lUmVuZGVyZXI8VD4gaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPFQsIGFueT4ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX3RlbXBsYXRlSWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlbmRlcmVyczogSUxpc3RSZW5kZXJlcjxhbnkgLyogVE9ET0Bqb2FvICovLCBhbnk+W11cblx0KSB7IH1cblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl90ZW1wbGF0ZUlkO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IGFueVtdIHtcblx0XHRyZXR1cm4gdGhpcy5yZW5kZXJlcnMubWFwKHIgPT4gci5yZW5kZXJUZW1wbGF0ZShjb250YWluZXIpKTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogVCwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBhbnlbXSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRsZXQgaSA9IDA7XG5cblx0XHRmb3IgKGNvbnN0IHJlbmRlcmVyIG9mIHRoaXMucmVuZGVyZXJzKSB7XG5cdFx0XHRyZW5kZXJlci5yZW5kZXJFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGFbaSsrXSwgaGVpZ2h0KTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChlbGVtZW50OiBULCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IGFueVtdLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGxldCBpID0gMDtcblxuXHRcdGZvciAoY29uc3QgcmVuZGVyZXIgb2YgdGhpcy5yZW5kZXJlcnMpIHtcblx0XHRcdHJlbmRlcmVyLmRpc3Bvc2VFbGVtZW50Py4oZWxlbWVudCwgaW5kZXgsIHRlbXBsYXRlRGF0YVtpXSwgaGVpZ2h0KTtcblxuXHRcdFx0aSArPSAxO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IGFueVtdKTogdm9pZCB7XG5cdFx0bGV0IGkgPSAwO1xuXG5cdFx0Zm9yIChjb25zdCByZW5kZXJlciBvZiB0aGlzLnJlbmRlcmVycykge1xuXHRcdFx0cmVuZGVyZXIuZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YVtpKytdKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgQWNjZXNzaWJpbHR5UmVuZGVyZXI8VD4gaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPFQsIElBY2Nlc3NpYmlsaXR5VGVtcGxhdGVEYXRhPiB7XG5cblx0dGVtcGxhdGVJZDogc3RyaW5nID0gJ2ExOG4nO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgYWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlcjxUPikgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElBY2Nlc3NpYmlsaXR5VGVtcGxhdGVEYXRhIHtcblx0XHRyZXR1cm4geyBjb250YWluZXIsIGRpc3Bvc2FibGVzOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCkgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogVCwgaW5kZXg6IG51bWJlciwgZGF0YTogSUFjY2Vzc2liaWxpdHlUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBhcmlhTGFiZWwgPSB0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRBcmlhTGFiZWwoZWxlbWVudCk7XG5cdFx0Y29uc3Qgb2JzZXJ2YWJsZSA9IChhcmlhTGFiZWwgJiYgdHlwZW9mIGFyaWFMYWJlbCAhPT0gJ3N0cmluZycpID8gYXJpYUxhYmVsIDogY29uc3RPYnNlcnZhYmxlKGFyaWFMYWJlbCk7XG5cblx0XHRkYXRhLmRpc3Bvc2FibGVzLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHR0aGlzLnNldEFyaWFMYWJlbChyZWFkZXIucmVhZE9ic2VydmFibGUob2JzZXJ2YWJsZSksIGRhdGEuY29udGFpbmVyKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBhcmlhTGV2ZWwgPSB0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRBcmlhTGV2ZWwgJiYgdGhpcy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0QXJpYUxldmVsKGVsZW1lbnQpO1xuXG5cdFx0aWYgKHR5cGVvZiBhcmlhTGV2ZWwgPT09ICdudW1iZXInKSB7XG5cdFx0XHRkYXRhLmNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGV2ZWwnLCBgJHthcmlhTGV2ZWx9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRhdGEuY29udGFpbmVyLnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1sZXZlbCcpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2V0QXJpYUxhYmVsKGFyaWFMYWJlbDogc3RyaW5nIHwgbnVsbCwgZWxlbWVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAoYXJpYUxhYmVsKSB7XG5cdFx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGFyaWFMYWJlbCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWxhYmVsJyk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoZWxlbWVudDogVCwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJQWNjZXNzaWJpbGl0eVRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IGFueSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgTGlzdFZpZXdEcmFnQW5kRHJvcDxUPiBpbXBsZW1lbnRzIElMaXN0Vmlld0RyYWdBbmREcm9wPFQ+IHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGxpc3Q6IExpc3Q8VD4sIHByaXZhdGUgZG5kOiBJTGlzdERyYWdBbmREcm9wPFQ+KSB7IH1cblxuXHRnZXREcmFnRWxlbWVudHMoZWxlbWVudDogVCk6IFRbXSB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5saXN0LmdldFNlbGVjdGVkRWxlbWVudHMoKTtcblx0XHRjb25zdCBlbGVtZW50cyA9IHNlbGVjdGlvbi5pbmRleE9mKGVsZW1lbnQpID4gLTEgPyBzZWxlY3Rpb24gOiBbZWxlbWVudF07XG5cdFx0cmV0dXJuIGVsZW1lbnRzO1xuXHR9XG5cblx0Z2V0RHJhZ1VSSShlbGVtZW50OiBUKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuZG5kLmdldERyYWdVUkkoZWxlbWVudCk7XG5cdH1cblxuXHRnZXREcmFnTGFiZWw/KGVsZW1lbnRzOiBUW10sIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuZG5kLmdldERyYWdMYWJlbCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG5kLmdldERyYWdMYWJlbChlbGVtZW50cywgb3JpZ2luYWxFdmVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdG9uRHJhZ1N0YXJ0KGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuZG5kLm9uRHJhZ1N0YXJ0Py4oZGF0YSwgb3JpZ2luYWxFdmVudCk7XG5cdH1cblxuXHRvbkRyYWdPdmVyKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldEVsZW1lbnQ6IFQsIHRhcmdldEluZGV4OiBudW1iZXIsIHRhcmdldFNlY3RvcjogTGlzdFZpZXdUYXJnZXRTZWN0b3IgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IGJvb2xlYW4gfCBJTGlzdERyYWdPdmVyUmVhY3Rpb24ge1xuXHRcdHJldHVybiB0aGlzLmRuZC5vbkRyYWdPdmVyKGRhdGEsIHRhcmdldEVsZW1lbnQsIHRhcmdldEluZGV4LCB0YXJnZXRTZWN0b3IsIG9yaWdpbmFsRXZlbnQpO1xuXHR9XG5cblx0b25EcmFnTGVhdmUoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0RWxlbWVudDogVCwgdGFyZ2V0SW5kZXg6IG51bWJlciwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5kbmQub25EcmFnTGVhdmU/LihkYXRhLCB0YXJnZXRFbGVtZW50LCB0YXJnZXRJbmRleCwgb3JpZ2luYWxFdmVudCk7XG5cdH1cblxuXHRvbkRyYWdFbmQob3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5kbmQub25EcmFnRW5kPy4ob3JpZ2luYWxFdmVudCk7XG5cdH1cblxuXHRkcm9wKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldEVsZW1lbnQ6IFQsIHRhcmdldEluZGV4OiBudW1iZXIsIHRhcmdldFNlY3RvcjogTGlzdFZpZXdUYXJnZXRTZWN0b3IgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuZG5kLmRyb3AoZGF0YSwgdGFyZ2V0RWxlbWVudCwgdGFyZ2V0SW5kZXgsIHRhcmdldFNlY3Rvciwgb3JpZ2luYWxFdmVudCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZG5kLmRpc3Bvc2UoKTtcblx0fVxufVxuXG4vKipcbiAqIFRoZSB7QGxpbmsgTGlzdH0gaXMgYSB2aXJ0dWFsIHNjcm9sbGluZyB3aWRnZXQsIGJ1aWx0IG9uIHRvcCBvZiB0aGUge0BsaW5rIExpc3RWaWV3fVxuICogd2lkZ2V0LlxuICpcbiAqIEZlYXR1cmVzOlxuICogLSBDdXN0b21pemFibGUga2V5Ym9hcmQgYW5kIG1vdXNlIHN1cHBvcnRcbiAqIC0gRWxlbWVudCB0cmFpdHM6IGZvY3VzLCBzZWxlY3Rpb24sIGFjaG9yXG4gKiAtIEFjY2Vzc2liaWxpdHkgc3VwcG9ydFxuICogLSBUb3VjaCBzdXBwb3J0XG4gKiAtIFBlcmZvcm1hbnQgdGVtcGxhdGUtYmFzZWQgcmVuZGVyaW5nXG4gKiAtIEhvcml6b250YWwgc2Nyb2xsaW5nXG4gKiAtIFZhcmlhYmxlIGVsZW1lbnQgaGVpZ2h0IHN1cHBvcnRcbiAqIC0gRHluYW1pYyBlbGVtZW50IGhlaWdodCBzdXBwb3J0XG4gKiAtIERyYWctYW5kLWRyb3Agc3VwcG9ydFxuICovXG5leHBvcnQgY2xhc3MgTGlzdDxUPiBpbXBsZW1lbnRzIElTcGxpY2VhYmxlPFQ+LCBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBmb2N1cyA9IG5ldyBUcmFpdDxUPignZm9jdXNlZCcpO1xuXHRwcml2YXRlIHNlbGVjdGlvbjogVHJhaXQ8VD47XG5cdHByaXZhdGUgYW5jaG9yID0gbmV3IFRyYWl0PFQ+KCdhbmNob3InKTtcblx0cHJpdmF0ZSBldmVudEJ1ZmZlcmVyID0gbmV3IEV2ZW50QnVmZmVyZXIoKTtcblx0cHJvdGVjdGVkIHZpZXc6IElMaXN0VmlldzxUPjtcblx0cHJpdmF0ZSBzcGxpY2VhYmxlOiBJU3BsaWNlYWJsZTxUPjtcblx0cHJpdmF0ZSBzdHlsZUNvbnRyb2xsZXI6IElTdHlsZUNvbnRyb2xsZXI7XG5cdHByaXZhdGUgdHlwZU5hdmlnYXRpb25Db250cm9sbGVyPzogVHlwZU5hdmlnYXRpb25Db250cm9sbGVyPFQ+O1xuXHRwcml2YXRlIGFjY2Vzc2liaWxpdHlQcm92aWRlcj86IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPFQ+O1xuXHRwcml2YXRlIGtleWJvYXJkQ29udHJvbGxlcjogS2V5Ym9hcmRDb250cm9sbGVyPFQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIG1vdXNlQ29udHJvbGxlcjogTW91c2VDb250cm9sbGVyPFQ+O1xuXHRwcml2YXRlIF9hcmlhTGFiZWw6IHN0cmluZyA9ICcnO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRAbWVtb2l6ZSBnZXQgb25EaWRDaGFuZ2VGb2N1cygpOiBFdmVudDxJTGlzdEV2ZW50PFQ+PiB7XG5cdFx0cmV0dXJuIEV2ZW50Lm1hcCh0aGlzLmV2ZW50QnVmZmVyZXIud3JhcEV2ZW50KHRoaXMuZm9jdXMub25DaGFuZ2UpLCBlID0+IHRoaXMudG9MaXN0RXZlbnQoZSksIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0QG1lbW9pemUgZ2V0IG9uRGlkQ2hhbmdlU2VsZWN0aW9uKCk6IEV2ZW50PElMaXN0RXZlbnQ8VD4+IHtcblx0XHRyZXR1cm4gRXZlbnQubWFwKHRoaXMuZXZlbnRCdWZmZXJlci53cmFwRXZlbnQodGhpcy5zZWxlY3Rpb24ub25DaGFuZ2UpLCBlID0+IHRoaXMudG9MaXN0RXZlbnQoZSksIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0Z2V0IGRvbUlkKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLnZpZXcuZG9tSWQ7IH1cblx0Z2V0IG9uRGlkU2Nyb2xsKCk6IEV2ZW50PFNjcm9sbEV2ZW50PiB7IHJldHVybiB0aGlzLnZpZXcub25EaWRTY3JvbGw7IH1cblx0Z2V0IG9uTW91c2VDbGljaygpOiBFdmVudDxJTGlzdE1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIHRoaXMudmlldy5vbk1vdXNlQ2xpY2s7IH1cblx0Z2V0IG9uTW91c2VEYmxDbGljaygpOiBFdmVudDxJTGlzdE1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIHRoaXMudmlldy5vbk1vdXNlRGJsQ2xpY2s7IH1cblx0Z2V0IG9uTW91c2VNaWRkbGVDbGljaygpOiBFdmVudDxJTGlzdE1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIHRoaXMudmlldy5vbk1vdXNlTWlkZGxlQ2xpY2s7IH1cblx0Z2V0IG9uUG9pbnRlcigpOiBFdmVudDxJTGlzdE1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIHRoaXMubW91c2VDb250cm9sbGVyLm9uUG9pbnRlcjsgfVxuXHRnZXQgb25Nb3VzZVVwKCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4geyByZXR1cm4gdGhpcy52aWV3Lm9uTW91c2VVcDsgfVxuXHRnZXQgb25Nb3VzZURvd24oKTogRXZlbnQ8SUxpc3RNb3VzZUV2ZW50PFQ+PiB7IHJldHVybiB0aGlzLnZpZXcub25Nb3VzZURvd247IH1cblx0Z2V0IG9uTW91c2VPdmVyKCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4geyByZXR1cm4gdGhpcy52aWV3Lm9uTW91c2VPdmVyOyB9XG5cdGdldCBvbk1vdXNlTW92ZSgpOiBFdmVudDxJTGlzdE1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIHRoaXMudmlldy5vbk1vdXNlTW92ZTsgfVxuXHRnZXQgb25Nb3VzZU91dCgpOiBFdmVudDxJTGlzdE1vdXNlRXZlbnQ8VD4+IHsgcmV0dXJuIHRoaXMudmlldy5vbk1vdXNlT3V0OyB9XG5cdGdldCBvblRvdWNoU3RhcnQoKTogRXZlbnQ8SUxpc3RUb3VjaEV2ZW50PFQ+PiB7IHJldHVybiB0aGlzLnZpZXcub25Ub3VjaFN0YXJ0OyB9XG5cdGdldCBvblRhcCgpOiBFdmVudDxJTGlzdEdlc3R1cmVFdmVudDxUPj4geyByZXR1cm4gdGhpcy52aWV3Lm9uVGFwOyB9XG5cblx0LyoqXG5cdCAqIFBvc3NpYmxlIGNvbnRleHQgbWVudSB0cmlnZ2VyIGV2ZW50czpcblx0ICogLSBDb250ZXh0TWVudSBrZXlcblx0ICogLSBTaGlmdCBGMTBcblx0ICogLSBDdHJsIE9wdGlvbiBTaGlmdCBNIChtYWNPUyB3aXRoIFZvaWNlT3Zlcilcblx0ICogLSBNb3VzZSByaWdodCBjbGlja1xuXHQgKi9cblx0QG1lbW9pemUgZ2V0IG9uQ29udGV4dE1lbnUoKTogRXZlbnQ8SUxpc3RDb250ZXh0TWVudUV2ZW50PFQ+PiB7XG5cdFx0bGV0IGRpZEp1c3RQcmVzc0NvbnRleHRNZW51S2V5ID0gZmFsc2U7XG5cblx0XHRjb25zdCBmcm9tS2V5RG93bjogRXZlbnQ8YW55PiA9IEV2ZW50LmNoYWluKHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMudmlldy5kb21Ob2RlLCAna2V5ZG93bicpKS5ldmVudCwgJCA9PlxuXHRcdFx0JC5tYXAoZSA9PiBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpKVxuXHRcdFx0XHQuZmlsdGVyKGUgPT4gZGlkSnVzdFByZXNzQ29udGV4dE1lbnVLZXkgPSBlLmtleUNvZGUgPT09IEtleUNvZGUuQ29udGV4dE1lbnUgfHwgKGUuc2hpZnRLZXkgJiYgZS5rZXlDb2RlID09PSBLZXlDb2RlLkYxMCkpXG5cdFx0XHRcdC5tYXAoZSA9PiBFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpKVxuXHRcdFx0XHQuZmlsdGVyKCgpID0+IGZhbHNlKSk7XG5cblx0XHRjb25zdCBmcm9tS2V5VXAgPSBFdmVudC5jaGFpbih0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcih0aGlzLnZpZXcuZG9tTm9kZSwgJ2tleXVwJykpLmV2ZW50LCAkID0+XG5cdFx0XHQkLmZvckVhY2goKCkgPT4gZGlkSnVzdFByZXNzQ29udGV4dE1lbnVLZXkgPSBmYWxzZSlcblx0XHRcdFx0Lm1hcChlID0+IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSkpXG5cdFx0XHRcdC5maWx0ZXIoZSA9PiBlLmtleUNvZGUgPT09IEtleUNvZGUuQ29udGV4dE1lbnUgfHwgKGUuc2hpZnRLZXkgJiYgZS5rZXlDb2RlID09PSBLZXlDb2RlLkYxMCkpXG5cdFx0XHRcdC5tYXAoZSA9PiBFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpKVxuXHRcdFx0XHQubWFwKCh7IGJyb3dzZXJFdmVudCB9KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmdldEZvY3VzKCk7XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSBmb2N1cy5sZW5ndGggPyBmb2N1c1swXSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRjb25zdCBlbGVtZW50ID0gdHlwZW9mIGluZGV4ICE9PSAndW5kZWZpbmVkJyA/IHRoaXMudmlldy5lbGVtZW50KGluZGV4KSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRjb25zdCBhbmNob3IgPSB0eXBlb2YgaW5kZXggIT09ICd1bmRlZmluZWQnID8gdGhpcy52aWV3LmRvbUVsZW1lbnQoaW5kZXgpIGFzIEhUTUxFbGVtZW50IDogdGhpcy52aWV3LmRvbU5vZGU7XG5cdFx0XHRcdFx0cmV0dXJuIHsgaW5kZXgsIGVsZW1lbnQsIGFuY2hvciwgYnJvd3NlckV2ZW50IH07XG5cdFx0XHRcdH0pKTtcblxuXHRcdGNvbnN0IGZyb21Nb3VzZSA9IEV2ZW50LmNoYWluKHRoaXMudmlldy5vbkNvbnRleHRNZW51LCAkID0+XG5cdFx0XHQkLmZpbHRlcihfID0+ICFkaWRKdXN0UHJlc3NDb250ZXh0TWVudUtleSlcblx0XHRcdFx0Lm1hcCgoeyBlbGVtZW50LCBpbmRleCwgYnJvd3NlckV2ZW50IH0pID0+ICh7IGVsZW1lbnQsIGluZGV4LCBhbmNob3I6IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KHRoaXMudmlldy5kb21Ob2RlKSwgYnJvd3NlckV2ZW50KSwgYnJvd3NlckV2ZW50IH0pKVxuXHRcdCk7XG5cblx0XHRyZXR1cm4gRXZlbnQuYW55PElMaXN0Q29udGV4dE1lbnVFdmVudDxUPj4oZnJvbUtleURvd24sIGZyb21LZXlVcCwgZnJvbU1vdXNlKTtcblx0fVxuXG5cdEBtZW1vaXplIGdldCBvbktleURvd24oKTogRXZlbnQ8S2V5Ym9hcmRFdmVudD4geyByZXR1cm4gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy52aWV3LmRvbU5vZGUsICdrZXlkb3duJykpLmV2ZW50OyB9XG5cdEBtZW1vaXplIGdldCBvbktleVVwKCk6IEV2ZW50PEtleWJvYXJkRXZlbnQ+IHsgcmV0dXJuIHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMudmlldy5kb21Ob2RlLCAna2V5dXAnKSkuZXZlbnQ7IH1cblx0QG1lbW9pemUgZ2V0IG9uS2V5UHJlc3MoKTogRXZlbnQ8S2V5Ym9hcmRFdmVudD4geyByZXR1cm4gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy52aWV3LmRvbU5vZGUsICdrZXlwcmVzcycpKS5ldmVudDsgfVxuXG5cdEBtZW1vaXplIGdldCBvbkRpZEZvY3VzKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIEV2ZW50LnNpZ25hbCh0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcih0aGlzLnZpZXcuZG9tTm9kZSwgJ2ZvY3VzJywgdHJ1ZSkpLmV2ZW50KTsgfVxuXHRAbWVtb2l6ZSBnZXQgb25EaWRCbHVyKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIEV2ZW50LnNpZ25hbCh0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcih0aGlzLnZpZXcuZG9tTm9kZSwgJ2JsdXInLCB0cnVlKSkuZXZlbnQpOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWREaXNwb3NlID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWREaXNwb3NlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkRGlzcG9zZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHVzZXI6IHN0cmluZyxcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHZpcnR1YWxEZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VD4sXG5cdFx0cmVuZGVyZXJzOiBJTGlzdFJlbmRlcmVyPGFueSAvKiBUT0RPQGpvYW8gKi8sIGFueT5bXSxcblx0XHRwcml2YXRlIF9vcHRpb25zOiBJTGlzdE9wdGlvbnM8VD4gPSBEZWZhdWx0T3B0aW9uc1xuXHQpIHtcblx0XHRjb25zdCByb2xlID0gdGhpcy5fb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIgJiYgdGhpcy5fb3B0aW9ucy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0V2lkZ2V0Um9sZSA/IHRoaXMuX29wdGlvbnMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyPy5nZXRXaWRnZXRSb2xlKCkgOiAnbGlzdCc7XG5cdFx0dGhpcy5zZWxlY3Rpb24gPSBuZXcgU2VsZWN0aW9uVHJhaXQocm9sZSAhPT0gJ2xpc3Rib3gnKTtcblxuXHRcdGNvbnN0IGJhc2VSZW5kZXJlcnM6IElMaXN0UmVuZGVyZXI8VCwgdW5rbm93bj5bXSA9IFt0aGlzLmZvY3VzLnJlbmRlcmVyLCB0aGlzLnNlbGVjdGlvbi5yZW5kZXJlcl07XG5cblx0XHR0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlciA9IF9vcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlcjtcblxuXHRcdGlmICh0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlcikge1xuXHRcdFx0YmFzZVJlbmRlcmVycy5wdXNoKG5ldyBBY2Nlc3NpYmlsdHlSZW5kZXJlcjxUPih0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlcikpO1xuXG5cdFx0XHR0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlci5vbkRpZENoYW5nZUFjdGl2ZURlc2NlbmRhbnQ/Lih0aGlzLm9uRGlkQ2hhbmdlQWN0aXZlRGVzY2VuZGFudCwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0fVxuXG5cdFx0cmVuZGVyZXJzID0gcmVuZGVyZXJzLm1hcChyID0+IG5ldyBQaXBlbGluZVJlbmRlcmVyKHIudGVtcGxhdGVJZCwgWy4uLmJhc2VSZW5kZXJlcnMsIHJdKSk7XG5cblx0XHRjb25zdCB2aWV3T3B0aW9uczogSUxpc3RWaWV3T3B0aW9uczxUPiA9IHtcblx0XHRcdC4uLl9vcHRpb25zLFxuXHRcdFx0ZG5kOiBfb3B0aW9ucy5kbmQgJiYgbmV3IExpc3RWaWV3RHJhZ0FuZERyb3AodGhpcywgX29wdGlvbnMuZG5kKVxuXHRcdH07XG5cblx0XHR0aGlzLnZpZXcgPSB0aGlzLmNyZWF0ZUxpc3RWaWV3KGNvbnRhaW5lciwgdmlydHVhbERlbGVnYXRlLCByZW5kZXJlcnMsIHZpZXdPcHRpb25zKTtcblx0XHR0aGlzLnZpZXcuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCByb2xlKTtcblxuXHRcdGlmIChfb3B0aW9ucy5zdHlsZUNvbnRyb2xsZXIpIHtcblx0XHRcdHRoaXMuc3R5bGVDb250cm9sbGVyID0gX29wdGlvbnMuc3R5bGVDb250cm9sbGVyKHRoaXMudmlldy5kb21JZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHN0eWxlRWxlbWVudCA9IGNyZWF0ZVN0eWxlU2hlZXQodGhpcy52aWV3LmRvbU5vZGUpO1xuXHRcdFx0dGhpcy5zdHlsZUNvbnRyb2xsZXIgPSBuZXcgRGVmYXVsdFN0eWxlQ29udHJvbGxlcihzdHlsZUVsZW1lbnQsIHRoaXMudmlldy5kb21JZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zcGxpY2VhYmxlID0gbmV3IENvbWJpbmVkU3BsaWNlYWJsZShbXG5cdFx0XHRuZXcgVHJhaXRTcGxpY2VhYmxlKHRoaXMuZm9jdXMsIHRoaXMudmlldywgX29wdGlvbnMuaWRlbnRpdHlQcm92aWRlciksXG5cdFx0XHRuZXcgVHJhaXRTcGxpY2VhYmxlKHRoaXMuc2VsZWN0aW9uLCB0aGlzLnZpZXcsIF9vcHRpb25zLmlkZW50aXR5UHJvdmlkZXIpLFxuXHRcdFx0bmV3IFRyYWl0U3BsaWNlYWJsZSh0aGlzLmFuY2hvciwgdGhpcy52aWV3LCBfb3B0aW9ucy5pZGVudGl0eVByb3ZpZGVyKSxcblx0XHRcdHRoaXMudmlld1xuXHRcdF0pO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5mb2N1cyk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5zZWxlY3Rpb24pO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuYW5jaG9yKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLnZpZXcpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuX29uRGlkRGlzcG9zZSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRE9NRm9jdXNDb250cm9sbGVyKHRoaXMsIHRoaXMudmlldykpO1xuXG5cdFx0aWYgKHR5cGVvZiBfb3B0aW9ucy5rZXlib2FyZFN1cHBvcnQgIT09ICdib29sZWFuJyB8fCBfb3B0aW9ucy5rZXlib2FyZFN1cHBvcnQpIHtcblx0XHRcdHRoaXMua2V5Ym9hcmRDb250cm9sbGVyID0gbmV3IEtleWJvYXJkQ29udHJvbGxlcih0aGlzLCB0aGlzLnZpZXcsIF9vcHRpb25zKTtcblx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMua2V5Ym9hcmRDb250cm9sbGVyKTtcblx0XHR9XG5cblx0XHRpZiAoX29wdGlvbnMua2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcikge1xuXHRcdFx0Y29uc3QgZGVsZWdhdGUgPSBfb3B0aW9ucy5rZXlib2FyZE5hdmlnYXRpb25EZWxlZ2F0ZSB8fCBEZWZhdWx0S2V5Ym9hcmROYXZpZ2F0aW9uRGVsZWdhdGU7XG5cdFx0XHR0aGlzLnR5cGVOYXZpZ2F0aW9uQ29udHJvbGxlciA9IG5ldyBUeXBlTmF2aWdhdGlvbkNvbnRyb2xsZXIodGhpcywgdGhpcy52aWV3LCBfb3B0aW9ucy5rZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyLCBfb3B0aW9ucy5rZXlib2FyZE5hdmlnYXRpb25FdmVudEZpbHRlciA/PyAoKCkgPT4gdHJ1ZSksIGRlbGVnYXRlKTtcblx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMudHlwZU5hdmlnYXRpb25Db250cm9sbGVyKTtcblx0XHR9XG5cblx0XHR0aGlzLm1vdXNlQ29udHJvbGxlciA9IHRoaXMuY3JlYXRlTW91c2VDb250cm9sbGVyKF9vcHRpb25zKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLm1vdXNlQ29udHJvbGxlcik7XG5cblx0XHR0aGlzLm9uRGlkQ2hhbmdlRm9jdXModGhpcy5fb25Gb2N1c0NoYW5nZSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy5vbkRpZENoYW5nZVNlbGVjdGlvbih0aGlzLl9vblNlbGVjdGlvbkNoYW5nZSwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cblx0XHRpZiAodGhpcy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIpIHtcblx0XHRcdHRoaXMuYXJpYUxhYmVsID0gdGhpcy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0V2lkZ2V0QXJpYUxhYmVsKCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX29wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0ICE9PSBmYWxzZSkge1xuXHRcdFx0dGhpcy52aWV3LmRvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLW11bHRpc2VsZWN0YWJsZScsICd0cnVlJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUxpc3RWaWV3KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHZpcnR1YWxEZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VD4sIHJlbmRlcmVyczogSUxpc3RSZW5kZXJlcjxhbnksIGFueT5bXSwgdmlld09wdGlvbnM6IElMaXN0Vmlld09wdGlvbnM8VD4pOiBJTGlzdFZpZXc8VD4ge1xuXHRcdHJldHVybiBuZXcgTGlzdFZpZXcoY29udGFpbmVyLCB2aXJ0dWFsRGVsZWdhdGUsIHJlbmRlcmVycywgdmlld09wdGlvbnMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZU1vdXNlQ29udHJvbGxlcihvcHRpb25zOiBJTGlzdE9wdGlvbnM8VD4pOiBNb3VzZUNvbnRyb2xsZXI8VD4ge1xuXHRcdHJldHVybiBuZXcgTW91c2VDb250cm9sbGVyKHRoaXMpO1xuXHR9XG5cblx0dXBkYXRlT3B0aW9ucyhvcHRpb25zVXBkYXRlOiBJTGlzdE9wdGlvbnNVcGRhdGUgPSB7fSk6IHZvaWQge1xuXHRcdHRoaXMuX29wdGlvbnMgPSB7IC4uLnRoaXMuX29wdGlvbnMsIC4uLm9wdGlvbnNVcGRhdGUgfTtcblxuXHRcdHRoaXMudHlwZU5hdmlnYXRpb25Db250cm9sbGVyPy51cGRhdGVPcHRpb25zKHRoaXMuX29wdGlvbnMpO1xuXG5cdFx0aWYgKHRoaXMuX29wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmICh0aGlzLl9vcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCkge1xuXHRcdFx0XHR0aGlzLnZpZXcuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbXVsdGlzZWxlY3RhYmxlJywgJ3RydWUnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudmlldy5kb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1tdWx0aXNlbGVjdGFibGUnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLm1vdXNlQ29udHJvbGxlci51cGRhdGVPcHRpb25zKG9wdGlvbnNVcGRhdGUpO1xuXHRcdHRoaXMua2V5Ym9hcmRDb250cm9sbGVyPy51cGRhdGVPcHRpb25zKG9wdGlvbnNVcGRhdGUpO1xuXHRcdHRoaXMudmlldy51cGRhdGVPcHRpb25zKG9wdGlvbnNVcGRhdGUpO1xuXHR9XG5cblx0Z2V0IG9wdGlvbnMoKTogSUxpc3RPcHRpb25zPFQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb3B0aW9ucztcblx0fVxuXG5cdHNwbGljZShzdGFydDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCBlbGVtZW50czogcmVhZG9ubHkgVFtdID0gW10pOiB2b2lkIHtcblx0XHRpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID4gdGhpcy52aWV3Lmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IExpc3RFcnJvcih0aGlzLnVzZXIsIGBJbnZhbGlkIHN0YXJ0IGluZGV4OiAke3N0YXJ0fWApO1xuXHRcdH1cblxuXHRcdGlmIChkZWxldGVDb3VudCA8IDApIHtcblx0XHRcdHRocm93IG5ldyBMaXN0RXJyb3IodGhpcy51c2VyLCBgSW52YWxpZCBkZWxldGUgY291bnQ6ICR7ZGVsZXRlQ291bnR9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKGRlbGV0ZUNvdW50ID09PSAwICYmIGVsZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZXZlbnRCdWZmZXJlci5idWZmZXJFdmVudHMoKCkgPT4gdGhpcy5zcGxpY2VhYmxlLnNwbGljZShzdGFydCwgZGVsZXRlQ291bnQsIGVsZW1lbnRzKSk7XG5cdH1cblxuXHR1cGRhdGVXaWR0aChpbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3LnVwZGF0ZVdpZHRoKGluZGV4KTtcblx0fVxuXG5cdHVwZGF0ZUVsZW1lbnRIZWlnaHQoaW5kZXg6IG51bWJlciwgc2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3LnVwZGF0ZUVsZW1lbnRIZWlnaHQoaW5kZXgsIHNpemUsIG51bGwpO1xuXHR9XG5cblx0cmVyZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3LnJlcmVuZGVyKCk7XG5cdH1cblxuXHRlbGVtZW50KGluZGV4OiBudW1iZXIpOiBUIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmVsZW1lbnQoaW5kZXgpO1xuXHR9XG5cblx0aW5kZXhPZihlbGVtZW50OiBUKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmluZGV4T2YoZWxlbWVudCk7XG5cdH1cblxuXHRpbmRleEF0KHBvc2l0aW9uOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuaW5kZXhBdChwb3NpdGlvbik7XG5cdH1cblxuXHRnZXQgbGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudmlldy5sZW5ndGg7XG5cdH1cblxuXHRnZXQgY29udGVudEhlaWdodCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuY29udGVudEhlaWdodDtcblx0fVxuXG5cdGdldCBjb250ZW50V2lkdGgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmNvbnRlbnRXaWR0aDtcblx0fVxuXG5cdGdldCBvbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKTogRXZlbnQ8bnVtYmVyPiB7XG5cdFx0cmV0dXJuIHRoaXMudmlldy5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQ7XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2VDb250ZW50V2lkdGgoKTogRXZlbnQ8bnVtYmVyPiB7XG5cdFx0cmV0dXJuIHRoaXMudmlldy5vbkRpZENoYW5nZUNvbnRlbnRXaWR0aDtcblx0fVxuXG5cdGdldCBzY3JvbGxUb3AoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmdldFNjcm9sbFRvcCgpO1xuXHR9XG5cblx0c2V0IHNjcm9sbFRvcChzY3JvbGxUb3A6IG51bWJlcikge1xuXHRcdHRoaXMudmlldy5zZXRTY3JvbGxUb3Aoc2Nyb2xsVG9wKTtcblx0fVxuXG5cdGdldCBzY3JvbGxMZWZ0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudmlldy5nZXRTY3JvbGxMZWZ0KCk7XG5cdH1cblxuXHRzZXQgc2Nyb2xsTGVmdChzY3JvbGxMZWZ0OiBudW1iZXIpIHtcblx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsTGVmdChzY3JvbGxMZWZ0KTtcblx0fVxuXG5cdGdldCBzY3JvbGxIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LnNjcm9sbEhlaWdodDtcblx0fVxuXG5cdGdldCByZW5kZXJIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LnJlbmRlckhlaWdodDtcblx0fVxuXG5cdGdldCBmaXJzdFZpc2libGVJbmRleCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuZmlyc3RWaXNpYmxlSW5kZXg7XG5cdH1cblxuXHRnZXQgZmlyc3RNb3N0bHlWaXNpYmxlSW5kZXgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmZpcnN0TW9zdGx5VmlzaWJsZUluZGV4O1xuXHR9XG5cblx0Z2V0IGxhc3RWaXNpYmxlSW5kZXgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3Lmxhc3RWaXNpYmxlSW5kZXg7XG5cdH1cblxuXHRnZXQgYXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2FyaWFMYWJlbDtcblx0fVxuXG5cdHNldCBhcmlhTGFiZWwodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMuX2FyaWFMYWJlbCA9IHZhbHVlO1xuXHRcdHRoaXMudmlldy5kb21Ob2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHZhbHVlKTtcblx0fVxuXG5cdGRvbUZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMudmlldy5kb21Ob2RlLmZvY3VzKHsgcHJldmVudFNjcm9sbDogdHJ1ZSB9KTtcblx0fVxuXG5cdGxheW91dChoZWlnaHQ/OiBudW1iZXIsIHdpZHRoPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3LmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0fVxuXG5cdHRyaWdnZXJUeXBlTmF2aWdhdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLnR5cGVOYXZpZ2F0aW9uQ29udHJvbGxlcj8udHJpZ2dlcigpO1xuXHR9XG5cblx0c2V0U2VsZWN0aW9uKGluZGV4ZXM6IG51bWJlcltdLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBpbmRleCBvZiBpbmRleGVzKSB7XG5cdFx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMubGVuZ3RoKSB7XG5cdFx0XHRcdHRocm93IG5ldyBMaXN0RXJyb3IodGhpcy51c2VyLCBgSW52YWxpZCBpbmRleCAke2luZGV4fWApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuc2VsZWN0aW9uLnNldChpbmRleGVzLCBicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0Z2V0U2VsZWN0aW9uKCk6IG51bWJlcltdIHtcblx0XHRyZXR1cm4gdGhpcy5zZWxlY3Rpb24uZ2V0KCk7XG5cdH1cblxuXHRnZXRTZWxlY3RlZEVsZW1lbnRzKCk6IFRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U2VsZWN0aW9uKCkubWFwKGkgPT4gdGhpcy52aWV3LmVsZW1lbnQoaSkpO1xuXHR9XG5cblx0c2V0QW5jaG9yKGluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIGluZGV4ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0dGhpcy5hbmNob3Iuc2V0KFtdKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgTGlzdEVycm9yKHRoaXMudXNlciwgYEludmFsaWQgaW5kZXggJHtpbmRleH1gKTtcblx0XHR9XG5cblx0XHR0aGlzLmFuY2hvci5zZXQoW2luZGV4XSk7XG5cdH1cblxuXHRnZXRBbmNob3IoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5hbmNob3IuZ2V0KCkuYXQoMCk7XG5cdH1cblxuXHRnZXRBbmNob3JFbGVtZW50KCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGFuY2hvciA9IHRoaXMuZ2V0QW5jaG9yKCk7XG5cdFx0cmV0dXJuIHR5cGVvZiBhbmNob3IgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogdGhpcy5lbGVtZW50KGFuY2hvcik7XG5cdH1cblxuXHRzZXRGb2N1cyhpbmRleGVzOiBudW1iZXJbXSwgYnJvd3NlckV2ZW50PzogVUlFdmVudCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgaW5kZXggb2YgaW5kZXhlcykge1xuXHRcdFx0aWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLmxlbmd0aCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgTGlzdEVycm9yKHRoaXMudXNlciwgYEludmFsaWQgaW5kZXggJHtpbmRleH1gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmZvY3VzLnNldChpbmRleGVzLCBicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0Zm9jdXNOZXh0KG4gPSAxLCBsb29wID0gZmFsc2UsIGJyb3dzZXJFdmVudD86IFVJRXZlbnQsIGZpbHRlcj86IChlbGVtZW50OiBUKSA9PiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubGVuZ3RoID09PSAwKSB7IHJldHVybjsgfVxuXG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmZvY3VzLmdldCgpO1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5maW5kTmV4dEluZGV4KGZvY3VzLmxlbmd0aCA+IDAgPyBmb2N1c1swXSArIG4gOiAwLCBsb29wLCBmaWx0ZXIpO1xuXG5cdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdHRoaXMuc2V0Rm9jdXMoW2luZGV4XSwgYnJvd3NlckV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRmb2N1c1ByZXZpb3VzKG4gPSAxLCBsb29wID0gZmFsc2UsIGJyb3dzZXJFdmVudD86IFVJRXZlbnQsIGZpbHRlcj86IChlbGVtZW50OiBUKSA9PiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubGVuZ3RoID09PSAwKSB7IHJldHVybjsgfVxuXG5cdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmZvY3VzLmdldCgpO1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5maW5kUHJldmlvdXNJbmRleChmb2N1cy5sZW5ndGggPiAwID8gZm9jdXNbMF0gLSBuIDogMCwgbG9vcCwgZmlsdGVyKTtcblxuXHRcdGlmIChpbmRleCA+IC0xKSB7XG5cdFx0XHR0aGlzLnNldEZvY3VzKFtpbmRleF0sIGJyb3dzZXJFdmVudCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZm9jdXNOZXh0UGFnZShicm93c2VyRXZlbnQ/OiBVSUV2ZW50LCBmaWx0ZXI/OiAoZWxlbWVudDogVCkgPT4gYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBsYXN0UGFnZUluZGV4ID0gdGhpcy52aWV3LmluZGV4QXQodGhpcy52aWV3LmdldFNjcm9sbFRvcCgpICsgdGhpcy52aWV3LnJlbmRlckhlaWdodCk7XG5cdFx0bGFzdFBhZ2VJbmRleCA9IGxhc3RQYWdlSW5kZXggPT09IDAgPyAwIDogbGFzdFBhZ2VJbmRleCAtIDE7XG5cdFx0Y29uc3QgY3VycmVudGx5Rm9jdXNlZEVsZW1lbnRJbmRleCA9IHRoaXMuZ2V0Rm9jdXMoKVswXTtcblxuXHRcdGlmIChjdXJyZW50bHlGb2N1c2VkRWxlbWVudEluZGV4ICE9PSBsYXN0UGFnZUluZGV4ICYmIChjdXJyZW50bHlGb2N1c2VkRWxlbWVudEluZGV4ID09PSB1bmRlZmluZWQgfHwgbGFzdFBhZ2VJbmRleCA+IGN1cnJlbnRseUZvY3VzZWRFbGVtZW50SW5kZXgpKSB7XG5cdFx0XHRjb25zdCBsYXN0R29vZFBhZ2VJbmRleCA9IHRoaXMuZmluZFByZXZpb3VzSW5kZXgobGFzdFBhZ2VJbmRleCwgZmFsc2UsIGZpbHRlcik7XG5cblx0XHRcdGlmIChsYXN0R29vZFBhZ2VJbmRleCA+IC0xICYmIGN1cnJlbnRseUZvY3VzZWRFbGVtZW50SW5kZXggIT09IGxhc3RHb29kUGFnZUluZGV4KSB7XG5cdFx0XHRcdHRoaXMuc2V0Rm9jdXMoW2xhc3RHb29kUGFnZUluZGV4XSwgYnJvd3NlckV2ZW50KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc2V0Rm9jdXMoW2xhc3RQYWdlSW5kZXhdLCBicm93c2VyRXZlbnQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBwcmV2aW91c1Njcm9sbFRvcCA9IHRoaXMudmlldy5nZXRTY3JvbGxUb3AoKTtcblx0XHRcdGxldCBuZXh0cGFnZVNjcm9sbFRvcCA9IHByZXZpb3VzU2Nyb2xsVG9wICsgdGhpcy52aWV3LnJlbmRlckhlaWdodDtcblx0XHRcdGlmIChsYXN0UGFnZUluZGV4ID4gY3VycmVudGx5Rm9jdXNlZEVsZW1lbnRJbmRleCkge1xuXHRcdFx0XHQvLyBzY3JvbGwgbGFzdCBwYWdlIGVsZW1lbnQgdG8gdGhlIHRvcCBvbmx5IGlmIHRoZSBsYXN0IHBhZ2UgZWxlbWVudCBpcyBiZWxvdyB0aGUgZm9jdXNlZCBlbGVtZW50XG5cdFx0XHRcdG5leHRwYWdlU2Nyb2xsVG9wIC09IHRoaXMudmlldy5lbGVtZW50SGVpZ2h0KGxhc3RQYWdlSW5kZXgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnZpZXcuc2V0U2Nyb2xsVG9wKG5leHRwYWdlU2Nyb2xsVG9wKTtcblxuXHRcdFx0aWYgKHRoaXMudmlldy5nZXRTY3JvbGxUb3AoKSAhPT0gcHJldmlvdXNTY3JvbGxUb3ApIHtcblx0XHRcdFx0dGhpcy5zZXRGb2N1cyhbXSk7XG5cblx0XHRcdFx0Ly8gTGV0IHRoZSBzY3JvbGwgZXZlbnQgbGlzdGVuZXIgcnVuXG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZm9jdXNOZXh0UGFnZShicm93c2VyRXZlbnQsIGZpbHRlcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZm9jdXNQcmV2aW91c1BhZ2UoYnJvd3NlckV2ZW50PzogVUlFdmVudCwgZmlsdGVyPzogKGVsZW1lbnQ6IFQpID0+IGJvb2xlYW4sIGdldFBhZGRpbmdUb3A6ICgpID0+IG51bWJlciA9ICgpID0+IDApOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgZmlyc3RQYWdlSW5kZXg6IG51bWJlcjtcblx0XHRjb25zdCBwYWRkaW5nVG9wID0gZ2V0UGFkZGluZ1RvcCgpO1xuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMudmlldy5nZXRTY3JvbGxUb3AoKSArIHBhZGRpbmdUb3A7XG5cblx0XHRpZiAoc2Nyb2xsVG9wID09PSAwKSB7XG5cdFx0XHRmaXJzdFBhZ2VJbmRleCA9IHRoaXMudmlldy5pbmRleEF0KHNjcm9sbFRvcCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZpcnN0UGFnZUluZGV4ID0gdGhpcy52aWV3LmluZGV4QWZ0ZXIoc2Nyb2xsVG9wIC0gMSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudGx5Rm9jdXNlZEVsZW1lbnRJbmRleCA9IHRoaXMuZ2V0Rm9jdXMoKVswXTtcblxuXHRcdGlmIChjdXJyZW50bHlGb2N1c2VkRWxlbWVudEluZGV4ICE9PSBmaXJzdFBhZ2VJbmRleCAmJiAoY3VycmVudGx5Rm9jdXNlZEVsZW1lbnRJbmRleCA9PT0gdW5kZWZpbmVkIHx8IGN1cnJlbnRseUZvY3VzZWRFbGVtZW50SW5kZXggPj0gZmlyc3RQYWdlSW5kZXgpKSB7XG5cdFx0XHRjb25zdCBmaXJzdEdvb2RQYWdlSW5kZXggPSB0aGlzLmZpbmROZXh0SW5kZXgoZmlyc3RQYWdlSW5kZXgsIGZhbHNlLCBmaWx0ZXIpO1xuXG5cdFx0XHRpZiAoZmlyc3RHb29kUGFnZUluZGV4ID4gLTEgJiYgY3VycmVudGx5Rm9jdXNlZEVsZW1lbnRJbmRleCAhPT0gZmlyc3RHb29kUGFnZUluZGV4KSB7XG5cdFx0XHRcdHRoaXMuc2V0Rm9jdXMoW2ZpcnN0R29vZFBhZ2VJbmRleF0sIGJyb3dzZXJFdmVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnNldEZvY3VzKFtmaXJzdFBhZ2VJbmRleF0sIGJyb3dzZXJFdmVudCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHByZXZpb3VzU2Nyb2xsVG9wID0gc2Nyb2xsVG9wO1xuXHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChzY3JvbGxUb3AgLSB0aGlzLnZpZXcucmVuZGVySGVpZ2h0IC0gcGFkZGluZ1RvcCk7XG5cblx0XHRcdGlmICh0aGlzLnZpZXcuZ2V0U2Nyb2xsVG9wKCkgKyBnZXRQYWRkaW5nVG9wKCkgIT09IHByZXZpb3VzU2Nyb2xsVG9wKSB7XG5cdFx0XHRcdHRoaXMuc2V0Rm9jdXMoW10pO1xuXG5cdFx0XHRcdC8vIExldCB0aGUgc2Nyb2xsIGV2ZW50IGxpc3RlbmVyIHJ1blxuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0XHRhd2FpdCB0aGlzLmZvY3VzUHJldmlvdXNQYWdlKGJyb3dzZXJFdmVudCwgZmlsdGVyLCBnZXRQYWRkaW5nVG9wKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmb2N1c0xhc3QoYnJvd3NlckV2ZW50PzogVUlFdmVudCwgZmlsdGVyPzogKGVsZW1lbnQ6IFQpID0+IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5sZW5ndGggPT09IDApIHsgcmV0dXJuOyB9XG5cblx0XHRjb25zdCBpbmRleCA9IHRoaXMuZmluZFByZXZpb3VzSW5kZXgodGhpcy5sZW5ndGggLSAxLCBmYWxzZSwgZmlsdGVyKTtcblxuXHRcdGlmIChpbmRleCA+IC0xKSB7XG5cdFx0XHR0aGlzLnNldEZvY3VzKFtpbmRleF0sIGJyb3dzZXJFdmVudCk7XG5cdFx0fVxuXHR9XG5cblx0Zm9jdXNGaXJzdChicm93c2VyRXZlbnQ/OiBVSUV2ZW50LCBmaWx0ZXI/OiAoZWxlbWVudDogVCkgPT4gYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuZm9jdXNOdGgoMCwgYnJvd3NlckV2ZW50LCBmaWx0ZXIpO1xuXHR9XG5cblx0Zm9jdXNOdGgobjogbnVtYmVyLCBicm93c2VyRXZlbnQ/OiBVSUV2ZW50LCBmaWx0ZXI/OiAoZWxlbWVudDogVCkgPT4gYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgeyByZXR1cm47IH1cblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5maW5kTmV4dEluZGV4KG4sIGZhbHNlLCBmaWx0ZXIpO1xuXG5cdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdHRoaXMuc2V0Rm9jdXMoW2luZGV4XSwgYnJvd3NlckV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGZpbmROZXh0SW5kZXgoaW5kZXg6IG51bWJlciwgbG9vcCA9IGZhbHNlLCBmaWx0ZXI/OiAoZWxlbWVudDogVCkgPT4gYm9vbGVhbik6IG51bWJlciB7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAoaW5kZXggPj0gdGhpcy5sZW5ndGggJiYgIWxvb3ApIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXG5cdFx0XHRpbmRleCA9IGluZGV4ICUgdGhpcy5sZW5ndGg7XG5cblx0XHRcdGlmICghZmlsdGVyIHx8IGZpbHRlcih0aGlzLmVsZW1lbnQoaW5kZXgpKSkge1xuXHRcdFx0XHRyZXR1cm4gaW5kZXg7XG5cdFx0XHR9XG5cblx0XHRcdGluZGV4Kys7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kUHJldmlvdXNJbmRleChpbmRleDogbnVtYmVyLCBsb29wID0gZmFsc2UsIGZpbHRlcj86IChlbGVtZW50OiBUKSA9PiBib29sZWFuKTogbnVtYmVyIHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChpbmRleCA8IDAgJiYgIWxvb3ApIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXG5cdFx0XHRpbmRleCA9ICh0aGlzLmxlbmd0aCArIChpbmRleCAlIHRoaXMubGVuZ3RoKSkgJSB0aGlzLmxlbmd0aDtcblxuXHRcdFx0aWYgKCFmaWx0ZXIgfHwgZmlsdGVyKHRoaXMuZWxlbWVudChpbmRleCkpKSB7XG5cdFx0XHRcdHJldHVybiBpbmRleDtcblx0XHRcdH1cblxuXHRcdFx0aW5kZXgtLTtcblx0XHR9XG5cblx0XHRyZXR1cm4gLTE7XG5cdH1cblxuXHRnZXRGb2N1cygpOiBudW1iZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZm9jdXMuZ2V0KCk7XG5cdH1cblxuXHRnZXRGb2N1c2VkRWxlbWVudHMoKTogVFtdIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRGb2N1cygpLm1hcChpID0+IHRoaXMudmlldy5lbGVtZW50KGkpKTtcblx0fVxuXG5cdHJldmVhbChpbmRleDogbnVtYmVyLCByZWxhdGl2ZVRvcD86IG51bWJlciwgcGFkZGluZ1RvcDogbnVtYmVyID0gMCk6IHZvaWQge1xuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBMaXN0RXJyb3IodGhpcy51c2VyLCBgSW52YWxpZCBpbmRleCAke2luZGV4fWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMudmlldy5nZXRTY3JvbGxUb3AoKTtcblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3AoaW5kZXgpO1xuXHRcdGNvbnN0IGVsZW1lbnRIZWlnaHQgPSB0aGlzLnZpZXcuZWxlbWVudEhlaWdodChpbmRleCk7XG5cblx0XHRpZiAoaXNOdW1iZXIocmVsYXRpdmVUb3ApKSB7XG5cdFx0XHQvLyB5ID0gbXggKyBiXG5cdFx0XHRjb25zdCBtID0gZWxlbWVudEhlaWdodCAtIHRoaXMudmlldy5yZW5kZXJIZWlnaHQgKyBwYWRkaW5nVG9wO1xuXHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcChtICogY2xhbXAocmVsYXRpdmVUb3AsIDAsIDEpICsgZWxlbWVudFRvcCAtIHBhZGRpbmdUb3ApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB2aWV3SXRlbUJvdHRvbSA9IGVsZW1lbnRUb3AgKyBlbGVtZW50SGVpZ2h0O1xuXHRcdFx0Y29uc3Qgc2Nyb2xsQm90dG9tID0gc2Nyb2xsVG9wICsgdGhpcy52aWV3LnJlbmRlckhlaWdodDtcblxuXHRcdFx0aWYgKGVsZW1lbnRUb3AgPCBzY3JvbGxUb3AgKyBwYWRkaW5nVG9wICYmIHZpZXdJdGVtQm90dG9tID49IHNjcm9sbEJvdHRvbSkge1xuXHRcdFx0XHQvLyBUaGUgZWxlbWVudCBpcyBhbHJlYWR5IG92ZXJmbG93aW5nIHRoZSB2aWV3cG9ydCwgbm8tb3Bcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudFRvcCA8IHNjcm9sbFRvcCArIHBhZGRpbmdUb3AgfHwgKHZpZXdJdGVtQm90dG9tID49IHNjcm9sbEJvdHRvbSAmJiBlbGVtZW50SGVpZ2h0ID49IHRoaXMudmlldy5yZW5kZXJIZWlnaHQpKSB7XG5cdFx0XHRcdHRoaXMudmlldy5zZXRTY3JvbGxUb3AoZWxlbWVudFRvcCAtIHBhZGRpbmdUb3ApO1xuXHRcdFx0fSBlbHNlIGlmICh2aWV3SXRlbUJvdHRvbSA+PSBzY3JvbGxCb3R0b20pIHtcblx0XHRcdFx0dGhpcy52aWV3LnNldFNjcm9sbFRvcCh2aWV3SXRlbUJvdHRvbSAtIHRoaXMudmlldy5yZW5kZXJIZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSByZWxhdGl2ZSBwb3NpdGlvbiBvZiBhbiBlbGVtZW50IHJlbmRlcmVkIGluIHRoZSBsaXN0LlxuXHQgKiBSZXR1cm5zIGBudWxsYCBpZiB0aGUgZWxlbWVudCBpc24ndCAqZW50aXJlbHkqIGluIHRoZSB2aXNpYmxlIHZpZXdwb3J0LlxuXHQgKi9cblx0Z2V0UmVsYXRpdmVUb3AoaW5kZXg6IG51bWJlciwgcGFkZGluZ1RvcDogbnVtYmVyID0gMCk6IG51bWJlciB8IG51bGwge1xuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5sZW5ndGgpIHtcblx0XHRcdHRocm93IG5ldyBMaXN0RXJyb3IodGhpcy51c2VyLCBgSW52YWxpZCBpbmRleCAke2luZGV4fWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMudmlldy5nZXRTY3JvbGxUb3AoKTtcblx0XHRjb25zdCBlbGVtZW50VG9wID0gdGhpcy52aWV3LmVsZW1lbnRUb3AoaW5kZXgpO1xuXHRcdGNvbnN0IGVsZW1lbnRIZWlnaHQgPSB0aGlzLnZpZXcuZWxlbWVudEhlaWdodChpbmRleCk7XG5cblx0XHRpZiAoZWxlbWVudFRvcCA8IHNjcm9sbFRvcCArIHBhZGRpbmdUb3AgfHwgZWxlbWVudFRvcCArIGVsZW1lbnRIZWlnaHQgPiBzY3JvbGxUb3AgKyB0aGlzLnZpZXcucmVuZGVySGVpZ2h0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyB5ID0gbXggKyBiXG5cdFx0Y29uc3QgbSA9IGVsZW1lbnRIZWlnaHQgLSB0aGlzLnZpZXcucmVuZGVySGVpZ2h0ICsgcGFkZGluZ1RvcDtcblx0XHRyZXR1cm4gTWF0aC5hYnMoKHNjcm9sbFRvcCArIHBhZGRpbmdUb3AgLSBlbGVtZW50VG9wKSAvIG0pO1xuXHR9XG5cblx0aXNET01Gb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBpc0FjdGl2ZUVsZW1lbnQodGhpcy52aWV3LmRvbU5vZGUpO1xuXHR9XG5cblx0Z2V0SFRNTEVsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuZG9tTm9kZTtcblx0fVxuXG5cdGdldFNjcm9sbGFibGVFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LnNjcm9sbGFibGVFbGVtZW50RG9tTm9kZTtcblx0fVxuXG5cdGdldEVsZW1lbnRJRChpbmRleDogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3LmdldEVsZW1lbnREb21JZChpbmRleCk7XG5cdH1cblxuXHRnZXRFbGVtZW50VG9wKGluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZpZXcuZWxlbWVudFRvcChpbmRleCk7XG5cdH1cblxuXHRzdHlsZShzdHlsZXM6IElMaXN0U3R5bGVzKTogdm9pZCB7XG5cdFx0dGhpcy5zdHlsZUNvbnRyb2xsZXIuc3R5bGUoc3R5bGVzKTtcblx0fVxuXG5cdHByaXZhdGUgdG9MaXN0RXZlbnQoeyBpbmRleGVzLCBicm93c2VyRXZlbnQgfTogSVRyYWl0Q2hhbmdlRXZlbnQpIHtcblx0XHRyZXR1cm4geyBpbmRleGVzLCBlbGVtZW50czogaW5kZXhlcy5tYXAoaSA9PiB0aGlzLnZpZXcuZWxlbWVudChpKSksIGJyb3dzZXJFdmVudCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfb25Gb2N1c0NoYW5nZSgpOiB2b2lkIHtcblx0XHRjb25zdCBmb2N1cyA9IHRoaXMuZm9jdXMuZ2V0KCk7XG5cdFx0dGhpcy52aWV3LmRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnZWxlbWVudC1mb2N1c2VkJywgZm9jdXMubGVuZ3RoID4gMCk7XG5cdFx0dGhpcy5vbkRpZENoYW5nZUFjdGl2ZURlc2NlbmRhbnQoKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VBY3RpdmVEZXNjZW5kYW50KCk6IHZvaWQge1xuXHRcdGNvbnN0IGZvY3VzID0gdGhpcy5mb2N1cy5nZXQoKTtcblxuXHRcdGlmIChmb2N1cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRsZXQgaWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRcdFx0aWYgKHRoaXMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyPy5nZXRBY3RpdmVEZXNjZW5kYW50SWQpIHtcblx0XHRcdFx0aWQgPSB0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRBY3RpdmVEZXNjZW5kYW50SWQodGhpcy52aWV3LmVsZW1lbnQoZm9jdXNbMF0pKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy52aWV3LmRvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWFjdGl2ZWRlc2NlbmRhbnQnLCBpZCB8fCB0aGlzLnZpZXcuZ2V0RWxlbWVudERvbUlkKGZvY3VzWzBdKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudmlldy5kb21Ob2RlLnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1hY3RpdmVkZXNjZW5kYW50Jyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25TZWxlY3Rpb25DaGFuZ2UoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb24uZ2V0KCk7XG5cblx0XHR0aGlzLnZpZXcuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdzZWxlY3Rpb24tbm9uZScsIHNlbGVjdGlvbi5sZW5ndGggPT09IDApO1xuXHRcdHRoaXMudmlldy5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ3NlbGVjdGlvbi1zaW5nbGUnLCBzZWxlY3Rpb24ubGVuZ3RoID09PSAxKTtcblx0XHR0aGlzLnZpZXcuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdzZWxlY3Rpb24tbXVsdGlwbGUnLCBzZWxlY3Rpb24ubGVuZ3RoID4gMSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkRGlzcG9zZS5maXJlKCk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLl9vbkRpZERpc3Bvc2UuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBTUEsU0FBb0IsYUFBYSxrQkFBa0IsV0FBVyxpQkFBaUIsbUJBQW1CLGVBQWUsb0JBQW9CO0FBQ3JJLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQXlCLDZCQUE2QjtBQUN0RCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxhQUF1QjtBQUNoQyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLGNBQWMsYUFBYTtBQUNwQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFNBQVMsT0FBTyxxQkFBcUI7QUFDOUMsU0FBUyxlQUFlLHFCQUFxQjtBQUM3QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsZUFBNEI7QUFDdEQsU0FBUyxhQUFhO0FBQ3RCLFlBQVksY0FBYztBQUcxQixTQUFTLGdCQUFnQjtBQUN6QixPQUFPO0FBQ1AsU0FBaVEsaUJBQWlCO0FBQ2xSLFNBQTBJLGdCQUFnQjtBQUMxSixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLFNBQVMsdUJBQW9DO0FBbUJ0RCxNQUFNLGNBQWlFO0FBQUEsRUFHdEUsWUFBb0IsT0FBaUI7QUFBakI7QUFGcEIsU0FBUSxtQkFBeUMsQ0FBQztBQUFBLEVBRVg7QUFBQSxFQUV2QyxJQUFJLGFBQXFCO0FBQ3hCLFdBQU8sWUFBWSxLQUFLLE1BQU0sSUFBSTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxlQUFlLFdBQTRDO0FBQzFELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxjQUFjLFNBQVksT0FBZSxjQUF3QztBQUNoRixVQUFNLHVCQUF1QixLQUFLLGlCQUFpQixVQUFVLFFBQU0sR0FBRyxpQkFBaUIsWUFBWTtBQUVuRyxRQUFJLHdC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QyxDQUFDO0FBQUEsSUFDbEcsT0FBTztBQUNOLFdBQUssS0FBSyxRQUFRLGdCQUFnQix1QkFBdUI7QUFBQSxJQUMxRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHFCQUEyQjtBQUNsQyxVQUFNLFlBQVksS0FBSyxVQUFVLElBQUk7QUFFckMsU0FBSyxLQUFLLFFBQVEsVUFBVSxPQUFPLGtCQUFrQixVQUFVLFdBQVcsQ0FBQztBQUMzRSxTQUFLLEtBQUssUUFBUSxVQUFVLE9BQU8sb0JBQW9CLFVBQVUsV0FBVyxDQUFDO0FBQzdFLFNBQUssS0FBSyxRQUFRLFVBQVUsT0FBTyxzQkFBc0IsVUFBVSxTQUFTLENBQUM7QUFBQSxFQUM5RTtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLGNBQWMsS0FBSztBQUN4QixTQUFLLFlBQVksUUFBUTtBQUV6QixTQUFLLGNBQWMsUUFBUTtBQUFBLEVBQzVCO0FBQ0Q7QUF2bUJjO0FBQUEsRUFBWjtBQUFBLEdBakJXLEtBaUJDO0FBSUE7QUFBQSxFQUFaO0FBQUEsR0FyQlcsS0FxQkM7QUF5QkE7QUFBQSxFQUFaO0FBQUEsR0E5Q1csS0E4Q0M7QUE4QkE7QUFBQSxFQUFaO0FBQUEsR0E1RVcsS0E0RUM7QUFDQTtBQUFBLEVBQVo7QUFBQSxHQTdFVyxLQTZFQztBQUNBO0FBQUEsRUFBWjtBQUFBLEdBOUVXLEtBOEVDO0FBRUE7QUFBQSxFQUFaO0FBQUEsR0FoRlcsS0FnRkM7QUFDQTtBQUFBLEVBQVo7QUFBQSxHQWpGVyxLQWlGQzsiLAogICJuYW1lcyI6IFsiVHlwZU5hdmlnYXRpb25Nb2RlIiwgIlR5cGVOYXZpZ2F0aW9uQ29udHJvbGxlclN0YXRlIiwgInJhbmdlIl0KfQo=
