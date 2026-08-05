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
import { BrowserFeatures } from "../../../../base/browser/canIUse.js";
import * as DOM from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { applyDragImage } from "../../../../base/browser/ui/dnd/dnd.js";
import { InputBox } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { SelectBox } from "../../../../base/browser/ui/selectBox/selectBox.js";
import { Toggle, unthemedToggleStyles } from "../../../../base/browser/ui/toggle/toggle.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { isIOS } from "../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { isDefined, isUndefinedOrNull } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { defaultButtonStyles, getInputBoxStyle, getSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { settingsSelectBackground, settingsSelectBorder, settingsSelectForeground, settingsSelectListBorder, settingsTextInputBackground, settingsTextInputBorder, settingsTextInputForeground } from "../common/settingsEditorColorRegistry.js";
import "./media/settingsWidgets.css";
import { settingsDiscardIcon, settingsEditIcon, settingsRemoveIcon } from "./preferencesIcons.js";
const $ = DOM.$;
class ListSettingListModel {
  constructor(newItem) {
    this._dataItems = [];
    this._editKey = null;
    this._selectedIdx = null;
    this._newDataItem = newItem;
  }
  get items() {
    const items = this._dataItems.map((item, i) => {
      const editing = typeof this._editKey === "number" && this._editKey === i;
      return {
        ...item,
        editing,
        selected: i === this._selectedIdx || editing
      };
    });
    if (this._editKey === "create") {
      items.push({
        editing: true,
        selected: true,
        ...this._newDataItem
      });
    }
    return items;
  }
  setEditKey(key) {
    this._editKey = key;
  }
  setValue(listData) {
    this._dataItems = listData;
  }
  select(idx) {
    this._selectedIdx = idx;
  }
  getSelected() {
    return this._selectedIdx;
  }
  selectNext() {
    if (typeof this._selectedIdx === "number") {
      this._selectedIdx = Math.min(this._selectedIdx + 1, this._dataItems.length - 1);
    } else {
      this._selectedIdx = 0;
    }
  }
  selectPrevious() {
    if (typeof this._selectedIdx === "number") {
      this._selectedIdx = Math.max(this._selectedIdx - 1, 0);
    } else {
      this._selectedIdx = 0;
    }
  }
}
let AbstractListSettingWidget = class extends Disposable {
  constructor(container, themeService, contextViewService) {
    super();
    this.container = container;
    this.themeService = themeService;
    this.contextViewService = contextViewService;
    this.rowElements = [];
    this._onDidChangeList = this._register(new Emitter());
    this.model = new ListSettingListModel(this.getEmptyItem());
    this.listDisposables = this._register(new DisposableStore());
    this.onDidChangeList = this._onDidChangeList.event;
    this.listElement = DOM.append(container, $("div"));
    this.listElement.setAttribute("role", "list");
    this.getContainerClasses().forEach((c) => this.listElement.classList.add(c));
    DOM.append(container, this.renderAddButton());
    this.renderList();
    this._register(DOM.addDisposableListener(this.listElement, DOM.EventType.POINTER_DOWN, (e) => this.onListClick(e)));
    this._register(DOM.addDisposableListener(this.listElement, DOM.EventType.DBLCLICK, (e) => this.onListDoubleClick(e)));
    this._register(DOM.addStandardDisposableListener(this.listElement, "keydown", (e) => {
      if (e.equals(KeyCode.UpArrow)) {
        this.selectPreviousRow();
      } else if (e.equals(KeyCode.DownArrow)) {
        this.selectNextRow();
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }));
  }
  get domNode() {
    return this.listElement;
  }
  get items() {
    return this.model.items;
  }
  get isReadOnly() {
    return false;
  }
  setValue(listData) {
    this.model.setValue(listData);
    this.renderList();
  }
  renderHeader() {
    return;
  }
  isAddButtonVisible() {
    return true;
  }
  renderList() {
    const focused = DOM.isAncestorOfActiveElement(this.listElement);
    DOM.clearNode(this.listElement);
    this.listDisposables.clear();
    const newMode = this.model.items.some((item) => !!(item.editing && this.isItemNew(item)));
    this.container.classList.toggle("setting-list-hide-add-button", !this.isAddButtonVisible() || newMode);
    if (this.model.items.length) {
      this.listElement.tabIndex = 0;
    } else {
      this.listElement.removeAttribute("tabIndex");
    }
    const header = this.renderHeader();
    if (header) {
      this.listElement.appendChild(header);
    }
    this.rowElements = this.model.items.map((item, i) => this.renderDataOrEditItem(item, i, focused));
    this.rowElements.forEach((rowElement) => this.listElement.appendChild(rowElement));
  }
  createBasicSelectBox(value) {
    const selectBoxOptions = value.options.map(({ value: value2, description }) => ({ text: value2, description }));
    const selected = value.options.findIndex((option) => value.data === option.value);
    const styles = getSelectBoxStyles({
      selectBackground: settingsSelectBackground,
      selectForeground: settingsSelectForeground,
      selectBorder: settingsSelectBorder,
      selectListBorder: settingsSelectListBorder
    });
    const selectBox = new SelectBox(selectBoxOptions, selected, this.contextViewService, styles, {
      useCustomDrawn: !(isIOS && BrowserFeatures.pointerEvents)
    });
    return selectBox;
  }
  editSetting(idx) {
    this.model.setEditKey(idx);
    this.renderList();
  }
  cancelEdit() {
    this.model.setEditKey("none");
    this.renderList();
  }
  handleItemChange(originalItem, changedItem, idx) {
    this.model.setEditKey("none");
    if (this.isItemNew(originalItem)) {
      this._onDidChangeList.fire({
        type: "add",
        newItem: changedItem,
        targetIndex: idx
      });
    } else {
      this._onDidChangeList.fire({
        type: "change",
        originalItem,
        newItem: changedItem,
        targetIndex: idx
      });
    }
    this.renderList();
  }
  renderDataOrEditItem(item, idx, listFocused) {
    const rowElement = item.editing ? this.renderEdit(item, idx) : this.renderDataItem(item, idx, listFocused);
    rowElement.setAttribute("role", "listitem");
    return rowElement;
  }
  renderDataItem(item, idx, listFocused) {
    const rowElementGroup = this.renderItem(item, idx);
    const rowElement = rowElementGroup.rowElement;
    rowElement.setAttribute("data-index", idx + "");
    rowElement.setAttribute("tabindex", item.selected ? "0" : "-1");
    rowElement.classList.toggle("selected", item.selected);
    const actionBar = new ActionBar(rowElement);
    this.listDisposables.add(actionBar);
    actionBar.push(this.getActionsForItem(item, idx), { icon: true, label: true });
    this.addTooltipsToRow(rowElementGroup, item);
    if (item.selected && listFocused) {
      disposableTimeout(() => rowElement.focus(), void 0, this.listDisposables);
    }
    this.listDisposables.add(DOM.addDisposableListener(rowElement, "click", (e) => {
      e.stopPropagation();
    }));
    return rowElement;
  }
  renderAddButton() {
    const rowElement = $(".setting-list-new-row");
    const startAddButton = this._register(new Button(rowElement, defaultButtonStyles));
    startAddButton.label = this.getLocalizedStrings().addButtonLabel;
    startAddButton.element.classList.add("setting-list-addButton");
    this._register(startAddButton.onDidClick(() => {
      this.model.setEditKey("create");
      this.renderList();
    }));
    return rowElement;
  }
  onListClick(e) {
    const targetIdx = this.getClickedItemIndex(e);
    if (targetIdx < 0) {
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (this.model.getSelected() === targetIdx) {
      return;
    }
    this.selectRow(targetIdx);
  }
  onListDoubleClick(e) {
    const targetIdx = this.getClickedItemIndex(e);
    if (targetIdx < 0) {
      return;
    }
    if (this.isReadOnly) {
      return;
    }
    const item = this.model.items[targetIdx];
    if (item) {
      this.editSetting(targetIdx);
      e.preventDefault();
      e.stopPropagation();
    }
  }
  getClickedItemIndex(e) {
    if (!e.target) {
      return -1;
    }
    const actionbar = DOM.findParentWithClass(e.target, "monaco-action-bar");
    if (actionbar) {
      return -1;
    }
    const element = DOM.findParentWithClass(e.target, "setting-list-row");
    if (!element) {
      return -1;
    }
    const targetIdxStr = element.getAttribute("data-index");
    if (!targetIdxStr) {
      return -1;
    }
    const targetIdx = parseInt(targetIdxStr);
    return targetIdx;
  }
  selectRow(idx) {
    this.model.select(idx);
    this.rowElements.forEach((row) => row.classList.remove("selected"));
    const selectedRow = this.rowElements[this.model.getSelected()];
    selectedRow.classList.add("selected");
    selectedRow.focus();
  }
  selectNextRow() {
    this.model.selectNext();
    this.selectRow(this.model.getSelected());
  }
  selectPreviousRow() {
    this.model.selectPrevious();
    this.selectRow(this.model.getSelected());
  }
};
AbstractListSettingWidget = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, IContextViewService)
], AbstractListSettingWidget);
let ListSettingWidget = class extends AbstractListSettingWidget {
  constructor(container, themeService, contextViewService, hoverService) {
    super(container, themeService, contextViewService);
    this.hoverService = hoverService;
    this.showAddButton = true;
  }
  setValue(listData, options) {
    this.keyValueSuggester = options?.keySuggester;
    this.showAddButton = options?.showAddButton ?? true;
    super.setValue(listData);
  }
  getEmptyItem() {
    return {
      value: {
        type: "string",
        data: ""
      }
    };
  }
  isAddButtonVisible() {
    return this.showAddButton;
  }
  getContainerClasses() {
    return ["setting-list-widget"];
  }
  getActionsForItem(item, idx) {
    if (this.isReadOnly) {
      return [];
    }
    return [
      {
        class: ThemeIcon.asClassName(settingsEditIcon),
        enabled: true,
        id: "workbench.action.editListItem",
        tooltip: this.getLocalizedStrings().editActionTooltip,
        run: () => this.editSetting(idx)
      },
      {
        class: ThemeIcon.asClassName(settingsRemoveIcon),
        enabled: true,
        id: "workbench.action.removeListItem",
        tooltip: this.getLocalizedStrings().deleteActionTooltip,
        run: () => this._onDidChangeList.fire({ type: "remove", originalItem: item, targetIndex: idx })
      }
    ];
  }
  renderItem(item, idx) {
    const rowElement = $(".setting-list-row");
    const valueElement = DOM.append(rowElement, $(".setting-list-value"));
    const siblingElement = DOM.append(rowElement, $(".setting-list-sibling"));
    valueElement.textContent = item.value.data.toString();
    siblingElement.textContent = item.sibling ? `when: ${item.sibling}` : null;
    this.addDragAndDrop(rowElement, item, idx);
    return { rowElement, keyElement: valueElement, valueElement: siblingElement };
  }
  addDragAndDrop(rowElement, item, idx) {
    if (this.model.items.every((item2) => !item2.editing)) {
      rowElement.draggable = true;
      rowElement.classList.add("draggable");
    } else {
      rowElement.draggable = false;
      rowElement.classList.remove("draggable");
    }
    this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_START, (ev) => {
      this.dragDetails = {
        element: rowElement,
        item,
        itemIndex: idx
      };
      applyDragImage(ev, rowElement, item.value.data);
    }));
    this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_OVER, (ev) => {
      if (!this.dragDetails) {
        return false;
      }
      ev.preventDefault();
      if (ev.dataTransfer) {
        ev.dataTransfer.dropEffect = "move";
      }
      return true;
    }));
    let counter = 0;
    this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_ENTER, (ev) => {
      counter++;
      rowElement.classList.add("drag-hover");
    }));
    this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_LEAVE, (ev) => {
      counter--;
      if (!counter) {
        rowElement.classList.remove("drag-hover");
      }
    }));
    this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DROP, (ev) => {
      if (!this.dragDetails) {
        return false;
      }
      ev.preventDefault();
      counter = 0;
      if (this.dragDetails.element !== rowElement) {
        this._onDidChangeList.fire({
          type: "move",
          originalItem: this.dragDetails.item,
          sourceIndex: this.dragDetails.itemIndex,
          newItem: item,
          targetIndex: idx
        });
      }
      return true;
    }));
    this.listDisposables.add(DOM.addDisposableListener(rowElement, DOM.EventType.DRAG_END, (ev) => {
      counter = 0;
      rowElement.classList.remove("drag-hover");
      ev.dataTransfer?.clearData();
      if (this.dragDetails) {
        this.dragDetails = void 0;
      }
    }));
  }
  renderEdit(item, idx) {
    const rowElement = $(".setting-list-edit-row");
    let valueInput;
    let currentDisplayValue;
    let currentEnumOptions;
    if (this.keyValueSuggester) {
      const enumData = this.keyValueSuggester(this.model.items.map(({ value: { data } }) => data), idx);
      item = {
        ...item,
        value: {
          type: "enum",
          data: item.value.data,
          options: enumData ? enumData.options : []
        }
      };
    }
    switch (item.value.type) {
      case "string":
        valueInput = this.renderInputBox(item.value, rowElement);
        break;
      case "enum":
        valueInput = this.renderDropdown(item.value, rowElement);
        currentEnumOptions = item.value.options;
        if (item.value.options.length) {
          currentDisplayValue = this.isItemNew(item) ? currentEnumOptions[0].value : item.value.data;
        }
        break;
    }
    const updatedInputBoxItem = () => {
      const inputBox = valueInput;
      return {
        value: {
          type: "string",
          data: inputBox.value
        },
        sibling: siblingInput?.value
      };
    };
    const updatedSelectBoxItem = (selectedValue) => {
      return {
        value: {
          type: "enum",
          data: selectedValue,
          options: currentEnumOptions ?? []
        }
      };
    };
    const onKeyDown = (e) => {
      if (e.equals(KeyCode.Enter)) {
        this.handleItemChange(item, updatedInputBoxItem(), idx);
      } else if (e.equals(KeyCode.Escape)) {
        this.cancelEdit();
        e.preventDefault();
      }
      rowElement?.focus();
    };
    if (item.value.type !== "string") {
      const selectBox = valueInput;
      this.listDisposables.add(
        selectBox.onDidSelect(({ selected }) => {
          currentDisplayValue = selected;
        })
      );
    } else {
      const inputBox = valueInput;
      this.listDisposables.add(
        DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, onKeyDown)
      );
    }
    let siblingInput;
    if (!isUndefinedOrNull(item.sibling)) {
      siblingInput = new InputBox(rowElement, this.contextViewService, {
        placeholder: this.getLocalizedStrings().siblingInputPlaceholder,
        inputBoxStyles: getInputBoxStyle({
          inputBackground: settingsTextInputBackground,
          inputForeground: settingsTextInputForeground,
          inputBorder: settingsTextInputBorder
        })
      });
      siblingInput.element.classList.add("setting-list-siblingInput");
      this.listDisposables.add(siblingInput);
      siblingInput.value = item.sibling;
      this.listDisposables.add(
        DOM.addStandardDisposableListener(siblingInput.inputElement, DOM.EventType.KEY_DOWN, onKeyDown)
      );
    } else if (valueInput instanceof InputBox) {
      valueInput.element.classList.add("no-sibling");
    }
    const okButton = this.listDisposables.add(new Button(rowElement, defaultButtonStyles));
    okButton.label = localize("okButton", "OK");
    okButton.element.classList.add("setting-list-ok-button");
    this.listDisposables.add(okButton.onDidClick(() => {
      if (item.value.type === "string") {
        this.handleItemChange(item, updatedInputBoxItem(), idx);
      } else {
        this.handleItemChange(item, updatedSelectBoxItem(currentDisplayValue), idx);
      }
    }));
    const cancelButton = this.listDisposables.add(new Button(rowElement, { secondary: true, ...defaultButtonStyles }));
    cancelButton.label = localize("cancelButton", "Cancel");
    cancelButton.element.classList.add("setting-list-cancel-button");
    this.listDisposables.add(cancelButton.onDidClick(() => this.cancelEdit()));
    this.listDisposables.add(
      disposableTimeout(() => {
        valueInput.focus();
        if (valueInput instanceof InputBox) {
          valueInput.select();
        }
      })
    );
    return rowElement;
  }
  isItemNew(item) {
    return item.value.data === "";
  }
  addTooltipsToRow(rowElementGroup, { value, sibling }) {
    const title = isUndefinedOrNull(sibling) ? localize("listValueHintLabel", "List item `{0}`", value.data) : localize("listSiblingHintLabel", "List item `{0}` with sibling `${1}`", value.data, sibling);
    const { rowElement } = rowElementGroup;
    this.listDisposables.add(this.hoverService.setupDelayedHover(rowElement, { content: title }));
    rowElement.setAttribute("aria-label", title);
  }
  getLocalizedStrings() {
    return {
      deleteActionTooltip: localize("removeItem", "Remove Item"),
      editActionTooltip: localize("editItem", "Edit Item"),
      addButtonLabel: localize("addItem", "Add Item"),
      inputPlaceholder: localize("itemInputPlaceholder", "Item..."),
      siblingInputPlaceholder: localize("listSiblingInputPlaceholder", "Sibling...")
    };
  }
  renderInputBox(value, rowElement) {
    const valueInput = new InputBox(rowElement, this.contextViewService, {
      placeholder: this.getLocalizedStrings().inputPlaceholder,
      inputBoxStyles: getInputBoxStyle({
        inputBackground: settingsTextInputBackground,
        inputForeground: settingsTextInputForeground,
        inputBorder: settingsTextInputBorder
      })
    });
    valueInput.element.classList.add("setting-list-valueInput");
    this.listDisposables.add(valueInput);
    valueInput.value = value.data.toString();
    return valueInput;
  }
  renderDropdown(value, rowElement) {
    if (value.type !== "enum") {
      throw new Error("Valuetype must be enum.");
    }
    const selectBox = this.createBasicSelectBox(value);
    const wrapper = $(".setting-list-object-list-row");
    selectBox.render(wrapper);
    rowElement.appendChild(wrapper);
    return selectBox;
  }
};
ListSettingWidget = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IHoverService)
], ListSettingWidget);
class ExcludeSettingWidget extends ListSettingWidget {
  getContainerClasses() {
    return ["setting-list-include-exclude-widget"];
  }
  addDragAndDrop(rowElement, item, idx) {
    return;
  }
  addTooltipsToRow(rowElementGroup, item) {
    let title = isUndefinedOrNull(item.sibling) ? localize("excludePatternHintLabel", "Exclude files matching `{0}`", item.value.data) : localize("excludeSiblingHintLabel", "Exclude files matching `{0}`, only when a file matching `{1}` is present", item.value.data, item.sibling);
    if (item.source) {
      title += localize("excludeIncludeSource", ". Default value provided by `{0}`", item.source);
    }
    const markdownTitle = new MarkdownString().appendMarkdown(title);
    const { rowElement } = rowElementGroup;
    this.listDisposables.add(this.hoverService.setupDelayedHover(rowElement, { content: markdownTitle }));
    rowElement.setAttribute("aria-label", title);
  }
  getLocalizedStrings() {
    return {
      deleteActionTooltip: localize("removeExcludeItem", "Remove Exclude Item"),
      editActionTooltip: localize("editExcludeItem", "Edit Exclude Item"),
      addButtonLabel: localize("addPattern", "Add Pattern"),
      inputPlaceholder: localize("excludePatternInputPlaceholder", "Exclude Pattern..."),
      siblingInputPlaceholder: localize("excludeSiblingInputPlaceholder", "When Pattern Is Present...")
    };
  }
}
class IncludeSettingWidget extends ListSettingWidget {
  getContainerClasses() {
    return ["setting-list-include-exclude-widget"];
  }
  addDragAndDrop(rowElement, item, idx) {
    return;
  }
  addTooltipsToRow(rowElementGroup, item) {
    let title = isUndefinedOrNull(item.sibling) ? localize("includePatternHintLabel", "Include files matching `{0}`", item.value.data) : localize("includeSiblingHintLabel", "Include files matching `{0}`, only when a file matching `{1}` is present", item.value.data, item.sibling);
    if (item.source) {
      title += localize("excludeIncludeSource", ". Default value provided by `{0}`", item.source);
    }
    const markdownTitle = new MarkdownString().appendMarkdown(title);
    const { rowElement } = rowElementGroup;
    this.listDisposables.add(this.hoverService.setupDelayedHover(rowElement, { content: markdownTitle }));
    rowElement.setAttribute("aria-label", title);
  }
  getLocalizedStrings() {
    return {
      deleteActionTooltip: localize("removeIncludeItem", "Remove Include Item"),
      editActionTooltip: localize("editIncludeItem", "Edit Include Item"),
      addButtonLabel: localize("addPattern", "Add Pattern"),
      inputPlaceholder: localize("includePatternInputPlaceholder", "Include Pattern..."),
      siblingInputPlaceholder: localize("includeSiblingInputPlaceholder", "When Pattern Is Present...")
    };
  }
}
let ObjectSettingDropdownWidget = class extends AbstractListSettingWidget {
  constructor(container, themeService, contextViewService, hoverService) {
    super(container, themeService, contextViewService);
    this.hoverService = hoverService;
    this.editable = true;
    this.currentSettingKey = "";
    this.showAddButton = true;
    this.keySuggester = () => void 0;
    this.valueSuggester = () => void 0;
  }
  setValue(listData, options) {
    this.editable = !options?.isReadOnly;
    this.showAddButton = options?.showAddButton ?? this.showAddButton;
    this.keySuggester = options?.keySuggester ?? this.keySuggester;
    this.valueSuggester = options?.valueSuggester ?? this.valueSuggester;
    if (isDefined(options) && options.settingKey !== this.currentSettingKey) {
      this.model.setEditKey("none");
      this.model.select(null);
      this.currentSettingKey = options.settingKey;
    }
    super.setValue(listData);
  }
  isItemNew(item) {
    return item.key.data === "" && item.value.data === "";
  }
  isAddButtonVisible() {
    return this.showAddButton;
  }
  get isReadOnly() {
    return !this.editable;
  }
  getEmptyItem() {
    return {
      key: { type: "string", data: "" },
      value: { type: "string", data: "" },
      removable: true,
      resetable: false
    };
  }
  getContainerClasses() {
    return ["setting-list-object-widget"];
  }
  getActionsForItem(item, idx) {
    if (this.isReadOnly) {
      return [];
    }
    const actions = [
      {
        class: ThemeIcon.asClassName(settingsEditIcon),
        enabled: true,
        id: "workbench.action.editListItem",
        label: "",
        tooltip: this.getLocalizedStrings().editActionTooltip,
        run: () => this.editSetting(idx)
      }
    ];
    if (item.resetable) {
      actions.push({
        class: ThemeIcon.asClassName(settingsDiscardIcon),
        enabled: true,
        id: "workbench.action.resetListItem",
        label: "",
        tooltip: this.getLocalizedStrings().resetActionTooltip,
        run: () => this._onDidChangeList.fire({ type: "reset", originalItem: item, targetIndex: idx })
      });
    }
    if (item.removable) {
      actions.push({
        class: ThemeIcon.asClassName(settingsRemoveIcon),
        enabled: true,
        id: "workbench.action.removeListItem",
        label: "",
        tooltip: this.getLocalizedStrings().deleteActionTooltip,
        run: () => this._onDidChangeList.fire({ type: "remove", originalItem: item, targetIndex: idx })
      });
    }
    return actions;
  }
  renderHeader() {
    const header = $(".setting-list-row-header");
    const keyHeader = DOM.append(header, $(".setting-list-object-key"));
    const valueHeader = DOM.append(header, $(".setting-list-object-value"));
    const { keyHeaderText, valueHeaderText } = this.getLocalizedStrings();
    keyHeader.textContent = keyHeaderText;
    valueHeader.textContent = valueHeaderText;
    return header;
  }
  renderItem(item, idx) {
    const rowElement = $(".setting-list-row");
    rowElement.classList.add("setting-list-object-row");
    const keyElement = DOM.append(rowElement, $(".setting-list-object-key"));
    const valueElement = DOM.append(rowElement, $(".setting-list-object-value"));
    keyElement.textContent = item.key.data;
    valueElement.textContent = item.value.data.toString();
    return { rowElement, keyElement, valueElement };
  }
  renderEdit(item, idx) {
    const rowElement = $(".setting-list-edit-row.setting-list-object-row");
    const changedItem = { ...item };
    const onKeyChange = (key) => {
      changedItem.key = key;
      okButton.enabled = key.data !== "";
      const suggestedValue = this.valueSuggester(key.data) ?? item.value;
      if (this.shouldUseSuggestion(item.value, changedItem.value, suggestedValue)) {
        onValueChange(suggestedValue);
        renderLatestValue();
      }
    };
    const onValueChange = (value) => {
      changedItem.value = value;
    };
    let keyWidget;
    let keyElement;
    if (this.showAddButton) {
      if (this.isItemNew(item)) {
        const suggestedKey = this.keySuggester(this.model.items.map(({ key: { data } }) => data));
        if (isDefined(suggestedKey)) {
          changedItem.key = suggestedKey;
          const suggestedValue = this.valueSuggester(changedItem.key.data);
          onValueChange(suggestedValue ?? changedItem.value);
        }
      }
      const { widget, element } = this.renderEditWidget(changedItem.key, {
        idx,
        isKey: true,
        originalItem: item,
        changedItem,
        update: onKeyChange
      });
      keyWidget = widget;
      keyElement = element;
    } else {
      keyElement = $(".setting-list-object-key");
      keyElement.textContent = item.key.data;
    }
    let valueWidget;
    const valueContainer = $(".setting-list-object-value-container");
    const renderLatestValue = () => {
      const { widget, element } = this.renderEditWidget(changedItem.value, {
        idx,
        isKey: false,
        originalItem: item,
        changedItem,
        update: onValueChange
      });
      valueWidget = widget;
      DOM.clearNode(valueContainer);
      valueContainer.append(element);
    };
    renderLatestValue();
    rowElement.append(keyElement, valueContainer);
    const okButton = this.listDisposables.add(new Button(rowElement, defaultButtonStyles));
    okButton.enabled = changedItem.key.data !== "";
    okButton.label = localize("okButton", "OK");
    okButton.element.classList.add("setting-list-ok-button");
    this.listDisposables.add(okButton.onDidClick(() => this.handleItemChange(item, changedItem, idx)));
    const cancelButton = this.listDisposables.add(new Button(rowElement, { secondary: true, ...defaultButtonStyles }));
    cancelButton.label = localize("cancelButton", "Cancel");
    cancelButton.element.classList.add("setting-list-cancel-button");
    this.listDisposables.add(cancelButton.onDidClick(() => this.cancelEdit()));
    this.listDisposables.add(
      disposableTimeout(() => {
        const widget = keyWidget ?? valueWidget;
        widget.focus();
        if (widget instanceof InputBox) {
          widget.select();
        }
      })
    );
    return rowElement;
  }
  renderEditWidget(keyOrValue, options) {
    switch (keyOrValue.type) {
      case "string":
        return this.renderStringEditWidget(keyOrValue, options);
      case "enum":
        return this.renderEnumEditWidget(keyOrValue, options);
      case "boolean":
        return this.renderEnumEditWidget(
          {
            type: "enum",
            data: keyOrValue.data.toString(),
            options: [{ value: "true" }, { value: "false" }]
          },
          options
        );
    }
  }
  renderStringEditWidget(keyOrValue, { idx, isKey, originalItem, changedItem, update }) {
    const wrapper = $(isKey ? ".setting-list-object-input-key" : ".setting-list-object-input-value");
    const inputBox = new InputBox(wrapper, this.contextViewService, {
      placeholder: isKey ? localize("objectKeyInputPlaceholder", "Key") : localize("objectValueInputPlaceholder", "Value"),
      inputBoxStyles: getInputBoxStyle({
        inputBackground: settingsTextInputBackground,
        inputForeground: settingsTextInputForeground,
        inputBorder: settingsTextInputBorder
      })
    });
    inputBox.element.classList.add("setting-list-object-input");
    this.listDisposables.add(inputBox);
    inputBox.value = keyOrValue.data;
    this.listDisposables.add(inputBox.onDidChange((value) => update({ ...keyOrValue, data: value })));
    const onKeyDown = (e) => {
      if (e.equals(KeyCode.Enter)) {
        this.handleItemChange(originalItem, changedItem, idx);
      } else if (e.equals(KeyCode.Escape)) {
        this.cancelEdit();
        e.preventDefault();
      }
    };
    this.listDisposables.add(
      DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, onKeyDown)
    );
    return { widget: inputBox, element: wrapper };
  }
  renderEnumEditWidget(keyOrValue, { isKey, changedItem, update }) {
    const selectBox = this.createBasicSelectBox(keyOrValue);
    const changedKeyOrValue = isKey ? changedItem.key : changedItem.value;
    this.listDisposables.add(
      selectBox.onDidSelect(
        ({ selected: selected2 }) => update(
          changedKeyOrValue.type === "boolean" ? { ...changedKeyOrValue, data: selected2 === "true" ? true : false } : { ...changedKeyOrValue, data: selected2 }
        )
      )
    );
    const wrapper = $(".setting-list-object-input");
    wrapper.classList.add(
      isKey ? "setting-list-object-input-key" : "setting-list-object-input-value"
    );
    selectBox.render(wrapper);
    const selected = keyOrValue.options.findIndex((option) => keyOrValue.data === option.value);
    if (selected === -1 && keyOrValue.options.length) {
      update(
        changedKeyOrValue.type === "boolean" ? { ...changedKeyOrValue, data: true } : { ...changedKeyOrValue, data: keyOrValue.options[0].value }
      );
    } else if (changedKeyOrValue.type === "boolean") {
      update({ ...changedKeyOrValue, data: keyOrValue.data === "true" });
    }
    return { widget: selectBox, element: wrapper };
  }
  shouldUseSuggestion(originalValue, previousValue, newValue) {
    if (newValue.type !== "enum" && newValue.type === previousValue.type && newValue.data === previousValue.data) {
      return false;
    }
    if (originalValue.data === "") {
      return true;
    }
    if (previousValue.type === newValue.type && newValue.type !== "enum") {
      return false;
    }
    if (previousValue.type === "enum" && newValue.type === "enum") {
      const previousEnums = new Set(previousValue.options.map(({ value }) => value));
      newValue.options.forEach(({ value }) => previousEnums.delete(value));
      if (previousEnums.size === 0) {
        return false;
      }
    }
    return true;
  }
  addTooltipsToRow(rowElementGroup, item) {
    const { keyElement, valueElement, rowElement } = rowElementGroup;
    let accessibleDescription;
    if (item.source) {
      accessibleDescription = localize("objectPairHintLabelWithSource", "The property `{0}` is set to `{1}` by `{2}`.", item.key.data, item.value.data, item.source);
    } else {
      accessibleDescription = localize("objectPairHintLabel", "The property `{0}` is set to `{1}`.", item.key.data, item.value.data);
    }
    const markdownString = new MarkdownString().appendMarkdown(accessibleDescription);
    const keyDescription = this.getEnumDescription(item.key) ?? item.keyDescription ?? markdownString;
    this.listDisposables.add(this.hoverService.setupDelayedHover(keyElement, { content: keyDescription }));
    const valueDescription = this.getEnumDescription(item.value) ?? markdownString;
    this.listDisposables.add(this.hoverService.setupDelayedHover(valueElement, { content: valueDescription }));
    rowElement.setAttribute("aria-label", accessibleDescription);
  }
  getEnumDescription(keyOrValue) {
    const enumDescription = keyOrValue.type === "enum" ? keyOrValue.options.find(({ value }) => keyOrValue.data === value)?.description : void 0;
    return enumDescription;
  }
  getLocalizedStrings() {
    return {
      deleteActionTooltip: localize("removeItem", "Remove Item"),
      resetActionTooltip: localize("resetItem", "Reset Item"),
      editActionTooltip: localize("editItem", "Edit Item"),
      addButtonLabel: localize("addItem", "Add Item"),
      keyHeaderText: localize("objectKeyHeader", "Item"),
      valueHeaderText: localize("objectValueHeader", "Value")
    };
  }
};
ObjectSettingDropdownWidget = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IHoverService)
], ObjectSettingDropdownWidget);
let ObjectSettingCheckboxWidget = class extends AbstractListSettingWidget {
  constructor(container, themeService, contextViewService, hoverService) {
    super(container, themeService, contextViewService);
    this.hoverService = hoverService;
    this.currentSettingKey = "";
  }
  setValue(listData, options) {
    if (isDefined(options) && options.settingKey !== this.currentSettingKey) {
      this.model.setEditKey("none");
      this.model.select(null);
      this.currentSettingKey = options.settingKey;
    }
    super.setValue(listData);
  }
  isItemNew(item) {
    return !item.key.data && !item.value.data;
  }
  getEmptyItem() {
    return {
      key: { type: "string", data: "" },
      value: { type: "boolean", data: false },
      removable: false,
      resetable: true
    };
  }
  getContainerClasses() {
    return ["setting-list-object-widget"];
  }
  getActionsForItem(item, idx) {
    return [];
  }
  isAddButtonVisible() {
    return false;
  }
  renderHeader() {
    return void 0;
  }
  renderDataOrEditItem(item, idx, listFocused) {
    const rowElement = this.renderEdit(item, idx);
    rowElement.setAttribute("role", "listitem");
    return rowElement;
  }
  renderItem(item, idx) {
    const rowElement = $(".blank-row");
    const keyElement = $(".blank-row-key");
    return { rowElement, keyElement };
  }
  renderEdit(item, idx) {
    const rowElement = $(".setting-list-edit-row.setting-list-object-row.setting-item-bool");
    const changedItem = { ...item };
    const onValueChange = (newValue) => {
      changedItem.value.data = newValue;
      this.handleItemChange(item, changedItem, idx);
    };
    const checkboxDescription = item.keyDescription ? `${item.keyDescription} (${item.key.data})` : item.key.data;
    const { element, widget: checkbox } = this.renderEditWidget(changedItem.value.data, checkboxDescription, onValueChange);
    rowElement.appendChild(element);
    const valueElement = DOM.append(rowElement, $(".setting-list-object-value"));
    valueElement.textContent = checkboxDescription;
    const rowElementGroup = { rowElement, keyElement: valueElement, valueElement: checkbox.domNode };
    this.addTooltipsToRow(rowElementGroup, item);
    this._register(DOM.addDisposableListener(valueElement, DOM.EventType.MOUSE_DOWN, (e) => {
      const targetElement = e.target;
      if (targetElement.tagName.toLowerCase() !== "a") {
        checkbox.checked = !checkbox.checked;
        onValueChange(checkbox.checked);
      }
      DOM.EventHelper.stop(e);
    }));
    return rowElement;
  }
  renderEditWidget(value, checkboxDescription, onValueChange) {
    const checkbox = new Toggle({
      icon: Codicon.check,
      actionClassName: "setting-value-checkbox",
      isChecked: value,
      title: checkboxDescription,
      ...unthemedToggleStyles
    });
    this.listDisposables.add(checkbox);
    const wrapper = $(".setting-list-object-input");
    wrapper.classList.add("setting-list-object-input-key-checkbox");
    checkbox.domNode.classList.add("setting-value-checkbox");
    wrapper.appendChild(checkbox.domNode);
    this._register(DOM.addDisposableListener(wrapper, DOM.EventType.MOUSE_DOWN, (e) => {
      checkbox.checked = !checkbox.checked;
      onValueChange(checkbox.checked);
      e.stopImmediatePropagation();
    }));
    return { widget: checkbox, element: wrapper };
  }
  addTooltipsToRow(rowElementGroup, item) {
    const accessibleDescription = localize("objectPairHintLabel", "The property `{0}` is set to `{1}`.", item.key.data, item.value.data);
    const title = item.keyDescription ?? accessibleDescription;
    const { rowElement, keyElement, valueElement } = rowElementGroup;
    this.listDisposables.add(this.hoverService.setupDelayedHover(keyElement, { content: title }));
    valueElement.setAttribute("aria-label", accessibleDescription);
    rowElement.setAttribute("aria-label", accessibleDescription);
  }
  getLocalizedStrings() {
    return {
      deleteActionTooltip: localize("removeItem", "Remove Item"),
      resetActionTooltip: localize("resetItem", "Reset Item"),
      editActionTooltip: localize("editItem", "Edit Item"),
      addButtonLabel: localize("addItem", "Add Item"),
      keyHeaderText: localize("objectKeyHeader", "Item"),
      valueHeaderText: localize("objectValueHeader", "Value")
    };
  }
};
ObjectSettingCheckboxWidget = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IHoverService)
], ObjectSettingCheckboxWidget);
export {
  AbstractListSettingWidget,
  ExcludeSettingWidget,
  IncludeSettingWidget,
  ListSettingListModel,
  ListSettingWidget,
  ObjectSettingCheckboxWidget,
  ObjectSettingDropdownWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzV2lkZ2V0cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEJyb3dzZXJGZWF0dXJlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jYW5JVXNlLmpzJztcbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IGFwcGx5RHJhZ0ltYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2RuZC9kbmQuanMnO1xuaW1wb3J0IHsgSW5wdXRCb3ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3guanMnO1xuaW1wb3J0IHsgU2VsZWN0Qm94IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NlbGVjdEJveC9zZWxlY3RCb3guanMnO1xuaW1wb3J0IHsgVG9nZ2xlLCB1bnRoZW1lZFRvZ2dsZVN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90b2dnbGUvdG9nZ2xlLmpzJztcbmltcG9ydCB7IElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGRpc3Bvc2FibGVUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzSU9TIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGlzRGVmaW5lZCwgaXNVbmRlZmluZWRPck51bGwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0QnV0dG9uU3R5bGVzLCBnZXRJbnB1dEJveFN0eWxlLCBnZXRTZWxlY3RCb3hTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2V0dGluZ1ZhbHVlVHlwZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBzZXR0aW5nc1NlbGVjdEJhY2tncm91bmQsIHNldHRpbmdzU2VsZWN0Qm9yZGVyLCBzZXR0aW5nc1NlbGVjdEZvcmVncm91bmQsIHNldHRpbmdzU2VsZWN0TGlzdEJvcmRlciwgc2V0dGluZ3NUZXh0SW5wdXRCYWNrZ3JvdW5kLCBzZXR0aW5nc1RleHRJbnB1dEJvcmRlciwgc2V0dGluZ3NUZXh0SW5wdXRGb3JlZ3JvdW5kIH0gZnJvbSAnLi4vY29tbW9uL3NldHRpbmdzRWRpdG9yQ29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgJy4vbWVkaWEvc2V0dGluZ3NXaWRnZXRzLmNzcyc7XG5pbXBvcnQgeyBzZXR0aW5nc0Rpc2NhcmRJY29uLCBzZXR0aW5nc0VkaXRJY29uLCBzZXR0aW5nc1JlbW92ZUljb24gfSBmcm9tICcuL3ByZWZlcmVuY2VzSWNvbnMuanMnO1xuXG5jb25zdCAkID0gRE9NLiQ7XG5cbnR5cGUgRWRpdEtleSA9ICdub25lJyB8ICdjcmVhdGUnIHwgbnVtYmVyO1xuXG50eXBlIFJvd0VsZW1lbnRHcm91cCA9IHtcblx0cm93RWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdGtleUVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHR2YWx1ZUVsZW1lbnQ/OiBIVE1MRWxlbWVudDtcbn07XG5cbnR5cGUgSUxpc3RWaWV3SXRlbTxURGF0YUl0ZW0gZXh0ZW5kcyBvYmplY3Q+ID0gVERhdGFJdGVtICYge1xuXHRlZGl0aW5nPzogYm9vbGVhbjtcblx0c2VsZWN0ZWQ/OiBib29sZWFuO1xufTtcblxuZXhwb3J0IGNsYXNzIExpc3RTZXR0aW5nTGlzdE1vZGVsPFREYXRhSXRlbSBleHRlbmRzIG9iamVjdD4ge1xuXHRwcm90ZWN0ZWQgX2RhdGFJdGVtczogVERhdGFJdGVtW10gPSBbXTtcblx0cHJpdmF0ZSBfZWRpdEtleTogRWRpdEtleSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9zZWxlY3RlZElkeDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX25ld0RhdGFJdGVtOiBURGF0YUl0ZW07XG5cblx0Z2V0IGl0ZW1zKCk6IElMaXN0Vmlld0l0ZW08VERhdGFJdGVtPltdIHtcblx0XHRjb25zdCBpdGVtcyA9IHRoaXMuX2RhdGFJdGVtcy5tYXAoKGl0ZW0sIGkpID0+IHtcblx0XHRcdGNvbnN0IGVkaXRpbmcgPSB0eXBlb2YgdGhpcy5fZWRpdEtleSA9PT0gJ251bWJlcicgJiYgdGhpcy5fZWRpdEtleSA9PT0gaTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdC4uLml0ZW0sXG5cdFx0XHRcdGVkaXRpbmcsXG5cdFx0XHRcdHNlbGVjdGVkOiBpID09PSB0aGlzLl9zZWxlY3RlZElkeCB8fCBlZGl0aW5nXG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMuX2VkaXRLZXkgPT09ICdjcmVhdGUnKSB7XG5cdFx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdFx0ZWRpdGluZzogdHJ1ZSxcblx0XHRcdFx0c2VsZWN0ZWQ6IHRydWUsXG5cdFx0XHRcdC4uLnRoaXMuX25ld0RhdGFJdGVtLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGl0ZW1zO1xuXHR9XG5cblx0Y29uc3RydWN0b3IobmV3SXRlbTogVERhdGFJdGVtKSB7XG5cdFx0dGhpcy5fbmV3RGF0YUl0ZW0gPSBuZXdJdGVtO1xuXHR9XG5cblx0c2V0RWRpdEtleShrZXk6IEVkaXRLZXkpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0S2V5ID0ga2V5O1xuXHR9XG5cblx0c2V0VmFsdWUobGlzdERhdGE6IFREYXRhSXRlbVtdKTogdm9pZCB7XG5cdFx0dGhpcy5fZGF0YUl0ZW1zID0gbGlzdERhdGE7XG5cdH1cblxuXHRzZWxlY3QoaWR4OiBudW1iZXIgfCBudWxsKTogdm9pZCB7XG5cdFx0dGhpcy5fc2VsZWN0ZWRJZHggPSBpZHg7XG5cdH1cblxuXHRnZXRTZWxlY3RlZCgpOiBudW1iZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fc2VsZWN0ZWRJZHg7XG5cdH1cblxuXHRzZWxlY3ROZXh0KCk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fc2VsZWN0ZWRJZHggPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLl9zZWxlY3RlZElkeCA9IE1hdGgubWluKHRoaXMuX3NlbGVjdGVkSWR4ICsgMSwgdGhpcy5fZGF0YUl0ZW1zLmxlbmd0aCAtIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zZWxlY3RlZElkeCA9IDA7XG5cdFx0fVxuXHR9XG5cblx0c2VsZWN0UHJldmlvdXMoKTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLl9zZWxlY3RlZElkeCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHRoaXMuX3NlbGVjdGVkSWR4ID0gTWF0aC5tYXgodGhpcy5fc2VsZWN0ZWRJZHggLSAxLCAwKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2VsZWN0ZWRJZHggPSAwO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZXR0aW5nTGlzdENoYW5nZUV2ZW50PFREYXRhSXRlbSBleHRlbmRzIG9iamVjdD4ge1xuXHR0eXBlOiAnY2hhbmdlJztcblx0b3JpZ2luYWxJdGVtOiBURGF0YUl0ZW07XG5cdG5ld0l0ZW06IFREYXRhSXRlbTtcblx0dGFyZ2V0SW5kZXg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2V0dGluZ0xpc3RBZGRFdmVudDxURGF0YUl0ZW0gZXh0ZW5kcyBvYmplY3Q+IHtcblx0dHlwZTogJ2FkZCc7XG5cdG5ld0l0ZW06IFREYXRhSXRlbTtcblx0dGFyZ2V0SW5kZXg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2V0dGluZ0xpc3RNb3ZlRXZlbnQ8VERhdGFJdGVtIGV4dGVuZHMgb2JqZWN0PiB7XG5cdHR5cGU6ICdtb3ZlJztcblx0b3JpZ2luYWxJdGVtOiBURGF0YUl0ZW07XG5cdG5ld0l0ZW06IFREYXRhSXRlbTtcblx0dGFyZ2V0SW5kZXg6IG51bWJlcjtcblx0c291cmNlSW5kZXg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2V0dGluZ0xpc3RSZW1vdmVFdmVudDxURGF0YUl0ZW0gZXh0ZW5kcyBvYmplY3Q+IHtcblx0dHlwZTogJ3JlbW92ZSc7XG5cdG9yaWdpbmFsSXRlbTogVERhdGFJdGVtO1xuXHR0YXJnZXRJbmRleDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZXR0aW5nTGlzdFJlc2V0RXZlbnQ8VERhdGFJdGVtIGV4dGVuZHMgb2JqZWN0PiB7XG5cdHR5cGU6ICdyZXNldCc7XG5cdG9yaWdpbmFsSXRlbTogVERhdGFJdGVtO1xuXHR0YXJnZXRJbmRleDogbnVtYmVyO1xufVxuXG5leHBvcnQgdHlwZSBTZXR0aW5nTGlzdEV2ZW50PFREYXRhSXRlbSBleHRlbmRzIG9iamVjdD4gPSBJU2V0dGluZ0xpc3RDaGFuZ2VFdmVudDxURGF0YUl0ZW0+IHwgSVNldHRpbmdMaXN0QWRkRXZlbnQ8VERhdGFJdGVtPiB8IElTZXR0aW5nTGlzdE1vdmVFdmVudDxURGF0YUl0ZW0+IHwgSVNldHRpbmdMaXN0UmVtb3ZlRXZlbnQ8VERhdGFJdGVtPiB8IElTZXR0aW5nTGlzdFJlc2V0RXZlbnQ8VERhdGFJdGVtPjtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0TGlzdFNldHRpbmdXaWRnZXQ8VERhdGFJdGVtIGV4dGVuZHMgb2JqZWN0PiBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIGxpc3RFbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByb3dFbGVtZW50czogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VMaXN0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8U2V0dGluZ0xpc3RFdmVudDxURGF0YUl0ZW0+PigpKTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IG1vZGVsID0gbmV3IExpc3RTZXR0aW5nTGlzdE1vZGVsPFREYXRhSXRlbT4odGhpcy5nZXRFbXB0eUl0ZW0oKSk7XG5cdHByb3RlY3RlZCByZWFkb25seSBsaXN0RGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTGlzdDogRXZlbnQ8U2V0dGluZ0xpc3RFdmVudDxURGF0YUl0ZW0+PiA9IHRoaXMuX29uRGlkQ2hhbmdlTGlzdC5ldmVudDtcblxuXHRnZXQgZG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMubGlzdEVsZW1lbnQ7XG5cdH1cblxuXHRnZXQgaXRlbXMoKTogVERhdGFJdGVtW10ge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLml0ZW1zO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldCBpc1JlYWRPbmx5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRASVRoZW1lU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMubGlzdEVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnZGl2JykpO1xuXHRcdHRoaXMubGlzdEVsZW1lbnQuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2xpc3QnKTtcblx0XHR0aGlzLmdldENvbnRhaW5lckNsYXNzZXMoKS5mb3JFYWNoKGMgPT4gdGhpcy5saXN0RWxlbWVudC5jbGFzc0xpc3QuYWRkKGMpKTtcblx0XHRET00uYXBwZW5kKGNvbnRhaW5lciwgdGhpcy5yZW5kZXJBZGRCdXR0b24oKSk7XG5cdFx0dGhpcy5yZW5kZXJMaXN0KCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMubGlzdEVsZW1lbnQsIERPTS5FdmVudFR5cGUuUE9JTlRFUl9ET1dOLCBlID0+IHRoaXMub25MaXN0Q2xpY2soZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMubGlzdEVsZW1lbnQsIERPTS5FdmVudFR5cGUuREJMQ0xJQ0ssIGUgPT4gdGhpcy5vbkxpc3REb3VibGVDbGljayhlKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMubGlzdEVsZW1lbnQsICdrZXlkb3duJywgKGU6IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGUuZXF1YWxzKEtleUNvZGUuVXBBcnJvdykpIHtcblx0XHRcdFx0dGhpcy5zZWxlY3RQcmV2aW91c1JvdygpO1xuXHRcdFx0fSBlbHNlIGlmIChlLmVxdWFscyhLZXlDb2RlLkRvd25BcnJvdykpIHtcblx0XHRcdFx0dGhpcy5zZWxlY3ROZXh0Um93KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0c2V0VmFsdWUobGlzdERhdGE6IFREYXRhSXRlbVtdKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC5zZXRWYWx1ZShsaXN0RGF0YSk7XG5cdFx0dGhpcy5yZW5kZXJMaXN0KCk7XG5cdH1cblxuXHRhYnN0cmFjdCBpc0l0ZW1OZXcoaXRlbTogVERhdGFJdGVtKTogYm9vbGVhbjtcblx0cHJvdGVjdGVkIGFic3RyYWN0IGdldEVtcHR5SXRlbSgpOiBURGF0YUl0ZW07XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRDb250YWluZXJDbGFzc2VzKCk6IHN0cmluZ1tdO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0QWN0aW9uc0Zvckl0ZW0oaXRlbTogVERhdGFJdGVtLCBpZHg6IG51bWJlcik6IElBY3Rpb25bXTtcblx0cHJvdGVjdGVkIGFic3RyYWN0IHJlbmRlckl0ZW0oaXRlbTogVERhdGFJdGVtLCBpZHg6IG51bWJlcik6IFJvd0VsZW1lbnRHcm91cDtcblx0cHJvdGVjdGVkIGFic3RyYWN0IHJlbmRlckVkaXQoaXRlbTogVERhdGFJdGVtLCBpZHg6IG51bWJlcik6IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgYWRkVG9vbHRpcHNUb1Jvdyhyb3dFbGVtZW50OiBSb3dFbGVtZW50R3JvdXAsIGl0ZW06IFREYXRhSXRlbSk6IHZvaWQ7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRMb2NhbGl6ZWRTdHJpbmdzKCk6IHtcblx0XHRkZWxldGVBY3Rpb25Ub29sdGlwOiBzdHJpbmc7XG5cdFx0ZWRpdEFjdGlvblRvb2x0aXA6IHN0cmluZztcblx0XHRhZGRCdXR0b25MYWJlbDogc3RyaW5nO1xuXHR9O1xuXG5cdHByb3RlY3RlZCByZW5kZXJIZWFkZXIoKTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHByb3RlY3RlZCBpc0FkZEJ1dHRvblZpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVuZGVyTGlzdCgpOiB2b2lkIHtcblx0XHRjb25zdCBmb2N1c2VkID0gRE9NLmlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQodGhpcy5saXN0RWxlbWVudCk7XG5cblx0XHRET00uY2xlYXJOb2RlKHRoaXMubGlzdEVsZW1lbnQpO1xuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRjb25zdCBuZXdNb2RlID0gdGhpcy5tb2RlbC5pdGVtcy5zb21lKGl0ZW0gPT4gISEoaXRlbS5lZGl0aW5nICYmIHRoaXMuaXNJdGVtTmV3KGl0ZW0pKSk7XG5cdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnc2V0dGluZy1saXN0LWhpZGUtYWRkLWJ1dHRvbicsICF0aGlzLmlzQWRkQnV0dG9uVmlzaWJsZSgpIHx8IG5ld01vZGUpO1xuXG5cdFx0aWYgKHRoaXMubW9kZWwuaXRlbXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmxpc3RFbGVtZW50LnRhYkluZGV4ID0gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5saXN0RWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ3RhYkluZGV4Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGVhZGVyID0gdGhpcy5yZW5kZXJIZWFkZXIoKTtcblxuXHRcdGlmIChoZWFkZXIpIHtcblx0XHRcdHRoaXMubGlzdEVsZW1lbnQuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcblx0XHR9XG5cblx0XHR0aGlzLnJvd0VsZW1lbnRzID0gdGhpcy5tb2RlbC5pdGVtcy5tYXAoKGl0ZW0sIGkpID0+IHRoaXMucmVuZGVyRGF0YU9yRWRpdEl0ZW0oaXRlbSwgaSwgZm9jdXNlZCkpO1xuXHRcdHRoaXMucm93RWxlbWVudHMuZm9yRWFjaChyb3dFbGVtZW50ID0+IHRoaXMubGlzdEVsZW1lbnQuYXBwZW5kQ2hpbGQocm93RWxlbWVudCkpO1xuXG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlQmFzaWNTZWxlY3RCb3godmFsdWU6IElPYmplY3RFbnVtRGF0YSk6IFNlbGVjdEJveCB7XG5cdFx0Y29uc3Qgc2VsZWN0Qm94T3B0aW9ucyA9IHZhbHVlLm9wdGlvbnMubWFwKCh7IHZhbHVlLCBkZXNjcmlwdGlvbiB9KSA9PiAoeyB0ZXh0OiB2YWx1ZSwgZGVzY3JpcHRpb24gfSkpO1xuXHRcdGNvbnN0IHNlbGVjdGVkID0gdmFsdWUub3B0aW9ucy5maW5kSW5kZXgob3B0aW9uID0+IHZhbHVlLmRhdGEgPT09IG9wdGlvbi52YWx1ZSk7XG5cblx0XHRjb25zdCBzdHlsZXMgPSBnZXRTZWxlY3RCb3hTdHlsZXMoe1xuXHRcdFx0c2VsZWN0QmFja2dyb3VuZDogc2V0dGluZ3NTZWxlY3RCYWNrZ3JvdW5kLFxuXHRcdFx0c2VsZWN0Rm9yZWdyb3VuZDogc2V0dGluZ3NTZWxlY3RGb3JlZ3JvdW5kLFxuXHRcdFx0c2VsZWN0Qm9yZGVyOiBzZXR0aW5nc1NlbGVjdEJvcmRlcixcblx0XHRcdHNlbGVjdExpc3RCb3JkZXI6IHNldHRpbmdzU2VsZWN0TGlzdEJvcmRlclxuXHRcdH0pO1xuXG5cblx0XHRjb25zdCBzZWxlY3RCb3ggPSBuZXcgU2VsZWN0Qm94KHNlbGVjdEJveE9wdGlvbnMsIHNlbGVjdGVkLCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwgc3R5bGVzLCB7XG5cdFx0XHR1c2VDdXN0b21EcmF3bjogIShpc0lPUyAmJiBCcm93c2VyRmVhdHVyZXMucG9pbnRlckV2ZW50cylcblx0XHR9KTtcblx0XHRyZXR1cm4gc2VsZWN0Qm94O1xuXHR9XG5cblx0cHJvdGVjdGVkIGVkaXRTZXR0aW5nKGlkeDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC5zZXRFZGl0S2V5KGlkeCk7XG5cdFx0dGhpcy5yZW5kZXJMaXN0KCk7XG5cdH1cblxuXHRwdWJsaWMgY2FuY2VsRWRpdCgpOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLnNldEVkaXRLZXkoJ25vbmUnKTtcblx0XHR0aGlzLnJlbmRlckxpc3QoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBoYW5kbGVJdGVtQ2hhbmdlKG9yaWdpbmFsSXRlbTogVERhdGFJdGVtLCBjaGFuZ2VkSXRlbTogVERhdGFJdGVtLCBpZHg6IG51bWJlcikge1xuXHRcdHRoaXMubW9kZWwuc2V0RWRpdEtleSgnbm9uZScpO1xuXG5cdFx0aWYgKHRoaXMuaXNJdGVtTmV3KG9yaWdpbmFsSXRlbSkpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTGlzdC5maXJlKHtcblx0XHRcdFx0dHlwZTogJ2FkZCcsXG5cdFx0XHRcdG5ld0l0ZW06IGNoYW5nZWRJdGVtLFxuXHRcdFx0XHR0YXJnZXRJbmRleDogaWR4LFxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTGlzdC5maXJlKHtcblx0XHRcdFx0dHlwZTogJ2NoYW5nZScsXG5cdFx0XHRcdG9yaWdpbmFsSXRlbSxcblx0XHRcdFx0bmV3SXRlbTogY2hhbmdlZEl0ZW0sXG5cdFx0XHRcdHRhcmdldEluZGV4OiBpZHgsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlckxpc3QoKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJEYXRhT3JFZGl0SXRlbShpdGVtOiBJTGlzdFZpZXdJdGVtPFREYXRhSXRlbT4sIGlkeDogbnVtYmVyLCBsaXN0Rm9jdXNlZDogYm9vbGVhbik6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCByb3dFbGVtZW50ID0gaXRlbS5lZGl0aW5nID9cblx0XHRcdHRoaXMucmVuZGVyRWRpdChpdGVtLCBpZHgpIDpcblx0XHRcdHRoaXMucmVuZGVyRGF0YUl0ZW0oaXRlbSwgaWR4LCBsaXN0Rm9jdXNlZCk7XG5cblx0XHRyb3dFbGVtZW50LnNldEF0dHJpYnV0ZSgncm9sZScsICdsaXN0aXRlbScpO1xuXG5cdFx0cmV0dXJuIHJvd0VsZW1lbnQ7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckRhdGFJdGVtKGl0ZW06IElMaXN0Vmlld0l0ZW08VERhdGFJdGVtPiwgaWR4OiBudW1iZXIsIGxpc3RGb2N1c2VkOiBib29sZWFuKTogSFRNTEVsZW1lbnQge1xuXHRcdGNvbnN0IHJvd0VsZW1lbnRHcm91cCA9IHRoaXMucmVuZGVySXRlbShpdGVtLCBpZHgpO1xuXHRcdGNvbnN0IHJvd0VsZW1lbnQgPSByb3dFbGVtZW50R3JvdXAucm93RWxlbWVudDtcblxuXHRcdHJvd0VsZW1lbnQuc2V0QXR0cmlidXRlKCdkYXRhLWluZGV4JywgaWR4ICsgJycpO1xuXHRcdHJvd0VsZW1lbnQuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsIGl0ZW0uc2VsZWN0ZWQgPyAnMCcgOiAnLTEnKTtcblx0XHRyb3dFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ3NlbGVjdGVkJywgaXRlbS5zZWxlY3RlZCk7XG5cblx0XHRjb25zdCBhY3Rpb25CYXIgPSBuZXcgQWN0aW9uQmFyKHJvd0VsZW1lbnQpO1xuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZChhY3Rpb25CYXIpO1xuXG5cdFx0YWN0aW9uQmFyLnB1c2godGhpcy5nZXRBY3Rpb25zRm9ySXRlbShpdGVtLCBpZHgpLCB7IGljb246IHRydWUsIGxhYmVsOiB0cnVlIH0pO1xuXHRcdHRoaXMuYWRkVG9vbHRpcHNUb1Jvdyhyb3dFbGVtZW50R3JvdXAsIGl0ZW0pO1xuXG5cdFx0aWYgKGl0ZW0uc2VsZWN0ZWQgJiYgbGlzdEZvY3VzZWQpIHtcblx0XHRcdGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHJvd0VsZW1lbnQuZm9jdXMoKSwgdW5kZWZpbmVkLCB0aGlzLmxpc3REaXNwb3NhYmxlcyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIocm93RWxlbWVudCwgJ2NsaWNrJywgKGUpID0+IHtcblx0XHRcdC8vIFRoZXJlIGlzIGEgcGFyZW50IGxpc3Qgd2lkZ2V0LCB3aGljaCBpcyB0aGUgb25lIHRoYXQgaG9sZHMgdGhlIGxpc3Qgb2Ygc2V0dGluZ3MuXG5cdFx0XHQvLyBQcmV2ZW50IHRoZSBwYXJlbnQgd2lkZ2V0IGZyb20gdHJ5aW5nIHRvIGludGVycHJldCB0aGlzIGNsaWNrIGV2ZW50LlxuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcm93RWxlbWVudDtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQWRkQnV0dG9uKCk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCByb3dFbGVtZW50ID0gJCgnLnNldHRpbmctbGlzdC1uZXctcm93Jyk7XG5cblx0XHRjb25zdCBzdGFydEFkZEJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b24ocm93RWxlbWVudCwgZGVmYXVsdEJ1dHRvblN0eWxlcykpO1xuXHRcdHN0YXJ0QWRkQnV0dG9uLmxhYmVsID0gdGhpcy5nZXRMb2NhbGl6ZWRTdHJpbmdzKCkuYWRkQnV0dG9uTGFiZWw7XG5cdFx0c3RhcnRBZGRCdXR0b24uZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzZXR0aW5nLWxpc3QtYWRkQnV0dG9uJyk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihzdGFydEFkZEJ1dHRvbi5vbkRpZENsaWNrKCgpID0+IHtcblx0XHRcdHRoaXMubW9kZWwuc2V0RWRpdEtleSgnY3JlYXRlJyk7XG5cdFx0XHR0aGlzLnJlbmRlckxpc3QoKTtcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcm93RWxlbWVudDtcblx0fVxuXG5cdHByaXZhdGUgb25MaXN0Q2xpY2soZTogUG9pbnRlckV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgdGFyZ2V0SWR4ID0gdGhpcy5nZXRDbGlja2VkSXRlbUluZGV4KGUpO1xuXHRcdGlmICh0YXJnZXRJZHggPCAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0aWYgKHRoaXMubW9kZWwuZ2V0U2VsZWN0ZWQoKSA9PT0gdGFyZ2V0SWR4KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5zZWxlY3RSb3codGFyZ2V0SWR4KTtcblx0fVxuXG5cdHByaXZhdGUgb25MaXN0RG91YmxlQ2xpY2soZTogTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IHRhcmdldElkeCA9IHRoaXMuZ2V0Q2xpY2tlZEl0ZW1JbmRleChlKTtcblx0XHRpZiAodGFyZ2V0SWR4IDwgMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzUmVhZE9ubHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpdGVtID0gdGhpcy5tb2RlbC5pdGVtc1t0YXJnZXRJZHhdO1xuXHRcdGlmIChpdGVtKSB7XG5cdFx0XHR0aGlzLmVkaXRTZXR0aW5nKHRhcmdldElkeCk7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0Q2xpY2tlZEl0ZW1JbmRleChlOiBNb3VzZUV2ZW50KTogbnVtYmVyIHtcblx0XHRpZiAoIWUudGFyZ2V0KSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aW9uYmFyID0gRE9NLmZpbmRQYXJlbnRXaXRoQ2xhc3MoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQsICdtb25hY28tYWN0aW9uLWJhcicpO1xuXHRcdGlmIChhY3Rpb25iYXIpIHtcblx0XHRcdC8vIERvbid0IGhhbmRsZSBkb3VibGVjbGlja3MgaW5zaWRlIHRoZSBhY3Rpb24gYmFyXG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWxlbWVudCA9IERPTS5maW5kUGFyZW50V2l0aENsYXNzKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50LCAnc2V0dGluZy1saXN0LXJvdycpO1xuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRhcmdldElkeFN0ciA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWluZGV4Jyk7XG5cdFx0aWYgKCF0YXJnZXRJZHhTdHIpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRjb25zdCB0YXJnZXRJZHggPSBwYXJzZUludCh0YXJnZXRJZHhTdHIpO1xuXHRcdHJldHVybiB0YXJnZXRJZHg7XG5cdH1cblxuXHRwcml2YXRlIHNlbGVjdFJvdyhpZHg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMubW9kZWwuc2VsZWN0KGlkeCk7XG5cdFx0dGhpcy5yb3dFbGVtZW50cy5mb3JFYWNoKHJvdyA9PiByb3cuY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKSk7XG5cblx0XHRjb25zdCBzZWxlY3RlZFJvdyA9IHRoaXMucm93RWxlbWVudHNbdGhpcy5tb2RlbC5nZXRTZWxlY3RlZCgpIV07XG5cblx0XHRzZWxlY3RlZFJvdy5jbGFzc0xpc3QuYWRkKCdzZWxlY3RlZCcpO1xuXHRcdHNlbGVjdGVkUm93LmZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIHNlbGVjdE5leHRSb3coKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC5zZWxlY3ROZXh0KCk7XG5cdFx0dGhpcy5zZWxlY3RSb3codGhpcy5tb2RlbC5nZXRTZWxlY3RlZCgpISk7XG5cdH1cblxuXHRwcml2YXRlIHNlbGVjdFByZXZpb3VzUm93KCk6IHZvaWQge1xuXHRcdHRoaXMubW9kZWwuc2VsZWN0UHJldmlvdXMoKTtcblx0XHR0aGlzLnNlbGVjdFJvdyh0aGlzLm1vZGVsLmdldFNlbGVjdGVkKCkhKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSUxpc3RTZXRWYWx1ZU9wdGlvbnMge1xuXHRzaG93QWRkQnV0dG9uOiBib29sZWFuO1xuXHRrZXlTdWdnZXN0ZXI/OiBJT2JqZWN0S2V5U3VnZ2VzdGVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMaXN0RGF0YUl0ZW0ge1xuXHR2YWx1ZTogT2JqZWN0S2V5O1xuXHRzaWJsaW5nPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgTGlzdFNldHRpbmdXaWRnZXREcmFnRGV0YWlsczxUTGlzdERhdGFJdGVtIGV4dGVuZHMgSUxpc3REYXRhSXRlbT4ge1xuXHRlbGVtZW50OiBIVE1MRWxlbWVudDtcblx0aXRlbTogVExpc3REYXRhSXRlbTtcblx0aXRlbUluZGV4OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBMaXN0U2V0dGluZ1dpZGdldDxUTGlzdERhdGFJdGVtIGV4dGVuZHMgSUxpc3REYXRhSXRlbT4gZXh0ZW5kcyBBYnN0cmFjdExpc3RTZXR0aW5nV2lkZ2V0PFRMaXN0RGF0YUl0ZW0+IHtcblx0cHJpdmF0ZSBrZXlWYWx1ZVN1Z2dlc3RlcjogSU9iamVjdEtleVN1Z2dlc3RlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzaG93QWRkQnV0dG9uOiBib29sZWFuID0gdHJ1ZTtcblxuXHRvdmVycmlkZSBzZXRWYWx1ZShsaXN0RGF0YTogVExpc3REYXRhSXRlbVtdLCBvcHRpb25zPzogSUxpc3RTZXRWYWx1ZU9wdGlvbnMpIHtcblx0XHR0aGlzLmtleVZhbHVlU3VnZ2VzdGVyID0gb3B0aW9ucz8ua2V5U3VnZ2VzdGVyO1xuXHRcdHRoaXMuc2hvd0FkZEJ1dHRvbiA9IG9wdGlvbnM/LnNob3dBZGRCdXR0b24gPz8gdHJ1ZTtcblx0XHRzdXBlci5zZXRWYWx1ZShsaXN0RGF0YSk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihjb250YWluZXIsIHRoZW1lU2VydmljZSwgY29udGV4dFZpZXdTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRFbXB0eUl0ZW0oKTogVExpc3REYXRhSXRlbSB7XG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbm8tZGFuZ2Vyb3VzLXR5cGUtYXNzZXJ0aW9uc1xuXHRcdHJldHVybiB7XG5cdFx0XHR2YWx1ZToge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGF0YTogJydcblx0XHRcdH1cblx0XHR9IGFzIFRMaXN0RGF0YUl0ZW07XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgaXNBZGRCdXR0b25WaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnNob3dBZGRCdXR0b247XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0Q29udGFpbmVyQ2xhc3NlcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIFsnc2V0dGluZy1saXN0LXdpZGdldCddO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEFjdGlvbnNGb3JJdGVtKGl0ZW06IFRMaXN0RGF0YUl0ZW0sIGlkeDogbnVtYmVyKTogSUFjdGlvbltdIHtcblx0XHRpZiAodGhpcy5pc1JlYWRPbmx5KSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdHJldHVybiBbXG5cdFx0XHR7XG5cdFx0XHRcdGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoc2V0dGluZ3NFZGl0SWNvbiksXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5lZGl0TGlzdEl0ZW0nLFxuXHRcdFx0XHR0b29sdGlwOiB0aGlzLmdldExvY2FsaXplZFN0cmluZ3MoKS5lZGl0QWN0aW9uVG9vbHRpcCxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmVkaXRTZXR0aW5nKGlkeClcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoc2V0dGluZ3NSZW1vdmVJY29uKSxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnJlbW92ZUxpc3RJdGVtJyxcblx0XHRcdFx0dG9vbHRpcDogdGhpcy5nZXRMb2NhbGl6ZWRTdHJpbmdzKCkuZGVsZXRlQWN0aW9uVG9vbHRpcCxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUxpc3QuZmlyZSh7IHR5cGU6ICdyZW1vdmUnLCBvcmlnaW5hbEl0ZW06IGl0ZW0sIHRhcmdldEluZGV4OiBpZHggfSlcblx0XHRcdH1cblx0XHRdIGFzIElBY3Rpb25bXTtcblx0fVxuXG5cdHByaXZhdGUgZHJhZ0RldGFpbHM6IExpc3RTZXR0aW5nV2lkZ2V0RHJhZ0RldGFpbHM8VExpc3REYXRhSXRlbT4gfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIHJlbmRlckl0ZW0oaXRlbTogVExpc3REYXRhSXRlbSwgaWR4OiBudW1iZXIpOiBSb3dFbGVtZW50R3JvdXAge1xuXHRcdGNvbnN0IHJvd0VsZW1lbnQgPSAkKCcuc2V0dGluZy1saXN0LXJvdycpO1xuXHRcdGNvbnN0IHZhbHVlRWxlbWVudCA9IERPTS5hcHBlbmQocm93RWxlbWVudCwgJCgnLnNldHRpbmctbGlzdC12YWx1ZScpKTtcblx0XHRjb25zdCBzaWJsaW5nRWxlbWVudCA9IERPTS5hcHBlbmQocm93RWxlbWVudCwgJCgnLnNldHRpbmctbGlzdC1zaWJsaW5nJykpO1xuXG5cdFx0dmFsdWVFbGVtZW50LnRleHRDb250ZW50ID0gaXRlbS52YWx1ZS5kYXRhLnRvU3RyaW5nKCk7XG5cdFx0c2libGluZ0VsZW1lbnQudGV4dENvbnRlbnQgPSBpdGVtLnNpYmxpbmcgPyBgd2hlbjogJHtpdGVtLnNpYmxpbmd9YCA6IG51bGw7XG5cblx0XHR0aGlzLmFkZERyYWdBbmREcm9wKHJvd0VsZW1lbnQsIGl0ZW0sIGlkeCk7XG5cdFx0cmV0dXJuIHsgcm93RWxlbWVudCwga2V5RWxlbWVudDogdmFsdWVFbGVtZW50LCB2YWx1ZUVsZW1lbnQ6IHNpYmxpbmdFbGVtZW50IH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWRkRHJhZ0FuZERyb3Aocm93RWxlbWVudDogSFRNTEVsZW1lbnQsIGl0ZW06IFRMaXN0RGF0YUl0ZW0sIGlkeDogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMubW9kZWwuaXRlbXMuZXZlcnkoaXRlbSA9PiAhaXRlbS5lZGl0aW5nKSkge1xuXHRcdFx0cm93RWxlbWVudC5kcmFnZ2FibGUgPSB0cnVlO1xuXHRcdFx0cm93RWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkcmFnZ2FibGUnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cm93RWxlbWVudC5kcmFnZ2FibGUgPSBmYWxzZTtcblx0XHRcdHJvd0VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dhYmxlJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIocm93RWxlbWVudCwgRE9NLkV2ZW50VHlwZS5EUkFHX1NUQVJULCAoZXYpID0+IHtcblx0XHRcdHRoaXMuZHJhZ0RldGFpbHMgPSB7XG5cdFx0XHRcdGVsZW1lbnQ6IHJvd0VsZW1lbnQsXG5cdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdGl0ZW1JbmRleDogaWR4XG5cdFx0XHR9O1xuXG5cdFx0XHRhcHBseURyYWdJbWFnZShldiwgcm93RWxlbWVudCwgaXRlbS52YWx1ZS5kYXRhKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIocm93RWxlbWVudCwgRE9NLkV2ZW50VHlwZS5EUkFHX09WRVIsIChldikgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLmRyYWdEZXRhaWxzKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRpZiAoZXYuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRcdGV2LmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ21vdmUnO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSkpO1xuXHRcdGxldCBjb3VudGVyID0gMDtcblx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihyb3dFbGVtZW50LCBET00uRXZlbnRUeXBlLkRSQUdfRU5URVIsIChldikgPT4ge1xuXHRcdFx0Y291bnRlcisrO1xuXHRcdFx0cm93RWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkcmFnLWhvdmVyJyk7XG5cdFx0fSkpO1xuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZChET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHJvd0VsZW1lbnQsIERPTS5FdmVudFR5cGUuRFJBR19MRUFWRSwgKGV2KSA9PiB7XG5cdFx0XHRjb3VudGVyLS07XG5cdFx0XHRpZiAoIWNvdW50ZXIpIHtcblx0XHRcdFx0cm93RWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnLWhvdmVyJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZChET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHJvd0VsZW1lbnQsIERPTS5FdmVudFR5cGUuRFJPUCwgKGV2KSA9PiB7XG5cdFx0XHQvLyBjYW5jZWwgdGhlIG9wIGlmIHdlIGRyYWdnZWQgdG8gYSBjb21wbGV0ZWx5IGRpZmZlcmVudCBzZXR0aW5nXG5cdFx0XHRpZiAoIXRoaXMuZHJhZ0RldGFpbHMpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNvdW50ZXIgPSAwO1xuXHRcdFx0aWYgKHRoaXMuZHJhZ0RldGFpbHMuZWxlbWVudCAhPT0gcm93RWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxpc3QuZmlyZSh7XG5cdFx0XHRcdFx0dHlwZTogJ21vdmUnLFxuXHRcdFx0XHRcdG9yaWdpbmFsSXRlbTogdGhpcy5kcmFnRGV0YWlscy5pdGVtLFxuXHRcdFx0XHRcdHNvdXJjZUluZGV4OiB0aGlzLmRyYWdEZXRhaWxzLml0ZW1JbmRleCxcblx0XHRcdFx0XHRuZXdJdGVtOiBpdGVtLFxuXHRcdFx0XHRcdHRhcmdldEluZGV4OiBpZHhcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KSk7XG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIocm93RWxlbWVudCwgRE9NLkV2ZW50VHlwZS5EUkFHX0VORCwgKGV2KSA9PiB7XG5cdFx0XHRjb3VudGVyID0gMDtcblx0XHRcdHJvd0VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZy1ob3ZlcicpO1xuXHRcdFx0ZXYuZGF0YVRyYW5zZmVyPy5jbGVhckRhdGEoKTtcblx0XHRcdGlmICh0aGlzLmRyYWdEZXRhaWxzKSB7XG5cdFx0XHRcdHRoaXMuZHJhZ0RldGFpbHMgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlckVkaXQoaXRlbTogVExpc3REYXRhSXRlbSwgaWR4OiBudW1iZXIpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3Qgcm93RWxlbWVudCA9ICQoJy5zZXR0aW5nLWxpc3QtZWRpdC1yb3cnKTtcblx0XHRsZXQgdmFsdWVJbnB1dDogSW5wdXRCb3ggfCBTZWxlY3RCb3g7XG5cdFx0bGV0IGN1cnJlbnREaXNwbGF5VmFsdWU6IHN0cmluZztcblx0XHRsZXQgY3VycmVudEVudW1PcHRpb25zOiBJT2JqZWN0RW51bU9wdGlvbltdIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKHRoaXMua2V5VmFsdWVTdWdnZXN0ZXIpIHtcblx0XHRcdGNvbnN0IGVudW1EYXRhID0gdGhpcy5rZXlWYWx1ZVN1Z2dlc3Rlcih0aGlzLm1vZGVsLml0ZW1zLm1hcCgoeyB2YWx1ZTogeyBkYXRhIH0gfSkgPT4gZGF0YSksIGlkeCk7XG5cdFx0XHRpdGVtID0ge1xuXHRcdFx0XHQuLi5pdGVtLFxuXHRcdFx0XHR2YWx1ZToge1xuXHRcdFx0XHRcdHR5cGU6ICdlbnVtJyxcblx0XHRcdFx0XHRkYXRhOiBpdGVtLnZhbHVlLmRhdGEsXG5cdFx0XHRcdFx0b3B0aW9uczogZW51bURhdGEgPyBlbnVtRGF0YS5vcHRpb25zIDogW11cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRzd2l0Y2ggKGl0ZW0udmFsdWUudHlwZSkge1xuXHRcdFx0Y2FzZSAnc3RyaW5nJzpcblx0XHRcdFx0dmFsdWVJbnB1dCA9IHRoaXMucmVuZGVySW5wdXRCb3goaXRlbS52YWx1ZSwgcm93RWxlbWVudCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnZW51bSc6XG5cdFx0XHRcdHZhbHVlSW5wdXQgPSB0aGlzLnJlbmRlckRyb3Bkb3duKGl0ZW0udmFsdWUsIHJvd0VsZW1lbnQpO1xuXHRcdFx0XHRjdXJyZW50RW51bU9wdGlvbnMgPSBpdGVtLnZhbHVlLm9wdGlvbnM7XG5cdFx0XHRcdGlmIChpdGVtLnZhbHVlLm9wdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y3VycmVudERpc3BsYXlWYWx1ZSA9IHRoaXMuaXNJdGVtTmV3KGl0ZW0pID9cblx0XHRcdFx0XHRcdGN1cnJlbnRFbnVtT3B0aW9uc1swXS52YWx1ZSA6IGl0ZW0udmFsdWUuZGF0YTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRjb25zdCB1cGRhdGVkSW5wdXRCb3hJdGVtID0gKCk6IFRMaXN0RGF0YUl0ZW0gPT4ge1xuXHRcdFx0Y29uc3QgaW5wdXRCb3ggPSB2YWx1ZUlucHV0IGFzIElucHV0Qm94O1xuXHRcdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbm8tZGFuZ2Vyb3VzLXR5cGUtYXNzZXJ0aW9uc1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dmFsdWU6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkYXRhOiBpbnB1dEJveC52YWx1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzaWJsaW5nOiBzaWJsaW5nSW5wdXQ/LnZhbHVlXG5cdFx0XHR9IGFzIFRMaXN0RGF0YUl0ZW07XG5cdFx0fTtcblx0XHRjb25zdCB1cGRhdGVkU2VsZWN0Qm94SXRlbSA9IChzZWxlY3RlZFZhbHVlOiBzdHJpbmcpOiBUTGlzdERhdGFJdGVtID0+IHtcblx0XHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLW5vLWRhbmdlcm91cy10eXBlLWFzc2VydGlvbnNcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHZhbHVlOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2VudW0nLFxuXHRcdFx0XHRcdGRhdGE6IHNlbGVjdGVkVmFsdWUsXG5cdFx0XHRcdFx0b3B0aW9uczogY3VycmVudEVudW1PcHRpb25zID8/IFtdXG5cdFx0XHRcdH1cblx0XHRcdH0gYXMgVExpc3REYXRhSXRlbTtcblx0XHR9O1xuXHRcdGNvbnN0IG9uS2V5RG93biA9IChlOiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0XHR0aGlzLmhhbmRsZUl0ZW1DaGFuZ2UoaXRlbSwgdXBkYXRlZElucHV0Qm94SXRlbSgpLCBpZHgpO1xuXHRcdFx0fSBlbHNlIGlmIChlLmVxdWFscyhLZXlDb2RlLkVzY2FwZSkpIHtcblx0XHRcdFx0dGhpcy5jYW5jZWxFZGl0KCk7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHRcdHJvd0VsZW1lbnQ/LmZvY3VzKCk7XG5cdFx0fTtcblxuXHRcdGlmIChpdGVtLnZhbHVlLnR5cGUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb25zdCBzZWxlY3RCb3ggPSB2YWx1ZUlucHV0IGFzIFNlbGVjdEJveDtcblx0XHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0c2VsZWN0Qm94Lm9uRGlkU2VsZWN0KCh7IHNlbGVjdGVkIH0pID0+IHtcblx0XHRcdFx0XHRjdXJyZW50RGlzcGxheVZhbHVlID0gc2VsZWN0ZWQ7XG5cdFx0XHRcdH0pXG5cdFx0XHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBpbnB1dEJveCA9IHZhbHVlSW5wdXQgYXMgSW5wdXRCb3g7XG5cdFx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRcdERPTS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihpbnB1dEJveC5pbnB1dEVsZW1lbnQsIERPTS5FdmVudFR5cGUuS0VZX0RPV04sIG9uS2V5RG93bilcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0bGV0IHNpYmxpbmdJbnB1dDogSW5wdXRCb3ggfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCFpc1VuZGVmaW5lZE9yTnVsbChpdGVtLnNpYmxpbmcpKSB7XG5cdFx0XHRzaWJsaW5nSW5wdXQgPSBuZXcgSW5wdXRCb3gocm93RWxlbWVudCwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdFx0cGxhY2Vob2xkZXI6IHRoaXMuZ2V0TG9jYWxpemVkU3RyaW5ncygpLnNpYmxpbmdJbnB1dFBsYWNlaG9sZGVyLFxuXHRcdFx0XHRpbnB1dEJveFN0eWxlczogZ2V0SW5wdXRCb3hTdHlsZSh7XG5cdFx0XHRcdFx0aW5wdXRCYWNrZ3JvdW5kOiBzZXR0aW5nc1RleHRJbnB1dEJhY2tncm91bmQsXG5cdFx0XHRcdFx0aW5wdXRGb3JlZ3JvdW5kOiBzZXR0aW5nc1RleHRJbnB1dEZvcmVncm91bmQsXG5cdFx0XHRcdFx0aW5wdXRCb3JkZXI6IHNldHRpbmdzVGV4dElucHV0Qm9yZGVyXG5cdFx0XHRcdH0pXG5cdFx0XHR9KTtcblx0XHRcdHNpYmxpbmdJbnB1dC5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3NldHRpbmctbGlzdC1zaWJsaW5nSW5wdXQnKTtcblx0XHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZChzaWJsaW5nSW5wdXQpO1xuXHRcdFx0c2libGluZ0lucHV0LnZhbHVlID0gaXRlbS5zaWJsaW5nO1xuXG5cdFx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRcdERPTS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihzaWJsaW5nSW5wdXQuaW5wdXRFbGVtZW50LCBET00uRXZlbnRUeXBlLktFWV9ET1dOLCBvbktleURvd24pXG5cdFx0XHQpO1xuXHRcdH0gZWxzZSBpZiAodmFsdWVJbnB1dCBpbnN0YW5jZW9mIElucHV0Qm94KSB7XG5cdFx0XHR2YWx1ZUlucHV0LmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbm8tc2libGluZycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9rQnV0dG9uID0gdGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBCdXR0b24ocm93RWxlbWVudCwgZGVmYXVsdEJ1dHRvblN0eWxlcykpO1xuXHRcdG9rQnV0dG9uLmxhYmVsID0gbG9jYWxpemUoJ29rQnV0dG9uJywgXCJPS1wiKTtcblx0XHRva0J1dHRvbi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3NldHRpbmctbGlzdC1vay1idXR0b24nKTtcblxuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZChva0J1dHRvbi5vbkRpZENsaWNrKCgpID0+IHtcblx0XHRcdGlmIChpdGVtLnZhbHVlLnR5cGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlSXRlbUNoYW5nZShpdGVtLCB1cGRhdGVkSW5wdXRCb3hJdGVtKCksIGlkeCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmhhbmRsZUl0ZW1DaGFuZ2UoaXRlbSwgdXBkYXRlZFNlbGVjdEJveEl0ZW0oY3VycmVudERpc3BsYXlWYWx1ZSksIGlkeCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgY2FuY2VsQnV0dG9uID0gdGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBCdXR0b24ocm93RWxlbWVudCwgeyBzZWNvbmRhcnk6IHRydWUsIC4uLmRlZmF1bHRCdXR0b25TdHlsZXMgfSkpO1xuXHRcdGNhbmNlbEJ1dHRvbi5sYWJlbCA9IGxvY2FsaXplKCdjYW5jZWxCdXR0b24nLCBcIkNhbmNlbFwiKTtcblx0XHRjYW5jZWxCdXR0b24uZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzZXR0aW5nLWxpc3QtY2FuY2VsLWJ1dHRvbicpO1xuXG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKGNhbmNlbEJ1dHRvbi5vbkRpZENsaWNrKCgpID0+IHRoaXMuY2FuY2VsRWRpdCgpKSk7XG5cblx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHZhbHVlSW5wdXQuZm9jdXMoKTtcblx0XHRcdFx0aWYgKHZhbHVlSW5wdXQgaW5zdGFuY2VvZiBJbnB1dEJveCkge1xuXHRcdFx0XHRcdHZhbHVlSW5wdXQuc2VsZWN0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdHJldHVybiByb3dFbGVtZW50O1xuXHR9XG5cblx0b3ZlcnJpZGUgaXNJdGVtTmV3KGl0ZW06IFRMaXN0RGF0YUl0ZW0pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXRlbS52YWx1ZS5kYXRhID09PSAnJztcblx0fVxuXG5cdHByb3RlY3RlZCBhZGRUb29sdGlwc1RvUm93KHJvd0VsZW1lbnRHcm91cDogUm93RWxlbWVudEdyb3VwLCB7IHZhbHVlLCBzaWJsaW5nIH06IFRMaXN0RGF0YUl0ZW0pIHtcblx0XHRjb25zdCB0aXRsZSA9IGlzVW5kZWZpbmVkT3JOdWxsKHNpYmxpbmcpXG5cdFx0XHQ/IGxvY2FsaXplKCdsaXN0VmFsdWVIaW50TGFiZWwnLCBcIkxpc3QgaXRlbSBgezB9YFwiLCB2YWx1ZS5kYXRhKVxuXHRcdFx0OiBsb2NhbGl6ZSgnbGlzdFNpYmxpbmdIaW50TGFiZWwnLCBcIkxpc3QgaXRlbSBgezB9YCB3aXRoIHNpYmxpbmcgYCR7MX1gXCIsIHZhbHVlLmRhdGEsIHNpYmxpbmcpO1xuXG5cdFx0Y29uc3QgeyByb3dFbGVtZW50IH0gPSByb3dFbGVtZW50R3JvdXA7XG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwRGVsYXllZEhvdmVyKHJvd0VsZW1lbnQsIHsgY29udGVudDogdGl0bGUgfSkpO1xuXHRcdHJvd0VsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGl0bGUpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldExvY2FsaXplZFN0cmluZ3MoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRlbGV0ZUFjdGlvblRvb2x0aXA6IGxvY2FsaXplKCdyZW1vdmVJdGVtJywgXCJSZW1vdmUgSXRlbVwiKSxcblx0XHRcdGVkaXRBY3Rpb25Ub29sdGlwOiBsb2NhbGl6ZSgnZWRpdEl0ZW0nLCBcIkVkaXQgSXRlbVwiKSxcblx0XHRcdGFkZEJ1dHRvbkxhYmVsOiBsb2NhbGl6ZSgnYWRkSXRlbScsIFwiQWRkIEl0ZW1cIiksXG5cdFx0XHRpbnB1dFBsYWNlaG9sZGVyOiBsb2NhbGl6ZSgnaXRlbUlucHV0UGxhY2Vob2xkZXInLCBcIkl0ZW0uLi5cIiksXG5cdFx0XHRzaWJsaW5nSW5wdXRQbGFjZWhvbGRlcjogbG9jYWxpemUoJ2xpc3RTaWJsaW5nSW5wdXRQbGFjZWhvbGRlcicsIFwiU2libGluZy4uLlwiKSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJJbnB1dEJveCh2YWx1ZTogT2JqZWN0VmFsdWUsIHJvd0VsZW1lbnQ6IEhUTUxFbGVtZW50KTogSW5wdXRCb3gge1xuXHRcdGNvbnN0IHZhbHVlSW5wdXQgPSBuZXcgSW5wdXRCb3gocm93RWxlbWVudCwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdHBsYWNlaG9sZGVyOiB0aGlzLmdldExvY2FsaXplZFN0cmluZ3MoKS5pbnB1dFBsYWNlaG9sZGVyLFxuXHRcdFx0aW5wdXRCb3hTdHlsZXM6IGdldElucHV0Qm94U3R5bGUoe1xuXHRcdFx0XHRpbnB1dEJhY2tncm91bmQ6IHNldHRpbmdzVGV4dElucHV0QmFja2dyb3VuZCxcblx0XHRcdFx0aW5wdXRGb3JlZ3JvdW5kOiBzZXR0aW5nc1RleHRJbnB1dEZvcmVncm91bmQsXG5cdFx0XHRcdGlucHV0Qm9yZGVyOiBzZXR0aW5nc1RleHRJbnB1dEJvcmRlclxuXHRcdFx0fSlcblx0XHR9KTtcblxuXHRcdHZhbHVlSW5wdXQuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzZXR0aW5nLWxpc3QtdmFsdWVJbnB1dCcpO1xuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZCh2YWx1ZUlucHV0KTtcblx0XHR2YWx1ZUlucHV0LnZhbHVlID0gdmFsdWUuZGF0YS50b1N0cmluZygpO1xuXG5cdFx0cmV0dXJuIHZhbHVlSW5wdXQ7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckRyb3Bkb3duKHZhbHVlOiBPYmplY3RLZXksIHJvd0VsZW1lbnQ6IEhUTUxFbGVtZW50KTogU2VsZWN0Qm94IHtcblx0XHRpZiAodmFsdWUudHlwZSAhPT0gJ2VudW0nKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1ZhbHVldHlwZSBtdXN0IGJlIGVudW0uJyk7XG5cdFx0fVxuXHRcdGNvbnN0IHNlbGVjdEJveCA9IHRoaXMuY3JlYXRlQmFzaWNTZWxlY3RCb3godmFsdWUpO1xuXG5cdFx0Y29uc3Qgd3JhcHBlciA9ICQoJy5zZXR0aW5nLWxpc3Qtb2JqZWN0LWxpc3Qtcm93Jyk7XG5cdFx0c2VsZWN0Qm94LnJlbmRlcih3cmFwcGVyKTtcblx0XHRyb3dFbGVtZW50LmFwcGVuZENoaWxkKHdyYXBwZXIpO1xuXG5cdFx0cmV0dXJuIHNlbGVjdEJveDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRXhjbHVkZVNldHRpbmdXaWRnZXQgZXh0ZW5kcyBMaXN0U2V0dGluZ1dpZGdldDxJSW5jbHVkZUV4Y2x1ZGVEYXRhSXRlbT4ge1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0Q29udGFpbmVyQ2xhc3NlcygpIHtcblx0XHRyZXR1cm4gWydzZXR0aW5nLWxpc3QtaW5jbHVkZS1leGNsdWRlLXdpZGdldCddO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFkZERyYWdBbmREcm9wKHJvd0VsZW1lbnQ6IEhUTUxFbGVtZW50LCBpdGVtOiBJSW5jbHVkZUV4Y2x1ZGVEYXRhSXRlbSwgaWR4OiBudW1iZXIpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYWRkVG9vbHRpcHNUb1Jvdyhyb3dFbGVtZW50R3JvdXA6IFJvd0VsZW1lbnRHcm91cCwgaXRlbTogSUluY2x1ZGVFeGNsdWRlRGF0YUl0ZW0pOiB2b2lkIHtcblx0XHRsZXQgdGl0bGUgPSBpc1VuZGVmaW5lZE9yTnVsbChpdGVtLnNpYmxpbmcpXG5cdFx0XHQ/IGxvY2FsaXplKCdleGNsdWRlUGF0dGVybkhpbnRMYWJlbCcsIFwiRXhjbHVkZSBmaWxlcyBtYXRjaGluZyBgezB9YFwiLCBpdGVtLnZhbHVlLmRhdGEpXG5cdFx0XHQ6IGxvY2FsaXplKCdleGNsdWRlU2libGluZ0hpbnRMYWJlbCcsIFwiRXhjbHVkZSBmaWxlcyBtYXRjaGluZyBgezB9YCwgb25seSB3aGVuIGEgZmlsZSBtYXRjaGluZyBgezF9YCBpcyBwcmVzZW50XCIsIGl0ZW0udmFsdWUuZGF0YSwgaXRlbS5zaWJsaW5nKTtcblxuXHRcdGlmIChpdGVtLnNvdXJjZSkge1xuXHRcdFx0dGl0bGUgKz0gbG9jYWxpemUoJ2V4Y2x1ZGVJbmNsdWRlU291cmNlJywgXCIuIERlZmF1bHQgdmFsdWUgcHJvdmlkZWQgYnkgYHswfWBcIiwgaXRlbS5zb3VyY2UpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1hcmtkb3duVGl0bGUgPSBuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRNYXJrZG93bih0aXRsZSk7XG5cblx0XHRjb25zdCB7IHJvd0VsZW1lbnQgfSA9IHJvd0VsZW1lbnRHcm91cDtcblx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBEZWxheWVkSG92ZXIocm93RWxlbWVudCwgeyBjb250ZW50OiBtYXJrZG93blRpdGxlIH0pKTtcblx0XHRyb3dFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRpdGxlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRMb2NhbGl6ZWRTdHJpbmdzKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkZWxldGVBY3Rpb25Ub29sdGlwOiBsb2NhbGl6ZSgncmVtb3ZlRXhjbHVkZUl0ZW0nLCBcIlJlbW92ZSBFeGNsdWRlIEl0ZW1cIiksXG5cdFx0XHRlZGl0QWN0aW9uVG9vbHRpcDogbG9jYWxpemUoJ2VkaXRFeGNsdWRlSXRlbScsIFwiRWRpdCBFeGNsdWRlIEl0ZW1cIiksXG5cdFx0XHRhZGRCdXR0b25MYWJlbDogbG9jYWxpemUoJ2FkZFBhdHRlcm4nLCBcIkFkZCBQYXR0ZXJuXCIpLFxuXHRcdFx0aW5wdXRQbGFjZWhvbGRlcjogbG9jYWxpemUoJ2V4Y2x1ZGVQYXR0ZXJuSW5wdXRQbGFjZWhvbGRlcicsIFwiRXhjbHVkZSBQYXR0ZXJuLi4uXCIpLFxuXHRcdFx0c2libGluZ0lucHV0UGxhY2Vob2xkZXI6IGxvY2FsaXplKCdleGNsdWRlU2libGluZ0lucHV0UGxhY2Vob2xkZXInLCBcIldoZW4gUGF0dGVybiBJcyBQcmVzZW50Li4uXCIpLFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEluY2x1ZGVTZXR0aW5nV2lkZ2V0IGV4dGVuZHMgTGlzdFNldHRpbmdXaWRnZXQ8SUluY2x1ZGVFeGNsdWRlRGF0YUl0ZW0+IHtcblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldENvbnRhaW5lckNsYXNzZXMoKSB7XG5cdFx0cmV0dXJuIFsnc2V0dGluZy1saXN0LWluY2x1ZGUtZXhjbHVkZS13aWRnZXQnXTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhZGREcmFnQW5kRHJvcChyb3dFbGVtZW50OiBIVE1MRWxlbWVudCwgaXRlbTogSUluY2x1ZGVFeGNsdWRlRGF0YUl0ZW0sIGlkeDogbnVtYmVyKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFkZFRvb2x0aXBzVG9Sb3cocm93RWxlbWVudEdyb3VwOiBSb3dFbGVtZW50R3JvdXAsIGl0ZW06IElJbmNsdWRlRXhjbHVkZURhdGFJdGVtKTogdm9pZCB7XG5cdFx0bGV0IHRpdGxlID0gaXNVbmRlZmluZWRPck51bGwoaXRlbS5zaWJsaW5nKVxuXHRcdFx0PyBsb2NhbGl6ZSgnaW5jbHVkZVBhdHRlcm5IaW50TGFiZWwnLCBcIkluY2x1ZGUgZmlsZXMgbWF0Y2hpbmcgYHswfWBcIiwgaXRlbS52YWx1ZS5kYXRhKVxuXHRcdFx0OiBsb2NhbGl6ZSgnaW5jbHVkZVNpYmxpbmdIaW50TGFiZWwnLCBcIkluY2x1ZGUgZmlsZXMgbWF0Y2hpbmcgYHswfWAsIG9ubHkgd2hlbiBhIGZpbGUgbWF0Y2hpbmcgYHsxfWAgaXMgcHJlc2VudFwiLCBpdGVtLnZhbHVlLmRhdGEsIGl0ZW0uc2libGluZyk7XG5cblx0XHRpZiAoaXRlbS5zb3VyY2UpIHtcblx0XHRcdHRpdGxlICs9IGxvY2FsaXplKCdleGNsdWRlSW5jbHVkZVNvdXJjZScsIFwiLiBEZWZhdWx0IHZhbHVlIHByb3ZpZGVkIGJ5IGB7MH1gXCIsIGl0ZW0uc291cmNlKTtcblx0XHR9XG5cblx0XHRjb25zdCBtYXJrZG93blRpdGxlID0gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kTWFya2Rvd24odGl0bGUpO1xuXG5cdFx0Y29uc3QgeyByb3dFbGVtZW50IH0gPSByb3dFbGVtZW50R3JvdXA7XG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwRGVsYXllZEhvdmVyKHJvd0VsZW1lbnQsIHsgY29udGVudDogbWFya2Rvd25UaXRsZSB9KSk7XG5cdFx0cm93RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCB0aXRsZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0TG9jYWxpemVkU3RyaW5ncygpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGVsZXRlQWN0aW9uVG9vbHRpcDogbG9jYWxpemUoJ3JlbW92ZUluY2x1ZGVJdGVtJywgXCJSZW1vdmUgSW5jbHVkZSBJdGVtXCIpLFxuXHRcdFx0ZWRpdEFjdGlvblRvb2x0aXA6IGxvY2FsaXplKCdlZGl0SW5jbHVkZUl0ZW0nLCBcIkVkaXQgSW5jbHVkZSBJdGVtXCIpLFxuXHRcdFx0YWRkQnV0dG9uTGFiZWw6IGxvY2FsaXplKCdhZGRQYXR0ZXJuJywgXCJBZGQgUGF0dGVyblwiKSxcblx0XHRcdGlucHV0UGxhY2Vob2xkZXI6IGxvY2FsaXplKCdpbmNsdWRlUGF0dGVybklucHV0UGxhY2Vob2xkZXInLCBcIkluY2x1ZGUgUGF0dGVybi4uLlwiKSxcblx0XHRcdHNpYmxpbmdJbnB1dFBsYWNlaG9sZGVyOiBsb2NhbGl6ZSgnaW5jbHVkZVNpYmxpbmdJbnB1dFBsYWNlaG9sZGVyJywgXCJXaGVuIFBhdHRlcm4gSXMgUHJlc2VudC4uLlwiKSxcblx0XHR9O1xuXHR9XG59XG5cbmludGVyZmFjZSBJT2JqZWN0U3RyaW5nRGF0YSB7XG5cdHR5cGU6ICdzdHJpbmcnO1xuXHRkYXRhOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9iamVjdEVudW1PcHRpb24ge1xuXHR2YWx1ZTogc3RyaW5nO1xuXHRkZXNjcmlwdGlvbj86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElPYmplY3RFbnVtRGF0YSB7XG5cdHR5cGU6ICdlbnVtJztcblx0ZGF0YTogc3RyaW5nO1xuXHRvcHRpb25zOiBJT2JqZWN0RW51bU9wdGlvbltdO1xufVxuXG5pbnRlcmZhY2UgSU9iamVjdEJvb2xEYXRhIHtcblx0dHlwZTogJ2Jvb2xlYW4nO1xuXHRkYXRhOiBib29sZWFuO1xufVxuXG50eXBlIE9iamVjdEtleSA9IElPYmplY3RTdHJpbmdEYXRhIHwgSU9iamVjdEVudW1EYXRhO1xuZXhwb3J0IHR5cGUgT2JqZWN0VmFsdWUgPSBJT2JqZWN0U3RyaW5nRGF0YSB8IElPYmplY3RFbnVtRGF0YSB8IElPYmplY3RCb29sRGF0YTtcbnR5cGUgT2JqZWN0V2lkZ2V0ID0gSW5wdXRCb3ggfCBTZWxlY3RCb3g7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9iamVjdERhdGFJdGVtIHtcblx0a2V5OiBPYmplY3RLZXk7XG5cdHZhbHVlOiBPYmplY3RWYWx1ZTtcblx0a2V5RGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdHNvdXJjZT86IHN0cmluZztcblx0cmVtb3ZhYmxlOiBib29sZWFuO1xuXHRyZXNldGFibGU6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUluY2x1ZGVFeGNsdWRlRGF0YUl0ZW0ge1xuXHR2YWx1ZTogT2JqZWN0S2V5O1xuXHRlbGVtZW50VHlwZTogU2V0dGluZ1ZhbHVlVHlwZTtcblx0c2libGluZz86IHN0cmluZztcblx0c291cmNlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElPYmplY3RWYWx1ZVN1Z2dlc3RlciB7XG5cdChrZXk6IHN0cmluZyk6IE9iamVjdFZhbHVlIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElPYmplY3RLZXlTdWdnZXN0ZXIge1xuXHQoZXhpc3RpbmdLZXlzOiBzdHJpbmdbXSwgaWR4PzogbnVtYmVyKTogSU9iamVjdEVudW1EYXRhIHwgdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgSU9iamVjdFNldFZhbHVlT3B0aW9ucyB7XG5cdHNldHRpbmdLZXk6IHN0cmluZztcblx0c2hvd0FkZEJ1dHRvbjogYm9vbGVhbjtcblx0aXNSZWFkT25seT86IGJvb2xlYW47XG5cdGtleVN1Z2dlc3Rlcj86IElPYmplY3RLZXlTdWdnZXN0ZXI7XG5cdHZhbHVlU3VnZ2VzdGVyPzogSU9iamVjdFZhbHVlU3VnZ2VzdGVyO1xufVxuXG5pbnRlcmZhY2UgSU9iamVjdFJlbmRlckVkaXRXaWRnZXRPcHRpb25zIHtcblx0aXNLZXk6IGJvb2xlYW47XG5cdGlkeDogbnVtYmVyO1xuXHRyZWFkb25seSBvcmlnaW5hbEl0ZW06IElPYmplY3REYXRhSXRlbTtcblx0cmVhZG9ubHkgY2hhbmdlZEl0ZW06IElPYmplY3REYXRhSXRlbTtcblx0dXBkYXRlKGtleU9yVmFsdWU6IE9iamVjdEtleSB8IE9iamVjdFZhbHVlKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIE9iamVjdFNldHRpbmdEcm9wZG93bldpZGdldCBleHRlbmRzIEFic3RyYWN0TGlzdFNldHRpbmdXaWRnZXQ8SU9iamVjdERhdGFJdGVtPiB7XG5cdHByaXZhdGUgZWRpdGFibGU6IGJvb2xlYW4gPSB0cnVlO1xuXHRwcml2YXRlIGN1cnJlbnRTZXR0aW5nS2V5OiBzdHJpbmcgPSAnJztcblx0cHJpdmF0ZSBzaG93QWRkQnV0dG9uOiBib29sZWFuID0gdHJ1ZTtcblx0cHJpdmF0ZSBrZXlTdWdnZXN0ZXI6IElPYmplY3RLZXlTdWdnZXN0ZXIgPSAoKSA9PiB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdmFsdWVTdWdnZXN0ZXI6IElPYmplY3RWYWx1ZVN1Z2dlc3RlciA9ICgpID0+IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGNvbnRhaW5lciwgdGhlbWVTZXJ2aWNlLCBjb250ZXh0Vmlld1NlcnZpY2UpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0VmFsdWUobGlzdERhdGE6IElPYmplY3REYXRhSXRlbVtdLCBvcHRpb25zPzogSU9iamVjdFNldFZhbHVlT3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdGFibGUgPSAhb3B0aW9ucz8uaXNSZWFkT25seTtcblx0XHR0aGlzLnNob3dBZGRCdXR0b24gPSBvcHRpb25zPy5zaG93QWRkQnV0dG9uID8/IHRoaXMuc2hvd0FkZEJ1dHRvbjtcblx0XHR0aGlzLmtleVN1Z2dlc3RlciA9IG9wdGlvbnM/LmtleVN1Z2dlc3RlciA/PyB0aGlzLmtleVN1Z2dlc3Rlcjtcblx0XHR0aGlzLnZhbHVlU3VnZ2VzdGVyID0gb3B0aW9ucz8udmFsdWVTdWdnZXN0ZXIgPz8gdGhpcy52YWx1ZVN1Z2dlc3RlcjtcblxuXHRcdGlmIChpc0RlZmluZWQob3B0aW9ucykgJiYgb3B0aW9ucy5zZXR0aW5nS2V5ICE9PSB0aGlzLmN1cnJlbnRTZXR0aW5nS2V5KSB7XG5cdFx0XHR0aGlzLm1vZGVsLnNldEVkaXRLZXkoJ25vbmUnKTtcblx0XHRcdHRoaXMubW9kZWwuc2VsZWN0KG51bGwpO1xuXHRcdFx0dGhpcy5jdXJyZW50U2V0dGluZ0tleSA9IG9wdGlvbnMuc2V0dGluZ0tleTtcblx0XHR9XG5cblx0XHRzdXBlci5zZXRWYWx1ZShsaXN0RGF0YSk7XG5cdH1cblxuXHRvdmVycmlkZSBpc0l0ZW1OZXcoaXRlbTogSU9iamVjdERhdGFJdGVtKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGl0ZW0ua2V5LmRhdGEgPT09ICcnICYmIGl0ZW0udmFsdWUuZGF0YSA9PT0gJyc7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgaXNBZGRCdXR0b25WaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnNob3dBZGRCdXR0b247XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0IGlzUmVhZE9ubHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLmVkaXRhYmxlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEVtcHR5SXRlbSgpOiBJT2JqZWN0RGF0YUl0ZW0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRrZXk6IHsgdHlwZTogJ3N0cmluZycsIGRhdGE6ICcnIH0sXG5cdFx0XHR2YWx1ZTogeyB0eXBlOiAnc3RyaW5nJywgZGF0YTogJycgfSxcblx0XHRcdHJlbW92YWJsZTogdHJ1ZSxcblx0XHRcdHJlc2V0YWJsZTogZmFsc2Vcblx0XHR9O1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldENvbnRhaW5lckNsYXNzZXMoKSB7XG5cdFx0cmV0dXJuIFsnc2V0dGluZy1saXN0LW9iamVjdC13aWRnZXQnXTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRBY3Rpb25zRm9ySXRlbShpdGVtOiBJT2JqZWN0RGF0YUl0ZW0sIGlkeDogbnVtYmVyKTogSUFjdGlvbltdIHtcblx0XHRpZiAodGhpcy5pc1JlYWRPbmx5KSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRjbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHNldHRpbmdzRWRpdEljb24pLFxuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZWRpdExpc3RJdGVtJyxcblx0XHRcdFx0bGFiZWw6ICcnLFxuXHRcdFx0XHR0b29sdGlwOiB0aGlzLmdldExvY2FsaXplZFN0cmluZ3MoKS5lZGl0QWN0aW9uVG9vbHRpcCxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmVkaXRTZXR0aW5nKGlkeClcblx0XHRcdH0sXG5cdFx0XTtcblxuXHRcdGlmIChpdGVtLnJlc2V0YWJsZSkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdFx0Y2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShzZXR0aW5nc0Rpc2NhcmRJY29uKSxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnJlc2V0TGlzdEl0ZW0nLFxuXHRcdFx0XHRsYWJlbDogJycsXG5cdFx0XHRcdHRvb2x0aXA6IHRoaXMuZ2V0TG9jYWxpemVkU3RyaW5ncygpLnJlc2V0QWN0aW9uVG9vbHRpcCxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUxpc3QuZmlyZSh7IHR5cGU6ICdyZXNldCcsIG9yaWdpbmFsSXRlbTogaXRlbSwgdGFyZ2V0SW5kZXg6IGlkeCB9KVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKGl0ZW0ucmVtb3ZhYmxlKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2goe1xuXHRcdFx0XHRjbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHNldHRpbmdzUmVtb3ZlSWNvbiksXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5yZW1vdmVMaXN0SXRlbScsXG5cdFx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdFx0dG9vbHRpcDogdGhpcy5nZXRMb2NhbGl6ZWRTdHJpbmdzKCkuZGVsZXRlQWN0aW9uVG9vbHRpcCxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUxpc3QuZmlyZSh7IHR5cGU6ICdyZW1vdmUnLCBvcmlnaW5hbEl0ZW06IGl0ZW0sIHRhcmdldEluZGV4OiBpZHggfSlcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBhY3Rpb25zO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckhlYWRlcigpIHtcblx0XHRjb25zdCBoZWFkZXIgPSAkKCcuc2V0dGluZy1saXN0LXJvdy1oZWFkZXInKTtcblx0XHRjb25zdCBrZXlIZWFkZXIgPSBET00uYXBwZW5kKGhlYWRlciwgJCgnLnNldHRpbmctbGlzdC1vYmplY3Qta2V5JykpO1xuXHRcdGNvbnN0IHZhbHVlSGVhZGVyID0gRE9NLmFwcGVuZChoZWFkZXIsICQoJy5zZXR0aW5nLWxpc3Qtb2JqZWN0LXZhbHVlJykpO1xuXHRcdGNvbnN0IHsga2V5SGVhZGVyVGV4dCwgdmFsdWVIZWFkZXJUZXh0IH0gPSB0aGlzLmdldExvY2FsaXplZFN0cmluZ3MoKTtcblxuXHRcdGtleUhlYWRlci50ZXh0Q29udGVudCA9IGtleUhlYWRlclRleHQ7XG5cdFx0dmFsdWVIZWFkZXIudGV4dENvbnRlbnQgPSB2YWx1ZUhlYWRlclRleHQ7XG5cblx0XHRyZXR1cm4gaGVhZGVyO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlckl0ZW0oaXRlbTogSU9iamVjdERhdGFJdGVtLCBpZHg6IG51bWJlcik6IFJvd0VsZW1lbnRHcm91cCB7XG5cdFx0Y29uc3Qgcm93RWxlbWVudCA9ICQoJy5zZXR0aW5nLWxpc3Qtcm93Jyk7XG5cdFx0cm93RWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzZXR0aW5nLWxpc3Qtb2JqZWN0LXJvdycpO1xuXG5cdFx0Y29uc3Qga2V5RWxlbWVudCA9IERPTS5hcHBlbmQocm93RWxlbWVudCwgJCgnLnNldHRpbmctbGlzdC1vYmplY3Qta2V5JykpO1xuXHRcdGNvbnN0IHZhbHVlRWxlbWVudCA9IERPTS5hcHBlbmQocm93RWxlbWVudCwgJCgnLnNldHRpbmctbGlzdC1vYmplY3QtdmFsdWUnKSk7XG5cblx0XHRrZXlFbGVtZW50LnRleHRDb250ZW50ID0gaXRlbS5rZXkuZGF0YTtcblx0XHR2YWx1ZUVsZW1lbnQudGV4dENvbnRlbnQgPSBpdGVtLnZhbHVlLmRhdGEudG9TdHJpbmcoKTtcblxuXHRcdHJldHVybiB7IHJvd0VsZW1lbnQsIGtleUVsZW1lbnQsIHZhbHVlRWxlbWVudCB9O1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlckVkaXQoaXRlbTogSU9iamVjdERhdGFJdGVtLCBpZHg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCByb3dFbGVtZW50ID0gJCgnLnNldHRpbmctbGlzdC1lZGl0LXJvdy5zZXR0aW5nLWxpc3Qtb2JqZWN0LXJvdycpO1xuXG5cdFx0Y29uc3QgY2hhbmdlZEl0ZW0gPSB7IC4uLml0ZW0gfTtcblx0XHRjb25zdCBvbktleUNoYW5nZSA9IChrZXk6IE9iamVjdEtleSkgPT4ge1xuXHRcdFx0Y2hhbmdlZEl0ZW0ua2V5ID0ga2V5O1xuXHRcdFx0b2tCdXR0b24uZW5hYmxlZCA9IGtleS5kYXRhICE9PSAnJztcblxuXHRcdFx0Y29uc3Qgc3VnZ2VzdGVkVmFsdWUgPSB0aGlzLnZhbHVlU3VnZ2VzdGVyKGtleS5kYXRhKSA/PyBpdGVtLnZhbHVlO1xuXG5cdFx0XHRpZiAodGhpcy5zaG91bGRVc2VTdWdnZXN0aW9uKGl0ZW0udmFsdWUsIGNoYW5nZWRJdGVtLnZhbHVlLCBzdWdnZXN0ZWRWYWx1ZSkpIHtcblx0XHRcdFx0b25WYWx1ZUNoYW5nZShzdWdnZXN0ZWRWYWx1ZSk7XG5cdFx0XHRcdHJlbmRlckxhdGVzdFZhbHVlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjb25zdCBvblZhbHVlQ2hhbmdlID0gKHZhbHVlOiBPYmplY3RWYWx1ZSkgPT4ge1xuXHRcdFx0Y2hhbmdlZEl0ZW0udmFsdWUgPSB2YWx1ZTtcblx0XHR9O1xuXG5cdFx0bGV0IGtleVdpZGdldDogT2JqZWN0V2lkZ2V0IHwgdW5kZWZpbmVkO1xuXHRcdGxldCBrZXlFbGVtZW50OiBIVE1MRWxlbWVudDtcblxuXHRcdGlmICh0aGlzLnNob3dBZGRCdXR0b24pIHtcblx0XHRcdGlmICh0aGlzLmlzSXRlbU5ldyhpdGVtKSkge1xuXHRcdFx0XHRjb25zdCBzdWdnZXN0ZWRLZXkgPSB0aGlzLmtleVN1Z2dlc3Rlcih0aGlzLm1vZGVsLml0ZW1zLm1hcCgoeyBrZXk6IHsgZGF0YSB9IH0pID0+IGRhdGEpKTtcblxuXHRcdFx0XHRpZiAoaXNEZWZpbmVkKHN1Z2dlc3RlZEtleSkpIHtcblx0XHRcdFx0XHRjaGFuZ2VkSXRlbS5rZXkgPSBzdWdnZXN0ZWRLZXk7XG5cdFx0XHRcdFx0Y29uc3Qgc3VnZ2VzdGVkVmFsdWUgPSB0aGlzLnZhbHVlU3VnZ2VzdGVyKGNoYW5nZWRJdGVtLmtleS5kYXRhKTtcblx0XHRcdFx0XHRvblZhbHVlQ2hhbmdlKHN1Z2dlc3RlZFZhbHVlID8/IGNoYW5nZWRJdGVtLnZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB7IHdpZGdldCwgZWxlbWVudCB9ID0gdGhpcy5yZW5kZXJFZGl0V2lkZ2V0KGNoYW5nZWRJdGVtLmtleSwge1xuXHRcdFx0XHRpZHgsXG5cdFx0XHRcdGlzS2V5OiB0cnVlLFxuXHRcdFx0XHRvcmlnaW5hbEl0ZW06IGl0ZW0sXG5cdFx0XHRcdGNoYW5nZWRJdGVtLFxuXHRcdFx0XHR1cGRhdGU6IG9uS2V5Q2hhbmdlLFxuXHRcdFx0fSk7XG5cdFx0XHRrZXlXaWRnZXQgPSB3aWRnZXQ7XG5cdFx0XHRrZXlFbGVtZW50ID0gZWxlbWVudDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0a2V5RWxlbWVudCA9ICQoJy5zZXR0aW5nLWxpc3Qtb2JqZWN0LWtleScpO1xuXHRcdFx0a2V5RWxlbWVudC50ZXh0Q29udGVudCA9IGl0ZW0ua2V5LmRhdGE7XG5cdFx0fVxuXG5cdFx0bGV0IHZhbHVlV2lkZ2V0OiBPYmplY3RXaWRnZXQ7XG5cdFx0Y29uc3QgdmFsdWVDb250YWluZXIgPSAkKCcuc2V0dGluZy1saXN0LW9iamVjdC12YWx1ZS1jb250YWluZXInKTtcblxuXHRcdGNvbnN0IHJlbmRlckxhdGVzdFZhbHVlID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgeyB3aWRnZXQsIGVsZW1lbnQgfSA9IHRoaXMucmVuZGVyRWRpdFdpZGdldChjaGFuZ2VkSXRlbS52YWx1ZSwge1xuXHRcdFx0XHRpZHgsXG5cdFx0XHRcdGlzS2V5OiBmYWxzZSxcblx0XHRcdFx0b3JpZ2luYWxJdGVtOiBpdGVtLFxuXHRcdFx0XHRjaGFuZ2VkSXRlbSxcblx0XHRcdFx0dXBkYXRlOiBvblZhbHVlQ2hhbmdlLFxuXHRcdFx0fSk7XG5cblx0XHRcdHZhbHVlV2lkZ2V0ID0gd2lkZ2V0O1xuXG5cdFx0XHRET00uY2xlYXJOb2RlKHZhbHVlQ29udGFpbmVyKTtcblx0XHRcdHZhbHVlQ29udGFpbmVyLmFwcGVuZChlbGVtZW50KTtcblx0XHR9O1xuXG5cdFx0cmVuZGVyTGF0ZXN0VmFsdWUoKTtcblxuXHRcdHJvd0VsZW1lbnQuYXBwZW5kKGtleUVsZW1lbnQsIHZhbHVlQ29udGFpbmVyKTtcblxuXHRcdGNvbnN0IG9rQnV0dG9uID0gdGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBCdXR0b24ocm93RWxlbWVudCwgZGVmYXVsdEJ1dHRvblN0eWxlcykpO1xuXHRcdG9rQnV0dG9uLmVuYWJsZWQgPSBjaGFuZ2VkSXRlbS5rZXkuZGF0YSAhPT0gJyc7XG5cdFx0b2tCdXR0b24ubGFiZWwgPSBsb2NhbGl6ZSgnb2tCdXR0b24nLCBcIk9LXCIpO1xuXHRcdG9rQnV0dG9uLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc2V0dGluZy1saXN0LW9rLWJ1dHRvbicpO1xuXG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKG9rQnV0dG9uLm9uRGlkQ2xpY2soKCkgPT4gdGhpcy5oYW5kbGVJdGVtQ2hhbmdlKGl0ZW0sIGNoYW5nZWRJdGVtLCBpZHgpKSk7XG5cblx0XHRjb25zdCBjYW5jZWxCdXR0b24gPSB0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQobmV3IEJ1dHRvbihyb3dFbGVtZW50LCB7IHNlY29uZGFyeTogdHJ1ZSwgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KSk7XG5cdFx0Y2FuY2VsQnV0dG9uLmxhYmVsID0gbG9jYWxpemUoJ2NhbmNlbEJ1dHRvbicsIFwiQ2FuY2VsXCIpO1xuXHRcdGNhbmNlbEJ1dHRvbi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3NldHRpbmctbGlzdC1jYW5jZWwtYnV0dG9uJyk7XG5cblx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQoY2FuY2VsQnV0dG9uLm9uRGlkQ2xpY2soKCkgPT4gdGhpcy5jYW5jZWxFZGl0KCkpKTtcblxuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZChcblx0XHRcdGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0ID0ga2V5V2lkZ2V0ID8/IHZhbHVlV2lkZ2V0O1xuXG5cdFx0XHRcdHdpZGdldC5mb2N1cygpO1xuXG5cdFx0XHRcdGlmICh3aWRnZXQgaW5zdGFuY2VvZiBJbnB1dEJveCkge1xuXHRcdFx0XHRcdHdpZGdldC5zZWxlY3QoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHQpO1xuXG5cdFx0cmV0dXJuIHJvd0VsZW1lbnQ7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckVkaXRXaWRnZXQoXG5cdFx0a2V5T3JWYWx1ZTogT2JqZWN0S2V5IHwgT2JqZWN0VmFsdWUsXG5cdFx0b3B0aW9uczogSU9iamVjdFJlbmRlckVkaXRXaWRnZXRPcHRpb25zLFxuXHQpIHtcblx0XHRzd2l0Y2ggKGtleU9yVmFsdWUudHlwZSkge1xuXHRcdFx0Y2FzZSAnc3RyaW5nJzpcblx0XHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyU3RyaW5nRWRpdFdpZGdldChrZXlPclZhbHVlLCBvcHRpb25zKTtcblx0XHRcdGNhc2UgJ2VudW0nOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5yZW5kZXJFbnVtRWRpdFdpZGdldChrZXlPclZhbHVlLCBvcHRpb25zKTtcblx0XHRcdGNhc2UgJ2Jvb2xlYW4nOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5yZW5kZXJFbnVtRWRpdFdpZGdldChcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnZW51bScsXG5cdFx0XHRcdFx0XHRkYXRhOiBrZXlPclZhbHVlLmRhdGEudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IFt7IHZhbHVlOiAndHJ1ZScgfSwgeyB2YWx1ZTogJ2ZhbHNlJyB9XSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdG9wdGlvbnMsXG5cdFx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJTdHJpbmdFZGl0V2lkZ2V0KFxuXHRcdGtleU9yVmFsdWU6IElPYmplY3RTdHJpbmdEYXRhLFxuXHRcdHsgaWR4LCBpc0tleSwgb3JpZ2luYWxJdGVtLCBjaGFuZ2VkSXRlbSwgdXBkYXRlIH06IElPYmplY3RSZW5kZXJFZGl0V2lkZ2V0T3B0aW9ucyxcblx0KSB7XG5cdFx0Y29uc3Qgd3JhcHBlciA9ICQoaXNLZXkgPyAnLnNldHRpbmctbGlzdC1vYmplY3QtaW5wdXQta2V5JyA6ICcuc2V0dGluZy1saXN0LW9iamVjdC1pbnB1dC12YWx1ZScpO1xuXHRcdGNvbnN0IGlucHV0Qm94ID0gbmV3IElucHV0Qm94KHdyYXBwZXIsIHRoaXMuY29udGV4dFZpZXdTZXJ2aWNlLCB7XG5cdFx0XHRwbGFjZWhvbGRlcjogaXNLZXlcblx0XHRcdFx0PyBsb2NhbGl6ZSgnb2JqZWN0S2V5SW5wdXRQbGFjZWhvbGRlcicsIFwiS2V5XCIpXG5cdFx0XHRcdDogbG9jYWxpemUoJ29iamVjdFZhbHVlSW5wdXRQbGFjZWhvbGRlcicsIFwiVmFsdWVcIiksXG5cdFx0XHRpbnB1dEJveFN0eWxlczogZ2V0SW5wdXRCb3hTdHlsZSh7XG5cdFx0XHRcdGlucHV0QmFja2dyb3VuZDogc2V0dGluZ3NUZXh0SW5wdXRCYWNrZ3JvdW5kLFxuXHRcdFx0XHRpbnB1dEZvcmVncm91bmQ6IHNldHRpbmdzVGV4dElucHV0Rm9yZWdyb3VuZCxcblx0XHRcdFx0aW5wdXRCb3JkZXI6IHNldHRpbmdzVGV4dElucHV0Qm9yZGVyXG5cdFx0XHR9KVxuXHRcdH0pO1xuXG5cdFx0aW5wdXRCb3guZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzZXR0aW5nLWxpc3Qtb2JqZWN0LWlucHV0Jyk7XG5cblx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQoaW5wdXRCb3gpO1xuXHRcdGlucHV0Qm94LnZhbHVlID0ga2V5T3JWYWx1ZS5kYXRhO1xuXG5cdFx0dGhpcy5saXN0RGlzcG9zYWJsZXMuYWRkKGlucHV0Qm94Lm9uRGlkQ2hhbmdlKHZhbHVlID0+IHVwZGF0ZSh7IC4uLmtleU9yVmFsdWUsIGRhdGE6IHZhbHVlIH0pKSk7XG5cblx0XHRjb25zdCBvbktleURvd24gPSAoZTogU3RhbmRhcmRLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0dGhpcy5oYW5kbGVJdGVtQ2hhbmdlKG9yaWdpbmFsSXRlbSwgY2hhbmdlZEl0ZW0sIGlkeCk7XG5cdFx0XHR9IGVsc2UgaWYgKGUuZXF1YWxzKEtleUNvZGUuRXNjYXBlKSkge1xuXHRcdFx0XHR0aGlzLmNhbmNlbEVkaXQoKTtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRET00uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoaW5wdXRCb3guaW5wdXRFbGVtZW50LCBET00uRXZlbnRUeXBlLktFWV9ET1dOLCBvbktleURvd24pXG5cdFx0KTtcblxuXHRcdHJldHVybiB7IHdpZGdldDogaW5wdXRCb3gsIGVsZW1lbnQ6IHdyYXBwZXIgfTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyRW51bUVkaXRXaWRnZXQoXG5cdFx0a2V5T3JWYWx1ZTogSU9iamVjdEVudW1EYXRhLFxuXHRcdHsgaXNLZXksIGNoYW5nZWRJdGVtLCB1cGRhdGUgfTogSU9iamVjdFJlbmRlckVkaXRXaWRnZXRPcHRpb25zLFxuXHQpIHtcblx0XHRjb25zdCBzZWxlY3RCb3ggPSB0aGlzLmNyZWF0ZUJhc2ljU2VsZWN0Qm94KGtleU9yVmFsdWUpO1xuXG5cdFx0Y29uc3QgY2hhbmdlZEtleU9yVmFsdWUgPSBpc0tleSA/IGNoYW5nZWRJdGVtLmtleSA6IGNoYW5nZWRJdGVtLnZhbHVlO1xuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZChcblx0XHRcdHNlbGVjdEJveC5vbkRpZFNlbGVjdCgoeyBzZWxlY3RlZCB9KSA9PlxuXHRcdFx0XHR1cGRhdGUoXG5cdFx0XHRcdFx0Y2hhbmdlZEtleU9yVmFsdWUudHlwZSA9PT0gJ2Jvb2xlYW4nXG5cdFx0XHRcdFx0XHQ/IHsgLi4uY2hhbmdlZEtleU9yVmFsdWUsIGRhdGE6IHNlbGVjdGVkID09PSAndHJ1ZScgPyB0cnVlIDogZmFsc2UgfVxuXHRcdFx0XHRcdFx0OiB7IC4uLmNoYW5nZWRLZXlPclZhbHVlLCBkYXRhOiBzZWxlY3RlZCB9LFxuXHRcdFx0XHQpXG5cdFx0XHQpXG5cdFx0KTtcblxuXHRcdGNvbnN0IHdyYXBwZXIgPSAkKCcuc2V0dGluZy1saXN0LW9iamVjdC1pbnB1dCcpO1xuXHRcdHdyYXBwZXIuY2xhc3NMaXN0LmFkZChcblx0XHRcdGlzS2V5ID8gJ3NldHRpbmctbGlzdC1vYmplY3QtaW5wdXQta2V5JyA6ICdzZXR0aW5nLWxpc3Qtb2JqZWN0LWlucHV0LXZhbHVlJyxcblx0XHQpO1xuXG5cdFx0c2VsZWN0Qm94LnJlbmRlcih3cmFwcGVyKTtcblxuXHRcdC8vIFN3aXRjaCB0byB0aGUgZmlyc3QgaXRlbSBpZiB0aGUgdXNlciBzZXQgc29tZXRoaW5nIGludmFsaWQgaW4gdGhlIGpzb25cblx0XHRjb25zdCBzZWxlY3RlZCA9IGtleU9yVmFsdWUub3B0aW9ucy5maW5kSW5kZXgob3B0aW9uID0+IGtleU9yVmFsdWUuZGF0YSA9PT0gb3B0aW9uLnZhbHVlKTtcblx0XHRpZiAoc2VsZWN0ZWQgPT09IC0xICYmIGtleU9yVmFsdWUub3B0aW9ucy5sZW5ndGgpIHtcblx0XHRcdHVwZGF0ZShcblx0XHRcdFx0Y2hhbmdlZEtleU9yVmFsdWUudHlwZSA9PT0gJ2Jvb2xlYW4nXG5cdFx0XHRcdFx0PyB7IC4uLmNoYW5nZWRLZXlPclZhbHVlLCBkYXRhOiB0cnVlIH1cblx0XHRcdFx0XHQ6IHsgLi4uY2hhbmdlZEtleU9yVmFsdWUsIGRhdGE6IGtleU9yVmFsdWUub3B0aW9uc1swXS52YWx1ZSB9XG5cdFx0XHQpO1xuXHRcdH0gZWxzZSBpZiAoY2hhbmdlZEtleU9yVmFsdWUudHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTI5NTgxXG5cdFx0XHR1cGRhdGUoeyAuLi5jaGFuZ2VkS2V5T3JWYWx1ZSwgZGF0YToga2V5T3JWYWx1ZS5kYXRhID09PSAndHJ1ZScgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgd2lkZ2V0OiBzZWxlY3RCb3gsIGVsZW1lbnQ6IHdyYXBwZXIgfTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkVXNlU3VnZ2VzdGlvbihvcmlnaW5hbFZhbHVlOiBPYmplY3RWYWx1ZSwgcHJldmlvdXNWYWx1ZTogT2JqZWN0VmFsdWUsIG5ld1ZhbHVlOiBPYmplY3RWYWx1ZSk6IGJvb2xlYW4ge1xuXHRcdC8vIHN1Z2dlc3Rpb24gaXMgZXhhY3RseSB0aGUgc2FtZVxuXHRcdGlmIChuZXdWYWx1ZS50eXBlICE9PSAnZW51bScgJiYgbmV3VmFsdWUudHlwZSA9PT0gcHJldmlvdXNWYWx1ZS50eXBlICYmIG5ld1ZhbHVlLmRhdGEgPT09IHByZXZpb3VzVmFsdWUuZGF0YSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGl0ZW0gaXMgbmV3LCB1c2Ugc3VnZ2VzdGlvblxuXHRcdGlmIChvcmlnaW5hbFZhbHVlLmRhdGEgPT09ICcnKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAocHJldmlvdXNWYWx1ZS50eXBlID09PSBuZXdWYWx1ZS50eXBlICYmIG5ld1ZhbHVlLnR5cGUgIT09ICdlbnVtJykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIGNoZWNrIGlmIGFsbCBlbnVtIG9wdGlvbnMgYXJlIHRoZSBzYW1lXG5cdFx0aWYgKHByZXZpb3VzVmFsdWUudHlwZSA9PT0gJ2VudW0nICYmIG5ld1ZhbHVlLnR5cGUgPT09ICdlbnVtJykge1xuXHRcdFx0Y29uc3QgcHJldmlvdXNFbnVtcyA9IG5ldyBTZXQocHJldmlvdXNWYWx1ZS5vcHRpb25zLm1hcCgoeyB2YWx1ZSB9KSA9PiB2YWx1ZSkpO1xuXHRcdFx0bmV3VmFsdWUub3B0aW9ucy5mb3JFYWNoKCh7IHZhbHVlIH0pID0+IHByZXZpb3VzRW51bXMuZGVsZXRlKHZhbHVlKSk7XG5cblx0XHRcdC8vIGFsbCBvcHRpb25zIGFyZSB0aGUgc2FtZVxuXHRcdFx0aWYgKHByZXZpb3VzRW51bXMuc2l6ZSA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWRkVG9vbHRpcHNUb1Jvdyhyb3dFbGVtZW50R3JvdXA6IFJvd0VsZW1lbnRHcm91cCwgaXRlbTogSU9iamVjdERhdGFJdGVtKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBrZXlFbGVtZW50LCB2YWx1ZUVsZW1lbnQsIHJvd0VsZW1lbnQgfSA9IHJvd0VsZW1lbnRHcm91cDtcblxuXHRcdGxldCBhY2Nlc3NpYmxlRGVzY3JpcHRpb247XG5cdFx0aWYgKGl0ZW0uc291cmNlKSB7XG5cdFx0XHRhY2Nlc3NpYmxlRGVzY3JpcHRpb24gPSBsb2NhbGl6ZSgnb2JqZWN0UGFpckhpbnRMYWJlbFdpdGhTb3VyY2UnLCBcIlRoZSBwcm9wZXJ0eSBgezB9YCBpcyBzZXQgdG8gYHsxfWAgYnkgYHsyfWAuXCIsIGl0ZW0ua2V5LmRhdGEsIGl0ZW0udmFsdWUuZGF0YSwgaXRlbS5zb3VyY2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhY2Nlc3NpYmxlRGVzY3JpcHRpb24gPSBsb2NhbGl6ZSgnb2JqZWN0UGFpckhpbnRMYWJlbCcsIFwiVGhlIHByb3BlcnR5IGB7MH1gIGlzIHNldCB0byBgezF9YC5cIiwgaXRlbS5rZXkuZGF0YSwgaXRlbS52YWx1ZS5kYXRhKTtcblx0XHR9XG5cblx0XHRjb25zdCBtYXJrZG93blN0cmluZyA9IG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZE1hcmtkb3duKGFjY2Vzc2libGVEZXNjcmlwdGlvbik7XG5cblx0XHRjb25zdCBrZXlEZXNjcmlwdGlvbjogc3RyaW5nIHwgTWFya2Rvd25TdHJpbmcgPSB0aGlzLmdldEVudW1EZXNjcmlwdGlvbihpdGVtLmtleSkgPz8gaXRlbS5rZXlEZXNjcmlwdGlvbiA/PyBtYXJrZG93blN0cmluZztcblx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBEZWxheWVkSG92ZXIoa2V5RWxlbWVudCwgeyBjb250ZW50OiBrZXlEZXNjcmlwdGlvbiB9KSk7XG5cblx0XHRjb25zdCB2YWx1ZURlc2NyaXB0aW9uOiBzdHJpbmcgfCBNYXJrZG93blN0cmluZyA9IHRoaXMuZ2V0RW51bURlc2NyaXB0aW9uKGl0ZW0udmFsdWUpID8/IG1hcmtkb3duU3RyaW5nO1xuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cERlbGF5ZWRIb3Zlcih2YWx1ZUVsZW1lbnQhLCB7IGNvbnRlbnQ6IHZhbHVlRGVzY3JpcHRpb24gfSkpO1xuXG5cdFx0cm93RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhY2Nlc3NpYmxlRGVzY3JpcHRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRFbnVtRGVzY3JpcHRpb24oa2V5T3JWYWx1ZTogT2JqZWN0S2V5IHwgT2JqZWN0VmFsdWUpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGVudW1EZXNjcmlwdGlvbiA9IGtleU9yVmFsdWUudHlwZSA9PT0gJ2VudW0nXG5cdFx0XHQ/IGtleU9yVmFsdWUub3B0aW9ucy5maW5kKCh7IHZhbHVlIH0pID0+IGtleU9yVmFsdWUuZGF0YSA9PT0gdmFsdWUpPy5kZXNjcmlwdGlvblxuXHRcdFx0OiB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIGVudW1EZXNjcmlwdGlvbjtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRMb2NhbGl6ZWRTdHJpbmdzKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkZWxldGVBY3Rpb25Ub29sdGlwOiBsb2NhbGl6ZSgncmVtb3ZlSXRlbScsIFwiUmVtb3ZlIEl0ZW1cIiksXG5cdFx0XHRyZXNldEFjdGlvblRvb2x0aXA6IGxvY2FsaXplKCdyZXNldEl0ZW0nLCBcIlJlc2V0IEl0ZW1cIiksXG5cdFx0XHRlZGl0QWN0aW9uVG9vbHRpcDogbG9jYWxpemUoJ2VkaXRJdGVtJywgXCJFZGl0IEl0ZW1cIiksXG5cdFx0XHRhZGRCdXR0b25MYWJlbDogbG9jYWxpemUoJ2FkZEl0ZW0nLCBcIkFkZCBJdGVtXCIpLFxuXHRcdFx0a2V5SGVhZGVyVGV4dDogbG9jYWxpemUoJ29iamVjdEtleUhlYWRlcicsIFwiSXRlbVwiKSxcblx0XHRcdHZhbHVlSGVhZGVyVGV4dDogbG9jYWxpemUoJ29iamVjdFZhbHVlSGVhZGVyJywgXCJWYWx1ZVwiKSxcblx0XHR9O1xuXHR9XG59XG5cbmludGVyZmFjZSBJQm9vbE9iamVjdFNldFZhbHVlT3B0aW9ucyB7XG5cdHNldHRpbmdLZXk6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQm9vbE9iamVjdERhdGFJdGVtIHtcblx0a2V5OiBJT2JqZWN0U3RyaW5nRGF0YTtcblx0dmFsdWU6IElPYmplY3RCb29sRGF0YTtcblx0a2V5RGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdHNvdXJjZT86IHN0cmluZztcblx0cmVtb3ZhYmxlOiBmYWxzZTtcblx0cmVzZXRhYmxlOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgT2JqZWN0U2V0dGluZ0NoZWNrYm94V2lkZ2V0IGV4dGVuZHMgQWJzdHJhY3RMaXN0U2V0dGluZ1dpZGdldDxJQm9vbE9iamVjdERhdGFJdGVtPiB7XG5cdHByaXZhdGUgY3VycmVudFNldHRpbmdLZXk6IHN0cmluZyA9ICcnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoY29udGFpbmVyLCB0aGVtZVNlcnZpY2UsIGNvbnRleHRWaWV3U2VydmljZSk7XG5cdH1cblxuXHRvdmVycmlkZSBzZXRWYWx1ZShsaXN0RGF0YTogSUJvb2xPYmplY3REYXRhSXRlbVtdLCBvcHRpb25zPzogSUJvb2xPYmplY3RTZXRWYWx1ZU9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAoaXNEZWZpbmVkKG9wdGlvbnMpICYmIG9wdGlvbnMuc2V0dGluZ0tleSAhPT0gdGhpcy5jdXJyZW50U2V0dGluZ0tleSkge1xuXHRcdFx0dGhpcy5tb2RlbC5zZXRFZGl0S2V5KCdub25lJyk7XG5cdFx0XHR0aGlzLm1vZGVsLnNlbGVjdChudWxsKTtcblx0XHRcdHRoaXMuY3VycmVudFNldHRpbmdLZXkgPSBvcHRpb25zLnNldHRpbmdLZXk7XG5cdFx0fVxuXG5cdFx0c3VwZXIuc2V0VmFsdWUobGlzdERhdGEpO1xuXHR9XG5cblx0b3ZlcnJpZGUgaXNJdGVtTmV3KGl0ZW06IElCb29sT2JqZWN0RGF0YUl0ZW0pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIWl0ZW0ua2V5LmRhdGEgJiYgIWl0ZW0udmFsdWUuZGF0YTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRFbXB0eUl0ZW0oKTogSUJvb2xPYmplY3REYXRhSXRlbSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtleTogeyB0eXBlOiAnc3RyaW5nJywgZGF0YTogJycgfSxcblx0XHRcdHZhbHVlOiB7IHR5cGU6ICdib29sZWFuJywgZGF0YTogZmFsc2UgfSxcblx0XHRcdHJlbW92YWJsZTogZmFsc2UsXG5cdFx0XHRyZXNldGFibGU6IHRydWVcblx0XHR9O1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldENvbnRhaW5lckNsYXNzZXMoKSB7XG5cdFx0cmV0dXJuIFsnc2V0dGluZy1saXN0LW9iamVjdC13aWRnZXQnXTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRBY3Rpb25zRm9ySXRlbShpdGVtOiBJQm9vbE9iamVjdERhdGFJdGVtLCBpZHg6IG51bWJlcik6IElBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGlzQWRkQnV0dG9uVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVySGVhZGVyKCkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyRGF0YU9yRWRpdEl0ZW0oaXRlbTogSUxpc3RWaWV3SXRlbTxJQm9vbE9iamVjdERhdGFJdGVtPiwgaWR4OiBudW1iZXIsIGxpc3RGb2N1c2VkOiBib29sZWFuKTogSFRNTEVsZW1lbnQge1xuXHRcdGNvbnN0IHJvd0VsZW1lbnQgPSB0aGlzLnJlbmRlckVkaXQoaXRlbSwgaWR4KTtcblx0XHRyb3dFbGVtZW50LnNldEF0dHJpYnV0ZSgncm9sZScsICdsaXN0aXRlbScpO1xuXHRcdHJldHVybiByb3dFbGVtZW50O1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbmRlckl0ZW0oaXRlbTogSUJvb2xPYmplY3REYXRhSXRlbSwgaWR4OiBudW1iZXIpOiBSb3dFbGVtZW50R3JvdXAge1xuXHRcdC8vIFJldHVybiBqdXN0IHRoZSBjb250YWluZXJzLCBzaW5jZSB3ZSBhbHdheXMgcmVuZGVyIGluIGVkaXQgbW9kZSBhbnl3YXlcblx0XHRjb25zdCByb3dFbGVtZW50ID0gJCgnLmJsYW5rLXJvdycpO1xuXHRcdGNvbnN0IGtleUVsZW1lbnQgPSAkKCcuYmxhbmstcm93LWtleScpO1xuXHRcdHJldHVybiB7IHJvd0VsZW1lbnQsIGtleUVsZW1lbnQgfTtcblx0fVxuXG5cdHByb3RlY3RlZCByZW5kZXJFZGl0KGl0ZW06IElCb29sT2JqZWN0RGF0YUl0ZW0sIGlkeDogbnVtYmVyKTogSFRNTEVsZW1lbnQge1xuXHRcdGNvbnN0IHJvd0VsZW1lbnQgPSAkKCcuc2V0dGluZy1saXN0LWVkaXQtcm93LnNldHRpbmctbGlzdC1vYmplY3Qtcm93LnNldHRpbmctaXRlbS1ib29sJyk7XG5cblx0XHRjb25zdCBjaGFuZ2VkSXRlbSA9IHsgLi4uaXRlbSB9O1xuXHRcdGNvbnN0IG9uVmFsdWVDaGFuZ2UgPSAobmV3VmFsdWU6IGJvb2xlYW4pID0+IHtcblx0XHRcdGNoYW5nZWRJdGVtLnZhbHVlLmRhdGEgPSBuZXdWYWx1ZTtcblx0XHRcdHRoaXMuaGFuZGxlSXRlbUNoYW5nZShpdGVtLCBjaGFuZ2VkSXRlbSwgaWR4KTtcblx0XHR9O1xuXHRcdGNvbnN0IGNoZWNrYm94RGVzY3JpcHRpb24gPSBpdGVtLmtleURlc2NyaXB0aW9uID8gYCR7aXRlbS5rZXlEZXNjcmlwdGlvbn0gKCR7aXRlbS5rZXkuZGF0YX0pYCA6IGl0ZW0ua2V5LmRhdGE7XG5cdFx0Y29uc3QgeyBlbGVtZW50LCB3aWRnZXQ6IGNoZWNrYm94IH0gPSB0aGlzLnJlbmRlckVkaXRXaWRnZXQoKGNoYW5nZWRJdGVtLnZhbHVlIGFzIElPYmplY3RCb29sRGF0YSkuZGF0YSwgY2hlY2tib3hEZXNjcmlwdGlvbiwgb25WYWx1ZUNoYW5nZSk7XG5cdFx0cm93RWxlbWVudC5hcHBlbmRDaGlsZChlbGVtZW50KTtcblxuXHRcdGNvbnN0IHZhbHVlRWxlbWVudCA9IERPTS5hcHBlbmQocm93RWxlbWVudCwgJCgnLnNldHRpbmctbGlzdC1vYmplY3QtdmFsdWUnKSk7XG5cdFx0dmFsdWVFbGVtZW50LnRleHRDb250ZW50ID0gY2hlY2tib3hEZXNjcmlwdGlvbjtcblxuXHRcdC8vIFdlIGFkZCB0aGUgdG9vbHRpcHMgaGVyZSwgYmVjYXVzZSB0aGUgbWV0aG9kIGlzIG5vdCBjYWxsZWQgYnkgZGVmYXVsdFxuXHRcdC8vIGZvciB3aWRnZXRzIGluIGVkaXQgbW9kZVxuXHRcdGNvbnN0IHJvd0VsZW1lbnRHcm91cCA9IHsgcm93RWxlbWVudCwga2V5RWxlbWVudDogdmFsdWVFbGVtZW50LCB2YWx1ZUVsZW1lbnQ6IGNoZWNrYm94LmRvbU5vZGUgfTtcblx0XHR0aGlzLmFkZFRvb2x0aXBzVG9Sb3cocm93RWxlbWVudEdyb3VwLCBpdGVtKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodmFsdWVFbGVtZW50LCBET00uRXZlbnRUeXBlLk1PVVNFX0RPV04sIGUgPT4ge1xuXHRcdFx0Y29uc3QgdGFyZ2V0RWxlbWVudCA9IDxIVE1MRWxlbWVudD5lLnRhcmdldDtcblx0XHRcdGlmICh0YXJnZXRFbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKSAhPT0gJ2EnKSB7XG5cdFx0XHRcdGNoZWNrYm94LmNoZWNrZWQgPSAhY2hlY2tib3guY2hlY2tlZDtcblx0XHRcdFx0b25WYWx1ZUNoYW5nZShjaGVja2JveC5jaGVja2VkKTtcblx0XHRcdH1cblx0XHRcdERPTS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiByb3dFbGVtZW50O1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJFZGl0V2lkZ2V0KFxuXHRcdHZhbHVlOiBib29sZWFuLFxuXHRcdGNoZWNrYm94RGVzY3JpcHRpb246IHN0cmluZyxcblx0XHRvblZhbHVlQ2hhbmdlOiAobmV3VmFsdWU6IGJvb2xlYW4pID0+IHZvaWRcblx0KSB7XG5cdFx0Y29uc3QgY2hlY2tib3ggPSBuZXcgVG9nZ2xlKHtcblx0XHRcdGljb246IENvZGljb24uY2hlY2ssXG5cdFx0XHRhY3Rpb25DbGFzc05hbWU6ICdzZXR0aW5nLXZhbHVlLWNoZWNrYm94Jyxcblx0XHRcdGlzQ2hlY2tlZDogdmFsdWUsXG5cdFx0XHR0aXRsZTogY2hlY2tib3hEZXNjcmlwdGlvbixcblx0XHRcdC4uLnVudGhlbWVkVG9nZ2xlU3R5bGVzXG5cdFx0fSk7XG5cblx0XHR0aGlzLmxpc3REaXNwb3NhYmxlcy5hZGQoY2hlY2tib3gpO1xuXG5cdFx0Y29uc3Qgd3JhcHBlciA9ICQoJy5zZXR0aW5nLWxpc3Qtb2JqZWN0LWlucHV0Jyk7XG5cdFx0d3JhcHBlci5jbGFzc0xpc3QuYWRkKCdzZXR0aW5nLWxpc3Qtb2JqZWN0LWlucHV0LWtleS1jaGVja2JveCcpO1xuXHRcdGNoZWNrYm94LmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnc2V0dGluZy12YWx1ZS1jaGVja2JveCcpO1xuXHRcdHdyYXBwZXIuYXBwZW5kQ2hpbGQoY2hlY2tib3guZG9tTm9kZSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdyYXBwZXIsIERPTS5FdmVudFR5cGUuTU9VU0VfRE9XTiwgZSA9PiB7XG5cdFx0XHRjaGVja2JveC5jaGVja2VkID0gIWNoZWNrYm94LmNoZWNrZWQ7XG5cdFx0XHRvblZhbHVlQ2hhbmdlKGNoZWNrYm94LmNoZWNrZWQpO1xuXG5cdFx0XHQvLyBXaXRob3V0IHRoaXMgbGluZSwgdGhlIHNldHRpbmdzIGVkaXRvciBhc3N1bWVzXG5cdFx0XHQvLyB3ZSBsb3N0IGZvY3VzIG9uIHRoaXMgc2V0dGluZyBjb21wbGV0ZWx5LlxuXHRcdFx0ZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4geyB3aWRnZXQ6IGNoZWNrYm94LCBlbGVtZW50OiB3cmFwcGVyIH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWRkVG9vbHRpcHNUb1Jvdyhyb3dFbGVtZW50R3JvdXA6IFJvd0VsZW1lbnRHcm91cCwgaXRlbTogSUJvb2xPYmplY3REYXRhSXRlbSk6IHZvaWQge1xuXHRcdGNvbnN0IGFjY2Vzc2libGVEZXNjcmlwdGlvbiA9IGxvY2FsaXplKCdvYmplY3RQYWlySGludExhYmVsJywgXCJUaGUgcHJvcGVydHkgYHswfWAgaXMgc2V0IHRvIGB7MX1gLlwiLCBpdGVtLmtleS5kYXRhLCBpdGVtLnZhbHVlLmRhdGEpO1xuXHRcdGNvbnN0IHRpdGxlID0gaXRlbS5rZXlEZXNjcmlwdGlvbiA/PyBhY2Nlc3NpYmxlRGVzY3JpcHRpb247XG5cdFx0Y29uc3QgeyByb3dFbGVtZW50LCBrZXlFbGVtZW50LCB2YWx1ZUVsZW1lbnQgfSA9IHJvd0VsZW1lbnRHcm91cDtcblxuXHRcdHRoaXMubGlzdERpc3Bvc2FibGVzLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cERlbGF5ZWRIb3ZlcihrZXlFbGVtZW50LCB7IGNvbnRlbnQ6IHRpdGxlIH0pKTtcblx0XHR2YWx1ZUVsZW1lbnQhLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGFjY2Vzc2libGVEZXNjcmlwdGlvbik7XG5cdFx0cm93RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhY2Nlc3NpYmxlRGVzY3JpcHRpb24pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldExvY2FsaXplZFN0cmluZ3MoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRlbGV0ZUFjdGlvblRvb2x0aXA6IGxvY2FsaXplKCdyZW1vdmVJdGVtJywgXCJSZW1vdmUgSXRlbVwiKSxcblx0XHRcdHJlc2V0QWN0aW9uVG9vbHRpcDogbG9jYWxpemUoJ3Jlc2V0SXRlbScsIFwiUmVzZXQgSXRlbVwiKSxcblx0XHRcdGVkaXRBY3Rpb25Ub29sdGlwOiBsb2NhbGl6ZSgnZWRpdEl0ZW0nLCBcIkVkaXQgSXRlbVwiKSxcblx0XHRcdGFkZEJ1dHRvbkxhYmVsOiBsb2NhbGl6ZSgnYWRkSXRlbScsIFwiQWRkIEl0ZW1cIiksXG5cdFx0XHRrZXlIZWFkZXJUZXh0OiBsb2NhbGl6ZSgnb2JqZWN0S2V5SGVhZGVyJywgXCJJdGVtXCIpLFxuXHRcdFx0dmFsdWVIZWFkZXJUZXh0OiBsb2NhbGl6ZSgnb2JqZWN0VmFsdWVIZWFkZXInLCBcIlZhbHVlXCIpLFxuXHRc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WUFBWSxLQUFLLENBQUM7QUFBQSxJQUN2QixDQUFDLENBQUM7QUFFRixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsaUJBQ1AsT0FDQSxxQkFDQSxlQUNDO0FBQ0QsVUFBTSxXQUFXLElBQUksT0FBTztBQUFBLE1BQzNCLE1BQU0sUUFBUTtBQUFBLE1BQ2QsaUJBQWlCO0FBQUEsTUFDakIsV0FBVztBQUFBLE1BQ1gsT0FBTztBQUFBLE1BQ1AsR0FBRztBQUFBLElBQ0osQ0FBQztBQUVELFNBQUssZ0JBQWdCLElBQUksUUFBUTtBQUVqQyxVQUFNLFVBQVUsRUFBRSw0QkFBNEI7QUFDOUMsWUFBUSxVQUFVLElBQUksd0NBQXdDO0FBQzlELGFBQVMsUUFBUSxVQUFVLElBQUksd0JBQXdCO0FBQ3ZELFlBQVEsWUFBWSxTQUFTLE9BQU87QUFFcEMsU0FBSyxVQUFVLElBQUksc0JBQXNCLFNBQVMsSUFBSSxVQUFVLFlBQVksT0FBSztBQUNoRixlQUFTLFVBQVUsQ0FBQyxTQUFTO0FBQzdCLG9CQUFjLFNBQVMsT0FBTztBQUk5QixRQUFFLHlCQUF5QjtBQUFBLElBQzVCLENBQUMsQ0FBQztBQUVGLFdBQU8sRUFBRSxRQUFRLFVBQVUsU0FBUyxRQUFRO0FBQUEsRUFDN0M7QUFBQSxFQUVVLGlCQUFpQixpQkFBa0MsTUFBaUM7QUFDN0YsVUFBTSx3QkFBd0IsU0FBUyx1QkFBdUIsdUNBQXVDLEtBQUssSUFBSSxNQUFNLEtBQUssTUFBTSxJQUFJO0FBQ25JLFVBQU0sUUFBUSxLQUFLLGtCQUFrQjtBQUNyQyxVQUFNLEVBQUUsWUFBWSxZQUFZLGFBQWEsSUFBSTtBQUVqRCxTQUFLLGdCQUFnQixJQUFJLEtBQUssYUFBYSxrQkFBa0IsWUFBWSxFQUFFLFNBQVMsTUFBTSxDQUFDLENBQUM7QUFDNUYsaUJBQWMsYUFBYSxjQUFjLHFCQUFxQjtBQUM5RCxlQUFXLGFBQWEsY0FBYyxxQkFBcUI7QUFBQSxFQUM1RDtBQUFBLEVBRVUsc0JBQXNCO0FBQy9CLFdBQU87QUFBQSxNQUNOLHFCQUFxQixTQUFTLGNBQWMsYUFBYTtBQUFBLE1BQ3pELG9CQUFvQixTQUFTLGFBQWEsWUFBWTtBQUFBLE1BQ3RELG1CQUFtQixTQUFTLFlBQVksV0FBVztBQUFBLE1BQ25ELGdCQUFnQixTQUFTLFdBQVcsVUFBVTtBQUFBLE1BQzlDLGVBQWUsU0FBUyxtQkFBbUIsTUFBTTtBQUFBLE1BQ2pELGlCQUFpQixTQUFTLHFCQUFxQixPQUFPO0FBQUEsSUFDdkQ7QUFBQSxFQUNEO0FBQ0Q7QUFwSmEsOEJBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVBVOyIsCiAgIm5hbWVzIjogWyJ2YWx1ZSIsICJpdGVtIiwgInNlbGVjdGVkIl0KfQo=
