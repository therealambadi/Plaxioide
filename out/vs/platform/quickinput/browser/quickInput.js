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
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { Toggle } from "../../../base/browser/ui/toggle/toggle.js";
import { equals } from "../../../base/common/arrays.js";
import { TimeoutTimer } from "../../../base/common/async.js";
import { Codicon } from "../../../base/common/codicons.js";
import { Emitter, EventBufferer } from "../../../base/common/event.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { isIOS } from "../../../base/common/platform.js";
import Severity from "../../../base/common/severity.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import "./media/quickInput.css";
import { localize } from "../../../nls.js";
import { ItemActivation, NO_KEY_MODS, QuickInputButtonLocation, QuickInputHideReason, QuickInputType, QuickPickFocus } from "../common/quickInput.js";
import { quickInputButtonToAction, renderQuickInputDescription } from "./quickInputUtils.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../hover/browser/hover.js";
import { ContextKeyExpr, RawContextKey } from "../../contextkey/common/contextkey.js";
const inQuickInputContextKeyValue = "inQuickInput";
const InQuickInputContextKey = new RawContextKey(inQuickInputContextKeyValue, false, localize("inQuickInput", "Whether keyboard focus is inside the quick input control"));
const inQuickInputContext = ContextKeyExpr.has(inQuickInputContextKeyValue);
const quickInputAlignmentContextKeyValue = "quickInputAlignment";
const QuickInputAlignmentContextKey = new RawContextKey(quickInputAlignmentContextKeyValue, "top", localize("quickInputAlignment", "The alignment of the quick input"));
const quickInputTypeContextKeyValue = "quickInputType";
const QuickInputTypeContextKey = new RawContextKey(quickInputTypeContextKeyValue, void 0, localize("quickInputType", "The type of the currently visible quick input"));
const endOfQuickInputBoxContextKeyValue = "cursorAtEndOfQuickInputBox";
const EndOfQuickInputBoxContextKey = new RawContextKey(endOfQuickInputBoxContextKeyValue, false, localize("cursorAtEndOfQuickInputBox", "Whether the cursor in the quick input is at the end of the input box"));
const endOfQuickInputBoxContext = ContextKeyExpr.has(endOfQuickInputBoxContextKeyValue);
const backButton = {
  iconClass: ThemeIcon.asClassName(Codicon.quickInputBack),
  tooltip: localize("quickInput.back", "Back"),
  handle: -1
  // TODO
};
const _QuickInput = class _QuickInput extends Disposable {
  constructor(ui) {
    super();
    this.ui = ui;
    this._widgetUpdated = false;
    this.visible = false;
    this._enabled = true;
    this._busy = false;
    this._ignoreFocusOut = false;
    this._leftButtons = [];
    this._rightButtons = [];
    this._inlineButtons = [];
    this.buttonsUpdated = false;
    this._toggles = [];
    this.togglesUpdated = false;
    this.noValidationMessage = _QuickInput.noPromptMessage;
    this._severity = Severity.Ignore;
    this.onDidTriggerButtonEmitter = this._register(new Emitter());
    this.onDidHideEmitter = this._register(new Emitter());
    this.onWillHideEmitter = this._register(new Emitter());
    this.onDisposeEmitter = this._register(new Emitter());
    this.visibleDisposables = this._register(new DisposableStore());
    this.onDidTriggerButton = this.onDidTriggerButtonEmitter.event;
    this.onDidHide = this.onDidHideEmitter.event;
    this.onWillHide = this.onWillHideEmitter.event;
    this.onDispose = this.onDisposeEmitter.event;
  }
  get title() {
    return this._title;
  }
  set title(title) {
    this._title = title;
    this.update();
  }
  get description() {
    return this._description;
  }
  set description(description) {
    this._description = description;
    this.update();
  }
  get widget() {
    return this._widget;
  }
  set widget(widget) {
    if (!dom.isHTMLElement(widget)) {
      return;
    }
    if (this._widget !== widget) {
      this._widget = widget;
      this._widgetUpdated = true;
      this.update();
    }
  }
  get step() {
    return this._steps;
  }
  set step(step) {
    this._steps = step;
    this.update();
  }
  get totalSteps() {
    return this._totalSteps;
  }
  set totalSteps(totalSteps) {
    this._totalSteps = totalSteps;
    this.update();
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(enabled) {
    this._enabled = enabled;
    this.update();
  }
  get contextKey() {
    return this._contextKey;
  }
  set contextKey(contextKey) {
    this._contextKey = contextKey;
    this.update();
  }
  get busy() {
    return this._busy;
  }
  set busy(busy) {
    this._busy = busy;
    this.update();
  }
  get ignoreFocusOut() {
    return this._ignoreFocusOut;
  }
  set ignoreFocusOut(ignoreFocusOut) {
    const shouldUpdate = this._ignoreFocusOut !== ignoreFocusOut && !isIOS;
    this._ignoreFocusOut = ignoreFocusOut && !isIOS;
    if (shouldUpdate) {
      this.update();
    }
  }
  get titleButtons() {
    return this._leftButtons.length ? [...this._leftButtons, this._rightButtons] : this._rightButtons;
  }
  get buttons() {
    return [
      ...this._leftButtons,
      ...this._rightButtons,
      ...this._inlineButtons
    ];
  }
  set buttons(buttons) {
    this._leftButtons = buttons.filter((b) => b === backButton);
    this._rightButtons = buttons.filter((b) => b !== backButton && b.location !== QuickInputButtonLocation.Inline);
    this._inlineButtons = buttons.filter((b) => b.location === QuickInputButtonLocation.Inline);
    this.buttonsUpdated = true;
    this.update();
  }
  get toggles() {
    return this._toggles;
  }
  set toggles(toggles) {
    this._toggles = toggles ?? [];
    this.togglesUpdated = true;
    this.update();
  }
  get validationMessage() {
    return this._validationMessage;
  }
  set validationMessage(validationMessage) {
    this._validationMessage = validationMessage;
    this.update();
  }
  get severity() {
    return this._severity;
  }
  set severity(severity) {
    this._severity = severity;
    this.update();
  }
  show() {
    if (this.visible) {
      return;
    }
    this.visibleDisposables.add(
      this.ui.onDidTriggerButton((button) => {
        if (this.buttons.indexOf(button) !== -1) {
          this.onDidTriggerButtonEmitter.fire(button);
        }
      })
    );
    this.ui.show(this);
    this.visible = true;
    this._lastValidationMessage = void 0;
    this._lastSeverity = void 0;
    if (this.buttons.length) {
      this.buttonsUpdated = true;
    }
    if (this.toggles.length) {
      this.togglesUpdated = true;
    }
    this.update();
  }
  hide() {
    if (!this.visible) {
      return;
    }
    this.ui.hide();
  }
  didHide(reason = QuickInputHideReason.Other) {
    this.visible = false;
    this.visibleDisposables.clear();
    this.onDidHideEmitter.fire({ reason });
  }
  willHide(reason = QuickInputHideReason.Other) {
    this.onWillHideEmitter.fire({ reason });
  }
  update() {
    if (!this.visible) {
      return;
    }
    const title = this.getTitle();
    if (title && this.ui.title.textContent !== title) {
      this.ui.title.textContent = title;
    } else if (!title && this.ui.title.innerHTML !== "&nbsp;") {
      this.ui.title.innerText = "\xA0";
    }
    const description = this.getDescription();
    if (this.ui.description1.textContent !== description) {
      this.ui.description1.textContent = description;
    }
    if (this.ui.description2.textContent !== description) {
      this.ui.description2.textContent = description;
    }
    if (this._widgetUpdated) {
      this._widgetUpdated = false;
      if (this._widget) {
        dom.reset(this.ui.widget, this._widget);
      } else {
        dom.reset(this.ui.widget);
      }
    }
    if (this.busy && !this.busyDelay) {
      this.busyDelay = new TimeoutTimer();
      this.busyDelay.setIfNotSet(() => {
        if (this.visible) {
          this.ui.progressBar.infinite();
        }
      }, 800);
    }
    if (!this.busy && this.busyDelay) {
      this.ui.progressBar.stop();
      this.busyDelay.cancel();
      this.busyDelay = void 0;
    }
    if (this.buttonsUpdated) {
      this.buttonsUpdated = false;
      this.ui.leftActionBar.clear();
      const leftButtons = this._leftButtons.map((button, index) => quickInputButtonToAction(
        button,
        `id-${index}`,
        async () => this.onDidTriggerButtonEmitter.fire(button)
      ));
      this.ui.leftActionBar.push(leftButtons, { icon: true, label: false });
      this.ui.rightActionBar.clear();
      const rightButtons = this._rightButtons.map((button, index) => quickInputButtonToAction(
        button,
        `id-${index}`,
        async () => this.onDidTriggerButtonEmitter.fire(button)
      ));
      this.ui.rightActionBar.push(rightButtons, { icon: true, label: false });
      this.ui.inlineActionBar.clear();
      const inlineButtons = this._inlineButtons.map((button, index) => quickInputButtonToAction(
        button,
        `id-${index}`,
        async () => this.onDidTriggerButtonEmitter.fire(button)
      ));
      this.ui.inlineActionBar.push(inlineButtons, { icon: true, label: false });
    }
    if (this.togglesUpdated) {
      this.togglesUpdated = false;
      const concreteToggles = this.toggles?.filter((opts) => opts instanceof Toggle) ?? [];
      this.ui.inputBox.toggles = concreteToggles;
    }
    this.ui.ignoreFocusOut = this.ignoreFocusOut;
    this.ui.setEnabled(this.enabled);
    this.ui.setContextKey(this.contextKey);
    const validationMessage = this.validationMessage || this.noValidationMessage;
    if (this._lastValidationMessage !== validationMessage) {
      this._lastValidationMessage = validationMessage;
      dom.reset(this.ui.message);
      renderQuickInputDescription(validationMessage, this.ui.message, {
        callback: (content) => {
          this.ui.linkOpenerDelegate(content);
        },
        disposables: this.visibleDisposables
      });
    }
    if (this._lastSeverity !== this.severity) {
      this._lastSeverity = this.severity;
      this.showMessageDecoration(this.severity);
    }
  }
  getTitle() {
    if (this.title && this.step) {
      return `${this.title} (${this.getSteps()})`;
    }
    if (this.title) {
      return this.title;
    }
    if (this.step) {
      return this.getSteps();
    }
    return "";
  }
  getDescription() {
    return this.description || "";
  }
  getSteps() {
    if (this.step && this.totalSteps) {
      return localize("quickInput.steps", "{0}/{1}", this.step, this.totalSteps);
    }
    if (this.step) {
      return String(this.step);
    }
    return "";
  }
  showMessageDecoration(severity) {
    this.ui.inputBox.showDecoration(severity);
    if (severity !== Severity.Ignore) {
      const styles = this.ui.inputBox.stylesForType(severity);
      this.ui.message.style.color = styles.foreground ? `${styles.foreground}` : "";
      this.ui.message.style.backgroundColor = styles.background ? `${styles.background}` : "";
      this.ui.message.style.border = styles.border ? `1px solid ${styles.border}` : "";
      this.ui.message.style.marginBottom = "-2px";
    } else {
      this.ui.message.style.color = "";
      this.ui.message.style.backgroundColor = "";
      this.ui.message.style.border = "";
      this.ui.message.style.marginBottom = "";
    }
  }
  dispose() {
    this.hide();
    this.onDisposeEmitter.fire();
    super.dispose();
  }
};
_QuickInput.noPromptMessage = localize("inputModeEntry", "Press 'Enter' to confirm your input or 'Escape' to cancel");
let QuickInput = _QuickInput;
const _QuickPick = class _QuickPick extends QuickInput {
  constructor() {
    super(...arguments);
    this._value = "";
    this.onDidChangeValueEmitter = this._register(new Emitter());
    this.onWillAcceptEmitter = this._register(new Emitter());
    this.onDidAcceptEmitter = this._register(new Emitter());
    this.onDidCustomEmitter = this._register(new Emitter());
    this._items = [];
    this.itemsUpdated = false;
    this._canSelectMany = false;
    this._canAcceptInBackground = false;
    this._matchOnDescription = false;
    this._matchOnDetail = false;
    this._matchOnLabel = true;
    this._matchOnLabelMode = "fuzzy";
    this._sortByLabel = true;
    this._keepScrollPosition = false;
    this._itemActivation = ItemActivation.FIRST;
    this._activeItems = [];
    this.activeItemsUpdated = false;
    this.activeItemsToConfirm = [];
    this.onDidChangeActiveEmitter = this._register(new Emitter());
    this._selectedItems = [];
    this.selectedItemsUpdated = false;
    this.selectedItemsToConfirm = [];
    this.onDidChangeSelectionEmitter = this._register(new Emitter());
    this.onDidTriggerItemButtonEmitter = this._register(new Emitter());
    this.onDidTriggerSeparatorButtonEmitter = this._register(new Emitter());
    this.valueSelectionUpdated = true;
    this._ok = "default";
    this._customButton = false;
    this._focusEventBufferer = new EventBufferer();
    this.type = QuickInputType.QuickPick;
    this.filterValue = (value) => value;
    this.onDidChangeValue = this.onDidChangeValueEmitter.event;
    this.onWillAccept = this.onWillAcceptEmitter.event;
    this.onDidAccept = this.onDidAcceptEmitter.event;
    this.onDidCustom = this.onDidCustomEmitter.event;
    this.onDidChangeActive = this.onDidChangeActiveEmitter.event;
    this.onDidChangeSelection = this.onDidChangeSelectionEmitter.event;
    this.onDidTriggerItemButton = this.onDidTriggerItemButtonEmitter.event;
    this.onDidTriggerSeparatorButton = this.onDidTriggerSeparatorButtonEmitter.event;
  }
  get quickNavigate() {
    return this._quickNavigate;
  }
  set quickNavigate(quickNavigate) {
    this._quickNavigate = quickNavigate;
    this.update();
  }
  get value() {
    return this._value;
  }
  set value(value) {
    this.doSetValue(value);
  }
  doSetValue(value, skipUpdate) {
    if (this._value !== value) {
      this._value = value;
      if (!skipUpdate) {
        this.update();
      }
      if (this.visible) {
        const didFilter = this.ui.list.filter(this.filterValue(this._value));
        if (didFilter) {
          this.trySelectFirst();
        }
      }
      this.onDidChangeValueEmitter.fire(this._value);
    }
  }
  set ariaLabel(ariaLabel) {
    this._ariaLabel = ariaLabel;
    this.update();
  }
  get ariaLabel() {
    return this._ariaLabel;
  }
  get placeholder() {
    return this._placeholder;
  }
  set placeholder(placeholder) {
    this._placeholder = placeholder;
    this.update();
  }
  get items() {
    return this._items;
  }
  get scrollTop() {
    return this.ui.list.scrollTop;
  }
  set scrollTop(scrollTop) {
    this.ui.list.scrollTop = scrollTop;
  }
  set items(items) {
    this._items = items;
    this.itemsUpdated = true;
    this.update();
  }
  get canSelectMany() {
    return this._canSelectMany;
  }
  set canSelectMany(canSelectMany) {
    this._canSelectMany = canSelectMany;
    this.update();
  }
  get canAcceptInBackground() {
    return this._canAcceptInBackground;
  }
  set canAcceptInBackground(canAcceptInBackground) {
    this._canAcceptInBackground = canAcceptInBackground;
  }
  get matchOnDescription() {
    return this._matchOnDescription;
  }
  set matchOnDescription(matchOnDescription) {
    this._matchOnDescription = matchOnDescription;
    this.update();
  }
  get matchOnDetail() {
    return this._matchOnDetail;
  }
  set matchOnDetail(matchOnDetail) {
    this._matchOnDetail = matchOnDetail;
    this.update();
  }
  get matchOnLabel() {
    return this._matchOnLabel;
  }
  set matchOnLabel(matchOnLabel) {
    this._matchOnLabel = matchOnLabel;
    this.update();
  }
  get matchOnLabelMode() {
    return this._matchOnLabelMode;
  }
  set matchOnLabelMode(matchOnLabelMode) {
    this._matchOnLabelMode = matchOnLabelMode;
    this.update();
  }
  get sortByLabel() {
    return this._sortByLabel;
  }
  set sortByLabel(sortByLabel) {
    this._sortByLabel = sortByLabel;
    this.update();
  }
  get keepScrollPosition() {
    return this._keepScrollPosition;
  }
  set keepScrollPosition(keepScrollPosition) {
    this._keepScrollPosition = keepScrollPosition;
  }
  get itemActivation() {
    return this._itemActivation;
  }
  set itemActivation(itemActivation) {
    this._itemActivation = itemActivation;
  }
  get activeItems() {
    return this._activeItems;
  }
  set activeItems(activeItems) {
    this._activeItems = activeItems;
    this.activeItemsUpdated = true;
    this.update();
  }
  get selectedItems() {
    return this._selectedItems;
  }
  set selectedItems(selectedItems) {
    this._selectedItems = selectedItems;
    this.selectedItemsUpdated = true;
    this.update();
  }
  get keyMods() {
    if (this._quickNavigate) {
      return NO_KEY_MODS;
    }
    return this.ui.keyMods;
  }
  get valueSelection() {
    const selection = this.ui.inputBox.getSelection();
    if (!selection) {
      return void 0;
    }
    return [selection.start, selection.end];
  }
  set valueSelection(valueSelection) {
    this._valueSelection = valueSelection;
    this.valueSelectionUpdated = true;
    this.update();
  }
  get customButton() {
    return this._customButton;
  }
  set customButton(showCustomButton) {
    this._customButton = showCustomButton;
    this.update();
  }
  get customLabel() {
    return this._customButtonLabel;
  }
  set customLabel(label) {
    this._customButtonLabel = label;
    this.update();
  }
  get customHover() {
    return this._customButtonHover;
  }
  set customHover(hover) {
    this._customButtonHover = hover;
    this.update();
  }
  get ok() {
    return this._ok;
  }
  set ok(showOkButton) {
    this._ok = showOkButton;
    this.update();
  }
  get okLabel() {
    return this._okLabel ?? localize("ok", "OK");
  }
  set okLabel(okLabel) {
    this._okLabel = okLabel;
    this.update();
  }
  inputHasFocus() {
    return this.visible ? this.ui.inputBox.hasFocus() : false;
  }
  focusOnInput() {
    this.ui.inputBox.setFocus();
  }
  get hideInput() {
    return !!this._hideInput;
  }
  set hideInput(hideInput) {
    this._hideInput = hideInput;
    this.update();
  }
  get hideCountBadge() {
    return !!this._hideCountBadge;
  }
  set hideCountBadge(hideCountBadge) {
    this._hideCountBadge = hideCountBadge;
    this.update();
  }
  get hideCheckAll() {
    return !!this._hideCheckAll;
  }
  set hideCheckAll(hideCheckAll) {
    this._hideCheckAll = hideCheckAll;
    this.update();
  }
  trySelectFirst() {
    if (!this.canSelectMany) {
      this.ui.list.focus(QuickPickFocus.First);
    }
  }
  show() {
    if (!this.visible) {
      this.visibleDisposables.add(
        this.ui.inputBox.onDidChange((value) => {
          this.doSetValue(
            value,
            true
            /* skip update since this originates from the UI */
          );
        })
      );
      this.visibleDisposables.add(this.ui.onDidAccept(() => {
        if (this.canSelectMany) {
          if (!this.ui.list.getCheckedElements().length) {
            this._selectedItems = [];
            this.onDidChangeSelectionEmitter.fire(this.selectedItems);
          }
        } else if (this.activeItems[0]) {
          this._selectedItems = [this.activeItems[0]];
          this.onDidChangeSelectionEmitter.fire(this.selectedItems);
        }
        this.handleAccept(false);
      }));
      this.visibleDisposables.add(this.ui.onDidCustom(() => {
        this.onDidCustomEmitter.fire();
      }));
      this.visibleDisposables.add(this._focusEventBufferer.wrapEvent(
        this.ui.list.onDidChangeFocus,
        // Only fire the last event
        (_, e) => e
      )((focusedItems) => {
        if (this.activeItemsUpdated) {
          return;
        }
        if (this.activeItemsToConfirm !== this._activeItems && equals(focusedItems, this._activeItems, (a, b) => a === b)) {
          return;
        }
        this._activeItems = focusedItems;
        this.onDidChangeActiveEmitter.fire(focusedItems);
      }));
      this.visibleDisposables.add(this.ui.list.onDidChangeSelection(({ items: selectedItems, event }) => {
        if (this.canSelectMany && !selectedItems.some((i) => i.pickable === false)) {
          if (selectedItems.length) {
            this.ui.list.setSelectedElements([]);
          }
          return;
        }
        if (this.selectedItemsToConfirm !== this._selectedItems && equals(selectedItems, this._selectedItems, (a, b) => a === b)) {
          return;
        }
        this._selectedItems = selectedItems;
        this.onDidChangeSelectionEmitter.fire(selectedItems);
        if (selectedItems.length) {
          this.handleAccept(
            dom.isMouseEvent(event) && event.button === 1
            /* mouse middle click */
          );
        }
      }));
      this.visibleDisposables.add(this.ui.list.onChangedCheckedElements((checkedItems) => {
        if (!this.canSelectMany || !this.visible) {
          return;
        }
        if (this.selectedItemsToConfirm !== this._selectedItems && equals(checkedItems, this._selectedItems, (a, b) => a === b)) {
          return;
        }
        this._selectedItems = checkedItems;
        this.onDidChangeSelectionEmitter.fire(checkedItems);
      }));
      this.visibleDisposables.add(this.ui.list.onButtonTriggered((event) => this.onDidTriggerItemButtonEmitter.fire(event)));
      this.visibleDisposables.add(this.ui.list.onSeparatorButtonTriggered((event) => this.onDidTriggerSeparatorButtonEmitter.fire(event)));
      this.visibleDisposables.add(this.registerQuickNavigation());
      this.valueSelectionUpdated = true;
    }
    super.show();
  }
  handleAccept(inBackground) {
    let veto = false;
    this.onWillAcceptEmitter.fire({ veto: () => veto = true });
    if (!veto) {
      this.onDidAcceptEmitter.fire({ inBackground });
    }
  }
  registerQuickNavigation() {
    return dom.addDisposableListener(this.ui.container, dom.EventType.KEY_UP, (e) => {
      if (this.canSelectMany || !this._quickNavigate) {
        return;
      }
      const keyboardEvent = new StandardKeyboardEvent(e);
      const keyCode = keyboardEvent.keyCode;
      const quickNavKeys = this._quickNavigate.keybindings;
      const wasTriggerKeyPressed = quickNavKeys.some((k) => {
        const chords = k.getChords();
        if (chords.length > 1) {
          return false;
        }
        if (chords[0].shiftKey && keyCode === KeyCode.Shift) {
          if (keyboardEvent.ctrlKey || keyboardEvent.altKey || keyboardEvent.metaKey) {
            return false;
          }
          return true;
        }
        if (chords[0].altKey && keyCode === KeyCode.Alt) {
          return true;
        }
        if (chords[0].ctrlKey && keyCode === KeyCode.Ctrl) {
          return true;
        }
        if (chords[0].metaKey && keyCode === KeyCode.Meta) {
          return true;
        }
        return false;
      });
      if (wasTriggerKeyPressed) {
        if (this.activeItems[0]) {
          this._selectedItems = [this.activeItems[0]];
          this.onDidChangeSelectionEmitter.fire(this.selectedItems);
          this.handleAccept(false);
        }
        this._quickNavigate = void 0;
      }
    });
  }
  update() {
    if (!this.visible) {
      return;
    }
    const scrollTopBefore = this.keepScrollPosition ? this.scrollTop : 0;
    const hasDescription = !!this.description;
    const visibilities = {
      title: !!this.title || !!this.step || !!this.titleButtons.length,
      description: hasDescription,
      checkAll: this.canSelectMany && !this._hideCheckAll,
      checkBox: this.canSelectMany,
      inputBox: !this._hideInput,
      progressBar: !this._hideInput || hasDescription,
      visibleCount: true,
      count: this.canSelectMany && !this._hideCountBadge,
      ok: this.ok === "default" ? this.canSelectMany : this.ok,
      list: true,
      message: !!this.validationMessage,
      customButton: this.customButton
    };
    this.ui.setVisibilities(visibilities);
    super.update();
    if (this.ui.inputBox.value !== this.value) {
      this.ui.inputBox.value = this.value;
    }
    if (this.valueSelectionUpdated) {
      this.valueSelectionUpdated = false;
      this.ui.inputBox.select(this._valueSelection && { start: this._valueSelection[0], end: this._valueSelection[1] });
    }
    if (this.ui.inputBox.placeholder !== (this.placeholder || "")) {
      this.ui.inputBox.placeholder = this.placeholder || "";
    }
    let ariaLabel = this.ariaLabel;
    if (!ariaLabel && visibilities.inputBox) {
      ariaLabel = this.placeholder || _QuickPick.DEFAULT_ARIA_LABEL;
      if (this.title) {
        ariaLabel += ` - ${this.title}`;
      }
    }
    if (this.ui.list.ariaLabel !== ariaLabel) {
      this.ui.list.ariaLabel = ariaLabel ?? null;
    }
    this.ui.list.matchOnDescription = this.matchOnDescription;
    this.ui.list.matchOnDetail = this.matchOnDetail;
    this.ui.list.matchOnLabel = this.matchOnLabel;
    this.ui.list.matchOnLabelMode = this.matchOnLabelMode;
    this.ui.list.sortByLabel = this.sortByLabel;
    if (this.itemsUpdated) {
      this.itemsUpdated = false;
      this._focusEventBufferer.bufferEvents(() => {
        this.ui.list.setElements(this.items);
        this.ui.list.shouldLoop = !this.canSelectMany;
        this.ui.list.filter(this.filterValue(this.ui.inputBox.value));
        switch (this._itemActivation) {
          case ItemActivation.NONE:
            this._itemActivation = ItemActivation.FIRST;
            break;
          case ItemActivation.SECOND:
            this.ui.list.focus(QuickPickFocus.Second);
            this._itemActivation = ItemActivation.FIRST;
            break;
          case ItemActivation.LAST:
            this.ui.list.focus(QuickPickFocus.Last);
            this._itemActivation = ItemActivation.FIRST;
            break;
          default:
            this.trySelectFirst();
            break;
        }
      });
    }
    if (this.ui.container.classList.contains("show-checkboxes") !== !!this.canSelectMany) {
      if (this.canSelectMany) {
        this.ui.list.clearFocus();
      } else {
        this.trySelectFirst();
      }
    }
    if (this.activeItemsUpdated) {
      this.activeItemsUpdated = false;
      this.activeItemsToConfirm = this._activeItems;
      this.ui.list.setFocusedElements(this.activeItems);
      if (this.activeItemsToConfirm === this._activeItems) {
        this.activeItemsToConfirm = null;
      }
    }
    if (this.selectedItemsUpdated) {
      this.selectedItemsUpdated = false;
      this.selectedItemsToConfirm = this._selectedItems;
      if (this.canSelectMany) {
        this.ui.list.setCheckedElements(this.selectedItems);
      } else {
        this.ui.list.setSelectedElements(this.selectedItems);
      }
      if (this.selectedItemsToConfirm === this._selectedItems) {
        this.selectedItemsToConfirm = null;
      }
    }
    this.ui.ok.label = this.okLabel || "";
    this.ui.customButton.label = this.customLabel || "";
    this.ui.customButton.element.title = this.customHover || "";
    if (!visibilities.inputBox) {
      this.ui.list.domFocus();
      if (this.canSelectMany) {
        this.ui.list.focus(QuickPickFocus.First);
      }
    }
    if (this.keepScrollPosition) {
      this.scrollTop = scrollTopBefore;
    }
  }
  focus(focus) {
    this.ui.list.focus(focus);
    if (this.canSelectMany) {
      this.ui.list.domFocus();
    }
  }
  accept(inBackground) {
    if (inBackground && !this._canAcceptInBackground) {
      return;
    }
    if (this.activeItems[0]) {
      this._selectedItems = [this.activeItems[0]];
      this.onDidChangeSelectionEmitter.fire(this.selectedItems);
      this.handleAccept(inBackground ?? false);
    }
  }
};
_QuickPick.DEFAULT_ARIA_LABEL = localize("quickInputBox.ariaLabel", "Type to narrow down results.");
let QuickPick = _QuickPick;
class InputBox extends QuickInput {
  constructor() {
    super(...arguments);
    this._value = "";
    this.valueSelectionUpdated = true;
    this._password = false;
    this.onDidValueChangeEmitter = this._register(new Emitter());
    this.onDidAcceptEmitter = this._register(new Emitter());
    this.type = QuickInputType.InputBox;
    this.onDidChangeValue = this.onDidValueChangeEmitter.event;
    this.onDidAccept = this.onDidAcceptEmitter.event;
  }
  get value() {
    return this._value;
  }
  set value(value) {
    this._value = value || "";
    this.update();
  }
  get valueSelection() {
    const selection = this.ui.inputBox.getSelection();
    if (!selection) {
      return void 0;
    }
    return [selection.start, selection.end];
  }
  set valueSelection(valueSelection) {
    this._valueSelection = valueSelection;
    this.valueSelectionUpdated = true;
    this.update();
  }
  get placeholder() {
    return this._placeholder;
  }
  set placeholder(placeholder) {
    this._placeholder = placeholder;
    this.update();
  }
  get password() {
    return this._password;
  }
  set password(password) {
    this._password = password;
    this.update();
  }
  get prompt() {
    return this._prompt;
  }
  set prompt(prompt) {
    this._prompt = prompt;
    this.noValidationMessage = prompt ? localize("inputModeEntryDescription", "{0} (Press 'Enter' to confirm or 'Escape' to cancel)", prompt) : QuickInput.noPromptMessage;
    this.update();
  }
  show() {
    if (!this.visible) {
      this.visibleDisposables.add(
        this.ui.inputBox.onDidChange((value) => {
          if (value === this.value) {
            return;
          }
          this._value = value;
          this.onDidValueChangeEmitter.fire(value);
        })
      );
      this.visibleDisposables.add(this.ui.onDidAccept(() => this.onDidAcceptEmitter.fire()));
      this.valueSelectionUpdated = true;
    }
    super.show();
  }
  update() {
    if (!this.visible) {
      return;
    }
    this.ui.container.classList.remove("hidden-input");
    const visibilities = {
      title: !!this.title || !!this.step || !!this.titleButtons.length,
      description: !!this.description || !!this.step,
      inputBox: true,
      message: true,
      progressBar: true
    };
    this.ui.setVisibilities(visibilities);
    super.update();
    if (this.ui.inputBox.value !== this.value) {
      this.ui.inputBox.value = this.value;
    }
    if (this.valueSelectionUpdated) {
      this.valueSelectionUpdated = false;
      this.ui.inputBox.select(this._valueSelection && { start: this._valueSelection[0], end: this._valueSelection[1] });
    }
    if (this.ui.inputBox.placeholder !== (this.placeholder || "")) {
      this.ui.inputBox.placeholder = this.placeholder || "";
    }
    if (this.ui.inputBox.password !== this.password) {
      this.ui.inputBox.password = this.password;
    }
  }
}
class QuickWidget extends QuickInput {
  constructor() {
    super(...arguments);
    this.type = QuickInputType.QuickWidget;
  }
  update() {
    if (!this.visible) {
      return;
    }
    const visibilities = {
      title: !!this.title || !!this.step || !!this.titleButtons.length,
      description: !!this.description || !!this.step
    };
    this.ui.setVisibilities(visibilities);
    super.update();
  }
}
let QuickInputHoverDelegate = class extends WorkbenchHoverDelegate {
  constructor(configurationService, hoverService) {
    super("element", void 0, (options) => this.getOverrideOptions(options), configurationService, hoverService);
  }
  getOverrideOptions(options) {
    const showHoverHint = (dom.isHTMLElement(options.content) ? options.content.textContent ?? "" : typeof options.content === "string" ? options.content : options.content.value).includes("\n");
    return {
      persistence: {
        hideOnKeyDown: false
      },
      appearance: {
        showHoverHint,
        skipFadeInAnimation: true
      }
    };
  }
};
QuickInputHoverDelegate = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IHoverService)
], QuickInputHoverDelegate);
export {
  EndOfQuickInputBoxContextKey,
  InQuickInputContextKey,
  InputBox,
  QuickInputAlignmentContextKey,
  QuickInputHoverDelegate,
  QuickInputTypeContextKey,
  QuickPick,
  QuickWidget,
  backButton,
  endOfQuickInputBoxContext,
  endOfQuickInputBoxContextKeyValue,
  inQuickInputContext,
  inQuickInputContextKeyValue,
  quickInputAlignmentContextKeyValue,
  quickInputTypeContextKeyValue
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvcXVpY2tJbnB1dC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IEJ1dHRvbiwgSUJ1dHRvblN0eWxlcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IENvdW50QmFkZ2UsIElDb3VudEJhZGdlU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvdW50QmFkZ2UvY291bnRCYWRnZS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSwgSUhvdmVyRGVsZWdhdGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGUuanMnO1xuaW1wb3J0IHsgSUlucHV0Qm94U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2lucHV0Ym94L2lucHV0Qm94LmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nTGFiZWxTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkva2V5YmluZGluZ0xhYmVsL2tleWJpbmRpbmdMYWJlbC5qcyc7XG5pbXBvcnQgeyBJTGlzdFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzQmFyU3R5bGVzLCBQcm9ncmVzc0JhciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9wcm9ncmVzc2Jhci9wcm9ncmVzc2Jhci5qcyc7XG5pbXBvcnQgeyBJVG9nZ2xlU3R5bGVzLCBUb2dnbGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgVGltZW91dFRpbWVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50LCBFdmVudEJ1ZmZlcmVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0lPUyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0ICcuL21lZGlhL3F1aWNrSW5wdXQuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElJbnB1dEJveCwgSUtleU1vZHMsIElRdWlja0lucHV0LCBJUXVpY2tJbnB1dEJ1dHRvbiwgSVF1aWNrSW5wdXRIaWRlRXZlbnQsIElRdWlja0lucHV0VG9nZ2xlLCBJUXVpY2tOYXZpZ2F0ZUNvbmZpZ3VyYXRpb24sIElRdWlja1BpY2ssIElRdWlja1BpY2tEaWRBY2NlcHRFdmVudCwgSVF1aWNrUGlja0l0ZW0sIElRdWlja1BpY2tJdGVtQnV0dG9uRXZlbnQsIElRdWlja1BpY2tTZXBhcmF0b3IsIElRdWlja1BpY2tTZXBhcmF0b3JCdXR0b25FdmVudCwgSVF1aWNrUGlja1dpbGxBY2NlcHRFdmVudCwgSVF1aWNrV2lkZ2V0LCBJdGVtQWN0aXZhdGlvbiwgTk9fS0VZX01PRFMsIFF1aWNrSW5wdXRCdXR0b25Mb2NhdGlvbiwgUXVpY2tJbnB1dEhpZGVSZWFzb24sIFF1aWNrSW5wdXRUeXBlLCBRdWlja1BpY2tGb2N1cyB9IGZyb20gJy4uL2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IFF1aWNrSW5wdXRCb3ggfSBmcm9tICcuL3F1aWNrSW5wdXRCb3guanMnO1xuaW1wb3J0IHsgcXVpY2tJbnB1dEJ1dHRvblRvQWN0aW9uLCByZW5kZXJRdWlja0lucHV0RGVzY3JpcHRpb24gfSBmcm9tICcuL3F1aWNrSW5wdXRVdGlscy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UsIFdvcmtiZW5jaEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IFF1aWNrSW5wdXRUcmVlIH0gZnJvbSAnLi9xdWlja0lucHV0VHJlZS5qcyc7XG5pbXBvcnQgdHlwZSB7IElIb3Zlck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcblxuZXhwb3J0IGNvbnN0IGluUXVpY2tJbnB1dENvbnRleHRLZXlWYWx1ZSA9ICdpblF1aWNrSW5wdXQnO1xuZXhwb3J0IGNvbnN0IEluUXVpY2tJbnB1dENvbnRleHRLZXkgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPihpblF1aWNrSW5wdXRDb250ZXh0S2V5VmFsdWUsIGZhbHNlLCBsb2NhbGl6ZSgnaW5RdWlja0lucHV0JywgXCJXaGV0aGVyIGtleWJvYXJkIGZvY3VzIGlzIGluc2lkZSB0aGUgcXVpY2sgaW5wdXQgY29udHJvbFwiKSk7XG5leHBvcnQgY29uc3QgaW5RdWlja0lucHV0Q29udGV4dCA9IENvbnRleHRLZXlFeHByLmhhcyhpblF1aWNrSW5wdXRDb250ZXh0S2V5VmFsdWUpO1xuXG5leHBvcnQgY29uc3QgcXVpY2tJbnB1dEFsaWdubWVudENvbnRleHRLZXlWYWx1ZSA9ICdxdWlja0lucHV0QWxpZ25tZW50JztcbmV4cG9ydCBjb25zdCBRdWlja0lucHV0QWxpZ25tZW50Q29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PCd0b3AnIHwgJ2NlbnRlcicgfCB1bmRlZmluZWQ+KHF1aWNrSW5wdXRBbGlnbm1lbnRDb250ZXh0S2V5VmFsdWUsICd0b3AnLCBsb2NhbGl6ZSgncXVpY2tJbnB1dEFsaWdubWVudCcsIFwiVGhlIGFsaWdubWVudCBvZiB0aGUgcXVpY2sgaW5wdXRcIikpO1xuXG5leHBvcnQgY29uc3QgcXVpY2tJbnB1dFR5cGVDb250ZXh0S2V5VmFsdWUgPSAncXVpY2tJbnB1dFR5cGUnO1xuZXhwb3J0IGNvbnN0IFF1aWNrSW5wdXRUeXBlQ29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PFF1aWNrSW5wdXRUeXBlPihxdWlja0lucHV0VHlwZUNvbnRleHRLZXlWYWx1ZSwgdW5kZWZpbmVkLCBsb2NhbGl6ZSgncXVpY2tJbnB1dFR5cGUnLCBcIlRoZSB0eXBlIG9mIHRoZSBjdXJyZW50bHkgdmlzaWJsZSBxdWljayBpbnB1dFwiKSk7XG5cbmV4cG9ydCBjb25zdCBlbmRPZlF1aWNrSW5wdXRCb3hDb250ZXh0S2V5VmFsdWUgPSAnY3Vyc29yQXRFbmRPZlF1aWNrSW5wdXRCb3gnO1xuZXhwb3J0IGNvbnN0IEVuZE9mUXVpY2tJbnB1dEJveENvbnRleHRLZXkgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPihlbmRPZlF1aWNrSW5wdXRCb3hDb250ZXh0S2V5VmFsdWUsIGZhbHNlLCBsb2NhbGl6ZSgnY3Vyc29yQXRFbmRPZlF1aWNrSW5wdXRCb3gnLCBcIldoZXRoZXIgdGhlIGN1cnNvciBpbiB0aGUgcXVpY2sgaW5wdXQgaXMgYXQgdGhlIGVuZCBvZiB0aGUgaW5wdXQgYm94XCIpKTtcbmV4cG9ydCBjb25zdCBlbmRPZlF1aWNrSW5wdXRCb3hDb250ZXh0ID0gQ29udGV4dEtleUV4cHIuaGFzKGVuZE9mUXVpY2tJbnB1dEJveENvbnRleHRLZXlWYWx1ZSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVF1aWNrSW5wdXRPcHRpb25zIHtcblx0aWRQcmVmaXg6IHN0cmluZztcblx0Y29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0aWdub3JlRm9jdXNPdXQoKTogYm9vbGVhbjtcblx0YmFja0tleWJpbmRpbmdMYWJlbCgpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHNldENvbnRleHRLZXkoaWQ/OiBzdHJpbmcpOiB2b2lkO1xuXHRsaW5rT3BlbmVyRGVsZWdhdGUoY29udGVudDogc3RyaW5nKTogdm9pZDtcblx0cmV0dXJuRm9jdXMoKTogdm9pZDtcblx0LyoqXG5cdCAqIEB0b2RvIFdpdGggSUhvdmVyIGluIHZzL2VkaXRvciwgY2FuIHdlIGRlcGVuZCBvbiB0aGUgc2VydmljZSBkaXJlY3RseVxuXHQgKiBpbnN0ZWFkIG9mIHBhc3NpbmcgaXQgdGhyb3VnaCBhIGhvdmVyIGRlbGVnYXRlP1xuXHQgKi9cblx0aG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cdHN0eWxlczogSVF1aWNrSW5wdXRTdHlsZXM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVF1aWNrSW5wdXRTdHlsZXMge1xuXHRyZWFkb25seSB3aWRnZXQ6IElRdWlja0lucHV0V2lkZ2V0U3R5bGVzO1xuXHRyZWFkb25seSBpbnB1dEJveDogSUlucHV0Qm94U3R5bGVzO1xuXHRyZWFkb25seSB0b2dnbGU6IElUb2dnbGVTdHlsZXM7XG5cdHJlYWRvbmx5IGNvdW50QmFkZ2U6IElDb3VudEJhZGdlU3R5bGVzO1xuXHRyZWFkb25seSBidXR0b246IElCdXR0b25TdHlsZXM7XG5cdHJlYWRvbmx5IHByb2dyZXNzQmFyOiBJUHJvZ3Jlc3NCYXJTdHlsZXM7XG5cdHJlYWRvbmx5IGtleWJpbmRpbmdMYWJlbDogSUtleWJpbmRpbmdMYWJlbFN0eWxlcztcblx0cmVhZG9ubHkgbGlzdDogSUxpc3RTdHlsZXM7XG5cdHJlYWRvbmx5IHBpY2tlckdyb3VwOiB7IHBpY2tlckdyb3VwQm9yZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7IHBpY2tlckdyb3VwRm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVF1aWNrSW5wdXRXaWRnZXRTdHlsZXMge1xuXHRyZWFkb25seSBxdWlja0lucHV0QmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBxdWlja0lucHV0Rm9yZWdyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBxdWlja0lucHV0VGl0bGVCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHdpZGdldEJvcmRlcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSB3aWRnZXRTaGFkb3c6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IHR5cGUgV3JpdGVhYmxlPFQ+ID0geyAtcmVhZG9ubHkgW1AgaW4ga2V5b2YgVF06IFRbUF0gfTtcblxuZXhwb3J0IGNvbnN0IGJhY2tCdXR0b24gPSB7XG5cdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24ucXVpY2tJbnB1dEJhY2spLFxuXHR0b29sdGlwOiBsb2NhbGl6ZSgncXVpY2tJbnB1dC5iYWNrJywgXCJCYWNrXCIpLFxuXHRoYW5kbGU6IC0xIC8vIFRPRE9cbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgUXVpY2tJbnB1dFVJIHtcblx0Y29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0c3R5bGVTaGVldDogSFRNTFN0eWxlRWxlbWVudDtcblx0bGVmdEFjdGlvbkJhcjogQWN0aW9uQmFyO1xuXHR0aXRsZUJhcjogSFRNTEVsZW1lbnQ7XG5cdHRpdGxlOiBIVE1MRWxlbWVudDtcblx0ZGVzY3JpcHRpb24xOiBIVE1MRWxlbWVudDtcblx0ZGVzY3JpcHRpb24yOiBIVE1MRWxlbWVudDtcblx0d2lkZ2V0OiBIVE1MRWxlbWVudDtcblx0cmlnaHRBY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0aW5saW5lQWN0aW9uQmFyOiBBY3Rpb25CYXI7XG5cdGNoZWNrQWxsOiBIVE1MSW5wdXRFbGVtZW50O1xuXHRpbnB1dENvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGZpbHRlckNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGlucHV0Qm94OiBRdWlja0lucHV0Qm94O1xuXHR2aXNpYmxlQ291bnRDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHR2aXNpYmxlQ291bnQ6IENvdW50QmFkZ2U7XG5cdGNvdW50Q29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0Y291bnQ6IENvdW50QmFkZ2U7XG5cdG9rQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0b2s6IEJ1dHRvbjtcblx0bWVzc2FnZTogSFRNTEVsZW1lbnQ7XG5cdGN1c3RvbUJ1dHRvbkNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGN1c3RvbUJ1dHRvbjogQnV0dG9uO1xuXHRwcm9ncmVzc0JhcjogUHJvZ3Jlc3NCYXI7XG5cdGxpc3Q6IFF1aWNrSW5wdXRUcmVlO1xuXHRvbkRpZEFjY2VwdDogRXZlbnQ8dm9pZD47XG5cdG9uRGlkQ3VzdG9tOiBFdmVudDx2b2lkPjtcblx0b25EaWRUcmlnZ2VyQnV0dG9uOiBFdmVudDxJUXVpY2tJbnB1dEJ1dHRvbj47XG5cdGlnbm9yZUZvY3VzT3V0OiBib29sZWFuO1xuXHRrZXlNb2RzOiBXcml0ZWFibGU8SUtleU1vZHM+O1xuXHRzaG93KGNvbnRyb2xsZXI6IFF1aWNrSW5wdXQpOiB2b2lkO1xuXHRzZXRWaXNpYmlsaXRpZXModmlzaWJpbGl0aWVzOiBWaXNpYmlsaXRpZXMpOiB2b2lkO1xuXHRzZXRFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkO1xuXHRzZXRDb250ZXh0S2V5KGNvbnRleHRLZXk/OiBzdHJpbmcpOiB2b2lkO1xuXHRsaW5rT3BlbmVyRGVsZWdhdGUoY29udGVudDogc3RyaW5nKTogdm9pZDtcblx0aGlkZSgpOiB2b2lkO1xufVxuXG5leHBvcnQgdHlwZSBWaXNpYmlsaXRpZXMgPSB7XG5cdHRpdGxlPzogYm9vbGVhbjtcblx0ZGVzY3JpcHRpb24/OiBib29sZWFuO1xuXHRjaGVja0FsbD86IGJvb2xlYW47XG5cdGlucHV0Qm94PzogYm9vbGVhbjtcblx0Y2hlY2tCb3g/OiBib29sZWFuO1xuXHR2aXNpYmxlQ291bnQ/OiBib29sZWFuO1xuXHRjb3VudD86IGJvb2xlYW47XG5cdG1lc3NhZ2U/OiBib29sZWFuO1xuXHRsaXN0PzogYm9vbGVhbjtcblx0b2s/OiBib29sZWFuO1xuXHRjdXN0b21CdXR0b24/OiBib29sZWFuO1xuXHRwcm9ncmVzc0Jhcj86IGJvb2xlYW47XG59O1xuXG5hYnN0cmFjdCBjbGFzcyBRdWlja0lucHV0IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElRdWlja0lucHV0IHtcblx0cHJvdGVjdGVkIHN0YXRpYyByZWFkb25seSBub1Byb21wdE1lc3NhZ2UgPSBsb2NhbGl6ZSgnaW5wdXRNb2RlRW50cnknLCBcIlByZXNzICdFbnRlcicgdG8gY29uZmlybSB5b3VyIGlucHV0IG9yICdFc2NhcGUnIHRvIGNhbmNlbFwiKTtcblxuXHRwcml2YXRlIF90aXRsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9kZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF93aWRnZXQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF93aWRnZXRVcGRhdGVkID0gZmFsc2U7XG5cdHByaXZhdGUgX3N0ZXBzOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3RvdGFsU3RlcHM6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIHZpc2libGUgPSBmYWxzZTtcblx0cHJpdmF0ZSBfZW5hYmxlZCA9IHRydWU7XG5cdHByaXZhdGUgX2NvbnRleHRLZXk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYnVzeSA9IGZhbHNlO1xuXHRwcml2YXRlIF9pZ25vcmVGb2N1c091dCA9IGZhbHNlO1xuXHRwcml2YXRlIF9sZWZ0QnV0dG9uczogSVF1aWNrSW5wdXRCdXR0b25bXSA9IFtdO1xuXHRwcml2YXRlIF9yaWdodEJ1dHRvbnM6IElRdWlja0lucHV0QnV0dG9uW10gPSBbXTtcblx0cHJpdmF0ZSBfaW5saW5lQnV0dG9uczogSVF1aWNrSW5wdXRCdXR0b25bXSA9IFtdO1xuXHRwcml2YXRlIGJ1dHRvbnNVcGRhdGVkID0gZmFsc2U7XG5cdHByaXZhdGUgX3RvZ2dsZXM6IElRdWlja0lucHV0VG9nZ2xlW10gPSBbXTtcblx0cHJpdmF0ZSB0b2dnbGVzVXBkYXRlZCA9IGZhbHNlO1xuXHRwcm90ZWN0ZWQgbm9WYWxpZGF0aW9uTWVzc2FnZSA9IFF1aWNrSW5wdXQubm9Qcm9tcHRNZXNzYWdlO1xuXHRwcml2YXRlIF92YWxpZGF0aW9uTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9sYXN0VmFsaWRhdGlvbk1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfc2V2ZXJpdHk6IFNldmVyaXR5ID0gU2V2ZXJpdHkuSWdub3JlO1xuXHRwcml2YXRlIF9sYXN0U2V2ZXJpdHk6IFNldmVyaXR5IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkVHJpZ2dlckJ1dHRvbkVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUXVpY2tJbnB1dEJ1dHRvbj4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRIaWRlRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElRdWlja0lucHV0SGlkZUV2ZW50PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbldpbGxIaWRlRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElRdWlja0lucHV0SGlkZUV2ZW50PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpc3Bvc2VFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IHZpc2libGVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0cHJpdmF0ZSBidXN5RGVsYXk6IFRpbWVvdXRUaW1lciB8IHVuZGVmaW5lZDtcblxuXHRhYnN0cmFjdCB0eXBlOiBRdWlja0lucHV0VHlwZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgdWk6IFF1aWNrSW5wdXRVSVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0Z2V0IHRpdGxlKCkge1xuXHRcdHJldHVybiB0aGlzLl90aXRsZTtcblx0fVxuXG5cdHNldCB0aXRsZSh0aXRsZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fdGl0bGUgPSB0aXRsZTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IGRlc2NyaXB0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9kZXNjcmlwdGlvbjtcblx0fVxuXG5cdHNldCBkZXNjcmlwdGlvbihkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IHdpZGdldCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fd2lkZ2V0O1xuXHR9XG5cblx0c2V0IHdpZGdldCh3aWRnZXQ6IHVua25vd24gfCB1bmRlZmluZWQpIHtcblx0XHRpZiAoIShkb20uaXNIVE1MRWxlbWVudCh3aWRnZXQpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fd2lkZ2V0ICE9PSB3aWRnZXQpIHtcblx0XHRcdHRoaXMuX3dpZGdldCA9IHdpZGdldDtcblx0XHRcdHRoaXMuX3dpZGdldFVwZGF0ZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgc3RlcCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RlcHM7XG5cdH1cblxuXHRzZXQgc3RlcChzdGVwOiBudW1iZXIgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9zdGVwcyA9IHN0ZXA7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCB0b3RhbFN0ZXBzKCkge1xuXHRcdHJldHVybiB0aGlzLl90b3RhbFN0ZXBzO1xuXHR9XG5cblx0c2V0IHRvdGFsU3RlcHModG90YWxTdGVwczogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fdG90YWxTdGVwcyA9IHRvdGFsU3RlcHM7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCBlbmFibGVkKCkge1xuXHRcdHJldHVybiB0aGlzLl9lbmFibGVkO1xuXHR9XG5cblx0c2V0IGVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikge1xuXHRcdHRoaXMuX2VuYWJsZWQgPSBlbmFibGVkO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgY29udGV4dEtleSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udGV4dEtleTtcblx0fVxuXG5cdHNldCBjb250ZXh0S2V5KGNvbnRleHRLZXk6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2NvbnRleHRLZXkgPSBjb250ZXh0S2V5O1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgYnVzeSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fYnVzeTtcblx0fVxuXG5cdHNldCBidXN5KGJ1c3k6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9idXN5ID0gYnVzeTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IGlnbm9yZUZvY3VzT3V0KCkge1xuXHRcdHJldHVybiB0aGlzLl9pZ25vcmVGb2N1c091dDtcblx0fVxuXG5cdHNldCBpZ25vcmVGb2N1c091dChpZ25vcmVGb2N1c091dDogYm9vbGVhbikge1xuXHRcdGNvbnN0IHNob3VsZFVwZGF0ZSA9IHRoaXMuX2lnbm9yZUZvY3VzT3V0ICE9PSBpZ25vcmVGb2N1c091dCAmJiAhaXNJT1M7XG5cdFx0dGhpcy5faWdub3JlRm9jdXNPdXQgPSBpZ25vcmVGb2N1c091dCAmJiAhaXNJT1M7XG5cdFx0aWYgKHNob3VsZFVwZGF0ZSkge1xuXHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IHRpdGxlQnV0dG9ucygpIHtcblx0XHRyZXR1cm4gdGhpcy5fbGVmdEJ1dHRvbnMubGVuZ3RoXG5cdFx0XHQ/IFsuLi50aGlzLl9sZWZ0QnV0dG9ucywgdGhpcy5fcmlnaHRCdXR0b25zXVxuXHRcdFx0OiB0aGlzLl9yaWdodEJ1dHRvbnM7XG5cdH1cblxuXHRnZXQgYnV0dG9ucygpIHtcblx0XHRyZXR1cm4gW1xuXHRcdFx0Li4udGhpcy5fbGVmdEJ1dHRvbnMsXG5cdFx0XHQuLi50aGlzLl9yaWdodEJ1dHRvbnMsXG5cdFx0XHQuLi50aGlzLl9pbmxpbmVCdXR0b25zXG5cdFx0XTtcblx0fVxuXG5cdHNldCBidXR0b25zKGJ1dHRvbnM6IElRdWlja0lucHV0QnV0dG9uW10pIHtcblx0XHR0aGlzLl9sZWZ0QnV0dG9ucyA9IGJ1dHRvbnMuZmlsdGVyKGIgPT4gYiA9PT0gYmFja0J1dHRvbik7XG5cdFx0dGhpcy5fcmlnaHRCdXR0b25zID0gYnV0dG9ucy5maWx0ZXIoYiA9PiBiICE9PSBiYWNrQnV0dG9uICYmIGIubG9jYXRpb24gIT09IFF1aWNrSW5wdXRCdXR0b25Mb2NhdGlvbi5JbmxpbmUpO1xuXHRcdHRoaXMuX2lubGluZUJ1dHRvbnMgPSBidXR0b25zLmZpbHRlcihiID0+IGIubG9jYXRpb24gPT09IFF1aWNrSW5wdXRCdXR0b25Mb2NhdGlvbi5JbmxpbmUpO1xuXHRcdHRoaXMuYnV0dG9uc1VwZGF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgdG9nZ2xlcygpIHtcblx0XHRyZXR1cm4gdGhpcy5fdG9nZ2xlcztcblx0fVxuXG5cdHNldCB0b2dnbGVzKHRvZ2dsZXM6IElRdWlja0lucHV0VG9nZ2xlW10pIHtcblx0XHR0aGlzLl90b2dnbGVzID0gdG9nZ2xlcyA/PyBbXTtcblx0XHR0aGlzLnRvZ2dsZXNVcGRhdGVkID0gdHJ1ZTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IHZhbGlkYXRpb25NZXNzYWdlKCkge1xuXHRcdHJldHVybiB0aGlzLl92YWxpZGF0aW9uTWVzc2FnZTtcblx0fVxuXG5cdHNldCB2YWxpZGF0aW9uTWVzc2FnZSh2YWxpZGF0aW9uTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fdmFsaWRhdGlvbk1lc3NhZ2UgPSB2YWxpZGF0aW9uTWVzc2FnZTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IHNldmVyaXR5KCkge1xuXHRcdHJldHVybiB0aGlzLl9zZXZlcml0eTtcblx0fVxuXG5cdHNldCBzZXZlcml0eShzZXZlcml0eTogU2V2ZXJpdHkpIHtcblx0XHR0aGlzLl9zZXZlcml0eSA9IHNldmVyaXR5O1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRyZWFkb25seSBvbkRpZFRyaWdnZXJCdXR0b24gPSB0aGlzLm9uRGlkVHJpZ2dlckJ1dHRvbkVtaXR0ZXIuZXZlbnQ7XG5cblx0c2hvdygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy52aXNpYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMudmlzaWJsZURpc3Bvc2FibGVzLmFkZChcblx0XHRcdHRoaXMudWkub25EaWRUcmlnZ2VyQnV0dG9uKGJ1dHRvbiA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLmJ1dHRvbnMuaW5kZXhPZihidXR0b24pICE9PSAtMSkge1xuXHRcdFx0XHRcdHRoaXMub25EaWRUcmlnZ2VyQnV0dG9uRW1pdHRlci5maXJlKGJ1dHRvbik7XG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXHRcdCk7XG5cdFx0dGhpcy51aS5zaG93KHRoaXMpO1xuXG5cdFx0Ly8gdXBkYXRlIHByb3BlcnRpZXMgaW4gdGhlIGNvbnRyb2xsZXIgdGhhdCBnZXQgcmVzZXQgaW4gdGhlIHVpLnNob3coKSBjYWxsXG5cdFx0dGhpcy52aXNpYmxlID0gdHJ1ZTtcblx0XHQvLyBUaGlzIGVuc3VyZXMgdGhlIG1lc3NhZ2UvcHJvbXB0IGdldHMgcmVuZGVyZWRcblx0XHR0aGlzLl9sYXN0VmFsaWRhdGlvbk1lc3NhZ2UgPSB1bmRlZmluZWQ7XG5cdFx0Ly8gVGhpcyBlbnN1cmVzIHRoZSBpbnB1dCBib3ggaGFzIHRoZSByaWdodCBzZXZlcml0eSBhcHBsaWVkXG5cdFx0dGhpcy5fbGFzdFNldmVyaXR5ID0gdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLmJ1dHRvbnMubGVuZ3RoKSB7XG5cdFx0XHQvLyBpZiB0aGVyZSBhcmUgYnV0dG9ucywgdGhlIHVpLnNob3coKSBjbGVhcnMgdGhlbSBvdXQgb2YgdGhlIFVJIHNvIHdlIHNob3VsZFxuXHRcdFx0Ly8gcmVyZW5kZXIgdGhlbS5cblx0XHRcdHRoaXMuYnV0dG9uc1VwZGF0ZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAodGhpcy50b2dnbGVzLmxlbmd0aCkge1xuXHRcdFx0Ly8gaWYgdGhlcmUgYXJlIHRvZ2dsZXMsIHRoZSB1aS5zaG93KCkgY2xlYXJzIHRoZW0gb3V0IG9mIHRoZSBVSSBzbyB3ZSBzaG91bGRcblx0XHRcdC8vIHJlcmVuZGVyIHRoZW0uXG5cdFx0XHR0aGlzLnRvZ2dsZXNVcGRhdGVkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0aGlkZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnVpLmhpZGUoKTtcblx0fVxuXG5cdGRpZEhpZGUocmVhc29uID0gUXVpY2tJbnB1dEhpZGVSZWFzb24uT3RoZXIpOiB2b2lkIHtcblx0XHR0aGlzLnZpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLnZpc2libGVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMub25EaWRIaWRlRW1pdHRlci5maXJlKHsgcmVhc29uIH0pO1xuXHR9XG5cblx0cmVhZG9ubHkgb25EaWRIaWRlID0gdGhpcy5vbkRpZEhpZGVFbWl0dGVyLmV2ZW50O1xuXG5cdHdpbGxIaWRlKHJlYXNvbiA9IFF1aWNrSW5wdXRIaWRlUmVhc29uLk90aGVyKTogdm9pZCB7XG5cdFx0dGhpcy5vbldpbGxIaWRlRW1pdHRlci5maXJlKHsgcmVhc29uIH0pO1xuXHR9XG5cdHJlYWRvbmx5IG9uV2lsbEhpZGUgPSB0aGlzLm9uV2lsbEhpZGVFbWl0dGVyLmV2ZW50O1xuXG5cdHByb3RlY3RlZCB1cGRhdGUoKSB7XG5cdFx0aWYgKCF0aGlzLnZpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgdGl0bGUgPSB0aGlzLmdldFRpdGxlKCk7XG5cdFx0aWYgKHRpdGxlICYmIHRoaXMudWkudGl0bGUudGV4dENvbnRlbnQgIT09IHRpdGxlKSB7XG5cdFx0XHR0aGlzLnVpLnRpdGxlLnRleHRDb250ZW50ID0gdGl0bGU7XG5cdFx0fSBlbHNlIGlmICghdGl0bGUgJiYgdGhpcy51aS50aXRsZS5pbm5lckhUTUwgIT09ICcmbmJzcDsnKSB7XG5cdFx0XHR0aGlzLnVpLnRpdGxlLmlubmVyVGV4dCA9ICdcXHUwMGEwJztcblx0XHR9XG5cdFx0Y29uc3QgZGVzY3JpcHRpb24gPSB0aGlzLmdldERlc2NyaXB0aW9uKCk7XG5cdFx0aWYgKHRoaXMudWkuZGVzY3JpcHRpb24xLnRleHRDb250ZW50ICE9PSBkZXNjcmlwdGlvbikge1xuXHRcdFx0dGhpcy51aS5kZXNjcmlwdGlvbjEudGV4dENvbnRlbnQgPSBkZXNjcmlwdGlvbjtcblx0XHR9XG5cdFx0aWYgKHRoaXMudWkuZGVzY3JpcHRpb24yLnRleHRDb250ZW50ICE9PSBkZXNjcmlwdGlvbikge1xuXHRcdFx0dGhpcy51aS5kZXNjcmlwdGlvbjIudGV4dENvbnRlbnQgPSBkZXNjcmlwdGlvbjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3dpZGdldFVwZGF0ZWQpIHtcblx0XHRcdHRoaXMuX3dpZGdldFVwZGF0ZWQgPSBmYWxzZTtcblx0XHRcdGlmICh0aGlzLl93aWRnZXQpIHtcblx0XHRcdFx0ZG9tLnJlc2V0KHRoaXMudWkud2lkZ2V0LCB0aGlzLl93aWRnZXQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZG9tLnJlc2V0KHRoaXMudWkud2lkZ2V0KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHRoaXMuYnVzeSAmJiAhdGhpcy5idXN5RGVsYXkpIHtcblx0XHRcdHRoaXMuYnVzeURlbGF5ID0gbmV3IFRpbWVvdXRUaW1lcigpO1xuXHRcdFx0dGhpcy5idXN5RGVsYXkuc2V0SWZOb3RTZXQoKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy52aXNpYmxlKSB7XG5cdFx0XHRcdFx0dGhpcy51aS5wcm9ncmVzc0Jhci5pbmZpbml0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCA4MDApO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuYnVzeSAmJiB0aGlzLmJ1c3lEZWxheSkge1xuXHRcdFx0dGhpcy51aS5wcm9ncmVzc0Jhci5zdG9wKCk7XG5cdFx0XHR0aGlzLmJ1c3lEZWxheS5jYW5jZWwoKTtcblx0XHRcdHRoaXMuYnVzeURlbGF5ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAodGhpcy5idXR0b25zVXBkYXRlZCkge1xuXHRcdFx0dGhpcy5idXR0b25zVXBkYXRlZCA9IGZhbHNlO1xuXHRcdFx0dGhpcy51aS5sZWZ0QWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0XHRjb25zdCBsZWZ0QnV0dG9ucyA9IHRoaXMuX2xlZnRCdXR0b25zXG5cdFx0XHRcdC5tYXAoKGJ1dHRvbiwgaW5kZXgpID0+IHF1aWNrSW5wdXRCdXR0b25Ub0FjdGlvbihcblx0XHRcdFx0XHRidXR0b24sXG5cdFx0XHRcdFx0YGlkLSR7aW5kZXh9YCxcblx0XHRcdFx0XHRhc3luYyAoKSA9PiB0aGlzLm9uRGlkVHJpZ2dlckJ1dHRvbkVtaXR0ZXIuZmlyZShidXR0b24pXG5cdFx0XHRcdCkpO1xuXHRcdFx0dGhpcy51aS5sZWZ0QWN0aW9uQmFyLnB1c2gobGVmdEJ1dHRvbnMsIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHRcdFx0dGhpcy51aS5yaWdodEFjdGlvbkJhci5jbGVhcigpO1xuXHRcdFx0Y29uc3QgcmlnaHRCdXR0b25zID0gdGhpcy5fcmlnaHRCdXR0b25zXG5cdFx0XHRcdC5tYXAoKGJ1dHRvbiwgaW5kZXgpID0+IHF1aWNrSW5wdXRCdXR0b25Ub0FjdGlvbihcblx0XHRcdFx0XHRidXR0b24sXG5cdFx0XHRcdFx0YGlkLSR7aW5kZXh9YCxcblx0XHRcdFx0XHRhc3luYyAoKSA9PiB0aGlzLm9uRGlkVHJpZ2dlckJ1dHRvbkVtaXR0ZXIuZmlyZShidXR0b24pXG5cdFx0XHRcdCkpO1xuXHRcdFx0dGhpcy51aS5yaWdodEFjdGlvbkJhci5wdXNoKHJpZ2h0QnV0dG9ucywgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0XHR0aGlzLnVpLmlubGluZUFjdGlvbkJhci5jbGVhcigpO1xuXHRcdFx0Y29uc3QgaW5saW5lQnV0dG9ucyA9IHRoaXMuX2lubGluZUJ1dHRvbnNcblx0XHRcdFx0Lm1hcCgoYnV0dG9uLCBpbmRleCkgPT4gcXVpY2tJbnB1dEJ1dHRvblRvQWN0aW9uKFxuXHRcdFx0XHRcdGJ1dHRvbixcblx0XHRcdFx0XHRgaWQtJHtpbmRleH1gLFxuXHRcdFx0XHRcdGFzeW5jICgpID0+IHRoaXMub25EaWRUcmlnZ2VyQnV0dG9uRW1pdHRlci5maXJlKGJ1dHRvbilcblx0XHRcdFx0KSk7XG5cdFx0XHR0aGlzLnVpLmlubGluZUFjdGlvbkJhci5wdXNoKGlubGluZUJ1dHRvbnMsIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHRcdH1cblx0XHRpZiAodGhpcy50b2dnbGVzVXBkYXRlZCkge1xuXHRcdFx0dGhpcy50b2dnbGVzVXBkYXRlZCA9IGZhbHNlO1xuXHRcdFx0Ly8gSEFDSzogRmlsdGVyIG91dCB0b2dnbGVzIGhlcmUgdGhhdCBhcmUgbm90IGNvbmNyZXRlIFRvZ2dsZSBvYmplY3RzLiBUaGlzIGlzIHRvIHdvcmthcm91bmRcblx0XHRcdC8vIGEgbGF5ZXJpbmcgaXNzdWUgYXMgcXVpY2sgaW5wdXQncyBpbnRlcmZhY2UgaXMgaW4gY29tbW9uIGJ1dCBUb2dnbGUgaXMgaW4gYnJvd3NlciBhbmRcblx0XHRcdC8vIGl0IHJlcXVpcmVzIGEgSFRNTEVsZW1lbnQgb24gaXRzIGludGVyZmFjZVxuXHRcdFx0Y29uc3QgY29uY3JldGVUb2dnbGVzID0gdGhpcy50b2dnbGVzPy5maWx0ZXIob3B0cyA9PiBvcHRzIGluc3RhbmNlb2YgVG9nZ2xlKSBhcyBUb2dnbGVbXSA/PyBbXTtcblx0XHRcdHRoaXMudWkuaW5wdXRCb3gudG9nZ2xlcyA9IGNvbmNyZXRlVG9nZ2xlcztcblx0XHR9XG5cdFx0dGhpcy51aS5pZ25vcmVGb2N1c091dCA9IHRoaXMuaWdub3JlRm9jdXNPdXQ7XG5cdFx0dGhpcy51aS5zZXRFbmFibGVkKHRoaXMuZW5hYmxlZCk7XG5cdFx0dGhpcy51aS5zZXRDb250ZXh0S2V5KHRoaXMuY29udGV4dEtleSk7XG5cblx0XHRjb25zdCB2YWxpZGF0aW9uTWVzc2FnZSA9IHRoaXMudmFsaWRhdGlvbk1lc3NhZ2UgfHwgdGhpcy5ub1ZhbGlkYXRpb25NZXNzYWdlO1xuXHRcdGlmICh0aGlzLl9sYXN0VmFsaWRhdGlvbk1lc3NhZ2UgIT09IHZhbGlkYXRpb25NZXNzYWdlKSB7XG5cdFx0XHR0aGlzLl9sYXN0VmFsaWRhdGlvbk1lc3NhZ2UgPSB2YWxpZGF0aW9uTWVzc2FnZTtcblx0XHRcdGRvbS5yZXNldCh0aGlzLnVpLm1lc3NhZ2UpO1xuXHRcdFx0cmVuZGVyUXVpY2tJbnB1dERlc2NyaXB0aW9uKHZhbGlkYXRpb25NZXNzYWdlLCB0aGlzLnVpLm1lc3NhZ2UsIHtcblx0XHRcdFx0Y2FsbGJhY2s6IChjb250ZW50KSA9PiB7XG5cdFx0XHRcdFx0dGhpcy51aS5saW5rT3BlbmVyRGVsZWdhdGUoY29udGVudCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRpc3Bvc2FibGVzOiB0aGlzLnZpc2libGVEaXNwb3NhYmxlcyxcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fbGFzdFNldmVyaXR5ICE9PSB0aGlzLnNldmVyaXR5KSB7XG5cdFx0XHR0aGlzLl9sYXN0U2V2ZXJpdHkgPSB0aGlzLnNldmVyaXR5O1xuXHRcdFx0dGhpcy5zaG93TWVzc2FnZURlY29yYXRpb24odGhpcy5zZXZlcml0eSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRUaXRsZSgpIHtcblx0XHRpZiAodGhpcy50aXRsZSAmJiB0aGlzLnN0ZXApIHtcblx0XHRcdHJldHVybiBgJHt0aGlzLnRpdGxlfSAoJHt0aGlzLmdldFN0ZXBzKCl9KWA7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnRpdGxlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50aXRsZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuc3RlcCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0U3RlcHMoKTtcblx0XHR9XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREZXNjcmlwdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5kZXNjcmlwdGlvbiB8fCAnJztcblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RlcHMoKSB7XG5cdFx0aWYgKHRoaXMuc3RlcCAmJiB0aGlzLnRvdGFsU3RlcHMpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgncXVpY2tJbnB1dC5zdGVwcycsIFwiezB9L3sxfVwiLCB0aGlzLnN0ZXAsIHRoaXMudG90YWxTdGVwcyk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnN0ZXApIHtcblx0XHRcdHJldHVybiBTdHJpbmcodGhpcy5zdGVwKTtcblx0XHR9XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHJvdGVjdGVkIHNob3dNZXNzYWdlRGVjb3JhdGlvbihzZXZlcml0eTogU2V2ZXJpdHkpIHtcblx0XHR0aGlzLnVpLmlucHV0Qm94LnNob3dEZWNvcmF0aW9uKHNldmVyaXR5KTtcblx0XHRpZiAoc2V2ZXJpdHkgIT09IFNldmVyaXR5Lklnbm9yZSkge1xuXHRcdFx0Y29uc3Qgc3R5bGVzID0gdGhpcy51aS5pbnB1dEJveC5zdHlsZXNGb3JUeXBlKHNldmVyaXR5KTtcblx0XHRcdHRoaXMudWkubWVzc2FnZS5zdHlsZS5jb2xvciA9IHN0eWxlcy5mb3JlZ3JvdW5kID8gYCR7c3R5bGVzLmZvcmVncm91bmR9YCA6ICcnO1xuXHRcdFx0dGhpcy51aS5tZXNzYWdlLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHN0eWxlcy5iYWNrZ3JvdW5kID8gYCR7c3R5bGVzLmJhY2tncm91bmR9YCA6ICcnO1xuXHRcdFx0dGhpcy51aS5tZXNzYWdlLnN0eWxlLmJvcmRlciA9IHN0eWxlcy5ib3JkZXIgPyBgMXB4IHNvbGlkICR7c3R5bGVzLmJvcmRlcn1gIDogJyc7XG5cdFx0XHR0aGlzLnVpLm1lc3NhZ2Uuc3R5bGUubWFyZ2luQm90dG9tID0gJy0ycHgnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnVpLm1lc3NhZ2Uuc3R5bGUuY29sb3IgPSAnJztcblx0XHRcdHRoaXMudWkubWVzc2FnZS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJztcblx0XHRcdHRoaXMudWkubWVzc2FnZS5zdHlsZS5ib3JkZXIgPSAnJztcblx0XHRcdHRoaXMudWkubWVzc2FnZS5zdHlsZS5tYXJnaW5Cb3R0b20gPSAnJztcblx0XHR9XG5cdH1cblxuXHRyZWFkb25seSBvbkRpc3Bvc2UgPSB0aGlzLm9uRGlzcG9zZUVtaXR0ZXIuZXZlbnQ7XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmhpZGUoKTtcblx0XHR0aGlzLm9uRGlzcG9zZUVtaXR0ZXIuZmlyZSgpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBRdWlja1BpY2s8VCBleHRlbmRzIElRdWlja1BpY2tJdGVtLCBPIGV4dGVuZHMgeyB1c2VTZXBhcmF0b3JzOiBib29sZWFuIH0gPSB7IHVzZVNlcGFyYXRvcnM6IGZhbHNlIH0+IGV4dGVuZHMgUXVpY2tJbnB1dCBpbXBsZW1lbnRzIElRdWlja1BpY2s8VCwgTz4ge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfQVJJQV9MQUJFTCA9IGxvY2FsaXplKCdxdWlja0lucHV0Qm94LmFyaWFMYWJlbCcsIFwiVHlwZSB0byBuYXJyb3cgZG93biByZXN1bHRzLlwiKTtcblxuXHRwcml2YXRlIF92YWx1ZSA9ICcnO1xuXHRwcml2YXRlIF9hcmlhTGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcGxhY2Vob2xkZXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZENoYW5nZVZhbHVlRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25XaWxsQWNjZXB0RW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElRdWlja1BpY2tXaWxsQWNjZXB0RXZlbnQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkQWNjZXB0RW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElRdWlja1BpY2tEaWRBY2NlcHRFdmVudD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRDdXN0b21FbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHByaXZhdGUgX2l0ZW1zOiBPIGV4dGVuZHMgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0gPyBBcnJheTxUIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4gOiBBcnJheTxUPiA9IFtdO1xuXHRwcml2YXRlIGl0ZW1zVXBkYXRlZCA9IGZhbHNlO1xuXHRwcml2YXRlIF9jYW5TZWxlY3RNYW55ID0gZmFsc2U7XG5cdHByaXZhdGUgX2NhbkFjY2VwdEluQmFja2dyb3VuZCA9IGZhbHNlO1xuXHRwcml2YXRlIF9tYXRjaE9uRGVzY3JpcHRpb24gPSBmYWxzZTtcblx0cHJpdmF0ZSBfbWF0Y2hPbkRldGFpbCA9IGZhbHNlO1xuXHRwcml2YXRlIF9tYXRjaE9uTGFiZWwgPSB0cnVlO1xuXHRwcml2YXRlIF9tYXRjaE9uTGFiZWxNb2RlOiAnZnV6enknIHwgJ2NvbnRpZ3VvdXMnID0gJ2Z1enp5Jztcblx0cHJpdmF0ZSBfc29ydEJ5TGFiZWwgPSB0cnVlO1xuXHRwcml2YXRlIF9rZWVwU2Nyb2xsUG9zaXRpb24gPSBmYWxzZTtcblx0cHJpdmF0ZSBfaXRlbUFjdGl2YXRpb24gPSBJdGVtQWN0aXZhdGlvbi5GSVJTVDtcblx0cHJpdmF0ZSBfYWN0aXZlSXRlbXM6IFRbXSA9IFtdO1xuXHRwcml2YXRlIGFjdGl2ZUl0ZW1zVXBkYXRlZCA9IGZhbHNlO1xuXHRwcml2YXRlIGFjdGl2ZUl0ZW1zVG9Db25maXJtOiBUW10gfCBudWxsID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VFtdPigpKTtcblx0cHJpdmF0ZSBfc2VsZWN0ZWRJdGVtczogVFtdID0gW107XG5cdHByaXZhdGUgc2VsZWN0ZWRJdGVtc1VwZGF0ZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBzZWxlY3RlZEl0ZW1zVG9Db25maXJtOiBUW10gfCBudWxsID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRDaGFuZ2VTZWxlY3Rpb25FbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VFtdPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZFRyaWdnZXJJdGVtQnV0dG9uRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElRdWlja1BpY2tJdGVtQnV0dG9uRXZlbnQ8VD4+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkVHJpZ2dlclNlcGFyYXRvckJ1dHRvbkVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUXVpY2tQaWNrU2VwYXJhdG9yQnV0dG9uRXZlbnQ+KCkpO1xuXHRwcml2YXRlIF92YWx1ZVNlbGVjdGlvbjogUmVhZG9ubHk8W251bWJlciwgbnVtYmVyXT4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdmFsdWVTZWxlY3Rpb25VcGRhdGVkID0gdHJ1ZTtcblx0cHJpdmF0ZSBfb2s6IGJvb2xlYW4gfCAnZGVmYXVsdCcgPSAnZGVmYXVsdCc7XG5cdHByaXZhdGUgX29rTGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY3VzdG9tQnV0dG9uID0gZmFsc2U7XG5cdHByaXZhdGUgX2N1c3RvbUJ1dHRvbkxhYmVsOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2N1c3RvbUJ1dHRvbkhvdmVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3F1aWNrTmF2aWdhdGU6IElRdWlja05hdmlnYXRlQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfaGlkZUlucHV0OiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9oaWRlQ291bnRCYWRnZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfaGlkZUNoZWNrQWxsOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9mb2N1c0V2ZW50QnVmZmVyZXIgPSBuZXcgRXZlbnRCdWZmZXJlcigpO1xuXG5cdHJlYWRvbmx5IHR5cGUgPSBRdWlja0lucHV0VHlwZS5RdWlja1BpY2s7XG5cblx0Z2V0IHF1aWNrTmF2aWdhdGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3F1aWNrTmF2aWdhdGU7XG5cdH1cblxuXHRzZXQgcXVpY2tOYXZpZ2F0ZShxdWlja05hdmlnYXRlOiBJUXVpY2tOYXZpZ2F0ZUNvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9xdWlja05hdmlnYXRlID0gcXVpY2tOYXZpZ2F0ZTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IHZhbHVlKCkge1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZTtcblx0fVxuXG5cdHNldCB2YWx1ZSh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5kb1NldFZhbHVlKHZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgZG9TZXRWYWx1ZSh2YWx1ZTogc3RyaW5nLCBza2lwVXBkYXRlPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl92YWx1ZSAhPT0gdmFsdWUpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHRpZiAoIXNraXBVcGRhdGUpIHtcblx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLnZpc2libGUpIHtcblx0XHRcdFx0Y29uc3QgZGlkRmlsdGVyID0gdGhpcy51aS5saXN0LmZpbHRlcih0aGlzLmZpbHRlclZhbHVlKHRoaXMuX3ZhbHVlKSk7XG5cdFx0XHRcdGlmIChkaWRGaWx0ZXIpIHtcblx0XHRcdFx0XHR0aGlzLnRyeVNlbGVjdEZpcnN0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMub25EaWRDaGFuZ2VWYWx1ZUVtaXR0ZXIuZmlyZSh0aGlzLl92YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0ZmlsdGVyVmFsdWUgPSAodmFsdWU6IHN0cmluZykgPT4gdmFsdWU7XG5cblx0c2V0IGFyaWFMYWJlbChhcmlhTGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2FyaWFMYWJlbCA9IGFyaWFMYWJlbDtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IGFyaWFMYWJlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fYXJpYUxhYmVsO1xuXHR9XG5cblx0Z2V0IHBsYWNlaG9sZGVyKCkge1xuXHRcdHJldHVybiB0aGlzLl9wbGFjZWhvbGRlcjtcblx0fVxuXG5cdHNldCBwbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fcGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0b25EaWRDaGFuZ2VWYWx1ZSA9IHRoaXMub25EaWRDaGFuZ2VWYWx1ZUVtaXR0ZXIuZXZlbnQ7XG5cblx0b25XaWxsQWNjZXB0ID0gdGhpcy5vbldpbGxBY2NlcHRFbWl0dGVyLmV2ZW50O1xuXHRvbkRpZEFjY2VwdCA9IHRoaXMub25EaWRBY2NlcHRFbWl0dGVyLmV2ZW50O1xuXG5cdG9uRGlkQ3VzdG9tID0gdGhpcy5vbkRpZEN1c3RvbUVtaXR0ZXIuZXZlbnQ7XG5cblx0Z2V0IGl0ZW1zKCkge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtcztcblx0fVxuXG5cdGdldCBzY3JvbGxUb3AoKSB7XG5cdFx0cmV0dXJuIHRoaXMudWkubGlzdC5zY3JvbGxUb3A7XG5cdH1cblxuXHRwcml2YXRlIHNldCBzY3JvbGxUb3Aoc2Nyb2xsVG9wOiBudW1iZXIpIHtcblx0XHR0aGlzLnVpLmxpc3Quc2Nyb2xsVG9wID0gc2Nyb2xsVG9wO1xuXHR9XG5cblx0c2V0IGl0ZW1zKGl0ZW1zOiBPIGV4dGVuZHMgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0gPyBBcnJheTxUIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4gOiBBcnJheTxUPikge1xuXHRcdHRoaXMuX2l0ZW1zID0gaXRlbXM7XG5cdFx0dGhpcy5pdGVtc1VwZGF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgY2FuU2VsZWN0TWFueSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fY2FuU2VsZWN0TWFueTtcblx0fVxuXG5cdHNldCBjYW5TZWxlY3RNYW55KGNhblNlbGVjdE1hbnk6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9jYW5TZWxlY3RNYW55ID0gY2FuU2VsZWN0TWFueTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IGNhbkFjY2VwdEluQmFja2dyb3VuZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fY2FuQWNjZXB0SW5CYWNrZ3JvdW5kO1xuXHR9XG5cblx0c2V0IGNhbkFjY2VwdEluQmFja2dyb3VuZChjYW5BY2NlcHRJbkJhY2tncm91bmQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9jYW5BY2NlcHRJbkJhY2tncm91bmQgPSBjYW5BY2NlcHRJbkJhY2tncm91bmQ7XG5cdH1cblxuXHRnZXQgbWF0Y2hPbkRlc2NyaXB0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9tYXRjaE9uRGVzY3JpcHRpb247XG5cdH1cblxuXHRzZXQgbWF0Y2hPbkRlc2NyaXB0aW9uKG1hdGNoT25EZXNjcmlwdGlvbjogYm9vbGVhbikge1xuXHRcdHRoaXMuX21hdGNoT25EZXNjcmlwdGlvbiA9IG1hdGNoT25EZXNjcmlwdGlvbjtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IG1hdGNoT25EZXRhaWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21hdGNoT25EZXRhaWw7XG5cdH1cblxuXHRzZXQgbWF0Y2hPbkRldGFpbChtYXRjaE9uRGV0YWlsOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fbWF0Y2hPbkRldGFpbCA9IG1hdGNoT25EZXRhaWw7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCBtYXRjaE9uTGFiZWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21hdGNoT25MYWJlbDtcblx0fVxuXG5cdHNldCBtYXRjaE9uTGFiZWwobWF0Y2hPbkxhYmVsOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fbWF0Y2hPbkxhYmVsID0gbWF0Y2hPbkxhYmVsO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgbWF0Y2hPbkxhYmVsTW9kZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbWF0Y2hPbkxhYmVsTW9kZTtcblx0fVxuXG5cdHNldCBtYXRjaE9uTGFiZWxNb2RlKG1hdGNoT25MYWJlbE1vZGU6ICdmdXp6eScgfCAnY29udGlndW91cycpIHtcblx0XHR0aGlzLl9tYXRjaE9uTGFiZWxNb2RlID0gbWF0Y2hPbkxhYmVsTW9kZTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IHNvcnRCeUxhYmVsKCkge1xuXHRcdHJldHVybiB0aGlzLl9zb3J0QnlMYWJlbDtcblx0fVxuXG5cdHNldCBzb3J0QnlMYWJlbChzb3J0QnlMYWJlbDogYm9vbGVhbikge1xuXHRcdHRoaXMuX3NvcnRCeUxhYmVsID0gc29ydEJ5TGFiZWw7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCBrZWVwU2Nyb2xsUG9zaXRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2tlZXBTY3JvbGxQb3NpdGlvbjtcblx0fVxuXG5cdHNldCBrZWVwU2Nyb2xsUG9zaXRpb24oa2VlcFNjcm9sbFBvc2l0aW9uOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fa2VlcFNjcm9sbFBvc2l0aW9uID0ga2VlcFNjcm9sbFBvc2l0aW9uO1xuXHR9XG5cblx0Z2V0IGl0ZW1BY3RpdmF0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtQWN0aXZhdGlvbjtcblx0fVxuXG5cdHNldCBpdGVtQWN0aXZhdGlvbihpdGVtQWN0aXZhdGlvbjogSXRlbUFjdGl2YXRpb24pIHtcblx0XHR0aGlzLl9pdGVtQWN0aXZhdGlvbiA9IGl0ZW1BY3RpdmF0aW9uO1xuXHR9XG5cblx0Z2V0IGFjdGl2ZUl0ZW1zKCkge1xuXHRcdHJldHVybiB0aGlzLl9hY3RpdmVJdGVtcztcblx0fVxuXG5cdHNldCBhY3RpdmVJdGVtcyhhY3RpdmVJdGVtczogVFtdKSB7XG5cdFx0dGhpcy5fYWN0aXZlSXRlbXMgPSBhY3RpdmVJdGVtcztcblx0XHR0aGlzLmFjdGl2ZUl0ZW1zVXBkYXRlZCA9IHRydWU7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdG9uRGlkQ2hhbmdlQWN0aXZlID0gdGhpcy5vbkRpZENoYW5nZUFjdGl2ZUVtaXR0ZXIuZXZlbnQ7XG5cblx0Z2V0IHNlbGVjdGVkSXRlbXMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NlbGVjdGVkSXRlbXM7XG5cdH1cblxuXHRzZXQgc2VsZWN0ZWRJdGVtcyhzZWxlY3RlZEl0ZW1zOiBUW10pIHtcblx0XHR0aGlzLl9zZWxlY3RlZEl0ZW1zID0gc2VsZWN0ZWRJdGVtcztcblx0XHR0aGlzLnNlbGVjdGVkSXRlbXNVcGRhdGVkID0gdHJ1ZTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0Z2V0IGtleU1vZHMoKSB7XG5cdFx0aWYgKHRoaXMuX3F1aWNrTmF2aWdhdGUpIHtcblx0XHRcdC8vIERpc2FibGUga2V5TW9kcyB3aGVuIHF1aWNrIG5hdmlnYXRlIGlzIGVuYWJsZWRcblx0XHRcdC8vIGJlY2F1c2UgaW4gdGhpcyBtb2RlbCB0aGUgaW50ZXJhY3Rpb24gaXMgcHVyZWx5XG5cdFx0XHQvLyBrZXlib2FyZCBkcml2ZW4gYW5kIEN0cmwvQWx0IGFyZSB0eXBpY2FsbHlcblx0XHRcdC8vIHByZXNzZWQgYW5kIGhvbGQgZHVyaW5nIHRoaXMgaW50ZXJhY3Rpb24uXG5cdFx0XHRyZXR1cm4gTk9fS0VZX01PRFM7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnVpLmtleU1vZHM7XG5cdH1cblxuXHRnZXQgdmFsdWVTZWxlY3Rpb24oKSB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy51aS5pbnB1dEJveC5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAoIXNlbGVjdGlvbikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIFtzZWxlY3Rpb24uc3RhcnQsIHNlbGVjdGlvbi5lbmRdO1xuXHR9XG5cblx0c2V0IHZhbHVlU2VsZWN0aW9uKHZhbHVlU2VsZWN0aW9uOiBSZWFkb25seTxbbnVtYmVyLCBudW1iZXJdPiB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3ZhbHVlU2VsZWN0aW9uID0gdmFsdWVTZWxlY3Rpb247XG5cdFx0dGhpcy52YWx1ZVNlbGVjdGlvblVwZGF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgY3VzdG9tQnV0dG9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9jdXN0b21CdXR0b247XG5cdH1cblxuXHRzZXQgY3VzdG9tQnV0dG9uKHNob3dDdXN0b21CdXR0b246IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9jdXN0b21CdXR0b24gPSBzaG93Q3VzdG9tQnV0dG9uO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgY3VzdG9tTGFiZWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1c3RvbUJ1dHRvbkxhYmVsO1xuXHR9XG5cblx0c2V0IGN1c3RvbUxhYmVsKGxhYmVsOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9jdXN0b21CdXR0b25MYWJlbCA9IGxhYmVsO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgY3VzdG9tSG92ZXIoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1c3RvbUJ1dHRvbkhvdmVyO1xuXHR9XG5cblx0c2V0IGN1c3RvbUhvdmVyKGhvdmVyOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9jdXN0b21CdXR0b25Ib3ZlciA9IGhvdmVyO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgb2soKSB7XG5cdFx0cmV0dXJuIHRoaXMuX29rO1xuXHR9XG5cblx0c2V0IG9rKHNob3dPa0J1dHRvbjogYm9vbGVhbiB8ICdkZWZhdWx0Jykge1xuXHRcdHRoaXMuX29rID0gc2hvd09rQnV0dG9uO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgb2tMYWJlbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fb2tMYWJlbCA/PyBsb2NhbGl6ZSgnb2snLCBcIk9LXCIpO1xuXHR9XG5cblx0c2V0IG9rTGFiZWwob2tMYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fb2tMYWJlbCA9IG9rTGFiZWw7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGlucHV0SGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudmlzaWJsZSA/IHRoaXMudWkuaW5wdXRCb3guaGFzRm9jdXMoKSA6IGZhbHNlO1xuXHR9XG5cblx0Zm9jdXNPbklucHV0KCkge1xuXHRcdHRoaXMudWkuaW5wdXRCb3guc2V0Rm9jdXMoKTtcblx0fVxuXG5cdGdldCBoaWRlSW5wdXQoKSB7XG5cdFx0cmV0dXJuICEhdGhpcy5faGlkZUlucHV0O1xuXHR9XG5cblx0c2V0IGhpZGVJbnB1dChoaWRlSW5wdXQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9oaWRlSW5wdXQgPSBoaWRlSW5wdXQ7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCBoaWRlQ291bnRCYWRnZSgpIHtcblx0XHRyZXR1cm4gISF0aGlzLl9oaWRlQ291bnRCYWRnZTtcblx0fVxuXG5cdHNldCBoaWRlQ291bnRCYWRnZShoaWRlQ291bnRCYWRnZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX2hpZGVDb3VudEJhZGdlID0gaGlkZUNvdW50QmFkZ2U7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCBoaWRlQ2hlY2tBbGwoKSB7XG5cdFx0cmV0dXJuICEhdGhpcy5faGlkZUNoZWNrQWxsO1xuXHR9XG5cblx0c2V0IGhpZGVDaGVja0FsbChoaWRlQ2hlY2tBbGw6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9oaWRlQ2hlY2tBbGwgPSBoaWRlQ2hlY2tBbGw7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdG9uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5vbkRpZENoYW5nZVNlbGVjdGlvbkVtaXR0ZXIuZXZlbnQ7XG5cblx0b25EaWRUcmlnZ2VySXRlbUJ1dHRvbiA9IHRoaXMub25EaWRUcmlnZ2VySXRlbUJ1dHRvbkVtaXR0ZXIuZXZlbnQ7XG5cblx0b25EaWRUcmlnZ2VyU2VwYXJhdG9yQnV0dG9uID0gdGhpcy5vbkRpZFRyaWdnZXJTZXBhcmF0b3JCdXR0b25FbWl0dGVyLmV2ZW50O1xuXG5cdHByaXZhdGUgdHJ5U2VsZWN0Rmlyc3QoKSB7XG5cdFx0aWYgKCF0aGlzLmNhblNlbGVjdE1hbnkpIHtcblx0XHRcdHRoaXMudWkubGlzdC5mb2N1cyhRdWlja1BpY2tGb2N1cy5GaXJzdCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgc2hvdygpIHtcblx0XHRpZiAoIXRoaXMudmlzaWJsZSkge1xuXHRcdFx0dGhpcy52aXNpYmxlRGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHR0aGlzLnVpLmlucHV0Qm94Lm9uRGlkQ2hhbmdlKHZhbHVlID0+IHtcblx0XHRcdFx0XHR0aGlzLmRvU2V0VmFsdWUodmFsdWUsIHRydWUgLyogc2tpcCB1cGRhdGUgc2luY2UgdGhpcyBvcmlnaW5hdGVzIGZyb20gdGhlIFVJICovKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0dGhpcy52aXNpYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudWkub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5jYW5TZWxlY3RNYW55KSB7XG5cdFx0XHRcdFx0Ly8gaWYgdGhlcmUgYXJlIG5vIGNoZWNrZWQgZWxlbWVudHMsIGl0IG1lYW5zIHRoYXQgYW4gb25EaWRDaGFuZ2VTZWxlY3Rpb24gbmV2ZXIgZmlyZWQgdG8gb3ZlcndyaXRlXG5cdFx0XHRcdFx0Ly8gYF9zZWxlY3RlZEl0ZW1zYC4gSW4gdGhhdCBjYXNlLCB3ZSBzaG91bGQgZW1pdCBvbmUgd2l0aCBhbiBlbXB0eSBhcnJheSB0byBlbnN1cmUgdGhhdFxuXHRcdFx0XHRcdC8vIGAuc2VsZWN0ZWRJdGVtc2AgaXMgdXAgdG8gZGF0ZS5cblx0XHRcdFx0XHRpZiAoIXRoaXMudWkubGlzdC5nZXRDaGVja2VkRWxlbWVudHMoKS5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3NlbGVjdGVkSXRlbXMgPSBbXTtcblx0XHRcdFx0XHRcdHRoaXMub25EaWRDaGFuZ2VTZWxlY3Rpb25FbWl0dGVyLmZpcmUodGhpcy5zZWxlY3RlZEl0ZW1zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5hY3RpdmVJdGVtc1swXSkge1xuXHRcdFx0XHRcdC8vIEZvciBzaW5nbGUtc2VsZWN0LCB3ZSBzZXQgYHNlbGVjdGVkSXRlbXNgIHRvIHRoZSBpdGVtIHRoYXQgd2FzIGFjY2VwdGVkLlxuXHRcdFx0XHRcdHRoaXMuX3NlbGVjdGVkSXRlbXMgPSBbdGhpcy5hY3RpdmVJdGVtc1swXV07XG5cdFx0XHRcdFx0dGhpcy5vbkRpZENoYW5nZVNlbGVjdGlvbkVtaXR0ZXIuZmlyZSh0aGlzLnNlbGVjdGVkSXRlbXMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuaGFuZGxlQWNjZXB0KGZhbHNlKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMudmlzaWJsZURpc3Bvc2FibGVzLmFkZCh0aGlzLnVpLm9uRGlkQ3VzdG9tKCgpID0+IHtcblx0XHRcdFx0dGhpcy5vbkRpZEN1c3RvbUVtaXR0ZXIuZmlyZSgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy52aXNpYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2ZvY3VzRXZlbnRCdWZmZXJlci53cmFwRXZlbnQoXG5cdFx0XHRcdHRoaXMudWkubGlzdC5vbkRpZENoYW5nZUZvY3VzLFxuXHRcdFx0XHQvLyBPbmx5IGZpcmUgdGhlIGxhc3QgZXZlbnRcblx0XHRcdFx0KF8sIGUpID0+IGVcblx0XHRcdCkoZm9jdXNlZEl0ZW1zID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuYWN0aXZlSXRlbXNVcGRhdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBFeHBlY3QgYW5vdGhlciBldmVudC5cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5hY3RpdmVJdGVtc1RvQ29uZmlybSAhPT0gdGhpcy5fYWN0aXZlSXRlbXMgJiYgZXF1YWxzKGZvY3VzZWRJdGVtcywgdGhpcy5fYWN0aXZlSXRlbXMsIChhLCBiKSA9PiBhID09PSBiKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9hY3RpdmVJdGVtcyA9IGZvY3VzZWRJdGVtcyBhcyBUW107XG5cdFx0XHRcdHRoaXMub25EaWRDaGFuZ2VBY3RpdmVFbWl0dGVyLmZpcmUoZm9jdXNlZEl0ZW1zIGFzIFRbXSk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLnZpc2libGVEaXNwb3NhYmxlcy5hZGQodGhpcy51aS5saXN0Lm9uRGlkQ2hhbmdlU2VsZWN0aW9uKCh7IGl0ZW1zOiBzZWxlY3RlZEl0ZW1zLCBldmVudCB9KSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLmNhblNlbGVjdE1hbnkgJiYgIXNlbGVjdGVkSXRlbXMuc29tZShpID0+IGkucGlja2FibGUgPT09IGZhbHNlKSkge1xuXHRcdFx0XHRcdGlmIChzZWxlY3RlZEl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0dGhpcy51aS5saXN0LnNldFNlbGVjdGVkRWxlbWVudHMoW10pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuc2VsZWN0ZWRJdGVtc1RvQ29uZmlybSAhPT0gdGhpcy5fc2VsZWN0ZWRJdGVtcyAmJiBlcXVhbHMoc2VsZWN0ZWRJdGVtcywgdGhpcy5fc2VsZWN0ZWRJdGVtcywgKGEsIGIpID0+IGEgPT09IGIpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3NlbGVjdGVkSXRlbXMgPSBzZWxlY3RlZEl0ZW1zIGFzIFRbXTtcblx0XHRcdFx0dGhpcy5vbkRpZENoYW5nZVNlbGVjdGlvbkVtaXR0ZXIuZmlyZShzZWxlY3RlZEl0ZW1zIGFzIFRbXSk7XG5cdFx0XHRcdGlmIChzZWxlY3RlZEl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMuaGFuZGxlQWNjZXB0KGRvbS5pc01vdXNlRXZlbnQoZXZlbnQpICYmIGV2ZW50LmJ1dHRvbiA9PT0gMSAvKiBtb3VzZSBtaWRkbGUgY2xpY2sgKi8pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLnZpc2libGVEaXNwb3NhYmxlcy5hZGQodGhpcy51aS5saXN0Lm9uQ2hhbmdlZENoZWNrZWRFbGVtZW50cyhjaGVja2VkSXRlbXMgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuY2FuU2VsZWN0TWFueSB8fCAhdGhpcy52aXNpYmxlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0aGlzLnNlbGVjdGVkSXRlbXNUb0NvbmZpcm0gIT09IHRoaXMuX3NlbGVjdGVkSXRlbXMgJiYgZXF1YWxzKGNoZWNrZWRJdGVtcywgdGhpcy5fc2VsZWN0ZWRJdGVtcywgKGEsIGIpID0+IGEgPT09IGIpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3NlbGVjdGVkSXRlbXMgPSBjaGVja2VkSXRlbXMgYXMgVFtdO1xuXHRcdFx0XHR0aGlzLm9uRGlkQ2hhbmdlU2VsZWN0aW9uRW1pdHRlci5maXJlKGNoZWNrZWRJdGVtcyBhcyBUW10pO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy52aXNpYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudWkubGlzdC5vbkJ1dHRvblRyaWdnZXJlZChldmVudCA9PiB0aGlzLm9uRGlkVHJpZ2dlckl0ZW1CdXR0b25FbWl0dGVyLmZpcmUoZXZlbnQgYXMgSVF1aWNrUGlja0l0ZW1CdXR0b25FdmVudDxUPikpKTtcblx0XHRcdHRoaXMudmlzaWJsZURpc3Bvc2FibGVzLmFkZCh0aGlzLnVpLmxpc3Qub25TZXBhcmF0b3JCdXR0b25UcmlnZ2VyZWQoZXZlbnQgPT4gdGhpcy5vbkRpZFRyaWdnZXJTZXBhcmF0b3JCdXR0b25FbWl0dGVyLmZpcmUoZXZlbnQpKSk7XG5cdFx0XHR0aGlzLnZpc2libGVEaXNwb3NhYmxlcy5hZGQodGhpcy5yZWdpc3RlclF1aWNrTmF2aWdhdGlvbigpKTtcblx0XHRcdHRoaXMudmFsdWVTZWxlY3Rpb25VcGRhdGVkID0gdHJ1ZTtcblx0XHR9XG5cdFx0c3VwZXIuc2hvdygpOyAvLyBUT0RPOiBXaHkgaGF2ZSBzaG93KCkgYnViYmxlIHVwIHdoaWxlIHVwZGF0ZSgpIHRyaWNrbGVzIGRvd24/XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUFjY2VwdChpbkJhY2tncm91bmQ6IGJvb2xlYW4pOiB2b2lkIHtcblxuXHRcdC8vIEZpZ3VyZSBvdXQgdmV0byB2aWEgYG9uV2lsbEFjY2VwdGAgZXZlbnRcblx0XHRsZXQgdmV0byA9IGZhbHNlO1xuXHRcdHRoaXMub25XaWxsQWNjZXB0RW1pdHRlci5maXJlKHsgdmV0bzogKCkgPT4gdmV0byA9IHRydWUgfSk7XG5cblx0XHQvLyBDb250aW51ZSB3aXRoIGBvbkRpZEFjY2VwdGAgaWYgbm8gdmV0b1xuXHRcdGlmICghdmV0bykge1xuXHRcdFx0dGhpcy5vbkRpZEFjY2VwdEVtaXR0ZXIuZmlyZSh7IGluQmFja2dyb3VuZCB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyUXVpY2tOYXZpZ2F0aW9uKCkge1xuXHRcdHJldHVybiBkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMudWkuY29udGFpbmVyLCBkb20uRXZlbnRUeXBlLktFWV9VUCwgZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5jYW5TZWxlY3RNYW55IHx8ICF0aGlzLl9xdWlja05hdmlnYXRlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qga2V5Ym9hcmRFdmVudDogU3RhbmRhcmRLZXlib2FyZEV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGNvbnN0IGtleUNvZGUgPSBrZXlib2FyZEV2ZW50LmtleUNvZGU7XG5cblx0XHRcdC8vIFNlbGVjdCBlbGVtZW50IHdoZW4ga2V5cyBhcmUgcHJlc3NlZCB0aGF0IHNpZ25hbCBpdFxuXHRcdFx0Y29uc3QgcXVpY2tOYXZLZXlzID0gdGhpcy5fcXVpY2tOYXZpZ2F0ZS5rZXliaW5kaW5ncztcblx0XHRcdGNvbnN0IHdhc1RyaWdnZXJLZXlQcmVzc2VkID0gcXVpY2tOYXZLZXlzLnNvbWUoayA9PiB7XG5cdFx0XHRcdGNvbnN0IGNob3JkcyA9IGsuZ2V0Q2hvcmRzKCk7XG5cdFx0XHRcdGlmIChjaG9yZHMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjaG9yZHNbMF0uc2hpZnRLZXkgJiYga2V5Q29kZSA9PT0gS2V5Q29kZS5TaGlmdCkge1xuXHRcdFx0XHRcdGlmIChrZXlib2FyZEV2ZW50LmN0cmxLZXkgfHwga2V5Ym9hcmRFdmVudC5hbHRLZXkgfHwga2V5Ym9hcmRFdmVudC5tZXRhS2V5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHRoaXMgaXMgYW4gb3B0aW1pc3RpYyBjaGVjayBmb3IgdGhlIHNoaWZ0IGtleSBiZWluZyB1c2VkIHRvIG5hdmlnYXRlIGJhY2sgaW4gcXVpY2sgaW5wdXRcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjaG9yZHNbMF0uYWx0S2V5ICYmIGtleUNvZGUgPT09IEtleUNvZGUuQWx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY2hvcmRzWzBdLmN0cmxLZXkgJiYga2V5Q29kZSA9PT0gS2V5Q29kZS5DdHJsKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY2hvcmRzWzBdLm1ldGFLZXkgJiYga2V5Q29kZSA9PT0gS2V5Q29kZS5NZXRhKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHdhc1RyaWdnZXJLZXlQcmVzc2VkKSB7XG5cdFx0XHRcdGlmICh0aGlzLmFjdGl2ZUl0ZW1zWzBdKSB7XG5cdFx0XHRcdFx0dGhpcy5fc2VsZWN0ZWRJdGVtcyA9IFt0aGlzLmFjdGl2ZUl0ZW1zWzBdXTtcblx0XHRcdFx0XHR0aGlzLm9uRGlkQ2hhbmdlU2VsZWN0aW9uRW1pdHRlci5maXJlKHRoaXMuc2VsZWN0ZWRJdGVtcyk7XG5cdFx0XHRcdFx0dGhpcy5oYW5kbGVBY2NlcHQoZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFVuc2V0IHF1aWNrIG5hdmlnYXRlIGFmdGVyIHByZXNzLiBJdCBpcyBvbmx5IHZhbGlkIG9uY2Vcblx0XHRcdFx0Ly8gYW5kIHNob3VsZCBub3QgcmVzdWx0IGluIGFueSBiZWhhdmlvdXIgY2hhbmdlIGFmdGVyd2FyZHNcblx0XHRcdFx0Ly8gaWYgdGhlIHBpY2tlciByZW1haW5zIG9wZW4gYmVjYXVzZSB0aGVyZSB3YXMgbm8gYWN0aXZlIGl0ZW1cblx0XHRcdFx0dGhpcy5fcXVpY2tOYXZpZ2F0ZSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGUoKSB7XG5cdFx0aWYgKCF0aGlzLnZpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gc3RvcmUgdGhlIHNjcm9sbFRvcCBiZWZvcmUgaXQgaXMgcmVzZXRcblx0XHRjb25zdCBzY3JvbGxUb3BCZWZvcmUgPSB0aGlzLmtlZXBTY3JvbGxQb3NpdGlvbiA/IHRoaXMuc2Nyb2xsVG9wIDogMDtcblx0XHRjb25zdCBoYXNEZXNjcmlwdGlvbiA9ICEhdGhpcy5kZXNjcmlwdGlvbjtcblx0XHRjb25zdCB2aXNpYmlsaXRpZXM6IFZpc2liaWxpdGllcyA9IHtcblx0XHRcdHRpdGxlOiAhIXRoaXMudGl0bGUgfHwgISF0aGlzLnN0ZXAgfHwgISF0aGlzLnRpdGxlQnV0dG9ucy5sZW5ndGgsXG5cdFx0XHRkZXNjcmlwdGlvbjogaGFzRGVzY3JpcHRpb24sXG5cdFx0XHRjaGVja0FsbDogdGhpcy5jYW5TZWxlY3RNYW55ICYmICF0aGlzLl9oaWRlQ2hlY2tBbGwsXG5cdFx0XHRjaGVja0JveDogdGhpcy5jYW5TZWxlY3RNYW55LFxuXHRcdFx0aW5wdXRCb3g6ICF0aGlzLl9oaWRlSW5wdXQsXG5cdFx0XHRwcm9ncmVzc0JhcjogIXRoaXMuX2hpZGVJbnB1dCB8fCBoYXNEZXNjcmlwdGlvbixcblx0XHRcdHZpc2libGVDb3VudDogdHJ1ZSxcblx0XHRcdGNvdW50OiB0aGlzLmNhblNlbGVjdE1hbnkgJiYgIXRoaXMuX2hpZGVDb3VudEJhZGdlLFxuXHRcdFx0b2s6IHRoaXMub2sgPT09ICdkZWZhdWx0JyA/IHRoaXMuY2FuU2VsZWN0TWFueSA6IHRoaXMub2ssXG5cdFx0XHRsaXN0OiB0cnVlLFxuXHRcdFx0bWVzc2FnZTogISF0aGlzLnZhbGlkYXRpb25NZXNzYWdlLFxuXHRcdFx0Y3VzdG9tQnV0dG9uOiB0aGlzLmN1c3RvbUJ1dHRvblxuXHRcdH07XG5cdFx0dGhpcy51aS5zZXRWaXNpYmlsaXRpZXModmlzaWJpbGl0aWVzKTtcblx0XHRzdXBlci51cGRhdGUoKTtcblx0XHRpZiAodGhpcy51aS5pbnB1dEJveC52YWx1ZSAhPT0gdGhpcy52YWx1ZSkge1xuXHRcdFx0dGhpcy51aS5pbnB1dEJveC52YWx1ZSA9IHRoaXMudmFsdWU7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnZhbHVlU2VsZWN0aW9uVXBkYXRlZCkge1xuXHRcdFx0dGhpcy52YWx1ZVNlbGVjdGlvblVwZGF0ZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMudWkuaW5wdXRCb3guc2VsZWN0KHRoaXMuX3ZhbHVlU2VsZWN0aW9uICYmIHsgc3RhcnQ6IHRoaXMuX3ZhbHVlU2VsZWN0aW9uWzBdLCBlbmQ6IHRoaXMuX3ZhbHVlU2VsZWN0aW9uWzFdIH0pO1xuXHRcdH1cblx0XHRpZiAodGhpcy51aS5pbnB1dEJveC5wbGFjZWhvbGRlciAhPT0gKHRoaXMucGxhY2Vob2xkZXIgfHwgJycpKSB7XG5cdFx0XHR0aGlzLnVpLmlucHV0Qm94LnBsYWNlaG9sZGVyID0gKHRoaXMucGxhY2Vob2xkZXIgfHwgJycpO1xuXHRcdH1cblxuXHRcdGxldCBhcmlhTGFiZWwgPSB0aGlzLmFyaWFMYWJlbDtcblx0XHQvLyBPbmx5IHNldCBhcmlhIGxhYmVsIHRvIHRoZSBpbnB1dCBib3ggcGxhY2Vob2xkZXIgaWYgd2UgYWN0dWFsbHkgaGF2ZSBhbiBpbnB1dCBib3guXG5cdFx0aWYgKCFhcmlhTGFiZWwgJiYgdmlzaWJpbGl0aWVzLmlucHV0Qm94KSB7XG5cdFx0XHRhcmlhTGFiZWwgPSB0aGlzLnBsYWNlaG9sZGVyIHx8IFF1aWNrUGljay5ERUZBVUxUX0FSSUFfTEFCRUw7XG5cdFx0XHQvLyBJZiB3ZSBoYXZlIGEgdGl0bGUsIGluY2x1ZGUgaXQgaW4gdGhlIGFyaWEgbGFiZWwuXG5cdFx0XHRpZiAodGhpcy50aXRsZSkge1xuXHRcdFx0XHRhcmlhTGFiZWwgKz0gYCAtICR7dGhpcy50aXRsZX1gO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGhpcy51aS5saXN0LmFyaWFMYWJlbCAhPT0gYXJpYUxhYmVsKSB7XG5cdFx0XHR0aGlzLnVpLmxpc3QuYXJpYUxhYmVsID0gYXJpYUxhYmVsID8/IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMudWkubGlzdC5tYXRjaE9uRGVzY3JpcHRpb24gPSB0aGlzLm1hdGNoT25EZXNjcmlwdGlvbjtcblx0XHR0aGlzLnVpLmxpc3QubWF0Y2hPbkRldGFpbCA9IHRoaXMubWF0Y2hPbkRldGFpbDtcblx0XHR0aGlzLnVpLmxpc3QubWF0Y2hPbkxhYmVsID0gdGhpcy5tYXRjaE9uTGFiZWw7XG5cdFx0dGhpcy51aS5saXN0Lm1hdGNoT25MYWJlbE1vZGUgPSB0aGlzLm1hdGNoT25MYWJlbE1vZGU7XG5cdFx0dGhpcy51aS5saXN0LnNvcnRCeUxhYmVsID0gdGhpcy5zb3J0QnlMYWJlbDtcblx0XHRpZiAodGhpcy5pdGVtc1VwZGF0ZWQpIHtcblx0XHRcdHRoaXMuaXRlbXNVcGRhdGVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9mb2N1c0V2ZW50QnVmZmVyZXIuYnVmZmVyRXZlbnRzKCgpID0+IHtcblx0XHRcdFx0dGhpcy51aS5saXN0LnNldEVsZW1lbnRzKHRoaXMuaXRlbXMpO1xuXHRcdFx0XHQvLyBXZSB3YW50IGZvY3VzIHRvIGV4aXN0IGluIHRoZSBsaXN0IGlmIHRoZXJlIGFyZSBpdGVtcyBzbyB0aGF0IHNwYWNlIGNhbiBiZSB1c2VkIHRvIHRvZ2dsZVxuXHRcdFx0XHR0aGlzLnVpLmxpc3Quc2hvdWxkTG9vcCA9ICF0aGlzLmNhblNlbGVjdE1hbnk7XG5cdFx0XHRcdHRoaXMudWkubGlzdC5maWx0ZXIodGhpcy5maWx0ZXJWYWx1ZSh0aGlzLnVpLmlucHV0Qm94LnZhbHVlKSk7XG5cdFx0XHRcdHN3aXRjaCAodGhpcy5faXRlbUFjdGl2YXRpb24pIHtcblx0XHRcdFx0XHRjYXNlIEl0ZW1BY3RpdmF0aW9uLk5PTkU6XG5cdFx0XHRcdFx0XHR0aGlzLl9pdGVtQWN0aXZhdGlvbiA9IEl0ZW1BY3RpdmF0aW9uLkZJUlNUOyAvLyBvbmx5IHZhbGlkIG9uY2UsIHRoZW4gdW5zZXRcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgSXRlbUFjdGl2YXRpb24uU0VDT05EOlxuXHRcdFx0XHRcdFx0dGhpcy51aS5saXN0LmZvY3VzKFF1aWNrUGlja0ZvY3VzLlNlY29uZCk7XG5cdFx0XHRcdFx0XHR0aGlzLl9pdGVtQWN0aXZhdGlvbiA9IEl0ZW1BY3RpdmF0aW9uLkZJUlNUOyAvLyBvbmx5IHZhbGlkIG9uY2UsIHRoZW4gdW5zZXRcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgSXRlbUFjdGl2YXRpb24uTEFTVDpcblx0XHRcdFx0XHRcdHRoaXMudWkubGlzdC5mb2N1cyhRdWlja1BpY2tGb2N1cy5MYXN0KTtcblx0XHRcdFx0XHRcdHRoaXMuX2l0ZW1BY3RpdmF0aW9uID0gSXRlbUFjdGl2YXRpb24uRklSU1Q7IC8vIG9ubHkgdmFsaWQgb25jZSwgdGhlbiB1bnNldFxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdHRoaXMudHJ5U2VsZWN0Rmlyc3QoKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0aWYgKHRoaXMudWkuY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucygnc2hvdy1jaGVja2JveGVzJykgIT09ICEhdGhpcy5jYW5TZWxlY3RNYW55KSB7XG5cdFx0XHRpZiAodGhpcy5jYW5TZWxlY3RNYW55KSB7XG5cdFx0XHRcdHRoaXMudWkubGlzdC5jbGVhckZvY3VzKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRyeVNlbGVjdEZpcnN0KCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLmFjdGl2ZUl0ZW1zVXBkYXRlZCkge1xuXHRcdFx0dGhpcy5hY3RpdmVJdGVtc1VwZGF0ZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuYWN0aXZlSXRlbXNUb0NvbmZpcm0gPSB0aGlzLl9hY3RpdmVJdGVtcztcblx0XHRcdHRoaXMudWkubGlzdC5zZXRGb2N1c2VkRWxlbWVudHModGhpcy5hY3RpdmVJdGVtcyk7XG5cdFx0XHRpZiAodGhpcy5hY3RpdmVJdGVtc1RvQ29uZmlybSA9PT0gdGhpcy5fYWN0aXZlSXRlbXMpIHtcblx0XHRcdFx0dGhpcy5hY3RpdmVJdGVtc1RvQ29uZmlybSA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLnNlbGVjdGVkSXRlbXNVcGRhdGVkKSB7XG5cdFx0XHR0aGlzLnNlbGVjdGVkSXRlbXNVcGRhdGVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLnNlbGVjdGVkSXRlbXNUb0NvbmZpcm0gPSB0aGlzLl9zZWxlY3RlZEl0ZW1zO1xuXHRcdFx0aWYgKHRoaXMuY2FuU2VsZWN0TWFueSkge1xuXHRcdFx0XHR0aGlzLnVpLmxpc3Quc2V0Q2hlY2tlZEVsZW1lbnRzKHRoaXMuc2VsZWN0ZWRJdGVtcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnVpLmxpc3Quc2V0U2VsZWN0ZWRFbGVtZW50cyh0aGlzLnNlbGVjdGVkSXRlbXMpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuc2VsZWN0ZWRJdGVtc1RvQ29uZmlybSA9PT0gdGhpcy5fc2VsZWN0ZWRJdGVtcykge1xuXHRcdFx0XHR0aGlzLnNlbGVjdGVkSXRlbXNUb0NvbmZpcm0gPSBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnVpLm9rLmxhYmVsID0gdGhpcy5va0xhYmVsIHx8ICcnO1xuXHRcdHRoaXMudWkuY3VzdG9tQnV0dG9uLmxhYmVsID0gdGhpcy5jdXN0b21MYWJlbCB8fCAnJztcblx0XHR0aGlzLnVpLmN1c3RvbUJ1dHRvbi5lbGVtZW50LnRpdGxlID0gdGhpcy5jdXN0b21Ib3ZlciB8fCAnJztcblx0XHRpZiAoIXZpc2liaWxpdGllcy5pbnB1dEJveCkge1xuXHRcdFx0Ly8gd2UgbmVlZCB0byBtb3ZlIGZvY3VzIGludG8gdGhlIHRyZWUgdG8gZGV0ZWN0IGtleWJpbmRpbmdzXG5cdFx0XHQvLyBwcm9wZXJseSB3aGVuIHRoZSBpbnB1dCBib3ggaXMgbm90IHZpc2libGUgKHF1aWNrIG5hdilcblx0XHRcdHRoaXMudWkubGlzdC5kb21Gb2N1cygpO1xuXG5cdFx0XHQvLyBGb2N1cyB0aGUgZmlyc3QgZWxlbWVudCBpbiB0aGUgbGlzdCBpZiBtdWx0aXNlbGVjdCBpcyBlbmFibGVkXG5cdFx0XHRpZiAodGhpcy5jYW5TZWxlY3RNYW55KSB7XG5cdFx0XHRcdHRoaXMudWkubGlzdC5mb2N1cyhRdWlja1BpY2tGb2N1cy5GaXJzdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IHRoZSBzY3JvbGwgcG9zaXRpb24gdG8gd2hhdCBpdCB3YXMgYmVmb3JlIHVwZGF0aW5nIHRoZSBpdGVtc1xuXHRcdGlmICh0aGlzLmtlZXBTY3JvbGxQb3NpdGlvbikge1xuXHRcdFx0dGhpcy5zY3JvbGxUb3AgPSBzY3JvbGxUb3BCZWZvcmU7XG5cdFx0fVxuXHR9XG5cblx0Zm9jdXMoZm9jdXM6IFF1aWNrUGlja0ZvY3VzKTogdm9pZCB7XG5cdFx0dGhpcy51aS5saXN0LmZvY3VzKGZvY3VzKTtcblx0XHQvLyBUbyBhbGxvdyB0aGluZ3MgbGlrZSBzcGFjZSB0byBjaGVjay91bmNoZWNrIGl0ZW1zXG5cdFx0aWYgKHRoaXMuY2FuU2VsZWN0TWFueSkge1xuXHRcdFx0dGhpcy51aS5saXN0LmRvbUZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0YWNjZXB0KGluQmFja2dyb3VuZD86IGJvb2xlYW4gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoaW5CYWNrZ3JvdW5kICYmICF0aGlzLl9jYW5BY2NlcHRJbkJhY2tncm91bmQpIHtcblx0XHRcdHJldHVybjsgLy8gbmVlZHMgdG8gYmUgZW5hYmxlZFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmFjdGl2ZUl0ZW1zWzBdKSB7XG5cdFx0XHR0aGlzLl9zZWxlY3RlZEl0ZW1zID0gW3RoaXMuYWN0aXZlSXRlbXNbMF1dO1xuXHRcdFx0dGhpcy5vbkRpZENoYW5nZVNlbGVjdGlvbkVtaXR0ZXIuZmlyZSh0aGlzLnNlbGVjdGVkSXRlbXMpO1xuXHRcdFx0dGhpcy5oYW5kbGVBY2NlcHQoaW5CYWNrZ3JvdW5kID8/IGZhbHNlKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIElucHV0Qm94IGV4dGVuZHMgUXVpY2tJbnB1dCBpbXBsZW1lbnRzIElJbnB1dEJveCB7XG5cdHByaXZhdGUgX3ZhbHVlID0gJyc7XG5cdHByaXZhdGUgX3ZhbHVlU2VsZWN0aW9uOiBSZWFkb25seTxbbnVtYmVyLCBudW1iZXJdPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB2YWx1ZVNlbGVjdGlvblVwZGF0ZWQgPSB0cnVlO1xuXHRwcml2YXRlIF9wbGFjZWhvbGRlcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9wYXNzd29yZCA9IGZhbHNlO1xuXHRwcml2YXRlIF9wcm9tcHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZFZhbHVlQ2hhbmdlRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb25EaWRBY2NlcHRFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cblx0cmVhZG9ubHkgdHlwZSA9IFF1aWNrSW5wdXRUeXBlLklucHV0Qm94O1xuXG5cdGdldCB2YWx1ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdmFsdWU7XG5cdH1cblxuXHRzZXQgdmFsdWUodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWUgfHwgJyc7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCB2YWx1ZVNlbGVjdGlvbigpIHtcblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLnVpLmlucHV0Qm94LmdldFNlbGVjdGlvbigpO1xuXHRcdGlmICghc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gW3NlbGVjdGlvbi5zdGFydCwgc2VsZWN0aW9uLmVuZF07XG5cdH1cblxuXHRzZXQgdmFsdWVTZWxlY3Rpb24odmFsdWVTZWxlY3Rpb246IFJlYWRvbmx5PFtudW1iZXIsIG51bWJlcl0+IHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fdmFsdWVTZWxlY3Rpb24gPSB2YWx1ZVNlbGVjdGlvbjtcblx0XHR0aGlzLnZhbHVlU2VsZWN0aW9uVXBkYXRlZCA9IHRydWU7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCBwbGFjZWhvbGRlcigpIHtcblx0XHRyZXR1cm4gdGhpcy5fcGxhY2Vob2xkZXI7XG5cdH1cblxuXHRzZXQgcGxhY2Vob2xkZXIocGxhY2Vob2xkZXI6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3BsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdGdldCBwYXNzd29yZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcGFzc3dvcmQ7XG5cdH1cblxuXHRzZXQgcGFzc3dvcmQocGFzc3dvcmQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9wYXNzd29yZCA9IHBhc3N3b3JkO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRnZXQgcHJvbXB0KCkge1xuXHRcdHJldHVybiB0aGlzLl9wcm9tcHQ7XG5cdH1cblxuXHRzZXQgcHJvbXB0KHByb21wdDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fcHJvbXB0ID0gcHJvbXB0O1xuXHRcdHRoaXMubm9WYWxpZGF0aW9uTWVzc2FnZSA9IHByb21wdFxuXHRcdFx0PyBsb2NhbGl6ZSgnaW5wdXRNb2RlRW50cnlEZXNjcmlwdGlvbicsIFwiezB9IChQcmVzcyAnRW50ZXInIHRvIGNvbmZpcm0gb3IgJ0VzY2FwZScgdG8gY2FuY2VsKVwiLCBwcm9tcHQpXG5cdFx0XHQ6IFF1aWNrSW5wdXQubm9Qcm9tcHRNZXNzYWdlO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRyZWFkb25seSBvbkRpZENoYW5nZVZhbHVlID0gdGhpcy5vbkRpZFZhbHVlQ2hhbmdlRW1pdHRlci5ldmVudDtcblxuXHRyZWFkb25seSBvbkRpZEFjY2VwdCA9IHRoaXMub25EaWRBY2NlcHRFbWl0dGVyLmV2ZW50O1xuXG5cdG92ZXJyaWRlIHNob3coKSB7XG5cdFx0aWYgKCF0aGlzLnZpc2libGUpIHtcblx0XHRcdHRoaXMudmlzaWJsZURpc3Bvc2FibGVzLmFkZChcblx0XHRcdFx0dGhpcy51aS5pbnB1dEJveC5vbkRpZENoYW5nZSh2YWx1ZSA9PiB7XG5cdFx0XHRcdFx0aWYgKHZhbHVlID09PSB0aGlzLnZhbHVlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0dGhpcy5vbkRpZFZhbHVlQ2hhbmdlRW1pdHRlci5maXJlKHZhbHVlKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0dGhpcy52aXNpYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudWkub25EaWRBY2NlcHQoKCkgPT4gdGhpcy5vbkRpZEFjY2VwdEVtaXR0ZXIuZmlyZSgpKSk7XG5cdFx0XHR0aGlzLnZhbHVlU2VsZWN0aW9uVXBkYXRlZCA9IHRydWU7XG5cdFx0fVxuXHRcdHN1cGVyLnNob3coKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGUoKSB7XG5cdFx0aWYgKCF0aGlzLnZpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnVpLmNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4taW5wdXQnKTtcblx0XHRjb25zdCB2aXNpYmlsaXRpZXM6IFZpc2liaWxpdGllcyA9IHtcblx0XHRcdHRpdGxlOiAhIXRoaXMudGl0bGUgfHwgISF0aGlzLnN0ZXAgfHwgISF0aGlzLnRpdGxlQnV0dG9ucy5sZW5ndGgsXG5cdFx0XHRkZXNjcmlwdGlvbjogISF0aGlzLmRlc2NyaXB0aW9uIHx8ICEhdGhpcy5zdGVwLFxuXHRcdFx0aW5wdXRCb3g6IHRydWUsXG5cdFx0XHRtZXNzYWdlOiB0cnVlLFxuXHRcdFx0cHJvZ3Jlc3NCYXI6IHRydWVcblx0XHR9O1xuXG5cdFx0dGhpcy51aS5zZXRWaXNpYmlsaXRpZXModmlzaWJpbGl0aWVzKTtcblx0XHRzdXBlci51cGRhdGUoKTtcblx0XHRpZiAodGhpcy51aS5pbnB1dEJveC52YWx1ZSAhPT0gdGhpcy52YWx1ZSkge1xuXHRcdFx0dGhpcy51aS5pbnB1dEJveC52YWx1ZSA9IHRoaXMudmFsdWU7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnZhbHVlU2VsZWN0aW9uVXBkYXRlZCkge1xuXHRcdFx0dGhpcy52YWx1ZVNlbGVjdGlvblVwZGF0ZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMudWkuaW5wdXRCb3guc2VsZWN0KHRoaXMuX3ZhbHVlU2VsZWN0aW9uICYmIHsgc3RhcnQ6IHRoaXMuX3ZhbHVlU2VsZWN0aW9uWzBdLCBlbmQ6IHRoaXMuX3ZhbHVlU2VsZWN0aW9uWzFdIH0pO1xuXHRcdH1cblx0XHRpZiAodGhpcy51aS5pbnB1dEJveC5wbGFjZWhvbGRlciAhPT0gKHRoaXMucGxhY2Vob2xkZXIgfHwgJycpKSB7XG5cdFx0XHR0aGlzLnVpLmlucHV0Qm94LnBsYWNlaG9sZGVyID0gKHRoaXMucGxhY2Vob2xkZXIgfHwgJycpO1xuXHRcdH1cblx0XHRpZiAodGhpcy51aS5pbnB1dEJveC5wYXNzd29yZCAhPT0gdGhpcy5wYXNzd29yZCkge1xuXHRcdFx0dGhpcy51aS5pbnB1dEJveC5wYXNzd29yZCA9IHRoaXMucGFzc3dvcmQ7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBRdWlja1dpZGdldCBleHRlbmRzIFF1aWNrSW5wdXQgaW1wbGVtZW50cyBJUXVpY2tXaWRnZXQge1xuXHRyZWFkb25seSB0eXBlID0gUXVpY2tJbnB1dFR5cGUuUXVpY2tXaWRnZXQ7XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZSgpIHtcblx0XHRpZiAoIXRoaXMudmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpc2liaWxpdGllczogVmlzaWJpbGl0aWVzID0ge1xuXHRcdFx0dGl0bGU6ICEhdGhpcy50aXRsZSB8fCAhIXRoaXMuc3RlcCB8fCAhIXRoaXMudGl0bGVCdXR0b25zLmxlbmd0aCxcblx0XHRcdGRlc2NyaXB0aW9uOiAhIXRoaXMuZGVzY3JpcHRpb24gfHwgISF0aGlzLnN0ZXBcblx0XHR9O1xuXG5cdFx0dGhpcy51aS5zZXRWaXNpYmlsaXRpZXModmlzaWJpbGl0aWVzKTtcblx0XHRzdXBlci51cGRhdGUoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUXVpY2tJbnB1dEhvdmVyRGVsZWdhdGUgZXh0ZW5kcyBXb3JrYmVuY2hIb3ZlckRlbGVnYXRlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCdlbGVtZW50JywgdW5kZWZpbmVkLCAob3B0aW9ucykgPT4gdGhpcy5nZXRPdmVycmlkZU9wdGlvbnMob3B0aW9ucyksIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPdmVycmlkZU9wdGlvbnMob3B0aW9uczogSUhvdmVyRGVsZWdhdGVPcHRpb25zKTogUGFydGlhbDxJSG92ZXJPcHRpb25zPiB7XG5cdFx0Ly8gT25seSBzaG93IHRoZSBob3ZlciBoaW50IGlmIHRoZSBjb250ZW50IGlzIG9mIGEgZGVjZW50IHNpemVcblx0XHRjb25zdCBzaG93SG92ZXJIaW50ID0gKFxuXHRcdFx0ZG9tLmlzSFRNTEVsZW1lbnQob3B0aW9ucy5jb250ZW50KVxuXHRcdFx0XHQ/IG9wdGlvbnMuY29udGVudC50ZXh0Q29udGVudCA/PyAnJ1xuXHRcdFx0XHQ6IHR5cGVvZiBvcHRpb25zLmNvbnRlbnQgPT09ICdzdHJpbmcnXG5cdFx0XHRcdFx0PyBvcHRpb25zLmNvbnRlbnRcblx0XHRcdFx0XHQ6IG9wdGlvbnMuY29udGVudC52YWx1ZVxuXHRcdCkuaW5jbHVkZXMoJ1xcbicpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHBlcnNpc3RlbmNlOiB7XG5cdFx0XHRcdGhpZGVPbktleURvd246IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdGFwcGVhcmFuY2U6IHtcblx0XHRcdFx0c2hvd0hvdmVySGludCxcblx0XHRcdFx0c2tpcEZhZGVJbkFuaW1hdGlvbjogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFTdEMsU0FBd0IsY0FBYztBQUN0QyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBZ0IscUJBQXFCO0FBQzlDLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsYUFBYTtBQUN0QixPQUFPLGNBQWM7QUFDckIsU0FBUyxpQkFBaUI7QUFDMUIsT0FBTztBQUNQLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQW1ULGdCQUFnQixhQUFhLDBCQUEwQixzQkFBc0IsZ0JBQWdC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
