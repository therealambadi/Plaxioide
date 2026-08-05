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
import * as dom from "../../../base/browser/dom.js";
import * as cssJs from "../../../base/browser/cssValue.js";
import { Emitter, Event, EventBufferer } from "../../../base/common/event.js";
import { TreeVisibility } from "../../../base/browser/ui/tree/tree.js";
import { localize } from "../../../nls.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { WorkbenchObjectTree } from "../../list/browser/listService.js";
import { IThemeService } from "../../theme/common/themeService.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { QuickPickFocus } from "../common/quickInput.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { OS } from "../../../base/common/platform.js";
import { memoize } from "../../../base/common/decorators.js";
import { IconLabel } from "../../../base/browser/ui/iconLabel/iconLabel.js";
import { KeybindingLabel } from "../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { ActionBar } from "../../../base/browser/ui/actionbar/actionbar.js";
import { isDark } from "../../theme/common/theme.js";
import { URI } from "../../../base/common/uri.js";
import { quickInputButtonToAction } from "./quickInputUtils.js";
import { Lazy } from "../../../base/common/lazy.js";
import { getCodiconAriaLabel, matchesFuzzyIconAware, parseLabelWithIcons } from "../../../base/common/iconLabels.js";
import { HoverPosition } from "../../../base/browser/ui/hover/hoverWidget.js";
import { compareAnything } from "../../../base/common/comparers.js";
import { escape, ltrim } from "../../../base/common/strings.js";
import { RenderIndentGuides } from "../../../base/browser/ui/tree/abstractTree.js";
import { ThrottledDelayer } from "../../../base/common/async.js";
import { isCancellationError } from "../../../base/common/errors.js";
import { IAccessibilityService } from "../../accessibility/common/accessibility.js";
import { observableValue, observableValueOpts, transaction } from "../../../base/common/observable.js";
import { equals } from "../../../base/common/arrays.js";
const $ = dom.$;
class BaseQuickPickItemElement {
  constructor(index, hasCheckbox, mainItem) {
    this.index = index;
    this.hasCheckbox = hasCheckbox;
    this._hidden = false;
    this._init = new Lazy(() => {
      const saneLabel = mainItem.label ?? "";
      const saneSortLabel = parseLabelWithIcons(saneLabel).text.trim();
      const saneAriaLabel = mainItem.ariaLabel || [saneLabel, this.saneDescription, this.saneDetail].map((s) => getCodiconAriaLabel(s)).filter((s) => !!s).join(", ");
      return {
        saneLabel,
        saneSortLabel,
        saneAriaLabel
      };
    });
    this._saneDescription = mainItem.description;
    this._saneTooltip = mainItem.tooltip;
  }
  // #region Lazy Getters
  get saneLabel() {
    return this._init.value.saneLabel;
  }
  get saneSortLabel() {
    return this._init.value.saneSortLabel;
  }
  get saneAriaLabel() {
    return this._init.value.saneAriaLabel;
  }
  get element() {
    return this._element;
  }
  set element(value) {
    this._element = value;
  }
  get hidden() {
    return this._hidden;
  }
  set hidden(value) {
    this._hidden = value;
  }
  get saneDescription() {
    return this._saneDescription;
  }
  set saneDescription(value) {
    this._saneDescription = value;
  }
  get saneDetail() {
    return this._saneDetail;
  }
  set saneDetail(value) {
    this._saneDetail = value;
  }
  get saneTooltip() {
    return this._saneTooltip;
  }
  set saneTooltip(value) {
    this._saneTooltip = value;
  }
  get labelHighlights() {
    return this._labelHighlights;
  }
  set labelHighlights(value) {
    this._labelHighlights = value;
  }
  get descriptionHighlights() {
    return this._descriptionHighlights;
  }
  set descriptionHighlights(value) {
    this._descriptionHighlights = value;
  }
  get detailHighlights() {
    return this._detailHighlights;
  }
  set detailHighlights(value) {
    this._detailHighlights = value;
  }
}
class QuickPickItemElement extends BaseQuickPickItemElement {
  constructor(index, hasCheckbox, fireButtonTriggered, _onChecked, item, _separator) {
    super(index, hasCheckbox, item);
    this.fireButtonTriggered = fireButtonTriggered;
    this._onChecked = _onChecked;
    this.item = item;
    this._separator = _separator;
    this._checked = false;
    this.onChecked = hasCheckbox ? Event.map(Event.filter(this._onChecked.event, (e) => e.element === this), (e) => e.checked) : Event.None;
    this._saneDetail = item.detail;
    this._labelHighlights = item.highlights?.label;
    this._descriptionHighlights = item.highlights?.description;
    this._detailHighlights = item.highlights?.detail;
  }
  get separator() {
    return this._separator;
  }
  set separator(value) {
    this._separator = value;
  }
  get checked() {
    return this._checked;
  }
  set checked(value) {
    if (value !== this._checked) {
      this._checked = value;
      this._onChecked.fire({ element: this, checked: value });
    }
  }
  get checkboxDisabled() {
    return !!this.item.disabled;
  }
}
var QuickPickSeparatorFocusReason = /* @__PURE__ */ ((QuickPickSeparatorFocusReason2) => {
  QuickPickSeparatorFocusReason2[QuickPickSeparatorFocusReason2["NONE"] = 0] = "NONE";
  QuickPickSeparatorFocusReason2[QuickPickSeparatorFocusReason2["MOUSE_HOVER"] = 1] = "MOUSE_HOVER";
  QuickPickSeparatorFocusReason2[QuickPickSeparatorFocusReason2["ACTIVE_ITEM"] = 2] = "ACTIVE_ITEM";
  return QuickPickSeparatorFocusReason2;
})(QuickPickSeparatorFocusReason || {});
class QuickPickSeparatorElement extends BaseQuickPickItemElement {
  constructor(index, fireSeparatorButtonTriggered, separator) {
    super(index, false, separator);
    this.fireSeparatorButtonTriggered = fireSeparatorButtonTriggered;
    this.separator = separator;
    this.children = new Array();
    /**
     * If this item is >0, it means that there is some item in the list that is either:
     * * hovered over
     * * active
     */
    this.focusInsideSeparator = 0 /* NONE */;
  }
}
class QuickInputItemDelegate {
  getHeight(element) {
    if (element instanceof QuickPickSeparatorElement) {
      return 30;
    }
    return element.saneDetail ? 44 : 22;
  }
  getTemplateId(element) {
    if (element instanceof QuickPickItemElement) {
      return QuickPickItemElementRenderer.ID;
    } else {
      return QuickPickSeparatorElementRenderer.ID;
    }
  }
}
class QuickInputAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize("quickInput", "Quick Input");
  }
  getAriaLabel(element) {
    return element.separator?.label ? `${element.saneAriaLabel}, ${element.separator.label}` : element.saneAriaLabel;
  }
  getWidgetRole() {
    return "listbox";
  }
  getRole(element) {
    return element.hasCheckbox ? "checkbox" : "option";
  }
  isChecked(element) {
    if (!element.hasCheckbox || !(element instanceof QuickPickItemElement)) {
      return void 0;
    }
    return {
      get value() {
        return element.checked;
      },
      onDidChange: (e) => element.onChecked(() => e())
    };
  }
}
class BaseQuickInputListRenderer {
  constructor(hoverDelegate) {
    this.hoverDelegate = hoverDelegate;
  }
  // TODO: only do the common stuff here and have a subclass handle their specific stuff
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.toDisposeElement = new DisposableStore();
    data.toDisposeTemplate = new DisposableStore();
    data.entry = dom.append(container, $(".quick-input-list-entry"));
    const label = dom.append(data.entry, $("label.quick-input-list-label"));
    data.toDisposeTemplate.add(dom.addStandardDisposableListener(label, dom.EventType.CLICK, (e) => {
      if (!data.checkbox.offsetParent) {
        e.preventDefault();
      }
    }));
    data.checkbox = dom.append(label, $("input.quick-input-list-checkbox"));
    data.checkbox.type = "checkbox";
    const rows = dom.append(label, $(".quick-input-list-rows"));
    const row1 = dom.append(rows, $(".quick-input-list-row"));
    const row2 = dom.append(rows, $(".quick-input-list-row"));
    data.label = new IconLabel(row1, { supportHighlights: true, supportDescriptionHighlights: true, supportIcons: true, hoverDelegate: this.hoverDelegate });
    data.toDisposeTemplate.add(data.label);
    data.icon = dom.prepend(data.label.element, $(".quick-input-list-icon"));
    const keybindingContainer = dom.append(row1, $(".quick-input-list-entry-keybinding"));
    data.keybinding = new KeybindingLabel(keybindingContainer, OS);
    data.toDisposeTemplate.add(data.keybinding);
    const detailContainer = dom.append(row2, $(".quick-input-list-label-meta"));
    data.detail = new IconLabel(detailContainer, { supportHighlights: true, supportIcons: true, hoverDelegate: this.hoverDelegate });
    data.toDisposeTemplate.add(data.detail);
    data.separator = dom.append(data.entry, $(".quick-input-list-separator"));
    data.actionBar = new ActionBar(data.entry, this.hoverDelegate ? { hoverDelegate: this.hoverDelegate } : void 0);
    data.actionBar.domNode.classList.add("quick-input-list-entry-action-bar");
    data.toDisposeTemplate.add(data.actionBar);
    return data;
  }
  disposeTemplate(data) {
    data.toDisposeElement.dispose();
    data.toDisposeTemplate.dispose();
  }
  disposeElement(_element, _index, data) {
    data.toDisposeElement.clear();
    data.actionBar.clear();
  }
}
let QuickPickItemElementRenderer = class extends BaseQuickInputListRenderer {
  constructor(hoverDelegate, themeService) {
    super(hoverDelegate);
    this.themeService = themeService;
    // Follow what we do in the separator renderer
    this._itemsWithSeparatorsFrequency = /* @__PURE__ */ new Map();
  }
  get templateId() {
    return QuickPickItemElementRenderer.ID;
  }
  renderTemplate(container) {
    const data = super.renderTemplate(container);
    data.toDisposeTemplate.add(dom.addStandardDisposableListener(data.checkbox, dom.EventType.CHANGE, (e) => {
      data.element.checked = data.checkbox.checked;
    }));
    return data;
  }
  renderElement(node, index, data) {
    const element = node.element;
    data.element = element;
    element.element = data.entry ?? void 0;
    const mainItem = element.item;
    element.element.classList.toggle("indented", Boolean(mainItem.indented));
    element.element.classList.toggle("not-pickable", element.item.pickable === false);
    data.checkbox.checked = element.checked;
    data.toDisposeElement.add(element.onChecked((checked) => data.checkbox.checked = checked));
    data.checkbox.disabled = element.checkboxDisabled;
    const { labelHighlights, descriptionHighlights, detailHighlights } = element;
    if (mainItem.iconPath) {
      const icon = isDark(this.themeService.getColorTheme().type) ? mainItem.iconPath.dark : mainItem.iconPath.light ?? mainItem.iconPath.dark;
      const iconUrl = URI.revive(icon);
      data.icon.className = "quick-input-list-icon";
      data.icon.style.backgroundImage = cssJs.asCSSUrl(iconUrl);
    } else {
      data.icon.style.backgroundImage = "";
      data.icon.className = mainItem.iconClass ? `quick-input-list-icon ${mainItem.iconClass}` : "";
    }
    let descriptionTitle;
    if (!element.saneTooltip && element.saneDescription) {
      descriptionTitle = {
        markdown: {
          value: escape(element.saneDescription),
          supportThemeIcons: true
        },
        markdownNotSupportedFallback: element.saneDescription
      };
    }
    const options = {
      matches: labelHighlights || [],
      // If we have a tooltip, we want that to be shown and not any other hover
      descriptionTitle,
      descriptionMatches: descriptionHighlights || [],
      labelEscapeNewLines: true
    };
    options.extraClasses = mainItem.iconClasses;
    options.italic = mainItem.italic;
    options.strikethrough = mainItem.strikethrough;
    data.entry.classList.remove("quick-input-list-separator-as-item");
    data.label.setLabel(element.saneLabel, element.saneDescription, options);
    data.keybinding.set(mainItem.keybinding);
    if (element.saneDetail) {
      let title;
      if (!element.saneTooltip) {
        title = {
          markdown: {
            value: escape(element.saneDetail),
            supportThemeIcons: true
          },
          markdownNotSupportedFallback: element.saneDetail
        };
      }
      data.detail.element.style.display = "";
      data.detail.setLabel(element.saneDetail, void 0, {
        matches: detailHighlights,
        title,
        labelEscapeNewLines: true
      });
    } else {
      data.detail.element.style.display = "none";
    }
    if (element.separator?.label) {
      data.separator.textContent = element.separator.label;
      data.separator.style.display = "";
      this.addItemWithSeparator(element);
    } else {
      data.separator.style.display = "none";
    }
    data.entry.classList.toggle("quick-input-list-separator-border", !!element.separator);
    const buttons = mainItem.buttons;
    if (buttons && buttons.length) {
      data.actionBar.push(buttons.map((button, index2) => quickInputButtonToAction(
        button,
        `id-${index2}`,
        () => element.fireButtonTriggered({ button, item: element.item })
      )), { icon: true, label: false });
      data.entry.classList.add("has-actions");
    } else {
      data.entry.classList.remove("has-actions");
    }
  }
  disposeElement(element, _index, data) {
    this.removeItemWithSeparator(element.element);
    super.disposeElement(element, _index, data);
  }
  isItemWithSeparatorVisible(item) {
    return this._itemsWithSeparatorsFrequency.has(item);
  }
  addItemWithSeparator(item) {
    this._itemsWithSeparatorsFrequency.set(item, (this._itemsWithSeparatorsFrequency.get(item) || 0) + 1);
  }
  removeItemWithSeparator(item) {
    const frequency = this._itemsWithSeparatorsFrequency.get(item) || 0;
    if (frequency > 1) {
      this._itemsWithSeparatorsFrequency.set(item, frequency - 1);
    } else {
      this._itemsWithSeparatorsFrequency.delete(item);
    }
  }
};
QuickPickItemElementRenderer.ID = "quickpickitem";
QuickPickItemElementRenderer = __decorateClass([
  __decorateParam(1, IThemeService)
], QuickPickItemElementRenderer);
const _QuickPickSeparatorElementRenderer = class _QuickPickSeparatorElementRenderer extends BaseQuickInputListRenderer {
  constructor() {
    super(...arguments);
    // This is a frequency map because sticky scroll re-uses the same renderer to render a second
    // instance of the same separator.
    this._visibleSeparatorsFrequency = /* @__PURE__ */ new Map();
  }
  get templateId() {
    return _QuickPickSeparatorElementRenderer.ID;
  }
  get visibleSeparators() {
    return [...this._visibleSeparatorsFrequency.keys()];
  }
  isSeparatorVisible(separator) {
    return this._visibleSeparatorsFrequency.has(separator);
  }
  renderTemplate(container) {
    const data = super.renderTemplate(container);
    data.checkbox.style.display = "none";
    return data;
  }
  renderElement(node, index, data) {
    const element = node.element;
    data.element = element;
    element.element = data.entry ?? void 0;
    element.element.classList.toggle("focus-inside", !!element.focusInsideSeparator);
    const mainItem = element.separator;
    const { labelHighlights, descriptionHighlights } = element;
    data.icon.style.backgroundImage = "";
    data.icon.className = "";
    let descriptionTitle;
    if (!element.saneTooltip && element.saneDescription) {
      descriptionTitle = {
        markdown: {
          value: escape(element.saneDescription),
          supportThemeIcons: true
        },
        markdownNotSupportedFallback: element.saneDescription
      };
    }
    const options = {
      matches: labelHighlights || [],
      // If we have a tooltip, we want that to be shown and not any other hover
      descriptionTitle,
      descriptionMatches: descriptionHighlights || [],
      labelEscapeNewLines: true
    };
    data.entry.classList.add("quick-input-list-separator-as-item");
    data.label.setLabel(element.saneLabel, element.saneDescription, options);
    data.separator.style.display = "none";
    data.entry.classList.add("quick-input-list-separator-border");
    const buttons = mainItem.buttons;
    if (buttons && buttons.length) {
      data.actionBar.push(buttons.map((button, index2) => quickInputButtonToAction(
        button,
        `id-${index2}`,
        () => element.fireSeparatorButtonTriggered({ button, separator: element.separator })
      )), { icon: true, label: false });
      data.entry.classList.add("has-actions");
    } else {
      data.entry.classList.remove("has-actions");
    }
    this.addSeparator(element);
  }
  disposeElement(element, _index, data) {
    this.removeSeparator(element.element);
    if (!this.isSeparatorVisible(element.element)) {
      element.element.element?.classList.remove("focus-inside");
    }
    super.disposeElement(element, _index, data);
  }
  addSeparator(separator) {
    this._visibleSeparatorsFrequency.set(separator, (this._visibleSeparatorsFrequency.get(separator) || 0) + 1);
  }
  removeSeparator(separator) {
    const frequency = this._visibleSeparatorsFrequency.get(separator) || 0;
    if (frequency > 1) {
      this._visibleSeparatorsFrequency.set(separator, frequency - 1);
    } else {
      this._visibleSeparatorsFrequency.delete(separator);
    }
  }
};
_QuickPickSeparatorElementRenderer.ID = "quickpickseparator";
let QuickPickSeparatorElementRenderer = _QuickPickSeparatorElementRenderer;
let QuickInputTree = class extends Disposable {
  constructor(parent, hoverDelegate, linkOpenerDelegate, id, instantiationService, accessibilityService) {
    super();
    this.parent = parent;
    this.hoverDelegate = hoverDelegate;
    this.linkOpenerDelegate = linkOpenerDelegate;
    this.accessibilityService = accessibilityService;
    //#region QuickInputTree Events
    this._onKeyDown = new Emitter();
    /**
     * Event that is fired when the tree receives a keydown.
    */
    this.onKeyDown = this._onKeyDown.event;
    this._onLeave = new Emitter();
    /**
     * Event that is fired when the tree would no longer have focus.
    */
    this.onLeave = this._onLeave.event;
    this._visibleCountObservable = observableValue("VisibleCount", 0);
    this.onChangedVisibleCount = Event.fromObservable(this._visibleCountObservable, this._store);
    this._allVisibleCheckedObservable = observableValue("AllVisibleChecked", false);
    this.onChangedAllVisibleChecked = Event.fromObservable(this._allVisibleCheckedObservable, this._store);
    this._checkedCountObservable = observableValue("CheckedCount", 0);
    this.onChangedCheckedCount = Event.fromObservable(this._checkedCountObservable, this._store);
    this._checkedElementsObservable = observableValueOpts({ equalsFn: equals }, new Array());
    this.onChangedCheckedElements = Event.fromObservable(this._checkedElementsObservable, this._store);
    this._onButtonTriggered = new Emitter();
    this.onButtonTriggered = this._onButtonTriggered.event;
    this._onSeparatorButtonTriggered = new Emitter();
    this.onSeparatorButtonTriggered = this._onSeparatorButtonTriggered.event;
    this._elementChecked = new Emitter();
    this._elementCheckedEventBufferer = new EventBufferer();
    //#endregion
    this._hasCheckboxes = false;
    this._inputElements = new Array();
    this._elementTree = new Array();
    this._itemElements = new Array();
    // Elements that apply to the current set of elements
    this._elementDisposable = this._register(new DisposableStore());
    this._matchOnDescription = false;
    this._matchOnDetail = false;
    this._matchOnLabel = true;
    this._matchOnLabelMode = "fuzzy";
    this._matchOnMeta = true;
    this._sortByLabel = true;
    this._shouldLoop = true;
    this._container = dom.append(this.parent, $(".quick-input-list"));
    this._separatorRenderer = new QuickPickSeparatorElementRenderer(hoverDelegate);
    this._itemRenderer = instantiationService.createInstance(QuickPickItemElementRenderer, hoverDelegate);
    this._tree = this._register(instantiationService.createInstance(
      WorkbenchObjectTree,
      "QuickInput",
      this._container,
      new QuickInputItemDelegate(),
      [this._itemRenderer, this._separatorRenderer],
      {
        filter: {
          filter(element) {
            return element.hidden ? TreeVisibility.Hidden : element instanceof QuickPickSeparatorElement ? TreeVisibility.Recurse : TreeVisibility.Visible;
          }
        },
        sorter: {
          compare: (element, otherElement) => {
            if (!this.sortByLabel || !this._lastQueryString) {
              return 0;
            }
            const normalizedSearchValue = this._lastQueryString.toLowerCase();
            return compareEntries(element, otherElement, normalizedSearchValue);
          }
        },
        accessibilityProvider: new QuickInputAccessibilityProvider(),
        setRowLineHeight: false,
        multipleSelectionSupport: false,
        hideTwistiesOfChildlessElements: true,
        renderIndentGuides: RenderIndentGuides.None,
        findWidgetEnabled: false,
        indent: 0,
        horizontalScrolling: false,
        allowNonCollapsibleParents: true,
        alwaysConsumeMouseWheel: true
      }
    ));
    this._tree.getHTMLElement().id = id;
    this._registerListeners();
  }
  get onDidChangeFocus() {
    return Event.map(
      this._tree.onDidChangeFocus,
      (e) => e.elements.filter((e2) => e2 instanceof QuickPickItemElement).map((e2) => e2.item),
      this._store
    );
  }
  get onDidChangeSelection() {
    return Event.map(
      this._tree.onDidChangeSelection,
      (e) => ({
        items: e.elements.filter((e2) => e2 instanceof QuickPickItemElement).map((e2) => e2.item),
        event: e.browserEvent
      }),
      this._store
    );
  }
  get displayed() {
    return this._container.style.display !== "none";
  }
  set displayed(value) {
    this._container.style.display = value ? "" : "none";
  }
  get scrollTop() {
    return this._tree.scrollTop;
  }
  set scrollTop(scrollTop) {
    this._tree.scrollTop = scrollTop;
  }
  get ariaLabel() {
    return this._tree.ariaLabel;
  }
  set ariaLabel(label) {
    this._tree.ariaLabel = label ?? "";
  }
  set enabled(value) {
    this._tree.getHTMLElement().style.pointerEvents = value ? "" : "none";
  }
  get matchOnDescription() {
    return this._matchOnDescription;
  }
  set matchOnDescription(value) {
    this._matchOnDescription = value;
  }
  get matchOnDetail() {
    return this._matchOnDetail;
  }
  set matchOnDetail(value) {
    this._matchOnDetail = value;
  }
  get matchOnLabel() {
    return this._matchOnLabel;
  }
  set matchOnLabel(value) {
    this._matchOnLabel = value;
  }
  get matchOnLabelMode() {
    return this._matchOnLabelMode;
  }
  set matchOnLabelMode(value) {
    this._matchOnLabelMode = value;
  }
  get matchOnMeta() {
    return this._matchOnMeta;
  }
  set matchOnMeta(value) {
    this._matchOnMeta = value;
  }
  get sortByLabel() {
    return this._sortByLabel;
  }
  set sortByLabel(value) {
    this._sortByLabel = value;
  }
  get shouldLoop() {
    return this._shouldLoop;
  }
  set shouldLoop(value) {
    this._shouldLoop = value;
  }
  //#endregion
  //#region register listeners
  _registerListeners() {
    this._registerOnKeyDown();
    this._registerOnContainerClick();
    this._registerOnMouseMiddleClick();
    this._registerOnTreeModelChanged();
    this._registerOnElementChecked();
    this._registerOnContextMenu();
    this._registerHoverListeners();
    this._registerSelectionChangeListener();
    this._registerSeparatorActionShowingListeners();
  }
  _registerOnKeyDown() {
    this._register(this._tree.onKeyDown((e) => {
      const event = new StandardKeyboardEvent(e);
      switch (event.keyCode) {
        case KeyCode.Space:
          this.toggleCheckbox();
          break;
      }
      this._onKeyDown.fire(event);
    }));
  }
  _registerOnContainerClick() {
    this._register(dom.addDisposableListener(this._container, dom.EventType.CLICK, (e) => {
      if (e.x || e.y) {
        this._onLeave.fire();
      }
    }));
  }
  _registerOnMouseMiddleClick() {
    this._register(dom.addDisposableListener(this._container, dom.EventType.AUXCLICK, (e) => {
      if (e.button === 1) {
        this._onLeave.fire();
      }
    }));
  }
  _registerOnTreeModelChanged() {
    this._register(this._tree.onDidChangeModel(() => {
      const visibleCount = this._itemElements.filter((e) => !e.hidden).length;
      this._visibleCountObservable.set(visibleCount, void 0);
      if (this._hasCheckboxes) {
        this._updateCheckedObservables();
      }
    }));
  }
  _registerOnElementChecked() {
    this._register(this._elementCheckedEventBufferer.wrapEvent(this._elementChecked.event, (_, e) => e)((_) => this._updateCheckedObservables()));
  }
  _registerOnContextMenu() {
    this._register(this._tree.onContextMenu((e) => {
      if (e.element) {
        e.browserEvent.preventDefault();
        this._tree.setSelection([e.element]);
      }
    }));
  }
  _registerHoverListeners() {
    const delayer = this._register(new ThrottledDelayer(typeof this.hoverDelegate.delay === "function" ? this.hoverDelegate.delay() : this.hoverDelegate.delay));
    this._register(this._tree.onMouseOver(async (e) => {
      if (dom.isHTMLAnchorElement(e.browserEvent.target)) {
        delayer.cancel();
        return;
      }
      if (
        // anchors are an exception as called out above so we skip them here
        !dom.isHTMLAnchorElement(e.browserEvent.relatedTarget) && // check if the mouse is still over the same element
        dom.isAncestor(e.browserEvent.relatedTarget, e.element?.element)
      ) {
        return;
      }
      try {
        await delayer.trigger(async () => {
          if (e.element instanceof QuickPickItemElement) {
            this.showHover(e.element);
          }
        });
      } catch (e2) {
        if (!isCancellationError(e2)) {
          throw e2;
        }
      }
    }));
    this._register(this._tree.onMouseOut((e) => {
      if (dom.isAncestor(e.browserEvent.relatedTarget, e.element?.element)) {
        return;
      }
      delayer.cancel();
    }));
  }
  /**
   * Register's focus change and mouse events so that we can track when items inside of a
   * separator's section are focused or hovered so that we can display the separator's actions
   */
  _registerSeparatorActionShowingListeners() {
    this._register(this._tree.onDidChangeFocus((e) => {
      const parent = e.elements[0] ? this._tree.getParentElement(e.elements[0]) : null;
      for (const separator of this._separatorRenderer.visibleSeparators) {
        const value = separator === parent;
        const currentActive = !!(separator.focusInsideSeparator & 2 /* ACTIVE_ITEM */);
        if (currentActive !== value) {
          if (value) {
            separator.focusInsideSeparator |= 2 /* ACTIVE_ITEM */;
          } else {
            separator.focusInsideSeparator &= ~2 /* ACTIVE_ITEM */;
          }
          this._tree.rerender(separator);
        }
      }
    }));
    this._register(this._tree.onMouseOver((e) => {
      const parent = e.element ? this._tree.getParentElement(e.element) : null;
      for (const separator of this._separatorRenderer.visibleSeparators) {
        if (separator !== parent) {
          continue;
        }
        const currentMouse = !!(separator.focusInsideSeparator & 1 /* MOUSE_HOVER */);
        if (!currentMouse) {
          separator.focusInsideSeparator |= 1 /* MOUSE_HOVER */;
          this._tree.rerender(separator);
        }
      }
    }));
    this._register(this._tree.onMouseOut((e) => {
      const parent = e.element ? this._tree.getParentElement(e.element) : null;
      for (const separator of this._separatorRenderer.visibleSeparators) {
        if (separator !== parent) {
          continue;
        }
        const currentMouse = !!(separator.focusInsideSeparator & 1 /* MOUSE_HOVER */);
        if (currentMouse) {
          separator.focusInsideSeparator &= ~1 /* MOUSE_HOVER */;
          this._tree.rerender(separator);
        }
      }
    }));
  }
  _registerSelectionChangeListener() {
    this._register(this._tree.onDidChangeSelection((e) => {
      const elementsWithoutSeparators = e.elements.filter((e2) => e2 instanceof QuickPickItemElement);
      if (elementsWithoutSeparators.length !== e.elements.length) {
        if (e.elements.length === 1 && e.elements[0] instanceof QuickPickSeparatorElement) {
          this._tree.setFocus([e.elements[0].children[0]]);
          this._tree.reveal(e.elements[0], 0);
        }
        this._tree.setSelection(elementsWithoutSeparators);
      }
    }));
  }
  //#endregion
  //#region public methods
  setAllVisibleChecked(checked) {
    this._elementCheckedEventBufferer.bufferEvents(() => {
      this._itemElements.forEach((element) => {
        if (!element.hidden && !element.checkboxDisabled && element.item.pickable !== false) {
          element.checked = checked;
        }
      });
    });
  }
  setElements(inputElements) {
    this._elementDisposable.clear();
    this._lastQueryString = void 0;
    this._inputElements = inputElements;
    this._hasCheckboxes = this.parent.classList.contains("show-checkboxes");
    let currentSeparatorElement;
    this._itemElements = new Array();
    this._elementTree = inputElements.reduce((result, item, index) => {
      let element;
      if (item.type === "separator") {
        if (!item.buttons) {
          return result;
        }
        currentSeparatorElement = new QuickPickSeparatorElement(
          index,
          (e) => this._onSeparatorButtonTriggered.fire(e),
          item
        );
        element = currentSeparatorElement;
      } else {
        const previous = index > 0 ? inputElements[index - 1] : void 0;
        let separator;
        if (previous && previous.type === "separator" && !previous.buttons) {
          currentSeparatorElement = void 0;
          separator = previous;
        }
        const qpi = new QuickPickItemElement(
          index,
          this._hasCheckboxes,
          (e) => this._onButtonTriggered.fire(e),
          this._elementChecked,
          item,
          separator
        );
        this._itemElements.push(qpi);
        if (currentSeparatorElement) {
          currentSeparatorElement.children.push(qpi);
          return result;
        }
        element = qpi;
      }
      result.push(element);
      return result;
    }, new Array());
    this._setElementsToTree(this._elementTree);
    if (this.accessibilityService.isScreenReaderOptimized()) {
      setTimeout(() => {
        const focusedElement = this._tree.getHTMLElement().querySelector(`.monaco-list-row.focused`);
        const parent = focusedElement?.parentNode;
        if (focusedElement && parent) {
          const nextSibling = focusedElement.nextSibling;
          focusedElement.remove();
          parent.insertBefore(focusedElement, nextSibling);
        }
      }, 0);
    }
  }
  setFocusedElements(items) {
    const elements = items.map((item) => this._itemElements.find((e) => e.item === item)).filter((e) => !!e).filter((e) => !e.hidden);
    this._tree.setFocus(elements);
    if (items.length > 0) {
      const focused = this._tree.getFocus()[0];
      if (focused) {
        this._tree.reveal(focused);
      }
    }
  }
  getActiveDescendant() {
    return this._tree.getHTMLElement().getAttribute("aria-activedescendant");
  }
  setSelectedElements(items) {
    const elements = items.map((item) => this._itemElements.find((e) => e.item === item)).filter((e) => !!e);
    this._tree.setSelection(elements);
  }
  getCheckedElements() {
    return this._itemElements.filter((e) => e.checked).map((e) => e.item);
  }
  setCheckedElements(items) {
    this._elementCheckedEventBufferer.bufferEvents(() => {
      const checked = /* @__PURE__ */ new Set();
      for (const item of items) {
        checked.add(item);
      }
      for (const element of this._itemElements) {
        element.checked = checked.has(element.item);
      }
    });
  }
  focus(what) {
    if (!this._itemElements.length) {
      return;
    }
    if (what === QuickPickFocus.Second && this._itemElements.length < 2) {
      what = QuickPickFocus.First;
    }
    switch (what) {
      case QuickPickFocus.First:
        this._tree.scrollTop = 0;
        this._tree.focusFirst(void 0, (e) => e.element instanceof QuickPickItemElement);
        break;
      case QuickPickFocus.Second: {
        this._tree.scrollTop = 0;
        let isSecondItem = false;
        this._tree.focusFirst(void 0, (e) => {
          if (!(e.element instanceof QuickPickItemElement)) {
            return false;
          }
          if (isSecondItem) {
            return true;
          }
          isSecondItem = !isSecondItem;
          return false;
        });
        break;
      }
      case QuickPickFocus.Last:
        this._tree.scrollTop = this._tree.scrollHeight;
        this._tree.focusLast(void 0, (e) => e.element instanceof QuickPickItemElement);
        break;
      case QuickPickFocus.Next: {
        const prevFocus = this._tree.getFocus();
        this._tree.focusNext(void 0, this._shouldLoop, void 0, (e) => {
          if (!(e.element instanceof QuickPickItemElement)) {
            return false;
          }
          this._tree.reveal(e.element);
          return true;
        });
        const currentFocus = this._tree.getFocus();
        if (prevFocus.length && prevFocus[0] === currentFocus[0]) {
          this._onLeave.fire();
        }
        break;
      }
      case QuickPickFocus.Previous: {
        const prevFocus = this._tree.getFocus();
        this._tree.focusPrevious(void 0, this._shouldLoop, void 0, (e) => {
          if (!(e.element instanceof QuickPickItemElement)) {
            return false;
          }
          const parent = this._tree.getParentElement(e.element);
          if (parent === null || parent.children[0] !== e.element) {
            this._tree.reveal(e.element);
          } else {
            this._tree.reveal(parent);
          }
          return true;
        });
        const currentFocus = this._tree.getFocus();
        if (prevFocus.length && prevFocus[0] === currentFocus[0]) {
          this._onLeave.fire();
        }
        break;
      }
      case QuickPickFocus.NextPage:
        this._tree.focusNextPage(void 0, (e) => {
          if (!(e.element instanceof QuickPickItemElement)) {
            return false;
          }
          this._tree.reveal(e.element);
          return true;
        });
        break;
      case QuickPickFocus.PreviousPage:
        this._tree.focusPreviousPage(void 0, (e) => {
          if (!(e.element instanceof QuickPickItemElement)) {
            return false;
          }
          const parent = this._tree.getParentElement(e.element);
          if (parent === null || parent.children[0] !== e.element) {
            this._tree.reveal(e.element);
          } else {
            this._tree.reveal(parent);
          }
          return true;
        });
        break;
      case QuickPickFocus.NextSeparator: {
        let foundSeparatorAsItem = false;
        const before = this._tree.getFocus()[0];
        this._tree.focusNext(void 0, true, void 0, (e) => {
          if (foundSeparatorAsItem) {
            return true;
          }
          if (e.element instanceof QuickPickSeparatorElement) {
            foundSeparatorAsItem = true;
            if (this._separatorRenderer.isSeparatorVisible(e.element)) {
              this._tree.reveal(e.element.children[0]);
            } else {
              this._tree.reveal(e.element, 0);
            }
          } else if (e.element instanceof QuickPickItemElement) {
            if (e.element.separator) {
              if (this._itemRenderer.isItemWithSeparatorVisible(e.element)) {
                this._tree.reveal(e.element);
              } else {
                this._tree.reveal(e.element, 0);
              }
              return true;
            } else if (e.element === this._elementTree[0]) {
              this._tree.reveal(e.element, 0);
              return true;
            }
          }
          return false;
        });
        const after = this._tree.getFocus()[0];
        if (before === after) {
          this._tree.scrollTop = this._tree.scrollHeight;
          this._tree.focusLast(void 0, (e) => e.element instanceof QuickPickItemElement);
        }
        break;
      }
      case QuickPickFocus.PreviousSeparator: {
        let focusElement;
        let foundSeparator = !!this._tree.getFocus()[0]?.separator;
        this._tree.focusPrevious(void 0, true, void 0, (e) => {
          if (e.element instanceof QuickPickSeparatorElement) {
            if (foundSeparator) {
              if (!focusElement) {
                if (this._separatorRenderer.isSeparatorVisible(e.element)) {
                  this._tree.reveal(e.element);
                } else {
                  this._tree.reveal(e.element, 0);
                }
                focusElement = e.element.children[0];
              }
            } else {
              foundSeparator = true;
            }
          } else if (e.element instanceof QuickPickItemElement) {
            if (!focusElement) {
              if (e.element.separator) {
                if (this._itemRenderer.isItemWithSeparatorVisible(e.element)) {
                  this._tree.reveal(e.element);
                } else {
                  this._tree.reveal(e.element, 0);
                }
                focusElement = e.element;
              } else if (e.element === this._elementTree[0]) {
                this._tree.reveal(e.element, 0);
                return true;
              }
            }
          }
          return false;
        });
        if (focusElement) {
          this._tree.setFocus([focusElement]);
        }
        break;
      }
    }
  }
  clearFocus() {
    this._tree.setFocus([]);
  }
  domFocus() {
    this._tree.domFocus();
  }
  layout(maxHeight) {
    this._tree.getHTMLElement().style.maxHeight = maxHeight ? `${// Make sure height aligns with list item heights
    Math.floor(maxHeight / 44) * 44 + 6}px` : "";
    this._tree.layout();
  }
  filter(query) {
    this._lastQueryString = query;
    if (!(this._sortByLabel || this._matchOnLabel || this._matchOnDescription || this._matchOnDetail)) {
      this._tree.layout();
      return false;
    }
    const queryWithWhitespace = query;
    query = query.trim();
    if (!query || !(this.matchOnLabel || this.matchOnDescription || this.matchOnDetail)) {
      this._itemElements.forEach((element) => {
        element.labelHighlights = void 0;
        element.descriptionHighlights = void 0;
        element.detailHighlights = void 0;
        element.hidden = false;
        const previous = element.index && this._inputElements[element.index - 1];
        if (element.item) {
          element.separator = previous && previous.type === "separator" && !previous.buttons ? previous : void 0;
        }
      });
    } else {
      let currentSeparator;
      this._itemElements.forEach((element) => {
        let labelHighlights;
        if (this.matchOnLabelMode === "fuzzy") {
          labelHighlights = this.matchOnLabel ? matchesFuzzyIconAware(query, parseLabelWithIcons(element.saneLabel)) ?? void 0 : void 0;
        } else {
          labelHighlights = this.matchOnLabel ? matchesContiguousIconAware(queryWithWhitespace, parseLabelWithIcons(element.saneLabel)) ?? void 0 : void 0;
        }
        const descriptionHighlights = this.matchOnDescription ? matchesFuzzyIconAware(query, parseLabelWithIcons(element.saneDescription || "")) ?? void 0 : void 0;
        const detailHighlights = this.matchOnDetail ? matchesFuzzyIconAware(query, parseLabelWithIcons(element.saneDetail || "")) ?? void 0 : void 0;
        if (labelHighlights || descriptionHighlights || detailHighlights) {
          element.labelHighlights = labelHighlights;
          element.descriptionHighlights = descriptionHighlights;
          element.detailHighlights = detailHighlights;
          element.hidden = false;
        } else {
          element.labelHighlights = void 0;
          element.descriptionHighlights = void 0;
          element.detailHighlights = void 0;
          element.hidden = element.item ? !element.item.alwaysShow : true;
        }
        if (element.item) {
          element.separator = void 0;
        } else if (element.separator) {
          element.hidden = true;
        }
        if (!this.sortByLabel) {
          const previous = element.index && this._inputElements[element.index - 1] || void 0;
          if (previous?.type === "separator" && !previous.buttons) {
            currentSeparator = previous;
          }
          if (currentSeparator && !element.hidden) {
            element.separator = currentSeparator;
            currentSeparator = void 0;
          }
        }
      });
    }
    this._setElementsToTree(
      this._sortByLabel && query ? this._itemElements : this._elementTree
    );
    this._tree.layout();
    return true;
  }
  toggleCheckbox() {
    this._elementCheckedEventBufferer.bufferEvents(() => {
      const elements = this._tree.getFocus().filter((e) => e instanceof QuickPickItemElement);
      const allChecked = this._allVisibleChecked(elements);
      for (const element of elements) {
        if (!element.checkboxDisabled) {
          element.checked = !allChecked;
        }
      }
    });
  }
  style(styles) {
    this._tree.style(styles);
  }
  toggleHover() {
    const focused = this._tree.getFocus()[0];
    if (!focused?.saneTooltip || !(focused instanceof QuickPickItemElement)) {
      return;
    }
    if (this._lastHover && !this._lastHover.isDisposed) {
      this._lastHover.dispose();
      return;
    }
    this.showHover(focused);
    const store = new DisposableStore();
    store.add(this._tree.onDidChangeFocus((e) => {
      if (e.elements[0] instanceof QuickPickItemElement) {
        this.showHover(e.elements[0]);
      }
    }));
    if (this._lastHover) {
      store.add(this._lastHover);
    }
    this._elementDisposable.add(store);
  }
  //#endregion
  //#region private methods
  _setElementsToTree(elements) {
    const treeElements = new Array();
    for (const element of elements) {
      if (element instanceof QuickPickSeparatorElement) {
        treeElements.push({
          element,
          collapsible: false,
          collapsed: false,
          children: element.children.map((e) => ({
            element: e,
            collapsible: false,
            collapsed: false
          }))
        });
      } else {
        treeElements.push({
          element,
          collapsible: false,
          collapsed: false
        });
      }
    }
    this._tree.setChildren(null, treeElements);
  }
  _allVisibleChecked(elements, whenNoneVisible = true) {
    for (let i = 0, n = elements.length; i < n; i++) {
      const element = elements[i];
      if (!element.hidden && element.item.pickable !== false) {
        if (!element.checked) {
          return false;
        } else {
          whenNoneVisible = true;
        }
      }
    }
    return whenNoneVisible;
  }
  _updateCheckedObservables() {
    transaction((tx) => {
      this._allVisibleCheckedObservable.set(this._allVisibleChecked(this._itemElements, false), tx);
      const checkedCount = this._itemElements.filter((element) => element.checked).length;
      this._checkedCountObservable.set(checkedCount, tx);
      this._checkedElementsObservable.set(this.getCheckedElements(), tx);
    });
  }
  /**
   * Disposes of the hover and shows a new one for the given index if it has a tooltip.
   * @param element The element to show the hover for
   */
  showHover(element) {
    if (this._lastHover && !this._lastHover.isDisposed) {
      this.hoverDelegate.onDidHideHover?.();
      this._lastHover?.dispose();
    }
    if (!element.element || !element.saneTooltip) {
      return;
    }
    this._lastHover = this.hoverDelegate.showHover({
      content: element.saneTooltip,
      target: element.element,
      linkHandler: (url) => {
        this.linkOpenerDelegate(url);
      },
      appearance: {
        showPointer: true
      },
      container: this._container,
      position: {
        hoverPosition: HoverPosition.RIGHT
      }
    }, false);
  }
};
__decorateClass([
  memoize
], QuickInputTree.prototype, "onDidChangeFocus", 1);
__decorateClass([
  memoize
], QuickInputTree.prototype, "onDidChangeSelection", 1);
QuickInputTree = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IAccessibilityService)
], QuickInputTree);
function matchesContiguousIconAware(query, target) {
  const { text, iconOffsets } = target;
  if (!iconOffsets || iconOffsets.length === 0) {
    return matchesContiguous(query, text);
  }
  const wordToMatchAgainstWithoutIconsTrimmed = ltrim(text, " ");
  const leadingWhitespaceOffset = text.length - wordToMatchAgainstWithoutIconsTrimmed.length;
  const matches = matchesContiguous(query, wordToMatchAgainstWithoutIconsTrimmed);
  if (matches) {
    for (const match of matches) {
      const iconOffset = iconOffsets[match.start + leadingWhitespaceOffset] + leadingWhitespaceOffset;
      match.start += iconOffset;
      match.end += iconOffset;
    }
  }
  return matches;
}
function matchesContiguous(word, wordToMatchAgainst) {
  const matchIndex = wordToMatchAgainst.toLowerCase().indexOf(word.toLowerCase());
  if (matchIndex !== -1) {
    return [{ start: matchIndex, end: matchIndex + word.length }];
  }
  return null;
}
function compareEntries(elementA, elementB, lookFor) {
  const labelHighlightsA = elementA.labelHighlights || [];
  const labelHighlightsB = elementB.labelHighlights || [];
  if (labelHighlightsA.length && !labelHighlightsB.length) {
    return -1;
  }
  if (!labelHighlightsA.length && labelHighlightsB.length) {
    return 1;
  }
  if (labelHighlightsA.length === 0 && labelHighlightsB.length === 0) {
    return 0;
  }
  return compareAnything(elementA.saneSortLabel, elementB.saneSortLabel, lookFor);
}
export {
  QuickInputTree
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvcXVpY2tJbnB1dFRyZWUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBjc3NKcyBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY3NzVmFsdWUuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQsIEV2ZW50QnVmZmVyZXIsIElWYWx1ZVdpdGhDaGFuZ2VFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGUuanMnO1xuaW1wb3J0IHsgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElPYmplY3RUcmVlRWxlbWVudCwgSVRyZWVOb2RlLCBJVHJlZVJlbmRlcmVyLCBUcmVlVmlzaWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hPYmplY3RUcmVlIH0gZnJvbSAnLi4vLi4vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrUGlja0l0ZW1CdXR0b25FdmVudCwgSVF1aWNrUGlja1NlcGFyYXRvciwgSVF1aWNrUGlja1NlcGFyYXRvckJ1dHRvbkV2ZW50LCBRdWlja1BpY2tJdGVtLCBRdWlja1BpY2tGb2N1cyB9IGZyb20gJy4uL2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElNYXRjaCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIsIElMaXN0U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBBcmlhUm9sZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IE9TIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgSUljb25MYWJlbFZhbHVlT3B0aW9ucywgSWNvbkxhYmVsIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWwuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ0xhYmVsIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2tleWJpbmRpbmdMYWJlbC9rZXliaW5kaW5nTGFiZWwuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgaXNEYXJrIH0gZnJvbSAnLi4vLi4vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBxdWlja0lucHV0QnV0dG9uVG9BY3Rpb24gfSBmcm9tICcuL3F1aWNrSW5wdXRVdGlscy5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBJUGFyc2VkTGFiZWxXaXRoSWNvbnMsIGdldENvZGljb25BcmlhTGFiZWwsIG1hdGNoZXNGdXp6eUljb25Bd2FyZSwgcGFyc2VMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgSG92ZXJQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlcldpZGdldC5qcyc7XG5pbXBvcnQgeyBjb21wYXJlQW55dGhpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb21wYXJlcnMuanMnO1xuaW1wb3J0IHsgZXNjYXBlLCBsdHJpbSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgUmVuZGVySW5kZW50R3VpZGVzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvYWJzdHJhY3RUcmVlLmpzJztcbmltcG9ydCB7IFRocm90dGxlZERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB0eXBlIHsgSUhvdmVyV2lkZ2V0LCBJTWFuYWdlZEhvdmVyVG9vbHRpcE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZVZhbHVlLCBvYnNlcnZhYmxlVmFsdWVPcHRzLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5pbnRlcmZhY2UgSVF1aWNrSW5wdXRJdGVtTGF6eVBhcnRzIHtcblx0cmVhZG9ubHkgc2FuZUxhYmVsOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHNhbmVTb3J0TGFiZWw6IHN0cmluZztcblx0cmVhZG9ubHkgc2FuZUFyaWFMYWJlbDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSVF1aWNrUGlja0VsZW1lbnQgZXh0ZW5kcyBJUXVpY2tJbnB1dEl0ZW1MYXp5UGFydHMge1xuXHRyZWFkb25seSBoYXNDaGVja2JveDogYm9vbGVhbjtcblx0cmVhZG9ubHkgaW5kZXg6IG51bWJlcjtcblx0cmVhZG9ubHkgaXRlbT86IElRdWlja1BpY2tJdGVtO1xuXHRyZWFkb25seSBzYW5lRGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHNhbmVEZXRhaWw/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHNhbmVUb29sdGlwPzogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nIHwgSFRNTEVsZW1lbnQ7XG5cdGhpZGRlbjogYm9vbGVhbjtcblx0ZWxlbWVudD86IEhUTUxFbGVtZW50O1xuXHRsYWJlbEhpZ2hsaWdodHM/OiBJTWF0Y2hbXTtcblx0ZGVzY3JpcHRpb25IaWdobGlnaHRzPzogSU1hdGNoW107XG5cdGRldGFpbEhpZ2hsaWdodHM/OiBJTWF0Y2hbXTtcblx0c2VwYXJhdG9yPzogSVF1aWNrUGlja1NlcGFyYXRvcjtcbn1cblxuaW50ZXJmYWNlIElRdWlja0lucHV0SXRlbVRlbXBsYXRlRGF0YSB7XG5cdGVudHJ5OiBIVE1MRGl2RWxlbWVudDtcblx0Y2hlY2tib3g6IEhUTUxJbnB1dEVsZW1lbnQ7XG5cdGljb246IEhUTUxEaXZFbGVtZW50O1xuXHRsYWJlbDogSWNvbkxhYmVsO1xuXHRrZXliaW5kaW5nOiBLZXliaW5kaW5nTGFiZWw7XG5cdGRldGFpbDogSWNvbkxhYmVsO1xuXHRzZXBhcmF0b3I6IEhUTUxEaXZFbGVtZW50O1xuXHRhY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0ZWxlbWVudDogSVF1aWNrUGlja0VsZW1lbnQ7XG5cdHRvRGlzcG9zZUVsZW1lbnQ6IERpc3Bvc2FibGVTdG9yZTtcblx0dG9EaXNwb3NlVGVtcGxhdGU6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuY2xhc3MgQmFzZVF1aWNrUGlja0l0ZW1FbGVtZW50IGltcGxlbWVudHMgSVF1aWNrUGlja0VsZW1lbnQge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbml0OiBMYXp5PElRdWlja0lucHV0SXRlbUxhenlQYXJ0cz47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgaW5kZXg6IG51bWJlcixcblx0XHRyZWFkb25seSBoYXNDaGVja2JveDogYm9vbGVhbixcblx0XHRtYWluSXRlbTogUXVpY2tQaWNrSXRlbVxuXHQpIHtcblx0XHR0aGlzLl9pbml0ID0gbmV3IExhenkoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2FuZUxhYmVsID0gbWFpbkl0ZW0ubGFiZWwgPz8gJyc7XG5cdFx0XHRjb25zdCBzYW5lU29ydExhYmVsID0gcGFyc2VMYWJlbFdpdGhJY29ucyhzYW5lTGFiZWwpLnRleHQudHJpbSgpO1xuXG5cdFx0XHRjb25zdCBzYW5lQXJpYUxhYmVsID0gbWFpbkl0ZW0uYXJpYUxhYmVsIHx8IFtzYW5lTGFiZWwsIHRoaXMuc2FuZURlc2NyaXB0aW9uLCB0aGlzLnNhbmVEZXRhaWxdXG5cdFx0XHRcdC5tYXAocyA9PiBnZXRDb2RpY29uQXJpYUxhYmVsKHMpKVxuXHRcdFx0XHQuZmlsdGVyKHMgPT4gISFzKVxuXHRcdFx0XHQuam9pbignLCAnKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c2FuZUxhYmVsLFxuXHRcdFx0XHRzYW5lU29ydExhYmVsLFxuXHRcdFx0XHRzYW5lQXJpYUxhYmVsXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHRcdHRoaXMuX3NhbmVEZXNjcmlwdGlvbiA9IG1haW5JdGVtLmRlc2NyaXB0aW9uO1xuXHRcdHRoaXMuX3NhbmVUb29sdGlwID0gbWFpbkl0ZW0udG9vbHRpcDtcblx0fVxuXG5cdC8vICNyZWdpb24gTGF6eSBHZXR0ZXJzXG5cblx0Z2V0IHNhbmVMYWJlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5faW5pdC52YWx1ZS5zYW5lTGFiZWw7XG5cdH1cblx0Z2V0IHNhbmVTb3J0TGFiZWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2luaXQudmFsdWUuc2FuZVNvcnRMYWJlbDtcblx0fVxuXHRnZXQgc2FuZUFyaWFMYWJlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5faW5pdC52YWx1ZS5zYW5lQXJpYUxhYmVsO1xuXHR9XG5cblx0Ly8gI2VuZHJlZ2lvblxuXG5cdC8vICNyZWdpb24gR2V0dGVycyBhbmQgU2V0dGVyc1xuXG5cdHByaXZhdGUgX2VsZW1lbnQ/OiBIVE1MRWxlbWVudDtcblx0Z2V0IGVsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2VsZW1lbnQ7XG5cdH1cblx0c2V0IGVsZW1lbnQodmFsdWU6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fZWxlbWVudCA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGlkZGVuID0gZmFsc2U7XG5cdGdldCBoaWRkZW4oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2hpZGRlbjtcblx0fVxuXHRzZXQgaGlkZGVuKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5faGlkZGVuID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIF9zYW5lRGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdGdldCBzYW5lRGVzY3JpcHRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NhbmVEZXNjcmlwdGlvbjtcblx0fVxuXHRzZXQgc2FuZURlc2NyaXB0aW9uKHZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9zYW5lRGVzY3JpcHRpb24gPSB2YWx1ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBfc2FuZURldGFpbD86IHN0cmluZztcblx0Z2V0IHNhbmVEZXRhaWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NhbmVEZXRhaWw7XG5cdH1cblx0c2V0IHNhbmVEZXRhaWwodmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3NhbmVEZXRhaWwgPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgX3NhbmVUb29sdGlwPzogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nIHwgSFRNTEVsZW1lbnQ7XG5cdGdldCBzYW5lVG9vbHRpcCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc2FuZVRvb2x0aXA7XG5cdH1cblx0c2V0IHNhbmVUb29sdGlwKHZhbHVlOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcgfCBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3NhbmVUb29sdGlwID0gdmFsdWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2xhYmVsSGlnaGxpZ2h0cz86IElNYXRjaFtdO1xuXHRnZXQgbGFiZWxIaWdobGlnaHRzKCkge1xuXHRcdHJldHVybiB0aGlzLl9sYWJlbEhpZ2hsaWdodHM7XG5cdH1cblx0c2V0IGxhYmVsSGlnaGxpZ2h0cyh2YWx1ZTogSU1hdGNoW10gfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9sYWJlbEhpZ2hsaWdodHMgPSB2YWx1ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZGVzY3JpcHRpb25IaWdobGlnaHRzPzogSU1hdGNoW107XG5cdGdldCBkZXNjcmlwdGlvbkhpZ2hsaWdodHMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2Rlc2NyaXB0aW9uSGlnaGxpZ2h0cztcblx0fVxuXHRzZXQgZGVzY3JpcHRpb25IaWdobGlnaHRzKHZhbHVlOiBJTWF0Y2hbXSB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2Rlc2NyaXB0aW9uSGlnaGxpZ2h0cyA9IHZhbHVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9kZXRhaWxIaWdobGlnaHRzPzogSU1hdGNoW107XG5cdGdldCBkZXRhaWxIaWdobGlnaHRzKCkge1xuXHRcdHJldHVybiB0aGlzLl9kZXRhaWxIaWdobGlnaHRzO1xuXHR9XG5cdHNldCBkZXRhaWxIaWdobGlnaHRzKHZhbHVlOiBJTWF0Y2hbXSB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2RldGFpbEhpZ2hsaWdodHMgPSB2YWx1ZTtcblx0fVxufVxuXG5jbGFzcyBRdWlja1BpY2tJdGVtRWxlbWVudCBleHRlbmRzIEJhc2VRdWlja1BpY2tJdGVtRWxlbWVudCB7XG5cdHJlYWRvbmx5IG9uQ2hlY2tlZDogRXZlbnQ8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aW5kZXg6IG51bWJlcixcblx0XHRoYXNDaGVja2JveDogYm9vbGVhbixcblx0XHRyZWFkb25seSBmaXJlQnV0dG9uVHJpZ2dlcmVkOiAoZXZlbnQ6IElRdWlja1BpY2tJdGVtQnV0dG9uRXZlbnQ8SVF1aWNrUGlja0l0ZW0+KSA9PiB2b2lkLFxuXHRcdHByaXZhdGUgX29uQ2hlY2tlZDogRW1pdHRlcjx7IGVsZW1lbnQ6IElRdWlja1BpY2tFbGVtZW50OyBjaGVja2VkOiBib29sZWFuIH0+LFxuXHRcdHJlYWRvbmx5IGl0ZW06IElRdWlja1BpY2tJdGVtLFxuXHRcdHByaXZhdGUgX3NlcGFyYXRvcjogSVF1aWNrUGlja1NlcGFyYXRvciB8IHVuZGVmaW5lZCxcblx0KSB7XG5cdFx0c3VwZXIoaW5kZXgsIGhhc0NoZWNrYm94LCBpdGVtKTtcblxuXHRcdHRoaXMub25DaGVja2VkID0gaGFzQ2hlY2tib3hcblx0XHRcdD8gRXZlbnQubWFwKEV2ZW50LmZpbHRlcjx7IGVsZW1lbnQ6IElRdWlja1BpY2tFbGVtZW50OyBjaGVja2VkOiBib29sZWFuIH0+KHRoaXMuX29uQ2hlY2tlZC5ldmVudCwgZSA9PiBlLmVsZW1lbnQgPT09IHRoaXMpLCBlID0+IGUuY2hlY2tlZClcblx0XHRcdDogRXZlbnQuTm9uZTtcblxuXHRcdHRoaXMuX3NhbmVEZXRhaWwgPSBpdGVtLmRldGFpbDtcblx0XHR0aGlzLl9sYWJlbEhpZ2hsaWdodHMgPSBpdGVtLmhpZ2hsaWdodHM/LmxhYmVsO1xuXHRcdHRoaXMuX2Rlc2NyaXB0aW9uSGlnaGxpZ2h0cyA9IGl0ZW0uaGlnaGxpZ2h0cz8uZGVzY3JpcHRpb247XG5cdFx0dGhpcy5fZGV0YWlsSGlnaGxpZ2h0cyA9IGl0ZW0uaGlnaGxpZ2h0cz8uZGV0YWlsO1xuXHR9XG5cblx0Z2V0IHNlcGFyYXRvcigpIHtcblx0XHRyZXR1cm4gdGhpcy5fc2VwYXJhdG9yO1xuXHR9XG5cdHNldCBzZXBhcmF0b3IodmFsdWU6IElRdWlja1BpY2tTZXBhcmF0b3IgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9zZXBhcmF0b3IgPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgX2NoZWNrZWQgPSBmYWxzZTtcblx0Z2V0IGNoZWNrZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoZWNrZWQ7XG5cdH1cblx0c2V0IGNoZWNrZWQodmFsdWU6IGJvb2xlYW4pIHtcblx0XHRpZiAodmFsdWUgIT09IHRoaXMuX2NoZWNrZWQpIHtcblx0XHRcdHRoaXMuX2NoZWNrZWQgPSB2YWx1ZTtcblx0XHRcdHRoaXMuX29uQ2hlY2tlZC5maXJlKHsgZWxlbWVudDogdGhpcywgY2hlY2tlZDogdmFsdWUgfSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGNoZWNrYm94RGlzYWJsZWQoKSB7XG5cdFx0cmV0dXJuICEhdGhpcy5pdGVtLmRpc2FibGVkO1xuXHR9XG59XG5cbmVudW0gUXVpY2tQaWNrU2VwYXJhdG9yRm9jdXNSZWFzb24ge1xuXHQvKipcblx0ICogTm8gaXRlbSBpcyBob3ZlcmVkIG9yIGFjdGl2ZVxuXHQgKi9cblx0Tk9ORSA9IDAsXG5cdC8qKlxuXHQgKiBTb21lIGl0ZW0gd2l0aGluIHRoaXMgc2VjdGlvbiBpcyBob3ZlcmVkXG5cdCAqL1xuXHRNT1VTRV9IT1ZFUiA9IDEsXG5cdC8qKlxuXHQgKiBTb21lIGl0ZW0gd2l0aGluIHRoaXMgc2VjdGlvbiBpcyBhY3RpdmVcblx0ICovXG5cdEFDVElWRV9JVEVNID0gMlxufVxuXG5jbGFzcyBRdWlja1BpY2tTZXBhcmF0b3JFbGVtZW50IGV4dGVuZHMgQmFzZVF1aWNrUGlja0l0ZW1FbGVtZW50IHtcblx0Y2hpbGRyZW4gPSBuZXcgQXJyYXk8UXVpY2tQaWNrSXRlbUVsZW1lbnQ+KCk7XG5cdC8qKlxuXHQgKiBJZiB0aGlzIGl0ZW0gaXMgPjAsIGl0IG1lYW5zIHRoYXQgdGhlcmUgaXMgc29tZSBpdGVtIGluIHRoZSBsaXN0IHRoYXQgaXMgZWl0aGVyOlxuXHQgKiAqIGhvdmVyZWQgb3ZlclxuXHQgKiAqIGFjdGl2ZVxuXHQgKi9cblx0Zm9jdXNJbnNpZGVTZXBhcmF0b3IgPSBRdWlja1BpY2tTZXBhcmF0b3JGb2N1c1JlYXNvbi5OT05FO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGluZGV4OiBudW1iZXIsXG5cdFx0cmVhZG9ubHkgZmlyZVNlcGFyYXRvckJ1dHRvblRyaWdnZXJlZDogKGV2ZW50OiBJUXVpY2tQaWNrU2VwYXJhdG9yQnV0dG9uRXZlbnQpID0+IHZvaWQsXG5cdFx0cmVhZG9ubHkgc2VwYXJhdG9yOiBJUXVpY2tQaWNrU2VwYXJhdG9yLFxuXHQpIHtcblx0XHRzdXBlcihpbmRleCwgZmFsc2UsIHNlcGFyYXRvcik7XG5cdH1cbn1cblxuY2xhc3MgUXVpY2tJbnB1dEl0ZW1EZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPElRdWlja1BpY2tFbGVtZW50PiB7XG5cdGdldEhlaWdodChlbGVtZW50OiBJUXVpY2tQaWNrRWxlbWVudCk6IG51bWJlciB7XG5cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnQpIHtcblx0XHRcdHJldHVybiAzMDtcblx0XHR9XG5cdFx0cmV0dXJuIGVsZW1lbnQuc2FuZURldGFpbCA/IDQ0IDogMjI7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IElRdWlja1BpY2tFbGVtZW50KTogc3RyaW5nIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFF1aWNrUGlja0l0ZW1FbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gUXVpY2tQaWNrSXRlbUVsZW1lbnRSZW5kZXJlci5JRDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnRSZW5kZXJlci5JRDtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUXVpY2tJbnB1dEFjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPElRdWlja1BpY2tFbGVtZW50PiB7XG5cblx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdxdWlja0lucHV0JywgXCJRdWljayBJbnB1dFwiKTtcblx0fVxuXG5cdGdldEFyaWFMYWJlbChlbGVtZW50OiBJUXVpY2tQaWNrRWxlbWVudCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiBlbGVtZW50LnNlcGFyYXRvcj8ubGFiZWxcblx0XHRcdD8gYCR7ZWxlbWVudC5zYW5lQXJpYUxhYmVsfSwgJHtlbGVtZW50LnNlcGFyYXRvci5sYWJlbH1gXG5cdFx0XHQ6IGVsZW1lbnQuc2FuZUFyaWFMYWJlbDtcblx0fVxuXG5cdGdldFdpZGdldFJvbGUoKTogQXJpYVJvbGUge1xuXHRcdHJldHVybiAnbGlzdGJveCc7XG5cdH1cblxuXHRnZXRSb2xlKGVsZW1lbnQ6IElRdWlja1BpY2tFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGVsZW1lbnQuaGFzQ2hlY2tib3ggPyAnY2hlY2tib3gnIDogJ29wdGlvbic7XG5cdH1cblxuXHRpc0NoZWNrZWQoZWxlbWVudDogSVF1aWNrUGlja0VsZW1lbnQpOiBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQ8Ym9vbGVhbj4gfCB1bmRlZmluZWQge1xuXHRcdGlmICghZWxlbWVudC5oYXNDaGVja2JveCB8fCAhKGVsZW1lbnQgaW5zdGFuY2VvZiBRdWlja1BpY2tJdGVtRWxlbWVudCkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGdldCB2YWx1ZSgpIHsgcmV0dXJuIGVsZW1lbnQuY2hlY2tlZDsgfSxcblx0XHRcdG9uRGlkQ2hhbmdlOiBlID0+IGVsZW1lbnQub25DaGVja2VkKCgpID0+IGUoKSksXG5cdFx0fTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBCYXNlUXVpY2tJbnB1dExpc3RSZW5kZXJlcjxUIGV4dGVuZHMgSVF1aWNrUGlja0VsZW1lbnQ+IGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxULCB2b2lkLCBJUXVpY2tJbnB1dEl0ZW1UZW1wbGF0ZURhdGE+IHtcblx0YWJzdHJhY3QgdGVtcGxhdGVJZDogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGUgfCB1bmRlZmluZWRcblx0KSB7IH1cblxuXHQvLyBUT0RPOiBvbmx5IGRvIHRoZSBjb21tb24gc3R1ZmYgaGVyZSBhbmQgaGF2ZSBhIHN1YmNsYXNzIGhhbmRsZSB0aGVpciBzcGVjaWZpYyBzdHVmZlxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVF1aWNrSW5wdXRJdGVtVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBkYXRhOiBJUXVpY2tJbnB1dEl0ZW1UZW1wbGF0ZURhdGEgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGRhdGEudG9EaXNwb3NlRWxlbWVudCA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRkYXRhLnRvRGlzcG9zZVRlbXBsYXRlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRhdGEuZW50cnkgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnF1aWNrLWlucHV0LWxpc3QtZW50cnknKSk7XG5cblx0XHQvLyBDaGVja2JveFxuXHRcdGNvbnN0IGxhYmVsID0gZG9tLmFwcGVuZChkYXRhLmVudHJ5LCAkKCdsYWJlbC5xdWljay1pbnB1dC1saXN0LWxhYmVsJykpO1xuXHRcdGRhdGEudG9EaXNwb3NlVGVtcGxhdGUuYWRkKGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihsYWJlbCwgZG9tLkV2ZW50VHlwZS5DTElDSywgZSA9PiB7XG5cdFx0XHRpZiAoIWRhdGEuY2hlY2tib3gub2Zmc2V0UGFyZW50KSB7IC8vIElmIGNoZWNrYm94IG5vdCB2aXNpYmxlOlxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7IC8vIFByZXZlbnQgdG9nZ2xlIG9mIGNoZWNrYm94IHdoZW4gaXQgaXMgaW1tZWRpYXRlbHkgc2hvd24gYWZ0ZXJ3YXJkcy4gIzkxNzQwXG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRhdGEuY2hlY2tib3ggPSA8SFRNTElucHV0RWxlbWVudD5kb20uYXBwZW5kKGxhYmVsLCAkKCdpbnB1dC5xdWljay1pbnB1dC1saXN0LWNoZWNrYm94JykpO1xuXHRcdGRhdGEuY2hlY2tib3gudHlwZSA9ICdjaGVja2JveCc7XG5cblx0XHQvLyBSb3dzXG5cdFx0Y29uc3Qgcm93cyA9IGRvbS5hcHBlbmQobGFiZWwsICQoJy5xdWljay1pbnB1dC1saXN0LXJvd3MnKSk7XG5cdFx0Y29uc3Qgcm93MSA9IGRvbS5hcHBlbmQocm93cywgJCgnLnF1aWNrLWlucHV0LWxpc3Qtcm93JykpO1xuXHRcdGNvbnN0IHJvdzIgPSBkb20uYXBwZW5kKHJvd3MsICQoJy5xdWljay1pbnB1dC1saXN0LXJvdycpKTtcblxuXHRcdC8vIExhYmVsXG5cdFx0ZGF0YS5sYWJlbCA9IG5ldyBJY29uTGFiZWwocm93MSwgeyBzdXBwb3J0SGlnaGxpZ2h0czogdHJ1ZSwgc3VwcG9ydERlc2NyaXB0aW9uSGlnaGxpZ2h0czogdHJ1ZSwgc3VwcG9ydEljb25zOiB0cnVlLCBob3ZlckRlbGVnYXRlOiB0aGlzLmhvdmVyRGVsZWdhdGUgfSk7XG5cdFx0ZGF0YS50b0Rpc3Bvc2VUZW1wbGF0ZS5hZGQoZGF0YS5sYWJlbCk7XG5cdFx0ZGF0YS5pY29uID0gPEhUTUxJbnB1dEVsZW1lbnQ+ZG9tLnByZXBlbmQoZGF0YS5sYWJlbC5lbGVtZW50LCAkKCcucXVpY2staW5wdXQtbGlzdC1pY29uJykpO1xuXG5cdFx0Ly8gS2V5YmluZGluZ1xuXHRcdGNvbnN0IGtleWJpbmRpbmdDb250YWluZXIgPSBkb20uYXBwZW5kKHJvdzEsICQoJy5xdWljay1pbnB1dC1saXN0LWVudHJ5LWtleWJpbmRpbmcnKSk7XG5cdFx0ZGF0YS5rZXliaW5kaW5nID0gbmV3IEtleWJpbmRpbmdMYWJlbChrZXliaW5kaW5nQ29udGFpbmVyLCBPUyk7XG5cdFx0ZGF0YS50b0Rpc3Bvc2VUZW1wbGF0ZS5hZGQoZGF0YS5rZXliaW5kaW5nKTtcblxuXHRcdC8vIERldGFpbFxuXHRcdGNvbnN0IGRldGFpbENvbnRhaW5lciA9IGRvbS5hcHBlbmQocm93MiwgJCgnLnF1aWNrLWlucHV0LWxpc3QtbGFiZWwtbWV0YScpKTtcblx0XHRkYXRhLmRldGFpbCA9IG5ldyBJY29uTGFiZWwoZGV0YWlsQ29udGFpbmVyLCB7IHN1cHBvcnRIaWdobGlnaHRzOiB0cnVlLCBzdXBwb3J0SWNvbnM6IHRydWUsIGhvdmVyRGVsZWdhdGU6IHRoaXMuaG92ZXJEZWxlZ2F0ZSB9KTtcblx0XHRkYXRhLnRvRGlzcG9zZVRlbXBsYXRlLmFkZChkYXRhLmRldGFpbCk7XG5cblx0XHQvLyBTZXBhcmF0b3Jcblx0XHRkYXRhLnNlcGFyYXRvciA9IGRvbS5hcHBlbmQoZGF0YS5lbnRyeSwgJCgnLnF1aWNrLWlucHV0LWxpc3Qtc2VwYXJhdG9yJykpO1xuXG5cdFx0Ly8gQWN0aW9uc1xuXHRcdGRhdGEuYWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcihkYXRhLmVudHJ5LCB0aGlzLmhvdmVyRGVsZWdhdGUgPyB7IGhvdmVyRGVsZWdhdGU6IHRoaXMuaG92ZXJEZWxlZ2F0ZSB9IDogdW5kZWZpbmVkKTtcblx0XHRkYXRhLmFjdGlvbkJhci5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3F1aWNrLWlucHV0LWxpc3QtZW50cnktYWN0aW9uLWJhcicpO1xuXHRcdGRhdGEudG9EaXNwb3NlVGVtcGxhdGUuYWRkKGRhdGEuYWN0aW9uQmFyKTtcblxuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKGRhdGE6IElRdWlja0lucHV0SXRlbVRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEudG9EaXNwb3NlRWxlbWVudC5kaXNwb3NlKCk7XG5cdFx0ZGF0YS50b0Rpc3Bvc2VUZW1wbGF0ZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChfZWxlbWVudDogSVRyZWVOb2RlPElRdWlja1BpY2tFbGVtZW50LCB2b2lkPiwgX2luZGV4OiBudW1iZXIsIGRhdGE6IElRdWlja0lucHV0SXRlbVRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGRhdGEudG9EaXNwb3NlRWxlbWVudC5jbGVhcigpO1xuXHRcdGRhdGEuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdH1cblxuXHQvLyBUT0RPOiBvbmx5IGRvIHRoZSBjb21tb24gc3R1ZmYgaGVyZSBhbmQgaGF2ZSBhIHN1YmNsYXNzIGhhbmRsZSB0aGVpciBzcGVjaWZpYyBzdHVmZlxuXHRhYnN0cmFjdCByZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxJUXVpY2tQaWNrRWxlbWVudCwgdm9pZD4sIGluZGV4OiBudW1iZXIsIGRhdGE6IElRdWlja0lucHV0SXRlbVRlbXBsYXRlRGF0YSk6IHZvaWQ7XG59XG5cbmNsYXNzIFF1aWNrUGlja0l0ZW1FbGVtZW50UmVuZGVyZXIgZXh0ZW5kcyBCYXNlUXVpY2tJbnB1dExpc3RSZW5kZXJlcjxRdWlja1BpY2tJdGVtRWxlbWVudD4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAncXVpY2twaWNraXRlbSc7XG5cblx0Ly8gRm9sbG93IHdoYXQgd2UgZG8gaW4gdGhlIHNlcGFyYXRvciByZW5kZXJlclxuXHRwcml2YXRlIHJlYWRvbmx5IF9pdGVtc1dpdGhTZXBhcmF0b3JzRnJlcXVlbmN5ID0gbmV3IE1hcDxRdWlja1BpY2tJdGVtRWxlbWVudCwgbnVtYmVyPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGhvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlIHwgdW5kZWZpbmVkLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihob3ZlckRlbGVnYXRlKTtcblx0fVxuXG5cdGdldCB0ZW1wbGF0ZUlkKCkge1xuXHRcdHJldHVybiBRdWlja1BpY2tJdGVtRWxlbWVudFJlbmRlcmVyLklEO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElRdWlja0lucHV0SXRlbVRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGF0YSA9IHN1cGVyLnJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcik7XG5cblx0XHRkYXRhLnRvRGlzcG9zZVRlbXBsYXRlLmFkZChkb20uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoZGF0YS5jaGVja2JveCwgZG9tLkV2ZW50VHlwZS5DSEFOR0UsIGUgPT4ge1xuXHRcdFx0KGRhdGEuZWxlbWVudCBhcyBRdWlja1BpY2tJdGVtRWxlbWVudCkuY2hlY2tlZCA9IGRhdGEuY2hlY2tib3guY2hlY2tlZDtcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPFF1aWNrUGlja0l0ZW1FbGVtZW50LCB2b2lkPiwgaW5kZXg6IG51bWJlciwgZGF0YTogSVF1aWNrSW5wdXRJdGVtVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IG5vZGUuZWxlbWVudDtcblx0XHRkYXRhLmVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdGVsZW1lbnQuZWxlbWVudCA9IGRhdGEuZW50cnkgPz8gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1haW5JdGVtOiBJUXVpY2tQaWNrSXRlbSA9IGVsZW1lbnQuaXRlbTtcblxuXHRcdGVsZW1lbnQuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdpbmRlbnRlZCcsIEJvb2xlYW4obWFpbkl0ZW0uaW5kZW50ZWQpKTtcblx0XHRlbGVtZW50LmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbm90LXBpY2thYmxlJywgZWxlbWVudC5pdGVtLnBpY2thYmxlID09PSBmYWxzZSk7XG5cblx0XHRkYXRhLmNoZWNrYm94LmNoZWNrZWQgPSBlbGVtZW50LmNoZWNrZWQ7XG5cdFx0ZGF0YS50b0Rpc3Bvc2VFbGVtZW50LmFkZChlbGVtZW50Lm9uQ2hlY2tlZChjaGVja2VkID0+IGRhdGEuY2hlY2tib3guY2hlY2tlZCA9IGNoZWNrZWQpKTtcblx0XHRkYXRhLmNoZWNrYm94LmRpc2FibGVkID0gZWxlbWVudC5jaGVja2JveERpc2FibGVkO1xuXG5cdFx0Y29uc3QgeyBsYWJlbEhpZ2hsaWdodHMsIGRlc2NyaXB0aW9uSGlnaGxpZ2h0cywgZGV0YWlsSGlnaGxpZ2h0cyB9ID0gZWxlbWVudDtcblxuXHRcdC8vIEljb25cblx0XHRpZiAobWFpbkl0ZW0uaWNvblBhdGgpIHtcblx0XHRcdGNvbnN0IGljb24gPSBpc0RhcmsodGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLnR5cGUpID8gbWFpbkl0ZW0uaWNvblBhdGguZGFyayA6IChtYWluSXRlbS5pY29uUGF0aC5saWdodCA/PyBtYWluSXRlbS5pY29uUGF0aC5kYXJrKTtcblx0XHRcdGNvbnN0IGljb25VcmwgPSBVUkkucmV2aXZlKGljb24pO1xuXHRcdFx0ZGF0YS5pY29uLmNsYXNzTmFtZSA9ICdxdWljay1pbnB1dC1saXN0LWljb24nO1xuXHRcdFx0ZGF0YS5pY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGNzc0pzLmFzQ1NTVXJsKGljb25VcmwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLmljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7XG5cdFx0XHRkYXRhLmljb24uY2xhc3NOYW1lID0gbWFpbkl0ZW0uaWNvbkNsYXNzID8gYHF1aWNrLWlucHV0LWxpc3QtaWNvbiAke21haW5JdGVtLmljb25DbGFzc31gIDogJyc7XG5cdFx0fVxuXG5cdFx0Ly8gTGFiZWxcblx0XHRsZXQgZGVzY3JpcHRpb25UaXRsZTogSU1hbmFnZWRIb3ZlclRvb2x0aXBNYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHQvLyBpZiB3ZSBoYXZlIGEgdG9vbHRpcCwgdGhhdCB3aWxsIGJlIHRoZSBob3Zlcixcblx0XHQvLyB3aXRoIHRoZSBzYW5lRGVzY3JpcHRpb24gYXMgZmFsbGJhY2sgaWYgaXRcblx0XHQvLyBpcyBkZWZpbmVkXG5cdFx0aWYgKCFlbGVtZW50LnNhbmVUb29sdGlwICYmIGVsZW1lbnQuc2FuZURlc2NyaXB0aW9uKSB7XG5cdFx0XHRkZXNjcmlwdGlvblRpdGxlID0ge1xuXHRcdFx0XHRtYXJrZG93bjoge1xuXHRcdFx0XHRcdHZhbHVlOiBlc2NhcGUoZWxlbWVudC5zYW5lRGVzY3JpcHRpb24pLFxuXHRcdFx0XHRcdHN1cHBvcnRUaGVtZUljb25zOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdG1hcmtkb3duTm90U3VwcG9ydGVkRmFsbGJhY2s6IGVsZW1lbnQuc2FuZURlc2NyaXB0aW9uXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRjb25zdCBvcHRpb25zOiBJSWNvbkxhYmVsVmFsdWVPcHRpb25zID0ge1xuXHRcdFx0bWF0Y2hlczogbGFiZWxIaWdobGlnaHRzIHx8IFtdLFxuXHRcdFx0Ly8gSWYgd2UgaGF2ZSBhIHRvb2x0aXAsIHdlIHdhbnQgdGhhdCB0byBiZSBzaG93biBhbmQgbm90IGFueSBvdGhlciBob3ZlclxuXHRcdFx0ZGVzY3JpcHRpb25UaXRsZSxcblx0XHRcdGRlc2NyaXB0aW9uTWF0Y2hlczogZGVzY3JpcHRpb25IaWdobGlnaHRzIHx8IFtdLFxuXHRcdFx0bGFiZWxFc2NhcGVOZXdMaW5lczogdHJ1ZVxuXHRcdH07XG5cdFx0b3B0aW9ucy5leHRyYUNsYXNzZXMgPSBtYWluSXRlbS5pY29uQ2xhc3Nlcztcblx0XHRvcHRpb25zLml0YWxpYyA9IG1haW5JdGVtLml0YWxpYztcblx0XHRvcHRpb25zLnN0cmlrZXRocm91Z2ggPSBtYWluSXRlbS5zdHJpa2V0aHJvdWdoO1xuXHRcdGRhdGEuZW50cnkuY2xhc3NMaXN0LnJlbW92ZSgncXVpY2staW5wdXQtbGlzdC1zZXBhcmF0b3ItYXMtaXRlbScpO1xuXHRcdGRhdGEubGFiZWwuc2V0TGFiZWwoZWxlbWVudC5zYW5lTGFiZWwsIGVsZW1lbnQuc2FuZURlc2NyaXB0aW9uLCBvcHRpb25zKTtcblxuXHRcdC8vIEtleWJpbmRpbmdcblx0XHRkYXRhLmtleWJpbmRpbmcuc2V0KG1haW5JdGVtLmtleWJpbmRpbmcpO1xuXG5cdFx0Ly8gRGV0YWlsXG5cdFx0aWYgKGVsZW1lbnQuc2FuZURldGFpbCkge1xuXHRcdFx0bGV0IHRpdGxlOiBJTWFuYWdlZEhvdmVyVG9vbHRpcE1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0Ly8gSWYgd2UgaGF2ZSBhIHRvb2x0aXAsIHdlIHdhbnQgdGhhdCB0byBiZSBzaG93biBhbmQgbm90IGFueSBvdGhlciBob3ZlclxuXHRcdFx0aWYgKCFlbGVtZW50LnNhbmVUb29sdGlwKSB7XG5cdFx0XHRcdHRpdGxlID0ge1xuXHRcdFx0XHRcdG1hcmtkb3duOiB7XG5cdFx0XHRcdFx0XHR2YWx1ZTogZXNjYXBlKGVsZW1lbnQuc2FuZURldGFpbCksXG5cdFx0XHRcdFx0XHRzdXBwb3J0VGhlbWVJY29uczogdHJ1ZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bWFya2Rvd25Ob3RTdXBwb3J0ZWRGYWxsYmFjazogZWxlbWVudC5zYW5lRGV0YWlsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRkYXRhLmRldGFpbC5lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHRcdGRhdGEuZGV0YWlsLnNldExhYmVsKGVsZW1lbnQuc2FuZURldGFpbCwgdW5kZWZpbmVkLCB7XG5cdFx0XHRcdG1hdGNoZXM6IGRldGFpbEhpZ2hsaWdodHMsXG5cdFx0XHRcdHRpdGxlLFxuXHRcdFx0XHRsYWJlbEVzY2FwZU5ld0xpbmVzOiB0cnVlXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGF0YS5kZXRhaWwuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblxuXHRcdC8vIFNlcGFyYXRvclxuXHRcdGlmIChlbGVtZW50LnNlcGFyYXRvcj8ubGFiZWwpIHtcblx0XHRcdGRhdGEuc2VwYXJhdG9yLnRleHRDb250ZW50ID0gZWxlbWVudC5zZXBhcmF0b3IubGFiZWw7XG5cdFx0XHRkYXRhLnNlcGFyYXRvci5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0XHR0aGlzLmFkZEl0ZW1XaXRoU2VwYXJhdG9yKGVsZW1lbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLnNlcGFyYXRvci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblx0XHRkYXRhLmVudHJ5LmNsYXNzTGlzdC50b2dnbGUoJ3F1aWNrLWlucHV0LWxpc3Qtc2VwYXJhdG9yLWJvcmRlcicsICEhZWxlbWVudC5zZXBhcmF0b3IpO1xuXG5cdFx0Ly8gQWN0aW9uc1xuXHRcdGNvbnN0IGJ1dHRvbnMgPSBtYWluSXRlbS5idXR0b25zO1xuXHRcdGlmIChidXR0b25zICYmIGJ1dHRvbnMubGVuZ3RoKSB7XG5cdFx0XHRkYXRhLmFjdGlvbkJhci5wdXNoKGJ1dHRvbnMubWFwKChidXR0b24sIGluZGV4KSA9PiBxdWlja0lucHV0QnV0dG9uVG9BY3Rpb24oXG5cdFx0XHRcdGJ1dHRvbixcblx0XHRcdFx0YGlkLSR7aW5kZXh9YCxcblx0XHRcdFx0KCkgPT4gZWxlbWVudC5maXJlQnV0dG9uVHJpZ2dlcmVkKHsgYnV0dG9uLCBpdGVtOiBlbGVtZW50Lml0ZW0gfSlcblx0XHRcdCkpLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHRcdGRhdGEuZW50cnkuY2xhc3NMaXN0LmFkZCgnaGFzLWFjdGlvbnMnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGF0YS5lbnRyeS5jbGFzc0xpc3QucmVtb3ZlKCdoYXMtYWN0aW9ucycpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxRdWlja1BpY2tJdGVtRWxlbWVudCwgdm9pZD4sIF9pbmRleDogbnVtYmVyLCBkYXRhOiBJUXVpY2tJbnB1dEl0ZW1UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0aGlzLnJlbW92ZUl0ZW1XaXRoU2VwYXJhdG9yKGVsZW1lbnQuZWxlbWVudCk7XG5cdFx0c3VwZXIuZGlzcG9zZUVsZW1lbnQoZWxlbWVudCwgX2luZGV4LCBkYXRhKTtcblx0fVxuXG5cdGlzSXRlbVdpdGhTZXBhcmF0b3JWaXNpYmxlKGl0ZW06IFF1aWNrUGlja0l0ZW1FbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2l0ZW1zV2l0aFNlcGFyYXRvcnNGcmVxdWVuY3kuaGFzKGl0ZW0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRJdGVtV2l0aFNlcGFyYXRvcihpdGVtOiBRdWlja1BpY2tJdGVtRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuX2l0ZW1zV2l0aFNlcGFyYXRvcnNGcmVxdWVuY3kuc2V0KGl0ZW0sICh0aGlzLl9pdGVtc1dpdGhTZXBhcmF0b3JzRnJlcXVlbmN5LmdldChpdGVtKSB8fCAwKSArIDEpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVJdGVtV2l0aFNlcGFyYXRvcihpdGVtOiBRdWlja1BpY2tJdGVtRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGZyZXF1ZW5jeSA9IHRoaXMuX2l0ZW1zV2l0aFNlcGFyYXRvcnNGcmVxdWVuY3kuZ2V0KGl0ZW0pIHx8IDA7XG5cdFx0aWYgKGZyZXF1ZW5jeSA+IDEpIHtcblx0XHRcdHRoaXMuX2l0ZW1zV2l0aFNlcGFyYXRvcnNGcmVxdWVuY3kuc2V0KGl0ZW0sIGZyZXF1ZW5jeSAtIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9pdGVtc1dpdGhTZXBhcmF0b3JzRnJlcXVlbmN5LmRlbGV0ZShpdGVtKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudFJlbmRlcmVyIGV4dGVuZHMgQmFzZVF1aWNrSW5wdXRMaXN0UmVuZGVyZXI8UXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudD4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAncXVpY2twaWNrc2VwYXJhdG9yJztcblxuXHQvLyBUaGlzIGlzIGEgZnJlcXVlbmN5IG1hcCBiZWNhdXNlIHN0aWNreSBzY3JvbGwgcmUtdXNlcyB0aGUgc2FtZSByZW5kZXJlciB0byByZW5kZXIgYSBzZWNvbmRcblx0Ly8gaW5zdGFuY2Ugb2YgdGhlIHNhbWUgc2VwYXJhdG9yLlxuXHRwcml2YXRlIHJlYWRvbmx5IF92aXNpYmxlU2VwYXJhdG9yc0ZyZXF1ZW5jeSA9IG5ldyBNYXA8UXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudCwgbnVtYmVyPigpO1xuXG5cdGdldCB0ZW1wbGF0ZUlkKCkge1xuXHRcdHJldHVybiBRdWlja1BpY2tTZXBhcmF0b3JFbGVtZW50UmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRnZXQgdmlzaWJsZVNlcGFyYXRvcnMoKTogUXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudFtdIHtcblx0XHRyZXR1cm4gWy4uLnRoaXMuX3Zpc2libGVTZXBhcmF0b3JzRnJlcXVlbmN5LmtleXMoKV07XG5cdH1cblxuXHRpc1NlcGFyYXRvclZpc2libGUoc2VwYXJhdG9yOiBRdWlja1BpY2tTZXBhcmF0b3JFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Zpc2libGVTZXBhcmF0b3JzRnJlcXVlbmN5LmhhcyhzZXBhcmF0b3IpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElRdWlja0lucHV0SXRlbVRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGF0YSA9IHN1cGVyLnJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcik7XG5cdFx0ZGF0YS5jaGVja2JveC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8UXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudCwgdm9pZD4sIGluZGV4OiBudW1iZXIsIGRhdGE6IElRdWlja0lucHV0SXRlbVRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBub2RlLmVsZW1lbnQ7XG5cdFx0ZGF0YS5lbGVtZW50ID0gZWxlbWVudDtcblx0XHRlbGVtZW50LmVsZW1lbnQgPSBkYXRhLmVudHJ5ID8/IHVuZGVmaW5lZDtcblx0XHRlbGVtZW50LmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnZm9jdXMtaW5zaWRlJywgISFlbGVtZW50LmZvY3VzSW5zaWRlU2VwYXJhdG9yKTtcblx0XHRjb25zdCBtYWluSXRlbTogSVF1aWNrUGlja1NlcGFyYXRvciA9IGVsZW1lbnQuc2VwYXJhdG9yO1xuXG5cdFx0Y29uc3QgeyBsYWJlbEhpZ2hsaWdodHMsIGRlc2NyaXB0aW9uSGlnaGxpZ2h0cyB9ID0gZWxlbWVudDtcblxuXHRcdC8vIEljb25cblx0XHRkYXRhLmljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7XG5cdFx0ZGF0YS5pY29uLmNsYXNzTmFtZSA9ICcnO1xuXG5cdFx0Ly8gTGFiZWxcblx0XHRsZXQgZGVzY3JpcHRpb25UaXRsZTogSU1hbmFnZWRIb3ZlclRvb2x0aXBNYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHQvLyBpZiB3ZSBoYXZlIGEgdG9vbHRpcCwgdGhhdCB3aWxsIGJlIHRoZSBob3Zlcixcblx0XHQvLyB3aXRoIHRoZSBzYW5lRGVzY3JpcHRpb24gYXMgZmFsbGJhY2sgaWYgaXRcblx0XHQvLyBpcyBkZWZpbmVkXG5cdFx0aWYgKCFlbGVtZW50LnNhbmVUb29sdGlwICYmIGVsZW1lbnQuc2FuZURlc2NyaXB0aW9uKSB7XG5cdFx0XHRkZXNjcmlwdGlvblRpdGxlID0ge1xuXHRcdFx0XHRtYXJrZG93bjoge1xuXHRcdFx0XHRcdHZhbHVlOiBlc2NhcGUoZWxlbWVudC5zYW5lRGVzY3JpcHRpb24pLFxuXHRcdFx0XHRcdHN1cHBvcnRUaGVtZUljb25zOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdG1hcmtkb3duTm90U3VwcG9ydGVkRmFsbGJhY2s6IGVsZW1lbnQuc2FuZURlc2NyaXB0aW9uXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRjb25zdCBvcHRpb25zOiBJSWNvbkxhYmVsVmFsdWVPcHRpb25zID0ge1xuXHRcdFx0bWF0Y2hlczogbGFiZWxIaWdobGlnaHRzIHx8IFtdLFxuXHRcdFx0Ly8gSWYgd2UgaGF2ZSBhIHRvb2x0aXAsIHdlIHdhbnQgdGhhdCB0byBiZSBzaG93biBhbmQgbm90IGFueSBvdGhlciBob3ZlclxuXHRcdFx0ZGVzY3JpcHRpb25UaXRsZSxcblx0XHRcdGRlc2NyaXB0aW9uTWF0Y2hlczogZGVzY3JpcHRpb25IaWdobGlnaHRzIHx8IFtdLFxuXHRcdFx0bGFiZWxFc2NhcGVOZXdMaW5lczogdHJ1ZVxuXHRcdH07XG5cdFx0ZGF0YS5lbnRyeS5jbGFzc0xpc3QuYWRkKCdxdWljay1pbnB1dC1saXN0LXNlcGFyYXRvci1hcy1pdGVtJyk7XG5cdFx0ZGF0YS5sYWJlbC5zZXRMYWJlbChlbGVtZW50LnNhbmVMYWJlbCwgZWxlbWVudC5zYW5lRGVzY3JpcHRpb24sIG9wdGlvbnMpO1xuXG5cdFx0Ly8gU2VwYXJhdG9yXG5cdFx0ZGF0YS5zZXBhcmF0b3Iuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRkYXRhLmVudHJ5LmNsYXNzTGlzdC5hZGQoJ3F1aWNrLWlucHV0LWxpc3Qtc2VwYXJhdG9yLWJvcmRlcicpO1xuXG5cdFx0Ly8gQWN0aW9uc1xuXHRcdGNvbnN0IGJ1dHRvbnMgPSBtYWluSXRlbS5idXR0b25zO1xuXHRcdGlmIChidXR0b25zICYmIGJ1dHRvbnMubGVuZ3RoKSB7XG5cdFx0XHRkYXRhLmFjdGlvbkJhci5wdXNoKGJ1dHRvbnMubWFwKChidXR0b24sIGluZGV4KSA9PiBxdWlja0lucHV0QnV0dG9uVG9BY3Rpb24oXG5cdFx0XHRcdGJ1dHRvbixcblx0XHRcdFx0YGlkLSR7aW5kZXh9YCxcblx0XHRcdFx0KCkgPT4gZWxlbWVudC5maXJlU2VwYXJhdG9yQnV0dG9uVHJpZ2dlcmVkKHsgYnV0dG9uLCBzZXBhcmF0b3I6IGVsZW1lbnQuc2VwYXJhdG9yIH0pXG5cdFx0XHQpKSwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0XHRkYXRhLmVudHJ5LmNsYXNzTGlzdC5hZGQoJ2hhcy1hY3Rpb25zJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRhdGEuZW50cnkuY2xhc3NMaXN0LnJlbW92ZSgnaGFzLWFjdGlvbnMnKTtcblx0XHR9XG5cblx0XHR0aGlzLmFkZFNlcGFyYXRvcihlbGVtZW50KTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxRdWlja1BpY2tTZXBhcmF0b3JFbGVtZW50LCB2b2lkPiwgX2luZGV4OiBudW1iZXIsIGRhdGE6IElRdWlja0lucHV0SXRlbVRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRoaXMucmVtb3ZlU2VwYXJhdG9yKGVsZW1lbnQuZWxlbWVudCk7XG5cdFx0aWYgKCF0aGlzLmlzU2VwYXJhdG9yVmlzaWJsZShlbGVtZW50LmVsZW1lbnQpKSB7XG5cdFx0XHRlbGVtZW50LmVsZW1lbnQuZWxlbWVudD8uY2xhc3NMaXN0LnJlbW92ZSgnZm9jdXMtaW5zaWRlJyk7XG5cdFx0fVxuXHRcdHN1cGVyLmRpc3Bvc2VFbGVtZW50KGVsZW1lbnQsIF9pbmRleCwgZGF0YSk7XG5cdH1cblxuXHRwcml2YXRlIGFkZFNlcGFyYXRvcihzZXBhcmF0b3I6IFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl92aXNpYmxlU2VwYXJhdG9yc0ZyZXF1ZW5jeS5zZXQoc2VwYXJhdG9yLCAodGhpcy5fdmlzaWJsZVNlcGFyYXRvcnNGcmVxdWVuY3kuZ2V0KHNlcGFyYXRvcikgfHwgMCkgKyAxKTtcblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlU2VwYXJhdG9yKHNlcGFyYXRvcjogUXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGZyZXF1ZW5jeSA9IHRoaXMuX3Zpc2libGVTZXBhcmF0b3JzRnJlcXVlbmN5LmdldChzZXBhcmF0b3IpIHx8IDA7XG5cdFx0aWYgKGZyZXF1ZW5jeSA+IDEpIHtcblx0XHRcdHRoaXMuX3Zpc2libGVTZXBhcmF0b3JzRnJlcXVlbmN5LnNldChzZXBhcmF0b3IsIGZyZXF1ZW5jeSAtIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl92aXNpYmxlU2VwYXJhdG9yc0ZyZXF1ZW5jeS5kZWxldGUoc2VwYXJhdG9yKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFF1aWNrSW5wdXRUcmVlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0Ly8jcmVnaW9uIFF1aWNrSW5wdXRUcmVlIEV2ZW50c1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uS2V5RG93biA9IG5ldyBFbWl0dGVyPFN0YW5kYXJkS2V5Ym9hcmRFdmVudD4oKTtcblx0LyoqXG5cdCAqIEV2ZW50IHRoYXQgaXMgZmlyZWQgd2hlbiB0aGUgdHJlZSByZWNlaXZlcyBhIGtleWRvd24uXG5cdCovXG5cdHJlYWRvbmx5IG9uS2V5RG93bjogRXZlbnQ8U3RhbmRhcmRLZXlib2FyZEV2ZW50PiA9IHRoaXMuX29uS2V5RG93bi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkxlYXZlID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0LyoqXG5cdCAqIEV2ZW50IHRoYXQgaXMgZmlyZWQgd2hlbiB0aGUgdHJlZSB3b3VsZCBubyBsb25nZXIgaGF2ZSBmb2N1cy5cblx0Ki9cblx0cmVhZG9ubHkgb25MZWF2ZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkxlYXZlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Zpc2libGVDb3VudE9ic2VydmFibGUgPSBvYnNlcnZhYmxlVmFsdWUoJ1Zpc2libGVDb3VudCcsIDApO1xuXHRvbkNoYW5nZWRWaXNpYmxlQ291bnQ6IEV2ZW50PG51bWJlcj4gPSBFdmVudC5mcm9tT2JzZXJ2YWJsZSh0aGlzLl92aXNpYmxlQ291bnRPYnNlcnZhYmxlLCB0aGlzLl9zdG9yZSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWxsVmlzaWJsZUNoZWNrZWRPYnNlcnZhYmxlID0gb2JzZXJ2YWJsZVZhbHVlKCdBbGxWaXNpYmxlQ2hlY2tlZCcsIGZhbHNlKTtcblx0b25DaGFuZ2VkQWxsVmlzaWJsZUNoZWNrZWQ6IEV2ZW50PGJvb2xlYW4+ID0gRXZlbnQuZnJvbU9ic2VydmFibGUodGhpcy5fYWxsVmlzaWJsZUNoZWNrZWRPYnNlcnZhYmxlLCB0aGlzLl9zdG9yZSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2hlY2tlZENvdW50T2JzZXJ2YWJsZSA9IG9ic2VydmFibGVWYWx1ZSgnQ2hlY2tlZENvdW50JywgMCk7XG5cdG9uQ2hhbmdlZENoZWNrZWRDb3VudDogRXZlbnQ8bnVtYmVyPiA9IEV2ZW50LmZyb21PYnNlcnZhYmxlKHRoaXMuX2NoZWNrZWRDb3VudE9ic2VydmFibGUsIHRoaXMuX3N0b3JlKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGVja2VkRWxlbWVudHNPYnNlcnZhYmxlID0gb2JzZXJ2YWJsZVZhbHVlT3B0cyh7IGVxdWFsc0ZuOiBlcXVhbHMgfSwgbmV3IEFycmF5PElRdWlja1BpY2tJdGVtPigpKTtcblx0b25DaGFuZ2VkQ2hlY2tlZEVsZW1lbnRzOiBFdmVudDxJUXVpY2tQaWNrSXRlbVtdPiA9IEV2ZW50LmZyb21PYnNlcnZhYmxlKHRoaXMuX2NoZWNrZWRFbGVtZW50c09ic2VydmFibGUsIHRoaXMuX3N0b3JlKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkJ1dHRvblRyaWdnZXJlZCA9IG5ldyBFbWl0dGVyPElRdWlja1BpY2tJdGVtQnV0dG9uRXZlbnQ8SVF1aWNrUGlja0l0ZW0+PigpO1xuXHRvbkJ1dHRvblRyaWdnZXJlZCA9IHRoaXMuX29uQnV0dG9uVHJpZ2dlcmVkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uU2VwYXJhdG9yQnV0dG9uVHJpZ2dlcmVkID0gbmV3IEVtaXR0ZXI8SVF1aWNrUGlja1NlcGFyYXRvckJ1dHRvbkV2ZW50PigpO1xuXHRvblNlcGFyYXRvckJ1dHRvblRyaWdnZXJlZCA9IHRoaXMuX29uU2VwYXJhdG9yQnV0dG9uVHJpZ2dlcmVkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VsZW1lbnRDaGVja2VkID0gbmV3IEVtaXR0ZXI8eyBlbGVtZW50OiBJUXVpY2tQaWNrRWxlbWVudDsgY2hlY2tlZDogYm9vbGVhbiB9PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lbGVtZW50Q2hlY2tlZEV2ZW50QnVmZmVyZXIgPSBuZXcgRXZlbnRCdWZmZXJlcigpO1xuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgX2hhc0NoZWNrYm94ZXMgPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF90cmVlOiBXb3JrYmVuY2hPYmplY3RUcmVlPElRdWlja1BpY2tFbGVtZW50LCB2b2lkPjtcblx0cHJpdmF0ZSByZWFkb25seSBfc2VwYXJhdG9yUmVuZGVyZXI6IFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnRSZW5kZXJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfaXRlbVJlbmRlcmVyOiBRdWlja1BpY2tJdGVtRWxlbWVudFJlbmRlcmVyO1xuXHRwcml2YXRlIF9pbnB1dEVsZW1lbnRzID0gbmV3IEFycmF5PFF1aWNrUGlja0l0ZW0+KCk7XG5cdHByaXZhdGUgX2VsZW1lbnRUcmVlID0gbmV3IEFycmF5PElRdWlja1BpY2tFbGVtZW50PigpO1xuXHRwcml2YXRlIF9pdGVtRWxlbWVudHMgPSBuZXcgQXJyYXk8UXVpY2tQaWNrSXRlbUVsZW1lbnQ+KCk7XG5cdC8vIEVsZW1lbnRzIHRoYXQgYXBwbHkgdG8gdGhlIGN1cnJlbnQgc2V0IG9mIGVsZW1lbnRzXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VsZW1lbnREaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfbGFzdEhvdmVyOiBJSG92ZXJXaWRnZXQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xhc3RRdWVyeVN0cmluZzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcGFyZW50OiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIGhvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlLFxuXHRcdHByaXZhdGUgbGlua09wZW5lckRlbGVnYXRlOiAoY29udGVudDogc3RyaW5nKSA9PiB2b2lkLFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fY29udGFpbmVyID0gZG9tLmFwcGVuZCh0aGlzLnBhcmVudCwgJCgnLnF1aWNrLWlucHV0LWxpc3QnKSk7XG5cdFx0dGhpcy5fc2VwYXJhdG9yUmVuZGVyZXIgPSBuZXcgUXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudFJlbmRlcmVyKGhvdmVyRGVsZWdhdGUpO1xuXHRcdHRoaXMuX2l0ZW1SZW5kZXJlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFF1aWNrUGlja0l0ZW1FbGVtZW50UmVuZGVyZXIsIGhvdmVyRGVsZWdhdGUpO1xuXHRcdHRoaXMuX3RyZWUgPSB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFdvcmtiZW5jaE9iamVjdFRyZWU8SVF1aWNrUGlja0VsZW1lbnQsIHZvaWQ+LFxuXHRcdFx0J1F1aWNrSW5wdXQnLFxuXHRcdFx0dGhpcy5fY29udGFpbmVyLFxuXHRcdFx0bmV3IFF1aWNrSW5wdXRJdGVtRGVsZWdhdGUoKSxcblx0XHRcdFt0aGlzLl9pdGVtUmVuZGVyZXIsIHRoaXMuX3NlcGFyYXRvclJlbmRlcmVyXSxcblx0XHRcdHtcblx0XHRcdFx0ZmlsdGVyOiB7XG5cdFx0XHRcdFx0ZmlsdGVyKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBlbGVtZW50LmhpZGRlblxuXHRcdFx0XHRcdFx0XHQ/IFRyZWVWaXNpYmlsaXR5LkhpZGRlblxuXHRcdFx0XHRcdFx0XHQ6IGVsZW1lbnQgaW5zdGFuY2VvZiBRdWlja1BpY2tTZXBhcmF0b3JFbGVtZW50XG5cdFx0XHRcdFx0XHRcdFx0PyBUcmVlVmlzaWJpbGl0eS5SZWN1cnNlXG5cdFx0XHRcdFx0XHRcdFx0OiBUcmVlVmlzaWJpbGl0eS5WaXNpYmxlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNvcnRlcjoge1xuXHRcdFx0XHRcdGNvbXBhcmU6IChlbGVtZW50LCBvdGhlckVsZW1lbnQpID0+IHtcblx0XHRcdFx0XHRcdGlmICghdGhpcy5zb3J0QnlMYWJlbCB8fCAhdGhpcy5fbGFzdFF1ZXJ5U3RyaW5nKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29uc3Qgbm9ybWFsaXplZFNlYXJjaFZhbHVlID0gdGhpcy5fbGFzdFF1ZXJ5U3RyaW5nLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gY29tcGFyZUVudHJpZXMoZWxlbWVudCwgb3RoZXJFbGVtZW50LCBub3JtYWxpemVkU2VhcmNoVmFsdWUpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IFF1aWNrSW5wdXRBY2Nlc3NpYmlsaXR5UHJvdmlkZXIoKSxcblx0XHRcdFx0c2V0Um93TGluZUhlaWdodDogZmFsc2UsXG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdGhpZGVUd2lzdGllc09mQ2hpbGRsZXNzRWxlbWVudHM6IHRydWUsXG5cdFx0XHRcdHJlbmRlckluZGVudEd1aWRlczogUmVuZGVySW5kZW50R3VpZGVzLk5vbmUsXG5cdFx0XHRcdGZpbmRXaWRnZXRFbmFibGVkOiBmYWxzZSxcblx0XHRcdFx0aW5kZW50OiAwLFxuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nOiBmYWxzZSxcblx0XHRcdFx0YWxsb3dOb25Db2xsYXBzaWJsZVBhcmVudHM6IHRydWUsXG5cdFx0XHRcdGFsd2F5c0NvbnN1bWVNb3VzZVdoZWVsOiB0cnVlXG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5fdHJlZS5nZXRIVE1MRWxlbWVudCgpLmlkID0gaWQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdC8vI3JlZ2lvbiBwdWJsaWMgZ2V0dGVycy9zZXR0ZXJzXG5cblx0QG1lbW9pemVcblx0Z2V0IG9uRGlkQ2hhbmdlRm9jdXMoKSB7XG5cdFx0cmV0dXJuIEV2ZW50Lm1hcChcblx0XHRcdHRoaXMuX3RyZWUub25EaWRDaGFuZ2VGb2N1cyxcblx0XHRcdGUgPT4gZS5lbGVtZW50cy5maWx0ZXIoKGUpOiBlIGlzIFF1aWNrUGlja0l0ZW1FbGVtZW50ID0+IGUgaW5zdGFuY2VvZiBRdWlja1BpY2tJdGVtRWxlbWVudCkubWFwKGUgPT4gZS5pdGVtKSxcblx0XHRcdHRoaXMuX3N0b3JlXG5cdFx0KTtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCBvbkRpZENoYW5nZVNlbGVjdGlvbigpIHtcblx0XHRyZXR1cm4gRXZlbnQubWFwKFxuXHRcdFx0dGhpcy5fdHJlZS5vbkRpZENoYW5nZVNlbGVjdGlvbixcblx0XHRcdGUgPT4gKHtcblx0XHRcdFx0aXRlbXM6IGUuZWxlbWVudHMuZmlsdGVyKChlKTogZSBpcyBRdWlja1BpY2tJdGVtRWxlbWVudCA9PiBlIGluc3RhbmNlb2YgUXVpY2tQaWNrSXRlbUVsZW1lbnQpLm1hcChlID0+IGUuaXRlbSksXG5cdFx0XHRcdGV2ZW50OiBlLmJyb3dzZXJFdmVudFxuXHRcdFx0fSksXG5cdFx0XHR0aGlzLl9zdG9yZVxuXHRcdCk7XG5cdH1cblxuXHRnZXQgZGlzcGxheWVkKCkge1xuXHRcdHJldHVybiB0aGlzLl9jb250YWluZXIuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuXHR9XG5cblx0c2V0IGRpc3BsYXllZCh2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX2NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gdmFsdWUgPyAnJyA6ICdub25lJztcblx0fVxuXG5cdGdldCBzY3JvbGxUb3AoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3RyZWUuc2Nyb2xsVG9wO1xuXHR9XG5cblx0c2V0IHNjcm9sbFRvcChzY3JvbGxUb3A6IG51bWJlcikge1xuXHRcdHRoaXMuX3RyZWUuc2Nyb2xsVG9wID0gc2Nyb2xsVG9wO1xuXHR9XG5cblx0Z2V0IGFyaWFMYWJlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdHJlZS5hcmlhTGFiZWw7XG5cdH1cblxuXHRzZXQgYXJpYUxhYmVsKGxhYmVsOiBzdHJpbmcgfCBudWxsKSB7XG5cdFx0dGhpcy5fdHJlZS5hcmlhTGFiZWwgPSBsYWJlbCA/PyAnJztcblx0fVxuXG5cdHNldCBlbmFibGVkKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fdHJlZS5nZXRIVE1MRWxlbWVudCgpLnN0eWxlLnBvaW50ZXJFdmVudHMgPSB2YWx1ZSA/ICcnIDogJ25vbmUnO1xuXHR9XG5cblx0cHJpdmF0ZSBfbWF0Y2hPbkRlc2NyaXB0aW9uID0gZmFsc2U7XG5cdGdldCBtYXRjaE9uRGVzY3JpcHRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21hdGNoT25EZXNjcmlwdGlvbjtcblx0fVxuXHRzZXQgbWF0Y2hPbkRlc2NyaXB0aW9uKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fbWF0Y2hPbkRlc2NyaXB0aW9uID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIF9tYXRjaE9uRGV0YWlsID0gZmFsc2U7XG5cdGdldCBtYXRjaE9uRGV0YWlsKCkge1xuXHRcdHJldHVybiB0aGlzLl9tYXRjaE9uRGV0YWlsO1xuXHR9XG5cdHNldCBtYXRjaE9uRGV0YWlsKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fbWF0Y2hPbkRldGFpbCA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfbWF0Y2hPbkxhYmVsID0gdHJ1ZTtcblx0Z2V0IG1hdGNoT25MYWJlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbWF0Y2hPbkxhYmVsO1xuXHR9XG5cdHNldCBtYXRjaE9uTGFiZWwodmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9tYXRjaE9uTGFiZWwgPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgX21hdGNoT25MYWJlbE1vZGU6ICdmdXp6eScgfCAnY29udGlndW91cycgPSAnZnV6enknO1xuXHRnZXQgbWF0Y2hPbkxhYmVsTW9kZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbWF0Y2hPbkxhYmVsTW9kZTtcblx0fVxuXHRzZXQgbWF0Y2hPbkxhYmVsTW9kZSh2YWx1ZTogJ2Z1enp5JyB8ICdjb250aWd1b3VzJykge1xuXHRcdHRoaXMuX21hdGNoT25MYWJlbE1vZGUgPSB2YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgX21hdGNoT25NZXRhID0gdHJ1ZTtcblx0Z2V0IG1hdGNoT25NZXRhKCkge1xuXHRcdHJldHVybiB0aGlzLl9tYXRjaE9uTWV0YTtcblx0fVxuXHRzZXQgbWF0Y2hPbk1ldGEodmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9tYXRjaE9uTWV0YSA9IHZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfc29ydEJ5TGFiZWwgPSB0cnVlO1xuXHRnZXQgc29ydEJ5TGFiZWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NvcnRCeUxhYmVsO1xuXHR9XG5cdHNldCBzb3J0QnlMYWJlbCh2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX3NvcnRCeUxhYmVsID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIF9zaG91bGRMb29wID0gdHJ1ZTtcblx0Z2V0IHNob3VsZExvb3AoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Nob3VsZExvb3A7XG5cdH1cblx0c2V0IHNob3VsZExvb3AodmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9zaG91bGRMb29wID0gdmFsdWU7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gcmVnaXN0ZXIgbGlzdGVuZXJzXG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXJPbktleURvd24oKTtcblx0XHR0aGlzLl9yZWdpc3Rlck9uQ29udGFpbmVyQ2xpY2soKTtcblx0XHR0aGlzLl9yZWdpc3Rlck9uTW91c2VNaWRkbGVDbGljaygpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyT25UcmVlTW9kZWxDaGFuZ2VkKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXJPbkVsZW1lbnRDaGVja2VkKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXJPbkNvbnRleHRNZW51KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXJIb3Zlckxpc3RlbmVycygpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyU2VsZWN0aW9uQ2hhbmdlTGlzdGVuZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlclNlcGFyYXRvckFjdGlvblNob3dpbmdMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyT25LZXlEb3duKCkge1xuXHRcdC8vIFRPRE86IFNob3VsZCB0aGlzIGJlIGFkZGVkIGF0IGEgaGlnaGVyIGxldmVsP1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RyZWUub25LZXlEb3duKGUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0c3dpdGNoIChldmVudC5rZXlDb2RlKSB7XG5cdFx0XHRcdGNhc2UgS2V5Q29kZS5TcGFjZTpcblx0XHRcdFx0XHR0aGlzLnRvZ2dsZUNoZWNrYm94KCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX29uS2V5RG93bi5maXJlKGV2ZW50KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlck9uQ29udGFpbmVyQ2xpY2soKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9jb250YWluZXIsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGUgPT4ge1xuXHRcdFx0aWYgKGUueCB8fCBlLnkpIHsgLy8gQXZvaWQgJ2NsaWNrJyB0cmlnZ2VyZWQgYnkgJ3NwYWNlJyBvbiBjaGVja2JveC5cblx0XHRcdFx0dGhpcy5fb25MZWF2ZS5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJPbk1vdXNlTWlkZGxlQ2xpY2soKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9jb250YWluZXIsIGRvbS5FdmVudFR5cGUuQVVYQ0xJQ0ssIGUgPT4ge1xuXHRcdFx0aWYgKGUuYnV0dG9uID09PSAxKSB7XG5cdFx0XHRcdHRoaXMuX29uTGVhdmUuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyT25UcmVlTW9kZWxDaGFuZ2VkKCkge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RyZWUub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB7XG5cdFx0XHRjb25zdCB2aXNpYmxlQ291bnQgPSB0aGlzLl9pdGVtRWxlbWVudHMuZmlsdGVyKGUgPT4gIWUuaGlkZGVuKS5sZW5ndGg7XG5cdFx0XHR0aGlzLl92aXNpYmxlQ291bnRPYnNlcnZhYmxlLnNldCh2aXNpYmxlQ291bnQsIHVuZGVmaW5lZCk7XG5cdFx0XHRpZiAodGhpcy5faGFzQ2hlY2tib3hlcykge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVDaGVja2VkT2JzZXJ2YWJsZXMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlck9uRWxlbWVudENoZWNrZWQoKSB7XG5cdFx0Ly8gT25seSBmaXJlIHRoZSBsYXN0IGV2ZW50IHdoZW4gYnVmZmVyZWRcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lbGVtZW50Q2hlY2tlZEV2ZW50QnVmZmVyZXIud3JhcEV2ZW50KHRoaXMuX2VsZW1lbnRDaGVja2VkLmV2ZW50LCAoXywgZSkgPT4gZSkoXyA9PiB0aGlzLl91cGRhdGVDaGVja2VkT2JzZXJ2YWJsZXMoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJPbkNvbnRleHRNZW51KCkge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RyZWUub25Db250ZXh0TWVudShlID0+IHtcblx0XHRcdGlmIChlLmVsZW1lbnQpIHtcblx0XHRcdFx0ZS5icm93c2VyRXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0XHQvLyB3ZSB3YW50IHRvIHRyZWF0IGEgY29udGV4dCBtZW51IGV2ZW50IGFzXG5cdFx0XHRcdC8vIGEgZ2VzdHVyZSB0byBvcGVuIHRoZSBpdGVtIGF0IHRoZSBpbmRleFxuXHRcdFx0XHQvLyBzaW5jZSB3ZSBkbyBub3QgaGF2ZSBhbnkgY29udGV4dCBtZW51XG5cdFx0XHRcdC8vIHRoaXMgZW5hYmxlcyBmb3IgZXhhbXBsZSBtYWNPUyB0byBDdHJsLVxuXHRcdFx0XHQvLyBjbGljayBvbiBhbiBpdGVtIHRvIG9wZW4gaXQuXG5cdFx0XHRcdHRoaXMuX3RyZWUuc2V0U2VsZWN0aW9uKFtlLmVsZW1lbnRdKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3RlckhvdmVyTGlzdGVuZXJzKCkge1xuXHRcdGNvbnN0IGRlbGF5ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGhyb3R0bGVkRGVsYXllcih0eXBlb2YgdGhpcy5ob3ZlckRlbGVnYXRlLmRlbGF5ID09PSAnZnVuY3Rpb24nID8gdGhpcy5ob3ZlckRlbGVnYXRlLmRlbGF5KCkgOiB0aGlzLmhvdmVyRGVsZWdhdGUuZGVsYXkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90cmVlLm9uTW91c2VPdmVyKGFzeW5jIGUgPT4ge1xuXHRcdFx0Ly8gSWYgd2UgaG92ZXIgb3ZlciBhbiBhbmNob3IgZWxlbWVudCwgd2UgZG9uJ3Qgd2FudCB0byBzaG93IHRoZSBob3ZlciBiZWNhdXNlXG5cdFx0XHQvLyB0aGUgYW5jaG9yIG1heSBoYXZlIGEgdG9vbHRpcCB0aGF0IHdlIHdhbnQgdG8gc2hvdyBpbnN0ZWFkLlxuXHRcdFx0aWYgKGRvbS5pc0hUTUxBbmNob3JFbGVtZW50KGUuYnJvd3NlckV2ZW50LnRhcmdldCkpIHtcblx0XHRcdFx0ZGVsYXllci5jYW5jZWwoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKFxuXHRcdFx0XHQvLyBhbmNob3JzIGFyZSBhbiBleGNlcHRpb24gYXMgY2FsbGVkIG91dCBhYm92ZSBzbyB3ZSBza2lwIHRoZW0gaGVyZVxuXHRcdFx0XHQhKGRvbS5pc0hUTUxBbmNob3JFbGVtZW50KGUuYnJvd3NlckV2ZW50LnJlbGF0ZWRUYXJnZXQpKSAmJlxuXHRcdFx0XHQvLyBjaGVjayBpZiB0aGUgbW91c2UgaXMgc3RpbGwgb3ZlciB0aGUgc2FtZSBlbGVtZW50XG5cdFx0XHRcdGRvbS5pc0FuY2VzdG9yKGUuYnJvd3NlckV2ZW50LnJlbGF0ZWRUYXJnZXQgYXMgTm9kZSwgZS5lbGVtZW50Py5lbGVtZW50IGFzIE5vZGUpXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgZGVsYXllci50cmlnZ2VyKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRpZiAoZS5lbGVtZW50IGluc3RhbmNlb2YgUXVpY2tQaWNrSXRlbUVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdHRoaXMuc2hvd0hvdmVyKGUuZWxlbWVudCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly8gSWdub3JlIGNhbmNlbGxhdGlvbiBlcnJvcnMgZHVlIHRvIG1vdXNlIG91dFxuXHRcdFx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZSkpIHtcblx0XHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RyZWUub25Nb3VzZU91dChlID0+IHtcblx0XHRcdC8vIG9uTW91c2VPdXQgdHJpZ2dlcnMgZXZlcnkgdGltZSBhIG5ldyBlbGVtZW50IGhhcyBiZWVuIG1vdXNlZCBvdmVyXG5cdFx0XHQvLyBldmVuIGlmIGl0J3Mgb24gdGhlIHNhbWUgbGlzdCBpdGVtLiBXZSBvbmx5IHdhbnQgb25lIGV2ZW50LCBzbyB3ZVxuXHRcdFx0Ly8gY2hlY2sgaWYgdGhlIG1vdXNlIGlzIHN0aWxsIG92ZXIgdGhlIHNhbWUgZWxlbWVudC5cblx0XHRcdGlmIChkb20uaXNBbmNlc3RvcihlLmJyb3dzZXJFdmVudC5yZWxhdGVkVGFyZ2V0IGFzIE5vZGUsIGUuZWxlbWVudD8uZWxlbWVudCBhcyBOb2RlKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRkZWxheWVyLmNhbmNlbCgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWdpc3RlcidzIGZvY3VzIGNoYW5nZSBhbmQgbW91c2UgZXZlbnRzIHNvIHRoYXQgd2UgY2FuIHRyYWNrIHdoZW4gaXRlbXMgaW5zaWRlIG9mIGFcblx0ICogc2VwYXJhdG9yJ3Mgc2VjdGlvbiBhcmUgZm9jdXNlZCBvciBob3ZlcmVkIHNvIHRoYXQgd2UgY2FuIGRpc3BsYXkgdGhlIHNlcGFyYXRvcidzIGFjdGlvbnNcblx0ICovXG5cdHByaXZhdGUgX3JlZ2lzdGVyU2VwYXJhdG9yQWN0aW9uU2hvd2luZ0xpc3RlbmVycygpIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90cmVlLm9uRGlkQ2hhbmdlRm9jdXMoZSA9PiB7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBlLmVsZW1lbnRzWzBdXG5cdFx0XHRcdD8gdGhpcy5fdHJlZS5nZXRQYXJlbnRFbGVtZW50KGUuZWxlbWVudHNbMF0pIGFzIFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnRcblx0XHRcdFx0Ly8gdHJlYXQgbnVsbCBhcyBmb2N1cyBsb3N0IGFuZCB3aGVuIHdlIGhhdmUgbm8gc2VwYXJhdG9yc1xuXHRcdFx0XHQ6IG51bGw7XG5cdFx0XHRmb3IgKGNvbnN0IHNlcGFyYXRvciBvZiB0aGlzLl9zZXBhcmF0b3JSZW5kZXJlci52aXNpYmxlU2VwYXJhdG9ycykge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHNlcGFyYXRvciA9PT0gcGFyZW50O1xuXHRcdFx0XHQvLyBnZXQgYml0bmVzcyBvZiBBQ1RJVkVfSVRFTSBhbmQgY2hlY2sgaWYgaXQgY2hhbmdlZFxuXHRcdFx0XHRjb25zdCBjdXJyZW50QWN0aXZlID0gISEoc2VwYXJhdG9yLmZvY3VzSW5zaWRlU2VwYXJhdG9yICYgUXVpY2tQaWNrU2VwYXJhdG9yRm9jdXNSZWFzb24uQUNUSVZFX0lURU0pO1xuXHRcdFx0XHRpZiAoY3VycmVudEFjdGl2ZSAhPT0gdmFsdWUpIHtcblx0XHRcdFx0XHRpZiAodmFsdWUpIHtcblx0XHRcdFx0XHRcdHNlcGFyYXRvci5mb2N1c0luc2lkZVNlcGFyYXRvciB8PSBRdWlja1BpY2tTZXBhcmF0b3JGb2N1c1JlYXNvbi5BQ1RJVkVfSVRFTTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0c2VwYXJhdG9yLmZvY3VzSW5zaWRlU2VwYXJhdG9yICY9IH5RdWlja1BpY2tTZXBhcmF0b3JGb2N1c1JlYXNvbi5BQ1RJVkVfSVRFTTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLl90cmVlLnJlcmVuZGVyKHNlcGFyYXRvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdHJlZS5vbk1vdXNlT3ZlcihlID0+IHtcblx0XHRcdGNvbnN0IHBhcmVudCA9IGUuZWxlbWVudFxuXHRcdFx0XHQ/IHRoaXMuX3RyZWUuZ2V0UGFyZW50RWxlbWVudChlLmVsZW1lbnQpIGFzIFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnRcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0Zm9yIChjb25zdCBzZXBhcmF0b3Igb2YgdGhpcy5fc2VwYXJhdG9yUmVuZGVyZXIudmlzaWJsZVNlcGFyYXRvcnMpIHtcblx0XHRcdFx0aWYgKHNlcGFyYXRvciAhPT0gcGFyZW50KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgY3VycmVudE1vdXNlID0gISEoc2VwYXJhdG9yLmZvY3VzSW5zaWRlU2VwYXJhdG9yICYgUXVpY2tQaWNrU2VwYXJhdG9yRm9jdXNSZWFzb24uTU9VU0VfSE9WRVIpO1xuXHRcdFx0XHRpZiAoIWN1cnJlbnRNb3VzZSkge1xuXHRcdFx0XHRcdHNlcGFyYXRvci5mb2N1c0luc2lkZVNlcGFyYXRvciB8PSBRdWlja1BpY2tTZXBhcmF0b3JGb2N1c1JlYXNvbi5NT1VTRV9IT1ZFUjtcblx0XHRcdFx0XHR0aGlzLl90cmVlLnJlcmVuZGVyKHNlcGFyYXRvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdHJlZS5vbk1vdXNlT3V0KGUgPT4ge1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZS5lbGVtZW50XG5cdFx0XHRcdD8gdGhpcy5fdHJlZS5nZXRQYXJlbnRFbGVtZW50KGUuZWxlbWVudCkgYXMgUXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudFxuXHRcdFx0XHQ6IG51bGw7XG5cdFx0XHRmb3IgKGNvbnN0IHNlcGFyYXRvciBvZiB0aGlzLl9zZXBhcmF0b3JSZW5kZXJlci52aXNpYmxlU2VwYXJhdG9ycykge1xuXHRcdFx0XHRpZiAoc2VwYXJhdG9yICE9PSBwYXJlbnQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjdXJyZW50TW91c2UgPSAhIShzZXBhcmF0b3IuZm9jdXNJbnNpZGVTZXBhcmF0b3IgJiBRdWlja1BpY2tTZXBhcmF0b3JGb2N1c1JlYXNvbi5NT1VTRV9IT1ZFUik7XG5cdFx0XHRcdGlmIChjdXJyZW50TW91c2UpIHtcblx0XHRcdFx0XHRzZXBhcmF0b3IuZm9jdXNJbnNpZGVTZXBhcmF0b3IgJj0gflF1aWNrUGlja1NlcGFyYXRvckZvY3VzUmVhc29uLk1PVVNFX0hPVkVSO1xuXHRcdFx0XHRcdHRoaXMuX3RyZWUucmVyZW5kZXIoc2VwYXJhdG9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyU2VsZWN0aW9uQ2hhbmdlTGlzdGVuZXIoKSB7XG5cdFx0Ly8gV2hlbiB0aGUgdXNlciBzZWxlY3RzIGEgc2VwYXJhdG9yLCB0aGUgc2VwYXJhdG9yIHdpbGwgbW92ZSB0byB0aGUgdG9wIGFuZCBmb2N1cyB3aWxsIGJlXG5cdFx0Ly8gc2V0IHRvIHRoZSBmaXJzdCBlbGVtZW50IGFmdGVyIHRoZSBzZXBhcmF0b3IuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdHJlZS5vbkRpZENoYW5nZVNlbGVjdGlvbihlID0+IHtcblx0XHRcdGNvbnN0IGVsZW1lbnRzV2l0aG91dFNlcGFyYXRvcnMgPSBlLmVsZW1lbnRzLmZpbHRlcigoZSk6IGUgaXMgUXVpY2tQaWNrSXRlbUVsZW1lbnQgPT4gZSBpbnN0YW5jZW9mIFF1aWNrUGlja0l0ZW1FbGVtZW50KTtcblx0XHRcdGlmIChlbGVtZW50c1dpdGhvdXRTZXBhcmF0b3JzLmxlbmd0aCAhPT0gZS5lbGVtZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0aWYgKGUuZWxlbWVudHMubGVuZ3RoID09PSAxICYmIGUuZWxlbWVudHNbMF0gaW5zdGFuY2VvZiBRdWlja1BpY2tTZXBhcmF0b3JFbGVtZW50KSB7XG5cdFx0XHRcdFx0dGhpcy5fdHJlZS5zZXRGb2N1cyhbZS5lbGVtZW50c1swXS5jaGlsZHJlblswXV0pO1xuXHRcdFx0XHRcdHRoaXMuX3RyZWUucmV2ZWFsKGUuZWxlbWVudHNbMF0sIDApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3RyZWUuc2V0U2VsZWN0aW9uKGVsZW1lbnRzV2l0aG91dFNlcGFyYXRvcnMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBwdWJsaWMgbWV0aG9kc1xuXG5cdHNldEFsbFZpc2libGVDaGVja2VkKGNoZWNrZWQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9lbGVtZW50Q2hlY2tlZEV2ZW50QnVmZmVyZXIuYnVmZmVyRXZlbnRzKCgpID0+IHtcblx0XHRcdHRoaXMuX2l0ZW1FbGVtZW50cy5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuXHRcdFx0XHRpZiAoIWVsZW1lbnQuaGlkZGVuICYmICFlbGVtZW50LmNoZWNrYm94RGlzYWJsZWQgJiYgZWxlbWVudC5pdGVtLnBpY2thYmxlICE9PSBmYWxzZSkge1xuXHRcdFx0XHRcdC8vIFdvdWxkIGZpcmUgYW4gZXZlbnQgaWYgd2UgZGlkbid0IGJlZmZlciB0aGUgZXZlbnRzXG5cdFx0XHRcdFx0ZWxlbWVudC5jaGVja2VkID0gY2hlY2tlZDtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRzZXRFbGVtZW50cyhpbnB1dEVsZW1lbnRzOiBRdWlja1BpY2tJdGVtW10pOiB2b2lkIHtcblx0XHR0aGlzLl9lbGVtZW50RGlzcG9zYWJsZS5jbGVhcigpO1xuXHRcdHRoaXMuX2xhc3RRdWVyeVN0cmluZyA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9pbnB1dEVsZW1lbnRzID0gaW5wdXRFbGVtZW50cztcblx0XHR0aGlzLl9oYXNDaGVja2JveGVzID0gdGhpcy5wYXJlbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdzaG93LWNoZWNrYm94ZXMnKTtcblx0XHRsZXQgY3VycmVudFNlcGFyYXRvckVsZW1lbnQ6IFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5faXRlbUVsZW1lbnRzID0gbmV3IEFycmF5PFF1aWNrUGlja0l0ZW1FbGVtZW50PigpO1xuXHRcdHRoaXMuX2VsZW1lbnRUcmVlID0gaW5wdXRFbGVtZW50cy5yZWR1Y2UoKHJlc3VsdCwgaXRlbSwgaW5kZXgpID0+IHtcblx0XHRcdGxldCBlbGVtZW50OiBJUXVpY2tQaWNrRWxlbWVudDtcblx0XHRcdGlmIChpdGVtLnR5cGUgPT09ICdzZXBhcmF0b3InKSB7XG5cdFx0XHRcdGlmICghaXRlbS5idXR0b25zKSB7XG5cdFx0XHRcdFx0Ly8gVGhpcyBzZXBhcmF0b3Igd2lsbCBiZSByZW5kZXJlZCBhcyBhIHBhcnQgb2YgdGhlIGxpc3QgaXRlbVxuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y3VycmVudFNlcGFyYXRvckVsZW1lbnQgPSBuZXcgUXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudChcblx0XHRcdFx0XHRpbmRleCxcblx0XHRcdFx0XHRlID0+IHRoaXMuX29uU2VwYXJhdG9yQnV0dG9uVHJpZ2dlcmVkLmZpcmUoZSksXG5cdFx0XHRcdFx0aXRlbVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRlbGVtZW50ID0gY3VycmVudFNlcGFyYXRvckVsZW1lbnQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBwcmV2aW91cyA9IGluZGV4ID4gMCA/IGlucHV0RWxlbWVudHNbaW5kZXggLSAxXSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0bGV0IHNlcGFyYXRvcjogSVF1aWNrUGlja1NlcGFyYXRvciB8IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKHByZXZpb3VzICYmIHByZXZpb3VzLnR5cGUgPT09ICdzZXBhcmF0b3InICYmICFwcmV2aW91cy5idXR0b25zKSB7XG5cdFx0XHRcdFx0Ly8gRm91bmQgYW4gaW5saW5lIHNlcGFyYXRvciBzbyB3ZSBjbGVhciBvdXQgdGhlIGN1cnJlbnQgc2VwYXJhdG9yIGVsZW1lbnRcblx0XHRcdFx0XHRjdXJyZW50U2VwYXJhdG9yRWxlbWVudCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRzZXBhcmF0b3IgPSBwcmV2aW91cztcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBxcGkgPSBuZXcgUXVpY2tQaWNrSXRlbUVsZW1lbnQoXG5cdFx0XHRcdFx0aW5kZXgsXG5cdFx0XHRcdFx0dGhpcy5faGFzQ2hlY2tib3hlcyxcblx0XHRcdFx0XHRlID0+IHRoaXMuX29uQnV0dG9uVHJpZ2dlcmVkLmZpcmUoZSksXG5cdFx0XHRcdFx0dGhpcy5fZWxlbWVudENoZWNrZWQsXG5cdFx0XHRcdFx0aXRlbSxcblx0XHRcdFx0XHRzZXBhcmF0b3IsXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHRoaXMuX2l0ZW1FbGVtZW50cy5wdXNoKHFwaSk7XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRTZXBhcmF0b3JFbGVtZW50KSB7XG5cdFx0XHRcdFx0Y3VycmVudFNlcGFyYXRvckVsZW1lbnQuY2hpbGRyZW4ucHVzaChxcGkpO1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxlbWVudCA9IHFwaTtcblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0LnB1c2goZWxlbWVudCk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0sIG5ldyBBcnJheTxJUXVpY2tQaWNrRWxlbWVudD4oKSk7XG5cblx0XHR0aGlzLl9zZXRFbGVtZW50c1RvVHJlZSh0aGlzLl9lbGVtZW50VHJlZSk7XG5cblx0XHQvLyBBY2Nlc3NpYmlsaXR5IGhhY2ssIHVuZm9ydHVuYXRlbHkgb24gbmV4dCB0aWNrXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIxMTk3NlxuXHRcdGlmICh0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLmlzU2NyZWVuUmVhZGVyT3B0aW1pemVkKCkpIHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBmb2N1c2VkRWxlbWVudCA9IHRoaXMuX3RyZWUuZ2V0SFRNTEVsZW1lbnQoKS5xdWVyeVNlbGVjdG9yKGAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWRgKTtcblx0XHRcdFx0Y29uc3QgcGFyZW50ID0gZm9jdXNlZEVsZW1lbnQ/LnBhcmVudE5vZGU7XG5cdFx0XHRcdGlmIChmb2N1c2VkRWxlbWVudCAmJiBwYXJlbnQpIHtcblx0XHRcdFx0XHRjb25zdCBuZXh0U2libGluZyA9IGZvY3VzZWRFbGVtZW50Lm5leHRTaWJsaW5nO1xuXHRcdFx0XHRcdGZvY3VzZWRFbGVtZW50LnJlbW92ZSgpO1xuXHRcdFx0XHRcdHBhcmVudC5pbnNlcnRCZWZvcmUoZm9jdXNlZEVsZW1lbnQsIG5leHRTaWJsaW5nKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMCk7XG5cdFx0fVxuXHR9XG5cblx0c2V0Rm9jdXNlZEVsZW1lbnRzKGl0ZW1zOiBJUXVpY2tQaWNrSXRlbVtdKSB7XG5cdFx0Y29uc3QgZWxlbWVudHMgPSBpdGVtcy5tYXAoaXRlbSA9PiB0aGlzLl9pdGVtRWxlbWVudHMuZmluZChlID0+IGUuaXRlbSA9PT0gaXRlbSkpXG5cdFx0XHQuZmlsdGVyKChlKTogZSBpcyBRdWlja1BpY2tJdGVtRWxlbWVudCA9PiAhIWUpXG5cdFx0XHQuZmlsdGVyKGUgPT4gIWUuaGlkZGVuKTtcblx0XHR0aGlzLl90cmVlLnNldEZvY3VzKGVsZW1lbnRzKTtcblx0XHRpZiAoaXRlbXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgZm9jdXNlZCA9IHRoaXMuX3RyZWUuZ2V0Rm9jdXMoKVswXTtcblx0XHRcdGlmIChmb2N1c2VkKSB7XG5cdFx0XHRcdHRoaXMuX3RyZWUucmV2ZWFsKGZvY3VzZWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldEFjdGl2ZURlc2NlbmRhbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3RyZWUuZ2V0SFRNTEVsZW1lbnQoKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtYWN0aXZlZGVzY2VuZGFudCcpO1xuXHR9XG5cblx0c2V0U2VsZWN0ZWRFbGVtZW50cyhpdGVtczogSVF1aWNrUGlja0l0ZW1bXSkge1xuXHRcdGNvbnN0IGVsZW1lbnRzID0gaXRlbXMubWFwKGl0ZW0gPT4gdGhpcy5faXRlbUVsZW1lbnRzLmZpbmQoZSA9PiBlLml0ZW0gPT09IGl0ZW0pKVxuXHRcdFx0LmZpbHRlcigoZSk6IGUgaXMgUXVpY2tQaWNrSXRlbUVsZW1lbnQgPT4gISFlKTtcblx0XHR0aGlzLl90cmVlLnNldFNlbGVjdGlvbihlbGVtZW50cyk7XG5cdH1cblxuXHRnZXRDaGVja2VkRWxlbWVudHMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2l0ZW1FbGVtZW50cy5maWx0ZXIoZSA9PiBlLmNoZWNrZWQpXG5cdFx0XHQubWFwKGUgPT4gZS5pdGVtKTtcblx0fVxuXG5cdHNldENoZWNrZWRFbGVtZW50cyhpdGVtczogSVF1aWNrUGlja0l0ZW1bXSkge1xuXHRcdHRoaXMuX2VsZW1lbnRDaGVja2VkRXZlbnRCdWZmZXJlci5idWZmZXJFdmVudHMoKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2hlY2tlZCA9IG5ldyBTZXQoKTtcblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuXHRcdFx0XHRjaGVja2VkLmFkZChpdGVtKTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiB0aGlzLl9pdGVtRWxlbWVudHMpIHtcblx0XHRcdFx0Ly8gV291bGQgZmlyZSBhbiBldmVudCBpZiB3ZSBkaWRuJ3QgYmVmZmVyIHRoZSBldmVudHNcblx0XHRcdFx0ZWxlbWVudC5jaGVja2VkID0gY2hlY2tlZC5oYXMoZWxlbWVudC5pdGVtKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGZvY3VzKHdoYXQ6IFF1aWNrUGlja0ZvY3VzKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9pdGVtRWxlbWVudHMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHdoYXQgPT09IFF1aWNrUGlja0ZvY3VzLlNlY29uZCAmJiB0aGlzLl9pdGVtRWxlbWVudHMubGVuZ3RoIDwgMikge1xuXHRcdFx0d2hhdCA9IFF1aWNrUGlja0ZvY3VzLkZpcnN0O1xuXHRcdH1cblxuXHRcdHN3aXRjaCAod2hhdCkge1xuXHRcdFx0Y2FzZSBRdWlja1BpY2tGb2N1cy5GaXJzdDpcblx0XHRcdFx0dGhpcy5fdHJlZS5zY3JvbGxUb3AgPSAwO1xuXHRcdFx0XHR0aGlzLl90cmVlLmZvY3VzRmlyc3QodW5kZWZpbmVkLCAoZSkgPT4gZS5lbGVtZW50IGluc3RhbmNlb2YgUXVpY2tQaWNrSXRlbUVsZW1lbnQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUXVpY2tQaWNrRm9jdXMuU2Vjb25kOiB7XG5cdFx0XHRcdHRoaXMuX3RyZWUuc2Nyb2xsVG9wID0gMDtcblx0XHRcdFx0bGV0IGlzU2Vjb25kSXRlbSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLl90cmVlLmZvY3VzRmlyc3QodW5kZWZpbmVkLCAoZSkgPT4ge1xuXHRcdFx0XHRcdGlmICghKGUuZWxlbWVudCBpbnN0YW5jZW9mIFF1aWNrUGlja0l0ZW1FbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaXNTZWNvbmRJdGVtKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aXNTZWNvbmRJdGVtID0gIWlzU2Vjb25kSXRlbTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgUXVpY2tQaWNrRm9jdXMuTGFzdDpcblx0XHRcdFx0dGhpcy5fdHJlZS5zY3JvbGxUb3AgPSB0aGlzLl90cmVlLnNjcm9sbEhlaWdodDtcblx0XHRcdFx0dGhpcy5fdHJlZS5mb2N1c0xhc3QodW5kZWZpbmVkLCAoZSkgPT4gZS5lbGVtZW50IGluc3RhbmNlb2YgUXVpY2tQaWNrSXRlbUVsZW1lbnQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUXVpY2tQaWNrRm9jdXMuTmV4dDoge1xuXHRcdFx0XHRjb25zdCBwcmV2Rm9jdXMgPSB0aGlzLl90cmVlLmdldEZvY3VzKCk7XG5cdFx0XHRcdHRoaXMuX3RyZWUuZm9jdXNOZXh0KHVuZGVmaW5lZCwgdGhpcy5fc2hvdWxkTG9vcCwgdW5kZWZpbmVkLCAoZSkgPT4ge1xuXHRcdFx0XHRcdGlmICghKGUuZWxlbWVudCBpbnN0YW5jZW9mIFF1aWNrUGlja0l0ZW1FbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQpO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29uc3QgY3VycmVudEZvY3VzID0gdGhpcy5fdHJlZS5nZXRGb2N1cygpO1xuXHRcdFx0XHRpZiAocHJldkZvY3VzLmxlbmd0aCAmJiBwcmV2Rm9jdXNbMF0gPT09IGN1cnJlbnRGb2N1c1swXSkge1xuXHRcdFx0XHRcdHRoaXMuX29uTGVhdmUuZmlyZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBRdWlja1BpY2tGb2N1cy5QcmV2aW91czoge1xuXHRcdFx0XHRjb25zdCBwcmV2Rm9jdXMgPSB0aGlzLl90cmVlLmdldEZvY3VzKCk7XG5cdFx0XHRcdHRoaXMuX3RyZWUuZm9jdXNQcmV2aW91cyh1bmRlZmluZWQsIHRoaXMuX3Nob3VsZExvb3AsIHVuZGVmaW5lZCwgKGUpID0+IHtcblx0XHRcdFx0XHRpZiAoIShlLmVsZW1lbnQgaW5zdGFuY2VvZiBRdWlja1BpY2tJdGVtRWxlbWVudCkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgcGFyZW50ID0gdGhpcy5fdHJlZS5nZXRQYXJlbnRFbGVtZW50KGUuZWxlbWVudCk7XG5cdFx0XHRcdFx0aWYgKHBhcmVudCA9PT0gbnVsbCB8fCAocGFyZW50IGFzIFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnQpLmNoaWxkcmVuWzBdICE9PSBlLmVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3RyZWUucmV2ZWFsKGUuZWxlbWVudCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIE9ubHkgaWYgd2UgYXJlIHRoZSBmaXJzdCBjaGlsZCBvZiBhIHNlcGFyYXRvciBkbyB3ZSByZXZlYWwgdGhlIHNlcGFyYXRvclxuXHRcdFx0XHRcdFx0dGhpcy5fdHJlZS5yZXZlYWwocGFyZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjb25zdCBjdXJyZW50Rm9jdXMgPSB0aGlzLl90cmVlLmdldEZvY3VzKCk7XG5cdFx0XHRcdGlmIChwcmV2Rm9jdXMubGVuZ3RoICYmIHByZXZGb2N1c1swXSA9PT0gY3VycmVudEZvY3VzWzBdKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25MZWF2ZS5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFF1aWNrUGlja0ZvY3VzLk5leHRQYWdlOlxuXHRcdFx0XHR0aGlzLl90cmVlLmZvY3VzTmV4dFBhZ2UodW5kZWZpbmVkLCAoZSkgPT4ge1xuXHRcdFx0XHRcdGlmICghKGUuZWxlbWVudCBpbnN0YW5jZW9mIFF1aWNrUGlja0l0ZW1FbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQpO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFF1aWNrUGlja0ZvY3VzLlByZXZpb3VzUGFnZTpcblx0XHRcdFx0dGhpcy5fdHJlZS5mb2N1c1ByZXZpb3VzUGFnZSh1bmRlZmluZWQsIChlKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCEoZS5lbGVtZW50IGluc3RhbmNlb2YgUXVpY2tQaWNrSXRlbUVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHBhcmVudCA9IHRoaXMuX3RyZWUuZ2V0UGFyZW50RWxlbWVudChlLmVsZW1lbnQpO1xuXHRcdFx0XHRcdGlmIChwYXJlbnQgPT09IG51bGwgfHwgKHBhcmVudCBhcyBRdWlja1BpY2tTZXBhcmF0b3JFbGVtZW50KS5jaGlsZHJlblswXSAhPT0gZS5lbGVtZW50KSB7XG5cdFx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChwYXJlbnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBRdWlja1BpY2tGb2N1cy5OZXh0U2VwYXJhdG9yOiB7XG5cdFx0XHRcdGxldCBmb3VuZFNlcGFyYXRvckFzSXRlbSA9IGZhbHNlO1xuXHRcdFx0XHRjb25zdCBiZWZvcmUgPSB0aGlzLl90cmVlLmdldEZvY3VzKClbMF07XG5cdFx0XHRcdHRoaXMuX3RyZWUuZm9jdXNOZXh0KHVuZGVmaW5lZCwgdHJ1ZSwgdW5kZWZpbmVkLCAoZSkgPT4ge1xuXHRcdFx0XHRcdGlmIChmb3VuZFNlcGFyYXRvckFzSXRlbSkge1xuXHRcdFx0XHRcdFx0Ly8gVGhpcyBzaG91bGQgYmUgdGhlIGluZGV4IHJpZ2h0IGFmdGVyIHRoZSBzZXBhcmF0b3Igc28gaXRcblx0XHRcdFx0XHRcdC8vIGlzIHRoZSBpdGVtIHdlIHdhbnQgdG8gZm9jdXMuXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZS5lbGVtZW50IGluc3RhbmNlb2YgUXVpY2tQaWNrU2VwYXJhdG9yRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0Zm91bmRTZXBhcmF0b3JBc0l0ZW0gPSB0cnVlO1xuXHRcdFx0XHRcdFx0Ly8gSWYgdGhlIHNlcGFyYXRvciBpcyB2aXNpYmxlLCB0aGVuIHdlIHNob3VsZCBqdXN0IHJldmVhbCBpdHMgZmlyc3QgY2hpbGQgc28gaXQncyBub3QgYXMgamFycmluZy5cblx0XHRcdFx0XHRcdGlmICh0aGlzLl9zZXBhcmF0b3JSZW5kZXJlci5pc1NlcGFyYXRvclZpc2libGUoZS5lbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQuY2hpbGRyZW5bMF0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Ly8gSWYgdGhlIHNlcGFyYXRvciBpcyBub3QgdmlzaWJsZSwgdGhlbiB3ZSBzaG91bGRcblx0XHRcdFx0XHRcdFx0Ly8gcHVzaCBpdCB1cCB0byB0aGUgdG9wIG9mIHRoZSBsaXN0LlxuXHRcdFx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQsIDApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZS5lbGVtZW50IGluc3RhbmNlb2YgUXVpY2tQaWNrSXRlbUVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdGlmIChlLmVsZW1lbnQuc2VwYXJhdG9yKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLl9pdGVtUmVuZGVyZXIuaXNJdGVtV2l0aFNlcGFyYXRvclZpc2libGUoZS5lbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX3RyZWUucmV2ZWFsKGUuZWxlbWVudCk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fdHJlZS5yZXZlYWwoZS5lbGVtZW50LCAwKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoZS5lbGVtZW50ID09PSB0aGlzLl9lbGVtZW50VHJlZVswXSkge1xuXHRcdFx0XHRcdFx0XHQvLyBXZSBzaG91bGQgc3RvcCBhdCB0aGUgZmlyc3QgaXRlbSBpbiB0aGUgbGlzdCBpZiBpdCdzIGEgcmVndWxhciBpdGVtLlxuXHRcdFx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQsIDApO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29uc3QgYWZ0ZXIgPSB0aGlzLl90cmVlLmdldEZvY3VzKClbMF07XG5cdFx0XHRcdGlmIChiZWZvcmUgPT09IGFmdGVyKSB7XG5cdFx0XHRcdFx0Ly8gSWYgd2UgZGlkbid0IG1vdmUsIHRoZW4gd2Ugc2hvdWxkIGp1c3QgbW92ZSB0byB0aGUgZW5kXG5cdFx0XHRcdFx0Ly8gb2YgdGhlIGxpc3QuXG5cdFx0XHRcdFx0dGhpcy5fdHJlZS5zY3JvbGxUb3AgPSB0aGlzLl90cmVlLnNjcm9sbEhlaWdodDtcblx0XHRcdFx0XHR0aGlzLl90cmVlLmZvY3VzTGFzdCh1bmRlZmluZWQsIChlKSA9PiBlLmVsZW1lbnQgaW5zdGFuY2VvZiBRdWlja1BpY2tJdGVtRWxlbWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFF1aWNrUGlja0ZvY3VzLlByZXZpb3VzU2VwYXJhdG9yOiB7XG5cdFx0XHRcdGxldCBmb2N1c0VsZW1lbnQ6IElRdWlja1BpY2tFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRcdFx0XHQvLyBJZiB3ZSBhcmUgYWxyZWFkeSBzaXR0aW5nIG9uIGFuIGlubGluZSBzZXBhcmF0b3IsIHRoZW4gd2Vcblx0XHRcdFx0Ly8gaGF2ZSBhbHJlYWR5IGZvdW5kIHRoZSBfY3VycmVudF8gc2VwYXJhdG9yIGFuZCBuZWVkIHRvXG5cdFx0XHRcdC8vIG1vdmUgdG8gdGhlIHByZXZpb3VzIG9uZS5cblx0XHRcdFx0bGV0IGZvdW5kU2VwYXJhdG9yID0gISF0aGlzLl90cmVlLmdldEZvY3VzKClbMF0/LnNlcGFyYXRvcjtcblx0XHRcdFx0dGhpcy5fdHJlZS5mb2N1c1ByZXZpb3VzKHVuZGVmaW5lZCwgdHJ1ZSwgdW5kZWZpbmVkLCAoZSkgPT4ge1xuXHRcdFx0XHRcdGlmIChlLmVsZW1lbnQgaW5zdGFuY2VvZiBRdWlja1BpY2tTZXBhcmF0b3JFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRpZiAoZm91bmRTZXBhcmF0b3IpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCFmb2N1c0VsZW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAodGhpcy5fc2VwYXJhdG9yUmVuZGVyZXIuaXNTZXBhcmF0b3JWaXNpYmxlKGUuZWxlbWVudCkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuX3RyZWUucmV2ZWFsKGUuZWxlbWVudCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuX3RyZWUucmV2ZWFsKGUuZWxlbWVudCwgMCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGZvY3VzRWxlbWVudCA9IGUuZWxlbWVudC5jaGlsZHJlblswXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Zm91bmRTZXBhcmF0b3IgPSB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZS5lbGVtZW50IGluc3RhbmNlb2YgUXVpY2tQaWNrSXRlbUVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdGlmICghZm9jdXNFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRcdGlmIChlLmVsZW1lbnQuc2VwYXJhdG9yKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHRoaXMuX2l0ZW1SZW5kZXJlci5pc0l0ZW1XaXRoU2VwYXJhdG9yVmlzaWJsZShlLmVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQsIDApO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGZvY3VzRWxlbWVudCA9IGUuZWxlbWVudDtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmIChlLmVsZW1lbnQgPT09IHRoaXMuX2VsZW1lbnRUcmVlWzBdKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gV2Ugc2hvdWxkIHN0b3AgYXQgdGhlIGZpcnN0IGl0ZW0gaW4gdGhlIGxpc3QgaWYgaXQncyBhIHJlZ3VsYXIgaXRlbS5cblx0XHRcdFx0XHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChlLmVsZW1lbnQsIDApO1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmIChmb2N1c0VsZW1lbnQpIHtcblx0XHRcdFx0XHR0aGlzLl90cmVlLnNldEZvY3VzKFtmb2N1c0VsZW1lbnRdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRjbGVhckZvY3VzKCkge1xuXHRcdHRoaXMuX3RyZWUuc2V0Rm9jdXMoW10pO1xuXHR9XG5cblx0ZG9tRm9jdXMoKSB7XG5cdFx0dGhpcy5fdHJlZS5kb21Gb2N1cygpO1xuXHR9XG5cblx0bGF5b3V0KG1heEhlaWdodD86IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3RyZWUuZ2V0SFRNTEVsZW1lbnQoKS5zdHlsZS5tYXhIZWlnaHQgPSBtYXhIZWlnaHQgPyBgJHtcblx0XHRcdC8vIE1ha2Ugc3VyZSBoZWlnaHQgYWxpZ25zIHdpdGggbGlzdCBpdGVtIGhlaWdodHNcblx0XHRcdE1hdGguZmxvb3IobWF4SGVpZ2h0IC8gNDQpICogNDRcblx0XHRcdC8vIEFkZCBzb21lIGV4dHJhIGhlaWdodCBzbyB0aGF0IGl0J3MgY2xlYXIgdGhlcmUncyBtb3JlIHRvIHNjcm9sbFxuXHRcdFx0KyA2XG5cdFx0XHR9cHhgIDogJyc7XG5cdFx0dGhpcy5fdHJlZS5sYXlvdXQoKTtcblx0fVxuXG5cdGZpbHRlcihxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fbGFzdFF1ZXJ5U3RyaW5nID0gcXVlcnk7XG5cdFx0aWYgKCEodGhpcy5fc29ydEJ5TGFiZWwgfHwgdGhpcy5fbWF0Y2hPbkxhYmVsIHx8IHRoaXMuX21hdGNoT25EZXNjcmlwdGlvbiB8fCB0aGlzLl9tYXRjaE9uRGV0YWlsKSkge1xuXHRcdFx0dGhpcy5fdHJlZS5sYXlvdXQoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBxdWVyeVdpdGhXaGl0ZXNwYWNlID0gcXVlcnk7XG5cdFx0cXVlcnkgPSBxdWVyeS50cmltKCk7XG5cblx0XHQvLyBSZXNldCBmaWx0ZXJpbmdcblx0XHRpZiAoIXF1ZXJ5IHx8ICEodGhpcy5tYXRjaE9uTGFiZWwgfHwgdGhpcy5tYXRjaE9uRGVzY3JpcHRpb24gfHwgdGhpcy5tYXRjaE9uRGV0YWlsKSkge1xuXHRcdFx0dGhpcy5faXRlbUVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7XG5cdFx0XHRcdGVsZW1lbnQubGFiZWxIaWdobGlnaHRzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRlbGVtZW50LmRlc2NyaXB0aW9uSGlnaGxpZ2h0cyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0ZWxlbWVudC5kZXRhaWxIaWdobGlnaHRzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRlbGVtZW50LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRjb25zdCBwcmV2aW91cyA9IGVsZW1lbnQuaW5kZXggJiYgdGhpcy5faW5wdXRFbGVtZW50c1tlbGVtZW50LmluZGV4IC0gMV07XG5cdFx0XHRcdGlmIChlbGVtZW50Lml0ZW0pIHtcblx0XHRcdFx0XHRlbGVtZW50LnNlcGFyYXRvciA9IHByZXZpb3VzICYmIHByZXZpb3VzLnR5cGUgPT09ICdzZXBhcmF0b3InICYmICFwcmV2aW91cy5idXR0b25zID8gcHJldmlvdXMgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIEZpbHRlciBieSB2YWx1ZSAoc2luY2Ugd2Ugc3VwcG9ydCBpY29ucyBpbiBsYWJlbHMsIHVzZSAkKC4uKSBhd2FyZSBmdXp6eSBtYXRjaGluZylcblx0XHRlbHNlIHtcblx0XHRcdGxldCBjdXJyZW50U2VwYXJhdG9yOiBJUXVpY2tQaWNrU2VwYXJhdG9yIHwgdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5faXRlbUVsZW1lbnRzLmZvckVhY2goZWxlbWVudCA9PiB7XG5cdFx0XHRcdGxldCBsYWJlbEhpZ2hsaWdodHM6IElNYXRjaFtdIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAodGhpcy5tYXRjaE9uTGFiZWxNb2RlID09PSAnZnV6enknKSB7XG5cdFx0XHRcdFx0bGFiZWxIaWdobGlnaHRzID0gdGhpcy5tYXRjaE9uTGFiZWwgPyBtYXRjaGVzRnV6enlJY29uQXdhcmUocXVlcnksIHBhcnNlTGFiZWxXaXRoSWNvbnMoZWxlbWVudC5zYW5lTGFiZWwpKSA/PyB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGFiZWxIaWdobGlnaHRzID0gdGhpcy5tYXRjaE9uTGFiZWwgPyBtYXRjaGVzQ29udGlndW91c0ljb25Bd2FyZShxdWVyeVdpdGhXaGl0ZXNwYWNlLCBwYXJzZUxhYmVsV2l0aEljb25zKGVsZW1lbnQuc2FuZUxhYmVsKSkgPz8gdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uSGlnaGxpZ2h0cyA9IHRoaXMubWF0Y2hPbkRlc2NyaXB0aW9uID8gbWF0Y2hlc0Z1enp5SWNvbkF3YXJlKHF1ZXJ5LCBwYXJzZUxhYmVsV2l0aEljb25zKGVsZW1lbnQuc2FuZURlc2NyaXB0aW9uIHx8ICcnKSkgPz8gdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBkZXRhaWxIaWdobGlnaHRzID0gdGhpcy5tYXRjaE9uRGV0YWlsID8gbWF0Y2hlc0Z1enp5SWNvbkF3YXJlKHF1ZXJ5LCBwYXJzZUxhYmVsV2l0aEljb25zKGVsZW1lbnQuc2FuZURldGFpbCB8fCAnJykpID8/IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRpZiAobGFiZWxIaWdobGlnaHRzIHx8IGRlc2NyaXB0aW9uSGlnaGxpZ2h0cyB8fCBkZXRhaWxIaWdobGlnaHRzKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5sYWJlbEhpZ2hsaWdodHMgPSBsYWJlbEhpZ2hsaWdodHM7XG5cdFx0XHRcdFx0ZWxlbWVudC5kZXNjcmlwdGlvbkhpZ2hsaWdodHMgPSBkZXNjcmlwdGlvbkhpZ2hsaWdodHM7XG5cdFx0XHRcdFx0ZWxlbWVudC5kZXRhaWxIaWdobGlnaHRzID0gZGV0YWlsSGlnaGxpZ2h0cztcblx0XHRcdFx0XHRlbGVtZW50LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGVsZW1lbnQubGFiZWxIaWdobGlnaHRzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGVsZW1lbnQuZGVzY3JpcHRpb25IaWdobGlnaHRzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGVsZW1lbnQuZGV0YWlsSGlnaGxpZ2h0cyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRlbGVtZW50LmhpZGRlbiA9IGVsZW1lbnQuaXRlbSA/ICFlbGVtZW50Lml0ZW0uYWx3YXlzU2hvdyA6IHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBFbnN1cmUgc2VwYXJhdG9ycyBhcmUgZmlsdGVyZWQgb3V0IGZpcnN0IGJlZm9yZSBkZWNpZGluZyBpZiB3ZSBuZWVkIHRvIGJyaW5nIHRoZW0gYmFja1xuXHRcdFx0XHRpZiAoZWxlbWVudC5pdGVtKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5zZXBhcmF0b3IgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudC5zZXBhcmF0b3IpIHtcblx0XHRcdFx0XHRlbGVtZW50LmhpZGRlbiA9IHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyB3ZSBjYW4gc2hvdyB0aGUgc2VwYXJhdG9yIHVubGVzcyB0aGUgbGlzdCBnZXRzIHNvcnRlZCBieSBtYXRjaFxuXHRcdFx0XHRpZiAoIXRoaXMuc29ydEJ5TGFiZWwpIHtcblx0XHRcdFx0XHRjb25zdCBwcmV2aW91cyA9IGVsZW1lbnQuaW5kZXggJiYgdGhpcy5faW5wdXRFbGVtZW50c1tlbGVtZW50LmluZGV4IC0gMV0gfHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGlmIChwcmV2aW91cz8udHlwZSA9PT0gJ3NlcGFyYXRvcicgJiYgIXByZXZpb3VzLmJ1dHRvbnMpIHtcblx0XHRcdFx0XHRcdGN1cnJlbnRTZXBhcmF0b3IgPSBwcmV2aW91cztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGN1cnJlbnRTZXBhcmF0b3IgJiYgIWVsZW1lbnQuaGlkZGVuKSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50LnNlcGFyYXRvciA9IGN1cnJlbnRTZXBhcmF0b3I7XG5cdFx0XHRcdFx0XHRjdXJyZW50U2VwYXJhdG9yID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2V0RWxlbWVudHNUb1RyZWUodGhpcy5fc29ydEJ5TGFiZWwgJiYgcXVlcnlcblx0XHRcdC8vIFdlIGRvbid0IHJlbmRlciBhbnkgc2VwYXJhdG9ycyBpZiB3ZSdyZSBzb3J0aW5nIHNvIGp1c3QgcmVuZGVyIHRoZSBlbGVtZW50c1xuXHRcdFx0PyB0aGlzLl9pdGVtRWxlbWVudHNcblx0XHRcdC8vIFJlbmRlciB0aGUgZnVsbCB0cmVlXG5cdFx0XHQ6IHRoaXMuX2VsZW1lbnRUcmVlXG5cdFx0KTtcblx0XHR0aGlzLl90cmVlLmxheW91dCgpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0dG9nZ2xlQ2hlY2tib3goKSB7XG5cdFx0dGhpcy5fZWxlbWVudENoZWNrZWRFdmVudEJ1ZmZlcmVyLmJ1ZmZlckV2ZW50cygoKSA9PiB7XG5cdFx0XHRjb25zdCBlbGVtZW50cyA9IHRoaXMuX3RyZWUuZ2V0Rm9jdXMoKS5maWx0ZXIoKGUpOiBlIGlzIFF1aWNrUGlja0l0ZW1FbGVtZW50ID0+IGUgaW5zdGFuY2VvZiBRdWlja1BpY2tJdGVtRWxlbWVudCk7XG5cdFx0XHRjb25zdCBhbGxDaGVja2VkID0gdGhpcy5fYWxsVmlzaWJsZUNoZWNrZWQoZWxlbWVudHMpO1xuXHRcdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0XHRcdGlmICghZWxlbWVudC5jaGVja2JveERpc2FibGVkKSB7XG5cdFx0XHRcdFx0Ly8gV291bGQgZmlyZSBhbiBldmVudCBpZiB3ZSBkaWRuJ3QgaGF2ZSB0aGUgZmxhZyBzZXRcblx0XHRcdFx0XHRlbGVtZW50LmNoZWNrZWQgPSAhYWxsQ2hlY2tlZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0c3R5bGUoc3R5bGVzOiBJTGlzdFN0eWxlcykge1xuXHRcdHRoaXMuX3RyZWUuc3R5bGUoc3R5bGVzKTtcblx0fVxuXG5cdHRvZ2dsZUhvdmVyKCkge1xuXHRcdGNvbnN0IGZvY3VzZWQ6IElRdWlja1BpY2tFbGVtZW50IHwgbnVsbCA9IHRoaXMuX3RyZWUuZ2V0Rm9jdXMoKVswXTtcblx0XHRpZiAoIWZvY3VzZWQ/LnNhbmVUb29sdGlwIHx8ICEoZm9jdXNlZCBpbnN0YW5jZW9mIFF1aWNrUGlja0l0ZW1FbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIGlmIHRoZXJlJ3MgYSBob3ZlciBhbHJlYWR5LCBoaWRlIGl0ICh0b2dnbGUgb2ZmKVxuXHRcdGlmICh0aGlzLl9sYXN0SG92ZXIgJiYgIXRoaXMuX2xhc3RIb3Zlci5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHR0aGlzLl9sYXN0SG92ZXIuZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZXJlIGlzIG5vIGhvdmVyLCBzaG93IGl0ICh0b2dnbGUgb24pXG5cdFx0dGhpcy5zaG93SG92ZXIoZm9jdXNlZCk7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0c3RvcmUuYWRkKHRoaXMuX3RyZWUub25EaWRDaGFuZ2VGb2N1cyhlID0+IHtcblx0XHRcdGlmIChlLmVsZW1lbnRzWzBdIGluc3RhbmNlb2YgUXVpY2tQaWNrSXRlbUVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5zaG93SG92ZXIoZS5lbGVtZW50c1swXSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGlmICh0aGlzLl9sYXN0SG92ZXIpIHtcblx0XHRcdHN0b3JlLmFkZCh0aGlzLl9sYXN0SG92ZXIpO1xuXHRcdH1cblx0XHR0aGlzLl9lbGVtZW50RGlzcG9zYWJsZS5hZGQoc3RvcmUpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIHByaXZhdGUgbWV0aG9kc1xuXG5cdHByaXZhdGUgX3NldEVsZW1lbnRzVG9UcmVlKGVsZW1lbnRzOiBJUXVpY2tQaWNrRWxlbWVudFtdKSB7XG5cdFx0Y29uc3QgdHJlZUVsZW1lbnRzID0gbmV3IEFycmF5PElPYmplY3RUcmVlRWxlbWVudDxJUXVpY2tQaWNrRWxlbWVudD4+KCk7XG5cdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFF1aWNrUGlja1NlcGFyYXRvckVsZW1lbnQpIHtcblx0XHRcdFx0dHJlZUVsZW1lbnRzLnB1c2goe1xuXHRcdFx0XHRcdGVsZW1lbnQsXG5cdFx0XHRcdFx0Y29sbGFwc2libGU6IGZhbHNlLFxuXHRcdFx0XHRcdGNvbGxhcHNlZDogZmFsc2UsXG5cdFx0XHRcdFx0Y2hpbGRyZW46IGVsZW1lbnQuY2hpbGRyZW4ubWFwKGUgPT4gKHtcblx0XHRcdFx0XHRcdGVsZW1lbnQ6IGUsXG5cdFx0XHRcdFx0XHRjb2xsYXBzaWJsZTogZmFsc2UsXG5cdFx0XHRcdFx0XHRjb2xsYXBzZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0cmVlRWxlbWVudHMucHVzaCh7XG5cdFx0XHRcdFx0ZWxlbWVudCxcblx0XHRcdFx0XHRjb2xsYXBzaWJsZTogZmFsc2UsXG5cdFx0XHRcdFx0Y29sbGFwc2VkOiBmYWxzZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX3RyZWUuc2V0Q2hpbGRyZW4obnVsbCwgdHJlZUVsZW1lbnRzKTtcblx0fVxuXG5cdHByaXZhdGUgX2FsbFZpc2libGVDaGVja2VkKGVsZW1lbnRzOiBRdWlja1BpY2tJdGVtRWxlbWVudFtdLCB3aGVuTm9uZVZpc2libGUgPSB0cnVlKSB7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIG4gPSBlbGVtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSBlbGVtZW50c1tpXTtcblx0XHRcdGlmICghZWxlbWVudC5oaWRkZW4gJiYgZWxlbWVudC5pdGVtLnBpY2thYmxlICE9PSBmYWxzZSkge1xuXHRcdFx0XHRpZiAoIWVsZW1lbnQuY2hlY2tlZCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3aGVuTm9uZVZpc2libGUgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB3aGVuTm9uZVZpc2libGU7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDaGVja2VkT2JzZXJ2YWJsZXMoKSB7XG5cdFx0dHJhbnNhY3Rpb24oKHR4KSA9PiB7XG5cdFx0XHR0aGlzLl9hbGxWaXNpYmxlQ2hlY2tlZE9ic2VydmFibGUuc2V0KHRoaXMuX2FsbFZpc2libGVDaGVja2VkKHRoaXMuX2l0ZW1FbGVtZW50cywgZmFsc2UpLCB0eCk7XG5cdFx0XHRjb25zdCBjaGVja2VkQ291bnQgPSB0aGlzLl9pdGVtRWxlbWVudHMuZmlsdGVyKGVsZW1lbnQgPT4gZWxlbWVudC5jaGVja2VkKS5sZW5ndGg7XG5cdFx0XHR0aGlzLl9jaGVja2VkQ291bnRPYnNlcnZhYmxlLnNldChjaGVja2VkQ291bnQsIHR4KTtcblx0XHRcdHRoaXMuX2NoZWNrZWRFbGVtZW50c09ic2VydmFibGUuc2V0KHRoaXMuZ2V0Q2hlY2tlZEVsZW1lbnRzKCksIHR4KTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEaXNwb3NlcyBvZiB0aGUgaG92ZXIgYW5kIHNob3dzIGEgbmV3IG9uZSBmb3IgdGhlIGdpdmVuIGluZGV4IGlmIGl0IGhhcyBhIHRvb2x0aXAuXG5cdCAqIEBwYXJhbSBlbGVtZW50IFRoZSBlbGVtZW50IHRvIHNob3cgdGhlIGhvdmVyIGZvclxuXHQgKi9cblx0cHJpdmF0ZSBzaG93SG92ZXIoZWxlbWVudDogUXVpY2tQaWNrSXRlbUVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fbGFzdEhvdmVyICYmICF0aGlzLl9sYXN0SG92ZXIuaXNEaXNwb3NlZCkge1xuXHRcdFx0dGhpcy5ob3ZlckRlbGVnYXRlLm9uRGlkSGlkZUhvdmVyPy4oKTtcblx0XHRcdHRoaXMuX2xhc3RIb3Zlcj8uZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdGlmICghZWxlbWVudC5lbGVtZW50IHx8ICFlbGVtZW50LnNhbmVUb29sdGlwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2xhc3RIb3ZlciA9IHRoaXMuaG92ZXJEZWxlZ2F0ZS5zaG93SG92ZXIoe1xuXHRcdFx0Y29udGVudDogZWxlbWVudC5zYW5lVG9vbHRpcCxcblx0XHRcdHRhcmdldDogZWxlbWVudC5lbGVtZW50LFxuXHRcdFx0bGlua0hhbmRsZXI6ICh1cmwpID0+IHtcblx0XHRcdFx0dGhpcy5saW5rT3BlbmVyRGVsZWdhdGUodXJsKTtcblx0XHRcdH0sXG5cdFx0XHRhcHBlYXJhbmNlOiB7XG5cdFx0XHRcdHNob3dQb2ludGVyOiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdGNvbnRhaW5lcjogdGhpcy5fY29udGFpbmVyLFxuXHRcdFx0cG9zaXRpb246IHtcblx0XHRcdFx0aG92ZXJQb3NpdGlvbjogSG92ZXJQb3NpdGlvbi5SSUdIVFxuXHRcdFx0fVxuXHRcdH0sIGZhbHNlKTtcblx0fVxufVxuXG5mdW5jdGlvbiBtYXRjaGVzQ29udGlndW91c0ljb25Bd2FyZShxdWVyeTogc3RyaW5nLCB0YXJnZXQ6IElQYXJzZWRMYWJlbFdpdGhJY29ucyk6IElNYXRjaFtdIHwgbnVsbCB7XG5cblx0Y29uc3QgeyB0ZXh0LCBpY29uT2Zmc2V0cyB9ID0gdGFyZ2V0O1xuXG5cdC8vIFJldHVybiBlYXJseSBpZiB0aGVyZSBhcmUgbm8gaWNvbiBtYXJrZXJzIGluIHRoZSB3b3JkIHRvIG1hdGNoIGFnYWluc3Rcblx0aWYgKCFpY29uT2Zmc2V0cyB8fCBpY29uT2Zmc2V0cy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4gbWF0Y2hlc0NvbnRpZ3VvdXMocXVlcnksIHRleHQpO1xuXHR9XG5cblx0Ly8gVHJpbSB0aGUgd29yZCB0byBtYXRjaCBhZ2FpbnN0IGJlY2F1c2UgaXQgY291bGQgaGF2ZSBsZWFkaW5nXG5cdC8vIHdoaXRlc3BhY2Ugbm93IGlmIHRoZSB3b3JkIHN0YXJ0ZWQgd2l0aCBhbiBpY29uXG5cdGNvbnN0IHdvcmRUb01hdGNoQWdhaW5zdFdpdGhvdXRJY29uc1RyaW1tZWQgPSBsdHJpbSh0ZXh0LCAnICcpO1xuXHRjb25zdCBsZWFkaW5nV2hpdGVzcGFjZU9mZnNldCA9IHRleHQubGVuZ3RoIC0gd29yZFRvTWF0Y2hBZ2FpbnN0V2l0aG91dEljb25zVHJpbW1lZC5sZW5ndGg7XG5cblx0Ly8gbWF0Y2ggb24gdmFsdWUgd2l0aG91dCBpY29uXG5cdGNvbnN0IG1hdGNoZXMgPSBtYXRjaGVzQ29udGlndW91cyhxdWVyeSwgd29yZFRvTWF0Y2hBZ2FpbnN0V2l0aG91dEljb25zVHJpbW1lZCk7XG5cblx0Ly8gTWFwIG1hdGNoZXMgYmFjayB0byBvZmZzZXRzIHdpdGggaWNvbiBhbmQgdHJpbW1pbmdcblx0aWYgKG1hdGNoZXMpIHtcblx0XHRmb3IgKGNvbnN0IG1hdGNoIG9mIG1hdGNoZXMpIHtcblx0XHRcdGNvbnN0IGljb25PZmZzZXQgPSBpY29uT2Zmc2V0c1ttYXRjaC5zdGFydCArIGxlYWRpbmdXaGl0ZXNwYWNlT2Zmc2V0XSAvKiBpY29uIG9mZnNldHMgYXQgaW5kZXggKi8gKyBsZWFkaW5nV2hpdGVzcGFjZU9mZnNldCAvKiBvdmVyYWxsIGxlYWRpbmcgd2hpdGVzcGFjZSBvZmZzZXQgKi87XG5cdFx0XHRtYXRjaC5zdGFydCArPSBpY29uT2Zmc2V0O1xuXHRcdFx0bWF0Y2guZW5kICs9IGljb25PZmZzZXQ7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG1hdGNoZXM7XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXNDb250aWd1b3VzKHdvcmQ6IHN0cmluZywgd29yZFRvTWF0Y2hBZ2FpbnN0OiBzdHJpbmcpOiBJTWF0Y2hbXSB8IG51bGwge1xuXHRjb25zdCBtYXRjaEluZGV4ID0gd29yZFRvTWF0Y2hBZ2FpbnN0LnRvTG93ZXJDYXNlKCkuaW5kZXhPZih3b3JkLnRvTG93ZXJDYXNlKCkpO1xuXHRpZiAobWF0Y2hJbmRleCAhPT0gLTEpIHtcblx0XHRyZXR1cm4gW3sgc3RhcnQ6IG1hdGNoSW5kZXgsIGVuZDogbWF0Y2hJbmRleCArIHdvcmQubGVuZ3RoIH1dO1xuXHR9XG5cdHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBjb21wYXJlRW50cmllcyhlbGVtZW50QTogSVF1aWNrUGlja0VsZW1lbnQsIGVsZW1lbnRCOiBJUXVpY2tQaWNrRWxlbWVudCwgbG9va0Zvcjogc3RyaW5nKTogbnVtYmVyIHtcblxuXHRjb25zdCBsYWJlbEhpZ2hsaWdodHNBID0gZWxlbWVudEEubGFiZWxIaWdobGlnaHRzIHx8IFtdO1xuXHRjb25zdCBsYWJlbEhpZ2hsaWdodHNCID0gZWxlbWVudEIubGFiZWxIaWdobGlnaHRzIHx8IFtdO1xuXHRpZiAobGFiZWxIaWdobGlnaHRzQS5sZW5ndGggJiYgIWxhYmVsSGlnaGxpZ2h0c0IubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0aWYgKCFsYWJlbEhpZ2hsaWdodHNBLmxlbmd0aCAmJiBsYWJlbEhpZ2hsaWdodHNCLmxlbmd0aCkge1xuXHRcdHJldHVybiAxO1xuXHR9XG5cblx0aWYgKGxhYmVsSGlnaGxpZ2h0c0EubGVuZ3RoID09PSAwICYmIGxhYmVsSGlnaGxpZ2h0c0IubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRyZXR1cm4gY29tcGFyZUFueXRoaW5nKGVsZW1lbnRBLnNhbmVTb3J0TGFiZWwsIGVsZW1lbnRCLnNhbmVTb3J0TGFiZWwsIGxvb2tGb3IpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsU0FBUyxPQUFPLHFCQUE0QztBQUdyRSxTQUF1RCxzQkFBc0I7QUFDN0UsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUF3SCxzQkFBc0I7QUFLOUksU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsVUFBVTtBQUNuQixTQUFTLGVBQWU7QUFDeEIsU0FBaUMsaUJBQWlCO0FBQ2xELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsY0FBYztBQUN2QixT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
