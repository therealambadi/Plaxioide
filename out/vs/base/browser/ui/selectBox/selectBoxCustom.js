import * as dom from "../../dom.js";
import * as domStylesheetsJs from "../../domStylesheets.js";
import * as cssJs from "../../cssValue.js";
import { DomEmitter } from "../../event.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { renderMarkdown } from "../../markdownRenderer.js";
import { AnchorPosition } from "../contextview/contextview.js";
import { getBaseLayerHoverDelegate } from "../hover/hoverDelegate2.js";
import { getDefaultHoverDelegate } from "../hover/hoverDelegateFactory.js";
import { List } from "../list/listWidget.js";
import * as arrays from "../../../common/arrays.js";
import { Emitter, Event } from "../../../common/event.js";
import { KeyCode, KeyCodeUtils } from "../../../common/keyCodes.js";
import { Disposable } from "../../../common/lifecycle.js";
import { isMacintosh } from "../../../common/platform.js";
import { ScrollbarVisibility } from "../../../common/scrollable.js";
import "./selectBoxCustom.css";
import { localize } from "../../../../nls.js";
const $ = dom.$;
const SELECT_OPTION_ENTRY_TEMPLATE_ID = "selectOption.entry.template";
class SelectListRenderer {
  get templateId() {
    return SELECT_OPTION_ENTRY_TEMPLATE_ID;
  }
  renderTemplate(container) {
    const data = /* @__PURE__ */ Object.create(null);
    data.root = container;
    data.text = dom.append(container, $(".option-text"));
    data.detail = dom.append(container, $(".option-detail"));
    data.decoratorRight = dom.append(container, $(".option-decorator-right"));
    return data;
  }
  renderElement(element, index, templateData) {
    const data = templateData;
    const text = element.text;
    const detail = element.detail;
    const decoratorRight = element.decoratorRight;
    const isDisabled = element.isDisabled;
    data.text.textContent = text;
    data.detail.textContent = !!detail ? detail : "";
    data.decoratorRight.innerText = !!decoratorRight ? decoratorRight : "";
    if (isDisabled) {
      data.root.classList.add("option-disabled");
    } else {
      data.root.classList.remove("option-disabled");
    }
  }
  disposeTemplate(_templateData) {
  }
}
const _SelectBoxList = class _SelectBoxList extends Disposable {
  // for dev purposes only
  constructor(options, selected, contextViewProvider, styles, selectBoxOptions) {
    super();
    this.options = [];
    this._currentSelection = 0;
    this._hasDetails = false;
    this._skipLayout = false;
    this._sticky = false;
    this._isVisible = false;
    this.styles = styles;
    this.selectBoxOptions = selectBoxOptions || /* @__PURE__ */ Object.create(null);
    if (typeof this.selectBoxOptions.minBottomMargin !== "number") {
      this.selectBoxOptions.minBottomMargin = _SelectBoxList.DEFAULT_DROPDOWN_MINIMUM_BOTTOM_MARGIN;
    } else if (this.selectBoxOptions.minBottomMargin < 0) {
      this.selectBoxOptions.minBottomMargin = 0;
    }
    this.selectElement = document.createElement("select");
    this.selectElement.className = "monaco-select-box monaco-select-box-dropdown-padding";
    if (typeof this.selectBoxOptions.ariaLabel === "string") {
      this.selectElement.setAttribute("aria-label", this.selectBoxOptions.ariaLabel);
    }
    if (typeof this.selectBoxOptions.ariaDescription === "string") {
      this.selectElement.setAttribute("aria-description", this.selectBoxOptions.ariaDescription);
    }
    this._onDidSelect = new Emitter();
    this._register(this._onDidSelect);
    this.registerListeners();
    this.constructSelectDropDown(contextViewProvider);
    this.selected = selected || 0;
    if (options) {
      this.setOptions(options, selected);
    }
    this.initStyleSheet();
  }
  setTitle(title) {
    if (!this._hover && title) {
      this._hover = this._register(getBaseLayerHoverDelegate().setupManagedHover(getDefaultHoverDelegate("mouse"), this.selectElement, title));
    } else if (this._hover) {
      this._hover.update(title);
    }
  }
  // IDelegate - List renderer
  getHeight() {
    return 22;
  }
  getTemplateId() {
    return SELECT_OPTION_ENTRY_TEMPLATE_ID;
  }
  constructSelectDropDown(contextViewProvider) {
    this.contextViewProvider = contextViewProvider;
    this.selectDropDownContainer = dom.$(".monaco-select-box-dropdown-container");
    this.selectDropDownContainer.classList.add("monaco-select-box-dropdown-padding");
    this.selectionDetailsPane = dom.append(this.selectDropDownContainer, $(".select-box-details-pane"));
    const widthControlOuterDiv = dom.append(this.selectDropDownContainer, $(".select-box-dropdown-container-width-control"));
    const widthControlInnerDiv = dom.append(widthControlOuterDiv, $(".width-control-div"));
    this.widthControlElement = document.createElement("span");
    this.widthControlElement.className = "option-text-width-control";
    dom.append(widthControlInnerDiv, this.widthControlElement);
    this._dropDownPosition = AnchorPosition.BELOW;
    this.styleElement = domStylesheetsJs.createStyleSheet(this.selectDropDownContainer);
    this.selectDropDownContainer.setAttribute("draggable", "true");
    this._register(dom.addDisposableListener(this.selectDropDownContainer, dom.EventType.DRAG_START, (e) => {
      dom.EventHelper.stop(e, true);
    }));
  }
  registerListeners() {
    this._register(dom.addStandardDisposableListener(this.selectElement, "change", (e) => {
      this.selected = e.target.selectedIndex;
      this._onDidSelect.fire({
        index: e.target.selectedIndex,
        selected: e.target.value
      });
      if (!!this.options[this.selected] && !!this.options[this.selected].text) {
        this.setTitle(this.options[this.selected].text);
      }
    }));
    this._register(dom.addDisposableListener(this.selectElement, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e);
      if (this._isVisible) {
        this.hideSelectDropDown(true);
      } else {
        this.showSelectDropDown();
      }
    }));
    this._register(dom.addDisposableListener(this.selectElement, dom.EventType.MOUSE_DOWN, (e) => {
      dom.EventHelper.stop(e);
    }));
    let listIsVisibleOnTouchStart;
    this._register(dom.addDisposableListener(this.selectElement, "touchstart", (e) => {
      listIsVisibleOnTouchStart = this._isVisible;
    }));
    this._register(dom.addDisposableListener(this.selectElement, "touchend", (e) => {
      dom.EventHelper.stop(e);
      if (listIsVisibleOnTouchStart) {
        this.hideSelectDropDown(true);
      } else {
        this.showSelectDropDown();
      }
    }));
    this._register(dom.addDisposableListener(this.selectElement, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      let showDropDown = false;
      if (isMacintosh) {
        if (event.keyCode === KeyCode.DownArrow || event.keyCode === KeyCode.UpArrow || event.keyCode === KeyCode.Space || event.keyCode === KeyCode.Enter) {
          showDropDown = true;
        }
      } else {
        if (event.keyCode === KeyCode.DownArrow && event.altKey || event.keyCode === KeyCode.UpArrow && event.altKey || event.keyCode === KeyCode.Space || event.keyCode === KeyCode.Enter) {
          showDropDown = true;
        }
      }
      if (showDropDown) {
        this.showSelectDropDown();
        dom.EventHelper.stop(e, true);
      }
    }));
  }
  get onDidSelect() {
    return this._onDidSelect.event;
  }
  setOptions(options, selected) {
    if (!arrays.equals(this.options, options)) {
      this.options = options;
      this.selectElement.options.length = 0;
      this._hasDetails = false;
      this._cachedMaxDetailsHeight = void 0;
      this.options.forEach((option, index) => {
        this.selectElement.add(this.createOption(option.text, index, option.isDisabled));
        if (typeof option.description === "string") {
          this._hasDetails = true;
        }
      });
    }
    if (selected !== void 0) {
      this.select(selected);
      this._currentSelection = this.selected;
    }
  }
  setEnabled(enable) {
    this.selectElement.disabled = !enable;
  }
  setOptionsList() {
    this.selectList?.splice(0, this.selectList.length, this.options);
  }
  select(index) {
    if (index >= 0 && index < this.options.length) {
      this.selected = index;
    } else if (index > this.options.length - 1) {
      this.select(this.options.length - 1);
    } else if (this.selected < 0) {
      this.selected = 0;
    }
    this.selectElement.selectedIndex = this.selected;
    if (!!this.options[this.selected] && !!this.options[this.selected].text) {
      this.setTitle(this.options[this.selected].text);
    }
  }
  setAriaLabel(label) {
    this.selectBoxOptions.ariaLabel = label;
    this.selectElement.setAttribute("aria-label", this.selectBoxOptions.ariaLabel);
  }
  focus() {
    if (this.selectElement) {
      this.selectElement.tabIndex = 0;
      this.selectElement.focus();
    }
  }
  blur() {
    if (this.selectElement) {
      this.selectElement.tabIndex = -1;
      this.selectElement.blur();
    }
  }
  setFocusable(focusable) {
    this.selectElement.tabIndex = focusable ? 0 : -1;
  }
  render(container) {
    this.container = container;
    container.classList.add("select-container");
    container.appendChild(this.selectElement);
    this.styleSelectElement();
  }
  initStyleSheet() {
    const content = [];
    if (this.styles.listFocusBackground) {
      content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row.focused { background-color: ${this.styles.listFocusBackground} !important; }`);
    }
    if (this.styles.listFocusForeground) {
      content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row.focused { color: ${this.styles.listFocusForeground} !important; }`);
    }
    if (this.styles.decoratorRightForeground) {
      content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row:not(.focused) .option-decorator-right { color: ${this.styles.decoratorRightForeground}; }`);
    }
    if (this.styles.selectBackground && this.styles.selectBorder && this.styles.selectBorder !== this.styles.selectBackground) {
      content.push(`.monaco-select-box-dropdown-container { border: 1px solid ${this.styles.selectBorder} } `);
      content.push(`.monaco-select-box-dropdown-container > .select-box-details-pane.border-top { border-top: 1px solid ${this.styles.selectBorder} } `);
      content.push(`.monaco-select-box-dropdown-container > .select-box-details-pane.border-bottom { border-bottom: 1px solid ${this.styles.selectBorder} } `);
    } else if (this.styles.selectListBorder) {
      content.push(`.monaco-select-box-dropdown-container > .select-box-details-pane.border-top { border-top: 1px solid ${this.styles.selectListBorder} } `);
      content.push(`.monaco-select-box-dropdown-container > .select-box-details-pane.border-bottom { border-bottom: 1px solid ${this.styles.selectListBorder} } `);
    }
    if (this.styles.listHoverForeground) {
      content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row:not(.option-disabled):not(.focused):hover { color: ${this.styles.listHoverForeground} !important; }`);
    }
    if (this.styles.listHoverBackground) {
      content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row:not(.option-disabled):not(.focused):hover { background-color: ${this.styles.listHoverBackground} !important; }`);
    }
    if (this.styles.listFocusOutline) {
      content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row.focused { outline: 1.6px dotted ${this.styles.listFocusOutline} !important; outline-offset: -1.6px !important; }`);
    }
    if (this.styles.listHoverOutline) {
      content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row:not(.option-disabled):not(.focused):hover { outline: 1.6px dashed ${this.styles.listHoverOutline} !important; outline-offset: -1.6px !important; }`);
    }
    content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row.option-disabled.focused { background-color: transparent !important; color: inherit !important; outline: none !important; }`);
    content.push(`.monaco-select-box-dropdown-container > .select-box-dropdown-list-container .monaco-list .monaco-list-row.option-disabled:hover { background-color: transparent !important; color: inherit !important; outline: none !important; }`);
    this.styleElement.textContent = content.join("\n");
  }
  styleSelectElement() {
    const background = this.styles.selectBackground ?? "";
    const foreground = this.styles.selectForeground ?? "";
    const border = this.styles.selectBorder ?? "";
    this.selectElement.style.backgroundColor = background;
    this.selectElement.style.color = foreground;
    this.selectElement.style.borderColor = border;
  }
  styleList() {
    const background = this.styles.selectBackground ?? "";
    const listBackground = cssJs.asCssValueWithDefault(this.styles.selectListBackground, background);
    this.selectDropDownListContainer.style.backgroundColor = listBackground;
    this.selectionDetailsPane.style.backgroundColor = listBackground;
    const optionsBorder = this.styles.focusBorder ?? "";
    this.selectDropDownContainer.style.outlineColor = optionsBorder;
    this.selectDropDownContainer.style.outlineOffset = "-1px";
    this.selectList.style(this.styles);
  }
  createOption(value, index, disabled) {
    const option = document.createElement("option");
    option.value = value;
    option.text = value;
    option.disabled = !!disabled;
    return option;
  }
  // ContextView dropdown methods
  showSelectDropDown() {
    this.selectionDetailsPane.innerText = "";
    if (!this.contextViewProvider || this._isVisible) {
      return;
    }
    this.createSelectList(this.selectDropDownContainer);
    this.setOptionsList();
    this.contextViewProvider.showContextView({
      getAnchor: () => this.selectElement,
      render: (container) => this.renderSelectDropDown(container, true),
      layout: () => {
        this.layoutSelectDropDown();
      },
      onHide: () => {
        this.selectDropDownContainer.classList.remove("visible");
        this.selectElement.classList.remove("synthetic-focus");
      },
      anchorPosition: this._dropDownPosition
    }, this.selectBoxOptions.optionsAsChildren ? this.container : void 0);
    this._isVisible = true;
    this.hideSelectDropDown(false);
    this.contextViewProvider.showContextView({
      getAnchor: () => this.selectElement,
      render: (container) => this.renderSelectDropDown(container),
      layout: () => this.layoutSelectDropDown(),
      onHide: () => {
        this.selectDropDownContainer.classList.remove("visible");
        this.selectElement.classList.remove("synthetic-focus");
      },
      anchorPosition: this._dropDownPosition
    }, this.selectBoxOptions.optionsAsChildren ? this.container : void 0);
    this._currentSelection = this.selected;
    this._isVisible = true;
    this.selectElement.setAttribute("aria-expanded", "true");
  }
  hideSelectDropDown(focusSelect) {
    if (!this.contextViewProvider || !this._isVisible) {
      return;
    }
    this._isVisible = false;
    this.selectElement.setAttribute("aria-expanded", "false");
    if (focusSelect) {
      this.selectElement.focus();
    }
    this.contextViewProvider.hideContextView();
  }
  renderSelectDropDown(container, preLayoutPosition) {
    container.appendChild(this.selectDropDownContainer);
    this.layoutSelectDropDown(preLayoutPosition);
    return {
      dispose: () => {
        this.selectDropDownContainer.remove();
      }
    };
  }
  // Iterate over detailed descriptions, find max height
  measureMaxDetailsHeight() {
    let maxDetailsPaneHeight = 0;
    this.options.forEach((_option, index) => {
      this.updateDetail(index);
      if (this.selectionDetailsPane.offsetHeight > maxDetailsPaneHeight) {
        maxDetailsPaneHeight = this.selectionDetailsPane.offsetHeight;
      }
    });
    return maxDetailsPaneHeight;
  }
  layoutSelectDropDown(preLayoutPosition) {
    if (this._skipLayout) {
      return false;
    }
    if (this.selectList) {
      this.selectDropDownContainer.classList.add("visible");
      const window = dom.getWindow(this.selectElement);
      const selectPosition = dom.getDomNodePagePosition(this.selectElement);
      const styles = dom.getWindow(this.selectElement).getComputedStyle(this.selectElement);
      const verticalPadding = parseFloat(styles.getPropertyValue("--dropdown-padding-top")) + parseFloat(styles.getPropertyValue("--dropdown-padding-bottom"));
      const maxSelectDropDownHeightBelow = window.innerHeight - selectPosition.top - selectPosition.height - (this.selectBoxOptions.minBottomMargin || 0);
      const maxSelectDropDownHeightAbove = selectPosition.top - _SelectBoxList.DEFAULT_DROPDOWN_MINIMUM_TOP_MARGIN;
      const selectWidth = this.selectElement.offsetWidth;
      const selectMinWidth = this.setWidthControlElement(this.widthControlElement);
      const selectOptimalWidth = Math.max(selectMinWidth, Math.round(selectWidth)).toString() + "px";
      this.selectDropDownContainer.style.width = selectOptimalWidth;
      this.selectList.getHTMLElement().style.height = "";
      this.selectList.layout();
      let listHeight = this.selectList.contentHeight;
      if (this._hasDetails && this._cachedMaxDetailsHeight === void 0) {
        this._cachedMaxDetailsHeight = this.measureMaxDetailsHeight();
      }
      const maxDetailsPaneHeight = this._hasDetails ? this._cachedMaxDetailsHeight : 0;
      const minRequiredDropDownHeight = listHeight + verticalPadding + maxDetailsPaneHeight;
      const maxVisibleOptionsBelow = Math.floor((maxSelectDropDownHeightBelow - verticalPadding - maxDetailsPaneHeight) / this.getHeight());
      const maxVisibleOptionsAbove = Math.floor((maxSelectDropDownHeightAbove - verticalPadding - maxDetailsPaneHeight) / this.getHeight());
      if (preLayoutPosition) {
        if (selectPosition.top + selectPosition.height > window.innerHeight - 22 || selectPosition.top < _SelectBoxList.DEFAULT_DROPDOWN_MINIMUM_TOP_MARGIN || maxVisibleOptionsBelow < 1 && maxVisibleOptionsAbove < 1) {
          return false;
        }
        if (maxVisibleOptionsBelow < _SelectBoxList.DEFAULT_MINIMUM_VISIBLE_OPTIONS && maxVisibleOptionsAbove > maxVisibleOptionsBelow && this.options.length > maxVisibleOptionsBelow) {
          this._dropDownPosition = AnchorPosition.ABOVE;
          this.selectDropDownListContainer.remove();
          this.selectionDetailsPane.remove();
          this.selectDropDownContainer.appendChild(this.selectionDetailsPane);
          this.selectDropDownContainer.appendChild(this.selectDropDownListContainer);
          this.selectionDetailsPane.classList.remove("border-top");
          this.selectionDetailsPane.classList.add("border-bottom");
        } else {
          this._dropDownPosition = AnchorPosition.BELOW;
          this.selectDropDownListContainer.remove();
          this.selectionDetailsPane.remove();
          this.selectDropDownContainer.appendChild(this.selectDropDownListContainer);
          this.selectDropDownContainer.appendChild(this.selectionDetailsPane);
          this.selectionDetailsPane.classList.remove("border-bottom");
          this.selectionDetailsPane.classList.add("border-top");
        }
        return true;
      }
      if (selectPosition.top + selectPosition.height > window.innerHeight - 22 || selectPosition.top < _SelectBoxList.DEFAULT_DROPDOWN_MINIMUM_TOP_MARGIN || this._dropDownPosition === AnchorPosition.BELOW && maxVisibleOptionsBelow < 1 || this._dropDownPosition === AnchorPosition.ABOVE && maxVisibleOptionsAbove < 1) {
        this.hideSelectDropDown(true);
        return false;
      }
      if (this._dropDownPosition === AnchorPosition.BELOW) {
        if (this._isVisible && maxVisibleOptionsBelow + maxVisibleOptionsAbove < 1) {
          this.hideSelectDropDown(true);
          return false;
        }
        if (minRequiredDropDownHeight > maxSelectDropDownHeightBelow) {
          listHeight = maxVisibleOptionsBelow * this.getHeight();
        }
      } else {
        if (minRequiredDropDownHeight > maxSelectDropDownHeightAbove) {
          listHeight = maxVisibleOptionsAbove * this.getHeight();
        }
      }
      this.selectList.layout(listHeight);
      this.selectList.domFocus();
      if (this.selectList.length > 0) {
        this.selectList.setFocus([this.selected || 0]);
        this.selectList.reveal(this.selectList.getFocus()[0] || 0);
      }
      if (this._hasDetails) {
        this.selectList.getHTMLElement().style.height = listHeight + verticalPadding + "px";
        this.selectDropDownContainer.style.height = "";
      } else {
        this.selectDropDownContainer.style.height = listHeight + verticalPadding + "px";
      }
      this.updateDetail(this.selected);
      this.selectDropDownContainer.style.width = selectOptimalWidth;
      this.selectDropDownListContainer.setAttribute("tabindex", "0");
      this.selectElement.classList.add("synthetic-focus");
      this.selectDropDownContainer.classList.add("synthetic-focus");
      return true;
    } else {
      return false;
    }
  }
  setWidthControlElement(container) {
    let elementWidth = 0;
    if (container) {
      let longest = 0;
      let longestLength = 0;
      this.options.forEach((option, index) => {
        const detailLength = !!option.detail ? option.detail.length : 0;
        const rightDecoratorLength = !!option.decoratorRight ? option.decoratorRight.length : 0;
        const len = option.text.length + detailLength + rightDecoratorLength;
        if (len > longestLength) {
          longest = index;
          longestLength = len;
        }
      });
      container.textContent = this.options[longest].text + (!!this.options[longest].decoratorRight ? this.options[longest].decoratorRight + " " : "");
      elementWidth = dom.getTotalWidth(container);
    }
    return elementWidth;
  }
  createSelectList(parent) {
    if (this.selectList) {
      return;
    }
    this.selectDropDownListContainer = dom.append(parent, $(".select-box-dropdown-list-container"));
    this.listRenderer = new SelectListRenderer();
    this.selectList = this._register(new List("SelectBoxCustom", this.selectDropDownListContainer, this, [this.listRenderer], {
      useShadows: false,
      verticalScrollMode: ScrollbarVisibility.Visible,
      keyboardSupport: false,
      mouseSupport: false,
      accessibilityProvider: {
        getAriaLabel: (element) => {
          let label = element.text;
          if (element.detail) {
            label += `. ${element.detail}`;
          }
          if (element.decoratorRight) {
            label += `. ${element.decoratorRight}`;
          }
          if (element.description) {
            label += `. ${element.description}`;
          }
          return label;
        },
        getWidgetAriaLabel: () => localize({ key: "selectBox", comment: ["Behave like native select dropdown element."] }, "Select Box"),
        getRole: () => isMacintosh ? "" : "option",
        getWidgetRole: () => "listbox"
      }
    }));
    if (this.selectBoxOptions.ariaLabel) {
      this.selectList.ariaLabel = this.selectBoxOptions.ariaLabel;
    }
    const onKeyDown = this._register(new DomEmitter(this.selectDropDownListContainer, "keydown"));
    const onSelectDropDownKeyDown = Event.chain(
      onKeyDown.event,
      ($2) => $2.filter(() => this.selectList.length > 0).map((e) => new StandardKeyboardEvent(e))
    );
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.Enter))(this.onEnter, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.Tab))(this.onEnter, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.Escape))(this.onEscape, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.UpArrow))(this.onUpArrow, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.DownArrow))(this.onDownArrow, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.PageDown))(this.onPageDown, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.PageUp))(this.onPageUp, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.Home))(this.onHome, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode === KeyCode.End))(this.onEnd, this));
    this._register(Event.chain(onSelectDropDownKeyDown, ($2) => $2.filter((e) => e.keyCode >= KeyCode.Digit0 && e.keyCode <= KeyCode.KeyZ || e.keyCode >= KeyCode.Semicolon && e.keyCode <= KeyCode.NumpadDivide))(this.onCharacter, this));
    this._register(dom.addDisposableListener(this.selectList.getHTMLElement(), dom.EventType.POINTER_UP, (e) => this.onPointerUp(e)));
    this._register(this.selectList.onMouseOver((e) => typeof e.index !== "undefined" && this.selectList.setFocus([e.index])));
    this._register(this.selectList.onDidChangeFocus((e) => this.onListFocus(e)));
    this._register(dom.addDisposableListener(this.selectDropDownContainer, dom.EventType.FOCUS_OUT, (e) => {
      if (!this._isVisible || dom.isAncestor(e.relatedTarget, this.selectDropDownContainer)) {
        return;
      }
      this.onListBlur();
    }));
    this.selectList.getHTMLElement().setAttribute("aria-label", this.selectBoxOptions.ariaLabel || "");
    this.selectList.getHTMLElement().setAttribute("aria-expanded", "true");
    this.styleList();
  }
  // List methods
  // List mouse controller - active exit, select option, fire onDidSelect if change, return focus to parent select
  // Also takes in touchend events
  onPointerUp(e) {
    if (!this.selectList.length) {
      return;
    }
    dom.EventHelper.stop(e);
    const target = e.target;
    if (!target) {
      return;
    }
    if (target.classList.contains("slider")) {
      return;
    }
    const listRowElement = target.closest(".monaco-list-row");
    if (!listRowElement) {
      return;
    }
    const index = Number(listRowElement.getAttribute("data-index"));
    const disabled = listRowElement.classList.contains("option-disabled");
    if (index >= 0 && index < this.options.length && !disabled) {
      this.selected = index;
      this.select(this.selected);
      this.selectList.setFocus([this.selected]);
      this.selectList.reveal(this.selectList.getFocus()[0]);
      if (this.selected !== this._currentSelection) {
        this._currentSelection = this.selected;
        this._onDidSelect.fire({
          index: this.selectElement.selectedIndex,
          selected: this.options[this.selected].text
        });
        if (!!this.options[this.selected] && !!this.options[this.selected].text) {
          this.setTitle(this.options[this.selected].text);
        }
      }
      this.hideSelectDropDown(true);
    }
  }
  // List Exit - passive - implicit no selection change, hide drop-down
  onListBlur() {
    if (this._sticky) {
      return;
    }
    if (this.selected !== this._currentSelection) {
      this.select(this._currentSelection);
    }
    this.hideSelectDropDown(false);
  }
  renderDescriptionMarkdown(text, actionHandler) {
    const cleanRenderedMarkdown = (element) => {
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes.item(i);
        const tagName = child.tagName && child.tagName.toLowerCase();
        if (tagName === "img") {
          child.remove();
        } else {
          cleanRenderedMarkdown(child);
        }
      }
    };
    const rendered = renderMarkdown({ value: text, supportThemeIcons: true }, { actionHandler });
    rendered.element.classList.add("select-box-description-markdown");
    cleanRenderedMarkdown(rendered.element);
    return rendered.element;
  }
  // List Focus Change - passive - update details pane with newly focused element's data
  onListFocus(e) {
    if (!this._isVisible || !this._hasDetails) {
      return;
    }
    this.updateDetail(e.indexes[0]);
  }
  updateDetail(selectedIndex) {
    this.selectionDetailsPane.innerText = "";
    const option = this.options[selectedIndex];
    const description = option?.description ?? "";
    const descriptionIsMarkdown = option?.descriptionIsMarkdown ?? false;
    if (description) {
      if (descriptionIsMarkdown) {
        const actionHandler = option.descriptionMarkdownActionHandler;
        this.selectionDetailsPane.appendChild(this.renderDescriptionMarkdown(description, actionHandler));
      } else {
        this.selectionDetailsPane.innerText = description;
      }
      this.selectionDetailsPane.style.display = "block";
    } else {
      this.selectionDetailsPane.style.display = "none";
    }
    this._skipLayout = true;
    this.contextViewProvider.layout();
    this._skipLayout = false;
  }
  // List keyboard controller
  // List exit - active - hide ContextView dropdown, reset selection, return focus to parent select
  onEscape(e) {
    dom.EventHelper.stop(e);
    this.select(this._currentSelection);
    this.hideSelectDropDown(true);
  }
  // List exit - active - hide ContextView dropdown, return focus to parent select, fire onDidSelect if change
  onEnter(e) {
    dom.EventHelper.stop(e);
    if (this.selected !== this._currentSelection) {
      this._currentSelection = this.selected;
      this._onDidSelect.fire({
        index: this.selectElement.selectedIndex,
        selected: this.options[this.selected].text
      });
      if (!!this.options[this.selected] && !!this.options[this.selected].text) {
        this.setTitle(this.options[this.selected].text);
      }
    }
    this.hideSelectDropDown(true);
  }
  // List navigation - have to handle a disabled option (jump over)
  onDownArrow(e) {
    if (this.selected < this.options.length - 1) {
      dom.EventHelper.stop(e, true);
      const nextOptionDisabled = this.options[this.selected + 1].isDisabled;
      if (nextOptionDisabled && this.options.length > this.selected + 2) {
        this.selected += 2;
      } else if (nextOptionDisabled) {
        return;
      } else {
        this.selected++;
      }
      this.select(this.selected);
      this.selectList.setFocus([this.selected]);
      this.selectList.reveal(this.selectList.getFocus()[0]);
    }
  }
  onUpArrow(e) {
    if (this.selected > 0) {
      dom.EventHelper.stop(e, true);
      const previousOptionDisabled = this.options[this.selected - 1].isDisabled;
      if (previousOptionDisabled && this.selected > 1) {
        this.selected -= 2;
      } else {
        this.selected--;
      }
      this.select(this.selected);
      this.selectList.setFocus([this.selected]);
      this.selectList.reveal(this.selectList.getFocus()[0]);
    }
  }
  onPageUp(e) {
    dom.EventHelper.stop(e);
    this.selectList.focusPreviousPage();
    setTimeout(() => {
      this.selected = this.selectList.getFocus()[0];
      if (this.options[this.selected].isDisabled && this.selected < this.options.length - 1) {
        this.selected++;
        this.selectList.setFocus([this.selected]);
      }
      this.selectList.reveal(this.selected);
      this.select(this.selected);
    }, 1);
  }
  onPageDown(e) {
    dom.EventHelper.stop(e);
    this.selectList.focusNextPage();
    setTimeout(() => {
      this.selected = this.selectList.getFocus()[0];
      if (this.options[this.selected].isDisabled && this.selected > 0) {
        this.selected--;
        this.selectList.setFocus([this.selected]);
      }
      this.selectList.reveal(this.selected);
      this.select(this.selected);
    }, 1);
  }
  onHome(e) {
    dom.EventHelper.stop(e);
    if (this.options.length < 2) {
      return;
    }
    this.selected = 0;
    if (this.options[this.selected].isDisabled && this.selected > 1) {
      this.selected++;
    }
    this.selectList.setFocus([this.selected]);
    this.selectList.reveal(this.selected);
    this.select(this.selected);
  }
  onEnd(e) {
    dom.EventHelper.stop(e);
    if (this.options.length < 2) {
      return;
    }
    this.selected = this.options.length - 1;
    if (this.options[this.selected].isDisabled && this.selected > 1) {
      this.selected--;
    }
    this.selectList.setFocus([this.selected]);
    this.selectList.reveal(this.selected);
    this.select(this.selected);
  }
  // Mimic option first character navigation of native select
  onCharacter(e) {
    const ch = KeyCodeUtils.toString(e.keyCode);
    let optionIndex = -1;
    for (let i = 0; i < this.options.length - 1; i++) {
      optionIndex = (i + this.selected + 1) % this.options.length;
      if (this.options[optionIndex].text.charAt(0).toUpperCase() === ch && !this.options[optionIndex].isDisabled) {
        this.select(optionIndex);
        this.selectList.setFocus([optionIndex]);
        this.selectList.reveal(this.selectList.getFocus()[0]);
        dom.EventHelper.stop(e);
        break;
      }
    }
  }
  dispose() {
    this.hideSelectDropDown(false);
    super.dispose();
  }
};
_SelectBoxList.DEFAULT_DROPDOWN_MINIMUM_BOTTOM_MARGIN = 32;
_SelectBoxList.DEFAULT_DROPDOWN_MINIMUM_TOP_MARGIN = 2;
_SelectBoxList.DEFAULT_MINIMUM_VISIBLE_OPTIONS = 3;
let SelectBoxList = _SelectBoxList;
export {
  SelectBoxList
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvc2VsZWN0Qm94L3NlbGVjdEJveEN1c3RvbS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi9kb20uanMnO1xuaW1wb3J0ICogYXMgZG9tU3R5bGVzaGVldHNKcyBmcm9tICcuLi8uLi9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgKiBhcyBjc3NKcyBmcm9tICcuLi8uLi9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyBEb21FbWl0dGVyIH0gZnJvbSAnLi4vLi4vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUNvbnRlbnRBY3Rpb25IYW5kbGVyIH0gZnJvbSAnLi4vLi4vZm9ybWF0dGVkVGV4dFJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgcmVuZGVyTWFya2Rvd24gfSBmcm9tICcuLi8uLi9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEFuY2hvclBvc2l0aW9uLCBJQ29udGV4dFZpZXdQcm92aWRlciB9IGZyb20gJy4uL2NvbnRleHR2aWV3L2NvbnRleHR2aWV3LmpzJztcbmltcG9ydCB0eXBlIHsgSU1hbmFnZWRIb3ZlciB9IGZyb20gJy4uL2hvdmVyL2hvdmVyLmpzJztcbmltcG9ydCB7IGdldEJhc2VMYXllckhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi9ob3Zlci9ob3ZlckRlbGVnYXRlMi5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IElMaXN0RXZlbnQsIElMaXN0UmVuZGVyZXIsIElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IExpc3QgfSBmcm9tICcuLi9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVNlbGVjdEJveERlbGVnYXRlLCBJU2VsZWN0Qm94T3B0aW9ucywgSVNlbGVjdEJveFN0eWxlcywgSVNlbGVjdERhdGEsIElTZWxlY3RPcHRpb25JdGVtIH0gZnJvbSAnLi9zZWxlY3RCb3guanMnO1xuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5Q29kZVV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTY3JvbGxiYXJWaXNpYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Njcm9sbGFibGUuanMnO1xuaW1wb3J0ICcuL3NlbGVjdEJveEN1c3RvbS5jc3MnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5cbmNvbnN0ICQgPSBkb20uJDtcblxuY29uc3QgU0VMRUNUX09QVElPTl9FTlRSWV9URU1QTEFURV9JRCA9ICdzZWxlY3RPcHRpb24uZW50cnkudGVtcGxhdGUnO1xuXG5pbnRlcmZhY2UgSVNlbGVjdExpc3RUZW1wbGF0ZURhdGEge1xuXHRyb290OiBIVE1MRWxlbWVudDtcblx0dGV4dDogSFRNTEVsZW1lbnQ7XG5cdGRldGFpbDogSFRNTEVsZW1lbnQ7XG5cdGRlY29yYXRvclJpZ2h0OiBIVE1MRWxlbWVudDtcbn1cblxuY2xhc3MgU2VsZWN0TGlzdFJlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxJU2VsZWN0T3B0aW9uSXRlbSwgSVNlbGVjdExpc3RUZW1wbGF0ZURhdGE+IHtcblxuXHRnZXQgdGVtcGxhdGVJZCgpOiBzdHJpbmcgeyByZXR1cm4gU0VMRUNUX09QVElPTl9FTlRSWV9URU1QTEFURV9JRDsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJU2VsZWN0TGlzdFRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGF0YTogSVNlbGVjdExpc3RUZW1wbGF0ZURhdGEgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGRhdGEucm9vdCA9IGNvbnRhaW5lcjtcblx0XHRkYXRhLnRleHQgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLm9wdGlvbi10ZXh0JykpO1xuXHRcdGRhdGEuZGV0YWlsID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5vcHRpb24tZGV0YWlsJykpO1xuXHRcdGRhdGEuZGVjb3JhdG9yUmlnaHQgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLm9wdGlvbi1kZWNvcmF0b3ItcmlnaHQnKSk7XG5cblx0XHRyZXR1cm4gZGF0YTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVNlbGVjdE9wdGlvbkl0ZW0sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVNlbGVjdExpc3RUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBkYXRhOiBJU2VsZWN0TGlzdFRlbXBsYXRlRGF0YSA9IHRlbXBsYXRlRGF0YTtcblxuXHRcdGNvbnN0IHRleHQgPSBlbGVtZW50LnRleHQ7XG5cdFx0Y29uc3QgZGV0YWlsID0gZWxlbWVudC5kZXRhaWw7XG5cdFx0Y29uc3QgZGVjb3JhdG9yUmlnaHQgPSBlbGVtZW50LmRlY29yYXRvclJpZ2h0O1xuXG5cdFx0Y29uc3QgaXNEaXNhYmxlZCA9IGVsZW1lbnQuaXNEaXNhYmxlZDtcblxuXHRcdGRhdGEudGV4dC50ZXh0Q29udGVudCA9IHRleHQ7XG5cdFx0ZGF0YS5kZXRhaWwudGV4dENvbnRlbnQgPSAhIWRldGFpbCA/IGRldGFpbCA6ICcnO1xuXHRcdGRhdGEuZGVjb3JhdG9yUmlnaHQuaW5uZXJUZXh0ID0gISFkZWNvcmF0b3JSaWdodCA/IGRlY29yYXRvclJpZ2h0IDogJyc7XG5cblx0XHQvLyBwc2V1ZG8tc2VsZWN0IGRpc2FibGVkIG9wdGlvblxuXHRcdGlmIChpc0Rpc2FibGVkKSB7XG5cdFx0XHRkYXRhLnJvb3QuY2xhc3NMaXN0LmFkZCgnb3B0aW9uLWRpc2FibGVkJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIE1ha2Ugc3VyZSB3ZSBkbyBjbGFzcyByZW1vdmFsIGZyb20gcHJpb3IgdGVtcGxhdGUgcmVuZGVyaW5nXG5cdFx0XHRkYXRhLnJvb3QuY2xhc3NMaXN0LnJlbW92ZSgnb3B0aW9uLWRpc2FibGVkJyk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKF90ZW1wbGF0ZURhdGE6IElTZWxlY3RMaXN0VGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Ly8gbm9vcFxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZWxlY3RCb3hMaXN0IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElTZWxlY3RCb3hEZWxlZ2F0ZSwgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8SVNlbGVjdE9wdGlvbkl0ZW0+IHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUZBVUxUX0RST1BET1dOX01JTklNVU1fQk9UVE9NX01BUkdJTiA9IDMyO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUZBVUxUX0RST1BET1dOX01JTklNVU1fVE9QX01BUkdJTiA9IDI7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfTUlOSU1VTV9WSVNJQkxFX09QVElPTlMgPSAzO1xuXG5cdHByaXZhdGUgX2lzVmlzaWJsZTogYm9vbGVhbjtcblx0cHJpdmF0ZSBzZWxlY3RCb3hPcHRpb25zOiBJU2VsZWN0Qm94T3B0aW9ucztcblx0cHJpdmF0ZSBzZWxlY3RFbGVtZW50OiBIVE1MU2VsZWN0RWxlbWVudDtcblx0cHJpdmF0ZSBjb250YWluZXI/OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBvcHRpb25zOiBJU2VsZWN0T3B0aW9uSXRlbVtdID0gW107XG5cdHByaXZhdGUgc2VsZWN0ZWQ6IG51bWJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTZWxlY3Q6IEVtaXR0ZXI8SVNlbGVjdERhdGE+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHN0eWxlczogSVNlbGVjdEJveFN0eWxlcztcblx0cHJpdmF0ZSBsaXN0UmVuZGVyZXIhOiBTZWxlY3RMaXN0UmVuZGVyZXI7XG5cdHByaXZhdGUgY29udGV4dFZpZXdQcm92aWRlciE6IElDb250ZXh0Vmlld1Byb3ZpZGVyO1xuXHRwcml2YXRlIHNlbGVjdERyb3BEb3duQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgc3R5bGVFbGVtZW50ITogSFRNTFN0eWxlRWxlbWVudDtcblx0cHJpdmF0ZSBzZWxlY3RMaXN0ITogTGlzdDxJU2VsZWN0T3B0aW9uSXRlbT47XG5cdHByaXZhdGUgc2VsZWN0RHJvcERvd25MaXN0Q29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgd2lkdGhDb250cm9sRWxlbWVudCE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9jdXJyZW50U2VsZWN0aW9uID0gMDtcblx0cHJpdmF0ZSBfZHJvcERvd25Qb3NpdGlvbiE6IEFuY2hvclBvc2l0aW9uO1xuXHRwcml2YXRlIF9oYXNEZXRhaWxzOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgc2VsZWN0aW9uRGV0YWlsc1BhbmUhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfc2tpcExheW91dDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9jYWNoZWRNYXhEZXRhaWxzSGVpZ2h0PzogbnVtYmVyO1xuXHRwcml2YXRlIF9ob3Zlcj86IElNYW5hZ2VkSG92ZXI7XG5cblx0cHJpdmF0ZSBfc3RpY2t5OiBib29sZWFuID0gZmFsc2U7IC8vIGZvciBkZXYgcHVycG9zZXMgb25seVxuXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnM6IElTZWxlY3RPcHRpb25JdGVtW10sIHNlbGVjdGVkOiBudW1iZXIsIGNvbnRleHRWaWV3UHJvdmlkZXI6IElDb250ZXh0Vmlld1Byb3ZpZGVyLCBzdHlsZXM6IElTZWxlY3RCb3hTdHlsZXMsIHNlbGVjdEJveE9wdGlvbnM/OiBJU2VsZWN0Qm94T3B0aW9ucykge1xuXG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9pc1Zpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLnN0eWxlcyA9IHN0eWxlcztcblxuXHRcdHRoaXMuc2VsZWN0Qm94T3B0aW9ucyA9IHNlbGVjdEJveE9wdGlvbnMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRcdGlmICh0eXBlb2YgdGhpcy5zZWxlY3RCb3hPcHRpb25zLm1pbkJvdHRvbU1hcmdpbiAhPT0gJ251bWJlcicpIHtcblx0XHRcdHRoaXMuc2VsZWN0Qm94T3B0aW9ucy5taW5Cb3R0b21NYXJnaW4gPSBTZWxlY3RCb3hMaXN0LkRFRkFVTFRfRFJPUERPV05fTUlOSU1VTV9CT1RUT01fTUFSR0lOO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5zZWxlY3RCb3hPcHRpb25zLm1pbkJvdHRvbU1hcmdpbiA8IDApIHtcblx0XHRcdHRoaXMuc2VsZWN0Qm94T3B0aW9ucy5taW5Cb3R0b21NYXJnaW4gPSAwO1xuXHRcdH1cblxuXHRcdHRoaXMuc2VsZWN0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuXG5cdFx0Ly8gVXNlIGN1c3RvbSBDU1MgdmFycyBmb3IgcGFkZGluZyBjYWxjdWxhdGlvblxuXHRcdHRoaXMuc2VsZWN0RWxlbWVudC5jbGFzc05hbWUgPSAnbW9uYWNvLXNlbGVjdC1ib3ggbW9uYWNvLXNlbGVjdC1ib3gtZHJvcGRvd24tcGFkZGluZyc7XG5cblx0XHRpZiAodHlwZW9mIHRoaXMuc2VsZWN0Qm94T3B0aW9ucy5hcmlhTGFiZWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLnNlbGVjdEVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGhpcy5zZWxlY3RCb3hPcHRpb25zLmFyaWFMYWJlbCk7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB0aGlzLnNlbGVjdEJveE9wdGlvbnMuYXJpYURlc2NyaXB0aW9uID09PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5zZWxlY3RFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1kZXNjcmlwdGlvbicsIHRoaXMuc2VsZWN0Qm94T3B0aW9ucy5hcmlhRGVzY3JpcHRpb24pO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkU2VsZWN0ID0gbmV3IEVtaXR0ZXI8SVNlbGVjdERhdGE+KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb25EaWRTZWxlY3QpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHRcdHRoaXMuY29uc3RydWN0U2VsZWN0RHJvcERvd24oY29udGV4dFZpZXdQcm92aWRlcik7XG5cblx0XHR0aGlzLnNlbGVjdGVkID0gc2VsZWN0ZWQgfHwgMDtcblxuXHRcdGlmIChvcHRpb25zKSB7XG5cdFx0XHR0aGlzLnNldE9wdGlvbnMob3B0aW9ucywgc2VsZWN0ZWQpO1xuXHRcdH1cblxuXHRcdHRoaXMuaW5pdFN0eWxlU2hlZXQoKTtcblxuXHR9XG5cblx0cHJpdmF0ZSBzZXRUaXRsZSh0aXRsZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9ob3ZlciAmJiB0aXRsZSkge1xuXHRcdFx0dGhpcy5faG92ZXIgPSB0aGlzLl9yZWdpc3RlcihnZXRCYXNlTGF5ZXJIb3ZlckRlbGVnYXRlKCkuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIHRoaXMuc2VsZWN0RWxlbWVudCwgdGl0bGUpKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2hvdmVyKSB7XG5cdFx0XHR0aGlzLl9ob3Zlci51cGRhdGUodGl0bGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIElEZWxlZ2F0ZSAtIExpc3QgcmVuZGVyZXJcblxuXHRnZXRIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMjI7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFNFTEVDVF9PUFRJT05fRU5UUllfVEVNUExBVEVfSUQ7XG5cdH1cblxuXHRwcml2YXRlIGNvbnN0cnVjdFNlbGVjdERyb3BEb3duKGNvbnRleHRWaWV3UHJvdmlkZXI6IElDb250ZXh0Vmlld1Byb3ZpZGVyKSB7XG5cblx0XHQvLyBTZXRVcCBDb250ZXh0VmlldyBjb250YWluZXIgdG8gaG9sZCBzZWxlY3QgRHJvcGRvd25cblx0XHR0aGlzLmNvbnRleHRWaWV3UHJvdmlkZXIgPSBjb250ZXh0Vmlld1Byb3ZpZGVyO1xuXHRcdHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIgPSBkb20uJCgnLm1vbmFjby1zZWxlY3QtYm94LWRyb3Bkb3duLWNvbnRhaW5lcicpO1xuXHRcdC8vIFVzZSBjdXN0b20gQ1NTIHZhcnMgZm9yIHBhZGRpbmcgY2FsY3VsYXRpb24gKHNoYXJlZCB3aXRoIHBhcmVudCBzZWxlY3QpXG5cdFx0dGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdtb25hY28tc2VsZWN0LWJveC1kcm9wZG93bi1wYWRkaW5nJyk7XG5cblx0XHQvLyBTZXR1cCBjb250YWluZXIgZm9yIHNlbGVjdCBvcHRpb24gZGV0YWlsc1xuXHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUgPSBkb20uYXBwZW5kKHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIsICQoJy5zZWxlY3QtYm94LWRldGFpbHMtcGFuZScpKTtcblxuXHRcdC8vIENyZWF0ZSBzcGFuIGZsZXggYm94IGl0ZW0vZGl2IHdlIGNhbiBtZWFzdXJlIGFuZCBjb250cm9sXG5cdFx0Y29uc3Qgd2lkdGhDb250cm9sT3V0ZXJEaXYgPSBkb20uYXBwZW5kKHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIsICQoJy5zZWxlY3QtYm94LWRyb3Bkb3duLWNvbnRhaW5lci13aWR0aC1jb250cm9sJykpO1xuXHRcdGNvbnN0IHdpZHRoQ29udHJvbElubmVyRGl2ID0gZG9tLmFwcGVuZCh3aWR0aENvbnRyb2xPdXRlckRpdiwgJCgnLndpZHRoLWNvbnRyb2wtZGl2JykpO1xuXHRcdHRoaXMud2lkdGhDb250cm9sRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHR0aGlzLndpZHRoQ29udHJvbEVsZW1lbnQuY2xhc3NOYW1lID0gJ29wdGlvbi10ZXh0LXdpZHRoLWNvbnRyb2wnO1xuXHRcdGRvbS5hcHBlbmQod2lkdGhDb250cm9sSW5uZXJEaXYsIHRoaXMud2lkdGhDb250cm9sRWxlbWVudCk7XG5cblx0XHQvLyBBbHdheXMgZGVmYXVsdCB0byBiZWxvdyBwb3NpdGlvblxuXHRcdHRoaXMuX2Ryb3BEb3duUG9zaXRpb24gPSBBbmNob3JQb3NpdGlvbi5CRUxPVztcblxuXHRcdC8vIElubGluZSBzdHlsZXNoZWV0IGZvciB0aGVtZXNcblx0XHR0aGlzLnN0eWxlRWxlbWVudCA9IGRvbVN0eWxlc2hlZXRzSnMuY3JlYXRlU3R5bGVTaGVldCh0aGlzLnNlbGVjdERyb3BEb3duQ29udGFpbmVyKTtcblxuXHRcdC8vIFByZXZlbnQgZHJhZ2dpbmcgb2YgZHJvcGRvd24gIzExNDMyOVxuXHRcdHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIuc2V0QXR0cmlidXRlKCdkcmFnZ2FibGUnLCAndHJ1ZScpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lciwgZG9tLkV2ZW50VHlwZS5EUkFHX1NUQVJULCAoZSkgPT4ge1xuXHRcdFx0ZG9tLkV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpIHtcblxuXHRcdC8vIFBhcmVudCBuYXRpdmUgc2VsZWN0IGtleWJvYXJkIGxpc3RlbmVyc1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuc2VsZWN0RWxlbWVudCwgJ2NoYW5nZScsIChlKSA9PiB7XG5cdFx0XHR0aGlzLnNlbGVjdGVkID0gZS50YXJnZXQuc2VsZWN0ZWRJbmRleDtcblx0XHRcdHRoaXMuX29uRGlkU2VsZWN0LmZpcmUoe1xuXHRcdFx0XHRpbmRleDogZS50YXJnZXQuc2VsZWN0ZWRJbmRleCxcblx0XHRcdFx0c2VsZWN0ZWQ6IGUudGFyZ2V0LnZhbHVlXG5cdFx0XHR9KTtcblx0XHRcdGlmICghIXRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXSAmJiAhIXRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXS50ZXh0KSB7XG5cdFx0XHRcdHRoaXMuc2V0VGl0bGUodGhpcy5vcHRpb25zW3RoaXMuc2VsZWN0ZWRdLnRleHQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIEhhdmUgdG8gaW1wbGVtZW50IGJvdGgga2V5Ym9hcmQgYW5kIG1vdXNlIGNvbnRyb2xsZXJzIHRvIGhhbmRsZSBkaXNhYmxlZCBvcHRpb25zXG5cdFx0Ly8gSW50ZXJjZXB0IG1vdXNlIGV2ZW50cyB0byBvdmVycmlkZSBub3JtYWwgc2VsZWN0IGFjdGlvbnMgb24gcGFyZW50c1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnNlbGVjdEVsZW1lbnQsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIChlKSA9PiB7XG5cdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblxuXHRcdFx0aWYgKHRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLmhpZGVTZWxlY3REcm9wRG93bih0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc2hvd1NlbGVjdERyb3BEb3duKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnNlbGVjdEVsZW1lbnQsIGRvbS5FdmVudFR5cGUuTU9VU0VfRE9XTiwgKGUpID0+IHtcblx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdH0pKTtcblxuXHRcdC8vIEludGVyY2VwdCB0b3VjaCBldmVudHNcblx0XHQvLyBUaGUgZm9sbG93aW5nIGltcGxlbWVudGF0aW9uIGlzIHNsaWdodGx5IGRpZmZlcmVudCBmcm9tIHRoZSBtb3VzZSBldmVudCBoYW5kbGVycyBhYm92ZS5cblx0XHQvLyBVc2UgdGhlIGZvbGxvd2luZyBoZWxwZXIgdmFyaWFibGUsIG90aGVyd2lzZSB0aGUgbGlzdCBmbGlja2Vycy5cblx0XHRsZXQgbGlzdElzVmlzaWJsZU9uVG91Y2hTdGFydDogYm9vbGVhbjtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuc2VsZWN0RWxlbWVudCwgJ3RvdWNoc3RhcnQnLCAoZSkgPT4ge1xuXHRcdFx0bGlzdElzVmlzaWJsZU9uVG91Y2hTdGFydCA9IHRoaXMuX2lzVmlzaWJsZTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnNlbGVjdEVsZW1lbnQsICd0b3VjaGVuZCcsIChlKSA9PiB7XG5cdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblxuXHRcdFx0aWYgKGxpc3RJc1Zpc2libGVPblRvdWNoU3RhcnQpIHtcblx0XHRcdFx0dGhpcy5oaWRlU2VsZWN0RHJvcERvd24odHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnNob3dTZWxlY3REcm9wRG93bigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIEludGVyY2VwdCBrZXlib2FyZCBoYW5kbGluZ1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnNlbGVjdEVsZW1lbnQsIGRvbS5FdmVudFR5cGUuS0VZX0RPV04sIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRsZXQgc2hvd0Ryb3BEb3duID0gZmFsc2U7XG5cblx0XHRcdC8vIENyZWF0ZSBhbmQgZHJvcCBkb3duIHNlbGVjdCBsaXN0IG9uIGtleWJvYXJkIHNlbGVjdFxuXHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkRvd25BcnJvdyB8fCBldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLlVwQXJyb3cgfHwgZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5TcGFjZSB8fCBldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkVudGVyKSB7XG5cdFx0XHRcdFx0c2hvd0Ryb3BEb3duID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGUuRG93bkFycm93ICYmIGV2ZW50LmFsdEtleSB8fCBldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLlVwQXJyb3cgJiYgZXZlbnQuYWx0S2V5IHx8IGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGUuU3BhY2UgfHwgZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5FbnRlcikge1xuXHRcdFx0XHRcdHNob3dEcm9wRG93biA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHNob3dEcm9wRG93bikge1xuXHRcdFx0XHR0aGlzLnNob3dTZWxlY3REcm9wRG93bigpO1xuXHRcdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRGlkU2VsZWN0KCk6IEV2ZW50PElTZWxlY3REYXRhPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkU2VsZWN0LmV2ZW50O1xuXHR9XG5cblx0cHVibGljIHNldE9wdGlvbnMob3B0aW9uczogSVNlbGVjdE9wdGlvbkl0ZW1bXSwgc2VsZWN0ZWQ/OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoIWFycmF5cy5lcXVhbHModGhpcy5vcHRpb25zLCBvcHRpb25zKSkge1xuXHRcdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHRcdHRoaXMuc2VsZWN0RWxlbWVudC5vcHRpb25zLmxlbmd0aCA9IDA7XG5cdFx0XHR0aGlzLl9oYXNEZXRhaWxzID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9jYWNoZWRNYXhEZXRhaWxzSGVpZ2h0ID0gdW5kZWZpbmVkO1xuXG5cdFx0XHR0aGlzLm9wdGlvbnMuZm9yRWFjaCgob3B0aW9uLCBpbmRleCkgPT4ge1xuXHRcdFx0XHR0aGlzLnNlbGVjdEVsZW1lbnQuYWRkKHRoaXMuY3JlYXRlT3B0aW9uKG9wdGlvbi50ZXh0LCBpbmRleCwgb3B0aW9uLmlzRGlzYWJsZWQpKTtcblx0XHRcdFx0aWYgKHR5cGVvZiBvcHRpb24uZGVzY3JpcHRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0dGhpcy5faGFzRGV0YWlscyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChzZWxlY3RlZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnNlbGVjdChzZWxlY3RlZCk7XG5cdFx0XHQvLyBTZXQgY3VycmVudCA9IHNlbGVjdGVkIHNpbmNlIHRoaXMgaXMgbm90IG5lY2Vzc2FyaWx5IGEgdXNlciBleGl0XG5cdFx0XHR0aGlzLl9jdXJyZW50U2VsZWN0aW9uID0gdGhpcy5zZWxlY3RlZDtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2V0RW5hYmxlZChlbmFibGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnNlbGVjdEVsZW1lbnQuZGlzYWJsZWQgPSAhZW5hYmxlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRPcHRpb25zTGlzdCgpIHtcblxuXHRcdC8vIE1pcnJvciBvcHRpb25zIGluIGRyb3AtZG93blxuXHRcdC8vIFBvcHVsYXRlIHNlbGVjdCBsaXN0IGZvciBub24tbmF0aXZlIHNlbGVjdCBtb2RlXG5cdFx0dGhpcy5zZWxlY3RMaXN0Py5zcGxpY2UoMCwgdGhpcy5zZWxlY3RMaXN0Lmxlbmd0aCwgdGhpcy5vcHRpb25zKTtcblx0fVxuXG5cdHB1YmxpYyBzZWxlY3QoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXG5cdFx0aWYgKGluZGV4ID49IDAgJiYgaW5kZXggPCB0aGlzLm9wdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnNlbGVjdGVkID0gaW5kZXg7XG5cdFx0fSBlbHNlIGlmIChpbmRleCA+IHRoaXMub3B0aW9ucy5sZW5ndGggLSAxKSB7XG5cdFx0XHQvLyBBZGp1c3QgaW5kZXggdG8gZW5kIG9mIGxpc3Rcblx0XHRcdC8vIFRoaXMgY291bGQgbWFrZSBjbGllbnQgb3V0IG9mIHN5bmMgd2l0aCB0aGUgc2VsZWN0XG5cdFx0XHR0aGlzLnNlbGVjdCh0aGlzLm9wdGlvbnMubGVuZ3RoIC0gMSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnNlbGVjdGVkIDwgMCkge1xuXHRcdFx0dGhpcy5zZWxlY3RlZCA9IDA7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZWxlY3RFbGVtZW50LnNlbGVjdGVkSW5kZXggPSB0aGlzLnNlbGVjdGVkO1xuXHRcdGlmICghIXRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXSAmJiAhIXRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXS50ZXh0KSB7XG5cdFx0XHR0aGlzLnNldFRpdGxlKHRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXS50ZXh0KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc2V0QXJpYUxhYmVsKGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnNlbGVjdEJveE9wdGlvbnMuYXJpYUxhYmVsID0gbGFiZWw7XG5cdFx0dGhpcy5zZWxlY3RFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRoaXMuc2VsZWN0Qm94T3B0aW9ucy5hcmlhTGFiZWwpO1xuXHR9XG5cblx0cHVibGljIGZvY3VzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnNlbGVjdEVsZW1lbnQpIHtcblx0XHRcdHRoaXMuc2VsZWN0RWxlbWVudC50YWJJbmRleCA9IDA7XG5cdFx0XHR0aGlzLnNlbGVjdEVsZW1lbnQuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYmx1cigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zZWxlY3RFbGVtZW50KSB7XG5cdFx0XHR0aGlzLnNlbGVjdEVsZW1lbnQudGFiSW5kZXggPSAtMTtcblx0XHRcdHRoaXMuc2VsZWN0RWxlbWVudC5ibHVyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNldEZvY3VzYWJsZShmb2N1c2FibGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnNlbGVjdEVsZW1lbnQudGFiSW5kZXggPSBmb2N1c2FibGUgPyAwIDogLTE7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnc2VsZWN0LWNvbnRhaW5lcicpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnNlbGVjdEVsZW1lbnQpO1xuXHRcdHRoaXMuc3R5bGVTZWxlY3RFbGVtZW50KCk7XG5cdH1cblxuXHRwcml2YXRlIGluaXRTdHlsZVNoZWV0KCk6IHZvaWQge1xuXG5cdFx0Y29uc3QgY29udGVudDogc3RyaW5nW10gPSBbXTtcblxuXHRcdC8vIFN0eWxlIG5vbi1uYXRpdmUgc2VsZWN0IG1vZGVcblxuXHRcdGlmICh0aGlzLnN0eWxlcy5saXN0Rm9jdXNCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tc2VsZWN0LWJveC1kcm9wZG93bi1jb250YWluZXIgPiAuc2VsZWN0LWJveC1kcm9wZG93bi1saXN0LWNvbnRhaW5lciAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIHsgYmFja2dyb3VuZC1jb2xvcjogJHt0aGlzLnN0eWxlcy5saXN0Rm9jdXNCYWNrZ3JvdW5kfSAhaW1wb3J0YW50OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3R5bGVzLmxpc3RGb2N1c0ZvcmVncm91bmQpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1zZWxlY3QtYm94LWRyb3Bkb3duLWNvbnRhaW5lciA+IC5zZWxlY3QtYm94LWRyb3Bkb3duLWxpc3QtY29udGFpbmVyIC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBjb2xvcjogJHt0aGlzLnN0eWxlcy5saXN0Rm9jdXNGb3JlZ3JvdW5kfSAhaW1wb3J0YW50OyB9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3R5bGVzLmRlY29yYXRvclJpZ2h0Rm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXNlbGVjdC1ib3gtZHJvcGRvd24tY29udGFpbmVyID4gLnNlbGVjdC1ib3gtZHJvcGRvd24tbGlzdC1jb250YWluZXIgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3c6bm90KC5mb2N1c2VkKSAub3B0aW9uLWRlY29yYXRvci1yaWdodCB7IGNvbG9yOiAke3RoaXMuc3R5bGVzLmRlY29yYXRvclJpZ2h0Rm9yZWdyb3VuZH07IH1gKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zdHlsZXMuc2VsZWN0QmFja2dyb3VuZCAmJiB0aGlzLnN0eWxlcy5zZWxlY3RCb3JkZXIgJiYgdGhpcy5zdHlsZXMuc2VsZWN0Qm9yZGVyICE9PSB0aGlzLnN0eWxlcy5zZWxlY3RCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tc2VsZWN0LWJveC1kcm9wZG93bi1jb250YWluZXIgeyBib3JkZXI6IDFweCBzb2xpZCAke3RoaXMuc3R5bGVzLnNlbGVjdEJvcmRlcn0gfSBgKTtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1zZWxlY3QtYm94LWRyb3Bkb3duLWNvbnRhaW5lciA+IC5zZWxlY3QtYm94LWRldGFpbHMtcGFuZS5ib3JkZXItdG9wIHsgYm9yZGVyLXRvcDogMXB4IHNvbGlkICR7dGhpcy5zdHlsZXMuc2VsZWN0Qm9yZGVyfSB9IGApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXNlbGVjdC1ib3gtZHJvcGRvd24tY29udGFpbmVyID4gLnNlbGVjdC1ib3gtZGV0YWlscy1wYW5lLmJvcmRlci1ib3R0b20geyBib3JkZXItYm90dG9tOiAxcHggc29saWQgJHt0aGlzLnN0eWxlcy5zZWxlY3RCb3JkZXJ9IH0gYCk7XG5cblx0XHR9XG5cdFx0ZWxzZSBpZiAodGhpcy5zdHlsZXMuc2VsZWN0TGlzdEJvcmRlcikge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXNlbGVjdC1ib3gtZHJvcGRvd24tY29udGFpbmVyID4gLnNlbGVjdC1ib3gtZGV0YWlscy1wYW5lLmJvcmRlci10b3AgeyBib3JkZXItdG9wOiAxcHggc29saWQgJHt0aGlzLnN0eWxlcy5zZWxlY3RMaXN0Qm9yZGVyfSB9IGApO1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXNlbGVjdC1ib3gtZHJvcGRvd24tY29udGFpbmVyID4gLnNlbGVjdC1ib3gtZGV0YWlscy1wYW5lLmJvcmRlci1ib3R0b20geyBib3JkZXItYm90dG9tOiAxcHggc29saWQgJHt0aGlzLnN0eWxlcy5zZWxlY3RMaXN0Qm9yZGVyfSB9IGApO1xuXHRcdH1cblxuXHRcdC8vIEhvdmVyIGZvcmVncm91bmQgLSBpZ25vcmUgZm9yIGRpc2FibGVkIG9wdGlvbnNcblx0XHRpZiAodGhpcy5zdHlsZXMubGlzdEhvdmVyRm9yZWdyb3VuZCkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXNlbGVjdC1ib3gtZHJvcGRvd24tY29udGFpbmVyID4gLnNlbGVjdC1ib3gtZHJvcGRvd24tbGlzdC1jb250YWluZXIgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3c6bm90KC5vcHRpb24tZGlzYWJsZWQpOm5vdCguZm9jdXNlZCk6aG92ZXIgeyBjb2xvcjogJHt0aGlzLnN0eWxlcy5saXN0SG92ZXJGb3JlZ3JvdW5kfSAhaW1wb3J0YW50OyB9YCk7XG5cdFx0fVxuXG5cdFx0Ly8gSG92ZXIgYmFja2dyb3VuZCAtIGlnbm9yZSBmb3IgZGlzYWJsZWQgb3B0aW9uc1xuXHRcdGlmICh0aGlzLnN0eWxlcy5saXN0SG92ZXJCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb250ZW50LnB1c2goYC5tb25hY28tc2VsZWN0LWJveC1kcm9wZG93bi1jb250YWluZXIgPiAuc2VsZWN0LWJveC1kcm9wZG93bi1saXN0LWNvbnRhaW5lciAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdzpub3QoLm9wdGlvbi1kaXNhYmxlZCk6bm90KC5mb2N1c2VkKTpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6ICR7dGhpcy5zdHlsZXMubGlzdEhvdmVyQmFja2dyb3VuZH0gIWltcG9ydGFudDsgfWApO1xuXHRcdH1cblxuXHRcdC8vIE1hdGNoIHF1aWNrIGlucHV0IG91dGxpbmUgc3R5bGVzIC0gaWdub3JlIGZvciBkaXNhYmxlZCBvcHRpb25zXG5cdFx0aWYgKHRoaXMuc3R5bGVzLmxpc3RGb2N1c091dGxpbmUpIHtcblx0XHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1zZWxlY3QtYm94LWRyb3Bkb3duLWNvbnRhaW5lciA+IC5zZWxlY3QtYm94LWRyb3Bkb3duLWxpc3QtY29udGFpbmVyIC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93LmZvY3VzZWQgeyBvdXRsaW5lOiAxLjZweCBkb3R0ZWQgJHt0aGlzLnN0eWxlcy5saXN0Rm9jdXNPdXRsaW5lfSAhaW1wb3J0YW50OyBvdXRsaW5lLW9mZnNldDogLTEuNnB4ICFpbXBvcnRhbnQ7IH1gKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zdHlsZXMubGlzdEhvdmVyT3V0bGluZSkge1xuXHRcdFx0Y29udGVudC5wdXNoKGAubW9uYWNvLXNlbGVjdC1ib3gtZHJvcGRvd24tY29udGFpbmVyID4gLnNlbGVjdC1ib3gtZHJvcGRvd24tbGlzdC1jb250YWluZXIgLm1vbmFjby1saXN0IC5tb25hY28tbGlzdC1yb3c6bm90KC5vcHRpb24tZGlzYWJsZWQpOm5vdCguZm9jdXNlZCk6aG92ZXIgeyBvdXRsaW5lOiAxLjZweCBkYXNoZWQgJHt0aGlzLnN0eWxlcy5saXN0SG92ZXJPdXRsaW5lfSAhaW1wb3J0YW50OyBvdXRsaW5lLW9mZnNldDogLTEuNnB4ICFpbXBvcnRhbnQ7IH1gKTtcblx0XHR9XG5cblx0XHQvLyBDbGVhciBsaXN0IHN0eWxlcyBvbiBmb2N1cyBhbmQgb24gaG92ZXIgZm9yIGRpc2FibGVkIG9wdGlvbnNcblx0XHRjb250ZW50LnB1c2goYC5tb25hY28tc2VsZWN0LWJveC1kcm9wZG93bi1jb250YWluZXIgPiAuc2VsZWN0LWJveC1kcm9wZG93bi1saXN0LWNvbnRhaW5lciAubW9uYWNvLWxpc3QgLm1vbmFjby1saXN0LXJvdy5vcHRpb24tZGlzYWJsZWQuZm9jdXNlZCB7IGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7IGNvbG9yOiBpbmhlcml0ICFpbXBvcnRhbnQ7IG91dGxpbmU6IG5vbmUgIWltcG9ydGFudDsgfWApO1xuXHRcdGNvbnRlbnQucHVzaChgLm1vbmFjby1zZWxlY3QtYm94LWRyb3Bkb3duLWNvbnRhaW5lciA+IC5zZWxlY3QtYm94LWRyb3Bkb3duLWxpc3QtY29udGFpbmVyIC5tb25hY28tbGlzdCAubW9uYWNvLWxpc3Qtcm93Lm9wdGlvbi1kaXNhYmxlZDpob3ZlciB7IGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7IGNvbG9yOiBpbmhlcml0ICFpbXBvcnRhbnQ7IG91dGxpbmU6IG5vbmUgIWltcG9ydGFudDsgfWApO1xuXG5cdFx0dGhpcy5zdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSBjb250ZW50LmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdHlsZVNlbGVjdEVsZW1lbnQoKTogdm9pZCB7XG5cdFx0Y29uc3QgYmFja2dyb3VuZCA9IHRoaXMuc3R5bGVzLnNlbGVjdEJhY2tncm91bmQgPz8gJyc7XG5cdFx0Y29uc3QgZm9yZWdyb3VuZCA9IHRoaXMuc3R5bGVzLnNlbGVjdEZvcmVncm91bmQgPz8gJyc7XG5cdFx0Y29uc3QgYm9yZGVyID0gdGhpcy5zdHlsZXMuc2VsZWN0Qm9yZGVyID8/ICcnO1xuXG5cdFx0dGhpcy5zZWxlY3RFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmQ7XG5cdFx0dGhpcy5zZWxlY3RFbGVtZW50LnN0eWxlLmNvbG9yID0gZm9yZWdyb3VuZDtcblx0XHR0aGlzLnNlbGVjdEVsZW1lbnQuc3R5bGUuYm9yZGVyQ29sb3IgPSBib3JkZXI7XG5cdH1cblxuXHRwcml2YXRlIHN0eWxlTGlzdCgpIHtcblx0XHRjb25zdCBiYWNrZ3JvdW5kID0gdGhpcy5zdHlsZXMuc2VsZWN0QmFja2dyb3VuZCA/PyAnJztcblxuXHRcdGNvbnN0IGxpc3RCYWNrZ3JvdW5kID0gY3NzSnMuYXNDc3NWYWx1ZVdpdGhEZWZhdWx0KHRoaXMuc3R5bGVzLnNlbGVjdExpc3RCYWNrZ3JvdW5kLCBiYWNrZ3JvdW5kKTtcblx0XHR0aGlzLnNlbGVjdERyb3BEb3duTGlzdENvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBsaXN0QmFja2dyb3VuZDtcblx0XHR0aGlzLnNlbGVjdGlvbkRldGFpbHNQYW5lLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGxpc3RCYWNrZ3JvdW5kO1xuXHRcdGNvbnN0IG9wdGlvbnNCb3JkZXIgPSB0aGlzLnN0eWxlcy5mb2N1c0JvcmRlciA/PyAnJztcblx0XHR0aGlzLnNlbGVjdERyb3BEb3duQ29udGFpbmVyLnN0eWxlLm91dGxpbmVDb2xvciA9IG9wdGlvbnNCb3JkZXI7XG5cdFx0dGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lci5zdHlsZS5vdXRsaW5lT2Zmc2V0ID0gJy0xcHgnO1xuXG5cdFx0dGhpcy5zZWxlY3RMaXN0LnN0eWxlKHRoaXMuc3R5bGVzKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlT3B0aW9uKHZhbHVlOiBzdHJpbmcsIGluZGV4OiBudW1iZXIsIGRpc2FibGVkPzogYm9vbGVhbik6IEhUTUxPcHRpb25FbGVtZW50IHtcblx0XHRjb25zdCBvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcblx0XHRvcHRpb24udmFsdWUgPSB2YWx1ZTtcblx0XHRvcHRpb24udGV4dCA9IHZhbHVlO1xuXHRcdG9wdGlvbi5kaXNhYmxlZCA9ICEhZGlzYWJsZWQ7XG5cblx0XHRyZXR1cm4gb3B0aW9uO1xuXHR9XG5cblx0Ly8gQ29udGV4dFZpZXcgZHJvcGRvd24gbWV0aG9kc1xuXG5cdHByaXZhdGUgc2hvd1NlbGVjdERyb3BEb3duKCkge1xuXHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUuaW5uZXJUZXh0ID0gJyc7XG5cblx0XHRpZiAoIXRoaXMuY29udGV4dFZpZXdQcm92aWRlciB8fCB0aGlzLl9pc1Zpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBMYXppbHkgY3JlYXRlIGFuZCBwb3B1bGF0ZSBsaXN0IG9ubHkgYXQgb3BlbiwgbW92ZWQgZnJvbSBjb25zdHJ1Y3RvclxuXHRcdHRoaXMuY3JlYXRlU2VsZWN0TGlzdCh0aGlzLnNlbGVjdERyb3BEb3duQ29udGFpbmVyKTtcblx0XHR0aGlzLnNldE9wdGlvbnNMaXN0KCk7XG5cblx0XHQvLyBUaGlzIGFsbG93cyB1cyB0byBmbGlwIHRoZSBwb3NpdGlvbiBiYXNlZCBvbiBtZWFzdXJlbWVudFxuXHRcdC8vIFNldCBkcm9wLWRvd24gcG9zaXRpb24gYWJvdmUvYmVsb3cgZnJvbSByZXF1aXJlZCBoZWlnaHQgYW5kIG1hcmdpbnNcblx0XHQvLyBJZiBwcmUtbGF5b3V0IGNhbm5vdCBmaXQgYXQgbGVhc3Qgb25lIG9wdGlvbiBkbyBub3Qgc2hvdyBkcm9wLWRvd25cblxuXHRcdHRoaXMuY29udGV4dFZpZXdQcm92aWRlci5zaG93Q29udGV4dFZpZXcoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB0aGlzLnNlbGVjdEVsZW1lbnQsXG5cdFx0XHRyZW5kZXI6IChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiB0aGlzLnJlbmRlclNlbGVjdERyb3BEb3duKGNvbnRhaW5lciwgdHJ1ZSksXG5cdFx0XHRsYXlvdXQ6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5sYXlvdXRTZWxlY3REcm9wRG93bigpO1xuXHRcdFx0fSxcblx0XHRcdG9uSGlkZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnNlbGVjdERyb3BEb3duQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcblx0XHRcdFx0dGhpcy5zZWxlY3RFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ3N5bnRoZXRpYy1mb2N1cycpO1xuXHRcdFx0fSxcblx0XHRcdGFuY2hvclBvc2l0aW9uOiB0aGlzLl9kcm9wRG93blBvc2l0aW9uXG5cdFx0fSwgdGhpcy5zZWxlY3RCb3hPcHRpb25zLm9wdGlvbnNBc0NoaWxkcmVuID8gdGhpcy5jb250YWluZXIgOiB1bmRlZmluZWQpO1xuXG5cdFx0Ly8gSGlkZSBzbyB3ZSBjYW4gcmVsYXkgb3V0XG5cdFx0dGhpcy5faXNWaXNpYmxlID0gdHJ1ZTtcblx0XHR0aGlzLmhpZGVTZWxlY3REcm9wRG93bihmYWxzZSk7XG5cblx0XHR0aGlzLmNvbnRleHRWaWV3UHJvdmlkZXIuc2hvd0NvbnRleHRWaWV3KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gdGhpcy5zZWxlY3RFbGVtZW50LFxuXHRcdFx0cmVuZGVyOiAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkgPT4gdGhpcy5yZW5kZXJTZWxlY3REcm9wRG93bihjb250YWluZXIpLFxuXHRcdFx0bGF5b3V0OiAoKSA9PiB0aGlzLmxheW91dFNlbGVjdERyb3BEb3duKCksXG5cdFx0XHRvbkhpZGU6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG5cdFx0XHRcdHRoaXMuc2VsZWN0RWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdzeW50aGV0aWMtZm9jdXMnKTtcblx0XHRcdH0sXG5cdFx0XHRhbmNob3JQb3NpdGlvbjogdGhpcy5fZHJvcERvd25Qb3NpdGlvblxuXHRcdH0sIHRoaXMuc2VsZWN0Qm94T3B0aW9ucy5vcHRpb25zQXNDaGlsZHJlbiA/IHRoaXMuY29udGFpbmVyIDogdW5kZWZpbmVkKTtcblxuXHRcdC8vIFRyYWNrIGluaXRpYWwgc2VsZWN0aW9uIHRoZSBjYXNlIHVzZXIgZXNjYXBlLCBibHVyXG5cdFx0dGhpcy5fY3VycmVudFNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0ZWQ7XG5cdFx0dGhpcy5faXNWaXNpYmxlID0gdHJ1ZTtcblx0XHR0aGlzLnNlbGVjdEVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcblx0fVxuXG5cdHByaXZhdGUgaGlkZVNlbGVjdERyb3BEb3duKGZvY3VzU2VsZWN0OiBib29sZWFuKSB7XG5cdFx0aWYgKCF0aGlzLmNvbnRleHRWaWV3UHJvdmlkZXIgfHwgIXRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2lzVmlzaWJsZSA9IGZhbHNlO1xuXHRcdHRoaXMuc2VsZWN0RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcblxuXHRcdGlmIChmb2N1c1NlbGVjdCkge1xuXHRcdFx0dGhpcy5zZWxlY3RFbGVtZW50LmZvY3VzKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jb250ZXh0Vmlld1Byb3ZpZGVyLmhpZGVDb250ZXh0VmlldygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJTZWxlY3REcm9wRG93bihjb250YWluZXI6IEhUTUxFbGVtZW50LCBwcmVMYXlvdXRQb3NpdGlvbj86IGJvb2xlYW4pOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIpO1xuXG5cdFx0Ly8gUHJlLUxheW91dCBhbGxvd3MgdXMgdG8gY2hhbmdlIHBvc2l0aW9uXG5cdFx0dGhpcy5sYXlvdXRTZWxlY3REcm9wRG93bihwcmVMYXlvdXRQb3NpdGlvbik7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHQvLyBjb250ZXh0VmlldyB3aWxsIGRpc3Bvc2UgaXRzZWxmIGlmIG1vdmluZyBmcm9tIG9uZSBWaWV3IHRvIGFub3RoZXJcblx0XHRcdFx0dGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lci5yZW1vdmUoKTsgLy8gcmVtb3ZlIHRvIHRha2Ugb3V0IHRoZSBDU1MgcnVsZXMgd2UgYWRkXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdC8vIEl0ZXJhdGUgb3ZlciBkZXRhaWxlZCBkZXNjcmlwdGlvbnMsIGZpbmQgbWF4IGhlaWdodFxuXHRwcml2YXRlIG1lYXN1cmVNYXhEZXRhaWxzSGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0bGV0IG1heERldGFpbHNQYW5lSGVpZ2h0ID0gMDtcblx0XHR0aGlzLm9wdGlvbnMuZm9yRWFjaCgoX29wdGlvbiwgaW5kZXgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlRGV0YWlsKGluZGV4KTtcblxuXHRcdFx0aWYgKHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUub2Zmc2V0SGVpZ2h0ID4gbWF4RGV0YWlsc1BhbmVIZWlnaHQpIHtcblx0XHRcdFx0bWF4RGV0YWlsc1BhbmVIZWlnaHQgPSB0aGlzLnNlbGVjdGlvbkRldGFpbHNQYW5lLm9mZnNldEhlaWdodDtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiBtYXhEZXRhaWxzUGFuZUhlaWdodDtcblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0U2VsZWN0RHJvcERvd24ocHJlTGF5b3V0UG9zaXRpb24/OiBib29sZWFuKTogYm9vbGVhbiB7XG5cblx0XHQvLyBBdm9pZCByZWN1cnNpb24gZnJvbSBsYXlvdXQgY2FsbGVkIGluIG9uTGlzdEZvY3VzXG5cdFx0aWYgKHRoaXMuX3NraXBMYXlvdXQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBMYXlvdXQgQ29udGV4dFZpZXcgZHJvcCBkb3duIHNlbGVjdCBsaXN0IGFuZCBjb250YWluZXJcblx0XHQvLyBIYXZlIHRvIG1hbmFnZSBvdXIgdmVydGljYWwgb3ZlcmZsb3csIHNpemluZywgcG9zaXRpb24gYmVsb3cgb3IgYWJvdmVcblx0XHQvLyBQb3NpdGlvbiBoYXMgdG8gYmUgZGV0ZXJtaW5lZCBhbmQgc2V0IHByaW9yIHRvIGNvbnRleHRWaWV3IGluc3RhbnRpYXRpb25cblxuXHRcdGlmICh0aGlzLnNlbGVjdExpc3QpIHtcblxuXHRcdFx0Ly8gTWFrZSB2aXNpYmxlIHRvIGVuYWJsZSBtZWFzdXJlbWVudHNcblx0XHRcdHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuXG5cdFx0XHRjb25zdCB3aW5kb3cgPSBkb20uZ2V0V2luZG93KHRoaXMuc2VsZWN0RWxlbWVudCk7XG5cdFx0XHRjb25zdCBzZWxlY3RQb3NpdGlvbiA9IGRvbS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKHRoaXMuc2VsZWN0RWxlbWVudCk7XG5cdFx0XHRjb25zdCBzdHlsZXMgPSBkb20uZ2V0V2luZG93KHRoaXMuc2VsZWN0RWxlbWVudCkuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLnNlbGVjdEVsZW1lbnQpO1xuXHRcdFx0Y29uc3QgdmVydGljYWxQYWRkaW5nID0gcGFyc2VGbG9hdChzdHlsZXMuZ2V0UHJvcGVydHlWYWx1ZSgnLS1kcm9wZG93bi1wYWRkaW5nLXRvcCcpKSArIHBhcnNlRmxvYXQoc3R5bGVzLmdldFByb3BlcnR5VmFsdWUoJy0tZHJvcGRvd24tcGFkZGluZy1ib3R0b20nKSk7XG5cdFx0XHRjb25zdCBtYXhTZWxlY3REcm9wRG93bkhlaWdodEJlbG93ID0gKHdpbmRvdy5pbm5lckhlaWdodCAtIHNlbGVjdFBvc2l0aW9uLnRvcCAtIHNlbGVjdFBvc2l0aW9uLmhlaWdodCAtICh0aGlzLnNlbGVjdEJveE9wdGlvbnMubWluQm90dG9tTWFyZ2luIHx8IDApKTtcblx0XHRcdGNvbnN0IG1heFNlbGVjdERyb3BEb3duSGVpZ2h0QWJvdmUgPSAoc2VsZWN0UG9zaXRpb24udG9wIC0gU2VsZWN0Qm94TGlzdC5ERUZBVUxUX0RST1BET1dOX01JTklNVU1fVE9QX01BUkdJTik7XG5cblx0XHRcdC8vIERldGVybWluZSBvcHRpbWFsIHdpZHRoIC0gbWluKGxvbmdlc3Qgb3B0aW9uKSwgb3B0KHBhcmVudCBzZWxlY3QsIGV4Y2x1ZGluZyBtYXJnaW5zKSwgbWF4KENvbnRleHRWaWV3IGNvbnRyb2xsZWQpXG5cdFx0XHRjb25zdCBzZWxlY3RXaWR0aCA9IHRoaXMuc2VsZWN0RWxlbWVudC5vZmZzZXRXaWR0aDtcblx0XHRcdGNvbnN0IHNlbGVjdE1pbldpZHRoID0gdGhpcy5zZXRXaWR0aENvbnRyb2xFbGVtZW50KHRoaXMud2lkdGhDb250cm9sRWxlbWVudCk7XG5cdFx0XHRjb25zdCBzZWxlY3RPcHRpbWFsV2lkdGggPSBNYXRoLm1heChzZWxlY3RNaW5XaWR0aCwgTWF0aC5yb3VuZChzZWxlY3RXaWR0aCkpLnRvU3RyaW5nKCkgKyAncHgnO1xuXG5cdFx0XHR0aGlzLnNlbGVjdERyb3BEb3duQ29udGFpbmVyLnN0eWxlLndpZHRoID0gc2VsZWN0T3B0aW1hbFdpZHRoO1xuXG5cdFx0XHQvLyBHZXQgaW5pdGlhbCBsaXN0IGhlaWdodCBhbmQgZGV0ZXJtaW5lIHNwYWNlIGFib3ZlIGFuZCBiZWxvd1xuXHRcdFx0dGhpcy5zZWxlY3RMaXN0LmdldEhUTUxFbGVtZW50KCkuc3R5bGUuaGVpZ2h0ID0gJyc7XG5cdFx0XHR0aGlzLnNlbGVjdExpc3QubGF5b3V0KCk7XG5cdFx0XHRsZXQgbGlzdEhlaWdodCA9IHRoaXMuc2VsZWN0TGlzdC5jb250ZW50SGVpZ2h0O1xuXG5cdFx0XHRpZiAodGhpcy5faGFzRGV0YWlscyAmJiB0aGlzLl9jYWNoZWRNYXhEZXRhaWxzSGVpZ2h0ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5fY2FjaGVkTWF4RGV0YWlsc0hlaWdodCA9IHRoaXMubWVhc3VyZU1heERldGFpbHNIZWlnaHQoKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG1heERldGFpbHNQYW5lSGVpZ2h0ID0gdGhpcy5faGFzRGV0YWlscyA/IHRoaXMuX2NhY2hlZE1heERldGFpbHNIZWlnaHQhIDogMDtcblxuXHRcdFx0Y29uc3QgbWluUmVxdWlyZWREcm9wRG93bkhlaWdodCA9IGxpc3RIZWlnaHQgKyB2ZXJ0aWNhbFBhZGRpbmcgKyBtYXhEZXRhaWxzUGFuZUhlaWdodDtcblx0XHRcdGNvbnN0IG1heFZpc2libGVPcHRpb25zQmVsb3cgPSAoKE1hdGguZmxvb3IoKG1heFNlbGVjdERyb3BEb3duSGVpZ2h0QmVsb3cgLSB2ZXJ0aWNhbFBhZGRpbmcgLSBtYXhEZXRhaWxzUGFuZUhlaWdodCkgLyB0aGlzLmdldEhlaWdodCgpKSkpO1xuXHRcdFx0Y29uc3QgbWF4VmlzaWJsZU9wdGlvbnNBYm92ZSA9ICgoTWF0aC5mbG9vcigobWF4U2VsZWN0RHJvcERvd25IZWlnaHRBYm92ZSAtIHZlcnRpY2FsUGFkZGluZyAtIG1heERldGFpbHNQYW5lSGVpZ2h0KSAvIHRoaXMuZ2V0SGVpZ2h0KCkpKSk7XG5cblx0XHRcdC8vIElmIHdlIGFyZSBvbmx5IGRvaW5nIHByZS1sYXlvdXQgY2hlY2svYWRqdXN0IHBvc2l0aW9uIG9ubHlcblx0XHRcdC8vIENhbGN1bGF0ZSB2ZXJ0aWNhbCBzcGFjZSBhdmFpbGFibGUsIGZsaXAgdXAgaWYgaW5zdWZmaWNpZW50XG5cdFx0XHQvLyBVc2UgcmVmbGVjdGVkIHBhZGRpbmcgb24gcGFyZW50IHNlbGVjdCwgQ29udGV4dFZpZXcgc3R5bGVcblx0XHRcdC8vIHByb3BlcnRpZXMgbm90IGF2YWlsYWJsZSBiZWZvcmUgRE9NIGF0dGFjaG1lbnRcblxuXHRcdFx0aWYgKHByZUxheW91dFBvc2l0aW9uKSB7XG5cblx0XHRcdFx0Ly8gQ2hlY2sgaWYgc2VsZWN0IG1vdmVkIG91dCBvZiB2aWV3cG9ydCAsIGRvIG5vdCBvcGVuXG5cdFx0XHRcdC8vIElmIGF0IGxlYXN0IG9uZSBvcHRpb24gY2Fubm90IGJlIHNob3duLCBkb24ndCBvcGVuIHRoZSBkcm9wLWRvd24gb3IgaGlkZS9yZW1vdmUgaWYgb3BlblxuXG5cdFx0XHRcdGlmICgoc2VsZWN0UG9zaXRpb24udG9wICsgc2VsZWN0UG9zaXRpb24uaGVpZ2h0KSA+ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSAyMilcblx0XHRcdFx0XHR8fCBzZWxlY3RQb3NpdGlvbi50b3AgPCBTZWxlY3RCb3hMaXN0LkRFRkFVTFRfRFJPUERPV05fTUlOSU1VTV9UT1BfTUFSR0lOXG5cdFx0XHRcdFx0fHwgKChtYXhWaXNpYmxlT3B0aW9uc0JlbG93IDwgMSkgJiYgKG1heFZpc2libGVPcHRpb25zQWJvdmUgPCAxKSkpIHtcblx0XHRcdFx0XHQvLyBJbmRpY2F0ZSB3ZSBjYW5ub3Qgb3BlblxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIERldGVybWluZSBpZiB3ZSBoYXZlIHRvIGZsaXAgdXBcblx0XHRcdFx0Ly8gQWx3YXlzIHNob3cgY29tcGxldGUgbGlzdCBpdGVtcyAtIG5ldmVyIG1vcmUgdGhhbiBNYXggYXZhaWxhYmxlIHZlcnRpY2FsIGhlaWdodFxuXHRcdFx0XHRpZiAobWF4VmlzaWJsZU9wdGlvbnNCZWxvdyA8IFNlbGVjdEJveExpc3QuREVGQVVMVF9NSU5JTVVNX1ZJU0lCTEVfT1BUSU9OU1xuXHRcdFx0XHRcdCYmIG1heFZpc2libGVPcHRpb25zQWJvdmUgPiBtYXhWaXNpYmxlT3B0aW9uc0JlbG93XG5cdFx0XHRcdFx0JiYgdGhpcy5vcHRpb25zLmxlbmd0aCA+IG1heFZpc2libGVPcHRpb25zQmVsb3dcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0dGhpcy5fZHJvcERvd25Qb3NpdGlvbiA9IEFuY2hvclBvc2l0aW9uLkFCT1ZFO1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0RHJvcERvd25MaXN0Q29udGFpbmVyLnJlbW92ZSgpO1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUucmVtb3ZlKCk7XG5cdFx0XHRcdFx0dGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnNlbGVjdGlvbkRldGFpbHNQYW5lKTtcblx0XHRcdFx0XHR0aGlzLnNlbGVjdERyb3BEb3duQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuc2VsZWN0RHJvcERvd25MaXN0Q29udGFpbmVyKTtcblxuXHRcdFx0XHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUuY2xhc3NMaXN0LnJlbW92ZSgnYm9yZGVyLXRvcCcpO1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUuY2xhc3NMaXN0LmFkZCgnYm9yZGVyLWJvdHRvbScpO1xuXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fZHJvcERvd25Qb3NpdGlvbiA9IEFuY2hvclBvc2l0aW9uLkJFTE9XO1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0RHJvcERvd25MaXN0Q29udGFpbmVyLnJlbW92ZSgpO1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUucmVtb3ZlKCk7XG5cdFx0XHRcdFx0dGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnNlbGVjdERyb3BEb3duTGlzdENvbnRhaW5lcik7XG5cdFx0XHRcdFx0dGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLnNlbGVjdGlvbkRldGFpbHNQYW5lKTtcblxuXHRcdFx0XHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUuY2xhc3NMaXN0LnJlbW92ZSgnYm9yZGVyLWJvdHRvbScpO1xuXHRcdFx0XHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUuY2xhc3NMaXN0LmFkZCgnYm9yZGVyLXRvcCcpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIERvIGZ1bGwgbGF5b3V0IG9uIHNob3dTZWxlY3REcm9wRG93biBvbmx5XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDaGVjayBpZiBzZWxlY3Qgb3V0IG9mIHZpZXdwb3J0IG9yIGN1dHRpbmcgaW50byBzdGF0dXMgYmFyXG5cdFx0XHRpZiAoKHNlbGVjdFBvc2l0aW9uLnRvcCArIHNlbGVjdFBvc2l0aW9uLmhlaWdodCkgPiAod2luZG93LmlubmVySGVpZ2h0IC0gMjIpXG5cdFx0XHRcdHx8IHNlbGVjdFBvc2l0aW9uLnRvcCA8IFNlbGVjdEJveExpc3QuREVGQVVMVF9EUk9QRE9XTl9NSU5JTVVNX1RPUF9NQVJHSU5cblx0XHRcdFx0fHwgKHRoaXMuX2Ryb3BEb3duUG9zaXRpb24gPT09IEFuY2hvclBvc2l0aW9uLkJFTE9XICYmIG1heFZpc2libGVPcHRpb25zQmVsb3cgPCAxKVxuXHRcdFx0XHR8fCAodGhpcy5fZHJvcERvd25Qb3NpdGlvbiA9PT0gQW5jaG9yUG9zaXRpb24uQUJPVkUgJiYgbWF4VmlzaWJsZU9wdGlvbnNBYm92ZSA8IDEpKSB7XG5cdFx0XHRcdC8vIENhbm5vdCBwcm9wZXJseSBsYXlvdXQsIGNsb3NlIGFuZCBoaWRlXG5cdFx0XHRcdHRoaXMuaGlkZVNlbGVjdERyb3BEb3duKHRydWUpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNldFVwIGxpc3QgZGltZW5zaW9ucyBhbmQgbGF5b3V0IC0gYWNjb3VudCBmb3IgY29udGFpbmVyIHBhZGRpbmdcblx0XHRcdC8vIFVzZSBwb3NpdGlvbiB0byBjaGVjayBhYm92ZSBvciBiZWxvdyBhdmFpbGFibGUgc3BhY2Vcblx0XHRcdGlmICh0aGlzLl9kcm9wRG93blBvc2l0aW9uID09PSBBbmNob3JQb3NpdGlvbi5CRUxPVykge1xuXHRcdFx0XHRpZiAodGhpcy5faXNWaXNpYmxlICYmIG1heFZpc2libGVPcHRpb25zQmVsb3cgKyBtYXhWaXNpYmxlT3B0aW9uc0Fib3ZlIDwgMSkge1xuXHRcdFx0XHRcdC8vIElmIGRyb3AtZG93biBpcyB2aXNpYmxlLCBtdXN0IGJlIGRvaW5nIGEgRE9NIHJlLWxheW91dCwgaGlkZSBzaW5jZSB3ZSBkb24ndCBmaXRcblx0XHRcdFx0XHQvLyBIaWRlIGRyb3AtZG93biwgaGlkZSBjb250ZXh0dmlldywgZm9jdXMgb24gcGFyZW50IHNlbGVjdFxuXHRcdFx0XHRcdHRoaXMuaGlkZVNlbGVjdERyb3BEb3duKHRydWUpO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEFkanVzdCBsaXN0IGhlaWdodCB0byBtYXggZnJvbSBzZWxlY3QgYm90dG9tIHRvIG1hcmdpbiAoZGVmYXVsdC9taW5Cb3R0b21NYXJnaW4pXG5cdFx0XHRcdGlmIChtaW5SZXF1aXJlZERyb3BEb3duSGVpZ2h0ID4gbWF4U2VsZWN0RHJvcERvd25IZWlnaHRCZWxvdykge1xuXHRcdFx0XHRcdGxpc3RIZWlnaHQgPSAobWF4VmlzaWJsZU9wdGlvbnNCZWxvdyAqIHRoaXMuZ2V0SGVpZ2h0KCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAobWluUmVxdWlyZWREcm9wRG93bkhlaWdodCA+IG1heFNlbGVjdERyb3BEb3duSGVpZ2h0QWJvdmUpIHtcblx0XHRcdFx0XHRsaXN0SGVpZ2h0ID0gKG1heFZpc2libGVPcHRpb25zQWJvdmUgKiB0aGlzLmdldEhlaWdodCgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBTZXQgYWRqdXN0ZWQgbGlzdCBoZWlnaHQgYW5kIHJlbGF5b3V0XG5cdFx0XHR0aGlzLnNlbGVjdExpc3QubGF5b3V0KGxpc3RIZWlnaHQpO1xuXHRcdFx0dGhpcy5zZWxlY3RMaXN0LmRvbUZvY3VzKCk7XG5cblx0XHRcdC8vIEZpbmFsbHkgc2V0IGZvY3VzIG9uIHNlbGVjdGVkIGl0ZW1cblx0XHRcdGlmICh0aGlzLnNlbGVjdExpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0XHR0aGlzLnNlbGVjdExpc3Quc2V0Rm9jdXMoW3RoaXMuc2VsZWN0ZWQgfHwgMF0pO1xuXHRcdFx0XHR0aGlzLnNlbGVjdExpc3QucmV2ZWFsKHRoaXMuc2VsZWN0TGlzdC5nZXRGb2N1cygpWzBdIHx8IDApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5faGFzRGV0YWlscykge1xuXHRcdFx0XHQvLyBMZWF2ZSB0aGUgc2VsZWN0RHJvcERvd25Db250YWluZXIgdG8gc2l6ZSBpdHNlbGYgYWNjb3JkaW5nIHRvIGNoaWxkcmVuIChsaXN0ICsgZGV0YWlscykgLSAjNTc0NDdcblx0XHRcdFx0dGhpcy5zZWxlY3RMaXN0LmdldEhUTUxFbGVtZW50KCkuc3R5bGUuaGVpZ2h0ID0gKGxpc3RIZWlnaHQgKyB2ZXJ0aWNhbFBhZGRpbmcpICsgJ3B4Jztcblx0XHRcdFx0dGhpcy5zZWxlY3REcm9wRG93bkNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSAnJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIuc3R5bGUuaGVpZ2h0ID0gKGxpc3RIZWlnaHQgKyB2ZXJ0aWNhbFBhZGRpbmcpICsgJ3B4Jztcblx0XHRcdH1cblxuXHRcdFx0dGhpcy51cGRhdGVEZXRhaWwodGhpcy5zZWxlY3RlZCk7XG5cblx0XHRcdHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIuc3R5bGUud2lkdGggPSBzZWxlY3RPcHRpbWFsV2lkdGg7XG5cblx0XHRcdC8vIE1haW50YWluIGZvY3VzIG91dGxpbmUgb24gcGFyZW50IHNlbGVjdCBhcyB3ZWxsIGFzIGxpc3QgY29udGFpbmVyIC0gdGFiaW5kZXggZm9yIGZvY3VzXG5cdFx0XHR0aGlzLnNlbGVjdERyb3BEb3duTGlzdENvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblx0XHRcdHRoaXMuc2VsZWN0RWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzeW50aGV0aWMtZm9jdXMnKTtcblx0XHRcdHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIuY2xhc3NMaXN0LmFkZCgnc3ludGhldGljLWZvY3VzJyk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXRXaWR0aENvbnRyb2xFbGVtZW50KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRcdGxldCBlbGVtZW50V2lkdGggPSAwO1xuXG5cdFx0aWYgKGNvbnRhaW5lcikge1xuXHRcdFx0bGV0IGxvbmdlc3QgPSAwO1xuXHRcdFx0bGV0IGxvbmdlc3RMZW5ndGggPSAwO1xuXG5cdFx0XHR0aGlzLm9wdGlvbnMuZm9yRWFjaCgob3B0aW9uLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRjb25zdCBkZXRhaWxMZW5ndGggPSAhIW9wdGlvbi5kZXRhaWwgPyBvcHRpb24uZGV0YWlsLmxlbmd0aCA6IDA7XG5cdFx0XHRcdGNvbnN0IHJpZ2h0RGVjb3JhdG9yTGVuZ3RoID0gISFvcHRpb24uZGVjb3JhdG9yUmlnaHQgPyBvcHRpb24uZGVjb3JhdG9yUmlnaHQubGVuZ3RoIDogMDtcblxuXHRcdFx0XHRjb25zdCBsZW4gPSBvcHRpb24udGV4dC5sZW5ndGggKyBkZXRhaWxMZW5ndGggKyByaWdodERlY29yYXRvckxlbmd0aDtcblx0XHRcdFx0aWYgKGxlbiA+IGxvbmdlc3RMZW5ndGgpIHtcblx0XHRcdFx0XHRsb25nZXN0ID0gaW5kZXg7XG5cdFx0XHRcdFx0bG9uZ2VzdExlbmd0aCA9IGxlbjtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblxuXHRcdFx0Y29udGFpbmVyLnRleHRDb250ZW50ID0gdGhpcy5vcHRpb25zW2xvbmdlc3RdLnRleHQgKyAoISF0aGlzLm9wdGlvbnNbbG9uZ2VzdF0uZGVjb3JhdG9yUmlnaHQgPyAodGhpcy5vcHRpb25zW2xvbmdlc3RdLmRlY29yYXRvclJpZ2h0ICsgJyAnKSA6ICcnKTtcblx0XHRcdGVsZW1lbnRXaWR0aCA9IGRvbS5nZXRUb3RhbFdpZHRoKGNvbnRhaW5lcik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVsZW1lbnRXaWR0aDtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2VsZWN0TGlzdChwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cblx0XHQvLyBJZiB3ZSBoYXZlIGFscmVhZHkgY29uc3RydWN0aXZlIGxpc3Qgb24gb3Blbiwgc2tpcFxuXHRcdGlmICh0aGlzLnNlbGVjdExpc3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBTZXRVcCBjb250YWluZXIgZm9yIGxpc3Rcblx0XHR0aGlzLnNlbGVjdERyb3BEb3duTGlzdENvbnRhaW5lciA9IGRvbS5hcHBlbmQocGFyZW50LCAkKCcuc2VsZWN0LWJveC1kcm9wZG93bi1saXN0LWNvbnRhaW5lcicpKTtcblxuXHRcdHRoaXMubGlzdFJlbmRlcmVyID0gbmV3IFNlbGVjdExpc3RSZW5kZXJlcigpO1xuXG5cdFx0dGhpcy5zZWxlY3RMaXN0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IExpc3QoJ1NlbGVjdEJveEN1c3RvbScsIHRoaXMuc2VsZWN0RHJvcERvd25MaXN0Q29udGFpbmVyLCB0aGlzLCBbdGhpcy5saXN0UmVuZGVyZXJdLCB7XG5cdFx0XHR1c2VTaGFkb3dzOiBmYWxzZSxcblx0XHRcdHZlcnRpY2FsU2Nyb2xsTW9kZTogU2Nyb2xsYmFyVmlzaWJpbGl0eS5WaXNpYmxlLFxuXHRcdFx0a2V5Ym9hcmRTdXBwb3J0OiBmYWxzZSxcblx0XHRcdG1vdXNlU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IHtcblx0XHRcdFx0Z2V0QXJpYUxhYmVsOiBlbGVtZW50ID0+IHtcblx0XHRcdFx0XHRsZXQgbGFiZWwgPSBlbGVtZW50LnRleHQ7XG5cdFx0XHRcdFx0aWYgKGVsZW1lbnQuZGV0YWlsKSB7XG5cdFx0XHRcdFx0XHRsYWJlbCArPSBgLiAke2VsZW1lbnQuZGV0YWlsfWA7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGVsZW1lbnQuZGVjb3JhdG9yUmlnaHQpIHtcblx0XHRcdFx0XHRcdGxhYmVsICs9IGAuICR7ZWxlbWVudC5kZWNvcmF0b3JSaWdodH1gO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChlbGVtZW50LmRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0XHRsYWJlbCArPSBgLiAke2VsZW1lbnQuZGVzY3JpcHRpb259YDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gbGFiZWw7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldFdpZGdldEFyaWFMYWJlbDogKCkgPT4gbG9jYWxpemUoeyBrZXk6ICdzZWxlY3RCb3gnLCBjb21tZW50OiBbJ0JlaGF2ZSBsaWtlIG5hdGl2ZSBzZWxlY3QgZHJvcGRvd24gZWxlbWVudC4nXSB9LCBcIlNlbGVjdCBCb3hcIiksXG5cdFx0XHRcdGdldFJvbGU6ICgpID0+IGlzTWFjaW50b3NoID8gJycgOiAnb3B0aW9uJyxcblx0XHRcdFx0Z2V0V2lkZ2V0Um9sZTogKCkgPT4gJ2xpc3Rib3gnXG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGlmICh0aGlzLnNlbGVjdEJveE9wdGlvbnMuYXJpYUxhYmVsKSB7XG5cdFx0XHR0aGlzLnNlbGVjdExpc3QuYXJpYUxhYmVsID0gdGhpcy5zZWxlY3RCb3hPcHRpb25zLmFyaWFMYWJlbDtcblx0XHR9XG5cblx0XHQvLyBTZXRVcCBsaXN0IGtleWJvYXJkIGNvbnRyb2xsZXIgLSBjb250cm9sIG5hdmlnYXRpb24sIGRpc2FibGVkIGl0ZW1zLCBmb2N1c1xuXHRcdGNvbnN0IG9uS2V5RG93biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21FbWl0dGVyKHRoaXMuc2VsZWN0RHJvcERvd25MaXN0Q29udGFpbmVyLCAna2V5ZG93bicpKTtcblx0XHRjb25zdCBvblNlbGVjdERyb3BEb3duS2V5RG93biA9IEV2ZW50LmNoYWluKG9uS2V5RG93bi5ldmVudCwgJCA9PlxuXHRcdFx0JC5maWx0ZXIoKCkgPT4gdGhpcy5zZWxlY3RMaXN0Lmxlbmd0aCA+IDApXG5cdFx0XHRcdC5tYXAoZSA9PiBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpKVxuXHRcdCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5jaGFpbihvblNlbGVjdERyb3BEb3duS2V5RG93biwgJCA9PiAkLmZpbHRlcihlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5FbnRlcikpKHRoaXMub25FbnRlciwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmNoYWluKG9uU2VsZWN0RHJvcERvd25LZXlEb3duLCAkID0+ICQuZmlsdGVyKGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLlRhYikpKHRoaXMub25FbnRlciwgdGhpcykpOyAvLyBUYWIgc2hvdWxkIGJlaGF2ZSB0aGUgc2FtZSBhcyBlbnRlciwgIzc5MzM5XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuY2hhaW4ob25TZWxlY3REcm9wRG93bktleURvd24sICQgPT4gJC5maWx0ZXIoZSA9PiBlLmtleUNvZGUgPT09IEtleUNvZGUuRXNjYXBlKSkodGhpcy5vbkVzY2FwZSwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmNoYWluKG9uU2VsZWN0RHJvcERvd25LZXlEb3duLCAkID0+ICQuZmlsdGVyKGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLlVwQXJyb3cpKSh0aGlzLm9uVXBBcnJvdywgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmNoYWluKG9uU2VsZWN0RHJvcERvd25LZXlEb3duLCAkID0+ICQuZmlsdGVyKGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLkRvd25BcnJvdykpKHRoaXMub25Eb3duQXJyb3csIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5jaGFpbihvblNlbGVjdERyb3BEb3duS2V5RG93biwgJCA9PiAkLmZpbHRlcihlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5QYWdlRG93bikpKHRoaXMub25QYWdlRG93biwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmNoYWluKG9uU2VsZWN0RHJvcERvd25LZXlEb3duLCAkID0+ICQuZmlsdGVyKGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLlBhZ2VVcCkpKHRoaXMub25QYWdlVXAsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5jaGFpbihvblNlbGVjdERyb3BEb3duS2V5RG93biwgJCA9PiAkLmZpbHRlcihlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5Ib21lKSkodGhpcy5vbkhvbWUsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5jaGFpbihvblNlbGVjdERyb3BEb3duS2V5RG93biwgJCA9PiAkLmZpbHRlcihlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5FbmQpKSh0aGlzLm9uRW5kLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuY2hhaW4ob25TZWxlY3REcm9wRG93bktleURvd24sICQgPT4gJC5maWx0ZXIoZSA9PiAoZS5rZXlDb2RlID49IEtleUNvZGUuRGlnaXQwICYmIGUua2V5Q29kZSA8PSBLZXlDb2RlLktleVopIHx8IChlLmtleUNvZGUgPj0gS2V5Q29kZS5TZW1pY29sb24gJiYgZS5rZXlDb2RlIDw9IEtleUNvZGUuTnVtcGFkRGl2aWRlKSkpKHRoaXMub25DaGFyYWN0ZXIsIHRoaXMpKTtcblxuXHRcdC8vIFNldFVwIGxpc3QgbW91c2UgY29udHJvbGxlciAtIGNvbnRyb2wgbmF2aWdhdGlvbiwgZGlzYWJsZWQgaXRlbXMsIGZvY3VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnNlbGVjdExpc3QuZ2V0SFRNTEVsZW1lbnQoKSwgZG9tLkV2ZW50VHlwZS5QT0lOVEVSX1VQLCBlID0+IHRoaXMub25Qb2ludGVyVXAoZSkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VsZWN0TGlzdC5vbk1vdXNlT3ZlcihlID0+IHR5cGVvZiBlLmluZGV4ICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLnNlbGVjdExpc3Quc2V0Rm9jdXMoW2UuaW5kZXhdKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VsZWN0TGlzdC5vbkRpZENoYW5nZUZvY3VzKGUgPT4gdGhpcy5vbkxpc3RGb2N1cyhlKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnNlbGVjdERyb3BEb3duQ29udGFpbmVyLCBkb20uRXZlbnRUeXBlLkZPQ1VTX09VVCwgZSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2lzVmlzaWJsZSB8fCBkb20uaXNBbmNlc3RvcihlLnJlbGF0ZWRUYXJnZXQgYXMgSFRNTEVsZW1lbnQsIHRoaXMuc2VsZWN0RHJvcERvd25Db250YWluZXIpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMub25MaXN0Qmx1cigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuc2VsZWN0TGlzdC5nZXRIVE1MRWxlbWVudCgpLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRoaXMuc2VsZWN0Qm94T3B0aW9ucy5hcmlhTGFiZWwgfHwgJycpO1xuXHRcdHRoaXMuc2VsZWN0TGlzdC5nZXRIVE1MRWxlbWVudCgpLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XG5cblx0XHR0aGlzLnN0eWxlTGlzdCgpO1xuXHR9XG5cblx0Ly8gTGlzdCBtZXRob2RzXG5cblx0Ly8gTGlzdCBtb3VzZSBjb250cm9sbGVyIC0gYWN0aXZlIGV4aXQsIHNlbGVjdCBvcHRpb24sIGZpcmUgb25EaWRTZWxlY3QgaWYgY2hhbmdlLCByZXR1cm4gZm9jdXMgdG8gcGFyZW50IHNlbGVjdFxuXHQvLyBBbHNvIHRha2VzIGluIHRvdWNoZW5kIGV2ZW50c1xuXHRwcml2YXRlIG9uUG9pbnRlclVwKGU6IFBvaW50ZXJFdmVudCk6IHZvaWQge1xuXG5cdFx0aWYgKCF0aGlzLnNlbGVjdExpc3QubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZG9tLkV2ZW50SGVscGVyLnN0b3AoZSk7XG5cblx0XHRjb25zdCB0YXJnZXQgPSA8RWxlbWVudD5lLnRhcmdldDtcblx0XHRpZiAoIXRhcmdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIG91ciBtb3VzZSBldmVudCBpcyBvbiBhbiBvcHRpb24gKG5vdCBzY3JvbGxiYXIpXG5cdFx0aWYgKHRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ3NsaWRlcicpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGlzdFJvd0VsZW1lbnQgPSB0YXJnZXQuY2xvc2VzdCgnLm1vbmFjby1saXN0LXJvdycpO1xuXG5cdFx0aWYgKCFsaXN0Um93RWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpbmRleCA9IE51bWJlcihsaXN0Um93RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnKSk7XG5cdFx0Y29uc3QgZGlzYWJsZWQgPSBsaXN0Um93RWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ29wdGlvbi1kaXNhYmxlZCcpO1xuXG5cdFx0Ly8gSWdub3JlIG1vdXNlIHNlbGVjdGlvbiBvZiBkaXNhYmxlZCBvcHRpb25zXG5cdFx0aWYgKGluZGV4ID49IDAgJiYgaW5kZXggPCB0aGlzLm9wdGlvbnMubGVuZ3RoICYmICFkaXNhYmxlZCkge1xuXHRcdFx0dGhpcy5zZWxlY3RlZCA9IGluZGV4O1xuXHRcdFx0dGhpcy5zZWxlY3QodGhpcy5zZWxlY3RlZCk7XG5cblx0XHRcdHRoaXMuc2VsZWN0TGlzdC5zZXRGb2N1cyhbdGhpcy5zZWxlY3RlZF0pO1xuXHRcdFx0dGhpcy5zZWxlY3RMaXN0LnJldmVhbCh0aGlzLnNlbGVjdExpc3QuZ2V0Rm9jdXMoKVswXSk7XG5cblx0XHRcdC8vIE9ubHkgZmlyZSBpZiBzZWxlY3Rpb24gY2hhbmdlXG5cdFx0XHRpZiAodGhpcy5zZWxlY3RlZCAhPT0gdGhpcy5fY3VycmVudFNlbGVjdGlvbikge1xuXHRcdFx0XHQvLyBTZXQgY3VycmVudCA9IHNlbGVjdGVkXG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRTZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGVkO1xuXG5cdFx0XHRcdHRoaXMuX29uRGlkU2VsZWN0LmZpcmUoe1xuXHRcdFx0XHRcdGluZGV4OiB0aGlzLnNlbGVjdEVsZW1lbnQuc2VsZWN0ZWRJbmRleCxcblx0XHRcdFx0XHRzZWxlY3RlZDogdGhpcy5vcHRpb25zW3RoaXMuc2VsZWN0ZWRdLnRleHRcblxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKCEhdGhpcy5vcHRpb25zW3RoaXMuc2VsZWN0ZWRdICYmICEhdGhpcy5vcHRpb25zW3RoaXMuc2VsZWN0ZWRdLnRleHQpIHtcblx0XHRcdFx0XHR0aGlzLnNldFRpdGxlKHRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXS50ZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmhpZGVTZWxlY3REcm9wRG93bih0cnVlKTtcblx0XHR9XG5cdH1cblxuXHQvLyBMaXN0IEV4aXQgLSBwYXNzaXZlIC0gaW1wbGljaXQgbm8gc2VsZWN0aW9uIGNoYW5nZSwgaGlkZSBkcm9wLWRvd25cblx0cHJpdmF0ZSBvbkxpc3RCbHVyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdGlja3kpIHsgcmV0dXJuOyB9XG5cdFx0aWYgKHRoaXMuc2VsZWN0ZWQgIT09IHRoaXMuX2N1cnJlbnRTZWxlY3Rpb24pIHtcblx0XHRcdC8vIFJlc2V0IHNlbGVjdGVkIHRvIGN1cnJlbnQgaWYgbm8gY2hhbmdlXG5cdFx0XHR0aGlzLnNlbGVjdCh0aGlzLl9jdXJyZW50U2VsZWN0aW9uKTtcblx0XHR9XG5cblx0XHR0aGlzLmhpZGVTZWxlY3REcm9wRG93bihmYWxzZSk7XG5cdH1cblxuXG5cdHByaXZhdGUgcmVuZGVyRGVzY3JpcHRpb25NYXJrZG93bih0ZXh0OiBzdHJpbmcsIGFjdGlvbkhhbmRsZXI/OiBJQ29udGVudEFjdGlvbkhhbmRsZXIpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgY2xlYW5SZW5kZXJlZE1hcmtkb3duID0gKGVsZW1lbnQ6IE5vZGUpID0+IHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNoaWxkID0gPEVsZW1lbnQ+ZWxlbWVudC5jaGlsZE5vZGVzLml0ZW0oaSk7XG5cblx0XHRcdFx0Y29uc3QgdGFnTmFtZSA9IGNoaWxkLnRhZ05hbWUgJiYgY2hpbGQudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRpZiAodGFnTmFtZSA9PT0gJ2ltZycpIHtcblx0XHRcdFx0XHRjaGlsZC5yZW1vdmUoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjbGVhblJlbmRlcmVkTWFya2Rvd24oY2hpbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHJlbmRlcmVkID0gcmVuZGVyTWFya2Rvd24oeyB2YWx1ZTogdGV4dCwgc3VwcG9ydFRoZW1lSWNvbnM6IHRydWUgfSwgeyBhY3Rpb25IYW5kbGVyIH0pO1xuXG5cdFx0cmVuZGVyZWQuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzZWxlY3QtYm94LWRlc2NyaXB0aW9uLW1hcmtkb3duJyk7XG5cdFx0Y2xlYW5SZW5kZXJlZE1hcmtkb3duKHJlbmRlcmVkLmVsZW1lbnQpO1xuXG5cdFx0cmV0dXJuIHJlbmRlcmVkLmVsZW1lbnQ7XG5cdH1cblxuXHQvLyBMaXN0IEZvY3VzIENoYW5nZSAtIHBhc3NpdmUgLSB1cGRhdGUgZGV0YWlscyBwYW5lIHdpdGggbmV3bHkgZm9jdXNlZCBlbGVtZW50J3MgZGF0YVxuXHRwcml2YXRlIG9uTGlzdEZvY3VzKGU6IElMaXN0RXZlbnQ8SVNlbGVjdE9wdGlvbkl0ZW0+KSB7XG5cdFx0Ly8gU2tpcCBkdXJpbmcgaW5pdGlhbCBsYXlvdXRcblx0XHRpZiAoIXRoaXMuX2lzVmlzaWJsZSB8fCAhdGhpcy5faGFzRGV0YWlscykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlRGV0YWlsKGUuaW5kZXhlc1swXSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZURldGFpbChzZWxlY3RlZEluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLnNlbGVjdGlvbkRldGFpbHNQYW5lLmlubmVyVGV4dCA9ICcnO1xuXHRcdGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9uc1tzZWxlY3RlZEluZGV4XTtcblx0XHRjb25zdCBkZXNjcmlwdGlvbiA9IG9wdGlvbj8uZGVzY3JpcHRpb24gPz8gJyc7XG5cdFx0Y29uc3QgZGVzY3JpcHRpb25Jc01hcmtkb3duID0gb3B0aW9uPy5kZXNjcmlwdGlvbklzTWFya2Rvd24gPz8gZmFsc2U7XG5cblx0XHRpZiAoZGVzY3JpcHRpb24pIHtcblx0XHRcdGlmIChkZXNjcmlwdGlvbklzTWFya2Rvd24pIHtcblx0XHRcdFx0Y29uc3QgYWN0aW9uSGFuZGxlciA9IG9wdGlvbi5kZXNjcmlwdGlvbk1hcmtkb3duQWN0aW9uSGFuZGxlcjtcblx0XHRcdFx0dGhpcy5zZWxlY3Rpb25EZXRhaWxzUGFuZS5hcHBlbmRDaGlsZCh0aGlzLnJlbmRlckRlc2NyaXB0aW9uTWFya2Rvd24oZGVzY3JpcHRpb24sIGFjdGlvbkhhbmRsZXIpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0aW9uRGV0YWlsc1BhbmUuaW5uZXJUZXh0ID0gZGVzY3JpcHRpb247XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnNlbGVjdGlvbkRldGFpbHNQYW5lLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNlbGVjdGlvbkRldGFpbHNQYW5lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fVxuXG5cdFx0Ly8gQXZvaWQgcmVjdXJzaW9uXG5cdFx0dGhpcy5fc2tpcExheW91dCA9IHRydWU7XG5cdFx0dGhpcy5jb250ZXh0Vmlld1Byb3ZpZGVyLmxheW91dCgpO1xuXHRcdHRoaXMuX3NraXBMYXlvdXQgPSBmYWxzZTtcblx0fVxuXG5cdC8vIExpc3Qga2V5Ym9hcmQgY29udHJvbGxlclxuXG5cdC8vIExpc3QgZXhpdCAtIGFjdGl2ZSAtIGhpZGUgQ29udGV4dFZpZXcgZHJvcGRvd24sIHJlc2V0IHNlbGVjdGlvbiwgcmV0dXJuIGZvY3VzIHRvIHBhcmVudCBzZWxlY3Rcblx0cHJpdmF0ZSBvbkVzY2FwZShlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblxuXHRcdC8vIFJlc2V0IHNlbGVjdGlvbiB0byB2YWx1ZSB3aGVuIG9wZW5lZFxuXHRcdHRoaXMuc2VsZWN0KHRoaXMuX2N1cnJlbnRTZWxlY3Rpb24pO1xuXHRcdHRoaXMuaGlkZVNlbGVjdERyb3BEb3duKHRydWUpO1xuXHR9XG5cblx0Ly8gTGlzdCBleGl0IC0gYWN0aXZlIC0gaGlkZSBDb250ZXh0VmlldyBkcm9wZG93biwgcmV0dXJuIGZvY3VzIHRvIHBhcmVudCBzZWxlY3QsIGZpcmUgb25EaWRTZWxlY3QgaWYgY2hhbmdlXG5cdHByaXZhdGUgb25FbnRlcihlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblxuXHRcdC8vIE9ubHkgZmlyZSBpZiBzZWxlY3Rpb24gY2hhbmdlXG5cdFx0aWYgKHRoaXMuc2VsZWN0ZWQgIT09IHRoaXMuX2N1cnJlbnRTZWxlY3Rpb24pIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRTZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGVkO1xuXHRcdFx0dGhpcy5fb25EaWRTZWxlY3QuZmlyZSh7XG5cdFx0XHRcdGluZGV4OiB0aGlzLnNlbGVjdEVsZW1lbnQuc2VsZWN0ZWRJbmRleCxcblx0XHRcdFx0c2VsZWN0ZWQ6IHRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXS50ZXh0XG5cdFx0XHR9KTtcblx0XHRcdGlmICghIXRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXSAmJiAhIXRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXS50ZXh0KSB7XG5cdFx0XHRcdHRoaXMuc2V0VGl0bGUodGhpcy5vcHRpb25zW3RoaXMuc2VsZWN0ZWRdLnRleHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuaGlkZVNlbGVjdERyb3BEb3duKHRydWUpO1xuXHR9XG5cblx0Ly8gTGlzdCBuYXZpZ2F0aW9uIC0gaGF2ZSB0byBoYW5kbGUgYSBkaXNhYmxlZCBvcHRpb24gKGp1bXAgb3Zlcilcblx0cHJpdmF0ZSBvbkRvd25BcnJvdyhlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zZWxlY3RlZCA8IHRoaXMub3B0aW9ucy5sZW5ndGggLSAxKSB7XG5cdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdFx0Ly8gU2tpcCBkaXNhYmxlZCBvcHRpb25zXG5cdFx0XHRjb25zdCBuZXh0T3B0aW9uRGlzYWJsZWQgPSB0aGlzLm9wdGlvbnNbdGhpcy5zZWxlY3RlZCArIDFdLmlzRGlzYWJsZWQ7XG5cblx0XHRcdGlmIChuZXh0T3B0aW9uRGlzYWJsZWQgJiYgdGhpcy5vcHRpb25zLmxlbmd0aCA+IHRoaXMuc2VsZWN0ZWQgKyAyKSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0ZWQgKz0gMjtcblx0XHRcdH0gZWxzZSBpZiAobmV4dE9wdGlvbkRpc2FibGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc2VsZWN0ZWQrKztcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2V0IGZvY3VzL3NlbGVjdGlvbiAtIG9ubHkgZmlyZSBldmVudCB3aGVuIGNsb3NpbmcgZHJvcC1kb3duIG9yIG9uIGJsdXJcblx0XHRcdHRoaXMuc2VsZWN0KHRoaXMuc2VsZWN0ZWQpO1xuXHRcdFx0dGhpcy5zZWxlY3RMaXN0LnNldEZvY3VzKFt0aGlzLnNlbGVjdGVkXSk7XG5cdFx0XHR0aGlzLnNlbGVjdExpc3QucmV2ZWFsKHRoaXMuc2VsZWN0TGlzdC5nZXRGb2N1cygpWzBdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uVXBBcnJvdyhlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zZWxlY3RlZCA+IDApIHtcblx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0Ly8gU2tpcCBkaXNhYmxlZCBvcHRpb25zXG5cdFx0XHRjb25zdCBwcmV2aW91c09wdGlvbkRpc2FibGVkID0gdGhpcy5vcHRpb25zW3RoaXMuc2VsZWN0ZWQgLSAxXS5pc0Rpc2FibGVkO1xuXHRcdFx0aWYgKHByZXZpb3VzT3B0aW9uRGlzYWJsZWQgJiYgdGhpcy5zZWxlY3RlZCA+IDEpIHtcblx0XHRcdFx0dGhpcy5zZWxlY3RlZCAtPSAyO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zZWxlY3RlZC0tO1xuXHRcdFx0fVxuXHRcdFx0Ly8gU2V0IGZvY3VzL3NlbGVjdGlvbiAtIG9ubHkgZmlyZSBldmVudCB3aGVuIGNsb3NpbmcgZHJvcC1kb3duIG9yIG9uIGJsdXJcblx0XHRcdHRoaXMuc2VsZWN0KHRoaXMuc2VsZWN0ZWQpO1xuXHRcdFx0dGhpcy5zZWxlY3RMaXN0LnNldEZvY3VzKFt0aGlzLnNlbGVjdGVkXSk7XG5cdFx0XHR0aGlzLnNlbGVjdExpc3QucmV2ZWFsKHRoaXMuc2VsZWN0TGlzdC5nZXRGb2N1cygpWzBdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uUGFnZVVwKGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXG5cdFx0dGhpcy5zZWxlY3RMaXN0LmZvY3VzUHJldmlvdXNQYWdlKCk7XG5cblx0XHQvLyBBbGxvdyBzY3JvbGxpbmcgdG8gc2V0dGxlXG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLnNlbGVjdGVkID0gdGhpcy5zZWxlY3RMaXN0LmdldEZvY3VzKClbMF07XG5cblx0XHRcdC8vIFNoaWZ0IHNlbGVjdGlvbiBkb3duIGlmIHdlIGxhbmQgb24gYSBkaXNhYmxlZCBvcHRpb25cblx0XHRcdGlmICh0aGlzLm9wdGlvbnNbdGhpcy5zZWxlY3RlZF0uaXNEaXNhYmxlZCAmJiB0aGlzLnNlbGVjdGVkIDwgdGhpcy5vcHRpb25zLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0dGhpcy5zZWxlY3RlZCsrO1xuXHRcdFx0XHR0aGlzLnNlbGVjdExpc3Quc2V0Rm9jdXMoW3RoaXMuc2VsZWN0ZWRdKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc2VsZWN0TGlzdC5yZXZlYWwodGhpcy5zZWxlY3RlZCk7XG5cdFx0XHR0aGlzLnNlbGVjdCh0aGlzLnNlbGVjdGVkKTtcblx0XHR9LCAxKTtcblx0fVxuXG5cdHByaXZhdGUgb25QYWdlRG93bihlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblxuXHRcdHRoaXMuc2VsZWN0TGlzdC5mb2N1c05leHRQYWdlKCk7XG5cblx0XHQvLyBBbGxvdyBzY3JvbGxpbmcgdG8gc2V0dGxlXG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLnNlbGVjdGVkID0gdGhpcy5zZWxlY3RMaXN0LmdldEZvY3VzKClbMF07XG5cblx0XHRcdC8vIFNoaWZ0IHNlbGVjdGlvbiB1cCBpZiB3ZSBsYW5kIG9uIGEgZGlzYWJsZWQgb3B0aW9uXG5cdFx0XHRpZiAodGhpcy5vcHRpb25zW3RoaXMuc2VsZWN0ZWRdLmlzRGlzYWJsZWQgJiYgdGhpcy5zZWxlY3RlZCA+IDApIHtcblx0XHRcdFx0dGhpcy5zZWxlY3RlZC0tO1xuXHRcdFx0XHR0aGlzLnNlbGVjdExpc3Quc2V0Rm9jdXMoW3RoaXMuc2VsZWN0ZWRdKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc2VsZWN0TGlzdC5yZXZlYWwodGhpcy5zZWxlY3RlZCk7XG5cdFx0XHR0aGlzLnNlbGVjdCh0aGlzLnNlbGVjdGVkKTtcblx0XHR9LCAxKTtcblx0fVxuXG5cdHByaXZhdGUgb25Ib21lKGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5sZW5ndGggPCAyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuc2VsZWN0ZWQgPSAwO1xuXHRcdGlmICh0aGlzLm9wdGlvbnNbdGhpcy5zZWxlY3RlZF0uaXNEaXNhYmxlZCAmJiB0aGlzLnNlbGVjdGVkID4gMSkge1xuXHRcdFx0dGhpcy5zZWxlY3RlZCsrO1xuXHRcdH1cblx0XHR0aGlzLnNlbGVjdExpc3Quc2V0Rm9jdXMoW3RoaXMuc2VsZWN0ZWRdKTtcblx0XHR0aGlzLnNlbGVjdExpc3QucmV2ZWFsKHRoaXMuc2VsZWN0ZWQpO1xuXHRcdHRoaXMuc2VsZWN0KHRoaXMuc2VsZWN0ZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkVuZChlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblxuXHRcdGlmICh0aGlzLm9wdGlvbnMubGVuZ3RoIDwgMikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnNlbGVjdGVkID0gdGhpcy5vcHRpb25zLmxlbmd0aCAtIDE7XG5cdFx0aWYgKHRoaXMub3B0aW9uc1t0aGlzLnNlbGVjdGVkXS5pc0Rpc2FibGVkICYmIHRoaXMuc2VsZWN0ZWQgPiAxKSB7XG5cdFx0XHR0aGlzLnNlbGVjdGVkLS07XG5cdFx0fVxuXHRcdHRoaXMuc2VsZWN0TGlzdC5zZXRGb2N1cyhbdGhpcy5zZWxlY3RlZF0pO1xuXHRcdHRoaXMuc2VsZWN0TGlzdC5yZXZlYWwodGhpcy5zZWxlY3RlZCk7XG5cdFx0dGhpcy5zZWxlY3QodGhpcy5zZWxlY3RlZCk7XG5cdH1cblxuXHQvLyBNaW1pYyBvcHRpb24gZmlyc3QgY2hhcmFjdGVyIG5hdmlnYXRpb24gb2YgbmF0aXZlIHNlbGVjdFxuXHRwcml2YXRlIG9uQ2hhcmFjdGVyKGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGNoID0gS2V5Q29kZVV0aWxzLnRvU3RyaW5nKGUua2V5Q29kZSk7XG5cdFx0bGV0IG9wdGlvbkluZGV4ID0gLTE7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMub3B0aW9ucy5sZW5ndGggLSAxOyBpKyspIHtcblx0XHRcdG9wdGlvbkluZGV4ID0gKGkgKyB0aGlzLnNlbGVjdGVkICsgMSkgJSB0aGlzLm9wdGlvbnMubGVuZ3RoO1xuXHRcdFx0aWYgKHRoaXMub3B0aW9uc1tvcHRpb25JbmRleF0udGV4dC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSA9PT0gY2ggJiYgIXRoaXMub3B0aW9uc1tvcHRpb25JbmRleF0uaXNEaXNhYmxlZCkge1xuXHRcdFx0XHR0aGlzLnNlbGVjdChvcHRpb25JbmRleCk7XG5cdFx0XHRcdHRoaXMuc2VsZWN0TGlzdC5zZXRGb2N1cyhbb3B0aW9uSW5kZXhdKTtcblx0XHRcdFx0dGhpcy5zZWxlY3RMaXN0LnJldmVhbCh0aGlzLnNlbGVjdExpc3QuZ2V0Rm9jdXMoKVswXSk7XG5cdFx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmhpZGVTZWxlY3REcm9wRG93bihmYWxzZSk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxzQkFBc0I7QUFDbEMsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsa0JBQWtCO0FBRTNCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQTRDO0FBRXJELFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsK0JBQStCO0FBRXhDLFNBQVMsWUFBWTtBQUVyQixZQUFZLFlBQVk7QUFDeEIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxTQUFTLG9CQUFvQjtBQUN0QyxTQUFTLGtCQUErQjtBQUN4QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDJCQUEyQjtBQUNwQyxPQUFPO0FBQ1AsU0FBUyxnQkFBZ0I7QUFHekIsTUFBTSxJQUFJLElBQUk7QUFFZCxNQUFNLGtDQUFrQztBQVN4QyxNQUFNLG1CQUF3RjtBQUFBLEVBRTdGLElBQUksYUFBcUI7QUFBRSxXQUFPO0FBQUEsRUFBaUM7QUFBQSxFQUVuRSxlQUFlLFdBQWlEO0FB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
